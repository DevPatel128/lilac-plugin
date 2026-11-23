// payments (TEST MODE ONLY): checkout handler, webhook handler and a Stripe-style provider adapter. Web-standard, no dependencies.
// Rules enforced here: the amount is computed on the server from `prices` (the client may send only sku and qty; any client
// price field is refused); currency must be in an allowlist; the provider refuses any key that is not `sk_test_...`
// and refuses live keys loudly; the webhook verifies an HMAC-SHA256 signature in constant time, checks the timestamp tolerance,
// refuses replayed event ids and marks an order paid exactly once (idempotent).
// Stripe facts read 2026-11-22: signature header `Stripe-Signature: t=<unix>,v1=<hex>[,v1=...]`, signed string `<t>.<raw body>`,
//   HMAC-SHA256 with the endpoint secret (`whsec_...`), only v1 counts, default tolerance 5 minutes, track event ids against duplicates
//   (https://docs.stripe.com/webhooks). POST https://api.stripe.com/v1/checkout/sessions, form-encoded, secret key as basic-auth user,
//   `mode`, `success_url`, `cancel_url`, `client_reference_id`, response has `id` and `url` (https://docs.stripe.com/api/checkout/sessions/create).
// UNVERIFIED (not shown on the pages read): the inline `line_items[i][price_data][currency|unit_amount|product_data][name]` parameter names,
//   and anything that depends on the real Stripe service. Everything here is tested only against a local fake.
// Env names: STRIPE_SECRET_KEY (sk_test_...), STRIPE_WEBHOOK_SECRET (whsec_...), SITE_ORIGIN.
// shortcut: orders live in a store (memory or KV); KV is not atomic, so use D1/SQL before taking real payments.
import { json, fail, corsHeaders, originOk, readFields, readText, rateHit, clientKey, hmacHex, safeEqual, randomId } from './shared.mjs';

export function stripeProvider({ secretKey, doFetch }) {
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is missing (set it as an environment variable)');
  if (/^(sk|rk)_live_/.test(secretKey)) throw new Error('LIVE KEY REFUSED: this feature works in test mode only. Use a key that starts with sk_test_.');
  if (!secretKey.startsWith('sk_test_')) throw new Error('STRIPE_SECRET_KEY must start with sk_test_ (test mode only)');
  if (!doFetch) throw new Error('doFetch is missing');
  return {
    async createSession({ lineItems, currency, reference, successUrl, cancelUrl }) {
      const p = new URLSearchParams({ mode: 'payment', success_url: successUrl, cancel_url: cancelUrl, client_reference_id: reference });
      lineItems.forEach((li, i) => {
        p.set(`line_items[${i}][price_data][currency]`, currency);
        p.set(`line_items[${i}][price_data][unit_amount]`, String(li.unitAmount));
        p.set(`line_items[${i}][price_data][product_data][name]`, li.name);
        p.set(`line_items[${i}][quantity]`, String(li.quantity));
      });
      const res = await doFetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: 'Basic ' + btoa(secretKey + ':'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: p.toString(),
      });
      if (!res.ok) throw new Error(`payment provider answered ${res.status}`);
      const s = await res.json();
      if (!s.id || !s.url) throw new Error('payment provider gave no session');
      return { id: s.id, url: s.url };
    },
  };
}

// prices: { sku: { amount (smallest unit, integer), currency, name } }. provider: { createSession(...) }.
export function createCheckout(o) {
  if (!o?.provider || !o.prices || !o.allowedOrigin || !o.successUrl || !o.cancelUrl || !o.orders || !o.store) throw new Error('checkout needs provider, prices, allowedOrigin, successUrl, cancelUrl, orders, store');
  const { provider, prices, currencies = ['usd'], allowedOrigin, successUrl, cancelUrl, orders, store, salt = '', now = Date.now, maxBytes = 4096, maxQty = 10, maxLines = 20, rate = { max: 10, windowSec: 600 } } = o;
  const cors = corsHeaders(allowedOrigin);
  const reply = (s, c, m) => fail(s, c, m, {}, cors);
  for (const [sku, p] of Object.entries(prices)) if (!Number.isInteger(p.amount) || p.amount <= 0 || !currencies.includes(p.currency)) throw new Error(`price list entry ${sku} is invalid or its currency is not allowed`);

  return async function checkout(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: originOk(request, allowedOrigin) ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', {}, { ...cors, allow: 'POST, OPTIONS' });
    if (!originOk(request, allowedOrigin)) return fail(403, 'origin_not_allowed', 'This site may not use checkout.');
    const hit = await rateHit(store, 'checkout:' + await clientKey(request, salt), rate.max, rate.windowSec, now);
    if (hit.limited) return fail(429, 'rate_limited', 'Too many attempts. Please try again later.', {}, { ...cors, 'retry-after': String(hit.retryAfter) });
    const body = await readFields(request, maxBytes);
    if (!body.ok) return reply(body.status, body.code, body.status === 413 ? 'That request is too large.' : body.status === 415 ? 'Send JSON.' : 'We could not read that request.');
    const d = body.data;

    const bad = (m) => reply(400, 'invalid', m);
    if (Object.keys(d).some((k) => !['items', 'currency'].includes(k))) return bad('Prices and amounts are set by the server; send only items and currency.');
    if (!Array.isArray(d.items) || d.items.length < 1 || d.items.length > maxLines) return bad('Add between 1 and ' + maxLines + ' items.');
    const lineItems = []; let total = 0; let currency = null;
    for (const it of d.items) {
      if (!it || typeof it !== 'object' || Object.keys(it).some((k) => !['sku', 'qty'].includes(k))) return bad('Each item may only have sku and qty.');
      const p = typeof it.sku === 'string' && Object.hasOwn(prices, it.sku) ? prices[it.sku] : null;
      if (!p) return bad('Unknown item.');
      if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > maxQty) return bad('Quantity must be a whole number from 1 to ' + maxQty + '.');
      if (currency && currency !== p.currency) return bad('All items must use one currency.');
      currency = p.currency; total += p.amount * it.qty;
      lineItems.push({ name: p.name, unitAmount: p.amount, quantity: it.qty });
    }
    if (d.currency !== undefined && (typeof d.currency !== 'string' || !currencies.includes(d.currency.toLowerCase()) || d.currency.toLowerCase() !== currency)) return bad('That currency is not available for these items.');

    const reference = 'ord_' + randomId(12);
    let session;
    try { session = await provider.createSession({ lineItems, currency, total, reference, successUrl, cancelUrl }); }
    catch { return reply(502, 'provider_failed', 'We could not start the payment. Please try again later.'); }
    await orders.set(reference, { status: 'pending', total, currency, sessionId: session.id, createdAt: now() }, 7 * 24 * 3600);
    return json(200, { ok: true, url: session.url }, cors);
  };
}

// createWebhook({ secret, orders, seen, toleranceSec=300, now, onPaid, maxBytes }) -> async (Request) -> Response
export function createWebhook(o) {
  if (!o?.secret?.startsWith('whsec_')) throw new Error('STRIPE_WEBHOOK_SECRET must start with whsec_');
  if (!o.orders || !o.seen) throw new Error('webhook needs orders and seen stores');
  const { secret, orders, seen, toleranceSec = 300, now = Date.now, onPaid = () => {}, maxBytes = 65536 } = o;
  return async function webhook(request) {
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', {}, { allow: 'POST' });
    const t = await readText(request, maxBytes);
    if (!t.ok) return fail(t.status, t.code, 'Too large.');
    const header = request.headers.get('stripe-signature') || '';
    let ts = null; const sigs = [];
    for (const part of header.split(',')) { const i = part.indexOf('='); if (i < 0) continue; const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim(); if (k === 't') ts = v; else if (k === 'v1') sigs.push(v); }
    if (!/^\d+$/.test(ts || '') || !sigs.length) return fail(400, 'bad_signature', 'Signature missing.');
    const expected = await hmacHex(secret, `${ts}.${t.text}`);
    let match = false; for (const s of sigs) if (safeEqual(expected, s)) match = true; // no early exit: constant work
    if (!match) return fail(400, 'bad_signature', 'Signature does not match.');
    if (Math.abs(Math.floor(now() / 1000) - Number(ts)) > toleranceSec) return fail(400, 'stale', 'Timestamp outside tolerance.');
    let ev; try { ev = JSON.parse(t.text); } catch { return fail(400, 'bad_body', 'Not JSON.'); }
    if (!ev?.id || typeof ev.id !== 'string') return fail(400, 'bad_body', 'No event id.');
    if (await seen.get('evt:' + ev.id)) return json(200, { ok: true, duplicate: true });
    if (ev.type === 'checkout.session.completed') {
      const obj = ev.data?.object || {}; const order = await orders.get(obj.client_reference_id);
      if (!order) return json(200, { ok: true, ignored: true });
      if (obj.payment_status !== 'paid' || obj.amount_total !== order.total || String(obj.currency).toLowerCase() !== order.currency) return fail(400, 'amount_mismatch', 'Payment does not match the order.');
      if (order.status !== 'paid') { await orders.set(obj.client_reference_id, { ...order, status: 'paid', paidAt: now() }, 365 * 24 * 3600); await onPaid({ ...order, reference: obj.client_reference_id }); }
    }
    await seen.set('evt:' + ev.id, 1, 7 * 24 * 3600);
    return json(200, { ok: true });
  };
}
