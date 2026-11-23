#!/usr/bin/env node
// network-check.mjs <dir> [--allow file]
// Scans .mjs/.js/.ts/.sh/.json files under <dir> for outbound network CODE constructs and fails on any hit not allowlisted.
// Comments (// /* */ in JS/TS, # in sh) and .md files are ignored, so documentation URLs never fail. Plain URL strings are not flagged;
// a URL is flagged only as the first argument of a call, e.g. open('https://..').
// Patterns: fetch, net-import (net/http/https/http2/dgram/tls/dns), websocket, xhr, url-call (js/ts); curl, wget, nc, npm-install, npx (sh, json).
// Allowlist (default operations/plugin/network-allowlist.txt): lines `path:pattern  # reason`; path is a substring of the file path relative to <dir>.
// Limit: regex scan, not a parser; a pattern inside a string literal still counts. Skips node_modules and .git.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const a = process.argv.slice(2);
const ai = a.indexOf('--allow');
const dir = a.find((x, i) => !x.startsWith('--') && (ai < 0 || i !== ai + 1));
const allowFile = ai >= 0 ? a[ai + 1] : join(dirname(fileURLToPath(import.meta.url)), '../plugin/network-allowlist.txt');
if (!dir || !existsSync(dir)) { console.error('usage: network-check.mjs <dir> [--allow file]'); process.exit(2); }
const allow = existsSync(allowFile)
  ? readFileSync(allowFile, 'utf8').split(/\r?\n/).map((l) => l.replace(/\s#.*$/, '').trim()).filter((l) => l && !l.startsWith('#'))
      .map((l) => { const i = l.lastIndexOf(':'); return [l.slice(0, i), l.slice(i + 1)]; })
  : [];

const JS = [
  ['fetch', /(^|[^\w.$])fetch\s*\(/],
  ['net-import', /(?:from\s*|require\s*\(\s*|import\s*\(\s*|import\s+)['"](?:node:)?(?:net|http|https|http2|dgram|tls|dns)['"]/],
  ['websocket', /\bWebSocket\b/],
  ['xhr', /\bXMLHttpRequest\b/],
  ['url-call', /\w\s*\(\s*[`'"]https?:\/\//],
];
const SH = [
  ['curl', /(^|[\s;&|(`"'])curl(\s|$)/], ['wget', /(^|[\s;&|(`"'])wget(\s|$)/], ['nc', /(^|[\s;&|(`"'])(nc|ncat|netcat)\s/],
  ['npm-install', /\bnpm\s+(install|i|ci)\b/], ['npx', /(^|[\s;&|(`"'])npx\s/],
];
const stripJs = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
const stripSh = (t) => t.replace(/^\s*#.*$/gm, '').replace(/(\s)#\s.*$/gm, '$1');

const hits = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    if (e === 'node_modules' || e === '.git') continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const ext = e.slice(e.lastIndexOf('.'));
    const rel = relative(dir, p);
    const text = readFileSync(p, 'utf8');
    const [body, pats] = ['.mjs', '.js', '.ts'].includes(ext) ? [stripJs(text), JS]
      : ext === '.sh' ? [stripSh(text), SH] : ext === '.json' ? [text, SH] : [null];
    if (body === null) continue;
    body.split('\n').forEach((line, i) => {
      for (const [name, re] of pats) if (re.test(line) && !allow.some(([pa, pn]) => rel.includes(pa) && pn === name)) hits.push(`${rel}:${i + 1}: ${name}: ${line.trim().slice(0, 100)}`);
    });
  }
})(dir);
for (const h of hits) console.error(`HIT ${h}`);
console.log(`network-check: ${hits.length} unallowlisted hit(s)`);
process.exit(hits.length ? 1 : 0);
