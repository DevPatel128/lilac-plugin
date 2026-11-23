#!/usr/bin/env node
// content.mjs build|check|new|seo|og|jsonld|faq|legal  (run with no arguments for usage)
// Owner-editable content, languages, search-engine data and honest legal starting points for a static site. Node only, no dependencies, no network.
//   build  <dir>                       content/*.md -> site/blog/*.html + blog index + feed.xml; content/pages + content/i18n -> site/<lang>/*.html
//   check  <dir> [--publish]           post problems, missing translations (human translates), unfilled {{placeholders}} (fail with --publish)
//   new    <dir> post "<title>"        draft post stub          seo <dir> [--deterministic] [--force]   sitemap.xml, robots.txt, canonical and og/twitter meta
//   og     <dir>                       1200x630 share images (SVG always; PNG with system Chrome, else SKIPPED(no browser))
//   jsonld <Type> <data.json> [--inject page.html]   |   faq <page.html>      JSON-LD from supplied fields only; refuses invented ones
//   legal  <dir> [--force] [--with-analytics]        templates/legal -> site/*.html filled only from .lilac/business.json
// Project files: content/site.json {name,url,defaultLang,languages,requiredLanguages,css}; posts have front matter (title,date,slug,summary,language,draft).
// Limits (shortcuts): Markdown subset only; data-i18n elements must not nest the same tag; sitemap has no hreflang entries.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { scoped } from '../lib/safe-fs.mjs';
import { join, dirname, resolve, relative, sep, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = 'content-1';
const argv = process.argv.slice(2);
const cmd = argv[0];
const has = (n) => argv.includes(n);
const flag = (n) => { const i = argv.indexOf(n); return i < 0 ? null : argv[i + 1]; };
const pos = argv.slice(1).filter((a, i, all) => !a.startsWith('--') && !['--site', '--date', '--inject'].includes(all[i - 1]));
const die = (m, code = 1) => { console.error(m); process.exit(code); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const rd = (p) => readFileSync(p, 'utf8');
// Every write into the project goes through safe-fs: a symlink planted in a cloned repo is refused (security review M-2).
function wif(p, text) { if (existsSync(p) && rd(p) === text) return false; scoped(dir).write(p, text); return true; }
function walk(d, out = []) { if (!existsSync(d)) return out; for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; }
const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'dv', 'ckb', 'ug']);
const dirOf = (l) => (RTL.has(String(l).toLowerCase().split('-')[0]) ? 'rtl' : 'ltr');
const decode = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const plain = (h) => decode(h.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

const usage = () => die('usage: content.mjs build|check <dir> | new <dir> post "<title>" | seo <dir> [--deterministic] | og <dir> | jsonld <Type> <data.json> | faq <page.html> | legal <dir> [--force] [--with-analytics]', 2);
if (!cmd) usage();
const dir = ['jsonld', 'faq'].includes(cmd) ? null : resolve(pos[0] ?? '');
if (dir && (!pos[0] || !existsSync(dir) || !statSync(dir).isDirectory())) usage();
const siteDir = dir && join(dir, flag('--site') ?? 'site');

// ---------- project settings
function loadSite() {
  const f = join(dir, 'content/site.json');
  if (!existsSync(f)) die('content/site.json not found. Create it with {"name","url",...}; the url is the real https address, UNKNOWN until the owner gives it.');
  let j; try { j = JSON.parse(rd(f)); } catch (e) { die(`content/site.json is not valid JSON: ${e.message}`); }
  if (!/^https?:\/\/[^\s/]+/i.test(j.url ?? '')) die('content/site.json needs "url" (the real address of the site, such as https://example.com). It is UNKNOWN until the owner says; do not guess it.');
  if (!j.name) die('content/site.json needs "name".');
  const i18nDir = join(dir, 'content/i18n');
  const files = existsSync(i18nDir) ? readdirSync(i18nDir).filter((x) => x.endsWith('.json')).map((x) => x.slice(0, -5)).sort() : [];
  const defaultLang = j.defaultLang ?? 'en';
  return { name: j.name, url: j.url.replace(/\/+$/, ''), defaultLang, languages: j.languages ?? (files.length ? files : [defaultLang]), required: j.requiredLanguages ?? [defaultLang], css: j.css ?? 'assets/styles.css', raw: JSON.stringify(j) };
}

// ---------- Markdown subset (headings, paragraphs, lists, links, emphasis, code, blockquote, images). Raw HTML is escaped.
function safeUrl(u) {
  const c = u.replace(/[\x00-\x20\x7f-\x9f]/g, '');
  const m = c.match(/^([a-z][a-z0-9+.-]*):/i);
  return m && !['http', 'https', 'mailto', 'tel'].includes(m[1].toLowerCase()) ? null : u.trim().split(/\s+/)[0];
}
function inline(raw, errs) {
  const hold = []; const keep = (h) => { hold.push(h); return `\u0001${hold.length - 1}\u0001`; };
  let s = raw.replace(/[\u0000\u0001]/g, '');
  s = s.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${esc(c)}</code>`));
  s = s.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_, alt, src) => {
    const u = safeUrl(src);
    if (!alt.trim()) { errs.push(`image without alt text refused: ${src.trim()}`); return ''; }
    if (!u || /^data:/i.test(u)) { errs.push(`unsafe image address refused: ${src.trim()}`); return ''; }
    return keep(`<img src="${esc(u)}" alt="${esc(alt)}" loading="lazy">`);
  });
  s = s.replace(/\[([^\]]+)\]\(([^)]*)\)/g, (_, text, href) => {
    const u = safeUrl(href);
    if (!u) { errs.push(`unsafe link refused: ${href.trim()}`); return ''; }
    return keep(`<a href="${esc(u)}"${/^https?:/i.test(u) ? ' rel="noopener noreferrer"' : ''}>${esc(text)}</a>`);
  });
  s = esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/(?<![\w])_(.+?)_(?![\w])/g, '<em>$1</em>');
  return s.replace(/\u0001(\d+)\u0001/g, (_, i) => hold[+i]);
}
function md(src) {
  const errs = []; const out = []; const L = src.replace(/\r\n?/g, '\n').split('\n'); let i = 0, lvl = 1;
  const block = (l) => /^(#{1,6}\s|>|[-*]\s|\d+[.)]\s|```)/.test(l);
  while (i < L.length) {
    const l = L[i]; let m;
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('```')) { const b = []; i++; while (i < L.length && !L[i].startsWith('```')) b.push(L[i++]); i++; out.push(`<pre><code>${esc(b.join('\n'))}</code></pre>`); continue; }
    if ((m = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) { lvl = Math.min(lvl + 1, m[1].length + 1, 6); out.push(`<h${lvl}>${inline(m[2], errs)}</h${lvl}>`); i++; continue; }
    if (l.startsWith('>')) { const b = []; while (i < L.length && L[i].startsWith('>')) b.push(L[i++].replace(/^>\s?/, '')); out.push(`<blockquote><p>${inline(b.join(' '), errs)}</p></blockquote>`); continue; }
    const li = (re) => { const b = []; while (i < L.length && re.test(L[i])) b.push(`<li>${inline(L[i++].replace(re, ''), errs)}</li>`); return b.join('\n'); };
    if (/^[-*]\s/.test(l)) { out.push(`<ul>\n${li(/^[-*]\s+/)}\n</ul>`); continue; }
    if (/^\d+[.)]\s/.test(l)) { out.push(`<ol>\n${li(/^\d+[.)]\s+/)}\n</ol>`); continue; }
    const b = [l]; i++; while (i < L.length && L[i].trim() && !block(L[i])) b.push(L[i++]);
    out.push(`<p>${inline(b.join('\n'), errs)}</p>`);
  }
  return { html: out.join('\n'), errs };
}

// ---------- posts
function parseFM(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/); if (!m) return null;
  const fm = {}; for (const l of m[1].split(/\r?\n/)) { const k = l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/); if (k) fm[k[1]] = k[2].trim().replace(/^(["'])(.*)\1$/, '$2'); }
  return { fm, body: m[2] };
}
function loadPosts(S) {
  const cd = join(dir, 'content'); const errs = []; const posts = []; let drafts = 0; const seen = new Set();
  for (const f of existsSync(cd) ? readdirSync(cd).filter((x) => x.endsWith('.md')).sort() : []) {
    const p = parseFM(rd(join(cd, f)));
    if (!p) { errs.push(`${f}: no front matter (--- title, date ... ---)`); continue; }
    if (/^(true|yes|1)$/i.test(p.fm.draft ?? '')) { drafts++; continue; }
    const slug = p.fm.slug || f.replace(/\.md$/, '');
    if (!p.fm.title) errs.push(`${f}: title is missing`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fm.date ?? '') || isNaN(Date.parse(p.fm.date))) errs.push(`${f}: date must look like 2026-01-31`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) errs.push(`${f}: slug "${slug}" may only use a-z, 0-9 and -`);
    if (seen.has(slug)) errs.push(`${f}: slug "${slug}" is used twice`); seen.add(slug);
    const r = md(p.body); for (const e of r.errs) errs.push(`${f}: ${e}`);
    const text = plain(r.html);
    posts.push({ f, slug, title: p.fm.title ?? '', date: p.fm.date ?? '', lang: p.fm.language || S.defaultLang, html: r.html, text, summary: p.fm.summary || text.slice(0, 160).replace(/\s+\S*$/, ''), mins: Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 200)) });
  }
  posts.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));
  return { posts, errs, drafts };
}

const ogName = (r) => r.replace(/\.html$/, '').split('/').join('-');
const ogUrl = (S, r) => (existsSync(join(siteDir, 'assets/og', `${ogName(r)}.png`)) ? `${S.url}/assets/og/${ogName(r)}.png` : null);
const metaTags = (S, { title, desc, url, img, type = 'website' }) => [
  `<link rel="canonical" href="${esc(url)}">`, `<meta property="og:type" content="${type}">`, `<meta property="og:site_name" content="${esc(S.name)}">`,
  `<meta property="og:title" content="${esc(title)}">`, desc && `<meta property="og:description" content="${esc(desc)}">`, `<meta property="og:url" content="${esc(url)}">`,
  img && `<meta property="og:image" content="${esc(img)}">`, `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`].filter(Boolean).join('\n');
function shell(S, { lang, title, desc, url, rel, root, body, type = 'website' }) {
  const icon = ['favicon.svg', 'favicon.ico'].find((n) => existsSync(join(siteDir, n)));
  return `<!doctype html>
<html lang="${esc(lang)}" dir="${dirOf(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | ${esc(S.name)}</title>
<meta name="description" content="${esc(desc)}">
${metaTags(S, { title, desc, url, img: ogUrl(S, rel), type })}
${icon ? `<link rel="icon" href="${root}${icon}">\n` : ''}<link rel="alternate" type="application/atom+xml" title="${esc(S.name)}" href="${root}feed.xml">
<link rel="stylesheet" href="${root}${esc(S.css)}">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap bar"><a class="brand" href="${root}index.html">${esc(S.name)}</a> <a href="${root}blog/index.html">Blog</a></div></header>
<main id="main" class="wrap">
${body}
</main>
</body>
</html>
`;
}

function buildBlog(S) {
  const { posts, errs, drafts } = loadPosts(S);
  if (errs.length) die(`content: ${errs.length} problem(s), nothing written:\n  ${errs.join('\n  ')}`);
  const bd = join(siteDir, 'blog'); const cf = join(dir, '.lilac/content-cache.json');
  let cache = {}; try { cache = JSON.parse(rd(cf)); } catch {}
  const next = {}; let built = 0, skipped = 0;
  posts.forEach((p, i) => {
    const older = posts[i + 1], newer = posts[i - 1]; const rel = `blog/${p.slug}.html`; const out = join(siteDir, rel);
    const key = sha([VERSION, S.raw, p.f, p.slug, p.title, p.date, p.lang, p.html, p.summary, older?.slug, older?.title, newer?.slug, newer?.title, ogUrl(S, rel)].join('\u0000'));
    next[p.slug] = key;
    if (cache[p.slug] === key && existsSync(out)) { skipped++; return; }
    const nav = (older || newer) ? `<nav aria-label="More posts"><ul>${older ? `<li>Previous: <a href="${older.slug}.html" rel="prev">${esc(older.title)}</a></li>` : ''}${newer ? `<li>Next: <a href="${newer.slug}.html" rel="next">${esc(newer.title)}</a></li>` : ''}</ul></nav>` : '';
    const body = `<article lang="${esc(p.lang)}">\n<h1>${esc(p.title)}</h1>\n<p class="meta"><time datetime="${p.date}">${p.date}</time> · ${p.mins} min read</p>\n${p.html}\n</article>\n${nav}`;
    wif(out, shell(S, { lang: p.lang, title: p.title, desc: p.summary, url: `${S.url}/${rel}`, rel, root: '../', body, type: 'article' })); built++;
  });
  // The cache is a file inside the project: only plain slugs may name a file to remove (a key like ../../x must not escape).
  for (const slug of Object.keys(cache)) if (!(slug in next) && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(slug)) scoped(dir).rm(join(bd, `${slug}.html`));
  if (!posts.length) { scoped(dir).rm(join(bd, 'index.html')); scoped(dir).rm(join(siteDir, 'feed.xml')); }
  else {
    const items = posts.map((p) => `<li><h2><a href="${p.slug}.html">${esc(p.title)}</a></h2><p class="meta"><time datetime="${p.date}">${p.date}</time> · ${p.mins} min read</p><p>${esc(p.summary)}</p></li>`).join('\n');
    wif(join(bd, 'index.html'), shell(S, { lang: S.defaultLang, title: 'Blog', desc: `Latest posts from ${S.name}, newest first. Subscribe with the feed.`, url: `${S.url}/blog/index.html`, rel: 'blog/index.html', root: '../', body: `<h1>Blog</h1>\n<p>New posts appear here, newest first. <a href="../feed.xml">Subscribe with the feed</a>.</p>\n<ul class="posts">\n${items}\n</ul>` }));
    const x = (s) => esc(s);
    wif(join(siteDir, 'feed.xml'), `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${x(S.defaultLang)}">
<title>${x(S.name)}</title>
<id>${x(S.url)}/feed.xml</id>
<link rel="self" href="${x(S.url)}/feed.xml"/>
<link rel="alternate" href="${x(S.url)}/blog/index.html"/>
<updated>${posts[0].date}T00:00:00Z</updated>
<author><name>${x(S.name)}</name></author>
${posts.map((p) => `<entry>
<title>${x(p.title)}</title>
<id>${x(S.url)}/blog/${x(p.slug)}.html</id>
<link href="${x(S.url)}/blog/${x(p.slug)}.html"/>
<updated>${p.date}T00:00:00Z</updated>
<summary>${x(p.summary)}</summary>
</entry>`).join('\n')}
</feed>
`);
  }
  wif(cf, JSON.stringify(next, null, 1) + '\n');
  console.log(`blog: built ${built}, skipped ${skipped} unchanged, ${drafts} draft(s) left out`);
}

// ---------- i18n
function i18nData(S) {
  const pd = join(dir, 'content/pages'); const pages = existsSync(pd) ? readdirSync(pd).filter((x) => x.endsWith('.html')).sort() : [];
  const msgs = {}; for (const l of S.languages) { const f = join(dir, 'content/i18n', `${l}.json`); msgs[l] = existsSync(f) ? JSON.parse(rd(f)) : {}; }
  const tpl = Object.fromEntries(pages.map((p) => [p, rd(join(pd, p))]));
  const used = new Set(); for (const t of Object.values(tpl)) for (const m of t.matchAll(/data-i18n(?:-content)?="([^"]+)"/g)) used.add(m[1]);
  const all = new Set([...used, ...Object.values(msgs).flatMap((m) => Object.keys(m))]); all.delete('_switcher_label');
  const missing = Object.fromEntries(S.languages.map((l) => [l, [...all].filter((k) => !(k in msgs[l]) && k !== '_name').sort()]));
  return { pages, msgs, tpl, missing };
}
function i18nReport(S, D) {
  let fail = false;
  for (const l of S.languages) {
    const m = D.missing[l]; if (!m.length) continue;
    const req = S.required.includes(l); if (req) fail = true;
    console.log(`i18n: ${l} is missing ${m.length} key(s): ${m.join(', ')}${req ? ' (REQUIRED language: fails)' : ''}`);
  }
  if (S.languages.some((l) => D.missing[l].length)) console.log('i18n: gaps are only reported: translate by a human or a vetted service. Lilac never machine-translates.');
  return fail;
}
function buildI18n(S) {
  const D = i18nData(S); if (!D.pages.length) return;
  if (i18nReport(S, D)) die('i18n: a required language has missing keys, nothing written.');
  const lines = [];
  for (const l of S.languages) for (const p of D.pages) {
    const href = (to) => `../${to}/${p}`; const urlOf = (to) => `${S.url}/${to}/${p}`; const M = D.msgs[l], DM = D.msgs[S.defaultLang] ?? {};
    const alt = S.languages.map((o) => `<link rel="alternate" hreflang="${esc(o)}" href="${esc(urlOf(o))}">`).concat(`<link rel="alternate" hreflang="x-default" href="${esc(urlOf(S.defaultLang))}">`).join('\n');
    const sw = `<nav aria-label="${esc(M._switcher_label ?? DM._switcher_label ?? 'Language')}"><ul>${S.languages.map((o) => `<li><a href="${esc(href(o))}" hreflang="${esc(o)}" lang="${esc(o)}"${o === l ? ' aria-current="true"' : ''}>${esc(D.msgs[o]._name ?? o)}</a></li>`).join('')}</ul></nav>`;
    let h = D.tpl[p].replace(/\{\{(lang|dir|root|canonical|alternates|switcher)\}\}/g, (_, k) => ({ lang: esc(l), dir: dirOf(l), root: '../', canonical: `<link rel="canonical" href="${esc(urlOf(l))}">`, alternates: alt, switcher: sw })[k]);
    const val = (k) => (k in M ? [M[k], false] : [DM[k] ?? '', true]);
    h = h.replace(/<([a-z][\w-]*)([^>]*?)\sdata-i18n="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g, (_, tag, a, k, b) => { const [v, fb] = val(k); return `<${tag}${a} data-i18n="${k}"${b}${fb ? ` lang="${esc(S.defaultLang)}"` : ''}>${esc(v)}</${tag}>`; });
    h = h.replace(/<meta([^>]*?)\sdata-i18n-content="([^"]+)"([^>]*)>/g, (_, a, k, b) => `<meta${(a + b).replace(/\scontent="[^"]*"/g, '')} data-i18n-content="${k}" content="${esc(val(k)[0])}">`);
    wif(join(siteDir, l, p), h); lines.push(`${l}/${p}`);
  }
  console.log(`i18n: wrote ${lines.length} page(s) in ${S.languages.join(', ')}`);
}

// ---------- check
function check(S) {
  const { errs } = loadPosts(S); let fail = errs.length > 0; for (const e of errs) console.log(`post: ${e}`);
  const D = i18nData(S); if (D.pages.length || Object.values(D.msgs).some((m) => Object.keys(m).length)) fail = i18nReport(S, D) || fail;
  const ph = new Map(); for (const f of walk(siteDir).filter((x) => x.endsWith('.html'))) for (const m of rd(f).matchAll(/\{\{(\w+)\}\}/g)) ph.set(m[1], [...(ph.get(m[1]) ?? []), relative(siteDir, f).split(sep).join('/')]);
  for (const [k, fs] of ph) console.log(`UNFILLED {{${k}}} in ${[...new Set(fs)].join(', ')}: ask the owner for the true answer`);
  if (ph.size && has('--publish')) fail = true;
  console.log(fail ? 'content check: FAIL' : 'content check: ok');
  process.exit(fail ? 1 : 0);
}

// ---------- new post
function newPost(S) {
  const title = pos[2]; if (pos[1] !== 'post' || !title) usage();
  const slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) die('could not make a slug from that title; use letters or digits.');
  const f = join(dir, 'content', `${slug}.md`); if (existsSync(f)) die(`content/${slug}.md already exists; not overwritten.`);
  const date = flag('--date') ?? new Date().toISOString().slice(0, 10);
  wif(f, `---\ntitle: ${title}\ndate: ${date}\nslug: ${slug}\nsummary: \nlanguage: en\ndraft: true\n---\nWrite your post here in plain words. Put a blank line between paragraphs.\n\n## A heading\n\n- a list item\n\nA [link](https://example.com) and an image: ![Describe the picture for people who cannot see it](../assets/photo.jpg)\n`);
  console.log(`created content/${slug}.md as a DRAFT. Fill in the summary, write the post, change "draft: true" to "draft: false", then run build.`);
}

// ---------- SEO
const pagesOf = () => walk(siteDir).filter((f) => f.endsWith('.html')).map((f) => ({ f, rel: relative(siteDir, f).split(sep).join('/') })).filter((p) => p.rel !== '404.html' && !/\bnoindex\b/i.test(rd(p.f).match(/<meta[^>]*name=["']robots["'][^>]*>/i)?.[0] ?? '')).sort((a, b) => a.rel.localeCompare(b.rel));
function seo(S) {
  const sm = join(siteDir, 'sitemap.xml'), rb = join(siteDir, 'robots.txt'), MK = 'generated by lilac content.mjs';
  for (const f of [sm, rb]) if (existsSync(f) && !rd(f).includes(MK) && !has('--force')) die(`${relative(dir, f)} exists and was not written by this tool; kept. Use --force to replace it.`);
  const pages = pagesOf(); const epoch = process.env.SOURCE_DATE_EPOCH;
  const lastmod = (p) => { const t = has('--deterministic') ? (epoch ? +epoch * 1000 : null) : statSync(p.f).mtimeMs; return t == null ? '' : `<lastmod>${new Date(t).toISOString().slice(0, 10)}</lastmod>`; };
  wif(sm, `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${MK} -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `<url><loc>${esc(`${S.url}/${p.rel}`)}</loc>${lastmod(p)}</url>`).join('\n')}\n</urlset>\n`);
  wif(rb, `# ${MK}\nUser-agent: *\nAllow: /\nSitemap: ${S.url}/sitemap.xml\n`);
  let injected = 0;
  for (const p of pages) {
    let h = rd(p.f); if (!/<\/head>/i.test(h)) continue;
    const title = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim(), desc = h.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1];
    const url = `${S.url}/${p.rel}`; const img = ogUrl(S, p.rel); const add = [];
    const need = (re, tag) => { if (!re.test(h)) add.push(tag); };
    need(/<link[^>]*rel=["']canonical["']/i, `<link rel="canonical" href="${esc(url)}">`);
    if (title) need(/property=["']og:title["']/i, `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}">`);
    if (desc) need(/property=["']og:description["']/i, `<meta property="og:description" content="${desc}">`);
    need(/property=["']og:url["']/i, `<meta property="og:url" content="${esc(url)}">`);
    need(/property=["']og:type["']/i, '<meta property="og:type" content="website">');
    if (img) need(/property=["']og:image["']/i, `<meta property="og:image" content="${esc(img)}">`);
    need(/name=["']twitter:card["']/i, `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`);
    if (add.length) { h = h.replace(/<\/head>/i, `${add.join('\n')}\n</head>`); wif(p.f, h); injected++; }
  }
  console.log(`seo: sitemap.xml (${pages.length} page(s)), robots.txt, meta added to ${injected} page(s)`);
}

// ---------- OG images
function findChrome() {
  const onPath = (n) => (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').map((d) => join(d, n)).find((c) => c && existsSync(c));
  const win = ['ProgramFiles', 'ProgramFiles(x86)'].flatMap((v) => process.env[v] ? [join(process.env[v], 'Google/Chrome/Application/chrome.exe'), join(process.env[v], 'Microsoft/Edge/Application/msedge.exe')] : []);
  return process.env.CHROME ? (existsSync(process.env.CHROME) ? process.env.CHROME : null)
    : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(onPath), ...win].find((c) => c && existsSync(c));
}
function wrap(t, n = 26, max = 3) {
  const lines = []; let cur = '';
  for (const w of t.split(' ')) { if (cur && (cur + ' ' + w).length > n) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w; }
  if (cur) lines.push(cur); if (lines.length > max) { lines.length = max; lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, '') + '…'; }
  return lines;
}
function og(S) {
  const chrome = findChrome(); const od = join(siteDir, 'assets/og'); let svgs = 0, pngs = 0, failed = 0;
  for (const p of pagesOf().filter((x) => !x.rel.startsWith('assets/'))) {
    const t = decode(rd(p.f).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').replace(/\s*\|\s*[^|]*$/, (m) => (m.trim().slice(1).trim() === S.name ? '' : m)).trim();
    if (!t) continue;
    const name = ogName(p.rel); const sf = join(od, `${name}.svg`); const pf = join(od, `${name}.png`);
    const lines = wrap(t);
    const changed = wif(sf, `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#2b1d4a"/>
<rect x="80" y="90" width="120" height="10" fill="#c8a2ff"/>
${lines.map((l, i) => `<text x="80" y="${220 + i * 90}" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="72" font-weight="700" fill="#ffffff">${esc(l)}</text>`).join('\n')}
<text x="80" y="560" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="36" fill="#d9c8f5">${esc(S.name)}</text>
</svg>
`); svgs++;
    if (!chrome || (!changed && existsSync(pf))) { if (!chrome) continue; pngs++; continue; }
    const tmp = mkdtempSync(join(tmpdir(), 'lilac-og-'));
    writeFileSync(join(tmp, 'p.html'), `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#2b1d4a}img{display:block;width:1200px;height:630px}</style><img src="${pathToFileURL(sf).href}" alt="">`);
    spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--window-size=1200,630', `--user-data-dir=${join(tmp, 'u')}`, `--screenshot=${pf}`, pathToFileURL(join(tmp, 'p.html')).href], { stdio: 'ignore', timeout: 60000 });
    rmSync(tmp, { recursive: true, force: true });
    const b = existsSync(pf) ? readFileSync(pf) : null;
    if (b && b.readUInt32BE(16) === 1200 && b.readUInt32BE(20) === 630) pngs++; else { failed++; console.log(`og: FAILED to make a 1200x630 PNG for ${p.rel}`); }
  }
  if (!chrome) console.log(`og: SKIPPED(no browser): wrote ${svgs} SVG file(s) in ${relative(dir, od)}; set CHROME=/path/to/chrome (or msedge) to render the PNGs.`);
  else console.log(`og: ${svgs} SVG, ${pngs} PNG (1200x630)${failed ? `, ${failed} FAILED` : ''}`);
  if (failed) process.exit(1);
}

// ---------- JSON-LD (only supplied fields; unknown fields are refused, never invented)
const isUrl = (v) => typeof v === 'string' && /^https?:\/\/[^\s]+$/i.test(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(v);
function ldBuild(type, d) {
  const err = []; const need = (k, ok = isStr, why = 'a non-empty text') => { if (!ok(d[k])) err.push(`${k} is required (${why})`); };
  const allowed = { Organization: ['name', 'url', 'logo', 'email', 'telephone', 'sameAs', 'description'], LocalBusiness: ['name', 'address', 'url', 'telephone', 'email', 'image', 'priceRange', 'description', 'openingHours'],
    Product: ['name', 'description', 'image', 'sku', 'brand', 'url', 'price', 'priceCurrency', 'aggregateRating'], Article: ['headline', 'datePublished', 'author', 'dateModified', 'image', 'description', 'url'],
    FAQPage: ['questions'], BreadcrumbList: ['items'] }[type];
  if (!allowed) die(`unknown type ${type}; use Organization, LocalBusiness, Product, Article, FAQPage or BreadcrumbList.`, 2);
  for (const k of Object.keys(d)) if (!allowed.includes(k)) err.push(`field "${k}" is not supported: supply only these: ${allowed.join(', ')} (nothing is invented for you)`);
  for (const k of ['url', 'logo', 'image']) if (k in d && !isUrl(d[k])) err.push(`${k} must be a full http(s) address`);
  const o = { '@context': 'https://schema.org', '@type': type }; const put = (...ks) => { for (const k of ks) if (k in d && !(k in o)) o[k] = d[k]; };
  if (type === 'Organization') { need('name'); need('url', isUrl, 'full http(s) address'); put('name', 'url', 'logo', 'email', 'telephone', 'description'); if ('sameAs' in d) { if (Array.isArray(d.sameAs) && d.sameAs.every(isUrl)) o.sameAs = d.sameAs; else err.push('sameAs must be a list of full http(s) addresses'); } }
  if (type === 'LocalBusiness') {
    need('name'); const a = d.address;
    if (isStr(a)) o.address = { '@type': 'PostalAddress', streetAddress: a };
    else if (a && typeof a === 'object') { const ok = ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry']; for (const k of Object.keys(a)) if (!ok.includes(k)) err.push(`address.${k} is not supported`); if (!Object.keys(a).some((k) => isStr(a[k]))) err.push('address needs at least one filled part'); o.address = { '@type': 'PostalAddress', ...a }; }
    else err.push('address is required (text or {streetAddress, addressLocality, ...})');
    put('name', 'url', 'telephone', 'email', 'image', 'priceRange', 'description', 'openingHours');
  }
  if (type === 'Product') {
    need('name'); put('name', 'description', 'image', 'sku', 'brand', 'url');
    if ('price' in d || 'priceCurrency' in d) { if (isStr(String(d.price ?? '')) && /^\d+(\.\d+)?$/.test(String(d.price)) && /^[A-Z]{3}$/.test(d.priceCurrency ?? '')) o.offers = { '@type': 'Offer', price: String(d.price), priceCurrency: d.priceCurrency }; else err.push('price needs BOTH a number price and a 3-letter priceCurrency such as GBP; omit both if the owner has not given them'); }
    if ('aggregateRating' in d) { const r = d.aggregateRating ?? {}; if (r && Number(r.ratingValue) > 0 && Number.isInteger(r.reviewCount) && r.reviewCount > 0 && Object.keys(r).every((k) => ['ratingValue', 'reviewCount'].includes(k))) o.aggregateRating = { '@type': 'AggregateRating', ratingValue: r.ratingValue, reviewCount: r.reviewCount }; else err.push('aggregateRating needs ratingValue AND reviewCount from REAL reviews; never invent one'); }
  }
  if (type === 'Article') { need('headline'); need('datePublished', isDate, 'a date like 2026-01-31'); if ('dateModified' in d && !isDate(d.dateModified)) err.push('dateModified must be a date'); const a = d.author; if (isStr(a)) o.author = { '@type': 'Person', name: a }; else if (a && isStr(a.name)) o.author = { '@type': 'Person', name: a.name }; else err.push('author is required (a name)'); put('headline', 'datePublished', 'dateModified', 'image', 'description'); if ('url' in d) o.mainEntityOfPage = d.url; }
  if (type === 'FAQPage') { const q = d.questions; if (!Array.isArray(q) || !q.length || !q.every((x) => x && isStr(x.question) && isStr(x.answer))) err.push('questions must be a non-empty list of {question, answer} with both filled'); else o.mainEntity = q.map((x) => ({ '@type': 'Question', name: x.question, acceptedAnswer: { '@type': 'Answer', text: x.answer } })); }
  if (type === 'BreadcrumbList') { const it = d.items; if (!Array.isArray(it) || !it.length || !it.every((x) => x && isStr(x.name) && isUrl(x.url))) err.push('items must be a non-empty list of {name, url}'); else o.itemListElement = it.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.url })); }
  if (err.length) die(`jsonld ${type}: refused:\n  ${err.join('\n  ')}`);
  return `<script type="application/ld+json">\n${JSON.stringify(o, null, 2).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}\n</script>`;
}
function emit(tag) {
  const pg = flag('--inject');
  if (!pg) return console.log(tag);
  const h = rd(pg); if (!/<\/head>/i.test(h)) die('no </head> in that page');
  scoped(dirname(resolve(pg))).write(basename(pg), h.replace(/<\/head>/i, `${tag}\n</head>`)); console.log(`injected into ${pg}`);
}
if (cmd === 'jsonld') { const [type, file] = pos; if (!type || !file || !existsSync(file)) usage(); let d; try { d = JSON.parse(rd(file)); } catch (e) { die(`${file} is not valid JSON: ${e.message}`); } emit(ldBuild(type, d)); process.exit(0); }
if (cmd === 'faq') {
  if (!pos[0] || !existsSync(pos[0])) usage();
  const q = [...rd(pos[0]).matchAll(/<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi)].map((m) => ({ question: plain(m[1]), answer: plain(m[2]) }));
  if (!q.length) die('no <details><summary>question</summary>answer</details> blocks found in that page.');
  emit(ldBuild('FAQPage', { questions: q })); process.exit(0);
}

// ---------- legal
function legal() {
  const td = join(HERE, '../templates/legal'); const bf = join(dir, '.lilac/business.json'); let B = {};
  if (existsSync(bf)) { try { B = JSON.parse(rd(bf)); } catch (e) { die(`.lilac/business.json is not valid JSON: ${e.message}`); } }
  const sj = join(dir, 'content/site.json'); const css = existsSync(sj) ? (JSON.parse(rd(sj)).css ?? 'assets/styles.css') : 'assets/styles.css';
  const fill = { css: esc(css) };
  for (const k of ['name', 'contact', 'country']) if (typeof B[k] === 'string' && B[k].trim()) fill[k] = esc(B[k].trim());
  if (Array.isArray(B.dataCollected)) fill.dataCollected = B.dataCollected.length ? B.dataCollected.filter(isStr).map((x) => `<li>${esc(x)}</li>`).join('\n') : '<li>The owner says no personal data is collected through this site.</li>';
  const todo = new Set(); const map = { 'privacy-policy': 'privacy', 'cookie-notice': 'cookies', 'accessibility-statement': 'accessibility', 'terms-of-service': 'terms' };
  for (const [t, out] of Object.entries(map)) {
    const dest = join(siteDir, `${out}.html`);
    if (existsSync(dest) && !has('--force')) { console.log(`legal: kept existing ${out}.html (use --force to replace it)`); continue; }
    const h = rd(join(td, `${t}.html`)).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in fill ? fill[k] : (todo.add(k), m)));
    wif(dest, h); console.log(`legal: wrote ${relative(dir, dest)}`);
  }
  if (has('--with-analytics')) for (const f of ['cookie-banner.html', 'cookie-banner.js']) wif(join(dir, 'snippets', f), rd(join(td, f)));
  if (todo.size) console.log(`legal: NOT filled (no true answer on file): ${[...todo].sort().join(', ')}. Ask the owner; the placeholders stay in the pages until then.`);
  console.log('legal: these pages are a starting point only, not legal advice. Have a qualified person review them for your country and business.');
}

// ---------- dispatch
if (cmd === 'legal') legal();
else if (cmd === 'new') newPost();
else if (cmd === 'build') { const S = loadSite(); buildBlog(S); buildI18n(S); }
else if (cmd === 'check') check(loadSite());
else if (cmd === 'seo') seo(loadSite());
else if (cmd === 'og') og(loadSite());
else usage();
