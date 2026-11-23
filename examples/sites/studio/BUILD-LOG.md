<!-- Atelier Nord demo site: build log. FICTIONAL SAMPLE studio. -->
# Build log

Followed: `product-types/Website/README.md`, `Phase 1.md`, `product-types/skills/website-phase-1/SKILL.md`, `frontend/skills/anti-ai-slop-ui/SKILL.md`, `operations/plugin/site/AGENTS.md`. One agent played every role in turn. Pages and CSS were emitted by a throwaway generator kept outside the repo; the output is plain static files.

## 1. Planner

Facts and limits are in [BRIEF.md](BRIEF.md). Visitor task: judge the studio from its drawings and enquire. Primary action: Enquire.
Anti-slop premise: audience = a curious reader; visual premise = a drawing-office sheet printed as a monograph. Distinctive choices: every project is a self-drawing SVG plan/elevation/section with hatched walls; serif display type over mono sheet labels; one red "correction pencil" accent; asymmetric 12-column placement. Avoided: photos, gradients, glass cards, stat bands, testimonials.
Assumptions: ASSUMED `https://example.com/atelier-nord/` base; ASSUMED no og:image; project names, areas and materials are invented.

## 2. Builder

`site/`: 7 pages, `assets/styles.css`, `assets/main.js`, `favicon.svg`, `robots.txt`, `sitemap.xml`; `wrangler.jsonc` beside it. Tokens as CSS custom properties; dark mode swaps tokens only. Grid column spans are generated only for the spans used. Nav is a plain wrapping list. Filter buttons and the demo form button are inert until JS enables them; without JS a note explains the form needs JS. Only card 01 links to the detail page; the other five say "Sample sheet only" instead of linking to nothing.

## 3. Reviewer (checklist)

| Check | Finding | Fix |
|---|---|---|
| Invented facts | Scanned copy: names, area (190 m2), materials all marked SAMPLE; no firm, award, address, contact | none needed |
| Contrast (WCAG luminance, computed) | Light: ink 16.18, muted 6.59 (tint 6.02), accent 5.09, button 5.75. Dark: ink 15.70, muted 7.71 (tint 7.09), accent 7.57, button 7.57 | none needed |
| Motion rules | Animated properties: transform, opacity, clip-path, stroke-dashoffset only. Counter changes text via JS, not CSS | none needed |
| Content without JS | Reveal and draw states only under `.js`; inline script removes `.js` after 2.5 s if `main.js` never ran | added the timeout guard |
| Hero layout at 1280 px | First pass: explicit grid rows pushed the headline below the drawing | removed row rules; headline spans full width, lede and drawing share a row |
| No-JS form | A GET submit would put typed data in the URL | no `action`/`method`; submit disabled until JS runs |
| Not checked | Screen reader pass, real touch device, Safari/Firefox rendering | UNVERIFIED |

## 4. Tester

Server: `node product-growth/media/demo-sites/serve.mjs studio 4176` (background; stopped afterwards).

Status codes (`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4176/<file>`):

```
index.html 200; projects.html 200; project.html 200; approach.html 200; journal.html 200; contact.html 200; 404.html 200
robots.txt 200; sitemap.xml 200; favicon.svg 200; assets/styles.css 200; assets/main.js 200
```

Link/meta check (Node script over every href/src, anchors, title, description, canonical, og:title/description/url, non-example.com absolute URLs):

```
link/meta problems: 0 pages: 7
```

Page weight (html + styles.css 11277 + main.js 4124 + favicon.svg, bytes): 404 18471; approach 22275; contact 19990; index 29239; journal 22903; project 23197; projects 32042. All under 300 KB.

In-app browser (JavaScript on): 360 px horizontal overflow, scrollWidth 356 vs 360 viewport on all seven pages (no overflow); one `h1` per page. Projects filter: Public gave `Showing 2 of 6 sample projects (public).` with 2 visible cards; All gave `Showing all 6 sample projects.`. Contact: empty submit gave four error messages and focused `n`; valid values gave `Demo: nothing was sent. This studio is fictional and your answers stayed in your browser.` and cleared errors. Home at 360 px and 1280 px (dark scheme) and Projects at 1280 px were inspected by screenshot.

Not run (UNVERIFIED): hover and keyboard walk-through, 768 px and 1440 px visual inspection, light-mode screenshots, no-JS rendering in a real browser, reduced-motion emulation, screen reader, Lighthouse. The pane throttled animations, so screenshots taken during the wipe or reveals showed intermediate states; end states were confirmed by script (`document.getAnimations()` finished, `.js` class kept).

## 5. Motion

Level: expressive but accessible.

| Effect | Where | Property | Reduced motion |
|---|---|---|---|
| Drawings draw themselves | every `.dwg`, in view | stroke-dashoffset (staggered by child, hatch and labels fade in via opacity) | fully drawn, no transition |
| Clip-path reveals | drawing frames | clip-path | no clip, visible |
| Hero parallax | home hero drawing | transform (rAF, capped at 900 px scroll, 8 % rate), passive listener, no scroll hijack | not attached |
| Card hover/focus | project cards | transform on the drawing; caption opacity+transform on hover-capable devices only | none; caption always visible |
| Index counter | project numbers, approach steps | JS text count 00 to n, decorative, `aria-hidden`, tabular figures, fixed width | final value at once |
| Link underline | `.u` links | transform scaleX | none |
| Page-load wipe | every page | clip-path on `body::before`, `pointer-events:none`, 0.9 s once | not rendered |

No continuous animation exists, so no pause/play control. No flashing. Layout cannot shift: all animated properties are compositor-only and drawings keep their aspect ratio.

## QA

Date 2026-11-22. Details in [RESULTS.md](RESULTS.md), [UX-REVIEW.md](UX-REVIEW.md), [TOOL-ISSUES.md](TOOL-ISSUES.md).

```
qa: 0 error(s), 0 warning(s), 1 unverified
qa-browser: 0 error(s), 3 warning(s), 3 unverified
controls-test: 94 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)
techdocs: 2 parts, 3 languages, 0 problem(s)
```

First browser run was `qa-browser: 21 error(s), 25 warning(s), 3 unverified` (tap targets); fixed with 44 px targets. The 3 warnings left are a wrapped-link false positive (TOOL-ISSUES.md).

## Simulated visitors

SIMULATED, not real people.

```
persona-test: 30 simulated visitors, 96% tasks completed, 1 failure group(s)
```

Seed 7. Before: `persona-test: 30 simulated visitors, 93% tasks completed, 2 failure group(s)` (home h1 hidden by reveal; fixed). Remaining: no-JS persona cannot confirm the demo form (accepted, RESULTS.md).

## Hosting

```
hosting: 0 problem(s)
```

Cloudflare static assets, `--db none`, `.lilac/hosting.json`. Deploy plan not run; nothing deployed.

## Foundation

```
foundation: 0 error(s), 0 warning(s)
foundation drift: 0 error(s), 1 warning(s)
NONE: no approval yet. Run /lilac:foundation.
```

Approval pending owner. Drift warning: 9 durations over 600 ms (one-time draw-on, reveal, wipe).

## 2026-11-23: no-JavaScript form fallback

Form now `method="get" action="thanks.html"` with unnamed personal fields (demo only: a real site posts to a server). Added thanks.html, privacy.html, closing next-step links on pages that were dead ends, funnel files. Gates and lines: RESULTS.md.
