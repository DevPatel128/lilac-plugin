# UX review: Corner Kiln (fictional demo cafe)

Method: `operations/plugin/skills/ux-review/SKILL.md` against `operations/plugin/knowledge/ux/` (product type: website). Evidence is code in `site/`, the screenshots in `.lilac/qa/` (index, menu, contact read at 360, 768 and 1280 px) and the QA command output in [RESULTS.md](RESULTS.md). Simulated visitors are not real users; everything below that predicts an effect is a hypothesis.

## Ranked findings

| # | Record | Status | What was seen | Change | Proof check |
|---|---|---|---|---|---|
| 1 | UX-0085 Prevent errors before messaging them | Not met (fixed) | `contact.html` date input had no `min`, so a past day could be entered and only a missing day was rejected | `site.js` sets `min` to the device's local today and rejects an earlier day with "Please pick today or a later day." | `persona-test` booking task; manual: pick yesterday |
| 2 | UX-0025 Declare what each personal field is for, UX-0024 password managers and paste | Not met (fixed) | Name and email inputs had `autocomplete="off"` | Now `autocomplete="name"` and `autocomplete="email"` | `qa.mjs` form checks; manual autofill in a real browser (UNVERIFIED) |
| 3 | UX-0043, UX-0044 target size | Not met (fixed) | `qa-browser.mjs` warned the "Corner Kiln" home link was 165x32 px on every page | `.brand{min-height:44px}` | `qa-browser.mjs`: 0 warnings after the change |
| 4 | UX-0019 error summary, UX-0017 validate after the field | Not met | Errors appear only inline and only on submit; there is no summary. Valid answers are kept (the form resets only on success) | Add an error summary linked to each field, move focus to it; validate on blur. Medium risk (focus handling), not done | `persona-test` booking task, keyboard persona |
| 5 | UX-0087, UX-0088 help and support entry point | Not met | No help or "how do I reach the team" entry on the booking page; contact details are only in the footer and are placeholders | Show the sample email beside the form (needs owner's wording) | `persona-test` help-seeking task |
| 6 | UX-0071 main content within 2.5 s | UNVERIFIED | Pages are about 4 to 8 KB with no external requests; no timing was measured here | Run `persona-test` mobile-3g persona | `persona-test` result line |
| 7 | UX-0051 Focus never gets stuck | Met, with a tool caveat | `qa-browser.mjs` reports a trap on `input#date`; Chrome date inputs hold several internal stops, see [TOOL-ISSUES.md](TOOL-ISSUES.md) | none | manual Tab walk (UNVERIFIED by hand) |

Met, with the evidence: UX-0001 and UX-0002 (visible labelled nav, `index-360.png`); UX-0008 (skip link, `qa.mjs` and `site/assets/styles.css` `.skip`); UX-0028 and UX-0029 (one primary "Book a table" in nav and hero; submit says "Send booking (demo)"); UX-0013 and UX-0014 (visible label above every field, `contact.html`); UX-0041 (confirmation says nothing was sent and no one will reply); UX-0062 and UX-0065 (Pause motion button; reduced-motion block in `styles.css`; no `qa-browser` error); UX-0067 (only transform, opacity, stroke-dashoffset animate); UX-0046 (contrast ratios on `brand/brand-sheet.html`, `foundation check` passes).

Not from the graph: the contact page uses about half of the width at 1280 px and leaves the right side empty (`contact-1280.png`). Layout taste, UNVERIFIED.

## Implemented (top 2 low-risk)

1. Date cannot be in the past (finding 1), `site/assets/site.js`.
2. Autocomplete tokens on name and email (finding 2), `site/contact.html`.
(Finding 3 was also fixed because the browser QA gate reported it.)

## PLACEMENT EXPERIMENT plan (hypotheses)

How to build cheaply for all three: copy the page to `site/exp/<name>-b.html` or switch a CSS class on `<body>`; no new libraries; delete the copies afterwards. Measure with `node operations/plugin/scripts/persona-test.mjs product-growth/media/demo-sites/cafe --visitors 30 --seed 7` (completion, steps, time) and `node operations/plugin/scripts/qa-browser.mjs product-growth/media/demo-sites/cafe` (tap size, reach, focus order). Pass line fixed in advance: a variant wins only if its persona-test overall completion is at least the current page's and no persona is below 70%, and `qa-browser` stays at 0 errors; ties keep A. Winner is chosen by this rule, never after seeing results. A winner is a hypothesis until real people confirm it (`docs/PILOT.md` kit; zero pilots run).

### Decision 1: primary call-to-action placement ("Book a table")
- A (current): button in the hero and in the nav (UX-0028).
- B: add a second button after the menu list on `menu.html` ("Book a table"), supported by UX-0028 and UX-0084; conflicts with UX-0081 (fewer simultaneous choices): UX-0081 loses only if completion drops.
- C: sticky bottom bar on mobile with the button; supported by UX-0083; conflicts with UX-0006 and UX-0049 (a sticky bar can hide the focused item), so UX-0083 loses if `qa-browser` reports focus problems.
- Measure: steps and completion of the "book a table" persona task.

### Decision 2: navigation pattern
- A (current): visible wrapping list of six labelled links (UX-0001, UX-0002).
- B: shorter nav (Menu, Visit, Book a table) with the other pages linked from the footer; supported by UX-0081 and UX-0082; conflicts with UX-0001 (less visible), so UX-0001 loses if "find events" completion falls.
- Measure: completion and steps for find-menu, find-hours and find-events tasks; tap size from `qa-browser`.

### Decision 3: form layout and help entry point
- A (current): one column, inline errors, no help text, no summary (UX-0013, UX-0016).
- B: A plus an error summary at the top with links to each field (UX-0019); conflicts with UX-0018/UX-0061 only if the summary and the inline text diverge, so keep the same wording.
- C: A plus the sample contact line beside the form (UX-0087, UX-0088).
- Measure: completion after a first failed submit (keyboard and screen-reader-style personas), and the help-seeking task.
