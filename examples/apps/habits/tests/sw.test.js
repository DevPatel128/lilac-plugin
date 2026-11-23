import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

// Runs sw.js in a sandbox with a fake cache API. This checks the logic, not a real browser's service worker.
function boot() {
  const handlers = {}, stores = new Map(), fetched = [];
  const mkCache = (name) => { if (!stores.has(name)) stores.set(name, new Map()); const m = stores.get(name); return { addAll: async (reqs) => reqs.forEach((r) => m.set(new URL(r.url).pathname, 'body:' + new URL(r.url).pathname)), match: async (k) => m.get(k), put: async (k, v) => m.set(k, v) }; };
  stores.set('pocket-habits-v0', new Map());
  stores.set('other-app-cache', new Map());
  const self = { location: new URL('http://127.0.0.1:4180/sw.js'), addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting: () => { self.skipped = true; }, clients: { claim: async () => { self.claimed = true; } } };
  const ctx = { self, URL, Request: class { constructor(u) { this.url = new URL(u, 'http://127.0.0.1:4180').href; } }, fetch: async (r) => { fetched.push(r.url); throw new Error('offline'); },
    caches: { open: async (n) => mkCache(n), keys: async () => [...stores.keys()], delete: async (k) => stores.delete(k) } };
  vm.runInNewContext(readFileSync(new URL('../site/sw.js', import.meta.url), 'utf8'), ctx);
  const run = async (type, ev) => { let p; handlers[type]({ ...ev, waitUntil: (x) => { p = x; }, respondWith: (x) => { p = x; } }); return p; };
  return { self, stores, fetched, run, handlers };
}
const req = (u, method = 'GET') => ({ url: u, method });
const FILES = [...readFileSync(new URL('../site/sw.js', import.meta.url), 'utf8').match(/const FILES = \[(.*?)\];/s)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('every precached file exists in site/', () => {
  for (const f of FILES.filter((f) => f !== '/')) assert.ok(existsSync(new URL('../site' + f, import.meta.url)), f);
});
test('install precaches into a versioned cache; activate removes only old pocket-habits caches', async () => {
  const t = boot();
  await t.run('install', {});
  assert.ok(t.stores.has('pocket-habits-v2'));
  assert.ok(t.stores.get('pocket-habits-v2').has('/app.js'));
  await t.run('activate', {});
  assert.equal(t.stores.has('pocket-habits-v0'), false);
  assert.equal(t.stores.has('other-app-cache'), true, 'foreign caches untouched');
  assert.equal(t.self.claimed, true);
});
test('new version waits until the page asks (update prompt)', async () => {
  const t = boot();
  assert.equal(t.self.skipped, undefined, 'no automatic skipWaiting');
  await t.run('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(t.self.skipped, true);
});
test('fetch: offline hit from cache; cross-origin, POST and unknown paths are not intercepted', async () => {
  const t = boot();
  await t.run('install', {});
  assert.equal(await t.run('fetch', { request: req('http://127.0.0.1:4180/app.js') }), 'body:/app.js');
  assert.equal(await t.run('fetch', { request: req('http://127.0.0.1:4180/') }), 'body:/index.html', 'root served from the shell');
  let used = false;
  for (const r of [req('https://evil.example/app.js'), req('http://127.0.0.1:4180/app.js', 'POST'), req('http://127.0.0.1:4180/secret.json')]) {
    t.handlers.fetch({ request: r, respondWith: () => { used = true; } });
  }
  assert.equal(used, false);
  assert.equal(t.fetched.length, 0);
});
