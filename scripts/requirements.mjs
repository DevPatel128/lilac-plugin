#!/usr/bin/env node
// Lilac requirements: turns BRIEF.md into brief/requirements.yaml, a checkable list of EARS requirements.
// Usage: node scripts/requirements.mjs generate <dir>          reads <dir>/BRIEF.md, writes <dir>/brief/requirements.yaml (never invents facts)
//        node scripts/requirements.mjs list <dir> [--must]     table of items; "counted" = accepted only
//        node scripts/requirements.mjs accept <dir> <id>       proposed -> accepted (extras Lilac suggests are never counted before this)
//        node scripts/requirements.mjs ambiguity <dir>         at most 3 clarifying questions, one per vague word
//        node scripts/requirements.mjs check <dir>             validates the file, exit 1 on problems
// Item: id (R-001 requirement, N-001 anti-requirement from "Must not claim"), ears ("WHEN <trigger> THE SITE SHALL <response>"),
//   priority (must|should|could), source (the user's verbatim line), verify (dom|visual|content|behavior|perf|a11y|manual), status (accepted|proposed).
// Offline and dependency-free: no network, no child processes. Writes only inside <dir> through lib/safe-fs.mjs.
// shortcut: the YAML is a flat list of double-quoted scalars (JSON strings), parsed only by this file; not a general YAML parser. Splitting Pages and Must-not-claim is by comma, newline, bullet and full stop, so odd punctuation can split badly: edit the file by hand and run check.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoped } from '../lib/safe-fs.mjs';

const PRIORITY = ['must', 'should', 'could'];
const VERIFY = ['dom', 'visual', 'content', 'behavior', 'perf', 'a11y', 'manual'];
const STATUS = ['accepted', 'proposed'];
const KEYS = ['id', 'ears', 'priority', 'source', 'verify', 'status'];
const EARS = /^WHEN .+ THE SITE SHALL( NOT)? .+/;
const VAGUE = ['modern', 'premium', 'clean', 'nice', 'professional', 'beautiful', 'user-friendly', 'best', 'world-class', 'innovative', 'stunning', 'minimal', 'sleek', 'elegant', 'fresh', 'simple', 'fast', 'something like'];
const REL = 'brief/requirements.yaml';

export function sections(text) {
  const s = {}; let cur = null;
  for (const line of text.replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
    const h = line.match(/^##\s+(.*?)\s*$/);
    if (h) { cur = h[1].toLowerCase(); s[cur] = []; } else if (cur) s[cur].push(line);
  }
  return (name) => Object.entries(s).find(([k]) => k.startsWith(name.toLowerCase()))?.[1].join('\n').trim() ?? '';
}
const bullets = (t) => t.split('\n').map((l) => l.replace(/^[-*\s]+/, '').trim()).filter(Boolean);
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export function generate(text) {
  const get = sections(text), items = [];
  let r = 0, n = 0;
  const add = (kind, ears, priority, source, verify, status = 'accepted') => {
    const id = kind === 'N' ? `N-${String(++n).padStart(3, '0')}` : `R-${String(++r).padStart(3, '0')}`;
    items.push({ id, ears, priority, source, verify, status });
  };
  const action = bullets(get('Main action')).join(' ');
  if (action) add('R', `WHEN a visitor arrives THE SITE SHALL let them ${lower(action.replace(/\.$/, ''))}`, 'must', action, 'behavior');
  for (const line of bullets(get('Pages')))
    for (const page of line.split(/,|;|\band\b/).map((x) => x.replace(/\.$/, '').trim()).filter(Boolean))
      add('R', `WHEN a visitor opens the ${page} page THE SITE SHALL show the ${page} page`, 'should', page, 'dom');
  for (const fact of bullets(get('Facts')))
    if (!/^use placeholders/i.test(fact)) add('R', `WHEN a visitor reads the site THE SITE SHALL state: ${fact.replace(/\.$/, '')}`, 'should', fact, 'content');
  for (const line of bullets(get('Must not claim')))
    for (const c of line.split(/\.\s+|\.$|;/).map((x) => x.trim()).filter(Boolean))
      add('N', `WHEN the site publishes any text THE SITE SHALL NOT claim: ${c.replace(/^no\s+/i, '')}`, 'must', c, 'content');
  const success = bullets(get('Success')).join(' ');
  if (success) add('R', `WHEN the site is live THE SITE SHALL allow this to be measured: ${success.replace(/\.$/, '')}`, 'could', success, 'manual');
  // Extras Lilac suggests: proposed, never counted until accepted.
  const hint = 'proposed by Lilac';
  add('R', 'WHEN a visitor uses only a keyboard THE SITE SHALL let them reach every link and control with a visible focus', 'should', hint, 'a11y', 'proposed');
  add('R', 'WHEN a visitor opens any page on a 375 px wide screen THE SITE SHALL not scroll sideways', 'should', hint, 'visual', 'proposed');
  add('R', 'WHEN a visitor loads the home page on a mid-range phone THE SITE SHALL show the main content within 2.5 seconds', 'could', hint, 'perf', 'proposed');
  return items;
}

export function emit(items) {
  const out = ['# Lilac requirements (EARS). Proposed items are not counted until: node scripts/requirements.mjs accept <dir> <id>', 'requirements:'];
  for (const it of items) KEYS.forEach((k, i) => out.push(`${i ? '    ' : '  - '}${k}: ${JSON.stringify(it[k] ?? '')}`));
  return out.join('\n') + '\n';
}

export function parse(text) {
  const items = []; let cur = null;
  for (const raw of text.split('\n')) {
    const m = raw.match(/^(\s*- |\s+)(\w+): (.*)$/);
    if (!m) continue;
    if (m[1].includes('-')) items.push((cur = {}));
    if (!cur) continue;
    let v = m[3].trim();
    try { v = v.startsWith('"') ? JSON.parse(v) : v; } catch { /* keep raw; check reports it */ }
    cur[m[2]] = v;
  }
  return items;
}

export function validate(items) {
  const p = [], seen = new Set();
  if (!items.length) p.push('no items');
  for (const it of items) {
    const w = it.id || '(no id)';
    if (!/^[RN]-\d{3,}$/.test(it.id ?? '')) p.push(`${w}: bad id`);
    else if (seen.has(it.id)) p.push(`${w}: duplicate id`); else seen.add(it.id);
    if (!EARS.test(it.ears ?? '')) p.push(`${w}: ears is not "WHEN <trigger> THE SITE SHALL <response>"`);
    if (!PRIORITY.includes(it.priority)) p.push(`${w}: priority must be ${PRIORITY.join('|')}`);
    if (!VERIFY.includes(it.verify)) p.push(`${w}: verify must be ${VERIFY.join('|')}${it.priority === 'must' ? ' (every must needs a verify method)' : ''}`);
    if (!STATUS.includes(it.status)) p.push(`${w}: status must be ${STATUS.join('|')}`);
    if (it.status === 'accepted' && !(it.source ?? '').trim()) p.push(`${w}: accepted item has no source`);
  }
  return p;
}

export function ambiguity(text) {
  const clean = sections(text);
  const body = ['Audience', 'Main action', 'Facts', 'Must not claim', 'Tone', 'Pages', 'Constraints', 'Success'].map(clean).join('\n').replace(/https?:\/\/\S+/g, '');
  const qs = [];
  for (const w of VAGUE)
    if (new RegExp(`(^|[^\\w-])${w.replace(/-/g, '[- ]?')}\\b`, 'i').test(body))
      qs.push(`You wrote "${w}". Name one website that shows it, or write the sentence you would put on the page.`);
  return qs.slice(0, 3);
}

function load(dir) {
  const f = join(resolve(dir), REL);
  if (!existsSync(f)) { console.error(`requirements: ${f} not found. Run: requirements.mjs generate <dir>`); process.exit(2); }
  return parse(readFileSync(f, 'utf8'));
}

function counts(items) {
  const a = items.filter((i) => i.status === 'accepted');
  return `${a.length} accepted (counted), ${items.length - a.length} proposed (not counted); must: ${a.filter((i) => i.priority === 'must').length}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, dir, ...rest] = process.argv.slice(2);
  if (!cmd || !dir) { console.error('Usage: requirements.mjs generate|list|accept|ambiguity|check <dir> [id|--must]'); process.exit(2); }
  const root = resolve(dir);
  if (cmd === 'generate') {
    const b = join(root, 'BRIEF.md');
    if (!existsSync(b)) { console.error(`requirements: ${b} not found`); process.exit(2); }
    const items = generate(readFileSync(b, 'utf8'));
    scoped(root).write(REL, emit(items));
    console.log(`requirements: wrote ${join(root, REL)}: ${counts(items)}`);
  } else if (cmd === 'list') {
    const items = load(dir).filter((i) => !rest.includes('--must') || (i.priority === 'must' && i.status === 'accepted'));
    console.log(['id', 'prio', 'verify', 'status', 'ears'].map((h, i) => h.padEnd([6, 7, 9, 10, 0][i])).join(''));
    for (const i of items) console.log(`${i.id.padEnd(6)}${i.priority.padEnd(7)}${i.verify.padEnd(9)}${i.status.padEnd(10)}${i.ears}`);
    console.log(counts(load(dir)));
  } else if (cmd === 'accept') {
    const id = rest[0], items = load(dir), it = items.find((x) => x.id === id);
    if (!it) { console.error(`requirements: no item ${id}`); process.exit(1); }
    it.status = 'accepted';
    scoped(root).write(REL, emit(items));
    console.log(`requirements: ${id} accepted. ${counts(items)}`);
  } else if (cmd === 'ambiguity') {
    const b = join(root, 'BRIEF.md');
    if (!existsSync(b)) { console.error(`requirements: ${b} not found`); process.exit(2); }
    const qs = ambiguity(readFileSync(b, 'utf8'));
    console.log(qs.length ? qs.map((q) => `- ${q}`).join('\n') : 'No vague words found. Zero questions.');
  } else if (cmd === 'check') {
    const items = load(dir), p = validate(items);
    if (p.length) { p.forEach((x) => console.log(`FAIL ${x}`)); process.exit(1); }
    console.log(`requirements: OK, ${counts(items)}`);
  } else { console.error(`requirements: unknown command ${cmd}`); process.exit(2); }
}
