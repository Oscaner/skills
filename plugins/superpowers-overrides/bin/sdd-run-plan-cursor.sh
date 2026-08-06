#!/usr/bin/env bash
# sdd-run-plan-cursor.sh — Mode B plan driver: pending tasks × 4-mode Cursor chain (p1)
#
# Invokes sibling sdd-run-task-cursor.sh per mode. Ledger append on APPROVED only (spec §2.9).
# SDD_DRY_RUN=1 propagates to task script (no live cursor-agent).
#
# Usage:
#   sdd-run-plan-cursor.sh --plan PATH
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_SCRIPT="${SCRIPT_DIR}/sdd-run-task-cursor.sh"
# shellcheck source=lib/sdd-common.sh
source "${SCRIPT_DIR}/lib/sdd-common.sh"

PLAN_FILE=""

usage() {
  printf 'usage: %s --plan PATH\n' "$(basename "$0")" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan)
      [[ $# -ge 2 ]] || usage
      PLAN_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      usage
      ;;
  esac
done

[[ -n "$PLAN_FILE" ]] || usage
[[ -f "$PLAN_FILE" ]] || sdd_exit_blocked "plan file not found: ${PLAN_FILE}"

if [[ "${SDD_DRY_RUN:-}" != "1" ]] && ! command -v cursor-agent >/dev/null 2>&1; then
  sdd_exit_cli_missing "cursor-agent not found in PATH"
fi
[[ -x "$TASK_SCRIPT" ]] || sdd_exit_blocked "task script missing or not executable: ${TASK_SCRIPT}"

_sdd_write_plan_constraints() {
  local plan="$1" out="$2"
  if [[ -f "$out" ]]; then
    return 0
  fi
  awk '
    /^## Global Constraints/ { capture=1; next }
    capture && /^---$/ { exit }
    capture && /^## / { exit }
    capture { print }
  ' "$plan" >"$out"
}

_resolve_workspace() {
  local scripts ws_script
  scripts="$(sdd_superpowers_scripts_dir)" || sdd_exit_blocked "upstream sdd-workspace script not found"
  ws_script="${scripts}/sdd-workspace"
  [[ -x "$ws_script" ]] || sdd_exit_blocked "sdd-workspace not executable: ${ws_script}"
  "$ws_script" "$PLAN_FILE"
}

_task_numbers_from_plan() {
  grep -E '^### Task [0-9]+:' "$PLAN_FILE" | sed -E 's/^### Task ([0-9]+):.*/\1/' | sort -n
}

_ledger_complete() {
  local n="$1" ledger="$2"
  grep -qE "^Task ${n}: complete" "$ledger"
}

_handoff_status() {
  local handoff="$1"
  if [[ ! -f "$handoff" ]]; then
    printf 'MISSING\n'
    return
  fi
  if command -v jq >/dev/null 2>&1; then
    jq -r '.status // "UNKNOWN"' "$handoff"
  else
    printf 'UNKNOWN\n'
  fi
}

_task_pending() {
  local n="$1" ledger="$2" handoff="$3"
  if _ledger_complete "$n" "$ledger"; then
    return 1
  fi
  local st
  st="$(_handoff_status "$handoff")"
  [[ "$st" != "APPROVED" ]]
}

_run_task_mode() {
  local task="$1" mode="$2" segment="${3:-}"
  local -a cmd=("$TASK_SCRIPT" --task "$task" --mode "$mode" --plan "$PLAN_FILE")
  if [[ -n "$segment" ]]; then
    cmd+=(--segment "$segment")
  fi
  "${cmd[@]}"
}

_append_ledger() {
  local n="$1" ledger="$2" handoff="$3"
  local base head
  if ! command -v jq >/dev/null 2>&1; then
    printf '\nTask %s: complete (review clean)\n' "$n" >>"$ledger"
    return
  fi
  base="$(jq -r '.commits.base // "unknown"' "$handoff")"
  head="$(jq -r '.commits.head // "unknown"' "$handoff")"
  base="${base:0:7}"
  head="${head:0:7}"
  printf '\nTask %s: complete (commits %s..%s, review clean)\n' "$n" "$base" "$head" >>"$ledger"
}

_run_task_chain() {
  local n="$1" workspace="$2" ledger="$3"
  local handoff="${workspace}/task-${n}-handoff.json"
  local findings="${workspace}/task-${n}-open-findings.json"
  local review_base fix_base status fix_round=0

  export SDD_WORKSPACE="$workspace"
  export SDD_LEDGER="$ledger"
  export SDD_TASK_BRIEF="${workspace}/task-${n}-brief.md"
  export SDD_HANDOFF_PATH="$handoff"
  export SDD_PLAN_CONSTRAINTS="${workspace}/plan-constraints.md"
  export SDD_FINDINGS="$findings"
  unset SDD_HANDOFF_SEGMENT SDD_REVIEW_FIXED_POINT

  [[ -f "${SDD_TASK_BRIEF}" ]] || sdd_exit_blocked "task brief missing: ${SDD_TASK_BRIEF}"

  _run_task_mode "$n" implement
  _run_task_mode "$n" handoff implement

  if [[ -f "$handoff" ]] && command -v jq >/dev/null 2>&1; then
    review_base="$(jq -r '.commits.base // empty' "$handoff")"
  else
    review_base=""
  fi
  [[ -n "$review_base" ]] || sdd_exit_blocked "handoff missing commits.base after implement handoff (task ${n})"
  export SDD_REVIEW_FIXED_POINT="$review_base"

  _run_task_mode "$n" review
  _run_task_mode "$n" handoff review

  while true; do
    status="$(_handoff_status "$handoff")"
    case "$status" in
      APPROVED)
        _append_ledger "$n" "$ledger" "$handoff"
        return 0
        ;;
      BLOCKED|NEEDS_CONTEXT)
        sdd_exit_blocked "task ${n} handoff status ${status}"
        ;;
      CHANGES_REQUESTED)
        fix_round=$((fix_round + 1))
        if (( fix_round > 5 )); then
          sdd_exit_blocked "task ${n}: fix round cap exceeded (H4)"
        fi
        if [[ -f "$handoff" ]] && command -v jq >/dev/null 2>&1; then
          fix_base="$(jq -r '.commits.head // empty' "$handoff")"
        else
          fix_base=""
        fi
        [[ -n "$fix_base" ]] || sdd_exit_blocked "task ${n}: cannot determine FIX_BASE for fix loop"
        export SDD_REVIEW_FIXED_POINT="$fix_base"
        export SDD_FINDINGS="$findings"
        _run_task_mode "$n" fix
        _run_task_mode "$n" review
        _run_task_mode "$n" handoff fix
        ;;
      *)
        sdd_exit_blocked "task ${n}: unexpected handoff status ${status}"
        ;;
    esac
  done
}

WORKSPACE="$(_resolve_workspace)"
LEDGER="${WORKSPACE}/progress.md"
[[ -f "$LEDGER" ]] || sdd_exit_blocked "ledger missing: ${LEDGER}"

_sdd_write_plan_constraints "$PLAN_FILE" "${WORKSPACE}/plan-constraints.md"

pending_found=0
while IFS= read -r task_num; do
  [[ -n "$task_num" ]] || continue
  [[ "$task_num" == "0" ]] && continue
  handoff="${WORKSPACE}/task-${task_num}-handoff.json"
  if _task_pending "$task_num" "$LEDGER" "$handoff"; then
    pending_found=1
    _run_task_chain "$task_num" "$WORKSPACE" "$LEDGER"
  fi
done < <(_task_numbers_from_plan)

if [[ "$pending_found" -eq 0 ]]; then
  printf 'sdd-run-plan-cursor: no pending tasks\n' >&2
fi

sdd_exit_ok
