#!/usr/bin/env bash
# sdd-run-plan-claude.sh — Claude thin plan harness: pending tasks × 3-mode
# Claude chain (p1)
#
# Shared run-loop lives in lib/sdd-common.sh (sdd_run_plan). This shell keeps
# only the irreducible Claude-specific differences: --plan parsing, and the
# sdd_run_plan call (plan's task-script path + label + cli_bin). SDD_DRY_RUN=1
# propagates to the task script (no live claude).
#
# Usage:
#   sdd-run-plan-claude.sh --plan PATH
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

sdd_run_plan "$PLAN_FILE" "${SCRIPT_DIR}/sdd-run-task-claude.sh" claude "claude"
