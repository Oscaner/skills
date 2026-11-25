---
title: 'P39 · 引擎在 src/ 的再抽象复刻：四切片 · 字节保真 · 一波翻面'
doc-type: plan
version: v0.9
date: 2026-11-25
slug: '2026-11-25-engine-doc-tooling-p39-design'
base: develop
---

## Constraints

- 读 spec `2026-11-25-engine-doc-tooling-p39-design` 的**当前版本**为唯一设计输入（不钉任何一版快照：spec 每升一版，差异以回填本计划的方式落地）；本计划不重述它的判据，只落实施序。冲突时以 spec 为准并回填本计划。
- 新树只写 `packages/cdd-engine/src/**`。旧树 `packages/cdd-engine/src-next/**` 在本相位**零改动**——两个例外，除此之外任何一步动它即为缺陷：§3.3 翻面那一波整棵删除；以及 T1 退役 `zero-dep.test.ts` 的 `src` 腿（pin 的前提被 D104 取代，spec §Constraints 点名）。
- 每波结束时两棵树各自的套件都绿，且 `src/` 侧的任务必须让测试随源码同片落地（`src/**/__tests__/**`）。只加源码不加测试的波不算一波。
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
- Modify: `packages/cdd-engine/src-next/__tests__/zero-dep.test.ts`（仅退役 `RETIRED_PLANES` 的 `src` 腿）
- Modify: `packages/cdd-engine/vitest.config.ts`
- Modify: `package.json`

#### Consumes
- spec §3.1（禁门与它的域）· §3.2（独立编译面 · 两条波次条件）

#### Produces
- `packages/cdd-engine/tsconfig.src.json`：`compilerOptions` 逐键照抄既有 `tsconfig.json`（含 `allowImportingTsExtensions` · `erasableSyntaxOnly` · `verbatimModuleSyntax` · `isolatedModules` · `noEmit` · `moduleResolution` —— 少写一个，`src/bin.ts` 的 dev 面就在 `node --experimental-strip-types` 下先红），只把 `include` 换成 `["src", "vitest.config.ts"]`；**不设 `rootDir` / `outDir`**：既有 `tsconfig.json` 没有这两个键，而 `rootDir: src` 会把 `vitest.config.ts` 甩在外面，`tsc --noEmit` 当场报 TS6059——正是本步要求 exit 0 的那一条；发布面仍由 `tsconfig.build.json` 承担，它的 `rootDir` / `include` / `exclude` 三键在翻面时随 T18 改指 `src`（`exclude` 今天写的是 `src-next/**/__tests__/**`，只改前两键会让测试目录编进 `dist/`，而 `files` 只带 `dist/` 与 `templates/`）
- 根 `package.json#scripts.typecheck` 追加 `tsc --noEmit -p packages/cdd-engine/tsconfig.src.json`
- 根 `package.json#scripts.check:no-bare-functions` 的扫描根补上 `packages/cdd-engine/src`（旧树那一段一并保留到翻面）：零裸函数从第一波起就有判者，否则 `src/` 里写出裸函数要到翻面那一波才第一次红
- `packages/cdd-engine/vitest.config.ts#include` 追加 `src/**/__tests__/**/*.test.ts`（旧树的模式保留到翻面）
- `src/__tests__/tree-separation.test.ts`：两条断言（`src/**` 非测试文件不 import `src-next/`；`src-next/**` 非测试文件不 import `src/`），读法是逐文件扫 import 说明符
- `src/bin.ts`：组合根占位（导出 `main()`，本波不接线）

#### Steps
- 写 `tsconfig.src.json` 并挂进根 `typecheck` 链 — checkable: `pnpm run typecheck` exit 0，且它点名四个工程（引擎旧树 · `scripts` · kairos 测试 · 引擎新树）
- 埋一处类型错误到 `src/bin.ts` — checkable: `pnpm run typecheck` 红，且报文指到 `src/`
- 撤回那处错误 — checkable: `pnpm run typecheck` 回到 exit 0
- 把 `src/**/__tests__/**/*.test.ts` 加进引擎 vitest include — checkable: `pnpm -C packages/cdd-engine exec vitest run` 的收集列表里出现 `src/__tests__/tree-separation.test.ts`
- 在 `src/` 某测试里埋一条必然失败的断言 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 红
- 撤回 — checkable: 回到全绿，且这一次收集到的用例清单与埋断言之前那一次相等（两头各存一份清单比对；不把当天的读数字面写进判据，D103）
- 写两条禁门断言 — checkable: 在 `src/` 的某个非测试文件里写一行 `import "../src-next/bin.ts"` 即红；反向（在 `src-next/` 非测试文件里 import `src/`）另造一次即红；两次撤回后绿
- 把 `src` 加进零裸函数扫描根 — checkable: 在 `src/` 的非测试文件里写一行 `export function f() {}` ⇒ `pnpm run check:no-bare-functions` 红并点名该文件；撤回后绿
- 退役 `src` 那一条腿 — checkable: 从 `RETIRED_PLANES` 移除 `"src"` 且保留 `"config"`；随后人为建一个包根的 `config` 目录 ⇒ 该 pin 仍红（证明 `config` 腿还活着），删掉即绿；同一文件里「`src-next` 内零说明符指向退役平面」那条断言不受影响（`pnpm -C packages/cdd-engine exec vitest run src-next/__tests__/zero-dep.test.ts` 绿）
- 提交 — checkable: `git log -1 --format=%s` 以 `chore(p39):` 起头

#### Acceptance
四条波次条件可红可回（含 `zero-dep.test.ts` 的 `src` 腿退役后整棵引擎套件绿）：编译面红一次、测试面红一次、禁门两向各红一次；撤回后 `pnpm run typecheck` 与 `pnpm -C packages/cdd-engine exec vitest run` 均绿且收集到的用例清单与埋断言之前相等；`src/bin.ts` 与 `tsconfig.src.json` 在树上；禁门的域是产品文件（`src/**` 与 `src-next/**` 各自去掉 `__tests__`），测试面不被这两个断言扫；零裸函数的扫描根已含 `src/`（在 `src/` 写一行裸函数即红，不等翻面）。

#### DependsOn
none

### Task 2: 对账器、基线录制与夹具抽取

#### Objective
把「复刻」从一句承诺变成一个可红的判据：一个只活在测试面的差分对账器，同时读两棵树，对固定语料逐字节比。本任务交付它的骨架、基线与夹具三个家，并让三条纯命令（`base` · `schema` · `issue`）的册面先有语料——后续每一片落地都要往它里面加格，且每一格都带一个接线任务。

#### Files
- Create: `packages/cdd-engine/tests/parity/harness.ts`
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
- `harness.ts` 导出 `compareTree(scenario: Scenario): Diff[]`：给定一份夹具树，分别以旧树与新树的入口跑一次，返回逐格差异；**格 = 命令 × 路 ∈ {正常, 拒绝, 失败} × 流（stdout / stderr / 退出码）**，或渲染面 × 场景。`Scenario` 带 `frozenDate`（骨架面的注入日期，两棵树同传同一个值）
- `baseline/`：从 live 树录制一次得到的期望字节，按场景 × 格存
- 格的三态口径：**GAP**（未接线——按名册计数，既不是 skip 也不是红）· **差异**（已接线的格与基线不同字节，红）· **缺格**（`it.skip` / `test.todo` / 被 `--exclude` 掉，或名册里点名的任务已经落地而该格仍记作 GAP——出现即红）。逐波只断言「已接线的格零差异 + GAP 集合与名册里未接线的格逐格相等」；「GAP 集合为空」是 T17 的判据，不是每个波次的判据
- **自证臂**（与逐波判据分开，由 `compareTree` 的旧树一侧承担）：同一场景在旧树连录两次，两份录制逐格互比为空；人为把其中一份的一个字节改写后逐格互比即报差异——它不依赖任何新树 producer，所以「自身可红」在 T2 当天成立，而 GAP 格在逐波判据里仍只计集合、不比字节
- `fixtures/`：从旧测试提取的夹具树，七种树形态各一份（空树 · wave 进行中 · in-flight 持有 · refused 在树 · doc-drift · stale holder 且 target gone · branch 已闭合），外加三份非树夹具：`init` 的 PATH 替身 harness 与注入 step runner · `issue render` 的 stdin findings JSON · 骨架面的冻结日期常量
- `baseline/` 的格清单就是 spec §2.2 的八面逐格：面 1 按 `命令 × 路 × 流` 逐格展开，三条路（正常 · 拒绝 · 失败）各成一族，`init` 的步骤序列与 `issue render` 的渲染及 stdin 契约另按在册项逐格录；面 2 的 `--help` / usage / 错用退出码 2 同类在册。某条命令不存在某条路时在名册里写「不适用」，不留空、不省略；没有一格留「随某任务补」的占位
- **格 → 接线任务名册**（`packages/cdd-engine/tests/parity/GRID-WIRING.md`，本任务 Files 里的一件）：每格写明它在新树一侧的 producer 由哪个任务交付并接线，**一格一个接线任务**（多格共用一个任务可以，一格挂两个任务不行）——命令面与 `--help` / usage / 错用码 2 归 T16（壳与声明），其中 `init` 的步骤序列归 T8、`issue render` 的渲染与输入契约归 T15；面 1 的拒绝路格随 T16 的壳与 T11 的门行接线（被拒时走哪条流、退出码几都在那一格里比），失败路格随 T12 的终止因与 T16 的退出码面接线；骨架四族归 T9；prompt 两带 · 胶囊 · 板面两态 · 预览归 T15；阻断面按格拆开：`CDD_BLOCKED` 报文与 `checked:` 行集归 T14（词表）、站名与让位条件归 T11（门行集与让位——接线任务仍只有 T11 一个，那一格的读值取 T10 的 `docs/judging/closure.ts#ClosedDocument`，门只拼行、不另算闭包）、阻断行落在 stdout 的那一处归 T16（打印面）
- `packages/cdd-engine/tests/parity/tsconfig.json` 挂进根 `typecheck` 链；`vitest.config.ts#include` 追加 `tests/parity/**/*.test.ts`
- 执行命令：`pnpm -C packages/cdd-engine exec vitest run tests/parity`

#### Steps
- 建 `tests/parity/` 的三个家与 tsconfig 工程 — checkable: `pnpm run typecheck` exit 0 且点名 `tsconfig.src.json` 与 `tests/parity/tsconfig.json` 两个新工程
- 加 include — checkable: `pnpm -C packages/cdd-engine exec vitest run tests/parity` 能收集到 `parity.test.ts` 并因空实现而红/绿（任一，只要被收集）
- 提取七份夹具树 — checkable: `fixtures/` 下七个子目录，各自可被旧入口读成预期形态（用旧树的 `cdd board --plan` 与 `--dry-run` 各跑一次核对，读数落 `fixtures/README.md`）
- 写 `compareTree` 的旧树一侧 — checkable: 单跑旧树对同一场景两次，差异为空（自身确定性）
- 录制基线 — checkable: `baseline/` 覆盖 spec §2.2 的八面逐格（含面 1 的三条路逐格、`init` 的步骤序列与 `issue render` 的 stdin 契约、面 2 的 `--help` / usage / 错用退出码 2），每格带 `frozenDate`；此刻新树的 producer 全部还没落地，故每一格都记作 GAP，`pnpm -C packages/cdd-engine exec vitest run tests/parity` 已绿（GAP 集合此刻与名册全集相等）
- 写接线名册 — checkable: `GRID-WIRING.md` 里每一格都点名一个接线任务且一格只挂一个；把任一格的接线任务从名册删掉，该格即红（不是 skip，也不是 `todo`）；把某格记作 GAP 而它名册里的任务已经落地，该格同样红
- 让对账器自身可红 — checkable: 走自证臂——同一场景在旧树连录两次、两份录制逐格互比为空；把其中一份录制的一个字节改写后同一条用例红，`pnpm -C packages/cdd-engine exec vitest run tests/parity` 判到那一格；撤回后绿。此刻新树一格未接线，这条臂不依赖任何新树 producer
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p39):` 起头

#### Acceptance
对账器被收集、可跑、自身可红（改一份旧树录制的一个字节即红；新树一格未接线不影响它——第一个接线格落地后，已接线格的字节差异接上同一条红臂）；七份夹具树与三份非树夹具在册；基线覆盖 spec §2.2 的八面逐格（面 1 的 `命令 × 路 × 流` 三族、`init` 与 `issue render` 的在册项、面 2 的 `--help` / usage / 错用码 2），每格登记它的接线任务且一格只挂一个，未接线的格读作 GAP（计数、非 skip、非红）而不是缺格，「不适用」的路在名册里写明而不是留空，`GRID-WIRING.md` 在树上；两个新 tsconfig 工程挂进根 `typecheck` 链；`pnpm run typecheck` 与 `pnpm -C packages/cdd-engine exec vitest run` 双绿。

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
- 旧树的 `infra/root.ts#RepoRoot` · `infra/doc-roots.ts#ENGINE_DOC_ROOTS` · `infra/slug-index.ts` · `infra/workspace.ts#Workspace` · `infra/atomic.ts#AtomicWriter` · `infra/round-log.ts` · `infra/carrier-seal.ts` · `face/artifacts.ts` 的 `BaseArtifact` · `BaseSource` · `BASE_ARTIFACT_FIELDS` 与 `#readBase` / `#baseName`（基产物的读写，行拼写取自 artifact matrix；以上会读行为，不读形状）

#### Produces
- `Env`（`env/index.ts`）：构造一次，成员为四段的只读门面；本任务交付 `paths` 与 `workspace` 两段
- `paths`：`RepoRoot.of(cwd)`（不可推算即抛）· `docRootsOf(root)` · `SlugIndex`（同 slug 多份 ⇒ `invalid`）
- `workspace`：`Workspace#ensure` / `#writeJson`（经原子写）/ `#roundLogOf` / `#sealOf` · `BaseArtifact` 的读与写（`base` · `source` · `plan` · `recordedAt` 四字段；`BASE_ARTIFACT_FIELDS` 与 `BaseSource` 从 `env/workspace/base-artifact.ts` 导出，kairos 的 `base-artifact-schema.test.ts` 翻面时改指这一处；缺失或畸形读作 `null`，写入经 `#writeJson` 落地）
- 四类路径判据的往返 pin：写入—读回—拼写不变量

#### Steps
- 写 `paths` 的两条 pin（可推算 · 不可推算即抛） — checkable: 在临时目录里 `RepoRoot.of` 取到 git 顶层；在非仓目录里它抛且报文点名 cwd
- 写 slug 索引的判据 pin — checkable: 同 slug 两份文档 ⇒ 该 slug 读作 `invalid`，单份 ⇒ 可取到路径
- 写基产物的 pin — checkable: 首次写入后读回同一对象；字段集与 `BASE_ARTIFACT_FIELDS` 的元组逐值相等（断言从元组派生，不手写字段名）；畸形 JSON 读作 `null` 而不抛
- 写 workspace 的原子写 pin — checkable: 写入过程中被注入的失败不留半截 JSON（读回旧值）
- 写 `.kairos/.gitignore` 的 keep-out pin — checkable: `ensure` 之后 `.kairos/cdd/` 在被忽略面内，且它不建任何以 slug 命名的目录
- 写 `Env` 的门面 — checkable: `Env` 对外只露 `paths` 与 `workspace` 两段（成员集 pin），构造函数参数不超过四个
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/env` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
`env/index.ts` 的类注释第一行是不变量原句；`paths` 与 `workspace` 两段各至少三条 pin（可推算 / 不可推算即抛 · slug 单建与多份 invalid · 原子写不留半截 · keep-out 不建 slug 目录）；`Env` 的成员集只有这两段；基产物的字段集从 `BASE_ARTIFACT_FIELDS` 派生；测试与源码同片。

#### DependsOn
1

### Task 4: `docs/` 的 markdown 文法

#### Objective
立起物料的第一层：把一份文档读成树、切成段、取出正文与跨度、解析 front-matter、跑 home 驱动的登记表提取、解析任务块。**不变量（写在 `docs/index.ts` 的类注释里，本任务只立它的骨架）**：文档的形状由登记表判、判据只读文本。本任务的交付物是纯函数式的读取面——它不认识判据，也不认识轮次。

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
- `Documents`（`docs/index.ts`）门面骨架，本任务只露 `parse`
- `grammar`：`MarkdownTree`（标题树 + 围栏感知）· `MarkdownDocument`（不可变的文档索引：一次 mdast 解析，标题 / 表格 / front-matter 键 / 行内代码全是它的只读面）· `docBodyOf`（正文段与记录面的分界）· `frontmatterOf`（真 YAML 解析，失败即带位抛）· `HomeExtractor`（登记表 home 驱动）· `TaskBlocks`（任务块与 `DependsOn` 行）
- 树节点与跨度都是不可变值类型

#### Steps
- 写围栏感知的 pin — checkable: 正文围栏里的 `## 标题` 不进标题树；围栏外的进
- 写文档索引的 pin — checkable: 同一份文本两次解析读出同一索引（标题序与表格格集相同），且围栏里的表格不进索引
- 写 front-matter 的 pin — checkable: 合法 YAML 读回键集；非法 YAML 抛且报文带行位
- 写正文分界的 pin — checkable: `## Change history` 的行被读作记录面，正文段的判据不读它们
- 写登记的 home 提取 pin — checkable: 改登记表的 home 值即改提取结果（同一 fixture 两次读，结果随 home 变）
- 写任务块 pin — checkable: `#### DependsOn` 的一行逗号集读成 id 列表，`none` 读作空集；`DependsOn` 循环被读出
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/docs` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
`docs/index.ts` 的类注释第一行是不变量原句；五条 pin 齐（围栏感知 · front-matter 失败带位 · 记录面不参与正文判据 · home 改动即改提取 · 任务块与循环）；`grammar` 段对 `judging` 零依赖（import 面断言）。

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
- `process`：`ProcessFacts`（进程组去重 · 存活判定）· 宿主契约（`HOSTS` 的每 harness 行 · `DISPATCH` 的派发槽 · `REFS` 的斜杠形 · `HostDetect` 的一次探测）——宿主标记环境键的闭集只有 detect 行这一份，通道闭合守卫从它派生白名单 · `Clock`（系统时钟的唯一持有者，下游只收注入的时钟；骨架面的 `date:` 行从这里来）· `ChildRunner` 的接口与它的生产实现（spawn · 组杀 · 信号升级 · 父退出清理 · 墙钟上限）：spec §4 说 `env/` 是唯一需要接口的边界，活性判官由派发面注入，这里只负责起进程与杀进程 · `Lock`（`proper-lockfile` 的唯一持有者）
- `vcs`：`GitClient`（只读：顶层、状态、提交）· `planSourceOf`
- `Env` 成员扩到四段：`paths` · `workspace` · `process` · `vcs`

#### Steps
- 写进程事实的 pin — checkable: `npm exec` 包装内的子进程不重复计数（一组进程一条事实）；已退出进程读作不在
- 写宿主探测「只探一次」的 pin — checkable: 同一 `Env` 上连续两次取宿主事实，底层探针只被调用一次（注入计数探针）
- 写锁的 pin — checkable: 持有期间第二次获取被拒且报文点名持有者；释放后可获取
- 写宿主契约与时钟的 pin — checkable: `HOSTS` 的 detect 行是宿主标记环境键的唯一一份（守卫从它派生，不另立表）；`REFS` 的每 harness 形可派生；`Clock` 是 `src/**` 非测试文件里唯一读系统时钟的地方（扫 `Date.now` 与 `new Date(` 的调用面），注入固定时钟 ⇒ 下游读到的日期稳定
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
- `Documents` 门面扩出 `registryOf(type)` 与 `projectOf(type)` 两个读面

#### Steps
- 写身份的 pin — checkable: 四类 DocType 各一条；未知 type 即抛；slug 值域的正负例各一条
- 写登记表与 doc-face 的 pin — checkable: 每类的 face 集可读；一处 face 声明与正文实际 section 集不符即红
- 写投影的 pin — checkable: 六个派生面各一条；改登记表的一格即改对应投影（投影不是第二份真源）
- 写解析面零判定的 pin — checkable: `identity/` 对 `judging/` 零 import；解析面只按登记表与投影走
- 写识别面零 switch 的 pin — checkable: `Translator` 的两张表是构造入参；换一份改写过的表 ⇒ 识别结果随之变（零硬编码分支）
- 写解剖契约的 pin — checkable: `SKILL_ANATOMY` 的章节集可读，且与 kairos 侧守卫消费的常量同源（同一份导出）
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/docs` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
六组 pin 齐（身份四类与值域 · 登记表与 face · 六面投影 · 解析面对 `judging/` 零 import · 识别面零 switch · 解剖契约同源）；`identity/` 里没有判据、没有注册表的策略类。

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
- 旧树的 `session/ledger.ts`（`RoundFinding` / `RoundRecord` / 波行 / 文档行）· `session/line-identity.ts` · `session/round-artifacts.ts` · `session/round-naming.ts` · `session/reviewed-identity.ts` · `session/carrier-rulings.ts` · `session/carrier-integrity.ts` · `session/state.ts` · `session/artifact-reads.ts`（产物矩阵的判定与 sidecar 严格 schema 的合流）· `contract/carrier-line.ts#CarrierLine`（载体完整性那一行的唯一组装点）（读行为）

#### Produces
- `Run`（`run/index.ts`）门面骨架，本任务只露账本读面
- `ledger`：`Ledger#recordRound` / `#rounds` / `#waveLines` / `#docLines` / `#branchLine` · `RoundIdentity`（`(line, op, cycle, attempt)` 单射）· `ArtifactIdentity`（产物的名字与归属）· `ReviewedIdentity`（这一轮审的是哪一版）· `Rulings`（裁决与改档的落地与读回）
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
- 写载体行与产物读的 pin — checkable: 抛出的 `CarrierMismatchError` 报文与门口 `carrier` 行由同一处拼出（同一份事实两次读，字节相同）；产物读的四态各一条（同名两处 ⇒ `misplaced` · 缺席 ⇒ `absent` · sidecar 违约 ⇒ 拒绝而非半值）
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/run` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
六组 pin 齐（身份单射 · 波行闭合与快照 · 文档行与 doc_hash · 审过版本的可 drift 读面 · 产物身份单射 · 裁决与改档）· 载体行与产物读各一条；`run/ledger` 对 `run/gate`、`run/dispatch`、`run/advance` 零 import（它是最低段）；所有写入经 `env.workspace`。

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

#### Consumes
- 旧树的 `face/init.ts#CliInit` · `face/plugins.ts#PLUGINS`（读行为：九步 vs 六步、`--include-recommends` 的两档、`--update` 的两序列、`--dry-run` 零 spawn）

#### Produces
- `provision`：`Provisioner#plan(host, options)`（返回步骤序列，纯）· `#apply(steps)`（真 spawn）
- `Env` 成员扩到五段
- 步骤数据面单源：`PLUGINS` 的行即核心三包 + 推荐六包，claude 列空
- `init` 格的语料面：`Provisioner#plan` 的纯步骤序列就是那道缝——对账器在进程内驱动两棵树，PATH 替身的 harness 与注入 step runner 都挂在这条缝上，零真 spawn

#### Steps
- 写「预览即计划」的 pin — checkable: `plan()` 对同一入参两次结果字节相同；`apply()` 收到的序列与 `plan()` 的返回值逐项相等（注入 step runner 记录）
- 写零 spawn 的 pin — checkable: `--dry-run` 路径下 step runner 零调用
- 写两档的 pin — checkable: 不带旗标与带 `--include-recommends` 的步骤数按数据面派生（不写字面计数）；claude 档零推荐步骤
- 写 `--update` 的 pin — checkable: update 序列与 install 序列的步骤集不同，且两者都来自同一数据面
- 写 `init` 格的接缝 — checkable: 同一份入参下 `plan()` 的步骤序列可与旧树的序列逐项比对，全程 step runner 零调用
- `Env` 扩到五段 — checkable: 成员集 pin 更新；构造参数不超过四个（超出则收参数对象）
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/env` 绿；`pnpm run typecheck` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
四条 pin 齐（预览即计划 · 零 spawn · 两档按数据面派生 · update 与 install 同源）；`env/` 五段成员集 pin 绿；`provision` 的步骤数据面只有一处。

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

#### Consumes
- 旧树的 `contract/review-criteria.ts`（含 `LENS_QUESTION_ROWS`）· `contract/completion-criterion.ts#CompletionCriteria` · `contract/wave-width.ts#MAX_TASKS_PER_WAVE` · `render/skeleton.ts#SkeletonAssembler#compose`（读行为与四族的分支集）
- 旧树的 `session/graph.ts#TaskGraph`（`GraphIssueClass` 的四类边失败 · `batches()` 的拓扑波分解 · `frontier(done)` · `detailLine()`）与 `contract/task-blocks.ts` 的 `DependsOn` 行（T4 交付）：图的边只从任务块来，没有第二份边表；`session/preflight.ts` 的 `graph` 腿是它在新树上的结构判消费面
- `identity/project.ts` 的 `skeleton()` 投影（T6 交付：骨架的槽位与 front-matter 发射表都从登记表派生）
- spec §2.3 的骨架日期钉法（日期只从构造入参进来）

#### Produces
- `criteria`：评审判据体（按 kind 的判据文本）与 `LENS_QUESTION_ROWS`；`Documents.criteriaOf(kind)` 与 `lensQuestionsOf(kind)`
- `CompletionCriteria`（按 verb 分档）· `MAX_TASKS_PER_WAVE`
- `TaskGraph`（`docs/judging/task-graph.ts`）：从 `TaskBlocks` 的 `DependsOn` 行构造，`#validate()` 四类边失败（缺边 · 缺 id · 自环 · 成环）· `#batches()` 的拓扑波分解 · `#frontier(done)` · `detailLine()`（一条失败的一行拼写）。两条 pin 跟它同住：**波宽只此一处派生**（波宽判的正是 `#batches()` 的每一批，另立一份波分解即缺陷）· **表与族同住**（边读与它的校验同在这一个类，不另开一份边表）。它落在本任务而不是 `run/` 或 `run/advance`：波宽判据是它的直接消费面，而 `run/gate` 的 `graph` 腿（T11）与 `run/advance` 的波次前沿（T13）都经依赖边读它，不自己持一份
- `SkeletonAssembler`：构造入参含 `today`；`compose(type, target)` 对四族穷举；`Documents.skeletonOf(type)`

#### Steps
- 写 lens 问句表的 pin — checkable: 每 kind 的问句非空且无重复标签；`spec-consistency` 行携带指称问句（把它的问句字面抄到别处即红）
- 写完成判据的 pin — checkable: implement 零提交判违约一条、review 空 findings 判 APPROVED 一条
- 写波宽的 pin — checkable: 依赖层四个任务 ⇒ `TaskGraph#batches()` 的那一批宽度超过 `MAX_TASKS_PER_WAVE` 并被点名（本任务交付的是读数，不是注册表行——规则 id 的必报夹具归 T10，注册表行与策略类都在那一波）
- 写图的 pin — checkable: 一份 `DependsOn` 自环的 plan ⇒ `#validate()` 报 `self-loop` 且 `detailLine()` 点名该任务；成环 ⇒ 报 `cycle` 并列出环上的任务；缺 id ⇒ 报 `missing-id`；`#batches()` 的每一批内无依赖边（拓扑性），`#frontier(done)` 随 `done` 变化
- 写波宽单点派生的 pin — checkable: 换一份边集给 `task-graph.ts` ⇒ `wave-width` 判据的输入随之变；`wave-width.ts` 不持有自己的波分解
- 写四族骨架的 pin — checkable: 四类 DocType 各一条；类型集与 `compose` 的 switch 分支集一致（类型集从同一常量派生，测试断言「每个值都有分支」）
- 写日期注入的 pin — checkable: 同传一个冻结日期两次 ⇒ 字节相同；不传日期时构造即抛（无默认取系统时钟）
- 写骨架字节的格接入 — checkable: 对账器的骨架格用装配器入口在进程内驱动两棵树，同一 `frozenDate`
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/docs tests/parity` 绿（对账器按 T2 的 GAP 口径：已接线的格零差异、未接线的格计入 GAP，不判红）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
六组 pin 齐（lens 问句表与指称问句 · 完成判据两档 · 波宽可红且只从 `TaskGraph#batches()` 派生 · 图的四类边失败 · 四族骨架全覆盖 · 日期注入两条）；骨架格进对账器并在冻结日期下逐字节比；散文里不出现族数或判据条数；`wave-width-at-most-three` 这个规则 id 的成对夹具归 T10，本任务的波宽 pin 只判「批宽超 `MAX_TASKS_PER_WAVE` 即点名」。

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

#### Consumes
- 旧树的 `session/preflight.ts`（`PreFlightGateName` · `DISPATCH_ROWS` · 让位条件）· `session/refusal.ts`（`PreFlightRefusal` · `RefusalState`）· `session/dispatch-authority.ts` · `face/cli.ts#Cli.#recoverRun` 的三 leg 授权面 · `contract/preflight-rows.ts#RowStation`（四个站名——它们是门行集的成员，不是与行集并列的第二组）（读行为）
- T9 落点 `docs/judging/task-graph.ts#TaskGraph`（`#validate()` 与静态 `detailLine()`）：`graph` 腿判的是注入的 plan read 交上来的那个图，门 `new` 不出第二份边规则，只读失败集
- T10 落点 `docs/judging/closure.ts#ClosedDocument`：`checked:` 面的让位行读它——已闭合文档上带 `skipWhenClosed` 的声明读作让位，门只拼那一行

#### Produces
- `PreFlight#vet(context)` → 逐行读数与整段裁决；行集从 `PreFlightGateName` 的闭集派生：结构腿（`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract`）与 `RowStation` 的四个站名（`no-host` · `carrier` · `dispatch-input` · `artifact`）是同一个行集的两部分——站名是行集的成员，不是与之并列的另一组；某个面命中多少行是该面的函数（plan · wave · branch 三个面各不相同），不写常数；让位条件按既有两处（那一行的读值取 T10 的 `docs/judging/closure.ts#ClosedDocument`，门只拼行、不另算闭包）；`graph` 腿唯一的判定来源是 T9 的 `TaskGraph#validate()`（失败集逐条经 `detailLine()` 拼成 detail），门里不重算边
- `RefusalState`：树上至多一条拒绝事实、两个到期触发点（结构腿不拒绝时的门口清理 · `InFlight#release`）
- `authority`：三条 leg 各自的授权条件（leg ① = in-flight 门放过 ∧ 记录 stale；legs ②③ = 结构腿通过）

#### Steps
- 写行集的 pin — checkable: 行集从 `PreFlightGateName` 单一派生；插入一条新行即改读面（不写字面行数）；`RowStation` 的每个站名都在行集里（包含关系，不是两集相等），理由集 `PreFlightReason` 的每行可读
- 写 `graph` 行的 pin — checkable: 一份 `DependsOn` 自环的 plan ⇒ `graph` 行拒绝且 `reason: graph`，`details` 列出该边；把注入的 `TaskGraph` 换成一个恒空的假实现 ⇒ 该用例红（否则这条腿是空真）
- 写「拒绝不写轮次」的 pin — checkable: 任一行拒绝后账本轮次数不变、树上多一条拒绝事实
- 写至多一条的 pin — checkable: 连续两次拒绝 ⇒ 树上仍只有一条（后者不覆盖前者或按旧行为拒绝，pin 钉住那一种）
- 写两个到期触发点的 pin — checkable: 九行全过 ⇒ 事实被清；`InFlight#release` ⇒ 事实被清；其它路径不清
- 写三 leg 授权的 pin — checkable: 活 holder + `--recover` ⇒ leg ① 不成立（flag 不越过活着）；stale 记录 + doc-contract 拒绝 ⇒ leg ① 仍成立（记录关于树）；legs ②③ 在结构腿拒绝时不成立
- 写让位条件的 pin — checkable: 无输入面的 wave 派发 ⇒ 四行一起让位；在四行之前被拒 ⇒ 四行不记
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/run` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
六组 pin 齐（行集派生与 `graph` 腿只读 T9 的失败集 · 拒绝不写轮次 · 至多一条 · 两个到期点 · 三 leg 授权 · 两处让位）；`run/gate` 在 `run/` 内的边只向下依赖 `run/ledger`（跨片读 `docs/` 的判据是它存在的理由，不是第二层）；拒绝事实的路径由 `env.workspace` 的拼写矩阵给出。

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
- `values`：`DispatchValues`（身份 · 场景 · 快照三格扁平事实 → 扁平记录）——预帧的一道装配，相对化只发生一处，四个行与渲染面读同一份
- `liveness`：活性判官（轮日志增长与进程组 CPU 两条腿，四态；每轮一个实例，不可读期保留上一次读数而不是清零）
- `handoff`：手交契约（键集）与读回（失败分型：缺失 / 畸形 / 违约）· 结论派生三路——findings 里有 blocker ⇒ `CHANGES_REQUESTED`，只有 warn ⇒ `REVIEW_FIX`，findings 为空 ⇒ `APPROVED`
- `inflight`：`InFlight#acquire` / `#inspect` / `#release`；`InFlightState` 三种 kind（absent · held · corrupt）
- `__tests__/handoff-plane.guard.test.ts`：手交面守卫（`precommit` 今天指向旧树的同名文件，翻面时随 T18 改指这一处）

#### Steps
- 写「孩子前零记录、收工后无残留」的 pin — checkable: 注入一个立即失败的 spawn ⇒ 无 in-flight 残留；正常收工 ⇒ 记录建立后被释放
- 写 in-flight 三 kind 的 pin — checkable: 空闲 · 持有 · 记录损坏三态各一条；损坏按无锁放行但报文点名
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
立起推进层：管线前沿、波次前沿、行相位事实、目标类型表、单轮生命周期、闭合判定、`next:` 与 `reason:` 的六格装配。**不变量**：前沿是账本的投影，不是第二份判断；单轮生命周期只是一次派发的一步，目标类型的差异住在表里，不撒在分支里。

#### Files
- Create: `packages/cdd-engine/src/run/advance/pipeline.ts`
- Create: `packages/cdd-engine/src/run/advance/wave.ts`
- Create: `packages/cdd-engine/src/run/advance/line-phase.ts`
- Create: `packages/cdd-engine/src/run/advance/target-faces.ts`
- Create: `packages/cdd-engine/src/run/advance/lifecycle.ts`
- Create: `packages/cdd-engine/src/run/advance/next.ts`
- Create: `packages/cdd-engine/src/run/advance/__tests__/advance.test.ts`
- Modify: `packages/cdd-engine/src/run/index.ts`

#### Consumes
- 旧树的 `session/pipeline.ts` · `session/wave.ts` · `session/next.ts#Route` · `session/run.ts`（单轮生命周期：前沿 → 派发 → 结果 → 记账 → 改道）· `session/faces.ts`（目标类型表：审计目标 · 产物面 · next 消费语义）· `face/gate.ts`（行相位事实与行身份事实；它里面的两处拒绝措辞不搬到这里——措辞归 `surface/render`）（读行为：六格装配、drift 重开、波次 frontier、闭合判定）
- T9 落点 `docs/judging/task-graph.ts#TaskGraph`（`#batches()` 与 `#frontier(done)`）：波次前沿是它的读，`advance` 不持第二份波分解——旧树的 `session/graph.ts` 因此不在本任务的移植清单里

#### Produces
- `advance`：`frontierOf(slug)` · `nextOf(frontier)` → 六格 `NextHop` · `reasonOf(hop)` · 波次 frontier（读 T9 `TaskGraph#batches()` 与 `#frontier(done)`，不另建）
- `line-phase`：行相位与行身份事实（从 `run/gate` 的授权面派生），**零措辞**——拒绝措辞由 `surface/render/route.ts` 按 hop 拼出，`run/advance` 不 import `surface`
- `target-faces`：每个目标类型一行（审计目标 · 产物面 · next 消费语义）——新类型是表行，不是生命周期的分支
- `lifecycle`：`Lifecycle#advance(frame)`——一次派发一步（前沿 → 派发 → 结果 → 记账 → 改道），目标类型差异只经 `target-faces` 的表行
- `Run` 门面收口：`advance(frame)` / `boardOf(slug)` / `inflightOf()` / `refusalOf()` / `recordRound(...)` 五类成员

#### Steps
- 写前沿是投影的 pin — checkable: 同一账本两次取前沿结果相同；改一条账本事实即改前沿（没有第二份缓存）
- 写目标类型表驱动的 pin — checkable: 新增一行表即改派发，不动生命周期代码（测试以两行表驱动同一个 `Lifecycle`）
- 写单轮一步的 pin — checkable: 一次 `advance` 只消费一个 attempt 且前沿推进一格（连调两次 ⇒ 两格）
- 写六格装配的 pin — checkable: 六格逐格一条；`next:` 字节与 `reason:` 行按格派生
- 写 drift 重开的 pin — checkable: 审过的文档被轮外改动 ⇒ 该行不再算闭合；闭合后前沿前进
- 写波次 frontier 的 pin — checkable: frontier 五个 ⇒ 派发面报 `wave-too-wide`（不是 `split`）；`--tasks` 四个 ⇒ `too-many-tasks`
- 写闭合终态的 pin — checkable: 零 blocker 的 fix 轮之后该行不再被判回 review；review 空 findings 判 APPROVED
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/run` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
五组 pin 齐（投影无缓存 · 六格 · drift 重开 · 波宽三档 · 闭合终态）· 目标类型表驱动与单轮一步各一条；`run/index.ts` 的五类成员集 pin 绿；`advance` 不 import `surface`。

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

#### Consumes
- 旧树的 `face/words.ts`（`CAPSULE_WORDS` · `WORDS.checked.inFlight` 行集 · 阻断措辞 · `GUARD_BAN_WORDS` 退役词表）· `contract/preflight-rows.ts#RowStation` 与 `session/preflight.ts#PreFlightReason`（站名与理由两个闭集的单一源）

#### Produces
- `WORDS`：拒绝站名闭集（就是 `RowStation` 的那四个值：`no-host` · `carrier` · `dispatch-input` · `artifact`——它是门行集 `PreFlightGateName` 的成员集，不是与之并列的第二集）· 拒绝理由闭集 `PreFlightReason` 的各行 · 阻断前缀 · `checked.inFlight` 五行 · capsule 两槽 · 板面 token · `GUARD_BAN_WORDS`（退役词表，单份——kairos 的 `words.test.ts` 消费它）
- `ISSUE_TYPES`：issue 类型集的单一源（`IssueBodyRenderer` 的 `types` 由它派生，kairos 的 `issue-type-contract.test.ts` 翻面时改指这一处）
- `Words`：词表面访问类（`Translator` 与 `IssueBodyRenderer` 的构造入参——`new Words()` 取到的就是这一份词行，不另建第二张表；kairos 的 `issue-type-contract.test.ts` 与 `words.test.ts` 翻面时改指这一处）
- `surface/index.ts` 的 `Cli` 门面骨架（本任务只露词表）
- `__tests__/words.guard.test.ts`：引擎字面量守卫（`precommit` 今天指向旧树的同名文件，翻面时随 T18 改指这一处）

#### Steps
- 写站名闭集的 pin — checkable: 站名集就是 `RowStation` 的四个值，且每个站名都在门行集 `PreFlightGateName` 里（断言包含，不断言两集相等）；理由集 `PreFlightReason` 的每行可读
- 写 `checked.inFlight` 行集的 pin — checkable: 五行齐（free · held · stale · corrupt 有锁 · corrupt 无锁）
- 写 capsule 两槽的 pin — checkable: `status · handoff` 两槽；槽序固定
- 写「第二份拷贝即红」的 pin — checkable: 同一措辞在词表外出现一次即红（扫 `surface/**` 的字面量，豁免渲染器的模板）
- 写 issue 类型集与词面类的 pin — checkable: `ISSUE_TYPES` 与渲染器的 `types` 逐值相等（断言从 `ISSUE_TYPES` 派生，不手写类型字面）；`new Words()` 对同一词行两次读产生同一份值
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/surface` 绿
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
五条 pin 齐（站名是门行集的成员 · in-flight 五行 · capsule 两槽 · 措辞单份 · issue 类型集与 `Words` 词面类）；`surface/words` 对 `run/` 只经类型读，不调 `Run` 的方法。

#### DependsOn
6, 11

### Task 15: `surface/` 的渲染

#### Objective
把事实渲染成消费者字节：prompt 模板（两带）、胶囊、板面两态、预览块、图、issue body、brief。**不变量**：消费者拿到的字节就是契约。

#### Files
- Create: `packages/cdd-engine/src/surface/render/templates.ts`
- Create: `packages/cdd-engine/src/surface/render/capsule.ts`
- Create: `packages/cdd-engine/src/surface/render/board.ts`
- Create: `packages/cdd-engine/src/surface/render/preview.ts`
- Create: `packages/cdd-engine/src/surface/render/graph.ts`
- Create: `packages/cdd-engine/src/surface/render/route.ts`
- Create: `packages/cdd-engine/src/surface/render/issue.ts`
- Create: `packages/cdd-engine/src/surface/render/brief.ts`
- Create: `packages/cdd-engine/src/surface/render/__tests__/render.test.ts`
- Modify: `packages/cdd-engine/src/surface/index.ts`

#### Consumes
- 旧树的 `render/templates.ts`（`WORK_MODES` · `TEMPLATE_PROMPT.modes` / `.reviews` · `REVIEW_VARIANTS` · `$version`）· `render/brief.ts` · `render/issue-body.ts` · `face/capsule.ts` · `face/board-view.ts` · `face/preview.ts` · `face/graph-view.ts` · `face/route-render.ts` · `face/artifacts.ts#CliArtifacts#runIssue`（stdin JSON 契约与违约报文）· `face/gate.ts` 的两处拒绝措辞（读行为与字节）

#### Produces
- `templates`：两带 prompt（modes 三行 · reviews 每 `TargetType` 一行）· `$version` 原值不变
- `capsule` / `board`（两态）/ `preview` / `graph` / `issue` / `brief` 各一个渲染类，全部只读 `words` + 事实对象；`issue` 连同它的输入契约：stdin 的 findings JSON 缺键 / 多键 / 类型错三类违约各一行报文（渲染器在渲染前自己判，壳只读 stdin 并打印）
- `route` 渲染器（`surface/render/route.ts`）：`next:` 与行门族那两处拒绝措辞的**唯一拼装点**（措辞取自 `words`，`run/advance` 不拼字节）；胶囊与板面都经它取值，所以两处的 `next:` 逐字节相同，不是各拼一次
- `surface/index.ts` 扩出各渲染入口

#### Steps
- 写 prompt 两带的 pin — checkable: `modes` 键集 = `WorkModeRowKey`（implement · fix · docs-fix）；`reviews` 每 `TargetType` 一行，六行齐；`$version` 与旧树相同
- 写模板字节等价 — checkable: 对同一组输入，新渲染器与旧渲染器字节相同（对账器的 prompt 格由本任务接上）
- 写胶囊的 pin — checkable: `status · handoff` 字节；handoff 缺席时的形态
- 写 `next:` 单点拼装的 pin — checkable: 同一 `NextHop` 经胶囊与板面渲染 ⇒ 两处 `next:` 字节相同（把 `route.ts` 的拼法改一处，两处同时变）
- 写板面两态 — checkable: 默认零 notes 正文且带 `notes +M`；`--notes` 展开后正文全量、token 段序不重排
- 写预览块 — checkable: 五类行（`step:` / `reads:` / `would write:` / `would record:` / `child:`）齐且零 `next:` 行
- 写 issue 输入契约的 pin — checkable: 合法 JSON ⇒ 字节与旧树相同；缺键 / 多键 / 类型错三类各一条报文且退出码为错用码
- 写措辞单份的复审 — checkable: `surface/render` 里不出现词表外的散文措辞（沿用 T14 的扫法）
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/surface tests/parity` 绿（对账器按 T2 的 GAP 口径：已接线的格零差异、未接线的格计入 GAP，不判红）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
七组 pin 齐（两带名册 · 字节等价 · 胶囊 · `next:` 单点拼装 · 板面两态 · 预览五类行 · 措辞单份）· issue 输入契约一条；prompt / 胶囊 / 板面 / 预览四类格在对账器里逐字节比。

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

#### Consumes
- 旧树的 `face/cli.ts`（八命令的旗标、值域、退出码；场景装配与判定面不在壳里，回 `run/`）· `face/declare.ts`（`CliVerb` · `ARGV_CHANNEL` · `VALUE_SHAPES`）· `face/projection.ts`（命令树装配：八条命令的描述 · 嵌套的叶 · 绑定规则 · 值域校验 · 帮助注入）· `face/artifacts.ts#CliArtifacts`（三条纯命令的取参—调用—输出序列；产物面本身不在壳里）

#### Produces
- `declare`：`CliVerb` 八值 · 旗标与值域声明（单源）· `ARGV_CHANNEL`
- `projection`：命令树装配——`declare` 的单一表面在构造期一次装配成 commander 树（描述 · 嵌套叶 · 绑定规则 · 值域校验 · 帮助注入 · `REQUIRED_GROUPS` 钩子），`program` 是唯一出口
- 八条壳：每条一个类，方法体只取参、调一个入口、输出
- 三条纯命令的产物面无新落点：`base` 的读与写走 `env/workspace/base-artifact.ts`（T3，`BASE_ARTIFACT_FIELDS` 从那里导出）· `issue render` 的渲染与输入契约走 `surface/render/issue.ts`（T15）· 骨架走 `docs/skeleton/assembler.ts`（T9）· 系统时钟走 `env/process/clock.ts`（T5）；壳只取参、调它们、原样输出。`base` 的基产物读写与 `init` 的 `Provisioner` 由组合根构造后经 `Cli` 注入到壳里，壳只持它们的类型，不自己 new
- `Cli#run(argv)`（`surface/index.ts`）
- `__tests__/channel-closure.guard.test.ts`：通道闭合守卫（读 `declare` 的 `CLI_COMMANDS` / `ARGV_CHANNEL` 与 `env/process/host.ts` 的 `HOSTS` / `DISPATCH` / `REFS`；守卫读产品面的单源，不另立白名单。`precommit` 今天指向旧树的同名文件，翻面时随 T18 改指这一处）

#### Steps
- 写动词集与值域的 pin — checkable: 八值齐；每个旗标的取值形状在声明面；`--type` 的六值
- 写薄壳的判据 pin — checkable: 每条壳的实现体里没有文件读写、没有判定、没有字符串拼装（扫 import 面与调用面：壳不 import `node:fs`、不 import `run/gate`、不 import `env` 的 IO 面——`env/workspace/base-artifact.ts` 的写入口与 `env/process/child-runner.ts` 的 spawn 面；`base` 与 `init` 只 import 注入实例的类型，实例在组合根构造；也不在输出前拼字节）；行数只在评审面陈述，不进套件——把一条诊断换成指标，后续实现者会去压行数而不把判定挑出去
- 写三件事的 pin — checkable: 每条壳的调用面只有一个入口（一个 `run/` · `docs/` · `env/` 的方法），无第二层判断分支
- 写退出码的 pin — checkable: 正常 0 · 拒绝 1 · 错用 2 · 未知命令 2，各一条
- 写 help 与 usage 的 pin — checkable: `--help` 形面与 usage 字节；子命令树可读；对账器的 `--help` / usage / 错用码 2 三格由本任务接上
- 全片跑绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/surface tests/parity` 绿（对账器按 T2 的 GAP 口径：已接线的格零差异、未接线的格计入 GAP，不判红）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p39):` 起头

#### Acceptance
pin 齐（动词集与值域 · 壳零文件 IO 零判定零拼装 · 壳调用面单入口 · 四个退出码 · help/usage 字节）；三件事的入口面含 `env/`，`base` 与 `init` 的产物面实例由组合根注入（壳里零 `new`）；八条壳全部只经 `surface/index.ts` 的 `Cli` 对外。

#### DependsOn
12, 13, 15

### Task 17: 组合根与对账首绿

#### Objective
把四片接成一棵树：`src/bin.ts` 成为唯一组合根，具体类在此 new，其余全部经构造参数收协作对象。本任务的终判是**对账器第一次全绿**——那就是「复刻成立」的证据。

#### Files
- Modify: `packages/cdd-engine/src/bin.ts`
- Create: `packages/cdd-engine/src/__tests__/composition.test.ts`
- Create: `packages/cdd-engine/src/__tests__/smoke.integration.test.ts`
- Modify: `packages/cdd-engine/tests/parity/parity.test.ts`

#### Consumes
- 四片的入口（`Env` · `Documents` · `Run` · `Cli`）· spec §2.2 的八个面

#### Produces
- `src/bin.ts`：唯一组合根，构造 `Env` → `Documents` → `Run` → `Cli` 并接线；导出的 `main` 写成箭头常量（`export const main = …`，不是裸 `function`——后者会撞 `check:no-bare-functions`），可被 `node src/bin.ts` 直接跑（tsx 或编译后）
- `composition.test.ts`：组合根是唯一 new 具体类处（扫 `src/**` 的非测试文件，`new Env` / `new Run` / `new Cli` 只在此出现）
- `smoke.integration.test.ts`：与旧脚本同形的一条集成测试——起 `src/bin.ts` 的真子进程，断言 `--help` 面与 `--dry-run` 的五类行，零仓内写入。它占住 `packages/cdd-engine/package.json#scripts.smoke` 在翻面后要指向的靶子（T18 只改指向，不删行）

#### Steps
- 接四片 — checkable: `node --experimental-strip-types src/bin.ts board --help` 或经 `tsx` 跑通一条命令，退出码 0
- 写组合根唯一性 pin — checkable: 除 `src/bin.ts` 外，非测试文件里没有 `new` 四片入口的调用
- 写新树的 smoke 集成测试 — checkable: `pnpm -C packages/cdd-engine exec vitest run src/__tests__/smoke.integration.test.ts` 绿，且它起的是真子进程（假 spawn 不算）
- 对账器接新树一侧 — checkable: `pnpm -C packages/cdd-engine exec vitest run tests/parity` 对八面逐格比
- 收敛差异 — checkable: 差异格数逐轮下降至零；**每一处差异都按旧行为改新树**，不按新树改基线（改基线即自欺，基线是证据）
- 对账首绿 — checkable: `pnpm -C packages/cdd-engine exec vitest run tests/parity` 全绿，且 T2 的接线名册里没有未接线的格（GAP 集合为空——有就说明那一面从未被比过，全绿是空真）
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
- Modify: `package.json`（`scripts.typecheck` 去掉旧树工程 · `scripts.check:no-bare-functions` 的扫描根 · `scripts.precommit` 三条守卫路径改指 `src/`）
- Modify: `packages/kairos/tests/`（8 个文件的 import · 用到的导出 · 注释里指向旧树的路径举例）
- Modify: `scripts/__tests__/next-loop-twin.test.ts`、`scripts/__tests__/journey-twin.test.ts` 及其路径常量
- Modify: `scripts/lib/scan.ts`（注释里那条举例的旧树路径）
- Modify: `README.md`、`README.zh-CN.md`、`packages/cdd-engine/README.md`、`packages/cdd-engine/README.zh-CN.md`、`AGENTS.md`
- Modify: `docs/diagrams/src/*.json`（六份）
- Delete: `packages/cdd-engine/src-next/`
- Delete: `packages/cdd-engine/tests/parity/`

#### Consumes
- spec §3.3（十一序）· §3.4（零残留的范围与「已是生成物还是手维护」的分界）
- 旧树的 `precommit` 三条守卫路径（`face/__tests__/channel-closure.guard.test.ts` · `face/__tests__/words.guard.test.ts` · `session/__tests__/handoff-plane.guard.test.ts`）与它们在新树的三个同名落点（T16 · T14 · T12）

#### Produces
- 编译面（`rootDir` · `include` · `exclude` 三键）/ 测试 include / smoke 脚本 / 零裸函数扫描根全部指向 `src/`：`package.json#scripts.smoke` 改指 `src/__tests__/smoke.integration.test.ts`（T17 交付的那一件——改指后它仍收集到一条真子进程集成测试，不是指向一个空靶子）；零裸函数扫描根去掉旧树那一段（`src` 在 T1 已加入）
- `tests/parity` 的 include 与它的 tsconfig 工程同批删除；对账器与基线随之销毁
- 树外测试面与五份手维护文档改指新入口；六份图源改真
- 三条守卫改指新落点（不是删掉三条路径）：`precommit` 的 `src/surface/commands/__tests__/channel-closure.guard.test.ts`（T16）· `src/surface/words/__tests__/words.guard.test.ts`（T14）· `src/run/dispatch/__tests__/handoff-plane.guard.test.ts`（T12）
- 树外消费的符号改指清单（每一个都有新落点，没有一个是「删掉 import 即可」）：`SKILL_ANATOMY` → `docs/identity/skill-anatomy.ts` · `HOSTS` / `REFS` / `DISPATCH` / `HostDetect` / `ENGINE_RUNTIME` → `env/process/host.ts` · `BASE_ARTIFACT_FIELDS` → `env/workspace/base-artifact.ts` · `Translator` → `docs/identity/translate.ts` · `GUARD_BAN_WORDS` / `CAPSULE_WORDS` / `ISSUE_TYPES` / `Words` → `surface/words/words.ts` · `CLI_COMMANDS` / `ARGV_CHANNEL` → `surface/commands/declare.ts` · `IssueBodyRenderer` → `surface/render/issue.ts` · `MAX_TASKS_PER_WAVE` → `docs/judging/wave-width.ts` · `REVIEW_CYCLE_CAP` → `run/advance/next.ts` · `CliLifecycle` → `Run` 的 `advance` 面（`run/advance/lifecycle.ts`）
- `tests/parity/` 整个目录删除（不是只删 include）：它 import 旧树，留着就撞本任务自己的零残留验收

#### Steps
- 改编译面与测试面 — checkable: `pnpm run typecheck` 绿（四个工程里旧树位置换成 `src`）、`pnpm -C packages/cdd-engine exec vitest run` 收集到 `src/**` 与不再收集 `src-next/**`；`tsconfig.build.json` 的 `rootDir` / `include` / `exclude` 三键同批改指（`exclude` 成 `src/**/__tests__/**`），且 `pnpm -C packages/cdd-engine build` 之后 `dist/` 下没有 `__tests__`
- 改 smoke 指向与扫描根 — checkable: `pnpm -C packages/cdd-engine run smoke` 收集到 `src/__tests__/smoke.integration.test.ts` 且 exit 0；`pnpm run check:no-bare-functions` 的扫描根不含旧树路径且零命中
- 改树外测试面 — checkable: `pnpm -C packages/kairos test` 绿（8 个文件里的 import 与它们用到的导出逐条改指，含 `ISSUE_TYPES` 与 `Words`）；同批去掉这些文件注释里指向旧树的路径举例（与 `scripts/lib/scan.ts` 那条同一口径——验收把注释也算在内）；`grep -rn 'src-next' packages/kairos/tests` 零命中（注释也算）；`pnpm exec vitest run` 绿（两个孪生与路径常量已改）
- 改 `precommit` 的三条守卫 — checkable: `pnpm run precommit` 绿，且三个守卫文件都在新树上（改指到一个不存在的路径，precommit 会当场红）
- 改五份手维护文档 — checkable: 五份文档里 `src-next` 零命中
- 改六份图源 — checkable: `docs/diagrams/src/*.json` 六份里旧树路径零命中；`pnpm run emit` 后 `docs/diagrams/*.html` 随之重生（不手改 HTML）
- 删旧树与对账器 — checkable: `packages/cdd-engine/src-next/` 与 `packages/cdd-engine/tests/parity/` 都不存在；对账器的 include 与它的 tsconfig 工程已删（根 `typecheck` 链里不再点名它）
- 重生生成物 — checkable: `pnpm run emit` 后 `pnpm run emit:check` 报 fresh
- 全绿 — checkable: `pnpm run validate` exit 0；`pnpm run check:dist-smoke` 绿（dist 由新树产出）
- 失败面的处置写进验收 — checkable: 若 `validate` 或 `dist-smoke` 红而对账器绿，处置是回 T2 的语料面补一种形态（因为这说明语料缺臂），**不改判据、不改基线**；若为了让翻面绿而动了消费者字节，按缺陷处理
- 提交 — checkable: `git log -1 --format=%s` 以 `chore(p39):` 起头

#### Acceptance
spec §3.3 的十一序逐步可核；旧树路径在代码 / 配置 / 脚本 / 图源 / 五份手维护文档 / 树外测试文件里零命中（历史文档的记录面除外，按 §3.4 的分界；注释里指向旧树的举例也算在内——`scripts/lib/scan.ts` 与 kairos 测试面同一条口径）；`packages/cdd-engine/tests/parity/` 不存在；`pnpm -C packages/cdd-engine run smoke` 绿；`pnpm run validate` exit 0；`check:dist-smoke` 绿；`emit:check` fresh；`pnpm -C packages/kairos test` 与根套件绿。

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
