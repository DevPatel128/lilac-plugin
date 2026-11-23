#!/usr/bin/env node
// Lilac converge: bounded fix loop after the fidelity judge. Cap: 3 rounds, then ask the human.
// Usage: node scripts/converge.mjs plan <dir>                                 misses + minimal gates to rerun
//        node scripts/converge.mjs record <dir> --round N --fixed R-004,R-007  append a round to <dir>/.lilac/converge.json
//        node scripts/converge.mjs status <dir>                               rounds used, what was fixed, what is left
// Input: <dir>/reports/FIDELITY.md must end with a machine block, a fenced json block:
//   {"misses":[{"id":"R-004","verdict":"MISS","gate":"dom"}]}
//   verdict: MISS | PARTIAL | UNKNOWN (PASS rows are not listed). gate: the requirement's verify method (dom|content|behavior|a11y|perf)
//   or an existing gate id. If gate is empty, the method is read from <dir>/requirements.yaml (or reports/requirements.yaml): `- id: R-004` then `verify: dom`.
// Gate map: dom/content -> static-qa+fidelity; behavior -> controls-test+fidelity; a11y/perf -> qa-browser+fidelity.
// Offline; writes only .lilac/converge.json through safe-fs.
// shortcut: requirements.yaml read by line match (id/verify keys), not a YAML parser; swap for one if the fixture format grows nested.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { safeWriteFile } from '../lib/safe-fs.mjs';

const CAP = 3;
const MAP = { dom: 'static-qa', content: 'static-qa', behavior: 'controls-test', a11y: 'qa-browser', perf: 'qa-browser' };
const fail = (m) => { console.error(`converge: ${m}`); process.exit(2); };
const [cmd, d, ...rest] = process.argv.slice(2);
if (!['plan', 'record', 'status'].includes(cmd) || !d) fail('usage: plan <dir> | record <dir> --round N --fixed R-1,R-2 | status <dir>');
const dir = resolve(d);
const flag = (n) => { const i = rest.indexOf(n); return i < 0 ? undefined : rest[i + 1]; };
const cfile = join(dir, '.lilac', 'converge.json');
const load = () => (existsSync(cfile) ? JSON.parse(readFileSync(cfile, 'utf8')) : { rounds: [] });

function misses() {
  const f = join(dir, 'reports', 'FIDELITY.md');
  if (!existsSync(f)) fail(`no ${f}; run /lilac:fidelity first`);
  const blocks = [...readFileSync(f, 'utf8').matchAll(/```json\s*\n([\s\S]*?)```/g)];
  if (!blocks.length) fail('FIDELITY.md has no trailing json block');
  let j;
  try { j = JSON.parse(blocks[blocks.length - 1][1]); } catch { fail('FIDELITY.md json block is not valid JSON'); }
  if (!Array.isArray(j.misses)) fail('json block needs a "misses" array');
  return j.misses;
}
function verifyOf(id) {
  for (const p of ['requirements.yaml', 'reports/requirements.yaml']) {
    const f = join(dir, p);
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').split(/\n(?=\s*-\s*id:)/).find((b) => new RegExp(`id:\\s*["']?${id}["']?\\s*($|\\n)`).test(b));
    const v = m && /verify:\s*([\w-]+)/.exec(m);
    if (v) return v[1];
  }
}

if (cmd === 'plan') {
  const ms = misses();
  if (!ms.length) { console.log('converge: no misses. Nothing to fix.'); process.exit(0); }
  const gates = new Set();
  for (const m of ms) {
    const k = m.gate || verifyOf(m.id);
    const g = MAP[k] || k; // an unknown method falls through as a gate id; empty -> UNKNOWN
    console.log(`${m.id}  ${m.verdict}  verify=${k || 'UNKNOWN'}  gate=${g || 'UNKNOWN'}`);
    if (g) gates.add(g);
  }
  if (gates.size) gates.add('fidelity');
  console.log(`Rerun gates: ${[...gates].join(', ') || 'UNKNOWN (set a verify method)'}`);
  const used = load().rounds.length;
  console.log(`Round ${used + 1} of ${CAP}${used >= CAP ? '. Cap reached: ask the human.' : ''}`);
} else if (cmd === 'record') {
  const n = Number(flag('--round'));
  if (!Number.isInteger(n) || n < 1) fail('--round must be a whole number from 1');
  if (n > CAP) fail(`round ${n} is over the cap of ${CAP}. Stop and ask the human what to do with the remaining misses.`);
  const fixed = (flag('--fixed') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const c = load();
  if (n !== c.rounds.length + 1) fail(`next round is ${c.rounds.length + 1}, got ${n}`);
  c.rounds.push({ round: n, fixed, at: new Date().toISOString() });
  safeWriteFile(dir, '.lilac/converge.json', JSON.stringify(c, null, 2) + '\n', { overwrite: true });
  console.log(`converge: round ${n} of ${CAP} recorded (${fixed.length} fixed).${n === CAP ? ' Last round: ask the human about anything still missing.' : ''}`);
} else {
  const c = load();
  const fixed = new Set(c.rounds.flatMap((r) => r.fixed));
  console.log(`Rounds used: ${c.rounds.length} of ${CAP}`);
  for (const r of c.rounds) console.log(`  round ${r.round}: ${r.fixed.join(', ') || 'none'}`);
  if (existsSync(join(dir, 'reports', 'FIDELITY.md'))) {
    const left = misses().filter((m) => !fixed.has(m.id)).map((m) => m.id);
    console.log(`Open in last FIDELITY.md: ${left.join(', ') || 'none'} (re-run fidelity to confirm)`);
  }
}
