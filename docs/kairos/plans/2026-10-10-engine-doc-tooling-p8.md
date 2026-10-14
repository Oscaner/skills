# 引擎文档工具（Engine Doc-Tooling）— P8 实施计划：`cdd board <slug>` slug 进度板 + 引擎统一 next 面（plan-graph 提级一等公民 · 文件系统唯一真源 · 全节点 verb×round 板 · next 贯穿全 face 到 skill ref）
**Spec:** [2026-10-10-engine-doc-tooling-p8-design.md](../specs/2026-10-10-engine-doc-tooling-p8-design.md)
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](../specs/2026-10-10-engine-doc-tooling-overall.md)
- **Version**: v0.1 · 2026-10-15

## Constraints

- **文件系统唯一真源（§4/§1.2）**：节点集合、artifact 存在性全来自扫描 `docs/kairos/{specs,plans}`——绝不合成盘上不存在的节点（`-p4.1` 存在而 `-p4` 缺失时 `p4.1` 直接挂程序根）· 绝不解析 overall 的 Phase inventory / File paths 声明表（该表已实测陈旧）。
- **一概念一名（§2.3/§3.1）**：`plan-graph` 作为词整体消失（display 路由 + preflight 门名）；`board` 是新词。
- **判定面单源（§5 · D26/D28 家族）**：`progress.json` 的 `rounds[verb]`（**周期号数组** · `[1,3]` 表第 1、3 轮，非计数）是唯一进度源；board 是各节点自身 `progress.json` 的单源投影，零新数据、零新判定；**只有数组形**（旧数字形不兼容 · 无兼容层）。
- **统一 next 面单源（§6 · D33）**：face 间接线从 `PIPELINE_NEXT` 一张表取（**单址 `session/next.ts`**）· C5 表（face 内）零改动 · face 间 `done` → 下一入口的渲染落 `Capsule#routeText`（**doc-class 键**判别——overall-spec vs phase-spec 由路径派生，非 `RouteTarget.type` 裸值；无 target 兜底裸词 `done`）· 接线字面**前缀省略**（`review --type branch --plan <plan>` 无 `cdd`）。
- **skill ⇄ engine 黑盒边界（§6.4 · D29 含 §10 补正）**：board 渲染 skill ref 经 `REFS[ref][host]`，**不硬编码**插件拼写；D29 剥离判据按**角色**非**形状**——入口节点的发起命令 = 例外面（author 的 skeleton bootstrap 字面保留），内部结构镜像（槽位名 / 占位标记复述）= 剥离面。**§10 已落地为 hotfix（`7a3031f6`）+ 回归 pin**，本 phase 任何改动不得再剥 author 入口字面。
- **引擎 next 止于 `/kairos:cdd-close`**（不跨 phase · 任何目标是 `cdd-design` 的推进 = 跨 program/phase，不在 next 内 · overall 闭合亦渲 `done`）。
- **纯读无副作用（§2.2）**：board 不写树 / 不写 ledger / 不派发 child；缺 slug / 无匹配文件 → exit 2。
- **零裸函数**：全局 `^export function|^function` 零命中；新增/改动面全为类成员或声明常量。
- **`next:` 字面 deliberate pin break**（破 P5 冻结契约 · 显式登记 · 实现期不被当回归拦下）· 六命令结构 pins（`toEqual` 精确列表）须重锚为七行。
- **零残留**：`plan-graph` 字面零命中 · 引擎 vitest 全绿（含 board colocated pins + 重锚 pins）· EOF 恰一 newline · 不发布（变更集归并落 pending）。

### Task 1: `plan-graph` display 路由退役 + preflight 门名 `graph`（一概念一名）
- **Objective**: 从引擎删净 `plan-graph` 词——`#runPlanGraph` 整方法删 · `#runSchema` 的 plan-graph 分支删（json 面的 `if (type === "plan-graph")` 与 skeleton 面的拒绝分支）· `projection.ts #parseTypeKey` 签名收为 `(raw: string)`（去 `planGraph` 参数 + 报错文本的 `", plan-graph"` 拼接 + 头注改写）· `SCHEMA_TYPE_KEYS` 注释的 plan-graph 旁路叙述删 · `session/preflight.ts` 两联合的 `"plan-graph"` 成员改 `"graph"`（`PreFlightGateName` + `PreFlightReason`）+ `gates.push`/verdict 字面 + 注释叙事 · `face/words.ts` 的 `planGraph` 词条键改 `graph`（模板文本不变，仅键名对齐）
- **Files**: Modify `packages/cdd-engine/src-next/face/cli.ts`（`#runPlanGraph` :756-791 删 · `#runSchema` 分支 :737-742 删 + :751 删 · 头注去 plan-graph :725）· Modify `packages/cdd-engine/src-next/face/projection.ts`（`#parseTypeKey(raw, planGraph)` :237-246 → `#parseTypeKey(raw)` · 报错文本 :242 · 头注 :234-235）· Modify `packages/cdd-engine/src-next/face/declare.ts`（`SCHEMA_TYPE_KEYS` 注释 :287-288）· Modify `packages/cdd-engine/src-next/session/preflight.ts`（`PreFlightGateName` :38 · `PreFlightReason` :43 · `gates.push` :147 · verdict :153-154 · 注释 :2/:6/:10/:142）· Modify `packages/cdd-engine/src-next/face/words.ts`（`PreflightWords.planGraph` :72 + `CAPSULE_WORDS.preflight.planGraph` :111 → `graph` + `preflightWords()` 消费点）
- **Consumes**: 无（根任务）· spec §2.3/§3.1 授权
- **Produces**: 引擎零 `plan-graph` 词 · `#parseTypeKey(raw)` 单参签名 · `PreFlightGateName`/`PreFlightReason` 均含 `"graph"` · 供 T7（plan-graph pins 重锚）
- **Steps**:
  - 删 display 路由 —— `face/cli.ts` 删 `#runPlanGraph` 整方法 + `#runSchema` 的 skeleton 拒绝分支与 json 面 `if (type === "plan-graph") return this.#runPlanGraph(...)` 行 + 头注 plan-graph 句 — checkable: `grep -n "plan-graph\|runPlanGraph" face/cli.ts` 零命中
  - 收 `#parseTypeKey` 签名 —— 签名 `#parseTypeKey(raw: string): string`（去 `planGraph: boolean`）· 删 `plan-graph` 透传行 · 报错模板去 `${planGraph ? ", plan-graph" : ""}` · 调用点去第二实参 — checkable: `grep -n "plan-graph\|planGraph" face/projection.ts` 零命中
  - 清 SCHEMA_TYPE_KEYS 注释 —— `face/declare.ts` 删「the get leaf additionally routes `plan-graph`…」旁路叙述 — checkable: `grep -n "plan-graph" face/declare.ts` 零命中
  - 门名改 `graph` —— `session/preflight.ts`：`PreFlightGateName`/`PreFlightReason` 成员 `"plan-graph"` → `"graph"` · `gates.push("plan-graph")` → `"graph"` · verdict `gate`/`reason` → `"graph"` · 注释随改 — checkable: `grep -n "plan-graph" session/preflight.ts` 零命中
  - 词条键改 —— `face/words.ts` `PreflightWords.planGraph` 键 → `graph` · `CAPSULE_WORDS.preflight` 条目名同步 · `preflightWords()` 返回字段名同步 · 模板文本逐字不变 — checkable: `grep -n "planGraph" face/words.ts` 零命中
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`（plan-graph 相关失败 pin 归 T7 重锚）
- **Acceptance**: `plan-graph` 在引擎全库（`src-next` 非注释）零命中 · `#runPlanGraph` 不存在 · `#parseTypeKey` 单参 · `PreFlightGateName`/`PreFlightReason` 均含 `"graph"` · `words.ts` 零 `planGraph` · 引擎 vitest 通过（失败 pin 留 T7）· EOF 恰一 newline
- **DependsOn**: none

### Task 2: slug → 节点树基础设施（文件系统唯一真源 · doc-root 常量 + `Workspace.docsOfSlug` + 扫描树化 + 头块读）
- **Objective**: 建 slug 定位面——`infra/runtime.ts` 的 `ENGINE_RUNTIME` 增 `docRoots`（`{ specs: "docs/kairos/specs", plans: "docs/kairos/plans" }`）· `infra/workspace.ts` 的 `Workspace` 增静态逆推导 `docsOfSlug(slug, repoRoot): SlugDocs`（相位后缀 `-p<主>(.<子>)*$` 解析）· `face/board-view.ts` 建 board 渲染类骨架 + `BoardNode` 头块事实类型 + 静态 `scanPhases(programSlug, repoRoot): string[]`（`readdirSync` 命中的 `<program>-p*` 后缀集，按点分路径排序）· artifact 头块读（复用 `contract/doc.ts` 的 `headerLines` + `markerValue` 取 `**Version**`/`**Status**`，产出 `{ version, status }`）
- **Files**: Modify `packages/cdd-engine/src-next/infra/runtime.ts`（`ENGINE_RUNTIME` :162-169 增 `docRoots`）· Modify `packages/cdd-engine/src-next/infra/workspace.ts`（`Workspace` 增 `static docsOfSlug(slug, repoRoot): SlugDocs` + `static phaseSuffixOf(slug)` · 导出 `SlugDocs`）· Create `packages/cdd-engine/src-next/face/board-view.ts`（board 类 + `BoardNode` 类型；本任务仅落 slug 解析/扫描/头块读）
- **Consumes**: 无（根任务）· spec §4 授权
- **Produces**: `ENGINE_RUNTIME.docRoots` · `Workspace.docsOfSlug(slug, repoRoot): SlugDocs`（`{ overall, spec, plan, phaseSuffix }` 各 `string | null`）· 头块 `{ version, status }` 读取面 · 扫描 `scanPhases` · 供 T4/T5 消费
- **Steps**:
  - doc-root 常量 —— `infra/runtime.ts` `ENGINE_RUNTIME` 增 `docRoots: { specs: "docs/kairos/specs", plans: "docs/kairos/plans" }`（不发明 config/env 覆盖面） — checkable: `grep -n "docRoots" infra/runtime.ts` 命中 · tsc 通过
  - `docsOfSlug` 逆推导 —— 相位后缀正则 `/(?<program>.+?)(?<suffix>-p\d+(?:\.\d+)*)$/`；程序 slug → `specs/<slug>-overall.md`（`existsSync` 决定 overall，缺失 null）· 相位 slug → overall `specs/<program>-overall.md` + spec `specs/<slug>-design.md` + plan `plans/<slug>.md`（各 `existsSync`）· 不解析 overall 声明表 — checkable: 单测 `board-view.test.ts`——`docsOfSlug("…-p7", tmpRepo)` 返 spec/plan 路径 · `docsOfSlug("…-p7.1", …)` 返 `-p7-overall` 路径 · `docsOfSlug("…-p3.2.1", …)` 后缀解析为 `-p3.2.1`
  - 扫描树化 —— `scanPhases(programSlug, repoRoot)`（`readdirSync(specs)` 命中 `<program>-p*` 后缀集，按点分路径排序）· **不合成盘上不存在的父节点** — checkable: 单测——tmpRepo 只置 `-p4.1` 无 `-p4`，`scanPhases` 返 `["-p4.1"]`，树装配把 `p4.1` 直接挂程序根
  - 头块读 —— 成员读每个存在文档的 `**Version**`/`**Status**`（复用 `parse(...).headerLines` + `markerValue`，不新造 head-parse） — checkable: 单测——给定含 `- **Version**: v0.9 · …` 与 `- **Status**: Done` 的文档，读取返 `{ version: "v0.9", status: "Done" }`
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`（新增 pins 绿）
- **Acceptance**: `ENGINE_RUNTIME.docRoots` 落位 · `Workspace.docsOfSlug` 三分支（程序 / 相位 / 深相位）正确 · 扫描不合成盘上无父节点 · 头块 `{ version, status }` 读面可用 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 3: 引擎统一 next 面——`PIPELINE_NEXT` 表 + `Capsule#routeText` 查表 + host 源模块级上提（D33 焦点）
- **Objective**: 补上引擎缺的 face 间接线面——`session/next.ts` 增 `PIPELINE_NEXT` 常量表（键 `PipelineKey = "phase-spec" | "overall-spec" | "plan" | "wave" | "branch"`，值 `PipelineEntry = {kind:"ref",ref} | {kind:"literal",literal} | {kind:"done"}`）· `face/capsule.ts` 的 `case "done"` 由 `words.routeWord("done")` 改为查 `PIPELINE_NEXT[<doc-class 键>]`（无 target → 兜底裸词 `done`）· **host 源上提为 `face/host.ts` 模块级判定**（输入内联结构类型 `Record<string,string|undefined>`，`CliLifecycle.detectHost` 改为委托）· `Capsule` 构造增持 host（第三参）· `#runWork` 以 `process.env` 调同一判定并穿线入 `Capsule`
- **Files**: Modify `packages/cdd-engine/src-next/session/next.ts`（增 `PipelineKey`/`PipelineEntry`/`PIPELINE_NEXT`）· Modify `packages/cdd-engine/src-next/face/host.ts`（增模块级 host 判定 · 输入 `Record<string,string|undefined>`）· Modify `packages/cdd-engine/src-next/face/lifecycle.ts`（`detectHost` :152-169 委托 `host.ts` · 头注）· Modify `packages/cdd-engine/src-next/face/capsule.ts`（构造增 `host` 第三参 :61-66 · `#routeText` `case "done"` :123-124 查表 + `#docClassKey(target)` + skill ref 经 `REFS[ref][host]` + 无 host 回退 claude 形）· Modify `packages/cdd-engine/src-next/face/cli.ts`（`#runWork` 构造 `Capsule` :467 传 host）
- **Consumes**: 无（根任务）· spec §6.3/§6.4 授权
- **Produces**: `PIPELINE_NEXT` 单表（`session/next.ts`）· `Capsule(words, argvChannel, host?)` 三参构造 · `case "done"` doc-class 查表渲染 · `host.ts` 模块级 host 判定 · 供 T5（board 消费 next）/T7（next pins 重锚）
- **Steps**:
  - `PIPELINE_NEXT` 表 —— `session/next.ts` 增
    ```ts
    export type PipelineKey = "phase-spec" | "overall-spec" | "plan" | "wave" | "branch";
    export type PipelineEntry =
      | { kind: "ref"; ref: string }
      | { kind: "literal"; literal: string }
      | { kind: "done" };
    export const PIPELINE_NEXT: Readonly<Record<PipelineKey, PipelineEntry>> = {
      "phase-spec": { kind: "ref", ref: "kairos:cdd-plan" },
      "overall-spec": { kind: "done" },
      plan: { kind: "ref", ref: "kairos:cdd-dev" },
      wave: { kind: "literal", literal: "review --type branch --plan <plan>" },
      branch: { kind: "ref", ref: "kairos:cdd-close" },
    };
    ```
    （wave 行字面**前缀省略**，与 capsule 逐字节一致） — checkable: `grep -n "PIPELINE_NEXT" session/next.ts` 命中 · 单测表值逐项
  - host 源上提 —— `face/host.ts` 增模块级判定（逻辑同现 `CliLifecycle.detectHost`：`["claude","cursor","pi"]` 依 `HOSTS[id].detect`，未中返 `""`）· **取内联结构类型**（不复用 `lifecycle.ts` 的 `ProcessEnvLike`——避 `host.ts`→`lifecycle.ts` 反 import 环） — checkable: `grep -n "ProcessEnvLike\|lifecycle" face/host.ts` 零命中
  - `CliLifecycle` 委托 —— `face/lifecycle.ts` `detectHost(env = this.#env)` 体改为 `return <模块级判定>(env)`（行为零变化） — checkable: 单测——`detectHost({CLAUDE_CODE_SESSION_ID:"x"}) === "claude"` 仍绿
  - Capsule 持 host + `case "done"` 查表 —— 构造 `(words, channels = {}, host = "")` · `case "done"` 调 `#doneText(target)`：`target == null` → `words.routeWord("done")`；否则 `key = #docClassKey(target)`（spec → `endsWith("-overall.md") ? "overall-spec" : "phase-spec"` · plan/wave/branch 各自 · `entry = PIPELINE_NEXT[key]`；`ref` → `REFS[entry.ref]?.[host] ?? REFS[entry.ref]?.claude ?? words.routeWord("done")`；`literal` → `<plan>` 以 `target.plan ?? "<plan>"` 替换 — checkable: 单测——无 target `{kind:"done"}` → `"done"` · `{type:"spec",id:"…-p8-design.md"}` host `"claude"` → `/kairos:cdd-plan` · host `"pi"` → `/skill:cdd-plan` · host `""` → `/kairos:cdd-plan` · `{type:"spec",id:"…-overall.md"}` → `"done"` · `{type:"wave",plan:"…p8.md"}` → `review --type branch --plan …p8.md`
  - 组合根穿线 —— `face/cli.ts` `#runWork` 构造 `Capsule` 处传 host（`new Capsule(this.#words, ARGV_CHANNEL, <模块级判定>(process.env))`） — checkable: `grep -n "new Capsule" face/cli.ts` 三参 · `grep -n "process.env" face/cli.ts` 命中
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`（C5 表零改动；next/capsule pin 变动归 T7）
- **Acceptance**: `PIPELINE_NEXT` 五键单表 · `case "done"` doc-class 查表（spec 分 overall/phase · 无 target 兜底裸词）· host 判定模块级（`host.ts` · 内联类型 · 无 `lifecycle` 反引）· `Capsule` 持 host 且无 host 回退 claude 形 · C5 表零改动 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 4: 进度面投影（全节点 verb×round 板的数据源 · 各节点 `progress.json` 单源投影）
- **Objective**: 建 board 的进度读取面——`face/board-view.ts` 的 board 类增进度投影：按节点读各自 `progress.json`（overall 读 `<program>-overall/` 工作区 · 每个 phase 读 `<program>-p<N>/` 工作区 · 波键 `"1,2,5,8"` · branch 键 `"branch"`）· 每行摊 `implement×N · review×N · fix×N`（读 `rounds[verb]` 的**周期号数组**，**非计数**）· wave 段每波一行（波链 ✔/▶/○ 复用 `TaskGraph.report(closedWaves())` + `GraphView` 同源 · 波键明细同行）· 输出 `BoardProgress` 数据面供 T5 布局消费
- **Files**: Modify `packages/cdd-engine/src-next/face/board-view.ts`（board 类增进度投影成员 · 导出 `BoardProgress`/`BoardLine` 类型）
- **Consumes**: T2（`Workspace.docsOfSlug` 定位工作区 · doc-root 常量）· spec §5 授权
- **Produces**: `BoardProgress`（每节点 `{ label, version, status, rounds: Record<string, number[]>, waveLines? }`）· 供 T5 布局渲染
- **Steps**:
  - 节点工作区解析 —— 对 overall/每 phase 由 slug 派生工作区目录（`.kairos/cdd/<nodeSlug>/`），构造 `Ledger` 读 `progress.json`（`ProgressData.waves` 行） — checkable: 单测——tmpRepo 落 `o1-overall/progress.json`（`{waves:[{wave:"spec",rounds:{review:[1,2],fix:[1]}}]}`）与 `o1-p1/progress.json`，投影返两节点各自 rounds
  - rounds 数组身份形 —— 每行 `×N` 的 N = `rounds[verb]` 数组元素（`[1,3]` → `×2`），**非**数值本身；数字形视为格式外，不渲染计数 — checkable: 单测——`{review:[1,3]}` → `review×2`；`{review:2}`（旧形）→ 不产 `review×2`
  - wave 段每波一行 —— `TaskGraph(parse(plan)).report(ledger.closedWaves())` 取波链 ✔/▶/○ + 该波键明细，每波独立一行（不发散内联） — checkable: 单测——两波 plan，W1 闭合 W2 未启，返 `["W1 ✔ …","W2 ▶ …"]` 两行
  - 缺节点降级 —— 无 plan 的中间节点 wave 段留空 · 无 overall 则 overall 段留空（**降级不报错**） — checkable: 单测——无 plan 文件时投影不抛错、wave 段为空
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`
- **Acceptance**: 进度投影按节点读各自 `progress.json` · `×N` 取数组元素（非数值）· wave 每波一行 · 缺节点降级不报错 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: 2

### Task 5: `cdd board <slug>` 一等公民命令（注册 + `#runBoard` + `BoardView` 板布局 + next 派生）
- **Objective**: 落 `cdd board <slug>` 第七命令——`face/declare.ts` 的 `CliVerb` 增 `"board"`（六 → 七）· `CLI_COMMANDS` 增 board 行 · `face/cli.ts` 增 `#runBoard(node, parsed)`（**无 preflight gate** · 纯读：slug 解析 → 节点树装配 → 板渲染 → next 派生 → stdout；返回 0/2）· `#wireActions` 接线 board action · `face/board-view.ts` 的 board 类增 `render(...)` 板布局（phase 板 / program 板两形 · 固定 legend 尾行 · `next:` 行）+ next 派生（按线序 spec→plan→wave→branch 求第一条未耗尽 face 的 `PIPELINE_NEXT` 入口 · 消费 T3 的表不另建）
- **Files**: Modify `packages/cdd-engine/src-next/face/declare.ts`（`CliVerb` :154 增 `"board"` · `CLI_COMMANDS` :281 后增 board 行）· Modify `packages/cdd-engine/src-next/face/cli.ts`（增 `#runBoard` · `#wireActions` :333 后增 board action）· Modify `packages/cdd-engine/src-next/face/board-view.ts`（board 类增 `render` 板布局 + next 派生）
- **Consumes**: T1（board 与 plan-graph 无词冲突）· T2（`docsOfSlug`/扫描/头块）· T3（`PIPELINE_NEXT` 消费）· T4（进度投影）· spec §2/§5/§6.5/§8.1 授权
- **Produces**: `CliVerb` 七值 · `CLI_COMMANDS` 含 board 行 · `#runBoard` · `BoardView.render`（phase/program 两形板 + legend + next）· 供 T7（结构 pins 重锚 · README 同步）
- **Steps**:
  - 命令注册 —— `face/declare.ts` `CliVerb` 加 `"board"` · `CLI_COMMANDS` 加行：
    ```ts
    { name: "board",
      description: "render the slug progress board (overall/spec/plan/wave/branch)",
      example: "cdd board 2026-10-10-engine-doc-tooling-p7",
      keys: [{ key: "root" }],
      positionals: [{ key: "slug", required: true }] }
    ```
    落根为扁平第七叶子（与 `schema`/`issue` 同级） — checkable: `grep -n '"board"' face/declare.ts` 命中（CliVerb + CLI_COMMANDS 两处）
  - `#runBoard` 分派 —— `async #runBoard(node: Command, parsed: RunInput): Promise<number>`：取 `parsed.positionals[0]` 为 slug（缺 → `this.#usage(node, "cdd board: missing <slug>")`）· 解析 repoRoot · 装配节点树 + 板渲染 + next 派生 → stdout · 无匹配文件 → `return 2` · **零写树 / 零写 ledger / 零 child** — checkable: 单测——`board <valid-slug>` exit 0 + stdout 含 `cdd board:` · `board`（缺 slug）exit 2 · `board nonexistent-slug` exit 2
  - action 接线 —— `#wireActions` 增 `commandNode("board").action(...)` 调 `#runBoard` — checkable: `grep -n 'commandNode("board")' face/cli.ts` 命中
  - 板布局 —— `BoardView.render` 产 phase 板（overall/spec/plan/wave/branch + 每波一行 + legend + next）与 program 板（overall 行含自身 rounds + 每 phase 摘要行 + next 恒 `done`）· 固定 legend `progress: ✔ done · ▶ current · ○ pending` · 缺中间节点留空不报错 — checkable: 单测——phase 板 `next:` 与引擎 `Capsule` 渲同一 `PIPELINE_NEXT` 入口字面逐字节一致 · program 板 `next: done`
  - next 派生（消费不另建）—— 按线序（spec→plan→wave→branch）对每条未耗尽 face 取 `PIPELINE_NEXT` 入口，取第一条未耗尽 face 的动作；**不自建 next 表** — checkable: 单测——spec 未闭合 → spec 行入口；spec 闭合 plan 未启 → plan 行入口
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`（`:388`/`projection.test.ts:57` 六命令精确列表变红 → 归 T7 重锚）
- **Acceptance**: `CliVerb` 七值 · `CLI_COMMANDS` 含 board 行 · `#runBoard` 无 preflight / 零副作用 / 缺 slug 或空匹配 exit 2 · phase 板与 program 板两形 + legend + `next:` 行 · board 不自建 next 表 · 引擎 vitest 通过（结构 pins 留 T7）· EOF 恰一 newline
- **DependsOn**: 1, 2, 3, 4

### Task 6: skills handoff 节点溶解 + skill-anatomy 契约 scope-aware 同步（D33 消费面）
- **Objective**: 溶解消费面流水线衔接 handoff——`cdd-spec-writer`/`cdd-plan`/`cdd-dev` 的 `handoff-cdd-plan`/`handoff-cdd-dev`/交接节点删（语义折入引擎 next）· `contract/skill-anatomy.ts` 增 `SKILL_ROSTER` 的 per-skill handoff 域事实（`pipeline` = 三流水线 skill · `design` = cdd-design）· `loopHubNode.rowPrefixes` 收为 per-scope record · `nextLoopConditions` **保留三成员不窄化** · `loopShapeRule`/`edgeConditionRule` 按域分句 · `SkillAnatomyCheck` 的 `out.length` 断言按域（pipeline 2 · design 3）· 闭合出口断言块仅对 `design` 域运行 · `rowPrefixes` 注册断言按域触发
- **Files**: Modify `packages/kairos/skills/cdd-spec-writer/SKILL.md`（`handoff-cdd-plan` 节点删 + 出边删）· Modify `packages/kairos/skills/cdd-plan/SKILL.md`（`handoff-cdd-dev` 节点删）· Modify `packages/kairos/skills/cdd-dev/SKILL.md`（交接节点溶解）· Modify `packages/cdd-engine/src-next/contract/skill-anatomy.ts`（`SKILL_ROSTER` :126-133 增 handoff 域字段 · `loopHubNode.rowPrefixes` :151 收 per-scope record · `loopShapeRule` :214-215 / `edgeConditionRule` :218 按域分句 · `nextLoopConditions` :156 保留三成员）· Modify `packages/kairos/tests/skill-anatomy.test.ts`（`out.length` :410 按域 · 闭合出口断言块 :390/:398 仅 design · `rowPrefixes` 注册断言 :322 按域）
- **Consumes**: 无（根任务 · skills 面独立）· spec §7 授权
- **Produces**: `SKILL_ROSTER` 携带 handoff 域 · loop-shape 常量按域分家 · 三流水线 skill 无 handoff 节点 · cdd-design 三出边不变 · 供 T7（skill-anatomy pins 重锚）
- **Steps**:
  - 契约增域事实 —— `contract/skill-anatomy.ts` `SkillRosterRow` 增 `handoff: "pipeline" | "design"` · `SKILL_ROSTER` 各行赋值（三流水线 = `pipeline` · cdd-design = `design`） — checkable: `grep -n "handoff:" contract/skill-anatomy.ts` 命中
  - loop-shape 常量按域 —— `loopHubNode.rowPrefixes` 收为 `Readonly<Record<"pipeline"|"design", readonly string[]>>`（pipeline → `[]` · design → `["handoff-"]`）· `loopShapeRule`/`edgeConditionRule` 拆按域两句 · `nextLoopConditions` 三成员不动 — checkable: 单测——pipeline skill 的 hub 两出边过、design skill 三出边过
  - skills 溶解 —— 三 SKILL.md 删对应 handoff 节点（digraph 出边 + `### \`handoff-*\`` 节点块）· NEXT-LOOP 退化为「照引擎 `next:` 字面执行」 — checkable: `grep -rn "handoff-cdd-plan\|handoff-cdd-dev" packages/kairos/skills/` 零命中
  - checker 按域 —— `skill-anatomy.test.ts` `#edgeConditionFindings`：`out.length` 期望 = `row.handoff === "pipeline" ? 2 : 3` · `doneExit` 闭合出口断言块 `if (row.handoff === "design") { … }` · 自环断言两域保留 · `#familyShapeFindings` 的 `rowPrefixes` 注册断言按域取域值 — checkable: `pnpm -C packages/kairos test` 全绿
  - 消费面纯度复核 —— 三 SKILL.md 零引擎内部细节（仅行为契约 + 照 `next:` 字面走）· 零新增 growth/refactor 叙事 heading · **author 节点 bootstrap 字面保留（§10）** — checkable: `biome check` 绿 · `skill-anatomy.test` 的 `authorBootstrap` + FORBIDDEN_HEADS 断言零命中
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`（skill-anatomy pins 变动归 T7）
- **Acceptance**: `SKILL_ROSTER` 携带 handoff 域 · `rowPrefixes` per-scope record · 三流水线 skill 无 handoff 节点 · cdd-design 三出边保留 · checker 按域（pipeline 2 / design 3）· `pnpm -C packages/kairos test` 全绿 · EOF 恰一 newline
- **DependsOn**: none

### Task 7: 消费面同步 + pin 重锚（六命令结构 pins 七行 · next: done 翻转集 · plan-graph pins · README ×4）
- **Objective**: 收口全部消费面与 pin——`packages/cdd-engine/README.md` ×2 增 board 行 · `packages/kairos/README.md` ×2 命令清单按 `CDD_SUBCOMMANDS` 成员序增 board · `presentation-surface.test.ts` 的 `CDD_SUBCOMMANDS` 增 `"board"` · 六命令结构 pins 重锚为七行（`cli.test.ts:388` + `projection.test.ts:57`）· `next: done` byte pin 翻转集逐条重锚 · plan-graph pins 重锚为 board/`graph` 断言 · 无 target 保持绿例外登记
- **Files**: Modify `packages/cdd-engine/README.md` + `packages/cdd-engine/README.zh-CN.md`（`## CLI` 表增 board 行）· Modify `packages/kairos/README.md` + `packages/kairos/README.zh-CN.md`（命令清单 :71 增 board 按常量序）· Modify `packages/kairos/tests/presentation-surface.test.ts`（`CDD_SUBCOMMANDS` :51 增 `"board"`）· Modify `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（六命令精确列表 :388 → 七行 · plan-graph pins :627/:664-675/:2636/:2661/:2951/:3361/:3403-3412 重锚 · `next: done` 翻转集 :1451/:1630/:1782/:1860/:1907/:2082/:2104/:2905/:3461 重锚）· Modify `packages/cdd-engine/src-next/face/__tests__/projection.test.ts`（六行精确列表 :57 → 七行 · `plan-graph passes through` :185-193 重锚）· Modify `packages/cdd-engine/src-next/face/__tests__/graph-view.test.ts`（title 字面 :22/:25）· Modify `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`（gate 名 `plan-graph` → `graph`）
- **Consumes**: T1（plan-graph pins）· T3（next 渲染 pins）· T5（board/结构 pins）· T6（skill-anatomy pins）· spec §9 授权
- **Produces**: 全 pin 与七命令/新 next 面一致 · `CDD_SUBCOMMANDS` 七值 · README ×4 同步 · `pnpm run validate` ALL PASS
- **Steps**:
  - README 同步 —— `packages/cdd-engine/README.md` + `.zh-CN.md` CLI 表增 board 行 · `packages/kairos/README.md` + `.zh-CN.md` 命令清单按 `CDD_SUBCOMMANDS` 成员序增 board — checkable: `presentation-surface.test.ts` 的 README 断言绿（:278-286 + :291）
  - `CDD_SUBCOMMANDS` —— `presentation-surface.test.ts:51` 增 `"board"`（末位） — checkable: 该常量七值 · README 断言绿
  - 六命令结构 pins —— `cli.test.ts:388` 精确列表改七行 · `projection.test.ts:57` 同 — checkable: 两 `toEqual` 断言绿
  - plan-graph pins 重锚 —— `cli.test.ts` unknown schema 报错文本去 `, plan-graph` · skeleton 面 plan-graph 拒绝改 board/`graph` 断言 · `schema get plan-graph` 读改 board 命令断言 · `projection.test.ts:185-193` · `graph-view.test.ts:22/:25` · `preflight.test.ts` gate 名 — checkable: `grep -n "plan-graph" face/__tests__ session/__tests__` 零命中
  - `next: done` 翻转集重锚 —— wave 线闭合（:1451 · :2905）改断言 branch-review 字面 · spec/plan 线闭合（:1782/:1860/:1907/:2082/:2104/:3461）改断言 skill ref · **保持绿例外**（:2772/:2794 + `face.test.ts:91/235/287` · overall 线 :1826 · 否定断言 :2340）不动 — checkable: 各翻转 pin 新字面绿 · 例外 pin 逐字节不变绿
  - 统一 next 面新 pins —— capsule/board 的 skill ref per-harness（claude/pi 两形）· 前缀省略 wave 字面 · overall → `done` · 无 target 兜底 — checkable: `pnpm -C packages/cdd-engine test` + `pnpm -C packages/kairos test` 全绿
  - 全量验证 —— checkable: `pnpm run validate` ALL PASS · `pnpm run emit:check` OK（命令 exit 0）
- **Acceptance**: `CDD_SUBCOMMANDS` 七值 · README ×4 同步 · 六命令结构 pins 七行 · `next: done` 翻转集逐条重锚且例外保持绿 · plan-graph pins 零残留 · `pnpm run validate` ALL PASS · `pnpm run emit:check` OK · EOF 恰一 newline
- **DependsOn**: 1, 3, 5, 6

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-15 | P8 计划起草——由 approved spec v0.9 分解为 7 任务 4 波：T1 plan-graph 退役 + 门名 graph（根）· T2 slug→节点树基础设施（根）· T3 `PIPELINE_NEXT` 表 + capsule 查表 + host 源模块级（根）· T4 进度面投影（依赖 T2）· T5 `cdd board` 一等公民命令（依赖 T1/T2/T3/T4）· T6 skills handoff 溶解 + skill-anatomy scope-aware 同步（根）· T7 消费面同步 + pin 重锚（依赖 T1/T3/T5/T6）· 派生波序 W1={1,2,3,6} → W2={4} → W3={5} → W4={7}（骨架由 `cdd schema get plan --output skeleton` 产出后填槽，非以兄弟产物为模板） | Oscar M. · Claude Opus 5（kairos:cdd-plan · spec v0.9 批准） |
