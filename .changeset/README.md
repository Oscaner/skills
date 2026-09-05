# Changesets

We use [changesets](https://github.com/changesets/changesets) to manage releases for the first-party plugin **`@oscaner-skills/osuperpowers`** (independent semver). It is a workspace package under `packages/`; it releases when a changeset names it.

**Integration branch:** `develop` — feature PRs merge here and accumulate `.changeset/*.md` files.

**Release branch:** `main` — configured as `baseBranch` in [config.json](config.json). Version PRs, tags, and GitHub Releases happen only on `main`.

## When to add a changeset

Run `pnpm changeset` when you change behavior or wiring under `packages/osuperpowers/`. Version bumps are computed by `pnpm run version` (`node scripts/run.mjs version`):

- `@oscaner-skills/osuperpowers` → plain semver bump (patch / minor / major per the changeset's declared type)

You do **not** need a changeset when you only bump a vendored submodule (`superpowers` / `mattpocock-skills` / `impeccable`) — the [submodule-sync workflow](.github/workflows/submodule-sync.yml) opens a PR against `develop` with the new pin; osuperpowers keeps its independent semver.

## Version scheme

`@oscaner-skills/osuperpowers` follows plain semver (`0.1.x`), bumped independently of superpowers:

- `0.1.0` → `0.1.1` for a `patch` changeset
- `0.1.1` → `0.2.0` for a `minor` changeset

Its version is synced across `package.json`, `.claude-plugin/plugin.json` (SOT), `marketplace/source.json`, the emitted marketplace manifests, and the `<!-- osuperpowers-version: … -->` stamp in `packages/osuperpowers/skills/init/SKILL.md`.

## Release flow

1. Add a changeset in your PR (if needed) and merge to **`develop`**
2. Open a PR **`develop → main`**
3. Merge to **`main`** → [release.yml](.github/workflows/release.yml) opens a Version PR targeting **`main`**
4. Merge the Version PR on **`main`** → publish mode: `publish-vendor` job runs npm assembly publish for each vendor (skip-if-published idempotency), then emits a `to_tag` registry gap list → `release-vendor` creates git tag (`superpowers@6.2.0` etc.) + GitHub Release (body: assembled from upstream `<repo>@<tag>`) for each gap item
5. In the same publish mode push: per-plugin git tag + GitHub Release for each first-party plugin that had a changeset (`osuperpowers@{version}`)
6. When `main` is ahead of `develop`, an automated **`main → develop`** sync PR opens — merge it manually to align `develop` with the released version

Version mode (merging to `main` while opening a Version PR — `hasChangesets=true`): `publish-vendor` and `release-vendor` do not run; vendor publish is deferred to the next publish-mode push after the Version PR merges.

See [CLAUDE.md](../CLAUDE.md) and [README.md](../README.md) for full details.

## Vendor publishing

`@oscaner-skills/{superpowers,mattpocock-skills,impeccable}` are assembled from vendored submodules and published to npm alongside first-party packages during each publish-mode release. Versions come from upstream (`.claude-plugin/plugin.json` or submodule `vX.Y.Z` release tags) — they do not use changesets. Published packages carry `pi` keys + upstream multi-harness manifests (preserved verbatim) + mattpocock thin `gemini-extension.json`.

Each publish-mode push runs a registry full-consistency sweep: every npm version that lacks a `name@version` git tag or corresponding GitHub Release is listed in the `to_tag` output, and `release-vendor` creates both for each gap item. Reruns are idempotent (tag-exists / release-exists checks). Vendor publish failure blocks the entire release (`release-plugin` and `sync-develop` wait on `publish-vendor`).
