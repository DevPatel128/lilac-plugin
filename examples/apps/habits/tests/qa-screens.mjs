// Dev helper (not part of the app): headless Chrome over CDP. Seeds the test user, screenshots Today, Insights and Settings at 360/768/1280
// into .lilac/qa/views-*.png, then checks the service worker: precache, then the server is stopped and a reload must still render offline.
// Usage: node tests/qa-screens.mjs   (needs Chrome; localhost only, no external network)
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..'), out = join(root, '.lilac', 'qa');
const CH = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if (!CH) { console.log('qa-screens: SKIPPED(no browser)'); process.exit(0); }
mkdirSync(out, { recursive: true });
const sport = 4300 + Math.floor(Math.random() * 500);
let srv = spawn('node', [join(here, '..', '..', 'serve.mjs'), 'habits', String(sport)], { stdio: 'ignore' });
const udd = mkdtempSync(join(tmpdir(), 'ph-'));
const ch = spawn(CH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${udd}`, 'about:blank'], { stdio: 'ignore' });
const done = (c) => { try { srv.kill(); } catch {} try { ch.kill('SIGKILL'); } catch {} try { rmSync(udd, { recursive: true, force: true }); } catch {} process.exit(c); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let port; for (let i = 0; i < 50 && !port; i++) { await sleep(200); try { port = Number(readFileSync(join(udd, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch {} }
const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(), errs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
const go = async (u) => { await send('Page.navigate', { url: u }); await sleep(900); };
await send('Page.enable'); await send('Runtime.enable');
const base = `http://127.0.0.1:${sport}`;
await go(base + '/');
const fx = JSON.parse(readFileSync(join(root, 'tests/fixtures/test-user.json'), 'utf8'));
// Same shape the app stores: version, habits, settings (tour marked done so the banner does not cover the views).
await ev(`localStorage.setItem('pocket-habits', ${JSON.stringify(JSON.stringify({ version: fx.version, habits: fx.habits, settings: { tourDone: true, theme: 'system', weekStart: 'mon', motion: 'system' } }))})`);
const rows = [];
for (const w of [360, 768, 1280]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 1, mobile: w < 700 });
  for (const v of ['today', 'insights', 'settings']) {
    await go(`${base}/#/${v}`); await ev('location.reload()'); await sleep(900);
    const { data } = (await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).result;
    writeFileSync(join(out, `views-${v}-${w}.png`), Buffer.from(data, 'base64'));
    rows.push(`${v}@${w} scrollWidth=${await ev('document.documentElement.scrollWidth')} habits=${await ev("document.querySelectorAll('.habit').length")}`);
  }
}
console.log(rows.join('\n'));
// Offline: wait for an active worker, stop the server, reload, expect the app shell and saved habits.
await go(base + '/'); await sleep(1500);
console.log('sw state:', await ev(`navigator.serviceWorker.getRegistration().then(r => r && r.active ? r.active.state : 'none')`), 'caches:', await ev(`caches.keys().then(k => k.join(','))`));
srv.kill(); await sleep(500);
await go(base + '/');
console.log('offline h1:', await ev("document.querySelector('h1') && document.querySelector('h1').textContent"), 'habits rendered:', await ev("document.querySelectorAll('.habit').length"));
console.log('exceptions:', errs.length ? errs.join(' | ') : 'none');
done(0);
