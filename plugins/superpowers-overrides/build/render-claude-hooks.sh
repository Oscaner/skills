#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/hooks/hooks.json"
CHECK=false
[[ "${1:-}" == "--check" ]] && CHECK=true

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

python3 - "$ROOT" <<'PY' > "$tmp"
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(sys.argv[1]) / "build/lib"))
from manifest_targets import load_targets
from trigger_patterns import cc_matcher_bare_slash, cc_matcher_spor_slash

root = Path(sys.argv[1])
targets = load_targets(root)

command_hook = {
    "type": "command",
    "command": "${CLAUDE_PLUGIN_ROOT}/bin/override-prompt-expansion.sh",
}

bare_parts = [f"({cc_matcher_bare_slash(t.upstream_slug)})" for t in targets]
spor_parts = [f"({cc_matcher_spor_slash(t.upstream_slug)})" for t in targets]

hooks = {
    "hooks": {
        "UserPromptExpansion": [
            {
                "matcher": "^superpowers:",
                "hooks": [command_hook],
            },
            {
                "matcher": "|".join(bare_parts),
                "hooks": [command_hook],
            },
            {
                "matcher": "|".join(spor_parts),
                "hooks": [command_hook],
            },
        ]
    }
}

print(json.dumps(hooks, indent=2) + "\n", end="")
PY

if $CHECK; then
  if ! diff -u "$OUT" "$tmp"; then
    echo "FAIL: $OUT drift — run pnpm run generate:overrides" >&2
    exit 1
  fi
  echo "OK — $OUT fresh"
else
  cp "$tmp" "$OUT"
  echo "OK — wrote $OUT"
fi
