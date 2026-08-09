# Tickets: SDD semantic guards (issue #52)

Two CI guards so Rule 0 checklist structure and `Rule N` cross-references survive slimming/renames — plus the prerequisite doc corrections. Source: [spec `2026-08-09-sdd-semantic-guard-design.md`](../specs/2026-08-09-sdd-semantic-guard-design.md) · plan [`2026-08-09-sdd-semantic-guard.md`](../plans/2026-08-09-sdd-semantic-guard.md).

Work the **frontier**: any ticket whose blockers are all done. For a purely linear chain that means top to bottom.

## T1: Purge stale `Rule 0a` / `Rule 0b` references + p0-fallback dormancy

**What to build:** Removes every reference to the retired `Rule 0a`/`Rule 0b` rule IDs across the SDD skill tree — 4 skill files, the orchestrator gate deny message, and the gate smoke-test needle — and reframes `spor-sdd-p0-fallback` as dormant (CLI is now mandatory, `7c1a7b8`). After this, no skill, gate script, or gate test references a rule ID that no longer exists.

**Blocked by:** None — can start immediately.

- [ ] `grep -rn "Rule 0a\|Rule 0b"` over `plugins/superpowers-overrides/skills/`, `bin/`, `tests/` returns nothing
- [ ] `spor-sdd-p0-fallback` frontmatter marks it dormant (no longer "Read only when Rule 0b triggers")
- [ ] gate deny message and its smoke-test needle both say `Rule 0` (in sync)
- [ ] `pnpm run validate` passes

## T2: Align exit-2 docs to CLI-mandatory BLOCKED + Rule 0 checklist contract note

**What to build:** Corrects the three doc/README lines that still describe the removed p0-fallback behavior (`exit 2 → p0 fallback`) so they match the authoritative CLI-mandatory behavior (`exit 2 → BLOCKED`), and documents the Rule 0 checklist semantic-contract note in the H6 reference — that the checklist's phase markers and tokens are not line-budget slimming targets.

**Blocked by:** None — can start immediately.

- [ ] No "exit 2 → p0 fallback" (or Chinese equivalent) remains in `sdd-h6-reference.md`, `README.md`, `README.zh-CN.md`
- [ ] `sdd-h6-reference.md` carries the Rule 0 checklist 语义契约 note (grep-able)
- [ ] `pnpm run validate` passes

## T3: Guard 1 — Rule 0 checklist semantic anchors in line-budget CI

**What to build:** A CI guard in the SDD line-budget test that asserts the Rule 0 orchestrator checklist's three phase markers stay on their own lines (line-anchored) and its 15 load-bearing tokens survive (scoped to the checklist sub-block) — the guard that catches a `ca3aaa1`-style slimming pass collapsing the three-phase structure into one line.

**Blocked by:** None — can start immediately.

- [ ] Line-budget test passes against the current checklist (all 18 anchors present)
- [ ] Deleting a phase marker line makes the test FAIL
- [ ] Reflowing the checklist into a single line makes the test FAIL
- [ ] `pnpm run validate` passes

## T4: Guard 2 — rule-reference cross-check resolver + wiring

**What to build:** A resolver that scans every override skill (body + frontmatter) and fails if any numeric `Rule N` reference is dangling — no same-file heading, no link/scoped-prefix target, no allowlist entry (the 3-entry allowlist is finishing Rule 4 → upstream, executing-plans Rule 5b → p0-fallback, p0-fallback Rule 0 → spor-SDD). Includes a self-test fixture proving a dangling ref is caught, and is wired into `validate-overrides-build.sh` so CI runs it.

**Blocked by:** T1 (the resolver fails on the stale `Rule 0a`/`0b` refs until they're purged).

- [ ] Resolver exits 0 with `OK (self-test passed, 17 skills clean)` on the fixed tree
- [ ] Self-test fixture proves a dangling ref is caught
- [ ] Resolver runs inside `pnpm run validate` (wired into `validate-overrides-build.sh`)
- [ ] `pnpm run validate` passes
