#!/usr/bin/env bash
# sdd-common-functions.test.sh — T0 shared-library foundation tests.
# Exercises the five shared functions added to lib/sdd-common.sh:
#   sdd_render_mode_prompt, sdd_check_cli, sdd_validate_commit_contract,
#   sdd_run_task, sdd_run_plan
# plus their H1-from-handoff contract (spec §4.2 / plan Task 1).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$ROOT/bin/lib/sdd-common.sh"
TESTROOT="$(mktemp -d)"
trap 'rm -rf "$TESTROOT"' EXIT

pass=0
fail=0

note() { printf '%s\n' "$*" >&2; }

# assert_eq <desc> <expected> <actual>
assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    pass=$((pass + 1))
    note "PASS: $desc"
  else
    fail=$((fail + 1))
    note "FAIL: $desc"
    note "  expected: $expected"
    note "  actual:   $actual"
  fi
}

# assert_rc <desc> <expected_rc> <actual_rc>
assert_rc() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    pass=$((pass + 1))
    note "PASS: $desc"
  else
    fail=$((fail + 1))
    note "FAIL: $desc (expected rc=$expected, got rc=$actual)"
  fi
}

# source the library under a stable identity (sourced via $LIB variable)
# shellcheck disable=SC1090,SC1091
source "$LIB"

# fake harness CLI invocation — records the prompt, writes a handoff + H1 lines
# (unused by the dry-run F4 paths; documents the _sdd_invoke_cli contract)
_fake_invoke() {
  _fake_prompt="$1"
  cat > "${SDD_HANDOFF_PATH}" <<EOF
{"task":1,"status":"DONE","commits":{"base":"${_fake_base}","head":"${_fake_head}"},"phase":"implement","artifacts":{},"findings":[],"unverifiable":[],"plan_conflicts":[]}
EOF
  cat <<EOF
status: DONE
commits: base=${_fake_base} head=${_fake_head}
artifacts: brief=${SDD_TASK_BRIEF} report=${SDD_WORKSPACE}/task-1-report.md test_evidence=${SDD_WORKSPACE}/task-1-test-evidence.json
blocker: none
EOF
}
_fake_base="fbbbbbb1"
_fake_head="fbbbbbb2"

###############################################################################
# F1. sdd_render_mode_prompt
###############################################################################
{
  export SDD_WORKSPACE="$TESTROOT/ws-render"
  export SDD_TASK_BRIEF="$TESTROOT/ws-render/task-1-brief.md"
  export SDD_HANDOFF_PATH="$TESTROOT/ws-render/task-1-handoff.json"
  export SDD_PLAN_CONSTRAINTS="$TESTROOT/ws-render/plan-constraints.md"

  # non-review: prefix ignored, template rendered
  plain="$(sdd_render_mode_prompt implement "Skill(mattpocock-skills:code-review)")" || true
  first_line="$(printf '%s\n' "$plain" | head -1)"
  assert_eq "F1 non-review first line" "# SDD implement — CLI session" "$first_line"

  # review with non-empty prefix: prefix prepended with blank line
  out="$(sdd_render_mode_prompt review "Skill(mattpocock-skills:code-review)")" || true
  first_line="$(printf '%s\n' "$out" | head -1)"
  assert_eq "F1 review prefix first line" "Skill(mattpocock-skills:code-review)" "$first_line"

  # review with empty prefix: no prefix (cursor-style)
  out2="$(sdd_render_mode_prompt review "")" || true
  first_line2="$(printf '%s\n' "$out2" | head -1)"
  assert_eq "F1 review empty prefix → template first line" "# SDD review — CLI session" "$first_line2"
}

###############################################################################
# F2. sdd_check_cli
###############################################################################
{
  # SDD_DRY_RUN=1 → no PATH check, rc 0 even for a bogus cli
  SDD_DRY_RUN=1 sdd_check_cli "definitely-not-a-real-cli-$$" && rc=0 || rc=$?
  assert_rc "F2 dry-run skips PATH check" 0 "$rc"

  # real cli on PATH passes
  SDD_DRY_RUN=0 sdd_check_cli "sh" && rc=0 || rc=$?
  assert_rc "F2 existing cli passes" 0 "$rc"

  # missing cli (non-dry-run) → rc 2 (sdd_exit_cli_missing) — subshell: it exits
  set +e
  ( SDD_DRY_RUN=0 sdd_check_cli "definitely-not-a-real-cli-$$" >/dev/null 2>&1 )
  rc=$?
  set -e
  assert_rc "F2 missing cli exits 2" 2 "$rc"
}

###############################################################################
# F3. sdd_validate_commit_contract — three states
###############################################################################
# F3a. review mode → always no-op (rc 0), even dirty
{
  export SDD_HANDOFF_PATH="$TESTROOT/ws3/handoff.json"
  mkdir -p "$TESTROOT/ws3"
  echo '{"status":"APPROVED"}' > "$SDD_HANDOFF_PATH"
  sdd_validate_commit_contract review && rc=0 || rc=$?
  assert_rc "F3a review mode no-op" 0 "$rc"
}

# F3b. non-git workspace → fail-open (rc 0), dirty tree cannot be detected
{
  export SDD_WORKSPACE="$TESTROOT/ws3/not-a-repo"
  mkdir -p "$SDD_WORKSPACE"
  echo 'dirty' > "$SDD_WORKSPACE/stray.txt"
  sdd_validate_commit_contract implement && rc=0 || rc=$?
  assert_rc "F3b non-git fail-open" 0 "$rc"
}

# F3c. clean tree → rc 0
{
  export SDD_WORKSPACE="$TESTROOT/ws3/clean-repo"
  mkdir -p "$SDD_WORKSPACE"
  git -C "$SDD_WORKSPACE" init -q
  git -C "$SDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  sdd_validate_commit_contract implement && rc=0 || rc=$?
  assert_rc "F3c clean tree passes" 0 "$rc"
}

# F3d. dirty tree + jq → rewrites handoff .status/.blocker, prints SDD_BLOCKED, rc 1
{
  export SDD_WORKSPACE="$TESTROOT/ws3/dirty-repo"
  export SDD_HANDOFF_PATH="$TESTROOT/ws3/dirty-handoff.json"
  mkdir -p "$SDD_WORKSPACE"
  git -C "$SDD_WORKSPACE" init -q
  git -C "$SDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  echo '{"status":"DONE","commits":{"base":"abc1234","head":"def5678"},"artifacts":{}}' > "$SDD_HANDOFF_PATH"
  echo 'untracked' > "$SDD_WORKSPACE/dirty.txt"

  set +e
  err="$(sdd_validate_commit_contract implement 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "F3d dirty tree rc 1" 1 "$rc"
  assert_eq "F3d SDD_BLOCKED message" "SDD_BLOCKED: uncommitted changes at return (implement) — dirty working tree" "$err"
  assert_eq "F3d handoff.status" "BLOCKED" "$(jq -r '.status' "$SDD_HANDOFF_PATH")"
  assert_eq "F3d handoff.blocker" "uncommitted changes at return (implement): dirty working tree" "$(jq -r '.blocker' "$SDD_HANDOFF_PATH")"
  # original fields preserved
  assert_eq "F3d handoff.commits.base preserved" "abc1234" "$(jq -r '.commits.base' "$SDD_HANDOFF_PATH")"
}

# F3e. dirty tree, no jq → prints SDD_BLOCKED, rc 1 (no silent pass)
{
  export SDD_WORKSPACE="$TESTROOT/ws3/dirty-repo-nojq"
  export SDD_HANDOFF_PATH="$TESTROOT/ws3/nojq-handoff.json"
  mkdir -p "$SDD_WORKSPACE"
  git -C "$SDD_WORKSPACE" init -q
  git -C "$SDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  echo '{"status":"DONE","commits":{"base":"abc1234","head":"def5678"}}' > "$SDD_HANDOFF_PATH"
  echo 'untracked' > "$SDD_WORKSPACE/dirty.txt"

  set +e
  # mask jq entirely: minimal PATH with only git/mktemp/mv (jq absent)
  njqbin="$TESTROOT/ws3/njqbin"
  mkdir -p "$njqbin"
  for b in git mktemp mv; do
    ln -sf "$(command -v "$b")" "$njqbin/$b"
  done
  err="$(PATH="$njqbin" sdd_validate_commit_contract fix 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "F3e dirty tree no-jq rc 1" 1 "$rc"
  assert_eq "F3e SDD_BLOCKED message (fix)" "SDD_BLOCKED: uncommitted changes at return (fix) — dirty working tree" "$err"
  # no jq → handoff untouched (grep, not jq)
  assert_eq "F3e handoff untouched (no jq)" "1" "$(grep -c '"status":"DONE"' "$SDD_HANDOFF_PATH")"
}

###############################################################################
# F4. sdd_run_task
###############################################################################
# F4a. validator intercept (dirty tree) → H1 from rewritten handoff, non-zero exit
{
  export SDD_DRY_RUN=1
  export SDD_WORKSPACE="$TESTROOT/ws4/dirty"
  export SDD_LEDGER="$SDD_WORKSPACE/progress.md"
  export SDD_TASK_BRIEF="$SDD_WORKSPACE/task-1-brief.md"
  export SDD_HANDOFF_PATH="$SDD_WORKSPACE/task-1-handoff.json"
  export SDD_PLAN_CONSTRAINTS="$SDD_WORKSPACE/plan-constraints.md"
  export SDD_MODE=implement
  export SDD_MODE_ARG=implement
  export PLAN_FILE="$TESTROOT/ws4/plan.md"
  mkdir -p "$SDD_WORKSPACE"
  echo "# task 1" > "$SDD_TASK_BRIEF"
  echo "# SDD ledger — plan: $PLAN_FILE" > "$SDD_LEDGER"
  echo "constraints" > "$SDD_PLAN_CONSTRAINTS"
  echo "# Plan" > "$PLAN_FILE"

  # seed handoff so H1-from-handoff has values
  cat > "$SDD_HANDOFF_PATH" <<EOF
{"task":1,"status":"DONE","commits":{"base":"bbbbbb1","head":"bbbbbb2"},"phase":"implement","artifacts":{"brief":"b.md","report":"r.md","test_evidence":"t.json"},"findings":[],"unverifiable":[],"plan_conflicts":[]}
EOF

  git -C "$SDD_WORKSPACE" init -q
  git -C "$SDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  echo 'dirty' > "$SDD_WORKSPACE/dirty.txt"

  # _sdd_invoke_cli defined by the (fake) harness shell — invoked indirectly by sdd_run_task
  # shellcheck disable=SC2329
  _sdd_invoke_cli() { _fake_invoke "$1"; }

  set +e
  h1="$(sdd_run_task sh "" 1 2>/dev/null)"
  rc=$?
  set -e

  assert_rc "F4a validator intercept → non-zero exit" 1 "$rc"
  assert_eq "F4a H1 status BLOCKED" "status: BLOCKED" "$(printf '%s\n' "$h1" | grep '^status:')"
  assert_eq "F4a H1 commits base" "commits: base=bbbbbb1 head=bbbbbb2" "$(printf '%s\n' "$h1" | grep '^commits:')"
  assert_eq "F4a H1 artifacts" "artifacts: brief=b.md report=r.md test_evidence=t.json" "$(printf '%s\n' "$h1" | grep '^artifacts:')"
  assert_eq "F4a H1 blocker" "blocker: uncommitted changes at return (implement): dirty working tree" "$(printf '%s\n' "$h1" | grep '^blocker:')"
}

# F4b. validator pass (clean tree, dry-run) → H1 from $agent_out, exit 0
{
  export SDD_DRY_RUN=1
  export SDD_WORKSPACE="$TESTROOT/ws4/clean"
  export SDD_LEDGER="$SDD_WORKSPACE/progress.md"
  export SDD_TASK_BRIEF="$SDD_WORKSPACE/task-1-brief.md"
  export SDD_HANDOFF_PATH="$SDD_WORKSPACE/task-1-handoff.json"
  export SDD_PLAN_CONSTRAINTS="$SDD_WORKSPACE/plan-constraints.md"
  export SDD_MODE=implement
  export SDD_MODE_ARG=implement
  export PLAN_FILE="$TESTROOT/ws4/plan-clean.md"
  mkdir -p "$SDD_WORKSPACE"
  echo "# task 1" > "$SDD_TASK_BRIEF"
  echo "# SDD ledger — plan: $PLAN_FILE" > "$SDD_LEDGER"
  echo "constraints" > "$SDD_PLAN_CONSTRAINTS"
  echo "# Plan" > "$PLAN_FILE"
  git -C "$SDD_WORKSPACE" init -q
  git -C "$SDD_WORKSPACE" add -A
  git -C "$SDD_WORKSPACE" -c user.name=t -c user.email=t@e commit -qm init

  # shellcheck disable=SC2329
  _sdd_invoke_cli() { _fake_invoke "$1"; }  # unused in dry-run

  set +e
  h1="$(sdd_run_task sh "" 1 2>/dev/null)"
  rc=$?
  set -e

  assert_rc "F4b clean dry-run exit 0" 0 "$rc"
  assert_eq "F4b H1 status DONE" "status: DONE" "$(printf '%s\n' "$h1" | grep '^status:')"
  assert_eq "F4b H1 base dry-run" "commits: base=dry-run head=dry-run" "$(printf '%s\n' "$h1" | grep '^commits:')"
}

# F4c. review mode dry-run (empty review_prefix, cursor-style) → H1 from agent_out, exit 0
{
  export SDD_DRY_RUN=1
  export SDD_WORKSPACE="$TESTROOT/ws4/review"
  export SDD_LEDGER="$SDD_WORKSPACE/progress.md"
  export SDD_TASK_BRIEF="$SDD_WORKSPACE/task-1-brief.md"
  export SDD_HANDOFF_PATH="$SDD_WORKSPACE/task-1-handoff.json"
  export SDD_PLAN_CONSTRAINTS="$SDD_WORKSPACE/plan-constraints.md"
  export SDD_MODE=review
  export SDD_MODE_ARG=review
  export SDD_REVIEW_FIXED_POINT=HEAD~1
  export PLAN_FILE="$TESTROOT/ws4/plan-review.md"
  mkdir -p "$SDD_WORKSPACE"
  echo "# task 1" > "$SDD_TASK_BRIEF"
  echo "# SDD ledger — plan: $PLAN_FILE" > "$SDD_LEDGER"
  echo "constraints" > "$SDD_PLAN_CONSTRAINTS"
  printf '# Plan\n\n### Task 1: foo\n' > "$PLAN_FILE"
  git -C "$SDD_WORKSPACE" init -q
  git -C "$SDD_WORKSPACE" add -A
  git -C "$SDD_WORKSPACE" -c user.name=t -c user.email=t@e commit -qm init

  # shellcheck disable=SC2329
  _sdd_invoke_cli() { _fake_invoke "$1"; }  # unused in dry-run

  set +e
  h1="$(sdd_run_task sh "" 1 2>/dev/null)"
  rc=$?
  set -e

  assert_rc "F4c review dry-run exit 0" 0 "$rc"
  assert_eq "F4c H1 status DONE" "status: DONE" "$(printf '%s\n' "$h1" | grep '^status:')"
}

###############################################################################
# F5. sdd_run_plan
###############################################################################
# F5a. no pending tasks → rc 0, stderr no-pending message
{
  export SDD_DRY_RUN=1
  plan="$TESTROOT/ws5a/plan.md"
  ws="$TESTROOT/ws5a/.superpowers/sdd/plan"
  mkdir -p "$ws"
  cat > "$plan" <<EOF
# Plan

### Task 1: one
EOF
  printf '# SDD ledger — plan: %s\n' "$plan" > "$ws/progress.md"
  printf 'Task 1: complete\n' >> "$ws/progress.md"
  git -C "$TESTROOT/ws5a" init -q
  git -C "$TESTROOT/ws5a" -c user.name=t -c user.email=t@e commit --allow-empty -qm init

  # fake task script (should not run for no-pending)
  task_script="$TESTROOT/ws5a/task.sh"
  cat > "$task_script" <<'EOF'
#!/usr/bin/env bash
h="${SDD_HANDOFF_PATH:-}"
if [[ -n "$h" ]]; then
  printf '%s' '{"status":"APPROVED","commits":{"base":"base1","head":"head1"}}' > "$h"
fi
exit 0
EOF
  chmod +x "$task_script"

  set +e
  err="$(cd "$TESTROOT/ws5a" && sdd_run_plan "$plan" "$task_script" sh "test" 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "F5a no-pending rc 0" 0 "$rc"
  assert_eq "F5a no-pending message" "sdd-run-plan-test: no pending tasks" "$err"
}

# F5b. one pending task with real chain → completes; ledger appended
{
  export SDD_DRY_RUN=1
  plan="$TESTROOT/ws5b/plan.md"
  ws="$TESTROOT/ws5b/.superpowers/sdd/plan"
  mkdir -p "$ws"
  cat > "$plan" <<EOF
# Plan

### Task 1: one
EOF
  printf '# SDD ledger — plan: %s\n' "$plan" > "$ws/progress.md"
  printf '# task 1\n' > "$ws/task-1-brief.md"
  git -C "$TESTROOT/ws5b" init -q
  git -C "$TESTROOT/ws5b" -c user.name=t -c user.email=t@e commit --allow-empty -qm init

  task_script="$TESTROOT/ws5b/task.sh"
  cat > "$task_script" <<'EOF'
#!/usr/bin/env bash
h="${SDD_HANDOFF_PATH:-}"
if [[ -n "$h" ]]; then
  printf '%s' '{"status":"APPROVED","commits":{"base":"base1","head":"head1"}}' > "$h"
fi
exit 0
EOF
  chmod +x "$task_script"

  set +e
  err="$(cd "$TESTROOT/ws5b" && sdd_run_plan "$plan" "$task_script" sh "test" 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "F5b chain rc 0" 0 "$rc"
  assert_eq "F5b ledger appended" "Task 1: complete (commits base1..head1, review clean)" "$(tail -1 "$ws/progress.md")"
}

###############################################################################
printf '\n%d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]] || exit 1
