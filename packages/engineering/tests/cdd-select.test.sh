#!/usr/bin/env bash
# cdd-select.test.sh — cdd-select.sh 检测 + 推荐逻辑（hermetic mock PATH）
#
# Hermetic PATH: the host may have real registry CLIs installed (claude,
# cursor-agent, droid, pi, codex). Prepending a mock dir to the full $PATH
# would let them leak through and break the scenarios (e.g. real `claude`
# surviving scenario 3's "only codex" → no BLOCK). Instead we drop every PATH
# dir that holds a registry CLI binary, keep the rest (bash/jq/coreutils stay
# resolvable), and symlink jq into the mock dir since its real dir is dropped.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEL="${ROOT}/bin/engine/cdd-select.sh"

command -v jq >/dev/null 2>&1 || { echo "SKIP — jq missing"; exit 0; }

# shellcheck source=tests/test-lib.sh
source "$ROOT/tests/test-lib.sh"

mockdir="$(mktemp -d)"
trap 'rm -rf "$mockdir"' EXIT
for bin in droid pi claude codex; do printf '#!/bin/sh\nexit 0\n' > "$mockdir/$bin"; chmod +x "$mockdir/$bin"; done
ln -s "$(command -v jq)" "$mockdir/jq"
FP="$(harness_free_path)"

# 场景1: droid+pi+claude 在 mock PATH → available 含 claude,droid,pi（jq keys[] 字母序）；recommended=droid
out=$(PATH="$mockdir:$FP" "$SEL")
echo "$out" | grep -q 'available:claude,droid,pi' || { echo "FAIL: available"; echo "$out"; exit 1; }
echo "$out" | grep -q 'recommended:droid' || { echo "FAIL: recommend droid"; echo "$out"; exit 1; }

# 场景2: 只 pi 在 mock PATH → recommended=pi
rm "$mockdir/droid" "$mockdir/claude"
out=$(PATH="$mockdir:$FP" "$SEL")
echo "$out" | grep -q 'recommended:pi' || { echo "FAIL: recommend pi"; echo "$out"; exit 1; }

# 场景3: 只 codex（not-supported）在 mock PATH → BLOCKED exit 1
rm "$mockdir/pi"
if PATH="$mockdir:$FP" "$SEL" >/dev/null 2>&1; then
  echo "FAIL: not-supported only should BLOCK"; exit 1
fi

echo "OK — cdd-select (3 scenarios)"
