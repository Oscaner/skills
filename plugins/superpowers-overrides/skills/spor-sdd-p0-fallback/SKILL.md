---
name: spor-sdd-p0-fallback
description: p0 in-session SDD worker rules — dormant since CLI-mandatory (7c1a7b8); retained as p0 reference. Not an override slash target. Contains Rules 3, 5b, 5c and D4 review gate.
---

## Rules

### Rule 3 — Implementer subagents delegate to `mattpocock-skills:tdd` **(p0 fallback only)**

When Rule 0 applies (CLI default), skip — `{os-engineering}/templates/cdd/implement.md` is SOT.

When dispatching an **implementer** subagent to write code (p0 path), delegate implementation discipline to [`mattpocock-skills:tdd`](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md). Its rules live in that skill — do not re-implement here.

Exemption: mechanical Markdown skill docs with no runtime behavior. TDD load failure → surface error or degrade silently if plugin absent.

Implementers write test-evidence.json + report.md before H1 contract per `implement.md`.

### Rule 5 — Per-task review (p0 in-session)

#### Rule 5b — In-session implementer dispatch (p0 fallback only)

When Rule 0 applies (CLI default), skip — `{os-engineering}/templates/cdd/implement.md` is SOT.

p0 path: dispatch implementer per upstream SDD Task Loop §1 (`implementer-prompt.md`); filenames brief → report + test-evidence; commit/H1 per `implement.md`.

#### Rule 5c — In-session per-task review (p0 fallback only)

When Rule 0 applies (CLI default), skip — H6 + `{os-engineering}/templates/cdd/` is SOT.

p0 path: inline handoff write + code-review per `{os-engineering}/templates/cdd/{implement,review,fix}.md`, [`spor-handoff-writer`](../spor-handoff-writer/SKILL.md) (schema reference), and [`spor-token-efficient-controller-handoff`](../spor-token-efficient-controller-handoff/SKILL.md) H1–H5; degradation per controller-handoff H2 degradation note.

## Appendix D4 — code-review dual-axis gate (p0)

Applies when SDD per-task review delegates to `mattpocock-skills:code-review` (see Rule 5c). **Not** the multi-pass D1 skip semantics.

- Standards and Spec axes run **one round each**, **in parallel**
- **No** per-axis "skip later passes" — each axis completes once per review invocation
- After **both** axes finish, handoff write runs inline in review mode per `_handoff-write-fragment.md` (unified APPROVED gate + unverifiable scan)
- Axis output format: per [`spor-token-efficient-review-dispatch`](../spor-token-efficient-review-dispatch/SKILL.md) D3 — Markdown body + trailing `## Findings (D3)` JSON block; handoff-writer parses the D3 block; empty array `[]` is valid

**Red flags (D4):**

- "Both axes clean — skip handoff-writer."
- "Apply brainstorming D1 to skip Spec axis because Standards was clean."
- "Return findings prose to orchestrator instead of writing axis files."

## Red Flags — STOP if you catch yourself thinking any of these

- "p0 fallback — skip the announce line."
