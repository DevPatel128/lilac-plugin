<!-- Biscuit & Bowl demo site: reconstructed brief (Lilac website track, Phase 1). FICTIONAL SAMPLE brand. Reconstructed from the build request and the finished site, not an original document. -->
# Brief: Biscuit & Bowl (fictional sample)

**Audience:** a curious reader of the Lilac demo, and a dog owner browsing a small-brand site.

**Main action:** Choose a plan (pick sample products on the products page and see a sample total).

**Facts (all SAMPLE, invented):**
- Brand "Biscuit & Bowl", an imaginary kitchen-table dog-food shop.
- Six sample products across puppy, adult and senior; bag sizes 2, 5 and 10 kg; prices in sample currency BB$; sample ingredient lists.
- A three-step sample feeding guide with no amounts.
- Contact form validates in the browser; nothing is sent.

**Must not claim:** reviews, ratings, testimonials, stock numbers, health or vet claims, "complete and balanced", regulatory wording, or that the brand is real.

**Tone and references:** plain, warm, short words; kraft-label look (dashed stamp badge, hard offset shadows, serif headings, honey band). Avoid gradients, glass cards and stock stats (see `frontend/skills/anti-ai-slop-ui`).

**Pages:** index, products, how-it-works, ingredients, faq, contact, 404; plus robots.txt, sitemap.xml, favicon.svg.

**Constraints:** static HTML, CSS and JS; no build, no framework, no external requests; works without JavaScript; light and dark mode; WCAG AA contrast; each page under 300 KB; motion level "expressive but accessible" (only transform and opacity animate, reduced-motion respected, pause control for loops, no flashing, no layout shift). Hosting: Cloudflare (static assets Worker).

**Success:** QA tool reports 0 errors; every page returns 200; content readable with JavaScript off; the animated parts work and stop under reduced motion; visitor can reach "Choose a plan" in one click from the home page.
