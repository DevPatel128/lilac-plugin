# Guard reference

## OWASP Top 10 for Agentic Applications, mapped to Lilac (agents that build the product)
Sources disagree on the publication date (Dec 2025 vs "2026 edition"); the risks are stable. ✔ = enforced by a hook or check, ◐ = partly, ✘ = advice only.
| Risk | Lilac control | State |
|---|---|---|
| Goal hijack / prompt injection through repo content, issues, web pages | Instruction source rules in the agent; tool output is data; `security-audit` and `review` treat content as untrusted | ◐ |
| Tool misuse | Guard hook blocks destructive git, gh, wrangler and SQL commands | ✔ |
| Identity and privilege abuse | Agents work on branches; merges of protected areas need a person; secrets files unreadable | ✔ |
| Supply chain (packages, skills, actions) | Dependency gate needs a `DECISIONS.md` entry; actions pinned by SHA; vendored skills hash-pinned; `npm audit` in the PR job | ✔ |
| Unexpected code execution | `security-audit` runs target code only in a sandbox; no `curl | sh` in scripts | ◐ |
| Memory and context poisoning | `MISTAKES.md` and docs change only through reviewed PRs | ◐ |
| Insecure inter-agent communication | Subagents get scoped prompts; results are summaries, not instructions | ✘ |
| Cascading failures | 3 CI fix attempts then stop; floor on PR size drops after red runs | ◐ |
| Human-agent trust exploitation | Reports must say "not checked"; no fabricated results (rule 0) | ◐ |
| Rogue agents / excessive autonomy | Autonomy table in `GOVERN.md`; `AUTOPILOT=off` stops changes | ◐ |

## NIST SSDF (SP 800-218) practice groups, mapped
| Group | Lilac today | Gap |
|---|---|---|
| PO Prepare the organisation | `GOVERN.md` roles and autonomy, `AGENTS.md` rules, this skill | no named security owner per product (write one in `GOVERN.md`) |
| PS Protect the software | branch-only agents, pinned actions and skills, secret scanning, no secrets in repo | release signing and provenance not used (GitHub attestations need a paid plan for private repos) |
| PW Produce well-secured software | threat model in `SYSTEM.md`, kit helpers, `api-check`, tests, `review`, `security-audit` | no SAST in CI (CodeQL is paid for private repos; Semgrep optional by hand) |
| RV Respond to vulnerabilities | `security-fix`, `MISTAKES.md` + enforcing check, `.github/SECURITY.md` contact | no disclosure timeline written: default 90 days, said in `SECURITY.md` |

## NIST AI RMF checklist for a product AI feature (Govern · Map · Measure · Manage)
- **Govern:** owner named; data sources and consent recorded (`LEGAL.md`, `ml.ts` consent basis); disclosure to users.
- **Map:** what the feature decides or suggests; who is harmed by a wrong answer; deterministic alternative considered.
- **Measure:** golden set with adversarial cases; baseline vs model; cost and latency per call; drift check before each release.
- **Manage:** kill switch (`enabled`), daily budget, human approval for consequential actions, rollback (`ml.ts`), incident path below.

## Incident path
1. **Contain:** roll back (`wrangler rollback`), flip the feature flag off, rotate the leaked secret, or block the route.
2. **Preserve:** keep logs and the audit trail; do not delete evidence; note times in UTC.
3. **Tell:** the owner at once. Personal-data breach under DPDP: the Data Protection Board and the affected people, in the form and time the Rules set (check `LEGAL.md`). Payment data: the provider's rules.
4. **Fix:** `security-fix` (failing test first). 5. **Learn:** `MISTAKES.md` row with its enforcing check, within the same PR.

## Consent and dark patterns
Optional data uses (training, marketing) are asked, never assumed: two equal options, nothing pre-selected, the same effort to say no as yes, withdrawal as easy as giving, and no copy that shames or pressures (India's CCPA dark-pattern guidelines, Nov 2023: confirm-shaming, interface interference, forced action). `src/consent.ts` is the pattern; `design.spec.ts` already fails a screen with two primary actions.

## Product boundaries
Each product built on Lilac keeps its own business rules, terms and data model. Never copy one product's rules into another without a written reason in `DECISIONS.md`; shared code moves into Lilac only when it is genuinely the same in both.

## Crypto and blockchain: decision slot (not built)
Use only when a shared database plus an append-only audit log cannot do the job (for example, users must verify records without trusting us). Before any build: a written reason in `DECISIONS.md`, a lawyer's review (in India, crypto income is taxed at 30% with 1% TDS and service providers register with the FIU under PMLA; these are from memory and UNVERIFIED), no custom cryptography, no private keys held server-side without hardware-grade key storage. Better Auth's Sign-In With Ethereum plugin exists if wallet sign-in is ever needed.

## Limits that are advice only today
- Token and cost caps per agent run: measured per PR (`lilac-stats`), not enforced mid-run.
- Agent identity: agents use the developer's own credentials; separate least-privilege tokens per agent are a future step.
