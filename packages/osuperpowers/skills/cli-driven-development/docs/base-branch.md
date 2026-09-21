# Base Branch Methodology & Artifact Schema

Shared methodology for determining the **base branch** of a feature/fix, and the artifact schema that persists the result. Consumed by `cli-driven-development` (determine-base · set-base-branch / branch-review) and `finishing` (reads `base-branch.json` inside `run-finishing-session`) via the `cdd base-branch` CLI.

> Inference is orchestration responsibility; persistence is the engine's. The orchestrator infers, the engine writes and validates — no hand-written artifacts (§2.6 A5 single-root authority).

## Header

Doc metadata — not an artifact section:

- **Class**: methodology-doc
- **Consumers**: `cli-driven-development` (determine-base · set-base-branch / branch-review) · `finishing` (reads `base-branch.json` in `run-finishing-session`)
- **Skeleton**: `Header` + `Section 0–6` fixed order — `Section 0–4` methodology body (Purpose → Inference order → Artifact schema → Scope resolution → CLI usage) + `Section 5–6` template tails
- **Canonical**: `packages/cdd-engine/src/artifacts/base-branch.ts` — the source-enum schema this document mirrors verbatim (verified by the workspace-artifacts test); doc and validator speak one vocabulary (§2.6 E34)
- **Experience**: baked from the P6 design spec §2.6 list, condensed in `docs/maintainers/program-experience.md` (repo-internal pointer, maintainer-side). Citations inline as `§2.6 <item>`

---

## Section 0: Purpose

This document governs two things: the deterministic inference order (Section 1) and the persisted artifact that records the result (Sections 2–4). It is the single delegation target for base-branch determination — the skills reference it instead of re-implementing the sequence (§2.6 A5; clause-reference, not inlined prose, the same rule these templates apply to each other).

The `standalone` mode and its `--scope` / `--slug` flag surface were removed at overall v1.5 — at which point this file stopped documenting them — and any re-introduction is blocked by the stale-lexicon guard (§2.6 A1 delete-anything-not-consumed · A3 anti-residue).

## Section 1: Methodology — base inference order

The base branch is determined by trying these sources **in order** and taking the first source that yields a definitive answer:

1. **Plan field** — if the plan document contains a `base` field, use its value directly.
2. **Branch upstream** — run `git rev-parse --abbrev-ref @{u}`. If the current branch has a configured upstream, derive the base from it (typically the upstream's target branch).
3. **Conversation context** — if earlier messages in the current conversation explicitly mention a base branch (e.g., "merge into `develop`"), use that.

**Fallback:** if none of the above yields a result, **ask the user** to confirm the base branch. Do not guess — a guessed base is a claim the merge will not honor (§2.6 A7 shrink capability claims); asking is the honest counterpart.

These are the only channels: argv (the plan field) · git facts (branch upstream) · conversation context — the three input channels, no disk-resident context (§2.6 B16). A source that is not in the list above is not consulted.

## Section 2: Artifact schema

The determined base branch is persisted as a JSON file at the CDD workspace root:

```
.osuperpowers/cdd/<slug>/base-branch.json
```

```json
{
  "base": "develop",
  "source": "plan-field",
  "confirmed_at": "2026-08-27T10:30:00Z"
}
```

| Field | Type | Description |
|---|---|---|
| `base` | string | the resolved base branch name (e.g., `develop`, `main`) |
| `source` | enum (4 values) | how the base was determined: `plan-field` / `branch-upstream` / `conversation-context` / `user-confirmed` |
| `confirmed_at` | string (ISO 8601) | timestamp when the base branch was determined |

The 4-value `source` enum is a verified count — the engine schema and this table mirror each other exactly (§2.6 B15 output-contract single source · E27: `4` is counted, not remembered). `confirmed_at` is the moment of determination, not the moment of read — the reader must re-check rather than trust a stale timestamp (§2.6 A6).

## Section 3: Scope resolution

The scope path segment is fixed to `cdd`; the artifact always lives at `.osuperpowers/cdd/<slug>/base-branch.json`. The only per-session variable is the `slug`:

| Slug source | Derivation |
|---|---|
| CDD workspace slug | derived by the engine's `workspaceSlug`: plan doc filename with `.md` and a single trailing `-design` / `-plan` stripped |

One root, one slug: the workspace root is the single authority for where artifacts live (§2.6 A5) — the path is derived, never hand-supplied.

## Section 4: CLI usage

The engine CLI is the write/read path for the artifact — orchestrator skills do not hand-write it. The sole target form is the CDD plan:

| Subcommand | CDD (`--plan <path>`) |
|---|---|
| `set` | `cdd base-branch set --base <branch> --source <source> --plan <path>` → `<repoRoot>/.osuperpowers/cdd/<slug>/base-branch.json` |
| `get` | `cdd base-branch get --plan <path>` → artifact JSON on stdout |

`set` is **idempotent**: artifact absent → written with `confirmed_at` = now; same `base` present → rewritten with `source` updated and `base` / `confirmed_at` preserved (semantic no-op); different `base` present → refused (exit 2, existing authority untouched) unless `--force` overrides (new base → new `confirmed_at`).

**Validation errors** (exit 2, nothing written): missing `--base` / `--source`; `source` not one of the four enum values; `get` artifact missing or schema-invalid pre-existing artifact — never silently returns a bad value (the orchestrator falls back to the inference sequence of Section 1).

**Flag boundaries** (exit 2): missing `--plan` → explicit error (the sole target is `--plan <path>`).

Every failure path is `exit 2` + nothing written — a mechanical guard, not a soft warning (§2.6 A6 · A7: a reader is never handed a value the schema did not check).

---

## Section 5: Naming & placeholders

Placeholder / literal vocabulary per the D1.4 naming plane (`docs/maintainers/naming-conventions.md`):

| Placeholder | Meaning |
|---|---|
| `<slug>` | workspace slug — derived, lowercase |
| `<branch>` / `<source>` | `set`-command arguments mirroring the schema fields |
| `<path>` / `<repoRoot>` | plan path (the sole `--plan` target) / repo-root prefix |
| `source` enum literals | `plan-field` / `branch-upstream` / `conversation-context` / `user-confirmed` — full-word, scope-prefixed semantics (§2.6 D24) |

JSON keys are the schema's keys, in the schema's order (canonical ordering — D1.4, byte-stable). Enum literals are the same words in the engine schema, this table and CLI errors — one concept, one spelling (§2.6 E34).

## Section 6: Change history

Template-level, append-only.

- 2026-09-18 — D-2 systematization: unified `Header + Section 0–4` family skeleton + `Section 5–6` template tails; clause-referencing style; §2.6 experience baking; the 4-value `source` enum kept schema-verbatim.
