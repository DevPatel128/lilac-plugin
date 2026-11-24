#!/usr/bin/env node
// controls-test.mjs <projectDir> [--site dir] [--json] [--credentials file]
// Exercises EVERY interactive control of a site or app in real Chrome (system Chrome, headless, sandbox on, fresh 0700 temp profile, DevTools over a pipe) so no stale or
// inoperable button, link, menu item or setting ships. Starts its own temp static server on 127.0.0.1 (random port); nothing leaves the machine: every request of the page that is not
// http://127.0.0.1:<own port> (or data:/blob:) is blocked via CDP Fetch, a form action or link to another origin is never followed, and each blocked host is listed
// under 'External requests blocked' (JSON: blocked). Chrome keeps its sandbox; LILAC_CHROME_NO_SANDBOX=1 only where it cannot start otherwise (root containers).
// For every .html page, and every in-app screen reachable by clicking (tabs, accordions, dialogs, menus; depth 2), it lists a[href], button, input,
// select, textarea, summary, [role=button|tab|menuitem|switch|checkbox|link] and [tabindex=0]/[onclick] elements that have a click listener,
// records visibility and size, performs the natural action (click, toggle, open, fill valid sample values then submit, choose each select option)
// and demands an OBSERVABLE EFFECT within 1.5 s: URL/hash change, DOM mutation, focus moved, dialog/popover/aria-expanded/[open] change, storage or
// cookie change, download, copied text (clipboard is stubbed and recorded), mailto:/tel: intercepted and validated, window.open or target=_blank
// intercepted and validated (https only, noopener). The page is reloaded between actions so a destructive control cannot hide later ones; native
// confirm() is cancelled first (dialog must appear), then confirmed once on a throwaway reload. Keyboard shortcuts named in the page text ("press n") are pressed.
// Single-document apps: links to hash routes (#/help, #!x) are visited as screens; only controls VISIBLE on a screen are exercised, labelled 'route: control'.
// Dialogs opened by a control are enumerated while open, then must close with Escape or their own close control. Page storage of the test origin is cleared before every
// reload and button clicks do not pre-fill unrelated fields, so one control's typed text or saved state cannot hide another.
// Two sweeps per page: 1280x800 desktop, then 390x844 mobile (touch emulation). Controls already exercised on desktop are only reach-tested on mobile; controls that exist
// only on mobile (a Menu button hidden above 700 px) are exercised there and labelled '@390'. UNREACHABLE means invisible at EVERY viewport. A control with aria-expanded and
// 'menu'/'nav' in its name, or aria-controls, must open (aria-expanded true, more links visible) and close again (Escape or the button).
// Verdicts: OK, DEAD, DISABLED-FOREVER, BROKEN-LINK, PLACEHOLDER, UNREACHABLE (covered, off-screen, never visible), TOO-SMALL (works, under 24 px).
// --credentials <file>: {"loginPath":"/login.html","fields":{...},"submit":"button[type=submit]"}: test values only, used ONLY against the local
// server before the sweep, redacted from every output, refused when the file names any host other than 127.0.0.1/localhost.
// No Chrome: prints `controls-test: SKIPPED(no browser)` and exits 0. Exit 1 on DEAD, BROKEN-LINK, DISABLED-FOREVER, PLACEHOLDER or UNREACHABLE; 2 on bad usage.
// Anything not exercised (file inputs, canvas, external destinations, hover-only menus) is listed under UNVERIFIED. Cleans Chrome, server, temp dir on every exit path.
// shortcut: Chrome is found like qa-browser.mjs does it; Firefox/Safari are never driven. Controls are swept at 1280 px only; widen when mobile menus matter.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, mkdirSync, rmSync, realpathSync, chmodSync } from 'node:fs';
import { join, relative, resolve, extname, sep, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const json = args.includes('--json');
const siteArg = flag('--site'), credArg = flag('--credentials'), knownArg = flag('--known');
const skipArgs = new Set([siteArg, credArg, knownArg]);
const proj = args.find((a) => !a.startsWith('--') && !skipArgs.has(a));
if (!proj || !existsSync(proj) || !statSync(proj).isDirectory()) { console.error('usage: controls-test.mjs <projectDir> [--site dir] [--json] [--credentials file] [--known file]'); process.exit(2); }
const root = resolve(proj);

// ---- credentials: validated before anything starts; values are secrets (never printed) ----
const secrets = []; let cred = null;
const redact = (s) => secrets.reduce((a, v) => a.split(v).join('[redacted]'), String(s));
if (credArg) {
  const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\]|::1)$/i;
  const refuse = (why) => { console.error(`controls-test: refused credentials file: ${why}`); process.exit(2); };
  let j; try { j = JSON.parse(readFileSync(credArg, 'utf8')); } catch { refuse('unreadable or not valid JSON'); }
  const hostOf = (v) => { try { return new URL(/^([a-z][a-z0-9+.-]*:)?\/\//i.test(v) ? (v.startsWith('//') ? 'http:' + v : v) : 'http://' + v).hostname; } catch { return String(v); } };
  for (const k of ['host', 'hostname', 'origin', 'url', 'baseUrl', 'loginUrl']) if (j?.[k] && !LOCAL.test(hostOf(String(j[k])))) refuse(`host "${hostOf(String(j[k]))}" is not 127.0.0.1 or localhost`);
  const lp = String(j?.loginPath ?? '');
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(lp) && !LOCAL.test(hostOf(lp))) refuse(`host "${hostOf(lp)}" is not 127.0.0.1 or localhost`);
  if (!lp.startsWith('/') || lp.startsWith('//') || !j.fields || typeof j.fields !== 'object' || !j.submit) refuse('needs loginPath (starting with /), fields and submit');
  cred = { loginPath: lp, fields: j.fields, submit: String(j.submit) };
  for (const v of Object.values(j.fields)) if (String(v).length >= 3) secrets.push(String(v));
}

function walk(d, out = []) { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name === '.git' || e.name === '.lilac') continue; const p = join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; }
const hasHtml = (d) => existsSync(d) && statSync(d).isDirectory() && walk(d).some((f) => f.endsWith('.html'));
let site = siteArg ? resolve(root, siteArg) : ['site', 'public', 'dist', 'out', 'build'].map((n) => join(root, n)).find(hasHtml);
if (!site && existsSync(join(root, 'index.html'))) site = root;
if (!site || !existsSync(site)) { console.error('controls-test: no site folder found. Use --site <dir>.'); process.exit(2); }

const onPath = (n) => (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').map((d) => join(d, n)).find((c) => c && existsSync(c));
const win = ['ProgramFiles', 'ProgramFiles(x86)'].flatMap((v) => process.env[v] ? [join(process.env[v], 'Google/Chrome/Application/chrome.exe'), join(process.env[v], 'Microsoft/Edge/Application/msedge.exe')] : []);
const CHROME = process.env.CHROME ? (existsSync(process.env.CHROME) ? process.env.CHROME : null)
  : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(onPath), ...win].find((c) => c && existsSync(c));
if (!CHROME) { console.log('controls-test: SKIPPED(no browser)'); process.exit(0); }

let chrome = null, server = null, tmp = null;
const cleanup = () => {
  try { server?.closeAllConnections?.(); server?.close(); } catch {}
  try { if (chrome?.pid) process.kill(process.platform === 'win32' ? chrome.pid : -chrome.pid, 'SIGKILL'); } catch {}
  try { if (tmp) rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
};
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));
process.on('uncaughtException', (e) => { console.error('controls-test: internal error: ' + redact(e?.stack ?? e)); process.exit(2); });

// ---- static server (127.0.0.1, random port, refuses path escape) ----
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };
const siteReal = realpathSync(resolve(site));
const fileFor = (p) => {
  let f = normalize(join(siteReal, p));
  if (f !== siteReal && !f.startsWith(siteReal + sep)) return null;
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f) && !extname(f) && existsSync(f + '.html')) f += '.html';
  return existsSync(f) && statSync(f).isFile() && realpathSync(f).startsWith(siteReal + sep) ? f : null; // a symlink must not leave the site folder
};
server = createServer((req, res) => {
  const hp = server.address().port; if (req.headers.host !== `127.0.0.1:${hp}` && req.headers.host !== `localhost:${hp}`) { res.writeHead(403).end('forbidden host'); return; } // DNS rebinding
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  const f = fileFor(p);
  if (!f) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---- Chrome over CDP (pipe) (shortcut: duplicated CDP client, copied from qa-browser.mjs; merge into one module when a third script needs it) ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Chrome flags (audit M-5, L-8): sandbox ON unless LILAC_CHROME_NO_SANDBOX=1 (containers running as root need it), DevTools over a pipe (no TCP port another local
// user could drive), profile in a fresh 0700 mkdtemp dir, no extensions/sync/default apps/background networking, and a dead proxy so nothing leaves loopback.
// shortcut: Windows pipe transport is UNVERIFIED (not run there); --remote-debugging-address is ignored with a pipe and kept as a belt-and-braces setting.
const chromeFlags = (udd) => ['--headless=new', '--disable-gpu', ...(process.env.LILAC_CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), '--hide-scrollbars', '--no-first-run', '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-default-apps', '--mute-audio', '--remote-debugging-pipe', '--remote-debugging-address=127.0.0.1', '--proxy-server=http://127.0.0.1:1', `--user-data-dir=${udd}`, 'about:blank'];
tmp = mkdtempSync(join(tmpdir(), 'lilac-controls-test-')); chmodSync(tmp, 0o700);
const udd = join(tmp, 'profile'); mkdirSync(udd, { mode: 0o700 });
const ctmp = join(tmp, 'chrome-tmp'); mkdirSync(ctmp, { mode: 0o700 }); // Chrome's own scratch (com.google.Chrome.*) lands inside tmp, so a SIGKILL'd Chrome leaves nothing in the user's TMPDIR
chrome = spawn(CHROME, chromeFlags(udd), { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32', env: { ...process.env, TMPDIR: ctmp, TMP: ctmp, TEMP: ctmp } });
chrome.on('error', () => {});
const ws = { onmessage: null, send: (s) => { try { chrome.stdio[3].write(s + '\0'); } catch {} }, close: () => {} }; // same shape as a WebSocket, over Chrome's fd 3/4
{ let buf = ''; chrome.stdio[3].on('error', () => {}); chrome.stdio[4].setEncoding('utf8'); chrome.stdio[4].on('error', () => {}); chrome.stdio[4].on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\0')) >= 0) { const m = buf.slice(0, i); buf = buf.slice(i + 1); if (m) ws.onmessage?.({ data: m }); } }); }
let nid = 0; const pend = new Map(); const listeners = new Set();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id) { pend.get(m.id)?.(m); pend.delete(m.id); } else for (const l of listeners) l(m); };
const raw = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++nid; pend.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))); ws.send(JSON.stringify({ id, method, params, sessionId })); });
if (!(await Promise.race([raw('Browser.getVersion'), new Promise((r) => chrome.once('exit', () => r(null))), sleep(20000).then(() => null)]))) { console.error('controls-test: Chrome did not start (running as root in a container? set LILAC_CHROME_NO_SANDBOX=1)'); process.exit(2); }

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

// ---- page-side helper, injected before every document ----
const INIT = `(() => {
  if (window.__ct) return;
  const C = window.__ct = { open: [], clip: [], ext: [], confirms: [], alerts: [], answer: false, picks: [], mut: 0, armed: false, target: null, before: null, els: [] };
  try { window.open = (u, t, f) => { C.open.push({ u: String(u), f: String(f || '') }); return null; }; } catch {}
  try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { C.clip.push(String(t)); return Promise.resolve(); }, write: () => { C.clip.push('(clipboard.write)'); return Promise.resolve(); }, readText: () => Promise.resolve('') } }); } catch {}
  const ec = document.execCommand && document.execCommand.bind(document);
  document.execCommand = (c, ...r) => { if (String(c).toLowerCase() === 'copy') { C.clip.push('(execCommand copy) ' + String(getSelection()).slice(0, 40)); return true; } return ec ? ec(c, ...r) : false; };
  try { const oc = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { C.picks.push(this.id || 'file'); return; } return oc.call(this); }; } catch {}
  window.confirm = (m) => { C.confirms.push(String(m)); return C.answer; };
  window.alert = (m) => { C.alerts.push(String(m)); };
  window.prompt = (m) => { C.alerts.push(String(m)); return 'Sample text'; };
  addEventListener('click', (e) => { const lb = e.target.closest && e.target.closest('label'); if (lb && lb.control && lb.control.type === 'file') { C.picks.push('label'); e.preventDefault(); } const a = e.target.closest && e.target.closest('a[href]'); if (!a) return; let u; try { u = new URL(a.href); } catch { return; }
    if (/^(mailto|tel|sms):$/.test(u.protocol) || a.target === '_blank' || (u.origin !== location.origin && /^https?:$/.test(u.protocol))) { C.ext.push({ href: a.href, target: a.target, rel: a.rel }); e.preventDefault(); } }, true);
  const seen = (r) => { if (!C.armed) return; if (r.type === 'attributes' && r.target === C.target && /^(style|class)$/.test(r.attributeName)) return; C.mut++; };
  C.last = performance.now();
  const obs = new MutationObserver((rs) => { C.last = performance.now(); rs.forEach(seen); }); obs.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  // Instant scrolling for the whole test: smooth scroll would still be moving when we hit-test.
  const noSmooth = () => { try { const st = document.createElement('style'); st.textContent = 'html,body,*{scroll-behavior:auto !important}'; (document.head || document.documentElement).append(st); } catch {} };
  document.documentElement ? noSmooth() : addEventListener('DOMContentLoaded', noSmooth);
  C.settle = () => new Promise((res) => { const t0 = performance.now(); const tick = () => { const n = performance.now(); if (n - C.last >= 300 || n - t0 >= 3000) res(); else setTimeout(tick, 50); }; tick(); });
  const frame = () => new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 250); });
  const desc = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '');
  const store = () => { try { return JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]); } catch { return ''; } };
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const dlg = () => [...document.querySelectorAll('dialog[open],[role=dialog],[role=alertdialog],[aria-modal=true]')].filter(vis).length + document.querySelectorAll('[aria-expanded="true"]').length + document.querySelectorAll('details[open]').length + [...document.querySelectorAll('[popover]')].filter((e) => { try { return e.matches(':popover-open'); } catch { return false; } }).length;
  C.dialogs = () => [...document.querySelectorAll('dialog[open],[role=dialog],[role=alertdialog],[aria-modal=true]')].filter(vis).length;
  C.snap = () => ({ href: location.href, active: document.activeElement, dlg: dlg(), store: store(), mut: C.mut, clip: C.clip.length, open: C.open.length, ext: C.ext.length, confirms: C.confirms.length, alerts: C.alerts.length, picks: C.picks.length });
  C.arm = (i) => { obs.takeRecords(); C.target = i == null ? null : C.els[i]; C.armed = true; C.mut = 0; C.before = C.snap(); };
  C.diff = () => { obs.takeRecords().forEach(seen); const b = C.before, n = C.snap(), o = [];
    if (n.href !== b.href) o.push(['url', n.href]);
    if (n.mut > 0) o.push(['dom', 'DOM changed']);
    if (n.active && n.active !== b.active && n.active !== C.target && n.active !== document.body) o.push(['focus', 'focus moved to ' + desc(n.active)]);
    if (n.dlg !== b.dlg) o.push(['dialog', 'dialog, popover or expanded state changed']);
    if (n.store !== b.store) o.push(['storage', 'storage or cookie changed']);
    if (n.clip > b.clip) o.push(['clip', C.clip[C.clip.length - 1]]);
    if (n.open > b.open) o.push(['open', C.open[C.open.length - 1]]);
    if (n.ext > b.ext) o.push(['ext', C.ext[C.ext.length - 1]]);
    if (n.confirms > b.confirms) o.push(['confirm', C.confirms[C.confirms.length - 1]]);
    if (n.picks > b.picks) o.push(['picker', 'opens a file picker (intercepted, not driven)']);
    if (n.alerts > b.alerts) o.push(['alert', C.alerts[C.alerts.length - 1]]);
    return o; };
  C.noise = () => { obs.takeRecords(); C.target = null; C.armed = true; C.mut = 0; return new Promise((r) => setTimeout(() => { obs.takeRecords().forEach(seen); C.armed = false; r(C.mut); }, 400)); };
  C.answerWith = (v) => { C.answer = v; };
  const set = (e, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value'); d && d.set ? d.set.call(e, v) : (e.value = v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
  const sample = (e) => { const t = (e.type || 'text').toLowerCase(); const n = (e.name || e.id || '').toLowerCase();
    if (t === 'email' || /e-?mail/.test(n)) return 'sample@example.com'; if (t === 'tel') return '+15555550123'; if (t === 'url') return 'https://example.com/sample';
    if (t === 'number' || t === 'range') return String(e.min !== '' && e.min != null ? e.min : 1); if (t === 'date') return '2030-01-15'; if (t === 'time') return '10:30'; if (t === 'datetime-local') return '2030-01-15T10:30';
    if (t === 'month') return '2030-01'; if (t === 'week') return '2030-W03'; if (t === 'color') return '#336699'; if (t === 'password') return 'Sample-pass-123'; return 'Sample text'; };
  C.fillOne = (e) => { if (e.disabled || e.readOnly) return false;
    if (e.tagName === 'SELECT') { const o = [...e.options].find((x) => x.value !== '' && !x.disabled); if (o) { e.value = o.value; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } return true; }
    const t = (e.type || '').toLowerCase();
    if (t === 'checkbox') { if (!e.checked) e.click(); return true; }
    if (t === 'radio') { if (![...document.getElementsByName(e.name)].some((x) => x.checked)) e.click(); return true; }
    if (/^(hidden|file|submit|button|reset|image)$/.test(t)) return false;
    set(e, sample(e)); return true; };
  C.fill = (scope) => { (scope || document).querySelectorAll('input, select, textarea').forEach((e) => C.fillOne(e)); };
  C.reach = async (i) => { const e = C.els[i]; e.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    for (let k = 0, y = '', n = 0; k < 20; k++) { await frame(); await frame(); const b = e.getBoundingClientRect(), now = scrollY + '|' + Math.round(b.left) + '|' + Math.round(b.top); if (now === y && ++n >= 2) break; if (now !== y) n = 0; y = now; } const hit = (t) => !!t && (t === e || e.contains(t) || (t.closest('label') && e.labels && [...e.labels].includes(t.closest('label'))) || (t.tagName === 'LABEL' && t.contains(e)));
    let first = null; // an inline link that wraps has one rect per line: any rect that hits the link is enough
    for (const r of [...e.getClientRects(), e.getBoundingClientRect()]) { if (r.width <= 0 || r.height <= 0) continue; const x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y), inView = x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight;
      const o = { x, y, ok: hit(t), inView, cover: t ? desc(t) : 'nothing' }; if (o.ok && inView) return o; first ??= o; }
    return first || { x: 0, y: 0, ok: false, inView: false, cover: 'nothing' }; };
  C.enumerate = () => {
    const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=menuitem], [role=switch], [role=checkbox], [role=link], [tabindex="0"], [onclick]';
    const KIND = { button: 'button', tab: 'tab', menuitem: 'menuitem', switch: 'switch', checkbox: 'checkbox', link: 'link' };
    const lab = (e) => ((e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].innerText) || (e.tagName === 'INPUT' && /^(button|submit|reset)$/.test(e.type) ? e.value : '') || e.innerText || e.getAttribute('title') || (e.querySelector && e.querySelector('img[alt]') && e.querySelector('img[alt]').alt) || e.placeholder || e.getAttribute('name') || e.id || '').replace(/\\s+/g, ' ').trim().slice(0, 40)) || e.tagName.toLowerCase();
    C.els = []; const out = [], cnt = {}; let files = 0; const forms = [...document.forms];
    for (const e of document.querySelectorAll(SEL)) {
      if (e === document.body || e === document.documentElement) continue;
      if (e.tagName === 'INPUT' && e.type === 'file') { files++; continue; }
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const box = e.getClientRects().length > 0 && s.visibility !== 'hidden';
      const visible = box && r.width > 1 && r.height > 1 && !(r.right + scrollX <= 0 || r.bottom + scrollY <= 0) && !e.closest('[aria-hidden="true"],[inert]');
      const sr = box && !visible && e.tabIndex >= 0;
      const tag = e.tagName.toLowerCase(), type = (e.type || '').toLowerCase(), role = e.getAttribute('role');
      const native = /^(a|button|input|select|textarea|summary)$/.test(tag);
      let kind = KIND[role] || (tag === 'a' ? 'link' : tag === 'select' ? 'select' : tag === 'textarea' ? 'field' : tag === 'summary' ? 'summary' : tag === 'button' ? 'button' : tag === 'input' ? (type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : /^(button|submit|reset|image)$/.test(type) ? 'button' : 'field') : 'clickable');
      if (tag === 'input' && type === 'radio') kind = 'radio';
      const own = e.labels && e.labels[0]; let w = r.width, h = r.height; if (own) { const lr = own.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); }
      const raw = tag === 'a' ? e.getAttribute('href') : null;
      let hashMissing = false; if (raw && raw.startsWith('#') && raw.length > 1 && !/^#[\/!]/.test(raw)) { let id = raw.slice(1); try { id = decodeURIComponent(id); } catch {} hashMissing = id !== 'top' && !(document.getElementById(id) || document.getElementsByName(id)[0]); }
      const label = lab(e); const blk = e.closest('p,li,td,figcaption,section,article,aside,div,form');
      const base = [tag, role, type, e.id, label, raw].join('|'); cnt[base] = (cnt[base] ?? -1) + 1;
      const i = C.els.push(e) - 1;
      out.push({ i, key: base + '#' + cnt[base], tag, type, kind, role, label, hrefRaw: raw, href: tag === 'a' ? e.href : null, disabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true', readonly: !!e.readOnly,
        visible, sr, w: Math.round(w), h: Math.round(h), generic: !native && !role, inForm: !!e.closest('form'), formIdx: e.closest('form') ? forms.indexOf(e.closest('form')) : -1,
        inline: tag === 'a' && s.display === 'inline' && !!e.parentElement && (e.parentElement.innerText || '').trim().length > (e.innerText || '').trim().length + 3,
        expectSubject: e.hasAttribute('data-expect-subject') || /quote|order|book|enquir|inquir|apply|hire|report|support|feedback|request|sales/i.test(label),
        sample: !!e.closest('[data-sample]') || /\\bsample\\b/i.test(label + ' ' + (e.getAttribute('title') || '') + ' ' + (blk ? (blk.innerText || '').slice(0, 400) : '')),
        menuLike: e.getAttribute('aria-expanded') === 'false' && (/menu|nav/i.test(label) || (() => { const t = e.getAttribute('aria-controls') && document.getElementById(e.getAttribute('aria-controls')); return !!t && t.querySelectorAll('a[href]').length >= 2; })()), inDialog: !!e.closest('dialog,[role=dialog],[role=alertdialog],[aria-modal=true]'), samePage: tag === 'a' && !!raw && !/^\\s*(javascript|mailto|tel|sms):/i.test(raw) && (() => { const n = (u) => u.origin + u.pathname.replace(/index\\.html$/, '').replace(/\\/$/, '') + u.search; try { return n(new URL(e.href)) === n(location); } catch { return false; } })(), ariaCurrent: e.hasAttribute('aria-current'), inNav: !!e.closest('nav,[role=navigation]'), target: e.target || '', rel: e.rel || '', native: tag === 'input' && (type === 'checkbox' || type === 'radio'), checked: !!e.checked });
    }
    return { list: out, files, canvases: document.querySelectorAll('canvas').length };
  };
  C.shortcuts = () => { const found = new Map(); const t = document.body ? document.body.innerText : '';
    for (const m of t.matchAll(/\\b(?:press|hit)\\s+(?:the\\s+)?[\`'"\\u201c\\u2018]?([a-z0-9?\\/])[\`'"\\u201d\\u2019]?(?=\\s+(?:to|for|key|and|or)\\b|[.,;:)]|$)/gim)) { if (!/^[ai]$/i.test(m[1]) || /[\`'"\\u201c]/.test(m[0])) found.set(m[1], { key: m[1], mods: '', text: m[0].trim() }); }
    for (const m of t.matchAll(/\\b(ctrl|control|cmd|command|alt|option|shift)\\s*\\+\\s*([a-z0-9])\\b/gi)) found.set(m[1].toLowerCase() + '+' + m[2], { key: m[2], mods: m[1].toLowerCase(), text: m[0] });
    for (const k of document.querySelectorAll('kbd, code')) { const x = (k.textContent || '').trim(); if (x.length === 1 && /[a-z0-9?\\/]/i.test(x) && /press|shortcut|key/i.test((k.parentElement.innerText || '').slice(0, 200))) found.set(x, { key: x, mods: '', text: 'press ' + x }); }
    return [...found.values()]; };
})()`;

// ---- results ----
const rows = []; const unverified = []; const unv = (msg, reason) => { if (!unverified.some((u) => u.msg === msg)) unverified.push({ msg, reason }); };
const shotDir = join(root, '.lilac', 'controls'); let shotN = 0;
const PLACE = /\b(todo|tbd|lorem|ipsum|placeholder|fixme)\b/i;
const EXAMPLE = /^(https?:\/\/(www\.)?example\.(com|org|net)([/:?#]|$)|mailto:[^?]*@example\.(com|org|net))/i;
const MAILRE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

function validateExt(x, c) { // returns [bad|null, note]
  let u; try { u = new URL(x.href); } catch { return [`malformed URL ${x.href}`, '']; }
  if (u.protocol === 'mailto:') {
    const addrs = decodeURIComponent(u.pathname).split(',').map((s) => s.trim()).filter(Boolean);
    if (!addrs.length || !addrs.every((a) => MAILRE.test(a))) return [`mailto address malformed: "${decodeURIComponent(u.pathname)}"`, ''];
    if (c.expectSubject && !u.searchParams.get('subject')) return [`mailto has no subject parameter (expected for "${c.label}")`, ''];
    return [null, `mailto intercepted, address valid${u.searchParams.get('subject') ? ', subject present' : ''}`];
  }
  if (u.protocol === 'tel:' || u.protocol === 'sms:') return /^\+?[0-9 ()\-.]{5,}$/.test(decodeURIComponent(u.pathname)) ? [null, `${u.protocol.slice(0, -1)} link intercepted, number valid`] : [`${u.protocol.slice(0, -1)} number malformed: "${decodeURIComponent(u.pathname)}"`, ''];
  if (u.protocol !== 'https:' && u.origin !== origin) return [`external link is not https: ${x.href}`, ''];
  if ((x.target === '_blank') && !/\b(noopener|noreferrer)\b/i.test(x.rel || '')) return ['target=_blank without rel="noopener"', ''];
  return [null, u.origin === origin ? 'opens a new tab (intercepted), same site' : `opens https://${u.host} (intercepted; destination not fetched)`];
}
function validateOpen(x) {
  let u; try { u = new URL(x.u, origin); } catch { return [`window.open URL malformed: ${x.u}`, '']; }
  if (u.protocol !== 'https:' && u.origin !== origin) return [`window.open is not https: ${x.u}`, ''];
  if (!/\b(noopener|noreferrer)\b/i.test(x.f)) return ['window.open without noopener', ''];
  return [null, `window.open intercepted: ${u.host}`];
}
function staticVerdict(c) {
  const raw = c.hrefRaw ?? '';
  if (PLACE.test(c.label) || PLACE.test(raw)) return ['PLACEHOLDER', `label or href looks like unfinished content: "${c.label}"`];
  if (c.href && EXAMPLE.test(c.href) && !c.sample) return ['PLACEHOLDER', `points to ${c.href} and is not documented as a SAMPLE`];
  if (c.tag !== 'a') return null;
  if (raw === '' || raw === '#') return ['BROKEN-LINK', `href is ${raw === '' ? 'empty' : '"#"'}`];
  if (/^\s*javascript:/i.test(raw)) return ['BROKEN-LINK', 'javascript: URL'];
  if (c.hashMissing) return ['BROKEN-LINK', `anchor target ${raw} does not exist on this page`];
  try { const u = new URL(c.href); if (u.origin === origin && !fileFor(decodeURIComponent(u.pathname))) return ['BROKEN-LINK', `404: ${u.pathname} is not in the site`]; } catch {}
  return null;
}

// A control whose own label changed (Copy -> Copied) is the same control: match on id/href when it has one.
const loose = (k) => { const p = k.split('|'); const l = p.splice(4, 1); return (p[3] || p[5]) ? p.join('|').replace(/#\d+$/, '') : k; };
const homeUrl = (page) => `${origin}/${page.split('/').map(encodeURIComponent).join('/')}`;
const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => raw(m, p, sessionId);
const ev = async (expression) => { const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page script failed: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)); return r.result.value; };
const navs = [], dls = [];
listeners.add((m) => {
  if (m.sessionId === sessionId && m.method === 'Page.frameNavigated' && !m.params.frame.parentId) navs.push(m.params.frame.url);
  if (m.sessionId === sessionId && m.method === 'Page.navigatedWithinDocument') navs.push(m.params.url);
  if (m.method === 'Browser.downloadWillBegin' || m.method === 'Page.downloadWillBegin') dls.push(m.params.suggestedFilename || m.params.url);
});
for (const m of ['Page.enable', 'Runtime.enable', 'DOMDebugger.enable', 'DOM.enable']) await S(m).catch(() => {});
const blocked = []; await guard(raw, listeners, sessionId, origin, blocked);
await S('Page.addScriptToEvaluateOnNewDocument', { source: INIT });
await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await S('Emulation.setFocusEmulationEnabled', { enabled: true });
await raw('Browser.setDownloadBehavior', { behavior: 'deny', eventsEnabled: true }).catch(() => {});
await S('Page.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});

const load = async (url) => {
  await S('Page.navigate', { url: 'about:blank' }); await sleep(30);
  if (!cred) await raw('Storage.clearDataForOrigin', { origin, storageTypes: 'local_storage,session_storage,cookies,indexeddb' }).catch(() => {}); // shortcut: with --credentials nothing is cleared (it would sign us out)
  await new Promise((res) => { const t = setTimeout(done, 15000); function done() { clearTimeout(t); listeners.delete(h); res(); } const h = (m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') done(); }; listeners.add(h); S('Page.navigate', { url }).catch(done); });
  await sleep(120);
};
const mouse = async (x, y) => { for (const [type, extra] of [['mouseMoved', {}], ['mousePressed', { button: 'left', clickCount: 1 }], ['mouseReleased', { button: 'left', clickCount: 1 }]]) await S('Input.dispatchMouseEvent', { type, x, y, ...extra }); };
const key = async (k, mods) => {
  const up = k.toUpperCase(), code = /[a-z]/i.test(k) ? 'Key' + up : /[0-9]/.test(k) ? 'Digit' + k : '', bits = { alt: 1, option: 1, ctrl: 2, control: 2, cmd: 4, command: 4, shift: 8 }[mods] ?? 0;
  const text = bits & 7 ? undefined : k;
  await S('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code, windowsVirtualKeyCode: up.charCodeAt(0), text, modifiers: bits });
  await S('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: up.charCodeAt(0), modifiers: bits });
};
async function enumerate() {
  await ev('__ct.settle()'); const r = await ev('__ct.enumerate()'); // settled DOM, document order
  for (const c of r.list) if (c.generic) {
    try { const o = await S('Runtime.evaluate', { expression: `__ct.els[${c.i}]` }); const l = await S('DOMDebugger.getEventListeners', { objectId: o.result.objectId }); c.has = l.listeners.some((x) => /^(click|mousedown|mouseup|pointerdown|pointerup|touchstart|keydown|keyup)$/.test(x.type)); } catch { c.has = true; }
  }
  return { ...r, list: r.list.filter((c) => !c.generic || c.has) };
}
async function replay(path) { for (const k of path) { const c = (await enumerate()).list.find((x) => x.key === k); if (!c) throw new Error(`could not replay "${k.split('|')[4]}" to reach this screen`); await ev(`__ct.arm(null)`); await press(c); await sleep(250); } }
async function fresh(page, st, k, want) {
  const path = st.path; // re-find by stable key; fall back to tag+label+href(+nth among those); retry once after a longer settle
  for (let a = 0; a < 2; a++) {
    await load(homeUrl(page) + (st.route || '')); if (a) await sleep(700); await replay(path); const e = await enumerate();
    let c = e.list.find((x) => x.key === k);
    if (!c && want) { const same = e.list.filter((x) => x.tag === want.tag && x.label === want.label && x.hrefRaw === want.hrefRaw); c = same[Math.min(Number(k.split('#').pop()) || 0, same.length - 1)]; }
    if (c) return { e, c };
  }
  return { e: null, c: null };
}
async function press(c) {
  if (c.sr) { await ev(`(() => { const e = __ct.els[${c.i}]; e.focus(); e.click(); })()`); return {}; }
  const g = await ev(`__ct.reach(${c.i})`); if (!g.ok || !g.inView) return { blocked: g.ok ? 'scrolled out of reach' : `covered by ${g.cover}` };
  await mouse(g.x, g.y); return {};
}
async function poll(c) {
  const n0 = navs.length, d0 = dls.length; const t0 = Date.now(); let eff = [];
  const read = async () => { if (navs.length > n0) eff.push(['url', navs.at(-1).replace(origin, '')]); if (dls.length > d0) eff.push(['download', String(dls.at(-1))]); try { eff.push(...(await ev('__ct.diff()'))); } catch { /* page navigated away */ } };
  return { start: async () => {}, run: async () => { while (Date.now() - t0 < 1500) { await sleep(50); eff = []; await read(); if (eff.length) { await sleep(80); eff = []; await read(); break; } } return eff.filter((e, i, a) => a.findIndex((x) => x[0] === e[0] && x[1] === e[1]) === i); } };
}
async function shot(name) { try { mkdirSync(shotDir, { recursive: true }); const f = `${name.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}-${++shotN}.png`; writeFileSync(join(shotDir, f), Buffer.from((await S('Page.captureScreenshot', { format: 'png' })).data, 'base64')); return `.lilac/controls/${f}`; } catch { return null; } }

// Returns { eff, blocked }: perform the natural action for c on the already-loaded, enumerated page.
// On a page that animates itself, a DOM-only effect proves nothing: drop it, remember that we did, and report UNVERIFIED instead of DEAD.
let droppedDom = false;
const trust = (noisy) => (e) => { if (noisy && e[0] === 'dom') { droppedDom = true; return false; } return true; };
async function exercise(c, noisy, pageFill) {
  droppedDom = false;
  const scope = c.formIdx >= 0 ? `document.forms[${c.formIdx}]` : 'document';
  if (c.kind === 'field') {
    const g = await ev(`__ct.reach(${c.i})`); if (!g.ok) return { blocked: `covered by ${g.cover}` };
    const r = await ev(`(() => { const e = __ct.els[${c.i}]; const b = e.value; __ct.arm(${c.i}); const did = __ct.fillOne(e); return { did, took: did && e.value !== '' && e.value !== b }; })()`);
    if (!r.took) return { eff: [] , fieldFail: true };
    const eff = (await ev('__ct.diff()')).filter(trust(noisy));
    return { eff: [['value', c.inForm ? 'accepts input; sent with its form' : 'accepts input' + (eff.length ? '' : '; nothing reacts while typing')], ...eff] };
  }
  if (c.kind === 'select') {
    const n = await ev(`__ct.els[${c.i}].options.length`);
    if (n < 2) return { eff: [], note: 'fewer than 2 options: nothing to choose' };
    const g = await ev(`__ct.reach(${c.i})`); if (!g.ok) return { blocked: `covered by ${g.cover}` };
    let withEff = 0, tried = 0, took = 0, last = [];
    for (let k = 0; k < Math.min(n, 12); k++) {
      const r = await ev(`(() => { const e = __ct.els[${c.i}], o = e.options[${k}]; if (o.disabled) return null; __ct.arm(${c.i}); e.selectedIndex = ${k}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return e.selectedIndex === ${k}; })()`);
      if (r === null) continue; tried++; if (r) took++;
      await sleep(120); const eff = (await ev('__ct.diff()').catch(() => [])).filter(trust(noisy)); if (eff.length) { withEff++; last = eff; }
    }
    if (!took) return { eff: [] };
    return { eff: withEff ? [['select', `${tried} option(s) chosen, ${withEff} with an effect`], ...last] : c.inForm ? [['select', `${tried} option(s) chosen; value sent with its form`]] : [] };
  }
  if (['button', 'clickable', 'menuitem', 'tab'].includes(c.kind) && (c.formIdx >= 0 || pageFill)) await ev(`__ct.fill(${scope})`);
  const wasChecked = c.native ? await ev(`__ct.els[${c.i}].checked`) : null;
  if (c.kind === 'radio' && wasChecked) return { skipped: 'already selected' };
  await ev(`__ct.arm(${c.i})`);
  const p = await poll(c);
  const b = await press(c); if (b.blocked) return { blocked: b.blocked };
  let eff = (await p.run()).filter(trust(noisy));
  if (c.native && c.inForm && !eff.length) { try { if ((await ev(`__ct.els[${c.i}].checked`)) !== wasChecked) eff = [['value', 'state toggled; sent with its form']]; } catch {} }
  return { eff };
}
function judge(c, eff) {
  const bad = [], notes = [];
  for (const [k, v] of eff) {
    if (k === 'ext') { const [b, n] = validateExt(v, c); b ? bad.push(b) : notes.push(n); }
    else if (k === 'open') { const [b, n] = validateOpen(v); b ? bad.push(b) : notes.push(n); }
    else if (k === 'url') notes.push(`navigated to ${String(v).replace(origin, "")}`);
    else if (k === 'clip') notes.push(`copied text: "${String(v).slice(0, 30)}"`);
    else if (k === 'confirm') notes.push(`confirm dialog "${String(v).slice(0, 40)}"`);
    else if (k === 'download') notes.push(`download started: ${v}`);
    else notes.push(typeof v === 'string' && !['dom', 'storage', 'dialog'].includes(k) && k !== 'focus' ? v : v);
  }
  if (bad.length) return ['BROKEN-LINK', bad.join('; ')];
  return notes.length ? ['OK', [...new Set(notes)].join('; ')] : ['DEAD', 'no URL change, DOM change, focus move, dialog, storage change, copy, download or navigation within 1.5 s'];
}

async function menuCheck(page, st, c0) { // a menu button must open a nav and close again
  const g = await fresh(page, st, c0.key, c0); if (!g.c) return null;
  const links = () => ev(`[...document.querySelectorAll('a[href]')].filter((a) => a.getClientRects().length && getComputedStyle(a).visibility !== 'hidden').length`);
  const exp = () => ev(`__ct.els[${g.c.i}].getAttribute('aria-expanded')`);
  const esc = async () => { for (const type of ['keyDown', 'keyUp']) await S('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(400); };
  const before = await links(); const o = await press(g.c); if (o.blocked) return null; await sleep(400);
  if ((await exp()) !== 'true') return ['DEAD', 'menu button did not set aria-expanded="true" when pressed'];
  const after = await links(); if (after <= before) return ['DEAD', 'aria-expanded is true but no navigation links became visible'];
  await esc(); let how = 'Escape';
  if ((await exp()) !== 'false') { const b = await press(g.c); await sleep(400); how = 'the button'; if (b.blocked || (await exp()) !== 'false') return ['DEAD', 'menu opens but cannot be closed (Escape and the button both fail)']; }
  return ['OK', `opens a nav (aria-expanded true, ${after - before} more link(s) visible) and closes with ${how}`];
}
async function sweepPage(page, vp, sh, last) {
  const url = homeUrl(page); const done = sh.done, known = new Set(), knownLoose = new Set(), hiddenSeen = sh.hidden, queued = new Set(['']);
  const dialogStates = [];
  let queue = [{ path: [], names: [] }], noisy = false, first = true, tested = 0;
  const rn = (r) => r.replace(/^#!?\/?/, '') || 'home'; const routes = new Set();
  const add = (st, c, verdict, detail) => rows.push({ page, label: (st.route ? rn(st.route) + ': ' : '') + c.label + (vp.mobile && !c.noVp ? ' @' + vp.w : '') + (st.names.length ? ` (after: ${st.names.join(' > ')})` : ''), kind: c.kind, verdict, detail });
  await load(url);
  try { await sleep(900); noisy = (await ev('__ct.noise()')) > 0; } catch {}
  if (noisy) unv(`${page}: DOM-change effects`, 'the page changes its own DOM without any action (clock, carousel, animation), so only URL, focus, dialog, storage, copy, download and navigation effects were trusted');
  const text = await ev('document.body ? document.body.innerText.length : 0').catch(() => 0);
  while (queue.length) {
    const st = queue.shift();
    let survey; try { await load(url + (st.route || '')); await replay(st.path); survey = await enumerate(); } catch (e) { unv(`${page}: screen after ${st.names.join(' > ')}`, String(e.message).slice(0, 120)); continue; }
    if (first) { first = false; if (survey.files) unv(`${page}: ${survey.files} file input(s)`, 'native file pickers cannot be driven'); if (survey.canvases) unv(`${page}: ${survey.canvases} canvas element(s)`, 'canvas-only controls have no DOM to enumerate'); }
    if (process.env.CT_DEBUG) for (const c of survey.list) if (new RegExp(process.env.CT_DEBUG, 'i').test(c.label)) console.error(`[debug] ${vp.w} route=${st.route ?? ''} path=${st.path.length} visible=${c.visible} key=${c.key}`);
    for (const c of survey.list) if (/^#[\/!]/.test(c.hrefRaw ?? '') && !routes.has(c.hrefRaw) && routes.size < 30) { routes.add(c.hrefRaw); queue.push({ path: [], names: [], route: c.hrefRaw }); }
    for (const c of survey.list) { if (c.visible || c.sr) { known.add(c.key); knownLoose.add(loose(c.key)); sh.seen.add(c.key); sh.seenLoose.add(c.tag + '|' + c.label); hiddenSeen.delete(c.key); } else if (!done.has(c.key) && !sh.seen.has(c.key)) hiddenSeen.set(c.key, { c, st }); }
    for (const c0 of survey.list) {
      if (vp.mobile && done.has(c0.key) && c0.visible && !c0.sr && !sh.reach.has(c0.key)) { // already exercised on desktop: only check it is reachable on the phone layout
        sh.reach.add(c0.key); try { const g = await ev(`__ct.reach(${c0.i})`); if (!g.ok) add(st, c0, 'UNREACHABLE', `covered by ${g.cover} at ${vp.w} px (it works on desktop)`); } catch {}
      }
      if (done.has(c0.key) || (!c0.visible && !c0.sr)) continue;
      if (tested++ >= 250) { unv(`${page}: more than 250 controls`, 'the sweep stops at 250 controls per page'); break; }
      done.add(c0.key);
      const sv = staticVerdict(c0); if (sv) { add(st, c0, ...sv); continue; }
      let r;
      try {
        const f = await fresh(page, st, c0.key, c0); const c = f.c; if (!c) { unv(`${page}: "${c0.label}" (${c0.kind})`, 'could not re-locate the control after a reload (tried twice); not judged'); continue; }
        if (c.disabled) {
          await ev(`__ct.fill(${c.formIdx >= 0 ? `document.forms[${c.formIdx}]` : 'document'})`); await sleep(700);
          if (await ev(`(() => { const e = __ct.els[${c.i}]; return e.disabled === true || e.getAttribute('aria-disabled') === 'true'; })()`)) { add(st, c, 'DISABLED-FOREVER', 'disabled; filling the form with valid sample values did not enable it'); continue; }
        }
        if (c.kind === 'link' && c.samePage && !/^#/.test(c.hrefRaw ?? '')) { add(st, c, 'OK', 'current-page link (points at the page you are already on)' + (c.inNav && !c.ariaCurrent ? '; warn: nav item lacks aria-current="page"' : '')); continue; }
        r = await exercise(c, noisy);
        if (r.blocked) { const shotf = await shot(c.label); add(st, c, 'UNREACHABLE', `${r.blocked}${shotf ? '; screenshot ' + shotf : ''}`); continue; }
        if (r.skipped) { unv(`${page}: radio "${c.label}"`, 'already selected; its state change is covered by the other radios in the group'); continue; }
        if (r.fieldFail) { add(st, c, 'DEAD', c.readonly ? 'readonly' : 'typed sample text was not accepted'); continue; }
        let [v, d] = r.eff.length ? judge(c, r.eff) : ['DEAD', r.note ?? 'no URL change, DOM change, focus move, dialog, storage change, copy, download or navigation within 1.5 s'];
        const conf = r.eff.find((e) => e[0] === 'confirm');
        if (conf && v !== 'BROKEN-LINK') { // dialog seen and cancelled: now confirm once on a throwaway reload
          const g = await fresh(page, st, c0.key, c0); if (!g.c) { unv(`${page}: "${c0.label}" confirm pass`, 'could not re-locate the control for the confirm pass'); add(st, c, 'OK', `confirm dialog "${String(conf[1]).slice(0, 40)}" appeared and was cancelled; confirming was not verified`); continue; } await ev('__ct.answerWith(true)'); const r2 = await exercise(g.c, noisy);
          const eff2 = (r2.eff ?? []).filter((e) => e[0] !== 'confirm');
          [v, d] = eff2.length ? ['OK', `confirm dialog "${String(conf[1]).slice(0, 40)}" appeared and was cancelled; confirmed once: ${judge(g.c, eff2)[1]}`] : ['DEAD', `confirm dialog appeared, but confirming it had no observable effect`];
        }
        if (v === 'DEAD' && !droppedDom && !c.inForm && ['button', 'clickable', 'menuitem', 'tab'].includes(c.kind)) { // maybe it reads standalone inputs: retry once with them filled
          const g2 = await fresh(page, st, c0.key, c0);
          if (g2.c) { const r2 = await exercise(g2.c, noisy, true); if (r2.eff?.length) { const j2 = judge(g2.c, r2.eff); if (j2[0] !== 'DEAD') { [v, d] = [j2[0], j2[1] + '; after filling the page fields with sample values']; r = r2; } } }
        }
        if (v === 'DEAD' && droppedDom) { unv(`${page}: "${c.label}" (${c.kind})`, 'only a DOM change was seen and this page changes its own DOM; not judged'); continue; }
        if (v === 'DEAD') d += `; screenshot ${(await shot(c.label)) ?? 'none'}`;
        if (v === 'OK' && c.menuLike && !r.blockedMenu) { const m = await menuCheck(page, st, c0); if (m) { if (m[0] === 'DEAD') { v = 'DEAD'; d = m[1]; } else d += '; ' + m[1]; } }
        if (v === 'OK' && !c.sr && !c.inline && Math.min(c.w, c.h) < 24) { d += `; but only ${c.w}x${c.h} px`; v = 'TOO-SMALL'; }
        if (v === 'OK' && c.sr) d += '; visually hidden until focused';
        add(st, c, v, d);
        if (v !== 'BROKEN-LINK' && st.path.length < 2 && !r.eff.some((e) => e[0] === 'url') && queue.length + queued.size < 40) {
          let ks = []; try { ks = (await enumerate()).list.filter((x) => (x.visible || x.sr) && !known.has(x.key) && !knownLoose.has(loose(x.key))).map((x) => x.key); } catch {}
          const id = [...st.path, c.key].join('>');
          if (ks.length && !queued.has(id)) {
            if (await ev('__ct.dialogs()').catch(() => 0)) dialogStates.push({ path: [...st.path, c.key], names: [...st.names, c.label], route: st.route }); queued.add(id); ks.forEach((k) => known.add(k)); queue.push({ path: [...st.path, c.key], names: [...st.names, c.label], route: st.route }); }
        }
      } catch (e) { if (/could not replay/.test(e.message)) unv(`${page}: "${c0.label}"`, String(e.message).slice(0, 100)); else add(st, c0, 'DEAD', `could not exercise: ${String(e.message).slice(0, 100)}`); }
    }
  }
  for (const st of dialogStates) { // a dialog opened by a control must close again with Escape or its own close control
    try {
      await load(url + (st.route || '')); await replay(st.path);
      if (!(await ev('__ct.dialogs()'))) continue;
      await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sleep(500); let closed = (await ev('__ct.dialogs()')) === 0, how = 'Escape';
      if (!closed) { const x = (await enumerate()).list.find((c) => c.inDialog && c.visible && /close|cancel|dismiss|done|^ok$|\u00d7|^x$/i.test(c.label)); if (x) { await press(x); await sleep(500); closed = (await ev('__ct.dialogs()')) === 0; how = `its close control "${x.label}" (Escape does not close it)`; } }
      add({ names: st.names.slice(0, -1), route: st.route }, { label: `${st.names.at(-1)} dialog`, kind: 'dialog' }, closed ? 'OK' : 'DEAD', closed ? `opened, then closed with ${how}` : 'opened, but neither Escape nor a close control closed it');
    } catch (e) { unv(`${page}: dialog after ${st.names.join(' > ')}`, String(e.message).slice(0, 100)); }
  }
  if (last) for (const { c, st } of hiddenSeen.values()) if (!done.has(c.key) && !sh.seen.has(c.key) && !sh.seenLoose.has(c.tag + '|' + c.label)) { const sv = staticVerdict(c); add({ ...st, }, { ...c, noVp: true }, sv ? sv[0] : 'UNREACHABLE', sv ? sv[1] : 'never visible at any viewport (1280 and 390 px) or reachable screen (display none, zero size or off-screen) and not a skip link'); }
  // keyboard shortcuts documented in the page text
  if (text && !vp.mobile) {
    await load(url); const sc = await ev('__ct.shortcuts()').catch(() => []);
    for (const s of sc) {
      let eff = []; droppedDom = false; try { await load(url); await ev('document.activeElement && document.activeElement.blur(); __ct.arm(null)'); const p = await poll(); const run = p.run(); await key(s.key, s.mods); eff = (await run).filter(trust(noisy)); } catch {}
      const c = { label: (s.mods ? s.mods + '+' : '') + s.key, kind: 'shortcut', expectSubject: false };
      if (!eff.length && droppedDom) { unv(`${page}: shortcut ${c.label}`, 'only a DOM change was seen and this page changes its own DOM; not judged'); continue; }
      const [v, d] = eff.length ? judge(c, eff) : ['DEAD', `documented as "${s.text}" but pressing it had no observable effect`];
      add({ names: [] }, c, v, d);
    }
  }
}

async function signIn() {
  await load(origin + cred.loginPath);
  for (const [k, v] of Object.entries(cred.fields)) {
    const ok = await ev(`(() => { const q = ${JSON.stringify(k)}; const e = document.querySelector('input[name="' + q + '"], #' + CSS.escape(q) + ', input[type="' + q + '"], input[autocomplete="' + q + '"], textarea[name="' + q + '"]'); if (!e) return false; __ct.fillOne; const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value'); d.set.call(e, ${JSON.stringify(String(v))}); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    if (!ok) { console.error(`controls-test: sign-in field "${k}" not found on ${cred.loginPath}`); process.exit(2); }
  }
  const hit = await ev(`(() => { const b = document.querySelector(${JSON.stringify(cred.submit)}); if (!b) return false; b.click(); return true; })()`);
  if (!hit) { console.error(`controls-test: sign-in submit "${cred.submit}" not found on ${cred.loginPath}`); process.exit(2); }
  await sleep(1200);
}

const files = walk(site).filter((f) => f.endsWith('.html')).sort();
try {
  if (cred) await signIn();
  for (const f of files) {
    const page = relative(site, f).split(sep).join('/'); let t;
    const cap = new Promise((_, j) => { t = setTimeout(() => j(new Error('timeout: page took more than 600 s')), 600000); });
    try {
      const sh = { done: new Set(), seen: new Set(), seenLoose: new Set(), hidden: new Map(), reach: new Set() };
      const VPS = [{ w: 1280, h: 800, mobile: false }, { w: 390, h: 844, mobile: true }];
      const run = (async () => { for (const [n, vp] of VPS.entries()) { await S('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.mobile ? 2 : 1, mobile: vp.mobile }); await S('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile, maxTouchPoints: 5 }).catch(() => {}); await sweepPage(page, vp, sh, n === VPS.length - 1); } })();
      await Promise.race([run, cap]);
    }
    catch (e) { rows.push({ page, label: '(page)', kind: 'page', verdict: 'DEAD', detail: `sweep aborted: ${String(e.message ?? e).slice(0, 140)}` }); }
    finally { clearTimeout(t); }
  }
} finally { ws.close(); }
if (!files.length) unv('no .html files found', 'nothing to sweep');
unv('external link destinations', 'https links to other sites were intercepted and validated, not fetched (no external network)');
unv('hover-only, long-press and drag-only controls', 'only click, toggle, typing and key presses are performed');
unv('controls inside iframes or shadow roots, and other viewports', 'the sweep reads the top document at 1280 px and 390 px only (tablet widths and real touch are not driven)');
unv('whether an effect is the RIGHT effect', 'an effect proves the control is wired, not that it does what its label promises; a human or test must judge that');

// --known <file>: lines `exact control label  # reason`. An UNREACHABLE row named there becomes KNOWN-LIMIT (still listed, never silent): the control exists only in a state this tool does not create and the reason says where it is proven instead. A line that matches nothing is reported as stale.
if (knownArg && existsSync(knownArg)) {
  const known = new Map(readFileSync(knownArg, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).map((l) => { const [a, ...b] = l.split(/\s+#\s+/); return [a.trim(), b.join(' # ').trim()]; }));
  const used = new Set();
  for (const r of rows) if (r.verdict === 'UNREACHABLE' && known.has(r.label) && known.get(r.label)) { used.add(r.label); r.verdict = 'KNOWN-LIMIT'; r.detail = `proven elsewhere: ${known.get(r.label)}`; }
  for (const k of known.keys()) if (!used.has(k)) unv(`stale known-limit entry "${k}"`, 'it matched no UNREACHABLE control; remove it, or the control now fails for another reason');
}
const blockedRows = blocked.map((b) => ({ host: b.host, msg: b.msg }));
const by = (v) => rows.filter((r) => r.verdict === v).length;
const N = rows.length, D = by('DEAD') + by('DISABLED-FOREVER'), B = by('BROKEN-LINK'), P = by('PLACEHOLDER'), U = by('UNREACHABLE');
const pct = N ? Math.round((100 * (by('OK') + by('TOO-SMALL'))) / N) : 100;
const summary = `controls-test: ${N} controls, ${D} dead, ${B} broken, ${P} placeholder, ${U} unreachable${by('KNOWN-LIMIT') ? `, ${by('KNOWN-LIMIT')} known limit (listed, proven elsewhere)` : ''} (${pct}% operable)`;
const pages = [...new Set(rows.map((r) => r.page))].map((p) => ({ page: p, controls: rows.filter((r) => r.page === p).map(({ label, kind, verdict, detail }) => ({ label, kind, verdict, detail })) }));
const totals = Object.fromEntries(['OK', 'DEAD', 'DISABLED-FOREVER', 'BROKEN-LINK', 'PLACEHOLDER', 'UNREACHABLE', 'TOO-SMALL', 'KNOWN-LIMIT'].map((v) => [v, by(v)]));
if (json) console.log(redact(JSON.stringify({ site: relative(root, site) || '.', pages, totals, blocked: blockedRows, unverified, summary }, null, 2)));
else {
  const L = [`Controls test for ${site} (Chrome, 1280 px and 390 px; screenshots of failures in ${join(root, '.lilac', 'controls')})`, ''];
  for (const p of pages) {
    L.push(`${p.page}`); const w = Math.min(44, Math.max(5, ...p.controls.map((c) => c.label.length)));
    L.push(`  ${'control'.padEnd(w)} | ${'kind'.padEnd(9)} | ${'verdict'.padEnd(16)} | detail`);
    for (const c of p.controls) L.push(`  ${c.label.slice(0, 44).padEnd(w)} | ${c.kind.padEnd(9)} | ${c.verdict.padEnd(16)} | ${c.detail}`);
    L.push('');
  }
  if (blockedRows.length) L.push('External requests blocked (the page tried to reach these; nothing was sent):', ...blockedRows.map((b) => `  ${b.msg}`), '');
  L.push('Totals: ' + Object.entries(totals).map(([k, v]) => `${k} ${v}`).join(', '), '', 'UNVERIFIED (not exercised by this tool)', ...unverified.map((u) => `  ${u.msg}: ${u.reason}`), '', summary);
  console.log(redact(L.join('\n')));
}
process.exit(D + B + P + U > 0 ? 1 : 0);
