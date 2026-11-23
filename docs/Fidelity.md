# Fidelity

`/lilac:fidelity` checks the built site against the accepted requirements in `brief/requirements.yaml` and writes `reports/FIDELITY.md`.

Run: `node scripts/fidelity.mjs run <dir> [--judge-file <json>]`

What it does, offline, with no browser:
- `dom` and `content` items pass only with a `data-req="R-xxx"` carrier in the HTML, or the quoted phrase on a page.
- `behavior`, `perf`, `a11y` are `NEEDS-BROWSER`; `visual` is `NEEDS-JUDGE`; `manual` is `MANUAL`. None is PASS without evidence.
- `N-xxx` anti-requirements: the forbidden phrase (quoted strings in `source`, else the source text) must be absent from all page text. Present means FAIL.
- Headline: `Must-have pass rate: X of Y (Z%)`. Only accepted musts count; NEEDS-* counts as not passed. Not an average.
- Exit 1 if any accepted must fails or any N- item is present.

Vision judge: the agent answers `{id, verdict: yes|no|partial, region}` per visual item. An answer with no region is rejected. Accepted answers persist in `reports/fidelity-judge.json`.

What it does not do: judge design quality, run a browser, or check proposed items. Text match is plain substring.
