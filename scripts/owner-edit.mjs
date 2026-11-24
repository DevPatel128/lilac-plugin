#!/usr/bin/env node
// owner-edit.mjs init <dir> | build-content <dir> | validate <dir>
// Owner edits content without an AI session: git-based, no server. Content lives in <dir>/content/*.json or *.md (menu, tour dates, hours).
//   init           scaffolds content/ (empty on purpose), templates/index.html and admin/edit.html (offline editor that exports the changed file)
//   build-content  renders content into templates/*.html at build time -> site/*.html. Static output: content is visible without JavaScript.
//                  Placeholder: {{content.<file-name>}}. Everything from content is HTML-escaped. Empty or missing content renders UNKNOWN.
//   validate       rejects invented facts: a placeholder with no content file, and any date (YYYY-MM-DD) or price ($/EUR/GBP + number) written in a template
//                  that is not present in a content file. Empty content files are reported as UNKNOWN (not an error). Exit 1 on any error.
// Offline: no network. Writes only under <dir> through safe-fs.
// shortcut: no login or write-back. admin/edit.html only exports a file; protect /admin at the host (password or access rule) or do not publish it.
//   Upgrade to a git-backed CMS when owners need accounts. Markdown is a small subset (headings, lists, bold, italic, paragraphs).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoped } from '../lib/safe-fs.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const [cmd, d] = process.argv.slice(2);
const die = (m, c = 1) => { console.error(`owner-edit: ${m}`); process.exit(c); };
const esc = (s) => String(s).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
const UNKNOWN = '<p class="unknown">UNKNOWN</p>';
const PH = /\{\{\s*content\.([A-Za-z0-9_-]+)\s*\}\}/g;
const DATE = /\b\d{4}-\d{2}-\d{2}\b/g, PRICE = /(?:[$€£]\s?\d[\d.,]*|\b\d[\d.,]*\s?(?:EUR|GBP|USD)\b)/g;
const blank = (v) => v == null || (typeof v === 'string' && !v.trim());

function loadContent(dir) {
  const cd = join(dir, 'content'), out = {};
  if (!existsSync(cd)) return out;
  for (const f of readdirSync(cd).sort()) {
    const ext = extname(f).toLowerCase(), n = basename(f, ext);
    if (!['.json', '.md'].includes(ext) || f.startsWith('.')) continue;
    const text = readFileSync(join(cd, f), 'utf8');
    if (ext === '.md') { out[n] = { file: f, kind: 'md', text, value: text }; continue; }
    try { out[n] = { file: f, kind: 'json', text, value: JSON.parse(text) }; } catch (e) { out[n] = { file: f, kind: 'bad', text, error: e.message }; }
  }
  return out;
}
const strings = (v) => (v == null ? [] : typeof v === 'object' ? Object.values(v).flatMap(strings) : [String(v)]);
const isEmpty = (v) => blank(v) || (Array.isArray(v) && !v.length) || (typeof v === 'object' && v && !Array.isArray(v) && !Object.keys(v).length) || (typeof v === 'object' && v && strings(v).every(blank));

function md(text) {
  const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const out = []; let list = false, para = [];
  const flush = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(), h = /^(#{1,3})\s+(.+)$/.exec(line), li = /^[-*]\s+(.+)$/.exec(line);
    if (li) { flush(); if (!list) out.push('<ul>'); list = true; out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    if (h) { flush(); out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); } else if (!line) flush(); else para.push(line);
  }
  flush(); if (list) out.push('</ul>');
  return out.join('\n');
}
const cell = (k, v) => `<span class="${esc(String(k).replace(/[^A-Za-z0-9_-]/g, ''))}">${blank(v) ? 'UNKNOWN' : esc(v)}</span>`;
function render(c) {
  if (!c) return UNKNOWN;
  if (c.kind === 'bad') return UNKNOWN;
  if (c.kind === 'md') return blank(c.text) ? UNKNOWN : md(c.text);
  const v = c.value;
  if (isEmpty(v)) return UNKNOWN;
  const items = Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : null;
  if (items) return `<ul>\n${items.map((it) => `<li>${it && typeof it === 'object' ? Object.entries(it).map(([k, x]) => cell(k, x)).join(' ') : esc(it)}</li>`).join('\n')}\n</ul>`;
  if (typeof v === 'object') return `<dl>\n${Object.entries(v).map(([k, x]) => `<dt>${esc(k)}</dt><dd>${blank(x) ? 'UNKNOWN' : esc(typeof x === 'object' ? JSON.stringify(x) : x)}</dd>`).join('\n')}\n</dl>`;
  return `<p>${esc(v)}</p>`;
}

const templates = (dir) => { const t = join(dir, 'templates'); return existsSync(t) ? readdirSync(t).filter((f) => f.endsWith('.html')).sort().map((f) => [f, readFileSync(join(t, f), 'utf8')]) : []; };

function validate(dir) {
  const c = loadContent(dir), errors = [], warns = [];
  const corpus = Object.values(c).filter((x) => x.kind !== 'bad').map((x) => (x.kind === 'md' ? x.text : strings(x.value).join('\n'))).join('\n');
  for (const x of Object.values(c)) {
    if (x.kind === 'bad') errors.push(`content/${x.file}: not valid JSON (${x.error})`);
    else if (x.kind === 'md' ? blank(x.text) : isEmpty(x.value)) warns.push(`content/${x.file}: empty, renders UNKNOWN`);
  }
  for (const [f, html] of templates(dir)) {
    for (const m of html.matchAll(PH)) if (!c[m[1]]) errors.push(`templates/${f}: {{content.${m[1]}}} has no content/${m[1]}.json or .md`);
    const stat = html.replace(PH, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
    for (const t of [...(stat.match(DATE) || []), ...(stat.match(PRICE) || [])]) if (!corpus.includes(t)) errors.push(`templates/${f}: "${t}" is not in any content file (invented fact; move it into content/ or remove it)`);
  }
  return { errors, warns };
}

if (!['init', 'build-content', 'validate'].includes(cmd) || !d) die('usage: owner-edit.mjs init <dir> | build-content <dir> | validate <dir>', 2);
const dir = resolve(d), fs = scoped(dir);

if (cmd === 'init') {
  const files = {
    'content/menu.json': '{\n  "items": []\n}\n',
    'content/tour-dates.json': '{\n  "items": []\n}\n',
    'content/hours.json': '{}\n',
    'content/about.md': '',
    'templates/index.html': '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Home</title></head>\n<body>\n<main>\n<h1>Home</h1>\n<h2>About</h2>\n{{content.about}}\n<h2>Menu</h2>\n{{content.menu}}\n<h2>Tour dates</h2>\n{{content.tour-dates}}\n<h2>Hours</h2>\n{{content.hours}}\n</main>\n</body></html>\n',
    'admin/edit.html': readFileSync(join(HERE, '../features/content/owner-edit/edit.html'), 'utf8'),
  };
  for (const [p, t] of Object.entries(files)) { if (existsSync(join(dir, p))) { console.log(`kept   ${p}`); continue; } fs.write(p, t, { overwrite: false }); console.log(`wrote  ${p}`); }
  console.log('Next: fill content/ with true facts, then `build-content`. Protect /admin at your host; it has no login.');
}
if (cmd === 'build-content') {
  const v = validate(dir);
  if (v.errors.length) { v.errors.forEach((e) => console.error(`ERROR ${e}`)); die(`${v.errors.length} problem(s); fix them, then build again`); }
  const c = loadContent(dir), ts = templates(dir);
  if (!ts.length) die('no templates/*.html (run init first)');
  for (const [f, html] of ts) { fs.write(`site/${f}`, html.replace(PH, (_, n) => render(c[n]))); console.log(`built  site/${f}`); }
  v.warns.forEach((w) => console.log(`UNKNOWN ${w}`));
}
if (cmd === 'validate') {
  const v = validate(dir);
  v.warns.forEach((w) => console.log(`UNKNOWN ${w}`)); v.errors.forEach((e) => console.error(`ERROR ${e}`));
  console.log(`validate: ${v.errors.length} error(s), ${v.warns.length} UNKNOWN`);
  process.exit(v.errors.length ? 1 : 0);
}
