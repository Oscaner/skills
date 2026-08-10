#!/usr/bin/env bash
# cdd-select.sh — detect installed harness CLIs + recommended default.
# Reads harness-registry.json; prints:
#   available: <csv of ship=full AND command -v found>
#   unsupported_installed: <csv of ship=not-supported AND found>
#   recommended: <name>
# BLOCKED (exit 1) when no full harness is installed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REG="${SCRIPT_DIR}/harness-registry.json"

# csv — space-separated list → comma-separated (csv-join idiom; D6-C3).
csv() {
  printf '%s' "$1" | tr ' ' ','
}

command -v jq >/dev/null 2>&1 \
  || { printf 'CDD_BLOCKED: jq required to read registry: %s\n' "$REG" >&2; exit 1; }

detect_current_harness() {
  if [[ -n "${CURSOR_TRACE_ID:-}" ]]; then printf 'cursor-agent'; return; fi
  if [[ -n "${CLAUDE_CODE_SESSION_ID:-}" ]]; then printf 'claude'; return; fi
  case "${AI_AGENT:-}" in
    claude-code*) printf 'claude'; return ;;
  esac
  printf ''
}

available=""
unsupported=""
while IFS= read -r name; do
  [[ -n "$name" ]] || continue
  ship="$(jq -r --arg n "$name" '.[$n].ship' "$REG")"
  cli="$(jq -r --arg n "$name" '.[$n].cli' "$REG")"
  if command -v "$cli" >/dev/null 2>&1; then
    if [[ "$ship" == "full" ]]; then
      available="${available} ${name}"
    else
      unsupported="${unsupported} ${name}"
    fi
  fi
done < <(jq -r 'keys[]' "$REG")

available="$(printf '%s' "$available" | xargs)"
unsupported="$(printf '%s' "$unsupported" | xargs)"

recommended=""
if [[ -z "$available" ]]; then
  printf 'available:\n'
  printf 'unsupported_installed:%s\n' "$(csv "$unsupported")"
  printf 'recommended:\n'
  printf 'BLOCKED: no full harness installed (registry: %s)\n' "$(jq -r 'keys[]' "$REG" | tr '\n' ' ')" >&2
  exit 1
fi

# 推荐优先级: droid > pi > 当前 harness(full) > 注册序第一个可用
if [[ " $available " == *" droid "* ]]; then
  recommended="droid"
elif [[ " $available " == *" pi "* ]]; then
  recommended="pi"
else
  current="$(detect_current_harness)"
  if [[ -n "$current" && " $available " == *" $current "* ]]; then
    recommended="$current"
  else
    recommended="$(printf '%s\n' "$available" | awk '{print $1}')"
  fi
fi

printf 'available:%s\n' "$(csv "$available")"
printf 'unsupported_installed:%s\n' "$(csv "$unsupported")"
printf 'recommended:%s\n' "$recommended"
