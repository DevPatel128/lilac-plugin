// Promote a DRAFT lesson to <userRoot>/agents/<agent>/learned/rules/ only with human approval bound to its sha256 AND eval score >= baseline.
// Usage: promote.mjs <agent> <lessonFile> --approval <file> --baseline <file> --eval-cmd <program> [arg ...]
// Everything after --eval-cmd is the eval command as an argv list: it is run with execFile, never through a shell.
// The approval file is SELF-ATTESTED: it proves a human-looking approval exists, it cannot prove a human wrote it. The control is that the
// agent instructions forbid writing approvals and promotion needs the owner to run this command. Never auto-approves. No network.
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename, join, sep } from 'node:path';
import { agentDir } from '../lib/library.ts';

const reject = (why) => { console.error(`REJECT: ${why}`); process.exit(1); };
const [agent, lessonFile, ...all] = process.argv.slice(2);
const ei = all.indexOf('--eval-cmd'), rest = ei < 0 ? all : all.slice(0, ei), evalArgv = ei < 0 ? [] : all.slice(ei + 1);
const a = {};
for (let i = 0; i < rest.length; i += 2) a[rest[i]?.replace(/^--/, '')] = rest[i + 1];
const USAGE = 'usage: promote.mjs <agent> <lessonFile> --approval <file> --baseline <file> --eval-cmd <program> [arg ...]';
if (!agent || !lessonFile || !a.approval || !a.baseline || !evalArgv.length) reject(USAGE);
if (evalArgv.some((x) => x.includes('\0')) || !evalArgv[0]) reject('bad eval command');
try { agentDir(agent); } catch (e) { reject(e.message); }

const lessons = join(agentDir(agent), 'lessons');
if (!existsSync(lessonFile) || !(realpathSync(lessonFile) + '').startsWith((existsSync(lessons) ? realpathSync(lessons) : lessons) + sep)) reject("lesson is not in this agent's own lessons folder");
const sha = createHash('sha256').update(readFileSync(lessonFile)).digest('hex');
if (!existsSync(a.approval)) reject('approval file missing');
const ap = readFileSync(a.approval, 'utf8');
if (!/^approved-by: \S.*$/m.test(ap)) reject('approval has no "approved-by: <name>" line');
if (!ap.includes(sha)) reject('approval does not match the lesson content (sha256)');

const score = (s) => { const n = JSON.parse(s.trim().split('\n').pop()).score; if (typeof n !== 'number') throw new Error('no numeric score'); return n; };
let base, got;
try { base = score(readFileSync(a.baseline, 'utf8')); } catch (e) { reject(`bad baseline: ${e.message}`); }
try { got = score(execFileSync(evalArgv[0], evalArgv.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 600000 })); } catch (e) { reject(`eval failed: ${e.message.split('\n')[0]}`); }
if (got < base) reject(`eval score ${got} is below baseline ${base}`);

const rules = join(agentDir(agent), 'rules');
mkdirSync(rules, { recursive: true, mode: 0o700 });
copyFileSync(lessonFile, join(rules, basename(lessonFile)));
console.log(`promoted ${basename(lessonFile)} (score ${got} >= ${base})`);
