#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.codex-plugin/plugin.json"
CHECK=false
[[ "${1:-}" == "--check" ]] && CHECK=true

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

python3 - "$ROOT" <<'PY' > "$tmp"
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(sys.argv[1]) / "build/lib"))
from plugin_metadata import load_harness_metadata

root = Path(sys.argv[1])
meta = load_harness_metadata(root)
doc = {
    "_generated": "plugins/superpowers-overrides/build/render-codex-manifest.sh — do not edit",
    "name": meta["name"],
    "description": meta["description"],
    "version": meta["version"],
    "author": meta["author"],
    "license": meta["license"],
    "hooks": {},
}
print(json.dumps(doc, indent=2) + "\n", end="")
PY

if $CHECK; then
  if ! diff -u "$OUT" "$tmp"; then
    echo "FAIL: $OUT drift — run pnpm run generate:overrides" >&2
    exit 1
  fi
  echo "OK — $OUT fresh"
else
  mkdir -p "$(dirname "$OUT")"
  cp "$tmp" "$OUT"
  echo "OK — wrote $OUT"
fi
