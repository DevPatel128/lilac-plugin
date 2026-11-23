---
name: context
description: Read the user's own repos and pasted text for brand and facts, as proposals only, before the brief. Read-only, secrets redacted.
disable-model-invocation: true
---
# /lilac:context

Optional step before `/lilac:brief`. It reads what the user already has so the brief asks fewer questions.

1. Tell the user: read-only, only the folders and files they name, secrets and emails and phone numbers redacted, every file read is logged in `.lilac/context-sources.log`, no network, no GitHub or Instagram access.
2. Ask with AskUserQuestion which repos or site folders to read (they give paths) and whether they will paste text from an existing page or profile into a file. Never guess a path.
3. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/context.mjs" read "${CLAUDE_PROJECT_DIR}" --repo <path> [--repo <path2>] [--paste <file>]`
4. Show `CONTEXT.md`. Every item is PROPOSED with its source file. Ask with AskUserQuestion per group (stack, colours and fonts, facts, pages): Approve / Change something / Stop.
5. Run `context.mjs answers "${CLAUDE_PROJECT_DIR}"` to see which BRIEF parts the accepted items cover. Skip those questions in `/lilac:brief`; ask the rest. Put only accepted items in the brief. Never copy a proposal into `BRIEF.md` unasked.
