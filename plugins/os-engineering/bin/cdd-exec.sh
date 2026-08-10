#!/usr/bin/env bash
# cdd-exec.sh — run one prompt via a chosen harness CLI, print normalized output.
# Reuses cdd-common.sh's registry-driven _cdd_invoke_cli (text passthrough /
# stream-json finalText extraction).
#
#   usage: cdd-exec.sh --harness <name> --prompt <text>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/cdd-common.sh
source "${SCRIPT_DIR}/lib/cdd-common.sh"

usage() {
  printf 'usage: %s --harness <name> --prompt <text>\n' "$(basename "$0")" >&2
  exit 2
}

HARNESS=""
PROMPT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --harness) [[ $# -ge 2 ]] || usage; HARNESS="$2"; shift 2 ;;
    --prompt)  [[ $# -ge 2 ]] || usage; PROMPT="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; usage ;;
  esac
done
[[ -n "$HARNESS" && -n "$PROMPT" ]] || usage

export CDD_HARNESS="$HARNESS"
cdd_check_cli "$(_cdd_registry_field "$HARNESS" cli)"
_cdd_invoke_cli "$PROMPT"
