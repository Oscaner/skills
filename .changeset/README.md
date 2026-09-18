# Changesets

We use [changesets](https://github.com/changesets/changesets) to manage releases for the first-party plugin **`@oscaner-skills/osuperpowers`** (independent semver). It is a workspace package under `packages/`; it releases when a changeset names it.

**Integration branch:** `develop` — feature PRs merge here and accumulate `.changeset/*.md` files.

**Release branch:** `main` — configured as `baseBranch` in [config.json](config.json). Version PRs, tags, and GitHub Releases happen only on `main`.

## When to add a changeset

Run `pnpm changeset` when you change behavior or wiring under `packages/osuperpowers/`. Version bumps are computed by `pnpm run version` (`node scripts/run.mjs version`):

- `@oscaner-skills/osuperpowers` → plain semver bump (patch / minor / major per the changeset's declared type)

## Version scheme

`@oscaner-skills/osuperpowers` follows plain semver (`0.1.x`), bumped independently of superpowers:

- `0.1.0` → `0.1.1` for a `patch` changeset
- `0.1.1` → `0.2.0` for a `minor` changeset

Its version is synced across `package.json`, `.claude-plugin/plugin.json` (SOT), `marketplace/source.json`, and the emitted marketplace manifests.

## Release flow

1. Add a changeset in your PR (if needed) and merge to **`develop`**
2. Open a PR **`develop → main`**
3. Merge to **`main`** → [release.yml](.github/workflows/release.yml) opens a Version PR targeting **`main`**
4. Merge the Version PR on **`main`** → push again, now in publish mode (`hasChangesets=false`): `pnpm run emit` regenerates the manifests and `changeset publish` builds and publishes the first-party packages with bumped versions to npm; then the `release-plugin` matrix job pushes a git tag + GitHub Release for each plugin that was actually versioned (`osuperpowers@{version}`, skip-if-published idempotency)
5. When `main` is ahead of `develop`, an automated **`main → develop`** sync PR opens — merge it manually to align `develop` with the released version

Version mode (merging to `main` while opening a Version PR — `hasChangesets=true`): `release-plugin` and `sync-develop` do not run; publish, tags, and GitHub Releases are deferred to the next publish-mode push after the Version PR merges.

See [CLAUDE.md](../CLAUDE.md) and [README.md](../README.md) for full details.
