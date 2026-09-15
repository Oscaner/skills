# osuperpowers 架构重构 P3 — cdd 命令面与契约收敛设计

- **Version**: v1.2 · 2026-09-14（v1.0 起草 · v1.1 spec-review r1 修正：blocker ×2 + warn ×4 + nit ×2 · v1.2 spec-review r2 修正：warn ×1 + nit ×4——overall:69 req 6 主行括注互斥、行号锚点 ×2（`lib/lifecycle/cli.mjs:7`/`:9`、`tests/task.test.mjs:128`）、用例计数 11→13、`tests/host-detection.test.mjs:2` 陈旧枚举 · **plan 期 design 回填已并入 §2.5 `lifecycle.wiring.test.mjs` 行**（overall v1.6 规则；按 P1/P2 惯例不另行 bump）：「五派生点」出处/计数不可核验 → 收敛为去计数 + 记录该偏移）
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.10](./2026-09-13-osuperpowers-overhaul-overall.md)（req 4 / req 6 / req 7）
- **Depends on**: P1 shipped（runtime 布局 `.osuperpowers/cdd` + standalone 移除，2026-09-14）；P2 shipped（docs 单根，2026-09-14）

---

## Section 0: Incremental warning

> P3 increment only（cdd 命令面与契约收敛）。Cross-phase conventions 见 [overall](./2026-09-13-osuperpowers-overhaul-overall.md)；冲突时 overall 赢。P3 →(soft) P4（research CLI 移除先行）——P4 的 skills 全面重写以本 phase 的命令面收敛结果为输入。

---

## Section 1: Constraints pointer

- 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）
- 不 commit 除非用户明确要求；changeset 逐 phase 建
- vendored 子模块不可改（`vendors/mattpocock-skills` 的 `research` skill 属其自身资产，本 phase 不触碰）
- **破坏性重构已授权**（2026-09-13 用户显式：允许破坏性变更、确保最佳实践、不留技术债务、遗留即删）——本 phase 的两处删除、级联死配置连根、backlog changeset 归并均在此授权内
- 所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；skills 改动后必跑 `pnpm run emit`
- **不改变引擎评审语义本体**（overall non-goal）：review/fix/handoff 生命周期、Stopping 判定、commit-contract、doc_hash 双签名不动；本 phase 仅收敛命令面与随删死配置

---

## Section 2: Design body

### §2.1 问题与根因

`cdd` 现暴露 6 个子命令，其中两个**零真实消费者**：

| 命令 | 实证 |
|---|---|
| `cdd brief` | engine 侧零消费者——`run-task.mjs:313-328`（F11）已在 plan finalization 自给 brief（`generateBrief` + `CDD_TASK_BRIEF` override 写/读侧同源解析 + `mkdirSync(dirname)` bootstrap），生成失败即 `RunBlocked` → BLOCKED exit 1，不静默降级 |
| `cdd research` | 唯一消费者是 `cli-research` skill，而该 skill 已判死（req 6） |

`cdd brief` 的可删性另有**在先声明**佐证：`.changeset/p5-session-report-246-orchestration-hardening.md` 正文原文——「**兼容可删**：`cdd base-branch set/get` 可用，orchestrator 旧 `cdd brief` 前置调用兼容保留、可以安全删除」；同条 changeset 亦记载「dispatch-mode 删 brief 前置步」已执行。本 phase 兑现该声明。

**删除安全性不变量**（无需新增回归测试）：`tests/task.test.mjs:94`（`implement --plan` 无前置 brief → 自给 + `TASK_BASE:`）、`:109`（`CDD_TASK_BRIEF` override 写/读同源）、`:128`（越界 → BLOCKED exit 1）已钉死该语义。

### §2.2 Grilling 决策记录

| # | 决策 | 依据 |
|---|---|---|
| Q1 | **P3 连带清 skill 面**（非「engine-only 作用域收敛」） | 用户 2026-09-14 定：`cli-research` 的删除随 P3 一并执行——「删除一个命令必须同步其唯一调用方」属删除操作的完整性，非 P4 的 skill 重写 |
| Q2 | 撤销——与 Q1 同题，内容并入 Q1 | 用户指出 |
| Q3 | **级联死配置全量连根删除** | 破坏性授权；其唯一入口即被删面，保留即不可达死代码 |
| Q4 | **加防回渗守卫，命令形 scope 全覆盖** | P1/P2 范式一致；命令形正则给 P4 的 `/mattpocock-skills:research` 会话调用留合法空间 |
| Q5 | **engine minor + osuperpowers minor**，正文显式记录「实为 breaking / engine 版本效果不落地」 | 对齐 overall P6 既定口径；把失真声明转为可追踪的 P6 复核项 |
| Q6 | **存量 backlog 全量归并**（charter「不留技术债务」） | 用户 2026-09-14 以 charter 原则定；本程序 per-phase changeset 保留（P6 复核粒度，非债务） |

### §2.3 Engine 命令面收敛（删除面清单）

**2.3.1 命令注册面** — `lib/cli/parse.mjs`：
- 删 `import { runResearch } from "./research.mjs"`（L9）与 `import { runBriefCli } from "./brief.mjs"`（L11）
- 删 `SUBCOMMAND_USAGE` 的 `research:`（L19）与 `brief:`（L20）两个键
- 删 `program.command("research")` 整块（**L83-92**：L83-84 注释 + L85 起命令 + L92 `.action(...)` 收尾 `});`）及其上方注释中 `research remains (inline action logic; no library module)` 分句（`select removed (T2)` 分句保留）
- 删 `program.command("brief")` 整块（含上方 `--- brief (delegated to lib module CLI entry…)` 注释）
- `program.description`（L39）由 `implement/review/fix/research/brief/base-branch` 收敛为 `implement/review/fix/base-branch`

**2.3.2 入口注释** — `bin/cdd.mjs`：① 头部命令清单注释（L8-9 的 `cdd research` / `cdd brief` 两行）同步删除；② 文件头 L3 的 action 枚举分句「`review/fix/research actions`」收敛为「`review/fix actions`」（L3 该行同时含 `lib/cli/*` 指向，措辞整体复核）。

**2.3.3 CLI 处理器** — 整文件删除 `lib/cli/brief.mjs`（`runBriefCli` + 直调 guard）与 `lib/cli/research.mjs`（`RESEARCH_METHODOLOGY` / `buildResearchPrompt` / `writeFindings` / `runResearch`）。二者的唯一入口都是被删的命令。

**2.3.4 保留面** — `lib/brief.mjs#generateBrief` 保留（`run-task.mjs:17` 消费）；该文件头部注释两处同步清理：① 引用已删 CLI 的段落（L5-6「CLI 处理器…已迁 lib/cli/brief.mjs」）；② L4 `validateBrief: check brief contains TASK_BASE: line.`（§2.4 删 `validateBrief` 后该行必须同删）。

### §2.4 级联死配置连根（Q3=A）

| 死配置 | 位置 | 唯一消费者 |
|---|---|---|
| `DEFAULT_TIMEOUTS.research` | `lib/lifecycle/cli.mjs:7` | `runResearch` |
| `modeEnv.research`（`CDD_RESEARCH_TIMEOUT`） | `lib/lifecycle/cli.mjs:23` | 同上 |
| `LEGACY_MODE_ENV = { research: 'RESEARCH_TIMEOUT' }` | `lib/lifecycle/cli.mjs:9` —— **整表仅此一项**，删后 map 与 `resolveTimeoutMs` 的 legacy 分支（L38-44）整段不可达 | 同上 |
| `validateBrief` | `lib/brief.mjs:27` | **零生产者**（全仓仅 `tests/brief.test.mjs` 3 例；`run-task.mjs:550` 的 brief 降级走 `finalizeHandoff` 自有判定） |

连带注释面（三处）：

- **`lib/lifecycle/cli.mjs:20`** — `// per-mode env（CDD_TASK_TIMEOUT / CDD_REVIEW_TIMEOUT / CDD_RESEARCH_TIMEOUT）契约单位为秒 ——` 枚举收敛为 `CDD_TASK_TIMEOUT / CDD_REVIEW_TIMEOUT`（**L21 的秒级契约说明整段保留**）。**本处是守卫命中面**：check 2 `/CDD_RESEARCH_TIMEOUT|RESEARCH_TIMEOUT/` 的 scope `CDD_ENGINE`（= `bin` + `lib` + `templates`）覆盖之——删表内三行后若不同步删本行，则 **live-repo 仍非零命中 → `collectStaleLexiconHits() === []`（AC4）与块 5c 红 → AC2 / AC5 不可达**。
- `lib/lifecycle/proc.mjs:176` — 「六个派发模块（run-task / run-docs / review / branch-review / fix / research）」→ 五个（**非守卫命中面**：bare `research` 刻意放行，本条属说明文字同步，不改则静默留存为陈旧注释）
- `lib/cli/review.mjs:5` — 「4 消费方（fix/parse/branch-review/research）」→ 3（同上，非守卫命中面）

### §2.5 测试面

| 动作 | 对象 |
|---|---|
| 整删 | `tests/research.test.mjs`（4 例）、`tests/cdd-research.test.mjs`（13 例） |
| 整删 | `tests/cdd.test.mjs` 的 `dry-run research → exit 0`、`brief --task --plan --output` 两用例 |
| 裁剪 | `tests/brief.test.mjs` → 仅留 `generateBrief` 家族（删 CLI 用例组、`validateBrief` 3 例、`node lib/brief.mjs 直跑` 例、以及指向已删 CLI 簇的注释） |
| 改写 | `tests/cdd.test.mjs:80` `-h → help` 断言（`/implement\|review\|fix\|research\|brief/` → 四命令形）+ 文件头 L3 注释「`select/research` 内联、`brief/contract` 模块转发」去 select/research 旧命令叙述 |
| 改写 | `tests/lifecycle.wiring.test.mjs` — ① **必需**：删 L52 `readFileSync(LIB, "cli", "research.mjs")` 与 L53-56 列表中的 `["research", research]` 项（**六派发模块 → 五**，L45 注释「六个派发模块」同步）——**不删则整文件 ENOENT 红**（§2.3.3 整删该模块）；② **说明文字同步**：文件头 L2 的「引擎五派生点」去计数（改为「引擎全派生点」，保留其同行的守卫语义「execa 直接 import 仅允许 `lib/lifecycle/proc.mjs`」）。**plan 期回填（2026-09-14，v1.6 规则）**：本条原写「P1 spec v1.3 表列 4 派生点，删 research 行后为 3」——实测该出处与计数**均不可核验**（`docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-p1-design.md` 无「派生点」表；「五派生点」实出 `docs/osuperpowers/plans/2026-09-10-session-report-246-p1.md:547`，其枚举**含** `lib/cli/research.mjs`）；且本文件真正的守卫是 `readdirSync(LIB)` + execa-import 扫描（**无计数断言**），故去计数是唯一可核验的收敛形态 |
| 改写 | `tests/host-detection.test.mjs:2` — 文件头枚举「cdd implement/review/fix/**research** no longer take a harness flag」收敛为 `cdd implement/review/fix`（**非守卫命中面**：tests 不在 check 2 scope，且裸 `research` 刻意放行，本条属说明文字同步，不改则静默留存为陈旧说明——与 §2.4 对 `lib/lifecycle/proc.mjs:176` / `lib/cli/review.mjs:5` 的同类枚举收敛同族） |
| **新增** | `tests/cli-shape.test.mjs` 追加「已退役子命令」断言 |

**新增断言取「静态集合 + 黑盒」双路**（对齐既有 `--doc` 退役先例，`cli-shape.test.mjs` 现役）：

① **静态集合** —— 断言 `lib/cli/parse.mjs` 的**顶层**命令集合恰为 `{implement, review, fix, base-branch}`。

- **首选实例断言**：`import { program } from "../lib/cli/parse.mjs"` 后 `expect(program.commands.map(c => c.name()).sort()).toEqual(["base-branch","fix","implement","review"])`。`parse.mjs` 文件头 L4 明载「本文件可被测试静态读（cli-shape），import 后无副作用」（`parseAsync` 由 bin 薄入口 `isMain` 触发）；commander 的 `program.commands` 只含**直接**子命令，嵌套的 `baseBranch.command("set")` / `("get")` 自然不入集 → 语义最牢。
- **退化为纯文本静态读**时唯一可用锚定形态：`/^(?:const \w+ = )?program\b\s*\.command\("([^"]+)"\)/gm`。三方误读全部会误判，逐一钉死：
  - `/^program\b\s*\.command\(…/gm` ✗ —— `base-branch` 经 `const baseBranch = program` + 换行 `.command("base-branch")` 注册，`program` 不在行首 → **漏收 base-branch**，删 research/brief 后集合只剩 `{implement, review, fix}`（三 ≠ 四）
  - `/\.command\("([^"]+)"\)/g`（无锚全集）✗ —— 收进嵌套 `set` / `get`，删 research/brief 后为 6：`implement / review / fix / base-branch / set / get`
  - 字面锚 `program.command(` ✗ —— 链式调用换行书写（`program\n  .command("implement")`），命中 **0** 次

② **黑盒** —— `cdd brief` / `cdd research` → unknown command **exit 2**。

### §2.6 Skill 面 — `cli-research` 删除（Q1）

`git rm -r packages/osuperpowers/skills/cli-research/` → `pnpm run emit` 自动 prune **`packages/osuperpowers/.agents/skills/osuperpowers/cli-research/SKILL.md`**（无手写清理）。

> **路径口径（必须写全仓相对路径）**：本仓根**不存在** `.agents/`（`ls -a` 无、`find` 无）——emit 产物的唯一落点是 `packages/osuperpowers/.agents/skills/osuperpowers/`，且其中 `cli-research/SKILL.md` 是 git 跟踪文件（`git ls-files packages/osuperpowers/.agents` 共 15 条）。断言若写作根相对 `.agents/skills/osuperpowers/cli-research/`，则落在**不存在的路径**上 → 恒真假通过，真实产物可在断言「通过」的同时留存。
> prune 机制成立（非缺机制，仅口径）：orchestrate prune 落 namespace 级——`osuperpowers.mjs:82-83` 对整 namespace `rmSync` + `cpSync` 重新拷贝，源技能目录删除即随之消失。

**零注册面已实测**：`packages/osuperpowers/package.json`（无 skill 枚举，目录扫描发现）/ `marketplace/source.json` / 根 `README.md` / `packages/osuperpowers/README.md` / `docs/maintainers/*.md` / `scripts/**` **以及 `packages/osuperpowers/.agents/**`（当前唯一含 `cli-research` 的注册面，由上条 emit prune 收敛）** 均无 `cli-research` 引用（emit 面除外——其内容由源派生）；`packages/osuperpowers/tests/digraph-consistency.test.mjs` 走 `readdirSync(SKILLS_DIR)` 无硬编码清单 → 目录删除后自动收敛，无需同步。

> **注册面口径补充（plan 期回填，overall v1.6 规则）**：「`scripts/**` 零引用」仅对**字符串**成立，存在一处**计数耦合**——`scripts/validate/osuperpowers.mjs:46-47` 的 `EXPECTED = 7` / `EMITTERS_LABEL = "6 emitters + init"` 是 skills **目录计数**断言（块 5b，L53/L59/L64 三处 `assert(n === EXPECTED)`）。删 `cli-research` 后目录数为 6 → 该常量须同步收敛（`EXPECTED = 6` / `EMITTERS_LABEL = "5 emitters + init"`），否则块 5b 必红、本 phase 的「`pnpm run validate` 13 块全绿」不可达。此耦合**无字符串可循**（skill 名不出现，仅计数变化）——是「零引用」自检方法的盲区，故单列。**同族第二处（T4 review-1 补充）**：`scripts/emit/osuperpowers.mjs:37` 的 `// Canonical skills list (12 emitters + init).` 是**非断言型**陈旧计数注释（其下 `skillNames` 走 `readdirSync` 目录发现，注释纯说明、无 emit 产物影响）。处置取「去数字」形（`directory-discovered`）而非再对一次数——该处每删一次 skill 就陈旧一轮，计数只在 validator 的 `EXPECTED`/`EMITTERS_LABEL` 单点维护。

**过渡态**：`cli-driven-development/SKILL.md` 磁盘版**不含** `cdd brief` 调用（其 `dispatch-mode` 步骤 1 是 review-diff 生成），故 P3 交付后 skills 面无悬空调用；该 skill 的全面重写仍归 P4。

### §2.7 防回渗守卫（Q4=A）

`scripts/validate/residue.mjs` 的 `STALE_LEXICON_CHECKS` 追加两条：

```js
// Task N（P3）：已删 cdd 子命令（命令形，非裸词——P4 可合法引入 /mattpocock-skills:research 会话调用）
{ label: "removed cdd subcommand (pre-P3)", re: /\bcdd (brief|research)\b/, scope: [...ALL_MECH_POSITIONS, ...DOC_SURFACE_TARGETS] },
{ label: "removed research timeout env", re: /CDD_RESEARCH_TIMEOUT|RESEARCH_TIMEOUT/, scope: CDD_ENGINE },
```

**命令形是设计要点**：裸 `research` 会误伤 P4 合法的 `/mattpocock-skills:research`（`vendors/mattpocock-skills/skills/engineering/research/` 实存）；裸 `brief` 会误伤**活体文本** `packages/osuperpowers/skills/cli-driven-development/SKILL.md:66` 的 `brief-dependent plan sections`。两条均为反射例，必须放行。

- 文件头注释的语义枚举同步更新（该头注释是 P4/P6 迁移终态的单一索引）。
- `scripts/validate/residue.test.mjs`：新增 describe 块——正例命中（`cdd research --brief …`、`CDD_RESEARCH_TIMEOUT=…`）+ 反射例零误报（`/mattpocock-skills:research`、`brief-dependent plan sections`、`CDD_TASK_TIMEOUT`）。字面**经字符串拼接构造**（P2 先例：守卫测试自身不得成为被守卫语汇的载体，否则全仓 grep 多出命中类）。live-repo 零残留由既有 `collectStaleLexiconHits() === []` 覆盖，不新增。

### §2.8 changeset

**8.1 本程序** — 新增一条**双包** `.changeset/p3-cdd-command-surface.md`：`@oscaner-skills/cdd-engine: minor` + `@oscaner-skills/osuperpowers: minor`（对齐 `p3-cdd-engine-overhaul.md` 的既有多包先例）。正文显式记录：**命令删除实为 breaking（semver 应为 major），但 engine changeset 的版本效果不落地**（`scripts/release/version-packages.mjs:82` 只处理 `packages/osuperpowers/package.json`；`.changeset/versioned-plugins.json = ["osuperpowers"]` 实证）→ 该项随 **P6** 统一复核。

**8.2 存量 backlog 归并（Q6）** — `.changeset/` 中 4 个历史程序的 **14 条**未消费 changeset 按 **(package × bump level)** 归并为 **6 条**面向发布的声明：

| 归并产出 | 聚合来源（14 条中的 12 条 osuperpowers / 8 条 cdd-engine 声明） |
|---|---|
| `backlog-osuperpowers-major.md` | p-zeta、p5-cdd-engine-overhaul |
| `backlog-osuperpowers-minor.md` | p-delta、p3/p4/p6-cdd-engine-overhaul、p6-report-issue-session-context、p4/p5-session-report-246 |
| `backlog-osuperpowers-patch.md` | p-epsilon、p-gamma、p6-post-dogfood-skill-fixes |
| `backlog-cdd-engine-major.md` | p-zeta、p3/p5/p6-cdd-engine-overhaul |
| `backlog-cdd-engine-minor.md` | p2-session-report-246-stopping-ref、two-seas-repair |
| `backlog-cdd-engine-patch.md` | p4-session-report-246、p5-session-report-246 |

归并要求：保留全部 `closes #NNN` 与实质内容；`"osuperpowers"` 裸包名缺陷（`p-delta` / `p-epsilon`，因 `changesetsForPlugin` 按精确名过滤而**不进 changelog 段落却被 unlink 消费** → 静默丢声明）在归并中自然消解；已过时的中间态指向（如 `p5-session-report-246` 的「兼容可删」）就地折叠，不留悬空指引。

**8.3 本程序 per-phase 保留** — `p1-cdd-runtime-layout-singleton.md` / `p2-docs-root-migration.md` / 新增 `p3-cdd-command-surface.md` 各一条不动。理由：P6 acceptance 明载「各 phase changeset 齐备无遗漏」，per-phase 粒度是 P6 的复核依据，不是技术债务。

### §2.9 overall 回填（Boundary rules）

| 表 | 变更 |
|---|---|
| Requirement inventory | `P4 \| req 6（续，skill 侧）` 行 Phase 列 **P4 → P3**；描述改为「cli-research skill 删除（随 P3 命令面收敛一并执行——删除命令必须同步其唯一调用方）」 |
| Requirement inventory · req 6 主行（overall:69） | 括注「（skill 删除归 P4）」→「（skill 删除归 P3——见 req 6 续行）」。**不改则与上一行直接互斥**：overall:69 说 skill 删除归 P4，overall:75（改后为 P3 行）说归 P3。属 §2.9 对 P4 Phase inventory 行的同族遗漏（「不改则悬空要求」） |
| Phase inventory · P3 scope | 增「+ cli-research skill 删除 + changeset 存量归并」；原「usage / README CDD CLI 表同步」**前提修正**为「usage 面（`SUBCOMMAND_USAGE` / `program.description` / `--help`）+ maintainer doc 复核」——本仓**不存在** README CDD CLI 表（根 `README.md` 仅一处 `cdd` 提及且为安装流程叙述；`packages/cdd-engine/` 无 README），唯一 CLI 面文字 `docs/maintainers/osuperpowers-plugin.md` 的 `cdd review\|fix --type spec\|plan` 节只列 review/fix，无需改 |
| Phase inventory · P3 acceptance | 「零 brief/research 残留引用（历史 plan/spec 文档除外）」**补作用域限定**：engine 机制位置 + `packages/osuperpowers/skills`（`packages/osuperpowers/.agents/` 由 emit 派生收敛，其源即 skills） |
| Phase inventory · P6 | changeset 口径行增 P3 的 osuperpowers 面 + 存量 backlog 归并复核项 |
| Phase inventory · P4（overall:90） | scope 去 `cli-research` 删除分句（「`init` 删除、`cli-research` 删除」→「`init` 删除（`cli-research` 已随 P3 删除）」）；acceptance「README / 发布面零 cli-research / init 残留」去 cli-research 项（→「README / 发布面零 init 残留」）。**不改则 P4 出现「再删一次已删物」的悬空要求** |
| Dependency graph ASCII（overall:100） | `P3 ->(soft) P4   (research CLI 移除先行，P4 删 cli-research skill)` → `P3 ->(soft) P4   (四命令面 + skill 树基线先行，P4 消费之)`。**块 12 的 ④b 只校验 P 编号 ∈ ids，不会报错**，故须显式回填 |
| Change history | 追加 v1.11 |
| File paths | 无变化 |

### §2.10 验证

- `cdd --help` 实跑：子命令集合恰为四命令
- `pnpm --filter @oscaner-skills/cdd-engine test` 全绿（删除面收敛后用例数下降属预期；**含 `tests/lifecycle.wiring.test.mjs` 的 withLifecycle 接线守卫**——§2.3.3 整删 `lib/cli/research.mjs` 后该文件不删即 ENOENT 整文件红）
- `pnpm run validate` 13 块全绿（含块 12 `overall-consistency` 于回填后的 overall 上通过、块 5c 新守卫 live-repo 零残留）
- `pnpm run emit:check` 无 drift
- `pnpm run version --dry-run` 复核：归并后 **next 版本仍为 `1.0.0`**（归并不得改变版本结果——可机器判定）

### Acceptance criteria

- **AC1** `cdd --help` 子命令集合**恰为** `{implement, review, fix, base-branch}`：`lib/cli/parse.mjs` **顶层**命令静态集合断言——首选 `program.commands.map(c => c.name())`（见 §2.5 ①；`base-branch` 经 `const baseBranch = program` 换行链式注册，纯文本正则须用 `/^(?:const \w+ = )?program\b\s*\.command\("([^"]+)"\)/gm` 才能收全，无锚全集正则与字面锚均误判）+ 黑盒 `cdd brief` / `cdd research` → unknown command exit 2
- **AC2** engine 机制位置 `packages/cdd-engine/{bin,lib,templates}` 零残留：`cdd brief` / `cdd research` / `CDD_RESEARCH_TIMEOUT` / `RESEARCH_TIMEOUT` / `validateBrief` / `LEGACY_MODE_ENV` / `lib/cli/brief.mjs` / `lib/cli/research.mjs`。**`tests` 面另口径**（不与 §2.5 ② 互斥）：仅 `validateBrief` / `LEGACY_MODE_ENV` / `lib/cli/brief.mjs` / `lib/cli/research.mjs` 四项符号/文件面零残留；**命令字面 `cdd brief` / `cdd research` 允许且必须存在于 `tests/cli-shape.test.mjs` 的退役断言中**（守卫测试本体不得成为被守卫语汇载体的既有先例只约束 live 语汇——命令形守卫的 scope 亦刻意不含 tests）
- **AC3** `packages/osuperpowers/skills/cli-research/` 不存在；`packages/osuperpowers/.agents/skills/osuperpowers/cli-research/` 不存在（emit prune；**全仓相对路径**——根 `.agents/` 本不存在，写根相对路径会假通过）；历史 plan/spec 文档豁免
- **AC4** 新守卫：注入临时文件正例命中 + 反射例（`/mattpocock-skills:research`、`brief-dependent plan sections`）零误报 + live-repo `collectStaleLexiconHits() === []`
- **AC5** `pnpm --filter @oscaner-skills/cdd-engine test` 全绿（含 `tests/lifecycle.wiring.test.mjs`——六派发模块收敛为五后的接线守卫）；`pnpm run validate` 13 块全绿；`pnpm run emit:check` 无 drift
- **AC6** `.changeset/` 无裸包名 `"osuperpowers"`；本程序 P1/P2/P3 各一条；归并后仍含全部 `closes #NNN`；`pnpm run version --dry-run` 的 next 版本仍为 `1.0.0`
- **AC7** overall 四表同步至 v1.11，`overall-consistency`（块 12）通过

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| `cli-research` skill 删除归 P4（Requirement inventory `P4 \| req 6（续，skill 侧）`） | 移入 P3——删除命令必须同步其唯一调用方，属删除操作的完整性 | Yes — v1.11 · 2026-09-14 |
| P3 acceptance「零 brief/research 残留引用（历史 plan/spec 文档除外）」 | 作用域补限定为 engine 机制位置 + `packages/osuperpowers/skills`（`packages/osuperpowers/.agents/` 由 emit 派生收敛） | Yes — v1.11 · 2026-09-14 |
| P3 scope「usage / README CDD CLI 表同步」 | 本仓不存在 README CDD CLI 表 → 收敛为 usage 面 + maintainer doc 复核 | Yes — v1.11 · 2026-09-14 |
| P6「逐 phase changeset 复核（P1–P3 engine patch/minor、P4/P5 osuperpowers minor）」 | P3 现触及 osuperpowers（skill 删除）；新增存量 backlog 归并复核项 | Yes — v1.11 · 2026-09-14 |
| engine changeset 版本效果（P2 遗留 follow-up） | P3 记 minor 并在 changeset 正文显式记录「实为 breaking / 版本效果不落地」→ 随 P6 统一复核 | 否（P6 已有该 follow-up 登记，本 phase 仅补强证据） |

---

## Section 4: Notes for downstream

- **P4（skills 全面重写）**：本 phase 交付后 skills 侧零 `cdd brief` / `cdd research` 引用，且守卫已钉死——P4 的新 skill 树不得回渗这两个命令。`/mattpocock-skills:research` 会话调用**不受影响**（守卫为命令形）。
- **P4 的 8-skill 新树**以四命令面（implement/review/fix/base-branch）为编排基元。
- **P6**：继承两项——① engine changeset 版本效果不落地（本 phase 补强证据：`versioned-plugins.json` 仅 osuperpowers）；② `packages/osuperpowers/.agents/` emit 面移除（本 phase 的 `cli-research` prune 是该面的最后一次目录级删除）。
- **P6 存量 changeset 复核**：归并后本程序 per-phase 三条 + backlog 六条，共九条待消费。

---

## Section 5: Review

Rule: Fresh-Subagent Review Passes must all pass before reaching user review and writing-plans.