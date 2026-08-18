---
"@oscaner-skills/engineering": patch
"@oscaner-skills/superpowers-overrides": patch
---

engineering P5 — CDD engine port to Node. All bash engine scripts (`cdd-run.sh`, `cdd-exec.sh`, `cdd-select.sh`, `cdd-common.sh`, `cdd-session-activate.sh`) replaced by Node equivalents (`cdd-run.mjs`, `cdd-exec.mjs`, `cdd-select.mjs`, `cdd-session-activate.mjs`). Core engine modules ported to Node: harness registry + exit utilities + templates + ledger. Runner/contract ported to Node (H6 chain core + handoff). All shell tests migrated to `node:test` (103 tests across 11 test files). `ci-validate.mjs` unified validate orchestration (12 blocks). Rule-reference/release helpers/overrides tests ported to Node. Bash engine surface removed — executable surface is single-language Node. Exit handling centralized in `utils/exit.mjs` with unified `exitWithCode`/`exitOk`/`exitBlocked`/`exitCliMissing`; promoted to `bin/` level for shared gate/os-init use.