---
name: research-refresh
description: Refresh Lilac's knowledge records from official sources, only after you say yes. Use when records are stale or a fact is needed.
disable-model-invocation: true
---
# /lilac:research-refresh [--vertical <name>]

Records are claims with a source URL and a verbatim quote. No source and quote, no claim. Folders: `knowledge/verticals`, `knowledge/stack`, `knowledge/integrations`; watched sources in `knowledge/_sources.yaml`.

1. List what is stale (offline): `node "${CLAUDE_PLUGIN_ROOT}/scripts/knowledge.mjs" plan "${CLAUDE_PLUGIN_ROOT}/knowledge" --vertical <name>`. It prints "N files are stale. Fetch these URLs now?" and the URLs. It fetches nothing.
2. Show that list. Ask with AskUserQuestion: Approve (fetch these) / Change something (drop or add URLs) / Stop. Stop means no network: `.lilac/network.log` stays absent.
3. On Approve, hand over to the `lilac-researcher` agent. It fetches with its normal web tools, or a Context7 or vendor docs MCP if installed. `knowledge.mjs` never touches the network.
4. After each fetch run `knowledge.mjs log-network <url>`. Write proposed records to a JSON file, then `knowledge.mjs propose <dir> --from <file>`. That writes a diff under `.lilac/research/`; records are never edited in place.
5. Show the diff. Apply only after the user approves. Then `knowledge.mjs validate <dir>` must pass.

Rules: official over secondary over community; community claims stay `needs-verification`. Two sources that disagree are stored side by side with a `conflict_with` note, never merged. Expiry: library versions 30 days, pricing and browser support 90, design trends 180. Awwwards, Godly, Codrops and Hacker News are inspiration or signal only, never a source of a claim.
