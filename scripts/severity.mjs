#!/usr/bin/env node
// Lilac severity: the 1 to 10 dial that sets how strict every gate is.
// Usage: node scripts/severity.mjs set <dir> <1-10>   writes <dir>/.lilac/config.json
//        node scripts/severity.mjs show <dir>         prints level, approvals and gates that apply
// Raising it needs nothing else: skipped approvals and deferred gates become required again by themselves. The floor never drops (see gates.json).
// Offline; writes only .lilac/config.json through safe-fs.
import { resolve } from 'node:path';
import { safeWriteFile } from '../lib/safe-fs.mjs';
import { GATES, readSeverity, levelName, approvalRequired, gatesFor } from './gates-config.mjs';

const [cmd, d, n] = process.argv.slice(2);
const fail = (m) => { console.error(`severity: ${m}`); process.exit(2); };
if (!['set', 'show'].includes(cmd) || !d) fail('usage: set <dir> <1-10> | show <dir>');
const dir = resolve(d);
if (cmd === 'set') {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 1 || v > 10) fail('severity must be a whole number from 1 to 10');
  const before = readSeverity(dir);
  safeWriteFile(dir, '.lilac/config.json', JSON.stringify({ severity: v }, null, 2) + '\n', { overwrite: true });
  console.log(`severity: ${v} (${levelName(v)})${before != null && v > before ? '. Raised: approvals and gates skipped before are required again.' : ''}`);
}
const s = readSeverity(dir);
if (cmd === 'show' || cmd === 'set') {
  const g = gatesFor(s, dir);
  console.log(`Severity ${s ?? 'not set (every gate, before preview)'}${s != null ? ` (${levelName(s)})` : ''}`);
  console.log(`Approvals: ${GATES.approvals.filter((a) => approvalRequired(a.id, s)).map((a) => a.id).concat('deploy (always)').join(', ')}`);
  console.log(`Before preview: ${g.pre.map((x) => x.name).join(', ') || 'none'}`);
  console.log(`After preview (still required before deploy): ${g.post.map((x) => x.name).join(', ') || 'none'}`);
  console.log(`Floor, never skipped: ${GATES.floor.join('; ')}`);
}
