# Marketplace source registry

The marketplace is **package-as-source**: `packages/<name>/package.json#oscaner-plugin` is the single source of truth. [source.json](./source.json) is a **derived emit product** — do not hand-edit it. All marketplace manifests are generated from the same source.

## Edit workflow

First-party plugins (`osuperpowers`):

1. Edit `packages/<name>/package.json` — the `oscaner-plugin` field (contentRoot, harnesses, hooks) is the SOT. Adding a package dir with that field auto-joins the emit; no hand registration.
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
| `.cursor-plugin/marketplace.json` | Cursor Team Marketplace |
| `packages/<name>/.cursor-plugin/plugin.json` | Cursor manifest at plugin root (**plugin-root mode**) |

Files include `"_generated": "… — do not edit"`. CI step 7 fails if emit output is stale.

## Cursor install modes

| Mode | `source.json` cursor block | Cursor marketplace `source` |
|------|---------------------------|----------------------------|
| **Wrapper** (default) | `displayName` + `skills` (+ optional `hooks`) | `cursor-plugins/<name>` |
| **Plugin-root** | `{ "emitMode": "plugin-root" }` only | `./<contentRoot>` (reads plugin's `.cursor-plugin/plugin.json`) |

**Plugin-root today:** **`osuperpowers`** (oscaner-generated manifests). The vendored wrapper emit under `cursor-plugins/` was removed with the vendors self-maintenance surface (P6 — upstream plugins install from their own publishers).

## Schema

[source.schema.json](./source.schema.json) validates required fields. `cursor` is **oneOf**: wrapper block or `{ "emitMode": "plugin-root" }`. Per-harness hooks are limited to the implemented harness set (`claude` / `cursor`) with repo-relative path patterns.

## Version truth

| Plugin | Canonical version source |
|--------|-------------------------|
| `osuperpowers` | `packages/osuperpowers/package.json` (SOT) |

Emit fails when `source.json` versions disagree with the truth sources.

## Cursor Team Marketplace

Import `https://github.com/Oscaner/skills` in Cursor Dashboard → Settings → Plugins → Team Marketplaces. Plugins resolve via `.cursor-plugin/marketplace.json`. **`osuperpowers`** installs from plugin root (`./packages/...`).
