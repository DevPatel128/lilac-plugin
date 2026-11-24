#!/usr/bin/env node
// images.mjs audit <dir> | plan <dir>
// audit: flags <img> that are not AVIF/WebP (SVG is fine), lack srcset/sizes, or lack alt (alt="" is allowed for decoration). Exit 1 on findings.
// plan: prints a conversion plan (commands a human may run, e.g. sharp-cli or squoosh-cli) for raster files on disk. This script converts nothing and installs nothing.
// Offline, read-only. shortcut: regex scan of markup; CSS background images are not audited. Command flags are suggestions: check the tool's --help before running.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';

const [cmd, dir] = process.argv.slice(2);
if (!['audit', 'plan'].includes(cmd) || !dir || !existsSync(dir) || !statSync(dir).isDirectory()) { console.error('usage: images.mjs audit <dir> | plan <dir>'); process.exit(2); }
const root = resolve(dir);
const walk = (d, o = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', '.lilac'].includes(e.name)) continue; const p = join(d, e.name); e.isDirectory() ? walk(p, o) : o.push(p); } return o; };
const attrs = (tag) => { const o = {}; for (const m of tag.matchAll(/([a-zA-Z:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) o[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''; return o; };
const modern = /\.(avif|webp)(\?|#|$)/i, vector = /\.svg(\?|#|$)|^data:image\/svg/i;
const files = walk(root);

if (cmd === 'audit') {
  const out = [];
  for (const page of files.filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(page, 'utf8'), rel = page.slice(root.length + 1);
    for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
      const a = attrs(m[1]), src = a.src ?? '', at = m.index, before = html.slice(0, at);
      const pic = before.lastIndexOf('<picture') > before.lastIndexOf('</picture>') ? html.slice(before.lastIndexOf('<picture'), at) : '';
      const picModern = /<source\b[^>]*type\s*=\s*["']image\/(avif|webp)/i.test(pic), picSrcset = /<source\b[^>]*srcset/i.test(pic);
      if (!('alt' in a)) out.push(`${rel}: ${src}: missing alt (use alt="" only if decorative)`);
      if (vector.test(src)) continue;
      if (!modern.test(src) && !picModern) out.push(`${rel}: ${src}: not AVIF/WebP`);
      if (!('srcset' in a) && !picSrcset) out.push(`${rel}: ${src}: no srcset`);
      else if (!('sizes' in a) && 'srcset' in a) out.push(`${rel}: ${src}: srcset without sizes`);
    }
  }
  out.forEach((l) => console.log('FLAG  ' + l));
  console.log(out.length ? `\n${out.length} image finding(s).` : 'images: no findings.');
  process.exit(out.length ? 1 : 0);
}
const raster = files.filter((f) => /\.(png|jpe?g|gif|tiff?)$/i.test(f));
console.log('Image conversion plan. Nothing is converted or installed by this script; run what you approve.\n');
if (!raster.length) console.log('No PNG/JPEG/GIF/TIFF files found; nothing to convert.');
for (const f of raster) {
  const rel = f.slice(root.length + 1), stem = rel.replace(/\.[^.]+$/, ''), kb = (statSync(f).size / 1024).toFixed(0);
  console.log(`# ${rel} (${kb} KB)`);
  for (const w of [480, 960, 1440]) console.log(`npx sharp-cli --input "${rel}" --output "${stem}-${w}.webp" resize ${w}`);
  console.log(`npx @squoosh/cli --avif auto --webp auto -d "${join(stem, '..')}" "${rel}"   # alternative, one size\n`);
}
console.log('Then in the HTML use <picture> with AVIF then WebP sources, srcset + sizes, explicit width/height, loading="lazy" below the first image, and a real alt.');
