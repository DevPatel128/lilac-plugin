# Results: Atelier Nord (fictional sample website)

Run 2026-11-22 on macOS, headless Chrome. Simulated visitors are not real people. Foundation: approval pending owner (status NONE; nothing approved, nothing deployed).

| Gate | Command | Result line (exact) | Pass |
|---|---|---|---|
| Foundation check | `node operations/plugin/scripts/foundation.mjs check <folder>` | `foundation: 0 error(s), 0 warning(s)` | pass |
| Foundation drift | `node operations/plugin/scripts/foundation.mjs drift <folder>` | `foundation drift: 0 error(s), 1 warning(s)` (9 durations over 600 ms) | pass with accepted warning |
| Foundation status | `foundation.mjs status <folder>` | `NONE: no approval yet. Run /lilac:foundation.` | pending owner |
| Hosting | `node operations/plugin/scripts/hosting.mjs check --project <folder>` | `hosting: 0 problem(s)` | pass |
| Static QA | `node operations/plugin/scripts/qa.mjs <folder>` | `qa: 0 error(s), 0 warning(s), 1 unverified` | pass |
| Browser QA | `node operations/plugin/scripts/qa-browser.mjs <folder>` | `qa-browser: 0 error(s), 3 warning(s), 3 unverified` | pass (3 warnings = tool issue) |
| techdocs | `node kit/operations/scripts/techdocs.mjs <folder> --check` | `techdocs: 2 parts, 3 languages, 0 problem(s)` | pass |
| UX graph | `node operations/plugin/scripts/ux-graph-check.mjs` | `ux-graph: 90 records (accessibility 20, content 9, conversion 8, forms 17, mobile 9, motion 4, navigation 10, performance 6, support 6, trust 1), 0 problem(s)` | pass |
| Controls | `node operations/plugin/scripts/controls-test.mjs <folder>` | `controls-test: 94 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)` | pass |
| Simulated visitors | `node operations/plugin/scripts/persona-test.mjs <folder> --visitors 30 --seed 7` | `persona-test: 30 simulated visitors, 96% tasks completed, 1 failure group(s)` | pass (>=90% overall; lowest persona 75%) |

First persona-test run, before the fix: `persona-test: 30 simulated visitors, 93% tasks completed, 2 failure group(s)`. First qa-browser run: `qa-browser: 21 error(s), 25 warning(s), 3 unverified`.

## Fixed
- Foundation drafts completed from the real CSS and brief; tokens generated (`brand/`).
- Five duration literals in `styles.css` switched to `var(--duration-fast|base|slow)`.
- Tap targets under 24 px (21 errors) and under 44 px: nav, footer, brand, in-page links, headline links and filter chips now 44 px high; call-to-action rows spaced (`.acts`).
- Page `h1` hidden by the `.rise` reveal until scrolled into view (low-vision persona failed): reveal class removed from every `h1`.

## Tool issues found
See TOOL-ISSUES.md: wrapped inline link reported as overlapping text on 404.html (3 warnings); screenshots taken at load show wipe and unrevealed content.

## Accepted risks (with reason)
- Drift warning, 9 durations: 0.05 s to 1.6 s one-time draw-on, reveal and wipe motion exceed the 600 ms token ceiling; they run once, never loop, and are off under reduced motion (brief: expressive but accessible).
- No-JavaScript persona 75% (12/16): the demo form needs JavaScript and shows an explanatory note; a no-JS fallback would need a server or a data-in-URL submit, rejected for a fictional demo.
- Site duplicates duration and easing values by hand from `brand/tokens.css` (no sync tool).
- `qa.mjs` 1 unverified (`.chip` colour on `none` background) and no HTTP security headers configured.

## Needs people
- Owner approval of FOUNDATION.md, BRAND.md and the brand sheet (approval pending owner).
- Real-device, screen-reader, Safari and Firefox checks; trademark search if the name were real; a real deploy decision and Cloudflare account; real-user confirmation of every UX hypothesis.


## No-JavaScript form fallback and funnel (run 2026-11-23, macOS headless Chrome)

Change: the demo form is a real HTML form (`method="get" action="thanks.html"`). Only non-sensitive choices have a `name`, so name, email and message text are never put in the address. With JavaScript on, the script still validates and shows the in-page confirmation; with it off, the browser opens `thanks.html` (noindex, not in the menu or sitemap). Added `privacy.html` (in the sitemap) and a privacy link next to the form. Nothing committed, pushed or deployed.

| Gate | Command | Exact line | Pass/fail |
|---|---|---|---|
| Static QA | `node operations/plugin/scripts/qa.mjs product-growth/media/demo-sites/studio` | `qa: 0 error(s), 0 warning(s), 1 unverified` | pass |
| Browser QA | `node operations/plugin/scripts/qa-browser.mjs product-growth/media/demo-sites/studio` | `qa-browser: 0 error(s), 0 warning(s), 3 unverified` | pass (0 errors) |
| Controls | `node operations/plugin/scripts/controls-test.mjs product-growth/media/demo-sites/studio` | `controls-test: 121 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)` | pass |
| techdocs | `node kit/operations/scripts/techdocs.mjs product-growth/media/demo-sites/studio --check` | `techdocs: 2 parts, 3 languages, 0 problem(s)` | pass |
| Funnel | `node operations/plugin/scripts/funnel.mjs check product-growth/media/demo-sites/studio` | `funnel: 0 error(s), 0 warning(s), 0 unverified` | pass |
| Persona (simulated) | `node operations/plugin/scripts/persona-test.mjs product-growth/media/demo-sites/studio --visitors 30 --seed 7` | `persona-test: 30 simulated visitors, 100% tasks completed, 0 failure group(s)` | pass |

JavaScript-disabled simulated visitor: 100% (20/20).

## Funnel

- Goal: one demo form submitted (button "Send enquiry (demo)"). Files: `FUNNEL.md`, `.lilac/funnel.json`.
- Main path: Home: Enquire about a project -> Send enquiry (demo). 1 click to the form, 2 to confirmation.
- Confirmation: `thanks.html`, status line "nothing was sent ... nobody will reply".
- NOT claimed: no conversion rate, no sales or demand. Simulated visitors are scripted browser sessions, not customers. A demo site has no real visitors.
