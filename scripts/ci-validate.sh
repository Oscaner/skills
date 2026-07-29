#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== 1. plugin.json skills resolve =="
python3 -c '
import json, os
p = "superpowers-overrides/.claude-plugin/plugin.json"
d = json.load(open(p))
skills = d["skills"]
missing = [s for s in skills if not os.path.isdir(os.path.join("superpowers-overrides", s.lstrip("./")))]
assert not missing, f"skills[] points to missing dirs: {missing}"
print(f"OK — {len(skills)} skills")
'

echo "== 2. every skill dir has SKILL.md =="
for d in superpowers-overrides/skills/*/; do
  [ -f "$d/SKILL.md" ] || { echo "MISSING: $d/SKILL.md"; exit 1; }
done && echo OK

echo "== 3. no orphan skill dirs =="
python3 -c '
import json, os
d = json.load(open("superpowers-overrides/.claude-plugin/plugin.json"))
declared = {s.lstrip("./") for s in d["skills"]}
on_disk = {f"skills/{n}" for n in os.listdir("superpowers-overrides/skills")}
orphans = on_disk - declared
assert not orphans, f"orphans: {orphans}"
print("OK")
'

echo "== 4. hooks executable =="
[ -f superpowers-overrides/hooks/hooks.json ] && echo "OK — hooks.json"
[ -x superpowers-overrides/bin/override-prompt-expansion.sh ] && echo "OK — prompt-expansion"

echo "== 5. emit freshness =="
ENABLE_EMIT_FRESH_CHECK=1 ./superpowers-overrides/tests/validate-overrides-build.sh

echo "== 6. overrides version triple-check =="
node -e "
const m=require('./.claude-plugin/marketplace.json');
const p=require('./superpowers-overrides/package.json');
const j=require('./superpowers-overrides/.claude-plugin/plugin.json');
const entry=m.plugins.find(x=>x.name==='superpowers-overrides');
if(entry.version!==p.version||p.version!==j.version)
  throw new Error('version mismatch: '+[entry.version,p.version,j.version]);
console.log('OK —', p.version);
"

echo "== 7. overrides prerelease prefix =="
node -e "
const m=require('./.claude-plugin/marketplace.json');
const p=require('./superpowers-overrides/package.json');
const sp=m.plugins.find(x=>x.name==='superpowers').version;
if(!p.version.startsWith(sp+'-overrides.'))
  throw new Error(p.version+' not aligned to superpowers '+sp);
console.log('OK');
"

echo "== 8. mattpocock-skills resolvable =="
[ -d mattpocock-skills/skills ] && echo OK

echo "== 9. superpowers version sync =="
node -e "
const m=require('./.claude-plugin/marketplace.json');
const j=require('./superpowers/.claude-plugin/plugin.json');
const sp=m.plugins.find(x=>x.name==='superpowers').version;
if(j.version!==sp) throw new Error('superpowers plugin.json '+j.version+' != marketplace '+sp);
console.log('OK — superpowers', sp);
"

echo "ALL PASS"
