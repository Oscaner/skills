#!/bin/sh
# scripts/emit.mjs — do not edit
set -eu

if ! command -v jq >/dev/null 2>&1; then
  echo "[oscaner] WARNING: jq is required for superpowers override hooks. Install jq to enforce overrides automatically." >&2
  exit 1
fi

input=$(cat)
command_name=$(printf '%s' "$input" | jq -r '.command_name // ""')

case "$command_name" in
  superpowers:brainstorming) override="engineering:os-brainstorming" ;;
  /brainstorming) override="engineering:os-brainstorming" ;;
  superpowers:writing-plans) override="engineering:os-writing-plans" ;;
  /writing-plans) override="engineering:os-writing-plans" ;;
  superpowers:subagent-driven-development) override="engineering:cli-driven-development" ;;
  /subagent-driven-development) override="engineering:cli-driven-development" ;;
  superpowers:executing-plans) override="engineering:os-executing-plans" ;;
  /executing-plans) override="engineering:os-executing-plans" ;;
  superpowers:finishing-a-development-branch) override="engineering:os-finishing" ;;
  /finishing-a-development-branch) override="engineering:os-finishing" ;;
  superpowers:systematic-debugging) override="engineering:os-debugging" ;;
  /systematic-debugging) override="engineering:os-debugging" ;;
  superpowers:test-driven-development) override="mattpocock-skills:tdd" ;;
  /test-driven-development) override="mattpocock-skills:tdd" ;;
  superpowers:verification-before-completion) override="engineering:os-verification" ;;
  /verification-before-completion) override="engineering:os-verification" ;;
  superpowers:receiving-code-review) override="engineering:os-code-review" ;;
  /receiving-code-review) override="engineering:os-code-review" ;;
  superpowers:using-git-worktrees) override="engineering:os-finishing" ;;
  /using-git-worktrees) override="engineering:os-finishing" ;;
  *) exit 0 ;;
esac

jq -n --arg override "$override" '{
  additionalContext: ("MANDATORY OVERRIDE — oscaner hook intercepted this turn.\nYour FIRST tool call MUST be Skill(\"" + $override + "\").\nDo NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.")
}'
