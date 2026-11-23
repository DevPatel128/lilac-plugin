# Foundation

Tasklane is a FICTIONAL project-management product. This site is a landing site built to demo Lilac's Website track. Nothing on it is real: prices are SAMPLE, scenarios are illustrative, the demo form sends nothing. Source of truth for intent: [BRIEF.md](BRIEF.md). Process and evidence: [BUILD-LOG.md](BUILD-LOG.md).

## Languages
Found by file type: HTML (7 files), JavaScript (1 file), CSS (1 file). Plain HTML, CSS and one JavaScript file. No TypeScript, no framework, no build step.

## Tools
Found by config files: Cloudflare Wrangler (`wrangler.jsonc`, static assets only). Pages are written by hand as static files; there is no package.json, bundler, linter or test runner in this folder. Checks come from Lilac's own scripts (`foundation`, `hosting`, `qa`, `qa-browser`, `techdocs`, `controls-test`, `persona-test`).

## Architecture
A static site with no server code. Seven HTML pages (`index`, `features`, `pricing`, `how-teams-use-it`, `faq`, `demo`, `404`) share one stylesheet (`site/assets/styles.css`) and one script (`site/assets/site.js`). The script is progressive enhancement: every feature (kanban loop, scroll reveal, progress bar, nav indicator, pricing switch, form validation) has its own guard, and content is readable without it because hidden or animated states exist only under the `.js` class on `<html>`. The demo form validates in the browser and sends nothing. The Cloudflare Worker config serves `site/` as static assets.

## Folder structure
Top level: BRIEF.md, BUILD-LOG.md, README.md, FOUNDATION.md, BRAND.md, RESULTS.md, UX-REVIEW.md, wrangler.jsonc, `site/` (everything that is served), `brand/` (generated tokens and brand sheet, not served), `architecture/`, `governance-learning/`, `product-growth/` (generated or authored docs about the example), `.lilac/` (check output, not served).

## Data and storage
No database, no cookies, no local storage, no analytics, no network requests from the page. Content lives in the HTML files. The demo form discards its answers in the browser. Sample prices are plain text in `pricing.html`.

## Hosting
Cloudflare static assets, chosen in `.lilac/hosting.json` (see `/lilac:hosting`, `node operations/plugin/scripts/hosting.mjs`). Not deployed; deploying is the human's decision. The `example.com` URLs in canonical, og and sitemap are ASSUMED placeholders.

## Budgets
Brief limits: every page under 300 KB; WCAG AA; 360 to 1440 px wide; no layout shift; animate only transform and opacity; all motion off or instant under `prefers-reduced-motion: reduce`. Measured by `qa.mjs` and `qa-browser.mjs`, not by Lighthouse (UNVERIFIED).

## Security baseline
No third-party requests, no CDN, no remote fonts, no forms that post anywhere, no secrets. Response headers (CSP and others) are not set by this folder: UNKNOWN until a hosting config adds them. `hosting.mjs check` is the proof for what is configured.

## Decisions
### Decision: plain HTML, CSS and JS with no build step
- Options considered: plain static files; a static site generator; a JavaScript framework
- Why: seven mostly static pages need no server or state, and plain files are easy to read, check and host
- Trade-offs: header, nav and footer are repeated in each page by hand; no component reuse
- Revisit when: the page count grows enough that repeated markup causes mistakes

### Decision: system fonts only
- Options considered: system font stacks; a licensed local font file; a remote font service
- Why: no external request, no licence question, no layout shift from font loading
- Trade-offs: the look differs a little between operating systems
- Revisit when: the owner supplies a licensed font file and wants one look everywhere

### Decision: Cloudflare static assets for hosting
- Options considered: Cloudflare static assets; Vercel; Cloudflare with Supabase
- Why: the site is static with no database, and the brief names cloudflare
- Trade-offs: tied to Wrangler config; custom headers need an extra file
- Revisit when: the site needs sign-in, stored data or server code

### Decision: light and dark by swapping tokens
- Options considered: follow the system setting by token swap; a manual theme toggle
- Why: no JavaScript or storage needed, and one set of rules serves both modes
- Trade-offs: the visitor cannot override the system setting
- Revisit when: visitors ask for a toggle
