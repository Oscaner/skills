# Base Branch Methodology & Artifact Schema

Shared methodology for determining the **base branch** of a feature branch, and the artifact schema that persists the result. Consumed by `cdd-dev` (determine-base · set-base / branch-review) and `cdd-close` (reads `base.json` inside `run-cdd-close-session`) via the `cdd base` CLI.

> Inference is orchestration responsibility; persistence is the engine's. The orchestrator infers, the engine writes and validates — no hand-written artifacts (the engine CLI is the sole write/read path).

## Header

Doc metadata — not an artifact section:

- **Class**: methodology-doc
- **Consumers**: `cdd-dev` (determine-base · set-base / branch-review) · `cdd-close` (reads `base.json` in `run-cdd-close-session`)
- **Skeleton**: `Header` + `Section 0–5` fixed order — `Section 0–4` methodology body (Purpose → Inference order → Artifact schema → Scope resolution → CLI usage) + `Section 5` naming tail
- **Canonical**: the `cdd base` command face of the engine CLI — the flag surface and the artifact schema this document mirrors; the doc and the CLI speak one vocabulary

---

## Section 0: Purpose

This document governs two things: the deterministic inference order (Section 1) and the persisted artifact that records the result (Sections 2–4). It is the single delegation target for base determination — the skills reference it instead of re-implementing the sequence.

## Section 1: Methodology — base inference order

The base branch is determined by trying these sources **in order** and taking the first source that yields a definitive answer:

1. **Plan field** — if the plan document contains a `base` field, use its value directly.
2. **Branch upstream** — run `git rev-parse --abbrev-ref @{u}`. If the current branch has a configured upstream, derive the base from it (typically the upstream's target branch).
3. **Conversation context** — if earlier messages in the current conversation explicitly mention a base branch (e.g., "merge into `develop`"), use that.

**Fallback:** if none of the above yields a result, **ask the user** to confirm the base branch. Do not guess — a guessed base is a claim the merge will not honor; asking is the honest counterpart.

For inference, these are the only channels: argv (the plan field) · git facts (branch upstream) · conversation context — the three input channels, no disk-resident context, and a source outside this list is not consulted for inference. The base may already be present in the artifact (`cdd base get --plan <path>`); the artifact read precedes the inference sequence — when the artifact is present, skip the inference channels and use the artifact value as-is.

## Section 2: Artifact schema

The determined base branch is persisted as a JSON file at the CDD workspace root:

```
.kairos/cdd/<slug>/base.json
```

```json
{
  "base": "develop",
  "source": "plan-field",
  "plan": "docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.2.md",
  "recordedAt": "2026-10-09T09:30:00Z"
}
```

| Field | Type | Description |
|---|---|---|
| `base` | string | the resolved base branch name (e.g., `develop`, `main`) |
| `source` | enum (4 values) | how the base was determined: `plan-field` / `branch-upstream` / `conversation-context` / `user-confirmed` |
| `plan` | string | the plan path the artifact serves (the single CDD `--plan` target) |
| `recordedAt` | string (ISO 8601) | timestamp when the base branch was determined |

The 4-value `source` enum is a verified count — the engine schema and this table mirror each other exactly. `recordedAt` is the moment of determination, not the moment of read — the reader must re-check rather than trust a stale timestamp.

## Section 3: Scope resolution

The scope path segment is fixed to `cdd`; the artifact always lives at `.kairos/cdd/<slug>/base.json`. The only per-session variable is the `slug`:

| Slug source | Derivation |
|---|---|
| CDD workspace slug | derived by the engine's workspace slug resolution: plan doc filename with `.md` and a single trailing `-design` / `-plan` stripped |

One root, one slug: the workspace root is the single authority for where artifacts live — the path is derived, never hand-supplied.

## Section 4: CLI usage

The engine CLI is the write/read path for the artifact — orchestrator skills do not hand-write it. The sole target form is the CDD plan:

| Subcommand | Usage |
|---|---|
| `set` | `cdd base set --plan <path> --base <branch> --source <source> [--force]` → `<repoRoot>/.kairos/cdd/<slug>/base.json` |
| `get` | `cdd base get --plan <path>` → artifact JSON on stdout |

`set` is **repeatable, never a no-op**: every successful `set` writes a fresh artifact — `base` / `source` / `plan` taken from the command arguments, `recordedAt` = now. The existing artifact is read only to enforce the base-consistency guard: same `base` present → still rewritten, with `recordedAt` refreshed (the previous timestamp is never preserved); different `base` present → refused (exit 2, the artifact on disk stays untouched) unless `--force` passes a new `base`.

**Validation errors** (exit 2, nothing written): missing `--base` / `--source`; `source` not one of the four enum values; missing `--plan` → explicit error (the sole target is `--plan <path>`); `get` on a missing or schema-invalid artifact — never silently returns a bad value (the orchestrator falls back to the inference sequence of Section 1).

Every failure path is `exit 2` + nothing written — a mechanical guard, not a soft warning: a reader is never handed a value the schema did not check.

---

## Section 5: Naming & placeholders

Placeholder / literal vocabulary:

| Placeholder | Meaning |
|---|---|
| `<slug>` | workspace slug — derived, lowercase |
| `<branch>` / `<source>` | `set`-command arguments mirroring the schema fields |
| `<path>` / `<repoRoot>` | plan path (the sole `--plan` target) / repo-root prefix |
| `source` enum literals | `plan-field` / `branch-upstream` / `conversation-context` / `user-confirmed` — full-word, scope-prefixed semantics |

JSON keys are the schema's keys, in the schema's order (canonical ordering — byte-stable). Enum literals are the same words in the engine schema, this table and CLI errors — one concept, one spelling.
