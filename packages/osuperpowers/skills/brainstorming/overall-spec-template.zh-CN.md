# Overall Spec 模板（总览级）

> 本文为英文源 `overall-spec-template.md` 的中文可读镜像；AI 始终读取英文源。

**仅文档结构** —— 一个 overall（程序级）spec 包含什么。逐 phase 的增量写在 [phase-spec-template.md](./phase-spec-template.md)。起草多 phase 程序前两份都要读。

---

## 语言

用**用户的语言**撰写（标题、标签、状态、blockquote）。不要默认任何固定 locale。下方占位符本地化；phase ID、tag、SHA、路径保持 locale-neutral。

---

## 页眉

```
- **Version**：vX.Y · YYYY-MM-DD
- **Status**：草稿 | 已批准 | 进行中 | 已完成
- **Author**：[人类] · [撰写时的 harness + 模型]
- **Constraints**：[项目级约束，每行一条]
```

次版本号递增：分解、范围变动、phase 完成。主版本号递增：程序目标 / 约束重写。

---

## 文档范围

仅宪章 —— 不含实现细节。
- **Overall 批准 ≠ 任何 phase 已开始**（GATE）。
- 偏差先在此更新，再同步到 overall。

---

## 文件路径

`docs/superpowers/` 下一个**程序日期** + **功能 slug**：

| 产物 | 路径 |
|---|---|
| Overall | `specs/YYYY-MM-DD-<feature>-overall.md` |
| Phase spec | `specs/YYYY-MM-DD-<feature>-<phase-id>-design.md` |
| Phase plan | `plans/YYYY-MM-DD-<feature>-<phase-id>.md` |
| Phase tickets | `tickets/YYYY-MM-DD-<feature>-<phase-id>-tickets.md` |

`<phase-id>` 小写（`p1`、`p2a`……）。文件一旦存在，清单列即链接至此。

---

## 程序宪章

目标（1–3 句）、非目标、跨领域约束。**排除：**验收标准、API 形态、组件设计、任务。

---

## 问题清单

每个已知问题 / 已发现需求，映射到解决它的 phase：

| Phase | 问题（引用） | 标题摘要 |
|---|---|---|
| P1 | [#NNN](url) | 单行摘要 |
| P2 | none（dogfood 会话 YYYY-MM-DD 发现） | 单行摘要 |

---

## Phase 清单

| # | Phase | 范围 | 设计 spec | 实施计划 | 验收标准 | 依赖 |
|---|---|---|---|---|---|---|
| P1 | [一段式范围] | [Pending]/link | [Pending]/link | [可验证完成条件] | [硬阻塞或软建议，引用图] |

- 范围列：仅分解上下文。
- **拆分：** 在子 phase 工作继续前，用 Na、Nb 替换父行。
- 单元格：Pending → link；交付时仅在**计划**单元格打完成标记。
- **验收标准**：该 phase 的可验证条件（不是"代码存在即完成"）。
- **依赖**：引用图节点 + 是否硬（`->`）或软（`──建议先于──▶`）。

---

## 依赖图（ASCII）

```
P1 -> P2        (硬阻塞：P2 需要 P1 的规则)
P1 ──建议先于──▶ P5  (软建议：P1 交付后 P5 更易)
```

图例：
- `->` = 硬阻塞（前驱交付前，依赖方不得开始）
- `──建议先于──▶` = 仅建议（非阻塞的排序便利）

新增 / 拆分 / 重排时与清单同步。

---

## 边界规则

> 每个 phase：完整 brainstorm → plan → dev。交付后依赖方才开始。
> phase 期间产生的需求变更（dev 阶段发现的新需求、新问题、新约束）必须先反馈回本 overall spec，才能继续实现 —— 版本递增 + 变更历史条目 + 同步受影响的 phase 验收 / 依赖。不要实现尚未同步反馈的 phase 中期变更。

---

## 维护

- 按 phase 更新链接 + 变更历史；不要任务清单。
- 跨 phase 约定的主控 spec；phase spec 为增量。
- 策略变动与拆分**立即**反馈（同步到 overall）。phase 中期需求变更属于策略变动 —— 同等即时性（见边界规则）。

---

## 变更历史

仅追加：完成、分解、范围变动、状态转移、phase 中期反馈。
