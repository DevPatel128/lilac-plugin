// Tests forms.mjs against a fake fetch: no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createForm } from '../forms.mjs';

const URL_ = 'https://site.test/api', ORIGIN = 'https://site.test', NOW = 1_800_000_000_000;
const env = { RESEND_API_KEY: 'k', CONTACT_FROM: 'a@site.test', CONTACT_TO: 'b@site.test', SHEETS_WEBHOOK_URL: 'https://script.example.com/x', CRM_WEBHOOK_URL: 'https://crm.example.com/h', TURNSTILE_SECRET: 's' };
const good = { name: 'Ada', email: 'ada@example.com', message: 'Hello, I would like a quote.', consent: true, ts: NOW - 10_000 };
const req = (body, ip = '1.1.1.1') => new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, 'cf-connecting-ip': ip }, body: JSON.stringify(body) });
function mk(over = {}) { const calls = []; const doFetch = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ success: true }) }; }; return { calls, h: createForm({ target: 'email', allowedOrigin: ORIGIN, env, doFetch, now: () => NOW, ...over }) }; }

test('honeypot rejects: success shown, nothing sent', async () => { const { h, calls } = mk(); const r = await h(req({ ...good, website: 'http://spam' })); assert.equal(r.status, 200); assert.equal(calls.length, 0); });
test('too-fast rejects', async () => { const { h, calls } = mk(); const r = await h(req({ ...good, ts: NOW - 500 })); assert.equal(r.status, 400); assert.equal((await r.json()).error.code, 'too_fast'); assert.equal(calls.length, 0); });
test('over-long rejects', async () => { const { h, calls } = mk(); const r = await h(req({ ...good, message: 'x'.repeat(5001) })); assert.equal(r.status, 400); assert.equal(calls.length, 0); });
test('missing provider key gives an explicit error, not a silent drop', async () => {
  for (const [target, key] of [['email', 'RESEND_API_KEY'], ['sheets', 'SHEETS_WEBHOOK_URL'], ['crm', 'CRM_WEBHOOK_URL']]) {
    const { h, calls } = mk({ target, env: { ...env, [key]: '' } }); const r = await h(req(good)); const b = await r.json();
    assert.equal(r.status, 503); assert.equal(b.error.code, 'provider_not_configured'); assert.equal(b.error.setting, key); assert.equal(calls.length, 0);
  }
});
test('output is escaped', async () => { const { h, calls } = mk(); await h(req({ ...good, name: '<b>x</b>', message: '<script>alert(1)</script> hello there' })); const b = JSON.parse(calls[0].init.body); assert.ok(!b.html.includes('<script>') && !b.html.includes('<b>')); assert.ok(b.html.includes('&lt;script&gt;')); });
test('sheets and crm targets post JSON, crm token goes in a header', async () => {
  const s = mk({ target: 'sheets' }); assert.equal((await s.h(req(good))).status, 200); assert.equal(s.calls[0].url, env.SHEETS_WEBHOOK_URL); assert.equal(JSON.parse(s.calls[0].init.body).email, 'ada@example.com');
  const c = mk({ target: 'crm', env: { ...env, CRM_WEBHOOK_TOKEN: 't' } }); assert.equal((await c.h(req(good))).status, 200); assert.equal(c.calls[0].init.headers.Authorization, 'Bearer t');
});
test('non-https webhook url is refused', async () => { const { h } = mk({ target: 'sheets', env: { ...env, SHEETS_WEBHOOK_URL: 'http://x' } }); assert.equal((await h(req(good))).status, 503); });
test('provider failure answers 502 without leaking', async () => { const { h } = mk({ doFetch: async () => ({ ok: false, status: 500 }) }); const r = await h(req(good)); assert.equal(r.status, 502); assert.ok(!JSON.stringify(await r.json()).includes('500')); });
test('rate limit per IP', async () => { const { h } = mk(); let last; for (let i = 0; i < 6; i++) last = await h(req(good)); assert.equal(last.status, 429); assert.equal((await h(req(good, '2.2.2.2'))).status, 200); });
test('captcha: token verified, failure rejects, missing secret is UNKNOWN', async () => {
  const seen = []; const doFetch = async (u, i) => { seen.push(u); return { ok: true, json: async () => ({ success: /ok-token/.test(i.body) }) }; };
  const a = createForm({ target: 'email', allowedOrigin: ORIGIN, env, doFetch, now: () => NOW, captcha: 'turnstile' });
  assert.equal((await a(req({ ...good, 'cf-turnstile-response': 'ok-token' }))).status, 200);
  const bad = await a(req({ ...good, 'cf-turnstile-response': 'nope' })); assert.equal(bad.status, 400); assert.equal((await bad.json()).error.code, 'captcha_failed');
  assert.equal((await a(req(good))).status, 400);
  const e2 = { ...env }; delete e2.TURNSTILE_SECRET;
  const r = createForm({ target: 'email', allowedOrigin: ORIGIN, env: e2, doFetch, now: () => NOW, captcha: 'turnstile', captchaRequired: true });
  const rr = await r(req(good)); assert.equal(rr.status, 503); assert.equal((await rr.json()).error.code, 'captcha_unknown');
  const o = createForm({ target: 'email', allowedOrigin: ORIGIN, env: e2, doFetch, now: () => NOW, captcha: 'turnstile' }); assert.equal((await o(req(good))).status, 200);
});
