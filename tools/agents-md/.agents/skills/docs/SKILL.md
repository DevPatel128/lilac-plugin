---
name: docs
description: Write and check the project's tech-stack page, interview prep and social-media drafts from its own code.
disable-model-invocation: true
---
# Lilac docs

1. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/techdocs.mjs" "${CLAUDE_PROJECT_DIR}"` (writes `architecture/TECH-STACK.md`, `governance-learning/INTERVIEW-PREP.md`, `product-growth/SHOWCASE.md` inside the project).
2. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/techdocs.mjs" "${CLAUDE_PROJECT_DIR}" --check`.
3. Tell the user in plain words which files were written, which technologies were found, and every line the check printed. A line starting `techdocs:` that is not a warning is a failure; say what it means and how to fix it (email problems: follow the `email` skill).
4. Remind them: `[YOUR ...]` placeholders in `SHOWCASE.md` must be replaced with numbers they measured, or deleted, before anything is posted. Posting is their action, not yours.
