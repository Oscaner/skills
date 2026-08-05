#!/usr/bin/env bash
set -euo pipefail

PENDING_ROOT="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending"
TTL=300

pending_path() {
  echo "$PENDING_ROOT/$1.json"
}

write_pending() {
  local session_key="$1" override="$2" trigger="$3"
  mkdir -p "$PENDING_ROOT"
  local now
  now=$(date +%s)
  jq -n --arg override "$override" --arg trigger "$trigger" --argjson detected_at "$now" \
    '{override: $override, trigger: $trigger, detected_at: $detected_at}' > "$(pending_path "$session_key")"
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

TARGETS = [{"name": "spor-brainstorming", "upstream_slug": "brainstorming", "bare_re": "(?i)(^|\\s)/brainstorming(\\s|$)", "spor_re": "(?i)(^|\\s)/spor-brainstorming(\\s|$)", "prefixed_re": "(?i)superpowers:brainstorming(\\s|$|[^a-zA-Z0-9_-])", "spor_prefixed_re": "(?i)superpowers-overrides:spor-brainstorming(\\s|$|[^a-zA-Z0-9_-])", "attach_res": ["(?i)/skills/brainstorming/SKILL\\.md$", "(?i)/plugins/superpowers/skills/brainstorming/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/brainstorming/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?brainstorming/SKILL\\.md$", "(?i)/brainstorming/SKILL\\.md$"]}, {"name": "spor-writing-plans", "upstream_slug": "writing-plans", "bare_re": "(?i)(^|\\s)/writing\\-plans(\\s|$)", "spor_re": "(?i)(^|\\s)/spor-writing\\-plans(\\s|$)", "prefixed_re": "(?i)superpowers:writing-plans(\\s|$|[^a-zA-Z0-9_-])", "spor_prefixed_re": "(?i)superpowers-overrides:spor-writing-plans(\\s|$|[^a-zA-Z0-9_-])", "attach_res": ["(?i)/skills/writing\\-plans/SKILL\\.md$", "(?i)/plugins/superpowers/skills/writing\\-plans/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/writing\\-plans/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?writing\\-plans/SKILL\\.md$", "(?i)/writing-plans/SKILL\\.md$"]}, {"name": "spor-subagent-driven-development", "upstream_slug": "subagent-driven-development", "bare_re": "(?i)(^|\\s)/subagent\\-driven\\-development(\\s|$)", "spor_re": "(?i)(^|\\s)/spor-subagent\\-driven\\-development(\\s|$)", "prefixed_re": "(?i)superpowers:subagent-driven-development(\\s|$|[^a-zA-Z0-9_-])", "spor_prefixed_re": "(?i)superpowers-overrides:spor-subagent-driven-development(\\s|$|[^a-zA-Z0-9_-])", "attach_res": ["(?i)/skills/subagent\\-driven\\-development/SKILL\\.md$", "(?i)/plugins/superpowers/skills/subagent\\-driven\\-development/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/subagent\\-driven\\-development/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?subagent\\-driven\\-development/SKILL\\.md$", "(?i)/subagent-driven-development/SKILL\\.md$"]}, {"name": "spor-executing-plans", "upstream_slug": "executing-plans", "bare_re": "(?i)(^|\\s)/executing\\-plans(\\s|$)", "spor_re": "(?i)(^|\\s)/spor-executing\\-plans(\\s|$)", "prefixed_re": "(?i)superpowers:executing-plans(\\s|$|[^a-zA-Z0-9_-])", "spor_prefixed_re": "(?i)superpowers-overrides:spor-executing-plans(\\s|$|[^a-zA-Z0-9_-])", "attach_res": ["(?i)/skills/executing\\-plans/SKILL\\.md$", "(?i)/plugins/superpowers/skills/executing\\-plans/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/executing\\-plans/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?executing\\-plans/SKILL\\.md$", "(?i)/executing-plans/SKILL\\.md$"]}, {"name": "spor-finishing-a-development-branch", "upstream_slug": "finishing-a-development-branch", "bare_re": "(?i)(^|\\s)/finishing\\-a\\-development\\-branch(\\s|$)", "spor_re": "(?i)(^|\\s)/spor-finishing\\-a\\-development\\-branch(\\s|$)", "prefixed_re": "(?i)superpowers:finishing-a-development-branch(\\s|$|[^a-zA-Z0-9_-])", "spor_prefixed_re": "(?i)superpowers-overrides:spor-finishing-a-development-branch(\\s|$|[^a-zA-Z0-9_-])", "attach_res": ["(?i)/skills/finishing\\-a\\-development\\-branch/SKILL\\.md$", "(?i)/plugins/superpowers/skills/finishing\\-a\\-development\\-branch/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/finishing\\-a\\-development\\-branch/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?finishing\\-a\\-development\\-branch/SKILL\\.md$", "(?i)/finishing-a-development-branch/SKILL\\.md$"]}, {"name": "spor-using-git-worktrees", "upstream_slug": "using-git-worktrees", "bare_re": "(?i)(^|\\s)/using\\-git\\-worktrees(\\s|$)", "spor_re": "(?i)(^|\\s)/spor-using\\-git\\-worktrees(\\s|$)", "prefixed_re": "(?i)superpowers:using-git-worktrees(\\s|$|[^a-zA-Z0-9_-])", "spor_prefixed_re": "(?i)superpowers-overrides:spor-using-git-worktrees(\\s|$|[^a-zA-Z0-9_-])", "attach_res": ["(?i)/skills/using\\-git\\-worktrees/SKILL\\.md$", "(?i)/plugins/superpowers/skills/using\\-git\\-worktrees/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/using\\-git\\-worktrees/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?using\\-git\\-worktrees/SKILL\\.md$", "(?i)/using-git-worktrees/SKILL\\.md$"]}, {"name": "spor-systematic-debugging", "upstream_slug": "systematic-debugging", "bare_re": "(?i)(^|\\s)/systematic\\-debugging(\\s|$)", "spor_re": "(?i)(^|\\s)/spor-systematic\\-debugging(\\s|$)", "prefixed_re": "(?i)superpowers:systematic-debugging(\\s|$|[^a-zA-Z0-9_-])", "spor_prefixed_re": "(?i)superpowers-overrides:spor-systematic-debugging(\\s|$|[^a-zA-Z0-9_-])", "attach_res": ["(?i)/skills/systematic\\-debugging/SKILL\\.md$", "(?i)/plugins/superpowers/skills/systematic\\-debugging/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/systematic\\-debugging/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?systematic\\-debugging/SKILL\\.md$", "(?i)/systematic-debugging/SKILL\\.md$"]}, {"name": "spor-test-driven-development", "upstream_slug": "test-driven-development", "bare_re": "(?i)(^|\\s)/test\\-driven\\-development(\\s|$)", "spor_re": "(?i)(^|\\s)/spor-test\\-driven\\-development(\\s|$)", "prefixed_re": "(?i)superpowers:test-driven-development(\\s|$|[^a-zA-Z0-9_-])", "spor_prefixed_re": "(?i)superpowers-overrides:spor-test-driven-development(\\s|$|[^a-zA-Z0-9_-])", "attach_res": ["(?i)/skills/test\\-driven\\-development/SKILL\\.md$", "(?i)/plugins/superpowers/skills/test\\-driven\\-development/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/test\\-driven\\-development/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?test\\-driven\\-development/SKILL\\.md$", "(?i)/test-driven-development/SKILL\\.md$"]}, {"name": "spor-verification-before-completion", "upstream_slug": "verification-before-completion", "bare_re": "(?i)(^|\\s)/verification\\-before\\-completion(\\s|$)", "spor_re": "(?i)(^|\\s)/spor-verification\\-before\\-completion(\\s|$)", "prefixed_re": "(?i)superpowers:verification-before-completion(\\s|$|[^a-zA-Z0-9_-])", "spor_prefixed_re": "(?i)superpowers-overrides:spor-verification-before-completion(\\s|$|[^a-zA-Z0-9_-])", "attach_res": ["(?i)/skills/verification\\-before\\-completion/SKILL\\.md$", "(?i)/plugins/superpowers/skills/verification\\-before\\-completion/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/verification\\-before\\-completion/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?verification\\-before\\-completion/SKILL\\.md$", "(?i)/verification-before-completion/SKILL\\.md$"]}, {"name": "spor-receiving-code-review", "upstream_slug": "receiving-code-review", "bare_re": "(?i)(^|\\s)/receiving\\-code\\-review(\\s|$)", "spor_re": "(?i)(^|\\s)/spor-receiving\\-code\\-review(\\s|$)", "prefixed_re": "(?i)superpowers:receiving-code-review(\\s|$|[^a-zA-Z0-9_-])", "spor_prefixed_re": "(?i)superpowers-overrides:spor-receiving-code-review(\\s|$|[^a-zA-Z0-9_-])", "attach_res": ["(?i)/skills/receiving\\-code\\-review/SKILL\\.md$", "(?i)/plugins/superpowers/skills/receiving\\-code\\-review/SKILL\\.md$", "(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/receiving\\-code\\-review/SKILL\\.md$", "(?i)/\\.cursor/skills/(superpowers/)?receiving\\-code\\-review/SKILL\\.md$", "(?i)/receiving-code-review/SKILL\\.md$"]}]

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
                print(json.dumps({"override": t["name"], "trigger": "attach", "session_key": key}))
                sys.exit(0)

for t in TARGETS:
    if re.search(t["prefixed_re"], prompt) or re.search(t["spor_prefixed_re"], prompt):
        print(json.dumps({"override": t["name"], "trigger": "prefixed", "session_key": key}))
        sys.exit(0)

for t in TARGETS:
    if re.search(t["spor_re"], prompt):
        print(json.dumps({"override": t["name"], "trigger": "spor-slash", "session_key": key}))
        sys.exit(0)

for t in TARGETS:
    if re.search(t["bare_re"], prompt):
        print(json.dumps({"override": t["name"], "trigger": "bare-slash", "session_key": key}))
        sys.exit(0)
PYMATCH
)

if [ -n "$match" ]; then
  override=$(printf '%s' "$match" | jq -r '.override')
  trigger=$(printf '%s' "$match" | jq -r '.trigger')
  session_key=$(printf '%s' "$match" | jq -r '.session_key')
  write_pending "$session_key" "$override" "$trigger"
fi

jq -n '{continue:true}'
