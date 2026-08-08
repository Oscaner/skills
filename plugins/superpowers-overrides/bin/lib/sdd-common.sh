#!/usr/bin/env bash
# sdd-common.sh — shared SDD CLI library (superpowers-overrides p1)
# Source from harness scripts: source "$(dirname "$0")/lib/sdd-common.sh"
#
# Exit codes: 0=OK; 1=BLOCKED/stub; 2=CLI missing
#
# Workspace path contract (spec §2.2a) — orchestrator sets env paths; CLI does not read full plan:
#   SDD_WORKSPACE              <repo>/.superpowers/sdd/<plan-basename>/
#   SDD_LEDGER                 <workspace>/progress.md
#   SDD_TASK_BRIEF             <workspace>/task-N-brief.md (or batch brief)
#   SDD_HANDOFF_PATH           <workspace>/task-N-handoff.json (or batch variant)
#   SDD_PLAN_CONSTRAINTS       <workspace>/plan-constraints.md
#   SDD_FINDINGS               <workspace>/task-N-open-findings.json (fix mode)
#   SDD_REVIEW_FIXED_POINT     git ref for review/fix-loop scope (review mode)

# Resolve plugin root from a script path by walking up until .claude-plugin/plugin.json exists.
# Usage: root="$(sdd_plugin_root)"  # uses this file
#        root="$(sdd_plugin_root "$0")"  # uses caller script
sdd_plugin_root() {
  local dir="${1:-${BASH_SOURCE[0]:-$0}}"
  dir="$(cd "$(dirname "$dir")" && pwd)"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/.claude-plugin/plugin.json" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  printf 'sdd_plugin_root: no plugin root (.claude-plugin/plugin.json) found from %s\n' "${1:-${BASH_SOURCE[0]:-$0}}" >&2
  return 1
}

sdd_stderr_harness_stub() {
  printf 'HARNESS_STUB: %s\n' "$*" >&2
}

sdd_exit_ok() {
  exit 0
}

sdd_exit_blocked() {
  if [[ $# -gt 0 ]]; then
    printf 'SDD_BLOCKED: %s\n' "$*" >&2
  fi
  exit 1
}

sdd_exit_cli_missing() {
  if [[ $# -gt 0 ]]; then
    printf 'SDD_CLI_MISSING: %s\n' "$*" >&2
  fi
  exit 2
}

_sdd_sed_escape() {
  printf '%s' "$1" | sed -e 's/[\\/&]/\\&/g'
}

# Substitute {{PLACEHOLDER}} tokens in template text.
# Reads SDD_* env vars when present; empty string for unset optional placeholders.
_sdd_template_value() {
  case "$1" in
    WORKSPACE)    printf '%s' "${SDD_WORKSPACE:-}" ;;
    BRIEF)        printf '%s' "${SDD_TASK_BRIEF:-}" ;;
    HANDOFF)      printf '%s' "${SDD_HANDOFF_PATH:-}" ;;
    FINDINGS)     printf '%s' "${SDD_FINDINGS:-}" ;;
    CONSTRAINTS)  printf '%s' "${SDD_PLAN_CONSTRAINTS:-}" ;;
    FIXED_POINT)  printf '%s' "${SDD_REVIEW_FIXED_POINT:-}" ;;
    *)            return 1 ;;
  esac
}

# Render templates/sdd-cli/{name}.md with {{WORKSPACE}}, {{BRIEF}}, etc.
# Prints rendered prompt to stdout.
sdd_render_template() {
  local name="$1"
  local plugin_root template
  plugin_root="$(sdd_plugin_root "${BASH_SOURCE[0]}")" || return 1
  template="${plugin_root}/templates/sdd-cli/${name}.md"
  if [[ ! -f "$template" ]]; then
    printf 'sdd_render_template: missing template: %s\n' "$template" >&2
    return 1
  fi

  local content placeholders=(
    WORKSPACE BRIEF HANDOFF FINDINGS CONSTRAINTS FIXED_POINT
  )
  content="$(<"$template")"
  local key value escaped
  for key in "${placeholders[@]}"; do
    value="$(_sdd_template_value "$key" || true)"
    escaped="$(_sdd_sed_escape "$value")"
    content="$(printf '%s' "$content" | sed "s/{{${key}}}/${escaped}/g")"
  done
  printf '%s\n' "$content"
}

# Validate required env vars per SDD_MODE (spec §2.3 H6).
sdd_require_env() {
  local mode="${SDD_MODE:-}"
  local -a missing=()
  local var

  for var in SDD_WORKSPACE SDD_TASK_BRIEF SDD_LEDGER SDD_MODE SDD_HANDOFF_PATH SDD_PLAN_CONSTRAINTS; do
    if [[ -z "${!var:-}" ]]; then
      missing+=("$var")
    fi
  done

  case "$mode" in
    implement)
      ;;
    review)
      if [[ -z "${SDD_REVIEW_FIXED_POINT:-}" ]]; then
        missing+=(SDD_REVIEW_FIXED_POINT)
      fi
      ;;
    fix)
      if [[ -z "${SDD_FINDINGS:-}" ]]; then
        missing+=(SDD_FINDINGS)
      fi
      ;;
    '')
      missing+=(SDD_MODE)
      ;;
    *)
      sdd_exit_blocked "SDD_MODE must be implement|review|fix (got: ${mode})"
      ;;
  esac

  if ((${#missing[@]} > 0)); then
    sdd_exit_blocked "Missing required env: ${missing[*]}"
  fi
}

# Locate upstream superpowers subagent-driven-development/scripts (sdd-workspace, review-package).
# Resolution order: repo submodule → Claude plugin cache → Cursor plugin cache.
# Optional arg: repo_root (defaults to git rev-parse --show-toplevel).
sdd_superpowers_scripts_dir() {
  local repo_root="${1:-}"
  if [[ -z "$repo_root" ]]; then
    repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || repo_root=""
  fi
  if [[ -n "$repo_root" && -d "${repo_root}/plugins/superpowers/skills/subagent-driven-development/scripts" ]]; then
    printf '%s\n' "${repo_root}/plugins/superpowers/skills/subagent-driven-development/scripts"
    return 0
  fi
  local cache ver scripts probe
  for cache in \
    "${HOME}/.claude/plugins/cache/oscaner/superpowers" \
    "${HOME}/.cursor/plugins/cache/oscaner/superpowers"; do
    [[ -d "$cache" ]] || continue
    for ver in $(find "$cache" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | sort -V); do
      scripts="${cache}/${ver}/skills/subagent-driven-development/scripts"
      probe="${scripts}/sdd-workspace"
      if [[ -f "$probe" ]]; then
        printf '%s\n' "$scripts"
        return 0
      fi
    done
  done
  return 1
}
