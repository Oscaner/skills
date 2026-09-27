# osuperpowers 架构重构 P4 — skills 全面重写 + engine 契约面收敛 设计

- **Version**: v1.0 · 2026-09-15（起草；**plan 期 design 回填已并入 §2.5.2**——`failure_category` 入 handoff schema + `reviewStoppingGuard` 的未完成-dispatch 排除；**dev 期 design 回填已并入 §2.5.1 / §2.5.5**——用户 2026-09-16 裁定「schema 原样注入取代手写 render」+「templates 结构与命名单源」，见 Deviations；均按 P1/P2/P3 惯例不另行 bump）
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.13](./2026-09-13-osuperpowers-overhaul-overall.md)（req 3 / req 5 / req 7 / req 8 + cdd 运行根约定 + 本次新增 A/B/C/D 族）→ 本 phase 回填至 **v1.15**
- **Depends on**: P3 shipped（命令面四命令收敛 + `cli-research` 删除，PR #261 已 merge 至 develop，2026-09-15）

---

## Section 0: Incremental warning

> P4 increment only（skills 全面重写 + engine 契约面收敛）。Cross-phase conventions 见 [overall](./2026-09-13-osuperpowers-overhaul-overall.md)；冲突时 overall 赢。
> `P3 ->(soft) P4` 已满足。P4 →(soft) P5（engine 输出契约与失败类目定案后，P5 承接 report-issues 的目标流程）。

**口径（用户 2026-09-15 定）**：**overall 的「目标 skills 架构参考」是本 phase 的主体**；legacy skills **只作参考**——仅贡献三类信息：① engine 命令与 artifact 契约 ② 门禁与守卫 ③ 失败语义。legacy 的节点名、节点序列、Invariants 表、failure-mode 长表**一律不作为主体保留**。

**例外边界（精确）**：「不作为主体保留」指的是 legacy 的**载体形态**（节点名 / 节点序列 / 表格逐字），**不是**贡献类 ②③ 的**规则本体**。门禁与守卫（如 Review Stopping）、失败语义（如 legacy I7「硬依赖前序 Design spec = `Done`」）须**重新书写**入新形态——`## Invariants` 行或节点 Fail 字段；**载体换、规则不丢**。故新 skill 的 `## Invariants` 节**存续**，受 `skill-authoring.md` §4 约束（跨节点不变量 / 上限 5 / 超出降级为节点 Fail 字段），详见 §2.7.4。

---

## Section 1: Constraints pointer

- 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）
- 不 commit 除非用户明确要求；changeset 逐 phase 建
- vendored 子模块不可改（`superpowers` / `mattpocock-skills` / `impeccable` 的 skill 属其自身资产）
- **破坏性重构已授权**（用户 2026-09-13 / 2026-09-15 重复确认：允许破坏性变更、确保最佳实践、不留技术债务、遗留即删）
- 所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；skills / emit 源改动后必跑 `pnpm run emit`
- **不改变引擎评审语义本体**（overall non-goal）：review/fix/handoff 生命周期、**Review Stopping 的判据**、commit-contract、`doc_hash` 双签名不动。P4 对引擎的实质改动限定在**契约面**（输入信道 / 输出契约 / 失败类目 / 超时分类），不改判定逻辑
- **legacy 只作参考，不作主体**（用户 2026-09-15）

---

## Section 2: Design body

### §2.1 问题与根因

P4 处理的是**四类结构性根因 + 一类方法性根因**，不是四组独立修补。

| # | 根因 | 实证 |
|---|---|---|
| **R1** | **engine 有 4 套并存的 root 权威 + 7 处 `process.cwd()` 直读** | ①`gitToplevel(process.cwd())` ×5（**4 个模块 / 5 个调用点**：`cli/review.mjs:120,141` · `cli/fix.mjs:65` · `cli/branch-review.mjs:46` · `runner/run-docs.mjs:52`）②`gitToplevel(dirname(plan))`（`runner/run-task.mjs:76`）③`gitToplevel(env.CDD_WORKSPACE)`（`:82`）④`gitToplevel(dirname(doc)) ?? rootFromDocPath(doc)`（`handoff/naming.mjs:123`，**唯一能产出错误 root 的一支**）；`bin/cdd.mjs:24` 的 lifecycle 路径同病 |
| | **实测复现** | cwd=`packages/cdd-engine/` 子目录 + 仓根相对 `--spec` → `cdd review --type spec` **exit 0** 且在该子目录创建 `.osuperpowers/cdd/lifecycle.json`（gitignored → `git status` 干净 → **完全静默**）；同条件下 `cdd implement --plan` → `CDD_BLOCKED: plan file not found` exit 1（`existsSync(plan)` 对 cwd 相对串判存） |
| **R2** | **版本戳是自证循环的第三份 SOT** | `<!-- osuperpowers-version: X -->` 唯一载体 = `skills/init/SKILL.md:6`；写方 `release/version-packages.mjs:122-139`、读方 `validate/version-sync.mjs:67-79`——写回读等比，无独立信源进入；**运行时零消费者**（init 正文从不引用它）；消费者不可见（HTML 注释）；`.changeset/README.md:24` 把它列为版本同步面 |
| **R3** | **canonical 文件内部枚举三写** | `finding-meta.json`：`components`（8 项）写 **3 份**（顶层 + `bug_report` 下拉 options + `enhancement` 下拉 options）；`sessionTypes`（2 项）同样 3 份；`renderYml` 逐字序列化 `attributes.options`，**无注入** |
| **R4** | **legacy skills 承载已作废机制的立论** | `brainstorming` / `writing-plans` / `finishing` 的 `I1`/`I3`「**Read, not Skill-invoke**（Skill-invoke triggers **router interception**）」——`overrides` router 子系统**已整体删除**（#209 / P9；`version-sync.mjs:21`、`bump-chain.test.mjs:21`、`emit.test.mjs:416`、`manifests.mjs:46` 均为墓碑注释，磁盘零实现）；三处 frontmatter `description` 仍写「triggered by `/xxx` via **overrides router**」；`read-upstream` 节点的「① harness plugin 定位 ② fallback to vendored path」机制随之作废 |
| | 另一处同类 | `cli-driven-development/docs/handoff-schema.md` 自称 handoff 契约 SOT，实际权威全在 engine（`handoff-namespace.json` + `templates/schema/*.json` + `lib/handoff/finalize.mjs`），**独特内容为零**；且 **engine 源码反向引用它**（`lib/handoff/write.mjs:2,22`、`tests/contract.test.mjs:10`）——服务层依赖编排层；且仍用旧 mode 名 `task-review`，而 `residue.mjs` 的该守卫 scope 仅 `CDD_ENGINE` → **陈旧语汇在 skills 侧静默存活** |

**R5（方法性根因，R4 的推论）**：legacy 不能作主体——它的**立论会随机制演进而失真，而失真不可自检**（router 没了、I1 还在；`task-review` 改了、文档还在）。故 P4 判据为：**overall 定型流程 = 主体；legacy 只贡献 engine 契约 / 门禁 / 失败语义**。

**R6（用户 2026-09-15 补充 + #250/#260 实证）**：**handoff 是 agent（非确定性生成器）与 engine（确定性消费者）之间的跨进程契约**，而该契约在输出侧没有任何单源——与 R1（输入侧多权威）**同构**：

| 维度 | 输入侧（R1） | 输出侧（R6） |
|---|---|---|
| SOT | 4 套 root 权威 | schema 是 SOT，**但不可执行地送达 agent**（提示词里是手写的简洁版 sample） |
| 写者 | 多派生点 | **多写者**：agent 手写 JSON + engine `finalize` 手写对象字面量 |
| 不一致的检测 | 守卫断言 | **只有校验会说话，而校验的话是「丢弃整份 handoff」** |
| 失败语义 | 单信道 | **压平为 `BLOCKED` 一维**，类目全丢 |

**R6 的浓缩证据**：`blocker` 字段——engine 写侧**省略字段**（`finalize` 的 H1 `blocker:` 缺省语义）、`cdd-handoff-schema.json` 声明 `type: string`、agent 自然写 `null` → **同一契约三种表达，无人对齐**（#260[5]）。

### §2.2 Grilling 决策记录

| # | 决策 | 依据 |
|---|---|---|
| **Q1** | **单根权威**：`lib/root.mjs` 唯一（`initRoot()` 是 engine `bin`+`lib` 内**唯一** `gitToplevel(process.cwd())` 调用点，其余一律 `getRoot()`）；engine `bin`+`lib` 内 `process.cwd()` **计数断言 = 1**；**`resolveRepoRoot()` 整函数删除**（形态见 §2.4.1）；内容路径统一 `resolveDocArg`（**仓根相对**，绝对路径直用）；**不保留 cwd 相对回落**；`resolveWorkspace` 收注入 root、**删 `rootFromDocPath`**；运行时状态同源；BLOCKED message 需**清晰 + 含仓根相对形指导** | 用户选 A + 加严（"不保留 cwd 保底，有错就报。并且 message 要清晰，并且能提供相对指导建议"） |
| **Q2** | **版本戳机制整体删除 + 反向守卫**（shipped 非 emit 面零版本字面量） | 用户选 D |
| **Q3** | **cli-driven-development 取 γ**：digraph 与 overall 主干**同形**；失败语义下沉为「节点 Fail 字段 + 短 Failure Modes 表」 | 用户确认 γ |
| **Q4** | **timeout task 90 分钟（`5_400_000`）/ review 60 分钟（`3_600_000`）**；stall 兜底（方案 e）**不登记**；**后经 #260[4] 实证扩为「提升 + 分类自持 + 计数器隔离」**（见 §2.5） | 用户选 b；扩项经用户确认 |
| **Q5** | 三项进 P4 且按修正形态：①`skill-authoring.md` 重写换「**唯一执法点**」判据 ②`_docs/review.md` 删除、Stopping 入各 skill 的 **Invariants 行** ③`finding-meta` **收敛重复枚举为单源 + 渲染器注入** | 用户确认修正形态 |
| **Q6** | **P4 = 单 phase，engine-first 三段式** | 用户选 A |
| **Q7** | **`CDD_LIFECYCLE_PATH` 删净**（路径纯派生）+ 同类注入缝扫除 + `CDD_REGISTRY_PATH` 死注释清 | 用户 2026-09-15 定（"不要环境变量，减少环境变量注入，可以减少很多不可预测面"） |
| **Q8** | **统一抽象**：输入闭包（三个信道）+ 输出契约单源（对偶）；`context` canonical 数据驱动 | 用户 2026-09-15 定（"能否做统一抽象" / "所有的信息可以统一抽成一个 cdd context 概念"） |
| **Q9** | **ii**：engine 发布面收敛为**既有接口**（命令输出契约 + 命令显式管理的工件），skills **零引擎内部结构依赖** | 用户确认 ii |
| **Q10** | **族 A/B/C/D 并入 P4；族 E 留 P5** | 用户确认 |
| **口径** | **overall 定型流程为主体，legacy 仅作参考** | 用户 2026-09-15 定 |

### §2.3 统一抽象

#### §2.3.1 输入闭包（Input Closure）

> **一次 `cdd` 调用的行为，完全由它声明的接口决定。任何不在这三者之内的读取都是缺陷——要么提升为接口，要么删除。**

| 信道 | 承载 | 判据 |
|---|---|---|
| **argv** | **调用级**值：模式、目标、路径、开关 | 仅对**本次调用**有意义 |
| **git** | **事实级**值：toplevel / HEAD / 可达性 | 单一权威，只读派生 |
| **env** | **策略级**值：宿主识别 + 跨调用复用的数值配置 | 跨调用复用、无单次身份 |

**第四个信道不存在**——`cwd`（只用于定位 git 根）、路径字符串的**形状**、上一次运行的**残留文件**、engine 自己**刚写出去的值**，都不是输入。

**生成规则**：① **单源**（每事实一个信道 + 一个派生点）② **坐标系一**（仓根相对）③ **派生单向**（引擎自算值只向前流，不得回流为输入）④ **无形状推断**（只从 git 这类声明式权威推断）⑤ **隔离经边界**（测试隔离走真实边界，不在生产接口开后门缝）。

#### §2.3.2 输出契约单源（Output Contract Singularity）—— 输入闭包的边对对偶

> **所有跨边界的信息（进与出）只有一个 SOT、一个派生点、一个校验点、一个失败类目。**

1. **契约单源 + 全派生**——schema 是唯一 SOT；**提示词由 schema 渲染**；**engine 写侧从同一 schema 构造**；**校验报错派生自 schema 违规参数**（含违规键名 + JSON 指针）。消灭三处手抄：`renderHandoffStub` 的 switch、模板里的散文规则、`finalize` 的对象字面量。
2. **失败类目显式化 + 配额隔离**——把压平的 `BLOCKED` 重建为带类目的失败（见 §2.5.2），每类有独立计数器与恢复策略。
3. **写者唯一 + 序列化单点**——agent 不再手写 JSON（格式由 engine 派生的 stub/脚手架承载）；engine 写侧走同一序列化函数（`JSON.stringify` 全转义）。
4. **推论：已知事实不得在派生层被缺省覆盖**（输入闭包的直接推论）——`progress.json#plan` 上游已解析却在下游硬编码 `""` 即违反。

#### §2.3.3 `cdd context`

**一次调用的全部已知信息收敛为一个显式对象 `context`，三层**：

| 层 | 内容 | 流向 |
|---|---|---|
| **inputs** | argv · git · env（策略级） | 边界 → 内 |
| **derived** | root、slug、workspace、handoffPath、briefPath、ledgerPath、constraintsPath、findingsPath、fixedPoint | 纯函数，**不可回流** |
| **transport** | `promptParams`（模板插值）· `childEnv`（宿主 env，**零 CDD 注入**）· 工件落点 | 内 → 外 |

**canonical（声明，非状态）**：`packages/cdd-engine/templates/context-contract.json`——信道成员（argv flag / env 名+单位+默认值 / git 事实）+ 派生来源 + transport 策略。
> **命名刻意如此**：该文件是**静态只读契约数据**，与 `handoff-namespace.json` 同类，既**不是** JSON Schema（非校验器）也**不是**运行期信息（不含任何一次调用的实际值）。命名不得为 `context.json`——那会把它误读成运行时工件。

**timeouts 载荷（精确形，与 §2.4.4 / §2.5.2 / §2.8 / AC3 的白名单措辞同源）**——**2 个默认值 + 2 个 per-mode env 名 + 1 个全局覆写 env**，`CDD_CLI_TIMEOUT` **不是**第三个默认值，而是会话级**覆写**（秒契约，向上取整到 `STEP_SECONDS` 倍数）：

```json
"timeouts": {
  "defaults":        { "task": 5400000, "review": 3600000 },
  "perModeOverride": { "unit": "seconds", "env": { "task": "CDD_TASK_TIMEOUT", "review": "CDD_REVIEW_TIMEOUT" } },
  "globalOverride":  { "unit": "seconds", "env": "CDD_CLI_TIMEOUT", "stepSeconds": 1800 }
}
```

解析优先级（既有语义保持）：per-mode env → 全局 env（取整到 `stepSeconds` 倍数）→ `defaults`；非数值输入回落 `defaults`，不得静默钳成 ~1ms。

**三个概念严格分离**：

| 概念 | 形态 | 生命周期 |
|---|---|---|
| **声明（contract）** | 静态文件，随包发布，只读 | 随版本 |
| **context** | 运行时**内存**对象 | 单次调用，结束即弃 |
| **发布面** | 命令 stdout 状态块（不落盘为 context）；落盘的是 **artifact 本身**（handoff / report / evidence） | 单次派发 |

**不变量（输入闭包的推论）：运行期 context 零落盘**——engine 内零「写 context 到 workspace / repo / 任何路径」。理由有二：① **多项目并发 / 前后不同任务**下，任何持久化的「运行时上下文」必然成为**第二真相源**并**跨调用污染**；② 它与不变量③（**派生单向**）同源——**落盘的 context 只要被回读一次就变回了输入**，即 R1（幽灵根）的同一类缺陷。

> 不属本条的对比项：`progress.json` / `base-branch.json` / `report-target.json` 是**工作区状态工件**（per-workspace、**有意**跨 dispatch 保留的编排状态），与「单次调用的输入闭包」是两回事。

**消费形态**：**运行期组合**（`lib/context.mjs` 读 canonical 构造内存 context——flag 名 / env 白名单 / timeout 默认值取自 canonical，故 canonical **承重**）；**守卫**（单一 validate 块）。**不生成** `SUBCOMMAND_USAGE` 文本（避免自创模板语言），改由守卫断言「usage 内 flag ⊆ canonical argv 声明」；**亦不生成 maintainer 文档表**——按 §2.7.6 的「**唯一执法点**」判据，机检部分交守卫、文档只承载不可机检的内容，`docs/maintainers/osuperpowers-plugin.md` 以**手写**一节索引该 canonical（非 emit 产物、无 drift 面）。

### §2.4 Engine 段 A：信道收口

#### §2.4.1 `lib/root.mjs`（唯一 `process.cwd()` 调用点）

```js
// packages/cdd-engine/lib/root.mjs —— engine bin+lib 内唯一的 cwd → repoRoot 转换点。
import { gitToplevel } from "./contract/commit.mjs";
let _root = null;
export function initRoot() {
  _root = gitToplevel(process.cwd());           // ← 全 engine 唯一的 process.cwd()
  if (!_root) { process.stderr.write("CDD_BLOCKED: not in a git repository\n  Run cdd from within a git repository.\n"); process.exit(1); }
  return _root;
}
export function getRoot() {
  if (!_root) throw new Error("initRoot() not called — call from bin/cdd.mjs entry first");
  return _root;
}
```

`bin/cdd.mjs`：`const repoRoot = initRoot();` 后 `lifecyclePath = path.join(repoRoot, ".osuperpowers", "cdd", "lifecycle.json")`（**纯派生，无 `??` 兜底、无 env 缝**）。

下游：5 处 `gitToplevel(process.cwd())`（4 个模块：`cli/review.mjs` ×2 · `cli/fix.mjs` · `cli/branch-review.mjs` · `runner/run-docs.mjs`）→ `getRoot()`；`run-docs.mjs` 的 repoRoot 由上层注入；`run-task.mjs:282` 的 `opts.cwd ?? process.cwd()` 一并收口。

**`resolveRepoRoot()` 整函数删除**（目标形态的唯一声明点，消歧 Q1 / §2.4.2 / §2.5.4）：其三个输入 `{ planFile, env, ledgerPath }` 在 Q1 + §2.4.4 下**全部消失**——plan 来自 argv、env 通道删净（`CDD_LEDGER` 在「去 env 化 → `ctx`」9 项内）、ledger 由 workspace 纯派生。故不存在「新签名」，而是**调用点改写**：`run-task.mjs:304` 的 `resolveRepoRoot({ planFile, env: baseEnv, ledgerPath })` → `resolveDocArg(planFile, getRoot(), "plan")`。守卫断言**全仓零 `resolveRepoRoot`**（含 tests）。

#### §2.4.2 `resolveDocArg(arg, root, flag)`（唯一坐标系统）

- 绝对路径 → 直用（不存在 → BLOCKED）
- 否则 `path.join(root, arg)`；**不存在 → exit 1 + BLOCKED 诊断**：① `CDD_BLOCKED: --<flag> not found: <arg>` ② `Tried (against repo root <root>): <abs>` ③ `Hint: cdd resolves paths against the repo root. Verify the path is correct relative to the repo root.`
- **无 cwd 相对回落**（回落 = 第二坐标系 = 同一 bug 的下次复发）
- 拦截面：`--plan`（implement / review / fix / base-branch）· `--spec`（review / fix）· `--findings`（fix）

**退出码分类（本 phase 定案，全 engine 唯一口径）**：

| code | 语义 | 触发 |
|---|---|---|
| **0** | OK | 正常完成 / `--dry-run` / `--help` |
| **1** | **BLOCKED** | 运行期不可继续：路径不存在（本节点）· 宿主缺失 · engine 自写 BLOCKED · 计数器终态耗尽 |
| **2** | **usage + environment error** | commander 用法错误（缺参 / 未知 flag / 非整数 `--task`）· `CDD_CLI_MISSING`（cdd 可执行缺失） |
| **3** | **Review Stopping** | 对已 `APPROVED` 且 blocker=0 的 (type, ref) 重派（caller 侧） |

- **路径不存在取 1、不取 2**——与既有语义一致（现行 `RunBlocked: plan file not found` 即 exit 1，`run-task.mjs:75`）；2 专表**用法 / 环境**错，路径写错属「本次调用不可继续」而非「命令行用错」。
- **skills 不靠 code 区分具体原因**：code 只作粗分流（0/1/2/3）；具体路由读 stderr **首行前缀**（`CDD_BLOCKED:` / `CDD_CLI_MISSING:`）+ 首行正文。

#### §2.4.3 `resolveWorkspace(doc, root)` 收注入 root

签名变更（`doc` → `doc, root`）；**`rootFromDocPath` 整段删除**（含其 canonical 布局推导 + 与 `scripts/lib/doc-root.mjs` 的同步注释）——它是「按路径形状猜仓库根」的第二权威，正是幽灵根来源。

#### §2.4.4 环境面收口（γ）

**engine `bin`+`lib` 内 `process.env` 的接触面按三种形态分别收口**——三者的守卫断言不同，不得混为「直读白名单」一句：

| 形态 | 定义 | 收口后 |
|---|---|---|
| **① 取值直读** | 代码里出现 `process.env.<KEY>` 或 `env.<KEY>` 的**键名读取** | **闭集白名单**（下表枚举，共 7 键） |
| **② 整表透传** | 把 `process.env` **整个对象**交给 resolver / 子进程（不做键名读取） | **枚举点清单**，每点须在 canonical `transport.childEnv` 策略中声明；须断言「整表透传点 ⊆ 清单」 |
| **③ 宿主 env 传播** | ②的一种：传给子进程的宿主环境（供宿主 CLI 自身使用） | 保留（既有语义）；凭据剥离仍在 `proc.mjs#spawnManaged` 单点 |

**① 闭集白名单（7 键，`process.env` 取值直读 ⊆ 此集）**：

| 类 | 键 | 读取点 |
|---|---|---|
| 宿主识别 | `CURSOR_TRACE_ID` · `CLAUDE_CODE_SESSION_ID` · `AI_AGENT` | `lib/cli/shared.mjs:17-21`（`detectCurrentHarness` 单一事实源） |
| 宿主环境 | `PATH` | `lib/registry.mjs:54`（解析 cdd 可执行路径） |
| timeouts（策略级） | `CDD_CLI_TIMEOUT` · `CDD_TASK_TIMEOUT` · `CDD_REVIEW_TIMEOUT` | `lib/lifecycle/cli.mjs:20-38`（`resolveTimeoutMs` 单一 resolver） |

> 注：`AI_AGENT` 与 `CLAUDE_CODE_SESSION_ID` 同属 claude 判定的输入（`detectCurrentHarness` 读三者，非两者）。

**② 整表透传 / 宿主 env 传播点（全枚举，P4 交付面 8 处；守卫断言「整表透传点 ⊆ 本清单」）**——**判定标准是形态、不是「是否读到非白名单键」**（`grep -rn "process\.env" packages/cdd-engine/{bin,lib}` 逐点分类，不留「仅此三处」这类可证伪的计数；站点按 `process.env` 出现点计，`branch-review.mjs:102` 与 `:103` 各计一点）：

| 形态 | 站点 |
|---|---|
| **取值型整表透传**（整表交给 resolver/检测器，其内部只读白名单键） | `lib/runner/run-docs.mjs:76`（`resolveTimeoutMs(process.env, "review")`）· `lib/cli/branch-review.mjs:102-103`（`resolveTimeoutMs(process.env, "review")` 与 `invokeCliWithRetry(…, process.env, …)`）· `lib/cli/shared.mjs:27`（`detectCurrentHarness(process.env)`——读 3 个宿主识别键） |
| **宿主 env 传播（③，供宿主 CLI 自用，既有语义保留）** | `lib/runner/run-docs.mjs:79` · `lib/runner/run-task.mjs:283`（`opts.env ?? process.env`——子进程 base env；其上 9 个 `CDD_*` 写入随「去 env 化 → `ctx`」删除）· `lib/lifecycle/proc.mjs:72` 与 `lib/lifecycle/cli.mjs:60`（spawn 收口点的 `env ?? process.env` 默认值——凭据剥离仍在 `spawnManaged` 单点） |
| **P4 删除的整表点** | `lib/cli/parse.mjs:49` · `lib/cli/fix.mjs:32` · `lib/cli/review.mjs:161`（`{ ...process.env, ...(opts.plan ? { PLAN_FILE } : {}) }` spread 注入 → 改显式参数，见下「连带删除的残留入口」） |

**`NODE_ENV` 测试缝（规则⑤ 裁决：删）**：`lib/lifecycle/proc.mjs:29` 的 `TEST_SEAM = process.env.NODE_ENV === "test"` 是**生产接口里的后门缝**（`__registryForTest` / `__resetForTest` 随包发布、仅在测试环境有值），正是 §2.3.1 规则⑤（**隔离经边界**）所禁的形态。**裁决：与 `CDD_*` 注入缝一并删净**——测试隔离改走真实边界（`mkdtemp` 真 git 仓 + 显式 `planFile`，见下「测试脚手架改造」），不需要环境分支；删除后 `NODE_ENV` **退出白名单**（白名单为 7 键，不含 `NODE_ENV`）。

| 处置 | env | 理由 |
|---|---|---|
| **删净** | `CDD_LIFECYCLE_PATH` | 其代偿的不变量已无条件成立——`proc.mjs:207` 孤儿判定为 `ownerPid !== process.pid && !pidAlive(ownerPid)`（**foreign AND owner 确证已死**），并发同 cwd 引擎的在途组**不会被误杀**（246-P1 design v1.3 已在根因层修复）。缝是「病因已消失、疗法留在体内」。连带：删 `bin/cdd.mjs:22-23` 注释、`tests/helpers.mjs:44` 常量、**`tests/` 内该缝的全部注入点**（`helpers.mjs` 之外共 8 个 `*.test.mjs`：`base-branch` / `branch-review` / `cdd` / `cli-shape` / `docs-task` / `host-detection` / `lifecycle.wiring` / `task`） |
| **删净（测试缝）** | `NODE_ENV`（`TEST_SEAM`） | 见上「规则⑤ 裁决」 |
| **删死注释** | `CDD_REGISTRY_PATH` | `lib/registry.mjs:41` 仅注释，零 `process.env` 直读；`REG_PATH` 已是该模块导出常量 |
| **去 env 化 → `ctx`** | 9 项：`CDD_WORKSPACE` · `CDD_HANDOFF_PATH` · `CDD_MODE` · `CDD_HARNESS` · `CDD_LEDGER` · `CDD_TASK_BRIEF` · `CDD_PLAN_CONSTRAINTS` · `CDD_FINDINGS` · `CDD_TASK_REVIEW_FIXED_POINT` | **全为引擎自算派生值**（写方全在 engine，零外部输入）。传输通道由「二」（模板插值 + 子进程 env）收敛为「一」（插值）——`packages/cdd-engine/templates/` 内 `$CDD` 引用经实测为 **0**，子进程无消费方 |
| **升为 argv** | `CDD_DRY_RUN` → `--dry-run` | 信道表：dry-run 是**调用级**（本次调用是否真写工件），不跨调用复用。ambient 假成功（引擎报告 APPROVED 而零派发）是最高危的不可预测面。**作用域：program 级全局 flag**（`cdd --dry-run <subcommand> …`，在子命令**之前**）；四个子命令共用同一解析点（`lib/cli/shared.mjs#DRY_RUN()` 改读解析结果，不再读 env）；子命令后重复声明**不需要** |
| **保留** | `CDD_CLI_TIMEOUT` · `CDD_TASK_TIMEOUT` · `CDD_REVIEW_TIMEOUT` | 信道表：**策略级**（跨调用复用的数值配置，秒契约）。**2 个默认值 + 2 个 per-mode env + 1 个全局覆写 env**（`CDD_CLI_TIMEOUT` 是覆写、不是第三个默认值），精确载荷见 §2.3.3 |

**连带删除的残留入口**（γ 的必然结果）：

| 项 | 依据 |
|---|---|
| `CDD_WORKSPACE` 直设分支（`run-task.mjs:80-84, 105-106`） | 生产零 setter（15 处全在 tests）；P1 删 standalone 后已半死；Q1 后 root 由 cwd 唯一决定，workspace 纯由 `--plan` 派生 |
| `backfillPlanFromLedger` 三源 plan 的 ledger 死腿（`run-task.mjs:73, 147-150`） | **零测试 + 零可达输入**（`CDD_LEDGER` 外部设置点 = 0） |
| `PLAN_FILE` env 通道（`cli/parse.mjs:49` · `cli/fix.mjs:32` · `cli/review.mjs:161` → `run-task.mjs:72`） | `--plan` 是 **CLI 实参**经 env 转运（`runTask` 从未收到 `opts.planFile`）→ 改显式参数；`templates.mjs:131` 的 `env.PLAN_FILE` 改读参数。**注：三处形态是 `{ ...process.env, ...(opts.plan ? { PLAN_FILE } : {}) }` 的 spread 注入，不是键名直读**——故白名单断言**抓不到它**，须另有「零 spread 注入」断言（§2.8） |
| `CDD_HANDOFF_PATH` **读侧回落**（`lib/contract/commit.mjs:67`：`opts.handoffPath ?? process.env.CDD_HANDOFF_PATH ?? ""`） | 写侧已去 env 化（本表第 3 行同族），读侧 `??` 回落是**同通道的存活半截**——`opts.handoffPath` 是唯一来源，去掉 `?? process.env.CDD_HANDOFF_PATH`（否则「删信道」只删了一半，测试注入仍可穿透） |

**测试脚手架改造**：`runner.test.mjs:44-46` 的 `filteredEnv()`（剥离 `CDD_*` / `PLAN_FILE` 的补丁式防御，注释自陈「leaked `CDD_HANDOFF_PATH` etc. would cause runTask to write to real workspaces」）**删除**；用例改 `mkdtemp` **真 git 仓**（`base-branch.test.mjs:7` 现成先例）+ 显式 `planFile`；`directWorkspaceCase` 等直设分支用例随分支删除。

### §2.5 Engine 段 B：输出契约单源与失败类目

#### §2.5.1 契约单源（§2.3.2 第 1 条）

> **本小节经用户 2026-09-16 裁定修正（dev 期发现；Boundary rules 回填，overall v1.15）**：原措辞「注入内容**由 schema 全形派生**」被 T5 实现为 **schema 的手写解释器**（`stubAnnotation` / `satisfiesProp` / `patternSample` / `requiredKeys` / `stubScalar`）——task-review 实证其「忠实但仍是第二实现」：含**越权的第二校验器**（`satisfiesProp` 重实现 `enum`/`const`/`pattern`/`minimum`/`type` 判定）、**形状受限的正则展开器**（`patternSample` 只认 `^\[<char-class>\]\{n\}$`）、**漏 `items` 分支**（数组元素形状不进骨架）、并产出**违反自身 schema** 的占位值（`base: ""` 违反 `pattern: ^[0-9a-f]{40}$`；`task: 0` 违反 `minimum: 1`）。
> **裁定**：不得手写「简洁版」**也不得手写「忠实版」渲染器** → **schema 原样注入**（`JSON.stringify`）。任何 render 都不再对契约有编辑权。

| 现状 | 目标 |
|---|---|
| 提示词注入 = `renderHandoffStub` 遍历 `schema.required` + **硬编码 switch** | **注入 schema 本体**（`JSON.stringify`）——零 render、零解释器。两份 schema 的 `type` / `enum` / 嵌套形状 / `allOf` 条件约束**逐字可见** |
| 模板散文另述规则（如 `Write findings, not status — the engine derives status from findings`，与 schema `allOf` 是同一规则的**第二处陈述**） | 规则**迁入 schema 的 `description`**（现两份 schema 零 description：cdd 0/13、docs 0/8 properties，顶层亦无），随注入同行；模板散文**零重复**（**one truth**） |
| agent 写入未定义键（`review_notes`）→ `additionalProperties:false` 拒绝、报错**不含违规键名** | 允许键集可见；报错携带**违规键名 + JSON 指针**（取自校验器 `params.additionalProperty`） |
| engine 写侧手写对象字面量（`blocker` 省略）而 schema 声明 `type: string` | 写侧**从同一 schema 构造**，写者与校验者不再可能不一致 |
| — | **engine 内零手写 schema 字段清单 / 零第二校验器**（守卫，见 §2.8） |

**T5 的 renderer 由 T18 取代**——**有计划的替换，非遗留债务**：T5 交付的其余四面（归一化后重校验 · 保留 findings · 报错含违规键名 · 序列化全转义）在 T18 之后**存续**。

#### §2.5.2 失败类目化与配额隔离（§2.3.2 第 2 条）

**现状**：`run-task.mjs` 的 `timedOut = res.timedOut === true`（`:402`）是**唯一**超时判定，来源 `proc.mjs:97` 的 `res.timedOut ?? false`——**execa 语义**，引擎无自持判定。实证（#260[4]）：dispatch 在 30 分钟量级被 SIGTERM（`exit 143`），落入 `:475` 的 `agentRc !== 0 && !existsSync(handoff)` → `status: BLOCKED` + `blocker: "cli exited 143 without writing handoff"`，而 `timeoutCount` **停在 0**（`:411 if (timedOut)` 未进入）。后果：① `timeout-decision` 节点（职责正为读 `timeoutCount` 并给「调大超时」指引）**永不触发**；② 该 BLOCKED 自增 `engineRecoveryCount`（与真正执行失败**共享**的额度），两次即终态 `BLOCKED: engine-error`。

**canonical 与派生通道（AC14 的可实现前提——SOT 位置 + 通道缺一不可）**：

- **SOT 文件**：`packages/cdd-engine/templates/failure-categories.json`（与 `context-contract.json` / `handoff-namespace.json` 同类：静态只读契约数据）。**不得**并入 `context-contract.json`——后者是**信道声明**（argv/env/git 成员 + 派生来源 + transport），类目不是信道；也**不得**命名为 `context.json`（同 §2.3.3 的命名禁令）。
- **派生通道 ①（engine 运行期组合）**：`lib/failure.mjs` 读 canonical 构造类目常量（**承重**，与 `lib/context.mjs` 同形），engine 内零手写类目字符串。
- **派生通道 ②（skills 面）：守卫约束，不渲染、不注入**（round-3 finding #1 裁定）。skills 的短 Failure Modes 表**由 skill 作者手写**，守卫断言其**类目名集合 ⊆ canonical 类目集**（无新增类目、无拼写漂移）。**不采用**「emit 向 SKILL.md 注入生成块」：① 该表只有**一个消费方**（`cli-driven-development`），为一张 6 行表新增 `emit` 的**区域级**机制（`emit/check.mjs` 现为**整文件** diff，`data-driven-templates.md` 亦以「产物 = 整文件」定义）与一个 emitter，**机制成本远高于收益**；② 与 §2.7.6 的「**唯一执法点**」判据一致——机检部分交守卫，文档只承载不可机检的内容；③ P4 已背信道收口与输出契约，不再扩写 emit 基础设施。
- **守卫（§2.8 同一条目下的两条断言）**：① skills 内出现的失败类目名集合 ⊆ canonical 类目集；② 类目的**语义定义**只存 canonical——skills 只可**引用类目名**，不得复述其「是否计入 Stopping / 计数器 / 恢复策略」。

→ AC14 的「skills 不手写失败**语义**」由通道 ② 的两条守卫实现——**类目名可引用、语义定义不复述**，不再是不可实现的声明。

**目标类目表**（落 canonical，engine 与 skills 的 Failure Modes **均由其派生**）：

| 类目 | 语义 | 计入 Review Stopping | 计数器（`progress.json` 字段） | 恢复策略 / 终态 |
|---|---|---|---|---|
| `TIMEOUT` | 超时（引擎自持判定） | `no — 非 finding（dispatch 未完成）` | `timeoutCount` | 有 stdout → 重派；`>=2` / SIGKILL / 零输出 → 终态 `BLOCKED: timeout-exhausted` |
| `CONTRACT_VIOLATION` | 生成侧格式错误（**非评审失败**） | `no — 非 finding（生成侧格式错，非评审结论）` | `contractViolationCount` | **归一化后重校验**，findings **全额保留**；`>=2` → 终态 `BLOCKED: contract-violation-exhausted` |
| `ENGINE_SELF_WRITTEN` | 引擎自写 BLOCKED（本轮 dispatch **未完成**） | `no — 非 finding（dispatch 未完成）` | `engineSelfWrittenCount` | 可重派；`>=2` → 终态 `BLOCKED: engine-self-written-exhausted`；BLOCKED **首行须声明「本轮 dispatch 未完成」**（与实际控制流一致，不得表述为评审失败——B3 的修法） |
| `EXECUTION_FAILURE` | 真实执行失败 | `no — 非 finding（dispatch 未完成）` | `engineRecoveryCount` | **唯一**消耗 recovery 额度者；`<2` 重派，`>=2` 终态 `BLOCKED: engine-error` |
| `UNVERIFIABLE` | 不可验证项非空 | `no — 非 finding（不改 blocker 计数，既有语义保持）` | 无（不设计数器） | 既有语义保持 |
| `PLAN_CONFLICT` | 计划冲突 | `no — 非 finding（orchestrator STOP）` | 无（不设计数器） | 既有语义（orchestrator STOP） |

**两条口径注**：

1. **「计入 Review Stopping」列统一记法**：原表 `否` / `—` 混用（无法区分「不适用」与「未定」）→ 本表统一为 `no — <理由>`。语义上**六类均不计入** Review Stopping——Stopping 判据只读 review handoff 的 `findings[].severity === "blocker"` 计数（`blockerCount()`），而失败类目描述的是 **dispatch 结局**、不是评审结论。
2. **计数器隔离**：`contractViolationCount` / `engineSelfWrittenCount` 为**独立 `progress.json` 字段**，各持终态（见上表），**不消耗 `engineRecoveryCount` 额度**（B2 保持已解）；`engineRecoveryCount` 只被 `EXECUTION_FAILURE` 消耗。

**`counters` 的发布面（round-3 finding #2 裁定）**：`counters` 落**命令 stdout 状态块**——既有 H1 块的扩展行（`counters: timeout=<n> contract-violation=<n> engine-self-written=<n> recovery=<n>`），**不改 handoff schema**（两份 schema 的 properties 计数不变）。理由：handoff 是 **agent 写**的评审工件，计数是**引擎自持**的运行状态，二者不得混入同一契约——混入即把「生成侧的契约」与「引擎侧的状态」再度耦合，正是 R6 要根治的形态。取值来源 = `progress.json` 的四个字段（`timeoutCount` / `contractViolationCount` / `engineSelfWrittenCount` / `engineRecoveryCount`）；skills 只读该输出行，**不读 `progress.json`**（AC5）。

**`failure_category` 落 handoff schema（plan 期回填，overall v1.6 规则）**：上条「不改 handoff schema」**只约束 `counters`**；**失败类目必须进 schema**——理由是它与 `counters` 性质相反：**类目描述的是「本轮 dispatch 的结局」**，属 handoff 契约的一部分（生成侧与引擎侧都要表达），而计数是引擎自持的运行状态。

- 两份 schema（`cdd-handoff-schema.json` / `docs-handoff-schema.json`）的 `properties` 各增 `failure_category`（`enum` = 六类，可选；缺省 = agent 正常产出 → 非失败）。
- **`additionalProperties: false` 前提**：schema 是 SOT，新增键必须同步入 schema，否则引擎自写的 handoff 会被自身校验拒绝。
- **B3 的机制修法（#250[8]）**：`reviewStoppingGuard` 的 `prev` 判定增一条排除——`prev.failure_category ∈ { ENGINE_SELF_WRITTEN, CONTRACT_VIOLATION }` → 该轮**视为未完成的 dispatch**，**不触发 exit 3**，重派可正常进行。这是**唯一**使 `ENGINE_SELF_WRITTEN` 的「计入 Review Stopping = no」在控制流上成立的位置——仅写文案不足以修 B3。

→ 一次解掉 B1（超时未识别）/ B2（计数器共享）/ B3（自写 BLOCKED 指引与 Stopping 矛盾，#250[8]）/ B4（cap 后无合规重试，#250[2]）/ A4（校验失败丢弃 findings）。

**超时判定自持**：引擎侧计时 + 对 `code === 143` / signal 终止的分类，**不再单点依赖 `res.timedOut`**。

**默认值**：`DEFAULT_TIMEOUTS = { task: 5_400_000, review: 3_600_000 }`（task 90 / review 60 分钟）；`STEP_SECONDS = 1800` 与秒契约不变。

> **stall 兜底（方案 e）已考虑未采纳**：以「stdout 无进展 N 分钟即判 TIMEOUT」解耦「长任务」与「挂死」——不采纳理由：属新增引擎 lifecycle 机制（撞 overall non-goal），且会与本 phase 已背的 engine 重构叠加。仅记录备选。

#### §2.5.3 写者唯一与序列化（§2.3.2 第 3 条）

`#250[1]`：handoff 的 `summary` 含未转义中文引号 → 标准 JSON 解析失败（两次实证）。根因：写者不止一个（agent 手写 + engine 写），而格式保证只在 engine 侧。→ agent 侧改由**engine 派生的 stub/脚手架**承载格式；engine 侧统一 `JSON.stringify` 全转义；补 schema 校验单测（回拾 #219）。

#### §2.5.4 `progress.json#plan` 透传（§2.3.2 第 4 条 / `#260[2]`）

`lib/state/progress.mjs` 的 `migrateIfNeeded(progressDir)` 无 plan 参数，「两者都不存在」分支硬编码 `createEmptyProgress("")`；而 `--plan` 在上游**已解析出**真实 plan（Q1 后该解析由 `resolveDocArg(planFile, getRoot(), "plan")` 承接）——**路径在上游可得，却在 progress 初始化时被丢弃**（`createEmptyProgress(plan)` 本身支持真实 plan，故该参数在此路径上是死参数）。后果：report-issue 的 program chain **首跳即断**，`resolve-destination` 恒 fail-open 退化到 session 通道 → program 通道永不触发。→ `migrateIfNeeded` 增 plan 参数并透传；补断言 `progress.json#plan` 与 `--plan` 一致。

#### §2.5.5 templates 结构与命名单源（用户 2026-09-16 裁定；overall v1.15）

**实证现状——4 层不一致**：

| 层 | 现状 |
|---|---|
| **段名** | 同一概念**三种名**：`Handoff Output`（`task/fix.md` · `review/doc-fix.md`）· `Handoff`（`review/review.md`）· **无独立段**（`task/implement.md`） |
| **段序** | **两套**：`review/review.md` = `Return contract` → `Handoff` → `Self-validate`；`task/fix.md` = `Handoff Output` → `Return` |
| **Return 段** | **名两种**（`Return (H1 — stdout only)` / `Return contract`）+ **`review/doc-fix.md` 完全缺失**；`Self-validate` 仅 `review/review.md` 有 |
| **标题形** | **四种**：`CDD implement — CLI session` · `CDD fix — CLI session` · `CDD review — {{TYPE}} ({{LENS_GUIDE}})` · `Docs Fix — CLI session` |
| **命名** | schema 前缀**三种**（`cdd-` 产品缩写 / `docs-` 作用域名 / `handoff-namespace.json` 无前缀）；**目录分组错位**——`doc-fix.md`（docs 面的 **fix**）住在 `review/` |

**目标骨架**（所有模板同构；**功能差异只允许出现在 `## Instructions`**）：

```
# <Title>
## Instructions      ← 唯一功能差异段
## Handoff           ← 共享壳（一份）
## Return            ← 共享壳（一份）
```

| 收敛项 | 形态 |
|---|---|
| `## Handoff` 壳 | schema **原样注入**（§2.5.1）+ HARD GATE（写盘先于 return）+ 派发类型差异经参数注入；**`Self-validate` 并入本段**，不再独立成段 |
| `## Return` 壳 | H1 四行（task 族）或 JSON return（docs 族），经参数注入；**`review/doc-fix.md` 补齐** |
| 段序 | 统一 `Instructions → Handoff → Return`（消除 review.md 的 Return-先-于-Handoff） |
| **命名** | schema 前缀统一为**作用域名**（`cdd-handoff-schema.json` → **`task-handoff-schema.json`**，与 `docs-handoff-schema.json` 同法）；`review/doc-fix.md` 迁出 `review/`，模板目录与 (op,type) 派发面对齐 |
| **描述** | 两份 schema 的 `description` 承接写协议规则；模板散文**零重复** |

**收益（one truth）**：Handoff Rules 由「模板内多地维护、可各自漂移」变为「**schema 单点声明 + 随注入同行**」——改契约只改 schema。

### §2.6 单源收敛与删除

#### §2.6.1 `finding-meta.json` 枚举单源化（R3）

canonical 顶层 `components` / `sessionTypes` 为**唯一来源**；form 定义内**不再写 `options`**（只留 `id` + 标签）；**单一渲染器** `packages/osuperpowers/scripts/report-templates.mjs:60`（`renderYml`）在渲染 dropdown 时**注入**枚举——不存在「两份实现需对齐」的同步面；emit 侧 `scripts/emit/issue-templates.mjs:34` 是**唯一消费方**（锚点见 §2.6.4 行 3–4）。**round-trip 保证**：`emit:check` + `issue-templates.test.mjs` 两阶段 round-trip **机械证明 `.github/ISSUE_TEMPLATE/*.yml` 渲染结果字节不变**。

**枚举取值同步归 P4（口径裁定，取代 round-1 blocker #1 的相反建议）**：P4 单源化**同时**同步取值——删 `osuperpowers:init`、加 3 个新 spec-writer skill（`report-issue` **保留旧名**，改名归 P5）。与父文档同向，逐字核对：overall v1.14 P5 行（`overall.md:95`）为「finding-meta.json components 更新（**改名一处**——`init` 移除与 3 个新 skill **已由 P4 单源化时同步**）」——即 **P5 只做改名一处、P4 承担另两处取值更新**，本 spec 与 overall 无口径分歧（§2.9 P5 行同步注记）。这是唯一自洽解：① P4 删除 `init` skill → 枚举若仍列 `osuperpowers:init`，即为**悬空数据**（违反「遗留即删」）；② P4 新建 3 个 skill → 枚举若不列即为**不完整**。

**因此「渲染字节不变」在 P4 的口径收窄为**：**同一 canonical 枚举输入 → 同一字节**（证明单源化重构行为中性）；而 `.github/ISSUE_TEMPLATE/*.yml` 的**内容**因取值同步而**确实变更**——预期之内，由 `pnpm run emit` 重渲染、由 `emit:check` 固化。**两条断言并不互斥**：前者约束渲染器重构，后者记录取值同步。

#### §2.6.2 init 删除 + 版本戳机制删除（R2）

| 动作 | 对象 |
|---|---|
| 删目录 | `packages/osuperpowers/skills/init/`（含版本戳 marker） |
| 删写方 | `scripts/release/version-packages.mjs:122-139` 整个 stamp 循环 |
| 删读方 | `scripts/validate/version-sync.mjs:67-79` 整个 init stamp 块 |
| 同步文档 | `.changeset/README.md:24` |
| 版本真相 | `package.json`（canonical）+ `.claude-plugin` / `.cursor-plugin` / `marketplace`（emit 产物，**消费者实际读的发布面**） |
| **反向守卫** | shipped 非 emit 面（`skills/**`、插件 README）**零版本字面量** |

**init 的两项职责去向**（overall §决策注：`init` 功能 = cdd PATH 检测 + 安装指引，安装指引 = marketplace 原生）：

| 职责 | 去向 |
|---|---|
| marketplace 安装指引 | `README.md` / `packages/osuperpowers/README.md` 的安装节**内联**（marketplace 原生命令）——不再存在 `/init` 入口 |
| cdd engine CLI 存在性检查 | `cli-driven-development` 的 `detect-engine` 节点：缺失 → `BLOCKED`（含 install 指引）（§2.7.3） |

**shipped 面 `/init` 引用清零（机械面，不止 `.changeset/README.md`）**——`init` 是插件安装指南，两处 shipped README 都在教用户跑它：

| 位置 | 现状 | 处置 |
|---|---|---|
| `.changeset/README.md:24` | 版本同步面列出 `skills/init/SKILL.md` 版本戳 | 随 R2 版本戳机制删除整段（本表「同步文档」行） |
| `README.md:63` | `Run /init in each project -- re-run after plugin upgrades. init guides the marketplace install and checks the cdd engine CLI.` | 改写为内联 marketplace 安装命令；引擎检查一句改指 `cli-driven-development` 的 `detect-engine` |
| `packages/osuperpowers/README.md:20` | skills 表内 `init` 行（Utility / Marketplace installation guide） | 删该行（树 6 → 8，表中不含 `init`） |
| `packages/osuperpowers/README.md:34` | 安装步骤 2 `Run /init in each project…` | 同上改写为内联 marketplace 安装 |

#### §2.6.3 `handoff-schema.md` 删除（R4 同类）

整文件删除 + **四处连带**（三处引用注释 + 一处死路径）——**引用注释一律去 cite 或改指 engine canonical**：① `lib/handoff/write.mjs:2,22` ② `tests/contract.test.mjs:10`（改指 `templates/handoff-namespace.json` 的命名/workspace 语义）③ **`lib/handoff/finalize.mjs:53`**（`// findings[] roll-up → handoff status（对齐 handoff-schema「Severity → status mapping」表）`——该处 cite 的映射表随整文件删除而悬空；roll-up 规则本体即 `finalize.mjs#rollupStatus` 自身，故**去 cite**，或改指 `templates/handoff-namespace.json` 的 status 语义）；④ `docs/maintainers/osuperpowers-plugin.md:173` 的死路径（`skills/_templates/docs-handoff-schema.json` 不存在）改为 `packages/cdd-engine/templates/schema/docs-handoff-schema.json`；**守卫 scope 扩容 + 正则同步收敛**——`old mode task-review`（`scripts/validate/residue.mjs:59`）scope 由 `CDD_ENGINE` 扩到 `ALL_MECH_POSITIONS`，**同时**把无锚子串正则 `/task-review/` 改为 **`/(?<!run-)task-review/`**。

> **为何必须同时改正则**（round-2 blocker）：scope 扩到 `ALL_MECH_POSITIONS` 即含 `packages/osuperpowers/skills`，而无锚子串会命中 §2.7.3 本 phase 自己的新语汇——节点名 `E[run-task-review]` 与其 Exit 正文的 `run-task-review` ——**本 phase 的交付物必然触发本 phase 新增的守卫**（block 5c 红 → AC13「validate 全绿」在规格层面不可达）。负向后顾 `(?<!run-)` 豁免新语汇、保留「旧 mode 名（含散文形）」的全部覆盖面；裸子串守卫把「合法新语汇」与「旧 mode 名」混为一谈的问题随之消解。守卫的 wiring 面（`ci-validate.test.mjs` 断言 `grepTargets`）只钉 scope、不钉正则，故无需随迁。

#### §2.6.4 机械同步面（无字符串可循的耦合，P3 同类盲区）

| # | 位置 | 变更 | 为何易漏 |
|---|---|---|---|
| 1 | `scripts/validate/osuperpowers.mjs:46-47` | `EXPECTED = 6 → 8`；`EMITTERS_LABEL` **去枚举**（init 消失后「N emitters + init」分类失去意义） | **计数耦合，无 skill 名字符串** |
| 2 | `packages/osuperpowers/tests/digraph-consistency.test.mjs:13-17` | 删 `ent.name !== "init"` 豁免 | 反选择（不匹配才入选），改名/新增不报错 |
| 3 | `scripts/emit/issue-templates.mjs:34`（`renderYml(meta.formFieldDefs[name])` 调用点）+ `issue-templates.test.mjs:25`（`renderYml(findingMeta.formFieldDefs[n])` 调用点） | finding-meta 单源后的**消费方调用点**签名同步（该文件 `:16` 是 canonical 路径字面、测试 `:19` 是 `findingMeta` 装载行——**均非签名面**，按旧锚点读会看错位置） | 断言渲染**结果**，中间结构变化不必然暴露 |
| 4 | `packages/osuperpowers/scripts/report-templates.mjs:60`（`renderYml` **全仓唯一定义点**）+ `:19`（canonical 装载行 `const { sectionLabels, masterDef } = findingMeta;`） | **单一渲染器**：枚举注入落在 `renderYml` 内（§2.6.1）；emit（行 3）是**唯一消费方**——不存在「两份渲染器须同源」的同步面 | 无第二份实现可对照，「注入是否真的发生」不体现在产物字节上（单源化前后同字节，见 §2.6.1 round-trip 口径） |
| 5 | `packages/osuperpowers/.agents/skills/osuperpowers/{init,_docs,…}` | emit **自动 prune**（namespace 级 `rmSync` + `cpSync`） | 不需手改，但验收须确认已消失 |

### §2.7 skills 面重写

#### §2.7.1 树与形态（6 → 8）

| # | skill | 类 | 上游 session | 出口 |
|---|---|---|---|---|
| 1 | `brainstorming` | 委托 | `/superpowers:brainstorming` + `/mattpocock-skills:grilling` | → 三个 spec-writer |
| 2 | `writing-single-spec` | 委托 | `/superpowers:brainstorming`（writing-spec session） | → `writing-plans` |
| 3 | `writing-overall-spec` | 委托 | 同上 | → `/compact` 或 `brainstorming [Px]` |
| 4 | `writing-phase-spec` | 委托 | 同上 | → `writing-plans` |
| 5 | `writing-plans` | 委托 | `/superpowers:writing-plans` | → `cli-driven-development` |
| 6 | `cli-driven-development` | **原生** | —（`cdd` 命令链） | → `finishing` |
| 7 | `finishing` | 委托 | `/superpowers:finishing-a-development-branch` | overall 回填 + 关 issue |
| 8 | `report-issue` | **原生** | —（`gh` 流程） | `APPROVED` |

**命名**：第 8 个在 P4 保持 `report-issue`；改名 `report-issues` 归 P5。
**session-call 原语**：`Run a /<plugin>:<skill> session`（harness 加载该 skill 并按**其**流程执行）。**明确排除**：「读上游 SKILL.md 文件并照做」（legacy read-upstream 机制）与「读 `vendors/` 下文件」。**缺上游（插件未安装）→ BLOCKED（install 指引）**，不降级、不跳过、不内联复述。
**收敛准则（委托型）**：通用工作流 → **一个** `run-<upstream>-session` 节点；osuperpowers 特有编排（engine 调用 / artifact 落点 / 门禁）→ 展开为节点。**上游步骤不复述**。

#### §2.7.2 委托型 digraph

**brainstorming**（含 legacy 贡献的**门禁**）——门禁**模式感知**（legacy I6 逐字保留）：
```
A[run-brainstorming-session] --> B[explore-context] --> C{mode?}
C -->|new-program| G[run-grilling-session]
C -->|phase-within-program| P{phase-registered?}
P -->|no| S[run-writing-overall-spec · sync] --> P
P -->|yes| G
G --> D{scope-size?}
D -->|single| H[run-writing-single-spec]
D -->|multi| I[run-writing-overall-spec]
G --> F{phase-size?}
F -->|fit| J[run-writing-phase-spec]
F -->|oversized| I
```
- **`C{mode?}` 先于门禁**（模式判定产自 `A` 的 `/superpowers:brainstorming` session，即 legacy `read-program` 的解析职责）——`new-program` **直连 `G`、不查 inventory**：这是 legacy I6 的 `E -->|new-program mode| F` 豁免的逐字保留（去向着 §2.7.4 表）。round-2 前的图把门禁置于模式判定之前，`new-program` 必然走 `C=no → S`，等于**用「尚未存在的 overall 登记」否掉新程序本身**，并把 grilling 排到写 overall spec 之后——与 overall §brainstorming 的 new-program 定序（baseline → explore → grilling → 再定 single/multi）直接冲突，本图修正之
- `phase-registered?` = legacy `claim-phase` 门禁的**机制替换**（注册动作委托给新 skill：`S` 即原 `sync-overall` 节点的委托形）；`no` → 注册后回流 `P` 复判；Fail：inventory 不可解析 → `BLOCKED`。**I7（硬依赖前序 Design spec = `Done`）作为该节点的 Fail 判据保留**：注册新 phase 后前序 Design spec ≠ `Done` → `BLOCKED`
- `S` 与 `I` 委托同一 skill，但**角色不同、故分列两节点**（消解 round-2 指出的同 label 重复）：`S[sync]` 是**注册 + 回流**（`S --> P`，本 phase 流程继续）；`I` 是**终态书写**（本 phase 收敛为该 overall spec，无出边 → handoff `/compact` 或 `brainstorming [Px]`）
- `D{scope-size?}` 仅 `new-program` 可达、`F{phase-size?}` 仅 `phase-within-program` 可达（两条 size 判据问的不是同一件事）；**`phase-size?` 的 `fit` 支不含「phase scope 变更」分支**——该步骤移入 `writing-phase-spec` 内部（骨架图的 `B2{scope changed?}` 节点），偏差已在 Section 3 登记
- `A` 缺失 → `BLOCKED (install superpowers)`；`G` 缺失 → `BLOCKED (install mattpocock-skills)`
- 删除：`read-upstream` / `read-sub-skills` / `read-program` / `propose-*` / `present-design` / `user-approves?` / `charter-approves?` / `write-spec` / `spec-review?` / `commit-spec` / `overall-spec?` 及其机制说明
  > 「删除」指**离开本 skill 的图**，不是消失：`write-spec` / `spec-review?` / `commit-spec` / `overall-spec?` 的职责移入被委托的三个 spec-writer（下表骨架的 `C` / `D-E-F` / `H`）。本 skill 只保留门禁与路由。

**writing-single-spec / writing-overall-spec / writing-phase-spec** —— **同一骨架**（三个 SKILL.md 各自内嵌同一张 mermaid 图，节点定义各写各的）：

```
A[run-writing-spec-session] --> B[read-template] --> B2{scope changed?}
B2 -->|yes| G[sync-overall] --> C[author-spec]
B2 -->|no| C[author-spec]
C[author-spec] --> D[spec-review] --> E{blocker=0?}
E -->|no| F[fix-spec]
E -->|yes| F
F -->|entered via blocker>0| D
F -->|entered via blocker=0| H[commit-spec] --> I[handoff-spec]
```

- `A[run-writing-spec-session]` = `/superpowers:brainstorming` 的 **writing-spec session**（§2.7.1 表行 2–4；session-call 原语，非 read-upstream）；缺插件 → `BLOCKED`（install superpowers）
- `B2{scope changed?}` **只在 `writing-phase-spec` 出现**：overall v1.4 的定序（若 phase scope 有变更 → **先** Run `writing-overall-spec` sync 新 scope/changes 到上级 overall，**再** Run `writing-phase-spec`）在此**物化为该 skill 内部的首个判据节点**，使 sync 严格发生在 phase spec 落笔**之前**——round-2 前的骨架把 `G` 排在 `F[fix-spec]` 之后，「先 sync 后写」与图位互斥，本图修正之（overall 侧 brainstorming 图不含该分支，理由与登记见 Section 3）
- `I[handoff-spec]` 在每个 skill 内**物化为具体出口节点**（`handoff-writing-plans` / `handoff-compact-or-brainstorming`，见下表末行）——终态按 `skill-authoring.md` §2 记 `HANDOFF`
- `D/E/F` 即**规范评审循环**（与 §2.7.3 同形）：`cdd review --type spec --spec <path>` → `blocker=0?` → 无论哪条路径都经 `cdd fix` 修**全部** findings（blocker + warn + nit）；`blocker>0` 修后**重审**回 `D`，`blocker=0` 修后**前进不重审**（§2.7.4 Invariant）
- **四项差异（逐 skill，键到上述骨架）**：

| 骨架项 | writing-single-spec | writing-overall-spec | writing-phase-spec |
|---|---|---|---|
| **`B read-template` / `B2{scope changed?}`** | **两者皆无此节点**（直连 `A → C`；single 无模板，且无上级 overall 可 sync） | `overall-spec-template.md`（`writing-overall-spec/docs/`，§2.7.5）；**无 `B2`**（本 skill 即 overall 书写者，无上级可 sync） | `phase-spec-template.md`（`writing-phase-spec/docs/`）；`B2{scope changed?}` **有**（见下行 `G`） |
| **`G sync-overall`** | **无此节点**（直连 `A → C` 与 `F → H`；`B2` 亦无） | **无此节点**（本 skill 即 overall 书写者） | **有且仅当 phase scope 变更时**——骨架图边 `B2`（yes 支）→ `G[sync-overall]` → `C[author-spec]`：**先** sync 到上级 overall、**再**写 phase spec（overall v1.4 定序，逐字保持；round-2 前的表把 `G` 描述为末位，与图位互斥，随图修正） |
| **`D/E/F` 评审循环** | 三 skill **同形无差异**（原稿把「review-fix 循环」列为差异项，实为骨架公共部分；仅 `--spec <path>` 指向的本 skill 产物不同） | 同左 | 同左 |
| **`I handoff-spec` 目标** | `/osuperpowers:writing-plans` | `/compact` 或 `/osuperpowers:brainstorming [Px program]` | `/osuperpowers:writing-plans` |

→ AC11 的「8 skill 全节点锚定」在这三个 skill 上即「骨架图 + 上表逐项裁剪」，无未定义指涉。

**writing-plans**：`run-writing-plans-session` → `backfill-design`（发现实质性偏移时回填 design，overall v1.6 规则）→ plan review-fix 循环 → `commit-plan` → handoff `cli-driven-development`。

**finishing**：`run-finishing-session` → `backfill-overall`（phase program）→ `close-issues` → `APPROVED`。

- **收敛范围仅限真正上游的节点**：`verify-tests` / `read-base` / `present-menu` / `merge-locally` / `push-and-pr` / `force-delete` 是上游 `finishing-a-development-branch` 的流程 → 收敛为一个 `run-finishing-session` 节点（上游步骤不复述）。原稿把 `typed-discard?` 也算进「全部是上游流程」——**该判断不成立**：上游只有 `Type discard to confirm` 一句提示，**严格确认串**（exact `discard`、大小写敏感、无前后空白、其余输入回落 `present-menu` 且**不重置**菜单计数）是本 skill 的 personal rule，见下条改判。
- **personal-rule 层以 Invariants 存续**（Section 0 例外边界：**载体换、规则不丢**）：
  - **`I1 No Worktrees`**——跳过上游 worktree 检测块与 Step 6 清理；菜单固定 normal-repo 变体；worktree 态属开发前违规（不在 finishing scope）。
  - **`I2 Conventional Commits + No Attribution`**——merge commit / PR 标题走 conventional commits；PR body 仅 `## Summary` + `## Test Plan`；零 trailer / footer / inline attribution。
  - **typed-discard 严格性**（personal 部分）**降级为 `run-finishing-session` 的 Fail 字段**——不单列节点（节点形态不是规则本体，§2.7.4 同判据）。
- **零 personal rule 被丢弃**：上列均落在 §2.7.4 的 `## Invariants` 节（受 `skill-authoring.md` §4 约束：跨节点不变量 / 上限 5 / 超出降级为节点 Fail 字段）；承载形态变更已在 Section 3 登记。

#### §2.7.3 原生型

**cli-driven-development** —— digraph 与 overall 主干**同形**（Q3-γ）。fix 一律经 `cdd fix` 派发：

```
A[detect-engine] -->|found| B[determine-base] --> C[set-base-branch] --> D[implement-task]
D --> E[run-task-review] --> F{blocker=0?}
F -->|no| G[fix-task]
F -->|yes| G
G -->|entered via blocker>0| E
G -->|entered via blocker=0| H{more-tasks?}
H -->|yes| D
H -->|no| I[branch-review] --> J{blocker=0?}
J -->|no| K[branch-fix]
J -->|yes| K
K -->|entered via blocker>0| I
K -->|entered via blocker=0| L[handoff-finishing]
```

- **`fix-inline` 节点删除**（legacy 机械，不作主体保留）。三条依据：① overall 的目标流程**逐字**为 `cdd review T1-1 -> cdd fix T1-1 -> cdd review T1-2 -> …`，**全篇无 inline**；② Review Stopping 的 canonical 节点名即 **`cli-fix-all-findings`**（**CLI 形**，经 `cdd fix --type <X> --findings <handoff>`）；③ 与 charter 边界原则「**artifact 写权全归 engine**」冲突——inline 修复绕过 engine 的 fix 派发，即绕过**轮次记录与校验**
- 两条路径的差别**仅在路由**——`blocker>0`：修后**重审**；`blocker=0`：修完全部 findings 后**前进，不重审**。与 `_docs/review.md` 的 canonical 循环同形（路径继承路由）
- **两节点的 Exit 字段须逐字写明 U3**：`fix-task` / `branch-fix` 的 Exit = ①「修**全部** findings（blocker + warn + nit）——clean review 也不得跳过 fix」②「`entered via blocker>0` → 回 `run-task-review` / `branch-review` 重审；`entered via blocker=0` → 前进，不重审」。即 U3（findings 一律全额修复）在**两条路径上都执行**，图中 `E -->|yes| F` / `J -->|yes| K` 两条边即其边表达
- 失败语义入**短 Failure Modes 表**，其内容**由失败类目 canonical 派生**（§2.5.2），不进图
- **守卫**：skills 内零 `fix-inline`
  > **注（与 §2.6.3 同源）**：节点名 `run-task-review` 属**合法新语汇**——`old mode task-review` 守卫的正则已收敛为 `/(?<!run-)task-review/`，实现时**无需规避该命名**；反之若沿用裸子串正则，本 skill 的图与 Exit 正文会必然触发本 phase 新增的守卫。

**Read 字段全面改写（ii）**：`CDD_HANDOFF_PATH` → 输出契约的 `artifacts`；`progress.json#timeoutCount` → 输出契约的 `counters`；`base-branch.json` → `cdd base-branch get`。

**report-issue** —— P4 **只做形态精简**（已是节点锚定式）；**目标流程（单新 issue 聚合）+ 改名归 P5**。

**`## Invariants` 上限 5 的降级处置**（AC11 要求 8 skill 均 ≤ 5；本 skill 现存 **6 条**：`I1` / `I3` / `I4` / `I5` / `I6` / `I7`）：按 `skill-authoring.md` §4 的「跨节点 / 节点内」二分，**`I4` Never Reopen 降级为 `dedup` 节点的 Do/Exit 字段**——其规则本体（`--state all` 全量查询 · 关闭态匹配**绝不重开** · `related` = `Regression / follow-up of #NNN (closed)`）**已经逐字写在 `dedup` 的 Do 内**，Invariants 行是同规则的第二次陈述；降级即消除重复陈述，规则本体零丢失（Section 0 例外边界：**载体换、规则不丢**）。余 **5 条**保留为 Invariants 行，均**跨节点**：`I1` Confirm Gate（门禁）· `I3` Manual Trigger Only（触发面）· `I5` Renderer Determinism（渲染单点，跨 `ensure-session` / `append-comment`）· `I6` Evidence Contract（双向约束全部 finding）· `I7` Kind Enumerated（派生在 `resolve-destination`、消费在 `append-comment`）。**P5 若为目标流程新增跨节点规则，仍受上限 5 约束**——先降级、再有新增。

#### §2.7.4 `_docs/review.md` 删除 + Review Stopping 形态

- 删 `skills/_docs/`（`review.md` 唯一内容物）→ `.agents` 副本由 emit 自动 prune
- Review Stopping 落为**各 skill 的一条 Invariant 行**（非 `### Rule:` 标题）：`blocker=0 → 经 cdd fix 修完全部 findings 即停，不得重跑（engine 拦 spec/plan 同 ref；task/branch 的 ref 会随 fix commit 移动，只能靠此纪律）；修复一律经 cdd fix 派发（cli-fix-all-findings），orchestrator 不得就地编辑代替`
- 承载者：`writing-single-spec` / `writing-overall-spec` / `writing-phase-spec` / `writing-plans` / `cli-driven-development`
- **`## Invariants` 节存续**（Section 0 例外边界 → `skill-authoring.md` §4）：8 个新 skill **均保留 `## Invariants` 节**，受三层约束——**跨节点不变量**（节点内可表达的落 Do/Read/Exit/Fail）· **上限 5** · **超出降级为节点 Fail 字段**。**legacy 的 I 编号不继承**（`I1`/`I5`/`I7` 等编号与表格形态是载体，Section 0 已定「一律不作为主体保留」），**规则本体重新书写**：Review Stopping 入 Invariants（上条）；legacy I7（硬依赖前序 Design spec = `Done`）**重新表达为 `brainstorming` 的 `phase-registered?` 节点 Fail 字段**（§2.7.2 已如此落笔），**不入 Invariants 表**——以此回应「规则本体入 Invariant 行 *还是* 节点 Fail 字段」的判定：**按 `skill-authoring.md` §4 的跨节点/节点内二分裁决**，不按 legacy 编号。
- 技术契约（round 命名 / `doc_hash` / handoff 输出）→ `docs/maintainers/osuperpowers-plugin.md`（不 shipped）
- **legacy 规则去向表（全枚举，行 = legacy Invariant；「载体换、规则不丢」的机械核对面）**——Section 0 的例外边界只换载体、不丢规则，故每一条 legacy Invariant 行都必须有显式去向；round-2 前只裁定过四条（Review Stopping / I7 / finishing 的 I1·I2 + typed-discard），其余行处于「无去向」状态，本表补全：

| legacy 规则（来源 skill） | 规则本体 | P4 去向 |
|---|---|---|
| `I1` Read-not-Skill-invoke（brainstorming `I1` / writing-plans `I1` / finishing `I3`——三 skill 同一条规则，legacy 编号各异） | 上游 skill 文档只 Read、不 Skill-invoke（因 router 拦截） | **有意丢弃**（R4：立论随 `overrides` router 子系统整体删除而失效；新原语是 session-call，§2.7.1）——Section 3 有「规则丢弃」行（**1 条规则 / 3 行 legacy**） |
| `I2` Research requires user confirmation（brainstorming） | 研究代理须经用户确认方可启动 | **有意丢弃**（目标流程 overall §brainstorming 步骤 1–4 无 research 节点；无调用面即无门禁面）——Section 3 有「规则丢弃」行 |
| `I3` Design first（brainstorming） | 设计未经用户批准前零实施动作 | **Invariants 行**（跨节点：本 skill 零实施派发——不 commit 代码、不派发 `cdd implement`） |
| `I4` Spec commit discipline（brainstorming）/ `I2` Plan commit discipline（writing-plans） | spec / plan 批准即 commit，不等 dev merge | **各 skill 一条 Invariants 行**（跨节点） |
| `I5` Review Stopping（brainstorming）/ `I4`（writing-plans） | blocker=0 → 经 `cdd fix` 修完全部 findings 即停 | **Invariants 行**（本节首条，已裁定）——承载者与本节首条清单**逐字同一**：三个 spec-writer + `writing-plans` + `cli-driven-development`。**brainstorming 不在此列**：其 `spec-review?` 职责（连同该规则）已整体迁入三个 spec-writer（§2.7.2 新图无评审节点），规则随之落 spec-writer 的 Invariants 行 |
| `I6` Register-before-grill（brainstorming） | `phase-within-program` 仅对已登记 phase 跑 grilling；`new-program` **跳过 inventory 检查** | **节点门禁**（§2.7.2 图：`C{mode?}` 的 `new-program` 直连 `G` + `P{phase-registered?}`） |
| `I7` Serial-phase（brainstorming） | 注册新 phase 时校验前序 hard-dependency `Design spec = Done` | **节点 Fail 字段**（`phase-registered?` 的 Fail，§2.7.2） |
| `I8` Mode-aware flow（brainstorming） | 控制流按 mode 分支；写作文档粒度按 mode 定 | **节点 Do/Exit 字段**（`C{mode?}` + 两个 size 判据节点；粒度归三个 spec-writer 的 `C[author-spec]` Do） |
| `I1` Host Harness Autodetection（cli-driven-development） | 宿主 harness 由 engine 内部按环境标记解析，orchestrator 不传 harness 名 | **引擎机制承载**（`lib/cli/shared.mjs#detectCurrentHarness` 单一事实源，§2.4.4 ①）+ Invariants 行（skills 零 harness 名传递） |
| `I2` CLI Background Execution（cli-driven-development） | 所有 `cdd` 调用后台执行（overall v1.9 program 级强制） | **节点 Do 字段**（`implement-task` / `run-task-review` / `branch-review` 的 Do 写明「后台执行（harness `run_in_background`，否则 timeout + poll）+ 回读输出契约判 status」） |
| `I3` No --resume / -c（cli-driven-development） | 嵌套 CLI 调用不携带 `--resume` / `-c` 等历史会话 flag | **节点 Do 字段**（各派发节点 Do 的派发语句：one-shot print 模式，零 `--resume` / `-c`） |
| `I5` Three-Mode Chain Completeness（cli-driven-development） | 每 task 必经 implement → task-review →（必要时 fix），不得跳步 | **图结构承载**（§2.7.3：`D → E → F/G → H` 无 implement 直通出口）+ 守卫「skills 内零 `fix-inline`」 |
| `I6` No Controller Bypass（cli-driven-development） | engine 可用时 orchestrator 不得手写控制流绕开 engine 处理 | **Invariants 行**（「修复一律经 `cdd fix` 派发，orchestrator 不得就地编辑代替」——本节首条 Invariant 的后半句）+ §2.7.3 `fix-inline` 删除 |
| `I8` Timeout Retry with Cap（cli-driven-development） | `timeoutCount` 的上限与终止态 | **引擎机制承载**（§2.5.2 类目表 `TIMEOUT` 行 + `timeoutCount` 计数器）；skills 侧只读输出契约 `counters`（AC5） |
| `I3` Task Heading H3（writing-plans） | plan 任务标题须 `### Task N:`，否则 dispatch 期 `brief.mjs` 抽取抛错 | **节点 Do 字段**（`author-plan` 节点 Do：`### Task N:` 形 + 与 `lib/brief.mjs:10,15,17` 抽取契约同源） |
| `I1` No Worktrees / `I2` Conventional Commits + No Attribution（finishing）+ typed-discard 严格性 | 见 §2.7.2 末三条 | **已裁定**（两条 Invariants 行 + `run-finishing-session` 的 Fail 字段，§2.7.2） |

  → **零「无去向」的 legacy Invariant 行**。**计量口径**：去向以**表行**计（共 **16 条去向**），legacy 侧以 **Invariant 行**计（共 **21 行**：brainstorming `I1`–`I8` · writing-plans `I1`–`I4` · finishing `I1`–`I3` · cli-driven-development `I1`/`I2`/`I3`/`I5`/`I6`/`I8`）。
  - **14 条去向落新载体**（Invariants / 节点 Do·Exit·Fail / 图结构 / 引擎机制）——**承载 17 行 legacy Invariant**（多行合一：`I4` 行 = 2 · `I5` 行 = 2 · 末行 = 2 行 legacy + typed-discard 严格性；其余 11 行各 1）；
  - **2 条去向有意丢弃**——对应 **4 行 legacy**（`I1` Read-not-Skill-invoke 行含 brainstorming `I1` / writing-plans `I1` / finishing `I3` 三行同规则 · `I2` Research requires user confirmation 行含 brainstorming `I2`），均在 Section 3 显式登记为「规则丢弃」。
  → 后者不是遗漏，而是「载体换、规则不丢」的**例外**（其立论随机制消失而失效，R4/R5）。
- **`_docs/review.md` 引用清零（全枚举——5 处锚点链接 + 3 处裸提及，跨 3 文件）**：

| 文件:行 | 形态 |
|---|---|
| `skills/brainstorming/SKILL.md:165` | `[…](../_docs/review.md#rule-review-stopping)` 锚点链接（Do 行内） |
| `skills/brainstorming/SKILL.md:213` | 同上（Invariant `I5` 行内） |
| `skills/writing-plans/SKILL.md:40` | 同上（Do 行内） |
| `skills/writing-plans/SKILL.md:66` | 同上（Invariant `I4` 行内） |
| `skills/cli-driven-development/SKILL.md:129` | 同上（`branch-review` Exit 行内） |
| `skills/brainstorming/SKILL.md:166` | **裸提及** `_docs/review.md`（Read 行） |
| `skills/writing-plans/SKILL.md:41` | **裸提及**（Read 行） |
| `skills/cli-driven-development/SKILL.md:136` | **裸提及**（`branch-fix` Exit 行） |

  替换形态一律为**该 skill 自身的 Invariant 行／节点 Exit 字段**（上条），不留任何跨文件锚点：`_docs/` 整目录随本 phase 删除，**凡残留即 shipped 死链**。§2.8 有对应守卫行（含裸提及，机械可查）。

#### §2.7.5 模板与 docs 迁移

| 物件 | 去向 |
|---|---|
| `overall-spec-template.md` | `brainstorming/docs/` → `writing-overall-spec/docs/` |
| `phase-spec-template.md` | `brainstorming/docs/` → `writing-phase-spec/docs/` |
| `add-phase-protocol.md` | → `writing-overall-spec/docs/`（四表同步协议属 overall-spec 书写） |
| `finding-meta.json` | 留 `report-issue/templates/`（P5 随改名） |
| `cli-driven-development/docs/base-branch.md` | 保留（本 skill 方法学） |
| `cli-driven-development/docs/handoff-schema.md` | **整文件删除**（§2.6.3） |

#### §2.7.6 `skill-authoring.md` 重写（唯一执法点判据）

- **机检部分**（§2 图约定、§8 四清单）→ 一句 + 指向 `digraph-consistency.test.mjs`（**测试是执法者，文档是索引**）
- **文档只承载不可机检的内容**：session-call 原语 + 委托型/原生型两类形态 + §6 Block policy 的 session-call 语义 + §10 反模式
- **删 §7**（init 豁免）、**删 §9**（「P3 Specific」phase-scoped 临时节）
- **§4 收敛为规则**：删「上限 5 + 依 spec 授权例外」的例外口子——该例外本身违反 §10 的「Issue-Number as Behavioral Baseline」反模式

#### §2.7.7 治理测试同步

| 测试 | 处置 |
|---|---|
| `digraph-consistency.test.mjs` | 删 init 豁免 → 8 skill 全受 §8 四清单约束 |
| **`rule-reference.test.mjs`** | **整文件删除 + 三处接线同步**：① `scripts/validate/osuperpowers.mjs:70-73` 的 `subprocessStep` ② 同文件 `:6` 头注释去枚举（现列 `marker / skills-count / rule-reference (semantic) / node:test trees / wiring guard`）③ `packages/osuperpowers/tests/ci-validate.test.mjs:85-92` 的「rule-reference.test.mjs invoked via node --test」用例。依据：§2.7.4 后全仓 `### Rule:` 标题归零（唯一来源 `_docs/review.md:13` 被删），该测试退化为恒真 |
| `writing-plans-spec.test.mjs` | 保留（`**Spec:**` 头约定仍在），按新措辞同步 |
| `grep-sweep-regression.test.mjs` | **决策（替代原「复核」）：删除 `docs/cdd-reference` sweep 链中的死过滤器 `grep -v "cli-driven-development/docs/cdd-reference"`**——该路径下现存物仅 `base-branch.md` / `handoff-schema.md`，排除项已无对象（P2 的 doc-root 单源化把 `specs` / `plans` 过滤改由 `scripts/lib/doc-root.mjs#DOC_ROOT_EXCLUDE_PATHS` 派生，本过滤器不在其中）。实测**带/不带均为 0 命中**，删除零行为变化，只消除「未来死链被静默过滤」的遮蔽面。**P4 新增的 grep 面**（`fix-inline` / `_docs/` / `Read-Upstream` / `vendors/` / `CDD_*`）**不复用本测试**，统一入 §2.8 守卫（末行 + `residue.mjs`） |
| `ci-validate.test.mjs` | `grepTargets` wiring 随新守卫条目同步（断言点 `packages/osuperpowers/tests/ci-validate.test.mjs:107-114`） |
| `scripts/validate/residue.mjs` | 并入新增守卫 |

### §2.8 守卫（单一 validate 块）

| 断言 | 覆盖 |
|---|---|
| engine `bin`+`lib` 内 `process.cwd()` **计数 = 1**（且在 `lib/root.mjs`） | §2.3.1 |
| **`process.env` 取值直读 ⊆ canonical 白名单（7 键）**——宿主识别 3（`CURSOR_TRACE_ID` / `CLAUDE_CODE_SESSION_ID` / `AI_AGENT`）+ 宿主环境 1（`PATH`）+ timeouts 3（`CDD_CLI_TIMEOUT` / `CDD_TASK_TIMEOUT` / `CDD_REVIEW_TIMEOUT`，即**2 个默认值 + 2 个 per-mode env + 1 个全局覆写 env**，见 §2.3.3） | §2.3.3 / §2.4.4 |
| **整表透传点 ⊆ §2.4.4 ② 清单（8 处）** + 零 spread 注入（`{ ...process.env, … }`）+ `CDD_LIFECYCLE_PATH` / `CDD_REGISTRY_PATH` / `NODE_ENV` / `CDD_DRY_RUN` / `PLAN_FILE` / `CDD_HANDOFF_PATH` 键名零命中 | §2.4.4 |
| 路径类实参（`--plan`/`--spec`/`--findings`）全部经唯一 resolver | §2.3.1 规则② |
| 全仓零 `rootFromDocPath` / 零 `gitToplevel(process.cwd())` 副本 / 零 `resolveRepoRoot` | §2.3.1 规则①④ / §2.4.1 |
| 测试零旁路缝（`filteredEnv` 类补丁模式零命中） | §2.3.1 规则⑤ |
| engine 内零手写 handoff 对象字面量 / 零手写 schema 字段清单；零 `res.timedOut` 单点依赖 | §2.3.2 |
| engine 内零「写 context 到任意路径」调用（**运行期 context 零落盘**） | §2.3.3 |
| **`cdd --help` 各子命令 usage 内 flag ⊆ canonical `argv` 声明**（§2.3.3 的「不生成 `SUBCOMMAND_USAGE` 文本」以本断言为机械落点） | §2.3.3 |
| **`lib/context.mjs` 内 canonical 键名零硬编码**——flag / env / git 事实名一律取自 `context-contract.json`（canonical「**承重**而非装饰」的机械证据） | §2.3.3 / AC4 |
| engine `bin`+`lib` 内零「派生值经残留文件回读为输入」的调用点（读侧**全枚举白名单**：`state/progress.mjs` 计数器 · `review-loop` 的 prev-round handoff——均以**显式路径参数**为输入，不做「最近一次」扫描） | §2.3.1 规则③ / AC5 |
| skills 内失败类目名集合 ⊆ canonical 类目集；skills 复述类目语义（是否计入 Stopping / 计数器 / 恢复策略）零命中 | §2.5.2（两条断言） |
| **stdout `counters` 行（既有 H1 块的扩展行）由 canonical 类目表派生**——取值对 ⊆ `failure-categories.json` 的「计数器」列（`timeoutCount` / `contractViolationCount` / `engineSelfWrittenCount` / `engineRecoveryCount` 为唯一取值来源；`UNVERIFIABLE` / `PLAN_CONFLICT` 无计数器），engine 内零手写计数器字面量；**两份 handoff schema 的 properties 计数不变（13 / 8）**（counters 不进 handoff 契约） | §2.5.2 / §2.5.1 |
| **`(?<!-)handoff-schema` 零命中**（`residue.mjs` 新条目）——覆盖**裸名形**（如 `lib/handoff/finalize.mjs:53` 的「对齐 handoff-schema …表」cite，§2.6.3 ③）与**路径形**（`docs/handoff-schema.md` · `skills/cli-driven-development/docs/handoff-schema.md`）；**负向后顾豁免** `cdd-handoff-schema.json` / `docs-handoff-schema.json`（其 `handoff-schema` 均前接 `-`）。scope 含 `packages/cdd-engine/{bin,lib,tests}` 与 `packages/osuperpowers` | §2.6.3 |
| skills 内零 `CDD_*` env 名、零 `progress.json`、零 handoff 文件名模式 | §2.3.2 第 1 条 / ii |
| skills 内零 `fix-inline`（修复一律 `cdd fix` 形） | §2.7.3 |
| skills 内零 `vendors/` 路径、零上游 `SKILL.md` 路径、零 `Read-Upstream` 措辞 | §2.7.1 |
| **skills 面零 `_docs/` 引用（含 `#rule-review-stopping` 锚点形与裸提及）** | §2.7.4 |
| **shipped 面零 `/init` 引用**（`README.md` · `packages/osuperpowers/README.md`）**+ 仓库协作者面**（`.changeset/README.md`）——两处均零引用。**`.changeset/README.md` 不计入 shipped 面**：`contentRoot: "."` → 实际发布的是 `packages/*/`，它是本仓协作者文档（round-2 口径统一：与下一行、§2.6.2 同一 scope 定义） | §2.6.2 |
| **shipped 非 emit 面（`skills/**` · 插件 README）零版本字面量**——scope 定义与 §2.6.2 反向守卫行逐字同一（**发布面**；`.changeset/README.md` 属协作者面，不在本断言 scope 内） | §2.6.2 |
| `old mode task-review`（`residue.mjs:59`）scope 扩至 `ALL_MECH_POSITIONS`，**且正则收敛为 `/(?<!run-)task-review/`**（豁免本 phase 新语汇 `run-task-review`；wiring 面只钉 scope、不钉正则，无需随迁） | §2.6.3 |

### §2.9 overall 回填（Boundary rules，v1.13 → v1.15）

| 表 | 变更 |
|---|---|
| **Issue inventory** | 新增 `#250`（8 finding）与 `#260`（5 finding）两个 session master 及其**逐条归属**：engine 侧（A/B/C/D 族）→ P4；report-issue 侧（E 族 6 条：subject 泄漏 · analyze scope 漂移 · stdin JSON 手拼 · labels `session` 不存在 · dedup 重复拉取 · labels SOT 漂移）→ P5 |
| **Requirement inventory** | 新增 4 行：①**信道收口 / `cdd context`**（P4）②**handoff 输出契约单源与失败类目**（P4）③**超时分类自持与计数器隔离**（P4）④**`progress.json#plan` 透传**（P4）；并**把 v1.12 登记在 P6 的「templates JSON 结构面单源」上移至 P4** |
| **Phase inventory · P4** | scope / acceptance 重写（engine 契约面 + handoff 完整性 + skills 重写）；「8 skill」口径保持 |
| **Phase inventory · P5** | scope 增 E 族 6 条 finding；**`finding-meta` 取值同步口径注记**——overall 现行 P5 行括注（「**改名一处**——`init` 移除与 3 个新 skill **已由 P4 单源化时同步**」）即本 spec §2.6.1 的立场，**P5 行本体无需改**（round-2 的「引文失真」经逐字核对为已同向，§2.6.1 现按实际行文引述） |
| **Phase inventory · P6** | 移除已上移的 templates 需求；保留 `.agents/` emit 面移除 / harness 宣称收缩 / flake follow-up |
| **Dependency graph** | `P4 ->(soft) P5` 理由更新（engine 输出契约与失败类目定案后 P5 承接 report-issues 流程） |
| **Change history** | 追加 v1.15 |

### §2.10 验证

- `cdd --help` 子命令集合仍为四命令；`cdd --dry-run` 为合法 flag（**program 级全局 flag，位于子命令之前**：`cdd --dry-run <subcommand> …` 四命令皆可解析；子命令后重复声明不需要）
- **子目录回归**：cwd=子目录 + 仓根相对 `--spec` → artifact 落仓根 workspace、零幽灵 `.osuperpowers`、exit 0；**负例（路径不存在）→ exit 1 + BLOCKED 三行诊断**（§2.4.2 退出码表：1 = 运行期不可继续；2 专表用法 / 环境错）
- `pnpm --filter @oscaner-skills/cdd-engine test` 全绿（含信道收口后的新守卫与 `mkdtemp` 改造后的用例）
- `pnpm run validate` 13 块全绿 + `pnpm run emit:check` 无 drift
- `pnpm run version --dry-run`：init 删除后 stamp 同步不报错（stamp 机制已删）
- `.github/ISSUE_TEMPLATE/*.yml`：**同一 canonical 枚举输入 → 渲染字节不变**（单源化行为中性）；**内容**因取值同步（删 `osuperpowers:init` / 加 3 个新 spec-writer）而变更，由 `pnpm run emit` 重渲染 + `emit:check` 固化（见 §2.6.1）

### Acceptance criteria

- **AC1** engine `bin`+`lib` 内 `process.cwd()` **计数 = 1**（且在 `lib/root.mjs`）；零 `gitToplevel(process.cwd())` 副本；零 `rootFromDocPath`；全仓零 `resolveRepoRoot`（含 tests）
- **AC2** 子目录 + 仓根相对 `--plan`/`--spec`/`--findings` → 正常执行且 artifact 落**仓根** workspace；零幽灵 `<子目录>/.osuperpowers`；路径不存在 → **exit 1** + BLOCKED 诊断（首行 `CDD_BLOCKED: --<flag> not found: <arg>`，含仓根相对指导；退出码语义见 §2.4.2 退出码表：1 = 运行期不可继续 / 2 = 用法·环境 / 3 = Review Stopping，skills 只按 code 粗分流、具体路由读 stderr 首行前缀）
- **AC3** `process.env` 取值直读 ⊆ canonical 白名单（**7 键**：3 宿主识别 + `PATH` + 3 timeouts；见 §2.4.4 ①）+ 整表透传点 ⊆ §2.4.4 ② 清单（8 处）+ 零 spread 注入；`packages/cdd-engine/templates/` 内零 `$CDD` 引用；子进程零 `CDD_*` 注入；测试零旁路缝（`filteredEnv` 类补丁零命中）；`CDD_LIFECYCLE_PATH` / `CDD_REGISTRY_PATH` / `NODE_ENV` / `CDD_DRY_RUN` / `PLAN_FILE` / `CDD_HANDOFF_PATH` 键名零命中
- **AC4** `packages/cdd-engine/templates/context-contract.json`（**声明**）存在且被**运行期组合**消费（**承重**——`lib/context.mjs` 内 flag 名 / env 白名单 / timeout 默认值零硬编码）；**运行期 context 零落盘**——engine 内零「写 context 到任意路径」调用
- **AC5** 每次派发输出 `status`/`commits`/`artifacts`（绝对路径）/`blocker`/`counters`；engine **零回读自身输出**；**编排型 skill**（brainstorming / writing-{single,overall,phase}-spec / writing-plans / cli-driven-development / finishing）零 `CDD_*` 名、零 `progress.json`、零 handoff 文件名模式。**例外（设计内，非缺口）**：`report-issue` 的 `progress.json#plan` 读取是 **program 通道的首跳**（§2.5.4 的目的正是使其可用），不属「引擎内部结构依赖」——该处的去留归 P5 的目标流程（届时可改指命令输出契约）
- **AC6** **输出契约单源**：提示词注入的 handoff 结构由 **schema 派生**（携带允许键集 / `type` / `enum` / 嵌套形状 / `allOf` 条件）；**engine 写侧经同一 schema 构造**；校验报错含**违规键名 + JSON 指针**；engine 内零手写 schema 字段清单、零手写 handoff 对象字面量
- **AC7** **失败类目化**：`TIMEOUT` / `CONTRACT_VIOLATION` / `ENGINE_SELF_WRITTEN` / `EXECUTION_FAILURE` / `UNVERIFIABLE` / `PLAN_CONFLICT` 六类显式声明；`CONTRACT_VIOLATION` 走**归一化重校验**且 findings **全额保留**；`ENGINE_SELF_WRITTEN` **不计入 Review Stopping**；**仅 `EXECUTION_FAILURE` 消耗 recovery 额度**；超时判定**引擎自持**（零 `res.timedOut` 单点依赖）；默认 `task 90 / review 60` 分钟
- **AC8** `progress.json#plan` 与 `--plan` 入参一致（program 通道首跳可解析）
- **AC9** `init` / 版本戳 / `handoff-schema.md` / `_docs/review.md` 零残留；版本真相收敛为 `package.json` + emit 产物；shipped 非 emit 面零版本字面量
- **AC10** finding-meta 枚举**仅顶层单源** + 渲染器注入；**同一 canonical 枚举输入 → `.github/ISSUE_TEMPLATE` 渲染字节不变**（单源化行为中性）；枚举**取值已同步**（`osuperpowers:init` 移除、3 个新 spec-writer 加入；`report-issue` 保留旧名待 P5 改名）；`emit:check` 绿
- **AC11** 8 skill 全节点锚定（digraph + 节点定义）；**三个 spec-writer 按 §2.7.2 的同一骨架图逐项裁剪**（骨架 + 四项差异表，`read-template` / `scope changed?` / `sync-overall` 在不适用处显式「无此节点」——零未定义指涉）；委托型**零上游文档 read**（零 `vendors/` 路径、零上游 SKILL.md 路径、零 `Read-Upstream` 措辞；上游引用一律 `/plugin:skill` 斜杠形）；两类形态落地；**各 skill 保留 `## Invariants` 节**（跨节点不变量 / **上限 5** / 超出降级节点 Fail 字段——`report-issue` 的 `I4` Never Reopen 即按此降级为 `dedup` 节点 Do/Exit，表内余 5 条，见 §2.7.3），Review Stopping 入 Invariants（承载者 = 三个 spec-writer + `writing-plans` + `cli-driven-development`，§2.7.4）；零 `_docs/` 引用（含裸提及）；**零 `fix-inline`**（修复一律 `cdd fix` 形）；`digraph-consistency` 无 init 豁免；`rule-reference.test` 删除且三处接线移除（validate step + 头注释 + ci-validate 用例）
- **AC12** `skill-authoring.md` 按「唯一执法点」重写（session-call 语义 + 两类形态 + 删 §7/§9 + §4 例外口子收敛）
- **AC13** `pnpm run validate` 13 块全绿 + `emit:check` 无 drift + engine 套件全绿
- **AC14** **失败类目 canonical**：类目表落 `packages/cdd-engine/templates/failure-categories.json`（类目 / 是否计入 Stopping / 各自计数器 / 恢复策略）；**engine 侧从 canonical 读取**（承重，非装饰）；**skills 侧**短 Failure Modes 表的**类目名集合 ⊆ canonical**，且不复述类目语义（见 §2.5.2 通道 ② 两条断言）
- **AC15** **templates 结构与命名单源**（§2.5.5）：4 个提示词模板**同一文档骨架**（段名与段序一致：`# Title` / `## Instructions` / `## Handoff` / `## Return`；功能差异只在 `## Instructions`；`Self-validate` 并入 `## Handoff`；`review/doc-fix.md` 补齐 `## Return`）；`## Handoff` 与 `## Return` **各为一份共享壳**；**Handoff 段为 schema 原样注入**（`JSON.stringify`）；**engine 内零手写 render**（零 `stubAnnotation` / `satisfiesProp` / `patternSample` / `requiredKeys` / `stubScalar`，零第二校验器，零手写 schema 字段清单）；两份 schema **均含 `description`** 且模板内**零重复 Handoff Rules**；schema 前缀统一为作用域名（`task-handoff-schema.json` / `docs-handoff-schema.json`）；模板目录分组与 (op,type) 派发面对齐

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P4 = skills 全面重写（engine 仅 root 约定修复 + timeout） | P4 扩展为 **engine 契约面重构**（信道收口 / 输出契约 / 失败类目 / 超时分类 / `progress.plan`） | Yes — v1.14 · 2026-09-15 |
| templates JSON 结构面单源 → **P6** | 上移 **P4**（用户 2026-09-15 定；P6 不再是唯一合法触达 engine 内部的 phase） | Yes — v1.14 |
| — | **版本戳机制整体删除** + 反向守卫 | Yes — v1.14 |
| — | `finding-meta` **枚举单源化**（canonical 内三写 → 一写） | Yes — v1.14 |
| — | 原 Q4「提升 timeout 默认值」扩为「提升 + **分类自持** + 计数器隔离」（#260[4] 实证驱动） | Yes — v1.14 |
| P4「8 skill 全量 session-call 简洁模式」 | `report-issue` 只做**形态精简**；其**目标流程**归 P5 | Yes — v1.14 |
| — | `cdd 运行根约定`的修复形态定为 **engine 侧单根权威**（非 skill 侧约定） | Yes — v1.14 |
| — | 新增**统一抽象**（输入闭包 + 输出契约单源）与 `cdd context` canonical | Yes — v1.14 |
| P4 原设「提示词注入由 schema **全形派生**」 | 修正为 **schema 原样注入**（`JSON.stringify`）——T5 的「全形派生」实为 schema 的**手写解释器**（含越权的第二校验器 `satisfiesProp`、形状受限的 `patternSample`、漏 `items`、产出违反自身 schema 的占位值），用户 2026-09-16 裁定**不得手写任何 render** | Yes — v1.15 |
| — | **templates 结构与命名单源**（4 层不一致：段名三种 / 段序两套 / Return 段名两种且一处缺失 / 标题形四种；schema 前缀三种；`doc-fix.md` 目录错位）→ 同一骨架 + 共享壳 + 命名统一 + schema `description` 补全 | Yes — v1.15 |
| — | T5 的 renderer **由新增 T18 取代**（有计划的替换，非遗留债务） | Yes — v1.15 |
| — | `finishing` 的 personal-rule 层（`I1 No Worktrees` / `I2 Conventional Commits + No Attribution` / typed-discard 严格性）**换载体不丢规则**——Invariants 节 + 节点 Fail 字段承载，节点名与序列不保留 | No — 相位内承载形态，overall 无需改 |
| — | **两条 legacy 规则有意丢弃**（`Read, not Skill-invoke`：brainstorming `I1` / writing-plans `I1` / finishing `I3`；`Research requires user confirmation`：brainstorming `I2`）——前者立论随 `overrides` router 机制消失而失效（R4），后者目标流程无 research 节点。**这是「载体换、规则不丢」的例外（非遗漏）**，逐条去向见 §2.7.4 表 | No — 相位内规则处置，overall 无需改 |
| overall v1.4 定序「phase scope 有变更 → **先** Run `writing-overall-spec` sync、**再** Run `writing-phase-spec`」（表述在 §brainstorming 分支内） | 定序本体不变、**承载位下移**：该步由 brainstorming 侧整体移入 `writing-phase-spec` 内部的首个判据节点 `B2{scope changed?}`（§2.7.2 骨架）；overall §brainstorming 的文字表述仍逐字成立（「先 sync 后写」未被改动），变的只是承载位 | No — 定序语义不变，承载位属相位内实现形态 |

---

## Section 4: Notes for downstream

- **P5**：report-issues 目标流程（单新 issue 聚合）+ 改名 + E 族 6 条 finding + `finding-meta` 改名（单源后为**一处编辑**）；engine 输出契约与失败类目已由 P4 定案，P5 不再改 engine 契约面
- **P6**：`renderHandoffStub` 的 schema 派生扩展点已在 P4 段 1 显式化（**P6 不再重开 P4 产物**）；`.agents/` emit 面移除；harness 宣称收缩；flake follow-up（smoke workspace 并发 / `resolveVendorVersion`）
- **本 phase 的 CDD 自伤风险**：段 1（尤其族 A/B）未落地前，P4 自身 task 仍可能踩 `additionalProperties` 拒绝与超时误分类——**这是把段 1 排最前的直接理由**
- **下游 phase 不得回渗**：`cdd brief` / `cdd research`（P3 守卫）、`CDD_LIFECYCLE_PATH`、上游文档 read、`rootFromDocPath`、手写 schema 字段清单

---

## Section 5: Review

Rule: Single-cycle `cdd review --type spec` must pass before user review and writing-plans — single dispatch, lens-tagged findings; blocker=0 → fix all findings (`cdd fix`, blocker + warn + nit) → stop, no re-run after blocker=0 (§2.7.4).

> 措辞按 R4/R5 的判据更新：`Fresh-Subagent Review Passes` 是 `_docs/review.md` §Eliminated 已删机制（多轮 pass / fan-out）的词汇，本 phase 正是删除它的一相，spec 头不得自相矛盾。**兄弟 spec 的同一行 boilerplate 不在本 phase 触达面**（历史文档冻结），列为 follow-up。