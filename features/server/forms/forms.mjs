// forms: createForm(options) -> async (Request) -> Response. A form submission goes to email, Google Sheets or a CRM webhook.
// Spam protection comes from createContactForm (honeypot `website`, minimum fill time via `ts`, per-IP rate limit, length caps, body size cap, origin lock,
// escaped output). This file adds: the three targets, an optional Turnstile/hCaptcha token check, and an explicit error when a provider setting is missing.
// options: target ('email'|'sheets'|'crm'), allowedOrigin, env (an object of settings, e.g. process.env or the Worker env), doFetch (injected Web fetch),
//   store (default: in-memory), salt, privacy, now, minFillMs=3000, rate={max:5,windowSec:600}, maxBytes=8192, captcha ('turnstile'|'hcaptcha'|undefined),
//   captchaRequired=false.
// Settings (never in the repo; set at the host): email RESEND_API_KEY + CONTACT_FROM + CONTACT_TO; sheets SHEETS_WEBHOOK_URL (your Apps Script web-app URL,
//   https); crm CRM_WEBHOOK_URL (https) + optional CRM_WEBHOOK_TOKEN; captcha TURNSTILE_SECRET or HCAPTCHA_SECRET.
// A missing provider setting answers 503 provider_not_configured and names the setting. It never answers success and never drops the message silently.
// A captcha with no secret is UNKNOWN: with captchaRequired it answers 503 captcha_unknown, otherwise the check is skipped and says so in the result headers.
// Network: only through the injected doFetch, called after the owner deploys with their own keys; the plugin never runs it. Tests use a local fake.
// shortcut: the in-memory rate limit is per instance and resets on restart (5 messages per 10 minutes per IP by default); pass a KV-backed store for a shared limit.
//   Real delivery to Resend, Apps Script, a CRM, Turnstile and hCaptcha is UNVERIFIED (no live call made).
import { createContactForm } from '../contact-form.mjs';
import { emailAdapter } from '../deliver.mjs';
import { memoryStore, fail, escapeHtml } from '../shared.mjs';

const need = (env, name) => { const v = env?.[name]; if (!v || !String(v).trim()) throw Object.assign(new Error(`${name} is missing (set it as an environment variable at your host)`), { setting: name }); return String(v).trim(); };
const https = (u, name) => { if (!/^https:\/\//.test(u)) throw Object.assign(new Error(`${name} must be an https address`), { setting: name }); return u; };
const post = async (doFetch, url, headers, body, what) => {
  const res = await doFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${what} answered ${res.status}`); // never include the response body or the key
};

// Each adapter returns deliver(msg), msg = { name, email, text, html }. Throws with `setting` set when a setting is missing.
export function adapterFor(target, env, doFetch) {
  if (typeof doFetch !== 'function') throw Object.assign(new Error('doFetch is missing'), { setting: 'doFetch' });
  if (target === 'email') return emailAdapter({ apiKey: need(env, 'RESEND_API_KEY'), from: need(env, 'CONTACT_FROM'), to: need(env, 'CONTACT_TO'), doFetch });
  if (target === 'sheets') {
    const url = https(need(env, 'SHEETS_WEBHOOK_URL'), 'SHEETS_WEBHOOK_URL');
    return (m) => post(doFetch, url, {}, { name: m.name, email: m.email, message: m.text, receivedAt: new Date().toISOString() }, 'Sheets webhook');
  }
  if (target === 'crm') {
    const url = https(need(env, 'CRM_WEBHOOK_URL'), 'CRM_WEBHOOK_URL'), tok = env?.CRM_WEBHOOK_TOKEN;
    return (m) => post(doFetch, url, tok ? { Authorization: `Bearer ${tok}` } : {}, { name: m.name, email: m.email, message: m.text, source: 'website-form' }, 'CRM webhook');
  }
  throw new Error(`unknown target "${target}" (use email, sheets or crm)`);
}

const CAPTCHA = {
  turnstile: { field: 'cf-turnstile-response', secret: 'TURNSTILE_SECRET', url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify' },
  hcaptcha: { field: 'h-captcha-response', secret: 'HCAPTCHA_SECRET', url: 'https://api.hcaptcha.com/siteverify' },
};
// Returns 'PASS' | 'FAIL' | 'UNKNOWN' (no secret configured). Provider response format: { success: boolean }.
export async function verifyCaptcha(kind, token, env, doFetch, ip) {
  const c = CAPTCHA[kind]; if (!c) throw new Error(`unknown captcha "${kind}"`);
  const secret = env?.[c.secret]; if (!secret) return 'UNKNOWN';
  if (typeof token !== 'string' || !token || token.length > 4096) return 'FAIL';
  const form = new URLSearchParams({ secret, response: token }); if (ip) form.set('remoteip', ip);
  try {
    const res = await doFetch(c.url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    return res.ok && (await res.json()).success === true ? 'PASS' : 'FAIL';
  } catch { return 'FAIL'; }
}

export function createForm(o = {}) {
  const { target, allowedOrigin, env = {}, doFetch, captcha, captchaRequired = false, ...rest } = o;
  if (!allowedOrigin) throw new Error('forms needs allowedOrigin');
  let deliver;
  try { deliver = adapterFor(target, env, doFetch); } catch (e) {
    return async () => fail(503, 'provider_not_configured', `This form is not set up yet: ${escapeHtml(e.setting || e.message)} is missing.`, { setting: e.setting || null });
  }
  if (captcha && !CAPTCHA[captcha]) throw new Error(`unknown captcha "${captcha}"`);
  const inner = createContactForm({ store: memoryStore(rest.now), ...rest, allowedOrigin, deliver });
  if (!captcha) return inner;
  return async function form(request) {
    if (request.method !== 'POST') return inner(request);
    const c = CAPTCHA[captcha];
    if (!env[c.secret]) {
      if (captchaRequired) return fail(503, 'captcha_unknown', `Spam check status UNKNOWN: ${c.secret} is missing.`, { setting: c.secret });
      return inner(request); // optional and not configured: skipped, honeypot/time/rate limit still apply
    }
    let token; // read from a clone so the inner handler still gets an unread body
    try { const b = await readToken(request.clone(), c.field); token = b; } catch { token = undefined; }
    const ip = request.headers.get('cf-connecting-ip') || undefined;
    if ((await verifyCaptcha(captcha, token, env, doFetch, ip)) !== 'PASS') return fail(400, 'captcha_failed', 'Please complete the spam check and try again.');
    return inner(request);
  };
}
async function readToken(req, field) {
  const text = (await req.text()).slice(0, 16384), ct = (req.headers.get('content-type') || '').toLowerCase();
  const v = ct.startsWith('application/json') ? JSON.parse(text)?.[field] : new URLSearchParams(text).get(field);
  return typeof v === 'string' ? v : undefined;
}
