<!-- Still Water demo site: brief written BEFORE building. FICTIONAL SAMPLE studio. -->
# Brief: Still Water (fictional yoga and movement studio)

**Audience:** a curious adult who has never been to this studio and wants to see what a week looks like, who teaches, what it costs, and what the first visit involves. Also: a Lilac reader looking at an expressive-but-accessible motion example.

**Main action:** book a sample trial class (contact page form). Secondary: read the weekly timetable and filter it by day and level.

**Facts (SAMPLE):** everything is invented. Studio, class names, three teachers (names are SAMPLE), timetable times, three membership plans with sample prices (shown with a "$" and the word sample), a first-visit guide. Base URL `https://example.com/still-water/` is ASSUMED.

**Must not claim:** any health, medical or wellness outcome, weight loss, stress relief, "improves / cures / reduces / heals"; no reviews, ratings, awards, member counts, credentials, real teachers, real addresses or real brands. The studio is fictional and the footer and README say so.

**Tone and references (moods, no brand names):**
1. A quiet tide pool at low light: soft blue-greens over warm sand, nothing sharp.
2. A hand-printed studio timetable on thick paper: plain, legible, generous margins.
3. A slow wave seen from a pier: layered shapes that drift a little when you move, never fast.
Voice: plain, warm, short sentences. Large friendly type. Rounded forms, soft gradients, airy spacing. Palette: muted earthy blue and sand (deliberately not lavender).

**Pages:** home, classes (timetable table + day/level filters), teachers, memberships, first-visit guide, contact / trial-class form, 404; plus robots.txt, sitemap.xml, favicon.svg, og tags.

**Constraints:** plain HTML/CSS/JS in `site/`, no build step, no CDN, system fonts, inline SVG art, each page under 300 KB, light and dark, WCAG AA, 360 to 1440 px, skip link, landmarks, visible focus, nav works without JavaScript. Motion level: **expressive but accessible**. Animate only transform and opacity. Content visible without JS (reveal states live under `.js` on `<html>`). All motion off or instant under `prefers-reduced-motion: reduce`. No flashing. Continuous animation longer than 5 s has a pause/play control. No layout shift. No network at runtime.

**Hosting:** cloudflare (static assets Worker, `wrangler.jsonc`). Not deployed.

**Success:** a visitor can find a class by day and level, see teachers and plans, and submit the demo trial form with validation; every page loads, every internal link resolves, nothing hidden without JS, motion respects the reduced-motion setting, and no claim in the copy lacks a source (all copy is SAMPLE).
