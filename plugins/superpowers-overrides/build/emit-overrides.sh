#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ROOT
CURSOR_SKILLS="$ROOT/.cursor/skills"

python3 - <<'PY'
import json, os, sys
root = os.environ["ROOT"]
m = json.load(open(os.path.join(root, "overrides.manifest.json")))
for t in m["targets"]:
    path = os.path.join(root, t["source"].lstrip("./"), "SKILL.md")
    if not os.path.isfile(path):
        sys.exit(f"MISSING: {path}")
print(f"OK — {len(m['targets'])} manifest sources")
PY

python3 - <<'PY'
import json, os
root = os.environ["ROOT"]
m = json.load(open(os.path.join(root, "overrides.manifest.json")))
pj = json.load(open(os.path.join(root, ".claude-plugin/plugin.json")))
declared = {s.split("/")[-1] for s in pj["skills"]}
needed = {t["name"] for t in m["targets"]} | {"init", "subagent-lifecycle", "token-efficient-review-dispatch"}
missing = needed - declared
assert not missing, f"plugin.json missing names: {missing}"
print("OK — plugin.json alignment")
PY

rm -rf "$CURSOR_SKILLS"
mkdir -p "$CURSOR_SKILLS"

python3 - <<'PY'
import json, os, shutil
root = os.environ["ROOT"]
m = json.load(open(os.path.join(root, "overrides.manifest.json")))
cursor = os.path.join(root, ".cursor/skills")
for t in m["targets"]:
    name, src = t["name"], t["source"]
    dst_dir = os.path.join(cursor, name)
    src_dir = os.path.join(root, src.lstrip("./"))
    shutil.copytree(src_dir, dst_dir, dirs_exist_ok=True)
    print(f"  emitted {name}")
for slug in ["init", "subagent-lifecycle", "token-efficient-review-dispatch"]:
    shutil.copytree(os.path.join(root, "skills", slug), os.path.join(cursor, slug), dirs_exist_ok=True)
    print(f"  copied {slug}")
PY

echo "OK — emit-overrides complete"
