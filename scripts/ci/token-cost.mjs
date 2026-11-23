#!/usr/bin/env node
// token-cost.mjs <pluginDir> [--budget N]
// Prints the always-loaded cost of a plugin: front-matter name + description of every skills/*/SKILL.md and agents/*.md.
// Only that text loads into every session; bodies load on demand. Tokens are estimated as bytes/4 (rough, not a tokenizer).
// Exit 1 when total tokens > budget (default 4000) or any file has no front-matter name+description.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const a = process.argv.slice(2);
const bi = a.indexOf('--budget');
const budget = bi >= 0 ? Number(a[bi + 1]) : 4000;
const dir = a.find((x, i) => !x.startsWith('--') && (bi < 0 || i !== bi + 1));
if (!dir || !existsSync(dir) || Number.isNaN(budget)) { console.error('usage: token-cost.mjs <pluginDir> [--budget N]'); process.exit(2); }

// Returns "name: .. description: .." text from the front-matter, or null. Handles folded (> or |) multi-line values.
function frontLoaded(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {}; let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) { key = kv[1]; out[key] = kv[2].replace(/^[>|][+-]?$/, ''); }
    else if (key && /^\s+/.test(line)) out[key] += ' ' + line.trim();
  }
  if (!out.name?.trim() || !out.description?.trim()) return null;
  return `name: ${out.name.trim()} description: ${out.description.trim()}`;
}

const rows = []; let bad = 0;
const add = (kind, label, file) => {
  const s = frontLoaded(readFileSync(file, 'utf8'));
  if (s === null) { console.error(`FAIL ${label}: no front-matter name+description`); bad++; return; }
  const bytes = Buffer.byteLength(s); rows.push([kind, label, bytes, Math.ceil(bytes / 4)]);
};
const sk = join(dir, 'skills');
if (existsSync(sk)) for (const d of readdirSync(sk).sort()) { const f = join(sk, d, 'SKILL.md'); if (existsSync(f)) add('skill', d, f); }
const ag = join(dir, 'agents');
if (existsSync(ag)) for (const f of readdirSync(ag).sort()) if (f.endsWith('.md')) add('agent', f.replace(/\.md$/, ''), join(ag, f));

console.log('kind   name'.padEnd(40) + 'bytes  tokens');
for (const [k, n, b, t] of rows) console.log(`${k.padEnd(6)} ${n}`.padEnd(40) + `${String(b).padStart(5)}  ${String(t).padStart(6)}`);
const total = rows.reduce((s, r) => s + r[3], 0);
console.log(`TOTAL ${rows.length} items, ${rows.reduce((s, r) => s + r[2], 0)} bytes, ~${total} tokens (budget ${budget})`);
if (bad) process.exit(1);
if (total > budget) { console.error(`FAIL over budget: ${total} > ${budget}`); process.exit(1); }
