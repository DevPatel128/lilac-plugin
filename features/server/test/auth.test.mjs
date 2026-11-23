// Tests magic-link auth against a fake mailer and a fake clock: expiry, reuse, tampering, CSRF, rate limits, rotation, deletion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../auth.mjs';
import { memoryStore } from '../shared.mjs';

const ORIGIN = 'https://app.test';
function setup(over = {}) {
  const clock = { t: 1_800_000_000_000 }; const now = () => clock.t; const mail = [];
  const mk = (extra = {}) => createAuth({ secret: 'secret-one-0123456789', siteOrigin: ORIGIN, mailer: { send: async (m) => { mail.push(m); } }, store: memoryStore(now), salt: 's', now, ...over, ...extra });
  return { clock, mail, mk, auth: mk(), now };
}
const call = (auth, path, { method = 'POST', body, cookie, csrf, origin = ORIGIN, ip = '3.3.3.3' } = {}) => auth(new Request(ORIGIN + path, { method, headers: { 'content-type': 'application/json', origin, 'cf-connecting-ip': ip, ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-csrf-token': csrf } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) }));
const tokenFrom = (m) => new URL(m.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');
const cookieOf = (r) => r.headers.get('set-cookie').split(';')[0];
async function signIn(s, email = 'a@example.com') {
  await call(s.auth, '/auth/login', { body: { email } });
  const r = await call(s.auth, '/auth/verify', { body: { token: tokenFrom(s.mail.at(-1)) } });
  const cookie = cookieOf(r);
  const me = await (await call(s.auth, '/auth/session', { method: 'GET', cookie })).json();
  return { r, cookie, csrf: me.csrf, me };
}

test('login is generic: same answer for any address; mail carries a link', async () => {
  const s = setup();
  const a = await call(s.auth, '/auth/login', { body: { email: 'a@example.com' } });
  const b = await call(s.auth, '/auth/login', { body: { email: 'never-seen@example.com' } });
  assert.equal(a.status, 202); assert.equal(b.status, 202);
  assert.equal(await a.text(), await b.text());
  assert.equal(s.mail.length, 2); assert.ok(tokenFrom(s.mail[0]));
  assert.equal((await call(s.auth, '/auth/login', { body: { email: 'bad' } })).status, 400);
});
test('verify sets a safe session cookie; session endpoint works', async () => {
  const s = setup(); const { r, me } = await signIn(s);
  assert.equal(r.status, 200);
  const c = r.headers.get('set-cookie');
  for (const f of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(c.includes(f), f);
  assert.equal(me.email, 'a@example.com'); assert.ok(me.csrf);
});
test('token is single use, expires, and tampering fails; all answers generic', async () => {
  const s = setup(); await call(s.auth, '/auth/login', { body: { email: 'a@example.com' } });
  const tok = tokenFrom(s.mail[0]);
  assert.equal((await call(s.auth, '/auth/verify', { body: { token: tok } })).status, 200);
  const reuse = await call(s.auth, '/auth/verify', { body: { token: tok } });
  assert.equal(reuse.status, 401);
  await call(s.auth, '/auth/login', { body: { email: 'b@example.com' }, ip: '4.4.4.4' });
  const t2 = tokenFrom(s.mail[1]);
  const [p, sig] = t2.split('.');
  const evil = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), e: 'admin@example.com' })).toString('base64url');
  const badBodies = [`${evil}.${sig}`, `${p}.${sig.slice(0, -2)}AA`, 'garbage', ''];
  for (const t of badBodies) { const r = await call(s.auth, '/auth/verify', { body: { token: t } }); assert.equal(r.status, 401); assert.equal((await r.json()).error.code, 'invalid_link'); }
  s.clock.t += 16 * 60 * 1000;
  const exp = await call(s.auth, '/auth/verify', { body: { token: t2 } });
  assert.equal(exp.status, 401); assert.equal((await exp.json()).error.code, 'invalid_link');
});
test('secret rotation: previous secret still verifies; unknown secret does not', async () => {
  const s = setup(); await call(s.auth, '/auth/login', { body: { email: 'a@example.com' } });
  const tok = tokenFrom(s.mail[0]);
  const rotated = s.mk({ secret: 'secret-two-0123456789', previousSecrets: ['secret-one-0123456789'] });
  assert.equal((await call(rotated, '/auth/verify', { body: { token: tok } })).status, 200);
  const other = s.mk({ secret: 'secret-two-0123456789' });
  await call(s.auth, '/auth/login', { body: { email: 'c@example.com' }, ip: '5.5.5.5' });
  assert.equal((await call(other, '/auth/verify', { body: { token: tokenFrom(s.mail.at(-1)) } })).status, 401);
});
test('weak or missing secret is refused at setup', () => {
  assert.throws(() => createAuth({ secret: 'short', siteOrigin: ORIGIN, mailer: {}, store: memoryStore() }), /AUTH_SECRET/);
});
test('logout and refresh and delete need CSRF; rotation invalidates old cookie', async () => {
  const s = setup(); const { cookie, csrf } = await signIn(s);
  for (const p of ['/auth/logout', '/auth/refresh', '/auth/delete']) assert.equal((await call(s.auth, p, { cookie })).status, 403, p);
  assert.equal((await call(s.auth, '/auth/logout', { cookie, csrf: 'wrong' })).status, 403);
  const rot = await call(s.auth, '/auth/refresh', { cookie, csrf });
  assert.equal(rot.status, 200); const c2 = cookieOf(rot); assert.notEqual(c2, cookie);
  assert.equal((await call(s.auth, '/auth/session', { method: 'GET', cookie })).status, 401);
  const me2 = await (await call(s.auth, '/auth/session', { method: 'GET', cookie: c2 })).json();
  const out = await call(s.auth, '/auth/logout', { cookie: c2, csrf: me2.csrf });
  assert.equal(out.status, 200); assert.ok(/Max-Age=0/.test(out.headers.get('set-cookie')));
  assert.equal((await call(s.auth, '/auth/session', { method: 'GET', cookie: c2 })).status, 401);
});
test('csrf also needs the right origin', async () => {
  const s = setup(); const { cookie, csrf } = await signIn(s);
  assert.equal((await call(s.auth, '/auth/logout', { cookie, csrf, origin: 'https://evil.test' })).status, 403);
});
test('account deletion removes the user and every session', async () => {
  const s = setup(); const a = await signIn(s); const b = await signIn(s, 'a@example.com');
  assert.equal((await call(s.auth, '/auth/delete', { cookie: a.cookie })).status, 403);
  const d = await call(s.auth, '/auth/delete', { cookie: a.cookie, csrf: a.csrf }); assert.equal(d.status, 200);
  assert.equal((await call(s.auth, '/auth/session', { method: 'GET', cookie: b.cookie })).status, 401);
  assert.equal((await call(s.auth, '/auth/session', { method: 'GET', cookie: a.cookie })).status, 401);
});
test('session expires with the clock', async () => {
  const s = setup(); const { cookie } = await signIn(s);
  s.clock.t += 8 * 24 * 3600 * 1000;
  assert.equal((await call(s.auth, '/auth/session', { method: 'GET', cookie })).status, 401);
});
test('login rate limits: per IP returns 429; per address stays generic but stops mailing', async () => {
  const s = setup();
  for (let i = 0; i < 5; i++) assert.equal((await call(s.auth, '/auth/login', { body: { email: `u${i}@example.com` }, ip: '7.7.7.7' })).status, 202);
  assert.equal((await call(s.auth, '/auth/login', { body: { email: 'z@example.com' }, ip: '7.7.7.7' })).status, 429);
  const s2 = setup(); let n = 0;
  for (let i = 0; i < 6; i++) { const r = await call(s2.auth, '/auth/login', { body: { email: 'same@example.com' }, ip: `8.8.8.${i}` }); assert.equal(r.status, 202); n++; }
  assert.ok(s2.mail.length < n);
});
test('wrong origin, wrong method, wrong type, big body', async () => {
  const s = setup();
  assert.equal((await call(s.auth, '/auth/login', { body: { email: 'a@example.com' }, origin: 'https://evil.test' })).status, 403);
  assert.equal((await call(s.auth, '/auth/login', { method: 'GET' })).status, 405);
  assert.equal((await call(s.auth, '/auth/nope')).status, 404);
  const big = await s.auth(new Request(ORIGIN + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ email: 'a@example.com', pad: 'x'.repeat(10000) }) }));
  assert.equal(big.status, 413);
  const ct = await s.auth(new Request(ORIGIN + '/auth/login', { method: 'POST', headers: { 'content-type': 'text/plain', origin: ORIGIN }, body: 'x' }));
  assert.equal(ct.status, 415);
  assert.equal(s.mail.length, 0);
});
