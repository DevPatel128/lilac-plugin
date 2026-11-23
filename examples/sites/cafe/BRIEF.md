<!-- Corner Kiln demo site: project brief, written before any code. FICTIONAL SAMPLE brand. -->
# Brief: Corner Kiln (fictional neighbourhood café and bakery)

**Audience:** a curious reader of the Lilac demo, acting as a hungry neighbour deciding whether to drop in and what to order.

**Main action:** see the sample menu, then book a table (demo form: nothing is sent).

**Facts (SAMPLE):** every fact below is invented placeholder text.
- Name: Corner Kiln. A café and bakery with a small kiln-style oven in the window.
- Sample currency "KC" (kiln coins). Twelve sample menu items in four categories: coffee, bakes, savoury, cold.
- Sample hours: closed Monday; Tuesday to Friday 07:00 to 15:00; Saturday and Sunday 08:00 to 16:00.
- Three sample events and workshops, with no dates (dates would be invented).
- Address, phone and email are placeholders on example.com / example.test.

**Must not claim:** anything about health, allergen safety, ingredient sourcing, or ethics; no reviews, ratings, awards, press, statistics, years in business, real people, real places or real brands. Allergens: only "ask the team".

**Tone and references (moods, no real brands):**
1. A letterpress bakery menu card: warm paper, one hot ink colour, serif display type.
2. A hand-drawn shop-window sign: slightly wobbly lines, underlines drawn by pen.
3. A quiet early-morning kitchen: steam, flour dust, slow breathing dough, nothing shouting.
Voice: short, friendly, plain; says "sample" where it is invented.

**Pages:** home, menu (filter by category), our bakes, visit (hours table highlights today), events and workshops, contact / table booking, 404. Plus robots.txt, sitemap.xml, favicon.svg, og tags.

**Constraints:** plain HTML/CSS/JS in `site/`, no build step, no CDN, no external requests, system fonts only, inline SVG art. Light and dark, WCAG AA, responsive 360 to 1440 px, skip link, landmarks, visible focus, mobile nav that works without JS, each page under 300 KB. Content visible without JavaScript. Motion level: **expressive but accessible**: transform, opacity and stroke-dashoffset only; off under `prefers-reduced-motion: reduce`; no flashing; pause/play control for continuous animation; no layout shift.

**Hosting:** cloudflare (static assets Worker, same shape as the other demo sites). Not deployed by the builder.

**Success:** a visitor can find the menu, filter it, see whether the café is open today, and submit the demo booking form with clear errors and a clear "nothing was sent" message; every page loads, every internal link resolves, no console errors, motion visible and stoppable.
