#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/override-prompt-expansion.sh"
command -v jq >/dev/null

run() {
  local name="$1" input="$2"
  out=$(printf '%s' "$input" | "$BIN")
  echo "$out" | jq -e '.additionalContext | contains("MANDATORY OVERRIDE")' >/dev/null \
    || { echo "FAIL $name: $out"; exit 1; }
  echo "$out" | jq -e --arg e "$3" '.additionalContext | contains($e)' >/dev/null \
    || { echo "FAIL $name slug: $out"; exit 1; }
}

run superpowers-prefix '{"command_name":"superpowers:brainstorming"}' 'spor-brainstorming'
run bare-slash '{"command_name":"/brainstorming"}' 'spor-brainstorming'
run spor-slash '{"command_name":"/spor-brainstorming"}' 'spor-brainstorming'
run writing-plans '{"command_name":"superpowers:writing-plans"}' 'spor-writing-plans'
no_match=$(printf '%s' '{"command_name":"other:thing"}' | "$BIN" || true)
if [ -z "$no_match" ]; then
  echo "OK no-match exits 0 empty"
else
  echo "$no_match" | jq -e '.additionalContext' >/dev/null && exit 1
fi
echo "OK — override-prompt-expansion"
