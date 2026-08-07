#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/bin/override-cursor-sdd-gate.sh"
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
WS="$TMPFIX/sdd/active-ws"

mkdir -p "$PENDING_SDD"
rm -f "$PENDING_SDD"/*.json

# AC#3 minimal pending — active-ws 已含真实 SHA brief（无 APPROVED handoff）→ 扫描命中 task_active。
# 仓库路径 Write deny + 只读 git allow 在 orchestrating/task_active 下判定一致；
# 下方 deny_scan（sdd_root 下、workspace 外）是正向判别：仅扫描命中 task_active 时 deny，
# 若扫描失败 → orchestrating → allow，断言失败。
"$ACTIVATE" minimal conv-g1 "$TMPFIX"
deny_orch=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$REPO/plugins/foo.txt\",\"contents\":\"x\"}}" | "$GATE")
echo "$deny_orch" | jq -e '.permission == "deny"' >/dev/null
allow_git=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Shell\",\"tool_input\":{\"command\":\"git -C $REPO rev-parse HEAD\"}}" | "$GATE")
echo "$allow_git" | jq -e '.permission == "allow"' >/dev/null
deny_scan=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$TMPFIX/sdd/ledger.md\",\"contents\":\"x\"}}" | "$GATE")
echo "$deny_scan" | jq -e '.permission == "deny"' >/dev/null

# AC#4 TASK_ACTIVE — bind workspace（active fixture 已含真实 SHA brief，无 APPROVED handoff）
"$ACTIVATE" bind conv-g1 "$TMPFIX" "dogfood-plan.md" "$WS"
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
