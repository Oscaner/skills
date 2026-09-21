---
"@oscaner-skills/cdd-engine": patch
---

Task 31: src 注释锚首清零执法（§35 second half 纸面规则落执法位）。

- **residue 守卫扩展**（maintainer 工具面，随 validate/pre-commit/CI 5c 步运行）：新增「src 注释禁锚首」检查——`packages/cdd-engine/src/**/*.ts` 注释**首个有效 token** ∈ 阶段锚 regex 族（`P\d+` / `T\d+(\.\d+)?` / `Task \d+` / `spec T\d+(\.\d+)?`）→ 结构化 FAIL（含文件+行）；块粒度（单个 `/* */` 块或相邻 `//` 行组一计数），文件头豁免仅当头注首 token 非锚（路径/模块开头），锚作 trailing 溯源后缀与纯语义散文放行；注入面零锚守卫不变。
- **引擎排修**：全引擎 src 135 个锚首注释块改为语义前置（锚移尾或删除，含中文注释英译——English-primary），测试位同扫（§35 无测试豁免）。零行为面变化（纯注释）。
