# Foundation

Atelier Nord is a FICTIONAL SAMPLE architecture studio site. Facts and limits are in [BRIEF.md](BRIEF.md); the brand kit is in [BRAND.md](BRAND.md). Approval status: approval pending owner (not approved by anyone).

## Languages
Found by file type: HTML (7 pages in `site/`), CSS (1 file, `site/assets/styles.css`), JavaScript (1 file, `site/assets/main.js`). Plus inline SVG for every drawing and `favicon.svg`. No TypeScript, no framework.

## Tools
Found by config files: Cloudflare Wrangler (`wrangler.jsonc`, static assets Worker, directory `./site`). No package.json, no bundler, no test runner. Checks are the Lilac scripts (`foundation.mjs`, `qa.mjs`, `qa-browser.mjs`, `controls-test.mjs`, `persona-test.mjs`, `techdocs.mjs`). Local preview: `product-growth/media/demo-sites/serve.mjs studio 4176`.

## Architecture
A static multi-page site. Each page is a hand-written HTML file that links `assets/styles.css` and `assets/main.js`. All content and navigation work without JavaScript. `main.js` is progressive enhancement only: it adds the `.js` class that enables reveal and draw states, the project category filter, the demo form validation, a decorative index counter and a transform-only parallax on the home drawing. An inline script removes the `.js` class after 2.5 s if `main.js` never ran, so content is never left hidden. There is no server code, no API and no database. The page-load wipe and drawings animate only transform, opacity, clip-path and stroke-dashoffset.

## Folder structure
Top level: `BRIEF.md`, `BUILD-LOG.md`, `README.md`, `FOUNDATION.md`, `BRAND.md`, `wrangler.jsonc`, `site/` (the deployable assets), `brand/` (generated tokens and brand sheet), `architecture/`, `governance-learning/`, `product-growth/` (generated docs from techdocs), `.lilac/` (QA and visitor evidence). Inside `site/`: seven pages, `assets/`, `favicon.svg`, `robots.txt`, `sitemap.xml`.

## Data and storage
No user data is stored or sent anywhere. Content is static HTML. The enquiry form validates in the browser and shows "Demo: nothing was sent"; it has no `action` or `method`, so nothing can leave the page. No cookies, no local storage, no analytics.

## Hosting
Cloudflare static assets Worker, chosen with `hosting.mjs choose` (see `.lilac/hosting.json` and `/lilac:hosting`). Nothing is deployed; deploying needs a separate human yes. Code on GitHub is assumed by the Lilac workflow; no remote has been verified for this folder (UNVERIFIED).

## Budgets
Page weight: each page plus CSS, JS and favicon under 300 KB (BRIEF.md); the last measured heaviest page was 32042 bytes (BUILD-LOG.md). Accessibility: WCAG AA text contrast, skip link, landmarks, visible focus, content visible without JavaScript, 360 to 1440 px, reduced-motion respected. Third-party requests: zero.

## Security baseline
No third-party scripts, fonts, images or requests; system fonts only. No forms that submit, no secrets, no storage. HTTP security headers (CSP and others) are NOT configured in `wrangler.jsonc`: UNVERIFIED and a gap to close before any real deploy (static assets Workers can take a `_headers` file; not added here because nothing is deployed).

## Decisions
### Decision: plain HTML, CSS and JavaScript with no build step
- Options considered: plain static files; a static site generator; a framework (React or similar)
- Why: seven pages with fixed content and no data; the brief forbids a build step and CDNs; fewer moving parts to review
- Trade-offs: header, footer and the drawings are repeated across pages by hand; no component reuse or type checking
- Revisit when: the page count grows or content must come from data

### Decision: every project is an inline SVG drawing, no photographs
- Options considered: photographs; generated raster images; inline SVG drawings
- Why: the studio is fictional, so no real building photograph may be shown; SVG is small, scales, themes with tokens and draws itself with stroke-dashoffset
- Trade-offs: no og:image (no raster art exists); drawings are heavy in markup and tedious to edit
- Revisit when: real work with permission to publish exists

### Decision: system fonts only
- Options considered: system stacks; locally hosted licensed web fonts; a remote font service
- Why: no requests to other companies, no licence to hold, instant text
- Trade-offs: the serif headline looks different per operating system (Iowan Old Style, Palatino or Georgia)
- Revisit when: the owner supplies a licensed font file to host locally

### Decision: expressive but accessible motion
- Options considered: no motion; subtle fades only; expressive drawing and wipe effects
- Why: the drawings are the work, so seeing them drawn is the point; motion is limited to compositor-friendly properties, runs once, and is off under `prefers-reduced-motion: reduce`
- Trade-offs: drawing and wipe durations (0.8 to 1.6 s) exceed the 600 ms token ceiling, so they stay as literals in the CSS and drift reports them
- Revisit when: real visitors or QA show the intro delays reading

### Decision: Cloudflare static assets for hosting
- Options considered: Cloudflare Workers static assets; Vercel; another host
- Why: the site is only files; Cloudflare is the Lilac default; no database is needed (`--db none`)
- Trade-offs: no custom headers file yet; deploy account and domain are not set up
- Revisit when: the owner picks a different host or needs server features
