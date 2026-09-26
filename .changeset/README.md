# Changesets

We use [changesets](https://github.com/changesets/changesets) to manage releases for the first-party packages **`@oscaner-skills/osuperpowers`** and **`@oscaner-skills/cdd-engine`** (independent semver per package). They are workspace packages under `packages/`; a package releases when a changeset names it.

**Integration branch:** `develop` — feature PRs merge here and accumulate `.changeset/*.md` files.

**Release branch:** `main` — configured as `baseBranch` in [config.json](config.json). Version PRs, tags, and GitHub Releases happen only on `main`.

## When to add a changeset

Run `pnpm changeset` when you change behavior or wiring under `packages/osuperpowers/` or `packages/cdd-engine/`. Version bumps are computed by the native `changeset version`, run by the changesets/action on the Version PR:

- `@oscaner-skills/osuperpowers` → plain semver bump (patch / minor / major per the changeset's declared type)
- `@oscaner-skills/cdd-engine` → plain semver bump (patch / minor / major per the changeset's declared type)

## Version scheme

Both packages follow plain semver, bumped independently of each other:

- `0.1.0` → `0.1.1` for a `patch` changeset
- `0.1.1` → `0.2.0` for a `minor` changeset
- cdd-engine (`0.1.0` baseline + accumulated majors) → **`1.0.0` first stable release** — modern changesets do not fold a 0.x major into a minor, so `semver.inc("0.1.0", "major") = "1.0.0"` (no 2.0.0 jump)

osuperpowers's version is synced across `package.json`, `.claude-plugin/plugin.json` (SOT), `marketplace/source.json`, and the emitted marketplace manifests. cdd-engine has no emit products; its version lives in its own `package.json` (with `CHANGELOG.md` once first released).

## Release flow

1. Add a changeset in your PR (if needed) and merge to **`develop`**
2. Open a PR **`develop → main`**
3. Merge to **`main`** → [release.yml](.github/workflows/release.yml) opens a Version PR targeting **`main`**: changesets/action runs `pnpm exec changeset version && pnpm run emit` — the native version consumes the changesets, bumps both packages' `package.json` versions and writes their CHANGELOGs, and `emit` re-stamps the osuperpowers emit products so version-sync stays green on the Version PR
4. Merge the Version PR on **`main`** → push again, now in publish mode (`hasChangesets=false`): `changeset publish` builds and publishes the first-party packages with bumped versions to npm; then the `release-plugin` matrix job pushes a git tag + GitHub Release for each package whose current version is newer than its latest git tag (`osuperpowers@{version}` / `cdd-engine@{version}`, judged by git-tag vs package.json semver; an empty tag list = first release → versioned)
5. When `main` is ahead of `develop`, an automated **`main → develop`** sync PR opens — merge it manually to align `develop` with the released version

Version mode (merging to `main` while opening a Version PR — `hasChangesets=true`): `release-plugin` and `sync-develop` do not run; publish, tags, and GitHub Releases are deferred to the next publish-mode push after the Version PR merges.

See [CLAUDE.md](../CLAUDE.md) and [README.md](../README.md) for full details.
