#!/usr/bin/env node
// change.mjs begin <dir> --note "<request>" | finish <dir> [--n N] | undo <dir> <n> [--force] | list <dir>
// Makes a change request safe and visible. `begin` (BEFORE editing) copies the site folder (site/public/dist/out/build, or index.html in the root)
// to <dir>/.lilac/changes/<n>/before/, hashes every file, renders full-page screenshots of every page at 360/768/1280 px in system Chrome and runs
// the gates (qa, qa-browser, controls-test) on a temp copy as the baseline. `finish` finds the changed files, maps them to AFFECTED PAGES (a changed
// page; pages that link/script/img/@import a changed file, transitively; every page when brand/tokens.css changed; pages linking to a removed file),
// renders after-screenshots, makes a per-pixel diff in the browser itself (canvas, no image libraries), flags UNEXPECTED change on pages that were
// not affected, re-runs the gates on a temp copy and writes CHANGE.md + compare.html. Verdict: SAFE | REVIEW | BROKEN (a gate error not in the baseline).
// `undo` restores the changed files from before/ (refuses when the tree changed after `finish`, unless --force). `list` shows all changes.
// No Chrome: prints `change: SKIPPED(no browser)`; everything else still works text-only. Server binds 127.0.0.1 only.
// Trust: nothing under <project>/.lilac/changes is trusted (a cloned repo can ship it). `begin` seals {project realpath, n, site, hashes} with an HMAC whose random key lives at
// $LILAC_HOME|~/.lilac/change-key (0600); `finish`/`undo` validate every path and refuse state without a matching seal made on this machine, a before-copy whose hash is not in the manifest, and any symlink on the way.
// The browser blocks every request except http://127.0.0.1:<its server port> (CDP Fetch + a resolver that fails all other hosts) and cancels form submits, so nothing leaves the machine.
// Chrome runs sandboxed; set LILAC_CHROME_NO_SANDBOX=1 only where Chrome refuses to start otherwise (containers running as root).
// A moved or renamed project folder invalidates its seals (the project realpath is part of the seal); run `begin` again.
// shortcut: duplicated CDP client (same as qa-browser.mjs), keep in sync by hand; Chrome is found like qa-browser.mjs does it.
// shortcut: gates run on a full temp copy of the site and their findings are filtered to the affected pages; upgrade to a page-subset copy if gates get slow.
// shortcut: gate summary lines are rebuilt from --json in the tools' own format; pages are rendered with animations off so the diff is stable.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, lstatSync, realpathSync, mkdtempSync, mkdirSync, rmSync, cpSync, copyFileSync } from 'node:fs';
import { join, relative, resolve, extname, sep, normalize, dirname, posix, isAbsolute } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const force = args.includes('--force');
const pos = args.slice(1).filter((a, i, all) => !a.startsWith('--') && !['--note', '--n'].includes(all[i - 1]));
const usage = () => { console.error('usage: change.mjs begin <dir> --note "<request>" | finish <dir> [--n N] | undo <dir> <n> [--force] | list <dir>'); process.exit(2); };
if (!['begin', 'finish', 'undo', 'list'].includes(cmd) || !pos[0] || !existsSync(pos[0]) || !statSync(pos[0]).isDirectory()) usage();
const root = resolve(pos[0]);
const CH = join(root, '.lilac', 'changes');
const SKIP = new Set(['node_modules', '.git', '.lilac']);
const WIDTHS = [360, 768, 1280];
const HERE = dirname(fileURLToPath(import.meta.url));
const posixRel = (a, b) => relative(a, b).split(sep).join('/');

function walk(d, out = []) { for (const e of readdirSync(d, { withFileTypes: true })) { if (SKIP.has(e.name) || e.isSymbolicLink()) continue; const p = join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; }
const hasHtml = (d) => existsSync(d) && statSync(d).isDirectory() && walk(d).some((f) => f.endsWith('.html'));
const isLink = (p) => lstatSync(p, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
function findSite() {
  const s = ['site', 'public', 'dist', 'out', 'build'].map((n) => join(root, n)).find((p) => !isLink(p) && hasHtml(p)); // a symlinked site folder is never used
  return s ?? (existsSync(join(root, 'index.html')) ? root : null);
}
const hashTree = (d) => Object.fromEntries(walk(d).sort().map((f) => [posixRel(d, f), createHash('sha256').update(readFileSync(f)).digest('hex')]));
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const copySite = (from, to) => cpSync(from, to, { recursive: true, filter: (s) => !SKIP.has(s.split(sep).pop()) && !lstatSync(s).isSymbolicLink() });
const slug = (page) => page.replace(/\.html$/, '').replace(/\//g, '__');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nums = () => (existsSync(CH) ? readdirSync(CH).filter((n) => /^\d+$/.test(n)).map(Number).sort((a, b) => a - b) : []);

// ---- trust: state under .lilac/changes is untrusted input; only a seal made on this machine vouches for it ----
const refuse = (m) => { console.error(`change: refusing: ${m}. Nothing was touched.`); process.exit(1); };
const LH = process.env.LILAC_HOME || join(homedir(), '.lilac');
function sealKey(create) {
  const f = join(LH, 'change-key');
  if (create) { mkdirSync(LH, { recursive: true, mode: 0o700 }); try { writeFileSync(f, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
  try { return readFileSync(f, 'utf8').trim(); } catch { return null; }
}
const rootReal = realpathSync(root);
const sealFile = (n) => join(LH, 'change-seals', createHash('sha256').update(`${rootReal}\0${n}`).digest('hex').slice(0, 32));
const sealOf = (key, n, site, hashes) => createHmac('sha256', key).update(JSON.stringify([rootReal, n, site, Object.entries(hashes).sort(([a], [b]) => (a < b ? -1 : 1))])).digest('hex');
function writeSeal(n, site, hashes) {
  const key = sealKey(true); mkdirSync(join(LH, 'change-seals'), { recursive: true, mode: 0o700 });
  writeFileSync(sealFile(n), sealOf(key, n, site, hashes), { mode: 0o600 });
}
// A relative POSIX path: no "..", ".", empty parts, backslash, drive letter, NUL, absolute form.
const relOk = (f) => typeof f === 'string' && !!f && !f.includes('\0') && !f.includes('\\') && !isAbsolute(f) && !posix.isAbsolute(f) && !/^[A-Za-z]:/.test(f) && posix.normalize(f) === f && !f.split('/').some((x) => x === '..' || x === '.' || x === '');
// Every existing component of base/rel must be a real folder (leaf: a real file); a symlink anywhere refuses.
function noLinks(base, rel) {
  let cur = base; const parts = rel === '.' ? [] : rel.split('/');
  for (let i = 0; i < parts.length; i++) {
    cur = join(cur, parts[i]); const st = lstatSync(cur, { throwIfNoEntry: false });
    if (!st) return;
    if (st.isSymbolicLink()) refuse(`symlink in path ${cur}`);
    if (i < parts.length - 1 && !st.isDirectory()) refuse(`not a folder: ${cur}`);
  }
}
// Reads and validates change n's state: schema, every path, seal. Returns { D, meta, base, siteDir } or exits 1 having touched nothing.
function loadState(n) {
  const D = join(CH, String(n));
  for (const p of [join(root, '.lilac'), CH, D, join(D, 'before')]) if (isLink(p)) refuse(`${p} is a symlink`);
  let meta, base;
  try { meta = readJson(join(D, 'meta.json')); base = readJson(join(D, 'hashes.json')); } catch (e) { refuse(`change ${n}: meta.json or hashes.json is unreadable (${e.message})`); }
  const obj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  if (!obj(meta) || typeof meta.site !== 'string' || (meta.site !== '.' && !relOk(meta.site))) refuse(`change ${n}: unsafe or invalid "site" in meta.json (${JSON.stringify(meta?.site)})`);
  if (!obj(base)) refuse(`change ${n}: invalid hashes.json (not an object)`);
  for (const [f, h] of Object.entries(base)) if (!relOk(f) || typeof h !== 'string' || !/^[0-9a-f]{64}$/.test(h)) refuse(`change ${n}: unsafe path or invalid hash in hashes.json (${JSON.stringify(f).slice(0, 80)})`);
  const key = sealKey(false); let have = null; try { have = readFileSync(sealFile(n), 'utf8').trim(); } catch {}
  const want = key && sealOf(key, n, meta.site, base);
  if (!key || !have || have.length !== want.length || !timingSafeEqual(Buffer.from(have), Buffer.from(want))) refuse(`change ${n}: no valid seal on this machine (state under .lilac/changes was not created here by "begin", or was altered). Run begin again`);
  noLinks(rootReal, meta.site);
  const siteDir = meta.site === '.' ? rootReal : join(rootReal, meta.site);
  if (existsSync(siteDir) && realpathSync(siteDir) !== siteDir) refuse(`site folder ${siteDir} resolves through a symlink`);
  return { D, meta, base, siteDir };
}

// ---- temp dirs and cleanup on every exit path ----
const tmps = []; let chrome = null, server = null;
const mkTmp = () => { const d = mkdtempSync(join(tmpdir(), 'lilac-change-')); tmps.push(d); return d; };
const cleanup = () => {
  try { server?.closeAllConnections?.(); server?.close(); } catch {}
  try { if (chrome?.pid) process.kill(process.platform === 'win32' ? chrome.pid : -chrome.pid, 'SIGKILL'); } catch {}
  for (const d of tmps) try { rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
};
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));
process.on('uncaughtException', (e) => { console.error('change: internal error: ' + (e?.stack ?? e)); process.exit(2); });

// ---- Chrome like qa-browser.mjs: $CHROME (must exist), macOS app, PATH names, Windows Chrome/Edge ----
const onPath = (n) => (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').map((d) => join(d, n)).find((c) => c && existsSync(c));
const winC = ['ProgramFiles', 'ProgramFiles(x86)'].flatMap((v) => process.env[v] ? [join(process.env[v], 'Google/Chrome/Application/chrome.exe'), join(process.env[v], 'Microsoft/Edge/Application/msedge.exe')] : []);
const CHROME = process.env.CHROME ? (existsSync(process.env.CHROME) ? process.env.CHROME : null)
  : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(onPath), ...winC].find((c) => c && existsSync(c));

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };

// Starts a 127.0.0.1 static server for `site` (plus /__chg/ for the shots folder) and headless Chrome; returns helpers. Cleaned by cleanup().
async function openBrowser(site, shotsDir) {
  const siteReal = resolve(site), shotsReal = resolve(shotsDir);
  server = createServer((req, res) => {
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
    if (p === '/__blank') { res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>blank</title>'); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end('method not allowed'); return; }
    const base = p.startsWith('/__chg/') ? shotsReal : siteReal;
    let f = normalize(join(base, p.startsWith('/__chg/') ? p.slice(7) : p));
    if (f !== base && !f.startsWith(base + sep)) { res.writeHead(403).end('forbidden'); return; }
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f) && !extname(f) && existsSync(f + '.html')) f += '.html';
    if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
    try { const rf = realpathSync(f), rb = realpathSync(base); if (rf !== rb && !rf.startsWith(rb + sep)) { res.writeHead(403).end('forbidden'); return; } } catch { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const udd = join(mkTmp(), 'profile'); mkdirSync(udd, { mode: 0o700 });
  // Second wall besides Fetch interception: the resolver fails every host except literal 127.0.0.1 (covers iframes, workers, prefetch).
  chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', ...(process.env.LILAC_CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1', '--hide-scrollbars', '--no-first-run', '--disable-extensions', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${udd}`, 'about:blank'], { stdio: 'ignore', detached: process.platform !== 'win32' });
  chrome.on('error', () => {});
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) { try { port = Number(readFileSync(join(udd, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch { await sleep(100); } }
  if (!port) throw new Error('Chrome did not start');
  let wsUrl = null;
  for (let i = 0; i < 50 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(100); } }
  if (!wsUrl) throw new Error('no DevTools endpoint');
  const ws = new WebSocket(wsUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let nid = 0; const pend = new Map();
  const blocked = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) { pend.get(m.id)?.(m); pend.delete(m.id); }
    else if (m.method === 'Fetch.requestPaused') { // only the preview server's own origin (and inline data:/blob:) may load
      const u = m.params.request.url, okU = u === origin || u.startsWith(origin + '/') || /^(data|blob):/i.test(u);
      if (!okU) blocked.push(u);
      raw(okU ? 'Fetch.continueRequest' : 'Fetch.failRequest', okU ? { requestId: m.params.requestId } : { requestId: m.params.requestId, errorReason: 'BlockedByClient' }, m.sessionId).catch(() => {});
    }
  };
  const raw = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++nid; pend.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))); ws.send(JSON.stringify({ id, method, params, sessionId })); });
  const withTab = async (fn) => {
    const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => raw(m, p, sessionId);
    await S('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await S('Page.enable'); // forms are never submitted: programmatic requestSubmit and clicks are cancelled; form.submit() navigations are caught by Fetch above
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "addEventListener('submit',function(e){e.preventDefault();e.stopImmediatePropagation()},true)" });
    const ev = async (expression) => { const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page script failed: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)); return r.result.value; };
    try { return await fn(S, ev); } finally { try { await raw('Target.closeTarget', { targetId }); } catch {} }
  };
  const shoot = (page, width, out) => withTab(async (S, ev) => {
    await S('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
    await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await S('Page.navigate', { url: `${origin}/${page.split('/').map(encodeURIComponent).join('/')}` });
    for (let i = 0; i < 150; i++) { if ((await ev('document.readyState').catch(() => '')) === 'complete') break; await sleep(100); }
    const h = await ev(`(async () => {
      const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'; document.head.append(s);
      document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
      await Promise.all([...document.images].map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 5000); }))));
      await document.fonts.ready; await new Promise((r) => setTimeout(r, 250));
      return Math.min(12000, Math.max(innerHeight, document.documentElement.scrollHeight, document.body.scrollHeight)); })()`);
    const { data } = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } });
    writeFileSync(out, Buffer.from(data, 'base64'));
  });
  // Pixel diff inside the browser: both PNGs are loaded from the temp server into canvases and compared per pixel (channel delta > 8 = changed).
  const diff = (beforeName, afterName) => withTab(async (S, ev) => {
    await S('Page.navigate', { url: `${origin}/__blank` });
    for (let i = 0; i < 50; i++) { if ((await ev('document.readyState').catch(() => '')) === 'complete') break; await sleep(50); }
    const fn = async (bu, au) => {
      const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('cannot load ' + u)); i.src = u; });
      const [bi, ai] = await Promise.all([load(bu), load(au)]);
      const W = Math.max(bi.width, ai.width), H = Math.max(bi.height, ai.height);
      const mk = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); return x.getImageData(0, 0, W, H).data; };
      const B = mk(bi), A = mk(ai); const out = new ImageData(W, H);
      let n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const oob = (x >= bi.width || y >= bi.height) !== (x >= ai.width || y >= ai.height);
        const d = oob ? 255 : Math.max(Math.abs(B[i] - A[i]), Math.abs(B[i + 1] - A[i + 1]), Math.abs(B[i + 2] - A[i + 2]));
        if (d > 8) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 0; out.data[i + 3] = 255; }
        else { out.data[i] = 191 + A[i] * 0.25; out.data[i + 1] = 191 + A[i + 1] * 0.25; out.data[i + 2] = 191 + A[i + 2] * 0.25; out.data[i + 3] = 255; }
      }
      let png = null;
      if (n) { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0); png = c.toDataURL('image/png'); }
      return { w: W, h: H, changed: n, pct: (100 * n) / (W * H), bbox: n ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null, png };
    };
    return ev(`(${fn.toString()})(${JSON.stringify(`/__chg/${beforeName}`)}, ${JSON.stringify(`/__chg/${afterName}`)})`);
  });
  return { shoot, diff, blocked };
}

// ---- references: which files does a page depend on (transitively)? ----
const isLocal = (u) => u && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);
function resolveRef(u, fromFile, files) {
  if (!isLocal(u)) return null;
  const clean = decodeURIComponent(u.split('#')[0].split('?')[0]); if (!clean) return null;
  let p = clean.startsWith('/') ? posix.normalize(clean.slice(1)) : posix.normalize(posix.join(posix.dirname(fromFile), clean));
  for (const c of [p, p + '.js', p + '.html', posix.join(p, 'index.html')]) if (files.has(c)) return c;
  return p; // may be missing: still returned so a removed file counts as a reference
}
function refsOf(file, text) {
  const ext = extname(file).toLowerCase(), deps = new Set(), links = new Set(); const add = (s, u) => { const r = resolveRef(u, file, FILES); if (r) s.add(r); };
  if (ext === '.html') {
    for (const [, tag, attrs] of text.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) for (const [, an, , v] of attrs.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)) { const name = an.toLowerCase();
      if (name === 'srcset') for (const part of v.split(',')) add(deps, part.trim().split(/\s+/)[0]);
      else if (name === 'href') (tag.toLowerCase() === 'a' ? links : deps).add(resolveRef(v, file, FILES) ?? '') ;
      else if (['src', 'poster', 'data-src', 'data'].includes(name)) add(deps, v);
    }
    links.delete(''); deps.delete('');
    for (const [, u] of text.matchAll(/url\(\s*['"]?([^'")]+)/g)) add(deps, u);
    for (const [, u] of text.matchAll(/(?:^|[\s;{])import\s*(?:[^'"]*from\s*)?['"]([^'"]+)['"]/g)) add(deps, u);
  } else if (ext === '.css') {
    for (const [, u] of text.matchAll(/url\(\s*['"]?([^'")]+)/g)) add(deps, u);
    for (const [, u] of text.matchAll(/@import\s+['"]([^'"]+)/g)) add(deps, u);
  } else if (ext === '.js' || ext === '.mjs') {
    for (const [, u] of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.{0,2}\/[^'"]+)['"]/g)) add(deps, u);
  }
  return { deps, links };
}
let FILES = new Set();
function graph(site) { // page -> closure of files it loads; page -> pages/files it links to
  const files = walk(site).map((f) => posixRel(site, f)); FILES = new Set(files);
  const direct = new Map(); const links = new Map();
  for (const f of files) { if (!/\.(html|css|js|mjs)$/i.test(f)) continue; const r = refsOf(f, readFileSync(join(site, f), 'utf8')); direct.set(f, r.deps); links.set(f, r.links); }
  const closure = (f) => { const seen = new Set(), st = [f]; while (st.length) for (const d of direct.get(st.pop()) ?? []) if (!seen.has(d)) { seen.add(d); st.push(d); } return seen; };
  const out = {}; for (const f of files.filter((x) => x.endsWith('.html'))) out[f] = { deps: closure(f), links: links.get(f) ?? new Set() };
  return out;
}

// ---- gates on a temp copy (never writes screenshots into the project) ----
const GATES = [['qa', 'qa.mjs'], ['qa-browser', 'qa-browser.mjs'], ['controls-test', 'controls-test.mjs']];
const BAD = new Set(['DEAD', 'DISABLED-FOREVER', 'BROKEN-LINK', 'PLACEHOLDER', 'UNREACHABLE']);
function runGates(site, label) {
  const proj = mkTmp(); copySite(site, join(proj, 'site')); const res = {};
  for (const [name, script] of GATES) {
    const r = spawnSync(process.execPath, [join(HERE, script), proj, '--site', 'site', '--json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 900000 });
    const out = (r.stdout ?? '').trim(); let j = null;
    if (out.startsWith('{')) { try { j = JSON.parse(out); } catch {} }
    if (!j) {
      const skipped = /SKIPPED\(no browser\)/.test(out);
      res[name] = { skipped, failed: !skipped, line: skipped ? out.split('\n').pop() : `${name}: DID NOT RUN (${(r.stderr ?? '').trim().split('\n')[0] || 'exit ' + r.status})`, errors: [], warns: [] };
      continue;
    }
    const errors = [], warns = [];
    if (name === 'controls-test') for (const p of j.pages) for (const c of p.controls) { if (BAD.has(c.verdict)) errors.push({ page: p.page, key: `${c.label}|${c.verdict}`, text: `${c.label}: ${c.verdict} ${c.detail ?? ''}` }); }
    else for (const p of j.pages) for (const f of p.findings) (f.sev === 'error' ? errors : warns).push({ page: p.page, key: `${f.id}|${f.msg.replace(/\d+/g, '#')}`, text: `[${f.id}] ${f.msg}` });
    res[name] = { skipped: false, failed: false, line: name === 'controls-test' ? j.summary : `${name}: ${j.summary.errors} error(s), ${j.summary.warnings} warning(s), ${j.summary.unverified} unverified`, errors, warns };
  }
  return res;
}
const scope = (list, pages) => list.filter((x) => x.page === '(site)' || pages.has(x.page));
const keyOf = (x) => `${x.page}|${x.key}`;

// ---------------------------------------------------------------------------------------------------------------------------------------------
if (cmd === 'list') {
  const ns = nums(); if (!ns.length) { console.log('change: no changes recorded'); process.exit(0); }
  for (const n of ns) {
    const d = join(CH, String(n)); const clean = (v) => String(v ?? '').replace(/[^\x20-\x7e\u00a0-\uffff]/g, '?').slice(0, 200); // display only: meta is untrusted
    try {
      const m = readJson(join(d, 'meta.json'));
      const status = m.undone ? 'UNDONE' : existsSync(join(d, 'result.json')) ? readJson(join(d, 'result.json')).verdict : 'BEGUN (not finished)';
      console.log(`${n}  ${clean(status)}  ${clean(m.time)}  ${clean(m.note)}`);
    } catch { console.log(`${n}  UNREADABLE (meta.json missing or malformed)`); }
  }
  process.exit(0);
}

if (cmd === 'begin') {
  const note = flag('--note'); if (!note) { console.error('change: begin needs --note "<request>"'); process.exit(2); }
  const site = findSite(); if (!site) { console.error('change: no site folder found (site, public, dist, out, build, or index.html in the root)'); process.exit(2); }
  for (const p of [join(root, '.lilac'), CH]) if (isLink(p)) refuse(`${p} is a symlink`);
  const n = (nums().pop() ?? 0) + 1, d = join(CH, String(n)), shots = join(d, 'shots');
  mkdirSync(CH, { recursive: true }); mkdirSync(d); mkdirSync(shots); copySite(site, join(d, 'before'));
  const hashes = hashTree(site); writeFileSync(join(d, 'hashes.json'), JSON.stringify(hashes, null, 2));
  const pages = Object.keys(hashes).filter((f) => f.endsWith('.html'));
  let browser = 'SKIPPED(no browser)';
  if (CHROME) {
    const b = await openBrowser(site, shots);
    for (const p of pages) for (const w of WIDTHS) await b.shoot(p, w, join(shots, `before-${slug(p)}-${w}.png`));
    browser = `${pages.length * WIDTHS.length} screenshot(s)` + (b.blocked.length ? `, ${b.blocked.length} external request(s) BLOCKED` : '');
    try { server?.closeAllConnections?.(); server?.close(); } catch {} try { if (chrome?.pid) process.kill(-chrome.pid, 'SIGKILL'); } catch {} chrome = null; server = null;
  } else console.log('change: SKIPPED(no browser): screenshots and visual diff are not done; text checks still run');
  const gates = runGates(site, 'baseline');
  writeFileSync(join(d, 'gates-baseline.json'), JSON.stringify(gates, null, 2));
  const siteRel = posixRel(rootReal, realpathSync(site)) || '.';
  writeFileSync(join(d, 'meta.json'), JSON.stringify({ n, note, time: new Date().toISOString(), site: siteRel, pages, screenshots: !!CHROME }, null, 2));
  writeSeal(n, siteRel, hashes);
  console.log(`change ${n}: baseline recorded for "${note}" (${Object.keys(hashes).length} file(s), ${pages.length} page(s), ${browser})`);
  for (const [k, g] of Object.entries(gates)) console.log(`  baseline ${g.line}`);
  console.log(`Now edit minimally, then run: change.mjs finish "${pos[0]}"`);
  process.exit(0);
}

const nArg = cmd === 'undo' ? Number(pos[1]) : Number(flag('--n') ?? (nums().filter((x) => !existsSync(join(CH, String(x), 'result.json'))).pop() ?? 0));
if (!nArg || !existsSync(join(CH, String(nArg), 'meta.json'))) { console.error(cmd === 'undo' ? `change: no change ${pos[1]} to undo` : 'change: no begun change to finish (run begin first)'); process.exit(2); }
const { D, meta, base, siteDir } = loadState(nArg);
const shots = join(D, 'shots');
const hBefore = hashTree(join(D, 'before'));

if (cmd === 'undo') {
  const cur = hashTree(siteDir);
  const afterF = join(D, 'after.json'); // only compared with hashes, never used as a path
  let after = null; try { after = existsSync(afterF) ? readJson(afterF) : null; if (after && (typeof after !== 'object' || Array.isArray(after))) after = null; } catch {}
  if (meta.undone) { console.error(`change ${nArg}: already undone`); process.exit(2); }
  if (after && !force) {
    const newer = [...new Set([...Object.keys(cur), ...Object.keys(after)])].filter((f) => cur[f] !== after[f]);
    if (newer.length) { console.error(`change ${nArg}: refusing to undo: the site has newer changes since finish (${newer.slice(0, 8).join(', ')}). Use --force to revert only this change's files anyway.`); process.exit(1); }
  }
  const changed = [...new Set([...Object.keys(cur), ...Object.keys(base)])].filter((f) => cur[f] !== base[f]);
  // Check everything first, then write: a refusal leaves the tree untouched.
  for (const f of changed) {
    noLinks(siteDir, f);
    if (f in base && hBefore[f] !== base[f]) refuse(`change ${nArg}: the saved before-copy of ${f} does not match the manifest hash`);
  }
  for (const f of changed) {
    const dest = join(siteDir, f);
    if (f in base) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(join(D, 'before', f), dest); } else rmSync(dest, { force: true });
  }
  meta.undone = true; writeFileSync(join(D, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(`change ${nArg}: undone, ${changed.length} file(s) reverted`);
  for (const f of changed) console.log(`  ${f in base ? (f in cur ? 'restored' : 'recreated') : 'removed'} ${f}`);
  process.exit(0);
}

// ---- finish ----
for (const f of new Set([...Object.keys(base), ...Object.keys(hBefore)])) if (hBefore[f] !== base[f]) refuse(`change ${nArg}: the saved before-copy does not match the manifest (${f})`);
const cur = hashTree(siteDir);
const all = [...new Set([...Object.keys(cur), ...Object.keys(base)])].sort();
const modified = all.filter((f) => f in base && f in cur && base[f] !== cur[f]), added = all.filter((f) => !(f in base)), removed = all.filter((f) => !(f in cur));
const changedSet = new Set([...modified, ...added, ...removed]);
const gAfter = graph(siteDir), gBefore = graph(join(D, 'before'));
const pagesAfter = Object.keys(gAfter), pagesBefore = Object.keys(gBefore);
const tokens = [...changedSet].some((f) => /(^|\/)brand\/tokens\.css$/.test(f));
const why = new Map(); const mark = (p, r) => { if (!why.has(p)) why.set(p, r); };
for (const p of new Set([...pagesAfter, ...pagesBefore])) {
  if (changedSet.has(p)) mark(p, removed.includes(p) ? 'page removed' : added.includes(p) ? 'new page' : 'page file changed');
  else {
    const dep = [...(gAfter[p]?.deps ?? []), ...(gBefore[p]?.deps ?? [])].find((f) => changedSet.has(f));
    if (dep) mark(p, `uses changed file ${dep}`);
    else if (tokens) mark(p, 'brand/tokens.css changed');
    else { const l = [...(gBefore[p]?.links ?? [])].find((f) => removed.includes(f)); if (l) mark(p, `links to removed file ${l}`); }
  }
}
const affected = [...why.keys()].filter((p) => pagesAfter.includes(p)).sort(), affectedSet = new Set(affected);
const removedPages = [...why.keys()].filter((p) => !pagesAfter.includes(p)).sort();

// visual diff: every existing page is rendered (cheap), diffs of untouched pages are kept only when pixels changed (UNEXPECTED)
const visual = []; let browserNote = 'SKIPPED(no browser)';
if (!CHROME) console.log('change: SKIPPED(no browser): no after-screenshots or pixel diff; the gates still run');
else if (!meta.screenshots) browserNote = 'SKIPPED(no baseline screenshots: begin ran without a browser)';
else if (changedSet.size) {
  const b = await openBrowser(siteDir, shots);
  for (const p of pagesAfter) for (const w of WIDTHS) {
    const bf = `before-${slug(p)}-${w}.png`, af = `after-${slug(p)}-${w}.png`, df = `diff-${slug(p)}-${w}.png`;
    await b.shoot(p, w, join(shots, af));
    if (!existsSync(join(shots, bf))) { visual.push({ page: p, width: w, isNew: true, pct: 100, bbox: null, kept: true }); continue; }
    const r = await b.diff(bf, af);
    const touched = affectedSet.has(p), changed = r.changed > 0 && r.pct >= 0.01;
    if (r.png) writeFileSync(join(shots, df), Buffer.from(r.png.split(',')[1], 'base64'));
    const row = { page: p, width: w, pct: r.pct, bbox: r.bbox, changed, touched, kept: touched || changed };
    if (!row.kept) { rmSync(join(shots, af), { force: true }); rmSync(join(shots, df), { force: true }); }
    if (!changed) rmSync(join(shots, df), { force: true });
    visual.push(row);
  }
  browserNote = `${visual.length} render(s) compared`;
} else browserNote = 'nothing changed';
const unexpected = [...new Set(visual.filter((v) => v.changed && !v.touched).map((v) => v.page))];

// gates
const baseG = readJson(join(D, 'gates-baseline.json'));
const gates = changedSet.size ? runGates(siteDir, 'after') : {};
const gateRows = []; let newErrors = [], newWarns = [];
for (const [name, g] of Object.entries(gates)) {
  const b = baseG[name], seenE = new Set((b?.errors ?? []).map(keyOf)), seenW = new Set((b?.warns ?? []).map(keyOf));
  const e = scope(g.errors, affectedSet), w = scope(g.warns, affectedSet);
  const ne = e.filter((x) => !seenE.has(keyOf(x))), nw = w.filter((x) => !seenW.has(keyOf(x)));
  newErrors.push(...ne.map((x) => ({ gate: name, ...x }))); newWarns.push(...nw.map((x) => ({ gate: name, ...x })));
  gateRows.push({ name, line: g.line, scoped: g.skipped || g.failed ? null : `${e.length} error(s), ${w.length} warning(s) on the ${affected.length} affected page(s); ${ne.length} new error(s), ${nw.length} new warning(s) vs baseline`, skipped: g.skipped, failed: g.failed });
}
const failedGate = gateRows.some((g) => g.failed);
const verdict = newErrors.length ? 'BROKEN' : unexpected.length || newWarns.length || failedGate ? 'REVIEW' : 'SAFE';

// ---- report ----
const imgs = (p, w) => ['before', 'after', 'diff'].map((k) => `shots/${k}-${slug(p)}-${w}.png`).map((f) => (existsSync(join(D, f)) ? f : null));
const L = [`# Change ${nArg}`, '', `Request: ${meta.note}`, `Started: ${meta.time}`, `Site folder: ${meta.site}`, '', `Verdict: ${verdict}`, '', '## Files changed', ''];
L.push(...(changedSet.size ? [...modified.map((f) => `- modified ${f}`), ...added.map((f) => `- added ${f}`), ...removed.map((f) => `- removed ${f}`)] : ['- none']));
L.push('', '## Affected pages', '', ...(affected.length || removedPages.length ? [...affected.map((p) => `- ${p} (${why.get(p)})`), ...removedPages.map((p) => `- ${p} (${why.get(p)})`)] : ['- none']));
L.push('', '## Visual change', '', `Browser: ${browserNote}`, '');
for (const v of visual.filter((x) => x.kept)) {
  const [bI, aI, dI] = imgs(v.page, v.width);
  L.push(`- ${v.page} at ${v.width}px: ${v.isNew ? 'new page' : `${v.pct.toFixed(2)}% of pixels changed${v.bbox ? `, box x${v.bbox[0]} y${v.bbox[1]} ${v.bbox[2]}x${v.bbox[3]}` : ''}`}${v.touched || v.isNew ? '' : ' (UNEXPECTED)'}`, `  - before: ${bI ?? 'none'}`, `  - after: ${aI ?? 'none'}`, `  - diff: ${dI ?? 'none'}`);
}
if (!visual.some((x) => x.kept)) L.push('- no visual change recorded');
L.push('', '## Unexpected visual change', '', ...(unexpected.length ? unexpected.map((p) => `- ${p}: pixels changed, but this page and its linked files did not change`) : ['- none']));
L.push('', '## Gates (last result lines, copied from each tool)', '');
for (const g of gateRows) L.push(g.line, ...(g.scoped ? [`  scoped: ${g.scoped}`] : []));
if (!gateRows.length) L.push('(no files changed: gates not run)');
L.push('', '## New problems vs baseline', '', ...(newErrors.length || newWarns.length ? [...newErrors.map((x) => `- ERROR ${x.gate} ${x.page}: ${x.text}`), ...newWarns.map((x) => `- warning ${x.gate} ${x.page}: ${x.text}`)] : ['- none']));
L.push('', '## What the verdict means', '', 'SAFE: no new gate errors and no unexpected visual change. REVIEW: look at the images (unexpected change, new warnings, or a gate that did not run). BROKEN: a gate error that was not there before.', 'Anything marked SKIPPED was not checked.', '', `Undo: node change.mjs undo "<project>" ${nArg}`, '');
writeFileSync(join(D, 'CHANGE.md'), L.join('\n'));

const rows = visual.filter((x) => x.kept).map((v) => { const [b, a, d] = imgs(v.page, v.width); const cell = (t, f) => `<td>${f ? `<img src="${esc(f)}" alt="${esc(t)} ${esc(v.page)} ${v.width}px">` : 'none'}</td>`; return `<h2>${esc(v.page)} at ${v.width}px${v.touched || v.isNew ? '' : ' (UNEXPECTED)'}</h2><table><tr><th>Before</th><th>After</th><th>Diff (red = changed)</th></tr><tr>${cell('before', b)}${cell('after', a)}${cell('diff', d)}</tr></table>`; });
writeFileSync(join(D, 'compare.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Change ${nArg}: ${esc(meta.note)}</title><style>body{font-family:system-ui,sans-serif;margin:16px;color:#111;background:#fff}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid #ccc;vertical-align:top;padding:4px}img{max-width:100%;height:auto}</style></head><body><h1>Change ${nArg}: ${esc(meta.note)}</h1><p>Verdict: <strong>${verdict}</strong>. Files changed: ${changedSet.size}. Affected pages: ${affected.length}.</p>${rows.join('') || '<p>No visual change recorded.</p>'}</body></html>\n`);
writeFileSync(join(D, 'after.json'), JSON.stringify(cur, null, 2));
writeFileSync(join(D, 'result.json'), JSON.stringify({ verdict, changed: [...changedSet], affected, unexpected }, null, 2));
console.log(`change ${nArg}: ${verdict}. ${changedSet.size} file(s) changed, ${affected.length} page(s) affected, ${unexpected.length} unexpected visual change(s).`);
for (const g of gateRows) console.log(`  ${g.line}`);
console.log(`Report: ${join(D, 'CHANGE.md')}\nCompare: ${join(D, 'compare.html')}`);
process.exit(0);
