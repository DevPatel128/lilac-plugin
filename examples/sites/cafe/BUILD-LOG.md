<!-- Corner Kiln demo site: build log of the Lilac loop. FICTIONAL SAMPLE brand. -->
# Build log

Followed: `product-types/Website/README.md`, `Phase 1.md`, `product-types/skills/website-phase-1/SKILL.md`, `frontend/skills/anti-ai-slop-ui/SKILL.md`, `operations/plugin/site/AGENTS.md`. One agent played every role in turn. `dog-food/site` was used as a structure baseline only.

## 1. Planner

Wrote [BRIEF.md](BRIEF.md) first (audience, main action, SAMPLE facts, must-not-claim, three reference moods, pages, constraints, hosting cloudflare, success).
- Visitor task: look at the sample menu, check today's hours, try the demo booking. Primary action: Book a table.
- Anti-slop premise: a letterpress menu card in a shop window. Distinctive choices: irregular hand-cut corners, pen-drawn underlines, one hot kiln colour on warm paper.
- ASSUMED: base URL `https://example.com/corner-kiln/`; currency "KC"; no event dates (they would be invented); no `og:image`.

## 2. Builder

Pages were emitted from a throwaway script kept outside the repo so header, nav and footer match on every page. Output is plain static files: 7 HTML pages, `assets/styles.css`, `assets/site.js`, `favicon.svg`, `robots.txt`, `sitemap.xml`. Nav is a wrapping list (no JS). `.js` is added to `<html>` by a one-line inline script; every hidden or animated start state is under `.js`.

## 3. Reviewer

| Check | Finding | Fix |
|---|---|---|
| Invented facts and claims | Grep for review, rating, award, certified, organic, local, vegan, gluten: only "Allergens: ask the team" and the fictional notice | none needed |
| "This week at the kiln" implied current news | Reworded to "On the sample menu" | fixed |
| Contrast (WCAG luminance from tokens) | Light: ink/bg 13.91, muted/bg 7.55, kiln-deep/bg 8.28, button 5.32, error 6.54, ink on today row 11.89. Dark: ink/bg 14.74, muted/bg 9.55, kiln-deep/bg 8.79, button 6.81, error 10.69, ink on today row 9.61. All at or above 4.5 | none needed |
| Underline drawn through next line | Inline SVG sat on the text baseline gap; the heading underline fell 35 px low | `svg{display:block}`, underline moved under the last heading line |
| Non-scaling stroke with pathLength | Dash maths unreliable | removed `vector-effect` |
| Not checked | Screen reader pass, real touch device, Safari and Firefox | UNVERIFIED |

## 4. Tester

Server: `node product-growth/media/demo-sites/serve.mjs cafe 4174`. Fetch with `curl -s -o /dev/null -w '%{http_code} %{size_download}' http://127.0.0.1:4174/<path>`:

```
200 6052 /index.html
200 7882 /menu.html
200 5735 /bakes.html
200 4693 /visit.html
200 4293 /events.html
200 4471 /contact.html
200 3874 /404.html
404 3874 /nope.html
200 152 /robots.txt
200 584 /sitemap.xml
200 232 /favicon.svg
200 8510 /assets/styles.css
200 3625 /assets/site.js
```

(`nope.html` returns 404 and serves `404.html`, as intended.) Internal links: every `href`/`src` without a scheme in the 7 pages was checked with `[ -e file ]` from `site/`: 0 missing. After that run the only change was one sentence on the home page; page sizes stay about 4 to 8 KB, all far under 300 KB.

In-app browser (360 px wide viewport and default width):
- No horizontal overflow at 360 px on home, menu, visit and contact (`scrollWidth` 360).
- Menu: clicking Bakes shows only the Bakes section and sets the status text "Showing Bakes only."; All shows 4 sections.
- Visit: `tr.today` was "Saturday" and matched the device day (6).
- Contact: submitting empty shows 4 errors and focuses `name`; valid input shows the "Demo: nothing was sent." message and 0 errors.
- Console errors: none from the site. One early 404 was the pane's own `/favicon.ico` request; the page declares `favicon.svg`.
- Steam (`rise`) and loaf (`breathe`) animations were running (`getComputedStyle`); the hero underline draws; screenshot confirmed the layout in dark mode.

## 5. Motion

Level: expressive but accessible.

| Motion | How | Properties |
|---|---|---|
| Page-load fade | `.js body` keyframe, 0.5 s, once | opacity |
| Steam from the cup | three paths, 4 s loop, staggered | transform, opacity |
| Loaf proving | scale 1 to 1.05, 6 s loop | transform |
| Staggered menu reveal | `IntersectionObserver` adds `.in`; delay `--i` x 70 ms | transform, opacity |
| Hover lift on cards and buttons | 0.2 to 0.25 s | transform |
| Today's hours pulse | ring on the "Today" badge, one iteration | transform, opacity |
| Hand-drawn underline | SVG path, `pathLength` 1 | stroke-dashoffset |

Rules kept: content visible without JS (start states only under `.js`; no `IntersectionObserver` means everything shows); `prefers-reduced-motion: reduce` sets `animation:none` and `transition:none` and resets reveal and underline states; continuous loops get a Pause motion button in the footer and on pages with art (state kept in `sessionStorage`, with try/catch); no flashing; SVG art has fixed viewBox sizes so nothing shifts. UNVERIFIED: reduced-motion behaviour in a real browser (rule written, not emulated), screen reader announcements.

## QA

Date 2026-11-21. Static `qa.mjs`:
```
qa: 0 error(s), 0 warning(s), 3 unverified
```
Browser `qa-browser.mjs` (widths 360, 768, 1280; screenshots in `.lilac/qa/`; first run 1 error and 21 warnings, the 21 were the 165x32 brand link, fixed with `.brand{min-height:44px}`):
```
qa-browser: 1 error(s), 0 warning(s), 4 unverified
```
The 1 error is `[focus-trap] ... input#date` on contact.html, a tool issue (TOOL-ISSUES.md). Controls:
```
controls-test: 132 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)
```
techdocs: `techdocs: 2 parts, 3 languages, 0 problem(s)`. UX review: [UX-REVIEW.md](UX-REVIEW.md). Full table: [RESULTS.md](RESULTS.md).

## Simulated visitors

`persona-test.mjs --visitors 30 --seed 7`. Visitors are simulated, not real people.
```
persona-test: 30 simulated visitors, 84% tasks completed, 7 failure group(s)
FAIL: overall 84% is below 90%
```
Only "complete the main form" failed (0/22); cause is the native date field and `Input.insertText` (TOOL-ISSUES.md), checked by hand in the in-app browser. Not re-proven by a rerun.

## Hosting

Choice: cloudflare, no database (`hosting.mjs choose --host cloudflare --db none`). Not deployed; deploy-plan not run.
```
hosting: 0 problem(s)
```

## Foundation

FOUNDATION.md and BRAND.md completed from the code; tokens in `brand/`.
```
foundation: 0 error(s), 0 warning(s)
foundation drift: 0 error(s), 1 warning(s)
NONE: no approval yet. Run /lilac:foundation.
```
Approval pending owner. Drift warning: the 4 s and 6 s ambient loops and the 1.4 s ring.

## 2026-11-23: no-JavaScript form fallback

Form now `method="get" action="thanks.html"` with unnamed personal fields (demo only: a real site posts to a server). Added thanks.html, privacy.html, closing next-step links on pages that were dead ends, funnel files. Gates and lines: RESULTS.md.
