# os-engineering P6d 阶段设计：文档英文化（翻译 phase）

## Header

- **Version**: v1.0 · 2026-08-18
- **Status**: Draft
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering overall v3.0](2026-08-10-os-engineering-overall.md)
- **Depends on**: P6c（research 集成完成 → SKILL.md 内容稳定）

## §0 Incremental warning

> P6d 增量。跨阶段约定见 [overall v3.0](2026-08-10-os-engineering-overall.md)；冲突以 overall 为准。

## §1 Constraints pointer

- 不重复 overall 约定；冲突以 overall 为准。
- **文档英文化（P6d）**：所有 engineering SKILL.md + docs 从中文→英文；中文版本作为 `docs/zh-CN/` 平行镜像保留。emit 再生成 `.agents/skills/` 英文版本。
- **分发视角最高约束**：英文是面向外部用户的主语言（harness 消费 SKILL.md 为英文）。
- Conventional commits、无 attribution；禁 git worktree；`pnpm run validate` 保持通过。

## §2 Design body

### 2.0 范围

P6d 单一 phase，4 个 tasks（按文件族批处理）：

| Task | 范围 | 文件数 |
|---|---|---|
| T0 | os-* family SKILL.md 中文→英文 + 中文镜像 | 9 + 9 |
| T1 | cli-* family SKILL.md 中文→英文 + 中文镜像 | 4 + 4 |
| T2 | engineering docs 英文化 | 6 |
| T3 | 旧 docs/superpowers 清理 | 删除 ~53 files |

### 2.1 语言约定

**统一模式：companion file**（所有双语文件用 `<name>.zh-CN.md` 同目录模式，无 `docs/zh-CN/` 平行目录）

| 文件类型 | Source 语言 | 中文 companion |
|---|---|---|
| `skills/*/SKILL.md` | **英文**（harness 自动发现）| `skills/*/SKILL.zh-CN.md`（同目录，harness 忽略）|
| `.agents/skills/*/SKILL.md` | **英文**（emit 再生成）| 无（仅英文）|
| `docs/*.md`（gate-install 等）| **英文** | `docs/*.zh-CN.md`（同目录 companion）|
| `README.md` | **英文** | `README.zh-CN.md`（同目录 companion，已有）|
| `CLAUDE.md` | **英文**（P6e 重写）| 无（Claude Code 消费，非人类阅读）|
| `specs/plans/tickets` | **英文**（不镜像）| 无 |

**Companion file 模式**（research 2026-08-18 确认最佳实践）：
- 所有双语内容统一用 `<name>.zh-CN.md` 同目录模式
- Claude Code / harness 只发现 `<name>.md`（英文 primary）；`.zh-CN.md` 为人类参考文件
- 与 `README.md` / `README.zh-CN.md` 惯例完全一致
- 零 emit 改动，零 plugin.json 改动，零结构性改动

**翻译原则**：
- 保持规则结构不变（`### Rule: <Name>` heading、Red Flags section、代码块）
- 术语不翻译（harness、gate、emit、plugin、skill、mode、task、brief 等保留英文）
- 注释/说明文字翻译为中文
- 中文 companion 保留原始中文内容（不从英文反译）

### 2.2 T0: os-* family（9 SKILL.md）

每文件操作：
1. 翻译 `skills/<name>/SKILL.md` 中文→英文
2. 创建 `skills/<name>/SKILL.zh-CN.md`（保存原始中文内容）
3. `pnpm run emit`（`.agents/skills/` 英文版本再生成）
4. `pnpm run validate`

| SKILL.md | 行数 | 关键内容 |
|---|---|---|
| os-brainstorming | 73 | Rule: Read Upstream / Sub-Skills / Overall-Phase / Research Delegation / Spec Review via CLI / Write Design |
| os-executing-plans | 79 | 11 rules（Read Upstream / Mode Selection / Task Complexity / Confirm Once / Fix Loop / Confirm Seams / Per-Task Review / Quality Invariants / Orchestrator Checklist / D6 Aggregation / Ledger）|
| os-writing-plans | 37 | Fresh-Subagent Review Passes → Plan Review via CLI / Ticket Publish Redirect |
| os-report-issue | 174 | 最大文件，standalone skill（report issue 流程 + templates）|
| os-finishing | 31 | Finishing rules（worktree skip / conventional commits / discard confirmation）|
| os-code-review | 30 | Code review rules |
| os-verification | 26 | Verification rules |
| os-debugging | 26 | Debugging rules |
| os-init | 9 | os-init 参数化（spor / harness）|

### 2.3 T1: cli-* family（4 SKILL.md）

同 T0 流程：翻译 `SKILL.md` → 创建 `SKILL.zh-CN.md` → emit → validate。

| SKILL.md | 行数 | 关键内容 |
|---|---|---|
| cli-driven-development | 43 | Harness Selection / Three-Mode Chain / Handoff Contract / Commit Gate / Ledger |
| cli-select | 35 | Ask rule / registry interaction |
| cli-code-review | 35 | CLI code review rules |
| cli-task | 31 | CLI task dispatch |

### 2.4 T2: engineering docs 英文化（6 files）

每文件操作：
1. 翻译 `docs/<name>.md` 中文→英文
2. 创建 `docs/<name>.zh-CN.md`（保存原始中文内容）
3. `pnpm run validate`

| Doc | 行数 | 内容 |
|---|---|---|
| cdd-reference.md | 152 | CDD 引擎参考（exit codes、H6 chain、templates）|
| handoff-schema.md | 120 | Handoff JSON schema |
| overall-phase-spec-template.md | 118 | Overall + phase spec 模板 |
| controller-handoff.md | 42 | Controller handoff H1-H5 |
| review-dispatch.md | 29 | D1/D2/D3 + CLI review mapping |
| subagent-lifecycle.md | 21 | Fresh subagent / concurrent dispatch |

### 2.5 T3: 旧 docs/superpowers 清理

删除范围：
- `docs/superpowers/specs/` 中非 `os-engineering` 前缀的 22 个旧 spec 文件
- `docs/superpowers/plans/` 中非 `os-engineering` 前缀的 13 个旧 plan 文件
- `docs/superpowers/tickets/` 中非 `os-engineering` 前缀的旧 ticket 文件

保留范围：
- `os-engineering-overall.md` + `os-engineering-p{1-6d}-design.md` specs
- `os-engineering-p{1-6d}.md` plans
- `os-engineering-p{4a,4b,5,6a,6b,6c}-tickets.md` tickets

### 2.6 错误处理

- 翻译遗漏（未翻译的中文行在英文 SKILL.md 中）→ 需人工/agent 检查
- `SKILL.zh-CN.md` 缺失 → 不影响 harness（harness 只消费 `SKILL.md`），但违反 P6d 约定
- 清理误删 → git history 可恢复

### 2.7 非目标

- ❌ 不改规则语义（只翻译语言，不改规则内容/结构）
- ❌ 不改 SKILL.md frontmatter 的 `name`/`description`（保持英文；`description` 可双语）
- ❌ 不创建新的 SKILL.md 或 docs
- ❌ 不改 emit 逻辑（只触发 re-emit）
- ❌ 不改 plugin.json（directory form 保持不变）
- ❌ 不改 `pnpm run validate` 验证逻辑

### 2.8 验收标准

- [ ] 13 个 SKILL.md 全部英文（grep 非注释中文字符 → 0 hits）
- [ ] 13 个 SKILL.zh-CN.md 存在（中文 companion files）
- [ ] 6 个 engineering docs 全部英文
- [ ] 6 个 docs/*.zh-CN.md 存在（中文 companion files）
- [ ] 无 `docs/zh-CN/` 目录（全 companion file 模式，无平行目录）
- [ ] `.agents/skills/` copies 与英文 source 一致（emit no drift）
- [ ] 旧 specs/plans/tickets 已删除（保留 os-engineering）
- [ ] `pnpm run validate` ALL PASS
- [ ] `pnpm run emit` 再生成不 drift
- [ ] plugin.json `"skills"` field 仍为 `"./skills/"`（directory form 未改）

## §3 Deviations from overall

无。P6d 纯翻译 + 清理，不改变 overall 约定。

## §4 Notes for downstream

- P6e（CLAUDE.md/README 重写 + zh-CN 镜像）依赖 P6d 完成（SKILL.md 英文化后整体语言一致）。
- 翻译后的 SKILL.md 在 harness 中被消费为英文（符合分发视角约束）。
- 中文镜像仅用于人类查看（`docs/zh-CN/` convention）。

## §5 Review

Rule 1 三个 subagent pass 通过后交用户 review，再进入 writing-plans。
