# Docs Review

> **范围：** 仅适用于 3-pass AI 编排文档评审（spec-review / plan-review）。
> task-review 使用 `cli-driven-development/SKILL.md` 中的 Fix Loop。branch-review 使用 `cli-driven-development` + `{pluginRoot}/bin/engine/cdd-review.mjs`（--template branch-review）。

跨切面参考：多 pass 评审的派发纪律（D1/D2/D3）。被 brainstorming / writing-plans 的评审 pass 规则引用。

## Rules

### Rule: D1 Escalate-on-Finding

第 1 pass 独立首先运行。零发现 + 显式扫描检查清单 → 跳过后续 pass；否则先修复，然后并发运行后续 pass。

**CLI 评审：** 每个 pass 是独立的 `{pluginRoot}/bin/engine/cdd-review.mjs` 调用（无状态的全新嵌套 session）。

### Rule: D2 Delta Review

中间 pass 只接收上一 pass 修复后的增量；最终 pass 接收完整文档（全局一致性检查需要跨 section 可见性）。

**CLI 评审：** 只有 Pass 2 是增量范围；Pass 3 始终是完整文档。

### Rule: D3 Findings-Only Output

评审 prompt 必须只请求发现内容（无摘要，无正面评论）。输出 schema：`{findings: [{lens, severity, section|file, line?, summary, fix, deferred?}]}`。空数组 = 通过。

**CLI 评审：** 发现内容原样输出，输出 schema 不变。

**严重性行为锚点：**
- `blocker` — 合并前必须修复（正确性 / 合约违规）
- `warn` — 可推迟的次要问题（真实问题但不阻塞）
- `nit` — 纯风格问题
- warn/nit：见下方 Rule: Review Stopping

### Rule: Review Stopping

适用于 spec-review 和 plan-review（3-pass AI 编排文档评审）：

循环流程：
  ① 执行 3-pass review
  ② blocker：必须修复 → 只重跑产生该 blocker 的那一 pass → blocker=0 → 继续
  ③ 所有 pass blocker=0 → 将 warn/nit 列表呈现给用户（允许逐项选择）：

     使用 AskUserQuestion，两个选项：
       「继续：<next-step>」（由调用方技能提供标签）
         → review 完成，进入下一步
       「修复选定 warn/nit」
         → 修复选定项 → review 完成，进入下一步

     ③ 之后不提供重跑选项。

`<next-step>` 标签由调用方技能提供（如 brainstorming → "用户审阅 spec"；writing-plans → "Execution Handoff"）。blocker 重跑（步骤 ②）是唯一的重跑；③ 之后不重跑。

呈现 warn/nit 时：从本次 3-pass review cycle 已有的各 pass 输出中读取，不额外发起任何新的 review 调用。

### Rule: Handoff Output

**范围：** 仅限 spec-review 和 plan-review。task-review 使用 `$CDD_HANDOFF_PATH`（不变）。branch-review：不在本规则范围内。

路径约定（由 P2 引擎执行 — `node {pluginRoot}/bin/engine/cdd-review.mjs --handoff PATH`）：
  - spec-review：`<cdd-workspace>/spec-review-handoff.json`
  - plan-review：`<cdd-workspace>/plan-review-handoff.json`

`<cdd-workspace>` = `.superpowers/cdd/<plan-slug>/`

handoff.json schema：`{ "status": "APPROVED|CHANGES_REQUESTED", "findings": [...], "deferred": [...] }`
