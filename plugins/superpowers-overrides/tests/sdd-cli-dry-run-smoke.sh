#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAN="$ROOT/../../docs/superpowers/plans/2026-08-05-sdd-dogfood-synthetic.md"
export SDD_DRY_RUN=1 SDD_WORKSPACE="${TMPDIR:-/tmp}/sdd-dry-run-$$"
mkdir -p "$SDD_WORKSPACE"
echo "# SDD ledger — plan: $PLAN" > "$SDD_WORKSPACE/progress.md"
echo "constraints" > "$SDD_WORKSPACE/plan-constraints.md"
echo "# task 1" > "$SDD_WORKSPACE/task-1-brief.md"

for mode in implement review fix; do
  SDD_MODE=$mode SDD_TASK_BRIEF="$SDD_WORKSPACE/task-1-brief.md" \
  SDD_LEDGER="$SDD_WORKSPACE/progress.md" \
  SDD_PLAN_CONSTRAINTS="$SDD_WORKSPACE/plan-constraints.md" \
  SDD_HANDOFF_PATH="$SDD_WORKSPACE/task-1-handoff.json" \
  SDD_REVIEW_FIXED_POINT="${SDD_REVIEW_FIXED_POINT:-HEAD~1}" \
  "$ROOT/bin/sdd-run-task-claude.sh" --task 1 --mode "$mode" --plan "$PLAN" | head -4
done

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
