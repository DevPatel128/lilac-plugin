#!/usr/bin/env node
// Link integrity for a built plugin: every relative markdown link in a shipped .md file must resolve inside the plugin folder.
// Usage: node operations/scripts/plugin-links-check.mjs <pluginDir>     exit 1 and list `file: target` for each dead link.
// External (http, https, mailto) and in-page (#anchor) links are ignored; link liveness on the web is a scheduled job, not this gate.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const dead = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!e.name.endsWith('.md')) continue;
    for (const m of readFileSync(p, 'utf8').matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const t = m[1].split('#')[0];
      if (!t || /^(https?:|mailto:)/i.test(m[1])) continue;
      if (!existsSync(resolve(dirname(p), decodeURIComponent(t)))) dead.push(`${p.slice(root.length + 1)}: ${m[1]}`);
    }
  }
})(root);
for (const d of dead) console.error(`dead link ${d}`);
console.log(`plugin-links: ${dead.length} dead link(s)`);
process.exit(dead.length ? 1 : 0);
