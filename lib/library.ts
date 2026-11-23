// Per-user learning library: redacted records kept under the user's home, private to each agent. No network use.
// Imports './redact.ts': in this repo that is the shim next to this file; the plugin build copies
// architecture/core/redact.ts and secret.ts into lib/ instead (and must skip the shim).
import { existsSync, lstatSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hasSecret, scrub } from './redact.ts';

const AGENT = /^[a-z][a-z0-9-]{1,30}$/;
const PLUGIN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The user's Lilac folder: `$LILAC_HOME` or `~/.lilac`. */
export const userRoot = (env: NodeJS.ProcessEnv = process.env): string => env.LILAC_HOME || join(homedir(), '.lilac');

/** Folder for one agent's learned records; throws `bad agent name` for anything but a lowercase slug. */
export function agentDir(agent: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!AGENT.test(agent)) throw new Error('bad agent name');
  return join(userRoot(env), 'agents', agent, 'learned');
}

/** `LILAC_PRIVATE_DIR` only if it is an existing directory outside the plugin's own folder, else `undefined`. */
export function privateRoot(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const p = env.LILAC_PRIVATE_DIR;
  if (!p || !existsSync(p) || !statSync(p).isDirectory()) return undefined;
  const rel = relative(PLUGIN_DIR, resolve(p));
  return rel === '' || !(rel.startsWith('..') || isAbsolute(rel)) ? undefined : p;
}

// Create `dir` (mode 0o700) below `base`, refusing any symlink on the way so writes cannot leave `base`.
function safeMkdir(base: string, dir: string): void {
  let cur = base;
  for (const part of relative(base, dir).split(sep)) {
    cur = join(cur, part);
    const st = lstatSync(cur, { throwIfNoEntry: false });
    if (!st) mkdirSync(cur, { mode: 0o700 });
    else if (st.isSymbolicLink()) throw new Error(`refusing symlink: ${cur}`);
  }
}

/** Scrub `body`, refuse if it still looks secret, then write it 0o600; returns the file path. */
export function writeRecord(agent: string, kind: 'run' | 'lesson' | 'pattern', body: string, env: NodeJS.ProcessEnv = process.env): string {
  const dir = join(agentDir(agent, env), `${kind}s`);
  const text = scrub(body);
  if (hasSecret(text)) throw new Error('record still looks like a secret; not written');
  const root = userRoot(env);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  safeMkdir(root, dir);
  const path = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}.md`);
  writeFileSync(path, text, { mode: 0o600, flag: 'wx' });
  return path;
}

/** List an agent's record paths; only the agent itself may read its library. */
export function readLibrary(agent: string, caller: string, env: NodeJS.ProcessEnv = process.env): string[] {
  const dir = agentDir(agent, env);
  if (caller !== agent) throw new Error('library is private to its agent');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name)).sort();
}
