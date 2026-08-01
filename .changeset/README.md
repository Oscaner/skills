# Changesets

We use [changesets](https://github.com/changesets/changesets) to manage releases for `superpowers-overrides`.

## When to add a changeset

Run `pnpm changeset` when you change overrides skill behavior, manifest wiring, or build output under `plugins/superpowers-overrides/`.

You do **not** need a changeset when you only bump the vendored `superpowers` submodule — the [submodule-sync workflow](.github/workflows/submodule-sync.yml) opens a PR that sets `{semver}-overrides.0` directly; merge triggers [release.yml](.github/workflows/release.yml) to create the git tag and GitHub Release when missing.

## Version scheme

Versions follow `{superpowers-semver}-overrides.{N}`:

- `6.2.0-overrides.0` — aligned with superpowers 6.2.0, no overrides changes yet
- `6.2.0-overrides.1` — first overrides-only release on superpowers 6.2.0 base
- `6.2.0-overrides.2` — next overrides-only release on the same base
- `6.3.0-overrides.0` — resets when superpowers base moves to 6.3.0

## Release flow

1. Add a changeset in your PR (if needed)
2. Merge to `main`
3. Release workflow opens a Version PR
4. Merge the Version PR → git tag `superpowers-overrides@{version}`

See [CLAUDE.md](../CLAUDE.md) and [README.md](../README.md) for full details.
