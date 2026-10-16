# 引擎文档工具（Engine Doc-Tooling）— P9 设计：一事实无处 / 无门 / 有副本 通审施工（D26 法条 · 路径面单源统一 + 无门事实通审 + frontmatter 门）
- **Version**: v0.2 · 2026-10-16
- **Doc type**: phase-spec
- **Status**: Draft
- **Author**: Oscar M. · Claude Opus 5（kairos:cdd-design [P9] 会话 · 用户裁定 · 2026-10-16）
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](2026-10-10-engine-doc-tooling-overall.md)
- **Depends on**: P8（Done · v0.13 · hard——P8 全链闭合后重开路径面单源统一 · overall 依赖图 D41）

## Design

本 phase 承接 P8 收口后的续 phase（2026-10-16 cdd-design [P9] 会话注册 D41 · D42 in-flight · D43 grilling 全裁定）。**统一命题——D26 法条的横切施工**：把「**一事实一处 · 判定时刻现读 · 副本永不具权威**」这条已在 P7 判定面立起的法条，从判定面**推广到全引擎 + 消费面**，凡出现「散锚 / 无门 / 有副本」的事实一律收口。

命题由两个入口汇聚而成：**其一**，注册时用户追问「child 派发是否在 repo root」——查证揭示路径**基准**散成三锚（cwd 类含两个独立 `process.cwd()` 根 · repoRoot 类 · doc-dir 相对硬编码类），且**文档身份**（`reviewedRevision.doc` 原样 argv 串）未归一 → 同一文档绝对/相对调用产生虚假 drift；旧树 `be9dbc5f` + `3d59d5be` 早已修过（单源 + 单转换点 + 机器 pin），src-next 重写时**三者全丢**。**其二**，in-flight 用户观测 harness skill-conflict——三份 SKILL.md 的 frontmatter `description` 含裸 ASCII `: ` 致严格 YAML 解析失败、skill 静默不加载；根因不是「字符串错了」而是「**仓库零门**用真实解析器校 SKILL.md frontmatter」——一个**无门的声明事实**（D42）。**注**：overall/D42 称此项为「第 ⑦ 项」；而本节 B 组的 audit 编号体系里 **⑦ 另指 `INSTALL_ROWS`**（§3.3）——两套编号相撞，故本 spec 对 frontmatter 项**只用名称「frontmatter 面」**（第 4 节），不再用数字 ⑦ 指代它以避歧。

由此 `size?` 判得 **oversized**（25+ 任务位 · 跨 CLI/路径 · 契约类型 · 模板/label · host/refs · 消费散文 · docs 多平面）。用户裁定 **S1=c 不拆 phase** → 收敛为**单 phase-spec 承载，内部 wave 序列**（承 P5/D18⑩「不拆 phase ≠ 不拆 wave」先例）。**已知内聚代价**：单 phase 承载多平面（路径 / 契约类型 / 模板 / 消费散文），借内部波次缓解——如实记录，不粉饰。

### 1. 目标与边界

#### 1.1 设计输入与授权

- **设计输入**：本会话 grilling 全裁定（kairos:cdd-design [P9] · 用户逐题裁定 Q1–Q3 · G1–G15 · S1/S2 · T1–T3 · 已回填 overall D43）。
- **重构授权**：用户六前提 mandate（1 允许破坏性变更 · 2 高维 OOP 零裸函数 · 3 零技术债免声明再抄 · 4 高内聚低耦合清死码 · 5 消费心智负担优先 · 6 最大重构整合精简）。
- **会话期 in-flight（D44 · 2026-10-16 · 独立提交）**：本 phase 会话期内用户提三条需求——① implement skill ref 复核（**保持** `mattpocock-skills:implement`）· ② author 后加 `self-review` 节点（消费面 skill）· ③ plan review 注入 spec doc（`INPUT_SPEC`）。②③ 为 **D26 主题外的 out-of-band 热修**，登记入 overall D44 程序记录并独立提交，**不并入本节 D26 施工面**（保主题纯净）；详细裁定见 overall D44。

#### 1.2 判定基线（本 phase 的根前提 · D26 法条）

本 phase 的唯一判准 = **一事实一处**：任一事实只有**一个**权威源；判定时刻**现读**该源；任何**派生副本**（缓存 / 硬编码 / 手抄第二声明）永不具权威。据此，本 phase 的违规面只四类：

| 类 | 义 | 本 phase 实例 |
|---|---|---|
| **散锚** | 一事实有 ≥2 独立基准 | 路径根三锚（两个 `process.cwd()`） |
| **声明再抄** | 一单源 + ≥1 硬编码 / 手抄副本 | `invariants.ts:1075` · `DocKey` 手抄 5 处 |
| **无门** | 事实被依赖但零 in-repo 门 | SKILL.md frontmatter YAML · `edgeConditionWords` 假 pin |
| **死声明** | 事实的机制存在但零活消费方 | `ProcessRunner` · `HOSTS[*].cache` |

#### 1.3 保留面（冻结）

- **功能语义不变**：引擎对外行为、退出码表 0/1/2、CDD_BLOCKED 通道语义不变。
- **`next:` 字面冻结**：本 phase 不改 `next:` 行的可执行字面（承 P5 冻结先例）。
- **D29 黑盒边界守约**：skill 文本仍零引擎内部实现镜像；本 phase 对消费面只**加一致性门**（第 3.5 节），不向 SKILL.md 注入实现细节、不改其承载语义。
- **不发布**：changesets 收尾至可发布态即止（与 P1–P8 一致）。

### 2. A 组 · 路径面单源统一

#### 2.1 唯一规范形态 = 相对 repoRoot（Q1=b）

路径的**形态**（shape）与**基准**（basis）分离处理，但形态本身**收敛为单一规范值**：**repoRoot 相对路径**是唯一持久 / 比较 / 传递形态；**绝对形态只瞬态存在于 syscall 边界**——`resolve` 得之，喂给 `fs`/`git`/`execa`，**永不落盘、永不比较、永不跨层传递**。

> 依据（用户裁定）：两种形状态并存，必然在某处不对齐——这是 D26「一事实一处」在形态层的直接推论。

#### 2.2 `RepoRoot` + 品牌 `RepoPath`（G1=a · G14=a）

- **`RepoRoot` 值对象**：根基准的唯一权威源（basis single source）。构造即解析（见 2.4）。
- **品牌类型 `RepoPath`**：把「相对形态」升为类型——两态中的「绝对态」在**类型层不可表达**。
  - 唯一构造入口：`RepoRoot.relativize(input: string): RepoPath`（用户输入读入点）。
  - 唯一擦除点：`RepoRoot.resolve(rel: RepoPath): string`（syscall 边界 · 产出绝对 `string` 喂 `fs`/`git`/`execa`）。
- **契约**：read / write / resolve 面**只收 `RepoPath`**——裸 `string` 到不了 read/write（编译期把守）。

#### 2.3 输入漏斗唯一落点（G10=a）

归一化（`relativize`）在 **CLI 输入解析处**发生**恰好一次**：`#runInput` 构造 `parsed` 之后、进入 scene 之前，对全部 path-typed argv 一次归一 → `RepoPath`；下游 scene / lifecycle / capsule / preflight **只收 `RepoPath`**。

- **纳入面**：`--plan` · `--spec` · `--findings` · `schema get --output skeleton` 的位置参数 `<target>`。
- **`--root` 免除**：`--root` 退役（2.4），不再有 basis-definer flag——漏斗无特例。

#### 2.4 repoRoot = `git.topLevel(process.cwd())` 唯一转换（G8=a · G5 溶解）

- **`--root` 退役**：CLI flag 删除（`face/declare.ts` root 条目 + 四命令 `keys` 引用）；`#repoRootOf` 的 `override` 腿删除。
- **注入缝退役**：`CliOptions` 的 `cwd` 与 `repoRoot` 双缝删除；`Cli.#cwd` / `CliLifecycle.#cwd` 双 `?? process.cwd()` 默认收一。
- **唯一转换点**：`repoRoot = git.topLevel(process.cwd())`——**全 engine 生产代码恰好一处** `process.cwd()` 读取、一处到 repoRoot 的转换（旧树 `3d59d5be` 机器 pin 原样扶正）。
- **`cwd` fallback 死**：`?? cwd` 那截退役，不再静默降级。
- **G5 溶解**：无 basis-definer flag 后，「唯 `--root` 豁免」条款消失。

#### 2.5 声明面字节破格（G12=a）

`--root` 退役使命令声明面（`face/declare.ts` root 条目 · help `Options` 行）字节变化——`implement` 等的 help `Options` 段由 `… [--root <path>]` 变为无该段。**注**：commander 原生 usage 行为 `Usage: cdd implement [options]`，`--root` 字节只存在于 help `Options` 行，不在 usage 行。此为 **deliberate 字节破格**（与 P5「字节语义 major」/P8 pin 破格同级）。**`next:` 字面冻结不受影响**（1.3）。

**退役面清点（不可只 chdir，须删 argv token）**：

- **正向 `--root` argv 站点**：`cli.test.ts` 内 `"--root",` 共 **59 处**（含共享 helper `:1791` `await command.runArgv([...argv, "--root", repoRoot])`）——这些 argv token **必须删除**，仅 chdir 不够（否则 `--root` 退役后全成 `error: unknown option '--root'`）。
- **`projection.test.ts:71`**：review key 列表 `["--type", "--tasks", "--plan", "--spec", "--round", "--root"]` 断言 `review` **声明** `--root` → 翻为 **`--root` 缺席**断言。
- **help pin 翻转**：`:916` `toContain("--root <path>")` 与 `:1111` `indexOf("--root") < indexOf("--dry-run")` 顺序 pin → **均翻负**。
- **`:621` = 存活负锚（非重锚目标）**：`command.runArgv(["--root", "x", "implement"])` 断言 `error: unknown option '--root'` 且退 2——`--root` 未退役时即为 per-command 选项，此断言**退役后原样存活**（仍未知选项），不改。

**grep pin 范围**：AC 的「三缝零残留」grep pin 须**同时覆盖生产面与测试面**（含上述 59 argv 站点 + `projection.test.ts:71`），否则 pin 假绿。

#### 2.6 推算不出 → BLOCKED 退 1（T3=a）

`git.topLevel(process.cwd()) === null`（非 git 仓 / 无 tty 等）→ 走**既有 BLOCKED 语义**（stderr 携因 · 退出码 1），非 usage 错（退 2）。归因：**运行环境事实缺失**，非用户调用姿势错。零新消息面（复用既有 BLOCKED 通道）。

#### 2.7 落盘 + child prompt 全相对（G13=a）

- **落盘**：`progress.json` / `base.json` / wave carrier 内的一切路径存**相对 repoRoot**（`RepoPath`）。
- **child prompt**：注入子进程的 `WORKSPACE_DIR` 亦发**相对**——唯一形态贯彻到底。子进程 spawn cwd = repoRoot（2.4），相对路径立即可达。
- **安全条件**：子进程不自行 `chdir` 出仓库——由双 pin（2.9）兜住；spawn-cwd 归一因此成为**承重事实**。

#### 2.8 声明再抄消除（G2=b · G15=a）

- **`invariants.ts:#scanRoots`**（G15=a）：现 `#scanRoots` 用 `own = path.dirname(docPath)`（`ctx.path` 为**文档文件路径**，故 `own` 是文档相对/绝对邻域目录）**拼** `path.dirname(own)` + 硬编码 `"specs"/"plans"`（`invariants.ts:1075`）。重构须**声明基准并钉合流规则**：`docRoots` 存的是 **repoRoot 相对串**（`docs/kairos/specs`），故须对 `ctx.root` 解析后再并——`[path.dirname(ctx.path), ...Object.values(ENGINE_RUNTIME.docRoots).map((r) => path.join(ctx.root, r))]`。**注**：`docDir(doc)` 于 src-next **不存在**（`grep -r docDir src-next` = 0 命中），落地用具体量 `path.dirname(ctx.path)`。
- **全部可执行 copy 从单源派生**（G2=b）：`invariants.ts:981/1063` 的 finding 消息 · `face/declare.ts:202/208/234` 的 help `example`——凡含 `docs/kairos/…` / `specs/plans` 字面者，从 `ENGINE_RUNTIME.docRoots` 派生，零硬编码副本。
- **注释 copy**（board-view / workspace / doc.ts 的 7 处）：随行清理（G2 范围含）。

#### 2.9 双 pin（G11=a）

- **结构 pin**：grep 级断言——engine 生产代码 `process.cwd()` **恰好 1 处** · `git.topLevel` **转换点恰好 1 处**。
- **行为 pin**：`FakeSync` 的 `call.cwd === repoRoot`（补现存 11 处读者对 `calls[].cwd` 的**零覆盖**）。
- **理由**：历史教训正是「单源 + 单转换点 + pin **三者全丢**」——两 pin 护的**不是同一事实**（行为护 spawn · 结构护转换点），须双立。

#### 2.10 仓库外路径（G4=c）

用户给 `../outside/x.md`（repoRoot 之外的相对路径）→ **接 + stderr 告警**：形态仍是单一（相对 repoRoot，分段含 `..`），不破坏「唯一形态」不变量；读得动即放行，stderr 提示「路径在仓库外」。判别标准 = **形态对不对**，非位置在哪。

#### 2.11 旧落盘数据迁移（G7=b+兜底）

- **一次性迁移**：将磁盘上旧 `progress.json` / `base.json` 内残留的冗余形态路径串归一为相对形态并回写。
- **读时兜底**：读取层再 `relativize` 一次（防漏网）——迁移处理历史，读时归一兜底。

#### 2.12 测试隔离 chdir（G9=a）

`repoRoot` 不可注入后，测试面迁移分两类：

- **fixture helper 注入腿**：`cli.test.ts:135` `Cli.create({ io, repoRoot, ...opts })` 的 `repoRoot` 腿删除（`mkdir` fixture 后改 `process.chdir(temp)` → `Cli.create({ io, ...opts })`）。`cli.test.ts:3300` `Cli.create()` 无参调用不受影响。
- **真实迁移面 = `fixture()` 调用点**：全测试 **201 处**（`cli.test.ts` 121 · `ledger.test.ts` 36 · `run.test.ts` 24 · `wave.test.ts` 20）——helper 一改，全部调用点随之生效；另加 §2.5 的 59 处 `--root` argv 站点（token 须删）。

引擎 vitest 已确认**串行**（`maxWorkers:1 · fileParallelism:false`），chdir 安全。

### 3. B 组 · 无门事实通审

**门归属（T2=a · 镜像 P5/D18 校验归域）**：引擎内部事实（②④⑦⑨）→ **engine suite**；引擎 ⇄ 消费面对照（⑭⑮ · frontmatter 面）→ **kairos suite**。共 **19 项** = §3.1–3.3 的 **①–⑮（15 项）** + §3.4 的 **⑯–⑲（4 项 疑似）**（audit 枚举 · 编号沿用 audit 报告；frontmatter 面为 audit 体系外、由 D42 引入的第 20 项）。

#### 3.1 真缺陷（已发散 / 读写断层）

- **① issue-body label 表已发散**：engine `words.ts:181`（`ISSUE_LABEL_WORDS`，渲染器实读）vs `templates/report/issue-body.json:21`（`sectionLabels`，SKILL 宣称的 oracle，**零 reader**）——二者**已不一致**（`bug.context` zh `## 场景` vs `## 背景` 等）。收口：单源 + 一致性门。
- **② node floor 双事实混淆**：实为**两个不同事实**，不得并作一源——
  - **安装 floor（install floor）**：`package.json#engines` = `>=24` vs `README.md:13` / `README.zh-CN.md:15` = `>= 22.12.0`——**此为真发散**，收口为单源。
  - **源码直跑 floor（type-stripping floor）**：`bin.ts:23` `NODE_FLOOR = {major:22,minor:18}` = 22.18 vs `README.md:44` / `README.zh-CN.md:46`（`Node ≥22.18 native type stripping`）——**此亦有副本**，收口为单源。
  - **不可合并**：从 `package.json#engines`（`>=24`）派生 `NODE_FLOOR` 会使守卫**过严**（拒 Node 22.18–23.x，而 README 明示其源码直跑可用）。故 ② 须 (a) 拆分两事实、(b) 清点全部 **4 处 README 站点**（`README.md:13/44` + 镜像 `README.zh-CN.md:15/46`）、(c) 每事实各钉**正确**单源。
- **⑩ `**Doc type**` 写者缺**：`board-view` / `preflight` / `capsule` **依赖**该头行（缺则 BLOCK），而 `render/skeleton.ts` **不产出**（grep 零命中）→ 引擎自产骨架过不了自己 preflight。**本会话已实证**：P9 骨架由 `schema get phase-spec --output skeleton` 生成后**缺** `- **Doc type**: phase-spec` 头行，author 时手工补入方过 gate。收口：skeleton 渲染补齐该头行 + 回归门（引擎自产骨架必过自身 preflight）。

#### 3.2 单源抽取（copies → 单声明）

- **③ `DocKey` 手抄 5 处**：`contract/project.ts:48`（声明）· `judge.ts:37`（`DOC_KEYS`）· `contract/declare.ts:112`（`DOC_TYPE_VALUES`）· `board-view.ts:118`（`DOC_TYPE_DOMAIN`）· `doc.ts:311`（inline union）——三运行时数组从 `DocKey` 派生 + 一致性门。
- **⑤ `components` 名册**：`templates/report/issue-body.json:2` 的 **8 串**须精确派生，**不可**声称整体从 `SKILL_ANATOMY.skills.registry` 1:1 派生——该 roster（`SKILL_ROSTER` · `skill-anatomy.ts:149-155`）仅 **6 行** skill（`cdd-design`/`cdd-spec-writer`/`cdd-plan`/`cdd-dev`/`cdd-close`/`cdd-report`）。规则：(a) 6 个 kairos 组件 = `"kairos:" + roster-key`（需前缀变换）；(b) 两非 skill 组件（`kairos (general)` · `cdd-engine`）为**固定头，无 roster 源**。
- **⑪ `base.md` artifact schema**：`cdd-dev/docs/base.md` 的 schema 与 `BaseArtifact`（`artifacts.ts:30`）对齐 + 门。
- **⑫ `mattpocock-skills:implement` 字面 ×2**：`render/templates.ts:167` 的 shell prose 从 `DISPATCH.implement`（`host.ts:220`）派生。
- **⑬ phase-suffix 语法 2 正则**：`workspace.ts:106`（`(?<suffix>-p\d+(?:\.\d+)*)$`）· `board-view.ts:148`（`^p\d+(?:\.\d+)*$`）——**同为 slug phase-suffix 语法**（小写 `p`，可共享常量 + 一致性门）。**注**：`contract/declare.ts:375/449` 的 `P\d+(\.\d+)*-design`（大写 `P` + `-design` 尾）是 **doc-contract 设计单元值语法**，属**另一事实**，**不并入**本共享常量（若欲单源，另立其自身 token 项）。

#### 3.3 缺门（声明在、检查无）

- **④ `edgeConditionWords` 假派生 pin**：`skill-anatomy.ts:261` 的 docstring 声称「wording test pins the derivation」，**实为 0 reader**。收口：补真门（从 `ledger.ts` / `words.ts` / `next.ts` 的 Route 词表派生并 pin）。
- **⑥ `chore` 契约**：`cdd-report/SKILL.md:88` 声明 `bug | enhancement`，引擎 `render/issue-body.ts:52` 收 `bug | enhancement | chore`（且错误字节不符）。收口：单源 + 一致性门。
- **⑦ `INSTALL_ROWS` ↔ README**：`host.ts:139` 声明「README renders from these rows」实为空言。收口：README 安装表钉向 `INSTALL_ROWS`（门）或改为真派生。
- **⑨ `PIPELINE_NEXT` ↔ `REFS` 无闭合门**：`next.ts:88-92` 的 ref 键与 `host.ts:262-287` 的 `REFS` 无 cross-closure 门（`channel-closure.guard` 只覆盖 `DISPATCH`）。收口：闭合门扩项（含 `PIPELINE_NEXT`）。

#### 3.4 死声明（T1=a 全收 · 「声明即事实」）

- **⑧ `HOSTS[*].cache` 零消费**：`host.ts:96/168-174/191/207` 声明的缓存参数零 reader。收口：删除或补消费方。
- **疑似（一并以门清 · 编号 ⑯–⑲ 便于 AC 逐项核对）**：**⑯** `HandoffFamily.fixTemplate/.prev/.round` 死字段（`runtime.ts:47-58`）· **⑰** issue-body 孤儿字段（`severities`/`metaFields`/`reportDef`/`masterDef`）· **⑱** `CRASH_TAIL_LINES` 幽灵常量（`ledger.ts:168/170` 注释引用、符号不存在）· **⑲** `helpers.ts:74` 的 `.gitignore` 错值（`cdd/` vs 真 `.kairos/cdd/`）。

#### 3.5 跨面散文一致性门（S2=a · 不碰 SKILL.md · 不违 D29）

- **⑭ SKILL ref 串 ↔ `REFS`**：SKILL prose 的 `/repo:skill` + `pi：/skill:bare` 串钉向 `host.ts` 的 `REFS`——**发散即 fail**。
- **⑮ SKILL 路径字面 ↔ `ENGINE_RUNTIME`**：SKILL prose 的 `docs/kairos/…` / `.kairos/cdd` 字面钉向 `ENGINE_RUNTIME`——发散即 fail。
- **姿态**：**只加一致性门**（测试断言），**不改 SKILL.md 文本**——ref 串是执行契约、路径是用户面约定，皆该被 pin；D29 黑盒边界守约（门是外部对照，非向文本注入实现）。

#### 3.6 门的归属（T2=a）

| 事实面 | 门归属 suite |
|---|---|
| 引擎内部（②④⑦⑨⑩ 等） | engine suite（`packages/cdd-engine/src-next/**/__tests__`） |
| 引擎 ⇄ 消费面对照（⑭⑮ · frontmatter 面 · ⑥） | kairos suite（`packages/kairos/tests`） |

### 4. frontmatter 面 · 消费面 SKILL.md frontmatter 合法性（D42）

#### 4.1 门（契约驱动 · G6=b）

`SkillAnatomyContract`（`contract/skill-anatomy.ts`）增 **frontmatter 槽位**：声明「SKILL.md frontmatter 必须过真实 YAML 解析器」规则；`skill-anatomy.test.ts` 从契约读规则执行——对每 SKILL.md 抽取 frontmatter 块调 `yaml.parse()`，失败即 finding（进既有聚合断言）。**归属 = kairos suite**（消费面 · T2=a）。

#### 4.2 修（消裸冒号 · G6=ii）

三处 `description` 的裸 ASCII `: `（`the engine's next: line`）**改写措辞消掉**（非加引号）——直灭病根（散文里裸 `: ` 本就是散文堆砌，违前提③；加引号只是绕过解析器）。门（4.1）作结构兜底，使该类缺陷不再复发。

### 5. 波次划分（S1=c · 单 phase-spec 内部波次）

单 phase-spec 承载，内部按 `DependsOn` 派生波次（承 P5/D18⑩ · P7 十五任务先例）。**建议拓扑**（实现期由 plan 细化）：

- **W1 · 路径面基础**：`RepoRoot` + 品牌 `RepoPath` + 双 pin（2.2/2.9）——其余路径波的前置。
- **W2 · 路径面收敛**：输入漏斗（2.3）+ repoRoot 单转换/三缝退役（2.4/2.6）+ 落盘/prompt 全相对（2.7）+ 迁移（2.11）+ 测试 chdir（2.12）+ 声明再抄（2.8）+ 声明面字节破格（2.5）。
- **W3 · 真缺陷 + 单源抽取**（3.1/3.2）——含 ⑩ skeleton 补齐。
- **W4 · 缺门 + 死声明**（3.3/3.4）。
- **W5 · 跨面散文一致性门 + frontmatter 门 + 修**（3.5 · 第 4 节）。

> 波次边界以「可独立验收的最小单元」为界，实现期按 plan 的 `DependsOn` 图派生，本处仅定位拓扑。

### Acceptance criteria

- `A 组 · 路径面`：全 engine 生产代码 `process.cwd()` **恰好 1 处**、`git.topLevel` 转换点**恰好 1 处**（结构 pin 绿）· `FakeSync` 的 `call.cwd === repoRoot`（行为 pin 绿）· `--root` / `cwd` 注入 / `repoRoot` 注入**三缝零残留**（grep pin **覆盖生产面与测试面**：含 `cli.test.ts` 的 59 处 `--root` argv 站点）· 落盘 + child prompt 零绝对路径串（grep pin）· 同一文档绝对/相对 argv 归一后 `sameRef` **恒真**（虚假 drift 归零回归 pin）· 推算不出 repoRoot → **BLOCKED 退 1**（回归 pin）· 旧落盘数据经迁移 + 读时归一后可用（迁移回归 pin）· `invariants.ts` 的 `"specs"/"plans"` 硬编码**零残留**（读 `docRoots` 单源）。
- `B 组 · 无门事实通审（19 项 = ①–⑮ + ⑯–⑲）`：每项——**或有单源且有门**（发散即 fail），**或已删**（死声明），**无中间态**。重点：① label 表单源一致（门绿）· ② **两 floor 各单源一致**（install floor：`package.json#engines` ↔ README 行；type-stripping floor：`bin.ts NODE_FLOOR` ↔ README 行 · 门绿）· ⑩ `schema get --output skeleton` 产出的骨架**含 `**Doc type**` 头行**且过自身 preflight（回归 pin）· ④ `edgeConditionWords` 有真派生门（假 pin 消除）· 门归属按 3.6 分域（engine/kairos suite）。
- `frontmatter 面`：`skill-anatomy` 契约含 frontmatter 槽位 · 全 6 SKILL.md frontmatter 过 `yaml.parse()`（门绿）· 三处 `description` **零裸 `: `**（grep pin）。
- `过程门`：引擎 vitest 全绿 · `pnpm -C packages/kairos test` 全绿 · `pnpm run validate` ALL PASS · EOF 全绿 · changeset（cdd-engine）按既有归并落 pending · **不发布**。
- `六前提`：零裸函数（全局 grep 零命中）· 死码/死缝清理（`ProcessRunner` · cwd 注入缝 · 死声明类）· 声明再抄消除 · 最大精简。

## Constraints

- **功能语义不变**：退出码表 0/1/2 · CDD_BLOCKED 通道 · doc-contract 判定语义 · 领域 run 语义零变化。
- **`next:` 字面冻结**：本 phase 不改 `next:` 可执行字面。
- **形态唯一**：repoRoot 相对路径是唯一持久/比较/传递形态；绝对仅瞬态于 syscall 边界。
- **`process.chdir()` 生产的引擎路径禁用**（测试 fixture 的 chdir 隔离除外 · 2.12）。
- **唯一转换点**：engine 生产代码 `process.cwd()` → repoRoot 的转换恰好 1 处，机器 pin 把守。
- **D29 黑盒边界守约**：skill 文本零引擎内部实现镜像；对消费面只加一致性门，不改 SKILL.md 承载语义。
- **门归属分域**：引擎内部事实门进 engine suite；引擎⇄消费面对照门进 kairos suite。
- **变更先回填 parent overall**（backfill-as-version），再继续实现。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-16 | 初稿：P9 一事实无处/无门/有副本 通审施工（D26 法条）——A 组路径面单源统一（相对 repoRoot 唯一形态 · `RepoRoot`+`RepoPath` · `--root`/cwd/repoRoot 三缝全退 · `git.topLevel(process.cwd())` 唯一转换 · 推算不出→BLOCKED · 落盘+prompt 全相对 · 双 pin）+ B 组无门事实通审（audit 19 项 · 真缺陷/单源/缺门/死声明/跨面一致性门 · 分域归属）+ frontmatter 面（D42 · 契约驱动门 · 消裸冒号）· 单 phase-spec 内部波次 · 承 grilling 全裁定（D43） | Oscar M. · Claude Opus 5（kairos:cdd-design [P9] · 用户裁定 · 2026-10-16） |
| v0.2 | 2026-10-16 | 会话期 in-flight 登记（D44）：三条需求裁定——① implement skill ref **保持** `mattpocock-skills:implement` · ② author 后加 `self-review` 节点 · ③ plan review 注入 spec doc（`INPUT_SPEC`）；②③ 为 D26 主题外 out-of-band 热修（登记 overall D44 · 独立提交 · 不并入本节施工面） | Oscar M. · Claude Opus 5（kairos:cdd-design [P9] in-flight · 用户裁定 · 2026-10-16） |
