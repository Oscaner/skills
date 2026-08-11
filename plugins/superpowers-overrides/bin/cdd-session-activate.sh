#!/usr/bin/env bash
set -euo pipefail
# cdd-session-activate.sh — write pending-cdd JSON for CDD orchestrator sessions
# usage: cdd-session-activate.sh minimal <session_key> <repo_root> [--mode <in-session|subagent|cli>]
# usage: cdd-session-activate.sh bind <session_key> <repo_root> <plan_path> <workspace> [--mode <in-session|subagent|cli>]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/cdd-orchestrator-gate.sh
source "${SCRIPT_DIR}/lib/cdd-orchestrator-gate.sh"

subcommand="${1:-}"
session_key="${2:-}"
repo_root="${3:-}"
plan_path="${4:-}"
workspace="${5:-}"

usage() {
  printf 'usage: %s minimal <session_key> <repo_root> [--mode <in-session|subagent|cli>]\n' "$(basename "$0")" >&2
  printf '       %s bind <session_key> <repo_root> <plan_path> <workspace> [--mode <in-session|subagent|cli>]\n' "$(basename "$0")" >&2
  exit 2
}

# 模式感知（spec §E）：--mode 优先于 CDD_SESSION_MODE env；缺省空 → pending 省略 mode 字段（fail-open）。
# 不用 CDD_MODE —— 那是任务模式契约 implement|review|fix，域冲突。
session_mode="${CDD_SESSION_MODE:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      [[ $# -ge 2 ]] || usage
      session_mode="$2"
      shift 2
      ;;
    --mode=*)
      session_mode="${1#--mode=}"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

[[ -n "$subcommand" && -n "$session_key" && -n "$repo_root" ]] || usage

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

mkdir -p "$CDD_PENDING_ROOT"
path="$(cdd_pending_path "$session_key")"
now=$(date +%s)

case "$subcommand" in
  minimal)
    jq -n \
      --arg trigger "cdd-orchestrator" \
      --arg session_key "$session_key" \
      --arg repo_root "$repo_root" \
      --arg mode "$session_mode" \
      --argjson detected_at "$now" \
      '{trigger: $trigger, detected_at: $detected_at, session_key: $session_key, repo_root: $repo_root} + (if ($mode | length) > 0 then {mode: $mode} else {} end)' \
      >"$path"
    ;;
  bind)
    [[ -n "$plan_path" && -n "$workspace" ]] || usage
    if [[ -f "$path" ]]; then
      existing="$(cat "$path")"
      # 保留既有会话模式（hook 已写 --mode cli）；显式 --mode/env 优先。
      if [[ -z "$session_mode" ]]; then
        session_mode="$(printf '%s' "$existing" | jq -r '.mode // empty' 2>/dev/null || true)"
      fi
      jq -n \
        --argjson base "$existing" \
        --arg plan_path "$plan_path" \
        --arg workspace "$workspace" \
        --arg mode "$session_mode" \
        '{trigger: ($base.trigger // "cdd-orchestrator"), detected_at: ($base.detected_at // 0), session_key: ($base.session_key // ""), repo_root: ($base.repo_root // ""), plan_path: $plan_path, workspace: $workspace, active_task: null} + (if ($mode | length) > 0 then {mode: $mode} else {} end)' \
        >"$path"
    else
      jq -n \
        --arg trigger "cdd-orchestrator" \
        --arg session_key "$session_key" \
        --arg repo_root "$repo_root" \
        --arg plan_path "$plan_path" \
        --arg workspace "$workspace" \
        --arg mode "$session_mode" \
        --argjson detected_at "$now" \
        '{trigger: $trigger, detected_at: $detected_at, session_key: $session_key, repo_root: $repo_root, plan_path: $plan_path, workspace: $workspace, active_task: null} + (if ($mode | length) > 0 then {mode: $mode} else {} end)' \
        >"$path"
    fi
    ;;
  *)
    usage
    ;;
esac

exit 0
