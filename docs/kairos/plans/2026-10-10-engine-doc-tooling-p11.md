---
title: 引擎文档工具（Engine Doc-Tooling）— P11 实施计划：dispatch contract 收口（child Return 去结构化 + `--dry-run` 真只读预览 + `RoundNaming` 命名单源）
doc-type: plan
version: v0.6
date: 2026-10-19
slug: 2026-10-10-engine-doc-tooling-p11
depends-on: P10（Done · v0.10 · hard——P10 全链闭合后 dispatch contract 收口 · D50）
base: develop
---

## Constraints

- **判定语义不变**：`invariants.ts` 判压逻辑逐条不变；退出码表 0/1/2 · CDD_BLOCKED 通道 · 领域 run 语义 · `next:` 字面形态零变化（唯一例外 = D51 已落地的 fix 跳旗标 `--reviews`）。
- **破坏性变更许可**：可删 `DispatchOutcome.artifacts` 字段 · `ReturnZone` 接口 · `returnFormats()` · `#parseBlockReturn` · no-status 门 · `migrateJsonChild`；不保留旧 `--dry-run` book 语义；不引 legacy 兼容层。
- **零裸函数**：新增 `RoundNaming` 为类；模块级导出仅类型 / 数据 / 类（`check:no-bare-functions` 门）。
- **不造轮子**：预览输出用手写行（无第三方依赖适用）；不引模板引擎。
- **单一行为路径**：不为 dry-run 做分支特判蔓延——写点的关闭要么落在写点本身（ensure 显式调用点退休 · migrate 全退休），要么集中在 preview 单一路径（`renderBrief`/`#bookkeep`）。
- **唯一进程信号** = `result.code !== 0`；结论一律来自 handoff 草稿 + test-evidence 回读。
- **全活面常量改名零残留**：`RETURN_STDOUT_BLOCK` → `RETURN_PROSE`（引擎 src + 测试 + templates token 族 + `docs/maintainers/*`）；`--findings`/`INPUT_FINDINGS` 活面零残留（D51 已落地，综合作回归 pin）；**历史面不追改**。
- **D29 黑盒边界**：skill 文本零改动；本 phase 消费面可见变化仅限 README + flag help。
- **变更先回填 parent overall**：spec 阶段已 discharge（D50/D51 + R1–R3 回填，见 spec/overall Change history）；本 plan 为格式无关的实现分解，保持 overall change-history 行字节不变。
- **中间态红窗口**：A 组模板/解析翻面（T1/T2）期间，`returnFormats` pin（`render.test.ts:48`）随 T1 迁移收口；两行 fence pin（`render/__tests__/render.test.ts:66`，§2.4 在册）由 **T6** 迁移，红窗口延续至 T6——全量测试面绿收口于 T6。
- **T2 已 hotfix 落地（in-flight）**：T1 单独落地后真实派发自锁——child 按新模板返回纯散文（无 `status:` 行），而引擎 no-status 门（T2 方删）仍存 → 每次真实派发 BLOCKED。已手动落地 T2 全量（删 `#parseBlockReturn` · `#dispatch` 的 no-status 门 · `DispatchOutcome.artifacts`，加私有 `#stdoutTail` 崩溃通道，commit `6ac29ac`）解锁；T1+T2 同属 A 组原子翻面，但 T2 的 `DependsOn` 边（T2 消费 T1）保留，故波次仍 W1={1,3,4} · W2={2,5} · W3={6}——唯 T2 的代码已随 hotfix 落地，W2 的 `implement` 面实际仅 T5。
- **注册连带已落地**：本 plan 落仓引入第 23 条语料（`docs/kairos/plans/*.md` 10→11 · total 22→23），corpus form-pin（`packages/cdd-engine/src-next/contract/__tests__/corpus-form-pin.test.ts`）已随注册重锚（`plans` 10→11 · total 22→23 · `specs`=12 不变，standalone 连地带 commit `6b4e38b`，仿 `e062355e` 对 spec 侧同型重锚）；引擎套件回绿。T6 的 §2.4 测试面迁移**不含**本钉（§2.4 的 pin 面 = F1 双面 / smoke / 两行 fence / `returnFormats` / `Object.keys(template.return)` / `migrateJsonChild`）。
- **不发布**：changeset（cdd-engine major）落 pending；tag / publish = 独立动作。
- **English-primary**（SKILL.md / `docs/*.md`）· specs/plans 中文（Strategy B）· emit 产物派生（`pnpm run emit`）· EOF 恰一 newline。

### Task 1: A 组模板翻面——`RETURN_ZONE` 改纯散文 + `ReturnZone`/`returnFormats()` 内省退休 + 全活面常量改名
- **Objective**: 把 `render/templates.ts` 的 `RETURN_ZONE`（`:414`）return 面由两行固定键值（`status:` / `artifacts:`）改为**单散文块**，zone key `RETURN_STDOUT_BLOCK` 更名 `RETURN_PROSE`；删除不再有「多形态」可枚举的 `ReturnZone` 接口（`:68`）与 `returnFormats()` 内省方法（`:505`，读点 `:527`/`:614`）；常量改名在**全活面**（引擎 src + 测试 + `docs/maintainers/*`）零残留。散文**不转发**到 CLI stdout（stdout 是编排器的机器面）；`## Return` 小节保留（child 收尾纪律 + host 日志可读面）。
- **Files**: Modify `packages/cdd-engine/src-next/render/templates.ts`（`:414` 块改写 · key 更名 · `:68` 接口删 · `:505` 方法删 · `:527`/`:614` 引用改 · `:37` 注释改）· Modify `packages/cdd-engine/src-next/infra/runtime.ts`（`:76` 注释）· Modify `packages/cdd-engine/src-next/face/lifecycle.ts`（`:66`/`:411` 注释）· Modify `packages/cdd-engine/src-next/infra/__tests__/infra.test.ts`（`:55` 注释 · `:111` pin）· Modify `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（`:48` pin）· Modify `packages/cdd-engine/src-next/face/__tests__/sync-runner.test.ts`（`:8` 注释）· Modify `docs/maintainers/02-naming.md`（`:7`/`:40`）· Modify `docs/maintainers/03-cache-doctrine.md`（`:21`）
- **Consumes**: spec §2.1 散文块原文 · §2.2 的 `ReturnZone`/`returnFormats()` 删除行 · AC 的全活面零残留 pin
- **Produces**: `RETURN_ZONE` 的 return 面 = `RETURN_PROSE: [ ...散文... ]`（单块 · 无 `status:`/`artifacts:` 键值行）；`ReturnZone` 与 `returnFormats()` 不在册；`RETURN_STDOUT_BLOCK` 全活面零残留
- **Steps**:
  - 改写 `RETURN_ZONE`（`templates.ts:414`）为单散文块，key `RETURN_STDOUT_BLOCK` → `RETURN_PROSE`，`:527`/`:614` 用点同步 — checkable: `grep -rn RETURN_STDOUT_BLOCK packages/cdd-engine/src-next docs/maintainers` 零命中
  - 删 `ReturnZone` 接口（`:68`）与 `returnFormats()`（`:505`）— checkable: `tsc --noEmit -p packages/cdd-engine` 退出 0
  - 迁移两处测试 pin（`infra.test.ts:111` 的 `Object.keys(template.return)` → `["RETURN_PROSE"]`；`render.test.ts:48` 的 `returnFormats()` pin 退役或改 `RETURN_PROSE` 存在断言）— checkable: `pnpm -C packages/cdd-engine test` 相关面 PASS
  - 注释与 `docs/maintainers` 旧名同步 — checkable: `grep -rn RETURN_STDOUT_BLOCK packages/cdd-engine/src-next docs/maintainers` 零命中
- **Acceptance**: 模板 `## Return` 为纯散文、zone key = `RETURN_PROSE`；`ReturnZone` / `returnFormats()` / `RETURN_STDOUT_BLOCK` 全活面零残留
- **DependsOn**: none

### Task 2: A 组引擎侧删除 + `stdoutTail` 通道——stdout 零解析 · 两失败面落 crash record
- **Objective**: 删引擎对 child stdout 的全部解析——`face/lifecycle.ts#parseBlockReturn`（`:414`）整个方法 · `#dispatch` 的「exit 0 但无 `status:` 行 → BLOCKED」门（`:211-214`）· `#reconstruct` 第二参 `block` 与 `:526` 的 `artifacts: block.artifacts`（调用形状收为 `#reconstruct(frame)`）· `session/run.ts` 的 `DispatchOutcome.artifacts` 字段（`:104`）与 `#bookkeep` 两处传参（`:452`/`:455`）。同时**显式设计 `stdoutTail` 通道**——新增私有字段 `#stdoutTail`：`#dispatch` 在子进程返回后置 `#stdoutTail = result.stdout`；子进程非零退出（`:205-208`）与草稿缺失（经 `#reconstruct` 草稿缺失腿 `:460-462`）两失败面统一经 `#reject`（`:534-548`）**读该字段**落 crash record，`stdoutTail` 存子进程输出**尾部**，长度以命名常量 `STDOUT_TAIL_MAX` 限界（今日 `:540` 恒空）；`#reconstruct(frame)` 保持单参——stdout 不经重建签名传递（finding：`#reconstruct(frame, stdout)` 加宽与 §2.2 收口相抵，已否）。hermetic 注入 dispatch 改经既有 `carrier`（`run.ts:110`）表达产物。
- **Files**: Modify `packages/cdd-engine/src-next/face/lifecycle.ts`（`:414` 方法删 · `:211-214` 门删 · `:445`/`:526` `#reconstruct` 签名与调用 · 新增私有字段 `#stdoutTail`（`#dispatch` set · `#reject` read）· `#reject` `:534-548` 读 tail + `STDOUT_TAIL_MAX` · `:540`）· Modify `packages/cdd-engine/src-next/session/run.ts`（`:104` 字段删 · `:452`/`:455` 传参删 · hermetic 注入经 `carrier` `:110`）
- **Consumes**: Task 1（模板已无 stdout 契约）· spec §2.2 删除清单 · §2.3 hermetic carrier · §2.1 `stdoutTail` 通道
- **Produces**: 引擎零解析 child stdout，唯一信号 `result.code !== 0`；`#reconstruct(frame)` 单参；两失败面产 crash record 且 `stdoutTail` 非空（`STDOUT_TAIL_MAX` 限界）；`DispatchOutcome.artifacts` 零残留
- **Steps**:
  - 删 `#parseBlockReturn` 与 no-status 门；`#dispatch` 尾行改 `return this.#reconstruct(frame)` — checkable: `grep -n parseBlockReturn packages/cdd-engine/src-next/face/lifecycle.ts` 零命中；`tsc --noEmit -p packages/cdd-engine` 过
  - `#reconstruct` 去第二参，删 `:526` 的 `artifacts: block.artifacts` — checkable: `grep -n 'block.artifacts' packages/cdd-engine/src-next/face/lifecycle.ts` 零命中
  - 删 `DispatchOutcome.artifacts`（`run.ts:104`）与 `#bookkeep` 两处传参；hermetic 注入改经 `carrier` — checkable: `grep -rn 'artifacts' packages/cdd-engine/src-next/session/run.ts` 仅剩 carrier/非该字段命中
  - `stdoutTail` 通道：`#dispatch` 置私有字段 `#stdoutTail = result.stdout`，`#reject`（`:534-548`）读该字段按 `STDOUT_TAIL_MAX` 截尾写入 crash record（两失败面——非零退出与 `#reconstruct` 草稿缺失腿——统一经 `#reject` 取到该字段；`#reconstruct` 保持单参） — checkable: 新 pin 用例「非零退出 / 无 draft → crash record `stdoutTail` 非空」PASS
  - 全量 — checkable: `pnpm -C packages/cdd-engine test` 生命周期面 PASS
- **Acceptance**: 引擎对 child stdout 零解析；「exit 0 无 status 行」门零残留；`DispatchOutcome.artifacts` 字段零残留、`#reconstruct` 第二参已删、`face/lifecycle.ts:526` 的 `block.artifacts` 零残留；crash record `stdoutTail` 非空 pin 在册（经私有字段 `#stdoutTail`：`#dispatch` set → `#reject` read；`#reconstruct(frame)` 单参）
- **DependsOn**: 1

### Task 3: C 组 ensure/migrate 遗留退休——写点自 ensure · `#readBase` 走 `readJson` · `migrateJsonChild` 死码删除
- **Objective**: 关闭 C 组的读写遗留写点：两条显式 `Workspace.ensure()` 调用点（`face/cli.ts:797` `#sceneOf` · `:958` `#runBase`）退休；`#runWork`（`face/cli.ts` 预检通过后、首个写点前）补一次 `Workspace.ensure()`，**覆盖所有面**（wave / spec / plan / branch；`dryRun` 旗标跳过——守 B 组零写）——真实运行首个写点，子进程 OUTPUT_REPORT / OUTPUT_HANDOFF 目标目录的建立者（原设计仅在 `type === "wave"` 时经 `CliGate#renderBrief` ensure，spec/plan/branch 面在空仓真实派发时 `.kairos/<slug>/` 缺席）；`CliArtifacts#readBase`（`face/artifacts.ts:221-223`）的裸 `JSON.parse(readFileSync(...))` 改走 `Workspace.readJson`（读写同一条归一化路径），使 P9 读时归一化真正覆盖 `base.json`；三处 `migrateJsonChild` 调用点（`face/cli.ts:803`/`:804`/`:962`）随之退休，`Workspace.migrateJsonChild`（`infra/workspace.ts:293`）成死码，连同其四直测（`infra/__tests__/infra.test.ts:332-359`）一并删除。`Workspace.ensure()` 方法本身保留（`writeJson` 内部调用它），仍是 `.kairos/.gitignore` keep-out 标记的唯一发布点，发布时机不变（真实运行首个写点）；只读的 `cdd base get` 不再建 `.kairos/`。
- **Files**: Modify `packages/cdd-engine/src-next/face/cli.ts`（`:797`/`:958` ensure 退休 · `#runWork` 预检后补一次 ensure（所有面；`dryRun` 跳过）· `:803`/`:804`/`:962` migrate 调用退休）· Modify `packages/cdd-engine/src-next/face/artifacts.ts`（`:221-223` 改 `Workspace.readJson`）· Modify `packages/cdd-engine/src-next/infra/workspace.ts`（`:293` 方法删）· Modify `packages/cdd-engine/src-next/infra/__tests__/infra.test.ts`（`:332-359` 四直测删）· Test `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（新增空仓首派 pin：wave + spec/plan/branch 面）
- **Consumes**: R1/R2 裁定（写点自 ensure · `#readBase` 归一化）· spec §3.2 前两行 · §4.2
- **Produces**: 显式 `ensure()` 调用点仅 `#runWork` 一处（真实运行首个写点，覆盖所有面 wave/spec/plan/branch）；`migrateJsonChild` 零残留；`#readBase` 经 `Workspace.readJson`
- **Steps**:
  - `#sceneOf`（`:797`）/`#runBase`（`:958`）的显式 `.ensure()` 退休；`#runWork`（`face/cli.ts` 预检后、首个写点前）补一次 `Workspace.ensure()`，覆盖所有面（`dryRun` 旗标跳过）— checkable: `grep -rn '\.ensure()' packages/cdd-engine/src-next/face --include='*.ts' | grep -v __tests__` 仅剩 `cli.ts` 一处（生产面；`face/__tests__/` 内既有 `board-view.test.ts`/`cli.test.ts` 的 `.ensure()` 不在该信号内）
  - `#readBase` 改走 `Workspace.readJson`（缺失文件 tri-state 回 `{kind:"missing"}`，不抛）— checkable: 新 pin「持 legacy 绝对 `plan` 的 base.json → `cdd base get` 报 repoRoot 相对形」PASS
  - 删三处 `migrateJsonChild` 调用（`cli.ts:803`/`:804`/`:962`）与方法本体（`workspace.ts:293`）+ 四直测（`infra.test.ts:332-359`）— checkable: `grep -rn migrateJsonChild packages/cdd-engine/src-next` 零命中
  - 只读 `base get` 零写 — checkable: fresh-repo pin「`cdd base get` 不建 `.kairos/`」PASS
  - 空仓首次真实 dispatch 建目录（所有面）+ wave 面渲染 brief（零 ENOENT）— checkable: fresh-repo pin「空仓 spec/plan/branch 真实派发即在子进程 spawn 前建 `.kairos/<slug>/` 且发布 `.kairos/.gitignore`」「空仓 wave 首派建 `.kairos/` 且 brief 已渲染」PASS；`pnpm -C packages/cdd-engine test` PASS
- **Acceptance**: 两条 `face/cli.ts:797`/`:958` 调用点退休后零残留；真实运行派发入口（`#runWork`）的显式 `ensure()` 为首个写点，覆盖所有面（wave / spec / plan / branch），dry-run 分支不达；`migrateJsonChild` 调用点与方法本体零残留（四直测删除）；base.json 归一化 pin 在册；空仓首次真实 dispatch（wave + spec/plan/branch）建目录（wave 面并渲染 brief）零 ENOENT pin 在册
- **DependsOn**: none

### Task 4: C 组 `RoundNaming` 命名单源——lifecycle 私有命名散点收编 · handoff 名委派 `Ledger`
- **Objective**: 新建 `session/round-naming.ts` 的 `RoundNaming` 类，持有 frame → 产物名（report / evidence / brief）的派生；`CliLifecycle` 的私有命名散点 `#outputOf`（`face/lifecycle.ts:379`，用于 `:337-338`/`:663`/`:665`）· `#evidenceName`（`:405`，用于 `:504`）· `#evidencePrefix`（`:687`，用于 `:680`）退休，改由 `RoundNaming` 提供，`CliLifecycle` 与 dry-run preview **两面**共用（`#reconstruct` 为 `CliLifecycle` 自身方法，属第三调用点而非第三面）。handoff 名**不另起推导**——委派 `Ledger#handoffName`（`session/ledger.ts:836`）的 `HANDOFF_FAMILIES` 表（守 D26）；brief 名产地 `CliGate#renderBrief`（`face/gate.ts:118`）。
- **Files**: Create `packages/cdd-engine/src-next/session/round-naming.ts` · Modify `packages/cdd-engine/src-next/face/lifecycle.ts`（`:379`/`:405`/`:687` 三私有法退休 · 调用点 `:337-338`/`:663`/`:665`/`:504`/`:680` 改走 `RoundNaming`）· Modify `packages/cdd-engine/src-next/face/gate.ts`（brief 名接 `RoundNaming`）· Test `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`
- **Consumes**: spec §4.1 · `Ledger#handoffName` 的 `HANDOFF_FAMILIES` 表（`session/ledger.ts:820`/`:836`）
- **Produces**: `class RoundNaming`（frame → report / evidence / brief 名）；handoff 名委派 `Ledger#handoffName`（不另起推导）
- **Steps**:
  - 写 failing test（`RoundNaming` 三名派生：给定 frame → report/evidence/brief 名确定）— checkable: `pnpm -C packages/cdd-engine test round-naming` FAIL（类未建）
  - 建 `round-naming.ts`；`CliLifecycle` 三私有法退休改调 `RoundNaming` — checkable: `grep -nE '#outputOf|#evidenceName|#evidencePrefix' packages/cdd-engine/src-next/face/lifecycle.ts` 零命中；`tsc --noEmit -p packages/cdd-engine` 过
  - handoff 名委派 `Ledger#handoffName`；brief 名接 `RoundNaming` — checkable: `pnpm -C packages/cdd-engine test` PASS；零裸函数 pin 绿
- **Acceptance**: `RoundNaming` 为命名唯一来源（`#outputOf` / `#evidenceName` / `#evidencePrefix` 零残留）；handoff 名委派 `Ledger#handoffName` 的 `HANDOFF_FAMILIES` 表（不另起推导）；`RoundNaming` 为类、零裸函数
- **DependsOn**: none

### Task 5: B 组 `--dry-run` 真只读预览——零写边界 · 预览输出形面 · 删合成 dispatch · 适用面收窄
- **Objective**: `--dry-run` 从「book 一轮的模拟运行」改为**纯读的下一步预告**（issue #345 方案 b）：`face/cli.ts#dispatchOf`（`:640`）删除合成 `() => ({ status: "APPROVED", findings: [] })`；dry-run 路径跳过全部写点（`#sceneOf` 装配 · `renderBrief` · `#bookkeep` 的 `persistHandoff`/`recordRound`/`recordReviewedRevision`/`recordReviewedBrief` · `#reject`），只跑 pre-flight 四门（纯读）；输出**单块预览**（`step:` / `reads:` / `would write:` / `would record:` / `child:` 五行，无 `status:`/`next:` 行，路径 repoRoot-relative）；`child:` 行 = 检出 host 时 `<HostId>` + `" "` + `HOSTS.<id>.invoke`（invoke 实参串逐字照 `face/host.ts:149`），未检出 host 时写字面量 `(no host detected — real run would BLOCK)`（不索引 `HOSTS[""]`）；`--dry-run` 收窄为 implement/review/fix 专用（其余命令 usage 报错 exit 2）；pre-flight 拒绝时输出与真实运行一致并 exit 1。
- **Files**: Modify `packages/cdd-engine/src-next/face/cli.ts`（`#dispatchOf` `:640` 删合成 + dry-run 分支到预览单一路径 · `:492` renderBrief 调用点收口 · 收窄 usage 门）· Create `packages/cdd-engine/src-next/face/preview.ts`（预览渲染器，消费 `RoundNaming` 与 `HOSTS`）· Test `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`
- **Consumes**: Task 3（零写边界）· Task 4（`RoundNaming` 产物名）· spec §3.1–§3.5
- **Produces**: dry-run 零 repo 写入、不占轮次；预览五行块（无 `status:`/`next:`）；收窄 exit 2；pre-flight 拒绝同真实面 exit 1
- **Steps**:
  - 写 failing test（预览五行断言 + `git status --porcelain` 前后一致 + `.kairos/` 缺席 + 同一命令随后真实 review 可立即执行）— checkable: `pnpm -C packages/cdd-engine test preview` FAIL（今日 dry-run book 一轮）
  - 删合成 dispatch（`cli.ts:640`），dry-run 走预览单一路径（跳过所有写点）— checkable: 上述零写 pin PASS
  - 预览输出形面（五行 + `child:` 行：检出 host 时 `<HostId>` + `HOSTS.<id>.invoke`，未检出时字面量 `(no host detected — real run would BLOCK)`）— checkable: 五行断言 PASS
  - 收窄：非 implement/review/fix 携带 `--dry-run` → usage exit 2；pre-flight 拒绝 → 同真实面 exit 1 — checkable: 两条 pin PASS
- **Acceptance**: dry-run 对本 repo 零字节修改（`git status --porcelain` 前后一致）；不占轮次（ledger `rounds.review` 未被预占）；预览含五行且无 `status:`/`next:`；`child:` 行 = 检出 host 时 `HostId`+invoke（非 `claude-code`）、未检出 host 时字面量 `(no host detected — real run would BLOCK)`；非 implement/review/fix 的 `--dry-run` exit 2
- **DependsOn**: 3, 4

### Task 6: 测试面迁移（§2.4）+ 文档面 + 变更集
- **Objective**: 把 §2.4 的四组 pin 逐条就地重述（F1 回归双面 · 发布门 smoke 重述 · 两行 fence pin 换散文断言 · 合成批准块改注入/预览断言 · `--dry-run` 调用点计数与 D50 的 23 处对账 · `cli.test.ts` 的 25 处 dry-run-E2E 用例改 preview 块断言——W2 边界红，旧 book-轮 断言随 T5 退场）；文档面同步（`declare.ts` flag help + `packages/cdd-engine/README.md` + `packages/cdd-engine/README.zh-CN.md` 三处文案一致为「preview the next dispatch step and its expected artifacts — zero repo writes, no round consumed」；`docs/maintainers/01-doctrine.md:41` 的发布门句随 smoke 重述同步）；变更集：cdd-engine **major** 在册（覆盖全 phase）。
- **Files**: Modify `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`:2586-2624` F1 拆两面 · 合成批准块 · 25 处 dry-run-E2E 改 preview 断言 · `--dry-run` 调用点）· Modify `packages/cdd-engine/src-next/__tests__/smoke.integration.test.ts`（`:191-209` 改 preview+零写）· Modify `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（`:69-87` 两行 fence → 散文区断言）· Modify `packages/cdd-engine/src-next/face/declare.ts`（flag help）· Modify `packages/cdd-engine/README.md` · Modify `packages/cdd-engine/README.zh-CN.md` · Modify `docs/maintainers/01-doctrine.md`（`:41`）· Modify `.changeset/*`（cdd-engine major）
- **Consumes**: Task 1–5 的行为面 · spec §2.4 · AC 测试/文档面
- **Produces**: 测试面全绿；README ×2 + flag help 文案一致；cdd-engine major changeset 在册
- **Steps**:
  - F1 回归（`cli.test.ts:2586-2624`）拆两面（真实运行腿空仓 fixture 真 dispatch · `--dry-run` 腿预览 + 零写）— checkable: 该用例 PASS
  - smoke（`:191-209`）改「preview + 零写」；`docs/maintainers/01-doctrine.md:41` 同步 — checkable: `pnpm -C packages/cdd-engine run smoke` PASS
  - 两行 fence pin（`render.test.ts:69-87`）→ 散文区断言；合成批准块改注入/预览断言；`cli.test.ts` 25 处 dry-run-E2E 改 preview 断言（旧 book-轮 断言退场）；`--dry-run` 调用点计数与 D50 的 23 处对账 — checkable: `pnpm -C packages/cdd-engine test` PASS
  - README ×2 + flag help 文案一致；changeset 在册 — checkable: `grep -rn 'preview the next dispatch step' packages/cdd-engine/README.md packages/cdd-engine/README.zh-CN.md packages/cdd-engine/src-next/face/declare.ts` 三命中；`.changeset/*` 含 cdd-engine major
  - 全量 — checkable: `pnpm run validate` 退出 0
- **Acceptance**: 测试面全绿（含 §2.4 逐条迁移 + `cli.test.ts` 的 25 处 dry-run-E2E）；README ×2 + flag help 文案一致；`RETURN_STDOUT_BLOCK` / `--findings` 全活面零残留综合作回归 pin 绿；cdd-engine major changeset 在册；不发布
- **DependsOn**: 1, 2, 3, 4, 5

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-18 | 初稿——P11 实施计划：A 组 child Return 去结构化（T1 模板/内省 + T2 引擎删除/`stdoutTail`）· B 组 `--dry-run` 真只读预览（T5）· C 组 `RoundNaming` 命名单源（T4）+ ensure/migrate 遗留退休（T3）；测试面迁移与文档面/变更集单列（T6）；D 组（D51 命名收口）已落地无实现面。波次：W1={1,3,4} · W2={2,5} · W3={6} | Oscar M. · Claude Opus 5（kairos:cdd-plan [P11] · 2026-10-18） |
| v0.2 | 2026-10-18 | docs-fix round 1——落实 plan-review-1 四条：Constraints 增「注册连带已落地」行（plan-commit 第 23 条语料 → corpus form-pin 重锚 `plans` 10→11/total 22→23/`specs`=12，commit `6b4e38b`；T6 §2.4 不含本钉）· T2 `stdoutTail` 通道指名私有字段「`#dispatch` set → `#reject` read」（`#reconstruct(frame)` 保持单参，加宽签名被否）Objective/Files/Steps/Acceptance 同步 · T5 `child:` 行补未检出 host 分支字面量 `(no host detected — real run would BLOCK)` Objective/Steps/Acceptance 同步 · T3 step-1 grep checkable 收窄至生产面（`--include='*.ts' | grep -v __tests__`，排除 `face/__tests__/` 既有命中） | Oscar M. · Claude Opus 5（kairos:cdd-plan [P11] docs-fix round 1 · 2026-10-18） |
| v0.3 | 2026-10-19 | in-flight backfill（review blocker F1 + T2 hotfix）：(a) ensure 扩面——T3 写点由「`CliGate#renderBrief` 一处（`type === "wave"` 门内）」改为「`#runWork` 真实运行派发入口对所有面一次（预检后、首个写点前，`dryRun` 跳过）」，对齐 spec v0.5 §3.2/§4.2/§1.3；T3 Objective/Files（去 `gate.ts`、归 `cli.ts`）/Steps/Acceptance 同步 + 空仓 spec/plan/branch 派发 pin。(b) T2 已 hotfix 落地（commit `6ac29ac`）：T1 单独落地致真实派发自锁（散文无 `status:` 行 vs 未删的 no-status 门），手动落地 T2 全量解锁；Constraints 记「T2 已 hotfix 落地」行（wave 不变 W1={1,3,4} · W2={2,5} · W3={6}；T2 代码已随 hotfix 落地，W2 实现面实际仅 T5）| Oscar M. · Claude Opus 5（kairos:cdd-dev [P11] in-flight backfill · 2026-10-19） |
| v0.4 | 2026-10-19 | W1 review（CHANGES_REQUESTED · blocker 1）裁定回填——(a) **F3 修复**：T3 `Produces` 行 v0.3 漏改，仍写「显式 `ensure()` 调用点仅 `CliGate#renderBrief` 一处」，与 Objective/Files/Steps/Acceptance 矛盾；已改为「`#runWork` 一处（真实运行首个写点，覆盖所有面）」。(b) **F2 裁定**：红窗口句澄清——`returnFormats` pin（`render.test.ts:48`）归 T1，两行 fence pin（`render.test.ts:66`，§2.4 在册）归 **T6**，红窗口延续至 T6（原文「随 T1/T2 同批迁移收口」有歧义）。F1（ensure 扩面未落码）为纯码修复，由 fix 回合落实，无需 plan 变更；F4/F5 为 nit，由 fix 回合落实 | Oscar M. · Claude Opus 5（kairos:cdd-dev [P11] W1 review-ruling 回填 · 2026-10-19） |
| v0.5 | 2026-10-19 | W2 review（REVIEW_FIX）note 回填——T6 scope 显式纳入 `cli.test.ts` 的 25 处 dry-run-E2E 用例（W2 边界红：旧 book-轮 断言随 T5 退场，改 preview 块断言），否则「全量测试面绿收口于 T6」不成立；T6 Objective/Files/Steps/Acceptance 同步 | Oscar M. · Claude Opus 5（kairos:cdd-dev [P11] W2 review-note 回填 · 2026-10-19） |
| v0.6 | 2026-10-19 | closeout（cdd-close）——P11 全链闭合登记：三波实现链全绿（W1={1,3,4} A 组模板翻面 + C 组 ensure/migrate 退休 + `RoundNaming` 单源 · W2={2,5} 引擎侧删除/`stdoutTail` + `--dry-run` 真只读预览 · W3={6} 测试面迁移 + 文档面 + 变更集；T2 热修 `6ac29ac` 前置）· 分支终审 → 分支 fix 闭环（branch-fix-1 `5c9048e2`）· 验收全项交付（`pnpm run validate` exit 0 · cdd-engine 738/738 · kairos 83/83 · 零裸函数零命中 · changeset cdd-engine major pending · 不发布）· 父 overall → v2.54（P11 行 Done） | Oscar M. · Claude Opus 5（kairos:cdd-close · closeout-backfill · 2026-10-19） |
