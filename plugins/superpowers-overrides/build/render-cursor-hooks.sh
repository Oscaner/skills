#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK=false
[[ "${1:-}" == "--check" ]] && CHECK=true

HOOKS_OUT="$ROOT/hooks/hooks-cursor.json"
DETECT_OUT="$ROOT/bin/override-cursor-detect.sh"
ENFORCE_OUT="$ROOT/bin/override-cursor-enforce.sh"

tmp_hooks=$(mktemp)
tmp_detect=$(mktemp)
tmp_enforce=$(mktemp)
trap 'rm -f "$tmp_hooks" "$tmp_detect" "$tmp_enforce"' EXIT

python3 - "$ROOT" "$tmp_hooks" "$tmp_detect" "$tmp_enforce" <<'PY'
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(sys.argv[1]) / "build/lib"))
from manifest_targets import load_targets
from trigger_patterns import (
    attach_path_regexes,
    bare_slash_prompt_regex,
    spor_slash_prompt_regex,
)

root = Path(sys.argv[1])
hooks_out = Path(sys.argv[2])
detect_out = Path(sys.argv[3])
enforce_out = Path(sys.argv[4])

targets = load_targets(root)

hooks = {
    "version": 1,
    "hooks": {
        "beforeSubmitPrompt": [
            {
                "command": "./bin/override-cursor-detect.sh",
                "matcher": "UserPromptSubmit",
            }
        ],
        "preToolUse": [
            {
                "command": "./bin/override-cursor-enforce.sh",
            }
        ],
    },
}
hooks_out.write_text(json.dumps(hooks, indent=2) + "\n")

target_rows = []
for t in targets:
    attach_res = attach_path_regexes(t.upstream_slug)
    attach_res.append(rf"(?i)/{t.upstream_slug}/SKILL\.md$")
    target_rows.append(
        {
            "name": t.name,
            "upstream_slug": t.upstream_slug,
            "bare_re": bare_slash_prompt_regex(t.upstream_slug),
            "spor_re": spor_slash_prompt_regex(t.upstream_slug),
            "prefixed_re": rf"(?i)superpowers:{t.upstream_slug}(\s|$|[^a-zA-Z0-9_-])",
            "spor_prefixed_re": rf"(?i)superpowers-overrides:{t.name}(\s|$|[^a-zA-Z0-9_-])",
            "attach_res": attach_res,
        }
    )

targets_json = json.dumps(target_rows)

detect_script = f'''#!/usr/bin/env bash
set -euo pipefail

PENDING_ROOT="${{TMPDIR:-/tmp}}/oscaner-superpowers-overrides/pending"
TTL=300

pending_path() {{
  echo "$PENDING_ROOT/$1.json"
}}

write_pending() {{
  local session_key="$1" override="$2" trigger="$3"
  mkdir -p "$PENDING_ROOT"
  local now
  now=$(date +%s)
  jq -n --arg override "$override" --arg trigger "$trigger" --argjson detected_at "$now" \\
    '{{override: $override, trigger: $trigger, detected_at: $detected_at}}' > "$(pending_path "$session_key")"
}}

read_pending() {{
  local session_key="$1"
  local path
  path="$(pending_path "$session_key")"
  if [ -f "$path" ]; then
    cat "$path"
  fi
}}

clear_pending() {{
  local session_key="$1"
  rm -f "$(pending_path "$session_key")"
}}

is_expired() {{
  local detected_at="$1"
  local now
  now=$(date +%s)
  [ $((now - detected_at)) -gt "$TTL" ]
}}

if ! command -v jq >/dev/null 2>&1; then
  jq -n '{{continue:true}}' 2>/dev/null || printf '%s\\n' '{{"continue":true}}'
  exit 0
fi

input=$(cat)

match=$(INPUT="$input" python3 <<'PYMATCH'
import hashlib
import json
import os
import re
import sys

TARGETS = {targets_json}

data = json.loads(os.environ["INPUT"])
prompt = data.get("prompt") or ""
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
                print(json.dumps({{"override": t["name"], "trigger": "attach", "session_key": key}}))
                sys.exit(0)

for t in TARGETS:
    if re.search(t["prefixed_re"], prompt) or re.search(t["spor_prefixed_re"], prompt):
        print(json.dumps({{"override": t["name"], "trigger": "prefixed", "session_key": key}}))
        sys.exit(0)

for t in TARGETS:
    if re.search(t["spor_re"], prompt):
        print(json.dumps({{"override": t["name"], "trigger": "spor-slash", "session_key": key}}))
        sys.exit(0)

for t in TARGETS:
    if re.search(t["bare_re"], prompt):
        print(json.dumps({{"override": t["name"], "trigger": "bare-slash", "session_key": key}}))
        sys.exit(0)
PYMATCH
)

if [ -n "$match" ]; then
  override=$(printf '%s' "$match" | jq -r '.override')
  trigger=$(printf '%s' "$match" | jq -r '.trigger')
  session_key=$(printf '%s' "$match" | jq -r '.session_key')
  write_pending "$session_key" "$override" "$trigger"
fi

jq -n '{{continue:true}}'
'''

enforce_script = f'''#!/usr/bin/env bash
set -euo pipefail

PENDING_ROOT="${{TMPDIR:-/tmp}}/oscaner-superpowers-overrides/pending"
TTL=300

pending_path() {{
  echo "$PENDING_ROOT/$1.json"
}}

read_pending() {{
  local session_key="$1"
  local path
  path="$(pending_path "$session_key")"
  if [ -f "$path" ]; then
    cat "$path"
  fi
}}

clear_pending() {{
  local session_key="$1"
  rm -f "$(pending_path "$session_key")"
}}

is_expired() {{
  local detected_at="$1"
  local now
  now=$(date +%s)
  [ $((now - detected_at)) -gt "$TTL" ]
}}

session_key_from_input() {{
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
}}

if ! command -v jq >/dev/null 2>&1; then
  jq -n '{{permission:"allow"}}' 2>/dev/null || printf '%s\\n' '{{"permission":"allow"}}'
  exit 0
fi

input=$(cat)
session_key=$(session_key_from_input "$input")

pending=$(read_pending "$session_key" || true)
if [ -z "$pending" ]; then
  jq -n '{{permission:"allow"}}'
  exit 0
fi

detected_at=$(printf '%s' "$pending" | jq -r '.detected_at // 0')
if is_expired "$detected_at"; then
  clear_pending "$session_key"
  jq -n '{{permission:"allow"}}'
  exit 0
fi

override=$(printf '%s' "$pending" | jq -r '.override')
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // ""')
tool_input=$(printf '%s' "$input" | jq -c '.tool_input // {{}}')

allow=false

if [ "$tool_name" = "Read" ]; then
  read_path=$(printf '%s' "$tool_input" | jq -r '.path // ""')
  if [ -n "$read_path" ] && printf '%s' "$read_path" | grep -Eiq "/skills/${{override}}/SKILL\\.md$|/${{override}}/SKILL\\.md$"; then
    allow=true
  fi
fi

if [ "$tool_name" = "Skill" ]; then
  skill_name=$(printf '%s' "$tool_input" | jq -r '.skill // ""')
  if [ "$skill_name" = "superpowers-overrides:${{override}}" ]; then
    allow=true
  fi
fi

if $allow; then
  clear_pending "$session_key"
  jq -n '{{permission:"allow"}}'
  exit 0
fi

skill_ref="superpowers-overrides:${{override}}"
jq -n --arg skill_ref "$skill_ref" \\
  '{{permission:"deny", agent_message: ("MANDATORY OVERRIDE — oscaner hook intercepted this turn.\\nYour FIRST tool call MUST be Skill(\\"" + $skill_ref + "\\").\\nDo NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.")}}'
'''

detect_out.write_text(detect_script)
enforce_out.write_text(enforce_script)
PY

chmod +x "$tmp_detect" "$tmp_enforce"

check_one() {
  local out="$1" tmp="$2" label="$3"
  if $CHECK; then
    if ! diff -u "$out" "$tmp"; then
      echo "FAIL: $out drift — run pnpm run generate:overrides" >&2
      exit 1
    fi
    echo "OK — $label fresh"
  else
    cp "$tmp" "$out"
    if [[ "$out" == *.sh ]]; then
      chmod +x "$out"
    fi
    echo "OK — wrote $out"
  fi
}

check_one "$HOOKS_OUT" "$tmp_hooks" "hooks-cursor.json"
check_one "$DETECT_OUT" "$tmp_detect" "override-cursor-detect.sh"
check_one "$ENFORCE_OUT" "$tmp_enforce" "override-cursor-enforce.sh"
