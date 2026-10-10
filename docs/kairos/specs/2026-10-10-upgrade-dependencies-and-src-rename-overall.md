# 依赖升级与 src 更名（Dependency Upgrade & Src Rename）— Overall Spec
- **Version**: v1.1 · 2026-10-10
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（kairos:cdd-design → grilling 定稿 → cdd-spec-writer）
- **Constraints**:
  - **node 版本线锁 24（2026-10-10 用户拍板 Q5→b）**：`engines: node >=22.18.0 → >=24` · `.nvmrc` v24 与 CI setup 默认 24（`.github/actions/setup/action.yml`）保持不动 · `@types/node ^26.6.4 → ^24`（根 + cdd-engine 两处声明）——「类型 = 运行时」一致性是本程序的版本策略内核；类型声明 26 而运行测 24 是类型撒谎
  - **历史面全量改写授权（2026-10-10 用户拍板 Q3→b · 覆盖 doc-architecture-v2 v1.64 closeout 的 CHANGELOG 史实豁免先例与本类程序默认「历史正文不 retro-rename」）**：`src-next` 字面量全库改写——live 面 + 历史面（docs/kairos specs+plans · `.changeset` 正文 · CLAUDE.md · README ×2 · maintainers ×5）一并更新；本程序为界，未改写的仅两份 CHANGELOG.md（零 `src-next` 命中 → 自然无操作面）
  - **changesets 托收整理（2026-10-10 用户拍板 Q4）**：17 个现存 pending 条目随本程序主题归并至可发布态，归并规则参照 b29e8514「40 → 19」先例——breaking/minor 单条保留 · patch 主题合并 · EOF 全绿；发布目标就位（kairos 1.0.0 · cdd-engine 2.0.0）但**不发布**（发布 = 独立动作）
  - **simple-git 4.x 兼容性已核（2026-10-10 事实取证 · drop-in）**：`simpleGit({baseDir})` / `revparse` / `status().isClean()` / `raw(["add","-A"])` / `log({maxCount})` / `.commit()` 全兼容 · 4.0.x 无 `engines` 声明 · 前瞻注记（缩写 long-form option 拦截 · git env 变量过滤）只入 maintainers 05，不引入新能力
  - **P4 引擎 review-face overall 键收进（2026-10-10 用户拍板：overall 的价值本就是多 phase 推进，这个问题也可以记 phase）**：consumer 整体契约门禁缺口（`review --type spec` 硬编码 phaseSpec · 消费者侧引擎无任何入口判 overall）收进本程序为独立 phase P4；「不做引擎行为变更」约束范围 = P1/P2/P3 面（依赖升级不引入 4.x 新能力 · 改名纯机械 · changesets 纯归类），引擎 CLI 行为变更由 P4 独立承接
  - 变更先回填本 overall（backfill-as-version），再继续实现
  - 语言纪律保持（Strategy B 内部 docs 中文 · 消费面 skill 文本英文主源）

## Document scope

Charter only, zero implementation detail. **Overall approval is not equivalent to any phase started（GATE）**——四个 phase 按注册序串行执行；P1 ‖ P2 无硬依赖（同 touch `packages/cdd-engine/package.json`，P2 机械改写路径字段、P1 只动依赖/engines/types 行，两 diff 按执行序自然消解），P4 硬依赖 P2（引擎改动落在改名后的树），P3 硬依赖 P1 ∧ P2 ∧ P4（归并入册须含各 phase 最终 bump 描述）；变更先回填本 overall，再继续实现。

## File paths

| Artifact | Path |
|---|---|
| Overall | `specs/2026-10-10-upgrade-dependencies-and-src-rename-overall.md` |
| Phase spec | `specs/2026-10-10-upgrade-dependencies-and-src-rename-p<N>-design.md` |
| Phase plan | `plans/2026-10-10-upgrade-dependencies-and-src-rename-p<N>.md` |

## Program charter

### Goal

把四个执行面 + 一个整理面一次收口：**① 依赖全量对齐**——`pnpm outdated` 现存唯一 stale（`simple-git ^3.36.0 → ^4.0.2`，cdd-engine 唯一运行时依赖，drop-in 已核零适配）+ lockfile 全量刷新至 registry 对齐 + maintainers 05 §1 同步（含 4.x 前瞻注记）；**② 版本策略一致性**——node 测试线锁 24（engines `>=24` · `.nvmrc`/CI 保持 · `@types/node` 降 `^24` 对齐运行时）；**③ src-next 正式化 src**——`packages/cdd-engine/src-next/` 61 文件五面 OOP 树改名 `src/`，全库引用面（package.json · tsconfig ×2 · vitest.config · scripts · 引擎头注释 · 测试 fixture · CLAUDE.md · README ×2 · maintainers ×5）+ **历史面全改（Q3→b）**，把 P3.2 cutover 后已提交 changeset 正文里承诺的 `src/` 叙事实体化为物理路径（现值错位：叙事已在 `src/`，树还在 `src-next/`）；**④ changesets 主题归并**——17 条目按「breaking/minor 单条 · patch 主题合并」归并至可发布态，本程序贡献并入，kairos 1.0.0 · cdd-engine 2.0.0 就位不发布；**⑤ 消费者整体契约门禁**——引擎 review face 补 overall 键（`cli.ts` docKey 推导对齐 validate 的 `*-overall.md → overall`），`cdd review --type spec --spec <overall>` 从此对 charter 跑整体契约，消费者侧首次可对 overall 加压，kairos cdd-spec-writer 的 overall 变体评审轮从此可满足。

### Non-goals
- **不发布**：整理到可发布态即止——`changeset version` / 打 tag / 发布 = 独立动作，不在本程序
- **引擎行为变更面收窄到 P4 单一归属**：P1（依赖升级）不引入 simple-git 4.x 新能力（缩写 option 放行 / `allowEnvironment` 透传）——前瞻注记仅作文档记录；P2（改名）纯机械重命名；P3（changesets）纯归类——引擎 CLI 行为变更 = 本程序 P4 独立承接（review face overall 键），任何其他 phase 不得混入引擎行为改动
- **不改 doc 方法论语义**：改名纯机械重命名，五面树 OOP 形态、schema、契约零语义变更——行为等价由引擎 vitest 0 改动全绿证明（改名收口前引擎测试文件已随改名迁移，断言面不变）
- **不 retro-rename 其他历史字面量**：本程序改写面 = `src-next` 字面量一项；其他历史正文（方法论文档内容、非路径叙事）不受 touch
- **不新增依赖**：依赖升级 = 存量条目对齐，不是新增第三方包

### Cross-cutting（程序级横切约束，先立后执行）
- **改名保真铁律**：src-next → src 纯路径重命名——除「路径字面量引用面」（头注释 · fixture · 配置 include/rootDir · scripts 常量）外，任何内容字节零变更；改名 diff 可审计（`git show` 逐面核对）
- **零残留 pin**：P2 验收 = 全库 `grep -rn src-next` 零命中；豁免面清单为空（Q3→b 全改裁决下 CHANGELOG 零命中无需豁免）——与 P7 closeout 的「live 面零残留 grep pin」同型
- **dev face 等价**：改名后 `node packages/cdd-engine/src/bin.ts <subcommand>` 直调与改名前 `src-next/bin.ts` 行为等价（引擎 vitest 0 语义改动 + smoke 面）
- **行为等价证明优先**：任何改名任务先跑通改名前的基线（validate + vitest + typecheck），改名后重跑对照——diff 只应是路径字面量
- **机械移序**：先树、后引用面、再文案叙事（叙事含史实句改写，如 vitest.config「old src died」→「src 正式化」）

### 设计决策留存（brainstorm grilling 定案 2026-10-10 —— 全量记录，不遗漏细节）

| # | 决策 | 定案 | 落点 |
|---|---|---|---|
| D1 | 程序形态（Q1） | **overall 3-phase**（new-program · multi → charter）：P1 依赖+版本策略 · P2 全库改名 · P3 changesets 归并 | 本表 + Phase inventory |
| D2 | 依赖升级语义（Q2） | **(c) 版本策略一起动**：不仅升 stale，还把 node 线 / types / engines 一致性一次定版 | P1 scope |
| D3 | node 版本线（Q5） | **(b) 锁 24**：engines ≥24 · `.nvmrc`/CI 保持 24 · `@types/node ^26 → ^24` | P1 scope + Constraints |
| D4 | 历史面处置（Q3） | **(b) 全量改**：docs/kairos specs+plans · `.changeset` 正文等历史文档一并改写，覆盖史实豁免先例 | P2 scope + Constraints |
| D5 | changesets 归并规则（Q6） | **(a) 主题归并**：breaking/minor 单条 · patch 主题合并 · EOF 全绿，目标 ≈8–10 条（含本程序贡献并入） | P3 scope |
| D6 | 发布边界（Q4 附带） | 整理到**可发布态不发布**：kairos 1.0.0 · cdd-engine 2.0.0 就位；发布 = 独立动作 | P3 scope + Non-goal |
| D7 | simple-git 兼容事实（子代理取证 · 2026-10-10） | **drop-in 零适配**：five ops 全兼容 · 无 engines 声明 · 前瞻注记归文档 | P1 scope |
| D8 | 引擎缺口处置（2026-10-10 用户拍板） | **登记为 phase P4 收进本程序**——consumer overall 门禁缺口（review face 硬编码 phaseSpec · 消费者引擎无入口判 overall）作为独立执行 phase，非候补 issue；引擎行为变更单一归属 P4（P1/P2/P3 不混入） | 本表 + P4 行 |

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | none | 依赖升级 + 版本策略一致性：simple-git 3→4（drop-in 已核）+ lockfile 全量对齐 + node 线锁 24（engines/`.nvmrc`/CI/types 四面一致）+ maintainers 05 §1 同步（4.x 前瞻注记） |
| P2 | none | src-next → src 全库改名：61 文件树 + 全引用面（package.json/tsconfig ×2/vitest.config/scripts/头注释/fixture/CLAUDE.md/README ×2/maintainers ×5）+ 历史面全改（docs/kairos specs+plans · `.changeset` 正文）· CHANGELOG 零命中自然无操作 |
| P3 | none | changesets 主题归并 + 发布预备：17 现存条目按 breaking/minor 单条 + patch 主题合并归并至 ≈8–10 条 · 本程序贡献并入（含 P4 引擎改动 bump）· kairos 1.0.0/cdd-engine 2.0.0 就位不发布 |
| P4 | none | 引擎 review face overall 键：consumer 整体契约门禁——`cli.ts` 硬编码 phaseSpec 的 docKey 推导对齐 validate（`*-overall.md → overall`），`cdd review/fix --type spec --spec <overall>` 判整体契约 · cdd-spec-writer overall 变体评审轮可满足 · 引擎 vitest pin |

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | 依赖升级 + 版本策略一致性 | `simple-git ^3.36.0 → ^4.0.2`（drop-in 已核 · 零适配）· lockfile 全量对齐（`pnpm outdated` 零 stale）· node 线锁 24（engines `>=24` · `.nvmrc` v24 保持 · CI setup 默认 24 保持 · `@types/node ^26.6.4 → ^24` 根 + cdd-engine 两处）· maintainers 05 §1 同步（simple-git 4.x 前瞻注记：缩写 long-form option 拦截 · git env 变量过滤）· 该 phase 由本 overall 注册 · 设计经 cdd-design 生成 | [Pending] | [Pending] | `pnpm outdated` 零 stale · `tsc --noEmit` 三项目全绿 · 引擎 vitest 全绿 · `pnpm run validate` ALL PASS（emit 新鲜 / channel audit / residue 零回归）· `pnpm run precommit` 过 · maintainers 05 §1 文档同步落（simple-git 4.x 行 + 前瞻注记） | 无（program 起点） |
| P2 | src-next → src 全库改名 | 树改名（`packages/cdd-engine/src-next/` → `src/` · 61 文件）· 引用面全改（package.json files/main/exports/bin · tsconfig.json include / tsconfig.build.json rootDir+include+exclude · vitest.config include + 注释叙事「old src died → src 正式化」· scripts guard `SOURCE_FACES`/`WORDS_PATHS`/imports · validate suite 名 · smoke `binPath` · scan 注释 · 三个 scripts 测试 import）· 引擎头注释 ~15 文件路径字面量 · 测试 fixture（contract/__tests__/doc.test.ts · __tests__/zero-dep.test.ts · __tests__/bin.test.ts）· 文案全面（CLAUDE.md dev invocation · README ×2 · maintainers ×5 叙事史实句改写）· **历史面全改（Q3→b）**：docs/kairos specs+plans（~90 处）· `.changeset` 正文；CHANGELOG 零命中自然无操作 · 该 phase 由本 overall 注册 · 设计经 cdd-design 生成 | [Pending] | [Pending] | 全库 `grep -rn src-next` 零命中（豁免面清单为空）· `node packages/cdd-engine/src/bin.ts <subcommand>` dev face 直调等价 · 引擎 vitest 全绿（0 语义改动）· `pnpm run validate` ALL PASS · typecheck ×3 · biome clean · 改名保真审计（diff = 路径字面量 only）· emit 产品零牵连（已核 `.claude-plugin`/`.cursor-plugin`/`marketplace`/`.github` 零 src-next） | 无（与 P1 并行） |
| P3 | changesets 整理 + 发布预备 | 17 现存 pending 条目主题归并（breaking/minor 单条 · patch 主题合并 · 目标 ≈8–10 条）· 本程序贡献并入（P1 simple-git bump / node 线策略 · P2 rename · P4 review-face overall 键 → cdd-engine bump 语境）· EOF 全绿 · 发布目标就位（kairos 1.0.0 · cdd-engine 2.0.0）· **不发布** · 该 phase 由本 overall 注册 · 设计经 cdd-design 生成 | [Pending] | [Pending] | `pnpm exec changeset status` 无 empty 条目 · 归并清单对照（40→19 先例同型：保留单条 breaking/minor 可读性）· EOF 全绿 · `pnpm run validate` ALL PASS | P1 ->(hard) · P2 ->(hard) · P4 ->(hard) |
| P4 | 引擎 review face overall 键 | 引擎 CLI：`face/cli.ts` 的 doc-contract docKey 推导从硬编码 `phaseSpec` 放开为与 validate 同源的推导（`*-overall.md → overall` · 其他 → phaseSpec）· consumer 首次可对整体契约跑 `cdd review --type spec --spec <overall>`（零 phase-spec 误报）· kairos cdd-spec-writer 的 overall 变体评审字面可满足（无需 skill 例外）· 引擎 vitest colocated pin（overall 经 review face 判压零 finding）+ validate/guard 零回归 · 该 phase 由本 overall 注册 · 设计经 cdd-design 生成 | [Pending] | [Pending] | `cdd review --type spec --spec <任一 overall>` 对整体契约判压（零 phase-spec 误报 · 硬编码 phaseSpec 残留零）· 引擎 vitest 全绿（colocated pin：overall 评审轮 doc-contract 绿）· `pnpm run validate` ALL PASS（doc-contract 14 specs/plans 保持）· `pnpm run precommit` 过 · changesets（cdd-engine）经 P3 归并落位 | P2 ->(hard) |

## Dependency graph (ASCII)

```
P1 -> P3   (hard: P3 归并入册的 bump 描述含 P1 的 simple-git / node 线贡献，须 P1 定案)
P2 -> P3   (hard: P3 的 cdd-engine 改名 bump 语境 = P2 改名后形态，须 P2 落树)
P2 -> P4   (hard: P4 引擎改动落在改名后的树——P2 改名保真审计保持纯路径字面量)
P4 -> P3   (hard: P3 的 changeset 归并须含 P4 引擎变更 bump 描述，须 P4 定案)
P1 ‖ P2    (并行：无硬依赖——同 touch package.json，diff 面不同自然消解；执行仍串行)
```

Legend:
- `->` = hard block（依赖前置 phase 完成后启动）
- `‖` = 无硬依赖（并行候选；执行串行、一 phase 一 closeout）

执行序：P1 → P2（按注册序串行）→（P1 ∧ P2 均 Done 且依赖满足）→ P4 →（P3 依赖 P1 ∧ P2 ∧ P4 均满足）→ P3 → 程序收敛。

## Boundary rules

- 每 phase 完整 brainstorm → plan → dev 闭环；serial-phase 硬门：注册 phase 的 hard-dependency 前驱 Design spec ≠ Done → BLOCKED
- 需求变更在 phase 中发生时，**先回填本 overall**（version bump + change-history 行 + 同步受影响 phase 的 scope/acceptance/dependency），再继续实现
- **改名保真铁律**（P2）：src-next → src 纯路径重命名—除路径字面量引用面外内容字节零变更；违反 = 改名 diff 不可审计，视为 defect
- **历史改写例外登记（2026-10-10 · 用户 Q3→b 拍板）**：本程序对 `src-next` 字面量的历史面改写，覆盖 doc-architecture-v2「历史正文不 retro-rename」约束与 P7 CHANGELOG 史实豁免先例——例外面严格限定为 `src-next` 字面量；其他历史内容按原约束不动
- **P2 零残留 pin**：全库 `grep -rn src-next` 零命中；豁免面清单为空（CHANGELOG 零命中自然无需豁免）——P2 未过 pin 前 P4/P3 不启动
- **引擎行为变更单一归属**：本程序引擎 CLI 行为变更仅存在于 P4（review face overall 键）；P1（依赖）/P2（改名）/P3（changesets）任何面不得混入引擎行为改动——违反 = 验收污染，视为 defect

## Maintenance

- 五表随每 phase 回填：Issue inventory（新增 anchor 注册）、Phase inventory（design/plan 列状态 + dep 边）、Dependency graph（节点变化同步）、Change history（版本行逐 phase 追加）、File paths（新 artifact 行登记）
- Charter only——无任务清单；phase 细节归 phase spec；策略转向立即回填本 overall 后再议实现
- 本程序为机械改名 + 版本整理面；实施期发现更深债（例如运行时的环境变量依赖、consumer 侧 node 线兼容问题）同样回填追加

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.0 | 2026-10-10 | 程序 charter：依赖升级与 src 更名——P1 依赖+版本策略（simple-git 3→4 drop-in · node 线锁 24 · types 对齐）· P2 src-next→src 全库改名（含历史面全改 Q3→b · zero-residue pin）· P3 changesets 主题归并至可发布态（kairos 1.0.0 · cdd-engine 2.0.0 就位不发布）· 决策留存 D1–D7 · Issue/Phase inventory ×3 + 依赖图 | [human] · Claude Opus 5 (1M context)（kairos:cdd-design 元层 grilling） |
| v1.1 | 2026-10-10 | **P4 注册 + 范围澄清 backfill**（overall 评审轮拦截 · 用户 2026-10-10 拍板「overall 的价值本就是多 phase 推进，这个问题也可以记 phase」）：新增 Issue/Phase inventory P4「引擎 review face overall 键」——consumer 整体契约门禁（cli.ts:1256 硬编码 phaseSpec → docKey 推导对齐 validate `*-overall.md → overall`）· 依赖图补 P2→P4 / P4→P3 · Non-goal「不做引擎行为变更」收窄为 P1/P2/P3 面约束（引擎行为变更单一归属 P4）· Boundary 补引擎变更单一归属 + P2 pin 前 P4/P3 不启动 · 决策留存 D8 · 执行序 P1→P2→P4→P3 | [human] · Claude Opus 5（kairos:cdd-design → cdd-spec-writer 评审轮拦截 · 用户裁定 P4 注册） |