#!/usr/bin/env node
// seo-ready.mjs check <dir> [--site dir] [--json]     audit search and answer-engine readiness of the BUILT site
//                init  <dir> [--site dir] [--base https://example.com]   write the missing sitemap.xml, robots.txt, llms.txt from the HTML pages (never overwrites)
// check: sitemap.xml and robots.txt valid and consistent with the pages, llms.txt present and listing real pages, one canonical per page, schema.org
// JSON-LD parsed and type-checked per vertical (LocalBusiness and subtypes, Restaurant, MusicGroup, Product, Event, Organization), Open Graph basics,
// no duplicate titles. Required fields are the ones that exist as facts (name, address, dates, price). Invented trust signals are errors: aggregateRating
// or review that is not visible on the page with the same numbers, and placeholder values (SAMPLE, UNKNOWN, TODO, lorem, example.com, 555-01xx).
// init never invents a domain: it uses --base, else the canonical URL of the home page, else the marker host https://unknown.invalid, which `check` fails
// until the real domain is set. Exit 1 only on errors. Exit 2 on bad usage. Last line: `seo-ready: E error(s), W warning(s), U unverified`.
// Offline: reads files only, no network. Writes (init only) go through lib/safe-fs.mjs.
// shortcut: regex parsing like qa.mjs; a sitemap index or a sitemap split over several files is reported as UNVERIFIED, not followed; JSON-LD is checked per type, not against the full schema.org vocabulary.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { scoped } from '../lib/safe-fs.mjs';

const args = process.argv.slice(2);
const flagVal = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const json = args.includes('--json');
const skipVals = new Set([flagVal('--site'), flagVal('--base')].filter(Boolean));
const [cmd, proj] = args.filter((a) => !a.startsWith('--') && !skipVals.has(a));
if (!['check', 'init'].includes(cmd) || !proj || !existsSync(proj) || !statSync(proj).isDirectory()) { console.error('usage: seo-ready.mjs check|init <dir> [--site dir] [--json] [--base https://example.com]'); process.exit(2); }

const walk = (d, out = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name === '.git' || e.name === '.lilac') continue; const p = join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; };
const hasHtml = (d) => existsSync(d) && statSync(d).isDirectory() && walk(d).some((f) => f.endsWith('.html'));
const root = resolve(proj);
const siteArg = flagVal('--site');
let site = siteArg ? resolve(root, siteArg) : ['site', 'public', 'dist', 'out', 'build'].map((n) => join(root, n)).find(hasHtml);
if (!site && hasHtml(root)) site = root;
if (!site) { console.error('seo-ready: no site folder found (site, public, dist, out, build, or .html files in the root). Use --site <dir>.'); process.exit(2); }

const rel = (p) => relative(site, p).split(sep).join('/');
const read = (p) => readFileSync(p, 'utf8');
const attrsOf = (s) => { const o = {}; for (const m of s.matchAll(/([^\s=\/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) o[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''; return o; };
const plain = (h) => h.replace(/<style\b[\s\S]*?<\/style>|<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const normPath = (p) => { p = p.split('#')[0].split('?')[0]; p = p.replace(/\/index\.html$/, '/').replace(/\.html$/, ''); return p.length > 1 ? p.replace(/\/$/, '') : '/'; };
const urlPathOf = (page) => normPath('/' + page);

const pagesAll = walk(site).filter((f) => f.endsWith('.html')).sort().map((file) => {
  const raw = read(file).replace(/<!--[\s\S]*?-->/g, '');
  const markup = raw.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, '<script$1></script>');
  const tags = [...markup.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)].map((m) => ({ n: m[1].toLowerCase(), a: attrsOf(m[2]) }));
  const meta = (k, v) => tags.find((t) => t.n === 'meta' && (t.a[k] ?? '').toLowerCase() === v)?.a.content ?? '';
  const page = rel(file);
  return { file, page, raw, markup, tags, meta, title: plain(markup.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''), robots: meta('name', 'robots'), up: urlPathOf(page), text: plain(raw) };
});
const noindex = (p) => /noindex/i.test(p.robots);
const pages = pagesAll.filter((p) => !/(?:^|\/)404\.html$/.test(p.page));
const indexable = pages.filter((p) => !noindex(p));
const home = pages.find((p) => p.page === 'index.html') ?? pages[0];
const canonOf = (p) => p.tags.filter((t) => t.n === 'link' && /canonical/i.test(t.a.rel ?? '')).map((t) => t.a.href);
const origin = (u) => { try { return new URL(u).origin; } catch { return null; } };
const MARK = 'https://unknown.invalid';

// init
if (cmd === 'init') {
  let base = flagVal('--base') ?? (home && origin(canonOf(home)[0] ?? '')) ?? null;
  if (base && !origin(base)) { console.error(`seo-ready: --base must be an absolute URL, got ${base}`); process.exit(2); }
  base = base ? origin(base) : MARK;
  if (!pages.length) { console.error('seo-ready: no .html pages to describe'); process.exit(2); }
  const W = scoped(site); const wrote = []; const skipped = [];
  const put = (name, data) => { if (existsSync(join(site, name))) skipped.push(name); else { W.write(name, data, { overwrite: false }); wrote.push(name); } };
  const loc = (p) => base + (p.up === '/' ? '/' : p.up);
  put('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((p) => `  <url><loc>${loc(p).replace(/&/g, '&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`);
  put('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
  const desc = (p) => p.meta('name', 'description').replace(/\s+/g, ' ').trim();
  put('llms.txt', `# ${home.title || 'UNKNOWN site name'}\n\n> ${desc(home) || 'UNKNOWN: add a one-sentence description of the site.'}\n\n## Pages\n\n${indexable.map((p) => `- [${p.title || p.page}](${loc(p)})${desc(p) ? ': ' + desc(p) : ''}`).join('\n')}\n`);
  console.log(`seo-ready init: wrote ${wrote.join(', ') || 'nothing'}${skipped.length ? `; kept existing ${skipped.join(', ')}` : ''}`);
  if (base === MARK) console.log(`seo-ready init: the domain is UNKNOWN, so ${MARK} was written. Re-run with --base https://your-domain (delete the files first) before you ship.`);
  process.exit(0);
}

// check
const byPage = []; const unverified = []; const S = [];
const mk = (F) => (sev, id, msg, fix) => { if (!F.some((f) => f.id === id && f.msg === msg)) F.push({ sev, id, msg, fix }); };
const sAdd = mk(S);
const pf = (p) => { let r = byPage.find((x) => x.page === p.page); if (!r) byPage.push(r = { page: p.page, findings: [] }); return mk(r.findings); };
const PLACE = /\b(?:SAMPLE|UNKNOWN|TODO|TBD|lorem|ipsum|placeholder|your[- ](?:name|business|address))\b|example\.(?:com|org|net)|\b555[- ]?01\d\d\b|\+?1?[- ]?555[- ]?0100/i;

// Sitemap
const smPath = join(site, 'sitemap.xml'); let smLocs = []; let siteOrigin = null;
if (!existsSync(smPath)) sAdd('error', 'sitemap-missing', 'no sitemap.xml', 'Run: seo-ready.mjs init <dir> (writes it from the pages found).');
else {
  const x = read(smPath);
  if (/<sitemapindex\b/i.test(x)) unverified.push({ page: 'sitemap.xml', msg: 'sitemap index', reason: 'child sitemaps are not followed' });
  else {
    if (!/<urlset\b[^>]*xmlns\s*=\s*["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(x)) sAdd('error', 'sitemap-invalid', 'sitemap.xml has no <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', 'Use the standard urlset root with the sitemaps.org namespace.');
    const n = (re) => (x.match(re) ?? []).length;
    if (n(/<url>/g) !== n(/<\/url>/g) || n(/<loc>/g) !== n(/<\/loc>/g) || n(/<url>/g) !== n(/<loc>/g)) sAdd('error', 'sitemap-invalid', 'sitemap.xml tags are unbalanced or a <url> has no <loc>', 'Every <url> needs exactly one <loc>; close every tag.');
    smLocs = [...x.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
    if (!smLocs.length) sAdd('error', 'sitemap-empty', 'sitemap.xml lists no URLs', 'List every indexable page.');
    if (smLocs.length > 50000) sAdd('error', 'sitemap-size', 'more than 50000 URLs', 'Split into several sitemaps with a sitemap index.');
    for (const m of x.matchAll(/<lastmod>\s*([^<]*?)\s*<\/lastmod>/g)) if (!/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/.test(m[1])) sAdd('error', 'sitemap-lastmod', `lastmod "${m[1]}" is not a W3C date`, 'Use YYYY-MM-DD.');
    const origins = new Set(smLocs.map(origin));
    if (origins.has(null)) sAdd('error', 'sitemap-loc', 'a <loc> is not an absolute URL', 'Use full URLs: https://your-domain/path.');
    origins.delete(null);
    if (origins.size > 1) sAdd('error', 'sitemap-origin', `sitemap mixes origins: ${[...origins].join(', ')}`, 'Use one origin (scheme and host) for every URL.');
    siteOrigin = [...origins][0] ?? null;
    if (siteOrigin && (/^http:/i.test(siteOrigin) || /\.invalid$|unknown/i.test(new URL(siteOrigin).hostname))) sAdd('error', 'sitemap-domain', `sitemap domain is ${siteOrigin} (${/^http:/i.test(siteOrigin) ? 'not https' : 'UNKNOWN placeholder'})`, 'Set the real https domain: delete the file and run init with --base https://your-domain.');
    const locPaths = new Set(smLocs.map((u) => { try { return normPath(new URL(u).pathname); } catch { return null; } }));
    for (const u of smLocs) { try { const p = normPath(new URL(u).pathname); if (!pages.some((pg) => pg.up === p) && !existsSync(join(site, decodeURI(new URL(u).pathname)))) sAdd('error', 'sitemap-dead', `sitemap lists a page that does not exist: ${u}`, 'Remove the URL or build the page.'); else if (pages.find((pg) => pg.up === p && noindex(pg))) sAdd('error', 'sitemap-noindex', `sitemap lists a noindex page: ${u}`, 'Remove it from the sitemap or drop noindex.'); } catch { /* reported above */ } }
    for (const p of indexable) if (!locPaths.has(p.up)) sAdd('error', 'sitemap-incomplete', `page ${p.page} is not in sitemap.xml`, 'Add it (or mark it noindex on purpose).');
    if (new Set(smLocs).size !== smLocs.length) sAdd('warn', 'sitemap-dup', 'sitemap lists a URL twice', 'List each URL once.');
  }
}

// robots.txt
const rbPath = join(site, 'robots.txt'); let disallow = [];
if (!existsSync(rbPath)) sAdd('error', 'robots-missing', 'no robots.txt', 'Run: seo-ready.mjs init <dir>.');
else {
  const lines = read(rbPath).split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
  if (!lines.some((l) => /^user-agent\s*:/i.test(l))) sAdd('error', 'robots-invalid', 'robots.txt has no User-agent line', 'Start with "User-agent: *".');
  let ua = []; let prevWasUa = false;
  for (const l of lines) {
    const m = l.match(/^([\w-]+)\s*:\s*(.*)$/); if (!m) { sAdd('error', 'robots-invalid', `robots.txt line not understood: "${l.slice(0, 40)}"`, 'Use "Field: value" lines.'); continue; }
    const k = m[1].toLowerCase();
    if (k === 'user-agent') { ua = prevWasUa ? [...ua, m[2]] : [m[2]]; prevWasUa = true; continue; }
    prevWasUa = false;
    if (k === 'disallow') { if (m[2] === '/' && ua.includes('*')) sAdd('error', 'robots-blocks-all', 'robots.txt blocks every crawler (Disallow: /)', 'Remove it, or limit it to private paths. Intended for a staging site only.'); if (m[2] === '/' && ua.some((u) => /^(?:gptbot|claudebot|claude-web|perplexitybot|google-extended|ccbot|oai-searchbot)$/i.test(u))) sAdd('info', 'robots-ai-blocked', `AI crawler(s) blocked: ${ua.join(', ')}`, 'Fine if intended; those answer engines will not cite the site.'); if (ua.includes('*') && m[2]) disallow.push(m[2]); }
    if (k === 'sitemap') { if (!origin(m[2])) sAdd('error', 'robots-sitemap', `Sitemap line is not an absolute URL: ${m[2]}`, 'Use https://your-domain/sitemap.xml.'); else if (siteOrigin && origin(m[2]) !== siteOrigin) sAdd('error', 'robots-sitemap', `robots.txt Sitemap origin ${origin(m[2])} differs from sitemap.xml origin ${siteOrigin}`, 'Use the same origin.'); }
  }
  if (!lines.some((l) => /^sitemap\s*:/i.test(l))) sAdd('warn', 'robots-no-sitemap', 'robots.txt has no Sitemap line', 'Add "Sitemap: https://your-domain/sitemap.xml".');
  for (const d of disallow) for (const p of indexable) if (p.up.startsWith(d.replace(/\*$/, '').replace(/\/$/, '') || '\0') && d !== '/') sAdd('warn', 'robots-vs-sitemap', `robots.txt disallows ${d} but page ${p.page} is in the sitemap`, 'Do not list blocked pages; crawlers cannot read them.');
}

// llms.txt
const llPath = join(site, 'llms.txt');
if (!existsSync(llPath)) sAdd('error', 'llms-missing', 'no llms.txt', 'Run: seo-ready.mjs init <dir>. It tells answer engines what the site is and which pages matter.');
else {
  const t = read(llPath); const first = t.split(/\r?\n/).find((l) => l.trim());
  if (!/^#\s+\S/.test(first ?? '')) sAdd('error', 'llms-invalid', 'llms.txt must start with "# Site name"', 'First line: "# Name", then a "> one-sentence summary".');
  if (!/^>\s*\S/m.test(t)) sAdd('warn', 'llms-summary', 'llms.txt has no "> summary" line', 'Add a one-sentence blockquote summary under the title.');
  if (PLACE.test(t)) sAdd('error', 'llms-placeholder', 'llms.txt contains a placeholder (UNKNOWN, SAMPLE, example.com...)', 'Fill in the real text or remove the line.');
  const links = [...t.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)].map((m) => m[2]);
  if (!links.length) sAdd('error', 'llms-empty', 'llms.txt lists no pages', 'Add "- [Title](url): what it is" lines.');
  const listed = new Set();
  for (const u of links) {
    let path; if (/^https?:/i.test(u)) { if (siteOrigin && origin(u) !== siteOrigin) continue; if (!siteOrigin && !origin(home ? canonOf(home)[0] ?? '' : '')) { unverified.push({ page: 'llms.txt', msg: `absolute link ${u}`, reason: 'site origin unknown (no sitemap or canonical)' }); continue; } if (!siteOrigin && origin(u) !== origin(canonOf(home)[0] ?? '')) continue; path = new URL(u).pathname; } else path = u.split('#')[0].split('?')[0];
    const p = normPath(path.startsWith('/') ? path : '/' + path);
    listed.add(p);
    if (!pagesAll.some((pg) => pg.up === p) && !existsSync(join(site, decodeURI(path.replace(/^\//, ''))))) sAdd('error', 'llms-dead', `llms.txt lists a page that does not exist: ${u}`, 'Remove the line or build the page.');
  }
  if (home && !listed.has(home.up)) sAdd('warn', 'llms-home', 'llms.txt does not list the home page', 'List "/" first.');
}

// Per page
const titles = new Map(); const descs = new Map();
const ECOMMERCE_BIZ = null; void ECOMMERCE_BIZ;
const LB = /^(?:LocalBusiness|Restaurant|CafeOrCoffeeShop|BarOrPub|Bakery|FoodEstablishment|Store|HairSalon|BeautySalon|HealthAndBeautyBusiness|ProfessionalService|Dentist|Physician|LodgingBusiness|Hotel|AutoRepair|GymOrHealthClub|SportsActivityLocation|EntertainmentBusiness|MusicVenue)$/;
const FOOD = /^(?:Restaurant|CafeOrCoffeeShop|BarOrPub|Bakery|FoodEstablishment)$/;
const strs = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (Array.isArray(o)) o.forEach((x) => strs(x, out)); else if (o && typeof o === 'object') Object.values(o).forEach((x) => strs(x, out)); return out; };
const has = (o, k) => o[k] !== undefined && o[k] !== null && o[k] !== '' && !(Array.isArray(o[k]) && !o[k].length);
const first1 = (v) => (Array.isArray(v) ? v[0] : v);
const iso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(v);

for (const p of pages) {
  const add = pf(p);
  if (!p.title) add('error', 'title-missing', 'no <title>', 'Add a short, specific title.'); else titles.set(p.title, [...(titles.get(p.title) ?? []), p.page]);
  const d = p.meta('name', 'description').trim(); if (d) descs.set(d, [...(descs.get(d) ?? []), p.page]);

  // Canonical
  const cs = canonOf(p);
  if (!cs.length) add('error', 'canonical-missing', 'no canonical link', `Add <link rel="canonical" href="${siteOrigin ?? 'https://your-domain'}${p.up}">.`);
  else {
    if (cs.length > 1) add('error', 'canonical-multiple', `${cs.length} canonical links`, 'Keep exactly one.');
    const c = cs[0];
    if (!origin(c)) add('error', 'canonical-relative', `canonical is not an absolute URL: ${c}`, 'Use https://your-domain/path.');
    else {
      if (/^http:/i.test(c)) add('error', 'canonical-scheme', `canonical is not https: ${c}`, 'Use https.');
      if (siteOrigin && origin(c) !== siteOrigin) add('error', 'canonical-origin', `canonical origin ${origin(c)} differs from the sitemap origin ${siteOrigin}`, 'Use one origin everywhere.');
      if (normPath(new URL(c).pathname) !== p.up) add('warn', 'canonical-other', `canonical points to ${new URL(c).pathname}, not this page (${p.up})`, 'Self-reference unless this page is a deliberate duplicate.');
    }
  }

  // Open Graph
  const og = (k) => p.meta('property', k);
  for (const k of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) if (!og(k)) add(k === 'og:type' ? 'info' : 'warn', 'og-missing', `missing ${k}`, `Add <meta property="${k}" content="...">.`);
  const img = og('og:image');
  if (img) {
    if (!origin(img)) add('warn', 'og-image-relative', `og:image is not an absolute URL: ${img}`, 'Use a full https URL; scrapers do not resolve relative paths.');
    else if (origin(img) === siteOrigin && !existsSync(join(site, decodeURI(new URL(img).pathname)))) add('error', 'og-image-dead', `og:image file not found: ${img}`, 'Add the image or fix the URL.');
  }
  if (og('og:url') && cs[0] && og('og:url') !== cs[0]) add('warn', 'og-url', `og:url (${og('og:url')}) differs from canonical (${cs[0]})`, 'Make them the same.');
  if (!p.meta('name', 'twitter:card')) add('info', 'twitter-card', 'no twitter:card', 'Optional: <meta name="twitter:card" content="summary_large_image">.');

  // JSON-LD
  const blocks = [...p.raw.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter((m) => /application\/ld\+json/i.test(attrsOf(m[1]).type ?? ''));
  const nodes = [];
  for (const b of blocks) {
    let j; try { j = JSON.parse(b[2]); } catch (e) { add('error', 'ld-invalid', `JSON-LD does not parse: ${e.message.slice(0, 60)}`, 'Fix the JSON (quotes, commas).'); continue; }
    const arr = Array.isArray(j) ? j : j['@graph'] ?? [j];
    for (const n of arr) if (n && typeof n === 'object') nodes.push(n);
  }
  if (!nodes.length && p === home) add('warn', 'ld-none', 'no JSON-LD structured data on the home page', 'Add the schema.org type that matches the business (Organization, LocalBusiness, MusicGroup, Product, Event).');
  const vis = p.text;
  for (const n of nodes) {
    const types = [].concat(n['@type'] ?? []); const T = types.join('/') || '(no @type)';
    if (!types.length) { add('error', 'ld-type', 'JSON-LD node without @type', 'Add "@type".'); continue; }
    if (!/^https?:\/\/schema\.org\/?$/.test(String(n['@context'] ?? 'https://schema.org')) && n['@context'] !== undefined && !String(n['@context']).includes('schema.org')) add('error', 'ld-context', `JSON-LD @context is ${n['@context']}`, 'Use "https://schema.org".');
    const need = (k, why) => { if (!has(n, k)) add('error', 'ld-required', `${T}: missing "${k}"${why ? ' (' + why + ')' : ''}`, `Add "${k}" with the real value, or remove the ${T} block if the fact is not known.`); };
    const rec = (k) => { if (!has(n, k)) add('warn', 'ld-recommended', `${T}: no "${k}"`, `Add "${k}" if the fact is known.`); };
    for (const s of strs(n)) if (PLACE.test(s)) { add('error', 'ld-placeholder', `${T}: placeholder or invented value "${s.slice(0, 50)}"`, 'Use the real value or remove the property. Unknown stays out of structured data.'); break; }
    if (types.some((t) => LB.test(t))) {
      need('name'); need('address');
      const a = first1(n.address); if (a && typeof a === 'object' && !(has(a, 'streetAddress') || has(a, 'addressLocality'))) add('error', 'ld-required', `${T}: address has no streetAddress or addressLocality`, 'Give a real street address or locality.');
      if (!(has(n, 'telephone') || has(n, 'url') || has(n, 'email'))) add('error', 'ld-required', `${T}: needs a telephone, url or email`, 'Add a real contact.');
      if (types.some((t) => FOOD.test(t))) rec('servesCuisine'); rec('openingHoursSpecification');
    }
    if (types.includes('MusicGroup')) { need('name'); if (!(has(n, 'url') || has(n, 'sameAs'))) add('error', 'ld-required', `${T}: needs url or sameAs`, 'Link the official page or profiles.'); }
    if (types.includes('Organization') || types.includes('NGO') || types.includes('Corporation')) { need('name'); need('url'); rec('logo'); }
    if (types.includes('Product')) {
      need('name'); const o = first1(n.offers);
      if (!o) add('warn', 'ld-recommended', 'Product: no "offers"', 'Add offers with price and priceCurrency, or leave it out until the price is real.');
      else { if (!(has(o, 'price') || has(o, 'lowPrice'))) add('error', 'ld-required', 'Product offer: missing price', 'Add the real price.'); if (!has(o, 'priceCurrency')) add('error', 'ld-required', 'Product offer: missing priceCurrency', 'Add the ISO currency code, for example EUR.'); const pr = o.price ?? o.lowPrice; if (pr !== undefined && !vis.includes(String(pr)) && !vis.includes(Number(pr).toLocaleString('en'))) add('warn', 'ld-price-visible', `Product price ${pr} is not visible on the page`, 'Structured data must match what visitors see.'); }
      rec('image');
    }
    if (types.includes('Event')) {
      need('name'); need('startDate'); if (has(n, 'startDate') && !iso(n.startDate)) add('error', 'ld-date', `Event startDate "${n.startDate}" is not ISO 8601`, 'Use 2026-05-01 or 2026-05-01T19:30:00+05:30.');
      if (has(n, 'endDate') && !iso(n.endDate)) add('error', 'ld-date', `Event endDate "${n.endDate}" is not ISO 8601`, 'Use ISO 8601.');
      need('location'); const l = first1(n.location); if (l && typeof l === 'object' && !(has(l, 'name') || has(l, 'address') || has(l, 'url'))) add('error', 'ld-required', 'Event location has no name, address or url', 'Name the venue or give the online url.');
    }
    // Invented trust signals
    const agg = n.aggregateRating; const reviews = [].concat(n.review ?? []);
    if (agg && typeof agg === 'object') {
      const rv = String(agg.ratingValue ?? ''); const rc = String(agg.reviewCount ?? agg.ratingCount ?? '');
      if (!rv || !rc) add('error', 'ld-invented-rating', `${T}: aggregateRating without ratingValue and reviewCount/ratingCount`, 'Remove it. Ratings need real numbers from a real source.');
      else if (!vis.includes(rv) || !new RegExp(`\\b${rc.replace(/\D/g, '')}\\b`).test(vis)) add('error', 'ld-invented-rating', `${T}: aggregateRating (${rv} from ${rc}) is not shown on the page, so it has no visible source`, 'FAIL: remove it, or show the rating, the count and where it comes from on the page.');
    }
    for (const r of reviews) { if (!r || typeof r !== 'object') continue; const body = String(r.reviewBody ?? ''); if (!body || !vis.includes(body.slice(0, 40)) || !r.author) add('error', 'ld-invented-rating', `${T}: review without a visible body and author on the page`, 'FAIL: remove it, or show the real review and its author on the page.'); }
  }
}
for (const [t, ps] of titles) if (ps.length > 1) for (const pg of ps) pf({ page: pg })('error', 'title-duplicate', `title "${t}" is also used on ${ps.filter((x) => x !== pg).join(', ')}`, 'Give every page its own title.');
for (const [t, ps] of descs) if (ps.length > 1) for (const pg of ps) pf({ page: pg })('warn', 'description-duplicate', `meta description is also used on ${ps.filter((x) => x !== pg).join(', ')}`, 'Write a different description per page.');
if (!pages.length) unverified.push({ page: '(site)', msg: 'no .html files found', reason: 'nothing to check' });
unverified.push({ page: '(site)', msg: 'indexing, rich results and answer-engine citations', reason: 'static files only: nothing here proves a search or answer engine will index or cite the site; use the search engines own validators after deploy' });
if (S.length) byPage.unshift({ page: '(site)', findings: S });

const cnt = (fs, s) => fs.filter((f) => f.sev === s).length;
const out = byPage.map((r) => ({ page: r.page, errors: cnt(r.findings, 'error'), warnings: cnt(r.findings, 'warn'), findings: r.findings }));
const E = out.reduce((n, p) => n + p.errors, 0), W = out.reduce((n, p) => n + p.warnings, 0), U = unverified.length;
const summary = `seo-ready: ${E} error(s), ${W} warning(s), ${U} unverified`;
if (json) console.log(JSON.stringify({ site: rel(site) || '.', pages: out, unverified, summary: { errors: E, warnings: W, unverified: U } }, null, 2));
else {
  console.log(`SEO and answer-engine readiness for ${site}\n`);
  const rank = { error: 0, warn: 1, info: 2 };
  for (const p of out) {
    console.log(`${p.page}: ${p.errors} error(s), ${p.warnings} warning(s)`);
    for (const f of [...p.findings].sort((a, b) => rank[a.sev] - rank[b.sev])) console.log(`  ${f.sev === 'error' ? 'ERROR' : f.sev === 'warn' ? 'warn ' : 'info '} [${f.id}] ${f.msg}\n        fix: ${f.fix}`);
    if (!p.findings.length) console.log('  no findings');
  }
  console.log('\nUNVERIFIED'); for (const u of unverified) console.log(`  ${u.page}: ${u.msg}: ${u.reason}`);
  console.log(`\n${summary}`);
}
process.exit(E > 0 ? 1 : 0);
