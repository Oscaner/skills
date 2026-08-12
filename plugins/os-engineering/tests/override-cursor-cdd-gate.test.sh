#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/bin/override-cursor-cdd-gate.sh"
ACT="$ROOT/bin/cdd-session-activate.sh"
REPO="$(git -C "$ROOT/../.." rev-parse --show-toplevel)"
OS_ENG="$ROOT"

# 隔离 fixture + per-run session 命名：共享 cdd-gate-test-lib.sh（见该文件头注释）。
# shellcheck source=tests/cdd-gate-test-lib.sh
source "$ROOT/tests/cdd-gate-test-lib.sh"

# AC#3 minimal pending — active-ws 已含真实 SHA brief（无 APPROVED handoff）→ 扫描命中 task_active。
# 仓库路径 Write deny + 只读 git allow 在 orchestrating/task_active 下判定一致；
# 下方 deny_scan（cdd_root 下、workspace 外）是正向判别：仅扫描命中 task_active 时 deny，
# 若扫描失败 → orchestrating → allow，断言失败。
KEY="$(session_key conv-g)"
setup_scenario active active-ws "$KEY"
FIX="$SCEN_DEST"
WS="$FIX/sdd/active-ws"

deny_orch=$(printf '%s' "{\"conversation_id\":\"$KEY\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$REPO/plugins/foo.txt\",\"contents\":\"x\"}}" | "$GATE")
echo "$deny_orch" | jq -e '.permission == "deny"' >/dev/null
allow_git=$(printf '%s' "{\"conversation_id\":\"$KEY\",\"tool_name\":\"Shell\",\"tool_input\":{\"command\":\"git -C $REPO rev-parse HEAD\"}}" | "$GATE")
echo "$allow_git" | jq -e '.permission == "allow"' >/dev/null
deny_scan=$(printf '%s' "{\"conversation_id\":\"$KEY\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$FIX/sdd/ledger.md\",\"contents\":\"x\"}}" | "$GATE")
echo "$deny_scan" | jq -e '.permission == "deny"' >/dev/null

# AC#4 TASK_ACTIVE — bind workspace（active fixture 已含真实 SHA brief，无 APPROVED handoff）
"$ACT" bind "$KEY" "$FIX" "dogfood-plan.md" "$WS"
deny_active=$(printf '%s' "{\"conversation_id\":\"$KEY\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$REPO/plugins/foo.txt\",\"contents\":\"x\"}}" | "$GATE")
echo "$deny_active" | jq -e '.permission == "deny"' >/dev/null
allow_ws=$(printf '%s' "{\"conversation_id\":\"$KEY\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$WS/progress.md\",\"contents\":\"# ledger\"}}" | "$GATE")
echo "$allow_ws" | jq -e '.permission == "allow"' >/dev/null

# AC#5 Bash allowlist during TASK_ACTIVE
allow_h6=$(printf '%s' "{\"conversation_id\":\"$KEY\",\"tool_name\":\"Shell\",\"tool_input\":{\"command\":\"$OS_ENG/bin/cdd-run.sh --harness cursor-agent --task 1 --mode implement --plan foo.md\"}}" | "$GATE")
echo "$allow_h6" | jq -e '.permission == "allow"' >/dev/null
deny_bash=$(printf '%s' "{\"conversation_id\":\"$KEY\",\"tool_name\":\"Shell\",\"tool_input\":{\"command\":\"rm -rf $REPO/plugins\"}}" | "$GATE")
echo "$deny_bash" | jq -e '.permission == "deny"' >/dev/null

# fail-open — no pending
allow_no_pending=$(printf '%s' '{"conversation_id":"conv-none","tool_name":"Write","tool_input":{"path":"/tmp/x","contents":"y"}}' | "$GATE")
echo "$allow_no_pending" | jq -e '.permission == "allow"' >/dev/null

echo "OK — override-cursor-cdd-gate"
