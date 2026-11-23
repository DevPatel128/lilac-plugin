// Shared helpers for the Lilac server features. Web-standard APIs only (Request, Response, crypto.subtle, TextEncoder);
// runs unchanged on Cloudflare Workers/Pages Functions, Vercel/Node 24 and in tests. Zero dependencies, no network code.
//
// Store interface (used for rate limits, orders, event ids, sessions): async get(key) -> value|undefined,
// async set(key, value, ttlSeconds), async delete(key). memoryStore is for tests/dev; kvStore wraps a Cloudflare KV binding.
// D1/SQL: implement the same three methods over a table (key TEXT PRIMARY KEY, value TEXT, expires INTEGER).
// shortcut: KV and memory are not atomic, so two parallel requests can both pass a counter or a single-use check;
// upgrade to a D1/SQL store (unique-key insert) when abuse or money makes that matter.

const enc = new TextEncoder();

export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
}
export const fail = (status, code, message, extra = {}, headers = {}) => json(status, { ok: false, error: { code, message, ...extra } }, headers);

export const escapeHtml = (s) => String(s).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));

export function memoryStore(now = Date.now) {
  const m = new Map();
  return {
    async get(k) { const e = m.get(k); if (!e) return undefined; if (e.exp && e.exp <= now()) { m.delete(k); return undefined; } return e.v; },
    async set(k, v, ttl) { m.set(k, { v, exp: ttl ? now() + ttl * 1000 : 0 }); },
    async delete(k) { m.delete(k); },
  };
}
// Environment guard (security review M-9). Each isolate or serverless instance has its own memory, so a memory store loses paid
// orders and sessions and cannot hold a rate limit. It is allowed only when LILAC_ENV is `test` or `development`.
export const memoryOk = (env) => ['test', 'development'].includes(String(env?.LILAC_ENV ?? '').trim().toLowerCase());
// Orders, event ids and sessions: the KV binding, else memory in test/development, else null: the route must answer unavailable() (503).
export const durableStore = (kv, env, mem) => (kv ? kvStore(kv) : memoryOk(env) ? mem : null);
// Rate limits only: without a binding fall back to memory but say so in the log (weaker, per instance), unless test/development.
export function rateStore(kv, env, mem) {
  if (kv) return kvStore(kv);
  if (!memoryOk(env)) console.warn('lilac: RATE_KV is not bound, so rate limits are per instance and weak. Bind a KV namespace as RATE_KV, or set LILAC_ENV=development for local work.');
  return mem;
}
export const unavailable = (what) => fail(503, 'store_not_configured', `${what} is not available: no durable store is configured. Bind the KV namespace listed in .dev.vars.example, or set LILAC_ENV=development for local work only.`);

// KV expirationTtl must be at least 60 seconds (Cloudflare docs, UNVERIFIED today), so we clamp.
export function kvStore(kv) {
  return {
    async get(k) { const v = await kv.get(k); return v == null ? undefined : JSON.parse(v); },
    async set(k, v, ttl) { await kv.put(k, JSON.stringify(v), ttl ? { expirationTtl: Math.max(60, Math.ceil(ttl)) } : undefined); },
    async delete(k) { await kv.delete(k); },
  };
}

// Fixed-window counter. Returns { limited, retryAfter }.
export async function rateHit(store, key, max, windowSec, now = Date.now) {
  const t = now(); let r = await store.get(key);
  if (!r || r.resetAt <= t) r = { n: 0, resetAt: t + windowSec * 1000 };
  r.n += 1;
  await store.set(key, r, Math.ceil((r.resetAt - t) / 1000));
  return { limited: r.n > max, retryAfter: Math.max(1, Math.ceil((r.resetAt - t) / 1000)) };
}

export async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function hmacHex(secret, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Constant-time compare for equal-purpose strings; length difference is not secret here (both are fixed-length hex).
export function safeEqual(a, b) {
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}
export const b64u = (s) => btoa(String.fromCharCode(...enc.encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function unb64u(s) {
  const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
export const randomId = (bytes = 24) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

// Only a salted hash of the IP is ever stored or used as a key. With no salt a random per-instance one is used (never an
// empty salt: a bare IPv4 hash can be brute-forced). Set RATE_SALT so keys also agree across instances.
const INSTANCE_SALT = randomId(16);
// IP: cf-connecting-ip (set by Cloudflare), else the LAST x-forwarded-for entry (added by the nearest proxy; the first entries are
// whatever the client sent), else 'unknown'.
export async function clientKey(request, salt) {
  const xff = (request.headers.get('x-forwarded-for') || '').split(',').map((x) => x.trim()).filter(Boolean);
  const ip = request.headers.get('cf-connecting-ip') || xff[xff.length - 1] || 'unknown';
  return (await sha256Hex(`${salt || INSTANCE_SALT}|${ip}`)).slice(0, 32);
}

export function corsHeaders(allowedOrigin, extra = 'content-type') {
  return { 'access-control-allow-origin': allowedOrigin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': extra, vary: 'Origin' };
}
// Browsers always send Origin on cross-site POST; a present, different Origin is refused. Absent Origin (curl) is allowed
// because it carries no browser cookies; auth routes require it separately.
export const originOk = (request, allowed) => { const o = request.headers.get('origin'); return o == null || o === allowed; };

// Reads at most maxBytes. Checks the declared length first, then counts real bytes (the header can lie).
export async function readText(request, maxBytes) {
  const declared = Number(request.headers.get('content-length'));
  if (declared > maxBytes) return { ok: false, status: 413, code: 'too_large' };
  if (!request.body) return { ok: true, text: '' };
  const reader = request.body.getReader(); const chunks = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    n += value.byteLength;
    if (n > maxBytes) { await reader.cancel(); return { ok: false, status: 413, code: 'too_large' }; }
    chunks.push(value);
  }
  const all = new Uint8Array(n); let o = 0; for (const c of chunks) { all.set(c, o); o += c.byteLength; }
  return { ok: true, text: new TextDecoder().decode(all) };
}
// JSON or form-encoded body -> plain object of the sent fields.
export async function readFields(request, maxBytes) {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  const isJson = ct.startsWith('application/json'), isForm = ct.startsWith('application/x-www-form-urlencoded');
  if (!isJson && !isForm) return { ok: false, status: 415, code: 'unsupported_type' };
  const t = await readText(request, maxBytes); if (!t.ok) return t;
  try {
    const data = isJson ? JSON.parse(t.text || 'null') : Object.fromEntries(new URLSearchParams(t.text));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('shape');
    return { ok: true, data };
  } catch { return { ok: false, status: 400, code: 'bad_body' }; }
}
export const CTRL = /[\u0000-\u001f\u007f\u2028\u2029]/;
export const EMAIL = /^[^\s@,;<>"']{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
