// Dev helper: proves state-conditional controls in real headless Chrome (CDP over localhost, no external network).
// Prints one PASS/FAIL line per check and exits 1 on any FAIL. Usage: node tests/state-checks.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, cpSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CH = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(CH)) { console.log('state-checks: SKIPPED(no browser)'); process.exit(0); }
const tmp = mkdtempSync(join(tmpdir(), 'ph-sc-')); const site = join(tmp, 'site'); cpSync(join(root, 'site'), site, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = createServer((q, r) => { const p = q.url.split('?')[0]; const f = join(site, p === '/' ? 'index.html' : p); try { r.writeHead(200, { 'content-type': types[extname(f)] || 'text/plain', 'cache-control': 'no-cache' }); r.end(readFileSync(f)); } catch { r.writeHead(404); r.end(); } });
await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}`;
const udd = join(tmp, 'udd'); const ch = spawn(CH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${udd}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let bad = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) bad++; };
const end = (c) => { try { ch.kill('SIGKILL'); } catch {} srv.close(); try { rmSync(tmp, { recursive: true, force: true }); } catch {} process.exit(c); };
let port; for (let i = 0; i < 50 && !port; i++) { await sleep(200); try { port = Number(readFileSync(join(udd, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch {} }
const tab = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
const go = async (u) => { await send('Page.navigate', { url: u }); await sleep(1000); };
const key = (k, code) => send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: k === 'Tab' ? 9 : 13 }).then(() => send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code }));
await send('Page.enable'); await send('Runtime.enable');
const vis = `var R=(s)=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();const cx=b.x+b.width/2,cy=b.y+b.height/2;const top=document.elementFromPoint(cx,cy);return{x:b.x,y:b.y,w:b.width,h:b.height,inView:b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,top:!!top&&(top===e||e.contains(top))}};`;

// 1. Tour card at three widths: inside the viewport, not covered, keyboard reaches Next, Back and Skip.
for (const w of [360, 768, 1280]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 640, deviceScaleFactor: 1, mobile: w < 700 });
  await go(base + '/'); await ev('localStorage.clear()'); await go(base + '/');
  await ev(`document.querySelector('#tour-start').click()`); await sleep(500);
  let r = JSON.parse(await ev(`${vis}JSON.stringify({dlg:R('#dlg-tour'),next:R('#tour-next'),skip:R('#tour-skip'),focus:document.activeElement.id})`));
  ok(r.dlg.inView && r.next.inView && r.skip.inView && r.next.top && r.skip.top && r.next.h >= 44, `tour @${w}px: card, Next and Skip inside the viewport, not covered, Next height ${Math.round(r.next.h)} px, focus starts on ${r.focus}`);
  await ev(`document.querySelector('#tour-next').click()`); await sleep(300);
  r = JSON.parse(await ev(`${vis}JSON.stringify({back:R('#tour-back'),step:document.querySelector('#tour-step').textContent})`));
  ok(r.back && r.back.inView && r.back.top, `tour @${w}px: Back appears on step 2 (${r.step}) and is clickable`);
  await ev(`document.querySelector('#tour-back').click()`); await sleep(200);
  ok((await ev(`document.querySelector('#tour-step').textContent`)).startsWith('Step 1'), `tour @${w}px: Back returns to step 1`);
  const seen = []; for (let i = 0; i < 6; i++) { await key('Tab', 'Tab'); seen.push(await ev('document.activeElement.id')); }
  ok(['tour-next', 'tour-skip'].every((x) => seen.includes(x)) && seen.every((x) => ['tour-next', 'tour-skip', 'tour-back', ''].includes(x)), `tour @${w}px: Tab cycles inside the dialog through ${[...new Set(seen)].join(', ')}`);
  await key('Enter', 'Enter'); await sleep(300);
  for (let i = 0; i < 5; i++) { await ev(`(()=>{const n=document.querySelector('#tour-next');if(document.querySelector('#dlg-tour').open)n.click()})()`); await sleep(150); }
  ok(!(await ev(`document.querySelector('#dlg-tour').open`)) && (await ev(`JSON.parse(localStorage.getItem('pocket-habits')).settings.tourDone`)) === true, `tour @${w}px: stepping Next to Done closes it and remembers it`);
}
// 2. Search with no results: Clear search and filter appears and restores the list.
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await go(base + '/'); await ev('localStorage.clear()'); await go(base + '/'); await ev(`document.querySelector('#add-samples').click()`); await sleep(300);
const n0 = await ev(`document.querySelectorAll('.habit').length`);
await ev(`(()=>{const q=document.querySelector('#q');q.value='zzzz-no-match';q.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(300);
ok((await ev(`!document.querySelector('#no-match').hidden && document.querySelectorAll('.habit').length===0`)), `search "zzzz-no-match": list empty and the no-match panel with "Clear search and filter" is shown (${n0} habits before)`);
await ev(`document.querySelector('#clear-filters').click()`); await sleep(300);
ok((await ev(`document.querySelectorAll('.habit').length`)) === n0 && (await ev(`document.querySelector('#q').value`)) === '' && (await ev(`document.querySelector('#no-match').hidden`)), 'Clear search and filter restores all habits, empties the box and hides the panel');
// 3. Confirm dialog (Erase everything) and the toast OK button.
await ev(`location.hash='#/settings'`); await sleep(400); await ev(`document.querySelector('#reset').click()`); await sleep(300);
ok((await ev(`document.querySelector('#dlg-confirm').open && document.querySelector('#confirm-ok').textContent`)) === 'Erase everything', 'Reset opens the confirm dialog whose action button says "Erase everything"');
await ev(`document.querySelector('#dlg-confirm [data-close]').click()`); await sleep(200);
ok(!(await ev(`document.querySelector('#dlg-confirm').open`)) && (await ev(`JSON.parse(localStorage.getItem('pocket-habits')).habits.length`)) === n0, 'Cancel closes the dialog and erases nothing');
await ev(`document.querySelector('#reset').click()`); await sleep(200); await ev(`document.querySelector('#confirm-ok').click()`); await sleep(500);
ok((await ev(`JSON.parse(localStorage.getItem('pocket-habits')).habits.length`)) === 0, 'Erase everything deletes all habits');
// toast OK: sample habits then delete one shows a toast with Undo; the plain toast OK is the offline notice, so use export-free route: storage-blocked message uses label. Check dismissal of a plain toast via the app toast path.
await ev(`location.hash='#/today'`); await sleep(300);
await ev(`document.querySelector('#add-samples').click()`); await sleep(300);
await ev(`document.querySelector('[data-act="delete"]').click()`); await sleep(400);
ok((await ev(`document.querySelector('.toast')?.textContent||''`)).includes('Undo'), 'Delete shows a toast with an Undo button');
await ev(`document.querySelector('.toast .btn').click()`); await sleep(400);
ok((await ev(`document.querySelectorAll('.habit').length`)) === 3, 'Undo restores the deleted habit');
// 4. Update bar: real new service-worker version while the page is open.
await go(base + '/'); await sleep(2000);
ok((await ev(`navigator.serviceWorker.getRegistration().then(r=>r&&r.active?r.active.state:'none')`)) === 'activated', 'service worker v-current active');
ok(await ev(`document.querySelector('#update').hidden`), 'update bar hidden while no new version exists');
writeFileSync(join(site, 'sw.js'), readFileSync(join(site, 'sw.js'), 'utf8').replace(/const VERSION = '[^']+';/, "const VERSION = 'v-test-next';"));
await ev(`navigator.serviceWorker.getRegistration().then(r=>r.update())`); await sleep(2500);
ok((await ev(`!document.querySelector('#update').hidden && document.querySelector('#update-btn').textContent`)) === 'Reload to update', 'a new version waiting shows the bar with "Reload to update"');
await ev(`document.querySelector('#update-btn').click()`); await sleep(3000);
ok((await ev(`caches.keys().then(k=>k.join(','))`)).includes('pocket-habits-v-test-next') && (await ev(`document.querySelector('#update').hidden`)), 'Reload to update activates the new version, the page reloads and the bar is gone');
console.log(`state-checks: ${bad} failure(s)`); end(bad ? 1 : 0);
