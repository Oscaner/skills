# 引擎文档工具（Engine Doc-Tooling）— P5 设计：整引擎 + repo CI 验证脚本重整
- **Version**: v0.6 · 2026-10-13
- **Status**: Draft
- **Author**: Oscar M. · Claude Opus 5（kairos:cdd-design [P5] 会话 · 用户裁定 · 2026-10-12）
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](2026-10-10-engine-doc-tooling-overall.md)
- **Depends on**: P4（Done · v0.6 · hard——P4 拆分后的 face/lifecycle/gate/artifacts 晶体为 P5 整树 + CI 验证面重整基座）

## Design

本 phase 收口「程序收敛后重开」的六前提整树 mandate（D17 · 2026-10-12 用户六要求裁定 · **scope 澄清「不是终审——基于这六前提，重整整个引擎和 repo ci 验证脚本」**）。六前提从「phase 内许可」升格为 P5 独立 phase 的执行标准，目标面 = **整个引擎**（五面 + 组合根 + bin + 测试面）+ **repo CI 验证脚本**（scripts/）。用户的最大心智负担：**仓库根脚本只是用来跑 tests、做 ci 测试门的，而不是独立的一套 tests**——校验逻辑须按产物归属迁入各 package 的 test plane，repo 根不实现、不承接任何验证逻辑。设计输入：kairos:cdd-design [P5] 会话（D17 注册 · D18 grilling 九裁定 Q1→b / Q2→a / Q3→a / Q5→a 修订 / Q6→a / 归属模型 / Q7a→a / Q7b→a / Q8→a / Q9→a）· overall v2.9（D18）→ v2.10（D19 · 2026-10-12 · 用户 in-flight 需求 backfill · schema gen→get 并入）→ v2.11（D20 · 2026-10-13 · 用户 in-flight 消费面需求 backfill · 消费面 skill 文本精简）——九裁定收敛为：消费共享（校验逻辑沉淀引擎可消费 · seeds 两个组合根共享核心抽象）· 字面零裸函数（含组合根）· 破坏性两层全开 · 字节语义 major（next: 字面冻结 · 功能语义不变）· 不发布 · docs 不验（三 docs 门撤下根）· 校验归域（guard checks 进各自 package suite）· CI 原生分身（validate.ts 解散）· smoke 迁引擎 + emit 六前提重整 · 单 phase-spec 收口。

### 1. 目标与边界
#### 1.1 设计输入与授权
- 设计输入：kairos:cdd-design [P5] 会话（D17 注册 · D18 grilling 九裁定 · overall v2.9）· overall v2.10（D19 · 2026-10-12 · 用户 in-flight 需求 backfill · schema gen→get 并入）· 用户六前提整树 mandate（2026-10-12 · 程序收敛后重开）· **scope 澄清「不是终审——基于这六前提，重整整个引擎和 repo ci 验证脚本」**——六前提从「phase 内许可」升格为独立 phase 执行标准
- **授权（Q3→a · 两层全开）**：破坏性变更覆盖内部结构层（代码/目录/抽象形状全开）+ 消费者字节契约层（命令/旗标/退出码/值域可重排）· **kairos skill 消费面随之同步改**——但 **`next:` 字面冻结**（可执行命令字面化 · 不简洁化 · I2 已验证）· **功能语义不变**（Q5→a 前提 · 领域 run 语义零动）
- **发布姿态（Q6→a · 不发布）**：变更集归并到 major 语义落 pending · 打 tag / publish = 独立动作
#### 1.2 两个 package 的域模型（心智负担基准）
- **两个 domain**：cdd-engine（引擎 · 五面 + 组合根 + bin + 测试面）与 kairos（six skills + 消费面 + 测试面）——**tests 已按两域划分**（引擎 vitest · kairos node:test）· **repo 根 scripts 不做测试承接、不实现验证逻辑**——只「统领领域测试 + 做 CI 门」（用户最大心智负担：仓库根脚本只是跑 tests / ci 测试门，不是独立的一套 tests）
- 心智负担基准（D18①）：根脚本回归「薄 CI 门」形态 · 校验逻辑按产物归属迁入各 package test plane · 根零验证实现 · GH Actions 原生跑 suite
#### 1.3 非目标（冻结面）
- 领域 run（Lifecycle/PreFlight/Capsule/host）语义零动 · doc-contract 判定语义不变（gate 零例外）· **next: 字面冻结**（可执行命令字面化 · I2）· 文档方法论语义不变 · 跨程序 rename sweep 面（`src-next` 字面 · D8 拆 pin）· 不发布（Q6）· 不引入新 doc 型/新文档结构（P2 既定）

### 2. 校验归域（验证逻辑迁入所属 package test plane）
#### 2.1 归域图（checks → 归属判定）
- `checkAnatomy`（SKILL 结构合约 · 扫 `packages/kairos/skills/*/SKILL.md` · 判压基础 = 引擎导出 `skill-anatomy` 契约）→ **kairos test plane**（kairos 拥有产物 · 契约引擎单源导出 · workspace: 依赖消费）
- `checkWords`（词表禁令审计 · 技能散文 + 引擎字面）→ **分域拆**：技能散文面 → kairos · 引擎字面面 → engine · 词表单源保留 `face/words.ts` 导出
- `checkChannels`（CLI 通道闭包 + host-marker 闭包 · 扫 `face/declare.ts` + `face/host.ts`）→ **engine test plane**（colocated vitest · P3 既有 channel-closure 单面自检同族）
- `checkHandoffPlane`（P4 扩项 · 扫 `session/handoff-schema.ts` + 写平面声明派生）→ **engine test plane**（colocated vitest）
- `checkClaimedPins`（声称→pin lint · 扫 docs）→ **撤销**（docs 不验 · 语义判断已在引擎 review lens · root 机器 lint 删除）
- `checkDocContract`（引擎 `Contract` 判压全部 docs/kairos）→ **撤销**（docs 不验 · PRECONTRACT_DOCS 豁免窗同撤 · 合法性交 workflow）
#### 2.2 kairos test plane 承接（skill 解剖 + 技能词面）
- **skill-anatomy 检查迁入 kairos tests**：新 test（如 `skill-anatomy.test.ts`）以 node:test 扫 `packages/kairos/skills/*/SKILL.md` —— 判压实现 = 引擎导出的 `skill-anatomy` 契约（kairos package.json 已依赖 cdd-engine `workspace:*`）· 走查器（analyzeSkill · digraph/section 抽取）落 kairos test 辅助层 · **root `checkAnatomy` 删除**
- **技能散文词面审计迁入 kairos**：以引擎 `GUARD_BAN_WORDS` 导出为基准 · 引擎源字面/注释对应检查落 engine（分域拆）
#### 2.3 engine test plane 承接（channel/handoff 闭包 + 引擎词面）
- **checkChannels 迁 engine colocated vitest**：channel 闭包（command keys × flag channels）+ host-marker 闭包（detect env keys ∪ PATH）落 `face/__tests__/`（P3 已建 channel-closure 单面内自检同族）· **root `checkChannels` 删除**
- **checkHandoffPlane 迁 engine colocated vitest**：声明面闭合 · engineOnly 卫生 · 写平面声明派生（P4 §3.1 机件）落 `session/__tests__/` · **root `checkHandoffPlane` 删除**
#### 2.4 docs 不验（三 docs 门撤销 · 合法性交 workflow）
- **checkDocContract 撤销**：`PRECONTRACT_DOCS`（33 个 pre-contract 豁免窗）同撤 · 根零 docs 扫描 · 文档结构合法性由引擎 review/fix dispatch 门**用时自判**（`cdd review --type spec/plan` 的 doc-contract 判定保留——它是引擎能力，非 root verify 实现）
- **checkClaimedPins 撤销**：声称→pin 判断留在引擎 review lens（P4 已入契约行）· root 机器 lint 删除 · 零平行实现
- **连带删除**：docs 校验不再入 CI / precommit 步骤 · 验收证据改以「任一新建规范/计划文档 dispatch 时被引擎判压」为口径

### 3. CI 原生分身（validate.ts 解散 · GH Actions 原生 job）
#### 3.1 pr-validate.yml 原生 job 矩阵
- 从单一 `node scripts/run.ts validate` 改列原生 job/step：`pnpm -C packages/cdd-engine test`（引擎 suite）· `node --test packages/kairos/tests/*.test.ts`（kairos suite）· `pnpm run typecheck` · `pnpm run emit:check` · 版本 sync 薄步——各在 action log **原生可见** · 失败归因到具体 job
- `scripts/validate.ts` 组合 runner（ValidateRunner / CheckBlock / SubprocessBlock / steps / precommitSteps）**解散** · `scripts/__tests__/validate.test.ts` + `scripts/__tests__/guard.test.ts` 随删（断言面随目标迁/撤）
#### 3.2 package.json scripts 收敛
- root `validate` 脚本改指原生命令序列（或直列 GH steps 不设 wrapper）· `precommit`（lint-staged catch-all `*`）改写为**原生命令序列**（tree-independent 子集：kairos suite + 包装门 + 引擎树无关步）· 局部 commit 门语义不降
- `scripts/run.ts` 收敛：`validate` / `precommit` / `smoke-cdd` 面删除 · `emit` / `emit-check` 保留（原生产物生成面）
#### 3.3 引擎 suite 并入 CI 的清理
- engine vitest 从 validate 步表解码为**独立 CI job**（它本因「dirty-tree 与引擎入口门不兼容」被 precommit 排除——CI 全量跑 · 局部 precommit 子集不含引擎 suite 的既定语义保留）

### 4. 字面零裸函数（含组合根 · 全局零命中 pin）
#### 4.1 引擎面两枚收口
- `bin.ts:24 bootEnvironmentProblem` → 收进类成员（`NodeEnvGuard` 类静态判 · 或组合根的 static 成员）· 环境守卫语义保（Node floor 门 · 退出消息字节零变）
- `face/cli.ts:819 export function cli()` → 收为组合根 static 工厂（`Cli.create(opts)` · 或 boot 类）· 组合根入口即类 · `bin.ts` 调用类成员
#### 4.2 scripts 面裸函数收类族
- `lib/scan.ts` → `WalkTarget` / `ScanToken` 类族（walkTarget · scanToken · isQuotedDataRow 收 static 成员）
- `lib/first-party.ts` → 类成员（firstPartyNames）
- `emit.ts` → manifest 映射类族（deriveFirstPartyPlugin · normalizeAuthor · repoUrl · stripVcs · claudeManifest · cursorManifest … 收成员 · 声明单源投影）
- `validate.ts` 残余 / `run.ts main` → 收类或随面删除（§3.1）· 迁移辅助随迁（§6.1）
#### 4.3 零命中门禁
- **全局 pin**：引擎 + scripts 全部 `.ts`（含测试面）模块级 `function` / `export function` / `async function` 声明**零命中**（统一正则 `^(export )?(async )?function `——async 形态同入 · `run.ts:17 async function main` 在面内）· **组合根不豁免**（用户「只要留了口，必然会在未来逐渐变厚 · 语义边界无法稳定划分」）· 门禁 = 结构性 grep pin 入 CI + 局部 commit 面
- **测试面全量纳入（零豁免）**：引擎 **15 个 test 文件现存 53 枚**模块级裸函数（`face/__tests__` 14 · `session/__tests__` 24 · `contract/__tests__` 7 · `render/__tests__` 1 · `src-next/__tests__` 7）+ scripts 测试辅助 2 枚（`scripts/__tests__/helpers/anatomy-fixture.ts`）均在门禁 scope 内 · 处置 = 逐文件迁移：test 辅助函数收为 describe/it 作用域内局部函数或 `const` 箭头形态（字节 pin `^(export )?(async )?function ` 以模块级声明为断言面——async 形态同入正则）· 随面销毁文件（§7.1）的裸函数随删 · **AC 计数以全员枚举为基**（源码面引擎 2 枚 + scripts 38 枚 · 测试面引擎 53 枚 + scripts 2 枚）

### 5. 字节语义 major（next: 字面冻结 · 功能语义不变）
#### 5.1 字节许可面 vs 冻结面
- **许可面（Q3→a · Q5→a）**：命令树组织（可合并/精简/更名）· 旗标命名与值域（可收紧/改名）· 帮助/usage/错误字节（可重排）· 退出码呈现——均为 **deliberate 更替**（每项 = vitest pin 重锚 + smoke 锚同步 + kairos 消费面同步）
- **冻结面（用户裁定）**：`next:` 字面保持**可执行命令字面化**（不简洁化 · 不散文化 · 不抽象化——编排器心智负担 I2 已验证）· **功能语义不变**（六命令领域 run 语义 · doc-contract 判定 · 领域 run = 语义契约三保面）
#### 5.2 kairos 消费面同步
- 字节更替随同 kairos skill 文本（cdd-* SKILL.md 中的 dispatch 字面 · `next:` 引用 · 命令/旗标示例）同步改——消费面变更只发生在 author 节点表述（non-goal ④ 面）
- 引擎 vitest + smoke 门 + kairos 行为树全绿作证同步完整（presentation-surface / grep-sweep pins 翻新）
#### 5.3 测试 pins 处置
- **语义保面**：领域 run · doc-contract · `next:` 字面 pins 零动（或仅随 deliberate 更替重锚——重锚即 deliberate pin break · 非语义漂移）
- **new pins**：字节更替面 · 归域面（engine/kairos suite 全绿）· 零裸函数门禁 · smoke 新入口
- **变更集**：cdd-engine **major**（字节语义破面叙事 · 归域 · 外壳）· kairos **patch**（消费面同步——P5 本 phase 变更集类型 · 净 bump 另受累计 pending `.changeset/oscaner-key-rename.md`（`kairos: major` · breaking）支配，非 P5 声明）· **不发布**（Q6 · 净 bump 不影响发布姿态）· `changeset status` 无 empty 条目

#### 5.4 schema gen→get 并入（用户 in-flight 需求 · 2026-10-12 backfill）
- **需求（D19 · 用户裁定 · 2026-10-12）**：`schema gen` leaf 并入 `schema get`（单 leaf · 双渲染面）——`schema get <type> --output json` = 现 `schema get`（打印 doc-structure schema 声明面 · **无需 target**）· `schema get <type> --output skeleton <target>` = 现 `schema gen`（骨架渲染**直写目标 doc** · 填 prose in place · **target 必填**）· **`schema gen` leaf 消灭** · `--output` 值域 `json | skeleton` · did-you-mean 候选随命令树更新（`schema g` 前缀仍入候选）· target 条件必填（仅 `--output skeleton` 时要求）· 值域/定形细节归 plan
- **根因（D19 · 用户 backfill 修正 · 2026-10-12）**：痛不在「`>` 重定向 vs 传参」的机制面，而是 **`<path>` 零约束**——旧面 `schema gen phase-spec > <path>` 的 `<path>` 由 shell 自由重定向（引擎不可见 · 无声明 · 无校验），author 会话可把骨架落任意位置（本次落 `/tmp` → 反读 → 再写目标 doc），二段式 dance 由此而生 · **修法 = 对 target 做约束**：target 升为**引擎声明必需参数**（通道表声明 · 精确校验），引擎直写该目标 doc——骨架就地生成于被 auth 的文档，并在**同一目标 doc** 填 prose in place，异路径中转结构性不可行（六前提⑤消费者心智负担）
- **消费面同步（§5.2 通道）**：kairos `cdd-spec-writer` SKILL.md `author-spec` dispatch 字面 `schema gen phase-spec > <path>` → `schema get phase-spec --output skeleton <path>`（`<path>`=目标 doc · 就地生成 · 零中间文件 · 随字节更替同步）
- **验收 pin**：引擎 vitest channel-closure pin（leaf 合并 · `--output` 值域 json|skeleton · schema type 必填 · target 条件必填（`--output skeleton` 时必填 · `--output json` 时省略 —— 且 `--output` 默认 json 保 `schema get <type>` 裸字面合法））· **schema get skeleton 直写目标 doc 的集成断言面**（engine vitest cli.test.ts/projection.test.ts——smoke-cdd 现全文件 `schema` 零命中 **无锚可同步** · 迁移引擎面时按其原始命令面 grep 复核（implement + review 二命令 + `--help` face · 非五命令））· kairos 行为树全绿作证 skill 字面同步
#### 5.5 消费面 skill 文本精简（2026-10-13 用户 in-flight 需求 backfill → D20）
- **需求（用户裁定）①**：**四个带 NEXT-LOOP 节点的 skill（cdd-spec-writer · cdd-plan · cdd-dev · cdd-design）的 NEXT-LOOP 节点不复述 `next:` 具体字面**——删除逐字复述（cdd-spec-writer L54 `fix --type spec…`+`done` · cdd-plan L58 `fix --type plan…`+`done` · cdd-dev L53 `fix --type wave…` + `implement --plan…` + `done`（三字面全复述 · 本轮最重面）· cdd-design L96 `done`）· cdd-close/cdd-report 无 NEXT-LOOP 节点（零动）· 只要求**遵循 `next:` 字面执行任务**（字面由 review 输出携带 · skill 重复 = 冗余复述 + 随字节更替漂移）· **各 skill 的 Review Convergence 不变体同简**（spec-writer I1 · plan I1 · dev I3 · design I2——不再枚举具体命令字面示例 · 保留规则句：`next:` 即派发 · 无 kind→command 映射层）
- **需求（用户裁定）②**：fix 派发父句 `(read file back to confirm)` → **`(confirm the findings · backfill user adjudications into the carrier)`**——读回 findings 确认 + 评审有裁定则**回填进 findings carrier**（spec-review 时用户裁决 `--expect-version` 即先例：裁决作为 note 追加进 carrier 再派发 fix）· 语义 = 确认合一（读回 + 确认）· 用词与程序术语库一致（adjudication · carrier · backfill）· **四 skill 全量 7 处同句**（cdd-spec-writer 2 · cdd-plan 2 · cdd-dev 2 · cdd-design 1）——cdd-dev L53/L85 的同句也在面内
- **落点**：kairos 消费面 skill 文本（`packages/kairos/skills/cdd-*/SKILL.md` 四 skill 的 NEXT-LOOP 节点 + Review Convergence 不变体）· 消费面同步通道（§5.2）· 随字节语义 major 落地（消费面文本精简专属于 author 节点表述面）
- **验收 pin**：四 skill 文本 NEXT-LOOP 节点零 `next:` 字面复述（grep `fix --type`/`implement --plan` 复述行零命中 —— review 派发行如 `review --type wave --tasks <n> --plan <path>` 与 `CDD_BLOCKED:` 通道句是节点固有句 **保留** · 只删 next 字面复述段）· Review Convergence 不变体规则句保留（`next:` 即派发 · 无映射层 · adjudication 覆盖）· 父句 `(confirm the findings · backfill user adjudications into the carrier)` 在册 · 旧父句 `(read file back to confirm)` 四文件零残留 · kairos 行为树全绿（presentation-surface pins 翻新）

### 6. smoke-cdd 迁引擎 + emit.ts 六前提重整
#### 6.1 smoke-cdd 迁 engine 集成测试面
- smoke-cdd（fixture 仓库 + 真实 bin dry-run 链）迁入 engine test plane（作为引擎集成测试 / 或保留独立 runnable 入口）· 归「引擎 launch 行为」域（kairos `pi-install-smoke.test.ts` 同型先例）
- **`--expect-version` 旗标撤除**（用户裁定 · 2026-10-12 · no-op 不迁）：现 `scripts/smoke-cdd.ts` 全文件 0 命中 expect/argv/version（`SmokeCdd.run(opts)` 仅收 `binPath` · `run.ts:46-49` 不传 argv · `release.yml:71` 的 `--expect-version 1.0.0` 传入即弃 = no-op）——引擎 smoke **不实现版本断言** · `release.yml` post-version 门移除（两道门只指 smoke 入口 · 不再带版本断言）· `docs/maintainers/04-program-experience.md:89` 的「tarball + installed package.json == expected」记载同步删 · 「released artifact = verified artifact」以 suite 全绿 + smoke 门改指收口
- **release.yml 两道门改指引擎 smoke 入口**（`pnpm -C packages/cdd-engine run …` 或等阶原生命令）· root `scripts/run.ts smoke-cdd` 面删除
#### 6.2 emit.ts OOP 重整
- emit.ts（产物生成面 · `package.json#oscaner` → 各 harness manifest）按六前提重整：零裸函数（类族收口 · §4.2）· 高内聚低耦合（映射职责分面）· 死码清理 · 声明单源投影保
- **产物字节零 drift**：`emit:check` 前后全等（重整只改生成器形状 · 不改产物字节——已入库产物零更替）

### 7. 死码/空壳/散线清理清单
#### 7.1 删除面（消灭清单）
- `scripts/lib/guard.ts`（1067 行 · 校验逻辑全迁/撤）· `scripts/validate.ts`（321 行 · 组合 runner）· `run.ts` validate/precommit/smoke-cdd 面 · `scripts/__tests__/guard.test.ts` + `validate.test.ts` · kairos `tests/ci-validate.test.ts`（wiring guard 目标消失 · 断言面随迁）· `PRECONTRACT_DOCS` 名单
#### 7.2 迁移面
- guard 分析器（analyzeSkill · digraph/section 抽取）→ kairos test 辅助 · channel/handoff 断言 → engine colocated pins · anatomy 契约 / 词表保持引擎导出（零搬）· smoke fixtures → engine 集成测试（§6.1）
#### 7.3 声明单源确认
- 迁后**零平行实现**：每个 check 只有一处（所属 package suite）· 词表 / anatomy 契约 / 通道声明保持引擎单源导出（kairos 以 workspace: 依赖消费 · 零拷）

### 8. 变更集 · 验收姿态
#### 8.1 变更集归并（不发布）
- cdd-engine **major**（字节语义破面 + 归域 + 外壳）· kairos **patch**（消费面同步——P5 本 phase 变更集类型 · 净 bump 另受累计 pending `.changeset/oscaner-key-rename.md`（`kairos: major` · breaking）支配）· **不发布**（Q6 · tag/publish 独立动作 · 净 bump 不影响发布姿态）· `pnpm exec changeset status` 无 empty 条目
#### 8.2 验收证据面
- 引擎 vitest 全绿（含新 pins）· kairos suite 全绿 · 全局零裸函数 grep pin 零命中 · 根 scripts 零验证逻辑（grep 实现定位）· CI 原生 job 绿（action log 分层可见）· 字节更替 deliberate pins 全绿 · smoke 门（新入口）绿 · emit-check 产物字节零 drift · EOF 全绿

### Acceptance criteria

- `校验归域落地 ✓（checkAnatomy→kairos suite · checkChannels/checkHandoffPlane→engine suite · checkWords 分域拆 · 根 scripts 零验证逻辑实现（grep 定位 guard/validate 面迁净）· 归域后每个 check 只有一处（所属 package suite · 零平行实现））`
- `docs 不验落地 ✓（checkDocContract/PRECONTRACT_DOCS/checkClaimedPins 撤下根 · docs 合法性交 workflow（任一新建 spec/plan doc dispatch 时被引擎判压）· 根零 docs 扫描）`
- `CI 原生分身 ✓（validate.ts 组合 runner 解散 · GH Actions 原生 job 跑 engine/kairos suite + typecheck + emit-check + 版本 sync（action log 分层可见）· precommit 原生命令序列 · run.ts validate/precommit/smoke-cdd 面删除）`
- `字面零裸函数 ✓（全员枚举基：引擎源码面 2 枚收类（§4.1）· scripts 源码面 38 枚全处置（guard 9 · validate 5 · smoke-cdd 7 随 §7.1/§3.1/§6.1 迁/撤 21 · emit 12 · scan 3 · first-party 1 · run.ts main 收类 17）· 测试面全量迁移（引擎 15 个 test 文件 53 枚 · scripts 测试辅助 2 枚→新建 scan.test.ts 承接 scanToken 覆盖）· 全局 ^(export )?(async )?function 零命中 pin（含组合根 · 含测试面 · 全员在册 · async 形态同入正则）· 门禁入 CI）`
- `字节语义 major 落地 ✓（命令/旗标/退出码 deliberate 更替逐项 pin 重锚 + 锚同步 · next: 字面保持可执行命令字面化（冻结 · 不简洁化）· 功能语义不变（六命令领域 run 语义零动）· kairos 消费面同步（skill 文本 dispatch/next 引用随改 · 行为树全绿作证））`
- `schema gen→get 并入 ✓（schema get <type> --output <json|skeleton> · --output json 无需 target · --output skeleton <target> target 必填且受约束（引擎声明必需参数 · 直写目标 doc · 就地生成填 in place · 异路径中转结构性不可行）· schema gen leaf 消灭 · did-you-mean 随命令树更新 · cdd-spec-writer 消费面 dispatch 字面同步（schema get phase-spec --output skeleton <path>）· vitest + smoke 链 + kairos 行为树全绿作证）`
- `消费面 skill 文本精简 ✓（D20 · 四 skill NEXT-LOOP 节点零 next: 字面复述（cdd-spec-writer · cdd-plan · cdd-dev · cdd-design · cdd-close/cdd-report 无 NEXT-LOOP 零动）· Review Convergence 不变体规则句保留（I1/I3/I2 按 skill）· fix 父句 (confirm the findings · backfill user adjudications into the carrier) 在册 · 旧父句四文件零残留 · kairos 行为树全绿（presentation-surface pins 翻新））`
- `smoke-cdd 迁引擎 ✓（fixture + dry-run 链入 engine test plane · --expect-version 旗标撤除（no-op 不迁 · release.yml post-version 门移除 · maintainers 记载删）· release.yml 两门改指引擎 smoke 入口 · root run.ts smoke-cdd 删除）`
- `emit.ts 六前提重整 ✓（零裸函数 · OOP 类族 · 声明单源投影 · 产物字节零 drift（emit-check 前后全等））`
- `死码/空壳零残留 ✓（§7.1 销毁清单逐项 grep pin 零命中 · §7.2 迁移面落在目标 suite · 零平行实现）`
- `引擎 vitest 全绿（含新 pins）· kairos suite 全绿 · 变更集归并无 empty 条目（cdd-engine major · kairos P5 patch——净 bump 受累计 pending 支配 = major）· 不发布 · EOF 全绿`

## Constraints

- **结构保真**：本骨架 = 声明面派生（`schema gen phase-spec`）· 编辑器只填不重排——违反 = 保真破坏，视为 defect
- **六前提整评许可**（P5 与 P1–P4 同款 · D17/D18）：整树重整 · OOP 统一 · 死面清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简——排除容忍/补丁/面子工程
- **字面零裸函数铁律**（Q2→a）：含组合根 · 含测试面 · 全局 `^(export )?(async )?function ` 零命中（async 形态同入·统一正则）· 不留豁免口（留口必变厚）
- **校验归域**（用户域模型）：checks 只存在于所属 package test plane · 根 scripts 零验证逻辑实现 · 零平行实现
- **docs 不验**（用户裁定）：根不实现文档验证 · 合法性交 workflow（引擎 dispatch 门用时自判）· checkDocContract/PRECONTRACT_DOCS/checkClaimedPins 撤下根
- **字节语义 major 授权**（Q3→a · Q5→a）：破坏性两层全开 · 字节更替为 deliberate（pin 重锚 + 锚同步）· **`next:` 字面冻结**（可执行命令字面化 · I2）· **功能语义不变**（六命令领域 run 语义零动）
- **CI 原生**（Q8→a）：validate.ts 组合 runner 解散 · GH Actions 原生 job · precommit 原生命令序列 · 局部 commit 门语义不降
- **smoke 新入口**（Q7a→a）：smoke 归 engine test plane · release.yml 两门改指引擎 smoke 入口 · root smoke-cdd 面删除
- **emit 产物字节零 drift**（Q7b→a）：emit.ts 重整只改生成器形状 · emit-check 前后全等
- **语义契约保**：退出码表 / CDD_BLOCKED 通道 / doc-contract 判定 / `next:` 字面 / 领域 run 语义——语义不变（字节更替为 deliberate re-anchor）
- **不发布**（Q6）：变更集归并到可发布态即止 · tag / publish = 独立动作
- **gate 零例外**：doc-contract 判定语义不变——骨架 by construction 绿 · 填后终判兜底

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-12 | P5 设计 v0.1——整引擎 + repo CI 验证脚本重整（六前提 · grilling 九裁定 D18）：目标面二合一（非终审 · 用户「最大心智负担：仓库根脚本只是跑 tests 做 ci 门」）· 校验归域（checkAnatomy→kairos · checkChannels/checkHandoffPlane→engine · checkWords 分域拆 · 根零验证逻辑）· docs 不验（三 docs 门撤下根 · 合法性交 workflow）· CI 原生分身（validate.ts 解散 · GH Actions 原生 job · precommit 原生命令序列）· 字面零裸函数（含组合根 · 全局零命中 pin）· 字节语义 major（两层全开 · next: 字面冻结 · 功能语义不变 · kairos 消费面同步）· smoke-cdd 迁引擎（release 门改指）· emit.ts 六前提重整（产物字节零 drift）· 死码/空壳清单（guard.ts/validate.ts 删除面 · 迁移面）· 变更集 major + patch 归并不发布 · 单 phase-spec 收口 | Oscar M. · Claude Opus 5（kairos:cdd-design [P5] 会话 · 用户裁定 · 2026-10-12） |
| v0.2 | 2026-10-12 | P5 设计 v0.2——用户 in-flight 需求 backfill（§5.4 · 六前提⑤ 消费者心智负担）：schema gen 并入 schema get · `--output <json|skeleton>` · **根因修正（用户 2026-10-12 澄清）：痛根是 `<path>` 零约束而非 `>` vs 传参机制**——`--output skeleton <target>` 把 target 升为引擎声明必需参数（引擎直写目标 doc · 就地生成 · 填 in place · 异路径中转结构性不可行）· `--output json` 无需 target · schema gen leaf 消灭 · cdd-spec-writer 消费面 dispatch 字面同步 | Oscar M. · Claude Opus 5（kairos:cdd-spec-writer [P5] 会话 · 用户 backfill · 2026-10-12） |
| v0.3 | 2026-10-12 | P5 设计 v0.3——spec-review-1 修复轮（3 warn + 3 nit 全数落地 · 零残）：PRECONTRACT_DOCS 计数 35→33（§2.4 · pin 核到 `scripts/validate.ts:182-216`）· `--expect-version` **撤旗标**（§6.1/AC · 用户裁定 option ② —— no-op 不迁 · release.yml post-version 门移除 · `docs/maintainers/04-program-experience.md:89` 记载删）· 零裸函数门测试面处置（§4.3 · 引擎 15 个 test 文件 53 枚 + scripts 测试辅助 2 枚全量迁移 · AC 全员枚举基）· scripts 面计数逐文件清单（37 = 收类 16 + 迁/撤 21）· 变更集区分 P5 changeset 类型 vs 净 bump（kairos 净 bump 已 major）· D19 引用入链（§1.1/Design/§5.4） | 引擎 spec-fix 轮 · Oscar M. · Claude Opus 5（kairos:cdd-design [P5] 会话 · 2026-10-12） |
| v0.4 | 2026-10-13 | P5 设计 v0.4——用户 in-flight 消费面需求 backfill（§5.5 · 六前提⑤ · D20）：**三编排器 skill NEXT-LOOP 不复述 `next:` 具体字面**（含 I1 不变体同简 · 只留规则句 · 字面由 review 输出携带）· **fix 派发父句 `(read file back to confirm)` → `(confirm the findings · backfill user adjudications into the carrier)`**（读回确认 + 用户裁定回填 carrier · 用户 3 裁定推荐 A）· 落点 = kairos 消费面 skill 文本（cdd-spec-writer/design/plan）· 随字节语义 major 落地 · AC 增补 · 行为树 pins 翻新 | Oscar M. · Claude Opus 5（kairos:cdd-spec-writer [P5] 会话 · 用户 backfill · 2026-10-13） |
| v0.5 | 2026-10-13 | P5 设计 v0.5——**D20 scope 校正确认（用户追问「cdd-dev 面为什么不动」→ 原「三编排器」收敛范围误判）**：D20 ①②面 **扩至四个带 NEXT-LOOP 的 skill**（cdd-spec-writer · cdd-plan · **cdd-dev** · cdd-design——cdd-dev L53 `fix --type wave…`+`implement --plan…`+`done` 三字面全复述为最重面 · design I2 不变体同简）· cdd-close/cdd-report 无 NEXT-LOOP 零动 · fix 父句全量 7 处（dev L53/L85 同句在面内）· AC pin 同步扩四文件 | Oscar M. · Claude Opus 5（kairos:cdd-plan [P5] 会话 · 用户 scope 追问 · 2026-10-13） |
| v0.6 | 2026-10-13 | **P5 计划 v0.3 → v0.4 修复轮回填（plan-review-1 · 8 warn + 2 nit · 内核到实码）**：scripts 面计数 **37 → 38 枚**（§4.3/AC · 收类 16 → 17：实测 grep guard.ts 9 + validate 5 + smoke-cdd 7 = 21 迁/撤 · scan 3 + first-party 1 + run.ts main 1 + emit 12 = 17 收类）· **零裸函数正则统一**（`^function |^export function ` → `^(export )?(async )?function `——async 形态同入 · `run.ts:17 async function main` 在面内 · §4.1/§4.3 全局 + 铁律行同步）· **scan.test 覆盖承接**（scanToken 现覆盖仅在 guard.test.ts:15,102-128 · 随 T5 删除 → 移 §4.3 为「新建 scan.test.ts 承接」）· **smoke 迁面修正**（烟链实为 implement+review 二命令 + `--help` face · 非五命令 · §5.4 无 schema 锚可同步 · schema skeleton 集成断言面 = engine vitest cli/projection）——文本修正 · AC 原子推进 | 引擎 plan-fix 轮 · Oscar M. · Claude Opus 5（kairos:cdd-plan [P5] 会话 · 2026-10-13） |
