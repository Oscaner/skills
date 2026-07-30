#!/bin/sh
set -eu

if ! command -v jq >/dev/null 2>&1; then
  echo "[oscaner] WARNING: jq is required for superpowers override hooks. Install jq to enforce overrides automatically." >&2
  exit 1
fi

input=$(cat)
command_name=$(printf '%s' "$input" | jq -r '.command_name // ""')

case "$command_name" in
  superpowers:brainstorming) override="superpowers-overrides:spor-brainstorming" ;;
  superpowers:writing-plans) override="superpowers-overrides:spor-writing-plans" ;;
  superpowers:subagent-driven-development) override="superpowers-overrides:spor-subagent-driven-development" ;;
  superpowers:executing-plans) override="superpowers-overrides:spor-executing-plans" ;;
  superpowers:finishing-a-development-branch) override="superpowers-overrides:spor-finishing-a-development-branch" ;;
  superpowers:using-git-worktrees) override="superpowers-overrides:spor-using-git-worktrees" ;;
  superpowers:systematic-debugging) override="superpowers-overrides:spor-systematic-debugging" ;;
  superpowers:test-driven-development) override="superpowers-overrides:spor-test-driven-development" ;;
  superpowers:verification-before-completion) override="superpowers-overrides:spor-verification-before-completion" ;;
  superpowers:receiving-code-review) override="superpowers-overrides:spor-receiving-code-review" ;;
  *) exit 0 ;;
esac

jq -n --arg override "$override" '{
  additionalContext: ("MANDATORY OVERRIDE — oscaner hook intercepted this turn.\nYour FIRST tool call MUST be Skill(\"" + $override + "\").\nDo NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.")
}'
