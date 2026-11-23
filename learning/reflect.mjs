// Draft lessons from one agent's OWN runs: a failed check seen >= 3 times becomes one DRAFT lesson. Never edits rules or skills. No network.
// Usage: reflect.mjs <agent>
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { readLibrary, writeRecord } from '../lib/library.ts';

const agent = process.argv[2];
const runs = readLibrary(agent, agent).filter((f) => f.includes('/runs/') || f.includes('\\runs\\'));
const lessons = readLibrary(agent, agent).filter((f) => /[\\/]lessons[\\/]/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
const seen = new Map(); // check -> run file names
for (const f of runs) {
  const m = /^failed_checks: (.*)$/m.exec(readFileSync(f, 'utf8'));
  for (const c of new Set((m?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean))) seen.set(c, [...(seen.get(c) ?? []), basename(f)]);
}
for (const [check, ev] of seen) {
  if (ev.length < 3 || lessons.includes(`check: ${check}\n`)) continue;
  writeRecord(agent, 'lesson', `status: DRAFT\nagent: ${agent}\ncheck: ${check}\nroot_cause: UNKNOWN\nproposed_fix: Review why "${check}" failed ${ev.length} times and add the fix to this agent's rules after approval.\nenforcing_check: ${check}\nevidence: ${ev.join(', ')}\n`);
  console.log(`draft lesson: ${check} (${ev.length} runs)`);
}
