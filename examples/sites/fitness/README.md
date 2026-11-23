<!-- Still Water demo site: README. FICTIONAL SAMPLE studio. Built by following Lilac's website track. -->
# Still Water: demo yoga and movement studio website

**Still Water is a fictional sample studio, not a real business.** Teacher names are SAMPLE, prices are sample prices, times and class names are invented. There are no real teachers, addresses, brands, reviews, ratings, awards, member counts, or health, medical, wellness-outcome or weight-loss claims.

## What is in it

`site/` is a static site in plain HTML, CSS and JavaScript: no build step, no framework, no external requests (system fonts, inline SVG).

- Pages: home, classes (weekly timetable table, filter by day and level), teachers (3 SAMPLE bios), memberships (3 sample plans), first-visit guide, contact / trial-class form (browser-side validation, then "Demo: nothing was sent"), `404.html`.
- Also: `robots.txt`, `sitemap.xml` (example.com is a placeholder, ASSUMED), `favicon.svg`, Open Graph tags (no `og:image`: no raster art exists).
- Design: muted earthy blue and sand, soft gradients, rounded forms, system rounded type; light and dark by `prefers-color-scheme`.
- Motion (expressive but accessible): breathing circle with Pause/Play and the label "Follow along" (visual rhythm only), ripple rings on logo hover, timetable rows slide in on filter change, soft parallax on layered wave SVGs, staggered scroll reveal, gentle button press ripple. Only `transform` and `opacity` animate. Reveal states exist only under `.js` on `<html>`, so content is visible without JavaScript. Everything is off under `prefers-reduced-motion: reduce` (the circle is a static shape).
- Without JavaScript: all pages, nav and the whole timetable are readable. Filters and the form check need JavaScript (the form says so).

## Run it

```sh
node product-growth/media/demo-sites/serve.mjs fitness 4177
# open http://127.0.0.1:4177/
```

Hosting target: Cloudflare static assets (`wrangler.jsonc`). Not deployed.

## How it was made

See [BRIEF.md](BRIEF.md) (written first) and [BUILD-LOG.md](BUILD-LOG.md): Planner, Builder, Reviewer, Tester, Motion. Gate results are in [RESULTS.md](RESULTS.md); UX findings in [UX-REVIEW.md](UX-REVIEW.md); tool problems in [TOOL-ISSUES.md](TOOL-ISSUES.md). Foundation approval is pending the owner.
