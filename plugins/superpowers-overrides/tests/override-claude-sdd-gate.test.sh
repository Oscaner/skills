#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/bin/override-claude-sdd-gate.sh"
ACTIVATE="$ROOT/bin/sdd-session-activate.sh"
PENDING_SDD="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending-sdd"
FIXTURES="$ROOT/tests/fixtures/sdd-gate"
REPO="$(git -C "$ROOT/../.." rev-parse --show-toplevel)"

# 隔离 fixture：复制 active 场景根到临时目录，git init 副本 + 注入副本自身 commit SHA
# （git-object 校验绑定副本 repo_root，副本内可解析；不修改被提交的 fixture 文件）。
TMPFIX="$(mktemp -d)"
trap 'rm -rf "$TMPFIX"' EXIT
cp -R "$FIXTURES/active/." "$TMPFIX/"
git -C "$TMPFIX" init -q
git -C "$TMPFIX" add -A
git -C "$TMPFIX" -c user.name="sdd-gate-fixture" -c user.email="sdd-gate-fixture@example.com" commit -qm "fixture"
SHA="$(git -C "$TMPFIX" rev-parse --short HEAD)"
printf 'TASK_BASE: %s\n' "$SHA" > "$TMPFIX/sdd/active-ws/task-1-brief.md"
export SDD_GATE_FIXTURES_ROOT="$TMPFIX/sdd"

mkdir -p "$PENDING_SDD"
rm -f "$PENDING_SDD"/*.json

# active fixture 已含真实 SHA brief（无 APPROVED handoff）→ minimal pending 经 fixture root
# 扫描激活 task_active（旧测试用 `TASK_BASE: abc`，T2 后 git-object 校验不激活 → 实际是 orchestrating）
"$ACTIVATE" minimal conv-c1 "$TMPFIX"
deny=$(printf '%s' "{\"session_id\":\"conv-c1\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$REPO/plugins/foo.txt\",\"content\":\"x\"}}" | "$GATE")
echo "$deny" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null
echo "$deny" | jq -e '.hookSpecificOutput.hookEventName == "PreToolUse"' >/dev/null
echo "$deny" | jq -e '.hookSpecificOutput.permissionDecisionReason | contains("sdd-run-task-claude")' >/dev/null

# 正向断言：扫描命中 active-ws → task_active。workspace 内写入 allow；
# sdd_root 下、workspace 外的写入 deny（若扫描失败 → orchestrating → 两者皆 allow，断言失败）
allow_ws=$(printf '%s' "{\"session_id\":\"conv-c1\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TMPFIX/sdd/active-ws/progress.md\",\"content\":\"x\"}}" | "$GATE")
echo "$allow_ws" | jq -e '.hookSpecificOutput.permissionDecision == "allow"' >/dev/null
deny_scan=$(printf '%s' "{\"session_id\":\"conv-c1\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TMPFIX/sdd/ledger.md\",\"content\":\"x\"}}" | "$GATE")
echo "$deny_scan" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null

deny_active=$(printf '%s' "{\"session_id\":\"conv-c1\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$REPO/plugins/foo.txt\",\"content\":\"x\"}}" | "$GATE")
echo "$deny_active" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null

deny_bash=$(printf '%s' "{\"session_id\":\"conv-c1\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"rm -rf $REPO/plugins\"}}" | "$GATE")
echo "$deny_bash" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null

allow_h6=$(printf '%s' "{\"session_id\":\"conv-c1\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$ROOT/bin/sdd-run-task-claude.sh --task 1 --mode implement\"}}" | "$GATE")
echo "$allow_h6" | jq -e '.hookSpecificOutput.permissionDecision == "allow"' >/dev/null

echo "OK — override-claude-sdd-gate"
