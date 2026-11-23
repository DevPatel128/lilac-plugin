// Razorpay adapter tests: HMAC verify, server-side repricing, idempotent replay. Local fakes only, no network, test keys only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { razorpayProvider, createRazorpayCheckout, createRazorpayWebhook, verifyRazorpaySignature } from '../razorpay.mjs';
import { memoryStore } from '../../shared.mjs';

const HOST = 'https://shop.test', ORIGIN = HOST, NOW = 1_800_000_000_000, SECRET = 'whsec_fixture_not_real';
const PRICES = { tee: { amount: 150000, currency: 'inr', name: 'T-shirt' } };
const sign = (body, s = SECRET) => createHmac('sha256', s).update(body).digest('hex');
function setup() {
  const calls = []; const provider = { keyId: 'rzp_test_fixture', createOrder: async (x) => { calls.push(x); return { id: 'order_' + calls.length }; } };
  const orders = memoryStore(() => NOW);
  const h = createRazorpayCheckout({ provider, prices: PRICES, allowedOrigin: ORIGIN, orders, store: memoryStore(() => NOW), salt: 's', now: () => NOW });
  return { h, calls, orders };
}
const req = (body, headers = {}) => new Request(HOST + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, 'cf-connecting-ip': '9.9.9.9', ...headers }, body: JSON.stringify(body) });
const hook = (raw, sig) => new Request(HOST + '/api/webhook', { method: 'POST', headers: { 'x-razorpay-signature': sig, 'x-razorpay-event-id': 'evt_1' }, body: raw });

test('provider refuses live and non-test keys', () => {
  const doFetch = async () => new Response('{}');
  assert.throws(() => razorpayProvider({ keyId: 'rzp_live_x', keySecret: 's', doFetch }), /LIVE KEY REFUSED/);
  assert.throws(() => razorpayProvider({ keyId: 'abc', keySecret: 's', doFetch }), /rzp_test_/);
  assert.ok(razorpayProvider({ keyId: 'rzp_test_x', keySecret: 's', doFetch }).createOrder);
});
test('HMAC verify accepts valid, rejects tampered body, wrong secret, bad format', () => {
  const raw = '{"event":"payment.captured"}'; const sig = sign(raw);
  assert.equal(verifyRazorpaySignature(SECRET, raw, sig), true);
  assert.equal(verifyRazorpaySignature(SECRET, raw + ' ', sig), false);
  assert.equal(verifyRazorpaySignature(SECRET, raw, sign(raw, 'other')), false);
  assert.equal(verifyRazorpaySignature(SECRET, raw, 'zz'), false);
  assert.equal(verifyRazorpaySignature(SECRET, raw, null), false);
});
test('client-supplied price is refused; amount comes from the server list', async () => {
  const { h, calls } = setup();
  assert.equal((await h(req({ items: [{ sku: 'tee', qty: 1 }], amount: 1 }))).status, 400);
  assert.equal((await h(req({ items: [{ sku: 'tee', qty: 1, price: 1 }] }))).status, 400);
  assert.equal((await h(req({ items: [{ sku: 'tee', qty: 2 }] }))).status, 200);
  assert.equal(calls.length, 1); assert.equal(calls[0].amount, 300000); assert.equal(calls[0].currency, 'INR');
  assert.equal((await h(req({ items: [{ sku: 'tee', qty: 1 }], currency: 'usd' }))).status, 400);
});
test('idempotency-key replays the first answer without a second order', async () => {
  const { h, calls } = setup(); const hd = { 'idempotency-key': 'key-12345678' };
  const a = await (await h(req({ items: [{ sku: 'tee', qty: 1 }] }, hd))).json();
  const b = await (await h(req({ items: [{ sku: 'tee', qty: 1 }] }, hd))).json();
  assert.equal(calls.length, 1); assert.equal(b.orderId, a.orderId); assert.equal(b.replayed, true);
  assert.equal((await h(req({ items: [{ sku: 'tee', qty: 1 }] }, { 'idempotency-key': 'x' }))).status, 400);
});
test('webhook: bad signature 400, valid marks paid once, replay is a duplicate, amount mismatch refused', async () => {
  const orders = memoryStore(() => NOW), seen = memoryStore(() => NOW); let paid = 0;
  const w = createRazorpayWebhook({ secret: SECRET, orders, seen, now: () => NOW, onPaid: () => { paid++; } });
  await orders.set('rzp:order_1', { status: 'pending', total: 150000, currency: 'inr' });
  const ev = (amount) => JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'order_1', amount, currency: 'INR' } } } });
  const raw = ev(150000);
  assert.equal((await w(hook(raw, sign(raw + 'x')))).status, 400);
  assert.equal((await w(hook(raw, sign(raw)))).status, 200);
  assert.equal(paid, 1); assert.equal((await orders.get('rzp:order_1')).status, 'paid');
  assert.equal((await (await w(hook(raw, sign(raw)))).json()).duplicate, true); assert.equal(paid, 1);
  await orders.set('rzp:order_1', { status: 'pending', total: 150000, currency: 'inr' });
  const low = ev(100); assert.equal((await w(new Request(HOST + '/w', { method: 'POST', headers: { 'x-razorpay-signature': sign(low), 'x-razorpay-event-id': 'evt_2' }, body: low }))).status, 400);
});
