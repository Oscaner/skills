# Changesets

We use [changesets](https://github.com/changesets/changesets) to manage releases for `superpowers-overrides`.

## When to add a changeset

Run `npx changeset` when you change overrides skill behavior, manifest wiring, or build output under `superpowers-overrides/`.

You do **not** need a changeset when you only bump the vendored `superpowers` submodule — the release workflow auto-creates an align changeset on merge to `main`.

## Version scheme

Versions follow `{superpowers-semver}-overrides.{N}`:

- `6.2.0-overrides.1` — first overrides release for superpowers 6.2.0
- `6.2.0-overrides.2` — next overrides-only release on the same superpowers base
- `6.3.0-overrides.1` — resets when `marketplace.json` superpowers version moves to 6.3.0

## Release flow

1. Add a changeset in your PR (if needed)
2. Merge to `main`
3. Release workflow opens a Version PR
4. Merge the Version PR → git tag `superpowers-overrides@{version}`

See [CLAUDE.md](../CLAUDE.md) and [README.md](../README.md) for full details.
