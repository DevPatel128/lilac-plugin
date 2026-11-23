// Tiny static server for the demo web apps: node serve.mjs <app-folder-name> [port]   e.g. node serve.mjs habits 4180
// Serves <app>/site only, refuses paths that escape it, applies the site's _headers file (CSP etc.), listens on 127.0.0.1 only.
// Not for production: use the host you chose (see each app's wrangler.jsonc). No dependencies.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname, normalize, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const name = process.argv[2];
if (!name || /[^a-z0-9-]/.test(name)) { console.error('usage: node serve.mjs <app-folder-name> [port]   (folder name: lowercase letters, digits, hyphens)'); process.exit(1); }
const root = resolve(join(dirname(fileURLToPath(import.meta.url)), name, 'site'));
const port = Number(process.argv[3] || 4180);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

// _headers (Cloudflare format): a path line, then indented "Name: value" lines. Supports "/*", "/prefix/*" and exact paths.
const rules = [];
try {
  let cur = null;
  for (const line of readFileSync(join(root, '_headers'), 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\S/.test(line)) { cur = { pattern: line.trim(), headers: {} }; rules.push(cur); }
    else if (cur) { const i = line.indexOf(':'); if (i > 0) cur.headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); }
  }
} catch { /* no _headers file: serve without extra headers */ }
const match = (p, url) => (p.endsWith('/*') ? url.startsWith(p.slice(0, -1)) || url === p.slice(0, -2) : p === url);
const headersFor = (url) => Object.assign({}, ...rules.filter((r) => match(r.pattern, url)).map((r) => r.headers));

createServer(async (req, res) => {
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); return res.end('Bad request'); }
  let file = normalize(join(root, url));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); return res.end('Forbidden'); }
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { /* not found: handled below */ }
  const extra = headersFor(url === '/' ? '/index.html' : url);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', ...extra });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', ...headersFor('/*') });
    res.end(await readFile(join(root, '404.html')).catch(() => 'Not found'));
  }
}).listen(port, '127.0.0.1', () => console.log(`${name} on http://127.0.0.1:${port}`));
