// Security review hardening: M-9 (generated routes fail closed without a durable store), L-1 (no unsalted IP hash),
// L-2 (x-forwarded-for cannot be spoofed by its first entry), M-2 (features add refuses planted symlinks).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clientKey, sha256Hex } from '../shared.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const F = join(HERE, '..', '..', '..', 'scripts', 'features.mjs');
const run = (...a) => spawnSync('node', [F, ...a], { encoding: 'utf8' });
const proj = () => { const d = join(mkdtempSync(join(tmpdir(), 'feat ')), 'my site'); mkdirSync(d); return d; };
const ORIGIN = 'https://x.test';
const post = (path, body, headers = {}) => new Request(ORIGIN + path, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) });
const kv = () => { const m = new Map(); return { get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } }; };
const PAY = { STRIPE_SECRET_KEY: 'sk_test_' + 'abcdefghijklmnop', STRIPE_WEBHOOK_SECRET: 'whsec_abcdefghijklmnop', SITE_ORIGIN: ORIGIN, RATE_SALT: 'salty' };

async function routes(feature) {
  const d = proj(); assert.equal(run('add', d, feature).status, 0);
  const imp = (f) => import(pathToFileURL(join(d, f)).href + '?' + Math.random());
  return imp;
}
const code = async (res) => (await res.json()).error?.code;

test('M-9 payments: checkout and webhook answer 503 without ORDERS_KV unless LILAC_ENV is test or development', async () => {
  const imp = await routes('payments');
  const co = await imp('functions/api/checkout.js'), wh = await imp('functions/api/webhook.js');
  for (const env of [{ ...PAY }, { ...PAY, LILAC_ENV: 'production' }, { ...PAY, LILAC_ENV: '' }]) {
    const a = await co.onRequest({ env, request: post('/api/checkout', { items: [{ sku: 'x', qty: 1 }] }) });
    assert.equal(a.status, 503, JSON.stringify(env));
    assert.equal(await code(a), 'store_not_configured');
    const b = await wh.onRequest({ env, request: post('/api/webhook', {}) });
    assert.equal(b.status, 503);
    assert.match((await b.json()).error.message, /durable store|KV/i);
  }
});
test('M-9 payments: with LILAC_ENV=development, or a bound ORDERS_KV, the route is not blocked', async () => {
  const imp = await routes('payments');
  const co = await imp('functions/api/checkout.js');
  for (const env of [{ ...PAY, LILAC_ENV: 'development' }, { ...PAY, LILAC_ENV: 'test' }, { ...PAY, ORDERS_KV: kv() }]) {
    const a = await co.onRequest({ env, request: post('/api/checkout', { items: [{ sku: 'nope', qty: 1 }] }) });
    assert.notEqual(a.status, 503);
  }
});
test('M-9 payments (vercel): process.env is read the same way', async () => {
  const d = proj(); assert.equal(run('add', d, 'payments', '--host', 'vercel').status, 0);
  const co = await import(pathToFileURL(join(d, 'api/checkout.js')).href);
  const keep = { ...process.env };
  try {
    Object.assign(process.env, PAY); delete process.env.LILAC_ENV;
    assert.equal((await co.POST(post('/api/checkout', {}))).status, 503);
    process.env.LILAC_ENV = 'development';
    assert.notEqual((await co.POST(post('/api/checkout', {}))).status, 503);
  } finally { for (const k of Object.keys(PAY).concat('LILAC_ENV')) { if (k in keep) process.env[k] = keep[k]; else delete process.env[k]; } }
});
test('M-9 auth: sessions need a durable store too (503 in production)', async () => {
  const imp = await routes('auth');
  const au = await imp('functions/auth/[[path]].js');
  const env = { AUTH_SECRET: 'secret-one-0123456789', SITE_ORIGIN: ORIGIN, RESEND_API_KEY: 're_abcdefghijklmnopqrstu', AUTH_FROM: 'a@x.test', RATE_SALT: 's' };
  const r = await au.onRequest({ env, request: new Request(ORIGIN + '/auth/session') });
  assert.equal(r.status, 503);
  assert.equal(await code(r), 'store_not_configured');
  const ok = await au.onRequest({ env: { ...env, LILAC_ENV: 'development' }, request: new Request(ORIGIN + '/auth/session') });
  assert.notEqual(ok.status, 503);
});
test('M-9 contact: no RATE_KV in production logs a warning (rate limiting only), never silent; development stays quiet', async () => {
  const imp = await routes('contact-form');
  const m = await imp('functions/api/contact.js');
  const env = { CONTACT_ALLOWED_ORIGIN: ORIGIN, RESEND_API_KEY: 're_abcdefghijklmnopqrstu', CONTACT_FROM: 'a@x.test', CONTACT_TO: 'b@x.test', RATE_SALT: 's' };
  const warns = []; const w = console.warn; console.warn = (...a) => warns.push(a.join(' '));
  try {
    const r = await m.onRequest({ env: { ...env, LILAC_ENV: 'production' }, request: post('/api/contact', {}) });
    assert.notEqual(r.status, 503, 'contact is still served');
    assert.ok(warns.some((x) => /RATE_KV/.test(x)), 'warned: ' + warns.join('|'));
    warns.length = 0;
    await m.onRequest({ env: { ...env, LILAC_ENV: 'development' }, request: post('/api/contact', {}) });
    assert.equal(warns.length, 0);
  } finally { console.warn = w; }
});
test('L-1 an empty salt never gives an unsalted IP hash', async () => {
  const req = new Request(ORIGIN, { headers: { 'cf-connecting-ip': '203.0.113.9' } });
  const k = await clientKey(req, '');
  assert.notEqual(k, (await sha256Hex('|203.0.113.9')).slice(0, 32));
  assert.equal(k, await clientKey(req, ''), 'stable inside one instance');
  assert.notEqual(await clientKey(req, 'a'), await clientKey(req, 'b'));
});
test('L-2 x-forwarded-for: the client-controlled first entry does not choose the key', async () => {
  const mk = (xff) => new Request(ORIGIN, { headers: { 'x-forwarded-for': xff } });
  const a = await clientKey(mk('1.1.1.1, 198.51.100.7'), 's'), b = await clientKey(mk('9.9.9.9, 198.51.100.7'), 's');
  assert.equal(a, b);
  assert.equal(a, await clientKey(new Request(ORIGIN, { headers: { 'cf-connecting-ip': '198.51.100.7' } }), 's'));
  assert.notEqual(a, await clientKey(mk('1.1.1.1, 198.51.100.8'), 's'));
});
test('M-2 features add refuses a symlink planted at a target and writes nothing through it', () => {
  const d = proj(); const v = mkdtempSync(join(tmpdir(), 'victim '));
  mkdirSync(join(d, 'functions/_lilac'), { recursive: true });
  symlinkSync(join(v, 'gone.txt'), join(d, 'functions/_lilac/shared.mjs'));
  const r = run('add', d, 'contact-form');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /refusing to write/);
  assert.ok(!existsSync(join(v, 'gone.txt')));
  // an existing victim file behind a planted .gitignore link is not appended to
  const d2 = proj(); writeFileSync(join(v, 'victim.txt'), 'ORIGINAL\n'); symlinkSync(join(v, 'victim.txt'), join(d2, '.gitignore'));
  const r2 = run('add', d2, 'contact-form');
  assert.notEqual(r2.status, 0); assert.match(r2.stderr, /refusing to write/);
  assert.equal(readFileSync(join(v, 'victim.txt'), 'utf8'), 'ORIGINAL\n');
  // _headers with --yes
  const d3 = proj(); symlinkSync(join(v, 'victim.txt'), join(d3, '_headers'));
  const r3 = run('add', d3, 'contact-form', '--yes');
  assert.notEqual(r3.status, 0); assert.match(r3.stderr, /refusing to write/);
  assert.equal(readFileSync(join(v, 'victim.txt'), 'utf8'), 'ORIGINAL\n');
});
