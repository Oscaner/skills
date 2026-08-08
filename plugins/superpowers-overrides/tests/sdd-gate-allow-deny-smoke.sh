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
# Fixture isolation: shared sdd-gate-test-lib.sh copies each scenario to a temp
# dir, git-inits it, injects the copy's own short-SHA into `<SHA>` briefs, and
# namespaces session keys per-run — a concurrent run or a live SDD session's
# pending file is never touched (see finding: global find -delete clobbers).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/bin/override-claude-sdd-gate.sh"
ACT="$ROOT/bin/sdd-session-activate.sh"
REPO="$(git -C "$ROOT/../.." rev-parse --show-toplevel)"

# shellcheck source=tests/sdd-gate-test-lib.sh
source "$ROOT/tests/sdd-gate-test-lib.sh"

fail() { echo "FAIL: $1" >&2; exit 1; }

ASSERT_COUNT=0

# gate_json <tool_name> <tool_input_json> — run the adapter, return full JSON.
gate_json() {
  local json
  json="$(jq -nc --arg sid "$1" --arg tn "$2" --argjson ti "$3" \
    '{session_id:$sid, tool_name:$tn, tool_input:$ti}')"
  printf '%s' "$json" | "$GATE"
}

decision() { gate_json "$1" "$2" "$3" | jq -r '.hookSpecificOutput.permissionDecision'; }
bash_decision() { decision "$1" Bash "$(jq -nc --arg c "$2" '{command:$c}')"; }
write_decision() { decision "$1" Write "$(jq -nc --arg p "$2" '{file_path:$p}')"; }
bash_reason() { gate_json "$1" Bash "$(jq -nc --arg c "$2" '{command:$c}')" | jq -r '.hookSpecificOutput.permissionDecisionReason'; }

assert_allow_cmd() { [[ "$(bash_decision "$1" "$2")" == allow ]] || fail "expected allow: $3"; ASSERT_COUNT=$((ASSERT_COUNT + 1)); }
assert_deny_cmd() { [[ "$(bash_decision "$1" "$2")" == deny ]] || fail "expected deny: $3"; ASSERT_COUNT=$((ASSERT_COUNT + 1)); }
assert_allow_write() { [[ "$(write_decision "$1" "$2")" == allow ]] || fail "expected allow: $3"; ASSERT_COUNT=$((ASSERT_COUNT + 1)); }
assert_deny_write() { [[ "$(write_decision "$1" "$2")" == deny ]] || fail "expected deny: $3"; ASSERT_COUNT=$((ASSERT_COUNT + 1)); }
assert_other_allow() { [[ "$(decision "$1" "$2" "$3")" == allow ]] || fail "expected allow: $4"; ASSERT_COUNT=$((ASSERT_COUNT + 1)); }

assert_reason_contains() {  # <session> <needle> <desc> — matrix text against a representative deny
  local r
  r="$(bash_reason "$1" "ls")"
  [[ "$r" == *"$2"* ]] || fail "deny message missing '$2': $3"
  ASSERT_COUNT=$((ASSERT_COUNT + 1))
}

echo "== 1. active-ws (minimal → scan → task_active) =="
S1="$(session_key active)"
setup_scenario active active-ws "$S1"

# read-only git diagnostics allow (AC1 boundary cases)
assert_allow_cmd "$S1" "git status" "git status"
assert_allow_cmd "$S1" "git -C $REPO status" "git -C <repo> status"
assert_allow_cmd "$S1" "git --git-dir=$REPO/.git status" "git --git-dir=<repo> status"
assert_allow_cmd "$S1" "git diff HEAD~1" "git diff HEAD~1"
assert_allow_cmd "$S1" "git rev-parse HEAD" "git rev-parse HEAD"
assert_allow_cmd "$S1" "git branch -a" "git branch -a"
assert_allow_cmd "$S1" "git remote -v" "git remote -v"
assert_allow_cmd "$S1" "git ls-files" "git ls-files"
assert_allow_cmd "$S1" "git diff-tree --stat HEAD" "git diff-tree"

# AC1 v1 out-of-scope: `-c` config option not in extraction range → deny
assert_deny_cmd "$S1" "git -C $REPO -c k=v status" "git -C <repo> -c k=v status (v1 deny)"

# mutating git verbs deny
assert_deny_cmd "$S1" "git add foo" "git add"
assert_deny_cmd "$S1" "git commit -m x" "git commit"
assert_deny_cmd "$S1" "git push origin main" "git push"
assert_deny_cmd "$S1" "git branch -d foo" "git branch -d (mutating sub-verb)"
assert_deny_cmd "$S1" "git remote add origin $REPO" "git remote add (mutating sub-verb)"

# non-git commands still deny (spec Non-goals: ls/echo not in the read-only set)
assert_deny_cmd "$S1" "ls" "ls"
assert_deny_cmd "$S1" "echo hi" "echo"

# allowlist Bash
assert_allow_cmd "$S1" "$ROOT/bin/sdd-run-task-claude.sh --task 1 --mode implement" "H6 sdd-run-task"
assert_allow_cmd "$S1" "sdd-workspace create x" "sdd-workspace"
assert_allow_cmd "$S1" "task-brief --task 1" "task-brief"
assert_allow_cmd "$S1" "review-package --task 1" "review-package"

# Write: workspace allow, other repo paths deny
assert_allow_write "$S1" "$TMPROOT/active-ws/sdd/active-ws/progress.md" "write active-ws"
assert_deny_write "$S1" "$TMPROOT/active-ws/sdd/ledger.md" "write sdd_root ledger (outside active-ws)"
assert_deny_write "$S1" "$REPO/plugins/foo.txt" "write repo path (task_active)"

# other tools always allow
assert_other_allow "$S1" Read '{}' "Read tool"

# adapter JSON shape (hookSpecificOutput.permissionDecision / hookEventName / reason)
out="$(gate_json "$S1" Bash "$(jq -nc --arg c "ls" '{command:$c}')")"
printf '%s' "$out" | jq -e '.hookSpecificOutput.hookEventName == "PreToolUse"' >/dev/null || fail "hookEventName != PreToolUse"
printf '%s' "$out" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null || fail "shape: expected deny"
printf '%s' "$out" | jq -e '(.hookSpecificOutput.permissionDecisionReason | length) > 0' >/dev/null || fail "empty permissionDecisionReason"
ASSERT_COUNT=$((ASSERT_COUNT + 1))

# deny message is the multi-line matrix: every line of sdd_deny_message, so
# drift in any matrix row goes uncaught nowhere (spec AC5, 含 git show).
for needle in "SDD orchestrator gate" "Allowed Bash (read-only diagnostics):" \
              "git status" "git diff" "git log" "git show" "git rev-parse" \
              "git branch" "git remote" "git ls-files" "git diff-tree" \
              "sdd-run-task-claude.sh" "sdd-workspace / task-brief / review-package" \
              "Allowed Write:" ".superpowers/sdd/active-ws/" \
              "--task 1 --mode implement" "Full matrix: docs/sdd-h6-reference.md (SDD gate matrix)" \
              "See spor-SDD Rule 0a item 4."; do
  r="$(bash_reason "$S1" "ls")"
  [[ "$r" == *"$needle"* ]] || fail "deny message missing: $needle"
done
ASSERT_COUNT=$((ASSERT_COUNT + 1))

echo "== 2. stub-ws (TASK_BASE: abc → not a git object → orchestrating, no hijack) =="
S2="$(session_key stub)"
setup_scenario stub stub-ws "$S2"

# stub brief keeps `TASK_BASE: abc` (no <SHA> placeholder) — must NOT activate
# (git-object validation fails). Phase stays orchestrating: read-only git +
# sdd_root writes allow, direct repo edits deny.
assert_allow_cmd "$S2" "git status" "git status (orchestrating)"
assert_allow_write "$S2" "$TMPROOT/stub-ws/sdd/stub-ws/x.md" "write stub-ws (orchestrating sdd_root)"
assert_allow_write "$S2" "$TMPROOT/stub-ws/sdd/ledger.md" "write sdd_root ledger (orchestrating)"
assert_deny_write "$S2" "$REPO/plugins/foo.txt" "write repo path (orchestrating)"
assert_deny_cmd "$S2" "ls" "ls (orchestrating)"

# plan basename falls back to unknown-plan → proves stub-ws was NOT activated
assert_reason_contains "$S2" "unknown-plan" "stub-ws hijack check (expected unknown-plan)"

echo "== 3. bound-ws (bind → bound workspace wins, unrelated ws not scanned) =="
S3="$(session_key bound)"
setup_scenario active bound-ws
BOUND_FIX="$SCEN_DEST"
# unrelated brief is lexically-first active candidate (000-) — under a scan
# regression sdd_find_active_workspace would select it and the bound-ws
# assertions below would fail, so bound precedence is a real discriminator.
mkdir -p "$TMPROOT/bound-ws/sdd/000-unrelated-ws"
printf 'TASK_BASE: %s\n' "$(git -C "$TMPROOT/bound-ws" rev-parse --short HEAD)" > "$TMPROOT/bound-ws/sdd/000-unrelated-ws/task-1-brief.md"
"$ACT" bind "$S3" "$BOUND_FIX" "$BOUND_FIX/plan.md" "$BOUND_FIX/sdd/active-ws"
SESSION_KEYS+=("$S3")

assert_allow_write "$S3" "$TMPROOT/bound-ws/sdd/active-ws/progress.md" "write bound active-ws"
assert_deny_write "$S3" "$TMPROOT/bound-ws/sdd/000-unrelated-ws/x.md" "write unrelated-ws (bound wins, not scanned)"
assert_deny_write "$S3" "$REPO/plugins/foo.txt" "write repo path (task_active)"
assert_deny_cmd "$S3" "git add foo" "git add (task_active)"
assert_allow_cmd "$S3" "git status" "git status (task_active)"

# bound deny message resolves plan basename from plan_path (plan.md → plan)
assert_reason_contains "$S3" ".superpowers/sdd/plan/" "bound deny message should use plan_path basename"

echo "== 4. complete-ws (APPROVED handoff + real SHA → task_complete → shell/Write allow) =="
S4="$(session_key complete)"
setup_scenario complete complete-ws
COMPLETE_FIX="$SCEN_DEST"
"$ACT" bind "$S4" "$COMPLETE_FIX" "$COMPLETE_FIX/plan.md" "$COMPLETE_FIX/sdd/complete-ws"
SESSION_KEYS+=("$S4")

# task_complete: shell and Write re-allowed (realtime phase, no caching)
assert_allow_cmd "$S4" "ls" "bash ls (task_complete)"
assert_allow_cmd "$S4" "git add foo" "bash git add (task_complete)"
assert_allow_write "$S4" "$REPO/plugins/foo.txt" "write repo path (task_complete)"
assert_allow_write "$S4" "$TMPROOT/complete-ws/sdd/complete-ws/x.md" "write complete-ws (task_complete)"

echo "== 5. orchestrating (empty ws dir → no briefs → orchestrating) =="
S5="$(session_key orch)"
setup_scenario orchestrating orchestrating-ws "$S5"

assert_allow_cmd "$S5" "git status" "git status (orchestrating)"
assert_deny_cmd "$S5" "ls" "ls (orchestrating)"
assert_allow_write "$S5" "$TMPROOT/orchestrating-ws/sdd/new-ws/x.md" "write sdd_root new-ws (orchestrating)"
assert_deny_write "$S5" "$REPO/plugins/foo.txt" "write repo path (orchestrating)"

echo "OK — sdd-gate-allow-deny-smoke ($ASSERT_COUNT assertions)"
