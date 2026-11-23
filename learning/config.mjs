// Learning consent switch: stored in <userRoot>/config.json (0600). DEFAULT OFF; nothing is captured while off. No network.
// CLI: node config.mjs status|on|off
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { userRoot } from '../lib/library.ts';

const file = (env = process.env) => join(userRoot(env), 'config.json');
const read = (env) => { try { return JSON.parse(readFileSync(file(env), 'utf8')); } catch { return {}; } };
function set(on, env) {
  mkdirSync(userRoot(env), { recursive: true, mode: 0o700 });
  writeFileSync(file(env), JSON.stringify({ ...read(env), learn: on }) + '\n', { mode: 0o600 });
  chmodSync(file(env), 0o600);
}

/** 'on' only when the user explicitly turned learning on. */
export const learnStatus = (env = process.env) => (existsSync(file(env)) && read(env).learn === true ? 'on' : 'off');
export const learnOn = (env = process.env) => set(true, env);
export const learnOff = (env = process.env) => set(false, env);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const c = process.argv[2];
  if (c === 'on') learnOn(); else if (c === 'off') learnOff(); else if (c !== 'status') { console.error('usage: config.mjs status|on|off'); process.exit(2); }
  console.log(learnStatus());
}
