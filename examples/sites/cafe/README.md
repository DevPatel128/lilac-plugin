<!-- Corner Kiln demo site: README. FICTIONAL SAMPLE brand. Built by following Lilac's website track. -->
# Corner Kiln: demo café and bakery website

A showcase of what Lilac's Website track can produce. **Corner Kiln is a fictional café and bakery, not a real business.** Menu items, prices (sample currency KC), hours, events, address and contact details are placeholder text on example.com / example.test. No reviews, ratings, awards, statistics, health, allergen-safety or sourcing claims appear anywhere; allergens say only "ask the team".

## What is in it

`site/` is a static site in plain HTML, CSS and JavaScript: no build step, no framework, no CDN, no external requests (system fonts, inline SVG art).

- Pages: home, menu (filter by category), our bakes, visit (hours table highlights today), events and workshops, contact / table booking (browser-side validation, then "Demo: nothing was sent"), 404.
- Also: `robots.txt`, `sitemap.xml` (example.com is ASSUMED), `favicon.svg`, Open Graph tags (no `og:image`: no raster source art exists).
- Design: warm paper and kiln colours, serif display type, hand-made feel; light and dark by `prefers-color-scheme`.
- Motion (expressive but accessible): steam rising from a cup, a proving loaf, staggered menu reveal, hover lift, today's-hours pulse, self-drawing underlines, page fade. Only transform, opacity and stroke-dashoffset animate. Content is visible without JavaScript; motion is off under `prefers-reduced-motion: reduce`; a Pause motion button stops the continuous animation.

## Run it

```sh
node product-growth/media/demo-sites/serve.mjs cafe 4174
# open http://127.0.0.1:4174/
```

## How it was made

[BRIEF.md](BRIEF.md) came first. [BUILD-LOG.md](BUILD-LOG.md) records the Planner, Builder, Reviewer and Tester steps and the motion rules. QA, simulated visitors and hosting are pending: the owner runs those tools. `wrangler.jsonc` is the Cloudflare static-assets config; nothing has been deployed.
