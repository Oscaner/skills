#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/override-cursor-detect.sh"
PENDING_ROOT="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending"
SPOR_SKILL="$ROOT/skills/spor-brainstorming/SKILL.md"
rm -rf "$PENDING_ROOT"
mkdir -p "$PENDING_ROOT"

out=$(printf '%s' '{"conversation_id":"conv-test-1","prompt":"/brainstorming design foo","attachments":[]}' | "$BIN")
echo "$out" | jq -e '.continue == true' >/dev/null
[ -f "$PENDING_ROOT/conv-test-1.json" ] || { echo "missing pending"; exit 1; }
jq -e '.override == "spor-brainstorming"' "$PENDING_ROOT/conv-test-1.json" >/dev/null

# spor slash + prefixed prompt triggers
printf '%s' '{"conversation_id":"conv-test-1b","prompt":"use /spor-brainstorming please","attachments":[]}' | "$BIN" >/dev/null
jq -e '.override == "spor-brainstorming"' "$PENDING_ROOT/conv-test-1b.json" >/dev/null

printf '%s' '{"conversation_id":"conv-test-1c","prompt":"run superpowers:brainstorming","attachments":[]}' | "$BIN" >/dev/null
jq -e '.trigger == "prefixed"' "$PENDING_ROOT/conv-test-1c.json" >/dev/null

printf '%s' '{"conversation_id":"conv-test-1d","prompt":"use superpowers-overrides:spor-brainstorming","attachments":[]}' | "$BIN" >/dev/null
jq -e '.override == "spor-brainstorming"' "$PENDING_ROOT/conv-test-1d.json" >/dev/null

printf '%s' '{"session_id":"sess-fallback","prompt":"/brainstorming","attachments":[]}' | "$BIN" >/dev/null
[ -f "$PENDING_ROOT/sess-fallback.json" ] || { echo "missing session_id pending"; exit 1; }

# session_key fallback when no conversation_id — hash via python3 (portable)
hash_key=$(python3 -c "import hashlib; print(hashlib.sha256(b'/brainstorming only prompt hash').hexdigest()[:16])")
printf '%s' '{"prompt":"/brainstorming only prompt hash","attachments":[]}' | "$BIN" >/dev/null
[ -f "$PENDING_ROOT/${hash_key}.json" ] || { echo "missing hash pending"; exit 1; }

cache_path="$SPOR_SKILL"
# simulate upstream attach by copying path shape
upstream_cache="${PENDING_ROOT%/pending}/fake-cache/brainstorming/SKILL.md"
mkdir -p "$(dirname "$upstream_cache")" && cp "$SPOR_SKILL" "$upstream_cache"
out2=$(printf '%s' "{\"conversation_id\":\"conv-test-2\",\"prompt\":\"please review\",\"attachments\":[{\"type\":\"file\",\"file_path\":\"$upstream_cache\"}]}" | "$BIN")
echo "$out2" | jq -e '.continue == true' >/dev/null
jq -e '.trigger == "attach"' "$PENDING_ROOT/conv-test-2.json" >/dev/null

repo_attach="$(dirname "$ROOT")/superpowers/skills/brainstorming/SKILL.md"
if [ -f "$repo_attach" ]; then
  printf '%s' "{\"conversation_id\":\"conv-test-3\",\"prompt\":\"x\",\"attachments\":[{\"type\":\"file\",\"file_path\":\"$repo_attach\"}]}" | "$BIN" >/dev/null
  jq -e '.override == "spor-brainstorming"' "$PENDING_ROOT/conv-test-3.json" >/dev/null
fi

cursor_skills="$ROOT/../.cursor/skills/brainstorming/SKILL.md"
if [ -f "$cursor_skills" ]; then
  printf '%s' "{\"conversation_id\":\"conv-test-4\",\"prompt\":\"x\",\"attachments\":[{\"type\":\"file\",\"file_path\":\"$cursor_skills\"}]}" | "$BIN" >/dev/null
  jq -e '.trigger == "attach"' "$PENDING_ROOT/conv-test-4.json" >/dev/null
fi
echo "OK — override-cursor-detect"
