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
needed = {t["slug"] for t in m["targets"]} | {"init", "subagent-lifecycle", "token-efficient-review-dispatch"}
missing = needed - declared
assert not missing, f"plugin.json missing slugs: {missing}"
print("OK — plugin.json alignment")
PY

rm -rf "$CURSOR_SKILLS"
mkdir -p "$CURSOR_SKILLS"

python3 - <<'PY'
import json, os, shutil, subprocess
root = os.environ["ROOT"]
m = json.load(open(os.path.join(root, "overrides.manifest.json")))
cursor = os.path.join(root, ".cursor/skills")
rewrite = os.path.join(root, "build/lib/rewrite-frontmatter.py")
for t in m["targets"]:
    slug, overrides, src = t["slug"], t["overrides"], t["source"]
    flat = f"{slug}-overrides"
    dst_dir = os.path.join(cursor, flat)
    src_dir = os.path.join(root, src.lstrip("./"))
    os.makedirs(dst_dir, exist_ok=True)
    for name in os.listdir(src_dir):
        if name == "SKILL.md":
            continue
        s, d = os.path.join(src_dir, name), os.path.join(dst_dir, name)
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        else:
            shutil.copy2(s, d)
    with open(os.path.join(src_dir, "SKILL.md")) as f:
        src_text = f.read()
    proc = subprocess.run(
        ["python3", rewrite, "--slug", slug, "--overrides", overrides],
        input=src_text, capture_output=True, text=True, check=True,
    )
    with open(os.path.join(dst_dir, "SKILL.md"), "w") as f:
        f.write(proc.stdout)
    print(f"  emitted {flat}")
for slug in ["init", "subagent-lifecycle", "token-efficient-review-dispatch"]:
    shutil.copytree(os.path.join(root, "skills", slug), os.path.join(cursor, slug), dirs_exist_ok=True)
    print(f"  copied {slug}")
PY

echo "OK — emit-overrides complete"
