#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ROOT
python3 - <<'PY'
import json
import os

root = os.environ["ROOT"]
template = open(os.path.join(root, "build/templates/self-check.mdc")).read()
m = json.load(open(os.path.join(root, "overrides.manifest.json")))
rows = []
for t in m["targets"]:
    s = t["slug"]
    f = f"{s}-overrides"
    rows.append(
        f"| `/{s}`, `/superpowers:{s}`, upstream `{s}` body | Read `{f}` via agent_skills fullPath |"
    )
table = "\n".join(rows)
print(template.replace("{{TRIGGER_TABLE}}", table), end="")
PY
