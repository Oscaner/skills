# P13 Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use osuperpowers:cli-driven-development to implement this plan task-by-task.

**Goal:** Execute the P13 closure phase — grep sweep regression, docs cleanup, skill-authoring English conversion, tier re-baseline, governance tests, and unified changeset.

**Architecture:** 5 CDD tasks, each independently verifiable. Tasks 1-4 produce code/docs changes; Task 5 is the closeout (changeset + emit + validate). All CLI calls use `node {pluginRoot}/bin/engine/cdd-task.mjs --harness <name> --task N --mode implement`.

**Tech Stack:** Node.js, mermaid parser (regex-based), grep, git

## Global Constraints

- P13 design spec v1.0 Approved: `docs/superpowers/specs/2026-08-30-skill-digraph-refactor-p13-design.md`
- Overall spec v1.23: `docs/superpowers/specs/2026-08-24-skill-digraph-refactor-overall.md`
- Exclude `CHANGELOG.md` (append-only), `bin/engine/tests/` (only `--prompt` literals), `docs/superpowers/{specs,plans,tickets}/` (historical)
- `pnpm run emit && pnpm run validate` must pass after each task
- All SKILL.md files must comply with `docs/maintainers/skill-authoring.md`
- Language: English primary (Strategy A) for SKILL.md and docs; Chinese mirror (`.zh-CN.md`) where applicable

---

### Task 1: Grep Sweep + Docs Cleanup

**Files:**
- Delete: `docs/research/2026-08-10-harness-hooks-matrix.md`
- Delete: `docs/research/2026-08-10-harness-marketplace-hooks.md`
- Delete: `docs/research/2026-08-16-harness-plugin-availability.md`
- Delete: `docs/research/2026-08-18-bilingual-file-organization.md`
- Modify: `docs/maintainers/osuperpowers-plugin.md` (lines 60-66: skill flow + tickets)
- Modify: `docs/maintainers/osuperpowers-plugin.zh-CN.md` (lines 60-66: Chinese mirror sync)
- Modify: `docs/gate-install.md` (line 251: trigger name)

**Interfaces:**
- Consumes: P13 design spec Section 1a token list + Section 1b docs cleanup list
- Produces: Clean in-scope tree (all P13 tokens verified zero via grep)

- [ ] **Step 1: Delete docs/research/ directory**

```bash
rm -rf docs/research/
ls docs/research/ 2>/dev/null || echo "docs/research/ deleted successfully"
```

- [ ] **Step 2: Fix osuperpowers-plugin.md skill flow (EN)**

Edit `docs/maintainers/osuperpowers-plugin.md`:
- Line 60: Change `brainstorming --> writing-plans --> subagent-driven-development` to `brainstorming --> writing-plans --> cli-driven-development`
- Lines 64-66: Delete these 3 lines verbatim:
  ```
  - `docs/superpowers/tickets/` -- `YYYY-MM-DD-<feature>-tickets.md`, output of the `/to-tickets` publish step when the writing-plans Rule 3c quiz picks "publish to local file" (the directory is created on first use).
  
  The three share the same date + feature slug so a spec, its plan, and its tickets sort together. `writing-plans` Rule 3b hard-codes the tickets path; don't publish tickets anywhere else, and don't write these docs at repo root.
  ```

- [ ] **Step 3: Fix osuperpowers-plugin.zh-CN.md skill flow (zh-CN mirror)**

Apply the same changes as Step 2 to the Chinese mirror file.

- [ ] **Step 4: Fix gate-install.md trigger name**

Edit `docs/gate-install.md` line 251: Change `/subagent-driven-development` to `/cli-driven-development`

- [ ] **Step 5: Quick verification — docs cleanup complete**

```bash
ls docs/research/ 2>/dev/null && echo "FAIL" || echo "OK: docs/research/ deleted"
grep -c "subagent-driven-development" docs/maintainers/osuperpowers-plugin.md 2>/dev/null | xargs -I{} echo "osuperpowers-plugin.md subagent-dev count: {} (expect 0)"
grep -c "/subagent-driven-development" docs/gate-install.md 2>/dev/null | xargs -I{} echo "gate-install.md subagent-dev count: {} (expect 0)"
```

> Note: comprehensive automated grep sweep regression test is in Task 4.

- [ ] **Step 6: Run emit + validate**

```bash
pnpm run emit && pnpm run validate
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix(docs): P13 grep sweep cleanup — delete docs/research/, fix stale maintainer refs"
```

---

### Task 2: skill-authoring.md English Conversion + zh-CN Mirror

**Files:**
- Modify: `docs/maintainers/skill-authoring.md` (full rewrite: Chinese → English)
- Create: `docs/maintainers/skill-authoring.zh-CN.md` (mirror of English, Chinese content)
- Modify: `CLAUDE.md` (language architecture: Strategy B extension exception)

**Interfaces:**
- Consumes: Current Chinese `docs/maintainers/skill-authoring.md` (137 lines)
- Produces: English primary source + zh-CN mirror + CLAUDE.md update

- [ ] **Step 1: Translate skill-authoring.md to English**

Rewrite `docs/maintainers/skill-authoring.md` in English. Preserve ALL structural content:
- §1 概述 → §1 Overview
- §2 Flow Digraph 语义约定 → §2 Flow Digraph conventions
- §3 Node 四要素模板 → §3 Node four-element template (Do/Read/Exit/Fail)
- §4 Invariants (上限 5 条 + brainstorming I6/I7 例外说明)
- §5 Failure Modes 表
- §6 BLOCKED 终态约定 + Block 政策
- §7 init legacy 内容豁免
- §8 图正文一致性校验清单 (4 items: node coverage / section alignment / no Rules / no Red Flags)
- §9 路径字符串编辑边界
- Change history

- [ ] **Step 2: Create zh-CN mirror**

Save the current Chinese content (pre-translation) as `docs/maintainers/skill-authoring.zh-CN.md`. Update internal links if any.

- [ ] **Step 3: Update CLAUDE.md language architecture**

Edit the "Strategy B extension — maintainer docs" paragraph:
- Change: `docs/maintainers/*.md` → `docs/maintainers/*.md（except skill-authoring.md）`
- Add note: `docs/maintainers/skill-authoring.md` follows Strategy A (English primary + zh-CN mirror)

- [ ] **Step 4: Update the skill-authoring.md link in CLAUDE.md line 56**

Change `(Chinese Strategy B)` to `(English primary + zh-CN mirror)` in the per-package documentation list.

- [ ] **Step 5: Run emit + validate**

```bash
pnpm run emit && pnpm run validate
```

- [ ] **Step 6: Commit**

```bash
git add docs/maintainers/skill-authoring.md docs/maintainers/skill-authoring.zh-CN.md CLAUDE.md
git commit -m "docs: skill-authoring.md English primary + zh-CN mirror (Strategy A)"
```

---

### Task 3: Tier Budget Re-baseline

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/templates.mjs` (LINE_BUDGETS constant)
- Modify: `packages/osuperpowers/bin/engine/tests/templates.test.mjs` (assertions)

**Interfaces:**
- Consumes: P13 design spec Section 3 measurement data
- Produces: Updated LINE_BUDGETS + passing tests

- [ ] **Step 1: Update LINE_BUDGETS in templates.mjs**

Edit `packages/osuperpowers/bin/engine/lib/templates.mjs` line 10-17:

```javascript
// 真实行预算（P13 re-baseline ~120% of measured P4-P9 post-rewrite）：
// sdd = cli-driven-development/SKILL.md (measured 175 → budget 210)
// ctrl = controller-handoff.md (measured 42 → budget 50)
// tier1 = sdd+ctrl (217 → 260)
// tier2 = tier1+docs-review (260+71=331)
export const LINE_BUDGETS = Object.freeze({
  sdd: 210,
  ctrl: 50,
  tier1: 260,
  tier2: 331,
});
```

- [ ] **Step 2: Update test assertions in templates.test.mjs**

Update the `lineBudget: 真实阈值` test:

```javascript
test("lineBudget: 真实阈值", () => {
  assert.equal(lineBudget("sdd"), 210);
  assert.equal(lineBudget("ctrl"), 50);
  assert.equal(lineBudget("tier1"), 260);
  assert.equal(lineBudget("tier2"), 331);
  assert.deepEqual(LINE_BUDGETS, { sdd: 210, ctrl: 50, tier1: 260, tier2: 331 });
});
```

Update the `governance: 真实行预算` test (same file, ~line 130):

```javascript
test("governance: 真实行预算（sdd/ctrl/tier1/tier2 实测宿主）", () => {
  const sdd = wcLines("skills/cli-driven-development/SKILL.md");
  const ctrl = wcLines("skills/cli-driven-development/docs/controller-handoff.md");
  const rev = wcLines("skills/brainstorming/docs/docs-review.md");
  const tier1 = sdd + ctrl;
  const tier2 = tier1 + rev;
  assert.ok(sdd <= lineBudget("sdd"), `cli-driven-development ${sdd} > ${lineBudget("sdd")}`);
  assert.ok(ctrl <= lineBudget("ctrl"), `controller-handoff ${ctrl} > ${lineBudget("ctrl")}`);
  assert.ok(tier1 <= lineBudget("tier1"), `Tier 1 ${tier1} > ${lineBudget("tier1")}`);
  assert.ok(tier2 <= lineBudget("tier2"), `Tier 2 ${tier2} > ${lineBudget("tier2")}`);
});
```

> Note: the governance test code itself doesn't change — only the thresholds it checks against (via `lineBudget()`) change. The assertions `sdd <= lineBudget("sdd")` etc. automatically validate against the new values.

- [ ] **Step 3: Run engine tests**

```bash
cd packages/osuperpowers && node bin/engine/tests/templates.test.mjs
```

- [ ] **Step 4: Run full validate**

```bash
pnpm run emit && pnpm run validate
```

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/templates.mjs packages/osuperpowers/bin/engine/tests/templates.test.mjs
git commit -m "fix(engine): P13 tier budget re-baseline (sdd=210 ctrl=50 tier1=260 tier2=331)"
```

---

### Task 4: Governance Tests (grep-sweep-regression + digraph-consistency)

**Files:**
- Create: `packages/osuperpowers/tests/grep-sweep-regression.test.mjs`
- Create: `packages/osuperpowers/tests/digraph-consistency.test.mjs`

**Interfaces:**
- Consumes: P13 design spec Section 1d (regression test) + Section 4 (digraph consistency)
- Produces: Two new test files passing in `pnpm run validate`

- [ ] **Step 1: Create grep-sweep-regression.test.mjs**

Create `packages/osuperpowers/tests/grep-sweep-regression.test.mjs`:

```javascript
// packages/osuperpowers/tests/grep-sweep-regression.test.mjs — P13 grep sweep regression guard
// Verifies all deleted-skill tokens remain zero in the in-scope tree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");

function grepCount(pattern, extraArgs = "") {
  try {
    const cmd = `grep -rn "${pattern}" ${extraArgs} packages/ docs/ README.md marketplace/source.json --include="*.md" --include="*.json" --include="*.mjs" 2>/dev/null | grep -v "/CHANGELOG.md" | grep -v "docs/superpowers/specs/" | grep -v "docs/superpowers/plans/" | grep -v "docs/superpowers/tickets/" | grep -v "validate-overrides-build.mjs" | grep -v "docs/maintainers/osuperpowers-plugin" | grep -v "docs/maintainers/osuperpowers-router-plugin" | grep -v "skill-authoring.md" | wc -l`;
    return parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  } catch { return 0; }
}

// Tokens that must be zero in-scope
const TOKENS = [
  ["osuperpowers:debugging", "deleted skill"],
  ["skills/debugging/", "deleted skill path"],
  ["osuperpowers:verification", "deleted skill"],
  ["skills/verification/", "deleted skill path"],
  ["cli-task", "deleted skill"],
  ["subagent-lifecycle", "dissolved doc (excl. anti-regression guards + dissolution statements)"],
  ["executing-plans", "renamed skill"],
  ["cli-code-review", "deleted skill"],
  ["review-dispatch", "dissolved doc"],
];

// Tokens requiring SKILL.md-only scope filter
const SKILL_ONLY_TOKENS = [
  ["HARD-GATE", "old format keyword"],
  ["## Rules", "old format heading (H1/H2)"],
  ["## Red Flags", "old format heading (H1/H2)"],
  ["## Checklist", "old format heading"],
];

for (const [token, desc] of TOKENS) {
  test(`grep sweep: "${token}" (${desc}) → 0 hits`, () => {
    const count = grepCount(token);
    assert.equal(count, 0, `"${token}" has ${count} in-scope hits — expected 0`);
  });
}

// SKILL.md-only tokens (old format headings)
for (const [token, desc] of SKILL_ONLY_TOKENS) {
  test(`grep sweep: "${token}" in SKILL.md (${desc}) → 0 hits`, () => {
    const cmd = `grep -rn "${token}" packages/osuperpowers/skills/ --include="SKILL.md" 2>/dev/null | wc -l`;
    const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
    assert.equal(count, 0, `"${token}" found in ${count} SKILL.md files`);
  });
}

// --prompt (exclude bin/engine/tests/)
test('grep sweep: "--prompt" in live code (excl. engine tests) → 0 hits', () => {
  const cmd = `grep -rn "\\-\\-prompt" packages/ --include="*.md" --include="*.json" --include="*.mjs" 2>/dev/null | grep -v "/CHANGELOG.md" | grep -v "bin/engine/tests/" | wc -l`;
  const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  assert.equal(count, 0, `"--prompt" has ${count} live-code hits`);
});

// docs/cdd-reference old path (should not appear as ../docs/cdd-reference)
test('grep sweep: "docs/cdd-reference" old path → 0 hits', () => {
  const cmd = `grep -rn "docs/cdd-reference" packages/ docs/ --include="*.md" --include="*.json" 2>/dev/null | grep -v "docs/superpowers/" | grep -v "cli-driven-development/docs/cdd-reference" | wc -l`;
  const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  assert.equal(count, 0, `"docs/cdd-reference" old path has ${count} hits`);
});

// Special token: subagent-driven-development (allowed in vendor path + router routing + maintainer docs)
test("grep sweep: subagent-driven-development in non-vendor/non-router/non-maintainer code → 0 hits", () => {
  const cmd = `grep -rn "subagent-driven-development" packages/osuperpowers/skills/ packages/osuperpowers-router/skills/ docs/ README.md marketplace/source.json --include="*.md" --include="*.json" --include="*.mjs" 2>/dev/null | grep -v "/CHANGELOG.md" | grep -v "docs/superpowers/specs/" | grep -v "docs/superpowers/plans/" | grep -v "docs/superpowers/tickets/" | grep -v "runner.mjs" | grep -v "runner.test.mjs" | grep -v "overrides.manifest.json" | grep -v "prompt-expansion.mjs" | grep -v "cursor-detect.mjs" | grep -v "docs/maintainers/" | wc -l`;
  const count = parseInt(execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim(), 10);
  assert.equal(count, 0, `subagent-driven-development has ${count} non-vendor/non-router/non-maintainer hits`);
});
```

- [ ] **Step 2: Run grep-sweep-regression test**

```bash
node packages/osuperpowers/tests/grep-sweep-regression.test.mjs
```

- [ ] **Step 3: Create digraph-consistency.test.mjs**

Create `packages/osuperpowers/tests/digraph-consistency.test.mjs`:

```javascript
// packages/osuperpowers/tests/digraph-consistency.test.mjs — P13 governance test
// Verifies skill-authoring §8 four checklists: node coverage, section alignment,
// no standalone Rules, no standalone Red Flags.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(HERE, "..", "skills");

// Find all SKILL.md files (exclude init — legacy exemption per skill-authoring §7)
import { readdirSync } from "node:fs";

const SKILL_FILES = [];
for (const ent of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (ent.isDirectory() && ent.name !== "init") {
    const p = path.join(SKILLS_DIR, ent.name, "SKILL.md");
    try { readFileSync(p); SKILL_FILES.push({ name: ent.name, path: p }); } catch {}
  }
}

function extractMermaidNodes(src) {
  const m = src.match(/```mermaid\n([\s\S]*?)```/);
  if (!m) return [];
  const block = m[1];
  // Match node definitions: A[name] / A{Name?} / A((name)) / A(("name"))
  const nodeRe = /(\w+)\[([^\]]+)\]|(\w+)\{([^}]+)\}|(\w+)\(\(([^)]+)\)\)/g;
  const nodes = [];
  let match;
  while ((match = nodeRe.exec(block)) !== null) {
    const id = match[1] || match[3] || match[5];
    const label = match[2] || match[4] || match[6];
    // Skip terminal nodes (rounded double-circle): ((...))
    const isTerminal = match[5] !== undefined;
    if (!isTerminal && id) nodes.push({ id, label: label.trim() });
  }
  return nodes;
}

function extractSections(src) {
  const re = /^### `([^`]+)`/gm;
  const sections = [];
  let m;
  while ((m = re.exec(src)) !== null) sections.push(m[1]);
  return sections;
}

for (const { name, path: skillPath } of SKILL_FILES) {
  const src = readFileSync(skillPath, "utf8");

  test(`[${name}] node coverage: every mermaid node has a ### section`, () => {
    const nodes = extractMermaidNodes(src);
    const sections = extractSections(src);
    for (const node of nodes) {
      assert.ok(
        sections.includes(node.label),
        `Node "${node.label}" (id=${node.id}) has no ### \`${node.label}\` section`
      );
    }
  });

  test(`[${name}] section alignment: every ### section has a mermaid node`, () => {
    const nodes = extractMermaidNodes(src);
    const nodeLabels = new Set(nodes.map(n => n.label));
    const sections = extractSections(src);
    for (const sec of sections) {
      assert.ok(
        nodeLabels.has(sec),
        `Section ### \`${sec}\` has no corresponding mermaid node`
      );
    }
  });

  test(`[${name}] no standalone Rules section`, () => {
    assert.ok(!/^#{1,2} Rules$/m.test(src), `${name}: found standalone "## Rules" heading`);
  });

  test(`[${name}] no standalone Red Flags section`, () => {
    assert.ok(!/^#{1,2} Red Flags$/m.test(src), `${name}: found standalone "## Red Flags" heading`);
  });
}
```

- [ ] **Step 4: Run digraph-consistency test**

```bash
node packages/osuperpowers/tests/digraph-consistency.test.mjs
```

- [ ] **Step 5: Run full validate**

```bash
pnpm run emit && pnpm run validate
```

- [ ] **Step 6: Commit**

```bash
git add packages/osuperpowers/tests/grep-sweep-regression.test.mjs packages/osuperpowers/tests/digraph-consistency.test.mjs
git commit -m "test: P13 governance tests — grep-sweep regression + digraph consistency"
```

---

### Task 5: Unified Changeset + Emit + Validate + Issue Close

**Files:**
- Create: `.changeset/p13-closure-unified.md` (unified changeset)
- Delete: `.changeset/add-cli-research-skill.md`
- Delete: `.changeset/dogfood-fixes-p2.md`
- Delete: `.changeset/dogfood-fixes-p3.md`
- Delete: `.changeset/dogfood-fixes-p5.md`
- Delete: `.changeset/dogfood-p4-templates.md`
- Delete: `.changeset/next-step-routing.md`
- Delete: `.changeset/p1-p2-cli-reviewer-pipeline-p1-p2.md`
- Delete: `.changeset/remove-cdd-task-mode-b.md`
- Delete: `.changeset/718c3ad7.md`

**Interfaces:**
- Consumes: All prior tasks complete
- Produces: Single unified changeset + green validate + CDD workspace artifacts

- [ ] **Step 1: Create unified changeset**

Create `.changeset/p13-closure-unified.md`:

```markdown
---
"@oscaner-skills/osuperpowers": major
"@oscaner-skills/osuperpowers-router": major
---

BREAKING: remove cli-task, debugging, verification skills and their trigger tokens
feat: rewrite all orchestration skills to node-anchored format (digraph as single control-flow SOT)
fix: CDD engine contract fixes (status unification, SHA consistency, timeout handling, engine recovery)
feat: add cli-research skill (standalone CDD research CLI)
feat: add cli-driven-development orchestrator (three-mode chain + deferred disposition)
refactor: brainstorming add claim-phase gate (I6 Register-before-grill + I7 Serial-phase discipline)
```

- [ ] **Step 2: Verify changeset structure + delete old changesets**

```bash
echo "--- Before deletion ---"
ls .changeset/*.md | grep -v README | grep -v config | grep -v versioned
echo "--- Delete old changesets ---"
rm -f .changeset/add-cli-research-skill.md \
      .changeset/dogfood-fixes-p2.md \
      .changeset/dogfood-fixes-p3.md \
      .changeset/dogfood-fixes-p5.md \
      .changeset/dogfood-p4-templates.md \
      .changeset/next-step-routing.md \
      .changeset/p1-p2-cli-reviewer-pipeline-p1-p2.md \
      .changeset/remove-cdd-task-mode-b.md \
      .changeset/718c3ad7.md
echo "--- After deletion (should show only p13-closure-unified.md) ---"
ls .changeset/*.md | grep -v README | grep -v config | grep -v versioned
```

- [ ] **Step 3: Run final emit + validate**

```bash
pnpm run emit && pnpm run validate
```

- [ ] **Step 4: Commit**

```bash
git add .changeset/
git commit -m "chore: P13 unified changeset (breaking+feat) — replaces per-phase changesets

Closes #168
Closes #169
Closes #173"
```

---

## CDD Execution Notes

- CLI mode: `node {pluginRoot}/bin/engine/cdd-task.mjs --harness <name> --task N --mode implement`
- Background execution: all CLI calls via `run_in_background`
- Task briefs: auto-generated from this plan (Tasks 1-5 map to CDD tasks 1-5)
- Workspace: `.superpowers/cdd/<slug>/`
- Ledger: each task → handoff → task-review → fix (if needed) → APPROVED → ledger append
