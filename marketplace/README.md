# Marketplace source registry

The marketplace is **package-as-source**: `packages/<name>/package.json#oscaner-plugin` (first-party) and the vendored submodule descriptors (`vendors/<name>` + the assembly template in `scripts/release/vendor-assembly.mjs`) are the single source of truth. [source.json](./source.json) is a **derived emit product** — do not hand-edit it. All marketplace manifests are generated from the same source.

## Edit workflow

First-party plugins (`osuperpowers`, `osuperpowers-router`):

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

Vendored plugins (`mattpocock-skills`, `impeccable`, `superpowers`): changes belong upstream — bump the submodule (weekly sync workflow, or `git submodule update --remote <name>`). The version resolves from the vendored `.claude-plugin/plugin.json` with a release-tag fallback, shared between `scripts/release/publish-vendor.mjs` and the emit chain so the published npm version and the marketplace declaration never disagree. There is no in-repo package.json to edit. These vendored plugins are assembled and published to npm (`@oscaner-skills/*`) during each publish-mode release via `scripts/release/publish-vendor.mjs`, with skip-if-published idempotency and a registry full-consistency sweep for git tags and GitHub Releases.

## Generated outputs (do not hand-edit)

| Path | Harness |
|------|---------|
| `marketplace/source.json` | Derived aggregate (package-as-source emit product) |
| `.claude-plugin/marketplace.json` | Claude Code |
| `.cursor-plugin/marketplace.json` | Cursor Team Marketplace |
| `cursor-plugins/<name>/.cursor-plugin/plugin.json` | Cursor plugin wrappers (**wrapper mode only**) |
| `packages/osuperpowers-router/.cursor-plugin/plugin.json` | Cursor manifest at plugin root — oscaner **generated** (`emitMode: plugin-root`) |
| `vendors/superpowers/.cursor-plugin/plugin.json` | Cursor manifest at plugin root — **upstream submodule (not emit)** |

Files include `"_generated": "… — do not edit"`. CI step 7 fails if emit output is stale.

## Cursor install modes

| Mode | `source.json` cursor block | Cursor marketplace `source` |
|------|---------------------------|----------------------------|
| **Wrapper** (default) | `displayName` + `skills` (+ optional `hooks`) | `cursor-plugins/<name>` |
| **Plugin-root** | `{ "emitMode": "plugin-root" }` only | `./<contentRoot>` (reads plugin's `.cursor-plugin/plugin.json`) |

**Plugin-root today:** `osuperpowers-router` and **`osuperpowers`** (oscaner-generated manifests) and **`superpowers`** (upstream submodule manifest). Other plugins keep wrapper emit under `cursor-plugins/` (vendored upstreams only); the old hybrid-rule detail doc was removed with the P7d cleanup.

## Schema

[source.schema.json](./source.schema.json) validates required fields. `cursor` is **oneOf**: wrapper block or `{ "emitMode": "plugin-root" }`. Per-harness hooks are limited to the implemented harness set (`claude` / `cursor`) with repo-relative path patterns.

## Version truth

| Plugin | Canonical version source |
|--------|-------------------------|
| `osuperpowers-router` | `packages/osuperpowers-router/package.json` (SOT; emit re-stamps every derived product from it) |
| `osuperpowers` | `packages/osuperpowers/package.json` (SOT) |
| `superpowers` | `vendors/superpowers/.claude-plugin/plugin.json` |
| `impeccable` | `vendors/impeccable/plugin/.claude-plugin/plugin.json` |
| `mattpocock-skills` | vendored `.claude-plugin/plugin.json` → `vX.Y.Z` release tag at submodule HEAD (fallback) |

Emit fails when `source.json` versions disagree with the truth sources.

## Cursor Team Marketplace

Import `https://github.com/Oscaner/skills` in Cursor Dashboard → Settings → Plugins → Team Marketplaces. Plugins resolve via `.cursor-plugin/marketplace.json`. **`osuperpowers-router`**, **`osuperpowers`**, and **`superpowers`** install from plugin root (`./packages/...`/`./vendors/...`).
