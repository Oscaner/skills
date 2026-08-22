# Dogfood 修复 P2 — CDD 引擎修复 + brainstorming grilling 加强 Phase Spec

- **Version**: v1.1 · 2026-08-21
- **Status**: Approved
- **Author**: Oscaner Miao · Claude Opus 4.8 (1M context)
- **Parent program**: [Overall Spec](2026-08-21-dogfood-fixes-overall.md) v1.6
- **Depends on**: P1（软依赖；P2 可独立交付，最终实现应对齐 P1 已确定规则）

---

## Section 0：增量说明

> 本文件为 P2 增量 spec。跨相规范见 [Overall Spec](2026-08-21-dogfood-fixes-overall.md)；Overall 优先。

---

## Section 1：约束指针

> 不重复 Overall 约束。Overall 优先。
> 跨相约束适用：P2 引擎变更必须覆盖新增行为的单元测试（`pnpm run validate` 全绿）。
> **语言约束（来自 Overall v1.3）**：SKILL.md 重写须为纯英文；zh-CN 镜像文件必须在同一 task 内同步更新，不可 defer。
> **P2 范围扩展（来自 Overall v1.5）**：新增 brainstorming/SKILL.md grilling 委托加强。

---

## Section 2：设计

### 2.1 目标与范围

修复两项引擎 dogfood 违规（#154 / #155）、新增 cdd-review.mjs `--handoff PATH` 参数，并加强 brainstorming/SKILL.md grilling 委托指令。

**Issue 清单**：

| 文件 | Issue | 修复类型 |
|------|-------|----------|
| `packages/osuperpowers/bin/engine/lib/brief.mjs`（新） | [#154](https://github.com/Oscaner/skills/issues/154) brief 机械切分 | 新增模块 |
| `packages/osuperpowers/bin/engine/lib/runner.mjs` | #154 + 结构校验 | step 2.55 精简（移除 brief 存在性检查，保留 templates 检查）；新增 step 4.5 brief 生成/校验（插在 step 4 plan backfill 之后）|
| `packages/osuperpowers/bin/engine/lib/runner.mjs` | [#155](https://github.com/Oscaner/skills/issues/155) OUTFILE 修复 | `runReviewPackage` 传第 4 参数 |
| `packages/osuperpowers/bin/engine/cdd-review.mjs` | --handoff PATH | 新增参数 + handoff 写入 |
| `packages/osuperpowers/skills/brainstorming/SKILL.md` | grilling 委托违规（dogfood 会话发现） | Rule: Read Sub-Skills 加强 + Red Flag；Rule: Spec Review via CLI 补 next-step 标签 |
| `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md` | 同上 | zh-CN 镜像同步 |
| `packages/osuperpowers/docs/docs-review.md` | Review Stopping 问询改进（dogfood 会话发现） | Rule: Review Stopping 重跑询问改为 AskUserQuestion + Next step 提示 |
| `packages/osuperpowers/skills/writing-plans/SKILL.md` | 同上（调用方） | Rule: Plan Review via CLI 补 next-step 标签 |
| `packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md` | 同上 | zh-CN 镜像同步 |
| `packages/osuperpowers/bin/engine/tests/runner.test.mjs` | #154 / #155 | 新增用例 |
| `packages/osuperpowers/bin/engine/tests/review.test.mjs` | --handoff PATH | 新增用例 |

**非目标**：
- 不引入新 CLI 入口（cdd-brief.mjs 不新建）
- 不修改现有 handoff schema
- 不修改上游 vendors 子模块
- 存量 `.superpowers/sdd/` 文件保留不处理（gitignore 临时文件，由用户手动清理）

---

### 2.2 `engine/lib/brief.mjs`（新增，#154）

**职责**：从 plan markdown 文件机械提取指定 task 段落，追加 `TASK_BASE`，写入 brief 文件；提供结构校验函数。消除 orchestrator（AI）读取完整 plan 并手工提取任务段落的 token 消耗。

**导出接口**：

```js
// 从 plan 提取 ### Task N: 段落（含 header），追加 TASK_BASE: <sha>，写入 outPath。
// planFile 不存在 → throw Error("plan file not found: <path>")
// task 段落不存在 → throw Error("task N not found in plan: <path>")
// git HEAD 不可取（非 git 仓库）→ throw Error("cannot resolve HEAD: not in a git repo")
export function generateBrief(planFile, taskNum, outPath, cwd)

// 校验 brief 文件含 `TASK_BASE:` 行。
// 文件不存在 → false；无 TASK_BASE: 行 → false；否则 true。
export function validateBrief(briefPath)
```

**`generateBrief` 实现要点**：

1. 读 `planFile`，按行扫描，找 `^### Task <N>:` 行（N = taskNum，精确匹配）作为段落起始
2. 收集从该行到下一个 `^### Task \d+:` 行（不含）或文件末尾的所有行
3. 调用已有 `gitRevParseHead(cwd)`（来自 `contract.mjs`）取 HEAD sha；返回 null → throw
4. 段落末尾追加一行（LF）：`\nTASK_BASE: <sha>`
5. `writeFileSync(outPath, content, "utf8")`（父目录已由 `resolveWorkspace` 保证存在）

**runner.mjs 改造**：

- **Step 2.55 变更**：移除 brief 存在性检查，仅保留 templates 目录存在性检查（不变）
- **Step 4.5（新，插在 step 4 plan backfill 之后、step 5 task-review fixed-point 之前）**：

```
// 4.5 Brief 生成 / 校验
// plan、taskNum、cwd 均为 runner.mjs 现有作用域变量（runTask 函数签名及 step 4 plan backfill 已定义）
const briefPath = env.CDD_TASK_BRIEF;
if (briefPath) {
  if (!existsSync(briefPath)) {
    // 自动生成：需要 plan 路径
    if (!plan) return finish(1, [], "brief missing and plan unavailable: cannot auto-generate brief", noExit);
    try {
      generateBrief(plan, taskNum, briefPath, cwd);
    } catch (e) {
      return finish(1, [], `brief auto-generation failed: ${e.message}`, noExit);
    }
  } else {
    // 已存在：校验结构
    if (!validateBrief(briefPath)) {
      return finish(1, [], `brief missing TASK_BASE: line: ${briefPath}`, noExit);
    }
  }
}
```

---

### 2.3 `runReviewPackage` OUTFILE 修复（#155）

**问题**：`runReviewPackage` 调用上游 `review-package` 脚本时不传第 4 参数，脚本内部 `sdd-workspace` 把 diff 写到 `.superpowers/sdd/<slug>/`，与 cdd workspace `.superpowers/cdd/<slug>/` 不一致。

**修复**：在调用前计算 OUTFILE，作为第 4 参数传入：

```js
// runner.mjs 内新增（或复用已有的 shortSha 概念）：
function shortSha(sha) { return sha.slice(0, 7); }

// runReviewPackage 内（已有 handoffPath 参数）：
const wsDir = path.dirname(handoffPath); // = workspace 目录
const outFile = path.join(wsDir, `review-${shortSha(base)}..${shortSha(head)}.diff`);
const res = await spawnCapture("bash", [reviewPkg, plan, base, head, outFile], { cwd, env });
```

`path.dirname(handoffPath)` 即 workspace 目录（`handoffPath` = `<workspace>/task-N-handoff.json`）。

---

### 2.4 `cdd-review.mjs --handoff PATH`

**目标**：spec-review / plan-review 统一输出 handoff.json（P1 Rule: Handoff Output `[Engine pending P2]` 的引擎侧实现）。

**参数解析**（追加到现有 for 循环）：

```js
case "--handoff":
  if (i + 1 >= args.length) usage();
  handoffPath = args[++i];
  break;
```

- `--handoff` 与 `--prompt` / `--template` 不互斥
- `handoffPath` 初始值为 `""`（falsy，无该参数时不写 handoff）

**handoff 写入**（在 `invokeCli` 返回后、`exitOk()` / `exitWithCode()` 之前）：

```js
if (handoffPath) {
  const data = res.ok
    ? { status: "DONE" }
    : { status: "BLOCKED", blocker: (res.stderr.split("\n")[0] || "").trim() || `cli exited ${res.code}` };
  writeHandoff(handoffPath, data);
}
```

- 复用 `contract.mjs` 的 `writeHandoff`（已有浅合并 + mkdirSync 语义）
- `import { writeHandoff } from "./lib/contract.mjs";` 追加到 cdd-review.mjs 头部 import
- **status 分层**：`"DONE"` 是 cdd-review.mjs 的**运行态信号**（表示「CLI pass 已执行，stdout 含 findings 文本」），独立于 P1 Rule: Handoff Output 定义的**质量态** `APPROVED|CHANGES_REQUESTED`。质量态由调用方 orchestrator（brainstorming / writing-plans skill）在读取 stdout findings 后判定并写入；cdd-review.mjs 作为 pass-through runner 无法解析 findings，不写质量态。两者路径相同（如 `spec-review-handoff.json`），orchestrator 后续写入会覆盖 `"DONE"`（`writeHandoff` 浅合并语义保证其他字段保留）。

**usage / help 文本更新**：

```
usage: cdd-review.mjs --harness <name> (--prompt <text> | --template <name> [--param KEY=VALUE...]) [--handoff PATH]
```

---

### 2.5 `brainstorming/SKILL.md` grilling 委托加强

**问题**：Rule: Read Sub-Skills 要求读取 grilling SKILL.md，但无明确指令要求执行其内容，AI 在实际 grilling 阶段用自身组织的提问框架（选项 A/B 列表）替代了技能指令（逐项追问 + 给出推荐答案）。

**Rule: Read Sub-Skills 追加**（在「On failure...」段落之后）：

> After reading the grilling SKILL.md, execute its instructions as the grilling framework verbatim — do not substitute with a self-organized interview format, option menus, or structured choice lists.

**Red Flags 新增**：

- `"Presents Option A / Option B choices instead of following grilling skill"` → violates Rule: Read Sub-Skills (grilling delegation); apply grilling SKILL.md instructions verbatim

**zh-CN 镜像同步**：`skills/brainstorming/SKILL.zh-CN.md` 在同一 task 内更新，遵循 Strategy A 约束。

---

### 2.6 `docs-review.md` Rule: Review Stopping — 问询改进

**问题**：Rule: Review Stopping 的 warn/nit 处置步骤为纯文本问句，未使用 `AskUserQuestion` 工具，也未提示下一步是什么。用户缺乏决策依据。

**修复内容**：当所有 pass blocker=0 后，用 `AskUserQuestion` 替换纯文本询问，两个选项为「进入下一步」和「修复 warn/nit」。修复后直接进入下一步——任何路径均不提供 Re-run 选项（若未修复任何内容，re-run 会产生相同结果；若已修复，亦直接继续，无需重跑）。

**调用方职责**：brainstorming Rule: Spec Review via CLI 和 writing-plans Rule: Plan Review via CLI 须通过注释或内联说明告知具体的 next-step 标签：
- brainstorming → next-step 标签：`"User review of spec"`
- writing-plans → next-step 标签：`"Execution Handoff"`

**docs-review.md 修改后的 Rule: Review Stopping 循环结构**：

```
① Run 3-pass review
② blocker: must fix → re-run only the failing pass → blocker=0 → continue
③ All passes blocker=0 → present warn/nit list to user (per-item selection allowed):

   AskUserQuestion with two options:
     "Proceed: <next-step>" (caller provides next-step label)
       → review complete, go to next step
     "Fix selected warns/nits"
       → fix selected items → review complete, go to next step

   Re-run is never offered after ③: re-running without changes produces identical results;
   re-running after fixes adds no value either. Blocker re-run (step ②) is the only re-run.
```

**docs-review.md 不需要 zh-CN 镜像**（纯英文文档，Strategy A；注：`docs-review.zh-CN.md` 在 P1 已创建，须在同一 task 内随英文源同步更新）。

---

## Section 3：与 Overall 的偏差

**P2 范围扩展**：
1. 新增 brainstorming/SKILL.md grilling 委托加强（来自 Overall v1.5 dogfood 发现），原 Overall 定义为纯引擎相已扩展至含 SKILL.md 修改。
2. 新增 docs-review.md Rule: Review Stopping AskUserQuestion 改进 + writing-plans/SKILL.md next-step 标签（来自 Overall v1.6 dogfood 发现）。

Overall v1.6 已同步两次扩展。

其余无跨相偏差。

---

## Section 4：下游备注

P4（模板与流程更新）修改 `brainstorming/SKILL.md` 的 Rule: Overall-Phase 节。P2 修改同文件的 Rule: Read Sub-Skills 节，两节不重叠，可并行推进，无需等待。

---

## Section 5：验收标准

| 项目 | 验收条件 |
|------|----------|
| #154 brief 生成 | `engine/lib/brief.mjs` 导出 `generateBrief` / `validateBrief`；runner.mjs step 2.55 移除 brief 存在性检查；新增 step 4.5 在 brief 不存在时调用生成，已存在时校验 `TASK_BASE:` 行 |
| #154 测试 | runner.test.mjs 新增：① 生成成功（brief 不存在 → auto-generate → 含 TASK_BASE:）；② 已有 brief 含 TASK_BASE: → pass；③ 已有 brief 缺 TASK_BASE: → BLOCKED exit 1；④ plan 不存在 → BLOCKED exit 1 |
| #155 OUTFILE | `runReviewPackage` 传第 4 参数 `<workspace>/review-<base7>..<head7>.diff` |
| #155 测试 | runner.test.mjs 验证 review-package 接收到正确 OUTFILE 路径（mock review-package 脚本捕获 $4） |
| --handoff 实现 | cdd-review.mjs 解析 `--handoff PATH`；exit 0 写 `{"status":"DONE"}`；non-0 写 `{"status":"BLOCKED","blocker":"..."}`；无 `--handoff` 时不写文件 |
| --handoff 测试 | review.test.mjs 新增：① `--handoff` + mock exit 0 → handoff 含 status DONE；② `--handoff` + mock exit 1 → handoff 含 status BLOCKED + blocker；③ 无 `--handoff` → 不写文件 |
| grilling 委托 | brainstorming/SKILL.md Rule: Read Sub-Skills 含 grilling 委托执行指令；Red Flags 含 Option A/B 替代反模式；zh-CN 同步；修改后运行 `pnpm run emit`，`emit:check` 无 drift |
| Review Stopping 问询 | docs-review.md Rule: Review Stopping 重跑询问改为 AskUserQuestion 格式（两选项：Proceed: \<next-step\> 与 Fix selected warns/nits；③ 之后不提供 Re-run）；brainstorming 和 writing-plans 规则引用处注明各自的 next-step 标签 |
| 语言架构 | SKILL.md 修改为纯英文（无中文混入）；SKILL.zh-CN.md 在同一 task 内同步更新 |
| 测试全绿 | `pnpm run validate` 全绿 |
| 兼容性 | 无新增规则与现有规则矛盾；现有测试全部通过 |

---

## Section 6：Review

Rule: Spec Review via CLI 三 pass 须全部通过后方可进入用户审阅和 writing-plans。
