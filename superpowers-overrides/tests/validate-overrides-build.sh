#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
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
        for k in ('slug', 'overrides', 'source'):
            assert k in t
    print('OK (minimal schema check)')
"

echo "== validate flatName != slug and all targets emitted =="
python3 -c "
import json, os
m = json.load(open('$MANIFEST'))
cursor = '$CURSOR'
assert len(m['targets']) == 10
for t in m['targets']:
    flat = f\"{t['slug']}-overrides\"
    assert flat != t['slug']
    assert os.path.isdir(os.path.join(cursor, flat)), f'missing emitted {flat}'
print('OK')
"

echo "== validate cross-cutting skills copied =="
for slug in init subagent-lifecycle token-efficient-review-dispatch; do
  [ -f "$CURSOR/$slug/SKILL.md" ] || { echo "MISSING cross-cutting: $slug"; exit 1; }
done
echo "OK"

echo "== validate plugin.json alignment =="
python3 -c "
import json, os
root = '$ROOT'
m = json.load(open(os.path.join(root, 'overrides.manifest.json')))
pj = json.load(open(os.path.join(root, '.claude-plugin/plugin.json')))
declared = {s.split('/')[-1] for s in pj['skills']}
needed = {t['slug'] for t in m['targets']} | {'init', 'subagent-lifecycle', 'token-efficient-review-dispatch'}
assert needed <= declared, f'plugin.json missing: {needed - declared}'
print('OK')
"

echo "== validate no upstream slug dirs in .cursor/skills =="
python3 -c "
import json, os
m = json.load(open('$MANIFEST'))
cursor = '$CURSOR'
for t in m['targets']:
    assert not os.path.isdir(os.path.join(cursor, t['slug'])), f'dedup collision: {t[\"slug\"]}'
print('OK')
"

echo "== validate frontmatter name matches directory =="
python3 -c "
import os, re
cursor = '$CURSOR'
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
  after=$(git -C "$ROOT/.." diff --name-only superpowers-overrides/.cursor/skills 2>/dev/null || true)
  if [ -n "$after" ]; then
    echo "FAIL: emit-overrides.sh changed committed output — run build and commit"
    exit 1
  fi
  echo "OK — emit produces zero diff"
else
  echo "SKIP — set ENABLE_EMIT_FRESH_CHECK=1 to enable"
fi

echo "ALL PASS"
