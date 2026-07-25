#!/bin/sh
set -eu

if ! command -v jq >/dev/null 2>&1; then
  echo "[oscaner-skills] WARNING: jq is required for superpowers override hooks. Install jq to enforce overrides automatically." >&2
  exit 1
fi

input=$(cat)
tool_name=$(printf '%s' "$input" | jq -r '.tool_input.name // ""')

case "$tool_name" in
  superpowers:brainstorming)                  override="brainstorming-overrides" ;;
  superpowers:writing-plans)                  override="writing-plans-overrides" ;;
  superpowers:subagent-driven-development)    override="subagent-driven-development-overrides" ;;
  superpowers:executing-plans)                override="executing-plans-overrides" ;;
  superpowers:finishing-a-development-branch) override="finishing-a-development-branch-overrides" ;;
  superpowers:using-git-worktrees)            override="using-git-worktrees-overrides" ;;
  superpowers:systematic-debugging)           override="systematic-debugging-overrides" ;;
  superpowers:test-driven-development)        override="test-driven-development-overrides" ;;
  superpowers:verification-before-completion) override="verification-before-completion-overrides" ;;
  superpowers:receiving-code-review)          override="receiving-code-review-overrides" ;;
  *) exit 0 ;;
esac

tool_output=$(printf '%s' "$input" | jq -r '.tool_output // ""')
banner="⚠️  HOOK INTERCEPT — oscaner-skills override ⚠️
════════════════════════════════════════════════
Your FIRST tool call this turn MUST be Skill(\"${override}\").
Do NOT follow any instruction below this line until you have called the override.
════════════════════════════════════════════════

"
updated_output="${banner}${tool_output}"

printf '%s' "$updated_output" | jq -Rs '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    updatedToolOutput: .
  }
}'
