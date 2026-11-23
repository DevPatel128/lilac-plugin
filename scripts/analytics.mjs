#!/usr/bin/env node
// Lilac analytics: tie measurement to the brief's one success number, nothing more.
// Usage: node scripts/analytics.mjs plan <dir> [--provider plausible|posthog]   reads <dir>/BRIEF.md, writes analytics/plan.md and analytics/snippet.html
// Reads the brief's "## Success" (must contain a number, e.g. "500 mailing-list signups in 90 days") and "## Main action", extracts metric, target and window,
// and wires the main action to ONE named event. Cookieless by default (Plausible; PostHog uses memory persistence, so no cookie). Keys come from the
// env (PLAUSIBLE_DOMAIN, POSTHOG_KEY) or stay UNKNOWN. Refuses when Success has no number ("success must be a number").
// Offline; writes only under <dir>/analytics through safe-fs. It does not read analytics back or prove the number is reached.
// shortcut: parses one "N <metric> in <M> <unit>" sentence; anything stranger gets the number and an UNKNOWN window, edit plan.md by hand.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeWriteFile } from '../lib/safe-fs.mjs';

const section = (md, h) => (md.match(new RegExp(`^##\\s+${h}\\s*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'im')) || [])[1]?.trim() || '';
export function parseSuccess(text) {
  const m = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(k\b|m\b)?\s*([^\d]*?)(?:\s+(?:in|within|by)\s+(?:the\s+)?(?:(?:first|next)\s+)?(\d+)\s*(day|week|month|year)s?)?\s*[.!]?\s*$/i);
  if (!m) return null;
  const target = Number(m[1].replace(/,/g, '')) * ({ k: 1e3, m: 1e6 }[(m[2] || '').toLowerCase()] || 1);
  const metric = m[3].trim().replace(/^of\s+/, '');
  if (!Number.isFinite(target) || target <= 0 || !metric) return null;
  return { target, metric, window: m[4] ? `${m[4]} ${m[5].toLowerCase()}s` : 'UNKNOWN' };
}
export const eventName = (action) => action.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 5).join('_') || 'main_action';

export function plan(dir, provider = 'plausible') {
  const f = join(dir, 'BRIEF.md'); if (!existsSync(f)) return { error: 'BRIEF.md not found in ' + dir };
  const md = readFileSync(f, 'utf8'), succ = section(md, 'Success'), action = section(md, 'Main action');
  if (!/\d/.test(succ)) return { error: 'success must be a number. The brief\'s Success line is "' + (succ || 'empty') + '". Rewrite it like "500 mailing-list signups in 90 days", then rerun.' };
  const s = parseSuccess(succ); if (!s) return { error: 'success must be a number with a metric, e.g. "500 mailing-list signups in 90 days". Got: ' + succ };
  if (!action) return { error: 'the brief has no Main action to wire the event to' };
  const ev = eventName(action.split('\n')[0]);
  const domain = process.env.PLAUSIBLE_DOMAIN || 'UNKNOWN_DOMAIN', key = process.env.POSTHOG_KEY || 'UNKNOWN_POSTHOG_KEY';
  const wire = (fn) => `<script>\n// Fire the event when the visitor takes the main action. Mark that button or form with data-lilac-action.\ndocument.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-lilac-action]')) { ${fn}; } });\ndocument.addEventListener('submit', function (e) { if (e.target.matches && e.target.matches('[data-lilac-action]')) { ${fn}; } });\n</script>\n`;
  const snippet = provider === 'posthog'
    ? `<!-- PostHog, cookieless: persistence "memory" sets no cookie and no localStorage. Key: ${key} (set POSTHOG_KEY). Verify the loader line against PostHog's current docs. -->\n<script>\n!function(t,e){/* paste PostHog's current snippet here */}(window,document);\nposthog.init('${key}', { api_host: 'UNKNOWN_API_HOST', persistence: 'memory', autocapture: false, disable_session_recording: true });\n</script>\n${wire(`posthog.capture('${ev}')`)}`
    : `<!-- Plausible, cookieless by design (no cookies, no personal data). Domain: ${domain} (set PLAUSIBLE_DOMAIN). -->\n<script defer data-domain="${domain}" src="https://plausible.io/js/script.js"></script>\n<script>window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };</script>\n${wire(`plausible('${ev}')`)}`;
  const md2 = `# Analytics plan\n\nFrom the brief. Nothing here is measured yet: this is the plan, and the snippet is not installed until you paste it.\n\n- Success line: ${succ}\n- Metric: ${s.metric}\n- Target: ${s.target}\n- Window: ${s.window}\n- Main action: ${action.split('\n')[0]}\n- Event: \`${ev}\` (one event, fired on the main action; mark the button or form with data-lilac-action)\n- Provider: ${provider} (cookieless; no consent banner needed for it. A banner is still needed if other services set cookies: run consent.mjs audit)\n- Check cadence: UNKNOWN (suggest weekly)\n- Pace to hit the target: ${s.window === 'UNKNOWN' ? 'UNKNOWN (no window in the Success line)' : s.target + ' ' + s.metric + ' in ' + s.window}\n\n## What counts\nOnly \`${ev}\` events count toward the target. Page views alone are not success.\n\n## Not tracked\nNo user profiles, no session recordings, no advertising pixels.\n`;
  return { md: md2, snippet, ev, s };
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const a = process.argv.slice(2), die = (m, c = 2) => { console.error(`analytics: ${m}`); process.exit(c); };
  if (a[0] !== 'plan' || !a[1]) die('usage: plan <dir> [--provider plausible|posthog]');
  const i = a.indexOf('--provider'), prov = i > 0 ? a[i + 1] : 'plausible';
  if (!['plausible', 'posthog'].includes(prov)) die('--provider must be plausible or posthog');
  const dir = resolve(a[1]), r = plan(dir, prov);
  if (r.error) die(r.error, 1);
  safeWriteFile(dir, 'analytics/plan.md', r.md, { overwrite: true }); safeWriteFile(dir, 'analytics/snippet.html', r.snippet, { overwrite: true });
  console.log(`analytics: ${r.s.target} ${r.s.metric} in ${r.s.window}; event ${r.ev}; wrote analytics/plan.md and analytics/snippet.html`);
}
