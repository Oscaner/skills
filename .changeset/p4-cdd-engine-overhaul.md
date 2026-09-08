---
"@oscaner-skills/osuperpowers": minor
---

feat(osuperpowers): P4 report-issue 双通道重构 + finding-meta 渲染器 + 方法论规范 + Enh K 全量回顾

- **Report-issue dual-channel rewrite**: program channel (→ phase-owning issue, e.g. #232) vs session channel (→ find-or-create `[Session report] <slug|standalone> <date>` master with labels `session`, `osuperpowers`); new digraph `analyze → classify → confirm → resolve-destination → {program · session} → dedup → append-comment → report`; no resolve-hit, no `gh issue reopen`, no `dogfood,<type>[,cdd]` labels; `.superpowers/cdd/<slug>/report-target.json` cache (CDD scope only; standalone never reuses); never-reopen dedup (`Regression / follow-up of #NNN (closed)`); derived report-meta six fields (skill/harness/kind/step/cdd/date) + privacy code (no branch/abs-path/filename auto-included); all gh ops `--repo Oscaner/skills`.
- **Template single source of truth**: `report-issue/templates/finding-meta.json` canonical → `scripts/report-templates.mjs` pure renderers (renderYml / renderTitle / renderComment / renderMasterBody / renderSummaryTable, `--mode` stdin CLI) → emit-generated `.github/ISSUE_TEMPLATE/*.yml`; four legacy `report-issue/templates/*.md` removed; emit + `emit:check` drift guard.
- **Methodology spec**: `docs/maintainers/data-driven-templates.md` (digraph + Rules + Invariants + Failure Modes + Exemplars) + CLAUDE.md pointer + `skill-authoring.md` reference.
- **Enh K full-scope issue retrospective**: brainstorming `explore-context` enumerates every unique inventory `#NNN` (including Side-effect closures) and reads full body + all comments; anchors are lookup entries only (no anchor-picking), fail-open.
- **Enh R pre-consumed** (accounting-only; implemented via P3 9dc2ccd) + **Enh V/W superseded** confirmed; old-vocabulary (PASS=/docs-review.md/D1-3, resolve-hit, gh issue reopen) purge guard green.
