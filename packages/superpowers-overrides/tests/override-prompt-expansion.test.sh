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

run superpowers-prefix '{"command_name":"superpowers:brainstorming"}' 'engineering:os-brainstorming'
run bare-slash '{"command_name":"/brainstorming"}' 'engineering:os-brainstorming'
run writing-plans '{"command_name":"superpowers:writing-plans"}' 'engineering:os-writing-plans'
run tdd-prefix '{"command_name":"superpowers:test-driven-development"}' 'mattpocock-skills:tdd'
run tdd-slash '{"command_name":"/test-driven-development"}' 'mattpocock-skills:tdd'
run finishing-slash '{"command_name":"/finishing-a-development-branch"}' 'engineering:os-finishing'

no_match=$(printf '%s' '{"command_name":"other:thing"}' | "$BIN" || true)
if [ -z "$no_match" ]; then
  echo "OK no-match exits 0 empty"
else
  echo "$no_match" | jq -e '.additionalContext' >/dev/null && exit 1
fi

spor_no_match=$(printf '%s' '{"command_name":"/spor-brainstorming"}' | "$BIN" || true)
if [ -z "$spor_no_match" ]; then
  echo "OK /spor-* no longer matches"
else
  echo "$spor_no_match" | jq -e '.additionalContext' >/dev/null && exit 1
fi

echo "OK — override-prompt-expansion"
