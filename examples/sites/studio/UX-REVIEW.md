# UX review: Atelier Nord (fictional sample website)

Method: `operations/plugin/skills/ux-review/SKILL.md`. Graph check: `ux-graph: 90 records (accessibility 20, content 9, conversion 8, forms 17, mobile 9, motion 4, navigation 10, performance 6, support 6, trust 1), 0 problem(s)`. Evidence: code, `qa-browser` output and the screenshots in `.lilac/qa/` (3 pages read at 360, 768 and 1280 px). Product type: website. AI review; not real users.

## Ranked findings (record id, what was seen, change, proof)

1. UX-0043 / UX-0044 (target size 24 floor, 44 to 48 on touch), met after fix. Seen: first qa-browser run `qa-browser: 21 error(s), 25 warning(s), 3 unverified`: nav, footer and in-page links 19 to 22 px high, brand link 22 px. Changed: 44 px minimum height for nav, footer, brand, `.more`, `.acts` and headline links and the filter chips. Proof: `qa-browser: 0 error(s), 3 warning(s), 3 unverified` (the 3 left are a tool issue, see TOOL-ISSUES.md).
2. UX-0045 (space between targets): same fix; the call-to-action pair on the home and project pages now sits in a flex row with a 24 px gap (`.acts`). Proof: same qa-browser run, no `tap-target-small` left.
3. UX-0035 (headings say what the section holds) and UX-0028 (one primary action), UX-0071 (largest content paint), met after change. Seen: the home `h1` carried the `.rise` reveal, so it was invisible until scrolled into view at 320x640 at 200% zoom; persona-test first run `persona-test: 30 simulated visitors, 93% tasks completed, 2 failure group(s)`. Changed: reveal class removed from all page `h1`s. Proof: low-vision persona 100% (16/16) on the final run. LCP is UNVERIFIED (no tool measures it here).
4. UX-0065 (reduced motion), UX-0067 (animate transform and opacity), UX-0062 (pause moving content), met by code: `@media (prefers-reduced-motion:reduce)` turns all transitions off; only transform, opacity, clip-path, stroke-dashoffset animate; nothing loops. UX-0066 (motion earns its place, low confidence) is a judgement: the draw-on shows the drawings being made, but the 0.8 to 1.6 s durations are long (see drift warning). Keep or shorten is the owner's call.
5. Form, UX-0013 labels above (met: visible `label` per field), UX-0014 (met: no placeholders), UX-0018 error text (met in code: text message beside each field, bold, plus `aria-invalid`), UX-0020 colour not alone (met for errors; the current-page nav marker is a thicker underline in the accent colour, partly colour: UNVERIFIED for colour-blind users), UX-0061 (met: `role="status"` on the result).
6. UX-0041 (confirm what happens next, low confidence): the result says "Demo: nothing was sent". Correct for a fictional studio; a real site would need reply-time text from the owner (UNKNOWN).
7. No-JavaScript form (not from the graph, UNVERIFIED as a priority): the form needs JavaScript; without it there is no confirmation (persona `no-js` 75%). Accepted for this demo; see RESULTS.md.

Implemented (top 2 low-risk): (1) 44 px targets for all links and chips (UX-0043, UX-0044); (2) spaced call-to-action rows plus visible `h1` without reveal (UX-0045, UX-0035).

## PLACEMENT EXPERIMENT plan (hypotheses; simulated visitors are not real users)

Rule for all three: pick the winner by the stated measure before running; copy each variant as a separate page copy or a CSS class switch, no new libraries. Commands: `node operations/plugin/scripts/persona-test.mjs <folder> --visitors 30 --seed 7` (completion, steps, time) and `node operations/plugin/scripts/qa-browser.mjs <folder>` (tap size, focus order). Pass line before running: variant completion of the task at least equal to A and median steps not higher, with `qa-browser` 0 errors.

### 1. Primary call-to-action placement (task: find a way to contact)
- A (current): "Enquire" in the header nav plus buttons in page bodies (UX-0028, UX-0029).
- B: "Enquire" styled as the one filled button in the header, nav text links unchanged (UX-0028 supports; conflicts with UX-0002 only if the label drops; keep the visible label).
- C: A plus a fixed-position enquiry bar on mobile (UX-0006 sticky header supports reach; may conflict with UX-0049 focus not obscured, which would lose if the bar covers focus).
Measure: steps and ms for task "find a way to contact/buy/book" (A baseline `steps 1  2568 ms`).

### 2. Navigation pattern (task: reach every top-nav page)
- A (current): always-visible 4-item wrapping list (UX-0001 hidden nav cost, UX-0002).
- B: same list, with the current page marked by weight plus underline (UX-0020 supports).
- C: collapse to a menu button under 600 px (UX-0001 conflicts: hidden navigation costs discoverability; it would lose unless the item count grows).
Measure: nav task completion and ms (A baseline `steps 1  11625 ms`), keyboard persona steps, qa-browser tap targets.

### 3. Form layout (task: complete the main form)
- A (current): single column, labels above, 4 fields (UX-0013, UX-0016).
- B: remove "Project type" (UX-0015 cut fields).
- C: show the submit result above the button as well as below (UX-0061, UX-0041).
Measure: main-form completion and steps (A baseline `82% (18/22)  steps 8`; the 18% loss is the no-JS persona, so compare JavaScript personas).

Limit: a winning variant is a hypothesis until real people confirm it (docs/PILOT.md).
