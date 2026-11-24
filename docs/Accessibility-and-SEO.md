# Accessibility, EAA and SEO checks

Two offline scripts read the built site and report findings with a fix hint. Neither proves anything; they catch the common, checkable mistakes before a human or a browser tool does.

## a11y-law.mjs

`node operations/plugin/scripts/a11y-law.mjs check <dir> [--site dir] [--json]`

Adds WCAG 2.2 AA checks that `qa.mjs` does not have: lang value (3.1.1), dangling label/aria ids and iframe titles (1.3.1, 4.1.2), autocomplete (1.3.5), zoom blocked (1.4.4), captions and autoplay (1.2.2, 1.4.2), removed focus outline (2.4.7), fixed header without scroll-padding (2.4.11), target size under 24px (2.5.8), dragging with no alternative (2.5.7), keyboard-trap patterns (2.1.2), vague link text (2.4.4), consistent navigation and help across pages (3.2.3, 3.2.6), redundant entry (3.3.7), accessible authentication (3.3.8). Alt text, labels, headings, contrast, skip link and reduced motion stay in `qa.mjs`.

EAA section: an accessibility statement page that is linked from every page, with a contact route, a feedback route, a named standard, a date, and a route to complain. Shops (cart, checkout, product signals) get errors; other sites get warnings.

## seo-ready.mjs

`node operations/plugin/scripts/seo-ready.mjs check <dir>` and `init <dir> [--base https://your-domain]`

Checks sitemap.xml and robots.txt (valid, consistent with the pages), llms.txt (lists real pages), one canonical per page, JSON-LD parsed and type-checked per vertical (LocalBusiness and subtypes, Restaurant, MusicGroup, Product, Event, Organization), Open Graph, duplicate titles. Required fields are facts only. A rating or review in JSON-LD that is not visible on the page, and any placeholder value (SAMPLE, UNKNOWN, example.com), is an error. `init` writes the missing files from the pages found and never overwrites; with no known domain it writes `https://unknown.invalid`, which `check` rejects.

## What this does not do

- Static checks cannot prove WCAG or EAA conformance. Browser axe results are separate (`qa-browser.mjs`) and a screen-reader audit is still needed.
- Whether the EAA applies (service type, microenterprise exemption) is UNKNOWN to the tool. This is not legal advice.
- Nothing here shows a search or answer engine will index or cite the site.

## Gates

Both exit 1 only on errors. Suggested `gates.json` entries: `a11y-law` and `seo-ready`, `minSeverity` 5, `when` `pre`, `chrome` false.
