#!/usr/bin/env node
// Lilac status line: prints "Lilac  Build 4/9  ▓▓▓▓░░░░░░  44%  qa-browser" from <project>/.lilac/progress.json (written by build.mjs).
// Claude Code runs a status line command with JSON on stdin ({workspace.current_dir}); with no stdin or no Lilac project it prints nothing.
// Usage: node scripts/statusline.mjs [dir]      node scripts/statusline.mjs --install    prints the settings.json snippet (the skill asks first, then writes it)
// Plugins cannot set the status line themselves, so /lilac:statusline on does it only after the user says yes. Offline, read-only.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

if (process.argv[2] === '--install') {
  console.log(JSON.stringify({ statusLine: { type: 'command', command: `node "${resolve(dirname(new URL(import.meta.url).pathname), 'statusline.mjs')}"` } }, null, 2));
  process.exit(0);
}
let dir = process.argv[2];
if (!dir) { try { const j = JSON.parse(readFileSync(0, 'utf8')); dir = j.workspace?.current_dir || j.cwd; } catch {} }
for (let d = dir && resolve(dir); d; d = dirname(d) === d ? null : dirname(d)) {
  const f = join(d, '.lilac', 'progress.json');
  if (!existsSync(f)) continue;
  try {
    const p = JSON.parse(readFileSync(f, 'utf8')), n = Math.round(p.pct / 10);
    console.log(`Lilac  Build ${p.done}/${p.total}  ${'▓'.repeat(n)}${'░'.repeat(10 - n)}  ${p.pct}%  ${p.current ?? 'done'}${p.severity ? `  sev ${p.severity}` : ''}`);
  } catch {}
  break;
}
