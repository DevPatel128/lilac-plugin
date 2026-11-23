#!/usr/bin/env node
// NETWORK TOOL: only runs on a URL the user passes. It never runs at install, never in hooks, never on its own.
// Lilac monitor: care for a site after launch.
// Usage: node scripts/monitor.mjs links <url-or-dir> [--max-pages 50] [--max-depth 3] [--max-external 20] [--delay 250] [--slow-ms 2000] [--timeout 10000] [--project <dir>]
//        node scripts/monitor.mjs uptime <url> [--project <dir>] [--slow-ms 2000]   status, time, TLS days left, key text from .lilac/monitor.json {"keyText":[...]}
//        node scripts/monitor.mjs budget <dir>                                       page weight, request count and (with Chrome) LCP/CLS/INP vs .lilac/budget.json
// budget measures a LOCAL folder only (no URL is loaded): Chrome may reach only its own loopback server, every other request is blocked and listed;
//   Chrome keeps its sandbox (LILAC_CHROME_NO_SANDBOX=1 only for root containers), talks over a pipe and uses a fresh 0700 profile dir.
// links on a URL: crawls ONLY the origin you pass (a redirect to another origin is refused), obeys robots.txt, sends user agent LilacMonitor/0.1,
//   stops at the page and depth caps, waits --delay ms between pages. External links are checked with HEAD then GET, never more than 1 request per second, capped.
//   links on a folder reads files only and makes no request.
// budget defaults: 300 KB per page (uncompressed bytes on disk, KB = 1024), LCP <= 2.5 s, CLS <= 0.1, INP <= 200 ms.
//   Thresholds: https://web.dev/articles/vitals (read 2026-11-22; "good" at the 75th percentile). Chrome runs with 4x CPU slowdown and 1.6 Mbit/s, 150 ms latency
//   (these numbers are Lilac's choice for a slow phone, not a web.dev rule). One headless run is an ESTIMATE, not field data (UNVERIFIED as real-user numbers).
// Dependency-free: node built-ins only, plus the local Chrome if one exists. Output never prints query strings or secret-looking values.
// shortcut: robots.txt handling is User-agent * Disallow prefixes only; upgrade to full parsing if a site needs Allow rules or wildcards.
// shortcut: external redirects count as OK (3xx is not followed); upgrade if redirect chains matter.
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, rmSync, realpathSync, chmodSync, mkdirSync } from 'node:fs';
import { join, resolve, relative, extname, dirname, sep, normalize } from 'node:path';
import { createServer } from 'node:http';
import { connect } from 'node:tls';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { siteDir } from './preview.mjs';

const UA = 'LilacMonitor/0.1';
const SECRET = /(sk-[A-Za-z0-9]{20,}|sk[-_](?:live|test)[-_][A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.)/g;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => console.log(s.replace(SECRET, '[redacted]'));
const show = (u) => { try { const x = new URL(u); return x.origin + x.pathname + (x.search ? '?...' : ''); } catch { return String(u).replace(/[?#].*$/, ''); } };
const fail = (m) => { console.error(`monitor: ${m}`); process.exit(2); };
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };

const args = process.argv.slice(2), cmd = args[0], target = args[1];
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i > 0 ? args[i + 1] : d; };
const num = (n, d) => { const v = Number(flag(n, d)); return Number.isFinite(v) && v >= 0 ? v : d; };
const project = resolve(flag('project', '.'));

const hrefs = (html) => [...html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map((m) => (m[1] ?? m[2] ?? m[3]).trim()).filter((h) => h && !/^(#|mailto:|tel:|javascript:|data:)/i.test(h));

async function get(url, method = 'GET', timeout) {
  return fetch(url, { method, redirect: 'manual', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(timeout) });
}

// ---------- links on a live site ----------
async function linksLive(start) {
  let u; try { u = new URL(start); } catch { fail('not a URL'); }
  if (!/^https?:$/.test(u.protocol)) fail('only http and https URLs are crawled');
  const origin = u.origin, maxPages = num('max-pages', 50), maxDepth = num('max-depth', 3), maxExt = num('max-external', 20), delay = num('delay', 250), slowMs = num('slow-ms', 2000), timeout = num('timeout', 10000);
  const out = [], broken = [], slow = [], skipped = [], external = new Map();
  // robots.txt: User-agent * (or LilacMonitor) Disallow prefixes.
  let disallow = [];
  try { const r = await get(origin + '/robots.txt', 'GET', timeout); if (r.status === 200) { let on = false; for (const ln of (await r.text()).split(/\r?\n/)) { const m = ln.replace(/#.*/, '').match(/^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/); if (!m) continue; if (/^user-agent$/i.test(m[1])) on = m[2] === '*' || /lilacmonitor/i.test(m[2]); else if (on && /^disallow$/i.test(m[1]) && m[2]) disallow.push(m[2]); } } } catch {}
  const allowed = (p) => !disallow.some((d) => p.startsWith(d));
  const queue = [[origin + u.pathname + u.search, 0, '(start)']], seen = new Set([queue[0][0]]); let pages = 0, first = true;
  while (queue.length) {
    const [url, depth, from] = queue.shift();
    if (pages >= maxPages) { skipped.push(`NOT CHECKED (page cap ${maxPages}) ${show(url)}`); continue; }
    if (!allowed(new URL(url).pathname)) { skipped.push(`SKIPPED (robots.txt) ${show(url)}`); continue; }
    if (!first) await sleep(delay);
    let cur = url, r, t0 = Date.now();
    try {
      for (let hop = 0; hop < 5; hop++) {
        r = await get(cur, 'GET', timeout);
        if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
          const nx = new URL(r.headers.get('location'), cur);
          if (nx.origin !== origin) { say(`REFUSED: ${show(cur)} redirects to another origin (${nx.origin}). Only the origin you passed is crawled.`); if (first) process.exit(1); r = null; break; }
          cur = nx.href; continue;
        }
        break;
      }
    } catch (e) { r = null; broken.push(`BROKEN internal ${show(from)} -> ${show(url)} (${e.name === 'TimeoutError' ? 'timeout' : 'no answer'})`); }
    const ms = Date.now() - t0; first = false;
    if (!r) continue;
    pages++;
    if (r.status >= 400) { broken.push(`BROKEN internal ${show(from)} -> ${show(url)} (${r.status})`); continue; }
    if (ms > slowMs) slow.push(`SLOW ${show(url)} ${ms} ms (limit ${slowMs})`);
    if (!/html/i.test(r.headers.get('content-type') ?? '')) continue;
    const html = await r.text();
    for (const h of hrefs(html)) {
      let l; try { l = new URL(h, cur); } catch { continue; }
      if (!/^https?:$/.test(l.protocol)) continue;
      l.hash = '';
      if (l.origin === origin) { if (!seen.has(l.href) && depth + 1 <= maxDepth) { seen.add(l.href); queue.push([l.href, depth + 1, url]); } }
      else if (!external.has(l.href)) external.set(l.href, url);
    }
  }
  // external: HEAD then GET fallback, one request per second, capped.
  let n = 0, last = 0;
  const gap = async () => { const w = 1000 - (Date.now() - last); if (last && w > 0) await sleep(w); last = Date.now(); };
  for (const [l, from] of external) {
    if (n >= maxExt) { skipped.push(`NOT CHECKED (external cap ${maxExt}) ${show(l)}`); continue; }
    n++; let status = 0;
    try { await gap(); status = (await get(l, 'HEAD', timeout)).status; if (status >= 400) { await gap(); status = (await get(l, 'GET', timeout)).status; } } catch { try { await gap(); status = (await get(l, 'GET', timeout)).status; } catch { status = 0; } }
    if (status === 0 || status >= 400) broken.push(`BROKEN external ${show(from)} -> ${show(l)} (${status || 'no answer'})`);
  }
  out.push(...broken, ...slow, ...skipped);
  out.forEach(say);
  say(`monitor links: ${pages} page(s) crawled, ${n} external link(s) checked, ${broken.length} broken, ${slow.length} slow, ${skipped.length} skipped or not checked`);
  process.exit(broken.length ? 1 : 0);
}

// ---------- links in a folder ----------
function linksDir(dir) {
  const files = []; (function w(d) { for (const e of readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', '.lilac'].includes(e.name)) continue; const f = join(d, e.name); e.isDirectory() ? w(f) : files.push(f); } })(dir);
  const root = siteDir(dir) ?? dir, pages = files.filter((f) => /\.html?$/i.test(f) && f.startsWith(root)), bad = []; let ext = 0, total = 0;
  const exists = (p) => existsSync(p) && (statSync(p).isFile() || existsSync(join(p, 'index.html'))) || (!extname(p) && existsSync(p + '.html'));
  for (const f of pages) for (const h of hrefs(readFileSync(f, 'utf8'))) {
    if (/^(https?:)?\/\//i.test(h)) { ext++; continue; }
    total++; const p = decodeURIComponent(h.replace(/[?#].*$/, '')); if (!p) continue;
    const t = normalize(p.startsWith('/') ? join(root, p) : join(dirname(f), p));
    if (!t.startsWith(root) || !exists(t)) bad.push(`BROKEN internal ${relative(root, f)} -> ${p}`);
  }
  bad.forEach(say);
  say(`monitor links: ${pages.length} page(s) read, ${total} internal link(s), ${bad.length} broken. ${ext} external link(s) NOT checked: pass the live URL to check them.`);
  process.exit(bad.length ? 1 : 0);
}

// ---------- uptime ----------
async function uptime(url) {
  let u; try { u = new URL(url); } catch { fail('not a URL'); }
  if (!/^https?:$/.test(u.protocol)) fail('only http and https URLs');
  const mon = readJson(join(project, '.lilac/monitor.json')) ?? {}, slowMs = num('slow-ms', 2000), problems = [];
  let status = 0, body = '', ms = 0; const t0 = Date.now();
  try { const r = await get(u.href, 'GET', num('timeout', 10000)); status = r.status; body = await r.text(); ms = Date.now() - t0; } catch (e) { problems.push(`no answer (${e.name === 'TimeoutError' ? 'timeout' : 'connection failed'})`); }
  say(`url: ${show(u.href)}\nstatus: ${status || 'none'}\ntime: ${ms} ms`);
  if (status >= 400) problems.push(`status ${status}`);
  if (ms > slowMs) problems.push(`slow: ${ms} ms (limit ${slowMs})`);
  if (u.protocol === 'https:') {
    const days = await new Promise((res) => { const s = connect({ host: u.hostname, port: Number(u.port || 443), servername: u.hostname, rejectUnauthorized: false, timeout: 10000 }, () => { const c = s.getPeerCertificate(); s.end(); res(c?.valid_to ? Math.floor((Date.parse(c.valid_to) - Date.now()) / 864e5) : null); }); s.on('error', () => res(null)); s.on('timeout', () => { s.destroy(); res(null); }); });
    say(days === null ? 'tls: UNKNOWN (certificate not readable)' : `tls: ${days} day(s) left`);
    if (days !== null && days < 14) problems.push(`certificate expires in ${days} day(s)`);
  } else say('tls: n/a (plain http)');
  for (const k of mon.keyText ?? []) { const ok = body.includes(k); say(`key text "${k}": ${ok ? 'present' : 'MISSING'}`); if (!ok) problems.push(`key text missing: ${k}`); }
  if (!(mon.keyText ?? []).length) say('key text: none set (add keyText to .lilac/monitor.json)');
  problems.forEach((p) => say(`FAIL ${p}`));
  say(`monitor uptime: ${problems.length} problem(s)`);
  process.exit(problems.length ? 1 : 0);
}

// ---------- budget ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };
function findChrome() {
  if (process.env.CHROME) return existsSync(process.env.CHROME) ? process.env.CHROME : null;
  const onPath = (n) => (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').map((d) => join(d, n)).find((c) => c && existsSync(c));
  return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(onPath)].find((c) => c && existsSync(c)) ?? null;
}

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
// Chrome flags (audit M-5, L-8): sandbox ON unless LILAC_CHROME_NO_SANDBOX=1 (containers running as root need it), DevTools over a pipe (no TCP port another local
// user could drive), profile in a fresh 0700 mkdtemp dir, no extensions/sync/default apps/background networking, and a dead proxy so nothing leaves loopback.
// shortcut: Windows pipe transport is UNVERIFIED (not run there); --remote-debugging-address is ignored with a pipe and kept as a belt-and-braces setting.
const chromeFlags = (udd) => ['--headless=new', '--disable-gpu', ...(process.env.LILAC_CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), '--hide-scrollbars', '--no-first-run', '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-default-apps', '--mute-audio', '--remote-debugging-pipe', '--remote-debugging-address=127.0.0.1', '--proxy-server=http://127.0.0.1:1', `--user-data-dir=${udd}`, 'about:blank'];
async function vitals(chromePath, root, pageList) {
  const rootReal = realpathSync(root);
  const server = createServer((req, res) => { const hp = server.address().port; if (req.headers.host !== `127.0.0.1:${hp}` && req.headers.host !== `localhost:${hp}`) { res.writeHead(403).end(); return; } let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; } let f = normalize(join(rootReal, p)); if (f !== rootReal && !f.startsWith(rootReal + sep)) { res.writeHead(403).end(); return; } if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404).end(); return; } if (!realpathSync(f).startsWith(rootReal + sep)) { res.writeHead(403).end(); return; } res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream' }).end(readFileSync(f)); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`, tmp = mkdtempSync(join(tmpdir(), 'lilac-budget-')); chmodSync(tmp, 0o700);
  const udd = join(tmp, 'p'); mkdirSync(udd, { mode: 0o700 });
  const chrome = spawn(chromePath, chromeFlags(udd), { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  chrome.on('error', () => {});
  const done = () => { try { server.closeAllConnections?.(); server.close(); } catch {} try { process.kill(process.platform === 'win32' ? chrome.pid : -chrome.pid, 'SIGKILL'); } catch {} try { rmSync(tmp, { recursive: true, force: true }); } catch {} };
  process.on('exit', done);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));
  const blocked = [];
  try {
    const listeners = new Set(); let id = 0; const pend = new Map(); let buf = '';
    chrome.stdio[3].on('error', () => {}); chrome.stdio[4].on('error', () => {}); chrome.stdio[4].setEncoding('utf8');
    chrome.stdio[4].on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\0')) >= 0) { const m = JSON.parse(buf.slice(0, i) || 'null'); buf = buf.slice(i + 1); if (!m) continue; if (m.id) { pend.get(m.id)?.(m); pend.delete(m.id); } else for (const l of listeners) l(m); } });
    const raw = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))); try { chrome.stdio[3].write(JSON.stringify({ id: i, method, params, sessionId }) + '\0'); } catch (e) { rej(e); } });
    if (!(await Promise.race([raw('Browser.getVersion'), new Promise((r) => chrome.once('exit', () => r(null))), sleep(20000).then(() => null)]))) return null;
    const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
    const S = (method, params = {}) => raw(method, params, sessionId).catch((e) => ({ error: String(e.message ?? e) }));
    await S('Page.enable'); await S('Page.bringToFront'); await S('Emulation.setFocusEmulationEnabled', { enabled: true }); await S('Emulation.setCPUThrottlingRate', { rate: 4 });
    await guard(raw, listeners, sessionId, base, blocked);
    await S('Network.enable'); await S('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await S('Page.addScriptToEvaluateOnNewDocument', { source: `window.__m={lcp:0,cls:0,inp:null};new PerformanceObserver(l=>{for(const e of l.getEntries())window.__m.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__m.cls+=e.value}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(e.interactionId)window.__m.inp=Math.max(window.__m.inp??0,e.duration)}).observe({type:'event',durationThreshold:16,buffered:true});` });
    const res = {};
    for (const p of pageList) {
      await S('Page.navigate', { url: `${base}/${p}` }); await sleep(3500);
      const btn = (await S('Runtime.evaluate', { returnByValue: true, expression: `(()=>{const b=document.querySelector('button:not([disabled])');if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()` })).result?.value;
      if (btn) { for (const type of ['mousePressed', 'mouseReleased']) await S('Input.dispatchMouseEvent', { type, x: btn.x, y: btn.y, button: 'left', clickCount: 1 }); await sleep(800); }
      res[p] = (await S('Runtime.evaluate', { returnByValue: true, expression: 'window.__m' })).result?.value ?? null;
    }
    return { res, blocked };
  } catch { return null; } finally { done(); }
}
async function budget(dir) {
  const cfg = { maxPageKB: 300, lcpMs: 2500, cls: 0.1, inpMs: 200, ...(readJson(join(dir, '.lilac/budget.json')) ?? {}) };
  const root = siteDir(dir); if (!root) fail('no site folder found');
  const pages = []; (function w(d) { for (const e of readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', '.lilac', '.github'].includes(e.name)) continue; const f = join(d, e.name); e.isDirectory() ? w(f) : /\.html?$/i.test(f) && pages.push(f); } })(root);
  pages.sort();
  const lines = [], bad = []; let unknownExt = false;
  for (const f of pages) {
    const html = readFileSync(f, 'utf8'), refs = new Set(), extRefs = new Set();
    for (const m of html.matchAll(/<(?:link\b[^>]*\bhref|script\b[^>]*\bsrc|img\b[^>]*\bsrc|source\b[^>]*\bsrc|video\b[^>]*\bsrc|audio\b[^>]*\bsrc)\s*=\s*["']([^"']+)["']/gi)) { const r = m[1]; if (/^(https?:)?\/\//i.test(r)) extRefs.add(r); else if (!/^(data:|#|mailto:)/i.test(r)) refs.add(r.replace(/[?#].*$/, '')); }
    let bytes = statSync(f).size, reqs = 1;
    for (const r of refs) { const t = normalize(r.startsWith('/') ? join(root, r) : join(dirname(f), r)); if (t.startsWith(root) && existsSync(t) && statSync(t).isFile()) { bytes += statSync(t).size; reqs++; } }
    reqs += extRefs.size; if (extRefs.size) unknownExt = true;
    const kb = bytes / 1024, ok = kb <= cfg.maxPageKB, name = relative(root, f).split(sep).join('/');
    if (!ok) bad.push(name);
    lines.push(`${ok ? 'PASS' : 'FAIL'} ${name}: ${kb.toFixed(1)} KB (limit ${cfg.maxPageKB}), ${reqs} requests${extRefs.size ? `, ${extRefs.size} external (size UNKNOWN, not counted in KB)` : ''}`);
  }
  lines.forEach(say);
  if (unknownExt) say('UNKNOWN: external files were not downloaded, so their weight is not in the totals.');
  const chrome = findChrome();
  if (!chrome) say('Core Web Vitals: SKIPPED(no browser). Set CHROME=/path/to/chrome. LCP, CLS and INP are UNVERIFIED.');
  else {
    const list = pages.slice(0, 5).map((f) => relative(root, f).split(sep).join('/'));
    const vr = await vitals(chrome, root, list), v = vr?.res;
    if (!v) say('Core Web Vitals: SKIPPED(Chrome did not start). LCP, CLS and INP are UNVERIFIED.');
    else for (const [p, m] of Object.entries(v)) {
      if (!m) { say(`UNVERIFIED ${p}: no measurement`); continue; }
      const L = [['LCP', m.lcp ? Math.round(m.lcp) : null, cfg.lcpMs, 'ms'], ['CLS', Math.round(m.cls * 1000) / 1000, cfg.cls, ''], ['INP', m.inp === null ? null : Math.round(m.inp), cfg.inpMs, 'ms']];
      for (const [k, val, lim, u] of L) { if (val === null) { say(`UNVERIFIED ${p} ${k}: not measured${k === 'INP' ? ' (no button to press on this page)' : ''}`); continue; } const ok = val <= lim; if (!ok) bad.push(`${p} ${k}`); say(`${ok ? 'PASS' : 'FAIL'} ${p} ${k}: ${val}${u} (limit ${lim}${u})`); }
    }
    say('Network: loopback only (127.0.0.1); budget loads a local folder, never a remote URL. ' + (vr.blocked.length ? `${vr.blocked.length} external request(s) blocked:` : 'no external request was attempted.'));
    vr.blocked.forEach((b) => say(`  ${b.msg}`));
    say('These come from one headless Chrome run with 4x CPU slowdown and 1.6 Mbit/s network: an estimate, not real-user data.');
  }
  say('Limits: https://web.dev/articles/vitals (LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 at the 75th percentile; read 2026-11-22).');
  say(`monitor budget: ${bad.length} failure(s)`);
  process.exit(bad.length ? 1 : 0);
}

async function main() {
  if (!['links', 'uptime', 'budget'].includes(cmd) || !target) fail('usage: links <url-or-dir> | uptime <url> | budget <dir>');
  if (cmd === 'links') { /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? await linksLive(target) : (existsSync(target) ? linksDir(resolve(target)) : fail(`${target} not found`)); }
  else if (cmd === 'uptime') await uptime(target);
  else { if (!existsSync(target)) fail(`${target} not found`); await budget(resolve(target)); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
