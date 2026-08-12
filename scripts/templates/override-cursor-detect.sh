#!/usr/bin/env bash
# scripts/emit.mjs — do not edit
set -euo pipefail

PENDING_ROOT="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending"
TTL=300

pending_path() {
  echo "$PENDING_ROOT/$1.json"
}

write_pending() {
  local session_key="$1" override="$2" skill_suffix="$3"
  mkdir -p "$PENDING_ROOT"
  local now
  now=$(date +%s)
  jq -n --arg override "$override" --arg skill_suffix "$skill_suffix" \
    --arg trigger "attach" --argjson detected_at "$now" \
    '{override: $override, skill_suffix: $skill_suffix, trigger: $trigger, detected_at: $detected_at}' \
    > "$(pending_path "$session_key")"
}

if ! command -v jq >/dev/null 2>&1; then
  jq -n '{continue:true}' 2>/dev/null || printf '%s\n' '{"continue":true}'
  exit 0
fi

input=$(cat)

match=$(INPUT="$input" python3 <<'PYMATCH'
import hashlib
import json
import os
import re
import sys

TARGETS = {{TARGETS_JSON}}

data = json.loads(os.environ["INPUT"])
attachments = data.get("attachments") or []

def session_key(d):
    if d.get("conversation_id"):
        return d["conversation_id"]
    if d.get("session_id"):
        return d["session_id"]
    return hashlib.sha256((d.get("prompt") or "").encode()).hexdigest()[:16]

key = session_key(data)

for t in TARGETS:
    for att in attachments:
        path = att.get("file_path") or att.get("path") or ""
        if not path:
            continue
        for pat in t["attach_res"]:
            if re.search(pat, path):
                print(json.dumps({"override": t["name"], "skill_suffix": t["skill_suffix"], "trigger": "attach", "session_key": key}))
                sys.exit(0)
PYMATCH
)

if [ -n "$match" ]; then
  override=$(printf '%s' "$match" | jq -r '.override')
  skill_suffix=$(printf '%s' "$match" | jq -r '.skill_suffix')
  session_key=$(printf '%s' "$match" | jq -r '.session_key')
  write_pending "$session_key" "$override" "$skill_suffix"
fi

jq -n '{continue:true}'
