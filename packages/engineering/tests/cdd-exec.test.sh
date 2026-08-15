#!/usr/bin/env bash
# cdd-exec.test.sh — cdd-exec.sh 一次性自由任务入口行为（hermetic mock PATH）
#
# Seams under test (public interface of cdd-exec.sh):
#   1. arg parsing — missing / unknown args → usage exit 2
#   2. text passthrough — harness output=text → stdout == CLI 末参数（prompt 透传）
#   3. stream-json — harness output=stream-json → stdout == 最后 completion.finalText
#   4. unsupported harness (ship=not-supported) → BLOCKED exit 1
#   5. missing CLI → CDD_CLI_MISSING exit 2
#
# Hermetic PATH（同 cdd-select.test.sh）：host 可能装有真实 registry CLI。
# 丢弃所有含 registry CLI 二进制的 PATH 目录，把 jq symlink 进 mockdir 并前置，
# 使 mock cli 与 jq 都解析得到，同时真实 CLI 无法泄漏。
# Hermetic ambient CDD_*：_cdd_invoke_cli 在 CDD_MODE=review 时为 prompt 前置
# review_prefix（cdd-common.sh）。本测试把 cdd-exec.sh 当 mode-agnostic 一次性运行器、
# 断言原文透传，因此 unset 继承到的 CDD_MODE / CDD_HARNESS。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXEC="${ROOT}/bin/engine/cdd-exec.sh"
unset CDD_MODE CDD_HARNESS

[[ -f "$EXEC" ]] || { echo "FAIL — ${EXEC} missing (expect cdd-exec.sh from T6)"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "SKIP — jq missing"; exit 0; }

# shellcheck source=tests/test-lib.sh
source "$ROOT/tests/test-lib.sh"

mockdir="$(mktemp -d)"
trap 'rm -rf "$mockdir"' EXIT
ln -s "$(command -v jq)" "$mockdir/jq"
FP="$(harness_free_path)"

# make_mock <name> <body> — write an executable mock CLI into mockdir
make_mock() {
  local name="$1" body="$2"
  printf '#!/bin/sh\n%s\n' "$body" > "$mockdir/$name"
  chmod +x "$mockdir/$name"
}

# 场景 1: 参数解析 — 缺 --prompt / 未知 flag → exit 2
if "$EXEC" --harness claude >/dev/null 2>&1; then
  echo "FAIL: missing --prompt should exit 2"; exit 1
fi
if "$EXEC" --bogus x --prompt y >/dev/null 2>&1; then
  echo "FAIL: unknown flag should exit 2"; exit 1
fi

# 场景 2: text passthrough — claude (output=text)，mock 回显末参数（即 prompt）
make_mock claude 'for a in "$@"; do last="$a"; done; printf "%s\n" "$last"'
out=$(PATH="$mockdir:$FP" "$EXEC" --harness claude --prompt "hello world")
[[ "$out" == "hello world" ]] || { echo "FAIL: text passthrough — got: $out"; exit 1; }

# 场景 3: stream-json — droid (output=stream-json)，取最后 completion.finalText
make_mock droid 'printf "%s\n" "{\"type\":\"event\",\"finalText\":\"partial\"}"
printf "%s\n" "{\"type\":\"completion\",\"finalText\":\"FINAL RESULT\"}"'
out=$(PATH="$mockdir:$FP" "$EXEC" --harness droid --prompt "task")
[[ "$out" == "FINAL RESULT" ]] || { echo "FAIL: stream-json finalText — got: $out"; exit 1; }

# 场景 4: unsupported harness — codex (ship=not-supported)，mock 在 PATH → BLOCKED exit 1
# （capture rc 而非依赖 pipeline 状态：pipefail 下 cdd-exec 的非零会让整条 pipeline 非零）
make_mock codex 'exit 0'
set +e
codex_out=$(PATH="$mockdir:$FP" "$EXEC" --harness codex --prompt "x" 2>&1)
codex_rc=$?
set -e
[[ "$codex_rc" -ne 0 ]] || { echo "FAIL: codex (not-supported) should BLOCK"; exit 1; }
printf '%s\n' "$codex_out" | grep -q 'CDD_BLOCKED' \
  || { echo "FAIL: codex BLOCKED stderr missing — got: $codex_out"; exit 1; }

# 场景 5: missing CLI — pi (full) 无 mock → CDD_CLI_MISSING exit 2
set +e
pi_out=$(PATH="$mockdir:$FP" "$EXEC" --harness pi --prompt "x" 2>&1)
pi_rc=$?
set -e
[[ "$pi_rc" -ne 0 ]] || { echo "FAIL: missing pi CLI should exit non-zero"; exit 1; }
printf '%s\n' "$pi_out" | grep -q 'CDD_CLI_MISSING' \
  || { echo "FAIL: missing CLI stderr missing — got: $pi_out"; exit 1; }

# 场景 6: review-prefix 合成（live seam）— claude 的 review_prefix 非空，
# CDD_MODE=review 时 _cdd_invoke_cli 把 prompt 前置为单参数
# "Skill(mattpocock-skills:code-review) <prompt>"。cdd-exec.sh 是 mode-agnostic
# 运行器：透传 CDD_MODE 即触发前缀合成（review-prefix 路径的 live 覆盖，D6-A2）。
make_mock claude 'for a in "$@"; do last="$a"; done; printf "%s\n" "$last"'
out=$(PATH="$mockdir:$FP" CDD_MODE=review "$EXEC" --harness claude --prompt "hello world")
[[ "$out" == "Skill(mattpocock-skills:code-review) hello world" ]] \
  || { echo "FAIL: review-prefix composition — got: $out"; exit 1; }

echo "OK — cdd-exec (6 scenarios)"
