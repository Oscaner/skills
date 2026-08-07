#!/usr/bin/env bash
set -euo pipefail
# sdd-gate-allow-deny-smoke.sh — full allow/deny decision matrix smoke test.
#
# Covers spec §设计 判定矩阵 for the shared sdd-orchestrator-gate.sh state machine,
# driven through the Claude PreToolUse adapter (override-claude-sdd-gate.sh):
#   - read-only git diagnostics allow (AC1 boundary cases + `-c` v1 deny)
#   - mutating git verbs / non-git commands deny
#   - stub-ws (TASK_BASE: abc) does NOT activate; real-SHA active-ws does
#   - bound-ws wins over workspace scanning (unrelated ws not activated)
#   - deny message is the multi-line allowlist matrix (lists git show etc.)
#   - task_complete phase re-allows shell + Write (realtime phase, no caching)
#
# Fixture isolation (spec §设计 fixture): each scenario is copied to a temp dir,
# git-init'ed, and briefs carrying `TASK_BASE: <SHA>` get the copy's real short SHA
# injected — tracked fixture files are never modified (P4 anti-pattern).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/bin/override-claude-sdd-gate.sh"
ACT="$ROOT/bin/sdd-session-activate.sh"
FIXTURES="$ROOT/tests/fixtures/sdd-gate"
REPO="$(git -C "$ROOT/../.." rev-parse --show-toplevel)"

PENDING="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending-sdd"
mkdir -p "$PENDING"
find "$PENDING" -name '*.json' -delete

TMPROOT="$(mktemp -d)"
trap 'rm -rf "$TMPROOT"; find "$PENDING" -name "*.json" -delete' EXIT

fail() { echo "FAIL: $1" >&2; exit 1; }

SESSION=""
ASSERT_COUNT=0

# make_fixture_copy <scenario> <dest-name> — copy a fixture scene root into
# $TMPROOT/<dest-name>, git-init the copy, and inject the copy's real short SHA
# into any `TASK_BASE: <SHA>` brief placeholder (stub briefs keep `abc`).
# Exports SDD_GATE_FIXTURES_ROOT so the gate scans the copy, not the real tree.
make_fixture_copy() {
  local scen="$1" name="$2" sha b
  TMPFIX="$TMPROOT/$name"
  cp -R "$FIXTURES/$scen/." "$TMPFIX/"
  git -C "$TMPFIX" init -q
  git -C "$TMPFIX" add -A
  git -C "$TMPFIX" -c user.name="sdd-gate-smoke" -c user.email="sdd-gate-smoke@example.com" \
    commit --allow-empty -qm "fixture"
  sha="$(git -C "$TMPFIX" rev-parse --short HEAD)"
  while IFS= read -r b; do
    if grep -q 'TASK_BASE: <SHA>' "$b"; then
      printf 'TASK_BASE: %s\n' "$sha" > "$b"
    fi
  done < <(find "$TMPFIX" -name 'task-*-brief.md')
  export SDD_GATE_FIXTURES_ROOT="$TMPFIX/sdd"
}

# gate_json <tool_name> <tool_input_json> — run the adapter, return full JSON.
gate_json() {
  local json
  json="$(jq -nc --arg sid "$SESSION" --arg tn "$1" --argjson ti "$2" \
    '{session_id:$sid, tool_name:$tn, tool_input:$ti}')"
  printf '%s' "$json" | "$GATE"
}

decision() { gate_json "$1" "$2" | jq -r '.hookSpecificOutput.permissionDecision'; }
bash_decision() { decision Bash "$(jq -nc --arg c "$1" '{command:$c}')"; }
write_decision() { decision Write "$(jq -nc --arg p "$1" '{file_path:$p}')"; }
bash_reason() { gate_json Bash "$(jq -nc --arg c "$1" '{command:$c}')" | jq -r '.hookSpecificOutput.permissionDecisionReason'; }

assert_allow_cmd() { [[ "$(bash_decision "$1")" == allow ]] || fail "expected allow: $2"; ASSERT_COUNT=$((ASSERT_COUNT + 1)); }
assert_deny_cmd() { [[ "$(bash_decision "$1")" == deny ]] || fail "expected deny: $2"; ASSERT_COUNT=$((ASSERT_COUNT + 1)); }
assert_allow_write() { [[ "$(write_decision "$1")" == allow ]] || fail "expected allow: $2"; ASSERT_COUNT=$((ASSERT_COUNT + 1)); }
assert_deny_write() { [[ "$(write_decision "$1")" == deny ]] || fail "expected deny: $2"; ASSERT_COUNT=$((ASSERT_COUNT + 1)); }
assert_other_allow() { [[ "$(decision "$1" "$2")" == allow ]] || fail "expected allow: $3"; ASSERT_COUNT=$((ASSERT_COUNT + 1)); }

assert_reason_contains() {  # <needle> <desc> — matrix text against a representative deny
  local r
  r="$(bash_reason "ls")"
  [[ "$r" == *"$1"* ]] || fail "deny message missing '$1': $2"
  ASSERT_COUNT=$((ASSERT_COUNT + 1))
}

echo "== 1. active-ws (minimal → scan → task_active) =="
SESSION="smk-active"
make_fixture_copy active active-ws
"$ACT" minimal "$SESSION" "$TMPFIX"

# read-only git diagnostics allow (AC1 boundary cases)
assert_allow_cmd "git status" "git status"
assert_allow_cmd "git -C $REPO status" "git -C <repo> status"
assert_allow_cmd "git --git-dir=$REPO/.git status" "git --git-dir=<repo> status"
assert_allow_cmd "git diff HEAD~1" "git diff HEAD~1"
assert_allow_cmd "git rev-parse HEAD" "git rev-parse HEAD"
assert_allow_cmd "git branch -a" "git branch -a"
assert_allow_cmd "git remote -v" "git remote -v"
assert_allow_cmd "git ls-files" "git ls-files"
assert_allow_cmd "git diff-tree --stat HEAD" "git diff-tree"

# AC1 v1 out-of-scope: `-c` config option not in extraction range → deny
assert_deny_cmd "git -C $REPO -c k=v status" "git -C <repo> -c k=v status (v1 deny)"

# mutating git verbs deny
assert_deny_cmd "git add foo" "git add"
assert_deny_cmd "git commit -m x" "git commit"
assert_deny_cmd "git push origin main" "git push"
assert_deny_cmd "git branch -d foo" "git branch -d (mutating sub-verb)"
assert_deny_cmd "git remote add origin $REPO" "git remote add (mutating sub-verb)"

# non-git commands still deny (spec Non-goals: ls/echo not in the read-only set)
assert_deny_cmd "ls" "ls"
assert_deny_cmd "echo hi" "echo"

# allowlist Bash
assert_allow_cmd "$ROOT/bin/sdd-run-task-claude.sh --task 1 --mode implement" "H6 sdd-run-task"
assert_allow_cmd "sdd-workspace create x" "sdd-workspace"
assert_allow_cmd "task-brief --task 1" "task-brief"
assert_allow_cmd "review-package --task 1" "review-package"

# Write: workspace allow, other repo paths deny
assert_allow_write "$TMPFIX/sdd/active-ws/progress.md" "write active-ws"
assert_deny_write "$TMPFIX/sdd/ledger.md" "write sdd_root ledger (outside active-ws)"
assert_deny_write "$REPO/plugins/foo.txt" "write repo path (task_active)"

# other tools always allow
assert_other_allow Read '{}' "Read tool"

# adapter JSON shape (hookSpecificOutput.permissionDecision / hookEventName / reason)
out="$(gate_json Bash "$(jq -nc --arg c "ls" '{command:$c}')")"
printf '%s' "$out" | jq -e '.hookSpecificOutput.hookEventName == "PreToolUse"' >/dev/null || fail "hookEventName != PreToolUse"
printf '%s' "$out" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null || fail "shape: expected deny"
printf '%s' "$out" | jq -e '(.hookSpecificOutput.permissionDecisionReason | length) > 0' >/dev/null || fail "empty permissionDecisionReason"
ASSERT_COUNT=$((ASSERT_COUNT + 1))

# deny message is the multi-line matrix: git show listed, H6 command, workspace scope
for needle in "SDD orchestrator gate" "Allowed Bash (read-only diagnostics):" \
              "git status" "git diff" "git log" "git show" "git rev-parse" \
              "sdd-run-task-claude.sh" "Allowed Write:" ".superpowers/sdd/active-ws/" \
              "--task 1 --mode implement"; do
  r="$(bash_reason "ls")"
  [[ "$r" == *"$needle"* ]] || fail "deny message missing: $needle"
done
ASSERT_COUNT=$((ASSERT_COUNT + 1))

echo "== 2. stub-ws (TASK_BASE: abc → not a git object → orchestrating, no hijack) =="
SESSION="smk-stub"
make_fixture_copy stub stub-ws
"$ACT" minimal "$SESSION" "$TMPFIX"

# stub brief keeps `TASK_BASE: abc` (no <SHA> placeholder) — must NOT activate
# (git-object validation fails). Phase stays orchestrating: read-only git +
# sdd_root writes allow, direct repo edits deny.
assert_allow_cmd "git status" "git status (orchestrating)"
assert_allow_write "$TMPFIX/sdd/stub-ws/x.md" "write stub-ws (orchestrating sdd_root)"
assert_allow_write "$TMPFIX/sdd/ledger.md" "write sdd_root ledger (orchestrating)"
assert_deny_write "$REPO/plugins/foo.txt" "write repo path (orchestrating)"
assert_deny_cmd "ls" "ls (orchestrating)"

# plan basename falls back to unknown-plan → proves stub-ws was NOT activated
assert_reason_contains "unknown-plan" "stub-ws hijack check (expected unknown-plan)"

echo "== 3. bound-ws (bind → bound workspace wins, unrelated ws not scanned) =="
SESSION="smk-bound"
make_fixture_copy active bound-ws
mkdir -p "$TMPFIX/sdd/unrelated-ws"
printf 'TASK_BASE: %s\n' "$(git -C "$TMPFIX" rev-parse --short HEAD)" > "$TMPFIX/sdd/unrelated-ws/task-1-brief.md"
"$ACT" bind "$SESSION" "$TMPFIX" "$TMPFIX/plan.md" "$TMPFIX/sdd/active-ws"

assert_allow_write "$TMPFIX/sdd/active-ws/progress.md" "write bound active-ws"
assert_deny_write "$TMPFIX/sdd/unrelated-ws/x.md" "write unrelated-ws (bound wins, not scanned)"
assert_deny_write "$REPO/plugins/foo.txt" "write repo path (task_active)"
assert_deny_cmd "git add foo" "git add (task_active)"
assert_allow_cmd "git status" "git status (task_active)"

# bound deny message resolves plan basename from plan_path (plan.md → plan)
assert_reason_contains ".superpowers/sdd/plan/" "bound deny message should use plan_path basename"

echo "== 4. complete-ws (APPROVED handoff + real SHA → task_complete → shell/Write allow) =="
SESSION="smk-complete"
make_fixture_copy complete complete-ws
"$ACT" bind "$SESSION" "$TMPFIX" "$TMPFIX/plan.md" "$TMPFIX/sdd/complete-ws"

# task_complete: shell and Write re-allowed (realtime phase, no caching)
assert_allow_cmd "ls" "bash ls (task_complete)"
assert_allow_cmd "git add foo" "bash git add (task_complete)"
assert_allow_write "$REPO/plugins/foo.txt" "write repo path (task_complete)"
assert_allow_write "$TMPFIX/sdd/complete-ws/x.md" "write complete-ws (task_complete)"

echo "== 5. orchestrating (empty ws dir → no briefs → orchestrating) =="
SESSION="smk-orch"
make_fixture_copy orchestrating orchestrating-ws
"$ACT" minimal "$SESSION" "$TMPFIX"

assert_allow_cmd "git status" "git status (orchestrating)"
assert_deny_cmd "ls" "ls (orchestrating)"
assert_allow_write "$TMPFIX/sdd/new-ws/x.md" "write sdd_root new-ws (orchestrating)"
assert_deny_write "$REPO/plugins/foo.txt" "write repo path (orchestrating)"

echo "OK — sdd-gate-allow-deny-smoke"
