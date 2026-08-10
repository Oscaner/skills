#!/usr/bin/env bash
# cdd-cli-dry-run-smoke.sh — argument-parsing / orchestration smoke for the
# thin cdd-run.sh harness shells (p1). CDD_DRY_RUN=1 skips the live CLI
# (claude / cursor-agent) PATH check and the real invocation; the shared
# run-loop still runs template render + commit-contract validation.
#
# NOTE: requires bin/cdd-run.sh (created in T4). This test is enabled after T4
# completes; until then it is a skeleton only.
#
# Cursor keeps no Skill(...) review-prefix injection (spec D3a) — the cursor
# loop exercises the thin-shell glue with an empty review_prefix.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAN="$ROOT/../../docs/superpowers/plans/2026-08-05-sdd-dogfood-synthetic.md"
export CDD_DRY_RUN=1 CDD_WORKSPACE="${TMPDIR:-/tmp}/cdd-dry-run-$$"
mkdir -p "$CDD_WORKSPACE"
echo "# CDD ledger — plan: $PLAN" > "$CDD_WORKSPACE/progress.md"
echo "constraints" > "$CDD_WORKSPACE/plan-constraints.md"
echo "# task 1" > "$CDD_WORKSPACE/task-1-brief.md"

# run_shell_modes <harness> — exercise one harness across all three modes via
# cdd-run.sh. CDD_DRY_RUN=1 skips the live CLI PATH check and the real
# invocation; the shared run-loop still runs template render + commit-contract
# validation.
run_shell_modes() {
  local harness="$1"
  for mode in implement review fix; do
    CDD_MODE=$mode CDD_TASK_BRIEF="$CDD_WORKSPACE/task-1-brief.md" \
    CDD_LEDGER="$CDD_WORKSPACE/progress.md" \
    CDD_PLAN_CONSTRAINTS="$CDD_WORKSPACE/plan-constraints.md" \
    CDD_HANDOFF_PATH="$CDD_WORKSPACE/task-1-handoff.json" \
    CDD_REVIEW_FIXED_POINT="${CDD_REVIEW_FIXED_POINT:-HEAD~1}" \
    "$ROOT/bin/cdd-run.sh" --harness "$harness" --task 1 --mode "$mode" --plan "$PLAN" | head -4
  done
}

run_shell_modes claude
run_shell_modes cursor-agent

# Verify handoff mode is rejected
if CDD_MODE=handoff CDD_TASK_BRIEF="$CDD_WORKSPACE/task-1-brief.md" \
  CDD_LEDGER="$CDD_WORKSPACE/progress.md" \
  CDD_PLAN_CONSTRAINTS="$CDD_WORKSPACE/plan-constraints.md" \
  CDD_HANDOFF_PATH="$CDD_WORKSPACE/task-1-handoff.json" \
  "$ROOT/bin/cdd-run.sh" --harness claude --task 1 --mode handoff --plan "$PLAN" 2>/dev/null; then
  echo "FAIL: handoff mode should have been rejected"
  exit 1
fi

echo "OK — cdd-cli-dry-run-smoke"
