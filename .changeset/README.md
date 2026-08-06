# Changesets

We use [changesets](https://github.com/changesets/changesets) to manage releases for `superpowers-overrides`.

**Integration branch:** `develop` — feature PRs merge here and accumulate `.changeset/*.md` files.

**Release branch:** `main` — configured as `baseBranch` in [config.json](config.json). Version PRs, tags, and GitHub Releases happen only on `main`.

## When to add a changeset

Run `pnpm changeset` when you change overrides skill behavior, manifest wiring, or build output under `plugins/superpowers-overrides/`.

You do **not** need a changeset when you only bump the vendored `superpowers` submodule — the [submodule-sync workflow](.github/workflows/submodule-sync.yml) opens a PR against `develop` that sets `{semver}-overrides.0.0.0` directly; release happens after merging `develop → main`.

## Version scheme

Versions follow `{superpowers-semver}-overrides.{major}.{minor}.{patch}`:

- `6.2.0-overrides.0.0.0` — aligned with superpowers 6.2.0, no overrides changes yet
- `6.2.0-overrides.0.15.0` — fifteenth overrides-only release on superpowers 6.2.0 base (minor segment tracks release count on base)
- `6.2.0-overrides.0.15.1` — next patch increment from changesets on the same base
- `6.3.0-overrides.0.0.0` — resets when superpowers base moves to 6.3.0 (any semver segment change, including patch, resets to `0.0.0`)

## Release flow

1. Add a changeset in your PR (if needed) and merge to **`develop`**
2. Open a PR **`develop → main`**
3. Merge to **`main`** → [release.yml](.github/workflows/release.yml) opens a Version PR targeting **`main`**
4. Merge the Version PR on **`main`** → git tag `superpowers-overrides@{version}` and GitHub Release
5. When `main` is ahead of `develop`, an automated **`main → develop`** sync PR opens — merge it manually to align `develop` with the released version

See [CLAUDE.md](../CLAUDE.md) and [README.md](../README.md) for full details.
