# Tickets: SDD Token 效率 — Phase pack-sp (Superpowers plugin-root)

Parent plan: [2026-08-05-sdd-token-efficiency-pack-sp.md](../plans/2026-08-05-sdd-token-efficiency-pack-sp.md) · Spec: [pack-sp design v1.1](../specs/2026-08-05-sdd-token-efficiency-pack-sp-design.md)

Work the **frontier**: any ticket whose blockers are all done.

| # | Title | Blocked by | Plan tasks | Demo |
|---|-------|------------|------------|------|
| T0 | Preflight: pack impl present | — | Task 0 | `pnpm run validate` green; overrides plugin-root; superpowers baseline documented (OK or SKIP) |
| T1 | superpowers plugin-root migration | T0 | Task 1 | `source.json` emitMode only; wrapper gone; `.cursor-plugin/marketplace.json` source `./plugins/superpowers`; validate green |
| T2 | cursor-plugins hybrid README | T1 | Task 2 | `cursor-plugins/README.md` with 4 sections + 4-plugin status table |
| T3 | Doc cross-links (marketplace + CLAUDE) | T2 | Task 3 | D4 grep asserts pass; optional MIGRATION cross-link |
| T4 | Ship gate: lightweight Cursor smoke | T3 | Task 4 | Automated gate scripts pass; manual checklist signed off in PR/ticket |

---

## T0 — Preflight: pack impl present

**What to build:** Confirm pack infrastructure is merged and baseline state is understood before mutating superpowers Cursor install topology.

**Blocked by:** None — can start immediately.

- [ ] `isPluginRoot` present in emit + validate scripts
- [ ] `superpowers-overrides` already `emitMode: plugin-root`; overrides wrapper deleted
- [ ] superpowers baseline recorded (wrapper mode OK, or SKIP if already migrated)
- [ ] upstream `plugins/superpowers/.cursor-plugin/plugin.json` paths resolve
- [ ] `pnpm run validate` green at start

---

## T1 — superpowers plugin-root migration

**What to build:** Cursor Team Marketplace installs **superpowers** from plugin root — same single-layer model as overrides — by switching `source.json` and removing the redundant wrapper.

**Blocked by:** T0

- [ ] `marketplace/source.json` superpowers `cursor` is `{ "emitMode": "plugin-root" }` only
- [ ] `cursor-plugins/superpowers/` deleted
- [ ] emit refreshed; `.cursor-plugin/marketplace.json` superpowers `source` === `./plugins/superpowers`
- [ ] `pnpm run validate` green
- [ ] commit: `feat(marketplace): superpowers cursor plugin-root emit mode`

---

## T2 — cursor-plugins hybrid README

**What to build:** Contributor handbook explaining when oscaner uses wrapper vs plugin-root emit, current plugin status, and upgrade checklist for future upstream `.cursor-plugin` additions.

**Blocked by:** T1

- [ ] `cursor-plugins/README.md` exists with Why / Hybrid rule / Status table / Upgrade checklist
- [ ] status table lists all four plugins with correct modes
- [ ] structure grep script passes
- [ ] commit: `docs(marketplace): cursor-plugins hybrid emit handbook`

---

## T3 — Doc cross-links (marketplace + CLAUDE)

**What to build:** Repo docs reflect superpowers plugin-root and link to the hybrid handbook — no stale "only overrides" prose.

**Blocked by:** T2

- [ ] `marketplace/README.md` — Generated outputs, install modes, Team Marketplace sections updated
- [ ] `CLAUDE.md` marketplace chain bullet 3 updated
- [ ] doc string grep asserts pass
- [ ] optional MIGRATION cross-link for superpowers
- [ ] `pnpm run validate` green
- [ ] commit: `docs(marketplace): pack-sp cross-links and plugin-root prose`

---

## T4 — Ship gate: lightweight Cursor smoke

**What to build:** pack-sp ship confidence — automated validate replay plus manual Cursor marketplace refresh checklist (not penf CURSOR-SMOKE blocking).

**Blocked by:** T3

- [ ] automated gate scripts pass (validate, emit --check, no wrapper, correct source)
- [ ] Cursor marketplace refreshed; superpowers plugin loads
- [ ] Settings → Hooks shows upstream superpowers hooks
- [ ] manual sign-off recorded in PR or ticket demo

**No commit required.**
