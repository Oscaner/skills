# Marketplace source registry

Humans edit **only** [source.json](./source.json). All marketplace manifests are generated.

## Edit workflow

1. Change [source.json](./source.json) (plugin metadata, versions, Cursor paths).
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
| `cursor-plugins/<name>/.cursor-plugin/plugin.json` | Cursor plugin wrappers (**wrapper mode only**) |
| `packages/superpowers-overrides/.cursor-plugin/plugin.json` | Cursor manifest at plugin root — oscaner **generated** (`emitMode: plugin-root`) |
| `vendors/superpowers/.cursor-plugin/plugin.json` | Cursor manifest at plugin root — **upstream submodule (not emit)** |

Files include `"_generated": "… — do not edit"`. CI step 7 fails if emit output is stale.

## Cursor install modes

| Mode | `source.json` cursor block | Cursor marketplace `source` |
|------|---------------------------|----------------------------|
| **Wrapper** (default) | `displayName` + `skills` (+ optional `hooks`) | `cursor-plugins/<name>` |
| **Plugin-root** | `{ "emitMode": "plugin-root" }` only | `./<contentRoot>` (reads plugin's `.cursor-plugin/plugin.json`) |

**Plugin-root today:** `superpowers-overrides` and **`engineering`** (oscaner-generated manifests) and **`superpowers`** (upstream submodule manifest). Other plugins keep wrapper emit. See [cursor-plugins/README.md](../cursor-plugins/README.md) for the hybrid rule and upgrade checklist.

## Schema

[source.schema.json](./source.schema.json) validates required fields. `cursor` is **oneOf**: wrapper block or `{ "emitMode": "plugin-root" }`.

## Version truth

| Plugin | Canonical version source |
|--------|-------------------------|
| `superpowers-overrides` | `packages/superpowers-overrides/package.json` |
| `superpowers` | `vendors/superpowers/.claude-plugin/plugin.json` |
| `impeccable` | `vendors/impeccable/plugin/.claude-plugin/plugin.json` |
| `mattpocock-skills` | `vendors/mattpocock-skills/.claude-plugin/plugin.json` (optional in source) |

Emit fails when `source.json` versions disagree with truth sources.

## Cursor Team Marketplace

Import `https://github.com/Oscaner/skills` in Cursor Dashboard → Settings → Plugins → Team Marketplaces. Plugins resolve via `.cursor-plugin/marketplace.json`. **`superpowers-overrides`**, **`engineering`**, and **`superpowers`** install from plugin root (`./packages/...`/`./vendors/...`); see [cursor-plugins/README.md](../cursor-plugins/README.md).
