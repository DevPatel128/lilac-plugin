#!/usr/bin/env node
// Lilac approval guard. A PreToolUse hook (Write|Edit|Bash) that turns "ask for approval" from a suggestion into a law.
// Hook mode (stdin = the hook JSON):  exit 2 + message on stderr = blocked; exit 0 = allowed.
//   Write/Edit of SITE CODE is blocked unless the approvals this severity needs are present and unchanged since approval (STALE = the hash of BRIEF.md,
//   FOUNDATION.md/BRAND.md or FUNNEL.md changed). Bash that runs a deploy command is blocked unless the preview approval is VALID (the floor: approval before deploy).
// CLI mode: node scripts/approval-guard.mjs status <dir>   prints each gate as approved, stale or pending (this is /lilac:status).
// Not a lilac project (no .lilac/state.json)? Always allowed. Kill switch for plugin developers: LILAC_HOOKS=off (logged to .lilac/guard.log).
// Honest limit: approvals are self-attested (see hooks/README.md). This guarantees the question is asked before code changes; it cannot prove a human clicked.
// shortcut: a Bash command that edits site files by redirect (echo > index.html) is not caught; only Write/Edit and deploy commands are. Upgrade by parsing the command.
import { existsSync, readFileSync, appendFileSync, mkdirSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, relative, extname, sep, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { approvalStatus, siteDir } from './preview.mjs';
import { readSeverity, approvalRequired, deployRe, levelName } from './gates-config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CODE = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.astro']);
const NOT_SITE = ['.lilac', 'node_modules', '.git', 'brand', 'design', 'brief', 'reports', 'docs', 'library', 'knowledge', 'test', 'tests'];

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
export function findRoot(from) {
  let d = resolve(from);
  for (;;) { if (existsSync(join(d, '.lilac', 'state.json'))) return d; const p = dirname(d); if (p === d) return null; d = p; }
}
function stateApproval(root, stage, file) {
  try {
    const s = JSON.parse(readFileSync(join(root, '.lilac', 'state.json'), 'utf8'));
    const a = [...s.approvals].reverse().find((x) => x.stage === stage);
    if (!a) return 'pending';
    return existsSync(join(root, file)) && a.hash === sha(join(root, file)) ? 'approved' : 'stale';
  } catch { return 'pending'; }
}
function foundationApproval(root) {
  const f = join(root, '.lilac', 'foundation-approval.json');
  if (!existsSync(f)) return 'pending';
  const r = spawnSync(process.execPath, [join(HERE, 'foundation.mjs'), 'status', root], { encoding: 'utf8', timeout: 30000 });
  const first = (r.stdout || '').split('\n')[0];
  return /^VALID/.test(first) ? 'approved' : /^STALE/.test(first) ? 'stale' : 'pending';
}
const previewApproval = (root) => ({ VALID: 'approved', STALE: 'stale', NONE: 'pending' })[approvalStatus(root)] ?? 'pending';

export function approvals(root) {
  const sev = readSeverity(root);
  const all = { brief: stateApproval(root, 'brief', 'BRIEF.md'), foundation: foundationApproval(root), funnel: stateApproval(root, 'funnel', 'FUNNEL.md'), preview: siteDir(root) ? previewApproval(root) : 'pending' };
  return { sev, rows: Object.entries(all).map(([id, status]) => ({ id, status, required: approvalRequired(id, sev) })) };
}

const isSiteCode = (root, file) => {
  const rel = relative(root, resolve(root, file)).split(sep);
  if (rel[0] === '..' || isAbsolute(rel[0])) return false;
  if (NOT_SITE.includes(rel[0])) return false;
  const sd = siteDir(root); const inSite = sd && sd !== root && resolve(root, file).startsWith(sd + sep);
  return inSite || CODE.has(extname(file).toLowerCase());
};
const log = (root, msg) => { try { mkdirSync(join(root, '.lilac'), { recursive: true }); appendFileSync(join(root, '.lilac', 'guard.log'), `${new Date().toISOString()} ${msg}\n`); } catch {} };

// Returns null when allowed, or the refusal text.
export function decide(input) {
  const tool = input.tool_name, ti = input.tool_input || {};
  const target = ti.file_path || ti.notebook_path || '';
  const root = findRoot(target ? dirname(resolve(input.cwd || '.', target)) : input.cwd || '.');
  if (!root) return null;
  if (process.env.LILAC_HOOKS === 'off') { log(root, `guard bypassed by LILAC_HOOKS=off: ${tool} ${target || (ti.command || '').slice(0, 80)}`); return null; }
  if (tool === 'Bash') {
    if (!deployRe().test(ti.command || '')) return null;
    return previewApproval(root) === 'approved' ? null : `Lilac: a deploy command is blocked because the preview is not approved (${previewApproval(root)}). Ask the human with AskUserQuestion (Approve / Change something / Stop) after they have looked at the preview, record it with preview.mjs approve, then retry.`;
  }
  if (!['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool) || !target) return null;
  const abs = resolve(input.cwd || '.', target);
  if (!isSiteCode(root, abs)) return null;
  const { sev, rows } = approvals(root);
  const bad = rows.filter((r) => r.required && ['brief', 'foundation', 'funnel'].includes(r.id) && r.status !== 'approved');
  if (!bad.length) return null;
  return `Lilac: writing site code is blocked. ${bad.map((b) => `${b.id} is ${b.status.toUpperCase()}`).join('; ')} (severity ${sev ?? 'not set'}). Ask the human now with AskUserQuestion: options Approve, Change something, Stop. Record a yes with build.mjs approve / foundation.mjs approve, then retry. Run /lilac:status to see every gate.`;
}

function main() {
  const [cmd, d] = process.argv.slice(2);
  if (cmd === 'status') {
    const root = findRoot(d || '.');
    if (!root) { console.log('status: not a Lilac project (no .lilac/state.json). Run /lilac:build "<idea>" first.'); return; }
    const { sev, rows } = approvals(root);
    console.log(`Severity: ${sev ?? 'not set'} (${levelName(sev)})`);
    for (const r of rows) console.log(`${r.id.padEnd(11)} ${r.required ? r.status : 'skipped at this severity'}`);
    console.log(`deploy      ${previewApproval(root) === 'approved' ? 'approved (preview is current)' : 'pending: needs a valid preview approval'}`);
    return;
  }
  let input; try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return; } // unreadable hook input must never brick the session
  const why = decide(input);
  if (why) { console.error(why); process.exit(2); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) main(); // realpath: macOS /var -> /private/var
