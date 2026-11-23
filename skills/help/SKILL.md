---
name: help
description: Show what Lilac can do and the exact commands to run. Use when someone asks how to start, what Lilac does, or what commands exist.
disable-model-invocation: true
---
# Lilac help

Tell the user, in plain words and short lines:

1. **Start here:** `/lilac:lilac <your idea or change>` runs the full loop (plan, build, check, document).
2. **Commands you can type**
   - `/lilac:doctor` checks that Lilac works on this computer and says how to fix anything that does not.
   - `/lilac:hosting` asks where you want to host (Cloudflare is the default; Vercel and Supabase are options) and sets it up. Code is always on GitHub.
   - `/lilac:foundation` decides the architecture, languages, tools and brand kit with you before any building starts, and waits for your yes.
   - `/lilac:brief` reads a pasted BRIEF block (template: `${CLAUDE_PLUGIN_ROOT}/docs/PROMPT-TEMPLATE.md`) or interviews you in two screens, and writes a checked brief before building. Tips: `${CLAUDE_PLUGIN_ROOT}/docs/PROMPTING.md`.
   - `/lilac:severity` sets how strict every gate is, 1 (sketch) to 10 (audit). `/lilac:status` shows each gate as approved, stale or pending. `/lilac:statusline` turns on a progress bar in the status line.
   - `/lilac:context` reads repos and pasted text you pick (read-only, secrets redacted) and proposes brand and facts. `/lilac:references` takes colours, fonts and spacing from 3 sites you like (asks per URL; tokens only, never copied content).
   - `/lilac:fidelity` checks the built site against your accepted requirements and writes a traceability matrix; `/lilac:converge` fixes the misses (at most 3 rounds, reruns only the gates needed). Requirements come from `scripts/requirements.mjs generate`.
   - `/lilac:motion` picks a motion tier and checks the motion budget and asset licences. `/lilac:performance` checks performance budgets and images. `/lilac:compliance` checks WCAG 2.2 AA, the EAA statement and SEO/answer-engine files. `/lilac:privacy-analytics` audits consent and ties analytics to your success number. `/lilac:craft-review` scores type, spacing, colour, motion and hierarchy.
   - `/lilac:owner-editing` lets the owner edit menu, dates and hours without an AI session; forms go to email, Sheets or a CRM. `/lilac:research-refresh` refreshes sourced knowledge records, only after you approve the URL list.
   - `/lilac:preview` shows your site locally and waits for your yes before anything is published.
   - `/lilac:qa` runs automatic error checks (links, accessibility, speed, security, SEO) and a real-browser pass with keyboard-only and no-JavaScript tests.
   - `/lilac:persona-test` runs about 100 simulated visitors; `/lilac:persona-review` collects AI persona opinions. Neither is real people.
   - `/lilac:docs` writes the tech-stack page (with diagrams), interview prep and social-media drafts for this project, then checks them.
   - `/lilac:project-handoff` writes HANDOFF.md, a PDF and a short slide deck for whoever takes over.
   - `/lilac:learning status|on|off` shows or changes the optional learning hook. It is off by default.
3. **Nothing leaves this computer.** Lilac has no server. Learning data stays in `~/.lilac/` and is redacted. Delete it with `rm -r ~/.lilac`.
4. **If something fails:** run `/lilac:doctor` first; then read `docs/TROUBLESHOOTING.md` in the plugin folder: `${CLAUDE_PLUGIN_ROOT}/docs/TROUBLESHOOTING.md`.
5. **Full manuals:** `${CLAUDE_PLUGIN_ROOT}/docs/USER-GUIDE.md` (for people) and `${CLAUDE_PLUGIN_ROOT}/AGENTS.md` (for AI agents).

Do not run anything. Only explain.
