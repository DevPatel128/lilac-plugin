// auth: sign-in by emailed magic link. No passwords are stored. createAuth(options) -> async (Request) -> Response.
// Routes (matched by the end of the path): POST login {email} | POST verify {token} | GET session | POST refresh | POST logout | POST delete.
// The emailed link should open a page of YOUR site that POSTs the token to /verify (not a GET), so mail scanners that
// prefetch links cannot burn the single-use token. Passcode (6-digit code) sign-in is not included; the magic link covers it.
// Tokens: base64url(JSON{e,exp,n}) + "." + HMAC-SHA256 hex, signed with AUTH_SECRET; AUTH_SECRET_PREVIOUS (comma list) still verifies,
// so you can rotate. Single use is enforced with a used-nonce store. Sessions: random id stored as a hash, cookie HttpOnly; Secure;
// SameSite=Lax, rotated on login and on /refresh. State-changing routes need Origin = siteOrigin AND header x-csrf-token
// (= HMAC of the session id; read it from GET /session). Login answers are identical for every address (no account enumeration).
// options: secret (>=16 chars, required), previousSecrets, siteOrigin, mailer {send({to,subject,text})}, store, salt, now,
// tokenTtlSec=900, sessionTtlSec=604800, maxBytes=2048, ipRate={max:5,windowSec:600}, emailRate={max:3,windowSec:900}.
// shortcut: the single-use check is not atomic on KV/memory; use a D1/SQL unique insert for strict single use.
import { json, fail, readFields, rateHit, clientKey, hmacHex, safeEqual, b64u, unb64u, randomId, sha256Hex, originOk, EMAIL } from './shared.mjs';

const GENERIC_LOGIN = { ok: true, message: 'If that address can sign in, a link is on its way.' };

export function createAuth(o) {
  if (!o?.secret || o.secret.length < 16) throw new Error('AUTH_SECRET is missing or shorter than 16 characters');
  if (!o.siteOrigin || !o.mailer || !o.store) throw new Error('auth needs siteOrigin, mailer and store');
  const { secret, previousSecrets = [], siteOrigin, mailer, store, salt = '', now = Date.now, tokenTtlSec = 900, sessionTtlSec = 604800, maxBytes = 2048, ipRate = { max: 5, windowSec: 600 }, emailRate = { max: 3, windowSec: 900 } } = o;
  const cookieName = 'lilac_session';
  const secrets = [secret, ...previousSecrets];

  const sessionCookie = (sid, maxAge) => `${cookieName}=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
  const sidFrom = (request) => (request.headers.get('cookie') || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === cookieName)?.[1] || null;
  async function getSession(request) {
    const sid = sidFrom(request); if (!sid || !/^[0-9a-f]{48}$/.test(sid)) return null;
    const rec = await store.get('sess:' + await sha256Hex(sid)); if (!rec || rec.exp <= now()) return null;
    return { sid, ...rec };
  }
  async function startSession(email) {
    const sid = randomId(24), exp = now() + sessionTtlSec * 1000;
    await store.set('sess:' + await sha256Hex(sid), { email, exp }, sessionTtlSec);
    const user = (await store.get('user:' + email)) || { email, sids: [] };
    user.sids.push(await sha256Hex(sid)); await store.set('user:' + email, user);
    return sid;
  }
  async function dropSession(s) {
    const h = await sha256Hex(s.sid); await store.delete('sess:' + h);
    const u = await store.get('user:' + s.email); if (u) { u.sids = u.sids.filter((x) => x !== h); await store.set('user:' + s.email, u); }
  }
  const csrfFor = (sid) => hmacHex(secret, 'csrf|' + sid);
  async function csrfOk(request, s) { const h = request.headers.get('x-csrf-token'); return !!h && request.headers.get('origin') === siteOrigin && safeEqual(h, await csrfFor(s.sid)); }
  const bad = () => fail(401, 'invalid_link', 'That link is invalid or has expired. Request a new one.');

  async function verifyToken(token) {
    if (typeof token !== 'string') return null;
    const [p, sig] = token.split('.'); if (!p || !sig) return null;
    let ok = false; for (const s of secrets) if (safeEqual(await hmacHex(s, p), sig)) ok = true;
    if (!ok) return null;
    let d; try { d = JSON.parse(unb64u(p)); } catch { return null; }
    if (!d || !EMAIL.test(d.e || '') || typeof d.n !== 'string' || d.exp <= now()) return null;
    if (await store.get('used:' + d.n)) return null;
    await store.set('used:' + d.n, 1, tokenTtlSec + 60);
    return d;
  }

  return async function auth(request) {
    const path = new URL(request.url).pathname.replace(/\/+$/, ''); const route = path.split('/').pop();
    const known = ['login', 'verify', 'session', 'refresh', 'logout', 'delete'];
    if (!known.includes(route)) return fail(404, 'not_found', 'Not found.');
    if (route === 'session') {
      if (request.method !== 'GET') return fail(405, 'method_not_allowed', 'Use GET.', {}, { allow: 'GET' });
      const s = await getSession(request); if (!s) return fail(401, 'signed_out', 'Not signed in.');
      return json(200, { ok: true, email: s.email, csrf: await csrfFor(s.sid) });
    }
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', {}, { allow: 'POST' });
    // Auth routes always need a matching Origin (browser POST); curl without Origin is refused here.
    if (request.headers.get('origin') !== siteOrigin) return fail(403, 'origin_not_allowed', 'Request refused.');
    const body = await readFields(request, maxBytes);
    if (!body.ok) return fail(body.status, body.code, body.status === 413 ? 'Too large.' : body.status === 415 ? 'Send JSON.' : 'Could not read that.');
    const d = body.data;

    if (route === 'login') {
      const email = typeof d.email === 'string' ? d.email.trim().toLowerCase() : '';
      if (email.length > 254 || !EMAIL.test(email)) return fail(400, 'invalid', 'Enter a valid email address.');
      const ip = await rateHit(store, 'login-ip:' + await clientKey(request, salt), ipRate.max, ipRate.windowSec, now);
      if (ip.limited) return fail(429, 'rate_limited', 'Too many attempts. Please try again later.', {}, { 'retry-after': String(ip.retryAfter) });
      const em = await rateHit(store, 'login-email:' + (await sha256Hex(salt + email)).slice(0, 32), emailRate.max, emailRate.windowSec, now);
      if (!em.limited) {
        const payload = b64u(JSON.stringify({ e: email, exp: now() + tokenTtlSec * 1000, n: randomId(16) }));
        const token = `${payload}.${await hmacHex(secret, payload)}`;
        try { await mailer.send({ to: email, subject: 'Your sign-in link', text: `Open this link to sign in (valid ${Math.round(tokenTtlSec / 60)} minutes, one use):\n${siteOrigin}/auth/verify?token=${encodeURIComponent(token)}\n\nIf you did not ask for this, ignore this email.` }); } catch { /* same answer either way */ }
      }
      return json(202, GENERIC_LOGIN);
    }
    if (route === 'verify') {
      const t = await verifyToken(d.token); if (!t) return bad();
      const sid = await startSession(t.e);
      return json(200, { ok: true }, { 'set-cookie': sessionCookie(sid, sessionTtlSec) });
    }
    const s = await getSession(request);
    if (!s) return fail(401, 'signed_out', 'Not signed in.');
    if (!(await csrfOk(request, s))) return fail(403, 'csrf', 'Request refused.');
    if (route === 'logout') { await dropSession(s); return json(200, { ok: true }, { 'set-cookie': sessionCookie('', 0) }); }
    if (route === 'refresh') { await dropSession(s); const sid = await startSession(s.email); return json(200, { ok: true }, { 'set-cookie': sessionCookie(sid, sessionTtlSec) }); }
    // delete: remove the user record and every session of this user.
    const u = await store.get('user:' + s.email);
    for (const h of u?.sids || []) await store.delete('sess:' + h);
    await store.delete('user:' + s.email);
    return json(200, { ok: true }, { 'set-cookie': sessionCookie('', 0) });
  };
}
