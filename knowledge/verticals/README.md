# Knowledge records: verticals

One JSON file per claim. Check them with `node scripts/knowledge.mjs validate knowledge/verticals`.

Fields: `topic`, `claim`, `value`, `source_url`, `quote` (verbatim, 20+ characters), `retrieved`, `expires`, `confidence` (official, secondary or community), `volatility`, `status`, `conflict_with`.

Expiry: library-version 30 days, pricing 90, browser-support 90, design-trend 180. Community sources can only be `needs-verification`. Two records with the same `topic` and different `value` each need a `conflict_with` note and stay side by side.

`_example.json` shows the format with SAMPLE text. The validator skips files starting with `_`. No real claims are stored here until someone fetches and verifies them.
