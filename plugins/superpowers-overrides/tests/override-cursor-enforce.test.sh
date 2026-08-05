#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DETECT="$ROOT/bin/override-cursor-detect.sh"
ENFORCE="$ROOT/bin/override-cursor-enforce.sh"
PENDING_ROOT="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending"
SPOR_SKILL="$ROOT/skills/spor-brainstorming/SKILL.md"
rm -rf "$PENDING_ROOT" && mkdir -p "$PENDING_ROOT"

printf '%s' '{"conversation_id":"conv-e1","prompt":"/brainstorming","attachments":[]}' | "$DETECT" >/dev/null

deny=$(printf '%s' '{"conversation_id":"conv-e1","tool_name":"Grep","tool_input":{"pattern":"foo"}}' | "$ENFORCE")
echo "$deny" | jq -e '.permission == "deny"' >/dev/null
echo "$deny" | jq -e '.agent_message | contains("MANDATORY OVERRIDE")' >/dev/null

allow=$(printf '%s' "{\"conversation_id\":\"conv-e1\",\"tool_name\":\"Read\",\"tool_input\":{\"path\":\"$SPOR_SKILL\"}}" | "$ENFORCE")
echo "$allow" | jq -e '.permission == "allow"' >/dev/null
[ ! -f "$PENDING_ROOT/conv-e1.json" ] || { echo "pending not cleared"; exit 1; }

# Skill invocation as valid first tool
printf '%s' '{"conversation_id":"conv-e2","prompt":"/brainstorming","attachments":[]}' | "$DETECT" >/dev/null
allow_skill=$(printf '%s' '{"conversation_id":"conv-e2","tool_name":"Skill","tool_input":{"skill":"superpowers-overrides:spor-brainstorming"}}' | "$ENFORCE")
echo "$allow_skill" | jq -e '.permission == "allow"' >/dev/null

# TTL expiry
now=$(date +%s)
old=$((now - 301))
mkdir -p "$PENDING_ROOT"
printf '{"override":"spor-brainstorming","detected_at":%s,"trigger":"bare-slash"}' "$old" > "$PENDING_ROOT/conv-expired.json"
expired=$(printf '%s' '{"conversation_id":"conv-expired","tool_name":"Grep","tool_input":{"pattern":"x"}}' | "$ENFORCE")
echo "$expired" | jq -e '.permission == "allow"' >/dev/null
[ ! -f "$PENDING_ROOT/conv-expired.json" ] || { echo "expired pending not removed"; exit 1; }

noop=$(printf '%s' '{"conversation_id":"conv-none","tool_name":"Shell","tool_input":{"command":"true"}}' | "$ENFORCE")
echo "$noop" | jq -e '.permission == "allow"' >/dev/null
echo "OK — override-cursor-enforce"
