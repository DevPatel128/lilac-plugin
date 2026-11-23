# Foundation

Still Water is a FICTIONAL SAMPLE studio site built to demonstrate Lilac's website track. This plan was written from the existing code in `site/` and from BRIEF.md. Approval status: pending owner (nothing here has been approved by the human).

## Languages
Plain HTML (7 pages), CSS (1 stylesheet), JavaScript (3 small scripts: `motion.js`, `classes.js`, `contact.js`). No TypeScript, no framework, no transpiling.

## Tools
Cloudflare Wrangler for the static-assets Worker (`wrangler.jsonc`, `assets.directory = ./site`). No package.json, no bundler, no build step. The local preview server is `product-growth/media/demo-sites/serve.mjs` (Node).

## Architecture
A static multi-page site. Every page is a standalone HTML file that links `assets/styles.css` and defers `assets/motion.js` (reveal, parallax, pause control). `classes.js` runs only on the classes page (filter chips for day and level; hides table rows). `contact.js` runs only on the contact page (browser-side validation; nothing is sent). A tiny inline script adds `js` to `<html>` so reveal states exist only when JavaScript runs. Dark mode is `prefers-color-scheme` swapping CSS custom properties. Art is inline SVG.

## Folder structure
`site/` holds the deployable files (7 pages plus `404.html`, `assets/`, `favicon.svg`, `robots.txt`, `sitemap.xml`). Next to it: BRIEF.md, BUILD-LOG.md, README.md, `wrangler.jsonc`, this file, BRAND.md and generated `brand/` (not deployed), plus the QA output folder `.lilac/`.

## Data and storage
All copy is static text in the HTML; the timetable is a static HTML table. No database, no cookies, no local storage, no accounts. The trial form does not send data anywhere (it prints "Demo: nothing was sent"), so no personal data is collected.

## Hosting
Cloudflare static assets, chosen in `.lilac/hosting.json` with `node operations/plugin/scripts/hosting.mjs choose --host cloudflare --db none` (see /lilac:hosting). Not deployed; deployment needs the human's explicit yes. The base URL `https://example.com/still-water/` is ASSUMED.

## Budgets
Each page under 300 KB including assets (BRIEF.md). Measured in BUILD-LOG.md: largest page with assets about 22 KB. Accessibility target WCAG 2.2 AA, tested 360 to 1440 px. No layout shift: only transform and opacity animate.

## Security baseline
No third-party requests: system fonts, inline SVG, no CDN, no analytics, no trackers. No forms post anywhere. No inline event handlers. One tiny inline script (adds the `js` class); a Content-Security-Policy header is UNKNOWN until the host config is written (static assets headers file not created), so it is not claimed.

## Decisions
### Decision: plain HTML, CSS and JavaScript with no build step
- Options considered: plain static files; a static site generator; a JavaScript framework
- Why: seven small pages with one table filter and one form; the brief forbids a build step and a CDN; static files are the simplest thing that works and deploy as-is
- Trade-offs: header, nav and footer are repeated in every page, so a nav change touches 7 files; no components or type checking
- Revisit when: the page count grows past about ten or content needs to come from data

### Decision: system rounded font stack, no web fonts
- Options considered: system stack; self-hosted licensed web font; remote font service
- Why: no network request, no licence question, no layout shift from font loading; the rounded system faces fit the soft brief
- Trade-offs: the look varies by operating system (`ui-rounded` exists on Apple platforms; others fall back to Segoe UI or the system font)
- Revisit when: the owner wants one exact typeface everywhere and holds a licence

### Decision: motion only on transform and opacity, with a reduced-motion kill switch
- Options considered: no motion; transform and opacity only; animate layout properties
- Why: the brief asks for expressive but accessible motion; transform and opacity avoid layout shift; reduced motion removes all of it
- Trade-offs: effects such as height changes are not possible; the long loop needs a Pause/Play control
- Revisit when: a design needs motion that cannot be done with transform and opacity

### Decision: Cloudflare static assets, no database
- Options considered: Cloudflare static assets; Vercel; Cloudflare with Supabase; none (local only)
- Why: the brief names Cloudflare; the site is fully static and the form stores nothing
- Trade-offs: the form cannot collect real requests; adding that needs a backend and a privacy review
- Revisit when: the owner wants real bookings
