// Shared reader for gates.json and .lilac/config.json (severity). Offline, dependency-free.
// severity === null means "not set": legacy behaviour (every gate, before the preview). The brief asks for it, so a real run always has one.
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const GATES = JSON.parse(readFileSync(join(process.env.LILAC_GATES_FILE || join(HERE, 'gates.json')), 'utf8'));

export function readSeverity(dir) {
  try {
    const n = JSON.parse(readFileSync(join(dir, '.lilac', 'config.json'), 'utf8')).severity;
    return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
  } catch { return null; }
}
export const levelName = (n) => (n == null ? 'not set' : GATES.levels.find((l) => n <= l.max).name);

// Approvals a run at this severity needs. null severity = brief, foundation, funnel, preview (the 0.1.0 behaviour).
export const approvalRequired = (id, sev) => {
  const a = GATES.approvals.find((x) => x.id === id);
  return !!a && (sev == null || sev >= a.minSeverity);
};

// Gates for a severity, split into those that run before the preview and those deferred until after it.
export function gatesFor(sev, dir) {
  const out = GATES.gates.filter((g) => (sev == null ? g.legacy : sev >= g.minSeverity) && (!g.requires || !dir || existsSync(join(dir, g.requires))))
    .map((g) => ({ ...g, phase: sev == null || (g.when === 'pre') || (g.preFrom && sev >= g.preFrom) ? 'pre' : 'post' }));
  return { pre: out.filter((g) => g.phase === 'pre'), post: out.filter((g) => g.phase === 'post') };
}

export const deployRe = () => new RegExp(`(^|[\\s;&|(])(${GATES.deployCommands.join('|')})`, 'i');
export const exists = (f) => existsSync(f);
