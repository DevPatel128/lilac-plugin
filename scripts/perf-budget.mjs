#!/usr/bin/env node
// perf-budget.mjs check <dir> [--profile mobile] [--json]
// Static performance budgets read from the HTML/CSS/JS on disk. Offline, no browser, no installs, no network. Exit 1 over budget, 2 bad usage.
// Checks: JS gzip total, CSS gzip total, HTML size per page, requests visible in the markup, render-blocking scripts, <img> without width/height,
// images below the first without loading=lazy, lazy on the first image (hurts LCP), @font-face without font-display, third-party scripts.
// shortcut: regex scan of markup, not a DOM parser; it sees files on disk only (no CDN or response headers), so real numbers (Lighthouse, field data) can differ. UNVERIFIED against a real load.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

// STARTING numbers, not measurements. Replace them with numbers measured on the real site (Lighthouse, field data) once it is live.
export const budgets = {
  default: { jsGzipKB: 170, cssGzipKB: 60, htmlKB: 100, requests: 40, renderBlockingScripts: 0, imagesNoDimensions: 0, imagesNotLazy: 0, firstImageLazy: 0, fontsNoDisplay: 0, thirdPartyScripts: 2 },
  mobile: { jsGzipKB: 100, cssGzipKB: 40, htmlKB: 60, requests: 25, renderBlockingScripts: 0, imagesNoDimensions: 0, imagesNotLazy: 0, firstImageLazy: 0, fontsNoDisplay: 0, thirdPartyScripts: 1 },
};

const args = process.argv.slice(2);
const pi = args.indexOf('--profile');
const profile = pi < 0 ? 'default' : args[pi + 1];
const json = args.includes('--json');
const dir = args.find((a, i) => i > 0 && !a.startsWith('--') && args[i - 1] !== '--profile');
if (args[0] !== 'check' || !dir || !budgets[profile] || !existsSync(dir) || !statSync(dir).isDirectory()) { console.error('usage: perf-budget.mjs check <dir> [--profile mobile] [--json]'); process.exit(2); }
const root = resolve(dir), B = budgets[profile];

const walk = (d, o = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', '.lilac'].includes(e.name)) continue; const p = join(d, e.name); e.isDirectory() ? walk(p, o) : o.push(p); } return o; };
const gz = (s) => gzipSync(s).length;
const attrs = (tag) => { const o = {}; for (const m of tag.matchAll(/([a-zA-Z:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) o[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''; return o; };
const external = (u) => /^(https?:)?\/\//i.test(u);
const local = (page, u) => { if (!u || external(u) || /^(data:|blob:|#)/.test(u)) return null; const p = u.split(/[?#]/)[0]; const f = p.startsWith('/') ? join(root, p) : join(dirname(page), p); return existsSync(f) && statSync(f).isFile() ? f : null; };

const pages = walk(root).filter((f) => f.endsWith('.html'));
if (!pages.length) { console.error('perf-budget: no .html files under ' + dir); process.exit(2); }
const js = new Map(), css = new Map(); let inlineJs = 0, inlineCss = 0, cnt = { rb: 0, nodim: 0, notlazy: 0, firstlazy: 0, font: 0, third: 0 }, reqs = 0;
const rows = [], detail = [];
const scanCss = (src, where) => { for (const m of src.matchAll(/@font-face\s*{[^}]*}/gi)) if (!/font-display\s*:/i.test(m[0])) { cnt.font++; detail.push(`@font-face without font-display in ${where}`); } };

for (const page of pages) {
  const html = readFileSync(page, 'utf8'), rel = page.slice(root.length + 1); let seen = 0;
  rows.push({ page: rel, htmlKB: +(Buffer.byteLength(html) / 1024).toFixed(1) });
  if (Buffer.byteLength(html) / 1024 > B.htmlKB) detail.push(`${rel}: HTML ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB > ${B.htmlKB}`);
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const a = attrs(m[1]);
    if (a.src === undefined) { if (!/json|ld\+/.test(a.type ?? '')) inlineJs += gz(m[2]); continue; }
    reqs++;
    if (external(a.src)) { if (!('async' in a) && !('defer' in a) && a.type !== 'module') { cnt.third++; detail.push(`${rel}: third-party script blocks parsing: ${a.src}`); } else if (!('integrity' in a) && !('async' in a) && !('defer' in a)) cnt.third++; continue; }
    if (!('async' in a) && !('defer' in a) && a.type !== 'module') { cnt.rb++; detail.push(`${rel}: render-blocking script ${a.src}`); }
    const f = local(page, a.src); if (f) js.set(f, gz(readFileSync(f)));
  }
  for (const m of html.matchAll(/<link\b([^>]*)>/gi)) {
    const a = attrs(m[1]); if (!a.href) continue;
    if (/stylesheet/i.test(a.rel ?? '')) { reqs++; const f = local(page, a.href); if (f) { css.set(f, gz(readFileSync(f))); scanCss(readFileSync(f, 'utf8'), a.href); } }
    else if (/preload|icon/i.test(a.rel ?? '')) reqs++;
  }
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) { inlineCss += gz(m[1]); scanCss(m[1], rel + ' <style>'); }
  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    const a = attrs(m[1]); const first = seen++ === 0; if (!/^data:/.test(a.src ?? '')) reqs++;
    if (!a.width || !a.height) { cnt.nodim++; detail.push(`${rel}: <img ${a.src ?? '?'}> lacks width/height`); }
    const lazy = a.loading === 'lazy';
    if (first && lazy) { cnt.firstlazy++; detail.push(`${rel}: first image is loading=lazy (likely LCP): ${a.src ?? '?'}`); }
    if (!first && !lazy) { cnt.notlazy++; detail.push(`${rel}: image below the first lacks loading=lazy: ${a.src ?? '?'}`); }
  }
}
const jsKB = ([...js.values()].reduce((s, n) => s + n, 0) + inlineJs) / 1024, cssKB = ([...css.values()].reduce((s, n) => s + n, 0) + inlineCss) / 1024;
const maxHtml = Math.max(...rows.map((r) => r.htmlKB));
const checks = [
  ['total JS gzip KB', +jsKB.toFixed(1), B.jsGzipKB], ['total CSS gzip KB', +cssKB.toFixed(1), B.cssGzipKB], ['largest HTML page KB', maxHtml, B.htmlKB],
  ['requests seen in markup (all pages)', reqs, B.requests * pages.length], ['render-blocking scripts', cnt.rb, B.renderBlockingScripts], ['images without width/height', cnt.nodim, B.imagesNoDimensions],
  ['images below the first without loading=lazy', cnt.notlazy, B.imagesNotLazy], ['first image with loading=lazy', cnt.firstlazy, B.firstImageLazy], ['@font-face without font-display', cnt.font, B.fontsNoDisplay], ['unbounded third-party scripts', cnt.third, B.thirdPartyScripts],
].map(([name, value, max]) => ({ name, value, max, ok: value <= max }));
const bad = checks.filter((c) => !c.ok);
if (json) console.log(JSON.stringify({ profile, pages: pages.length, checks, detail }, null, 2));
else {
  console.log(`perf-budget (${profile}, ${pages.length} page(s)); budgets are starting numbers, replace with measured ones`);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}: ${c.value} (budget ${c.max})`);
  if (bad.length) { console.log('\nDetail:'); for (const d of detail.slice(0, 40)) console.log('  ' + d); }
  console.log(bad.length ? `\n${bad.length} budget(s) exceeded.` : '\nAll budgets met. UNVERIFIED: real load time, CDN and headers.');
}
process.exit(bad.length ? 1 : 0);
