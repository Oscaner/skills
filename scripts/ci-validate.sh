#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== 1. plugin.json skills resolve =="
python3 -c '
import json, os
p = "plugins/superpowers-overrides/.claude-plugin/plugin.json"
d = json.load(open(p))
skills = d["skills"]
missing = [s for s in skills if not os.path.isdir(os.path.join("plugins/superpowers-overrides", s.lstrip("./")))]
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
d = json.load(open("plugins/superpowers-overrides/.claude-plugin/plugin.json"))
declared = {s.lstrip("./") for s in d["skills"]}
on_disk = {f"skills/{n}" for n in os.listdir("plugins/superpowers-overrides/skills")}
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

echo "== 6. marketplace validate =="
node scripts/validate-marketplace.mjs

echo "== 7. marketplace emit freshness =="
node scripts/emit-marketplace.mjs --check

echo "== 8–10. version sync =="
node scripts/validate-version-sync.mjs

echo "== 11. mattpocock-skills resolvable =="
[ -d plugins/mattpocock-skills/skills ] && echo OK

echo "ALL PASS"
