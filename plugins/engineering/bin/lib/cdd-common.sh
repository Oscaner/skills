#!/usr/bin/env bash
# cdd-common.sh — shared CDD CLI library (engineering p1)
# Source from harness scripts: source "$(dirname "$0")/lib/cdd-common.sh"
#
# Exit codes: 0=OK; 1=BLOCKED/stub; 2=CLI missing
#
# Workspace path contract (spec §2.2a) — orchestrator sets env paths; CLI does not read full plan:
#   CDD_WORKSPACE              <repo>/.superpowers/cdd/<plan-basename>/
#   CDD_LEDGER                 <workspace>/progress.md
#   CDD_TASK_BRIEF             <workspace>/task-N-brief.md (or batch brief)
#   CDD_HANDOFF_PATH           <workspace>/task-N-handoff.json (or batch variant)
#   CDD_PLAN_CONSTRAINTS       <workspace>/plan-constraints.md
#   CDD_FINDINGS               <workspace>/task-N-open-findings.json (fix mode)
#   CDD_REVIEW_FIXED_POINT     git ref for review/fix-loop scope (review mode)

# Resolve plugin root from a script path by walking up until .claude-plugin/plugin.json exists.
# Usage: root="$(cdd_plugin_root)"  # uses this file
#        root="$(cdd_plugin_root "$0")"  # uses caller script
cdd_plugin_root() {
  local dir="${1:-${BASH_SOURCE[0]:-$0}}"
  dir="$(cd "$(dirname "$dir")" && pwd)"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/.claude-plugin/plugin.json" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  printf 'cdd_plugin_root: no plugin root (.claude-plugin/plugin.json) found from %s\n' "${1:-${BASH_SOURCE[0]:-$0}}" >&2
  return 1
}

cdd_stderr_harness_stub() {
  printf 'HARNESS_STUB: %s\n' "$*" >&2
}

cdd_exit_ok() {
  exit 0
}

cdd_exit_blocked() {
  if [[ $# -gt 0 ]]; then
    printf 'CDD_BLOCKED: %s\n' "$*" >&2
  fi
  exit 1
}

cdd_exit_cli_missing() {
  if [[ $# -gt 0 ]]; then
    printf 'CDD_CLI_MISSING: %s\n' "$*" >&2
  fi
  exit 2
}

_cdd_sed_escape() {
  printf '%s' "$1" | sed -e 's/[\\/&]/\\&/g'
}

# Substitute {{PLACEHOLDER}} tokens in template text.
# Reads CDD_* env vars when present; empty string for unset optional placeholders.
_cdd_template_value() {
  case "$1" in
    WORKSPACE)    printf '%s' "${CDD_WORKSPACE:-}" ;;
    BRIEF)        printf '%s' "${CDD_TASK_BRIEF:-}" ;;
    HANDOFF)      printf '%s' "${CDD_HANDOFF_PATH:-}" ;;
    FINDINGS)     printf '%s' "${CDD_FINDINGS:-}" ;;
    CONSTRAINTS)  printf '%s' "${CDD_PLAN_CONSTRAINTS:-}" ;;
    FIXED_POINT)  printf '%s' "${CDD_REVIEW_FIXED_POINT:-}" ;;
    *)            return 1 ;;
  esac
}

# Render templates/cdd/{name}.md with {{WORKSPACE}}, {{BRIEF}}, etc.
# Prints rendered prompt to stdout.
cdd_render_template() {
  local name="$1"
  local plugin_root template
  plugin_root="$(cdd_plugin_root "${BASH_SOURCE[0]}")" || return 1
  template="${plugin_root}/templates/cdd/${name}.md"
  if [[ ! -f "$template" ]]; then
    printf 'cdd_render_template: missing template: %s\n' "$template" >&2
    return 1
  fi

  local content placeholders=(
    WORKSPACE BRIEF HANDOFF FINDINGS CONSTRAINTS FIXED_POINT
  )
  content="$(<"$template")"
  local key value escaped
  for key in "${placeholders[@]}"; do
    value="$(_cdd_template_value "$key" || true)"
    escaped="$(_cdd_sed_escape "$value")"
    content="$(printf '%s' "$content" | sed "s/{{${key}}}/${escaped}/g")"
  done
  printf '%s\n' "$content"
}

# Validate required env vars per CDD_MODE (spec §2.3 H6).
cdd_require_env() {
  local mode="${CDD_MODE:-}"
  local -a missing=()
  local var

  for var in CDD_WORKSPACE CDD_TASK_BRIEF CDD_LEDGER CDD_MODE CDD_HANDOFF_PATH CDD_PLAN_CONSTRAINTS; do
    if [[ -z "${!var:-}" ]]; then
      missing+=("$var")
    fi
  done

  case "$mode" in
    implement)
      ;;
    review)
      if [[ -z "${CDD_REVIEW_FIXED_POINT:-}" ]]; then
        missing+=(CDD_REVIEW_FIXED_POINT)
      fi
      ;;
    fix)
      if [[ -z "${CDD_FINDINGS:-}" ]]; then
        missing+=(CDD_FINDINGS)
      fi
      ;;
    '')
      missing+=(CDD_MODE)
      ;;
    *)
      cdd_exit_blocked "CDD_MODE must be implement|review|fix (got: ${mode})"
      ;;
  esac

  if ((${#missing[@]} > 0)); then
    cdd_exit_blocked "Missing required env: ${missing[*]}"
  fi
}

# Locate upstream superpowers subagent-driven-development/scripts (review-package,
# task-brief). sdd-workspace is no longer called — only probed for existence to
# confirm the scripts dir is present.
# Resolution order: repo submodule → Claude plugin cache → Cursor plugin cache.
# Optional arg: repo_root (defaults to git rev-parse --show-toplevel).
cdd_superpowers_scripts_dir() {
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
# Harness shells keep only the irreducible difference: the harness name
# (registry drives CLI invocation flags + review prefix).
# Handoff write is inline in implement/review/fix — no separate handoff mode.
###############################################################################

# Render the mode template. Review-prefix composition (Skill(...) injection)
# moved to _cdd_invoke_cli (registry review_prefix field) — this renders the
# template alone.
cdd_render_mode_prompt() {
  local mode="$1"
  local rendered
  rendered="$(cdd_render_template "$mode")" || return 1
  printf '%s' "$rendered"
}

# CLI preflight: CDD_DRY_RUN=1 skips the PATH check (argument parsing /
# orchestration smoke tests must not require a live CLI binary).
cdd_check_cli() {
  local cli_bin="$1"
  if [[ "${CDD_DRY_RUN:-}" != "1" ]] && ! command -v "$cli_bin" >/dev/null 2>&1; then
    cdd_exit_cli_missing "${cli_bin} not found in PATH"
  fi
}

# Registry ship gate BEFORE CLI preflight (D6-A1): an unknown harness name or a
# not-supported harness must BLOCK (exit 1) regardless of whether the binary
# exists — the exit-2 CLI_MISSING path is reserved for a *full* harness whose
# binary is absent. Unknown harness → "unknown harness"; not-supported harness →
# "harness not supported: <name>"; only then cdd_check_cli on the real cli_bin.
# Prints the resolved cli_bin for the caller.
cdd_check_harness() {
  local harness="$1" ship cli
  ship="$(_cdd_registry_field "$harness" ship)"
  [[ -n "$ship" ]] || cdd_exit_blocked "unknown harness: ${harness}"
  [[ "$ship" == "full" ]] || cdd_exit_blocked "harness not supported: ${harness}"
  cli="$(_cdd_registry_field "$harness" cli)"
  [[ -n "$cli" ]] || cdd_exit_blocked "unknown harness: ${harness}"
  cdd_check_cli "$cli"
  printf '%s\n' "$cli"
}

# Registry: harness field lookup from bin/harness-registry.json (engineering).
# cdd_plugin_root resolves the plugin root from this file's location.
_cdd_registry() {
  local root
  root="$(cdd_plugin_root)" || cdd_exit_blocked "engineering plugin root not found"
  printf '%s\n' "${root}/bin/harness-registry.json"
}

# Read a harness field from the registry (cli / invoke / output / review_prefix / ship).
_cdd_registry_field() {
  local harness="$1" field="$2" reg
  reg="$(_cdd_registry)"
  jq -r --arg h "$harness" --arg f "$field" '.[$h][$f] // empty' "$reg"
}

# Registry-driven CLI invocation: build <cli> <invoke> "$prompt_arg" (review
# prepends "$review_prefix "), normalize stdout by output mode
# (text passthrough / stream-json → last completion.finalText).
_cdd_invoke_cli() {
  local prompt="$1"
  local harness="${CDD_HARNESS:?}"
  local cli invoke output review_prefix ship prompt_arg out raw
  ship="$(_cdd_registry_field "$harness" ship)"
  [[ "$ship" == "full" ]] || cdd_exit_blocked "harness not supported: ${harness}"
  cli="$(_cdd_registry_field "$harness" cli)"
  invoke="$(_cdd_registry_field "$harness" invoke)"
  output="$(_cdd_registry_field "$harness" output)"
  review_prefix="$(_cdd_registry_field "$harness" review_prefix)"
  [[ -n "$cli" ]] || cdd_exit_blocked "unknown harness: ${harness}"
  if [[ "${CDD_MODE:-}" == "review" && -n "$review_prefix" ]]; then
    prompt_arg="${review_prefix} ${prompt}"
  else
    prompt_arg="$prompt"
  fi
  # invoke is a whitespace flags template — intentional word-split (registry-controlled).
  # shellcheck disable=SC2086
  out="$($cli $invoke "$prompt_arg" 2>/dev/null)" || return $?
  if [[ "$output" == "stream-json" ]]; then
    # Keep the FULL finalText of the LAST completion event. A plain
    # `| tail -1` would cut a multi-line H1 block to its last line — every
    # earlier H1 key then emits <missing> (droid agents write the four-line
    # contract as one finalText). Slurp the stream, take the last completion's
    # text verbatim; empty result → no completion event.
    raw="$(printf '%s\n' "$out" | jq -rs '[.[] | select(.type=="completion" and (.finalText != null)) | .finalText] | last // empty' 2>/dev/null || true)"
    if [[ -z "$raw" ]]; then
      printf 'stream-json: no completion event\nraw head:\n%s\n' "$(printf '%s\n' "$out" | head -5)" >&2
      cdd_exit_blocked "stream-json produced no completion finalText"
    fi
    printf '%s\n' "$raw"
  else
    printf '%s\n' "$out"
  fi
}

# git repo root from the caller's working tree (uses $PWD when CDD_WORKSPACE unset).
_cdd_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

_cdd_relpath_from_repo() {
  local abs="$1" root
  root="$(_cdd_repo_root)" || { printf '%s' "$abs"; return; }
  abs="$(cd "$(dirname "$abs")" && pwd)/$(basename "$abs")"
  case "$abs" in
    "${root}/"*) printf '%s' "${abs#"${root}"/}" ;;
    *) printf '%s' "$abs" ;;
  esac
}

_cdd_plan_from_ledger() {
  local ledger="$1"
  sed -n '1s/^# CDD ledger — plan: //p' "$ledger"
}

# Resolve the CDD workspace. Shared by the task path (no explicit plan-file
# arg → honor $CDD_WORKSPACE when set, else derive from $PLAN_FILE) and the
# plan path (explicit $plan_file arg → always derive from it; a pre-set
# $CDD_WORKSPACE must not redirect the plan driver to a different workspace).
#
# Inline derivation (no upstream sdd-workspace call): workspace lives at
# <repo>/.superpowers/cdd/<plan-basename>/ — created on first use.
_cdd_resolve_workspace() {
  local plan_file="${1:-}"
  if [[ -z "$plan_file" && -n "${CDD_WORKSPACE:-}" ]]; then
    printf '%s\n' "$CDD_WORKSPACE"
    return 0
  fi
  [[ -n "$plan_file" ]] || plan_file="${PLAN_FILE:-}"
  [[ -n "$plan_file" ]] || cdd_exit_blocked "CDD_WORKSPACE unset and --plan not provided"
  [[ -f "$plan_file" ]] || cdd_exit_blocked "plan file not found: ${plan_file}"
  local slug root base dir
  slug="$(basename "$plan_file" .md)"
  [[ -n "$slug" && "$slug" != "." && "$slug" != ".." ]] \
    || cdd_exit_blocked "cannot derive workspace name from: ${plan_file}"
  root="$(git rev-parse --show-toplevel 2>/dev/null)" \
    || cdd_exit_blocked "not in a git repo"
  base="$root/.superpowers/cdd"
  dir="$base/$slug"
  mkdir -p "$dir"
  printf '*\n' > "$base/.gitignore"
  printf '%s\n' "$dir"
}

_cdd_set_task_env() {
  local workspace="$1" task="$2"
  export CDD_WORKSPACE="$workspace"
  export CDD_LEDGER="${CDD_LEDGER:-${workspace}/progress.md}"
  export CDD_TASK_BRIEF="${CDD_TASK_BRIEF:-${workspace}/task-${task}-brief.md}"
  export CDD_HANDOFF_PATH="${CDD_HANDOFF_PATH:-${workspace}/task-${task}-handoff.json}"
  export CDD_PLAN_CONSTRAINTS="${CDD_PLAN_CONSTRAINTS:-${workspace}/plan-constraints.md}"
  export CDD_MODE="${CDD_MODE_ARG:-}"
  export CDD_FINDINGS="${CDD_FINDINGS:-${workspace}/task-${task}-open-findings.json}"
}

# H1 four-line return block from the agent's stdout text (legacy path).
_cdd_emit_h1_four_lines() {
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
_cdd_raw_handoff_field() {
  local handoff="$1" key="$2"
  sed -n "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$handoff" | head -1
}

# BLOCKED fallback shared by _cdd_emit_h1_from_handoff: emits the status +
# raw-file commits + blocker when the handoff's .status can't be read via jq
# (validator rewrite failed) or jq is absent. Artifacts are not extractable in
# this degraded state.
#
# When the commit-contract validator intercepted first, it stores the real
# blocker reason in $CDD_BLOCKED_REASON (shell variable, dynamic scope) — prefer
# it over the generic fallback so the H1 contract reports the actual root cause
# (F2: no-jq/malformed no longer masks an uncommitted-changes interception).
_cdd_emit_h1_raw_blocked() {
  local blocker_msg="$1" handoff="${CDD_HANDOFF_PATH:-}"
  if [[ -n "${CDD_BLOCKED_REASON:-}" ]]; then
    blocker_msg="$CDD_BLOCKED_REASON"
  fi
  printf 'status: BLOCKED\n'
  printf 'commits: base=%s head=%s\n' \
    "$(_cdd_raw_handoff_field "$handoff" base)" \
    "$(_cdd_raw_handoff_field "$handoff" head)"
  printf 'blocker: %s\n' "$blocker_msg"
}

# H1 four-line return block from the handoff JSON (spec v3 — H1-from-handoff).
# Reads the possibly-rewritten handoff; artifacts keys omitted when absent.
# status: BLOCKED means the commit-contract validator rewrote it.
_cdd_emit_h1_from_handoff() {
  local handoff="${CDD_HANDOFF_PATH:-}"
  if [[ "${CDD_HANDOFF_UNWRITABLE:-}" == "1" ]]; then
    # Validator's jq rewrite failed (malformed JSON): the handoff still holds the
    # original .status, which the contract no longer trusts. Emit authoritative
    # BLOCKED; the raw file's commits pair is still extractable.
    _cdd_emit_h1_raw_blocked 'handoff JSON unparseable (jq rewrite failed) after commit-contract interception'
    return
  fi
  if [[ -z "$handoff" || ! -f "$handoff" ]]; then
    _cdd_emit_h1_four_lines "$(printf 'status: BLOCKED\nblocker: handoff missing after commit-contract interception\n')"
    return
  fi
  if ! command -v jq >/dev/null 2>&1; then
    # Handoff exists but jq is absent: can't parse .status/.artifacts, but the
    # commits pair is extractable from the raw JSON — degrade honestly rather
    # than claiming the handoff is unavailable (it is not).
    _cdd_emit_h1_raw_blocked 'handoff unparseable without jq after commit-contract interception'
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

_cdd_run_review_package() {
  local plan="$1" base="$2" head="$3" handoff_path="$4"
  local scripts review_pkg out_line diff_path rel
  scripts="$(cdd_superpowers_scripts_dir)" || cdd_exit_blocked "upstream review-package script not found"
  review_pkg="${scripts}/review-package"
  [[ -x "$review_pkg" ]] || cdd_exit_blocked "review-package not executable: ${review_pkg}"

  out_line="$(bash "$review_pkg" "$plan" "$base" "$head" 2>&1 | tail -1)"
  diff_path="$(printf '%s' "$out_line" | sed -n 's/^wrote \([^:]*\):.*/\1/p')"
  if [[ -z "$diff_path" || ! -f "$diff_path" ]]; then
    cdd_exit_blocked "review-package did not produce diff file (output: ${out_line})"
  fi

  if command -v jq >/dev/null 2>&1 && [[ -f "$handoff_path" ]]; then
    rel="$(_cdd_relpath_from_repo "$diff_path")"
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
# authoritative BLOCKED — signal it with CDD_HANDOFF_UNWRITABLE for the H1
# emitter rather than leaking the original .status (which may say DONE).
_cdd_rewrite_handoff_blocked() {
  local reason="$1" tmp
  if [[ -f "${CDD_HANDOFF_PATH:-}" ]] && command -v jq >/dev/null 2>&1; then
    tmp="$(mktemp)"
    if jq --arg b "$reason" \
      '.status="BLOCKED" | .blocker=$b' "${CDD_HANDOFF_PATH}" >"$tmp"; then
      mv "$tmp" "${CDD_HANDOFF_PATH}"
    else
      rm -f "$tmp"
      CDD_HANDOFF_UNWRITABLE=1
    fi
  fi
}

# Core commit-contract validator (spec §4.2). Mode implement/fix only;
# review → no-op. Non-git / git-error → fail-open. Two orthogonal signals:
#   dirty working tree → captures "worker didn't commit" (D2);
#   clean tree but handoff commits.head != real HEAD → captures "worker
#   committed but recorded the wrong head" (F1 — complements, not replaces,
#   the dirty check; both rewrite the handoff + print CDD_BLOCKED + return 1).
# Untracked files count as dirty (D3b strictness); the .superpowers/ workspace
# is gitignored so it never trips the check. The real blocker reason is stored
# in $CDD_BLOCKED_REASON (shell variable) so the H1 emitter can report it even
# when the handoff rewrite failed (F2).
cdd_validate_commit_contract() {
  local mode="$1"
  CDD_HANDOFF_UNWRITABLE=""
  CDD_BLOCKED_REASON=""
  [[ "$mode" == "implement" || "$mode" == "fix" ]] || return 0
  local repo_root porcelain
  repo_root="$(git -C "${CDD_WORKSPACE:-.}" rev-parse --show-toplevel 2>/dev/null)" || return 0
  porcelain="$(git -C "$repo_root" status --porcelain 2>/dev/null)" || return 0
  if [[ -z "$porcelain" ]]; then
    # Clean tree: the dirty check can't see a head recorded wrong — verify the
    # handoff's commits.head actually matches HEAD (F1). Fail-open when there's
    # no handoff, no jq, or the head field is empty.
    if [[ -f "${CDD_HANDOFF_PATH:-}" ]] && command -v jq >/dev/null 2>&1; then
      local handoff_head actual_head
      handoff_head="$(jq -r '.commits.head // empty' "${CDD_HANDOFF_PATH}")"
      if [[ -n "$handoff_head" ]]; then
        actual_head="$(git -C "$repo_root" rev-parse HEAD 2>/dev/null)" || actual_head=""
        if [[ -n "$actual_head" && "$handoff_head" != "$actual_head" ]]; then
          CDD_BLOCKED_REASON="handoff commits.head ${handoff_head} does not match HEAD ${actual_head} (${mode})"
          _cdd_rewrite_handoff_blocked "$CDD_BLOCKED_REASON"
          printf 'CDD_BLOCKED: %s\n' "$CDD_BLOCKED_REASON" >&2
          return 1
        fi
      fi
    fi
    return 0
  fi
  # Dirty tree intercept (D2); the head-mismatch branch above is the F1
  # complement. Both rewrite via _cdd_rewrite_handoff_blocked + print CDD_BLOCKED.
  CDD_BLOCKED_REASON="uncommitted changes at return (${mode}): dirty working tree"
  _cdd_rewrite_handoff_blocked "$CDD_BLOCKED_REASON"
  printf 'CDD_BLOCKED: uncommitted changes at return (%s) — dirty working tree\n' "$mode" >&2
  return 1
}

# One CDD mode per invocation (task shell post-argparse body). Reads the
# caller shell's globals CDD_MODE_ARG / PLAN_FILE / CDD_MODE — only task_num is
# passed as a parameter (deliberate; the shell owns CLI parsing).
# Arg order: cdd_run_task <harness> <task_num>.
# Ordered contract (spec v3): registry ship gate → CLI preflight → set env →
# ledger PLAN_FILE backfill → review fixed-point/plan validation + review-package →
# cdd_require_env → render prompt → _cdd_invoke_cli (registry-driven) →
# commit-contract validation → H1 output → agent_rc/handoff handling.
cdd_run_task() {
  local harness="$1" task_num="$2"
  local workspace agent_rc=0 agent_out=""
  local cli_bin

  export CDD_HARNESS="$harness"
  # Registry ship gate first: unknown / not-supported harness → BLOCKED (exit 1)
  # before any CLI PATH check (D6-A1). cdd_check_harness prints the resolved cli.
  cli_bin="$(cdd_check_harness "$harness")"

  workspace="$(_cdd_resolve_workspace)"
  _cdd_set_task_env "$workspace" "$task_num"

  if [[ -z "${PLAN_FILE:-}" && -f "${CDD_LEDGER}" ]]; then
    PLAN_FILE="$(_cdd_plan_from_ledger "${CDD_LEDGER}")"
  fi

  if [[ "${CDD_MODE_ARG:-}" == "review" ]]; then
    if [[ -z "${CDD_REVIEW_FIXED_POINT:-}" ]]; then
      if [[ -f "${CDD_HANDOFF_PATH}" ]] && command -v jq >/dev/null 2>&1; then
        CDD_REVIEW_FIXED_POINT="$(jq -r '.commits.base // empty' "${CDD_HANDOFF_PATH}")"
        export CDD_REVIEW_FIXED_POINT
      fi
    fi
    if [[ "${CDD_DRY_RUN:-}" == "1" && -z "${CDD_REVIEW_FIXED_POINT:-}" ]]; then
      CDD_REVIEW_FIXED_POINT="HEAD~1"
      export CDD_REVIEW_FIXED_POINT
    fi
    if [[ "${CDD_DRY_RUN:-}" != "1" ]]; then
      [[ -n "${PLAN_FILE:-}" ]] || cdd_exit_blocked "review mode requires plan path (ledger header or --plan)"
      [[ -f "$PLAN_FILE" ]] || cdd_exit_blocked "plan file not found: ${PLAN_FILE}"

      local review_base review_head handoff_head
      review_base="${CDD_REVIEW_FIXED_POINT:-}"
      review_head="HEAD"
      if [[ -f "${CDD_HANDOFF_PATH}" ]] && command -v jq >/dev/null 2>&1; then
        handoff_head="$(jq -r '.commits.head // empty' "${CDD_HANDOFF_PATH}")"
        [[ -n "$handoff_head" ]] && review_head="$handoff_head"
      fi
      [[ -n "$review_base" ]] || cdd_exit_blocked "review mode requires CDD_REVIEW_FIXED_POINT or handoff commits.base"

      _cdd_run_review_package "$PLAN_FILE" "$review_base" "$review_head" "${CDD_HANDOFF_PATH}"
    fi
  fi

  cdd_require_env

  local rendered prompt
  rendered="$(cdd_render_mode_prompt "${CDD_MODE_ARG}")" \
    || cdd_exit_blocked "template render failed: ${CDD_MODE_ARG}"
  prompt="$rendered"

  if [[ "${CDD_DRY_RUN:-}" == "1" ]]; then
    agent_out="$(cat <<EOF
status: DONE
commits: base=dry-run head=dry-run
artifacts: brief=${CDD_TASK_BRIEF} report=${CDD_WORKSPACE}/task-${task_num}-report.md test_evidence=${CDD_WORKSPACE}/task-${task_num}-test-evidence.json
blocker: none
EOF
)"
  else
    agent_out="$(_cdd_invoke_cli "$prompt")" || agent_rc=$?
  fi

  # Commit contract BEFORE H1: the validator may have rewritten the handoff to
  # status=BLOCKED — H1 must read that state, not the agent's stdout (spec v3).
  if cdd_validate_commit_contract "${CDD_MODE:-}"; then
    _cdd_emit_h1_four_lines "$agent_out"
  else
    _cdd_emit_h1_from_handoff
    cdd_exit_blocked   # non-zero; skips agent_rc handling
  fi

  if [[ "$agent_rc" -ne 0 ]]; then
    if [[ ! -f "${CDD_HANDOFF_PATH}" ]]; then
      cdd_exit_blocked "${cli_bin} exited ${agent_rc} and handoff missing"
    fi
    exit "$agent_rc"
  fi

  cdd_exit_ok
}

# Mode B plan driver: pending tasks × 3-mode harness chain. Reads plan file,
# writes plan constraints, runs each pending task's chain (implement → review
# → fix loop cap 5), appends ledger on APPROVED.
# Arg order: cdd_run_plan <plan_file> <harness>.
cdd_run_plan() {
  local plan_file="$1" harness="$2"
  local workspace ledger pending_found=0
  local cli_bin

  [[ -f "$plan_file" ]] || cdd_exit_blocked "plan file not found: ${plan_file}"
  # Registry ship gate first (D6-A1), same as cdd_run_task.
  cli_bin="$(cdd_check_harness "$harness")"

  _cdd_write_plan_constraints() {
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
    export CDD_MODE_ARG="$mode"
    # Subshell contains cdd_run_task's exit(0) — cdd_run_task is a task-shell
    # entry point (Mode A), not a library call; the plan loop must survive it.
    ( cdd_run_task "$harness" "$task" )
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

    # _cdd_set_task_env only defaults unset vars (task-path contract: respect
    # explicitly-provided env); the plan chain must force the workspace-derived
    # paths, so clear any pre-existing values first.
    unset CDD_LEDGER CDD_TASK_BRIEF CDD_HANDOFF_PATH CDD_PLAN_CONSTRAINTS CDD_FINDINGS
    _cdd_set_task_env "$workspace" "$n"
    unset CDD_REVIEW_FIXED_POINT

    [[ -f "${CDD_TASK_BRIEF}" ]] || cdd_exit_blocked "task brief missing: ${CDD_TASK_BRIEF}"

    _run_task_mode "$n" implement

    if [[ -f "$handoff" ]] && command -v jq >/dev/null 2>&1; then
      review_base="$(jq -r '.commits.base // empty' "$handoff")"
    else
      review_base=""
    fi
    [[ -n "$review_base" ]] || cdd_exit_blocked "handoff missing commits.base after implement (task ${n})"
    export CDD_REVIEW_FIXED_POINT="$review_base"

    _run_task_mode "$n" review

    while true; do
      status="$(_handoff_status "$handoff")"
      case "$status" in
        APPROVED)
          _append_ledger "$n" "$ledger" "$handoff"
          return 0
          ;;
        BLOCKED|NEEDS_CONTEXT)
          cdd_exit_blocked "task ${n} handoff status ${status}"
          ;;
        CHANGES_REQUESTED)
          fix_round=$((fix_round + 1))
          if (( fix_round > 5 )); then
            cdd_exit_blocked "task ${n}: fix round cap exceeded (H4)"
          fi
          if [[ -f "$handoff" ]] && command -v jq >/dev/null 2>&1; then
            fix_base="$(jq -r '.commits.head // empty' "$handoff")"
          else
            fix_base=""
          fi
          [[ -n "$fix_base" ]] || cdd_exit_blocked "task ${n}: cannot determine FIX_BASE for fix loop"
          export CDD_REVIEW_FIXED_POINT="$fix_base"
          export CDD_FINDINGS="$findings"
          _run_task_mode "$n" fix
          _run_task_mode "$n" review
          ;;
        *)
          cdd_exit_blocked "task ${n}: unexpected handoff status ${status}"
          ;;
      esac
    done
  }

  workspace="$(_cdd_resolve_workspace "$plan_file")"
  ledger="${workspace}/progress.md"
  [[ -f "$ledger" ]] || cdd_exit_blocked "ledger missing: ${ledger}"

  _cdd_write_plan_constraints "$plan_file" "${workspace}/plan-constraints.md"

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
    printf 'no pending tasks\n' >&2
  fi

  cdd_exit_ok
}
