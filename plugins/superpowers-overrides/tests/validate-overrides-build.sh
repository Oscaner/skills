#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS="$ROOT/skills"
CURSOR="$ROOT/.cursor/skills"
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

echo "== validate emitted cursor skills (transitional) =="
python3 -c "
import json, os, re
m = json.load(open('$MANIFEST'))
cursor = '$CURSOR'
assert os.path.isdir(cursor), 'missing .cursor/skills (transitional emit tree)'
for t in m['targets']:
    name = t['name']
    assert os.path.isdir(os.path.join(cursor, name)), f'missing emitted {name}'
    _, upstream = t['overrides'].split(':', 1)
    assert not os.path.isdir(os.path.join(cursor, upstream)), f'dedup collision: {upstream}'
for slug in ('init', 'subagent-lifecycle', 'token-efficient-review-dispatch'):
    assert os.path.isfile(os.path.join(cursor, slug, 'SKILL.md')), slug
for name in os.listdir(cursor):
    if not name.endswith('-overrides'):
        continue
    skill = os.path.join(cursor, name, 'SKILL.md')
    text = open(skill).read()
    fm = re.match(r'(?s)^---\n(.*?)\n---', text).group(1)
    nm = re.search(r'^name:\s*(.+)$', fm, re.M).group(1).strip()
    assert nm == name, f'{name}: frontmatter name={nm}'
print('OK')
"

echo "== validate emit is fresh (optional) =="
if [ "${ENABLE_EMIT_FRESH_CHECK:-0}" = "1" ]; then
  "$ROOT/build/emit-overrides.sh" >/dev/null
  after=$(git -C "$ROOT/../.." diff --name-only plugins/superpowers-overrides/.cursor/skills 2>/dev/null || true)
  if [ -n "$after" ]; then
    echo "FAIL: emit-overrides.sh changed committed output — run build and commit"
    exit 1
  fi
  echo "OK — emit produces zero diff"
else
  echo "SKIP — set ENABLE_EMIT_FRESH_CHECK=1 to enable"
fi

echo "ALL PASS"
