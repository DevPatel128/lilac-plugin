#!/usr/bin/env node
// Lilac server features: copies small, dependency-free request handlers into a site project so forms, test-mode payments and
// sign-in actually work. Offline: no network, no child processes. Never creates accounts, never writes secret values.
// Usage: node scripts/features.mjs list
//        node scripts/features.mjs add <dir> <contact-form|payments|auth> [--host cloudflare|vercel] [--yes]
//        node scripts/features.mjs check <dir>
// add copies handler files to <dir>/functions/_lilac/ (cloudflare, default) or <dir>/api/_lilac/ (vercel) plus route files,
//   never overwrites, appends missing variable NAMES to .dev.vars.example, appends missing lines to .gitignore, and appends the
//   CSP connect-src block to _headers (cloudflare only) ONLY with --yes (the owner's approval); without it, it prints the lines.
// check scans for secrets, unignored .dev.vars/.env, non-test payment keys, forms without privacy note/consent, handlers without limits.
// UNVERIFIED: that Vercel treats api/_lilac as non-routes and accepts the named POST/OPTIONS exports; neither was run on a real host.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { scoped } from '../lib/safe-fs.mjs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../features/server/', import.meta.url));
const FEATURES = {
  'contact-form': { what: 'Contact form handler with spam defence, rate limit and delivery by email (Resend-style), database (Supabase REST) or local outbox.', files: ['shared.mjs', 'contact-form.mjs', 'deliver.mjs'], vars: ['LILAC_ENV', 'CONTACT_ALLOWED_ORIGIN', 'CONTACT_TO', 'CONTACT_FROM', 'RESEND_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'CONTACT_TABLE', 'RATE_SALT'], cost: 'Needs an email or database account of your own (Resend and Supabase have free tiers; check their pricing pages).' },
  payments: { what: 'Checkout session and webhook handlers, Stripe-style, TEST MODE only.', files: ['shared.mjs', 'checkout.mjs', 'prices.mjs'], vars: ['LILAC_ENV', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SITE_ORIGIN', 'RATE_SALT'], cost: 'Needs your own Stripe account in test mode (no real money moves). Going live is a separate, human-run step, not supported here.' },
  auth: { what: 'Sign-in by emailed magic link: signed single-use tokens, session cookies, CSRF, logout, account deletion.', files: ['shared.mjs', 'auth.mjs', 'deliver.mjs'], vars: ['LILAC_ENV', 'AUTH_SECRET', 'AUTH_SECRET_PREVIOUS', 'SITE_ORIGIN', 'RESEND_API_KEY', 'AUTH_FROM', 'RATE_SALT'], cost: 'Needs an email sending account of your own and a key/value store (Cloudflare KV or similar) so sessions survive restarts.' },
};
const PRICES_STUB = `// Your price list. Amounts are in the smallest currency unit (cents), set by YOU on the server; the browser never sends a price.
// Example (remove the slashes and edit): export const prices = { tee: { amount: 1500, currency: 'usd', name: 'T-shirt' } };
export const prices = {};
`;
const NOT_CONFIGURED = `const nc = (what) => new Response(JSON.stringify({ ok: false, error: { code: 'not_configured', message: what + ' is not set up yet.' } }), { status: 501, headers: { 'content-type': 'application/json' } });`;
function routes(feature, host) {
  const L = host === 'cloudflare' ? '../_lilac/' : './_lilac/'; // cloudflare routes sit in functions/api/, vercel ones directly in api/
  const wrap = (name) => host === 'cloudflare'
    ? `export const onRequest = (ctx) => ${name}(ctx.request, ctx.env);\n`
    : `export const POST = (request) => ${name}(request, process.env);\nexport const OPTIONS = POST;\n`;
  if (feature === 'contact-form') return { [host === 'cloudflare' ? 'api/contact.js' : 'contact.js']: `// Route for the contact form. Env names are in .dev.vars.example. Delivery: email if RESEND_API_KEY, else database if SUPABASE_URL.
import { createContactForm } from '${L}contact-form.mjs';
import { emailAdapter, supabaseAdapter } from '${L}deliver.mjs';
import { memoryStore, rateStore } from '${L}shared.mjs';
${NOT_CONFIGURED}
const mem = memoryStore(); // per-instance only; bind RATE_KV for a shared rate limit (without it production logs a warning)
async function run(request, env) {
  const doFetch = fetch.bind(globalThis);
  let deliver = null;
  try {
    if (env.RESEND_API_KEY) deliver = emailAdapter({ apiKey: env.RESEND_API_KEY, from: env.CONTACT_FROM, to: env.CONTACT_TO, doFetch });
    else if (env.SUPABASE_URL) deliver = supabaseAdapter({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_KEY, table: env.CONTACT_TABLE, doFetch });
  } catch { deliver = null; }
  if (!env.CONTACT_ALLOWED_ORIGIN || !deliver) return nc('The contact form');
  return createContactForm({ allowedOrigin: env.CONTACT_ALLOWED_ORIGIN, deliver, store: rateStore(env.RATE_KV, env, mem), salt: env.RATE_SALT || '' })(request);
}
${wrap('run')}` };
  if (feature === 'payments') {
    const common = (extra) => `import { memoryStore, durableStore, rateStore, unavailable } from '${L}shared.mjs';\n${NOT_CONFIGURED}\nconst mem = memoryStore(); // test and development only: LILAC_ENV must be test or development\n// Orders must survive between instances (the webhook lands on another one). No ORDERS_KV in production => null => 503, never memory.\nconst orders = (env) => durableStore(env.ORDERS_KV, env, mem);\n${extra}`;
    return {
      [host === 'cloudflare' ? 'api/checkout.js' : 'checkout.js']: `// Route: start a TEST-MODE checkout. The price list is ${L}prices.mjs. Live keys are refused by the provider.
import { createCheckout, stripeProvider } from '${L}checkout.mjs';
import { prices } from '${L}prices.mjs';
${common(`async function run(request, env) {
  const orderStore = orders(env); if (!orderStore) return unavailable('Checkout');
  let provider; try { provider = stripeProvider({ secretKey: env.STRIPE_SECRET_KEY, doFetch: fetch.bind(globalThis) }); } catch (e) { return nc('Payments (' + e.message.split(':')[0] + ')'); }
  if (!env.SITE_ORIGIN) return nc('Payments');
  const o = env.SITE_ORIGIN;
  return createCheckout({ provider, prices, currencies: ['usd'], allowedOrigin: o, successUrl: o + '/thanks', cancelUrl: o + '/cart', orders: orderStore, store: rateStore(env.RATE_KV, env, mem), salt: env.RATE_SALT || '' })(request);
}`)}${wrap('run')}`,
      [host === 'cloudflare' ? 'api/webhook.js' : 'webhook.js']: `// Route: payment provider webhook (signature checked; marks the order paid once).
import { createWebhook } from '${L}checkout.mjs';
${common(`async function run(request, env) {
  const orderStore = orders(env); if (!orderStore) return unavailable('The webhook'); // 503 so the provider retries
  if (!env.STRIPE_WEBHOOK_SECRET) return nc('The webhook');
  return createWebhook({ secret: env.STRIPE_WEBHOOK_SECRET, orders: orderStore, seen: orderStore, onPaid: async () => { /* send your receipt, update stock */ } })(request);
}`)}${wrap('run')}` };
  }
  return { [host === 'cloudflare' ? 'auth/[[path]].js' : 'auth/[...path].js']: `// Route for sign-in: /auth/login, verify, session, refresh, logout, delete. Bind AUTH_KV (Cloudflare KV) so sessions persist.
import { createAuth } from '../_lilac/auth.mjs';
import { resendMailer } from '../_lilac/deliver.mjs';
import { memoryStore, durableStore, unavailable } from '../_lilac/shared.mjs';
${NOT_CONFIGURED}
const mem = memoryStore(); // test and development only: LILAC_ENV must be test or development
async function run(request, env) {
  const store = durableStore(env.AUTH_KV, env, mem); if (!store) return unavailable('Sign-in'); // sessions and single-use links need a shared store
  if (!env.AUTH_SECRET || !env.SITE_ORIGIN) return nc('Sign-in');
  let mailer; try { mailer = resendMailer({ apiKey: env.RESEND_API_KEY, from: env.AUTH_FROM, doFetch: fetch.bind(globalThis) }); } catch { return nc('Sign-in email'); }
  return createAuth({ secret: env.AUTH_SECRET, previousSecrets: (env.AUTH_SECRET_PREVIOUS || '').split(',').filter(Boolean), siteOrigin: env.SITE_ORIGIN, mailer, store, salt: env.RATE_SALT || '' })(request);
}
${wrap('run')}` };
}

const CSP_BLOCK = "# lilac-features: the browser only talks to this site; vendors are called from the server\n/*\n  Content-Security-Policy: connect-src 'self'\n";
let W; // safe-fs writer bound to the project folder in add(): refuses symlinks (security review M-2)
function appendMissing(file, lines, header = '') {
  const cur = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const have = new Set(cur.split(/\r?\n/).map((l) => l.trim()));
  const add = lines.filter((l) => !have.has(l.trim()));
  if (add.length) W.write(file, cur + (cur && !cur.endsWith('\n') ? '\n' : '') + (cur ? '' : header) + add.join('\n') + '\n');
}
function put(file, text, made) { if (existsSync(file)) return; W.write(file, text, { overwrite: false }); made.push(file); }

function add(dirArg, feature, host, yes) {
  const f = FEATURES[feature];
  if (!f) return die(`unknown feature "${feature}". Known: ${Object.keys(FEATURES).join(', ')}`);
  if (!['cloudflare', 'vercel'].includes(host)) return die('--host must be cloudflare or vercel');
  const dir = resolve(dirArg); if (!existsSync(dir)) return die(`folder not found: ${dir}`);
  W = scoped(dir);
  const base = join(dir, host === 'cloudflare' ? 'functions' : 'api'), made = [];
  for (const name of f.files) {
    const dest = join(base, '_lilac', name);
    if (name === 'prices.mjs') put(dest, PRICES_STUB, made);
    else if (!existsSync(dest)) { W.copy(join(SRC, name), dest, { overwrite: false }); made.push(dest); }
  }
  for (const [rel, text] of Object.entries(routes(feature, host))) put(join(base, rel), text, made);
  appendMissing(join(dir, '.dev.vars.example'), f.vars.map((v) => `${v}=`), '# Names only. Copy to .dev.vars (Cloudflare) or .env (Vercel) and fill in YOUR OWN test values. Never commit that copy.\n');
  appendMissing(join(dir, '.gitignore'), ['.dev.vars', '.env*', 'node_modules/']);
  console.log(`Added ${feature} (${host}). New files: ${made.length}; existing files were kept.`);
  for (const m of made) console.log('  + ' + m.slice(dir.length + 1));
  console.log(`Variable names (no values) are in .dev.vars.example: ${f.vars.join(', ')}`);
  console.log('Real delivery/payment is UNVERIFIED until the owner supplies their own TEST credentials and runs the smoke test in docs/FEATURES-SERVER.md.');
  const hdr = join(dir, '_headers');
  if (host === 'cloudflare') {
    if (yes) { if (!existsSync(hdr) || !readFileSync(hdr, 'utf8').includes('# lilac-features')) { const cur = existsSync(hdr) ? readFileSync(hdr, 'utf8') : ''; W.write(hdr, cur + (cur && !cur.endsWith('\n') ? '\n' : '') + CSP_BLOCK); console.log('Appended the CSP block to _headers (owner approved with --yes).'); } else console.log('_headers already has the Lilac block.'); }
    else console.log(`Not written (needs the owner's yes). To add to _headers, re-run with --yes, or paste:\n${CSP_BLOCK}`);
  } else console.log(`Vercel: add this header to vercel.json yourself (not edited here):\n  Content-Security-Policy: connect-src 'self'`);
}

const SECRET_PATTERNS = [['payment secret key', /\b[sr]k_(live|test)_[A-Za-z0-9]{10,}/], ['webhook secret', /\bwhsec_[A-Za-z0-9]{10,}/], ['email API key', /\bre_[A-Za-z0-9_]{20,}/], ['JWT-like key', /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./], ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/]];
const TEXT = /\.(m?js|ts|json|jsonc|html?|md|txt|toml|ya?ml|example|css)$/;
function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', '.wrangler', '.vercel'].includes(e.name)) continue;
    const p = join(d, e.name); if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
function check(dirArg) {
  const dir = resolve(dirArg); if (!existsSync(dir)) return die(`folder not found: ${dir}`);
  const res = []; const pass = (n) => res.push(['PASS', n]), fail = (n, why) => res.push(['FAIL', `${n}: ${why}`]);
  const files = walk(dir); const rel = (p) => p.slice(dir.length + 1);
  const envFiles = files.filter((p) => /(^|\/)(\.dev\.vars|\.env(\.[\w.-]+)?)$/.test(p) && !/\.example$/.test(p));
  // secrets in ordinary files (never print the value)
  let bad = 0;
  for (const p of files) {
    if (envFiles.includes(p) || !(TEXT.test(p) || /\.dev\.vars\.example$/.test(p)) || statSync(p).size > 1e6) continue;
    const s = readFileSync(p, 'utf8');
    for (const [label, re] of SECRET_PATTERNS) if (re.test(s)) { fail('no secrets in files', `${label} found in ${rel(p)} (value not shown); move it to .dev.vars and rotate it`); bad++; }
  }
  if (!bad) pass('no secrets in files');
  // ignore rules
  const installed = ['functions/_lilac', 'api/_lilac'].filter((d) => existsSync(join(dir, d)));
  if (envFiles.length || installed.length) {
    const gi = existsSync(join(dir, '.gitignore')) ? readFileSync(join(dir, '.gitignore'), 'utf8').split(/\r?\n/).map((l) => l.trim()) : [];
    const ok = gi.some((l) => /^\.dev\.vars\*?$/.test(l)) && gi.some((l) => /^\.env\*?$/.test(l));
    ok ? pass('.dev.vars and .env are ignored by git') : fail('.dev.vars and .env are ignored by git', '.gitignore must list .dev.vars and .env*');
  } else pass('.dev.vars and .env are ignored by git (nothing to ignore yet)');
  // test-mode keys
  let keyBad = 0;
  for (const p of envFiles) for (const l of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*(?:export\s+)?STRIPE_SECRET_KEY\s*=\s*["']?([^"'\s]*)/);
    if (m && m[1] && !m[1].startsWith('sk_test_')) { fail('payment keys are test-mode only', `STRIPE_SECRET_KEY in ${rel(p)} does not start with sk_test_ (value not shown)`); keyBad++; }
  }
  if (!keyBad) pass('payment keys are test-mode only');
  // forms
  let formBad = 0;
  for (const p of files.filter((x) => /\.html?$/.test(x))) {
    const s = readFileSync(p, 'utf8');
    for (const m of s.matchAll(/<form[\s\S]*?<\/form>/gi)) {
      if (!/<textarea|type=["']?email/i.test(m[0])) continue;
      if (!/name=["']?consent/i.test(m[0])) { fail('forms have consent', `${rel(p)}: form collecting personal data has no consent checkbox (name="consent")`); formBad++; }
      if (!/privacy/i.test(s)) { fail('forms have a privacy note', `${rel(p)}: no privacy note near a form that collects personal data`); formBad++; }
    }
  }
  if (!formBad) pass('forms have a privacy note and consent');
  // limits in installed handlers
  let limBad = 0;
  for (const d of installed) for (const h of ['contact-form.mjs', 'checkout.mjs', 'auth.mjs']) {
    const p = join(dir, d, h); if (!existsSync(p)) continue;
    const s = readFileSync(p, 'utf8');
    if (!/maxBytes/.test(s) || !/rateHit/.test(s)) { fail('handlers have size and rate limits', `${rel(p)} lacks a size limit or rate limit`); limBad++; }
  }
  if (!limBad) pass('handlers have size and rate limits');
  for (const [s, n] of res) console.log(`${s}  ${n}`);
  const nf = res.filter(([s]) => s === 'FAIL').length;
  console.log(nf ? `\n${nf} problem(s). Fix them and run check again.` : '\nAll checks passed. This proves the files, not the live service: real delivery and payments stay UNVERIFIED until the owner runs the smoke test.');
  process.exit(nf ? 1 : 0);
}
function die(m) { console.error('features: ' + m); process.exit(1); }

const [cmd, ...rest] = process.argv.slice(2);
const flag = (n) => { const i = rest.indexOf(n); return i < 0 ? undefined : rest[i + 1]; };
if (cmd === 'list') {
  for (const [k, f] of Object.entries(FEATURES)) console.log(`${k}\n  ${f.what}\n  Variables: ${f.vars.join(', ')}\n  Cost/account: ${f.cost}\n`);
} else if (cmd === 'add') {
  const pos = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--host');
  if (pos.length < 2) die('usage: add <dir> <feature> [--host cloudflare|vercel] [--yes]');
  add(pos[0], pos[1], flag('--host') ?? 'cloudflare', rest.includes('--yes'));
} else if (cmd === 'check') {
  if (!rest[0]) die('usage: check <dir>'); check(rest[0]);
} else die('usage: features.mjs list | add <dir> <feature> [--host ...] [--yes] | check <dir>');
