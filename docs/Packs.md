# Vertical packs

A vertical pack adds depth for one kind of site (music, restaurant, and so on): up to 3 extra brief questions, default requirements, an integrations table with a fallback for each, blocks, tests and a rights note. Packs live in `verticals/<name>/`; `verticals/_template/` is the one to copy. Skill packs in `packs/` are a different thing.

```
node scripts/packs.mjs list
node scripts/packs.mjs detect BRIEF.md     # suggests candidates; you confirm, nothing is applied
node scripts/packs.mjs validate <pack>     # files, 3 questions max, 6-column table, fallbacks, rights, dates
node scripts/packs.mjs accounts <pack>     # accounts and keys you must supply (UNKNOWN until you do)
node scripts/packs.mjs demand <vertical>   # local log: .lilac/pack-demand.json
node scripts/packs.mjs demand-report
```

An expired pack fails validation with "stale: run research first". The demand log never leaves your machine; sharing is opt-in and not built. Later packs (restaurant, e-commerce, and others) are stubs in `verticals/README.md`, marked not built.
