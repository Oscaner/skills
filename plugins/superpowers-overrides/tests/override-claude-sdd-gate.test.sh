#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/bin/override-claude-sdd-gate.sh"
ACT="$ROOT/bin/sdd-session-activate.sh"
REPO="$(git -C "$ROOT/../.." rev-parse --show-toplevel)"

# 隔离 fixture + per-run session 命名：共享 sdd-gate-test-lib.sh（见该文件头注释）。
# shellcheck source=tests/sdd-gate-test-lib.sh
source "$ROOT/tests/sdd-gate-test-lib.sh"

# active fixture 已含真实 SHA brief（无 APPROVED handoff）→ minimal pending 经 fixture root
# 扫描激活 task_active（旧测试用 `TASK_BASE: abc`，T2 后 git-object 校验不激活 → 实际是 orchestrating）
KEY="$(session_key conv-c)"
setup_scenario active active-ws "$KEY"
FIX="$SCEN_DEST"

deny=$(printf '%s' "{\"session_id\":\"$KEY\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$REPO/plugins/foo.txt\",\"content\":\"x\"}}" | "$GATE")
echo "$deny" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null
echo "$deny" | jq -e '.hookSpecificOutput.hookEventName == "PreToolUse"' >/dev/null
echo "$deny" | jq -e '.hookSpecificOutput.permissionDecisionReason | contains("sdd-run-task-claude")' >/dev/null

# 正向断言：扫描命中 active-ws → task_active。workspace 内写入 allow；
# sdd_root 下、workspace 外的写入 deny（若扫描失败 → orchestrating → 两者皆 allow，断言失败）
allow_ws=$(printf '%s' "{\"session_id\":\"$KEY\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$FIX/sdd/active-ws/progress.md\",\"content\":\"x\"}}" | "$GATE")
echo "$allow_ws" | jq -e '.hookSpecificOutput.permissionDecision == "allow"' >/dev/null
deny_scan=$(printf '%s' "{\"session_id\":\"$KEY\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$FIX/sdd/ledger.md\",\"content\":\"x\"}}" | "$GATE")
echo "$deny_scan" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null

deny_active=$(printf '%s' "{\"session_id\":\"$KEY\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$REPO/plugins/foo.txt\",\"content\":\"x\"}}" | "$GATE")
echo "$deny_active" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null

deny_bash=$(printf '%s' "{\"session_id\":\"$KEY\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"rm -rf $REPO/plugins\"}}" | "$GATE")
echo "$deny_bash" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null

allow_h6=$(printf '%s' "{\"session_id\":\"$KEY\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$ROOT/bin/sdd-run-task-claude.sh --task 1 --mode implement\"}}" | "$GATE")
echo "$allow_h6" | jq -e '.hookSpecificOutput.permissionDecision == "allow"' >/dev/null

echo "OK — override-claude-sdd-gate"
