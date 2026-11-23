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
   - `/lilac:brief` interviews you and writes a checked brief before building. Tips: `${CLAUDE_PLUGIN_ROOT}/docs/PROMPTING.md`.
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
