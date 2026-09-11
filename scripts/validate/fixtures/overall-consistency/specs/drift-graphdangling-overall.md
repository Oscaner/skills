# Drift Graph Dangling — Overall Spec

- **Version**: v1.0 · 2026-09-11
- **Status**: Draft

## Document scope

Fixture for P4 check ④b — Dependency graph ASCII block 引用 `P9`（Phase
inventory 无 → dangling graph token）。

---

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | [#246#issuecomment-1111111111](https://github.com/Oscaner/skills/issues/246#issuecomment-1111111111) | F1 — 锚点形式 |
| P2 | #246（session master body） | F2 — 裸 `#NNN` + 尾随说明文字 |

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | phase one scope | P1-design | Done | acceptance criteria one | 无 |
| P2 | phase two scope | [Pending] | [Pending] | acceptance criteria two | P1 |

---

## Dependency graph (ASCII)

```
P1 独立
P2 依赖 P1
P9 独立（dangling — 不在 Phase inventory）
```

---

## Change history

| Version | Date | Summary | Author |
|---|---|---|---|
| v1.0 | 2026-09-10 | Initial charter | [human] |