#!/bin/sh
set -eu

if ! command -v jq >/dev/null 2>&1; then
  echo "[oscaner] WARNING: jq is required for superpowers override hooks. Install jq to enforce overrides automatically." >&2
  exit 1
fi

input=$(cat)
command_name=$(printf '%s' "$input" | jq -r '.command_name // ""')

case "$command_name" in
  superpowers:brainstorming) override="superpowers-overrides:brainstorming-overrides" ;;
  superpowers:writing-plans) override="superpowers-overrides:writing-plans-overrides" ;;
  superpowers:subagent-driven-development) override="superpowers-overrides:subagent-driven-development-overrides" ;;
  superpowers:executing-plans) override="superpowers-overrides:executing-plans-overrides" ;;
  superpowers:finishing-a-development-branch) override="superpowers-overrides:finishing-a-development-branch-overrides" ;;
  superpowers:using-git-worktrees) override="superpowers-overrides:using-git-worktrees-overrides" ;;
  superpowers:systematic-debugging) override="superpowers-overrides:systematic-debugging-overrides" ;;
  superpowers:test-driven-development) override="superpowers-overrides:test-driven-development-overrides" ;;
  superpowers:verification-before-completion) override="superpowers-overrides:verification-before-completion-overrides" ;;
  superpowers:receiving-code-review) override="superpowers-overrides:receiving-code-review-overrides" ;;
  *) exit 0 ;;
esac

jq -n --arg override "$override" '{
  additionalContext: ("MANDATORY OVERRIDE — oscaner hook intercepted this turn.\nYour FIRST tool call MUST be Skill(\"" + $override + "\").\nDo NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.")
}'
