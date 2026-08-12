#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DETECT="$ROOT/bin/override-cursor-detect.sh"
ENFORCE="$ROOT/bin/override-cursor-enforce.sh"
PENDING_ROOT="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending"
OS_SKILL="$ROOT/../os-engineering/skills/os-brainstorming/SKILL.md"
[ -f "$OS_SKILL" ] || { echo "MISSING os-engineering skill: $OS_SKILL"; exit 1; }
rm -rf "$PENDING_ROOT" && mkdir -p "$PENDING_ROOT"

write_attach_pending() {
  local session_key="$1"
  local now
  now=$(date +%s)
  jq -n --arg override "os-engineering:os-brainstorming" \
    --arg skill_suffix "../os-engineering/skills/os-brainstorming/SKILL.md" \
    --arg trigger "attach" --argjson detected_at "$now" \
    '{override: $override, skill_suffix: $skill_suffix, trigger: $trigger, detected_at: $detected_at}' \
    > "$PENDING_ROOT/${session_key}.json"
}

write_attach_pending conv-e1

deny=$(printf '%s' '{"conversation_id":"conv-e1","tool_name":"Grep","tool_input":{"pattern":"foo"}}' | "$ENFORCE")
echo "$deny" | jq -e '.permission == "deny"' >/dev/null
echo "$deny" | jq -e '.agent_message | contains("MANDATORY OVERRIDE")' >/dev/null
echo "$deny" | jq -e '.agent_message | contains("../os-engineering/skills/os-brainstorming/SKILL.md")' >/dev/null
echo "$deny" | jq -e '.agent_message | contains("upstream skill attached")' >/dev/null

allow=$(printf '%s' "{\"conversation_id\":\"conv-e1\",\"tool_name\":\"Read\",\"tool_input\":{\"path\":\"$OS_SKILL\"}}" | "$ENFORCE")
echo "$allow" | jq -e '.permission == "allow"' >/dev/null
[ ! -f "$PENDING_ROOT/conv-e1.json" ] || { echo "pending not cleared"; exit 1; }

# Cursor Read payload uses file_path not path
write_attach_pending conv-e1b
allow_fp=$(printf '%s' "{\"conversation_id\":\"conv-e1b\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$OS_SKILL\"}}" | "$ENFORCE")
echo "$allow_fp" | jq -e '.permission == "allow"' >/dev/null
[ ! -f "$PENDING_ROOT/conv-e1b.json" ] || { echo "pending not cleared (file_path)"; exit 1; }

# Skill invocation as valid first tool
write_attach_pending conv-e2
allow_skill=$(printf '%s' '{"conversation_id":"conv-e2","tool_name":"Skill","tool_input":{"skill":"os-engineering:os-brainstorming"}}' | "$ENFORCE")
echo "$allow_skill" | jq -e '.permission == "allow"' >/dev/null

# TTL expiry
now=$(date +%s)
old=$((now - 301))
mkdir -p "$PENDING_ROOT"
printf '{"override":"os-engineering:os-brainstorming","skill_suffix":"../os-engineering/skills/os-brainstorming/SKILL.md","detected_at":%s,"trigger":"attach"}' "$old" > "$PENDING_ROOT/conv-expired.json"
expired=$(printf '%s' '{"conversation_id":"conv-expired","tool_name":"Grep","tool_input":{"pattern":"x"}}' | "$ENFORCE")
echo "$expired" | jq -e '.permission == "allow"' >/dev/null
[ ! -f "$PENDING_ROOT/conv-expired.json" ] || { echo "expired pending not removed"; exit 1; }

noop=$(printf '%s' '{"conversation_id":"conv-none","tool_name":"Shell","tool_input":{"command":"true"}}' | "$ENFORCE")
echo "$noop" | jq -e '.permission == "allow"' >/dev/null

# Slash without pending should allow (detect no longer writes pending on slash)
printf '%s' '{"conversation_id":"conv-slash","prompt":"/brainstorming","attachments":[]}' | "$DETECT" >/dev/null
grep=$(printf '%s' '{"conversation_id":"conv-slash","tool_name":"Grep","tool_input":{"pattern":"foo"}}' | "$ENFORCE")
echo "$grep" | jq -e '.permission == "allow"' >/dev/null

echo "OK — override-cursor-enforce"
