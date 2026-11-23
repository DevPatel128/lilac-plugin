# UX review: Pocket Habits (fictional sample web app)

Method: `operations/plugin/skills/ux-review/SKILL.md`. Graph check: `node operations/plugin/scripts/ux-graph-check.mjs` printed `ux-graph: 90 records (accessibility 20, content 9, conversion 8, forms 17, mobile 9, motion 4, navigation 10, performance 6, support 6, trust 1), 0 problem(s)`. Records filtered to `applies_to` containing webapp. Evidence: `site/` code, screenshots `.lilac/qa/views-*-{360,768,1280}.png` (Today, Insights, Settings, seeded test user) and `.lilac/qa/index-*.png` (empty state). Simulated visitors are not real users.

## Ranked findings

| # | Record | Status | What was seen | Change | Proof |
|---|---|---|---|---|---|
| 1 | UX-0028 One obvious primary action; UX-0081 Fewer choices | NOT MET, FIXED | Empty state at 360 px showed "Take the tour" twice (banner and empty card) beside two other buttons (screenshot index-360.png) | Empty-state tour link now appears only after the banner is gone (`site/app.js` `#empty-tour`) | re-run qa-browser; controls list `tests/controls.md` line 15 |
| 2 | UX-0049 Sticky bars must not hide the focused item | PARTLY MET, FIXED | The fixed toast ("Ready to use offline", 10 s) can sit over footer text and a focused control | `scroll-padding-bottom: 5rem` and extra footer padding while a toast shows (`site/app.css`) | qa-browser still warns `text-overlap` at scroll top (toast is fixed to the viewport): accepted, see RESULTS.md |
| 3 | UX-0036 Core options first; UX-0007 Search visible | NOT MET (trade-off), NOT FIXED | Search, Show and Sort take about 200 px on a phone above the list (views-today-360.png) | none yet: UX-0007 and UX-0036 conflict; see experiment 3 | persona tasks, tap size |
| 4 | UX-0012 Design each device on its own terms; UX-0001 hidden nav costs | NOT MET, NOT FIXED | Six nav links wrap to two rows at 360 px, header about 150 px of 800 px (views-today-360.png). A tighter padding was tried and still wrapped, so it was reverted | none: needs a layout decision, experiment 2 | qa-browser, persona-test |
| 5 | UX-0088 One obvious support entry point; UX-0087 Help where the question arises | MET with a doubt | Help and Support are both top-level links; no help link inside the add-habit dialog | experiment 3 | persona task "find help" |
| 6 | UX-0070 Destructive never primary; UX-0084 Clear way out | MET | Delete is a neutral button and shows an Undo toast (`ui.js`) | none | unit and browser checks in BUILD-LOG.md |
| 7 | UX-0008 Skip link; UX-0048 Focus visible; UX-0052 Dialog focus; UX-0065 Reduce motion; UX-0057 Control names; UX-0043/44 Targets | MET | controls-test shows the skip link works; `qa-browser` 0 errors; names like "Edit Drink water" | none | `qa-browser` line in RESULTS.md |
| 8 | UX-0039 Empty states; UX-0061 Announce results | MET | Empty state explains and offers a next step; aria-live region | none | persona tasks |
| 9 | UX-0046 Contrast 4.5:1; UX-0056 alt text; UX-0059 text grows; UX-0058 reflow 320 | UNVERIFIED beyond tools | Contrast computed in BUILD-LOG.md; no 200% text zoom or screen reader run | needs people | |

Not from the graph: first-visit "Ready to use offline" toast may be noise for a first-time visitor. UNVERIFIED.

## Implemented (top 2 low-risk)
1. Single tour offer on Today (finding 1).
2. Toast never hides footer or focus (finding 2). Service-worker cache name raised to `pocket-habits-v2` and `tests/sw.test.js` updated, so returning visitors get the changed shell.

## PLACEMENT EXPERIMENT plan (hypotheses, not results)
Build each variant as a CSS class switch on `<body>` (no libraries). Measure with `node operations/plugin/scripts/persona-test.mjs <folder> --visitors 30 --seed 7` (completion, steps, time per task in `.lilac/personas.json`) and `qa-browser.mjs` (tap size, overflow, focus order). Pass line fixed now: completion not lower than variant A on every task, zero qa-browser errors, header height at 360 px not larger. Winner is chosen by this rule before looking at results. Simulated visitors only: a winner is a hypothesis until real people confirm it (docs/PILOT.md).

1. Where "add habit" lives. A (current): "New habit" button in the toolbar row of Today, empty state "Add your first habit". B: floating action button bottom-right on phones. C: inline "Add a habit" row at the end of the list. Supports: UX-0028, UX-0083 (nearer, bigger targets are faster). Conflicts: UX-0049 (a floating button can hide content; B loses if it covers a focused item) and UX-0002 (an icon-only button needs a visible label).
2. Navigation. A (current): top links, wrap to two rows on phones. B: bottom tab bar with Today, Insights, Settings and a "More" tab for Help, Support, About on phones. C: top row of three plus a visible "Help" link, the rest in Settings. Supports: UX-0012, UX-0083, UX-0002 (few labelled tabs). Conflicts: UX-0001 (hidden items in "More" cost discovery; B loses on Help discoverability) and UX-0049 (a fixed bottom bar and the toast compete).
3. Where support and help live. A (current): Help and Support as separate top links. B: one "Help and support" link, with Support reached from the bottom of Help. C: a "Need help?" link inside the add-habit dialog and the empty state. Supports: UX-0088, UX-0087. Conflicts: UX-0001 only if the link is hidden; also UX-0007 versus UX-0036 for search on Today (hide search under 5 habits is a fourth variant to test).
