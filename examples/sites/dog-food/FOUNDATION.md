# Foundation

Biscuit & Bowl is a fictional sample dog-food shop site (7 pages). This file records what the site is built with and why. It was drafted from the existing code with `foundation.mjs adopt` and completed from the code and `BRIEF.md`. Approval status is NONE: only the owner approves.

## Languages
HTML (7 pages in `site/`), CSS (1 file, `site/assets/styles.css`), JavaScript (3 files in `site/assets/`: `plan.js`, `contact.js`, `motion.js`). No TypeScript, no framework, no build step. Counts come from the `adopt` scan of file types.

## Tools
Cloudflare Wrangler (`wrangler.jsonc`, static-assets Worker, directory `./site`). Lilac scripts for checks: `foundation.mjs`, `qa.mjs`, `qa-browser.mjs`, `hosting.mjs`, `controls-test.mjs`, `persona-test.mjs`, `techdocs.mjs`. No package.json, no bundler, no linter configured.

## Architecture
Static pages: the host sends each `.html` file as written. Shared look comes from one stylesheet. Three small scripts add behaviour and the pages work without them (JavaScript-only controls carry `.js-only` and appear only after the page sets a `js` class):
- `plan.js`: filter products by life stage, pick items, show a sample total (no storage, no network).
- `contact.js`: validate the contact form in the browser and show a demo message; nothing is sent.
- `motion.js`: scroll reveal, nav underline, pause button for looping animations; skipped under reduced motion.
There is no server, no API and no third-party script.

## Folder structure
`site/` is the deployed folder (pages, `assets/`, `robots.txt`, `sitemap.xml`, `favicon.svg`). Project docs sit at the top: `BRIEF.md`, `BUILD-LOG.md`, `FOUNDATION.md`, `BRAND.md`, `README.md`, `RESULTS.md`, `UX-REVIEW.md`. `brand/` holds generated tokens. `architecture/`, `governance-learning/` and `product-growth/` hold generated techdocs output. `.lilac/` holds hosting choice and QA artefacts.

## Data and storage
Content is written in the HTML. The six sample products are invented text. There is no database, no cookies, no localStorage; the plan summary lives only in the open page. The contact form stores and sends nothing.

## Hosting
Cloudflare static assets Worker, no database, code on GitHub. Choice recorded in `.lilac/hosting.json` with `hosting.mjs choose` (see `/lilac:hosting`). Nothing is deployed; the deploy plan is not run.

## Budgets
- Each page under 300 KB including CSS, scripts and favicon (BRIEF constraint). Measured in BUILD-LOG: largest page 18,899 bytes of page plus shared files.
- WCAG AA: text 4.5:1, borders and focus 3:1; touch targets at least 44 px.
- No layout shift: motion uses only transform and opacity.
- Zero external requests.

## Security baseline
No third-party requests, no remote fonts, no forms that send data, no inline event handlers. Cookies and storage unused. Security headers or a CSP are NOT set: static assets Worker config has no headers file. UNVERIFIED whether the host adds any; `qa.mjs` security checks are the only evidence.

## Decisions
### Decision: plain HTML, CSS and JavaScript, no build step
- Options considered: plain static files; a static-site generator; a JavaScript framework.
- Why: seven mostly static pages; the brief says no build and no framework; fewest moving parts to check.
- Trade-offs: header, nav and footer are repeated in every page, so a change means editing seven files.
- Revisit when: the page count grows enough that repeated markup causes mistakes, or content comes from data.

### Decision: system font stacks only
- Options considered: system stacks; self-hosted licensed fonts; remote web fonts.
- Why: no external requests, no licence question, no download cost.
- Trade-offs: the exact look varies by device.
- Revisit when: the owner supplies a licensed font file and a brand need that system fonts cannot meet.

### Decision: Cloudflare static assets Worker, no database
- Options considered: Cloudflare; Vercel; Cloudflare or Vercel with Supabase.
- Why: the site has no server logic or stored data; the brief names Cloudflare.
- Trade-offs: no form handling; the contact form cannot send messages.
- Revisit when: the contact form must deliver real messages or the shop needs accounts or orders.

### Decision: keep brand tokens as site-local custom properties
- Options considered: link `brand/tokens.css` from the site; mirror the token values in `styles.css`.
- Why: the deployed folder is `site/` only, and `brand/` sits outside it.
- Trade-offs: two copies of the values to keep equal; `foundation.mjs drift` and check catch mismatch in typed colours, fonts and durations, not a stale mirror.
- Revisit when: tokens are copied into `site/` by a build step.
