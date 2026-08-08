#!/usr/bin/env bash
# sdd-commit-gate-smoke.sh — end-to-end smoke for the commit-contract validator
# (sdd_validate_commit_contract, spec §4.2) driven through the real claude
# harness shell under SDD_DRY_RUN=1.
#
# Coverage (plan Task 5 + spec D4):
#   1. dirty-tree fix    → H1 status: BLOCKED, non-zero exit, handoff rewritten
#   2. clean-tree fix    → H1 status: DONE, handoff.commits.head == git HEAD
#   3. non-git workspace → fail-open: status: DONE preserved, no BLOCKED
#   4. dirty-tree implement → BLOCKED (D3b active override, not just fix)
#   5. clean tree + wrong handoff.commits.head → BLOCKED (F1 head consistency)
#
# Harness coverage note (F4): this smoke drives the claude thin shell
# (sdd-run-task-claude.sh). Cursor's validator interception is covered by
# sdd-cli-dry-run-smoke.sh's cursor loop — that covers the thin-shell glue, not
# the interception itself. The cursor and claude shells share the same
# sdd_run_task/validator (bin/lib/sdd-common.sh, behavior single source of
# truth), so the interception path driven through the claude shell here plus the
# glue driven through the cursor loop covers both. Smoke structure is unchanged
# (not double-run) to keep fixture overhead from doubling.
#
# Fixture isolation: shared sdd-gate-test-lib.sh. The commit-gate scene ships
# only a .gitignore (sdd/ ignored, mirroring the real repo); the workspace
# files (brief with <SHA>, ledger, constraints, seed handoff) are materialized
# inside the git-init'ed copy so the tree stays clean for the control group.
#
# SDD_DRY_RUN=1 skips the claude PATH check and the real CLI — the run-loop
# still executes sdd_validate_commit_contract (contract validation runs git
# status, not the CLI). The copy's own HEAD is used for both the brief's
# TASK_BASE and the seed handoff's commits pair, so a clean return must
# reproduce exactly that HEAD (P4 anti-pattern: fixture files are never
# modified — the copy is, then auto-cleaned).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAN="$ROOT/../../docs/superpowers/plans/2026-08-05-sdd-dogfood-synthetic.md"
HARNESS="$ROOT/bin/sdd-run-task-claude.sh"
export SDD_DRY_RUN=1

# shellcheck source=tests/sdd-gate-test-lib.sh
source "$ROOT/tests/sdd-gate-test-lib.sh"

fail() { echo "FAIL: $1" >&2; exit 1; }
ASSERT_COUNT=0

# run_task <workspace> <task> <mode> — invoke the harness in a subshell with
# the fixture workspace; cwd is the copy so git diagnostics resolve to it.
run_task() {
  local ws="$1" task="$2" mode="$3"
  (
    cd "$ws"
    export SDD_WORKSPACE="$ws/sdd/commit-gate-ws"
    export SDD_TASK_BRIEF="$SDD_WORKSPACE/task-${task}-brief.md"
    export SDD_LEDGER="$SDD_WORKSPACE/progress.md"
    export SDD_PLAN_CONSTRAINTS="$SDD_WORKSPACE/plan-constraints.md"
    export SDD_HANDOFF_PATH="$SDD_WORKSPACE/task-${task}-handoff.json"
    export SDD_FINDINGS="$SDD_WORKSPACE/task-${task}-open-findings.json"
    if [[ "$mode" == "fix" ]]; then
      export SDD_REVIEW_FIXED_POINT=HEAD~1
    fi
    "$HARNESS" --task "$task" --mode "$mode" --plan "$PLAN"
  )
}

# seed_handoff <ws> <task> <head_sha> — create a handoff whose commits pair
# carries the copy's own HEAD, so a clean return must match it exactly.
seed_handoff() {
  local ws="$1" task="$2" head_sha="$3"
  printf '{"status":"DONE","phase":"implement","task":%s,"commits":{"base":"%s","head":"%s"}}\n' \
    "$task" "$head_sha" "$head_sha" > "$ws/sdd/commit-gate-ws/task-${task}-handoff.json"
}

# materialize_ws <ws> <task> — create the gitignored workspace (brief, ledger,
# constraints) inside the copy and seed the handoff with the copy's own HEAD.
# Called after setup_scenario; leaves the tracked tree clean so a control run
# can assert handoff.commits.head == git HEAD without a dirty-tree false hit.
materialize_ws() {
  local ws="$1" task="$2" head_sha
  head_sha="$(git -C "$ws" rev-parse HEAD)"
  mkdir -p "$ws/sdd/commit-gate-ws"
  printf 'TASK_BASE: %s\n' "$(git -C "$ws" rev-parse --short HEAD)" > "$ws/sdd/commit-gate-ws/task-${task}-brief.md"
  printf '# SDD ledger — plan: %s\n' "$PLAN" > "$ws/sdd/commit-gate-ws/progress.md"
  printf '# constraints\n' > "$ws/sdd/commit-gate-ws/plan-constraints.md"
  seed_handoff "$ws" "$task" "$head_sha"
}

echo "== 1. dirty-tree fix → BLOCKED, non-zero, handoff rewritten =="
setup_scenario commit-gate dirty-ws
DIRTY_FIX="$SCEN_DEST"
materialize_ws "$DIRTY_FIX" 1
# Dirty the tracked tree (fixture's .gitignore was committed during setup).
printf 'dirty\n' >> "$DIRTY_FIX/.gitignore"

out="$(run_task "$DIRTY_FIX" 1 fix || true)"
if printf '%s' "$out" | grep -q '^status: DONE'; then
  fail "dirty-tree fix: H1 status should be BLOCKED, got DONE"
fi
printf '%s' "$out" | grep -q '^status: BLOCKED' || fail "dirty-tree fix: H1 status not BLOCKED"
printf '%s' "$out" | grep -q '^blocker: uncommitted changes at return' || fail "dirty-tree fix: blocker missing"
# exit non-zero (validated by the || true above; assert via a direct run)
set +e
run_task "$DIRTY_FIX" 1 fix >/dev/null 2>&1
rc=$?
set -e
[[ "$rc" -ne 0 ]] || fail "dirty-tree fix: expected non-zero exit, got 0"
[[ "$(jq -r '.status' "$DIRTY_FIX/sdd/commit-gate-ws/task-1-handoff.json")" == "BLOCKED" ]] \
  || fail "dirty-tree fix: handoff.status != BLOCKED"
ASSERT_COUNT=$((ASSERT_COUNT + 4))

echo "== 2. clean-tree fix control → DONE, handoff.head == git HEAD =="
setup_scenario commit-gate clean-ws
CLEAN_FIX="$SCEN_DEST"
materialize_ws "$CLEAN_FIX" 1
git -C "$CLEAN_FIX" status --porcelain | grep -q . && fail "clean-ws: tree should be clean after seed"

out="$(run_task "$CLEAN_FIX" 1 fix)"
printf '%s' "$out" | grep -q '^status: DONE' || fail "clean-tree fix: H1 status != DONE"
head_sha="$(jq -r '.commits.head' "$CLEAN_FIX/sdd/commit-gate-ws/task-1-handoff.json")"
[[ "$head_sha" == "$(git -C "$CLEAN_FIX" rev-parse HEAD)" ]] \
  || fail "clean-tree fix: handoff.commits.head $head_sha != HEAD $(git -C "$CLEAN_FIX" rev-parse HEAD)"
ASSERT_COUNT=$((ASSERT_COUNT + 2))

echo "== 3. non-git workspace → fail-open (DONE preserved) =="
# Under TMPROOT so the lib's EXIT trap removes it even on assertion failure.
NOGIT="$TMPROOT/nogit"
mkdir -p "$NOGIT"
printf 'TASK_BASE: abc1234\n' > "$NOGIT/task-1-brief.md"
printf '# SDD ledger — plan: %s\n' "$PLAN" > "$NOGIT/progress.md"
printf '# constraints\n' > "$NOGIT/plan-constraints.md"
printf '{"status":"DONE","commits":{"base":"abc","head":"abc"}}\n' > "$NOGIT/task-1-handoff.json"
out="$(cd "$NOGIT" && SDD_WORKSPACE="$NOGIT" \
  SDD_TASK_BRIEF="$NOGIT/task-1-brief.md" SDD_LEDGER="$NOGIT/progress.md" \
  SDD_PLAN_CONSTRAINTS="$NOGIT/plan-constraints.md" SDD_HANDOFF_PATH="$NOGIT/task-1-handoff.json" \
  SDD_REVIEW_FIXED_POINT=HEAD~1 \
  "$HARNESS" --task 1 --mode fix --plan "$PLAN")"
printf '%s' "$out" | grep -q '^status: DONE' || fail "non-git: H1 status != DONE (fail-open violated)"
[[ "$(jq -r '.status' "$NOGIT/task-1-handoff.json")" == "DONE" ]] \
  || fail "non-git: handoff.status rewritten (should be untouched)"
ASSERT_COUNT=$((ASSERT_COUNT + 2))

echo "== 4. dirty-tree implement → BLOCKED (D3b active override) =="
setup_scenario commit-gate imp-ws
IMP_FIX="$SCEN_DEST"
materialize_ws "$IMP_FIX" 1
printf 'dirty\n' >> "$IMP_FIX/.gitignore"

set +e
out="$(run_task "$IMP_FIX" 1 implement 2>&1)"
rc=$?
set -e
printf '%s' "$out" | grep -q '^status: BLOCKED' || fail "dirty implement: H1 status != BLOCKED"
[[ "$rc" -ne 0 ]] || fail "dirty implement: expected non-zero exit"
[[ "$(jq -r '.status' "$IMP_FIX/sdd/commit-gate-ws/task-1-handoff.json")" == "BLOCKED" ]] \
  || fail "dirty implement: handoff.status != BLOCKED"
ASSERT_COUNT=$((ASSERT_COUNT + 3))

echo "== 5. clean tree + wrong head → BLOCKED (F1 head consistency) =="
setup_scenario commit-gate head-ws
HEAD_FIX="$SCEN_DEST"
materialize_ws "$HEAD_FIX" 1
# Seed a handoff whose commits.head is NOT the copy's HEAD (tree stays clean).
wrong="0000000000000000000000000000000000000000"
printf '{"status":"DONE","phase":"implement","task":1,"commits":{"base":"%s","head":"%s"}}\n' \
  "$(git -C "$HEAD_FIX" rev-parse HEAD)" "$wrong" > "$HEAD_FIX/sdd/commit-gate-ws/task-1-handoff.json"
git -C "$HEAD_FIX" status --porcelain | grep -q . && fail "head-ws: tree should be clean after seed"

set +e
out="$(run_task "$HEAD_FIX" 1 fix 2>&1)"
rc=$?
set -e
printf '%s' "$out" | grep -q '^status: BLOCKED' || fail "head mismatch: H1 status != BLOCKED"
printf '%s' "$out" | grep -q '^blocker: handoff commits.head' || fail "head mismatch: blocker missing"
printf '%s' "$out" | grep -q "does not match HEAD" || fail "head mismatch: blocker lacks HEAD comparison"
[[ "$rc" -ne 0 ]] || fail "head mismatch: expected non-zero exit"
[[ "$(jq -r '.status' "$HEAD_FIX/sdd/commit-gate-ws/task-1-handoff.json")" == "BLOCKED" ]] \
  || fail "head mismatch: handoff.status != BLOCKED"
ASSERT_COUNT=$((ASSERT_COUNT + 5))

echo "OK — sdd-commit-gate-smoke ($ASSERT_COUNT assertions)"
