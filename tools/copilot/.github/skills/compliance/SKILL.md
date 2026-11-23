---
name: compliance
description: Check a built site for WCAG 2.2 AA, EAA accessibility-statement and SEO/answer-engine readiness; init sitemap, robots, llms.txt.
disable-model-invocation: true
---
# /lilac:compliance

Static checks on the built site. They find problems; they never prove compliance.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/a11y-law.mjs" check "${CLAUDE_PROJECT_DIR}"` (`--site <dir>`, `--json`). Each finding names its WCAG 2.2 success criterion. The EAA section needs an accessibility statement with a contact route, a feedback route, a standard, a date and a complaint route. Shops (cart, checkout, product) get errors, other sites warnings.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/seo-ready.mjs" check "${CLAUDE_PROJECT_DIR}"`. It checks sitemap.xml, robots.txt, llms.txt, canonical, JSON-LD, Open Graph and duplicate titles.
3. If sitemap.xml, robots.txt or llms.txt is missing, run `seo-ready.mjs init "${CLAUDE_PROJECT_DIR}" --base https://<real-domain>`. It never overwrites. Ask the human for the domain; if unknown, init writes `https://unknown.invalid` and check fails until it is set.
4. Fix every error using the `fix:` hint. Never invent a rating, review count, address, phone or date to satisfy a check: remove the property instead. Re-run until both last lines say `0 error(s)`.
5. Report in plain words: what was fixed, the warnings, and every UNVERIFIED line verbatim. Say that whether the EAA applies to this business is UNKNOWN (not legal advice) and that browser axe results are a separate step.

Approval: when a statement page is drafted for the human, ask with AskUserQuestion (Approve / Change something / Stop) before it is written into the site. Statement text must say "aims to meet" unless an audit supports more.
