// contact-form: a Web-standard request handler. createContactForm(options) -> async (Request) -> Response.
// Defences, in order: OPTIONS preflight, POST only, Origin locked to the site, content type, size limit, per-IP-hash rate
// limit, honeypot, time trap, strict validation, consent when privacy is true, then deliver(message).
// options: allowedOrigin (required), deliver (required), store (rate-limit store), salt, privacy=true, now, maxBytes=8192,
// minFillMs=3000, rate={max:5,windowSec:600}. Honeypot field `website` (hidden, must stay empty); time field `ts` = epoch ms
// when the form was rendered.
// shortcut: `ts` is not signed, so a bot can forge it; it only stops naive instant posts. Sign it if bots get past.
import { json, fail, escapeHtml, corsHeaders, originOk, readFields, rateHit, clientKey, CTRL, EMAIL } from './shared.mjs';

const YES = new Set([true, 'true', 'on', '1', 'yes']);

export function createContactForm(o) {
  if (!o?.allowedOrigin || typeof o.deliver !== 'function' || !o.store) throw new Error('contact-form needs allowedOrigin, deliver and store');
  const { allowedOrigin, deliver, store, salt = '', privacy = true, now = Date.now, maxBytes = 8192, minFillMs = 3000, rate = { max: 5, windowSec: 600 } } = o;
  const cors = corsHeaders(allowedOrigin);
  const reply = (status, code, message, extra) => fail(status, code, message, extra, cors);

  return async function contactForm(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: originOk(request, allowedOrigin) ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', {}, { ...cors, allow: 'POST, OPTIONS' });
    if (!originOk(request, allowedOrigin)) return fail(403, 'origin_not_allowed', 'This site may not use this form.');

    const ct = (request.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('application/json') && !ct.startsWith('application/x-www-form-urlencoded')) return reply(415, 'unsupported_type', 'Send JSON or a normal form.');
    const hit = await rateHit(store, 'contact:' + await clientKey(request, salt), rate.max, rate.windowSec, now);
    if (hit.limited) return fail(429, 'rate_limited', 'Too many messages. Please try again later.', {}, { ...cors, 'retry-after': String(hit.retryAfter) });

    const body = await readFields(request, maxBytes);
    if (!body.ok) return reply(body.status, body.code, body.status === 413 ? 'That message is too large.' : 'We could not read that form.');
    const d = body.data;

    if (d.website) return json(200, { ok: true }, cors); // honeypot: bots see success, nothing is sent
    const ts = Number(d.ts);
    if (!Number.isFinite(ts) || now() - ts < minFillMs || now() - ts > 24 * 3600 * 1000) return reply(400, 'too_fast', 'Please take a moment and send the form again.');

    const name = typeof d.name === 'string' ? d.name.trim() : '', email = typeof d.email === 'string' ? d.email.trim() : '', message = typeof d.message === 'string' ? d.message.trim() : '';
    const fields = {};
    if (!name || name.length > 100 || CTRL.test(name)) fields.name = 'Enter your name (up to 100 characters, no line breaks).';
    if (email.length > 254 || !EMAIL.test(email)) fields.email = 'Enter a valid email address.';
    if (message.length < 10 || message.length > 5000) fields.message = 'Write between 10 and 5000 characters.';
    if (privacy && !YES.has(d.consent)) fields.consent = 'Please tick the box to agree to our privacy notice.';
    if (Object.keys(fields).length) return reply(400, 'invalid', 'Please fix the highlighted fields.', { fields });

    const msg = { name, email, text: `From: ${name} <${email}>\n\n${message}`, html: `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;</p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>` };
    try { await deliver(msg); } catch { return reply(502, 'delivery_failed', 'We could not send your message. Please try again later.'); }
    return json(200, { ok: true }, cors);
  };
}
