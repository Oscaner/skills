#!/usr/bin/env bash
# sdd-cli-dry-run-smoke.sh — argument-parsing / orchestration smoke for the
# thin claude + cursor task shells (p1). SDD_DRY_RUN=1 skips the live CLI
# (claude / cursor-agent) PATH check and the real invocation; the shared
# run-loop still runs template render + commit-contract validation.
#
# Cursor keeps no Skill(...) review-prefix injection (spec D3a) — the cursor
# loop exercises the thin-shell glue with an empty review_prefix.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAN="$ROOT/../../docs/superpowers/plans/2026-08-05-sdd-dogfood-synthetic.md"
export SDD_DRY_RUN=1 SDD_WORKSPACE="${TMPDIR:-/tmp}/sdd-dry-run-$$"
mkdir -p "$SDD_WORKSPACE"
echo "# SDD ledger — plan: $PLAN" > "$SDD_WORKSPACE/progress.md"
echo "constraints" > "$SDD_WORKSPACE/plan-constraints.md"
echo "# task 1" > "$SDD_WORKSPACE/task-1-brief.md"

# run_shell_modes <shell_path> — exercise one thin harness shell across all
# three modes. SDD_DRY_RUN=1 skips the live CLI PATH check (cursor-agent is
# absent in CI) and the real invocation; the shared run-loop still runs template
# render + commit-contract validation. (Cursor's empty review_prefix — spec
# D3a — is documented in the file header; each shell is driven verbatim.)
run_shell_modes() {
  local shell_path="$1"
  for mode in implement review fix; do
    SDD_MODE=$mode SDD_TASK_BRIEF="$SDD_WORKSPACE/task-1-brief.md" \
    SDD_LEDGER="$SDD_WORKSPACE/progress.md" \
    SDD_PLAN_CONSTRAINTS="$SDD_WORKSPACE/plan-constraints.md" \
    SDD_HANDOFF_PATH="$SDD_WORKSPACE/task-1-handoff.json" \
    SDD_REVIEW_FIXED_POINT="${SDD_REVIEW_FIXED_POINT:-HEAD~1}" \
    "$shell_path" --task 1 --mode "$mode" --plan "$PLAN" | head -4
  done
}

run_shell_modes "$ROOT/bin/sdd-run-task-claude.sh"
run_shell_modes "$ROOT/bin/sdd-run-task-cursor.sh"

# Verify handoff mode is rejected
if SDD_MODE=handoff SDD_TASK_BRIEF="$SDD_WORKSPACE/task-1-brief.md" \
  SDD_LEDGER="$SDD_WORKSPACE/progress.md" \
  SDD_PLAN_CONSTRAINTS="$SDD_WORKSPACE/plan-constraints.md" \
  SDD_HANDOFF_PATH="$SDD_WORKSPACE/task-1-handoff.json" \
  "$ROOT/bin/sdd-run-task-claude.sh" --task 1 --mode handoff --plan "$PLAN" 2>/dev/null; then
  echo "FAIL: handoff mode should have been rejected"
  exit 1
fi

echo "OK — sdd-cli-dry-run-smoke"
