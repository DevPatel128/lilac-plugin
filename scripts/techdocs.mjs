#!/usr/bin/env node
// Tech docs generator and gate. Reads the repo, finds the languages, tools and services really in use, and writes three files:
//   architecture/TECH-STACK.md           what the tech is, where it lives in the code, and a diagram of how each part works
//   governance-learning/INTERVIEW-PREP.md  questions an interviewer will ask about THIS project, with where to find the answer
//   product-growth/SHOWCASE.md           social-media drafts built only from facts found in the code
// Usage:  node operations/scripts/techdocs.mjs [project-dir]           write the three files
//         node operations/scripts/techdocs.mjs [project-dir] --check   fail if stale, a diagram is missing, or email is below standard
// Plain static sites (no framework, has .html) get a "Website" part; CSS/JS motion gets a "Motion" section. Motion gaps are warnings, never failures.
// Env:    TECHDOCS_STRICT=1  also fail when a source file has no header comment (same pattern as DESIGN_STRICT).
// Nothing here calls the network or an AI model: every line comes from files on disk, so a claim in the docs can be traced to code.
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, relative, dirname, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const root = resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());

// ---------- 1. Read the repo ----------
// Folders that are not the product's own code (dependencies, build output, synced framework skills and scripts).
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'out', 'build', 'coverage', '.lilac', 'backups', 'sessions', '.claude', 'skills', 'Pods', '.wrangler', '.vercel']);
const LANG = { '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.sql': 'SQL', '.css': 'CSS', '.html': 'HTML', '.sh': 'Shell', '.rb': 'Ruby', '.swift': 'Swift', '.kt': 'Kotlin', '.java': 'Java', '.py': 'Python' };
const CODE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql', '.sh', '.rb', '.swift', '.kt', '.java', '.py']); // CSS and HTML are styling and markup, not logic: no header rule
const files = []; // { rel, text }
(function walk(dir) {
  let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; } // unreadable folder: skip, never crash
  for (const e of ents) {
    const p = join(dir, e.name), rel = relative(root, p);
    // Dot-folders (.astro, .open-next, .claude worktrees), backups and agent worktrees hold tool output or copies, not the product's code.
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('.') && !/^(backup|.*worktrees)$/.test(e.name) && rel !== 'operations/scripts') walk(p); continue; }
    const ext = extname(e.name);
    if (!LANG[ext] && !/^(package\.json|wrangler\.(jsonc?|toml)|vercel\.json|twa-manifest\.json|manifest\.webmanifest|\.env\.example)$/.test(e.name)) continue;
    try { files.push({ rel, text: readFileSync(p, 'utf8').slice(0, 400_000) }); } catch { /* unreadable file: skip, never fail the docs on it */ }
  }
})(root);

const deps = new Set();
for (const f of files.filter((x) => basename(x.rel) === 'package.json')) {
  try { const j = JSON.parse(f.text); for (const k of Object.keys({ ...j.dependencies, ...j.devDependencies })) deps.add(k); } catch { /* malformed package.json: ignore */ }
}
const langCount = {};
for (const f of files) if (LANG[extname(f.rel)]) langCount[LANG[extname(f.rel)]] = (langCount[LANG[extname(f.rel)]] ?? 0) + 1;
const projectName = (() => { try { return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name || basename(root); } catch { return basename(root); } })();

// ---------- 2. What each capability is, how it works, what to be asked ----------
// A capability shows up only when a dependency or a code pattern proves it. `how` is a Mermaid diagram; `ask` rows feed the interview file.
const CAPS = [
  { id: 'frontend', title: 'Frontend', dep: /^(next|react|vue|svelte|astro|vite|@capacitor\/core|tailwindcss)$/, code: null,
    what: 'The screens people see and tap. Renders data from the backend and sends user actions back.',
    how: (p) => `flowchart LR\n  U[Visitor] --> B[Browser or app]\n  B -->|HTML, CSS, JS| UI[Screens and components]\n  UI -->|fetch / form submit| API[Backend routes]\n  API -->|JSON| UI`,
    ask: [['Why this framework and not another?', 'The constraint that decided it (hosting, SEO, team skill), plus one trade-off you accepted.'], ['How do you keep it fast on a phone?', 'Image sizes, how much JavaScript ships, what renders on the server versus the browser.'], ['How did you handle accessibility?', 'Contrast, focus order, labels, touch target size, and how you checked.']] },
  { id: 'static', title: 'Website (plain HTML, CSS, JavaScript)', dep: null, code: null,
    when: () => !CAPS[0].dep || ![...deps].some((d) => CAPS[0].dep.test(d)) ? files.some((f) => extname(f.rel) === '.html') : false,
    pick: () => files.filter((f) => /\.(html|css|js)$/.test(f.rel) && !/test|spec/.test(f.rel)).map((f) => f.rel).sort((a, b) => Number(!a.endsWith('.html')) - Number(!b.endsWith('.html'))),
    what: 'Pages written as plain HTML and CSS, with small JavaScript for the interactive parts. No framework and no build step: the host sends the files as they are.',
    how: () => `flowchart LR\n  B[Browser requests page] --> H[Static HTML and CSS]\n  H --> J[Small JavaScript enhancements]\n  J --> S[Host serves files]\n  S --> B`,
    ask: [['How do you serve it without a server?', 'Static files on a CDN or static host; no server code runs per request, so forms need a service or a function.'], ['How do you keep a no-build site fast and maintainable?', 'Small files, one stylesheet, deferred scripts, sized images, and shared CSS variables instead of copy-paste.']] },
  { id: 'database', title: 'Database', dep: /^(@supabase\/supabase-js|@prisma\/client|drizzle-orm|pg|mysql2|better-sqlite3)$/, code: /create table/i, conf: /d1_databases/,
    what: 'Where orders, users and content are stored. Rules in the database decide who may read or change each row.',
    how: (p) => p.rls ? `flowchart LR\n  API[Backend code] -->|query with user identity| DB[(Database)]\n  DB --> RLS{Row rules\\nallow this user?}\n  RLS -->|yes| R[Rows returned]\n  RLS -->|no| X[Empty or error]\n  M[Migration files] -->|versioned schema| DB`
      : `flowchart LR\n  API[Backend code] -->|parameterised query| DB[(Database)]\n  DB -->|rows| API\n  M[Migration files] -->|versioned schema| DB`,
    ask: [['How is your data modelled?', 'Main tables, the key relationships, and one constraint that stops bad data.'], ['How do you stop one user reading another user\'s data?', 'Row-level security or a scope in every query, and the test that proves it.'], ['How do you change the schema safely?', 'Migrations in version control, a rollback plan, no manual edits in production.']] },
  { id: 'auth', title: 'Authentication', dep: /^(better-auth|next-auth|lucia|@supabase\/ssr|@simplewebauthn\/.+|jose)$/, code: /signInWith|passkey|getUser\(\)|session\.user|OWNER_EMAIL|magic-link|magic_link/,
    what: 'Proves who the user is and keeps them signed in, so protected pages and data stay protected.',
    how: () => `sequenceDiagram\n  participant U as User\n  participant A as App\n  participant S as Auth service\n  U->>A: sign in (email, Google or passkey)\n  A->>S: verify credentials\n  S-->>A: signed session token\n  A-->>U: secure cookie\n  U->>A: later request with cookie\n  A->>S: check token\n  S-->>A: user and role`,
    ask: [['How does sign-in work end to end?', 'Credentials or provider, where the session lives (cookie flags), how it expires.'], ['How do you decide who is an admin?', 'A server-side role check that fails closed, never a hidden button.'], ['What if a session token leaks?', 'Short expiry, revoke on sign-out, HttpOnly and Secure cookies.']] },
  { id: 'api', title: 'Backend API', dep: /^(hono)$/, code: null,
    what: 'The server routes the frontend calls. Validates input and talks to storage.',
    how: () => `flowchart LR\n  C[Client] -->|HTTPS request| R[Router]\n  R --> V[Validate input]\n  V --> H[Handler]\n  H --> S[(Storage)]\n  H -->|JSON| C`,
    ask: [['How do you validate requests?', 'A schema at the route boundary; reject before any work is done.'], ['How do you handle errors and retries?', 'Typed errors, idempotent writes, no stack traces to the client.']] },
  { id: 'edge', title: 'Edge storage (KV, R2)', dep: null, code: null, conf: /kv_namespaces|r2_buckets/,
    what: 'Key-value data and files held at the edge, bound to the Worker in its config.',
    how: () => `flowchart LR\n  W[Worker] -->|binding| K[(KV: small keyed data)]\n  W -->|binding| R[(R2: files)]`,
    ask: [['When do you use KV and when R2 or a database?', 'KV for small, read-heavy, eventually consistent data; R2 for files; a database for relations.'], ['How fresh is KV data?', 'Eventually consistent: writes can take time to show in other regions.']] },
  { id: 'pwa', title: 'Installable app (PWA / TWA)', dep: /^(vite-plugin-pwa|workbox-.+|next-pwa)$/, code: null, file: /(^|\/)(twa-manifest\.json|manifest\.webmanifest)$/,
    what: 'The web app can be installed and run offline, or wrapped for the Play Store.',
    how: () => `flowchart LR\n  B[Browser] --> SW[Service worker]\n  SW -->|cache| C[(Cached shell)]\n  SW -->|online| N[Network]\n  M[Manifest] -->|install| H[Home screen or Play Store wrapper]`,
    ask: [['What works offline?', 'Which screens and data are cached, and how the app syncs once back online.'], ['How do updates reach installed users?', 'Service worker update flow and cache versioning.']] },
  { id: 'testing', title: 'Testing', dep: /^(vitest|@playwright\/test|@axe-core\/playwright)$/, code: null,
    what: 'Automated checks that run before a change ships: unit tests, browser tests, accessibility scans.',
    how: () => `flowchart LR\n  C[Code change] --> U[Unit tests]\n  C --> E[Browser end-to-end tests]\n  E --> A[Accessibility scan]\n  U --> G{All green?}\n  A --> G\n  G -->|yes| S[Ship]`,
    ask: [['What do your tests cover and what do they not?', 'Name the risky paths covered and one known gap.'], ['How do you keep end-to-end tests from being flaky?', 'Stable selectors, no fixed sleeps, isolated test data.']] },
  { id: 'email', title: 'Email', dep: /^(resend|nodemailer|@sendgrid\/mail|postmark|@react-email\/.+)$/, code: /api\.resend\.com|RESEND_API_KEY|nodemailer|sendMail\(/,
    what: 'Messages the product sends: order alerts, verification, receipts. A template turns data into a branded HTML email plus a plain-text copy; a provider delivers it.',
    how: (p) => `sequenceDiagram\n  participant E as Event (order, sign-up, reset)\n  participant A as App server\n  participant T as Template\n  participant P as ${p.emailProvider}\n  participant I as Inbox\n  E->>A: something happened\n  A->>T: render with escaped data\n  T-->>A: subject, HTML, plain-text copy\n  A->>P: send over HTTPS with API key\n  P->>I: deliver (SPF, DKIM, DMARC)\n  P-->>A: accepted or error (logged, order never blocked)`,
    ask: [['How do your emails get built and sent?', 'Template, escaping of user text, provider call, what happens when the provider is down.'], ['Why do emails land in inbox, not spam?', 'SPF, DKIM, DMARC on your own domain, plain-text twin, an unsubscribe line for marketing mail.'], ['How do you make email work in dark mode and Outlook?', 'Table layout, inline styles, prefers-color-scheme block, tested in real clients.']] },
  { id: 'hosting', title: 'Hosting and deployment', dep: null, code: null, file: /(^|\/)(wrangler\.(jsonc?|toml)|vercel\.json)$/,
    what: 'Where the code runs and how a change reaches users.',
    how: (p) => `flowchart LR\n  D[Developer] -->|git push| G[GitHub]\n  G -->|CI: tests and checks| C{Pass?}\n  C -->|yes| H[${p.host}]\n  C -->|no| F[Fix first]\n  H --> U[Users]\n  H -.rollback.-> H`,
    ask: [['How does code get to production?', 'Push, CI checks, deploy step, and how you roll back.'], ['What do you do when production breaks?', 'Logs and error tracking first, rollback, then a fix with a test.'], ['How are secrets handled?', 'Environment variables on the host, never in git, a secret scan in CI.']] },
  { id: 'payments', title: 'Payments', dep: /^(stripe|@stripe\/.+|razorpay)$/, code: null,
    what: 'Takes money. Card data goes to the provider, never through your server.',
    how: () => `sequenceDiagram\n  participant U as Customer\n  participant A as App\n  participant S as Payment provider\n  U->>A: checkout\n  A->>S: create payment (idempotency key)\n  S-->>U: hosted payment form\n  S->>A: signed webhook: paid\n  A->>A: verify signature, mark order paid once`,
    ask: [['What stops a customer being charged twice?', 'Idempotency key plus a webhook handler that ignores repeats.'], ['How do you trust the webhook?', 'Signature check with the provider secret before doing anything.']] },
  { id: 'observability', title: 'Monitoring and analytics', dep: /^(@sentry\/.+|posthog-js|posthog-node|@vercel\/analytics)$/, code: null,
    what: 'Tells you when something breaks and how people actually use the product.',
    how: () => `flowchart LR\n  A[App] -->|errors| E[Error tracker]\n  A -->|events, no personal data| P[Analytics]\n  E --> N[Alert to owner]\n  P --> D[Dashboard]`,
    ask: [['How would you know the site is down?', 'Error tracker, uptime check, who gets the alert.'], ['What do you track and what do you refuse to track?', 'Privacy: no personal data in events, consent where the law needs it.']] },
  { id: 'ai', title: 'AI features', dep: /^(@anthropic-ai\/sdk|openai|ai|@ai-sdk\/.+)$/, code: null,
    what: 'Model calls inside the product, with the model\'s output treated as untrusted.',
    how: () => `flowchart LR\n  U[User input] --> G[Server: fence and validate]\n  G --> M[Model API]\n  M --> V[Validate output shape]\n  V --> A[App action or answer]`,
    ask: [['How do you stop prompt injection?', 'Untrusted text fenced, permissions enforced in code not in the prompt.'], ['What does it cost and how do you cap it?', 'Per-request token limits, a monthly budget, cheaper model for easy cases.']] },
  { id: 'i18n', title: 'Languages (i18n)', dep: /^(next-intl|i18next|react-i18next)$/, code: null, file: /(^|\/)messages\/[a-z]{2}\.json$/,
    what: 'The same screens in more than one language.',
    how: () => `flowchart LR\n  R[Request] --> L{Locale?}\n  L -->|header or path| M[Message file]\n  M --> P[Page text in that language]`,
    ask: [['How do you add a new language?', 'One message file, no code change, and a check that no key is missing.']] },
];

// ---------- 3. Detect ----------
const isConf = (f) => /(^|\/)wrangler\.(jsonc?|toml)$/.test(f.rel);
// Auth patterns must not match SQL dumps or shell scripts: only application code proves a sign-in flow.
const APP_CODE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.rb', '.swift', '.kt', '.java', '.py']);
const found = CAPS.filter((c) =>
  (c.when && c.when()) ||
  (c.dep && [...deps].some((d) => c.dep.test(d))) ||
  (c.code && files.some((f) => (c.id === 'auth' ? APP_CODE : CODE).has(extname(f.rel)) && c.code.test(f.text))) ||
  (c.file && files.some((f) => c.file.test(f.rel))) ||
  (c.conf && files.some((f) => isConf(f) && c.conf.test(f.text))));
const has = (id) => found.some((c) => c.id === id);
const hits = (c) => c.pick ? c.pick().slice(0, 5) : files.filter((f) => (c.code && (c.id !== 'auth' || APP_CODE.has(extname(f.rel))) && c.code.test(f.text)) || (c.conf && isConf(f) && c.conf.test(f.text)) || (c.file && c.file.test(f.rel)) || (c.dep && /package\.json$/.test(f.rel) && [...deps].some((d) => c.dep.test(d) && f.text.includes(`"${d}"`)))).map((f) => f.rel).slice(0, 5);
// Services reached over plain HTTP (no package) still show a name instead of "none found".
const confTech = (c) => [['d1_databases', 'Cloudflare D1'], ['kv_namespaces', 'Cloudflare KV'], ['r2_buckets', 'Cloudflare R2']].filter(([k]) => c.conf && files.some((f) => isConf(f) && f.text.includes(k) && c.conf.test(f.text)) && c.conf.source.includes(k)).map(([, n]) => n);
const tech = (c) => { const d = [...depList(c), ...confTech(c)]; return d.length ? d : c.id === 'email' ? [`${facts.emailProvider} (HTTP API)`] : c.id === 'hosting' ? [facts.host] : []; };
const depList = (c) => c.dep ? [...deps].filter((d) => c.dep.test(d)).sort() : [];
const all = files.map((f) => f.text).join('\n');
const facts = {
  host: files.some(isConf) ? 'Cloudflare Workers' : files.some((f) => /vercel\.json$/.test(f.rel)) || deps.has('next') ? 'Vercel' : 'Hosting provider',
  rls: files.some((f) => f.rel.endsWith('.sql') && /enable row level security|create policy/i.test(f.text)),
  emailProvider: /resend/i.test(all) ? 'Resend' : /sendgrid/i.test(all) ? 'SendGrid' : /postmark/i.test(all) ? 'Postmark' : /nodemailer/i.test(all) ? 'SMTP server' : 'Email provider',
};

// Motion: what moves, whether reduced-motion is respected, whether hidden-until-revealed classes still show with JavaScript off.
const MOTION = [['CSS keyframe animation', /@keyframes|(^|[\s;{"'])animation(-name)?\s*:/], ['CSS transitions', /(^|[\s;{"'])transition\s*:/], ['Scroll reveal (IntersectionObserver)', /IntersectionObserver/], ['Frame loop (requestAnimationFrame)', /requestAnimationFrame/]];
const webFiles = files.filter((f) => /\.(css|html|[mc]?[jt]sx?)$/.test(f.rel));
const motionKinds = MOTION.filter(([, re]) => webFiles.some((f) => re.test(f.text))).map(([n]) => n);
const reducedAt = webFiles.filter((f) => /prefers-reduced-motion/.test(f.text)).map((f) => f.rel).slice(0, 5);
const cssAll = webFiles.filter((f) => f.rel.endsWith('.css') || f.rel.endsWith('.html')).map((f) => f.text).join('\n');
const HIDDEN = /(^|[,}\s])\.[\w-]*(reveal|fade|appear|in-view|animate)[\w-]*\s*\{[^}]*opacity:\s*0\b/i;
const scopedHidden = /(html)?\.js\s+\.[\w-]*(reveal|fade|appear|in-view|animate)[\w-]*\s*\{[^}]*opacity:\s*0\b[^}]*\}/gi; // hidden only once JavaScript has set the .js class
const hiddenReveal = HIDDEN.test(cssAll) || /\.js\s+\.[\w-]*(reveal|fade|appear|in-view|animate)/i.test(cssAll);
const noJsGuard = !HIDDEN.test(cssAll.replace(scopedHidden, '')) || /<noscript>|scripting:\s*none|\.no-js/i.test(cssAll);
const formFiles = files.filter((f) => f.rel.endsWith('.html') && /<form\b(?![^>]*\baction\s*=)/i.test(f.text)).map((f) => f.rel).slice(0, 5);

// Email quality: why this exists. A product shipped with a plain, untemplated email and no gate noticed. These flags are the gate.
const mailFiles = files.filter((f) => /mail/i.test(f.rel) || /api\.resend\.com|RESEND_API_KEY|nodemailer|sendMail\(/.test(f.text));
const mailText = mailFiles.map((f) => f.text).join('\n');
const htmlMail = /\bhtml\s*[:=,]|<table|<div|<html|<p>/.test(mailText);
// A text-only mail (an owner notification) has no HTML to template, dark-mode or escape: judge it on the plain body alone.
const emailFlags = has('email') && !htmlMail ? [['Plain-text body is sent', /\btext\s*[:=,]|text:\s*/.test(mailText)]] : has('email') ? [
  ['Reusable template (one layout, not a string per email)', /layout|template|render\(/i.test(mailFiles.map((f) => f.rel).join('\n') + mailText)],
  ['Plain-text twin sent with the HTML', /\btext\s*[:=,]|text:\s*/.test(mailText)],
  ['Dark mode (prefers-color-scheme)', /prefers-color-scheme/.test(mailText)],
  ['Hidden preheader line', /display:\s*none/.test(mailText)],
  ['User text escaped before it enters HTML', /esc\(|escape|&#/.test(mailText)],
] : [];

// ---------- 4. Write ----------
const hash = createHash('sha256').update(JSON.stringify([found.map((c) => c.id), Object.keys(langCount).sort(), found.flatMap(depList), motionKinds, !!reducedAt.length, hiddenReveal && noJsGuard, formFiles.length])).digest('hex').slice(0, 12);
const list = (a) => a.length ? a.map((x) => `\`${x}\``).join(', ') : '_none found_';
const langs = Object.entries(langCount).sort((a, b) => b[1] - a[1]);

const stack = [
  `# ${projectName}: tech stack`, '',
  `<!-- generated by operations/scripts/techdocs.mjs; stack-hash: ${hash}. Edit the code, then regenerate. Do not hand-edit. -->`, '',
  'One page that explains what this product is built with, where each part lives, and how it works. Every row was found in the repo, none is guessed.', '',
  '## Languages', '', '| Language | Source files |', '|---|---|', ...langs.map(([l, n]) => `| ${l} | ${n} |`), '',
  '## Services at a glance', '', '| Part | Tech found | Where in the code |', '|---|---|---|',
  ...found.map((c) => `| ${c.title} | ${list(tech(c))} | ${list(hits(c).slice(0, 2))} |`), '',
  ...found.flatMap((c) => [
    `## ${c.title}`, '', `**What it does:** ${c.what}`, '', `**Tech found:** ${list(tech(c))}`, '', `**Where in the code:** ${list(hits(c))}`, '',
    '**How it works**', '', '```mermaid', c.how(facts), '```', '',
    ...(c.id === 'email' ? ['**Email quality (the gate)**', '', '| Check | Status |', '|---|---|', ...emailFlags.map(([n, ok]) => `| ${n} | ${ok ? 'yes' : 'NO'} |`), '', 'Any NO fails `techdocs.mjs --check`. Fix with `ai/skills/email/SKILL.md`: one layout, tokens from `DESIGN.md`, a plain-text copy, light and dark.', ''] : []),
  ]),
  ...(motionKinds.length ? ['## Motion', '', 'What moves on screen and whether it stays accessible. Found by reading CSS, HTML and JavaScript.', '',
    `**Kinds of motion:** ${list(motionKinds)}`, '',
    `**Reduced motion respected:** ${reducedAt.length ? `yes, \`prefers-reduced-motion\` found in ${list(reducedAt)}` : 'no, no `prefers-reduced-motion` override found. Add one that turns off or shortens animation.'}`, '',
    `**Hidden-until-revealed classes guarded for no-JS:** ${!hiddenReveal ? 'not applicable, no initial-hidden reveal classes found' : noJsGuard ? 'yes, hidden state is scoped to a `.js` class, a `noscript` rule or `scripting: none`' : 'no, a reveal class starts at `opacity: 0` and nothing makes it visible when JavaScript is off'}`, ''] : []),
  ...(formFiles.length ? ['## Interactive forms without a backend', '', `Forms with no \`action\` found in ${list(formFiles)}. A static host cannot receive a submit. Either handle it in JavaScript (and say so on the page), post to a form service or function, or remove the form.`, ''] : []),
].join('\n');

const interview = [
  `# ${projectName}: interview prep`, '', `<!-- generated by operations/scripts/techdocs.mjs; stack-hash: ${hash} -->`, '',
  'Questions an interviewer is likely to ask about this project. For each: the answer must come from your own code. Open the file in the last column, read it, then say the answer out loud in your own words.', '',
  '## Always asked', '', '| Question | A strong answer covers | Where to look |', '|---|---|---|',
  '| Walk me through the project in two minutes. | Who it is for, the problem, the stack, one thing you are proud of. | `README.md`, `architecture/TECH-STACK.md` |',
  '| What was the hardest bug? | Symptom, how you found the cause, the fix, the test that now guards it. | `git log`, `governance-learning/` lessons |',
  '| What would you change with more time? | One honest weakness and the specific fix, not "nothing". | `product-growth/` roadmap |',
  '| How do you know it works? | Tests you wrote, checks in CI, what you tested in a real browser or device. | `tests/`, CI workflow |',
  '| How is it secure? | Secrets out of git, server-side permission checks, escaped user input, row rules. | `security/` folder |',
  '| What did AI write and what did you decide? | You chose the design and verified the output; you can explain every line you shipped. | the diff, your decisions log |', '',
  ...found.flatMap((c) => [`## ${c.title}`, '', '| Question | A strong answer covers | Where to look |', '|---|---|---|', ...c.ask.map(([q, a]) => `| ${q} | ${a} | ${list(hits(c).slice(0, 2))} |`), '']),
  ...(motionKinds.length ? ['## Motion', '', '| Question | A strong answer covers | Where to look |', '|---|---|---|',
    '| How do you keep animation accessible? | `prefers-reduced-motion` turns motion off or shortens it; nothing flashes; content never depends on animation to be readable. | the stylesheet |',
    '| What does the page look like with JavaScript off? | Reveal classes only hide content when a `.js` class is set, so text is visible without scripts. | `<noscript>`, `.js` rules |', ''] : []),
  '## Rules for the room', '', '- Say "I do not know yet, here is how I would find out" instead of guessing.', '- Quote numbers only if you measured them (load time, order count, test count).', '- Be ready to open the repo and show the file you are describing.', '',
].join('\n');

const topLangs = langs.slice(0, 3).map(([l]) => l).join(', ');
const tags = [...new Set([...langs.map(([l]) => l), ...found.map((c) => c.title)])];
const showcase = [
  `# ${projectName}: showcase kit`, '', `<!-- generated by operations/scripts/techdocs.mjs; stack-hash: ${hash} -->`, '',
  'Drafts for posting. They use only facts found in the code. Replace every `[YOUR ...]` with a number you measured, and delete any line you cannot back up. Never post a metric you did not measure.', '',
  '## Rules', '', '- Show the real thing: screenshot, short screen recording, the architecture diagram from `architecture/TECH-STACK.md`.', '- No customer names, phone numbers, keys, internal URLs or admin screens in any image. Use demo data.', '- Say what you built and what you learned. Do not claim scale you do not have.', '- If a client owns the product, get their OK before posting.', '',
  '## LinkedIn post (draft)', '', '```text',
  `I built ${projectName}: [ONE LINE: who it is for and the problem it solves].`, '',
  `Stack: ${topLangs}${found.length ? ', ' + found.slice(0, 4).map((c) => c.title.toLowerCase()).join(', ') : ''}.`, '',
  'What I am proudest of:', ...found.slice(0, 3).map((c) => `- ${c.title}: [YOUR ONE SENTENCE on a decision you made and why]`), '',
  'Result so far: [YOUR MEASURED NUMBER, or delete this line].', 'What I would do differently: [ONE HONEST LESSON].', '', `#${tags.slice(0, 5).map((t) => t.replace(/[^A-Za-z0-9]/g, '')).join(' #')}`, '```', '',
  '## Thread for X (draft, one idea per post)', '', '1. What it is and who it is for, plus the main screenshot.', ...found.slice(0, 4).map((c, i) => `${i + 2}. ${c.title}: one diagram or screenshot and one sentence on how it works.`), `${Math.min(found.length, 4) + 2}. One mistake and the check that now prevents it.`, `${Math.min(found.length, 4) + 3}. Link to the repo or live site.`, '',
  '## Carousel (6 slides)', '', '1. Title and one-line problem.', '2. The product (real screenshot).', '3. The stack on one slide (languages and services from this repo).', '4. The architecture diagram (render the Mermaid block from TECH-STACK.md).', '5. The hardest problem and how it was solved.', '6. What I learned and how to reach me.', '',
  '## Skills this project shows', '', '| Skill | Evidence in the repo |', '|---|---|', ...found.map((c) => `| ${c.title} | ${list(hits(c).slice(0, 2))} |`), ...(motionKinds.length ? [`| Motion and accessibility | ${list(motionKinds.slice(0, 2))} |`] : []), '',
  '## Turning a diagram into an image', '', 'Paste a Mermaid block into https://mermaid.live and export PNG or SVG, or run `npx @mermaid-js/mermaid-cli -i in.mmd -o out.png`. Check the image has no private data before posting.', '',
].join('\n');

const outputs = { 'architecture/TECH-STACK.md': stack, 'governance-learning/INTERVIEW-PREP.md': interview, 'product-growth/SHOWCASE.md': showcase };

// ---------- 5. Check mode ----------
if (CHECK) {
  const bad = [], warn = [];
  const p = join(root, 'architecture/TECH-STACK.md');
  if (!existsSync(p)) bad.push('architecture/TECH-STACK.md missing: run node operations/scripts/techdocs.mjs');
  else {
    const t = readFileSync(p, 'utf8');
    if (!t.includes(`stack-hash: ${hash}`)) bad.push('TECH-STACK.md is stale: the stack changed. Regenerate with node operations/scripts/techdocs.mjs');
    const sections = t.split(/^## /m).slice(1).filter((s) => !/^(Languages|Services at a glance|Motion|Interactive forms without a backend)/.test(s));
    for (const s of sections) if (!s.includes('```mermaid')) bad.push(`TECH-STACK.md: section "${s.split('\n')[0]}" has no Mermaid diagram`);
  }
  if (motionKinds.length && !reducedAt.length) warn.push('motion found but no `prefers-reduced-motion` override: add one so people who ask for less motion get it');
  if (hiddenReveal && !noJsGuard) warn.push('a reveal class starts hidden (opacity: 0) with no no-JS fallback: scope it under a `.js` class or add a noscript rule');
  for (const [n, ok] of emailFlags) if (!ok) bad.push(`email: missing "${n}" (see ai/skills/email/SKILL.md)`);
  const bare = files.filter((f) => CODE.has(extname(f.rel)) && !/test|spec|\.d\.ts|(migrations?|drizzle)\//.test(f.rel))
    .filter((f) => !f.text.split('\n').filter((l) => l.trim() && !l.startsWith('#!')).slice(0, 3).some((l) => /^\s*(\/\/|\/\*|\*|#|--)/.test(l)));
  if (bare.length) (process.env.TECHDOCS_STRICT === '1' ? bad : warn).push(`${bare.length} source file(s) have no header comment saying what the file is for, e.g. ${bare.slice(0, 3).map((f) => f.rel).join(', ')}`);
  for (const w of warn) console.warn(`techdocs: warn: ${w}`);
  for (const b of bad) console.error(`techdocs: ${b}`);
  const showcase_ = join(root, 'product-growth/SHOWCASE.md');
  if (existsSync(showcase_) && /\[YOUR /.test(readFileSync(showcase_, 'utf8'))) console.warn('techdocs: warn: SHOWCASE.md still has [YOUR ...] placeholders: fill or delete before posting');
  console.log(`techdocs: ${found.length} parts, ${langs.length} languages, ${bad.length} problem(s)`);
  process.exit(bad.length ? 1 : 0);
}

for (const [rel, text] of Object.entries(outputs)) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text.endsWith('\n') ? text : text + '\n');
  console.log(`techdocs: wrote ${rel}`);
}
