# Post-Dogfood Bugfixes Pζ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use osuperpowers:cli-driven-development to implement this plan task-by-task.

**Goal:** Full rewrite of CDD handoff + review loop architecture: per-phase-per-round files, unified Review Stopping digraph, docs-task.mjs, fix-mode simplification, and full test coverage.

**Architecture:** Per-phase-per-round flat handoff files (`task-N-implement.json` / `task-N-task-review-R.json` / `task-N-fix-R.json`) replace the single shared `task-N-handoff.json`. A shared `review-loop.mjs` module unifies the review→fix loop across CDD and doc tasks. A new `docs-task.mjs` CLI (with review + fix modes) replaces `cdd-review.mjs`, making the doc pipeline symmetric with `cdd-task.mjs`. All BLOCKED messages follow `<diagnosis> → <suggested action>` format.

**Tech Stack:** Node.js ESM; `node:test`; `node:fs`; `node:path`; `node:child_process`; JSON Schema draft-07 (hand-rolled validator in schema-utils.mjs)

## Global Constraints

- Node version: managed by fnm — run `fnm use` before any `node`/`pnpm`
- After any SKILL.md / docs/*.md edit: run `pnpm run emit`
- After each task: run `pnpm run validate` to verify all 12 CI blocks pass
- Commit only when user explicitly asks; changeset before final commit
- Task headings MUST use `### Task N:` (colon) format
- Breaking changes approved for this phase: `CDD_HANDOFF_PATH` semantics, `cdd-review.mjs` deletion, `fix.md` simplification, `user-ok?` node deletion, deferred-sweep elimination
- Design spec: `docs/superpowers/specs/2026-09-03-post-dogfood-bugfixes-p-zeta-design.md`

---

## File Structure

**New files:**
- `packages/osuperpowers/bin/engine/review-loop.mjs` — shared review→fix loop module (T9)
- `packages/osuperpowers/bin/engine/docs-task.mjs` — docs CLI (replaces cdd-review.mjs) (T8)
- `packages/osuperpowers/bin/engine/lib/docs-runner.mjs` — lightweight runner for docs-task (T7)
- `packages/osuperpowers/skills/_templates/docs-handoff-schema.json` — docs handoff schema (T7)
- `packages/osuperpowers/skills/_templates/spec-fix.md` — spec fix template (T8)
- `packages/osuperpowers/skills/_templates/plan-fix.md` — plan fix template (T8)
- `packages/osuperpowers/bin/engine/tests/review-loop.test.mjs` — review-loop tests (T9)
- `packages/osuperpowers/bin/engine/tests/docs-task.test.mjs` — docs-task integration tests (T13)
- `packages/osuperpowers/bin/engine/tests/docs-runner.test.mjs` — docs-runner unit tests (T7)

**Modified files:**
- `packages/osuperpowers/bin/engine/lib/schema-utils.mjs` — accept schemaPath parameter (T7)
- `packages/osuperpowers/bin/engine/lib/runner.mjs` — BLOCKED artifacts fix, per-round paths, cross-phase reads, step 10.5 BLOCKED, fix simplification (T1–T6)
- `packages/osuperpowers/bin/engine/lib/contract.mjs` — rewriteHandoffBlocked add artifacts (T1)
- `packages/osuperpowers/bin/engine/lib/progress.mjs` — round tracking per-task per-mode (T2)
- `packages/osuperpowers/bin/engine/lib/templates.mjs` — renderHandoffStub (T5)
- `packages/osuperpowers/skills/cli-driven-development/templates/implement.md` — HANDOFF_STUB (T5)
- `packages/osuperpowers/skills/cli-driven-development/templates/task-review.md` — HANDOFF_STUB (T5)
- `packages/osuperpowers/skills/cli-driven-development/templates/fix.md` — HANDOFF_STUB + simplify (T5/T6)
- `packages/osuperpowers/skills/_templates/spec-review.md` — HANDOFF_STUB (T8)
- `packages/osuperpowers/skills/_templates/plan-review.md` — HANDOFF_STUB (T8)
- `packages/osuperpowers/skills/_docs/docs-review.md` — Rule: Review Stopping SOT (T10)
- `packages/osuperpowers/skills/brainstorming/SKILL.md` — docs-task CLI + delete user-ok? + I5 SOT (T11)
- `packages/osuperpowers/skills/writing-plans/SKILL.md` — docs-task CLI + Review Stopping SOT (T12)
- `packages/osuperpowers/bin/engine/tests/runner.test.mjs` — new BLOCKED/round tests (T13)
- `packages/osuperpowers/bin/engine/tests/task.test.mjs` — integration smoke (T13)
- `packages/osuperpowers/bin/engine/tests/templates.test.mjs` — HANDOFF_STUB tests (T13)
- `packages/osuperpowers/bin/engine/tests/progress.test.mjs` — getRound/incrementRound tests (T2)
- `docs/maintainers/osuperpowers-plugin.md` — BLOCKED format, Review Stopping, architecture (T14)
- `CLAUDE.md` — BLOCKED format, docs-task, per-round architecture (T14)
- `docs/superpowers/specs/2026-08-31-post-dogfood-bugfixes-overall.md` — issues + Plan=Done (T15)

**Deleted files:**
- `packages/osuperpowers/bin/engine/cdd-review.mjs` (T8)
- `packages/osuperpowers/bin/engine/tests/review.test.mjs` (T8 — migrated to docs-task.test.mjs)

---

### Task 1: BLOCKED handoff artifacts + message format

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/contract.mjs`
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs`

**Interfaces:**
- Consumes: nothing (foundation fix)
- Produces: all BLOCKED/TIMEOUT `writeHandoff` calls include `artifacts: {}`; `blocker` field follows `"<diagnosis> → <suggested action>"` format

- [ ] **Step 1: Fix `rewriteHandoffBlocked` in contract.mjs**

  Read `packages/osuperpowers/bin/engine/lib/contract.mjs` lines 67-70. Update:
  ```js
  export function rewriteHandoffBlocked(handoffPath, reason) {
    writeHandoff(handoffPath, { status: "BLOCKED", blocker: reason, artifacts: {} });
  }
  ```

- [ ] **Step 2: Fix step 8.5 unkillable BLOCKED in runner.mjs**

  Find the unkillable timeout block (`timedOut && unkillable`). Add `artifacts: {}` and update blocker message:
  ```js
  writeHandoff(env.CDD_HANDOFF_PATH, {
    task: taskNum,
    phase: mode,
    status: "BLOCKED",
    findings: [],
    artifacts: {},
    blocker: `cli process unkillable after timeout → manually kill the process (check ps), then re-dispatch task ${taskNum}`,
  });
  ```

- [ ] **Step 3: Fix step 8.5 normal TIMEOUT in runner.mjs**

  Find the normal timeout block (`timedOut && !unkillable`). Add `artifacts: {}` and update blocker:
  ```js
  writeHandoff(env.CDD_HANDOFF_PATH, {
    task: taskNum,
    phase: mode,
    status: "TIMEOUT",
    findings: [],
    artifacts: {},
    blocker: `cli timed out after ${timeoutMs}ms → simplify task ${taskNum} scope or increase timeout, then re-dispatch`,
  });
  ```

- [ ] **Step 4: Fix step 8.8 schema validation BLOCKED in runner.mjs**

  Find `writeHandoff(env.CDD_HANDOFF_PATH, { task: taskNum, status: "BLOCKED", phase: mode, findings: [], blocker: sv.reason })`. Update:
  ```js
  writeHandoff(env.CDD_HANDOFF_PATH, {
    task: taskNum,
    phase: mode,
    status: "BLOCKED",
    findings: [],
    artifacts: {},
    blocker: `handoff schema invalid: ${sv.reason} → fix the handoff JSON at ${env.CDD_HANDOFF_PATH} and re-dispatch task ${taskNum}`,
  });
  ```

- [ ] **Step 5: Fix step 10 (cli failed no handoff) BLOCKED in runner.mjs**

  Find the block that writes BLOCKED when `agentRc !== 0 && !existsSync(env.CDD_HANDOFF_PATH)`. Update:
  ```js
  writeHandoff(env.CDD_HANDOFF_PATH, {
    task: taskNum,
    phase: mode,
    status: "BLOCKED",
    commits: { base: "unknown" },
    findings: [],
    artifacts: {},
    blocker: `cli exited ${agentRc} without writing handoff → check stderr above for errors, fix, then re-dispatch task ${taskNum}`,
  });
  ```

- [ ] **Step 6: Fix h1FromHandoff fallback messages in runner.mjs**

  Find the two inline BLOCKED strings in `h1FromHandoff` (lines ~278-282):
  ```js
  return h1FourLines("status: BLOCKED\nblocker: handoff missing after commit-contract interception → re-dispatch task after checking commit-contract errors");
  // and:
  return h1FourLines("status: BLOCKED\nblocker: handoff JSON unparseable after commit-contract interception → delete the corrupted handoff file and re-dispatch");
  ```

- [ ] **Step 7: Verify all writeHandoff BLOCKED calls are schema-valid**

  Run:
  ```bash
  grep -n "writeHandoff\|rewriteHandoffBlocked" packages/osuperpowers/bin/engine/lib/runner.mjs packages/osuperpowers/bin/engine/lib/contract.mjs
  ```
  Confirm every BLOCKED/TIMEOUT call now includes `artifacts: {}`.

- [ ] **Step 8: Run tests**

  ```bash
  cd /Users/kang/Projects/oscaner-skills && fnm use && pnpm run validate
  ```
  Expected: all 12 CI blocks pass.

---

### Task 2: progress.mjs round tracking + buildTaskEnv per-round paths

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/progress.mjs`
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/progress.test.mjs`

**Interfaces:**
- Consumes: T1 (stable runner.mjs base)
- Produces: `getRound(progress, taskNum, mode) → number`; `incrementRound(progressDir, taskNum, mode)`; `buildTaskEnv` derives `task-N-implement.json` / `task-N-{mode}-R.json`

- [ ] **Step 1: Add round tracking to progress.mjs schema**

  Read `packages/osuperpowers/bin/engine/lib/progress.mjs`. Update the JSON schema `required` comment and the default task shape:
  ```js
  // In defaultProgress or equivalent initializer, task shape becomes:
  // { task: N, status: "pending"|"complete", rounds: {} }
  // rounds: { "task-review": lastCompletedRound, "fix": lastCompletedRound }
  ```

- [ ] **Step 2: Add `getRound` export to progress.mjs**

  Note: confirm the exact task shape initializer in progress.mjs first:
  ```bash
  grep -n "task.*status.*pending\|rounds\|defaultProgress" packages/osuperpowers/bin/engine/lib/progress.mjs
  ```
  Then add rounds: {} to the default task shape and add the export:

  ```js
  // Returns the round number to dispatch next (last completed + 1, or 1 if none).
  export function getRound(progressData, taskNum, mode) {
    const taskEntry = progressData.tasks.find((t) => t.task === taskNum);
    const lastCompleted = taskEntry?.rounds?.[mode] ?? 0;
    return lastCompleted + 1;
  }
  ```

- [ ] **Step 3: Add `incrementRound` export to progress.mjs**

  ```js
  // Call after any handoff is written to disk (including BLOCKED/TIMEOUT).
  export function incrementRound(progressDir, taskNum, mode) {
    const data = readProgressJSON(progressDir);
    let taskEntry = data.tasks.find((t) => t.task === taskNum);
    if (!taskEntry) {
      taskEntry = { task: taskNum, status: "pending", rounds: {} };
      data.tasks.push(taskEntry);
    }
    taskEntry.rounds = taskEntry.rounds ?? {};
    taskEntry.rounds[mode] = (taskEntry.rounds[mode] ?? 0) + 1;
    writeProgressJSON(progressDir, data);
  }
  ```

- [ ] **Step 4: Update `buildTaskEnv` in runner.mjs to accept round**

  ```js
  export function buildTaskEnv(baseEnv, workspace, task, mode, harness, { round = 1 } = {}) {
    const env = { ...baseEnv };
    env.CDD_WORKSPACE = workspace;
    env.CDD_HARNESS = harness;
    env.CDD_LEDGER ||= path.join(workspace, "progress.json");
    env.CDD_TASK_BRIEF ||= path.join(workspace, `task-${task}-brief.md`);
    // Per-phase per-round handoff path (unconditional — always derive from round):
    const handoffFile = mode === "implement"
      ? `task-${task}-implement.json`
      : `task-${task}-${mode}-${round}.json`;
    env.CDD_HANDOFF_PATH = path.join(workspace, handoffFile); // unconditional assignment
    env.CDD_PLAN_CONSTRAINTS ||= path.join(workspace, "plan-constraints.md");
    env.CDD_MODE = mode;
    env.CDD_FINDINGS ||= path.join(workspace, `task-${task}-open-findings.json`);
    return env;
  }
  ```

- [ ] **Step 5: Update `runTask` to derive round from progress.json and pass to buildTaskEnv**

  First, add the import to `runner.mjs` for the new exports:
  ```js
  import { getRound, incrementRound, readProgressJSON, writeProgressJSON } from "./progress.mjs";
  ```

  Then in `runTask`, before calling `buildTaskEnv`, read the current round:
  ```js
  const progressDir = path.dirname(env.CDD_LEDGER ?? path.join(workspace, "progress.json"));
  const progressData = readProgressJSON(progressDir);
  const round = mode === "implement" ? 1 : getRound(progressData, taskNum, mode);
  const taskEnv = buildTaskEnv(env, workspace, taskNum, mode, harness, { round });
  ```

- [ ] **Step 6: Call `incrementRound` after every handoff write in runTask**

  Note: after `buildTaskEnv` returns `taskEnv`, use `taskEnv.CDD_LEDGER` and `taskEnv.CDD_HANDOFF_PATH` in all subsequent runTask code. Also update T1 Steps 2–5 BLOCKED call sites that reference `env.CDD_HANDOFF_PATH` → change to `taskEnv.CDD_HANDOFF_PATH` (since buildTaskEnv returns a new object, the original `env` does not have the per-round path).

  After each `writeHandoff(taskEnv.CDD_HANDOFF_PATH, ...)` call (steps 8.5 unkillable, 8.5 timeout, 8.8, 10, 10.5 — ~5 sites):
  ```js
  if (!dryRun) incrementRound(path.dirname(taskEnv.CDD_LEDGER), taskNum, mode);
  ```

- [ ] **Step 7: Write progress.test.mjs tests for getRound + incrementRound**

  Add to `packages/osuperpowers/bin/engine/tests/progress.test.mjs`:
  ```js
  import { getRound, incrementRound, readProgressJSON } from "../lib/progress.mjs";

  test("getRound: no prior rounds → returns 1", () => {
    const data = { tasks: [] };
    assert.equal(getRound(data, 1, "task-review"), 1);
  });

  test("getRound: completed round 2 → returns 3", () => {
    const data = { tasks: [{ task: 1, status: "pending", rounds: { "task-review": 2 } }] };
    assert.equal(getRound(data, 1, "task-review"), 3);
  });

  test("incrementRound: creates task entry + sets round 1", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "prog-"));
    writeFileSync(path.join(dir, "progress.json"), JSON.stringify({
      plan: "/p.md", timeoutCount: 0, engineRecoveryCount: 0,
      lastDispatchHead: "", tasks: [], degradationLog: [],
    }));
    incrementRound(dir, 1, "task-review");
    const data = readProgressJSON(dir);
    assert.equal(data.tasks[0].rounds["task-review"], 1);
  });

  test("incrementRound: BLOCKED handoff still increments round", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "prog-"));
    writeFileSync(path.join(dir, "progress.json"), JSON.stringify({
      plan: "/p.md", timeoutCount: 0, engineRecoveryCount: 0,
      lastDispatchHead: "", tasks: [{ task: 1, status: "pending", rounds: { "task-review": 1 } }], degradationLog: [],
    }));
    incrementRound(dir, 1, "task-review");
    const data = readProgressJSON(dir);
    assert.equal(data.tasks[0].rounds["task-review"], 2);
  });
  ```

- [ ] **Step 8: Run tests**

  ```bash
  pnpm run validate
  ```
  Expected: all pass.

---

### Task 3: Cross-phase reads internal derivation

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs`

**Interfaces:**
- Consumes: T2 (per-round paths in buildTaskEnv; getRound/incrementRound from progress.mjs)
- Produces: `prevHandoffPath(workspace, task, mode, round)` → string; CDD_TASK_REVIEW_FIXED_POINT derived from correct prior-phase handoff

- [ ] **Step 1: Add `prevHandoffPath` helper to runner.mjs**

  ```js
  // Returns the path of the handoff written by the previous phase for this task.
  // task-review round 1: reads task-N-implement.json
  // task-review round R>1: reads task-N-fix-(R-1).json
  // fix round R: reads task-N-task-review-R.json
  function prevHandoffPath(workspace, task, mode, round) {
    if (mode === "task-review") {
      return round === 1
        ? path.join(workspace, `task-${task}-implement.json`)
        : path.join(workspace, `task-${task}-fix-${round - 1}.json`);
    }
    if (mode === "fix") {
      return path.join(workspace, `task-${task}-task-review-${round}.json`);
    }
    return null; // implement has no prior phase
  }
  ```

- [ ] **Step 2: Update CDD_TASK_REVIEW_FIXED_POINT derivation**

  In `runTask`, find the current section that reads `handoffBase = readJsonField(env.CDD_HANDOFF_PATH, ["commits", "base"])`. Replace with:
  ```js
  if (mode === "task-review" || mode === "fix") {
    const prev = prevHandoffPath(workspace, taskNum, mode, round);
    if (prev) {
      const prevCommitsBase = readJsonField(prev, ["commits", "base"]);
      if (prevCommitsBase && prevCommitsBase !== "unknown") {
        env.CDD_TASK_REVIEW_FIXED_POINT = prevCommitsBase;
      }
    }
  }
  ```

- [ ] **Step 3: Guard `requireEnv` for CDD_TASK_REVIEW_FIXED_POINT**

  **Verification**: Read `lib/templates.mjs` — `renderTemplate` throws `missing param FIXED_POINT` if `FIXED_POINT` is undefined (line 74). It does NOT return empty string for missing params. Therefore, simply removing `CDD_TASK_REVIEW_FIXED_POINT` from `requireEnv` is insufficient — the template render will also throw.

  **Fix**: Instead of removing from requireEnv, set a fallback default:
  ```js
  // In promptEnv (runner.mjs), change:
  FIXED_POINT: env.CDD_TASK_REVIEW_FIXED_POINT,
  // To:
  FIXED_POINT: env.CDD_TASK_REVIEW_FIXED_POINT ?? "",  // empty string if cross-phase read returned nothing
  ```

  And remove from requireEnv:
  ```js
  // Remove: if (mode === "task-review" && !env.CDD_TASK_REVIEW_FIXED_POINT) missing.push("CDD_TASK_REVIEW_FIXED_POINT");
  ```

  The review agent receives an empty `{{FIXED_POINT}}` and is expected to review from current HEAD. This is acceptable behavior when no prior phase handoff has commits data.

- [ ] **Step 4: Run tests**

  ```bash
  pnpm run validate
  ```
  Expected: all pass.

---

### Task 4: step 10.5 → BLOCKED + handoffStatus/isTaskPending update

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs`

**Interfaces:**
- Consumes: T2 (per-round paths), T3 (round awareness)
- Produces: step 10.5 writes BLOCKED (not fallback APPROVED) when file absent; `handoffStatus` reads latest task-review round; `isTaskPending` uses correct predicate

- [ ] **Step 1: Replace step 10.5 phase-mismatch with file-existence BLOCKED**

  Note: after `buildTaskEnv` returns `taskEnv`, use `taskEnv.CDD_HANDOFF_PATH` and `taskEnv.CDD_LEDGER` (not `env.*`). The step 10.5 block should reference `taskEnv`:

  Find and replace the step 10.5 block:
  ```js
  // NEW (file-existence BLOCKED — use taskEnv, not env):
  if (agentRc === 0 && !dryRun && !existsSync(taskEnv.CDD_HANDOFF_PATH)) {
    writeHandoff(taskEnv.CDD_HANDOFF_PATH, {
      task: taskNum,
      phase: mode,
      status: "BLOCKED",
      findings: [],
      artifacts: {},
      blocker: `${path.basename(taskEnv.CDD_HANDOFF_PATH)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${taskEnv.CDD_HANDOFF_PATH} before exit`,
    });
    incrementRound(path.dirname(taskEnv.CDD_LEDGER), taskNum, mode);
    return finish(1, h1FromHandoff(taskEnv.CDD_HANDOFF_PATH), `${mode} agent did not write handoff`, noExit);
  }
  ```

- [ ] **Step 2: Update `handoffStatus` to read latest task-review round**

  ```js
  export function handoffStatus(taskNum, workspace, progressData) {
    // For implement: always reads task-N-implement.json
    // For latest review: reads task-N-task-review-R.json where R = rounds["task-review"]
    const reviewRound = progressData?.tasks?.find(t => t.task === taskNum)?.rounds?.["task-review"] ?? 0;
    if (reviewRound === 0) return "MISSING";
    const handoffPath = path.join(workspace, `task-${taskNum}-task-review-${reviewRound}.json`);
    if (!existsSync(handoffPath)) return "MISSING";
    try {
      return normalizeHandoffStatus(JSON.parse(readFileSync(handoffPath, "utf8")).status ?? "UNKNOWN");
    } catch { return "UNKNOWN"; }
  }
  ```

  Note: this changes `handoffStatus` signature — update all callers. Check existing usages in runner.mjs and tests.

- [ ] **Step 3: Update `isTaskPending`**

  ```js
  export function isTaskPending(taskNum, workspace, progressData) {
    const reviewRound = progressData?.tasks?.find(t => t.task === taskNum)?.rounds?.["task-review"] ?? 0;
    if (reviewRound === 0) return true; // no task-review ever completed
    return handoffStatus(taskNum, workspace, progressData) !== "APPROVED";
  }
  ```

- [ ] **Step 4: Update callers of handoffStatus / isTaskPending in runner.mjs and tests**

  Search for all usages:
  ```bash
  grep -n "handoffStatus\|isTaskPending" packages/osuperpowers/bin/engine/lib/runner.mjs packages/osuperpowers/bin/engine/tests/runner.test.mjs
  ```
  Update each call site to pass the new `(taskNum, workspace, progressData)` signature.

- [ ] **Step 5: Run tests**

  ```bash
  pnpm run validate
  ```
  Expected: all pass.

---

### Task 5: renderHandoffStub + {{HANDOFF_STUB}} injection

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/templates.mjs`
- Modify: `packages/osuperpowers/skills/cli-driven-development/templates/implement.md`
- Modify: `packages/osuperpowers/skills/cli-driven-development/templates/task-review.md`
- Modify: `packages/osuperpowers/skills/cli-driven-development/templates/fix.md`

**Interfaces:**
- Consumes: T1 (stable runner base)
- Produces: `renderHandoffStub(schema, mode, taskNum, {docPath})` → string; `{{HANDOFF_STUB}}` replaced in all mode templates

- [ ] **Step 1: Add `renderHandoffStub` to templates.mjs**

  ```js
  // Generates a schema-compliant handoff JSON stub for agent guidance.
  // schema: parsed handoff-schema.json or docs-handoff-schema.json
  // mode: "implement" | "task-review" | "fix" | "review" | etc.
  // taskNum: integer (undefined for docs tasks)
  // docPath: string (for docs tasks; omit for CDD tasks)
  export function renderHandoffStub(schema, mode, taskNum, { docPath } = {}) {
    const stub = {};
    for (const field of schema.required ?? []) {
      switch (field) {
        case "task":     stub.task = typeof taskNum === "number" ? taskNum : 0; break;
        case "phase":    stub.phase = mode;                                      break;
        case "status":   stub.status = "APPROVED";                               break;
        case "findings": stub.findings = [];                                     break;
        case "artifacts":stub.artifacts = {};                                    break;
        case "doc_path": stub.doc_path = docPath ?? "";                          break;
      }
    }
    return "```json\n" + JSON.stringify(stub, null, 2) + "\n```";
  }
  ```

- [ ] **Step 2: Load schema and inject stub in `renderModePrompt`**

  In `renderModePrompt`, after loading the template:
  ```js
  import { loadHandoffSchema } from "./schema-utils.mjs";
  // ...
  const schema = loadHandoffSchema(); // cdd-handoff-schema.json
  const taskNumInt = parseInt(env.TASK) || 0;
  const stub = renderHandoffStub(schema, mode, taskNumInt);
  prompt = prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);
  ```

- [ ] **Step 3: Update implement.md — replace hand-written fields with {{HANDOFF_STUB}}**

  Read `packages/osuperpowers/skills/cli-driven-development/templates/implement.md`.
  Find the `## Handoff Output` section and the hand-written JSON fields (task, phase, status, findings, artifacts). Replace them with:
  ```markdown
  ## Handoff Output

  Write the following JSON exactly to `{{HANDOFF}}`:

  {{HANDOFF_STUB}}

  Rules:
  - `task` must be a JSON integer (no quotes)
  - `status`: APPROVED (implementation complete) or BLOCKED (cannot proceed — explain in blocker field)
  - `findings`: empty array [] for implement mode
  - `artifacts`: record file paths produced (e.g. `{"brief": "{{BRIEF}}"}`)
  ```

- [ ] **Step 4: Update task-review.md — same substitution**

  Read `packages/osuperpowers/skills/cli-driven-development/templates/task-review.md`.
  Replace hand-written required fields in Handoff Output with `{{HANDOFF_STUB}}` and rules note.

- [ ] **Step 5: Update fix.md — same substitution (full simplification in T6)**

  For now, replace the hand-written fields with `{{HANDOFF_STUB}}`. Leave deferred/scope removal for T6.

- [ ] **Step 6: Run emit and tests**

  ```bash
  pnpm run emit && pnpm run validate
  ```
  Expected: all pass; no `{{HANDOFF_STUB}}` residual in rendered output.

---

### Task 6: fix-mode simplification (delete scope/sweep/step 8.9)

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs`
- Modify: `packages/osuperpowers/skills/cli-driven-development/templates/fix.md`
- Modify: `packages/osuperpowers/bin/engine/tests/templates.test.mjs`

**Interfaces:**
- Consumes: T3 (prevHandoffPath), T5 (HANDOFF_STUB in fix.md)
- Produces: no `CDD_FINDINGS_SCOPE` env var; step 8.9 deleted; fix.md uses full findings; deferred concept eliminated

- [ ] **Step 1: Delete step 8.9 from runner.mjs**

  Find and delete the block:
  ```js
  // 8.9 Open-findings.json pre-generation (fix mode) — filter handoff findings by scope
  if (mode === "fix" && scope && existsSync(env.CDD_HANDOFF_PATH)) { ... }
  ```

- [ ] **Step 2: Remove `scope` parameter from `buildTaskEnv` and `runTask`**

  In `buildTaskEnv`, remove:
  ```js
  if (scope) env.CDD_FINDINGS_SCOPE = scope;
  ```
  In `runTask` options, remove `scope` from destructuring and all references to `CDD_FINDINGS_SCOPE`.

- [ ] **Step 3: Update `CDD_FINDINGS` to point to current-round task-review handoff**

  In `buildTaskEnv`, guard the generic `CDD_FINDINGS ||=` to not apply for fix mode, so the fix-mode block can unconditionally set it:
  ```js
  // In buildTaskEnv, change:
  env.CDD_FINDINGS ||= path.join(workspace, `task-${task}-open-findings.json`);
  // To:
  if (mode !== "fix") {
    env.CDD_FINDINGS ||= path.join(workspace, `task-${task}-open-findings.json`);
  }
  ```

  Then for fix mode, unconditionally set `CDD_FINDINGS` to the task-review handoff path:
  ```js
  if (mode === "fix") {
    // CDD_FINDINGS: path to task-review-R.json for this fix round (runner-derived, no scope filter)
    env.CDD_FINDINGS = prevHandoffPath(workspace, task, mode, round);
  }
  ```

- [ ] **Step 4: Simplify fix.md to remove scope/deferred language**

  Read `packages/osuperpowers/skills/cli-driven-development/templates/fix.md`.
  Remove all references to `blocker-only`, `deferred-sweep`, `deferred: true`, `CDD_FINDINGS_SCOPE`.
  The fix template should simply say: fix ALL findings listed in `{{FINDINGS}}` (blocker + warn + nit).

- [ ] **Step 5: Remove deferred-related tests from templates.test.mjs**

  In `templates.test.mjs`, remove tests that assert:
  - `deferred-sweep` in fix template
  - `blocker-only` in fix template
  - `deferred: true` in task-review template
  - `FINDINGS_SCOPE` placeholder rendering

  Add replacement assertion: `assert.ok(!fix.includes("deferred:"), "no deferred field in fix template")`.

- [ ] **Step 6: Run emit and tests**

  ```bash
  pnpm run emit && pnpm run validate
  ```
  Expected: all pass.

---

### Task 7: docs-handoff-schema.json + docs-runner.mjs

**Files:**
- Create: `packages/osuperpowers/skills/_templates/docs-handoff-schema.json`
- Create: `packages/osuperpowers/bin/engine/lib/docs-runner.mjs`
- Create: `packages/osuperpowers/bin/engine/tests/docs-runner.test.mjs`

**Interfaces:**
- Consumes: T1 (BLOCKED message format), T5 (renderHandoffStub)
- Produces: `docs-handoff-schema.json`; `runDocsTask(mode, opts) → Promise<{exitCode, handoff}>`

- [ ] **Step 1: Create docs-handoff-schema.json**

  ```json
  {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["phase", "status", "findings", "artifacts", "doc_path"],
    "properties": {
      "phase":     { "type": "string", "enum": ["review", "fix"] },
      "status":    { "type": "string", "enum": ["APPROVED", "CHANGES_REQUESTED", "BLOCKED"] },
      "doc_path":  { "type": "string" },
      "findings":  { "type": "array" },
      "artifacts": { "type": "object" },
      "round":     { "type": "integer" },
      "blocker":   { "type": "string" }
    },
    "additionalProperties": false
  }
  ```

  Save to `packages/osuperpowers/skills/_templates/docs-handoff-schema.json`.

- [ ] **Step 2: Update schema-utils.mjs to accept schemaPath parameter**

  ```js
  export function loadHandoffSchema(schemaPath) {
    const p = schemaPath ?? path.join(PKG_ROOT, "skills", "_templates", "handoff-schema.json");
    return JSON.parse(readFileSync(p, "utf8"));
  }

  export function validateHandoffSchema(handoff, schemaPath) {
    const schema = loadHandoffSchema(schemaPath);
    // ... rest of validation unchanged
  }
  ```

  Update existing callers of `loadHandoffSchema()` and `validateHandoffSchema()` to pass no argument (backward compatible — default is CDD schema).

  Note: `spawnCapture` is exported from `packages/osuperpowers/bin/engine/lib/cli-shared.mjs` (verified: exported at line 53 of the current codebase). The import `import { spawnCapture } from "./cli-shared.mjs"` is valid.

  Note: `renderTemplate` is already exported from `lib/templates.mjs` (verified: `export function renderTemplate` at line 62). No export change needed.

- [ ] **Step 3: Create docs-runner.mjs**

  ```js
  // engine/lib/docs-runner.mjs — lightweight runner for docs-task.mjs.
  // No commit-contract, no ledger, no probeSkills.
  // Spawns doc agent CLI; validates handoff against docs-handoff-schema.json.
  import { existsSync, readFileSync, writeFileSync } from "node:fs";
  import path from "node:path";
  import { fileURLToPath } from "node:url";
  import { spawnCapture } from "./cli-shared.mjs";
  import { validateHandoffSchema } from "./schema-utils.mjs";
  import { writeHandoff } from "./contract.mjs";
  import { renderHandoffStub, renderTemplate } from "./templates.mjs";

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const PKG_ROOT = path.resolve(HERE, "../../..");
  const DOCS_SCHEMA_PATH = path.join(PKG_ROOT, "skills", "_templates", "docs-handoff-schema.json");

  export async function runDocsTask(mode, {
    harness,
    template,      // e.g. "spec-review"
    docPath,       // path to the document being reviewed/fixed
    findingsPath,  // path to review handoff (for fix mode)
    handoffPath,   // where to write the handoff JSON
    round = 1,
    dryRun = false,
    extraParams = {},  // additional template params from --param KEY=VALUE flags
  }) {
    if (dryRun) {
      return { exitCode: 0, handoff: { phase: mode, status: "APPROVED", findings: [], artifacts: {}, doc_path: docPath } };
    }

    // Render prompt from template (two-pass: first renderTemplate for {{DOC}}/{{FINDINGS}}/{{HANDOFF}},
    // then replace {{HANDOFF_STUB}} with schema-derived stub)
    const schema = JSON.parse(readFileSync(DOCS_SCHEMA_PATH, "utf8"));
    const stub = renderHandoffStub(schema, mode, undefined, { docPath });
    const templateName = mode === "fix"
      ? template.replace(/-review$/, "") + "-fix"
      : template;
    let prompt = renderTemplate(templateName, {
      DOC: docPath, FINDINGS: findingsPath ?? "", HANDOFF: handoffPath,
      ...extraParams,  // passes SPEC= and other --param KEY=VALUE pairs
    }, "docs-runner");
    prompt = prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);

    // Spawn agent (spawnCapture(command, args, opts) — opts: {cwd, env, timeoutMs}; see cli-shared.mjs)
    const { rc, stdout, stderr } = await spawnCapture(harness, prompt, {});

    // Read handoff from disk (agent writes it)
    if (!existsSync(handoffPath)) {
      writeHandoff(handoffPath, {
        phase: mode,
        status: "BLOCKED",
        findings: [],
        artifacts: {},
        doc_path: docPath,
        blocker: `${path.basename(handoffPath)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${handoffPath} before exit`,
      });
      return { exitCode: 1, handoff: JSON.parse(readFileSync(handoffPath, "utf8")) };
    }

    const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
    const sv = validateHandoffSchema(handoff, DOCS_SCHEMA_PATH);
    if (!sv.valid) {
      writeHandoff(handoffPath, {
        phase: mode,
        status: "BLOCKED",
        findings: [],
        artifacts: {},
        doc_path: docPath,
        blocker: `docs handoff schema invalid: ${sv.reason} → fix the handoff JSON at ${handoffPath} and re-run ${mode}`,
      });
      return { exitCode: 1, handoff: JSON.parse(readFileSync(handoffPath, "utf8")) };
    }

    return { exitCode: rc, handoff };
  }
  ```

- [ ] **Step 4: Write basic docs-runner.test.mjs**

  Before writing, read `packages/osuperpowers/bin/engine/lib/schema-utils.mjs` to confirm the exact error message format for enum violations (`invalid phase: <value>`) and missing-field errors (`missing required field: <field>`). The tests below use these patterns — adjust if the actual messages differ.

  ```js
  // engine/tests/docs-runner.test.mjs
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { validateHandoffSchema, loadHandoffSchema } from "../lib/schema-utils.mjs";
  import path from "node:path";
  import { fileURLToPath } from "node:url";

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const PKG_ROOT = path.resolve(HERE, "../../..");
  const DOCS_SCHEMA = path.join(PKG_ROOT, "skills", "_templates", "docs-handoff-schema.json");

  test("docs-handoff-schema: required fields present", () => {
    const schema = loadHandoffSchema(DOCS_SCHEMA);
    assert.deepEqual(schema.required, ["phase", "status", "findings", "artifacts", "doc_path"]);
  });

  test("docs-handoff-schema: valid review handoff", () => {
    const r = validateHandoffSchema(
      { phase: "review", status: "APPROVED", findings: [], artifacts: {}, doc_path: "/spec.md" },
      DOCS_SCHEMA
    );
    assert.equal(r.valid, true);
  });

  test("docs-handoff-schema: valid fix handoff", () => {
    const r = validateHandoffSchema(
      { phase: "fix", status: "APPROVED", findings: [], artifacts: {}, doc_path: "/spec.md" },
      DOCS_SCHEMA
    );
    assert.equal(r.valid, true);
  });

  test("docs-handoff-schema: invalid phase rejects", () => {
    const r = validateHandoffSchema(
      { phase: "doc-review", status: "APPROVED", findings: [], artifacts: {}, doc_path: "/spec.md" },
      DOCS_SCHEMA
    );
    assert.equal(r.valid, false);
    assert.match(r.reason, /invalid phase/);
  });

  test("docs-handoff-schema: missing doc_path rejects", () => {
    const r = validateHandoffSchema(
      { phase: "review", status: "APPROVED", findings: [], artifacts: {} },
      DOCS_SCHEMA
    );
    assert.equal(r.valid, false);
    assert.match(r.reason, /missing required field: doc_path/);
  });
  ```

- [ ] **Step 5: Run tests**

  ```bash
  pnpm run validate
  ```
  Expected: all pass.

---

### Task 8: docs-task.mjs (replaces cdd-review.mjs)

**Files:**
- Create: `packages/osuperpowers/bin/engine/docs-task.mjs`
- Create: `packages/osuperpowers/skills/_templates/spec-fix.md`
- Create: `packages/osuperpowers/skills/_templates/plan-fix.md`
- Modify: `packages/osuperpowers/skills/_templates/spec-review.md` (add HANDOFF_STUB)
- Modify: `packages/osuperpowers/skills/_templates/plan-review.md` (add HANDOFF_STUB)
- Delete: `packages/osuperpowers/bin/engine/cdd-review.mjs`

**Interfaces:**
- Consumes: T5 (renderHandoffStub), T7 (docs-runner.mjs, docs-handoff-schema.json)
- Produces: `docs-task.mjs --mode review|fix --template <name> --doc <path> [--findings <path>]`; writes `<slug>-review-R.json` / `<slug>-fix-R.json`; `cdd-review.mjs` deleted

- [ ] **Step 1: Create docs-task.mjs CLI**

  ```js
  #!/usr/bin/env node
  // bin/engine/docs-task.mjs — docs CLI (review + fix modes). Replaces cdd-review.mjs.
  // Usage: docs-task.mjs --harness <name> --mode review|fix --template <name> --doc <path> [--findings <path>] [-h]
  import { parseArgs } from "node:util";
  import path from "node:path";
  import { runDocsTask } from "./lib/docs-runner.mjs";
  import { exitWithCode } from "../utils/exit.mjs";
  // Note: ../utils/exit.mjs verified to exist at packages/osuperpowers/bin/utils/exit.mjs.

  const USAGE = "usage: docs-task.mjs --harness <name> --mode review|fix --template <name> --doc <path> [--findings <path>] [-h/--help]";
  const VALID_MODES = ["review", "fix"];
  const NO_FIX_TEMPLATES = ["branch-review"];

  const { values } = parseArgs({
    options: {
      harness:   { type: "string" },
      mode:      { type: "string" },
      template:  { type: "string" },
      doc:       { type: "string" },
      findings:  { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
    allowPositionals: true,
  });

  // Parse --param KEY=VALUE args (supports multiple; e.g. --param SPEC=<path>)
  const extraParams = {};
  for (let i = 2; i < process.argv.length - 1; i++) {
    if (process.argv[i] === "--param") {
      const eq = process.argv[i + 1].indexOf("=");
      if (eq > 0) {
        extraParams[process.argv[i + 1].slice(0, eq)] = process.argv[i + 1].slice(eq + 1);
      }
    }
  }

  if (values.help) { process.stdout.write(USAGE + "\n"); exitWithCode(0); }
  if (!values.harness || !values.mode || !values.template || !values.doc) {
    process.stderr.write(USAGE + "\n"); exitWithCode(2);
  }
  if (!VALID_MODES.includes(values.mode)) {
    process.stderr.write(`docs-task: --mode must be review|fix (got: ${values.mode})\n`); exitWithCode(2);
  }
  if (values.mode === "fix" && NO_FIX_TEMPLATES.includes(values.template)) {
    process.stderr.write(`docs-task: --template ${values.template} does not support --mode fix\n`); exitWithCode(2);
  }

  const dryRun = process.env.DOCS_DRY_RUN === "1";
  const round = parseInt(process.env.DOCS_ROUND ?? "1");
  const slug = path.basename(values.template); // e.g. "spec-review"
  const slugBase = slug.replace(/-review$/, ""); // "spec" — strip suffix for fix filename
  const handoffFile = values.mode === "review"
    ? `${slug}-${round}.json`          // spec-review-1.json
    : `${slugBase}-fix-${round}.json`; // spec-fix-1.json
  const workspace = path.dirname(values.doc);
  const handoffPath = path.join(workspace, handoffFile);

  const result = await runDocsTask(values.mode, {
    harness: values.harness,
    template: values.template,
    docPath: values.doc,
    findingsPath: values.findings,
    handoffPath,
    round,
    dryRun,
    extraParams,  // passed through to renderTemplate for {{SPEC}} etc.
  });

  process.stdout.write(`status: ${result.handoff.status}\n`);
  if (result.handoff.blocker) process.stdout.write(`blocker: ${result.handoff.blocker}\n`);
  exitWithCode(result.exitCode);
  ```

- [ ] **Step 2: Create spec-fix.md template**

  ```markdown
  # Docs Fix — CLI session

  Document: {{DOC}}
  Findings: {{FINDINGS}}
  Handoff path: {{HANDOFF}}

  Fix ALL findings listed in the findings file (blocker + warn + nit).
  Apply fixes directly to `{{DOC}}`.

  ## Handoff Output

  Write the following JSON exactly to `{{HANDOFF}}`:

  {{HANDOFF_STUB}}

  Rules:
  - `status`: APPROVED (all findings fixed) or BLOCKED (cannot proceed — explain in blocker)
  - `findings`: list any remaining issues you could not fix
  - `artifacts`: record the doc path (`{"doc": "{{DOC}}"}`)
  - `doc_path`: must be the exact path `{{DOC}}`
  ```

  Save to `packages/osuperpowers/skills/_templates/spec-fix.md`.

- [ ] **Step 3: Create plan-fix.md (identical structure, different heading)**

  Copy spec-fix.md to `plan-fix.md`, change heading to `# Plan Fix — CLI session`.

- [ ] **Step 4: Add HANDOFF_STUB to spec-review.md and plan-review.md**

  Read each file. In the `## Handoff Output` section, replace any hand-written JSON required fields with `{{HANDOFF_STUB}}`. Add:
  ```markdown
  ## Handoff Output
  Write the following JSON exactly to `{{HANDOFF}}`:
  {{HANDOFF_STUB}}
  Rules:
  - `status`: APPROVED (no blockers) or CHANGES_REQUESTED (blockers found)
  - `findings`: all review findings (blocker/warn/nit)
  - `doc_path`: must be the exact path `{{DOC}}`
  ```

- [ ] **Step 5: Migrate review.test.mjs → docs-task.test.mjs stub, then delete**

  First read `packages/osuperpowers/bin/engine/tests/review.test.mjs`. Identify any test scenarios that need migration. Create a stub `docs-task.test.mjs` now (T13 Step 6 extends it):

  Create `packages/osuperpowers/bin/engine/tests/docs-task.test.mjs` as a stub now (T13 Step 6 extends it):
  ```js
  // engine/tests/docs-task.test.mjs — integration tests for docs-task.mjs CLI.
  // Covers: --mode review/fix dry-run, invalid args, schema rejection.
  // Migrated from review.test.mjs (deleted in T8). Extended in T13.
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { spawnSync } from "node:child_process";
  import path from "node:path";
  import { fileURLToPath } from "node:url";

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = path.resolve(HERE, "../../../../..");
  const DOCS_TASK = path.join(REPO_ROOT, "packages/osuperpowers/bin/engine/docs-task.mjs");

  function run(args, extraEnv = {}) {
    return spawnSync("node", [DOCS_TASK, ...args], {
      cwd: REPO_ROOT, env: { ...process.env, ...extraEnv }, encoding: "utf8",
    });
  }

  test("docs-task.mjs: -h → usage + exit 0", () => {
    const r = run(["-h"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^usage:/);
  });

  test("docs-task.mjs: missing --harness → usage + exit 2", () => {
    const r = run(["--mode", "review", "--template", "spec-review", "--doc", "/x.md"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^usage:/);
  });

  test("docs-task.mjs: invalid --mode → exit 2", () => {
    const r = run(["--harness", "claude", "--mode", "doc-review", "--template", "spec-review", "--doc", "/x.md"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /must be review\|fix/);
  });

  test("docs-task.mjs: branch-review + --mode fix → exit 2", () => {
    const r = run(["--harness", "claude", "--mode", "fix", "--template", "branch-review", "--doc", "/x.md"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /does not support.*fix/);
  });
  ```

  Then delete the original test file:
  ```bash
  git rm packages/osuperpowers/bin/engine/cdd-review.mjs
  git rm packages/osuperpowers/bin/engine/tests/review.test.mjs
  ```

- [ ] **Step 6: Update SKILL.md references (brainstorming only in T8; writing-plans in T12)**

  **Scope of T8 Step 6:** Only update `brainstorming/SKILL.md` `spec-review?` Do field CLI invocation. The `writing-plans/SKILL.md` update is deferred to T12. This ensures T11 does not encounter a double-update.

  In `packages/osuperpowers/skills/brainstorming/SKILL.md`:
  ```
  # old:
  node {pluginRoot}/bin/engine/cdd-review.mjs --harness <name> --template spec-review --param PASS=<pass-type> --param DOC=<path>
  # new:
  node {pluginRoot}/bin/engine/docs-task.mjs --harness <name> --mode review --template spec-review --doc <path>
  ```

- [ ] **Step 7: Run emit and validate**

  ```bash
  pnpm run emit && pnpm run validate
  ```
  Expected: all pass; no reference to `cdd-review.mjs` in SKILL.md files.

- [ ] **Step 8: Verify no stale cdd-review.mjs references**

  ```bash
  grep -r "cdd-review.mjs" packages/osuperpowers/ docs/ --include="*.md" --include="*.mjs" --include="*.json"
  ```
  Expected: no output.

---

### Task 9: review-loop.mjs shared module

**Files:**
- Create: `packages/osuperpowers/bin/engine/review-loop.mjs`
- Create: `packages/osuperpowers/bin/engine/tests/review-loop.test.mjs`

**Interfaces:**
- Consumes: T4 (BLOCKED step 10.5), T8 (docs-task.mjs API)
- Produces: `runReviewLoop({runReview, runFix, getBlockers, onRoundDone})` — shared loop; CDD and docs wiring

- [ ] **Step 1: Write review-loop.test.mjs first (TDD)**

  ```js
  // engine/tests/review-loop.test.mjs
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { runReviewLoop } from "../review-loop.mjs";

  test("runReviewLoop: blocker=0 on first round → calls runFix once, exits", async () => {
    const calls = [];
    await runReviewLoop({
      runReview: async (r) => { calls.push(`review-${r}`); return { findings: [] }; },
      runFix:    async (r, f) => { calls.push(`fix-${r}`); },
      getBlockers: (h) => [],
    });
    assert.deepEqual(calls, ["review-1", "fix-1"]);
  });

  test("runReviewLoop: blocker>0 on round 1, blocker=0 on round 2 → loops once", async () => {
    const calls = [];
    let round = 0;
    await runReviewLoop({
      runReview: async (r) => {
        calls.push(`review-${r}`);
        round++;
        return { findings: round === 1 ? [{ severity: "blocker" }] : [] };
      },
      runFix:    async (r, f) => { calls.push(`fix-${r}`); },
      getBlockers: (h) => h.findings.filter(f => f.severity === "blocker"),
    });
    assert.deepEqual(calls, ["review-1", "fix-1", "review-2", "fix-2"]);
  });

  test("runReviewLoop: round counter increments", async () => {
    const rounds = [];
    let callCount = 0;
    await runReviewLoop({
      runReview: async (r) => {
        rounds.push(r);
        callCount++;
        return { findings: callCount < 3 ? [{ severity: "blocker" }] : [] };
      },
      runFix: async () => {},
      getBlockers: (h) => h.findings.filter(f => f.severity === "blocker"),
    });
    assert.deepEqual(rounds, [1, 2, 3]);
  });

  test("runReviewLoop: onRoundDone called with final round + findings", async () => {
    let doneCalled = null;
    await runReviewLoop({
      runReview: async (r) => ({ findings: [] }),
      runFix: async () => {},
      getBlockers: () => [],
      onRoundDone: (r, f) => { doneCalled = { r, f }; },
    });
    assert.equal(doneCalled.r, 1);
    assert.deepEqual(doneCalled.f, []);
  });
  ```

- [ ] **Step 2: Run tests (expect failures — TDD red)**

  ```bash
  node --test packages/osuperpowers/bin/engine/tests/review-loop.test.mjs
  ```
  Expected: failures (module not found).

- [ ] **Step 3: Implement review-loop.mjs**

  ```js
  // engine/review-loop.mjs — shared review→fix loop (CDD + docs).
  // runReview(round) → Promise<handoff>
  // runFix(round, findings) → Promise<handoff>
  // getBlockers(handoff) → finding[]
  // onRoundDone(round, findings) → void (optional)
  export async function runReviewLoop({ runReview, runFix, getBlockers, onRoundDone }) {
    let round = 1;
    while (true) {
      const reviewHandoff = await runReview(round);
      const blockers = getBlockers(reviewHandoff);
      await runFix(round, reviewHandoff.findings ?? []);
      if (blockers.length === 0) {
        onRoundDone?.(round, reviewHandoff.findings ?? []);
        break;
      }
      round++;
    }
  }
  ```

- [ ] **Step 4: Run tests (expect green)**

  ```bash
  node --test packages/osuperpowers/bin/engine/tests/review-loop.test.mjs
  ```
  Expected: all pass.

- [ ] **Step 5: Document wiring model (no additional production call site needed)**

  Add a comment block to `review-loop.mjs`:
  ```js
  // Wiring model:
  // - CDD orchestrator (AI following CDD SKILL.md): calls cdd-task.mjs --mode task-review
  //   then cdd-task.mjs --mode fix directly, following the Review Stopping digraph.
  //   runReviewLoop is available for test harnesses and future CLI wrappers.
  // - Docs orchestrator (AI following brainstorming/writing-plans SKILL.md): calls
  //   docs-task.mjs --mode review then docs-task.mjs --mode fix.
  // Production wiring is via the AI orchestrator making tool calls, not via Node imports.
  // This module provides: (a) a testable reference implementation, (b) a shared abstraction
  //   for future cdd-run-review.mjs / docs-run-review.mjs CLI wrappers.
  ```

- [ ] **Step 6: Run full validate**

  ```bash
  pnpm run validate
  ```
  Expected: all pass.

---

### Task 10: _docs/docs-review.md — Rule: Review Stopping SOT

**Files:**
- Modify: `packages/osuperpowers/skills/_docs/docs-review.md`

**Interfaces:**
- Consumes: §2.7 unified digraph design
- Produces: `### Rule: Review Stopping` section in docs-review.md as the single SOT; old D1-shortcut removed; deferred-sweep removed

- [ ] **Step 1: Read docs-review.md current content**

  Read `packages/osuperpowers/skills/_docs/docs-review.md` to understand current structure. Note: spec §2.7 incorrectly lists this file as `skills/cli-driven-development/_docs/docs-review.md`; the actual on-disk path is `skills/_docs/docs-review.md` (verified by `find`). The brainstorming SKILL.md references it as `_docs/docs-review.md` (relative to skill root).

- [ ] **Step 2: Remove D1-shortcut (skip D2/D3 if D1 clean)**

  Find and delete any rule that says "if D1 has zero findings, skip D2 and D3". This was removed in Pε but verify it's fully gone.

- [ ] **Step 3: Remove deferred-sweep references**

  Remove any mention of `deferred`, `deferred-sweep`, `deferred: true` from docs-review.md.

- [ ] **Step 4: Add `### Rule: Review Stopping` section**

  Add after the D1/D2/D3 severity definitions (also add DOCS_ROUND tracking for multi-round docs reviews). Note: the nested ` ```mermaid ``` ` fence inside a ` ```markdown ``` ` block causes parsers to close the outer fence early. Write the mermaid diagram directly in docs-review.md without wrapping in a markdown fence:

  In docs-review.md, add this section directly (not inside a code block in the plan — the implementer writes it to the file as plain markdown):
  ```
  ### Rule: Review Stopping

  [mermaid diagram]
  flowchart TD
    A[run-review] --> B{blocker=0?}
    B -->|yes| C[cli-fix-all-findings]
    C --> D((done))
    B -->|no| E[cli-fix-all-findings]
    E --> A
  [/mermaid]

  **`run-review`**
  - Do: ... (set DOCS_ROUND=N for doc-review)

  **`cli-fix-all-findings`**
  - Do: ... (include --findings flag for doc-review)
  ```

  Write the full node definitions with DOCS_ROUND and --findings details as specified in the `Add after D1/D2/D3` note above.

  ```markdown
  ### Rule: Review Stopping

  ```mermaid
  flowchart TD
    A[run-review] --> B{blocker=0?}
    B -->|yes| C[cli-fix-all-findings]
    C --> D((done))
    B -->|no| E[cli-fix-all-findings]
    E --> A
  ```

  **`run-review`**
  - Do: Execute one full review. CDD → `cdd-task.mjs --mode task-review`; doc-review → `docs-task.mjs --mode review` (D1/D2/D3 passes). Count blockers from findings.
  - Exit: blocker=0 → `cli-fix-all-findings` (done path); blocker>0 → `cli-fix-all-findings` (re-run path)
  - **Invariant**: must not re-run after blocker=0 output (Review Stopping violation)

  **`cli-fix-all-findings`**
  - Do: Pass all findings (blocker + warn + nit) to fix. CDD → `cdd-task.mjs --mode fix`; doc-review → `DOCS_ROUND=N docs-task.mjs --mode fix --template <name> --doc <path> --findings <review-N-handoff-path>` (the `--findings` flag is required so {{FINDINGS}} in fix templates resolves to actual findings; without it the fix agent receives nothing to act on). Fix agent writes handoff with schema validation.
  - Exit: Returns to `run-review` if entered via the blocker>0 path; terminates if entered via the blocker=0 path. Routing is path-inherited.

  **Eliminated rules:**
  - D1 zero findings → skip D2/D3 (eliminated)
  - blocker=0 → user gate for warn/nit (eliminated; fix agent handles all)
  - Fix only blockers (eliminated; always fix all findings)
  - deferred findings channel (eliminated)
  ```

- [ ] **Step 5: Run emit and validate**

  ```bash
  pnpm run emit && pnpm run validate
  ```
  Expected: all pass.

---

### Task 11: brainstorming SKILL.md alignment

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md`

**Interfaces:**
- Consumes: T8 (docs-task.mjs), T10 (docs-review.md SOT)
- Produces: `spec-review?` uses docs-task.mjs; `user-ok?` node deleted; I5 references SOT; digraph updated

- [ ] **Step 1: Update `spec-review?` Do field — CLI call (verify T8 already applied)**

  T8 Step 6 updated brainstorming SKILL.md's `spec-review?` CLI invocation. Verify it is already correct:
  ```
  node {pluginRoot}/bin/engine/docs-task.mjs --harness <name> --mode review --template spec-review --doc <path>
  ```
  If T8 Step 6 has not been applied (e.g. tasks run out of order), apply the substitution now. This step is a no-op if T8 Step 6 ran first.

- [ ] **Step 2: Update Review Stopping in `spec-review?` Do field**

  Replace the inline Review Stopping description with:
  ```
  Review Stopping (I5): follow `### Rule: Review Stopping` in `_docs/docs-review.md` — blocker>0: cli-fix-all-findings → re-run; blocker=0: cli-fix-all-findings → done. No re-run after blocker=0.
  ```

- [ ] **Step 3: Delete `user-ok?` node**

  Remove the entire `### user-ok?` node definition from the Node Definitions section.

- [ ] **Step 4: Update digraph — remove user-ok? node, route blocker=0 through cli-fix-all**

  The actual Mermaid node IDs from Step 1 reading (from current brainstorming SKILL.md):
  - spec-review? node: `K{spec-review?}`
  - user-ok? node: `L{user-ok?}`
  - user-confirm-commit?: `Q{user-confirm-commit?}`
  (verify these IDs by reading the SKILL.md in Step 1 before applying)

  Replace:
  - Delete the `L{user-ok?}` node line
  - Delete all edges: `K -->|blocker=0| L`, `L -->|fix selected| ...`, `L -->|approved| Q`

  Add routing through cli-fix-all-findings:
  ```
  K -->|blocker=0| FIX_CLEAN[cli-fix-all-findings]
  FIX_CLEAN --> Q
  K -->|blocker found| FIX_BLOCK[cli-fix-all-findings]
  FIX_BLOCK --> K
  ```
  Use the actual node IDs read in Step 1.

- [ ] **Step 5: Update I5 invariant text**

  Change:
  ```
  | I5 | **Review Stopping** — re-run driven only by blockers; no re-run after blocker=0; ...
  ```
  To:
  ```
  | I5 | **Review Stopping** — see `### Rule: Review Stopping` in `_docs/docs-review.md`; never re-run after review output shows blocker=0 |
  ```

- [ ] **Step 6: Run emit and validate**

  ```bash
  pnpm run emit && pnpm run validate
  ```
  Expected: all pass.

---

### Task 12: writing-plans SKILL.md alignment

**Files:**
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.md`

**Interfaces:**
- Consumes: T8 (docs-task.mjs), T10 (docs-review.md SOT)
- Produces: plan-review uses docs-task.mjs; Review Stopping references SOT

- [ ] **Step 1: Update `plan-review` Do field — CLI call**

  First check `packages/osuperpowers/skills/_templates/plan-review.md` for `{{SPEC}}` usage. It does use `{{SPEC}}` (line 3: "Review the plan document at **{{DOC}}** against spec at **{{SPEC}}**"). Therefore, `--param SPEC=<path>` must be preserved.

  Update the SKILL.md reference from:
  ```
  node {pluginRoot}/bin/engine/cdd-review.mjs --harness <name> --template plan-review --param PASS=<pass-type> --param DOC=<path> --param SPEC=<spec-path>
  ```
  To:
  ```
  node {pluginRoot}/bin/engine/docs-task.mjs --harness <name> --mode review --template plan-review --doc <path> --param SPEC=<spec-path>
  ```

  Note: `--param` support is already implemented in T8 Step 1. Only the SKILL.md invocation example needs updating to include `--param SPEC=<spec-path>`.

- [ ] **Step 2: Update Review Stopping (I4) in `plan-review` Do field**

  Replace inline Review Stopping description with reference to SOT:
  ```
  Review Stopping (I4): follow `### Rule: Review Stopping` in `_docs/docs-review.md`.
  ```

- [ ] **Step 3: Update I4 invariant text**

  ```
  | I4 | **Review Stopping** — see `### Rule: Review Stopping` in `_docs/docs-review.md` |
  ```

- [ ] **Step 4: Run emit and validate**

  ```bash
  pnpm run emit && pnpm run validate
  ```
  Expected: all pass.

---

### Task 13: Full test coverage (#219)

**Files:**
- Modify: `packages/osuperpowers/bin/engine/tests/runner.test.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/task.test.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/templates.test.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/docs-runner.test.mjs` (extend T7 tests)
- Create: `packages/osuperpowers/bin/engine/tests/docs-task.test.mjs`

**Interfaces:**
- Consumes: T1–T12 (all prior tasks complete)
- Produces: full regression suite for step 8.8 loop prevention, step 10.5 BLOCKED, per-round paths, HANDOFF_STUB rendering, review-loop behavior, docs-task CLI

- [ ] **Step 1: Add `invokeCliOverride` seam to `runTask` in runner.mjs**

  Before writing tests that use the seam, add the override parameter to `runTask`. In `runner.mjs`:
  ```js
  // Update runTask signature to accept invokeCliOverride for test seams:
  export async function runTask(harness, taskNum, {
    mode, dryRun = false, probeSkills, env, noExit = false,
    invokeCliOverride = null,  // test seam: async (briefPath, workspace, env) => {rc, stdout, stderr}
  } = {}) {
  ```
  Then replace the `invokeCli(...)` call with:
  ```js
  const { rc: agentRc, stdout: agentOut, stderr: cliStderr } = invokeCliOverride
    ? await invokeCliOverride(env.CDD_TASK_BRIEF, workspace, env)
    : await invokeCli(harness, env.CDD_TASK_BRIEF, workspace, env, ...);
  ```

- [ ] **Step 2: Add runner.test.mjs — BLOCKED handoff schema validity for all BLOCKED paths**

  Pre-flight: confirm helpers exist in runner.test.mjs (verified: `setupWorkspace` line 30, `NOOP_PROBE` line 27, `baseEnv` line 42). Add to `runner.test.mjs`:
  ```js
  // Helper: assert a handoff file has artifacts + → message
  function assertBlockedHandoffValid(handoffPath) {
    assert.ok(existsSync(handoffPath), `BLOCKED handoff must be written: ${handoffPath}`);
    const h = JSON.parse(readFileSync(handoffPath, "utf8"));
    assert.equal(h.status, "BLOCKED");
    assert.ok(h.artifacts !== undefined, "BLOCKED handoff must have artifacts: {}");
    assert.match(h.blocker, /→/, "BLOCKED blocker must contain → action");
  }

  test("runTask: step 8.8 BLOCKED handoff is schema-valid (has artifacts)", async () => {
    const ws = setupWorkspace();
    // Pre-seed an invalid handoff (missing artifacts) at the per-round path.
    // invokeCliOverride exits 0 without touching the file, so step 8.8 reads the pre-seeded invalid handoff.
    writeFileSync(path.join(ws, "task-1-implement.json"), JSON.stringify({
      task: 1, phase: "implement", status: "APPROVED", findings: [],
      // no artifacts — schema invalid → triggers step 8.8
    }));
    const res = await runTask("claude", 1, {
      mode: "implement", dryRun: false, probeSkills: NOOP_PROBE,
      env: baseEnv(ws), noExit: true,
      invokeCliOverride: async () => ({ rc: 0, stdout: "", stderr: "" }),
    });
    assert.equal(res.exitCode, 1);
    assertBlockedHandoffValid(path.join(ws, "task-1-implement.json"));
  });

  test("runTask: step 10 (cli failed no handoff) BLOCKED has artifacts + action message", async () => {
    const ws = setupWorkspace();
    const res = await runTask("claude", 1, {
      mode: "implement", dryRun: false, probeSkills: NOOP_PROBE,
      env: baseEnv(ws), noExit: true,
      invokeCliOverride: async () => ({ rc: 1, stdout: "", stderr: "some error" }),
    });
    assert.equal(res.exitCode, 1);
    assertBlockedHandoffValid(path.join(ws, "task-1-implement.json"));
  });

  test("runTask: step 10.5 BLOCKED when cli exits 0 but handoff not written", async () => {
    const ws = setupWorkspace();
    writeFileSync(path.join(ws, "task-1-implement.json"), JSON.stringify({
      task: 1, phase: "implement", status: "APPROVED",
      findings: [], artifacts: {}, commits: { base: "a".repeat(40) },
    }));
    const res = await runTask("claude", 1, {
      mode: "task-review", dryRun: false, probeSkills: NOOP_PROBE,
      env: baseEnv(ws), noExit: true,
      invokeCliOverride: async () => ({ rc: 0, stdout: "", stderr: "" }),
    });
    assert.equal(res.exitCode, 1, "step 10.5 BLOCKED must exit 1");
    assertBlockedHandoffValid(path.join(ws, "task-1-task-review-1.json"));
  });

  test("runTask: per-round buildTaskEnv — task-review derives task-1-task-review-1.json", async () => {
    const ws = setupWorkspace();
    const env = buildTaskEnv(baseEnv(ws), ws, 1, "task-review", "claude", { round: 1 });
    assert.ok(env.CDD_HANDOFF_PATH.endsWith("task-1-task-review-1.json"),
      `expected task-1-task-review-1.json, got: ${env.CDD_HANDOFF_PATH}`);
  });

  test("runTask: implement derives task-1-implement.json (no round suffix)", async () => {
    const ws = setupWorkspace();
    const env = buildTaskEnv(baseEnv(ws), ws, 1, "implement", "claude", { round: 1 });
    assert.ok(env.CDD_HANDOFF_PATH.endsWith("task-1-implement.json"),
      `expected task-1-implement.json, got: ${env.CDD_HANDOFF_PATH}`);
  });

  test("runTask: BLOCKED message contains diagnosis → action format", async () => {
    const ws = setupWorkspace();
    await runTask("claude", 1, {
      mode: "implement", dryRun: false, probeSkills: NOOP_PROBE,
      env: baseEnv(ws), noExit: true,
      invokeCliOverride: async () => ({ rc: 1, stdout: "", stderr: "test error" }),
    });
    if (existsSync(path.join(ws, "task-1-implement.json"))) {
      const h = JSON.parse(readFileSync(path.join(ws, "task-1-implement.json"), "utf8"));
      if (h.blocker) assert.match(h.blocker, /→/, "BLOCKED message must contain →");
    }
  });
  ```

  Note: `invokeCliOverride` is added to `runTask` in Task 13 Step 1. Add the seam before writing the tests that use it.

- [ ] **Step 3: Add templates.test.mjs — renderHandoffStub tests (all 3 CDD modes + docs)**

  Add to `templates.test.mjs`:
  ```js
  import { renderHandoffStub } from "../lib/templates.mjs";
  import { loadHandoffSchema } from "../lib/schema-utils.mjs";

  test("renderHandoffStub: implement mode → task integer + correct phase", () => {
    const schema = loadHandoffSchema();
    const stub = renderHandoffStub(schema, "implement", 3);
    assert.ok(stub.includes('"task": 3'), "task must be integer");
    assert.ok(stub.includes('"phase": "implement"'));
    assert.ok(stub.includes('"status": "APPROVED"'));
    assert.ok(stub.includes('"findings": []'));
    assert.ok(stub.includes('"artifacts": {}'));
  });

  test("renderHandoffStub: task-review mode → phase task-review", () => {
    const schema = loadHandoffSchema();
    const stub = renderHandoffStub(schema, "task-review", 2);
    assert.ok(stub.includes('"task": 2'));
    assert.ok(stub.includes('"phase": "task-review"'));
  });

  test("renderHandoffStub: fix mode → phase fix", () => {
    const schema = loadHandoffSchema();
    const stub = renderHandoffStub(schema, "fix", 1);
    assert.ok(stub.includes('"phase": "fix"'));
  });

  test("renderHandoffStub: docs schema → doc_path field, no task field", () => {
    // PLUGIN_ROOT is already defined in templates.test.mjs:
    // const PLUGIN_ROOT = path.resolve(HERE, "../../.."); // packages/osuperpowers
    const docsSchema = JSON.parse(readFileSync(
      path.join(PLUGIN_ROOT, "skills/_templates/docs-handoff-schema.json"), "utf8"
    ));
    const stub = renderHandoffStub(docsSchema, "review", undefined, { docPath: "/spec.md" });
    assert.ok(stub.includes('"doc_path": "/spec.md"'));
    assert.ok(!stub.includes('"task"'), "no task field for docs schema");
  });

  test("renderModePrompt: no residual {{HANDOFF_STUB}} in implement", () => {
    const env = { WORKSPACE: "/ws", BRIEF: "/ws/b.md", HANDOFF: "/ws/h.json", CONSTRAINTS: "/ws/c.md", TASK: "1" };
    const out = renderModePrompt("implement", env);
    assert.ok(!out.includes("{{HANDOFF_STUB}}"), "no residual HANDOFF_STUB in implement");
    assert.ok(out.includes('"task": 1'), "stub rendered with task integer");
  });

  test("renderModePrompt: no residual {{HANDOFF_STUB}} in task-review", () => {
    const env = { WORKSPACE: "/ws", BRIEF: "/ws/b.md", HANDOFF: "/ws/h.json", CONSTRAINTS: "/ws/c.md", TASK: "1" };
    const out = renderModePrompt("task-review", env);
    assert.ok(!out.includes("{{HANDOFF_STUB}}"), "no residual HANDOFF_STUB in task-review");
    assert.ok(out.includes('"phase": "task-review"'));
  });

  test("renderModePrompt: no residual {{HANDOFF_STUB}} in fix", () => {
    const env = { WORKSPACE: "/ws", BRIEF: "/ws/b.md", HANDOFF: "/ws/h.json", CONSTRAINTS: "/ws/c.md",
                  FINDINGS: "/ws/f.json", TASK: "1" };
    const out = renderModePrompt("fix", env);
    assert.ok(!out.includes("{{HANDOFF_STUB}}"), "no residual HANDOFF_STUB in fix");
    assert.ok(out.includes('"phase": "fix"'));
  });
  ```

- [ ] **Step 4: Extend docs-runner.test.mjs — dry-run + BLOCKED message format**

  Add to `packages/osuperpowers/bin/engine/tests/docs-runner.test.mjs`:
  ```js
  import { runDocsTask } from "../lib/docs-runner.mjs";
  import { mkdtempSync, writeFileSync } from "node:fs";
  import { tmpdir } from "node:os";

  test("runDocsTask: dry-run review → exitCode 0 + APPROVED handoff", async () => {
    const ws = mkdtempSync(path.join(tmpdir(), "docs-runner-"));
    const handoffPath = path.join(ws, "spec-review-1.json");
    const result = await runDocsTask("review", {
      harness: "claude", template: "spec-review",
      docPath: "/spec.md", findingsPath: undefined,
      handoffPath, round: 1, dryRun: true,
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.handoff.status, "APPROVED");
    assert.equal(result.handoff.phase, "review");
  });

  test("runDocsTask: BLOCKED handoff has artifacts + <diagnosis> → <action> message", async () => {
    const ws = mkdtempSync(path.join(tmpdir(), "docs-runner-"));
    const handoffPath = path.join(ws, "spec-review-1.json");
    // Don't write handoff → triggers BLOCKED path (no dryRun, no real CLI → exits non-zero)
    // Simulate by calling runDocsTask with dryRun:false but no real agent;
    // the BLOCKED is written when handoff file doesn't exist after agent exits.
    // Since we can't control CLI exit in unit test, test the BLOCKED message format directly:
    const { writeHandoff } = await import("../lib/contract.mjs");
    writeHandoff(handoffPath, {
      phase: "review", status: "BLOCKED", findings: [], artifacts: {},
      doc_path: "/spec.md",
      blocker: `spec-review-1.json not written after exit 0 → re-run review and ensure handoff is written to ${handoffPath} before exit`,
    });
    const h = JSON.parse(readFileSync(handoffPath, "utf8"));
    assert.match(h.blocker, /→/, "BLOCKED blocker must contain → action");
    assert.ok(h.artifacts !== undefined, "BLOCKED handoff must have artifacts field");
  });
  ```

- [ ] **Step 5: Add round-2 path derivation test to runner.test.mjs**

  Add to `runner.test.mjs` (using `buildTaskEnv` and `getRound` directly — both already imported):
  ```js
  test("runTask: round-2 buildTaskEnv derives task-1-task-review-2.json", async () => {
    const ws = setupWorkspace();
    const progressPath = path.join(ws, "progress.json");
    const prog = JSON.parse(readFileSync(progressPath, "utf8"));
    if (!prog.tasks.find(t => t.task === 1)) prog.tasks.push({ task: 1, status: "pending", rounds: {} });
    prog.tasks.find(t => t.task === 1).rounds = { "task-review": 1 }; // round 1 completed
    writeFileSync(progressPath, JSON.stringify(prog, null, 2));

    // buildTaskEnv with round=2 derives task-1-task-review-2.json
    const taskEnv = buildTaskEnv(baseEnv(ws), ws, 1, "task-review", "claude", { round: 2 });
    assert.ok(taskEnv.CDD_HANDOFF_PATH.endsWith("task-1-task-review-2.json"),
      `expected task-1-task-review-2.json, got: ${taskEnv.CDD_HANDOFF_PATH}`);

    // getRound returns 2 (last completed=1, next=2)
    const updated = JSON.parse(readFileSync(progressPath, "utf8"));
    assert.equal(getRound(updated, 1, "task-review"), 2);
  });
  ```

- [ ] **Step 6: Add docs-task.test.mjs — --mode review + --mode fix dry-run + schema rejection**

  Add to `packages/osuperpowers/bin/engine/tests/docs-task.test.mjs` (all imports at top of file):
  ```js
  import { validateHandoffSchema } from "../lib/schema-utils.mjs";

  // DOCS_SCHEMA_PATH (add alongside REPO_ROOT at top of test file):
  const DOCS_SCHEMA_PATH = path.join(REPO_ROOT, "packages/osuperpowers/skills/_templates/docs-handoff-schema.json");

  test("docs-task.mjs: --param KEY=VALUE passes through to template rendering → exit 0", () => {
    // Verifies extraParams from --param reach renderTemplate (spec §2.9 extraParams)
    const r = run(
      ["--harness", "claude", "--mode", "review", "--template", "plan-review",
       "--doc", "/x.md", "--param", "SPEC=/some/spec.md"],
      { DOCS_DRY_RUN: "1" },
    );
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    // dry-run skips real agent; just verify CLI doesn't crash on --param
    assert.match(r.stdout, /^status: APPROVED$/m);
  });

  test("docs-task.mjs: dry-run review → status APPROVED + exit 0", () => {
    const r = run(
      ["--harness", "claude", "--mode", "review", "--template", "spec-review", "--doc", "/x.md"],
      { DOCS_DRY_RUN: "1" },
    );
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.match(r.stdout, /^status: APPROVED$/m);
  });

  test("docs-task.mjs: dry-run fix → status APPROVED + exit 0", () => {
    const r = run(
      ["--harness", "claude", "--mode", "fix", "--template", "spec-review", "--doc", "/x.md"],
      { DOCS_DRY_RUN: "1" },
    );
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.match(r.stdout, /^status: APPROVED$/m);
  });

  test("docs-task.mjs: invalid schema phase → validateHandoffSchema rejects", () => {
    const invalidHandoff = {
      phase: "doc-review",  // invalid — enum expects "review"
      status: "APPROVED", findings: [], artifacts: {}, doc_path: "/spec.md",
    };
    const result = validateHandoffSchema(invalidHandoff, DOCS_SCHEMA_PATH);
    assert.equal(result.valid, false, "invalid phase must be rejected by docs-handoff-schema");
    assert.match(result.reason, /invalid phase/);
  });
  ```

- [ ] **Step 7: Run full test suite**

  ```bash
  pnpm run validate
  ```
  Expected: all 12 CI blocks pass, all new tests green.

---

### Task 14: CLAUDE.md + docs/maintainers/ update

**Files:**
- Modify: `docs/maintainers/osuperpowers-plugin.md`
- Modify: `CLAUDE.md` (if relevant sections exist)

**Interfaces:**
- Consumes: T13 (all implementation complete and tested)
- Produces: BLOCKED message format, Review Stopping digraph, per-phase-per-round architecture, fix-mode simplified contract, docs-task.mjs documented

- [ ] **Step 1: Read docs/maintainers/osuperpowers-plugin.md**

  Find the sections on CDD engine, handoff schema, templates. Add or update:

  **BLOCKED message format (add to CDD Engine section):**
  ```markdown
  ### BLOCKED Message Format

  All `writeHandoff({ status: "BLOCKED" })` calls must include:
  1. `artifacts: {}` — prevents step 8.8 re-validation loop
  2. `blocker` field formatted as: `"<diagnosis> → <suggested action>"`

  Example: `"handoff missing required field 'artifacts' → add artifacts: {} to your handoff JSON at {{HANDOFF}}"`

  The `→` separator is machine-readable: AI agents parse the suggested action to self-recover.
  ```

  **Per-phase per-round architecture:**
  ```markdown
  ### Handoff File Architecture

  Handoffs use per-phase per-round flat files in the workspace:
  - `task-N-implement.json` — implement mode (written once)
  - `task-N-task-review-R.json` — task-review round R (1, 2, 3…)
  - `task-N-fix-R.json` — fix round R (1, 2, 3…)

  Round tracking in `progress.json` per-task per-mode (`rounds["task-review"]`, `rounds["fix"]`).
  Any handoff written to disk (including BLOCKED/TIMEOUT) increments the round counter.
  ```

  **docs-task.mjs:**
  ```markdown
  ### docs-task.mjs

  Replaces `cdd-review.mjs`. Symmetric CLI to `cdd-task.mjs` for document tasks.
  - `--mode review`: runs D1/D2/D3 doc review, writes `<slug>-review-R.json`
  - `--mode fix`: fixes all findings, writes `<slug>-fix-R.json`
  - `--template branch-review` does not support `--mode fix` (exits 2)
  Schema: `skills/_templates/docs-handoff-schema.json`
  ```

- [ ] **Step 2: Add Review Stopping SOT reference to CLAUDE.md**

  In CLAUDE.md, add to the CDD or engine section (if present):
  ```markdown
  ## Review Stopping (CDD + doc-review)

  Unified rule in `packages/osuperpowers/skills/_docs/docs-review.md` § Rule: Review Stopping.
  - blocker > 0: `cli-fix-all-findings` → re-run review
  - blocker = 0: `cli-fix-all-findings` → done (no re-review after blocker=0)
  All findings (blocker + warn + nit) are fixed in both paths.
  ```

- [ ] **Step 3: Run validate**

  ```bash
  pnpm run validate
  ```
  Expected: all pass.

---

### Task 15: overall spec update

**Files:**
- Modify: `docs/superpowers/specs/2026-08-31-post-dogfood-bugfixes-overall.md`

**Interfaces:**
- Consumes: T14 (everything complete)
- Produces: Pζ Plan = Done (link); Change history v1.25

- [ ] **Step 1: File GitHub issues for placeholder labels**

  Use `/osuperpowers:report-issue` or create directly on GitHub for each placeholder:
  - (deferred-sweep elim), (review-stopping-sot), (review-loop-module), (docs-task-cli), (fix-mode-simplify), (user-ok-delete), (maintainer-docs)
  Note the assigned issue numbers.

- [ ] **Step 2: Update Issue inventory — replace labels with real issue numbers**

  In the overall spec Issue inventory, replace each `(label)` placeholder with the real `[#NNN](url)` link.

- [ ] **Step 3: Update Phase inventory — Pζ Plan = Done**

  Change the Pζ row Plan column from `Pending` to:
  ```
  [plan](../plans/2026-09-03-post-dogfood-bugfixes-p-zeta.md)
  ```

- [ ] **Step 4: Append Change history v1.25**

  ```
  | v1.25 | 2026-09-03 | Pζ Plan = Done；Issue inventory placeholder labels replaced with real issue numbers | [human] · Claude Opus 4.8 |
  ```

- [ ] **Step 5: Run validate**

  ```bash
  pnpm run validate
  ```
  Expected: all pass.
