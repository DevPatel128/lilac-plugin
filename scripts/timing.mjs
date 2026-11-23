#!/usr/bin/env node
// timing.mjs: where did the time go, and is it over budget. Offline, read-only.
// Usage: node scripts/timing.mjs report <dir>   per-step ms from .lilac/progress.json, slowest first
//        node scripts/timing.mjs budget <dir>   compare with .lilac/budget.json; exit 1 when over (CI regression guard)
// Default budget: pre-preview gates 10000 ms at severity <= 6 (sum of per-gate ms, a ceiling because static gates overlap), first preview 180000 ms wall clock from init.
// A check with no data yet is "n/a", never a pass or a fail. shortcut: preview wall clock includes human think time; set a larger budget for reviewed runs.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readSeverity } from './gates-config.mjs';

const [cmd, d] = process.argv.slice(2), dir = d && resolve(d);
const rd = (f, x) => { try { return JSON.parse(readFileSync(join(dir, '.lilac', f), 'utf8')); } catch { return x; } };
if (!['report', 'budget'].includes(cmd) || !dir) { console.error('usage: timing.mjs report|budget <dir>'); process.exit(2); }
if (cmd === 'report') {
  const p = rd('progress.json'); if (!p) { console.error('timing: no .lilac/progress.json'); process.exit(1); }
  const st = [...p.steps].sort((a, b) => (b.ms ?? -1) - (a.ms ?? -1));
  console.log('step'.padEnd(40) + 'status'.padEnd(10) + 'ms');
  for (const x of st) console.log(x.id.padEnd(40) + x.status.padEnd(10) + (x.ms ?? 'n/a'));
  const t = st.filter((x) => x.ms != null).slice(0, 3);
  console.log(t.length ? `Slowest: ${t.map((x) => `${x.id} ${x.ms} ms`).join(', ')}` : 'Slowest: n/a (no timings recorded yet)');
} else {
  const s = rd('state.json'), b = { preGatesMs: 10000, maxSeverity: 6, firstPreviewMs: 180000, ...rd('budget.json', {}) };
  if (!s) { console.error('timing: no .lilac/state.json'); process.exit(1); }
  const sev = readSeverity(dir), over = [];
  const gm = (s.gateResults ?? []).reduce((a, x) => a + (x.ms ?? 0), 0);
  if (!s.gateResults?.length || (sev != null && sev > b.maxSeverity)) console.log(`pre-preview gates: n/a (${s.gateResults?.length ? `severity ${sev} > ${b.maxSeverity}` : 'not run'})`);
  else { console.log(`pre-preview gates: ${gm} ms of ${b.preGatesMs} ms`); if (gm > b.preGatesMs) over.push('pre-preview gates'); }
  const at = s.stages?.preview?.at;
  if (s.stages?.preview?.status !== 'done' || !at) console.log('first preview: n/a (not reached)');
  else { const w = Date.parse(at) - Date.parse(s.createdAt); console.log(`first preview: ${w} ms of ${b.firstPreviewMs} ms`); if (w > b.firstPreviewMs) over.push('first preview'); }
  console.log(over.length ? `OVER BUDGET: ${over.join(', ')}` : 'within budget');
  process.exit(over.length ? 1 : 0);
}
