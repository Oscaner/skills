# One-Row Mixed — Overall Spec

- **Version**: v1.1 · 2026-09-05
- **Status**: Draft

## Document scope

Fixture for P4 matrix item 11 — cdd v1.27 形态：**同一 change-history 行**同时携带
plan 区间声明（`P1–P4/P6 Implementation plan 列 Pending → Done`）与 design 声明
（`P2 Design spec 列 Pending → P2-design`）。span-mixed 把两类声明拆在两行，
本 fixture 钉死单行混合解析。

---

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | [#246#issuecomment-2222222222](https://github.com/Oscaner/skills/issues/246#issuecomment-2222222222) | F1 — 锚点形式 |

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | phase one scope | [Pending] | Done | acceptance one | 无 |
| P2 | phase two scope | P2-design（2026-09-07，v1.0） | Done | acceptance two | P1 |
| P3 | phase three scope | [Pending] | Done | acceptance three | P2 |
| P4 | phase four scope | [Pending] | Done | acceptance four | 无 |
| P5 | phase five scope | [Pending] | [Pending] | acceptance five | 无 |
| P6 | phase six scope | [Pending] | Done | acceptance six | 无 |

---

## Dependency graph (ASCII)

```
P1 独立
P2 依赖 P1
P3 依赖 P2
P4 独立
P5 独立
P6 独立
```

---

## Change history

| Version | Date | Summary | Author |
|---|---|---|---|
| v1.0 | 2026-09-05 | Initial charter — 六 phase | [human] |
| v1.1 | 2026-09-05 | **四表状态回填（audit closeout）**：Phase inventory P1–P4/P6 Implementation plan 列 Pending → **Done**（PR#1/#2 均已 merge）；P2 Design spec 列 Pending → P2-design；change-history v1.0 降序回归修复 | [human] |