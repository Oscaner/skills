# Clean Canonical — Overall Spec

- **Version**: v1.2 · 2026-09-11
- **Status**: Draft

## Document scope

Fixture for P4 overall-consistency checks — clean canonical 7-column header,
all of ③/④b/④c pass.

---

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | [#246#issuecomment-1111111111](https://github.com/Oscaner/skills/issues/246#issuecomment-1111111111) | F1 — 锚点形式（含 `#issuecomment-\d+`） |
| P1 | [#231](https://github.com/Oscaner/skills/issues/231) | F4 — link-wrap 裸 `#NNN`（cdd-overhaul 实证形态，④c 宽松放行） |
| P2 | #246（session master body） | F2 — 裸 `#NNN` + 尾随说明文字（④c 宽松放行） |
| P2 | none | F3 — 占位 ref（④c 宽松放行） |

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | phase one scope | P1-design（2026-09-11，v1.0） | Done | acceptance criteria one | 无（program 起点） |
| P2 | phase two scope | [Pending] | [Pending] | acceptance criteria two | P1 |

---

## Dependency graph (ASCII)

```
P1 独立（program 起点）
P2 依赖 P1
```

---

## Change history

| Version | Date | Summary | Author |
|---|---|---|---|
| v1.0 | 2026-09-10 | Initial charter | [human] |
| v1.1 | 2026-09-11 | P1 design spec | [human] |
| v1.2 | 2026-09-11 | P2 implementation plan | [human] |