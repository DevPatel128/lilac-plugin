# AGENTS.md: how to use Lilac (for AI agents)

You are an AI coding agent working in a project that has the Lilac plugin installed. This file tells you what Lilac is, what you may and may not do, and the exact commands to run. Humans: read [docs/USER-GUIDE.md](docs/USER-GUIDE.md).

## What you are doing

Lilac is a set of skills and seven agent roles for taking a website or web app from idea to launch (mobile apps are not supported yet) with proof at each step. Your job is to follow the matching skill, run the checks it names, and report results with evidence.

## Hard rules (never break these)

1. **No invented facts.** If the project or a tool does not say it, write `UNKNOWN` or `UNVERIFIED` and say what is missing. Do not fill gaps with guesses.
2. **Evidence or it did not happen.** A check is PASS only when you ran a command and can show the command and its result (exit code or output). Otherwise mark it FAIL, BLOCKED or UNVERIFIED.
3. **Ask before anything outward-facing.** Choosing a host is the human's decision: ask, do not assume. Deploying, sending email or messages, posting publicly, spending money, creating accounts, deleting data and pushing to a remote need an explicit yes from the human in this conversation, for that action. Earlier approval does not carry over.
4. **Secrets and personal data never go into outputs, logs, commits, docs or posts.** Redact them. If you find one, tell the human; do not copy it.
5. **Stay inside the project folder.** Do not read or write other projects or the home directory, except `~/.lilac/` through Lilac's own scripts.
6. **Learning is off unless the human typed `on`.** Never run `learning/config.mjs on` yourself. Never promote a lesson (`learning/promote.mjs`) without a written human approval bound to that lesson.
7. **Respect role limits.** Planner, Reviewer, Tester and Security have no Edit or Write tool: report findings, do not change files. Security says "no" or "not yet"; it never approves. Release never deploys, sends or posts without a recorded human approval. No role has production access.
8. **Do not edit vendored skills.** A skill folder with `VENDOR.md` and `UPSTREAM.sha256` is a copy of someone else's work.

## Where things are

| Path (plugin root `${CLAUDE_PLUGIN_ROOT}`) | What |
|---|---|
| `skills/<name>/SKILL.md` | One skill each. Read the front matter `description` to decide when to load it |
| `agents/lilac-*.md` | The seven roles and their tool limits |
| `scripts/techdocs.mjs` | Writes and checks the tech-stack docs |
| `handoff/handoff.mjs` | Writes the handoff files |
| `scripts/doctor.mjs` | Health check of the installation |
| `learning/` | Optional local learning (off by default) |
| `docs/` | Human guides |

## Which skill for which job

| The human wants | Load | Then run |
|---|---|---|
| A new idea tested, or a change built end to end | `lilac` | follow its loop |
| Phase work | `phase-1-build`, `phase-2-secure`, `phase-3-launch` | the checks each names |
| To know what the project is built with | `tech-docs` (or user command `/lilac:docs`) | `node "${CLAUDE_PLUGIN_ROOT}/scripts/techdocs.mjs" "<project>"` then `--check` |
| A handoff | `/lilac:project-handoff` | `node "${CLAUDE_PLUGIN_ROOT}/handoff/handoff.mjs" "<project>"` |
| Proof a fix works | `verify` | run the before and after command; show both outputs |
| An API, sign-in or email | `api`, `auth`, `email` | each skill's steps |
| A technology choice | `tech-decision` | write the decision with evidence |
| A plan sharpened | `grill-with-docs` | ask one question at a time |
| A risky action | `guard` | stop and ask the human |
| A skill or plugin installed | `skillspector` | scan before install |
| A bug recorded | `mistakes-root-cause-logger` | root cause, fix, enforcing check |
| Shipping a finished branch | `ship` | its gate; ask before deploy |
| The user describes a site | `brief` (user command `/lilac:brief`) | Interview one question at a time, write `BRIEF.md`, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/brief.mjs" check BRIEF.md`; do not build until the human approves the brief |
| Show the site before publishing | `preview` (user command `/lilac:preview`) | `scripts/preview.mjs start`; record approval with `approve --by --quote` ONLY after an explicit yes in the human's own words; any edit makes it stale |
| See how visitors cope | `persona-test` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/persona-test.mjs" "<project>" --visitors 100`. Visitors are simulated, say so every time |
| Qualitative opinions | `persona-review` | Spawn 5 to 10 persona subagents; label every item 'AI persona opinion, not real user feedback'; never report a count of users |
| Where to host | `hosting` (user command `/lilac:hosting`) | ASK the human first (1 Cloudflare default, 2 Vercel, 3 Cloudflare+Supabase, 4 Vercel+Supabase, 5 other). Code is always on GitHub: not a question. Then `node "${CLAUDE_PLUGIN_ROOT}/scripts/hosting.mjs" choose --host <h> --db <d> --project "<project>"`, `check`, `deploy-plan`. Never run the deploy plan yourself |
| Find errors before release | `qa` (user command `/lilac:qa`) | `scripts/qa.mjs "<project>"` then `scripts/qa-browser.mjs "<project>"`; fix every error; re-run until both print `0 error(s)`; if a browser is missing the second prints SKIPPED: say so, do not call QA complete |
| A health check | `/lilac:doctor` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"` |

## Commands and what a result means

| Command | Success | Failure means |
|---|---|---|
| `node scripts/techdocs.mjs <project>` | Prints `techdocs: wrote <file>` three times | Unreadable project folder: report the error text |
| `node scripts/techdocs.mjs <project> --check` | Last line `techdocs: N parts, N languages, 0 problem(s)`, exit 0 | Each `techdocs:` line that is not a `warn` is a problem to fix (stale docs, missing diagram, email below standard) |
| `node handoff/handoff.mjs <project>` | Prints the files written | Any `UNKNOWN` in the output is a fact the project did not state: pass it to the human |
| `node scripts/doctor.mjs` | Ends `Lilac is ready.` | A line starting `FAIL` with a `fix:` line under it |

## Order for a new site

1. `brief` (human approves). 2. `foundation`: decide the architecture, languages and tools, and make the brand kit (colours, type, spacing, motion) BEFORE any site code; the human approves it in their own words (`scripts/foundation.mjs approve`); write no site code until `foundation.mjs status` prints VALID, and build with `var(--token)` from `brand/tokens.css`. 3. Plan, then build in small steps; run `foundation.mjs drift` at the end. 4. `qa` (script, then browser), then `controls-test`. 5. `persona-test`; fix failures; optionally `persona-review`; `ux-review`. 6. Security role review. 7. `hosting` (ask where; code is on GitHub). 8. `preview` (human says yes in their own words). 9. `hosting.mjs deploy-plan`, which refuses without a fresh approval. 10. The human runs the plan, or tells you to; that is a separate yes.

## When you are blocked or unsure

Stop and ask the human one clear question with the options. Say what you already checked. Do not proceed on a guess when the action is outward-facing, destructive or costs money.

## What Lilac cannot do yet (tell the human if it matters)

- Real installs were tested in Claude Code only. Other tools have generated files that were checked for structure only.
- Windows is untested. Browser QA and simulated visitors were run with macOS Chrome only.
- Simulated visitors measure whether tasks can be completed with each method; they are not real people and say nothing about taste or demand.
- Some skills mention scripts from the full Lilac starter kit (for example `lilac-check.sh`, `email-check.mjs`) that are not in this plugin. Use the plugin's own checks above instead and say so.
- Gemini CLI and Antigravity cannot restrict an agent's tools, so the read-only agents are not provided there.

## Reporting your work

End each task with: what you did, the commands you ran with their results, what is UNKNOWN or UNVERIFIED, and what needs a human decision.
