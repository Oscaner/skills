#!/bin/sh
set -eu

if ! command -v jq >/dev/null 2>&1; then
  echo "[oscaner-skills] WARNING: jq is required for superpowers override hooks. Install jq to enforce overrides automatically." >&2
  exit 1
fi

input=$(cat)
command_name=$(printf '%s' "$input" | jq -r '.command_name // ""')

case "$command_name" in
  superpowers:brainstorming)                  override="brainstorming" ;;
  superpowers:writing-plans)                  override="writing-plans" ;;
  superpowers:subagent-driven-development)    override="subagent-driven-development" ;;
  superpowers:executing-plans)                override="executing-plans" ;;
  superpowers:finishing-a-development-branch) override="finishing-a-development-branch" ;;
  superpowers:using-git-worktrees)            override="using-git-worktrees" ;;
  superpowers:systematic-debugging)           override="systematic-debugging" ;;
  superpowers:test-driven-development)        override="test-driven-development" ;;
  superpowers:verification-before-completion) override="verification-before-completion" ;;
  superpowers:receiving-code-review)          override="receiving-code-review" ;;
  *) exit 0 ;;
esac

jq -n --arg override "$override" '{
  additionalContext: ("MANDATORY OVERRIDE — oscaner-skills hook intercepted this turn.\nYour FIRST tool call MUST be Skill(\"" + $override + "\").\nDo NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.")
}'
