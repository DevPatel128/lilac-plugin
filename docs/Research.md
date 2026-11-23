# Research

`/lilac:research-refresh` keeps Lilac's facts current without guessing. Each fact is a small JSON record in `knowledge/verticals`, `knowledge/stack` or `knowledge/integrations` with a source URL and a word-for-word quote. No source and quote, no claim.

How it runs:
1. `knowledge.mjs plan` lists stale records and the URLs to re-read. It fetches nothing.
2. You approve, change or stop. Stop means no network call and no `.lilac/network.log`.
3. The `lilac-researcher` agent fetches the approved URLs with its normal web tools (or a Context7 or vendor docs MCP if you have one). It logs each fetch.
4. `knowledge.mjs propose` writes a proposed diff under `.lilac/research/`. Records change only after you approve.

Expiry: library versions 30 days, pricing and browser support 90, design trends 180. Community sources stay `needs-verification`. Conflicting sources are stored side by side with a note, never merged.

Not included: the script never reaches the network and does not re-check a quote against the live page. The record folders hold only a SAMPLE example until someone fetches and verifies real claims. `knowledge/_sources.yaml` lists where to look; vendor changelog URLs marked UNKNOWN are not confirmed.

Run `node knowledge.mjs validate <dir>` to check records.
