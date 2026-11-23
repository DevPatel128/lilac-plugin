# Tasklane demo site

**Tasklane is FICTIONAL.** There is no company, product, customer or price. This site was built to demo Lilac's Website track: a landing site for an invented project-management SaaS. All prices are SAMPLE, all scenarios are illustrative examples, and the demo form sends nothing.

- Brief: [BRIEF.md](BRIEF.md). Process and evidence: [BUILD-LOG.md](BUILD-LOG.md).
- Site: `site/` (plain HTML, CSS and JS; no build step, no CDN, system fonts only).
- Pages: `index`, `features`, `pricing`, `how-teams-use-it`, `faq`, `demo`, `404`, plus `robots.txt`, `sitemap.xml`, `favicon.svg`.
- Hosting: Cloudflare static assets (`wrangler.jsonc`). Not deployed; deploying is the human's decision. The `example.com` URLs in canonical, og and sitemap are ASSUMED placeholders.

## Run locally

```
node product-growth/media/demo-sites/serve.mjs saas 4175
```

Then open http://127.0.0.1:4175/.

## Motion (expressive but accessible)

Only `transform` and `opacity` animate. Content is visible without JavaScript; reveal states exist only under the `.js` class. With `prefers-reduced-motion: reduce` all motion is off and the board shows a static, readable arrangement.

| Where | What | Control |
|---|---|---|
| Home hero | Board mock: cards move between To do, Doing, Done on a loop | Pause/Play button |
| Feature cards, steps, tiers, FAQ | Reveal on scroll, staggered | none (one-shot) |
| Top of page | Progress bar fills as you scroll (no number) | none |
| Pricing | Monthly/yearly switch slides; prices cross-fade. Without JS both prices show as text | switch |
| Buttons | Press feedback (shift down, shadow drops) | none |
| Nav | Underline glides to hovered/focused link | none |

## Honest limits

No real brands, logos, customers, testimonials, ratings, statistics, awards, uptime or security-certification claims. No og:image (no source art; ASSUMED). See BUILD-LOG.md for what is UNVERIFIED.
