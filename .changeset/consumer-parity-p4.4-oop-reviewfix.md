---
"@oscaner-skills/cdd-engine": major
---

P4.4 Task 6/7/8 cdd-engine breaking 面（P4.4 破口窗口收口登记）：全面 OOP restructure（engine 导出函数面重排）+ `REVIEW_FIX` 状态词汇新值（三段结案，#278）。

- **engine 导出函数面重排（BREAKING）**：`runTask` → 类公共面 `TaskLifecycle.run`（静态组合根）；`runDocsTask` → `DocsLifecycle.run`；`generateBrief` → `BriefRenderer#render`；`buildCtx`/`parseTaskList` → `TaskLifecycle`/`cli-shared` 类公共方法。零薄壳转发（转发壳 = 缺陷即删, 判定标准⑤）——消费者以 `TaskLifecycle.run(harness, tasks, opts)` / `DocsLifecycle.run(opts)` 取代裸函数调用。
- **standalone harness CLIs 合入组合根（BREAKING CLI 面）**：`cli/branch-review.ts` / `cli/branch-fix.ts` 整删——branch 审阅/修复经 `cdd review --type branch [--base --head]` / `cdd fix --type branch` 单一入口（组合根 type 路由），无独立 bin 转发。
- **域规则模块 → 无状态域服务类（重构面，构造注入）**：`ConvergenceChecker` / `FailureResolver` / `StatusJudge` / `CloseoutChecker` / `DocumentsValidator` / `CommitChecker` / `HandoffSchemaValidator` / `ChangedSurfaceAuditor` / `TaskListParser` / `BriefRenderer` / `GitClient` / `Registry` / `ConfigLoader` / `EngineInvoker` / `ReturnBlockParser` / `TemplateLoader` 收类，方法即规则；`rules/` 全目录零裸纯函数导出。`ResidueManager` / `ProgressLedger` / `Handoff` / `RoundContext` 载体类落地（six-key 账本 `rowFor/entryFor` 单源、handoff 构建/命名/落盘/终态化经类面）。
- **`REVIEW_FIX` 状态词汇新值（BREAKING — status enum 新增第三结案值, #278 三段结案）**：warn/nit-only 审阅轮 → `REVIEW_FIX`（收口态）而非旧 `APPROVED` 归并——fix 轮复用现有 `cdd fix --findings` 路由任务到 complete，**无 re-review**（与 S1 blocker 的 needs-fix → needs-re-review 区分）；零 blocker 且零 findings 仍 `APPROVED` fast path 不变；历史终态不回滚（旧 `APPROVED`+findings 终态保留）。handoff schema（task/docs）`status` enum + 回读定稿（`finalizeHandoff` 派生）与 `deriveTaskState` 路由同步三值。

> **Semver 说明**：导出面破坏 + 新状态词汇值 = 消费面 breaking，cdd-engine 按 major 发布。消费者迁移面：(1) 直接消费 engine 库面处改调类静态组合根；(2) 解析审阅轮 handoff / return-block 时必须识别 `status: REVIEW_FIX`（warn/nit-only 结案）——非 approval，亦非 blocker 循环。
