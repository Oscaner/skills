---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P5 — CDD engine + CI + test scripts ported to Node (single-language closure).

- All bash engine scripts (`cdd-common.sh` / `cdd-run.sh` / `cdd-exec.sh` / `cdd-select.sh` / `cdd-session-activate.sh`, ~3000 lines) migrated to Node (.mjs); core modules (harness registry, exit utils, templates, ledger, runner/contract H6 chain) ported.
- `ci-validate.mjs` unifies the 12-block validate orchestration.
- All shell tests and `rule-reference.test.py` migrated to `node:test` (engine + gate + init + utils module trees).
- End state: single-language Node executable surface (bash/node dual-stack retired).