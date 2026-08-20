# P1 — Prompt 模板落地 + cdd-exec 插值 + review→task-review 重命名

- **Version**: v1.0 . 2026-08-20
- **Status**: Draft
- **Author**: Oscaner Miao . Claude Opus 4.8 (1M context)
- **Parent program**: [CLI Reviewer Pipeline Overall](../specs/2026-08-20-cli-reviewer-pipeline-overall.md) v1.1
- **Depends on**: 无（P1 独立可交付）

## Section 0: Incremental warning

> P1 increment only。Cross-phase 约定见 [overall](../specs/2026-08-20-cli-reviewer-pipeline-overall.md)；冲突时 overall 胜出。

## Section 1: Constraints pointer

> 不重复 overall 约定。Overall 胜出。

## Section 2: Design body

### 2.1 架构总览

```
cdd-exec --template <name> --param KEY=VALUE...
         │
         ├── 加载 templates/cdd/<name>-reviewer.md（或 <name>.md）
         ├── {{KEY}} → VALUE 插值替换
         └── 渲染后 prompt → invokeCli()

cdd-run --mode task-review  (原 --mode review)
         │
         ├── VALID_MODES = ["implement", "task-review", "fix"]
         ├── harness-registry.json: task_review_prefix
         ├── CDD_TASK_REVIEW_FIXED_POINT env
         └── 行为不变，仅重命名
```

### 2.2 模板文件

#### 2.2.1 `templates/cdd/spec-review.md`

基于上游 `vendors/superpowers/skills/brainstorming/spec-document-reviewer-prompt.md`，改写为 CI one-shot prompt（无 subagent 包装）。参数化：

| 占位符 | 含义 | 来源 |
|---|---|---|
| `{{DOC}}` | spec 文件路径 | `--param DOC=<path>` |
| `{{PASS}}` | review pass 类别 | `--param PASS=completeness\|consistency\|clarity` |

**审查维度（按 PASS 参数聚焦）：**

| PASS | 维度 |
|---|---|
| `completeness` | TODOs、placeholders、"TBD"、不完整 section、遗漏的需求 |
| `consistency` | 内部矛盾、需求冲突、架构与功能描述不一致 |
| `clarity` | 歧义需求（可能被理解出两种意思）、YAGNI（过度设计）、scope 过大 |

输出 D3 findings-only JSON：`{"findings": [{"lens": "...", "severity": "blocker|warn|nit", "section": "...", "summary": "...", "fix": "..."}]}`

#### 2.2.2 `templates/cdd/plan-review.md`

基于上游 `vendors/superpowers/skills/writing-plans/plan-document-reviewer-prompt.md`，同理。参数化：

| 占位符 | 含义 |
|---|---|
| `{{DOC}}` | plan 文件路径 |
| `{{SPEC}}` | spec 文件路径（可选） |
| `{{PASS}}` | review pass 类别 |

**审查维度（按 PASS 参数聚焦）：**

| PASS | 维度 |
|---|---|
| `completeness` | TODOs、placeholders、incomplete tasks、missing steps、spec 覆盖缺口 |
| `decomposition` | Task 边界清晰、步骤可操作、依赖关系正确 |
| `buildability` | 工程师能否按此 plan 执行不被卡住、Task 粒度合理 |

输出 D3 findings-only JSON，同上。

**模板不与 upstream 的 subagent 指令耦合。**上游模板是 `Subagent (general-purpose): description: ...` 格式——这是给人/编排器读的，不是给 CLI agent 的 prompt。落地模板是独立编写的 one-shot prompt，只借上游的审查维度。

**文件命名约定：** 模板文件名为 `<type>.md`（如 `spec-review.md`、`plan-review.md`），`--template <type>` 直接映射到 `templates/cdd/<type>.md`。无双重后缀问题。

### 2.3 `cdd-exec.mjs` 参数扩展

#### 新增参数

```
cdd-exec --harness <name> (--prompt <text> | --template <name> [--param KEY=VALUE...])
```

| 参数 | 说明 |
|---|---|
| `--template <name>` | 模板名，映射到 `templates/cdd/<name>.md` |
| `--param KEY=VALUE` | 键值对，可重复。模板中 `{{KEY}}` 替换为 VALUE。同一 KEY 传多次时后者覆盖 |

`--template` 和 `--prompt` **互斥**——同时给 → stderr `--template and --prompt are mutually exclusive` + exit 2。

#### 解析逻辑

参数解析新增 `templateName` + `params` map：

```
for (arg loop):
  --template → templateName = args[++i]
  --param → parse KEY=VALUE, params[KEY] = VALUE
  --prompt → prompt = args[++i]（现有）

if (templateName && prompt) usage("mutually exclusive")
if (!harness) usage()
if (!templateName && !prompt) usage()
```

#### 模板加载与渲染

1. 从 `pluginRoot()` 定位 `templates/cdd/` 目录
2. 读 `templates/cdd/<name>.md`，不存在 → 报错退出
3. 读文件内容，对每个 `{{KEY}}` 做 `params[KEY]` 替换
4. 未传的占位符 → 报错退出（`template <name>: missing param {{KEY}}`），不做 fail-open——每个 reviewer 模板的占位符是已知的、必需的，无分阶段渲染场景
5. 渲染后文本作为 prompt 传给 `invokeCli()`

### 2.4 `review` → `task-review` 全量重命名

#### 2.4.1 重命名映射表

| 旧值 | 新值 | 位置 |
|---|---|---|
| `"review"` (mode) | `"task-review"` | `cdd-run.mjs`、`runner.mjs`、`templates.mjs`、测试文件 |
| `CDD_REVIEW_FIXED_POINT` | `CDD_TASK_REVIEW_FIXED_POINT` | `runner.mjs`、`cdd-reference.md`、测试文件 |
| `review_prefix` | `task_review_prefix` | `harness-registry.json`、`registry.mjs`、`runner.mjs` |
| `review.md` (模板) | `task-review.md` | `templates/cdd/` |
| "CDD review" (模板标题) | "CDD task-review" | `templates/cdd/task-review.md` |
| "Segment: review" | "Segment: task-review" | `_handoff-write-fragment.md` |

#### 2.4.2 文件级变更详情

**`cdd-run.mjs`** — usage/help 字符串中 `implement|review|fix` → `implement|task-review|fix`

**`runner.mjs`** — 核心变更：

```
VALID_MODES → ["implement", "task-review", "fix"]

validateMode: "CDD_MODE must be implement|task-review|fix"

invokeCli: mode === "task-review" && task_review_prefix（旧 review_prefix）
           → const prefix = entry.task_review_prefix

requireEnv: "CDD_TASK_REVIEW_FIXED_POINT"（旧 CDD_REVIEW_FIXED_POINT）

buildTaskEnv: 默认值键名同步

runTask: if (mode === "task-review") { ... } 分支
        env.CDD_TASK_REVIEW_FIXED_POINT 设置

runTaskChain:
  "review" → "task-review"（3 处：初始 review + re-review × 2）
  reviewBase → taskReviewBase
  reviewHead → taskReviewHead
  "re-review" log → "re-task-review"
```

**`harness-registry.json`** — 字段重命名：

```json
"claude": {
  "cli": "claude",
  "invoke": "-p --output-format text --dangerously-skip-permissions",
  "output": "text",
  "task_review_prefix": "Skill(mattpocock-skills:code-review)",
  "ship": "full"
}
```

其他 harness 的 `review_prefix: ""` → `task_review_prefix: ""`

**`registry.mjs`** — `registryField` 调用注释更新，无逻辑变更（字段名只是字符串索引）

**`contract.mjs`** — 注释 `mode implement/fix 才校验；review → no-op` → `mode implement/fix 才校验；task-review → no-op`

**`templates/cdd/`** — 文件重命名：
- `review.md` → `task-review.md`（标题 "CDD review" → "CDD task-review"）
- `_handoff-write-fragment.md`："Segment: review" → "Segment: task-review"

**`cdd-reference.md`** — H6 模式表更新 + env contract 变量名更新

**SKILL.md 更新：**
- `cli-driven-development/SKILL.md`：`--mode review` → `--mode task-review`
- `code-review/SKILL.md`：如引用 "review mode"，更新为 "task-review mode"

**测试文件：**
- `run.test.mjs`：模式字符串、env 变量名
- `runner.test.mjs`：`CDD_REVIEW_FIXED_POINT` 引用
- `templates.test.mjs`：文件名 `review.md` → `task-review.md`
- `skills-gate.test.mjs`：mode 字符串
- `exec.test.mjs`：`CDD_MODE=review` 引用

### 2.5 SKILL.md 调用语法更新

**`brainstorming/SKILL.md` Rule: Spec Review via CLI：**

旧：
```
cdd-exec --harness claude --prompt "<spec-document-reviewer template + pass category + document path>"
```

新：
```
cdd-exec --harness claude --template spec-review --param PASS=<completeness|consistency|clarity> --param DOC=<path>
```

**`writing-plans/SKILL.md` Rule: Plan Review via CLI：**

旧：
```
cdd-exec --harness claude --prompt "<plan-document-reviewer template + pass category + document path>"
```

新：
```
cdd-exec --harness claude --template plan-review --param PASS=<completeness|decomposition|buildability> --param DOC=<plan-path> --param SPEC=<spec-path>
```

### 2.6 错误处理

| 场景 | 行为 |
|---|---|
| `--template` + `--prompt` 同用 | stderr + exit 2 |
| 模板文件不存在 | `template not found: templates/cdd/<name>.md` + exit 1 |
| `--param` 无 `=` | stderr + exit 2 |
| 模板含未传 `{{KEY}}` | `template <name>: missing param {{KEY}}` + exit 1 |
| 同一 KEY 传多次 | 后者覆盖（最后一条 `--param KEY=...` 生效） |
| 无 `--template` 也无 `--prompt` | usage + exit 2 |

### 2.7 测试

- `exec.test.mjs` 新增：`--template` + `--param` 渲染测试；互斥测试；模板不存在测试；缺失占位符报错测试
- `templates.test.mjs`：新增 spec-review / plan-review 模板存在性 + 占位符完整性测试
- 现有 `review` → `task-review` 重命名后的回归测试（run.test.mjs、runner.test.mjs、skills-gate.test.mjs）

### 2.8 Acceptance Criteria

1. `review` 字面量在 CLI entry/模板/代码中完全消失，无别名
2. `cdd-exec --template spec-review --param DOC=... --param PASS=completeness` 渲染并执行
3. `cdd-exec --template plan-review --param DOC=... --param SPEC=... --param PASS=decomposition` 渲染并执行
4. `cdd-exec --template` 与 `--prompt` 互斥报错
5. `cdd-run --mode task-review` 行为与改名前 `--mode review` 完全一致
6. `harness-registry.json` 中 `task_review_prefix` 替换 `review_prefix`
7. `brainstorming/SKILL.md` 和 `writing-plans/SKILL.md` 的 CLI 调用示例可执行
8. `pnpm run validate` 全部通过

## Section 3: Deviations from overall

无——P1 是首个 phase，无上游偏差。

## Section 4: Notes for downstream

P2 依赖：
- `cdd-exec --template` 基础设施就绪（P1）
- `task-review` 命名已稳定（P1）
- P2 新增 `branch-reviewer.md` 模板 + `branch-review.md` CDD session 模板 + `--mode branch-review`

## Section 5: Review

TBD — spec self-review 后填入结果。