#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== 0. unified emit freshness — --check against committed products (no write) =="
node scripts/emit.mjs --check

echo "== 1. plugin.json skills resolve =="
python3 -c '
import json, os
root = "packages/superpowers-overrides"
p = os.path.join(root, ".claude-plugin/plugin.json")
d = json.load(open(p))
skills = d.get("skills")
if skills is None:
    # overrides = trigger router — no skill bodies. skills/ may be absent or empty.
    skills_dir = os.path.join(root, "skills")
    n = 0
    if os.path.isdir(skills_dir):
        n = sum(1 for x in os.listdir(skills_dir) if os.path.isfile(os.path.join(skills_dir, x, "SKILL.md")))
    assert n == 0, f"expected 0 overrides skills (trigger router, no skill bodies), got {n}"
    print(f"OK — {n} skills (trigger router, no skill bodies)")
elif isinstance(skills, str):
    path = os.path.join(root, skills.lstrip("./"))
    assert os.path.isdir(path), f"skills path missing: {path}"
    n = sum(1 for n in os.listdir(path) if os.path.isfile(os.path.join(path, n, "SKILL.md")))
    print(f"OK — {n} skills (directory {skills!r})")
else:
    missing = [s for s in skills if not os.path.isdir(os.path.join(root, s.lstrip("./")))]
    assert not missing, f"skills[] points to missing dirs: {missing}"
    print(f"OK — {len(skills)} skills")
'

echo "== 2. every skill dir has SKILL.md (skip when none) =="
shopt -s nullglob
for d in packages/superpowers-overrides/skills/*/; do
  [ -f "$d/SKILL.md" ] || { echo "MISSING: $d/SKILL.md"; exit 1; }
done
shopt -u nullglob
echo OK

echo "== 3. no orphan skill dirs =="
python3 -c '
import json, os
root = "packages/superpowers-overrides"
d = json.load(open(os.path.join(root, ".claude-plugin/plugin.json")))
skills = d.get("skills")
skills_dir = os.path.join(root, "skills")
on_disk = set()
if os.path.isdir(skills_dir):
    on_disk = {f"skills/{n}" for n in os.listdir(skills_dir) if os.path.isdir(os.path.join(skills_dir, n))}
assert not on_disk, f"overrides plugin must have no skill dirs (trigger router): {on_disk}"
print("OK — no skill dirs (trigger router)")
'

echo "== 4. hooks executable =="
[ -f packages/superpowers-overrides/hooks/hooks.json ] && echo "OK — hooks.json"
[ -f packages/superpowers-overrides/hooks/hooks-cursor.json ] && echo "OK — hooks-cursor.json"
[ -x packages/superpowers-overrides/bin/override-prompt-expansion.sh ] && echo "OK — prompt-expansion"
[ -x packages/superpowers-overrides/bin/override-cursor-detect.sh ] && echo "OK — cursor-detect"
[ -x packages/superpowers-overrides/bin/override-cursor-enforce.sh ] && echo "OK — cursor-enforce"

echo "== 5. overrides build validation =="
./packages/superpowers-overrides/tests/validate-overrides-build.sh

echo "== 5b. engineering plugin validation =="
python3 -c '
import json, os
root = "packages/engineering"
d = json.load(open(os.path.join(root, ".claude-plugin/plugin.json")))
skills = d.get("skills")
# 断言 engineering skills 数 = 13（12 发射 + os-init）
EXPECTED = 13
if skills is None:
    skills_dir = os.path.join(root, "skills")
    assert os.path.isdir(skills_dir), f"missing default skills dir: {skills_dir}"
    n = sum(1 for x in os.listdir(skills_dir) if os.path.isfile(os.path.join(skills_dir, x, "SKILL.md")))
    assert n == EXPECTED, f"expected {EXPECTED} engineering skills (12 emitters + os-init), got {n}"
    print(f"OK — {n} engineering skills (default skills/ discovery)")
elif isinstance(skills, str):
    skills_dir = os.path.join(root, skills.lstrip("./"))
    assert os.path.isdir(skills_dir), f"missing skills dir: {skills_dir}"
    n = sum(1 for x in os.listdir(skills_dir) if os.path.isfile(os.path.join(skills_dir, x, "SKILL.md")))
    assert n == EXPECTED, f"expected {EXPECTED} engineering skills (12 emitters + os-init), got {n}"
    print(f"OK — {n} engineering skills (directory {skills!r})")
else:
    missing = [s for s in skills if not os.path.isdir(os.path.join(root, s.lstrip("./")))]
    assert not missing, f"skills[] points to missing dirs: {missing}"
    assert len(skills) == EXPECTED, f"expected {EXPECTED} engineering skills (12 emitters + os-init), got {len(skills)}"
    print(f"OK — {len(skills)} engineering skills (explicit list)")
'
./packages/engineering/tests/registry-schema.test.sh
./packages/engineering/tests/cdd-select.test.sh
./packages/engineering/tests/cdd-cli-dry-run-smoke.sh
./packages/engineering/tests/cdd-commit-gate-smoke.sh
./packages/engineering/tests/cdd-common-functions.test.sh
./packages/engineering/tests/cdd-severity-contract.test.sh
python3 packages/engineering/tests/rule-reference.test.py \
  --skills packages/engineering/skills:semantic
./packages/engineering/tests/cdd-gate-allow-deny-smoke.sh
./packages/engineering/tests/override-claude-cdd-gate.test.sh
./packages/engineering/tests/override-cursor-cdd-gate.test.sh
./packages/engineering/tests/cdd-orchestrator-line-budget.test.sh
./packages/engineering/tests/ci-validate-wiring.test.sh

echo "== 5b2. engineering gate hooks =="
[ -f packages/engineering/hooks/hooks.json ] || { echo "FAIL: engineering hooks.json missing"; exit 1; }
[ -f packages/engineering/hooks/hooks-cursor.json ] || { echo "FAIL: engineering hooks-cursor.json missing"; exit 1; }
[ -x packages/engineering/bin/override-claude-cdd-gate.sh ] || { echo "FAIL: claude cdd-gate not executable"; exit 1; }
[ -x packages/engineering/bin/override-cursor-cdd-gate.sh ] || { echo "FAIL: cursor cdd-gate not executable"; exit 1; }
[ -x packages/engineering/bin/cdd-session-activate.sh ] || { echo "FAIL: cdd-session-activate not executable"; exit 1; }
echo "OK"

echo "== 5c. engine + router zero-residue check =="
if grep -rnE '\b(sdd_|_sdd_|SDD_|sdd-run-|spor-)' \
  packages/engineering/bin packages/engineering/skills \
  packages/superpowers-overrides/bin packages/superpowers-overrides/hooks \
  packages/superpowers-overrides/build/generated 2>/dev/null; then
  echo "RESIDUE FOUND — sdd_/SDD_/sdd-run-/spor- in engine + router executable products"
  exit 1
else
  echo "OK — zero residue in engine + router executable products"
fi

echo "== 6. marketplace validate =="
node scripts/validate-marketplace.mjs

echo "== 7. lib unit tests =="
node --test scripts/lib/version-utils.test.mjs scripts/lib/emit/emit.test.mjs scripts/lib/publish-vendor.test.mjs scripts/lib/bump-chain.test.mjs scripts/lib/first-party-publish.test.mjs scripts/lib/submodule-tags.test.mjs

echo "== 8–10. version sync =="
node scripts/validate-version-sync.mjs

echo "== 11. mattpocock-skills resolvable =="
[ -d vendors/mattpocock-skills/skills ] && echo OK

echo "ALL PASS"
