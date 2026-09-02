# Pδ Implementation Plan — CDD Engine 重构

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor CDD engine into a thin CLI dispatcher with all business logic in the orchestrator layer, resolve head mismatch (#210), enforce three-mode chain (#207), and restructure templates.

**Architecture:** Three-layer separation — engine (runner.mjs ~150 lines: CLI dispatch + timeout + schema validation + open-findings pre-gen), orchestrator (SKILL.md digraph: commit-contract + deferred-sweep closure + brief gen + review diff gen), CLI agent (templates: implement/fix/task-review). Handoff schema drops commits.head. Templates migrate to `_templates/` (shared) + `cli-driven-development/templates/` (CDD-only). Progress structured into JSON + derived markdown.

**Tech Stack:** Node.js (ESM), JSON Schema, Mermaid digraphs, Markdown

## Global Constraints

- vendored 子模块不可改
- 仓库语言政策：SKILL.md / docs 英文主源 + zh-CN 镜像
- `.agents/` is derived — never edit directly; run `pnpm run emit` after any source change
- 三模式链不简化，所有任务强制执行 implement → task-review → fix
- 允许破坏性更新，确保最佳实践

---

### Task 1: Handoff schema + CLI wrappers (contract.mjs + brief.mjs)

**Files:**
- Create: `packages/osuperpowers/skills/_templates/handoff-schema.json`
- Create: `packages/osuperpowers/bin/engine/lib/schema-utils.mjs` (shared validation)
- Modify: `packages/osuperpowers/bin/engine/lib/contract.mjs` (add CLI entry)
- Modify: `packages/osuperpowers/bin/engine/lib/brief.mjs` (add CLI entry)

**Interfaces:**
- Consumes: handoff-schema.json spec from Pδ design spec §Handoff Schema 重构
- Produces: handoff-schema.json (JSON Schema), contract.mjs CLI (--check-head, --check-dirty, --clear-findings), brief.mjs CLI (--task N --plan <path> --output <path>)

- [ ] **Step 1: Create handoff-schema.json**

Create `packages/osuperpowers/skills/_templates/handoff-schema.json` with the schema from Pδ design spec:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["task", "phase", "status", "artifacts", "findings"],
  "properties": {
    "task": { "type": "integer", "minimum": 1 },
    "phase": { "type": "string", "enum": ["implement", "task-review", "fix"] },
    "status": { "type": "string", "enum": ["APPROVED", "BLOCKED", "CHANGES_REQUESTED", "TIMEOUT"] },
    "commits": {
      "type": "object",
      "required": ["base"],
      "properties": {
        "base": { "type": "string", "pattern": "^[0-9a-f]{40}$" }
      }
    },
    "complexity": { "type": "string", "enum": ["simple", "moderate", "complex"] },
    "review_scope": { "type": "string", "enum": ["task", "branch"] },
    "artifacts": { "type": "object" },
    "findings": { "type": "array" },
    "unverifiable": { "type": "array" },
    "plan_conflicts": { "type": "array" },
    "blocker": { "type": "string" }
  },
  "additionalProperties": false
}
```

- [ ] **Step 2: Create shared schema-utils.mjs**

Create `packages/osuperpowers/bin/engine/lib/schema-utils.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..');

export function loadHandoffSchema() {
  const schemaPath = path.join(PKG_ROOT, 'skills', '_templates', 'handoff-schema.json');
  return JSON.parse(readFileSync(schemaPath, 'utf8'));
}

export function validateHandoffSchema(handoff) {
  const schema = loadHandoffSchema();
  for (const field of schema.required) {
    if (!(field in handoff)) return { valid: false, reason: `missing required field: ${field}` };
  }
  // Reject unknown top-level properties (additionalProperties: false)
  const knownProps = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(handoff)) {
    if (!knownProps.has(key)) return { valid: false, reason: `unknown property: ${key}` };
  }
  // Type checks
  if (handoff.task !== undefined && typeof handoff.task !== 'number')
    return { valid: false, reason: `task must be integer` };
  if (handoff.phase && !schema.properties.phase.enum.includes(handoff.phase))
    return { valid: false, reason: `invalid phase: ${handoff.phase}` };
  if (handoff.status && !schema.properties.status.enum.includes(handoff.status))
    return { valid: false, reason: `invalid status: ${handoff.status}` };
  if (handoff.commits && handoff.commits.base && !/^[0-9a-f]{40}$/.test(handoff.commits.base))
    return { valid: false, reason: `commits.base must be 40-char hex SHA` };
  if (handoff.findings !== undefined && !Array.isArray(handoff.findings))
    return { valid: false, reason: `findings must be array` };
  if (handoff.artifacts !== undefined && typeof handoff.artifacts !== 'object')
    return { valid: false, reason: `artifacts must be object` };
  return { valid: true };
}
```

- [ ] **Step 3: Add contract.mjs CLI entry**

Add CLI entry point at the bottom of `packages/osuperpowers/bin/engine/lib/contract.mjs`:

```javascript
// --- CLI entry point (orchestrator calls via node contract.mjs --check-head ...) ---
if (process.argv[1] && process.argv[1].endsWith('contract.mjs') && process.argv.length > 2) {
  const args = process.argv.slice(2);
  const flag = args[0];
  const handoffIdx = args.indexOf('--handoff');
  const progressIdx = args.indexOf('--progress');
  const handoffPath = handoffIdx >= 0 ? args[handoffIdx + 1] : null;
  const progressPath = progressIdx >= 0 ? args[progressIdx + 1] : null;

  if (flag === '--check-head') {
    const progress = JSON.parse(readFileSync(progressPath, 'utf8'));
    const lastDispatchHead = progress.lastDispatchHead;
    const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const handoff = JSON.parse(readFileSync(handoffPath, 'utf8'));
    const { validateHandoffSchema } = await import('./schema-utils.mjs');
    const sv = validateHandoffSchema(handoff);
    if (!sv.valid) {
      process.stdout.write(JSON.stringify({ valid: false, reason: sv.reason }));
      process.exit(1);
    }
    if (lastDispatchHead && lastDispatchHead !== actualHead) {
      process.stdout.write(JSON.stringify({ valid: false, reason: `head mismatch: dispatch=${lastDispatchHead} actual=${actualHead}` }));
      process.exit(1);
    }
    process.stdout.write(JSON.stringify({ valid: true }));
    process.exit(0);
  }

  if (flag === '--check-dirty') {
    const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
    if (status) {
      const files = status.split('\n').map(l => l.substring(3));
      process.stdout.write(JSON.stringify({ dirty: true, files }));
      process.exit(1);
    }
    process.stdout.write(JSON.stringify({ dirty: false }));
    process.exit(0);
  }

  if (flag === '--clear-findings') {
    const handoff = JSON.parse(readFileSync(handoffPath, 'utf8'));
    handoff.findings = [];
    writeFileSync(handoffPath, JSON.stringify(handoff, null, 2));
    process.stdout.write(JSON.stringify({ cleared: true }));
    process.exit(0);
  }
}
```

**Note**: `validateHandoffSchema` is extracted to a shared module `lib/schema-utils.mjs` (also used by runner.mjs Task 4 Step 6). This avoids duplication between contract.mjs CLI and runner.mjs.

**Note on imports**: Use `import { execFileSync } from 'node:child_process'` to match existing contract.mjs codebase style. Use existing `gitCatFileCommitExists` / `gitToplevel` exports from contract.mjs where available.

- [ ] **Step 4: Add brief.mjs CLI entry**

Add CLI entry point at the bottom of `packages/osuperpowers/bin/engine/lib/brief.mjs`:

```javascript
// --- CLI entry point (orchestrator calls via node brief.mjs --task N --plan <path> --output <path>) ---
if (process.argv[1] && process.argv[1].endsWith('brief.mjs') && process.argv.length > 2) {
  const args = process.argv.slice(2);
  const taskIdx = args.indexOf('--task');
  const planIdx = args.indexOf('--plan');
  const outputIdx = args.indexOf('--output');
  const taskNum = parseInt(args[taskIdx + 1]);
  const planPath = args[planIdx + 1];
  const outputPath = args[outputIdx + 1];

  try {
    const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    generateBrief(planPath, taskNum, outputPath, repoRoot);
    process.stdout.write(JSON.stringify({ brief: outputPath }));
    process.exit(0);
  } catch (e) {
    process.stderr.write(e.message);
    process.exit(1);
  }
}
```

- [ ] **Step 5: Run existing contract + brief tests to verify no regression**

Run: `node packages/osuperpowers/bin/engine/tests/contract.test.mjs && node packages/osuperpowers/bin/engine/tests/brief.test.mjs`
Expected: all pass

- [ ] **Step 6: Add CLI entry tests**

Add tests for the new CLI entry points in existing test files:
- contract.test.mjs: test `--check-head` (valid/invalid head), `--check-dirty` (clean/dirty), `--clear-findings`
- brief.test.mjs: test `--task N --plan <path> --output <path>`

- [ ] **Step 7: Commit**

```bash
git add packages/osuperpowers/skills/_templates/handoff-schema.json packages/osuperpowers/bin/engine/lib/schema-utils.mjs packages/osuperpowers/bin/engine/lib/contract.mjs packages/osuperpowers/bin/engine/lib/brief.mjs packages/osuperpowers/bin/engine/tests/contract.test.mjs packages/osuperpowers/bin/engine/tests/brief.test.mjs
git commit -m "feat(engine): add handoff-schema.json + schema-utils + contract.mjs/brief.mjs CLI wrappers (#210 #211)"
```

---

### Task 2: Progress file structuring (progress.json)

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs` (migrate readTimeoutCount/writeTimeoutCount to progress.json)
- Create: `packages/osuperpowers/bin/engine/lib/progress.mjs` (progress.json read/write/migrate)

**Interfaces:**
- Consumes: handoff-schema.json from Task 1
- Produces: progress.mjs (readProgressJSON, writeProgressJSON, migrateFromProgressMD), runner.mjs uses progress.json for timeoutCount

- [ ] **Step 1: Create progress.mjs module**

Create `packages/osuperpowers/bin/engine/lib/progress.mjs`:

```javascript
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PROGRESS_SCHEMA = {
  required: ['plan', 'timeoutCount', 'engineRecoveryCount', 'lastDispatchHead', 'tasks', 'degradationLog'],
  tasksItem: { required: ['task', 'status'], statusEnum: ['pending', 'complete'] },
  degradationLogItem: { required: ['task', 'mode', 'severity', 'summary', 'reason', 'timestamp'],
    scopeEnum: ['deferred-sweep', 'blocker-only'],
    severityEnum: ['head-mismatch', 'engine-error', 'timeout', 'dirty-tree'] }
};

export function readProgressJSON(progressDir) {
  const jsonPath = path.join(progressDir, 'progress.json');
  if (!existsSync(jsonPath)) return null;
  return JSON.parse(readFileSync(jsonPath, 'utf8'));
}

export function writeProgressJSON(progressDir, data) {
  const jsonPath = path.join(progressDir, 'progress.json');
  writeFileSync(jsonPath, JSON.stringify(data, null, 2));
}

export function createEmptyProgress(plan) {
  return { plan: plan || '', timeoutCount: 0, engineRecoveryCount: 0, lastDispatchHead: '', tasks: [], degradationLog: [] };
}

export function migrateFromProgressMD(progressDir) {
  const mdPath = path.join(progressDir, 'progress.md');
  if (!existsSync(mdPath)) return null;
  const content = readFileSync(mdPath, 'utf8');
  const timeoutMatch = content.match(/##\s*timeoutCount:\s*(\d+)/);
  const timeoutCount = timeoutMatch ? parseInt(timeoutMatch[1]) : 0;
  const recoveryMatch = content.match(/##\s*engine-recovery-count:\s*(\d+)/);
  const engineRecoveryCount = recoveryMatch ? parseInt(recoveryMatch[1]) : 0;
  const tasks = [];
  const taskLines = content.match(/Task (\d+): complete/g) || [];
  for (const line of taskLines) {
    const num = parseInt(line.match(/Task (\d+)/)[1]);
    tasks.push({ task: num, status: 'complete' }); // completedAt omitted for pre-migration tasks
  }
  const maxTask = tasks.length > 0 ? Math.max(...tasks.map(t => t.task)) : 0;
  for (let i = 1; i <= maxTask; i++) {
    if (!tasks.find(t => t.task === i)) tasks.push({ task: i, status: 'pending' });
  }
  return {
    plan: '', timeoutCount, engineRecoveryCount,
    lastDispatchHead: '', // empty — in-flight migration out of scope
    tasks: tasks.sort((a, b) => a.task - b.task),
    degradationLog: [] // existing prose degradation logs are not parsed (freeform format)
  };
}

export function deriveProgressMD(data) {
  const lines = [];
  if (data.plan) lines.push(`## Plan\n${data.plan}\n`);
  lines.push(`## Ledger`);
  for (const t of data.tasks) {
    if (t.status === 'complete') lines.push(`Task ${t.task}: complete`);
  }
  lines.push(`\n## engine-recovery-count: ${data.engineRecoveryCount}`);
  lines.push(`## timeoutCount: ${data.timeoutCount}`);
  return lines.join('\n') + '\n';
}
```

- [ ] **Step 2: Update runner.mjs to use progress.json**

In `runner.mjs`, make these changes:
1. Import `readProgressJSON`, `writeProgressJSON`, `migrateIfNeeded` from `./progress.mjs`
2. In `buildTaskEnv()`: change `CDD_LEDGER` default from `progress.md` to `progress.json`
3. Replace `readTimeoutCount` / `writeTimeoutCount` with progress.json equivalents:
   - Read: `readProgressJSON(progressDir)` → `data.timeoutCount`
   - Write: `data.timeoutCount++` → `writeProgressJSON(progressDir, data)`
4. In ledger append: update `tasks[].status` in progress.json instead of writing markdown lines
5. In dryRunH1Block: change `status: DONE` to `status: APPROVED` and remove `head=dry-run` from commits line
6. In handoff fallback writes: remove `commits.head` from fallback objects (keep `commits.base: 'unknown'` or remove `commits` entirely if not needed for fallback)

- [ ] **Step 3: Add migration logic**

In `progress.mjs`, add `migrateIfNeeded(progressDir)` function that:
1. Checks if `progress.json` exists — if yes, returns existing data
2. If not, checks if `progress.md` exists — if yes, calls `migrateFromProgressMD()` and writes result to `progress.json`
3. If neither exists, creates empty progress via `createEmptyProgress()`

Call `migrateIfNeeded()` in `readProgressJSON()` as the first operation (transparent migration on first read). This keeps runner.mjs thin — no migration logic in runner.mjs.

- [ ] **Step 4: Run existing runner tests to verify no regression**

Run: `node packages/osuperpowers/bin/engine/tests/runner.test.mjs` (or equivalent)
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/progress.mjs packages/osuperpowers/bin/engine/lib/runner.mjs
git commit -m "feat(engine): progress.json structuring + migration from progress.md (#211)"
```

---

### Task 3: Template directory restructuring + content update

**Files:**
- Move: `packages/osuperpowers/templates/cdd/spec-review.md` → `packages/osuperpowers/skills/_templates/spec-review.md`
- Move: `packages/osuperpowers/templates/cdd/plan-review.md` → `packages/osuperpowers/skills/_templates/plan-review.md`
- Move: `packages/osuperpowers/templates/cdd/branch-review.md` → `packages/osuperpowers/skills/_templates/branch-review.md`
- Move: `packages/osuperpowers/templates/cdd/implement.md` → `packages/osuperpowers/skills/cli-driven-development/templates/implement.md`
- Move: `packages/osuperpowers/templates/cdd/fix.md` → `packages/osuperpowers/skills/cli-driven-development/templates/fix.md`
- Move: `packages/osuperpowers/templates/cdd/task-review.md` → `packages/osuperpowers/skills/cli-driven-development/templates/task-review.md`
- Delete: `packages/osuperpowers/templates/cdd/_handoff-write-fragment.md`
- Delete: `packages/osuperpowers/templates/cdd/` (empty directory)
- Modify: `packages/osuperpowers/bin/engine/lib/templates.mjs` (path resolution refactor + renderTemplate migration)
- Modify: `packages/osuperpowers/bin/engine/cdd-review.mjs` (path update + DONE→APPROVED + import renderTemplate)
- Modify: `packages/osuperpowers/skills/cli-driven-development/templates/implement.md` (brief scope lock + inline Handoff Output)
- Modify: `packages/osuperpowers/skills/cli-driven-development/templates/task-review.md` (status DONE→APPROVED + inline Handoff Output)
- Modify: `packages/osuperpowers/skills/cli-driven-development/templates/fix.md` (inline Handoff Output)
- Modify: `packages/osuperpowers/skills/cli-driven-development/docs/` (update _handoff-write-fragment.md path references)

**Interfaces:**
- Consumes: existing template files
- Produces: new directory layout, updated templates with inline handoff output, updated templates.mjs

- [ ] **Step 1: Create new directories**

```bash
mkdir -p packages/osuperpowers/skills/_templates
mkdir -p packages/osuperpowers/skills/cli-driven-development/templates
```

- [ ] **Step 2: Move shared templates to _templates/**

```bash
mv packages/osuperpowers/templates/cdd/spec-review.md packages/osuperpowers/skills/_templates/spec-review.md
mv packages/osuperpowers/templates/cdd/plan-review.md packages/osuperpowers/skills/_templates/plan-review.md
mv packages/osuperpowers/templates/cdd/branch-review.md packages/osuperpowers/skills/_templates/branch-review.md
```

- [ ] **Step 3: Move CDD-only templates to cli-driven-development/templates/**

```bash
mv packages/osuperpowers/templates/cdd/implement.md packages/osuperpowers/skills/cli-driven-development/templates/implement.md
mv packages/osuperpowers/templates/cdd/fix.md packages/osuperpowers/skills/cli-driven-development/templates/fix.md
mv packages/osuperpowers/templates/cdd/task-review.md packages/osuperpowers/skills/cli-driven-development/templates/task-review.md
```

- [ ] **Step 4: Delete _handoff-write-fragment.md and empty directory**

```bash
rm packages/osuperpowers/templates/cdd/_handoff-write-fragment.md
rmdir packages/osuperpowers/templates/cdd
```

- [ ] **Step 5: Update template content — brief scope lock + inline Handoff Output**

**implement.md**: Add brief scope lock section + replace `_handoff-write-fragment.md` reference with inline `## Handoff Output` (status=APPROVED on success, status=BLOCKED on blocker; commits.base from TASK_BASE; no commits.head).

**task-review.md**: Change `status: DONE` to `status: APPROVED` + replace `_handoff-write-fragment.md` reference with inline `## Handoff Output` (parse findings from axis reports, merge into findings[], mark warn/nit as deferred, status=CHANGES_REQUESTED if blockers).

**fix.md**: Replace `_handoff-write-fragment.md` reference with inline `## Handoff Output` (resolve findings per outcome, preserve deferred, status=APPROVED if all resolved).

- [ ] **Step 6: Update docs references**

Grep `packages/osuperpowers/skills/cli-driven-development/docs/` for `_handoff-write-fragment.md` and `templates/cdd/` references. Update paths to reflect new `_templates/` and `cli-driven-development/templates/` layout.

- [ ] **Step 7: Refactor templates.mjs path resolution**

Replace `pluginRoot()` based path resolution in `packages/osuperpowers/bin/engine/lib/templates.mjs`:

1. **Migrate `renderTemplate()` from cdd-review.mjs**: Move the `renderTemplate(name, params, programName)` function from `cdd-review.mjs` into `templates.mjs` as an export. Update `cdd-review.mjs` to import `renderTemplate` from `templates.mjs` (remove local implementation).
2. **Refactor path resolution**:

```javascript
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// From bin/engine/lib/ → packages/osuperpowers/
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..');

export function renderModePrompt(mode, env, programName) {
  const templatePath = path.join(PKG_ROOT, 'skills', 'cli-driven-development', 'templates', `${mode}.md`);
  // ... read + substitute (remove _handoff-write-fragment.md concatenation)
}

export function renderTemplate(name, params, programName) {
  const templatePath = path.join(PKG_ROOT, 'skills', '_templates', `${name}.md`);
  // ... read + substitute (migrated from cdd-review.mjs)
}
```

3. Remove `_handoff-write-fragment.md` concatenation logic from `renderModePrompt`.
4. Update `cdd-review.mjs` to import `renderTemplate` from `./lib/templates.mjs` and remove local `renderTemplate` function + `TEMPLATE_DIR` constant.

- [ ] **Step 8: Update cdd-review.mjs path + DONE→APPROVED**

In `packages/osuperpowers/bin/engine/cdd-review.mjs`:
1. Replace `TEMPLATE_DIR` to use new `_templates/` path
2. Change `writeHandoff(handoffPath, { status: "DONE" })` to `{ status: "APPROVED" }`

- [ ] **Step 9: Run template tests**

Run: `node packages/osuperpowers/bin/engine/tests/templates.test.mjs`
Expected: all pass (update test expectations for new paths + remove fragment concatenation tests)

- [ ] **Step 10: Commit**

```bash
git add packages/osuperpowers/skills/_templates/ packages/osuperpowers/skills/cli-driven-development/templates/ packages/osuperpowers/bin/engine/lib/templates.mjs packages/osuperpowers/bin/engine/cdd-review.mjs packages/osuperpowers/bin/engine/tests/templates.test.mjs
git rm packages/osuperpowers/templates/cdd/ 2>/dev/null || true
git commit -m "refactor(templates): restructure to _templates/ + cli-driven-development/templates/, remove handoff fragment (#211)"
```

---

### Task 4: Runner.mjs thinning

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs` (remove 5 responsibilities, add schema validation + open-findings pre-gen)

**Interfaces:**
- Consumes: handoff-schema.json from Task 1, progress.json from Task 2, templates.mjs from Task 3
- Produces: thinned runner.mjs (~150 lines) with pure CLI dispatch

- [ ] **Step 1: Remove commit-contract validation**

Remove the `validateCommitContract()` call block from `runTask()`. Search for the `validateCommitContract` function call (not by step number — step numbers shift as code is modified) and remove the entire conditional block that calls it and rewrites handoff to BLOCKED.

- [ ] **Step 2: Remove deferred-sweep closure**

Search for the `agentRc === 0` conditional block that clears `findings[]` and sets `status: APPROVED` in the deferred-sweep path. Remove this block entirely. This logic moves to the orchestrator (Task 5 Step 2).

- [ ] **Step 3: Remove brief generation**

Search for the `generateBrief()` call and brief validation logic (`validateBrief`) in `runTask()`. Remove both. Brief is now generated by orchestrator before dispatch (Task 5 Step 3).

- [ ] **Step 4: Remove review-package diff generation**

Search for `review-package` script invocation and diff parsing logic in `runTask()`. Remove this block. Review-package diff generation for task-review moves to orchestrator (Task 5 Step 3) — runner.mjs no longer pre-generates diffs.

- [ ] **Step 5: Remove phase consistency guard**

Search for the `handoff.phase` comparison against `CDD_MODE` (the phase consistency correction logic). Remove this block. Orchestrator validates before dispatch (Task 5 Step 3).

- [ ] **Step 6: Add handoff JSON Schema validation**

After CLI agent returns and handoff is read, add schema validation:

```javascript
import { validateHandoffSchema } from './schema-utils.mjs';
// ... after reading handoff
const sv = validateHandoffSchema(handoff);
if (!sv.valid) {
  // write BLOCKED handoff with schema error
  writeHandoff(handoffPath, { status: 'BLOCKED', blocker: sv.reason });
  // ... exit
}
```

- [ ] **Step 7: Add open-findings.json pre-generation (fix mode)**

After schema validation, for fix mode:

```javascript
if (mode === 'fix' && scope) {
  const openFindings = handoff.findings.filter(f => {
    if (scope === 'blocker-only') return !f.deferred;
    if (scope === 'deferred-sweep') return f.deferred;
    return false;
  });
  const openFindingsPath = path.join(workspace, 'open-findings.json');
  writeFileSync(openFindingsPath, JSON.stringify({ findings: openFindings }, null, 2));
  env.CDD_FINDINGS = openFindingsPath;
}
```

- [ ] **Step 8: Run all engine tests**

Run: `node packages/osuperpowers/bin/engine/tests/*.test.mjs`
Expected: all pass (may need to update runner tests for removed logic)

- [ ] **Step 9: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/runner.mjs
git commit -m "refactor(engine): thin runner.mjs to pure CLI dispatcher (~150 lines) (#211)"
```

---

### Task 5: Orchestrator 承接 responsibilities

**Files:**
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.md` (handoff-status + deferred-sweep-loop + dispatch-mode node updates)
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.zh-CN.md` (mirror sync)

**Interfaces:**
- Consumes: CLI wrappers from Task 1, thinned runner.mjs from Task 4, progress.json from Task 2
- Produces: updated SKILL.md with orchestrator-owned business logic

- [ ] **Step 1: Update handoff-status node**

Add commit-contract validation to `handoff-status` node Do field:

```markdown
### `handoff-status` (decision node)

- **Do**: Read `handoff.json` `status` field. Before routing, perform commit-contract validation:
  1. `node bin/engine/lib/contract.mjs --check-dirty` — dirty tree → route to BLOCKED: engine-error
  2. `node bin/engine/lib/contract.mjs --check-head --handoff <path> --progress <path>` — head mismatch → route to BLOCKED: engine-error
  Then route by status: APPROVED → `task-complete?`; CHANGES_REQUESTED → dispatch-mode (fix); BLOCKED → `engine-recovery`; TIMEOUT → `timeout-decision`.
```

- [ ] **Step 2: Update deferred-sweep-loop node**

Replace "runner.mjs automatically clears findings[]" with orchestrator-owned logic:

```markdown
### `deferred-sweep-loop`

- **Do**: After fix CLI returns with agent exit code = 0:
  1. `node bin/engine/lib/contract.mjs --clear-findings --handoff <path>` (原地清空 findings[])
  2. Set handoff.status = "APPROVED"
  3. Append task's `Task N: complete` to ledger
  Continue next task's sweep.
```

- [ ] **Step 3: Update dispatch-mode node**

Add brief generation and review diff generation before dispatch:

```markdown
### `dispatch-mode`

- **Do**: Before dispatching cdd-task.mjs:
  1. Generate brief: `node bin/engine/lib/brief.mjs --task N --plan <path> --output <workspace>/task-N-brief.md`
  2. Record dispatch-time HEAD: `git rev-parse HEAD` → write to `progress.json.lastDispatchHead`
  3. For task-review mode: generate review diff via review-package script
  4. **Three-mode chain enforcement (#207)**: For fix mode — verify task-review handoff exists for this task AND status = APPROVED; refuse dispatch otherwise (report to user)
  5. Dispatch: `node bin/engine/cdd-task.mjs --harness <name> --task N --mode <mode> [--scope <scope>]`
```

- [ ] **Step 4: Sync zh-CN mirror**

Update `packages/osuperpowers/skills/cli-driven-development/SKILL.zh-CN.md` with same changes.

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/skills/cli-driven-development/SKILL.md packages/osuperpowers/skills/cli-driven-development/SKILL.zh-CN.md
git commit -m "refactor(cdd-skill): orchestrator 承接 commit-contract + deferred-sweep + brief gen (#207 #210 #211)"
```

---

### Task 6: Tests + validation + changeset

**Files:**
- Modify: `packages/osuperpowers/bin/engine/tests/*.test.mjs` (update for new paths + add new tests)
- Create: `.changeset/p-delta-cdd-refactor.md`

**Interfaces:**
- Consumes: all previous tasks
- Produces: all tests passing, pnpm run emit clean, changeset file

- [ ] **Step 1: Update existing tests for new paths**

Update template tests to reference new `_templates/` and `cli-driven-development/templates/` paths.

- [ ] **Step 2: Add schema validation tests**

Test handoff-schema.json validation (valid/missing fields/invalid enum).

- [ ] **Step 3: Add open-findings pre-gen tests**

Test open-findings.json generation for blocker-only and deferred-sweep scopes.

- [ ] **Step 4: Add progress.json migration tests**

Test migration from progress.md to progress.json.

- [ ] **Step 5: Run full test suite**

Run: `node packages/osuperpowers/bin/engine/tests/*.test.mjs`
Expected: all pass

- [ ] **Step 6: Run emit + validate**

```bash
pnpm run emit && pnpm run validate
```
Expected: no drift, all validation blocks pass

- [ ] **Step 7: Create changeset**

```bash
# Create .changeset/p-delta-cdd-refactor.md
cat > .changeset/p-delta-cdd-refactor.md << 'EOF'
---
"osuperpowers": minor
---

CDD engine refactoring: thin runner.mjs dispatcher, handoff-schema.json, template restructure, progress.json, orchestrator-owned business logic
EOF
```

- [ ] **Step 8: Commit**

```bash
git add packages/osuperpowers/bin/engine/tests/ .changeset/p-delta-cdd-refactor.md
git commit -m "test(engine): Pδ tests + validation + changeset (#207 #210 #211)"
```
