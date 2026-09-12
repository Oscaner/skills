# Drift Missing Doc — Overall Spec

- **Version**: v1.1 · 2026-09-11
- **Status**: Draft

## Document scope

Fixture for P4 check ② — Phase inventory P1 Implementation plan 列 `Done`
（非 Pending），但 `plans/` 下不存在 `*-drift-missingdoc-p1.md`（plan 文档缺失）。

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
| P1 | phase one scope | [Pending] | Done | acceptance criteria one | 无 |
| P2 | phase two scope | [Pending] | [Pending] | acceptance criteria two | P1 |

---

## Dependency graph (ASCII)

```
P1 独立
P2 依赖 P1
```

---

## Change history

| Version | Date | Summary | Author |
|---|---|---|---|
| v1.0 | 2026-09-10 | Initial charter | [human] |
| v1.1 | 2026-09-11 | P1 plan 列回填（[Pending]→Done）但 plan 文档未落盘 | [human] |