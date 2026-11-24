#!/usr/bin/env node
// Lilac consent: find third-party embeds, make the cookie list honest, add a fair consent banner only when one is needed.
// Usage: node scripts/consent.mjs audit <dir>                       exit 1 when an embed is undeclared/incomplete or a needed banner is missing
//        node scripts/consent.mjs init <dir> --law gdpr|dpdp|ccpa|lgpd   writes privacy/cookies.md, privacy/consent.html, privacy/privacy-policy-outline.md
// audit scans *.html for known third-party scripts, iframes and stylesheets, and requires each in <dir>/privacy/cookies.md
// (table: name, purpose, cookies set, duration, vendor, lawful basis). A banner is needed only when a found service sets non-essential cookies/trackers;
// cookieless analytics (Plausible, Fathom, GoatCounter) and no embeds need none. Fonts/maps without cookies are declared but do not force a banner.
// init never invents company details: unknown fields are written as UNKNOWN. It does not overwrite existing files.
// Offline. Writes only under <dir>/privacy through safe-fs. Not legal advice.
// shortcut: a fixed vendor list and static HTML only (scripts injected at runtime or loaded by a tag manager are not seen); extend VENDORS when a vendor is missed.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeWriteFile } from '../lib/safe-fs.mjs';

// id, label, kind, host regex, sets non-essential cookies/trackers?
export const VENDORS = [
  ['google-analytics', 'Google Analytics / Tag Manager', 'analytics', /googletagmanager\.com|google-analytics\.com/, true],
  ['meta-pixel', 'Meta Pixel', 'analytics', /connect\.facebook\.net/, true],
  ['hotjar', 'Hotjar', 'analytics', /hotjar\.com/, true],
  ['clarity', 'Microsoft Clarity', 'analytics', /clarity\.ms/, true],
  ['segment', 'Segment', 'analytics', /segment\.(com|io)\/analytics/, true],
  ['plausible', 'Plausible (cookieless)', 'analytics', /plausible\.io/, false],
  ['fathom', 'Fathom (cookieless)', 'analytics', /usefathom\.com|cdn\.usefathom/, false],
  ['goatcounter', 'GoatCounter (cookieless)', 'analytics', /goatcounter\.com/, false],
  ['posthog', 'PostHog', 'analytics', /posthog\.com|i\.posthog/, true],
  ['youtube', 'YouTube embed', 'video', /youtube\.com\/embed|youtu\.be/, true],
  ['youtube-nocookie', 'YouTube (privacy-enhanced) embed', 'video', /youtube-nocookie\.com/, false],
  ['vimeo', 'Vimeo embed', 'video', /player\.vimeo\.com/, true],
  ['google-maps', 'Google Maps', 'maps', /google\.com\/maps|maps\.googleapis\.com/, true],
  ['openstreetmap', 'OpenStreetMap embed', 'maps', /openstreetmap\.org/, false],
  ['intercom', 'Intercom chat', 'chat', /intercom(cdn)?\.(com|io)/, true],
  ['crisp', 'Crisp chat', 'chat', /crisp\.chat/, true],
  ['tawk', 'Tawk.to chat', 'chat', /tawk\.to/, true],
  ['drift', 'Drift chat', 'chat', /drift\.com|driftt\.com/, true],
  ['hubspot', 'HubSpot', 'chat', /hs-scripts\.com|hsforms\.net|hubspot\.com/, true],
  ['google-fonts', 'Google Fonts', 'fonts', /fonts\.googleapis\.com|fonts\.gstatic\.com/, false],
  ['adobe-fonts', 'Adobe Fonts', 'fonts', /use\.typekit\.net/, false],
  ['twitter', 'X / Twitter embed', 'social', /platform\.twitter\.com|platform\.x\.com/, true],
  ['facebook', 'Facebook plugin', 'social', /facebook\.com\/plugins/, true],
  ['linkedin', 'LinkedIn embed', 'social', /platform\.linkedin\.com|linkedin\.com\/embed/, true],
  ['instagram', 'Instagram embed', 'social', /instagram\.com\/embed|instagram\.com\/.*embed\.js/, true],
  ['addthis', 'AddThis', 'social', /addthis\.com|sharethis\.com/, true],
];
const CAPTURE = /<(?:script|iframe|link|img|embed)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
const SKIP = new Set(['node_modules', '.git', '.lilac', 'privacy', 'analytics']);
const LAWS = ['gdpr', 'dpdp', 'ccpa', 'lgpd'];
const COLS = ['name', 'purpose', 'cookies set', 'duration', 'vendor', 'lawful basis'];

function pages(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n), s = statSync(p);
    if (s.isDirectory()) pages(p, out); else if (/\.html?$/i.test(n)) out.push(p);
  }
  return out;
}
export function scan(dir) {
  const found = new Map(); let banner = false;
  for (const f of pages(dir)) {
    const html = readFileSync(f, 'utf8');
    if (/data-lilac-consent\b/.test(html)) banner = true;
    for (const m of html.matchAll(CAPTURE)) {
      const url = m[1];
      for (const v of VENDORS) if (v[3].test(url) && !found.has(v[0])) found.set(v[0], { id: v[0], label: v[1], kind: v[2], cookies: v[4], url: url.slice(0, 120), file: f.slice(dir.length + 1) });
      // PostHog set to memory persistence is cookieless
    }
    if (found.has('posthog') && /persistence\s*:\s*["']memory["']/.test(html)) found.get('posthog').cookies = false;
  }
  return { found: [...found.values()], banner };
}
// Parse the markdown table rows of privacy/cookies.md into arrays of cells.
function declared(dir) {
  const f = join(dir, 'privacy', 'cookies.md'); if (!existsSync(f)) return null;
  return readFileSync(f, 'utf8').split('\n').filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:|-]+\|?\s*$/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
    .filter((r) => r[0] && r[0].toLowerCase() !== 'name');
}
export function audit(dir) {
  const { found, banner } = scan(dir); const rows = declared(dir); const problems = [];
  if (found.length && !rows) problems.push('privacy/cookies.md is missing (run: consent.mjs init <dir> --law <gdpr|dpdp|ccpa|lgpd>)');
  for (const v of found) {
    const row = rows?.find((r) => { const t = r.join(' ').toLowerCase(); return t.includes(v.id) || t.includes(v.label.toLowerCase().split(' ')[0]); });
    if (!row) problems.push(`undeclared: ${v.label} (${v.kind}) found in ${v.file}`);
    else if (row.length < COLS.length || row.some((c) => !c || /^UNKNOWN\b/i.test(c))) problems.push(`incomplete: ${v.label} row in cookies.md has an empty or UNKNOWN field`);
  }
  const needBanner = found.some((v) => v.cookies);
  if (needBanner && !banner) problems.push('consent banner needed (non-essential cookies/trackers: ' + found.filter((v) => v.cookies).map((v) => v.label).join(', ') + ') but no element with data-lilac-consent was found (see privacy/consent.html)');
  return { found, needBanner, banner, problems };
}

const BANNER = (law) => `<!-- Lilac consent banner (${law}). Accept and Reject are the same size and weight on purpose; nothing is pre-ticked; Reject is one click, like Accept.
     The choice is stored only in this browser (localStorage key lilac-consent). Hold every non-essential script until accepted by marking it:
       <script type="text/plain" data-consent="analytics" src="..."></script>
     and it is switched on here only after Accept. Edit the wording; keep the two buttons equal. -->
<div data-lilac-consent role="dialog" aria-modal="false" aria-label="Cookie choices" hidden style="position:fixed;inset:auto 1rem 1rem 1rem;max-width:34rem;padding:1rem;background:#fff;color:#111;border:1px solid #888;border-radius:.5rem;font:16px/1.4 system-ui,sans-serif">
  <p>We would like to use cookies for UNKNOWN (say what each is for). Everything else works without them. <a href="/privacy">Privacy policy</a></p>
  <div style="display:flex;gap:.5rem"><button type="button" data-lilac-consent-accept style="flex:1;padding:.6rem;font:inherit;border:1px solid #111;background:#fff;color:#111">Accept</button>
  <button type="button" data-lilac-consent-reject style="flex:1;padding:.6rem;font:inherit;border:1px solid #111;background:#fff;color:#111">Reject</button></div>
</div>
<script>
(function () {
  var K = 'lilac-consent', box = document.querySelector('[data-lilac-consent]');
  function get() { try { return JSON.parse(localStorage.getItem(K)); } catch (e) { return null; } }
  function set(c) { try { localStorage.setItem(K, JSON.stringify({ choice: c, at: new Date().toISOString() })); } catch (e) {} }
  function enable() { document.querySelectorAll('script[type="text/plain"][data-consent]').forEach(function (s) { var n = document.createElement('script'); for (var i = 0; i < s.attributes.length; i++) if (s.attributes[i].name !== 'type') n.setAttribute(s.attributes[i].name, s.attributes[i].value); n.text = s.text; s.replaceWith(n); }); }
  function done(c) { set(c); box.hidden = true; if (c === 'accept') enable(); }
  var g = get(); if (g && g.choice === 'accept') enable(); else if (!g) box.hidden = false;
  box.querySelector('[data-lilac-consent-accept]').onclick = function () { done('accept'); };
  box.querySelector('[data-lilac-consent-reject]').onclick = function () { done('reject'); };
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-lilac-consent-open]')) { e.preventDefault(); box.hidden = false; } });
  window.lilacConsent = { granted: function () { var c = get(); return !!c && c.choice === 'accept'; } };
})();
</script>
<!-- Footer link so people can change their mind any time: <a href="#" data-lilac-consent-open>Cookie choices</a> -->
`;

const LAW_NOTES = {
  gdpr: ['GDPR (EU/UK)', 'Opt-in before non-essential cookies. Name the controller and a contact, the lawful basis per purpose, retention, recipients, transfers outside the EU/UK, the rights (access, erasure, objection, portability, withdraw consent) and the supervisory authority you answer to.'],
  dpdp: ['DPDP Act (India)', 'Clear notice and free, specific, informed consent in plain language (English or a scheduled Indian language). Name the Data Fiduciary, the purposes, how to withdraw consent, how to make a complaint, and the grievance contact. Children: verifiable parental consent.'],
  ccpa: ['CCPA/CPRA (California)', 'Notice at collection; right to know, delete, correct, and opt out of sale/sharing; a "Do Not Sell or Share My Personal Information" link if you sell or share; honour the Global Privacy Control signal. Opt-out model, but the banner below is still fine.'],
  lgpd: ['LGPD (Brazil)', 'Consent must be free, informed and specific, or another legal basis (Art. 7) must be named. Name the controller and the person in charge of data protection (encarregado), purposes, sharing, retention, and the holder rights (access, correction, deletion, portability).'],
};
const OUTLINE = (law, found) => `# Privacy policy outline (${LAW_NOTES[law][0]})\n\nDraft skeleton. Fill every UNKNOWN with real facts; do not publish with UNKNOWN left. Not legal advice: have it reviewed.\n\nLaw note: ${LAW_NOTES[law][1]}\n\n## Who we are\n- Legal name: UNKNOWN\n- Address: UNKNOWN\n- Contact for privacy questions: UNKNOWN\n- Data protection officer / grievance officer (if the law requires one): UNKNOWN\n\n## What we collect and why\n${found.length ? found.map((v) => `- ${v.label}: purpose UNKNOWN, lawful basis UNKNOWN`).join('\n') : '- Nothing from third-party services was found on the pages. List the data your forms collect: UNKNOWN'}\n\n## Cookies\nSee the table in privacy/cookies.md. Link it from here.\n\n## How long we keep it\n- UNKNOWN\n\n## Who we share it with\n- UNKNOWN\n\n## Your rights and how to use them\n- UNKNOWN (list the rights above and the exact way to exercise them)\n\n## Changes to this policy\n- Date of last update: UNKNOWN\n`;

function init(dir, law) {
  const { found } = scan(dir);
  const row = (v) => `| ${v.label} | UNKNOWN | ${v.cookies ? 'UNKNOWN' : 'none'} | UNKNOWN | UNKNOWN | UNKNOWN |`;
  const cookies = `# Cookies and third-party services\n\nEvery third-party script, embed or font loaded by a page must have a row. \`consent.mjs audit\` fails on a missing row or an UNKNOWN cell.\nLawful basis for non-essential cookies is consent (${LAW_NOTES[law][0]}); strictly necessary ones may rely on legitimate interest or necessity.\n\n| ${COLS.map((c) => c[0].toUpperCase() + c.slice(1)).join(' | ')} |\n|${COLS.map(() => '---').join('|')}|\n${found.map(row).join('\n')}${found.length ? '\n' : ''}`;
  const files = { 'privacy/cookies.md': cookies, 'privacy/consent.html': BANNER(law), 'privacy/privacy-policy-outline.md': OUTLINE(law, found) };
  for (const [p, data] of Object.entries(files)) {
    if (existsSync(join(dir, p))) { console.log(`consent: ${p} exists, left alone`); continue; }
    safeWriteFile(dir, p, data); console.log(`consent: wrote ${p}`);
  }
  console.log(`consent: found ${found.length} third-party service(s); banner ${found.some((v) => v.cookies) ? 'NEEDED (paste privacy/consent.html into every page)' : 'not needed'}.`);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2), cmd = args[0], d = args[1];
  const die = (m) => { console.error(`consent: ${m}`); process.exit(2); };
  if (!['audit', 'init'].includes(cmd) || !d) die('usage: audit <dir> | init <dir> --law gdpr|dpdp|ccpa|lgpd');
  const dir = resolve(d); if (!existsSync(dir)) die(`no such directory: ${d}`);
  if (cmd === 'init') {
    const i = args.indexOf('--law'); const law = i > 0 ? args[i + 1] : undefined;
    if (!LAWS.includes(law)) die('--law must be one of: ' + LAWS.join(', '));
    init(dir, law);
  } else {
    const r = audit(dir);
    console.log(`consent audit: ${r.found.length} third-party service(s) found${r.found.length ? ': ' + r.found.map((v) => v.label + (v.cookies ? '' : ' [no cookies]')).join(', ') : ''}`);
    console.log(`banner: ${r.needBanner ? (r.banner ? 'needed, present' : 'needed, MISSING') : 'not needed' + (r.banner ? ' (present anyway)' : '')}`);
    for (const p of r.problems) console.log('FAIL ' + p);
    console.log(r.problems.length ? `${r.problems.length} problem(s)` : 'PASS');
    process.exit(r.problems.length ? 1 : 0);
  }
}
