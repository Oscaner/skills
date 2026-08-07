#!/usr/bin/env bash
# sdd-run-task-cursor.sh — Cursor full harness: one SDD mode per invocation (p1)
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
# Usage:
#   sdd-run-task-cursor.sh --task N --mode implement|handoff|review|fix [--segment implement|review|fix]
#
# Requires SDD_WORKSPACE (or --plan with upstream sdd-workspace). Sets path env vars from --task.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/sdd-common.sh
source "${SCRIPT_DIR}/lib/sdd-common.sh"

TASK_NUM=""
SDD_MODE_ARG=""
SDD_SEGMENT=""
PLAN_FILE=""

usage() {
  printf 'usage: %s --task N --mode implement|handoff|review|fix [--segment implement|review|fix] [--plan PATH]\n' "$(basename "$0")" >&2
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
    --segment)
      [[ $# -ge 2 ]] || usage
      SDD_SEGMENT="$2"
      shift 2
      ;;
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

[[ -n "$TASK_NUM" && -n "$SDD_MODE_ARG" ]] || usage

if [[ "${SDD_DRY_RUN:-}" != "1" ]] && ! command -v cursor-agent >/dev/null 2>&1; then
  sdd_exit_cli_missing "cursor-agent not found in PATH"
fi

_sdd_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

_sdd_relpath_from_repo() {
  local abs="$1" root
  root="$(_sdd_repo_root)" || { printf '%s' "$abs"; return; }
  abs="$(cd "$(dirname "$abs")" && pwd)/$(basename "$abs")"
  case "$abs" in
    "${root}/"*) printf '%s' "${abs#${root}/}" ;;
    *) printf '%s' "$abs" ;;
  esac
}

_sdd_plan_from_ledger() {
  local ledger="$1"
  sed -n '1s/^# SDD ledger — plan: //p' "$ledger"
}

_sdd_resolve_workspace() {
  if [[ -n "${SDD_WORKSPACE:-}" ]]; then
    printf '%s\n' "$SDD_WORKSPACE"
    return 0
  fi
  [[ -n "$PLAN_FILE" ]] || sdd_exit_blocked "SDD_WORKSPACE unset and --plan not provided"
  local scripts ws_script
  scripts="$(sdd_superpowers_scripts_dir)" || sdd_exit_blocked "upstream sdd-workspace script not found"
  ws_script="${scripts}/sdd-workspace"
  [[ -x "$ws_script" ]] || sdd_exit_blocked "sdd-workspace not executable: ${ws_script}"
  "$ws_script" "$PLAN_FILE"
}

_sdd_set_task_env() {
  local workspace="$1" task="$2"
  export SDD_WORKSPACE="$workspace"
  export SDD_LEDGER="${SDD_LEDGER:-${workspace}/progress.md}"
  export SDD_TASK_BRIEF="${SDD_TASK_BRIEF:-${workspace}/task-${task}-brief.md}"
  export SDD_HANDOFF_PATH="${SDD_HANDOFF_PATH:-${workspace}/task-${task}-handoff.json}"
  export SDD_PLAN_CONSTRAINTS="${SDD_PLAN_CONSTRAINTS:-${workspace}/plan-constraints.md}"
  export SDD_MODE="$SDD_MODE_ARG"
  export SDD_HANDOFF_SEGMENT="${SDD_SEGMENT:-}"
  export SDD_FINDINGS="${SDD_FINDINGS:-${workspace}/task-${task}-open-findings.json}"
}

_sdd_emit_h1_four_lines() {
  local raw="$1"
  local -a keys=(status commits artifacts blocker)
  local key line
  for key in "${keys[@]}"; do
    line="$(printf '%s\n' "$raw" | grep -E "^${key}:" | tail -1 || true)"
    if [[ -n "$line" ]]; then
      printf '%s\n' "$line"
    else
      printf '%s: <missing>\n' "$key"
    fi
  done
}

_sdd_run_review_package() {
  local plan="$1" base="$2" head="$3" handoff_path="$4"
  local scripts review_pkg out_line diff_path repo_root rel
  scripts="$(sdd_superpowers_scripts_dir)" || sdd_exit_blocked "upstream review-package script not found"
  review_pkg="${scripts}/review-package"
  [[ -x "$review_pkg" ]] || sdd_exit_blocked "review-package not executable: ${review_pkg}"

  out_line="$(bash "$review_pkg" "$plan" "$base" "$head" 2>&1 | tail -1)"
  diff_path="$(printf '%s' "$out_line" | sed -n 's/^wrote \([^:]*\):.*/\1/p')"
  if [[ -z "$diff_path" || ! -f "$diff_path" ]]; then
    sdd_exit_blocked "review-package did not produce diff file (output: ${out_line})"
  fi

  if command -v jq >/dev/null 2>&1 && [[ -f "$handoff_path" ]]; then
    repo_root="$(_sdd_repo_root)" || true
    if [[ -n "$repo_root" && "$diff_path" == "${repo_root}/"* ]]; then
      rel="${diff_path#${repo_root}/}"
    else
      rel="$(_sdd_relpath_from_repo "$diff_path")"
    fi
    local tmp
    tmp="$(mktemp)"
    jq --arg diff "$rel" '.artifacts = ((.artifacts // {}) + {diff: $diff})' "$handoff_path" >"$tmp"
    mv "$tmp" "$handoff_path"
  fi

  printf '%s\n' "$out_line" >&2
}

WORKSPACE="$(_sdd_resolve_workspace)"
_sdd_set_task_env "$WORKSPACE" "$TASK_NUM"

if [[ -z "$PLAN_FILE" && -f "${SDD_LEDGER}" ]]; then
  PLAN_FILE="$(_sdd_plan_from_ledger "${SDD_LEDGER}")"
fi

if [[ "$SDD_MODE_ARG" == "review" ]]; then
  if [[ -z "${SDD_REVIEW_FIXED_POINT:-}" ]]; then
    if [[ -f "${SDD_HANDOFF_PATH}" ]] && command -v jq >/dev/null 2>&1; then
      SDD_REVIEW_FIXED_POINT="$(jq -r '.commits.base // empty' "${SDD_HANDOFF_PATH}")"
      export SDD_REVIEW_FIXED_POINT
    fi
  fi
  if [[ "${SDD_DRY_RUN:-}" == "1" && -z "${SDD_REVIEW_FIXED_POINT:-}" ]]; then
    SDD_REVIEW_FIXED_POINT="HEAD~1"
    export SDD_REVIEW_FIXED_POINT
  fi
  if [[ "${SDD_DRY_RUN:-}" != "1" ]]; then
    [[ -n "${PLAN_FILE:-}" ]] || sdd_exit_blocked "review mode requires plan path (ledger header or --plan)"
    [[ -f "$PLAN_FILE" ]] || sdd_exit_blocked "plan file not found: ${PLAN_FILE}"

    review_base="${SDD_REVIEW_FIXED_POINT:-}"
    review_head="HEAD"
    if [[ -f "${SDD_HANDOFF_PATH}" ]] && command -v jq >/dev/null 2>&1; then
      handoff_head="$(jq -r '.commits.head // empty' "${SDD_HANDOFF_PATH}")"
      [[ -n "$handoff_head" ]] && review_head="$handoff_head"
    fi
    [[ -n "$review_base" ]] || sdd_exit_blocked "review mode requires SDD_REVIEW_FIXED_POINT or handoff commits.base"

    _sdd_run_review_package "$PLAN_FILE" "$review_base" "$review_head" "${SDD_HANDOFF_PATH}"
  fi
fi

sdd_require_env

template_name="$SDD_MODE_ARG"
prompt="$(sdd_render_template "$template_name")" || sdd_exit_blocked "template render failed: ${template_name}"

agent_rc=0
agent_out=""
if [[ "${SDD_DRY_RUN:-}" == "1" ]]; then
  agent_out="$(cat <<EOF
status: DONE
commits: base=dry-run head=dry-run
artifacts: brief=${SDD_TASK_BRIEF} report=${SDD_WORKSPACE}/task-${TASK_NUM}-report.md test_evidence=${SDD_WORKSPACE}/task-${TASK_NUM}-test-evidence.json
blocker: none
EOF
)"
else
  agent_out="$(cursor-agent --print --output-format text --force "$prompt" 2>/dev/null)" || agent_rc=$?
fi

_sdd_emit_h1_four_lines "$agent_out"

if [[ "$agent_rc" -ne 0 ]]; then
  if [[ ! -f "${SDD_HANDOFF_PATH}" ]]; then
    sdd_exit_blocked "cursor-agent exited ${agent_rc} and handoff missing"
  fi
  exit "$agent_rc"
fi

case "$SDD_MODE_ARG" in
  handoff)
    if [[ "${SDD_DRY_RUN:-}" != "1" ]]; then
      sdd_assert_handoff "${SDD_HANDOFF_PATH}"
    fi
    ;;
esac

sdd_exit_ok
