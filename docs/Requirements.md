# Requirements

Turns your `BRIEF.md` into a checkable list, `brief/requirements.yaml`, so "done" means something. Offline, no dependencies.

```text
node scripts/requirements.mjs generate <dir>      write brief/requirements.yaml from BRIEF.md
node scripts/requirements.mjs list <dir> [--must] table; only accepted items are counted
node scripts/requirements.mjs accept <dir> R-004  turn a proposed item into an accepted one
node scripts/requirements.mjs ambiguity <dir>     up to 3 questions, one per vague word ("modern", "premium", "clean")
node scripts/requirements.mjs check <dir>         validate the file, exit 1 on problems
```

Each item has `id`, `ears`, `priority` (must, should, could), `source`, `verify` and `status`.

- `ears` reads "WHEN a trigger THE SITE SHALL a response".
- The main action is the must. Each page is a should. Each fact is a content item. Each "Must not claim" line becomes an `N-` item (the site shall NOT claim it).
- `source` is your own line, word for word. Lilac never invents a fact.
- `verify` says how it is checked: dom, visual, content, behavior, perf, a11y or manual.
- Extras Lilac suggests (keyboard use, no sideways scroll on a phone, load time) are written as `proposed`. They count only after you `accept` them.

`check` fails on duplicate ids, a line that is not EARS, a bad priority, verify or status, a must without a verify method, and an accepted item without a source.

Not done: `verify` names the method but nothing runs it yet. The YAML is flat and read only by this script, so edit by hand and then run `check`.
