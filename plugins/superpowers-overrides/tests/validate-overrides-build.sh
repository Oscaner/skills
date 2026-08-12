#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS="$ROOT/skills"
MANIFEST="$ROOT/overrides.manifest.json"
OS_ENG="$ROOT/../os-engineering"

echo "== validate manifest sources =="
python3 -c "
import json, os
m = json.load(open('$MANIFEST'))
for t in m['targets']:
    src = t.get('source')
    if src is None:
        continue  # submodule target (mattpocock tdd) — existence checked separately
    p = os.path.join('$ROOT', src, 'SKILL.md')
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
        assert ':' in t['name'], t['name']
    print('OK (minimal schema check)')
"

echo "== validate canonical target names =="
python3 -c "
import json, os, re
m = json.load(open('$MANIFEST'))
assert len(m['targets']) == 10
skills = '$SKILLS'
for t in m['targets']:
    name = t['name']
    assert ':' in name, f'name must be plugin-qualified: {name}'
    plugin, upstream = t['overrides'].split(':', 1)
    assert plugin == 'superpowers'
    assert not os.path.isdir(os.path.join(skills, upstream)), f'upstream collision dir: {upstream}'
# no skill bodies: overrides = trigger router. skills/ must be absent or empty.
if os.path.isdir(skills):
    names = [n for n in os.listdir(skills) if os.path.isdir(os.path.join(skills, n))]
    assert not names, f'skills/ must be empty (trigger router, no skill bodies): {names}'
print('OK')
"

echo "== validate cross-cutting skills =="
# all spor-* skill bodies deleted (T2); none may come back
if [ -d "$SKILLS" ]; then
  for slug in "$SKILLS"/spor-*; do
    [ -e "$slug" ] && { echo "FAIL: spor-* skill still present: $(basename "$slug")"; exit 1; }
  done
fi
for slug in spor-sdd-p0-fallback spor-subagent-lifecycle spor-token-efficient-review-dispatch; do
  [ -e "$SKILLS/$slug" ] && { echo "FAIL: deleted cross-cutting skill still present: $slug"; exit 1; }
done
echo "OK"

echo "== validate SDD orchestrator line budget =="
"$ROOT/tests/sdd-orchestrator-line-budget.test.sh"

echo "== validate rule-reference integrity (os-engineering semantic) =="
python3 "$OS_ENG/tests/rule-reference.test.py" \
  --skills os-engineering/skills:semantic

echo "== validate os-engineering engine (harness registry + runners) =="
[ -f "$OS_ENG/bin/harness-registry.json" ] || { echo "FAIL: harness-registry.json missing"; exit 1; }
for script in cdd-run.sh cdd-select.sh cdd-exec.sh; do
  [ -x "$OS_ENG/bin/$script" ] || { echo "FAIL: os-engineering/bin/$script not executable"; exit 1; }
done
echo "OK"

echo "== validate os-engineering engine tests =="
# cdd-exec.test.sh is intentionally not wired here — brief Step 2 sanctions only
# the three tests below. It stays a standalone regression test (hermetic vs ambient
# CDD_MODE since the T11 fix round); run it manually.
"$OS_ENG/tests/registry-schema.test.sh"
"$OS_ENG/tests/cdd-select.test.sh"
"$OS_ENG/tests/cdd-cli-dry-run-smoke.sh"
echo "OK"

echo "== validate manifest target existence (cross-plugin) =="
python3 -c "
import json, os
m = json.load(open('$MANIFEST'))
repo = os.path.normpath(os.path.join('$ROOT', '..', '..'))
for t in m['targets']:
    plugin, skill = t['name'].split(':', 1)
    if plugin == 'mattpocock-skills':
        p = os.path.join(repo, 'plugins', plugin, 'skills', 'engineering', skill, 'SKILL.md')
    else:
        p = os.path.join(repo, 'plugins', plugin, 'skills', skill, 'SKILL.md')
    assert os.path.isfile(p), f'missing target skill: {p}'
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
assert len(matchers) == 2, matchers
assert any(m.startswith('^superpowers:') for m in matchers)
assert any('/brainstorming' in m for m in matchers)
assert not any('spor-' in m for m in matchers), 'spor- matchers must be removed'
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
pre = hooks['hooks']['preToolUse']
assert len(pre) == 2
assert pre[0]['command'] == './bin/override-cursor-enforce.sh'
assert pre[1]['command'] == './bin/override-cursor-sdd-gate.sh'
assert 'matcher' not in pre[0]
print('OK')
"

echo "== validate claude hooks.json PreToolUse =="
python3 -c "
import json
from pathlib import Path
root = Path('$ROOT')
cc = json.loads((root / 'hooks/hooks.json').read_text())
assert 'PreToolUse' in cc['hooks']
assert len(cc['hooks']['PreToolUse']) == 2
assert cc['hooks']['PreToolUse'][0]['matcher'] == 'Write|Edit'
assert cc['hooks']['PreToolUse'][1]['matcher'] == 'Bash'
assert cc['hooks']['PreToolUse'][0]['hooks'][0]['command'].endswith('override-claude-sdd-gate.sh')
print('OK')
"

echo "== validate cursor hook scripts executable =="
[ -x "$ROOT/bin/override-cursor-detect.sh" ] || { echo "FAIL: detect not executable"; exit 1; }
[ -x "$ROOT/bin/override-cursor-enforce.sh" ] || { echo "FAIL: enforce not executable"; exit 1; }
[ -x "$ROOT/bin/override-cursor-sdd-gate.sh" ] || { echo "FAIL: sdd-gate not executable"; exit 1; }
[ -x "$ROOT/bin/override-claude-sdd-gate.sh" ] || { echo "FAIL: claude sdd-gate not executable"; exit 1; }
[ -x "$ROOT/bin/cdd-session-activate.sh" ] || { echo "FAIL: cdd-session-activate not executable"; exit 1; }
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
