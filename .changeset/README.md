# Changesets

We use [changesets](https://github.com/changesets/changesets) to manage releases for `superpowers-overrides`.

**Integration branch:** `develop` (configured as `baseBranch` in [config.json](config.json)).

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

1. Add a changeset in your PR (if needed)
2. Merge PR to **`develop`**
3. [changesets-version workflow](.github/workflows/changesets-version.yml) opens a Version PR against **`develop`**
4. Merge the Version PR on **`develop`** (bumps version on develop only)
5. Open a separate PR **`develop → main`**
6. Merge to **`main`** → git tag `superpowers-overrides@{version}` and GitHub Release from [release.yml](.github/workflows/release.yml)

See [CLAUDE.md](../CLAUDE.md) and [README.md](../README.md) for full details.
