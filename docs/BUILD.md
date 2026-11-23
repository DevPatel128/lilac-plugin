# Build a site from one idea: `/lilac:build`

Type `/lilac:build "<your idea>"`. Lilac walks the whole way from idea to a handoff. The AI does the work. A small tool, `build.mjs`, writes down where you are and checks each step against the real checks, so the AI cannot just say "done".

## The stages

```
 1 brief ---(you approve)---> 2 foundation ---(you approve)---> 3 funnel ---(you approve)
                                                                     |
                                                                     v
                                                               4 build the site
                                                                     |
                                                                     v
  5 gates, one after another:  foundation drift > static qa > qa-browser > controls-test
                               > persona-test (30 simulated visitors) > funnel check > ux review
                                        |  all pass                      |  something failed
                                        |                                v
                                        |                     6 fix loop (max 5 rounds)
                                        |                     each round: what failed, what changed
                                        |                     after 5: it stops and asks you
                                        v
 7 hosting (you choose; code is on GitHub) ---> 8 preview (you approve) ---> 9 deploy plan (printed, never run) ---> 10 handoff files
```

## Where you decide

- **Approvals** (brief, foundation, funnel, preview): the AI shows you the work. Only your own words count as a yes. It never approves for you.
- **Hosting**: you choose. Nothing is deployed. The deploy plan is only printed.
- **Stuck**: after 5 failed fix rounds, or any blocked stage, it stops and asks you.

## How it keeps honest

- A stage is marked done only with evidence: a command and its result line. Without both, it is refused.
- An approval stage is checked by its own tool (`foundation.mjs status`, `preview.mjs status`, `brief.mjs check`, `hosting.mjs show`). If the tool says NONE or STALE, the stage cannot be done.
- If you change the brief, the foundation, the funnel or the site after approving, that approval is STALE. On the next `resume` the stage reopens, and every stage after it.
- The state lives in `.lilac/state.json` in your project, so an interrupted build picks up where it stopped. It never stores secrets or emails; they are replaced with `[REDACTED]`.
- A gate that was skipped (for example no Chrome found) counts as UNVERIFIED, not as a pass.
- Persona tests use simulated visitors, not real people.

## Commands (the AI runs these)

| Command | What it does |
|---|---|
| `init <dir> --idea "..."` | Start |
| `status <dir>` | Progress, current stage, exact next command |
| `next <dir>` | The same, as JSON |
| `approve <dir> brief\|funnel --by --quote` | Record your yes |
| `done <dir> <stage> --evidence "<command> => <result>"` | Mark a stage done |
| `block <dir> <stage> --reason` | Stop and ask you |
| `resume <dir>` | Re-check old approvals after an interruption |
| `gates <dir>` | Run the checks of stage 5 |
| `report <dir>` | Write `BUILD-REPORT.md` |
