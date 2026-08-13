#!/usr/bin/env bash
# cdd-common-functions.test.sh — T0 shared-library foundation tests.
# Exercises the five shared functions added to lib/cdd-common.sh:
#   cdd_render_mode_prompt, cdd_check_cli, cdd_validate_commit_contract,
#   cdd_run_task, cdd_run_plan
# plus their H1-from-handoff contract (spec §4.2 / plan Task 1).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$ROOT/bin/lib/cdd-common.sh"
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
# (unused by the dry-run F4 paths; documents the _cdd_invoke_cli contract)
_fake_invoke() {
  _fake_prompt="$1"
  cat > "${CDD_HANDOFF_PATH}" <<EOF
{"task":1,"status":"DONE","commits":{"base":"${_fake_base}","head":"${_fake_head}"},"phase":"implement","artifacts":{},"findings":[],"unverifiable":[],"plan_conflicts":[]}
EOF
  cat <<EOF
status: DONE
commits: base=${_fake_base} head=${_fake_head}
artifacts: brief=${CDD_TASK_BRIEF} report=${CDD_WORKSPACE}/task-1-report.md test_evidence=${CDD_WORKSPACE}/task-1-test-evidence.json
blocker: none
EOF
}
_fake_base="fbbbbbb1"
_fake_head="fbbbbbb2"

###############################################################################
# F1. cdd_render_mode_prompt (single-arg render) + _cdd_invoke_cli review prefix
###############################################################################
{
  export CDD_WORKSPACE="$TESTROOT/ws-render"
  export CDD_TASK_BRIEF="$TESTROOT/ws-render/task-1-brief.md"
  export CDD_HANDOFF_PATH="$TESTROOT/ws-render/task-1-handoff.json"
  export CDD_PLAN_CONSTRAINTS="$TESTROOT/ws-render/plan-constraints.md"

  # single-arg render: template alone — review-prefix composition is NOT here
  plain="$(cdd_render_mode_prompt implement)" || true
  first_line="$(printf '%s\n' "$plain" | head -1)"
  assert_eq "F1 implement first line" "# CDD implement — CLI session" "$first_line"
}

# F1b. review-prefix composition moved to _cdd_invoke_cli (registry-driven):
# review mode prepends the harness review_prefix; implement does not. A mock
# `claude` on PATH echoes its final arg (the composed prompt).
{
  fakebin="$TESTROOT/ws-render/fakebin"
  mkdir -p "$fakebin"
  cat > "$fakebin/claude" <<'EOF'
#!/bin/sh
for a in "$@"; do last="$a"; done
printf '%s\n' "$last"
EOF
  chmod +x "$fakebin/claude"
  export PATH="$fakebin:$PATH"
  export CDD_HARNESS=claude

  export CDD_MODE=review
  out="$(_cdd_invoke_cli "hello")" || true
  assert_eq "F1 review prefix prepended" "Skill(mattpocock-skills:code-review) hello" "$out"

  export CDD_MODE=implement
  out2="$(_cdd_invoke_cli "hello")" || true
  assert_eq "F1 implement no prefix" "hello" "$out2"
}

###############################################################################
# F2. cdd_check_cli
###############################################################################
{
  # CDD_DRY_RUN=1 → no PATH check, rc 0 even for a bogus cli
  CDD_DRY_RUN=1 cdd_check_cli "definitely-not-a-real-cli-$$" && rc=0 || rc=$?
  assert_rc "F2 dry-run skips PATH check" 0 "$rc"

  # real cli on PATH passes
  CDD_DRY_RUN=0 cdd_check_cli "sh" && rc=0 || rc=$?
  assert_rc "F2 existing cli passes" 0 "$rc"

  # missing cli (non-dry-run) → rc 2 (cdd_exit_cli_missing) — subshell: it exits
  set +e
  ( CDD_DRY_RUN=0 cdd_check_cli "definitely-not-a-real-cli-$$" >/dev/null 2>&1 )
  rc=$?
  set -e
  assert_rc "F2 missing cli exits 2" 2 "$rc"
}

###############################################################################
# F3. cdd_validate_commit_contract — three states
###############################################################################
# F3a. review mode → always no-op (rc 0), even dirty
{
  export CDD_HANDOFF_PATH="$TESTROOT/ws3/handoff.json"
  mkdir -p "$TESTROOT/ws3"
  echo '{"status":"APPROVED"}' > "$CDD_HANDOFF_PATH"
  cdd_validate_commit_contract review && rc=0 || rc=$?
  assert_rc "F3a review mode no-op" 0 "$rc"
}

# F3b. non-git workspace → fail-open (rc 0), dirty tree cannot be detected
{
  export CDD_WORKSPACE="$TESTROOT/ws3/not-a-repo"
  mkdir -p "$CDD_WORKSPACE"
  echo 'dirty' > "$CDD_WORKSPACE/stray.txt"
  cdd_validate_commit_contract implement && rc=0 || rc=$?
  assert_rc "F3b non-git fail-open" 0 "$rc"
}

# F3c. clean tree → rc 0
{
  export CDD_WORKSPACE="$TESTROOT/ws3/clean-repo"
  mkdir -p "$CDD_WORKSPACE"
  git -C "$CDD_WORKSPACE" init -q
  git -C "$CDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  cdd_validate_commit_contract implement && rc=0 || rc=$?
  assert_rc "F3c clean tree passes" 0 "$rc"
}

# F3d. dirty tree + jq → rewrites handoff .status/.blocker, prints CDD_BLOCKED, rc 1
{
  export CDD_WORKSPACE="$TESTROOT/ws3/dirty-repo"
  export CDD_HANDOFF_PATH="$TESTROOT/ws3/dirty-handoff.json"
  mkdir -p "$CDD_WORKSPACE"
  git -C "$CDD_WORKSPACE" init -q
  git -C "$CDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  echo '{"status":"DONE","commits":{"base":"abc1234","head":"def5678"},"artifacts":{}}' > "$CDD_HANDOFF_PATH"
  echo 'untracked' > "$CDD_WORKSPACE/dirty.txt"

  set +e
  err="$(cdd_validate_commit_contract implement 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "F3d dirty tree rc 1" 1 "$rc"
  assert_eq "F3d CDD_BLOCKED message" "CDD_BLOCKED: uncommitted changes at return (implement) — dirty working tree" "$err"
  assert_eq "F3d handoff.status" "BLOCKED" "$(jq -r '.status' "$CDD_HANDOFF_PATH")"
  assert_eq "F3d handoff.blocker" "uncommitted changes at return (implement): dirty working tree" "$(jq -r '.blocker' "$CDD_HANDOFF_PATH")"
  # original fields preserved
  assert_eq "F3d handoff.commits.base preserved" "abc1234" "$(jq -r '.commits.base' "$CDD_HANDOFF_PATH")"
}

# F3e. dirty tree, no jq → prints CDD_BLOCKED, rc 1 (no silent pass)
{
  export CDD_WORKSPACE="$TESTROOT/ws3/dirty-repo-nojq"
  export CDD_HANDOFF_PATH="$TESTROOT/ws3/nojq-handoff.json"
  mkdir -p "$CDD_WORKSPACE"
  git -C "$CDD_WORKSPACE" init -q
  git -C "$CDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  echo '{"status":"DONE","commits":{"base":"abc1234","head":"def5678"}}' > "$CDD_HANDOFF_PATH"
  echo 'untracked' > "$CDD_WORKSPACE/dirty.txt"

  set +e
  # mask jq entirely: minimal PATH with only git/mktemp/mv (jq absent)
  njqbin="$TESTROOT/ws3/njqbin"
  mkdir -p "$njqbin"
  for b in git mktemp mv; do
    ln -sf "$(command -v "$b")" "$njqbin/$b"
  done
  err="$(PATH="$njqbin" cdd_validate_commit_contract fix 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "F3e dirty tree no-jq rc 1" 1 "$rc"
  assert_eq "F3e CDD_BLOCKED message (fix)" "CDD_BLOCKED: uncommitted changes at return (fix) — dirty working tree" "$err"
  # no jq → handoff untouched (grep, not jq)
  assert_eq "F3e handoff untouched (no jq)" "1" "$(grep -c '"status":"DONE"' "$CDD_HANDOFF_PATH")"
}

# F3f. clean tree + wrong handoff head → head-consistency intercept (rc 1,
# handoff BLOCKED, stderr names both SHAs). Orthogonal to the dirty check: the
# tree is clean, so only the head comparison catches the drift.
{
  export CDD_WORKSPACE="$TESTROOT/ws3/head-mismatch"
  export CDD_HANDOFF_PATH="$TESTROOT/ws3/head-mismatch-handoff.json"
  mkdir -p "$CDD_WORKSPACE"
  git -C "$CDD_WORKSPACE" init -q
  git -C "$CDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  real_head="$(git -C "$CDD_WORKSPACE" rev-parse HEAD)"
  wrong_head="0000000000000000000000000000000000000000"
  printf '{"status":"DONE","commits":{"base":"abc1234","head":"%s"},"artifacts":{}}' "$wrong_head" > "$CDD_HANDOFF_PATH"

  set +e
  err="$(cdd_validate_commit_contract implement 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "F3f head mismatch rc 1" 1 "$rc"
  assert_eq "F3f CDD_BLOCKED message" "CDD_BLOCKED: handoff commits.head ${wrong_head} does not match HEAD ${real_head} (implement)" "$err"
  assert_eq "F3f handoff.status" "BLOCKED" "$(jq -r '.status' "$CDD_HANDOFF_PATH")"
  assert_eq "F3f handoff.blocker" "handoff commits.head ${wrong_head} does not match HEAD ${real_head} (implement)" "$(jq -r '.blocker' "$CDD_HANDOFF_PATH")"
  assert_eq "F3f handoff.commits.head preserved" "$wrong_head" "$(jq -r '.commits.head' "$CDD_HANDOFF_PATH")"
}

# F3g. clean tree + handoff missing → fail-open (rc 0): no handoff, nothing to
# compare, existing clean-tree pass must not regress.
{
  export CDD_WORKSPACE="$TESTROOT/ws3/clean-nohandoff"
  mkdir -p "$CDD_WORKSPACE"
  git -C "$CDD_WORKSPACE" init -q
  git -C "$CDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  unset CDD_HANDOFF_PATH
  cdd_validate_commit_contract implement && rc=0 || rc=$?
  assert_rc "F3g clean tree no handoff rc 0" 0 "$rc"
}

###############################################################################
# F4. cdd_run_task
###############################################################################
# F4a. validator intercept (dirty tree) → H1 from rewritten handoff, non-zero exit
{
  export CDD_DRY_RUN=1
  export CDD_WORKSPACE="$TESTROOT/ws4/dirty"
  export CDD_LEDGER="$CDD_WORKSPACE/progress.md"
  export CDD_TASK_BRIEF="$CDD_WORKSPACE/task-1-brief.md"
  export CDD_HANDOFF_PATH="$CDD_WORKSPACE/task-1-handoff.json"
  export CDD_PLAN_CONSTRAINTS="$CDD_WORKSPACE/plan-constraints.md"
  export CDD_MODE=implement
  export CDD_MODE_ARG=implement
  export PLAN_FILE="$TESTROOT/ws4/plan.md"
  mkdir -p "$CDD_WORKSPACE"
  echo "# task 1" > "$CDD_TASK_BRIEF"
  echo "# CDD ledger — plan: $PLAN_FILE" > "$CDD_LEDGER"
  echo "constraints" > "$CDD_PLAN_CONSTRAINTS"
  echo "# Plan" > "$PLAN_FILE"

  # seed handoff so H1-from-handoff has values
  cat > "$CDD_HANDOFF_PATH" <<EOF
{"task":1,"status":"DONE","commits":{"base":"bbbbbb1","head":"bbbbbb2"},"phase":"implement","artifacts":{"brief":"b.md","report":"r.md","test_evidence":"t.json"},"findings":[],"unverifiable":[],"plan_conflicts":[]}
EOF

  git -C "$CDD_WORKSPACE" init -q
  git -C "$CDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  echo 'dirty' > "$CDD_WORKSPACE/dirty.txt"

  # _cdd_invoke_cli defined by the (fake) harness shell — invoked indirectly by cdd_run_task
  # shellcheck disable=SC2329
  _cdd_invoke_cli() { _fake_invoke "$1"; }

  set +e
  h1="$(cdd_run_task claude 1 2>/dev/null)"
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
  export CDD_DRY_RUN=1
  export CDD_WORKSPACE="$TESTROOT/ws4/clean"
  export CDD_LEDGER="$CDD_WORKSPACE/progress.md"
  export CDD_TASK_BRIEF="$CDD_WORKSPACE/task-1-brief.md"
  export CDD_HANDOFF_PATH="$CDD_WORKSPACE/task-1-handoff.json"
  export CDD_PLAN_CONSTRAINTS="$CDD_WORKSPACE/plan-constraints.md"
  export CDD_MODE=implement
  export CDD_MODE_ARG=implement
  export PLAN_FILE="$TESTROOT/ws4/plan-clean.md"
  mkdir -p "$CDD_WORKSPACE"
  echo "# task 1" > "$CDD_TASK_BRIEF"
  echo "# CDD ledger — plan: $PLAN_FILE" > "$CDD_LEDGER"
  echo "constraints" > "$CDD_PLAN_CONSTRAINTS"
  echo "# Plan" > "$PLAN_FILE"
  git -C "$CDD_WORKSPACE" init -q
  git -C "$CDD_WORKSPACE" add -A
  git -C "$CDD_WORKSPACE" -c user.name=t -c user.email=t@e commit -qm init

  # shellcheck disable=SC2329
  _cdd_invoke_cli() { _fake_invoke "$1"; }  # unused in dry-run

  set +e
  h1="$(cdd_run_task claude 1 2>/dev/null)"
  rc=$?
  set -e

  assert_rc "F4b clean dry-run exit 0" 0 "$rc"
  assert_eq "F4b H1 status DONE" "status: DONE" "$(printf '%s\n' "$h1" | grep '^status:')"
  assert_eq "F4b H1 base dry-run" "commits: base=dry-run head=dry-run" "$(printf '%s\n' "$h1" | grep '^commits:')"
}

# F4c. review mode dry-run (empty review_prefix, cursor-style) → H1 from agent_out, exit 0
{
  export CDD_DRY_RUN=1
  export CDD_WORKSPACE="$TESTROOT/ws4/review"
  export CDD_LEDGER="$CDD_WORKSPACE/progress.md"
  export CDD_TASK_BRIEF="$CDD_WORKSPACE/task-1-brief.md"
  export CDD_HANDOFF_PATH="$CDD_WORKSPACE/task-1-handoff.json"
  export CDD_PLAN_CONSTRAINTS="$CDD_WORKSPACE/plan-constraints.md"
  export CDD_MODE=review
  export CDD_MODE_ARG=review
  export CDD_REVIEW_FIXED_POINT=HEAD~1
  export PLAN_FILE="$TESTROOT/ws4/plan-review.md"
  mkdir -p "$CDD_WORKSPACE"
  echo "# task 1" > "$CDD_TASK_BRIEF"
  echo "# CDD ledger — plan: $PLAN_FILE" > "$CDD_LEDGER"
  echo "constraints" > "$CDD_PLAN_CONSTRAINTS"
  printf '# Plan\n\n### Task 1: foo\n' > "$PLAN_FILE"
  git -C "$CDD_WORKSPACE" init -q
  git -C "$CDD_WORKSPACE" add -A
  git -C "$CDD_WORKSPACE" -c user.name=t -c user.email=t@e commit -qm init

  # shellcheck disable=SC2329
  _cdd_invoke_cli() { _fake_invoke "$1"; }  # unused in dry-run

  set +e
  h1="$(cdd_run_task claude 1 2>/dev/null)"
  rc=$?
  set -e

  assert_rc "F4c review dry-run exit 0" 0 "$rc"
  assert_eq "F4c H1 status DONE" "status: DONE" "$(printf '%s\n' "$h1" | grep '^status:')"
}

# F4d. no-jq + handoff exists → H1 fallback emits commits from the raw file
{
  export CDD_HANDOFF_PATH="$TESTROOT/ws4d/handoff.json"
  mkdir -p "$TESTROOT/ws4d"
  printf '%s' '{"status":"DONE","commits":{"base":"bbbbbb1","head":"bbbbbb2"}}' > "$CDD_HANDOFF_PATH"

  # mask jq: minimal PATH with only sed+head (raw extractor deps)
  njqbin="$TESTROOT/ws4d/njqbin"
  mkdir -p "$njqbin"
  for b in sed head; do
    ln -sf "$(command -v "$b")" "$njqbin/$b"
  done

  set +e
  h1="$(PATH="$njqbin" _cdd_emit_h1_from_handoff 2>/dev/null)"
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
  export CDD_DRY_RUN=1
  export CDD_WORKSPACE="$TESTROOT/ws4e/dirty"
  export CDD_LEDGER="$CDD_WORKSPACE/progress.md"
  export CDD_TASK_BRIEF="$CDD_WORKSPACE/task-1-brief.md"
  export CDD_HANDOFF_PATH="$CDD_WORKSPACE/task-1-handoff.json"
  export CDD_PLAN_CONSTRAINTS="$CDD_WORKSPACE/plan-constraints.md"
  export CDD_MODE=implement
  export CDD_MODE_ARG=implement
  export PLAN_FILE="$TESTROOT/ws4e/plan.md"
  mkdir -p "$CDD_WORKSPACE"
  echo "# task 1" > "$CDD_TASK_BRIEF"
  echo "# CDD ledger — plan: $PLAN_FILE" > "$CDD_LEDGER"
  echo "constraints" > "$CDD_PLAN_CONSTRAINTS"
  echo "# Plan" > "$PLAN_FILE"

  # malformed JSON — the validator's jq rewrite must fail on this
  printf '%s' '{not valid json' > "$CDD_HANDOFF_PATH"

  git -C "$CDD_WORKSPACE" init -q
  git -C "$CDD_WORKSPACE" -c user.name=t -c user.email=t@e commit --allow-empty -qm init
  echo 'dirty' > "$CDD_WORKSPACE/dirty.txt"

  # shellcheck disable=SC2329
  _cdd_invoke_cli() { :; }  # unused in dry-run

  set +e
  h1="$(cdd_run_task claude 1 2>/dev/null)"
  rc=$?
  set -e

  assert_rc "F4e malformed handoff → non-zero exit" 1 "$rc"
  assert_eq "F4e H1 status BLOCKED" "status: BLOCKED" "$(printf '%s\n' "$h1" | grep '^status:')"
  # F2: the H1 blocker names the real root cause (uncommitted changes) even
  # though the handoff JSON was unparseable — the generic unparseable message
  # must not mask the interception.
  assert_eq "F4e H1 blocker root cause" "blocker: uncommitted changes at return (implement): dirty working tree" "$(printf '%s\n' "$h1" | grep '^blocker:')"
}

###############################################################################
# F5. cdd_run_plan
###############################################################################
# F5a. no pending tasks → rc 0, stderr no-pending message
{
  export CDD_DRY_RUN=1
  plan="$TESTROOT/ws5a/plan.md"
  ws="$TESTROOT/ws5a/.superpowers/cdd/plan"
  mkdir -p "$ws"
  cat > "$plan" <<EOF
# Plan

### Task 1: one
EOF
  printf '# CDD ledger — plan: %s\n' "$plan" > "$ws/progress.md"
  printf 'Task 1: complete\n' >> "$ws/progress.md"
  git -C "$TESTROOT/ws5a" init -q
  git -C "$TESTROOT/ws5a" -c user.name=t -c user.email=t@e commit --allow-empty -qm init

  set +e
  err="$(cd "$TESTROOT/ws5a" && cdd_run_plan "$plan" claude 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "F5a no-pending rc 0" 0 "$rc"
  assert_eq "F5a no-pending message" "no pending tasks" "$err"
}

# F5b. one pending task with a real chain → completes; ledger appended. The
# library's cdd_run_task is stubbed to write an APPROVED handoff (dry-run never
# invokes a live CLI); the plan loop's implement→review chain then reads that
# handoff and appends the ledger.
{
  export CDD_DRY_RUN=1
  plan="$TESTROOT/ws5b/plan.md"
  ws="$TESTROOT/ws5b/.superpowers/cdd/plan"
  mkdir -p "$ws"
  cat > "$plan" <<EOF
# Plan

### Task 1: one
EOF
  printf '# CDD ledger — plan: %s\n' "$plan" > "$ws/progress.md"
  printf '# task 1\n' > "$ws/task-1-brief.md"
  git -C "$TESTROOT/ws5b" init -q
  git -C "$TESTROOT/ws5b" -c user.name=t -c user.email=t@e commit --allow-empty -qm init

  # shellcheck disable=SC2329
  cdd_run_task() {
    local harness="$1" task="$2"
    local h="${CDD_HANDOFF_PATH:-}"
    if [[ -n "$h" ]]; then
      printf '%s' '{"status":"APPROVED","commits":{"base":"base1","head":"head1"}}' > "$h"
    fi
    return 0
  }

  set +e
  err="$(cd "$TESTROOT/ws5b" && cdd_run_plan "$plan" claude 2>&1 >/dev/null)"
  rc=$?
  set -e
  assert_rc "F5b chain rc 0" 0 "$rc"
  assert_eq "F5b ledger appended" "Task 1: complete (commits base1..head1, review clean)" "$(tail -1 "$ws/progress.md")"
}

# F5c. _cdd_resolve_workspace: an explicit plan-file arg always wins over a
# pre-set CDD_WORKSPACE — the plan driver must not be redirected by env that
# leaked into its process. (Runs inside the fixture git repo so the inline
# resolver derives the fixture root, mirroring F5a/F5b.)
{
  export CDD_WORKSPACE="$TESTROOT/ws5c/bogus-workspace"
  plan="$TESTROOT/ws5c/plan.md"
  mkdir -p "$TESTROOT/ws5c"
  printf '# Plan\n\n### Task 1: one\n' > "$plan"
  git -C "$TESTROOT/ws5c" init -q
  git -C "$TESTROOT/ws5c" -c user.name=t -c user.email=t@e commit --allow-empty -qm init

  resolved=""
  rc=0
  resolved="$(cd "$TESTROOT/ws5c" && _cdd_resolve_workspace "$plan")" || rc=$?
  # git resolves to physical paths; canonicalize the expectation to match
  # (macOS /var/folders → /private/var/folders).
  exp="$(cd "$TESTROOT/ws5c" && pwd -P)/.superpowers/cdd/plan"
  assert_rc "F5c plan arg wins over CDD_WORKSPACE" 0 "$rc"
  assert_eq "F5c workspace is plan-derived" "$exp" "$resolved"
  unset CDD_WORKSPACE
}

###############################################################################
# F6. _append_ledger deferred roll-up (plan Task 5) — three states
###############################################################################
# The function is defined inside cdd_run_plan, so each block first runs a
# no-pending cdd_run_plan (cdd_exit_ok overridden to a no-op so the subshell
# survives) to install the nested function, then calls _append_ledger directly.
# F6a. no-jq → honest degraded wording (must not fake "review clean")
{
  export CDD_DRY_RUN=1
  plan="$TESTROOT/ws6a/plan.md"
  ws="$TESTROOT/ws6a/.superpowers/cdd/plan"
  mkdir -p "$ws"
  printf '# Plan\n\n### Task 1: one\n' > "$plan"
  printf '# CDD ledger — plan: %s\n' "$plan" > "$ws/progress.md"
  printf 'Task 1: complete (seed)\n' >> "$ws/progress.md"
  handoff="$ws/task-1-handoff.json"
  printf '%s' '{"status":"APPROVED","commits":{"base":"base1","head":"head1"},"findings":[{"severity":"nit","summary":"Nit alpha","deferred":true}]}' > "$handoff"
  git -C "$TESTROOT/ws6a" init -q
  git -C "$TESTROOT/ws6a" -c user.name=t -c user.email=t@e commit --allow-empty -qm init


  # mask jq entirely: PATH with only an empty dir
  njqbin="$TESTROOT/ws6a/njqbin"
  mkdir -p "$njqbin"

  line="$(cd "$TESTROOT/ws6a" && source "$LIB"; cdd_exit_ok() { :; }; \
    CDD_DRY_RUN=1 cdd_run_plan "$plan" claude >/dev/null 2>&1 || true; \
    PATH="$njqbin" _append_ledger 1 "$ws/progress.md" "$handoff" >/dev/null 2>&1; \
    tail -1 "$ws/progress.md")"
  assert_eq "F6a no-jq honest degraded wording" "Task 1: complete (commits unknown..unknown, deferred not enumerated — jq missing)" "$line"
}

# F6b. jq + deferred findings → roll-up "K deferred: summary; summary"
{
  export CDD_DRY_RUN=1
  plan="$TESTROOT/ws6b/plan.md"
  ws="$TESTROOT/ws6b/.superpowers/cdd/plan"
  mkdir -p "$ws"
  printf '# Plan\n\n### Task 1: one\n' > "$plan"
  printf '# CDD ledger — plan: %s\n' "$plan" > "$ws/progress.md"
  printf 'Task 1: complete (seed)\n' >> "$ws/progress.md"
  handoff="$ws/task-1-handoff.json"
  printf '%s' '{"status":"APPROVED","commits":{"base":"base1","head":"head1"},"findings":[{"severity":"nit","summary":"Nit alpha","deferred":true},{"severity":"warn","summary":"Warn beta","deferred":true},{"severity":"blocker","summary":"Blocker gamma","deferred":false}]}' > "$handoff"
  git -C "$TESTROOT/ws6b" init -q
  git -C "$TESTROOT/ws6b" -c user.name=t -c user.email=t@e commit --allow-empty -qm init


  line="$(cd "$TESTROOT/ws6b" && source "$LIB"; cdd_exit_ok() { :; }; \
    CDD_DRY_RUN=1 cdd_run_plan "$plan" claude >/dev/null 2>&1 || true; \
    _append_ledger 1 "$ws/progress.md" "$handoff" >/dev/null 2>&1; \
    tail -1 "$ws/progress.md")"
  assert_eq "F6b deferred roll-up" "Task 1: complete (commits base1..head1, 2 deferred: Nit alpha; Warn beta)" "$line"
}

# F6c. jq + no deferred → "review clean" (empty findings array)
{
  export CDD_DRY_RUN=1
  plan="$TESTROOT/ws6c/plan.md"
  ws="$TESTROOT/ws6c/.superpowers/cdd/plan"
  mkdir -p "$ws"
  printf '# Plan\n\n### Task 1: one\n' > "$plan"
  printf '# CDD ledger — plan: %s\n' "$plan" > "$ws/progress.md"
  printf 'Task 1: complete (seed)\n' >> "$ws/progress.md"
  handoff="$ws/task-1-handoff.json"
  printf '%s' '{"status":"APPROVED","commits":{"base":"base1","head":"head1"},"findings":[]}' > "$handoff"
  git -C "$TESTROOT/ws6c" init -q
  git -C "$TESTROOT/ws6c" -c user.name=t -c user.email=t@e commit --allow-empty -qm init


  line="$(cd "$TESTROOT/ws6c" && source "$LIB"; cdd_exit_ok() { :; }; \
    CDD_DRY_RUN=1 cdd_run_plan "$plan" claude >/dev/null 2>&1 || true; \
    _append_ledger 1 "$ws/progress.md" "$handoff" >/dev/null 2>&1; \
    tail -1 "$ws/progress.md")"
  assert_eq "F6c no deferred → review clean" "Task 1: complete (commits base1..head1, review clean)" "$line"
}

###############################################################################
# G. per-harness plan shells were deleted in T10 — the engine now has a single
# runner (bin/cdd-run.sh) whose Mode A / Mode B arg parsing and dry-run
# orchestration are covered by cdd-cli-dry-run-smoke.sh and cdd-exec.test.sh.
# cdd_run_plan's own chain behavior is covered by F5b/F6.
###############################################################################
printf '\n%d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]] || exit 1
