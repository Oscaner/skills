#!/usr/bin/env bash
# sdd-orchestrator-gate.sh — shared SDD orchestrator PreToolUse state machine (p1-slim.2)
# Source from harness adapters only.

SDD_PENDING_ROOT="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending-sdd"
SDD_PENDING_TTL=86400

sdd_pending_path() {
  printf '%s\n' "$SDD_PENDING_ROOT/$1.json"
}

sdd_plugin_root_from_lib() {
  local dir
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  printf '%s\n' "$dir"
}

sdd_session_key_from_json() {
  INPUT="$1" python3 <<'PYKEY'
import hashlib
import json
import os

data = json.loads(os.environ["INPUT"])
if data.get("conversation_id"):
    print(data["conversation_id"])
elif data.get("session_id"):
    print(data["session_id"])
else:
    print(hashlib.sha256((data.get("prompt") or "").encode()).hexdigest()[:16])
PYKEY
}

sdd_read_pending() {
  local session_key="$1" path
  path="$(sdd_pending_path "$session_key")"
  if [[ -f "$path" ]]; then
    cat "$path"
  fi
}

sdd_pending_expired() {
  local detected_at="$1" now
  detected_at="${detected_at:-0}"
  now=$(date +%s)
  (( now - detected_at > SDD_PENDING_TTL ))
}

sdd_clear_pending() {
  rm -f "$(sdd_pending_path "$1")"
}

sdd_is_write_tool() {
  case "$1" in
    Write|StrReplace|Edit|WriteNotebook|MultiEdit) return 0 ;;
    *) return 1 ;;
  esac
}

sdd_is_shell_tool() {
  case "$1" in
    Shell|Bash) return 0 ;;
    *) return 1 ;;
  esac
}

sdd_extract_path() {
  local tool_input_json="$1"
  printf '%s' "$tool_input_json" | jq -r '.path // .file_path // empty'
}

sdd_extract_command() {
  local tool_input_json="$1"
  printf '%s' "$tool_input_json" | jq -r '.command // empty'
}

# 只读 git 动词白名单 — 单源（判定 + deny 消息矩阵共用）。
sdd_readonly_git_verbs() {
  printf '%s\n' "status diff log show rev-parse branch remote ls-files diff-tree"
}

sdd_shell_allowed() {
  local cmd="$1"
  case "$cmd" in
    *sdd-run-task-*|*sdd-workspace*|*task-brief*|*review-package*) return 0 ;;
  esac
  if sdd_git_verb_allowed "$cmd"; then
    return 0
  fi
  return 1
}

# 提取 git 子命令并查只读白名单。提取失败 → return 1（deny，fail-closed）。
# 支持：git <verb>、git -C <path> <verb>、git --git-dir=<path> <verb>
# v1 不支持：git -C <path> -c k=v <verb>（-c 配置选项）→ 提取失败 → deny
# 含 shell 操作符（&& | ; > < $( ` 换行）或多行命令 → deny（防复合命令绕过）。
# branch/remote 只放行只读子参数（-a -r -v --show-current），拒绝变更类
# （-d -D -m 及位置参数如 branch <new>、remote add/remove/set-url）。
sdd_git_verb_allowed() {
  local cmd="$1" verb="" i
  local -a tokens=()
  case "$cmd" in
    *"&&"*|*"|"*|*";"*|*">"*|*"<"*|*"\$("*|*"\`"*|*$'\n'*) return 1 ;;
  esac
  read -r -a tokens <<<"$cmd"
  [[ "${tokens[0]:-}" == "git" ]] || return 1
  i=1
  while [[ $i -lt ${#tokens[@]} ]]; do
    case "${tokens[$i]}" in
      -C)
        i=$((i + 2))        # 跳过 -C 及其路径
        continue
        ;;
      --git-dir=*)          # 跳过 --git-dir=<path>
        i=$((i + 1))
        continue
        ;;
      -*)                   # 其它未知 flag → 提取失败 → deny
        return 1
        ;;
      *)
        verb="${tokens[$i]}"
        break
        ;;
    esac
  done
  [[ -n "$verb" ]] || return 1
  if [[ "$verb" == "branch" || "$verb" == "remote" ]]; then
    local j=$((i + 1))
    while [[ $j -lt ${#tokens[@]} ]]; do
      case "${tokens[$j]}" in
        -a|-r|-v|--show-current) ;;
        *) return 1 ;;
      esac
      j=$((j + 1))
    done
    return 0
  fi
  case " $(sdd_readonly_git_verbs) " in
    *" $verb "*) return 0 ;;
    *) return 1 ;;
  esac
}

sdd_is_under_path() {
  local path="$1" prefix="$2"
  [[ -n "$prefix" && -n "$path" && ( "$path" == "$prefix" || "$path" == "$prefix/"* ) ]]
}

sdd_normalize_abs() {
  local path="$1" repo_root="$2"
  if [[ "$path" != /* ]]; then
    path="$repo_root/$path"
  fi
  if [[ -e "$path" ]]; then
    printf '%s/%s' "$(cd "$(dirname "$path")" && pwd)" "$(basename "$path")"
  else
    local dir="${path%/*}"
    local base="${path##*/}"
    if [[ -d "$dir" ]]; then
      printf '%s/%s' "$(cd "$dir" && pwd)" "$base"
    else
      printf '%s' "$path"
    fi
  fi
}

sdd_resolve_workspace() {
  local repo_root="$1" pending_json="$2"
  local ws
  ws="$(printf '%s' "$pending_json" | jq -r '.workspace // empty')"
  if [[ -n "$ws" ]]; then
    printf '%s\n' "$ws"
    return 0
  fi
  return 1
}

# git cat-file 必须绑定 repo_root（CWD 无关）。实证：bare `git cat-file -e` 依赖 CWD 是 git 仓库。
sdd_git_object_exists() {
  local repo_root="$1" sha="$2"
  git -C "$repo_root" cat-file -e "$sha" 2>/dev/null
}

sdd_find_active_workspace() {
  local repo_root="$1"
  local sdd_root="$repo_root/.superpowers/sdd" dir brief n handoff
  [[ -d "$sdd_root" ]] || return 1
  for dir in "$sdd_root"/*/; do
    [[ -d "$dir" ]] || continue
    n=1
    while [[ -f "${dir}task-${n}-brief.md" ]]; do
      brief="${dir}task-${n}-brief.md"
      handoff="${dir}task-${n}-handoff.json"
      if sdd_brief_has_task_base "$brief" "$repo_root" && ! sdd_handoff_approved "$handoff"; then
        printf '%s\n' "${dir%/}"
        return 0
      fi
      n=$((n + 1))
    done
  done
  return 1
}

sdd_brief_has_task_base() {
  local brief="$1" repo_root="$2"
  [[ -f "$brief" ]] || return 1
  local sha
  sha="$(sed -nE 's/^TASK_BASE: //p' "$brief" | head -1 | tr -d ' \r')"
  [[ -n "$sha" ]] || return 1
  sdd_git_object_exists "$repo_root" "$sha"
}

sdd_handoff_approved() {
  local handoff="$1"
  [[ -f "$handoff" ]] || return 1
  command -v jq >/dev/null 2>&1 || return 1
  [[ "$(jq -r '.status // empty' "$handoff" 2>/dev/null)" == "APPROVED" ]]
}

sdd_frontier_task() {
  local workspace="$1" repo_root="$2" n=1 brief handoff
  while [[ -n "$workspace" ]]; do
    brief="${workspace}/task-${n}-brief.md"
    handoff="${workspace}/task-${n}-handoff.json"
    if [[ ! -f "$brief" ]]; then
      printf '%s\n' "$((n - 1))"
      return 0
    fi
    if sdd_brief_has_task_base "$brief" "$repo_root"; then
      if ! sdd_handoff_approved "$handoff"; then
        printf '%s\n' "$n"
        return 0
      fi
    else
      printf '%s\n' "$((n - 1))"
      return 0
    fi
    n=$((n + 1))
  done
  printf '0\n'
}

sdd_gate_phase() {
  local repo_root="$1" workspace="$2" pending_json="$3"
  local n brief next_brief active_ws
  active_ws="$workspace"
  if [[ -z "$active_ws" ]]; then
    printf 'orchestrating\n'
    return 0
  fi
  n="$(sdd_frontier_task "$active_ws" "$repo_root")"
  brief="${active_ws}/task-${n}-brief.md"
  next_brief="${active_ws}/task-$((n + 1))-brief.md"
  if [[ "$n" -eq 0 ]]; then
    printf 'orchestrating\n'
    return 0
  fi
  if sdd_brief_has_task_base "$brief" "$repo_root" && ! sdd_handoff_approved "${active_ws}/task-${n}-handoff.json"; then
    printf 'task_active\n'
    return 0
  fi
  if sdd_handoff_approved "${active_ws}/task-${n}-handoff.json" && ! sdd_brief_has_task_base "$next_brief" "$repo_root"; then
    printf 'task_complete\n'
    return 0
  fi
  if sdd_brief_has_task_base "$brief" "$repo_root"; then
    printf 'task_active\n'
    return 0
  fi
  printf 'orchestrating\n'
}

sdd_active_task_num() {
  local workspace="$1" repo_root="$2"
  sdd_frontier_task "$workspace" "$repo_root"
}

sdd_deny_message() {
  local harness="$1" task_num="$2" plan_basename="$3"
  local plugin_root verbs
  plugin_root="$(sdd_plugin_root_from_lib)"
  verbs="$(sdd_readonly_git_verbs | awk '{printf "  git %s", $1; for (i = 2; i <= 7 && i <= NF; i++) printf " / git %s", $i; printf "\n  "; for (i = 8; i <= NF; i++) printf "git %s%s", $i, (i == NF ? "\n" : " / ")}')"
  cat <<-EOF
	SDD orchestrator gate — direct repo edits forbidden during active task.

	Allowed Bash (read-only diagnostics):
${verbs}
	  ${plugin_root}/bin/sdd-run-task-${harness}.sh
	  sdd-workspace / task-brief / review-package

	Allowed Write:
	  .superpowers/sdd/${plan_basename}/

	Repo changes flow only through:
	  ${plugin_root}/bin/sdd-run-task-${harness}.sh --task ${task_num} --mode implement

	See spor-SDD Rule 0a item 4.
	EOF
}

sdd_plan_basename() {
  local workspace="$1" pending_json="$2" plan_path basename
  plan_path="$(printf '%s' "$pending_json" | jq -r '.plan_path // empty')"
  if [[ -n "$plan_path" ]]; then
    basename="${plan_path##*/}"
    printf '%s\n' "${basename%.md}"
    return 0
  fi
  if [[ -n "$workspace" && -f "${workspace}/progress.md" ]]; then
    plan_path="$(sed -n '1s/^# SDD ledger — plan: //p' "${workspace}/progress.md" 2>/dev/null || true)"
    if [[ -n "$plan_path" ]]; then
      basename="${plan_path##*/}"
      printf '%s\n' "${basename%.md}"
      return 0
    fi
  fi
  if [[ -n "$workspace" ]]; then
    printf '%s\n' "$(basename "$workspace")"
    return 0
  fi
  printf 'unknown-plan\n'
}

sdd_write_allowed() {
  local abs_path="$1" repo_root="$2" workspace="$3" phase="$4"
  local sdd_root="$repo_root/.superpowers/sdd"
  case "$phase" in
    inactive|task_complete) return 0 ;;
    orchestrating)
      sdd_is_under_path "$abs_path" "$sdd_root" && return 0
      sdd_is_under_path "$abs_path" "$workspace" && return 0
      return 1
      ;;
    task_active)
      sdd_is_under_path "$abs_path" "$workspace" && return 0
      return 1
      ;;
    *) return 1 ;;
  esac
}

# stdout: allow | deny|<message>
sdd_gate_decide() {
  local harness="$1" tool_name="$2" tool_input_json="$3" session_key="$4"
  local pending detected_at repo_root workspace phase abs_path cmd task_num plan_base msg

  if ! command -v jq >/dev/null 2>&1; then
    printf 'allow\n'
    return 0
  fi

  pending="$(sdd_read_pending "$session_key" || true)"
  if [[ -z "$pending" ]]; then
    printf 'allow\n'
    return 0
  fi

  detected_at="$(printf '%s' "$pending" | jq -r '.detected_at // 0')"
  if sdd_pending_expired "$detected_at"; then
    sdd_clear_pending "$session_key"
    printf 'allow\n'
    return 0
  fi

  repo_root="$(printf '%s' "$pending" | jq -r '.repo_root // empty')"
  [[ -n "$repo_root" ]] || { printf 'allow\n'; return 0; }

  workspace="$(sdd_resolve_workspace "$repo_root" "$pending" || true)"
  active_ws="$workspace"
  if [[ -z "$active_ws" ]]; then
    active_ws="$(sdd_find_active_workspace "$repo_root" || true)"
  fi
  phase="$(sdd_gate_phase "$repo_root" "$active_ws" "$pending")"

  if sdd_is_shell_tool "$tool_name"; then
    cmd="$(sdd_extract_command "$tool_input_json")"
    if sdd_shell_allowed "$cmd"; then
      printf 'allow\n'
      return 0
    fi
    if [[ "$phase" == "inactive" || "$phase" == "task_complete" ]]; then
      printf 'allow\n'
      return 0
    fi
    task_num="$(sdd_active_task_num "$active_ws" "$repo_root")"
    [[ "$task_num" -gt 0 ]] || task_num=1
    plan_base="$(sdd_plan_basename "$active_ws" "$pending")"
    msg="$(sdd_deny_message "$harness" "$task_num" "$plan_base")"
    printf 'deny|%s\n' "$msg"
    return 0
  fi

  if sdd_is_write_tool "$tool_name"; then
    abs_path="$(sdd_extract_path "$tool_input_json")"
    [[ -n "$abs_path" ]] || { printf 'allow\n'; return 0; }
    abs_path="$(sdd_normalize_abs "$abs_path" "$repo_root")"
    if sdd_write_allowed "$abs_path" "$repo_root" "$active_ws" "$phase"; then
      printf 'allow\n'
      return 0
    fi
    task_num="$(sdd_active_task_num "$active_ws" "$repo_root")"
    [[ "$task_num" -gt 0 ]] || task_num=1
    plan_base="$(sdd_plan_basename "$active_ws" "$pending")"
    msg="$(sdd_deny_message "$harness" "$task_num" "$plan_base")"
    printf 'deny|%s\n' "$msg"
    return 0
  fi

  printf 'allow\n'
}
