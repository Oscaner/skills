#!/usr/bin/env bash
# sdd-run-task-cursor.sh — Cursor thin harness: one SDD mode per invocation (p1)
#
# Shared run-loop lives in lib/sdd-common.sh (sdd_run_task). This shell keeps
# only the irreducible Cursor-specific differences: argument parsing / entry
# contract, and the _sdd_invoke_cli flags (spec §4.3).
#
# cursor-agent invocation (source of truth for flags):
#   cursor-agent --print --output-format text --force "$prompt"
#
#   Print mode (--print) is one-shot — no session is registered in /resume or
#   ~/.claude/sessions/. Audit trail is ledger + handoff files, not session
#   list. See H6.6 in sdd-h6-reference.md.
#
# Do not use --resume or any flag that carries prior session history (spec H6.5).
# SDD_DRY_RUN=1 skips cursor-agent (argument parsing / orchestration smoke tests).
#
# Cursor keeps NO Skill(...) review-prefix injection (documented divergence,
# spec D3a) — sdd_run_task receives an empty review_prefix.
#
# Handoff write is now inline in implement/review/fix modes — no separate handoff mode.
#
# Usage:
#   sdd-run-task-cursor.sh --task N --mode implement|review|fix [--plan PATH]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/sdd-common.sh
source "${SCRIPT_DIR}/lib/sdd-common.sh"

TASK_NUM=""
SDD_MODE_ARG=""
# PLAN_FILE is intentionally assigned here and consumed by the shared
# sdd_run_task via dynamic scope (shellcheck cannot see across the library
# source) — see bin/lib/sdd-common.sh.
# shellcheck disable=SC2034
PLAN_FILE=""

usage() {
  printf 'usage: %s --task N --mode implement|review|fix [--plan PATH]\n' "$(basename "$0")" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --task)
      [[ $# -ge 2 ]] || usage
      TASK_NUM="$2"
      shift 2
      ;;
    --mode)
      [[ $# -ge 2 ]] || usage
      SDD_MODE_ARG="$2"
      shift 2
      ;;
    --plan)
      [[ $# -ge 2 ]] || usage
      # PLAN_FILE consumed by shared sdd_run_task via dynamic scope.
      # shellcheck disable=SC2034
      PLAN_FILE="$2"
      shift 2
      ;;
    --segment)
      printf '%s\n' '--segment removed: handoff write is now inline' >&2
      exit 2
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

[[ -n "$TASK_NUM" && -n "$SDD_MODE_ARG" ]] || usage

# Reject removed handoff mode
if [[ "$SDD_MODE_ARG" == "handoff" ]]; then
  printf '%s\n' 'handoff mode removed: handoff write is now inline in implement/review/fix' >&2
  exit 1
fi

_sdd_invoke_cli() {
  cursor-agent --print --output-format text --force "$1" 2>/dev/null
}

sdd_run_task cursor-agent "" "$TASK_NUM"
