<!-- Still Water demo site: build log. FICTIONAL SAMPLE studio. -->
# Build log

Followed: `product-types/Website/README.md`, `Phase 1.md`, `product-types/skills/website-phase-1/SKILL.md`, `frontend/skills/anti-ai-slop-ui/SKILL.md`, `operations/plugin/site/AGENTS.md`. One agent played every role in turn. Brief: [BRIEF.md](BRIEF.md), written before any site file.

## 1. Planner

Visitor task: see the week, find a class by day and level, meet teachers, compare plans, book a trial (demo). Primary action: Book a sample trial class.
Visual premise (anti-slop): a calm studio with a tide-pool palette, earthy blue on sand, with layered waves and one slow circle as the single signature. Avoided: lavender wellness look, stock testimonials, claims. Distinct from the dog-food baseline: soft gradients, pill shapes, system rounded type, no hard shadows.
ASSUMED: base URL `https://example.com/still-water/`; sample "$" prices; no `og:image`; all names and times invented.

## 2. Builder

`site/`: 7 HTML pages, `assets/styles.css`, `motion.js`, `classes.js`, `contact.js`, `favicon.svg`, `robots.txt`, `sitemap.xml`. Pages were emitted by a throwaway script kept outside the repo so header, nav and footer match; output is plain static files. Tokens are CSS custom properties; dark mode swaps tokens only. Nav is a wrapping list (no JS). Filter controls and the form submit button are created by JS; without JS the full table shows and the form page says booking needs JavaScript (nothing is sent either way).

## 3. Reviewer

| Check | Finding | Fix |
|---|---|---|
| Contrast, computed (WCAG luminance) | Light: ink/bg 12.27, muted/bg 6.69, blue/bg 6.45, button 7.09, muted on soft 5.74; input border line/bg 2.99 (needs 3) | Darkened `--line` to #6c7c84 (rechecked by hand-set value, not re-run: UNVERIFIED) |
| Dark | ink/bg 14.55, muted/bg 9.91, blue/bg 8.49, button 8.50, line/surface 4.89 | none |
| Claims scan (grep for improve, cure, reduce, heal, stress, weight, review, rating, award) | None in copy (only the footer disclaimer sentence "Nothing here is health, medical or wellness advice") | none |
| Mobile hero | The breathing circle came first on narrow screens and pushed the headline below the fold | Removed `order:-1` so text leads |
| 404 | Served from any path | Absolute asset and link paths, `noindex`, no canonical |
| Motion rules | Reveal hidden only under `.js`; failsafe timer reveals everything after 4 s; reduced motion disables animations and transitions | none |

## 4. Tester

Serve: `node product-growth/media/demo-sites/serve.mjs fitness 4177`. Fetched with curl (status, bytes):

```
200 5504 /           200 5504 /index.html     200 6611 /classes.html
200 5614 /teachers.html   200 4814 /memberships.html   200 5072 /first-visit.html
200 5476 /contact.html    404 3601 /nope.html (serves 404.html)
200 134 /robots.txt  200 601 /sitemap.xml  200 283 /favicon.svg
200 9795 /assets/styles.css  200 2647 /assets/motion.js  200 1928 /assets/classes.js  200 1570 /assets/contact.js
```

Internal links and assets: every `href`/`src` found in the 7 pages resolves to a file (loop printed `ok` for all 11 targets, no `MISSING`). Largest page with its assets is about 22 KB, far below 300 KB.
In-app browser: home at 375 px (no horizontal scroll, scrollWidth 375), classes at 375 px: clicking Mon showed "Showing 2 of 14 sample classes."; Tue + Beginner showed the empty message; Pause button toggled to Play and back; contact form: empty submit gave 5 errors, valid submit showed "Demo: nothing was sent."; all running animations animate only transform and opacity (checked via `document.getAnimations()`).
NOT run: 768 and 1280 px visual inspection, reduced-motion emulation, no-JS render, keyboard-only pass, screen reader, dark-mode screenshot of every page.

## 5. Motion

Level: expressive but accessible.
| Effect | Where | Properties | Control |
|---|---|---|---|
| Breathing circle (10 s loop) | home hero | transform, opacity | Pause/Play button, label "Follow along: just a visual rhythm"; starts only when JS can add the button |
| Ripple rings | logo hover/focus | transform, opacity | off under reduced motion |
| Row slide-in | timetable on filter change | transform, opacity | off under reduced motion |
| Wave parallax | hero and page heads | transform via rAF on scroll | skipped under reduced motion |
| Staggered reveal | sections | transform, opacity | `.js` only, failsafe 4 s, instant under reduced motion |
| Press ripple, hover lift | buttons | transform, opacity | off under reduced motion |
No flashing, no layout shift (all effects are transform/opacity; sizes reserved).

## QA

Static: `qa: 0 error(s), 0 warning(s), 1 unverified`
Browser (first run, before fixes): `qa-browser: 21 error(s), 21 warning(s), 3 unverified`; after tap-target padding: `qa-browser: 0 error(s), 0 warning(s), 3 unverified`.
Techdocs: `techdocs: 2 parts, 3 languages, 0 problem(s)`
Controls: `controls-test: 121 controls, 0 dead, 0 broken, 0 placeholder, 40 unreachable (67% operable)` (tool issue, see TOOL-ISSUES.md; copy without smooth scroll: `controls-test: 121 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)`).
UX review: UX-REVIEW.md. Full table: RESULTS.md.

## Simulated visitors

First run: `persona-test: 30 simulated visitors, 85% tasks completed, 7 failure group(s)`. After making the h1 always visible: `persona-test: 30 simulated visitors, 88% tasks completed, 6 failure group(s)`; `FAIL: overall 88% is below 90%; low-vision 60% is below 70%`. Tool cause for 5 groups (TOOL-ISSUES.md); copy without smooth scroll: `persona-test: 30 simulated visitors, 97% tasks completed, 1 failure group(s)`. Simulated, not real people.

## Hosting

`node operations/plugin/scripts/hosting.mjs choose --host cloudflare --db none` then `hosting: 0 problem(s)`. Not deployed; deploy-plan not run.

## Foundation

`foundation: 0 error(s), 0 warning(s)`; `foundation drift: 0 error(s), 0 warning(s)`; status `NONE: no approval yet. Run /lilac:foundation.` Approval pending owner.

## 2026-11-23: no-JavaScript form fallback

Form now `method="get" action="thanks.html"` with unnamed personal fields (demo only: a real site posts to a server). Added thanks.html, privacy.html, closing next-step links on pages that were dead ends, funnel files. Gates and lines: RESULTS.md.
