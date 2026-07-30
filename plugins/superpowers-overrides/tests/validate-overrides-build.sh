#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS="$ROOT/skills"
MANIFEST="$ROOT/overrides.manifest.json"

echo "== validate manifest sources =="
python3 -c "
import json, os
m = json.load(open('$MANIFEST'))
for t in m['targets']:
    p = os.path.join('$ROOT', t['source'].lstrip('./'), 'SKILL.md')
    assert os.path.isfile(p), p
print('OK')
"

echo "== validate manifest JSON schema =="
python3 -c "
import json, os
try:
    from jsonschema import validate
    m = json.load(open('$MANIFEST'))
    schema = json.load(open(os.path.join('$ROOT', 'build/overrides-manifest.schema.json')))
    validate(m, schema)
    print('OK')
except ImportError:
    m = json.load(open('$MANIFEST'))
    assert 'plugin' in m and 'targets' in m
    for t in m['targets']:
        for k in ('name', 'overrides', 'source'):
            assert k in t
        assert t['name'].endswith('-overrides')
    print('OK (minimal schema check)')
"

echo "== validate canonical skill names =="
python3 -c "
import json, os, re
m = json.load(open('$MANIFEST'))
assert len(m['targets']) == 10
skills = '$SKILLS'
for t in m['targets']:
    name = t['name']
    d = os.path.join(skills, name)
    assert os.path.isdir(d), f'missing {d}'
    assert name.endswith('-overrides')
    text = open(os.path.join(d, 'SKILL.md')).read()
    fm = re.match(r'(?s)^---\n(.*?)\n---', text).group(1)
    nm = re.search(r'^name:\s*(.+)$', fm, re.M).group(1).strip()
    assert nm == name, f'{name}: frontmatter name={nm}'
    plugin, upstream = t['overrides'].split(':', 1)
    assert plugin == 'superpowers'
    assert not os.path.isdir(os.path.join(skills, upstream)), f'upstream collision dir: {upstream}'
print('OK')
"

echo "== validate cross-cutting skills exist =="
for slug in init subagent-lifecycle token-efficient-review-dispatch; do
  [ -f "$SKILLS/$slug/SKILL.md" ] || { echo "MISSING cross-cutting: $slug"; exit 1; }
done
echo "OK"

echo "== validate plugin.json alignment =="
python3 -c "
import json, os
root = '$ROOT'
m = json.load(open(os.path.join(root, 'overrides.manifest.json')))
pj = json.load(open(os.path.join(root, '.claude-plugin/plugin.json')))
declared = {s.split('/')[-1] for s in pj['skills']}
needed = {t['name'] for t in m['targets']} | {'init', 'subagent-lifecycle', 'token-efficient-review-dispatch'}
assert needed <= declared, f'plugin.json missing: {needed - declared}'
print('OK')
"

echo "== validate no legacy .cursor/skills tree =="
if [ -d "$ROOT/.cursor/skills" ]; then
  echo "FAIL: .cursor/skills/ still exists — delete per unified naming spec"
  exit 1
fi
echo "OK"

echo "== validate generator outputs fresh =="
"$ROOT/build/generate-all.sh" --check

echo "ALL PASS"
