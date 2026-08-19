---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P5 — CDD 引擎 + CI + 测试脚本迁 Node（脚本语言统一收尾）。

- 全部 bash 引擎脚本（`cdd-common.sh` / `cdd-run.sh` / `cdd-exec.sh` / `cdd-select.sh` / `cdd-session-activate.sh`，~3000 行）迁移为 Node（`.mjs`）；核心模块（harness registry、exit utils、templates、ledger、runner/contract H6 链）Node 化。
- `ci-validate.mjs` 统一 validate 编排（12 blocks）。
- 全部 shell 测试 + `rule-reference.test.py` 迁移到 `node:test`（引擎 + gate + os-init + utils 多模块树）。
- 终态：可执行面单语言 Node（bash/node 双栈终结）。