#!/usr/bin/env bash
set -euo pipefail
# sdd-session-activate.sh — write pending-sdd JSON for SDD orchestrator sessions
# usage: sdd-session-activate.sh minimal <session_key> <repo_root>
# usage: sdd-session-activate.sh bind <session_key> <repo_root> <plan_path> <workspace>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/sdd-orchestrator-gate.sh
source "${SCRIPT_DIR}/lib/sdd-orchestrator-gate.sh"

mode="${1:-}"
session_key="${2:-}"
repo_root="${3:-}"
plan_path="${4:-}"
workspace="${5:-}"

usage() {
  printf 'usage: %s minimal <session_key> <repo_root>\n' "$(basename "$0")" >&2
  printf '       %s bind <session_key> <repo_root> <plan_path> <workspace>\n' "$(basename "$0")" >&2
  exit 2
}

[[ -n "$mode" && -n "$session_key" && -n "$repo_root" ]] || usage

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

mkdir -p "$SDD_PENDING_ROOT"
path="$(sdd_pending_path "$session_key")"
now=$(date +%s)

case "$mode" in
  minimal)
    jq -n \
      --arg trigger "sdd-orchestrator" \
      --arg session_key "$session_key" \
      --arg repo_root "$repo_root" \
      --argjson detected_at "$now" \
      '{trigger: $trigger, detected_at: $detected_at, session_key: $session_key, repo_root: $repo_root}' \
      >"$path"
    ;;
  bind)
    [[ -n "$plan_path" && -n "$workspace" ]] || usage
    if [[ -f "$path" ]]; then
      existing="$(cat "$path")"
      jq -n \
        --argjson base "$existing" \
        --arg plan_path "$plan_path" \
        --arg workspace "$workspace" \
        '{trigger: ($base.trigger // "sdd-orchestrator"), detected_at: ($base.detected_at // 0), session_key: ($base.session_key // ""), repo_root: ($base.repo_root // ""), plan_path: $plan_path, workspace: $workspace, active_task: null}' \
        >"$path"
    else
      jq -n \
        --arg trigger "sdd-orchestrator" \
        --arg session_key "$session_key" \
        --arg repo_root "$repo_root" \
        --arg plan_path "$plan_path" \
        --arg workspace "$workspace" \
        --argjson detected_at "$now" \
        '{trigger: $trigger, detected_at: $detected_at, session_key: $session_key, repo_root: $repo_root, plan_path: $plan_path, workspace: $workspace, active_task: null}' \
        >"$path"
    fi
    ;;
  *)
    usage
    ;;
esac

exit 0
