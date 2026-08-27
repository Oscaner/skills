# Base Branch Methodology & Artifact Schema

Shared methodology for determining the **base branch** of a feature/fix, and the artifact schema used to persist the result. Consumed by the finishing skill's `read-base` node (P6) and the CDD startup phase (P8).

## Methodology

The base branch is determined by trying the following sources **in order** and taking the first one that yields a definitive answer:

1. **Plan field** — If the plan document contains a `base` field, use its value directly.
2. **Branch upstream** — Run `git rev-parse --abbrev-ref @{u}`. If the current branch has a configured upstream, derive the base from it (typically the upstream's target branch).
3. **Conversation context** — If earlier messages in the current conversation explicitly mention a base branch (e.g., "merge into `develop`"), use that.

**Fallback:** If none of the above sources yields a result, **ask the user** to confirm the base branch. Do not guess.

## Artifact Schema

The determined base branch is persisted as a JSON file at:

```
.superpowers/<scope>/<slug>/base-branch.json
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
| `source` | enum | How the base was determined: `"plan-field"`, `"branch-upstream"`, or `"user-confirmed"` |
| `confirmed_at` | string (ISO 8601) | Timestamp when the base branch was determined |

## Scope Resolution

The `<scope>` path segment depends on the execution context:

| Scenario | `scope` | `slug` source |
|----------|---------|---------------|
| CDD-driven session | `cdd` | CDD workspace slug |
| Standalone finishing | `standalone` | Sanitized feature branch name |

## Slug Sanitize Rules

Branch names and other identifiers are sanitized before use as path segments:

1. **Lowercase** the entire string
2. **Replace** every non-alphanumeric character (`/`, space, `_`, `.`, etc.) with `-`
3. **Trim** leading and trailing `-` characters
4. **Collapse** consecutive `-` into a single `-`
5. **Truncate** to 64 characters

### Examples

| Input | Output |
|-------|--------|
| `feature/my-branch` | `feature-my-branch` |
| `Bugfix/UI_Fix` | `bugfix-ui-fix` |
| `refs/heads/release-2026.08` | `refs-heads-release-2026-08` |

## Consumer Integration

### Finishing `read-base` node (P6)

The finishing skill's `read-base` node reads the `base-branch.json` artifact. If the artifact does not exist, it falls back to asking the user and writes the result to the artifact for future reads.

### CDD startup phase (P8)

At CDD session startup, the orchestrator runs the determine-base methodology and writes the result to the artifact before any task execution begins.

### CDD branch-review

The CDD branch-review reads the artifact to obtain the `BASE` parameter, replacing the previous hardcoded `origin/develop` reference.
