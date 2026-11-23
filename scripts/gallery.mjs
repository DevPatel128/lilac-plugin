#!/usr/bin/env node
// Lilac gallery: an honest page of example sites. Reads each example folder's README.md and RESULTS.md and writes GALLERY.md.
// Usage: node scripts/gallery.mjs <examplesDir> [--out GALLERY.md]     (default out: <examplesDir>/GALLERY.md)
// Honesty rules: RESULTS.md content is copied word for word (tables, failures, warnings, accepted risks, Needs people); only its headings move
// down three levels so they nest under the example. Nothing is rounded, hidden, summarised or computed. No RESULTS.md means "no results recorded".
// Offline and dependency-free: reads files, writes one file.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { scoped } from '../lib/safe-fs.mjs';
import { basename } from 'node:path';
import { join, resolve, relative, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const HEADER = 'Fictional samples; simulated visitors are not real users; no conversion claims';
const args = process.argv.slice(2), root = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const fail = (m) => { console.error(`gallery: ${m}`); process.exit(1); };

// First paragraph after the first "# " heading, skipping HTML comments and blank lines, verbatim.
const firstParagraph = (text) => {
  const L = text.split('\n'); let i = L.findIndex((l) => /^# /.test(l)); const out = [];
  for (i = i < 0 ? 0 : i + 1; i < L.length; i++) { if (/^\s*<!--/.test(L[i]) || (!L[i].trim() && !out.length)) continue; if (!L[i].trim() || /^#/.test(L[i])) break; out.push(L[i]); }
  return out.join('\n');
};
const title = (text, fallback) => (text.match(/^# (.+)$/m)?.[1] ?? fallback).trim();

// Everything after the H1, headings nested three levels deeper (cap h6), code fences left alone.
function body(text) {
  let fence = false, seenH1 = false;
  return text.split('\n').filter((l) => { if (!seenH1 && /^# /.test(l)) { seenH1 = true; return false; } return true; })
    .map((l) => { if (/^```/.test(l)) fence = !fence; return !fence && /^#{1,6} /.test(l) ? '#'.repeat(Math.min(6, l.match(/^#+/)[0].length + 3)) + l.replace(/^#+/, '') : l; })
    .join('\n').replace(/^\s*\n/, '').trimEnd();
}

function main() {
  if (!root || !existsSync(root) || !statSync(root).isDirectory()) fail('usage: gallery.mjs <examplesDir> [--out GALLERY.md]');
  const dir = resolve(root), oi = args.indexOf('--out'), out = oi >= 0 ? resolve(args[oi + 1] ?? '') : join(dir, 'GALLERY.md');
  if (oi >= 0 && !args[oi + 1]) fail('--out needs a file name');
  const rel = (p) => relative(dirname(out), p).split('\\').join('/');
  const examples = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules').map((e) => e.name).sort();
  const L = ['# Example gallery', '', `> ${HEADER}.`, '', 'Each entry copies the example\'s own RESULTS.md as written, failures and accepted risks included. Where an example has no RESULTS.md, this page says so.', ''];
  for (const n of examples) {
    const d = join(dir, n), readme = existsSync(join(d, 'README.md')) ? readFileSync(join(d, 'README.md'), 'utf8') : null, res = existsSync(join(d, 'RESULTS.md')) ? readFileSync(join(d, 'RESULTS.md'), 'utf8') : null;
    if (!readme && !res) continue;
    L.push(`## ${readme ? title(readme, n) : n}`, '', `What it is (from its README): ${readme ? firstParagraph(readme) || 'README has no description paragraph.' : 'no README.md'}`, '', `Folder: [${n}/](${rel(d)}/)  |  ${existsSync(join(d, 'BUILD-LOG.md')) ? `[BUILD-LOG](${rel(join(d, 'BUILD-LOG.md'))})` : 'no BUILD-LOG'}  |  ${res ? `[RESULTS](${rel(join(d, 'RESULTS.md'))})` : 'RESULTS: none'}`, '', res ? '### Gate results (copied from RESULTS.md, not edited)' : '### Gate results', '', res ? body(res) : 'no results recorded', '');
  }
  if (L.length < 8) L.push('No example folders found.', '');
  scoped(dirname(out)).write(basename(out), L.join('\n')); // refuses a symlink at the output path
  console.log(`gallery: wrote ${out} (${examples.length} folder(s))`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
