<!-- Atelier Nord demo site: README. FICTIONAL SAMPLE studio. -->
# Atelier Nord: demo architecture and interiors portfolio

**Atelier Nord is a fictional studio, not a real firm.** Projects, names, places, materials, areas and all copy are SAMPLE text. No real people, clients, buildings, addresses, awards, press, licences or professional registrations are claimed. No photographs: each project is an inline-SVG architectural drawing (plan, elevation or section).

## What is in it

`site/` is plain HTML, CSS and JavaScript: no build step, no framework, no external requests, system fonts only.

- Pages: home, projects (six sample projects, category filter), one sample project page, approach (five steps), journal (two sample posts), enquire (validates in the browser; "Demo: nothing was sent"), 404. Also `robots.txt`, `sitemap.xml`, `favicon.svg`. `example.com` in canonical, og:url and sitemap is a placeholder (ASSUMED). No og:image.
- Look: editorial serif headlines, 12-column grid, near-monochrome with one red accent, light and dark by `prefers-color-scheme`.
- Motion (expressive but accessible): drawings draw themselves (stroke-dashoffset), clip-path reveals, gentle hero parallax (transform), card hover shift and caption, decorative index counter, animated link underline (transform), page-load wipe (clip-path). Only transform, opacity, clip-path and stroke-dashoffset animate. Reveal states exist only under `.js`; without JavaScript everything is visible and drawings are fully drawn. `prefers-reduced-motion: reduce` turns motion off. There is no continuous animation, so no pause control is needed.
- The nav, all reading and all drawings work without JavaScript; the filter and form check need it.

## Run it

```sh
node product-growth/media/demo-sites/serve.mjs studio 4176
# open http://127.0.0.1:4176/
```

## How it was made

[BRIEF.md](BRIEF.md) was written first; [BUILD-LOG.md](BUILD-LOG.md) records Planner, Builder, Reviewer, Tester and Motion. QA, simulated visitors and hosting results are in BUILD-LOG.md and RESULTS.md. Hosting choice: Cloudflare static assets (`wrangler.jsonc`); nothing has been deployed.
