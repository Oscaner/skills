#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/bin/override-cursor-sdd-gate.sh"
ACTIVATE="$ROOT/bin/sdd-session-activate.sh"
PENDING_SDD="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending-sdd"
REPO="$(git -C "$ROOT/../.." rev-parse --show-toplevel)"
WS="$REPO/.superpowers/sdd/dogfood-test"
mkdir -p "$WS" "$PENDING_SDD"
rm -f "$PENDING_SDD"/*.json

# AC#3 ORCHESTRATING — pending, NO TASK_BASE
"$ACTIVATE" minimal conv-g1 "$REPO"
deny_orch=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$REPO/plugins/foo.txt\",\"contents\":\"x\"}}" | "$GATE")
echo "$deny_orch" | jq -e '.permission == "deny"' >/dev/null
allow_git=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Shell\",\"tool_input\":{\"command\":\"git -C $REPO rev-parse HEAD\"}}" | "$GATE")
echo "$allow_git" | jq -e '.permission == "allow"' >/dev/null

# AC#4 TASK_ACTIVE — bind workspace, add TASK_BASE, no APPROVED handoff
"$ACTIVATE" bind conv-g1 "$REPO" "dogfood-plan.md" "$WS"
echo 'TASK_BASE: abc' > "$WS/task-1-brief.md"
deny_active=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$REPO/plugins/foo.txt\",\"contents\":\"x\"}}" | "$GATE")
echo "$deny_active" | jq -e '.permission == "deny"' >/dev/null
allow_ws=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$WS/progress.md\",\"contents\":\"# ledger\"}}" | "$GATE")
echo "$allow_ws" | jq -e '.permission == "allow"' >/dev/null

# AC#5 Bash allowlist during TASK_ACTIVE
allow_h6=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Shell\",\"tool_input\":{\"command\":\"$ROOT/bin/sdd-run-task-cursor.sh --task 1 --mode implement --plan foo.md\"}}" | "$GATE")
echo "$allow_h6" | jq -e '.permission == "allow"' >/dev/null
deny_bash=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Shell\",\"tool_input\":{\"command\":\"rm -rf $REPO/plugins\"}}" | "$GATE")
echo "$deny_bash" | jq -e '.permission == "deny"' >/dev/null

# fail-open — no pending
allow_no_pending=$(printf '%s' '{"conversation_id":"conv-none","tool_name":"Write","tool_input":{"path":"/tmp/x","contents":"y"}}' | "$GATE")
echo "$allow_no_pending" | jq -e '.permission == "allow"' >/dev/null

echo "OK — override-cursor-sdd-gate"
