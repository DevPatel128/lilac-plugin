#!/usr/bin/env node
// NETWORK TOOL (fetch only): runs only on URLs the user approved, only with --consent. Never at install, never in a hook.
// Lilac references: take design TOKENS (colours, fonts, spacing, radius, heading scale) from sites the user likes. Never their words, images, logos or code.
// Usage: node scripts/references.mjs plan <dir> --urls u1,u2,u3          prints the URLs it would fetch (the consent screen); fetches nothing
//        node scripts/references.mjs fetch <dir> --urls u1,u2 --consent  saves each page to <dir>/design/raw/; refuses without --consent
//        node scripts/references.mjs extract <dir>                       offline: reads <dir>/design/raw/*.html, writes design/DESIGN.md, design/tokens.json, design/NOTES.md
//        node scripts/references.mjs load <dir> <pattern-name>           prints <dir>/library/<pattern-name>.md if a local library exists, else "no library entry"
// fetch: http/https only, 10 s timeout, 1 MB cap, generic user agent "lilac-references", redirects re-checked (max 3), private/loopback hosts refused,
//   every request appended (URL + time, no query string) to <dir>/.lilac/network.log. --allow-loopback works ONLY with LILAC_TEST=1 (the test server).
// extract reads CSS (style blocks, style attributes) only; page text is never parsed into output, and an assertion refuses to write if any source sentence appears in it.
// Dependency-free: node built-ins only. Writes through lib/safe-fs.mjs.
// shortcut: linked stylesheets are not fetched (inline CSS only), so sites that ship all CSS externally give few tokens; upgrade by allowing .css URLs in the consent list.
// shortcut: DNS is checked before fetch, not pinned to the connection; a rebinding race is possible, upgrade with a pinned lookup if the target list is untrusted.
import { existsSync, readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { lookup } from 'node:dns/promises';
import { pathToFileURL } from 'node:url';
import { scoped } from '../lib/safe-fs.mjs';

const MAX = 1024 * 1024, TIMEOUT = 10000, UA = 'lilac-references';
const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'inherit', 'initial', 'unset', '-apple-system', 'blinkmacsystemfont']);

export function parseUrls(s) {
  const urls = String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  for (const u of urls) { let p; try { p = new URL(u); } catch { throw new Error(`not a URL: ${u}`); } if (!/^https?:$/.test(p.protocol)) throw new Error(`only http/https allowed: ${u}`); }
  return urls;
}
const privateIp = (ip) => {
  if (ip.includes(':')) { const l = ip.toLowerCase(); return l === '::1' || l === '::' || /^(fc|fd|fe[89ab])/.test(l) || (l.startsWith('::ffff:') && privateIp(l.slice(7))); }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};
async function assertPublic(u, allowLoopback) {
  const h = u.hostname.replace(/^\[|\]$/g, '');
  if (allowLoopback && (h === 'localhost' || h === '::1' || /^127\./.test(h))) return; // test servers only
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) throw new Error(`private host refused: ${h}`);
  const addrs = /^[\d.]+$|:/.test(h) ? [{ address: h }] : await lookup(h, { all: true });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error(`private address refused: ${h}`);
}
export async function fetchOne(url, { allowLoopback = false } = {}) {
  let u = new URL(url);
  for (let hop = 0; hop < 4; hop++) {
    if (!/^https?:$/.test(u.protocol)) throw new Error(`only http/https allowed: ${u.protocol}`);
    await assertPublic(u, allowLoopback);
    const r = await fetch(u, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(TIMEOUT) });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { u = new URL(r.headers.get('location'), u); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const chunks = []; let n = 0;
    for await (const c of r.body) { n += c.length; if (n > MAX) throw new Error('over the 1 MB cap'); chunks.push(c); }
    return Buffer.concat(chunks).toString('utf8');
  }
  throw new Error('too many redirects');
}
const slug = (u) => (new URL(u).hostname + new URL(u).pathname).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'page';

// ---- extract: CSS tokens only ----
const hex6 = (h) => { h = h.toLowerCase(); return h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h.slice(0, 7); };
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const sat = (h) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(...v) - Math.min(...v); };
const tally = (arr) => { const m = new Map(); for (const x of arr) m.set(x, (m.get(x) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
function cssOf(html) {
  const blocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const attrs = [...html.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)].map((m) => `x{${m[1]}}`);
  return blocks.concat(attrs).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
}
const colours = (css) => tally([...css.matchAll(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map((m) => hex6(m[0])));
export function tokensOf(html) {
  const css = cssOf(html);
  const dm = [...css.matchAll(/@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{([\s\S]*?\})\s*\}/gi)].map((m) => m[1]).join('\n');
  const light = css.replace(dm, '');
  const px = (re) => tally([...css.matchAll(re)].flatMap((m) => [...m[1].matchAll(/(\d+(?:\.\d+)?)px/g)].map((x) => Number(x[1])).filter((n) => n > 0)));
  const sp = px(/(?:padding|margin|gap)[a-z-]*\s*:\s*([^;}]+)/gi), rad = px(/border-radius\s*:\s*([^;}]+)/gi);
  const heads = {};
  for (const m of css.matchAll(/(?:^|[},\s])(h[1-6])\s*\{([^}]*)\}/gi)) { const f = /font-size\s*:\s*([\d.]+(?:px|rem|em))/i.exec(m[2]); if (f) heads[m[1].toLowerCase()] = f[1]; }
  const fonts = tally([...css.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map((m) => m[1].split(',')[0].replace(/['"]/g, '').trim()).filter((f) => f && !GENERIC.has(f.toLowerCase()) && !f.startsWith('var(')));
  const mode = (c) => {
    const l = c.map(([h]) => h); if (!l.length) return null;
    const byL = [...l].sort((a, b) => lum(a) - lum(b));
    return { background: null, text: byL[0], surface: null, accent: [...l].sort((a, b) => sat(b) - sat(a))[0], all: c.slice(0, 8).map(([h, n]) => ({ hex: h, uses: n })), _l: byL };
  };
  const L = mode(colours(light)), D = dm ? mode(colours(dm)) : null;
  if (L) { L.background = L._l[L._l.length - 1]; L.surface = L._l[L._l.length - 2] || L.background; }
  if (D) { D.background = D._l[0]; D.text = D._l[D._l.length - 1]; D.surface = D._l[1] || D.background; }
  for (const x of [L, D]) if (x) delete x._l;
  const base = sp.length ? Math.min(...sp.slice(0, 5).map(([n]) => n)) : null;
  return { colours: { light: L, dark: D }, fonts: fonts.slice(0, 3).map(([f]) => f), spacingBase: base, spacingSeen: sp.slice(0, 6).map(([n]) => n), radius: rad.slice(0, 3).map(([n]) => n), headings: heads };
}
const sentences = (html) => html.replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, '\n').split(/[\n.!?]+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.split(' ').length >= 4);
export function assertNoText(outputs, htmls) {
  const out = outputs.join('\n').toLowerCase();
  for (const h of htmls) for (const s of sentences(h)) if (out.includes(s.toLowerCase())) throw new Error(`refusing: source sentence found in output: "${s.slice(0, 40)}"`);
}
const row = (c) => (c ? `| ${c.hex} | ${c.uses} |` : '');
function designMd(name, t) {
  const L = t.colours.light, D = t.colours.dark, md = [`# Design tokens: ${name}`, '', 'Derived from CSS only (SAMPLE reading: frequency, not intent). Roles are guesses; check them by eye.', ''];
  const sec = (title, c) => { if (!c) return; md.push(`## Colour (${title})`, '', `Background ${c.background}, surface ${c.surface}, text ${c.text}, accent ${c.accent}.`, '', '| Hex | Uses |', '|---|---|', ...c.all.map(row), ''); };
  sec('light', L); sec('dark', D);
  if (!L && !D) md.push('## Colour', '', 'UNKNOWN: no hex colours in inline CSS.', '');
  md.push('## Typography', '', t.fonts.length ? t.fonts.map((f) => `- ${f}`).join('\n') : 'UNKNOWN: no named font in inline CSS.', '', 'Heading scale: ' + (Object.keys(t.headings).length ? Object.entries(t.headings).map(([k, v]) => `${k} ${v}`).join(', ') : 'UNKNOWN'), '');
  md.push('## Spacing and radius', '', `Base spacing: ${t.spacingBase ?? 'UNKNOWN'}px (seen: ${t.spacingSeen.join(', ') || 'none'}). Radius: ${t.radius.length ? t.radius.join(', ') + 'px' : 'UNKNOWN'}.`, '');
  return md.join('\n');
}
function extract(dir) {
  const raw = join(dir, 'design', 'raw');
  const files = existsSync(raw) ? readdirSync(raw).filter((f) => /\.html?$/i.test(f)).sort() : [];
  if (!files.length) { console.error(`references: no saved HTML in ${raw}; run fetch first`); process.exit(1); }
  const htmls = files.map((f) => readFileSync(join(raw, f), 'utf8')), per = htmls.map(tokensOf);
  const merged = tokensOf(htmls.join('\n'));
  const notes = ['# References: take / do not take', '', ...files.flatMap((f, i) => [`## ${f}`, '', `- Take: colours ${(per[i].colours.light?.all || []).slice(0, 3).map((c) => c.hex).join(', ') || 'UNKNOWN'}; fonts ${per[i].fonts.join(', ') || 'UNKNOWN'}; base spacing ${per[i].spacingBase ?? 'UNKNOWN'}px.`, '- Do not take: their words, images, logos, icons, layout code or brand name. Write your own copy and use your own assets.', ''])].join('\n');
  const dm = designMd('your references', merged), tj = JSON.stringify({ sources: files, ...merged }, null, 2) + '\n';
  assertNoText([dm, tj, notes], htmls);
  const w = scoped(dir);
  w.write('design/DESIGN.md', dm); w.write('design/tokens.json', tj); w.write('design/NOTES.md', notes + '\n');
  console.log(`references: wrote design/DESIGN.md, design/tokens.json, design/NOTES.md from ${files.length} page(s)`);
}

async function main(a) {
  const [cmd, dir] = a, flag = (k) => (a.indexOf(k) >= 0 ? a[a.indexOf(k) + 1] : undefined);
  if (!cmd || !dir) { console.error('usage: references.mjs plan|fetch|extract|load <dir> ...'); process.exit(2); }
  if (cmd === 'plan' || cmd === 'fetch') {
    const urls = parseUrls(flag('--urls'));
    if (!urls.length) { console.error('references: --urls is required'); process.exit(2); }
    if (cmd === 'plan') { console.log(`Lilac would fetch ${urls.length} page(s), one request each, inline CSS only:`); urls.forEach((u) => console.log(`  ${u}`)); console.log('Nothing is fetched until you approve and run fetch with --consent.'); return; }
    if (!a.includes('--consent')) { console.error('references: refusing to fetch without --consent (show the URL list and ask first)'); process.exit(1); }
    const loop = a.includes('--allow-loopback');
    if (loop && process.env.LILAC_TEST !== '1') { console.error('references: --allow-loopback is only for tests (LILAC_TEST=1)'); process.exit(1); }
    const w = scoped(dir); let bad = 0;
    for (const u of urls) {
      const p = new URL(u); p.search = ''; p.hash = '';
      w.mkdir('.lilac'); appendFileSync(join(dir, '.lilac', 'network.log'), `${new Date().toISOString()} GET ${p.href}\n`);
      try { w.write(`design/raw/${slug(u)}.html`, await fetchOne(u, { allowLoopback: loop })); console.log(`ok   ${p.href}`); } catch (e) { bad++; console.error(`FAIL ${p.href}: ${e.message}`); }
    }
    process.exit(bad ? 1 : 0);
  }
  if (cmd === 'extract') return extract(dir);
  if (cmd === 'load') {
    const name = a[2] || '';
    if (!/^[\w-]+$/.test(name)) { console.error('references: pattern name must be letters, digits, - or _'); process.exit(2); }
    const f = join(dir, 'library', `${name}.md`);
    console.log(existsSync(f) ? readFileSync(f, 'utf8') : 'no library entry');
    return;
  }
  console.error(`references: unknown command ${cmd}`); process.exit(2);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).catch((e) => { console.error(`references: ${e.message}`); process.exit(1); });
