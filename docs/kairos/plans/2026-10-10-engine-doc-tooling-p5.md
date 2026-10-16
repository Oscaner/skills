# P5 整引擎 + repo CI 验证脚本重整
**Spec:** [2026-10-10-engine-doc-tooling-p5-design.md](docs/kairos/specs/2026-10-10-engine-doc-tooling-p5-design.md)
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md)
- **Version**: v0.7 · 2026-10-13
- **Doc type**: plan

## Constraints

- 字面零裸函数（D18② · Q2→a）：引擎 + scripts 全部 `.ts`（含测试面）模块级 `function` / `export function` / `async function` 零命中（统一正则 `^(export )?(async )?function ` · 含组合根 · 含迁移面 kairos tests——`scripts/run.ts:17 async function main` 与 `packages/kairos/tests/ci-validate.test.ts:28 async function capture` 均入面（后者随 T5 删除））——收类成员/static 类族 · 不留豁免口
- 校验归域（用户域模型）：每个 check 只有一处（所属 package test plane）· 根 `scripts/` 零验证逻辑实现 · 零平行实现 · 词表/anatomy 契约/通道声明保持引擎单源导出（kairos 以 `workspace:*` 包依赖消费 · kairos tests `node --test` 直跑 `.ts` → 相对路径直引引擎契约源——引擎 `exports` 仅开 CLI 入口 `bin.ts` · 消费面零子路径导出扩张）
- docs 不验（D18⑥）：`checkDocContract`/`PRECONTRACT_DOCS`/`checkClaimedPins` 撤下根 · 根零 docs 扫描 · docs 合法性交引擎 review/fix dispatch 门用时自判
- CI 原生（D18⑧ · Q8→a）：`validate.ts` 组合 runner 解散 · GH Actions 原生 job · precommit 原生命令序列 · 局部 commit 门语义不降
- 字节语义 major（D18④ · Q3→a/Q5→a）：命令/旗标/退出码可 deliberate 更替（逐项 pin 重锚 + 锚同步）· **`next:` 字面冻结**（可执行命令字面化 · 不简洁化 · I2）· 功能语义不变（六命令领域 run 语义零动）
- 不发布（D18⑤ · Q6）：变更集归并到 pending · tag/publish 独立动作 · `changeset status` 无 empty 条目
- smoke 新入口（D18⑨ · Q7a→a）：smoke 归 engine test plane · release 两门改指引擎 smoke 入口 · `--expect-version` 撤旗标（D19 用户裁定 · option ② · no-op 不迁）
- emit 产物字节零 drift（Q7b→a）：emit.ts 重整只改生成器形状 · emit-check 前后全等
- 结构性门禁：per-task 提交经 `pnpm run precommit`（emit freshness · kairos anatomy · word-face · engine channel audit · handoff plane · doc-contract 判定语义不变）· 全链收口 `pnpm run validate` 等价的 CI 原生序列
- 文本纪律：每个文本文件恰一个 EOF newline（零尾随空行）· English-primary（引擎源/scripts 源注释与散文英文 · 无 translated mirrors）
- 引擎开发调用一律本地源 `node packages/cdd-engine/src-next/bin.ts <subcommand>`（非 `npx @latest`）

### Task 1: Engine 侧校验归域——channel/handoff/引擎词面 checks 迁 engine colocated vitest
- **Objective**: 把 `scripts/lib/guard.ts` 的 `checkChannels`（CLI×runtime 通道闭包 + host-marker 闭包）、`checkHandoffPlane`（P4 扩项 · 声明面闭合 · engineOnly 卫生 · 写平面声明派生）与 `checkWords` 的引擎字面面，从 root 抽取为 engine test plane 的 colocated vitest pins（`face/__tests__/` + `session/__tests__/`），消费引擎自身声明单源（`face/declare.ts` · `face/host.ts` · `session/handoff-schema.ts` · `face/words.ts`）——校验实现随产物归位，root 同一断言不再重复持有
- **Files**:
  - Create: `packages/cdd-engine/src-next/face/__tests__/channel-closure.guard.test.ts`（P3 channel-closure 单面自检同族的归域承接面）
  - Create: `packages/cdd-engine/src-next/session/__tests__/handoff-plane.guard.test.ts`
  - Create: `packages/cdd-engine/src-next/face/__tests__/words.guard.test.ts`（引擎字面面禁令词审计）
  - Modify: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（channel pins 若有 duplicate 断言并归）
- **Consumes**: guard 三 check 的现断言位址（`scripts/lib/guard.ts` · 归域源）· `face/declare.ts` CLI_COMMANDS · `face/host.ts` env-marker 表 · `face/words.ts` GUARD_BAN_WORDS 导出 · `session/handoff-schema.ts` 声明面
- **Produces**: engine test plane 内三个自含 colocated pins（vitest · 断言面对准归域后语义），供 T5 拆除 root check 时零平行差
- **Steps**:
  - 读 specs 归域定案 §2.3 与 guard 三 check 现断言，逐 check 提取断言面（channel 闭包 = command keys × flag channels · host 闭包 = detect env keys ∪ PATH · handoff-plane = 声明面闭合 + engineOnly 卫生 + 写平面声明派生） — checkable: 三 check 各自断言核心行位址清单落盘
  - 以 P3 channel-closure 单面自检测为既存同族基底，落地三个 colocated 测试文件（node 断言经 vitest · 零裸函数——用 `const`/`class` 承载辅助） — checkable: 三新文件存在且 `^(export )?(async )?function ` 零命中
  - 跑 `pnpm -C packages/cdd-engine test`（vitest） — checkable: exit 0 且新 pins 全绿
  - 跑 root 既有 `pnpm run precommit` 的 engine channel audit 步 — checkable: 归域新 pins 与 root 旧 check 双绿（并存期零互斥）
  - 提交为原子 commit（`test(cdd-engine): 归域承接——channel/handoff/引擎词面 checks 迁 colocated vitest`） — checkable: git log 单原子
- **Acceptance**: 引擎 vitest 三个新 pins 全绿 · 双绿并存期 root check 不误报 · 零裸函数（新文件 `^(export )?(async )?function ` 零命中）· precommit 过 · EOF 恰一 newline
- **DependsOn**: none

### Task 2: Kairos 侧校验归域——skill-anatomy + 技能词面 checks 迁 kairos test plane
- **Objective**: 把 root `checkAnatomy`（SKILL.md 结构合约判压）与 `checkWords` 的技能散文面，迁入 kairos test plane（`packages/kairos/tests/`）——判压实现 = 引擎导出的 `skill-anatomy` 契约（`workspace:*` 包依赖 · `node --test` 直跑 `.ts` 相对路径直引引擎契约源——引擎 `exports` 仅开 CLI 入口 `bin.ts` · 消费面零子路径导出依赖）· 走查器（analyzeSkill · digraph/section 抽取）落 kairos 测试辅助 · 技能散文词面以引擎 `GUARD_BAN_WORDS` 导出为基准——kairos 拥有自身产物（six SKILL.md）的校验
- **Files**:
  - Create: `packages/kairos/tests/skill-anatomy.test.ts`（node:test · analyzeSkill 走查 + 契约判压）
  - Create: `packages/kairos/tests/words.test.ts`（技能散文词面审计）
  - Modify: `packages/kairos/package.json`（加 `test` script：`node --test tests/*.test.ts`——CI 原生 job 的调用面）
- **Consumes**: `packages/cdd-engine/src-next/contract/skill-anatomy.ts`（anatomy 契约 · workspace 依赖）· `face/words.ts` GUARD_BAN_WORDS · root guard 走查器断言面（归域源）· 六个 kairos SKILL.md
- **Produces**: kairos test plane 自含 skill-anatomy + 词面 pins（node:test · 断言对准归域后语义），供 T5 拆 root check 时零平行差 · 供 T8 的 CI 原生 job 直接跑
- **Steps**:
  - 读 specs 归域定案 §2.2 与 guard checkAnatomy/词面现断言，提取走查/判压断言面 — checkable: checkAnatomy 断言核心行位址清单落盘
  - 在 `packages/kairos/tests/` 落 skill-anatomy.test.ts 与 words.test.ts（node:test · `node --test` 可单跑 · 零裸函数——辅助用 const/class，不可引入模块级 function） — checkable: 新文件存在且 `^(export )?(async )?function ` 零命中
  - `packages/kairos/package.json` 加 `test` script（与 root validate 现跑命令同参：`node --test tests/*.test.ts`） — checkable: `pnpm -C packages/kairos test` 跑通
  - 跑 `node --test packages/kairos/tests/*.test.ts` — checkable: exit 0 且新 pins 全绿（含既有 10 个 test 文件零回归）
  - 跑 `pnpm run precommit` 的 kairos anatomy 步 — checkable: 双绿并存期零互斥
  - 提交（`test(kairos): 归域承接——skill-anatomy + 技能词面 checks 迁 kairos suite + test script`） — checkable: git log 单原子
- **Acceptance**: kairos suite 新 pins 全绿 · 既有行为树零回归（87 passed 保持）· `pnpm -C packages/kairos test` 可独立跑 · 零裸函数 · EOF 恰一 newline
- **DependsOn**: none

### Task 3: Docs 不验——checkDocContract/PRECONTRACT_DOCS/checkClaimedPins 撤下根
- **Objective**: 把 root `scripts/validate.ts` 的 `checkDocContract` 步（含 `PRECONTRACT_DOCS` 33 个豁免窗名单）与 claimed→pin right lint 步移除——docs 是开发产物，其结构合法性由引擎 review/fix dispatch 门用时自判（`cdd review --type spec/plan` 的 doc-contract 判定保留——引擎能力，非 root verify 实现）；根零 docs 扫描
- **Files**:
  - Modify: `scripts/validate.ts`（`checkDocContract` 步移除 · `PRECONTRACT_DOCS` 集合删除 · checkClaimedPins 步移除 · steps 表相关行删）
  - Remove: `scripts/lib/guard.ts` 中 `checkClaimedPins` 与其专属分析器（若 checkDocContract 实现在 guard 的则同删）
- **Consumes**: specs §2.4 · validate.ts 步表 `PRECONTRACT_DOCS` Set（33 个）· guard checkClaimedPins 实现位址
- **Produces**: root validate 步表不再含任何 docs 扫描口径 · `PRECONTRACT_DOCS` 名单零残留 grep 可证
- **Steps**:
  - candidate 验证 `scripts/validate.ts:182-216` 的 PRECONTRACT_DOCS 实为 33 个（spec v0.3 §2.4 已核）——从预置名单确认后随行删除 — checkable: 文件中 PRECONTRACT_DOCS 定义行存在且计数 33
  - 移除 checkDocContract 步（含 gate 实现调用）与 checkClaimedPins 步，步表相关行列清除 — checkable: validate 步表 docs 三口径零残留
  - 全库 grep `PRECONTRACT_DOCS` — checkable: 零命中（除 change-history 的历史记载文本）
  - 跑 `pnpm -C packages/cdd-engine test` + `node --test packages/kairos/tests/*.test.ts` + `pnpm run emit:check` — checkable: 全绿（docs 不验不影响其他门）
  - 提交（`chore: 校验归域（三）——checkDocContract/PRECONTRACT_DOCS/checkClaimedPins 撤下根`） — checkable: git log 单原子
- **Acceptance**: validate 步表 docs 三口径零残留 · `PRECONTRACT_DOCS` grep 零命中（历史记载除外）· 引擎/kairos/emit-check 全绿 · 不 pending 新功能
- **DependsOn**: none

### Task 4: schema gen→get 并入（D19 · 引擎字节面）
- **Objective**: 把 `schema` 命令的 `gen` leaf 并入 `get`（单 leaf · 双渲染面）——`schema get <type> --output json` = 现 get（打印 schema 声明 · 无需 target）· `schema get <type> --output skeleton <target>` = 现 gen（骨架渲染**直写目标 doc** · target 必填且受约束）· **`--output` 默认值 = json**（裸 `schema get <type>` 不带 --output 仍合法 · 字节与现 get 同 · kairos skill 裸字面保合法）· `schema gen` leaf 消灭 · did-you-mean 候选随命令树更新（**get 入候选 · `schema g` 单字符前缀低于 commander 相似度地板**（0.333 < 0.4）**静默不发射建议** · gen 消灭绝不 phantom dispatch）· `--output` 值域 `json|skeleton` · 字节更替 deliberate（vitest pins 重锚 + smoke 锚复核），功能语义不变
- **Files**:
  - Modify: `packages/cdd-engine/src-next/face/declare.ts`（schema 命令 leaves 表：`gen` 行删除 · `get` 行新增 `--output` option + target positional）
  - Modify: `packages/cdd-engine/src-next/face/cli.ts`（schema leaf 注册/命令构造 · target 条件必填判定（仅 `--output skeleton` 时要求）· 骨架渲染直写 target 路径的实现接线）
  - Modify: `packages/cdd-engine/src-next/face/artifacts.ts`（**`runSchemaGen` 并入 `get --output skeleton` 直写面** + usage 字面 `cdd schema gen: missing <type>` 迁移/消灭）
  - Modify: `packages/cdd-engine/src-next/face/__tests__/projection.test.ts`（**schema 叶表 `["get","gen"]` → `["get"]` · positionals 断言重锚为 get 单 leaf——gen 删则红**）
  - Modify: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（schema gen 相关 pins 重锚为 get --output skeleton · did-you-mean `schema g` 候选 pin）
- **Consumes**: specs §5.4（根因：`<path>` 零约束 → target 升引擎声明必需参数 · 直写目标 doc 就地填 in place）· D19 · `face/declare.ts` SCHEMA_TYPE_KEYS · `schema gen` 现骨架渲染器（从渲染迁移接线）
- **Produces**: 引擎单 leaf schema 命令（get --output json|skeleton）+ 骨架直写目标 doc 能力 + did-you-mean 候选更新 · 供 T11 的 kairos 消费面 dispatch 字面同步
- **Steps**:
  - 改 declare.ts：schema command leaves 表 `gen` 行移除 · `get` 行声明 `--output` option（值域 json|skeleton）+ positionals type（必填）+ target（条件必填） — checkable: declare 单源含新 schema 面（get 单 leaf · 值域枚举 json|skeleton）
  - 改 cli.ts：schema get 命令构造 —— `--output skeleton` 时校验 target 必填（缺参 = 引擎错误 · 退 2），读 target 路径并把骨架渲染直写该文件（fs 写 · 恰一 EOF）· `--output json` 时打印声明（字节与现 get 同） — checkable: 手跑 `schema get phase-spec --output skeleton /tmp/demo.md` 文件就地生成且骨架完整
  - 保留 `next:` 字面冻结（schema 命令不涉 next · 佐证零动） — checkable: 全库 `next:` 字面 pins 零动（git diff 不含 next 面改动）
  - 重锚 pin：cli.test.ts schema 用例（get json 面 · get skeleton 直写文件内容断言 · did-you-mean `schema phase`→`schema get phase-spec`· `schema g` 单字符前缀低于 commander 相似度地板（0.333 < 0.4）静默零建议——`error: unknown command 'g'` 退 2 · 绝不 phantom dispatch） — checkable: 新 pins 在册且断言非空
  - pin `--output` 默认 json：裸 `schema get <type>`（无 --output）仍合法且字节与现 get 同（`--output` option 默认值 = `"json"` · 不设必填判定）——kairos skill 裸 schema get 字面（spec-writer SKILL.md:41 等）保合法、毋须更替 — checkable: `schema get phase-spec`（无 --output）退 0 打印 json 声明 · 与 `schema get phase-spec --output json` 字节同
  - projection.test.ts 叶表 & positionals 断言重锚：`["get","gen"]` → `["get"]` · 「schema get requires <type>, schema gen takes it optionally」→ 「schema get requires <type>（positionals type 必填）· --output skeleton 时 target 条件必填」 — checkable: projection pins 重锚后全绿
  - smoke 锚复核：smoke-cdd.ts 全文件 `schema` 零命中（dry-run 链 = implement + review 二命令 + `--help` face）——**无 schema gen 断言可同步** · schema gen 字节更替 pins 仅在 cli.test.ts/projection.test.ts 面 · T7 迁引擎时以新旧命令面 grep 复核（嵌套 checkable 承接，本步零动作） — checkable: 复核记录在册（无 smoke schema 锚待同步）
  - 跑 `pnpm -C packages/cdd-engine test` — checkable: exit 0 全绿
  - 提交（`feat(cdd-engine): schema gen 并入 get——--output <json|skeleton> 双渲染面 · target 条件必填直写目标 doc（deliberate pin break）`） — checkable: git log 单原子
- **Acceptance**: `schema gen` 全库 zero 声明/调用残留（grep `schema gen` 零命中除历史记载与过时文档 · runSchemaGen 并入 get 面 · usage 字面 `cdd schema gen: missing <type>` 零残留）· `schema get phase-spec --output json` 字节与现 get 同 · 裸 `schema get phase-spec`（无 --output）默认 json 合法 · `--output skeleton <target>` 缺 target 判定退 2 · 骨架直写文件恰一 EOF · projection 叶表/positionals 断言重锚绿 · did-you-mean 候选更新 pins 绿 · 引擎 vitest 全绿 · precommit 过
- **DependsOn**: none

### Task 5: 校验归域收口——root guard.ts + validate.ts 解散（根零验证逻辑）
- **Objective**: 三个归域 task（T1/T2/T3）落地后，root `scripts/lib/guard.ts`（1067 行）与 `scripts/validate.ts`（321 行）的组合 runner 解散——check 实现全迁/撤的残余代码清除 · `run.ts` 的 `validate`/`precommit` face 删除 · 关联测试（`scripts/__tests__/guard.test.ts` · `validate.test.ts` · kairos `tests/ci-validate.test.ts` wiring guard）随目标删除——「校验逻辑按产物归属」的归域闭环，根零验证逻辑实现，零平行实现
- **Files**:
  - Remove: `scripts/lib/guard.ts` · `scripts/validate.ts` · `scripts/__tests__/guard.test.ts` · `scripts/__tests__/validate.test.ts` · `packages/kairos/tests/ci-validate.test.ts`
  - Modify: `scripts/run.ts`（`validate`/`precommit` verb 分支删除 · `ValidateRunner` 引用清除）· `scripts/__tests__/` 残余引用（smoke 相关另归 T7）
- **Consumes**: specs §2（归域图）· §3（CI 原生：validate.ts 解散）· §7.1 删除面清单 · T1/T2/T3 的新 pins
- **Produces**: root scripts 只剩原生产物生成面（emit/emit-check/run.ts main）与 CI 门壳 · 可供 T6 收类零裸函数、T8 的 package.json 原生序列接管
- **Steps**:
  - 确认 T1/T2/T3 已双绿并存解析——全库 grep 确认 guard 五 check 断言面已在 package suites（零平行差） — checkable: 五 check 断言面 root 零残留（历史记载除外）
  - 删除 guard.ts/validate.ts 及三关联测试文件 · run.ts 删 validate/precommit verb 分支 — checkable: §7.1 删除面五文件全部删除
  - grep 验证残面零命中：guard 五 check 的引擎侧声明定义在 root 零残留 · `run.ts validate` 调用面零残留 — checkable: `ValidateRunner`/`CheckBlock`/`SubprocessBlock`/`steps`/`precommitSteps` grep 零命中
  - 跑 `pnpm -C packages/cdd-engine test` + `node --test packages/kairos/tests/*.test.ts` + `pnpm run emit:check` — checkable: 全绿
  - 提交（`refactor: 校验归域收口——root guard/validate 解散 · 零平行验证逻辑`） — checkable: git log 单原子
- **Acceptance**: §7.1 删除面五文件全部删除 · `ValidateRunner`/`CheckBlock`/`SubprocessBlock`/`steps`/`precommitSteps` grep 零命中 · 引擎五 check 断言在 root 零残留（归域后每 check 仅所处 package suite 一处）· 三 suite 全绿 · precommit 形态待 T8 化（现阶段 validate face 已删 · precommit 由 T8 原生序列接管）
- **DependsOn**: 1, 2, 3

### Task 6: scripts 源码面零裸函数收类（scan/first-party/run.ts main/emit 类族起点）
- **Objective**: scripts 非测试面 38 枚模块级裸函数全处置——`lib/scan.ts`（walkTarget/scanToken/isQuotedDataRow 3）· `lib/first-party.ts`（firstPartyNames 1）· `run.ts` main（1）收为类成员/static 类族 · `emit.ts`（12）为 T12 的类族重整铺起点（本任务只做零裸函数收口 · 不改产物字节）· guard/validate/smoke 随 T5/T7 已删 21 枚（guard.ts 9 · validate.ts 5 · smoke-cdd.ts 7）——「字面零裸函数」scripts 源码面达成
- **Files**:
  - Modify: `scripts/lib/scan.ts`（`WalkTarget`/`ScanToken` 类族 · walkTarget/scanToken/isQuotedDataRow 收 static/类成员）· `scripts/lib/first-party.ts`（类成员 firstPartyNames）· `scripts/run.ts`（main 收类成员 + emit/emit-check 面保留）· `scripts/emit.ts`（12 枚收类族 · 产物字节零变）
  - Create: `scripts/__tests__/scan.test.ts`（scanToken 现有覆盖仅在 guard.test.ts:15,102-128，而 guard.test.ts 随 T5 删除 → **本任务新建 scan.test.ts 承接 walkTarget/scanToken/isQuotedDataRow 收类后的调用等价断言**）
  - Test: `scripts/__tests__/scan.test.ts`（新建 · 迁移并跟进收类后调用形态）· `scripts/__tests__/emit.test.ts` 等既有单元测试跟进调用形态（类调用等价）— checkable pin 见下
- **Consumes**: specs §4.2 · scripts 现测试面（root vitest）断言 —— 收类不改行为
- **Produces**: scripts 源码面零裸函数（grep `^(export )?(async )?function ` scripts 零命中）· emit.ts 类族起点供 T12 重塑
- **Steps**:
  - 逐文件 grep `^(export )?(async )?function ` scripts（非测试）清单：scan 3 · first-party 1 · run.ts main 1（`async function main` 亦在面内）· emit 12 = 17 枚（另 21 枚已随 T5/T7 删：guard 9 · validate 5 · smoke-cdd 7） — checkable: 清单 17 枚逐位址落盘
  - scan.ts → `WalkTarget`/`ScanToken` 类族（扫描器形态类化 · 行为等价）· first-party.ts → 类成员 · run.ts main 收类（emit/emit-check 仍经类成员 dispatch） — checkable: scan/first-party/run.ts `^(export )?(async )?function ` 零命中
  - emit.ts 12 枚 → manifest 映射类族（deriveFirstPartyPlugin/normalizeAuthor/repoUrl/stripVcs/claudeManifest/cursorManifest 等收 static 成员 · **产物字节零变**） — checkable: emit.ts `^(export )?(async )?function ` 零命中
  - 跑 `pnpm exec vitest run`（scripts unit） — checkable: 全绿
  - 跑 `pnpm run emit:check` — checkable: 产物仍 fresh（类族化零 drift 证）
  - grep scripts 源码面 `^(export )?(async )?function ` — checkable: 零命中
  - 提交（`refactor(scripts): 源码面零裸函数收类——scan/first-party/run.ts main/emit 类族`） — checkable: git log 单原子
- **Acceptance**: scripts 源码面 38 枚裸函数残面零命中（明细可 grep · 收类 17 + 迁/撤 21）· root vitest 全绿（含新建 scan.test.ts）· emit-check 产物字节零 drift · 零功能语义变
- **DependsOn**: 5

### Task 7: smoke-cdd 迁 engine test plane + release 两门改指 + --expect-version 撤除
- **Objective**: `scripts/smoke-cdd.ts`（fixture 仓库 + 真实 bin dry-run 链）迁入 engine test plane（作为引擎集成测试 / 或独立 runnable 入口 · 归「引擎 launch 行为」域）· `release.yml` 两道门改指引擎 smoke 入口 · root `run.ts smoke-cdd` face 删除 · **`--expect-version` 撤旗标**（D19 用户裁定 option ②：现 smoke-cdd.ts 全文件 0 命中 expect/argv/version · no-op 不迁 → 引擎 smoke 不实现版本断言 · release post-version 门移除 · `docs/maintainers/04-program-experience.md` 对应记载删）
- **Files**:
  - Create: `packages/cdd-engine/src-next/__tests__/smoke.integration.test.ts`（fixture + dry-run 链 · 或独立 runnable 入口）
  - Remove: `scripts/smoke-cdd.ts` · `scripts/__tests__/smoke.test.ts`（imports `../smoke-cdd.ts`（smoke.test.ts:8）· 随 smoke-cdd.ts 删除 import 解析即断 → **同 T7 删除面进出** · 其 capsule-contract 断言面并入新 smoke.integration.test.ts）
  - Modify: `packages/cdd-engine/package.json`（**产出 smoke script**——`smoke.integration.test.ts` 的 vitest 定向跑入口（如 `vitest run src-next/__tests__/smoke.integration.test.ts`）· release.yml 与本地跑统一锚定）· `.github/workflows/release.yml`（pre-version smoke 门 + post-version `--expect-version` 门 → 引擎 smoke 入口 · post-version 门移除）· `scripts/run.ts`（smoke-cdd face 删除）· `docs/maintainers/04-program-experience.md`（--expect-version 记载删）
- **Consumes**: specs §6.1（—expect-version 撤旗标处置）· smoke-cdd.ts 现 run 逻辑 · release.yml 双门 · kairos `pi-install-smoke.test.ts` 同型先例 · `--expect-version` 全库调用位址
- **Produces**: 引擎 test plane 的 smoke 集成入口 + release.yml 双门改指 + root smoke face 删除 · 供 T8 的 CI 原生外壳无 smoke 残留
- **Steps**:
  - 读 smoke-cdd.ts 全逻辑：fixture 仓库准备 · bin dry-run 链（**二命令：implement + review**（smoke-cdd.ts:133-134）+ `--help` commander face 断言（:116-130）——非五命令）· `--expect-version` 现状（佐证 no-op） — checkable: smoke-cdd.ts 现断言/调用位址清单落盘
  - 迁移为 engine 集成测试（vitest · fixture 用临时 git 仓库 · 行为面保——dry-run 二命令链 + `--help` face 每断言字节同锚）· 迁移面零裸函数（集成面辅助收类/const） — checkable: 新测试文件存在且 `^(export )?(async )?function ` 零命中
  - smoke.test.ts（scripts 面 · import `../smoke-cdd.ts`）随删——其 capsule-contract 断言并入新 smoke.integration.test.ts（scripts suite 不再 import scripts/smoke-cdd.ts） — checkable: `scripts/` 树 `smoke-cdd` import 零残留 · scripts unit suite（root vitest）仍全绿
  - engine package.json 加 `smoke` script（vitest 定向跑 smoke.integration.test.ts）——release.yml pre-version 门改指该 script（`pnpm -C packages/cdd-engine run smoke` 锚定产物 · 非幻影命令） — checkable: `pnpm -C packages/cdd-engine run smoke` 存在且从 engine 目录跑绿
  - release.yml：pre-version 门改指引擎 smoke 入口（`pnpm -C packages/cdd-engine run smoke`）· post-version `--expect-version` 门移除 · maintainers 04:89 记载删 — checkable: release.yml 无 `--expect-version`/post-version 残留
  - run.ts 删 smoke-cdd face · grep `smoke-cdd` root 零残留（workflow 引用已改引擎入口） — checkable: `scripts/run.ts smoke-cdd` 零残留
  - 跑 engine vitest（含新 smoke 集成测试） — checkable: 全绿
  - 跑 `node --test packages/kairos/tests/*.test.ts` — checkable: 零回归
  - 提交（`refactor(cdd-engine): smoke-cdd 迁 engine 集成测试面 · release 门改指 · --expect-version 撤旗标（用户裁定）`） — checkable: git log 单原子
- **Acceptance**: smoke-cdd.ts root 删除且 `scripts/run.ts smoke-cdd` face 零残留 · **scripts/__tests__/smoke.test.ts 随删且 scripts 树 `smoke-cdd` import 零残留（root vitest 全绿）** · **engine package.json `smoke` script 在册（`pnpm -C packages/cdd-engine run smoke` 跑绿）** · 引擎 smoke 集成测试全绿 · release.yml 双门改指且 `--expect-version` / post-version 无残留（grep）· maintainers 记载删 · EOF 恰一 newline
- **DependsOn**: 5

### Task 8: CI 原生分身——GH Actions 原生 job + package.json scripts 原生命令序列
- **Objective**: 把 `scripts/validate.ts` 组合 runner 解散后的校验面用 GitHub Actions 原生 job + `package.json` scripts 原生命令序列重构——`pr-validate.yml` 改列原生 job（engine suite · kairos suite · typecheck · emit-check · 版本 sync 薄步 · 各自 action log 原生可见 · 失败归因到具体 job）· root `validate`/`precommit` 脚本改写为原生命令序列（局部 commit 门语义不降）· `run.ts` 的 `validate`/`precommit` 面已随 T5 删除 · `package.json` 含 kairos `test` script 接住
- **Files**:
  - Modify: `.github/workflows/pr-validate.yml`（原生 job 矩阵）· `.github/actions/validate/action.yml`（原生 step 化）· `package.json`（root `validate`/`precommit` → 原生序列）· `.github/workflows/release.yml`（若有版本 sync 门改指）
- **Consumes**: specs §3（CI 原生分身）· T2 的 kairos `test` script · T5 root 解散后 face · T7 smoke 入口
- **Produces**: CI 全链路原生 job 面（engine/kairos/typecheck/emit-check/版本 sync 分层可见）· 局部 `precommit` 原生命令序列（tree-independent 子集 · 引擎 suite 保持 tree-dependent 排除——CI 全量跑）
- **Steps**:
  - 读现 pr-validate.yml/action.yml：从 `node scripts/run.ts validate` 单一调用 → 枚举步表（emit fresh · anatomy · word-face · channel · handoff · scripts unit · kairos behavior · typecheck · version sync）拆原生 job/step — checkable: 现步表枚举清单落盘
  - 原生矩阵落地：`pnpm -C packages/cdd-engine test`（引擎 suite）· `pnpm -C packages/kairos test`（kairos test script）· `pnpm run typecheck` · `pnpm run emit:check` · 版本 sync 薄步（收尾 run.ts 或独立薄脚本 · 零裸函数） — checkable: pr-validate.yml 原生 job 且 action.log 分层可见
  - package.json：`validate` → 原生序列（或直列 GH steps 不设 web script · 选一）· `precommit` → 原生命令序列（lint-staged catch-all `*` 调用的 tree-independent 子集） — checkable: `scripts/run.ts validate` 零残留
  - 局部 commit 门语义核：precommit 不含引擎 suite（dirty-tree 不兼容既定）· CI 全量含 — checkable: precommit 命令无 engine suite 调用
  - 跑 `pnpm run precommit`（模拟 lint-staged 调用） — checkable: 过
  - 跑引擎/kairos suite 单独 — checkable: 全绿
  - 提交（`ci: validate.ts 组合 runner 解散——GH Actions 原生 job + precommit 原生命令序列`） — checkable: git log 单原子
- **Acceptance**: pr-validate.yml 原生 job 且 action.log 分层可见（每 job 独立 step）· `scripts/run.ts validate` 零残留 · precommit 原生命令序列过 · 引擎 suite 从 precommit 排除语义保（tree-independent 子集）· CI 全量等效旧 validate 断言面（emit fresh + 两套 suite + typecheck + emit-check + version sync）
- **DependsOn**: 5, 6, 7

### Task 9: Engine 源码面零裸函数收口（NodeEnvGuard + Cli.create 组合根）
- **Objective**: 引擎现存两枚模块级裸函数收口——`bin.ts:24 bootEnvironmentProblem` 收为类成员（`NodeEnvGuard` 静态判 · 环境守卫语义保：Node floor 门 · 退出消息字节零变）· `face/cli.ts:819 export function cli()` 收为组合根 static 工厂（`Cli.create(opts)` 或 boot 类——组合根入口即类 · bin.ts 调用类成员）——引擎五面 + 组合根全零裸函数
- **Files**:
  - Modify: `packages/cdd-engine/src-next/bin.ts`（bootEnvironmentProblem → NodeEnvGuard 类成员调用 · 组合根入口即类）
  - Modify: `packages/cdd-engine/src-next/face/cli.ts`（`export function cli` → `Cli.create`/boot 类静态工厂 · 调用方同步）
  - Test: `packages/cdd-engine/src-next/__tests__/bin.test.ts`（环境守卫 + 组合根入口 pin）
- **Consumes**: specs §4.1（引擎面两枚）· bin.ts:24 · cli.ts:819 · 既有 bin.test.ts 断言
- **Produces**: 引擎源码面零裸函数（src-next 非测试 `^(export )?(async )?function ` 零命中）· 组合根面向 class 工厂的稳定入口（字节语义 major 的 deliberate 面之一）
- **Steps**:
  - grep src-next 非测试面 `^(export )?(async )?function ` — checkable: 现存恰 2 枚（bin.ts:24 bootEnvironmentProblem · cli.ts:819 cli）
  - bin.ts：bootEnvironmentProblem 收 `NodeEnvGuard` 类（静态判 · 门语义与 exit 消息字节不变）· bin.ts 入口调用类成员 — checkable: bin.ts `^(export )?(async )?function ` 零命中
  - cli.ts：`export function cli` → 静态工厂 `Cli.create`（返回 Cli 实例 · 行为等价）· 全库调用 `cli(` 面同步（bin.ts · 测试面经重锚） — checkable: cli.ts 及其调用方 `^(export )?(async )?function ` 零命中
  - 重锚 pin：bin.test.ts 环境守卫用例 · cli.test.ts 组合根用例（deliberate pin break） — checkable: 新 pins 在册且断言非空
  - 跑 `pnpm -C packages/cdd-engine test` — checkable: 全绿
  - grep src-next 非测试 `^(export )?(async )?function ` — checkable: 零命中
  - 提交（`refactor(cdd-engine): 字面零裸函数收口——NodeEnvGuard + Cli.create 组合根（含组合根）`） — checkable: git log 单原子
- **Acceptance**: src-next 非测试面两枚裸函数零残留 · NodeEnvGuard 环境守卫语义保（byte 消息 + exit 语义）· Cli.create 组合根行为等价 · 引擎 vitest 全绿 · deliberate pins 重锚
- **DependsOn**: 4

### Task 10: 测试面零裸函数全量迁移 + 零命中 pin 门禁
- **Objective**: 引擎 15 个 test 文件 53 枚模块级裸函数 + scripts 测试辅助 2 枚全量收纳（test 辅助收为 describe/it 作用域局部函数或 `const` 箭头形态 · 随面销毁文件的裸函数随删）· 零裸函数全局 pin 门禁（grep `^(export )?(async )?function ` 跨引擎 + scripts 测试面零命中——kairos tests 迁移面仅 ci-validate 一文件 · 随 T5 删 · 不入门禁 scope）入 CI + 局部 commit
- **Files**:
  - Modify: `packages/cdd-engine/src-next/**/__tests__/*.test.ts`（15 文件 · 53 枚裸函数迁移）· `scripts/__tests__/**`（helpers/anatomy-fixture 等 2 枚）
  - Modify: `.github/workflows/pr-validate.yml`（零裸函数 grep pin job）· `package.json` precommit 序列（grep pin）或 guard 结构性 pin 承接
- **Consumes**: specs §4.3（测试面全量纳入 · 零豁免）· §7.1 删除面随删项 · T5/T7 已删测试面
- **Produces**: 全库测试面零裸函数（模块级 function 声明零命中）· 门禁 pin（CI job + 局部 commit）防回潮
- **Steps**:
  - 枚举现测试面裸函数（engine 15 文件 53 枚 · scripts 辅助 2 枚）：`face/__tests__/cli.test.ts:81/130/148/160/197/206/255/329` 等逐位址迁移 — checkable: 全量枚举清单落盘（55 枚）
  - 迁移形态：收进 describe/it 作用域局部函数 · 或 `const` 箭头 · 或类 static——**禁止保留模块级 `function`/`export function`**；随面摧毁的文件（T5/T7 删除面）裸函数随删 — checkable: 逐位址迁移 git diff 在册
  - 重跑引擎 suite + scripts unit + kairos suite — checkable: 全绿（迁移零行为差）
  - 落门禁：pr-validate.yml 加 grep pin job（`grep -rnE '^(export )?(async )?function ' packages/cdd-engine/src-next scripts --include='*.ts'` 零命中——async 形态入正则 · 拦截 run.ts main 类回潮 · scope = engine + scripts 两面）· precommit 序列含同 pin — checkable: pr-validate.yml 含 grep pin job 且 precommit 含同 pin
  - 全库 grep 验证零命中 — checkable: `^(export )?(async )?function ` 跨 engine + scripts 两面零命中
  - 提交（`refactor: 测试面零裸函数全量迁移 · 零命中 pin 门禁`） — checkable: git log 单原子
- **Acceptance**: engine + scripts 全部 `.ts` 模块级 `^(export )?(async )?function ` 零命中（kairos tests 迁移面 = ci-validate 随 T5 删 · 不入 scope）· 五 suite 全绿（引擎 513+ 项保持）· 门禁 pin（CI + precommit）在册 · 零行为差
- **DependsOn**: 5, 6, 7, 9

### Task 11: kairos 消费面同步（字节更替随 skill 文本 · D20 文本精简 · 行为树全绿作证）
- **Objective**: 字节更替（schema gen→get · smoke 入口 · run.ts 面删）随 kairos cdd-* SKILL.md 的 dispatch 字面/引用同步改——`cdd-spec-writer` author-spec 的 `schema gen phase-spec > <path>` → `schema get phase-spec --output skeleton <path>` · 其余 skill 文本（cdd-design/cdd-dev/cdd-close 若引 schema/smoke/run.ts 命令面）同步 · **D20 消费面文本精简（用户 in-flight · 2026-10-13 · 四 skill 面）**：① **四 skill（cdd-spec-writer · cdd-plan · cdd-dev · cdd-design）NEXT-LOOP 节点不复述 `next:` 具体字面**——只要求遵循 review 输出携带的 `next:` 字面执行任务（skill 重复 = 冗余复述 + 随字节更替漂移 · cdd-dev L53 三字面全复述为最重面）· **各 Review Convergence 不变体同简**（spec-writer I1 · plan I1 · dev I3 · design I2）② fix 父句 `(read file back to confirm)` → `(confirm the findings · backfill user adjudications into the carrier)`——读回 findings 确认 + 评审有裁定则回填进 findings carrier · 四 skill 全量 7 处同句 · cdd-close/cdd-report 无 NEXT-LOOP 零动 · 引擎 vitest + smoke 门 + kairos 行为树全绿作证同步完整（presentation-surface/grep-sweep pins 翻新）· **closeout 后置修正（用户 2026-10-13）**：引擎 `FIX_READBACK_SUFFIX`（实时 `next:` 渲染字面源）同句——引擎面补足 · 冻结 pin 同步翻新
- **Files**:
  - Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（author-spec dispatch 字面 · NEXT-LOOP/I1 精简）· `packages/kairos/skills/cdd-plan/SKILL.md`（NEXT-LOOP/I1 精简）· `packages/kairos/skills/cdd-dev/SKILL.md`（NEXT-LOOP/I3 精简 · 复述面最重）· `packages/kairos/skills/cdd-design/SKILL.md`（NEXT-LOOP/I2 精简 · NEXT-LOOP 已最小）· `packages/kairos/skills/*/SKILL.md`（若引 schema/smoke/run.ts 命令面逐一核）· `packages/kairos/tests/presentation-surface.test.ts`（pins 翻新）
- **Consumes**: specs §5.5（D20 需求裁定 · 用户拍板措辞 · 四 skill 面）· T4 的 schema get 新命令面 · T7 smoke 新入口 · 六个 kairos SKILL.md
- **Produces**: kairos skill 文本与引擎新字节面同步 · 消费面变更只发生在 author 节点表述（non-goal ④）· D20 精简落地（四 skill NEXT-LOOP 零 `next:` 字面复述 · fix 父句 confirm+backfill）
- **Steps**:
  - grep kairos skills 全树：`schema gen` · `smoke-cdd` · `run.ts validate` 等命令面引用位址清单 — checkable: 引用位址清单落盘
  - cdd-spec-writer author-spec：`schema gen phase-spec > <target>` 字面 → `schema get phase-spec --output skeleton <target>`（target=目标 doc · 就地生成 · 零中间文件）——其余位址按命令面更替同步 — checkable: kairos skills 全树旧字面零残留
  - **D20①**：四 skill NEXT-LOOP 节点 + Review Convergence 不变体（spec-writer **I1** · plan **I1** · dev **I3** · design **I2**）文本精简——删去 `next:` 具体字面复述段（cdd-spec-writer/plan L54/L58 `fix --type` + `done` · cdd-dev L53 `fix --type wave…` + `implement --plan…` + `done`（三字面最重）· cdd-design L97 `done`（L95 为 `### NEXT-LOOP` 头 + 空行 · `done` → `handoff-next` 在 L97 Do 节点））· 保留 review 派发行（`Dispatch the review round on the current ref`）· 保留规则句（`read the output's next: line and dispatch it as written` · 无 kind→command 映射层 · adjudication 覆盖当前世界态）· 示例枚举父段（`implement --plan`/`review --type`/`fix --type`/done 清单）从不变体删除 — checkable: 四 SKILL.md NEXT-LOOP/不变体节点零 next: 字面复述（grep 四文件 `re-enters the fix pass` / `dispatches the next ready wave` 零命中 · 不变体内 `implement --plan` 零命中 · review 派发行 + 规则句在册）
  - **D20②**：fix 父句 `(read file back to confirm)` → `(confirm the findings · backfill user adjudications into the carrier)`——四 skill 全量 7 处同句（spec-writer 2 · plan 2 · dev 2 · design 1）· 同步位 = 四 skill NEXT-LOOP 现句 + 各 Review Convergence 不变体句（spec-writer I1 · plan I1 · dev I3 · design I2）· 读回 findings 确认 + 评审有裁定则回填进 findings carrier · **cdd-close/cdd-report 零动（无 NEXT-LOOP）** — checkable: `cdd-{spec-writer,design,plan,dev}/SKILL.md` 四文件 `(read file back to confirm)` 零残留 · `(confirm the findings · backfill user adjudications into the carrier)` 在册（NEXT-LOOP 三 hit = spec-writer + plan + dev · 不变体四 hit = spec-writer I1 + plan I1 + dev I3 + design I2）· **引擎面**：`FIX_READBACK_SUFFIX`（session/next.ts）字面 = 新句 · 引擎 src 旧父句零残留（capsule.ts doc 注释 · next.test 冻结 pin 翻新）
  - presentation-surface / grep-sweep pins 翻新（skill 文本断言面随更替重锚） — checkable: 翻新 pins 在册且断言非空
  - 跑 `node --test packages/kairos/tests/*.test.ts` — checkable: 全绿（行为树 87 项保持 · 含翻新 pins）
  - 跑 `pnpm run precommit` — checkable: 过（kairos anatomy/word-face 对翻新后文本判压）
  - 提交（`docs(kairos): 消费面同步——schema get --output skeleton dispatch 字面 · D20 NEXT-LOOP 精简 · pins 翻新`） — checkable: git log 单原子
- **Acceptance**: kairos skills 全树 schema gen/smoke-cdd/run.ts validate 旧字面零残留（历史记载除外）· **四 skill NEXT-LOOP/不变体零 `next:` 字面复述（`re-enters the fix pass`/`dispatches the next ready wave`/不变体内 `implement --plan` 零命中）· `(read file back to confirm)` 四 SKILL.md 零残留 · `(confirm the findings · backfill user adjudications into the carrier)` 在册（NEXT-LOOP 三 hit + 不变体四 hit）** · 行为树 suite 全绿 · 翻新 pins 在册 · precommit 过 · **引擎面**：`FIX_READBACK_SUFFIX` 字面 = `(confirm the findings · backfill user adjudications into the carrier)` · 引擎 src 旧父句零残留 · 引擎 vitest 529/529 全绿
- **DependsOn**: 4, 7, 8

### Task 12: emit.ts 六前提重整（OOP 类族 · 产物字节零 drift）
- **Objective**: emit.ts（产物生成面 · `package.json#oscaner` → 各 harness manifest：`.claude-plugin/` · `.cursor-plugin/` · `packages/kairos/.claude-plugin` · `.github/ISSUE_TEMPLATE/*` · `marketplace/source.json`——`.version-bump` 是版本同步**审计配置**（checkVersionSync 读入 · 消费非产出 · 不入生成面））按六前提重整——在 T6 类族起点上完成 manifest 映射类族（高内聚低耦合 · 映射职责分面 · 死码清理 · 声明单源投影）· **产物字节零 drift**（emit-check 前后全等 · 已入库产物零更替）
- **Files**:
  - Modify: `scripts/emit.ts`（manifest 映射类族化 · 职责分面 · 死码清理 · 声明单源投影）
  - Test: `scripts/__tests__/emit.test.ts`（既有 emit 单元测试跟进类族形态 · 零行为差）
- **Consumes**: specs §6.2 · T6 的 emit 类族起点 · 现 emit 单元测试断言面
- **Produces**: emit.ts 六前提形态（OOP 类族 · 高内聚低耦合 · 声明单源投影）· 产物字节零 drift 可证（emit-check 前后全等）
- **Steps**:
  - 审 emit.ts 全量：manifest 映射职责分面（claude/cursor/marketplace/ISSUE_TEMPLATE 每面一个类族 · 输入 package.json#oscaner 单源 · **`.version-bump` = checkVersionSync 审计配置 · 消费非产出 · 生成面不含**） — checkable: emit.ts 职责分面清单落盘
  - 在 T6 类族上重整：职责分面 · 死码/空壳清理 · 声明单源投影保（不手写第二份数据面） — checkable: emit.ts 类族化且零裸函数
  - 跑 `pnpm run emit:check` — checkable: 前后产物字节全等（`git diff` 产物面零差）
  - 跑 `pnpm exec vitest run`（scripts unit） — checkable: 全绿
  - 跑 `pnpm run emit` 后 `pnpm run emit:check` — checkable: 仍 fresh（幂等/零 drift 双证）
  - 提交（`refactor(scripts): emit.ts 六前提重整——manifest 映射类族 · 产物字节零 drift`） — checkable: git log 单原子
- **Acceptance**: emit 产物字节零 drift（emit-check 前后全等 · `git diff` 零差）· scripts unit 全绿 · emit.ts 零裸函数 · 声明单源（零手写平行数据面）
- **DependsOn**: 6

### Task 13: 全链验收证据面收口（八项证据面）
- **Objective**: P5 全链收口前调用 specs §8.2 的八项验收证据面并自报——引擎 vitest 全绿（含新 pins）· kairos suite 全绿 · 全局零裸函数 grep pin 零命中 · 根 scripts 零验证逻辑 · CI 原生 job 序列绿 · 字节更替 deliberate pins 全绿 · smoke 门（新入口）绿 · emit-check 产物字节零 drift · EOF 全绿——无遗留 waver 门禁未过即进入变更集归并
- **Files**:（验收收口 · 零生产代码变更——除非发现缺口则按归域 env 修复后重核）
- **Consumes**: specs §8.2 · T1–T12 产出的全部 pins/门
- **Produces**: 验收证据面在册（逐项 command + exit code + 结果自报）· 供变更集归并前置核
- **Steps**:
  - 逐项核验八面：`pnpm -C packages/cdd-engine test` · `pnpm -C packages/kairos test` · 全局零裸函数 grep（跨 engine+scripts · scope 同 T10 门禁）· 根 scripts 零验证逻辑 grep（guard/validate 残面）· CI 原生 job 序列（等价本地跑）· deliberate pins（schema/smoke/Cli.create 锚）· 引擎 smoke 新入口 · emit-check 前后全等 · EOF 全库 grep — checkable: 八面各自 command + exit 0 + 结果在册
  - 任何缺口 → 归域/env 修复并重核（不允许带缺口进入变更集） — checkable: 修复后八面重核全绿
  - 记录证据到 rounds 报告（无代码提交——除非修复缺口） — checkable: 报告在册
  - 无变更（缺口为零）时表明验收 pass；有缺口修复则按归域原子 commit — checkable: git log 单原子（若有修复）
- **Acceptance**: 八项证据面全部 `command + exit 0 + 结果` 在册 · 全局零裸函数 grep 零命中 · 根零验证逻辑 grep 零残留 · EOF 全库恰一 newline · CI 原生序列全绿
- **DependsOn**: 10, 11, 12

### Task 14: 变更集归并（cdd-engine major · kairos patch · 不发布）
- **Objective**: P5 变更集归并入册——cdd-engine **major**（字节语义破面叙事：schema gen→get · Cli.create 组合根 · smoke 入口 · 校验归域）· kairos **patch**（消费面同步——净 bump 另受累计 pending `.changeset/oscaner-key-rename.md`（kairos major breaking）支配 · 非 P5 声明）· **不发布**（tag/publish 独立动作）· `pnpm exec changeset status` 无 empty 条目
- **Files**:
  - Create: `.changeset/<slug>.md`（cdd-engine major）· `.changeset/<slug>.md`（kairos patch）
- **Consumes**: specs §5.3/§8.1 · T13 验收证据面 · 累计 pending changesets 现状（oscaner-key-rename）
- **Produces**: P5 变更集两枚（major + patch · 类型明确 · 净 bump 注记）· 不发布的 pending 态
- **Steps**:
  - `pnpm exec changeset status` 先查累计 pending（确认 oscaner-key-rename kairos major 现状） — checkable: 现状清单无 empty 条目
  - 建 cdd-engine major changeset（breaking 段落叙事：schema gen→get 并入 · Cli.create 组合根 · smoke 入口迁移 · 校验归域实施） — checkable: .changeset 两文件在册且类型明确
  - 建 kairos patch changeset（消费面同步：schema get dispatch 字面 · D20 NEXT-LOOP 精简 + fix 父句 confirm+backfill · 随字节更替同步） — checkable: 两文件 EOF 恰一 newline
  - `pnpm exec changeset status` — checkable: 无 empty 条目 · 类型与叙事可读
  - 不发布（零 tag/publish 动作）· 提交（`chore: P5 变更集归并——cdd-engine major + kairos patch（不发布）`） — checkable: git log 单原子
- **Acceptance**: 两枚 changeset 在册 · `changeset status` 无 empty · 叙事含 breaking 段（major）· 零发布动作 · EOF 恰一 newline
- **DependsOn**: 13

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-13 | P5 计划 v0.1——整引擎 + repo CI 验证脚本重整（spec v0.3 Approved · D18 九裁定 + D19 schema 并入）：14 任务 · DependsOn 闭包派生 7 wave（归域三承 T1/T2/T3 + schema 并入 T4 → 根零验证 T5 · scripts 收类 T6 · 引擎收口 T9 → smoke 迁引擎 T7 · CI 原生 T8 · emit 起点并入 T12 → 测试面迁移 T10 · 消费面同步 T11 → 验收证据面 T13 → 变更集归并 T14 · 不发布）· 波序按 closure 自动推导（引擎 review/implement derived waves）| Oscar M. · Claude Opus 5（kairos:cdd-plan [P5] 会话 · 2026-10-13） |
| v0.2 | 2026-10-13 | P5 计划 v0.2——**D20 消费面精简 backfill（用户 in-flight · 2026-10-13 · spec v0.4）**：T11 扩 D20 ①②——① 三编排器 skill（cdd-spec-writer · cdd-design · cdd-plan）NEXT-LOOP **零 `next:` 具体字面复述**（只遵循 review 输出携带字面派发）· **I1 Review Convergence 同简** ② fix 父句 `(read file back to confirm)` → `(confirm the findings · backfill user adjudications into the carrier)`（读回确认 + 裁定回填 findings carrier）· T14 kairos patch 叙事 +D20 | Oscar M. · Claude Opus 5（kairos:cdd-plan [P5] 会话 · 2026-10-13） |
| v0.3 | 2026-10-13 | P5 计划 v0.3——**D20 scope 校正确认（用户追问「cdd-dev 面为什么不动」→ 原「三编排器」收敛范围误判 · spec v0.5）**：D20 面扩至**四 skill（cdd-spec-writer · cdd-plan · cdd-dev · cdd-design）**——cdd-dev L53 `fix --type wave…`+`implement --plan…`+`done` 三字面全复述为最重面 · Review Convergence 不变体同简按 skill（spec-writer I1 · plan I1 · dev **I3** · design **I2**）· fix 父句全量 **7 处**（dev L53/L85 在面内）· cdd-close/cdd-report 无 NEXT-LOOP 零动 · AC pin 扩四文件 | Oscar M. · Claude Opus 5（kairos:cdd-plan [P5] 会话 · 用户 scope 追问 · 2026-10-13） |
| v0.4 | 2026-10-13 | **P5 计划 v0.4——plan-review-1 修复轮（8 warn + 2 nit · 全数落地 · 零残 · spec v0.6）**：T4（runSchemaGen/artifacts·projection 断言并入 Files · `--output` 默认 json pin · smoke 锚复核 = 无锚可同步）· T6（计数 37→38 总 = 收类 17 + 迁/撤 21 · 新建 scan.test.ts 承接 scanToken 覆盖 · 统一正则含 async）· T7（smoke.test.ts 随删面 · engine package.json `smoke` script 产出 pinn · dry-run 链 = implement+review 二命令 + `--help` face）· T10 gate 统一 `^(export )?(async )?function ` · T11（cdd-design NEXT-LOOP Do `done` 行 pin L96→L97）· T12（`.version-bump` = 版本同步审计配置 · 消费非产出 · 不入生成面）· 约束行 async 形态纳入 | 引擎 plan-fix 轮 · Oscar M. · Claude Opus 5（kairos:cdd-plan [P5] 会话 · 2026-10-13） |
| v0.5 | 2026-10-13 | **P5 计划 v0.5——plan-review-2 修复轮（1 warn + 1 nit · 全数落地 · 零残）**：T10 零裸函数门禁 scope 收敛 engine + scripts 两面（kairos tests 迁移面 = ci-validate 随 T5 删 · 与约束行 8/§4.3 测试面枚举一致 · 步 4/5 + AC 措辞同步 · T13 证据 grep 随同步）· T11 cdd-design NEXT-LOOP 头行 pin 差 1 修正（L96 → L95 · 现场核对 cdd-design SKILL.md L95 头 + L97 Do） | 引擎 plan-fix 轮 · Oscar M. · Claude Opus 5（kairos:cdd-plan [P5] 会话 · 2026-10-13） |
| v0.7 | 2026-10-13 | **P5 计划 v0.7——D20② 引擎面补足（用户 closeout 后置报告 · 2026-10-13 · spec v0.8 · overall v2.16）**：`FIX_READBACK_SUFFIX`（session/next.ts · fix 路线 `next:` 渲染字面源）字面 `(read file back to confirm)` → `(confirm the findings · backfill user adjudications into the carrier)`——T11 D20② 落点扩引擎面（消费面 7 处已在 v0.6 前全改 · 引擎字面源未随 · 用户后置发现）· D20② 步/AC + 引擎面 checkable · 引擎 src 旧父句零残留（next.ts · capsule.ts doc 注释 · next.test 冻结 pin + 编译期字面翻新）· 引擎 vitest 529/529 全绿 | [human] · Claude Fable 5（2026-10-13 · 用户报告修正） |
| v0.6 | 2026-10-13 | **P5 计划 v0.6——P5 closeout（cdd-close）**：七 wave 实现链全闭合（W1={1,2,3,4} 校验归域+schema 并入 → W2={5,9} root 解散+引擎零裸面 → W3={6,7} scripts 收类+smoke 迁引擎 → W4={8,10,12} CI 原生+测试面迁移+emit 重整 → W5={11} 消费面同步 → W6={13} 验收证据 → W7={14} 变更集归并 · 每波 implement→review→fix 各 APPROVED）+ 分支终审 → 分支 fix 闭环（branch-review-1 8 findings（1 warn + 7 nit）→                              branch-fix-1：F3/F4/F5/F6 落地 + CLAUDE.md 死链清扫 + README 收敛账本随行 · F1/F2/F7 上报编排器）· 编排器三项回填（closeout 轮）：**F1** `b67fc66b` 删除兄弟程序 upgrade-dependencies-and-src-rename 三文档（3 files · 337 deletions · 零注册）→ 本行登记 + overall 依赖图跨程序行重指向；**F7** Task 4 did-you-mean 措辞实铆（`schema g` 单字符 0.333 < commander 0.4 相似度地板 → 静默零建议 · 绝无 phantom dispatch）；**F2** Task 2 `workspace:*` 消费通道措辞实铆（kairos `node --test` 直跑 `.ts` 相对路径引引擎契约源 · 引擎 `exports` 仅开 CLI 入口 `bin.ts` · 消费面零子路径导出扩张）· 验收全项交付（`.kairos/cdd/.../tasks-13-test-evidence.json`：`pnpm run validate` exit 0 · typecheck ×3 · 引擎 529/529 · kairos 77/77 · emit-check fresh · 零裸函数 grep 零命中 · version-sync kairos 0.2.0 · cdd-engine 1.0.0）· 不发布 · 父 overall v2.15 登记 P5 → Done | [human] · Claude Opus 5（kairos:cdd-close · closeout-backfill） |
