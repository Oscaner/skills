# README Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the repo README and add bilingual sub-READMEs for `superpowers-overrides` — four Markdown files that tell the origin story, document usage, and cross-link correctly.

**Architecture:** User-first main README (story + generic quick start); detail-heavy sub-README (mermaid workflow + phase-grouped skills + harness specifics). English files written first as source; Chinese files mirror structure with natural prose.

**Tech Stack:** Markdown only. No manifest or generator changes expected.

**Spec:** [`docs/superpowers/specs/2026-08-01-readme-rewrite-design.md`](../specs/2026-08-01-readme-rewrite-design.md)

## Global Constraints

- Four files, structurally mirrored EN/ZH pairs; update all in one change set.
- Language switcher at top: `[English](README.md) | [简体中文](README.zh-CN.md)` (adjust relative paths per file location).
- Cross-references stay same-language (ZH main → ZH sub).
- Core triangle only — no `impeccable` on main README.
- Main README: harness-agnostic quick start; no Claude-only `/superpowers:*` or Cursor-only `/spor-*` in body except `/spor-init` as entry-point name.
- Main README ASCII pipeline = conceptual (includes overall/phase); sub README mermaid = simplified per-phase intercept chain (not full skill inventory).
- Maintainers section on main README ≤ 5 lines.
- License verbatim: *Personal use. No warranty. Adapt freely for your own setup.*
- Target lengths: main ~85–95 lines; sub ~110–130 lines per language.

## File map

| File | Action |
|------|--------|
| `README.md` | Rewrite |
| `README.zh-CN.md` | Create |
| `plugins/superpowers-overrides/README.md` | Create |
| `plugins/superpowers-overrides/README.zh-CN.md` | Create |

---

### Task 1: English main README

**Files:**
- Modify: `README.md` (full rewrite)

**Interfaces:**
- Produces: English main README with sections listed below; links to `plugins/superpowers-overrides/README.md`.

- [ ] **Step 1: Full-file rewrite**

Replace entire `README.md` in one Write (not incremental patch). Step list below is the required section outline for that file.

Keep CI badge. Add language switcher linking to `README.zh-CN.md`. Hero: *Combine superpowers' full workflow with mattpocock's precision — engineered via superpowers-overrides.*

- [ ] **Step 2: Write § Why this exists**

Three short paragraphs: superpowers (full workflow), mattpocock-skills (focused delegates), gap + overrides + overall/phase.

- [ ] **Step 3: Write § The pipeline**

ASCII block:

```
Overall spec → Phase spec → Plan → SDD/TDD → Verify → Ship
```

One line on overrides (grilling + subagent review) and mattpocock delegation. Link to sub-README.

- [ ] **Step 4: Write § Installation**

Marketplace install commands + clone/submodule block from spec. Drop submodule bump line (maintainers link covers it).

- [ ] **Step 5: Write § Quick start**

Three harness-agnostic steps. Step 2 links to `plugins/superpowers-overrides/README.md#usage`.

- [ ] **Step 6: Write § Learn more, § Maintainers, § License**

Learn more → sub-README. Maintainers ≤ 5 lines with exact command: `pnpm run generate:overrides && pnpm run emit && pnpm run validate`; links to `.changeset/README.md` and `CLAUDE.md`. License verbatim.

- [ ] **Step 7: Line-count check**

Target ~85–95 lines. Trim if over.

**Note:** Deprecated sections from old README must not appear in the new file (no separate delete step needed when using full-file rewrite).

---

### Task 2: English sub-README

**Depends on:** None (may run in parallel with Task 1)

**Files:**
- Create: `plugins/superpowers-overrides/README.md`

**Interfaces:**
- Consumes: English main README links here.
- Produces: Sub-README with mermaid, 13-skill phase table, Claude/Cursor usage.

- [ ] **Step 1: Header + language switcher**

Link to `README.zh-CN.md` (same directory). One-line subtitle: what overrides do in one sentence.

- [ ] **Step 2: Write § What overrides do**

2–3 paragraphs: intercept before upstream; replace vs delegate; three enforcement layers (one sentence each).

- [ ] **Step 3: Write § Workflow**

Intro sentence: simplified main-path diagram, not complete inventory. Paste mermaid from spec. Paragraph on overall + phase (not in diagram).

- [ ] **Step 4: Write § Skills by phase**

Markdown table — all 13 skills from spec; one-line descriptions match spec table verbatim (including parenthetical notes on receiving-code-review and cross-cutting skills).

- [ ] **Step 5: Write § Usage**

Common (3 steps). Claude Code subsection (`/superpowers:*`, `/superpowers-overrides:spor-init`, CLAUDE.md). Cursor subsection (`/spor-*`, `.cursor/rules/superpowers-overrides.mdc`, links to `docs/cross-harness-overrides.md` and `docs/CURSOR-SMOKE.md`).

- [ ] **Step 6: Write § Docs for maintainers**

Links to `docs/cross-harness-overrides.md`, `../../CLAUDE.md`, `CHANGELOG.md`.

- [ ] **Step 7: Line-count check**

Target ~110–130 lines.

---

### Task 3: Chinese main README

**Depends on:** Task 1 (structure template)

**Files:**
- Create: `README.zh-CN.md`

**Interfaces:**
- Consumes: `README.md` structure as template.
- Produces: Chinese main README; links to `plugins/superpowers-overrides/README.zh-CN.md`.

- [ ] **Step 1: Mirror heading hierarchy from `README.md`**

Same sections in same order. Language switcher links back to `README.md`.

- [ ] **Step 2: Write § Why this exists (ZH)**

Natural Chinese — not literal translation.

- [ ] **Step 3: Write § The pipeline + § Installation (ZH)**

Same ASCII block; localized prose around it.

- [ ] **Step 4: Write § Quick start + § Learn more (ZH)**

Step 2 links to `plugins/superpowers-overrides/README.zh-CN.md#用法`.

- [ ] **Step 5: Write § Maintainers + § License (ZH)**

Maintainers ≤ 5 lines; license meaning preserved.

- [ ] **Step 6: Line-count check**

Target ~85–95 lines; parity with English main.

---

### Task 4: Chinese sub-README

**Depends on:** Task 2 (structure template)

**Files:**
- Create: `plugins/superpowers-overrides/README.zh-CN.md`

**Interfaces:**
- Consumes: `plugins/superpowers-overrides/README.md` structure as template.
- Produces: Chinese sub-README with same mermaid block (English node labels OK).

- [ ] **Step 1: Mirror English sub-README sections**

语言切换链到 `README.md`。章节标题中文化（如「用法」「按阶段划分的 Skills」）。

- [ ] **Step 2: Write § What overrides do + § Workflow (ZH)**

Same mermaid block; localized intro paragraphs.

- [ ] **Step 3: Write § Skills by phase (ZH)**

Chinese column headers; skill names and descriptions aligned with English table.

- [ ] **Step 4: Write § Usage + § Docs for maintainers (ZH)**

Mirror Claude/Cursor subsections; same relative links.

- [ ] **Step 5: Line-count check**

Target ~110–130 lines.

---

### Task 5: Verification

**Depends on:** Tasks 1–4 (run after all four README files exist; do not commit per-task — single change set)

**Files:**
- Read-only checks across all four README files

- [ ] **Step 1: Spec verification checklist**

- [ ] All four files exist with mirrored heading structure
- [ ] Language switchers work (relative paths correct from each file location)
- [ ] Main README links to sub-README in matching language
- [ ] Installation commands match marketplace (`oscaner/skills`)
- [ ] All 13 skills on sub-README phase table; mermaid renders on GitHub
- [ ] No `impeccable` mention on main README
- [ ] Maintainers section ≤ 5 lines on main README
- [ ] `pnpm run validate` passes

- [ ] **Step 2: Run `pnpm run validate`**

Confirm no accidental manifest drift. Expected: pass unchanged.

- [ ] **Step 3: Spot-check link targets**

From repo root: main EN/ZH → sub EN/ZH. From sub dir: maintainer links resolve.

- [ ] **Step 4: Optional commit**

Only if user requests: `docs: rewrite bilingual README and superpowers-overrides sub-README`.

