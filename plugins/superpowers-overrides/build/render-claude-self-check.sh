#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/build/generated/claude-self-check.md"
CHECK=false
[[ "${1:-}" == "--check" ]] && CHECK=true

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

python3 - "$ROOT" <<'PY' > "$tmp"
import sys
from pathlib import Path

sys.path.insert(0, str(Path(sys.argv[1]) / "build/lib"))
from manifest_targets import load_targets

root = Path(sys.argv[1])
template = (root / "build/templates/claude-self-check.md").read_text()
rows = []
for t in load_targets(root):
    rows.append(
        f"| `{t.overrides}` | `Skill(superpowers-overrides:{t.name})` |"
    )
print(template.replace("{{TRIGGER_TABLE}}", "\n".join(rows)), end="")
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
