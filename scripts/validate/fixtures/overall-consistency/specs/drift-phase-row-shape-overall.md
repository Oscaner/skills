# Row-Shape Drift — Overall Spec

- **Version**: v1.1 · 2026-09-21
- **Status**: Draft

## Document scope

Fixture for the row-shape guard: P2's scope is split across two cells (9 split tokens)
while the file norm is 8 — the drift that silently misaligns design/plan/dependency
readings while all value columns are [Pending].

---

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | none | shape fixture |

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | phase one scope | P1-design（2026-09-21，v1.0） | [Pending] | acceptance criteria one | 无（program 起点） |
| P2 | phase two scope | second scope fragment | [Pending] | [Pending] | acceptance criteria two | P1 |

---

## Dependency graph (ASCII)

```
P1 独立（program 起点）
P2 -> P1
```

---

## Change history

| Version | Date | Summary |
|---|---|---|
| v1.1 | 2026-09-21 | fixture（shape-drift pinned） |