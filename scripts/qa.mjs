#!/usr/bin/env node
// qa.mjs <projectDir> [--site dir] [--json] [--budget KB]
// Automatic QA pass over the built HTML of a site. Read-only, no dependencies, no network.
// Finds the site folder (site, public, dist, out, build, or the root if it has index.html), then checks every .html file:
// basics, headings, images, links, forms, accessibility, contrast, performance, security, SEO.
// Every finding has a severity (error/warn) and a fix hint. Anything it cannot determine is listed as UNVERIFIED with the reason.
// Exit 1 only when errors > 0 (warnings and unverified items do not fail). Exit 2 on bad usage.
// Also static checks for: no-JavaScript render (visible text, nav links, forms), content hidden at load without a JS guard, and motion safety
// (prefers-reduced-motion override, infinite animations, animated layout properties). qa-browser.mjs measures the same things in a real browser.
// Limits: regex scan, not a browser. Contrast uses CSS rules that pair color with background in one rule; large-text relief is not applied.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, extname, sep } from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const json = args.includes('--json');
const budgetKB = Number(flag('--budget') ?? 500);
const siteArg = flag('--site');
const skip = new Set([siteArg, flag('--budget')]);
const proj = args.find((a) => !a.startsWith('--') && !skip.has(a));
if (!proj || !existsSync(proj) || !statSync(proj).isDirectory()) { console.error('usage: qa.mjs <projectDir> [--site dir] [--json] [--budget KB]'); process.exit(2); }

const root = resolve(proj);
const hasHtml = (d) => existsSync(d) && statSync(d).isDirectory() && walk(d).some((f) => f.endsWith('.html'));
function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
let site = siteArg ? resolve(root, siteArg) : ['site', 'public', 'dist', 'out', 'build'].map((n) => join(root, n)).find(hasHtml);
if (!site && existsSync(join(root, 'index.html'))) site = root;
if (!site || !existsSync(site)) { console.error('qa: no site folder found (looked for site, public, dist, out, build, or index.html in the root). Use --site <dir>.'); process.exit(2); }

const files = walk(site);
const pagesPaths = files.filter((f) => f.endsWith('.html')).sort();
const rel = (p) => relative(site, p).split(sep).join('/');
const read = (p) => readFileSync(p, 'utf8');

// Short secret pattern list. Matches are reported by file only; the value is never printed.
const SECRETS = [/AKIA[0-9A-Z]{16}/, /sk_live_[0-9a-zA-Z]{16,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /ghp_[A-Za-z0-9]{30,}/, /xox[bap]-[0-9A-Za-z-]{10,}/,
  /(?:api[_-]?key|secret|token|password)["']?\s*[:=]\s*["'][A-Za-z0-9_\-+/]{16,}["']/i];

const results = []; const unverified = []; const titles = new Map();
const attrsOf = (s) => { const o = {}; for (const m of s.matchAll(/([^\s=\/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) o[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''; return o; };
const isExt = (u) => /^(?:https?:)?\/\//i.test(u);
const isSkipScheme = (u) => /^(?:mailto|tel|sms|javascript|data|blob):/i.test(u);

// Colour helpers for contrast.
const NAMED = { white: '#ffffff', black: '#000000' };
function toRgb(v) {
  v = v.trim().toLowerCase(); v = NAMED[v] ?? v;
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) { let h = m[1]; if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  m = v.match(/^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const file of pagesPaths) {
  const page = rel(file);
  const F = []; const add = (sev, id, msg, fix) => { if (!F.some((f) => f.id === id && f.msg === msg)) F.push({ sev, id, msg, fix }); };
  const unv = (msg, reason) => { if (!unverified.some((u) => u.msg === msg)) unverified.push({ page, msg, reason }); };
  const raw = read(file);
  const html = raw.replace(/<!--[\s\S]*?-->/g, '');
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const markup = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>').replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, '<script$1></script>');
  const tags = [...markup.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)].map((m) => ({ n: m[1].toLowerCase(), a: attrsOf(m[2]), i: m.index, raw: m[0] }));
  const T = (n) => tags.filter((t) => t.n === n);
  // Elements hidden from everyone (hidden attribute, aria-hidden=true, inline display:none) and everything inside them.
  const selfHidden = (t) => 'hidden' in t.a || t.a['aria-hidden'] === 'true' || /display\s*:\s*none/i.test(t.a.style ?? '');
  const rangesOf = (pred) => tags.filter((t) => pred(t) && !/^(?:input|img|br|hr|meta|link)$/.test(t.n)).map((t) => {
    let depth = 1; const re = new RegExp(`<(/?)${t.n}\\b[^>]*>`, 'gi'); re.lastIndex = t.i + t.raw.length; let e;
    while (depth && (e = re.exec(markup))) depth += e[1] ? -1 : 1;
    return [t.i, e ? e.index : markup.length];
  });
  const hiddenRanges = rangesOf(selfHidden);
  const isHidden = (t) => selfHidden(t) || hiddenRanges.some(([a, b]) => t.i > a && t.i < b);
  const metaName = (n) => T('meta').find((t) => (t.a.name ?? '').toLowerCase() === n);

  // Basics
  if (!/^\s*<!doctype html/i.test(raw)) add('error', 'doctype', 'missing <!doctype html>', 'Start the file with <!doctype html>.');
  const htmlTag = T('html')[0];
  if (!htmlTag?.a.lang) add('error', 'html-lang', '<html> has no lang', 'Add lang="en" (or the page language) to <html>.');
  if (!T('meta').some((t) => 'charset' in t.a || /charset/i.test(t.a.content ?? ''))) add('error', 'charset', 'no charset meta', 'Add <meta charset="utf-8"> first in <head>.');
  if (!metaName('viewport')) add('error', 'viewport', 'no viewport meta', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
  const title = (markup.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  if (!title) add('error', 'title', 'no <title> or it is empty', 'Add a short, specific <title> to <head>.');
  else titles.set(title, [...(titles.get(title) ?? []), page]);
  const desc = (metaName('description')?.a.content ?? '').trim();
  if (desc.length < 50 || desc.length > 170) add('warn', 'meta-description', desc ? `meta description is ${desc.length} characters (want 50-170)` : 'no meta description', 'Add <meta name="description"> of 50-170 characters.');

  // Headings
  const hs = tags.filter((t) => /^h[1-6]$/.test(t.n) && !isHidden(t)).map((t) => +t.n[1]);
  const h1 = hs.filter((l) => l === 1).length;
  if (h1 !== 1) add('error', 'h1', `${h1} <h1> elements (want exactly 1)`, 'Use one <h1> per page for the main heading.');
  hs.forEach((l, i) => { if (i && l > hs[i - 1] + 1) add('error', 'heading-order', `heading jumps from h${hs[i - 1]} to h${l}`, 'Do not skip levels: go h2 then h3, not h2 then h4.'); });

  // Local file resolver for links and assets.
  const ids = (f) => new Set([...read(f).matchAll(/\s(?:id|name)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]));
  const localTarget = (u) => {
    const [pathPart, hash = ''] = u.split('#'); const p = pathPart.split('?')[0];
    if (!p) return { f: file, hash };
    let f = p.startsWith('/') ? join(site, p) : join(dirname(file), decodeURI(p));
    if (!existsSync(f) && !extname(f) && existsSync(f + '.html')) f += '.html';
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    return { f, hash, p };
  };

  // Images
  for (const t of T('img')) {
    if (!('alt' in t.a)) add('error', 'img-alt', `image without alt: ${t.a.src ?? '(no src)'}`, 'Add alt="description", or alt="" if purely decorative.');
    if (!((t.a.width && t.a.height) || /aspect-ratio/i.test(t.a.style ?? ''))) add('warn', 'img-size', `image without width/height: ${t.a.src ?? '(no src)'}`, 'Add width and height (or an aspect-ratio) so the layout does not jump.');
  }

  // Links and assets
  for (const t of T('a')) {
    const h = t.a.href;
    if (h === undefined) continue;
    if (h.trim() === '' || h.trim() === '#') { add('warn', 'link-empty', `empty or "#" link${h ? '' : ' (href="")'}`, 'Point the link at a real page or section, or use a <button>.'); continue; }
    if (/^#[\/!]/.test(h)) { unv('client-side routes cannot be verified statically; use controls-test', 'hash routes such as #/today are handled by JavaScript'); continue; }
    if (isSkipScheme(h)) continue;
    if (isExt(h)) {
      if (/^http:/i.test(h)) add('warn', 'link-scheme', `external link not https: ${h}`, 'Use https:// for external links.');
      if ((t.a.target ?? '').toLowerCase() === '_blank' && !/noopener|noreferrer/i.test(t.a.rel ?? '')) add('error', 'link-target-rel', `target="_blank" without rel: ${h}`, 'Add rel="noopener noreferrer".');
      continue;
    }
    if ((t.a.target ?? '').toLowerCase() === '_blank' && !/noopener|noreferrer/i.test(t.a.rel ?? '')) add('error', 'link-target-rel', `target="_blank" without rel: ${h}`, 'Add rel="noopener noreferrer".');
    const { f, hash } = localTarget(h);
    if (!existsSync(f)) { add('error', 'link-dead', `internal link target not found: ${h}`, 'Fix the path or create the page.'); continue; }
    if (hash && hash !== 'top') {
      if (!f.endsWith('.html')) unv(`anchor #${hash} in ${h}`, 'target is not an HTML file');
      else if (!ids(f).has(hash)) add('error', 'anchor-dead', `anchor not found: ${h}`, 'Add an id to the target element or fix the anchor name.');
    }
  }
  const refs = [];
  for (const t of T('img')) if (t.a.src) refs.push(t.a.src);
  for (const t of T('script')) if (t.a.src) refs.push(t.a.src);
  for (const t of T('link')) if (t.a.href && !/canonical|alternate|author|license|me\b/i.test(t.a.rel ?? '')) refs.push(t.a.href);
  let weight = Buffer.byteLength(raw); const seen = new Set(); let cssText = styles.join('\n'); let extUsed = false;
  for (const u of refs) {
    if (isExt(u)) {
      extUsed = true;
      add('warn', 'privacy-external', `privacy: external request to ${u}`, 'Self-host the file, or confirm the third party is acceptable (it learns about every visitor).');
      if (/^http:/i.test(u)) add('error', 'mixed-content', `mixed content (http) request: ${u}`, 'Use https:// for every request.');
      continue;
    }
    if (isSkipScheme(u)) continue;
    const { f } = localTarget(u);
    if (!existsSync(f)) { add('error', 'link-dead', `referenced file not found: ${u}`, 'Fix the path or add the file.'); continue; }
    if (seen.has(f)) continue; seen.add(f);
    const sz = statSync(f).size; weight += sz;
    if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(f) && sz > 200 * 1024) add('warn', 'image-weight', `image over 200 KB: ${u} (${Math.round(sz / 1024)} KB)`, 'Compress or resize the image (WebP/AVIF).');
    if (f.endsWith('.css')) cssText += '\n' + read(f);
  }
  if (extUsed) unv('page weight and CSS from external requests', 'external files are not fetched (no network)');
  if (weight > budgetKB * 1024) add('warn', 'page-weight', `page weight ${Math.round(weight / 1024)} KB exceeds budget ${budgetKB} KB`, 'Remove or compress the largest files, or raise the budget with --budget.');

  // Forms
  const labels = [...markup.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)].map((m) => ({ a: attrsOf(m[1]), s: m.index, e: m.index + m[0].length }));
  for (const t of [...T('input'), ...T('select'), ...T('textarea')]) {
    if (t.n === 'input' && /^(hidden|submit|button|reset|image)$/i.test(t.a.type ?? 'text')) continue;
    if (isHidden(t)) continue;
    const labelled = t.a['aria-label'] || t.a['aria-labelledby'] || (t.a.id && labels.some((l) => l.a.for === t.a.id)) || labels.some((l) => t.i > l.s && t.i < l.e);
    if (!labelled) add('error', 'form-label', `form field without a label: ${t.a.name ?? t.a.id ?? t.n}`, 'Add <label for="id"> or aria-label.');
  }
  for (const m of markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const a = attrsOf(m[1]); const txt = m[2].replace(/<img\b[^>]*alt\s*=\s*["']([^"']+)["'][^>]*>/gi, '$1').replace(/<[^>]*>/g, '').trim();
    if (!txt && !a['aria-label'] && !a.title) add('error', 'button-text', 'button without text', 'Give the button visible text or aria-label.');
  }
  for (const t of T('form')) if (/^http:/i.test(t.a.action ?? '')) add('error', 'form-action', `form posts to http: ${t.a.action}`, 'Use https:// for the form action.');

  // Accessibility
  if (!T('main').length && !tags.some((t) => (t.a.role ?? '') === 'main')) add('warn', 'landmark-main', 'no <main> landmark', 'Wrap the page content in <main>.');
  const firstA = T('a')[0];
  if (!(firstA && (firstA.a.href ?? '').startsWith('#') && firstA.a.href.length > 1)) add('warn', 'skip-link', 'no skip link at the top', 'Add <a href="#main">Skip to content</a> as the first link.');
  for (const t of tags) if (Number(t.a.tabindex) > 0) add('warn', 'tabindex', `tabindex=${t.a.tabindex} breaks natural focus order`, 'Use tabindex="0" or "-1", or reorder the markup.');

  // CSS: contrast and motion
  const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const vars = {}; for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) vars[m[1]] ??= m[2].trim();
  const resolveColor = (v, depth = 0) => {
    v = v.trim().replace(/\s*!important$/i, '');
    const vm = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
    if (vm) { const nx = vars[vm[1]] ?? vm[2]; return nx && depth < 5 ? resolveColor(nx, depth + 1) : { err: `${vm[1]} is not defined in this CSS` }; }
    const c = toRgb(v); return c ? { c } : { err: `unsupported colour "${v}"` };
  };
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decl = {}; for (const d of m[2].split(';')) { const i = d.indexOf(':'); if (i > 0) decl[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim(); }
    const fg = decl.color; let bg = decl['background-color'] ?? decl.background;
    if (!fg || !bg) continue;
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (/gradient|url\(/i.test(bg)) { unv(`${sel}: text/background contrast`, 'background is an image or gradient'); continue; }
    const a = resolveColor(fg), b = resolveColor(bg.split(/\s+/).length > 1 && !/^(?:rgb|var)\(/.test(bg) ? bg.split(/\s+/).find((x) => toRgb(x)) ?? bg : bg);
    if (a.err || b.err) { unv(`${sel}: color ${fg} on ${bg}`, `could not verify: ${a.err ?? b.err}`); continue; }
    const r = ratio(a.c, b.c);
    if (r < 4.5) add('error', 'contrast', `${sel}: contrast ${r.toFixed(2)}:1 (${fg} on ${bg}), needs 4.5:1`, 'Darken the text or lighten the background until the ratio is at least 4.5:1.');
  }
  // No-JavaScript render: what a visitor sees with scripts off.
  const plain = (h) => h.replace(/<style\b[\s\S]*?<\/style>|<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  if (!T('a').some((t) => t.a.href && !isSkipScheme(t.a.href) && t.a.href !== '#')) add('error', 'nojs-nav', 'no navigation links in the HTML', 'Write the nav links as <a href> in the markup, not from JavaScript.');
  if (T('form').some((t) => !t.a.action) && !/<noscript\b/i.test(markup)) add('error', 'nojs-form', 'form without action and no <noscript> message', 'Give the form an action that works without JavaScript, or add a <noscript> note inside the form telling visitors what to do without JavaScript.');

  // Content hidden at load: reveal/animation classes that start invisible must not depend on JS having run.
  const rules = []; const flat = (src, ctx) => {
    for (let i = 0; i < src.length;) {
      const o = src.indexOf('{', i); if (o < 0) break;
      let d = 1, j = o + 1; while (j < src.length && d) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; }
      const head = src.slice(i, o).trim(), inner = src.slice(o + 1, j - 1);
      if (!head.startsWith('@')) rules.push({ sel: head, body: inner, ctx });
      else if (/^@(?:-\w+-)?keyframes/i.test(head)) rules.push({ kf: true, body: inner, ctx });
      else flat(inner, ctx + ' ' + head);
      i = j;
    }
  };
  flat(css, '');
  const used = new Set([...markup.matchAll(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].flatMap((m) => (m[1] ?? m[2]).split(/\s+/)));
  const noscriptCss = [...html.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi)].map((m) => m[1]).join('\n');
  for (const r of rules) {
    if (r.kf || /scripting\s*:\s*enabled/i.test(r.ctx)) continue;
    const hides = /(?:^|[;\s])(?:opacity\s*:\s*0(?:\.0+)?\s*(?:;|$)|visibility\s*:\s*hidden|display\s*:\s*none)/i.test(r.body) ||
      [...r.body.matchAll(/translate(?:[XY]|3d)?\(([^)]*)\)/gi)].some((m) => (m[1].match(/-?\d*\.?\d+/g) ?? []).some((n) => Math.abs(+n) >= 100));
    if (!hides) continue;
    for (const sel of r.sel.split(',').map((x) => x.trim())) {
      if (!/reveal|fade|anim|appear|enter|slide|scroll|aos|hidden|offscreen|js-/i.test(sel)) continue;
      if (/(?:^|[\s>+~])(?:html|body)?\.js(?![\w-])|\[data-js|\.no-js\b/.test(sel)) continue;
      const last = sel.split(/[\s>+~]+/).pop(); // the compound selector that targets the element
      const cls = [...last.matchAll(/\.([\w-]+)/g)].map((m) => m[1]); const attrNames = [...last.matchAll(/\[([\w-]+)/g)].map((m) => m[1].toLowerCase());
      if (!cls.length || !cls.every((c) => used.has(c))) continue;
      if (cls.some((c) => noscriptCss.includes('.' + c))) continue;
      if (/\[hidden\]/i.test(sel) || cls.some((c) => /js-only|no-js|result|status|toast|modal|dialog/i.test(c))) continue;
      // Only CONTENT counts: an element using the class with 40+ characters of text that is not a control or live region.
      const content = [...markup.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)].some((m) => {
        const a = attrsOf(m[2]); const tn = m[1].toLowerCase();
        const have = (a.class ?? '').split(/\s+/); if (!cls.every((c) => have.includes(c)) || !attrNames.every((n) => n in a)) return false;
        if (tn === 'button' || 'hidden' in a || 'aria-live' in a || /^(?:status|alert)$/i.test(a.role ?? '')) return false;
        let depth = 1, pos = m.index + m[0].length; const re = new RegExp(`<(/?)${tn}\\b[^>]*>`, 'gi'); re.lastIndex = pos; let e;
        while (depth && (e = re.exec(markup))) depth += e[1] ? -1 : 1;
        return plain(markup.slice(pos, e ? e.index : undefined)).length >= 40;
      });
      if (!content) continue;
      add('error', 'hidden-at-load', `${sel} starts hidden (${r.body.trim().replace(/\s+/g, ' ').slice(0, 60)}) and is used in the markup without a JS guard`, 'Scope the hidden state under .js (set the class from a script in <head>), use @media (scripting: enabled), or add a <noscript> style that shows it.');
    }
  }

  // Text hidden without JS (hidden attribute, aria-hidden, inline or CSS display:none on a top-level rule) does not count; <noscript> does.
  // shortcut: a CSS rule is matched on its last compound selector only (class, id, tag, [attr]); rules inside @media are ignored.
  const cssHide = (t) => rules.some((r) => !r.kf && r.ctx.trim() === '' && /(?:^|[;\s])display\s*:\s*none/i.test(r.body) && r.sel.split(',').some((sel) => {
    const last = sel.trim().split(/[\s>+~]+/).pop(); if (!last || /:|\.js\b/.test(last)) return false;
    const have = (t.a.class ?? '').split(/\s+/);
    return (last.match(/[.#]?[\w-]+|\[[\w-]+/g) ?? []).every((p) => p[0] === '.' ? have.includes(p.slice(1)) : p[0] === '#' ? t.a.id === p.slice(1) : p[0] === '[' ? p.slice(1).toLowerCase() in t.a : p.toLowerCase() === t.n);
  }));
  let shown = markup; for (const [x, y] of rangesOf((t) => selfHidden(t) || cssHide(t)).sort((p, q) => q[0] - p[0])) shown = shown.slice(0, x) + ' ' + shown.slice(y);
  const body = (shown.match(/<main\b[\s\S]*<\/main>/i) ?? shown.match(/<body\b[\s\S]*<\/body>/i) ?? [''])[0];
  const visible = plain(body.replace(/<script\b[\s\S]*?<\/script>/gi, ''));
  const minText = /(?:^|\/)404\.html$/.test(page) ? 40 : 200;
  if (visible.length < minText) add('error', 'nojs-content', `only ${visible.length} characters of visible text in <${/<main\b/i.test(markup) ? 'main' : 'body'}> without JavaScript (want ${minText}+)`, 'Put the real content in the HTML (render it at build time) instead of building it with JavaScript.');
  // Motion safety: reduced-motion override, infinite animations, animated layout properties.
  const secs = (v) => [...v.matchAll(/(\d*\.?\d+)(ms|s)\b/g)].map((m) => (m[2] === 'ms' ? +m[1] / 1000 : +m[1]));
  const decls = rules.filter((r) => !r.kf).flatMap((r) => r.body.split(';').map((d) => d.trim()));
  const long = decls.some((d) => /^animation(?:-name)?\s*:\s*(?!none)/i.test(d) && (/^animation-name/i.test(d) || !secs(d).length || Math.max(...secs(d)) > 0.3)) || decls.some((d) => /^transition(?:-duration)?\s*:/i.test(d) && Math.max(0, ...secs(d)) > 0.3);
  if (long && !/prefers-reduced-motion/i.test(css)) add('error', 'reduced-motion', 'animation or transition over 0.3s without a prefers-reduced-motion override', 'Add @media (prefers-reduced-motion: reduce) { ... } that switches the motion off.');
  if (decls.some((d) => /^animation(?:-iteration-count)?\s*:.*\binfinite\b/i.test(d)) && !/animation-play-state/i.test(css) && !/pause|stop animation/i.test(plain(markup)))
    add('warn', 'infinite-animation', 'infinite animation with no pause control', 'Add a pause/stop button (WCAG 2.2.2) or limit the iteration count; at least switch it off under prefers-reduced-motion.');
  const LAYOUT = /(?:^|[;{\s])(?:width|height|top|left|right|bottom|margin(?:-[a-z]+)?)\s*:/i;
  if (rules.some((r) => r.kf && LAYOUT.test(r.body)) || decls.some((d) => /^transition(?:-property)?\s*:.*\b(?:width|height|top|left|right|bottom|margin(?:-[a-z]+)?)\b/i.test(d)))
    add('warn', 'layout-animation', 'animates a layout property (width, height, top, left, margin)', 'Animate transform and opacity instead; layout properties cause jank and layout shift.');

  // Security
  for (const t of tags) { const on = Object.keys(t.a).find((k) => /^on[a-z]+$/.test(k)); if (on) add('error', 'inline-handler', `inline event handler ${on} on <${t.n}>`, 'Move the handler to a script file with addEventListener.'); }
  if (/^http:/i.test(T('base')[0]?.a.href ?? '')) add('error', 'mixed-content', '<base> uses http', 'Use https://.');

  // SEO
  if (!T('link').some((t) => /canonical/i.test(t.a.rel ?? ''))) add('warn', 'canonical', 'no canonical link', 'Add <link rel="canonical" href="https://your-domain/path">.');
  const og = (p) => T('meta').some((t) => t.a.property === p && t.a.content);
  if (!og('og:title') || !og('og:description')) add('warn', 'og', 'missing og:title or og:description', 'Add <meta property="og:title"> and og:description.');
  if (!T('link').some((t) => /icon/i.test(t.a.rel ?? '')) && !existsSync(join(site, 'favicon.ico'))) add('warn', 'favicon', 'no favicon', 'Add <link rel="icon" href="favicon.ico"> and the file.');
  results.push({ page, findings: F });
}

// Site-level and cross-page
const S = [];
for (const [t, ps] of titles) if (ps.length > 1) for (const p of ps) results.find((r) => r.page === p).findings.push({ sev: 'warn', id: 'title-duplicate', msg: `title "${t}" is also used on ${ps.filter((x) => x !== p).join(', ')}`, fix: 'Give every page its own title.' });
if (!existsSync(join(site, 'robots.txt'))) S.push({ sev: 'warn', id: 'robots', msg: 'no robots.txt', fix: 'Add robots.txt at the site root.' });
if (!existsSync(join(site, 'sitemap.xml'))) S.push({ sev: 'warn', id: 'sitemap', msg: 'no sitemap.xml', fix: 'Add sitemap.xml at the site root.' });
if (!existsSync(join(site, '404.html'))) S.push({ sev: 'warn', id: 'not-found', msg: 'no 404.html', fix: 'Add a friendly 404.html.' });
for (const f of files.filter((x) => /\.(html|js|mjs|css|json|txt|map)$/i.test(x) && statSync(x).size < 5e6)) {
  if (SECRETS.some((re) => re.test(read(f)))) S.push({ sev: 'error', id: 'secret', msg: `secret-looking string in ${rel(f)} (value not shown)`, fix: 'Remove it, rotate the key, and load secrets on the server instead.' });
}
if (!pagesPaths.length) unverified.push({ page: '(site)', msg: 'no .html files found', reason: 'nothing to check' });
if (S.length) results.push({ page: '(site)', findings: S });

const count = (fs, s) => fs.filter((f) => f.sev === s).length;
const pages = results.map((r) => ({ page: r.page, errors: count(r.findings, 'error'), warnings: count(r.findings, 'warn'), findings: r.findings }));
const E = pages.reduce((n, p) => n + p.errors, 0), W = pages.reduce((n, p) => n + p.warnings, 0), U = unverified.length;
const summary = `qa: ${E} error(s), ${W} warning(s), ${U} unverified`;
if (json) console.log(JSON.stringify({ site: rel(site) || '.', budgetKB, pages, unverified, summary: { errors: E, warnings: W, unverified: U } }, null, 2));
else {
  console.log(`QA report for ${site}\n`);
  for (const p of pages) {
    console.log(`${p.page}: ${p.errors} error(s), ${p.warnings} warning(s)`);
    for (const f of [...p.findings].sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'error' ? -1 : 1))) console.log(`  ${f.sev === 'error' ? 'ERROR' : 'warn '} [${f.id}] ${f.msg}\n        fix: ${f.fix}`);
    if (!p.findings.length) console.log('  no findings');
  }
  if (U) { console.log('\nUNVERIFIED (could not be checked automatically)'); for (const u of unverified) console.log(`  ${u.page}: ${u.msg}: ${u.reason}`); }
  console.log(`\n${summary}`);
}
process.exit(E > 0 ? 1 : 0);
