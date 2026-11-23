// Tiny static file server for previewing a demo site: node serve.mjs <site-folder-name> [port]   e.g. node serve.mjs dog-food 4173
// Serves <site-folder-name>/site only, refuses paths that escape it, falls back to that site's 404.html. Listens on 127.0.0.1 only.
// Not for production: use the host you chose (see each site's wrangler.jsonc / hosting.json). No dependencies.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const name = process.argv[2];
if (!name || /[^a-z0-9-]/.test(name)) { console.error('usage: node serve.mjs <site-folder-name> [port]   (folder name: lowercase letters, digits, hyphens)'); process.exit(1); }
const root = resolve(join(dirname(fileURLToPath(import.meta.url)), name, 'site'));
const port = Number(process.argv[3] || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = normalize(join(root, url));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { /* not found: handled below */ }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile(join(root, '404.html')).catch(() => 'Not found'));
  }
}).listen(port, '127.0.0.1', () => console.log(`${name} on http://127.0.0.1:${port}`));
