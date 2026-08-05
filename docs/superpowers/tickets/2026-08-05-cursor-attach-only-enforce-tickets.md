# Tickets: Cursor attach-only enforce

Attach-only Cursor hook enforcement: slash commands no longer trigger preToolUse deny; upstream SKILL attach still enforces spor-first with `skill_suffix` in deny messages. Parent plan: [../plans/2026-08-05-cursor-attach-only-enforce.md](../plans/2026-08-05-cursor-attach-only-enforce.md). Spec: [../specs/2026-08-05-cursor-attach-only-enforce-design.md](../specs/2026-08-05-cursor-attach-only-enforce-design.md).

Work the **frontier**: any ticket whose blockers are all done.

## T1 — Detect attach-only pending with skill_suffix

**What to build:** Cursor `beforeSubmitPrompt` detect writes pending **only** when user attaches upstream superpowers SKILL paths. Slash commands (`/brainstorming`, `/spor-*`, prefixed) produce no pending. Pending JSON includes `skill_suffix` derived from manifest `source`.

**Blocked by:** None — can start immediately.

**Plan tasks covered:** Task 1

**Demo:** `./plugins/superpowers-overrides/tests/override-cursor-detect.test.sh` passes; `/brainstorming` prompt leaves no pending file; attach leaves pending with `skill_suffix`.

---

## T2 — Enforce deny cites skill_suffix on attach

**What to build:** `preToolUse` enforce reads `skill_suffix` from pending and returns attach-specific deny copy. Slash-without-pending allows first Grep/Read. Allow paths for spor Read/Skill unchanged.

**Blocked by:** T1 — Detect attach-only pending with skill_suffix

**Plan tasks covered:** Task 2

**Demo:** `./plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh` passes; deny message contains `skills/spor-brainstorming/SKILL.md`; conv-slash Grep allowed.

---

## T3 — Docs, self-check, validation

**What to build:** Update cross-harness docs and self-check template to document attach-only enforce. Regenerate `cursor-self-check.mdc`. CHANGELOG entry. Full `pnpm run validate:overrides` green.

**Blocked by:** T1 — Detect attach-only pending with skill_suffix; T2 — Enforce deny cites skill_suffix on attach

**Plan tasks covered:** Task 3

**Demo:** `pnpm run validate:overrides` and `validate-overrides-build.sh` pass; manual Cursor smoke per spec § Verification.
