<!-- Tasklane demo site: build log of the Lilac loop. FICTIONAL SAMPLE product. -->
# Build log

Followed: `AGENTS.md`, `product-types/Website/README.md`, `Phase 1.md`, `product-types/skills/website-phase-1/SKILL.md`, `frontend/skills/anti-ai-slop-ui/SKILL.md`, `operations/plugin/site/AGENTS.md`. One agent played every role in turn; the roles were not separate sessions. The brief is [BRIEF.md](BRIEF.md), written before any page.

## 1. Planner

- Visitor task: understand the product idea from the hero, compare the three sample tiers, see three examples, try the demo form. Primary action: Request a demo.
- Anti-slop premise: audience = a curious reader of the Lilac demo; visual premise = an engineering drawing (grid lines, square corners, hard offset shadows) with one signal colour (orange on near-black ink, lime highlight, teal secondary). Distinctive choices: kanban mock as the hero, mono eyebrow labels, lane-coloured card stripes. Avoided: purple gradient on white, glass cards, rounded pills, stock stats. The CSS-only gradient mesh is static and sits behind a drawn grid.
- ASSUMED: base URL `https://example.com/tasklane/` (canonical, og:url, sitemap, robots). No og:image (no source art). USD sample prices: Solo 0; Team 9 monthly / 7 yearly; Business 18 monthly / 15 yearly per person.
- Not shipped: dark-mode toggle (follows the system setting), analytics, fonts, images.

## 2. Builder

- 7 HTML pages emitted from a throwaway script kept outside the repo, so header, nav and footer are identical; output is plain static files. `site/assets/styles.css` (tokens, light/dark by token swap) and `site/assets/site.js` (one file, progressive enhancement, guards per feature).
- Inline one-liner adds `js` to `<html>`; every hidden/reveal state is under `.js`.
- Nav is a plain wrapping list that works without JS; `aria-current="page"` gets a static underline that JS replaces with the gliding indicator.
- Pricing: both prices are plain text per tier without JS; with JS they stack in one grid cell and cross-fade, the switch thumb slides.
- Demo form: `novalidate`, JS validation with per-field messages and `aria-invalid`; success text "Demo: nothing was sent." The submit button is `.js-only`; a note explains the no-JS case.
- 404 uses root-relative asset and link paths and `noindex`.

## 3. Reviewer (checklist and fixes)

| Check | Finding | Fix |
|---|---|---|
| Invented facts, customers, ratings, stats, certifications, real brands | Scanned all copy: none. Features written as a sample design sketch; integrations and access controls explicitly not naming products or certifications | none needed |
| Fictional/SAMPLE labels | Strip at top of every page, footer on every page, SAMPLE tag on tiers and prices, "Example" tag on scenarios | none needed |
| No-JS price display | First draft stacked both prices in one grid cell for everyone, hiding one under overlap | Stacking moved under `.js`; without JS both are listed |
| Contrast (WCAG relative luminance, computed) | Light: ink/bg 16.17, muted/bg 7.26, accent/bg 4.77, on-accent/button 5.18, error 6.61, focus 5.88. Dark: ink/bg 16.58, muted/surface 8.30, accent/bg 7.96, on-accent/button 7.96. Dark border `#3b5058` was 2.18 against bg | Dark `--line` changed to `#7a959e`: 5.83 on bg, 5.30 on surface (3:1 needed for borders) |
| Animation properties | Only `transform` and `opacity` are transitioned; `visibility` is switched at the end of a fade; box-shadow changes on press are instant | none needed |
| Layout shift | Kanban lane height fixed; cards absolutely positioned; both price spans share one grid cell | none needed |
| Continuous animation > 5 s | Board loop has a Pause/Play button | present |
| Not checked | Screen reader pass, real touch devices, Safari/Firefox/Windows rendering, Lighthouse | UNVERIFIED |

## 4. Tester

Serve: `node product-growth/media/demo-sites/serve.mjs saas 4175` (run from repo root; stopped afterwards).

Fetch each page (`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4175/<path>`):

```
index.html 200; features.html 200; pricing.html 200; how-teams-use-it.html 200; faq.html 200; demo.html 200; 404.html 200; nope.html 404; robots.txt 200; sitemap.xml 200; favicon.svg 200; assets/styles.css 200; assets/site.js 200
```

Internal links, anchors, meta, landmarks and single h1 (small Node script over every `href`/`src`; flags non-example.com `http(s)` URLs):

```
meta missing 404.html rel="canonical"
link/meta problems: 1
```

The one line is intended: the 404 page has `noindex` and no canonical. No missing files, no broken anchors, no external URLs, every other page has title, description, canonical, og:title, og:description, og:url, `<main>`, `<nav>`, `<footer>`, one `<h1>`.

Page weights (bytes, uncompressed): index.html 7783; features.html 5917; pricing.html 5851; how-teams-use-it.html 5660; faq.html 5121; demo.html 5158; 404.html 3447; styles.css 14130; site.js 5326. Largest page with its assets: index.html + css + js = 27239 bytes, under the 300 KB budget.

In-app browser (Chromium pane, 360 px and about 1024 px wide), observed:
- No horizontal overflow at 360 px (`scrollWidth` 360).
- Home: board cards move between lanes; Pause button switched to Play and stopped the loop; nav indicator transform set to the current link.
- Pricing: switch click set `aria-checked="true"` and `data-b="y"`; monthly prices ended `visibility:hidden`, yearly `visible`.
- Demo form: empty submit showed four messages and focused the name field; valid submit showed "Demo: nothing was sent. Your answers passed the browser checks and were discarded." and cleared errors.
- Reduced-motion and no-JS were verified by reading the CSS and JS only (see Motion), not in a browser: UNVERIFIED at runtime.

## 5. Motion

Level: expressive but accessible.

| Motion | Technique | Reduced motion | Control |
|---|---|---|---|
| Hero kanban loop (1.9 s per step, five steps then fade-reset) | `transform` transition on cards, `opacity` on tick and the reset fade | Loop does not start; static arrangement shown (cards spread across the lanes, one in Done); Pause button hidden | Pause/Play button |
| Reveal on scroll, staggered by 0/90/180 ms | `opacity` and `transform`, set by IntersectionObserver under `.js` | Visible immediately; also a 4 s failsafe shows everything | none |
| Scroll progress bar | `transform: scaleX`, no number | Updates instantly (no transition) | none |
| Pricing switch | thumb `transform`; prices `opacity` and `transform` | Transitions removed; state swaps instantly | the switch |
| Button press | `transform` shift, shadow dropped instantly | Transitions removed | none |
| Nav indicator | `transform` translate and scaleX | Transitions removed; indicator jumps | none |

No flashing: nothing blinks or changes faster than 0.12 s. No layout shift: moving elements are absolutely positioned or share a fixed grid cell.

## QA

- `qa: 0 error(s), 0 warning(s), 0 unverified`
- `qa-browser: 0 error(s), 3 warning(s), 3 unverified` (before fixes: `qa-browser: 21 error(s), 21 warning(s), 3 unverified`; footer links were 18 px tall; fixed with 44 px minimum heights; remaining warning is the 24x24 consent checkbox, accepted in RESULTS.md).
- Screenshots in `.lilac/qa/` read at 360, 768 and 1280 px for home, pricing and demo: no cut-off text, overlap or unreadable contrast seen.
- `techdocs: 2 parts, 3 languages, 0 problem(s)`
- `controls-test: 128 controls, 0 dead, 0 broken, 0 placeholder, 47 unreachable (63% operable)`: tool issue, see TOOL-ISSUES.md.

## Simulated visitors

SIMULATED, not real people. `node operations/plugin/scripts/persona-test.mjs product-growth/media/demo-sites/saas --visitors 30 --seed 7`:

- `persona-test: 30 simulated visitors, 86% tasks completed, 6 failure group(s)` and `FAIL: overall 86% is below 90%`.
- 5 groups are `"Your name" is covered by offscreen` or no feedback after submit, caused by the tool measuring during smooth scroll (TOOL-ISSUES.md 1). Same site with only `scroll-behavior:smooth` removed, on a copy: `persona-test: 30 simulated visitors, 97% tasks completed, 1 failure group(s)`.
- 1 group is the accepted no-JavaScript case: `"Request a demo" exists but is hidden`.
- UX review and placement experiment hypotheses: [UX-REVIEW.md](UX-REVIEW.md).

## Hosting

- `.lilac/hosting.json`: cloudflare, db none. `hosting: 0 problem(s)`. Not deployed; no deploy plan run.

## Foundation

- `foundation: 0 error(s), 0 warning(s)`; `foundation drift: 0 error(s), 0 warning(s)`.
- Status: `NONE: no approval yet. Run /lilac:foundation.` Approval pending owner.

## 2026-11-23: no-JavaScript form fallback

Form now `method="get" action="thanks.html"` with unnamed personal fields (demo only: a real site posts to a server). Added thanks.html, privacy.html, closing next-step links on pages that were dead ends, funnel files. Gates and lines: RESULTS.md.
