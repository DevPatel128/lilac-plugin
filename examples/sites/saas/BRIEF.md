# Brief: Tasklane demo site

Written before any page. FICTIONAL product: Tasklane does not exist. Built to demo Lilac's website track.

- **Audience:** a curious reader of the Lilac demo: a small-team lead or developer who wants to see what a clear, honest SaaS landing site looks like when built with proof at each step.
- **Main action:** Request a demo (a form that validates in the browser and sends nothing).
- **Facts (SAMPLE):** product name Tasklane (invented); three sample tiers Solo, Team, Business with SAMPLE prices (Solo 0, Team 9 monthly / 7 yearly per person, Business 18 monthly / 15 yearly per person, USD); feature set is a design sketch of a project-management tool (boards, lists, timeline view, comments, templates, integrations as a plain statement of intent); three illustrative scenarios (small studio, support team, volunteer committee). Every item is invented sample text.
- **Must not claim:** real customers, logos, testimonials, ratings, user counts, statistics, awards, uptime, security certifications (SOC, ISO, GDPR badges), integrations with real named products, real company address, real prices, "trusted by", "#1", speed or savings numbers.
- **Tone and references (moods, no brands):**
  1. A printed engineering drawing: hard grid lines, square corners, one signal colour on near-black ink.
  2. A transit map: bold lane colours, clear stops, nothing decorative that is not also information.
  3. A calm field notebook: generous white space, mono labels, plain sentences.
  Voice: direct, short sentences, says "sample" and "fictional" where relevant.
- **Pages:** home (animated kanban mock), features, pricing (monthly/yearly toggle), how teams might use it (3 labelled examples), FAQ, request a demo, 404, robots.txt, sitemap.xml, favicon.svg, og tags.
- **Constraints:** plain HTML/CSS/JS in `site/`; no build step, no CDN, no external requests, system fonts only; light and dark; WCAG AA; 360-1440 px; skip link, landmarks, visible focus; nav works without JS; every page under 300 KB; content visible without JS (reveal states added by JS under `.js`); animate only transform and opacity; all motion off or instant under `prefers-reduced-motion: reduce`; no flashing; continuous animation over 5 s has a pause/play control; no layout shift. Motion level: **expressive but accessible**.
- **Hosting:** cloudflare (static assets Worker; not deployed, ASSUMED example.com URLs in canonical, sitemap and og).
- **Success:** a visitor can understand the product idea in the hero, compare the three sample tiers in both billing modes with and without JS, read three examples, and submit the demo form to see validation and the "nothing was sent" message; every page loads, every internal link resolves, and the checks in BUILD-LOG.md are recorded with exact output.
