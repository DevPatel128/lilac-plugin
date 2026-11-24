#!/usr/bin/env node
// Lilac context: reads what the user already has (their own repos and pasted text) and PROPOSES brief facts. Read-only.
// Usage: node scripts/context.mjs read <dir> --repo <path> [--repo <path2>] [--paste <file>]... [--out <dir>]
//          writes <out|dir>/CONTEXT.md and <out|dir>/.lilac/context.json; every source file path goes to <out|dir>/.lilac/context-sources.log
//        node scripts/context.mjs answers <dir> [--out <dir>]   prints which BRIEF parts (B R I E F) the context can pre-fill as PROPOSED
// Reads ONLY paths passed explicitly. Nothing is crawled by default. No network, no GitHub/Instagram access: online presence = text the user pastes into a file (--paste).
// Reads only files that carry intent (README*, docs/*.md, package.json, tailwind/css tokens, content md/json, html titles and headings).
// Never reads .env*, keys, *.pem, id_rsa*, lockfiles, node_modules, .git. Symlinks are never followed. Caps: 256 KB per file, 200 files per repo, depth 6.
// Secrets, emails and phone numbers are redacted. Facts stay PROPOSED: nothing enters BRIEF.md until the user says yes.
// shortcut: facts are first-heading/first-paragraph heuristics and hex/font regexes, so they can miss odd layouts; extend the lists below when a real repo slips through.
import { lstatSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, basename, extname, sep } from 'node:path';
import { scoped } from '../lib/safe-fs.mjs';

const MAX_BYTES = 256 * 1024, MAX_FILES = 200, MAX_DEPTH = 6;
// Same idea as build.mjs SECRET, plus phones and key=value secrets.
const SECRET = /(sk-[A-Za-z0-9]{20,}|sk[-_](?:live|test)[-_][A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY[\s\S]*|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]*|[\w.+-]+@[\w-]+\.[\w.-]+|(?:api[_-]?key|secret|token|passw(?:or)?d)\s*[:=]\s*\S+|\+\d[\d\s().-]{8,}\d|\(?\d{3,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4})/gi;
export const redact = (s) => String(s ?? '').replace(SECRET, '[REDACTED]');
const DENY = /^\.env|\.(pem|key|p12|pfx|crt|cer|keystore)$|^id_(rsa|dsa|ed25519|ecdsa)|^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|composer\.lock|Gemfile\.lock|Cargo\.lock)$|\.lock$|^\.(npmrc|netrc|htpasswd)$|^(credentials|secrets?)(\.|$)/i;
const SKIP_DIR = new Set(['node_modules', '.git', '.hg', '.svn', 'dist', 'build', '.next', '.cache', '.lilac', 'vendor', '.venv']);
const TOKEN_CSS = /(token|theme|variable|global|style|tailwind|main|app|index|base)/i;

function wanted(rel, name) {
  if (DENY.test(name)) return false;
  const parts = rel.split(sep), ext = extname(name).toLowerCase();
  if (/^readme/i.test(name)) return true;
  if (name === 'package.json') return parts.length <= 2; // root or one level (workspaces): enough for a stack
  if (/^tailwind\.config\./.test(name)) return true;
  if (ext === '.css') return TOKEN_CSS.test(name);
  if (parts[0] === 'docs' && ext === '.md') return true;
  if (parts[0] === 'content' && (ext === '.md' || ext === '.json')) return true;
  if (ext === '.html' || ext === '.htm') return true;
  return false;
}
function stackOnly(name) { return /^(astro|next|nuxt|vite|svelte|remix|gatsby|eleventy|\.eleventy)\.config\./i.test(name) || name === 'wrangler.toml' || name === 'vercel.json' || name === 'netlify.toml'; }

function collect(root) {
  const out = [], names = [];
  const walk = (dir, depth) => {
    if (out.length >= MAX_FILES || depth > MAX_DEPTH) return;
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); } catch { return; }
    for (const e of ents) {
      if (out.length >= MAX_FILES) return;
      const p = join(dir, e.name), st = lstatSync(p, { throwIfNoEntry: false });
      if (!st || st.isSymbolicLink()) continue; // never follow
      if (st.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(p, depth + 1); continue; }
      if (!st.isFile()) continue;
      const rel = relative(root, p);
      if (stackOnly(e.name)) names.push(rel);
      if (wanted(rel, e.name) && st.size <= MAX_BYTES) out.push(p);
    }
  };
  walk(root, 0);
  return { files: out, names };
}
const read = (p) => redact(readFileSync(p, 'utf8'));
const add = (arr, o) => { if (o.value && !arr.some((x) => x.value === o.value && x.source === o.source)) arr.push(o); };

export function analyze(repos, pastes, log) {
  const stack = [], colours = [], fonts = [], facts = [], pages = [];
  const STACK = { next: 'Next.js', react: 'React', vue: 'Vue', svelte: 'Svelte', astro: 'Astro', vite: 'Vite', tailwindcss: 'Tailwind CSS', express: 'Express', nuxt: 'Nuxt', '@11ty/eleventy': 'Eleventy', gatsby: 'Gatsby', typescript: 'TypeScript', '@sveltejs/kit': 'SvelteKit', remix: 'Remix' };
  for (const repo of repos) {
    const root = resolve(repo), st = lstatSync(root, { throwIfNoEntry: false });
    if (!st || !st.isDirectory()) { console.error(`context: not a folder: ${repo}`); process.exit(2); }
    const { files, names } = collect(root);
    for (const n of names) add(stack, { value: `${n.split(sep).pop().split('.')[0]} (config file present)`, source: `${basename(root)}/${n}` });
    for (const f of files) {
      const rel = `${basename(root)}/${relative(root, f)}`, name = basename(f), ext = extname(f).toLowerCase();
      log.push(f); let t;
      try { t = read(f); } catch { continue; }
      if (name === 'package.json') {
        let j; try { j = JSON.parse(t); } catch { j = null; }
        if (j) {
          for (const d of Object.keys({ ...j.dependencies, ...j.devDependencies })) if (STACK[d]) add(stack, { value: STACK[d], source: rel });
          if (j.name) add(facts, { value: `Project name: ${j.name}`, source: rel });
          if (j.description) add(facts, { value: `Description: ${j.description}`, source: rel });
        }
      } else if (/^tailwind\.config\./.test(name) || ext === '.css') {
        add(stack, { value: /^tailwind/.test(name) ? 'Tailwind CSS' : '', source: rel });
        for (const m of t.matchAll(/(--[\w-]+|['"]?[\w-]+['"]?)\s*:\s*['"]?(#[0-9a-fA-F]{3,8})\b/g)) add(colours, { value: `${m[1].replace(/['"]/g, '')} ${m[2]}`, source: rel });
        for (const m of t.matchAll(/font-family\s*:\s*([^;}\n]+)/gi)) add(fonts, { value: m[1].trim(), source: rel });
        for (const m of t.matchAll(/(--font[\w-]*)\s*:\s*([^;}\n]+)/gi)) add(fonts, { value: `${m[1]}: ${m[2].trim()}`, source: rel });
        for (const m of t.matchAll(/fontFamily\s*:\s*\{([^}]*)\}/g)) add(fonts, { value: m[1].replace(/\s+/g, ' ').trim(), source: rel });
      } else if (ext === '.html' || ext === '.htm') {
        const title = t.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/\s+/g, ' ').trim();
        if (title) { add(facts, { value: `Page title: ${title}`, source: rel }); add(pages, { value: title, source: rel }); }
        for (const m of [...t.matchAll(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/gi)].slice(0, 4)) { const h = m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); if (h) add(facts, { value: `Heading: ${h}`, source: rel }); }
      } else if (ext === '.json') {
        let j; try { j = JSON.parse(t); } catch { j = null; }
        const v = j && !Array.isArray(j) && (j.title || j.name); if (typeof v === 'string') add(facts, { value: `Content title: ${v}`, source: rel });
      } else { // markdown
        const body = t.replace(/^---[\s\S]*?\n---\n/, ''), h = body.match(/^#\s+(.+)$/m)?.[1];
        const para = body.split(/\n\s*\n/).map((x) => x.trim()).find((x) => x && !/^[#>!\[|`-]/.test(x));
        if (h) add(facts, { value: `Heading: ${h.trim()}`, source: rel });
        if (para && /^readme/i.test(name)) add(facts, { value: `Says: ${para.replace(/\s+/g, ' ').slice(0, 240)}`, source: rel });
        if (/^content/.test(relative(root, f)) && h) add(pages, { value: h.trim(), source: rel });
      }
    }
  }
  for (const p of pastes) {
    const name = basename(p), st = lstatSync(p, { throwIfNoEntry: false });
    if (!st || st.isSymbolicLink() || !st.isFile() || DENY.test(name) || st.size > MAX_BYTES) { console.error(`context: not reading paste file ${p} (missing, symlink, secret-type name or over 256 KB)`); continue; }
    log.push(resolve(p));
    const lines = read(p).split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20);
    for (const l of lines) add(facts, { value: `Pasted: ${l.slice(0, 240)}`, source: `paste:${name}` });
  }
  return { stack: stack.filter((x) => x.value), colours: colours.slice(0, 40), fonts: fonts.slice(0, 20), facts: facts.slice(0, 60), pages: pages.slice(0, 30) };
}

export function prefill(c) {
  const have = (k) => c[k]?.length > 0, src = (k) => [...new Set(c[k].map((x) => x.source))].slice(0, 5);
  const out = [];
  if (have('facts')) out.push({ part: 'B', name: 'Business', slot: 2, what: 'true facts (name, description, headings)', source: src('facts') });
  if (have('pages')) out.push({ part: 'E', name: 'Experience', slot: 1, what: 'pages (titles found in the past site)', source: src('pages') });
  return out;
}
const md = (title, rows) => rows.length ? `## ${title}\n\n${rows.map((r) => `- PROPOSED: ${r.value} (source: \`${r.source}\`)`).join('\n')}\n\n` : `## ${title}\n\nNone found. UNKNOWN.\n\n`;

const argv = process.argv.slice(2), cmd = argv[0], dir = argv[1];
const opt = (f) => argv.flatMap((a, i) => (a === f && argv[i + 1] ? [argv[i + 1]] : []));
if (cmd === 'read' && dir) {
  const repos = opt('--repo'), pastes = opt('--paste'), out = resolve(opt('--out')[0] ?? dir);
  if (!repos.length && !pastes.length) { console.error('context: pass at least one --repo <path> or --paste <file>. Nothing is read by default.'); process.exit(2); }
  const log = [], c = analyze(repos, pastes, log), pre = prefill(c), w = scoped(out);
  const body = `# CONTEXT (proposed: needs the user's yes)\n\nRead-only scan of the paths the user passed. Secrets, emails and phone numbers are redacted. Nothing here is in BRIEF.md. Every item is a proposal with its source file; the user accepts, edits or drops each one.\n\n` +
    md('Stack detected', c.stack) + md('Brand colours found', c.colours) + md('Fonts found', c.fonts) + md('Past-site facts', c.facts) + md('Pages found', c.pages) +
    `## What this could pre-fill in the BRIEF block (once accepted)\n\n${pre.length ? pre.map((p) => `- PROPOSED: ${p.part} ${p.name}, slot ${p.slot}: ${p.what}`).join('\n') : 'Nothing.'}\n\nR (Result) and F (Fences) are never inferred from files: they are the user's decisions.\n`;
  w.write('CONTEXT.md', body); w.write('.lilac/context.json', JSON.stringify({ proposed: true, ...c, prefill: pre }, null, 2));
  w.write('.lilac/context-sources.log', log.map((p) => redact(p)).join('\n') + (log.length ? '\n' : ''));
  console.log(`context: ${log.length} source file(s) read, listed in ${join(out, '.lilac/context-sources.log')}\ncontext: wrote ${join(out, 'CONTEXT.md')} (all items PROPOSED; nothing added to BRIEF.md)`);
} else if (cmd === 'answers' && dir) {
  const f = join(resolve(opt('--out')[0] ?? dir), '.lilac', 'context.json');
  if (!existsSync(f)) { console.error('context: no context yet. Run `context.mjs read <dir> --repo <path>` first.'); process.exit(1); }
  const j = JSON.parse(readFileSync(f, 'utf8'));
  if (!j.prefill.length) console.log('Nothing to pre-fill: ask every BRIEF question.');
  for (const p of j.prefill) console.log(`${p.part} ${p.name} slot ${p.slot}: ${p.what}. PROPOSED, needs the user's yes. Sources: ${p.source.join(', ')}`);
} else { console.error('Usage: context.mjs read <dir> --repo <path> [--repo <path2>] [--paste <file>] [--out <dir>] | answers <dir> [--out <dir>]'); process.exit(2); }
