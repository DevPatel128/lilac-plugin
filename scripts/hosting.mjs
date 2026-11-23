#!/usr/bin/env node
// Lilac hosting: records WHERE the user chose to host and scaffolds the matching config files. Code always lives on GitHub.
// Usage: node scripts/hosting.mjs options
//        node scripts/hosting.mjs choose --host cloudflare|vercel|manual --db none|d1|supabase [--project <dir>]
//        node scripts/hosting.mjs show|status|check|deploy-plan [--project <dir>]
//        show prints the current choice or "none chosen yet". choose refuses to replace an existing choice unless --change is given,
//        prints "Current: old  ->  New: new" first, never deletes files or the old host's config, and keeps a history array.
//        deploy-plan refuses unless `preview.mjs status` is VALID (the human approved exactly this site).
// CI: choose copies templates/lilac-checks.yml to .github/workflows/lilac-checks.yml (never overwrites). NOT yet run on GitHub (UNVERIFIED).
// Offline and dependency-free: no network, no child processes. It prints deploy commands but never runs them.
// Scaffolding only creates MISSING files and never overwrites; .gitignore only gets missing lines appended.
// Format sources (read 2026-11-21): wrangler.jsonc assets-only worker https://developers.cloudflare.com/workers/static-assets/ ,
// vercel.json schema https://openapi.vercel.sh/vercel.json , Supabase CLI layout https://supabase.com/docs/guides/local-development/cli/getting-started
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { scoped } from '../lib/safe-fs.mjs';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { approvalStatus } from './preview.mjs';

const OPTIONS = [
  ['1', 'Cloudflare (recommended default)', 'host=cloudflare db=none'],
  ['2', 'Vercel', 'host=vercel db=none'],
  ['3', 'Cloudflare + Supabase database', 'host=cloudflare db=supabase'],
  ['4', 'Vercel + Supabase', 'host=vercel db=supabase'],
  ['5', 'Something else (recorded as manual)', 'host=manual db=none'],
];
const HOSTS = ['cloudflare', 'vercel', 'manual'], DBS = ['none', 'd1', 'supabase'];
const HOST_FILE = { cloudflare: 'wrangler.jsonc', vercel: 'vercel.json', manual: null };
// Short copy of the SECRET pattern in architecture/core/secret.ts (the plugin cannot import it from source). Keep in step.
const SECRET = /(sk-[A-Za-z0-9]{20,}|sk[-_](?:live|test)[-_][A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.)/;
const IGNORE = ['.env*', '.dev.vars', '.wrangler/', '.vercel/', 'node_modules/'];
const CLIENT_DIRS = ['site', 'public', 'dist'];

const args = process.argv.slice(2), cmd = args[0];
const flag = (n) => { const i = args.indexOf(`--${n}`); return i > 0 ? args[i + 1] : undefined; };
const project = resolve(flag('project') ?? '.');
const p = (...a) => join(project, ...a);
const W = scoped(project);
const fail = (m) => { console.error(`hosting: ${m}`); process.exit(1); };
// Writes only when the file is absent; returns true if it wrote.
const scaffold = (rel, text) => { if (existsSync(p(rel))) return false; W.write(rel, text, { overwrite: false }); console.log(`hosting: wrote ${rel}`); return true; };

function readChoice() {
  if (!existsSync(p('.lilac/hosting.json'))) fail('.lilac/hosting.json missing. Run: node scripts/hosting.mjs choose --host ... --db ...');
  let j; try { j = JSON.parse(readFileSync(p('.lilac/hosting.json'), 'utf8')); } catch { fail('.lilac/hosting.json is not valid JSON'); }
  if (j.code !== 'github' || !HOSTS.includes(j.host) || !DBS.includes(j.db) || !j.chosenAt) fail('.lilac/hosting.json is invalid (need code=github, host, db, chosenAt)');
  return j;
}

const label = (j) => `${j.host}/${j.db}`;
function show() {
  if (!existsSync(p('.lilac/hosting.json'))) { console.log('none chosen yet'); return; }
  const j = readChoice();
  console.log(`host: ${j.host}\ndb: ${j.db}\nchosenAt: ${j.chosenAt}`);
}

function choose() {
  const host = flag('host'), db = flag('db') ?? 'none';
  if (!HOSTS.includes(host)) fail(`--host must be one of ${HOSTS.join('|')}`);
  if (!DBS.includes(db)) fail(`--db must be one of ${DBS.join('|')}`);
  if (db === 'd1' && host !== 'cloudflare') fail('--db d1 needs --host cloudflare');
  const old = existsSync(p('.lilac/hosting.json')) ? readChoice() : null;
  if (old) {
    console.log(`Current: ${label(old)}  ->  New: ${host}/${db}`);
    if (!args.includes('--change')) fail('a choice already exists. Nothing was changed. Add --change to replace it (your files and the old host config are kept).');
  } else console.log(`You chose ${host}. You can change it any time with /lilac:hosting.`);
  W.mkdir('.lilac');
  const note = host === 'manual' ? 'Hosting is manual: Lilac scaffolds no host config.' : db === 'none' ? '' : `Database: ${db}`;
  const history = old ? [...(old.history ?? []), { host: old.host, db: old.db, chosenAt: old.chosenAt }] : undefined;
  W.write('.lilac/hosting.json', JSON.stringify({ code: 'github', host, db, chosenAt: new Date().toISOString(), note, ...(history && { history }) }, null, 2) + '\n');
  console.log('hosting: wrote .lilac/hosting.json');

  if (host === 'cloudflare') {
    const dir = ['site', 'public', 'dist'].find((d) => existsSync(p(d))) ?? 'site';
    const name = basename(project).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-site';
    scaffold('wrangler.jsonc', `// Static-assets Worker. Source: https://developers.cloudflare.com/workers/static-assets/
{
  "name": "${name}",
  "compatibility_date": "${new Date().toISOString().slice(0, 10)}",
  "assets": {
    "directory": "./${dir}"
  }
}
`);
  }
  // JSON allows no comments. Source: https://openapi.vercel.sh/vercel.json . Fields left out on purpose; add them when the project needs them.
  if (host === 'vercel') scaffold('vercel.json', '{\n  "$schema": "https://openapi.vercel.sh/vercel.json"\n}\n');
  if (db === 'supabase') {
    scaffold('supabase/migrations/.gitkeep', '');
    scaffold('supabase/README.md', `# Supabase

Run \`npx supabase init\` once in this folder's parent to create \`supabase/config.toml\`. Put schema changes in \`supabase/migrations/\` as SQL files; never edit the live database by hand.

Keys: the anon (publishable) key is public and may ship to a browser, but only with Row Level Security turned on for every table.
The service-role key bypasses security. It must never ship to a browser, never be committed, and only live in server-side secrets.
`);
  }
  const have = existsSync(p('.gitignore')) ? readFileSync(p('.gitignore'), 'utf8') : '';
  const lines = have.split('\n').map((l) => l.trim());
  const add = IGNORE.filter((l) => !lines.includes(l));
  if (add.length) { W.write('.gitignore', have + (have && !have.endsWith('\n') ? '\n' : '') + add.join('\n') + '\n'); console.log('hosting: updated .gitignore'); }

  scaffold('.github/workflows/lilac-checks.yml', readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../templates/lilac-checks.yml'), 'utf8'));
  console.log('hosting: done. Nothing was deployed. Next: node scripts/hosting.mjs deploy-plan');
}

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.git') continue;
    const f = join(dir, n); statSync(f).isDirectory() ? walk(f, out) : out.push(f);
  }
  return out;
}

function check() {
  const problems = [], j = readChoice();
  const cfg = HOST_FILE[j.host];
  if (cfg && !existsSync(p(cfg))) problems.push(`${cfg} missing for host ${j.host}`);
  const scanned = [cfg, 'supabase/README.md', '.github/workflows/lilac-checks.yml', '.github/workflows/ci.yml', '.lilac/hosting.json', '.gitignore'].filter((f) => f && existsSync(p(f)));
  for (const f of scanned) if (SECRET.test(readFileSync(p(f), 'utf8'))) problems.push(`secret-looking value in ${f}`);
  const ig = existsSync(p('.gitignore')) ? readFileSync(p('.gitignore'), 'utf8').split('\n').map((l) => l.trim()) : [];
  if (!ig.some((l) => ['.env', '.env*', '.env.*', '/.env'].includes(l))) problems.push('.env is not git-ignored');
  if (j.db === 'supabase') for (const d of CLIENT_DIRS) if (existsSync(p(d)))
    for (const f of walk(p(d))) if (/service[_-]?role/i.test(readFileSync(f, 'utf8'))) problems.push(`service-role key name in client code: ${f.slice(project.length + 1)}`);
  problems.forEach((m) => console.log(`hosting: FAIL ${m}`));
  console.log(`hosting: ${problems.length} problem(s)`);
  process.exit(problems.length ? 1 : 0);
}

function plan() {
  if (approvalStatus(project) !== 'VALID') fail(`no valid preview approval (${approvalStatus(project)}). Run /lilac:preview first: the human must look at the site and say yes.`);
  const j = readChoice(), L = [`Hosting plan: code on GitHub, host ${j.host}, database ${j.db}`, ''];
  if (j.host === 'cloudflare') L.push('Account: Cloudflare (free to create; Workers Paid is from $5/month, UNVERIFIED until you check the pricing page).', 'Commands:', '  npx wrangler login', '  npx wrangler deploy');
  if (j.host === 'vercel') L.push('Account: Vercel (Hobby is free; Pro costs money, UNVERIFIED until you check the pricing page).', 'Commands:', '  npx vercel login', '  npx vercel        # preview', '  npx vercel --prod');
  if (j.host === 'manual') L.push('Host: manual. Lilac knows no commands for it. Follow your host\'s own guide.');
  if (j.db === 'd1') L.push('Database: Cloudflare D1.', '  npx wrangler d1 create <name>   # then add the binding to wrangler.jsonc yourself');
  if (j.db === 'supabase') L.push('Account: Supabase (free tier pauses idle projects, Pro is from $25/month, UNVERIFIED until you check).', 'Commands:', '  npx supabase login', '  npx supabase link --project-ref <ref>', '  npx supabase db push');
  L.push('', 'Costs: domain purchase, paid plans and usage past free limits cost money. Anything not read from the vendor page today is UNKNOWN.', 'Not done by Lilac: account creation, domain purchase, DNS changes, deploys, spending.', '', 'Needs your explicit approval before you run any of this');
  console.log(L.join('\n'));
}

if (cmd === 'options') OPTIONS.forEach(([n, t, v]) => console.log(`${n} ${t}  (${v})`));
else if (cmd === 'show') show();
else if (cmd === 'choose') choose();
else if (cmd === 'status') { const j = readChoice(); console.log(`code: github\nhost: ${j.host}\ndb: ${j.db}\nchosen: ${j.chosenAt}${j.note ? `\nnote: ${j.note}` : ''}`); }
else if (cmd === 'check') check();
else if (cmd === 'deploy-plan') plan();
else fail('usage: options | show | choose --host --db [--change] [--project] | status | check | deploy-plan');
