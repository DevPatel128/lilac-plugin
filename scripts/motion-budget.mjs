#!/usr/bin/env node
// Lilac motion budget: checks a site against its motion tier (none, subtle, expressive, immersive).
// Usage: node scripts/motion-budget.mjs check <dir> [--tier none|subtle|expressive|immersive]
// Tier comes from --tier, else the "Motion:" line in <dir>/BRIEF.md (none/subtle/expressive; immersive only when the brief says so).
// Sums the gzip size of local motion JS it can identify (gsap, three, lottie, rive, spark, model-viewer, by file name or import) and fails over the tier budget.
// At every tier, if 3D is present: static poster with alt, a "skip 3D" control, keyboard camera controls, reduced-motion handling, a WebGPU -> WebGL2 -> poster check,
// and no canvas or model-viewer as the first large element in <main> (LCP).
// Offline, read only. Exit 0 pass, 1 problems, 2 usage.
// shortcut: regex scan, not a parser; remote (CDN) libraries cannot be sized offline and are reported as UNKNOWN size, vendor them to count them. Immersive budget is a default set here, not from the plan.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

// gzip KB budgets for motion JS. none = no motion JS at all. immersive loads lazily after LCP; 600 is a Lilac default, tune it in one place.
export const BUDGET_KB = { none: 0, subtle: 30, expressive: 80, immersive: 600 };
const LIBS = { gsap: /gsap|scrolltrigger/i, three: /three(\.module)?\.|three\/|three-/i, lottie: /lottie/i, rive: /\brive\b|rive-/i, spark: /spark(js)?[.\-/]|sparkjs/i, 'model-viewer': /model-viewer/i };
const IN_JS = /\b(requestAnimationFrame|gsap\.|\.animate\()/;
const THREE_D = /<model-viewer|<canvas|\bTHREE\.|from\s+['"][^'"]*three|webglrenderer|webgpurenderer/i;

const walk = (d, out = []) => { for (const e of readdirSync(d)) { if (e.startsWith('.') || e === 'node_modules') continue; const p = join(d, e), s = statSync(p); s.isDirectory() ? walk(p, out) : out.push(p); } return out; };
const libOf = (s) => Object.keys(LIBS).find((k) => LIBS[k].test(s));

export function check(dir, tier) {
  const files = walk(dir), rel = (f) => relative(dir, f);
  const read = (f) => readFileSync(f, 'utf8');
  const html = files.filter((f) => /\.html?$/i.test(f)), js = files.filter((f) => /\.(m?js)$/i.test(f)), css = files.filter((f) => /\.css$/i.test(f));
  const problems = [], notes = [], libs = [];
  let kb = 0;
  for (const f of js) {
    const lib = libOf(rel(f)); if (!lib) continue;
    const g = gzipSync(readFileSync(f)).length / 1024; kb += g; libs.push(`${rel(f)} (${lib}, ${g.toFixed(1)} KB gz)`);
  }
  let inlineMotion = false, remote = [];
  for (const f of html) {
    const h = read(f);
    for (const m of h.matchAll(/<script\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["']/gi)) { const lib = libOf(m[1]); if (lib) remote.push(`${rel(f)}: ${m[1]} (${lib})`); }
    for (const m of h.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) { if (IN_JS.test(m[1]) || libOf(m[1].match(/import[^;]*from\s*['"][^'"]+['"]/g)?.join(' ') || '')) inlineMotion = true; kb += gzipSync(m[1]).length / 1024 * (libOf(m[1]) ? 1 : 0); }
  }
  for (const f of js) if (!libOf(rel(f)) && IN_JS.test(read(f))) inlineMotion = true;
  const budget = BUDGET_KB[tier];
  if (tier === 'none' && (libs.length || remote.length || inlineMotion)) problems.push(`tier none allows no motion JS; found ${[...libs, ...remote, inlineMotion ? 'custom animation code (requestAnimationFrame/animate/gsap)' : ''].filter(Boolean).join('; ')}`);
  else if (kb > budget) problems.push(`motion JS is ${kb.toFixed(1)} KB gzip, over the ${tier} budget of ${budget} KB`);
  for (const r of remote) notes.push(`remote motion library, size UNKNOWN (vendor it to count it): ${r}`);

  const all = [...html, ...js, ...css].map(read).join('\n');
  const has3d = THREE_D.test(all) && (/<model-viewer|<canvas|THREE\.|webglrenderer|webgpurenderer/i.test(all) || libs.some((l) => /three|spark|model-viewer/.test(l)));
  if (has3d) {
    if (tier !== 'immersive') problems.push(`3D content found but the tier is ${tier}; real-time 3D needs tier immersive (set "Motion: immersive" in the brief)`);
    const hasPoster = /<model-viewer\b[^>]*\bposter=["'][^"']+["']/i.test(all) || /<img\b[^>]*(class|id)=["'][^"']*poster[^"']*["']/i.test(all);
    const altOk = [...all.matchAll(/<(?:img|model-viewer)\b[^>]*>/gi)].some((m) => /poster/i.test(m[0]) && /\balt=["'][^"']*\S[^"']*["']/i.test(m[0]));
    if (!hasPoster) problems.push('3D has no static poster (model-viewer poster="..." or an <img class="poster">)'); else if (!altOk) problems.push('3D poster has no non-empty alt text');
    if (!/<(button|a)\b[^>]*>[^<]*skip 3d/i.test(all)) problems.push('no "skip 3D" control (button or link with text "Skip 3D")');
    if (!/camera-controls|keydown|keyup|listenToKeyEvents/i.test(all)) problems.push('no keyboard camera controls (camera-controls attribute or a keydown handler)');
    if (!/prefers-reduced-motion\s*:\s*reduce/i.test(all)) problems.push('no @media (prefers-reduced-motion: reduce) rule or matchMedia check to stop autoplay and camera motion');
    else if (/\bauto-rotate\b|\bautoplay\b/i.test(all) && !/matchMedia\(\s*['"]\(prefers-reduced-motion/i.test(all) && !/prefers-reduced-motion[^}]*\{[^}]*(animation|auto-rotate|transition)/i.test(all)) problems.push('autoplay or auto-rotate is set but nothing disables it under prefers-reduced-motion');
    if (!(/navigator\.gpu|webgpu/i.test(all) && /webgl2/i.test(all))) problems.push('no WebGPU -> WebGL2 -> poster feature check (look for navigator.gpu and webgl2 in the code)');
  }
  for (const f of html) {
    const main = read(f).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]; if (!main) continue;
    const first = main.match(/<(canvas|model-viewer|img|h1|video|picture|svg)\b/i)?.[1]?.toLowerCase();
    if (first === 'canvas' || first === 'model-viewer') problems.push(`${rel(f)}: <${first}> is the first large element in <main>, so it becomes the LCP candidate; put a heading or poster image first and load 3D after LCP`);
  }
  return { tier, kb, budget, libs, notes, has3d, problems };
}

function tierFromBrief(dir) {
  const p = join(dir, 'BRIEF.md'); if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8').match(/^[\s>*-]*motion\s*:\s*\W*(none|subtle|expressive|immersive)\b/im)?.[1].toLowerCase() ?? null;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('motion-budget.mjs')) {
  const a = process.argv.slice(2), usage = () => { console.error('usage: motion-budget.mjs check <dir> [--tier none|subtle|expressive|immersive]'); process.exit(2); };
  if (a[0] !== 'check' || !a[1]) usage();
  const dir = resolve(a[1]), ti = a.indexOf('--tier');
  if (!existsSync(dir) || !statSync(dir).isDirectory()) { console.error(`motion-budget: not a directory: ${dir}`); process.exit(2); }
  const tier = ti > -1 ? a[ti + 1] : tierFromBrief(dir);
  if (!(tier in BUDGET_KB)) { console.error(`motion-budget: ${tier ? `unknown tier "${tier}"` : 'no --tier and no "Motion:" line in BRIEF.md'}`); process.exit(2); }
  const r = check(dir, tier);
  console.log(`motion-budget: tier ${r.tier}, motion JS ${r.kb.toFixed(1)} KB gzip of ${r.budget} KB, 3D ${r.has3d ? 'present' : 'absent'}`);
  r.libs.forEach((l) => console.log(`  lib: ${l}`)); r.notes.forEach((n) => console.log(`  note: ${n}`));
  r.problems.forEach((p) => console.log(`  FAIL: ${p}`));
  console.log(r.problems.length ? `${r.problems.length} problem(s)` : 'PASS');
  process.exit(r.problems.length ? 1 : 0);
}
