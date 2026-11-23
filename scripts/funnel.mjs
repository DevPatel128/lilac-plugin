#!/usr/bin/env node
// funnel.mjs: define, audit and rehearse the path from first visit to a done goal (a booking, a purchase, a demo request, an enquiry, a sign-up).
// Usage: node scripts/funnel.mjs new <dir>                      copy templates/FUNNEL.template.md to <dir>/FUNNEL.md and a skeleton <dir>/.lilac/funnel.json (never overwrites)
//        node scripts/funnel.mjs check <dir> [--site dir] [--json] [--no-save]   static audit of the BUILT site against funnel.json
//        node scripts/funnel.mjs tasks <dir>                    write "funnel:" tasks into <dir>/.lilac/personas.json so persona-test.mjs can walk the main path
//        node scripts/funnel.mjs report <dir>                   write <dir>/FUNNEL-REPORT.md from funnel.json, the last check and the last persona run
// What it can show: structure (is there a path, is it short, is the next step clear, are the forms sane, is there a confirmation, is proof honest).
// What it cannot show: sales. It never prints or estimates a conversion rate. Persona results are simulated visitors, not customers.
// check prints findings grouped by stage (AWARE, INTERESTED, CONSIDERING, READY, DONE, RETURN), each [error|warn|unverified] with a fix hint and the
// evidence record id (UX-0xyz, operations/plugin/knowledge/ux/records) when one applies. Last line: `funnel: E error(s), W warning(s), U unverified`.
// Exit 1 only on errors (no path within the click budget, no confirmation, dead end, invented social proof not marked SAMPLE or sourced, missing goal
// control, missing entry page). Exit 2 on bad usage. check saves its result to <dir>/.lilac/funnel-check.json (skip with --no-save) for `report`.
// Offline and dependency-free: no network, no child processes. It reads the site and writes only into <dir> (FUNNEL.md, FUNNEL-REPORT.md, .lilac/).
// Limits: a regex tokenizer, not a browser. Selectors: tag, #id, .class, [attr], [attr=value], and descendant chains of those. Tap size is read from
// CSS rules outside @media blocks (rem and em count as 16 px); anything it cannot work out is UNVERIFIED (qa-browser.mjs measures it for real).
// shortcut: the "first screen" is the first 6 links or buttons in the header (outside nav) and main, and "3 screens of text" is 900 words; upgrade
// when a real layout measurement (qa-browser.mjs) is wired in.
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { scoped } from '../lib/safe-fs.mjs';
import { join, resolve, dirname, relative, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const TPL = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'FUNNEL.template.md');
const SELF = fileURLToPath(import.meta.url);
const GOALS = ['buy', 'book', 'demo', 'enquire', 'signup'];
const STAGES = ['aware', 'interested', 'considering', 'ready', 'done', 'return'];
const SAMPLE_PERSONAS = ['name@example.test'];
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const cmd = args[0];
const json = args.includes('--json');
const siteArg = flag('--site');
const dirArg = args.slice(1).find((a) => !a.startsWith('--') && a !== siteArg);
const usage = () => { console.error('usage: funnel.mjs new|check|tasks|report <dir> [--site dir] [--json] [--no-save]'); process.exit(2); };
if (!['new', 'check', 'tasks', 'report'].includes(cmd) || !dirArg) usage();
if (cmd === 'new') { mkdirSync(resolve(dirArg), { recursive: true }); } // the project folder itself is the user's choice
if (!existsSync(dirArg) || !statSync(dirArg).isDirectory()) { console.error(`funnel: not a folder: ${dirArg}`); process.exit(2); }
const root = resolve(dirArg);
const LILAC = join(root, '.lilac');
const W = scoped(root); // every write goes through safe-fs: a symlink planted in the project is refused (security review M-2)
const readJson = (f, d = null) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const str = (v) => (typeof v === 'string' ? v.trim() : '');

// ---------------------------------------------------------------- new
if (cmd === 'new') {
  W.mkdir('.lilac');
  const skeleton = { goal: '', customer: '', entryPages: ['index.html'], maxClicks: 3, goalPage: '', goalControl: { selector: '', text: '' },
    steps: [{ stage: 'interested', page: 'index.html', control: { selector: '', text: '' } }], confirmation: { page: '', text: '' },
    successMetric: { name: '', target: 'OWNER FILLS THIS FROM REAL DATA' } };
  const put = (name, f, write) => { if (existsSync(f)) console.log(`funnel: kept ${name} (already exists)`); else { write(f); console.log(`funnel: wrote ${name}`); } };
  put('FUNNEL.md', join(root, 'FUNNEL.md'), (f) => W.copy(TPL, f, { overwrite: false }));
  put('.lilac/funnel.json', join(LILAC, 'funnel.json'), (f) => W.write(f, JSON.stringify(skeleton, null, 2) + '\n', { overwrite: false }));
  process.exit(0);
}

// ---------------------------------------------------------------- site loading and a small HTML tree
const walk = (d, out = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name.startsWith('.')) continue; const p = join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; };
const hasHtml = (d) => existsSync(d) && statSync(d).isDirectory() && walk(d).some((f) => f.endsWith('.html'));
let site = siteArg ? resolve(root, siteArg) : ['site', 'public', 'dist', 'out', 'build'].map((n) => join(root, n)).find(hasHtml);
if (!site && hasHtml(root)) site = root;
if (!site || !existsSync(site)) { console.error('funnel: no site folder found (site, public, dist, out, build, or index.html in the folder). Use --site <dir>.'); process.exit(2); }

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const attrsOf = (s) => { const o = {}; for (const m of s.matchAll(/([^\s=\/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) o[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''; return o; };
const norm = (s) => s.replace(/\s+/g, ' ').trim();
function parse(raw) {
  const scripts = [], styles = [];
  const src = raw.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, a, b) => { scripts.push({ a: attrsOf(a), body: b }); return `<script${a}></script>`; })
    .replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, a, b) => { styles.push(b); return '<style></style>'; });
  const rootN = { n: '#root', a: {}, kids: [], up: null }; let cur = rootN; const els = [];
  for (const m of src.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+|<)/g)) {
    if (m[4] !== undefined) { cur.kids.push({ t: m[4], up: cur }); continue; }
    const n = m[2].toLowerCase();
    if (m[1]) { let p = cur; while (p && p.n !== n) p = p.up; if (p && p !== rootN) cur = p.up; continue; }
    if ((n === 'p' || n === 'li') && cur.n === n) cur = cur.up;
    const node = { n, a: attrsOf(m[3]), kids: [], up: cur }; cur.kids.push(node); els.push(node);
    if (!VOID.has(n) && !/\/\s*$/.test(m[3])) cur = node;
  }
  return { root: rootN, els, scripts, styles, raw };
}
const own = (el) => el.kids.filter((k) => k.t !== undefined).map((k) => k.t).join(' ');
const textOf = (el) => norm(el.kids.map((k) => (k.t !== undefined ? k.t : ['script', 'style', 'noscript', 'template'].includes(k.n) ? '' : textOf(k))).join(' '));
const cls = (el) => (el.a.class ?? '').split(/\s+/).filter(Boolean);
const isHiddenEl = (el) => 'hidden' in el.a || el.a['aria-hidden'] === 'true' || /display\s*:\s*none/i.test(el.a.style ?? '');
const hiddenUp = (el) => { for (let p = el; p && p.n !== '#root'; p = p.up) if (isHiddenEl(p)) return true; return false; };
const inside = (el, pred) => { for (let p = el.up; p && p.n !== '#root'; p = p.up) if (pred(p)) return p; return null; };
const label = (el) => norm((el.n === 'input' ? '' : textOf(el)) || el.a.value || el.a['aria-label'] || el.a.title || '').toLowerCase();
const words = (s) => (s.match(/\S+/g) ?? []).length;

const compile = (s) => s.trim().split(/\s+/).map((c) => { const m = c.match(/^([\w*-]*)((?:[#.][\w-]+|\[[^\]]+\])*)$/); return m ? { tag: m[1].toLowerCase(), parts: [...m[2].matchAll(/([#.])([\w-]+)|\[([\w-]+)(?:([~^$*|]?=)["']?([^\]"']*)["']?)?\]/g)] } : null; });
const matchC = (el, c) => {
  if (c.tag && c.tag !== '*' && el.n !== c.tag) return false;
  for (const p of c.parts) {
    if (p[1] === '#') { if (el.a.id !== p[2]) return false; }
    else if (p[1] === '.') { if (!cls(el).includes(p[2])) return false; }
    else { const v = el.a[p[3].toLowerCase()]; if (v === undefined || (p[4] === '=' && v !== p[5]) || (p[4] === '*=' && !v.includes(p[5]))) return false; }
  }
  return true;
};
const select = (page, s) => {
  const cs = compile(s); if (!cs.length || cs.includes(null)) return [];
  return page.els.filter((el) => { if (!matchC(el, cs[cs.length - 1])) return false; let a = el.up, i = cs.length - 2; while (i >= 0 && a) { if (matchC(a, cs[i])) i--; a = a.up; } return i < 0; });
};

const pages = new Map();
for (const f of walk(site).filter((p) => p.endsWith('.html')).sort()) pages.set(relative(site, f).split(sep).join('/'), parse(readFileSync(f, 'utf8')));
if (!pages.size) { console.error('funnel: no .html files in ' + site); process.exit(2); }
const is404 = (p) => /(^|\/)404(\.html|\/index\.html)$/.test(p);
const bodyOf = (pg) => pg.els.find((e) => e.n === 'body') ?? pg.root;
const mainOf = (pg) => pg.els.find((e) => e.n === 'main') ?? bodyOf(pg);
const under = (el, anc) => { for (let p = el; p; p = p.up) if (p === anc) return true; return false; };
// "content" scope: <main>, or the body without header, nav, footer and aside
const inContent = (pg, el) => { const m = pg.els.find((e) => e.n === 'main'); return m ? under(el, m) : under(el, bodyOf(pg)) && !inside(el, (p) => ['header', 'nav', 'footer', 'aside'].includes(p.n)); };
const isInteractive = (e) => (e.n === 'a' && e.a.href !== undefined) || e.n === 'button' || (e.n === 'input' && /^(submit|button)$/i.test(e.a.type ?? ''));

// ---------------------------------------------------------------- links and the click graph
function resolveHref(from, href) {
  href = (href ?? '').trim();
  if (!href || href.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return null;
  let p = href.split('#')[0].split('?')[0]; if (!p) return null;
  p = p.startsWith('/') ? posix.normalize(p.slice(1)) : posix.normalize(posix.join(posix.dirname(from), decodeURI(p)));
  if (p.endsWith('/') || p === '.') p = posix.join(p === '.' ? '' : p, 'index.html');
  for (const c of [p, p + '.html', p + '/index.html']) if (pages.has(c)) return c;
  return null;
}
const edges = new Map(); // page -> [{to, el}]
for (const [path, pg] of pages) {
  const out = [];
  for (const e of pg.els) {
    if (e.n === 'a' && e.a.href !== undefined) { const to = resolveHref(path, e.a.href); if (to) out.push({ to, el: e }); }
    if (e.n === 'form' && e.a.action) { const to = resolveHref(path, e.a.action); if (to) out.push({ to, el: e }); }
  }
  edges.set(path, out);
}
function bfs(start) {
  const dist = new Map([[start, 0]]), prev = new Map(), q = [start];
  while (q.length) { const u = q.shift(); for (const { to } of edges.get(u)) if (!dist.has(to)) { dist.set(to, dist.get(u) + 1); prev.set(to, u); q.push(to); } }
  return { dist, prev };
}
const pathTo = (prev, a, b) => { const out = [b]; for (let c = b; c !== a; c = prev.get(c)) out.unshift(prev.get(c)); return out; };

// ---------------------------------------------------------------- funnel.json and defaults
const fcfg = readJson(join(LILAC, 'funnel.json'));
const hasCfg = !!fcfg && typeof fcfg === 'object';
const F = []; // findings
const add = (stage, sev, id, msg, fix, record = '', where = '') => { if (!F.some((f) => f.id === id && f.msg === msg)) F.push({ stage, sev, id, msg, fix, record, page: where }); };
const formsOf = (pg) => pg.els.filter((e) => e.n === 'form');
const fieldsOf = (form) => { const out = []; const rec = (n) => { for (const k of n.kids) if (k.n) { if (k.n === 'input' ? !/^(hidden|submit|button|reset|image)$/i.test(k.a.type ?? '') : ['select', 'textarea'].includes(k.n)) out.push(k); rec(k); } }; rec(form); return out; };
const isSearch = (form) => form.a.role === 'search' || inside(form, (p) => p.a.role === 'search') || (fieldsOf(form).length === 1 && /^search$/i.test(fieldsOf(form)[0].a.type ?? ''));
const dataForms = (pg) => formsOf(pg).filter((f) => !isSearch(f) && fieldsOf(f).length);

const cfg = {
  goal: GOALS.includes(str(fcfg?.goal)) ? str(fcfg.goal) : '', entry: [], maxClicks: Number.isFinite(+fcfg?.maxClicks) && +fcfg.maxClicks > 0 ? Math.floor(+fcfg.maxClicks) : 3,
  goalPage: str(fcfg?.goalPage), goalSel: str(fcfg?.goalControl?.selector), goalText: str(fcfg?.goalControl?.text), steps: Array.isArray(fcfg?.steps) ? fcfg.steps : [],
  confPage: str(fcfg?.confirmation?.page), confText: str(fcfg?.confirmation?.text) };
cfg.entry = (Array.isArray(fcfg?.entryPages) ? fcfg.entryPages.map(str).filter(Boolean) : []);
if (!hasCfg) add('aware', 'warn', 'no-funnel-json', 'no .lilac/funnel.json: using defaults (entry index.html, budget 3 clicks, goal page guessed from the forms)', 'Run funnel.mjs new, then write the funnel (skill: funnel) so the check uses your real goal.');
else if (str(fcfg?.goal) && !cfg.goal) add('aware', 'warn', 'funnel-json-goal', `funnel.json goal "${fcfg.goal}" is not one of ${GOALS.join(', ')}`, 'Pick one business goal from the list.');
if (!cfg.entry.length) cfg.entry = [pages.has('index.html') ? 'index.html' : [...pages.keys()].find((p) => !is404(p))];
const missingEntry = cfg.entry.filter((e) => !pages.has(e));
for (const e of missingEntry) add('aware', 'error', 'entry-missing', `entry page ${e} is not in the built site`, 'Fix entryPages in funnel.json or build the page.');
const entries = cfg.entry.filter((e) => pages.has(e));
const GOAL_HINT = /(book|contact|demo|sign-?up|register|enquir|inquir|order|checkout|quote|reserv|apply|subscribe)/i;
if (!cfg.goalPage) {
  const withForm = [...pages.keys()].filter((p) => !is404(p) && dataForms(pages.get(p)).length);
  cfg.goalPage = withForm.find((p) => GOAL_HINT.test(p)) ?? withForm[0] ?? '';
}
if (!cfg.goal) { const g = cfg.goalPage; cfg.goal = /book|reserv/i.test(g) ? 'book' : /demo/i.test(g) ? 'demo' : /sign|regist|subscribe/i.test(g) ? 'signup' : /order|checkout|cart|buy/i.test(g) ? 'buy' : 'enquire'; }
const goalPg = pages.get(cfg.goalPage);
const leadGoal = cfg.goal !== 'buy';

// ---------------------------------------------------------------- the checks
const VAGUE = /^(submit|click here|click|here|learn more|read more|more|go|ok|enter)$/i;
const PRIMARY = /^(btn|button|cta|primary|call-to-action)(-|$)/, SECONDARY = /(^|-)(alt|secondary|ghost|outline|tertiary|link|text|light)$/;
const isGoalLink = (pgPath, e) => e.n === 'a' && cfg.goalPage && resolveHref(pgPath, e.a.href) === cfg.goalPage;
const ctaLike = (pgPath, e) => isInteractive(e) && ('data-cta' in e.a || cls(e).some((c) => /^(btn|button|cta|primary)(-|$)/.test(c)) || isGoalLink(pgPath, e));
const primaryEl = (e) => isInteractive(e) && ('data-cta' in e.a || (cls(e).some((c) => PRIMARY.test(c)) && !cls(e).some((c) => SECONDARY.test(c))));
const labelOfCta = (e) => norm(label(e));

// goal control
let goalForm = null;
if (!goalPg) add('ready', 'error', 'goal-control', 'no goal page: funnel.json has no goalPage and no page with a form was found', 'Set goalPage and goalControl in funnel.json, and build the page with the form or button.');
else {
  const spec = cfg.goalSel || cfg.goalText ? { selector: cfg.goalSel, text: cfg.goalText } : { selector: 'form', text: '' };
  let c = spec.selector ? select(goalPg, spec.selector) : goalPg.els.filter(isInteractive);
  if (spec.text) c = c.filter((e) => textOf(e).toLowerCase().includes(spec.text.toLowerCase()) || label(e).includes(spec.text.toLowerCase()));
  if (!c.length) add('ready', 'error', 'goal-control', `goal control (${[spec.selector, spec.text && `"${spec.text}"`].filter(Boolean).join(' ')}) not found on ${cfg.goalPage}`, 'Build the form or button the funnel ends in, or correct goalControl in funnel.json.');
  goalForm = c.find((e) => e.n === 'form') ?? (c[0] ? inside(c[0], (p) => p.n === 'form') : null) ?? dataForms(goalPg)[0] ?? null;
}

// click path
let mainPath = null;
for (const e of entries) {
  if (!goalPg) break;
  const { dist, prev } = bfs(e);
  if (dist.has(cfg.goalPage) && (!mainPath || dist.get(cfg.goalPage) < mainPath.clicks)) mainPath = { clicks: dist.get(cfg.goalPage), pages: pathTo(prev, e, cfg.goalPage) };
}
if (goalPg && entries.length) {
  if (!mainPath) add('ready', 'error', 'path', `no click path from ${entries.join(' or ')} to ${cfg.goalPage}`, 'Link the goal page from the entry page with a clear button.', 'UX-0078');
  else if (mainPath.clicks > cfg.maxClicks) add('ready', 'error', 'path', `shortest path to the goal is ${mainPath.clicks} clicks (${mainPath.pages.join(' -> ')}), budget is ${cfg.maxClicks}`, 'Link the goal page straight from the entry page, or raise the budget in funnel.json only if you can say why.', 'UX-0078');
}
// steps named in funnel.json
for (const st of cfg.steps) {
  const pg = pages.get(str(st?.page)); const sel = str(st?.control?.selector), tx = str(st?.control?.text);
  if (!sel && !tx) continue;
  let found = pg ? (sel ? select(pg, sel) : pg.els.filter(isInteractive)) : [];
  if (tx) found = found.filter((e) => label(e).includes(tx.toLowerCase()) || textOf(e).toLowerCase().includes(tx.toLowerCase()));
  if (!found.length) add(STAGES.includes(st.stage) ? st.stage : 'interested', 'warn', 'step-control', `step control (${[sel, tx && `"${tx}"`].filter(Boolean).join(' ')}) not found on ${str(st.page) || '(no page)'}`, 'Make funnel.json match the built page, or add the control.', '');
}

// aware: entry pages
const entrySet = entries.length ? entries : [];
const ctaPages = [...new Set([...entrySet, ...(cfg.goalPage ? [cfg.goalPage] : [])])];
for (const e of entrySet) {
  const pg = pages.get(e);
  const oneScreen = e === cfg.goalPage && goalForm ? true : (() => {
    const first = pg.els.filter((x) => isInteractive(x) && ((inContent(pg, x)) || (inside(x, (p) => p.n === 'header') && !inside(x, (p) => p.n === 'nav')))).slice(0, 6);
    return first.some((x) => ctaLike(e, x));
  })();
  if (!oneScreen) add('aware', 'warn', 'cta-above-fold', `${e}: no clear call to action in the first screen (first 6 links and buttons)`, `Put one button for "${cfg.goal}" at the top of the page, or mark it data-cta.`, 'UX-0028', e);
  // long page: repeat the CTA
  const main = mainOf(pg); let idx = 0, total = 0, last = -1;
  (function rec(n) { for (const k of n.kids) { if (k.t !== undefined) { idx += words(k.t); } else if (!['script', 'style'].includes(k.n)) { if (ctaLike(e, k)) last = idx; rec(k); } } })(main);
  total = idx;
  if (total > 900 && last >= 0 && total - last > 300) add('interested', 'warn', 'cta-repeat', `${e}: ${total} words of text and the last call to action is followed by ${total - last} more words`, 'Repeat the main button after long content so the next step is never far away.', 'UX-0028', e);
}
for (const p of ctaPages) {
  const pg = pages.get(p);
  const cands = pg.els.filter((x) => isInteractive(x) && !inside(x, (a) => a.n === 'nav') && ('data-cta' in x.a || cls(x).some((c) => /^(btn|button|cta|primary)(-|$)/.test(c)) || x.n === 'button' || /^submit$/i.test(x.a.type ?? '')));
  if (cands.length && cands.every((x) => VAGUE.test(labelOfCta(x)))) add('aware', 'warn', 'vague-cta', `${p}: every call to action says "${labelOfCta(cands[0])}"`, 'Say the action: "Book a table", "Request a demo", "Send booking request".', 'UX-0029', p);
}
for (const [p, pg] of pages) { // one primary per view
  const groups = new Map();
  for (const x of pg.els.filter(primaryEl)) { const g = inside(x, (a) => ['section', 'header', 'aside', 'form', 'footer'].includes(a.n)) ?? mainOf(pg); groups.set(g, [...(groups.get(g) ?? []), x]); }
  for (const list of groups.values()) if (list.length > 1) add('aware', 'warn', 'one-primary', `${p}: ${list.length} primary buttons in one section (${list.map(labelOfCta).slice(0, 3).join(', ')})`, 'Keep one primary button per section; make the others secondary (link or outlined).', 'UX-0028', p);
}

// tap size from CSS
const cssText = (pg, path) => [...pg.styles, ...pg.els.filter((e) => e.n === 'link' && /stylesheet/i.test(e.a.rel ?? '') && e.a.href && !/^(?:[a-z]+:)?\/\//i.test(e.a.href)).map((e) => { const f = join(site, resolveFile(path, e.a.href)); try { return readFileSync(f, 'utf8'); } catch { return ''; } })].join('\n');
function resolveFile(from, href) { const p = href.split('#')[0].split('?')[0]; return p.startsWith('/') ? p.slice(1) : posix.join(posix.dirname(from), p); }
const stripMedia = (css) => { css = css.replace(/\/\*[\s\S]*?\*\//g, ''); let out = '', i = 0; while (i < css.length) { if (css[i] === '@') { const j = css.indexOf('{', i); const semi = css.indexOf(';', i); if (j < 0 || (semi >= 0 && semi < j)) { i = semi < 0 ? css.length : semi + 1; continue; } let d = 1, k = j + 1; while (k < css.length && d) { d += css[k] === '{' ? 1 : css[k] === '}' ? -1 : 0; k++; } i = k; } else { out += css[i++]; } } return out; };
const px = (v) => { const m = (v ?? '').trim().match(/^(-?[\d.]+)(px|rem|em)?$/); return m ? (m[2] === 'px' || !m[2] ? +m[1] : +m[1] * 16) : null; };
function sizeOf(el, rules) {
  const d = {};
  for (const r of rules) for (const sel of r.sel.split(',')) {
    const last = sel.trim().split(/[\s>+~]+/).pop(); if (!last || /:/.test(last)) continue;
    if (/[\s>+~]/.test(sel.trim()) && !/\./.test(last)) continue;
    const c = compile(last)[0]; if (c && matchC(el, c)) Object.assign(d, r.decl);
  }
  const h = px(d['min-height']) ?? px(d.height); if (h !== null) return h;
  let top = px(d['padding-top']), bot = px(d['padding-bottom']);
  if (d.padding) { const v = d.padding.trim().split(/\s+/).map(px); if (v.every((x) => x !== null)) { top = v[0]; bot = v.length >= 3 ? v[2] : v[0]; } }
  if (top === null || bot === null) return null;
  const fs = px(d['font-size']) ?? 16; const lh = /^[\d.]+$/.test(d['line-height'] ?? '') ? +d['line-height'] : 1.2;
  return top + bot + fs * lh;
}
{
  const sizes = []; let unknown = 0; const seen = new Set();
  for (const p of ctaPages) {
    const pg = pages.get(p); const rules = [];
    for (const m of stripMedia(cssText(pg, p)).matchAll(/([^{}]+)\{([^{}]*)\}/g)) { const decl = {}; for (const x of m[2].split(';')) { const i = x.indexOf(':'); if (i > 0) decl[x.slice(0, i).trim().toLowerCase()] = x.slice(i + 1).trim(); } rules.push({ sel: m[1].trim(), decl }); }
    for (const el of pg.els.filter(primaryEl)) { const key = p + '|' + cls(el).join('.') + '|' + el.n; if (seen.has(key)) continue; seen.add(key); const s = sizeOf(el, rules); s === null ? unknown++ : sizes.push([p, el, s]); }
  }
  const small = sizes.filter(([, , s]) => s < 44);
  if (small.length) add('aware', 'warn', 'tap-size', `primary button looks ${Math.round(small[0][2])} px tall in CSS (want 44 px or more) on ${[...new Set(small.map((x) => x[0]))].join(', ')}`, 'Give the main button min-height: 44px (or about .7rem padding at 16 px text).', 'UX-0044');
  else if (unknown) add('aware', 'unverified', 'tap-size', 'primary button height could not be worked out from the CSS (variables, shorthands or no rule)', 'Run qa-browser.mjs, which measures the real tap size in a browser.', 'UX-0044');
}

// analytics
{
  const hits = [];
  for (const [p, pg] of pages) for (const s of pg.scripts) {
    const ext = /^(?:https?:)?\/\//i.test(s.a.src ?? '');
    if ((ext && /analytics|googletagmanager|gtag|segment|hotjar|mixpanel|clarity\.ms|fbevents|connect\.facebook|plausible|matomo|posthog|fullstory|heap|amplitude|doubleclick|adsbygoogle|pixel|tiktok/i.test(s.a.src)) || /\b(gtag|fbq|_paq|_hsq)\s*\(|\bdataLayer\b|mixpanel\.|analytics\.(track|load)\b/.test(s.body)) hits.push(p);
  }
  if (hits.length) add('aware', 'warn', 'analytics', `third-party analytics or tracking script on ${[...new Set(hits)].slice(0, 5).join(', ')}`, 'Measurement is off by default. Count visits with a privacy-friendly method you host, and tell visitors; remove the third-party script until the owner decides.');
}

// dead ends
for (const [p, pg] of pages) {
  if (is404(p)) continue;
  const next = pg.els.some((x) => inContent(pg, x) && ((x.n === 'a' && ((resolveHref(p, x.a.href) && resolveHref(p, x.a.href) !== p) || /^(mailto|tel):/i.test(x.a.href ?? ''))) || (x.n === 'form' && !isSearch(x))));
  if (!next) add('interested', 'error', 'dead-end', `${p}: no next step (no link to another page, contact route or form in the page content)`, 'End the page with one clear next step: a button to the goal page or a contact link.', 'UX-0028', p);
}

// trust honesty
{
  const SAMPLE = /\bSAMPLE\b/, SOURCED = /\b(source|sourced)\s*:|\(source\b|data-source/i;
  const marked = (el) => { let p = el; for (let i = 0; i < 3 && p && !['main', 'body', '#root'].includes(p.n); i++, p = p.up) { if ('data-sample' in p.a || 'data-source' in p.a || 'cite' in p.a || SAMPLE.test(p.a.class ?? '') || SAMPLE.test(textOf(p)) || SOURCED.test(textOf(p))) return true; } return false; };
  const NOUN = '(?:customers|clients|users|teams|members|businesses|companies|people|downloads|orders|stores|bakers|guests|subscribers|reviews|owners|families)';
  const RULES = [
    ['trust-rating', 'star rating', /[★⭐]{2,}|[★☆]{3,}|\b[1-5](?:\.\d)?\s*(?:\/\s*5|out of 5)\b|\b[1-5](?:\.\d)?[- ]stars?\b|\bfive[- ]stars?\b|\brated\s+[1-5](?:\.\d)?\b/i, /(^|[\s_-])(star-?rating|stars?|rating|ratings)($|[\s_-])/i],
    ['trust-review', 'review or testimonial block', null, /(^|[\s_-])(testimonials?|customer-?reviews?|reviews)($|[\s_-])/i, /\b(testimonials?|what (?:our |the )?(?:customers|clients|people|users|guests|members) (?:are )?(?:say|saying)|customer (?:reviews|stories)|reviews|hear from our)\b/i],
    ['trust-count', 'customer or user count', new RegExp(`\\b(?:(?:over|more than|trusted by|joined by|join|used by|serving)\\s+\\d[\\d,]*(?:\\.\\d+)?[km]?\\+?|\\d[\\d,]*(?:\\.\\d+)?(?:[km]\\+?|\\+|(?<=\\d{3}|,\\d{3})))\\s+(?:[a-z-]+\\s+){0,2}${NOUN}\\b`, 'i'), null],
    ['trust-logos', 'logo wall or press mentions', /\b(?:trusted by|as seen (?:in|on)|featured (?:in|on)|our (?:clients|partners|press))\b(?!\s*\d)/i, /(^|[\s_-])(logo-?(?:wall|cloud|strip|bar|grid|row)|clients?-?logos?|trusted-?by|as-?seen)($|[\s_-])/i],
    ['trust-award', 'award claim', /\b(?:award[- ]winning|winner of|voted (?:the )?best|best[- ][^.]{0,30} (?:in|of) (?:the )?(?:town|city|year|country|world)|#1|number one|\d{4} (?:winner|award)|won (?:the |an? |\d+ )?[^.]{0,30}awards?)\b/i, null],
  ];
  const NEG = /\b(no|not|never|without|don'?t|nor)\b[^.]{0,20}$/i;
  for (const [p, pg] of pages) {
    const seen = new Set();
    for (const el of pg.els) {
      if (el.n === 'option') continue; // a form choice such as "More than 50 people" is not a claim
      const o = own(el); const attrs = [el.a.class, el.a.id, el.a.itemprop, el.a.itemtype].filter(Boolean).join(' ');
      for (const [id, what, tx, attr, head] of RULES) {
        if (seen.has(id)) continue;
        let hit = '';
        if (tx) { const m = o.match(tx); if (m && !NEG.test(o.slice(0, m.index))) hit = m[0]; }
        if (!hit && attr && attrs && attr.test(attrs.replace(/[\s]+/g, ' '))) hit = `class or id "${attrs.trim().slice(0, 40)}"`;
        if (!hit && head && /^h[1-6]$/.test(el.n)) { const m = o.match(head); if (m) hit = m[0]; }
        if (!hit && id === 'trust-rating' && /aggregaterating/i.test(attrs)) hit = 'aggregateRating';
        if (hit && !marked(el)) { seen.add(id); add('considering', 'error', id, `${p}: ${what} ("${norm(hit).slice(0, 50)}") not marked SAMPLE and with no source`, 'Remove it, or show a real one with its source (name, date, link), or mark the block SAMPLE on a demo site. Never invent proof.', '', p); }
      }
    }
    for (const s of pg.scripts) if (/ld\+json/i.test(s.a.type ?? '') && /aggregateRating|"@type"\s*:\s*"Review"/.test(s.body) && !seen.has('trust-rating') && !/SAMPLE/.test(s.body)) add('considering', 'error', 'trust-rating', `${p}: structured data claims a rating or review that is not marked SAMPLE`, 'Remove it unless it is real and sourced.', '', p);
  }
}

// pricing reach (purchase goals)
if (cfg.goal === 'buy' && entries.length) {
  const PRICE_PAGE = /(pric|cost|plans?|quote|fees?|rates?)/i, PRICE_LINK = /(pric|quote|how much|cost)/i, MONEY = /[$£€]\s?\d/;
  const target = new Set([...pages.keys()].filter((p) => PRICE_PAGE.test(p) || PRICE_PAGE.test(textOf(pages.get(p).els.find((e) => e.n === 'h1') ?? { kids: [] }))));
  for (const [, list] of edges) for (const { to, el } of list) if (el.n === 'a' && PRICE_LINK.test(textOf(el))) target.add(to);
  const ok = entries.some((e) => { if (MONEY.test(textOf(mainOf(pages.get(e))))) return true; const { dist } = bfs(e); return [...target].some((t) => (dist.get(t) ?? 9) <= 2); });
  if (!ok) add('considering', 'warn', 'pricing-reach', 'no price, or clear way to ask for one, within 2 clicks of the entry page', 'Show prices, or a "Request a quote" link that states the reply time you can keep.', 'UX-0080');
}

// goal form
const PERSONAL = /(^|[-_ ])(name|first|last|fname|lname|full|email|e-mail|phone|tel|mobile|address|street|city|postcode|postal|zip|company|org)([-_ ]|$)/i;
const isPersonal = (f) => /^(email|tel)$/i.test(f.a.type ?? '') || PERSONAL.test(f.a.name ?? '') || PERSONAL.test(f.a.id ?? '') || PERSONAL.test(f.a.autocomplete ?? '');
if (goalForm && goalPg) {
  const fields = fieldsOf(goalForm);
  if (leadGoal && fields.length > 5) add('ready', 'warn', 'form-fields', `${cfg.goalPage}: the form has ${fields.length} fields (want 5 or fewer for a ${cfg.goal} goal)`, 'Cut every field you do not need to answer the first request; ask the rest later.', 'UX-0015');
  const labelled = (f) => { const id = f.a.id; return !!(f.a['aria-label'] || f.a['aria-labelledby'] || (id && goalPg.els.some((l) => l.n === 'label' && l.a.for === id && textOf(l))) || inside(f, (p) => p.n === 'label')); };
  const noLabel = fields.filter((f) => !labelled(f));
  if (noLabel.length) add('ready', 'warn', 'form-label', `${cfg.goalPage}: ${noLabel.length} field(s) without a label (${noLabel.map((f) => f.a.name || f.a.id || f.n).slice(0, 4).join(', ')})`, 'Give every field a visible <label for>.', 'UX-0013');
  const noAuto = fields.filter((f) => isPersonal(f) && (!f.a.autocomplete || /^off$/i.test(f.a.autocomplete)));
  if (noAuto.length) add('ready', 'warn', 'form-autocomplete', `${cfg.goalPage}: personal field(s) without autocomplete (${noAuto.map((f) => f.a.name || f.a.id).slice(0, 4).join(', ')})`, 'Add autocomplete="name", "email", "tel" and so on, so browsers fill the form.', 'UX-0025');
  const hook = fields.some((f) => ['required', 'pattern', 'minlength', 'maxlength', 'min', 'max', 'aria-invalid', 'aria-describedby'].some((a) => a in f.a) || /^(email|tel|url|number|date)$/i.test(f.a.type ?? ''));
  const novalOnly = 'novalidate' in goalForm.a && !fields.some((f) => 'aria-describedby' in f.a || 'aria-invalid' in f.a) && !goalPg.els.some((e) => under(e, goalForm) && (e.a.role === 'alert' || e.a['aria-live']));
  if (!hook || novalOnly) add('ready', 'warn', 'form-validation', `${cfg.goalPage}: no inline validation hooks (required, type, pattern, aria-describedby for messages)`, 'Mark required fields, use the right input types and give each field a message area linked with aria-describedby.', 'UX-0017');
}
for (const [p, pg] of pages) { // privacy note on any personal-data form
  const personal = dataForms(pg).filter((f) => fieldsOf(f).some(isPersonal));
  if (personal.length && !pg.els.some((a) => a.n === 'a' && /privacy|data protection|how we (use|keep)/i.test(`${a.a.href ?? ''} ${textOf(a)}`)) && !pg.els.some((e) => under(e, personal[0]) && /privacy/i.test(own(e))))
    add('ready', 'warn', 'privacy-note', `${p}: a form collects personal data and the page links no privacy note`, 'Link a short privacy note next to the form: what you collect, why, how long you keep it.', 'UX-0080', p);
}

// confirmation
{
  const NEXT = /\b(we(?:'| wi)ll|you(?:'| wi)ll|next|repl(?:y|ies)|email you|hear from|call you|contact you|reference|confirm(?:ation)?)\b/i;
  const WHEN = /(\d+\s*(?:minutes?|mins?|hours?|hrs?|days?|business|working)|today|tomorrow|same day|within|by (?:mon|tue|wed|thu|fri|sat|sun))/i;
  let conf = null; // {text, role, via}
  const wanted = cfg.confText.toLowerCase();
  const findIn = (pg) => {
    if (wanted) { const hits = pg.els.filter((e) => textOf(e).toLowerCase().includes(wanted)); const deepest = hits.sort((a, b) => textOf(a).length - textOf(b).length)[0]; return deepest ? { el: deepest, text: textOf(deepest) } : null; }
    return null;
  };
  const cp = cfg.confPage && pages.get(cfg.confPage);
  if (cfg.confPage && !cp) add('done', 'error', 'confirmation', `confirmation page ${cfg.confPage} is not in the built site`, 'Build the thank-you page, or point funnel.json at the real one.', 'UX-0041');
  else {
    const cands = cp ? [[cfg.confPage, cp]] : [...pages].filter(([p]) => /(thank|confirm|success|booked|sent|received|complete)/i.test(p)).concat(goalPg ? [[cfg.goalPage, goalPg]] : []);
    for (const [p, pg] of cands) {
      const hit = findIn(pg);
      if (hit) { conf = { text: hit.text, el: hit.el, page: p }; break; }
      if (wanted) continue;
      if (pg !== goalPg) { conf = { text: textOf(mainOf(pg)), el: mainOf(pg), page: p }; break; }
      const st = pg.els.find((e) => e.a.role === 'status' || e.a['aria-live'] || /(^|[\s_-])(sent|success|confirm\w*|thanks?|thank-you|ok|done)($|[\s_-])/i.test(`${e.a.class ?? ''} ${e.a.id ?? ''}`));
      if (st) { conf = { text: textOf(st), el: st, page: p }; break; }
    }
    if (!conf) add('done', 'error', 'confirmation', wanted ? `confirmation text "${cfg.confText}" not found${cfg.confPage ? ' on ' + cfg.confPage : ''}` : 'no confirmation step: no thank-you page and no status message after the goal form', 'Add a thank-you page or a visible role="status" message that says what happens next and when.', 'UX-0041');
    else {
      if (!(NEXT.test(conf.text) && WHEN.test(conf.text))) add('done', 'warn', 'confirm-next', `${conf.page}: the confirmation does not say what happens next${NEXT.test(conf.text) ? '' : ' (no next step)'}${WHEN.test(conf.text) ? '' : ' or when (no time)'}`, 'Say what the visitor gets and when, e.g. "We will email you within 1 working day."', 'UX-0041');
      if (conf.page === cfg.goalPage && !(conf.el.a.role === 'status' || conf.el.a['aria-live'] || inside(conf.el, (p) => p.a.role === 'status' || p.a['aria-live'])) && conf.el.n !== 'main')
        add('done', 'warn', 'confirm-status', `${conf.page}: the inline confirmation is not announced (no role="status")`, 'Add role="status" so screen readers hear the result without the focus moving.', 'UX-0061');
    }
  }
}

// support reachable from every page, 404
{
  const SUP = /(contact|support|help|get-in-touch|enquir|inquir)/i, SUPT = /\b(contact|support|help|get in touch|email us|call us|enquire|talk to us)\b/i;
  const bad = [...pages].filter(([, pg]) => !pg.els.some((a) => a.n === 'a' && a.a.href !== undefined && (/^(mailto|tel):/i.test(a.a.href) || SUP.test(a.a.href) || SUPT.test(textOf(a))))).map(([p]) => p);
  if (bad.length) add('return', 'warn', 'support-reach', `no contact or help link on ${bad.length} page(s): ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ', ...' : ''}`, 'Put a contact link (or mailto/tel) in the header or footer of every page.', 'UX-0088');
  const nf = [...pages].find(([p]) => is404(p));
  if (!nf) add('return', 'warn', '404-missing', 'no 404 page', 'Add a 404.html that says the page is missing and links to the home page and the goal.', 'UX-0084');
  else if (!nf[1].els.some((a) => a.n === 'a' && inContent(nf[1], a) && (resolveHref(nf[0], a.a.href) || a.a.href === '/'))) add('return', 'warn', '404-no-way-back', `${nf[0]}: no way back in the page content`, 'Link the home page and the goal from the 404 page.', 'UX-0084');
}

// ---------------------------------------------------------------- report
const counts = { error: F.filter((f) => f.sev === 'error').length, warn: F.filter((f) => f.sev === 'warn').length, unverified: F.filter((f) => f.sev === 'unverified').length };
const last = `funnel: ${counts.error} error(s), ${counts.warn} warning(s), ${counts.unverified} unverified`;
const siteRel = site === root ? '.' : relative(root, site) || '.';
const summary = { goal: cfg.goal, source: hasCfg ? '.lilac/funnel.json' : 'defaults', site: siteRel, entry: entries, goalPage: cfg.goalPage, maxClicks: cfg.maxClicks, path: mainPath, counts };
const result = { at: new Date().toISOString(), funnel: summary, findings: F, counts };

if (cmd === 'check') {
  if (!args.includes('--no-save')) { try { scoped(root, { throws: true }).write('.lilac/funnel-check.json', JSON.stringify(result, null, 2) + '\n'); } catch (e) { if (/^refusing to write/.test(e.message)) console.error(`funnel: not saved: ${e.message}`); /* else read-only folder: the check still prints */ } }
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    const L = [`funnel: goal "${cfg.goal}" (${summary.source}); site folder ${siteRel}; entry ${entries.join(', ') || 'none'}; goal page ${cfg.goalPage || 'none'}`,
      `main path: ${mainPath ? `${mainPath.pages.join(' -> ')} (${mainPath.clicks} click${mainPath.clicks === 1 ? '' : 's'}, budget ${cfg.maxClicks})` : 'none found'}`,
      'This is a structure check of the built pages. It says nothing about sales or real visitors.', ''];
    for (const s of STAGES) {
      L.push(s.toUpperCase());
      const list = F.filter((f) => f.stage === s);
      if (!list.length) L.push('  ok: nothing to report');
      for (const f of list) L.push(`  [${f.sev}] ${f.id}: ${f.msg}${f.record ? ` (${f.record})` : ''}`, `      fix: ${f.fix}`);
      L.push('');
    }
    L.push(last); console.log(L.join('\n'));
  }
  process.exit(counts.error ? 1 : 0);
}

// ---------------------------------------------------------------- tasks
if (cmd === 'tasks') {
  if (!hasCfg) { console.error('funnel: no .lilac/funnel.json: run `new` and write the funnel first'); process.exit(2); }
  if (!goalPg) { console.error('funnel: no goal page found; nothing to walk'); process.exit(2); }
  const sampleFor = (f) => { const t = (f.a.type ?? 'text').toLowerCase(), n = `${f.a.name ?? ''} ${f.a.id ?? ''}`.toLowerCase();
    if (t === 'email') return SAMPLE_PERSONAS[0]; if (t === 'tel') return '5551234567'; if (t === 'date') return '2030-01-15'; if (t === 'number') return String(f.a.min || 1);
    return /name/.test(n) ? 'Sam Visitor' : 'Hello, this is a simulated visitor.'; };
  const labelFor = (f) => { const id = f.a.id; const l = id && goalPg.els.find((x) => x.n === 'label' && x.a.for === id); const w = inside(f, (p) => p.n === 'label'); return norm(l ? textOf(l) : f.a['aria-label'] || (w ? textOf(w) : '')); };
  const startFor = (e) => '/' + (e === 'index.html' ? '' : e);
  const skipped = [];
  const taskFor = (entry) => {
    const steps = [];
    const { prev } = bfs(entry); const route = mainPath && prev.has(cfg.goalPage) || entry === cfg.goalPage ? (entry === cfg.goalPage ? [entry] : pathTo(prev, entry, cfg.goalPage)) : [entry];
    for (let i = 0; i + 1 < route.length; i++) { // click the control that leads to the next page
      const e = edges.get(route[i]).find((x) => x.to === route[i + 1] && x.el.n === 'a'); const txt = e ? textOf(e.el) || e.el.a['aria-label'] : '';
      if (txt) steps.push({ click: txt }); else skipped.push(`${route[i]} -> ${route[i + 1]}: link has no text`);
    }
    const form = goalForm;
    if (form) {
      for (const f of fieldsOf(form)) { if (/^(checkbox|radio|file)$/i.test(f.a.type ?? '')) continue; const l = labelFor(f); if (l) steps.push({ type: l, text: sampleFor(f) }); else skipped.push(`field ${f.a.name || f.a.id}: no label`); }
      const btn = form.kids && goalPg.els.find((b) => under(b, form) && (b.n === 'button' ? (b.a.type ?? 'submit') === 'submit' : b.n === 'input' && /^submit$/i.test(b.a.type ?? '')));
      const bl = btn ? textOf(btn) || btn.a.value : ''; if (bl) steps.push({ click: bl });
    }
    const ex = cfg.confText || ''; if (ex) steps.push({ expectText: ex });
    return { name: entries.length > 1 ? `funnel: main path from ${entry}` : 'funnel: main path', startPage: startFor(entry), steps };
  };
  const mine = entries.map(taskFor);
  const f = join(LILAC, 'personas.json'); const old = readJson(f, null);
  const isArr = Array.isArray(old); const tasks = (isArr ? old : old?.tasks ?? []).filter((t) => !(t && typeof t.name === 'string' && t.name.startsWith('funnel:')));
  const outObj = isArr || !old ? { tasks: [...tasks, ...mine] } : { ...old, tasks: [...tasks, ...mine] };
  W.mkdir('.lilac'); W.mkdir('.lilac/personas');
  W.write(f, JSON.stringify(outObj, null, 2) + '\n');
  console.log(`funnel: wrote ${mine.length} funnel task(s) into .lilac/personas.json (${tasks.length} of your own tasks kept)`);
  for (const s of skipped) console.log(`funnel: note: skipped ${s}`);
  if (mine.some((t) => !t.steps.some((s) => s.expectText))) console.log('funnel: note: confirmation.text is empty in funnel.json, so the task cannot check that a confirmation appeared');
  console.log('Next, run the simulated visitors (they are not real customers):');
  console.log(`  node "${join(dirname(SELF), 'persona-test.mjs')}" "${root}" --visitors 100 --json > "${join(LILAC, 'personas', 'last.json')}"`);
  console.log('Then: funnel.mjs report to summarise.');
  process.exit(0);
}

// ---------------------------------------------------------------- report command
{
  const chk = readJson(join(LILAC, 'funnel-check.json')), per = readJson(join(LILAC, 'personas', 'last.json'));
  if (!hasCfg) { console.error('funnel: no .lilac/funnel.json: nothing to report'); process.exit(2); }
  const L = ['# Funnel report', '', `Written ${new Date().toISOString().slice(0, 10)} by funnel.mjs. Plain words first, numbers second.`, '',
    '**Read this first.** Simulated visitors are not real customers. This report checks structure (can a visitor get from the first page to the goal, is the next step clear, is there a confirmation, is the proof honest). No conversion rate is claimed, because no real visitor has been counted.', '',
    '## The funnel', '', `- Goal: ${cfg.goal || 'UNKNOWN'}`, `- Ideal customer: ${str(fcfg.customer) || 'UNKNOWN'}`, `- Entry pages: ${cfg.entry.join(', ') || 'UNKNOWN'}`, `- Goal page: ${cfg.goalPage || 'UNKNOWN'}`, `- Click budget: ${cfg.maxClicks}`,
    `- Steps listed: ${cfg.steps.length}`, `- Confirmation: ${cfg.confPage || '(inline)'}${cfg.confText ? `, text "${cfg.confText}"` : ''}`, `- Success metric: ${str(fcfg.successMetric?.name) || 'UNKNOWN'} (target: ${str(fcfg.successMetric?.target) || 'UNKNOWN'}; the owner fills this from real data)`, '', '## Last structure check', ''];
  if (!chk) L.push('No check result yet. Run `funnel.mjs check` first.');
  else {
    L.push(`Run at ${chk.at}: ${chk.counts.error} error(s), ${chk.counts.warn} warning(s), ${chk.counts.unverified} unverified.`, '', chk.funnel?.path ? `Main path: ${chk.funnel.path.pages.join(' -> ')} (${chk.funnel.path.clicks} click(s), budget ${chk.funnel.maxClicks}).` : 'Main path: none found.', '');
    for (const s of STAGES) { const list = chk.findings.filter((f) => f.stage === s); if (list.length) { L.push(`### ${s}`, ''); for (const f of list) L.push(`- [${f.sev}] ${f.id}: ${f.msg}${f.record ? ` (${f.record})` : ''}. Fix: ${f.fix}`); L.push(''); } }
  }
  L.push('## Last simulated visitors (persona-test)', '');
  if (!per?.overall) L.push('No persona result yet (.lilac/personas/last.json). Run `funnel.mjs tasks`, then persona-test with `--json`.');
  else {
    L.push(`Simulated visitors, not real people: ${per.overall.ok} of ${per.overall.attempts} scripted tasks completed (${per.overall.rate}%) across all tasks.`, '');
    const mine = Object.entries(per.byTask ?? {}).filter(([k]) => k.startsWith('custom:funnel:'));
    for (const [k, v] of mine) L.push(`- ${k.replace('custom:', '')}: ${v.ok} of ${v.attempts} completed (${v.rate}%)`);
    const gs = (per.groups ?? []).filter((g) => String(g.task).startsWith('custom:funnel:')).slice(0, 5);
    if (gs.length) { L.push('', 'Where simulated visitors fell off:'); for (const g of gs) L.push(`- persona ${g.persona}, page ${g.page}, ${g.count} session(s): ${g.reason}`); }
  }
  L.push('', '## What this does not tell you', '', '- Whether anyone will buy. Real conversion needs real traffic, privacy-friendly counts and one change at a time.', '- Taste, trust as a person feels it, or demand.', '- Anything about the site after it was last built and checked.', '');
  W.write('FUNNEL-REPORT.md', L.join('\n'));
  console.log('funnel: wrote FUNNEL-REPORT.md');
}
