# Foundation

Pocket Habits is a FICTIONAL SAMPLE web app (Lilac Web App track example). Status: approval pending owner. Every statement below was read from the files in this folder on 2026-11-21; anything not read is marked UNVERIFIED.

## Languages
HTML (`site/index.html`, `site/404.html`), CSS (`site/app.css`), JavaScript as native ES modules (17 files including tests), JSON (manifest, test fixture). English only. No TypeScript, no transpiler.

## Tools
npm `package.json` (no dependencies; the only script is `node --test`), Node's built-in test runner, Cloudflare Wrangler config (`wrangler.jsonc`, static assets), a localhost static server (`product-growth/media/demo-apps/serve.mjs`). No bundler, no build step, no CDN.

## Architecture
Single-page app: one `index.html`, hash routes (`#/today`, `#/insights`, `#/settings`, `#/help`, `#/support`, `#/about`) switched by a small controller (`app.js`). Pure logic modules with no DOM access (`dates.js`, `stats.js`, `store.js`, `io.js`) are unit-tested in Node; `ui.js`, `charts.js` and `content.js` render DOM and inline SVG; `boot.js` sets the theme before first paint; `sw.js` is the service worker (versioned cache, precached same-origin GETs, update waits for the visitor's "Reload to update"). Dates are calendar keys (`YYYY-MM-DD`) with UTC arithmetic so timezone and DST cannot shift a day. Imports are rebuilt field by field, never copied.

## Folder structure
`site/` is the only folder uploaded (app files, `_headers`, manifest, icons, robots, sitemap, 404). `tests/` unit tests, fixture and control list. `BRIEF.md`, `BUILD-LOG.md`, `README.md`, `FOUNDATION.md`, `BRAND.md`, `UX-REVIEW.md`, `RESULTS.md` sit at the top. `.lilac/` holds visitor tasks, hosting choice and QA output. `brand/` (generated) holds tokens and the brand sheet and is not uploaded.

## Data and storage
All user data lives in the visitor's browser: localStorage key `pocket-habits` (schema version 2, limits 100 habits, 60-character names, 4000 done-days). Corrupt or invalid content is moved to `pocket-habits:backup` and the app starts empty with a message. Export and import are JSON files the visitor owns (256 KB cap). No server, no database, no accounts, no cookies, no analytics.

## Hosting
Cloudflare static assets (Workers) with the code on GitHub, `db: none`. Chosen with `/lilac:hosting` (`hosting.mjs choose`), recorded in `.lilac/hosting.json`. Not deployed; deploying needs an explicit yes from the owner.

## Budgets
Total `site/` under 100 KB (about 83 KB measured at adoption, no images or fonts). Zero third-party requests. Text contrast at least 4.5:1, touch targets at least 44 px, works from 360 to 1440 px, no horizontal scroll. Animation only transform and opacity, 150 to 500 ms. Lighthouse or real-device performance: UNVERIFIED.

## Security baseline
Strict CSP both in `site/_headers` and a meta tag: `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'; object-src 'none'`. No inline script or style, no `innerHTML` (user text goes in with `textContent`), plus `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, a locked Permissions-Policy and COOP/CORP same-origin. Import is validated and rejects prototype-pollution keys. Anyone using the same browser profile can read the data: documented, not mitigated.

## Decisions
### Decision: no framework, plain ES modules
- Options considered: React, Vue or Svelte with a bundler; Preact from a CDN; plain HTML, CSS and ES modules
- Why: the app is six screens and about 40 KB of code; no build step means nothing to break or audit; the strict CSP forbids a CDN; the pure modules run directly in Node tests
- Trade-offs: manual DOM updates (the small `el()` helper), no component ecosystem, more hand-written code if screens multiply
- Revisit when: screens or shared state grow so that manual rendering causes bugs, or a second developer joins and wants components

### Decision: no backend, data in localStorage
- Options considered: backend with accounts and a database (Supabase or D1); IndexedDB; localStorage with JSON export and import
- Why: the brief says private, no sign-up, no tracking; the data is small (limits above); no server means nothing to secure, host or pay for
- Trade-offs: no sync between devices, data is lost if the browser data is cleared without an export, about 5 MB storage ceiling, readable by anyone on the same browser profile
- Revisit when: visitors need sync or backup across devices (then add auth, a database and a privacy review)

### Decision: hash routing in a single page
- Options considered: separate HTML pages; history-API routes with a server fallback; hash routes
- Why: works on any static host and offline with no rewrite rules; the service worker precaches one shell
- Trade-offs: URLs contain `#/`, a skip-link hash must be ignored by the router (fixed), no per-route titles in search results
- Revisit when: the app needs indexable per-screen pages

### Decision: Cloudflare static assets, no database
- Options considered: Cloudflare, Vercel, Cloudflare plus Supabase, Vercel plus Supabase
- Why: a static `site/` with a `_headers` file is enough; `.lilac/hosting.json` records the choice made with `hosting.mjs choose`
- Trade-offs: no server code; a later backend is a new decision
- Revisit when: Decision "no backend" is revisited
