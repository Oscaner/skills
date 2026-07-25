#!/bin/sh
set -eu

if ! command -v jq >/dev/null 2>&1; then
  echo "[oscaner-skills] WARNING: jq is required for superpowers override hooks. Install jq to enforce overrides automatically." >&2
  exit 1
fi

input=$(cat)
tool_name=$(printf '%s' "$input" | jq -r '.tool_input.name // ""')

case "$tool_name" in
  superpowers:brainstorming)                  override="superpowers-overrides:brainstorming" ;;
  superpowers:writing-plans)                  override="superpowers-overrides:writing-plans" ;;
  superpowers:subagent-driven-development)    override="superpowers-overrides:subagent-driven-development" ;;
  superpowers:executing-plans)                override="superpowers-overrides:executing-plans" ;;
  superpowers:finishing-a-development-branch) override="superpowers-overrides:finishing-a-development-branch" ;;
  superpowers:using-git-worktrees)            override="superpowers-overrides:using-git-worktrees" ;;
  superpowers:systematic-debugging)           override="superpowers-overrides:systematic-debugging" ;;
  superpowers:test-driven-development)        override="superpowers-overrides:test-driven-development" ;;
  superpowers:verification-before-completion) override="superpowers-overrides:verification-before-completion" ;;
  superpowers:receiving-code-review)          override="superpowers-overrides:receiving-code-review" ;;
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
