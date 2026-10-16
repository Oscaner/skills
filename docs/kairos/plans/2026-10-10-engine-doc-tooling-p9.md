# 引擎文档工具（Engine Doc-Tooling）— P9 实施计划：一事实无处 / 无门 / 有副本 通审施工（D26 法条 · A 组路径面单源统一 + B 组 20 项无门事实通审 + frontmatter 门）
**Spec:** [2026-10-10-engine-doc-tooling-p9-design.md](../specs/2026-10-10-engine-doc-tooling-p9-design.md)
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](../specs/2026-10-10-engine-doc-tooling-overall.md)
- **Version**: v0.3 · 2026-10-16
- **Doc type**: plan

## Constraints

- **功能语义不变**：退出码表 0/1/2 · CDD_BLOCKED 通道 · doc-contract 判定语义 · 领域 run 语义零变化。
- **`next:` 字面冻结**：本 phase 不改 `next:` 行的可执行字面（承 P5 冻结先例）。
- **形态唯一（A 组）**：repoRoot 相对路径是唯一持久 / 比较 / 传递形态；绝对形态仅瞬态存在于 syscall 边界（`RepoRoot.resolve` 产出喂 `fs`/`git`/`execa`），永不落盘、永不比较、永不跨层。
- **唯一转换点**：engine 生产代码 `process.cwd()` → repoRoot 的转换**恰好 1 处**，机器 pin 把守（§2.4/§2.9）。
- **`process.chdir()` 生产的引擎路径禁用**（测试 fixture 的 chdir 隔离除外 · §2.12）。
- **推算不出 repoRoot → BLOCKED 退 1**（运行环境事实缺失，非 usage 面退 2 · 零新消息面 · §2.6）。
- **D29 黑盒边界守约**：skill 文本零引擎内部实现镜像；对消费面**只加一致性门**（测试断言），不改 SKILL.md 承载语义。
- **门归属分域**：引擎内部事实门进 **engine suite**；引擎 ⇄ 消费面对照门进 **kairos suite**（镜像 P5 校验归域）。
- **面间派生单源**：face 间的 `next` 派生恰好 1 处（`NextStepRouter.walk`——⑳ 已 hot-fix 落地）；board 只报**观测事实**，判**下一步**归 router。
- **零裸函数**：全局 `^export function|^function` 零命中；新增/改动面全为类成员或声明常量。
- **零残留**：`--root` / `cwd` 注入 / `repoRoot` 注入三缝零残留（grep pin **覆盖生产面与测试面**，含 `cli.test.ts` 的 58 处可删 `--root` argv token + 1 处存活负锚 `:621`）· B 组 20 项每项**或有单源且有门、或已删**，无中间态。
- **变更先回填 parent overall**（backfill-as-version）——本 phase 内的 spec/overall 修订走同一 backfill 规则。
- **不发布**：changeset（cdd-engine）按既有归并落 pending；tag / publish = 独立动作。
- **English-primary**（SKILL.md / `docs/*.md`）· **specs/plans 中文**（Strategy B）· emit 产物派生（`pnpm run emit`）· EOF 恰一 newline。

---

### Task 1: 路径值对象——`RepoRoot` + 品牌 `RepoPath`（§2.2）
- **Objective**: 立 A 组的类型基座——`RepoRoot` 值对象（根基准的唯一权威源）+ 品牌类型 `RepoPath`（把「相对形态」升为类型，使「绝对态」在类型层不可表达）。唯一构造入口 `RepoRoot.relativize(input: string): RepoPath`（用户输入读入点）· 唯一擦除点 `RepoRoot.resolve(rel: RepoPath): string`（syscall 边界，产出绝对 `string` 喂 `fs`/`git`/`execa`）。构造取**已解析的绝对根串**（解析归 T2，避免循环依赖）；本任务只做纯 relativize/resolve + 品牌，零 syscall。
- **Files**: Create `packages/cdd-engine/src-next/infra/root.ts`（`RepoRoot` 类 + `RepoPath` 品牌 + `PathBasis` 判别）· Create `packages/cdd-engine/src-next/infra/__tests__/root.test.ts`
- **Consumes**: 无（根任务）· spec §2.2 授权
- **Produces**: `RepoRoot`（`static` 或构造持绝对根 · `relativize(absoluteOrRelative: string): RepoPath` 归一为 repoRoot 相对品牌串 · `resolve(rel: RepoPath): string` 擦除为绝对）· 品牌 `RepoPath`（`string & { readonly __repoPath: unique symbol }` 或等价擦除点契约）· 供 T3（输入漏斗）/T4（落盘）/T5（`#scanRoots`）消费
- **Steps**:
  - 立品牌 `RepoPath` + `RepoRoot` 骨架 —— `infra/root.ts` 导出 `RepoPath`（brand）+ `class RepoRoot`（构造持绝对根 `string`；`relativize` 用 `path.relative(root, resolve(root, input))` 产 repoRoot 相对串并 brand；`resolve` 用 `path.resolve(root, rel)` 擦除） — checkable: `grep -n "RepoPath\|class RepoRoot" infra/root.ts` 命中 · tsc 通过
  - 仓库外路径形态保持单一 —— `relativize("../outside/x.md")` 返**含 `..` 分段的相对串**（形态仍相对 · 不拒绝 · 与 §2.10 协同），不抛错 — checkable: 单测——`relativize` 对仓内/仓外/绝对三输入皆返品牌相对串；`resolve(relativize(x))` 与 `path.resolve(root, x)` 等价
  - 往返一致 pin —— 任一仓内绝对/相对输入经 `relativize` → `resolve` 往返得确定绝对串；`sameRef` 语义：同一文档的绝对形与相对形 `relativize` 后**串相等** — checkable: 单测——`relativize("/abs/r/docs/kairos/plans/p.md") === relativize("docs/kairos/plans/p.md")`（同一 `root` 下）
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`（新 pins 绿）
- **Acceptance**: `RepoRoot` 值对象落位（`relativize` 唯一构造 · `resolve` 唯一擦除）· 品牌 `RepoPath` 使绝对态类型层不可表达 · 仓库外路径形态仍单一（含 `..` 不拒绝）· 同文档绝对/相对 `relativize` 后串相等 · 零 syscall（纯）· 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 2: repoRoot 唯一转换 + 三缝退役 + 推算不出 BLOCKED（§2.4/§2.6）
- **Objective**: 收根基准到唯一转换点并把三缝退役。① **`--root` 退役**：删 `face/declare.ts` 的 `root` 条目（:93-97）+ 四命令（implement :203 · review :215 · fix :228 · board :286）`keys` 的 `{ key: "root" }` 引用。② **三注入缝退役**：删 `CliOptions.cwd`（:118）/`repoRoot`（:119）、`Cli.#cwd`（:173，默认 :220）/`#repoRoot`（:174，默认 :221）、`CliLifecycle` 构造的 `cwd` 参数（:149，默认 :157）；`#repoRootOf`（:761-764）的 `override`（`--root`）腿 + `this.#repoRoot` 腿 + `?? this.#cwd` fallback 死，收为**唯一转换** `await this.#git.topLevel(process.cwd())`。③ **推算不出 → BLOCKED**：`git.topLevel(process.cwd()) === null` → 走既有 BLOCKED 语义（stderr 携因 · 退 1），非 usage 错（退 2）；零新消息面。
- **Files**: Modify `packages/cdd-engine/src-next/face/declare.ts`（删 `root` 条目 :93-97 + 四命令 `keys` 的 root 引用）· Modify `packages/cdd-engine/src-next/face/cli.ts`（`CliOptions` :118-119 删两缝 · `Cli` :173-174 删 `#cwd`/`#repoRoot` · 构造 :220-221 删默认 · `#repoRootOf` :761-764 收唯一转换 + null→BLOCKED · `#runWork` 的 `CliLifecycle` 构造 :608 去 `cwd` 实参）· Modify `packages/cdd-engine/src-next/face/lifecycle.ts`（`CliLifecycle` 构造 :146-167 去 `cwd` 参数 · `#cwd` :135 删 · spawn cwd :203-207 由 `this.#cwd` 改持 repoRoot）
- **Consumes**: T1（`RepoRoot` 类型基座 · repoRoot 现由 `Cli` 经转换点产出并下传）· spec §2.4/§2.6 授权
- **Produces**: engine 生产代码 `process.cwd()` **恰好 1 处**（`cli.ts` 唯一转换）· `git.topLevel` 转换点**恰好 1 处** · `--root` 声明面零残留（declare 侧）· `CliOptions` 无 `cwd`/`repoRoot` 缝 · `CliLifecycle` spawn cwd = repoRoot（归一）· 推算不出 → BLOCKED 退 1 · 供 T4/T6/T7 消费
- **Steps**:
  - `--root` 退役 + 命令 keys —— `face/declare.ts` 删 `ARGV_CHANNEL` 的 `root` 条目（:93-97）· `CLI_COMMANDS` 四命令 `keys` 去 `{ key: "root" }`（:203/:215/:228/:286） — checkable: `grep -n "\"root\"\|'root'\|--root" face/declare.ts` 零命中 · tsc 通过
  - 注入缝退役 —— `face/cli.ts` 删 `CliOptions.cwd`/`repoRoot`（:118-119）· 删 `#cwd`/`#repoRoot` 字段（:173-174）· 删构造默认（:220-221）· `#runWork` 去 `CliLifecycle` 的 `cwd` 实参（:608） — checkable: `grep -n "#cwd\|#repoRoot\|opts.cwd\|opts.repoRoot" face/cli.ts` 零命中 · `face/lifecycle.ts` 的 `#cwd` 零命中
  - 唯一转换 + BLOCKED —— `#repoRootOf` 体改为：`const root = await this.#git.topLevel(process.cwd()); if (root === null) return null; return root;`（或经既有 BLOCKED 通道抛出/返回）· 调用点（:361/:688/:808）处理 null → BLOCKED 退 1（stderr 携因） — checkable: `grep -n "process.cwd()" face/cli.ts` **恰 1 处**（`lifecycle.ts` 亦 0 处生产命中） · `grep -rn "git.topLevel" src-next --include=*.ts` 生产面**恰 1 调用点**
  - spawn cwd 归一 —— `face/lifecycle.ts` `CliLifecycle` 持 repoRoot（构造改收 `repoRoot: string`）· spawn cwd（:203-207）发 repoRoot · `#cwd` 字段整体删 — checkable: `grep -n "this.#cwd" face/lifecycle.ts` 零命中 · `grep -n "process.cwd()" face/lifecycle.ts` 零命中
  - BLOCKED 回归 pin —— 非 git 仓（`git.topLevel` 返 null）→ 命令退 1 且 stderr 携因（非退 2 · 非 usage 文本） — checkable: 单测——tmp 非 git 目录下跑 implement → exit 1
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`（大量 `--root`/缝 pins 变红 → 归 T6 迁移；本步聚焦生产面编译 + 新增 BLOCKED pin）
- **Acceptance**: engine 生产 `process.cwd()` 恰 1 处 · `git.topLevel` 转换点恰 1 处 · `--root`/`cwd` 注入/`repoRoot` 注入三缝生产面零残留 · spawn cwd = repoRoot · 推算不出 → BLOCKED 退 1（零新消息面）· 引擎 vitest 通过（测试面 pins 留 T6）· EOF 恰一 newline
- **DependsOn**: 1

### Task 3: 输入漏斗唯一落点 + 仓库外路径告警（§2.3/§2.10）
- **Objective**: 归一化在 **CLI 输入解析处**发生**恰好一次**——`#runInput` 产 `RunInput` 之后、进入 scene 之前，对全部 path-typed argv 一次 `relativize` → `RepoPath`；下游 scene / lifecycle / capsule / preflight **只收 `RepoPath`**。纳入面：`--plan` · `--spec` · `--findings` · `schema get --output skeleton` 的位置参数 `<target>`。**派生 doc 引用重基（D46）**：plan 的 `**Spec:**` 头链接 target（`cli.ts:720-721` 取 `chain.specLink.target` · **link-space 原形** `../specs/X.md`，相对 plan 所在目录）经**同一漏斗**重基为 repoRoot 相对——先按 plan 目录解析再 `relativize`（当前留原形：child cwd=repoRoot 时 `../specs/X` 解到库外，路径坏）。**`--root` 已退役（T2）→ 无 basis-definer flag，漏斗无特例**。仓库外路径（`../outside/x.md`）→ **接 + stderr 告警**：形态仍单一（相对 repoRoot，含 `..`），读得动即放行。
- **Files**: Modify `packages/cdd-engine/src-next/face/cli.ts`（`#runInput` :380-393 之后 / `#sceneOf` :680-757 之前——对 `parsed.args.plan`（:690）/`spec`（:691）/`findings`（:621）/`base` 的 `--plan`（:802）+ skeleton 位置参数一次 `relativize`；**`#sceneOf` 的 `case "plan"`（:712-721）产 `specLink` 处同步重基**（`chain.specLink.target` link-space → repoRoot 相对）；`RunInput` 类型 :148-157 的 path 字段承载 `RepoPath`）· Modify `packages/cdd-engine/src-next/face/artifacts.ts` / `capsule.ts` / `session/preflight.ts`（读面签名收 `RepoPath`——裸 `string` 不可达）· Modify 相关 `__tests__`
- **Consumes**: T1（`RepoRoot.relativize`）· T2（无 basis-definer flag → 漏斗无特例）· spec §2.3/§2.10 授权
- **Produces**: 输入漏斗唯一落点（全部 path-typed argv 一次归一 → `RepoPath`）· **派生 `specLink` 重基 repoRoot 相对**（治 `INPUT_SPEC` link-space 原形）· scene/lifecycle/capsule/preflight 只收 `RepoPath`（编译期把守）· 仓库外路径接 + stderr 告警 · 供 T4（落盘 + round-context 全路径相对）消费
- **Steps**:
  - 漏斗落点 —— `face/cli.ts` 在 `#runInput` 之后集中一处对 `plan`/`spec`/`findings`/skeleton `<target>`/base `--plan` 调 `repoRoot.relativize(...)` → `RepoPath`（`repoRoot` 由 T2 唯一转换点产出） — checkable: 单测——仓内相对/绝对 argv 归一后拿到的 path 串一致（repoRoot 相对形）
  - `specLink` 重基 —— `#sceneOf` 的 `case "plan"`（:712-721）产 `specLink` 处：`chain.specLink.target`（link-space，相对 plan 目录）先 `path.resolve(path.dirname(planPath), target)` 再 `repoRoot.relativize` → repoRoot 相对串 — checkable: 单测——plan 的 `**Spec:** [x](../specs/y.md)` → `specLink === "docs/kairos/specs/y.md"`（非 `../specs/y.md`）
  - 读面收 `RepoPath` —— `artifacts.readText` / `capsule` / `preflight` 的 path 入参类型由 `string` 改 `RepoPath`（或经 `ctx.root` 解析）· 裸 `string` 到不了 read/write — checkable: tsc 通过（类型层拒裸 string）· `grep -n "RepoPath" face/artifacts.ts face/capsule.ts session/preflight.ts` 命中
  - 仓库外路径告警 —— `relativize` 结果含 `..` 分段 → stderr 提示「路径在仓库外」（写告警不拒） — checkable: 单测——`--plan ../outside/x.md` 读得动 + stderr 含告警 + exit 0
  - 同文档同 ref 回归 pin —— 同一文档绝对/相对 argv 归一后 `sameRef` **恒真**（虚假 drift 归零） — checkable: 单测——同 doc 两形调 → `progress.json` 单行 + round 续号（承 D26 doc 键实况化）
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`
- **Acceptance**: 输入漏斗唯一落点（全部 path-typed argv 一次归一 → `RepoPath`）· **`specLink` 重基 repoRoot 相对（`INPUT_SPEC` 零 link-space 原形）** · 下游读面只收 `RepoPath`（编译期把守）· 仓库外路径接 + stderr 告警 · 同文档绝对/相对 `sameRef` 恒真 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: 1

### Task 4: 落盘 + child prompt 全相对 + 旧数据迁移读时兜底（§2.7/§2.11）
- **Objective**: 唯一形态贯彻到底。① **落盘**：`progress.json` / `base.json` / wave carrier 内的一切路径存**相对 repoRoot**（`RepoPath`）。② **child prompt 全 8 路径 token 相对（D46 · 单一出口归一）**：注入子进程的**全部 8 个 round-context 路径 token** 均发**相对 repoRoot**——`WORKSPACE_DIR`（`lifecycle.ts:330`）· `OUTPUT_REPORT`/`OUTPUT_EVIDENCE`/`OUTPUT_HANDOFF`（`#outputOf`/`handoffPath` → `workspace.resolve` 现产**绝对**）· `INPUT_WAVE_BRIEF`（`scene.briefPath` ← `gate.ts:116` `workspace.resolve` 现产**绝对**）· `INPUT_DOC`/`INPUT_FINDINGS`（现为 **cwd 相对原形**——直传 argv/落盘串，`cwd ≠ repoRoot` 即偏离）· `INPUT_SPEC`（由 T3 重基）。**收口方式 = 单一出口**：在 `#valuesOf` 的 round-context 组装处对**全部 8 个路径 token 一笔归一**（`RepoRoot.relativize`），不在各 token 产出点各自处理——`#outputOf`/`handoffPath`/`gate.ts` 等仍可产绝对，`#valuesOf` 出口统一收口（一个基准、一处转换）。子进程 spawn cwd = repoRoot（T2），相对路径立即到达；子进程不自行 `chdir` 出仓库（由 T7 双 pin 兜住，spawn-cwd 归一因此是承重事实）。③ **旧落盘数据迁移**：一次性把磁盘上旧 `progress.json`/`base.json` 内残留的冗余形态路径串归一为相对并回写；**读时兜底**再 `relativize` 一次（防漏网——迁移处理历史，读时归一兜底）。
- **Files**: Modify `packages/cdd-engine/src-next/session/ledger.ts`（`#persist` :344-346 / `writeProgress` :370-373 与 `recordRound` :433 / `recordReviewedRevision` :450 等写入点——路径字段落 `RepoPath` 相对串）· Modify `packages/cdd-engine/src-next/face/artifacts.ts`（`baseSet` :120-142 写 `base.json` 路径字段相对）· Modify `packages/cdd-engine/src-next/face/lifecycle.ts`（**`#valuesOf` 组装处增「round-context 路径 token 单出口归一」**——对 `WORKSPACE_DIR`/`INPUT_DOC`/`INPUT_SPEC`/`INPUT_FINDINGS`/`INPUT_WAVE_BRIEF`/`OUTPUT_REPORT`/`OUTPUT_EVIDENCE`/`OUTPUT_HANDOFF` 一笔 `RepoRoot.relativize` · child prompt 面）· Modify `packages/cdd-engine/src-next/infra/workspace.ts`（读面 `readJson` :177-186 的路径字段读时兜底 `relativize`）· Modify 相关 `__tests__`
- **Consumes**: T1（`RepoRoot.relativize`）· T2（spawn cwd = repoRoot）· T3（`RepoPath` 读面 + `specLink` 重基）· spec §2.7/§2.11 授权
- **Produces**: 落盘路径全相对（`RepoPath`）· **child round-context 全 8 路径 token 相对**（`WORKSPACE_DIR`/`INPUT_DOC`/`INPUT_SPEC`/`INPUT_FINDINGS`/`INPUT_WAVE_BRIEF`/`OUTPUT_REPORT`/`OUTPUT_EVIDENCE`/`OUTPUT_HANDOFF` · 单一出口归一）· 旧落盘数据一次性迁移 + 读时兜底 · 供 T7（spawn-cwd pin）/T17（grep pin）消费
- **Steps**:
  - 落盘相对 —— `progress.json`/`base.json`/carrier 的路径字段写 `RepoPath` 相对串（非绝对） — checkable: 单测——写后文件内路径字段无根前缀（repoRoot 相对）
  - prompt 全 8 路径 token 单出口归一 —— `lifecycle.ts` `#valuesOf` 组装的 round-context 处，对 `WORKSPACE_DIR`（:330）· `INPUT_WAVE_BRIEF`（:297）· `OUTPUT_REPORT`/`OUTPUT_EVIDENCE`（`#outputOf` :326-327）· `OUTPUT_HANDOFF`（:328）· `INPUT_DOC`（:307）· `INPUT_FINDINGS`（:301-304）· `INPUT_SPEC`（:312）**统一一笔 `repoRoot.relativize`**——各产出点仍可产绝对/cwd 形，出口收口为 repoRoot 相对 — checkable: 单测——派发 prompt 的 8 个路径 token 均为 repoRoot 相对串（无绝对前缀、无 `../`、无 cwd 形）· `sync.calls[].cwd === repoRoot`
  - 旧数据迁移 —— 一次性归一磁盘旧 `progress.json`/`base.json` 内冗余形态路径并回写（迁移面/脚本或启动迁移） — checkable: 单测/迁移 pin——旧绝对形 fixture 经迁移后字段变相对形且可用
  - 读时兜底 —— 读面 `relativize` 一次（漏网绝对形读入即归一） — checkable: 单测——未迁移的旧绝对形 fixture 读入后内部值为相对形
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`
- **Acceptance**: `progress.json`/`base.json`/carrier 路径字段全相对 · **child round-context 全 8 路径 token 相对**（`WORKSPACE_DIR`/`INPUT_DOC`/`INPUT_SPEC`/`INPUT_FINDINGS`/`INPUT_WAVE_BRIEF`/`OUTPUT_REPORT`/`OUTPUT_EVIDENCE`/`OUTPUT_HANDOFF` · 零绝对串、零 link-space、零 cwd 原形 · 单出口归一）+ spawn cwd = repoRoot · 旧落盘数据经迁移 + 读时归一后可用 · 落盘 + prompt 零绝对路径串（grep pin）· 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: 1, 2, 3

### Task 5: 声明再抄消除——`#scanRoots` 单基准 + copy 派生（§2.8）
- **Objective**: ① **`invariants.ts:#scanRoots`（:1072-1076）单基准**：现 `own = path.dirname(docPath)` 拼 `path.dirname(own)` + 硬编码 `"specs"/"plans"`（绕开 `ENGINE_RUNTIME.docRoots` 的第二处声明）。重构为**同基准 root 解析后并**：`ctx.path` 于 T3 归一为 repoRoot 相对 `RepoPath`，`docRoots` 亦存 repoRoot 相对串（`docs/kairos/specs`）——一律经 `ctx.root` 解析后再并：`[path.join(ctx.root, path.dirname(ctx.path)), ...Object.values(ENGINE_RUNTIME.docRoots).map((r) => path.join(ctx.root, r))]`。**注**：引擎**不 chdir**（§2.4），未经 `ctx.root` 解析的相对串会落到 `process.cwd()`，故必须同基准。**签名变更**：现 `#scanRoots` 签名 `static #scanRoots(docPath: string)`（:1072，调用点 `#scanRoots(ctx.path)` :1049）须改为 `static #scanRoots(root: string, docPath: string)`——否则重构体读不到 `ctx.root`；调用点 :1049 改传 `#scanRoots(ctx.root, ctx.path)`。 ② **可执行 copy 从单源派生**：`invariants.ts:981` 的 finding 消息 `docs/kairos/...` 字面 · （核对 `face/declare.ts` help `example` 的 `docs/kairos/…` 字面 :202/:208/:234）——凡含 `docs/kairos/…` / `specs`/`plans` 字面者，从 `ENGINE_RUNTIME.docRoots` 派生，零硬编码副本。 ③ **注释 copy 随行清理**（board-view / workspace / doc.ts 的 7 处，G2 范围含）。
- **Files**: Modify `packages/cdd-engine/src-next/contract/invariants.ts`（`#scanRoots` 签名 :1072 改 `(root: string, docPath: string)` + 调用点 :1049 改传 `(ctx.root, ctx.path)` + 体 :1072-1076 改经 `ctx.root` + `ENGINE_RUNTIME.docRoots` 单源并 · finding 消息 :981 的 `docs/kairos` 字面从 `docRoots` 派生）· Modify `packages/cdd-engine/src-next/face/declare.ts`（help `example` :202/:208/:234 含 `docs/kairos/…` 者从 `docRoots` 派生）· Modify 注释 copy 站点（`face/board-view.ts` / `infra/workspace.ts` / `contract/doc.ts` 共 7 处）· Modify 相关 `__tests__`
- **Consumes**: T1（`ctx.root` 解析 · `RepoPath`）· T3（`ctx.path` 归一为 repoRoot 相对）· spec §2.8 授权（G15=a · G2=b）
- **Produces**: `#scanRoots` 同基准 root 解析（零独立硬编码 `"specs"/"plans"`）· finding 消息 + help `example` 的 `docs/kairos/…` 字面从 `ENGINE_RUNTIME.docRoots` 派生 · 注释 copy 清零 · 供 T15 的路径字面门
- **Steps**:
  - `#scanRoots` 单基准 —— `invariants.ts` 签名改 `static #scanRoots(root: string, docPath: string)`（:1072）· 调用点 :1049 改 `SiblingScanInvariant.#scanRoots(ctx.root, ctx.path)` · 体改 `[path.join(root, path.dirname(docPath)), ...Object.values(ENGINE_RUNTIME.docRoots).map((r) => path.join(root, r))]`（`root` 为绝对擦除点 · `docPath`/`docRoots` 皆 repoRoot 相对） — checkable: 单测——`#scanRoots` 返同基准绝对根集 · `grep -n "\"specs\"\|'specs'\|join(grand" contract/invariants.ts` 硬编码零命中
  - finding 消息派生 —— `:981` 的 `docs/kairos/...` 字面从 `ENGINE_RUNTIME.docRoots` 派生 — checkable: `grep -n "docs/kairos" contract/invariants.ts` 零命中（派生自单源）
  - help example 派生 —— `declare.ts` 的 help `example`（:202/:208/:234）含 `docs/kairos/…` 者从 `docRoots` 派生 — checkable: `grep -n "docs/kairos" face/declare.ts` 零命中
  - 注释 copy 清理 —— board-view / workspace / doc.ts 的 `docs/kairos`/`specs`/`plans` 注释副本随改或删 — checkable: `grep -rn "docs/kairos/specs\|docs/kairos/plans" face/board-view.ts infra/workspace.ts contract/doc.ts` 零命中（或仅存单源引用）
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`
- **Acceptance**: `#scanRoots` 同基准 root 解析（零独立硬编码）· `invariants.ts` / `declare.ts` 的 `docs/kairos` 硬编码零残留（读 `docRoots` 单源）· 注释 copy 清零 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: 1, 3

### Task 6: 命令声明面字节破格 + 测试面迁移（§2.5/§2.12）
- **Objective**: `--root` 退役（T2）使命令声明面字节变化——`implement` 等的 help `Options` 段由 `… [--root <path>]` 变为无该段（`Usage:` 行不含 `--root`，commander 原生）。此为 **deliberate 字节破格**（与 P5「字节语义 major」/P8 pin 破格同级），`next:` 字面冻结不受影响。**退役面清点**（不可只 chdir，须删 argv token）：① `cli.test.ts` 内 `"--root",` argv 站点**共 59 处**（含共享 helper `:1791`）——**59 = 58 可删 token + 1 存活负锚（`:621`）**；58 处 token **必须删除**（否则 `--root` 退役后全成 `error: unknown option '--root'`），`:621` 属负锚不删（见 ④）。② `projection.test.ts:71` review key 列表断言 `review` 声明 `--root` → 翻为**缺席**断言。③ help pin 翻转：`:916` `toContain("--root <path>")` 与 `:1111` `indexOf("--root") < indexOf("--dry-run")` **均翻负**。④ **`:621` = 存活负锚**：`runArgv(["--root","x","implement"])` 断言 `unknown option '--root'` 退 2——退役后**原样存活**（仍未知选项），不改。⑤ **测试隔离 chdir（§2.12）**：`cli.test.ts:135` `Cli.create({ io, repoRoot, ...opts })` 的 `repoRoot` 腿删除（`mkdir` fixture 后 `process.chdir(temp)` → `Cli.create({ io, ...opts })`）；真实迁移面 = `fixture()` 调用点全测试 **201 处**（`cli.test.ts` 121 · `ledger.test.ts` 36 · `run.test.ts` 24 · `wave.test.ts` 20）。**注**：命令精确列表 pin 现为**七项**（`cli.test.ts:439` · `projection.test.ts:57-65`——P8 已含 board），本 phase **不改**其成员。
- **Files**: Modify `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（删 **58** 处 `"--root",` argv token（行集见 recon：802 1312 … 3608，**排除负锚 :621**）· `fixture` helper :131-142 去 `repoRoot` 腿改 `process.chdir` · :916/:1111 help pin 翻负 · :621/:623 存活负锚不动 · :1705 注释随改）· Modify `packages/cdd-engine/src-next/face/__tests__/projection.test.ts`（:71 去 `--root`）· Modify `packages/cdd-engine/src-next/session/__tests__/{ledger,run,wave}.test.ts`（`fixture()` 调用点随 helper 迁移——36/24/20）
- **Consumes**: T2（`--root` 退役 + 缝退役）· spec §2.5/§2.12 授权
- **Produces**: `--root` argv token 全测试面零残留 · help pin 翻负 · fixture 走 `process.chdir` 隔离 · 七命令精确列表 pin 保持 · 供 T7（行为 pin）消费
- **Steps**:
  - `--root` argv token 删 —— `cli.test.ts` 删 **58** 处 `"--root",`（:621 spread 形保留其「未知选项」语义 = **不删该处**——:621 是负锚；:1791 / :2585 是 argv token，删） — checkable: 残存 `"--root",` 命中**恰 1 处且位于 :621**（`grep -n '"--root",' face/__tests__/cli.test.ts | grep -v '^621:'` 为空；负锚 :623 断言的字符串 `'--root'` 单引号形保留）
  - help pin 翻负 —— `:916` 改断言 `Options` 段**不含** `--root <path>` · `:1111` 的 `indexOf("--root") < indexOf("--dry-run")` 断言删除/翻负 — checkable: 两 pin 新语义绿
  - projection key 断言 —— `projection.test.ts:71` 的 key 列表去 `--root`（改断言 review **不声明** `--root`） — checkable: 单测绿
  - fixture chdir 迁移 —— `cli.test.ts` `fixture` helper（:131-142）改 `process.chdir(temp)` + `Cli.create({ io, ...opts })`（去 `repoRoot` 腿）· `afterEach` 复原 cwd · session 三测试文件 `fixture()` 调用点随之（helper 一改全生效） — checkable: `grep -rn "repoRoot:" face/__tests__/cli.test.ts` 零命中（`Cli.create` 面）· 全测试绿
  - 七命令 pin 保持 —— `cli.test.ts:439` / `projection.test.ts:57-65` 七项成员**不改** — checkable: 两 `toEqual` 断言逐字节不变绿
  - 全量 validate —— checkable: `pnpm -C packages/cdd-engine test` 全绿 · `pnpm -C packages/kairos test` 全绿
- **Acceptance**: `--root` argv token 全测试面零残留（:621 存活负锚保留其「未知选项」语义）· help pin 翻负 · fixture 走 `process.chdir` 隔离 · 七命令精确列表 pin 保持 · 引擎 vitest + kairos vitest 全绿 · EOF 恰一 newline
- **DependsOn**: 2

### Task 7: 双 pin——结构 pin + 行为 pin（§2.9）
- **Objective**: 两 pin 护的**不是同一事实**，须双立（历史教训正是「单源 + 单转换点 + pin **三者全丢**」）。① **结构 pin**（grep 级断言）：engine 生产代码 `process.cwd()` **恰好 1 处** · `git.topLevel` **转换点恰好 1 处**（排除测试面）。② **行为 pin**：`FakeSync` 的 `call.cwd === repoRoot`——**补现存零覆盖**（recon 实测：`calls[].cwd` 有 11 处 `.args`/`.command` 索引访问但**零处读 `.cwd`**，字段当前只写不读）。
- **Files**: Modify `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`FakeSync` :4635-4647 的 `calls[].cwd` 读断言——行为 pin；结构 pin 的 grep 断言）· 或新增 colocated 结构 guard（`face/__tests__/repo-root.guard.test.ts`）
- **Consumes**: T2（唯一转换点 + spawn cwd = repoRoot）· T6（测试面迁移后 FakeSync fixture 走 chdir）· spec §2.9 授权
- **Produces**: 结构 pin（`process.cwd()` 恰 1 · `git.topLevel` 转换恰 1）· 行为 pin（`call.cwd === repoRoot` · 补零覆盖）· 供 T17（全量验证）消费
- **Steps**:
  - 结构 pin —— grep 级 guard：engine 生产（排除 `__tests__`）`process.cwd()` 恰 1 命中 · `git.topLevel` 转换恰 1 命中 — checkable: guard 断言绿 · 人为加一处则红
  - 行为 pin —— `FakeSync` 记录 `calls[].cwd`（:4636/#644）· 新增断言：派发 child 后 `sync.calls.at(-1)!.cwd === repoRoot`（repoRoot 为 fixture 经 chdir 后之根） — checkable: 单测——implement/review/fix 任一派发后 `call.cwd === repoRoot`
  - 双 pin 隔离验证 —— 结构 pin 与行为 pin 覆不同事实（结构护转换点 · 行为护 spawn） — checkable: 两 pin 各自可独立翻红
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`
- **Acceptance**: 结构 pin（`process.cwd()` 恰 1 · `git.topLevel` 转换恰 1）绿 · 行为 pin（`call.cwd === repoRoot`）绿且补零覆盖 · 两 pin 覆盖不同事实 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: 2, 6

### Task 8: floor 面单源——install floor + type-stripping floor 各钉正确单源（②·§3.1）
- **Objective**: ② 实为**两个不同事实**，不得并作一源：**① 安装 floor（install floor）**：`packages/cdd-engine/package.json#engines` = `>=24`（:6-8）vs `packages/cdd-engine/README.md:13` / `README.zh-CN.md:15` = `>= 22.12.0`——**真发散**，收口为单源。**② 源码直跑 floor（type-stripping floor）**：`bin.ts:23` `NODE_FLOOR = {major:22,minor:18}` vs `README.md:44` / `README.zh-CN.md:46`（`Node ≥22.18 native type stripping`）——**此亦有副本**，收口为单源。**不可合并**：从 `package.json#engines`（`>=24`）派生 `NODE_FLOOR` 会使守卫**过严**（拒 Node 22.18–23.x，而 README 明示其源码直跑可用）。故 ② 须 (a) 拆分两事实、(b) 清点全部 **4 处 README 站点**（`README.md:13/44` + 镜像 `README.zh-CN.md:15/46`）、(c) 每事实各钉**正确**单源。
- **Files**: Modify `packages/cdd-engine/src-next/bin.ts`（`NODE_FLOOR` :23 保持 type-stripping floor=22.18 · 或与 README 同源化）· Modify `packages/cdd-engine/package.json`（`engines` install floor 单源）· Modify `packages/cdd-engine/README.md`（:13 install floor 与 `#engines` 对齐 · :44 type-stripping floor 与 `NODE_FLOOR` 对齐）· Modify `packages/cdd-engine/README.zh-CN.md`（:15/:46 同步镜像）· Modify 相关 `__tests__`
- **Consumes**: 无（root 任务）· spec §3.1 ② 授权
- **Produces**: install floor 单源一致（`package.json#engines` ↔ README ×2 行）· type-stripping floor 单源一致（`bin.ts` `NODE_FLOOR` ↔ README ×2 行）· 一致性门（发散即 fail）
- **Steps**:
  - 两事实拆分清点 —— 确认 install floor（`#engines`）与 type-stripping floor（`NODE_FLOOR`）为两事实 + 4 README 站点 — checkable: 清点记录（4 站点 file:line）
  - install floor 对齐 —— README.md:13 + README.zh-CN.md:15 与 `package.json#engines` 对齐（单源） — checkable: 门断言 README install 行 == `#engines` 派生
  - type-stripping floor 对齐 —— README.md:44 + README.zh-CN.md:46 与 `NODE_FLOOR` 对齐 — checkable: 门断言 README dev 行 == `NODE_FLOOR` 派生（22.18）
  - 一致性门 —— engine suite 加门（两 floor 各发散即 fail） — checkable: 单测——人为改 README 一行则红
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`
- **Acceptance**: 两 floor 各单源一致（门绿）· 4 README 站点清点齐 · `NODE_FLOOR` 未被 `>=24` 误并（守卫不过严）· 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 9: Doc-type writer——skeleton 补 `Doc type` 头行（⑩）+ ⑳ 面间派生复核（§3.1）
- **Objective**: ⑩ `**Doc type**` 写者缺——`board-view`/`preflight`/`capsule`/`cli` **依赖**该头行（缺则 BLOCK），而 `render/skeleton.ts` **不产出**（`grep "Doc type"` 零命中；`HEADER_FORMS` :32-38 无该形）→ 引擎自产骨架过不了自己 preflight。**本会话已实证**：P9 骨架由 `schema get phase-spec --output skeleton` 生成后**缺** `- **Doc type**: phase-spec` 头行，author 时手工补入方过 gate。收口：skeleton 渲染补齐该头行（按所渲 doc 型填 `DocKey`）+ 回归门（引擎自产骨架必过自身 preflight）。**⑳ 复核**：board `#nextOf`（:456-512）已 hot-fix 委托 `NextStepRouter.walk`（`next.ts:248-272`）——本 phase 复核其单源回归 pin（`next.test.ts` walk 用例 + `board-view.test.ts` 三处重锚）在位且绿。
- **Files**: Modify `packages/cdd-engine/src-next/render/skeleton.ts`（`HEADER_FORMS` :32-38 + `#headerLine` :266-288 增 `Doc type` 头行形 · 按渲染目标 doc 型填 `DocKey`）· Modify `packages/cdd-engine/src-next/render/__tests__/`（骨架含头行 + 过 preflight 回归 pin）· 复核 `packages/cdd-engine/src-next/session/__tests__/next.test.ts` + `face/__tests__/board-view.test.ts`（⑳ 回归 pin 在位）
- **Consumes**: T11（`DocKey` 值域——头行合法值；skeleton 渲染按目标 doc 型填正确 `DocKey` 字面，故 T11 非硬前置）· spec §3.1 ⑩/⑳ 授权
- **Produces**: skeleton 产出含 `- **Doc type**: <DocKey>` 头行 · 引擎自产骨架过自身 preflight（回归门）· ⑳ 回归 pin 复核记录 · 供 T15（声明面）
- **Steps**:
  - skeleton 补头行 —— `render/skeleton.ts` 增 `Doc type` 头行形（`HEADER_FORMS` + `#headerLine`），按渲染目标 doc 型填正确 `DocKey`（phase-spec/overall-spec/plan/single-spec） — checkable: `grep -n "Doc type" render/skeleton.ts` 命中 · 单测——`schema get <type> --output skeleton` 产物含 `- **Doc type**: <对应值>`
  - 自产骨架过 preflight 回归 —— 全 doc 型的 skeleton 产物喂 preflight docKey 门**通过**（不再 BLOCK） — checkable: 单测——四型骨架 preflight docKey 读面绿
  - ⑳ 复核 —— `NextStepRouter.walk`（`next.ts:248-272`）+ board `#nextOf`（`board-view.ts:456-512`）委托关系在位 · `next.test.ts` walk 用例（含 off-by-one 守卫）+ `board-view.test.ts` 三处 pin 绿 — checkable: `pnpm -C packages/cdd-engine test` 中 walk/board pins 绿 · `grep -n "NextStepRouter.walk" face/board-view.ts` 命中
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`
- **Acceptance**: `schema get --output skeleton` 产物含 `**Doc type**` 头行且过自身 preflight（回归 pin）· 四 doc 型骨架齐 · ⑳ `NextStepRouter.walk` 单源在位且回归 pin 绿 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 10: issue-body 单源收口——label 表 + components + 孤儿字段（①⑤⑰·§3.1/§3.2/§3.4）
- **Objective**: `templates/report/issue-body.json` 现**零 reader**（recon 实测：无任何 `.ts` 读该文件），是「宣称的 oracle」假声明，其内容与渲染器实读的 `words.ts` **已发散**。三事同栖一文件，一并收口：**① label 表已发散**——engine `words.ts:181-192`（`ISSUE_LABEL_WORDS`，渲染器实读 · 12 行）vs JSON `:21`（`sectionLabels`，零 reader）—— 已不一致（`bug.context` zh `## 场景` vs `## 背景` · `enhancement.en` `problem` `## Gap` vs `## Current behavior` 等）。**⑤ components 名册**（JSON `:2-11` 的 8 串）——6 个 kairos 组件 = `"kairos:" + roster-key`（需前缀变换），2 非 skill 组件（`kairos (general)` · `cdd-engine`）为固定头**无 roster 源**。**⑰ 孤儿字段**（`severities` :12 · `metaFields` :17 · `reportDef` :195 · `masterDef` :198`）零 reader。收口决策（D26 单源）：**`words.ts`（渲染器实读）为唯一权威源**；`issue-body.json` 或**删除**（零 reader → 死声明）或改为**从单源派生 + 一致性门**（保留为文档面则门钉向 `words.ts` + `SKILL_ROSTER`）。
- **Files**: Modify `packages/cdd-engine/src-next/face/words.ts`（`ISSUE_LABEL_WORDS` :181-192 单源确认）· Modify/Delete `packages/cdd-engine/templates/report/issue-body.json`（8 串 components + 孤儿字段收口）· Modify `packages/kairos/skills/cdd-report/SKILL.md`（或引用面 · 若 JSON 删除则去其宣称）· Modify 相关 `__tests__`
- **Consumes**: 无（root 任务）· spec §3.1 ①/§3.2 ⑤/§3.4 ⑰ 授权
- **Produces**: issue-body label 表单源（`words.ts` 权威 · 门钉一致）· components 名册（kairos 6 = roster 派生 + 2 固定头）· JSON 孤儿字段清除（或 JSON 整体退役）· 供 T13（⑥ chore 契约）消费
- **Steps**:
  - 单源决策落地 —— 确认 `words.ts:181-192` 为唯一权威 label 源；`issue-body.json` 删除（零 reader 死声明）**或**改为派生 + 门 — checkable: `grep -rn "issue-body.json" packages/cdd-engine/src-next --include=*.ts` 零命中（若删）· 或门断言 JSON == `words.ts` 派生
  - label 表一致性门 —— `bug.context` 等已发散项收口为一致（门绿） — checkable: 单测——label 门断言源与派生一致（发散即 fail）
  - components 名册派生 —— 6 kairos 组件 = `"kairos:" + SKILL_ROSTER key`（前缀变换）· 2 固定头（`kairos (general)`/`cdd-engine`）显式声明无 roster 源 — checkable: 单测——名册 8 串与 `SKILL_ROSTER`（:149-156）派生 + 2 固定头一致
  - 孤儿字段清除 —— `severities`/`metaFields`/`reportDef`/`masterDef` 删（或补消费方 · 无则删） — checkable: `grep -n "severities\|metaFields\|reportDef\|masterDef" templates/report/issue-body.json` 零命中（或各具 reader）
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`
- **Acceptance**: label 表单源一致（门绿 · `bug.context` 发散归零）· components 名册派生（6 roster + 2 固定头）· JSON 孤儿字段零残留（或全具 reader）· `issue-body.json` 或删或门钉单源 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 11: `DocKey` 单源派生（③·§3.2）
- **Objective**: `DocKey` 手抄 **5 处**（recon 确认值域 `overall-spec | plan | phase-spec | single-spec`）：`contract/project.ts:48`（声明）· `contract/judge.ts:37`（`DOC_KEYS`）· `contract/declare.ts:112-117`（`DOC_TYPE_VALUES`）· `face/board-view.ts:117`（`DOC_TYPE_DOMAIN`）· `contract/doc.ts:311`（inline union · 另有 `doc.ts:111` 第二处 inline）。三运行时数组（`DOC_KEYS`/`DOC_TYPE_VALUES`/`DOC_TYPE_DOMAIN`）从 `DocKey` 派生 + 一致性门。
- **Files**: Modify `packages/cdd-engine/src-next/contract/project.ts`（`DocKey` :48 保为唯一声明）· Modify `packages/cdd-engine/src-next/contract/judge.ts`（`DOC_KEYS` :37 从 `DocKey` 派生）· Modify `packages/cdd-engine/src-next/contract/declare.ts`（`DOC_TYPE_VALUES` :112-117 派生）· Modify `packages/cdd-engine/src-next/face/board-view.ts`（`DOC_TYPE_DOMAIN` :117 派生）· Modify `packages/cdd-engine/src-next/contract/doc.ts`（inline union :311/:111 收归 `DocKey`）· Modify 相关 `__tests__`
- **Consumes**: 无（root 任务）· spec §3.2 ③ 授权
- **Produces**: `DocKey` 唯一声明（`project.ts:48`）· 三运行时数组从 `DocKey` 派生 · 一致性门 · 供 T9（skeleton 头行值域）消费
- **Steps**:
  - 派生三数组 —— `judge.DOC_KEYS` / `declare.DOC_TYPE_VALUES` / `board-view.DOC_TYPE_DOMAIN` 由字面改为从 `DocKey` 派生（如 `const DOC_KEYS: readonly DocKey[] = [...]` 键入 `DocKey`，或经共享常量） — checkable: 单测——三数组与 `DocKey` 值域全等
  - inline union 收归 —— `doc.ts:311`/`:111` 的 inline union 改引 `DocKey` — checkable: `grep -n "\"overall-spec\"" contract/doc.ts` 零命中（改引 `DocKey`）
  - 一致性门 —— engine suite 加门：任一数组与 `DocKey` 发散发散即 fail — checkable: 单测——人为漏一员则红
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`
- **Acceptance**: `DocKey` 唯一声明 · 三运行时数组 + inline union 全从 `DocKey` 派生 · 一致性门绿 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 12: 单源抽取杂项——base.md schema + implement 字面 + phase-suffix 语法（⑪⑫⑬·§3.2）
- **Objective**: ① **⑪ `base.md` schema**：`cdd-dev/docs/base.md:34-58` 的 schema（`{base, source, plan, recordedAt}`）与 `BaseArtifact`（`artifacts.ts:30-39`）对齐 + 门——**注** `base.md` :54 声明 `source` 为 `enum(4)`（`plan-field/branch-upstream/conversation-context/user-confirmed`，值源 `declare.ts:76` 的 `values`），而 `BaseArtifact.source` 类型为裸 `string`（:34）——发散点收口。② **⑫ `mattpocock-skills:implement` 字面 ×2**：`render/templates.ts:167`（`IMPLEMENT_SHELL` shell prose）从 `DISPATCH.implement`（`host.ts:219-220`）派生。③ **⑬ phase-suffix 语法 2 正则**：`workspace.ts:106`（`(?<suffix>-p\d+(?:\.\d+)*)$`）· `board-view.ts:147`（`^p\d+(?:\.\d+)*$`）——同为 slug phase-suffix 语法，共享常量 + 一致性门（**注** `contract/declare.ts:375/449` 的 `P\d+-design`（大写 + `-design` 尾）属**另一事实**，不并入）。
- **Files**: Modify `packages/kairos/skills/cdd-dev/docs/base.md`（schema 与 `BaseArtifact` 对齐 · 或去宣称）· Modify `packages/cdd-engine/src-next/face/artifacts.ts`（`BaseArtifact.source` :34 收窄为值域 union 或声明对齐）· Modify `packages/cdd-engine/src-next/render/templates.ts`（`IMPLEMENT_SHELL` :167 从 `DISPATCH.implement` 派生）· Modify `packages/cdd-engine/src-next/infra/workspace.ts`（phase-suffix 正则 :106 提为共享常量）· Modify `packages/cdd-engine/src-next/face/board-view.ts`（:147 正则改引共享常量）· Modify 相关 `__tests__`
- **Consumes**: 无（root 任务）· spec §3.2 ⑪/⑫/⑬ 授权
- **Produces**: `base.md` ↔ `BaseArtifact` 对齐 + 门 · `implement` 字面单源（`DISPATCH.implement`）· phase-suffix 语法共享常量 + 一致性门 · 供 T15（跨面门）
- **Steps**:
  - `base.md` ↔ `BaseArtifact` —— `base.md` 的 schema 与 `artifacts.ts:30-39` 字段集对齐 · `source` 的 enum(4) 与 `declare.ts:76` 值域对齐（`BaseArtifact.source` 类型收窄或门钉）：门断言字段集 + 值域一致 — checkable: 单测/门绿 · 字段集清点一致
  - `implement` 字面派生 —— `templates.ts:167` 的 `mattpocock-skills:implement` 从 `DISPATCH.implement`（`host.ts:220`）派生 — checkable: `grep -n "mattpocock-skills:implement" render/templates.ts` 零命中（派生自 `DISPATCH`）
  - phase-suffix 共享常量 —— `workspace.ts:106` 与 `board-view.ts:147` 的 slug 语法提为共享常量（如 `PHASE_SUFFIX`）；门断言两处一致 — checkable: `grep -rn "p\\\\d+(?:\\\\.\\\\d+)\\*" infra/workspace.ts face/board-view.ts` 单源命中 · 门绿（两处派同一常量）
  - 跑引擎套件 —— checkable: `pnpm -C packages/cdd-engine test`
- **Acceptance**: `base.md` ↔ `BaseArtifact` 对齐（字段集 + `source` 值域）· `implement` 字面单源（`DISPATCH.implement`）· phase-suffix 2 正则共享常量（一致性门绿）· 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 13: 缺门补齐——edgeConditionWords + chore + INSTALL_ROWS + PIPELINE_NEXT↔REFS（④⑥⑦⑨·§3.3）
- **Objective**: 声明在、检查无的四项补真门。① **④ `edgeConditionWords` 假派生 pin**：`skill-anatomy.ts:257-259` docstring 声称「wording test pins the derivation」**实为 0 reader**（`edgeConditionWords` :261 零测试消费）→ 补真门（从 `ledger.ts`/`words.ts`/`next.ts` 的 Route 词表派生并 pin）。② **⑥ `chore` 契约**：`cdd-report/SKILL.md:88` 声明 `{bug | enhancement}`，引擎 `render/issue-body.ts:52` 收 `{bug | enhancement | chore}`（且错误字节不符）→ 单源 + 一致性门。③ **⑦ `INSTALL_ROWS` ↔ README**：`host.ts:139` docstring 称「README renders from these rows」**实为空言**（零 consumer 渲 README）→ README 安装表钉向 `INSTALL_ROWS`（门）或改为真派生。④ **⑨ `PIPELINE_NEXT` ↔ `REFS` 无闭合门**：`next.ts:88-94` 的 ref 键与 `host.ts:231-288` 的 `REFS` 无 cross-closure 门（`channel-closure.guard` :73-101 只覆盖 `DISPATCH`）→ 闭合门扩项（含 `PIPELINE_NEXT`）。
- **Files**: Modify `packages/cdd-engine/src-next/contract/skill-anatomy.ts`（`edgeConditionWords` :261 真门 · 或删假 pin）+ `packages/kairos/tests/skill-anatomy.test.ts`（消费 `edgeConditionWords`）· Modify `packages/kairos/skills/cdd-report/SKILL.md`（:88 `chore` 值域对齐）+ `packages/cdd-engine/src-next/render/issue-body.ts`（:52 单源对齐 + 错误字节）· Modify `packages/cdd-engine/src-next/face/host.ts`（`INSTALL_ROWS` :139 · README 门）· Modify `packages/cdd-engine/src-next/face/__tests__/channel-closure.guard.test.ts`（:73-101 扩 `PIPELINE_NEXT` 闭合）+ `session/next.ts`（`PIPELINE_NEXT` :88-94）· Modify 相关 `__tests__`
- **Consumes**: T10（issue-body label 单源——⑥ chore 对齐）/ T11（`DocKey`）· spec §3.3 ④/⑥/⑦/⑨ 授权
- **Produces**: `edgeConditionWords` 真派生门（假 pin 消除）· `chore` 契约单源一致 · `INSTALL_ROWS` ↔ README 门 · `PIPELINE_NEXT` ↔ `REFS` 闭合门（guard 扩项）· 供 T15（跨面门）消费
- **Steps**:
  - ④ edgeConditionWords 真门 —— 从 `ledger.ts`/`words.ts`/`next.ts` 的 Route 词表派生并在 kairos suite pin（假 pin 消） — checkable: kairos suite 消费 `edgeConditionWords`（`grep -n "edgeConditionWords" packages/kairos/tests/skill-anatomy.test.ts` 命中）
  - ⑥ chore 契约 —— `cdd-report/SKILL.md:88` 与 `issue-body.ts:52` 值域单源一致（含错误字节） — checkable: 门断言 SKILL 声明 == 渲染器值域
  - ⑦ INSTALL_ROWS ↔ README —— README 安装表钉向 `INSTALL_ROWS`（门）或改真派生 — checkable: 门断言 README 安装行 == `INSTALL_ROWS` 派生
  - ⑨ 闭合门扩项 —— `channel-closure.guard` 增 `PIPELINE_NEXT` 的 ref 键 ⊆ `REFS` 断言 — checkable: guard 断言绿 · 人为加未登记 ref 则红
  - 跑两套件 —— checkable: `pnpm -C packages/cdd-engine test` + `pnpm -C packages/kairos test`
- **Acceptance**: `edgeConditionWords` 有真派生门（假 pin 消除）· `chore` 契约单源一致 · `INSTALL_ROWS` ↔ README 门绿 · `PIPELINE_NEXT` ↔ `REFS` 闭合门绿 · 门归属分域（④⑦⑨ 引擎 · ⑥ 消费面）· 两套件全绿 · EOF 恰一 newline
- **DependsOn**: 10, 11

### Task 14: 死声明清理——cache + HandoffFamily + CRASH_TAIL_LINES + setupRepo（⑧⑯⑱⑲·§3.4）
- **Objective**: T1=a「全收 · 声明即事实」——死声明或删或补消费方，无中间态。① **⑧ `HOSTS[*].cache` 零消费**：`host.ts:96`（字段）+ :168-175/:191/:207（值）零 reader（recon 实测 `.cache` 0 命中）→ 删或补消费方。② **⑯ `HandoffFamily` 死字段**：`runtime.ts:43-61`——`fixTemplate`(:58)/`prev`(:60)/`round`(:47)/`phase`(:49)/`fixFamily`(:56) **零 reader**（仅 `name`/`schema` 被 `ledger.ts`/`lifecycle.ts` 读）→ 删死字段（保 `name`/`schema`）。③ **⑱ `CRASH_TAIL_LINES` 幽灵常量**：`ledger.ts:168/170` 注释引用**不存在的符号**（实际 populate 在 `lifecycle.ts:505-506` 无该常量）→ 注释修正或补常量。④ **⑲ `setupRepo` 死 helper**：`packages/kairos/tests/helpers.ts:72-89` **零调用方**（整个 helper 死码）→ 删。
- **Files**: Modify `packages/cdd-engine/src-next/face/host.ts`（`cache` 字段 :96 + 值 :168-175/:191/:207 删或补消费）· Modify `packages/cdd-engine/src-next/infra/runtime.ts`（`HandoffFamily` :43-61 死字段删 + `HANDOFF_FAMILIES` :101-168 同步）· Modify `packages/cdd-engine/src-next/session/ledger.ts`（`CRASH_TAIL_LINES` 注释 :168/:170 修正）· Delete `setupRepo`（`packages/kairos/tests/helpers.ts:72-89`）· Modify 相关 `__tests__`（`infra.test.ts:51-72` 的 `HANDOFF_FAMILIES` 断言同步）
- **Consumes**: T5（`runtime.ts`——同文件）/ T10（issue-body 死字段——同类）· spec §3.4 ⑧/⑯/⑱/⑲ 授权
- **Produces**: `HOSTS[*].cache` 零残留（删或补 reader）· `HandoffFamily` 死字段零残留 · `CRASH_TAIL_LINES` 幽灵注释修正 · `setupRepo` 删除 · 供 T17 全量验证
- **Steps**:
  - ⑧ cache —— `HOSTS[*].cache` 字段 + 值删（零 reader）或补真消费方 — checkable: `grep -n "\.cache\b" face/host.ts` 零命中（或具 reader）
  - ⑯ HandoffFamily 死字段 —— 删 `fixTemplate`/`prev`/`round`/`phase`/`fixFamily`（保 `name`/`schema`）+ `HANDOFF_FAMILIES` 表同步 + `infra.test.ts` 断言同步 — checkable: `grep -n "fixTemplate\|fixFamily\|prev?\|round?\|phase?" infra/runtime.ts` 零命中
  - ⑱ CRASH_TAIL_LINES —— 注释（:168/:170）修正为实际实现（或补常量） — checkable: `grep -n "CRASH_TAIL_LINES" session/ledger.ts` 零命中（或符号存在）
  - ⑲ setupRepo —— 删 `packages/kairos/tests/helpers.ts:72-89` 死 helper — checkable: `grep -rn "setupRepo" packages/kairos` 零命中
  - 跑两套件 —— checkable: `pnpm -C packages/cdd-engine test` + `pnpm -C packages/kairos test`
- **Acceptance**: `HOSTS[*].cache` 零残留（或具 reader）· `HandoffFamily` 死字段零残留 · `CRASH_TAIL_LINES` 幽灵消除 · `setupRepo` 删除（零调用方）· 两套件全绿 · EOF 恰一 newline
- **DependsOn**: none

### Task 15: 跨面散文一致性门——SKILL ref ↔ REFS + SKILL path ↔ ENGINE_RUNTIME（⑭⑮·§3.5）
- **Objective**: **只加一致性门（测试断言），不改 SKILL.md 文本**（S2=a）。① **⑭ SKILL ref 串 ↔ `REFS`**：SKILL prose 的 `/repo:skill` + `pi：/skill:bare` 串（如 `cdd-close/SKILL.md:28` `/superpowers:finishing-a-development-branch（pi：/skill:finishing-a-development-branch）`）钉向 `host.ts` 的 `REFS`（:231-288）——**发散即 fail**。② **⑮ SKILL 路径字面 ↔ `ENGINE_RUNTIME`**：SKILL prose 的 `docs/kairos/…` / `.kairos/cdd` 字面（如 `cdd-close/SKILL.md:29` · `cdd-report/SKILL.md:8/35/44/49`）钉向 `ENGINE_RUNTIME`（`runtime.ts:174`）——发散即 fail。**姿态**：ref 串是执行契约、路径是用户面约定，皆该被 pin；D29 黑盒边界守约（门是外部对照，非向文本注入实现）。归属 = **kairos suite**。
- **Files**: Modify `packages/kairos/tests/`（新增或扩一致性门——SKILL prose ref 串 ↔ engine `REFS` · SKILL 路径字面 ↔ `ENGINE_RUNTIME`；读者经 engine 导出读 `REFS`/`ENGINE_RUNTIME`）
- **Consumes**: T12（`DISPATCH` 字面单源——`REFS`/ref 面稳定）· T13（⑨ `PIPELINE_NEXT`↔`REFS` 闭合——`REFS` 面稳定）· spec §3.5 ⑭/⑮ 授权
- **Produces**: SKILL ref 串 ↔ `REFS` 一致性门 · SKILL 路径字面 ↔ `ENGINE_RUNTIME` 一致性门 · SKILL.md 文本零改（姿态守约）· 供 T17 全量验证
- **Steps**:
  - ⑭ SKILL ref 门 —— kairos suite 抽 SKILL prose 的 `/repo:skill` + `pi：/skill:bare` 串，钉向 engine `REFS`（发散即 fail） — checkable: 单测——`REFS` 存该 skill 但 SKILL prose 拼写不符则红
  - ⑮ SKILL path 门 —— 抽 SKILL prose 的 `docs/kairos/…` / `.kairos/cdd` 字面，钉向 `ENGINE_RUNTIME`（`docRoots`/`workspaceRoot`） — checkable: 单测——`ENGINE_RUNTIME` 与 SKILL 字面不符则红
  - 文本零改复核 —— 姿态：SKILL.md 承载语义零改（仅加外部门） — checkable: `git diff --stat packages/kairos/skills/*/SKILL.md` 零改动
  - 跑 kairos 套件 —— checkable: `pnpm -C packages/kairos test` 全绿
- **Acceptance**: SKILL ref 串 ↔ `REFS` 门绿 · SKILL 路径字面 ↔ `ENGINE_RUNTIME` 门绿 · SKILL.md 文本零改（D29 守约）· 归属 kairos suite · kairos 套件全绿 · EOF 恰一 newline
- **DependsOn**: 12, 13

### Task 16: frontmatter 门 + 消裸冒号（§4）
- **Objective**: ④ **门（契约驱动 · G6=b）**：`SkillAnatomyContract`（`skill-anatomy.ts`：主对象 `SKILL_ANATOMY` :160-273 · 接口 :110-130 · **现无 `frontmatter` 槽**）增 **frontmatter 槽位**——声明「SKILL.md frontmatter 必须过真实 YAML 解析器」规则；`skill-anatomy.test.ts`（聚合断言 `SkillAnatomyCheck.check()` :148-304 · 末测 :453-457）从契约读规则执行——对每 SKILL.md 抽取 frontmatter 块调 `yaml.parse()`，失败即 finding（进既有聚合断言）。**归属 = kairos suite**（消费面 · T2=a）。⑤ **修（消裸冒号 · G6=ii）**：三处 `description` 的裸 ASCII `: `（`the engine's next: line`——`cdd-dev/SKILL.md:3` · `cdd-plan/SKILL.md:3` · `cdd-spec-writer/SKILL.md:3`）**改写措辞消掉**（非加引号）——直灭病根（散文里裸 `: ` 本就是散文堆砌，违前提③；加引号只是绕过解析器）。门（④）作结构兜底，使该类缺陷不再复发。
- **Files**: Modify `packages/cdd-engine/src-next/contract/skill-anatomy.ts`（`SKILL_ANATOMY` 增 `frontmatter` 槽 · 接口 :110-130 同步）· Modify `packages/kairos/tests/skill-anatomy.test.ts`（从契约读 frontmatter 规则 · `yaml.parse` 校验每 SKILL.md frontmatter · 失败进聚合断言）· Modify `packages/kairos/skills/cdd-dev/SKILL.md`（description :3 消裸 `: `）· Modify `packages/kairos/skills/cdd-plan/SKILL.md`（:3 同）· Modify `packages/kairos/skills/cdd-spec-writer/SKILL.md`（:3 同）· 依赖：`yaml`（真实解析器——`kairos` 或 root devDependency）
- **Consumes**: 无（root 任务）· spec §4 授权（G6=b · G6=ii · T2=a）
- **Produces**: `SkillAnatomyContract` 含 frontmatter 槽（真实 YAML 解析规则）· 全 6 SKILL.md frontmatter 过 `yaml.parse()`（门绿）· 三处 `description` 零裸 `: ` · 供 T17 全量验证
- **Steps**:
  - 契约 frontmatter 槽 —— `skill-anatomy.ts` 的 `SkillAnatomyContract` 接口 + `SKILL_ANATOMY` 常量增 `frontmatter` 槽（声明 frontmatter-YAML-validity 规则） — checkable: `grep -n "frontmatter" contract/skill-anatomy.ts` 命中
  - checker 执行 —— `skill-anatomy.test.ts` 从契约读规则，对每 SKILL.md 抽 frontmatter 块调 `yaml.parse()`，失败即 finding（进 `check()` 聚合断言） — checkable: `grep -n "yaml.parse\|frontmatter" packages/kairos/tests/skill-anatomy.test.ts` 命中 · 单测——人为造含裸 `: ` 的 description 则红
  - 消裸冒号 —— 三 SKILL.md 的 `description` `the engine's next: line` 改写措辞消掉（非加引号） — checkable: `grep -rn "next: line" packages/kairos/skills/*/SKILL.md` 的 frontmatter `description` 行零命中 · 全 6 SKILL.md frontmatter 过 `yaml.parse()`
  - 全 6 SKILL 门绿 —— 契约驱动的 frontmatter 门对 6 SKILL.md 全过 — checkable: `pnpm -C packages/kairos test` 全绿
- **Acceptance**: `skill-anatomy` 契约含 frontmatter 槽（真实 YAML 解析规则）· 全 6 SKILL.md frontmatter 过 `yaml.parse()`（门绿）· 三处 `description` 零裸 `: `（改措辞非加引号）· 归属 kairos suite · kairos 套件全绿 · EOF 恰一 newline
- **DependsOn**: none

### Task 17: 消费面同步 + 跨套件 pin 终锚 + 全量验证（§2.5 收口 · AC 过程门）
- **Objective**: 汇流收敛——消费面文档同步 + 跨套件 pin 终锚 + 全量 validate。① **README 同步**：`packages/cdd-engine/README.md` ×2 若记载 `--root`（T2/§2.5 字节破格）则随改（去 `--root` 段）· `packages/cdd-engine/README.md`/`.zh-CN.md` 的 floor 行已由 T8 对齐。② **pin 终锚**：跨 wave 的下一类 pin 归位——`cli.test.ts`/`projection.test.ts` 的 help/key/结构 pins（T6 已完成，此处仅复核）· board/capsule next 面 pins（⑳ · T9 复核）· 一致性门（T10–T16）。③ **全量验证**：`pnpm -C packages/cdd-engine test` + `pnpm -C packages/kairos test` + `pnpm run validate` ALL PASS · `pnpm run emit:check` OK · 零裸函数 grep 零命中 · EOF 全绿 · changeset（cdd-engine）落 pending。**注**：本任务**不做新功能**，只做终锚与全量闸门（catch-all 反模式规避——逐项归位已有任务产物）。
- **Files**: Modify `packages/cdd-engine/README.md` + `packages/cdd-engine/README.zh-CN.md`（若载 `--root` 则去 · floor 行复核）· 复核 `packages/cdd-engine/src-next/face/__tests__/{cli,projection}.test.ts`（help/key/结构 pins）· 复核 `packages/kairos/tests/`（消费面门）· Create/Verify `.changeset/`（cdd-engine pending）
- **Consumes**: T2（`--root` 退役）+ T6（测试面迁移）+ T8（floor 行）+ T13/T15/T16（消费面门）+ 全 wave 产物 · spec §2.5 收口 + AC 过程门授权
- **Produces**: README ×2 与 `--root` 退役 + floor 一致 · 跨套件 pin 终锚 · `pnpm run validate` ALL PASS · `pnpm run emit:check` OK · changeset pending · 供 cdd-close
- **Steps**:
  - README 同步 —— `cdd-engine` README ×2 去 `--root`（若载）· floor 行复核（T8） — checkable: `grep -rn "\-\-root" packages/cdd-engine/README.md packages/cdd-engine/README.zh-CN.md` 零命中
  - pin 终锚复核 —— cli/projection help/key/结构 pins（T6）· board/capsule next pins（⑳）· 一致性门（T10–T16）逐类复核在位 — checkable: 各 pin 组绿
  - 全量 validate —— checkable: `pnpm -C packages/cdd-engine test` 全绿 · `pnpm -C packages/kairos test` 全绿 · `pnpm run validate` ALL PASS · `pnpm run emit:check` OK
  - 零裸函数 + EOF —— 全局 `^export function|^function` 零命中 · 全树 EOF 恰一 newline — checkable: grep 零命中 · EOF 检查绿
  - changeset —— `.changeset/` cdd-engine pending（既有归并口径） — checkable: `pnpm exec changeset status` 无 empty 条目
- **Acceptance**: README ×2 与 `--root` 退役一致 · 跨套件 pin 终锚在位 · `pnpm run validate` ALL PASS · `pnpm run emit:check` OK · 零裸函数 grep 零命中 · EOF 全绿 · changeset（cdd-engine）pending · EOF 恰一 newline
- **DependsOn**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-16 | P9 计划起草——由 approved spec v0.3 分解为 **17 任务 5 波**（波次由 `DependsOn` 图派生）：**W1**={1 路径值对象 `RepoRoot`+`RepoPath` · 8 floor 面单源 · 9 Doc-type writer（skeleton 补头行+⑳ 复核）· 10 issue-body 单源收口（①⑤⑰）· 11 `DocKey` 单源 · 12 单源抽取杂项（⑪⑫⑬）· 14 死声明清理（⑧⑯⑱⑲）· 16 frontmatter 门+消裸冒号} → **W2**={2 repoRoot 唯一转换+三缝退役+BLOCKED · 3 输入漏斗+仓库外路径 · 13 缺门（④⑥⑦⑨）} → **W3**={4 落盘/prompt 全相对+迁移 · 5 声明再抄消除 · 6 命令声明面字节破格+测试面迁移（59 `--root` argv + fixture chdir）· 15 跨面散文一致性门（⑭⑮）} → **W4**={7 双 pin（结构+行为）} → **W5**={17 消费面同步+全量验证}。骨架由 `cdd schema get plan --output skeleton` 产出后填槽（非以兄弟产物为模板）。recon 校正 spec 三处 stale：命令精确列表 pin 现为七项（P8 已含 board）· `calls[].cwd` 实为 0 reader（非 11）· `readJsonLenient` 已存在（P8 jsonc 产物，非本 phase 面） | Oscar M. · Claude Opus 5（kairos:cdd-plan · spec v0.3 批准） |
| v0.2 | 2026-10-16 | **plan-review-1 两 findings 修复（全数落地）**：① **W（T6）**——`:621` 负锚自洽化：`cli.test.ts` 的 `"--root",` 站点 **59 = 58 可删 token + 1 存活负锚（`:621`）**；Constraints 行、T6 Objective/Files/步骤同步重述（Files 删除行集排除 `:621`），步骤 checkable 由不可满足的「零命中」改为「残存命中恰 1 处且位于 `:621`」。② **N（T5）**——`#scanRoots` 签名变更显式化：`static #scanRoots(docPath: string)` → `(root: string, docPath: string)`，调用点 `:1049` 改传 `(ctx.root, ctx.path)`；Objective/Files/步骤同步。 | 引擎 plan-fix 轮 · Oscar M. · Claude Opus 5（P9 plan-fix round 1 · 全部 verified-true） |
| v0.3 | 2026-10-16 | **plan 期 backfill（D46 补全 + cwd 基准更正）**：用户追问「round context 里所有文档路径都要相对 repo root，无论 input 还是 output」——复核 T4 的 round-context 路径 token 面**两处更正**：① **token 数 7 → 8**（漏 `INPUT_WAVE_BRIEF`，亦走 `workspace.resolve` 产绝对）；② **基准判定更正**——`INPUT_DOC`/`INPUT_FINDINGS` 非含糊「argv 原形」，实为 **cwd 相对原形**（按 `process.cwd()` 解，`cwd ≠ repoRoot` 即偏离），是**独立第三基准**。三基准 = 绝对（`OUTPUT_*`/`WORKSPACE_DIR`/`INPUT_WAVE_BRIEF`）· link-space（`INPUT_SPEC`）· cwd 相对（`INPUT_DOC`/`INPUT_FINDINGS`）。T4 Objective/Files/Steps/Acceptance 改为「**全 8 路径 token** · **单一出口**（`#valuesOf` 组装处一笔归一 · 各产出点仍可产绝对）」 | Oscar M. · Claude Opus 5（P9 plan 期 backfill 更正 · 用户追问） |
