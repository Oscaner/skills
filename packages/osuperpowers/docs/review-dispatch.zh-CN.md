# Review Dispatch

跨切面参考：多 pass 评审的派发纪律（D1/D2/D3）。被 os-brainstorming / os-writing-plans 的评审 passes 规则引用。

## Rules

### Rule: D1 Escalate-on-Finding

Pass 1 独立先跑。零发现 + 明确扫描清单 → 后续 pass 跳过；否则修复后并发跑后续 pass。

**CLI review：** 每 pass 一次独立 `cdd-exec` 调用（无状态 fresh 嵌套会话）。

### Rule: D2 Delta Review

中间 pass 只收前一 pass 修复后的变更部分；最终 pass 收全文（全局一致性检查需要跨节可见）。

**CLI review：** 仅 Pass 2 限定 delta；Pass 3 恒 full-doc。

### Rule: D3 Findings-Only Output

评审 prompt 必须要求 findings-only（无总结、无正面评论）。输出 schema：`{findings: [{lens, severity, section|file, line?, summary, fix, deferred?}]}`。空数组 = approve。

**CLI review：** findings-only 原样，output schema 不变。

**Severity 行为锚点：**
- `blocker` — 合并前必须修复（正确性 / 契约违反）
- `warn` — 可延期的 minor（真实问题但非阻塞）
- `nit` — 纯风格
- warn/nit 不进 fix loop——handoff 记 `APPROVED` + `deferred: true`；blocker → `CHANGES_REQUESTED`
