---
"@oscaner-skills/cdd-engine": major
---

P4.4 Task 3/4/5 cdd-engine breaking 面（P4.4 破口窗口收口登记）：`TaskGroup` 组身份统一 + 契约 token 面收敛 + `CddRuntime` 模块态收编 + 域载体 typed 化：

- **组键形 `tasks-{a}-{b}-*` → `tasks-{a},{b}-*`（BREAKING 产物名面）**：dispatch 组身份收敛为 `TaskGroup` 值对象（`key()` 规范序列化 = CLI `--tasks` 参数串，comma-joined 无空格——单例 `"1"`、合并组 `"1,2"`）；六命名面（brief / implement·review·fix handoff / report / test-evidence）全部 `tasks-{key}-*` 化；`tasksKey()` 函数整删。消费者迁移面：一切组产物文件名为 `tasks-1,2-*`（旧 `tasks-1-2-*` 消亡）。
- **`--tasks 1-2` 连字符形非法（BREAKING 解析面）**：`parseTaskList` 迁移至 `TaskGroup.fromTokens`（逐 token 严格整数校验 · 去重 · 递增排序）；连字符/空 token/非整数 → exit 2（旧版 `parseInt` 会静默吞 `1-2` 为 `[1]`）。
- **契约 token 面收敛（BREAKING prompt 面）**：九个 `TASK_*`/`DOCS_*` token 塌缩为 `DISPATCH_UNIT`（本轮 dispatch 单位，task=组键 · branch=base..head）/ `BRIEF` / `FINDINGS` / `FIXED_POINT` / `CONSTRAINTS` / `WORKSPACE` / `DOC`；保留 `MODE` / `REVIEW_*` / `HANDOFF_TARGET` / `HANDOFF_WRITE_GATE` / `WORKSPACE_SLUG` / `RETURN_FORMAT`。模板契约 `$version` 2 → 3。
- **effectiveGroups 隐式单组派生补全（BREAKING 行为面——声明组未全覆盖时）**：有效组 = 声明合并组 ∪ 未覆盖任务隐式单组（按 task 号序），有效组并集恒 == 全 plan task 号集（P4.3 实现会丢弃未声明 task）。
- **`CddRuntime` 模块态收编（重构面，公共 API 不变）**：全部模块级可变态（dryRun / 根单例 / proc registry·diskPath·idleTimer / signalExitCode / cache-profile memo / 模板渲染 CACHE）收进 `src/infra/runtime.ts` 单例；`infra/proc.ts` 变薄 re-export；派发面新增 `runtime` 构造注入替身缝（engine 测试经替身实证 dryRun/root/proc 均经类面）。
- **域载体 typed 化（重构面）**：`TaskDispatchContext` / `DispatchContext` / `ProgressData` 等域接口去掉索引签名、精确声明成员（handoff schema 16-prop 校验仍留 schema 面，无双实现）；`ReviewOpts` / `FixOpts` 组字段收 `TaskGroup`。

> **Semver 说明**：产物名 / CLI 解析 / prompt 契约 token / 声明组未全覆盖分区 = 消费面破坏，cdd-engine 按 major 发布；消费者迁移面 = 组产物文件名 `tasks-1,2-*`、`--tasks` 仅接受逗号整数串、prompt round-context 槽读新 token 名。
