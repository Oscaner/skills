# SDD H6 CLI Cold-Start Optimization Implementation Plan

> Spec: [2026-08-08-sdd-h6-cli-cold-start-design.md](../specs/2026-08-08-sdd-h6-cli-cold-start-design.md)
> Fixes: [#88](https://github.com/Oscaner/skills/issues/88)
> Branch: `issue-88`

## Scope

Consolidate SDD CLI mode dispatch by inlining handoff logic into implement/review/fix modes. Remove `--mode handoff` and `--segment` from shell scripts. Update all downstream skill files and docs.

**20 files touched:** 5 shell scripts modified (+6 stubs no-change), 7 templates, 4 skills, 4 docs, 2 tests (1 new + 1 updated smoke test).

## Global Constraints

- Handoff JSON schema is SOT at `templates/sdd-handoff-schema.md` — templates cite it, never duplicate
- CLI harness resolution: `{plugin_root}/bin/sdd-run-task-<harness>.sh` — `plugin_root` = `plugins/superpowers-overrides`
- Hard gate: implementer never self-reviews — review mode remains independent `claude -p` process
- All shell changes preserve `set -euo pipefail` + `sdd-common.sh` source contract
- `SDD_DRY_RUN=1` must work for all modes post-change
- Orchestrator gate is fail-open: gate allowlist `*sdd-run-task-*` covers all valid modes

---

## Tasks

### Task 1: Create `_handoff-write-fragment.md` shared template

**What:** New file `templates/sdd-cli/_handoff-write-fragment.md` with segment-specific handoff write instructions per spec §4.2. Includes implement/review/fix segment tables, self-validate step (`jq .` + required key check), atomicity note (failure → `BLOCKED`).

**Files:** `templates/sdd-cli/_handoff-write-fragment.md` (NEW)

**Accepts:** Fragment is self-contained, reference-able by implement/review/fix templates, includes template variable note.

### Task 2: Update CLI templates — implement, review, fix

**What:** Modify 3 template files:
- `implement.md`: Replace Step 6 "Do not write handoff.json" with "Write handoff per `_handoff-write-fragment.md` implement segment"
- `review.md`: Replace Step 5 "Do not write handoff.json" with "Write handoff per `_handoff-write-fragment.md` review segment"; after axes complete, parse D3 findings, set status APPROVED/CHANGES_REQUESTED per spec §4.2
- `fix.md`: Replace Step 5 "Do not write handoff.json" with "Write handoff per `_handoff-write-fragment.md` fix segment"

**Files:** `templates/sdd-cli/implement.md`, `templates/sdd-cli/review.md`, `templates/sdd-cli/fix.md` (MODIFY)

**Dependencies:** Task 1

### Task 3: Delete obsolete templates

**What:** Delete `templates/sdd-cli/handoff.md` and `templates/sdd-handoff-writer-prompt.md`.

**Files:** `templates/sdd-cli/handoff.md` (DELETE), `templates/sdd-handoff-writer-prompt.md` (DELETE)

**Dependencies:** Task 2 (remaining templates no longer reference them)

### Task 4: Update task shell scripts — claude + cursor

**What:** Per spec §4.3:

**Both scripts (`claude.sh` and `cursor.sh`):**
- Delete `--segment` arg parsing block, `SDD_SEGMENT` variable
- Delete `export SDD_HANDOFF_SEGMENT="${SDD_SEGMENT:-}"` line in `_sdd_set_task_env`
- `usage()`: mode list → `implement|review|fix`
- Remove `case "$SDD_MODE_ARG"` handoff branch (cursor: the `handoff)` case that checked `SDD_HANDOFF_SEGMENT` and called `sdd_assert_handoff`; claude: `_sdd_claude_prepare_prompt` handoff branch + final `case` block calling `sdd_assert_handoff`)
- handoff mode received → error exit with message `"handoff mode removed: handoff write is now inline"`
- Review-package shell invocation untouched (`_sdd_run_review_package` in both scripts)

**Claude-only:**
- Delete `_sdd_claude_skill_prefix` function entirely
- `_sdd_claude_prepare_prompt`: remove handoff prefix branch, keep only review → `Skill(mattpocock-skills:code-review)`

**Cursor-only (no prefix mechanism):**
- Cursor script has no `_sdd_cursor_skill_prefix` or `_sdd_cursor_prepare_prompt` — it renders templates directly via `sdd_render_template` without any `Skill(...)` prefix injection. No prefix cleanup needed.

**Files:** `bin/sdd-run-task-claude.sh`, `bin/sdd-run-task-cursor.sh` (MODIFY)

**Dependencies:** None (can run in parallel with Task 1–3)

### Task 5: Update `sdd-common.sh`

**What:** Per spec §4.3:
- Delete `sdd_assert_handoff` function (~25 lines)
- `sdd_require_env`: delete `handoff)` case `SDD_HANDOFF_SEGMENT` validation block; mode valid set → `implement|review|fix`
- `sdd_template_var`: delete `HANDOFF)` and `SEGMENT)` cases (function name is `_sdd_template_value` in code; variables now resolved by parent template scope per spec §4.2 note)
- Remove `SEGMENT` from `placeholders` array in `sdd_render_template` (line ~87) — stale placeholder produces empty string but should be cleaned up
- `sdd_require_env` mode valid set → `implement|review|fix`

**Files:** `bin/lib/sdd-common.sh` (MODIFY)

**Dependencies:** None (can run in parallel with Task 1–4)

### Task 6: Update plan shell scripts — claude + cursor

**What:** Per spec §4.3:
- `_run_task_chain`: remove `_run_task_mode "$n" handoff implement`, `_run_task_mode "$n" handoff review`, `_run_task_mode "$n" handoff fix` lines
- `_run_task_mode`: remove `segment` param handling and `--segment` flag in command array
- `unset SDD_HANDOFF_SEGMENT` → remove line
- Chain: `implement → review → [fix → review]`
- `_handoff_status` function kept as-is (reads handoff.json written inline by implement/review/fix modes)
- `_append_ledger` function kept as-is
- Fix loop (lines 154–185): remove handoff mode calls, keep `fix → review` cycle and `_handoff_status` gate
- Apply identical changes to both `sdd-run-plan-claude.sh` and `sdd-run-plan-cursor.sh`

**Files:** `bin/sdd-run-plan-claude.sh`, `bin/sdd-run-plan-cursor.sh` (MODIFY)

**Dependencies:** Task 5 (`sdd-common.sh` mode validation settled)

### Task 7: Update SDD orchestrator skill files

**What:** Modify 4 skill files per spec §4.4:
- `spor-subagent-driven-development/SKILL.md`: Rule 0 checklist → `implement → review` (remove `handoff/implement` and `handoff/review`); Rule 1 "code-review + handoff-writer" → "code-review + inline handoff write"; Rule 2 "handoff-writer fix segment" → "inline handoff write"; Rule 4 "handoff-writer cheapest" → "handoff is inline, no separate model"; Rule 7 "four-mode" → "three-mode"; Red Flags "handoff-writer can wait until plan end" → update
- `spor-sdd-p0-fallback/SKILL.md`: Rule 5c → "handoff write is inline in implement/review/fix modes per templates"; D4 → remove "After both axes finish, handoff-writer must run" (handoff write is now the last step in review mode); D4 red flags → update
- `spor-token-efficient-controller-handoff/SKILL.md`: H5 → reword from "mandatory handoff-writer subagent after every mode" to "handoff write is the last step inside each mode, per template instructions"; H5 red flags → update;
- `spor-handoff-writer/SKILL.md`: frontmatter description → append "Schema reference doc — handoff write is now inline in implement/review/fix templates per H6 p1. This skill is no longer independently dispatched." No body changes needed (already functions as reference doc).

**Files:** `skills/spor-subagent-driven-development/SKILL.md`, `skills/spor-sdd-p0-fallback/SKILL.md`, `skills/spor-token-efficient-controller-handoff/SKILL.md`, `skills/spor-handoff-writer/SKILL.md` (MODIFY)

**Dependencies:** Task 2 (templates must show inline model for skill references to be consistent)

### Task 8: Update reference docs

**What:** Modify 4 doc files:
- `plugins/superpowers-overrides/docs/sdd-h6-reference.md`: H6 mode table — delete handoff row, delete `SDD_HANDOFF_SEGMENT` row, update row count; typical shell sequence block — remove handoff lines, show 2-line chain; Mode B description — update from "4-mode chain" to "3-mode chain per task"
- `plugins/superpowers-overrides/docs/cross-harness-overrides.md`: invocation mode example — mode list `implement|handoff|review|fix` → `implement|review|fix`; template table — remove `handoff.md` row
- `plugins/superpowers-overrides/README.md` + `plugins/superpowers-overrides/README.zh-CN.md` (2 files, same changes): cross-cutting skills table — `spor-handoff-writer` add note "(schema reference, no longer independently dispatched)"; Mode A usage line — `implement|handoff|review|fix` → `implement|review|fix`

**Files:** `plugins/superpowers-overrides/docs/sdd-h6-reference.md`, `plugins/superpowers-overrides/docs/cross-harness-overrides.md`, `plugins/superpowers-overrides/README.md`, `plugins/superpowers-overrides/README.zh-CN.md` (MODIFY)

**Dependencies:** None (can run in parallel with Task 6–7)

### Task 9: Write dry-run test + update existing smoke test

**What:** New file `tests/sdd-run-task-claude-dry-run.sh`:
- Create fixture workspace (tmp dir) with stub brief (`TASK_BASE: $(git rev-parse HEAD)`), existing handoff.json, test-evidence.json
- `SDD_DRY_RUN=1 sdd-run-task-claude.sh --task 1 --mode implement`: assert exit 0, stdout H1 4 lines
- `SDD_DRY_RUN=1 sdd-run-task-claude.sh --task 1 --mode review`: assert exit 0
- `SDD_DRY_RUN=1 sdd-run-task-claude.sh --task 1 --mode fix`: assert exit 0
- `SDD_DRY_RUN=1 sdd-run-task-claude.sh --task 1 --mode handoff`: assert non-zero exit, error on stderr
- `SDD_DRY_RUN=1 sdd-run-task-claude.sh --task 1 --mode implement --segment implement`: assert exit 2 (usage error)

**Also update existing `tests/sdd-cli-dry-run-smoke.sh`:**
- This test iterates over modes including `handoff:implement` and `handoff:review` with `--segment` flags. Remove handoff mode entries from the test's mode list so the test still passes.
- Update `tests/validate-overrides-build.sh`: add new test script to executable assertion list

**Files:** `tests/sdd-run-task-claude-dry-run.sh` (NEW), `tests/sdd-cli-dry-run-smoke.sh` (MODIFY), `tests/validate-overrides-build.sh` (MODIFY)

**Dependencies:** Task 4, 5, 6 (shell scripts must be ready before testing)

### Task 10: Validate + changeset

**What:**
1. Run `pnpm run validate` (full CI suite — all gate + harness tests must pass)
2. Run new dry-run test: `./plugins/superpowers-overrides/tests/sdd-run-task-claude-dry-run.sh`
3. Run `pnpm changeset` — describe the breaking change (handoff mode removal, inline handoff write)
4. Final scan should return zero results in `bin/`, `skills/`, `templates/` (docs may have change-history references):
   ```
   grep -rn 'sdd_assert_handoff\|_sdd_claude_skill_prefix\|_sdd_cursor_skill_prefix\|--mode handoff\| --segment \|SDD_HANDOFF_SEGMENT\|SDD_SEGMENT' plugins/superpowers-overrides/
   ```

**Files:** `.changeset/*.md` (NEW from changeset)

**Dependencies:** Task 1–9

## Task Dependency Graph

```
Task 1 (fragment) ──→ Task 2 (templates) ──→ Task 3 (delete)
                                                  │
Task 4 (task scripts) ────────────────────→ Task 6 (plan scripts)
Task 5 (common.sh) ───────────────────────→ Task 6
                                                  │
Task 2 ──→ Task 7 (skill files)                  │
           Task 8 (docs)                          │
                                                  ▼
                                          Task 9 (tests)
                                                  │
                                                  ▼
                                          Task 10 (validate)
```

**Parallel groups:**
- Wave 1: T1, T4, T5, T8 (independent)
- Wave 2: T2 (after T1), T6 (after T4+T5)
- Wave 3: T3 (after T2), T7 (after T2)
- Wave 4: T9 (after T4+T5+T6)
- Wave 5: T10 (after all)
