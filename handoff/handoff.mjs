#!/usr/bin/env node
// Lilac handoff generator: facts-only HANDOFF.md, HANDOFF.pdf (system Chrome headless) and HANDOFF.pptx (hand-built OOXML zip).
// Usage: node operations/plugin/handoff/handoff.mjs <projectDir> [--out dir]   (default out: <projectDir>/.lilac/handoff)
// No network, no AI call, no global installs. Read-only on the project. Every output goes through architecture/core/redact.ts scrub.
// shortcut: Mermaid is shown as code, not rendered; upgrade by bundling mermaid.js if diagrams must be drawn.
import { readdirSync, readFileSync, writeFileSync, existsSync, lstatSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { join, extname, relative, resolve, basename, dirname } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { deflateRawSync, crc32 } from 'node:zlib';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { scrub, hasSecret } from '../lib/redact.ts';
import { SECRET } from '../lib/secret.ts';
import { safeWriteFile } from '../lib/safe-fs.mjs';

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const proj = args.find((a, i) => !a.startsWith('--') && (oi < 0 || i !== oi + 1)); // the project is the first argument that is not the value of --out
if (!proj || (oi >= 0 && !args[oi + 1]) || !existsSync(proj)) { console.error('usage: handoff.mjs <projectDir> [--out dir]'); process.exit(2); }
const root = resolve(proj);
const out = resolve(oi >= 0 ? args[oi + 1] : join(root, '.lilac', 'handoff'));
// Every output goes through safe-fs: refuses symlinks on the path below its root (root = the project for the default out, else the out folder itself).
const outRoot = oi >= 0 ? out : root, outPrefix = oi >= 0 ? '' : join('.lilac', 'handoff');
const put = (name, data) => { try { safeWriteFile(outRoot, join(outPrefix, name), data, { overwrite: true }); } catch (e) { console.error(`handoff: ${e.message}`); process.exit(1); } };

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'out', 'build', 'coverage', '.lilac', '.venv', 'Pods', '.vercel', '.wrangler', 'backups']);
const LANG = { '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.sql': 'SQL', '.css': 'CSS', '.sh': 'Shell', '.py': 'Python', '.swift': 'Swift', '.kt': 'Kotlin', '.rb': 'Ruby', '.java': 'Java', '.html': 'HTML' };
const TEXT = new Set([...Object.keys(LANG), '.json', '.md', '.env', '.yml', '.yaml', '.toml', '.txt', '']);
const isLink = (p) => lstatSync(p, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
// Symlinks inside the project are never followed for reading: a repo could point them at files outside it.
const read = (p) => { try { return isLink(p) ? null : readFileSync(p, 'utf8'); } catch { return null; } };
const first = (...names) => { for (const n of names) { const p = join(root, n); if (existsSync(p) && !isLink(p)) return p; } return null; };

// ---------- facts ----------
const files = [];
(function walk(d) {
  let ents; try { ents = readdirSync(d, { withFileTypes: true }); } catch { return; } // unreadable folder: skip
  for (const e of ents) {
    const p = join(d, e.name);
    // Dot-folders (.claude worktrees, .astro, .open-next), backups and agent worktrees are tool output or copies, not the product.
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('.') && !/^(backup|.*worktrees)$/.test(e.name)) walk(p); continue; }
    if (files.length < 5000) files.push(p);
  }
})(root);
const rel = (p) => relative(root, p);
const pkgText = read(join(root, 'package.json'));
let pkg = null; try { pkg = pkgText && JSON.parse(pkgText); } catch { /* malformed: treated as absent */ }
const name = pkg?.name || basename(root);
const readmePath = first('README.md', 'readme.md', 'README');
const readme = readmePath ? read(readmePath) : null;
const git = (...a) => { try { return execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const commits = git('rev-list', '--count', 'HEAD');
const log = git('log', '-8', '--format=%ad %s', '--date=short');
const lastCommitTs = Number(git('log', '-1', '--format=%ct') ?? 0) * 1000;
const lang = {};
for (const f of files) if (LANG[extname(f)]) lang[LANG[extname(f)]] = (lang[LANG[extname(f)]] ?? 0) + 1;
const langs = Object.entries(lang).sort((a, b) => b[1] - a[1]);
const dirs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.')).map((e) => e.name);
const techPath = first('TECH-STACK.md', 'architecture/TECH-STACK.md', 'docs/TECH-STACK.md');
const tech = techPath ? read(techPath) : null;
const mermaid = tech ? [...tech.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1].trim()) : [];

const para = (t) => (t.split(/\n\s*\n/).map((s) => s.trim()).find((s) => s && !/^(#|!\[|<|\[!\[|---)/.test(s)) || '').replace(/\s+/g, ' ').slice(0, 300);
const bullets = (t) => t.split('\n').filter((l) => /^\s*([-*]|\d+\.)\s+\S/.test(l)).map((l) => l.replace(/^\s*([-*]|\d+\.)\s+(\[[ x]\]\s*)?/, '').trim());

// ---------- sections: { title, lines[] } ; lines starting with "```" blocks are kept whole ----------
const S = [];
const add = (title, lines) => S.push({ title, lines: lines.length ? lines : [`UNKNOWN: nothing found for ${title.toLowerCase()}`] });

const STOCK = /create-next-app|bootstrapped with|This is a \[?Next\.js|Vite \+ React template|Create React App/i;
const built = [];
if (pkg?.description) built.push(`Description (package.json): ${pkg.description}`);
// A stock framework README says nothing about this product: treat it as no README.
if (readme) { const p = para(readme); if (p && !STOCK.test(readme.slice(0, 600))) built.push(`README summary: ${p}`); }
if (dirs.length) built.push(`Top-level folders: ${dirs.slice(0, 15).join(', ')}`);
if (commits) built.push(`Git history: ${commits} commits`);
if (log) for (const l of log.split('\n').slice(0, 5)) built.push(`- ${l}`);
add('What was built', built.length ? built : ['UNKNOWN: no package.json description, README or git history to say what was built']);

const run = [];
if (pkg?.scripts) for (const [k, v] of Object.entries(pkg.scripts)) run.push(`- \`npm run ${k}\`: ${v}`);
const readCmds = readme && !STOCK.test(readme.slice(0, 600)) ? readme.split('\n').filter((l) => /^\s*(\$ )?(npm|pnpm|yarn|node|python3?|make|docker|bun) /.test(l)).map((l) => l.trim().replace(/^\$ /, '')) : [];
for (const c of readCmds.slice(0, 6)) run.push(`- README command: \`${c}\``);
add('How to run it', run.length ? [...run, 'Source: package.json scripts and README; commands were not executed.'] : ['UNVERIFIED: no package.json scripts and no README commands found; run steps are not known']);

const stack = [];
if (langs.length) stack.push(`Languages (by file count): ${langs.map(([l, n]) => `${l} ${n}`).join(', ')}`);
// Monorepos and sites with code/ or apps/*: read every package.json, not only the root one.
const deps = [...new Set(files.filter((f) => basename(f) === 'package.json').flatMap((f) => { try { const j = JSON.parse(read(f)); return Object.keys({ ...j.dependencies, ...j.devDependencies }); } catch { return []; } }))];
if (deps.length) stack.push(`Dependencies (package.json): ${deps.slice(0, 20).join(', ')}${deps.length > 20 ? ` and ${deps.length - 20} more` : ''}`);
const cfg = files.filter((f) => /^wrangler\.(jsonc?|toml)$/.test(basename(f))).map((f) => read(f) ?? '').join('\n');
const svc = ['supabase', 'vercel', 'wrangler', 'docker', 'firebase', 'prisma', 'stripe', 'resend'].filter((s) => dirs.includes(s) || deps.some((d) => d.includes(s)) || files.some((f) => new RegExp(`^${s}\\.(jsonc?|toml)$`).test(basename(f))));
for (const [k, n] of [['d1_databases', 'cloudflare-d1'], ['kv_namespaces', 'cloudflare-kv'], ['r2_buckets', 'cloudflare-r2']]) if (cfg.includes(k)) svc.push(n);
for (const [d, n] of [['hono', 'hono'], ['drizzle-orm', 'drizzle'], ['astro', 'astro'], ['vite-plugin-pwa', 'pwa']]) if (deps.includes(d)) svc.push(n);
stack.push(svc.length ? `Services (from folders/deps/config): ${svc.join(', ')}` : 'UNKNOWN: no services detected from folders, dependencies or config files');
if (techPath) stack.push(`Details: ${rel(techPath)}`);
for (const m of mermaid) stack.push('```mermaid\n' + m + '\n```');
if (!techPath) stack.push('UNKNOWN: TECH-STACK.md not present, so no architecture diagram');
add('Stack', stack);

const adr = [];
const dec = first('DECISIONS.md', 'docs/DECISIONS.md', 'architecture/DECISIONS.md');
if (dec) for (const l of (read(dec) ?? '').split('\n').filter((l) => /^#{2,3} /.test(l)).slice(0, 12)) adr.push(`- ${l.replace(/^#+ /, '')}`);
for (const d of ['docs/adr', 'adr', 'docs/decisions', 'architecture/decisions']) {
  if (existsSync(join(root, d)) && !isLink(join(root, d))) for (const f of readdirSync(join(root, d)).filter((f) => f.endsWith('.md')).slice(0, 12)) adr.push(`- ${d}/${f}: ${(read(join(root, d, f)) ?? '').split('\n').find((l) => /^# /.test(l))?.slice(2) ?? f}`);
}
add('Decisions', adr.length ? adr : ['none recorded']);

const risk = [];
const testFiles = files.filter((f) => /(\.|\/)(test|spec)\.[jt]sx?$|(^|\/)(tests?|__tests__)\//.test(rel(f)));
if (!pkg?.scripts?.test && !testFiles.length) risk.push('- No tests: no `test` script and no test files found');
else risk.push(`- Tests: ${testFiles.length} test files${pkg?.scripts?.test ? ', `test` script present' : ', no `test` script'} (not run)`);
if (techPath) risk.push(statSync(techPath).mtimeMs < lastCommitTs - 7 * 864e5 ? '- TECH-STACK.md is older than the last commit by more than 7 days (stale)' : '- TECH-STACK.md is current relative to the last commit');
else risk.push('- UNKNOWN: TECH-STACK.md absent, staleness cannot be checked');
let todo = 0; const secretHits = [], fixtureHits = [];
const ASSIGN = /\b[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY)[A-Z0-9_]*\s*=\s*(?!\[REDACT)\S{8,}/;
for (const f of files) {
  if (!TEXT.has(extname(f)) || statSync(f).size > 400_000) continue;
  const t = read(f); if (t == null) continue;
  todo += (t.match(/\b(TODO|FIXME)\b/g) ?? []).length;
  const lines = t.split('\n');
  for (let i = 0; i < lines.length; i++) if ((SECRET.test(lines[i]) || ASSIGN.test(lines[i])) && !/\.env\.example$/.test(f)) {
    // Test fixtures hold fake keys on purpose: list them apart so they do not read as leaks.
    const hit = `${rel(f)}:${i + 1}`;
    if (/(\.|\/)(test|spec)\.[jt]sx?$|(^|\/)(tests?|__tests__|fixtures?)\//.test(rel(f))) { if (fixtureHits.length < 5) fixtureHits.push(hit); } else if (secretHits.length < 10) secretHits.push(hit);
  }
}
risk.push(`- TODO/FIXME markers: ${todo}`);
if (fixtureHits.length) risk.push(`- Secret-shaped strings in test files (likely fake fixtures, check): ${fixtureHits.join(', ')}`);
risk.push(secretHits.length ? `- Possible secrets at: ${secretHits.join(', ')} (values withheld; rotate and remove)` : '- Secrets scan: no secret-shaped strings found');
if (existsSync(join(root, '.env')) && git('ls-files', '.env')) risk.push('- .env is tracked by git');
add('Open risks', risk);

const next = [];
const rm = first('ROADMAP.md', 'docs/ROADMAP.md', 'TODO.md', 'docs/TODO.md');
if (rm) next.push(`Source: ${rel(rm)}`, ...bullets(read(rm) ?? '').slice(0, 10).map((b) => `- ${b}`));
add('Next steps', next.length > 1 ? next : ['UNKNOWN: no ROADMAP.md or TODO.md found']);
S.push({ title: 'Handoff schema version', lines: ['Handoff schema version: 1'] });

// ---------- HANDOFF.md ----------
const md = scrub(`# Handoff: ${name}\n\n` + S.map((s) => `## ${s.title}\n\n${s.lines.join('\n')}\n`).join('\n'), Infinity);
put('HANDOFF.md', md);

// ---------- PDF via system Chrome ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
let html = ''; let fence = false;
for (const l of md.split('\n')) {
  if (l.startsWith('```')) { html += fence ? '</pre>' : '<pre>'; fence = !fence; if (!fence) continue; if (l.length > 3) continue; continue; }
  if (fence) html += esc(l) + '\n';
  else if (l.startsWith('# ')) html += `<h1>${inline(l.slice(2))}</h1>`;
  else if (l.startsWith('## ')) html += `<h2>${inline(l.slice(3))}</h2>`;
  else if (l.startsWith('- ')) html += `<p class="b">${inline(l.slice(2))}</p>`;
  else if (l.trim()) html += `<p>${inline(l)}</p>`;
}
const page = `<!doctype html><meta charset="utf-8"><style>body{font:13px/1.5 -apple-system,Helvetica,sans-serif;margin:0;color:#1d1b20}h1{font-size:26px;color:#5b3a8c}h2{font-size:17px;border-bottom:1px solid #d9cfe8;padding-bottom:3px;margin-top:20px}p{margin:4px 0}.b{padding-left:14px;text-indent:-10px}.b:before{content:"\\2022  "}code,pre{font:11px ui-monospace,Menlo,monospace;background:#f3eefa;padding:1px 4px;border-radius:3px}pre{padding:8px;white-space:pre-wrap}</style>${html}`;
const tmp = mkdtempSync(join(tmpdir(), 'lilac-handoff-'));
writeFileSync(join(tmp, 'h.html'), page);
// PDF is optional: find a browser ($CHROME, macOS, Linux PATH, Windows Chrome or Edge); without one, md and pptx are still written.
const onPath = (n) => (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').map((d) => join(d, n)).find((c) => c && existsSync(c));
const win = ['ProgramFiles', 'ProgramFiles(x86)'].flatMap((v) => process.env[v] ? [join(process.env[v], 'Google/Chrome/Application/chrome.exe'), join(process.env[v], 'Microsoft/Edge/Application/msedge.exe')] : []);
const CHROME = process.env.CHROME ? (existsSync(process.env.CHROME) ? process.env.CHROME : null)
  : [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(onPath), ...win].find((c) => c && existsSync(c));
let pdfNote = '', hasPdf = false;
if (CHROME) {
  // Chrome writes to the private temp dir; the result is copied through safe-fs. No --no-sandbox unless LILAC_CHROME_NO_SANDBOX=1 (needed in containers that run as root).
  const tmpPdf = join(tmp, 'HANDOFF.pdf');
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', ...(process.env.LILAC_CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), '--no-pdf-header-footer', `--user-data-dir=${join(tmp, 'u')}`, `--print-to-pdf=${tmpPdf}`, pathToFileURL(join(tmp, 'h.html')).href], { stdio: 'ignore', timeout: 60000 });
  if (existsSync(tmpPdf)) { put('HANDOFF.pdf', readFileSync(tmpPdf)); hasPdf = true; }
  if (r.status !== 0 && !hasPdf) pdfNote = 'PDF: Chrome failed' + (process.getuid?.() === 0 ? ' (running as root: set LILAC_CHROME_NO_SANDBOX=1)' : '');
} else pdfNote = 'PDF skipped: no Chrome found. HANDOFF.md and HANDOFF.pptx were still written; set CHROME=/path/to/chrome (or msedge) to get HANDOFF.pdf.';
if (pdfNote) console.error(pdfNote);
rmSync(tmp, { recursive: true, force: true });

// ---------- PPTX: OOXML zip written by hand (stored+deflate zip, crc32 from node:zlib) ----------
const X = (s) => esc(scrub(s, 200)).replace(/"/g, '&quot;');
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const sec = (t) => S.find((s) => s.title === t).lines.filter((l) => !l.startsWith('```'));
const slideDefs = [
  { t: name, body: [`Handoff, schema version 1`, ...sec('What was built').slice(0, 2)] },
  { t: 'What was built', body: sec('What was built') },
  { t: 'Stack', body: sec('Stack') },
  mermaid.length ? { t: 'How it works', body: mermaid[0].split('\n'), mono: true } : { t: 'How to run it', body: sec('How to run it') },
  { t: 'Decisions', body: sec('Decisions') },
  { t: 'Open risks', body: sec('Open risks') },
  { t: 'Next steps', body: sec('Next steps') },
];
const para1 = (txt, sz, mono) => `<a:p><a:r><a:rPr lang="en-US" sz="${sz}" dirty="0">${mono ? '<a:latin typeface="Courier New"/>' : ''}</a:rPr><a:t>${X(txt)}</a:t></a:r></a:p>`;
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const sp = (id, nm, x, y, w, h, paras) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${nm}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr wrap="square"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
const slideXml = (d, i) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${i === 0 ? '5B3A8C' : 'FFFFFF'}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${sp(2, 'Title', 600000, 400000, 10992000, 1000000, para1(clip(d.t, 60), i === 0 ? 4400 : 3200, false).replace('dirty="0">', `dirty="0"><a:solidFill><a:srgbClr val="${i === 0 ? 'FFFFFF' : '5B3A8C'}"/></a:solidFill>`))}${sp(3, 'Body', 600000, 1600000, 10992000, 4800000, d.body.slice(0, 9).map((b) => para1(clip(b, d.mono ? 90 : 120), d.mono ? 1400 : 1800, d.mono)).join('').replace(/dirty="0">/g, `dirty="0"><a:solidFill><a:srgbClr val="${i === 0 ? 'FFFFFF' : '1D1B20'}"/></a:solidFill>`))}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL = (items) => `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, t, tg]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${t}" Target="${tg}"/>`).join('')}</Relationships>`;
const emptyTree = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>';
const fills = '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>';
const ln = '<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>';
const theme = `${H}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Lilac"><a:themeElements><a:clrScheme name="Lilac"><a:dk1><a:srgbClr val="1D1B20"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="5B3A8C"/></a:dk2><a:lt2><a:srgbClr val="F3EEFA"/></a:lt2>${[1, 2, 3, 4, 5, 6].map((n) => `<a:accent${n}><a:srgbClr val="5B3A8C"/></a:accent${n}>`).join('')}<a:hlink><a:srgbClr val="5B3A8C"/></a:hlink><a:folHlink><a:srgbClr val="5B3A8C"/></a:folHlink></a:clrScheme><a:fontScheme name="Lilac"><a:majorFont><a:latin typeface="Helvetica"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Helvetica"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Lilac">${fills.replace('fillStyleLst', 'fillStyleLst')}<a:lnStyleLst>${ln}${ln}${ln}</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>${fills.replace(/fillStyleLst/g, 'bgFillStyleLst')}</a:fmtScheme></a:themeElements></a:theme>`;
const n = slideDefs.length;
const parts = {
  '[Content_Types].xml': `${H}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slideDefs.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`,
  '_rels/.rels': REL([['rId1', 'officeDocument', 'ppt/presentation.xml']]),
  'ppt/presentation.xml': `${H}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideDefs.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
  'ppt/_rels/presentation.xml.rels': REL([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ...slideDefs.map((_, i) => [`rId${i + 2}`, 'slide', `slides/slide${i + 1}.xml`]), [`rId${n + 2}`, 'theme', 'theme/theme1.xml']]),
  'ppt/slideMasters/slideMaster1.xml': `${H}<p:sldMaster ${NS}><p:cSld>${emptyTree}</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
  'ppt/slideMasters/_rels/slideMaster1.xml.rels': REL([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']]),
  'ppt/slideLayouts/slideLayout1.xml': `${H}<p:sldLayout ${NS} type="blank"><p:cSld name="Blank">${emptyTree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels': REL([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]),
  'ppt/theme/theme1.xml': theme,
};
slideDefs.forEach((d, i) => { parts[`ppt/slides/slide${i + 1}.xml`] = H + slideXml(d, i).replace(/^<\?xml[^>]*\?>/, ''); parts[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = REL([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']]); });
function zip(entries) {
  const chunks = [], cd = []; let off = 0;
  for (const [nm, txt] of Object.entries(entries)) {
    if (!/^[A-Za-z0-9_\[\]][A-Za-z0-9_.\[\]\/-]*$/.test(nm) || nm.split('/').some((p) => p === '..' || p === '')) throw new Error(`unsafe zip entry name ${JSON.stringify(nm)}`); // zip-slip guard: names are fixed, but never emit a path that could escape on extraction
    const nb = Buffer.from(nm), raw = Buffer.from(txt), def = deflateRawSync(raw), c = crc32(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(c, 14); lh.writeUInt32LE(def.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(c, 16); ch.writeUInt32LE(def.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    chunks.push(lh, nb, def); cd.push(ch, nb); off += 30 + nb.length + def.length;
  }
  const cdb = Buffer.concat(cd), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(cd.length / 2, 8); end.writeUInt16LE(cd.length / 2, 10); end.writeUInt32LE(cdb.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...chunks, cdb, end]);
}
put('HANDOFF.pptx', zip(parts));
console.log(`handoff written to ${out}: HANDOFF.md ${hasPdf ? 'HANDOFF.pdf ' : ''}HANDOFF.pptx (${n} slides)`);
