#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAN="$ROOT/../../docs/superpowers/plans/2026-08-05-sdd-dogfood-synthetic.md"
export SDD_DRY_RUN=1 SDD_WORKSPACE="${TMPDIR:-/tmp}/sdd-dry-run-$$"
mkdir -p "$SDD_WORKSPACE"
echo "# SDD ledger — plan: $PLAN" > "$SDD_WORKSPACE/progress.md"
echo "constraints" > "$SDD_WORKSPACE/plan-constraints.md"
echo "# task 1" > "$SDD_WORKSPACE/task-1-brief.md"
for spec in "implement:" "handoff:implement" "review:"; do
  mode="${spec%%:*}"
  segment="${spec#*:}"
  if [[ "$mode" == "handoff" ]]; then
    export SDD_HANDOFF_SEGMENT="$segment"
    SDD_MODE=$mode SDD_TASK_BRIEF="$SDD_WORKSPACE/task-1-brief.md" \
    SDD_LEDGER="$SDD_WORKSPACE/progress.md" \
    SDD_PLAN_CONSTRAINTS="$SDD_WORKSPACE/plan-constraints.md" \
    SDD_HANDOFF_PATH="$SDD_WORKSPACE/task-1-handoff.json" \
    SDD_REVIEW_FIXED_POINT="${SDD_REVIEW_FIXED_POINT:-HEAD~1}" \
    "$ROOT/bin/sdd-run-task-cursor.sh" --task 1 --mode "$mode" --segment "$segment" --plan "$PLAN" | head -4
  else
    SDD_MODE=$mode SDD_TASK_BRIEF="$SDD_WORKSPACE/task-1-brief.md" \
    SDD_LEDGER="$SDD_WORKSPACE/progress.md" \
    SDD_PLAN_CONSTRAINTS="$SDD_WORKSPACE/plan-constraints.md" \
    SDD_HANDOFF_PATH="$SDD_WORKSPACE/task-1-handoff.json" \
    SDD_REVIEW_FIXED_POINT="${SDD_REVIEW_FIXED_POINT:-HEAD~1}" \
    "$ROOT/bin/sdd-run-task-cursor.sh" --task 1 --mode "$mode" --plan "$PLAN" | head -4
  fi
done
echo "OK — sdd-cli-dry-run-smoke"
