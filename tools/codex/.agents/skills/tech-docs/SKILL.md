---
name: tech-docs
description: Generate and check the plain-language tech documentation of a finished product: TECH-STACK.md (languages, tools, services, a diagram per part), INTERVIEW-PREP.md (questions about this project) and SHOWCASE.md (social-media drafts), and keep source files commented. Use at the end of a build, before launch, when the stack changes, or when asked to explain, present or post the project.
---
# Tech docs

Rule 0: the docs are generated from the repo, never written from memory. Every claim traces to a file.
1. **Run:** `node operations/scripts/techdocs.mjs` (in the Lilac plugin install the same script is `scripts/techdocs.mjs` in the plugin folder) (writes `architecture/TECH-STACK.md`, `governance-learning/INTERVIEW-PREP.md`, `product-growth/SHOWCASE.md`).
2. **Read the email table first.** The email section lists five checks: reusable template, plain-text copy, dark mode, preheader, escaped user text. Any NO fails the gate. Fix with email (not in this pack), then rerun.
3. **Comment the code.** Every source file opens with a comment saying what the file is for; add a line above any non-obvious branch saying why. `TECHDOCS_STRICT=1 node operations/scripts/techdocs.mjs --check` lists files without a header.
4. **Gate:** `node operations/scripts/techdocs.mjs --check` fails when the stack changed since the docs were generated, a section has no Mermaid diagram, or email is below standard.
5. **Interview prep:** read each row's "Where to look" file, then answer the question aloud from your own words. Delete nothing you cannot explain.
6. **Showcase:** fill every `[YOUR ...]` with a number you measured or delete the line. Check images for customer data, keys and admin screens. Posting is an owner action (GOVERN.md (not in this pack)).
Report: parts found, checks run, files without headers, UNKNOWN (real-client email rendering is not tested here).
