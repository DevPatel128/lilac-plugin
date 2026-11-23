<!-- Biscuit & Bowl demo site: build log of the Lilac loop (Planner, Builder, Reviewer, Tester, Docs). FICTIONAL SAMPLE brand. -->
# Build log

Followed: `product-types/Website/README.md`, `Phase 1.md`, `product-types/skills/website-phase-1/SKILL.md`, `frontend/skills/anti-ai-slop-ui/SKILL.md`, and `operations/plugin/site/AGENTS.md` (no invented facts, evidence for checks). One agent played every role in turn; the roles were not separate sessions.

## 1. Planner

Facts (from the request):
- Fictional brand "Biscuit & Bowl", static HTML/CSS/JS, no build, no external requests.
- Pages: index, products, how-it-works, ingredients, faq, contact, 404, plus robots.txt, sitemap.xml, favicon.svg.
- Six sample products; filter by life stage; selected-items summary; clear button; degrade without JS.
- Contact form validates in the browser, nothing sent.
- Rules: no reviews, ratings, testimonials, stock numbers, health, vet, "complete and balanced" or regulatory claims.

Phase 1 framing: visitor task = "look at the sample products and put together a plan". Primary action = Choose a plan. Synthetic data only.

Anti-slop premise (named, per the skill): audience = a curious reader of the demo; visual premise = a small kitchen-table dog-food shop whose packaging looks like a kraft label. Distinctive choices: dashed "stamp" badge, hard offset shadows, serif headings over rounded sans, honey band as the one loud section. Avoided: gradients, glass cards, stock stats.

Assumptions:
- ASSUMED: base URL `https://example.com/biscuit-and-bowl/` for canonical, og:url and sitemap (placeholder, no real domain).
- ASSUMED: sample currency "BB$"; bag sizes 2/5/10 kg; all six products, names, prices and ingredient lists are invented sample text.
- ASSUMED: no `og:image`, because a social image would need a raster file and no source art exists.
- ASSUMED: no feeding amounts given, since any numbers would be an unsupported claim.

## 2. Builder

Wrote the files in `site/` (7 pages, `assets/styles.css`, `assets/plan.js`, `assets/contact.js`, `favicon.svg`, `robots.txt`, `sitemap.xml`). Pages were emitted from a throwaway script kept outside the repo so the header, nav and footer are identical on every page; the output is plain static files.
- Tokens as CSS custom properties; dark mode swaps tokens only.
- Nav is a plain wrapping list (no JS, no menu toggle). Skip link, landmarks (`header`, `nav`, `main`, `footer`), `aria-current`, `aria-pressed` on chips and add buttons, `aria-live` on count and plan, labelled form fields with error text tied by `aria-describedby`.
- JS-only controls carry `.js-only` and are shown only after a one-line script adds `js` to `<html>`.
- Footer on every page states the brand is fictional.

## 3. Reviewer (read-through checklist)

| Check | Finding | Fix |
|---|---|---|
| Invented facts, claims, reviews | Scanned copy: none found. Feeding guide step 3 mentions mixing foods over about a week as general practice | Labelled as sample text and told readers to ask their vet |
| Contrast (computed from tokens, WCAG relative luminance) | Light: ink/bg 14.78, muted/bg 7.47, accent/bg 5.87, button 6.14, input border 4.54. Dark: ink/bg 15.16, muted/bg 9.40, accent/bg 8.13, button 8.13, input border 4.89. All at or above 4.5 (3 for borders) | none needed |
| Dead markup | Step icons on how-it-works were generated but hidden by CSS | Removed icons and the CSS rule |
| CSS clutter | Two unused `.js-only` selectors | Removed |
| No-JS contact form | Native validation cannot be reached without JS and there is no backend | Form is `.js-only`; a note explains it |
| og:image | Absent | Left absent, recorded as ASSUMED above |
| Not checked | Screen reader pass, real-device touch, Windows/Firefox/Safari rendering | UNVERIFIED |

## 4. Tester

Commands run from `product-growth/media/demo-site/site`. Server: `python3 -m http.server 4173` (background).

Status codes (`curl -s -o /dev/null -w '%{http_code}' http://localhost:4173/<page>`), final run after the last edit:

```
index.html 200; products.html 200; how-it-works.html 200; ingredients.html 200; faq.html 200; contact.html 200; 404.html 200
robots.txt 200; sitemap.xml 200; favicon.svg 200; assets/styles.css 200; assets/plan.js 200; assets/contact.js 200
```

Link and meta check (small Python script over every `href`/`src` and `#anchor`; also title, description, canonical, og:title, og:description, og:url, and any non-example.com `http(s)` URL):

```
link/meta problems: 0
```

Page weight (`du -k` per file; per page = html + styles.css 12 + favicon 4 + page script 4 where used):
index 8+12+4 = 24 KB; products 8+12+4+4 = 28 KB; how-it-works 4+12+4 = 20 KB; ingredients 20 KB; faq 20 KB; contact 4+12+4+4 = 24 KB; 404 20 KB. `du -k` rounds up to 4 KB blocks; exact bytes of page+css+favicon+script: 14323, 18899, 12595, 12768, 12684, 14643, 11724. All far under 300 KB.

Browser checks in the in-app browser (JavaScript on):
- Products: clicking Puppy gave `Showing 2 of 6 products.`; adding Pup Crumble and Field Bowl gave 2 plan rows and total `BB$ 49.00`; Clear gave 0 rows, total `BB$ 0.00`.
- Horizontal overflow at 360 px (`scrollWidth - clientWidth`): 0 on all seven pages.
- Home at 360 px (dark scheme) rendered and was inspected by screenshot.

Not run: 768 and 1280 px visual inspection, the contact form submit path, the no-JS rendering in a real browser, keyboard walk-through, Lighthouse. Those rows are UNVERIFIED.

## 5. Docs

`node kit/operations/scripts/techdocs.mjs product-growth/media/demo-site` wrote, inside `demo-site/`:

```
techdocs: wrote architecture/TECH-STACK.md
techdocs: wrote governance-learning/INTERVIEW-PREP.md
techdocs: wrote product-growth/SHOWCASE.md
```

`--check` ended `techdocs: 0 parts, 2 languages, 0 problem(s)` with one warning: SHOWCASE.md still has `[YOUR ...]` placeholders (intentional: they ask for measured numbers). The generator reports 0 parts, so the TECH-STACK content is thin. The generated files stay in these sub-folders; nothing was moved.

## Motion

Added after the owner saw no motion. Level: expressive but accessible. Files touched: `site/assets/styles.css` (motion block at the end), new `site/assets/motion.js`, `site/assets/plan.js`, the home and how-it-works pages, and a `motion.js` script tag on every page.

What moves and why:
- Page load: body fades in; hero text (and each page heading) rises in a stagger; the bowl art pops in. Gives the first screen a start.
- Home bowl: five kibble pieces bounce in turn (SVG groups, translateY loop). Why: the one illustration should feel alive.
- How it works: six paw prints appear in turn, left to right (opacity and translateY loop). Why: it shows the "steps" idea as a walk.
- Scroll reveal: sections, cards, steps and form fade up once via IntersectionObserver, with a short sibling stagger.
- Hover and press: buttons, chips, cards and the brand paw lift or press using transform; the hard shadow switches instantly (never transitioned).
- Nav: one underline bar glides to the hovered or focused link and back to the current page (translate and scaleX).
- Products: filtering fades out items that leave and pops in items that arrive. Plan summary: new rows slide in, the total counts to its new value in 450 ms, then pulses.
- Page leave: a short fade before navigating to another page of the site.

Rules kept:
- Only transform and opacity are animated or transitioned. The total's count is a text update, not a CSS animation.
- No JavaScript: the inline script that sets `js` on `<html>` is the only gate. Hidden start states exist only on `.rv`, a class `motion.js` adds itself; plain CSS never hides content. Entrance animations use `backwards` fill so the resting style is the normal one.
- Loops (kibble, paws) run longer than 5 s, so each page has a visible "Pause animation" / "Play animation" button (`data-pause`).
- No flashing: the fastest change is a 0.12 s press; loops fade slowly. No layout shift: moving parts are transforms or opacity, the total uses tabular numbers.
- Colors unchanged, so the recorded contrast figures still apply; the nav bar is decoration.

Reduced motion (`prefers-reduced-motion: reduce`): a CSS block sets `animation:none` and `transition:none` on everything, forces `.rv` visible, and hides the pause buttons; `motion.js` returns before adding reveal, nav bar and leave fade; `plan.js` filters and updates the total instantly. Result is the static site.

Verification (in-app browser on `node product-growth/media/demo-sites/serve.mjs dog-food 4183`, port 4173 was held by an older server):
- All seven pages and `assets/motion.js`, `plan.js`, `styles.css` returned 200; per-page HTML is 2.5 to 7.5 KB; with CSS and scripts every page is far below 300 KB.
- Raw HTML (curl, no JS): home headline, picks and band text, the three how-it-works steps and all six products are present; no `rv` class is in any served HTML.
- Browser, JS on: products Puppy filter gave "Showing 2 of 6 products."; two adds gave 2 rows (only the new row had `slide`) and total `BB$ 49.00`; no horizontal overflow on home and products; kibble animation `hop` ran with 5 groups; paw animation `step` ran and switched to `paused` when the button was pressed (label became "Play animation").
- Found and fixed: the count-up stayed mid-value when frames were throttled; a 520 ms timer now sets the exact final value.
- Console: no errors from the site (one 404 came from the older server on 4173).
- NOT verified: `prefers-reduced-motion` in a real browser (read from the CSS and JS only), visual smoothness by eye, dark-mode look of the nav bar, touch devices, QA tool re-run (owner re-runs it). The page-leave fade was not exercised.

## QA

Run 2026-11-21 by the Tester role with `node operations/plugin/scripts/qa.mjs product-growth/media/demo-site` (exit 0):

```text
qa: 0 error(s), 0 warning(s), 0 unverified
```

Seven pages checked (basics, headings, alt text, internal links and anchors, form labels, contrast, motion, weight, external requests, security, SEO basics).

Real-browser pass (in-app browser, localhost): home and products at 375 px and desktop, no console errors, no horizontal scroll at 375 px, the Senior filter showed "2 of 6 products", Add to plan produced a plan with a sample total, Clear plan was present.

What this does NOT prove: 768 px layout, keyboard-only walk-through, a real phone, a no-JavaScript render, the contact form submit, copy quality and brand fit. Canonical and sitemap URLs use the placeholder example.com (ASSUMED) and must be replaced when a domain exists. No og:image.

## Hosting

Choice recorded with `node operations/plugin/scripts/hosting.mjs choose --host cloudflare --db none --project product-growth/media/demo-site`: code on GitHub, host Cloudflare (static assets Worker, `wrangler.jsonc`), no database. `hosting.mjs check` reported 0 problems. `deploy-plan` printed the commands (`npx wrangler login`, `npx wrangler deploy`) and the line "Needs your explicit approval before you run any of this". Nothing was deployed.

## QA (gate run 2026-11-22)

```text
qa: 0 error(s), 0 warning(s), 0 unverified
qa-browser: 0 error(s), 1 warning(s), 3 unverified
```
Warning: `warn  [focus-order] focus jumps backwards on the page to button#clear "Clear plan"` (see TOOL-ISSUES.md). Screenshots in `.lilac/qa/` for index, products and contact at 360, 768 and 1280 were read; no cut-off text or overlap seen. Fixes this run: brand link 44 px tall; contact error summary; plan status line.
```text
controls-test: 108 controls, 0 dead, 0 broken, 0 placeholder, 0 unreachable (100% operable)
techdocs: 2 parts, 3 languages, 0 problem(s)
```

## Simulated visitors

Simulated visitors, not real people.
```text
persona-test: 30 simulated visitors, 97% tasks completed, 1 failure group(s)
```
Command: `persona-test.mjs <folder> --visitors 30 --seed 7`. First run found a real problem (contact form hidden without JavaScript); fixed, re-run. Remaining group: no-JS visitor `no visible confirmation after submitting the form` (4 sessions), accepted: static site, no backend (RESULTS.md).

## Hosting

```text
hosting: 0 problem(s)
```
Host Cloudflare, db none (`.lilac/hosting.json`). `deploy-plan` not run. Nothing deployed.

## Foundation

```text
foundation: 0 error(s), 0 warning(s)
foundation drift: 0 error(s), 1 warning(s)
NONE: no approval yet. Run /lilac:foundation.
```
FOUNDATION.md and BRAND.md completed; tokens in `brand/`. Drift warning: two decorative loops of 2.4 s and 5.4 s, accepted (pause button, reduced motion). Approval pending owner; `approve` was not run.

## 2026-11-23: no-JavaScript form fallback

Form now `method="get" action="thanks.html"` with unnamed personal fields (demo only: a real site posts to a server). Added thanks.html, privacy.html, closing next-step links on pages that were dead ends, funnel files. Gates and lines: RESULTS.md.
