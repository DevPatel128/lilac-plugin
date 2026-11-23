#!/usr/bin/env node
// persona-test.mjs <projectDir> [--site dir] [--visitors 100] [--seed N] [--json] [--min-overall 90] [--min-persona 70]
// SIMULATED visitors, not real people. Scripted sessions in the system Chrome (DevTools protocol, no installs) that check whether a visitor
// with a given METHOD (mouse on mobile slow 3G, skimming links, keyboard only, screen-reader proxy via the accessibility tree, 200% zoom,
// reduced motion, JavaScript off, impatient, 320 px phone) can complete page-derived tasks within a step budget. It does not measure taste,
// opinions or real demand.
// Tasks: offer (visible h1), contact (contact/buy/book/... control), nav (every top-nav page), form (valid sample data + visible feedback),
// info (price or opening hours reachable). Extra tasks: <project>/.lilac/personas.json, see skills/persona-test/SKILL.md.
// Serves the site on 127.0.0.1 only; every request to another host is blocked (no sample data leaves the machine). Same seed, same report.
// Exit 1 when overall completion < --min-overall or any persona < --min-persona; 0 with `SKIPPED(no browser)` when no Chrome; 2 on bad usage.
// Limits: form POST handlers cannot be verified offline; "visible feedback" is a text/role heuristic; sessions run 6 at a time; 10 minute cap.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, statSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, extname, normalize, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const json = args.includes('--json');
const VISITORS = Math.max(1, Math.floor(Number(flag('--visitors', 100))) || 100);
const SEED = Math.floor(Number(flag('--seed', 1))) || 1;
const MIN_OVERALL = Number(flag('--min-overall', 90)), MIN_PERSONA = Number(flag('--min-persona', 70));
const skipv = new Set(['--site', '--visitors', '--seed', '--min-overall', '--min-persona'].map((n) => flag(n)));
const proj = args.find((a) => !a.startsWith('--') && !skipv.has(a));
if (!proj || !existsSync(proj) || !statSync(proj).isDirectory()) { console.error('usage: persona-test.mjs <projectDir> [--site dir] [--visitors 100] [--seed N] [--json] [--min-overall 90] [--min-persona 70]'); process.exit(2); }
const root = resolve(proj);
const hasHtml = (d) => existsSync(d) && statSync(d).isDirectory() && readdirSync(d).some((f) => f.endsWith('.html'));
let site = flag('--site') ? resolve(root, flag('--site')) : ['site', 'public', 'dist', 'out', 'build'].map((n) => join(root, n)).find(hasHtml);
if (!site && existsSync(join(root, 'index.html'))) site = root;
if (!site || !existsSync(site)) { console.error('persona-test: no site folder found (site, public, dist, out, build, or index.html in the root). Use --site <dir>.'); process.exit(2); }

const DISCLAIMER = 'SIMULATED visitors, not real people. Scripted browser sessions check whether tasks can be completed with each method; they do not measure taste, opinions or real demand.';

// ---------- find Chrome (same order as handoff.mjs) ----------
const onPath = (n) => (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').map((d) => join(d, n)).find((c) => c && existsSync(c));
const win = ['ProgramFiles', 'ProgramFiles(x86)'].flatMap((v) => process.env[v] ? [join(process.env[v], 'Google/Chrome/Application/chrome.exe'), join(process.env[v], 'Microsoft/Edge/Application/msedge.exe')] : []);
const CHROME = process.env.CHROME ? (existsSync(process.env.CHROME) ? process.env.CHROME : null)
  : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(onPath), ...win].find((c) => c && existsSync(c));
if (!CHROME) { console.log('persona-test: SKIPPED(no browser)'); process.exit(0); }

// ---------- cleanup on every exit path ----------
const tmp = mkdtempSync(join(tmpdir(), 'lilac-persona-'));
let chrome = null, server = null;
const cleanup = () => {
  try { if (chrome?.pid) process.kill(-chrome.pid, 'SIGKILL'); } catch { try { chrome?.kill('SIGKILL'); } catch {} }
  try { server?.close(); server?.closeAllConnections?.(); } catch {}
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
};
const die = (code, msg) => { if (msg) console.error(msg); cleanup(); process.exit(code); };
process.on('exit', cleanup);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => die(1, 'persona-test: interrupted'));
process.on('uncaughtException', (e) => die(1, 'persona-test: ' + (e.stack ?? e)));
process.on('unhandledRejection', (e) => die(1, 'persona-test: ' + (e?.stack ?? e)));
const T0 = Date.now(), CAP = 10 * 60 * 1000;
setTimeout(() => die(1, 'persona-test: hard cap of 10 minutes reached'), CAP).unref();

// ---------- static server (127.0.0.1 only) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };
server = createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = normalize(join(site, p));
  if (!f.startsWith(site + sep) && f !== site) { res.writeHead(403).end('no'); return; }
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(501, { 'content-type': 'text/plain' }).end('Not implemented (persona-test serves static files only)'); return; }
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream' }).end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port, BASE = `http://127.0.0.1:${PORT}`;

// ---------- Chrome + minimal CDP client ----------
// shortcut: duplicated CDP client, merge with qa-browser.mjs later
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${join(tmp, 'u')}`, 'about:blank'], { stdio: 'ignore', detached: true });
chrome.on('error', () => {});
let DBG = 0;
for (let i = 0; i < 100 && !DBG; i++) { try { DBG = Number(readFileSync(join(tmp, 'u', 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch {} if (!DBG) await sleep(150); }
if (!DBG) { console.log('persona-test: SKIPPED(no browser)'); die(0, 'persona-test: Chrome did not start (could not read DevToolsActivePort)'); }

let browserWs = null, bid = 0; const bpend = new Map();
// each tab gets its own window: background tabs are throttled by Chrome and make mouse input slow
async function browserSend(method, params) {
  if (!browserWs) { const v = await (await fetch(`http://127.0.0.1:${DBG}/json/version`)).json(); browserWs = new WebSocket(v.webSocketDebuggerUrl); await new Promise((r, j) => { browserWs.onopen = r; browserWs.onerror = j; }); browserWs.onmessage = (e) => { const m = JSON.parse(e.data); bpend.get(m.id)?.(m.result); bpend.delete(m.id); }; }
  return new Promise((res, rej) => { const k = ++bid; const to = setTimeout(() => { bpend.delete(k); rej(new Error('CDP timeout ' + method)); }, 20000); bpend.set(k, (v) => { clearTimeout(to); res(v); }); browserWs.send(JSON.stringify({ id: k, method, params })); });
}
async function openTab() {
  // own browser context per tab: localStorage, cookies and service workers cannot leak between concurrent sessions
  const { browserContextId } = await browserSend('Target.createBrowserContext', {});
  const { targetId } = await browserSend('Target.createTarget', { url: 'about:blank', newWindow: true, browserContextId });
  const t = { id: targetId, webSocketDebuggerUrl: `ws://127.0.0.1:${DBG}/devtools/page/${targetId}` };
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(), hs = {};
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id) { const p = pend.get(m.id); pend.delete(m.id); if (p) m.error ? p[1](new Error(m.error.message)) : p[0](m.result); } else (hs[m.method] ?? []).forEach((h) => h(m.params)); };
  return {
    send: (method, params = {}) => new Promise((res, rej) => { const k = ++id; const to = setTimeout(() => { pend.delete(k); rej(new Error('CDP timeout ' + method)); }, 20000); pend.set(k, [(v) => { clearTimeout(to); res(v); }, (e) => { clearTimeout(to); rej(e); }]); ws.send(JSON.stringify({ id: k, method, params })); }),
    on: (m, h) => (hs[m] ??= []).push(h),
    async close() { try { ws.close(); } catch {} try { await browserSend('Target.closeTarget', { targetId: t.id }); await browserSend('Target.disposeBrowserContext', { browserContextId }); } catch {} },
  };
}

// ---------- page helper (runs inside the page; stringified, no outer scope) ----------
function helperFn() {
  if (window.__l) return;
  const st = document.createElement('style'); st.textContent = 'html{scroll-behavior:auto !important}'; (document.head || document.documentElement).appendChild(st); // instant scrolling: never act on a page that is still scrolling
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const vis = (el) => {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || (e === el && cs.visibility === 'hidden') || +cs.opacity === 0) return false; }
    return true;
  };
  const lab = (el) => {
    if (el.matches('input[type=submit],input[type=button]')) return norm(el.value);
    let t = norm(el.innerText || el.textContent); if (t) return t.slice(0, 60);
    t = norm(el.getAttribute('aria-label')); if (!t) { const im = el.querySelector('img[alt]'); t = norm(im && im.alt); } if (!t) t = norm(el.title);
    return t.slice(0, 60);
  };
  const flab = (el) => {
    let t = ''; if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) t = norm(l.textContent); }
    if (!t) { const l = el.closest('label'); if (l) t = norm(l.textContent); }
    if (!t) t = norm(el.getAttribute('aria-label'));
    if (!t && el.getAttribute('aria-labelledby')) t = norm(el.getAttribute('aria-labelledby').split(' ').map((i) => (document.getElementById(i) || {}).textContent).join(' '));
    return (t || norm(el.placeholder) || el.name || el.id || '').slice(0, 60);
  };
  const SEL = 'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=menuitem],[role=tab],[onclick],[tabindex],nav a,header a';
  const q = (i) => document.querySelector('[data-lp="' + i + '"]');
  const items = () => {
    document.querySelectorAll('[data-lp]').forEach((e) => e.removeAttribute('data-lp'));
    const els = [...document.querySelectorAll(SEL)];
    document.querySelectorAll('span,div,li,img,p').forEach((e) => { if (!e.matches(SEL) && !e.closest(SEL) && getComputedStyle(e).cursor === 'pointer' && !e.querySelector(SEL) && !(e.parentElement && getComputedStyle(e.parentElement).cursor === 'pointer')) els.push(e); });
    const forms = [...document.forms];
    return els.map((e, i) => {
      e.setAttribute('data-lp', i);
      const tag = e.tagName.toLowerCase(), type = (e.getAttribute('type') || '').toLowerCase();
      const isField = (tag === 'input' && !['submit', 'button', 'hidden', 'image', 'reset'].includes(type)) || tag === 'select' || tag === 'textarea';
      const role = e.getAttribute('role') || '';
      const kind = isField ? 'field' : (tag === 'button' || role === 'button' || type === 'submit' || type === 'button') ? 'button' : (tag === 'a' || role === 'link' || role === 'menuitem' || role === 'tab') ? 'link' : 'other';
      const ti = e.getAttribute('tabindex');
      const focusable = !e.disabled && !e.inert && (/^(a|button|select|textarea|summary)$/.test(tag) ? (tag !== 'a' || e.hasAttribute('href')) && !(ti !== null && +ti < 0) : tag === 'input' ? type !== 'hidden' && !(ti !== null && +ti < 0) : ti !== null && +ti >= 0);
      return { i, tag, kind, type, label: lab(e), aria: norm(e.getAttribute('aria-label') || e.title), flabel: isField ? flab(e) : '', href: tag === 'a' ? e.href : '', hash: tag === 'a' ? e.getAttribute('href') : '', inNav: !!e.closest('nav,[role=navigation],header'), visible: vis(e), focusable, disabled: !!e.disabled, top: Math.round(e.getBoundingClientRect().top + scrollY), form: e.form ? forms.indexOf(e.form) : -1, search: !!(e.form && (e.form.getAttribute('role') === 'search' || type === 'search')), options: tag === 'select' ? [...e.options].filter((o) => o.value).length : 0, name: e.name || '', required: !!e.required, checked: !!e.checked };
    });
  };
  window.__l = {
    items, q,
    // ms until the last finite animation ends (sync: page timers and promises do not run when JavaScript is disabled)
    animLeft: () => Math.max(0, ...document.getAnimations().map((a) => { try { const t = a.effect.getComputedTiming(); return t.iterations === Infinity ? 0 : t.endTime - (a.currentTime || 0); } catch { return 0; } })),
    infoPos: (src) => { const re = new RegExp(src, 'i'); const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (!re.test(n.textContent) || !n.parentElement || !vis(n.parentElement)) continue; const rg = document.createRange(); rg.selectNodeContents(n); const b = rg.getBoundingClientRect(); return { found: true, below: b.top > innerHeight }; } return { found: false }; },
    scrollY: () => Math.round(scrollY * 100) + ':' + Math.round(scrollX * 100),
    noscript: () => { const n = [...document.querySelectorAll('noscript')].find((e) => norm(e.textContent) && vis(e)); return n ? norm(n.textContent).slice(0, 80) : ''; },
    h1: () => { for (const h of document.querySelectorAll('h1')) if (vis(h) && norm(h.textContent)) return norm(h.textContent).slice(0, 80); return ''; },
    text: () => document.body ? document.body.innerText : '',
    live: () => [...document.querySelectorAll('[role=status],[role=alert],[aria-live]')].filter((e) => vis(e) && norm(e.textContent)).map((e) => norm(e.textContent)).join(' | '),
    state: () => ({ path: location.pathname, hash: location.hash, url: location.href, sw: document.documentElement.scrollWidth, iw: innerWidth, vh: innerHeight }),
    rect: (i) => {
      const el = q(i); el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { ok: false, cover: 'offscreen' };
      const vv = window.visualViewport || { scale: 1, offsetLeft: 0, offsetTop: 0 }; // mouse input is in visual-viewport pixels (pages wider than the screen get shrunk on mobile)
      const top = document.elementFromPoint(x, y); const ok = !!top && (el.contains(top) || top.contains(el));
      return { ok, x: (x - vv.offsetLeft) * vv.scale, y: (y - vv.offsetTop) * vv.scale, cover: top ? top.tagName.toLowerCase() + (top.className && typeof top.className === 'string' ? '.' + top.className.split(' ')[0] : '') : 'nothing' };
    },
    active: () => { const a = document.activeElement; const i = a && a.getAttribute ? a.getAttribute('data-lp') : null; return { i: i === null ? -1 : +i, tag: a ? a.tagName : '' }; },
    reset: () => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); },
    // valid sample data per control type, honouring min/max/step/maxlength; mode says how a visitor would enter it
    sample: (i) => {
      const e = q(i), t = (e.getAttribute('type') || '').toLowerCase(), p2 = (n) => String(n).padStart(2, '0');
      const clamp = (v, lo, hi) => (lo && v < lo ? lo : hi && v > hi ? hi : v);
      const day = new Date(Date.now() + 86400000), iso = day.getFullYear() + '-' + p2(day.getMonth() + 1) + '-' + p2(day.getDate());
      const lim = (s) => (e.maxLength > 0 ? s.slice(0, e.maxLength) : s);
      if (e.tagName === 'SELECT') return { mode: 'set' };
      if (t === 'file') return { mode: 'skip', note: 'file upload' };
      if (t === 'radio') return { mode: e.checked || [...document.getElementsByName(e.name)].some((r) => r.checked) ? 'skip' : 'click', note: '' };
      if (t === 'checkbox') return { mode: e.required && !e.checked ? 'click' : 'skip', note: '' };
      if (t === 'date') return { mode: 'set', value: clamp(iso, e.min, e.max) };
      if (t === 'time') return { mode: 'set', value: clamp('10:00', e.min, e.max) };
      if (t === 'datetime-local') return { mode: 'set', value: clamp(iso + 'T10:00', e.min, e.max) };
      if (t === 'month') return { mode: 'set', value: clamp(iso.slice(0, 7), e.min, e.max) };
      if (t === 'week') return { mode: 'set', value: e.min || '2030-W03' };
      if (t === 'color') return { mode: 'set', value: '#6b4ba3' };
      if (t === 'number' || t === 'range') { const lo = e.min === '' ? null : +e.min, hi = e.max === '' ? null : +e.max; let v = lo !== null ? lo : hi !== null ? Math.min(1, hi) : 1; if (t === 'range') v = lo !== null && hi !== null ? lo + Math.floor((hi - lo) / 2) : v; const st = +e.step; if (st > 0 && lo !== null && t === 'range') v = lo + Math.round((v - lo) / st) * st; return { mode: 'set', value: String(v) }; }
      if (t === 'email') return { mode: 'type', value: lim('name@example.test') };
      if (t === 'tel') return { mode: 'type', value: lim('5551234567') };
      if (t === 'url') return { mode: 'type', value: lim('https://example.test') };
      if (t === 'password') return { mode: 'type', value: lim('Test-only-pass-1!') };
      const n = (flab(e) + ' ' + (e.name || '')).toLowerCase();
      return { mode: 'type', value: lim(/name/.test(n) ? 'Sam Visitor' : /zip|postal/.test(n) ? '12345' : 'Hello, this is a simulated test message.') };
    },
    hid: () => { document.querySelectorAll('[hidden]').forEach((e, k) => e.setAttribute('data-lph', k)); },
    unhid: () => [...document.querySelectorAll('[data-lph]')].filter((e) => !e.hidden && vis(e) && norm(e.textContent)).map((e) => norm(e.textContent)).join(' | '),
    set: (i, v) => { const e = q(i); if (e.tagName === 'SELECT') { const o = [...e.options].find((x) => x.value) || e.options[0]; if (o) e.value = o.value; } else if (v !== undefined) e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
    validity: (f) => { const form = document.forms[f]; if (!form || form.checkValidity()) return ''; const e = [...form.elements].find((x) => x.willValidate && !x.checkValidity()); return (e ? flab(e) + ': ' + e.validationMessage : 'invalid'); },
  };
}
const HSRC = `(${helperFn.toString()})();`;

// ---------- personas, tasks, seeded draw ----------
const SLOW3G = { offline: false, latency: 400, downloadThroughput: 51200, uploadThroughput: 25600 };
const PERSONAS = [
  { id: 'mobile-3g', name: 'first-time mobile visitor, slow 3G', w: 375, h: 667, dpr: 2, mobile: true, net: SLOW3G, method: 'dom', budget: 12, load: 15000 },
  { id: 'skimmer', name: 'desktop skimmer (headings and links only)', w: 1280, h: 800, method: 'skim', budget: 10, skip: ['form'] },
  { id: 'keyboard', name: 'keyboard-only user (Tab/Enter)', w: 1280, h: 800, method: 'keyboard', budget: 60, tabs: 40 },
  { id: 'screen-reader', name: 'screen-reader proxy (role + accessible name)', w: 1280, h: 800, method: 'ax', budget: 12 },
  { id: 'low-vision', name: 'low-vision user (320x640, 200% zoom)', w: 320, h: 640, dpr: 2, mobile: true, zoom: true, reflow: true, method: 'dom', budget: 14 },
  { id: 'reduced-motion', name: 'reduced-motion user', w: 1280, h: 800, motion: true, method: 'dom', budget: 12 },
  { id: 'no-js', name: 'JavaScript-disabled visitor', w: 1280, h: 800, nojs: true, method: 'dom', budget: 12 },
  { id: 'impatient', name: 'impatient returning visitor', w: 1280, h: 720, method: 'dom', budget: 3, fold: true, only: ['contact', 'info'] },
  { id: 'small-phone', name: 'small-phone 320 px visitor', w: 320, h: 568, dpr: 2, mobile: true, reflow: true, method: 'dom', budget: 12 },
];
const TASKS = { offer: 'understand the offer', contact: 'find a way to contact/buy/book', nav: 'reach every top-nav page', form: 'complete the main form', info: 'find opening hours or a price' };
const RE_CONTACT = /\b(contact|buy|order|book|pricing|plan|trial|quote|shop|menu|class|project|visit)(s|es|ing)?\b/i;
const RE_CONTACT2 = /\b(contact|e-?mail|support|help|write to us|get in touch)\b/i; // for the other screens of a hash-route app
const RE_INFO = /[$€£]\s?\d|\b(opening hours|hours of operation|open (daily|mon|tue|every))\b|\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*[-–—:]\s*(mon|tue|wed|thu|fri|sat|sun|\d)/i;
const RE_OK = /thank|sent|received|success|submitted|we.ll (be in touch|get back)|confirm/i;
function rng(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(SEED);
const order = PERSONAS.map((p, i) => [rand(), i]).sort((a, b) => a[0] - b[0]).map((x) => PERSONAS[x[1]]); // first 9 sessions cover every persona
const SESSIONS = Array.from({ length: VISITORS }, (_, i) => (i < order.length ? order[i] : PERSONAS[Math.floor(rand() * PERSONAS.length)]));
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

class Fail extends Error {}
class NA extends Fail {} // the persona's method does not apply: recorded as not applicable, not as a failure
const fail = (m) => { throw new Fail(m); };

// ---------- one session ----------
const shotDir = join(root, '.lilac', 'personas');
const shotted = new Set(); const groupsShot = []; // screenshot names by group key
async function session(persona, plan, salt) {
  const c = await openTab(); let loads = 0, starts = 0, status = 200, sameDoc = 0;
  c.on('Page.loadEventFired', () => loads++); c.on('Page.frameStartedLoading', () => starts++); c.on('Page.navigatedWithinDocument', () => sameDoc++);
  c.on('Network.responseReceived', (p) => { if (p.type === 'Document') status = p.response.status; });
  c.on('Fetch.requestPaused', (p) => { let ok = true; try { const u = new URL(p.request.url); ok = !/^https?:$/.test(u.protocol) || u.host === `127.0.0.1:${PORT}`; } catch {} c.send(ok ? 'Fetch.continueRequest' : 'Fetch.failRequest', ok ? { requestId: p.requestId } : { requestId: p.requestId, errorReason: 'BlockedByClient' }).catch(() => {}); });
  const results = [];
  try {
    for (const m of ['Page.enable', 'Network.enable', 'DOM.enable', 'Accessibility.enable']) await c.send(m);
    await c.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    const zf = persona.zoom ? 2 : 1; // shortcut: 200% zoom is emulated as a half-size layout viewport at double pixel ratio (same layout as browser zoom); CSS zoom broke mouse coordinates
    await c.send('Emulation.setDeviceMetricsOverride', { width: persona.w / zf, height: persona.h / zf, deviceScaleFactor: (persona.dpr ?? 1) * zf, mobile: !!persona.mobile });
    if (persona.net) await c.send('Network.emulateNetworkConditions', persona.net);
    if (persona.motion) await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (persona.nojs) await c.send('Emulation.setScriptExecutionDisabled', { value: true });
    const ev = async (expr) => { const r = await c.send('Runtime.evaluate', { expression: HSRC + ';' + expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] ?? r.exceptionDetails.text); return r.result.value; };
    const LOAD = persona.load ?? 8000;
    const until = async (cond, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await cond()) return true; await sleep(50); } return false; };
    const S = { steps: 0, page: '/', persona, budget: persona.budget };
    const step = () => { if (++S.steps > S.budget) fail(`step budget of ${S.budget} used up`); };
    const key = async (k, code, vk, text) => { await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); };
    const settle = async (l0, s0, d0) => { await sleep(120); if (starts > s0 && loads === l0 && sameDoc === d0) { if (!(await until(() => loads > l0, LOAD))) fail(`page did not finish loading within ${LOAD / 1000}s`); } await S.anim(); const st = await ev('__l.state()').catch(() => ({ path: S.page })); S.page = st.path ?? S.page; };
    S.go = async (path) => { const l0 = loads, d0 = sameDoc; status = 200; await c.send('Page.navigate', { url: BASE + path }); if (!(await until(() => loads > l0 || sameDoc > d0, LOAD))) fail(`${path} did not finish loading within ${LOAD / 1000}s${persona.net ? ' on slow 3G' : ''}`); await S.anim(); S.page = path.split('#')[0].split('?')[0]; if (status >= 400) fail(`${path} returned HTTP ${status}`); };
    S.anim = async () => { const end = Date.now() + (persona.net ? 5000 : 3000); let quiet = 0; while (Date.now() < end && quiet < 2) { const ms = await ev('__l.animLeft()').catch(() => 0); if (ms <= 0) { quiet++; await sleep(120); } else { quiet = 0; await sleep(Math.min(ms, end - Date.now()) + 50); } } };
    // a visitor scrolls: scroll through the page so reveal-on-scroll content can appear (content that stays invisible still fails)
    S.reveal = async () => { const h = await ev('document.documentElement.scrollHeight').catch(() => 0), vh = persona.h; for (let y = 0; y < h; y += Math.max(100, vh * 0.7)) { await ev(`scrollTo({top:${y},behavior:'instant'})`).catch(() => {}); await sleep(120); } await ev("scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})").catch(() => {}); await S.anim(); await ev("scrollTo({top:0,behavior:'instant'})").catch(() => {}); };
    S.items = () => ev('__l.items()');
    S.text = () => ev('__l.text()');
    S.ev = ev;
    const wrapAct = async (fn) => { const l0 = loads, s0 = starts, d0 = sameDoc; await fn(); await settle(l0, s0, d0); const st = await ev('__l.state()').catch(() => ({ url: '' })); if (status >= 400) fail(`${S.page} returned HTTP ${status}`); return st; };
    // method primitives: reach(item) proves the persona can get to the control; act(item) triggers it
    const axMap = async () => {
      const { nodes } = await c.send('Accessibility.getFullAXTree'); await c.send('DOM.getDocument', { depth: 0 }); const m = new Map();
      for (const n of nodes) {
        if (n.ignored || !n.backendDOMNodeId || /^(generic|none|presentation|StaticText|text|InlineTextBox|LineBreak|paragraph|RootWebArea|WebArea|LabelText|Section|group)$/.test(n.role?.value ?? 'none')) continue;
        try { const a = (await c.send('DOM.describeNode', { backendNodeId: n.backendDOMNodeId })).node.attributes ?? []; const k = a.indexOf('data-lp'); if (k >= 0) m.set(+a[k + 1], { role: n.role.value, name: (n.name?.value ?? '').trim() }); } catch {}
      }
      return m;
    };
    const tag = (it) => `<${it.tag}>`;
    const M = {
      async reach(it, pred) {
        const nm = `"${it.label || it.flabel || it.href || it.tag}"`;
        if (persona.method === 'keyboard') {
          if (!it.focusable) fail(`${nm} is not keyboard-focusable (${tag(it)} with a mouse handler, not a link or button): Tab never reaches it`);
          await ev('__l.reset()'); const seen = new Set(); let last = -2;
          for (let n = 0; n < persona.tabs + 8; n++) { // date and time controls take several Tab stops each
            step(); await key('Tab', 'Tab', 9); const a = await ev('__l.active()');
            if (a.i === it.i) { if (!it.visible) fail(`${nm} gets focus but is not visible`); return; }
            if (a.i !== last && a.i >= 0 && seen.has(a.i)) break; last = a.i; if (a.i >= 0) seen.add(a.i);
          }
          fail(`${nm} not reached with Tab within ${persona.tabs} presses`);
        }
        if (persona.method === 'ax') {
          const n = (await axMap()).get(it.i);
          if (!n) fail(`${nm} is not exposed to assistive technology as a control (${tag(it)} without a role)`);
          if (!n.name) fail(`${n.role} ${nm} has no accessible name`);
          if (pred && !pred.test(n.name)) fail(`accessible name "${n.name}" does not say what the control does`);
          return;
        }
        if (persona.method === 'skim' && it.kind !== 'link') throw new NA(`${nm} is a ${it.kind === 'other' ? 'script-only element' : it.kind}: a skimmer reads headings and links only`);
        if (it.disabled) fail(`${nm} is disabled`);
        if (!it.visible) fail(`${nm} exists but is hidden`);
        let r = await ev(`__l.rect(${it.i})`); let prev = ''; for (let k = 0; k < 20; k++) { const y = await ev('__l.scrollY()'); if (y === prev) break; prev = y; await sleep(50); } // wait for scrolling to end, then hit-test
        r = await ev(`__l.rect(${it.i})`); if (!r.ok) fail(`${nm} is covered by ${r.cover}`); S.pt = r;
      },
      async act(it) {
        step();
        return wrapAct(async () => {
          if (persona.method === 'keyboard') return key('Enter', 'Enter', 13, '\r');
          if (persona.method === 'ax') return ev(`__l.q(${it.i}).click()`);
          const { x, y } = S.pt;
          await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
        });
      },
      async fill(it, val) {
        await M.reach(it);
        if (it.tag === 'select') { step(); return ev(`__l.set(${it.i})`); }
        if (it.type === 'checkbox' || it.type === 'radio') { if (persona.method === 'keyboard') { step(); return key(' ', 'Space', 32, ' '); } return M.act(it); }
        if (persona.method === 'ax' || persona.method === 'keyboard') { if (persona.method === 'ax') { step(); await ev(`__l.q(${it.i}).focus()`); } } else await M.act(it);
        step(); await c.send('Input.insertText', { text: val });
      },
    };
    // pick the persona's candidates among page items; a hit needs only one reachable control
    const reachAny = async (cands, pred, what) => { let first = null; for (const it of cands.slice(0, 3)) { try { await M.reach(it, pred); return it; } catch (e) { if (!(e instanceof Fail)) throw e; first ??= e; } } throw first ?? new Fail(what); };
    const openMenu = async (its) => { const b = its.find((i) => i.visible && i.kind !== 'field' && /menu|navigation|toggle|open/i.test(i.label + ' ' + i.flabel)); if (!b) return false; await M.reach(b); await M.act(b); return true; };
    // a page may still be mid-navigation or mid-fade when listed: retry the lookup before calling a control missing
    const findItem = async (l) => { let its; for (let k = 0; k < 4; k++) { await until(() => ev('document.readyState').then((r) => r === 'complete').catch(() => false), LOAD); await S.anim(); its = await S.items().catch(() => []); const it = its.find(nameEq(l)); if (it) return { its, it }; await sleep(400); } return { its, it: null }; };
    const nameEq = (l) => (i) => i.label === l && i.kind !== 'field';
    // after a click, a page may fade out before it navigates: wait up to 3 s for the URL to change
    const waitMoved = async (before) => { let cur = before; await until(async () => { const s = await ev('__l.state()').catch(() => null); if (s) cur = s; return s && (s.path !== before.path || s.hash !== before.hash || /^chrome-error/.test(s.url)); }, 3000); if (cur.path !== before.path) { await until(() => ev('document.readyState').then((r) => r === 'complete').catch(() => false), LOAD); await S.anim(); const s = await ev('__l.state()').catch(() => cur); S.page = s.path; return s; } return cur; };
    const TASK = {
      async offer() { await S.go('/'); if (!(await ev('__l.h1()'))) { const ns = persona.nojs ? await ev('__l.noscript()') : ''; if (!ns) fail(`no visible h1 with text on /${persona.nojs ? ' (it may need JavaScript)' : ''}`); return `JavaScript is off: the page shows its noscript message ("${ns.slice(0, 40)}")`; } if (persona.reflow) { const s = await ev('__l.state()'); if (s.sw > s.iw + 2) fail('content needs sideways scrolling at this width'); } },
      async contact() {
        await S.go('/'); const its = await S.items();
        const find = (list, re) => list.filter((i) => i.kind !== 'field' && (re.test(i.label) || /^(mailto|tel):/.test(i.href)));
        const m0 = find(its, RE_CONTACT); let m = m0.filter((i) => i.visible), searched = 1; // a hidden match on this screen may live behind another route
        if (!m.length) { // single-document app: look through every screen reachable by hash links
          const hl = its.filter((i) => i.kind === 'link' && i.visible && /^#/.test(i.hash ?? '')).filter((i, k, a) => a.findIndex((x) => x.label === i.label) === k).slice(0, 6);
          for (const h of hl) {
            S.steps = 0; await S.go('/'); const cur = await findItem(h.label); if (!cur.it) continue;
            try { await M.reach(cur.it); await M.act(cur.it); } catch (e) { if (e instanceof Fail) continue; throw e; }
            searched++;
            const found = find(await S.items(), RE_CONTACT2).filter((i) => i.label !== h.label); if (found.length) { m = found; break; } // found excludes the link we just used
          }
        }
        if (!m.length && m0.length) m = m0;
        if (!m.length) fail(`no link or button on ${searched > 1 ? searched + ' screens' : '/'} says contact, buy, book, order, pricing, plan, trial, quote, shop, menu, classes, projects, visit${searched > 1 ? ', email, support or help' : ''}`);
        m.sort((a, b) => b.visible - a.visible || a.top - b.top);
        const it = await reachAny(m, null); const st = await M.act(it);
        if (/^chrome-error/.test(st.url ?? '') || /^(mailto|tel):/.test(it.href)) return; // external or mail target: reached, destination not checkable offline
      },
      async nav() {
        // each session checks up to 4 nav pages (rotating by session number), so 100 sessions cover all of them without a 20 s task
        const k = Math.min(4, plan.nav.length); for (const n of Array.from({ length: k }, (_, j) => plan.nav[(salt * k + j) % plan.nav.length])) {
          S.steps = 0; await S.go('/'); let { its, it } = await findItem(n.label);
          if (!it) fail(`nav item "${n.label}" is missing on /`);
          if (!it.visible && (await openMenu(its))) { its = await S.items(); it = its.find(nameEq(n.label)) ?? it; }
          try { await M.reach(it); } catch (e) { throw e instanceof Fail ? new Fail(`nav item "${n.label}": ${e.message}`) : e; }
          const before = await ev('__l.state()'); let st = await M.act(it);
          const self = n.href && (n.href === before.path + before.hash || (!n.href.includes('#') && before.path === '/' && n.href === '/index.html') || n.href === before.path); // a link to the page you are on is fine
          if (self) { await sleep(400); await until(() => ev('document.readyState').then((r) => r === 'complete').catch(() => false), LOAD); } else if (st.path === before.path && st.hash === before.hash) st = await waitMoved(before);
          if (!self && !/^chrome-error/.test(st.url) && st.path === before.path && st.hash === before.hash) fail(`nav item "${n.label}" did not go anywhere`);
        }
      },
      async form() {
        await S.go(plan.form.page); let its = await S.items(); const pick = () => its.filter((i) => i.kind === 'field' && i.form === plan.form.idx && i.visible); let fs = pick(); if (!fs.length) { await S.reveal(); its = await S.items(); fs = pick(); }
        if (!fs.length && process.env.PERSONA_DEBUG) console.error(JSON.stringify(its.filter((i) => i.kind === 'field' || i.form >= 0).map((i) => [i.tag, i.flabel, i.form, i.visible])));
        if (!fs.length) fail('the form fields are not visible' + (persona.nojs ? ' (they may need JavaScript)' : ''));
        const unver = [];
        for (const f of fs) {
          const sm = await ev(`__l.sample(${f.i})`); const nm = f.flabel || f.name || f.tag;
          try {
            if (sm.mode === 'skip') { if (f.type === 'file') { if (f.required) fail('a required file upload cannot be completed offline (UNVERIFIED)'); unver.push(`file field "${nm}" skipped (UNVERIFIED)`); } continue; }
            if (sm.mode === 'set') { await M.reach(f); step(); await ev(`__l.set(${f.i}, ${JSON.stringify(sm.value ?? null)})`); } // shortcut: native date/time/number/select pickers are set by script with events, not by keystrokes
            else await M.fill(f, sm.value ?? '');
          } catch (e) { throw e instanceof Fail && !e.message.includes(nm) ? new Fail(`field "${nm}" (${f.type || f.tag}): ${e.message}`) : e; }
          S.page = plan.form.page;
        }
        const bad = await ev(`__l.validity(${plan.form.idx})`); if (bad) fail(`form rejected the sample data (${bad.slice(0, 60)})`);
        const before = await S.text(); const startPath = (await ev('__l.state()')).path; await ev('__l.hid()'); const sub = its.find((i) => i.form === plan.form.idx && i.kind === 'button' && !i.disabled);
        if (!sub) { step(); await wrapAct(() => key('Enter', 'Enter', 13, '\r')); } else { await M.reach(sub); await M.act(sub); }
        const ERR = /error|invalid|required|please (enter|fill|select|choose|pick)|must |failed|not valid|try again|pick a/i;
        const lines = new Set(before.split('\n').map((x) => x.trim()));
        const okNow = async () => {
          const t = await S.text().catch(() => ''); const l = await ev('__l.live()').catch(() => ''); const h = await ev('__l.unhid()').catch(() => ''); const st = await ev('__l.state()').catch(() => ({ path: startPath }));
          if (RE_OK.test(t) && !RE_OK.test(before)) return true;
          if (h && !ERR.test(h)) return true;
          if (l && !before.includes(l) && !ERR.test(l)) return true;
          return st.path !== startPath && !ERR.test(t) && t.split('\n').some((x) => x.trim().length > 2 && !lines.has(x.trim()));
        };
        if (!(await until(okNow, 3000))) { const err = (await ev('__l.live()').catch(() => '')) || ''; fail(err && ERR.test(err) ? `the form showed "${err.slice(0, 50)}" instead of confirming` : 'no visible feedback within 3 s after submitting (no status, new text, thank-you page or revealed element)'); }
        return unver.length ? unver.join('; ') : undefined;
      },
      async info() {
        await S.go('/'); const i = plan.info;
        let before = null; if (i.nav) { let { its, it } = await findItem(i.nav); if (!it) fail(`"${i.nav}" is missing on /`); if (!it.visible && (await openMenu(its))) { its = await S.items(); it = its.find(nameEq(i.nav)) ?? it; } await M.reach(it); before = await ev('__l.state()'); const st = await M.act(it); if (st.path === before.path && st.hash === before.hash) await waitMoved(before); }
        const look = () => ev(`__l.infoPos(${JSON.stringify(RE_INFO.source)})`); let pos = { found: false };
        await until(async () => (pos = await look()).found, persona.net ? 6000 : 3000); // late fades on slow connections
        if (!pos.found) { await S.reveal(); pos = await look(); }
        if (!pos.found) fail('the price or opening hours are not visible on the page where they should be');
        return pos.below ? 'price or opening hours present but below the fold' : undefined;
      },
    };
    const custom = async (ct) => {
      await S.go(ct.startPage ?? '/');
      for (const st of ct.steps ?? []) {
        if (st.click != null) { const its = await S.items(); const m = its.filter((i) => i.kind !== 'field' && (i.label + ' ' + i.aria).toLowerCase().includes(String(st.click).toLowerCase())).sort((a, b) => b.visible - a.visible); if (!m.length) fail(`nothing to click that says "${st.click}"`); const it = await reachAny(m, null); await M.act(it); }
        else if (st.type != null) { const its = await S.items(); const f = its.find((i) => i.kind === 'field' && i.flabel.toLowerCase().includes(String(st.type).toLowerCase())); if (!f) fail(`no field called "${st.type}"`); await M.fill(f, String(st.text ?? '')); }
        else if (st.expectText != null) { if (!(await until(async () => (await S.text()).toLowerCase().includes(String(st.expectText).toLowerCase()), 1500))) fail(`text "${st.expectText}" not shown`); }
      }
    };
    const list = [...Object.keys(TASK).filter((t) => plan.applicable[t] && !(persona.skip ?? []).includes(t) && (!persona.only || persona.only.includes(t))).map((t) => [t, TASK[t]]),
      ...(persona.only ? [] : plan.custom.filter((ct) => !ct.personas || ct.personas.includes(persona.id)).map((ct) => ['custom:' + ct.name, () => custom(ct)]))];
    for (const [id, fn] of list) {
      const t0 = Date.now(); S.steps = 0; S.page = '/'; let reason = '', ok = false;
      let note; try { note = await fn(); ok = true; } catch (e) { if (e instanceof NA) { results.push({ task: id, na: true }); continue; } reason = e instanceof Fail ? e.message : 'browser error: ' + String(e.message).slice(0, 80); }
      const r = { task: id, ok, steps: S.steps, ms: Date.now() - t0, reason, page: S.page, note };
      if (!ok) { r.key = [id, persona.id, r.page, reason].join('|'); if (!shotted.has(r.key)) { shotted.add(r.key); r.shot = 'fail-' + createHash('sha1').update(r.key).digest('hex').slice(0, 8) + '.png'; try { mkdirSync(shotDir, { recursive: true }); writeFileSync(join(shotDir, r.shot), Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); } catch { delete r.shot; } } }
      if (process.env.PERSONA_DEBUG) console.error(`[${persona.id}] ${id} ${r.ok ? 'ok' : 'FAIL ' + reason} ${r.ms}ms ${r.steps} steps`);
      results.push(r);
    }
  } catch (e) { results.push({ task: 'session', ok: false, steps: 0, ms: 0, reason: 'browser error: ' + String(e.message).slice(0, 80), page: '/' }); }
  await c.close(); return results;
}

// ---------- prescan: what does the site offer (nav, form, price/hours)? ----------
async function prescan() {
  const plan = { nav: [], form: null, info: null, custom: [], applicable: {} };
  const c = await openTab(); let loads = 0, sd = 0; c.on('Page.loadEventFired', () => loads++); c.on('Page.navigatedWithinDocument', () => sd++); await c.send('Page.enable'); await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  const ev = async (e) => (await c.send('Runtime.evaluate', { expression: HSRC + ';' + e, returnByValue: true, awaitPromise: true })).result.value;
  const go = async (p) => { const l = loads, d = sd; await c.send('Page.navigate', { url: BASE + p }); for (let i = 0; i < 100 && loads === l && sd === d; i++) await sleep(50); let q = 0; for (let i = 0; i < 40 && q < 2; i++) { const ms = await ev('__l.animLeft()').catch(() => 0); if (ms <= 0) { q++; await sleep(120); } else { q = 0; await sleep(Math.min(ms, 3000) + 50); } } };
  await go('/'); const its = await ev('__l.items()');
  const seen = new Set();
  for (const i of its) if (i.inNav && i.visible && i.kind !== 'field' && i.label && !seen.has(i.label) && (!i.href || i.href.startsWith(BASE))) { seen.add(i.label); plan.nav.push({ label: i.label, href: i.href ? i.href.slice(BASE.length) || '/' : '' }); }
  plan.nav = plan.nav.slice(0, 8);
  const pages = [{ path: '/', nav: '' }, ...plan.nav.filter((n) => n.href && n.href.split('#')[0] !== '/' && !n.href.startsWith('/#')).map((n) => ({ path: n.href.split('#')[0], nav: n.label }))];
  const done = new Set();
  for (const p of pages) {
    if (done.has(p.path)) continue; done.add(p.path); await go(p.path);
    const t = await ev('__l.text()'), pi = await ev('__l.items()');
    if (!plan.info && RE_INFO.test(t)) plan.info = { nav: p.nav };
    if (!plan.form) { const f = pi.find((i) => i.kind === 'field' && i.visible && i.form >= 0 && !i.search); if (f) plan.form = { page: p.path, idx: f.form }; }
  }
  await c.close();
  const cf = join(root, '.lilac', 'personas.json');
  if (existsSync(cf)) { try { const j = JSON.parse(readFileSync(cf, 'utf8')); plan.custom = (Array.isArray(j) ? j : j.tasks ?? []).filter((t) => t && t.name && Array.isArray(t.steps)); } catch (e) { console.error('persona-test: .lilac/personas.json ignored: ' + e.message); } }
  plan.applicable = { offer: true, contact: true, nav: plan.nav.length > 0, form: !!plan.form, info: !!plan.info };
  return plan;
}

// ---------- run ----------
const plan = await prescan();
try { for (const f of readdirSync(shotDir)) if (/^fail-.*\.png$/.test(f)) rmSync(join(shotDir, f)); } catch {}
const all = new Array(SESSIONS.length); let ran = SESSIONS.length, reduced = '', finished = 0; const tRun = Date.now();
// slow-3G sessions run after the others: Chrome's network throttling bleeds into tabs that run at the same time
const lanes = [SESSIONS.map((p, i) => i).filter((i) => !SESSIONS[i].net), SESSIONS.map((p, i) => i).filter((i) => SESSIONS[i].net)];
for (const lane of lanes) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, lane.length) }, async () => {
    while (next < lane.length) {
      const i = lane[next++];
      if (i >= ran || Date.now() - T0 > CAP - 45000) { reduced ||= `stopped early: 10 minute cap`; continue; }
      const lost = (m) => [{ task: 'session', ok: false, steps: 0, ms: 0, reason: 'browser error: ' + m, page: '/' }]; // a stuck or crashed tab must not hang the run
      all[i] = await Promise.race([session(SESSIONS[i], plan, i).catch((e) => lost(String(e.message).slice(0, 60))), sleep(150000).then(() => lost('session timed out'))]);
      if (++finished === 12) { const avg = (Date.now() - tRun) / 12; if (avg * SESSIONS.length > CAP * 0.6) { ran = Math.max(12, Math.floor((CAP * 0.6) / avg)); reduced = `reduced to the first ${ran} of ${SESSIONS.length} sessions (slow site: 10 minute cap)`; } }
    }
  }));
}
const done = all.map((r, i) => r && { persona: SESSIONS[i], res: r }).filter(Boolean);

// ---------- report ----------
const rate = (o, a) => (a ? Math.round((o / a) * 100) : 0);
const byP = {}, byT = {}, groups = new Map(); let okAll = 0, attAll = 0; const notes = {}; const mix = {};
for (const p of PERSONAS) { byP[p.id] = { name: p.name, sessions: 0, attempts: 0, ok: 0, rate: 0, medianSteps: 0, tasks: {}, _s: [], _m: [] }; mix[p.id] = 0; }
for (const { persona, res } of done) {
  const P = byP[persona.id]; P.sessions++; mix[persona.id]++;
  for (const r of res) {
    if (r.na) continue;
    const tk = r.task.startsWith('custom:') ? r.task : r.task; const T = (byT[tk] ??= { attempts: 0, ok: 0, rate: 0, medianSteps: 0, _s: [], _m: [] });
    P.attempts++; T.attempts++; attAll++; P.tasks[tk] ??= { attempts: 0, ok: 0 }; P.tasks[tk].attempts++; P._s.push(r.steps); T._s.push(r.steps); P._m.push(r.ms); T._m.push(r.ms);
    if (r.note) notes[r.note] = (notes[r.note] ?? 0) + 1;
    if (r.ok) { P.ok++; T.ok++; okAll++; P.tasks[tk].ok++; } else { const g = groups.get(r.key ?? [r.task, persona.id, r.page, r.reason].join('|')) ?? { task: tk, persona: persona.id, page: r.page, reason: r.reason, count: 0, step: r.steps, screenshot: null }; g.count++; if (r.shot) g.screenshot = `.lilac/personas/${r.shot}`; groups.set(r.key ?? [r.task, persona.id, r.page, r.reason].join('|'), g); }
  }
}
const timing = {};
for (const [k, o] of [...Object.entries(byP), ...Object.entries(byT)]) { o.rate = rate(o.ok, o.attempts); o.medianSteps = median(o._s); timing[k] = Math.round(median(o._m)); delete o._s; delete o._m; }
const overall = rate(okAll, attAll);
const G = [...groups.values()].sort((a, b) => b.count - a.count || (a.task + a.persona + a.reason).localeCompare(b.task + b.persona + b.reason));
const sessionsRun = done.length;
const failing = [overall < MIN_OVERALL && `overall ${overall}% is below ${MIN_OVERALL}%`, ...Object.entries(byP).filter(([, o]) => o.sessions && o.rate < MIN_PERSONA).map(([k, o]) => `${k} ${o.rate}% is below ${MIN_PERSONA}%`)].filter(Boolean);
const last = `persona-test: ${sessionsRun} simulated visitors, ${overall}% tasks completed, ${G.length} failure group(s)`;
if (json) {
  console.log(JSON.stringify({ disclaimer: DISCLAIMER, seed: SEED, sessions: sessionsRun, reduced: reduced || undefined, applicable: plan.applicable, mix, overall: { attempts: attAll, ok: okAll, rate: overall }, byPersona: byP, byTask: byT, notes,
 groups: G.slice(0, 50), thresholds: { overall: MIN_OVERALL, persona: MIN_PERSONA }, failing }, null, 2));
} else {
  const L = [`persona-test: ${DISCLAIMER}`, `seed ${SEED}; ${sessionsRun} sessions on ${BASE.replace(/:\d+/, ':<port>')} (site folder ${site === root ? '.' : site.slice(root.length + 1)})${reduced ? '; ' + reduced : ''}`,
    `tasks not applicable to this site: ${Object.entries(plan.applicable).filter(([, v]) => !v).map(([k]) => k).join(', ') || 'none'}`, '', 'completion by persona (sessions, tasks done, median steps, median ms):'];
  for (const [k, o] of Object.entries(byP)) if (o.sessions) L.push(`  ${o.name.padEnd(48)} ${String(o.sessions).padStart(3)} sess  ${String(o.rate).padStart(3)}% (${o.ok}/${o.attempts})  steps ${o.medianSteps}  ${timing[k]} ms`);
  L.push('', 'completion by task:');
  for (const [k, o] of Object.entries(byT)) L.push(`  ${(TASKS[k] ?? k).padEnd(48)} ${String(o.rate).padStart(3)}% (${o.ok}/${o.attempts})  steps ${o.medianSteps}  ${timing[k]} ms`);
  L.push('', G.length ? `worst failures (${Math.min(5, G.length)} of ${G.length} group(s)):` : 'no failures.');
  G.slice(0, 5).forEach((g, i) => L.push(`  ${i + 1}. task "${TASKS[g.task] ?? g.task}" | persona ${g.persona} | page ${g.page} | step ${g.step} | ${g.count} session(s)`, `     why: ${g.reason}`, g.screenshot ? `     screenshot: ${g.screenshot}` : '     screenshot: none'));
  for (const [k, v] of Object.entries(notes)) L.push('', `note: ${k} (${v} session(s)), counted as a pass`);
  if (failing.length) L.push('', 'FAIL: ' + failing.join('; '));
  L.push('', 'Reminder: these were simulated visitors. Real feedback needs real people.', last);
  console.log(L.join('\n'));
}
cleanup();
process.exit(failing.length ? 1 : 0);
