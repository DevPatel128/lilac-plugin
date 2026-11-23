// Tests checkout + webhook handlers and the Stripe-style adapter, test mode only, against a local fake provider (no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckout, createWebhook, stripeProvider } from '../checkout.mjs';
import { memoryStore, hmacHex } from '../shared.mjs';

const ORIGIN = 'https://shop.test';
const NOW = 1_800_000_000_000;
const PRICES = { tee: { amount: 1500, currency: 'usd', name: 'T-shirt' } };
function fakeProvider() { const calls = []; return { calls, createSession: async (s) => { calls.push(s); return { id: 'cs_test_1', url: 'https://pay.fake/cs_test_1' }; } }; }
function setup(over = {}) {
  const provider = fakeProvider(); const orders = memoryStore(() => NOW);
  const h = createCheckout({ provider, prices: PRICES, currencies: ['usd', 'eur'], allowedOrigin: ORIGIN, successUrl: ORIGIN + '/ok', cancelUrl: ORIGIN + '/no', orders, store: memoryStore(() => NOW), salt: 's', now: () => NOW, ...over });
  return { h, provider, orders };
}
const req = (body, { type = 'application/json', origin = ORIGIN } = {}) =>
  new Request('https://shop.test/api/checkout', { method: 'POST', headers: { 'content-type': type, origin, 'cf-connecting-ip': '9.9.9.9' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('stripe adapter refuses live and non-test keys loudly', () => {
  const doFetch = async () => new Response('{}');
  assert.throws(() => stripeProvider({ secretKey: 'sk_live_abc123', doFetch }), /LIVE KEY REFUSED/);
  assert.throws(() => stripeProvider({ secretKey: 'rk_live_abc123', doFetch }), /LIVE KEY REFUSED/);
  assert.throws(() => stripeProvider({ secretKey: 'whatever', doFetch }), /sk_test_/);
  assert.throws(() => stripeProvider({ doFetch }), /STRIPE_SECRET_KEY/);
  assert.ok(stripeProvider({ secretKey: 'sk_test_abc', doFetch }).createSession);
});
test('stripe adapter request shape (fake fetch)', async () => {
  const calls = [];
  const doFetch = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ id: 'cs_test_9', url: 'https://checkout.stripe.com/c/x' }), { status: 200 }); };
  const p = stripeProvider({ secretKey: 'sk_test_abc', doFetch });
  const out = await p.createSession({ lineItems: [{ name: 'T-shirt', unitAmount: 1500, quantity: 2 }], currency: 'usd', reference: 'ord_1', successUrl: 'https://a.test/ok', cancelUrl: 'https://a.test/no' });
  assert.deepEqual(out, { id: 'cs_test_9', url: 'https://checkout.stripe.com/c/x' });
  assert.equal(calls[0].url, 'https://api.stripe.com/v1/checkout/sessions');
  const form = new URLSearchParams(calls[0].init.body);
  assert.equal(form.get('mode'), 'payment'); assert.equal(form.get('client_reference_id'), 'ord_1');
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '1500'); assert.equal(form.get('line_items[0][quantity]'), '2');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const bad = stripeProvider({ secretKey: 'sk_test_abc', doFetch: async () => new Response('{"error":{"message":"sk_test_abc leaked"}}', { status: 400 }) });
  await assert.rejects(bad.createSession({ lineItems: [], currency: 'usd', reference: 'r', successUrl: 'u', cancelUrl: 'c' }), (e) => !e.message.includes('sk_test_abc'));
});
test('checkout computes the amount server side from the price list', async () => {
  const { h, provider, orders } = setup();
  const r = await h(req({ items: [{ sku: 'tee', qty: 2 }] }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).url, 'https://pay.fake/cs_test_1');
  assert.equal(provider.calls[0].lineItems[0].unitAmount, 1500);
  assert.equal(provider.calls[0].successUrl, ORIGIN + '/ok');
  const o = await orders.get(provider.calls[0].reference);
  assert.equal(o.total, 3000); assert.equal(o.status, 'pending');
});
test('tampered client price or amount is refused', async () => {
  const { h, provider } = setup();
  assert.equal((await h(req({ items: [{ sku: 'tee', qty: 1 }], amount: 1 }))).status, 400);
  assert.equal((await h(req({ items: [{ sku: 'tee', qty: 1, price: 1 }] }))).status, 400);
  assert.equal((await h(req({ items: [{ sku: 'tee', qty: 1, unitAmount: 1 }] }))).status, 400);
  assert.equal(provider.calls.length, 0);
});
test('checkout input attacks: sku, qty, currency, type, size, origin', async () => {
  const { h, provider } = setup();
  for (const body of [{ items: [{ sku: 'nope', qty: 1 }] }, { items: [{ sku: 'tee', qty: 0 }] }, { items: [{ sku: 'tee', qty: 999 }] }, { items: [{ sku: 'tee', qty: 1.5 }] }, { items: [] }, { items: [{ sku: 'tee', qty: 1 }], currency: 'btc' }, { items: [{ sku: 'tee', qty: 1 }], currency: 'eur' }])
    assert.equal((await h(req(body))).status, 400, JSON.stringify(body));
  assert.equal((await h(req('x', { type: 'text/plain' }))).status, 415);
  assert.equal((await h(req({ items: [{ sku: 'tee', qty: 1 }], pad: 'x'.repeat(20000) }))).status, 413);
  assert.equal((await h(req({ items: [{ sku: 'tee', qty: 1 }] }, { origin: 'https://evil.test' }))).status, 403);
  assert.equal(provider.calls.length, 0);
});
test('provider failure is 502 and generic', async () => {
  const { h } = setup({ provider: { createSession: async () => { throw new Error('secret sk_test_zzz'); } } });
  const r = await h(req({ items: [{ sku: 'tee', qty: 1 }] }));
  assert.equal(r.status, 502); assert.ok(!(await r.text()).includes('sk_test_zzz'));
});

// webhook
const SECRET = 'whsec_testsecret';
async function sign(body, t = Math.floor(NOW / 1000), secret = SECRET) { return `t=${t},v1=${await hmacHex(secret, `${t}.${body}`)}`; }
const evt = (id, ref, amount = 3000, cur = 'usd') => JSON.stringify({ id, type: 'checkout.session.completed', data: { object: { client_reference_id: ref, amount_total: amount, currency: cur, payment_status: 'paid' } } });
async function whSetup() {
  const orders = memoryStore(() => NOW); await orders.set('ord_1', { status: 'pending', total: 3000, currency: 'usd' });
  const paid = []; const wh = createWebhook({ secret: SECRET, orders, seen: memoryStore(() => NOW), now: () => NOW, onPaid: (o) => paid.push(o) });
  return { wh, orders, paid };
}
const post = (body, sig) => new Request('https://shop.test/api/webhook', { method: 'POST', headers: sig ? { 'stripe-signature': sig } : {}, body });

test('webhook: valid signature marks order paid once; replay is a no-op', async () => {
  const { wh, orders, paid } = await whSetup(); const b = evt('evt_1', 'ord_1');
  assert.equal((await wh(post(b, await sign(b)))).status, 200);
  assert.equal((await orders.get('ord_1')).status, 'paid');
  const r2 = await wh(post(b, await sign(b)));
  assert.equal(r2.status, 200); assert.equal((await r2.json()).duplicate, true);
  const b2 = evt('evt_2', 'ord_1'); await wh(post(b2, await sign(b2)));
  assert.equal(paid.length, 1);
});
test('webhook: bad, missing, tampered, stale signatures and v0-only are refused', async () => {
  const { wh, orders } = await whSetup(); const b = evt('evt_3', 'ord_1');
  assert.equal((await wh(post(b, await sign(b, undefined, 'whsec_other')))).status, 400);
  assert.equal((await wh(post(b))).status, 400);
  const good = await sign(b);
  assert.equal((await wh(post(b.replace('3000', '1'), good))).status, 400);
  assert.equal((await wh(post(b, await sign(b, Math.floor(NOW / 1000) - 3600)))).status, 400);
  assert.equal((await wh(post(b, `t=${Math.floor(NOW / 1000)},v0=${await hmacHex(SECRET, 'x')}`))).status, 400);
  assert.equal((await orders.get('ord_1')).status, 'pending');
  assert.equal((await wh(post(b, `t=1,v1=zz,${good}`))).status, 200);
});
test('webhook: amount mismatch is refused and order stays pending', async () => {
  const { wh, orders } = await whSetup(); const b = evt('evt_4', 'ord_1', 100);
  assert.equal((await wh(post(b, await sign(b)))).status, 400);
  assert.equal((await orders.get('ord_1')).status, 'pending');
});
test('webhook: wrong method 405, oversize 413, bad secret refused at setup', async () => {
  const { wh } = await whSetup();
  assert.equal((await wh(new Request('https://shop.test/w', { method: 'GET' }))).status, 405);
  assert.equal((await wh(post('x'.repeat(200000), 't=1,v1=a'))).status, 413);
  assert.throws(() => createWebhook({ secret: 'nope', orders: memoryStore(), seen: memoryStore() }), /whsec_/);
});
