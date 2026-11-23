# Tool issues found

Found while running the gate procedure on the Tasklane demo. Each is a tool mistake, not a site problem, so the site was not changed to hide it.

## 1. controls-test and persona-test measure while a smooth scroll is still running

- Tool lines: `operations/plugin/scripts/controls-test.mjs` line 155 (`C.reach`: `e.scrollIntoView({ block: 'center', inline: 'center' })` followed at once by `document.elementFromPoint`), and the same effect in `persona-test.mjs` ("is covered by offscreen").
- Why it is a tool mistake: the site sets `html{scroll-behavior:smooth}` (turned off under `prefers-reduced-motion`). `scrollIntoView` with no `behavior` follows that CSS, so the page is still scrolling when the point is tested, `elementFromPoint` returns null and the tool prints `covered by nothing`. The control is visible and clickable for a real visitor. The tool should pass `behavior: 'instant'`.
- Output on the real site (controls-test): `controls-test: 128 controls, 0 dead, 0 broken, 0 placeholder, 47 unreachable (63% operable)`. Example line: `Features | link | UNREACHABLE | covered by nothing; screenshot .lilac/controls/Features-34.png` (a link in the footer, shown in a screenshot taken before the scroll finished).
- Evidence: the same site copied outside the repo (`/private/tmp/...`) with only `scroll-behavior:smooth` removed gave `controls-test: 128 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)`, and persona-test on that copy went from 83% to 97%, leaving one failure group (no JavaScript, see RESULTS.md accepted risks).
- Persona failures from the same cause: `"Your name" is covered by offscreen` (low-vision, small-phone, mobile-3g) and, for the keyboard persona, `no visible feedback within 3 s after submitting (no status, new text, thank-you page or revealed element)` (earlier run worded it `no visible confirmation after submitting the form`); both vanished on the copy (keyboard 100%).
- Re-run after the wait (tool files unchanged for controls-test; persona-test last modified 2026-11-22 09:13:57): `controls-test: 128 controls, 0 dead, 0 broken, 0 placeholder, 47 unreachable (63% operable)` and `persona-test: 30 simulated visitors, 86% tasks completed, 6 failure group(s)`. Same cause.
