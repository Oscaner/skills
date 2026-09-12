# Span Mixed — Overall Spec

- **Version**: v1.2 · 2026-09-05
- **Status**: Draft

## Document scope

Fixture for P4 checks ①/② — green carrier for bracket-optional claim
（`Implementation plan Pending → Done`）、range expansion（`P1–P4/P6`）、
cross-date phase docs（overall 2026-09-05 → p2 plan 2026-09-07）与 design
cross-ref 忽略（`P2-design（…，源 P3-design…）` 只断言自身 p2 design 文档）。

---

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | [#246#issuecomment-1111111111](https://github.com/Oscaner/skills/issues/246#issuecomment-1111111111) | F1 — 锚点形式 |

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | phase one scope | [Pending] | Done | acceptance criteria one | 无 |
| P2 | phase two scope | P2-design（2026-09-07，源 P3-design 跨引用） | Done | acceptance criteria two | P1 |
| P3 | phase three scope | [Pending] | Done | acceptance criteria three | P2 |
| P4 | phase four scope | [Pending] | Done | acceptance criteria four | 无 |
| P5 | phase five scope | [Pending] | [Pending] | acceptance criteria five | 无 |
| P6 | phase six scope | [Pending] | Done | acceptance criteria six | 无 |

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
| v1.1 | 2026-09-05 | Phase inventory P1–P4/P6 Implementation plan 列 Pending → **Done**（回填审计，跨日期 plan 文档经 slug 后缀 glob 命中） | [human] |
| v1.2 | 2026-09-07 | P2 Design spec 列 [Pending] → P2-design（design spec shipped） | [human] |