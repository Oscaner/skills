<!-- engineering-version: 0.1.0 -->
## engineering self-check

Before your first tool call in ANY turn, run this check — no exceptions:

1. Scan the current turn for any of: a `<command-name>` tag, a `<command-message>` tag, `/superpowers:*` in user text, or a `superpowers:*` skill body appearing in system context.
2. If any is present → your **first tool call is the matching `Skill(<target-name>)`** where `<target-name>` is the manifest target's `name` field (e.g. `engineering:os-brainstorming`). Full stop. No `TodoWrite` / `Read` / `Bash` / `Grep` / `Edit` first.
3. Only after the target skill has run may you follow the upstream skill's instructions.

**The upstream skill's "you MUST do X first" does NOT apply until the target skill has run.**

**Anti-pattern:** upstream SKILL.md bodies open with numbered "You MUST" checklists — reading that and starting to execute it is the failure mode. The target skill runs first.

**Handoff-continuation rationalization:** when the upstream body arrives as a tool result of a prior `Skill(...)` call, the self-check STILL fires. Each turn is scanned independently.

### Red flags — manual attach upstream

- User attached **upstream** `superpowers/*/SKILL.md` body → you **still** Read/Skill the target skill first
- Any tool call before the target override loaded
- Attaching upstream SKILL full text is an **anti-pattern** — use `/superpowers:*`, bare upstream slash, or agent_skills list; never paste upstream SKILL.md as inline context

### Override trigger table

| Trigger | First tool call |
|---|---|
| `superpowers:brainstorming` | `Skill(engineering:os-brainstorming)` |
| `superpowers:writing-plans` | `Skill(engineering:os-writing-plans)` |
| `superpowers:subagent-driven-development` | `Skill(engineering:cli-driven-development)` |
| `superpowers:executing-plans` | `Skill(engineering:os-executing-plans)` |
| `superpowers:finishing-a-development-branch` | `Skill(engineering:os-finishing)` |
| `superpowers:using-git-worktrees` | `Skill(engineering:os-finishing)` |
| `superpowers:systematic-debugging` | `Skill(engineering:os-debugging)` |
| `superpowers:test-driven-development` | `Skill(mattpocock-skills:tdd)` |
| `superpowers:verification-before-completion` | `Skill(engineering:os-verification)` |
| `superpowers:receiving-code-review` | `Skill(engineering:os-code-review)` |
| Any other `superpowers:<upstream-slug>` listed in overrides.manifest.json | `Skill(<name>)` where `<name>` is the manifest target's `name` field |

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

This is a **Claude Code plugin marketplace** (not a runtime codebase). It packages personal skills as installable plugins consumed by Claude Code itself. Content is primarily Markdown + JSON discovered via the marketplace/plugin manifest chain. First-party plugins under `packages/` form a small pnpm workspace (changesets + CI scripts + the unified `scripts/emit.mjs` build step) — see [Releasing](#releasing) and [Verifying](#verifying-a-change-didnt-break-the-marketplace).

## Plugins registered here

Five plugins are registered in the marketplace (derived into [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json) from `packages/` + `vendors/` — **package-as-source**):

1. **`mattpocock-skills`** — vendored as a **git submodule** at [vendors/mattpocock-skills/](vendors/mattpocock-skills/) tracking `https://github.com/mattpocock/skills.git` (see [.gitmodules](.gitmodules)), republished as `@oscaner-skills/mattpocock-skills`. Do **not** edit files under this directory in-tree; changes belong upstream. To update the pinned revision, run `git submodule update --remote mattpocock-skills` and commit the pointer bump with a `chore:` message. Fresh clones need `git submodule update --init` before Claude Code can resolve `mattpocock-skills:*` skill references (e.g. `grilling`, `tdd`, `to-tickets`) that the overrides delegate to.
2. **`impeccable`** — vendored as a **git submodule** at [vendors/impeccable/](vendors/impeccable/) (frontend design skills), republished as `@oscaner-skills/impeccable`.
3. **`superpowers`** — vendored as a **git submodule** at [vendors/superpowers/](vendors/superpowers/) (upstream workflow skills; Read by the os-* orchestrators as baseline), republished as `@oscaner-skills/superpowers`.
4. **`superpowers-overrides`** — first-party, edited in-tree at [packages/superpowers-overrides/](packages/superpowers-overrides/) (`@oscaner-skills/superpowers-overrides`). **Trigger router** — no skill bodies; routes upstream triggers to engineering / mattpocock targets.
5. **`engineering`** — first-party, edited in-tree at [packages/engineering/](packages/engineering/) (`@oscaner-skills/engineering`). This is where new override skills (`os-*` / `cli-*`) go, plus the cdd engine and the CDD orchestrator gate.

## Marketplace → plugin → skill chain

**Package-as-source:** the canonical registry [marketplace/source.json](marketplace/source.json) is **derived**, not hand-edited. `pnpm run emit` ([scripts/emit.mjs](scripts/emit.mjs)) rebuilds it from first-party `package.json#oscaner-plugin` fields (`packages/`) plus vendored assembly templates ([scripts/lib/publish-vendor.mjs](scripts/lib/publish-vendor.mjs)), then regenerates every harness-specific manifest:

1. `packages/<plugin>/package.json` → `oscaner-plugin` field — first-party source of truth (name/version/contentRoot/harnesses/hooks).
2. `vendors/<name>/` + assembly templates — vendored plugin descriptors (upstream submodules; version read from the vendored files).
3. [marketplace/source.json](marketplace/source.json) — **derived** emit product (regenerated by `pnpm run emit`; do not hand-edit).
4. [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json) — generated Claude Code marketplace.
5. [.cursor-plugin/marketplace.json](.cursor-plugin/marketplace.json) + [cursor-plugins/](cursor-plugins/) — Cursor Team Marketplace: **plugin-root** for `superpowers-overrides` and `superpowers` (manifest at plugin root); **wrapper** emit for mattpocock-skills and impeccable under `cursor-plugins/`. Hybrid rule: [cursor-plugins/README.md](cursor-plugins/README.md).
6. `packages/<plugin>/.claude-plugin/plugin.json` — generated per-plugin Claude manifest, e.g. [packages/superpowers-overrides/.claude-plugin/plugin.json](packages/superpowers-overrides/.claude-plugin/plugin.json). Registers skills by relative directory path.
7. `packages/<plugin>/skills/<skill-name>/SKILL.md` — the skill itself.

If a skill's SKILL.md exists on disk but is not under the plugin's declared `skills/` tree, Claude Code will not find it. This is the most common breakage.

## The overrides pattern (router → engineering)

The [superpowers-overrides](packages/superpowers-overrides/) plugin is the **trigger router** — it ships no skill bodies. The override skills live in [engineering](packages/engineering/skills/). Each `os-*` orchestrator skill follows a fixed shape:

- Frontmatter `description` names the upstream it reads (`Read 上游 superpowers:<target> 作为基线`) and the personal rules it adds. Upstream entry points map to targets in the router manifest (`overrides.manifest.json`) — the single source of truth the emit generators derive hooks and self-check tables from.
- Body opens with `## Rules`, semantic `### Rule: <Name>` headings (no numbers; `#rule-<kebab>` anchors). Each rule takes one of three shapes: (a) **replaces** upstream behavior (self-review → fresh-subagent passes); (b) **delegates** to a `mattpocock-skills:*` skill (grilling, tdd, to-tickets); (c) **partial-delegate** — wraps the upstream skill's Steps 0–K unchanged and overrides Step K+1 locally (os-writing-plans Rule: Tickets Publish Redirect is the canonical example: Steps 1–4 of `/to-tickets` are delegated verbatim, Step 5 "publish" is redirected to a single local `docs/superpowers/tickets/<date>-<feature>-tickets.md`, keeping the upstream single-file shape). Partial-delegate rules must state up front which steps are delegated and which are overridden — the split is what prevents Step K+1 from silently reverting to upstream defaults.
- When one rule has multiple internal enforcement mechanisms (e.g. "locate the delegate", "redirect publish target", "structure the user-approval quiz"), decompose it into sub-rules `Rule Na` / `Rule Nb` / `Rule Nc` under a single umbrella heading. Sub-rules are cheaper than sibling top-level rules when the mechanisms share a triggering context but attack different failure modes.
- Body closes with `## Red Flags` (thoughts that should stop you). Load-bearing — the orchestrator is designed to catch drift, so removing this section defeats the point.
- New rules go **inside** the `os-*` skill as `### Rule: <Name>`, never in the user's global `~/.claude/CLAUDE.md`.

Route enforcement is coordinated by **three mechanisms**, not one:

1. The router manifest + generated hooks — every upstream entry point is enumerated in `overrides.manifest.json` (single SOT); the emit generators derive hook matchers and self-check tables from it.
2. **Plugin-bundled hooks** in `packages/superpowers-overrides/hooks/hooks.json` — `UserPromptExpansion` (matcher `^superpowers:`) intercepts slash commands. Handler in `packages/superpowers-overrides/bin/prompt-expansion.mjs` injects `additionalContext`, reinforcing the target as the first tool call.
3. **Project-level CLAUDE.md self-check** — written by `os-init spor`. Run `os-init spor` once per project (Claude Code: `/os-init spor`) to prepend the override trigger table to the project's `CLAUDE.md`. This is the primary enforcement mechanism; it fires before any skill body is loaded into context.

### Hooks matrix

Hooks ship inside each plugin and activate only when the plugin is installed via the Claude Code / Cursor marketplace. The harness → path mapping is declared in `package.json#oscaner-plugin.hooks` (the SOT); `pnpm run emit` writes each hooks file at the declared path and references it from the generated per-harness manifest.

| Plugin | Harness | Hooks file | Handlers |
|--------|---------|------------|----------|
| superpowers-overrides | Claude Code | `packages/superpowers-overrides/hooks/hooks.json` | `UserPromptExpansion` (2 matchers: `^superpowers:`, bare `/<slug>` combined regex) → `bin/prompt-expansion.mjs` |
| superpowers-overrides | Cursor | `packages/superpowers-overrides/hooks/hooks-cursor.json` | `beforeSubmitPrompt` → `bin/cursor-detect.mjs`; `preToolUse` → `bin/cursor-enforce.mjs` |
| engineering | Claude Code | `packages/engineering/hooks/hooks.json` | `PreToolUse` (`Write`/`Edit`, `Bash`) → `bin/gate/adapters/claude.mjs` |
| engineering | Cursor | `packages/engineering/hooks/hooks-cursor.json` | `preToolUse` → `bin/gate/adapters/cursor.mjs` |

Detail (pending-state contract, fail-open, shell allowlist) → [cross-harness-overrides.md](packages/superpowers-overrides/docs/cross-harness-overrides.md).

## Cross-cutting docs

Two cross-cutting reference docs in `engineering/docs/` hold invariants that multiple os-* skills cite instead of duplicating. Neither is a slash command; they are invoked by reference from `Rule:` lines inside the os-* skills. Editing them propagates to every skill that cites them.

- [packages/engineering/docs/subagent-lifecycle.md](packages/engineering/docs/subagent-lifecycle.md) — **fresh subagent per pass**, **concurrent iff independent** dispatch. Cited by every review-pass rule in the os-* skills. Independence means no data dependency (no reading Pass N-1's fixed output), not merely "different categories".
- [packages/engineering/docs/review-dispatch.md](packages/engineering/docs/review-dispatch.md) — **D1 escalate-on-finding**, **D2 delta review**, **D3 findings-only output**. Cited by every review-pass rule in the os-* skills. Its "final pass gets full doc, middle passes get delta" rule is the invariant that keeps global-coherence signal from being lost to token efficiency.

When editing any os-* skill that dispatches review passes, cite these docs rather than paraphrasing them — paraphrases drift; citations don't. When adding a new invariant that applies to multiple os-* skills, add a new rule to the appropriate cross-cutting doc and cite it, don't inline it across the skills.

## `docs/superpowers/` conventions

The skill flow `brainstorming → writing-plans → subagent-driven-development` produces documents under three sibling directories:

- [docs/superpowers/specs/](docs/superpowers/specs/) — `YYYY-MM-DD-<feature>-design.md`, output of the brainstorming skill (spec doc, reviewed via `brainstorming` Rule 1).
- [docs/superpowers/plans/](docs/superpowers/plans/) — `YYYY-MM-DD-<feature>.md`, output of the writing-plans skill (implementation plan, reviewed via `writing-plans` Rule 2).
- `docs/superpowers/tickets/` — `YYYY-MM-DD-<feature>-tickets.md`, output of the `/to-tickets` publish step when the writing-plans Rule 3c quiz picks "publish to local file" (the directory is created on first use).

The three share the same date + feature slug so a spec, its plan, and its tickets sort together. `writing-plans` Rule 3b hard-codes the tickets path; don't publish tickets anywhere else, and don't write these docs at repo root.

## Common operations

There is no `pnpm test` here — content is plain Markdown + JSON, discovered by Claude Code at runtime. The genuine day-to-day operations are:

**Bump the vendored `mattpocock-skills` submodule to its latest release tag:**
```bash
git -C vendors/mattpocock-skills fetch --tags origin
git -C vendors/mattpocock-skills checkout v1.1.0   # latest v* tag
git add vendors/mattpocock-skills
git commit -m "chore: bump mattpocock-skills submodule"
```

**Automated submodule sync (all three submodules):** GitHub Actions → Submodule Sync → Run workflow, or wait for weekly cron (Mon 09:00 Asia/Shanghai). Matrix caller [`.github/workflows/submodule-sync.yml`](.github/workflows/submodule-sync.yml) invokes reusable [`.github/workflows/bump-submodule-reusable.yml`](.github/workflows/bump-submodule-reusable.yml) per submodule (`create-pull-request` + Issue Action chain; no bash glue).

**One-time label bootstrap** (required before first sync):

```bash
gh label create submodule-bump --color EDEDED --description "Automated submodule sync tracking"
gh label create submodule:mattpocock-skills --color EDEDED
gh label create submodule:superpowers --color EDEDED
gh label create submodule:impeccable --color EDEDED
```

If migrating from v1 tracking Issues, add `submodule-bump` + `submodule:<name>` to existing open Issues to avoid duplicates.

**Note:** PRs opened by the default `GITHUB_TOKEN` do not trigger `ci.yml` on `pull_request`; re-run CI manually or close/reopen the PR.

Use `chore:` (not `feat:`) — the change is a pointer bump, not a feature.

**Fresh-clone bootstrap (before Claude Code can resolve `mattpocock-skills:*` delegates):**
```bash
git submodule update --init
```

**Add a new override skill to `engineering`** — three things must change together in one commit, or the skill is invisible or won't auto-trigger:

1. Create `packages/engineering/skills/<name>/SKILL.md` with the os-* orchestrator shape (see [The overrides pattern](#the-overrides-pattern-router-engineering)).
2. Add a target row to [packages/superpowers-overrides/overrides.manifest.json](packages/superpowers-overrides/overrides.manifest.json) mapping the upstream trigger to `engineering:<name>` (source `../engineering/skills/<name>`), then run `pnpm run emit` (regenerates `bin/prompt-expansion.mjs`, the cursor hooks, and `build/generated/*` via the unified `scripts/emit.mjs`). Do **not** hand-edit the hook script.
3. Add a row to the router target table in [README.md](README.md) for discoverability.

Missing the skill dir or the manifest row → the skill is invisible to Claude Code or won't auto-trigger. Skipping `pnpm run emit` → hook and self-check drift.

**Add a new first-party plugin** — the marketplace is **package-as-source**, so wiring is automatic:

1. Create `packages/<name>/package.json` with the `oscaner-plugin` field (`contentRoot`, `harnesses`, optional `hooks`). `deriveFirstPartyNames` ([scripts/lib/emit/manifests.mjs](scripts/lib/emit/manifests.mjs)) discovers it by scanning `packages/*` for that field — no hand registration.
2. `pnpm run emit` derives `marketplace/source.json` from it and regenerates the marketplace documents; `pnpm-workspace.yaml` (`packages/*`) already picks it up.
3. Add a changeset naming it → released as `@oscaner-skills/<name>` by [scripts/version-packages.mjs](scripts/version-packages.mjs).

Per-harness hooks: map harness → path under `oscaner-plugin.hooks`; emit writes the hooks file. `oscaner-plugin.harnesses` is **declarative-only / informational** — no script consumes it (the `harnessesNote` in each `packages/*/package.json` documents this), and emit hardcodes the per-plugin manifest set. Adding a genuinely new harness manifest requires an emitter in `scripts/emit.mjs` (see the caveat below). Caveat: the per-plugin harness emission in `scripts/emit.mjs` is currently bespoke for `engineering` and `superpowers-overrides` — a new plugin type needs an emitter added there (or committed manifests that satisfy the cursor path assertions). Vendoring an upstream plugin is the opposite path (`vendors/<name>` submodule + `listVendors`/`ASSEMBLY_TEMPLATE` in `scripts/lib/publish-vendor.mjs` + `VENDOR_PLUGINS` in `scripts/lib/emit/source.mjs`).

## Verifying a change didn't break the marketplace

Since there is no test suite, "does the manifest chain still resolve" IS the test. Run `pnpm run validate` after any structural edit (skills, plugin.json, marketplace source, emit output).

**1. `plugin.json` parses AND every entry maps to an existing directory** (overrides is a trigger router — no skill bodies; engineering uses directory-form `skills`):
```bash
cd /path/to/skills
python3 -c '
import json, os

def check(root, label):
    d = json.load(open(os.path.join(root, ".claude-plugin/plugin.json")))
    skills = d.get("skills")
    if skills is None:
        # trigger router — no skill bodies; skills/ must be empty or absent
        sd = os.path.join(root, "skills")
        n = 0
        if os.path.isdir(sd):
            n = sum(1 for x in os.listdir(sd) if os.path.isdir(os.path.join(sd, x)))
        assert n == 0, f"{label}: expected 0 skills (trigger router), got {n}"
        print(f"OK — {label}: trigger router (no skill bodies)")
    elif isinstance(skills, str):
        sd = os.path.join(root, skills.lstrip("./"))
        assert os.path.isdir(sd), f"{label}: skills dir missing: {sd}"
        n = sum(1 for x in os.listdir(sd) if os.path.isdir(os.path.join(sd, x)))
        print(f"OK — {label}: {n} skills (directory {skills!r})")
    else:
        missing = [s for s in skills if not os.path.isdir(os.path.join(root, s.lstrip("./")))]
        assert not missing, f"{label} skills[] -> missing dirs: {missing}"
        print(f"OK — {label}: {len(skills)} skills, all resolve")

check("packages/superpowers-overrides", "superpowers-overrides")
check("packages/engineering", "engineering")
'
```

**2. Every skill dir has a `SKILL.md`** (engineering — the first-party skills plugin):
```bash
for d in packages/engineering/skills/*/; do
  [ -f "$d/SKILL.md" ] || { echo "MISSING: $d/SKILL.md"; exit 1; }
done && echo "OK — all engineering skill dirs have SKILL.md"
```

**3. No skill on disk is missing from `plugin.json`** (the reverse breakage — only applies to explicit-list manifests; a directory-form manifest *is* the declaration, so there is no orphan concept). None of the current plugins use the list form — `pnpm run validate` step 0/1 covers this via `scripts/emit.mjs --check`:
```bash
pnpm run emit:check
```

All three pass → the marketplace still resolves.

**4. Hooks and bin script exist and are executable** (run after adding or renaming hook handlers — see the [hooks matrix](#hooks-matrix)):
```bash
[ -f packages/superpowers-overrides/hooks/hooks.json ] && echo "OK — overrides claude hooks"
[ -f packages/superpowers-overrides/hooks/hooks-cursor.json ] && echo "OK — overrides cursor hooks"
[ -x packages/superpowers-overrides/bin/prompt-expansion.mjs ] && echo "OK — prompt-expansion executable"
[ -f packages/engineering/hooks/hooks.json ] && echo "OK — engineering claude hooks"
[ -f packages/engineering/hooks/hooks-cursor.json ] && echo "OK — engineering cursor hooks"
[ -x packages/engineering/bin/gate/adapters/claude.mjs ] && echo "OK — claude cdd-gate executable"
[ -x packages/engineering/bin/gate/adapters/cursor.mjs ] && echo "OK — cursor cdd-gate executable"
```

**5. Unified emit validates:**
```bash
pnpm run emit:check        # scripts/emit.mjs --check — drift → exit 1
./packages/superpowers-overrides/tests/validate-overrides-build.sh
```

**Note:** on a fresh clone, run `git submodule update --init` before `emit --check` — `emit`/validate resolve the `superpowers` submodule for version sync (`marketplace-utils.mjs` / `validate-version-sync.mjs`). The emitter does **not** copy upstream skills into `.agents/skills/` (engineering skills only; os-* Rule: Read Upstream reads the `superpowers` plugin when available, never vendored).

**6–9. Full local CI (recommended):**
```bash
pnpm run validate
```

This runs steps 1–5 above plus generator drift checks, overrides version triple-check, prerelease prefix lint, mattpocock-skills submodule resolution, and superpowers version sync. Implemented in [scripts/ci-validate.mjs](scripts/ci-validate.mjs); mirrored on PRs by [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Releasing

Two plugins are versioned from this repo: **`superpowers-overrides`** (superpowers-relative scheme) and **`engineering`** (independent semver). Integration branch is **`develop`**; **`main`** receives releases only via PRs from `develop`.

**Daily work:** open PRs against `develop`. CI runs `validate` on PRs to `develop` and `main`.

**Plugin changes:** run `pnpm changeset`, select the plugin(s) that changed (`superpowers-overrides` and/or `engineering`), describe the change, merge PR to `develop` (changesets accumulate on `develop`; no release workflow runs there).

**Release to production:** open a PR `develop → main` (must pass `validate` and **Main PRs must come from develop**). Merge to `main` → [.github/workflows/release.yml](.github/workflows/release.yml) opens a Version PR targeting **`main`**. Merge the Version PR on `main` → per-plugin git tag + GitHub Release (`superpowers-overrides@{version}` and/or `engineering@{version}`, each skipped if that plugin had no changeset). When `main` is ahead of `develop`, the workflow opens an automated **`main → develop`** sync PR — merge it manually to align `develop`.

**Superpowers submodule bump:** automated weekly via [.github/workflows/submodule-sync.yml](.github/workflows/submodule-sync.yml) (latest `v*` tag). Manual: checkout latest tag in `vendors/superpowers` (the marketplace version then derives from the vendored files), set `packages/superpowers-overrides/package.json` to `{semver}-overrides.0.0.0`, run `node scripts/sync-overrides-versions.mjs` (syncs the version SOTs and re-emits — `marketplace/source.json` is **derived**, not hand-edited). Merge to `develop`, then release via `develop → main` as above. This resets **overrides only** — engineering keeps its independent semver.

**Version scheme:** `superpowers-overrides` uses `{superpowers-semver}-overrides.{major}.{minor}.{patch}` (three-segment suffix). Tags look like `superpowers-overrides@6.2.0-overrides.0.15.0`. Changeset patch releases increment **patch** only on the same superpowers base. Any superpowers semver segment change (including patch) resets overrides to `{new-base}-overrides.0.0.0` — not the legacy `-overrides.0` single-counter form. `engineering` uses plain semver (`0.1.x`); a changeset bumping it releases independently as `engineering@{version}`. Both are driven by `node scripts/version-packages.mjs` (dual-plugin) and validated by `node scripts/validate-version-sync.mjs`. See [.changeset/README.md](.changeset/README.md).

**Branch protection:** after CI jobs exist on the repo, apply GitHub Rulesets idempotently with [`scripts/gh-branch-rulesets.sh`](scripts/gh-branch-rulesets.sh) (`protect-develop`, `protect-main`; no bypass actors). Legacy single-counter release tags can be removed post-first new-format release via [`scripts/cleanup-legacy-release-tags.sh`](scripts/cleanup-legacy-release-tags.sh).

## Git conventions for this repo

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
- No attribution / co-author / AI-generation trailers in commit messages.
- No `git worktree` — forbidden by user policy.
- `git add -f` on a gitignored file requires explicit user confirmation.

### When to commit

**Default:** do not commit unless the user explicitly asks (`commit`, `Tn commit`, `提交`, `push`).

**SDD / ticket execution:** when the user approved plan/tickets and started execution, and the plan/ticket specifies a commit for that ticket — commit after the ticket without asking again. If the plan omits commits, finish uncommitted and ask once at end-of-run.

**Execution continuity:** during approved plan runs, do not stop after each ticket to ask "要继续吗？" — see `.cursor/rules/execution-continuity.mdc` (Cursor) or mirror this section in Claude Code sessions.
