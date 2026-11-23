#!/usr/bin/env node
// Lilac blocks: a library of pre-tested, accessible building blocks and three art directions (token sets + layout CSS).
// Usage: node scripts/blocks.mjs list
//        node scripts/blocks.mjs add <dir> <block> [--direction name]     copy a block's html/css/js into <dir>/site/ (never overwrites), print include lines
//        node scripts/blocks.mjs assemble <dir> --pages <spec.json> --direction <name>   build static example pages into <dir>/site/ (deterministic)
//        node scripts/blocks.mjs check [--no-demo]                         verify the library, then assemble one demo per direction and run the gates
// Library: operations/plugin/blocks/<block>/{block.html,block.css,[block.js],block.md}, blocks/_base/, blocks/directions/<name>/{tokens.json,direction.css}.
//        node scripts/blocks.mjs strip <siteDir>                           remove every data-req="..." attribute from the .html files under <siteDir> (production; idempotent; symlinks never followed)
//        node scripts/blocks.mjs reqs <siteDir> [--json]                   list each data-req id and the html files (relative to <siteDir>) that carry it; --json prints {"R-004":["index.html"]}
// Requirement tags: a block entry in the pages spec may carry "req":"R-004"; assemble then puts data-req="R-004" on that block's root element (dev builds). Run strip before shipping.
// Template syntax in block.html: {{slot}} (escaped), {{slot|default}}, {{#each list}}..{{/each}} with {{.field}} {{.}} {{@n}} (1-based) {{@i}}, {{#if x}}, {{#unless x}}.
// Offline and dependency-free. Writes only into <dir> (add, assemble) or a temp dir (check demos). Env LILAC_BLOCKS_DIR points at another library (used by tests).
// check runs qa.mjs, qa-browser.mjs and controls-test.mjs on each demo; the two browser tools print SKIPPED when no Chrome exists and then count as skipped, not passed.
// shortcut: colour check knows hex, rgb/hsl/hwb/lab/lch/oklab/oklch and 17 colour names; upgrade when a block needs wider syntax.
// shortcut: assemble puts site-header and consent before <main> and footer after it; other layouts need hand editing.
import { existsSync, readFileSync, readdirSync, lstatSync, statSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { scoped } from '../lib/safe-fs.mjs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { genCss, hex6, ratio } from './foundation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(process.env.LILAC_BLOCKS_DIR || join(HERE, '..', 'blocks'));
const RESERVED = new Set(['_base', 'directions', 'demo']);
const PRE_MAIN = new Set(['site-header', 'consent']), POST_MAIN = new Set(['footer']);
const read = (f) => readFileSync(f, 'utf8');
const isDir = (d) => existsSync(d) && statSync(d).isDirectory();
const blockNames = () => readdirSync(LIB).filter((n) => !RESERVED.has(n) && !n.startsWith('.') && isDir(join(LIB, n))).sort();
const directionNames = () => (isDir(join(LIB, 'directions')) ? readdirSync(join(LIB, 'directions')).filter((n) => isDir(join(LIB, 'directions', n))).sort() : []);
const die = (m, code = 2) => { console.error(`blocks: ${m}`); process.exit(code); };

// ---- templates
const TOK = /\{\{\s*(?:(#each|#if|#unless)\s+([.@\w]+)|\/(each|if|unless)|([.@\w]+)(?:\|([^}]*))?)\s*\}\}/g;
export function parse(src) {
  const root = { c: [] }, st = [root]; let last = 0;
  for (const m of src.matchAll(TOK)) {
    const cur = st.at(-1);
    if (m.index > last) cur.c.push({ t: 'text', v: src.slice(last, m.index) });
    last = m.index + m[0].length;
    if (m[1]) { const n = { t: m[1].slice(1), name: m[2], c: [] }; cur.c.push(n); st.push(n); }
    else if (m[3]) { if (st.length < 2 || st.at(-1).t !== m[3]) throw new Error(`unbalanced {{/${m[3]}}}`); st.pop(); }
    else cur.c.push({ t: 'var', name: m[4], def: m[5] });
  }
  if (last < src.length) st.at(-1).c.push({ t: 'text', v: src.slice(last) });
  if (st.length > 1) throw new Error(`unclosed {{#${st.at(-1).t}}}`);
  return root.c;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const truthy = (v) => v !== undefined && v !== null && v !== false && v !== '' && !(Array.isArray(v) && !v.length);
function look(name, sc) {
  if (name === '.') return sc.at(-1).v;
  if (name === '@n') return sc.at(-1).i + 1;
  if (name === '@i') return sc.at(-1).i;
  if (name[0] === '.') { const o = sc.at(-1).v; return o !== null && typeof o === 'object' ? o[name.slice(1)] : undefined; }
  for (let i = sc.length - 1; i >= 0; i--) { const o = sc[i].v; if (o !== null && typeof o === 'object' && !Array.isArray(o) && name in o) return o[name]; }
  return undefined;
}
function render(nodes, sc, who) {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') out += n.v;
    else if (n.t === 'var') {
      const v = look(n.name, sc);
      if (v === undefined || v === null) { if (n.def === undefined) throw new Error(`block ${who}: slot "${n.name}" has no value and no default`); out += esc(n.def); }
      else if (typeof v === 'object') throw new Error(`block ${who}: slot "${n.name}" is a list or object, not text`);
      else out += esc(v);
    } else if (n.t === 'if' || n.t === 'unless') { if (truthy(look(n.name, sc)) === (n.t === 'if')) out += render(n.c, sc, who); }
    else { const a = look(n.name, sc); if (!Array.isArray(a)) throw new Error(`block ${who}: slot "${n.name}" must be a list`); a.forEach((v, i) => { out += render(n.c, [...sc, { v, i }], who); }); }
  }
  return out;
}
function slotNames(nodes, acc = new Set()) { for (const n of nodes) { if (n.t === 'var' || n.t === 'each' || n.t === 'if' || n.t === 'unless') if (!n.name.startsWith('@')) acc.add(n.name); if (n.c) slotNames(n.c, acc); } return acc; }
export function renderBlock(name, slots) {
  const nodes = parse(read(join(LIB, name, 'block.html')));
  const top = new Set([...slotNames(nodes)].filter((x) => !x.startsWith('.')));
  // top-level names declared only inside an #each are item fields, which slotNames records with a leading dot; bare names inside #each would be a template bug
  for (const k of Object.keys(slots)) if (!top.has(k) && k !== 'variant') throw new Error(`block ${name}: unknown slot "${k}" (known: ${[...top].join(', ')})`);
  return render(nodes, [{ v: slots, i: 0 }], name).trim();
}

// ---- colour, motion, url rules (shared by check)
const NAMES = 'white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|brown|silver|gold|navy|teal|cyan|magenta';
export function literalColours(css) {
  const out = [], clean = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  for (const m of clean.matchAll(/([\w-]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
    const v = m[2].replace(/var\(\s*--[\w-]+/g, 'var(');
    const hit = v.match(new RegExp(`#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(|\\b(?:${NAMES})\\b`, 'i'));
    if (hit) out.push(`${m[1]}: ${m[2].trim()}`);
  }
  return out;
}
export function motionProblems(css) {
  const out = [], clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/(^|[;{}\s])transition(?:-property)?\s*:\s*([^;}]+)/g)) {
    const props = m[0].includes('transition-property') ? m[2].split(',') : m[2].replace(/var\([^)]*\)/g, '').split(',').map((p) => p.trim().split(/\s+/)[0]);
    for (const p of props.map((x) => x.trim())) if (p && !['transform', 'opacity', 'none'].includes(p)) out.push(`transition on "${p}": only transform and opacity may animate`);
  }
  for (const k of clean.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) for (const d of k[1].matchAll(/([\w-]+)\s*:/g)) if (!['transform', 'opacity'].includes(d[1])) out.push(`keyframes animate "${d[1]}": only transform and opacity may animate`);
  if (/\btransition\s*:|\banimation(?:-name)?\s*:/.test(clean.replace(/transition\s*:\s*none/g, '')) && !/prefers-reduced-motion/.test(clean)) out.push('uses transition or animation without a prefers-reduced-motion rule');
  return out;
}
const externalUrls = (t) => [...t.matchAll(/https?:\/\/[^\s"')<>]+|(?:src|href|action)\s*=\s*["']?\/\/[^\s"'>]+|url\(\s*["']?\/\/[^)]+/gi)].map((m) => m[0]);
const inlineHandlers = (h) => [...h.matchAll(/<[a-z][^>]*\son[a-z]+\s*=|javascript:|<script(?![^>]*\ssrc=)[^>]*>|\sstyle\s*=/gi)].map((m) => m[0].trim().slice(-30));

// ---- list / add
function describe(name) {
  const md = join(LIB, name, 'block.md');
  if (!existsSync(md)) return '(no block.md)';
  const first = read(md).split('\n').slice(1).find((l) => l.trim() && !l.startsWith('#'));
  return (first ?? '').replace(/`/g, '').slice(0, 110);
}
function list() {
  console.log('Blocks:');
  for (const n of blockNames()) console.log(`  ${n.padEnd(24)} ${describe(n)}${existsSync(join(LIB, n, 'block.js')) ? ' [js]' : ''}`);
  console.log('Directions:');
  for (const n of directionNames()) { const t = JSON.parse(read(join(LIB, 'directions', n, 'tokens.json'))); console.log(`  ${n.padEnd(24)} ${t.fonts?.display?.split(',')[0].replace(/"/g, '')}, radius ${t.radius?.md}`); }
}
function put(src, dest, root) {
  if (existsSync(dest)) { console.log(`skip (exists): ${relative(root, dest)}`); return false; }
  scoped(root).copy(src, dest, { overwrite: false }); console.log(`wrote: ${relative(root, dest)}`); return true;
}
function add(dir, block, direction) {
  if (!blockNames().includes(block)) die(`unknown block "${block}". Known: ${blockNames().join(', ')}`);
  if (direction && !directionNames().includes(direction)) die(`unknown direction "${direction}". Known: ${directionNames().join(', ')}`);
  const root = resolve(dir), site = join(root, 'site');
  if (!isDir(root)) die(`folder not found: ${root}`);
  const B = join(LIB, block), A = join(site, 'assets', 'blocks'), inc = [];
  put(join(LIB, '_base', 'base.css'), join(A, 'base.css'), root); put(join(LIB, '_base', 'base.js'), join(A, 'base.js'), root);
  put(join(B, 'block.html'), join(site, 'blocks', `${block}.html`), root);
  put(join(B, 'block.css'), join(A, `${block}.css`), root);
  const hasJs = existsSync(join(B, 'block.js')); if (hasJs) put(join(B, 'block.js'), join(A, `${block}.js`), root);
  if (direction) {
    put(join(LIB, 'directions', direction, 'direction.css'), join(site, 'assets', 'direction.css'), root);
    put(join(LIB, 'directions', direction, 'tokens.json'), join(root, 'brand', `${direction}.tokens.json`), root);
    const tk = join(site, 'assets', 'tokens.css');
    if (!existsSync(tk)) { const bt = join(root, 'brand', 'tokens.css'); if (existsSync(bt)) put(bt, tk, root); else { scoped(root).write(tk, genCss(JSON.parse(read(join(LIB, 'directions', direction, 'tokens.json'))))); console.log(`wrote: ${relative(root, tk)}`); } }
  }
  console.log(`\nAdd to the <head> of each page (in this order):\n  <script src="assets/blocks/base.js"></script>\n  <link rel="stylesheet" href="assets/tokens.css">\n  <link rel="stylesheet" href="assets/blocks/base.css">\n  <link rel="stylesheet" href="assets/blocks/${block}.css">${direction ? '\n  <link rel="stylesheet" href="assets/direction.css">' : ''}`);
  if (hasJs) console.log(`Before </body>:\n  <script src="assets/blocks/${block}.js" defer></script>`);
  console.log(`Paste the markup from site/blocks/${block}.html where it belongs, replace every {{slot}} with the brief's TRUE content (or text marked SAMPLE), and put id="top" on <body>.`);
  console.log(`Then re-run the gates: qa.mjs, qa-browser.mjs, controls-test.mjs. Do not change the block's accessibility behaviour without re-running them.`);
}

// ---- assemble
const faviconFor = (t) => `<svg viewBox="0 0 32 32" role="img" aria-label="Sample icon"><rect width="32" height="32" rx="6" fill="${t.colors.light.accent}"/><circle cx="16" cy="16" r="7" fill="${t.colors.light['accent-text']}"/></svg>\n`;
export function assemble(dir, specFile, direction) {
  if (!directionNames().includes(direction)) throw new Error(`unknown direction "${direction}". Known: ${directionNames().join(', ')}`);
  const spec = JSON.parse(read(specFile)), D = join(LIB, 'directions', direction), tokens = JSON.parse(read(join(D, 'tokens.json')));
  const root = resolve(dir), site = join(root, 'site'), A = join(site, 'assets'), AB = join(A, 'blocks');
  const SW = scoped(root, { throws: true }), w = (f, s) => SW.write(f, s); // refuses symlinks (security review M-2); the caller prints the error
  w(join(A, 'tokens.css'), genCss(tokens)); w(join(A, 'direction.css'), read(join(D, 'direction.css'))); w(join(A, 'favicon.svg'), faviconFor(tokens));
  w(join(AB, 'base.css'), read(join(LIB, '_base', 'base.css'))); w(join(AB, 'base.js'), read(join(LIB, '_base', 'base.js')));
  const lang = spec.site?.lang ?? 'en', written = [];
  for (const page of spec.pages) {
    const pre = [], main = [], post = [], used = [];
    for (let entry of page.blocks) {
      if (typeof entry === 'string') { entry = spec.common?.[entry]; if (!entry) throw new Error(`page ${page.file}: "${entry}" is not in "common"`); }
      const name = entry.block; if (!blockNames().includes(name)) throw new Error(`page ${page.file}: unknown block "${name}"`);
      const slots = JSON.parse(JSON.stringify(entry.slots ?? {}));
      const variant = entry.variant && typeof entry.variant === 'object' ? entry.variant[direction] : entry.variant;
      if (variant) slots.variant = variant;
      if (name === 'site-header') for (const l of slots.links ?? []) { if (l.current_on !== undefined) { if (l.current_on === page.file) l.current = 'yes'; delete l.current_on; } }
      if (name === 'testimonial-placeholder' && !/SAMPLE/.test(String(slots.quote ?? ''))) throw new Error(`page ${page.file}: testimonial-placeholder quote must contain the word SAMPLE`);
      let html = renderBlock(name, slots);
      if (entry.req !== undefined) html = tagReq(html, entry.req);
      (PRE_MAIN.has(name) ? pre : POST_MAIN.has(name) ? post : main).push(html);
      if (!used.includes(name)) used.push(name);
    }
    const css = used.map((n) => `<link rel="stylesheet" href="assets/blocks/${n}.css">`), js = [];
    for (const n of used) {
      w(join(AB, `${n}.css`), read(join(LIB, n, 'block.css')));
      if (existsSync(join(LIB, n, 'block.js'))) { w(join(AB, `${n}.js`), read(join(LIB, n, 'block.js'))); js.push(`<script src="assets/blocks/${n}.js" defer></script>`); }
    }
    const doc = `<!doctype html>
<html lang="${esc(lang)}" data-direction="${esc(direction)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<script src="assets/blocks/base.js"></script>
<link rel="stylesheet" href="assets/tokens.css">
<link rel="stylesheet" href="assets/blocks/base.css">
${css.join('\n')}
<link rel="stylesheet" href="assets/direction.css">
</head>
<body id="top">
<a class="skip" href="#main">Skip to content</a>
${pre.join('\n')}
<main id="main" tabindex="-1">
${main.join('\n')}
</main>
${post.join('\n')}
${js.join('\n')}
</body>
</html>
`;
    w(join(site, page.file), doc); written.push(page.file);
  }
  return written;
}

// ---- requirement tags (data-req)
const REQ_ID = /^[A-Za-z][\w.-]{0,31}$/;
const TAG = /<[a-zA-Z][^\s>\/]*(?:"[^"]*"|'[^']*'|[^'">])*>/g; // only attributes inside tags are touched, never text or script bodies
const REQ_ATTR = /\sdata-req=(?:"([^"]*)"|'([^']*)')/g;
const tagReq = (html, req) => { if (!REQ_ID.test(String(req))) throw new Error(`req "${req}" must look like R-004 (letters, digits, . _ -)`); return html.replace(/<[a-zA-Z][\w-]*/, (m) => `${m} data-req="${req}"`); };
// shortcut: html files are found by extension .html/.htm, symlinked files and folders are skipped silently; node_modules is skipped.
function htmlFiles(root, rel = '') {
  const out = [];
  for (const e of readdirSync(join(root, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...htmlFiles(root, r)); }
    else if (e.isFile() && /\.html?$/i.test(e.name)) out.push(r);
  }
  return out;
}
export function strip(dir) {
  const root = resolve(dir); if (!isDir(root) || lstatSync(root).isSymbolicLink()) throw new Error(`folder not found: ${root}`);
  const W = scoped(root, { throws: true }); let files = 0, attrs = 0;
  for (const f of htmlFiles(root)) {
    const src = read(join(root, f)); let n = 0;
    const out = src.replace(TAG, (t) => t.replace(REQ_ATTR, () => { n++; return ''; }));
    if (n) { W.write(join(root, f), out); files++; attrs += n; }
  }
  return { files, attrs };
}
export function reqs(dir) {
  const root = resolve(dir); if (!isDir(root) || lstatSync(root).isSymbolicLink()) throw new Error(`folder not found: ${root}`);
  const map = {};
  for (const f of htmlFiles(root)) for (const t of read(join(root, f)).match(TAG) ?? []) for (const m of t.matchAll(REQ_ATTR)) { const id = m[1] ?? m[2]; (map[id] ??= []); if (!map[id].includes(f)) map[id].push(f); }
  return Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
}

// ---- check
const LIGHT_DARK_PAIRS = [['text', 'bg'], ['muted', 'bg'], ['muted', 'surface'], ['text', 'surface'], ['accent-text', 'accent'], ['link', 'bg'], ['link', 'surface'], ['danger', 'bg'], ['success', 'bg'], ['primary', 'bg'], ['focus', 'bg']];
const ROLES = ['bg', 'surface', 'text', 'muted', 'primary', 'accent', 'accent-text', 'link', 'danger', 'success', 'focus'];
const GROUPS = ['fonts', 'fontSizes', 'lineHeight', 'space', 'radius', 'shadow', 'duration', 'easing'];
const msOf = (v) => { const m = String(v).trim().match(/^(\d*\.?\d+)(ms|s)$/); return m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : null; };
export function tokenProblems(t) {
  const out = [];
  for (const mode of ['light', 'dark']) {
    const c = t.colors?.[mode]; if (!c) { out.push(`colors.${mode} missing`); continue; }
    const miss = ROLES.filter((k) => !hex6(c[k] ?? '')); if (miss.length) { out.push(`colors.${mode} needs valid hex for ${miss.join(', ')}`); continue; }
    for (const [a, b] of LIGHT_DARK_PAIRS) { const r = ratio(c[a], c[b]); if (r < 4.5) out.push(`contrast (${mode}) ${a} on ${b} is ${r.toFixed(2)}:1, needs 4.5:1`); }
  }
  for (const g of GROUPS) if (!t[g] || !Object.keys(t[g]).length) out.push(`group "${g}" missing`);
  for (const [k, v] of Object.entries(t.duration ?? {})) { const n = msOf(v); if (n === null || n > 600) out.push(`duration ${k} "${v}" must be 0 to 600 ms`); }
  for (const [k, v] of Object.entries(t.fonts ?? {})) if (/https?:|\/\/|url\(/i.test(v)) out.push(`font ${k} has a remote URL`);
  return out;
}
const defined = (css) => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
function checkLibrary(E) {
  const names = blockNames(), dirs = directionNames(), allCss = [];
  const tokenCss = dirs.length ? genCss(JSON.parse(read(join(LIB, 'directions', dirs[0], 'tokens.json')))) : '';
  if (!names.length) E('library has no blocks');
  for (const f of ['base.css', 'base.js']) if (!existsSync(join(LIB, '_base', f))) E(`_base/${f} is missing`);
  const checkCss = (label, css) => {
    allCss.push(css);
    for (const c of literalColours(css)) E(`${label}: literal colour (${c}). Use var(--color-*)`);
    for (const m of motionProblems(css)) E(`${label}: ${m}`);
    for (const u of externalUrls(css)) E(`${label}: external URL ${u}`);
  };
  if (existsSync(join(LIB, '_base', 'base.css'))) checkCss('_base/base.css', read(join(LIB, '_base', 'base.css')));
  for (const n of names) {
    const B = join(LIB, n);
    for (const f of ['block.html', 'block.css', 'block.md']) if (!existsSync(join(B, f))) E(`${n}: ${f} is missing`);
    if (!existsSync(join(B, 'block.html')) || !existsSync(join(B, 'block.md'))) continue;
    const html = read(join(B, 'block.html')), md = read(join(B, 'block.md')), js = existsSync(join(B, 'block.js')) ? read(join(B, 'block.js')) : '';
    if (existsSync(join(B, 'block.css'))) checkCss(`${n}/block.css`, read(join(B, 'block.css')));
    for (const h of inlineHandlers(html)) E(`${n}/block.html: inline handler, inline script or inline style (${h}). Use a class and block.js/block.css`);
    for (const u of [...externalUrls(html), ...externalUrls(js)]) E(`${n}: external URL ${u}`);
    for (const h of inlineHandlers(js).filter((x) => /javascript:/.test(x))) E(`${n}/block.js: javascript: URL`);
    if (/\bon(click|load|error|submit|change)\s*=/.test(js)) E(`${n}/block.js: sets an inline handler attribute`);
    if (/\b(eval|new Function)\s*\(|document\.write|innerHTML\s*=/.test(js)) E(`${n}/block.js: eval, document.write or innerHTML (not CSP/XSS safe)`);
    if (!/prefers-reduced-motion/i.test(md)) E(`${n}/block.md: needs a motion section with a prefers-reduced-motion rule`);
    for (const h of ['Slots', 'Accessibility', 'Motion']) if (!new RegExp(`^##\\s+${h}`, 'm').test(md)) E(`${n}/block.md: missing "## ${h}"`);
    let nodes; try { nodes = parse(html); } catch (e) { E(`${n}/block.html: ${e.message}`); continue; }
    for (const s of slotNames(nodes)) { const bare = s.replace(/^\./, ''); if (bare && !md.includes('`' + bare + '`')) E(`${n}/block.md: slot "${bare}" is not documented (write it in backticks)`); }
    if (n === 'testimonial-placeholder' && !/SAMPLE/.test(html)) E(`${n}: markup must carry a visible SAMPLE flag`);
    if (n === 'form' && !/role="status"/.test(html)) E('form: needs a role="status" region');
    if (n === 'form' && !/<noscript/.test(html)) E('form: needs a <noscript> note');
    if (n === 'form' && !/autocomplete=/.test(html)) E('form: fields need autocomplete');
    if (n === 'consent' && !/#unless enabled\}\} hidden/.test(html)) E('consent: must be hidden unless enabled (off by default)');
  }
  for (const d of dirs) {
    const D = join(LIB, 'directions', d);
    if (!existsSync(join(D, 'direction.css'))) E(`direction ${d}: direction.css is missing`); else checkCss(`directions/${d}/direction.css`, read(join(D, 'direction.css')));
    if (!existsSync(join(D, 'tokens.json'))) { E(`direction ${d}: tokens.json is missing`); continue; }
    let t; try { t = JSON.parse(read(join(D, 'tokens.json'))); } catch (e) { E(`direction ${d}: tokens.json is not JSON (${e.message})`); continue; }
    for (const p of tokenProblems(t)) E(`direction ${d}: ${p}`);
    const known = new Set([...defined(genCss(t)), ...allCss.flatMap((c) => [...defined(c.replace(/\/\*[\s\S]*?\*\//g, ''))])]);
    for (const css of allCss.map((c) => c.replace(/\/\*[\s\S]*?\*\//g, ''))) for (const m of css.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) if (!known.has(m[1]) && !m[2]) E(`direction ${d}: var(${m[1]}) is not a token of this direction or defined in the CSS`);
  }
  if (dirs.length < 3) E(`needs three directions, found ${dirs.length}`);
  return { names, dirs };
}
function runGate(script, args) {
  const r = spawnSync(process.execPath, [join(HERE, script), ...args], { encoding: 'utf8', timeout: 600000 });
  return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
}
function demos(E, dirs) {
  const spec = join(LIB, 'demo', 'spec.json');
  if (!existsSync(spec)) { E('demo/spec.json is missing'); return; }
  const base = mkdtempSync(join(tmpdir(), 'lilac-blocks-'));
  try {
    for (const d of dirs) {
      const dir = join(base, d); mkdirSync(dir, { recursive: true });
      try { assemble(dir, spec, d); } catch (e) { E(`demo ${d}: ${e.message}`); continue; }
      const qa = runGate('qa.mjs', [dir]); const qaLine = qa.out.match(/^qa: .*$/m)?.[0] ?? '(no summary)';
      console.log(`demo ${d}: ${qaLine}`); if (qa.code !== 0 || !/qa: 0 error/.test(qaLine)) E(`demo ${d}: qa.mjs failed\n${qa.out.split('\n').filter((l) => /ERROR|fix:/.test(l)).slice(0, 12).join('\n')}`);
      const qb = runGate('qa-browser.mjs', [dir]);
      if (/SKIPPED/.test(qb.out)) console.log(`demo ${d}: qa-browser SKIPPED (no Chrome): not verified`);
      else { const l = qb.out.match(/^qa-browser: .*$/m)?.[0] ?? '(no summary)'; console.log(`demo ${d}: ${l}`); if (qb.code !== 0 || !/ 0 error\(s\)/.test(l)) E(`demo ${d}: qa-browser.mjs failed\n${qb.out.split('\n').filter((x) => /ERROR|fix:/.test(x)).slice(0, 12).join('\n')}`); }
      const ct = runGate('controls-test.mjs', [dir]);
      if (/SKIPPED/.test(ct.out)) console.log(`demo ${d}: controls-test SKIPPED (no Chrome): not verified`);
      else { const l = ct.out.match(/^controls-test: .*$/m)?.[0] ?? '(no summary)'; console.log(`demo ${d}: ${l}`); const known = (ct.out.match(/^\s*Menu\s+\|.*UNREACHABLE/gm) ?? []).length; // TOOL-ISSUES.md: narrow-screen menu button is display:none at the tool's 1280 px sweep
        if (known) console.log(`demo ${d}: ${known} UNREACHABLE are the narrow-screen Menu button (tool sweeps 1280 px only; see blocks/TOOL-ISSUES.md)`);
        const bad = Number(l.match(/(\d+) unreachable/)?.[1] ?? 1) - known + Number(l.match(/(\d+) dead/)?.[1] ?? 1) + Number(l.match(/(\d+) broken/)?.[1] ?? 1) + Number(l.match(/(\d+) placeholder/)?.[1] ?? 1);
        if (bad > 0) E(`demo ${d}: controls-test.mjs failed\n${ct.out.split('\n').filter((x) => /DEAD|BROKEN|PLACEHOLDER|UNREACHABLE|DISABLED/.test(x)).slice(0, 12).join('\n')}`); }
    }
  } finally { rmSync(base, { recursive: true, force: true }); }
}
function check(noDemo) {
  const errors = [], E = (m) => errors.push(m);
  const { names, dirs } = checkLibrary(E);
  if (!noDemo && !errors.length) demos(E, dirs); else if (!noDemo) console.log('demos not run: fix the library errors first');
  for (const e of errors) console.log(`ERROR: ${e}`);
  console.log(`blocks: ${names.length} block(s), ${dirs.length} direction(s), ${errors.length} error(s)${noDemo ? ' (demos skipped by --no-demo)' : ''}`);
  process.exit(errors.length ? 1 : 0);
}

// ---- main
function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (n) => { const i = rest.indexOf(`--${n}`); return i < 0 ? undefined : rest[i + 1]; };
  const pos = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && rest[i - 1] !== '--no-demo'));
  if (cmd === 'list') return list();
  if (cmd === 'add') { if (pos.length < 2) die('usage: add <dir> <block> [--direction name]'); return add(pos[0], pos[1], flag('direction')); }
  if (cmd === 'assemble') {
    if (!pos[0] || !flag('pages') || !flag('direction')) die('usage: assemble <dir> --pages <spec.json> --direction <name>');
    if (!existsSync(flag('pages'))) die(`spec not found: ${flag('pages')}`);
    try { const f = assemble(pos[0], resolve(flag('pages')), flag('direction')); console.log(`blocks: assembled ${f.length} page(s) into ${join(resolve(pos[0]), 'site')}: ${f.join(', ')}`); }
    catch (e) { die(e.message, 1); }
    return;
  }
  if (cmd === 'strip' || cmd === 'reqs') {
    if (!pos[0]) die(`usage: ${cmd} <siteDir>${cmd === 'reqs' ? ' [--json]' : ''}`);
    try {
      if (cmd === 'strip') { const r = strip(pos[0]); console.log(`blocks: stripped ${r.attrs} data-req attribute(s) from ${r.files} file(s)`); return; }
      const m = reqs(pos[0]);
      if (rest.includes('--json')) console.log(JSON.stringify(m));
      else if (!Object.keys(m).length) console.log('blocks: no data-req tags found');
      else for (const [k, v] of Object.entries(m)) console.log(`${k}  ${v.join(', ')}`);
    } catch (e) { die(e.message, 1); }
    return;
  }
  if (cmd === 'check') return check(rest.includes('--no-demo'));
  die('usage: list | add <dir> <block> [--direction name] | assemble <dir> --pages <spec.json> --direction <name> | strip <siteDir> | reqs <siteDir> [--json] | check [--no-demo]');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
