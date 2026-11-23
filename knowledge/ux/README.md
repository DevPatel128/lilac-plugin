# UX knowledge graph

What it is: a small library of facts about what makes sites and apps easy to use, taken from published work by usability researchers, accessibility groups and platform makers. Each fact is one short file in `records/`, written in our own words, with the source name, link, the date we read it and, for numbers, the exact figure.

How the agents use it: the `ux-review` skill loads `graph.json`, picks the records that fit the product type, and reviews real pages against them. Every finding names a record id such as `UX-0042`, so you can open the source and judge it yourself.

The graph: `graph.json` is built from the records by `scripts/ux-graph-check.mjs --build`. Nodes are principles, patterns, checks and skills. Edges say which records support or conflict with each other, which Lilac check can measure a record (`measured_by`), and which skill runs that check (`implemented_by`). Never edit it by hand; edit a record and rebuild.

Confidence: high means a written standard or two independent sources agree. Medium means one reputable study or guide. Low means a single source, dated or narrow, to be tested rather than trusted (such records say "single source"). Anything we could not read ourselves is left out of the records and listed as UNVERIFIED in the review.

Limits: a record says what experts found, not what your visitors will do. Simulated visitors from `persona-test` are not real people; treat results as hypotheses until real users confirm (docs/PILOT.md).

Check it: `node scripts/ux-graph-check.mjs` (exit 1 on any problem; it makes no network calls).
