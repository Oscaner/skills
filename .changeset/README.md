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

`package.json` is the version single source of truth (SOT) for each package; osuperpowers's version is re-stamped into its per-harness emit products (`.claude-plugin/plugin.json`, `marketplace/source.json`, and the emitted marketplace manifests) by `pnpm run emit`. cdd-engine has no emit products; its version lives in its own `package.json` (with `CHANGELOG.md` once first released).

## Release flow

1. Add a changeset in your PR (if needed) and merge to **`develop`**
2. Open a PR **`develop → main`**
3. Merge to **`main`** → [release.yml](.github/workflows/release.yml) opens a Version PR targeting **`main`**: changesets/action runs `pnpm exec changeset version && pnpm run emit` — the native version consumes the changesets, bumps both packages' `package.json` versions and writes their CHANGELOGs, and `emit` re-stamps the osuperpowers emit products so version-sync stays green on the Version PR
4. Merge the Version PR on **`main`** → push again, now in publish mode (`hasChangesets=false`): `changeset publish` builds and publishes the first-party packages with bumped versions to npm; then the `release-plugin` matrix job pushes a git tag + GitHub Release for each package whose current version is newer than its latest git tag (`osuperpowers@{version}` / `cdd-engine@{version}`, judged by git-tag vs package.json semver; an empty tag list = first release → versioned)
5. When `main` is ahead of `develop`, an automated **`main → develop`** sync PR opens — merge it manually to align `develop` with the released version

Version mode (merging to `main` while opening a Version PR — `hasChangesets=true`): `release-plugin` and `sync-develop` do not run; publish, tags, and GitHub Releases are deferred to the next publish-mode push after the Version PR merges.

## Release wiring essentials (P4.2 first release, 2026-09-27)

Five hard-won wiring constraints for anyone touching [release.yml](.github/workflows/release.yml) / the npm auth surface:

- **changesets/action v2 inputs are renamed** — use `version-script`, `publish-script`, `commit-message`, `pr-title`, `create-github-releases`. The old `version:`/`publish:`/`commit:`/`title:` names hard-fail in v2 ("The following inputs have been renamed").
- **No `&&` inside `version-script`** — the action tokenizes the script by spaces and feeds the tail to `changeset version` as unused args (`CACError: Unused args`). Wrap compounds in a root npm script (`ci:version` = `changeset version && pnpm run emit`).
- **npm auth = `actions/setup-node`, not a committed `.npmrc`** — give setup-node a `registry-url` and set `NODE_AUTH_TOKEN`; it writes a job-scoped, untracked `.npmrc` with the literal token. A committed project `.npmrc` with `${NPM_TOKEN}` interpolation is refused by pnpm (hardened against secret leakage) — the publish dies anonymously with `E404 PUT /@scope/package - Not found` for a new scoped package, indistinguishable from a permission error (this blocked P4.2's first release across several token swaps).
- **The action's output is `has-changesets`** (kebab-case, v2) — the downstream `release-plugin` / `sync-develop` `if:` conditions read the job output wired to it; using the old `hasChangesets` name silently SKIPS tags/Releases/sync while the publish itself succeeds (packages land on npm, the release tail is missing).
- **No hand-pinned versions in shipped docs** — the root README plugin table must not carry a literal version: it drifts on the versioned tree and red-lights a consistency probe on every Version PR. Version single source = `package.json` → emit products → npm.

See [CLAUDE.md](../CLAUDE.md) and [README.md](../README.md) for full details.
