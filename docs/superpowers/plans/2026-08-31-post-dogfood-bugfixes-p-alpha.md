# Pα Engine Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four engine-layer bugs: phantom SHA validation (#200), cross-task commit boundary (#176), task-review mode-phase guard (#175), deferred-sweep findings cleanup (#191)

**Architecture:** Changes span `packages/osuperpowers/bin/engine/lib/` (contract.mjs, runner.mjs), `packages/osuperpowers/templates/cdd/` (implement.md, fix.md, task-review.md), and `packages/osuperpowers/skills/cli-driven-development/SKILL.md`. All engine fixes have unit test coverage in existing test files.

**Tech Stack:** Node.js (node:test), git CLI (`git cat-file -e`)

## Global Constraints

- Follow existing test patterns in `contract.test.mjs` and `runner.test.mjs` (setupRepo/seedHandoff helpers)
- `gitCatFileCommitExists` follows existing git helper style: command failure → false (fail-open)
- `writeHandoff` is shallow merge — new fields overwrite, missing fields preserved
- Mode-phase guard runs BEFORE sweep收口, BEFORE commit-contract (step 9)
- `pnpm run validate` must pass after all tasks

---

### Task 1: gitCatFileCommitExists + unit test

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/contract.mjs` (add export)
- Modify: `packages/osuperpowers/bin/engine/tests/contract.test.mjs` (add tests)

**Interfaces:**
- Produces: `gitCatFileCommitExists(sha: string, cwd: string) → boolean`

- [ ] **Step 1: Add gitCatFileCommitExists to contract.mjs**

Add after the existing `gitRevParseHead` function (around line 28):

```javascript
// git cat-file -e 验证 SHA 是否为真实可达的 commit 对象（#200 phantom SHA 防护）；返回 boolean。
export function gitCatFileCommitExists(sha, cwd) {
  if (!sha) return false;
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd, stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Add unit tests to contract.test.mjs**

Add after the existing `gitRevParseHead` test (or at end of file):

```javascript
import { gitCatFileCommitExists } from "../lib/contract.mjs";

test("gitCatFileCommitExists: real commit → true", () => {
  const repo = setupRepo();
  const sha = headOf(repo);
  assert.equal(gitCatFileCommitExists(sha, repo), true);
});

test("gitCatFileCommitExists: phantom SHA → false", () => {
  const repo = setupRepo();
  assert.equal(gitCatFileCommitExists("0000000000000000000000000000000000000000", repo), false);
});

test("gitCatFileCommitExists: empty string → false", () => {
  const repo = setupRepo();
  assert.equal(gitCatFileCommitExists("", repo), false);
});

test("gitCatFileCommitExists: null → false", () => {
  const repo = setupRepo();
  assert.equal(gitCatFileCommitExists(null, repo), false);
});
```

- [ ] **Step 3: Run tests**

Run: `node --test packages/osuperpowers/bin/engine/tests/contract.test.mjs`
Expected: All tests pass (including 4 new ones)

- [ ] **Step 4: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/contract.mjs packages/osuperpowers/bin/engine/tests/contract.test.mjs
git commit -m "feat(engine): add gitCatFileCommitExists for phantom SHA validation (#200)"
```

---

### Task 2: runner.mjs step 5 phantom SHA guard + integration test

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs` (step 5, add import + guard)
- Modify: `packages/osuperpowers/bin/engine/tests/runner.test.mjs` (add integration test)

**Interfaces:**
- Consumes: `gitCatFileCommitExists` from contract.mjs (Task 1)

- [ ] **Step 1: Add import to runner.mjs**

Update the import from contract.mjs (line 16) to include `gitCatFileCommitExists`:

```javascript
import { validateCommitContract, writeHandoff, gitToplevel, normalizeHandoffStatus, gitCatFileCommitExists } from "./contract.mjs";
```

- [ ] **Step 2: Add phantom SHA guard before step 5 runReviewPackage**

Insert BEFORE the `try` block at line 444 in runner.mjs (inside the `if (!dryRun)` block, after line 443 `if (handoffHead) taskReviewHead = handoffHead;`):

```javascript
      // #200 phantom SHA 校验：review-package 前校验 commits.head 可达性
      const preReviewHandoff = readJson(env.CDD_HANDOFF_PATH);
      const preReviewHead = preReviewHandoff?.commits?.head;
      if (preReviewHead && !gitCatFileCommitExists(preReviewHead, repoRoot || cwd)) {
        return finish(1, [], `review-package: commits.head ${preReviewHead} is not a reachable commit object`, noExit);
      }
```

- [ ] **Step 3: Add integration test to runner.test.mjs**

Add at end of file, following existing `setupWorkspace`/`baseEnv`/`capture` patterns:

```javascript
test("runTask: task-review + phantom commits.head → exit 1, review-package not executed", async () => {
  const ws = setupWorkspace();
  // Seed handoff with phantom SHA
  const handoffPath = path.join(ws, "task-1-handoff.json");
  writeFileSync(handoffPath, JSON.stringify({
    task: 1, phase: "task-review", status: "APPROVED",
    commits: { base: "abc123", head: "0000000000000000000000000000000000000000" }
  }));
  // Use non-git workspace so gitCatFileCommitExists returns false
  const res = await runTask("claude", 1, {
    mode: "task-review", probeSkills: NOOP_PROBE,
    env: baseEnv(ws, { CDD_TASK_REVIEW_FIXED_POINT: "HEAD~1" }),
    noExit: true
  });
  assert.equal(res.exitCode, 1);
  assert.match(res.h1.join("\n"), /not a reachable commit object/);
  // Verify review-package did NOT run: handoff has no diff artifact (guard terminated before runReviewPackage)
  const h = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.equal(h.artifacts?.diff, undefined, "review-package should not have produced diff");
});
```

- [ ] **Step 4: Run tests**

Run: `node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs`
Expected: All tests pass (including new phantom SHA test)

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/runner.mjs packages/osuperpowers/bin/engine/tests/runner.test.mjs
git commit -m "feat(engine): guard review-package against phantom commits.head (#200)"
```

---

### Task 3: mode-phase guard + sweep收口 in runner.mjs

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs` (step 8.5 → step 9 boundary, add two guards)
- Modify: `packages/osuperpowers/bin/engine/tests/runner.test.mjs` (add tests for both guards)

**Interfaces:**
- Consumes: `writeHandoff`, `readJson` from contract.mjs (existing)
- Produces: mode-phase audit warning on stderr; sweep findings cleared on deferred-sweep success

- [ ] **Step 1: Add mode-phase guard (#175) before commit-contract**

Insert BETWEEN step 8.5 (timeout path, line 516) and step 9 (commit-contract, line 518), as new step 8.6. Variables: `mode` comes from `opts.mode` (function parameter), `env` is the `buildTaskEnv` result at line 406, `handoffPath` = `env.CDD_HANDOFF_PATH`:

```javascript
  // 8.6 Mode-phase consistency guard (#175): ensure handoff phase matches CDD_MODE.
  //    Runs BEFORE sweep收口 and commit-contract. Audit warning only, no拦截.
  {
    const existingHandoff = readJson(env.CDD_HANDOFF_PATH);
    if (existingHandoff && existingHandoff.phase && existingHandoff.phase !== mode) {
      process.stderr.write(`[audit] handoff phase '${existingHandoff.phase}' corrected to '${mode}'\n`);
      writeHandoff(env.CDD_HANDOFF_PATH, { phase: mode });
    }
  }
```

- [ ] **Step 2: Add sweep收口 (#191) before commit-contract**

Insert as step 8.7, AFTER mode-phase guard:

```javascript
  // 8.7 Deferred-sweep收口 (#191): clear findings[] on successful sweep.
  //    agentRc === 0 + scope deferred-sweep → findings[] = [], status = APPROVED.
  //    agentRc ≠ 0 → no sweep, findings保留, status不touch.
  if (mode === "fix" && (scope ?? "blocker-only") === "deferred-sweep" && agentRc === 0) {
    const sweepHandoff = readJson(env.CDD_HANDOFF_PATH);
    if (sweepHandoff?.findings?.length > 0) {
      writeHandoff(env.CDD_HANDOFF_PATH, { findings: [], status: "APPROVED" });
    }
  }
```

- [ ] **Step 3: Add unit tests to runner.test.mjs**

```javascript

test("runTask: mode-phase guard → handoff phase corrected + audit stderr", async () => {
  const ws = setupWorkspace();
  // Seed handoff with wrong phase
  const handoffPath = path.join(ws, "task-1-handoff.json");
  writeFileSync(handoffPath, JSON.stringify({
    task: 1, phase: "implement", status: "APPROVED",
    commits: { base: "abc123", head: "abc123" }
  }));
  const { stderr } = await capture(() =>
    runTask("claude", 1, {
      mode: "task-review", dryRun: true, probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { CDD_TASK_REVIEW_FIXED_POINT: "HEAD~1" }),
    }),
  );
  assert.match(stderr, /\[audit\] handoff phase 'implement' corrected to 'task-review'/);
  const h = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.equal(h.phase, "task-review");
});

test("runTask: sweep收口 deferred-sweep + success → findings cleared + status APPROVED", async () => {
  const ws = setupWorkspace();
  const handoffPath = path.join(ws, "task-1-handoff.json");
  writeFileSync(handoffPath, JSON.stringify({
    task: 1, phase: "fix", status: "APPROVED",
    findings: [{ severity: "nit", summary: "style", deferred: true }]
  }));
  // Use noExit (not dryRun) so step 8.7 sweep code executes with agentRc=0 path
  const res = await runTask("claude", 1, {
    mode: "fix", dryRun: true, scope: "deferred-sweep", probeSkills: NOOP_PROBE,
    env: baseEnv(ws), noExit: true,
  });
  assert.equal(res.exitCode, 0, "dry-run fix succeeds");
  const h = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.deepEqual(h.findings, [], "sweep should clear findings");
  assert.equal(h.status, "APPROVED");
});
```

- [ ] **Step 4: Run tests**

Run: `node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/runner.mjs packages/osuperpowers/bin/engine/tests/runner.test.mjs
git commit -m "feat(engine): add mode-phase guard (#175) + deferred-sweep cleanup (#191)"
```

---

### Task 4: implement.md + fix.md boundary constraint

**Files:**
- Modify: `packages/osuperpowers/templates/cdd/implement.md` (Commit条款追加)
- Modify: `packages/osuperpowers/templates/cdd/fix.md` (Commit条款追加)

**Interfaces:** None (template-only change)

- [ ] **Step 1: Update implement.md Commit clause**

In implement.md, after the existing Commit条款 (line 21, after "Uncommitted changes at return → `status: BLOCKED`."):

Add:

```markdown
   - Only commit changes within this task brief scope. If you encounter uncommitted changes belonging to other tasks — do NOT stage, commit, or revert them; leave as-is. If out-of-scope uncommitted changes exist at return, write status: BLOCKED + `blocker:` listing the out-of-scope paths, so the orchestrator decides.
```

- [ ] **Step 2: Update fix.md Commit clause**

In fix.md, find the equivalent Commit section and append the same boundary constraint paragraph.

- [ ] **Step 3: Verify both files**

Read both files to confirm the boundary constraint is present in the Commit clause.

- [ ] **Step 4: Commit**

```bash
git add packages/osuperpowers/templates/cdd/implement.md packages/osuperpowers/templates/cdd/fix.md
git commit -m "feat(templates): add cross-task commit boundary constraint (#176)"
```

---

### Task 5: task-review.md findings MUST write to handoff

**Files:**
- Modify: `packages/osuperpowers/templates/cdd/task-review.md` (Instructions section)

**Interfaces:** None (template-only change)

- [ ] **Step 1: Update task-review.md Instructions**

In task-review.md, add to the Instructions section (after item 6, before the Return section):

```markdown
7. **Findings output:** Review findings MUST be written to `{{HANDOFF}}` (the JSON handoff file). Do not return findings via stdout alone. If the handoff `findings[]` is empty or missing at return, the runner treats this as no findings found.
```

- [ ] **Step 2: Verify the file**

Read task-review.md to confirm the instruction is present.

- [ ] **Step 3: Commit**

```bash
git add packages/osuperpowers/templates/cdd/task-review.md
git commit -m "feat(templates): require findings written to handoff in task-review (#175)"
```

---

### Task 6: cli-driven-development SKILL.md deferred-disposition update

**Files:**
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.md` (deferred-disposition node)
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.zh-CN.md` (mirror sync)

**Interfaces:** None (skill text change)

- [ ] **Step 1: Update deferred-disposition node in cli-driven-development SKILL.md**

Find the `deferred-disposition` node's Do field (line 107). Replace the current text:

**Before (line 107):**
```
- **Do**: Present accumulated deferred findings to the user (grouped by task): for each task, list `findings[].deferred=true` items (severity + summary + recommended fix); **user chooses**: ① fix-now (enter deferred-sweep-loop, fix per-task) ② carry-skip (carry along, proceed to branch-review). Present with explanation that deferred items are warn/nit severity, do not affect APPROVED semantics, but fixing yields a cleaner branch.
```

**After:**
```
- **Do**: Present accumulated deferred findings to the user (grouped by task): for each task, list `findings[].deferred=true` items (severity + summary + recommended fix); **user chooses**: ① fix-now (enter deferred-sweep-loop; sweep processes ALL deferred findings — no exemptions for "pure record" nits; sweep completion = findings[] cleared for all items regardless of whether code was changed; no per-task secondary confirmation after sweep) ② carry-skip (carry along, proceed to branch-review). Present with explanation that deferred items are warn/nit severity, do not affect APPROVED semantics, but fixing yields a cleaner branch.
```

Find the `deferred-sweep-loop` node's Do field (line 114). Update:

**Before (line 114):**
```
- **Do**: Run deferred-sweep per task: for each task's `findings[].deferred=true` items, dispatch `node {pluginRoot}/bin/engine/cdd-task.mjs --harness <name> --task N --mode fix --scope deferred-sweep` (fix dual-channel: deferred-sweep); after sweep, task-review re-reviews (verify fixes); if re-review returns new blockers → enter fix loop (≤ 5 rounds); re-review APPROVED → ledger appends the task's `Task N: complete` line (internal bookkeeping, not a digraph edge) → continue next task's sweep. **Controller restriction**: deferred findings fix must go through `--mode fix` dispatch via this node; hand-writing fixes outside the engine CLI path is forbidden (see I7). **Fix segment cleanup** (_handoff-write-fragment.md fix segment sweep branch): sweep-resolved findings are removed from `findings[]` (fully resolved, not retained as deferred).
```

**After:**
```
- **Do**: Run deferred-sweep per task: for each task's `findings[].deferred=true` items, dispatch `node {pluginRoot}/bin/engine/cdd-task.mjs --harness <name> --task N --mode fix --scope deferred-sweep` (fix dual-channel: deferred-sweep); sweep processes ALL deferred findings — no exemptions for "pure record" nits. After sweep completion (agentRc=0), runner.mjs automatically clears `findings[]` and writes `status: APPROVED` (#191 sweep收口); agentRc≠0 → findings保留, status untouched. After sweep, task-review re-reviews (verify fixes); if re-review returns new blockers → enter fix loop (≤ 5 rounds); re-review APPROVED → ledger appends the task's `Task N: complete` line (internal bookkeeping, not a digraph edge) → continue next task's sweep. **Controller restriction**: deferred findings fix must go through `--mode fix` dispatch via this node; hand-writing fixes outside the engine CLI path is forbidden (see I7).
```

- [ ] **Step 2: Update zh-CN mirror**

Apply equivalent changes to `SKILL.zh-CN.md`.

- [ ] **Step 3: Verify both files**

Read both files to confirm the updated semantics are present.

- [ ] **Step 4: Commit**

```bash
git add packages/osuperpowers/skills/cli-driven-development/SKILL.md packages/osuperpowers/skills/cli-driven-development/SKILL.zh-CN.md
git commit -m "docs: update deferred-disposition fix-now semantics (#191)"
```

---

### Task 7: Validate

- [ ] **Step 1: Run full validation**

Run: `pnpm run emit && pnpm run validate`
Expected: All checks pass, exit 0

- [ ] **Step 2: Run engine tests**

Run: `node --test packages/osuperpowers/bin/engine/tests/`
Expected: All tests pass

- [ ] **Step 3: Final commit (if emit produced changes)**

If `pnpm run emit` produced file changes:

```bash
git add -A
git commit -m "chore: regenerate manifests after Pα engine fixes"
```
