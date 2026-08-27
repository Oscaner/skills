# Skill Digraph Refactor — P5: writing-plans 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use osuperpowers:cli-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite writing-plans SKILL.md to node-anchored format + add regression test for env leak fix.

**Architecture:** Node-anchored SKILL.md (digraph as single control-flow source of truth); each node has Do/Read/Exit/Fail four elements. Remove Checklist + Rules prose + Red Flags triple representation. Delete to-tickets / Read Sub-Skills / Tickets Publish Redirect. Fix spawnCapture env leak (already committed; regression test needed).

**Tech Stack:** Markdown (SKILL.md), Node.js (runner.mjs tests), mermaid digraph

## Global Constraints

- Language policy: SKILL.md English-primary + zh-CN mirror; plan/spec Chinese (Strategy B)
- Path resolution: harness-agnostic — no `$CLAUDE_PLUGIN_ROOT` or other harness-specific variables
- Vendored submodules: no edits to `vendors/`
- Commit discipline: plan approved = commit; no attribution trailers
- Changeset: deferred to P10 (program-level exemption)
- CLI background execution: all cdd-review / cdd-task CLI calls must use background mode
- Tier budgets (tier1 ≤ 225 / tier2 ≤ 320): preserved, no changes in P5

---

### Task 1: Add regression test for spawnCapture env leak fix

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs` (export `spawnCapture`)
- Modify: `packages/osuperpowers/bin/engine/tests/runner.test.mjs` (add test)

**Interfaces:**
- Consumes: `spawnCapture(command, args, { cwd, env })` from runner.mjs
- Produces: test assertion verifying env cleanup

- [ ] **Step 1: Export `spawnCapture` from runner.mjs**

In `packages/osuperpowers/bin/engine/lib/runner.mjs`, add `spawnCapture` to the named exports. Change `function spawnCapture(` to `export function spawnCapture(`.

- [ ] **Step 2: Write regression test**

In `packages/osuperpowers/bin/engine/tests/runner.test.mjs`, add import for `spawnCapture` and a new test block:

```javascript
test("spawnCapture: strips CLAUDE_CODE_SUBAGENT_MODEL from child env", async () => {
  const env = { ...process.env, CLAUDE_CODE_SUBAGENT_MODEL: "qwen3.7-max" };
  const res = await spawnCapture("printenv", ["CLAUDE_CODE_SUBAGENT_MODEL"], { cwd: process.cwd(), env });
  assert.equal(res.ok, false, "printenv should exit non-zero when var is unset");
  assert.ok(!res.stdout.includes("qwen3.7-max"), "CLAUDE_CODE_SUBAGENT_MODEL must not leak to child process");
});

test("spawnCapture: preserves non-subagent env vars", async () => {
  const env = { ...process.env, CDD_CUSTOM_VAR: "hello-test" };
  const res = await spawnCapture("printenv", ["CDD_CUSTOM_VAR"], { cwd: process.cwd(), env });
  assert.equal(res.ok, true);
  assert.match(res.stdout.trim(), /hello-test/);
});
```

- [ ] **Step 3: Run tests to verify**

Run: `node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs`
Expected: all tests pass, including the 2 new spawnCapture tests.

- [ ] **Step 4: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/runner.mjs packages/osuperpowers/bin/engine/tests/runner.test.mjs
git commit -m "test: add spawnCapture env leak regression test (P5)"
```

---

### Task 2: Rewrite writing-plans SKILL.md to node-anchored format

**Files:**
- Rewrite: `packages/osuperpowers/skills/writing-plans/SKILL.md`
- Rewrite: `packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md`

**Interfaces:**
- Consumes: P5 design spec (`docs/superpowers/specs/2026-08-27-skill-digraph-refactor-p5-design.md`)
- Consumes: skill-authoring.md v1.0 (`docs/maintainers/skill-authoring.md`)
- Consumes: P4 brainstorming SKILL.md (`packages/osuperpowers/skills/brainstorming/SKILL.md`) as node-anchored reference
- Produces: node-anchored SKILL.md + zh-CN mirror

- [ ] **Step 1: Rewrite writing-plans SKILL.md**

Replace the entire content of `packages/osuperpowers/skills/writing-plans/SKILL.md` with the node-anchored version following the P5 design spec §2-§6. Structure:

```
---
name: writing-plans
description: Independent plan-writing orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Reads upstream superpowers:writing-plans as baseline, layers personal rules (section-by-section writing / plan-review / commit discipline). Callable standalone; triggered by /writing-plans via overrides router.
---

# Osuperpowers Writing-Plans

Full plan-writing flow orchestration, callable standalone.

## Flow Digraph

[mermaid digraph from spec §2]

## Node Definitions

### `read-upstream`
[spec §3 content, English-primary]

### `write-plan`
[spec §3 content]

### `plan-review`
[spec §3 content]

### `user-ok?`
[spec §3 content]

### `commit-plan`
[spec §3 content]

## Invariants

[spec §4 table, English-primary]

## Failure Modes

[spec §5 table, English-primary]
```

Key requirements:
- No `## Checklist`, `## Rules`, `## Red Flags`, or `<HARD-GATE>` sections
- All rules embedded in node Do/Read/Exit/Fail fields or Invariants table
- Path resolution: harness-agnostic strategy description (no `$CLAUDE_PLUGIN_ROOT`)
- `read-upstream` Exit: missing → BLOCKED (with install guidance)
- `plan-review` Do: includes full Review Stopping description + D1/D2/D3 references
- `commit-plan` Do: plan approved = commit immediately (I3)
- All section headings match node IDs exactly

- [ ] **Step 2: Rewrite SKILL.zh-CN.md**

Replace the entire content of `packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md` with the Chinese mirror of the English source. Must match section-for-section, node-for-node.

- [ ] **Step 3: Run emit + validate**

Run: `pnpm run emit && pnpm run validate`
Expected: all checks green.

- [ ] **Step 4: Terminal sweep verification**

Run all 7 grep patterns against `packages/osuperpowers/skills/writing-plans/`:

```bash
grep -r 'HARD-GATE' packages/osuperpowers/skills/writing-plans/  # expect 0
grep -r '## Rules' packages/osuperpowers/skills/writing-plans/  # expect 0
grep -r '## Red Flags' packages/osuperpowers/skills/writing-plans/  # expect 0
grep -r '## Checklist' packages/osuperpowers/skills/writing-plans/  # expect 0
grep -r 'to-tickets' packages/osuperpowers/skills/writing-plans/  # expect 0
grep -r 'Tickets Publish' packages/osuperpowers/skills/writing-plans/  # expect 0
grep -r 'Read Sub-Skills' packages/osuperpowers/skills/writing-plans/  # expect 0
```

Expected: all 7 patterns return zero matches.

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/skills/writing-plans/
git commit -m "refactor: rewrite writing-plans to node-anchored format (P5)"
```
