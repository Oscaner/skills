#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/sdd-orchestrator-gate.sh
source "${SCRIPT_DIR}/lib/sdd-orchestrator-gate.sh"

if ! command -v jq >/dev/null 2>&1; then
  jq -n '{permission:"allow"}' 2>/dev/null || printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

input=$(cat)
session_key="$(sdd_session_key_from_json "$input")"
tool_name="$(printf '%s' "$input" | jq -r '.tool_name // ""')"
tool_input="$(printf '%s' "$input" | jq -c '.tool_input // {}')"

decision="$(sdd_gate_decide "cursor" "$tool_name" "$tool_input" "$session_key")"
if [[ "$decision" == allow ]]; then
  jq -n '{permission:"allow"}'
  exit 0
fi

msg="${decision#deny|}"
jq -n --arg msg "$msg" '{permission:"deny", agent_message: $msg}'
