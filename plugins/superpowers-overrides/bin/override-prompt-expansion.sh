#!/bin/sh
set -eu

if ! command -v jq >/dev/null 2>&1; then
  echo "[oscaner] WARNING: jq is required for superpowers override hooks. Install jq to enforce overrides automatically." >&2
  exit 1
fi

input=$(cat)
command_name=$(printf '%s' "$input" | jq -r '.command_name // ""')

case "$command_name" in
  superpowers:brainstorming) override="os-engineering:os-brainstorming" ;;
  /brainstorming) override="os-engineering:os-brainstorming" ;;
  superpowers:writing-plans) override="os-engineering:os-writing-plans" ;;
  /writing-plans) override="os-engineering:os-writing-plans" ;;
  superpowers:subagent-driven-development) override="os-engineering:cli-driven-development" ;;
  /subagent-driven-development) override="os-engineering:cli-driven-development" ;;
  superpowers:executing-plans) override="os-engineering:os-executing-plans" ;;
  /executing-plans) override="os-engineering:os-executing-plans" ;;
  superpowers:finishing-a-development-branch) override="os-engineering:os-finishing" ;;
  /finishing-a-development-branch) override="os-engineering:os-finishing" ;;
  superpowers:systematic-debugging) override="os-engineering:os-debugging" ;;
  /systematic-debugging) override="os-engineering:os-debugging" ;;
  superpowers:test-driven-development) override="mattpocock-skills:tdd" ;;
  /test-driven-development) override="mattpocock-skills:tdd" ;;
  superpowers:verification-before-completion) override="os-engineering:os-verification" ;;
  /verification-before-completion) override="os-engineering:os-verification" ;;
  superpowers:receiving-code-review) override="os-engineering:os-code-review" ;;
  /receiving-code-review) override="os-engineering:os-code-review" ;;
  superpowers:using-git-worktrees) override="os-engineering:os-finishing" ;;
  /using-git-worktrees) override="os-engineering:os-finishing" ;;
  *) exit 0 ;;
esac

jq -n --arg override "$override" '{
  additionalContext: ("MANDATORY OVERRIDE — oscaner hook intercepted this turn.\nYour FIRST tool call MUST be Skill(\"" + $override + "\").\nDo NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.")
}'
