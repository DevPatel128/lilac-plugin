# Content features: blog, languages, search data, legal pages

This guide is for the site owner. No coding needed.

## Edit or add a blog post

1. Ask Lilac for a new post, or copy an old file in the `content` folder. Each post is one text file ending in `.md`.
2. Open it in any text editor. The top has a few lines between `---` marks:
   - `title:` the headline. `date:` like `2026-01-31`. `summary:` one or two sentences that show in search results.
   - `draft: true` means "not ready": it is not published. Change it to `draft: false` when you want it live.
3. Below the second `---` write in plain words. A blank line starts a new paragraph. `## Heading` makes a heading, `- item` makes a list, `*word*` is italic, `**word**` is bold, a link is the words in square brackets followed by the web address in round brackets.
4. Pictures: an exclamation mark, then the description in square brackets, then the picture's file name in round brackets. The description is required: they are read aloud to people who cannot see the picture.
5. Ask Lilac to rebuild the blog. Only changed posts are rebuilt. Deleting a post file, or setting `draft: true`, takes it off the site.

Safe by design: anything that looks like code or a `javascript:` link is shown as text or refused.

## More than one language

Every language has a file `content/i18n/<code>.json` (for example `fr.json`) with the same keys. Lilac copies your page into `site/fr/` with the right `lang` and reading direction (right to left for Arabic, Hebrew and others), and adds a language switcher made of plain links. Lilac never translates for you. It lists what is missing: have a person or a service you trust translate those lines. Until then the page shows your main language for that line, marked as such.

## Search data and share images

Lilac writes `sitemap.xml`, `robots.txt`, the canonical address and sharing tags, and can add structured data for your business, products, articles and FAQs. It uses only facts you supplied: no made-up prices or star ratings. Share pictures (1200 by 630) need Chrome or Edge on the computer; without it Lilac writes the picture source and says it was skipped.

## Legal pages

Lilac can copy a privacy policy, cookie notice, accessibility statement and terms into your site, filled with your business name, contact, country and the data you collect. **These are starting points, not legal advice.** Have a qualified person check them for your country and business. Anything Lilac does not know stays as `{{like this}}` and is listed: fill it in with true information. The accessibility statement states a target and has a blank for your real test date; it never says the site passes. The cookie notice says the site uses no tracking, which is true only until you add analytics.
