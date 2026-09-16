---
"@oscaner-skills/cdd-engine": minor
"@oscaner-skills/osuperpowers": minor
---

P4 engine 契约面重构 + skills 面全面重写（含行为兼容性变更）。

**cdd-engine — 契约面重构：**

- **单一坐标系**：CLI 内容路径入参（plan / doc / path 等）统一为**仓根相对**解析，绝对路径直用；不再保留 cwd 相对回落。路径未命中时退出码固定为 1，诊断恒为三行（含实际尝试路径）。
- **单根收敛**：cwd → 仓根转换在 bin + lib 内收口为唯一一处，子进程与生命周期路径全部自根派生。
- 失败分支契约回正：BLOCKED 载荷由引擎字面量填充、恢复载荷不依赖对象展开语义、progress 透传与派发输出格式保持一致。

> **semver 说明**：CLI 路径语义由 cwd 相对改为仓根相对**实为 breaking**，本次按 minor 发布。

**osuperpowers — skills 面全面重写（8 个）：**

- 新增三个 spec-writer：writing-single-spec / writing-overall-spec / writing-phase-spec；
- 委托型重写：brainstorming / writing-plans / finishing；
- 原生型重写：cli-driven-development + report-issue 精简。
- **`init` 删除**：技能集收敛为编排型 8 个。