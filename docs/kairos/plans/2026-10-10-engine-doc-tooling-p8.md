# 引擎文档工具（Engine Doc-Tooling）— P8 实施计划：`cdd board <slug>` slug 进度板 + 引擎统一 next 面（plan-graph 提级一等公民 · 文件系统唯一真源 · 全节点 verb×round 板 · next 贯穿全 face 到 skill ref）
**Spec:** [2026-10-10-engine-doc-tooling-p8-design.md](../specs/2026-10-10-engine-doc-tooling-p8-design.md)
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](../specs/2026-10-10-engine-doc-tooling-overall.md)
- **Version**: v0.3 · 2026-10-15
- **Doc type**: plan

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
- **零残留**：`plan-graph` 字面零命中（**含注释/describe 标题**）· 引擎 vitest 全绿（含 board colocated pins + 重锚 pins）· EOF 恰一 newline · 不发布（变更集归并落 pending）。

### Task 1: `plan-graph` display 路由退役 + preflight 门名 `graph`（一概念一名）
- **Objective**: 从引擎删净 `plan-graph` 词——`#runPlanGraph` 整方法删 · `#runSchema` 的 plan-graph 分支删（json 面的 `if (type === "plan-graph")` 与 skeleton 面的拒绝分支）· `projection.ts #parseTypeKey` 签名收为 `(raw: string)`（去 `planGraph` 参数 + 报错文本的 `", plan-graph"` 拼接 + 头注改写）· `SCHEMA_TYPE_KEYS` 注释的 plan-graph 旁路叙述删 · `session/preflight.ts` 两联合的 `"plan-graph"` 成员改 `"graph"`（`PreFlightGateName` + `PreFlightReason`）+ `gates.push`/verdict 字面 + 注释叙事 · `face/words.ts` 的 `planGraph` 词条键改 `graph`（模板文本不变，仅键名对齐）· **残留注释随改**（`face/graph-view.ts` / `session/graph.ts` / `session/ledger.ts` / `face/words.ts`——全部 `plan-graph` 字面含注释清零；graph-view.ts 的消费者叙事改写为「pre-flight 拒绝 + board」两消费者，去已退役的 `cdd schema get plan-graph` 读路由措辞）
- **Files**: Modify `packages/cdd-engine/src-next/face/cli.ts`（`#runPlanGraph` :756-791 删 · `#runSchema` 分支 :737-742 删 + :751 删 · 头注去 plan-graph :725 · **`#renderPreflightBlocked` 的第二个 `GraphView` 消费者 :623 的 board 标题字面 `plan-graph: …` 重命名**（:619-626 块 · 方法 :611）· 注释 :176/:179/:387/:392/:607 随改）· Modify `packages/cdd-engine/src-next/face/projection.ts`（`#parseTypeKey(raw, planGraph)` :237-246 → `#parseTypeKey(raw)` · 报错文本 :242 · 头注 :234-235）· Modify `packages/cdd-engine/src-next/face/declare.ts`（`SCHEMA_TYPE_KEYS` 注释 :287-288）· Modify `packages/cdd-engine/src-next/session/preflight.ts`（`PreFlightGateName` :38 · `PreFlightReason` :43 · `gates.push` :147 · verdict :153-154 · 注释 :2/:6/:10/:61/:82/:124/:142）· Modify `packages/cdd-engine/src-next/face/words.ts`（`PreflightWords.planGraph` :72 + `CAPSULE_WORDS.preflight.planGraph` :111 → `graph` + `preflightWords()` 消费点 · **头注 `plan-graph BLOCK` :71 随改**）· Modify `packages/cdd-engine/src-next/face/graph-view.ts`（**头注 :2/:9——`plan-graph` 字面随改；:9 的消费者叙事改写为「pre-flight 拒绝 + board」**（去已退役的 `cdd schema get plan-graph` 读路由））· Modify `packages/cdd-engine/src-next/session/graph.ts`（**注释 :62/:63/:300 `plan-graph` 字面随改**）· Modify `packages/cdd-engine/src-next/session/ledger.ts`（**注释 :629 `plan-graph` 字面随改**）
- **Consumes**: 无（根任务）· spec §2.3/§3.1 授权
- **Produces**: 引擎零 `plan-graph` 词（**含注释**）· `#parseTypeKey(raw)` 单参签名 · `PreFlightGateName`/`PreFlightReason` 均含 `"graph"` · 供 T7（plan-graph pins 重锚）
- **Steps**:
  - 删 display 路由 —— `face/cli.ts` 删 `#runPlanGraph` 整方法 + `#runSchema` 的 skeleton 拒绝分支与 json 面 `if (type === "plan-graph") return this.#runPlanGraph(...)` 行 + 头注 plan-graph 句 + **`#renderPreflightBlocked` 的 board 标题字面 `plan-graph:` 重命名**（:623） — checkable: `grep -n "plan-graph\|runPlanGraph" face/cli.ts` 零命中（**含注释**——注释行 :176/:179/:387/:392/:607 亦随改，故该 checkable 覆盖全文件而非仅源字面）
  - 收 `#parseTypeKey` 签名 —— 签名 `#parseTypeKey(raw: string): string`（去 `planGraph: boolean`）· 删 `plan-graph` 透传行 · 报错模板去 `${planGraph ? ", plan-graph" : ""}` · 调用点去第二实参 — checkable: `grep -n "plan-graph\|planGraph" face/projection.ts` 零命中
  - 清 SCHEMA_TYPE_KEYS 注释 —— `face/declare.ts` 删「the get leaf additionally routes `plan-graph`…」旁路叙述 — checkable: `grep -n "plan-graph" face/declare.ts` 零命中
  - 门名改 `graph` —— `session/preflight.ts`：`PreFlightGateName`/`PreFlightReason` 成员 `"plan-graph"` → `"graph"` · `gates.push("plan-graph")` → `"graph"` · verdict `gate`/`reason` → `"graph"` · 注释随改 — checkable: `grep -n "plan-graph" session/preflight.ts` 零命中
  - 词条键改 + 残留注释清零 —— `face/words.ts` `PreflightWords.planGraph` 键 → `graph` · `CAPSULE_WORDS.preflight` 条目名同步 · `preflightWords()` 返回字段名同步 · 模板文本逐字不变 · 头注 :71 `plan-graph BLOCK` 随改 · `face/graph-view.ts` :2/:9 注释改写（**去已退役读路由措辞，消费者改 pre-flight 拒绝 + board**）· `session/graph.ts` :62/:63/:300 注释随改 · `session/ledger.ts` :629 注释随改 — checkable: `grep -rn "plan-graph\|planGraph" face/words.ts face/graph-view.ts session/graph.ts session/ledger.ts` 零命中（**含注释**）
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`（plan-graph 相关失败 pin 归 T7 重锚）
- **Acceptance**: `plan-graph` 在引擎全库（`src-next` **含注释**）零命中 · `#runPlanGraph` 不存在 · `#parseTypeKey` 单参 · `PreFlightGateName`/`PreFlightReason` 均含 `"graph"` · `words.ts`/`graph-view.ts`/`graph.ts`/`ledger.ts` 零 `plan-graph`/`planGraph` · 引擎 vitest 通过（失败 pin 留 T7）· EOF 恰一 newline
- **DependsOn**: none

### Task 2: slug → 节点树基础设施（文件系统唯一真源 · doc-root 常量 + `Workspace.docsOfSlug` + 扫描树化 + 头块读）
- **Objective**: 建 slug 定位面——`infra/runtime.ts` 的 `ENGINE_RUNTIME` 增 `docRoots`（`{ specs: "docs/kairos/specs", plans: "docs/kairos/plans" }`）· `infra/workspace.ts` 的 `Workspace` 增静态逆推导 `docsOfSlug(slug, repoRoot): SlugDocs`（相位后缀 `-p<主>(.<子>)*$` 解析）· `face/board-view.ts` 建 board 渲染类骨架 + `BoardNode` 头块事实类型 + 静态 `scanPhases(programSlug, repoRoot): string[]`（`readdirSync` 命中的 `<program>-p*` 后缀集，按点分路径排序）· artifact 头块读（**读解析记录的公开 `headerLines` 字段** + 本地 marker 提取取 `**Version**`/`**Status**`/**Doc type**`，产出 `{ version, status, docType }`；不调用 `markerValue`/`markerLine`——二者是 `MarkdownPrimitives`/`DocType` 层级的 `protected` 成员，独立类不可达）· **doc type 读声明不猜文件名**（spec §12 · D34）：`docType` 取自 `- **Doc type**:` 声明行，缺声明返 `null`（消费点 BLOCKED，不兜底）——`BoardView.#docKeyOf` 文件名后缀推导**禁止落地**
- **Files**: Modify `packages/cdd-engine/src-next/infra/runtime.ts`（`ENGINE_RUNTIME` :162-169 增 `docRoots`）· Modify `packages/cdd-engine/src-next/infra/workspace.ts`（`Workspace` 增 `static docsOfSlug(slug, repoRoot): SlugDocs` + `static phaseSuffixOf(slug)` · 导出 `SlugDocs`）· Create `packages/cdd-engine/src-next/face/board-view.ts`（board 类 + `BoardNode` 类型；本任务仅落 slug 解析/扫描/头块读）· **Create `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`**（colocated pins · T2 建，T4/T5 扩）
- **Consumes**: 无（根任务）· spec §4 授权
- **Produces**: `ENGINE_RUNTIME.docRoots` · `Workspace.docsOfSlug(slug, repoRoot): SlugDocs`（`{ overall, spec, plan, phaseSuffix }` 各 `string | null`）· 头块 `{ version, status, docType }` 读取面（docType 读声明行 · 缺失 null）· 扫描 `scanPhases` · 供 T4/T5 消费
- **Steps**:
  - doc-root 常量 —— `infra/runtime.ts` `ENGINE_RUNTIME` 增 `docRoots: { specs: "docs/kairos/specs", plans: "docs/kairos/plans" }`（不发明 config/env 覆盖面） — checkable: `grep -n "docRoots" infra/runtime.ts` 命中 · tsc 通过
  - `docsOfSlug` 逆推导 —— 相位后缀正则 `/(?<program>.+?)(?<suffix>-p\d+(?:\.\d+)*)$/`；程序 slug → `specs/<slug>-overall.md`（`existsSync` 决定 overall，缺失 null）· 相位 slug → overall `specs/<program>-overall.md` + spec `specs/<slug>-design.md` + plan `plans/<slug>.md`（各 `existsSync`）· 不解析 overall 声明表 — checkable: 单测 `board-view.test.ts`——`docsOfSlug("…-p7", tmpRepo)` 返 spec/plan 路径 · `docsOfSlug("…-p7.1", …)` 返 `-p7-overall` 路径 · `docsOfSlug("…-p3.2.1", …)` 后缀解析为 `-p3.2.1`
  - 扫描树化 —— `scanPhases(programSlug, repoRoot)`（`readdirSync(specs)` 命中 `<program>-p*` 后缀集，按点分路径排序）· **不合成盘上不存在的父节点** — checkable: 单测——tmpRepo 只置 `-p4.1` 无 `-p4`，`scanPhases` 返 `["-p4.1"]`，树装配把 `p4.1` 直接挂程序根
  - 头块读 —— 成员读解析记录的**公开 `headerLines` 字段** + **本地** marker 提取（`**Version**`/`**Status**`/**Doc type**` 行前缀切片），不调用 `markerValue`/`markerLine`（`protected` · 独立类不可达）· **docType 只读声明行**（`- **Doc type**: <DocKey>`），缺声明返 `null`，**零文件名后缀推导**（spec §12） — checkable: 单测——含 `- **Version**: v0.9 · …` + `- **Status**: Done` + `- **Doc type**: phase-spec` 的文档返 `{ version: "v0.9", status: "Done", docType: "phase-spec" }`；无 Doc type 行返 `{ …, docType: null }`；**`grep -n "endsWith" face/board-view.ts` 零命中**（后缀推导禁入 board 面）
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`（新增 pins 绿）
- **Acceptance**: `ENGINE_RUNTIME.docRoots` 落位 · `Workspace.docsOfSlug` 三分支（程序 / 相位 / 深相位）正确 · 扫描不合成盘上无父节点 · 头块 `{ version, status }` 读面可用 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 3: 引擎统一 next 面——`PIPELINE_NEXT` 表 + `Capsule#routeText` 查表 + host 源模块级上提（D33 焦点）
- **Objective**: 补上引擎缺的 face 间接线面——`session/next.ts` 增 `PIPELINE_NEXT` 常量表（键 `PipelineKey = "phase-spec" | "overall-spec" | "plan" | "wave" | "branch"`，值 `PipelineEntry = {kind:"ref",ref} | {kind:"literal",literal} | {kind:"done"}`）· `face/capsule.ts` 的 `case "done"` 由 `words.routeWord("done")` 改为查 `PIPELINE_NEXT[<doc-class 键>]`（无 target → 兜底裸词 `done`）· **host 源上提为 `face/host.ts` 模块级判定**（输入内联结构类型 `Record<string,string|undefined>`，`CliLifecycle.detectHost` 改为委托）· `Capsule` 构造增持 host（第三参）· `#runWork` 以 `process.env` 调同一判定并穿线入 `Capsule`
- **Files**: Modify `packages/cdd-engine/src-next/session/next.ts`（增 `PipelineKey`/`PipelineEntry`/`PIPELINE_NEXT`）· Modify `packages/cdd-engine/src-next/face/host.ts`（增模块级 host 判定 · 输入 `Record<string,string|undefined>`）· Modify `packages/cdd-engine/src-next/face/lifecycle.ts`（`detectHost` :152-169 委托 `host.ts` · 头注）· Modify `packages/cdd-engine/src-next/face/capsule.ts`（构造增 `host` 第三参 :61-66 · `#routeText` `case "done"` :120 查表 + `#docClassKey(target)` + skill ref 经 `REFS[ref][host]`（`REFS` host.ts:228 · `kairos:cdd-plan`/`cdd-dev`/`cdd-close` 行 :269-279）+ 无 host 回退 claude 形）· Modify `packages/cdd-engine/src-next/face/cli.ts`（`#runWork` 构造 `Capsule` :467 传 host）
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
  - Capsule 持 host + `case "done"` 查表 —— 构造 `(words, channels = {}, host = "")` · `case "done"` 调 `#doneText(target)`：`target == null` → `words.routeWord("done")`；否则 `key = #docClassKey(target)`（**spec 线读 doc 的 `- **Doc type**:` 声明行判 overall-spec/phase-spec——文件名后缀 `endsWith` 推导禁入（spec §12 · D34）· plan/wave/branch 各自** · `entry = PIPELINE_NEXT[key]`；`ref` → `REFS[entry.ref]?.[host] ?? REFS[entry.ref]?.claude ?? words.routeWord("done")`；`literal` → `<plan>` 以 `target.plan ?? "<plan>"` 替换 — checkable: 单测——无 target `{kind:"done"}` → `"done"` · `{type:"spec",id:"<spec 声明 phase-spec>"}` host `"claude"` → `/kairos:cdd-plan` · host `"pi"` → `/skill:cdd-plan` · host `""` → `/kairos:cdd-plan` · `{type:"spec",id:"<spec 声明 overall-spec>"}` → `"done"` · `{type:"wave",plan:"…p8.md"}` → `review --type branch --plan …p8.md` · spec doc 缺 Doc type 行 → BLOCKED 面（不按后缀兜底）
  - 组合根穿线 —— `face/cli.ts` `#runWork` 构造 `Capsule` 处传 host（`new Capsule(this.#words, ARGV_CHANNEL, <模块级判定>(process.env))`） — checkable: `grep -n "new Capsule" face/cli.ts` 三参 · `grep -n "process.env" face/cli.ts` 命中
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`（C5 表零改动；next/capsule pin 变动归 T7）
- **Acceptance**: `PIPELINE_NEXT` 五键单表 · `case "done"` doc-class 查表（spec 分 overall/phase · 无 target 兜底裸词）· host 判定模块级（`host.ts` · 内联类型 · 无 `lifecycle` 反引）· `Capsule` 持 host 且无 host 回退 claude 形 · C5 表零改动 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 4: 进度面投影（全节点 verb×round 板的数据源 · 各节点 `progress.json` 单源投影）
- **Objective**: 建 board 的进度读取面——`face/board-view.ts` 的 board 类增进度投影：按节点读各自 `progress.json`（overall 读 `<program>-overall/` 工作区 · 每个 phase 读 `<program>-p<N>/` 工作区 · 波键 `"1,2,5,8"` · branch 键 `"branch"`）· 每行摊 `implement×N · review×N · fix×N`（读 `rounds[verb]` 的**周期号数组**，**非计数**）· wave 段每波一行（波链 ✔/▶/○ 复用 `TaskGraph.report(closedWaves())` + `GraphView` 同源 · 波键明细同行）· 输出 `BoardProgress` 数据面供 T5 布局消费
- **Files**: Modify `packages/cdd-engine/src-next/face/board-view.ts`（board 类增进度投影成员 · 导出 `BoardProgress`/`BoardLine` 类型）
- **Consumes**: T2（`Workspace.docsOfSlug` 定位工作区 · doc-root 常量）· spec §5 授权
- **Produces**: `BoardProgress`（每节点 `{ label, version, status, docType, rounds: Record<string, number[]>, waveLines? }`——docType 承 T2 声明读）· 供 T5 布局渲染
- **Steps**:
  - 节点工作区解析 —— 对 overall/每 phase 由 slug 派生工作区目录（`.kairos/cdd/<nodeSlug>/`），构造 `Ledger` 读 `progress.json`（`ProgressData.waves` 行） — checkable: 单测——tmpRepo 落 `o1-overall/progress.json`（`{waves:[{wave:"spec",rounds:{review:[1,2],fix:[1]}}]}`）与 `o1-p1/progress.json`，投影返两节点各自 rounds
  - rounds 数组身份形 —— 每行 `×N` 的 N = `rounds[verb]` 数组元素（`[1,3]` → `×2`），**非**数值本身；数字形视为格式外，不渲染计数 — checkable: 单测——`{review:[1,3]}` → `review×2`；`{review:2}`（旧形）→ 不产 `review×2`
  - wave 段每波一行 —— `TaskGraph(parse(plan)).report(ledger.closedWaves())` 取波链 ✔/▶/○ + 该波键明细，每波独立一行（不发散内联） — checkable: 单测——两波 plan，W1 闭合 W2 未启，返 `["W1 ✔ …","W2 ▶ …"]` 两行
  - 缺节点降级 —— 无 plan 的中间节点 wave 段留空 · 无 overall 则 overall 段留空（**降级不报错**） — checkable: 单测——无 plan 文件时投影不抛错、wave 段为空
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`
- **Acceptance**: 进度投影按节点读各自 `progress.json` · `×N` 取数组元素（非数值）· wave 每波一行 · 缺节点降级不报错 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: 2

### Task 5: `cdd board <slug>` 一等公民命令（注册 + `#runBoard` + `BoardView` 板布局 + next 派生）
- **Objective**: 落 `cdd board <slug>` 第七命令——`face/declare.ts` 的 `CliVerb` 增 `"board"`（六 → 七）· `CLI_COMMANDS` 增 board 行 · `face/cli.ts` 增 `#runBoard(node, parsed)`（**无 preflight gate** · 纯读：slug 解析 → 节点树装配 → 板渲染 → next 派生 → stdout；返回 0/2）· `#wireActions` 接线 board action · `face/board-view.ts` 的 board 类增 `render(...)` 板布局（phase 板 / program 板两形 · 固定 legend 尾行 · `next:` 行）+ next 派生（按线序 spec→plan→wave→branch 求第一条未耗尽 face 的 `PIPELINE_NEXT` 入口 · 消费 T3 的表不另建）· **节点分类读声明**（spec §12 · D34）：节点线型（overall/spec/plan）取 T2 头块读的 `docType` 声明事实，**不按文件名后缀判型**；节点缺声明 → board 渲染该行 `doc-type: missing (BLOCKED)` 并整体 exit 2
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
- **Objective**: 溶解消费面流水线衔接 handoff——`cdd-spec-writer`/`cdd-plan`/`cdd-dev` 的 `handoff-cdd-plan`/`handoff-cdd-dev`/交接节点删（语义折入引擎 next）· **`cdd-dev` 另须删其 NEXT-LOOP hub 的 `next=done → branch-review` 闭合出口出边**（见下）· `contract/skill-anatomy.ts` 增 `SKILL_ROSTER` 的 per-skill handoff 域事实（`pipeline` = 三流水线 skill · `design` = cdd-design）· `loopHubNode.rowPrefixes` 收为 per-scope record · `nextLoopConditions` **保留三成员不窄化** · `loopShapeRule`/`edgeConditionRule` 按域分句 · `SkillAnatomyCheck` 的 `out.length` 断言按域（pipeline 2 · design 3）· 闭合出口断言块仅对 `design` 域运行 · `rowPrefixes` 注册断言按域触发
  - **`cdd-dev` hub 出口数专论**（finding #1）：`cdd-dev` 的 NEXT-LOOP hub 三出边为 `L -->|until next=done| L`（自环）· `L -->|next=done| K[branch-review]` · `L -->|no next| Z1((BLOCKED))`（SKILL.md:19-21）——第三条指向 rect `branch-review`（K），**非**被溶解的 `handoff-cdd-close` 终端（H，由 `K -->|next=done| H` 与 `F -->|next=done| H` 于 :24-25 指向）。故仅删节点 H 及其两条入边后，hub 仍有 3 出边（自环 + `next=done`→branch-review + `no next`→BLOCKED），pipeline→2 收敛仍红。**T6 须显式指示 `cdd-dev` 另删 hub 的 `next=done → branch-review` 闭合出口边**，留（自环 + `no next`→BLOCKED）= 2 出边；wave→branch 过渡改由引擎 `PIPELINE_NEXT` 的 wave 行 / next 字面承载（spec §6.1/§7.1「branch review 命令由引擎发」）。**`cdd-dev` 的 hub 因此彻底失去 `next=done` 标签**（branch-review/branch-fix 仅经引擎 next 字面重入），而 `cdd-spec-writer`/`cdd-plan` 仅删节点 H 即达 2。
- **Files**: Modify `packages/kairos/skills/cdd-spec-writer/SKILL.md`（`handoff-cdd-plan` 节点删 + 出边删）· Modify `packages/kairos/skills/cdd-plan/SKILL.md`（`handoff-cdd-dev` 节点删）· Modify `packages/kairos/skills/cdd-dev/SKILL.md`（交接节点 `handoff-cdd-close` 溶解 **+ NEXT-LOOP hub 的 `next=done → branch-review` 闭合出口出边删**（:20））· Modify `packages/cdd-engine/src-next/contract/skill-anatomy.ts`（`SKILL_ROSTER` :143 增 handoff 域字段 · `loopHubNode.rowPrefixes` :168 收 per-scope record · `loopShapeRule` :243 / `edgeConditionRule` :247 按域分句 · `nextLoopConditions` :173 保留三成员）· Modify `packages/kairos/tests/skill-anatomy.test.ts`（`out.length` :415 按域 · 闭合出口断言块 `doneExit` :395/:403 仅 design · 自环 :394/:397 两域保留 · `rowPrefixes` 注册断言 :327 按域）
- **Consumes**: 无（根任务 · skills 面独立）· spec §7 授权
- **Produces**: `SKILL_ROSTER` 携带 handoff 域 · loop-shape 常量按域分家 · 三流水线 skill 无 handoff 节点 · `cdd-dev` hub 二出边（自环 + `no next`→BLOCKED，无 `next=done` 标签）· cdd-design 三出边不变 · 供 T7（skill-anatomy pins 重锚）
- **Steps**:
  - 契约增域事实 —— `contract/skill-anatomy.ts` `SkillRosterRow` 增 `handoff: "pipeline" | "design"` · `SKILL_ROSTER` 各行赋值（三流水线 = `pipeline` · cdd-design = `design`） — checkable: `grep -n "handoff:" contract/skill-anatomy.ts` 命中
  - loop-shape 常量按域 —— `loopHubNode.rowPrefixes` 收为 `Readonly<Record<"pipeline"|"design", readonly string[]>>`（pipeline → `[]` · design → `["handoff-"]`）· `loopShapeRule`/`edgeConditionRule` 拆按域两句 · `nextLoopConditions` 三成员不动 — checkable: 单测——pipeline skill 的 hub 两出边过、design skill 三出边过
  - skills 溶解 —— 三 SKILL.md 删对应 handoff 节点（digraph 出边 + `### \`handoff-*\`` 节点块）· **`cdd-dev` 另删其 NEXT-LOOP hub 的 `next=done → branch-review` 闭合出口出边**（`L -->|next=done| K[branch-review]` · :20——留自环 + `no next`→BLOCKED = 2 出边；wave→branch 过渡改由引擎 `PIPELINE_NEXT` 承载，见 skill 专论）· NEXT-LOOP 退化为「照引擎 `next:` 字面执行」 — checkable: `grep -rn "handoff-cdd-\(plan\|dev\|close\)" packages/kairos/skills/` 零命中（**三节点名全枚举**——`cdd-dev` 的节点是 `handoff-cdd-close` 非 `handoff-cdd-dev`）· `grep -nF "L -->|next=done| K[branch-review]" packages/kairos/skills/cdd-dev/SKILL.md` 零命中（hub 闭合出口边删净）
  - checker 按域 —— `skill-anatomy.test.ts` `#edgeConditionFindings`：`out.length` 期望（:415）= `row.handoff === "pipeline" ? 2 : 3` · `doneExit` 闭合出口断言块（:395/:403）`if (row.handoff === "design") { … }` · 自环断言（:394/:397）两域保留 · `#familyShapeFindings` 的 `rowPrefixes` 注册断言（:327）按域取域值 — checkable: `pnpm -C packages/kairos test` 全绿
  - 消费面纯度复核 —— 三 SKILL.md 零引擎内部细节（仅行为契约 + 照 `next:` 字面走）· 零新增 growth/refactor 叙事 heading · **author 节点 bootstrap 字面保留（§10）** — checkable: `biome check` 绿 · `skill-anatomy.test` 的 `authorBootstrap` + FORBIDDEN_HEADS 断言零命中
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`（skill-anatomy pins 变动归 T7）
- **Acceptance**: `SKILL_ROSTER` 携带 handoff 域 · `rowPrefixes` per-scope record · 三流水线 skill 无 handoff 节点 · **`cdd-dev` hub 二出边（自环 + `no next`→BLOCKED，`next=done` 闭合出口边删净）** · cdd-design 三出边保留 · checker 按域（pipeline 2 / design 3）· `pnpm -C packages/kairos test` 全绿 · EOF 恰一 newline
- **DependsOn**: none

### Task 7: 消费面同步 + pin 重锚（六命令结构 pins 七行 · next: done 翻转集 · plan-graph pins · deriveDocType 退役 · README ×4）
- **Objective**: 收口全部消费面与 pin——`packages/cdd-engine/README.md` ×2 增 board 行 · `packages/kairos/README.md` ×2 命令清单按 `CDD_SUBCOMMANDS` 成员序增 board · `presentation-surface.test.ts` 的 `CDD_SUBCOMMANDS` 增 `"board"` · 六命令结构 pins 重锚为七行（`cli.test.ts:388` + `projection.test.ts:57`）· `next: done` byte pin 翻转集逐条重锚 · plan-graph pins 重锚为 board/`graph` 断言 · **doc type 声明面 pin（spec §12 · D34）**：`deriveDocType` 退役随 `judge.test.ts:860-884` describe 块删（后缀规则测试随之亡）· `cli.ts:405` preflight docKey 读声明（缺声明 BLOCKED pin）· 无 target 保持绿例外登记
- **Files**: Modify `packages/cdd-engine/README.md` + `packages/cdd-engine/README.zh-CN.md`（`## CLI` 表增 board 行）· Modify `packages/kairos/README.md` + `packages/kairos/README.zh-CN.md`（命令清单 :71 增 board 按常量序）· Modify `packages/kairos/tests/presentation-surface.test.ts`（`CDD_SUBCOMMANDS` :51 增 `"board"`）· Modify `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（六命令精确列表 :388 → 七行 · plan-graph pins :627/:664-675/:2636/:2661/:2951/:3361/:3403-3412 重锚 · `next: done` 翻转集 :1451/:1630/:1782/:1860/:1907/:2082/:2104/:2905/:3461 重锚）· Modify `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（`deriveDocType` describe 块 :860-884 删 · 换声明读取面 pins：声明行判型 + 缺声明 BLOCKED）· Modify `packages/cdd-engine/src-next/face/__tests__/projection.test.ts`（六行精确列表 :57 → 七行 · `plan-graph passes through` :185-193 重锚）· Modify `packages/cdd-engine/src-next/face/__tests__/graph-view.test.ts`（title 字面 :22/:25）· Modify `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`（gate 名 `plan-graph` → `graph` · docKey 声明读 fixtures）
- **Consumes**: T1（plan-graph pins）· T3（next 渲染 pins）· T5（board/结构 pins）· T6（skill-anatomy pins）· spec §9/§12 授权
- **Produces**: 全 pin 与七命令/新 next 面一致 · `CDD_SUBCOMMANDS` 七值 · README ×4 同步 · `pnpm run validate` ALL PASS
- **Steps**:
  - README 同步 —— `packages/cdd-engine/README.md` + `.zh-CN.md` CLI 表增 board 行 · `packages/kairos/README.md` + `.zh-CN.md` 命令清单按 `CDD_SUBCOMMANDS` 成员序增 board — checkable: `presentation-surface.test.ts` 的 README 断言绿（:278-286 + :291）
  - `CDD_SUBCOMMANDS` —— `presentation-surface.test.ts:51` 增 `"board"`（末位） — checkable: 该常量七值 · README 断言绿
  - 六命令结构 pins —— `cli.test.ts:388` 精确列表改七行 · `projection.test.ts:57` 同 — checkable: 两 `toEqual` 断言绿
  - plan-graph pins 重锚 —— `cli.test.ts` unknown schema 报错文本去 `, plan-graph` · skeleton 面 plan-graph 拒绝改 board/`graph` 断言 · `schema get plan-graph` 读改 board 命令断言 · **`cli.ts:623` 的 board 标题字面重命名后其 pin 同步** · `projection.test.ts:185-193` · `graph-view.test.ts:22/:25` · `preflight.test.ts` gate 名（**含注释/describe 标题**——该文件 ~10 处 `plan-graph`，多数在注释与 describe 名 :3/:7/:9/:232/:266/:302-303/:311/:331/:334，随 gate 名一并改名） — checkable: `grep -n "plan-graph" face/__tests__ session/__tests__` 零命中（**覆盖注释与标题**）
  - `next: done` 翻转集重锚 —— wave 线闭合（:1451 · :2905）改断言 branch-review 字面 · **branch 线闭合（:1630）改断言 `/kairos:cdd-close` skill ref**（`review --type branch --dry-run` 耗尽渲染）· spec/plan 线闭合（:1782/:1860/:1907/:2082/:2104/:3461）改断言 skill ref · **保持绿例外**（:2772/:2794 + `face.test.ts:91/235/287` · overall 线 :1826 · 否定断言 :2340）不动 — checkable: 各翻转 pin 新字面绿 · 例外 pin 逐字节不变绿
  - 统一 next 面新 pins —— capsule/board 的 skill ref per-harness（claude/pi 两形）· 前缀省略 wave 字面 · overall → `done` · 无 target 兜底 — checkable: `pnpm -C packages/cdd-engine test` + `pnpm -C packages/kairos test` 全绿
  - 全量验证 —— checkable: `pnpm run validate` ALL PASS · `pnpm run emit:check` OK（命令 exit 0）
- **Acceptance**: `CDD_SUBCOMMANDS` 七值 · README ×4 同步 · 六命令结构 pins 七行 · `next: done` 翻转集逐条重锚且例外保持绿 · plan-graph pins 零残留 · skill-anatomy pins 含 D35 词表集 · `pnpm run validate` ALL PASS · `pnpm run emit:check` OK · EOF 恰一 newline
- **DependsOn**: 1, 3, 5, 6, 9

### Task 8: 存量 doc 声明 sweep（`- **Doc type**:` 行补齐 · 单 commit）
- **Objective**: 全库存量 doc 的 header 补 `- **Doc type**: <DocKey>` 声明行（spec §12 · D34）——`docs/kairos/specs/*-overall.md` → `overall-spec` · `docs/kairos/specs/*-design.md` → `phase-spec` · `docs/kairos/specs/*-single-spec.md` → `single-spec` · `docs/kairos/plans/*.md` → `plan`（**迁移期分类用现推导可知**——推导此役用于一次性迁移，非运行时面；迁移完退役）。声明行插在 header 块内（`- **Version**:` 行后 · 与既有 marker 行序一致），单 commit 机械落齐。
- **Files**: Modify `docs/kairos/specs/*.md`（全部 overall/design/single-spec 补声明行）· Modify `docs/kairos/plans/*.md`（全部 plan 补声明行）
- **Consumes**: 无（纯 doc sweep · 与引擎任务独立）· spec §12 授权
- **Produces**: 全库 doc header 携声明行 · 消费面（T2 头块读 / T3 `#docClassKey` / T5 board / preflight docKey 门）的声明读有据可依
- **Steps**:
  - 分类清点 —— `ls docs/kairos/specs docs/kairos/plans` 按后缀分四类清点（overall / design / single-spec / plans）
  - 机械补行 —— 每份 doc 在 `- **Version**:` 行后插 `- **Doc type**: <对应 DocKey>`（`- **Status**:` 行序保持不动；仅 header 块，正文零触碰）
  - 一致性核验 — checkable: `grep -L "Doc type" docs/kairos/specs/*.md docs/kairos/plans/*.md` 零输出（每份都有声明）· `grep -c "\*\*Doc type\*\*" docs/kairos/specs/*.md docs/kairos/plans/*.md` 每份恰 1
- **Acceptance**: 全库 doc header 携 `- **Doc type**:` 恰一行且值域正确（overall/design/single-spec/plan 四类各归其位）· 单 commit · EOF 恰一 newline
- **DependsOn**: none

### Task 9: 自环词表更正 + branch 节点消融（D35 · T6 后置）
- **Objective**: 把 skill digraph 的边条件词与 D33 后引擎 next 面的实际字面序列对齐（spec §13）——cdd-dev 的 `branch-review`/`branch-fix` 节点消融（branch 接线已被引擎 C5 + `PIPELINE_NEXT` 完全承载，编排器零 branch 专属路由知识）· 四 skill（cdd-spec-writer/cdd-plan/cdd-dev/cdd-design）自环标签 `until next=done` → `until next is terminal`（terminal = done 或 skill ref/引擎命令字面）· cdd-design 闭合出口标签 `next=done` → `until session closes`（design 续环非引擎字面消费者，不蹭 done）· 契约同步：`nextLoopConditions` 词表随新标签 · `loopShapeRule`/`edgeConditionRule` 文本随改 · branch 独立闭环断言块退役 · `out.length` 域规则（pipeline 2 / design 3）不动
- **Files**: Modify `packages/kairos/skills/cdd-dev/SKILL.md`（branch 双节点块 + digraph 边删 · hub Do 收编 branch 事实一句话 · Failure Modes 增 branch blocker fail-open 行 · 自环标签改）· Modify `packages/kairos/skills/cdd-spec-writer/SKILL.md`（自环标签改）· Modify `packages/kairos/skills/cdd-plan/SKILL.md`（自环标签改）· Modify `packages/kairos/skills/cdd-design/SKILL.md`（自环标签 + 闭合出口标签改）· Modify `packages/cdd-engine/src-next/contract/skill-anatomy.ts`（`nextLoopConditions` 词表随新标签 · `loopShapeRule`/`edgeConditionRule` 文本随改 · branch 专论两条规则 `:264-266` 删）· Modify `packages/kairos/tests/skill-anatomy.test.ts`（branch 闭环断言块 `:442-461` 删 · 新标签断言 · `out.length` 域规则不动）
- **Consumes**: T6（handoff 溶解后 digraph 形状）· spec §13 授权
- **Produces**: 四 skill 自环标签 `until next is terminal` · cdd-design 闭合出口 `until session closes` · cdd-dev 单 hub 二出边（branch 双节点零残留）· 契约词表与 live digraph 一致 · 供 T7（skill-anatomy pins 扩集）
- **Steps**:
  - cdd-dev branch 消融 —— digraph 删 `K[branch-review]`/`F[branch-fix]` 节点与全部关联边（`K -->|fix| F` · `F -->|until next=done| K`）· `### branch-review`/`### branch-fix` 节点块删 · NEXT-LOOP Do 增一句 branch 事实（branch review/fix 经引擎 `next:` 字面派发，与 wave 面同构）· Failure Modes 增「branch blockers persist → implicit fail-open（branch 保留 · 用户裁决）」行 — checkable: `grep -n "branch-review\|branch-fix" packages/kairos/skills/cdd-dev/SKILL.md` 零命中 · digraph 单 hub 二出边
  - 自环标签更正 —— 四 skill 的 `L -->|until next=done| L` → `L -->|until next is terminal| L`（skills 不复写引擎措辞——terminal 是 digraph 边条件词，非 next 字面副本） — checkable: `grep -rn "until next=done" packages/kairos/skills/` 零命中 · `grep -rn "until next is terminal" packages/kairos/skills/` 四文件命中
  - cdd-design 闭合出口 —— `L -->|next=done| H[handoff-next]` → `L -->|until session closes| H[handoff-next]`（design 域三出边形状不变：自环 + 闭合出口 + `no next`→BLOCKED） — checkable: `grep -n "next=done" packages/kairos/skills/cdd-design/SKILL.md` 零命中
  - 契约同步 —— `nextLoopConditions` 改 `["until next is terminal", "until session closes", "no next"]`（design 域闭合出口的新条件词入表）· `loopShapeRule`/`edgeConditionRule` 断言文本随改 · branch 专论两条规则（`skill-anatomy.ts:264-266`）删 · checker：branch 闭环断言块（`skill-anatomy.test.ts:442-461`）删 · 自环标签断言读新词表 · `out.length` 域规则（pipeline 2 / design 3）与闭合出口断言块（仅 design 域）不动 — checkable: `pnpm -C packages/kairos test`（skill-anatomy 全绿）
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test` + `pnpm run validate` 全绿
- **Acceptance**: 四 skill 自环 `until next is terminal` · cdd-design 闭合出口 `until session closes` · cdd-dev branch 双节点零残留（单 hub 二出边）· 契约词表/规则文本与 live digraph 一致 · branch 闭环断言零残留 · `pnpm -C packages/kairos test` 全绿 · EOF 恰一 newline
- **DependsOn**: 6

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-15 | P8 计划起草——由 approved spec v0.9 分解为 7 任务 4 波：T1 plan-graph 退役 + 门名 graph（根）· T2 slug→节点树基础设施（根）· T3 `PIPELINE_NEXT` 表 + capsule 查表 + host 源模块级（根）· T4 进度面投影（依赖 T2）· T5 `cdd board` 一等公民命令（依赖 T1/T2/T3/T4）· T6 skills handoff 溶解 + skill-anatomy scope-aware 同步（根）· T7 消费面同步 + pin 重锚（依赖 T1/T3/T5/T6）· 派生波序 W1={1,2,3,6} → W2={4} → W3={5} → W4={7}（骨架由 `cdd schema get plan --output skeleton` 产出后填槽，非以兄弟产物为模板） | Oscar M. · Claude Opus 5（kairos:cdd-plan · spec v0.9 批准） |
| v0.2 | 2026-10-15 | **plan-review-1 七 findings 修复（v0.1 URC 单循环评审 · 全部 verified-true 并 ACCEPT · Plan Sole Writer）**：① **W**——T1 漏 `face/cli.ts:623`（`#renderPreflightBlocked` 的第二个 `GraphView` 消费者，标题字面 `plan-graph: …`）+ 注释行 :176/:179/:387/:392/:607 与 preflight 注释 :61/:82/:124 → T1 编辑面补 :623 + 注释清单，checkable 明示覆盖注释；② **W**——T7 翻转集步骤漏 **branch 线类**：`cli.test.ts:1630`（`review --type branch --dry-run` 闭合 → `/kairos:cdd-close`），Files 已含而步骤未映射 → 步骤补 branch 类；③ **W**——T6 checkable `handoff-cdd-plan\|dev` 漏 `cdd-dev` 的实节点名 `handoff-cdd-close` → 模式扩为 `handoff-cdd-\(plan\|dev\|close\)` 三枚举；④ **W**——board colocated 测试文件无 Files 归属（T2/T4/T5 checkable 引用之，实测不存在）→ T2 Files 增 `Create: …/face/__tests__/board-view.test.ts`；⑤ **N**——T2 头块读声称复用 `markerValue` 但其为 `protected`（doc.ts:447/:453）→ 改为公开 `headerLines` 字段 + 本地 marker 提取；⑥ **N**——T6 skill-anatomy 锚点 stale（`SKILL_ROSTER` :126-133→:143 · `rowPrefixes` :151→:168 · `nextLoopConditions` :156→:173 · `loopShapeRule` :214-215→:243 · `edgeConditionRule` :218→:247 · checker `out.length` :410→:415 · `doneExit` :390/:398→:395/:403 · 自环 :392→:394/:397 · `rowPrefixes` 注册 :322→:327）——本轮 in-flight hotfix 增 `authorBootstrap` 使文件位移；T3 capsule `case "done"` :123-124→:120 同；⑦ **N**——T7 plan-graph 零命中 checkable 覆盖注释/describe 标题（preflight.test.ts ~10 处）→ 步骤注明 | Oscar M. · Claude Opus 5（P8 plan-fix round 1 · 全部 verified-true） |
| v0.3 | 2026-10-15 | **plan-review-2 两 findings 修复（v0.2 URC 评审 · 全部 verified-true 并 ACCEPT · Plan Sole Writer）**：① **W**——T6 的 `cdd-dev` 溶解步骤仅删 `handoff-cdd-close` 节点未能把其 NEXT-LOOP hub 从三出边降到二（hub 第三条边 `L -->|next=done| K[branch-review]` 指向 rect `branch-review`（:20），非被溶解的终端 H），pipeline→2 收敛会红 → T6 Objective 增 **`cdd-dev` hub 出口数专论**，Files/Steps/Acceptance/Produces 均显式指示删 hub 的 `next=done → branch-review` 闭合出口边（留自环 + `no next`→BLOCKED = 2），wave→branch 过渡改由引擎 `PIPELINE_NEXT` 承载；`cdd-dev` hub 因此无 `next=done` 标签（branch-review/fix 仅经引擎 next 字面重入），而 `cdd-spec-writer`/`cdd-plan` 仅删节点即达 2；② **N**——T1 编辑面漏 live 注释残留（`face/graph-view.ts:2/:9`（:9 消费者叙事因退役读路由变陈）· `session/graph.ts:62/:63/:300` · `session/ledger.ts:629` · `face/words.ts:71`）使全局「零残留」约束不可满足 → T1 Files/Objective/Steps/Acceptance 补四文件注释清单 + 新 checkable（`grep -rn "plan-graph\|planGraph" face/words.ts face/graph-view.ts session/graph.ts session/ledger.ts` 零命中，含注释）；Constraints 零残留限定语补「含注释/describe 标题」 | Oscar M. · Claude Opus 5（P8 plan-fix round 2 · 全部 verified-true） |
| v0.4 | 2026-10-15 | **D34 backfill（spec v1.1 §12 · 用户裁定 · Plan Sole Writer）**：doc type 声明上收 + 文件名推导退役——header 增 `- **Doc type**:` 声明行（四值 DocKey · skeleton 生成），`deriveDocType` 后缀规则/`BoardView.#docKeyOf` 整体退役（重复声明被消灭非修复），缺声明 BLOCKED（零双读兜底），存量 sweep。计划修订：T2 头块读增 docType 声明提取（`{version,status,docType}` · `endsWith` 禁入 board 面 checkable）· T4 投影携 docType · T3 `#docClassKey` spec 线改读声明（`endsWith` 判别删 · 缺声明 BLOCKED 面）· T5 节点分类读声明（缺声明行渲染 + exit 2）· T7 增 `judge.test.ts:860-884` deriveDocType describe 删 + 声明读取面 pins + preflight fixtures · **新 T8**（存量 sweep · 根任务 · 全库 doc 补声明行单 commit） | Oscar M. · Claude Opus 5（kairos:cdd-plan 修订 · 用户裁定 D34） |
| v0.5 | 2026-10-15 | **D35 backfill（spec v1.2 §13 · 用户裁定 · Plan Sole Writer）**：自环词表更正 + branch 节点消融——四 skill 自环 `until next=done`（D33 后 done 永不出现于 cdd-plan/cdd-dev/cdd-design 的 next 序列，until 永假）→ `until next is terminal` · cdd-design 闭合出口 → `until session closes → handoff-next`（design 续环非引擎字面）· cdd-dev branch-review/branch-fix 孤岛节点消融（branch 接线已被引擎字面完全承载）· 契约同步（`nextLoopConditions` 词表 + `loopShapeRule`/`edgeConditionRule` 文本 + branch 闭环断言块退役 · `out.length` 域规则不动）。**新 T9**（依赖 T6 · skills + contract + checker）· T7 DependsOn 补 9 + Acceptance 增 D35 词表集 | Oscar M. · Claude Opus 5（kairos:cdd-plan 修订 · 用户裁定 D35） |
