#!/usr/bin/env node
// Lilac preview: look at the site locally before anything is published, and record the human's approval of exactly what they saw.
// Usage: node scripts/preview.mjs start   --project <dir> [--port N]     local static server on 127.0.0.1 only
//        node scripts/preview.mjs approve --project <dir> --by "<name>" --quote "<the human's own words>"
//        node scripts/preview.mjs status  --project <dir>                prints VALID | STALE | NONE (exit 0 | 1 | 1)
// Approval = .lilac/publish-approval.json {sha256 over all site files (sorted path + content), by, quote, at}. Any edit makes it STALE.
// Site folder detection matches qa.mjs: site, public, dist, out, build (with .html), else the root if it has index.html.
// Network: the server uses node:http bound to 127.0.0.1 (not reachable from other machines); no outbound calls, no child processes.
// hosting.mjs imports siteDir/approvalStatus from here so there is one definition of VALID.
// Approval is advisory: --by and --quote are typed by whoever runs the CLI, nothing proves a human did (audit M-7). It is a record and a staleness check, not an authentication.
// Server: Host must be 127.0.0.1:<port> or localhost:<port> (DNS rebinding), dotfiles and tool folders are never served, symlinks that leave the site folder are refused, no directory listing.
// shortcut: root-as-site hashes everything except dot-tool folders and node_modules; upgrade if a project keeps other non-site files at its root.
import { existsSync, readFileSync, readdirSync, statSync, lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { join, resolve, relative, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { safeWriteFile } from '../lib/safe-fs.mjs';

const SKIP = new Set(['node_modules', '.git', '.lilac', '.github', '.wrangler', '.vercel']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.woff2': 'font/woff2' };

function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const f = join(d, e.name); e.isDirectory() && !e.isSymbolicLink() ? walk(f, out) : out.push(f); // a symlink is listed as a file and hashed by its target string, never read through
  }
  return out;
}
const hasHtml = (d) => existsSync(d) && statSync(d).isDirectory() && walk(d).some((f) => f.endsWith('.html'));

export function siteDir(project) {
  const root = resolve(project);
  const d = ['site', 'public', 'dist', 'out', 'build'].map((n) => join(root, n)).find(hasHtml);
  return d ?? (existsSync(join(root, 'index.html')) ? root : null);
}

export function siteHash(dir) {
  const h = createHash('sha256');
  for (const f of walk(dir).map((f) => relative(dir, f).split(sep).join('/')).sort()) h.update(f + '\0').update(lstatSync(join(dir, f)).isSymbolicLink() ? 'symlink:' + readlinkSync(join(dir, f)) : readFileSync(join(dir, f))).update('\0');
  return h.digest('hex');
}

export function approvalStatus(project) {
  const dir = siteDir(project), file = join(resolve(project), '.lilac/publish-approval.json');
  if (!dir || !existsSync(file)) return 'NONE';
  try { return JSON.parse(readFileSync(file, 'utf8')).sha256 === siteHash(dir) ? 'VALID' : 'STALE'; } catch { return 'NONE'; }
}

function main() {
  const args = process.argv.slice(2), cmd = args[0];
  const flag = (n) => { const i = args.indexOf(`--${n}`); return i > 0 ? args[i + 1] : undefined; };
  const project = resolve(flag('project') ?? '.');
  const fail = (m) => { console.error(`preview: ${m}`); process.exit(1); };
  if (!['start', 'approve', 'status'].includes(cmd)) fail('usage: start --project <dir> [--port N] | approve --project <dir> --by <name> --quote <words> | status --project <dir>');
  const dir = siteDir(project);
  if (!dir) fail('no site folder found (looked for site, public, dist, out, build with .html, or index.html in the root)');

  if (cmd === 'status') { const s = approvalStatus(project); console.log(s === 'VALID' ? 'VALID: the site is unchanged since the human approved it.' : s === 'STALE' ? 'STALE: the site changed since approval. Run /lilac:preview again.' : 'NONE: no approval yet. Run /lilac:preview.'); process.exit(s === 'VALID' ? 0 : 1); }

  if (cmd === 'approve') {
    const by = (flag('by') ?? '').trim(), quote = (flag('quote') ?? '').trim();
    if (!by) fail('--by "<name>" is required');
    if (!quote) fail('--quote is required: pass the human\'s own words saying yes. Never approve on your own.');
    try { safeWriteFile(project, '.lilac/publish-approval.json', JSON.stringify({ sha256: siteHash(dir), by, quote, at: new Date().toISOString() }, null, 2) + '\n', { overwrite: true }); } catch (e) { fail(e.message); }
    console.log('preview: approval recorded. Editing any site file makes it STALE.'); process.exit(0);
  }

  const port = Number(flag('port') ?? 4173);
  const base = realpathSync(dir);
  const HDR = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cross-origin-resource-policy': 'same-origin', 'cache-control': 'no-store' };
  const send = (res, code, body, type = 'text/plain; charset=utf-8') => res.writeHead(code, { ...HDR, 'content-type': type }).end(body);
  const srv = createServer((req, res) => {
    const host = (req.headers.host ?? '').toLowerCase(), p = srv.address().port;
    if (host !== `127.0.0.1:${p}` && host !== `localhost:${p}`) { send(res, 421, 'bad host'); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, 'method not allowed'); return; }
    let rel; try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { send(res, 400, 'bad request'); return; }
    if (rel.includes('\0') || rel.split(/[\\/]/).some((seg) => seg.startsWith('.') && seg !== '.' || SKIP.has(seg))) { send(res, 404, 'not found'); return; }
    let f; try { f = realpathSync(resolve(base, '.' + rel)); if (statSync(f).isDirectory()) f = realpathSync(join(f, 'index.html')); } catch { send(res, 404, 'not found'); return; }
    if (f !== base && !f.startsWith(base + sep)) { send(res, 403, 'forbidden'); return; } // a symlink may not lead out of the site folder
    if (!statSync(f).isFile()) { send(res, 404, 'not found'); return; }
    send(res, 200, req.method === 'HEAD' ? '' : readFileSync(f), TYPES[extname(f).toLowerCase()] ?? 'application/octet-stream');
  });
  srv.listen(port, '127.0.0.1', () => {
    console.log(`http://127.0.0.1:${srv.address().port}/`);
    console.log('Open this, look around, then tell the agent yes or what to change.');
  });
}

// realpath: node resolves import.meta.url through symlinks (macOS /var -> /private/var), so argv[1] must be resolved too or the CLI silently does nothing (audit L-6)
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
