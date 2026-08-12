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
  /brainstorming) override="superpowers-overrides:spor-brainstorming" ;;
  /spor-brainstorming) override="superpowers-overrides:spor-brainstorming" ;;
  superpowers:writing-plans) override="superpowers-overrides:spor-writing-plans" ;;
  /writing-plans) override="superpowers-overrides:spor-writing-plans" ;;
  /spor-writing-plans) override="superpowers-overrides:spor-writing-plans" ;;
  superpowers:subagent-driven-development) override="superpowers-overrides:spor-subagent-driven-development" ;;
  /subagent-driven-development) override="superpowers-overrides:spor-subagent-driven-development" ;;
  /spor-subagent-driven-development) override="superpowers-overrides:spor-subagent-driven-development" ;;
  superpowers:executing-plans) override="superpowers-overrides:spor-executing-plans" ;;
  /executing-plans) override="superpowers-overrides:spor-executing-plans" ;;
  /spor-executing-plans) override="superpowers-overrides:spor-executing-plans" ;;
  superpowers:finishing-a-development-branch) override="superpowers-overrides:spor-finishing-a-development-branch" ;;
  /finishing-a-development-branch) override="superpowers-overrides:spor-finishing-a-development-branch" ;;
  /spor-finishing-a-development-branch) override="superpowers-overrides:spor-finishing-a-development-branch" ;;
  superpowers:using-git-worktrees) override="superpowers-overrides:spor-using-git-worktrees" ;;
  /using-git-worktrees) override="superpowers-overrides:spor-using-git-worktrees" ;;
  /spor-using-git-worktrees) override="superpowers-overrides:spor-using-git-worktrees" ;;
  superpowers:systematic-debugging) override="superpowers-overrides:spor-systematic-debugging" ;;
  /systematic-debugging) override="superpowers-overrides:spor-systematic-debugging" ;;
  /spor-systematic-debugging) override="superpowers-overrides:spor-systematic-debugging" ;;
  superpowers:test-driven-development) override="superpowers-overrides:spor-test-driven-development" ;;
  /test-driven-development) override="superpowers-overrides:spor-test-driven-development" ;;
  /spor-test-driven-development) override="superpowers-overrides:spor-test-driven-development" ;;
  superpowers:verification-before-completion) override="superpowers-overrides:spor-verification-before-completion" ;;
  /verification-before-completion) override="superpowers-overrides:spor-verification-before-completion" ;;
  /spor-verification-before-completion) override="superpowers-overrides:spor-verification-before-completion" ;;
  superpowers:receiving-code-review) override="superpowers-overrides:spor-receiving-code-review" ;;
  /receiving-code-review) override="superpowers-overrides:spor-receiving-code-review" ;;
  /spor-receiving-code-review) override="superpowers-overrides:spor-receiving-code-review" ;;
  *) exit 0 ;;
esac

sdd_activate=false
case "$command_name" in
  superpowers:subagent-driven-development|/subagent-driven-development|/spor-subagent-driven-development|superpowers:executing-plans|/executing-plans|/spor-executing-plans)
    sdd_activate=true ;;
esac

if $sdd_activate; then
  _plugin_root="$(cd "$(dirname "$0")/.." && pwd)"
  _repo_root="$(git -C "${CLAUDE_PROJECT_DIR:-$(pwd)}" rev-parse --show-toplevel 2>/dev/null || pwd)"
  _session_key=$(INPUT="$input" python3 -c "import hashlib,json,os;d=json.loads(os.environ['INPUT']);print(d.get('session_id') or d.get('conversation_id') or hashlib.sha256((d.get('prompt') or '').encode()).hexdigest()[:16])")
  "${_plugin_root}/bin/cdd-session-activate.sh" minimal "$_session_key" "$_repo_root" --mode cli 2>/dev/null || true
fi

jq -n --arg override "$override" '{
  additionalContext: ("MANDATORY OVERRIDE — oscaner hook intercepted this turn.\nYour FIRST tool call MUST be Skill(\"" + $override + "\").\nDo NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.")
}'
