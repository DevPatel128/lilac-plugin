// Safe writes into a user's project (security review M-2). A repository can ship a symlink where Lilac
// later writes; plain writeFileSync would follow it and overwrite a file outside the project.
// Rules: relative path only, no "..", no NUL, no existing symlink on any component below `root`,
// result must stay inside `root`, write via a temp file created with `wx`, then rename. No network.
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';

const bad = (why, rel) => new Error(`refusing to write ${JSON.stringify(rel)}: ${why}`);

function check(root, rel) {
  if (typeof rel !== 'string' || !rel) throw bad('empty path', rel);
  if (rel.includes('\0')) throw bad('NUL byte in path', rel);
  if (isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) throw bad('absolute path', rel);
  const parts = rel.split(/[\\/]+/).filter((x) => x && x !== '.');
  if (parts.includes('..')) throw bad('".." in path', rel);
  const base = resolve(root);
  const target = resolve(base, ...parts);
  const r = relative(base, target);
  if (r === '' || r.startsWith('..') || isAbsolute(r)) throw bad('outside the project folder', rel);
  mkdirSync(base, { recursive: true }); // the project folder itself is the user's choice (it may be a symlink such as /tmp on macOS); only paths below it are checked
  return { base, parts, target };
}

// Walk every component below base; create missing dirs, refuse a symlink (lstat does not follow).
function walk(base, parts, create, mode, rel) {
  let cur = base;
  for (const part of parts) {
    cur = join(cur, part);
    const st = lstatSync(cur, { throwIfNoEntry: false });
    if (!st) { if (!create) return cur; mkdirSync(cur, { mode }); } else if (st.isSymbolicLink()) throw bad(`symlink in path (${cur})`, rel);
    else if (!st.isDirectory() && cur !== join(base, ...parts)) throw bad(`not a folder (${cur})`, rel);
  }
  return cur;
}

/** Create `relPath` (and parents) under `root`, refusing symlinks. Returns the absolute folder. */
export function safeMkdir(root, relPath, { mode = 0o755 } = {}) {
  const { base, parts, target } = check(root, relPath);
  walk(base, parts, true, mode, relPath);
  if (!lstatSync(target).isDirectory()) throw bad('not a folder', relPath);
  return target;
}

/**
 * Write `data` to `relPath` under `root`: refuses absolute, "..", NUL, any symlink in the path and any target
 * outside `root`; atomic (temp file `wx` in the same folder, then rename). `overwrite` defaults to false.
 * shortcut: a race between the lstat and the rename is not closed, a local attacker with write access to the project can win it; upgrade to openat/O_NOFOLLOW if that matters.
 */
export function safeWriteFile(root, relPath, data, { mode = 0o644, overwrite = false } = {}) {
  const { base, parts, target } = check(root, relPath);
  const dir = walk(base, parts.slice(0, -1), true, 0o755, relPath);
  const st = lstatSync(target, { throwIfNoEntry: false });
  if (st && st.isSymbolicLink()) throw bad('target is a symlink', relPath);
  if (st && st.isDirectory()) throw bad('target is a folder', relPath);
  if (st && !overwrite) throw bad('file exists (overwrite not allowed)', relPath);
  const tmp = join(dir, `.${basename(target)}.${randomBytes(6).toString('hex')}.tmp`);
  const fd = openSync(tmp, 'wx', mode);
  try { writeSync(fd, typeof data === 'string' ? data : Buffer.from(data)); } catch (e) { closeSync(fd); unlinkSync(tmp); throw e; }
  closeSync(fd);
  try { renameSync(tmp, target); } catch (e) { unlinkSync(tmp); throw e; }
  return target;
}

/** Delete one file below `root`; same path rules as safeWriteFile. A missing file is fine; a folder is refused. */
export function safeRemove(root, relPath) {
  const { base, parts, target } = check(root, relPath);
  walk(base, parts.slice(0, -1), false, 0o755, relPath);
  const st = lstatSync(target, { throwIfNoEntry: false });
  if (!st) return false;
  if (st.isDirectory()) throw bad('target is a folder', relPath);
  unlinkSync(target); // a symlink target is unlinked itself (never followed), which is safe
  return true;
}

/**
 * Bind a project root once, for CLI scripts. Paths may be absolute (computed from root) or relative; they are
 * converted to root-relative and still go through safeWriteFile, so a path outside root is refused.
 * A refusal prints one clear line and exits 1 (nothing written); pass {throws:true} to get the Error instead.
 */
export function scoped(root, { throws = false } = {}) {
  const rel = (p) => (isAbsolute(p) ? relative(resolve(root), p) : p);
  const run = (f) => { try { return f(); } catch (e) { if (throws || !/^refusing to write/.test(e.message)) throw e; console.error(`lilac: ${e.message}`); process.exit(1); } };
  return {
    write: (p, data, o = {}) => run(() => safeWriteFile(root, rel(p), data, { overwrite: true, ...o })),
    mkdir: (p, o) => run(() => safeMkdir(root, rel(p), o)),
    rm: (p) => run(() => safeRemove(root, rel(p))),
    copy: (src, p, o = {}) => run(() => safeWriteFile(root, rel(p), readFileSync(src), { overwrite: true, ...o })),
  };
}
