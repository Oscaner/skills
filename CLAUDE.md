## superpowers-overrides self-check

Before your first tool call in ANY turn, run this check — no exceptions:

1. Scan the current turn for any of: a `<command-name>` tag, a `<command-message>` tag, `/superpowers:*` in user text, or a `superpowers:*` skill body appearing in system context.
2. If any is present → your **first tool call is the matching `Skill(superpowers-overrides:<slug>)`**. Full stop. No `TodoWrite` / `Read` / `Bash` / `Grep` / `Edit` first.
3. Only after the override has run may you follow the upstream skill's instructions.

**The upstream skill's "you MUST do X first" does NOT apply until the override has run.**

**Anti-pattern:** upstream SKILL.md bodies open with numbered "You MUST" checklists — reading that and starting to execute it is the failure mode. The override runs first.

**Handoff-continuation rationalization:** when the upstream body arrives as a tool result of a prior `Skill(...)` call, the self-check STILL fires. Each turn is scanned independently.

### Override trigger table

| Trigger | First tool call |
|---|---|
| `superpowers:brainstorming` | `Skill(superpowers-overrides:brainstorming)` |
| `superpowers:writing-plans` | `Skill(superpowers-overrides:writing-plans)` |
| `superpowers:subagent-driven-development` | `Skill(superpowers-overrides:subagent-driven-development)` |
| `superpowers:executing-plans` | `Skill(superpowers-overrides:executing-plans)` |
| `superpowers:finishing-a-development-branch` | `Skill(superpowers-overrides:finishing-a-development-branch)` |
| `superpowers:using-git-worktrees` | `Skill(superpowers-overrides:using-git-worktrees)` |
| `superpowers:systematic-debugging` | `Skill(superpowers-overrides:systematic-debugging)` |
| `superpowers:test-driven-development` | `Skill(superpowers-overrides:test-driven-development)` |
| `superpowers:verification-before-completion` | `Skill(superpowers-overrides:verification-before-completion)` |
| `superpowers:receiving-code-review` | `Skill(superpowers-overrides:receiving-code-review)` |
| Any other `superpowers:<slug>` where `superpowers-overrides:<slug>` exists | `Skill(superpowers-overrides:<slug>)` |

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

This is a **Claude Code plugin marketplace** (not a runtime codebase). It packages personal skills as installable plugins consumed by Claude Code itself. Content is primarily Markdown + JSON discovered via the marketplace/plugin manifest chain. `superpowers-overrides` also has a small pnpm workspace (changesets + CI scripts) and a Cursor emit build step — see [Releasing](#releasing) and [Verifying](#verifying-a-change-didnt-break-the-marketplace).

## Plugins registered here

Two plugins are declared in [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json):

1. **`mattpocock-skills`** — vendored as a **git submodule** at [mattpocock-skills/](mattpocock-skills/) tracking `https://github.com/mattpocock/skills.git` (see [.gitmodules](.gitmodules)). Do **not** edit files under this directory in-tree; changes belong upstream. To update the pinned revision, run `git submodule update --remote mattpocock-skills` and commit the pointer bump with a `chore:` message. Fresh clones need `git submodule update --init` before Claude Code can resolve `mattpocock-skills:*` skill references (e.g. `grilling`, `tdd`, `to-tickets`) that the overrides delegate to.
2. **`superpowers-overrides`** — first-party, edited in-tree. This is where new override skills go.

## Marketplace → plugin → skill chain

The canonical registry is [marketplace/source.json](marketplace/source.json). Emit generates harness-specific manifests:

1. [marketplace/source.json](marketplace/source.json) — **only human-edited** plugin registry. After changes run `pnpm run emit && pnpm run validate`.
2. [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json) — generated Claude Code marketplace.
3. [.cursor-plugin/marketplace.json](.cursor-plugin/marketplace.json) + [cursor-plugins/](cursor-plugins/) — generated Cursor Team Marketplace wrappers.
4. `<plugin>/.claude-plugin/plugin.json` — e.g. [superpowers-overrides/.claude-plugin/plugin.json](superpowers-overrides/.claude-plugin/plugin.json). Registers skills by relative directory path.
5. `<plugin>/skills/<skill-name>/SKILL.md` — the skill itself.

If a skill's SKILL.md exists on disk but is not listed in the plugin's `skills[]`, Claude Code will not find it. This is the most common breakage.

## The overrides pattern (superpowers-overrides)

The [superpowers-overrides](superpowers-overrides/) plugin's whole purpose is to **override** upstream `superpowers:*` skills without forking them. Each override skill follows a fixed shape:

- Frontmatter `description` starts with `MUST invoke BEFORE superpowers:<target> as your FIRST tool call this turn` and enumerates all four trigger sources explicitly: (1) `/<slash-command>` in both bare and `superpowers:`-prefixed forms; (2) `<command-name>` tags naming either form; (3) the upstream skill body appearing in the current turn's system context; (4) natural-language scenarios (verbs, synonyms). The "FIRST tool call" phrasing and the exhaustive trigger list are load-bearing — softer wording ("typically before target fires", "when target is active") lets the model follow the upstream skill body's own first-move checklist and skip the override.
- Body opens with `## Rules`, numbered `Rule 1`, `Rule 2`, … Each rule takes one of three shapes: (a) **replaces** upstream behavior (self-review → fresh-subagent passes); (b) **delegates** to a `mattpocock-skills:*` skill (grilling, tdd, to-tickets); (c) **partial-delegate** — wraps the upstream skill's Steps 0–K unchanged and overrides Step K+1 locally (writing-plans Rule 3 is the canonical example: Steps 1–4 of `/to-tickets` are delegated verbatim, Step 5 "publish" is redirected to a single local `docs/superpowers/tickets/<date>-<feature>-tickets.md`, keeping the upstream single-file shape). Partial-delegate rules must state up front which steps are delegated and which are overridden — the split is what prevents Step K+1 from silently reverting to upstream defaults.
- When one rule has multiple internal enforcement mechanisms (e.g. "locate the delegate", "redirect publish target", "structure the user-approval quiz"), decompose it into sub-rules `Rule Na` / `Rule Nb` / `Rule Nc` under a single umbrella heading. Sub-rules are cheaper than sibling top-level rules when the mechanisms share a triggering context but attack different failure modes.
- Body closes with `## Red Flags` (thoughts that should stop you) and `## Common Rationalizations` (excuse → reality table). Both are load-bearing — the override is designed to catch drift, so removing these sections defeats the point.
- New rules go **inside** the override skill as `Rule N`, never in the user's global `~/.claude/CLAUDE.md`. The HTML comment `<!-- Additional rules … -->` marks the insertion point.

Precedence is enforced by **three coordinated mechanisms**, not one:

1. The four-trigger `description` above (SKILL.md side) — documents every entry point verbatim; serves as fallback when hooks are unavailable.
2. **Plugin-bundled hooks** in `superpowers-overrides/hooks/hooks.json` — `UserPromptExpansion` (matcher `^superpowers:`) intercepts slash commands. Handler in `superpowers-overrides/bin/override-prompt-expansion.sh` injects `additionalContext`, reinforcing the override as the first tool call. Requires `jq` on the host; missing jq → stderr warning, no silent degradation.
3. **Project-level CLAUDE.md self-check** — written by `superpowers-overrides:init`. Run `/superpowers-overrides:init` once per project to prepend the override trigger table to the project's `CLAUDE.md`. This is the primary enforcement mechanism; it fires before any skill body is loaded into context.

## Cross-cutting skills

Two skills in `superpowers-overrides` are **not** overrides — they hold invariants that multiple overrides cite instead of duplicating. Neither has a slash command; they are invoked by reference from `Rule N` lines inside the overrides. Editing them propagates to every override that cites them.

- [superpowers-overrides/skills/subagent-lifecycle/SKILL.md](superpowers-overrides/skills/subagent-lifecycle/SKILL.md) — **fresh subagent per pass**, **concurrent iff independent** dispatch. Cited by every review override's review-pass rule. Independence means no data dependency (no reading Pass N-1's fixed output), not merely "different categories".
- [superpowers-overrides/skills/token-efficient-review-dispatch/SKILL.md](superpowers-overrides/skills/token-efficient-review-dispatch/SKILL.md) — **D1 escalate-on-finding**, **D2 delta review**, **D3 findings-only output**. Cited by every review override's review-pass rule. Its "final pass gets full doc, middle passes get delta" rule is the invariant that keeps global-coherence signal from being lost to token efficiency.

When editing any override that dispatches review passes, cite these skills rather than paraphrasing them — paraphrases drift; citations don't. When adding a new invariant that applies to multiple overrides, add a new rule to the appropriate cross-cutting skill and cite it, don't inline it across the overrides.

## `docs/superpowers/` conventions

The skill flow `brainstorming → writing-plans → subagent-driven-development` produces documents under three sibling directories:

- [docs/superpowers/specs/](docs/superpowers/specs/) — `YYYY-MM-DD-<feature>-design.md`, output of the brainstorming skill (spec doc, reviewed via `brainstorming` Rule 1).
- [docs/superpowers/plans/](docs/superpowers/plans/) — `YYYY-MM-DD-<feature>.md`, output of the writing-plans skill (implementation plan, reviewed via `writing-plans` Rule 2).
- `docs/superpowers/tickets/` — `YYYY-MM-DD-<feature>-tickets.md`, output of the `/to-tickets` publish step when the writing-plans Rule 3c quiz picks "publish to local file" (the directory is created on first use).

The three share the same date + feature slug so a spec, its plan, and its tickets sort together. `writing-plans` Rule 3b hard-codes the tickets path; don't publish tickets anywhere else, and don't write these docs at repo root.

## Common operations

There is no `pnpm test` here — content is plain Markdown + JSON, discovered by Claude Code at runtime. The genuine day-to-day operations are:

**Bump the vendored `mattpocock-skills` submodule to its latest tip:**
```bash
git submodule update --remote mattpocock-skills
git commit mattpocock-skills -m "chore: bump mattpocock-skills submodule"
```
Use `chore:` (not `feat:`) — the change is a pointer bump, not a feature.

**Fresh-clone bootstrap (before Claude Code can resolve `mattpocock-skills:*` delegates):**
```bash
git submodule update --init
```

**Add a new override skill to `superpowers-overrides`** — three things must change together in one commit, or the skill is invisible or won't auto-trigger:
1. Create `superpowers-overrides/skills/<name>/SKILL.md` with the four-trigger frontmatter (see [The overrides pattern](#the-overrides-pattern-superpowers-overrides)).
2. Add `"./skills/<name>"` to `skills[]` in [superpowers-overrides/.claude-plugin/plugin.json](superpowers-overrides/.claude-plugin/plugin.json).
3. Add a `case` branch to `superpowers-overrides/bin/override-prompt-expansion.sh` — pattern `superpowers:<slug>)  override="superpowers-overrides:<slug>" ;;`.
4. Add a row to the override table in [README.md](README.md) for discoverability.

Missing step 1 or 2 → the skill is invisible to Claude Code. Missing step 3 → hooks won't inject the `additionalContext` reminder on slash-command trigger.

## Verifying a change didn't break the marketplace

Since there is no test suite, "does the manifest chain still resolve" IS the test. Run `pnpm run validate` after any structural edit (skills, plugin.json, marketplace source, emit output).

**1. `plugin.json` parses AND every entry maps to an existing directory:**
```bash
cd /path/to/skills
python3 -c '
import json, os
p = "superpowers-overrides/.claude-plugin/plugin.json"
d = json.load(open(p))
skills = d["skills"]
missing = [s for s in skills if not os.path.isdir(os.path.join("superpowers-overrides", s.lstrip("./")))]
assert not missing, f"skills[] points to missing dirs: {missing}"
print(f"OK — {len(skills)} skills, all resolve")
'
```
(Bind `skills` to a local first; Python 3.11 rejects `f"{d[\"skills\"]}"` with `SyntaxError: f-string expression part cannot include a backslash`.)

**2. Every skill dir has a `SKILL.md`:**
```bash
for d in superpowers-overrides/skills/*/; do
  [ -f "$d/SKILL.md" ] || { echo "MISSING: $d/SKILL.md"; exit 1; }
done && echo "OK — all skill dirs have SKILL.md"
```

**3. No skill on disk is missing from `plugin.json`** (the reverse breakage — file exists but manifest doesn't list it, so Claude Code won't find it):
```bash
python3 -c '
import json, os
d = json.load(open("superpowers-overrides/.claude-plugin/plugin.json"))
declared = {s.lstrip("./") for s in d["skills"]}
on_disk  = {f"skills/{n}" for n in os.listdir("superpowers-overrides/skills")}
orphans  = on_disk - declared
assert not orphans, f"skill dirs not in plugin.json skills[]: {orphans}"
print("OK — no orphan skill dirs")
'
```

All three pass → the marketplace still resolves.

**4. Hooks and bin script exist and are executable** (run after adding or renaming hook handlers):
```bash
[ -f superpowers-overrides/hooks/hooks.json ] && echo "OK — hooks.json"
[ -x superpowers-overrides/bin/override-prompt-expansion.sh ] && echo "OK — prompt-expansion executable"
```

**5. Overrides build validates:**
```bash
./superpowers-overrides/build/emit-overrides.sh
./superpowers-overrides/tests/validate-overrides-build.sh
```

**6–9. Full local CI (recommended):**
```bash
pnpm run validate
```

This runs steps 1–5 above plus emit freshness (`ENABLE_EMIT_FRESH_CHECK=1`), overrides version triple-check, prerelease prefix lint, mattpocock-skills submodule resolution, and superpowers version sync. Implemented in [scripts/ci-validate.sh](scripts/ci-validate.sh); mirrored on PRs by [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Releasing

Only **`superpowers-overrides`** is versioned from this repo. Tags look like `superpowers-overrides@6.2.0-overrides.1` — the prerelease suffix tracks which vendored `superpowers` version the overrides target.

**Overrides-only changes:** run `pnpm changeset`, describe the change, open a PR, merge to `main`. The release workflow opens a Version PR; merge it to create the git tag.

**Superpowers submodule bump:** update the submodule pointer and `marketplace/source.json` `plugins[superpowers].version`, then `pnpm run emit`. No manual changeset required for align-only releases — [release.yml](.github/workflows/release.yml) prep creates an align changeset automatically when the prerelease base drifts.

**Version scheme:** `{superpowers-semver}-overrides.{N}`. See [.changeset/README.md](.changeset/README.md).

## Git conventions for this repo

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
- No attribution / co-author / AI-generation trailers in commit messages.
- No `git worktree` — forbidden by user policy.
- `git add -f` on a gitignored file requires explicit user confirmation.

### When to commit

**Default:** do not commit unless the user explicitly asks (`commit`, `Tn commit`, `提交`, `push`).

**SDD / ticket execution:** when the user approved plan/tickets and started execution, and the plan/ticket specifies a commit for that ticket — commit after the ticket without asking again. If the plan omits commits, finish uncommitted and ask once at end-of-run.

**Execution continuity:** during approved plan runs, do not stop after each ticket to ask "要继续吗？" — see `.cursor/rules/execution-continuity.mdc` (Cursor) or mirror this section in Claude Code sessions.
