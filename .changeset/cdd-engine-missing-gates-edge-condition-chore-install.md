---
"@oscaner-skills/cdd-engine": patch
"@oscaner-skills/kairos": patch
---

fix: 缺门补齐四项——`edgeConditionWords` 真派生 + `chore` 契约单源 + `INSTALL_ROWS` ↔ README + `PIPELINE_NEXT` ↔ `REFS` 闭合（P9 T13 · §3.3 ④⑥⑦⑨）:

- **④ `edgeConditionWords` 真派生门** — `skill-anatomy.ts` 的 `edgeConditionWords` 声明「wording test pins the derivation」实为 0 reader（假 pin）。新增 `session/next.ts` 的 `ROUTE_DECISION_WORDS`（Route 决策词）+ 导出 `FAILED_STATUS`；新增引擎套件门 `contract/__tests__/edge-conditions.guard.test.ts` 从 `CAPSULE_WORDS.status`（减 `FAILED_STATUS`）+ `ROUTE_DECISION_WORDS` + 契约 `nextLoopConditions` 家族拼接连派生并 pin（并交叉核 `RoundStatus` union）；kairos 套件 `skill-anatomy.test.ts` 消费 `edgeConditionWords` 作 NEXT-LOOP 出边标签允许集。
- **⑥ `chore` 契约单源** — `render/issue-body.ts` 的类型集从 `words.ts` 派生的 `ISSUE_TYPES`（issue-label 行的 `${type}.` 前缀去重）单源读取；消费面 `cdd-report/SKILL.md:88` 的 `type ∈ {bug | enhancement}` 对齐为 `{bug, enhancement, chore}`（错误字节一并校正）；新增 kairos 套件门 `tests/issue-type-contract.test.ts` 钉 SKILL 声明 == 渲染器值域 + 引用字节 == 渲染器实际字节。
- **⑦ `INSTALL_ROWS` ↔ README 门** — `host.ts` 的 `INSTALL_ROWS` docstring「README renders from these rows」由空言转真门：新增引擎套件门 `face/__tests__/install-rows.guard.test.ts` 钉 `packages/kairos/README.md`（+ zh 镜像）上游安装表的行键集 == `INSTALL_ROWS` 键集、各 Claude Code cell == `INSTALL_ROWS[key].join("；")`。
- **⑨ `PIPELINE_NEXT` ↔ `REFS` 闭合门** — `channel-closure.guard.test.ts` 扩项：`session/next.ts` 的 `PIPELINE_NEXT` 每个 `{ kind: "ref" }` 条目的 ref 键 ⊆ `host.ts` 的 `REFS` 并派生出各 harness 形态（面间交接表 × ref 表 cross-closure）。
- **门归属分域** — ④⑦⑨ 归 engine suite（引擎内部事实）· ⑥ 归 kairos suite（引擎 ⇄ 消费面对照）。
