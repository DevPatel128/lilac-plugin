#!/usr/bin/env node
// Lilac launch: a pre-launch checklist with evidence, plus printed guides for domain, rollback and deploy. It never runs a deploy.
// Usage: node scripts/launch.mjs checklist <dir>          table of PASS | FAIL | NEEDS-HUMAN rows, each with its evidence; writes .lilac/checklist.json; exit 1 on FAIL
//        node scripts/launch.mjs record <dir> <qa|qa-browser|controls|persona|funnel> --ok true|false --line "<result line>"
//        node scripts/launch.mjs domain-guide <dir>        steps to connect a custom domain for the chosen host, with sources
//        node scripts/launch.mjs rollback-plan <dir> [--force]   writes ROLLBACK.md (host rollback, git revert, owner-data backups)
//        node scripts/launch.mjs deploy-guide <dir>        the step list that follows `hosting.mjs deploy-plan`; needs a VALID preview approval
// Results from qa, qa-browser, controls, persona and funnel are READ from .lilac/results/<name>.json ({at, ok, line}); checklist never reruns them.
// Offline and dependency-free: no network, no child processes. Guides only print text. Vendor facts were read from the vendors' pages on READ_ON;
// anything not read is marked UNVERIFIED in the output. Lilac never buys domains, changes DNS or creates accounts.
// shortcut: placeholder, secret and third-party scans are regex over text files, not parsers; upgrade if a real project hits false positives.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { scoped } from '../lib/safe-fs.mjs';
import { join, resolve, relative, extname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { siteDir, approvalStatus } from './preview.mjs';
import { foundationStatus } from './foundation.mjs';

const READ_ON = '2026-11-22';
const TOKEN = ['OWNER', 'TO', 'FILL'].join('-'); // built at run time so no shipped file spells it out
const RESULTS = { qa: 'node scripts/qa.mjs <dir>', 'qa-browser': 'node scripts/qa-browser.mjs <dir>', controls: 'node scripts/controls-test.mjs <dir>', persona: 'node scripts/persona-test.mjs <dir> --visitors 100', funnel: 'the funnel check (see /lilac:funnel)' };
// Short copy of the SECRET pattern used by hosting.mjs (architecture/core/secret.ts). Keep in step.
const SECRET = /(sk-[A-Za-z0-9]{20,}|sk[-_](?:live|test)[-_][A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.)/;
const PLACEHOLDERS = [['example.com', /example\.com/i], ['SAMPLE', /\bSAMPLE\b/], ['TODO', /\bTODO\b/i], ['lorem', /\blorem\b/i], [TOKEN, new RegExp(TOKEN)]];
const TEXT = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.json', '.txt', '.xml', '.svg', '.webmanifest', '.md']);
const SKIP = new Set(['node_modules', '.git', '.lilac', '.github', '.wrangler', '.vercel']);

const fail = (m) => { console.error(`launch: ${m}`); process.exit(1); };
const walk = (d, out = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (SKIP.has(e.name)) continue; const f = join(d, e.name); e.isDirectory() ? walk(f, out) : out.push(f); } return out; };
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
const age = (ms) => ms < 3.6e6 ? `${Math.max(0, Math.round(ms / 6e4))} min` : ms < 864e5 ? `${Math.round(ms / 3.6e6)} h` : `${Math.round(ms / 864e5)} d`;

function checklist(dir) {
  const rows = [], details = [], add = (check, status, evidence) => rows.push({ check, status, evidence });
  const site = siteDir(dir), files = site ? walk(site) : [], rel = (f) => relative(site, f).split('\\').join('/');
  const textFiles = files.filter((f) => TEXT.has(extname(f).toLowerCase()));
  const lines = (f) => readFileSync(f, 'utf8').split('\n');
  if (!site) add('site folder', 'FAIL', 'no site folder found (site, public, dist, out, build with .html, or index.html at the root)');

  const fs_ = foundationStatus(dir);
  add('foundation approval', fs_ === 'VALID' ? 'PASS' : 'FAIL', `foundation.mjs status: ${fs_}`);
  const ps = approvalStatus(dir);
  add('preview approval', ps === 'VALID' ? 'PASS' : 'FAIL', `preview.mjs status: ${ps}${ps === 'STALE' ? ' (the site changed since the human approved it)' : ''}`);

  const newest = files.reduce((m, f) => Math.max(m, statSync(f).mtimeMs), 0);
  for (const [name, cmd] of Object.entries(RESULTS)) {
    const j = readJson(join(dir, `.lilac/results/${name}.json`));
    if (!j || !j.at) { add(name, 'NEEDS-HUMAN', `no recorded result; run ${cmd}, then record it with launch.mjs record`); continue; }
    const t = Date.parse(j.at), changed = files.filter((f) => statSync(f).mtimeMs > t).length;
    const ev = `${j.line ?? '(no line)'} (age ${age(Date.now() - t)}; ${changed ? `${changed} site file(s) changed since` : 'no site file changed since'})`;
    add(name, j.ok !== true ? 'FAIL' : changed ? 'NEEDS-HUMAN' : 'PASS', ev + (j.ok === true && changed ? '; rerun it' : ''));
  }

  const h = readJson(join(dir, '.lilac/hosting.json'));
  add('hosting choice', h && h.host && h.chosenAt ? 'PASS' : 'FAIL', h && h.host ? `host ${h.host}, db ${h.db}, chosen ${h.chosenAt}` : '.lilac/hosting.json missing or invalid (run hosting.mjs choose)');

  const htmls = files.map(rel).filter((n) => /\.html?$/i.test(n));
  for (const [label, re, miss] of [['privacy page', /privacy/i, 'FAIL'], ['accessibility page', /accessib/i, 'FAIL'], ['cookie page', /cookie/i, 'NEEDS-HUMAN']]) {
    const f = htmls.find((n) => re.test(n));
    add(label, f ? 'PASS' : miss, f ? `found ${f}` : miss === 'FAIL' ? `no html file with ${re.source.replace(/\\/g, '')} in its name` : 'no cookie page; needed only if the site sets cookies or uses trackers, which Lilac cannot judge for you');
  }
  const has = (n) => files.some((f) => rel(f) === n);
  add('sitemap.xml', has('sitemap.xml') ? 'PASS' : 'FAIL', has('sitemap.xml') ? 'found sitemap.xml' : 'sitemap.xml missing');
  add('robots.txt', has('robots.txt') ? 'PASS' : 'FAIL', has('robots.txt') ? 'found robots.txt' : 'robots.txt missing');
  add('404 page', has('404.html') ? 'PASS' : 'FAIL', has('404.html') ? 'found 404.html' : '404.html missing');
  const iconLink = has('index.html') && /<link[^>]+rel=["'][^"']*icon/i.test(readFileSync(join(site, 'index.html'), 'utf8'));
  add('favicon', has('favicon.ico') || iconLink ? 'PASS' : 'FAIL', has('favicon.ico') ? 'found favicon.ico' : iconLink ? 'index.html links an icon' : 'no favicon.ico and no <link rel="icon"> in index.html');

  const demo = readJson(join(dir, '.lilac/demo.json'))?.demo === true, hits = [];
  for (const f of textFiles) lines(f).forEach((ln, i) => { for (const [n, re] of PLACEHOLDERS) if (re.test(ln) && !(demo && n === 'SAMPLE')) hits.push(`${rel(f)}:${i + 1}: ${n}`); });
  add('no placeholder text', hits.length ? 'FAIL' : 'PASS', hits.length ? `${hits.length} hit(s), first ${hits[0]}` : `none of example.com, SAMPLE, TODO, lorem, ${TOKEN}${demo ? ' (SAMPLE allowed: demo:true)' : ''} in ${textFiles.length} file(s)`);
  hits.forEach((x) => details.push(`placeholder ${x}`));

  const sec = [];
  for (const f of [...textFiles, ...['wrangler.jsonc', 'vercel.json'].map((n) => join(dir, n)).filter(existsSync)]) lines(f).forEach((ln, i) => { if (SECRET.test(ln)) sec.push(`${f.startsWith(site ?? '\0') ? rel(f) : basename(f)}:${i + 1}`); });
  add('no secrets', sec.length ? 'FAIL' : 'PASS', sec.length ? `secret-looking value at ${sec[0]} (${sec.length} place(s); value not shown)` : `no secret-looking value in ${textFiles.length} site file(s), wrangler.jsonc, vercel.json`);
  sec.forEach((x) => details.push(`secret-looking value at ${x} (value not shown)`));

  const tp = [], ext = (h2) => h2 && !/^(localhost|127\.0\.0\.1)$/i.test(h2);
  const RES = [/\b(?:src|srcset|poster|action)\s*=\s*["']?\s*(?:https?:)?\/\/([^\/"'\s?#:]+)/gi, /url\(\s*["']?(?:https?:)?\/\/([^\/"')\s?#:]+)/gi, /@import\s+(?:url\()?\s*["']?(?:https?:)?\/\/([^\/"')\s?#:]+)/gi, /\b(?:fetch|open|import)\s*\(\s*["'`](?:https?:)?\/\/([^\/"'`\s?#:]+)/g, /<link\b(?=[^>]*\brel=["']?(?:stylesheet|preload|preconnect|dns-prefetch|modulepreload|icon|manifest|prefetch))[^>]*\bhref\s*=\s*["']?(?:https?:)?\/\/([^\/"'\s?#:]+)/gi];
  for (const f of textFiles) lines(f).forEach((ln, i) => { for (const re of RES) for (const m of ln.matchAll(re)) if (ext(m[1])) tp.push(`${rel(f)}:${i + 1}: ${m[1]}`); });
  add('no third-party requests', tp.length ? 'FAIL' : 'PASS', tp.length ? `${tp.length} hit(s), first ${tp[0]}` : 'no src, stylesheet, url(), import or fetch pointing at another host');
  tp.forEach((x) => details.push(`third-party request ${x}`));

  const dn = readJson(join(dir, '.lilac/domain.json'));
  add('domain, DNS and ssl', dn?.domain && dn.confirmedBy ? 'PASS' : 'NEEDS-HUMAN', dn?.domain && dn.confirmedBy ? `owner ${dn.confirmedBy} recorded domain ${dn.domain} at ${dn.at ?? 'unknown time'}` : 'Lilac does not change DNS and cannot check it offline. Run domain-guide; after the owner connects the domain, record it in .lilac/domain.json and run monitor.mjs uptime <url>');

  const out = ['| # | Check | Status | Evidence |', '|---|---|---|---|', ...rows.map((r, i) => `| ${i + 1} | ${r.check} | ${r.status} | ${r.evidence.replace(/\|/g, '/')} |`)];
  console.log(out.join('\n'));
  if (details.length) console.log('\nDetails:\n' + details.map((d) => `  - ${d}`).join('\n'));
  const n = (s) => rows.filter((r) => r.status === s).length;
  console.log(`\nlaunch checklist: ${n('PASS')} PASS, ${n('FAIL')} FAIL, ${n('NEEDS-HUMAN')} NEEDS-HUMAN. Lilac does not deploy; a human decides.`);
  scoped(dir).write('.lilac/checklist.json', JSON.stringify({ at: new Date().toISOString(), rows, details }, null, 2) + '\n');
  process.exit(n('FAIL') ? 1 : 0);
}

function record(dir, name, flag) {
  if (!RESULTS[name]) fail(`name must be one of ${Object.keys(RESULTS).join(', ')}`);
  const ok = flag('ok'), line = (flag('line') ?? '').trim();
  if (!['true', 'false'].includes(ok)) fail('--ok true|false is required');
  if (!line) fail('--line "<the result line the command printed>" is required');
  scoped(dir).write(`.lilac/results/${name}.json`, JSON.stringify({ at: new Date().toISOString(), ok: ok === 'true', line }, null, 2) + '\n');
  console.log(`launch: recorded ${name}`);
}

function choice(dir) {
  const j = readJson(join(dir, '.lilac/hosting.json'));
  if (!j?.host) fail('.lilac/hosting.json missing. Ask the human, then run: node scripts/hosting.mjs choose --host ... --db ...');
  return j;
}

const NOT_DONE = ['Lilac will NOT: buy domains, change DNS records, create accounts, deploy, or spend money. You do those yourself in the vendor\'s own page.'];
const DOMAIN = {
  cloudflare: {
    src: ['https://developers.cloudflare.com/workers/configuration/routing/custom-domains/'],
    steps: ['You must already own the domain. Buying one is your job (Lilac will not).', 'The domain must be an active Cloudflare zone you own. How to move a domain to Cloudflare was NOT read: UNVERIFIED, use Cloudflare\'s own guide.', 'The hostname must have no existing CNAME DNS record.', 'Dashboard: Workers & Pages, pick your Worker, Settings, Domains & Routes, Add, Custom Domain, type the domain, Add Custom Domain. Cloudflare creates the DNS record for you.', 'Or in wrangler.jsonc add a routes entry with "pattern" set to the hostname and "custom_domain": true, then run `npx wrangler deploy` (needs your explicit approval).', 'Cloudflare issues the certificate for the hostname automatically with default settings.', 'Check it worked: node scripts/monitor.mjs uptime https://<your-domain> (shows days of certificate left).'],
    unverified: ['DNS propagation time.', 'Steps to point nameservers at Cloudflare.', 'Any price for the domain or certificate.'],
  },
  vercel: {
    src: ['https://vercel.com/docs/domains/working-with-domains/add-a-domain'],
    steps: ['You must already own the domain, or buy it yourself (Vercel sells domains; Lilac will not).', 'Vercel dashboard: your project, Settings, Domains, Add Existing, type the domain. Or run `vercel domains add <domain> <project>` yourself; pass the project name.', 'An apex domain (example.com) uses an A record. A subdomain (docs.example.com) uses a CNAME record whose value is unique per project. The exact values are shown in your Domains page: copy them from there. The A record value is not stated on the docs page: UNVERIFIED here.', 'If the domain is in use by another Vercel account you may be asked for a TXT record at _vercel on the apex domain.', 'Add the www version too and set a redirect to the one you prefer.', 'If you change nameservers instead, first copy your existing DNS records (including MX for email) to Vercel, or email can stop.', 'Wait until the Domains page shows the domain as configured; look for conflicting A, AAAA or CNAME records if it does not.', 'Check it worked: node scripts/monitor.mjs uptime https://<your-domain>.'],
    unverified: ['DNS propagation time.', 'Price of domains and plans.', 'The A record value (read it from your dashboard).'],
  },
};
const ROLLBACK = {
  cloudflare: { src: ['https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/'], text: ['Run `npx wrangler rollback`, or in the dashboard open Workers & Pages, your Worker, Deployments, the three-dot menu on the version you want, Rollback.', 'A rollback creates a new deployment sending 100% of traffic to the chosen version. Bindings are not changed. It is blocked if a Durable Object class change or a removed R2, KV or queue binding sits between the versions.'] },
  vercel: { src: ['https://vercel.com/docs/instant-rollback'], text: ['Dashboard: project overview, Production Deployment tile, Instant Rollback, choose the deployment, Confirm Rollback.', 'Hobby can roll back to the previous deployment only; Pro and Enterprise can pick any eligible one. After a rollback new pushes do NOT go live until you undo it by promoting a deployment (dashboard Manage button, or `vercel promote <deployment-id or url>`). Environment variables are not rolled back.'] },
};
const BACKUP = {
  d1: { src: ['https://developers.cloudflare.com/d1/best-practices/import-export-data/'], text: ['Export the database: `npx wrangler d1 export <database_name> --remote --output=./database.sql`.'] },
  supabase: { src: ['https://supabase.com/docs/guides/platform/backups'], text: ['Paid plans keep daily backups (7 days on Pro, 14 on Team, up to 30 on Enterprise; read on ' + READ_ON + '). On the free tier make a logical backup yourself with the Supabase CLI `db dump` command (check `npx supabase db dump --help` for the flags; the flags were not read: UNVERIFIED) and keep copies off-site.', 'Daily backups do not store custom role passwords, and storage files are not included, only their metadata.'] },
};

function domainGuide(dir) {
  const j = choice(dir), g = DOMAIN[j.host];
  if (!g) { console.log(`Host is ${j.host}: Lilac knows no domain steps for it (UNVERIFIED). Follow your host's own guide.\n\n${NOT_DONE[0]}`); return; }
  console.log([`Connect a custom domain: host ${j.host}`, '', ...g.steps.map((s, i) => `${i + 1}. ${s}`), '', `Sources (read ${READ_ON}):`, ...g.src.map((u) => `  ${u}`), '', 'UNVERIFIED (not read):', ...g.unverified.map((u) => `  - ${u}`), '', NOT_DONE[0]].join('\n'));
}

function rollbackPlan(dir, force) {
  const j = choice(dir), f = join(dir, 'ROLLBACK.md');
  if (existsSync(f) && !force) fail('ROLLBACK.md already exists. Nothing was changed. Add --force to replace it.');
  const r = ROLLBACK[j.host], b = BACKUP[j.db], src = [...(r?.src ?? []), ...(b?.src ?? [])];
  const L = ['# Rollback and backup plan', '', `Host: ${j.host}. Database: ${j.db}. Vendor facts read ${READ_ON}; anything not listed is UNVERIFIED. Lilac runs none of this: you do, after you decide.`, '', '## 1. Roll back with the host', '', ...(r ? r.text : [`Host is ${j.host}: Lilac knows no rollback steps for it (UNVERIFIED). Use your host's own guide.`]), '', '## 2. Restore the previous version from git', '', 'Use this when the code itself is the problem. It adds a new commit that undoes a bad one; it rewrites no history.', '', '1. `git log --oneline` and find the bad commit.', '2. `git revert <bad-commit>` (for a merge commit: `git revert -m 1 <merge-commit>`).', '3. Look at the result, run the checks (`node scripts/launch.mjs checklist .`), then push.', '4. Redeploy only with your explicit approval, as in `deploy-guide`.', '', '## 3. Back up owner data', '', 'Owner data is anything the site collects or stores that is not in git (form entries, orders, user accounts, uploads).', '', ...(b ? b.text : ['No database is chosen. If the site has no stored data, there is nothing to back up. If it does, list it here: ' + TOKEN + '.']), '', '- Export routes the site offers to the owner (list them here): ' + TOKEN + '.', '- Keep backups outside this git repository and outside the site folder, in a place only you can open. Where they are kept: ' + TOKEN + '.', '- Never write keys, passwords or tokens into backups notes or into this file.', '- Test a restore once: a backup nobody has restored is UNVERIFIED.', '', '## Sources', '', ...src.map((u) => `- ${u} (read ${READ_ON})`), ''];
  scoped(dir).write('ROLLBACK.md', L.join('\n')); console.log('launch: wrote ROLLBACK.md. Nothing was run.');
}

function deployGuide(dir) {
  const ps = approvalStatus(dir);
  if (ps !== 'VALID') fail(`no valid preview approval (${ps}). Run /lilac:preview first: the human must look at the site and say yes.`);
  const j = choice(dir), L = [`Deploy guide: host ${j.host}, database ${j.db}. This follows \`hosting.mjs deploy-plan\`; read its account, cost and command list first.`, '', '1. Run the checklist: node scripts/launch.mjs checklist <dir>. Fix every FAIL; decide each NEEDS-HUMAN.', '2. Write the rollback plan: node scripts/launch.mjs rollback-plan <dir>.'];
  if (j.host === 'cloudflare') L.push(`3. Branch preview first (docs read ${READ_ON}): \`npx wrangler versions upload --preview-alias staging\` gives a Version URL like staging-<worker>.<subdomain>.workers.dev. Version URLs need preview_urls set to true in your wrangler config. They run against your PRODUCTION resources, are not made for Durable Objects, and are not in Workers Logs. For per-branch variables and bindings use Cloudflare Previews instead.`, '   Source: https://developers.cloudflare.com/workers/configuration/previews/');
  else if (j.host === 'vercel') L.push(`3. Branch preview first (docs read ${READ_ON}): push a branch that is not your production branch, or run \`npx vercel\` without --prod; each gives a preview URL. WARNING: the first deployment of a brand-new Vercel project is always a production deployment. Previews are protected by Vercel Authentication by default; share one with a Shareable Link. Previews carry noindex.`, '   Source: https://vercel.com/docs/deployments/environments');
  else L.push('3. Host is manual: Lilac knows no preview steps for it (UNVERIFIED). Use your host\'s guide.');
  L.push('4. Open the preview, look at it, and tell the agent yes or what to change. Any edit makes the approval STALE: preview again.', '5. Production: the commands printed by `node scripts/hosting.mjs deploy-plan --project <dir>`. You run them; Lilac does not.', '6. Connect your domain: node scripts/launch.mjs domain-guide <dir>.', '7. Check the live site: node scripts/monitor.mjs uptime <url> and node scripts/monitor.mjs links <url>. If it is wrong, follow ROLLBACK.md.', '', 'Not done by Lilac: account creation, domain purchase, DNS changes, deploys, spending.', '', 'Needs your explicit approval before you run any of this');
  console.log(L.join('\n'));
}

function main() {
  const a = process.argv.slice(2), cmd = a[0], dirArg = a[1];
  const flag = (n) => { const i = a.indexOf(`--${n}`); return i > 0 ? a[i + 1] : undefined; };
  if (!['checklist', 'record', 'domain-guide', 'rollback-plan', 'deploy-guide'].includes(cmd) || !dirArg) fail('usage: checklist <dir> | record <dir> <name> --ok true|false --line <text> | domain-guide <dir> | rollback-plan <dir> [--force] | deploy-guide <dir>');
  const dir = resolve(dirArg);
  if (!existsSync(dir)) fail(`${dir} not found`);
  if (cmd === 'checklist') checklist(dir);
  else if (cmd === 'record') record(dir, a[2], flag);
  else if (cmd === 'domain-guide') domainGuide(dir);
  else if (cmd === 'rollback-plan') rollbackPlan(dir, a.includes('--force'));
  else deployGuide(dir);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
