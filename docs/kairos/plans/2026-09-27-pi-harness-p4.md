# Pi Harness P4 实施计划（Pi Harness P4 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p4-design.md](docs/kairos/specs/2026-09-27-pi-harness-p4-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.22](docs/kairos/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.5 · 2026-10-01（契约收敛定稿：T7/T8 合并同组 `7,8`「harness 契约面成型」——T8 布局（config/ 家 + harness-contract 命名 + resolveResource）与 T7 收敛（detect/install/refs + prefix 派生 + lexicon 纯词表 + checkHarness）同文件集一原子，布局步骤先行；v1.3（T7 pi prefix 值）与 v1.4（T8 布局）的历史表述被其并入）
- **Depends on**: P4 design v1.4 Approved（`0f279ded` · `4db6049c`，C1–C6）
- **Base**: develop

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

## Constraints

### 口径

- **单身份（G1）**：每个 skill 的目录名 == `SKILL.md` front-matter `name:` == 三 harness invocation token——三者合一，任何一者偏移即 FAIL；新名集合恰 8 个：`cdd-design` / `cdd-spec` / `cdd-charter` / `cdd-phase` / `cdd-plan` / `cdd-dev` / `cdd-close` / `cdd-report`；命名空间随命名退役改 `kairos`（`/kairos:cdd-*`，见 G4）
- **全改令（G2，user 2026-10-01 拍板）**：改名是全仓原子面——**所有测试（含文件名内嵌旧 skill 名者）、各种文件名、字面量（字符串 / 路径 glob / 标识符 / 声称字面量）一并改**，不允许只改 `name:` 字段留旧面；live 面（kairos src/tests + scripts live + README 家族 + CLAUDE.md + docs/maintainers + engine src）零旧名/旧目录；**历史正文不 retro-rename**（docs/osuperpowers/specs|plans 既有行、CHANGELOG、既有 changeset = 史实）
- **命名退役 token 同扫（G4，user 2026-10-01）**：`osuperpowers` → `kairos`——插件包 npm 名/namespace `/kairos:`/marketplace/安装命令/release 流/lockfile/engine schema 描述字符串/scripts 标识符（`osuperpowersPkg/Row/Steps/Versions/Osc/Src/Entry/Bump`）+ validate step 名（ci-validate name-set 同步）+ **三目录 `git mv`**（`packages/osuperpowers/`→`packages/kairos/` · `docs/osuperpowers/`→`docs/kairos/` · `.osuperpowers`→`.kairos`（`engine-config.json#handoffNamespace.workspaceRoot` 单源 + 根 .gitignore + biome includes））——**零存量迁移**（user：不建兼容机制，实现当时 git mv 直迁；存量 `.osuperpowers/` 磁盘态 gitignored 惰性、零处理）；`cdd`/`cdd-engine`/CLI `cdd` 保留（方法论层）；live 面零 `osuperpowers`（历史正文除外）
- **上游 import 不动**：`/superpowers:*` / `/mattpocock-skills:*` 引用原样保留（它们不属于 kairos 身份面）；flow 内 `/osuperpowers:*` 互引随命名退役 + 新名（→ `/kairos:cdd-*`）
- **markers 三方一致（C3）**：contract-lexicon `markers` ↔ `harness.ts` detect() 谓词 ↔ engine-config env 白名单（恰 4 键 `[AI_AGENT, CLAUDE_CODE_SESSION_ID, CURSOR_TRACE_ID, PATH]`）
- **零手写重复（C2/C3）**：名义映射表 = lexicon/registry 数据派生（guard 钉零漂移）；技能清单 = 目录 × name 双钉扫描（guard 钉零手写名单）；不建镜像注册面
- **分层不破（Non-goal #2）**：技能名 = kairos 包面；harness markers = engine 语义（归 lexicon）；engine 与 emit 注册表不合并
- **消费面纯度（iron rule）**：SKILL.md / 消费者侧文件零程序叙事、零改名 rationale 笔法——rationale 只落本程序 docs
- **D5 事实（已核实 2026-10-01）**：pi 对同名技能按确定性 first-wins（败者静默丢弃 + warning，从不拒绝）；**pi 无命名空间修饰语法**（仅 `/skill:<bare-name>`）——`cdd-*` 是 flat-namespace 下 bare-name 唯一性最佳实践，非「pi 不许同名」
- 引擎调用 `node packages/cdd-engine/dist/cli.mjs` 直调（`dev:stub` 后），不走 global cdd

### commit 边界机制

- 实现提交按任务/合并组粒度（conventional commits，无 attribution trailers）
- spec/plan 文档仅由 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改；implement agent 零文档修改权
- **T3 起 engine 数据面变更需 changeset**（contract-lexicon.json 随包发布）+ cdd-engine `dev:stub` 重跑；T6 统一建 changeset（kairos major + cdd-engine patch）
- 每任务闭合面测试绿 + `pnpm run precommit` 绿；`pnpm run validate` 为终验（T6）
- emit 产物 = 派生（永不手工编辑）；T1/T2 合并组的改名面改动后立即 `pnpm run emit`

### Flow Atomicity

- 单任务/合并组原子：闭合前该面测试 + 相关 validate 面全绿；目录×name 双钉 / 三方一致 / 声称字面量 pin 破 = 设计漂移信号，报告 orchestrator 判定而非带伤闭合
- 串行 dispatch：`--tasks 1,2` → 3 → `--tasks 4,5` → `--tasks 7,8` → 6（T6 = changeset + validate 终验收尾、实现任务全结束后才跑；T1/T2 与 T4/T5 与 T7/T8 各自同一原子单位——T7/T8 一原子内布局步骤先行（git mv + resolveResource）再契约收敛）
- **T1/T2 必须同组**：改名面改动立即使 emit 产物 stale——`.github/ISSUE_TEMPLATE/*.yml`（emit-checked）数据源 `templates/report/issue-body.json` 技能选项含旧名，issue-body.json 改名后不重生成即漂移，分开 dispatch 中间态 emit:check 全链红（`./skills/<dir>` 键说法不成立——claude/cursor plugin manifests 的 `skills` = 常数 glob `"./skills/"` 相对 contentRoot，改名不改其内容；改名分步提交时 checkAnatomy/树守卫同样红）；**v1.2 拓展**：改名面含包身份（`osuperpowers` → `kairos`，source.json name/contentRoot 随 emit）与 workspace 根（`.osuperpowers` → `.kairos`，engine-config 单源 + engine dev:stub 重写 + 锁文件重写）——全部折入同原子单位
- **T4/T5 必须同组**：README 铺设即破既有声称 pin（presentation-surface 的 pair 声称面），pin 延展必须与铺设同时闭合
- **T7/T8 必须同组（v1.5）**：契约文件（harness-contract / contract-lexicon / config/schema）**布局与内容同一文件集**——分开则同一批文件两次触改（先搬一次再改一次）+ 双轮 review/fix 翻倍、中间态 = 无意义的纯搬移里程碑；新 schema 落 T8 之家、T7 内容在最终家写作，一原子内天然消解顺序依赖（布局步骤先行）

### 顺序原则

- T1/T2（改名原子单位：目录 + name + 引用 + 测试文件名 + 字面量 + emit 重生成）→ T3（markers 数据 + checkMarkers guard）→ T4/T5（README 铺设 + pin 延展，名义表消耗 T3 markers 数据）→ T7/T8（harness 契约面成型：config/ 布局 + 契约收敛一原子，布局步骤先行）→ T6（changeset + validate 终验收尾）
- T1 必为首：全仓后续引用全用新名；T3 先于 T4：名义表渲染依赖 `markers` 数据就位；T4 先于 T5（同组内）：pin 断言 README 产物

### 仓库纪律

- node：`fnm use`（.nvmrc）；引擎调用 `node packages/cdd-engine/dist/cli.mjs` 直调；引擎 `.mjs` plane zero（新增测试用 `.test.ts`/`.test.mjs`）
- language policy：代码/测试 English-primary（本计划 internal docs，中文豁免 Strategy B）；无 attribution trailers
- D2/D4 事实沿用：`pi` 字段源侧手维护 · `AI_AGENT=pi` 宿主检测（本 phase 零 engine 运行面改动）


### Task 1: cdd-* 身份改名全扫 + osuperpowers→kairos 命名退役（目录/name/引用/测试文件名/字面量/包身份/workspace 根/文档树；与 Task 2 同组 dispatch）

- **Objective**: cdd-* 身份改名全扫 + osuperpowers→kairos 命名退役（目录/name/引用/测试文件名/字面量/包身份/workspace 根/文档树；与 Task 2 同组 dispatch）

- **Produces**: 8 目录 `git mv` 至 cdd-* + name 字段同步（单身份 G1）；flow 内 `/kairos:cdd-*` 互引 + 测试文件名随新名；live 面旧名零命中；包身份 → @oscaner-skills/kairos + workspace 根 `.kairos` + 文档树 `docs/kairos/`；validate step 名换 kairos

- **Files**: packages/kairos/skills/（8 目录）, packages/kairos/package.json, packages/cdd-engine/src/documents/schema/skill-anatomy.json, packages/cdd-engine/templates/report/issue-body.json, packages/cdd-engine/templates/engine-config.json, .gitignore, biome.json, docs/kairos/（39 文件）, .github/workflows/release.yml, .changeset/pi-harness-manifest-pin.md

- **Steps**:
  1. **映射表（唯一权威）**——8 skill 目录/name 改名（brainstorming→cdd-design · writing-single-spec→cdd-spec · writing-overall-spec→cdd-charter · writing-phase-spec→cdd-phase · writing-plans→cdd-plan · cli-driven-development→cdd-dev · finishing→cdd-close · report-issues→cdd-report） — checkable: `skills/` 下 8 目录名 == 各 SKILL.md `name:` == cdd-* 八名集合（目录×name 双钉成立）
  2. **Step 1 基线枚举**：`git grep -n -E '(旧名|osuperpowers)'` 分面枚举全部落点（live 面改 / 历史正文不改）；**Step 2 目录重命名** `git mv` 8 目录 + 内部相对路径引用随改；**Step 3 name 字段** 8 个 SKILL.md front-matter name 按映射表改；**Step 4 flow 内互引** `/osuperpowers:<旧名>` → `/kairos:<新名>`（`/superpowers:*` / `/mattpocock-skills:*` 一字不动） — checkable: 含旧名测试文件已全部 git mv（`git ls-files` 零旧名文件名）；live 面旧名零命中（历史正文除外）
  3. **Step 5 测试文件名** git mv 随新名（writing-plans-spec.test.mjs → cdd-plan-spec.test.mjs 等）；**Step 6 字面量全扫**——live 面旧名字符串/路径/标识符随改（engine schema skill-anatomy skeletonDeltas 语义替换 · issue-body.json 组件清单 → cdd-* · issue-renderer.test 断言随新名） — checkable: live 面 grep 旧名/旧目录零命中（历史正文除外）；engine 面引用随扫同落
  4. **Step 6b 包身份 + workspace 根 + 文档树（G4）**：`packages/osuperpowers/package.json` name → `@oscaner-skills/kairos`；scripts 标识符 osuperpowersPkg 系 → kairos；**validate step 名**换 kairos（ci-validate/pre-commit name-set 同步）；workspace 根 `".osuperpowers/cdd"` → `".kairos/cdd"`（engine-config 单源 + 根 .gitignore + biome includes + engine 33 文件引用）——**零迁移**（存量磁盘态惰性）；**三目录 git mv**（packages/osuperpowers→packages/kairos · docs/osuperpowers→docs/kairos · workspace 根 value 改） — checkable: 三目录迁移完成；live 面零 `osuperpowers`（历史正文除外）；validate step 名已换 kairos 且 ci-validate name-set 绿
  5. **Step 7 守卫一致性**：grep-sweep-regression / maintainers-docs 断言技能名集合随新名；**Step 8 验证**：`git grep` 旧名仅剩历史正文（人工核对清单一致）+ `pnpm run precommit` — checkable: 改名后既有测试全绿（node:test + scripts vitest + engine vitest）；`pnpm run precommit` 绿（含 emit 新鲜——Task 2 同组闭合）

- **DependsOn**: none
- **AtomicWith**: 2

- **Acceptance**:
  - `skills/` 下 8 目录名 == 各 `SKILL.md` `name:` == cdd-\* 八名集合（目录×name 双钉成立）；含旧名测试文件已全部 git mv（`git ls-files` 零旧名文件名）；live 面 `git grep` 旧名/旧目录零命中（历史正文除外）；三目录迁移完成（`packages/osuperpowers`→`packages/kairos` · `docs/osuperpowers`→`docs/kairos` · workspace 根 value → `.kairos`）；live 面零 `osuperpowers`（历史正文除外）；validate step 名已换 kairos 且 ci-validate name-set 绿；改名后既有测试全绿（node:test + scripts vitest + engine vitest——engine 面若有引用随扫同落）；`pnpm run precommit` 绿（含 emit 新鲜——见 Task 2 同组闭合）


### Task 2: emit 重生成（随改名原子单位）

- **Objective**: emit 重生成（随改名原子单位）：ISSUE_TEMPLATE 8 个 cdd-* 选项 + source.json name/contentRoot 换 kairos + 零漂移

- **Produces**: `pnpm run emit` 重生成（.claude-plugin / .cursor-plugin / marketplace / source.json + ISSUE_TEMPLATE yml）；`emit:check` 零漂移；产物核对

- **Files**: .claude-plugin/plugin.json, .cursor-plugin/plugin.json, marketplace/source.json, .github/ISSUE_TEMPLATE/

- **Steps**:
  1. **Step 1**：`pnpm run emit`——重生成 `.claude-plugin/` / `.cursor-plugin/` / `marketplace/` / `source.json` + `.github/ISSUE_TEMPLATE/`（技能选项由 issue-body.json 派生，随其新名重生成 8 个 cdd-* 选项） — checkable: `emit:check` 零漂移；issue 表单 YAML 技能选项恰 8 个 cdd-*
  2. **Step 2**：`pnpm run emit:check` 零漂移；产物核对（source.json name/contentRoot 已换 kairos + 其余 emit 产物零旧名残留）；**Step 3**：`git add` 产物 + 随 T1 改名面一起提交（conventional `feat(kairos): skills 改名 cdd-* + 命名退役 osuperpowers→kairos`） — checkable: issue 表单选项含 8 个 cdd-* + 其余 emit 产物零旧名残留；`pnpm run precommit` 绿（注：emit 产物 = 派生，永不经手编辑）

- **DependsOn**: none
- **AtomicWith**: 1

- **Acceptance**:
  - `emit:check` 零漂移；issue 表单选项含 8 个 cdd-* + 其余 emit 产物零旧名残留；`pnpm run precommit` 绿


### Task 3: markers 数据 + checkMarkers 三方一致守卫（engine 面增量）

- **Objective**: markers 数据 + checkMarkers 三方一致守卫（engine 面增量）：lexicon markers 子对象 + guard 三方一致 + 4 键 pin
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `contract-lexicon.json` harness 域并列 `markers` 子对象；`ContractLexiconGuard#checkMarkers()` 三方一致（lexicon ↔ detect() 谓词 ↔ engine-config env 白名单恰 4 键）；residue assertLexiconZero 并入 checkMarkers

- **Files**: packages/cdd-engine/src/infra/contract-lexicon.json, scripts/lib/contract-lexicon.ts, scripts/relevant validate wiring

- **Steps**:
  1. **Step 1（数据）**：`contract-lexicon.json` harness 域并列 `markers` 子对象（claude `{env: CLAUDE_CODE_SESSION_ID, aiAgentPrefix: "claude-code"}` · cursor `{env: CURSOR_TRACE_ID}` · pi `{env: AI_AGENT, value: "pi"}`） — checkable: lexicon markers 数据落位
  2. **Step 2（守卫）**：`ContractLexiconGuard#checkMarkers()`——三方一致：lexicon markers ↔ `harness.ts` detect() 谓词 ↔ engine-config env 白名单（恰 4 键 `[AI_AGENT, CLAUDE_CODE_SESSION_ID, CURSOR_TRACE_ID, PATH]`）；**Step 3（接线）**：residue assertLexiconZero 组并入 checkMarkers 调用（不增 validate step 名） — checkable: `checkMarkers` 全绿（三方一致 + 单侧改异反例 + 4 键 pin）；validate step-9 块绿
  3. **Step 4（测试）**：`contract-lexicon.test.ts` 增 markers 用例（三方一致绿 · 每方单侧改异均 FAIL · env 白名单恰 4 键 pin）；C5 的 README 漂移期望用例迁 presentation-surface（T5 名义表 == 数据派生）；**Step 5**：`pnpm --filter @oscaner-skills/cdd-engine dev:stub` + `pnpm run precommit` — checkable: lexicon vitest 全绿；`pnpm run precommit` 绿（注：markers = engine 语义归 lexicon 域；技能名不归 engine——分层纪律）

- **Acceptance**:
  - `checkMarkers` 全绿（三方一致 + 单侧改异反例 + 4 键 pin）；lexicon vitest 全绿；validate step-9 块绿；`pnpm run precommit` 绿


### Task 4: README 家族铺设（root + kairos + 双镜像；与 Task 5 同组 dispatch）

- **Objective**: README 家族铺设（root + kairos + 双镜像；与 Task 5 同组 dispatch）：neutral verified triple + pi 小节 + 名义映射表

- **Produces**: root README（triple 声称 + pi 安装行 + From pi 小节 + kairos 提及更新）；kairos README（triple + 名义映射表数据渲染 + pi 消费段 + D5 消费故事节）；双镜像 zh parallel + 时间戳校准

- **Files**: README.md, README.zh-CN.md, packages/kairos/README.md, packages/kairos/README.zh-CN.md

- **Steps**:
  1. **Step 1（root README）**：neutral verified 声称 pair→triple（`verified on **Claude Code**, **Cursor Agent**, and **Pi**`）；per-harness 安装表加 pi 行；新增 `### From pi` 小节（`pi install npm:@oscaner-skills/kairos` + 安装后事实 + **一行 cdd- 缘由**）；既有 `osuperpowers:<旧名>` 提及更新为 `kairos:<新名>` — checkable: neutral verified 声称 triple 落笔（root EN）；pi 安装段含命令 + 安装后事实 + cdd- 缘由一行
  2. **Step 2（kairos README）**：neutral triple（`verified on **Claude Code**, **Cursor Agent**, and **Pi**`）；**名义映射表**替换手写 CDD engine CLI 表——新表列 `标识符 | 二进制 | 宿主 marker | Ship`，数据从 contract-lexicon（ids/clis/markers）+ harness-registry ship 派生（零手写重复；`cursor-agent` 仅二进制列数据值）；pi 消费段 + **D5 消费故事节**（`cdd-*` 零冲突 by-construction + inline import harness 条件化语义） — checkable: 名义表与 lexicon/registry 数据一致（人工过目 + T5 守卫）；D5 节含零冲突叙事 + harness 条件化语义
  3. **Step 3（双镜像）**：`README.zh-CN.md` + `packages/kairos/README.zh-CN.md` 结构 parallel + neutral triple 随 EN（补 **Pi**）+ 镜像声明时间戳校准 `2026-10-01`；`packages/cdd-engine/README.md` 零铺设增量（T1 改名面仍适用）；**Step 4**：`pnpm run precommit` — checkable: zh 双镜像结构 parallel + 声明时间戳 `2026-10-01`；README 家族零 `cursor-agent`（二进制列数据值除外）；`pnpm run precommit` 绿

- **DependsOn**: none
- **AtomicWith**: 5

- **Acceptance**:
  - README 家族零 `cursor-agent`（豁免锚已废；二进制列数据值除外——名义表二进制列含 `cursor-agent` 属 registry `cli` 数据值，合法）；neutral verified 声称 triple 四声明面实际落笔（root EN / osuperpowers EN / zh 双镜像，pair→triple 补 Pi）；zh 双镜像结构 parallel + 声明时间戳 `2026-10-01`；名义表与 lexicon/registry 数据一致（人工过目 + T5 守卫）；pi 安装段含命令 + 安装后事实 + cdd- 缘由一行；D5 节含零冲突叙事 + harness 条件化语义；`pnpm run precommit` 绿


### Task 5: 测试 pin 延展（三文件 pin + 零新 step；与 Task 4 同组 dispatch）

- **Objective**: 测试 pin 延展（三文件 pin + 零新 step；与 Task 4 同组 dispatch）：presentation-surface triple + 清单双钉 + 名义表数据派生 + pi-package 集合

- **Produces**: `presentation-surface.test.mjs` 延展（verified triple · 技能清单 == 目录×name 双钉 · 名义表 == 数据派生 · 外国声称禁令 · 零旧名/零 osuperpowers 残留）；`pi-package.test.mjs` 延展（pi.skills glob 解析集 == 扫描集恰 8 cdd-*）

- **Files**: packages/kairos/tests/presentation-surface.test.mjs, packages/kairos/tests/pi-package.test.mjs

- **Steps**:
  1. **Step 1（presentation-surface）**延展：harness 声称 = **verified triple**（claude / cursor-agent / pi；断言正则同步 T4 铺设后 triple 措辞）；**技能清单 == 目录扫描双钉**（README 声明技能集合 == `skills/` 目录名 × 各 SKILL.md `name:`，恰 8 全 cdd-*）；**名义表 == 数据派生**；保留 `/8 harnesses|Trae|Vibe|Kiro|OpenCode` 外国声称禁令；**零旧名 skill 身份残留** + **零 `osuperpowers` 残留**断言 — checkable: `presentation-surface.test.mjs` 全绿（triple + 清单双钉 + 名义派生 + 禁令 + 零旧名/零 osuperpowers 残留）
  2. **Step 2（pi-package）**延展：`pi.skills` glob 解析集 == 扫描集（恰 8 `cdd-*`，目录×name 双钉）——既有 4 个测试块断言不变，新增集合断言；**Step 3**：零新 validate step（node:test 自动进 step-4 glob）；`pnpm run precommit` — checkable: `pi-package.test.mjs` 全绿（含 pi 集合断言）；validate step-4 块绿；ci-validate 零扰动；`pnpm run precommit` 绿（注：`brainstorming` 作为词在上游 import 合法——不做词级禁）

- **DependsOn**: none
- **AtomicWith**: 4

- **Acceptance**:
  - `presentation-surface.test.mjs` / `pi-package.test.mjs` 全绿（triple + 清单双钉 + 名义派生 + 禁令 + 零旧名/零 `osuperpowers` 残留 + pi 集合断言）；validate step-4 块绿；ci-validate 零扰动；`pnpm run precommit` 绿


### Task 6: changeset + validate 终验

- **Objective**: changeset + validate 终验（收口记录 + 终验）：kairos major + cdd-engine patch changesets
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `.changeset/pi-harness-skill-rename.md`（kairos major：8 skills 改名 cdd-* + 命名退役 + 消费故事；pending manifest-pin 包字段重定向）+ `.changeset/pi-harness-markers.md`（cdd-engine patch）；validate ALL PASS 终验

- **Files**: .changeset/pi-harness-skill-rename.md, .changeset/pi-harness-markers.md, .changeset/pi-harness-manifest-pin.md

- **Steps**:
  1. **Step 1**：`.changeset/pi-harness-skill-rename.md`——`"@oscaner-skills/kairos": major`（技能全量改名 cdd-* breaking + 命名退役 osuperpowers → kairos；`cdd`/`cdd-engine` 保留；major 语义 = 0.x major → 1.0.0 首稳定）+ **pending changeset（manifest-pin）包字段重定向** `@oscaner-skills/kairos` — checkable: 两个 changeset 文件在 `.changeset/` 且 bump 类型正确（kairos major / cdd-engine patch，含 manifest-pin 重定向）
  2. **Step 2**：`.changeset/pi-harness-markers.md`——`"@oscaner-skills/cdd-engine": patch`（contract-lexicon markers 域 + checkMarkers 三方一致守卫增量面）；**Step 3**：`pnpm run validate` 全块全绿终验（13 块 + engine + scripts + node:test + residue + contract-lexicon）；**Step 4**：`pnpm run precommit` — checkable: `pnpm run validate` ALL PASS；`pnpm run precommit` 绿（注：P4 closeout 四表回填在后续流程执行，非本 plan 任务）

- **Acceptance**:
  - 两个 changeset 文件在 `.changeset/` 且 bump 类型正确（kairos `major` / cdd-engine `patch`，含 manifest-pin 包字段重定向）；`pnpm run validate` ALL PASS；`pnpm run precommit` 绿；四表回填一致（P4 收口 claim 归本 plan 提交后的 closeout，见注）


### Task 7: harness 契约收敛（registry 唯一契约源 + lexicon 纯词表 + checkHarness + 文本/渲染双形态；与 Task 8 同组 dispatch，布局步骤先行）

- **Objective**: harness 契约收敛（registry 唯一契约源 + lexicon 纯词表 + checkHarness + 文本/渲染双形态；与 Task 8 同组 dispatch，布局步骤先行）

- **Produces**: `config/harness-contract.json`（detect/install/refs 域 + prefix 删除改派生）；lexicon harness 域瘦身删除；`checkHarness` 四向（detect/refs/prefix/install）；SKILL 文本 26 处双形态 + README 渲染

- **Files**: packages/cdd-engine/config/harness-contract.json, packages/cdd-engine/src/infra/contract-lexicon.json, scripts/lib/contract-lexicon.ts, packages/kairos/skills/（6 件 SKILL.md）, README 家族

- **Steps**:
  1. **Step 1（registry 域扩展）** `config/harness-contract.json`：`detect`（markers 自 lexicon 回迁）+ `install`（per-pkg 安装旌：kairos 自装 + superpowers/mattpocock-skills/impeccable 上游——用户 2026-10-01 提供命令，cursor 列 pending 不虚报）+ `refs`（per `<pkg>:<skill>` 引用形态：claude/cursor 列 = `/ns:name`、pi 列 = `/skill:<bare>`）+ **prefix 删除 → 派生**（dispatch-slot → ref key） — checkable: registry 行 = 唯一 harness 契约（detect/install/refs 在位 · prefix 零字面 · cli 单源）
  2. **Step 2（lexicon 瘦身）**：删 `harness` 域（ids/clis/markers 全回迁 registry 单源，守卫生效镜像对偶删）；status/stdout/residue/anatomy 不动；**Step 3（checkHarness）**：`ContractLexiconGuard` 新方法——detect ↔ detect() 谓词 ↔ engine-config 白名单 · refs ↔ SKILL 文本 26 处双形态 · prefix 派生 ↔ 实际注入值 · install ↔ README 上游依赖表（原 checkMarkers 融入） — checkable: lexicon harness 域零残留（纯词表）；checkHarness 四向全绿（detect/refs/prefix/install）
  3. **Step 4（SKILL 文本 + re-anchor）**：6 个 cdd-* skill 26 处跨技能引用照 refs 填 pi 形（`（pi：/skill:<bare>）`）+ BLOCKED/install 行照 install 填；T3/T4/T5 交付面 re-anchor（presentation-surface 名义表数据源 lexicon→registry）；**Step 5（README 渲染 + 终验）**：README D5/上游依赖安装段从 install/refs 数据渲染；`pnpm --filter @oscaner-skills/cdd-engine test` + scripts vitest + `pnpm run precommit` 绿 — checkable: SKILL 文本引用全双形态 + 零裸 ns 残留（pin）；README 上游表数据渲染与 install 一致；engine/scripts 测试 + precommit 绿

- **DependsOn**: none
- **AtomicWith**: 8

- **Acceptance**:
  - registry 行 = 唯一 harness 契约（detect/install/refs 在位 · prefix 零字面 · cli 单源）；lexicon harness 域零残留（纯词表）；checkHarness 四向全绿（detect/refs/prefix/install）；SKILL 文本引用全双形态 + 零裸 ns 残留（pin）；README 上游表数据渲染与 install 一致；engine/scripts 测试 + precommit 绿


### Task 8: engine 静态数据面重组（config/ 家 + harness-contract 命名 + resolveResource 唯一路径真相；与 Task 7 同组 dispatch，布局步骤先行）

- **Objective**: engine 静态数据面重组（config/ 家 + harness-contract 命名 + resolveResource 唯一路径真相；与 Task 7 同组 dispatch，布局步骤先行）

- **Produces**: `config/` 家（harness-contract / contract-lexicon / engine-config / template-contract + schema/ 子目）+ `templates/` 仅内容种子；`resolveResource()` 唯一路径真相（engine 六消费面收编）；package.json#files 随发 config；dist/config 镜像（`dist/resources` 零残留）

- **Files**: packages/cdd-engine/config/（harness-contract.json · contract-lexicon.json · engine-config.json · template-contract.json · schema/*.json）, packages/cdd-engine/src/infra/resource.ts, packages/cdd-engine/package.json, packages/cdd-engine/templates/

- **Steps**:
  1. **Step 1（git mv + 命名消歧）**：`src/infra/harness-registry.json` → `config/harness-contract.json`（engine 侧运行时契约命名；emit 侧 `scripts/lib/harness-registry.ts` 保留原名 = 分发注册表，分界清晰化）；`src/infra/contract-lexicon.json` · `templates/engine-config.json` · `templates/template-contract.json` → `config/`；`src/documents/schema/*.json`（5）+ `templates/schema/*.json`（3）→ `config/schema/`；`templates/report/issue-body.json` 原地（内容种子） — checkable: `config/` 落位 + `harness-contract.json` 命名落地 + `templates/` 仅内容种子（issue-body.json）
  2. **Step 2（resolveResource 唯一路径真相）**：`src/infra/resource.ts` 升级 = logical-name → path 决议（dev 树与 dist 打包树同构镜像；registry `dist/resources` 特殊位废除）；engine 六消费点 `path.join(resolvePackageRoot(__dirname), …)` 全收编（config / registry / render/templates / documents/schema / rules/schema / domain/issue-renderer） — checkable: `resolveResource()` = 唯一路径真相——engine 六消费面零散落硬编码、smoke-cdd / residue / lexicon pin 全数据派生、dev↔dist `config/` 同构（`dist/resources` 零残留）
  3. **Step 3（构建/发布面）**：`package.json#files` 发 `config/` + `templates/` + `dist/`；构建/打包 config → dist/config 镜像，删除旧 `dist/resources` 分叉与残影；**Step 4（validate pin 数据派生）**：smoke-cdd tarball pin · residue 路径 pin · contract-lexicon 数据源全改从 locator 派生；**Step 5（测试 + 终验）**：engine vitest + scripts vitest + kairos 测试路径引用随迁；`pnpm run precommit` 绿 — checkable: CLI 面与数据语义零变化（纯内部结构 + 命名，patch 级）；engine/scripts 测试 + precommit 全绿（注：布局先行 → T7 契约收敛在最终家写作）

- **DependsOn**: none
- **AtomicWith**: 7

- **Acceptance**:
  - `config/` 落位（读作数据全归位）+ `harness-contract.json` 命名落地（engine 契约 vs emit 分发注册表消歧）+ `templates/` 仅内容种子（issue-body.json）；`resolveResource()` = 唯一路径真相——engine 六消费面零散落 `path.join(pkgRoot, "…")` 硬编码、smoke-cdd / residue / contract-lexicon pin 全数据派生、dev↔dist `config/` 同构（`dist/resources` 零残留）；`package.json#files` 随发 config；engine/scripts 测试 + precommit 全绿；CLI 面与数据语义零变化（纯内部结构 + 命名，patch 级）
