# Results: Pocket Habits (fictional sample web app), gate run 2026-11-22

Foundation status: NONE. Approval pending owner (`approve` was not run). Nothing committed, pushed or deployed. Simulated visitors are not real people.

| Gate | Command | Result line (exact) | Pass/fail |
|---|---|---|---|
| Foundation check | `node operations/plugin/scripts/foundation.mjs check <folder>` | `foundation: 0 error(s), 0 warning(s)` | pass |
| Foundation drift | `... foundation.mjs drift <folder>` | `foundation drift: 0 error(s), 0 warning(s)` | pass |
| Foundation status | `... foundation.mjs status <folder>` | `NONE: no approval yet. Run /lilac:foundation.` | pending owner |
| Hosting | `node operations/plugin/scripts/hosting.mjs check --project <folder>` | `hosting: 0 problem(s)` | pass |
| Unit tests (UTC, Asia/Kolkata, America/Los_Angeles, Pacific/Auckland) | `cd <folder> && TZ=<zone> node --test tests/*.test.js` | `ℹ tests 42`, `ℹ pass 42`, `ℹ fail 0` in each of the four zones | pass |
| Static QA | `node operations/plugin/scripts/qa.mjs <folder>` | `qa: 0 error(s), 0 warning(s), 4 unverified` | pass |
| Browser QA | `node operations/plugin/scripts/qa-browser.mjs <folder>` | `qa-browser: 0 error(s), 1 warning(s), 3 unverified` | pass (0 errors; 1 warning accepted) |
| techdocs | `node kit/operations/scripts/techdocs.mjs <folder> --check` | `techdocs: 3 parts, 3 languages, 0 problem(s)` | pass |
| ux-review | `node operations/plugin/scripts/ux-graph-check.mjs` | `ux-graph: 90 records (accessibility 20, content 9, conversion 8, forms 17, mobile 9, motion 4, navigation 10, performance 6, support 6, trust 1), 0 problem(s)`; review and placement experiment in UX-REVIEW.md | pass |
| Controls | `node operations/plugin/scripts/controls-test.mjs <folder>` (run 3, fixed tool) | `controls-test: 81 controls, 0 dead, 0 broken, 0 placeholder, 5 unreachable (94% operable)` | 5 unreachable stay listed; each proved by hand below |
| State-conditional controls | `node tests/state-checks.mjs` | `state-checks: 0 failure(s)` (26 PASS lines) | pass (headless Chrome, one machine) |
| Simulated visitors | `node operations/plugin/scripts/persona-test.mjs <folder> --visitors 30 --seed 7` (run 5) | `persona-test: 30 simulated visitors, 48% tasks completed, 32 failure group(s)` and `FAIL: overall 48% is below 90%; ...` | FAIL (gate not met) |
| Offline, headless Chrome | `node tests/qa-screens.mjs` | `sw state: activated caches: pocket-habits-v2` then `offline h1: Pocket Habits habits rendered: 6` | pass (one browser, one machine) |

## State-conditional controls
The fixed controls-test still lists 5 as UNREACHABLE (`Next (after: Take the tour)`, `about: Reload to update`, `about: Clear search and filter`, `about: OK`, `about: Back`). They only exist in a state the tool does not create. Proof is `tests/state-checks.mjs` (real headless Chrome, localhost only, temp copy of `site/`); output in `.lilac/state-checks.txt`:
- Tour Next, Back, Skip at 360, 768 and 1280 px (viewport height 640): `PASS: tour @360px: card, Next and Skip inside the viewport, not covered, Next height 44 px, focus starts on tour-next` (same at 768 and 1280); Back appears on step 2 and returns to step 1; Tab cycles inside the dialog (`tour-skip, tour-next`); stepping Next to Done closes it and stores `tourDone`. Not an app defect: the tool's screenshot `.lilac/controls/Next-1.png` shows the dialog already closed, so there was nothing to click ("covered by nothing"). Tool issue 9.
- Clear search and filter: `PASS: search "zzzz-no-match": list empty and the no-match panel ... is shown (3 habits before)` and `PASS: Clear search and filter restores all habits, empties the box and hides the panel`.
- "OK" (toast dismiss button, and the confirm dialog action): confirm dialog label is "Erase everything", not "OK": `PASS: Reset opens the confirm dialog whose action button says "Erase everything"`, `Cancel closes the dialog and erases nothing`, `Erase everything deletes all habits`. The plain toast OK (offline notice) is not proven by a script: UNVERIFIED (its code path is the same `toast()` whose Undo button was proven: `PASS: Delete shows a toast with an Undo button`, `PASS: Undo restores the deleted habit`).
- "Back" is the tour Back button, proven above.
- Reload to update: a real second service-worker version was served while the page was open: `PASS: update bar hidden while no new version exists`, `PASS: a new version waiting shows the bar with "Reload to update"`, `PASS: Reload to update activates the new version, the page reloads and the bar is gone`.

## Fixed
- Foundation: FOUNDATION.md and BRAND.md completed from the code; off-token `rgba(10, 8, 20, .55)` and `rgba(0,0,0,.3)` moved to `--scrim` and `--shadow-toast` in `site/app.css`.
- UX: duplicate "Take the tour" removed from the empty state while the banner shows; toast no longer covers footer text once scrolled (`scroll-padding-bottom`, footer padding).
- Service-worker cache raised to `pocket-habits-v2` so returning visitors receive the changed files; `tests/sw.test.js` updated to match.
- Own persona tasks (`.lilac/personas.json`) rewritten: start each task on its own route, no dependence on a reset. Original kept as `.lilac/personas.before.json`.

## Tool issues found
See TOOL-ISSUES.md (8 items): hash-route SPA screens not collected, typed search text left in place, hash-only navigation treated as a page load (built-in `nav` 0/28), shared storage across concurrent sessions, website-shaped contact task, explicit-role-only screen-reader proxy.

## Accepted risks (with reason)
- qa-browser warning `text-overlap` at 360 px: the first-visit "Ready to use offline" toast is fixed over footer text for up to 10 s and has an OK button; removing the toast would remove offline status feedback (UX-0076).
- Persona gate (90% overall, 70% per persona) is NOT met. The failure groups I could inspect trace to the tool items above; I did not prove that no real app problem hides behind them, so this stays open until the tool is fixed and re-run.
- Foundation dark/light token aliases `primary`, `link`, `success` are the existing accent and green colours.

## Needs people
- Owner: read `brand/brand-sheet.html`, FOUNDATION.md and BRAND.md, then approve in their own words.
- Tool owner: fix the controls and persona tools for single-document hash-route apps and isolate session storage, then re-run both.
- Real device, Safari, Firefox, screen reader, 200% text zoom, installability with PNG icons, the "Reload to update" bar and trademark search for the name: UNVERIFIED.
- Real visitors to confirm any placement experiment winner (UX-REVIEW.md).
- `product-growth/SHOWCASE.md` still has `[YOUR ...]` placeholders (techdocs warning): owner fills before posting.
