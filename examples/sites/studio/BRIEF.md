<!-- Atelier Nord demo site: BRIEF. FICTIONAL SAMPLE studio. Written before any code. -->
# Brief: Atelier Nord (fictional sample)

## Audience
A curious reader of the Lilac demo, standing in for a person who might commission a house or an interior and wants to judge a studio by its drawings.

## Main action
Send an enquiry (demo form: it validates, then says nothing was sent). Secondary: look through the six sample projects.

## Facts (SAMPLE)
- Studio name Atelier Nord, architecture and interiors. Fictional.
- Six sample projects: Courtyard House, Ferry Hall Library, Loft Reading Room, Hillside Studio, Market Pavilion, Tea Room. All invented; categories Residential, Public, Interiors.
- One sample detail page (Courtyard House) with a brief, drawings, materials and a facts list, all SAMPLE text.
- Five-step process: Listen, Measure, Draw, Test, Hand over.
- Two sample journal posts.
- ASSUMED: base URL `https://example.com/atelier-nord/` for canonical, og:url and sitemap (placeholder). ASSUMED: no og:image (no raster art exists).

## Must not claim
Real people, clients, buildings, addresses, phone numbers, emails, awards, press, licences, professional registrations, fees, timelines, areas as real, testimonials, project counts or years of experience. Every name and figure is marked SAMPLE or fictional.

## Tone and references
No real firms are named; three reference moods only:
1. A printed monograph: big serif titles, small mono sheet labels, lots of paper.
2. A drawing office sheet: thin ink lines, hatched walls, grid bubbles, one red correction pencil.
3. A quiet gallery wall: asymmetric placement, long silences between items, no decoration that is not a drawing.
Voice: plain, short, dry. No superlatives.

## Pages
Home, Projects (grid and category filter), Project detail (sample), Approach, Journal (2 posts), Enquire (form), 404; plus robots.txt, sitemap.xml, favicon.svg.

## Constraints
Plain HTML/CSS/JS in `site/`, no build step, no CDN, system fonts only, no photographs (every project is an inline-SVG architectural drawing), pages under 300 KB, light and dark, WCAG AA, 360 to 1440 px, skip link, landmarks, visible focus, nav works without JS, content visible without JS. Motion level: **expressive but accessible**: animate only transform, opacity, clip-path, stroke-dashoffset; reveal states only under `.js` on `<html>`; all motion off or instant under `prefers-reduced-motion: reduce`; no flashing; no continuous animation; no scroll hijacking.

## Hosting
Cloudflare (static assets Worker, `wrangler.jsonc`). Nothing deployed.

## Success
A reader can open the home page, see that the drawings are the work, filter the projects, open the sample project, find the process, and submit the demo form with a clear "nothing was sent" result, with no layout shift, in light or dark, with and without JavaScript, and with motion off.
