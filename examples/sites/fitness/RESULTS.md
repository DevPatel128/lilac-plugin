# Gate results: Still Water (FICTIONAL SAMPLE studio)

Run on 2026-11-22, macOS, headless Chrome started by each tool, no network. Raw lines copied from the commands. Foundation approval: pending owner (status NONE; nothing was approved by an agent).

| Gate | Command | Result line (exact) | Pass/fail |
|---|---|---|---|
| Foundation check | `node operations/plugin/scripts/foundation.mjs check product-growth/media/demo-sites/fitness` | `foundation: 0 error(s), 0 warning(s)` | pass |
| Foundation drift | `node operations/plugin/scripts/foundation.mjs drift product-growth/media/demo-sites/fitness` | `foundation drift: 0 error(s), 0 warning(s)` | pass |
| Foundation approval | `node operations/plugin/scripts/foundation.mjs status product-growth/media/demo-sites/fitness` | `NONE: no approval yet. Run /lilac:foundation.` | pending owner |
| Hosting | `node operations/plugin/scripts/hosting.mjs check --project product-growth/media/demo-sites/fitness` | `hosting: 0 problem(s)` | pass |
| Static QA | `node operations/plugin/scripts/qa.mjs product-growth/media/demo-sites/fitness` | `qa: 0 error(s), 0 warning(s), 1 unverified` | pass |
| Browser QA | `node operations/plugin/scripts/qa-browser.mjs product-growth/media/demo-sites/fitness` | `qa-browser: 0 error(s), 0 warning(s), 3 unverified` | pass |
| Techdocs | `node kit/operations/scripts/techdocs.mjs product-growth/media/demo-sites/fitness --check` | `techdocs: 2 parts, 3 languages, 0 problem(s)` | pass |
| Controls | `node operations/plugin/scripts/controls-test.mjs product-growth/media/demo-sites/fitness` | `controls-test: 121 controls, 0 dead, 0 broken, 0 placeholder, 40 unreachable (67% operable)` | FAIL as printed; cause is a tool issue (TOOL-ISSUES.md); same 121 controls on a copy without smooth scroll: `controls-test: 121 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)` |
| Simulated visitors | `node operations/plugin/scripts/persona-test.mjs product-growth/media/demo-sites/fitness --visitors 30 --seed 7` | `persona-test: 30 simulated visitors, 88% tasks completed, 6 failure group(s)` (also `FAIL: overall 88% is below 90%; low-vision 60% is below 70%`) | FAIL as printed; 5 of 6 groups are the tool issue; copy without smooth scroll: `persona-test: 30 simulated visitors, 97% tasks completed, 1 failure group(s)` (the one left is the accepted no-JavaScript form limit) |
| UX review | `node operations/plugin/scripts/ux-graph-check.mjs` | `ux-graph: 90 records (accessibility 20, content 9, conversion 8, forms 17, mobile 9, motion 4, navigation 10, performance 6, support 6, trust 1), 0 problem(s)` | pass; findings and experiment plan in UX-REVIEW.md |

The controls and persona failures on the real folder were re-run a second time after the site changes below and gave the same lines. Simulated visitors are not real users.

## Fixed
- Foundation: BRAND.md and FOUNDATION.md completed from the code, tokens regenerated; drift: three loop/reveal durations moved to `--loop-breathe`, `--loop-ring` and the reveal changed from .7 s to .6 s (inside the 600 ms limit).
- `first-visit.html`: duplicate `style` attribute on the "On the day" heading merged (the second one was ignored by browsers).
- Browser QA first run was `qa-browser: 21 error(s), 21 warning(s), 3 unverified` (tap targets: footer links 18 px, nav 41 px, logo 40 px, chips 43 px, a standalone link 21 px). Padding raised on nav, footer links, logo, chips and standalone paragraph links; now 0 and 0.
- Home h1 on every page no longer hidden until the scroll reveal fires (persona "no visible h1 with text on /" for the low-vision persona; `understand the offer` went from 86% to 100%).
- UX: sample prices on the home page (UX-0080); "Show all classes" button on the timetable (UX-0039, UX-0084).
- Screenshots read: index-360, classes-768, contact-1280. No cut-off text, overlap or low contrast seen. UNVERIFIED: the other 18 screenshots were not opened.

## Tool issues found
See TOOL-ISSUES.md: controls-test and persona-test scroll with smooth behaviour still running and then report "covered by nothing" or "covered by offscreen". Re-run after the coordinator said the controls fix landed (12 tests): same result.

## Accepted risks (with reason)
- No-JavaScript visitors cannot submit the demo form (persona: `no visible feedback within 3 s after submitting`). The form sends nothing by design; the page and `<noscript>` say so.
- `qa.mjs` UNVERIFIED line: `404.html: .btn.ghost: color var(--blue) on transparent: could not verify` (tool cannot compute transparent). The same colour is verified on the solid page background elsewhere.
- Touch targets: all measured at least 44 px high by qa-browser; 360 px nav still wraps to three rows (UX-REVIEW.md finding 4), not changed.
- Content-Security-Policy header: UNKNOWN, not written.
- Base URL `https://example.com/still-water/` is ASSUMED.

## Needs people
- Foundation approval: pending owner (only the human runs `approve`).
- Deploy: not run; needs the human's explicit yes. `deploy-plan` not run.
- Real users to confirm the placement experiment hypotheses; screen-reader and real-device testing.
- Trademark search for the name if it were ever real.
- `product-growth/SHOWCASE.md` generated inside this folder still has `[YOUR ...]` placeholders (techdocs warning): owner fills or deletes before posting.
- Controls and persona re-runs after the tool is fixed (scroll `behavior: 'instant'`).


## No-JavaScript form fallback and funnel (run 2026-11-23, macOS headless Chrome)

Change: the demo form is a real HTML form (`method="get" action="thanks.html"`). Only non-sensitive choices have a `name`, so name, email and message text are never put in the address. With JavaScript on, the script still validates and shows the in-page confirmation; with it off, the browser opens `thanks.html` (noindex, not in the menu or sitemap). Added `privacy.html` (in the sitemap) and a privacy link next to the form. Nothing committed, pushed or deployed.

| Gate | Command | Exact line | Pass/fail |
|---|---|---|---|
| Static QA | `node operations/plugin/scripts/qa.mjs product-growth/media/demo-sites/fitness` | `qa: 0 error(s), 0 warning(s), 1 unverified` | pass |
| Browser QA | `node operations/plugin/scripts/qa-browser.mjs product-growth/media/demo-sites/fitness` | `qa-browser: 0 error(s), 0 warning(s), 3 unverified` | pass (0 errors) |
| Controls | `node operations/plugin/scripts/controls-test.mjs product-growth/media/demo-sites/fitness` | `controls-test: 152 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)` | pass |
| techdocs | `node kit/operations/scripts/techdocs.mjs product-growth/media/demo-sites/fitness --check` | `techdocs: 2 parts, 3 languages, 0 problem(s)` | pass |
| Funnel | `node operations/plugin/scripts/funnel.mjs check product-growth/media/demo-sites/fitness` | `funnel: 0 error(s), 0 warning(s), 0 unverified` | pass |
| Persona (simulated) | `node operations/plugin/scripts/persona-test.mjs product-growth/media/demo-sites/fitness --visitors 30 --seed 7` | `persona-test: 30 simulated visitors, 100% tasks completed, 0 failure group(s)` | pass |

JavaScript-disabled simulated visitor: 100% (24/24).

## Funnel

- Goal: one demo form submitted (button "Request sample trial class"). Files: `FUNNEL.md`, `.lilac/funnel.json`.
- Main path: Home: Book a sample trial class -> Request sample trial class. 1 click to the form, 2 to confirmation. The optional message box was removed to keep the form at five fields.
- Confirmation: `thanks.html`, status line "nothing was sent ... nobody will reply".
- NOT claimed: no conversion rate, no sales or demand. Simulated visitors are scripted browser sessions, not customers. A demo site has no real visitors.
