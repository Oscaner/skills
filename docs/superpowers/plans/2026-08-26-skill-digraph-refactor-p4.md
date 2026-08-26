# Skill Digraph Refactor — P4: brainstorming 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `osuperpowers:cli-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite brainstorming SKILL.md from HARD-GATE checklist + Rules prose + Red Flags triple representation into node-anchored format (digraph as single source of truth), with block policy enforcement, harness-agnostic path resolution, and per-file line guard removal.

**Architecture:** Node-anchored SKILL.md with mermaid flowchart digraph (12 operation/decision nodes + 3 terminal states + 2 BLOCKED terminals). Each node carries Do/Read/Exit/Fail four elements. Invariants (≤5) capture cross-node constraints. Failure Modes table captures cross-node error behavior.

**Tech Stack:** Markdown (SKILL.md + zh-CN mirror), Mermaid (digraph), Node.js test (templates.test.mjs), pnpm emit chain.

## Global Constraints

- Language policy: SKILL.md English-primary + zh-CN mirror; plan/spec Chinese (Strategy B)
- Path resolution: harness-agnostic — no `$CLAUDE_PLUGIN_ROOT` or other harness-specific variables
- Vendored submodules: no edits to `vendors/`
- Commit discipline: spec approved = commit; plan approved = commit; no attribution trailers
- Changeset: deferred to P10 (program-level exemption)
- Tier budgets (tier1 ≤ 225 / tier2 ≤ 320): preserved, no changes in P4

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/osuperpowers/bin/engine/tests/templates.test.mjs` | Modify | Remove per-file line count governance test |
| `packages/osuperpowers/skills/brainstorming/SKILL.md` | Rewrite | Node-anchored format (primary English source) |
| `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md` | Rewrite | Chinese mirror (sync with English source) |

---

### Task 1: Remove Per-File Line Count Governance Test

**Files:**
- Modify: `packages/osuperpowers/bin/engine/tests/templates.test.mjs:121-131`

**Interfaces:**
- Consumes: none (test-only change)
- Produces: removed test `governance: 技能 + 模板行数上限（防 runaway prose）`

- [ ] **Step 1: Read current test file to locate exact lines**

Read `packages/osuperpowers/bin/engine/tests/templates.test.mjs` and locate the `governance: 技能 + 模板行数上限（防 runaway prose）` test block (lines 121-131). This test contains two assertions:
- `skills/${ent.name}/SKILL.md` ≤ 200 lines
- `templates/cdd/${f}` ≤ 60 lines

- [ ] **Step 2: Delete the test block**

Delete the entire `test("governance: 技能 + 模板行数上限（防 runaway prose）", () => { ... })` block (lines 121-131). Keep all surrounding tests intact:
- Keep: `governance: 真实行预算` (lines 103-113)
- Keep: `governance: wcLines 空/纯空白文件 → 0` (lines 115-119)
- Keep: `governance: D3/review/fix 语义锚点 + 禁用措辞` (lines 133-168)
- Keep: `governance: branch-review 模板基线标注` (lines 170-180)

- [ ] **Step 3: Run tests to verify no regressions**

Run: `node --test packages/osuperpowers/bin/engine/tests/templates.test.mjs`
Expected: All remaining tests PASS. The removed test should no longer appear in output.

- [ ] **Step 4: Run full validate**

Run: `pnpm run validate`
Expected: ALL PASS (12 blocks).

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/engine/tests/templates.test.mjs
git commit -m "test: remove per-file line count governance guard (P4 prerequisite)"
```

---

### Task 2: Rewrite brainstorming SKILL.md + zh-CN + Validate

**Files:**
- Rewrite: `packages/osuperpowers/skills/brainstorming/SKILL.md`
- Rewrite: `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md`

**Interfaces:**
- Consumes: Task 1 (line guard removed so governance test won't fail)
- Produces: node-anchored brainstorming SKILL.md conforming to `docs/maintainers/skill-authoring.md` v1.0

- [ ] **Step 1: Write English brainstorming SKILL.md (node-anchored)**

Rewrite `packages/osuperpowers/skills/brainstorming/SKILL.md` with the following structure per P4 design spec §2-§6:

```markdown
---
name: brainstorming
description: Independent brainstorm orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Reads upstream superpowers:brainstorming as baseline, layers personal rules (grilling / overall-phase routing / spec-review / commit discipline). Callable standalone; triggered by /brainstorming via overrides router.
---

# Osuperpowers Brainstorming

Full brainstorm flow orchestration, callable standalone.

## Flow Digraph

[mermaid digraph from P4 spec §2]

## Node Definitions

[12 nodes × Do/Read/Exit/Fail from P4 spec §3]

## Invariants

[5 invariants from P4 spec §4]

## Failure Modes

[4 failure modes from P4 spec §5]
```

**Key content requirements:**
- `read-upstream`: harness-agnostic path resolution (harness plugin system → vendored fallback). Missing → BLOCKED (install superpowers plugin). Read, not Skill-invoke (I1).
- `read-sub-skills`: harness-agnostic path resolution. Missing → BLOCKED (install mattpocock-skills).
- `explore-context`: research delegation embedded in Do field (identify → ask user → spawn → wait → output).
- `grilling`: verbatim grilling SKILL.md framework. No option menus / structured choice lists.
- `spec-review`: 3-pass CLI dispatch + D1/D2/D3 + Review Stopping (blocker-driven re-run only; warn/nit never trigger re-run; I5).
- `commit-spec`: spec approved = commit immediately (I4).
- `overall-spec?`: overall spec → HANDOFF: brainstorming (next phase); single spec → HANDOFF: writing-plans.
- No `## Rules` section. No `## Red Flags` section. No `<HARD-GATE>` checklist. No `## Checklist`.

- [ ] **Step 2: Write Chinese mirror SKILL.zh-CN.md**

Translate the English source to Chinese, preserving structure (digraph, node definitions, invariants, failure modes). Same frontmatter structure with Chinese description. Mirror must include all node Do/Read/Exit/Fail fields translated.

- [ ] **Step 3: Dead link check**

Run:
```bash
grep -rn 'subagent-lifecycle' packages/osuperpowers/skills/brainstorming/
```
Expected: zero matches (P3 dead link naturally eliminated by rewrite).

Also verify no stale references remain:
```bash
grep -rn '\.\./docs/' packages/osuperpowers/skills/brainstorming/
```
Expected: zero matches (old `../docs/*` paths replaced by `./docs/*` or removed).

- [ ] **Step 4: Run emit + validate**

```bash
pnpm run emit && pnpm run validate
```
Expected: ALL PASS (12 blocks). Emit regenerates `.agents/skills/brainstorming/` from source.

- [ ] **Step 5: Terminal sweep preview**

Run 5 grep patterns (P10 scope preview against brainstorming directory):
```bash
grep -rn 'HARD-GATE' packages/osuperpowers/skills/brainstorming/
grep -rn '## Rules' packages/osuperpowers/skills/brainstorming/
grep -rn '## Red Flags' packages/osuperpowers/skills/brainstorming/
grep -rn '## Checklist' packages/osuperpowers/skills/brainstorming/
grep -rn 'subagent-lifecycle' packages/osuperpowers/skills/brainstorming/
```
Expected: all 5 return zero matches.

- [ ] **Step 6: Commit**

```bash
git add packages/osuperpowers/skills/brainstorming/SKILL.md packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md .agents/
git commit -m "refactor: rewrite brainstorming to node-anchored format (P4)"
```

---

## Acceptance Criteria Verification

After both tasks complete, verify all 9 acceptance criteria:

| # | Criterion | Verification |
|---|---|---|
| 1 | skill-authoring.md v1.0 conformance | Digraph nodes ↔ sections 1:1; no `## Rules` prose; no `## Red Flags` |
| 2 | Upstream missing → BLOCKED (install guide) | `read-upstream` node Exit + Failure Modes table |
| 3 | Grilling missing → BLOCKED (install guide) | `read-sub-skills` node Exit + Failure Modes table |
| 4 | overall→phase routing in digraph | `overall-spec?` → HANDOFF: brainstorming edge visible |
| 5 | Review Stopping in spec-review node | `spec-review` Do/Exit/Fail: blocker-driven re-run, warn/nit no re-run |
| 6 | Spec commit discipline in commit-spec node | `commit-spec` Do: "spec approved = commit" |
| 7 | zh-CN mirror synced | SKILL.zh-CN.md has matching structure |
| 8 | emit + validate green | `pnpm run emit && pnpm run validate` ALL PASS |
| 9 | Per-file line guard removed | `governance: 技能 + 模板行数上限` test absent from templates.test.mjs |
