# Foundation

Corner Kiln is a fictional demo cafe and bakery site (see [BRIEF.md](BRIEF.md)). Every fact on it is invented sample text. This file records what the existing code does, so the owner can approve it. Approval is pending owner.

## Languages
Found by file type: HTML (7 files), JavaScript (1 file, `site/assets/site.js`), CSS (1 file, `site/assets/styles.css`). No TypeScript, no server language.

## Tools
Found by config files: Cloudflare Wrangler (`wrangler.jsonc`, static assets). No package.json, no bundler, no framework, no test runner in this folder. Checks come from the Lilac plugin scripts (`qa.mjs`, `qa-browser.mjs`, `controls-test.mjs`, `persona-test.mjs`, `techdocs.mjs`).

## Architecture
One static site: seven hand-written HTML pages share `site/assets/styles.css` and `site/assets/site.js`. There is no server, no database and no build step; the host sends the files as they are. All art is inline SVG. JavaScript only adds behaviour on top of content that is already readable without it: scroll reveal, menu category filter, highlight of today's hours row, a pause/play control for continuous animation, and browser-side validation of the demo booking form. Start states for animation are gated on a `.js` class on `<html>`, so a visitor without script sees everything.

## Folder structure
Top level: `BRIEF.md`, `BUILD-LOG.md`, `README.md`, `RESULTS.md`, `wrangler.jsonc`, `site/` (the published files), `brand/` (generated tokens), `architecture/`, `governance-learning/`, `product-growth/` (generated docs and showcase text). `wrangler.jsonc` serves only `./site`.

## Data and storage
Content lives in the HTML files. No user data is collected or stored on a server. The booking form never sends anything: `site.js` validates in the browser and shows "Demo: nothing was sent." The only browser storage is `sessionStorage` key `ck-paused` (the pause-motion choice), wrapped in try/catch so a blocked store changes nothing.

## Hosting
Cloudflare static-assets Worker, no database, chosen through `node operations/plugin/scripts/hosting.mjs choose` (see `.lilac/hosting.json` and /lilac:hosting). Code is meant to live on GitHub. Not deployed; deployment needs the owner's yes.

## Budgets
Each page under 300 KB (brief constraint); measured pages are about 4 to 8 KB of HTML. Accessibility target: WCAG 2.2 AA, 44 px minimum touch targets, responsive from 360 to 1440 px. No external requests, so no third-party load. Not measured here: real-device speed, Lighthouse scores (UNVERIFIED).

## Security baseline
No third-party requests, no CDN, no remote fonts, no cookies, no analytics, no forms that transmit data. No secrets in the repository. No CSP or security headers are set in `wrangler.jsonc` (the Worker config only declares the assets folder): UNVERIFIED whether the host adds any; adding a Content-Security-Policy header is a follow-up for the owner.

## Decisions
### Decision: plain HTML, CSS and JavaScript, no framework or build step
- Options considered: plain static files; a static site generator; a JavaScript framework.
- Why: seven small pages with a little behaviour; the brief says no build step and no CDN; fewer moving parts to check and host.
- Trade-offs: header, nav and footer are repeated in each page by hand (a change must be made in seven files); no component reuse.
- Revisit when: the page count grows or content must come from data.

### Decision: system fonts only
- Options considered: system font stacks; self-hosted licensed web fonts; a font CDN.
- Why: no extra requests, no licence question, fastest first paint; a serif stack gives the letterpress-menu mood.
- Trade-offs: the exact typeface differs by device.
- Revisit when: the owner supplies a licensed font file.

### Decision: Cloudflare static assets, no database
- Options considered: Cloudflare static assets; Vercel; Cloudflare plus Supabase; Vercel plus Supabase.
- Why: the site is fully static and the brief names Cloudflare; no data to store.
- Trade-offs: a real booking would need a server or form service later.
- Revisit when: bookings must actually be received.

### Decision: colours via CSS custom properties, dark mode by `prefers-color-scheme`
- Options considered: custom properties swapped in a media query; a manual theme toggle; separate stylesheets.
- Why: dark mode swaps tokens only, no JavaScript, no flash.
- Trade-offs: no visitor override of the system theme.
- Revisit when: visitors ask for a toggle.
