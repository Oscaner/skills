# Repo Artifact Cleanup — Tickets

Parent plan: [docs/superpowers/plans/2026-07-30-repo-artifact-cleanup.md](../plans/2026-07-30-repo-artifact-cleanup.md) · Spec: [plugins/superpowers-overrides/docs/2026-07-30-repo-artifact-cleanup-design.md](../../plugins/superpowers-overrides/docs/2026-07-30-repo-artifact-cleanup-design.md)

| # | Title | Blocked by | Plan tasks | Demo |
|---|-------|------------|------------|------|
| T1 | Delete stale gitignored docs | — | Task 1 | `find docs/superpowers/specs -type f` empty; dirs + gitignore intact |
| T2 | Dogfood version-stamp CI | — | Task 2 | `./plugins/superpowers-overrides/tests/validate-overrides-build.sh` passes dogfood section |
| T3 | Tracked doc cleanup | — | Tasks 3–5 | No dead spec links; README ≤125 lines; CLAUDE manifest-driven steps |
| T4 | Final validate & PR checklist | T2, T3 | Task 6 | `pnpm run validate` ALL PASS |

---

## T1 — Delete stale gitignored docs

**Blocked by:** None — can start immediately

**What to build:** Local `docs/superpowers/` contains only empty `specs/`, `plans/`, `tickets/` dirs (this tickets file and the plan may remain under `plans/` / `tickets/` as gitignored artifacts). The 12 enumerated 2026-07-30 files are gone. No git commit for deletions.

**Acceptance criteria:**

- [ ] All 12 spec/plan/ticket files from spec deleted
- [ ] `docs/superpowers/specs/` has no files
- [ ] `.gitignore` still ignores `docs/superpowers`

---

## T2 — Dogfood version-stamp CI

**Blocked by:** None — can start immediately

**What to build:** CI fails when repo-root `.cursor/rules/superpowers-overrides.mdc` or `CLAUDE.md` line-1 version stamp drifts from `plugin.json`.

**Acceptance criteria:**

- [ ] New section in `validate-overrides-build.sh` checks dogfood stamps
- [ ] `./plugins/superpowers-overrides/tests/validate-overrides-build.sh` exits 0 on current tree
- [ ] Commit with conventional message

---

## T3 — Tracked doc cleanup

**Blocked by:** None — can start immediately (may land same PR as T2)

**What to build:** Tracked docs match current manifest-driven workflow; README is shorter with single enforcement section; no links to deleted gitignored specs.

**Acceptance criteria:**

- [ ] `cross-harness-overrides.md` — CHANGELOG history blurb, no `docs/superpowers/specs/` links
- [ ] `CLAUDE.md` — four-step add-override flow; no manual hook `case` instructions
- [ ] `README.md` — ≤125 lines; Quick start; 4-row skill summary; link to CLAUDE overrides pattern anchor
- [ ] Commits for doc changes (one or more conventional commits)

---

## T4 — Final validate & PR checklist

**Blocked by:** T2, T3

**What to build:** Full marketplace validation green; PR documents manual cleanup checklist.

**Acceptance criteria:**

- [ ] `pnpm run validate` ALL PASS
- [ ] Repo-wide `rg` finds no dead links to deleted specs in tracked `.md`
- [ ] Design spec committed if not already
- [ ] PR test plan checklist completed

**Execution:** Subagent-Driven — use `superpowers:subagent-driven-development` with one fresh subagent per ticket (T1→T4 serial on frontier).
