#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/bin/override-prompt-expansion.sh"
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
targets = load_targets(root)
lines = [
    "#!/bin/sh",
    "set -eu",
    "",
    "if ! command -v jq >/dev/null 2>&1; then",
    '  echo "[oscaner] WARNING: jq is required for superpowers override hooks. Install jq to enforce overrides automatically." >&2',
    "  exit 1",
    "fi",
    "",
    "input=$(cat)",
    'command_name=$(printf \'%s\' "$input" | jq -r \'.command_name // ""\')',
    "",
    'case "$command_name" in',
]
for t in targets:
    lines.append(f'  {t.overrides}) override="superpowers-overrides:{t.name}" ;;')
    lines.append(f'  /{t.upstream_slug}) override="superpowers-overrides:{t.name}" ;;')
    lines.append(f'  /{t.name}) override="superpowers-overrides:{t.name}" ;;')
lines.extend(
    [
        "  *) exit 0 ;;",
        "esac",
        "",
        "sdd_activate=false",
        'case "$command_name" in',
        "  superpowers:subagent-driven-development|/subagent-driven-development|/spor-subagent-driven-development|"
        "superpowers:executing-plans|/executing-plans|/spor-executing-plans)",
        "    sdd_activate=true ;;",
        "esac",
        "",
        'if $sdd_activate; then',
        '  _plugin_root="$(cd "$(dirname "$0")/.." && pwd)"',
        '  _repo_root="$(git -C "${CLAUDE_PROJECT_DIR:-$(pwd)}" rev-parse --show-toplevel 2>/dev/null || pwd)"',
        '  _session_key=$(INPUT="$input" python3 -c "import hashlib,json,os;d=json.loads(os.environ[\'INPUT\']);print(d.get(\'session_id\') or d.get(\'conversation_id\') or hashlib.sha256((d.get(\'prompt\') or \'\').encode()).hexdigest()[:16])")',
        '  "${_plugin_root}/bin/cdd-session-activate.sh" minimal "$_session_key" "$_repo_root" 2>/dev/null || true',
        "fi",
        "",
        "jq -n --arg override \"$override\" '{",
        '  additionalContext: ("MANDATORY OVERRIDE — oscaner hook intercepted this turn.\\nYour FIRST tool call MUST be Skill(\\"" + $override + "\\").\\nDo NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.")',
        "}'",
        "",
    ]
)
print("\n".join(lines), end="")
PY

chmod +x "$tmp"

if $CHECK; then
  if ! diff -u "$OUT" "$tmp"; then
    echo "FAIL: $OUT drift — run pnpm run generate:overrides" >&2
    exit 1
  fi
  echo "OK — $OUT fresh"
else
  cp "$tmp" "$OUT"
  chmod +x "$OUT"
  echo "OK — wrote $OUT"
fi
