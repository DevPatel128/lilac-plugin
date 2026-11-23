# Troubleshooting

First, run `/lilac:doctor` (or `node scripts/doctor.mjs` in the plugin folder). It checks most of the items below and prints the fix.

| What you see | Why | Fix |
|---|---|---|
| `/lilac:...` commands do not appear | The plugin is not installed or not enabled in this session | Run `/plugin`, check that `lilac@lilac` is listed; if not, run the two install commands in the [README](../README.md). Start a new session |
| `Unknown file extension ".ts"` or a `Cannot find module ...ts` error | Your Node is too old. Lilac loads TypeScript files directly | Install Node 24 or newer from https://nodejs.org and run `/lilac:doctor` |
| `PDF: Chrome not found` | The handoff PDF needs Chrome, Chromium or Edge | Install Google Chrome, or set `CHROME=/path/to/chrome`. `HANDOFF.md` and the slides are still written without it |
| `techdocs: TECH-STACK.md is stale` | The project's tools changed after the docs were written | Run `/lilac:docs` again |
| `techdocs: email: missing "..."` | The project sends email but the email lacks one of: reusable template, plain-text copy, dark mode, preheader, escaped user text | Fix with the `email` skill, then run `/lilac:docs` again. A project that sends plain text only is not asked for HTML checks |
| Many `no header comment` warnings | Source files should start with a comment saying what the file is for | Warning only. Add the comments, or ignore. It fails only if you set `TECHDOCS_STRICT=1` |
| A skill mentions a script such as `lilac-check.sh` or `email-check.mjs` that you cannot find | Some skills were written for the full Lilac starter kit, which is not part of this plugin yet | Ignore that line; use the plugin's own checks (`/lilac:docs` runs the stack and email checks) |
| A link shows "(not in this pack)" | That skill is in the full Lilac framework, not in this plugin | Nothing to fix |
| `qa-browser` or `persona-test` says `SKIPPED(no browser)` | They drive Chrome, Chromium or Edge and none was found | Install Chrome or set `CHROME=/path/to/chrome`. Until then do not treat QA as complete: the script checks ran, the browser checks did not |
| `deploy-plan` refuses and mentions a preview approval | You have not said yes to a preview yet, or a site file changed since you did | Run `/lilac:preview`, look at the site, say yes in your own words. Any edit afterwards needs a new yes |
| `choose` refuses because a host is already chosen | Lilac never silently changes your hosting | Run `/lilac:hosting`: it shows your current choice and asks keep or change; changing uses `--change` |
| Learning "does nothing" | It is off by default, on purpose | `/lilac:learning on`. Check with `/lilac:learning status` |
| You want to see or delete saved data | It is in `~/.lilac/` on your computer | `rm -r ~/.lilac` removes all of it |
| Gemini CLI or Antigravity has fewer agents | Those tools cannot restrict an agent's tools, so the four read-only agents are left out on purpose so none can silently gain write access | Nothing to fix |
| It does not work in Cursor, Codex, Copilot, Windsurf, Cline, Gemini or Antigravity | Their files are generated in each tool's documented format, but a real install in each has not been tested yet | Open an issue with your tool and version, your operating system and the output of `node scripts/doctor.mjs` |
| It does not work on Windows | Windows has not been tested yet | Same as above |
| A folder name with spaces | Tested and supported | If it fails, include the path shape in your issue |

## Reporting a problem

Open an issue and include: your tool and its version, your operating system, what you typed, what you expected, what happened, and the output of the doctor. Remove passwords, keys, customer names and private paths first. Never post a security problem publicly: use [SECURITY.md](../SECURITY.md).
