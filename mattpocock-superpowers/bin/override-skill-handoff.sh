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
  *) exit 0 ;;
esac

printf '%s' "$input" | jq --arg override "$override" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    updatedToolOutput: ("⚠️  HOOK INTERCEPT — oscaner-skills override ⚠️\n════════════════════════════════════════════════\nYour FIRST tool call this turn MUST be Skill(\"" + $override + "\").\nDo NOT follow any instruction below this line until you have called the override.\n════════════════════════════════════════════════\n\n" + (.tool_output // ""))
  }
}'
