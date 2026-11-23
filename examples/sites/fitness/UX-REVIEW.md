# UX review: Still Water (FICTIONAL SAMPLE studio)

Method: `operations/plugin/skills/ux-review/SKILL.md`. Graph check: `node operations/plugin/scripts/ux-graph-check.mjs` printed `ux-graph: 90 records (accessibility 20, content 9, conversion 8, forms 17, mobile 9, motion 4, navigation 10, performance 6, support 6, trust 1), 0 problem(s)`. Evidence: site code, screenshots in `.lilac/qa/` (read: index-360, classes-768, contact-1280), `qa-browser` output. Website records only. Simulated visitors are not real users; everything below about effect is a hypothesis.

## Ranked findings

Rank = reach, then how badly it blocks the main action (book a trial), then record confidence, then cost.

| # | Record | What was seen | Status | Change | Proof |
|---|---|---|---|---|---|
| 1 | UX-0080 Show prices, fees and contact early (high) | Home page showed no price; the three sample prices were only on memberships.html | not met, FIXED | Added a line on the home page with the three sample prices and a link to the plans | grep "Sample prices" in `site/index.html` |
| 2 | UX-0043 / UX-0044 target size (high) | `qa-browser` first run: ERROR tap-target, footer links 18 px tall, nav 41 px, logo 40 px, filter chips 43 px | not met, FIXED | Padding on nav, footer links, logo, chips, standalone paragraph links | `qa-browser: 0 error(s), 0 warning(s), 3 unverified` |
| 3 | UX-0039 Empty states offer a next step; UX-0084 clear way out (low; high) | `classes.js` empty message says "Choose Any for day or level" but no control to undo a filter pair | not met, FIXED | Added a "Show all classes" button, visible only while a filter is active | code in `classes.js`; behaviour checked by `controls-test` below |
| 4 | UX-0001 hidden nav cost / UX-0081 fewer choices (medium) | At 360 px the six nav links wrap to three rows (index-360.png) and push the hero down; links stay visible, which UX-0001 favours | partly met | NOT changed: consider shorter labels or two rows; trade-off is hiding nav | UNVERIFIED effect; check with persona-test steps |
| 5 | UX-0041 Confirm what happens next (low) | Form result says "Demo: nothing was sent", which is accurate for a fictional studio | met for a demo | A real studio needs a real next-step message | needs people |
| 6 | UX-0062 / UX-0065 / UX-0067 motion (high, high, medium) | 10 s breathing loop has Pause/Play; reduced motion removes animation; only transform and opacity animate (BUILD-LOG section 5, `qa` no layout-animation finding) | met | none | `qa` 0 errors |
| 7 | UX-0013, UX-0018, UX-0020, UX-0025 forms (high) | Visible labels above fields, "Fix:" prefix plus dashed border (not colour alone), `autocomplete` on name and email, `type=email` | met | none | code in `contact.html`, `contact.js` |
| 8 | UX-0050 keyboard walk (medium) | Not driven by hand | UNVERIFIED | `persona-test` keyboard persona and `controls-test` | see RESULTS.md |
| Not from the graph | Hero art and the thin line under the page-head wave in the screenshots look intentional but were not judged by users | UNVERIFIED | | |

Not judged by automation: copy quality, brand fit, felt trust, real-device and screen-reader behaviour.

## PLACEMENT EXPERIMENT plan (hypotheses, not run)

Common build method: separate copies of the page (for example `contact-b.html`) or a CSS class on `<body>`; no new libraries. Measure: `node operations/plugin/scripts/persona-test.mjs <folder> --visitors 30 --seed 7` (completion, steps, time) and `qa-browser.mjs` (tap size, focus order). Pass line stated before running: completion for the trial task does not drop below variant A and steps do not rise; `qa-browser` stays at 0 errors. Winner rule: pick by that measure fixed now, never after seeing results. Then confirm with real people (docs/PILOT.md) before claiming any improvement.

### Decision 1: primary call-to-action placement (home hero)
- A (current): primary "Book a sample trial class" button plus a ghost "See the timetable" in the hero. Supports UX-0028 (one obvious primary action).
- B: primary button also repeated after the three week cards. Supports UX-0028, conflicts mildly with UX-0081 (more repeated choices); UX-0081 loses if B wins.
- C: hero shows only the primary button, the timetable link moves to the cards. Supports UX-0081, UX-0028.
- Measure: persona-test completion and steps for the "book a trial" task.

### Decision 2: navigation pattern (phones)
- A (current): six always-visible wrapping links. Supports UX-0001 and UX-0002.
- B: five links, with "Book a trial" shown as the one button-styled link. Supports UX-0028 and UX-0081.
- C: collapse the nav behind a Menu button below 480 px. Conflicts with UX-0001 (hidden navigation costs discovery) and needs JavaScript, which breaks the no-JS nav rule in BRIEF.md, so UX-0001 and the brief win unless data says otherwise.
- Measure: steps and time to reach the timetable at 360 px; `qa-browser` tap-target.

### Decision 3: form layout and help entry (contact page)
- A (current): one column, six fields, notice above the form. Supports UX-0016 single column and UX-0013.
- B: trial form needs only name, email and class; day and level become optional. Supports UX-0015 (cut fields); conflicts with nothing in the graph but may lose the info a studio needs (UNKNOWN).
- C: add a short plain "Questions? Read the first-visit guide" link beside the form. Supports UX-0087 and UX-0088.
- Measure: persona-test completion and steps on contact.html; form errors per submit.
