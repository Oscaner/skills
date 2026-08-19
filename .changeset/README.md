# Changesets

We use [changesets](https://github.com/changesets/changesets) to manage releases for two packages: **`@oscaner-skills/osuperpowers-router`** (superpowers-relative scheme) and **`@oscaner-skills/osuperpowers`** (independent semver). Both are workspace packages under `packages/`; each releases independently when a changeset names it.

**Integration branch:** `develop` — feature PRs merge here and accumulate `.changeset/*.md` files.

**Release branch:** `main` — configured as `baseBranch` in [config.json](config.json). Version PRs, tags, and GitHub Releases happen only on `main`.

## When to add a changeset

Run `pnpm changeset` when you change behavior or wiring under `packages/osuperpowers-router/` or `packages/osuperpowers/`. Select the plugin(s) the change affects — a changeset may name both. Version bumps are computed per plugin by `node scripts/version-packages.mjs`:

- `@oscaner-skills/osuperpowers-router` → `{superpowers-semver}-overrides.{major}.{minor}.{patch}` (patch increment on the same superpowers base)
- `@oscaner-skills/osuperpowers` → plain semver bump (patch / minor / major per the changeset's declared type)

You do **not** need a changeset when you only bump the vendored `superpowers` submodule — the [submodule-sync workflow](.github/workflows/submodule-sync.yml) opens a PR against `develop` that sets `{semver}-overrides.0.0.0` directly; release happens after merging `develop → main`. This resets **overrides only**; osuperpowers keeps its independent semver.

## Version scheme

`@oscaner-skills/osuperpowers-router` follows `{superpowers-semver}-overrides.{major}.{minor}.{patch}`:

- `6.2.0-overrides.0.0.0` — aligned with superpowers 6.2.0, no overrides changes yet
- `6.2.0-overrides.0.15.0` — fifteenth overrides-only release on superpowers 6.2.0 base (minor segment tracks release count on base)
- `6.2.0-overrides.0.15.1` — next patch increment from changesets on the same base
- `6.3.0-overrides.0.0.0` — resets when superpowers base moves to 6.3.0 (any semver segment change, including patch, resets to `0.0.0`)

`@oscaner-skills/osuperpowers` follows plain semver (`0.1.x`), bumped independently of superpowers:

- `0.1.0` → `0.1.1` for a `patch` changeset
- `0.1.1` → `0.2.0` for a `minor` changeset

Its version is synced across `package.json`, `.claude-plugin/plugin.json` (SOT), `marketplace/source.json`, the emitted marketplace manifests, and the `<!-- osuperpowers-version: … -->` stamp in `packages/osuperpowers/skills/init/SKILL.md`.

## Release flow

1. Add a changeset in your PR (if needed) and merge to **`develop`**
2. Open a PR **`develop → main`**
3. Merge to **`main`** → [release.yml](.github/workflows/release.yml) opens a Version PR targeting **`main`**
4. Merge the Version PR on **`main`** → per-plugin git tag + GitHub Release for each plugin that had a changeset (`osuperpowers-router@{version}` and/or `osuperpowers@{version}`)
5. When `main` is ahead of `develop`, an automated **`main → develop`** sync PR opens — merge it manually to align `develop` with the released version

See [CLAUDE.md](../CLAUDE.md) and [README.md](../README.md) for full details.
