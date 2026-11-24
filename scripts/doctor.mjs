#!/usr/bin/env node
// Lilac doctor: checks that Lilac can run on this computer and prints one plain line per check, with the fix beside every failure.
// Usage: node scripts/doctor.mjs        exit 0 when nothing failed (warnings are fine), 1 when a required check failed.
// Read-only: it never changes a setting, never touches the network, and writes nothing except a temporary file it removes.
import { existsSync, readdirSync, readFileSync, mkdtempSync, rmSync, accessSync, constants } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir, homedir, platform } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rows = []; // [status, name, detail, fix]
const add = (status, name, detail, fix = '') => rows.push([status, name, detail, fix]);

// 1. Node: the learning and handoff tools load TypeScript files directly, so test that for real instead of guessing from the version number.
const tsOk = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify('file://' + join(root, 'lib/library.ts').replace(/ /g, '%20'))})`], { encoding: 'utf8' });
add(tsOk.status === 0 ? 'ok' : 'fail', 'Node can run Lilac', `Node ${process.version}`, tsOk.status === 0 ? '' : 'Install Node 24 or newer (https://nodejs.org). Lilac loads TypeScript files directly, which older Node versions cannot do.');

// 2. Plugin files present and not truncated.
const skills = existsSync(join(root, 'skills')) ? readdirSync(join(root, 'skills')).filter((d) => existsSync(join(root, 'skills', d, 'SKILL.md'))) : [];
const agents = existsSync(join(root, 'agents')) ? readdirSync(join(root, 'agents')).filter((f) => f.endsWith('.md')) : [];
add(skills.length >= 10 && agents.length === 8 ? 'ok' : 'fail', 'Plugin files are complete', `${skills.length} skills, ${agents.length} agents`, 'Reinstall: /plugin uninstall lilac@lilac, then /plugin install lilac@lilac.');
for (const f of ['scripts/techdocs.mjs', 'handoff/handoff.mjs', 'learning/config.mjs', 'scripts/approval-guard.mjs', 'scripts/gates.json', 'scripts/gates-config.mjs']) if (!existsSync(join(root, f))) add('fail', `Missing ${f}`, '', 'Reinstall the plugin.');

// 3. Chrome: only needed for the PDF. Missing Chrome is a warning, never a failure.
const chrome = process.env.CHROME && existsSync(process.env.CHROME) ? process.env.CHROME
  : [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find(existsSync) ?? ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].find((b) => spawnSync(platform() === 'win32' ? 'where' : 'which', [b], { stdio: 'ignore' }).status === 0);
add(chrome ? 'ok' : 'warn', 'Chrome for the handoff PDF', chrome ? 'found' : 'not found', chrome ? '' : 'Optional. Install Google Chrome, or set CHROME=/path/to/chrome. HANDOFF.md and the slides work without it.');

// 4. The folder where Lilac keeps learned data must be writable if learning is ever turned on.
const home = process.env.LILAC_HOME || join(homedir(), '.lilac');
let writable = true;
try { const probe = existsSync(home) ? home : dirname(home); accessSync(probe, constants.W_OK); } catch { writable = false; }
add(writable ? 'ok' : 'warn', 'Folder for learned data is writable', home, writable ? '' : 'Only matters if you turn learning on. Fix the folder permissions or set LILAC_HOME to another folder.');

// 5. Learning switch: report it plainly so nobody is surprised.
let learn = 'off';
try { learn = JSON.parse(readFileSync(join(home, 'config.json'), 'utf8')).learn ? 'on' : 'off'; } catch { /* no config file means the default: off */ }
add('ok', 'Learning hook', learn === 'on' ? 'ON: recording task text, outcome and failed checks on this computer' : 'off (the default): nothing is recorded', learn === 'on' ? 'Turn off with /lilac:learning off. Delete data with rm -r ~/.lilac' : '');

// 6. Git: the handoff and docs tools read history. Missing git only limits what they can report.
add(spawnSync('git', ['--version'], { stdio: 'ignore' }).status === 0 ? 'ok' : 'warn', 'git is installed', '', 'Optional. Install git so the handoff can read the project history.');

// 7. A throwaway write test in the temp folder proves scripts can create files here.
try { const d = mkdtempSync(join(tmpdir(), 'lilac-doctor-')); rmSync(d, { recursive: true, force: true }); add('ok', 'Temporary files can be created', '', ''); } catch { add('fail', 'Temporary files can be created', '', 'Free disk space or fix permissions on the temp folder.'); }

const icon = { ok: 'OK  ', warn: 'WARN', fail: 'FAIL' };
for (const [s, n, d, f] of rows) console.log(`${icon[s]} ${n}${d ? ` (${d})` : ''}${f && (s !== 'ok' || n === 'Learning hook') ? `\n     ${s === 'ok' ? 'note' : 'fix'}: ${f}` : ''}`);
const failed = rows.filter((r) => r[0] === 'fail').length, warned = rows.filter((r) => r[0] === 'warn').length;
console.log(failed ? `\nLilac needs attention: ${failed} problem(s).` : warned ? `\nLilac is ready. ${warned} optional item(s) above.` : '\nLilac is ready.');
process.exit(failed ? 1 : 0);
