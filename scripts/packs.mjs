#!/usr/bin/env node
// Lilac vertical packs: list, detect, validate, accounts, demand, demand-report.
// Usage: node scripts/packs.mjs list
//        node scripts/packs.mjs detect <BRIEF.md>     keyword guess; prints candidates to CONFIRM, never applies one
//        node scripts/packs.mjs validate <pack>       exit 1 on a missing file, >3 questions, bad table, no fallback, empty rights, bad or expired date
//        node scripts/packs.mjs accounts <pack>       every account/key the owner must supply; unset ones are UNKNOWN (no fake keys, values never printed)
//        node scripts/packs.mjs demand <vertical>     append to ./.lilac/pack-demand.json (local only; sharing is opt-in and not built)
//        node scripts/packs.mjs demand-report         count demand per vertical
// Offline: no network calls. Writes only .lilac/pack-demand.json through safe-fs.
// shortcut: pack.yaml is read as flat "key: value" plus a "- item" list (no nesting); detect is keyword counting, not understanding. Upgrade if packs need richer metadata.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoped } from '../lib/safe-fs.mjs';

const ROOT = process.env.LILAC_VERTICALS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', 'verticals');
const FILES = ['pack.yaml', 'brief.questions.md', 'requirements.yaml', 'integrations.md', 'rights.md'];
const COLS = ['integration', 'account', 'key', 'cost', 'licence', 'fallback'];
const KEYWORDS = {
  music: ['band', 'album', 'single', 'singer', 'musician', 'gig', 'tour', 'songs', 'spotify', 'bandcamp'],
  restaurant: ['restaurant', 'menu', 'table booking', 'chef', 'cafe', 'bistro'],
  'e-commerce': ['shop', 'store', 'cart', 'checkout', 'products', 'e-commerce', 'ecommerce'],
  photographer: ['photographer', 'photography', 'portfolio', 'wedding shoot'],
  fitness: ['gym', 'fitness', 'yoga', 'trainer', 'classes'],
  saas: ['saas', 'subscription software', 'pricing tiers', 'api docs'],
  'real estate': ['real estate', 'listings', 'property', 'realtor', 'estate agent'],
  events: ['event', 'conference', 'tickets', 'speakers'],
  podcast: ['podcast', 'episodes', 'host'],
  hotel: ['hotel', 'rooms', 'guesthouse', 'bed and breakfast'],
  clinic: ['clinic', 'patients', 'doctor', 'dentist', 'appointment'],
  nonprofit: ['nonprofit', 'non-profit', 'charity', 'donate', 'donation'],
  architecture: ['architect', 'architecture', 'interior design'],
  automotive: ['car dealer', 'dealership', 'automotive', 'test drive'],
  fashion: ['fashion', 'clothing', 'lookbook', 'apparel'],
};
const die = (m, c = 1) => { console.error(m); process.exit(c); };
const packDir = (p) => { if (!p || /[\\/]|\.\./.test(p)) die('packs: pack name only, no path'); return join(ROOT, p); };
const read = (f) => readFileSync(f, 'utf8');
const rows = (md) => md.split('\n').filter((l) => l.trim().startsWith('|')).map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())).filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
const table = (md) => { const [h, ...b] = rows(md); return { head: (h || []).map((c) => c.toLowerCase()), body: b }; };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const packs = () => existsSync(ROOT) ? readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
function meta(dir) { const m = { sources: [] }; for (const l of read(join(dir, 'pack.yaml')).split('\n')) { const s = l.match(/^\s*-\s+(.+)/), k = l.match(/^([a-z_]+):\s*(.*)$/); if (s) m.sources.push(s[1].trim()); else if (k && k[1] !== 'sources') m[k[1]] = k[2].trim(); } return m; }

function validate(name) {
  const dir = packDir(name), err = [];
  if (!existsSync(dir)) die(`packs: no pack "${name}"`);
  for (const f of FILES) if (!existsSync(join(dir, f))) err.push(`missing ${f}`);
  for (const d of ['blocks', 'tests']) if (!existsSync(join(dir, d))) err.push(`missing ${d}/`);
  let stale = false;
  if (existsSync(join(dir, 'pack.yaml'))) {
    const m = meta(dir);
    if (!m.version) err.push('pack.yaml: version missing');
    if (!m.sources.length) err.push('pack.yaml: sources empty');
    for (const k of ['last_verified', 'expires']) if (!isDate(m[k])) err.push(`pack.yaml: ${k} must be YYYY-MM-DD`);
    if (isDate(m.expires) && m.expires < new Date().toISOString().slice(0, 10)) stale = true;
  }
  if (existsSync(join(dir, 'brief.questions.md'))) { const n = read(join(dir, 'brief.questions.md')).split('\n').filter((l) => /^\s*(\d+[.)]|-)\s+\S/.test(l)).length; if (n > 3) err.push(`brief.questions.md: ${n} questions, max 3`); }
  if (existsSync(join(dir, 'integrations.md'))) {
    const { head, body } = table(read(join(dir, 'integrations.md')));
    if (COLS.some((c, i) => head[i] !== c) || head.length !== 6) err.push(`integrations.md: table needs the 6 columns ${COLS.join(' | ')}`);
    else for (const r of body) if (!r[5] || /^(-|none|n\/a)?$/i.test(r[5])) err.push(`integrations.md: "${r[0]}" has no fallback`);
  }
  if (existsSync(join(dir, 'rights.md')) && !read(join(dir, 'rights.md')).trim()) err.push('rights.md is empty');
  if (stale) err.push('stale: run research first');
  if (err.length) { err.forEach((e) => console.error(`FAIL ${name}: ${e}`)); process.exit(1); }
  console.log(`ok ${name}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'list') for (const p of packs()) { const f = join(ROOT, p, 'pack.yaml'); console.log(p + (existsSync(f) ? `  v${meta(join(ROOT, p)).version} expires ${meta(join(ROOT, p)).expires}` : '')); }
else if (cmd === 'validate') validate(arg);
else if (cmd === 'detect') {
  if (!arg || !existsSync(arg)) die('usage: detect <BRIEF.md>', 2);
  const t = read(arg).toLowerCase(), built = packs();
  const c = Object.entries(KEYWORDS).map(([v, ks]) => [v, ks.filter((k) => new RegExp(`\\b${k}`).test(t))]).filter(([, h]) => h.length).sort((a, b) => b[1].length - a[1].length);
  if (!c.length) console.log('No vertical detected. Nothing applied.');
  else { console.log('Candidates (CONFIRM with the owner; nothing is applied):'); for (const [v, h] of c) console.log(`  ${v}  (matched: ${h.join(', ')})  ${built.includes(v) ? 'pack available' : 'pack not built'}`); }
} else if (cmd === 'accounts') {
  const dir = packDir(arg); if (!existsSync(join(dir, 'integrations.md'))) die(`packs: no integrations.md for "${arg}"`);
  console.log('Account/key the owner must supply (never invented):');
  for (const r of table(read(join(dir, 'integrations.md'))).body) console.log(`  ${r[0]}: account ${r[1] || 'UNKNOWN'}, key ${r[2] || 'UNKNOWN'}: ${r[2] && process.env[r[2]] ? 'set in environment' : 'UNKNOWN'}`);
} else if (cmd === 'demand' || cmd === 'demand-report') {
  const f = join('.lilac', 'pack-demand.json'); let log = [];
  try { log = JSON.parse(read(f)); } catch { /* none yet */ }
  if (cmd === 'demand') {
    if (!arg || !/^[a-z0-9 -]{2,40}$/i.test(arg)) die('usage: demand <vertical>', 2);
    log.push({ vertical: arg.toLowerCase(), at: new Date().toISOString() });
    scoped(process.cwd()).write(f, JSON.stringify(log, null, 2) + '\n');
    console.log(`Logged locally in ${f}. Nothing is sent anywhere; sharing is opt-in only.`);
  } else { const n = {}; for (const e of log) n[e.vertical] = (n[e.vertical] || 0) + 1; const e = Object.entries(n).sort((a, b) => b[1] - a[1]); console.log(e.length ? e.map(([v, c]) => `${c}  ${v}`).join('\n') : 'No demand logged.'); }
} else die('usage: packs.mjs list | detect <BRIEF.md> | validate <pack> | accounts <pack> | demand <vertical> | demand-report', 2);
