---
"@oscaner-skills/cdd-engine": patch
---

P6 修复族（fixes family, cdd-engine patch）——三个 fix 合并发布：

- **writeBoundary 接线 + 残留注解修正（T25 fix）**：task face 同步 canonical `ctx.handoffPath` → implement 载体真正落 changed-surface ledger-origin notes（此前读空路径记录永不落盘）；docs no-handoff BLOCKED carrier 在 agent exit 0 时省略 `recovery.exit_code`（exit_code 保持严格死亡码：1/143）；残留 stash 附言补 round marker（`cdd residue: <cause> <basename> r1`）。
- **residue save 单 owner 收敛（T28）**：残留保全 save 侧全族归 `artifacts/residue.ts`——eligibility（`recoveryEligible`/`RESIDUE_PRESERVED_CAUSES`）、carrier 锚定 adapter `settleFromCarrier`、`preserved` 幂等守卫、announce 包装；一切 save 路径单一标准化 stash message（同 task lane 契约；T28 前双 owner 双写 stash 缺陷消除——lane pre-write `preserved=true`、共用钩子幂等空转）；`rules/residue.ts` + `gitStashPreserve` 删除；`recovery.wip_stat` 归档并存 `residue_scope`。
- **doc-contract + status lifecycle 钩子（T29）**：每次真实派发 pre-flight 跑 `docContractValidate`（plan `### Task N:` 连续提取 · `**Spec:**` 解析至现有 spec · Constraints 源可提取 · 无占位；phase spec 版本行 + Parent program 指向 + phase 注册；overall canonical 头 + 行形守卫 + 版本升序）——失败 blocked exit 1 + 逐字段指导（dry-run 降 WARN）；post-flight `statusValidate` 报六态收敛（in-flight/needs-review/needs-fix/needs-re-review/resume-pending/complete）+ 计划完成度 CDD_INFO；`rules/documents.ts` + `rules/status.ts` 只读，引擎新增面 = 两个 DispatchLifecycle 模板方法钩子（零 CLI 面/零 schema 变更/零 doc 写）。

- **src 注释锚首清零执法（T31）**：§35 第二半（src 注释语义主体 + 锚仅 trailing 溯源后缀）纸面规则落执法位——residue 守卫新增「src 注释禁锚首」检查（`packages/cdd-engine/src/**/*.ts` 注释首 token ∈ 阶段锚族 → FAIL；块粒度计数、文件头豁免仅当头注 path/模块开头、尾缀/纯语义放行），全引擎 135 个锚首注释块语义前置排修（含中文注释 English 化，测试位同扫，纯注释零行为面）。

> **Semver note**: 四个 fix（writeBoundary 接线 / regenerate single-owner / doc-contract+status 钩子 / src 注释锚首执法）均为缺陷修复/内部收敛，按 patch 发布（保持 0/1/2/3 退出码表与 CLI 面不变）。，按 patch 发布（保持 0/1/2/3 退出码表与 CLI 面不变）。
