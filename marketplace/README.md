# Marketplace source registry

Humans edit **only** [source.json](./source.json). All marketplace manifests are generated.

## Edit workflow

1. Change [source.json](./source.json) (plugin metadata, versions, Cursor wrapper paths).
2. Run emit:

```bash
pnpm run emit
```

3. Validate:

```bash
pnpm run validate
```

4. Commit `source.json` and all generated files together.

## Generated outputs (do not hand-edit)

| Path | Harness |
|------|---------|
| `.claude-plugin/marketplace.json` | Claude Code |
| `.cursor-plugin/marketplace.json` | Cursor Team Marketplace |
| `cursor-plugins/<name>/.cursor-plugin/plugin.json` | Cursor plugin wrappers |

Files include `"_generated": "scripts/emit-marketplace.mjs — do not edit"`. CI step 7 fails if emit output is stale.

## Schema

[source.schema.json](./source.schema.json) validates required fields. Each plugin needs a `cursor` block with `displayName` and `skills` (string path relative to `cursor-plugins/<name>/`).

## Version truth

| Plugin | Canonical version source |
|--------|-------------------------|
| `superpowers-overrides` | `superpowers-overrides/package.json` |
| `superpowers` | `superpowers/.claude-plugin/plugin.json` |
| `impeccable` | `impeccable/plugin/.claude-plugin/plugin.json` |
| `mattpocock-skills` | `mattpocock-skills/.claude-plugin/plugin.json` (optional in source) |

Emit fails when `source.json` versions disagree with truth sources.

## Cursor Team Marketplace

Import `https://github.com/Oscaner/skills` in Cursor Dashboard → Settings → Plugins → Team Marketplaces. All four plugins resolve via `.cursor-plugin/marketplace.json` and `cursor-plugins/` wrappers.
