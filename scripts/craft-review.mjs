#!/usr/bin/env node
// Lilac craft-review: a deterministic craft score (0-100) for a built site, plus a signature-moment check.
// Usage: node scripts/craft-review.mjs score <dir> [--library <entry>] [--threshold 70] [--loop-hint] [--dimension type|spacing|colour|motion|hierarchy] [--json]
//        node scripts/craft-review.mjs signature <dir>
// score: five measured dimensions (type, spacing, colour, motion, hierarchy), 20 points each, every check with its evidence.
//   --library <entry>  a library entry folder (meta.json + DESIGN.md). Prints a distance report against its tokens. Never copies content.
//                      Refused unless meta.json has owner_consent: true (see library/README.md).
//   --loop-hint        prints what to fix per dimension. The agent fixes, re-runs with --dimension <d>, and stops after 3 rounds.
//   --dimension <d>    re-score only that dimension (point-and-say edits).
// signature: the site must declare exactly one signature moment: an element with a data-signature attribute. If BRIEF.md names a signature
//   moment, that element must exist.
// Exit 0 pass, 1 below threshold or signature missing, 2 bad usage. Offline, read-only, no dependencies, no network.
// shortcut: regex scan of the HTML and CSS files, not a browser; computed styles, JS-set styles and cascade order are not seen. Contrast pairs
//   colour and background in one rule (or :root custom properties). qa-browser.mjs measures the live page. Upgrade by feeding it browser output.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i < 0 ? null : argv[i + 1]; };
const [cmd, dirArg] = argv;
const usage = () => { console.error('usage: craft-review.mjs score <dir> [--library <entry>] [--threshold 70] [--loop-hint] [--dimension d] [--json] | signature <dir>'); process.exit(2); };
if (!['score', 'signature'].includes(cmd) || !dirArg || !existsSync(dirArg) || !statSync(dirArg).isDirectory()) usage();
const root = resolve(dirArg);

// ---- read the site ---------------------------------------------------------------------------------------------------------------------------
function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', '.lilac'].includes(e.name)) continue;
    const p = join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const hasHtml = (d) => existsSync(d) && statSync(d).isDirectory() && walk(d).some((f) => f.endsWith('.html'));
const site = ['site', 'public', 'dist', 'out', 'build'].map((n) => join(root, n)).find(hasHtml) ?? root;
const files = walk(site);
const pages = files.filter((f) => f.endsWith('.html')).map((f) => ({ f, html: readFileSync(f, 'utf8') }));
if (!pages.length) { console.error(`craft-review: no .html files under ${site}`); process.exit(2); }

if (cmd === 'signature') {
  const sig = new Set();
  for (const p of pages) for (const m of p.html.matchAll(/\sdata-signature(?:=["']?([^"'\s>]*))?/gi)) sig.add(m[1] || '(unnamed)');
  let brief = '';
  for (const b of [join(root, 'BRIEF.md'), join(root, '.lilac', 'BRIEF.md'), join(dirname(site), 'BRIEF.md')]) if (existsSync(b)) { brief = readFileSync(b, 'utf8'); break; }
  const m = brief.match(/signature moment[^:\n]*:\s*(.+)/i);
  const declared = m && !/^(sample|unknown|_+|<.*>|none|tbd)\s*\.?$/i.test(m[1].trim()) ? m[1].trim() : '';
  let msg = '', ok = true;
  if (sig.size > 1) { ok = false; msg = `${sig.size} signature moments found (${[...sig].join(', ')}). Keep exactly one.`; }
  else if (sig.size === 0) { ok = false; msg = declared ? `BRIEF names a signature moment ("${declared}") but no element carries data-signature. Mark it.` : 'no signature moment declared. Add data-signature to one element and name it in BRIEF.md.'; }
  else msg = `one signature moment present: data-signature="${[...sig][0]}"${declared ? ` (BRIEF: "${declared}")` : ' (BRIEF names none: UNVERIFIED that it matches the intent)'}`;
  console.log(`signature: ${ok ? 'PASS' : 'FAIL'}. ${msg}`);
  process.exit(ok ? 0 : 1);
}

// ---- CSS collection --------------------------------------------------------------------------------------------------------------------------
let css = '';
for (const f of files.filter((x) => x.endsWith('.css'))) css += '\n' + readFileSync(f, 'utf8');
for (const p of pages) for (const m of p.html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) css += '\n' + m[1];
css = css.replace(/\/\*[\s\S]*?\*\//g, '');
// Flat rule list, including rules inside @media. Selector -> declaration map; @keyframes bodies are skipped.
const rules = [];
(function parse(src, media) {
  let i = 0;
  while (i < src.length) {
    const o = src.indexOf('{', i); if (o < 0) break;
    const head = src.slice(i, o).trim();
    let depth = 1, j = o + 1;
    while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
    const body = src.slice(o + 1, j - 1);
    if (/^@(media|supports)/i.test(head)) parse(body, head);
    else if (!/^@/.test(head)) {
      const decl = {};
      for (const d of body.split(';')) { const k = d.indexOf(':'); if (k > 0) decl[d.slice(0, k).trim().toLowerCase()] = d.slice(k + 1).trim(); }
      rules.push({ sel: head, media, decl });
    }
    i = j;
  }
})(css, '');
const vars = {};
for (const r of rules) for (const [k, v] of Object.entries(r.decl)) if (k.startsWith('--') && /^(:root|html|body)$/i.test(r.sel)) vars[k] = v;
const resolveVar = (v, n = 0) => (n > 5 ? v : String(v).replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_, k) => resolveVar(vars[k] ?? '', n + 1)));
const decls = []; // every declaration with its raw and resolved value
for (const r of rules) for (const [k, v] of Object.entries(r.decl)) decls.push({ sel: r.sel, prop: k, raw: v, val: resolveVar(v), media: r.media });
const selHas = (sel, re) => sel.split(',').some((s) => re.test(s.trim()));

// ---- helpers ---------------------------------------------------------------------------------------------------------------------------------
const toPx = (n, u) => ({ px: n, rem: n * 16, em: n * 16 }[u]);
const hexNorm = (h) => { h = h.toLowerCase().replace('#', ''); return '#' + (h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6)); };
const rgbOf = (c) => { c = c.trim().toLowerCase(); let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})\b/); if (m) { const h = hexNorm(m[0]).slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  m = c.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/); if (m) return [+m[1], +m[2], +m[3]]; return { white: [255, 255, 255], black: [0, 0, 0] }[c] ?? null; };
const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const sat = ([r, g, b]) => { const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); };
const uniq = (a) => [...new Set(a)];
const short = (a, n = 8) => a.slice(0, n).join(', ') + (a.length > n ? `, +${a.length - n} more` : '');

// A check: { name, pass, evidence, fix }. pass === null means not measurable (UNVERIFIED, excluded from the score).
const dims = { type: [], spacing: [], colour: [], motion: [], hierarchy: [] };
const add = (d, name, pass, evidence, fix) => dims[d].push({ name, pass, evidence, fix });

// ---- type ------------------------------------------------------------------------------------------------------------------------------------
{
  const fams = uniq(decls.filter((d) => d.prop === 'font-family' || (d.prop === 'font' && /\/|\d(px|rem|em)/.test(d.val))).map((d) => (d.val.split(',')[0].replace(/^.*?(?:\d(?:px|rem|em)(?:\/[\d.]+)?\s+)/, '').replace(/["']/g, '').trim().toLowerCase())).filter((f) => f && !/^(inherit|initial|unset)$/.test(f)));
  const real = fams.filter((f) => !/^(sans-serif|serif|monospace|system-ui|-apple-system|ui-)/.test(f));
  add('type', 'at most 3 font families (2 is better)', fams.length ? real.length <= 3 : null, fams.length ? `${real.length} custom families: ${short(real) || 'system fonts only'}` : 'no font-family declared', 'Cut to one body family and at most one display family.');
  const hs = ['h1', 'h2', 'h3', 'h4'].map((h) => { const d = decls.find((x) => x.prop === 'font-size' && selHas(x.sel, new RegExp(`^${h}$`, 'i'))); const m = d?.val.match(/^([\d.]+)(px|rem|em)$/); return m ? toPx(+m[1], m[2]) : null; });
  const known = hs.filter((x) => x != null);
  if (known.length >= 3) {
    const steps = known.slice(1).map((s, i) => known[i] / s);
    const mono = steps.every((s) => s >= 1.05 && s <= 2), spread = Math.max(...steps) / Math.min(...steps);
    add('type', 'heading scale is modular (steady ratio, 1.05 to 2)', mono && spread <= 1.3, `h sizes ${known.map((x) => x + 'px').join(' > ')}; step ratios ${steps.map((s) => s.toFixed(2)).join(', ')}`, 'Pick one ratio (1.2, 1.25, 1.333) and derive h1 to h4 from it as tokens.');
  } else add('type', 'heading scale is modular', null, `only ${known.length} of h1 to h4 have a px/rem font-size (UNVERIFIED)`, 'Set font-size on h1, h2, h3 as tokens.');
  const lineLen = decls.filter((d) => d.prop === 'max-width' && selHas(d.sel, /^(body|main|article|p|\.prose|\.content|\.container|\.copy|section)$/i)).map((d) => { const m = d.val.match(/^([\d.]+)(ch|px|rem|em)$/); return m ? (m[2] === 'ch' ? +m[1] : toPx(+m[1], m[2]) / 8) : null; }).filter((x) => x != null);
  add('type', 'body line length 45 to 80 characters', lineLen.length ? lineLen.some((x) => x >= 45 && x <= 80) : false, lineLen.length ? `max-width on text containers ~${lineLen.map((x) => Math.round(x) + 'ch').join(', ')}` : 'no max-width on body, main, article or p', 'Set max-width: 65ch on the text container.');
  const lh = decls.filter((d) => d.prop === 'line-height' && selHas(d.sel, /^(body|html|p|:root|\.prose|article|main)$/i)).map((d) => { const m = d.val.match(/^([\d.]+)(%|em)?$/); return m ? (m[2] ? +m[1] / (m[2] === '%' ? 100 : 1) : +m[1]) : null; }).filter((x) => x != null);
  add('type', 'body line-height 1.4 to 1.7', lh.length ? lh.some((x) => x >= 1.4 && x <= 1.7) : false, lh.length ? `line-height ${lh.join(', ')}` : 'no line-height on body or p (browser default is about 1.2)', 'Set line-height: 1.5 on body.');
}

// ---- spacing ---------------------------------------------------------------------------------------------------------------------------------
{
  const onScale = (px) => (px <= 16 ? px % 4 === 0 : px % 8 === 0) || px === 2;
  const vals = [], off = [];
  for (const d of decls) {
    if (!/^(margin|padding|gap|row-gap|column-gap)(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/.test(d.prop)) continue;
    if (/var\(/.test(d.raw)) continue; // a token reference is on the scale by construction
    for (const m of d.val.matchAll(/(-?[\d.]+)(px|rem|em)\b/g)) { const px = Math.abs(toPx(+m[1], m[2])); if (px === 0) continue; vals.push(px); if (!onScale(px)) off.push(px); }
  }
  const tokens = Object.keys(vars).filter((k) => /space|spacing|gap|size-|s-\d/.test(k)).length;
  if (!vals.length && !tokens) add('spacing', 'spacing drawn from a small scale', null, 'no margin, padding or gap values found (UNVERIFIED)', 'Define --space-1..n tokens.');
  else {
    const d = uniq(vals).sort((a, b) => a - b);
    add('spacing', 'few off-scale values (4px steps to 16, 8px steps after)', vals.length ? off.length / vals.length <= 0.1 : true, `${off.length} of ${vals.length} literal values off-scale${off.length ? ': ' + short(uniq(off).map((x) => x + 'px')) : ''}`, 'Round off-scale values to the nearest scale step or replace with var(--space-n).');
    add('spacing', 'at most 12 distinct spacing values', d.length <= 12, `${d.length} distinct values${tokens ? `, ${tokens} spacing tokens` : ''}: ${short(d.map((x) => x + 'px'), 12)}`, 'Collapse near-duplicates (13px, 14px, 15px) into one step.');
  }
}

// ---- colour ----------------------------------------------------------------------------------------------------------------------------------
{
  const colourDecls = decls.filter((d) => /color|background|border|fill|stroke|shadow|outline/.test(d.prop) || d.prop.startsWith('--'));
  const palette = uniq(colourDecls.flatMap((d) => [...d.val.matchAll(/#[0-9a-fA-F]{3,6}\b/g)].map((m) => hexNorm(m[0]))));
  add('colour', 'palette of at most 10 distinct colours', palette.length ? palette.length <= 10 : null, palette.length ? `${palette.length} distinct colours: ${short(palette, 12)}` : 'no hex colours found (UNVERIFIED)', 'Reduce to neutrals plus one accent; define them as tokens.');
  const pairs = [];
  for (const r of rules) {
    const fg = r.decl.color && rgbOf(resolveVar(r.decl.color)), bg = (r.decl['background-color'] || r.decl.background) && rgbOf(resolveVar(r.decl['background-color'] || r.decl.background));
    if (fg && bg) pairs.push({ sel: r.sel, r: ratio(fg, bg) });
  }
  const bodyFg = rgbOf(resolveVar(decls.find((d) => d.prop === 'color' && selHas(d.sel, /^(body|html|:root)$/i))?.raw ?? '')), bodyBg = rgbOf(resolveVar(decls.find((d) => (d.prop === 'background' || d.prop === 'background-color') && selHas(d.sel, /^(body|html|:root)$/i))?.raw ?? ''));
  if (bodyFg && bodyBg && !pairs.some((p) => /^(body|html|:root)$/i.test(p.sel))) pairs.push({ sel: 'body', r: ratio(bodyFg, bodyBg) });
  const lowC = pairs.filter((p) => p.r < 4.5);
  add('colour', 'text colour pairs reach WCAG 4.5:1', pairs.length ? !lowC.length : null, pairs.length ? `${pairs.length} pairs measured; lowest ${Math.min(...pairs.map((p) => p.r)).toFixed(2)}:1${lowC.length ? ' at ' + short(lowC.map((p) => `${p.sel} ${p.r.toFixed(2)}`), 4) : ''}` : 'no colour and background in one rule (UNVERIFIED)', 'Darken the text or lighten the background until each pair is 4.5:1 or more.');
  const cand = palette.map((h) => ({ h, s: sat(rgbOf(h)) })).filter((x) => x.s > 0.35).sort((a, b) => b.s - a.s)[0];
  if (cand) {
    const names = Object.entries(vars).filter(([, v]) => v.toLowerCase().includes(cand.h)).map(([k]) => k);
    const uses = colourDecls.filter((d) => !d.prop.startsWith('--') && (d.val.toLowerCase().includes(cand.h) || names.some((n) => d.raw.includes(`var(${n}`)))).length;
    const total = colourDecls.filter((d) => !d.prop.startsWith('--') && /#[0-9a-fA-F]{3,6}|rgb|var\(/.test(d.raw)).length || 1;
    add('colour', 'accent used sparingly (at most 8 declarations and 30% of colour use)', uses <= 8 && uses / total <= 0.3, `accent ${cand.h} used in ${uses} of ${total} colour declarations`, 'Keep the accent for the primary CTA and one or two highlights; use neutrals elsewhere.');
  } else add('colour', 'accent used sparingly', null, 'no saturated accent colour found (UNVERIFIED)', 'Choose one accent.');
}

// ---- motion ----------------------------------------------------------------------------------------------------------------------------------
{
  const mo = decls.filter((d) => /^(transition|animation)(-duration|-timing-function)?$/.test(d.prop) && !/^none$/.test(d.val));
  const durs = uniq(mo.flatMap((d) => [...d.val.matchAll(/(?<![\w.-])([\d.]+)(ms|s)\b/g)].map((m) => Math.round(+m[1] * (m[2] === 's' ? 1000 : 1)))).filter((x) => x > 0)).sort((a, b) => a - b);
  const eases = uniq(mo.flatMap((d) => [...d.val.matchAll(/cubic-bezier\([^)]*\)|\b(ease-in-out|ease-in|ease-out|ease|linear|steps\([^)]*\))\b/g)].map((m) => m[0].replace(/\s+/g, ''))));
  if (!mo.length) { add('motion', 'durations consistent (at most 4)', true, 'no transitions or animations (nothing to check)', ''); add('motion', 'easings consistent (at most 3)', true, 'no easing declared', ''); add('motion', 'prefers-reduced-motion respected', true, 'no motion to reduce', ''); }
  else {
    add('motion', 'durations consistent (at most 4 distinct)', durs.length <= 4, `${durs.length} durations: ${durs.map((x) => x + 'ms').join(', ')}`, 'Define --dur-fast, --dur-med, --dur-slow and use only those.');
    add('motion', 'easings consistent (at most 3 distinct)', eases.length <= 3, `${eases.length} easings: ${short(eases, 5) || 'default'}`, 'Define one or two easing tokens (--ease-out, --ease-in-out).');
    const rm = rules.some((r) => /prefers-reduced-motion\s*:\s*reduce/i.test(r.media));
    add('motion', 'prefers-reduced-motion respected', rm, rm ? 'a prefers-reduced-motion: reduce block exists' : 'motion exists but no prefers-reduced-motion block', 'Add @media (prefers-reduced-motion: reduce) { * { animation: none; transition: none; } }.');
  }
}

// ---- hierarchy -------------------------------------------------------------------------------------------------------------------------------
{
  const per = pages.map((p) => {
    const hs = [...p.html.matchAll(/<h([1-6])[\s>]/gi)].map((m) => +m[1]);
    const skips = hs.filter((l, i) => (i ? l - hs[i - 1] > 1 : l > 1)).length;
    const cta = [...p.html.matchAll(/<(a|button)\b[^>]*?(?:data-cta=["']?primary|class=["'][^"']*\b(?:btn-primary|button-primary|cta|primary)\b)[^>]*>/gi)].length;
    return { name: p.f.slice(site.length + 1) || 'index.html', h1: hs.filter((l) => l === 1).length, skips, cta };
  });
  const bad = (f) => per.filter(f).map((p) => p.name);
  const b1 = bad((p) => p.h1 !== 1), b2 = bad((p) => p.skips), b3 = bad((p) => p.cta !== 1);
  add('hierarchy', 'exactly one h1 per page', !b1.length, b1.length ? `${b1.length} of ${per.length} pages off: ${short(b1, 4)}` : `all ${per.length} pages have one h1`, 'Give every page one h1 and demote the rest.');
  add('hierarchy', 'heading order has no skipped level', !b2.length, b2.length ? `skipped levels on: ${short(b2, 4)}` : 'no skipped levels', 'Do not jump from h2 to h4; use CSS for size.');
  add('hierarchy', 'one clear primary CTA per page (class btn-primary/cta/primary or data-cta="primary")', !b3.length, b3.length ? `${b3.length} of ${per.length} pages without exactly one: ${short(b3, 4)}` : `all ${per.length} pages have one primary CTA`, 'Mark exactly one primary action per page; make the rest secondary.');
}

// ---- score -----------------------------------------------------------------------------------------------------------------------------------
const only = flag('--dimension');
if (only && !dims[only]) usage();
const threshold = Number(flag('--threshold') ?? 70);
const result = {};
for (const [d, cs] of Object.entries(dims)) {
  const m = cs.filter((c) => c.pass !== null);
  result[d] = { score: m.length ? Math.round((m.filter((c) => c.pass).length / m.length) * 100) : null, checks: cs };
}
const scored = Object.entries(result).filter(([, v]) => v.score != null);
const total = scored.length ? Math.round(scored.reduce((a, [, v]) => a + v.score, 0) / scored.length) : 0;

// ---- library distance ------------------------------------------------------------------------------------------------------------------------
let distance = null;
const lib = flag('--library');
if (lib) {
  const meta = (() => { try { return JSON.parse(readFileSync(join(resolve(lib), 'meta.json'), 'utf8')); } catch { return null; } })();
  if (!meta) { console.error(`craft-review: ${lib} has no readable meta.json`); process.exit(2); }
  if (meta.owner_consent !== true) { console.error(`craft-review: ${lib} has owner_consent ${JSON.stringify(meta.owner_consent)}; refusing to use it as a reference (see library/README.md)`); process.exit(2); }
  const dm = existsSync(join(resolve(lib), 'DESIGN.md')) ? readFileSync(join(resolve(lib), 'DESIGN.md'), 'utf8') : '';
  const tok = (k) => dm.match(new RegExp(`^[-*\\s]*${k}\\s*:\\s*(.+)$`, 'im'))?.[1].trim().replace(/[`*]/g, '');
  const rows = [];
  const exFonts = tok('font-families')?.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const myFonts = uniq(decls.filter((d) => d.prop === 'font-family').map((d) => d.val.split(',')[0].replace(/["']/g, '').trim().toLowerCase()));
  if (exFonts) rows.push({ token: 'font families', exemplar: exFonts.join(', '), site: myFonts.join(', ') || 'none', distance: Number((1 - exFonts.filter((f) => myFonts.includes(f)).length / uniq([...exFonts, ...myFonts]).length).toFixed(2)) });
  const exAcc = tok('accent') && rgbOf(tok('accent'));
  const myAcc = palette_accent();
  if (exAcc && myAcc) rows.push({ token: 'accent colour', exemplar: tok('accent'), site: myAcc.h, distance: Number((Math.hypot(...exAcc.map((v, i) => v - rgbOf(myAcc.h)[i])) / 441.67).toFixed(2)) });
  const exLh = Number(tok('line-height')), myLh = result.type.checks.find((c) => /line-height/.test(c.name)).evidence.match(/line-height ([\d.]+)/)?.[1];
  if (exLh && myLh) rows.push({ token: 'line-height', exemplar: String(exLh), site: myLh, distance: Number(Math.abs(exLh - myLh).toFixed(2)) });
  const exHr = Number(tok('heading-ratio')), myHr = result.type.checks.find((c) => /modular/.test(c.name)).evidence.match(/step ratios ([\d.]+)/)?.[1];
  if (exHr && myHr) rows.push({ token: 'heading ratio', exemplar: String(exHr), site: myHr, distance: Number(Math.abs(exHr - myHr).toFixed(2)) });
  distance = { library: meta.category ?? 'unknown', rows, note: 'tokens only: 0 is identical, 1 is far apart. Content is never copied.' };
}
function palette_accent() {
  const p = uniq(decls.flatMap((d) => [...d.val.matchAll(/#[0-9a-fA-F]{3,6}\b/g)].map((m) => hexNorm(m[0]))));
  return p.map((h) => ({ h, s: sat(rgbOf(h)) })).filter((x) => x.s > 0.35).sort((a, b) => b.s - a.s)[0];
}

// ---- output ----------------------------------------------------------------------------------------------------------------------------------
const shown = only ? { [only]: result[only] } : result;
const pass = only ? result[only].score != null && result[only].score * 1 >= threshold : total >= threshold;
if (argv.includes('--json')) console.log(JSON.stringify({ site, total, threshold, pass, dimensions: shown, distance }, null, 2));
else {
  console.log(`craft-review: ${site}`);
  for (const [d, v] of Object.entries(shown)) {
    console.log(`\n${d}  ${v.score != null ? v.score + '/100' : 'UNVERIFIED'}`);
    for (const c of v.checks) console.log(`  ${c.pass === null ? '[?]' : c.pass ? '[x]' : '[ ]'} ${c.name}\n      ${c.evidence}`);
  }
  if (distance) { console.log(`\nlibrary distance (${distance.library}): ${distance.note}`); for (const r of distance.rows) console.log(`  ${r.token}: exemplar ${r.exemplar} | site ${r.site} | distance ${r.distance}`); if (!distance.rows.length) console.log('  no comparable tokens in DESIGN.md'); }
  console.log(`\ncraft score ${only ? `(${only})` : ''} ${only ? result[only].score : total}/100, threshold ${threshold}: ${pass ? 'PASS' : 'FAIL'}`);
  if (argv.includes('--loop-hint') && !pass) {
    console.log('\nfix next (re-run with --dimension <name> after each fix; stop after 3 rounds and report what is left):');
    for (const [d, v] of Object.entries(shown)) for (const c of v.checks.filter((x) => x.pass === false)) console.log(`  ${d}: ${c.fix}  [${c.evidence}]`);
  }
}
process.exit(pass ? 0 : 1);
