# UX review: Biscuit & Bowl (fictional sample, website)

Method: `operations/plugin/skills/ux-review/SKILL.md`. Graph check: `node operations/plugin/scripts/ux-graph-check.mjs` printed `ux-graph: 90 records (accessibility 20, content 9, conversion 8, forms 17, mobile 9, motion 4, navigation 10, performance 6, support 6, trust 1), 0 problem(s)`. Evidence: site code, and screenshots `.lilac/qa/index-360.png`, `products-768.png`, `contact-1280.png` (read). Record text was treated as reference data. Not judged by automation: copy quality, brand fit, trust as felt, screen reader and real-device behaviour.

## Ranked findings

Rank = reach, block on the main action, record confidence, cost to fix.

| # | Record | Status | What was seen | Change | Proof |
|---|---|---|---|---|---|
| 1 | UX-0019 Summarise errors and keep what was typed (high) | NOT MET (fixed) | `assets/contact.js`: failed submit only showed per-field messages and focused the first field; no summary | Added an error summary at the top, linked to each field, focus moved to it; answers are kept | `controls-test`, `persona-test` form task; browser QA |
| 2 | UX-0076 Always show system status (high) | PARTLY MET (fixed) | `products.html` at 360 px: the plan summary sits below all six products, so "Add to plan" changed nothing in view except the button | Added a status line near the filters ("Your plan: 2 items, BB$ 49.00.") with a "Go to your plan" link | `persona-test` plan task; `qa-browser` tap target |
| 3 | UX-0043 Target size (high) | NOT MET (fixed earlier in this run) | `qa-browser` warned: brand link 195x32 px at all widths | `.brand` min-height 44 px | `qa-browser` 0 warnings |
| 4 | UX-0062 Moving content can be paused (high) | MET | Pause button on home and how-it-works (`data-pause`); loops under reduced motion are off | none | `qa.mjs` infinite-animation check, 0 warnings |
| 5 | UX-0028 One obvious primary action (high) | MET | Home: "Choose a plan" is the filled button, "See how it works" is ghost (`index-360.png`) | none | `persona-test` completion |
| 6 | UX-0013 / UX-0016 Labels above, one column (high / low) | MET | `contact.html` labels above fields in one column (`contact-1280.png`) | none | `qa.mjs` form-label |
| 7 | UX-0001 / UX-0002 Visible nav labels (medium / high) | MET | Six labelled links, no hidden menu | none | `persona-test` completion |
| 8 | UX-0088 One obvious support entry point (medium) | PARTLY MET | Contact is in the header only; footer has no Contact link and no link to the FAQ near the plan | Not done: footer change touches every page | `persona-test` completion |
| 9 | UX-0080 Show prices and contact early (high) | UNVERIFIED | Prices are visible on product cards; the sample total shows no fees because none exist (sample brand) | none | manual |

## Placement experiment plan (hypotheses)

Simulated visitors are not real users. A winning variant is a hypothesis until real people confirm it (`docs/PILOT.md`). Nothing below was run or built.

### Decision 1: primary call-to-action placement (home)
- A (current): "Choose a plan" button in the hero text, after the lead paragraph. Supports UX-0028.
- B: add a second "Choose a plan" link inside the honey band after the three bag picks (UX-0028 wants one primary; this repeats the same action, so UX-0028 partly loses, UX-0042 supports a clear start).
- C: move the three bag picks above the hero text on narrow screens so the first screen shows a product (UX-0033 supports early key point; UX-0028 weakens as the CTA drops below the fold).
- Build: copies `index-b.html`, `index-c.html` or a class switch on `<body>`; no libraries.
- Measure: `node operations/plugin/scripts/persona-test.mjs <variant folder> --visitors 30 --seed 7`: task completion, steps, time. Also `qa-browser.mjs` tap targets. Pass line fixed before running: completion at least that of A with equal or fewer steps.
- Winner rule: lowest steps at equal or higher completion, picked from the pre-stated pass line only.

### Decision 2: navigation pattern
- A (current): always-visible wrapping list of six labelled links (UX-0001, UX-0002 support).
- B: reduce to four links (Products, How it works, FAQ, Contact), moving Ingredients into the product page (UX-0081 fewer choices supports; UX-0001 says content discoverability may fall).
- C: nav plus a footer link row repeating Contact and FAQ (UX-0088 supports; no record opposes).
- Build: separate page copies or a shared include through the throwaway page script.
- Measure: `persona-test` completion and steps for "find ingredients" and "ask a question"; `qa-browser` tap target and focus order (`qa-browser:focus-order`). Pass line: no persona below 70% (TRL gate) and steps not above A.
- Winner rule: fewest steps with all personas at or above 70%.

### Decision 3: form layout and support entry (contact)
- A (current): one column, labels above, error summary at top after failed submit (UX-0013, UX-0016, UX-0019).
- B: a short help line beside the Topic field, "Pick the closest one", and the FAQ link above the form (UX-0087 supports; UX-0015 cut fields not applicable).
- C: a form with the message field first and name and email after (UX-0015 supports fewer early fields; no record supports reordering, UNVERIFIED).
- Build: page copies; no new scripts.
- Measure: `persona-test` form task completion and steps; `qa.mjs` form-label check; `controls-test` for the summary links. Pass line: completion at least that of A and zero control findings.
- Winner rule: pre-stated pass line first, then fewest steps.

## Not from the graph
- The "Go to your plan" link may be redundant on wide screens where the plan sits beside the list. UNVERIFIED.
