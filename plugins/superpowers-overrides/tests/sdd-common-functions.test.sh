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

# F4d. no-jq + handoff exists → H1 fallback emits commits from the raw file
{
  export SDD_HANDOFF_PATH="$TESTROOT/ws4d/handoff.json"
  mkdir -p "$TESTROOT/ws4d"
  printf '%s' '{"status":"DONE","commits":{"base":"bbbbbb1","head":"bbbbbb2"}}' > "$SDD_HANDOFF_PATH"

  # mask jq: minimal PATH with only sed+head (raw extractor deps)
  njqbin="$TESTROOT/ws4d/njqbin"
  mkdir -p "$njqbin"
  for b in sed head; do
    ln -sf "$(command -v "$b")" "$njqbin/$b"
  done

  set +e
  h1="$(PATH="$njqbin" _sdd_emit_h1_from_handoff 2>/dev/null)"
  rc=$?
  set -e
  assert_rc "F4d no-jq H1 rc 0" 0 "$rc"
  assert_eq "F4d H1 status BLOCKED" "status: BLOCKED" "$(printf '%s\n' "$h1" | grep '^status:')"
  assert_eq "F4d H1 commits from raw" "commits: base=bbbbbb1 head=bbbbbb2" "$(printf '%s\n' "$h1" | grep '^commits:')"
  assert_eq "F4d H1 blocker" "blocker: handoff unparseable without jq after commit-contract interception" "$(printf '%s\n' "$h1" | grep '^blocker:')"
}

# F4e. malformed handoff JSON + dirty tree → validator rewrite fails → H1
# treats it as authoritative BLOCKED (never reads the un-rewritten .status)
{
  export SDD_DRY_RUN=1
  export SDD_WORKSPACE="$TESTROOT/ws4e/dirty"
  export SDD_LEDGER="$SDD_WORKSPACE/progress.md"
  export SDD_TASK_BRIEF="$SDD_WORKSPACE/task-1-brief.md"
  export SDD_HANDOFF_PATH="$SDD_WORKSPACE/task-1-handoff.json"
  export SDD_PLAN_CONSTRAINTS="$SDD_WORKSPACE/plan-constraints.md"
  export SDD_MODE=implement
  export SDD_MODE_ARG=implement
  export PLAN_FILE="$TESTROOT/ws4e/plan.md"
  mkdir -p "$SDD_WORKSPACE"
  echo "# task 1" > "$SDD_TASK_BRIEF"
  echo "# SDD ledger — plan: $PLAN_FILE" > "$SDD_LEDGER"
  echo "constraints" > "$SDD_PLAN_CONSTRAINTS"
  echo "# Plan" > "$PLAN_FILE"

  # malformed JSON — the validator's jq rewrite must fail on this
  printf '%s' '{not valid json' > "$SDD_HANDOFF_PATH"

  git -C "$SDD_WORKSPACE" init -q
  git -C "$SDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  echo 'dirty' > "$SDD_WORKSPACE/dirty.txt"

  # shellcheck disable=SC2329
  _sdd_invoke_cli() { :; }  # unused in dry-run

  set +e
  h1="$(sdd_run_task sh "" 1 2>/dev/null)"
  rc=$?
  set -e

  assert_rc "F4e malformed handoff → non-zero exit" 1 "$rc"
  assert_eq "F4e H1 status BLOCKED" "status: BLOCKED" "$(printf '%s\n' "$h1" | grep '^status:')"
  assert_eq "F4e H1 blocker unparseable" "blocker: handoff JSON unparseable (jq rewrite failed) after commit-contract interception" "$(printf '%s\n' "$h1" | grep '^blocker:')"
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

# F5c. _sdd_resolve_workspace: an explicit plan-file arg always wins over a
# pre-set SDD_WORKSPACE — the plan driver must not be redirected by env that
# leaked into its process. (Runs inside the fixture git repo so upstream
# sdd-workspace resolves the fixture root, mirroring F5a/F5b.)
{
  export SDD_WORKSPACE="$TESTROOT/ws5c/bogus-workspace"
  plan="$TESTROOT/ws5c/plan.md"
  mkdir -p "$TESTROOT/ws5c"
  printf '# Plan\n\n### Task 1: one\n' > "$plan"
  git -C "$TESTROOT/ws5c" init -q
  git -C "$TESTROOT/ws5c" -c user.name=t -c user.email=t@e commit --allow-empty -qm init

  resolved=""
  rc=0
  resolved="$(cd "$TESTROOT/ws5c" && _sdd_resolve_workspace "$plan")" || rc=$?
  # git resolves to physical paths; canonicalize the expectation to match
  # (macOS /var/folders → /private/var/folders).
  exp="$(cd "$TESTROOT/ws5c" && pwd -P)/.superpowers/sdd/plan"
  assert_rc "F5c plan arg wins over SDD_WORKSPACE" 0 "$rc"
  assert_eq "F5c workspace is plan-derived" "$exp" "$resolved"
  unset SDD_WORKSPACE
}

###############################################################################
# G. plan shells are thin wrappers around sdd_run_plan (plan Task 3)
###############################################################################
# G1. claude plan shell delegates: run the real shell under a mirrored bin dir
# whose lib/sdd-common.sh is a stub that records sdd_run_plan's args. The shell
# must pass plan file, sibling task_script path, cli_bin=claude, label=claude.
# (Old fat shells fail here: they never call sdd_run_plan.)
{
  mirror="$TESTROOT/wsg1/bin"
  mkdir -p "$mirror/lib"
  cp "$ROOT/bin/sdd-run-plan-claude.sh" "$mirror/sdd-run-plan-claude.sh"
  cat > "$mirror/lib/sdd-common.sh" <<'EOF'
#!/usr/bin/env bash
sdd_exit_blocked() {
  printf 'SDD_BLOCKED: %s\n' "$*" >&2
  exit 1
}
sdd_run_plan() {
  {
    printf 'plan=%s\n' "$1"
    printf 'task_script=%s\n' "$2"
    printf 'cli_bin=%s\n' "$3"
    printf 'label=%s\n' "$4"
  } >> "${SDD_PLAN_ARGS_LOG:?}"
}
EOF
  plan="$TESTROOT/wsg1/plan.md"
  printf '# Plan\n\n### Task 1: one\n' > "$plan"
  log="$TESTROOT/wsg1/args.log"

  set +e
  SDD_PLAN_ARGS_LOG="$log" "$mirror/sdd-run-plan-claude.sh" --plan "$plan" 2>"$TESTROOT/wsg1/err.log"
  rc=$?
  set -e
  assert_rc "G1 claude shell rc 0" 0 "$rc"
  assert_eq "G1 plan arg" "plan=$plan" "$(sed -n '1p' "$log")"
  assert_eq "G1 task_script arg" "task_script=$mirror/sdd-run-task-claude.sh" "$(sed -n '2p' "$log")"
  assert_eq "G1 cli_bin arg" "cli_bin=claude" "$(sed -n '3p' "$log")"
  assert_eq "G1 label arg" "label=claude" "$(sed -n '4p' "$log")"
}

# G2. cursor plan shell delegates: same mirror, cli_bin=cursor-agent,
# label=cursor, sibling task script is sdd-run-task-cursor.sh.
{
  mirror="$TESTROOT/wsg2/bin"
  mkdir -p "$mirror/lib"
  cp "$ROOT/bin/sdd-run-plan-cursor.sh" "$mirror/sdd-run-plan-cursor.sh"
  cat > "$mirror/lib/sdd-common.sh" <<'EOF'
#!/usr/bin/env bash
sdd_exit_blocked() {
  printf 'SDD_BLOCKED: %s\n' "$*" >&2
  exit 1
}
sdd_run_plan() {
  {
    printf 'plan=%s\n' "$1"
    printf 'task_script=%s\n' "$2"
    printf 'cli_bin=%s\n' "$3"
    printf 'label=%s\n' "$4"
  } >> "${SDD_PLAN_ARGS_LOG:?}"
}
EOF
  plan="$TESTROOT/wsg2/plan.md"
  printf '# Plan\n\n### Task 1: one\n' > "$plan"
  log="$TESTROOT/wsg2/args.log"

  set +e
  SDD_PLAN_ARGS_LOG="$log" "$mirror/sdd-run-plan-cursor.sh" --plan "$plan" 2>"$TESTROOT/wsg2/err.log"
  rc=$?
  set -e
  assert_rc "G2 cursor shell rc 0" 0 "$rc"
  assert_eq "G2 plan arg" "plan=$plan" "$(sed -n '1p' "$log")"
  assert_eq "G2 task_script arg" "task_script=$mirror/sdd-run-task-cursor.sh" "$(sed -n '2p' "$log")"
  assert_eq "G2 cli_bin arg" "cli_bin=cursor-agent" "$(sed -n '3p' "$log")"
  assert_eq "G2 label arg" "label=cursor" "$(sed -n '4p' "$log")"
}

# G3. claude plan shell — no pending tasks through the real sdd_run_plan: label
# "claude" in the stderr no-pending message, exit 0.
{
  export SDD_DRY_RUN=1
  plan="$TESTROOT/wsg3/plan.md"
  ws="$TESTROOT/wsg3/.superpowers/sdd/plan"
  mkdir -p "$ws"
  cat > "$plan" <<EOF
# Plan

### Task 1: one
EOF
  printf '# SDD ledger — plan: %s\n' "$plan" > "$ws/progress.md"
  printf 'Task 1: complete\n' >> "$ws/progress.md"
  git -C "$TESTROOT/wsg3" init -q
  git -C "$TESTROOT/wsg3" -c user.name=t -c user.email=t@e commit --allow-empty -qm init

  set +e
  err="$(cd "$TESTROOT/wsg3" && "$ROOT/bin/sdd-run-plan-claude.sh" --plan "$plan" 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "G3 claude no-pending rc 0" 0 "$rc"
  assert_eq "G3 claude no-pending message" "sdd-run-plan-claude: no pending tasks" "$err"
}

# G4. cursor plan shell — no pending tasks through the real sdd_run_plan: label
# "cursor" in the stderr no-pending message, exit 0.
{
  export SDD_DRY_RUN=1
  plan="$TESTROOT/wsg4/plan.md"
  ws="$TESTROOT/wsg4/.superpowers/sdd/plan"
  mkdir -p "$ws"
  cat > "$plan" <<EOF
# Plan

### Task 1: one
EOF
  printf '# SDD ledger — plan: %s\n' "$plan" > "$ws/progress.md"
  printf 'Task 1: complete\n' >> "$ws/progress.md"
  git -C "$TESTROOT/wsg4" init -q
  git -C "$TESTROOT/wsg4" -c user.name=t -c user.email=t@e commit --allow-empty -qm init

  set +e
  err="$(cd "$TESTROOT/wsg4" && "$ROOT/bin/sdd-run-plan-cursor.sh" --plan "$plan" 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "G4 cursor no-pending rc 0" 0 "$rc"
  assert_eq "G4 cursor no-pending message" "sdd-run-plan-cursor: no pending tasks" "$err"
}

# G5. plan shell contract — missing --plan → usage (exit 2)
{
  set +e
  "$ROOT/bin/sdd-run-plan-claude.sh" >/dev/null 2>&1
  rc=$?
  set -e
  assert_rc "G5 missing --plan → usage rc 2" 2 "$rc"
}

# G6. plan shell contract — nonexistent plan file → SDD_BLOCKED (exit 1)
{
  set +e
  err="$(SDD_DRY_RUN=1 "$ROOT/bin/sdd-run-plan-claude.sh" --plan "$TESTROOT/wsg6/nope.md" 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "G6 missing plan file rc 1" 1 "$rc"
  assert_eq "G6 SDD_BLOCKED message" "SDD_BLOCKED: plan file not found: $TESTROOT/wsg6/nope.md" "$err"
}

###############################################################################
printf '\n%d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]] || exit 1
