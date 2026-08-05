#!/usr/bin/env bash
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

TARGETS = [{"name": "spor-brainstorming", "skill_suffix": "skills/spor-brainstorming/SKILL.md", "attach_res": ["(?i)/skills/brainstorming/SKILL\\.md$", "(?i)/plugins/superpowers/skills/brainstorming/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/brainstorming/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?brainstorming/SKILL\\.md$", "(?i)/brainstorming/SKILL\\.md$"]}, {"name": "spor-writing-plans", "skill_suffix": "skills/spor-writing-plans/SKILL.md", "attach_res": ["(?i)/skills/writing\\-plans/SKILL\\.md$", "(?i)/plugins/superpowers/skills/writing\\-plans/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/writing\\-plans/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?writing\\-plans/SKILL\\.md$", "(?i)/writing-plans/SKILL\\.md$"]}, {"name": "spor-subagent-driven-development", "skill_suffix": "skills/spor-subagent-driven-development/SKILL.md", "attach_res": ["(?i)/skills/subagent\\-driven\\-development/SKILL\\.md$", "(?i)/plugins/superpowers/skills/subagent\\-driven\\-development/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/subagent\\-driven\\-development/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?subagent\\-driven\\-development/SKILL\\.md$", "(?i)/subagent-driven-development/SKILL\\.md$"]}, {"name": "spor-executing-plans", "skill_suffix": "skills/spor-executing-plans/SKILL.md", "attach_res": ["(?i)/skills/executing\\-plans/SKILL\\.md$", "(?i)/plugins/superpowers/skills/executing\\-plans/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/executing\\-plans/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?executing\\-plans/SKILL\\.md$", "(?i)/executing-plans/SKILL\\.md$"]}, {"name": "spor-finishing-a-development-branch", "skill_suffix": "skills/spor-finishing-a-development-branch/SKILL.md", "attach_res": ["(?i)/skills/finishing\\-a\\-development\\-branch/SKILL\\.md$", "(?i)/plugins/superpowers/skills/finishing\\-a\\-development\\-branch/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/finishing\\-a\\-development\\-branch/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?finishing\\-a\\-development\\-branch/SKILL\\.md$", "(?i)/finishing-a-development-branch/SKILL\\.md$"]}, {"name": "spor-using-git-worktrees", "skill_suffix": "skills/spor-using-git-worktrees/SKILL.md", "attach_res": ["(?i)/skills/using\\-git\\-worktrees/SKILL\\.md$", "(?i)/plugins/superpowers/skills/using\\-git\\-worktrees/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/using\\-git\\-worktrees/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?using\\-git\\-worktrees/SKILL\\.md$", "(?i)/using-git-worktrees/SKILL\\.md$"]}, {"name": "spor-systematic-debugging", "skill_suffix": "skills/spor-systematic-debugging/SKILL.md", "attach_res": ["(?i)/skills/systematic\\-debugging/SKILL\\.md$", "(?i)/plugins/superpowers/skills/systematic\\-debugging/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/systematic\\-debugging/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?systematic\\-debugging/SKILL\\.md$", "(?i)/systematic-debugging/SKILL\\.md$"]}, {"name": "spor-test-driven-development", "skill_suffix": "skills/spor-test-driven-development/SKILL.md", "attach_res": ["(?i)/skills/test\\-driven\\-development/SKILL\\.md$", "(?i)/plugins/superpowers/skills/test\\-driven\\-development/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/test\\-driven\\-development/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?test\\-driven\\-development/SKILL\\.md$", "(?i)/test-driven-development/SKILL\\.md$"]}, {"name": "spor-verification-before-completion", "skill_suffix": "skills/spor-verification-before-completion/SKILL.md", "attach_res": ["(?i)/skills/verification\\-before\\-completion/SKILL\\.md$", "(?i)/plugins/superpowers/skills/verification\\-before\\-completion/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/verification\\-before\\-completion/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?verification\\-before\\-completion/SKILL\\.md$", "(?i)/verification-before-completion/SKILL\\.md$"]}, {"name": "spor-receiving-code-review", "skill_suffix": "skills/spor-receiving-code-review/SKILL.md", "attach_res": ["(?i)/skills/receiving\\-code\\-review/SKILL\\.md$", "(?i)/plugins/superpowers/skills/receiving\\-code\\-review/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/receiving\\-code\\-review/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?receiving\\-code\\-review/SKILL\\.md$", "(?i)/receiving-code-review/SKILL\\.md$"]}]

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
