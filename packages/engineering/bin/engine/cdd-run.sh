#!/usr/bin/env bash
# cdd-run.sh — engineering single CLI runner: one mode per invocation (Mode A)
# or plan driver (Mode B). Registry-driven: reads harness-registry.json for the
# chosen harness's cli/invoke/output/review_prefix.
#
#   Mode A:  cdd-run.sh --harness <name> --task N --mode implement|review|fix [--plan PATH]
#   Mode B:  cdd-run.sh --harness <name> --plan PATH
#
# Entry disambiguation: --task N present => Mode A (--plan optional);
# else --plan present => Mode B (required); neither => usage exit 2.
#
# CDD_DRY_RUN=1 skips the CLI (argument parsing / orchestration smoke tests).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/cdd-common.sh
source "${SCRIPT_DIR}/lib/cdd-common.sh"

HARNESS=""
TASK_NUM=""
MODE_ARG=""
PLAN_FILE=""

# usage → stderr + exit 2 (arg-parsing error); help → stdout + exit 0 (explicit -h/--help).
usage() {
  printf 'usage: %s --harness <name> (--task N --mode implement|review|fix [--plan PATH] | --plan PATH)\n' "$(basename "$0")" >&2
  exit 2
}

help() {
  printf 'usage: %s --harness <name> (--task N --mode implement|review|fix [--plan PATH] | --plan PATH)\n' "$(basename "$0")"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --harness) [[ $# -ge 2 ]] || usage; HARNESS="$2"; shift 2 ;;
    --task)    [[ $# -ge 2 ]] || usage; TASK_NUM="$2"; shift 2 ;;
    --mode)    [[ $# -ge 2 ]] || usage; MODE_ARG="$2"; shift 2 ;;
    --plan)    [[ $# -ge 2 ]] || usage; PLAN_FILE="$2"; shift 2 ;;
    -h|--help) help ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; usage ;;
  esac
done

[[ -n "$HARNESS" ]] || usage
export CDD_HARNESS="$HARNESS"

if [[ -n "$TASK_NUM" ]]; then
  # Mode A
  [[ -n "$MODE_ARG" ]] || usage
  export CDD_MODE_ARG="$MODE_ARG"
  cdd_run_task "$HARNESS" "$TASK_NUM"
else
  # Mode B
  [[ -n "$PLAN_FILE" ]] || usage
  cdd_run_plan "$PLAN_FILE" "$HARNESS"
fi
