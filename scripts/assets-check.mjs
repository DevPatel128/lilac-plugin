#!/usr/bin/env node
// Lilac assets check: every media, model and font file under the site must be listed in assets/LICENSES.md.
// Usage: node scripts/assets-check.mjs check <dir>
// Table columns: file | source | licence | commercial-use (yes/no/UNKNOWN) | ai-generated (yes/no). Optional notes column may carry "real-person" and "consent: <reference>".
// FAIL on: an unlisted asset, UNKNOWN licence or commercial-use at a commercial site, an AI-generated asset from a non-commercial tier (source "tripo" on a free tier),
// and an AI-generated real-person image with no "consent:" reference.
// Commercial site: BRIEF.md has no line "Commercial: no" (default is commercial, the strict side).
// Offline, read only. Exit 0 pass, 1 problems, 2 usage.
// shortcut: markdown table parsed by position, one row per file; a file is matched by its path relative to the site or by its basename.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative, basename } from 'node:path';

const ASSET = /\.(png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|mov|mp3|wav|ogg|glb|gltf|usdz|splat|ply|ksplat|riv|lottie|woff2?|ttf|otf|eot)$/i;
const walk = (d, out = []) => { for (const e of readdirSync(d)) { if (e.startsWith('.') || e === 'node_modules') continue; const p = join(d, e), s = statSync(p); s.isDirectory() ? walk(p, out) : out.push(p); } return out; };

export function check(dir) {
  const problems = [], lic = join(dir, 'assets', 'LICENSES.md');
  const assets = walk(dir).map((f) => relative(dir, f)).filter((f) => ASSET.test(f));
  const brief = existsSync(join(dir, 'BRIEF.md')) ? readFileSync(join(dir, 'BRIEF.md'), 'utf8') : '';
  const commercial = !/^[\s>*-]*commercial\s*:\s*\W*no\b/im.test(brief);
  const rows = new Map();
  if (existsSync(lic)) for (const line of readFileSync(lic, 'utf8').split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const c = line.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
    if (c.length < 5 || /^[-: ]+$/.test(c[0]) || /^file$/i.test(c[0])) continue;
    rows.set(c[0].replace(/^`|`$/g, '').replace(/^\.?\//, ''), { source: c[1], licence: c[2], com: c[3], ai: c[4], notes: c.slice(5).join(' ') });
  }
  else if (assets.length) problems.push('assets/LICENSES.md is missing');
  for (const a of assets) {
    if (a === 'assets/LICENSES.md') continue;
    const r = rows.get(a) ?? rows.get(a.replace(/^assets\//, '')) ?? rows.get(basename(a));
    if (!r) { problems.push(`${a}: not listed in assets/LICENSES.md`); continue; }
    if (commercial && (/unknown/i.test(r.licence) || /unknown/i.test(r.com))) problems.push(`${a}: licence or commercial-use is UNKNOWN at a commercial site`);
    else if (commercial && /^no\b/i.test(r.com)) problems.push(`${a}: commercial-use is "no" but the site is commercial`);
    const ai = /^yes/i.test(r.ai);
    if (ai && /tripo/i.test(r.source) && /free/i.test(`${r.source} ${r.licence}`)) problems.push(`${a}: AI-generated on a non-commercial tier (${r.source}); regenerate on a paid tier or replace it`);
    if (ai && /real[- ]person/i.test(`${r.notes} ${r.source}`) && !/consent:\s*\S+/i.test(`${r.notes} ${r.source}`)) problems.push(`${a}: AI-generated image of a real person with no "consent: <reference>" recorded`);
  }
  return { assets: assets.filter((a) => a !== 'assets/LICENSES.md'), commercial, problems };
}

if (process.argv[1]?.endsWith('assets-check.mjs')) {
  const [cmd, d] = process.argv.slice(2);
  if (cmd !== 'check' || !d) { console.error('usage: assets-check.mjs check <dir>'); process.exit(2); }
  const dir = resolve(d);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) { console.error(`assets-check: not a directory: ${dir}`); process.exit(2); }
  const r = check(dir);
  console.log(`assets-check: ${r.assets.length} asset(s), ${r.commercial ? 'commercial' : 'non-commercial'} site`);
  r.problems.forEach((p) => console.log(`  FAIL: ${p}`));
  console.log(r.problems.length ? `${r.problems.length} problem(s)` : 'PASS');
  process.exit(r.problems.length ? 1 : 0);
}
