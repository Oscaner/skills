# SDD Token 效率改造 — Overall Spec

- **Version**: v2.2 · 2026-08-05
- **Status**: Draft
- **Author**: kang · Cursor Agent
- **Constraints**:
  - 仅改 `superpowers-overrides` 插件（**pack**/**pack-sp** 阶段含 oscaner **emit/marketplace**；**pack-sp** 只改 superpowers 的 Cursor `source`，**不**改 submodule 内容）
  - 不 fork upstream superpowers 6.2.0
  - 不删除 final whole-branch review
  - 不引入 git worktree（用户策略）
  - Phase 必须可独立 ship、可 demo
  - **CLI 脚本 plugin-bundled**：所有 SDD CLI 脚本随 `superpowers-overrides` 发布；**禁止**在 consumer 项目内生成、复制或改写一套脚本
  - **pack 允许 breaking change**：重装 / 刷新 Team Marketplace 为预期迁移路径

## Goal

1. **Token 效率** — 降低 SDD / executing-plans 消耗（痛点 A orchestrator 膨胀、B per-task review）。
2. **Override 纪律（meta）** — penf **已 ship** @ `6.2.0-overrides.12`；pack + pack-sp **已 ship** @ `6.2.0-overrides.13`；CURSOR-SMOKE 人工走读 **已完成**。
3. **多 harness 同包（pack）** — `superpowers-overrides` 与 upstream **superpowers 同构**：plugin 根目录自带 `.claude-plugin` / `.cursor-plugin` / `.codex-plugin`；Claude cache 与 Cursor/Codex 直装看到同一棵树；**废弃** overrides 专用 `cursor-plugins/` wrapper 双层路径。

在降 token 的同时保持 development 质量：per-task review 略薄（委托 `code-review`），**final whole-branch review 保留**。

## Non-goals

- 不改 upstream superpowers 6.2.0 的 SDD 脚本 / prompt 模板
- 不改 upstream `brainstorming/SKILL.md` 正文
- 不实现 parallel implementer dispatch
- 不引入 Sandcastle
- **pack 不做** kimi / pi / gemini / opencode harness（YAGNI）
- **pack-sp 不做** mattpocock / impeccable wrapper 迁移（无 upstream `.cursor-plugin`）

## Decomposition

| Phase | ID | Design spec | Impl 依赖 | 状态 |
|-------|-----|-------------|-----------|------|
| Override-first 强制增强 | **penf** | [penf design](2026-08-05-sdd-token-efficiency-penf-design.md) | — | **shipped** @ `6.2.0-overrides.12` |
| 多 harness 同包发布 | **pack** | [pack design v1.0](2026-08-05-sdd-token-efficiency-pack-design.md) | penf ship | **shipped** @ `6.2.0-overrides.13` |
| Superpowers Cursor plugin-root | **pack-sp** | [pack-sp design v1.0](2026-08-05-sdd-token-efficiency-pack-sp-design.md) | pack ship | **shipped** @ `6.2.0-overrides.13` |
| 文件 handoff + lean review | **p0** | [p0 design v1.3.1](2026-08-05-sdd-token-efficiency-p0-design.md) | penf ship | **impl complete** @ `feat/sdd` (`642cdc0..be28412`); release pending |
| CLI 物理清空 per task | **p1** | [p1 design v1.2.1](2026-08-05-sdd-token-efficiency-p1-design.md) | **p0 release tag** | [plan](../plans/2026-08-05-sdd-token-efficiency-p1.md) published |
| 薄 orchestrator + 模板 SOT | **p1-slim** | [p1-slim design](2026-08-05-sdd-slim-orchestrator-design.md) | p1 ship | impl complete |

**交付物摘要（charter）**

| ID | 交付物 |
|----|--------|
| penf | CC matcher + expansion；Cursor detect/enforce hooks；self-check；CURSOR-SMOKE |
| pack | plugin 根 `.cursor-plugin` + `.codex-plugin`；manifest generator；emit 单层 contentRoot；删 `cursor-plugins/superpowers-overrides/`；迁移 doc |
| pack-sp | superpowers plugin-root；删 `cursor-plugins/superpowers/`；`cursor-plugins/README.md` hybrid 规则 |
| p0 | H1–H5 cross-cutting + `spor-handoff-writer` + code-review 委托 + SDD Rule 5/6；自适应 diff（Simple=task / Complex=plan） |
| p1 | plugin `bin/`：**cursor+claude full** CLI + 3 stub harness；H6–H8；4-mode 链 |
| p1-slim | Rule 0 CLI/p0 branch；Rule 5 split；executing-plans router；implement.md commit |

### penf → pack 过渡（已知）

penf **当前**通过 oscaner emit **wrapper**（`cursor-plugins/superpowers-overrides/` + `source.json` `cursor.hooks`）发布 Cursor hooks——与 pack 目标（单层 contentRoot）** intentionally 不同**。penf 可先 ship；**pack** 负责 breaking 迁移至 plugin 根 manifest + 删除 wrapper。两者 hook **脚本与逻辑不变**，只改安装拓扑。

### pack 范围摘要（grilling 定论）

| 决策 | 选择 |
|------|------|
| Harness | `.claude-plugin`（已有）+ `.cursor-plugin` + `.codex-plugin` |
| 安装链 | **单层** — Cursor Team Marketplace `source` → `plugins/superpowers-overrides`（读 plugin 内 `.cursor-plugin`）；**删除** `cursor-plugins/superpowers-overrides/` |
| `source.json` | 去掉 overrides 的 `cursor.skills` / `cursor.hooks` 重复字段；manifest 以 plugin 根为准 |
| Manifest 维护 | **Generator 单源** — `package.json` + `.claude-plugin/plugin.json` → 生成 `.cursor-plugin` / `.codex-plugin`（`overrides.manifest.json` 仅 hook 生成）；drift check |
| 路径风格 | 与 upstream superpowers 一致：`./skills/`、`./hooks/hooks-cursor.json`（相对 plugin 根） |
| Breaking | 允许；迁移 doc：`plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md`（reinstall、marketplace 刷新、wrapper 删除） |

### Cursor emit hybrid 规则（v1.9）

| 条件 | Cursor 模式 |
|------|-------------|
| `contentRoot/.cursor-plugin/plugin.json` **存在** | `source.json`: `{ "emitMode": "plugin-root" }`；无 `cursor-plugins/<name>/` |
| **不存在** upstream Cursor manifest | wrapper：`source.json` `cursor.displayName` + `cursor.skills`；emit → `cursor-plugins/<name>/` |

操作手册：[cursor-plugins/README.md](../../../cursor-plugins/README.md)（**pack-sp** 新建）。当前：overrides + superpowers → plugin-root；mattpocock + impeccable → wrapper。

### pack-sp 范围摘要（grilling 定论）

| 决策 | 选择 |
|------|------|
| 动机 | 减 drift — wrapper 对已有 upstream `.cursor-plugin` 的 plugin 是重复声明 |
| 范围 | **仅 superpowers**；submodule 已有 manifest，wrapper 为 `../../` 重写 |
| README | `cursor-plugins/README.md` — 未来 upstream 有 `.cursor-plugin` 时升级 `emitMode` |
| 依赖 | pack impl merge；与 p0 并行 |
| Breaking | Cursor marketplace 刷新（superpowers `source` 路径变） |

### Dependency graph

```
penf (override-first — hook + rules + smoke)
 ├─► pack (overrides plugin-root + generator)
 │    └─► pack-sp (superpowers plugin-root + cursor-plugins/README)
 ├─► p0 (handoff + code-review 委托)     ← impl 可与 pack-sp 并行
 │    └─► p1 (CLI 物理清空)
```

**Serial（implementation）**：

- **penf** 未 ship（release tag + CURSOR-SMOKE blocking）→ 不得 **pack / p0 implementation**。
- **pack** 与 **p0 implementation** 可在 penf ship 后 **并行**。
- **pack-sp** 依赖 **pack impl merge**；与 **p0** 可并行。
- **p1** 依赖 **p0 release tag**（handoff schema 冻结）；impl 不得早于 tag

### Phase gate

1. Overall 分解获批准后，按 phase ID 显式启动：`开始 penf` / `开始 pack` / `开始 pack-sp` / `开始 p0` / `开始 p1`。
2. **不得**在同一 plan 里捆绑多个 phase 的 implementation。
3. **pack** 有独立 phase spec → Rule 1 → user review → writing-plans（**未**在本轮启动）。

## Incident：本 program 的 override skip（penf 动机）

| 项 | 内容 |
|----|------|
| **触发** | `/brainstorming` + user attach **upstream** `brainstorming/SKILL.md` |
| **期望** | 首 tool Read `spor-brainstorming` → Rule 2 grilling → Rule 3 gate → Rule 1 spec review |
| **实际** | 首动 Read upstream / web / 写 spec；inline grilling；无 Rule 1 subagent review |
| **根因摘要** | 见 [penf design](2026-08-05-sdd-token-efficiency-penf-design.md) — **历史动机**；fix 见 penf impl / AC |
| **与 p0 关系** | 同类 failure：orchestrator 跳过外部纪律 |

## Shared artifacts（跨 phase）

| Artifact | 路径 / 名称 | Owner |
|----------|-------------|-------|
| Task handoff | `<sdd-workspace>/task-N-handoff.json` | p0；p1 复用 |
| SDD workspace | upstream `scripts/sdd-workspace` | upstream |
| Ledger | `<workspace>/progress.md` | upstream + p0/p1 |
| CLI 脚本 | `{plugin_root}/bin/sdd-run-task-<harness>.sh` 等 | p1 |
| Override hooks | `hooks/hooks.json` + `hooks/hooks-cursor.json` | penf；plugin-bundled |
| Harness manifests | `.claude-plugin` / `.cursor-plugin` / `.codex-plugin` | **pack**（generator） |
| Cursor marketplace entry (overrides) | ~~`cursor-plugins/superpowers-overrides/`~~ → **contentRoot** | **pack** |
| Cursor marketplace entry (superpowers) | ~~`cursor-plugins/superpowers/`~~ → **contentRoot** | **pack-sp** |
| Self-check | `build/generated/cursor-self-check.mdc` | penf；`spor-init` 分发 |

## Context: Matt 方法论对齐

- **#173 物理清空** — p1 CLI per-task invocation
- **code-review 双轴委托** — p0 Rule 5；**自适应 diff**（Simple=task-scoped，Complex=plan-scoped）；final whole-branch review **保留**（program invariant #4）
- **pack** — 仅 distribution；不改变 SDD handoff 语义

详见 [p0 design](2026-08-05-sdd-token-efficiency-p0-design.md) / [p1 design](2026-08-05-sdd-token-efficiency-p1-design.md)。

## Quality invariants（program 级）

1. **Test evidence gate**（p0）— Simple 软 / Complex+行为变更硬（p0 v1.3）
2. **Plan-mandated conflicts**（p0）
3. **Unverifiable items**（p0）
4. **Final whole-branch review** 保留
5. **Override-first**（penf）
6. **Manifest single source**（pack）— `.cursor-plugin` / `.codex-plugin` 不得手改 drift；`pnpm run validate` 覆盖

## Success metrics

| 指标 | penf | pack | pack-sp | p0 | p1 |
|------|------|------|---------|----|----|
| Cursor/CC override smoke（CURSOR-SMOKE blocking） | 100% | — | — | — | — |
| Claude Code expansion（bare + prefixed） | smoke | — | — | — | — |
| Consumer 无项目 `.cursor/hooks.json` | ✅ | ✅ | ✅ | — | — |
| `pnpm run validate` 全绿 | ✅ ship gate | ✅ ship gate | ✅ ship gate | — | — |
| Claude cache 含 `.cursor-plugin` + `.codex-plugin` | — | ✅ | — | — | — |
| 无 `cursor-plugins/superpowers-overrides/` | — | ✅ | — | — | — |
| 无 `cursor-plugins/superpowers/` | — | — | ✅ | — | — |
| `cursor-plugins/README.md` hybrid 规则 | — | — | ✅ | — | — |
| Manifest generator drift | — | ✅ | — | — | — |
| Orchestrator context 增量（10-task） | — | — | — | ≤40% 基线* | ≤15% 基线* |
| Per-task review token（Complex） | — | — | — | ≤2× Simple† | 同 p0 |

\*Program 级目标；**量化基线与 ship gate 验收**在 p0/p1 **impl plan** 补全（[p0 design v1.3](2026-08-05-sdd-token-efficiency-p0-design.md) Verification 仅为定性走读）。

†p0 已统一 Simple/Complex 为同一 code-review + handoff-writer 链；Complex 仅 diff scope 更宽（plan-scoped）。该指标在 p0 ship gate 测量。

## Change history

| Version | Date | Change |
|---------|------|--------|
| v1.0 | 2026-08-05 | 初始：p0 + p1 |
| v1.1 | 2026-08-05 | p1 CLI plugin-bundled + 分立 harness 脚本 |
| v1.2 | 2026-08-05 | p0 handoff-writer；p1 H6–H8 |
| v1.3 | 2026-08-05 | 新增 **penf** |
| v1.4 | 2026-08-05 | penf：Cursor hook plugin-bundled |
| v1.5 | 2026-08-05 | 新增 **pack**（多 harness 同包 + emit 单层 breaking）；penf 标 impl 完成；grilling：A/A/A/A |
| v1.6 | 2026-08-05 | Rule 1 修订：penf→pack 过渡、spec/impl 依赖分列、success metrics 扩展、pack 迁移 doc 路径 |
| v1.6.1 | 2026-08-05 | Pass 2：success metrics 脚注与 p0 v1.2 Verification 对齐（量化验收 deferred 至 impl plan） |
| v1.7 | 2026-08-05 | pack phase spec v1.0 draft（grilling 10 题 + 设计四段批准） |
| v1.8 | 2026-08-05 | pack impl plan + tickets published |
| v1.9 | 2026-08-05 | 新增 **pack-sp**（superpowers plugin-root + cursor-plugins/README hybrid 规则）；pack 标 impl 完成 |
| v2.0 | 2026-08-05 | pack + pack-sp **shipped** @ `.13`；CURSOR-SMOKE 完成；p0 v1.3（Q7 自适应 diff、Q8 分级 test gate、`spor-handoff-writer` 独立 skill） |
| v2.1 | 2026-08-05 | p1 v1.2 grilling：cursor+claude full / 3 stub BLOCKED；4-mode CLI；impl 门禁 = p0 release tag |
