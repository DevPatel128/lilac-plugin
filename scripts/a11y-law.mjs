#!/usr/bin/env node
// a11y-law.mjs check <dir> [--site dir] [--json]
// Static WCAG 2.2 AA checks that qa.mjs does not have, plus a European Accessibility Act (EAA) section. Read-only, no dependencies, no network.
// Covers (each finding names its success criterion): 1.3.1/4.1.2 dangling label/aria ids, 1.3.5 autocomplete, 1.4.2 autoplay, 1.4.4 zoom blocked,
// 1.2.2 captions, 2.1.2 keyboard-trap patterns, 2.2.2/2.3.3 smooth scroll without reduced-motion, 2.4.4 vague link text, 2.4.7 focus outline removed,
// 2.4.11 fixed header without scroll-padding, 2.5.7 dragging with no alternative, 2.5.8 target size < 24px, 3.1.1 lang value, 3.2.3 consistent navigation,
// 3.2.6 consistent help, 3.3.7 redundant entry, 3.3.8 accessible authentication, 4.1.2 iframe title.
// qa.mjs already owns: alt text, labels, headings, contrast, skip link, landmarks, reduced-motion override, infinite animation, tabindex>0. Not repeated.
// EAA: an accessibility statement exists, is linked from every page, has a contact route and a feedback mechanism, names a standard and a date, and says how
// to complain (enforcement). Sites with cart/checkout/product signals (e-commerce) get errors instead of warnings. Not legal advice; whether the Act applies
// (for example the microenterprise exemption for services) is UNKNOWN to this tool and printed as such.
// Exit 1 only on errors. Exit 2 on bad usage. Last line: `a11y-law: E error(s), W warning(s), U unverified`.
// HONEST LIMIT: static checks cannot prove conformance. They read markup and CSS only. Browser axe results are separate and are not claimed here.
// shortcut: regex scan like qa.mjs; CSS rules are matched by selector text, media queries are flattened; upgrade to a real DOM/CSS engine if false positives grow.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const json = args.includes('--json');
const si = args.indexOf('--site'); const siteArg = si < 0 ? null : args[si + 1];
const [cmd, ...rest] = args.filter((a, i) => !a.startsWith('--') && (si < 0 || i !== si + 1));
const proj = rest[0];
if (cmd !== 'check' || !proj || !existsSync(proj) || !statSync(proj).isDirectory()) { console.error('usage: a11y-law.mjs check <dir> [--site dir] [--json]'); process.exit(2); }

const walk = (d, out = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name === '.git' || e.name === '.lilac') continue; const p = join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; };
const hasHtml = (d) => existsSync(d) && statSync(d).isDirectory() && walk(d).some((f) => f.endsWith('.html'));
const root = resolve(proj);
let site = siteArg ? resolve(root, siteArg) : ['site', 'public', 'dist', 'out', 'build'].map((n) => join(root, n)).find(hasHtml);
if (!site && hasHtml(root)) site = root;
if (!site) { console.error('a11y-law: no site folder found (site, public, dist, out, build, or .html files in the root). Use --site <dir>.'); process.exit(2); }

const rel = (p) => relative(site, p).split(sep).join('/');
const read = (p) => readFileSync(p, 'utf8');
const pagesPaths = walk(site).filter((f) => f.endsWith('.html')).sort();
const attrsOf = (s) => { const o = {}; for (const m of s.matchAll(/([^\s=\/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) o[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''; return o; };
const isExt = (u) => /^(?:https?:)?\/\//i.test(u);
const plain = (h) => h.replace(/<style\b[\s\S]*?<\/style>|<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const byPage = []; const unverified = []; const site$ = [];
const addTo = (F) => (sev, sc, id, msg, fix) => { if (!F.some((f) => f.id === id && f.msg === msg)) F.push({ sev, sc, id, msg, fix }); };

const info = [];
for (const file of pagesPaths) {
  const page = rel(file); const F = []; const add = addTo(F);
  const html = read(file).replace(/<!--[\s\S]*?-->/g, '');
  const scriptsInline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const markup = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>').replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, '<script$1></script>');
  const tags = [...markup.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)].map((m) => ({ n: m[1].toLowerCase(), a: attrsOf(m[2]), i: m.index, raw: m[0] }));
  const T = (n) => tags.filter((t) => t.n === n);
  const local = (u) => { if (!u || isExt(u) || /^(?:mailto|tel|data|javascript):/i.test(u)) return null; const p = u.split('#')[0].split('?')[0]; if (!p) return null; const f = p.startsWith('/') ? join(site, p) : join(dirname(file), decodeURI(p)); return existsSync(f) && statSync(f).isFile() ? f : null; };
  let css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  for (const t of T('link')) if (/stylesheet/i.test(t.a.rel ?? '')) { const f = local(t.a.href); if (f) css += '\n' + read(f); }
  let js = scriptsInline.join('\n');
  for (const t of T('script')) { const f = local(t.a.src); if (f) js += '\n' + read(f); }
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = []; const flat = (src) => { for (let i = 0; i < src.length;) { const o = src.indexOf('{', i); if (o < 0) break; let d = 1, j = o + 1; while (j < src.length && d) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; } const head = src.slice(i, o).trim(), inner = src.slice(o + 1, j - 1); if (!head.startsWith('@')) rules.push({ sel: head, body: inner }); else if (!/^@(?:-\w+-)?keyframes|^@font-face/i.test(head)) flat(inner); i = j; } };
  flat(css);
  const px = (body, prop) => { const m = body.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*(\\d*\\.?\\d+)px`, 'i')); return m ? +m[1] : null; };

  // 3.1.1 Language of page
  const lang = T('html')[0]?.a.lang;
  if (!lang) add('error', '3.1.1', 'lang', '<html> has no lang', 'Add lang="en" (or the page language) to <html>.');
  else if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/i.test(lang)) add('error', '3.1.1', 'lang', `lang="${lang}" is not a valid language tag`, 'Use a BCP 47 tag such as en, en-GB or hi.');

  // 1.4.4 Resize text (zoom must not be blocked)
  const vp = T('meta').find((t) => (t.a.name ?? '').toLowerCase() === 'viewport')?.a.content ?? '';
  const max = vp.match(/maximum-scale\s*=\s*([\d.]+)/i);
  if (/user-scalable\s*=\s*(?:no|0)/i.test(vp) || (max && +max[1] < 2)) add('error', '1.4.4', 'zoom-blocked', `viewport blocks zoom (${vp})`, 'Remove user-scalable=no and maximum-scale; people with low vision rely on pinch zoom.');

  // 1.3.1 / 4.1.2 ids referenced but missing
  const ids = new Set(tags.map((t) => t.a.id).filter(Boolean));
  for (const t of T('label')) if (t.a.for && !ids.has(t.a.for)) add('warn', '1.3.1', 'label-for', `<label for="${t.a.for}"> points to no element`, 'Give the field the matching id.');
  for (const t of tags) for (const k of ['aria-labelledby', 'aria-describedby', 'aria-controls']) for (const id of (t.a[k] ?? '').split(/\s+/).filter(Boolean)) if (!ids.has(id)) add('error', '4.1.2', 'aria-ref', `${k}="${id}" on <${t.n}> points to no element`, 'Fix the id or remove the attribute.');
  for (const t of T('iframe')) if (!(t.a.title || t.a['aria-label'] || t.a['aria-labelledby'])) add('error', '4.1.2', 'iframe-title', `<iframe${t.a.src ? ' src=' + t.a.src : ''}> has no title`, 'Add a short title attribute that says what the frame contains.');

  // 1.3.5 Identify input purpose
  const AC = /^(?:e-?mail|phone|tel|name|full-?name|first-?name|last-?name|given-?name|family-?name|address|street|city|postcode|postal|zip|cc-?(?:number|name|exp|csc)|card-?number)$/i;
  const noAc = T('input').filter((t) => !/^(hidden|submit|button|reset|checkbox|radio|file|image)$/i.test(t.a.type ?? 'text') && !t.a.autocomplete && (/^(?:email|tel)$/i.test(t.a.type ?? '') || AC.test(t.a.name ?? t.a.id ?? '')));
  if (noAc.length) add('warn', '1.3.5', 'autocomplete', `${noAc.length} personal-data field(s) without autocomplete: ${noAc.map((t) => t.a.name ?? t.a.id ?? t.a.type).join(', ')}`, 'Add autocomplete="email", "tel", "name", "street-address" and so on.');

  // 2.4.4 Link purpose
  const VAGUE = /^(?:click here|here|read more|more|learn more|link|this|details|info)$/i;
  for (const m of markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) { const a = attrsOf(m[1]); const txt = plain(m[2]); if (a.href !== undefined && !a['aria-label'] && !a['aria-labelledby'] && VAGUE.test(txt)) add('warn', '2.4.4', 'link-purpose', `link text "${txt}" does not say where it goes`, 'Use text that makes sense out of context, or add a visually hidden suffix or aria-label.'); }

  // 1.2.2 Captions, 1.4.2 Audio control
  for (const t of T('video')) {
    const end = markup.indexOf('</video>', t.i); const inner = end < 0 ? '' : markup.slice(t.i, end);
    if (!/<track\b[^>]*kind\s*=\s*["']?(?:captions|subtitles)/i.test(inner)) add('warn', '1.2.2', 'captions', `<video${t.a.src ? ' src=' + t.a.src : ''}> has no captions track`, 'Add <track kind="captions" src="..." srclang="en"> (or confirm the video has no speech and say so in a text alternative).');
  }
  for (const t of [...T('video'), ...T('audio')]) if ('autoplay' in t.a && !('muted' in t.a && t.n === 'video') && !('controls' in t.a)) add('error', '1.4.2', 'autoplay-audio', `<${t.n}> autoplays sound with no controls`, 'Remove autoplay, or mute it and add controls.');

  // 2.4.7 Focus visible: outline removed without a replacement
  for (const r of rules) {
    if (!/outline\s*:\s*(?:none|0)(?![.\d])|outline-style\s*:\s*none/i.test(r.body)) continue;
    if (!/:focus/i.test(r.sel) && !/^\s*\*|^\s*a\b|^\s*button\b|^\s*input\b/i.test(r.sel)) continue;
    if (/:focus-visible/i.test(r.sel) && !/:focus(?!-)/.test(r.sel)) continue; // :focus:not(:focus-visible){outline:none} style is fine
    if (/:focus(?!-)[^,]*:not\(\s*:focus-visible/i.test(r.sel)) continue;
    if (/box-shadow\s*:\s*(?!none)|border(?:-color)?\s*:|background(?:-color)?\s*:|text-decoration\s*:|outline\s*:\s*(?!none|0\b)\S/i.test(r.body.replace(/outline\s*:\s*(?:none|0)\b/i, ''))) continue;
    const hasFv = rules.some((x) => /:focus-visible/i.test(x.sel) && /outline|box-shadow|border/i.test(x.body));
    if (!hasFv) add('error', '2.4.7', 'focus-removed', `${r.sel.replace(/\s+/g, ' ')}: focus outline removed with no replacement`, 'Keep the outline, or add a visible replacement (outline or box-shadow with 3:1 contrast) under :focus-visible.');
  }

  // 2.4.11 Focus not obscured (minimum): fixed/sticky bars need scroll-padding
  const bars = rules.filter((r) => /position\s*:\s*(?:fixed|sticky)/i.test(r.body) && (/(?:^|[;\s])top\s*:/i.test(r.body) || !/(?:^|[;\s])bottom\s*:/i.test(r.body)) && /header|nav|topbar|navbar|banner|sticky|fixed|bar\b/i.test(r.sel));
  if (bars.length && !/scroll-padding|scroll-margin/i.test(css)) add('warn', '2.4.11', 'focus-obscured', `${bars[0].sel.replace(/\s+/g, ' ')} is fixed/sticky and no scroll-padding-top or scroll-margin is set`, 'Add html { scroll-padding-top: <bar height> } so a focused control is never hidden under the bar. Test by tabbing with the keyboard.');

  // 2.4.11 / 2.3.3 smooth scroll
  if (rules.some((r) => /scroll-behavior\s*:\s*smooth/i.test(r.body)) && !/prefers-reduced-motion[^{]*\{[\s\S]*scroll-behavior\s*:\s*auto/i.test(css)) add('warn', '2.3.3', 'smooth-scroll', 'scroll-behavior: smooth with no prefers-reduced-motion override', 'Wrap it in @media (prefers-reduced-motion: no-preference) or reset it to auto under reduce.');

  // 2.5.8 Target size (minimum 24x24 CSS px)
  for (const r of rules) {
    if (!/(?:^|[\s,>+~])(?:button|a|input|select|summary|\.btn[\w-]*|\.icon[\w-]*|\.close[\w-]*|\.chip|\.tag|\.pill|\[role=["']?button)/i.test(r.sel) || /:not|:root/.test(r.sel)) continue;
    const w = px(r.body, 'width'), h = px(r.body, 'height'), mw = px(r.body, 'min-width'), mh = px(r.body, 'min-height');
    if (((w !== null && w < 24 && !(mw >= 24)) || (h !== null && h < 24 && !(mh >= 24))) && !/display\s*:\s*inline(?![-\w])/i.test(r.body))
      add('warn', '2.5.8', 'target-size', `${r.sel.replace(/\s+/g, ' ')} is ${w ?? 'auto'}x${h ?? 'auto'}px, under the 24x24px target minimum`, 'Make the clickable area at least 24x24 CSS px (padding counts), or keep 24px of space around it. Inline text links are exempt.');
  }
  for (const t of tags) { const s = t.a.style ?? ''; const w = px(s, 'width'), h = px(s, 'height'); if (/^(?:a|button|input)$/.test(t.n) && ((w !== null && w < 24) || (h !== null && h < 24))) add('warn', '2.5.8', 'target-size', `<${t.n}> inline style makes it smaller than 24x24px`, 'Make the clickable area at least 24x24 CSS px.'); }

  // 2.5.7 Dragging movements
  const dragUse = tags.some((t) => t.a.draggable === 'true') || /\b(?:dragstart|ondragstart|Sortable|dragula|interact\s*\(|\.draggable\s*\()/.test(js);
  if (dragUse && !/move (?:up|down|left|right)|reorder|\bmove\b[^<]{0,20}(?:button|arrow)/i.test(plain(markup) + ' ' + tags.map((t) => t.a['aria-label'] ?? '').join(' '))) add('warn', '2.5.7', 'dragging', 'drag and drop is used and no single-pointer alternative was found (for example Move up / Move down buttons)', 'Offer buttons or a select that do the same thing without dragging.');
  if (T('input').some((t) => /^range$/i.test(t.a.type ?? ''))) unverified.push({ page, msg: 'range sliders', reason: '2.5.7 is met by the native control (click and arrow keys); custom sliders cannot be judged statically' });

  // 2.1.2 No keyboard trap (patterns only)
  if (/blur[^}]{0,120}\.focus\s*\(\)/.test(js) || tags.some((t) => /onblur\s*=/.test(t.raw) && /focus\(/.test(t.a.onblur ?? ''))) add('error', '2.1.2', 'keyboard-trap', 'a blur handler moves focus back (focus is pulled back, a classic keyboard trap)', 'Do not refocus on blur. For modals, trap focus only while open and always allow Escape.');
  if (/key(?:Code)?\s*(?:===?|==)\s*['"]?(?:Tab|9)['"]?[\s\S]{0,200}preventDefault/.test(js) && !/Escape|Esc\b|keyCode\s*===?\s*27/.test(js)) add('warn', '2.1.2', 'keyboard-trap', 'Tab key is intercepted with preventDefault and no Escape handler exists', 'Make sure every focus trap can be left with the keyboard (Escape or the Tab order continues).');

  // 3.3.7 Redundant entry
  for (const t of T('input')) { const k = `${t.a.name ?? ''} ${t.a.id ?? ''}`; if (/confirm[-_ ]?e-?mail|e-?mail[-_ ]?(?:confirm|2|repeat|again)|re-?enter/i.test(k)) add('warn', '3.3.7', 'redundant-entry', `field "${k.trim()}" asks for something already entered`, 'Drop the repeat field, or auto-fill it. Show the address and let the person correct it.'); }
  for (const m of markup.matchAll(/<form\b[\s\S]*?<\/form>/gi)) { const f = m[0]; if (/(?:name|id)\s*=\s*["'](?:ship|shipping)[\w-]*/i.test(f) && /(?:name|id)\s*=\s*["']bill(?:ing)?[\w-]*/i.test(f) && !/same as|billing[^<]{0,40}same|use[^<]{0,30}shipping|use[^<]{0,30}billing/i.test(f)) add('warn', '3.3.7', 'redundant-entry', 'separate shipping and billing address fields with no "same as" option', 'Add a "Billing address is the same as shipping" checkbox that fills the second set.'); }

  // 3.3.8 Accessible authentication (minimum)
  for (const t of T('input').filter((x) => /^password$/i.test(x.a.type ?? ''))) {
    if (/^off$/i.test(t.a.autocomplete ?? '')) add('error', '3.3.8', 'auth-autocomplete-off', 'password field has autocomplete="off" (blocks password managers)', 'Use autocomplete="current-password" or "new-password".');
    else if (!t.a.autocomplete) add('warn', '3.3.8', 'auth-autocomplete', 'password field has no autocomplete attribute', 'Add autocomplete="current-password" (sign in) or "new-password" (sign up), and autocomplete="username" on the user field.');
    if ('onpaste' in t.a) add('error', '3.3.8', 'auth-paste-blocked', 'password field blocks paste', 'Allow paste so password managers and copy/paste work.');
  }
  if (/addEventListener\(\s*['"]paste['"][\s\S]{0,120}preventDefault/.test(js) && T('input').some((t) => /^password$/i.test(t.a.type ?? ''))) add('error', '3.3.8', 'auth-paste-blocked', 'script blocks paste on a page with a password field', 'Allow paste.');
  for (const t of T('input')) if (/otp|one-?time|verification[-_ ]?code|2fa|mfa/i.test(`${t.a.name ?? ''} ${t.a.id ?? ''}`) && !/one-time-code/i.test(t.a.autocomplete ?? '')) add('warn', '3.3.8', 'auth-otp', 'one-time-code field without autocomplete="one-time-code"', 'Add autocomplete="one-time-code" so the code can be filled from a message.');
  if (/g-recaptcha|h-captcha|hcaptcha|recaptcha\/api|captcha/i.test(markup)) add('warn', '3.3.8', 'auth-captcha', 'a CAPTCHA is present', 'A puzzle or text-recognition test fails 3.3.8 unless an alternative that needs no cognitive test exists (for example an email link). Confirm one does.');

  byPage.push({ page, findings: F });
  // Collected for the cross-page and EAA passes
  const navLinks = (() => { const n = markup.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0] ?? ''; return [...n.matchAll(/<a\b([^>]*)>/gi)].map((m) => (attrsOf(m[1]).href ?? '').split('#')[0]).filter((h) => h && !/^(?:mailto|tel):/i.test(h)); })();
  const anchors = [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: attrsOf(m[1]).href ?? '', text: plain(m[2]), label: attrsOf(m[1])['aria-label'] ?? '' }));
  info.push({ page, file, markup, html, navLinks, anchors, title: plain(markup.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''), text: plain(markup) });
}

// 3.2.3 Consistent navigation: shared links keep their relative order. 3.2.6 Consistent help.
const norm = (h) => h.replace(/^\.?\//, '').replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
const withNav = info.filter((p) => p.navLinks.length > 1);
if (withNav.length > 1) {
  const refOrder = withNav[0].navLinks.map(norm);
  for (const p of withNav.slice(1)) {
    const mine = p.navLinks.map(norm); const common = refOrder.filter((h) => mine.includes(h));
    if (common.join('|') !== mine.filter((h) => refOrder.includes(h)).join('|')) addTo(byPage.find((b) => b.page === p.page).findings)('warn', '3.2.3', 'nav-order', `navigation links appear in a different order than on ${withNav[0].page}`, 'Keep repeated navigation in the same relative order on every page.');
  }
}
const HELP = /(?:^|[\/\s-])(?:contact|help|support|faq)(?:$|[\/\s.#-])/i;
const hasHelp = (p) => p.anchors.some((a) => HELP.test(a.href) || HELP.test(a.text) || HELP.test(a.label));
if (info.length > 1 && info.some(hasHelp) && !info.every(hasHelp)) for (const p of info.filter((x) => !hasHelp(x))) addTo(byPage.find((b) => b.page === p.page).findings)('warn', '3.2.6', 'help-consistent', 'no contact/help link here, but other pages have one', 'Put the help or contact link in the same place on every page.');

// EAA
const ECOM = /add to (?:cart|basket|bag)|\bcheckout\b|\bshopping[- ]cart\b|\bbasket\b|\bbuy now\b|data-product|"@type"\s*:\s*"Product"|snipcart|shopify|woocommerce|stripe\.com\/v3|paypal\.com\/sdk/i;
const ecommerce = info.some((p) => ECOM.test(p.html) || /(?:^|\/)(?:cart|checkout|basket|shop|product)[\w-]*\.html$/i.test(p.page));
const isStmt = (p) => /accessib/i.test(p.page) || /accessib/i.test(p.title) || /<h1\b[^>]*>[^<]*accessib/i.test(p.markup);
const stmtPages = info.filter(isStmt);
const linksStmt = (p) => p.anchors.some((a) => /accessib/i.test(a.href) || /accessib/i.test(a.text) || /accessib/i.test(a.label));
const eaaSev = ecommerce ? 'error' : 'warn';
const E = [];
const eadd = addTo(E);
const EAA = 'EAA (Directive (EU) 2019/882) service information';
if (!stmtPages.length) eadd(eaaSev, EAA, 'eaa-statement-missing', `no accessibility statement page found${ecommerce ? ' (e-commerce signals found: cart, checkout or product)' : ''}`, 'Add accessibility.html: standard aimed at, known gaps, a contact route, a feedback route, the date, and how to complain. Link it from every page footer.');
else {
  const s = stmtPages[0]; const t = s.text;
  if (!/mailto:|tel:/i.test(s.html) && !/<form\b/i.test(s.markup) && !/contact/i.test(s.anchors.map((a) => a.href + a.text).join(' '))) eadd('error', EAA, 'eaa-contact', `${s.page}: no contact route (email link, phone link, form or contact page link)`, 'Add an email address, phone number or contact form that people can use to ask for an accessible format or report a barrier.');
  if (!/feedback|report (?:a |an )?(?:problem|barrier|issue)|let us know|tell us|barrier|difficult/i.test(t)) eadd('error', EAA, 'eaa-feedback', `${s.page}: no feedback mechanism described`, 'Say how to report an accessibility problem and how fast you reply.');
  if (!/WCAG|EN 301 549|conform|complian/i.test(t)) eadd('warn', EAA, 'eaa-standard', `${s.page}: no standard or conformance status named`, 'Name the standard aimed at (for example WCAG 2.2 AA / EN 301 549) and the status: fully, partly or not conforming. If unknown, say UNKNOWN; do not guess.');
  if (/\bfully (?:compliant|conform)|100% (?:accessible|compliant)|completely accessible/i.test(t)) eadd('warn', EAA, 'eaa-overclaim', `${s.page}: claims full compliance; static checks cannot prove that`, 'Only claim what an audit with real assistive technology supports; otherwise say "aims to meet".');
  if (!/(?:20\d\d|last (?:reviewed|updated)|updated|reviewed)/i.test(t)) eadd('warn', EAA, 'eaa-date', `${s.page}: no review date`, 'Add "Last reviewed: <date>".');
  if (!/complain|enforcement|ombudsman|supervisory|market surveillance|authority|regulator/i.test(t)) eadd('warn', EAA, 'eaa-enforcement', `${s.page}: no route to complain to the national enforcement body`, 'Name the enforcement authority for your country and how to contact it (look it up; this tool does not know which one applies).');
  const missing = info.filter((p) => !isStmt(p) && !linksStmt(p));
  if (missing.length) eadd(eaaSev === 'error' && missing.some((p) => /checkout|cart|basket/i.test(p.page)) ? 'error' : 'warn', EAA, 'eaa-statement-link', `accessibility statement is not linked from: ${missing.map((p) => p.page).join(', ')}`, 'Add the link to the footer of every page, including checkout.');
}
site$.push(...E);
unverified.push({ page: '(site)', msg: 'whether the European Accessibility Act applies to this business', reason: 'depends on the service type, staff count and turnover (for example the microenterprise exemption for services); this tool cannot know. Not legal advice.' });
unverified.push({ page: '(site)', msg: 'WCAG 2.2 AA conformance', reason: 'static checks read markup and CSS only. Run the browser pass (qa-browser) and a real audit with a screen reader and keyboard; axe results are separate and not claimed here' });
if (!pagesPaths.length) unverified.push({ page: '(site)', msg: 'no .html files found', reason: 'nothing to check' });
if (site$.length) byPage.push({ page: '(site: EAA)', findings: site$ });

const cnt = (fs, s) => fs.filter((f) => f.sev === s).length;
const pages = byPage.map((r) => ({ page: r.page, errors: cnt(r.findings, 'error'), warnings: cnt(r.findings, 'warn'), findings: r.findings }));
const Er = pages.reduce((n, p) => n + p.errors, 0), W = pages.reduce((n, p) => n + p.warnings, 0), U = unverified.length;
const summary = `a11y-law: ${Er} error(s), ${W} warning(s), ${U} unverified`;
if (json) console.log(JSON.stringify({ site: rel(site) || '.', ecommerce, statementPage: stmtPages[0]?.page ?? null, pages, unverified, summary: { errors: Er, warnings: W, unverified: U } }, null, 2));
else {
  console.log(`WCAG 2.2 AA + EAA static check for ${site}${ecommerce ? '  (e-commerce signals found)' : ''}\n`);
  for (const p of pages) {
    console.log(`${p.page}: ${p.errors} error(s), ${p.warnings} warning(s)`);
    for (const f of [...p.findings].sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'error' ? -1 : 1))) console.log(`  ${f.sev === 'error' ? 'ERROR' : 'warn '} [${f.id}] ${/^\d/.test(f.sc) ? 'WCAG ' + f.sc : f.sc}: ${f.msg}\n        fix: ${f.fix}`);
    if (!p.findings.length) console.log('  no findings');
  }
  console.log('\nUNVERIFIED (static checks cannot decide these)'); for (const u of unverified) console.log(`  ${u.page}: ${u.msg}: ${u.reason}`);
  console.log('\nLimit: static checks cannot prove conformance. A pass here is not a WCAG or EAA compliance claim.');
  console.log(`\n${summary}`);
}
process.exit(Er > 0 ? 1 : 0);
