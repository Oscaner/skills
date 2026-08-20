# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

A **multi-harness AI coding skills marketplace**. Skills work across Claude Code, Cursor, Droid, Pi, Grok, Qoder, Codex, and Gemini. Personal skills are packaged as installable plugins consumed by AI coding harnesses.

Five plugins ship here:

1. **osuperpowers** — first-party, in-tree at `packages/osuperpowers/`. osuperpowers orchestration + cli-* family + CDD engine + gate.
2. **osuperpowers-router** — first-party, in-tree at `packages/osuperpowers-router/`. Trigger router: no skill bodies, maps upstream triggers to osuperpowers/mattpocock targets.
3. **superpowers** — vendored submodule at `vendors/superpowers/`. Upstream workflow skills read by osuperpowers orchestrators.
4. **mattpocock-skills** — vendored submodule at `vendors/mattpocock-skills/`. Engineering precision skills (grilling, tdd, to-tickets, research).
5. **impeccable** — vendored submodule at `vendors/impeccable/`. Frontend design skills.

## Package-as-source architecture

The canonical registry `marketplace/source.json` is **derived**, not hand-edited. `pnpm run emit` rebuilds it from first-party `package.json#oscaner-plugin` fields and vendored assembly templates, then regenerates every harness-specific manifest (`.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`, `.qoder-plugin/`, `.agents/skills/`, `gemini-extension.json`, hooks files).

Adding a new first-party plugin: create `packages/<name>/package.json` with `oscaner-plugin` field → `pnpm run emit` auto-discovers and generates all manifests.

## Key commands

```bash
pnpm run emit       # regenerate all harness manifests from package.json
pnpm run emit:check # verify emit output is fresh (no drift, exit 1 if stale)
pnpm run validate   # full validation suite (emit check + plugin resolution + tests + version sync)
pnpm run changeset  # create a changeset for versioning
pnpm run version    # apply changesets to bump versions
```

CI runs `node scripts/ci-validate.mjs` on PRs to `develop` and `main` (12 validation blocks: emit freshness, plugin.json resolution, skill dirs, hooks, overrides build, rule-reference integrity, engine tests, version sync).

## Architecture details

- `packages/` — first-party plugins (osuperpowers + osuperpowers-router)
- `vendors/` — upstream submodules (superpowers / mattpocock-skills / impeccable); not edited in-tree
- `scripts/emit.mjs` — unified emit tool (derives source.json + all harness manifests)
- `scripts/ci-validate.mjs` — Node validation orchestration
- `packages/osuperpowers-router/hooks/` — hooks for Claude (`hooks.json`) and Cursor (`hooks-cursor.json`)
- `packages/osuperpowers/hooks/` — PreToolUse gate hooks for Claude + Cursor
- `packages/osuperpowers/bin/engine/` — CDD engine (cdd-task.mjs, cdd-review.mjs, runner.mjs, registry, templates)
- `packages/osuperpowers/bin/gate/adapters/` — per-harness gate adapters
- `packages/osuperpowers/docs/` — cross-cutting docs (cdd-reference, handoff-schema, review-dispatch, subagent-lifecycle)

For osuperpowers plugin internals (hooks matrix, overrides pattern, emit details, verification, releasing), see [`packages/osuperpowers/CLAUDE.md`](packages/osuperpowers/CLAUDE.md).

For overrides trigger router internals, see [`packages/osuperpowers-router/CLAUDE.md`](packages/osuperpowers-router/CLAUDE.md).

## Per-package documentation

- [`packages/osuperpowers/CLAUDE.md`](packages/osuperpowers/CLAUDE.md) — osuperpowers plugin internals
- [`packages/osuperpowers-router/CLAUDE.md`](packages/osuperpowers-router/CLAUDE.md) — overrides trigger router internals
- [`packages/osuperpowers/README.md`](packages/osuperpowers/README.md) — osuperpowers plugin user guide
- [`packages/osuperpowers-router/README.md`](packages/osuperpowers-router/README.md) — overrides plugin user guide

## Git conventions

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
- No attribution / co-author / AI-generation trailers.
- No `git worktree` — forbidden.
- `git add -f` on a gitignored file requires explicit user confirmation.
- **Do not commit** unless the user explicitly asks. Default is no commit.
- **After completing a feature/fix, create a changeset** via `pnpm run changeset` (or manually write a `.changeset/<slug>.md` file) before the final commit. If the user must remind you, treat it as a process violation and file a dogfood issue.

## Node.js

Node versions managed by **fnm**. When a project has `.nvmrc`, run `fnm use` before `node`/`npm`/`pnpm`. Never suggest nvm.

## Vendored submodules

Three submodules track upstream repos. To update:
```bash
git -C vendors/<name> fetch --tags origin
git -C vendors/<name> checkout <tag>
git add vendors/<name>
git commit -m "chore: bump <name> submodule"
```

Automated weekly sync via GitHub Actions (Submodule Sync workflow). Fresh clones need `git submodule update --init`.
