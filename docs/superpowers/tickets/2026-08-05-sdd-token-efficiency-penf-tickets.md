# Tickets: SDD Token 效率 — Phase penf (Override-First)

Parent plan: [2026-08-05-sdd-token-efficiency-penf.md](../plans/2026-08-05-sdd-token-efficiency-penf.md) · Spec: [penf design v1.3](../specs/2026-08-05-sdd-token-efficiency-penf-design.md)

Work the **frontier**: any ticket whose blockers are all done.

| # | Title | Blocked by | Plan tasks | Demo |
|---|-------|------------|------------|------|
| T0 | Manifest trigger patterns + Claude hook matchers | — | Task 1 | `pnpm run validate:overrides` green; `hooks.json` has 3 matcher groups |
| T1 | Claude Code bare/spor slash expansion | T0 | Task 2 | `override-prompt-expansion.test.sh` passes |
| T2 | Cursor detect + enforce plugin hooks | T0 | Task 3 | `override-cursor-*.test.sh` passes |
| T3 | Marketplace emit + CI executable checks | T2 | Task 4 | Cursor wrapper `plugin.json` declares hooks |
| T4 | Self-check red flags + spor-init guidance | T0 | Task 5 | Generated `.mdc` contains anti-pattern block |
| T5 | Docs + CURSOR-SMOKE blocking checklist | T3, T4 | Task 6 | README + smoke doc updated; `pnpm run validate` green |

---

## T0 — Manifest trigger patterns + Claude hook matchers

**What to build:** Manifest-driven `trigger_patterns.py`, `render-claude-hooks.sh`, and CI wiring so Claude Code `hooks/hooks.json` exposes `^superpowers:`, bare `/slug`, and `/spor-slug` matchers — all generated, drift-checked.

**Blocked by:** None — can start immediately.

- [ ] `trigger-patterns.test.py` passes for all 10 manifest slugs + four attach path families
- [ ] `hooks.json` generated with three `UserPromptExpansion` entries
- [ ] `validate-overrides-build.sh` runs pattern + hooks.json smoke
- [ ] Commit: `feat(overrides): manifest-driven Claude Code hook matchers`

---

## T1 — Claude Code bare/spor slash expansion

**What to build:** Extend `render-hook.sh` case table so `/brainstorming`, `/spor-brainstorming`, and all manifest slugs emit `MANDATORY OVERRIDE` + correct `spor-*` target in expansion output.

**Blocked by:** T0 — Manifest trigger patterns + Claude hook matchers

- [ ] `override-prompt-expansion.test.sh` passes (superpowers, bare, spor, writing-plans sample, no-match)
- [ ] Wired into `validate-overrides-build.sh`
- [ ] Commit: `feat(overrides): expand Claude Code prompt expansion for bare slash`

---

## T2 — Cursor detect + enforce plugin hooks

**What to build:** Generated `hooks-cursor.json`, `override-cursor-detect.sh`, `override-cursor-enforce.sh` implementing pending state contract, session_key algorithm, TTL 300s, Read/Skill allow paths.

**Blocked by:** T0 — Manifest trigger patterns + Claude hook matchers

- [ ] Detect tests: bare, spor, prefixed, superpowers-overrides:spor-, attach (fake cache), session_id + hash fallback
- [ ] Enforce tests: deny wrong first tool, allow Read + Skill, TTL expiry, noop without pending
- [ ] Generated scripts `chmod +x`
- [ ] Commit: `feat(overrides): Cursor plugin detect/enforce hooks`

---

## T3 — Marketplace emit + CI executable checks

**What to build:** Wire `superpowers-overrides.cursor.hooks` in marketplace source; emit Cursor wrapper with hooks field; extend `ci-validate.sh` for new executables.

**Blocked by:** T2 — Cursor detect + enforce plugin hooks

- [ ] `marketplace/source.json` has hooks path
- [ ] `cursor-plugins/superpowers-overrides/.cursor-plugin/plugin.json` emitted with hooks
- [ ] `pnpm run validate` ALL PASS
- [ ] Commit: `feat(overrides): wire Cursor plugin hooks into marketplace emit`

---

## T4 — Self-check red flags + spor-init guidance

**What to build:** D3 anti-pattern red flags in cursor + Claude self-check templates; spor-init reminder that Cursor uses plugin hooks (not project hooks).

**Blocked by:** T0 — Manifest trigger patterns + Claude hook matchers

- [ ] Templates contain three red-flag bullets from spec D3
- [ ] spor-init no longer says «rely on rules intercept» alone
- [ ] Regenerate + dogfood stamp OK (run `/spor-init` if needed)
- [ ] Commit: `docs(overrides): self-check red flags and spor-init hook guidance`

---

## T5 — Docs + CURSOR-SMOKE blocking checklist

**What to build:** README EN/ZH, cross-harness-overrides, hardened CURSOR-SMOKE blocking items mirroring spec AC (including /spor-, prefixed, Skill first tool).

**Blocked by:** T3 — Marketplace emit + CI executable checks; T4 — Self-check red flags + spor-init guidance

- [ ] All D4 doc deliverables updated
- [ ] CURSOR-SMOKE blocking section complete
- [ ] `pnpm run validate` green
- [ ] Manual smoke comment stamped in CURSOR-SMOKE.md after human run
- [ ] Commit: `docs(overrides): penf smoke checklist and plugin hook documentation`
