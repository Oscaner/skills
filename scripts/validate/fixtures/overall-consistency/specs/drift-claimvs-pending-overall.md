# Drift Claim vs Pending — Overall Spec

- **Version**: v1.1 · 2026-09-11
- **Status**: Draft

## Document scope

Fixture for P4 check ① forward — change history 声明 `P1 Implementation plan
列回填 [Pending]→Done`，但 Phase inventory P1 plan 列仍为 `[Pending]`
（claim→列 双向正向违例）。

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
| P1 | phase one scope | [Pending] | [Pending] | acceptance criteria one | 无 |
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
| v1.1 | 2026-09-11 | Phase inventory P1 Implementation plan 列回填（[Pending]→Done）——但 P1 plan 列未同步 | [human] |