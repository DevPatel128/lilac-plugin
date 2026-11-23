#!/usr/bin/env node
// qa-browser.mjs <projectDir> [--site dir] [--json] [--widths 360,768,1280]
// Real-browser QA pass over the built HTML of a site: starts its own temp static server on 127.0.0.1 (random port, no path escape),
// launches the system Chrome headless (sandbox on, fresh 0700 temp profile, DevTools over a pipe) and drives it over the DevTools protocol.
// Per page and width: horizontal overflow, console errors/warnings, failed requests, screenshot to <project>/.lilac/qa/<page>-<width>.png,
// tap targets (error <24 px, warn <44 px), overlapping text (warn). Per page: no-JavaScript render, keyboard walk-through (focus visible,
// traps, skip link, order, unreachable controls), reduced motion (running animations), dark scheme text contrast.
// No Chrome found: prints `qa-browser: SKIPPED(no browser)` and exits 0. Exit 1 only on errors, 2 on bad usage. No installs, no external network:
// every request of the page under test that is not http://127.0.0.1:<own port> (or data:/blob:) is blocked and listed as warning [external-request-blocked].
// Chrome runs WITH its sandbox; set LILAC_CHROME_NO_SANDBOX=1 only where it cannot start otherwise (containers running as root).
// Everything not measured is listed under UNVERIFIED. Chrome, server and temp dirs are cleaned on every exit path; hard 120 s cap per page.
// shortcut: Chrome is found like handoff.mjs does it (env CHROME, macOS, PATH, Windows); Firefox/Safari are never driven.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, mkdirSync, rmSync, realpathSync, chmodSync } from 'node:fs';
import { join, relative, resolve, extname, sep, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const json = args.includes('--json');
const siteArg = flag('--site');
const widths = (flag('--widths') ?? '360,768,1280').split(',').map(Number).filter((n) => n >= 200 && n <= 4000);
const skip = new Set([siteArg, flag('--widths')]);
const proj = args.find((a) => !a.startsWith('--') && !skip.has(a));
if (!proj || !existsSync(proj) || !statSync(proj).isDirectory() || !widths.length) { console.error('usage: qa-browser.mjs <projectDir> [--site dir] [--json] [--widths 360,768,1280]'); process.exit(2); }

const root = resolve(proj);
function walk(d, out = []) { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name === '.git' || e.name === '.lilac') continue; const p = join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; }
const hasHtml = (d) => existsSync(d) && statSync(d).isDirectory() && walk(d).some((f) => f.endsWith('.html'));
let site = siteArg ? resolve(root, siteArg) : ['site', 'public', 'dist', 'out', 'build'].map((n) => join(root, n)).find(hasHtml);
if (!site && existsSync(join(root, 'index.html'))) site = root;
if (!site || !existsSync(site)) { console.error('qa-browser: no site folder found. Use --site <dir>.'); process.exit(2); }

// Find Chrome like handoff.mjs: $CHROME (must exist), macOS app, PATH names, Windows Chrome/Edge.
const onPath = (n) => (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').map((d) => join(d, n)).find((c) => c && existsSync(c));
const win = ['ProgramFiles', 'ProgramFiles(x86)'].flatMap((v) => process.env[v] ? [join(process.env[v], 'Google/Chrome/Application/chrome.exe'), join(process.env[v], 'Microsoft/Edge/Application/msedge.exe')] : []);
const CHROME = process.env.CHROME ? (existsSync(process.env.CHROME) ? process.env.CHROME : null)
  : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(onPath), ...win].find((c) => c && existsSync(c));
if (!CHROME) { console.log('qa-browser: SKIPPED(no browser)'); process.exit(0); }

// ---- cleanup on every exit path ----
let chrome = null, server = null, tmp = null;
const cleanup = () => {
  try { server?.closeAllConnections?.(); server?.close(); } catch {}
  try { if (chrome?.pid) process.kill(process.platform === 'win32' ? chrome.pid : -chrome.pid, 'SIGKILL'); } catch {}
  try { if (tmp) rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
};
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));
process.on('uncaughtException', (e) => { console.error('qa-browser: internal error: ' + (e?.stack ?? e)); process.exit(2); });

// ---- static server (127.0.0.1, random port, refuses path escape) ----
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };
const siteReal = realpathSync(resolve(site));
server = createServer((req, res) => {
  const hp = server.address().port; if (req.headers.host !== `127.0.0.1:${hp}` && req.headers.host !== `localhost:${hp}`) { res.writeHead(403).end('forbidden host'); return; } // DNS rebinding
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  let f = normalize(join(siteReal, p));
  if (f !== siteReal && !f.startsWith(siteReal + sep)) { res.writeHead(403).end('forbidden'); return; }
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f) && !extname(f) && existsSync(f + '.html')) f += '.html';
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
  const real = realpathSync(f); if (!real.startsWith(siteReal + sep)) { res.writeHead(403).end('forbidden'); return; } // a symlink must not leave the site folder
  res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---- Chrome over CDP (pipe) ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Chrome flags (audit M-5, L-8): sandbox ON unless LILAC_CHROME_NO_SANDBOX=1 (containers running as root need it), DevTools over a pipe (no TCP port another local
// user could drive), profile in a fresh 0700 mkdtemp dir, no extensions/sync/default apps/background networking, and a dead proxy so nothing leaves loopback.
// shortcut: Windows pipe transport is UNVERIFIED (not run there); --remote-debugging-address is ignored with a pipe and kept as a belt-and-braces setting.
const chromeFlags = (udd) => ['--headless=new', '--disable-gpu', ...(process.env.LILAC_CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), '--hide-scrollbars', '--no-first-run', '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-default-apps', '--mute-audio', '--remote-debugging-pipe', '--remote-debugging-address=127.0.0.1', '--proxy-server=http://127.0.0.1:1', `--user-data-dir=${udd}`, 'about:blank'];
tmp = mkdtempSync(join(tmpdir(), 'lilac-qa-browser-')); chmodSync(tmp, 0o700);
const udd = join(tmp, 'profile'); mkdirSync(udd, { mode: 0o700 });
chrome = spawn(CHROME, chromeFlags(udd), { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
chrome.on('error', () => {});
const ws = { onmessage: null, send: (s) => { try { chrome.stdio[3].write(s + '\0'); } catch {} }, close: () => {} }; // same shape as a WebSocket, over Chrome's fd 3/4
{ let buf = ''; chrome.stdio[3].on('error', () => {}); chrome.stdio[4].setEncoding('utf8'); chrome.stdio[4].on('error', () => {}); chrome.stdio[4].on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\0')) >= 0) { const m = buf.slice(0, i); buf = buf.slice(i + 1); if (m) ws.onmessage?.({ data: m }); } }); }
let nid = 0; const pend = new Map(); const listeners = new Set();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id) { pend.get(m.id)?.(m); pend.delete(m.id); } else for (const l of listeners) l(m); };
const raw = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++nid; pend.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))); ws.send(JSON.stringify({ id, method, params, sessionId })); });
if (!(await Promise.race([raw('Browser.getVersion'), new Promise((r) => chrome.once('exit', () => r(null))), sleep(20000).then(() => null)]))) { console.error('qa-browser: Chrome did not start (running as root in a container? set LILAC_CHROME_NO_SANDBOX=1)'); process.exit(2); }

// ---- loopback-only guard (audit M-4): the page under test may reach only this tool's own server ----
// CDP Fetch.enable on every request of the page (and of its frames, workers and popups via auto-attach): only http://127.0.0.1:<own port>, data:, about: and
// blob: of that origin continue; everything else is failed (BlockedByClient) and recorded as 'external request blocked: <host>'. A navigation to another
// origin (Page.frameRequestedNavigation) stops loading and is recorded too. Chrome also gets a dead proxy, so no socket to a non-loopback address is opened.
const hostOf = (u) => { try { const x = new URL(u); return x.host || x.protocol; } catch { return String(u).slice(0, 40); } };
const allowedUrl = (u, own) => { try { const x = new URL(u); return /^(data|about):$/.test(x.protocol) || ((x.protocol === 'http:' || x.protocol === 'blob:') && x.origin === own); } catch { return false; } };
async function guard(raw, listeners, sessionId, own, sink) {
  const sessions = new Set([sessionId]);
  const rec = (u, nav) => { const host = hostOf(u); if (!sink.some((b) => b.host === host)) sink.push({ host, nav, msg: `external request blocked: ${host}${nav ? ' (navigation)' : ''}` }); };
  const arm = (sid) => raw('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, sid);
  const h = (m) => {
    if (!sessions.has(m.sessionId)) return; const p = m.params;
    if (m.method === 'Fetch.requestPaused') { const ok = allowedUrl(p.request.url, own); if (!ok) rec(p.request.url, p.resourceType === 'Document'); raw(ok ? 'Fetch.continueRequest' : 'Fetch.failRequest', ok ? { requestId: p.requestId } : { requestId: p.requestId, errorReason: 'BlockedByClient' }, m.sessionId).catch(() => {}); }
    else if (m.method === 'Page.frameRequestedNavigation' && !allowedUrl(p.url, own)) { rec(p.url, true); raw('Page.stopLoading', {}, m.sessionId).catch(() => {}); }
    else if (m.method === 'Target.attachedToTarget') { sessions.add(p.sessionId); arm(p.sessionId).catch(() => {}).finally(() => raw('Runtime.runIfWaitingForDebugger', {}, p.sessionId).catch(() => {})); }
  };
  listeners.add(h);
  await raw('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId).catch(() => {});
  await arm(sessionId);
  return () => listeners.delete(h);
}

// ---- findings ----
const pages = []; const unverified = []; const unv = (msg, reason) => { if (!unverified.some((u) => u.msg === msg)) unverified.push({ msg, reason }); };

// Page-side measurement helpers (run inside the page).
const MEASURE = `(() => {
  const vis = (el) => { const dt = el.closest('details:not([open])'); if (dt && !el.closest('summary')) return false; const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !(r.right <= 0 || r.left >= innerWidth) && !(r.width <= 1 && r.height <= 1); };
  const label = (el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' "' + (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 24) + '"');
  const small = [], tight = [];
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, summary, [role=button], textarea')) {
    if (!vis(el) || el.disabled) continue;
    const s = getComputedStyle(el);
    if (el.tagName === 'A' && s.display === 'inline' && (el.parentElement.innerText || '').trim().length > (el.innerText || '').trim().length + 3) continue;
    const r = el.getBoundingClientRect(), m = Math.min(r.width, r.height);
    if (m < 24) small.push(label(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); else if (m < 44) tight.push(label(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  const blocks = [...document.body.querySelectorAll('*')].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(el) && getComputedStyle(el).opacity !== '0' && !(getComputedStyle(el).display === 'inline' && el.getClientRects().length > 1)).slice(0, 300); // wrapped inline elements have one rect per line: skipped
  const overlaps = [];
  for (let i = 0; i < blocks.length && overlaps.length < 5; i++) for (let j = i + 1; j < blocks.length && overlaps.length < 5; j++) {
    const a = blocks[i], b = blocks[j]; if (a.contains(b) || b.contains(a)) continue;
    const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
    const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
    if (w > 2 && h > 2 && w * h > 0.25 * Math.min(p.width * p.height, q.width * q.height)) overlaps.push(label(a) + ' over ' + label(b));
  }
  return { overflow: document.documentElement.scrollWidth - innerWidth, small, tight, overlaps, textLen: (document.body.innerText || '').trim().length };
})()`;
const NOJS_HIDDEN = `(() => [...document.body.querySelectorAll('*')].filter((el) => { if (el.closest('noscript')) return false; const s = getComputedStyle(el), r = el.getBoundingClientRect(); return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && r.width > 0 && (s.opacity === '0' || s.visibility === 'hidden'); }).slice(0, 5).map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : '') + ' "' + el.textContent.trim().slice(0, 24) + '"'))()`;
const FOCUS = `(() => {
  const el = document.activeElement; if (!el || el === document.body || el === document.documentElement) return { body: true };
  window.__qa ??= { n: 0, seen: [] }; el.__qaId ??= ++window.__qa.n;
  const P = ['outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'borderTopWidth', 'textDecorationLine', 'transform'];
  const snap = () => { const s = getComputedStyle(el); return P.map((k) => s[k]).join('|'); };
  const multi = el.tagName === 'INPUT' && /^(date|time|datetime-local|month|week)$/.test(el.type); // several internal focus segments: no blur/refocus, which would reset the segment
  const on = snap(); let off = on; if (!multi) { el.blur(); off = snap(); el.focus({ preventScroll: true }); }
  const cs = getComputedStyle(el), ring = multi && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
  const r = el.getBoundingClientRect(), m = document.querySelector('main, [role=main]');
  return { id: el.__qaId, label: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' "' + (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 24) + '"', multi, visible: on !== off || ring, y: r.top + scrollY, skip: el.tagName === 'A' && (el.getAttribute('href') || '').startsWith('#'), inMain: !!(m && m.contains(el)) };
})()`;
const UNREACHED = `(() => [...document.querySelectorAll('a[href], button, input:not([type=hidden]):not([type=radio]), select, textarea, [tabindex="0"]')].filter((el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return !el.disabled && !el.closest('[inert]') && r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && el.tabIndex >= 0 && !el.__qaId; }).slice(0, 8).map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' "' + (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24) + '"'))()`;
const ANIMS = `(() => { const all = document.getAnimations(); const run = all.filter((a) => a.playState === 'running' || a.playState === 'pending').map((a) => { const t = a.effect?.getComputedTiming?.() ?? {}; return { kind: a.constructor.name, dur: t.duration, iter: t.iterations, name: a.animationName || a.transitionProperty || '' }; }).filter((a) => a.iter === Infinity || a.dur > 100 || typeof a.dur !== 'number'); return { total: all.length, bad: run }; })()`;
const SCHEME = `(() => { const c = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  let bg = null, bgImg = false; for (const el of [document.body, document.documentElement]) { const s = getComputedStyle(el); if (s.backgroundImage !== 'none') bgImg = true; const v = c(s.backgroundColor); if (v && v.a === 1) { bg = v; break; } else if (v && v.a > 0) return { unknown: 'background is semi-transparent' }; }
  const fg = c(getComputedStyle(document.body).color); if (!bg) return { unknown: 'no opaque background on body or html (canvas colour not measured)' }; if (bgImg) return { unknown: 'background is an image or gradient' }; return { fg: fg.rgb, bg: bg.rgb }; })()`;
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

async function checkPage(file) {
  const page = relative(site, file).split(sep).join('/');
  const F = []; const add = (sev, id, msg, fix) => { if (!F.some((f) => f.id === id && f.msg === msg)) F.push({ sev, id, msg, fix }); };
  const url = `${origin}/${page.split('/').map(encodeURIComponent).join('/')}`;
  const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => raw(m, p, sessionId);
  const ev = async (expression) => { const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page script failed: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)); return r.result.value; };
  let consoleMsgs = [], failed = [], reqs = new Map(), unguard = () => {};
  const onEvent = (m) => {
    if (m.sessionId !== sessionId) return; const p = m.params;
    if (m.method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'warning')) consoleMsgs.push({ sev: p.type === 'error' ? 'error' : 'warn', text: p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 120) });
    if (m.method === 'Runtime.exceptionThrown') consoleMsgs.push({ sev: 'error', text: (p.exceptionDetails.exception?.description ?? p.exceptionDetails.text).split('\n')[0].slice(0, 120) });
    if (m.method === 'Network.requestWillBeSent') reqs.set(p.requestId, p.request.url);
    if (m.method === 'Network.responseReceived' && p.response.status >= 400) failed.push({ url: p.response.url, why: p.response.status });
    if (m.method === 'Network.loadingFailed' && !p.canceled && p.errorText !== 'net::ERR_BLOCKED_BY_CLIENT') failed.push({ url: reqs.get(p.requestId) ?? '(unknown)', why: p.errorText });
  };
  listeners.add(onEvent);
  const ext = [];
  const loaded = () => new Promise((res) => { const t = setTimeout(done, 15000); function done() { clearTimeout(t); listeners.delete(h); res(); } const h = (m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') done(); }; listeners.add(h); });
  const go = async (settle = 400) => { const l = loaded(); await S('Page.navigate', { url }); await l; await sleep(settle); };
  const media = (motion = 'no-preference', scheme = 'light') => S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: motion }, { name: 'prefers-color-scheme', value: scheme }] });
  const key = (k, code, vk, text) => S('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk, text }).then(() => S('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }));
  const scrollAll = async () => { const h = await ev('document.documentElement.scrollHeight'); for (let y = 0; y < h; y += 500) { await ev(`scrollTo(0, ${y})`); await sleep(60); } await ev('scrollTo(0, 0)'); await sleep(150); };
  try {
    for (const m of ['Page.enable', 'Runtime.enable', 'Network.enable']) await S(m);
    unguard = await guard(raw, listeners, sessionId, origin, ext);
    await S('Emulation.setFocusEmulationEnabled', { enabled: true });
    await media();
    let jsLen = 0;
    for (const w of widths) {
      consoleMsgs = []; failed = []; reqs = new Map();
      await S('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 1, mobile: false });
      await go(); await scrollAll();
      const m = await ev(MEASURE); jsLen = Math.max(jsLen, m.textLen);
      const at = `@${w}px`;
      if (m.overflow > 1) add('error', 'overflow', `${at} horizontal overflow of ${m.overflow}px`, 'Find the element wider than the viewport (images, fixed widths, long words) and make it fluid (max-width:100%, overflow-wrap).');
      if (m.small.length) add('error', 'tap-target', `${at} ${m.small.length} tap target(s) under 24px: ${m.small.slice(0, 4).join('; ')}`, 'Give links and buttons at least 24x24px (aim for 44x44px) with padding or min-height.');
      if (m.tight.length) add('warn', 'tap-target-small', `${at} ${m.tight.length} tap target(s) under 44px: ${m.tight.slice(0, 4).join('; ')}`, 'Aim for 44x44px on touch screens.');
      if (m.overlaps.length) add('warn', 'text-overlap', `${at} overlapping text: ${m.overlaps.slice(0, 3).join('; ')}`, 'Check the layout: text blocks should not sit on top of each other.');
      for (const c of consoleMsgs) add(c.sev, c.sev === 'error' ? 'console-error' : 'console-warning', `${at} console ${c.sev === 'error' ? 'error' : 'warning'}: ${c.text}`, 'Open the page, read the message in the console and fix its cause.');
      for (const f of failed) { const local = f.url.startsWith(origin) && !/\/favicon\.ico$/.test(f.url); add(local ? 'error' : 'warn', 'request-failed', `${at} request failed (${f.why}): ${f.url.replace(origin, '')}`, local ? 'Fix the path or add the missing file.' : 'Favicon or external request failed; add the favicon, self-host the file, or confirm it is needed.'); }
      const dir = join(root, '.lilac', 'qa'); mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${page.replace(/\.html$/i, '').replace(/[\\/]/g, '_')}-${w}.png`), Buffer.from((await S('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    }
    const wide = widths.includes(1280) ? 1280 : Math.max(...widths);
    await S('Emulation.setDeviceMetricsOverride', { width: wide, height: 800, deviceScaleFactor: 1, mobile: false });

    // No JavaScript
    await S('Emulation.setScriptExecutionDisabled', { value: true });
    await go(200);
    const plain = await ev(MEASURE); const hid = await ev(NOJS_HIDDEN);
    if (jsLen > 0 && (jsLen - plain.textLen) / jsLen > 0.3) add('error', 'nojs-missing', `without JavaScript ${plain.textLen} of ${jsLen} characters of visible text remain (${Math.round(100 * (jsLen - plain.textLen) / jsLen)}% missing)`, 'Render the content in the HTML at build time instead of with JavaScript.');
    if (hid.length) add('error', 'nojs-invisible', `without JavaScript these elements are invisible (opacity 0 or visibility hidden): ${hid.join('; ')}`, 'Start reveal/animation states only after JavaScript runs (scope under .js or @media (scripting: enabled)).');
    await S('Emulation.setScriptExecutionDisabled', { value: false });

    // Keyboard walk-through
    await go(300);
    await ev(`(() => { const s = document.createElement('style'); s.textContent = '*{transition:none!important;animation:none!important}'; document.head.append(s); })()`);
    await key('Tab', 'Tab', 9);
    const first = await ev(FOCUS);
    if (first.body || !first.skip) add('error', 'skip-link', 'the first Tab stop is not a skip link (a[href="#..."])', 'Add <a href="#main">Skip to content</a> as the first element in <body>.');
    else {
      await key('Enter', 'Enter', 13, '\r'); await sleep(100);
      const after = await ev(`(() => { const m = document.querySelector('main, [role=main]'); const a = document.activeElement; return !!(m && a && (a === m || m.contains(a))); })()`);
      if (!after) add('error', 'skip-link', 'activating the skip link does not move focus into <main>', 'Give <main> tabindex="-1" so the skip link can move focus to it.');
    }
    await go(300);
    await ev(`(() => { const s = document.createElement('style'); s.textContent = '*{transition:none!important;animation:none!important}'; document.head.append(s); })()`);
    const seen = new Set(); const hidden = []; let prev = null, run = 0, prevY = null, cycled = false, capped = true, trap = null;
    for (let i = 0; i < 60; i++) {
      await key('Tab', 'Tab', 9); const f = await ev(FOCUS);
      if (f.body) { if (i > 0 && seen.size) { capped = false; break; } continue; }
      run = f.id === prev ? run + 1 : 1; prev = f.id;
      if (run >= (f.multi ? 9 : 5)) { trap = f.label; capped = false; break; }
      if (seen.has(f.id) && run === 1) { cycled = true; capped = false; break; }
      if (!seen.has(f.id)) { seen.add(f.id); if (!f.visible) hidden.push(f.label); if (prevY !== null && f.y < prevY - 400) add('warn', 'focus-order', `focus jumps backwards on the page to ${f.label}`, 'Keep DOM order matching visual order; avoid positive tabindex.'); prevY = f.y; }
    }
    if (trap) add('error', 'focus-trap', `keyboard focus is trapped on ${trap} (same element 5 times in a row)`, 'Make sure Tab moves on; do not cancel Tab or refocus the same element.');
    if (hidden.length) add('error', 'focus-invisible', `no visible focus style on: ${hidden.slice(0, 5).join('; ')}`, 'Add a :focus-visible style (outline or box-shadow); never outline:none without a replacement.');
    if (!trap) {
      const miss = await ev(UNREACHED);
      if (miss.length && (cycled || !capped)) add('error', 'focus-unreachable', `interactive elements never reached by Tab: ${miss.join('; ')}`, 'Make sure they are real links/buttons, not hidden or tabindex=-1.');
      else if (miss.length) unv('keyboard reachability', 'the 60 Tab press limit was reached before the focus order cycled');
    } else unv('keyboard reachability', 'a focus trap stopped the walk');

    // Reduced motion
    await media('reduce'); await go(300); await scrollAll(); await sleep(300);
    const red = await ev(ANIMS);
    for (const a of red.bad) add('error', 'reduced-motion', `with prefers-reduced-motion: reduce a ${a.kind} still runs (${a.name || 'unnamed'}, ${a.iter === Infinity ? 'infinite' : Math.round(a.dur) + ' ms'})`, 'Add @media (prefers-reduced-motion: reduce) { ... } that switches the animation off or shortens it under 100 ms.');
    await media('no-preference'); await go(300); await scrollAll();
    const mot = await ev('document.getAnimations().length');
    F.motionCount = mot;

    // Dark scheme
    await media('no-preference', 'dark'); await go(300);
    const dk = await ev(SCHEME);
    if (dk.unknown) unv(`${page}: dark scheme contrast`, dk.unknown);
    else { const r = ratio(dk.fg, dk.bg); if (r < 4.5) add('error', 'dark-contrast', `dark scheme: body text contrast ${r.toFixed(2)}:1 (needs 4.5:1)`, 'Fix the colours under @media (prefers-color-scheme: dark), or set a dark background with light text.'); }
  } catch (e) {
    add('error', 'qa-failed', `page check aborted: ${String(e.message ?? e).slice(0, 160)}`, 'Open the page in a browser and fix what breaks it.');
  } finally {
    unguard();
    for (const b of ext) add('warn', 'external-request-blocked', b.msg, 'The page tried to load this from outside the machine; the tool blocked it. Self-host the file or confirm it is needed (and check it for privacy).');
    listeners.delete(onEvent);
    await raw('Target.closeTarget', { targetId }).catch(() => {});
  }
  return { page, findings: F, motion: F.motionCount };
}

// ---- run ----
const files = walk(site).filter((f) => f.endsWith('.html')).sort();
try {
  for (const f of files) {
    let t; const cap = new Promise((_, j) => { t = setTimeout(() => j(new Error('timeout: page took more than 120 s')), 120000); });
    try { pages.push(await Promise.race([checkPage(f), cap])); }
    catch (e) { pages.push({ page: relative(site, f).split(sep).join('/'), findings: [{ sev: 'error', id: 'qa-failed', msg: String(e.message ?? e), fix: 'Open the page in a browser and fix what hangs.' }] }); }
    finally { clearTimeout(t); }
  }
} finally { ws.close(); }
if (!files.length) unverified.push({ msg: 'no .html files found', reason: 'nothing to check' });
unv('transitions and hover/focus animations', 'only animations running on load or scroll are visible to getAnimations(); effects that need a hover or click are not triggered');
unv('screen reader output, real touch, slow networks, other browsers', 'only headless Chrome on a local server was driven');
unv('visual quality, text overlap beyond bounding boxes, images and gradients', 'read the saved screenshots in .lilac/qa/ to judge these');

const count = (fs, s) => fs.filter((f) => f.sev === s).length;
const out = pages.map((p) => ({ page: p.page, errors: count(p.findings, 'error'), warnings: count(p.findings, 'warn'), animations: p.motion ?? null, findings: p.findings }));
const E = out.reduce((n, p) => n + p.errors, 0), W = out.reduce((n, p) => n + p.warnings, 0), U = unverified.length;
const summary = `qa-browser: ${E} error(s), ${W} warning(s), ${U} unverified`;
if (json) console.log(JSON.stringify({ site: relative(root, site) || '.', widths, pages: out, unverified, summary: { errors: E, warnings: W, unverified: U } }, null, 2));
else {
  console.log(`Browser QA report for ${site} (widths ${widths.join(', ')}; screenshots in ${join(root, '.lilac', 'qa')})\n`);
  for (const p of out) {
    console.log(`${p.page}: ${p.errors} error(s), ${p.warnings} warning(s)${p.animations === null ? '' : `; ${p.animations} animation(s) present with motion enabled`}`);
    for (const f of [...p.findings].sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'error' ? -1 : 1))) console.log(`  ${f.sev === 'error' ? 'ERROR' : 'warn '} [${f.id}] ${f.msg}\n        fix: ${f.fix}`);
    if (!p.findings.length) console.log('  no findings');
  }
  console.log('\nUNVERIFIED (not measured by this tool)'); for (const u of unverified) console.log(`  ${u.msg}: ${u.reason}`);
  console.log(`\n${summary}`);
}
process.exit(E > 0 ? 1 : 0);
