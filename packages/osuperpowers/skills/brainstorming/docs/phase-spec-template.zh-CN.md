# Phase Spec 模板

> 本文为英文源 `phase-spec-template.md` 的中文可读镜像；AI 始终读取英文源。

**仅增量** —— 单个 phase spec 包含什么。程序级宪章见 [overall-spec-template.md](./overall-spec-template.md)。

> **GATE：** 本 phase spec 由**完整的 brainstorm → plan → dev 周期**产出。仅在 overall 批准后直接跳到实现，属于违反整体流程。

---

## 页眉

```
- **Version**、**Status**（草稿 | 已批准 | 计划待定 | 已交付）
- **Author**、**Parent program**（链接 + 版本）、**Depends on**（上游 + tag）
```

---

## Section 0：增量警告

> 仅为 Phase N 增量。跨 phase 约定见 [overall](link)；冲突时以 overall 为准。

---

## Section 1：约定指针

> 不重复 overall 约定。冲突时以 overall 为准。

---

## Section 2：设计正文

本 phase 的增量：方案、架构、组件、数据流、错误、测试、**验收标准**。

### 验收标准

可验证的完成条件（每条独立可测）。示例形态：
- `产物 X 存在于路径 Y，具属性 Z`
- `命令 C 以 0 退出，输出匹配正则 R`
- `已删除路径 P 无残留的陈旧引用`

---

## Section 3：与 overall 的偏差

| Overall 假设 | Phase 决策 | Overall 已更新？ |
|---|---|---|
| …… | …… | 是 —— vX.Y · date |

当 phase 在跨 phase 事项上偏离时需要。**进入 review 前，Overall 已更新？必须为是。**

---

## Section 4：给下游的备注

后续 phase 的范围变动。分解变动 → 更新 overall + 重跑批准（GATE）。

---

## Section 5：Review

规则：Fresh-Subagent Review Passes 全部通过后，才到用户 review 与 writing-plans。

---

## 依赖图（仅本镜像呈现）

图例：
- `->` = 硬阻塞（前驱交付前，依赖方不得开始）
- `──建议先于──▶` = 仅建议（非阻塞的排序便利）
