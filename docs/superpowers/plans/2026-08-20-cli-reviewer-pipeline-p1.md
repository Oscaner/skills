# P1 — CLI Reviewer Pipeline: 模板落地 + cdd-exec 插值 + 重命名

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 CDD engine 建立统一的 reviewer CLI 基础设施——落地 spec-review 和 plan-review 模板，cdd-exec 支持 `--template` 可执行插值，`review` → `task-review` 全量重命名。

**Architecture:** 3 条主线——(1) 新增 `templates/cdd/spec-review.md` 和 `plan-review.md` 两个 reviewer prompt 模板，独立于上游 subagent 格式；(2) `cdd-exec.mjs` 扩展 `--template` + `--param` 参数，从 `templates/cdd/<name>.md` 加载模板并做 `{{PLACEHOLDER}}` 替换后传给 CLI；(3) `review` → `task-review` 重命名波及 CLI entry/runner/registry/模板/文档/SKILL.md/测试共 12+ 文件，不留别名。

**Tech Stack:** Node.js (mjs)、JSON (harness-registry)、Markdown (模板 + SKILL.md)

## Global Constraints

- 模板文件采用 `{{PLACEHOLDER}}` 双花括号语法，与现 `templates/cdd/*.md` 一致
- `--template` 和 `--prompt` 互斥，同时给 → exit 2
- 未传占位符 → 报错退出（不做 fail-open）
- `review` 旧值完全消失，无别名/兼容层
- 向后兼容：`--prompt` 行为不变；`cdd-run --mode task-review` = 原 `--mode review`
- `pnpm run validate` 全部通过

---
## File Structure

| File | Responsibility |
|---|---|
| `packages/osuperpowers/templates/cdd/spec-review.md` | (New) Spec-reviewer prompt 模板——`{{DOC}}` + `{{PASS}}` 占位符 |
| `packages/osuperpowers/templates/cdd/plan-review.md` | (New) Plan-reviewer prompt 模板——`{{DOC}}` + `{{SPEC}}` + `{{PASS}}` 占位符 |
| `packages/osuperpowers/templates/cdd/review.md` → `task-review.md` | Rename: "CDD review" → "CDD task-review" |
| `packages/osuperpowers/templates/cdd/_handoff-write-fragment.md` | Modify: "Segment: review" → "Segment: task-review" |
| `packages/osuperpowers/bin/engine/cdd-exec.mjs` | Modify: 新增 `--template` + `--param` 参数解析 + 模板渲染逻辑 |
| `packages/osuperpowers/bin/engine/cdd-run.mjs` | Modify: usage 字符串中 mode 名更新 |
| `packages/osuperpowers/bin/engine/lib/runner.mjs` | Modify: 核心重命名——VALID_MODES / invokeCli / requireEnv / runTask / runTaskChain |
| `packages/osuperpowers/bin/engine/lib/templates.mjs` | Modify: 模板文件名 `review.md` → `task-review.md` |
| `packages/osuperpowers/bin/engine/lib/contract.mjs` | Modify: 注释更新 |
| `packages/osuperpowers/bin/engine/harness-registry.json` | Modify: `review_prefix` → `task_review_prefix` |
| `packages/osuperpowers/skills/brainstorming/SKILL.md` | Modify: Rule: Spec Review via CLI 调用语法更新 |
| `packages/osuperpowers/skills/writing-plans/SKILL.md` | Modify: Rule: Plan Review via CLI 调用语法更新 |
| `packages/osuperpowers/skills/cli-driven-development/SKILL.md` | Modify: mode 字符串更新 |
| `packages/osuperpowers/docs/cdd-reference.md` | Modify: H6 模式表 + env contract 表更新 |
| `packages/osuperpowers/bin/engine/tests/exec.test.mjs` | Modify: CDD_MODE=review → task-review + 新增 template 测试 |
| `packages/osuperpowers/bin/engine/tests/run.test.mjs` | Modify: mode 字符串 |
| `packages/osuperpowers/bin/engine/tests/runner.test.mjs` | Modify: mode/review_prefix/CDD_REVIEW_FIXED_POINT 引用 |
| `packages/osuperpowers/bin/engine/tests/templates.test.mjs` | Modify: review.md → task-review.md + 新增 spec-review/plan-review 模板存在性测试 |
| `packages/osuperpowers/bin/engine/tests/registry.test.mjs` | Modify: `review_prefix` → `task_review_prefix` |
| `packages/osuperpowers/bin/engine/tests/skills-gate.test.mjs` | Modify: mode 字符串 |
| `packages/osuperpowers/bin/engine/tests/contract.test.mjs` | Modify: `"review"` → `"task-review"` 模式参数 |
| `packages/osuperpowers/bin/utils/tests/skills-probe.test.mjs` | Modify: cacheGlob `oscaner` → `oscaner-skills`（需与上次 rename 一致） |
| `packages/osuperpowers/bin/engine/cdd-select.mjs` | 不修改——已验证无 `review`/`review_prefix`/`CDD_REVIEW_FIXED_POINT` 引用 |

**File deletion:** `packages/osuperpowers/templates/cdd/review.md`（被 `task-review.md` 取代）

### Task 1: 创建 spec-review 和 plan-review 提示词模板

**Files:**
- Create: `packages/osuperpowers/templates/cdd/spec-review.md`
- Create: `packages/osuperpowers/templates/cdd/plan-review.md`

**Interfaces:**
- Consumes: 上游 `vendors/superpowers/skills/brainstorming/spec-document-reviewer-prompt.md`（维度参考）、`vendors/superpowers/skills/writing-plans/plan-document-reviewer-prompt.md`（维度参考）
- Produces: 两个可被 `cdd-exec --template` 加载的模板文件，占位符 `{{DOC}}`、`{{SPEC}}`、`{{PASS}}`

- [ ] **Step 1: 创建 spec-review.md**

```markdown
# Spec Review

Review the spec document at **{{DOC}}** with lens: **{{PASS}}**.

## Context

You are a spec document reviewer. Verify this spec is complete and ready for planning.

## Review Focus

| PASS | What to Check |
|---|---|
| completeness | TODOs, placeholders, "TBD", incomplete sections, missing requirements |
| consistency | Internal contradictions, conflicting requirements, architecture vs feature description mismatch |
| clarity | Requirements ambiguous enough to cause someone to build the wrong thing; YAGNI (over-engineering); scope too large for a single plan |

## Calibration

**Only flag issues that would cause real problems during implementation planning.**
A missing section, a contradiction, or a requirement so ambiguous it could be
interpreted two different ways — those are issues. Minor wording improvements,
stylistic preferences, and "sections less detailed than others" are not.

## Output Format

Return **only** a JSON object in the following format — no prose, no summary, no positive comments:

```json
{
  "findings": [
    {
      "lens": "completeness|consistency|clarity",
      "severity": "blocker|warn|nit",
      "section": "section name or heading",
      "summary": "one-line description of the issue",
      "fix": "one-line suggested fix"
    }
  ]
}
```

Empty findings array = approved. No other output.
```

- [ ] **Step 2: 创建 plan-review.md**

```markdown
# Plan Review

Review the plan document at **{{DOC}}** against spec at **{{SPEC}}** with lens: **{{PASS}}**.

## Context

You are a plan document reviewer. Verify this plan is complete and ready for implementation.

## Review Focus

| PASS | What to Check |
|---|---|
| completeness | TODOs, placeholders, incomplete tasks, missing steps, spec requirements with no corresponding task |
| decomposition | Task boundaries are clear, steps are actionable, dependencies between tasks are correct |
| buildability | Could an engineer follow this plan without getting stuck? Task granularity reasonable? |

## Calibration

**Only flag issues that would cause real problems during implementation.**
An implementer building the wrong thing or getting stuck is an issue.
Minor wording, stylistic preferences, and "nice to have" suggestions are not.

## Output Format

Return **only** a JSON object in the following format — no prose, no summary, no positive comments:

```json
{
  "findings": [
    {
      "lens": "completeness|decomposition|buildability",
      "severity": "blocker|warn|nit",
      "section": "Task N or section name",
      "summary": "one-line description of the issue",
      "fix": "one-line suggested fix"
    }
  ]
}
```

Empty findings array = approved. No other output.
```

- [ ] **Step 3: Commit**

```bash
git add packages/osuperpowers/templates/cdd/spec-review.md packages/osuperpowers/templates/cdd/plan-review.md
git commit -m "feat: add spec-review and plan-review prompt templates for cdd-exec"
```

### Task 2: cdd-exec.mjs 扩展 --template + --param

**Files:**
- Modify: `packages/osuperpowers/bin/engine/cdd-exec.mjs`

**Interfaces:**
- Consumes: `templates.mjs#pluginRoot()`（定位模板目录）、`runner.mjs#invokeCli()`（复用 CLI dispatch）、`registry.mjs` checkHarness/loadRegistry
- Produces: `--template <name> --param KEY=VALUE...` 参数接口，`--template` 与 `--prompt` 互斥，模板加载 + `{{PLACEHOLDER}}` 替换后传给 invokeCli

- [ ] **Step 1: 添加 TEMPLATE_DIR 和 renderTemplate 函数**

在 cdd-exec.mjs 顶部 import 区域后、main logic 之前添加：

```javascript
import { pluginRoot } from "./lib/templates.mjs";

const TEMPLATE_DIR = path.join(pluginRoot(), "templates", "cdd");

// 加载模板文件并替换 {{KEY}} → value；缺失占位符 → 报错退出。
function renderTemplate(name, params, programName) {
  const templatePath = path.join(TEMPLATE_DIR, `${name}.md`);
  if (!existsSync(templatePath)) {
    process.stderr.write(`${programName}: template not found: templates/cdd/${name}.md\n`);
    exitWithCode(1);
  }
  let content = readFileSync(templatePath, "utf8");
  for (const [key, value] of Object.entries(params)) {
    content = content.split(`{{${key}}}`).join(value);
  }
  // 未传占位符 → 报错
  const missing = content.match(/\{\{(\w+)\}\}/);
  if (missing) {
    process.stderr.write(`${programName}: template ${name}: missing param ${missing[0]}\n`);
    exitWithCode(1);
  }
  return content;
}
```

- [ ] **Step 2: 更新 help/usage 字符串**

```javascript
function usage() {
  process.stderr.write(
    `usage: ${NAME} --harness <name> (--prompt <text> | --template <name> [--param KEY=VALUE...])\n`,
  );
  exitCliMissing();
}

function help() {
  process.stdout.write(
    `usage: ${NAME} --harness <name> (--prompt <text> | --template <name> [--param KEY=VALUE...])\n`,
  );
  exitOk();
}
```

- [ ] **Step 3: 扩展参数解析**

在现有 `let prompt = "";` 之后添加：

```javascript
let templateName = "";
/** @type {Record<string, string>} */
const params = {};
```

在 `for` 循环的 `switch` 中添加两个新 case：

```javascript
case "--template":
  if (i + 1 >= args.length) usage();
  templateName = args[++i];
  break;
case "--param": {
  if (i + 1 >= args.length) usage();
  const raw = args[++i];
  const eq = raw.indexOf("=");
  if (eq < 0) {
    process.stderr.write(`${NAME}: --param must be KEY=VALUE (got: ${raw})\n`);
    exitCliMissing();
  }
  params[raw.slice(0, eq)] = raw.slice(eq + 1);
  break;
}
```

- [ ] **Step 4: 互斥检查 + 模板渲染逻辑**

替换 `if (!harness || !prompt) usage();` 为：

```javascript
if (!harness) usage();
if (templateName && prompt) {
  process.stderr.write(`${NAME}: --template and --prompt are mutually exclusive\n`);
  usage();
}
if (!templateName && !prompt) usage();
```

在 `const mode = process.env.CDD_MODE ?? "";` 之前，如果 templateName 非空则渲染模板：

```javascript
if (templateName) {
  prompt = renderTemplate(templateName, params, NAME);
}
```

- [ ] **Step 5: 提交（无中间 breakage）**

`cdd-exec --template` 调用 `invokeCli` 时不设 `CDD_MODE`（模板路径 `mode` 为空字符串），`invokeCli` 中 `mode === "task-review"` 为 false，`task_review_prefix` 不会被前置。因此 Task 2 commit 后 registry 仍用旧字段名 `review_prefix` 不影响 `--template` 功能——`invokeCli` 仍读旧字段名（Task 4 才会改为新字段名）。无中间 breakage。

- [ ] **Step 6: Commit**

```bash
git add packages/osuperpowers/bin/engine/cdd-exec.mjs
git commit -m "feat: add --template and --param to cdd-exec for template-based prompts"
```

### Task 3: review.md 重命名 + handoff fragment + contract.mjs 注释

**Files:**
- Rename: `packages/osuperpowers/templates/cdd/review.md` → `packages/osuperpowers/templates/cdd/task-review.md`
- Modify: `packages/osuperpowers/templates/cdd/task-review.md`（标题更新）
- Modify: `packages/osuperpowers/templates/cdd/_handoff-write-fragment.md`
- Modify: `packages/osuperpowers/bin/engine/lib/templates.mjs`（文件名引用更新）
- Modify: `packages/osuperpowers/bin/engine/lib/contract.mjs`（注释更新）

**Interfaces:**
- Consumes: 现有 `review.md` 模板内容
- Produces: `task-review.md` 模板（行为不变，仅改名）；`templates.mjs#renderModePrompt` 加载新文件名；handoff fragment "Segment: task-review"

- [ ] **Step 1: 重命名 review.md → task-review.md，更新标题**

```bash
mv packages/osuperpowers/templates/cdd/review.md packages/osuperpowers/templates/cdd/task-review.md
```

编辑 `packages/osuperpowers/templates/cdd/task-review.md`，# 标题：

```markdown
# CDD task-review — CLI session
```

其余内容保持不变（模板 body 中的 `_handoff-write-fragment.md` review segment 引用在 Step 3 统一更新）。

- [ ] **Step 2: 更新 templates.mjs 中的模板文件名引用**

编辑 `packages/osuperpowers/bin/engine/lib/templates.mjs`，`renderModePrompt` 函数内：

```javascript
// 旧:
const modePath = path.join(root, "templates", "cdd", `${mode}.md`);
// 不变——mode 参数传入 "task-review"，自动匹配 task-review.md
```

`renderModePrompt` 的 mode 参数来自 `runTask` 的 `mode` 变量。在 Task 4 中 runner.mjs 会把 `"review"` 改为 `"task-review"` 传入——但模板文件必须先改名（本 Task），否则 Task 4 改 mode 值之后模板文件找不到。

- [ ] **Step 3: 更新 _handoff-write-fragment.md**

编辑 `packages/osuperpowers/templates/cdd/_handoff-write-fragment.md`：

```markdown
### Segment: task-review
```

其余内容保持不变。

- [ ] **Step 4: 更新 contract.mjs 注释**

编辑 `packages/osuperpowers/bin/engine/lib/contract.mjs`，第 102 行：

```javascript
// mode implement/fix 才校验；task-review → no-op。非 git / git-error → fail-open。
```

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/templates/cdd/task-review.md
git add packages/osuperpowers/templates/cdd/_handoff-write-fragment.md
git add packages/osuperpowers/bin/engine/lib/templates.mjs
git add packages/osuperpowers/bin/engine/lib/contract.mjs
# git rm 旧文件名（git 会自动检测 rename）
git rm packages/osuperpowers/templates/cdd/review.md
git commit -m "refactor: rename review mode template and references to task-review"
```

### Task 4: runner.mjs + cdd-run.mjs + harness-registry.json 全量重命名

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs`
- Modify: `packages/osuperpowers/bin/engine/cdd-run.mjs`
- Modify: `packages/osuperpowers/bin/engine/harness-registry.json`

**Interfaces:**
- Consumes: Task 3 已改名的 `task-review.md` 模板
- Produces: VALID_MODES = ["implement", "task-review", "fix"]；`CDD_TASK_REVIEW_FIXED_POINT` 替换 `CDD_REVIEW_FIXED_POINT`；`task_review_prefix` 替换 `review_prefix`

- [ ] **Step 1: runner.mjs 重命名**

编辑 `packages/osuperpowers/bin/engine/lib/runner.mjs`：

**Line 23 — VALID_MODES：**
```javascript
const VALID_MODES = ["implement", "task-review", "fix"];
```

**Line 108 — validateMode：**
```javascript
if (!VALID_MODES.includes(mode)) return `CDD_MODE must be implement|task-review|fix (got: ${mode})`;
```

**Line 112 — requireEnv 注释：**
```javascript
// 对齐 cdd_require_env：必需 CDD_* + mode 特例（task-review → CDD_TASK_REVIEW_FIXED_POINT；fix → CDD_FINDINGS）。
```

**Line 118 — requireEnv task-review 分支：**
```javascript
if (mode === "task-review" && !env.CDD_TASK_REVIEW_FIXED_POINT) missing.push("CDD_TASK_REVIEW_FIXED_POINT");
```

**Line 131 — promptEnv FIXED_POINT：**
```javascript
FIXED_POINT: env.CDD_TASK_REVIEW_FIXED_POINT,
```

**Lines 163-164 — invokeCli task_review_prefix：**
```javascript
const { cli, invoke, output, task_review_prefix } = entry;
const promptArg = mode === "task-review" && task_review_prefix ? `${task_review_prefix} ${prompt}` : prompt;
```

**Lines 457-467 — runTask task-review 分支（3 处）：**
```javascript
if (mode === "task-review") {
    if (!env.CDD_TASK_REVIEW_FIXED_POINT) {
      if (handoffBase) env.CDD_TASK_REVIEW_FIXED_POINT = handoffBase;
    }
    if (dryRun && !env.CDD_TASK_REVIEW_FIXED_POINT) env.CDD_TASK_REVIEW_FIXED_POINT = "HEAD~1";
    if (!dryRun) {
      if (!plan) return finish(1, [], "task-review mode requires plan path (ledger header or --plan)", noExit);
      if (!existsSync(plan)) return finish(1, [], `plan file not found: ${plan}`, noExit);
      const taskReviewBase = env.CDD_TASK_REVIEW_FIXED_POINT;
      if (!taskReviewBase) return finish(1, [], "task-review mode requires CDD_TASK_REVIEW_FIXED_POINT or handoff commits.base", noExit);
      let taskReviewHead = "HEAD";
      const handoffHead = readJsonField(env.CDD_HANDOFF_PATH, ["commits", "head"]);
      if (handoffHead) taskReviewHead = handoffHead;
      try {
        await runReviewPackage(plan, taskReviewBase, taskReviewHead, env.CDD_HANDOFF_PATH, { cwd, env });
      } catch (e) {
        if (e instanceof RunBlocked) return finish(1, [], e.message, noExit);
        throw e;
      }
    }
  }
```

**Line 608 — runTaskChain 清理列表：**
```javascript
for (const k of ["CDD_LEDGER", "CDD_TASK_BRIEF", "CDD_HANDOFF_PATH", "CDD_PLAN_CONSTRAINTS", "CDD_FINDINGS", "CDD_TASK_REVIEW_FIXED_POINT"]) {
```

**Lines 621-658 — runTaskChain mode 字符串（6 处）：**
```javascript
// Line 621: taskReviewBase
const taskReviewBase = readJsonField(handoffPath, ["commits", "base"]);
if (!taskReviewBase) {
    chainBlocked(n, "handoff missing commits.base after implement");
    return 1;
}
taskEnv.CDD_TASK_REVIEW_FIXED_POINT = taskReviewBase;

// Line 628: "task-review"
rc = (await runTask(harness, n, { mode: "task-review", planFile, dryRun, env: taskEnv, cwd, noExit: true, registryPath })).exitCode;
if (rc !== 0) return chainRunTaskFailed(n, handoffPath, "task-review", rc);

// Line 654: fix loop 中的 taskReviewBase
const fixBase = readJsonField(handoffPath, ["commits", "head"]);
...
taskEnv.CDD_TASK_REVIEW_FIXED_POINT = fixBase;

// Line 658: fix loop 中的 review → task-review
rc = (await runTask(harness, n, { mode: "task-review", planFile, dryRun, env: taskEnv, cwd, noExit: true, registryPath })).exitCode;
if (rc !== 0) return chainRunTaskFailed(n, handoffPath, "re-task-review", rc);
```

- [ ] **Step 2: cdd-run.mjs 更新 usage/help**

编辑 `packages/osuperpowers/bin/engine/cdd-run.mjs`，注释和 usage 字符串：

```javascript
// Line 6 注释:
//   Mode A:  cdd-run.mjs --harness <name> --task N --mode implement|task-review|fix [--plan PATH]

// Lines 27, 34 usage/help:
`usage: ${NAME} --harness <name> (--task N --mode implement|task-review|fix [--plan PATH] | --plan PATH)\n`,
```

- [ ] **Step 3: harness-registry.json 字段重命名**

编辑 `packages/osuperpowers/bin/engine/harness-registry.json`，所有 `review_prefix` → `task_review_prefix`：

```json
{
  "claude": {
    "cli": "claude",
    "invoke": "-p --output-format text --dangerously-skip-permissions",
    "output": "text",
    "task_review_prefix": "Skill(mattpocock-skills:code-review)",
    "ship": "full"
  },
  "cursor-agent": {
    "cli": "cursor-agent",
    "invoke": "--print --output-format text --force",
    "output": "text",
    "task_review_prefix": "",
    "ship": "full"
  },
  "droid": {
    "cli": "droid",
    "invoke": "exec --auto medium --output-format stream-json",
    "output": "stream-json",
    "task_review_prefix": "",
    "ship": "full"
  },
  "pi": {
    "cli": "pi",
    "invoke": "-p --no-session --no-approve",
    "output": "text",
    "task_review_prefix": "",
    "ship": "full"
  },
  "codex": { "cli": "codex", "ship": "not-supported" },
  "copilot": { "cli": "copilot", "ship": "not-supported" },
  "gemini": { "cli": "gemini", "ship": "not-supported" }
}
```

- [ ] **Step 4: cdd-exec.mjs 更新 CDD_MODE 注释**

Task 2 中添加的模板代码中，`CDD_MODE` 引用不变（透传）。但 review-prefix 注释已过时——更新第 66 行注释：

```javascript
// 一次性 prompt-runner（不跑任务链）：CDD_MODE=task-review 触发 task_review_prefix 合成（透传）。
```

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/runner.mjs
git add packages/osuperpowers/bin/engine/cdd-run.mjs
git add packages/osuperpowers/bin/engine/harness-registry.json
git add packages/osuperpowers/bin/engine/cdd-exec.mjs
git commit -m "refactor: rename review to task-review throughout engine core"
```

### Task 5: SKILL.md + cdd-reference.md 文档 + 测试文件全量适配

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md`
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.md`
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.md`
- Modify: `packages/osuperpowers/docs/cdd-reference.md`
- Modify: `packages/osuperpowers/bin/engine/tests/exec.test.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/run.test.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/runner.test.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/templates.test.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/registry.test.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/skills-gate.test.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/contract.test.mjs`

**Interfaces:**
- Consumes: Task 4 的 engine core 重命名（mode 字符串、env 变量名、registry 字段名）
- Produces: SKILL.md 调用语法可执行、cdd-reference.md H6 表一致、所有测试通过

- [ ] **Step 1: brainstorming/SKILL.md — Rule: Spec Review via CLI**

编辑 `packages/osuperpowers/skills/brainstorming/SKILL.md`，Rule: Spec Review via CLI：

```markdown
### Rule: Spec Review via CLI

Spec review has 3 pass types (completeness / consistency&scope / clarity&YAGNI), each pass dispatches a fresh `cdd-exec`:
  cdd-exec --harness claude --template spec-review --param PASS=<completeness|consistency|clarity> --param DOC=<path>
Dispatch discipline: see [review-dispatch.md](../docs/review-dispatch.md) (D1/D2/D3 + fresh-pass, mapped verbatim to cli).
```

- [ ] **Step 2: writing-plans/SKILL.md — Rule: Plan Review via CLI**

编辑 `packages/osuperpowers/skills/writing-plans/SKILL.md`，Rule: Plan Review via CLI：

```markdown
### Rule: Plan Review via CLI

Plan review has 3 pass types (completeness & spec alignment / task decomposition / buildability & type consistency), each pass dispatches a fresh `cdd-exec`:
  cdd-exec --harness claude --template plan-review --param PASS=<completeness|decomposition|buildability> --param DOC=<plan-path> --param SPEC=<spec-path>
**Template resolution reuses** [Rule: Read Upstream](#rule-read-upstream) path rules (`{plugin-root}` = osuperpowers root). Dispatch discipline: see [review-dispatch.md](../docs/review-dispatch.md) (D1/D2/D3 + fresh-pass, mapped verbatim to cli).
```

- [ ] **Step 3: cli-driven-development/SKILL.md — mode 字符串更新**

编辑 `packages/osuperpowers/skills/cli-driven-development/SKILL.md`：

**Rule: Three-Mode Chain：**
```markdown
{plugin_root}/bin/engine/cdd-run.mjs --harness <name> --task N --mode implement
{plugin_root}/bin/engine/cdd-run.mjs --harness <name> --task N --mode task-review
```

**Rule: Handoff Contract — 注释中 `templates/cdd/{implement,review,fix}.md`：**
```markdown
Templates at `templates/cdd/{implement,task-review,fix}.md` + `_handoff-write-fragment.md`.
```

- [ ] **Step 4: cdd-reference.md — H6 模式表 + env contract**

编辑 `packages/osuperpowers/docs/cdd-reference.md`：

**H6 模式表：**
```markdown
| `CDD_MODE` | Responsibility |
|------------|----------------|
| `implement` | implementer + `mattpocock-skills:tdd` → report + test-evidence.json + handoff write + H1 four-line contract |
| `task-review` | `review-package` shell (archive diff); `code-review` variant (D4; axis files; Step 5 override) + handoff write |
| `fix` | fix implementer + handoff write; reads open-findings; **+ commit contract** (post-run gate, see below) |
```

**Env contract 表 — `CDD_REVIEW_FIXED_POINT` → `CDD_TASK_REVIEW_FIXED_POINT`：**
```markdown
| `CDD_TASK_REVIEW_FIXED_POINT` | task-review: initial from handoff `commits.base`; fix-loop task-review: `FIX_BASE` |
```

**命令行示例：**
```bash
cdd-run.mjs --harness <name> --task N --mode implement
cdd-run.mjs --harness <name> --task N --mode task-review
```

**模板文件路径引用 — `review.md` → `task-review.md`：**

cdd-reference.md 中如有引用 `templates/cdd/review.md` 或 `templates/cdd/{implement,review,fix}.md` 模板路径，同步更新为 `templates/cdd/task-review.md` 和 `templates/cdd/{implement,task-review,fix}.md`。

**Env contract 变量名 — 全文搜索替换：**

- `CDD_REVIEW_FIXED_POINT` → `CDD_TASK_REVIEW_FIXED_POINT`
- `review_prefix` → `task_review_prefix`

- [ ] **Step 5: 测试文件全量适配**

**exec.test.mjs**：

```javascript
// Line 118: CDD_MODE=review → CDD_MODE=task-review
test("cdd-exec.mjs: review-prefix 合成 — CDD_MODE=task-review 时 prompt 前置 task_review_prefix", () => {
  ...
  extraEnv: { CDD_MODE: "task-review" },
```

新增 `--template` 测试（验证 renderTemplate 函数的 DI seam）：

```javascript
// 通过临时目录注入模板目录来测试 renderTemplate逻辑
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("cdd-exec.mjs: renderTemplate 渲染 spec-review", () => {
  const dir = mkdtempSync(join(tmpdir(), "cdd-exec-test-"));
  const cddDir = join(dir, "templates", "cdd");
  mkdirSync(cddDir, { recursive: true });
  writeFileSync(join(cddDir, "spec-review.md"), "Review {{DOC}} with {{PASS}}");
  // 注入 TEMPLATE_DIR（通过 DI seam 或 直接测试 renderTemplate 导出）
  const result = renderTemplate("spec-review", { DOC: "/tmp/spec.md", PASS: "completeness" });
  assert.equal(result, "Review /tmp/spec.md with completeness");
  rmSync(dir, { recursive: true, force: true });
});

test("cdd-exec.mjs: renderTemplate 模板文件不存在 → exit 1", () => {
  // --template nonexistent → stderr "template not found" + exit 1
});

test("cdd-exec.mjs: renderTemplate 未传占位符 → exit 1", () => {
  const dir = mkdtempSync(join(tmpdir(), "cdd-exec-test-"));
  const cddDir = join(dir, "templates", "cdd");
  mkdirSync(cddDir, { recursive: true });
  writeFileSync(join(cddDir, "spec-review.md"), "Review {{DOC}} with {{PASS}} and {{MISSING}}");
  // 未传 MISSING → exit 1 + stderr "missing param {{MISSING}}"
  rmSync(dir, { recursive: true, force: true });
});

test("cdd-exec.mjs: --template 与 --prompt 互斥 → exit 2", () => {
  // spawn cdd-exec.mjs --template spec-review --prompt "hello" → exit 2 + stderr "mutually exclusive"
});
```

**run.test.mjs**：

```javascript
// Line 59: "review" → "task-review"
for (const mode of ["task-review", "fix"]) {
```

**runner.test.mjs**：

```javascript
// Line 102: "review" → "task-review"
for (const mode of ["task-review", "fix"]) {

// Line 136: review_prefix → task_review_prefix
reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };

// Lines 254, 281: review_prefix → task_review_prefix
const entry = { cli: "fake-stream-cli", invoke: "-p", output: "stream-json", task_review_prefix: "" };

// Lines 337-340: mode + CDD_REVIEW_FIXED_POINT
mode: "task-review",
  CDD_TASK_REVIEW_FIXED_POINT: "HEAD~1",
```

**templates.test.mjs**：

```javascript
// Line 48: "review" → "task-review"
const review = renderModePrompt("task-review", env);

// 新增 spec-review / plan-review 模板测试
test("spec-review.md renders with DOC and PASS", () => {
  const rendered = renderModePrompt("spec-review", { DOC: "/path/to/spec.md", PASS: "completeness" });
  assert.ok(rendered.includes("/path/to/spec.md"));
  assert.ok(rendered.includes("completeness"));
});

test("plan-review.md renders with DOC, SPEC, and PASS", () => {
  const rendered = renderModePrompt("plan-review", { DOC: "/path/to/plan.md", SPEC: "/path/to/spec.md", PASS: "decomposition" });
  assert.ok(rendered.includes("/path/to/plan.md"));
  assert.ok(rendered.includes("decomposition"));
});
```

注：`renderModePrompt` 当前只处理 mode 名的模板（`${mode}.md`）——对 `spec-review` 和 `plan-review` 会走同样的路径。如果 `renderModePrompt` 仅用于 CDD 三模式链，spec-review/plan-review 由 `cdd-exec --template` 的 `renderTemplate` 函数单独加载——那么 templates.test.mjs 的测试应区分：三模式链模板测试 vs reviewer 模板（`renderTemplate` 独立测试）。

**registry.test.mjs**：

```javascript
// Line 54, 66: review_prefix → task_review_prefix
ghost: { cli: ghost, invoke: "-p", output: "text", task_review_prefix: "", ship: "full" },
ghost: { cli: "cdd-nonexistent-cli-xyz", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" },

// Line 76: review_prefix → task_review_prefix
assert.equal(registryField(reg, "claude", "task_review_prefix"), "Skill(mattpocock-skills:code-review)");
```

**skills-gate.test.mjs**：

```javascript
// Line 88: "review" → "task-review"
runTask("claude", 1, { mode: "task-review", dryRun: true, probeSkills: fakeProbe, env: baseEnv(ws) }),
```

**contract.test.mjs**：

```javascript
// Line 115: "review" → "task-review"
const r = validateCommitContract("task-review", repo);
```

- [ ] **Step 6: Commit**

```bash
git add packages/osuperpowers/skills/brainstorming/SKILL.md
git add packages/osuperpowers/skills/writing-plans/SKILL.md
git add packages/osuperpowers/skills/cli-driven-development/SKILL.md
git add packages/osuperpowers/docs/cdd-reference.md
git add packages/osuperpowers/bin/engine/tests/exec.test.mjs
git add packages/osuperpowers/bin/engine/tests/run.test.mjs
git add packages/osuperpowers/bin/engine/tests/runner.test.mjs
git add packages/osuperpowers/bin/engine/tests/templates.test.mjs
git add packages/osuperpowers/bin/engine/tests/registry.test.mjs
git add packages/osuperpowers/bin/engine/tests/skills-gate.test.mjs
git add packages/osuperpowers/bin/engine/tests/contract.test.mjs
git commit -m "docs: update SKILL.md, cdd-reference and tests for task-review rename"
```