# Vendored skill: handoff

- **Source:** https://github.com/mattpocock/skills, folder `skills/productivity/handoff`, commit `5beb35b040e3de97e54fa9e386d7e42d15c295c2` (2026-10-27). MIT (`LICENSE` in this folder).
- **Status:** unmodified except `agents/openai.yaml` (OpenAI agent config, not used by Lilac) is not copied. `UPSTREAM.sha256` pins every file and Lilac CI fails if one changes. Long `SKILL.md` is exempt from the 80-line cap because it is upstream text.
- **Review before adding (2026-10-27):** read the SKILL.md and supporting files; searched for install, network download, eval and prompt-override patterns: none. Scripts (`wizard/template.sh`, `diagnosing-bugs/scripts/hitl-loop.template.sh`) are templates run only by a human.
- **Not vendored:** `research` (Lilac already has `product-growth/skills/research`).
- **Lilac use:** see governance-learning/skills/SKILLS.md.
- **Update:** clone the new commit into a scratch folder, read the diff in full, replace the files, regenerate `UPSTREAM.sha256` (`find . -type f ! -name UPSTREAM.sha256 ! -name VENDOR.md | sort | xargs shasum -a 256`), change the commit above in the same PR.
