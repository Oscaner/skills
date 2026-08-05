# Tickets: SDD Token 效率 — Phase pack

Parent plan: [2026-08-05-sdd-token-efficiency-pack.md](../plans/2026-08-05-sdd-token-efficiency-pack.md) · Spec: [pack design v1.0](../specs/2026-08-05-sdd-token-efficiency-pack-design.md)

Work the **frontier**: any ticket whose blockers are all done. **Do not start T0 until penf is not shipped** — verify penf release tag + CURSOR-SMOKE blocking first.

| # | Title | Blocked by | Plan tasks | Demo |
|---|-------|------------|------------|------|
| T0 | Preflight: penf ship gate | — | Prerequisite | penf release tag exists; CURSOR-SMOKE sign-off in doc |
| T1 | Harness manifest generators | T0 | Task 1 | `manifest-harness.test.py` OK; committed `.cursor-plugin` + `.codex-plugin` |
| T2 | Marketplace plugin-root emit | T1 | Task 2 | `source.json` emitMode; `.cursor-plugin/marketplace.json` source → plugin root |
| T3 | Delete wrapper + validate green | T2 | Task 3 | No `cursor-plugins/superpowers-overrides/`; `pnpm run validate` ALL PASS |
| T4 | Migration + runtime docs | T3 | Task 4 | `MIGRATION-pack-single-layer.md`; README/cross-harness/CURSOR-SMOKE updated |
| T5 | Release + smoke sign-off | T4 | Task 5 | changeset + CHANGELOG; lightweight smoke recorded |

---

## T0 — Preflight: penf ship gate

**What to build:** Confirm penf phase is shipped before any pack implementation — release tag on `superpowers-overrides`, penf CURSOR-SMOKE blocking checklist signed off in repo docs.

**Blocked by:** None — can start immediately (but **stop** if penf not shipped).

- [ ] penf release tag exists (e.g. `superpowers-overrides@6.2.0-overrides.12` or later)
- [ ] `plugins/superpowers-overrides/docs/CURSOR-SMOKE.md` has penf smoke sign-off comment
- [ ] `feat/sdd` penf commits merged to main (or implementation branch rebased on shipped penf)

---

## T1 — Harness manifest generators

**What to build:** Plugin root `.cursor-plugin` and `.codex-plugin` manifests generated from `package.json` + `.claude-plugin/plugin.json`, wired into `generate:overrides` with drift checks and tests.

**Blocked by:** T0

- [ ] `package.json` has author + description aligned with marketplace source
- [ ] `pnpm run generate:overrides` writes plugin-root manifests
- [ ] `python3 plugins/superpowers-overrides/tests/manifest-harness.test.py` passes
- [ ] `generate:overrides --check` includes new outputs

---

## T2 — Marketplace plugin-root emit

**What to build:** `marketplace/source.json` uses `emitMode: plugin-root` for overrides; schema oneOf validates; emit points Cursor marketplace at `./plugins/superpowers-overrides` without generating wrapper (wrapper may still exist on disk until T3).

**Blocked by:** T1

- [ ] overrides `cursor: { "emitMode": "plugin-root" }` only
- [ ] `source.schema.json` oneOf passes
- [ ] `node scripts/emit-marketplace.mjs` sets overrides `source` to `./plugins/superpowers-overrides`
- [ ] Other plugins still use wrapper emit unchanged

---

## T3 — Delete wrapper + validate green

**What to build:** Remove `cursor-plugins/superpowers-overrides/`; update `validate-marketplace.mjs` for plugin-root; full `pnpm run validate` green including emit freshness and marketplace source assert.

**Blocked by:** T2

- [ ] `cursor-plugins/superpowers-overrides/` deleted; CI fails if recreated
- [ ] `validate-marketplace.mjs` plugin-root branches + marketplace source assert
- [ ] `node scripts/emit-marketplace.mjs --check` passes
- [ ] `pnpm run validate` ALL PASS

---

## T4 — Migration + runtime docs

**What to build:** Contributor and user documentation for breaking single-layer migration; runtime docs reflect plugin-root paths (not penf-design historical spec).

**Blocked by:** T3

- [ ] `MIGRATION-pack-single-layer.md` (Cursor refresh + Claude cache note + penf-design historical note)
- [ ] `cross-harness-overrides.md`, `CURSOR-SMOKE.md`, `README.md`, `README.zh-CN.md`, `marketplace/README.md`, `CLAUDE.md` updated

---

## T5 — Release + smoke sign-off

**What to build:** Breaking changeset, CHANGELOG entry, and lightweight manual smoke checklist recorded before merge.

**Blocked by:** T4

- [ ] `.changeset/` breaking entry for Cursor marketplace source path
- [ ] `CHANGELOG.md` unreleased section
- [ ] Manual checklist: Hooks visible; `/brainstorming` sample trigger; Claude cache has `.cursor-plugin` + `.codex-plugin`
- [ ] Smoke sign-off comment in MIGRATION doc footer
