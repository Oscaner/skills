---
title: 引擎文档工具（Engine Doc-Tooling）— P28 计划：再生层入仓 + spec 易变事实纪律
doc-type: plan
version: v0.1
date: 2026-11-06
slug: 2026-10-10-engine-doc-tooling-p28
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p28-design.md` **现行 `version`**（v0.4）所指的面；spec 版本一变，本约束的字面同笔改。
- **不设门**：不为三类散文新增 doc-contract 规则或机检；牙只在 `axesGuide` 与写作指令上。
- **`finalize` 面零改动**：人工全门路径的命令、旗标与 receipt 语义不动，只改文档口径；`emit` 走 `render`。
- **孪生门只加消息**：三腿判据（引用多重集 · 文案孪生 · 产物身份）逐条不改；语义门整体不动，且其消息**不得**含 `regenerate: pnpm run emit`。
- **plan 变体逐字不动**：本相位只改 `render/templates.ts#docNarrativeAxes`（spec 变体）；`REVIEWS.plan.axesGuide` 与改前逐字相同。
- **不改既有字节语义**：`emit:check` 的对比与 stale 机制只扩产物集；`BASE_PRODUCT_ROOTS` / `PRODUCT_FILES` 既有项不动；`docs/diagrams/` **不**进 `BASE_PRODUCT_ROOTS`（`index.html` 是手写页）。
- 无新命令、无新旗标、无新环境变量：再生入口仍是 `pnpm run emit` / `pnpm run emit:check`。
- 零模块级裸函数：`DiagramProducts` 写成类，渲染器经构造器注入；静态面带 biome-ignore 与一行理由。
- `skill-anatomy` 零新增 heading：写作指令进既有节点正文。
- 波宽 ≤ 3：本计划 `DependsOn` 分层为 W1={1,3} · W2={2}，每层 ≤ 3。
- **changeset**：`@oscaner-skills/cdd-engine` **minor** + `@oscaner-skills/kairos` **minor**。
- **Archify 钉法**：根 `devDependencies` 钉 `github:tt-a1i/archify#208acba8d412335185b2056fedf54b3405df43fb&path:/archify`（`v3.2.0` 的 peeled commit · 非分支 · 非 semver 范围）。

## Review Focus

- **半套产物**：任一源渲染失败时若仍写盘，`emit:check` 的红会失去定位——全有或全无是硬约束。
- **`index.html` 误入产物集**：若被当成生成物，孤儿走查或 stale 会逼着删掉手写语言切换页。
- **语义门误挂修法**：语义门红意味着源本身错了，附 `regenerate:` 会把人带去重生成错误。
- **plan 变体被顺手改**：`Claimed→pin` 段在 `docNarrativeAxes` 与 plan 变体各有一份字面；改错面会破「plan 变体零变化」。
- **`skill-anatomy` heading**：写作指令若新增 `###` 标题，kairos 套件当场红。
- **缺依赖静默跳过**：bin 不存在时若跳过图档，产物会停在上一版且 `emit:check` 仍可能绿。

### Task 1: 再生层 — 依赖 + `DiagramProducts` + `emit` 一档

#### Objective

把 Archify 钉进根 `devDependencies`；新建 `scripts/lib/diagrams.ts#DiagramProducts`（清单从源派生 · 渲染器可注入 · 全有或全无落盘 · 孤儿走查）；把它挂进 `scripts/emit.ts#EmitService.emitAll` 与 stale 面；两条 colocated pin 钉住派生集与 `index.html` 排除。

#### Files

- Modify: 根 `package.json` · `pnpm-lock.yaml`（加 Archify `github:#path:` 钉）
- Create: `scripts/lib/diagrams.ts`（`DiagramProducts`）
- Modify: `scripts/emit.ts`（`EmitService.emitAll` 调图档 · `findStaleCommittedFiles` / `EmitComparer` 接孤儿腿）
- Test: `scripts/__tests__/diagrams.test.ts`（新建）· 既有 `scripts/__tests__/emit.test.ts` 仍绿

#### Consumes

- `scripts/emit.ts#EmitService.writeText` · `EmitService.emitAll` · `EmitService.findStaleCommittedFiles` · `EmitComparer.compareTrees`
- 六份源各自的 `diagram_type` / `meta.output` / `meta.quality_profile`（`docs/diagrams/src/*.json`）

#### Produces

- `DiagramProducts` 类，构造器注入 `render?: (args: { type: string; srcAbs: string; outAbs: string; quality: string; repoRoot: string }) => void`（默认实现：`spawnSync(process.execPath, [bin, "render", type, srcAbs, outAbs, "--quality", quality, "--repo-root", repoRoot], { encoding: "utf8" })`；`status !== 0` 抛错并点名 src；bin = `join(repoRoot, "node_modules/archify/bin/archify.mjs")`，不存在则抛「Archify missing — run pnpm install」类错误，**不**跳过）。
- `list(): readonly DiagramProduct[]` — 扫 `docs/diagrams/src/*.json`，每项 `{ type, srcRel, outRel, quality }`，零映射表。
- `emit(outRoot, generatedPaths): void` — 先渲染到系统临时目录，全部成功后用 `EmitService.writeText`（或等价）写入 `outRoot` 下对应的 `outRel` 并 `generatedPaths.push(outRel)`；任一失败 → 零写盘。
- `orphanHtml(root, generatedOutRels): string[]` — `docs/diagrams/*.html` 减去 `docs/diagrams/index.html` 减去 `generatedOutRels`。
- `emitAll` 末尾调用 `DiagramProducts.emit`；stale/孤儿并入 `emit:check` 失败通道。

#### Steps

- [ ] **Step 1: 写红 pin（派生集 + `index.html` 排除 + 全有或全无）** — checkable: `scripts/__tests__/diagrams.test.ts` 用桩渲染器断言：`list()` 的 `outRel` 多重集恰为六条 `meta.output`；`list()` 的路径集合不含 `docs/diagrams/index.html`；桩对第五份抛错时 `emit` 后 `outRoot` 内零图 HTML、`generatedPaths` 不增图路径；今日无 `DiagramProducts` ⇒ 红
- [ ] **Step 2: 实现 `DiagramProducts`** — checkable: Step 1 的三条转绿；默认渲染器走 `process.execPath` + `node_modules/archify/bin/archify.mjs`（源码 pin：调用面不经 PATH / shell 垫片）
- [ ] **Step 3: 钉根依赖并安装** — checkable: 根 `package.json#devDependencies` 含 `github:tt-a1i/archify#208acba8d412335185b2056fedf54b3405df43fb&path:/archify`；`pnpm install` 后 `node_modules/archify/bin/archify.mjs` 存在；`pnpm-lock.yaml` 记同一 sha
- [ ] **Step 4: 接入 `emitAll` + 孤儿腿** — checkable: `EmitService.emitAll` 末尾调用图档；`findStaleCommittedFiles`（或 `EmitComparer.compareTrees`）在 `generatedSet` 之外对 `docs/diagrams/*.html` 跑孤儿走查（豁免 `index.html`）；手改一份产物一行后 `pnpm run emit:check` 红并点名该文件；删一份源（测试用临时改名/夹具）后孤儿腿红
- [ ] **Step 5: 真渲染回归** — checkable: `pnpm run emit` 后 `git status --porcelain docs/diagrams` 空；`pnpm run emit:check` exit 0；`pnpm exec vitest run scripts/__tests__/diagrams.test.ts scripts/__tests__/emit.test.ts` 全绿
- [ ] **Step 6: 提交** — checkable: commit `feat(scripts): emit owns diagram regeneration via Archify render`

#### Acceptance

- 派生集 pin 与 `index.html` 排除 pin 各可反向红。
- 全有或全无：失败路径零写盘（行为 pin）。
- 根依赖钉到 `208acba8…`；bin 由 `process.execPath` 直起。
- `pnpm run emit` / `emit:check` 对 `docs/diagrams/` 干净；`BASE_PRODUCT_ROOTS` / `PRODUCT_FILES` 既有项字节不动。

#### DependsOn
none

### Task 2: 孪生门修法提示 + 文档口径

#### Objective

孪生门 mismatch 消息统一附 `— regenerate: pnpm run emit`；语义门消息对照 pin 不含该提示；`docs/diagrams/README.md` 与 `AGENTS.md` 的日常再生改指 `pnpm run emit`，人工 `finalize` 保留为全门路径说明；人填 Archify 占位参数零残留。

#### Files

- Modify: `packages/cdd-engine/src-next/face/__tests__/diagram-twin.guard.test.ts`（`DiagramTwin` 的 mismatch 消息）
- Modify: `packages/cdd-engine/src-next/face/__tests__/diagrams.guard.test.ts`（对照 pin：消息不含 regenerate 提示）
- Modify: `docs/diagrams/README.md` · `AGENTS.md`
- Create: `.changeset/p28-diagram-hint.md`（`cdd-engine` minor — 门消息可见变化；若 Task 3 已写综合 changeset，则本文件只补门消息说明或并入同一文件，禁止两个互相矛盾的叙述）

#### Consumes

- Task 1 交付的 `pnpm run emit` 再生入口（本任务文案引用它）
- `face/__tests__/diagram-twin.guard.test.ts#DiagramTwin` 的 `revisionMismatches` / `referenceMismatches` / `copyMismatches`

#### Produces

- 孪生门每条非空 mismatch 字符串以 `— regenerate: pnpm run emit` 收尾（三腿同源后缀）。
- 语义门既有失败消息集合零命中该后缀（对照 pin）。
- README 两条路径：日常 = `pnpm run emit`；人工全门 = `pnpm exec archify finalize` 加 type/src/out 与 `--repo-root . --quality showcase --out-dir` 指向临时目录加 `--json`（点名需要宿主 Chrome · receipt 走 `--out-dir`）。
- `AGENTS.md` 再生句改指 `pnpm run emit`（不再指「用 README 里的 Archify 命令」作为日常路径）。

#### Steps

- [ ] **Step 1: 写红 pin（修法后缀 + 语义门对照）** — checkable: 孪生门既有反向注入用例断言至少一条 mismatch 含 `regenerate: pnpm run emit`；语义门套件断言其失败消息（或稳定子串样本）**不含**该提示；今日无后缀 ⇒ 孪生门红
- [ ] **Step 2: 给 `DiagramTwin` 三腿加后缀** — checkable: Step 1 孪生门 pin 转绿；三腿判据用例（引用 / 文案 / revision）行为仍红在同一处，只是消息多了后缀
- [ ] **Step 3: 语义门对照 pin** — checkable: Step 1 对照断言绿；语义门既有用例零重锚仍绿
- [ ] **Step 4: 改 README + AGENTS.md** — checkable: `docs/diagrams/README.md` 与 `AGENTS.md` 均含 `pnpm run emit` 作为日常再生；人填 Archify 路径占位（形如 `node <…>/archify.mjs` 的占位参数）零残留；人工 `finalize` 命令可复制
- [ ] **Step 5: changeset** — checkable: `.changeset/` 下有 `cdd-engine` **minor** 条目覆盖门消息（可与 Task 3 合并为单文件，但 package 级必须点名）
- [ ] **Step 6: 提交** — checkable: commit `docs(diagrams): twin gate names emit as the repair path`

#### Acceptance

- 孪生门 mismatch 含 `regenerate: pnpm run emit`（字符串 pin）；语义门不含（对照 pin）。
- README / `AGENTS.md` 日常再生指向 `pnpm run emit`；人填占位零残留；人工 `finalize` 可复制。
- 孪生门三腿判据语义零变化（既有反向注入仍红在同一腿）。

#### DependsOn
1

### Task 3: 易变事实面 — `axesGuide` + 写作 skill

#### Objective

改 `render/templates.ts#docNarrativeAxes` 的 `Claimed→pin` 段为三形态定稿句；`templates.test.ts` 保留三 token 并加三条子串；`cdd-spec-writer` author 节点加三条并列短句，`cdd-plan` 加「引用留在 plan」一行；plan 变体逐字不动。

#### Files

- Modify: `packages/cdd-engine/src-next/render/templates.ts`（仅 `docNarrativeAxes`）
- Modify: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`
- Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（`author-spec` 节点正文）
- Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（`author-plan` 节点正文）
- Create: `.changeset/p28-volatile-facts.md`（`cdd-engine` minor + `kairos` minor）

#### Consumes

- `render/templates.ts#docNarrativeAxes` 现行 `Claimed→pin` 段
- `render/__tests__/templates.test.ts` 对 `typecheck` / `test command` / `Claimed→pin` 与 `REVIEWS.overall` 禁词的既有断言
- 父 overall P28 AC（v3.35）：`cdd-spec-writer` 三条形态 · `cdd-plan` 一行

#### Produces

- `docNarrativeAxes` 内定稿句（必须逐字含以下子串）：`module path + symbol name` · `pinned by the named guard` · `belongs to the plan`；且仍含 `Claimed→pin` / `typecheck` / `test command`。
- plan 变体 `REVIEWS.plan.axesGuide` 与改前逐字相同。
- `cdd-spec-writer` 的 `author-spec` 正文含三条形态短句（判据 / 计数 / 叙述），**不**新增 heading。
- `cdd-plan` 的 `author-plan` 正文含「引用留在 plan，别搬进 spec」一行，**不**新增 heading。

#### Steps

- [ ] **Step 1: 写红 pin（三条子串 + plan 变体对照）** — checkable: `templates.test.ts` 断言 `REVIEWS.spec.axesGuide`（或 `docNarrativeAxes` 的导出面）含 `module path + symbol name` · `pinned by the named guard` · `belongs to the plan`；另存 plan 变体改前快照字符串，断言改后仍相等；今日无三子串 ⇒ 红
- [ ] **Step 2: 改 `docNarrativeAxes`** — checkable: 换用 spec §4.2 定稿句；Step 1 三子串转绿；既有 `typecheck` / `test command` / `Claimed→pin` 断言零重锚仍绿；`REVIEWS.overall.axesGuide` 仍零 `path:line`
- [ ] **Step 3: plan 变体对照** — checkable: Step 1 的 plan 逐字相等断言绿
- [ ] **Step 4: 写作 skill 正文** — checkable: `cdd-spec-writer/SKILL.md` 的 `author-spec` 节点含三条形态；`cdd-plan/SKILL.md` 的 `author-plan` 节点含「引用留在 plan」；`pnpm -C packages/kairos exec vitest run tests/skill-anatomy.test.ts` 绿（零新增 heading）
- [ ] **Step 5: changeset** — checkable: `.changeset/p28-volatile-facts.md` 声明 `cdd-engine` **minor** + `kairos` **minor**，叙述点名 axesGuide 三形态与两份 skill
- [ ] **Step 6: 提交** — checkable: commit `feat(cdd-engine): claim pins name symbols, not line numbers`

#### Acceptance

- 三 token 既有 pin 零重锚；三条子串各一条；`REVIEWS.overall` 禁词 pin 不破。
- plan 变体逐字相等（对照 pin）。
- 两份 skill 口径与父 overall P28 AC（v3.35）一致；`skill-anatomy` 绿。
- changeset 两包 minor 在册。

#### DependsOn
none

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-06 | 初版：三任务按 spec §6 切分 — T1 再生层（根依赖 + `DiagramProducts` + emit/孤儿 + 两条 pin）· T2 孪生门修法 + README/AGENTS（DependsOn 1）· T3 易变事实（`docNarrativeAxes` + 三子串 + 两 skill）；波次 W1={1,3} / W2={2}；全有或全无与 plan 变体零变化写入 Constraints / Review Focus | [human] 裁定 · Claude（kairos:cdd-plan · 本会话） |
