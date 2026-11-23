// Tests scripts/features.mjs (list, add, check) in temp projects whose path contains a space, plus the no-network-code rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, '..');
const F = join(HERE, '..', '..', '..', 'scripts', 'features.mjs');
const run = (...a) => spawnSync('node', [F, ...a], { encoding: 'utf8' });
const proj = () => { const d = join(mkdtempSync(join(tmpdir(), 'feat ')), 'my site'); mkdirSync(d); return d; };
const CONSENT_FORM = '<form><input type="email" name="email"><textarea name="message"></textarea><label><input type="checkbox" name="consent"> I agree</label><p>See our privacy notice.</p></form>';

test('list shows the three features and variable names', () => {
  const r = run('list');
  assert.equal(r.status, 0);
  for (const w of ['contact-form', 'payments', 'auth', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY', 'AUTH_SECRET']) assert.ok(r.stdout.includes(w), w);
});
test('add (cloudflare) copies files, writes names only, never overwrites', () => {
  const d = proj();
  const r = run('add', d, 'contact-form');
  assert.equal(r.status, 0, r.stderr);
  for (const f of ['functions/_lilac/shared.mjs', 'functions/_lilac/contact-form.mjs', 'functions/_lilac/deliver.mjs', 'functions/api/contact.js']) assert.ok(existsSync(join(d, f)), f);
  const vars = readFileSync(join(d, '.dev.vars.example'), 'utf8');
  assert.ok(vars.includes('CONTACT_ALLOWED_ORIGIN=') && vars.includes('RESEND_API_KEY='));
  assert.ok(!/=\S/.test(vars.replace(/^#.*$/gm, '')), 'no values');
  const gi = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.ok(gi.includes('.dev.vars') && gi.includes('.env'));
  writeFileSync(join(d, 'functions/_lilac/shared.mjs'), '// mine');
  run('add', d, 'contact-form');
  assert.equal(readFileSync(join(d, 'functions/_lilac/shared.mjs'), 'utf8'), '// mine');
});
test('add (vercel) uses api/', () => {
  const d = proj();
  assert.equal(run('add', d, 'auth', '--host', 'vercel').status, 0);
  assert.ok(existsSync(join(d, 'api/_lilac/auth.mjs')) && existsSync(join(d, 'api/auth/[...path].js')));
  assert.ok(!existsSync(join(d, 'functions')));
});
test('add rejects unknown feature or host', () => {
  const d = proj();
  assert.notEqual(run('add', d, 'nope').status, 0);
  assert.notEqual(run('add', d, 'auth', '--host', 'mars').status, 0);
});
test('_headers is only touched with --yes, and only once', () => {
  const d = proj(); writeFileSync(join(d, '_headers'), '/*\n  X-Frame-Options: DENY\n');
  const r = run('add', d, 'payments');
  assert.ok(r.stdout.includes("connect-src 'self'"));
  assert.equal(readFileSync(join(d, '_headers'), 'utf8'), '/*\n  X-Frame-Options: DENY\n');
  run('add', d, 'payments', '--yes'); run('add', d, 'payments', '--yes');
  const h = readFileSync(join(d, '_headers'), 'utf8');
  assert.equal(h.split("connect-src 'self'").length - 1, 1);
  assert.ok(h.startsWith('/*\n  X-Frame-Options: DENY'));
});
test('cloudflare route wrapper answers 501 until delivery is configured', async () => {
  const d = proj(); run('add', d, 'contact-form');
  const m = await import(pathToFileURL(join(d, 'functions/api/contact.js')).href);
  const res = await m.onRequest({ env: { CONTACT_ALLOWED_ORIGIN: 'https://x.test' }, request: new Request('https://x.test/api/contact', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://x.test' }, body: '{}' }) });
  assert.equal(res.status, 501);
});
test('check passes on a clean project and fails on each problem, never printing values', () => {
  const d = proj();
  run('add', d, 'contact-form'); run('add', d, 'payments'); run('add', d, 'auth');
  writeFileSync(join(d, 'index.html'), '<html>' + CONSENT_FORM + '</html>');
  const ok = run('check', d);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const bad = (name, setup, expect) => {
    const c = proj(); run('add', c, 'contact-form'); run('add', c, 'payments'); writeFileSync(join(c, 'index.html'), CONSENT_FORM);
    setup(c); const r = run('check', c);
    assert.notEqual(r.status, 0, name); if (expect) assert.ok(r.stdout.includes(expect), name + ': ' + r.stdout);
    assert.ok(!r.stdout.includes('LEAKVALUE'), 'value printed');
  };
  bad('live key in code', (c) => writeFileSync(join(c, 'x.js'), 'const k="sk_' + 'live_LEAKVALUE1234567890";'), 'secret');
  bad('test key in code', (c) => writeFileSync(join(c, 'x.js'), 'const k="sk_' + 'test_LEAKVALUE1234567890";'), 'secret');
  bad('whsec in code', (c) => writeFileSync(join(c, 'x.js'), 'const k="whsec_' + 'LEAKVALUE1234567890";'), 'secret');
  bad('dev vars not ignored', (c) => { writeFileSync(join(c, '.dev.vars'), 'X=1\n'); writeFileSync(join(c, '.gitignore'), 'node_modules\n'); }, 'ignore');
  bad('live key in .dev.vars', (c) => writeFileSync(join(c, '.dev.vars'), 'STRIPE_SECRET_KEY=sk_' + 'live_LEAKVALUE1234567890\n'), 'test-mode');
  bad('non-test key in .dev.vars', (c) => writeFileSync(join(c, '.dev.vars'), 'STRIPE_SECRET_KEY=LEAKVALUE\n'), 'test-mode');
  bad('form without consent', (c) => writeFileSync(join(c, 'index.html'), '<form><input type="email"><textarea></textarea></form>'), 'consent');
  bad('form without privacy note', (c) => writeFileSync(join(c, 'index.html'), '<form><input type="email" name="email"><textarea></textarea><input type="checkbox" name="consent"></form>'), 'privacy');
  bad('handler without size limit', (c) => writeFileSync(join(c, 'functions/_lilac/contact-form.mjs'), 'export const x = 1;'), 'limit');
});

test('no network code in server sources: no node:net/http/https, no direct fetch call', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.name === 'test' ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const files = [...walk(SERVER), F].filter((f) => f.endsWith('.mjs'));
  assert.ok(files.length >= 6);
  for (const f of files) {
    const s = readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.ok(!/node:(net|http|https|http2|dgram|tls|dns)|from ['"](net|http|https)['"]/.test(s), f);
    assert.ok(!/(^|[^\w.])fetch\s*\(|globalThis\.fetch|XMLHttpRequest|WebSocket/.test(s), f + ' calls fetch directly');
    assert.ok(!/child_process/.test(s), f);
  }
});
