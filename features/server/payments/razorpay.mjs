// payments (TEST MODE ONLY), Razorpay for India: provider adapter, checkout handler, webhook handler. Stripe stays the default (../checkout.mjs, untouched).
// Rules: the browser sends only sku and qty; the amount is recomputed on the server from `prices` (any client price field is refused);
// currency is INR only; live keys (rzp_live_) are refused; an Idempotency-Key header replays the first answer instead of creating a second order;
// the webhook verifies X-Razorpay-Signature = HMAC-SHA256 hex of the RAW body with the webhook secret (node:crypto, constant time), then
// de-duplicates on X-Razorpay-Event-Id and marks the order paid exactly once, only if amount and currency match the stored order.
// Razorpay facts below are from memory of the public docs, NOT re-read this session: UNVERIFIED. Orders API: POST /v1/orders, basic auth key_id:key_secret,
//   body {amount (paise, integer), currency, receipt}; webhook events payment.captured / order.paid with payload.payment.entity {order_id, amount, currency}.
// Tested only against a local fake; no network code runs here unless the owner deploys it with their own test keys.
// Env names: RAZORPAY_KEY_ID (rzp_test_...), RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, SITE_ORIGIN.
// shortcut: stores are memory/KV (not atomic); use D1/SQL before taking real payments.
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { json, fail, corsHeaders, originOk, readFields, readText, rateHit, clientKey, randomId } from '../shared.mjs';

const ORDERS_URL = 'https://api.razorpay.com/v1/orders';

export function razorpayProvider({ keyId, keySecret, doFetch }) {
  if (!keyId || !keySecret) throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are missing (set them as environment variables)');
  if (/^rzp_live_/.test(keyId)) throw new Error('LIVE KEY REFUSED: this feature works in test mode only. Use a key id that starts with rzp_test_.');
  if (!keyId.startsWith('rzp_test_')) throw new Error('RAZORPAY_KEY_ID must start with rzp_test_ (test mode only)');
  if (!doFetch) throw new Error('doFetch is missing');
  return {
    keyId,
    async createOrder({ amount, currency, receipt }) {
      const res = await doFetch(ORDERS_URL, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency, receipt }),
      });
      if (!res.ok) throw new Error(`payment provider answered ${res.status}`);
      const o = await res.json();
      if (!o.id) throw new Error('payment provider gave no order');
      return { id: o.id };
    },
  };
}

// Constant-time hex HMAC check; a wrong length is rejected before timingSafeEqual (which throws on unequal lengths).
export function verifyRazorpaySignature(secret, rawBody, signature) {
  const want = createHmac('sha256', secret).update(rawBody).digest();
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  return timingSafeEqual(want, Buffer.from(signature, 'hex'));
}

// prices: { sku: { amount (paise, integer), currency: 'inr', name } }
export function createRazorpayCheckout(o) {
  if (!o?.provider || !o.prices || !o.allowedOrigin || !o.orders || !o.store) throw new Error('checkout needs provider, prices, allowedOrigin, orders, store');
  const { provider, prices, allowedOrigin, orders, store, salt = '', now = Date.now, maxBytes = 4096, maxQty = 10, maxLines = 20, rate = { max: 10, windowSec: 600 } } = o;
  const cors = corsHeaders(allowedOrigin, 'content-type, idempotency-key');
  const reply = (s, c, m) => fail(s, c, m, {}, cors);
  for (const [sku, p] of Object.entries(prices)) if (!Number.isInteger(p.amount) || p.amount <= 0 || p.currency !== 'inr') throw new Error(`price list entry ${sku} is invalid (amount in paise, currency inr)`);

  return async function checkout(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: originOk(request, allowedOrigin) ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', {}, { ...cors, allow: 'POST, OPTIONS' });
    if (!originOk(request, allowedOrigin)) return fail(403, 'origin_not_allowed', 'This site may not use checkout.');
    const hit = await rateHit(store, 'rzp-checkout:' + await clientKey(request, salt), rate.max, rate.windowSec, now);
    if (hit.limited) return fail(429, 'rate_limited', 'Too many attempts. Please try again later.', {}, { ...cors, 'retry-after': String(hit.retryAfter) });
    const idem = request.headers.get('idempotency-key');
    if (idem !== null && !/^[A-Za-z0-9_-]{8,64}$/.test(idem)) return reply(400, 'invalid', 'Idempotency-Key must be 8 to 64 letters, digits, - or _.');
    const idemKey = idem && 'rzp-idem:' + createHash('sha256').update(idem).digest('hex');
    if (idemKey) { const prev = await store.get(idemKey); if (prev) return json(200, { ...prev, replayed: true }, cors); }
    const body = await readFields(request, maxBytes);
    if (!body.ok) return reply(body.status, body.code, body.status === 413 ? 'That request is too large.' : body.status === 415 ? 'Send JSON.' : 'We could not read that request.');
    const d = body.data;
    const bad = (m) => reply(400, 'invalid', m);
    if (Object.keys(d).some((k) => !['items', 'currency'].includes(k))) return bad('Prices and amounts are set by the server; send only items and currency.');
    if (!Array.isArray(d.items) || d.items.length < 1 || d.items.length > maxLines) return bad('Add between 1 and ' + maxLines + ' items.');
    let total = 0;
    for (const it of d.items) {
      if (!it || typeof it !== 'object' || Object.keys(it).some((k) => !['sku', 'qty'].includes(k))) return bad('Each item may only have sku and qty.');
      const p = typeof it.sku === 'string' && Object.hasOwn(prices, it.sku) ? prices[it.sku] : null;
      if (!p) return bad('Unknown item.');
      if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > maxQty) return bad('Quantity must be a whole number from 1 to ' + maxQty + '.');
      total += p.amount * it.qty;
    }
    if (d.currency !== undefined && (typeof d.currency !== 'string' || d.currency.toLowerCase() !== 'inr')) return bad('Only INR is available.');

    const reference = 'ord_' + randomId(12);
    let rz;
    try { rz = await provider.createOrder({ amount: total, currency: 'INR', receipt: reference }); }
    catch { return reply(502, 'provider_failed', 'We could not start the payment. Please try again later.'); }
    await orders.set('rzp:' + rz.id, { status: 'pending', total, currency: 'inr', reference, createdAt: now() }, 7 * 24 * 3600);
    const out = { ok: true, orderId: rz.id, keyId: provider.keyId, amount: total, currency: 'INR' };
    if (idemKey) await store.set(idemKey, out, 24 * 3600);
    return json(200, out, cors);
  };
}

export function createRazorpayWebhook(o) {
  if (!o?.secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is missing');
  if (!o.orders || !o.seen) throw new Error('webhook needs orders and seen stores');
  const { secret, orders, seen, now = Date.now, onPaid = () => {}, maxBytes = 65536 } = o;
  return async function webhook(request) {
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', {}, { allow: 'POST' });
    const t = await readText(request, maxBytes);
    if (!t.ok) return fail(t.status, t.code, 'Too large.');
    if (!verifyRazorpaySignature(secret, t.text, request.headers.get('x-razorpay-signature'))) return fail(400, 'bad_signature', 'Signature does not match.');
    let ev; try { ev = JSON.parse(t.text); } catch { return fail(400, 'bad_body', 'Not JSON.'); }
    // the header is the provider's event id; a body hash is the fallback so a replayed identical body is still caught
    const evId = request.headers.get('x-razorpay-event-id') || 'h_' + createHash('sha256').update(t.text).digest('hex');
    if (await seen.get('rzp-evt:' + evId)) return json(200, { ok: true, duplicate: true });
    if (ev.event === 'payment.captured' || ev.event === 'order.paid') {
      const pay = ev.payload?.payment?.entity || {}; const key = 'rzp:' + pay.order_id;
      const order = typeof pay.order_id === 'string' ? await orders.get(key) : undefined;
      if (!order) return json(200, { ok: true, ignored: true });
      if (pay.amount !== order.total || String(pay.currency).toLowerCase() !== order.currency) return fail(400, 'amount_mismatch', 'Payment does not match the order.');
      if (order.status !== 'paid') { await orders.set(key, { ...order, status: 'paid', paidAt: now() }, 365 * 24 * 3600); await onPaid({ ...order, orderId: pay.order_id }); }
    }
    await seen.set('rzp-evt:' + evId, 1, 7 * 24 * 3600);
    return json(200, { ok: true });
  };
}
