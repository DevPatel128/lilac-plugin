// Hook entry: records one run (task, outcome, failed checks, rework count) ONLY when learning is on. No network.
// Usage: capture.mjs <agent> --task "<text>" --outcome pass|fail --checks "<failed checks>" --rework N
// Stdin JSON (hook payload) is read but only the same four fields are ever taken from it; no file contents or tool output.
import { readFileSync } from 'node:fs';
import { learnStatus } from './config.mjs';
import { writeRecord } from '../lib/library.ts';
import { scrub } from '../lib/redact.ts';

const [agent, ...rest] = process.argv.slice(2);
if (learnStatus() !== 'on') process.exit(0);
const a = {};
for (let i = 0; i < rest.length; i += 2) if (rest[i]?.startsWith('--')) a[rest[i].slice(2)] = rest[i + 1];
let p = {};
if (!process.stdin.isTTY) try { p = JSON.parse(readFileSync(0, 'utf8')) || {}; } catch {}
const one = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
// Scrub the WHOLE field first, then cut: cutting first can leave the head of a secret that no pattern matches any more (security review M-8).
const field = (v) => scrub(one(v), 1e6).slice(0, 200);
const task = field(a.task ?? p.task);
const outcome = one(a.outcome ?? p.outcome) === 'fail' ? 'fail' : 'pass';
const checks = field(a.checks ?? p.checks);
const rework = Math.max(0, parseInt(a.rework ?? p.rework, 10) || 0);
try {
  writeRecord(agent, 'run', `agent: ${agent}\ntask: ${task}\noutcome: ${outcome}\nfailed_checks: ${checks}\nrework: ${rework}\nat: ${new Date().toISOString()}\n`);
} catch (e) { console.error(`lilac learning: not recorded (${e.message})`); }
process.exit(0); // a hook must never fail the user's session
