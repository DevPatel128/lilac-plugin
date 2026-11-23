# Tool issues found (not site problems)

## controls-test: footer links reported UNREACHABLE "covered by nothing"

- Run: `node operations/plugin/scripts/controls-test.mjs product-growth/media/demo-sites/fitness`
- Result line: `controls-test: 121 controls, 0 dead, 0 broken, 0 placeholder, 40 unreachable (67% operable)`
- Example row: `Classes | link | UNREACHABLE | covered by nothing; screenshot .lilac/controls/Classes-37.png` (the four footer links, on every page; 40 rows).
- Why this is the tool: `operations/plugin/scripts/controls-test.mjs` line 155 (`C.reach`) calls `e.scrollIntoView({ block: 'center', inline: 'center' })` and immediately calls `document.elementFromPoint`. The site sets `html{scroll-behavior:smooth}` in `site/assets/styles.css` (off under `prefers-reduced-motion`), so the scroll has not finished, the point is outside the viewport and `elementFromPoint` returns null, printed as "covered by nothing".
- Proof: a copy of the site in the scratchpad with only `html{scroll-behavior:smooth}` removed gave `controls-test: 121 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)`. The same 121 controls, so nothing else differs.
- Suggested tool fix: `scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })`.
- Site not changed: smooth scrolling is a deliberate, reduced-motion-safe design choice and a real visitor can click these links.

## persona-test: "covered by offscreen" on the contact form and nav (same cause)

- Run: `node operations/plugin/scripts/persona-test.mjs product-growth/media/demo-sites/fitness --visitors 30 --seed 7`
- Result line: `persona-test: 30 simulated visitors, 88% tasks completed, 6 failure group(s)`; `FAIL: overall 88% is below 90%; low-vision 60% is below 70%`
- Failing lines: `why: "Name" is covered by offscreen` (low-vision, small-phone, mobile-3g), `why: nav item "Book a trial": "Book a trial" is covered by offscreen`, `why: "Anything you would like the teacher to know (optional)" is covered by offscreen`.
- Why this is the tool: `operations/plugin/scripts/persona-test.mjs` line 153 calls `el.scrollIntoView({ block: 'center', inline: 'center' })` then reads `getBoundingClientRect()` at once and returns `cover: 'offscreen'` if the centre is outside the viewport (line 154). With `html{scroll-behavior:smooth}` the scroll is still animating at that moment. Same cause as the controls-test issue above.
- Proof: scratchpad copy of the site with only `html{scroll-behavior:smooth}` removed: `persona-test: 30 simulated visitors, 97% tasks completed, 1 failure group(s)` and `low-vision user (320x640, 200% zoom)  4 sess  100% (20/20)`.
- Suggested tool fix: `behavior: 'instant'` in both scroll calls.
- Site not changed for this.

## Real, accepted: no-JavaScript visitor cannot submit the demo form

- The only remaining failure in the proof run: `why: no visible feedback within 3 s after submitting (no status, new text, thank-you page or revealed element)` for the JavaScript-disabled persona. This is a site limitation, not a tool error: the submit button is added by `contact.js`, the page says booking needs JavaScript, and the form sends nothing anyway (BRIEF.md). Accepted, see RESULTS.md.
