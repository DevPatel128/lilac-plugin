---
name: build
description: Run the whole Lilac flow for a website or web app from one idea, with human approval gates and proof at every stage.
disable-model-invocation: false
---
# /lilac:build "<idea>"

One command, ten stages. You do the work. `build.mjs` keeps the truth and checks the real tools. Start: `node "${CLAUDE_PLUGIN_ROOT}/scripts/build.mjs" init "<dir>" --idea "<idea>"`.

**At the start of EVERY turn run** `node "${CLAUDE_PLUGIN_ROOT}/scripts/build.mjs" status "<dir>"` (after an interruption run `resume` first). It prints the current stage and the exact next command. Do that command's job, nothing else.

Stages: 1 brief (human approves) -> 2 foundation (human approves) -> 3 funnel (human approves) -> 4 build -> 5 gates -> 6 fix loop -> 7 hosting (ASK) -> 8 preview (human approves) -> 9 deploy plan -> 10 handoff.

- Brief: skill `brief`, then `build.mjs approve <dir> brief --by --quote` with the human's own words.
- Foundation: skill `foundation`. Funnel: the funnel skill, then `approve <dir> funnel`.
- Build: write the site using `brand/tokens.css` and the blocks in `${CLAUDE_PLUGIN_ROOT}/blocks` if that folder exists. No invented facts: use `UNKNOWN` or SAMPLE.
- Gates: `build.mjs gates "<dir>"` runs foundation drift, static qa, qa-browser, controls-test, persona-test (30 simulated visitors), funnel check and the ux graph, one after another. Then do the `ux-review` skill on the real pages.
- Fix loop, at most 5 rounds: each round list what failed and what you changed, then run `gates` again. After 5 failed rounds stop and ask the human. Only if they say go on, run `gates "<dir>" --continue`.
- Hosting: ask (1 Cloudflare default, 2 Vercel, 3 Cloudflare+Supabase, 4 Vercel+Supabase, 5 other). Code is on GitHub, not a question.
- Preview: `preview.mjs start`; record approval only after an explicit yes.
- Deploy plan: print it. Never run it. Handoff: `handoff.mjs`, then `build.mjs report`.

Rules
1. Never skip an approval stage. Never write a quote for the human or approve for them.
2. Never mark a stage done without evidence: `build.mjs done "<dir>" <stage> --evidence "<command> => <result line>"`. It re-runs the stage's own tool and refuses if it disagrees.
3. If blocked, run `block "<dir>" <stage> --reason "<why>"`, stop and ask the human.
4. Run gates one at a time; Chrome tools must not overlap.
5. Simulated visitors are not real users: say so every time.
