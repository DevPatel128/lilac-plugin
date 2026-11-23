# Gate results: Biscuit & Bowl (fictional sample, website)

Run 2026-11-22 on macOS, headless Chrome, no network. Foundation approval: **approval pending owner** (status NONE; `approve` was not run, only the owner approves). Nothing committed, pushed or deployed.

| Gate | Command | Result line (exact) | Pass/fail |
|---|---|---|---|
| Foundation check | `node operations/plugin/scripts/foundation.mjs check <folder>` | `foundation: 0 error(s), 0 warning(s)` | pass |
| Foundation drift | `foundation.mjs drift <folder>` | `foundation drift: 0 error(s), 1 warning(s)` (warning: `assets/styles.css:157 2.4s`, `assets/styles.css:160 5.4s`) | pass, warning accepted |
| Foundation status | `foundation.mjs status <folder>` | `NONE: no approval yet. Run /lilac:foundation.` | approval pending owner |
| Hosting | `node operations/plugin/scripts/hosting.mjs check --project <folder>` | `hosting: 0 problem(s)` | pass |
| Static QA | `node operations/plugin/scripts/qa.mjs <folder>` | `qa: 0 error(s), 0 warning(s), 0 unverified` | pass |
| Browser QA | `node operations/plugin/scripts/qa-browser.mjs <folder>` | `qa-browser: 0 error(s), 1 warning(s), 3 unverified` | pass, warning accepted |
| techdocs | `node kit/operations/scripts/techdocs.mjs <folder> --check` | `techdocs: 2 parts, 3 languages, 0 problem(s)` | pass |
| Controls | `node operations/plugin/scripts/controls-test.mjs <folder>` | `controls-test: 108 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)` | pass |
| Simulated visitors | `node operations/plugin/scripts/persona-test.mjs <folder> --visitors 30 --seed 7` | `persona-test: 30 simulated visitors, 97% tasks completed, 1 failure group(s)` | pass on TRL gate (overall 97% at least 90%; lowest persona 80% at least 70%); failure group accepted, see below |
| UX review | read `UX-REVIEW.md` | graph check `ux-graph: 90 records (accessibility 20, content 9, conversion 8, forms 17, mobile 9, motion 4, navigation 10, performance 6, support 6, trust 1), 0 problem(s)` | done; experiments are hypotheses, not run |

Persona result by persona (same run): JavaScript-disabled visitor `4 sess   80% (16/20)`; every other persona 100%. By task: `complete the main form                            82% (18/22)`.

## Fixed
- Foundation: FOUNDATION.md and BRAND.md completed from the code and brief; tokens regenerated; check at 0 errors.
- Drift: all typed durations in `site/assets/styles.css` now use `var(--duration-*)` tokens (the file defines them in `:root`, mirroring BRAND.md). Entrance animations were shortened from 700 and 800 ms to 600 ms to respect the 600 ms token limit; JS timers (`plan.js`, `motion.js`) adjusted to 200 ms to match the fade.
- Browser QA: brand link was 195x32 px at all widths (`tap-target-small`), now min-height 44 px.
- UX-0019: contact form now shows an error summary linked to each field and moves focus to it.
- UX-0076: products page shows "Your plan: N items, BB$ X." near the filters with a "Go to your plan" link (the plan sits below the list on phones).
- Real site problem found by persona-test: with JavaScript off the contact form fields were hidden (`why: the form fields are not visible (they may need JavaScript)`). The fields now show without JavaScript; the Send button stays disabled until the script runs, with a no-JS note.

## Tool issues found
See `TOOL-ISSUES.md` (focus-order warning on a sticky sidebar; controls count varies between runs).

## Accepted risks (with reason)
- Drift warning for the two looping decorative animations (2.4 s kibble bounce, 5.4 s paw prints): loops cannot be 600 ms or less; each page has a visible pause button and reduced motion switches them off.
- `qa-browser` focus-order warning: see TOOL-ISSUES.md.
- No-JavaScript persona failure (`no visible confirmation after submitting the form`, 4 sessions): the site has no backend and by brief nothing is sent. Without JavaScript a submit would either do nothing or put the visitor's typed data into the URL, which Lilac's privacy rule forbids, so the button is disabled instead and the note explains it. Accepted as a limit of a static, no-backend demo.
- Security headers or CSP are not set (static assets Worker, no headers file). UNVERIFIED whether the host adds any.
- Canonical and sitemap URLs use the placeholder `example.com` (ASSUMED in BUILD-LOG); no og:image.

## Needs people
- Owner: review `brand/brand-sheet.html` and FOUNDATION.md, then approve in their own words (`foundation.mjs approve`). Approval pending owner.
- Real users and screen-reader testing (UX experiments are hypotheses; simulated visitors are not real people).
- Real domain for canonical and sitemap; trademark search if the name is ever used for real.
- Other browsers, Windows, Linux, real phones: not run.


## No-JavaScript form fallback and funnel (run 2026-11-23, macOS headless Chrome)

Change: the demo form is a real HTML form (`method="get" action="thanks.html"`). Only non-sensitive choices have a `name`, so name, email and message text are never put in the address. With JavaScript on, the script still validates and shows the in-page confirmation; with it off, the browser opens `thanks.html` (noindex, not in the menu or sitemap). Added `privacy.html` (in the sitemap) and a privacy link next to the form. Nothing committed, pushed or deployed.

| Gate | Command | Exact line | Pass/fail |
|---|---|---|---|
| Static QA | `node operations/plugin/scripts/qa.mjs product-growth/media/demo-sites/dog-food` | `qa: 0 error(s), 0 warning(s), 0 unverified` | pass |
| Browser QA | `node operations/plugin/scripts/qa-browser.mjs product-growth/media/demo-sites/dog-food` | `qa-browser: 0 error(s), 1 warning(s), 3 unverified` | pass (0 errors) |
| Controls | `node operations/plugin/scripts/controls-test.mjs product-growth/media/demo-sites/dog-food` | `controls-test: 118 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)` | pass |
| techdocs | `node kit/operations/scripts/techdocs.mjs product-growth/media/demo-sites/dog-food --check` | `techdocs: 2 parts, 3 languages, 0 problem(s)` | pass |
| Funnel | `node operations/plugin/scripts/funnel.mjs check product-growth/media/demo-sites/dog-food` | `funnel: 0 error(s), 0 warning(s), 0 unverified` | pass |
| Persona (simulated) | `node operations/plugin/scripts/persona-test.mjs product-growth/media/demo-sites/dog-food --visitors 30 --seed 7` | `persona-test: 30 simulated visitors, 94% tasks completed, 3 failure group(s)` | below 100%, see TOOL-ISSUES.md |

JavaScript-disabled simulated visitor: 100% (JavaScript-disabled visitor, 24/24).

## Funnel

- Goal: one demo form submitted (button "Send (demo)"). Files: `FUNNEL.md`, `.lilac/funnel.json`.
- Main path: Home -> Contact (nav) -> Send (demo); lands on thanks.html. 1 click to the form, 2 to confirmation. Two failure groups are suspected tool issues (TOOL-ISSUES.md).
- Confirmation: `thanks.html`, status line "nothing was sent ... nobody will reply".
- NOT claimed: no conversion rate, no sales or demand. Simulated visitors are scripted browser sessions, not customers. A demo site has no real visitors.
