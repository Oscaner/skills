#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK=false
[[ "${1:-}" == "--check" ]] && CHECK=true

if $CHECK; then
  "$ROOT/build/render-hook.sh" --check
  "$ROOT/build/render-claude-hooks.sh" --check
  "$ROOT/build/render-cursor-hooks.sh" --check
  "$ROOT/build/render-rules.sh" --check
  "$ROOT/build/render-claude-self-check.sh" --check
else
  "$ROOT/build/render-hook.sh"
  "$ROOT/build/render-claude-hooks.sh"
  "$ROOT/build/render-cursor-hooks.sh"
  "$ROOT/build/render-rules.sh"
  "$ROOT/build/render-claude-self-check.sh"
fi

echo "ALL PASS — generators"
