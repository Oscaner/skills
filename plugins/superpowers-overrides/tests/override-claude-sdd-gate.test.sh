#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/bin/override-claude-sdd-gate.sh"
ACTIVATE="$ROOT/bin/sdd-session-activate.sh"
PENDING_SDD="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending-sdd"
REPO="$(git -C "$ROOT/../.." rev-parse --show-toplevel)"
WS="$REPO/.superpowers/sdd/dogfood-test"
mkdir -p "$WS" "$PENDING_SDD"
rm -f "$PENDING_SDD"/*.json

"$ACTIVATE" minimal conv-c1 "$REPO"
deny=$(printf '%s' "{\"session_id\":\"conv-c1\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$REPO/plugins/foo.txt\",\"content\":\"x\"}}" | "$GATE")
echo "$deny" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null
echo "$deny" | jq -e '.hookSpecificOutput.hookEventName == "PreToolUse"' >/dev/null
echo "$deny" | jq -e '.hookSpecificOutput.permissionDecisionReason | contains("sdd-run-task-claude")' >/dev/null

echo 'TASK_BASE: abc' > "$WS/task-1-brief.md"
deny_active=$(printf '%s' "{\"session_id\":\"conv-c1\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$REPO/plugins/foo.txt\",\"content\":\"x\"}}" | "$GATE")
echo "$deny_active" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null

deny_bash=$(printf '%s' "{\"session_id\":\"conv-c1\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"rm -rf $REPO/plugins\"}}" | "$GATE")
echo "$deny_bash" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null

allow_h6=$(printf '%s' "{\"session_id\":\"conv-c1\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$ROOT/bin/sdd-run-task-claude.sh --task 1 --mode implement\"}}" | "$GATE")
echo "$allow_h6" | jq -e '.hookSpecificOutput.permissionDecision == "allow"' >/dev/null

echo "OK — override-claude-sdd-gate"
