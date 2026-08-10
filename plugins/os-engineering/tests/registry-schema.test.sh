#!/usr/bin/env bash
# registry-schema.test.sh — harness-registry.json 字段合法性断言
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REG="${ROOT}/bin/harness-registry.json"

command -v jq >/dev/null 2>&1 || { echo "SKIP — jq missing"; exit 0; }
command -v python3 >/dev/null 2>&1 || { echo "FAIL — python3 missing"; exit 1; }

python3 - "$REG" <<'PY'
import json, sys
reg = json.load(open(sys.argv[1]))
assert isinstance(reg, dict) and reg, "registry must be non-empty object"
for name, e in reg.items():
    assert isinstance(e, dict), f"{name}: must be object"
    assert "cli" in e and isinstance(e["cli"], str) and e["cli"], f"{name}: cli required"
    assert e.get("ship") in ("full", "not-supported"), f"{name}: ship must be full|not-supported"
    if e["ship"] == "full":
        for k in ("invoke", "output", "review_prefix"):
            assert k in e, f"{name}: full entry requires {k}"
        assert e["output"] in ("text", "stream-json"), f"{name}: output must be text|stream-json"
    else:
        assert "invoke" not in e, f"{name}: not-supported entry must not carry invoke"
print(f"OK — {len(reg)} harnesses, schema valid")
PY
