#!/usr/bin/env bash
# scripts/emit.mjs — do not edit
set -euo pipefail

PENDING_ROOT="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending"
TTL=300

pending_path() {
  echo "$PENDING_ROOT/$1.json"
}

read_pending() {
  local session_key="$1"
  local path
  path="$(pending_path "$session_key")"
  if [ -f "$path" ]; then
    cat "$path"
  fi
}

clear_pending() {
  local session_key="$1"
  rm -f "$(pending_path "$session_key")"
}

is_expired() {
  local detected_at="$1"
  local now
  now=$(date +%s)
  [ $((now - detected_at)) -gt "$TTL" ]
}

session_key_from_input() {
  INPUT="$1" python3 <<'PYKEY'
import hashlib
import json
import os

data = json.loads(os.environ["INPUT"])
if data.get("conversation_id"):
    print(data["conversation_id"])
elif data.get("session_id"):
    print(data["session_id"])
else:
    print(hashlib.sha256((data.get("prompt") or "").encode()).hexdigest()[:16])
PYKEY
}

if ! command -v jq >/dev/null 2>&1; then
  jq -n '{permission:"allow"}' 2>/dev/null || printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

input=$(cat)
session_key=$(session_key_from_input "$input")

pending=$(read_pending "$session_key" || true)
if [ -z "$pending" ]; then
  jq -n '{permission:"allow"}'
  exit 0
fi

detected_at=$(printf '%s' "$pending" | jq -r '.detected_at // 0')
if is_expired "$detected_at"; then
  clear_pending "$session_key"
  jq -n '{permission:"allow"}'
  exit 0
fi

override=$(printf '%s' "$pending" | jq -r '.override')
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // ""')
tool_input=$(printf '%s' "$input" | jq -c '.tool_input // {}')

allow=false

if [ "$tool_name" = "Read" ]; then
  read_path=$(printf '%s' "$tool_input" | jq -r '.path // .file_path // ""')
  if [ -n "$read_path" ]; then
    if INPUT="$input" OVERRIDE="$override" python3 <<'PYREAD' | grep -q '^allow$'
import json
import os
import re

READ_RES = {"engineering:os-brainstorming":["(?i)/engineering/(?:[^/]*/)?skills/os\\-brainstorming/SKILL\\.md$"],"engineering:os-writing-plans":["(?i)/engineering/(?:[^/]*/)?skills/os\\-writing\\-plans/SKILL\\.md$"],"engineering:cli-driven-development":["(?i)/engineering/(?:[^/]*/)?skills/cli\\-driven\\-development/SKILL\\.md$"],"engineering:os-executing-plans":["(?i)/engineering/(?:[^/]*/)?skills/os\\-executing\\-plans/SKILL\\.md$"],"engineering:os-finishing":["(?i)/engineering/(?:[^/]*/)?skills/os\\-finishing/SKILL\\.md$"],"engineering:os-debugging":["(?i)/engineering/(?:[^/]*/)?skills/os\\-debugging/SKILL\\.md$"],"mattpocock-skills:tdd":["(?i)/mattpocock\\-skills/(?:[^/]*/)?skills/engineering/tdd/SKILL\\.md$"],"engineering:os-verification":["(?i)/engineering/(?:[^/]*/)?skills/os\\-verification/SKILL\\.md$"],"engineering:os-code-review":["(?i)/engineering/(?:[^/]*/)?skills/os\\-code\\-review/SKILL\\.md$"]}

data = json.loads(os.environ["INPUT"])
override = os.environ["OVERRIDE"]
ti = data.get("tool_input") or {}
path = ti.get("path") or ti.get("file_path") or ""
for pat in READ_RES.get(override, []):
    if re.search(pat, path):
        print("allow")
        break
PYREAD
    then
      allow=true
    fi
  fi
fi

if [ "$tool_name" = "Skill" ]; then
  skill_name=$(printf '%s' "$tool_input" | jq -r '.skill // ""')
  if [ "$skill_name" = "$override" ]; then
    allow=true
  fi
fi

if $allow; then
  clear_pending "$session_key"
  jq -n '{permission:"allow"}'
  exit 0
fi

skill_suffix=$(printf '%s' "$pending" | jq -r --arg override "$override" '.skill_suffix // ""')
jq -n --arg skill_suffix "$skill_suffix" --arg override "$override" \
  '{permission:"deny", agent_message: ("MANDATORY OVERRIDE — upstream skill attached without the target override loaded.\nYour FIRST tool call MUST be Read(\"" + $skill_suffix + "\") using the fullPath from agent_skills for " + $override + ".\n(Claude Code: Skill(\"" + $override + "\") if available.)\nDo NOT follow the upstream skill checklist until the target skill is loaded.")}'
