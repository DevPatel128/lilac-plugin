// Service worker: offline shell with a versioned cache. A new version waits until the visitor presses
// "Reload to update" (message SKIP_WAITING), so the app never changes under their hands.
const VERSION = 'v2';
const CACHE = 'pocket-habits-' + VERSION;
const FILES = ['/', '/index.html', '/app.css', '/boot.js', '/app.js', '/ui.js', '/store.js', '/dates.js', '/stats.js', '/charts.js', '/io.js', '/content.js', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('pocket-habits-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  // Cache-poisoning guard: only same-origin GETs for files we precached are ever answered from or written to the cache.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!FILES.includes(path) && !FILES.includes(url.pathname)) return;
  // Cache first, no background rewrite: files only change when a new VERSION installs its own cache.
  e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(path)) || fetch(req).catch(() => c.match('/index.html'))));
});
