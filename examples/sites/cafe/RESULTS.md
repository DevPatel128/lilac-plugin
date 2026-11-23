# Results: Corner Kiln (fictional demo cafe), Lilac gate run

Run on 2026-11-21/22, macOS, headless Chrome. Foundation approval: **approval pending owner** (status NONE; `approve` was not run). Nothing committed, pushed or deployed.

| Gate | Command | Result line | Pass/fail |
|---|---|---|---|
| Foundation check | `node operations/plugin/scripts/foundation.mjs check product-growth/media/demo-sites/cafe` | `foundation: 0 error(s), 0 warning(s)` | pass |
| Foundation drift | `node operations/plugin/scripts/foundation.mjs drift product-growth/media/demo-sites/cafe` | `foundation drift: 0 error(s), 1 warning(s)` | pass (warning accepted) |
| Foundation status | `node operations/plugin/scripts/foundation.mjs status product-growth/media/demo-sites/cafe` | `NONE: no approval yet. Run /lilac:foundation.` | approval pending owner |
| Hosting | `node operations/plugin/scripts/hosting.mjs check --project product-growth/media/demo-sites/cafe` | `hosting: 0 problem(s)` | pass |
| Static QA | `node operations/plugin/scripts/qa.mjs product-growth/media/demo-sites/cafe` | `qa: 0 error(s), 0 warning(s), 3 unverified` | pass |
| Browser QA | `node operations/plugin/scripts/qa-browser.mjs product-growth/media/demo-sites/cafe` | `qa-browser: 1 error(s), 0 warning(s), 4 unverified` | FAIL (1 error is a tool issue, see TOOL-ISSUES.md) |
| techdocs | `node kit/operations/scripts/techdocs.mjs product-growth/media/demo-sites/cafe --check` | `techdocs: 2 parts, 3 languages, 0 problem(s)` | pass |
| Controls | `node operations/plugin/scripts/controls-test.mjs product-growth/media/demo-sites/cafe` | `controls-test: 132 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)` | pass |
| Simulated visitors | `node operations/plugin/scripts/persona-test.mjs product-growth/media/demo-sites/cafe --visitors 30 --seed 7` | `persona-test: 30 simulated visitors, 84% tasks completed, 7 failure group(s)` (also `FAIL: overall 84% is below 90%`) | FAIL (all form-task failures trace to a tool issue; not re-proven by a rerun) |

Visitors are simulated, not real people. Screenshots read: index, menu, contact at 360, 768 and 1280 px (see UX-REVIEW.md); no cut-off text or overlap seen. Per-task lines: understand the offer 100% (28/28); find a way to contact/buy/book 100% (30/30); reach every top-nav page 100% (28/28); complete the main form 0% (0/22); find opening hours or a price 100% (30/30).

## Fixed
- Foundation: completed FOUNDATION.md and BRAND.md from the code and brief; generated `brand/` tokens; added `--danger` and replaced four typed error colours in `styles.css` with `var(--danger)`; underline draw time .9s to .5s (token limit 600 ms).
- Browser QA: the "Corner Kiln" home link was 165x32 px (21 warnings); `.brand{min-height:44px}` gives 0 warnings.
- UX review: date cannot be in the past (`site.js`); name and email `autocomplete` tokens (`contact.html`).
- Hosting: `.lilac/hosting.json`, `.gitignore` and `.github/workflows/lilac-checks.yml` written by `hosting.mjs choose` inside this folder.

## Tool issues found
See [TOOL-ISSUES.md](TOOL-ISSUES.md): native date input reported as a focus trap, and unfillable by `Input.insertText` (causes the 0% form task).

## Accepted risks (with reason)
- Drift warning, 3 durations (`1.4s`, `4s`, `6s`, styles.css lines 73, 109, 112): ambient loops and one ring, decoration only, can be paused, off under reduced motion; token limit is 600 ms for transitions.
- 3 qa UNVERIFIED items: `transparent` backgrounds on `.btn.alt`, `.chip`, `.motion-btn` cannot be computed by the tool; text there is `var(--ink)` on page `--bg`, contrast ratios in BUILD-LOG.
- No-JavaScript visitors now get thanks.html (superseded note, see the newest section below).
- `techdocs: warn: SHOWCASE.md still has [YOUR ...] placeholders`: owner's wording needed before posting.
- No CSP or security headers set in `wrangler.jsonc` (FOUNDATION.md security baseline).

## Needs people
- Owner approval of FOUNDATION.md, BRAND.md and tokens (`foundation.mjs approve`, human words only).
- Real device, screen reader, Safari and Firefox checks; real visitors (simulated ones are not users).
- Owner decision to deploy (not done); trademark search for the name before real use.
- A tool fix or an agreed approach so the date field can be tested, then re-run browser QA and persona-test.


## No-JavaScript form fallback and funnel (run 2026-11-23, macOS headless Chrome)

Change: the demo form is a real HTML form (`method="get" action="thanks.html"`). Only non-sensitive choices have a `name`, so name, email and message text are never put in the address. With JavaScript on, the script still validates and shows the in-page confirmation; with it off, the browser opens `thanks.html` (noindex, not in the menu or sitemap). Added `privacy.html` (in the sitemap) and a privacy link next to the form. Nothing committed, pushed or deployed.

| Gate | Command | Exact line | Pass/fail |
|---|---|---|---|
| Static QA | `node operations/plugin/scripts/qa.mjs product-growth/media/demo-sites/cafe` | `qa: 0 error(s), 0 warning(s), 3 unverified` | pass |
| Browser QA | `node operations/plugin/scripts/qa-browser.mjs product-growth/media/demo-sites/cafe` | `qa-browser: 0 error(s), 0 warning(s), 3 unverified` | pass (0 errors) |
| Controls | `node operations/plugin/scripts/controls-test.mjs product-growth/media/demo-sites/cafe` | `controls-test: 178 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)` | pass |
| techdocs | `node kit/operations/scripts/techdocs.mjs product-growth/media/demo-sites/cafe --check` | `techdocs: 2 parts, 3 languages, 0 problem(s)` | pass |
| Funnel | `node operations/plugin/scripts/funnel.mjs check product-growth/media/demo-sites/cafe` | `funnel: 0 error(s), 0 warning(s), 0 unverified` | pass |
| Persona (simulated) | `node operations/plugin/scripts/persona-test.mjs product-growth/media/demo-sites/cafe --visitors 30 --seed 7` | `persona-test: 30 simulated visitors, 100% tasks completed, 0 failure group(s)` | pass |

JavaScript-disabled simulated visitor: 100% (24/24).

## Funnel

- Goal: one demo form submitted (button "Send booking (demo)"). Files: `FUNNEL.md`, `.lilac/funnel.json`.
- Main path: Home: Book a table -> Send booking (demo). 1 click to the form, 2 to confirmation.
- Confirmation: `thanks.html`, status line "nothing was sent ... nobody will reply".
- NOT claimed: no conversion rate, no sales or demand. Simulated visitors are scripted browser sessions, not customers. A demo site has no real visitors.
