---
name: features-content
description: Add an owner-editable blog, extra languages, search data, share images and legal starting-point pages to a site, using only true facts from the owner.
disable-model-invocation: false
---
# Lilac content features

Tool: `node "${CLAUDE_PLUGIN_ROOT}/scripts/content.mjs"`. Node only, no network. Owner guide: `docs/FEATURES-CONTENT.md`.

## Ask the owner first (TRUE facts only)
Business name, real contact, country, the exact personal data the site collects (or "none"), the real https address, languages wanted. Write them to `.lilac/business.json` ({name, contact, country, dataCollected[]}) and `content/site.json` ({name, url, defaultLang, languages, requiredLanguages, css}). If the owner does not know, write `UNKNOWN`, leave the field out, and say so. Never guess an address, price, rating, opening hour or legal fact.

## Steps
1. Blog: `content.mjs new <project> post "<title>"` makes a draft. The owner edits `content/<slug>.md` (images need alt text). `content.mjs build <project>` writes `site/blog/`, the index and `feed.xml`; it only rebuilds changed posts. Drafts are never published.
2. Languages: put page templates with `data-i18n` keys in `content/pages/`, texts in `content/i18n/<lang>.json`. `content.mjs check` lists missing keys: a human or vetted service translates them; you must not machine-translate. A missing key in a required language fails the build.
3. Search data: `content.mjs seo <project>` (sitemap, robots, canonical, og/twitter meta), `content.mjs og <project>` (share images; `SKIPPED(no browser)` is reported, not hidden), `content.mjs jsonld <Type> data.json`. It refuses fields the owner did not supply (no invented ratings or prices).
4. Legal pages: `content.mjs legal <project>` fills only what is in `business.json` and lists the rest. Tell the owner plainly: these are starting points, not legal advice, and a qualified person must review them for their country and business. Keep the banner until then. Do not publish while `content.mjs check --publish` lists UNFILLED items. The cookie notice says "no tracking" only while that is true: verify with `qa.mjs`; use `--with-analytics` only if analytics were added with the owner's yes.
5. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/qa.mjs" "<project>"` and fix every error. Report commands and results; never claim accessibility conformance.
