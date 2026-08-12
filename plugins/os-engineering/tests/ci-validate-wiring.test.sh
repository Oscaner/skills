#!/usr/bin/env bash
# ci-validate-wiring.test.sh — validate 脚本的 os-engineering 接线完整性守卫
#
# Guards the orchestrator (scripts/ci-validate.sh) so future edits cannot drop
# os-engineering coverage from `pnpm run validate`. Each engine test, the
# rule-reference scan, and the engine + router zero-residue grep must be invoked
# exactly once, consolidated inside the == 5b == block (never scattered in the
# step-5 overrides block, never duplicated).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
VAL="$ROOT/scripts/ci-validate.sh"

[ -f "$VAL" ] || { echo "FAIL — missing $VAL"; exit 1; }

fail() { echo "FAIL — $1"; exit 1; }

# 1. == 5b == block marker present
marker="$(grep -nE '== 5b\. os-engineering plugin validation ==' "$VAL" | head -1 | cut -d: -f1 || true)"
[ -n "$marker" ] || fail "missing == 5b. os-engineering plugin validation == marker"

# 2. plugin.json structural check present (prints "OK — N os-engineering skills")
grep -q 'os-engineering plugin validation' "$VAL" || fail "5b echo missing"
grep -q 'os-engineering skills' "$VAL" || fail "plugin.json skills-count print missing"

# 3. every engine test invoked exactly once, after the 5b marker
ENGINE_TESTS=(
  registry-schema.test.sh
  cdd-select.test.sh
  cdd-cli-dry-run-smoke.sh
  cdd-commit-gate-smoke.sh
  cdd-common-functions.test.sh
  cdd-severity-contract.test.sh
)
for t in "${ENGINE_TESTS[@]}"; do
  n="$(grep -c "os-engineering/tests/$t" "$VAL" || true)"
  [ "$n" -eq 1 ] || fail "$t: expected 1 invocation in ci-validate.sh, got $n"
  ln="$(grep -n "os-engineering/tests/$t" "$VAL" | head -1 | cut -d: -f1 || true)"
  [ "$ln" -gt "$marker" ] || fail "$t: invoked before == 5b == block"
done

# 4. rule-reference invoked with the semantic-only --skills args
grep -q 'rule-reference.test.py' "$VAL" || fail "rule-reference.test.py not invoked"
grep -q -- '--skills os-engineering/skills:semantic' "$VAL" \
  || fail "rule-reference --skills args missing/wrong"

# 5. engine + router zero-residue check present (grep targets + OK echo)
grep -q 'zero residue in engine + router executable products' "$VAL" \
  || fail "zero-residue OK echo missing"
grep -qF 'plugins/os-engineering/skills' "$VAL" \
  || fail "zero-residue grep misses os-engineering/skills"
grep -qF 'plugins/superpowers-overrides/build/generated' "$VAL" \
  || fail "zero-residue grep misses router build/generated"

echo "OK — ci-validate os-engineering wiring intact"
