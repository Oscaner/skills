---
title: 'P39 · 引擎在 src/ 的再抽象复刻：四切片 · 字节保真 · 一波翻面'
doc-type: plan
version: v0.32
date: 2026-11-25
slug: '2026-11-25-engine-doc-tooling-p39-design'
base: develop
---

## Constraints

- 读 spec `2026-11-25-engine-doc-tooling-p39-design` 的**当前版本**为唯一设计输入（不钉任何一版快照：spec 每升一版，差异以回填本计划的方式落地）；本计划不重述它的判据，只落实施序。冲突时以 spec 为准并回填本计划。
- 新树只写 `packages/cdd-engine/src/**`。旧树 `packages/cdd-engine/src-next/**` 在本相位**零改动**——例外只有两处：第一波退役 `zero-dep.test.ts` 的 `src` 腿（spec §6 与本文件 T1 点名的那一处，本相位唯一被允许的旧树改动），以及 §3.3 翻面那一波整棵删除；除此之外任何一步动它即为缺陷。
- 每波结束时两棵树各自的套件都绿，且 `src/` 侧的任务必须让测试随源码同片落地（`src/**/__tests__/**`）。只加源码不加测试的波不算一波。`zero-dep.test.ts` 的 `src` 腿在第一波就被退役（见上一条与 T1 Steps 的第一条），所以两棵树从第一波起都真绿——**没有具名豁免**：一条红着的套件不算绿。
- 零裸函数（`check:no-bare-functions` 的扫描根在翻面时才换，但新树从第一波起就守它）；方法参数不超过四个，更多收成参数对象；类行数越限按 rule zero 在类头写一行理由。
- 一类一句不变量，写在类注释第一行；四个一级切片与 `run/` 四段的入口类，把该片（段）的不变量原句放在那里（spec §1 · 验收 #5）。
- 移植判据是**行为**不是形状：读旧模块取它的行为与边界，新树的类名 / 成员名 / 文件位置按 spec §1 与 §4 重新推导；旧抽象（五面、「面」这个词、技术角色命名的一级目录、type-only 逆边豁免）一律不得带过来。
- 不写行号坐标；行为断言引 colocated pin（模块路径 + 符号名）。
- `packages/cdd-engine/tests/parity/` 是对账器与它语料的家，在 `src/` 之外、翻面同批销毁；它**允许**同时 import 两棵树，产品文件之间**不允许**（spec §3.1）。
- 消费面零字节变化（spec §2.2 的八个面）：翻面前由对账器判；翻面后无字节判者，此后按评审面判、不新增门。
- 每任务一次提交，提交信息用 `feat(p39):` / `test(p39):` / `chore(p39):` 前缀。

### Task 1: 新树的编译面、测试面与双向禁门

#### Objective
让 `src/` 从第一波起就是一个**真被编译、真被收集**的工程，并把「两棵树不混」变成两条可红断言。这一步不做任何业务移植——它交付的是「后面的每一波都能被判红」这个前提。

#### Files
- Create: `packages/cdd-engine/tsconfig.src.json`
- Create: `packages/cdd-engine/src/bin.ts`
- Create: `packages/cdd-engine/src/__tests__/tree-separation.test.ts`
- Modify: `packages/cdd-engine/vitest.config.ts`
- Modify: `package.json`
- Modify: `packages/cdd-engine/src-next/__tests__/zero-dep.test.ts`（只退役 `RETIRED_PLANES` 的 `src` 腿，见 Steps 第一条）

#### Consumes
- spec §3.1（禁门与它的域）· §3.2（独立编译面 · 两条波次条件）

#### Produces
- `packages/cdd-engine/tsconfig.src.json`：`compilerOptions` 逐键照抄既有 `tsconfig.json`（含 `allowImportingTsExtensions` · `erasableSyntaxOnly` · `verbatimModuleSyntax` · `isolatedModules` · `noEmit` · `moduleResolution` —— 少写一个，`src/bin.ts` 的 dev 面就在 `node --experimental-strip-types` 下先红），只把 `include` 换成 `["src", "vitest.config.ts"]`；**不设 `rootDir` / `outDir`**：既有 `tsconfig.json` 没有这两个键，而 `rootDir: src` 会把 `vitest.config.ts` 甩在外面，`tsc --noEmit` 当场报 TS6059——正是本步要求 exit 0 的那一条；发布面仍由 `tsconfig.build.json` 承担，它的 `rootDir` / `include` / `exclude` 三键在翻面时随 T18 改指 `src`（`exclude` 今天写的是 `src-next/**/__tests__/**`，只改前两键会让测试目录编进 `dist/`，而 `files` 只带 `dist/` 与 `templates/`）
- 根 `package.json#scripts.typecheck` 追加 `tsc --noEmit -p packages/cdd-engine/tsconfig.src.json`
- 根 `package.json#scripts.check:no-bare-functions` 的扫描根补上 `packages/cdd-engine/src`（旧树那一段一并保留到翻面）：零裸函数从第一波起就有判者，否则 `src/` 里写出裸函数要到翻面那一波才第一次红
- `packages/cdd-engine/vitest.config.ts#include` 追加 `src/**/__tests__/**/*.test.ts`（旧树的模式保留到翻面）
- `src/__tests__/tree-separation.test.ts`：两条断言（`src/**` 非测试文件不 import `src-next/`；`src-next/**` 非测试文件不 import `src/`），读法是逐文件扫 import 说明符；两条断言都靠枚举两棵树，翻面删树时随树同批退役（T18 认领这次删除），本任务**不写** `existsSync` 守卫——守卫在树消失时通过，正是 D101 禁止的 false green
- `src/bin.ts`：组合根占位（导出 `main()`，本波不接线）

#### Steps
- 退役 `src` 腿（spec §6 点名的那一处，本相位唯一被允许的旧树改动） — checkable: 从 `RETIRED_PLANES` 里去掉 `"src"` 一条，`config` 腿与「`src-next` 内零模块说明符指向退役平面」那条断言原样保留；改完 `pnpm -C packages/cdd-engine exec vitest run src-next/__tests__/zero-dep.test.ts` 绿；把那一行加回去 ⇒ 它回到 `deleted plane src must be absent from the package root` 这一条红（可红可回：退役前提，不删断言换绿）；该改动与本任务的其他文件落在同一次提交里，不开第二次一行提交
- 写 `tsconfig.src.json` 并挂进根 `typecheck` 链 — checkable: `pnpm run typecheck` exit 0，且它点名四个工程（引擎旧树 · `scripts` · kairos 测试 · 引擎新树）
- 埋一处类型错误到 `src/bin.ts` — checkable: `pnpm run typecheck` 红，且报文指到 `src/`
- 撤回那处错误 — checkable: `pnpm run typecheck` 回到 exit 0
- 把 `src/**/__tests__/**/*.test.ts` 加进引擎 vitest include — checkable: `pnpm -C packages/cdd-engine exec vitest run` 的收集列表里出现 `src/__tests__/tree-separation.test.ts`
- 在 `src/` 某测试里埋一条必然失败的断言 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 红
- 撤回 — checkable: 回到全绿，且这一次收集到的用例清单与埋断言之前那一次相等（两头各存一份清单比对；不把当天的读数字面写进判据，D103）
- 写两条禁门断言 — checkable: 在 `src/` 的某个非测试文件里写一行 `import "../src-next/bin.ts"` 即红；反向（在 `src-next/` 非测试文件里 import `src/`）另造一次即红；两次撤回后绿
- 把 `src` 加进零裸函数扫描根 — checkable: 在 `src/` 的非测试文件里写一行 `export function f() {}` ⇒ `pnpm run check:no-bare-functions` 红并点名该文件；撤回后绿
- 提交 — checkable: `git log -1 --format=%s` 以 `chore(p39):` 起头

#### Acceptance
四条波次条件可红可回：编译面红一次、测试面红一次、禁门两向各红一次；撤回后 `pnpm run typecheck` 绿、`pnpm -C packages/cdd-engine exec vitest run` **整棵绿**（含 `src-next/__tests__/zero-dep.test.ts`：`src` 腿已按 Steps 第一条退役，`config` 腿与零说明符断言仍在），且收集到的用例清单与埋断言之前相等；`src/bin.ts` 与 `tsconfig.src.json` 在树上；禁门的域是产品文件（`src/**` 与 `src-next/**` 各自去掉 `__tests__`），测试面不被这两个断言扫；零裸函数的扫描根已含 `src/`（在 `src/` 写一行裸函数即红，不等翻面）。

#### DependsOn
none

### Task 2: 对账器、基线录制与夹具抽取

#### Objective
把「复刻」从一句承诺变成一个可红的判据：一个只活在测试面的差分对账器，同时读两棵树，对固定语料逐字节比。本任务交付它的骨架、基线与夹具三个家，并让三条纯命令（`base` · `schema` · `issue`）的册面先有语料——后续每一片落地都要往它里面加格，且每一格都带一个接线任务。

#### Files
- Create: `packages/cdd-engine/tests/parity/harness.ts`
- Create: `packages/cdd-engine/tests/parity/grid.ts`（格程序：单位 → 格，每格带接线任务与 producer 落点）
- Create: `packages/cdd-engine/tests/parity/record.ts`（录制步骤：读一次 live 旧树并写基线）
- Create: `packages/cdd-engine/tests/parity/roster.ts`（名册渲染步骤：从 `CELLS` 重渲 `GRID-WIRING.md` 的表）
- Create: `packages/cdd-engine/tests/parity/baseline/`（录制产物）
- Create: `packages/cdd-engine/tests/parity/fixtures/`（从旧测试提取的夹具树）
- Create: `packages/cdd-engine/tests/parity/parity.test.ts`
- Create: `packages/cdd-engine/tests/parity/GRID-WIRING.md`
- Create: `packages/cdd-engine/tests/parity/tsconfig.json`
- Modify: `packages/cdd-engine/vitest.config.ts`
- Modify: `package.json`

#### Consumes
- spec §2.3（语料的整个夹具面 · 冻结日期 · 对账器的家与执行面）· §2.4（只在测试面 · 自身可红）· §3.2（`src/` 侧的波次条件）

#### Produces
- `harness.ts` 导出 `compareTree(scenario: Scenario): Promise<readonly Diff[]>`：给定一份夹具树，分别以旧树与新树的入口跑一次，返回逐格差异；**格 = 命令 × 路 ∈ {正常, 拒绝, 失败} × 流（stdout / stderr / 退出码）**，或渲染面 × 场景。`Scenario` 带 `frozenDate`（骨架面的注入日期，两棵树同传同一个值；录制与判比的日期不一致即缺格）。读面是异步的：新树经它自己的入口进程读，夹具的 holder 事实也取自运行中的进程。两侧不对称——期望是旧树录下的基线，实读只来自新树（`NewTree` 的 driver 按 kind 注册：进程 `entry` · 进程内 `seam` · 每个渲染器一个 `render:<family>`），没有 driver 的 kind 是**具名缺席**，绝不回落到旧树，于是「新树复刻旧树」是判据而不是同义反复
- `baseline/`：从 live 树录制一次得到的期望字节，按场景 × 格存——整个录制件带一个 `frozenDate`，每格只存两件——`value`（**期望字节**，或「这条路不存在」这一个事实）与 `state`（**录制那一刻由 `stateOf` 派生的状态**：applicable 且该格 producer 的落点在录制瞬间可解析 ⇒ 已接线，否则 ⇒ GAP；无此路 ⇒ 不适用）。一份录制因此是**那一刻的快照**，不是永久的判据：它把录制瞬间的 producer 落地事实抄进了文件，而树会往前走。于是 `baseline/` 的重录有**两个触发点**——语料的格集变了，或者**本波落地了 producer**（录制件的状态随之从 GAP 前进到已接线，字节仍由旧树录）；漏掉重录的那一波会读到 `recorded as gap, but its producer has landed — wire the cell`，这条红就是「你落地了 producer、没推进录制」的判者。`baseline/` 的写权只有录制这一处（`record.ts`）——别的波不碰它的字节，只在自己落地 producer 的那个触发点上重跑一次录制；entry 类格的状态同样随重录前进到已接线，但它们的 driver 到 T17 才注册，读数由下一条的**具名延后**兜住
- 格的三态口径（外带两条：一条「无此路」、一条具名延后）：**GAP**（未接线——名册里这一格点名的 producer 落点不可解析；按格计数，既不是 skip 也不是红）· **差异**（已接线的格与新树字节不同，红）· **缺格**（录制件与树不一致——录制件里没有这一格、录制作 GAP 而 producer 已可解析、录制作已接线而 producer 已不可解析、录制记作不适用而该路其实可解析、录制与判比的 `frozenDate` 不同；已接线的格没有可读的 probe、driver 抛的不是「具名缺席」——出现即红）· **不适用**（命令没有这条路，自成一态，永不计入 GAP）。第五条是**具名延后**（`harness.ts#REGISTRATION_WAVES`，T8 交付）：一格已接线、它 probe 派生的 kind 在 `NEW_TREE` 里还没有 driver、而那个 kind 带一条声明的注册波（`seam` → T16 · `render:skeleton` → T9 · 其余 `render:<family>` → T15 · `entry` → T17）⇒ 计入延后并报出注册波，既不是缺格也不是差异；注册波到了仍无 driver 才是缺格，kind 连注册波都没声明也是缺格（缺席必须具名）。entry 类格因此不在 W9 / W10 被判红——`src/bin.ts` 到 T17 才接线，它们的字节比与板面 / 命令面的真进程读数同在那一波收口。逐波只断言「已接线的格零差异 + GAP 集合与名册里未接线的格逐格相等 + 具名延后的格集恰好是注册波未到的那个 kind 的格」——三条都是可执行的形态；「GAP 集合与具名延后集合都为空」是 T17 的判据，不是每个波次的判据。报文的落点是被延后或被缺的那个 kind 的**注册波**，不是该格的接线任务
- **自证臂**（与逐波判据分开，由 `compareTree` 的旧树一侧承担）：同一场景在旧树连录两次，两份录制逐格互比为空；人为把其中一份的一个字节改写后逐格互比即报差异——它不依赖任何新树 producer，所以「自身可红」在 T2 当天成立，而 GAP 格在逐波判据里仍只计集合、不比字节
- `fixtures/`：从旧测试提取的夹具树——`trees.ts` 的 `TREE_SHAPES` 声明树形态（空树 · wave 进行中 · in-flight 持有 · refused 在树 · doc-drift · stale holder 且 target gone · branch 已闭合），树由 `materialize()` 在临时仓里现造，形态不按子目录落盘；`non-tree.ts` 另带三份非树夹具：`init` 的 PATH 替身 harness 与注入 step runner · `issue render` 的 stdin findings JSON · 骨架面的冻结日期常量
- `baseline/` 的格清单就是 spec §2.2 的八面逐格：面 1 按 `命令 × 路 × 流` 逐格展开，三条路（正常 · 拒绝 · 失败）各成一族，`init` 的步骤序列与 `issue render` 的渲染及 stdin 契约另按在册项逐格录；面 2 的 `--help` / usage / 错用退出码 2 同类在册。某条命令不存在某条路时在名册里写「不适用」，不留空、不省略；**usage 家族按命令节点各成族**——一条真会印字节的合法输入各占一族（缺 target 与多余 target 是两个族，不是一个笼统的「拒绝」格），「不适用」只用于命令真没有的那条路；没有一格留「随某任务补」的占位
- **格 → 接线任务名册**（`packages/cdd-engine/tests/parity/GRID-WIRING.md`，本任务 Files 里的一件）：每格写明它在新树一侧的 producer 由哪个任务交付并接线，**一格一个接线任务**（多格共用一个任务可以，一格挂两个任务不行），并写明该 producer 的落点（模块路径 + 导出名）——「已落地」读作「该落点在树上且可解析」，于是漏接在它自己那一波就红，不等到 T17。命令面与 `--help` / usage / 错用码 2 归 T16（壳与声明）；`init` 的三格（`f1.init.normal` · `f1.init.failure` · `f7.preview.init`——预览块 · 真跑进度行 · 绿摘要 · 首败报都在它们里面）归 T15 的 `surface/render/init.ts#InitRenderer`，名册里没有一格归 T8：`env/provision/init.ts#Provisioner#plan` 是那几格 driver 的步骤数据来源（T16 注册 `seam` kind 时把注入的 step runner 接在 `Provisioner#plan` 上），既不是第二接线任务、也不是第二格；`issue render` 的渲染与输入契约归 T15；面 1 的拒绝路格按成因各成一格（波门的 `mixed-batch` · `wave-too-wide` · `too-many-tasks` · `split` · `wrong-phase` 各一格，门口四站名各一格），接线任务只有 T16 一个（壳——被拒时走哪条流、退出码几都在那一格里比），波门五行的判定与行序取 T13 的 `WaveGate#vet`、站名与让位取 T11 的门行集、报文取 T14 的词表，它们是读值来源而非第二接线任务；失败路格同理，接线任务只有 T16 的壳一个（一条命令崩掉时走哪条流、退出码几都在那一格里比），终止因取 T12 的 `DispatchOutcome`、失败面的报文取 T15 的 `surface/render/usage.ts`（`UsageFace#report`，声明过的值 → 冻结字节与退出码），它们是读值来源而非第二接线任务——一格的三条流都由命令面产出，只有壳落地才能把这一族推进字节比对，名册不让只在第七波落地的终止因独自认领；骨架四族归 T9（装配器入口、进程内、冻结日期下逐字节比内容）；**骨架落盘另成一格**（`schema get <族> --output skeleton <target>` 的目标文件是否真被写出）——接线任务只有 T16 一个、producer 落点 `surface/commands/schema.ts#SchemaCommand`，判的是落盘事实：两棵树各跑一次（新树经自己的入口进程，旧树经进程内入口）、各自往自己的临时目录落一份，当次运行内两份字节（sha256）逐字节相等且目标文件非空（两棵树同取当天时钟，故这一格不挂跨天基线；内容面仍归 T9 那四格），缺了这一格则「路径回显了、文件没写」在八面里没有任何一格会红；prompt 两带 · 胶囊 · 板面各族 · 预览归 T15（渲染器落点 `surface/render/preview.ts`，它的输入由 T13 的 `Run#previewOf` 交付——接线任务仍只有 T15 一个，T13 是读值来源）——预览按 `previewOf` 回值的 `kind` 各成一格：通过块（五类行，exit 0）· 持有块（`lock:` 行与承接提示，exit 1；按 in-flight 三 kind 展开，`kind: corrupt` 而锁仍在时块体另追加 `corruptLocked` 一行——这一形态旧测试已带（`packages/cdd-engine/src-next/face/__tests__/cli.test.ts` 的 `keeps the in-flight arm's lock face on --dry-run for all three holding shapes` 一支），故它是这一格的既有语料，不是新增语料臂（spec §5 的口径是「不超过旧测试已经带着的那些臂」）；`lock:` 行与追加行随整条 stdout 一起逐字节比，损坏的记录在比对的临时目录里就地 planted，不另加夹具树）· 阻断块（拒绝行与 detail 段，exit 1），这三格的接线任务都是 T15、生产者都是 `Preview` 的三个入口；**line 腿的拒绝与装配层的失败另各成一族**——`refused`（`split` 树上 `--dry-run`：拒绝行 + 三段波板 + `checked:` 段，诊断流、exit 1）与 `usage` / `read-failure`（usage 首行的两行形，诊断流、exit 2），这两族的接线任务是 T16 的壳、生产者是 `surface/render/route.ts#refusalBlock` 与 `surface/render/usage.ts#UsageFace`（名册行在 T16 的补格步骤里落），阻断块的裁决与 detail 取 T11 的 seam 与 T9 的 `TaskGraph` 作读值来源；阻断面按格拆开：`CDD_BLOCKED` 报文与 `checked:` 行集归 T14（词表）、站名与让位条件归 T11（门行集与让位——接线任务仍只有 T11 一个，那一格的读值取 T10 的 `docs/judging/closure.ts#ClosedDocument`，门只拼行、不另算闭包）、阻断行落在 stdout 的那一处归 T16（打印面）
- **名册的四列与 driver 的注册波**（`grid.ts` 渲染成 `GRID-WIRING.md`）：表头是已交付的四列 `cell · task · producer · route`——接线任务（producer 的所有者，一格一个）· producer 落点（模块路径 + 导出名）· 该格走的路（正常 / 拒绝 / 失败 / 不适用）。**kind 不落名册**：它由 `harness.ts#kindOf(probe)` 在比对时派生（进程 `entry` · 进程内 `seam` · 每个渲染器一个 `render:<family>`），给派生值再加一列就是给同一件事存第二份。**driver 的注册波也不在名册里**，而是 `harness.ts#REGISTRATION_WAVES` 的一行（kind → 注册波，与 `NEW_TREE` 同处）：`seam` → T16 · `render:skeleton` → T9 · 其余 `render:<family>` → T15 · `entry` → T17（组合根接线那一波）。已交付的 `NEW_TREE` 在第一波就注册了 `entry`（`NewTree.of([["entry", ENTRY_DRIVER]])`），可那个 driver 答不出字节（`src/bin.ts` 在这一波只抛「未接线」）——T8 的 Steps 退掉这个占位，于是 `REGISTRATION_WAVES` 与 `NEW_TREE` 的键集各说各的真话（表说 `entry` 在 T17、`seam` 在 T16，`NEW_TREE` 说到那天一个 driver 都还没有），entry kind 的格在读作具名延后而不是差异。注册只在注册波发生一次（`seam` 在 T16、`entry` 在 T17）：T11 · T14 落 `seam` 格的波不注册 driver，只改写自己那几行名册，它们落的格读作具名延后直到 T16。**`f6.board.unexpanded|expanded` 两格的接线任务是 T15**：`surface/render/board.ts#BoardView` 是 T15 的交付物，T16 的壳只把 `Run#boardOf` 的回值交给输出面——已交付的名册里这两行写着 T16，由 T15 在自己的 Files 里带着 `grid.ts` 改写并重渲。板上事实块的 `orphan:` / `crashed:` 两条行族与产物清单的两族（异常轮默认印一格 · `--artifacts` 全清单一格）同样只挂 T15，名册各一行、producer 落点都是 `surface/render/board.ts#BoardView`——`--artifacts` 与 `--notes` 同表声明（T16 的 `declare`），渲染支在 T15，判定（哪些轮算异常、哪些草稿无人认领）都在 T7 的读面里。于是每个落格或注册 kind 的波都在 Files 里带名册那几件（`grid.ts` · `GRID-WIRING.md` · `parity.test.ts` 恒在；注册 kind 的那一波再加 `harness.ts`），名册行不是只有 T2 能改；**落地 producer 的那一波另带 `baseline/`**——它不是重写基底的字节，而是把录制件的状态推到它该在的那一格
- `packages/cdd-engine/tests/parity/tsconfig.json` 挂进根 `typecheck` 链；`vitest.config.ts#include` 追加 `tests/parity/**/*.test.ts`
- 执行命令：`pnpm -C packages/cdd-engine exec vitest run tests/parity`

#### Steps
- 建 `tests/parity/` 的三个家与 tsconfig 工程 — checkable: `pnpm run typecheck` exit 0 且点名 `tsconfig.src.json` 与 `tests/parity/tsconfig.json` 两个新工程
- 加 include — checkable: `pnpm -C packages/cdd-engine exec vitest run tests/parity` 能收集到 `parity.test.ts` 并因空实现而红/绿（任一，只要被收集）
- 提取夹具树 — checkable: `fixtures/trees.ts` 的 `TREE_SHAPES` 每一声明各可由 `materialize()` 在临时仓里造出，且各自被旧入口读成预期形态（用旧树的 `cdd board --plan` 与 `--dry-run` 各跑一次核对，读数落 `fixtures/README.md`）；`fixtures/non-tree.ts` 的三份非树夹具在册
- 写 `compareTree` 的旧树一侧 — checkable: 单跑旧树对同一场景两次，差异为空（自身确定性）
- 录制基线 — checkable: `baseline/` 覆盖 spec §2.2 的八面逐格（含面 1 的三条路逐格、`init` 的三格与 `issue render` 的 stdin 契约、面 2 的 `--help` / usage / 错用退出码 2），整个录制件带一个 `frozenDate`（每格只有 `state` 与 `value` 两件），记下**录制那一刻的 `stateOf`**（producer 落地情况的快照）与「这条路不存在」这一个事实；此刻新树的 producer 一个都没落地、已注册的 kind 只有 `entry` 一个，于是逐格是 GAP 或「不适用」，`pnpm -C packages/cdd-engine exec vitest run tests/parity` 已绿（GAP 集合此刻与名册里未接线的格逐格相等）。把某格 producer 落点改成可解析的一处而不重录 ⇒ 该格报「recorded as gap, but its producer has landed」——重录的两个触发点（格集变、本波落地 producer）由各波自己履行
- 写接线名册 — checkable: `GRID-WIRING.md` 的表格是 `grid.ts#rosterTable()` 的重渲（表头 `cell · task · producer · route` 四列），每一格点名一个接线任务、一格只挂一个接线任务，kind 不在表里（它在比对时由 `kindOf` 派生）；把任一格的接线任务从名册删掉，该格即红（不是 skip，也不是 `todo`）；把某格的 producer 落点改成树上尚不可解析的一处，它仍派生成 GAP
- 写 driver 的注册面 — checkable: `harness.ts#NEW_TREE` 里注册 `entry` 一个 kind（`NewTree.of([["entry", ENTRY_DRIVER]])`），其余 kind 一个都不注册；`NewTree.unwired().read(probe, frozenDate)` 抛 `NewTreeAbsent`，`kind` 就是 `kindOf(probe)` 派生的那个名字（缺席具名、不回落旧树、不静默成空）；`NEW_TREE.read` 对一个 `entry` probe 真的起一次进程，读数带 stdout / stderr / 退出码三件。**此刻新树没有一条已接线的格，故 T2 的红面只有「缺席具名」与自证臂两条**——第一条已接线格落地后，字节差异与缺格两条臂接上同一条判据。注册波表（`REGISTRATION_WAVES`）与 `entry` 占位的退役本任务不做——它们是 T8 的具名延后那一档的另一半
- 让对账器自身可红 — checkable: 走自证臂——同一场景在旧树连录两次、两份录制逐格互比为空；把其中一份录制的一个字节改写后同一条用例红，`pnpm -C packages/cdd-engine exec vitest run tests/parity` 判到那一格；撤回后绿。此刻新树一格未接线，这条臂不依赖任何新树 producer
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p39):` 起头

#### Acceptance
对账器被收集、可跑、自身可红（改一份旧树录制的一个字节即红；新树一格未接线不影响它——第一个接线格落地后，已接线格的字节差异接上同一条红臂）；夹具树（`TREE_SHAPES` 的声明集）与非树夹具（`non-tree.ts`）在册；基线覆盖 spec §2.2 的八面逐格（面 1 的 `命令 × 路 × 流` 三族、`init` 三格与 `issue render` 的在册项、面 2 的 `--help` / usage / 错用码 2），每格登记它的接线任务与 producer 的落点（模块 + 导出名），一格只挂一个接线任务，名册四列与 `rosterTable()` 的重渲逐行相等；录制件带期望字节、「这条路不存在」这一个事实与录制那一刻的状态快照（`stateOf`），GAP 由树上可解析与否判、录制件与树的不一致报缺格（缺格与 GAP 是两回事：前者是红），未接线的格读作 GAP（计数、非 skip、非红）而不是缺格，「不适用」的路在名册里写明而不是留空，`GRID-WIRING.md` 在树上；**具名延后那一档与注册波表归 T8**——T8 之前不得落地任何 entry kind 的 producer（本任务的口径里一个 kind 未注册就是缺格）；两个新 tsconfig 工程挂进根 `typecheck` 链；`pnpm run typecheck` 与 `pnpm -C packages/cdd-engine exec vitest run` 双绿。

#### DependsOn
1

### Task 3: `env/` 的路径与工作区

#### Objective
立起外部世界的第一层：路径基准、文档根、slug 索引与 workspace 布局/原子写。**不变量（写在 `env/index.ts` 的类注释里）**：所有写入只经一条声明过、原子、可预览的路径。本任务同时立 `env/` 的入口骨架，后面两个 env 任务往它里面加段。

#### Files
- Create: `packages/cdd-engine/src/env/index.ts`
- Create: `packages/cdd-engine/src/env/paths/root.ts`
- Create: `packages/cdd-engine/src/env/paths/doc-roots.ts`
- Create: `packages/cdd-engine/src/env/paths/slug-index.ts`
- Create: `packages/cdd-engine/src/env/workspace/workspace.ts`
- Create: `packages/cdd-engine/src/env/workspace/atomic.ts`
- Create: `packages/cdd-engine/src/env/workspace/round-log.ts`
- Create: `packages/cdd-engine/src/env/workspace/seal.ts`
- Create: `packages/cdd-engine/src/env/workspace/base-artifact.ts`
- Create: `packages/cdd-engine/src/env/workspace/__tests__/workspace.test.ts`
- Create: `packages/cdd-engine/src/env/paths/__tests__/paths.test.ts`

#### Consumes
- 旧树的 `infra/root.ts#RepoRoot` · `infra/doc-roots.ts#ENGINE_DOC_ROOTS` · `infra/slug-index.ts` · `infra/workspace.ts#Workspace` · `infra/atomic.ts#AtomicWriter` · `infra/round-log.ts` · `infra/carrier-seal.ts` · `face/artifacts.ts` 的 `BaseArtifact` · `BaseSource` · `BASE_ARTIFACT_FIELDS` · `#readBase` / `#baseName`（基产物的读写，含无 `--force` 时那一处冲突判定）与 `#readText` / `#runSchemaSkeleton` 的落盘那一段（文本读面与两条文本落盘面见 Produces）· `face/gate.ts#CliGate#renderBrief` · `session/round-naming.ts#RoundNaming#briefName`（brief 的工作区相对名与它的落盘）· `face/dispatch-values.ts#DispatchValues#INPUT_WAVE_BRIEF`（brief 的仓库相对路径消费者）；基产物的文件名由构造参数 `baseName` 进来，拼写矩阵的家在 T7 的 `run/ledger/artifacts.ts#ArtifactIdentity`，本任务不持第二份（以上会读行为，不读形状）

#### Produces
- `Env`（`env/index.ts`）：构造一次，成员为四段的只读门面；本任务交付 `paths` 与 `workspace` 两段
- `paths`：`RepoRoot.of(cwd)`（不可推算即抛）· `docRootsOf(root)` · `SlugIndex`（同 slug 多份 ⇒ `invalid`）
- `workspace`：`Workspace#ensure` / `#writeJson`（经原子写，基准是**工作区**：`WorkspaceRoot` 下 `<slug>/<name>`）/ `#writeText(name, text)`（文本落盘，基准是**工作区**：经 `Workspace#resolve` 落进本工作区，回传它写下的**仓库相对路径**——`INPUT_WAVE_BRIEF` 印的就是这条回值）/ `#writeTextAt(target, text)`（文本落盘，基准是**仓库根**：绝对路径由 `paths` 交付的 `RepoRoot` 从工作区根携带的仓库基准取，`RepoRoot#resolve` 是唯一拼法）/ `#readText(target)`（文本读，与 `#writeTextAt` 同一条仓库根拼写，读不到**返回一个声明过的失败值**而不是抛、也不返回空串）/ `#roundLogOf` / `#sealOf` · `BaseArtifact` 的读与写——**两条文本落盘面加一条文本读面，三个消费者各取自己那一条**：工作区相对的 `name` 是派发 brief（引擎自己写、孩子在**同一个工作区**里读的产物名，名字取自 T7 产物矩阵的 `brief` 行），仓库根相对的 `target` 是骨架落盘与物料读面（两者的 `target` / `file` 都是仓库根相对的 `RepoPath`）；拼写不许跨面复用——把 brief 拼到仓库根会让 `INPUT_WAVE_BRIEF` 印一个孩子读不到的路径、树上多出未跟踪文件，把骨架拼到工作区下会让目标一个字未写而 stdout 回显一个没被写的路径；`#writeText` 与 `#writeTextAt` 是 `src/**` 里仅有的两条文本落盘面（`schema get --output skeleton` 经 `#writeTextAt`；brief 经 `#writeText`，T13 的派发面在写它时取回值），这两条面之外 `src/**` 的非测试文件里再出现一处 `writeFileSync` 即缺陷（`env/workspace/` 是唯一落盘片），`#readText` 是物料读盘的那一个入口（T4 的 `Documents` 经注入调用它，`docs/**` 里因此零 `node:fs`）；两条写面的失败同样是一个声明过的值而不是抛（措辞归 `surface/render`，`env/` 零消费者字节）；**`BaseArtifact#set` 的冲突判定住这里**——既有产物的基 ≠ 新基且未带 `--force` ⇒ 声明过的 `conflict` 值（带既有基），带 `--force` 或产物缺席 ⇒ `written`；谓词与读回在本模块，那一行字节在 `surface/render`，壳里零判定；**读面同样回声明值**：`BaseArtifact#read` 的三种变体是 `{kind: "artifact", value}` · `{kind: "absent", target}` · `{kind: "corrupt", target}`——后两种的 `target` 是基产物的仓库相对路径，它就是 `base get` 那一格 `at <path>` 的填充值，读面因此不返回裸 `null`（`null` 不带路径，字节那一格就无从填充）；判别 `absent` 与 `corrupt` 的谓词在本模块，翻成成员的那一行在 `surface/render/usage.ts` 的转译表；**两处外部事实由构造参数进来，不在本模块里取**：`now: () => number`（时间戳来源，T5 的 `env/process/clock.ts` 落地后由组合根传入唯一实现）与 `baseName: string`（基产物的文件名，由 T7 的产物矩阵派生）。两个参数都是**必填无默认值**，缺即抛；本任务交付的三段（`env/index.ts` · `env/paths/**` · `env/workspace/**`）的非测试文件里零 `Date.now` / 零无参 `new Date(` / 零文件名拼接字面——`env/process/clock.ts` 是 `env/` 内唯一的读时钟处（T5 交付，`now()` · `isoOf(epoch)` · `dayOf(epoch)` 三件能力都在那里读）
- 四类路径判据的往返 pin：写入—读回—拼写不变量

#### Steps
- 写 `paths` 的两条 pin（可推算 · 不可推算即抛） — checkable: 在临时目录里 `RepoRoot.of` 取到 git 顶层；在非仓目录里它抛且报文点名 cwd
- 写 slug 索引的判据 pin — checkable: 同 slug 两份文档 ⇒ 该 slug 读作 `invalid`，单份 ⇒ 可取到路径
- 写基产物的 pin — checkable: 首次写入后读回的值与写入的是同一个对象（读面回声明值，成功变体带它）；字段集与 `BASE_ARTIFACT_FIELDS` 的元组逐值相等（断言从元组派生，不手写字段名）；畸形 JSON 读作 `{kind: "corrupt", target}`、产物缺席读作 `{kind: "absent", target}`（两个失败值都带 `target`，且都不抛、都不是裸 `null`；`target` 逐字节等于基产物的仓库相对路径）；`#set` 在既有产物的基不同的入参上返回 `conflict` 并带既有基，带 `--force` 的同一条入参返回 `written`，且本模块的非测试文件里零错用措辞（那一行字节在 `surface/render`）
- 写注入参数的 pin — checkable: 不传 `now` 或 `baseName` ⇒ 构造即抛（无默认值）；传一个固定 `now` 两次 ⇒ `recordedAt` 相同；传一个改过的 `baseName` ⇒ 落地文件名随之变（名字不是本模块的字面）
- 写 workspace 的原子写 pin — checkable: 写入过程中被注入的失败不留半截 JSON（读回旧值）
- 写文本读写的 pin — checkable: `#writeText` 落地的字节逐字节读回、`#readText` 读同一路径得回同一串（比字节，不比行数）；**两条基准各一条 pin**：`#writeTextAt` 面——在临时仓里立一份 `docs/**` 文档，用真的 `RepoRoot` 与真的 workspace 读它得回它的字节，再往另一份 `docs/**` 目标落一次文本后该目标非空、字节相等，且落点就是仓库根相对的那个 `RepoPath`（不是 `.kairos/<slug>/` 下的同名路径）；`#writeText` 面——同一 workspace 用工作区相对的 `name` 落一次文本，回传的仓库相对路径与它写下的那一处是同一条，字节逐字节读回，且该文件落在工作区根之下（brief 走这一条，`INPUT_WAVE_BRIEF` 的取值就是它）；写中途注入失败不留半截（读回旧值）；`src/**` 的非测试文件里，`writeFileSync` 只出现在 `env/workspace/` 这一片（`env/workspace/workspace.ts` 是唯一落盘处），别的文件里出现一次即红
- 写 `.kairos/.gitignore` 的 keep-out pin — checkable: `ensure` 之后 `.kairos/cdd/` 在被忽略面内，且它不建任何以 slug 命名的目录
- 写 `Env` 的门面 — checkable: `Env` 对外只露 `paths` 与 `workspace` 两段（成员集 pin），构造函数参数不超过四个
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/env` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
`env/index.ts` 的类注释第一行是不变量原句；`paths` 与 `workspace` 两段各至少三条 pin（可推算 / 不可推算即抛 · slug 单建与多份 invalid · 原子写不留半截 · keep-out 不建 slug 目录 · 文本读一条入口与两条写面各一条）；文本落盘全树只有 `Workspace` 的两条面——`#writeText` 以工作区为基准（派发 brief，回传仓库相对路径）· `#writeTextAt` 以仓库根为基准（骨架与物料落盘），`env/workspace/` 之外零 `writeFileSync`；物料读盘只有 `Workspace#readText` 一个入口（仓库基准，`docs/**` 里零 `node:fs`），读不到与写失败都是一个声明过的值而不是抛（真 `RepoRoot` + 真 workspace 的读写各一条 pin）；基产物的 `#set` 冲突判定在本模块、字节在 `surface/render`；零时钟面只盖本任务交付的三段（`env/index.ts` · `env/paths/**` · `env/workspace/**`），`env/` 内的唯一读时钟处是 `env/process/clock.ts`（T5）；`Env` 的成员集只有这两段；基产物的字段集从 `BASE_ARTIFACT_FIELDS` 派生；测试与源码同片。

#### DependsOn
1

### Task 4: `docs/` 的 markdown 文法

#### Objective
立起物料的第一层：把一份文档读成树、切成段、取出正文与跨度、解析 front-matter、跑 home 驱动的登记表提取、解析任务块。**不变量（写在 `docs/index.ts` 的类注释里，本任务只立它的骨架）**：文档的形状由登记表判、判据只读文本。本任务的交付物是「文本进、索引出」的读取面：文本从注入的 `env` 读面取（`env.workspace#readText`，T3），本片自己零 `node:fs`、零磁盘读。它不认识判据，也不认识轮次。

#### Files
- Create: `packages/cdd-engine/src/docs/index.ts`
- Create: `packages/cdd-engine/src/docs/grammar/markdown-tree.ts`
- Create: `packages/cdd-engine/src/docs/grammar/markdown-document.ts`
- Create: `packages/cdd-engine/src/docs/grammar/doc-body.ts`
- Create: `packages/cdd-engine/src/docs/grammar/frontmatter.ts`
- Create: `packages/cdd-engine/src/docs/grammar/extract.ts`
- Create: `packages/cdd-engine/src/docs/grammar/task-blocks.ts`
- Create: `packages/cdd-engine/src/docs/grammar/__tests__/grammar.test.ts`

#### Consumes
- 旧树的 `contract/markdown-tree.ts` · `contract/markdown-tree-types.ts`（`Walk` / `When` / `Selector` 的类型面，跟着树走）· `contract/markdown-document.ts`（mdast 解出的文档索引：行 · 标题 · front-matter 键 · 表格 · 行内代码跨度）· `contract/markdown-spans.ts` · `contract/doc-body.ts` · `contract/frontmatter.ts` · `contract/home-extractors.ts` · `contract/task-block-grammar.ts` · `contract/task-blocks.ts`（读行为；闭包读不在这一片——它判的是闭包而不是正文文法，落 T10）

#### Produces
- `Documents`（`docs/index.ts`）门面骨架，本任务只露 `parse`；构造入参含文本读面 `readText: (target) => RepoText | ReadFailure`（组合根传 `env.workspace#readText`，T3；它按仓库根基准拼路径，故 `docs/**` 的目标读得到，读不到时回一个声明过的失败值）——`parse` 从注入的读面取文本，不从磁盘取；**读面的失败值原样返回**：`parse` 的返回值带一个声明过的读失败面（`{kind: "read-failure", target}`），不当空文档、不改抛，措辞由 `surface/render` 拼（命令面的 `error: cannot read file: <rel>` 就是它经那一处印出的），本片零消费者字节；落盘能力（`textWriter`）与当天日期（`today`）本任务不收，它们在 T9 装配器构造处一并进来
- `grammar`：`MarkdownTree`（标题树 + 围栏感知）· `MarkdownDocument`（不可变的文档索引：一次 mdast 解析，标题 / 表格 / front-matter 键 / 行内代码全是它的只读面）· `docBodyOf`（正文段与记录面的分界）· `frontmatterOf`（真 YAML 解析，失败即带位抛）· `HomeExtractor`（登记表 home 驱动）· `TaskBlocks`（任务块与 `DependsOn` 行）
- 树节点与跨度都是不可变值类型

#### Steps
- 写围栏感知的 pin — checkable: 正文围栏里的 `## 标题` 不进标题树；围栏外的进
- 写文档索引的 pin — checkable: 同一份文本两次解析读出同一索引（标题序与表格格集相同），且围栏里的表格不进索引
- 写 front-matter 的 pin — checkable: 合法 YAML 读回键集；非法 YAML 抛且报文带行位
- 写正文分界的 pin — checkable: `## Change history` 的行被读作记录面，正文段的判据不读它们
- 写读面注入的 pin — checkable: 同一个目标路径先后配两个不同的假读面 ⇒ 两次 `parse` 读出不同的文本与索引（读盘不绕过注入面）；`docs/**` 的非测试文件里零 `node:fs` import（import 面断言）
- 写登记的 home 提取 pin — checkable: 改登记表的 home 值即改提取结果（同一 fixture 两次读，结果随 home 变）
- 写任务块 pin — checkable: `#### DependsOn` 的一行逗号集读成 id 列表，`none` 读作空集；`DependsOn` 循环被读出
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/docs` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
`docs/index.ts` 的类注释第一行是不变量原句；五条 pin 齐（围栏感知 · front-matter 失败带位 · 记录面不参与正文判据 · home 改动即改提取 · 任务块与循环）；`grammar` 段对 `judging` 零依赖（import 面断言）；`docs/**` 里零 `node:fs`，读盘只经注入的 `env.workspace#readText`（换一个假读面即改读到的文本）；读面的失败值原样返回（不抛、不当空文档）；

#### DependsOn
1

### Task 5: `env/` 的进程、主机与版本库

#### Objective
补完外部世界的其余接触面：进程事实、宿主契约、系统时钟、子进程 seam、锁、git 读。**不变量不变**（`env/` 仍是那一条），本任务把 `Env` 的两段加到四段。

#### Files
- Create: `packages/cdd-engine/src/env/process/proc.ts`
- Create: `packages/cdd-engine/src/env/process/host.ts`
- Create: `packages/cdd-engine/src/env/process/clock.ts`
- Create: `packages/cdd-engine/src/env/process/child-runner.ts`
- Create: `packages/cdd-engine/src/env/process/lock.ts`
- Create: `packages/cdd-engine/src/env/vcs/git.ts`
- Create: `packages/cdd-engine/src/env/vcs/plan-source.ts`
- Create: `packages/cdd-engine/src/env/process/__tests__/process.test.ts`
- Create: `packages/cdd-engine/src/env/vcs/__tests__/git.test.ts`
- Modify: `packages/cdd-engine/src/env/index.ts`

#### Consumes
- 旧树的 `infra/proc.ts#ProcessFacts` · `infra/runtime.ts#ENGINE_RUNTIME` · `infra/config.ts` · `infra/git.ts#GitClient` · `infra/plan-source.ts` · `face/host.ts#HOSTS` / `#DISPATCH` / `#REFS` / `#HostDetect`（宿主契约的数据面与它那一次探测）· `face/termination.ts#ChildRunner` / `#Terminator`（进程 seam：进程组 · 组杀 · 信号升级 · 父退出清理）· `face/artifacts.ts` 的 `#today()`（骨架面的 `date:` 行从它来）· `contract/liveness-signal.ts`（只读它声明的采样契约）；`session/inflight.ts#InFlight` 的锁持有面（只读行为；锁的持有者在**本任务**就落到 `env/process/lock.ts`，T12 的 in-flight 只经它取锁）

#### Produces
- `process`：`ProcessFacts`（进程组去重 · 存活判定）· 宿主契约（`HOST_IDS` 词表 · 从它派生的 `HostId` · `HOSTS` 的每 harness 行 · `DISPATCH` 的派发槽 · `REFS` 的斜杠形 · `HostDetect` 的一次探测）——宿主标记环境键的闭集只有 detect 行这一份，通道闭合守卫从它派生白名单；`HOST_IDS` 与 `HostId` 同住 `env/process/host.ts`，树外测试面 `packages/kairos/tests/presentation-surface.test.ts` 用类型谓词把契约键窄化成宿主词表，故这个类型必须有落点（T18 的改指清单）；`ENGINE_RUNTIME` 这个聚合体不重建——它带的两个事实已各有落点（`docRoots` 在 `env/paths/doc-roots.ts#DOC_ROOT_SEGMENTS`、`handoffNamespace.workspaceRoot` 在 `env/workspace/workspace.ts#WorkspaceRoot.DEFAULT_SEGMENT`），本片不导出这个聚合 · `Clock`（系统时钟的唯一持有者，三件能力：当前时刻 `now()` · epoch → UTC ISO 形 `isoOf(epoch)`（`toISOString` 的字节保真面，`Words` 的 `{startedAt}` 靠它）· epoch → 本地日 `dayOf(epoch)`（`YYYY-MM-DD`，旧树的本地 getter 形，骨架面的 `date:` 行由它来；在 UTC 偏移非零的本地日界，UTC 切片与本地日相差一天，故两者各是一件能力、不互相切片派生）；下游只收注入的时钟——骨架面的 `date:` 行与 `Words` 的 `{startedAt}` / `{uptime}` 行都从这里来）· `ChildRunner` 的接口与它的生产实现（spawn · 组杀 · 信号升级 · 父退出清理 · 墙钟上限）：spec §4 说 `env/` 是唯一需要接口的边界，活性判官由派发面注入，这里只负责起进程与杀进程 · `Lock`（`proper-lockfile` 的唯一持有者）
- `vcs`：`GitClient`（只读：顶层、状态、提交）· `planSourceOf`
- `Env` 成员扩到四段：`paths` · `workspace` · `process` · `vcs`

#### Steps
- 写进程事实的 pin — checkable: `npm exec` 包装内的子进程不重复计数（一组进程一条事实）；已退出进程读作不在
- 写宿主探测「只探一次」的 pin — checkable: 同一 `Env` 上连续两次取宿主事实，底层探针只被调用一次（注入计数探针）
- 写锁的 pin — checkable: 持有期间第二次获取被拒且报文点名持有者；释放后可获取
- 写宿主契约与时钟的 pin — checkable: `HOSTS` 的 detect 行是宿主标记环境键的唯一一份（守卫从它派生，不另立表）；`REFS` 的每 harness 形可派生；`Clock` 是 `src/**` 非测试文件里唯一读时钟的地方（扫无参 `new Date()` 与 `Date.now()` 的调用面；带时间戳的 `new Date(epoch).toISOString()` 是格式化、不算读时钟，它走 `Clock` 的 ISO 面），注入固定时钟 ⇒ 下游读到的日期稳定；注入一个固定 epoch ⇒ `dayOf(epoch)` 就是那一天的本地日、`isoOf(epoch)` 是它的 UTC ISO 形，两者各一条断言（同一个 epoch 在 UTC 偏移非零的本地日界读出不同的日期，故 `date:` 行不能由 `isoOf` 切日派生）
- 写子进程 seam 的 pin — checkable: 何时动手只由注入的采样判官决定，seam 自己不判活性；组杀之后无存活子进程（伪造子进程表）；`src/run/dispatch/**` 里不出现 signal 常量（扫调用面）
- 写 git 读的 pin — checkable: 顶层、状态、提交三项各一条；状态读在脏树/净树两种输入下各一条
- `Env` 成员扩到四段 — checkable: 成员集 pin 更新且不超过四段；构造参数仍不超过四个
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/env` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
四条 pin 齐（进程组去重 · 宿主只探一次 · 锁持有与释放 · git 三读）；宿主契约与时钟各一条 pin、子进程 seam 一条；`Env` 四段成员集 pin 绿；`env/` 对 `run/` `docs/` `surface/` 零 import（import 面断言）。

#### DependsOn
3

### Task 6: `docs/` 的身份与登记表

#### Objective
把物料从「字符串」变成「有身份的文档」：DocType 与登记表、slug 与文档身份、目标类型、登记表的六面派生投影、四类 DocType 的解析面、词表驱动的识别面、`SKILL.md` 的解剖契约。**身份的那张表住 `identity/`**，因为它判的正是身份；判据的表与引擎在 T9 / T10 落地。**不变量（`docs/index.ts` 类注释）**：文档的形状由登记表判、判据只读文本；同一事实一个拼写。

#### Files
- Create: `packages/cdd-engine/src/docs/identity/types.ts`
- Create: `packages/cdd-engine/src/docs/identity/registry.ts`
- Create: `packages/cdd-engine/src/docs/identity/project.ts`
- Create: `packages/cdd-engine/src/docs/identity/doc-parse.ts`
- Create: `packages/cdd-engine/src/docs/identity/translate.ts`
- Create: `packages/cdd-engine/src/docs/identity/skill-anatomy.ts`
- Create: `packages/cdd-engine/src/docs/identity/__tests__/identity.test.ts`
- Modify: `packages/cdd-engine/src/docs/index.ts`

#### Consumes
- 旧树的 `contract/declare.ts#DocType` / `#ElementRegistry` / `#DocFace` · `contract/target-type.ts` · `contract/project.ts#Projector`（登记表的六个派生面）· `contract/doc.ts#docTypeParsers` / `#DocSyntaxError`（四类 DocType 的解析面）· `contract/translate.ts#Translator` / `#RowSource`（识别与本地化两张表）· `contract/skill-anatomy.ts`（`SKILL.md` 的解剖契约常量）

#### Produces
- `identity`：`DocType`（四值）· `TargetType` · `ElementRegistry` 与 `DocFace`（登记表本体）· slug 值域 · `Projector`（登记表派生的六个面：shape · schema · slices · tokens · reference · skeleton）· 四类 DocType 的解析面（按登记表与投影走，零判定）· `Translator`（词表驱动的识别面：`canonicalize` 与 `localize`，两张表是注入的数据，零 switch）· `SKILL_ANATOMY`（`SKILL.md` 解剖契约的常量面：kairos 与 scripts 的守卫消费它，翻面时改指这一处）
- `Documents` 门面扩出 `registryOf(type)` 与 `projectOf(type, target | undefined)` 两个读面——`projectOf` 是 `schema get` 的 json 面入口：回 `{kind: "projection", text}`（`Projector#schema()` 那一行的序列形——与 T9 的 `compose` 同形：派生面的字节面，措辞与流不在这一片，壳原样印）或 `{kind: "extra-target", target}` 这个**声明失败值**（与 T4 的 `read-failure`、T9 的 `write-failure` 同一形态；json 面不收 target，argv 的路径字面原样递进来、判定在 `docs/` 里）。**本片只回值、不命名 `UsageReason` 的成员**：那个 closed union 的家在 `run/advance/frame.ts`（T13），而 `docs/` 不知道轮次与 `next:`、也不得 import `run/`（spec §1.2，反向边还会与 `run/` 读 `docs/` 成环）——翻成「多余 target」那一格的是 T15 的 `FAILURE_REASONS` 一行（W9 落，晚于本波也不撞墙）

#### Steps
- 写身份的 pin — checkable: 四类 DocType 各一条；未知 type 即抛；slug 值域的正负例各一条
- 写登记表与 doc-face 的 pin — checkable: 每类的 face 集可读；一处 face 声明与正文实际 section 集不符即红
- 写投影的 pin — checkable: 六个派生面各一条；改登记表的一格即改对应投影（投影不是第二份真源）
- 写 json 面拒绝的 pin — checkable: `projectOf(type, undefined)` 回 `{kind: "projection", text}`，同一 type 两次取值字节相同；`projectOf(type, target)` 回声明失败值 `{kind: "extra-target", target}`（`target` 就是递进来的那份路径字面；本片不 import `run/`、不命名 union 的成员——翻成「多余 target」那一格的是 `FAILURE_REASONS`，判定在 `docs/` 里，壳里零分支）
- 写解析面零判定的 pin — checkable: `identity/` 对 `judging/` 零 import；解析面只按登记表与投影走
- 写识别面零 switch 的 pin — checkable: `Translator` 的两张表是构造入参；换一份改写过的表 ⇒ 识别结果随之变（零硬编码分支）
- 写解剖契约的 pin — checkable: `SKILL_ANATOMY` 的章节集可读，且与 kairos 侧守卫消费的常量同源（同一份导出）
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/docs` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
六组 pin 齐（身份四类与值域 · 登记表与 face · 六面投影与 json 面的拒绝臂 · 解析面对 `judging/` 零 import · 识别面零 switch · 解剖契约同源）；`identity/` 里没有判据、没有注册表的策略类。

#### DependsOn
4

### Task 7: `run/` 的账本

#### Objective
立起机器的事实层：轮次身份、波行、文档评审行、分支线、审过的版本、产物身份、裁决与改档。**不变量（写在 `run/ledger/ledger.ts` 类注释，并在 `run/index.ts` 汇总该片不变量）**：同一事实一个家，一条记录只被一处写。本任务不碰判定——只记账与读回。

#### Files
- Create: `packages/cdd-engine/src/run/index.ts`
- Create: `packages/cdd-engine/src/run/ledger/ledger.ts`
- Create: `packages/cdd-engine/src/run/ledger/identity.ts`
- Create: `packages/cdd-engine/src/run/ledger/artifacts.ts`
- Create: `packages/cdd-engine/src/run/ledger/reviewed.ts`
- Create: `packages/cdd-engine/src/run/ledger/rulings.ts`
- Create: `packages/cdd-engine/src/run/ledger/carrier-line.ts`
- Create: `packages/cdd-engine/src/run/ledger/artifact-reads.ts`
- Create: `packages/cdd-engine/src/run/ledger/__tests__/ledger.test.ts`

#### Consumes
- 旧树的 `session/ledger.ts`（`RoundFinding` / `RoundRecord` / 波行 / 文档行 / `#orphanHandoffs` 那个孤儿草稿读面）· `face/board-view.ts#crashedRows` 与它的 `#crashed` 谓词（崩溃轮的判据与行格——读行为，行的字节归 T15）· `session/line-identity.ts` · `session/round-artifacts.ts` · `session/round-naming.ts` · `session/reviewed-identity.ts` · `session/carrier-rulings.ts` · `session/carrier-integrity.ts` · `session/state.ts` · `session/artifact-reads.ts`（产物矩阵的判定与 sidecar 严格 schema 的合流）· `contract/carrier-line.ts#CarrierLine`（载体完整性那一行的唯一组装点）（读行为）

#### Produces
- `Run`（`run/index.ts`）门面骨架，本任务只露账本读面
- `ledger`：`Ledger#recordRound` / `#rounds` / `#waveLines` / `#docLines` / `#branchLine` / `#orphanHandoffs` / `#crashedOf` / `#nodeRecordsOf` / `#carrierPathOf` / `#observedArtifacts` · `RoundIdentity`（`(line, op, cycle, attempt)` 单射）· `ArtifactIdentity`（产物的名字与归属）· `ReviewedIdentity`（这一轮审的是哪一版）· `Rulings`（裁决与改档的落地与读回）
- `Ledger#orphanHandoffs()`：孤儿草稿的读面——工作区里不可归属的名字，或可归属的 `draft` / `final` 轮载体而 `progress` 里没有任何记录认领它；无产物矩阵时回空集。板面的 `orphan:` 行与预览 `reads:` 行的尾后缀取同一个读值（两处不各读一次账本，也不各判一次归属）
- `Ledger#crashedOf(records)`：崩溃轮的读面——按轮身份去重、按 `(cycle, attempt)` 排序，每轮一格 `{op, cycle, attempt, cause}`（一轮收下的裁决没扣住目标动作、且至少一条违规是 hard，才算崩；`cause` 取该轮记录序里第一条 hard 违规，不重排）。`crashed:` 行由它取格，渲染器只连接词表
- `Ledger#nodeRecordsOf(progress)`：节点自己的 `RoundRecord[]`——把 progress 的波行摊平成记录序（旧树 `face/board-view.ts` 那个同名私有读面的行为），`#crashedOf` 的入参取自它，于是渲染器与 `Run#boardOf` 都不自己收集记录
- `Ledger#carrierPathOf(type, key, record)`：记录载体路径的唯一访问口（旧树 `session/ledger.ts` 的同名读面：身份到渲染名到载体的解析只在这一处收口）；渲染面不自己拼载体名、不自己扫工作区
- `Ledger#observedArtifacts()`：产物观察集——本账本自己那几行（文档行 · 波行 · 分支线）里的评审轮逐条摊成一条观测条目 `{line, kind, cycle, attempt, carrier, read}`（`kind` 是 `rulings`；`carrier` 经 `#carrierPathOf` 取；`read` 是该载体经 `ArtifactReads` 读出、并把载体失配折叠进 `invalid` 的读值），按 `(cycle, attempt)` 排序后交出；席位由调用方选账本实例（节点板取节点席位、程序板取程序席位，两个席位按名字分开而不按参数位置）。观测集是记录序列、不是工作区的名字清单——一条没有记录认领的 `*.rulings.json` 留在 `orphan:` 那一面，不进这一集
- `CarrierLine`：`carrier-mismatch` 站名 + 载体路径 + 两个 8-hex 前缀，全树唯一一处拼写——抛出的 `CarrierMismatchError` 与门口的 `carrier` 行共用它
- `ArtifactReads`：产物矩阵的判定与 `Rulings` 的严格 schema 合成一个读值（names · presence · misplaced · absent 四态同源），两处消费者不各拼一次
- 记录一律经 `env.workspace` 的原子写落地

#### Steps
- 写轮次身份单射的 pin — checkable: 同一 `(line, op, cycle, attempt)` 两次记录 ⇒ 后者被拒或覆盖同一格（按旧行为的哪一种，pin 钉住那一种）；不同 `attempt` 是两条
- 写波行闭合的 pin — checkable: 波行闭合后记录 `planTasks` 快照；未闭合的波行读作进行中
- 写文档行的 pin — checkable: 文档评审行带 `doc_hash`；同一文档第二次评审批次递增
- 写审过版本的 pin — checkable: 记录后改文档 ⇒ 读回该行的 `doc_hash` 与现文档不一致（drift 的读面成立）
- 写产物身份的 pin — checkable: 产物的名字由身份四元组派生；同四元组同 kind 两次写 ⇒ 后者被拒（不许两个名字指同一产物）
- 写裁决的 pin — checkable: 裁决落地后读回；改档记录保留原档与新档
- 写载体行与产物读的 pin — checkable: 抛出的 `CarrierMismatchError` 报文与门口 `carrier` 行由同一处拼出（同一份事实两次读，字节相同）；产物读的四态各一条（同名两处 ⇒ `misplaced` · 缺席 ⇒ `absent` · sidecar 违约 ⇒ 拒绝而非半值）；`#orphanHandoffs` 一条（无人认领的草稿名字进集、被记录认领的载体名字不进集、无产物矩阵时回空集）；`#crashedOf` 一条（裁决没扣住目标动作且带 hard 违规的那一轮出一格，同一轮身份两次记账只一格，只有 soft 违规的轮不出格）；`#observedArtifacts` 一条（观测条目按 `(cycle, attempt)` 序、每条带载体与读值、无记录认领的 sidecar 名字不进集），`#carrierPathOf` 与 `#observedArtifacts` 的载体名同源（同一份记录两次取，字节相同）
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/run` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
六组 pin 齐（身份单射 · 波行闭合与快照 · 文档行与 doc_hash · 审过版本的可 drift 读面 · 产物身份单射 · 裁决与改档）· 载体行、产物读与观测集各一条；`run/ledger` 对 `run/gate`、`run/dispatch`、`run/advance` 零 import（它是最低段）；所有写入经 `env.workspace`。

#### DependsOn
6

### Task 8: `env/` 的供给（`init` 与 `plugins`）

#### Objective
补完 `env/` 的最后一段：harness 的安装与更新序列。**它留在 `env/` 内**（不单开一片）——它与 workspace 写入守同一条不变量：只经声明过、原子、可预览的步骤触碰外部世界。

#### Files
- Create: `packages/cdd-engine/src/env/provision/init.ts`
- Create: `packages/cdd-engine/src/env/provision/plugins.ts`
- Create: `packages/cdd-engine/src/env/provision/__tests__/provision.test.ts`
- Modify: `packages/cdd-engine/src/env/index.ts`
- Modify: `packages/cdd-engine/tests/parity/harness.ts`（两件：`REGISTRATION_WAVES`（具名延后那一档，`seam` 的注册波记为 T16）、`entry` 占位驱动的退役；`seam` 的 driver 不在本波注册）
- Modify: `packages/cdd-engine/tests/parity/GRID-WIRING.md`（名册散文指到 `REGISTRATION_WAVES`；表格由 `grid.ts` 重渲，本片不改任何一格的行——名册里没有一格归本片，`init` 的三格仍挂 T15 的 `surface/render/init.ts#InitRenderer`，`Provisioner#plan` 是它们 driver 的步骤数据面而非第二格）
- Modify: `packages/cdd-engine/tests/parity/parity.test.ts`（两件：逐波判据加「具名延后」那一档；`entry` 登记断言的换向——`parity.test.ts` 里「registers the new tree's own process entry」那一条本断 `NEW_TREE.kinds()` 含 `entry`，换后断的是「`NEW_TREE.kinds()` 不含 `entry` 而 `REGISTRATION_WAVES` 带 `entry` 行」这一对派生事实，不删断言也不写新的字面波次）

#### Consumes
- 旧树的 `face/init.ts#CliInit` · `face/plugins.ts#PLUGINS`（读行为：九步 vs 六步、`--include-recommends` 的两档、`--update` 的两序列、`--dry-run` 零 spawn）

#### Produces
- `provision`：`Provisioner#plan(host, options)`（返回步骤序列，纯）· `#apply(steps, onStep)`（真 spawn；`onStep(index, step)` 是注入的进度面，在每一步 spawn **之前**被调用一次——旧树是边跑边印，故进度面在跑之前而不在之后，`env/` 仍零消费者字节：回调带的是步骤事实，拼字的事归 `surface/render/init.ts`）；**`#apply` 不抛，回值是一个声明过的值**：`{kind: "green"} | {kind: "failed", index, exitCode}`——首败那一步的序号与退码随回值出去，于是首败报里的 `exit <code>` 有来源（`<code>` 就是 spawn 的返回值，不由渲染器猜、不由壳自造）
- `Env` 成员扩到五段
- 步骤数据面单源：`PLUGINS` 的行即核心三包 + 推荐六包，claude 列空
- `init` 格的缝：`Provisioner#plan` 的纯步骤序列是那几格 driver 的**步骤数据面**——对账器在进程内驱动两棵树，PATH 替身的 harness 与注入 step runner 都挂在这条缝上，零真 spawn；名册里 `init` 的三格仍挂 T15 的 `surface/render/init.ts#InitRenderer`（一格一个接线任务），`seam` 的注册波是 T16（命令面那一波），本片不注册 driver，`init` 三格在本片及其后读作 GAP 或具名延后，名册行不动
- **具名延后那一档**（`harness.ts` + `parity.test.ts`）：`reconcile` 在「producer 已可解析而该 kind 无 driver」处不再直接算缺格——读 `REGISTRATION_WAVES`，那个 kind 带一条声明的注册波 ⇒ 计入**具名延后**并报出注册波，没有声明 ⇒ 缺格（缺席必须具名）。本片不改录制件、不改 `stateOf`（重录仍只由「格集变」与「本波落地 producer」两个触发点驱动，见 T2）——它只把第五档补上，于是 entry 类格在 W9 / W10 读到空进程之前就被兜住
- `REGISTRATION_WAVES`（住 `harness.ts`，与 `NEW_TREE` 同处）：kind → 注册波的一张表（`seam` → T16 · `render:skeleton` → T9 · 其余 `render:<family>` → T15 · `entry` → T17），`reconcile` 的**具名延后**那一档只读它——真实交付的 `baseline/` 每格虽带状态，状态只能报「录制与树不一致」，它不能回答「这个 kind 到底什么时候会有 driver」；引擎上这件事的答案就在这张表里。后落同 kind 格的波不重复登记，也不重写这张表的行
- `entry` 占位驱动的退役：T2 在第一波就注册了 `entry`（`NewTree.of([["entry", ENTRY_DRIVER]])`），而那个 driver 答不出字节（`src/bin.ts` 在这一波只抛「未接线」）；本波把它退掉，`entry` 的注册留给 T17。于是 entry kind 的格在那之前读作**具名延后**（注册波 T17），落地产 producer 也不改变这一点——W9 / W10 因此不会读到「板面与预览录下了字节、树上是空进程」的差异，`REGISTRATION_WAVES` 与 `NEW_TREE` 的键集也各说各的真话（表说 `entry` 在 T17、`seam` 在 T16，`NEW_TREE` 里这两个 kind 都还没有 driver；`render:*` 的注册归渲染片的注册波，不在本片的读数里）；同批把 `packages/cdd-engine/tests/parity/parity.test.ts` 的登记断言换向——那条用例（「registers the new tree's own process entry」）此前断 `NEW_TREE.kinds()` 含 `entry`，换向后断「`NEW_TREE.kinds()` 不含 `entry` 且 `REGISTRATION_WAVES` 带它的注册波行」这一对事实（两件各从自己的声明处派生），于是「entry 类格确实被具名延后兜住」仍有一条判者；T17 重新注册 `entry` 时把这条换回 `toContain`，两步成对

#### Steps
- 写「预览即计划」的 pin — checkable: `plan()` 对同一入参两次结果字节相同；`apply()` 收到的序列与 `plan()` 的返回值逐项相等（注入 step runner 记录）
- 写零 spawn 的 pin — checkable: `--dry-run` 路径下 step runner 零调用
- 写两档的 pin — checkable: 不带旗标与带 `--include-recommends` 的步骤数按数据面派生（不写字面计数）；claude 档零推荐步骤
- 写 `--update` 的 pin — checkable: update 序列与 install 序列的步骤集不同，且两者都来自同一数据面
- 登记 `seam` 的注册波 — checkable: `harness.ts#REGISTRATION_WAVES` 的 `seam` 行记的是 T16（命令面那一波：一条 `seam` probe 要读的是一次完整命令的 stdout / stderr / 退出码，`Cli#run` 与 `surface/commands/**` 都在那里落地，本波驱动不出这三件）；本片不注册任何 driver，`NEW_TREE.kinds()` 不含 `entry` 与 `seam`（`entry` 占位已退、`seam` 还没到注册波；读数按本片的增量取，`render:*` 的注册不归本片，W4 同波 T9 注册的那个 kind 不在这一条里）；用一条测试里现造的已接线 `seam` 格（不进 `CELLS`）核两向——表里有那一行 ⇒ 该格计入具名延后并点名 T16，把那一行删掉 ⇒ 同一格报缺格（缺席必须具名）
- 写具名延后那一档 — checkable: 把一个已接线格的 kind 对应的 driver 从 `NEW_TREE` 拿掉、而 `REGISTRATION_WAVES` 里它有行 ⇒ 该格计入具名延后并报出注册波（不是缺格、不是差异）；把那一行注册波从表里删掉 ⇒ 同一格变成缺格（缺席必须具名）；`REGISTRATION_WAVES` 的键集与 `CELLS` 经 `kindOf` 派生出的 kind 集逐值相等（两侧各从自己的声明处派生，不手写字面 kind 名单）
- 退掉 `entry` 的占位驱动 — checkable: `NEW_TREE.kinds()` 本波不含 `entry`（它的注册波记在 T17）；把一个 entry 格的 producer 改成可解析的一处 ⇒ 它读作具名延后并点名 T17，不是差异；同批把 `parity.test.ts` 的登记断言换向（「registers the new tree's own process entry」那一条由「含 `entry`」改成「不含 `entry` 且 `REGISTRATION_WAVES` 带 `entry` 行」这一对派生事实——不删断言、不写新字面）；`pnpm -C packages/cdd-engine exec vitest run src/env tests/parity` 绿（这条判据在换向前是本步必红的一条：它断的正是本步退掉的东西）
- 写预览与真跑同源的 pin — checkable: 同一份入参下，预览的行序列与真跑的行序列只在两处不同——步骤行（`would run: <argv>` ↔ `init[i/n] <host> · <pkg> · <argv>`）与摘要行（预览尾 `— dry run, nothing executed` ↔ 真跑的 ` ok`），其余逐行逐字节相等（注入 step runner 记录 `onStep` 的调用序：全绿时每步一次且在 spawn 之前，首败时到失败那一步为止、之后零调用）；`#apply` 的回值：全绿时 `{kind: "green"}`，首败时 `{kind: "failed", index, exitCode}` 且 `index` 与注入 runner 记下的失败步同号、`exitCode` 等于替身返回码（改替身返回码 ⇒ 回值随之变）
- `Env` 扩到五段 — checkable: 成员集 pin 更新；构造参数不超过四个（超出则收参数对象）
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/env` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
五条 pin 齐（预览即计划 · 零 spawn · 两档按数据面派生 · update 与 install 同源 · 预览与真跑同源）；`env/` 五段成员集 pin 绿；`provision` 的步骤数据面只有一处；`#apply` 的进度面是注入的，`env/` 里零消费者字节（`would run:` · `init[i/n]` · 摘要 · 首败报的措辞都在 `surface/render/init.ts`）；具名延后那一档已落（`REGISTRATION_WAVES` 的键集与 `kindOf` 派生的 kind 集相等 · 一个已接线格在它的 kind 无 driver 但带注册波时计入延后并报出注册波 · 无声明注册波的 kind 报缺格）· `entry` 的占位驱动已退役（它的注册波是 T17）· `seam` 的注册波登记为 T16、本片不注册任何 driver（`NEW_TREE.kinds()` 不含 `entry` 与 `seam`；`render:*` 的注册不归本片，W4 同波 T9 的注册不改变这条增量读数） · 录制件与 `stateOf` 本片不动（重录仍只由 T2 的两个触发点驱动）· 名册里 `init` 的三格仍挂 T15。

#### DependsOn
3, 5

### Task 9: `docs/` 的判据表与骨架

#### Objective
判据的**表**与骨架的生成：评审判据体与 lens 问句表、完成判据、波宽，以及四族骨架。**名册取自表的键集或穷举 switch 的分支集**，不在散文里写计数；骨架的日期只从构造入参进来。

#### Files
- Create: `packages/cdd-engine/src/docs/judging/criteria.ts`
- Create: `packages/cdd-engine/src/docs/judging/completion.ts`
- Create: `packages/cdd-engine/src/docs/judging/wave-width.ts`
- Create: `packages/cdd-engine/src/docs/judging/task-graph.ts`
- Create: `packages/cdd-engine/src/docs/skeleton/assembler.ts`
- Create: `packages/cdd-engine/src/docs/judging/__tests__/criteria.test.ts`
- Create: `packages/cdd-engine/src/docs/skeleton/__tests__/skeleton.test.ts`
- Modify: `packages/cdd-engine/src/docs/index.ts`
- Modify: `packages/cdd-engine/tests/parity/grid.ts`（本片各格的名册行）
- Modify: `packages/cdd-engine/tests/parity/baseline/`（重录产物：本片落地的 producer 把它名下的格从 GAP 推进到已接线）
- Modify: `packages/cdd-engine/tests/parity/harness.ts`（`render:skeleton` 的注册波就是本波：进程内驱动装配器入口）
- Modify: `packages/cdd-engine/tests/parity/GRID-WIRING.md`（本片各格的名册行）
- Modify: `packages/cdd-engine/tests/parity/parity.test.ts`（本片各格的比较项）

#### Consumes
- 旧树的 `contract/review-criteria.ts`（含 `LENS_QUESTION_ROWS`）· `contract/completion-criterion.ts#CompletionCriteria` · `contract/wave-width.ts#MAX_TASKS_PER_WAVE` · `render/skeleton.ts#SkeletonAssembler#compose`（读行为与四族的分支集）
- 旧树的 `session/graph.ts#TaskGraph`（`GraphIssueClass` 的四类边失败 · `batches()` 的拓扑波分解 · `frontier(done)` · `detailLine()`）与 `contract/task-blocks.ts` 的 `DependsOn` 行（T4 交付）：图的边只从任务块来，没有第二份边表；`session/preflight.ts` 的 `graph` 腿是它在新树上的结构判消费面
- `identity/project.ts` 的 `skeleton()` 投影（T6 交付：骨架的槽位与 front-matter 发射表都从登记表派生）
- spec §2.3 的骨架日期钉法（日期只从构造入参进来）

#### Produces
- `criteria`：评审判据体（按 kind 的判据文本）与 `LENS_QUESTION_ROWS`；`Documents.criteriaOf(kind)` 与 `lensQuestionsOf(kind)`
- `CompletionCriteria`（按 verb 分档）· `MAX_TASKS_PER_WAVE`
- `TaskGraph`（`docs/judging/task-graph.ts`）：从 `TaskBlocks` 的 `DependsOn` 行构造，`#validate()` 四类边失败（缺边 · 缺 id · 自环 · 成环）· `#batches()` 的拓扑波分解 · `#frontier(done)` · `detailLine()`（一条失败的一行拼写）。两条 pin 跟它同住：**波宽只此一处派生**（波宽判的正是 `#batches()` 的每一批，另立一份波分解即缺陷）· **表与族同住**（边读与它的校验同在这一个类，不另开一份边表）。它落在本任务而不是 `run/` 或 `run/advance`：波宽判据是它的直接消费面，而 `run/gate` 的 `graph` 腿（T11）与 `run/advance` 的波次前沿（T13）都经依赖边读它，不自己持一份
- `SkeletonAssembler`：构造入参含 `today`（必填无默认值，不传即抛）与注入的文本落盘能力 `textWriter: (target, text) => Written | WriteFailure`（`env/workspace/workspace.ts#writeTextAt`，T3；骨架的目标是仓库根相对的 `RepoPath`，故走仓库基准那一条面）；`compose(type, target)` 对四族穷举、只出字节（旧树 `SkeletonAssembler#render()` 的字节面，**不带尾随换行**）；`assembleAt(type, target)` 一次完成「渲染 → 补且只补一个尾随 `\n` → 经 `textWriter` 落盘 → 回同一份声明过的结果值」——成功是仓库根相对路径，写失败是 `{kind: "write-failure", target}`（不抛；`error: cannot write file: <target>` 那行字节归 `surface/render`，本片零消费者措辞）；本类不碰 `node:fs`，写盘只有 `textWriter` 一条路
- `Documents`（`docs/index.ts`）的构造入参含 `today`（当天；由组合根从 `env.process.clock#dayOf` 取一次传进来——本地日，不是 `isoOf` 的 UTC 切片，本类不自己读时钟）与 `textWriter`，由它在 `docs/index.ts` 构造唯一一份装配器；`Documents.skeletonOf(type)` 出 `compose` 的字节（无尾随换行），`Documents.skeletonAt(type, target | undefined)` 是落盘面——`target` 缺席时**不落盘**、回声明失败值 `{kind: "missing-target"}`（与本任务的 `write-failure`、T4 的 `read-failure` 同一形态；签名收得住「少 target」，argv 的路径字面原样递进来，壳因此不必自己判）。这个值只带得下「哪一类拒绝」，不带填充值：`docs/` 不命名 `run/advance/frame.ts` 的 `UsageReason` 成员、也不 import `run/`（spec §1.2），翻成「缺 skeleton target」那一格的是 T15 的 `FAILURE_REASONS`；`target` 在时落地的字节是 `skeletonOf(type)` 加那一个 `\n`，回值就是 `assembleAt` 的结果值（成功带仓库相对路径、失败带目标）（`schema get --output skeleton` 的壳只调这一个入口，渲染与写盘都不在壳里，也不在组合根里另拼一处）

#### Steps
- 写 lens 问句表的 pin — checkable: 每 kind 的问句非空且无重复标签；`spec-consistency` 行携带指称问句（把它的问句字面抄到别处即红）
- 写完成判据的 pin — checkable: implement 零提交判违约一条、review 空 findings 判 APPROVED 一条
- 写波宽的 pin — checkable: 依赖层四个任务 ⇒ `TaskGraph#batches()` 的那一批宽度超过 `MAX_TASKS_PER_WAVE` 并被点名（本任务交付的是读数，不是注册表行——规则 id 的必报夹具归 T10，注册表行与策略类都在那一波）
- 写图的 pin — checkable: 一份 `DependsOn` 自环的 plan ⇒ `#validate()` 报 `self-loop` 且 `detailLine()` 点名该任务；成环 ⇒ 报 `cycle` 并列出环上的任务；缺 id ⇒ 报 `missing-id`；`#batches()` 的每一批内无依赖边（拓扑性），`#frontier(done)` 随 `done` 变化
- 写波宽单点派生的 pin — checkable: 换一份边集给 `task-graph.ts` ⇒ `wave-width` 判据的输入随之变；`wave-width.ts` 不持有自己的波分解
- 写四族骨架的 pin — checkable: 四类 DocType 各一条；类型集与 `compose` 的 switch 分支集一致（类型集从同一常量派生，测试断言「每个值都有分支」）
- 写骨架落盘的 pin — checkable: `Documents.skeletonAt(type, target)` 落地的字节与 `skeletonOf(type)` 加一个尾随 `\n` 逐字节相等（比字节，不比行数；落地文档以且仅以一个 `\n` 结尾，多一个或少一个都红）；注入一个记数的 `textWriter` ⇒ 落盘调用只有一次、目标与回显的相对路径是同一个；注入一个返回写失败的 `textWriter` ⇒ `skeletonAt` 返回 `write-failure` 而不抛；`Documents.skeletonAt(type, undefined)` 回声明失败值 `{kind: "missing-target"}`（本片不命名 union 成员、不 import `run/`），注入记数的 `textWriter` 零调用（拒在写之前）；`docs/skeleton/**` 与 `docs/index.ts` 里零 `node:fs`（import 面断言；`env/` 仍是唯一 import `node:fs` 的片）
- 写日期注入的 pin — checkable: 同传一个冻结日期两次 ⇒ 字节相同；不传日期时构造即抛（无默认取系统时钟）
- 写骨架字节的格接入 — checkable: 对账器的骨架格用装配器入口在进程内驱动两棵树，同一 `frozenDate`；同一步在 `harness.ts#NEW_TREE` 注册 `render:skeleton` kind（`REGISTRATION_WAVES` 把它记在 T9），注册后这些格从 GAP 派生成已接线并逐字节比
- 重录基线 — checkable: 跑 `node --experimental-strip-types packages/cdd-engine/tests/parity/record.ts` 后，本片 producer 名下的格在录制件里的状态是已接线（不再是 GAP），且它们的期望字节与重录前逐字节相等（重录只推进状态，不改旧树的字节）；跳过这一步 ⇒ 对账器报 `recorded as gap, but its producer has landed — wire the cell`
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/docs tests/parity` 绿（对账器按 T2 的三态口径加 T8 的具名延后那一档：已接线的格零差异、未接线的格计入 GAP、kind 的注册波未到的格计入具名延后，三者都不判红）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
七组 pin 齐（lens 问句表与指称问句 · 完成判据两档 · 波宽可红且只从 `TaskGraph#batches()` 派生 · 图的四类边失败 · 四族骨架全覆盖 · 日期注入两条 · 落盘只经注入的 `textWriter`、字节与 `skeletonOf` 相等、`target` 缺席回 `{kind: "missing-target"}` 且零落盘（`FAILURE_REASONS` 才把它翻成「缺 skeleton target」那一格））；骨架格进对账器并在冻结日期下逐字节比（`render:skeleton` 由本波注册，故这些格不再读作 GAP；内容一臂；落盘事实另由 T16 的壳面格判）；散文里不出现族数或判据条数；`wave-width-at-most-three` 这个规则 id 的成对夹具归 T10，本任务的波宽 pin 只判「批宽超 `MAX_TASKS_PER_WAVE` 即点名」。

#### DependsOn
6

### Task 10: `docs/` 的判据引擎

#### Objective
形状规则的注册表与它指向的策略族、判据协调器、选择器引擎、WARN 观测面，外加两件被判据族直接读的东西：路径文法 `PathShape` 与 proven-closure 的读法 `ClosedDocument`（`skipWhenClosed` 那条让位与 `judge` 的闭包入参都取它，闭包只此一处算）。**登记表跟判据走**：注册表与它的策略类同住 `judging/`——一条规则一个类，表的每行 `create()` 指向族里的一个类，删一行即少一条判据。判据只读文本，读文本的路都经 `grammar` 与 `identity` 的既有读面。

#### Files
- Create: `packages/cdd-engine/src/docs/judging/rules.ts`
- Create: `packages/cdd-engine/src/docs/judging/shape-rules.ts`
- Create: `packages/cdd-engine/src/docs/judging/closure.ts`
- Create: `packages/cdd-engine/src/docs/judging/invariants.ts`
- Create: `packages/cdd-engine/src/docs/judging/judge.ts`
- Create: `packages/cdd-engine/src/docs/judging/lint.ts`
- Create: `packages/cdd-engine/src/docs/judging/selectors.ts`
- Create: `packages/cdd-engine/src/docs/judging/__tests__/judging.test.ts`
- Modify: `packages/cdd-engine/src/docs/index.ts`

#### Consumes
- 旧树的 `contract/rules.ts#RULE_REGISTRY` · `contract/shape-rules.ts#PathShape`（注册表读的路径文法，跟着表走）· `contract/invariants.ts`（判据族的每一个策略类——注册表每行 `create()` 指的类就在这里）· `contract/judge.ts#Contract`（协调器）· `contract/lint.ts`（WARN 观测面）· `contract/selector-engine.ts#SelectorEngine` · `contract/selector-spec.ts` · `contract/closed-document.ts#ClosedDocument`（proven-closure 的读法：`judge` 的闭包入参与 `checked:` 面的让位行同取这一处，不各算一次）

#### Produces
- `RULE_REGISTRY`（形状规则即它的行）与判据族 `Invariant`（一策略类一规则）
- `PathShape`（`docs/judging/shape-rules.ts`）：路径文法一条判据——路径形状的 token 读作路径、模式读作 `null`、一种归一化拼写；判据族里读路径的规则与 `ClosedDocument` 都经它取文法，不各写一份正则
- `ClosedDocument`（`docs/judging/closure.ts`）：proven-closure 的读法——charter 的 Phase-inventory 行按文档索引唯一命中才判闭合，零命中与多命中都不证明闭合；`judge` 的闭包入参、门口的让位行与派发的那一次闭包读都取它
- 判据协调器：`Documents.judge(doc)` 背后装配每 doc-key 的策略集、按序跑、汇总 findings
- `lint`（WARN 观测面，派发门口跑，不进判定）· `SelectorEngine`（含覆盖判据）

#### Steps
- 写规则表与策略族逐行对齐的 pin — checkable: 表的每一行都解析到族里的一个类；把任一类改名 ⇒ 该行解析失败并点名规则 id（族的大小随表走，不在散文里计数）
- 写每条规则成对夹具 — checkable: 每条规则一条违规必报 + 一条邻居沉默（同位置换成一个合规构造 ⇒ 不报）
- 写协调器的 pin — checkable: 装配的每 doc-key 策略集非空；两条规则按序跑时 findings 顺序稳定；一条规则抛错不吞掉其余规则的 findings
- 写选择器覆盖的 pin — checkable: 合成文档上全绿；删一条 selector 即红
- 写 lint 不进判定的 pin — checkable: 强制一条 lint 命中 ⇒ `judge` 的 findings 计数不变
- 写路径文法的 pin — checkable: 路径形状的 token ⇒ `PathShape.pathOf` 非空；模式形状的 token ⇒ `null`；同一路径两种斜杠拼写 ⇒ `normalize` 后相等（判据族与闭包读共用这一份）
- 写闭包读的 pin — checkable: 一份 charter 的 Phase-inventory 行在索引里唯一命中 ⇒ 读作闭合；零命中与多命中 ⇒ 都读作不闭合；闭合文档上一条带 `skipWhenClosed` 的规则被 `judge` 跳过，而邻居规则照跑
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/docs` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
pin 齐（表与族逐行对齐 · 每规则成对夹具（含 `wave-width-at-most-three`）· 协调器装配与容错 · 选择器覆盖 · lint 不进判定 · 路径文法 · 闭包读与它驱动的让位）；`judging/` 里注册表、它的策略族、路径文法与闭包读同住，无「登记表目录」式的二级箱；判据只经 `grammar` / `identity` 的读面取文本。

#### DependsOn
9

### Task 11: `run/` 的门

#### Objective
立起判定层：门行集的闭集（结构腿与站名合起来是同一个行集）、拒绝事实的树级存放与两个到期触发点、接手授权三条 leg 各自的授权条件。**不变量**：拒绝是关于树的事实，不写轮次；任一时刻至多一条。

#### Files
- Create: `packages/cdd-engine/src/run/gate/preflight.ts`
- Create: `packages/cdd-engine/src/run/gate/refusal.ts`
- Create: `packages/cdd-engine/src/run/gate/authority.ts`
- Create: `packages/cdd-engine/src/run/gate/__tests__/gate.test.ts`
- Modify: `packages/cdd-engine/src/run/index.ts`
- Modify: `packages/cdd-engine/tests/parity/grid.ts`（本片各格的名册行）
- Modify: `packages/cdd-engine/tests/parity/baseline/`（重录产物：本片落地的 producer 把它名下的格从 GAP 推进到已接线）
- Modify: `packages/cdd-engine/tests/parity/GRID-WIRING.md`（本片各格的名册行）
- Modify: `packages/cdd-engine/tests/parity/parity.test.ts`（本片各格的比较项）

#### Consumes
- 旧树的 `session/preflight.ts`（`PreFlightGateName` · `DISPATCH_ROWS` · 让位条件）· `session/refusal.ts`（`PreFlightRefusal` · `RefusalState`）· `session/dispatch-authority.ts` · `face/cli.ts#Cli.#recoverRun` 的三 leg 授权面 · `contract/preflight-rows.ts#RowStation`（四个站名——它们是门行集的成员，不是与行集并列的第二组）（读行为）
- T9 落点 `docs/judging/task-graph.ts#TaskGraph`（`#validate()` 与静态 `detailLine()`）：`graph` 腿判的是注入的 plan read 交上来的那个图，门 `new` 不出第二份边规则，只读失败集
- T10 落点 `docs/judging/closure.ts#ClosedDocument`：`checked:` 面的让位行读它——已闭合文档上带 `skipWhenClosed` 的声明读作让位，门只拼那一行

#### Produces
- `PreFlight#vet(context)` → 逐行读数与整段裁决；行集从 `PreFlightGateName` 的闭集派生：结构腿（`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract`）与 `RowStation` 的四个站名（`no-host` · `carrier` · `dispatch-input` · `artifact`）是同一个行集的两部分——站名是行集的成员，不是与之并列的另一组；某个面命中多少行是该面的函数（plan · wave · branch 三个面各不相同），不写常数；让位条件按既有两处（那一行的读值取 T10 的 `docs/judging/closure.ts#ClosedDocument`，门只拼行、不另算闭包）；`graph` 腿唯一的判定来源是 T9 的 `TaskGraph#validate()`（失败集逐条经 `detailLine()` 拼成 detail），门里不重算边
- `RefusalState`：树上至多一条拒绝事实、两个到期触发点（结构腿不拒绝时的门口清理 · `InFlight#release`）；拒绝事实盖的 `at` 时间戳经注入的 `Clock`（T5 落点 `env/process/clock.ts`）取——本片零 `Date.now()`、零无参 `new Date()`
- `authority`：三条 leg 各自的授权条件（leg ① = in-flight 门放过 ∧ 记录 stale；legs ②③ = 结构腿通过）

#### Steps
- 写行集的 pin — checkable: 行集从 `PreFlightGateName` 单一派生；插入一条新行即改读面（不写字面行数）；`RowStation` 的每个站名都在行集里（包含关系，不是两集相等），理由集 `PreFlightReason` 的每行可读
- 写 `graph` 行的 pin — checkable: 一份 `DependsOn` 自环的 plan ⇒ `graph` 行拒绝且 `reason: graph`，`details` 列出该边；把注入的 `TaskGraph` 换成一个恒空的假实现 ⇒ 该用例红（否则这条腿是空真）
- 写「拒绝不写轮次」的 pin — checkable: 任一行拒绝后账本轮次数不变、树上多一条拒绝事实
- 写拒绝事实时间戳的 pin — checkable: 注入固定时钟 ⇒ 落地的 `at` 就是那个时刻；`run/gate/**` 的非测试文件里零 `Date.now()` · 零无参 `new Date()`（T5 的那条全树时钟 pin 在这一片上逐文件可核）
- 写至多一条的 pin — checkable: 连续两次拒绝 ⇒ 树上仍只有一条（后者不覆盖前者或按旧行为拒绝，pin 钉住那一种）
- 写两个到期触发点的 pin — checkable: 九行全过 ⇒ 事实被清；`InFlight#release` ⇒ 事实被清；其它路径不清
- 写三 leg 授权的 pin — checkable: 活 holder + `--recover` ⇒ leg ① 不成立（flag 不越过活着）；stale 记录 + doc-contract 拒绝 ⇒ leg ① 仍成立（记录关于树）；legs ②③ 在结构腿拒绝时不成立
- 写让位条件的 pin — checkable: 无输入面的 wave 派发 ⇒ 四行一起让位；在四行之前被拒 ⇒ 四行不记
- 写门面格的接入 — checkable: 名册挂给本片的两格（`f8.blocked.station` · `f8.blocked.yielding`）在本片 producer 落地后派生成已接线（`seam` 的注册波是 T16，本片不注册 driver——这两格在本波之前是 GAP，本波起读作**具名延后**并点名 T16，既不是缺格也不是差异）；把本片 producer 的导出名改掉而名册不改 ⇒ 该格派生成 GAP，录制件仍写着已接线所以对账器报缺格，于是逐波判据红；`pnpm -C packages/cdd-engine exec vitest run src/run tests/parity` 绿
- 重录基线 — checkable: 跑 `node --experimental-strip-types packages/cdd-engine/tests/parity/record.ts` 后，本片 producer 落地的那些格在录制件里的状态是已接线（不再是 GAP），且它们的期望字节与重录前逐字节相等（重录只推进状态，不改旧树的字节）；跳过这一步 ⇒ 对账器报 `recorded as gap, but its producer has landed — wire the cell`
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/run` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
六组 pin 齐（行集派生与 `graph` 腿只读 T9 的失败集 · 拒绝不写轮次 · 至多一条 · 两个到期点 · 三 leg 授权 · 两处让位）；`run/gate` 在 `run/` 内的边只向下依赖 `run/ledger`（跨片读 `docs/` 的判据是它存在的理由，不是第二层）；拒绝事实的路径取 T7 的产物矩阵（`run/ledger/artifacts.ts#ArtifactIdentity` 的名字与拼写，依赖边 7）——`env.workspace` 只按注入的拼写落地，不持矩阵；名册挂给本片的格在本波派生成已接线（`seam` 的注册波是 T16，本片不注册 driver），两格因此读作具名延后并点名 T16，不是缺格也不是差异；对账器里那些既已接线又不在延后档的格零差异。

#### DependsOn
7, 10

### Task 12: `run/` 的派发

#### Objective
立起孩子这一层：派发输入契约、预帧值装配、手交契约与读回（含结论派生三路）、活性判官、预算与终止、in-flight 记录（含锁的持有）。**不变量**：孩子存在之前零记录，孩子收工后无残留。

#### Files
- Create: `packages/cdd-engine/src/run/dispatch/child.ts`
- Create: `packages/cdd-engine/src/run/dispatch/values.ts`
- Create: `packages/cdd-engine/src/run/dispatch/liveness.ts`
- Create: `packages/cdd-engine/src/run/dispatch/handoff.ts`
- Create: `packages/cdd-engine/src/run/dispatch/inflight.ts`
- Create: `packages/cdd-engine/src/run/dispatch/__tests__/dispatch.test.ts`
- Create: `packages/cdd-engine/src/run/dispatch/__tests__/handoff-plane.guard.test.ts`
- Modify: `packages/cdd-engine/src/run/index.ts`

#### Consumes
- 旧树的 `face/lifecycle.ts`（预算 · stall 判官 · 终止面的三档结论）· `face/dispatch-values.ts`（预帧值装配：身份 · 场景 · 快照三格）· `contract/liveness-signal.ts`（两条活性腿与四态判官）· `session/inflight.ts`（记录与四态判定；锁的持有者是 T5 交付的 `env/process/lock.ts`，in-flight 只经它取锁）· `session/handoff-schema.ts`（含结论派生三路）· `session/carrier-integrity.ts` · `contract/preflight-rows.ts` · `contract/context-declarations.ts`（读行为）· T10 落点 `docs/judging/closure.ts#ClosedDocument`（旧树 `face/lifecycle.ts` 的那一次闭包读：一次派发只构造一份，门口让位行与它共用）；spawn 与杀本身不在这里——由 `env/process/child-runner.ts`（T5）提供

#### Produces
- `child`：`Child.dispatch(frame)` → `DispatchOutcome`（退出码 · 日志路径 · 终止因）· 预算四键——起进程经注入的 `ChildRunner`，本任务不持信号
- `values`：`DispatchValues`（身份 · 场景 · 快照三格扁平事实 → 扁平记录）——预帧的一道装配，相对化只发生一处，四个行与渲染面读同一份；身份格里的 brief 仓库相对路径有两种填法、同一份拼写：派发路径由派发面（T13 的 `Lifecycle`）在落地那一刻交回，预览路径由注入的 brief 面的 `briefOf(request)` 回的名字取（T7 产物矩阵的 `brief` 行是那条拼写的单源，零渲染、零落盘）；本模块不拼、不落盘、不渲染
- `liveness`：活性判官（轮日志增长与进程组 CPU 两条腿，四态；每轮一个实例，不可读期保留上一次读数而不是清零）
- `handoff`：手交契约（键集）与读回（失败分型：缺失 / 畸形 / 违约）· 结论派生三路——findings 里有 blocker ⇒ `CHANGES_REQUESTED`，只有 warn ⇒ `REVIEW_FIX`，findings 为空 ⇒ `APPROVED`
- `inflight`：`InFlight#acquire` / `#inspect` / `#release`；`InFlightState` 三种 kind（absent · held · corrupt）；记录里的起跑时刻先取进程表、答不出时回落注入的 `Clock`（T5 落点 `env/process/clock.ts`，旧树 `face/lifecycle.ts#recordOf` 的 `Date.now()` 那一处按注入时钟改写）——本片零 `Date.now()`、零无参 `new Date()`
- `__tests__/handoff-plane.guard.test.ts`：手交面守卫（`precommit` 今天指向旧树的同名文件，翻面时随 T18 改指这一处）

#### Steps
- 写「孩子前零记录、收工后无残留」的 pin — checkable: 注入一个立即失败的 spawn ⇒ 无 in-flight 残留；正常收工 ⇒ 记录建立后被释放
- 写 in-flight 三 kind 的 pin — checkable: 空闲 · 持有 · 记录损坏三态各一条；损坏按无锁放行但报文点名
- 写 in-flight 时间戳的 pin — checkable: 进程表答不出时起跑时刻来自注入的固定时钟（不是墙上时钟）；`run/dispatch/**` 的非测试文件里零 `Date.now()` · 零无参 `new Date()`
- 写手交读回分型的 pin — checkable: 缺席 · 畸形 · 违约三型各一条，且三者各给不同的终止因
- 写结论派生三路的 pin — checkable: 一条 blocker 的 review 草稿 ⇒ `CHANGES_REQUESTED` · 只有 warn ⇒ `REVIEW_FIX` · findings 为空 ⇒ `APPROVED`；三者印入胶囊 `status:` 的那一行与旧树同字节
- 写活性判官的 pin — checkable: 只有日志增长 ⇒ 判在飞；两条腿都停 ⇒ `stalled`；不可读的腿保留上一次读数而不清零（注入假读数）
- 写预帧值的 pin — checkable: 同一份扁平事实两次装配字节相同；快照的相对化只发生一次
- 写预算与终止的 pin — checkable: 超预算 ⇒ `over-budget`；无活动 ⇒ `stalled`；收到信号 ⇒ `signal`（三档取自 `TerminationCause`）
- 写「拒绝不消费 attempt」的 pin — checkable: 派发前拒绝 ⇒ 账本轮次数与 attempt 都不前进
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/run` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
pin 齐（记录生命周期 · 三 kind · 手交三型 · 结论派生三路 · 三档终止 · 拒绝不消费 attempt）；`dispatch` 对 `advance` 零 import；锁经 `env.process.lock`。

#### DependsOn
11

### Task 13: 改道 `run/` 的前沿

#### Objective
立起推进层：场景装配（argv 侧输入 → 一帧）、管线前沿、波次前沿、波门五行、行相位事实、目标类型表、单轮生命周期、闭合判定、`next:` 与 `reason:` 的六格装配。**不变量**：前沿是账本的投影，不是第二份判断；单轮生命周期只是一次派发的一步，目标类型的差异住在表里，不撒在分支里。

#### Files
- Create: `packages/cdd-engine/src/run/advance/frame.ts`
- Create: `packages/cdd-engine/src/run/advance/pipeline.ts`
- Create: `packages/cdd-engine/src/run/advance/wave.ts`
- Create: `packages/cdd-engine/src/run/advance/line-phase.ts`
- Create: `packages/cdd-engine/src/run/advance/target-faces.ts`
- Create: `packages/cdd-engine/src/run/advance/lifecycle.ts`
- Create: `packages/cdd-engine/src/run/advance/next.ts`
- Create: `packages/cdd-engine/src/run/advance/__tests__/advance.test.ts`
- Modify: `packages/cdd-engine/src/run/index.ts`

#### Consumes
- 旧树的 `session/pipeline.ts` · `session/wave.ts#WaveGate`（`vet(requested, verb)` 的五行与它们的行序）· `session/next.ts#Route` · `session/run.ts`（单轮生命周期：前沿 → 派发 → 结果 → 记账 → 改道）· `session/faces.ts`（目标类型表：审计目标 · 产物面 · next 消费语义）· `face/gate.ts`（行相位事实与行身份事实；它里面的两处拒绝措辞不搬到这里——措辞归 `surface/render`）（读行为：六格装配、drift 重开、波次 frontier、波门五行连同行序、闭合判定）
- T9 落点 `docs/judging/task-graph.ts#TaskGraph`（`#batches()` 与 `#frontier(done)`）：波次前沿是它的读，`advance` 不持第二份波分解——旧树的 `session/graph.ts` 因此不在本任务的移植清单里
- 旧树的 `face/cli.ts#Cli.#sceneOf` 与 `#runWork` 的外围（场景装配：argv 侧输入 → 一帧——slug 判定 · 计划读 · 身份文档声明的 `doc-type:` / `program:` · 同名 spec 与 charter 链 · 目标 · 管线前沿四格 · `RunState` 与 router）：它读 `docs/` 与 `env/` 两个面，在新树由本任务的 `Frame` 认领，经构造注入的 `Documents` 与 `Env` 取值——`run/` 里不自己拼路径、不自己读 markdown

#### Produces
- `frame`：`Frame#of(request)`——argv 侧输入（命令字 · 旗标 · 路径字面）装配成一帧：slug 判定（经 `env.paths` 的 `SlugIndex`）· 计划读（经 `Documents`）· 身份文档声明的 `doc-type:` / `program:` · 同名 spec 与 charter 链 · 目标 · 管线前沿四格 · `RunState` 与 router；路径只经 `env.paths` 拼、markdown 只经 `Documents` 读——本段零 `node:fs`、零 yaml 解析、零 slug 猜测；**失败是一个声明过的值**（计划读不到 ⇒ `{kind: "read-failure", target}`、缺必填旗标 ⇒ `{kind: "usage", reason}`，后者走得到的只有 `missing required --tasks` 这一形——取值域拒绝在解析层由 commander 拒、不占成员；两个面各从 T4 的读失败与 T16 的声明面取），本段不抛、不拼措辞；`usage` 的 `reason` 是本文件声明的 closed union（`UsageReason`）——**成员由本文件认领**（成员集写在 `run/advance/frame.ts`；字节的取用面只有 `surface/render/usage.ts` 的字节表一处；T16 的声明面**不取用成员、也不供填充值**（解析层与条件必填层的报文由 commander 与 group 钩子在解析期产出，不经这个 union；body 层成员的填充值由产出它的那一处从 argv 侧输入里取——**取该项的键与值**（旗标拼写取键、命令路径取命令字本身、位置参数名取该次调用的形参），不另抄一份声明），两边都不反向派生：`run/` 不 import `surface` 的运行时，且本任务先于 T16 落地），成员按事实种类分：缺 `--tasks` 那一族 · 缺 skeleton target · 多余 target · `--plan` / `--spec` 的组合缺 · 计划里无该任务 · 纯命令的 `--dry-run` 作用域拒绝 · 读失败 · 写失败 · 基冲突 · 板面的「未命中」（填充值 = 未命中项的有序列表，每项是旗标拼写 + 目标路径，成行时按 ` and ` 连接——两个旗标同时不命中就是两项）· 板面的「读不出」（填充值 = 该项的旗标拼写 + 目标路径）· `base get` 的「产物缺失或损坏」（填充值 = 仓库相对路径）· work 命令的「无可派发帧」（填充值 = 命令字）各占一成员，每个成员自带填充值而不是一整句——**名字类填充**（命令路径 · 旗标拼写 · 位置参数名）取自 argv 侧输入而不是另一份声明；**带载荷的两个成员各带自己声明值里的字段**（不是 argv 侧名字）：基冲突带既有基（T3 的 `BaseArtifact#set` 回的那个 `conflict` 值里的既有基）、`base get` 的「产物缺失或损坏」带 `BaseArtifact#read` 的 `target`，**也各带自己的流、文本与退出码**——按形状归族（判据是形状，不是「缺」）：usage 首行 + `error: <message>` + exit 2 那一族含缺旗标一族 · 缺 skeleton target · 多余 target · 组合缺 · 计划里无该任务 · 作用域拒绝 · 读失败 · 写失败 · 基冲突；板面两条与 `base get` 那条是单行、无 usage 首行、无 `error:` 前缀、exit 2；`无可派发帧` 是单行、无 usage 首行、exit 1——`surface/render/usage.ts`（T15）经 `import type` 读这个 union 并逐成员映射成字节与退出码，`run/` 不 import `surface` 的运行时，那族字节因此只有一个拼装点——`error: cannot read file: <rel>` 与 `error: cdd <verb>: task <id> not found in the plan` 这类字节由 `surface/render` 按这个值印出；**转译点在哪——每个成员都点到一个生产者**（成员与生产者的对应名单，T15 的字节表逐行带着它）：(i) `run/advance/frame.ts#Frame#of`——缺 `--tasks` 那一族（走得到的只有 `missing required --tasks` 这一形；`--tasks` 的取值域拒绝在解析层由 commander 拒，不占这个成员）· 计划里无该任务（`--tasks` 的某个 id 不在计划读出的任务块 id 集里）；(ii) `run/index.ts#Run#boardOf`——`--plan` / `--spec` 的组合缺 · 板面「未命中」· 板面「读不出」；(iii) `run/index.ts#Run#advance`——「无可派发帧」（账本无开放帧，填充值 = 命令字）；(iv) `docs/index.ts#Documents#skeletonAt`——回 `{kind: "missing-target"}` 的声明失败值（`target` 缺席即回它，签名收得住「少 target」），由 (vii) 的 `FAILURE_REASONS` 翻成「缺 skeleton target」那一格；(v) `docs/index.ts#Documents#projectOf`——回 `{kind: "extra-target", target}` 的声明失败值（json 面不收 target，收到路径字面即回它），同一张表翻成「多余 target」那一格；**这两个入口不命名成员、也不 import `run/`**（`docs/` 不知道轮次与 `next:`，反向边还会与 `run/` 读 `docs/` 成环）；(vi) `surface/commands/projection.ts#ScopeGuard#rejectionOf`——纯命令的 `--dry-run` 作用域拒绝：行就是 `declare.ts` 的 `SCOPE_ROWS`（哪些纯命令声明了 `--dry-run` 就是哪些行），本处只把那一行翻成声明值，字节仍只有 `surface/render/usage.ts` 一个载体；(vii) `surface/render/usage.ts` 的转译表——`env` / `docs` / `frame` 交上来的声明失败值（T3 的读 / 写失败与基冲突 · `BaseArtifact#read` 的 `absent` / `corrupt` · T4 的 `read-failure` · T9 的 `write-failure` · 本段的 `read-failure`）在这里翻成「读失败」/「写失败」/「基冲突」/`base get` 那一条/「缺 skeleton target」/「多余 target」（`docs/` 交上来的 `missing-target` 与 `extra-target` 两个值归这张表翻，故那个 closed union 的成员家仍只在 `run/advance/frame.ts`）；壳从这几处都只看得到成品成员或未翻的声明值，自己零判定；任一成员没有落点时，T15 那条生产者 pin 就红。**解析层与条件必填层的报文集不在这里**：required 旗标 / required 位置参数 / 未知旗标 / 多余位置参数由 commander 在解析期拒，条件必填由 `REQUIRED_GROUPS` 钩子拒，两层都走不到 body，因此不占成员、也不由 `surface/render` 拼字节
- `advance`：`frontierOf(slug)` · `nextOf(frontier)` → 六格 `NextHop` · `reasonOf(hop)` · 波次 frontier（读 T9 `TaskGraph#batches()` 与 `#frontier(done)`，不另建）
- `wave`：`WaveGate#vet(requested, verb)`——判定成五行、**行序即判据**（命中靠前的行就报那一行的成因，不落到靠后的行）：`mixed-batch`（请求命中一个跨已闭合与未闭合任务的静态批——批是一个整体，计划修订不得把半执行批的剩余成员放成自己那一波）· `wave-too-wide`（派生波宽超 `MAX_TASKS_PER_WAVE`，判在精确读之前，故宽 frontier 永不被误报成 `split`）· `too-many-tasks`（请求集本身超上限，不截断、不默默对半）· `split`（请求集不等于派生波，报错时带波板提示）· `wrong-phase`（该波的相位 ≠ 本次动词）；成因 token 只取 `DISPATCH_REASON` 的 line 腿（经由 `WAVE_GATE_REASON` 的类型视），本片不另立拼写；那张表与它的两个视图都住在 `run/advance/next.ts`——`DISPATCH_REASON`（structure · line · station 三腿的 `{token, leg}` 表：structure 腿复用门行 id、line 腿是波门五行与 doc / branch 拒绝、station 腿是 hop 的 `reason:` 词）· `WAVE_GATE_REASON`（line 腿的波门五个值）· hop 的 `reason:` 视图 · `REVIEW_CYCLE_CAP`（评审软上限：hop 的 `soft-cap` 那一格的连续 blocker 计数门槛，与 `soft-cap` 行同住一处，软上限值在 `src/**` 里只有这一份字面）与它的两处可核面——`DISPATCH_REASON` 的 `softCap` station 行、评审闭合的 `done` 决策词：旧树那两个私有成员（连续 blocker 计数与闭合那一支）按 spec §4 重新推导后不以旧私有拼写存在，树外消费者 `scripts/__tests__/next-loop-twin.test.ts` 的源码文本臂因此改指这三处（见 T18 的改指清单与那一步的处置），`wave.ts` 与它之外的一片都不持第二份拼写；裁决带回派生波与各任务相位两件读值
- `line-phase`：行相位与行身份事实（从 `run/gate` 的授权面派生），**零措辞**——拒绝措辞由 `surface/render/route.ts` 按 hop 拼出，`run/advance` 不 import `surface`
- `target-faces`：每个目标类型一行（审计目标 · 产物面 · next 消费语义）——新类型是表行，不是生命周期的分支
- `lifecycle`：`Lifecycle#advance(frame)`——一次派发一步（前沿 → 派发 → 结果 → 记账 → 改道），帧由 `frame` 段装配，目标类型差异只经 `target-faces` 的表行；**派发前被拒也是一步**——`PreFlight#vet` 拒绝时这一步只产出一个拒绝变体（`blocked` 或 `held`，带裁决与那一次 pre-flight 的 `checked` 行集），孩子零起、账本轮次与 attempt 都不前进，它不抛、不拼措辞；**wave 的 brief 在派发前落地，且只落一回**：`Lifecycle` 收注入的 brief 面（`briefOf(request)` → 名字与字节，`surface/render/brief.ts` 的实现由组合根注入，`run/` 不 import `surface`）与注入的文本写面（`env.workspace#writeText`，T3），把字节落到派发所属的那个工作区、把回传的仓库相对路径交给 `DispatchValues` 的身份格（`INPUT_WAVE_BRIEF` 取的就是它）；**brief 的写失败与骨架同形**：注入的写面回一个声明过的失败值（`{kind: "write-failure", target}`）时 `Lifecycle#advance` 不派发——孩子零起、账本轮次与 attempt 都不前进，它把那个值原样交回，字节（`error: cannot write file: <target>`）与退出码由 `surface/render/usage.ts` 那一处印出，不在 `run/` 里另拼一句（`INPUT_WAVE_BRIEF` 因此永不会拿到一个没有落地的路径）；`--dry-run` 不上这条路——不渲染 brief、不落盘、不取锁、不起孩子，它只走 `previewOf`
- `Run` 门面收口：成员集是 `advance(request)` / `previewOf(request)` / `boardOf(request)` / `inflightOf()` / `refusalOf()` / `recordRound(...)`——前三条收 argv 侧输入（命令字 · 旗标 · 路径字面），场景装配在 `Run` 内一次完成；壳不拼 slug、不读计划、不拼路径；**工作入口的回值都是声明过的闭集**：`advance(request)` → `{kind: "dispatch", result, capsule, checked}` | `{kind: "blocked", verdict, checked}` | `{kind: "held", state, checked}` | `{kind: "usage", reason}` | `{kind: "read-failure", target}` | `{kind: "write-failure", target}`（`blocked` 与 `held` 是**派发前被拒**的两个变体：结构腿与波门在派发之前拒时回 `blocked`（带裁决与 detail 段）、in-flight 门持有那棵树时回 `held`（带 in-flight 状态值），两者都带那一次只读 pre-flight 的 `checked` 行集，**`dispatch` 也带同一份**——未被拒的派发没有裁决，`checked` 是同一份东西（同一次只读 pre-flight 派生，三态同源），壳因此不必为 approved 路径另取一份；`write-failure` 是 `Lifecycle#advance` 在 brief 落盘失败时原样交回的那个声明值（`target` 即写失败的目标路径），与 `read-failure` 同形、`run/` 内不改形，字节与退出码仍由 `surface/render/usage.ts` 那一处印出，`kind` 词与 `previewOf` 的同名两值逐字相同——被拒的树在两个入口上同名，而 `previewOf` 回 `pass` 的树在 `advance` 上回 `dispatch`；「无可派发帧」由它翻出、填充值 = 命令字；`usage` 与 `read-failure` 是 frame 装配的失败值原样上抛，壳不判）· `boardOf(request)` → `{kind: "board", rows, facts, observed}` | `{kind: "usage", reason}`（板面事实值三格逐值声明：`rows` 是板上各路行（`in-flight:` 行 · `next:` 的取用 · 文档行与波行的格）· `facts` 是树上事实块的两族（`orphan:` 名单取 `Ledger#orphanHandoffs()`、`crashed:` 格取 `Ledger#crashedOf`，记录序由 `Ledger#nodeRecordsOf(progress)` 摊平）· `observed` 是 `Ledger#observedArtifacts()` 排好序的观测集；三格全由 T7 的读面装配，`surface/render/board.ts` 只连接、不读账本；`--plan` / `--spec` 的组合缺、板面「未命中」与「读不出」由它翻出——「未命中」的填充值是未命中项的有序列表，其余两者的填充值是旗标拼写 + 目标路径）；`advance` 与 `boardOf` 都不回 `null`、不回布尔，壳按 `kind` 一次值分派（闭集穷举：成功面喂 `board` / 胶囊渲染器；拒绝面按路径分开——真派发路径喂 `route` 渲染器（拒绝行 + `checked:` 段，`split` 那一条再经 `graph`），`--dry-run` 路径喂 T15 的 `Preview` 对应入口；装配层的失败把值原样交 `Cli#report`），判定不在壳里；**`previewOf` 是 `--dry-run` 的唯一生产者**：它先在内部跑一次只读的 pre-flight（与真派发同一个 seam：零写、零取锁、零 spawn），再把结果装成一个带 `kind` 的声明值交出去——`pass`（一次性派发将要用的那一帧 · 宿主事实 · 预帧值 · 那一次只读 pre-flight 的 `checked` 行集）——预帧值的身份格里 brief 那一格由 `briefOf(request)` 的名字填（零渲染零落盘，dry-run 不走派发面落地那一路），与真派发交回的那一条是同一条拼写 · `held`（in-flight 门持有的那个状态值 · 同一个 `checked` 行集）· `blocked`（结构腿的裁决 + detail 段 · 同一个 `checked` 行集）· `refused`（line 腿的裁决 + detail 段 + 同一个 `checked` 行集——波门是纯函数，dry-run 照跑它的 `vet`，于是 `split` / `wave-too-wide` / `mixed-batch` / `wrong-phase` 的拒绝在 dry-run 上也有载体；与结构腿的 `blocked` 分开是因为两张脸的流不同）· `usage`（`Frame#of` 的错用：空树上计划读不出的邻格、缺 `--tasks`、计划里无该任务，与 `advance` 的同名变体同形）· `read-failure`（计划读不到，与 `advance` 的同名变体同形）——各脸的行集同源（同一次 pre-flight 派生），所以 dry-run 与真派发对同一棵树不会给出两个结论；壳按 `kind` 喂 T15 的 `Preview` 的三个入口（`pass` / `held` / `blocked`）· `route` 渲染器（`refused`——与真派发的拒绝同一份字节）· `UsageFace#report`（`usage` / `read-failure`），并把退出码原样带出（`pass` ⇒ 0 · `held` / `blocked` / `refused` ⇒ 1 · `usage` / `read-failure` ⇒ 2），持有、阻断与拒绝的判定都不在壳里；**dry-run 只跑三件纯读**——`Frame#of` 装配 · `PreFlight#vet` · `WaveGate#vet`；派发 / 记账 / 取锁 / 写盘零调用，抑制住在这里，壳才不需要自己判；**派发前被拒的那条链三段各有点名**：产出在 `run/advance/lifecycle.ts#Lifecycle#advance`（`run/gate/preflight.ts#PreFlight#vet` 拒绝时不派发、把裁决与 `checked` 行集原值交回，回值的 `kind` 由这一处定，壳因此不需要自己取裁决）· 渲染在 `surface/render/route.ts`（拒绝行 + `checked:` 段；裁决与行集由壳从回值里取出后交过去，`run/` 不 import `surface`）、`surface/render/graph.ts`（`split` 那一条的 `graph:` 标题 · `wave board:` 段 · `progress:` 尾行）与 `surface/render/preview.ts`（同一份 `checked` 行集）· 分派在 `surface/index.ts#Cli#report`（按 `kind` 一次值分派：真派发路径的拒绝走诊断流 stderr、exit 1；`--dry-run` 按腿分流——结构腿（含 in-flight 持有）的 `held` / `blocked` 走 stdout、exit 1，line 腿的 `refused` 与装配层的 `usage` / `read-failure` 走 stderr（`refused` exit 1，装配层两值 exit 2），`pass` 走 stdout、exit 0）

#### Steps
- 写场景装配的 pin — checkable: 同一 argv 侧输入两次装配字节相同；装配只经注入的 `Documents` 与 `Env`（`run/advance/**` 的非测试文件里零 `node:fs` · 零路径拼接字面 · 零 slug 猜测）；`--plan` 的两种等价拼法（相对与带 `./` 前缀）装配出同一 slug；`Run.advance` 与 `Run.boardOf` 收的是 argv 侧输入，不是已装配的 slug
- 写前沿是投影的 pin — checkable: 同一账本两次取前沿结果相同；改一条账本事实即改前沿（没有第二份缓存）
- 写失败变体的 pin — checkable: `Run.boardOf` 的四条失败臂与 `Run.advance` 的两条——无 `--plan` 也无 `--spec` ⇒ `kind: "usage"` 且 `reason` 是「组合缺」那一个成员、无匹配文档 ⇒ 板面「未命中」（填一个未命中项；`--plan` 与 `--spec` 都不命中时填两项，成行时两项按 ` and ` 连接）、文档读不出 ⇒「读不出」（填 `--plan` 与该目标路径）、账本无开放帧 ⇒「无可派发帧」（填命令字），外加「计划读不到时 `advance` 把 `{kind: "read-failure", target}` 原样上抛」与「`--tasks` 里有一个不在计划里的 id 时 `advance` 经 `Frame#of` 回「计划里无该任务」那一个成员」两条；六条都断言回值是声明值而不是 `null` / 布尔，且注入一个读不出任何文档的读面时成员仍由 `run/` 翻出（壳里零判定）；另加一句——派发前被拒 ⇒ `advance` 回值的 `kind` 与 `previewOf` 对同一棵树相同（两个入口的 `held` / `blocked` 逐字同名），且两个变体带的 `checked` 行集与 `previewOf` 那一份逐行相等；**approved 派发与 blocked 派发带同一份 `checked` 行集，两处印出的字节相等**（未拒的那一支也没有第二份行集可取）；再一条——注入一个回写失败的 `#writeText` ⇒ `advance` 交回 `{kind: "write-failure", target}`，`kind` 在那个闭集里、`target` 就是注入面回的目标路径（折成 `usage` 即丢 `target`，抛出即把旧树的字节换成栈）
- 写「计划里无该任务」的生产者 pin — checkable: `--tasks` 含一个不在计划任务块 id 集里的 id ⇒ `Frame#of` 回 `{kind: "usage", reason}` 且那个成员是「计划里无该任务」（填充值 = 该 id 与命令字，从 argv 侧输入取）；换一份含该 id 的计划 ⇒ 不再回这个成员（判定读的是计划，不是字面名单）
- 写目标类型表驱动的 pin — checkable: 新增一行表即改派发，不动生命周期代码（测试以两行表驱动同一个 `Lifecycle`）
- 写单轮一步的 pin — checkable: 一次 `advance` 只消费一个 attempt 且前沿推进一格（连调两次 ⇒ 两格）
- 写六格装配的 pin — checkable: 六格逐格一条；`next:` 字节与 `reason:` 行按格派生；`soft-cap` 那一格的连续 blocker 计数门槛取自 `next.ts` 的 `REVIEW_CYCLE_CAP`（改这个常量 ⇒ 该格门槛随之变，不另存一份字面；树外消费者读的也是这一处）
- 写 drift 重开的 pin — checkable: 审过的文档被轮外改动 ⇒ 该行不再算闭合；闭合后前沿前进
- 写波门五行的成对 pin — checkable: 每个成因一条必报与一条邻居不报（`mixed-batch`：跨已闭合与未闭合的静态批 ⇒ 报；整批均未闭合 ⇒ 不报。`wave-too-wide`：宽 frontier 而只请求其子集 ⇒ 报 `wave-too-wide` 而非 `split`（这一条判的是行序）。`too-many-tasks`：请求集超上限而派生波不宽 ⇒ 报；派生波不宽 ⇒ 不报。`split`：请求集是派生波的真子集而派生波不宽 ⇒ 报；请求集等于派生波 ⇒ 不报。`wrong-phase`：请求集等于派生波而相位不匹配 ⇒ 报；相位匹配 ⇒ 不报）
- 写波门 token 单源的 pin — checkable: 五个成因的 token 逐值取自 `run/advance/next.ts` 的 `DISPATCH_REASON` line 腿（经 `WAVE_GATE_REASON` 的类型视，断言从表的键集派生，不手写拼写）；`DISPATCH_REASON` · `WAVE_GATE_REASON` 与 hop 的 `reason:` 视图只在 `next.ts` 拼写（`wave.ts` 里写一个成因字面即红）
- 写闭合终态的 pin — checkable: 零 blocker 的 fix 轮之后该行不再被判回 review；review 空 findings 判 APPROVED
- 写 dry-run 抑制的 pin — checkable: 逐 `kind` 各一条——`pass`（回值带帧 · 宿主事实 · 预帧值，且预帧值里 brief 那一格与真派发交回的路径逐字节相同）· `held`（回值带 in-flight 状态值）· `blocked`（回值带结构腿裁决与 detail 段）；各条都是 `Run.previewOf(request)` 加随后的一次 `Preview` 渲染全程零写、零取锁、零 spawn（注入记数的写面、锁与 `ChildRunner` 替身，计数全零）；`previewOf` 的裁决与 `advance` 对同一棵树给出的结论相同（同一份 in-flight 记录与同一份结构腿输入两次读：**派发前被拒时两个入口的 `kind` 逐字相同**——持有 ⇒ 两侧 `held`、结构腿拒绝 ⇒ 两侧 `blocked`，且两个变体带同一份 `checked` 行集；未拒时 `previewOf` 的 `pass` 对应 `advance` 的 `dispatch`），`pass` 的帧与 `advance` 将要派发的那一帧同源（帧字节相同）；`refused`（line 腿拒绝）与 `blocked`（结构腿拒绝）在同一条 split 树上各取一次，两者的 `checked` 行集与真派发那一份逐行相等；`usage` / `read-failure` 两个装配层变体各一条，成员的 `kind` 与 `advance` 上的同名变体逐字相同；**dry-run 只跑三件纯读**——`Frame#of` 装配 · `PreFlight#vet` · `WaveGate#vet`；派发 / 记账 / 取锁 / 写盘零调用
- 写 brief 落地与写失败的 pin — checkable: 一次 wave 派发的 brief 就在 `INPUT_WAVE_BRIEF` 印出的那个路径上（工作区相对名取自 T7 产物矩阵的 `brief` 行），字节与注入的 brief 渲染器产物逐字节相等；`--dry-run` 下该路径不存在（零写的那条臂与上一条同源）；注入一个回写失败的 `#writeText` ⇒ 孩子零起、账本轮次与 attempt 都不前进、`Lifecycle#advance` 交回 `{kind: "write-failure", target}`，字节与退出码取 `surface/render/usage.ts` 那一行（`run/` 里零拼装）
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/run` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
五组 pin 齐（投影无缓存 · 六格 · drift 重开 · 波门五行的成对臂含行序 · 闭合终态）· 目标类型表驱动 · 单轮一步 · 场景装配各一条 · 失败变体一条（`advance` 与 `boardOf` 的回值闭集与它翻出的成员，含组合缺、未命中的列表形与「计划里无该任务」，外加 `advance` 的 `blocked` / `held` 两个派发前变体——`kind` 与 `previewOf` 同名、带同一份 `checked` 行集）· dry-run 抑制的逐 `kind` 各一张脸（`pass` / `held` / `blocked` / `refused` / `usage` / `read-failure`）与 brief 落地及写失败各一条；`run/index.ts` 的成员集 pin 绿（含 `previewOf` 的按 `kind` 逐值回值与 `advance` 的回值闭集：`dispatch` / `blocked` / `held` / `usage` / `read-failure` / `write-failure`）；`advance` 不 import `surface`；波门成因 token 只从 `DISPATCH_REASON` 的 line 腿派生，那张表与它的两个视图同住 `run/advance/next.ts`，`REVIEW_CYCLE_CAP` 与 hop 的 `soft-cap` 行同住同一文件（树外消费者只读这一处）；场景装配只经注入的 `Documents` 与 `Env`，`run/` 里零路径拼接、零 markdown 解析。

#### DependsOn
11, 12

### Task 14: `surface/` 的词表

#### Objective
立起唯一词表：阻断措辞、拒绝站名、在飞四态的词行、capsule 槽、板面 token。**一条事实一张词表，一处渲染**——词表是数据的家，渲染器只连接它。

#### Files
- Create: `packages/cdd-engine/src/surface/index.ts`
- Create: `packages/cdd-engine/src/surface/words/words.ts`
- Create: `packages/cdd-engine/src/surface/words/__tests__/words.test.ts`
- Create: `packages/cdd-engine/src/surface/words/__tests__/words.guard.test.ts`
- Modify: `packages/cdd-engine/tests/parity/grid.ts`（本片各格的名册行）
- Modify: `packages/cdd-engine/tests/parity/baseline/`（重录产物：本片落地的 producer 把它名下的格从 GAP 推进到已接线）
- Modify: `packages/cdd-engine/tests/parity/GRID-WIRING.md`（本片各格的名册行）
- Modify: `packages/cdd-engine/tests/parity/parity.test.ts`（本片各格的比较项）

#### Consumes
- 旧树的 `face/words.ts`（`CAPSULE_WORDS`——旧树没有 `WORDS` 这个导出，`WORDS` 是本波给新树起的名字；`CAPSULE_WORDS.checked.inFlight` 五行 · `CAPSULE_WORDS.inFlight` 的 `held` / `stealable` / `targetGone`（lead · plan · workspace · separator · takeover） / `lockHeld` / `lockOnly` / `free` / `corruptLocked` / `corruptUnlocked` / `recovery` 三句 · `CAPSULE_WORDS.routeWords.handoffRef` · `CAPSULE_WORDS.checked` 的结果词 · 阻断措辞 · `GUARD_BAN_WORDS` 退役词表）· `face/board-view.ts` 的 `art:` 行与它的续行列标签（旧树把这些字面写在渲染器里；新树按一条事实一张词表收进 `WORDS`，`board` 只连接）· `contract/preflight-rows.ts#RowStation` 与 `session/preflight.ts#PreFlightReason`（站名与理由两个闭集的单一源）· `env/process/clock.ts#Clock`（T5 落点：在飞行的 `{uptime}` / `{startedAt}` 只经它算——`words.ts` 自己不读时钟）

#### Produces
- `WORDS`：拒绝站名闭集（就是 `RowStation` 的那四个值：`no-host` · `carrier` · `dispatch-input` · `artifact`——它是门行集 `PreFlightGateName` 的成员集，不是与之并列的第二集）· 拒绝理由闭集 `PreFlightReason` 的各行 · 阻断前缀 · `checked.inFlight` 五行 · `checked:` 面的题头与 per-rule 结果词（passed · failed · warned 与各 skip 族）· capsule 两槽 · 板面 token（三枚进度标记 `✔` / `▶` / `○` · 两条图例尾行——板面的 `progress: ✔ done · ▶ current · ○ pending` 与波板面的 `progress: ✔ done · ▶ current wave · ○ pending`，两条只差 `current` / `current wave` 一个词 · 三段标题 `graph:` / `wave board:` / `progress:` · 树上事实块的两条行标签 `orphan:` / `crashed:` 与 `crashed:` 行的轮间分隔 ` · ` · 孤儿行接在名字之后的句子 `no recorded round owns it` · 预览 `reads:` 行尾的孤儿草稿后缀 ` · orphan drafts: `（名字之间同用 ` · `）· 产物清单的行标签 `art:` · 它那一行的两处列词（行名与产物 kind；`--artifacts` 打开时行尾带 `c{cycle}·a{attempt}` 坐标）与状态词区（`ok` / `absent` / `misplaced` / `invalid`——`ok` 是 T7 `ArtifactRead` 的成员名，也是旧树健康轮印出的那一格；四态同源于 `ArtifactRead`，`misplaced` 与 `invalid` 两态带 `! ` 前缀，健康与缺席两态不带）· 产物续行的列标签（板面的续行列与门口 `derived:` / `found:` / `reason:` 行是两份不同的字节契约，故词表逐组声明、不互相顶替）；`surface/render/board.ts` 与 `surface/render/graph.ts` 只连接这一组，不各存一份）· `GUARD_BAN_WORDS`（退役词表，单份——kairos 的 `words.test.ts` 消费它）
- `ISSUE_TYPES`：issue 类型集的单一源（`IssueBodyRenderer` 的 `types` 由它派生，kairos 的 `issue-type-contract.test.ts` 翻面时改指这一处）
- `WORDS` 承载 `CAPSULE_WORDS` 那一整族，不只 capsule 两槽：`checked.inFlight` 五行（`free` · `held` · `stale` · `corruptLocked` · `corruptUnlocked`——它们进 `checked:` 段）· `inFlight` 的 `held` · `stealable` · `targetGone`（lead · plan · workspace · separator · takeover）· `lockHeld` · `lockOnly` · `free` · `recovery` 三句（持有块的 `lock:` 行、死持有者的承接提示与它们的字面都取自这一族，T15 的 `#heldBlock` 只连接它、不另拼）· `routeWords.handoffRef`。两个树外消费者读的就是这一处：`packages/kairos/tests/recovery-wording.test.ts` 读 `inFlight.recovery`、`packages/kairos/tests/skill-anatomy.test.ts` 读 `routeWords.handoffRef`——T18 的改指清单因此有一行落在本片；只有 capsule 两槽搬过来、这一族留在旧树，就是两个消费者在翻面后缺属性
- `Words`：词表面访问类（构造入参含注入的 `Clock`，`Translator` 与 `IssueBodyRenderer` 收它；取到的就是这一份词行，不另建第二张表；在飞行的 `{uptime}` / `{startedAt}` 由注入时钟算出——`words.ts` 里零 `Date.now()`、零 `new Date(`；kairos 的 `issue-type-contract.test.ts` 与 `words.test.ts` 翻面时改指这一处）
- `surface/index.ts` 的 `Cli` 门面骨架（本任务只露词表）
- `__tests__/words.guard.test.ts`：引擎字面量守卫（`precommit` 今天指向旧树的同名文件，翻面时随 T18 改指这一处）

#### Steps
- 写站名闭集的 pin — checkable: 站名集就是 `RowStation` 的四个值，且每个站名都在门行集 `PreFlightGateName` 里（断言包含，不断言两集相等）；理由集 `PreFlightReason` 的每行可读
- 写 `checked.inFlight` 行集的 pin — checkable: 五行齐（free · held · stale · corrupt 有锁 · corrupt 无锁）；这五行是 `checked:` 面的词行，与持有块尾部追加的 `corruptLocked` 行是**两个面**（前者进 `checked:` 段，后者进持有块的块体），不许并成一份、也不许互相顶替（各自的字节由各自的 pin 判）
- 写 capsule 两槽的 pin — checkable: `status · handoff` 两槽；槽序固定
- 写「第二份拷贝即红」的 pin — checkable: 同一措辞在词表外出现一次即红（扫 `surface/**` 的字面量，豁免渲染器的模板）；两处图例尾行是同一份模板的两个实例、只差 `current` / `current wave` 一个词（`board` 与 `graph` 各连接一次，任一渲染器里写死一整条 `progress:` 尾行即红），三枚进度标记同理
- 写板上事实块与产物清单的词面 pin — checkable: `orphan:` / `crashed:` 两个行标签、`no recorded round owns it` 一句与 `reads:` 行的 ` · orphan drafts: ` 后缀均可读；`art:` 标签与它的状态词区可读（四态同源于 T7 的 `ArtifactRead`，健康轮那一格是 `ok`）；把其中任一句写死在 `surface/render/board.ts` 里 ⇒ 该条红
- 写 issue 类型集与词面类的 pin — checkable: `ISSUE_TYPES` 与渲染器的 `types` 逐值相等（断言从 `ISSUE_TYPES` 派生，不手写类型字面）；注入固定时钟的 `Words` 对同一词行两次读产生同一份值
- 重录基线 — checkable: 跑 `node --experimental-strip-types packages/cdd-engine/tests/parity/record.ts` 后，本片 producer 名下的格在录制件里的状态是已接线（不再是 GAP），且它们的期望字节与重录前逐字节相等；跳过这一步 ⇒ 对账器报 `recorded as gap, but its producer has landed`
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/surface tests/parity` 绿（名册挂给本片的两格 `f8.blocked.message` · `f8.blocked.checked` 在本片 producer 落地后派生成已接线，但 `seam` 的注册波是 T16、本片不注册 driver，故两格读作具名延后并点名 T16，不是缺格也不是差异）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
五条 pin 齐（站名是门行集的成员 · in-flight 五行 · capsule 两槽 · 措辞单份含板面 token 的三枚标记与两条只差一个词的图例尾行 · issue 类型集与 `Words` 词面类）；`surface/words` 对 `run/` 只经类型读，不调 `Run` 的方法。

#### DependsOn
6, 11

### Task 15: `surface/` 的渲染

#### Objective
把事实渲染成消费者字节：prompt 模板（两带）、胶囊、板面（`--notes` 两态 · 板上事实块 · 产物清单）、预览块、图、issue body、brief、命令面的错用与失败字节。**不变量**：消费者拿到的字节就是契约。

#### Files
- Create: `packages/cdd-engine/src/surface/render/templates.ts`
- Create: `packages/cdd-engine/src/surface/render/capsule.ts`
- Create: `packages/cdd-engine/src/surface/render/board.ts`
- Create: `packages/cdd-engine/src/surface/render/preview.ts`
- Create: `packages/cdd-engine/src/surface/render/graph.ts`
- Create: `packages/cdd-engine/src/surface/render/route.ts`
- Create: `packages/cdd-engine/src/surface/render/issue.ts`
- Create: `packages/cdd-engine/src/surface/render/brief.ts`
- Create: `packages/cdd-engine/src/surface/render/usage.ts`
- Create: `packages/cdd-engine/src/surface/render/init.ts`
- Create: `packages/cdd-engine/src/surface/render/__tests__/render.test.ts`
- Modify: `packages/cdd-engine/tests/parity/fixtures/trees.ts`（本片给夹具加四件声明：**树形态 `overall`**——一份宪章加一份带 `program:` 指向它的 phase-spec，`TREE_SHAPES` 收下它（T2 交付的那几份形态不动），程序板的两条渲染路径与其 `art:` 观察面只由它造；**旋钮「孤儿草稿」**——`materialize()` 落一份无人认领的 `tasks-*` 草稿；**旋钮「崩溃轮」**——另一个形态落一条裁决没扣住目标动作、且带 hard 违规的轮记录；**产物清单的语料臂**——一条健康轮（合法的 `phase-spec` sidecar，读值 `ok`）与一条 sidecar 缺席的评审轮（读值 `absent`）。探针与树形态都不可字面描述这几族，故旋钮由夹具声明）
- Modify: `packages/cdd-engine/tests/parity/fixtures/README.md`（`overall` 形态、两条旋钮与产物清单两条语料臂的读数，与既有的树形态同册；「does not invent an eighth shape」那半句随形态换口——`overall` 是文档种类的形状（一份宪章加一份带 `program:` 指向它的 phase-spec），不是 `TreeOptions` 旋钮能表达的「更宽的 wave / 半写的账本」，故它进 `TREE_SHAPES` 而不新开旋钮）
- Modify: `packages/cdd-engine/src/surface/index.ts`
- Modify: `packages/cdd-engine/tests/parity/grid.ts`（本片各格的名册行）
- Modify: `packages/cdd-engine/tests/parity/baseline/`（重录产物：本片落地的 producer 把它名下的格从 GAP 推进到已接线）
- Modify: `packages/cdd-engine/tests/parity/harness.ts`（其余 `render:<family>` 的注册波就是本波：每个渲染器一个 driver）
- Modify: `packages/cdd-engine/tests/parity/GRID-WIRING.md`（本片各格的名册行）
- Modify: `packages/cdd-engine/tests/parity/parity.test.ts`（本片各格的比较项；`TREE_SHAPES` 收下 `overall` 之后，形态登记断言随之改成派生形——「registers the seven tree shapes, the three non-tree fixtures and the frozen date」那一条不再断 `TREE_SHAPES_TEXT.length` 的字面数，`TREE_SHAPES_TEXT` 自身就是唯一声明点，逐值断言或直接去掉那条计数；**不要**把旧的字面计数改成新数字，那正是 D101 禁止的「把字面当判据」）

#### Consumes
- 旧树的 `render/templates.ts`（`WORK_MODES` · `TEMPLATE_PROMPT.modes` / `.reviews` · `REVIEW_VARIANTS` · `$version`）· `render/brief.ts` · `render/issue-body.ts` · `face/capsule.ts` · `face/board-view.ts` · `face/preview.ts` · `face/graph-view.ts` · `face/route-render.ts` · `face/artifacts.ts#CliArtifacts#runIssue`（stdin JSON 契约与违约报文）· `face/gate.ts` 的两处拒绝措辞（读行为与字节）

#### Produces
- `templates`：两带 prompt（modes 三行 · reviews 每 `TargetType` 一行）· `$version` 原值不变
- `capsule` / `board`（同一个 `BoardView` 走**两条渲染路径**：**节点板**——`--plan` 指向 plan 或 phase-spec 时的树行板；**程序板**——`--plan` 指向整体宪章时的那一块（整体行 + 每个 `program:` 指向本宪章的 phase-spec 一行 + `next:    done`），它有自己的 `art:` 观察面：整体行自己的轮经程序席位绑定，`program:` 分组里的各 phase 行各归自己的板。入参两件：`BoardDisplay`（只有 `--notes` 与 `--artifacts` 两个开关，不判哪一族该印、不判哪一轮算异常）与 T13 `Run#boardOf` 交回的那一份板面事实值（三格逐值声明：**板上各路行** · **树上事实块** · **产物观察集**，全由 T7 的读面装配，本类只连接）。三条渲染支各自的入参点名：**板上各路行**取事实值第一格（`in-flight:` 行由它出，`next:` 经 `route` 取值）· **树上事实块**（`in-flight:` · `orphan:` · `crashed:`）取第二格——`orphan:` 的名单是 T7 `Ledger#orphanHandoffs()` 的读值、`crashed:` 的格是 T7 `#crashedOf` 的读值，本类不读账本、不判归属也不判崩不崩 · **产物清单 `#artifactRows(observed)`** 取第三格，即 T7 `Ledger#observedArtifacts()` 的观测集（每条带 `line` · `kind` · `cycle` · `attempt` · 载体路径 · 该载体的 `ArtifactRead` 读值，按 `(cycle, attempt)` 排序）：默认只出异常轮，于是无产物观察的树加零字节；`--artifacts` 出全清单、一次观察一行并带 `c{cycle}·a{attempt}` 坐标，一条健康轮印 `ok`、一条 sidecar 缺席的评审轮印 `absent`）/ `preview` / `graph` / `issue` / `brief` / `init` 各一个渲染类，全部只读 `words` + 事实对象；时间戳格式化不在渲染器里——`{startedAt}` / `{uptime}` 已由 `Words` 用注入的 `Clock` 拼好；`brief` 只出字节与工作区相对名，落地不在渲染器里（T13 的派发面经 `env.workspace#writeText` 落，`INPUT_WAVE_BRIEF` 取回值）；`graph` 只出一棵树的三段（`graph: <plan>` 标题 · `wave board:` 段 · `progress:` 尾行，每行两空格缩进），它的调用者是 `route` 渲染器的拒绝 detail 段（只 `split` 这一条成因），自己零判定、不读账本、不持图例字面（连 T14 的板面组）；`preview` 点名**三个入口**，与 `Run.previewOf` 回值的三个 `kind` 一一对应：`#passBlock`（题头 + 五类行：`step:` / `reads:` / `would write:` / `would record:` / `child:`，零 `next:` 行，块体不再有别的行；`reads:` 行尾带孤儿草稿后缀 ` · orphan drafts: <名字…>`，名单取 T7 的 `Ledger#orphanHandoffs()`，无孤儿即零字节）· `#heldBlock(state)`（题头 + `lock:` 行 + 死持有者的承接提示 + `kind: corrupt` 而锁仍在时的追加一行，取 in-flight 状态值，自己零取锁、零写；三处字面全取自 T14 `WORDS` 的 `inFlight` 族——`lock:` 行取 `lockHeld` / `lockOnly` / `free` 之一，承接提示取 `stealable` 与 `targetGone`，追加行取 `corruptLocked`，渲染器零自造措辞）· `#blockedBlock(body, detail)`（题头 + `route#refusalBlock` 渲染出的正文 + 该裁决自带的 detail 行集，只由它加自己的外层（题头 + `  <row.token><row.gap>`），自己零判定；**正文与 detail 段经 `route#refusalBlock` 取、不在此拼装**）；三块共用**同一段 `checked:` 字节**（同一份 `checked` 行集，拼装不在这里、在 `route` 渲染器，见下一项），而**流按形态分**：通过形态与真派发同走诊断流，持有与阻断走 stdout——渲染器只出字节，流归 T16 的输出面；`init` 点名四个出口，**每个出口带自己的流**：预览块（每步一行 `would run: <argv>` + 摘要 + 空推荐档 info 行）· 真跑进度行（每步一行，从 `#apply` 注入的 `onStep` 回调取事实）· 绿摘要——这三者走 **stdout 面**（旧树的 `header` 面即 `writeSync(1, …)`）；首败报（失败行 `init[i/n] · <argv> · exit <code>` + 推荐档措辞 + `--update` 提示两处条件句）**三行一律走 stderr 面**（`face/init.ts#CliInit` 的失败报三行同源）——渲染器的出口因此是带流的值（或一对面 writer）；单 writer 接线会把首败报随进度落到 stdout，把面 1 的 init 失败路两条流对调；它只把步骤事实渲染成行，判定与 spawn 都在 `provision`（T8）；`issue` 连同它的输入契约：stdin 的 findings JSON 三类违约——畸形 JSON 一行 · 缺键与类型错（含 `related`）走 `cdd issue render: invalid input:` 加每条违约一行缩进、**一律 exit 1**；**多余键不是违约**（渲染器在渲染前自己判，壳只读 stdin 并打印）
- `route` 渲染器（`surface/render/route.ts`）：`next:` 与行门族那两处拒绝措辞的**唯一拼装点**（措辞取自 `words`，`run/advance` 不拼字节）；胶囊与板面都经它取值，所以两处的 `next:` 逐字节相同，不是各拼一次；`checked:` 行集也在这里拼（`#checkedBlock(checked)`：题头与 per-rule 结果词取 T14 的 `WORDS` 的 `checked` 组，行取**回值自带的那一份** `checked` 行集——那一集由 T11 的 seam 从 T10 的规则声明面派生（`advance` 的 `dispatch` / `blocked` / `held` 与 `previewOf` 的三态各带一份，approved 派发与 blocked 派发印出的字节相等），两空格缩进与 detail 段同形）——真派发的诊断面与 dry-run 的三张脸都印这一段（同一份行集，两处字节相等），流的选择归 T16 的输出面：真派发与通过形态走诊断流，持有与阻断走 stdout，渲染器只管字节；**拒绝路的 detail 段也在这里拼装**：`#refusalBlock(verdict)` 按裁决的成因出 detail 行，`split` 这一条经 `surface/render/graph.ts` 取 `graph:` 标题 · `wave board:` 段与 `progress:` 尾行（同一份裁决两次渲染字节相同），其余成因不带这三段
- `usage`（`surface/render/usage.ts`）：命令面**走 body 的**错用与失败字节的唯一载体——`UsageFace#report(outcome)` 把一个声明过的结果值映射成 `{stream, text, exitCode}`。构造入参含注入的 **usage 首行面** `usageLine: (commandPath) => string`：**这张表不持那一行的字面**，两行族的第一行一律经它按成员的命令路径取值、单行族不调它。旧树的这一行是 `node.helpInformation()` 的首行（命令节点的声明面派生），所以它在新树只有一个派生点——T16 `surface/commands/projection.ts` 的命令树，本文件只取用；W9 的表因此无须、也不得自己按填充值重拼 `Usage: cdd <命令路径> [options] <位置参数名>`，那一拼就是同一句字节的第二个拼装点，而表的每成员臂只能断自己写下的字面、自证成真。错用字节有**三个答话人、逐层同源**，只有第三层在这一片：(i) **解析层**——required 旗标 · required 位置参数 · 未知旗标 · 多余位置参数由 commander 在解析期拒，字节形如 `error: required option '--tasks <n|n,n,…>' not specified` / `error: missing required argument 'type'` / `error: unknown option '--plan'` / `error: too many arguments for 'get' …`，**不带 usage 首行**，其字面由声明面的 required 标记派生（`surface/commands/declare.ts` 是唯一来源），`usage.ts` 不认领、不重拼；(ii) **条件必填层**——`REQUIRED_GROUPS` 钩子拒的族（形如 `error: --plan required when --type wave`，单行、无 usage 首行），拼法来自 `declare.ts` 的 group 行，`usage.ts` 同样不认领；(iii) **run body 层**——只有走到 `Cli#run` 之后的族才进 `UsageFace#report`；**这一层不是一种形状，而是每成员各带自己的流、文本与退出码**：`{stream, text, exitCode}` 三件对每个成员各填一次，全表共用一句模板即缺陷——按形状归族（判据是形状，不是「缺」）：usage 首行（stderr）+ `error: <message>` + 退出码 2 那一族含缺旗标一族 · 缺 skeleton target · 多余 target · 组合缺 · 计划里无该任务 · 作用域拒绝 · 读失败 · 写失败 · 基冲突（读失败那一族的两行形是 usage 首行 + `error: cannot read file: <rel>`，不是单行）；而板面的「未命中」与「读不出」·`base get` 的「产物缺失或损坏」是**单行、无 usage 首行、无 `error:` 前缀**（stderr，exit 2），work 命令的「无可派发帧」同为单行、无 usage 首行（stderr，exit 1）。`outcome` 里 `usage` 那一个 `reason` 是 T13 `run/advance/frame.ts` 的 `UsageReason`（`import type` 读，零运行时依赖），本文件对它的 **每个成员各一格**（一张键集与成员集同基数的字节表 `USAGE_BYTES` + 每格自己的拼法）；每格还带一列 `producer`（该成员的产出落点：模块路径 + 符号，取自 T13 那张对应名单），解析这些落点的 pin 在 T16（`surface/commands/**` 是那一任务的交付物，本任务的套件不 import 命令树）；字节表之前有一张转译表 `FAILURE_REASONS`，把声明值翻成成员——T3 的读 / 写失败与基冲突 · T4 的 `read-failure` · T9 的 `write-failure` · `BaseArtifact#read` 的 `{kind: "absent", target}` 与 `{kind: "corrupt", target}` 各入一行（后两者都带 `target`，于是 `base get` 那一格的 `at <path>` 有来源；裸 `null` 不在任何入参域，也不在字节表的键里）· `docs/` 的另两个声明失败值 `{kind: "missing-target"}`（`Documents#skeletonAt`）与 `{kind: "extra-target", target}`（`Documents#projectOf`）各入一行，翻成「缺 skeleton target」与「多余 target」那两格——`docs/` 因此不命名 `UsageReason` 的成员、也不 import `run/`，成员只收真正走到 body 的族：缺 `--tasks` 那一族（`cdd <verb> --type wave: missing required --tasks <n|n,n,…>`）· 缺 skeleton target（`cdd schema get --output skeleton: missing <target>`）· 多余 target（`cdd schema get: unexpected <target> — …`）· `--plan` / `--spec` 的组合缺（`cdd board: pass --plan and/or --spec`）· 计划里无该任务 · 纯命令的 `--dry-run` 作用域拒绝各占一格，读失败 / 写失败 / 基冲突同样各一格——基冲突那一格印 `error: cdd base set: base already set to <existing> — pass --force to override`，`<existing>` 的填充源是 `conflict` 值自带的**既有基**（存储的那个基），不是本次请求的 `--base`；板面的「未命中」（`cdd board: no docs match <未命中项>`，未命中项按 ` and ` 连接、每项是旗标拼写 + 目标路径）· 板面的「读不出」（`cdd board: cannot read <旗标拼写> <目标路径>`）· `base get` 的「产物缺失或损坏」（`cdd base get: missing or corrupt base artifact at <仓库相对路径>`）· work 命令的「无可派发帧」（`cdd <verb>: nothing to dispatch — the line holds no open frame`）各占一格，且**这四族在旧树里没有那一形**——折进 `error: cannot read file:` 那两行形即同时改冻结面 1 与面 2；**`cdd init: missing --harness` 这类不是本层的字节**——同族输入先被解析层拒（`error: required option '--harness <claude|pi>' not specified`），把它拼成本层形状就改了冻结面 2；**行门族的拒绝措辞不在这张表里**——`cdd <verb>: cannot dispatch a <phase> round — <reject>` 归 `route` 渲染器（同一任务内的另一拼装点，exit 1），一条字节只有一个拼装点；壳只把值交过来，自己零拼装；成功面也走同一处（路径回显与那一个尾随 `\n`）
- `surface/index.ts` 扩出各渲染入口

#### Steps
- 写 prompt 两带的 pin — checkable: `modes` 键集 = `WorkModeRowKey`（implement · fix · docs-fix）；`reviews` 的键集恰是 `TargetType`（断言从 `REVIEW_VARIANTS: Record<TargetType, …>` 的类型派生，不写字面行数）；`$version` 与旧树相同
- 写模板字节等价 — checkable: 对同一组输入，新渲染器与旧渲染器字节相同（对账器的 prompt 格由本任务接上）
- 写胶囊的 pin — checkable: `status · handoff` 字节；handoff 缺席时的形态
- 写 `next:` 单点拼装的 pin — checkable: 同一 `NextHop` 经胶囊与板面渲染 ⇒ 两处 `next:` 字节相同（把 `route.ts` 的拼法改一处，两处同时变）
- 写波板三段的 pin — checkable: `split` 成因的裁决经 `route#refusalBlock` 渲染出的 detail 段与该裁决经 `surface/render/graph.ts` 渲染的字节相同（同一份裁决两次渲染，字节相等）；非 `split` 成因不带 `graph:` / `wave board:` / `progress:` 三段；把 `graph` 里的图例行换成另一句 ⇒ 该条红（字面取自 T14 的板面组）
- 写板面两态 — checkable: 默认零 notes 正文且带 `notes +M`；`--notes` 展开后正文全量、token 段序不重排
- 写板上事实块与产物清单的 pin — checkable: 一份带孤儿草稿的树 ⇒ 板面在 `in-flight:` 行与 doc 行之间印 `orphan: <名字> — no recorded round owns it`，不种草稿的同一棵树上该行零字节；一条崩溃轮的树 ⇒ `crashed:` 行出现且同一轮身份两次记账只出一格；一株无产物观察的树加不加 `--artifacts` 字节相同（零 `art:` 行）；一条健康轮（`phase-spec · rulings` 的 sidecar 合法）在默认状态下零 `art:` 行、`--artifacts` 打开后恰一行且状态词是 `ok` 并带 `c{cycle}·a{attempt}` 坐标；一条 sidecar 缺席的评审轮只在 `--artifacts` 下印 `art:` 行、状态词是 `absent`；一条异常轮在默认状态下就印 `art:` 行（`! misplaced` 或 `! invalid`）；程序板一条（`--plan <整体宪章>` 印整体行 + 每个 `program:` 指向本宪章的 phase 行 + `next:    done`，`--artifacts` 打开程序席位自己的 `art:` 观察面）；本类不从账本拼名字、也不自己判「哪个轮崩了」（读值全取自 T7 的三个读面：`#orphanHandoffs` · `#crashedOf` · `#observedArtifacts`）
- 语料落格 — checkable: `grid.ts` 与 `GRID-WIRING.md` 各补六行（`f6.board.orphan` · `f6.board.crashed` · `f6.board.art.anomalous` · `f6.board.art.all` · `f6.board.program` · `f6.board.program.art`，接线任务都是 T15、producer 落点 `surface/render/board.ts#BoardView`）；`f6.board.art.all` 自带两条臂（健康轮的 `ok` 行与 sidecar 缺席评审轮的 `absent` 行，都只在 `--artifacts` 下印）；`f6.board.program` 与 `f6.board.program.art` 骑夹具的 `overall` 树形态，后者带 `--artifacts`（打开程序席位那一行）；把 `fixtures/trees.ts` 的孤儿草稿旋钮关掉 ⇒ `f6.board.orphan` 红；本步改动了格集，收尾重录一次 `baseline/` 让这几族进录制件；同批把 `TREE_SHAPES` 收下 `overall` 的两处登记换口——`parity.test.ts` 的形态登记断言改成派生形（不把旧的字面计数改成新数字，`TREE_SHAPES_TEXT` 是唯一声明点）、`fixtures/README.md` 的「does not invent an eighth shape」换成「`overall` 是文档种类的形状、不是 `TreeOptions` 旋钮」，于是「本片各格全绿」在换向前是必红的那一条
- 写预览三块 — checkable: 三个入口各一条：通过块——题头 + 五类行（`step:` / `reads:` / `would write:` / `would record:` / `child:`）齐且零 `next:` 行，块体再无其他行（`checked:` 段不在这一块里，它随真派发走诊断流），`reads:` 行尾带孤儿草稿后缀（注入一份带孤儿草稿的账本 ⇒ ` · orphan drafts: <名字…>` 收尾，无孤儿时零字节；名字取 T7 的 `Ledger#orphanHandoffs()`）；持有块——`lock:` 行的三个事实（持有者 · 无记录的锁 · 空闲）与死持有者的承接提示取自 in-flight 状态值，零取锁、零写；in-flight 三 kind 逐一驱动，且 `kind: corrupt` 而锁仍在时 `lock:` 行取「无记录的锁」那一拼法并**追加** `corruptLocked` 一行（断言行序：题头 · `lock:` 行 · 追加行）；阻断块——正文取 `route#refusalBlock`（拒绝行与 detail 段都在那里拼）、detail 段逐行两空格缩进；三块共用的 `checked:` 行集与真派发诊断面那一段逐字节相同（同一份行集两处印，字节相等；持有块与阻断块把它收在尾部，通过块不带它）；渲染器的入参就是 T13 的 `Run.previewOf` 的返回值里的 `pass` / `held` / `blocked` 三个 `kind`（三条入口各取自己那一个，三个 `kind` 各带 `checked` 行集；`refused` 走 `route` 渲染器、装配层两值走 `usage` 面，不在这里），同一帧两次渲染字节相同，渲染器自己不读账本、不判持有与阻断
- 写 issue 输入契约的 pin — checkable: 合法 JSON ⇒ 字节与旧树相同、exit 0；**多余键不是违约**——`IssueBodyRenderer#validateInput` 只查缺键、类型与 `related`，一份带多余键的合法 payload 仍 exit 0 并印出正文（按「多键即违约」实现就把上一版接受过的输入变成了拒绝）；三类违约各断自己的形态、**一律 exit 1**（这一族是拒绝，不是错用）：畸形 JSON 一行（`cdd issue render: invalid input JSON — <msg>`）· 缺键与类型错走 `cdd issue render: invalid input:` 加每条违约一行两空格缩进——两种字节形态不并成一种
- 写 `init` 字节面的 pin — checkable: 四个出口各一条（预览块 · 真跑进度行在每步 spawn 之前 · 绿摘要 · 首败报含推荐档与 `--update` 两处条件句）；渲染器的入参是「步骤事实 · 回调序号 · 首个失败步的 `{index, exitCode}`」三件——首败的 `exit <code>` 取自第三件（不从步骤事实推、不由壳拼），自己不 spawn、不写盘、不判档（档位随步骤本身进来）；首败时进度行逐行在对应 spawn 之前、失败行 `init[i/n] · <argv> · exit <code>` 只出现一次；**流分工逐条断**：首败时 stdout 只含进度行（失败三行一条都不在 stdout），失败行 · 推荐档措辞 · `--update` 提示三行全在 stderr，`exit <code>` 取自 `#apply` 回值的 `exitCode`；预览块与绿摘要、空推荐档 info 行同落 stdout 面
- 写错用与失败字节的 pin — checkable: 本图只判**不依赖命令树**的 body 层——入参是声明值，不是命令：字节表 `USAGE_BYTES` 的分支集与 `UsageReason` 的成员集逐值相等（两侧各从自己的声明处派生——键集从表的类型、成员集从 union 的类型——断言不写字面行数；多一个成员无格或少一格无成员即红；每行都带 `producer` 列（模块路径 + 符号，两件都非空——解析这些落点的臂在 T16））；每格一条臂，把该成员喂给 `UsageFace#report` 一次，断 `{stream, text, exitCode}` 三件——**形状按形状判、不按「缺」判**：usage 首行 + `error: <message>` + exit 2 那一族含缺 skeleton target · 多余 target · `cdd board` 无 `--plan` / `--spec` · 缺 `--tasks` 那一族 · 计划里无该任务 · 作用域拒绝 · 读失败 · 写失败 · 基冲突，板面「未命中」/「读不出」·`base get`「缺失或损坏」是单行、无 usage 首行、无 `error:` 前缀、exit 2，work 命令的「无可派发帧」单行、无 usage 首行、exit 1；读失败那一族的**两行形**（usage 首行 + `error: cannot read file: <rel>`）与那四族的单行形各断一条，不并成一种；**转译表另有一条臂**——把 T3 / T4 / T9 的每个声明失败值（含 `docs/` 的那两个：`{kind: "missing-target"}` · `{kind: "extra-target", target}`）与 `BaseArtifact#read` 的 `absent` / `corrupt` 两个变体各喂 `UsageFace#report` 一次，断它翻成的就是铸字节的那一格（两个 `BaseArtifact#read` 变体都落到 `base get` 那一个成员，且那一格的 `at <path>` 就是它们自带的 `target`；`missing-target` 落到「缺 skeleton target」那一格、`extra-target` 落到「多余 target」那一格，后者那一格里的路径就是该值自带的 `target`）；**usage 首行的来源另有一条臂**——注入一个记数的 `usageLine` 面 ⇒ 两行族的每一格报告一次调用，且报告的首行与这个面的回值逐字节相等（表里写死一行 `Usage:` 开头的字面即红：扫 `surface/render/usage.ts` 里零 `Usage: ` 字面），单行族与 exit 1 那一族零调用；与命令节点 `helpInformation()` 首行逐字节对的臂在 T16（命令树是那一任务的交付物）；**「未命中」另有一条双旗标臂**：`--plan` 与 `--spec` 同时不命中 ⇒ 填充值是两项、成行时按 ` and ` 连接（旧行为既有、旧测试未盖，不是新增语料臂）；这些字面在 `surface/render` 之外零出现（沿用同一扫法）。**真跑命令断字节的臂在 T16**：解析层与条件必填层的报文集由 commander 与 `REQUIRED_GROUPS` 在 `declare.ts` 的声明上产出，而命令树与 `declare.ts` 都是 T16 的交付物（本任务的 Files 不含 `surface/commands/**`）——写在这里就是一条在它自己那一波跑不起来的臂
- 写措辞单份的复审 — checkable: `surface/render` 里不出现词表外的散文措辞（沿用 T14 的扫法）
- 重录基线 — checkable: 跑 `node --experimental-strip-types packages/cdd-engine/tests/parity/record.ts` 后，本片 producer 名下的格（含 `entry` 类：它们的 producer 在本波落地，状态前进到已接线，读数仍由具名延后兜住）在录制件里的状态是已接线（不再是 GAP），期望字节与重录前逐字节相等
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/surface tests/parity` 绿（对账器按 T2 的三态口径加 T8 的具名延后那一档；本波在 `harness.ts#NEW_TREE` 注册其余 `render:<family>` kind，故这些格不再读作 GAP——板面各族与预览三块是 `entry` kind，注册波是 T17，本波读作具名延后；`init` 三格是 `seam` kind，注册波是 T16，本波同样读作具名延后并点名 T16）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
七组 pin 齐（两带名册 · 字节等价 · 胶囊 · `next:` 单点拼装 · 板面两态与板上事实块、产物清单各一条 · 预览三块各一条（通过块的 `checked:` 段在诊断流、持有块与阻断块把它收在尾部、通过块的 `reads:` 行带孤儿草稿后缀）· 措辞单份）与波板三段一条（`split` 的拒绝 detail 段与 `graph` 渲染器的字节相同，非 `split` 成因不带那三段；字面取自 T14 的板面组）· issue 输入契约一条 · 错用与失败字节一条（`UsageFace#report` 的每成员各一条臂、字节表的分支集与 `UsageReason` 成员集逐值相等、每行带 `producer`，字节表不持 usage 首行的字面（首行经注入的 `usageLine` 面取，两行族每格一次调用、单行族与 exit 1 那一族零调用），转译表把每个声明失败值（含 `docs/` 的 `missing-target` 与 `extra-target`）与 `BaseArtifact#read` 的两个失败变体各翻成一格，「未命中」含双旗标臂，每成员自带流与形状；真跑命令断字节的臂与生产者落点的解析均在 T16）· `init` 字节面一条（含流分工：进度行与绿摘要落 stdout 面、首败报三行落 stderr 面）；`render:<family>` 族的格（prompt 两带 · 胶囊 · `init` 四出口的渲染字节）本波在对账器里逐字节比——本波是这些 kind 的注册波；板面各族与预览三块的格是 `entry` kind——`entry` 的注册与组合根接线同归 T17，T8 已退掉 T2 的占位驱动，故它们在本波（以及 W10）读作**具名延后**（`REGISTRATION_WAVES` 把注册波记在 T17），落地产 producer 也不改变这一点，进程级的字节比在 T17 收口；`init` 三格是 `seam` kind——producer 在本波落地、字节也还读不出来（`seam` 的注册波是 T16），故这三格在本波读作具名延后并点名 T16。

#### DependsOn
9, 13, 14

### Task 16: `surface/` 的八条薄壳

#### Objective
八条命令的薄壳与 CLI 声明。**每条壳只做三件事**：取参 · 调 `run/` · `docs/` · `env/` 之一的一个入口 · 原样输出；零判定、零文件 IO、零字符串拼装。超过约四十行（含类声明与 import）说明判定漏进了壳里——这是诊断，不是判据：判据是三件事本身，行数不进套件。

#### Files
- Create: `packages/cdd-engine/src/surface/commands/declare.ts`
- Create: `packages/cdd-engine/src/surface/commands/projection.ts`
- Create: `packages/cdd-engine/src/surface/commands/implement.ts`
- Create: `packages/cdd-engine/src/surface/commands/review.ts`
- Create: `packages/cdd-engine/src/surface/commands/fix.ts`
- Create: `packages/cdd-engine/src/surface/commands/base.ts`
- Create: `packages/cdd-engine/src/surface/commands/schema.ts`
- Create: `packages/cdd-engine/src/surface/commands/issue.ts`
- Create: `packages/cdd-engine/src/surface/commands/board.ts`
- Create: `packages/cdd-engine/src/surface/commands/init.ts`
- Create: `packages/cdd-engine/src/surface/commands/__tests__/commands.test.ts`
- Create: `packages/cdd-engine/src/surface/commands/__tests__/channel-closure.guard.test.ts`
- Modify: `packages/cdd-engine/src/surface/index.ts`
- Modify: `packages/cdd-engine/tests/parity/grid.ts`（本片各格的名册行）
- Modify: `packages/cdd-engine/tests/parity/baseline/`（重录产物：本片落地的 producer 把它名下的格从 GAP 推进到已接线）
- Modify: `packages/cdd-engine/tests/parity/GRID-WIRING.md`（本片各格的名册行）
- Modify: `packages/cdd-engine/tests/parity/parity.test.ts`（本片各格的比较项）
- Modify: `packages/cdd-engine/tests/parity/harness.ts`（`seam` 的注册波就是本波：注册 `seam` kind 与它的进程内 driver）
- Modify: `packages/cdd-engine/tests/parity/fixtures/trees.ts`（新增一条「已存在但读不出」的探针旋钮：`TreeFixture` 收一个可声明的读不出路径集，`materialize()` 落盘后对它们逐个把模式清零——`f1.board.refusal.unreadable` 那一格的输入只由它造，探针与树形态都不持模式字面）
- Modify: `packages/cdd-engine/tests/parity/fixtures/README.md`（把读不出旋钮那一条读数与既有树形态同册）

#### Consumes
- 旧树的 `face/cli.ts`（八命令的旗标、值域、退出码；场景装配与判定面不在壳里，回 `run/advance` 的 `Frame`（T13）——壳交 argv 侧输入，不交已装配的 slug）· `face/declare.ts`（`CliVerb` · `ARGV_CHANNEL` · `VALUE_SHAPES`）· `face/projection.ts`（命令树装配：八条命令的描述 · 嵌套的叶 · 绑定规则 · 值域校验 · 帮助注入）· `face/artifacts.ts#CliArtifacts`（三条纯命令的取参—调用—输出序列；产物面本身不在壳里）

#### Produces
- `declare`：`CliVerb` 八值 · 旗标与值域声明（单源）· `ARGV_CHANNEL` · **声明面只声明、不供填充值**——旗标行与 `REQUIRED_GROUPS` 行供的是解析期与条件必填期报文所需的声明事实，**不绑 reason 也不供 body 层的拼写**：解析层与条件必填层的报文由 commander 与 group 钩子在解析期产出、从不经 `UsageReason`，给那两行绑一个 reason 字段就是一个无人读的死字段（`declare.ts` 不 import 那个 union）；body 层成员的填充值由产出它的那一处从 argv 侧输入里取（取该项的键与值：旗标拼写取键、命令路径取命令字本身），于是 `declare.ts` 与 `run/` 之间没有依赖边，`run/advance/frame.ts` 先于本任务落地也不撞墙；缺子命令与缺 type 由 commander 在解析期拒（`base` 与 `issue` 节点无 action，整篇 help 加 exit 2），故声明面不为它们各开一行——它们不是 body 层的字节；缺 skeleton target · 多余 target 的**拒绝**由 `docs/` 的两个入口回声明失败值（`Documents#skeletonAt` 回 `{kind: "missing-target"}`、`#projectOf` 回 `{kind: "extra-target", target}`，见 T13 的对应名单；翻成成员的是 T15 的 `FAILURE_REASONS`），声明面只声明 `schema get` 的 `--output` 两态与那个位置参数；`board` 的两个显示开关 `--notes` 与 `--artifacts` 同表各一行（布尔旗标，不在值形状表里）——它们装出 T15 的 `BoardDisplay`，壳只把两个旗标值传下去，不判哪一族该印、不判哪一轮算异常；纯命令（`base` / `schema` / `issue` / `board`）的 `--dry-run` 在声明面上各有一行，并汇成 `SCOPE_ROWS`——作用域拒绝因此是声明出来的一行，不靠 commander 的默认 `unknown option` 字节（那是解析层的另一族；作用域拒绝是 body 层的 usage 首行 + `error:`，两者不同形）
- `projection`：命令树装配——`declare` 的单一表面在构造期一次装配成 commander 树（描述 · 嵌套叶 · 绑定规则 · 值域校验 · 帮助注入 · `REQUIRED_GROUPS` 钩子），`program` 是唯一出口；**usage 首行面也在这里派生**：`usageLineOf(commandPath)` 取该命令节点的 `helpInformation()` 首行（旧树 `face/cli.ts#Cli.#usage` 的那一句），由组合根注入 `surface/render/usage.ts#UsageFace`——于是两行族与同一命令节点的 `--help` 首行同源、全文只此一处派生，表里再拼一次就是第二个拼装点；`ScopeGuard#rejectionOf(request)` 是 `SCOPE_ROWS` 的翻值处——纯命令带着 `--dry-run` 时它在动作之前把 `{kind: "usage", reason}` 交给 `UsageFace#report` 并带出它的退出码，字节仍只有 `surface/render/usage.ts` 一个载体、壳里零判定
- 八条壳：每条一个类，方法体只取参、调一个入口、把该入口返回的结果值交给 `surface` 的唯一输出面（`Cli#report(outcome)`）原样印出——两个动作之间零分支
- **命令面的错用与失败字节无新落点**：载体是 `surface/render/usage.ts`（T15，`UsageFace#report`），壳交的是一个声明过的值（T3 的读 / 写失败与基冲突 · `BaseArtifact#read` 的 `absent` / `corrupt` 两个失败变体 · T4 的 `read-failure` · T9 的 `write-failure` · T13 的 `read-failure` / `write-failure` / `usage` · `Documents#skeletonAt` 的 `missing-target` 与 `#projectOf` 的 `extra-target`）——这些值里只有 `usage` 那一条已经是 `UsageReason` 成员，其余由 T15 的转译表翻成成员，壳两处都只原样交出去；`base` 的 `--force` 冲突谓词住 `env/workspace/base-artifact.ts#BaseArtifact#set`（T3），壳只把它的返回值交出去——判定与措辞都不在壳里
- **本片补的语料格**（`grid.ts` · `GRID-WIRING.md` · `baseline/` 的写权都在本片，不动 T2 已闭合的任务切分）：语料里有一条**真有的**路被写成了「不适用」——旧树的 `face/cli.ts#Cli` 的 `#usage` 对 `cdd schema get <type> <target>`（多余 target）与 `cdd schema get <type> --output skeleton`（缺 target）各印 usage 首行 + `error:` 且 exit 2。于是已交付的 `f1.schema-get.refusal` 拆成 `f1.schema-get.refusal.missing-target` 与 `f1.schema-get.refusal.extra-target` 两族（各三流），不留一个笼统的拒绝格。body 层其余有字节的合法输入各立一族：`f1.board.refusal.scope`（`board --dry-run`）· `f1.schema-get.refusal.scope`（`schema get <type> --dry-run`，纯命令的作用域拒绝）· `f1.board.refusal.no-flags`（`cdd board` 无旗标，usage 首行 + `error: cdd board: pass --plan and/or --spec`）· `f1.board.refusal.no-match`（`board --plan <不存在的路径>`，单行、exit 2）· `f1.board.refusal.no-match-two-flags`（`--plan` 与 `--spec` 同时不命中，同一行里两项按 ` and ` 连接）· `f1.board.refusal.unreadable`（`board --plan <读不出的路径>`，单行、exit 2；「读不出」不是「不存在」——探针经 `fixtures/trees.ts` 的读不出旋钮造一个存在而模式清零的目标，`no docs match` 那一族才是路径不存在，两族的 stderr 字节不同（退出码同为 2），拿一条不存在的路径顶替即红）· `f1.<verb>.refusal.missing-task`（`--tasks` 带一个计划里没有的 id，`implement` · `review` · `fix` 各一格，两行形；`review` 与 `fix` 两格带 `--type wave`，`implement` **不带**——它的旗标集只有 `--tasks` / `--plan` / `--recover`，`--type` 只在 `review` / `fix` 上，写成 `implement --type wave --tasks <计划外 id>` 会先被解析层拒成单行 `error: unknown option '--type'`（exit 2、无 usage 首行），那是另一族的字节而不是这一族的两行形；它的探针是 `implement --tasks <计划外 id> --plan <…>`）。**「无可派发帧」不立格**：`cdd <verb>: nothing to dispatch — the line holds no open frame` 这条字节在本树上**没有触发点**——波门的 line 腿在批次为空时接手（`session/preflight.ts` 把空批次交回 line 腿，`run/advance/frame.ts` 判成 `split`），frontier 非空时命令要么真派发（exit 0）、要么被 hop 不匹配挡成 `unchanged` / `face-closed` / `wrong-phase`，于是 `face/cli.ts#Cli` 那个零派发出口在树上没有可达输入（实测到不了这条字节）。语料因此不为它开格、名册里没有它的行，T15 的 `USAGE_BYTES` 那条成员只由本任务的手写字面单元臂判——端到端没有判者，这是**具名缺席**而不是漏格；它的行为由 hop 拒绝面那几族（`split` · `unchanged` · `face-closed` · `wrong-phase`）在语料里对着旧树逐字节比。面 2 的 `--help` 由根一格补成**每个命令节点一格**：顶层八个节点各一格，加四个嵌套叶（`base set` · `base get` · `schema get` · `issue render`），判的是该节点的 `helpInformation()` 首行。这些族的接线任务都是本片一个（壳与声明——被拒时走哪条流、退出码几都在那一格里比），producer 落点按格各取 `surface/commands/schema.ts#SchemaCommand` · `surface/commands/board.ts#BoardCommand` · `surface/commands/implement.ts#ImplementCommand` · `surface/commands/review.ts#ReviewCommand` · `surface/commands/fix.ts#FixCommand` · `surface/index.ts#Cli`（`--help` 族）；`surface/render/usage.ts#UsageFace` 是那些字节的载体、`run/advance/frame.ts` 与 `run/index.ts#Run` 是翻出成员的那一处，二者都是读值来源，不是第二接线任务。**kind 按探针读什么派生、不按族归**：上面这些族的探针都是一次完整命令的 stdout / stderr / 退出码，且都不注入派发结论或 step runner（计划外任务在派发之前就被拒、板面四族与作用域拒绝都在动作之前、`--help` 只读命令节点），于是 `kindOf` 把它们派生成 `entry`——本片落 producer、重录把状态推到已接线，字节比仍在 T17 收口；若某格的夹具或注入让 `kindOf` 派生成 `seam`（要注入派发结论或 step runner 才录得出来），它就按 `seam` 归族、注册波是本波而不是 T17——同一格不得被两处归到不同波
- `--dry-run` 的入口是 `Run.previewOf(request)`（T13，回值带 `kind`：`pass` / `held` / `blocked` / `refused` / `usage` / `read-failure`），它的渲染器是 `surface/render/preview.ts`（T15）的三个入口、`surface/render/route.ts`（`refused` 那一条，与真派发的拒绝同一份字节）与 `surface/render/usage.ts`（`usage` / `read-failure`）；工作命令的壳在这一支上不碰 `Run.advance`：旗标值的分叉只决定走 `previewOf`，`kind` 到渲染入口的对应是一次值分派（闭集穷举，壳不读 in-flight 记录、不读结构腿裁决、不读波门裁决），退出码也按 `kind` 原样带出（`pass` ⇒ 0 · `held` / `blocked` / `refused` ⇒ 1 · `usage` / `read-failure` ⇒ 2）
- 三条纯命令的产物面无新落点：`base` 的读与写走 `env/workspace/base-artifact.ts`（T3，`BASE_ARTIFACT_FIELDS` 从那里导出）· `issue render` 的渲染与输入契约走 `surface/render/issue.ts`（T15）· 骨架走 `docs/skeleton/assembler.ts`（T9）——`schema` 壳（`surface/commands/schema.ts#SchemaCommand`）按 `--output` 一次值分派到 `Documents` 的**两个**入口（分叉只读旗标值、不读域事实）：`--output skeleton` 走 `Documents.skeletonAt(type, target)`（渲染、经注入的 `env.workspace#writeTextAt` 落盘、回显相对路径三件都在那一个入口里完成）、其余走 `Documents.projectOf(type, target)`（序列形与「多余 target」的拒绝都在那个入口里），壳既不渲染也不写盘、也不判 target 的多少。壳只取参、调它们、原样输出。这两件实例的所有者是 `Env`：`base` 的基产物读写是 `env.workspace` 的成员（`env/workspace/base-artifact.ts`），`init` 的 `Provisioner` 是 `env.provision` 的成员（T8），组合根只构造 `Env` 一处，`Cli` 收的是这两个成员的引用，壳只持它们的类型、零 `new`
- `init` 壳的接线（同一片、同一判据）：壳把 `Cli#report` 的**那一对** writer（stdout 面与 stderr 面）都交给 `surface/render/init.ts`——进度行与绿摘要走 stdout 那一个、首败报三行走 stderr 那一个，并把 `#apply` 的 `onStep` 一并传进去——两条流与首败报的 `exit <code>` 都出自这一处（旧树的 `initHeader` 就是 `writeSync(1, …)`、失败报三行进 `io.stderr`；单 writer 接线会把首败报落到 stdout，把面 1 的 init 失败路两条流对调），壳自己零判档、零拼字节、零 spawn；`#apply` 的回值（`{kind: "green"} | {kind: "failed", index, exitCode}`，T8）由壳原样交给 `Cli#report`，于是首败报的 `<code>` 有来源而不是渲染器自造的第三件入参
- `Cli#run(argv)`（`surface/index.ts`）
- **`seam` 的注册波就是本波**（`harness.ts` + `parity.test.ts`）：`seam` probe 读的是一次完整命令的 stdout / stderr / 退出码，故它的 driver 只可能在命令面落地之后存在——driver 按 probe 的 argv 在测试面装配本树的四片（`Env` → `Documents` → `Run` → `Cli`），把注入的派发结论与 step runner 挂在相应缝上，`spawn` 计数为零；它住 `tests/parity/`（测试面），不与 T17 的组合根唯一性冲突（那一条只扫 `src/**` 的非测试文件）。T8 已把 `seam` 的行记成本波，本波只补 driver、不改那一行；T11 · T14 · T15 落地 producer 的 `seam` 格在此之前读作具名延后并点名 T16，本波起逐字节比，本片名下的 `seam` 格同批
- `__tests__/channel-closure.guard.test.ts`：通道闭合守卫（读 `declare` 的 `CLI_COMMANDS` / `ARGV_CHANNEL` 与 `env/process/host.ts` 的 `HOSTS` / `DISPATCH` / `REFS`；守卫读产品面的单源，不另立白名单。`precommit` 今天指向旧树的同名文件，翻面时随 T18 改指这一处）

#### Steps
- 写动词集与值域的 pin — checkable: 八值齐；每个旗标的取值形状在声明面；`--type` 的六值
- 写薄壳的判据 pin — checkable: 每条壳的实现体里没有文件读写、没有判定、没有字符串拼装（扫 import 面与调用面：壳不 import `node:fs`、不 import `run/gate`、不 import `env` 的 IO 面——`env/workspace/base-artifact.ts` 的写入口与 `env/process/child-runner.ts` 的 spawn 面；`base` 与 `init` 只 import 注入实例的类型，实例是 `Env` 的成员、壳里与 `src/bin.ts` 里都不构造；也不在输出前拼字节）；行数只在评审面陈述，不进套件——把一条诊断换成指标，后续实现者会去压行数而不把判定挑出去
- 写三件事的 pin — checkable: 每条壳的调用面只有一个入口（一个 `run/` · `docs/` · `env/` 的方法），`schema` 壳是唯一的例外——它的两个入口（`Documents#skeletonAt` 与 `Documents#projectOf`）由 `--output` 的旗标值一次分派（值分派不是判定），无第二层判断分支；它不 import `node:fs`，也不 import `env` 的写入口（落盘能力由 `Documents` 持有，壳只管把回显串原样输出）；输出只经 `Cli#report(outcome)` 一次（值全部来自那一个入口，壳不拼字节）；**行集由回值携带、壳不重算**（`checked` 从 `advance` 或 `previewOf` 的同一份回值里取出后交 `route`）；`--dry-run` 向 `Run.previewOf`、其余向 `Run.advance`——这一分叉只读旗标值，不读域事实；真派发路径的拒绝只调 `Run.advance` 一次（`blocked` / `held` 两个变体由它原样交 `Cli#report`，壳不补判定）；`--dry-run` 路径只调 `Run.previewOf` 一次（`kind` 各值由对应渲染入口接住，壳不自取裁决、不跑波门）、零 `run/gate` import
- 写 `init` 壳接线的 pin — checkable: 注入的 step runner 记下 `onStep` 的调用序（每步一次、在 spawn 之前），渲染器拿到的两个 writer 各与 `Cli#report` 的那一对引用相等（stdout 面 / stderr 面各一次）；首败时首败报的 `exit <code>` 取 `#apply` 回值的 `exitCode`（把回值改成别的码 ⇒ 该行跟着变），且首败报只出现一次、之后的步骤行零出现；**流分工一条**：首败时 stdout 只含进度行、失败三行全在 stderr（把首败报改走 stdout ⇒ 该条红）
- 写错用与失败字节的成对 pin — checkable: 三条成对臂落在声明面所在的那两层，不落在 run body 层。**解析层**：`cdd base set` 缺 `--plan` ⇒ `error: required option '--plan <path>' not specified`、给出即通过；`cdd schema get` 缺 `type` ⇒ `error: missing required argument 'type'`、给出即通过；`cdd base --plan <p>` ⇒ `error: unknown option '--plan'`（`--plan` 只在 `set` / `get` 叶上）——三条都断「单行、无 usage 首行、exit 2」。**条件必填层**：`cdd review --type wave` 缺 `--plan` ⇒ `error: --plan required when --type wave`、带上即通过（拼法取自 `REQUIRED_GROUPS` 那一行，不手写）。**run body 层**（字节在 T15 的 `usage.ts`）：`cdd board --dry-run` 与 `cdd schema get plan --dry-run` ⇒ 作用域拒绝那一格（usage 首行 + `error:` 行 + exit 2）；`cdd board` 无 `--plan` / `--spec` ⇒ `error: cdd board: pass --plan and/or --spec` 且 exit 2；`cdd schema get plan --output skeleton`（缺 target）⇒ `error: cdd schema get --output skeleton: missing <target>` 且 exit 2；`cdd schema get plan <target>`（多余 target）⇒ `error: cdd schema get: unexpected <target> — …` 且 exit 2；`cdd base set --plan <…> --base <请求基>` 在既有产物的基是另一个基（探针里存储基 `develop`、请求基 `release`）且未带 `--force` 时打印 `error: cdd base set: base already set to develop — pass --force to override` 且 exit 2——断的是**存储基**那一字节，把 `<existing>` 印成请求基即红；带上 `--force` 则改写并 exit 0；`cdd implement --plan <…> --tasks <id>` 在计划里没有该任务时打印 `error: cdd implement: task <id> not found in the plan` 且 exit 2；**同一层的第二形状也各一条臂**（把它们折成 usage 首行 + `error:` 那一形即红）：`cdd board --plan <不存在的路径>` ⇒ stdout 空、stderr 恰一行 `cdd board: no docs match --plan <路径>`、exit 2；`cdd board --plan <不存在的路径> --spec <另一份不存在的路径>` ⇒ 同一行里两项按 ` and ` 连接、exit 2（双旗标这一形状旧测试未盖，旧行为既有）；`cdd board --plan <读不出的路径>` ⇒ 单行 `cdd board: cannot read --plan <路径>`、exit 2；`cdd base get --plan <…>` 在无产物时 ⇒ 单行 `cdd base get: missing or corrupt base artifact at <仓库相对路径>`、exit 2——四条都断「无 usage 首行、无 `error:` 前缀」；**「无可派发帧」这一成员不在这组真跑臂里**：它在本树上没有 argv 可达输入（见本片 Produces 的具名缺席），臂以手写声明值直接喂 `UsageFace#report`、断 `{stream, text, exitCode}` 三件（与 T15 的每成员臂同形），端到端无格；把 `usage` 面的任一行字面改一处 ⇒ 对应那条 pin 红（字节的载体只有 `surface/render/usage.ts`）
- 写声明面与 `UsageReason` 对齐的 pin — checkable: 这个 union 的字节取用面只有 `surface/render/usage.ts` 的字节表一处（T15：板面「未命中」/「读不出」· `base get`「缺失或损坏」· 「无可派发帧」这几族不落在命令树的任何一行声明上，唯一取用者就是那张表）；「无可派发帧」在本树上无可达输入（见本片 Produces 的具名缺席——它的 producer 落点仍须可解析，端到端仍无格）；`declare.ts` 的旗标行与 `REQUIRED_GROUPS` 行**只声明、不供 body 层的填充值**（填充值由产出成员的那一处从 argv 侧输入取——旗标拼写取那一项的键、命令路径取命令字本身）、**不绑 reason**——给那两行绑一个 reason 字段即无人读的死字段（解析层与条件必填层的报文在解析期由 commander 与 group 钩子产出，不经这个 union）；`SCOPE_ROWS` 的每行翻出的成员都是「作用域拒绝」那一个（行集从纯命令的 `--dry-run` 声明派生，不手写命令名）；**「表与成员集逐值相等」不在这里重断**（T15 的每成员臂已经断「字节表的键集 = 成员集」，那一臂是 W9 当波唯一的判者；重写一条只会诱使后续把那条当重复删掉）——本条加的是另两面：一行 `producer` 的落点可解析，以及 `SCOPE_ROWS` 每行翻出的都是「作用域拒绝」那一个；**生产者落点可解析**：`USAGE_BYTES` 每一行的 `producer` 按声明的模块路径取到模块、按符号名取到值（指向一个不存在的符号即红）——这一条把字节、成员与生产者三面合成一处；另外一条成对臂把两层的形状分开记：`cdd implement` 缺 `--tasks` 走解析层单行（`required` 标记），`cdd review --type wave --plan <…>` 缺 `--tasks` 走 body 层两行（usage 首行 + `error: cdd review --type wave: missing required --tasks <n|n,n,…>`）——**这一条必须带 `--plan`**：不带 `--plan` 时先被 `REQUIRED_GROUPS` 钩子拒成单行 `error: --plan required when --type wave`（group 层的那一条臂就在上一句中），按字面写成「`cdd review --type wave` 缺 `--tasks` ⇒ 两行」会在正确实现上红；两层各有自己的输入，同一旗标在两层的字节不同是两层各自的形状，不是矛盾
- 写 dry-run 接线的 pin — checkable: 逐 `kind` 各一条——通过形态：`cdd implement --plan <…> --tasks <…> --dry-run` 的 **stdout 恰为题头 + 五类行**（零 `checked:` 行、零 `next:` 行），`checked:` 段走**诊断流**（与真派发同一个流，字节与真派发那一段相同），零写、零 spawn 且 exit 0；持有形态：另一进程持有 in-flight 时同一条命令的 stdout 以 `lock:` 行（或 `kind: corrupt` 且锁仍在时追加的那一行）与 `checked:` 段收尾，零写、零取锁、零 spawn 且 exit 1；阻断形态：结构腿拒绝的树上同一条命令的 stdout 以拒绝行、detail 段与 `checked:` 段收尾，零写、exit 1；line 腿拒绝形态：split 树上同一条命令（请求集是派生波的真子集）⇒ stdout 空、stderr 首行 `cdd implement: cannot dispatch a implement round — split · next: …` 后接 `graph:` / `wave board:` / `progress:` 三段与 `checked:` 段（与真派发同一份字节）、exit 1，零写、零 spawn；错用形态：空树上 `--dry-run` 与 `--tasks <计划外的 id> --dry-run` 各一条 ⇒ stdout 空、stderr 两行（usage 首行 + `error: …`）、exit 2，零写；各条读的都是真派发要用的同一份裁决（`Run.previewOf` 与 `Run.advance` 对同一棵树给出同一个结论，被拒时两个入口的 `kind` 逐字相同——`held` / `blocked`，line 腿那一支在 `previewOf` 上是 `refused`、在 `advance` 上是 `blocked` 而字节相同；注入记数的写面与 `ChildRunner` 替身计数全零）
- 写退出码的 pin — checkable: 正常 0 · 拒绝 1 · 错用 2 · 未知命令 2，各一条
- 写 help 与 usage 的 pin — checkable: `--help` 形面与 usage 字节；子命令树可读；**两处同源**：`cdd board --dry-run` 与 `cdd schema get plan --dry-run` 的 usage 首行逐字节等于同一命令节点的 `--help` 首行（两个纯命令各一条臂，只比首行不比整篇 help；把 `usageLineOf` 改成另一句 ⇒ 两条臂同时红——这是 T15 那条注入面的真命令对偶）；对账器的 `--help` / usage / 错用码 2 三格由本任务接线（它们是 `entry` kind，字节比在 T17 收口）
- 接骨架落盘那一格 — checkable: 用**进程内的壳**判「路径回显了、文件没写」——壳 + 注入的 `Documents`（收真的 `env.workspace#writeTextAt`）跑一次 `schema get <族> --output skeleton <target>`，目标文件被写出、非空、且字节与 `Documents.skeletonAt` 的那一份相等，`skeletonAt` 只被调一次；把壳里的 `skeletonAt` 换成只回显路径而不落盘的假实现 ⇒ 该条红。进程级的落盘事实（`f3.skeleton-landing` 格，`entry` kind）在 T17 与其余 entry 格同批比
- 补 body 层与 `--help` 的语料格 — checkable: 名册里 `f1.schema-get.refusal` 不再是 `not-applicable`——它拆成 `missing-target` 与 `extra-target` 两族，每族的 stdout / stderr / 退出码各一行且 producer 落点非空；`board` 的四族（`scope` · `no-flags` · `no-match` 含双旗标那一条 · `unreadable`——这一族的探针用 `fixtures/trees.ts` 的读不出旋钮造一个存在而读不出的目标，录到的 stderr 恰为 `cdd board: cannot read --plan <路径>`，与 `no-match` 那一族的 `no docs match` 字节不同）· `schema get` 的 `scope` 族 · 计划外任务的三族（两行形，带 usage 首行；`implement` 那一格的探针是 `implement --tasks <计划外 id> --plan <…>`，不带 `--type`——它没有这个旗标，带上只会录到解析层的 `error: unknown option '--type'`）在册；**「无可派发帧」不在册**：那条字节在本树上没有触发点（波门 line 腿先以 `split` 拒绝，frontier 非空则派发或被 hop 拒绝），语料不为它开格、名册里没有它的行，它的判者只有本任务那条手写字面单元臂；面 2 的 `--help` 族按顶层八节点与四个嵌套叶各一格，每格的 usage 首行与该节点 `--help` 首行逐字节相等（把 `usageLineOf` 改成另一句 ⇒ 那几格同时红）；把任一新族的 `task` 从名册删掉 ⇒ 该格红（不是 skip、不是 `todo`）；新增族改动了语料的格集 ⇒ 本步结束前跑一次录制（`record.ts`），让新族在录制件里有条目（否则它们报「the baseline carries no entry」）；把读不出旋钮关掉（目标存在且可读）⇒ `f1.board.refusal.unreadable` 那一格红，不再与旧树字节相等；**预览面的 dry-run 拒绝与错用各开一族**——`f7.preview.refusal.split`（split 树上 `--dry-run`：stdout 空、stderr 是拒绝行 + 三段波板 + `checked:` 段、exit 1）与 `f7.preview.usage.missing-plan`（空树上 `--dry-run`：usage 首行 + `error: cannot read file: …`、exit 2，与 `f7` 已存在的六个通过 / 持有 / 阻断格不同形），两族各录三流；名册（`grid.ts` · `GRID-WIRING.md`）同批给两族各一行（producer 落点 `surface/render/route.ts#refusalBlock` / `surface/render/usage.ts#UsageFace`，接线任务本片）；语料的格集因此再变一次 ⇒ 本步的重录（`record.ts`）同批把这两族写进 `baseline/`
- 注册 `seam` 的 driver — checkable: `NEW_TREE.kinds()` 本波含 `seam`、仍不含 `entry`（`entry` 的注册波是 T17）；名册挂给 T11 · T14 · T15 · 本片的 `seam` 格在本波全部派生成已接线并逐字节比、零差异；把 `NEW_TREE` 的 `seam` 行删掉 ⇒ 这些格退回具名延后并点名 T16（不是差异、不是缺格）；一条 `seam` 读数全程 `spawn` 计数为零（注入的派发结论与 step runner），且读数带 stdout / stderr / 退出码三件
- 重录基线 — checkable: 跑 `node --experimental-strip-types packages/cdd-engine/tests/parity/record.ts` 后，本片 producer 名下的格（含 `entry` 类：它们的 producer 在本波落地，状态前进到已接线，读数仍由具名延后兜住）在录制件里的状态是已接线（不再是 GAP），期望字节与重录前逐字节相等
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/surface tests/parity` 绿（对账器按 T2 的三态口径加 T8 的具名延后那一档：已接线的格零差异、未接线的格计入 GAP、kind 的注册波未到的格计入具名延后，三者都不判红；本片的 `seam` 格在本波 producer 与本波注册的 driver 一起派生成已接线并逐字节比（T11 · T14 · T15 落地的那几格在这一波首次读到真读数——`seam` 的注册波就是本波），`entry` 格读作具名延后、点名 T17，由 T17 收口）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
pin 齐（动词集与值域 · 壳零文件 IO 零判定零拼装 · 壳调用面单入口（`schema` 按 `--output` 的旗标值分派到 `skeletonAt` / `projectOf` 两个）· 四个退出码 · help/usage 字节 · 错用与失败字节的成对臂（解析层的缺 `--plan` · 缺 `type` · 未知旗标，条件必填层的 `REQUIRED_GROUPS` 臂，body 层的作用域拒绝与第四族第二形状含「未命中」的双旗标臂）· 声明面与 `UsageReason` 的对齐一条（取用面只此一处、表与成员集的相等断在 T15、每个成员的生产者落点可解析、`SCOPE_ROWS` 每行翻成「作用域拒绝」，声明面只声明、不绑 reason、不供 body 层拼写）· dry-run 接线逐 `kind` 一条（`pass` · `held` · `blocked` · `refused` · `usage` · `read-failure`，其中 line 腿的拒绝与装配层两族各有自己的一族语料格））；三件事的入口面含 `env/`，`base` 与 `init` 的产物面实例由 `Env` 持有、经 `Cli` 传入壳（壳里零 `new`，这两个实例也不在组合根里 new，一条能力只一条实例路径）；八条壳全部只经 `surface/index.ts` 的 `Cli` 对外；骨架壳的落盘只经 `Documents.skeletonAt`、json 面只经 `Documents.projectOf`（渲染与写盘都不在壳里，写盘唯一入口是 `env.workspace#writeTextAt`）；错用与失败字节只经 `surface/render/usage.ts`，基冲突谓词只在 `BaseArtifact#set`。本片的对账格分两类：`seam` kind 的那些格（派发回合 · 拒绝路 · 带注入缝的命令面）在本波 producer 落地后派生成已接线并逐字节比（`seam` 的注册波就是本波：本波在 `harness.ts#NEW_TREE` 注册它一次，`REGISTRATION_WAVES` 的那一行由 T8 记下、本片不改；T11 · T14 · T15 落地的那几格也在本波首次读到真读数），零差异；`entry` kind 的那些格（八命令面 · `--help` / usage / 错用码 2 · 本片新补的 body 层族与每节点 `--help` 族 · 骨架落盘 · 板面各族 · 预览三块）读作**具名延后**——`REGISTRATION_WAVES` 把 `entry` 的注册波记在 T17，T8 已退掉 T2 的占位驱动，落地产 producer 也不改变这一点；进程级的字节与落盘事实由 T17 收口。本波判的是壳的调用面（三件事）、usage 字节表与声明面；语料侧另判「每一条真会印字节的合法输入都有格」——`schema get` 的缺 target 与多余 target 各一族 · 两个纯命令的作用域拒绝各一族 · `board` 的无旗标 / 未命中（含双旗标 ` and ` 形）/ 读不出各一族（「读不出」由夹具的读不出旋钮造一个存在而读不出的目标，与「未命中」那一族字节不同）· 计划外任务的三族（`implement` 那一格不带 `--type`，它没有这个旗标）· 面 2 的每节点 `--help`，都不靠一个笼统的「拒绝」格兜住。**「无可派发帧」不在语料里，是具名缺席**：那条字节在本树上没有触发点（波门 line 腿先以 `split` 拒绝），名册不为它开行、它的唯一判者是本任务的手写字面单元臂，T17 的「GAP 空 · 具名延后空 · 缺格空」因此不对它作任何声称。

#### DependsOn
12, 13, 15

### Task 17: 组合根与对账首绿

#### Objective
把四片接成一棵树：`src/bin.ts` 成为唯一组合根，具体类在此 new，其余全部经构造参数收协作对象。本任务的终判是**对账器第一次全绿**——那就是「复刻成立」的证据。

#### Files
- Modify: `packages/cdd-engine/src/bin.ts`
- Create: `packages/cdd-engine/src/__tests__/composition.test.ts`
- Create: `packages/cdd-engine/src/__tests__/smoke.integration.test.ts`
- Modify: `packages/cdd-engine/tests/parity/grid.ts`（本片各格的名册行；注册波表不在这里，在 `harness.ts#REGISTRATION_WAVES`）
- Modify: `packages/cdd-engine/tests/parity/harness.ts`（`entry` kind 与组合根接线同批就位）
- Modify: `packages/cdd-engine/tests/parity/GRID-WIRING.md`（本片各格的名册行）
- Modify: `packages/cdd-engine/tests/parity/parity.test.ts`

#### Consumes
- 四片的入口（`Env` · `Documents` · `Run` · `Cli`）· spec §2.2 的八个面

#### Produces
- `src/bin.ts`：唯一组合根，构造 `Env` → `Documents` → `Run` → `Cli` 并接线；它同时是 `entry` kind 的读面——`REGISTRATION_WAVES` 把 `entry` 的注册波记在本波，本波在 `harness.ts#NEW_TREE` 重新注册 `entry`（T8 退掉了 T2 的占位驱动），组合根接线后这些格从具名延后翻成已接线（板面各族 · 预览三块 · 八命令面 · `--help` / usage / 错用码 2 · 骨架落盘都在这一批），`NEW_TREE.kinds()` 与注册波表的键集也在本波合上，这是本任务的对账首绿能到来的前提；同批把 `parity.test.ts` 的登记断言换回 `toContain("entry")`（T8 换向时留下的退回点，两次成对——断言从头到尾都在，方向随注册波走）；`UsageFace` 的 usage 首行面也在这里注入（取值是 `surface/commands/projection.ts#usageLineOf`，T16）——`surface/render/usage.ts` 因此不持那一行的字面，两行族的首行与命令节点的 `--help` 同源；导出的 `main` 写成箭头常量（`export const main = …`，不是裸 `function`——后者会撞 `check:no-bare-functions`），可被 `node src/bin.ts` 直接跑（tsx 或编译后）
- `Documents` 的三件构造入参在组合根一次给齐：`today`（当天，从 `env.process.clock#dayOf` 取一次传进去——`Documents` 只收下、不自己读时钟，骨架的 `date:` 行由此而来）、`readText`（`env.workspace#readText`）与 `textWriter`（`env.workspace#writeTextAt`）；骨架装配器由 `Documents` 构造一处，组合根不 new 它（`skeletonAt` 的落盘因此只经那一个入口）；派发那一路的两个面也在这里接线：`Run` 的 `Lifecycle` 收 `surface/render/brief.ts` 的 brief 面与 `env.workspace#writeText`（T3，brief 落工作区），`surface/render/preview.ts` 收 `Run.previewOf` 的返回值
- `composition.test.ts`：组合根是唯一 new 四片入口处（扫 `src/**` 的非测试文件，`new Env` / `new Documents` / `new Run` / `new Cli` 只在此出现——四片各一个类名，扫描名单与切片集逐值对应），且 `Provisioner` 与基产物读写只在 `env/index.ts` 的 `Env` 构造处实例化——组合根与 `surface/**` 都不 new 它们（一份能力一条实例路径）
- `smoke.integration.test.ts`：与旧脚本同形的一条集成测试——起 `src/bin.ts` 的真子进程，断言 `--help` 面与 `--dry-run` 的五类行，零仓内写入。它占住 `packages/cdd-engine/package.json#scripts.smoke` 在翻面后要指向的靶子（T18 只改指向，不删行）

#### Steps
- 接四片 — checkable: `node --experimental-strip-types src/bin.ts board --help` 或经 `tsx` 跑通一条命令，退出码 0
- 写组合根唯一性 pin — checkable: 除 `src/bin.ts` 外，非测试文件里没有 `new Env` / `new Documents` / `new Run` / `new Cli` 的调用；`Provisioner` 与基产物读写不在 `src/bin.ts` 与 `surface/**` 里 new（只在 `env/index.ts`）
- 写新树的 smoke 集成测试 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/__tests__/smoke.integration.test.ts` 绿，且它起的是真子进程（假 spawn 不算）
- 对账器接新树一侧 — checkable: `pnpm -C packages/cdd-engine exec vitest run tests/parity` 对八面逐格比
- 收敛差异 — checkable: 差异格数逐轮下降至零；**每一处差异都按旧行为改新树**，不按新树改基线（改基线即自欺，基线是证据）
- 对账首绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run tests/parity` 全绿，且三张空集同时成立——GAP 集合为空（有就说明那一面从未被比过，全绿是空真）· 具名延后集合为空 · 缺格集合为空；本波是 `entry` kind 的注册波（`REGISTRATION_WAVES` 里它记在 T17），`entry` 的格在此从具名延后翻成已接线并逐字节比，`NEW_TREE.kinds()` 与注册波表的键集逐值相等；同批把 `parity.test.ts` 的登记断言换回 `toContain("entry")`（T8 那一笔的成对另一半，不删断言）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
`node`（或 `tsx`）能跑通八条命令且退出码与旧树一致；组合根唯一性 pin 绿；`src/__tests__/smoke.integration.test.ts` 绿；对账器全绿（八面逐字节，GAP 集合为空）；两棵树各自的套件同时绿。

#### DependsOn
8, 16

### Task 18: 翻面

#### Objective
一波之内的原子翻面：入口与构建指向 `src/`，旧树整棵删除。顺序固定（spec §3.3），任何一步漏掉都会留一根脐带。

#### Files
- Modify: `packages/cdd-engine/tsconfig.json`
- Modify: `packages/cdd-engine/tsconfig.build.json`
- Modify: `packages/cdd-engine/vitest.config.ts`
- Modify: `packages/cdd-engine/package.json`
- Modify: `package.json`（`scripts.typecheck` 去掉旧树工程与 `tsconfig.src.json` 那一条 · `scripts.check:no-bare-functions` 的扫描根 · `scripts.precommit` 三条守卫路径改指 `src/`）
- Modify: `packages/kairos/tests/`（8 个文件的 import · 用到的导出 · 注释里指向旧树的路径举例）
- Modify: `scripts/__tests__/next-loop-twin.test.ts`、`scripts/__tests__/journey-twin.test.ts` 及其路径常量与源码文本臂（前者那三处符号断言改指新树的落点面，见本任务 Steps 的处置）
- Modify: `scripts/lib/scan.ts`（注释里那条举例的旧树路径）
- Modify: `README.md`、`README.zh-CN.md`、`packages/cdd-engine/README.md`、`packages/cdd-engine/README.zh-CN.md`、`AGENTS.md`
- Modify: `docs/diagrams/src/*.json`（六份）
- Delete: `packages/cdd-engine/src-next/`
- Delete: `packages/cdd-engine/tests/parity/`
- Delete: `packages/cdd-engine/tsconfig.src.json`（两树共存窗口的脚手架工程：它的存在理由只到翻面为止——翻面后引擎主工程的 `include` 就是 `src`，两份同文件集的工程让 `typecheck` 的答话人不再唯一）
- Delete: `packages/cdd-engine/src/__tests__/tree-separation.test.ts`（两树禁门：它的两条断言都枚举两棵树，主体之一消失后第二条只能抛 `ENOENT`）
- Delete: `packages/cdd-engine/tests/support/module-specifiers.ts`（只被上面那份禁门引用的说明符扫描器）

#### Consumes
- spec §3.3（固定序）· §3.4（零残留的范围与「已是生成物还是手维护」的分界）
- 旧树的 `precommit` 三条守卫路径（`face/__tests__/channel-closure.guard.test.ts` · `face/__tests__/words.guard.test.ts` · `session/__tests__/handoff-plane.guard.test.ts`）与它们在新树的三个同名落点（T16 · T14 · T12）

#### Produces
- 编译面（`rootDir` · `include` · `exclude` 三键）/ 测试 include / smoke 脚本 / 零裸函数扫描根全部指向 `src/`：`package.json#scripts.smoke` 改指 `src/__tests__/smoke.integration.test.ts`（T17 交付的那一件——改指后它仍收集到一条真子进程集成测试，不是指向一个空靶子）；零裸函数扫描根去掉旧树那一段（`src` 在 T1 已加入）
- `tests/parity` 的 include 与它的 tsconfig 工程同批删除；对账器与基线随之销毁
- 树外测试面与五份手维护文档改指新入口；六份图源改真
- 三条守卫改指新落点（不是删掉三条路径）：`precommit` 的 `src/surface/commands/__tests__/channel-closure.guard.test.ts`（T16）· `src/surface/words/__tests__/words.guard.test.ts`（T14）· `src/run/dispatch/__tests__/handoff-plane.guard.test.ts`（T12）
- 树外消费的符号改指清单（每一个都有新落点，没有一个是「删掉 import 即可」）：`SKILL_ANATOMY` → `docs/identity/skill-anatomy.ts` · `HOSTS` / `HostId` / `HOST_IDS` / `REFS` / `DISPATCH` / `HostDetect` → `env/process/host.ts` · `ENGINE_RUNTIME` 不重建（那个聚合体没有主人）：树外消费者真正读的两个事实各有已交付的落点——`docRoots` → `env/paths/doc-roots.ts#DOC_ROOT_SEGMENTS`（T3 交付，`DocRoots` 的构造输入）、`handoffNamespace.workspaceRoot` → `env/workspace/workspace.ts#WorkspaceRoot.DEFAULT_SEGMENT`（T3 交付），`packages/kairos/tests/skill-surface-consistency.test.ts` 的 import 改指这两个常量——在 host 模块里重拼这两份事实就是第二份拼写（撞 T3 的一个事实一个拼写），把 `contextContract`（家在 `surface/commands/declare.ts`）搬进去又是 `env → surface` 的反向边（撞 T5 的 `env/` 对 `surface/` 零 import） · `BASE_ARTIFACT_FIELDS` → `env/workspace/base-artifact.ts` · `Translator` → `docs/identity/translate.ts` · `GUARD_BAN_WORDS` / `CAPSULE_WORDS` / `ISSUE_TYPES` / `Words` → `surface/words/words.ts` · `CLI_COMMANDS` / `ARGV_CHANNEL` → `surface/commands/declare.ts` · `IssueBodyRenderer` → `surface/render/issue.ts` · `MAX_TASKS_PER_WAVE` → `docs/judging/wave-width.ts` · `REVIEW_CYCLE_CAP` → `run/advance/next.ts`（与 hop 的 `soft-cap` 行同住，T13 的 Produces 认领；`scripts/__tests__/next-loop-twin.test.ts` 读的正是这一处） · `CliLifecycle.LOGS_DIR` → `env/workspace/round-log.ts` 的 `RoundLogLayout.SEGMENT`（工作区相对日志目录名的单源；`env/workspace/workspace.ts` 的 `Workspace.LOGS_SEGMENT` 是它的别名，不是第二份拼写、也不是第二个落点；树外消费者 `scripts/__tests__/journey-twin.test.ts` 读的是这个静态常量、不是任何方法，它两处路径归一化都取它）——这一行点的是 T3 已交付的常量名，**不新造 `LOGS_DIR`**：本任务的 Files 里没有一个 `src/**` 文件，为一个改指而在旧树拼写上新增一个导出，会让「工作区相对日志目录名」在树上出现第二种拼写
- `tests/parity/` 整个目录删除（不是只删 include）：它 import 旧树，留着就撞本任务自己的零残留验收
- 两树禁门与它的扫描器随共存窗口一起销毁：`src/__tests__/tree-separation.test.ts` 与 `tests/support/module-specifiers.ts` 同批删除——禁门的正控是对账器（spec §3.1），对账器与旧树在同一个删除步里销毁，禁门因此没有「留一条惰性守卫」这个选项

#### Steps
- 改编译面与测试面 — checkable: `pnpm run typecheck` 绿（翻面后 `typecheck` 链只剩三处工程：引擎主工程 · `scripts` · kairos 测试；旧树位置换成 `src`，`tsconfig.src.json` 与它那一条同批删除）、`pnpm -C packages/cdd-engine exec vitest run` 收集到 `src/**` 与不再收集 `src-next/**`；`tsconfig.build.json` 的 `rootDir` / `include` / `exclude` 三键同批改指（`exclude` 成 `src/**/__tests__/**`），且 `pnpm -C packages/cdd-engine build` 之后 `dist/` 下没有 `__tests__`
- 改树外测试面 — checkable: `pnpm -C packages/kairos test` 绿（8 个文件里的 import 与它们用到的导出逐条改指，含 `ISSUE_TYPES` 与 `Words`）；同批去掉这些文件注释里指向旧树的路径举例（与 `scripts/lib/scan.ts` 那条同一口径——验收把注释也算在内）；`grep -rn 'src-next' packages/kairos/tests` 零命中（注释也算）；`pnpm exec vitest run` 绿（两个孪生与路径常量已改）——`next-loop-twin.test.ts` 那条源码文本臂的三处符号断言改成新树的落点面：`export const REVIEW_CYCLE_CAP` 原样保留，两个私有成员换成 `run/advance/next.ts` 的 `DISPATCH_REASON` 的 `softCap` station 行与评审闭合的 `done` 决策词（T13 的 Produces 认领这三处）；**不把旧私有拼写搬进新树**（spec §4 的再推导规则，且这两个名字在任何 Produces 里都没有主人）
- 改 `precommit` 的三条守卫 — checkable: `pnpm run precommit` 绿，且三个守卫文件都在新树上（改指到一个不存在的路径，precommit 会当场红）
- 改 smoke 指向 — checkable: `pnpm -C packages/cdd-engine run smoke` 收集到 `src/__tests__/smoke.integration.test.ts` 且 exit 0
- 改零裸函数扫描根 — checkable: `pnpm run check:no-bare-functions` 的扫描根不含旧树路径且零命中
- 改六份图源 — checkable: `docs/diagrams/src/*.json` 六份里旧树路径零命中；`pnpm run emit` 后 `docs/diagrams/*.html` 随之重生（不手改 HTML）
- 改五份手维护文档 — checkable: 五份文档里 `src-next` 零命中
- 删旧树与对账器 — checkable: `packages/cdd-engine/src-next/` 与 `packages/cdd-engine/tests/parity/` 都不存在；对账器的 include 与它的 tsconfig 工程已删（根 `typecheck` 链里不再点名它）；`packages/cdd-engine/tsconfig.src.json` 已删且根 `typecheck` 链里它那一条同批去掉——翻面后不再有两份同文件集的工程（引擎主工程 · `scripts` · kairos 测试），不两份并列
- 退役两树禁门与它的扫描器 — checkable: `packages/cdd-engine/src/__tests__/tree-separation.test.ts` 与 `packages/cdd-engine/tests/support/module-specifiers.ts` 都不在树上，且引擎套件里不再有枚举 `src-next/` 的用例；**禁门与两树共存窗口同生共死**（spec §3.1 的正控是对账器，对账器在同一个删除步里销毁），删树后**不补** `existsSync` 守卫换绿——守卫在树缺席时通过，正是 D101 与 spec §3.1 禁止的惰性判据；`src/` 这一向的禁令由「旧树不存在」在结构上保住，不需要一条永不再红的断言
- 零残留的机械判据 — checkable: `grep -rn 'src-next' packages/cdd-engine/src packages/cdd-engine/vitest.config.ts` 零命中——`vitest.config.ts` 里描述两树并存的注释与 `src-next/**` 那条 include 同批清掉，`src/**` 里产品注释举的旧树路径例子也在这一扫之内
- 重生生成物 — checkable: `pnpm run emit` 后 `pnpm run emit:check` 报 fresh
- 全绿 — checkable: `pnpm run validate` exit 0；`pnpm run check:dist-smoke` 绿（dist 由新树产出）
- 失败面的处置写进验收 — checkable: 若 `validate` 或 `dist-smoke` 红而对账器绿，处置是回 T2 的语料面补一种形态（因为这说明语料缺臂），**不改判据、不改基线**；若为了让翻面绿而动了消费者字节，按缺陷处理
- 提交 — checkable: `git log -1 --format=%s` 以 `chore(p39):` 起头

#### Acceptance
spec §3.3 的固定序逐项可核（本任务的 Steps 按它的序排列：编译面与测试 include 合一条、树外测试面与 `precommit` 守卫拆两条、两树禁门的退役紧跟在删树之后；末尾「失败面的处置」与「提交」是该波的收尾，不在那一序里）；旧树路径在代码 / 配置 / 脚本 / 图源 / 五份手维护文档 / 树外测试文件里零命中（历史文档的记录面除外，按 §3.4 的分界；注释里指向旧树的举例也算在内——`scripts/lib/scan.ts` 与 kairos 测试面同一条口径）；`packages/cdd-engine/tests/parity/` 不存在；`packages/cdd-engine/src` 与 `packages/cdd-engine/vitest.config.ts` 同在那条零命中的域内（两树禁门与它的扫描器已删，不以惰性守卫换绿）；`pnpm -C packages/cdd-engine run smoke` 绿；`pnpm run validate` exit 0；`check:dist-smoke` 绿；`emit:check` fresh；`pnpm -C packages/kairos test` 与根套件绿。

#### DependsOn
17

### Task 19: 相位收口

#### Objective
翻面之后把相位的账结清：changeset、切片不变量与入口的可核化、以及「翻面后无字节判者」这一事实的承接口。

#### Files
- Create: `.changeset/p39-rebuild-in-src.md`
- Modify: `AGENTS.md`（切片表与验证命令，若 T18 未覆盖）
- Create: `packages/cdd-engine/src/__tests__/slice-invariants.test.ts`

#### Consumes
- spec §4（再推导规则）· §5（代价：翻面后无字节判者）· Acceptance #5（不变量可陈述）

#### Produces
- changeset：`@oscaner-skills/cdd-engine` **patch**（D74：方法论契约未变，重建不改消费者字节）
- `slice-invariants.test.ts`：四个一级切片的入口类注释第一行存在且非空；`run/` 四段各一句；每片对外成员数 < 该片实现文件数（深度判据的可核形态）
- `AGENTS.md` 的切片表（若与 T18 的改指分开落地）

#### Steps
- 写 changeset — checkable: `pnpm exec changeset status` 认到 `cdd-engine: patch`，且 `packages/kairos` 无条目
- 写可删除性 pin（spec 验收 #1） — checkable: 三条各一处注册，且删掉一个单元只缺那一行——命令壳的文件集与注册表行集双向相等；板面每个投影行一处注册；判据每条一行规则（删一个壳文件 ⇒ 测试点名那一行注册，不多不少）
- 写不变量可核 pin — checkable: 抹掉任一切片入口类注释的第一行 ⇒ 测试红
- 写深度判据 pin — checkable: 给某片人为加十个对外成员而实现文件不变 ⇒ 测试红
- 更新 AGENTS.md 的目录表 — checkable: 表里五个面换成四切片，且每个切片一句不变量
- 全绿 — checkable: `pnpm run validate` exit 0
- 提交 — checkable: `git log -1 --format=%s` 以 `chore(p39):` 起头

#### Acceptance
changeset 一包 patch；四条不变量（四切片 + `run/` 四段）可核；深度判据可红；可删除性三处各一行注册（删一个单元只缺那一行）；`AGENTS.md` 的目录表与树上四切片一致；`pnpm run validate` exit 0。

#### DependsOn
18

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-25 | 首稿：18 个任务 / 11 波（宽 1·3·2·3·1·2·2·1·1·1·1）。W1 立编译面 / 测试面 / 双向禁门；W2 立对账器与 `env/paths+workspace` 与 `docs/grammar`；W3 `env/process+vcs` 与 `docs/identity+judging`；W4 `run/ledger` 与 `env/provision` 与 `docs/skeleton`；W5 `run/gate`；W6 `run/dispatch` 与 `surface/words`（词表的站名闭集与门行集同源，故依赖门）；W7 `run/advance` 与 `surface/render`；W8 `surface/commands`；W9 组合根与对账首绿；W10 翻面（十一序 · 旧树整棵删除）；W11 收口（changeset · 可删除性 · 不变量与深度的可核形态） | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-25） |
| v0.2 | 2026-11-25 | 评审轮一（F1–F11）落地：旧树未被任何任务消费的模块逐一定归属——判据族 / 协调器 / 解析面 / 投影 / 识别面 / lint 归 T6，载体行与产物读归 T7，预帧值 / 活性判官归 T12，单轮生命周期 / 目标类型表 / 行相位归 T13，命令树装配归 T16，宿主契约 / 时钟 / 子进程 seam 归 T5，基产物读写归 T3；T2 的基线改成 spec §2.2 八面逐格并带「格 → 接线任务」名册（未接线即红，禁止 skip）；T16 的三条纯命令产物面写出落点（基产物 → `env/workspace`、issue → `surface/render`、骨架 → `docs/skeleton`、时钟 → `env/process`）；T1 的编译面改为逐键照抄既有 `tsconfig.json` 只换 include（不设 `rootDir`，否则 TS6059），并去掉用例数快照；T18 补 `precommit` 三条守卫的改指与 `tests/parity/` 整目录删除，并列出树外符号的改指清单；T12 补结论派生三路；T14 与 T11 把站名闭集改成「`RowStation` 是 `PreFlightGateName` 的成员」（包含，不是相等）；T16 的薄壳判据回到结构性三件事，行数只作诊断 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.3 | 2026-11-25 | **编排者的结构变更（任务 id 集与 `DependsOn` 集是编排者写权，不经 fix 轮）**：fix 轮一（F1）把 20 个模块 8,484 行全部分发到位，但把 `contract/invariants.ts`（2,298 行）· `judge` · `doc` · `project` · `lint` · `translate` · 判据表全部堆进 T6——那不是「自带测试周期的最小单元」，一个 implement 轮吃不下、review 也审不动。拆法按「注册表跟它指向的策略类同住」这条判据：**T6 只留身份与登记表**（`identity/` 六件 · 判据零）· **T9 接判据的表与骨架**（`criteria` · `completion` · `wave-width` · `skeleton`）· **新增 T10 收判据引擎**（`rules` 注册表与它 `create()` 指向的 `invariants` 策略族 · `judge` 协调器 · `lint` · `selectors`）。T11 的门读 `Documents.judge`，故其依赖加 T10。重算：19 任务 / 12 波（宽 1·3·2·3·1·1·2·2·1·1·1·1）· 无悬挂边 · 无环 | Oscaner M. · Claude（kairos:cdd-plan 编排者 · 2026-11-25） |
| v0.4 | 2026-11-25 | **重编号（doc-contract `continuity` 不是规矩变更，是编号形态）**：v0.3 把新任务挂成 T19 放在文档第 10 位，`continuity` 要求编号按文档顺序自 1 连续，计划因此被 `CDD_BLOCKED: doc-contract` 拒一次。本轮按文档顺序全量重编号——判据引擎成为 T10，原 T10–T18 顺延为 T11–T19，`DependsOn` 与正文交叉引用同批重映射（一次性占位映射，避免二次改写）。结构零变：19 任务 / 12 波 / 宽 1·3·2·3·1·1·2·2·1·1·1·1，无环、无悬挂边 | Oscaner M. · Claude（kairos:cdd-plan 编排者 · 2026-11-25） |
| v0.5 | 2026-11-25 | docs-fix 轮二（F1–F7）落地：`TaskGraph`（旧 `session/graph.ts` 的四类边校验 · `batches()` · `frontier(done)`）落 T9 的 `docs/judging/task-graph.ts`，带「波宽只此一处派生」与「表与族同住」两条 pin——T11 的 `graph` 腿经注入的 plan read 读它的失败集，T13 的波次前沿改读它的 `batches()` 与 `frontier(done)`（T7 与 T9 同波且无边，新增任务属编排者写权，故落 T9）；对账器改三态口径 GAP · 差异 · 缺格，逐波只断言已接线格零差异与 GAP 集合同名册一致，「GAP 集合为空」归 T17，T9 / T15 / T16 的 `tests/parity` 命令随之同口径；T17 补 `src/__tests__/smoke.integration.test.ts`（真子进程 · `--help` 与 `--dry-run` 五类行），T18 的 `scripts.smoke` 改为改指并以「收集到且 exit 0」为判据；T15 补 `surface/render/route.ts` 作为 `next:` 的唯一拼装点并加单点拼装 pin；T1 把 `src` 加进零裸函数扫描根并加可红判据，T18 只去掉旧树那一段；T14 补 `ISSUE_TYPES` 与 `Words` 两个导出，T18 的改指清单与 kairos 测试面措辞同批补齐；T2 的 `GRID-WIRING.md` 进 Files，阻断面按格拆成一格一个接线任务；T18 补六份图源一步与 `scripts/lib/scan.ts` 注释一处 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.6 | 2026-11-25 | **编排者的结构变更（`DependsOn` 集归编排者）**：计划评审轮三（F3）指出 T15 的 `next:` 单点拼装以 T13 的 `NextHop` 为输入，而两者被声明为互不依赖——`run/advance` 又不许 import `surface`，hop 类型只能来自 T13，故这条边真实存在、只是漏了。补 `T13 → T15` 后重算：19 任务 / 13 波（宽 1·3·2·3·1·1·2·1·1·1·1·1·1），无环、无悬挂边。其余四条（`ClosedDocument` / `PathShape` 无落点 · T9 的波宽 pin 指到 T10 的表 · `tsconfig.build.json` 的 `exclude` · 四处注释里的旧树字面）是内容面，交 fix 轮 | Oscaner M. · Claude（kairos:cdd-plan 编排者 · 2026-11-25） |
| v0.7 | 2026-11-25 | docs-fix 轮三（F1 · F2 · F4 · F5；F3 已由编排者在 v0.6 补边）：`ClosedDocument` 与 `PathShape` 各得一条 Files 行并落 `docs/judging/`（`closure.ts` · `shape-rules.ts`）——闭包读是 `judge` 的闭包入参、`checked:` 面让位行（T11）与派发那一次读（T12）的唯一算处，T4 的 Consumes 遂删去它；T2 名册「站名与让位条件」那一格仍只挂 T11 一个接线任务并点名读值来源；T9 的波宽 pin 改成「`TaskGraph#batches()` 的批宽超 `MAX_TASKS_PER_WAVE` ⇒ 该批被点名」，规则 id 的成对夹具归 T10；T18 的编译面补齐 `tsconfig.build.json#exclude`（含 `dist/` 无 `__tests__` 的 checkable），树外测试面补注释清理与 `grep` 零命中判据，Files 里重复的 `package.json` 并成一行；T5 / T12 的锁持有者措辞与 T5 的 Produces 对齐。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.8 | 2026-11-25 | 开发期漂移回填（第一波 implement 撞出 · 编排者落地）：旧树 `src-next/__tests__/zero-dep.test.ts` 的 cutover 终态 pin 要求 `src` 平面不在包根，与本相位在 `src/` 重建正面冲突，导致第一波无法让引擎套件转绿（那套件里唯一红点）。Constraints 的「旧树零改动」补第二个例外，T1 的 Files 收下该文件、Steps 补一条只退役 `src` 腿的可红步骤（`config` 腿留活），Acceptance 收口到整棵引擎套件绿 | Oscaner M. · Claude（kairos:cdd-dev 编排器回填 · 2026-11-25） |
| v0.9 | 2026-11-25 | docs-fix 轮四（F1–F5 全部落地，未放宽判据）：T2 的「自身可红」改成不依赖新树 producer 的自证臂（同一场景旧树双录互比，改一份录制的一个字节即红），Acceptance 同口径收口，第一个接线格落地后已接线格的字节差异接上同一条红臂；面 1 的格文法写实成 `命令 × 路 ∈ {正常, 拒绝, 失败} × 流`，名册给拒绝路（T16 的壳 + T11 的门行）与失败路（T12 的终止因 + T16 的退出码面）各自的接线任务，不存在的路写「不适用」；T13 的 `line-phase` 收成零措辞，措辞只在 `surface/render/route.ts` 由 hop 拼出；T16 的三件事入口面补 `env/`，薄壳判据改判「不 import `env` 的 IO 面」，`base` 与 `init` 的产物面实例由组合根注入；Constraints 的设计输入改成 spec 的当前版本（不钉 v0.5 快照，差异以回填落地）。spec §1.3 的同口径回填留编排者。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.10 | 2026-11-25 | docs-fix 轮五（F1–F5 全部落地，未放宽判据）：T13 补 `wave` 的 Produced 面——`WaveGate#vet(requested, verb)` 五行齐 · 行序即判据 · 成因 token 只取 `DISPATCH_REASON` 的 line 腿，Steps 每个成因改成一条必报 + 一条邻居不报（宽 frontier + 子集请求必须报 `wave-too-wide` 而非 `split`），Acceptance 的「波宽三档」改成「波门五行的成对臂含行序」；T2 的名册把面 1 的拒绝路按成因各成一格（波门五行各一格 · 门口四站名各一格），接线任务收成单 owner（拒绝路归 T16 的壳，波门判定取 T13 · 站名取 T11 · 报文取 T14 作读值来源；失败路归 T12，退出码面取 T16 作读值来源），名册每格并写 producer 的落点（模块 + 导出名），「已落地」改读作「落点在树上且可解析」，漏接在它自己那一波就红；`Clock` 的 Produced 面含当前时刻与 epoch → ISO 两件能力，时钟 pin 只扫无参 `new Date()` 与 `Date.now()`，`Words` 收注入的时钟、自身零 `new Date(`；`base` 与 `init` 的产物面实例所有者改成 `Env`，组合根只造 `Env`，T17 的唯一性 pin 覆盖这两个实例。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.11 | 2026-11-25 | docs-fix 轮六（F1–F6 全部落地，未放宽判据）：T2 的失败路接线任务改成 T16 的壳一个（与拒绝路同形），终止因取 T12 的 `DispatchOutcome`、报文取 T15 的渲染面作读值来源——一格的三条流都由命令面产出，名册不再让只在第七波落地的终止因独自认领一族格；场景装配有了 owner：T13 新增 `run/advance/frame.ts` 的 `Frame#of(request)`（argv 侧输入 → 一帧：slug 判定 · 计划读 · 身份声明的 `doc-type:` 与 `program:` · 同名 spec 与 charter 链 · 目标 · 管线前沿四格 · `RunState` 与 router，经注入的 `Documents` 与 `Env` 取值），`Run.advance` 与 `Run.boardOf` 改收 argv 侧输入、T16 的 Consumes 改指这一处，附「同一 argv 两次装配字节相同」的 pin；`DISPATCH_REASON` 与 `WAVE_GATE_REASON` 及 hop 的 `reason:` 视图点名住 `run/advance/next.ts`，token 单源 pin 改判「表在 `next.ts`、`wave.ts` 里写一个成因字面即红」；`Clock` 补到两个后续读点——T11 的拒绝事实 `at` 与 T12 的 in-flight 起跑时刻（进程表答不出时回落注入时钟），各附一条零 `Date.now()` 的 pin；T18 的验收从「十一序」改成「spec §3.3 的固定序逐项可核」，Steps 前十条按那一序重排（图源在文档之前、smoke 与扫描根在树外测试面之后）；T17 的组合根唯一性 pin 的扫描名单补上 `new Documents`（四片四个类名）。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.12 | 2026-11-25 | **编排者的结构收口（用户裁定 A：停在评审七轮未收敛处，改结构而不是再叠 fix）**：四笔。① **T1 步序**——回填时我把「退役 `zero-dep` 的 `src` 腿」插在末尾，而第 4 步已接收集面、`src/` 一在包根那条 pin 就必红，于是第 6 步的「回到全绿」不可达；退役步骤提到第一步。② **T3 的两处外部事实改为构造入参**——`now: () => number` 与 `baseName: string`，必填无默认值，缺即抛：这样 T3 不再需要 T5 的 `Clock` 与 T7 的产物矩阵，**步序不可行从根上消失，且零加边、零移文件**（比原计划的「把两个叶子提到第一波」更省）。③ **对账器文件的归属**——T8 · T9 · T15 · T16 各补 `tests/parity/GRID-WIRING.md` 与 `parity.test.ts` 两条 `Modify`，接线格的写点不再没有落点。④ 去掉一条字面计数（`reviews` 改按 `TargetType` 类型派生）。波次零变：19 任务 / 13 波 / 宽 1·3·2·3·1·1·2·1·1·1·1·1·1 | Oscaner M. · Claude（kairos:cdd-dev 编排者 · 2026-11-25） |
| v0.13 | 2026-11-25 | docs-fix 轮七（F1–F6 全部落地，未放宽判据）：**骨架落盘有了具名主人**——T3 的 `Workspace` 加 `#writeText` / `#readText` 一对文本读写入口（与 `#writeJson` 同源、同一条路径拼写，`src/**` 里各只一处），T9 的装配器收注入的 `textWriter` 并由 `Documents` 构造一处，壳只调 `Documents.skeletonAt(type, target)` 一个入口（渲染 · 落盘 · 回显三件都在里面，壳零 `node:fs`），T2 的名册加「骨架落盘」一格（接线任务 T16、判落盘事实），于是「路径回显了、文件没写」在八面里有格会红；T3 的零时钟面收窄到本任务交付的三段，并点名 `env/process/clock.ts` 是 `env/` 内唯一读时钟处（T5）；**骨架日期有了合法载体**——`Documents` 的构造入参含 `today`，组合根从 `env.process.clock` 取一次传进去，T16 那句「系统时钟走 `env/process/clock.ts`」删去；T13 的 Produces 认领 `REVIEW_CYCLE_CAP`（与 hop 的 `soft-cap` 行同住 `next.ts`，树外消费者读这一处），T18 的改指清单把 `CliLifecycle` 那一行改成实际被消费的静态常量与落点 `env/workspace/round-log.ts#LOGS_DIR`；T4 的读取面改成「文本进、索引出」，读盘经注入的 `env.workspace#readText`；T3 的 Consumes 与 T11 的 Acceptance 把产物矩阵的家改指 T7 的 `run/ledger/artifacts.ts#ArtifactIdentity`。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.14 | 2026-11-25 | docs-fix 轮八（F1–F5 全部落地，未放宽判据）：**文本读写换了基准**——`Workspace#writeText` / `#readText` 与 `#writeJson` 不再共用一条拼写：JSON 面住工作区里，文本面从 `paths` 交付的 `RepoRoot`（工作区根携带的仓库基准）拼绝对路径，两个唯一消费者（骨架的 `target` · 物料读面的 `file`）本来都是仓库根相对的 `RepoPath`；旧写法把物料读拼成 `.kairos/<slug>/docs/…`（每次读都抛）、把骨架落盘撇进 `.kairos/<slug>/`（目标一个字未写而 stdout 回显一个没被写的路径）；T3 补一条「真 `RepoRoot` + 真 workspace 读一份 `docs/**` 得回字节、往另一份 `docs/**` 落一次文本后非空」的 pin；**骨架当天有了生产者**——`Clock` 补第三件能力 `dayOf(epoch)`（本地日 `YYYY-MM-DD`，旧树 `#getFullYear` 那一条老路），`isoOf(epoch)` 保留 UTC `toISOString` 形（`{startedAt}` 的字节靠它，两者不在日界互相切片派生），T5 的 Produces 与 pin 同批补，T9 / T17 的 `today` 改指它；**骨架尾随换行有了主人**——`compose` 出 `render()` 的无换行字节，`assembleAt` 补且只补一个 `\n`，T9 的落盘 pin 改成「与 `skeletonOf(type)` 加一个 `\n` 逐字节相等」；**孪生源码文本臂有了处置**——`next-loop-twin.test.ts` 那三处符号断言改指新树落点面（`export const REVIEW_CYCLE_CAP` 保留，两个私有成员换成 `DISPATCH_REASON` 的 `softCap` station 行与闭合的 `done` 决策词），T13 的 Produces 认领这三处、T18 的 Files 从「路径常量」扩到「路径常量与源码文本臂」，不把旧私有拼写搬进新树；**`HostId` 有了落点**——T5 的 Produces 点名 `HOST_IDS` 与从它派生的 `HostId`（住 `env/process/host.ts`），T18 的改指清单补齐。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.15 | 2026-11-25 | docs-fix 轮九（F1–F4 全部落地，未放宽判据）：**brief 的落盘有了主人、基准与拼写**——`Workspace` 保留两条文本落盘面：`#writeText(name, text)` 以**工作区**为基准并回传仓库相对路径（派发 brief 走这一条，`INPUT_WAVE_BRIEF` 的值就是这条回值）、`#writeTextAt(target, text)` 以仓库根为基准（骨架与物料落盘走这一条），对应的 pin 与验收按两条基准各写一条，并删掉那句「文本面两个消费者都在工作区外」的前提与「同一 slug 工作区里不出现同名路径」这条会反咬正确写位的括号；T13 的 `Lifecycle` 在派发前经注入的 brief 面与 `env.workspace#writeText` 落一次 brief、把回值交给 `DispatchValues` 的身份格，T15 的 brief 渲染器只出字节与名字、不碰磁盘，并补一条 brief 落地 pin（落在 `INPUT_WAVE_BRIEF` 的路径上、字节与渲染器产物相等、`--dry-run` 下不存在）；**命令面的错用与失败字节有了载体**——读 / 写 / 基冲突 / 计划读 / 骨架落盘各回一个声明过的结果值（T3 · T4 · T9 · T13 的 Produces 各一行），字节的唯一拼装点是 T15 新增的 `surface/render/usage.ts`（`UsageFace#report`），`base` 的 `--force` 谓词落 T3 的 `BaseArtifact#set`，壳只把值交出去，T16 补两条成对 pin（`cdd board --plan <不存在>` 与既有基不同且无 `--force` 的 `cdd base set`）；**`--dry-run` 有了生产者与抑制点**——`Run` 的成员集加 `previewOf(request)`（下一帧 · 宿主事实 · 预帧值；零写零取锁零 spawn），抑制住 `run/advance` 而非壳，T13 补 dry-run 抑制 pin、T16 补 dry-run 接线 pin，T2 的预览格点名 T13 为读值来源；**T1 的 `zero-dep` 退役步按已交付切分对齐**——它在闭合波由一次一行后续提交落地（Constraints 的第二个旧树例外为它而写），落地前引擎套件带那一条红，不搬进别的任务；T17 的组合根接线同批点名 brief 面与 `#writeTextAt`。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.16 | 2026-11-25 | docs-fix 轮十（F1–F5 全部落地，未放宽判据）：**`--dry-run` 的三张脸各得一个生产者与一条 pin**——`Run.previewOf(request)` 的回值改成带 `kind` 的声明值（`pass` 帧 · 宿主事实 · 预帧值，`held` in-flight 状态值，`blocked` 结构腿裁决与 detail 段），三值都由它内部那一次只读 pre-flight 得到（零写 · 零取锁 · 零 spawn）；`Preview` 点名三个入口（通过块 · 持有块 · 阻断块），`checked:` 行集的拼装落 `surface/render/route.ts`（题头与 per-rule 结果词取 T14 的 `WORDS` 的 `checked` 组，行取裁决自带的 `checked` 行集），T16 的 dry-run pin 补持有与阻断两态（零写、exit 1），T2 的预览格按 `kind` 各成一格；**`init` 的字节面有了主人**——T15 新增 `surface/render/init.ts`（预览块 · 真跑进度行 · 绿摘要 · 首败报），T8 的 `#apply(steps, onStep)` 收注入的进度面（`env/` 仍零字节），T8 补一条「预览与真跑只在步骤行与摘要行两处不同」的 pin，T2 的 `init` 格点名这个渲染器作 producer；**usage 面从逐行枚举改成声明值加派生映射**——`usage` 的 `reason` 是 `run/advance/frame.ts` 的 closed union `UsageReason`（缺旗标一族由 T16 声明面的旗标行与 `REQUIRED_GROUPS` 行逐行派生，缺子命令 / 缺 type / 缺 skeleton target / 多余 target / 作用域拒绝各族各占一成员），`UsageFace#report` 的映射分支集与成员集逐值相等，pin 补 `cdd base --plan`（缺叶子）与 `cdd schema get`（缺 type）两组成对臂，纯命令的 `--dry-run` 作用域拒绝落成声明面一行而不是 commander 的默认未知选项，行门族拒绝的措辞归 `route`、不在 usage 表里（一条字节一个拼装点）；**`zero-dep.test.ts` 的 `src` 腿改由 T18 删树消解**——T1 不再动旧树那个文件（Files 删去那一行，Steps 改成「记录现状、不开步」，Constraints 的第二个旧树例外随之删去，每波绿收成一条具名豁免，T1 与 T18 的验收同口径）；**brief 的写失败有了读法**——`Lifecycle` 收到写失败时不派发、孩子零起、账本与 attempt 不前进，值交给 `surface/render/usage.ts` 印出，附一条 pin。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.17 | 2026-11-25 | docs-fix 轮十二（F1–F6 全部落地，未放宽判据）：**`--dry-run` 的流过对齐旧树**——`Run.previewOf` 的三个 `kind` 各带那一次只读 pre-flight 的 `checked` 行集（三张脸同源），三块共用同一段字节而流按形态分：通过形态与真派发同走诊断流（stdout 恰为题头 + 五类行），持有与阻断走 stdout 并以 `checked:` 段收尾；`Preview#passBlock` 的入参不再带 `next:` 行以外的多写，T15 与 T16 的预览 pin 同批拆成这两条；**错用字节按答话人分三层**——解析层（required 旗标 · required 位置参数 · 未知旗标 · 多余位置参数，`declare.ts` 的 required 标记为唯一来源）· 条件必填层（`REQUIRED_GROUPS` 行）· run body 层（只有这一层进 `UsageFace#report`，形状是 usage 首行 + `error:` + exit 2），删掉 `cdd base: missing <set\|get> subcommand` 与 `cdd schema get: missing <type>` 两条到不了的字节（它们先被解析层拒），成对臂改落前两层；**`UsageReason` 的派生方向写死**——成员由 `run/advance/frame.ts` 认领、`declare.ts` 逐行取用，T16 补一条跨波对齐 pin；**持有块补上第四态**（`kind: corrupt` 而锁仍在时追加 `corruptLocked` 一行，T2 名册与 T14 词面同步点名它是与 `checked.inFlight` 两个面）；**`init` 首败报的 `exit <code>` 有了来源**——`#apply` 回声明值（`green` 或 `failed` 带 `index` 与 `exitCode`），渲染器入参补首个失败步的退码，T16 点名壳接线一处（流 writer 与 `onStep`）；**旧树唯一例外回到 spec**——T1 第一步真退役 `zero-dep.test.ts` 的 `src` 腿（Files 收该文件，Constraints 与 T1 Acceptance 的具名豁免随之删去，两棵树从第一波起都真绿）。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.18 | 2026-11-25 | docs-fix 轮十三（F1–F5 全部落地，未放宽判据）：**body 层的失败字节不再是单一形状**——`UsageReason` 增四个成员（板面的「未命中」与「读不出」· `base get`「产物缺失或损坏」· work 命令的「无可派发帧」），每个成员自带流、文本与退出码（`UsageFace#report` 的 `{stream, text, exitCode}` 逐成员各填一次，全表共用一句模板即缺陷）；板面两条与 `base get` 那条是单行、无 usage 首行、无 `error:` 前缀、exit 2，`无可派发帧` 单行、exit 1，四条都不折进 `error: cannot read file:` 那一形（旧树没有那一形）；T16 补这四族的真进程成对臂，T16 的对齐 pin 把取用面改成两处并集（`declare.ts` 的旗标行与 `REQUIRED_GROUPS` 行 + `usage.ts` 的映射表）与成员集逐值相等；**`issue render` 的 stdin 契约改回旧树**——三类违约一律 exit 1（拒绝，不是错用），多余键不是违约（`validateInput` 不查它，多余键仍 exit 0 并印出正文），三型改成畸形 JSON · 缺键 · 类型错，且畸形 JSON 一行、校验违约多行缩进是两种字节形态；**持有块的 corrupt+locked 形态进比对**——那一形态旧测试已带（`packages/cdd-engine/src-next/face/__tests__/cli.test.ts` 的 `keeps the in-flight arm's lock face on --dry-run for all three holding shapes` 一支），`lock:` 行与追加行随整条 stdout 逐字节比，损坏记录在临时目录就地 planted，不新增语料臂，删掉「这一行只由 T15 的预览 pin 判」那句（T15 的预览 pin 只判行序与词表来源）；**T15 卸掉解析层与条件必填层的臂**——那两组要在 W9 真跑 `cdd implement` / `cdd init` / `cdd base set` / `cdd schema get` 而命令树是 T16 的交付物，T15 只留不依赖命令树的 body 层映射断言，真跑命令断字节的臂在 T16；**`init` 首败报的流有了主人**——四个出口各带自己的流（预览块 · 进度行 · 绿摘要走 stdout 面，首败报三行走 stderr 面），渲染器收一对 writer，T16 的接线与 pin 同批改成两条流，首败时 stdout 只含进度行、失败三行全在 stderr，`exit <code>` 取自 `#apply` 回值。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.19 | 2026-11-25 | docs-fix 轮十四（F1–F4 全部落地，未放宽判据）：**四族新字节有了生产者**——`Run.advance` 与 `Run.boardOf` 的回值改成声明过的闭集（`{kind: "dispatch"}` / `{kind: "board"}` 各配一个 `{kind: "usage", reason}` 失败变体），「无可派发帧」由 `advance` 翻出、板面「未命中」与「读不出」由 `boardOf` 翻出，T13 补一条失败变体 pin（含「注入一个回 `null` 的读面，成员仍由 `run/` 翻出」）；`UsageReason` 的转译点写实成两处——`run/` 自己判得出的事实，与 `surface/render/usage.ts` 的 `FAILURE_REASONS` 表（`env` / `docs` / `frame` 交上来的声明失败值与 `BaseArtifact#read` 的 `null` 在这里翻成成员，`null` 只在入参域、不进字节表 `USAGE_BYTES` 的键），字节表的分支集与成员集逐值相等那条判的仍是后者，T15 的 pin 与验收、T16 的载体行同批收口；**`issue render` 的 Produces 回到旧树**——三类违约改成畸形 JSON · 缺键 · 类型错（含 `related`），「多余键不是违约」那一条保留；**形状按形状判**——usage 首行 + `error:` + exit 2 那一族的成员逐个点名（多余 target 与作用域拒绝也在其中），读失败族的两行形单写一句，四族单行形的定语从「旧树没有那一形」改成「这四族在旧树里没有那一形」；**对齐 pin 收成一处取用面**——`declare.ts` 的旗标行与 `REQUIRED_GROUPS` 行只供填充值、不绑 reason（绑了即无人读的死字段），T16 的 `declare` 行与验收同批改口，另补一条「同一 `--tasks` 在解析层单行、在 body 层两行」的成对臂。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.20 | 2026-11-25 | docs-fix 轮十五（F1–F4 全部落地，未放宽判据）：**每个 `UsageReason` 成员都点到一个生产者**——T13 的 `frame` 面把原来按产出点归族的写法换成逐成员的生产者名单：`run/advance/frame.ts#Frame#of` 认领缺旗标一族与「计划里无该任务」· `run/index.ts#Run#boardOf` 认领组合缺 / 板面「未命中」/「读不出」· `Run#advance` 认领「无可派发帧」· `docs/index.ts#Documents#skeletonAt` 认领缺 skeleton target · `Documents#projectOf` 认领多余 target · `surface/commands/projection.ts#ScopeGuard#rejectionOf` 认领纯命令的 `--dry-run` 作用域拒绝（行取自 `declare.ts` 的 `SCOPE_ROWS`）· `surface/render/usage.ts` 的 `FAILURE_REASONS` 认领读 / 写 / 基冲突与 `base get`；`skeletonAt(type, target \| undefined)` 与 `projectOf(type, target \| undefined)` 收得住「少 target」与「多 target」且各回一个 usage 值，`schema` 壳按 `--output` 一次值分派到这两个入口（值分派不是判定）；T15 的 `USAGE_BYTES` 每行加一列 `producer`，T16 的对齐 pin 增两条（每个 producer 落点可解析 · `SCOPE_ROWS` 每行翻成作用域拒绝）；**`base get` 的 `at <path>` 有了来源**——`BaseArtifact#read` 改回声明值 `{kind: "artifact", value} \| {kind: "absent", target} \| {kind: "corrupt", target}`（`target` 是基产物的仓库相对路径），裸 `null` 从 union、转译表、字节表与 T16 的载体行里一并消失，T3 的 pin 同口径改口；**板面「未命中」的填充值改成列表**——未命中项有序、成行时按 ` and ` 连接，T15 与 T16 各补一条双旗标臂（旧行为既有、旧测试未盖）；**F4 的相向指令收成一句**——填充值由产出成员的那一处从 argv 侧输入取（旗标拼写就是命令字本身），`declare.ts` 只声明、不供 body 层拼写，`run/` 与 `declare.ts` 之间因此没有依赖边，`frame` 先于 T16 落地也不撞墙。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.21 | 2026-11-25 | docs-fix 轮十六（F1–F3 全部落地，未放宽判据）：**`docs/` 的两个入口改回声明失败值**——`Documents#projectOf` 回 `{kind: "extra-target", target}`、`Documents#skeletonAt` 回 `{kind: "missing-target"}`（与 T4 的 `read-failure`、T9 的 `write-failure` 同一既有形态），`UsageReason` 成员的家仍只在 `run/advance/frame.ts`，于是 W3 / W4 的两个 docs 入口不靠一个四波后才存在的 union 命名成员、也不立 `docs → run` 的反向边（`docs/` 不知道轮次与 `next:`，spec §1.2）；两个值由 T15 的 `FAILURE_REASONS` 各翻一格，T6 / T9 / T13 / T15 / T16 五处的措辞与 pin 同批改口；**usage 首行有了单点派生**——`surface/render/usage.ts#UsageFace` 的构造入参收注入的 `usageLine(commandPath)` 面，字节表不持 `Usage:` 字面（W9 不再按填充值重拼那一行，表里的每成员臂只断自己的形状而不自证），派生点是 T16 `surface/commands/projection.ts#usageLineOf`（取命令节点 `helpInformation()` 首行，旧树 `face/cli.ts#Cli.#usage` 的那一句），由组合根注入；T15 补「注入面即唯一来源」的臂（两行族每格一次调用、单行族零调用、表里零 `Usage: ` 字面），T16 补真命令的两处同源臂（`cdd board --dry-run` 与 `cdd schema get plan --dry-run` 的首行各等于同一命令节点 `--help` 的首行）；**两层形状对照的输入补齐**——`cdd review --type wave` 不带 `--plan` 时先被 `REQUIRED_GROUPS` 钩子拒成单行，body 的两行形要 `--plan` 在场才出现，故那条成对臂的输入改成 `cdd review --type wave --plan <…>` 缺 `--tasks`，group 层与 body 层各有自己的输入；另三条备注同批落地：T16 删去「整份计划里唯一同时看得见取用面与成员集的 pin」这句（表与成员集的相等断在 T15 的每成员臂，T16 只判生产者落点与 `SCOPE_ROWS`），填充值的取法从「旗标拼写就是命令字本身」改成「取 argv 侧输入里那一项的键与值」（`--plan` 并不是命令字），T13 的缺 `--tasks` 一族注掉「未知取值」（`--tasks` 的取值域拒绕在解析层由 commander 拒，body 层只有 `missing required --tasks` 这一形）。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.22 | 2026-11-25 | docs-fix 轮十七（F1 · F2 全部落地，未放宽判据；F2 为 warn）：**两树禁门与它扫描器的退役有了主人**——T18 的 Files 收下 `src/__tests__/tree-separation.test.ts` 与只被它引用的 `tests/support/module-specifiers.ts` 两条 `Delete`，Produces 与 Steps 写明「禁门与两树共存窗口同生共死」（spec §3.1 的正控是对账器，对账器在同一个删除步里销毁），删树后**不补** `existsSync` 守卫——守卫在树缺席时通过，正是 D101 与 §3.1 禁止的惰性判据；补一条机械判据 `grep -rn 'src-next' packages/cdd-engine/src packages/cdd-engine/vitest.config.ts` 零命中，把 Acceptance 的零残留条款落到 `src/` 与 `vitest.config.ts` 上（描述两树并存的注释与那条 include 同批清掉）；T1 的 Produces 补一句「两条断言随树同批退役、本任务不写守卫」，把红点前移到第一波而不是留到最后一波。**`UsageReason` 的填充值规则收窄**——T13 那一句原来把每个成员的填充值都写成「命令路径 · 旗标拼写 · 位置参数名」，对带载荷的两个成员不成立：改成「名字类填充取自 argv 侧输入」，并补「带载荷的两个成员各带自己声明值里的字段」（基冲突带 `BaseArtifact#set` 的 `conflict` 值里的既有基、`base get` 带 `BaseArtifact#read` 的 `target`）；T15 的基冲突格写出该字节（`error: cdd base set: base already set to <existing> — pass --force to override`）并把填充源点成既有基，T16 那条臂改成断「印的是存储基（探针里 `develop`）、不是请求基 `release`」。任务 id 集与 `DependsOn` 集未动。另记：提交 022ca5a6 改 T2 正文（`grid.ts` / `record.ts` / `roster.ts` 入 Files、`compareTree` 改异步、格的三态加「不适用」）未升版本也未补行，该记录面的失记在本行一并补齐，body 与已交付面一致 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.23 | 2026-11-25 | docs-fix 轮十八（F1 · F2 · F3 · F4 · F5 全部落地，未放宽判据；F3–F5 为 warn）：**对账器的格状态改为比对时派生、录制件不再存状态**——`baseline/` 每格只存期望字节与「这条路不存在」，状态由两条树上事实算出（名册点名的 producer 落点是否可解析 · 该格 probe 派生的 kind 是否已在 `harness.ts#NEW_TREE` 注册），于是落地 producer 的波不必重写基线（F1 的「记作 GAP 而 producer 已落地」那条红从派生口径里消失），录制只是 T2 的一次动作；**driver 的注册点与注册波写进名册**——`seam` → T8（`init` 的步骤序列格是第一个 seam 格）· `render:skeleton` → T9 · 其余 `render:<family>` → T15 · `entry` → T17，落格或注册 kind 的波在 Files 里带名册那几件（`grid.ts` · `GRID-WIRING.md` · `parity.test.ts` 恒在，注册 kind 的波再加 `harness.ts`），T8 · T9 · T11 · T14 · T15 · T16 · T17 逐波补齐，缺 driver 的报文改为点名该 kind 的注册波（F1 · F2）；**entry kind 的格归 T17 收口**——`src/bin.ts` 在此之前不被调用，T15 / T16 的 Acceptance 改述为「本片的 `render:<family>` / `seam` 格零差异，entry 格留 GAP 由 T17 收口」，T16 的骨架落盘格改成进程内壳驱动的落盘事实判据，T17 补 `entry` 的注册与这些格的进程级字节比（F2）；**名册的 `f6.board.*` 两格接线任务改回 T15**（`surface/render/board.ts#BoardView` 是 T15 的交付物），`init` 的步骤序列格点名 T8 的 `Provisioner#plan` 作 producer，名册行不再是只有 T2 能改（F3）；**T18 的 `CliLifecycle.LOGS_DIR` 改指已交付的 `RoundLogLayout.SEGMENT`**（`Workspace.LOGS_SEGMENT` 是别名，不新造 `LOGS_DIR`——T18 没有 `src/**` 的写权）（F4）；**T14 的词表族点实**——Consumes 改 `CAPSULE_WORDS`（旧树没有 `WORDS`）、Produces 补 `inFlight` 的 held · stealable · targetGone · lockHeld · lockOnly · free · recovery 三句与 `routeWords.handoffRef`，T15 的 `#heldBlock` 写明字面来源（F5）。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.24 | 2026-11-25 | docs-fix 轮十九（F1 · F2 为 blocker，F3 · F4 为 warn，全部落地，未放宽判据）：**录制件的形状写回已交付的事实**——`baseline/` 每格存期望字节、「这条路不存在」与**录制那一刻由 `stateOf` 派生的状态**，一份录制是快照而不是永久判据：它把录制瞬间的 producer 落地事实抄进了文件。于是重录有了**两个触发点**（语料的格集变了，或本波落地了 producer），漏掉的那一波读到 `recorded as gap, but its producer has landed — wire the cell`，这条红就是判者；T9 · T14 · T15 · T16 的 Files 各收 `baseline/`、各补一条重录步骤（T11 与它们同理），T2 的 Produces / Steps / Acceptance 三处同口径重写（F1）；**第五档「具名延后」落在 T8**——`harness.ts#REGISTRATION_WAVES`（`seam` → T8 · `render:skeleton` → T9 · 其余 `render:<family>` → T15 · `entry` → T17）成为「已接线而 kind 无 driver」的唯一答话人：带声明的注册波 ⇒ 计入延后并报出注册波，没有声明 ⇒ 缺格；T2 在第一波注册的 `entry` 占位驱动（`ENTRY_DRIVER` 答不出字节）由 T8 退掉、T17 重新注册，entry 类格因此在 W9 / W10 读作具名延后而不是空字节差异（F2）；**名册保持已交付的四列**（cell · task · producer · route）——kind 由 `kindOf` 在比对时派生、不落名册，注册波住 `harness.ts` 而不是表格；名册里 `init` 的格归 T15 的 `InitRenderer`，`Provisioner#plan` 是它们 driver 的步骤数据面（T8 不再被说成有一格）（F3 · F4）；T15 · T16 · T17 的 Steps 与 Acceptance 改述成「本片的 `render:<family>` / `seam` 格零差异，entry 格读作具名延后（注册波 T17），落地 producer 不改变这一点」，T17 的首绿判据加「GAP · 具名延后 · 缺格三张空集」与「`NEW_TREE.kinds()` 与注册波表的键集逐值相等」（F2）。另记：v0.23 那一行「录制件不再存状态」是当时计划想要的口径，树上的对账器从来不是这个形状——本行按已交付形状改述。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.25 | 2026-11-25 | docs-fix 轮二十（F1 为 blocker，F2 · F3 为 warn，全部落地，未放宽判据）：**`seam` 的注册波改到它真读得出读数的那一波**——`seam` probe 读的是一次完整命令的 stdout / stderr / 退出码（`implement --tasks … --plan …` · `init --harness …`），命令面不落地就答不出这三件，故 `REGISTRATION_WAVES` 的 `seam` 行从 T8 改为 T16，T8 只登记这一行、不注册 driver（其 Steps 换成「登记注册波 + 用一条测试内造的已接线 `seam` 格核两向」），`seam` 的 driver 与它的进程内装配（测试面装配四片 · 注入派发结论与 step runner · 零 spawn）归 T16，T16 的 Files 收 `harness.ts`；T11 · T14 · T15 落地的 `seam` 格在注册波之前读作**具名延后**并点名 T16（T11 之前是 GAP、不判红），T16 起逐字节比——T2 · T8 · T11 · T14 · T16 的措辞同批改口（F1）；**「缺格」的成因删去树上没有判者的那一半**——`it.skip` / `test.todo` / `--exclude` 不再算成因，这一态因此与交付一致：对账器判的是录制件与树的不一致、无 probe 与非具名抛出（F2）；**录制件的日期写在件上、不写在格上**——`baseline/` 带一个 `frozenDate`，每格只有 `state` 与 `value` 两件（`value` 是期望字节或「这条路不存在」这一个事实），T2 的 Produces 与录制步骤同口径改口（F3）。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.26 | 2026-11-25 | docs-fix 轮二十一（F1 为 blocker，F2 · F3 为 warn，全部落地，未放宽判据）：**面 1 / 面 2 的 body 层 usage 家族补成逐族逐格**——旧树的 `face/cli.ts#Cli` 的 `#usage` 会为 `schema get` 的多余 target 与缺 target 各印 usage 首行 + `error:`（exit 2），而语料把这条真有的路记成 `not-applicable`：T16 把 `f1.schema-get.refusal` 拆成 `missing-target` 与 `extra-target` 两族，并补 `board` 的四个拒绝族（作用域拒绝 · 无旗标 · 未命中含双旗标 ` and ` 形 · 读不出）· `schema get` 的作用域拒绝族 · 计划外任务的三族 · 空账本「无可派发帧」的三族，面 2 的 `--help` 由根一格补成顶层八节点加四个嵌套叶各一格，每族各点名本片一个接线任务与 producer 落点（`surface/render/usage.ts#UsageFace` 与 `run/` 的成员源只作读值来源），T16 的 Acceptance 同口径收口；T2 的规则句补「usage 家族按命令节点各成族」，让「不适用」只用于真没有的路（F1）；**T8 的读数改成增量**——`NEW_TREE.kinds()` 的判据从「为空」改成「不含 `entry` 与 `seam`」，W4 同波 T9 注册的 `render:skeleton` 不再与 T8 的 Steps 与 Acceptance 相冲（F2）；**T2 的两句写回已交付形状**——夹具是 `trees.ts` 的 `TREE_SHAPES` 加 `materialize()` 现造（不是七个子目录）· `non-tree.ts` 的三份非树夹具，缺格成因补「无基线条目」与「不适用路与录制不符」两条（F3）。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.27 | 2026-11-25 | docs-fix 轮二十二（F1 为 blocker，F2 · F3 为 warn，全部落地，未放宽判据）：**面 1 的两族字节回到可构造与正确拼法**——「无可派发帧」三格删除，T16 写明该字节在树上没有触发点（波门 line 腿先以 `split` 拒绝，frontier 非空则真派发或被 hop 拒绝），它的唯一判者是手写字面单元臂、端到端是具名缺席（语料不开格、名册不开行）；`f1.<verb>.refusal.missing-task` 的 `implement` 一格改成 `implement --tasks <计划外 id> --plan <…>`（`implement` 没有 `--type` 旗标，带上只会录到解析层的 `unknown option`）；`f1.board.refusal.unreadable` 的输入有了夹具旋钮（`fixtures/trees.ts` 的读不出路径集，`materialize()` 落盘后模式清零）且 T16 的 Files 收下 `fixtures/trees.ts`；本片新族的 kind 改成按探针派生而非按族归（不注入缝即 `entry`，要注入派发缝即 `seam` 且注册波为本波）。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.28 | 2026-11-25 | docs-fix 轮二十三（F1 为 blocker，F2 · F3 为 warn，全部落地，未放宽判据）：**派发前被拒这条合法结局有了位置**——`Run#advance` 的回值闭集补 `{kind: "blocked", verdict, checked}` 与 `{kind: "held", state, checked}` 两个变体，词与 `previewOf` 的 `blocked` / `held` 逐字相同、同带那一次只读 pre-flight 的 `checked` 行集（未拒时 `previewOf` 的 `pass` 对应 `advance` 的 `dispatch`），这条链三段各点名（产出 `run/advance/lifecycle.ts#Lifecycle#advance` 在 `PreFlight#vet` 拒绝时不派发、原值交回 · 渲染 `surface/render/route.ts` 的拒绝行与 `checked:` 段、`surface/render/graph.ts` 的 `split` 波板段、`surface/render/preview.ts` 的同一份行集 · 分派 `surface/index.ts#Cli#report` 按 `kind` 一次值分派，真派发拒绝走 stderr 与 exit 1、`--dry-run` 的持有与阻断走 stdout 与 exit 1），T13 的失败变体 pin 与 dry-run pin 同改成「被拒时两侧 `kind` 逐字相同」，T16 的三件事 pin 补「拒绝路只调 `Run.advance` 一次、零 `run/gate` import」（F1）；**波板渲染器有了调用者与判者**——`surface/render/graph.ts` 的调用者是 `route` 渲染器的拒绝 detail 段（只 `split` 一条成因出 `graph:` / `wave board:` / `progress:` 三段），T15 补一条「同一份裁决两次渲染字节相同」的 pin 与验收项；三枚进度标记 `✔` / `▶` / `○` 与两条图例尾行（只差 `current` / `current wave` 一个词）落 T14 的 `WORDS`，`board` 与 `graph` 只连接它、不各存一份（F2）；**「无可派发帧」的真跑臂删掉**——T16「第二形状」那组不再把无 argv 可达输入的这条列进真跑命令，改以手写声明值直接喂 `UsageFace#report` 断 `{stream, text, exitCode}` 三件，句末计数与枚举项对齐，与 Produces 的具名缺席三处一致（F3）。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.29 | 2026-11-25 | docs-fix 轮二十四（F1 · F2 为 blocker，F3 · F4 · F5 为 warn，全部落地，未放宽判据）：**`checked` 行集回到回值上**——`Run#advance` 的 `dispatch` 变体逐值点名 `{kind: "dispatch", result, capsule, checked}`，那个 `checked` 与 `blocked` / `held` 是同一份东西（同一次只读 pre-flight 派生，三态同源；未拒的派发没有裁决，行集取不到），T15 的 `#checkedBlock` 改成取回值自带的那一份行集（approved / blocked / held 三处一份），T13 的失败变体 pin 与 dry-run pin 各补「approved 派发与 blocked 派发印出的字节相等」，T16 的三件事 pin 补「行集由回值携带、壳不重算」（F1）；**`--dry-run` 的脸从三张补全**——`previewOf` 的闭集补 `refused`（line 腿：波门 `vet` 是纯函数，dry-run 照跑，与结构腿的 `blocked` 分开是因为两张脸的流不同）· `usage`（`Frame#of` 的错用，含计划读不到与「计划里无该任务」）· `read-failure`（计划读不到），零调用改成「三件纯读 `Frame#of` 装配 · `PreFlight#vet` · `WaveGate#vet`；派发 / 记账 / 取锁 / 写盘零调用」，流按腿分流（结构腿 stdout · line 腿与装配层 stderr），退出码 pass 0 / 其余 1 / 装配层 2，T16 的 dry-run pin 与验收同批改口，语料补 `f7.preview.refusal.split` 与 `f7.preview.usage.missing-plan` 两族并随格集重录 `baseline/`（F2）；**brief 写失败有了容器**——`{kind: "write-failure", target}` 列进 `advance` 的回值闭集与逐值清单，T16 的壳侧取值清单补这一名（F3）；**拒绝路正文只有一个拼装点**——`#blockedBlock` 的入参改成 `route#refusalBlock` 渲染出的正文与裁决自带的 detail 行集、它只加自己的外层（F4）；**翻面后不留两份同文件集的工程**——T18 的 Files 与删除清单收下 `packages/cdd-engine/tsconfig.src.json` 与根 `typecheck` 链里它那一条，编译面收成引擎主工程 · `scripts` · kairos 测试三处（F5）。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.30 | 2026-11-25 | docs-fix 轮二十五（F1 · F2 为 blocker，F3 · F4 为 warn，全部落地，未放宽判据；F5 指出的边归编排者，本轮不落）：**板上事实块有了读面、词面与语料**——`Ledger#orphanHandoffs()` 与 `#crashedOf(records)` 归 T7（前者按「不可归属的名字」与「可归属的轮载体而 `progress` 无记录认领」两段判、无产物矩阵回空集；后者按轮身份去重、以第一条 hard 违规取因），`WORDS` 的板面组补 `orphan:` / `crashed:` 两个行标签、`no recorded round owns it` 一句与 ` · orphan drafts: ` 后缀，T15 的 `board` 从「两态」改成 `--notes` 两态加板上事实块与产物清单两族，`#passBlock` 的 `reads:` 行收同一个读值的后缀；`fixtures/trees.ts` 与它的 README 由 T15 收下孤儿草稿与崩溃轮两条旋钮，`f6.board.orphan` · `f6.board.crashed` 各一格、名册各一行并随格集重录 `baseline/`（F1）；**产物清单不再没有主人**——`#artifactRows(reads)` 取 T7 的 `ArtifactReads`（默认只出异常轮、`--artifacts` 出全清单并带坐标），`WORDS` 补 `art:` 标签与它的列词与状态词（续行列标签逐组声明，与门口的 `derived:` 组不互相顶替），`--notes` 与 `--artifacts` 在 T16 同表声明，`f6.board.art.anomalous` · `f6.board.art.all` 各一格（F2）；**预览路径的 brief 那一格有了填法**——`DispatchValues` 的身份格改成两种填法同一份拼写（派发路径由 `Lifecycle` 落地交回、预览路径由 `briefOf(request)` 的名字取，产物矩阵的 `brief` 行是单源，零渲染零落盘），`previewOf` 的 `pass` 与它的 dry-run pin 点名这一处（F3）；**`ENGINE_RUNTIME` 的改指换成两个已交付落点**——`docRoots` 指向 `env/paths/doc-roots.ts#DOC_ROOT_SEGMENTS`、`handoffNamespace.workspaceRoot` 指向 `env/workspace/workspace.ts#WorkspaceRoot.DEFAULT_SEGMENT`，聚合体不重建，T5 的 Produces 同句收口（重拼即第二份拼写，搬 `contextContract` 即 `env → surface` 的反向边）（F4）。F5 指出的 T11 / T12 / T14 → T5 三条边未动——`DependsOn` 集是编排者写权，交编排者补 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.31 | 2026-11-25 | docs-fix 轮二十六（F1 为 blocker，F2 · F3 为 warn，全部落地，未放宽判据；F4 指出的三条边归编排者，本轮不落）：**产物清单的状态词回到旧树的字节**——T14 的 `WORDS` 状态词区从 `ready` 改成 `ok`（`ok` 是 T7 `ArtifactRead` 的成员名，也是旧树 `face/board-view.ts` 健康轮印出的那一格；四态同源于 `ArtifactRead`，`misplaced` 与 `invalid` 两态带 `! ` 前缀），T15 的板上事实块 pin 把「一株健康树加不加 `--artifacts` 字节相同」收窄成「一株无产物观察的树」，并补健康轮的 `ok` 行与 sidecar 缺席评审轮的 `absent` 行两条语料臂（F1）；**程序板的渲染路径有了名分**——T15 的 `board` Produces 点名同一个 `BoardView` 的两条渲染路径（节点板 / 程序板），程序板印整体行 + 每个 `program:` 指向本宪章的 phase 行 + `next:    done` 并有自己的 `art:` 观察面，`fixtures/trees.ts` 收下 `overall` 树形态（宪章 + 一份带 `program:` 的 phase-spec），`grid.ts` 与 `GRID-WIRING.md` 加 `f6.board.program` 与 `f6.board.program.art` 两行（接线任务 T15、producer 落点 `surface/render/board.ts#BoardView`），随格集重录 `baseline/`（F2）；**板面三条渲染支的入参有了生产者**——T7 的 `Ledger` 补 `#carrierPathOf(type, key, record)`（记录载体路径的唯一访问口）与 `#observedArtifacts()`（按席位摊出 `{line, kind, cycle, attempt, carrier, read}` 的观测集、按 `(cycle, attempt)` 排序），`#crashedOf` 的入参取自同账本的 `#nodeRecordsOf(progress)`，T13 的 `Run#boardOf` 回值把板面事实值改成 `rows` / `facts` / `observed` 三格逐值声明，T15 的 `board` 入参改成「`BoardDisplay` 两开关 + 那一份事实值」并逐支点名入参，于是渲染器不读账本、不收集记录，观测集另有一条 pin 与一条验收（F3）。F4 的三条边（T11 / T12 / T14 → T5）未动——`DependsOn` 集是编排者写权，本轮不落 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
| v0.32 | 2026-11-25 | docs-fix 轮二十七（F1 · F2 为 warn，全部落地，未放宽判据；F3 指出的三条边归编排者，本轮不落）：**`entry` 退役那一笔带上登记断言的换向**——T8 的 Files · Produces · Steps 三处同批点名：`parity.test.ts` 里「registers the new tree's own process entry」那条断言由「`NEW_TREE.kinds()` 含 `entry`」换成「不含 `entry` 而 `REGISTRATION_WAVES` 带 `entry` 行」这一对派生事实（不删断言——删了就再没有一条用例证明 entry 类格被具名延后兜住，与 T18「不补惰性守卫换绿」同一口径），T17 重新注册 `entry` 时把它换回 `toContain` 并在 Files（`parity.test.ts` 那一行）与 Steps 各留一句，两步成对（F1）；**树形态登记不再持字面计数**——T15 的 Files（`parity.test.ts` 与 `fixtures/README.md` 两行）与语料落格一步写明：`TREE_SHAPES` 收下 `overall` 之后那条登记断言改成派生形（`TREE_SHAPES_TEXT` 自身即唯一声明点，逐值断言或去掉计数），不把旧的字面计数改成新数字（D101），README 的「does not invent an eighth shape」随形态换口（`overall` 是文档种类的形状，不是 `TreeOptions` 旋钮能表达的「更宽的 wave / 半写的账本」），于是 T15 自己的全片跑绿在换向前是必红的那一条（F2）；**计划里剩余的树形态散文计数改成不写字面数**——T2 的 Produces、提取夹具树一步与 Acceptance，T16 的两行 `fixtures` 括注（形态集从 `TREE_SHAPES` 的声明处派生），T2 是已闭合任务故只改措辞、不动它的切分；spec §2.3 的树形态语料声明（补上整体树那一形态，不写死形态数）由编排者回填。任务 id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-25） |
