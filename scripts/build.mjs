#!/usr/bin/env node
// build.mjs: the truth-keeper for `/lilac:build "<idea>"`. The agent does the work; this file keeps state and checks it against the real tools.
// Usage: node scripts/build.mjs init <dir> --idea "<text>"      create <dir>/.lilac/state.json
//        node scripts/build.mjs status <dir>                    progress list, current stage, exact next command (exit 0)
//        node scripts/build.mjs next <dir>                      next action as JSON for the agent
//        node scripts/build.mjs approve <dir> brief|funnel --by "<name>" --quote "<their words>"   records the human's yes with a hash of BRIEF.md / FUNNEL.md
//        node scripts/build.mjs done <dir> <stage> --evidence "<command> => <result line>"   refused without evidence or a valid approval from the stage's own tool
//        node scripts/build.mjs block <dir> <stage> --reason "<why>"
//        node scripts/build.mjs resume <dir>                    re-verifies done stages; a STALE one reopens itself and everything after it
//        node scripts/build.mjs gates <dir>                     runs the stage-5 tools one after another, records last line + exit code, prints a table
//        (after 5 failed rounds gates refuses until the human says go on: gates <dir> --continue resets the round counter)
//        node scripts/build.mjs report <dir>                    writes <dir>/BUILD-REPORT.md
// Stages: brief foundation funnel build gates fix hosting preview deploy-plan handoff. Approval stages: brief foundation funnel preview.
// Tools are run from LILAC_SCRIPTS_DIR (default: this folder). State is written atomically; ids, quotes, evidence and the idea are redacted for secrets and emails.
// Offline: only child_process to run the sibling Lilac tools with no shell. Never deploys, never approves for a human.
// shortcut: funnel.mjs is assumed to offer `check <dir>` (exit 0 = ok); upgrade if its real CLI differs.
import { existsSync, readFileSync } from 'node:fs';
import { scoped } from '../lib/safe-fs.mjs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOLS = process.env.LILAC_SCRIPTS_DIR || HERE;
const ORDER = ['brief', 'foundation', 'funnel', 'build', 'gates', 'fix', 'hosting', 'preview', 'deploy-plan', 'handoff'];
const APPROVAL = ['brief', 'foundation', 'funnel', 'preview'];
const MAX_ROUNDS = 5;
// Short copy of the SECRET pattern in architecture/core/secret.ts plus emails. Keep in step with hosting.mjs.
const SECRET = /(sk-[A-Za-z0-9]{20,}|sk[-_](?:live|test)[-_][A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY[\s\S]*|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]*|[\w.+-]+@[\w-]+\.[\w.-]+)/g;
const red = (s) => String(s ?? '').replace(SECRET, '[REDACTED]');
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const now = () => new Date().toISOString();

const [cmd, dirArg, ...rest] = process.argv.slice(2);
const dir = dirArg ? resolve(dirArg) : null;
const flag = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
const SF = dir && join(dir, '.lilac', 'state.json');
const fail = (m, code = 1) => { console.error(`build: ${m}`); process.exit(code); };

function load() {
  if (!existsSync(SF)) fail(`no state in ${dir}. Run: node build.mjs init "${dir}" --idea "<text>"`);
  try { return JSON.parse(readFileSync(SF, 'utf8')); } catch { fail('state.json is unreadable'); }
}
function save(s) {
  s.updatedAt = now();
  scoped(dir).write('.lilac/state.json', JSON.stringify(s, null, 2) + '\n'); // refuses symlinks; atomic
}
// Runs a Lilac tool, returns {code, line}; a missing tool is code 127 so it can never pass.
function tool(name, args) {
  const f = join(TOOLS, name);
  if (!existsSync(f)) return { code: 127, line: `${name} not found`, cmd: `node ${name} ${args.join(' ')}` };
  const r = spawnSync(process.execPath, [f, ...args], { encoding: 'utf8', timeout: 20 * 60 * 1000 });
  const lines = `${r.stdout || ''}\n${r.stderr || ''}`.split('\n').map((l) => l.trim()).filter(Boolean);
  return { code: r.status ?? 1, line: red(lines.at(-1) ?? '(no output)'), first: lines[0] ?? '', cmd: `node ${name} ${args.join(' ')}` };
}
const note = (s, r) => { s.last = { command: red(r.cmd.replace(dir, '<dir>')), result: r.line, exit: r.code }; };

const siteExists = () => existsSync(join(dir, 'index.html')) || ['site', 'public', 'dist', 'out', 'build'].some((d) => existsSync(join(dir, d)));

// Real verification for a stage. Returns {ok, why, approval?}.
function verify(s, stage) {
  if (stage === 'brief' || stage === 'funnel') {
    const file = join(dir, stage === 'brief' ? 'BRIEF.md' : 'FUNNEL.md');
    if (!existsSync(file)) return { ok: false, why: `${file.replace(dir + '/', '')} is missing` };
    const r = stage === 'brief' ? tool('brief.mjs', ['check', file]) : tool('funnel.mjs', ['check', dir]);
    note(s, r); if (r.code) return { ok: false, why: `check failed: ${r.line}` };
    const a = [...s.approvals].reverse().find((x) => x.stage === stage);
    if (!a) return { ok: false, why: `no human approval for ${stage}` };
    if (a.hash !== sha(file)) return { ok: false, why: `${stage} changed since approval (STALE)` };
    return { ok: true };
  }
  if (stage === 'foundation' || stage === 'preview') {
    const r = stage === 'foundation' ? tool('foundation.mjs', ['status', dir]) : tool('preview.mjs', ['status', '--project', dir]);
    note(s, r); if (r.code || !/^VALID/.test(r.first)) return { ok: false, why: `${stage} approval is ${r.first.split(':')[0] || 'NONE'}: ${r.line}` };
    const f = join(dir, '.lilac', stage === 'foundation' ? 'foundation-approval.json' : 'publish-approval.json');
    let a = {}; try { a = JSON.parse(readFileSync(f, 'utf8')); } catch {}
    return { ok: true, approval: { stage, by: red(a.by ?? 'tool'), quote: red(a.quote ?? ''), at: a.at ?? now(), hash: a.sha256 ?? '' } };
  }
  if (stage === 'build') return siteExists() ? { ok: true } : { ok: false, why: 'no site files found (index.html, site/, public/, dist/ ...)' };
  if (stage === 'gates' || stage === 'fix') {
    const g = s.gateResults;
    if (!g?.length) return { ok: false, why: 'gates have not run. Run: node build.mjs gates' };
    const bad = g.filter((x) => x.verdict !== 'PASS');
    return bad.length ? { ok: false, why: `gates not passing: ${bad.map((x) => x.name).join(', ')}` } : { ok: true };
  }
  if (stage === 'hosting') {
    const r = tool('hosting.mjs', ['show', '--project', dir]); note(s, r);
    return r.code || /none chosen yet/.test(r.first) ? { ok: false, why: 'no hosting choice recorded. Ask the human, then run hosting.mjs choose' } : { ok: true };
  }
  if (stage === 'deploy-plan') {
    const r = tool('hosting.mjs', ['deploy-plan', '--project', dir]); note(s, r); // prints only; it never deploys
    return r.code ? { ok: false, why: `deploy plan refused: ${r.line}` } : { ok: true };
  }
  return { ok: true };
}

function currentStage(s) { return ORDER.find((x) => s.stages[x].status !== 'done') ?? null; }
const B = `node "\${CLAUDE_PLUGIN_ROOT}/scripts/build.mjs"`;
const ACTION = {
  brief: ['Interview the human one question at a time, write BRIEF.md, run brief.mjs check. Show it. Ask for approval.', (d) => `${B} approve "${d}" brief --by "<name>" --quote "<their words>"`, true],
  foundation: ['Run /lilac:foundation (FOUNDATION.md, BRAND.md, tokens). Ask the human to approve; record with foundation.mjs approve.', (d) => `node "\${CLAUDE_PLUGIN_ROOT}/scripts/foundation.mjs" approve "${d}" --by "<name>" --quote "<their words>"`, true],
  funnel: ['Write FUNNEL.md with /lilac:funnel and run funnel.mjs check. Ask the human to approve.', (d) => `${B} approve "${d}" funnel --by "<name>" --quote "<their words>"`, true],
  build: ['Write the site using brand/tokens.css and the blocks in ${CLAUDE_PLUGIN_ROOT}/blocks if present.', (d) => `${B} done "${d}" build --evidence "<command> => <result line>"`, false],
  gates: ['Run all gates, one after another.', (d) => `${B} gates "${d}"`, false],
  fix: ['Fix what failed (list failures and changes each round), then re-run gates. After 5 failed rounds stop and ask the human.', (d) => `${B} gates "${d}"`, false],
  hosting: ['ASK the human where to host (code is on GitHub). Then hosting.mjs choose.', (d) => `node "\${CLAUDE_PLUGIN_ROOT}/scripts/hosting.mjs" choose --host <h> --db <d> --project "${d}"`, true],
  preview: ['Run preview.mjs start, let the human look, record approval only after their explicit yes.', (d) => `node "\${CLAUDE_PLUGIN_ROOT}/scripts/preview.mjs" approve --project "${d}" --by "<name>" --quote "<their words>"`, true],
  'deploy-plan': ['Print the deploy plan. NEVER run it.', (d) => `${B} done "${d}" deploy-plan --evidence "hosting.mjs deploy-plan => <result line>"`, false],
  handoff: ['Write the handoff files with handoff.mjs, then the report.', (d) => `${B} done "${d}" handoff --evidence "<command> => <result line>"`, false],
};
function nextAction(s) {
  const st = currentStage(s);
  if (!st) return { stage: null, action: 'All stages done. Run report.', command: `${B} report "${dir}"`, needsHuman: false };
  const [text, c, human] = ACTION[st];
  const blocked = s.stages[st].status === 'blocked';
  return { stage: st, status: s.stages[st].status, action: blocked ? `BLOCKED: ${s.stages[st].reason}. Stop and ask the human.` : text, command: c(dir), needsHuman: human || blocked, round: s.rounds };
}

function reopenFrom(s, stage, why) {
  for (const x of ORDER.slice(ORDER.indexOf(stage))) if (s.stages[x].status === 'done') s.stages[x] = { status: 'pending', reopened: why, at: now() };
}

function gates(s) {
  const GL = [['foundation drift', 'foundation.mjs', ['drift', dir]], ['static qa', 'qa.mjs', [dir]], ['qa-browser', 'qa-browser.mjs', [dir]], ['controls-test', 'controls-test.mjs', [dir]],
    ['persona-test (30 simulated visitors)', 'persona-test.mjs', [dir, '--visitors', '30']], ['funnel check', 'funnel.mjs', ['check', dir]], ['ux-review graph', 'ux-graph-check.mjs', []]];
  const out = [];
  for (const [name, f, a] of GL) { // sequential on purpose: Chrome tools must not overlap
    const r = tool(f, a);
    out.push({ name, exit: r.code, line: r.line, verdict: r.code === 0 && !/SKIPPED|UNVERIFIED/.test(r.line) ? 'PASS' : r.code === 0 ? 'UNVERIFIED' : 'FAIL', at: now() });
  }
  s.gateResults = out; s.last = { command: 'build.mjs gates', result: `${out.filter((x) => x.verdict === 'PASS').length}/${out.length} pass`, exit: 0 };
  const bad = out.filter((x) => x.verdict !== 'PASS');
  if (!bad.length) for (const x of ['gates', 'fix']) s.stages[x] = { status: 'done', at: now(), evidence: `build.mjs gates => ${out.length}/${out.length} pass` };
  else {
    s.rounds += 1; s.roundLog.push({ round: s.rounds, failed: bad.map((x) => `${x.name}: ${x.line}`), at: now() });
    s.stages.gates = { status: 'done', at: now(), evidence: `build.mjs gates => ${out.length - bad.length}/${out.length} pass, round ${s.rounds}` };
    s.stages.fix = s.rounds >= MAX_ROUNDS ? { status: 'blocked', reason: `${MAX_ROUNDS} fix rounds failed; the human must decide`, at: now() } : { status: 'running', at: now() };
  }
  save(s);
  console.log('gate'.padEnd(40) + 'exit  verdict     last line');
  for (const x of out) console.log(x.name.padEnd(40) + String(x.exit).padEnd(6) + x.verdict.padEnd(12) + x.line);
  console.log(bad.length ? `${bad.length} gate(s) not passing. Fix round ${s.rounds} of ${MAX_ROUNDS}.${s.rounds >= MAX_ROUNDS ? ' BLOCKED: stop and ask the human.' : ''}` : 'All gates pass.');
  process.exit(bad.length ? 1 : 0);
}

function main() {
  if (!['init', 'status', 'next', 'approve', 'done', 'block', 'resume', 'gates', 'report'].includes(cmd) || !dir) fail('usage: build.mjs init|status|next|approve|done|block|resume|gates|report <dir> ...', 2);
  if (cmd === 'init') {
    const idea = flag('idea'); if (!idea?.trim()) fail('--idea "<text>" is required');
    if (existsSync(SF)) fail('already initialised; use status or resume');
    save({ version: 1, idea: red(idea), createdAt: now(), stages: Object.fromEntries(ORDER.map((x) => [x, { status: 'pending' }])), last: null, rounds: 0, roundLog: [], approvals: [], gateResults: [] });
    console.log(`build: initialised ${SF.replace(dir + '/', '')}`); return;
  }
  const s = load();
  if (cmd === 'status') {
    for (const x of ORDER) { const t = s.stages[x]; console.log(`${{ done: '[x]', pending: '[ ]', running: '[~]', blocked: '[!]', 'needs-approval': '[?]' }[t.status]} ${x.padEnd(12)} ${t.status}${APPROVAL.includes(x) && t.status !== 'done' ? ' (needs the human)' : ''}${t.reopened ? ' (reopened: ' + t.reopened + ')' : ''}`); }
    const n = nextAction(s);
    console.log(`\nCurrent stage: ${n.stage ?? 'none, all done'}${s.rounds ? ` (fix rounds used: ${s.rounds} of ${MAX_ROUNDS})` : ''}\nNext: ${n.action}\nCommand: ${n.command}`); return;
  }
  if (cmd === 'next') { console.log(JSON.stringify(nextAction(s))); return; }
  if (cmd === 'block') {
    const st = rest[0]; if (!ORDER.includes(st) || !flag('reason')) fail('usage: block <dir> <stage> --reason "<why>"');
    s.stages[st] = { status: 'blocked', reason: red(flag('reason')), at: now() }; save(s); console.log(`build: ${st} blocked. Stop and ask the human.`); return;
  }
  if (cmd === 'approve') {
    const st = rest[0], by = flag('by')?.trim(), quote = flag('quote')?.trim();
    if (!['brief', 'funnel'].includes(st)) fail('approve is for brief and funnel; foundation and preview have their own approve command');
    if (!by || !quote) fail('--by and --quote (the human\'s own words) are required');
    const file = join(dir, st === 'brief' ? 'BRIEF.md' : 'FUNNEL.md'); if (!existsSync(file)) fail(`${file} is missing`);
    const r = st === 'brief' ? tool('brief.mjs', ['check', file]) : tool('funnel.mjs', ['check', dir]);
    if (r.code) fail(`${st} check failed, not recorded: ${r.line}`);
    s.approvals.push({ stage: st, by: red(by), quote: red(quote), at: now(), hash: sha(file) }); note(s, r); save(s); console.log(`build: ${st} approval recorded. Editing the file makes it STALE.`); return;
  }
  if (cmd === 'done') {
    const st = rest[0], ev = red(flag('evidence') ?? '');
    if (!ORDER.includes(st)) fail(`unknown stage ${st}`);
    if (!/^\S.*\S\s=>\s\S/.test(ev)) fail('evidence must be "<command> => <result line>". Refused.');
    const before = ORDER.slice(0, ORDER.indexOf(st)).find((x) => s.stages[x].status !== 'done');
    if (before) fail(`${before} is not done yet; stages cannot be skipped. Refused.`);
    const v = verify(s, st); if (!v.ok) { save(s); fail(`${st} not done: ${v.why}. Refused.`); }
    if (v.approval) s.approvals.push(v.approval);
    s.stages[st] = { status: 'done', at: now(), evidence: ev }; save(s); console.log(`build: ${st} done.`); return;
  }
  if (cmd === 'resume') {
    for (const st of ORDER) {
      if (s.stages[st].status !== 'done' || !['brief', 'foundation', 'funnel', 'preview', 'hosting', 'build'].includes(st)) continue;
      const v = verify(s, st); if (!v.ok) { reopenFrom(s, st, v.why); console.log(`build: ${st} reopened (${v.why}); later stages reopened too.`); break; }
    }
    save(s); return main2(s);
  }
  if (cmd === 'gates') { const st = currentStage(s); if (!['gates', 'fix'].includes(st)) fail(`current stage is ${st}; gates run after build`); if (s.stages[st].status === 'blocked') { // only after the human says to keep going
      if (!rest.includes('--continue')) fail(`blocked: ${s.stages[st].reason}. Ask the human; only if they say go on, re-run with --continue.`);
      s.rounds = 0; s.stages[st] = { status: 'running', at: now() };
    } return gates(s); }
  if (cmd === 'report') {
    const L = [`# Build report`, '', `Idea: ${s.idea}`, `Updated: ${s.updatedAt}`, '', '## Stages', ''];
    for (const x of ORDER) L.push(`- ${x}: ${s.stages[x].status}${s.stages[x].evidence ? `. Evidence: \`${s.stages[x].evidence}\`` : ''}${s.stages[x].reason ? `. Reason: ${s.stages[x].reason}` : ''}`);
    L.push('', `## Fix rounds: ${s.rounds} of ${MAX_ROUNDS}`, ''); for (const r of s.roundLog) L.push(`- Round ${r.round}: ${r.failed.join('; ')}`);
    L.push('', '## Last gate run', ''); for (const g of s.gateResults) L.push(`- ${g.name}: ${g.verdict} (exit ${g.exit}) ${g.line}`);
    L.push('', '## Human approvals', ''); for (const a of s.approvals) L.push(`- ${a.stage}: ${a.by} on ${a.at}`);
    const open = ORDER.filter((x) => s.stages[x].status !== 'done');
    L.push('', '## Needs people', '', open.length ? open.map((x) => `- ${x}: ${APPROVAL.includes(x) || x === 'hosting' ? 'waiting for the human' : s.stages[x].status}`).join('\n') : '- Nothing open. Deploy is still the human\'s decision; the plan was printed, never run.', '', 'Simulated visitors are not real users.');
    scoped(dir).write('BUILD-REPORT.md', L.join('\n') + '\n'); console.log('build: wrote BUILD-REPORT.md');
  }
}
function main2(s) { const n = nextAction(s); console.log(`Current stage: ${n.stage ?? 'none'}\nCommand: ${n.command}`); }
main();
