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
[ -x plugins/superpowers-overrides/bin/override-prompt-expansion.sh ] && echo "OK — prompt-expansion"

echo "== 5. overrides build validation =="
./plugins/superpowers-overrides/tests/validate-overrides-build.sh

echo "== 6. marketplace source schema =="
node scripts/validate-source.mjs

echo "== 7. marketplace emit freshness =="
node scripts/emit-marketplace.mjs --check

echo "== 8. overrides version triple-check =="
node -e "
const s=require('./marketplace/source.json');
const m=require('./.claude-plugin/marketplace.json');
const p=require('./plugins/superpowers-overrides/package.json');
const j=require('./plugins/superpowers-overrides/.claude-plugin/plugin.json');
const src=s.plugins.find(x=>x.name==='superpowers-overrides');
const entry=m.plugins.find(x=>x.name==='superpowers-overrides');
const v=[p.version,src.version,j.version,entry.version];
if(new Set(v).size!==1) throw new Error('version mismatch: '+v.join(' '));
console.log('OK —', p.version);
"

echo "== 9. overrides prerelease prefix =="
node -e "
const s=require('./marketplace/source.json');
const p=require('./plugins/superpowers-overrides/package.json');
const sp=s.plugins.find(x=>x.name==='superpowers').version;
if(!p.version.startsWith(sp+'-overrides.'))
  throw new Error(p.version+' not aligned to superpowers '+sp);
console.log('OK');
"

echo "== 10. superpowers version sync =="
node -e "
const s=require('./marketplace/source.json');
const m=require('./.claude-plugin/marketplace.json');
const j=require('./plugins/superpowers/.claude-plugin/plugin.json');
const src=s.plugins.find(x=>x.name==='superpowers').version;
const entry=m.plugins.find(x=>x.name==='superpowers').version;
if(j.version!==src||src!==entry) throw new Error('superpowers mismatch: submodule='+j.version+' source='+src+' emitted='+entry);
console.log('OK — superpowers', src);
"

echo "== 11. mattpocock-skills resolvable =="
[ -d plugins/mattpocock-skills/skills ] && echo OK

echo "== 12. cursor wrapper paths resolve =="
node scripts/validate-wrapper-paths.mjs

echo "== 13. marketplace plugin sources exist =="
node scripts/validate-marketplace-sources.mjs

echo "ALL PASS"
