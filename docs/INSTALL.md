# Install

The same skills and agents are written in each tool's own format under [`tools/`](../tools/). "Tested" means a real install was run; "Structure checked" means the generated files were validated but not installed in the tool.

| Tool | How to install | Status |
|---|---|---|
| **Claude Code** | `/plugin marketplace add DevPatel128/lilac-plugin`, then `/plugin install lilac@lilac` | Tested (isolated profile) |
| **Cursor** | Use `tools/cursor/` as a plugin folder (local test copy: `~/.cursor/plugins/local/lilac`) | Structure checked |
| **Codex CLI** | Copy `tools/codex/` into your repo, or its `.agents/skills/` into `~/.agents/skills/` | Structure checked |
| **Gemini CLI** | `gemini extensions install <path-or-github-url>` pointed at `tools/gemini/` | Structure checked |
| **Antigravity CLI** | `agy plugin install <path-or-github-url>` pointed at `tools/antigravity/` | Structure checked |
| **GitHub Copilot** | Commit `tools/copilot/.github/` into your repo | Structure checked |
| **Windsurf** | Commit `tools/windsurf/` into your repo | Structure checked |
| **Cline** | Commit `tools/cline/` into your repo | Structure checked |
| **Any tool that reads `AGENTS.md`** | Copy `tools/agents-md/` into your repo | Structure checked |

## Limits to know

- Gemini CLI and Antigravity agents cannot carry a tool allowlist. For those two, only the agents that may write files are included; the read-only agents (Planner, Reviewer, Tester, Security) are left out so none can silently gain write access.
- Cursor agents are emitted with a name and description only, so their tool limits rest on the agent's text, not a tool list.
- Codex agent tool restrictions cannot be carried over; the restriction is stated in the agent text only.
- Format details and the official page each was checked against are in [ADAPTERS.md](ADAPTERS.md).

## Remove it

Claude Code: `/plugin uninstall lilac@lilac`. Your learned data: `rm -r ~/.lilac`.
