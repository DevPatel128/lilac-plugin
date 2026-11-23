// Tests contact-form handler, its three delivery adapters and shared helpers, only against local fakes (no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContactForm } from '../contact-form.mjs';
import { emailAdapter, supabaseAdapter } from '../deliver.mjs';
import { outboxAdapter } from '../outbox.mjs';
import { memoryStore } from '../shared.mjs';

const ORIGIN = 'https://site.test';
const NOW = 1_800_000_000_000;
function setup(over = {}) {
  const sent = [];
  const h = createContactForm({ allowedOrigin: ORIGIN, deliver: async (m) => { sent.push(m); }, store: memoryStore(() => NOW), salt: 's', now: () => NOW, ...over });
  return { h, sent };
}
const good = { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Hello, I would like a quote please.', consent: true, ts: NOW - 10_000 };
const req = (body, { type = 'application/json', origin = ORIGIN, method = 'POST', ip = '1.1.1.1' } = {}) =>
  new Request('https://site.test/api/contact', { method, headers: { 'content-type': type, origin, 'cf-connecting-ip': ip }, body: method === 'GET' ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });

test('happy path JSON delivers once and escapes HTML', async () => {
  const { h, sent } = setup();
  const r = await h(req({ ...good, message: '<script>alert(1)</script> hello there' }));
  assert.equal(r.status, 200);
  assert.equal(sent.length, 1);
  assert.ok(!sent[0].html.includes('<script>'));
  assert.ok(sent[0].html.includes('&lt;script&gt;'));
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
});
test('form-encoded input works', async () => {
  const { h, sent } = setup();
  const b = new URLSearchParams({ ...good, consent: 'on' }).toString();
  assert.equal((await h(req(b, { type: 'application/x-www-form-urlencoded' }))).status, 200);
  assert.equal(sent.length, 1);
});
test('GET is 405, wrong content type is 415', async () => {
  const { h } = setup();
  const g = await h(req('', { method: 'GET' }));
  assert.equal(g.status, 405); assert.ok(g.headers.get('allow'));
  assert.equal((await h(req('x', { type: 'text/plain' }))).status, 415);
});
test('oversized body is 413 and not delivered', async () => {
  const { h, sent } = setup();
  const r = await h(req({ ...good, message: 'x'.repeat(20000) }));
  assert.equal(r.status, 413); assert.equal(sent.length, 0);
});
test('header injection in name or email is refused', async () => {
  const { h, sent } = setup();
  assert.equal((await h(req({ ...good, name: 'a\r\nBcc: evil@x.com' }))).status, 400);
  assert.equal((await h(req({ ...good, email: 'a@b.com\r\nBcc: evil@x.com' }))).status, 400);
  assert.equal(sent.length, 0);
});
test('honeypot filled: looks like success, nothing delivered', async () => {
  const { h, sent } = setup();
  const r = await h(req({ ...good, website: 'http://spam' }));
  assert.equal(r.status, 200); assert.equal(sent.length, 0);
});
test('time trap: too fast or missing timestamp is refused', async () => {
  const { h, sent } = setup();
  assert.equal((await h(req({ ...good, ts: NOW - 500 }))).status, 400);
  const { ts, ...no } = good;
  assert.equal((await h(req(no))).status, 400);
  assert.equal(sent.length, 0);
});
test('rate limit per IP hash: 6th request is 429 with Retry-After; other IP unaffected', async () => {
  const { h } = setup();
  for (let i = 0; i < 5; i++) assert.equal((await h(req(good))).status, 200);
  const r = await h(req(good));
  assert.equal(r.status, 429); assert.ok(Number(r.headers.get('retry-after')) > 0);
  assert.equal((await h(req(good, { ip: '2.2.2.2' }))).status, 200);
});
test('privacy: consent required when privacy true, not when false', async () => {
  const a = setup();
  const r = await a.h(req({ ...good, consent: false }));
  assert.equal(r.status, 400); assert.ok((await r.json()).error.fields.consent);
  const b = setup({ privacy: false });
  assert.equal((await b.h(req({ ...good, consent: false }))).status, 200);
});
test('CORS locked to the site origin; preflight works', async () => {
  const { h, sent } = setup();
  assert.equal((await h(req(good, { origin: 'https://evil.test' }))).status, 403);
  assert.equal(sent.length, 0);
  const p = await h(req('', { method: 'OPTIONS' }).constructor === Request ? new Request('https://site.test/api/contact', { method: 'OPTIONS', headers: { origin: ORIGIN } }) : null);
  assert.equal(p.status, 204); assert.equal(p.headers.get('access-control-allow-origin'), ORIGIN);
});
test('strict validation returns field errors', async () => {
  const { h } = setup();
  for (const bad of [{ email: 'nope' }, { message: 'short' }, { name: 'n'.repeat(101) }, { name: '' }, { message: 'm'.repeat(5001) }]) {
    const r = await h(req({ ...good, ...bad }));
    assert.equal(r.status, 400, JSON.stringify(Object.keys(bad)));
    assert.ok((await r.json()).error.code);
  }
});
test('delivery failure is 502 and does not leak the vendor error', async () => {
  const { h } = setup({ deliver: async () => { throw new Error('boom key=re_SECRET123'); } });
  const r = await h(req(good));
  assert.equal(r.status, 502);
  assert.ok(!(await r.text()).includes('re_SECRET123'));
});

test('email adapter: Resend-style request shape (fake fetch)', async () => {
  const calls = [];
  const doFetch = async (url, init) => { calls.push({ url, init }); return new Response('{"id":"x"}', { status: 200 }); };
  const d = emailAdapter({ apiKey: 're_test_key', from: 'Site <a@site.test>', to: 'owner@site.test', doFetch });
  await d({ name: 'Ada', email: 'ada@example.com', text: 't', html: '<p>h</p>' });
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer re_test_key');
  const b = JSON.parse(calls[0].init.body);
  assert.deepEqual(b.to, ['owner@site.test']); assert.equal(b.reply_to, 'ada@example.com'); assert.ok(b.subject && b.html);
  const bad = emailAdapter({ apiKey: 're_test_key', from: 'a@b.c', to: 'o@b.c', doFetch: async () => new Response('no', { status: 401 }) });
  await assert.rejects(bad({ name: 'a', email: 'a@b.c', text: 't', html: 'h' }), (e) => !String(e.message).includes('re_test_key'));
  assert.throws(() => emailAdapter({ from: 'a', to: 'b', doFetch }), /RESEND_API_KEY/);
});
test('supabase adapter: REST insert shape (fake fetch), https only', async () => {
  const calls = [];
  const doFetch = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 201 }); };
  const d = supabaseAdapter({ url: 'https://abc.supabase.co', serviceKey: 'svc', table: 'contacts', doFetch });
  await d({ name: 'Ada', email: 'a@b.co', text: 'hello', html: '' });
  assert.equal(calls[0].url, 'https://abc.supabase.co/rest/v1/contacts');
  assert.equal(calls[0].init.headers.apikey, 'svc'); assert.equal(calls[0].init.headers.Authorization, 'Bearer svc');
  assert.equal(calls[0].init.headers.Prefer, 'return=minimal');
  assert.throws(() => supabaseAdapter({ url: 'http://abc.supabase.co', serviceKey: 's', table: 't', doFetch }), /https/);
});
test('outbox adapter appends JSONL', async () => {
  const f = join(mkdtempSync(join(tmpdir(), 'ob ')), 'out.jsonl');
  const d = outboxAdapter({ path: f });
  await d({ name: 'A', email: 'a@b.co', text: 'one', html: '' }); await d({ name: 'B', email: 'b@b.co', text: 'two', html: '' });
  const lines = readFileSync(f, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2); assert.equal(JSON.parse(lines[1]).name, 'B');
});
