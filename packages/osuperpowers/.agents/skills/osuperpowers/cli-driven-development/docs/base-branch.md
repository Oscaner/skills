# Base Branch Methodology & Artifact Schema

Shared methodology for determining the **base branch** of a feature/fix, and the artifact schema used to persist the result. Consumed by the `cli-driven-development` (determine-base / branch-review) and `finishing` (read-base) orchestrator nodes via the `cdd base-branch` CLI.

## Methodology

The base branch is determined by trying the following sources **in order** and taking the first one that yields a definitive answer:

1. **Plan field** — If the plan document contains a `base` field, use its value directly.
2. **Branch upstream** — Run `git rev-parse --abbrev-ref @{u}`. If the current branch has a configured upstream, derive the base from it (typically the upstream's target branch).
3. **Conversation context** — If earlier messages in the current conversation explicitly mention a base branch (e.g., "merge into `develop`"), use that.

**Fallback:** If none of the above sources yields a result, **ask the user** to confirm the base branch. Do not guess.

## Artifact Schema

The determined base branch is persisted as a JSON file at the CDD workspace root:

```
.osuperpowers/cdd/<slug>/base-branch.json
```

### Schema

```json
{
  "base": "develop",
  "source": "plan-field",
  "confirmed_at": "2026-08-27T10:30:00Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `base` | string | The resolved base branch name (e.g., `develop`, `main`) |
| `source` | enum | How the base was determined: `"plan-field"`, `"branch-upstream"`, `"conversation-context"`, or `"user-confirmed"` |
| `confirmed_at` | string (ISO 8601) | Timestamp when the base branch was determined |

## Scope Resolution

The `<scope>` path segment depends on the execution context:

| Scenario | `scope` | `slug` source |
|----------|---------|---------------|
| CDD-driven session | `cdd` | CDD workspace slug (derived by the engine's `workspaceSlug`: plan doc filename with `.md` and a single trailing `-design` / `-plan` stripped) |

## CLI Usage

The engine CLI is the write/read path for the artifact (orchestrator skills do not hand-write it). The sole target form is the CDD plan:

| Subcommand | CDD (`--plan <path>`) |
|------------|----------------------|
| `set` | `cdd base-branch set --base <branch> --source <source> --plan <path>` → `<repoRoot>/.osuperpowers/cdd/<slug>/base-branch.json` |
| `get` | `cdd base-branch get --plan <path>` → artifact JSON on stdout |

`set` is **idempotent**: artifact absent → written with `confirmed_at` = now; same `base` present → rewritten with `source` updated and `base` / `confirmed_at` preserved (semantic no-op); different `base` present → refused (exit 2, existing authority untouched) unless `--force` overrides (new base → new `confirmed_at`).

**Validation errors** (exit 2, nothing written):

- missing `--base` / `--source`
- `source` not one of the four enum values (`plan-field` / `branch-upstream` / `conversation-context` / `user-confirmed`)
- `get`: artifact missing (orchestrator falls back to the inference sequence) or schema-invalid pre-existing artifact — never silently returns a bad value

**Flag boundaries** (exit 2): missing `--plan` → explicit error (the sole target is `--plan <path>`).
