#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== 1. plugin.json skills resolve =="
python3 -c '
import json, os
root = "plugins/superpowers-overrides"
p = os.path.join(root, ".claude-plugin/plugin.json")
d = json.load(open(p))
skills = d.get("skills")
if skills is None:
    skills_dir = os.path.join(root, "skills")
    assert os.path.isdir(skills_dir), f"missing default skills dir: {skills_dir}"
    n = sum(1 for n in os.listdir(skills_dir) if os.path.isfile(os.path.join(skills_dir, n, "SKILL.md")))
    print(f"OK — {n} skills (default skills/ discovery)")
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

echo "== 2. every skill dir has SKILL.md =="
for d in plugins/superpowers-overrides/skills/*/; do
  [ -f "$d/SKILL.md" ] || { echo "MISSING: $d/SKILL.md"; exit 1; }
done && echo OK

echo "== 3. no orphan skill dirs =="
python3 -c '
import json, os
root = "plugins/superpowers-overrides"
d = json.load(open(os.path.join(root, ".claude-plugin/plugin.json")))
skills = d.get("skills")
on_disk = {f"skills/{n}" for n in os.listdir(os.path.join(root, "skills")) if os.path.isdir(os.path.join(root, "skills", n))}
if skills is None or (isinstance(skills, str) and skills.rstrip("/") in ("./skills", "skills")):
    print("OK — directory discovery (no explicit skill list)")
else:
    declared = {s.lstrip("./") for s in skills}
    orphans = on_disk - declared
    assert not orphans, f"orphans: {orphans}"
    print("OK")
'

echo "== 4. hooks executable =="
[ -f plugins/superpowers-overrides/hooks/hooks.json ] && echo "OK — hooks.json"
[ -f plugins/superpowers-overrides/hooks/hooks-cursor.json ] && echo "OK — hooks-cursor.json"
[ -x plugins/superpowers-overrides/bin/override-prompt-expansion.sh ] && echo "OK — prompt-expansion"
[ -x plugins/superpowers-overrides/bin/override-cursor-detect.sh ] && echo "OK — cursor-detect"
[ -x plugins/superpowers-overrides/bin/override-cursor-enforce.sh ] && echo "OK — cursor-enforce"

echo "== 5. overrides build validation =="
./plugins/superpowers-overrides/tests/validate-overrides-build.sh
./plugins/superpowers-overrides/tests/sdd-cli-dry-run-smoke.sh
./plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh
./plugins/superpowers-overrides/tests/override-claude-sdd-gate.test.sh

echo "== 6. marketplace validate =="
node scripts/validate-marketplace.mjs

echo "== 7. marketplace emit freshness =="
node scripts/emit-marketplace.mjs --check

echo "== 8–10. version sync =="
node scripts/validate-version-sync.mjs

echo "== 11. mattpocock-skills resolvable =="
[ -d plugins/mattpocock-skills/skills ] && echo OK

echo "ALL PASS"
