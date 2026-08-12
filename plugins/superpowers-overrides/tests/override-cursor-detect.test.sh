#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/override-cursor-detect.sh"
PENDING_ROOT="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending"
OS_SKILL="$ROOT/../os-engineering/skills/os-brainstorming/SKILL.md"
[ -f "$OS_SKILL" ] || { echo "MISSING os-engineering skill: $OS_SKILL"; exit 1; }
rm -rf "$PENDING_ROOT"
mkdir -p "$PENDING_ROOT"

out=$(printf '%s' '{"conversation_id":"conv-test-1","prompt":"/brainstorming design foo","attachments":[]}' | "$BIN")
echo "$out" | jq -e '.continue == true' >/dev/null
[ ! -f "$PENDING_ROOT/conv-test-1.json" ] || { echo "slash must not write pending"; exit 1; }

printf '%s' '{"conversation_id":"conv-test-1c","prompt":"run superpowers:brainstorming","attachments":[]}' | "$BIN" >/dev/null
[ ! -f "$PENDING_ROOT/conv-test-1c.json" ] || { echo "prefixed slash must not write pending"; exit 1; }

printf '%s' '{"session_id":"sess-fallback","prompt":"/brainstorming","attachments":[]}' | "$BIN" >/dev/null
[ ! -f "$PENDING_ROOT/sess-fallback.json" ] || { echo "session_id slash must not write pending"; exit 1; }

# simulate upstream attach by copying path shape
upstream_cache="${PENDING_ROOT%/pending}/fake-cache/brainstorming/SKILL.md"
mkdir -p "$(dirname "$upstream_cache")" && cp "$OS_SKILL" "$upstream_cache"
out2=$(printf '%s' "{\"conversation_id\":\"conv-test-2\",\"prompt\":\"please review\",\"attachments\":[{\"type\":\"file\",\"file_path\":\"$upstream_cache\"}]}" | "$BIN")
echo "$out2" | jq -e '.continue == true' >/dev/null
jq -e '.trigger == "attach"' "$PENDING_ROOT/conv-test-2.json" >/dev/null
jq -e '.override == "os-engineering:os-brainstorming"' "$PENDING_ROOT/conv-test-2.json" >/dev/null
jq -e '.skill_suffix == "../os-engineering/skills/os-brainstorming/SKILL.md"' "$PENDING_ROOT/conv-test-2.json" >/dev/null

repo_attach="$(dirname "$ROOT")/superpowers/skills/brainstorming/SKILL.md"
if [ -f "$repo_attach" ]; then
  printf '%s' "{\"conversation_id\":\"conv-test-3\",\"prompt\":\"x\",\"attachments\":[{\"type\":\"file\",\"file_path\":\"$repo_attach\"}]}" | "$BIN" >/dev/null
  jq -e '.override == "os-engineering:os-brainstorming"' "$PENDING_ROOT/conv-test-3.json" >/dev/null
fi

echo "OK — override-cursor-detect"
