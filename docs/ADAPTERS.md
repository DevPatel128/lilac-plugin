> Commands and paths in this file refer to the Lilac source repository that generates this plugin, not to files in this repository.

# Lilac tool adapters

<!-- What this file is for: records, per AI coding tool, the native format Lilac emits, where it goes, how a user installs it, and whether the format was confirmed against current official docs. -->

One canonical source (the Claude Code plugin layout: `skills/<name>/SKILL.md`, `agents/<name>.md`, `.claude-plugin/plugin.json`) is turned into each tool's native format by `operations/plugin/adapters/`.

```
node operations/plugin/adapters/cli.mjs <srcDir> <outDir> --target <claude|cursor|codex|gemini|antigravity|copilot|windsurf|cline|agents-md|all>
```

`all` writes one folder per target under `<outDir>/<target>/`. Emitters write only inside `outDir`, refuse an `outDir` inside `srcDir`, and are idempotent. Test: `bash operations/scripts/test-plugin-adapters.sh`.

Rule/instruction files are short indexes (under 6000 bytes, names plus one-line descriptions) that point at the full skill files. Each ends with `Generated from Lilac v<version>.`

## Format table (checked 2026-11-20)

| Tool | Native format | Where files go | Install command for a user | Source URL | Checked | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | Plugin: `.claude-plugin/plugin.json` (only `name` required), `skills/`, `agents/` | Plugin root, published in a marketplace | `claude plugin install lilac --marketplace <owner/repo>` or `/plugin marketplace add <owner/repo>` then `/plugin install lilac@<marketplace>` | https://code.claude.com/docs/en/plugins-reference , https://code.claude.com/docs/en/plugins/install.md | 2026-11-20 | VERIFIED |
| Cursor: rules and skills | Plugin: `.cursor-plugin/plugin.json` (only `name` required), `rules/*.mdc` (front matter `description`, `globs`, `alwaysApply`), `skills/<name>/SKILL.md` | Plugin folder; local test copy in `~/.cursor/plugins/local/<name>` | Customize, then Install (project or user scope); GitHub import needs `.cursor-plugin/marketplace.json` | https://cursor.com/docs/context/rules , https://cursor.com/docs/plugins | 2026-11-20 | VERIFIED |
| Cursor: agents, marketplace.json | Agents: `agents/*.md` (`.md`, `.mdc`, `.markdown`) in plugin root, front matter `name` (kebab-case), `description`. `.cursor-plugin/marketplace.json` at repo root: `name`, `owner{name}`, `plugins[]{name, source}`, optional `metadata` | Plugin `agents/` | none | https://cursor.com/docs/reference/plugins | 2026-11-20 | VERIFIED (agents emitted with name+description only; marketplace.json schema recorded but not emitted, Lilac ships one plugin) |
| OpenAI Codex CLI | `AGENTS.md` (global `~/.codex/AGENTS.md`, then root down to cwd, 32 KiB combined cap by default); skills `.agents/skills/<name>/SKILL.md`; custom agents: standalone TOML in `.codex/agents/` (or `~/.codex/agents/`) with required `name`, `description`, `developer_instructions`; `sandbox_mode` in an agent file does not override the parent | Repo root, `.agents/skills/`, `.codex/agents/` | Copy output into the repo, or into `~/.agents/skills/`; or `$skill-installer` pointed at the repo | https://learn.chatgpt.com/docs/agent-configuration/agents-md , https://learn.chatgpt.com/docs/build-skills.md , https://learn.chatgpt.com/docs/agent-configuration/subagents.md | 2026-11-20 | VERIFIED (agent tool restrictions cannot be carried over; body text only) |
| Gemini CLI | Extension: `gemini-extension.json` (`name`, `version`, `contextFileName`), `GEMINI.md`, `skills/<name>/SKILL.md`, `commands/*.toml`, `agents/*.md` (page marks sub-agents preview). Agent front matter: `name` (required, lowercase/digits/hyphen/underscore), `description` (required), optional `tools` (array, Gemini tool names), `model`, `kind`, `temperature`, `max_turns`, `timeout_mins` | Extension folder under `~/.gemini/extensions/`; standalone agents `.gemini/agents/*.md` | `gemini extensions install <github-url-or-local-path>`; dev: `gemini extensions link <path>` | https://geminicli.com/docs/extensions/ , https://geminicli.com/docs/extensions/reference/ , https://geminicli.com/docs/core/subagents/ | 2026-11-20 | VERIFIED (agents emitted with name+description, no `tools`, so a read-only agent inherits session tools; Claude tool names are not valid Gemini names) |
| GitHub Copilot: instructions | `.github/copilot-instructions.md` (repo-wide); `.github/instructions/*.instructions.md` with `applyTo`; `AGENTS.md` nearest wins | Repo `.github/` | Commit the output to the repo | https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions | 2026-11-20 | VERIFIED |
| GitHub Copilot: custom agents | `*.agent.md`, front matter `description` (required), `name`, `tools` (list or comma string), `target`, `model`. Aliases (case-insensitive): `execute` (Bash), `read` (Read), `edit` (Edit, Write, NotebookEdit), `search` (Grep, Glob), `agent` (Task), `web` (WebSearch, WebFetch), `todo` | `.github/agents/` | Commit the output | https://docs.github.com/en/copilot/reference/custom-agents-configuration , https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents | 2026-11-20 | VERIFIED |
| GitHub Copilot: skills | `SKILL.md` folders; project skills in `.github/skills`, `.claude/skills` or `.agents/skills` | `.github/skills/` | Commit the output | https://docs.github.com/en/copilot/concepts/agents/about-agent-skills | 2026-11-20 | VERIFIED (path only; SKILL.md field rules not read on that page) |
| Windsurf | `.windsurf/rules/*.md`, front matter `trigger: always_on / glob / model_decision / manual`, `globs`; docs call this folder legacy (still imported). Skills `.devin/skills/` and `.agents/skills/` | Repo `.windsurf/rules/`, `.agents/skills/` | Commit the output | https://docs.devin.ai/desktop/cascade/memories (redirect of docs.windsurf.com) | 2026-11-20 | VERIFIED (per-file size limit not stated; Lilac keeps the rule under 5500 bytes) |
| Cline | Rules: `.clinerules/*.md` (or `.cline/rules/`), optional `paths:` front matter; no front matter means always active; also reads `AGENTS.md`. Skills: `.cline/skills/<name>/SKILL.md` (also `.clinerules/skills/`, `.claude/skills/`; global `~/.cline/skills/`), front matter `name` (= folder) and `description` (max 1024) | Repo `.clinerules/`, `.cline/skills/` | Commit the output | https://docs.cline.bot/customization/cline-rules , https://docs.cline.bot/customization/skills | 2026-11-20 | VERIFIED for rules and skills; UNVERIFIED for agents (no agent format found, none emitted) |
| Antigravity CLI (Gemini CLI successor) | Plugin dir: `plugin.json` (or `.antigravity-plugin/plugin.json`; schema requires `name`; marketplace also wants `displayName`, `description`, `version`, `logo`, `author`), `skills/<name>/SKILL.md`, `agents/<name>.md` (front matter `name`, `description` required; `tools` allowlist, `model`, `mainAgent`, `subagent`), `rules/<name>.md` (front matter `trigger: always_on / model_decision / glob / manual`, `description`, `globs`; a rule without a valid `trigger` is silently discarded), `mcp_config.json`, `hooks.json`. Workspace `.agents/{rules,skills,agents,plugins}/`, global `~/.gemini/config/` | Plugin folder; `.agents/plugins/<name>/` or `~/.gemini/config/plugins/<name>/` | `agy plugin install <path-or-github-url>`; `agy plugin validate ./plugin`; `agy plugin import gemini` converts old extensions | https://antigravity.google/docs/build-plugins , https://antigravity.google/docs/plugins?tab=cli , https://antigravity.google/docs/customization-discovery/ , https://antigravity.google/docs/subagents , https://antigravity.google/docs/rules | 2026-11-20 | VERIFIED (agents emitted without `tools`: tool names only partly documented and a wrong name may hang the subagent). The 2026-06-18 Gemini-to-Antigravity date and tier list were not found on the pages read (migration page gives no dates): UNVERIFIED |
| Agent Skills convention | `skill-name/SKILL.md`, front matter `name` (must equal folder name, lowercase, hyphens) and `description` (max 1024); optional `scripts/`, `references/`, `assets/` | Any host's skills folder | per host | https://agentskills.io/specification | 2026-11-20 | VERIFIED |
| AGENTS.md convention | Plain Markdown at repo root, no required fields, nearest file wins; read by Codex, Cursor, Copilot coding agent, Windsurf, Cline and others (Gemini CLI needs a `.gemini/settings.json` setting; Aider needs `read: AGENTS.md`) | Repo root | Commit the output | https://agents.md | 2026-11-20 | VERIFIED |

## What each target emits

| Target | Output |
| --- | --- |
| claude | Full copy of the canonical tree |
| cursor | `.cursor-plugin/plugin.json`, `rules/lilac.mdc` (alwaysApply index), `skills/`, `agents/<name>.md` (name+description) |
| codex | agents-md output plus `.codex/agents/<name>.toml` |
| gemini | `gemini-extension.json`, `GEMINI.md`, `skills/`, `agents/<name>.md` (name+description) |
| antigravity | `plugin.json`, `rules/lilac.md` (always_on index), `skills/`, `agents/<name>.md` |
| copilot | `.github/copilot-instructions.md`, `.github/skills/`, `.github/agents/<name>.agent.md` (tools mapped; unmapped tools dropped, so a read-only agent stays read-only) |
| windsurf | `.windsurf/rules/lilac.md`, `.agents/skills/` |
| cline | `.clinerules/lilac.md`, `.cline/skills/` |
| agents-md | `AGENTS.md` (no front matter, no tool names), `.agents/skills/` |

Not emitted: agents for Windsurf and Cline (no verified agent format found; Windsurf docs searched, only AGENTS.md and rules pages exist). Their roles live in the skill text only.

## Known gaps

- Anything marked UNVERIFIED is best-effort. Re-check the source URL before publishing it as supported.
- No tool was run against the emitted output (install not exercised); only file shape and parseability are tested.

## Safety note: tools that cannot restrict an agent's tools

Gemini CLI and Antigravity agents are emitted without a `tools` list (tool names differ and a wrong name can hang the agent). So read-only agents (planner, reviewer, tester, security, which have no Edit or Write) are NOT emitted for those two targets; only the agents that may write are. Read-only behaviour there rests on skills and rules text, not on a tool block.
