#!/usr/bin/env node
// Lilac foundation: plan the architecture and make the brand kit BEFORE any site code, get approval, then keep the build honest to it.
// Usage: node scripts/foundation.mjs new <dir>       copy FOUNDATION.md + BRAND.md templates (never overwrites), create <dir>/brand/
//        node scripts/foundation.mjs tokens <dir>    BRAND.md ```json tokens block -> brand/tokens.json, tokens.css, brand-sheet.html
//        node scripts/foundation.mjs check <dir>     sections, no TBD/TODO/lorem, contrast, durations <= 600 ms, no remote fonts, tokens current
//        node scripts/foundation.mjs approve <dir> --by "<name>" --quote "<their words>"   refuses an empty quote or a failing check
//        node scripts/foundation.mjs status <dir>    prints VALID | STALE | NONE (exit 0 | 1 | 1)
//        node scripts/foundation.mjs adopt <dir>     EXISTING project: DRAFT FOUNDATION.md + BRAND.md from its CSS and config files (never overwrites)
//        node scripts/foundation.mjs drift <dir> [--site <dir>]   after building: CSS colours, fonts, durations not in the tokens (warn only)
// Approval = .lilac/foundation-approval.json {sha256 over FOUNDATION.md + BRAND.md + brand/tokens.css + brand/tokens.json, by, quote, at}.
// Offline and dependency-free: no network, no child processes. adopt and drift only READ the site; they write only into <dir> (and drift writes nothing).
// shortcut: colours are hex only (rgb() converts, hsl() is always off-token); upgrade when a real brand needs wider colour syntax.
// shortcut: drift's contrast gate only looks at `color:` declarations; a literal passing on either light or dark bg is not failed.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { scoped } from '../lib/safe-fs.mjs';
import { join, resolve, dirname, relative, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TPL = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const COLORS = ['bg', 'surface', 'text', 'muted', 'primary', 'accent', 'accent-text', 'link', 'danger', 'success', 'focus'];
const GROUPS = [['fonts', 'font'], ['fontSizes', 'font-size'], ['lineHeight', 'line-height'], ['space', 'space'], ['radius', 'radius'], ['shadow', 'shadow'], ['duration', 'duration'], ['easing', 'ease']];
const F_SECTIONS = ['languages', 'tools', 'architecture', 'folder structure', 'data and storage', 'hosting', 'budgets', 'security baseline', 'decisions'];
const B_SECTIONS = ['voice', 'palette', 'typography', 'spacing', 'motion', 'imagery', 'accessibility'];
const SKIP = new Set(['node_modules', '.git', '.lilac', '.github', '.wrangler', '.vercel', 'brand']);
const DRAFT = 'DRAFT: generated from the existing code, review before approving';
const BLOCK = /```json tokens[ \t]*\n([\s\S]*?)\n```/;

const read = (f) => readFileSync(f, 'utf8');
const stripC = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const blank = (s) => s.replace(/[^\n]/g, ' ');
function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const f = join(d, e.name); e.isDirectory() ? walk(f, out) : out.push(f);
  }
  return out;
}
export function sections(text) {
  const out = {}; let cur = null;
  for (const l of stripC(text).split('\n')) {
    const m = l.match(/^##\s+(.+?)\s*$/);
    if (m) { cur = m[1].toLowerCase(); out[cur] = ''; } else if (cur) out[cur] += l + '\n';
  }
  return out;
}
const has = (secs, key) => Object.entries(secs).find(([k]) => k.startsWith(key));

// ---- colour maths
export function hex6(h) { h = h.replace('#', '').toLowerCase(); if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join(''); return /^[0-9a-f]{6}([0-9a-f]{2})?$/.test(h) ? h.slice(0, 6) : null; }
export function lum(h) { const c = [0, 2, 4].map((i) => parseInt(hex6(h).slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
export function ratio(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
const ms = (v) => { const m = String(v).trim().match(/^(\d*\.?\d+)(ms|s)$/); return m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : null; };

// ---- tokens -> files
export function readTokens(dir) {
  const f = join(dir, 'BRAND.md');
  if (!existsSync(f)) return { error: 'BRAND.md not found' };
  const m = read(f).match(BLOCK);
  if (!m) return { error: 'BRAND.md has no ```json tokens block' };
  try { return { tokens: JSON.parse(m[1]) }; } catch (e) { return { error: `tokens block is not valid JSON (${e.message})` }; }
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const decl = (o, p) => Object.entries(o ?? {}).map(([k, v]) => `  --${p}-${k}: ${v};`);
const safeSvg = (s) => typeof s === 'string' && /^\s*<svg[\s>]/i.test(s) && !/<script|\son\w+\s*=|href\s*=/i.test(s);

export function genCss(t) {
  const c = t.colors ?? {};
  const l = [':root {', '  color-scheme: light dark;', ...decl(c.light, 'color'), ...GROUPS.flatMap(([k, p]) => decl(t[k], p)), '}',
    '@media (prefers-color-scheme: dark) {', '  :root {', ...decl(c.dark, 'color').map((x) => '  ' + x), '  }', '}',
    '@media (prefers-reduced-motion: reduce) {', '  :root {', ...Object.keys(t.duration ?? {}).map((k) => `    --duration-${k}: 0.01ms;`), '  }', '}'];
  return `/* Generated by foundation.mjs from BRAND.md. Do not edit: change the tokens block and run tokens again. */\n${l.join('\n')}\n`;
}
export function genJson(t) { return JSON.stringify(t, null, 2) + '\n'; }
export function genSheet(t) {
  const c = t.colors ?? {}, name = esc(t.name ?? 'Brand');
  const swatches = (mode) => { const m = c[mode] ?? {}; return Object.entries(m).map(([k, v]) => {
    const r = hex6(v) && hex6(m.bg ?? '#ffffff') ? ratio(v, m.bg).toFixed(2) : 'n/a';
    return `<li><span class="sw" style="background:${esc(v)}"></span><b>${esc(k)}</b> <code>${esc(v)}</code> <small>${r}:1 on bg</small></li>`; }).join(''); };
  const panel = (mode) => { const m = c[mode] ?? {}; return `<section class="p" style="background:${esc(m.bg)};color:${esc(m.text)}"><h2>${mode}</h2><ul>${swatches(mode)}</ul></section>`; };
  const wm = safeSvg(t.wordmark?.svg) ? t.wordmark.svg : `<strong>${esc(t.wordmark?.text ?? t.name ?? '')}</strong>`;
  const rows = (o, f) => Object.entries(o ?? {}).map(([k, v]) => f(esc(k), esc(v))).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} brand sheet</title>
<style>
${genCss(t)}
body{margin:0;padding:var(--space-6);background:var(--color-bg);color:var(--color-text);font:var(--font-size-base)/var(--line-height-body) var(--font-sans)}
h1,h2{line-height:var(--line-height-heading)} ul{list-style:none;padding:0;margin:0} li{margin:var(--space-2) 0}
.grid{display:grid;gap:var(--space-4);grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))}
.p{padding:var(--space-4);border:1px solid var(--color-muted);border-radius:var(--radius-md)}
.sw{display:inline-block;width:2rem;height:2rem;vertical-align:middle;border:1px solid var(--color-muted);border-radius:var(--radius-sm);margin-right:var(--space-2)}
.bar{display:inline-block;height:1rem;background:var(--color-primary);vertical-align:middle}
.demo{width:3rem;height:3rem;background:var(--color-accent);border-radius:var(--radius-md);animation:slide var(--duration-slow) var(--ease-standard) infinite alternate}
@keyframes slide{to{transform:translateX(8rem)}}
@media (prefers-reduced-motion: reduce){.demo{animation:none}}
</style></head><body>
<h1>${name} brand sheet</h1><p>Look at this page, then say in your own words whether you approve it.</p>
<div style="color:var(--color-primary);max-width:16rem">${wm}</div>
<h2>Colour (contrast against the background of each mode)</h2><div class="grid">${panel('light')}${panel('dark')}</div>
<h2>Type scale</h2>${rows(t.fontSizes, (k, v) => `<p style="font-size:${v};margin:0">${k}: The quick brown fox <small>(${v})</small></p>`)}
<h2>Fonts</h2>${rows(t.fonts, (k, v) => `<p style="font-family:${v}">${k}: ${v}</p>`)}
<h2>Spacing</h2>${rows(t.space, (k, v) => `<div>${k} <span class="bar" style="width:${v}"></span> ${v}</div>`)}
<h2>Radius and shadow</h2><div class="grid">${rows(t.radius, (k, v) => `<div class="p" style="border-radius:${v}">radius ${k}: ${v}</div>`)}${rows(t.shadow, (k, v) => `<div class="p" style="box-shadow:${v}">shadow ${k}</div>`)}</div>
<h2>Motion</h2><p>Durations: ${rows(t.duration, (k, v) => `${k} ${v}; `)}Visitors who ask for reduced motion see no movement.</p><div class="demo" role="img" aria-label="Motion demo"></div>
</body></html>
`;
}

// ---- check
export function runCheck(dir) {
  const errors = [], warns = [], E = (m) => errors.push(m), W = (m) => warns.push(m);
  const ff = join(dir, 'FOUNDATION.md'), bf = join(dir, 'BRAND.md');
  if (!existsSync(ff)) E('FOUNDATION.md not found. Run: foundation.mjs new <dir>');
  if (!existsSync(bf)) E('BRAND.md not found. Run: foundation.mjs new <dir>');
  if (errors.length) return { errors, warns };
  const ft = read(ff), bt = read(bf);
  for (const [n, txt] of [['FOUNDATION.md', ft], ['BRAND.md', bt]]) {
    if (txt.includes(DRAFT)) E(`${n} still carries the DRAFT marker: review it, fill the gaps, then remove the marker`);
    const bad = stripC(txt).match(/\b(TBD|TODO|lorem ipsum)\b/i);
    if (bad) E(`${n} contains "${bad[0]}": decide it or remove it`);
  }
  const fs = sections(ft), bs = sections(bt);
  for (const k of F_SECTIONS) { const s = has(fs, k); if (!s) E(`FOUNDATION.md is missing the section "${k}"`); else if (!s[1].trim()) E(`FOUNDATION.md section "${k}" is empty`); }
  for (const k of B_SECTIONS) { const s = has(bs, k); if (!s) E(`BRAND.md is missing the section "${k}"`); else if (!s[1].trim()) E(`BRAND.md section "${k}" is empty`); }
  const dec = has(fs, 'decisions')?.[1] ?? '';
  for (const [label, re] of [['options considered', /options considered/i], ['why', /\bwhy\b/i], ['trade-offs', /trade-?offs/i]]) if (dec.trim() && !re.test(dec)) E(`FOUNDATION.md decisions need "${label}" in each entry`);
  const mo = has(bs, 'motion')?.[1] ?? '';
  if (mo.trim() && !/reduced/i.test(mo)) E('BRAND.md motion section needs a reduced-motion rule');
  if (!/trademark/i.test(bt)) W('BRAND.md: no trademark search advice in the name check');
  if (!has(bs, 'name check')) W('BRAND.md: no "name check" section');
  if (!has(bs, 'wordmark')) W('BRAND.md: no "wordmark" section');
  if (!has(bs, 'iconography')) W('BRAND.md: no "iconography" section');
  if (!/\/lilac:hosting|hosting\.mjs/i.test(has(fs, 'hosting')?.[1] ?? '')) W('FOUNDATION.md hosting: link the choice to /lilac:hosting');
  if (/fonts\.googleapis|fonts\.gstatic|use\.typekit|@import\s+url/i.test(bt)) E('BRAND.md loads a remote font: use system stacks or a licensed local file');

  const r = readTokens(dir);
  if (r.error) { E(r.error); return { errors, warns }; }
  const t = r.tokens;
  for (const mode of ['light', 'dark']) {
    const c = t.colors?.[mode];
    if (!c) { E(`tokens: colors.${mode} is missing`); continue; }
    const miss = COLORS.filter((k) => !c[k] || !hex6(c[k]));
    if (miss.length) { E(`tokens: colors.${mode} needs valid hex values for: ${miss.join(', ')}`); continue; }
    for (const [a, b, min] of [['text', 'bg', 4.5], ['muted', 'bg', 4.5], ['accent-text', 'accent', 4.5], ['link', 'bg', 4.5], ['focus', 'bg', 3]]) {
      const x = ratio(c[a], c[b]); if (x < min) E(`contrast (${mode}): ${a} ${c[a]} on ${b} ${c[b]} is ${x.toFixed(2)}:1, needs ${min}:1`);
    }
  }
  for (const [k] of GROUPS) if (!t[k] || !Object.keys(t[k]).length) E(`tokens: "${k}" is missing`);
  for (const [k, v] of Object.entries(t.duration ?? {})) { const n = ms(v); if (n === null) E(`tokens: duration ${k} "${v}" is not ms or s`); else if (n > 600) E(`tokens: duration ${k} is ${n} ms, the limit is 600 ms`); }
  for (const [k, v] of Object.entries(t.fonts ?? {})) if (/https?:|\/\/|url\(/i.test(v)) E(`tokens: font stack ${k} has a remote URL: use system stacks or a licensed local file`);
  for (const w of t.webFonts ?? []) {
    if (!w.licence || !String(w.licence).trim()) E(`tokens: web font ${w.family} needs a "licence:" note`);
    if (!w.file || /^[a-z]+:|^\/\//i.test(w.file) || !existsSync(join(dir, w.file))) E(`tokens: web font ${w.family} needs a local file that exists (${w.file ?? 'none'})`);
  }
  if (t.wordmark?.svg && !safeSvg(t.wordmark.svg)) E('tokens: wordmark svg must start with <svg and contain no script, event handlers or links');
  if (!t.wordmark?.text) W('tokens: wordmark.text (the text fallback) is missing');
  for (const [f, gen] of [['tokens.css', genCss], ['tokens.json', genJson]]) {
    const p = join(dir, 'brand', f);
    if (!existsSync(p)) E(`brand/${f} not found. Run: foundation.mjs tokens <dir>`);
    else if (read(p) !== gen(t)) E(`brand/${f} is out of date with the tokens in BRAND.md. Run: foundation.mjs tokens <dir>`);
  }
  if (!existsSync(join(dir, 'brand', 'brand-sheet.html'))) W('brand/brand-sheet.html not found. Run: foundation.mjs tokens <dir>');
  return { errors, warns };
}

// ---- approval
const FILES = ['FOUNDATION.md', 'BRAND.md', 'brand/tokens.css', 'brand/tokens.json'];
export function foundationHash(dir) {
  const h = createHash('sha256');
  for (const f of FILES) h.update(f + '\0').update(existsSync(join(dir, f)) ? readFileSync(join(dir, f)) : '').update('\0');
  return h.digest('hex');
}
export function foundationStatus(dir) {
  const f = join(dir, '.lilac/foundation-approval.json');
  if (!existsSync(f)) return 'NONE';
  try { return JSON.parse(read(f)).sha256 === foundationHash(dir) ? 'VALID' : 'STALE'; } catch { return 'NONE'; }
}

// ---- adopt
const LANGS = { '.html': 'HTML', '.css': 'CSS', '.js': 'JavaScript', '.mjs': 'JavaScript', '.ts': 'TypeScript', '.tsx': 'TypeScript', '.jsx': 'JavaScript', '.py': 'Python', '.php': 'PHP', '.rb': 'Ruby', '.go': 'Go', '.rs': 'Rust', '.swift': 'Swift', '.kt': 'Kotlin' };
const TOOLS = [[/^package\.json$/, 'npm package.json'], [/^package-lock\.json$/, 'npm'], [/^pnpm-lock\.yaml$/, 'pnpm'], [/^yarn\.lock$/, 'yarn'], [/^tsconfig\.json$/, 'TypeScript compiler'], [/^wrangler\.(jsonc?|toml)$/, 'Cloudflare Wrangler'], [/^vercel\.json$/, 'Vercel'], [/^\.?eslintrc|^eslint\.config/, 'ESLint'], [/^\.?prettierrc|^prettier\.config/, 'Prettier'], [/^playwright\.config/, 'Playwright'], [/^vitest\.config/, 'Vitest'], [/^jest\.config/, 'Jest'], [/^vite\.config/, 'Vite']];
const ALIASES = { bg: ['bg', 'background'], surface: ['surface', 'paper', 'card'], text: ['text', 'ink', 'fg', 'foreground'], muted: ['muted'], primary: ['primary', 'brand'], accent: ['accent', 'kiln'], 'accent-text': ['accent-text', 'kiln-ink', 'on-accent'], link: ['link'], danger: ['danger', 'error'], success: ['success'], focus: ['focus'] };
function customProps(cssFiles) {
  const out = { light: {}, dark: {} };
  for (const f of cssFiles) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
      const mode = /prefers-color-scheme\s*:\s*dark\s*\)\s*\{\s*$/.test(css.slice(Math.max(0, m.index - 80), m.index)) ? 'dark' : 'light';
      for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) out[mode][d[1]] = d[2].trim();
    }
  }
  return out;
}
function adopt(dir) {
  const files = walk(dir), css = files.filter((f) => extname(f) === '.css');
  const count = {}; for (const f of files) { const l = LANGS[extname(f).toLowerCase()]; if (l) count[l] = (count[l] ?? 0) + 1; }
  const tools = [...new Set(files.filter((f) => relative(dir, f).split(/[\\/]/).length <= 2).flatMap((f) => TOOLS.filter(([re]) => re.test(basename(f))).map(([, n]) => n)))];
  const props = customProps(css);
  const colors = { light: {}, dark: {} };
  for (const mode of ['light', 'dark']) for (const [role, names] of Object.entries(ALIASES)) for (const n of names) { const v = props[mode]['--' + n] ?? (mode === 'dark' ? undefined : undefined); if (v && hex6(v) && /^#/.test(v)) { colors[mode][role] = v; break; } }
  const list = (m) => Object.entries(props[m]).map(([k, v]) => `- \`${k}: ${v}\``).join('\n') || '- none found';
  const wrote = [];
  const put = (name, body) => { const p = join(dir, name); if (existsSync(p)) return; scoped(dir).write(name, body, { overwrite: false }); wrote.push(name); };
  put('FOUNDATION.md', `# Foundation\n\n<!-- ${DRAFT} -->\n${DRAFT}\n\n## Languages\nFound by file type: ${Object.entries(count).map(([k, v]) => `${k} (${v} files)`).join(', ') || 'none found (UNKNOWN)'}.\n\n## Tools\nFound by config files: ${tools.join(', ') || 'none found (UNKNOWN)'}.\n\n## Architecture\nUNKNOWN: describe how the pieces fit.\n\n## Folder structure\nTop level: ${readdirSync(dir).filter((n) => !SKIP.has(n)).sort().join(', ')}.\n\n## Data and storage\nUNKNOWN: where content and user data live.\n\n## Hosting\nUNKNOWN: choose with /lilac:hosting.\n\n## Budgets\nUNKNOWN: performance and accessibility budgets.\n\n## Security baseline\nUNKNOWN: CSP, headers, third-party requests.\n\n## Decisions\n### Decision: keep the existing stack\n- Options considered: keep it, change it\n- Why: UNKNOWN: confirm with the owner\n- Trade-offs: UNKNOWN\n- Revisit when: UNKNOWN\n`);
  const tpl = read(join(TPL, 'BRAND.template.md')).replace(BLOCK, () => '').replace(/```json tokens[\s\S]*$/, '');
  const base = JSON.parse(read(join(TPL, 'BRAND.template.md')).match(BLOCK)[1]);
  const tk = { ...base, colors: { light: { ...colors.light }, dark: { ...colors.dark } } };
  put('BRAND.md', `${tpl.replace('# Brand kit\n', `# Brand kit\n\n<!-- ${DRAFT} -->\n${DRAFT}\n`).trimEnd()}\n\n## Found in the existing CSS\nLight custom properties:\n${list('light')}\n\nDark custom properties:\n${list('dark')}\n\n\`\`\`json tokens\n${JSON.stringify(tk, null, 2)}\n\`\`\`\n`);
  return wrote;
}

// ---- drift
function scan(dir, siteDir) {
  const r = readTokens(dir); if (r.error) return { error: r.error };
  const t = r.tokens, c = t.colors ?? {};
  const known = new Set([...Object.values(c.light ?? {}), ...Object.values(c.dark ?? {})].map((v) => hex6(v)).filter(Boolean));
  const stacks = new Set(Object.values(t.fonts ?? {}).map((v) => v.toLowerCase().replace(/["'\s]/g, '')));
  const durs = new Set(Object.values(t.duration ?? {}).map(ms));
  const found = { colour: [], font: [], duration: [] }, fails = [];
  for (const f of walk(siteDir)) {
    const ext = extname(f).toLowerCase(); if (ext !== '.css' && ext !== '.html') continue;
    let s = read(f);
    if (ext === '.html') { const o = [...blank(s)]; for (const m of s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) { const a = m.index + m[0].indexOf(m[1]); for (let i = 0; i < m[1].length; i++) o[a + i] = m[1][i]; } s = o.join(''); }
    s = s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/--[\w-]+\s*:[^;}]*/g, blank);
    const at = (i) => `${relative(siteDir, f)}:${s.slice(0, i).split('\n').length}`;
    for (const m of s.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d+[\s,]+\d+[\s,]+\d+[^)]*\)|hsla?\([^)]*\)/g)) {
      let v = m[0], h = null;
      if (v[0] === '#') h = hex6(v); else if (v.startsWith('rgb')) { const n = v.match(/\d+/g).slice(0, 3).map(Number); h = n.map((x) => x.toString(16).padStart(2, '0')).join(''); }
      if (h && known.has(h)) continue;
      found.colour.push(`${at(m.index)} ${v}`);
      const line = s.slice(s.lastIndexOf('\n', m.index) + 1, m.index);
      if (h && /(^|[;{\s])color\s*:\s*[^;]*$/.test(line) && !/[\w-](background|border|outline)-?color/.test(line)) {
        const bgs = [c.light?.bg, c.dark?.bg].filter(Boolean);
        if (bgs.length && bgs.every((b) => ratio('#' + h, b) < 4.5)) fails.push(`${at(m.index)} text colour ${v} fails contrast (needs 4.5:1) on the token backgrounds`);
      }
    }
    for (const m of s.matchAll(/font-family\s*:\s*([^;}]+)/gi)) if (!m[1].includes('var(') && !stacks.has(m[1].toLowerCase().replace(/["'\s!important]/g, '').replace(/important/g, ''))) found.font.push(`${at(m.index)} ${m[1].trim()}`);
    for (const m of s.matchAll(/(?:transition|animation)(?:-duration)?\s*:\s*([^;}]+)/gi)) {
      for (const d of m[1].replace(/var\([^)]*\)/g, '').matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)) { const n = ms(d[0]); if (n > 0.01 && !durs.has(n)) found.duration.push(`${at(m.index)} ${d[0]}`); }
    }
  }
  return { found, fails };
}

// ---- main
function main() {
  const args = process.argv.slice(2), cmd = args[0];
  const flag = (n) => { const i = args.indexOf(`--${n}`); return i > 0 ? args[i + 1] : undefined; };
  const fail = (m) => { console.error(`foundation: ${m}`); process.exit(1); };
  if (!['new', 'tokens', 'check', 'approve', 'status', 'adopt', 'drift'].includes(cmd) || !args[1] || args[1].startsWith('--')) fail('usage: new|tokens|check|status|adopt <dir> | approve <dir> --by <name> --quote <words> | drift <dir> [--site <dir>]');
  const dir = resolve(args[1]);

  if (cmd === 'new') {
    const W = scoped(dir); W.mkdir('brand');
    for (const [t, n] of [['FOUNDATION.template.md', 'FOUNDATION.md'], ['BRAND.template.md', 'BRAND.md']]) {
      if (existsSync(join(dir, n))) console.log(`foundation: ${n} exists, left alone`); else { W.write(n, read(join(TPL, t)), { overwrite: false }); console.log(`foundation: wrote ${n}`); }
    }
    return;
  }
  if (!existsSync(dir)) fail(`folder not found: ${dir}`);
  if (cmd === 'tokens') {
    const r = readTokens(dir); if (r.error) fail(r.error);
    const W = scoped(dir); W.mkdir('brand');
    W.write('brand/tokens.json', genJson(r.tokens)); W.write('brand/tokens.css', genCss(r.tokens)); W.write('brand/brand-sheet.html', genSheet(r.tokens));
    console.log('foundation: wrote brand/tokens.json, brand/tokens.css, brand/brand-sheet.html. Show the human brand/brand-sheet.html.');
    return;
  }
  if (cmd === 'check' || cmd === 'approve') {
    const { errors, warns } = runCheck(dir);
    for (const e of errors) console.log(`ERROR: ${e}`); for (const w of warns) console.log(`WARN: ${w}`);
    console.log(`foundation: ${errors.length} error(s), ${warns.length} warning(s)`);
    if (errors.length) process.exit(1);
    if (cmd === 'check') return;
    const by = (flag('by') ?? '').trim(), quote = (flag('quote') ?? '').trim();
    if (!by) fail('--by "<name>" is required');
    if (!quote) fail('--quote is required: pass the human\'s own words saying yes. Never approve on your own.');
    const W = scoped(dir); W.mkdir('.lilac');
    W.write('.lilac/foundation-approval.json', JSON.stringify({ sha256: foundationHash(dir), by, quote, at: new Date().toISOString() }, null, 2) + '\n');
    console.log('foundation: approval recorded. Editing FOUNDATION.md, BRAND.md or the tokens makes it STALE.');
    return;
  }
  if (cmd === 'status') {
    const s = foundationStatus(dir);
    console.log(s === 'VALID' ? 'VALID: the foundation is unchanged since the human approved it.' : s === 'STALE' ? 'STALE: the foundation changed since approval. Re-run check and ask the human to approve again.' : 'NONE: no approval yet. Run /lilac:foundation.');
    process.exit(s === 'VALID' ? 0 : 1);
  }
  if (cmd === 'adopt') {
    const w = adopt(dir);
    console.log(w.length ? `foundation: wrote DRAFT ${w.join(' and ')}. Review them before approving.` : 'foundation: FOUNDATION.md and BRAND.md already exist, left alone');
    return;
  }
  // drift
  const site = resolve(flag('site') ?? (['site', 'public', 'dist', 'out', 'build'].map((n) => join(dir, n)).find((d) => existsSync(d) && statSync(d).isDirectory()) ?? dir));
  const r = scan(dir, site); if (r.error) fail(r.error + '. Run tokens first.');
  let n = 0;
  for (const [k, list] of Object.entries(r.found)) {
    if (!list.length) continue; n++;
    console.log(`WARN: ${list.length} ${k} value(s) not in the tokens. Use var(--token). First ${Math.min(10, list.length)}:`);
    for (const x of list.slice(0, 10)) console.log(`  ${x}`);
  }
  for (const f of r.fails) console.log(`ERROR: ${f}`);
  console.log(`foundation drift: ${r.fails.length} error(s), ${n} warning(s)`);
  process.exit(r.fails.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
