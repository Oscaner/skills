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

###############################################################################
# Shared task/plan run-loop (spec §4.2/§4.3 — behavior single source of truth).
# Harness shells keep only the irreducible differences: CLI invocation flags,
# review prefix parameter, plan's task-script path + label.
# Handoff write is inline in implement/review/fix — no separate handoff mode.
###############################################################################

# Render the mode template; for review with a non-empty prefix, prepend
# "<prefix>\n\n<rendered>" (harness injects Skill(...) before the prompt).
sdd_render_mode_prompt() {
  local mode="$1" review_prefix="$2"
  local rendered
  rendered="$(sdd_render_template "$mode")" || return 1
  if [[ "$mode" == "review" && -n "$review_prefix" ]]; then
    printf '%s\n\n%s' "$review_prefix" "$rendered"
  else
    printf '%s' "$rendered"
  fi
}

# CLI preflight: SDD_DRY_RUN=1 skips the PATH check (argument parsing /
# orchestration smoke tests must not require a live CLI binary).
sdd_check_cli() {
  local cli_bin="$1"
  if [[ "${SDD_DRY_RUN:-}" != "1" ]] && ! command -v "$cli_bin" >/dev/null 2>&1; then
    sdd_exit_cli_missing "${cli_bin} not found in PATH"
  fi
}

# git repo root from the caller's working tree (uses $PWD when SDD_WORKSPACE unset).
_sdd_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

_sdd_relpath_from_repo() {
  local abs="$1" root
  root="$(_sdd_repo_root)" || { printf '%s' "$abs"; return; }
  abs="$(cd "$(dirname "$abs")" && pwd)/$(basename "$abs")"
  case "$abs" in
    "${root}/"*) printf '%s' "${abs#"${root}"/}" ;;
    *) printf '%s' "$abs" ;;
  esac
}

_sdd_plan_from_ledger() {
  local ledger="$1"
  sed -n '1s/^# SDD ledger — plan: //p' "$ledger"
}

# Resolve the SDD workspace. Shared by the task path (no explicit plan-file
# arg → honor $SDD_WORKSPACE when set, else derive from $PLAN_FILE) and the
# plan path (explicit $plan_file arg → always derive from it; a pre-set
# $SDD_WORKSPACE must not redirect the plan driver to a different workspace).
_sdd_resolve_workspace() {
  local plan_file="${1:-}"
  if [[ -z "$plan_file" && -n "${SDD_WORKSPACE:-}" ]]; then
    printf '%s\n' "$SDD_WORKSPACE"
    return 0
  fi
  [[ -n "$plan_file" ]] || plan_file="${PLAN_FILE:-}"
  [[ -n "$plan_file" ]] || sdd_exit_blocked "SDD_WORKSPACE unset and --plan not provided"
  local scripts ws_script
  scripts="$(sdd_superpowers_scripts_dir)" || sdd_exit_blocked "upstream sdd-workspace script not found"
  ws_script="${scripts}/sdd-workspace"
  [[ -x "$ws_script" ]] || sdd_exit_blocked "sdd-workspace not executable: ${ws_script}"
  "$ws_script" "$plan_file"
}

_sdd_set_task_env() {
  local workspace="$1" task="$2"
  export SDD_WORKSPACE="$workspace"
  export SDD_LEDGER="${SDD_LEDGER:-${workspace}/progress.md}"
  export SDD_TASK_BRIEF="${SDD_TASK_BRIEF:-${workspace}/task-${task}-brief.md}"
  export SDD_HANDOFF_PATH="${SDD_HANDOFF_PATH:-${workspace}/task-${task}-handoff.json}"
  export SDD_PLAN_CONSTRAINTS="${SDD_PLAN_CONSTRAINTS:-${workspace}/plan-constraints.md}"
  export SDD_MODE="${SDD_MODE_ARG:-}"
  export SDD_FINDINGS="${SDD_FINDINGS:-${workspace}/task-${task}-open-findings.json}"
}

# H1 four-line return block from the agent's stdout text (legacy path).
_sdd_emit_h1_four_lines() {
  local raw="$1"
  local -a keys=(status commits artifacts blocker)
  local key line
  for key in "${keys[@]}"; do
    line="$(printf '%s\n' "$raw" | grep -E "^${key}:" | tail -1 || true)"
    if [[ -n "$line" ]]; then
      printf '%s\n' "$line"
    else
      printf '%s: <missing>\n' "$key"
    fi
  done
}

# Raw-field extractor for handoff JSON when jq is unavailable or the file
# failed jq parsing. Tolerates compact and pretty-printed JSON
# ("key": "value" or "key":"value"); prints the first match, or empty.
_sdd_raw_handoff_field() {
  local handoff="$1" key="$2"
  sed -n "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$handoff" | head -1
}

# BLOCKED fallback shared by _sdd_emit_h1_from_handoff: emits the status +
# raw-file commits + blocker when the handoff's .status can't be read via jq
# (validator rewrite failed) or jq is absent. Artifacts are not extractable in
# this degraded state.
#
# When the commit-contract validator intercepted first, it stores the real
# blocker reason in $SDD_BLOCKED_REASON (shell variable, dynamic scope) — prefer
# it over the generic fallback so the H1 contract reports the actual root cause
# (F2: no-jq/malformed no longer masks an uncommitted-changes interception).
_sdd_emit_h1_raw_blocked() {
  local blocker_msg="$1" handoff="${SDD_HANDOFF_PATH:-}"
  if [[ -n "${SDD_BLOCKED_REASON:-}" ]]; then
    blocker_msg="$SDD_BLOCKED_REASON"
  fi
  printf 'status: BLOCKED\n'
  printf 'commits: base=%s head=%s\n' \
    "$(_sdd_raw_handoff_field "$handoff" base)" \
    "$(_sdd_raw_handoff_field "$handoff" head)"
  printf 'blocker: %s\n' "$blocker_msg"
}

# H1 four-line return block from the handoff JSON (spec v3 — H1-from-handoff).
# Reads the possibly-rewritten handoff; artifacts keys omitted when absent.
# status: BLOCKED means the commit-contract validator rewrote it.
_sdd_emit_h1_from_handoff() {
  local handoff="${SDD_HANDOFF_PATH:-}"
  if [[ "${SDD_HANDOFF_UNWRITABLE:-}" == "1" ]]; then
    # Validator's jq rewrite failed (malformed JSON): the handoff still holds the
    # original .status, which the contract no longer trusts. Emit authoritative
    # BLOCKED; the raw file's commits pair is still extractable.
    _sdd_emit_h1_raw_blocked 'handoff JSON unparseable (jq rewrite failed) after commit-contract interception'
    return
  fi
  if [[ -z "$handoff" || ! -f "$handoff" ]]; then
    _sdd_emit_h1_four_lines "$(printf 'status: BLOCKED\nblocker: handoff missing after commit-contract interception\n')"
    return
  fi
  if ! command -v jq >/dev/null 2>&1; then
    # Handoff exists but jq is absent: can't parse .status/.artifacts, but the
    # commits pair is extractable from the raw JSON — degrade honestly rather
    # than claiming the handoff is unavailable (it is not).
    _sdd_emit_h1_raw_blocked 'handoff unparseable without jq after commit-contract interception'
    return
  fi
  printf 'status: %s\n' "$(jq -r '.status // "BLOCKED"' "$handoff")"
  printf 'commits: base=%s head=%s\n' \
    "$(jq -r '.commits.base // ""' "$handoff")" \
    "$(jq -r '.commits.head // ""' "$handoff")"
  local parts=()
  for key in brief report test_evidence; do
    local v
    v="$(jq -r --arg k "$key" '.artifacts[$k] // empty' "$handoff")"
    if [[ -n "$v" ]]; then
      parts+=("${key}=${v}")
    fi
  done
  if ((${#parts[@]} > 0)); then
    printf 'artifacts: %s\n' "${parts[*]}"
  fi
  printf 'blocker: %s\n' "$(jq -r '.blocker // "uncommitted changes at return"' "$handoff")"
}

_sdd_run_review_package() {
  local plan="$1" base="$2" head="$3" handoff_path="$4"
  local scripts review_pkg out_line diff_path rel
  scripts="$(sdd_superpowers_scripts_dir)" || sdd_exit_blocked "upstream review-package script not found"
  review_pkg="${scripts}/review-package"
  [[ -x "$review_pkg" ]] || sdd_exit_blocked "review-package not executable: ${review_pkg}"

  out_line="$(bash "$review_pkg" "$plan" "$base" "$head" 2>&1 | tail -1)"
  diff_path="$(printf '%s' "$out_line" | sed -n 's/^wrote \([^:]*\):.*/\1/p')"
  if [[ -z "$diff_path" || ! -f "$diff_path" ]]; then
    sdd_exit_blocked "review-package did not produce diff file (output: ${out_line})"
  fi

  if command -v jq >/dev/null 2>&1 && [[ -f "$handoff_path" ]]; then
    rel="$(_sdd_relpath_from_repo "$diff_path")"
    local tmp
    tmp="$(mktemp)"
    jq --arg diff "$rel" '.artifacts = ((.artifacts // {}) + {diff: $diff})' "$handoff_path" >"$tmp"
    mv "$tmp" "$handoff_path"
  fi

  printf '%s\n' "$out_line" >&2
}

# Rewrite the handoff to BLOCKED with <reason> as .blocker, atomically. Shared
# by both validator intercept branches (dirty tree, head mismatch). Guards on
# handoff existence + jq; a failed rewrite (malformed JSON, missing jq) is still
# authoritative BLOCKED — signal it with SDD_HANDOFF_UNWRITABLE for the H1
# emitter rather than leaking the original .status (which may say DONE).
_sdd_rewrite_handoff_blocked() {
  local reason="$1" tmp
  if [[ -f "${SDD_HANDOFF_PATH:-}" ]] && command -v jq >/dev/null 2>&1; then
    tmp="$(mktemp)"
    if jq --arg b "$reason" \
      '.status="BLOCKED" | .blocker=$b' "${SDD_HANDOFF_PATH}" >"$tmp"; then
      mv "$tmp" "${SDD_HANDOFF_PATH}"
    else
      rm -f "$tmp"
      SDD_HANDOFF_UNWRITABLE=1
    fi
  fi
}

# Core commit-contract validator (spec §4.2). Mode implement/fix only;
# review → no-op. Non-git / git-error → fail-open. Two orthogonal signals:
#   dirty working tree → captures "worker didn't commit" (D2);
#   clean tree but handoff commits.head != real HEAD → captures "worker
#   committed but recorded the wrong head" (F1 — complements, not replaces,
#   the dirty check; both rewrite the handoff + print SDD_BLOCKED + return 1).
# Untracked files count as dirty (D3b strictness); the .superpowers/ workspace
# is gitignored so it never trips the check. The real blocker reason is stored
# in $SDD_BLOCKED_REASON (shell variable) so the H1 emitter can report it even
# when the handoff rewrite failed (F2).
sdd_validate_commit_contract() {
  local mode="$1"
  SDD_HANDOFF_UNWRITABLE=""
  SDD_BLOCKED_REASON=""
  [[ "$mode" == "implement" || "$mode" == "fix" ]] || return 0
  local repo_root porcelain
  repo_root="$(git -C "${SDD_WORKSPACE:-.}" rev-parse --show-toplevel 2>/dev/null)" || return 0
  porcelain="$(git -C "$repo_root" status --porcelain 2>/dev/null)" || return 0
  if [[ -z "$porcelain" ]]; then
    # Clean tree: the dirty check can't see a head recorded wrong — verify the
    # handoff's commits.head actually matches HEAD (F1). Fail-open when there's
    # no handoff, no jq, or the head field is empty.
    if [[ -f "${SDD_HANDOFF_PATH:-}" ]] && command -v jq >/dev/null 2>&1; then
      local handoff_head actual_head
      handoff_head="$(jq -r '.commits.head // empty' "${SDD_HANDOFF_PATH}")"
      if [[ -n "$handoff_head" ]]; then
        actual_head="$(git -C "$repo_root" rev-parse HEAD 2>/dev/null)" || actual_head=""
        if [[ -n "$actual_head" && "$handoff_head" != "$actual_head" ]]; then
          SDD_BLOCKED_REASON="handoff commits.head ${handoff_head} does not match HEAD ${actual_head} (${mode})"
          _sdd_rewrite_handoff_blocked "$SDD_BLOCKED_REASON"
          printf 'SDD_BLOCKED: %s\n' "$SDD_BLOCKED_REASON" >&2
          return 1
        fi
      fi
    fi
    return 0
  fi
  # Dirty tree intercept (D2); the head-mismatch branch above is the F1
  # complement. Both rewrite via _sdd_rewrite_handoff_blocked + print SDD_BLOCKED.
  SDD_BLOCKED_REASON="uncommitted changes at return (${mode}): dirty working tree"
  _sdd_rewrite_handoff_blocked "$SDD_BLOCKED_REASON"
  printf 'SDD_BLOCKED: uncommitted changes at return (%s) — dirty working tree\n' "$mode" >&2
  return 1
}

# One SDD mode per invocation (task shell post-argparse body). Reads the
# caller shell's globals SDD_MODE_ARG / PLAN_FILE / SDD_MODE — only task_num is
# passed as a parameter (deliberate; the shell owns CLI parsing).
# Ordered contract (spec v3): CLI preflight → set env → ledger PLAN_FILE
# backfill → review fixed-point/plan validation + review-package →
# sdd_require_env → render prompt → _sdd_invoke_cli (harness-defined) →
# commit-contract validation → H1 output → agent_rc/handoff handling.
sdd_run_task() {
  local cli_bin="$1" review_prefix="$2" task_num="$3"
  local workspace agent_rc=0 agent_out=""

  sdd_check_cli "$cli_bin"

  workspace="$(_sdd_resolve_workspace)"
  _sdd_set_task_env "$workspace" "$task_num"

  if [[ -z "${PLAN_FILE:-}" && -f "${SDD_LEDGER}" ]]; then
    PLAN_FILE="$(_sdd_plan_from_ledger "${SDD_LEDGER}")"
  fi

  if [[ "${SDD_MODE_ARG:-}" == "review" ]]; then
    if [[ -z "${SDD_REVIEW_FIXED_POINT:-}" ]]; then
      if [[ -f "${SDD_HANDOFF_PATH}" ]] && command -v jq >/dev/null 2>&1; then
        SDD_REVIEW_FIXED_POINT="$(jq -r '.commits.base // empty' "${SDD_HANDOFF_PATH}")"
        export SDD_REVIEW_FIXED_POINT
      fi
    fi
    if [[ "${SDD_DRY_RUN:-}" == "1" && -z "${SDD_REVIEW_FIXED_POINT:-}" ]]; then
      SDD_REVIEW_FIXED_POINT="HEAD~1"
      export SDD_REVIEW_FIXED_POINT
    fi
    if [[ "${SDD_DRY_RUN:-}" != "1" ]]; then
      [[ -n "${PLAN_FILE:-}" ]] || sdd_exit_blocked "review mode requires plan path (ledger header or --plan)"
      [[ -f "$PLAN_FILE" ]] || sdd_exit_blocked "plan file not found: ${PLAN_FILE}"

      local review_base review_head handoff_head
      review_base="${SDD_REVIEW_FIXED_POINT:-}"
      review_head="HEAD"
      if [[ -f "${SDD_HANDOFF_PATH}" ]] && command -v jq >/dev/null 2>&1; then
        handoff_head="$(jq -r '.commits.head // empty' "${SDD_HANDOFF_PATH}")"
        [[ -n "$handoff_head" ]] && review_head="$handoff_head"
      fi
      [[ -n "$review_base" ]] || sdd_exit_blocked "review mode requires SDD_REVIEW_FIXED_POINT or handoff commits.base"

      _sdd_run_review_package "$PLAN_FILE" "$review_base" "$review_head" "${SDD_HANDOFF_PATH}"
    fi
  fi

  sdd_require_env

  local rendered prompt
  rendered="$(sdd_render_mode_prompt "${SDD_MODE_ARG}" "$review_prefix")" \
    || sdd_exit_blocked "template render failed: ${SDD_MODE_ARG}"
  prompt="$rendered"

  if [[ "${SDD_DRY_RUN:-}" == "1" ]]; then
    agent_out="$(cat <<EOF
status: DONE
commits: base=dry-run head=dry-run
artifacts: brief=${SDD_TASK_BRIEF} report=${SDD_WORKSPACE}/task-${task_num}-report.md test_evidence=${SDD_WORKSPACE}/task-${task_num}-test-evidence.json
blocker: none
EOF
)"
  else
    agent_out="$(_sdd_invoke_cli "$prompt")" || agent_rc=$?
  fi

  # Commit contract BEFORE H1: the validator may have rewritten the handoff to
  # status=BLOCKED — H1 must read that state, not the agent's stdout (spec v3).
  if sdd_validate_commit_contract "${SDD_MODE:-}"; then
    _sdd_emit_h1_four_lines "$agent_out"
  else
    _sdd_emit_h1_from_handoff
    sdd_exit_blocked   # non-zero; skips agent_rc handling
  fi

  if [[ "$agent_rc" -ne 0 ]]; then
    if [[ ! -f "${SDD_HANDOFF_PATH}" ]]; then
      sdd_exit_blocked "${cli_bin} exited ${agent_rc} and handoff missing"
    fi
    exit "$agent_rc"
  fi

  sdd_exit_ok
}

# Mode B plan driver: pending tasks × 3-mode harness chain. Reads plan file,
# writes plan constraints, runs each pending task's chain (implement → review
# → fix loop cap 5), appends ledger on APPROVED.
sdd_run_plan() {
  local plan_file="$1" task_script="$2" cli_bin="$3" label="$4"
  local workspace ledger pending_found=0

  [[ -f "$plan_file" ]] || sdd_exit_blocked "plan file not found: ${plan_file}"
  sdd_check_cli "$cli_bin"
  [[ -x "$task_script" ]] || sdd_exit_blocked "task script missing or not executable: ${task_script}"

  _sdd_write_plan_constraints() {
    local plan="$1" out="$2"
    if [[ -f "$out" ]]; then
      return 0
    fi
    awk '
      /^## Global Constraints/ { capture=1; next }
      capture && /^---$/ { exit }
      capture && /^## / { exit }
      capture { print }
    ' "$plan" >"$out"
  }

  _task_numbers_from_plan() {
    grep -E '^### Task [0-9]+:' "$plan_file" | sed -E 's/^### Task ([0-9]+):.*/\1/' | sort -n
  }

  _ledger_complete() {
    local n="$1" ledger="$2"
    grep -qE "^Task ${n}: complete" "$ledger"
  }

  _handoff_status() {
    local handoff="$1"
    if [[ ! -f "$handoff" ]]; then
      printf 'MISSING\n'
      return
    fi
    if command -v jq >/dev/null 2>&1; then
      jq -r '.status // "UNKNOWN"' "$handoff"
    else
      printf 'UNKNOWN\n'
    fi
  }

  _task_pending() {
    local n="$1" ledger="$2" handoff="$3"
    if _ledger_complete "$n" "$ledger"; then
      return 1
    fi
    local st
    st="$(_handoff_status "$handoff")"
    [[ "$st" != "APPROVED" ]]
  }

  _run_task_mode() {
    local task="$1" mode="$2"
    local -a cmd=("$task_script" --task "$task" --mode "$mode" --plan "$plan_file")
    "${cmd[@]}"
  }

  _append_ledger() {
    local n="$1" ledger="$2" handoff="$3"
    local base head deferred deferred_count oneline
    if ! command -v jq >/dev/null 2>&1; then
      printf '\nTask %s: complete (commits unknown..unknown, deferred not enumerated — jq missing)\n' "$n" >>"$ledger"
      return
    fi
    base="$(jq -r '.commits.base // "unknown"' "$handoff")"
    head="$(jq -r '.commits.head // "unknown"' "$handoff")"
    base="${base:0:7}"
    head="${head:0:7}"
    # .findings // [] keeps the expression total for legacy APPROVED handoffs that
    # predate the findings key (F5b locks this) — "Cannot iterate over null" would
    # otherwise yield a malformed "deferred: " ledger line. jq errors are silent
    # (2>/dev/null): a deferred count of 0 then falls through to "review clean".
    deferred="$(jq -c '[.findings // [] | .[] | select(.deferred == true)]' "$handoff" 2>/dev/null)"
    if [[ "$deferred" != "[]" ]]; then
      deferred_count="$(jq -r 'length' <<<"$deferred")"
      oneline="$(jq -r 'map(.summary) | join("; ")' <<<"$deferred")"
      printf '\nTask %s: complete (commits %s..%s, %s deferred: %s)\n' "$n" "$base" "$head" "$deferred_count" "$oneline" >>"$ledger"
    else
      printf '\nTask %s: complete (commits %s..%s, review clean)\n' "$n" "$base" "$head" >>"$ledger"
    fi
  }

  _run_task_chain() {
    local n="$1" workspace="$2" ledger="$3"
    local handoff="${workspace}/task-${n}-handoff.json"
    local findings="${workspace}/task-${n}-open-findings.json"
    local review_base fix_base status fix_round=0

    # _sdd_set_task_env only defaults unset vars (task-path contract: respect
    # explicitly-provided env); the plan chain must force the workspace-derived
    # paths, so clear any pre-existing values first.
    unset SDD_LEDGER SDD_TASK_BRIEF SDD_HANDOFF_PATH SDD_PLAN_CONSTRAINTS SDD_FINDINGS
    _sdd_set_task_env "$workspace" "$n"
    unset SDD_REVIEW_FIXED_POINT

    [[ -f "${SDD_TASK_BRIEF}" ]] || sdd_exit_blocked "task brief missing: ${SDD_TASK_BRIEF}"

    _run_task_mode "$n" implement

    if [[ -f "$handoff" ]] && command -v jq >/dev/null 2>&1; then
      review_base="$(jq -r '.commits.base // empty' "$handoff")"
    else
      review_base=""
    fi
    [[ -n "$review_base" ]] || sdd_exit_blocked "handoff missing commits.base after implement (task ${n})"
    export SDD_REVIEW_FIXED_POINT="$review_base"

    _run_task_mode "$n" review

    while true; do
      status="$(_handoff_status "$handoff")"
      case "$status" in
        APPROVED)
          _append_ledger "$n" "$ledger" "$handoff"
          return 0
          ;;
        BLOCKED|NEEDS_CONTEXT)
          sdd_exit_blocked "task ${n} handoff status ${status}"
          ;;
        CHANGES_REQUESTED)
          fix_round=$((fix_round + 1))
          if (( fix_round > 5 )); then
            sdd_exit_blocked "task ${n}: fix round cap exceeded (H4)"
          fi
          if [[ -f "$handoff" ]] && command -v jq >/dev/null 2>&1; then
            fix_base="$(jq -r '.commits.head // empty' "$handoff")"
          else
            fix_base=""
          fi
          [[ -n "$fix_base" ]] || sdd_exit_blocked "task ${n}: cannot determine FIX_BASE for fix loop"
          export SDD_REVIEW_FIXED_POINT="$fix_base"
          export SDD_FINDINGS="$findings"
          _run_task_mode "$n" fix
          _run_task_mode "$n" review
          ;;
        *)
          sdd_exit_blocked "task ${n}: unexpected handoff status ${status}"
          ;;
      esac
    done
  }

  workspace="$(_sdd_resolve_workspace "$plan_file")"
  ledger="${workspace}/progress.md"
  [[ -f "$ledger" ]] || sdd_exit_blocked "ledger missing: ${ledger}"

  _sdd_write_plan_constraints "$plan_file" "${workspace}/plan-constraints.md"

  local task_num handoff
  while IFS= read -r task_num; do
    [[ -n "$task_num" ]] || continue
    [[ "$task_num" == "0" ]] && continue
    handoff="${workspace}/task-${task_num}-handoff.json"
    if _task_pending "$task_num" "$ledger" "$handoff"; then
      pending_found=1
      _run_task_chain "$task_num" "$workspace" "$ledger"
    fi
  done < <(_task_numbers_from_plan)

  if [[ "$pending_found" -eq 0 ]]; then
    printf 'sdd-run-plan-%s: no pending tasks\n' "$label" >&2
  fi

  sdd_exit_ok
}
