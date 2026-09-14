# Post-Dogfood Bugfixes Pζ — Design Spec

- **Version**: v1.1 · 2026-09-03
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)
- **Parent program**: [overall](./2026-08-31-post-dogfood-bugfixes-overall.md) v1.23
- **Depends on**: Pε (Done — PR #223)

---

## Section 0: Pζ increment only

Cross-phase conventions in [overall](./2026-08-31-post-dogfood-bugfixes-overall.md); overall wins on conflict. This phase is a **full rewrite** of the CDD handoff + review loop architecture. Breaking changes approved.

---

## Section 1: Constraints

- Does not repeat overall conventions. Overall wins on conflict.
- Breaking changes explicitly approved: `CDD_HANDOFF_PATH` semantics change, `cdd-review.mjs` replaced, `fix.md` template simplification, `user-ok?` node deleted, deferred-sweep eliminated.
- `pnpm run emit` required after every SKILL.md / docs/*.md edit.
- No commit unless user explicitly asks.
- Changeset required before final commit.

---

## Section 2: Design

### 2.1 Root Cause Chain

```
単文件架構 (task-N-handoff.json)
  ├── 各 mode 相互覆蓋 → 無審計鏈 (#222)
  ├── phase mismatch 检测 → Pε 用 fallback APPROVED 掩盖 (#220)
  └── BLOCKED/TIMEOUT handoff 自身缺 artifacts → step 8.8 触发新 BLOCKED loop (隐藏债务)

Templates 手写 required fields
  └── 与 handoff-schema.json 重复维护 (#221)

deferred-sweep-loop
  ├── fix-mode 双通道 scope (blocker-only / deferred-sweep)
  ├── CDD_FINDINGS_SCOPE / open-findings.json 复杂度
  └── Review Stopping 语义不统一 (CDD vs brainstorming vs writing-plans)

缺 unit/integration test 覆盖 (#219)
```

### 2.2 Decision Log (from grilling)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Per-phase per-round flat files | 完整审计链；round 编号区分多轮 review |
| D2 | `{{HANDOFF_STUB}}` from schema SOT | templates 零维护；schema 变更自动更新 |
| D3 | step 10.5 → BLOCKED (not fallback APPROVED) | 未写 handoff 的 task-review 不可静默 APPROVED |
| D4 | Unit + integration smoke (#219) | 纯单测无法发现子进程级 bug |
| D5 | Cross-phase reads: runner internal derivation | YAGNI；无新 env var |
| D6 | Review loop: code + concept full alignment | 全面重构不留技术债务 |
| D7 | Review Stopping unified rule (digraph SOT) | 三场景统一；消除不一致 |
| D8 | cli-fix-all-findings (keep fix-mode CLI) | schema 校验兜底；handoff 审计链完整 |
| D9 | fix-mode simplified (remove scope/deferred) | 原复杂度来源消除 |
| D10 | docs-task.mjs + docs-handoff-schema.json | 对称 cdd-task.mjs；各域 schema 清晰 |
| D11 | Two schemas (cdd + docs) | task integer 对 docs 无意义；字段语义差异大 |
| D12 | BLOCKED message: `<diagnosis> → <action>` | AI 可直接按建议恢复，无需推断 |

### 2.3 Per-phase Per-round 文件架构 (#222)

**文件命名：**
```
task-N-implement.json
task-N-task-review-1.json  →  task-N-fix-1.json
task-N-task-review-2.json  →  task-N-fix-2.json
...
```

**Round tracking** in `progress.json` per-task per-mode:
```json
{
  "tasks": [
    { "task": 1, "rounds": { "task-review": 2, "fix": 1 } }
  ]
}
```
`rounds[mode]` holds the round number of the most recently **completed** write (i.e. the last handoff successfully written). Any handoff written to disk — including BLOCKED or TIMEOUT status — increments `rounds[mode]`; only dry-run (no disk write) does not. `buildTaskEnv` increments by 1 to derive the path for the round currently being dispatched: `round = (rounds[mode] ?? 0) + 1`. After the handoff file is written, runner increments `rounds[mode]` in progress.json.

**`buildTaskEnv` handoff path derivation:**
```js
const handoffFile = mode === "implement"
  ? `task-${task}-implement.json`
  : `task-${task}-${mode}-${round}.json`;
env.CDD_HANDOFF_PATH = path.join(workspace, handoffFile);
```

**Cross-phase FIXED_POINT (internal derivation, no new env var):**

| mode | round | reads from |
|------|-------|-----------|
| task-review | 1 | `task-N-implement.json` commits.base |
| task-review | R>1 | `task-N-fix-(R-1).json` commits.base |
| fix | R | `task-N-task-review-R.json` commits.base |

**step 10.5 변경:**
- Remove phase-mismatch detection entirely
- New rule: `CDD_HANDOFF_PATH` not written + cli exit 0 → BLOCKED with message:
  `"task-N-{mode}-R.json not written after exit 0 → re-run {mode} and ensure handoff is written to {{HANDOFF}} before exit"`

**`handoffStatus` / `isTaskPending`:** A task is **pending** if: `rounds["task-review"]` is undefined (no task-review round ever completed) **or** the handoff at `task-N-task-review-R.json` (where R = `rounds["task-review"]`) has `status !== "APPROVED"`. Concretely: `isTaskPending(n) = rounds["task-review"] === undefined || handoffStatus(latestTaskReviewPath(n)) !== "APPROVED"`.

### 2.4 BLOCKED Message Format (隐藏债务 + all BLOCKED paths)

All `writeHandoff(BLOCKED/TIMEOUT)` calls must:
1. Include `artifacts: {}` (prevents step 8.8 re-validation loop)
2. Format `blocker` field as `"<diagnosis> → <suggested action>"`

Examples:
```
"{{HANDOFF}} not written after exit 0 → re-run {{MODE}} and ensure handoff is written to {{HANDOFF}} before exit"
"cli exited 1 without writing handoff → check stderr above for errors, fix, then re-dispatch task {{TASK}}"
"cli timed out after Nms → simplify task {{TASK}} scope or increase timeout, then re-dispatch"
"commits.base '...' is not a valid SHA → use git rev-parse HEAD to get the current commit SHA"
"handoff missing required field 'artifacts' → add artifacts: {} to your handoff JSON at {{HANDOFF}}"
```

Canonical notation: double-brace `{{VAR}}` throughout (matches template placeholder convention). Values are substituted at the runner write site.

### 2.5 HANDOFF_STUB Injection (#221)

**`renderHandoffStub(schema, mode, taskNum, { docPath })` in `lib/templates.mjs`:**
```js
export function renderHandoffStub(schema, mode, taskNum, { docPath } = {}) {
  const stub = {};
  for (const field of schema.required) {
    switch (field) {
      case "task":     stub.task = taskNum;              break;
      case "phase":    stub.phase = mode;                break;
      case "status":   stub.status = "APPROVED";         break;
      case "findings": stub.findings = [];               break;
      case "artifacts":stub.artifacts = {};              break;
      case "doc_path": stub.doc_path = docPath ?? "";   break;
    }
  }
  return "```json\n" + JSON.stringify(stub, null, 2) + "\n```";
}
```

`renderModePrompt` (cdd-task) passes `taskNum` integer; `renderDocsPrompt` (docs-runner.mjs) passes `{ docPath }` as the resolved `--doc` argument value. `doc_path` in the stub is always the real path, never a `{{DOC}}` literal placeholder.
All three CDD mode templates (implement / task-review / fix) replace hand-written required fields with `{{HANDOFF_STUB}}`. Existing docs review templates (`spec-review.md`, `plan-review.md`) also updated in T8 to use `{{HANDOFF_STUB}}` via `renderDocsPrompt`; new fix templates (`spec-fix.md`, `plan-fix.md`) likewise use `{{HANDOFF_STUB}}` from creation.

### 2.6 fix-mode Simplification (#NEW-E)

**Deleted:**
- `CDD_FINDINGS_SCOPE` env var (blocker-only / deferred-sweep enum)
- runner step 8.9 (open-findings.json pre-generation)
- `deferred: true` finding marker
- `blocker-only` / `deferred-sweep` scope enum

**Kept (scope logic removed):**
- `CDD_FINDINGS` env var — retained as path to current-round task-review handoff findings; runner derives value as `task-N-task-review-R.json`; scope filter logic deleted (agent receives full findings array)

**fix.md simplified structure:**
```markdown
# CDD fix — CLI session
Workspace: {{WORKSPACE}}  Task brief: {{BRIEF}}
Handoff path: {{HANDOFF}}  Findings: {{FINDINGS}}
Plan constraints: {{CONSTRAINTS}}

Fix ALL findings (blocker + warn + nit) listed in {{FINDINGS}}.

## Handoff Output
{{HANDOFF_STUB}}
```

`{{FINDINGS}}` = path to current-round `task-N-task-review-R.json` (runner-derived, no scope filter).

### 2.7 Review Stopping — Unified Digraph (SOT: `_docs/docs-review.md`)

```
[run-review] → {blocker=0?}
  yes → [cli-fix-all-findings] → (done)
  no  → [cli-fix-all-findings] → [run-review]  (re-run)
```

**Node definitions (written into `_docs/docs-review.md` § Rule: Review Stopping):**

**`run-review`**
- Do: Execute one full review pass. CDD → `cdd-task.mjs --mode task-review`; doc-review → `docs-task.mjs --mode review` (D1/D2/D3). Count blockers from findings.
- Exit: blocker=0 → `cli-fix-all-findings` (done path); blocker>0 → `cli-fix-all-findings` (re-run path)
- Invariant: must not re-run after blocker=0 output (Review Stopping violation)

**`cli-fix-all-findings`**
- Do: Pass all findings (blocker + warn + nit) as context. CDD → `cdd-task.mjs --mode fix` (writes `task-N-fix-R.json`); doc-review → `docs-task.mjs --mode fix` (writes `<slug>-fix-R.json`). Schema validation via runner.mjs / docs-runner.mjs.
- Exit: Returns to `run-review` if entered via the blocker>0 path; terminates (done) if entered via the blocker=0 path. Routing is path-inherited from the pre-fix blocker count, not decided by this node.

Review Stopping SOT path: `packages/osuperpowers/skills/cli-driven-development/_docs/docs-review.md` (same file currently referenced by CDD SKILL.md for D1/D2/D3 definitions). New section `### Rule: Review Stopping` added to this file. brainstorming and writing-plans SKILL.md reference the same path via `{pluginRoot}/skills/cli-driven-development/_docs/docs-review.md`.

**废除的旧规则:**
- D1 zero findings → skip D2/D3 shortcut (eliminated)
- blocker=0 → user-ok? gate (eliminated; fix agent handles all findings)
- blocker>0 → fix blockers only (eliminated; always fix all)
- deferred-sweep channel (eliminated)

### 2.8 review-loop.mjs Shared Module (#NEW-C)

```js
// bin/engine/review-loop.mjs
export async function runReviewLoop({
  runReview,    // (round: number) => Promise<handoff>
  runFix,       // (round: number, findings: array) => Promise<handoff>
  getBlockers,  // (handoff) => finding[]
  onRoundDone,  // optional: (round, findings) => void
}) {
  let round = 1;
  while (true) {
    const reviewHandoff = await runReview(round);
    const blockers = getBlockers(reviewHandoff);
    await runFix(round, reviewHandoff.findings); // always fix all
    if (blockers.length === 0) { onRoundDone?.(round, reviewHandoff.findings); break; }
    round++;
  }
}
```

CDD wires: `runReview = cdd-task --mode task-review`, `runFix = cdd-task --mode fix`
Docs wires: `runReview = docs-task --mode review`, `runFix = docs-task --mode fix`

Note: for CDD wiring, the `round` argument passed to `runReview(round)` / `runFix(round)` may be passed through to runner.mjs or discarded — runner.mjs always derives the actual round from progress.json independently and ignores any conflicting value without error. For docs wiring, `round` is the sole source of round truth (docs-runner.mjs has no progress.json).

### 2.9 docs-task.mjs (#NEW-D)

Replaces `cdd-review.mjs`. Symmetric CLI to `cdd-task.mjs`.

**Modes:**
- `--mode review`: spawns doc review agent (D1/D2/D3 passes); writes `<slug>-review-R.json`
- `--mode fix`: spawns doc fix agent (edits spec/plan); writes `<slug>-fix-R.json`

**docs-handoff-schema.json:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "required": ["phase", "status", "findings", "artifacts", "doc_path"],
  "properties": {
    "phase": { "enum": ["review", "fix"] },
    "status": { "enum": ["APPROVED", "CHANGES_REQUESTED", "BLOCKED"] },
    "doc_path": { "type": "string" },
    "findings": { "type": "array" },
    "artifacts": { "type": "object" },
    "round": { "type": "integer" }
  },
  "additionalProperties": false
}
```

**docs-runner.mjs**: lightweight runner for docs-task.mjs orchestration.
- **Responsibilities**: spawn doc agent CLI; validate handoff via `validateHandoffSchema(handoff, docsSchemaPath)`; write BLOCKED handoff on failure; return parsed result `{ exitCode, handoff }` to docs-task.mjs (no stdout H1 parsing — docs-runner is a JS module, not a subprocess)
- **Public API**: `runDocsTask(mode, opts) → Promise<{ exitCode, handoff }>` — `opts` includes `{ harness, template, docPath, findingsPath, handoffPath, round, dryRun }`
- **Intentionally omits**: commit-contract (docs don't commit code), ledger/progress tracking, probeSkills, CDD_TASK_REVIEW_FIXED_POINT derivation
- **How docs-task.mjs calls it**: `const result = await runDocsTask(mode, { harness, template, docPath, findingsPath, handoffPath, round })`; after agent exit, docs-runner.mjs reads and parses the handoff JSON from `handoffPath` on disk, then validates it against `docs-handoff-schema.json`

**Template system:** `docs-task.mjs --mode review` uses the same `renderTemplate(name, params)` function from `lib/templates.mjs`. Templates live in `packages/osuperpowers/skills/_templates/` (same directory as `spec-review.md`, `plan-review.md`). `--template <name>` resolves to `_templates/<name>.md`. Available templates: `spec-review`, `plan-review`, `branch-review`. No new template directory introduced.

`--mode fix` uses a new `<name>-fix.md` template alongside the review template. docs-task.mjs derives the fix template name automatically: when `--mode fix` is passed alongside `--template <name>`, docs-task.mjs resolves to `_templates/<name>-fix.md` (e.g. `spec-review` → `spec-fix.md`, `plan-review` → `plan-fix.md`). Callers always pass `--template spec-review` (the review template name); docs-task.mjs handles the `-fix` suffix derivation internally. `branch-review` does **not** support `--mode fix`; docs-task.mjs exits 2 with usage error if `--template branch-review --mode fix` is attempted. New templates added to `skills/_templates/`: `spec-fix.md`, `plan-fix.md`.

**SKILL.md CLI invocation (after):**
```
# review
node {pluginRoot}/bin/engine/docs-task.mjs --harness claude --mode review --template spec-review --doc <path>
# fix
node {pluginRoot}/bin/engine/docs-task.mjs --harness claude --mode fix --template spec-review --doc <path> --findings <findings-path>
```

### 2.10 brainstorming + writing-plans SKILL.md Alignment (#NEW-B #NEW-F)

**brainstorming SKILL.md:**
- `spec-review?` Do: CLI call → `docs-task.mjs --mode review`; Review Stopping → reference `_docs/docs-review.md` Rule: Review Stopping
- `user-ok?` node: **deleted** (warn/nit handled by cli-fix-all-findings; no user gate)
- I5 (Review Stopping invariant): reworded to reference docs-review.md SOT; no inline rule duplication
- Digraph: remove `pass1 clean → user-ok?` edge; remove `user-ok?` → `user-confirm-commit?` edge; `spec-review?` blocker=0 → directly `user-confirm-commit?` after fix

**writing-plans SKILL.md:**
- plan-review CLI: `docs-task.mjs --mode review`
- Review Stopping: reference docs-review.md SOT

### 2.11 New Issues to Register

| Label | Title |
|-------|-------|
| #NEW-A | deferred-sweep-loop 消除 |
| #NEW-B | Review Stopping 语义统一 (unified digraph SOT) |
| #NEW-C | review-loop.mjs 共享模块提取 |
| #NEW-D | cdd-review.mjs → docs-task.mjs 重构 |
| #NEW-E | fix-mode 简化 (delete scope/sweep) |
| #NEW-F | user-ok? 节点删除 (brainstorming) |
| #NEW-G | CLAUDE.md + maintainer docs 更新 |

### 2.12 Task Decomposition

| # | Task | Issues | Depends |
|---|------|--------|---------|
| T1 | BLOCKED artifacts + message format | hidden debt | — |
| T2 | progress.mjs round tracking + buildTaskEnv per-round paths | #222 | T1 |
| T3 | Cross-phase reads internal derivation | #222 | T2 |
| T4 | step 10.5 → BLOCKED; handoffStatus/isTaskPending update | #220 #222 | T3 |
| T5 | renderHandoffStub + {{HANDOFF_STUB}} in 3 mode templates | #221 | T1 |
| T6 | fix-mode simplification (delete scope/sweep/step 8.9) | #NEW-E | T5 |
| T7 | docs-handoff-schema.json + docs-runner.mjs | #NEW-D | T1 |
| T8 | docs-task.mjs (review + fix modes; replaces cdd-review.mjs) | #NEW-D | T5 T7 |
| T9 | review-loop.mjs shared module | #NEW-C | T4 T8 |
| T10 | _docs/docs-review.md: Rule: Review Stopping SOT | #NEW-B | — |
| T11 | brainstorming SKILL.md: docs-task CLI + delete user-ok? + I5 SOT | #NEW-B #NEW-F | T8 T10 |
| T12 | writing-plans SKILL.md: docs-task CLI + Review Stopping SOT | #NEW-B | T8 T10 |
| T13 | #219 全覆盖测试 (unit + integration smoke) | #219 | T9 |

**T13 test targets (minimum one test per new module):**
- `runner.test.mjs`: step 8.8 schema loop prevention (BLOCKED artifacts valid); step 10.5 BLOCKED on missing handoff; all BLOCKED writeHandoff calls produce schema-valid output
- `task.test.mjs` (integration): dry-run per-round path derivation (`task-1-task-review-2.json`); missing handoff + exit 0 → BLOCKED with action message
- `templates.test.mjs`: `renderHandoffStub` returns valid JSON for each mode; `{{HANDOFF_STUB}}` replaced in all 3 mode templates; no residual hand-written required fields
- `review-loop.test.mjs` (new): blocker>0 loops (calls runFix then runReview again); blocker=0 exits after single fix; round counter increments correctly
- `docs-task.test.mjs` (new): `--mode review` exit 0 with valid docs-handoff; `--mode fix` exit 0 with valid docs-handoff; BLOCKED on invalid schema
- `docs-runner.test.mjs` (new): `runDocsTask` validates docs-handoff against docs-handoff-schema.json; BLOCKED message format `<diagnosis> → <action>`
| T14 | CLAUDE.md + docs/maintainers/ update | #NEW-G | T13 |
| T15 | overall spec update (register issues, four tables) | — | T14 |

### Acceptance Criteria

- `pnpm run validate` passes (all 12 CI blocks green)
- `task-N-implement.json` / `task-N-task-review-R.json` / `task-N-fix-R.json` written correctly in dry-run
- All BLOCKED handoffs include `artifacts: {}` and `<diagnosis> → <action>` message
- `{{HANDOFF_STUB}}` renders correct JSON from schema in all three mode templates
- `docs-task.mjs --mode review/fix` exits 0 with valid docs-handoff
- `review-loop.mjs` test: blocker>0 loops; blocker=0 exits after fix
- brainstorming `spec-review?` invokes `docs-task.mjs`; no `user-ok?` node in digraph
- `_docs/docs-review.md` contains `### Rule: Review Stopping` with unified digraph
- `cdd-review.mjs` deleted; no stale references remain
- All governance tests pass (line budgets, semantic anchors)

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| Pζ scope: #219/#220/#221/#222 | Expanded: +#NEW-A through #NEW-G (全面重构) | Yes — v1.24 · 2026-09-03 (T15) |
| fix-mode 三模式链保留 | fix-mode simplified (scope/deferred deleted) | Yes — v1.24 (T15) |
| cdd-review.mjs 现有 CLI | Replaced by docs-task.mjs | Yes — v1.24 (T15) |

---

## Section 4: Notes for downstream

- Any phase after Pζ that references `cdd-review.mjs` must update to `docs-task.mjs`
- `CDD_FINDINGS_SCOPE` / `deferred: true` / deferred-sweep-loop — all removed; downstream code must not reference
- `task-N-handoff.json` single-file pattern replaced; downstream must read per-phase-per-round paths
- `user-ok?` node removed from brainstorming flow; any fork of brainstorming SKILL.md must update

---

## Section 5: Review

Spec review pending (3-pass via `docs-task.mjs --mode review` after T8; currently use `cdd-review.mjs` for this spec review since docs-task.mjs does not yet exist).
