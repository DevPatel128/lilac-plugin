# Context: read what you already have

`/lilac:context` reads your own repos and text you paste, and proposes brand tokens and facts for the brief. Optional.

- **Reads only paths you pass.** Nothing is crawled. No network. No GitHub or Instagram access: paste profile text into a file and pass `--paste <file>`.
- **Reads only files that carry intent:** README, `docs/*.md`, `package.json`, tailwind and token CSS, `content/` md and json, HTML titles and headings.
- **Never reads** `.env*`, keys, `*.pem`, `id_rsa*`, lockfiles, `node_modules`, `.git`. Symlinks are not followed. Limits: 256 KB per file, 200 files per repo.
- **Redacts** secrets, emails and phone numbers. Every file read is logged in `.lilac/context-sources.log`.
- **Proposes, never decides.** `CONTEXT.md` lists each item as PROPOSED with its source file. Nothing enters `BRIEF.md` until you say yes.

```bash
node operations/plugin/scripts/context.mjs read my-site --repo ../old-site [--paste profile.txt]
node operations/plugin/scripts/context.mjs answers my-site   # which BRIEF parts it can pre-fill
```

Not done: it does not fetch live sites, and the fact finder is simple (first heading and paragraph), so check each proposal.
