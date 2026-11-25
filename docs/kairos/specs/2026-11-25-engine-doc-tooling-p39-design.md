---
title: '引擎在 src/ 的再抽象复刻 — Phase Spec'
doc-type: phase-spec
version: v0.7
date: 2026-11-25
slug: '2026-11-25-engine-doc-tooling-p39-design'
program: 2026-10-10-engine-doc-tooling
author: '[human] · Claude Opus 5（kairos:cdd-design · 用户裁定 fit「一个相位做完它」）'
---

## Design

病在对象划分，不在文件位置。相位开场当日的读数是这句判断的证据：跨面 import 202 条，其中 **8 对面序双向成环**（`face⇄session` 57/3 · `face⇄infra` 30/2 · `face⇄contract` 29/1 · `session⇄infra` 23/2 · `session⇄contract` 17/3 · `face⇄render` 9/3 · `contract⇄infra` 8/6 · `session⇄render` 1/1）；49 个文件超 200 行，20 个超 500 行；全树 35,125 行分在 84 个非测试文件里（口径：`src-next/**` 非测试 `.ts` 的相对路径 import 逐条计 + `wc -l`；这是相位开场当日的快照，不是判据）。D95 注册于 2026-11-16，177 条 / 44 个 / 21 个是 2026-11-18 的重测读数（宪章 D95 行口径：与注册当日读数并列时以重测日期为准）——跨面边与超 200 行的文件数继续增长，而搬文件从未发生。

环不是路径造成的：`face` 与 `session` 各有 57 与 3 条边互指，是因为两边都在判「这一轮是什么状态」；`contract` 与 `infra` 互指，是因为拼写矩阵一头是判据一头是路径。把文件按层级挪一遍，这两处仍然互指——只是从两个目录互指变成两个子目录互指。所以本相位**不搬文件**：在新 `src/` 里按对象重新推导地复刻一遍，能力与消费者字节保真，对象与测试全部重新推导。

「复刻」在这份 spec 里有确定含义，两条都不成立即不算复刻：**能力清单齐全**（八条命令 + 轮次机械的全部行为）、**消费者面字节逐个相同**（§3.1 的八个面）。它**不是**逐文件翻译（那会把它变成一个换了语言的旧树），也**不是**搬家。

### 1. 四个切片的对象划分

一级切片按「守住哪条不变量」切。三条判据同时成立才算一个切片：**可删除性**（删掉它，其余只改一处注册）· **变更局部性**（现实中的改动落在一个目录里）· **不变量可陈述**（一句话说不出它守什么，就不是一个对象）。

判据同时排除了两种切法：按技术角色切（`contract` / `face` / `infra` / `render` / `session` 这五个名字正是「面名不是依赖方向」的来源）；按执行顺序切（读材料 → 判定 → 派发 → 记账 → 说出来，是 Ousterhout 点名的 temporal decomposition——阶段一合并或换序，代码就得整体搬家）。

三条判据的出处是 by-feature 的两条度量（变更局部性 · 可删除性）加上 Ousterhout / Parnas 的深模块与信息隐藏；迁移形状借 strangler fig 的「并存构建 + characterization 语料」——没有规格可依时，行为本身就是规格。

#### 1.1 `run/` — 一次相位的运行

**不变量**：事实先行，推进全由事实派生——账本记下什么，`next:` 就只能是它的函数；任一时刻树上至多一个在飞的轮、至多一条拒绝。

四段内部分工，每段一个职责一句不变量：

- `ledger/` — **事实与身份**：轮次身份 `(line, op, cycle, attempt)` 的单射 · 波行与文档评审行 · 分支线 · 这一轮审的是哪一版文档 · 产物身份与归属 · 裁决与改档。不变量：同一事实一个家，一条记录只被一处写。
- `gate/` — **拒绝与授权**：结构腿九行 · 轮内四门并入后的行集 · 拒绝事实的树级存放与两个到期触发点 · 接手授权（leg ① 绑 in-flight 门自己的放过判定，legs ②③ 仍守结构腿）。不变量：拒绝是关于树的事实，不写轮次；任一时刻至多一条。
- `dispatch/` — **孩子**：派发输入契约 · 手交契约与读回 · 预算与终止 · in-flight 记录 · 运行主机事实。不变量：孩子存在之前零记录，孩子收工后无残留。手交契约跟孩子走，不跟账本走——改孩子接口与改账本记录不同批发生。
- `advance/` — **前沿与 `next`**：管线前沿 · 波次前沿 · 闭合判定 · `next:` 与 `reason:` 的六格装配。不变量：前沿是账本的投影，不是第二份判断。

**入口**：`run/index.ts` 一个 `Run`，构造一次，成员只回答与命令：记一轮、问在飞、问拒绝、问前沿、问 `next`。**它不知道** 路径怎么拼（`env/`）、markdown 怎么读（`docs/`）、字节怎么印（`surface/`）。

#### 1.2 `docs/` — 物料与它的契约

**不变量**：文档的形状由登记表判，判据只读文本；同一事实一个拼写。

四段：

- `grammar/` — markdown 树与跨度 · 正文切分 · front-matter · home 驱动的登记表提取 · 任务块文法。
- `identity/` — doc type 与登记表（`DocType` · `ElementRegistry` · `DocFace`）· slug 与文档身份 · 目标类型。**登记表就住在这里**，因为它判的正是身份。
- `judging/` — 不变量（含跨文档链）· 选择器与覆盖 · 形状规则（规则行集 `contract/rules.ts#RULE_REGISTRY` 住在这里，它消费的路径文法 `contract/shape-rules.ts#PathShape` 与那张表同住）· 评审判据与 lens 问句 · 完成判据 · 波宽。
- `skeleton/` — 四类骨架（`overall` · `plan` · `phase-spec` · `single-spec`）的生成，名册即 `render/skeleton.ts#SkeletonAssembler#compose` 上那个穷举 switch 的分支集。

**登记表不设目录**：登记表不是一个对象，是某条判据的输入表，跟消费它的判据同住——形状规则与它的表一处，评审判据与它的问句表一处，目标类型归 `identity/`。同名两文件因此分属两个世界：`contract/declare.ts` 是文档登记表，归 `docs/identity/`；`face/declare.ts` 是 CLI 声明，归 `surface/commands/`。

**入口**：`docs/index.ts` 一个 `Documents`：解析一份文档、判一份文档、给一类骨架。**它不知道** 轮次、账本与 `next:`。

#### 1.3 `surface/` — 说出口的一切

**不变量**：消费者拿到的字节就是契约；一条事实一张词表，一处渲染。

三段：

- `commands/` — 八条命令薄壳 + CLI 声明（动词 · 旗标 · 值域）。**薄壳判据不是行数是三件事**：取参 · 调 `run/` 或 `docs/` 的一个入口 · 原样输出；零判定、零文件 IO、零字符串拼装。超过约四十行（含类声明与 import）说明判定漏进了壳里。
- `words/` — 唯一词表：阻断措辞 · 拒绝站名 · 在飞状态词 · capsule 槽 · 板面 token。在飞这一族有两个口径，别读成一个：记录侧是 `session/inflight.ts#InFlightState` 的三种判定 kind（absent · held · corrupt），`checked:` 面印出的是 `face/words.ts#CAPSULE_WORDS` 的 `checked.inFlight` 行集，corrupt 在有锁与无锁下各一行。第二份拷贝是漂移，不是并存实现。
- `render/` — 模板与 prompt 字节 · 胶囊 · 板面 · 图 · 预览 · issue body · brief。

**入口**：`surface/index.ts` 的 `Cli`，一条 `run(argv)`。**它不知道** 一条判定为什么成立——它只印别人算好的事实。

#### 1.4 `env/` — 外部世界的适配

**不变量**：写入只经一条声明过、原子、可预览的路径。

五段：`paths/`（仓库根与相对基准 · 文档根 · slug 索引）· `workspace/`（`.kairos` 布局 · 原子写 · 轮日志 · 载体封印）· `process/`（进程 · 主机探测 · 锁）· `vcs/`（git 读）· `provision/`（`init` 与 `plugins`：harness 安装与更新序列）。

`provision/` 留在 `env/` 内、不单独成片：它与 workspace 写入守同一条不变量——只经声明过、原子、可预览的步骤去触碰外部世界；对象不同（一处写本仓，一处装包并发起宿主配置），规则是同一条。给它单开一片，`env/` 就要把这条不变量劈成两条。

**入口**：`env/index.ts` 的 `Env`，在组合根构造，其余三片只收它的实例。**它不知道** 任何 CDD 语义：轮次、文档类型、判据。

### 2. 复刻的判据：能力清单、消费者面字节与语料

#### 2.1 能力清单：复刻的对象

「能力齐全」按这八组点名，每组的行为都是复刻对象，缺一即不齐。每条能力带一个**今日树的 pin**（模块路径 + 符号名，不写行号）：pin 只用于定位，验收形态是**条件**——旧树在翻面时整棵删除（§3.3），所以 pin 不住在验收里，住在「这条能力在新树上仍能按条件判红」这一句里。

1. **八条命令**：implement · review · fix · base · schema · issue · board · init，各带自己的旗标、值域与退出码（pin：`face/declare.ts#CliVerb`）。
2. **轮次机械**：implement / review / fix / docs-fix 四 mode 的派发（mode 名册 pin：`render/templates.ts#WORK_MODES`；prompt 行分两带，`TEMPLATE_PROMPT.modes` 与 `TEMPLATE_PROMPT.reviews`）· 草稿读取与结论判定 · 轮次身份与续号 · cycle 与 attempt 的消费规则 · 波行闭合。
3. **账本与前沿**：波行 · 文档评审行 · 分支线 · 闭合判定 · 文档被轮外改动后的重开 · `next:` 与 `reason:` 的六格装配（pin：`session/next.ts#Route`）。
4. **门**：结构腿的九行（pin：`session/preflight.ts#PreFlightGateName`）· 轮内四门并入后的行集 · 拒绝事实的树级存放与两个到期触发点（pin：`session/refusal.ts#PreFlightRefusal` · `#RefusalState`）· 接手授权（三条 leg 各自的授权条件）。
5. **在飞与终止**：in-flight 记录的建立与释放 · 记录侧判定（pin：`session/inflight.ts#InFlightState`，三种 kind：absent · held · corrupt）与它在 `checked:` 面印出的词行（pin：`face/words.ts#CAPSULE_WORDS` 的 `checked.inFlight` 行集，corrupt 按有锁 / 无锁两行）· 预算与 stall 判官 · 终止面的三档结论（pin：`session/ledger.ts#TerminationCause`）。
6. **文档契约**：四类文档的身份与登记表（pin：`contract/declare.ts#DocType` · `#ElementRegistry` · `#DocFace`）· 判据与选择器（pin：`contract/selector-engine.ts#SelectorEngine`）· 形状规则（pin：`contract/rules.ts#RULE_REGISTRY`——形状规则就是这张表的行；`contract/shape-rules.ts#PathShape` 是这些行读的路径文法，跟着表走）· 完成判据（pin：`contract/completion-criterion.ts#CompletionCriteria`）· 波宽（pin：`contract/wave-width.ts#MAX_TASKS_PER_WAVE`）· 四类骨架（`overall` · `plan` · `phase-spec` · `single-spec`；名册取自 `render/skeleton.ts#SkeletonAssembler#compose` 的分支集）。
7. **表达**：prompt 字节（pin：`render/templates.ts#TEMPLATE_PROMPT`）· 胶囊（pin：`face/capsule.ts#Capsule.emit`）· 板面两态（pin：`face/board-view.ts#BoardView`）· 预览（pin：`face/preview.ts#Preview`）· 图（pin：`scripts/lib/diagrams.ts#DiagramProducts`，emit 侧渲染）· issue body（pin：`render/issue-body.ts#IssueBodyRenderer`）· brief（pin：`render/brief.ts#BriefRenderer`）。
8. **环境**：路径基准与文档根（pin：`infra/root.ts#RepoRoot` · `infra/doc-roots.ts#ENGINE_DOC_ROOTS`）· workspace 布局与原子写（pin：`infra/workspace.ts#Workspace` · `infra/atomic.ts#AtomicWriter`）· 锁（pin：`session/inflight.ts#InFlight`，今天 `proper-lockfile` 的唯一持有者）· git 读（pin：`infra/git.ts#GitClient`）· 宿主探测（pin：`infra/proc.ts#ProcessFacts` · `infra/runtime.ts#ENGINE_RUNTIME`）· init 与 plugins 的安装更新序列（pin：`face/init.ts#CliInit` · `face/plugins.ts#PLUGINS`）。

#### 2.2 冻结的八个面

复刻的判据是字节，不是「测试通过」。八个面逐个冻结：

1. 八条命令的 stdout、stderr 与退出码（含正常、拒绝、失败三条路）。
2. `--help` 与 usage 形面，以及错用时的退出码 2。
3. `schema get` 四类骨架（`overall` · `plan` · `phase-spec` · `single-spec`）的字节——`--output skeleton` 对四族都合法，名册取自 `render/skeleton.ts#SkeletonAssembler#compose`，不是散在散文里的计数。
4. 四个 mode（implement · review · fix · docs-fix，名册即 `render/templates.ts#WORK_MODES`）与 review 全族的 prompt 字节——**包含模板契约的 `$version` 不变**：重建不改提示字节，因而不递增。这一条最容易在实现时被当成「顺手升一版」，它是错的。prompt 行分两带，对齐格按带逐行取、不写字面计数：`TEMPLATE_PROMPT.modes` 按 `WorkModeRowKey` 收 implement · fix · docs-fix（review 不在此带），`TEMPLATE_PROMPT.reviews` 是 `render/templates.ts#REVIEW_VARIANTS` 的每 `TargetType` 一行。review 字节按目标类型分，不按 `ReviewKind` 分：`ReviewKind` 是评审判据体（criteria body）的词表（`contract/review-criteria.ts#ReviewKind`），而 `**Criteria — <type>:**` 这一行插的是目标类型，`spec` 这一个 kind 因此盖住 phase-spec 与 single-spec 两行，两行字节不同——按 kind 冻结会漏掉其中一行。`base` 是纯产物命令，没有孩子也没有模板行；`docs-fix` 才是 spec / plan / overall 上每一次文档修复轮的派发面。
5. 胶囊字节（`status · handoff` 两槽，`face/capsule.ts#Capsule.emit`）。
6. 板面输出，含 `--notes` 未展与展开两态。
7. `--dry-run` 的预览块。
8. `CDD_BLOCKED` 报文 · 拒绝站名 · `checked:` 面的行集与让位条件。

#### 2.3 语料：取旧测试的夹具，丢旧测试的断言

语料不新造：旧测试的 fixture 树正好覆盖全部形态，而它们的断言是旧抽象的产物、全部丢弃。七种树形态：空树 · wave 进行中 · in-flight 持有 · refused 记录在树 · doc-drift · stale holder 且 target gone · branch 线已闭合。

语料是旧测试的**整个夹具面**，不只是一张树状态清单：树状态产不出冻结面要的每一份输入——`init` 与 `plugins` 的字节靠一个架在 PATH 上的替身 harness 加一个注入的 step runner 生成（`face/__tests__/init.test.ts` 就是今日那份夹具），`issue render` 从 stdin 读 findings JSON，骨架面把构造入参的运行日期写进 front matter、所以那份日期也要钉住。§5 的「不新增语料臂」是「不超过旧测试已经带着的那些臂」，不是「不超过七种树形态」。

钉那份日期的家只有一处：日期从 `render/skeleton.ts#SkeletonAssembler` 的构造入参进来，CLI 面把它取成系统时钟当天（`face/artifacts.ts#Artifacts.#today` 自己的注释就写明骨架不带日期参数面），旗标、环境变量与夹具缝都不通到它，而 §5 不许为它新开一条。所以四族骨架的字节格走装配器入口、在进程内同时驱动两棵树，同传一个冻结的日期——这个日期是语料的常量，录制基线与判比取同一个值，基线才跨天稳定——`date:` 行照常逐字节比，不屏蔽也不归一：被屏蔽掉的那一格正好是字节面存在的理由。必须真起进程的格（`init` 的 PATH 替身）产出的字节里没有日期，于是没有一格依赖运行当天；`schema get` 的壳面（回显路径与退出码）仍在起进程的那组格里比，它同样不带日期。

对账器与它的语料有自己的家：`packages/cdd-engine/tests/parity/`，在 `src/` 之外；基线从 live 树录制一次落在 `packages/cdd-engine/tests/parity/baseline/`，从旧测试提取的夹具落在 `packages/cdd-engine/tests/parity/fixtures/`，两者随对账器一同销毁。这个家落在任何一个被收集的执行面之外，也不在任何 tsconfig 工程里：引擎的 vitest include 只收两棵树各自的 `__tests__` 树，引擎 `tsconfig.json` 只含 `src-next` 与这份 vitest 配置，根 `typecheck` 链只点名它自己已有的那几份工程。所以落对账器的那一波守的是一条条件，不是今天的快照：它把 `tests/parity/**/*.test.ts` **追加**进 `packages/cdd-engine/vitest.config.ts` 当下的 include 行——既有条目全部保留——并为 `packages/cdd-engine/tests/parity` 建一份自己的 tsconfig 工程挂进根 `typecheck` 链，同样是追加而非重写；执行它的命令是 `pnpm -C packages/cdd-engine exec vitest run tests/parity`。翻面（§3.3）同批删掉这处 include 与该工程——它们与对账器同生同死。

#### 2.4 对账器只在测试面

一个差分对账器同时读两棵树，对固定语料逐字节比 stdout/stderr/退出码与渲染字节。它只活在测试目录，不进产品树，翻面即删。

这条与 §3.1 的「不混」不冲突：产品树里两棵树互不 import，测试面允许一个一次性的对账器同时看两边。没有它，「复刻」只能靠人读代码相信；有它，翻面那一刻是逐字节可判的。对账器必须自身可红——人为改一处字节即红，否则它只是在跑一遍自己。

这也是 characterization / golden master 那一族做法在本仓的形态：旧的断言没有权威（它们是旧抽象的产物），旧的行为有权威（消费者拿它的字节）。

### 3. 两棵树不混：机械形态与翻面

#### 3.1 双向 import 禁门

`src/` 不得 import `src-next/`，`src-next/` 不得 import `src/`，两条各一条可红断言。这是「不要混」从口号变成判据的唯一形态——没有它，两棵树会在某次顺手 import 里悄悄合流，翻面时才发现新树挂着一根旧树的脐带。两条断言的域是**产品文件**：`src/**` 与 `src-next/**` 各自去掉 `__tests__`。两棵树各自的测试面都在域外，允许同时读两棵树；§2.4 的对账器连测试面都不在树内——它的家在 `packages/cdd-engine/tests/parity/`（§2.3），两棵树之外。它同时读两边仍合法，正是这套禁令的正控：不允许域外同时看两边，「测试面之外零混」这句话本身就无判。

#### 3.2 `src/` 自第一波就绿

新树用独立编译面：`packages/cdd-engine/tsconfig.src.json` 一份只含 `src` 的 tsconfig 工程，并在第一波同批挂进根 `typecheck` 链（`package.json#scripts.typecheck` 增加 `tsc --noEmit -p packages/cdd-engine/tsconfig.src.json`）——一个没人调用的工程文件等于没有编译面。测试面同属第一波：`packages/cdd-engine/vitest.config.ts` 的 include 在第一波加进 `src/**/__tests__/**/*.test.ts`，否则新树的套件不被任何工程收集，Constraints 的「每波结束两棵树各自的套件都绿」对新树是空真。

两个面各有一条可红的波次条件，两条都要：编译面上在 `src/` 里埋一处类型错误，`pnpm run typecheck` 即红；测试面上在 `src/` 里埋一条必然失败的测试，`pnpm -C packages/cdd-engine exec vitest run` 即红。只留前者时，新树可能整个相位一次测试都没跑过，失败攒到翻面才现形，读上去像翻面的缺陷而不是某一波的缺陷——「还没人编译过」那个窗口只是挪到隔壁，一样不许存在。

测试与源码同片（`src/**/__tests__/`），只有跨片与端到端测试在顶层。旧测试随旧树一同删除，不搬运。

#### 3.3 翻面是一波之内的原子动作

一次翻面，顺序固定：编译面指向 `src/`（tsconfig 系）→ 测试 include 指向 `src/`，同批删掉 `tests/parity` 的 include 与它的 tsconfig 工程 → 树外测试面改指新树（`packages/kairos/tests/` 的 8 个文件 15 条 import · `scripts/__tests__/` 的两个孪生 `next-loop-twin` 与 `journey-twin` 及其路径常量 · `package.json#scripts.precommit` 的三条 `src-next/**` 守卫路径）→ `package.json` 的 smoke 脚本指向新树 → `check:no-bare-functions` 的扫描根换成 `src/` → 六份图源改真 → 手维护文档改指新入口（`README.md` 与 `README.zh-CN.md` · `packages/cdd-engine/README.md` 与 `packages/cdd-engine/README.zh-CN.md` · `AGENTS.md`）→ 删除整棵 `src-next/` 与它的测试 → `pnpm run emit` 重生图 HTML → `pnpm run validate` 与 `check:dist-smoke` 全绿。

翻面之后 `dist/` 由新树产出，`check:dist-smoke` 是这一步的唯一证明——它跑的是编译产物，而测试跑的是源码；源码接受而产物不接受的那类缺陷只在这里现形。

#### 3.4 翻面之后的零残留

代码、配置、脚本、图源与**手维护文档**里不再出现旧树的路径；`README.md` 与 `README.zh-CN.md` · `packages/cdd-engine/README.md` 与 `packages/cdd-engine/README.zh-CN.md` · `AGENTS.md` 都是消费者面（D101），不是生成物——`emit` 一份都不产出它们，改指新入口只能手改，且镜像与它的英文母本同批改，分开改就是漂移（既有 `packages/kairos/tests/presentation-surface.test.ts` 钉镜像集合与标题面，不钉路径字面，没有门会替你发现这份残留）。已闭合文档的正文与变更记录是记录面，不追改（记录保留落笔时的文字，这是本程序一贯的分界）。

### 4. 新树的再推导规则

- **一类一句不变量**，写不出来的就不是一个类（函数或值类型才是）。
- **深度不作行数判据**：判的是接口面远小于实现体。行数越限按 rule zero 在类头写一行理由，而不是为了过线把类切碎——classitis 与 god object 是同一个病的两面。
- **接口只在真边界处出现**：第二实现存在，或第三方、时钟、文件系统、网络需要被隔离。`env/` 是唯一这类边界；其余三片内部不设接口。
- **组合根只有一个**（入口二进制）：具体类在此 new，其余全部经构造参数收协作对象。域对象绝不自己 new 协作对象。
- 零裸函数（既有门继续扫新树）· 方法参数不超过四个，更多则收成一个参数对象。
- **不得带过来的旧抽象**：五个面本身与「面」这个词、任何以技术角色命名的一级目录、登记表目录、以及为绕开面方向而存在的 type-only 逆边豁免。

### 5. 失败面、代价与不做

**接受的代价**：消费者面在机器与出口建完之前无法端到端验证，缓解手段是 §2.4 的逐波对账；翻面之前 `dist/` 仍由旧树产出，因此本相位的中途状态不可发布、也不必发布；一份 spec 覆盖一整棵新树，它只能是架构级的——每一片内部的类清单留给计划。

**失败模式**：对账器绿而翻面红。那说明语料缺一种形态，处置是补语料，不是放宽判据。反之，为了翻面绿而改消费者字节，按缺陷处理。

**不做**：改任何消费者字节 · 新增命令、旗标、门或语料臂 · 动 `packages/kairos/` 的发布面字节（`skills/**` 与生成物；引擎 import 的测试文件随翻面改指，见 Constraints）· 搬运旧测试 · 在产品树里混两棵树 · 把旧树留成历史副本 · 重开已闭合相位的结论。

### 6. 与在册账目的关系

在册的四条范围由本节取代，依据是 D104：① 的「按层级搬文件」被「在新树重建」取代；② 的「拆到 200 行以内」降为诊断（判深度）；③ 的「能力分包仅在方向立后引入」由四切片直接落实，不再需要独立一条；④ 的守恒面保留，但证明工具从 pin 改为对账器——pin 已随 P43 整条退役。

**D104 ④ 的冻结面在本相位收窄到一条具名例外。** D104 ④ 与 Phase inventory P39 的 Scope 格写的是「`src-next/` 冻结零改动直到被整体替换」，而本相位对旧树唯一被允许的改动是 `src-next/__tests__/zero-dep.test.ts` 的 cutover 终态 pin：它的前提（退役平面不在包根）正是 D104 要在 `src/` 重建的那个名字，所以 `RETIRED_PLANES` 里 `src` 那一条腿随第一波退役，`config` 腿与该文件里「`src-next` 内零模块说明符指向退役平面」那条断言保持生效，其余旧树字节零改动。登记面的这两格与本节同批对齐。

依赖面：`P37 -> P39` 的硬边理由已随 D101 作废，前序相位全部交付，今天的阻塞是零；执行序排末位不变。

### Acceptance criteria

- 可删除性成立：删掉一条命令壳、一处板面投影、一条判据，各自只改一处注册。
- 消费者面字节保真：§2.2 的八个面在固定语料上与冻结基线逐字节相同——判者是翻面前那一次对账器运行，那一跑就是证据（基线随旧树一同销毁，翻面后不再有字节判者，见 Constraints）。
- 不混的两条禁门可红（产品文件里 `src/` 与旧树互相 import 各一条；正控 = 对账器同时读两棵树仍绿），对账器人为改一处字节即红；两条断言与对账器都落在一个被收集的执行面上（`pnpm -C packages/cdd-engine exec vitest run`，含 §2.3 的 `tests/parity` include），不是写在无人执行的目录里。
- 旧树零留存：`src-next/` 整棵不在树上，编译面、测试 include、smoke 脚本、零裸函数扫描根、六份图源全部指向 `src/`，树外测试面（`packages/kairos/tests/` · `scripts/__tests__/` 两个孪生 · `precommit` 三条守卫路径）与手维护的消费者文档（`README.md` 及其 `README.zh-CN.md` 镜像 · `packages/cdd-engine/README.md` 及其 `README.zh-CN.md` 镜像 · `AGENTS.md`）同时改指，`emit` 之后 `emit:check` 报 fresh。
- 深度可陈述：四个一级切片与 `run/` 四段各有一句不变量写在入口模块的类注释里，且每片的对外成员数远小于其实现文件数。
- `pnpm run validate` exit 0，引擎全套件绿；changeset 只 `cdd-engine` 一包、取 patch（D74：方法论契约未变，重建不改消费者字节）。

## Constraints

- 消费面零字节变化是本相位的守恒面，不是可选项：它由 §2.2 的八个面定义，**翻面前**由对账器逐字节判（那一次运行就是证据）；**翻面后**没有任何字节判者——基线随旧树销毁，`check:dist-smoke` 是「编译产物能跑通一条命令」的 smoke，不是逐字节判者，此后动这八个面按评审面判、不按门判（本相位不新增门）。
- 不新增任何门：本相位换的是实现，不是判据；新增门会在同一个相位里同时改判定面与被判定的树，红绿都说不清。
- 文档里写条件不写快照：不写行号坐标，不把今天的读数字面当判据（D103：代理型判据不设）。
- 测试与源码同片；旧测试随旧树删除，不搬运、不押「一字不改」。
- `packages/kairos/` 的发布面（`skills/**` 与生成物）本相位零字节改动；引擎 import 的测试文件（`packages/kairos/tests/` 的 8 个文件）随翻面改指 `src/`，因此 changeset 仍只有 `cdd-engine` 一包。
- 旧树的测试面有一处 pin 与本相位的前提正面冲突，必须动它：`src-next/__tests__/zero-dep.test.ts` 的 cutover 终态 pin 断言退役平面 `RETIRED_PLANES`（`src` 与 `config`）都不在包根——那是上一个 cutover 留下的终态，而本相位按 D104 正是要在 `src/` 重建。**作废只及 `src` 那一条腿**：`config` 腿保留，该文件里「`src-next` 内零模块说明符指向退役平面」那条断言也保留。这是本相位唯一被允许动旧树的地方，与第一波同批落地并在计划里点名。它不是「为了消红改测试」：pin 的前提被设计取代，处置形态同 D101 对 pin 门整条退役的那一判。
- 轮次的写权边界：一轮只写它的 findings 点名的文档（自己的目标文档 + finding 画面内的代码文件），父宪章与兄弟文档由编排器回填（既有 `cl:own-document` 条款）。
- 每波结束时两棵树各自的套件都绿，且 `src/` 侧的波次必须让它的测试随片落地——空波（只加代码不加测试）不算一波。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-25 | 首稿：P39 形态重裁定后的 phase-spec。四切片的对象划分（`run` · `docs` · `surface` · `env`）与各自不变量 · `run/` 四段内部分工 · 登记表跟判据走 · 八面字节冻结与「取夹具丢断言」的语料法 · 测试面差分对账器 · 双向 import 禁门 · 一波原子翻面与旧树整棵删除 · 新树再推导规则 · 与 D95 旧范围的取代关系 | Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-25） |
| v0.2 | 2026-11-25 | 评审轮一（F1–F9）落地：mode 名册改为 `render/templates.ts#MODE_PROMPTS` 的键集（`base` → `docs-fix`）· 骨架四族并补 `single-spec` 与 `render/skeleton.ts#SkeletonAssembler` 的 pin · 翻面顺序补树外三处测试面与三份手维护文档的改指 · 守恒面的判者写实（对账器在翻面前判，翻面后无字节判者）· 开场读数更正为 20 个超 500 行与 35,125 行并标明快照口径 · 能力清单逐条带 pin 与「pin 只定位、验收是条件」一句 · 独立编译工程挂进根 `typecheck` 链 · 对账器与语料的 home 与禁门域声明 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.3 | 2026-11-25 | 评审轮二（F1–F6）落地：四 mode 名册改锚 `render/templates.ts#WORK_MODES`，prompt 分 `TEMPLATE_PROMPT.modes` 与 `TEMPLATE_PROMPT.reviews` 两带 · review prompt 面改按 `render/templates.ts#REVIEW_VARIANTS` 的每 `TargetType` 一行，`ReviewKind` 只留作 criteria body 词表 · 在飞一族改述为记录侧三种判定 kind 与 `checked:` 面词行两个口径 · 对账器的执行面落地（引擎 vitest include 加 `tests/parity`、独立 tsconfig 工程挂进根 `typecheck`，翻面同批删除）· 能力清单 #6 / #7 / #8 逐项补 pin · D95 注册日与 2026-11-18 重测读数分开写 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.4 | 2026-11-25 | 评审轮三（F1–F4）落地：翻面的手维护文档清单补齐 `README.zh-CN.md` 与 `packages/cdd-engine/README.zh-CN.md` 两份镜像（§3.3 · §3.4 · Acceptance #4）· 语料面写实为旧测试的整个夹具面，非树输入（`init` 的 PATH 替身与注入 runner、`issue render` 的 stdin JSON、骨架的注入日期）一并点名，§5 的禁令限定为「不超过旧测试已带的臂」· 形状规则改 pin `contract/rules.ts#RULE_REGISTRY`，路径文法作它消费的对象（§1.2 · §2.1 #6）· `src/` 测试 include 的家与波次写实，编译臂配一条测试臂（§3.2） | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.5 | 2026-11-25 | 评审轮四（F1）落地：§2.3 补上骨架 `date:` 行的钉法——日期只从 `render/skeleton.ts#SkeletonAssembler` 的构造入参进来，CLI 面取自系统时钟且无旗标 / 环境变量 / 夹具缝可达，故四族骨架按装配器入口在进程内同传一个冻结日期驱动两棵树，`date:` 行逐字节比而不屏蔽，需真起进程的格产出的字节不含日期 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.6 | 2026-11-25 | 开发期漂移回填（第一波 implement 撞出）：旧树的 cutover 终态 pin `src-next/__tests__/zero-dep.test.ts` 断言退役平面 `src` 与 `config` 不在包根，而本相位按 D104 在 `src/` 重建。Constraints 补一条把作废面收窄到 `src` 那一条腿（`config` 腿与零说明符断言保留），并声明它是本相位唯一被允许的旧树改动、与第一波同批落地 | Oscaner M. · Claude（kairos:cdd-dev 编排器回填 · 2026-11-25） |
| v0.7 | 2026-11-25 | 评审轮五（F1–F3）落地：§2.3 把对账器落户的前提从「今天的 include 只有一条、`typecheck` 链只点名三个工程」这一快照改写成一条条件——把 `tests/parity/**/*.test.ts` 追加进 `packages/cdd-engine/vitest.config.ts` 当下的 include、把一份独立 tsconfig 工程追加进根 `typecheck` 链，既有条目全部保留，散文里不写计数也不写既有模式字面 · §3.1 删掉「`src/` 的测试面含 §2.4 的对账器」这处与 §2.3 冲突的家，改述为两棵树的测试面都在禁门域外、对账器另住在 `packages/cdd-engine/tests/parity/` · §6 补一句把 D104 ④ 与 P39 登记格的「`src-next/` 冻结零改动」收窄到 `zero-dep.test.ts` 的 `src` 腿这一条具名例外（`config` 腿与零说明符断言保留） | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
