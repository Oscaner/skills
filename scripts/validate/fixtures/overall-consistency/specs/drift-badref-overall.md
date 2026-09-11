# Drift Bad Ref — Overall Spec

- **Version**: v1.0 · 2026-09-11
- **Status**: Draft

## Document scope

Fixture for P4 check ④c — Issue inventory ref 畸形锚点 `#246#issuecomment-abc`
（`#issuecomment-` 后非数字）。

---

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | #246#issuecomment-abc | F1 — 畸形锚点（非数字 comment id） |
| P2 | [#246#issuecomment-1111111111](https://github.com/Oscaner/skills/issues/246#issuecomment-1111111111) | F2 — 正常锚点形式 |
| P2 | none | F3 — 占位 ref |

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
```

---

## Change history

| Version | Date | Summary | Author |
|---|---|---|---|
| v1.0 | 2026-09-10 | Initial charter | [human] |