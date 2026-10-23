# Marketplace source registry

The marketplace is **package-as-source**: `packages/<name>/package.json#oscaner` is the single source of truth. [source.json](./source.json) is a **derived emit product** — do not hand-edit it. All marketplace manifests are generated from the same source.

## Edit workflow

First-party plugins (`kairos`):

1. Edit `packages/<name>/package.json` — the `oscaner` field (contentRoot, harnesses, keywords, claude) is the SOT. Adding a package dir with that field auto-joins the emit; no hand registration.
2. Run emit:

```bash
pnpm run emit
```

3. Validate:

```bash
pnpm run validate
```

4. Commit `package.json` and all generated files together.

## Generated outputs (do not hand-edit)

| Path | Harness |
|------|---------|
| `marketplace/source.json` | Derived aggregate (package-as-source emit product) |
| `.claude-plugin/marketplace.json` | Claude Code |

Files include `"_generated": "… — do not edit"`. CI step 7 fails if emit output is stale.

## Schema

[source.schema.json](./source.schema.json) validates required fields. Per-harness hooks are limited to the keys the schema accepts (`claude` / `codex` / `qoder`) with repo-relative path patterns.

## Version truth

| Plugin | Canonical version source |
|--------|-------------------------|
| `kairos` | `packages/kairos/package.json` (SOT) |

Emit fails when `source.json` versions disagree with the truth sources.
