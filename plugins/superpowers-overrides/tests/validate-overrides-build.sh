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
        assert t['name'].startswith('spor-')
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
    assert name.startswith('spor-')
    text = open(os.path.join(d, 'SKILL.md')).read()
    fm = re.match(r'(?s)^---\n(.*?)\n---', text).group(1)
    nm = re.search(r'^name:\s*(.+)$', fm, re.M).group(1).strip()
    assert nm == name, f'{name}: frontmatter name={nm}'
    plugin, upstream = t['overrides'].split(':', 1)
    assert plugin == 'superpowers'
    assert not os.path.isdir(os.path.join(skills, upstream)), f'upstream collision dir: {upstream}'
for name in os.listdir(skills):
    assert name.startswith('spor-'), f'skill dir must start with spor-: {name}'
    text = open(os.path.join(skills, name, 'SKILL.md')).read()
    fm = re.match(r'(?s)^---\n(.*?)\n---', text).group(1)
    nm = re.search(r'^name:\s*(.+)$', fm, re.M).group(1).strip()
    assert nm == name, f'{name}: frontmatter name={nm}'
print('OK')
"

echo "== validate cross-cutting skills exist =="
for slug in spor-init spor-subagent-lifecycle spor-token-efficient-review-dispatch; do
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
needed = {t['name'] for t in m['targets']} | {'spor-init', 'spor-subagent-lifecycle', 'spor-token-efficient-review-dispatch'}
assert needed <= declared, f'plugin.json missing: {needed - declared}'
print('OK')
"

echo "== validate no legacy .cursor/skills tree =="
if [ -d "$ROOT/.cursor/skills" ]; then
  echo "FAIL: .cursor/skills/ still exists"
  exit 1
fi
echo "OK"

echo "== validate trigger patterns =="
python3 "$ROOT/tests/trigger-patterns.test.py"

echo "== validate hooks.json matchers =="
python3 -c "
import json, re
from pathlib import Path
root = Path('$ROOT')
hooks = json.loads((root / 'hooks/hooks.json').read_text())
matchers = [e['matcher'] for e in hooks['hooks']['UserPromptExpansion']]
assert any(m.startswith('^superpowers:') for m in matchers)
assert any('/brainstorming' in m for m in matchers)
assert any('spor-' in m for m in matchers)
print('OK')
"

echo "== validate harness manifests =="
python3 "$ROOT/tests/manifest-harness.test.py"

echo "== validate generator outputs fresh =="
"$ROOT/build/generate-all.sh" --check

echo "== validate expansion script =="
"$ROOT/tests/override-prompt-expansion.test.sh"

echo "== validate cursor detect hook =="
"$ROOT/tests/override-cursor-detect.test.sh"

echo "== validate cursor enforce hook =="
"$ROOT/tests/override-cursor-enforce.test.sh"

echo "== validate hooks-cursor.json =="
python3 -c "
import json
from pathlib import Path
root = Path('$ROOT')
hooks = json.loads((root / 'hooks/hooks-cursor.json').read_text())
assert hooks['version'] == 1
assert 'beforeSubmitPrompt' in hooks['hooks']
assert 'preToolUse' in hooks['hooks']
detect = hooks['hooks']['beforeSubmitPrompt'][0]
assert detect['command'] == './bin/override-cursor-detect.sh'
enforce = hooks['hooks']['preToolUse'][0]
assert enforce['command'] == './bin/override-cursor-enforce.sh'
assert 'matcher' not in enforce
print('OK')
"

echo "== validate cursor hook scripts executable =="
[ -x "$ROOT/bin/override-cursor-detect.sh" ] || { echo "FAIL: detect not executable"; exit 1; }
[ -x "$ROOT/bin/override-cursor-enforce.sh" ] || { echo "FAIL: enforce not executable"; exit 1; }
echo "OK"

echo "== validate self-check version stamps =="
python3 -c "
import json, re
from pathlib import Path
root = Path('$ROOT')
version = json.loads((root / '.claude-plugin/plugin.json').read_text())['version']
cursor = (root / 'build/generated/cursor-self-check.mdc').read_text()
claude = (root / 'build/generated/claude-self-check.md').read_text()
assert f'superpowers-overrides-version: {version}' in cursor, 'cursor self-check missing version stamp'
m = re.search(r'<!-- superpowers-overrides-version: ([^ ]+) -->', claude)
assert m and m.group(1) == version, 'claude self-check version stamp mismatch'
print('OK')
"

echo "== validate dogfood self-check version stamps =="
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
python3 -c "
import json, re
from pathlib import Path
plugin_root = Path('$ROOT')
repo_root = Path('$REPO_ROOT')
version = json.loads((plugin_root / '.claude-plugin/plugin.json').read_text())['version']

cursor_path = repo_root / '.cursor/rules/superpowers-overrides.mdc'
claude_path = repo_root / 'CLAUDE.md'
cursor = cursor_path.read_text()
claude = claude_path.read_text()

needle = f'superpowers-overrides-version: {version}'
assert needle in cursor, f'{cursor_path}: missing or stale stamp — re-run /spor-init'

m = re.search(r'<!-- superpowers-overrides-version: ([^ ]+) -->', claude.splitlines()[0])
assert m and m.group(1) == version, f'{claude_path}: line 1 stamp mismatch — re-run /spor-init'
print('OK')
"

echo "ALL PASS"
