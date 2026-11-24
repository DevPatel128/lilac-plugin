#!/usr/bin/env node
// visual-regression.mjs snapshot|check [--blocks dir] [--screenshots] [--shots dir]
// Fingerprints Lilac's own blocks so research-driven edits cannot silently drift them. No browser needed: per block it hashes the normalised DOM-tree outline
// (tags, depth, classes, attribute names, template tokens; literal text becomes T), the normalised CSS, and records the CSS custom properties used.
// snapshot writes <blocks>/.fingerprints.json; check compares and exits 1 listing changed, added and removed blocks (run snapshot after a reviewed change).
// --screenshots: if Chrome is found (like qa-browser.mjs), captures PNG baselines at 375/768/1280 into --shots (default <repo>/.lilac/visual, git-ignored); skips cleanly otherwise.
// Offline. shortcut: a fingerprint detects structure/CSS change, not pixels; screenshots are baselines to compare by eye or a tool, this script does not diff images.
import { readdirSync, readFileSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scoped } from '../lib/safe-fs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), cmd = args[0];
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const blocksDir = resolve(flag('--blocks') ?? join(here, '..', 'blocks'));
if (!['snapshot', 'check'].includes(cmd) || !existsSync(blocksDir)) { console.error('usage: visual-regression.mjs snapshot|check [--blocks dir] [--screenshots] [--shots dir]'); process.exit(2); }
const fpFile = join(blocksDir, '.fingerprints.json');
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

function outline(html) {
  const lines = []; let depth = 0; const VOID = /^(img|br|hr|input|meta|link|source|wbr)$/;
  for (const t of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g)) {
    if (t[4] !== undefined) { const text = t[4].trim(); if (text) lines.push(`${'  '.repeat(depth)}${(text.match(/{{[^}]*}}/g) ?? []).join('') || 'T'}`); continue; }
    const [, close, tag, rest] = t, name = tag.toLowerCase();
    if (close) { depth = Math.max(0, depth - 1); continue; }
    const names = [...rest.matchAll(/\s([a-zA-Z:@-][\w:-]*)(?==|\s|\/|$)/g)].map((m) => m[1]).filter((n) => n !== 'class').sort();
    const cls = (/class\s*=\s*"([^"]*)"/.exec(rest)?.[1] ?? '').split(/\s+/).filter(Boolean).sort().join('.');
    lines.push(`${'  '.repeat(depth)}${name}${cls ? '.' + cls : ''}[${names.join(',')}]`);
    if (!VOID.test(name) && !/\/\s*$/.test(rest)) depth++;
  }
  return lines.join('\n');
}
function fingerprint(dir) {
  const html = readFileSync(join(dir, 'block.html'), 'utf8'), cssFile = join(dir, 'block.css'), css = existsSync(cssFile) ? readFileSync(cssFile, 'utf8') : '';
  const vars = {}; for (const m of css.matchAll(/var\(\s*(--[\w-]+)/g)) vars[m[1]] = (vars[m[1]] ?? 0) + 1;
  const ordered = Object.fromEntries(Object.entries(vars).sort(([a], [b]) => (a < b ? -1 : 1)));
  return { html: sha(outline(html)), css: sha(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()), vars: ordered };
}
const blocks = readdirSync(blocksDir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_') && existsSync(join(blocksDir, e.name, 'block.html'))).map((e) => e.name).sort();
const current = Object.fromEntries(blocks.map((b) => [b, fingerprint(join(blocksDir, b))]));

let code = 0;
if (cmd === 'snapshot') {
  scoped(blocksDir).write('.fingerprints.json', JSON.stringify(current, null, 2) + '\n');
  console.log(`visual-regression: fingerprinted ${blocks.length} block(s) into ${fpFile}`);
} else {
  if (!existsSync(fpFile)) { console.error('visual-regression: no .fingerprints.json; run snapshot first.'); process.exit(2); }
  const base = JSON.parse(readFileSync(fpFile, 'utf8')), problems = [];
  for (const b of blocks) {
    if (!base[b]) { problems.push(`ADDED    ${b} (not in the snapshot)`); continue; }
    const why = ['html', 'css'].filter((k) => base[b][k] !== current[b][k]); if (JSON.stringify(base[b].vars) !== JSON.stringify(current[b].vars)) why.push('vars');
    if (why.length) problems.push(`CHANGED  ${b}: ${why.join(', ')}`);
  }
  for (const b of Object.keys(base)) if (!current[b]) problems.push(`REMOVED  ${b}`);
  problems.forEach((p) => console.log(p));
  console.log(problems.length ? `\n${problems.length} block difference(s). If intended and reviewed: visual-regression.mjs snapshot` : `visual-regression: ${blocks.length} block(s) match the snapshot.`);
  if (problems.length) code = 1;
}

if (args.includes('--screenshots')) {
  const onPath = (n) => (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').map((d) => join(d, n)).find((c) => c && existsSync(c));
  const win = ['ProgramFiles', 'ProgramFiles(x86)'].flatMap((v) => process.env[v] ? [join(process.env[v], 'Google/Chrome/Application/chrome.exe'), join(process.env[v], 'Microsoft/Edge/Application/msedge.exe')] : []);
  const CHROME = process.env.CHROME ? (existsSync(process.env.CHROME) ? process.env.CHROME : null) : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(onPath), ...win].find((c) => c && existsSync(c));
  if (!CHROME) console.log('visual-regression: screenshots SKIPPED(no browser)');
  else {
    const shots = resolve(flag('--shots') ?? join(here, '..', '..', '..', '.lilac', 'visual')), tmp = mkdtempSync(join(tmpdir(), 'lilac-vr-'));
    scoped(dirname(shots)).mkdir(shots);
    const baseCss = existsSync(join(blocksDir, '_base', 'base.css')) ? readFileSync(join(blocksDir, '_base', 'base.css'), 'utf8') : '';
    let n = 0;
    try {
      for (const b of blocks) {
        const d = join(blocksDir, b), css = existsSync(join(d, 'block.css')) ? readFileSync(join(d, 'block.css'), 'utf8') : '';
        const body = readFileSync(join(d, 'block.html'), 'utf8').replace(/{{#if[^}]*}}|{{\/if}}|{{else}}/g, '').replace(/{{[^}|]*\|([^}]*)}}/g, '$1').replace(/{{[^}]*}}/g, 'Sample');
        const page = join(tmp, b + '.html'); scoped(tmp).write(b + '.html', `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${baseCss}\n${css}</style><body>${body}</body>`);
        for (const w of [375, 768, 1280]) {
          const png = join(shots, `${b}-${w}.png`);
          try { execFileSync(CHROME, ['--headless=new', '--disable-gpu', ...(process.env.LILAC_CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), '--hide-scrollbars', `--user-data-dir=${join(tmp, 'p')}`, `--window-size=${w},900`, `--screenshot=${png}`, pathToFileURL(page).href], { stdio: 'ignore', timeout: 30000 }); n++; } catch { console.log(`visual-regression: screenshot failed for ${b} at ${w}`); }
        }
      }
    } finally { rmSync(tmp, { recursive: true, force: true }); }
    console.log(`visual-regression: ${n} screenshot(s) in ${shots}`);
  }
}
process.exit(code);
