# UX review: Tasklane demo site (FICTIONAL)

Method: `skills/ux-review/SKILL.md`. Graph validated first: `ux-graph: 90 records (accessibility 20, content 9, conversion 8, forms 17, mobile 9, motion 4, navigation 10, performance 6, support 6, trust 1), 0 problem(s)`. Product type: website. Evidence: page code, the screenshots in `.lilac/qa/` (index-360, pricing-768, demo-1280 read), `qa-browser` and `persona-test` output. Not judged by automation: copy quality, brand fit, felt trust, screen-reader and real-device behaviour (UNVERIFIED).

## Ranked findings

Ranking: reach, block on the main action (Request a demo), record confidence, cost to fix.

| Rank | Record | Status | What was seen | Change | Check |
|---|---|---|---|---|---|
| 1 | UX-0044 touch comfort 44 to 48 (high) | not met, FIXED | `qa-browser`: `tap-target-small` for footer links (18 px tall), nav links 43 px, Pause 36 px, billing switch 38 px | min-height 44 px on nav, brand, footer links, Pause and switch | `qa-browser`: 21 warnings down to 3 |
| 2 | UX-0043 target size 24 (high) | not met, FIXED | `qa-browser` ERROR `tap-target`: footer links 41x18 and similar, 21 errors | footer links `min-height:44px` | `qa-browser: 0 error(s)` |
| 3 | UX-0044 (remaining) | not met, open | `input#ok` checkbox is 24x24 (label row is 48 px and clickable) | enlarge box to 44 px or accept | `qa-browser` warning `input#ok "on" 24x24` |
| 4 | UX-0019 error summary | not met, open | validation shows per-field messages and focuses the first bad field; no summary list | add a linked summary above the form | `persona-test` completion |
| 5 | UX-0028 one primary action (high) | met | one filled orange button per section; secondary is the outlined button (hero) | none | manual |
| 6 | UX-0018, UX-0014, UX-0025 | met | messages like "Enter an email address like name@example.com."; visible labels, no placeholders; `autocomplete` on name and email | none | manual |
| 7 | UX-0062, UX-0065 | met | board loop has Pause/Play; `prefers-reduced-motion` removes motion | none | `qa: 0 error(s)`; `qa-browser` reduced-motion |
| 8 | UX-0008, UX-0048 | met | skip link first in each page; `:focus-visible` outline 3 px | none | `controls-test` skip link row OK |
| 9 | UX-0016 one column | met | form max-width 36rem, one column | none | read demo-1280 screenshot |
| 10 | UX-0006 sticky header | UNVERIFIED | header sticky from 760 px; not tested for covering focus (UX-0049) | test focus not obscured | `qa-browser:focus-order` |

UX-0015 (fewer fields): 4 fields and one consent checkbox; UNVERIFIED whether the consent box is needed beyond the demo notice.

Not from the graph (UNVERIFIED): the nav ul holds a `span` (`.nav-ind`) as a direct child, which is not valid list markup; the Request a demo button is hidden without JavaScript, so those visitors cannot finish the form (persona-test no-js failure, accepted, see RESULTS.md).

## Implemented (top 2 low-risk)

1. UX-0044 and UX-0043: footer, brand and nav links, Pause button and billing switch brought to 44 px minimum height (`site/assets/styles.css`).
2. UX-0043 and UX-0044 for text links: footer link padding so short links such as "FAQ" are at least 44 px wide.

Result: `qa-browser: 0 error(s), 3 warning(s), 3 unverified` (was 21 error(s), 21 warning(s)).

## PLACEMENT EXPERIMENT plan (hypotheses; simulated visitors are not real users)

Winner rule for every decision: pick by the measure written here before running, never after seeing results. Variants are separate page copies or a CSS class on `<body>`; no new libraries. A winning variant stays a hypothesis until real people confirm it (docs/PILOT.md).

### Decision 1: primary call-to-action placement
- A (current): hero button "Request a demo" plus a section band near the bottom of home. Supports UX-0028 (one primary action).
- B: also a compact "Request a demo" button in the header on every page. Supports UX-0083 (Fitts) and UX-0028; conflicts with UX-0006 (compact sticky header) if it crowds the nav on narrow screens.
- C: hero button only, band removed. Supports UX-0081 (fewer choices); risks missing visitors who scroll.
- Measure: `node operations/plugin/scripts/persona-test.mjs <variant folder> --visitors 100 --seed 7`, task "find a way to contact/buy/book": completion and median steps; `qa-browser` tap size on all widths. Pass line: completion at least equal to A with fewer or equal median steps and `qa-browser: 0 error(s)`.

### Decision 2: navigation pattern
- A (current): all six links always visible, wrapping on narrow screens. Supports UX-0001 and UX-0002 (visible labels).
- B: shorten labels ("How teams might use it" to "Examples") to fit one row. Supports UX-0034 (few words); loses nothing recorded.
- C: a labelled "Menu" button below 600 px. Conflicts with UX-0001 (hidden navigation costs discoverability); supports UX-0012 only partly.
- Measure: persona-test task "reach every top-nav page" completion and median ms; keyboard persona steps; `qa-browser` focus-order. Pass line: completion 100% and no more steps than A.

### Decision 3: form layout and help entry
- A (current): one column, four fields, consent checkbox, per-field errors. Supports UX-0016, UX-0013, UX-0018.
- B: A plus an error summary at the top with links to fields. Supports UX-0019; conflicts with UX-0017 minimal-noise only if it appears before the person finishes.
- C: drop the optional note and merge the consent into the notice above the form. Supports UX-0015; loses the explicit acknowledgement.
- Help entry point: link to the FAQ next to the form (UX-0088) tested as an add-on to B.
- Measure: persona-test task "complete the main form": completion, median steps and ms; keyboard and low-vision personas separately. Pass line: at least 90% overall and 70% per persona (the TRL gate) with steps not above A.
