#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/sdd-orchestrator-gate.sh
source "${SCRIPT_DIR}/lib/sdd-orchestrator-gate.sh"

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' '{}'
  exit 0
fi

input=$(cat)
session_key="$(sdd_session_key_from_json "$input")"
tool_name="$(printf '%s' "$input" | jq -r '.tool_name // ""')"
tool_input="$(printf '%s' "$input" | jq -c '.tool_input // {}')"

decision="$(sdd_gate_decide "claude" "$tool_name" "$tool_input" "$session_key")"
if [[ "$decision" == allow ]]; then
  jq -n '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"allow", permissionDecisionReason:""}}'
  exit 0
fi

msg="${decision#deny|}"
jq -n --arg msg "$msg" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$msg}}'
