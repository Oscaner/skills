# Pi Harness P4 实施计划（Pi Harness P4 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p4-design.md](docs/kairos/specs/2026-09-27-pi-harness-p4-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.22](docs/kairos/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.5 · 2026-10-01（契约收敛定稿：T7/T8 合并同组 `7,8`「harness 契约面成型」——T8 布局（config/ 家 + harness-contract 命名 + resolveResource）与 T7 收敛（detect/install/refs + prefix 派生 + lexicon 纯词表 + checkHarness）同文件集一原子，布局步骤先行；v1.3（T7 pi prefix 值）与 v1.4（T8 布局）的历史表述被其并入）
- **Depends on**: P4 design v1.4 Approved（`0f279ded` · `4db6049c`，C1–C6）
- **Base**: develop

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

- **Do**: 全仓改名原子面的机械主体：
  - **映射表（唯一权威）**——**基路径 = `packages/osuperpowers/skills/`**（包目录改名 `git mv packages/osuperpowers packages/kairos` 后为 `packages/kairos/skills/`；二者在同一原子单位内，顺序以实现顺手为准）：
    | 旧目录/旧 name | 新目录/新 name |
    |---|---|
    | `skills/brainstorming` / `name: brainstorming` | `skills/cdd-design` / `name: cdd-design` |
    | `skills/writing-single-spec` / `writing-single-spec` | `skills/cdd-spec` / `cdd-spec` |
    | `skills/writing-overall-spec` / `writing-overall-spec` | `skills/cdd-charter` / `cdd-charter` |
    | `skills/writing-phase-spec` / `writing-phase-spec` | `skills/cdd-phase` / `cdd-phase` |
    | `skills/writing-plans` / `writing-plans` | `skills/cdd-plan` / `cdd-plan` |
    | `skills/cli-driven-development` / `cli-driven-development` | `skills/cdd-dev` / `cdd-dev` |
    | `skills/finishing` / `finishing` | `skills/cdd-close` / `cdd-close` |
    | `skills/report-issues` / `report-issues` | `skills/cdd-report` / `cdd-report` |
  - **Step 1（基线枚举）**：`git grep -n -E 'brainstorming|writing-single-spec|writing-overall-spec|writing-phase-spec|writing-plans|cli-driven-development|finishing|report-issues|osuperpowers'` 分面枚举全部落点（含文件名 `git ls-files | grep -E 'brainstorming|writing-…|cli-driven-development|finishing|report-issues|osuperpowers'`）——区分 live 面（改）与历史正文（specs/plans 既有行、CHANGELOG、既有 changeset——**不改**）；`.osuperpowers`（engine workspace 根）token 单列（改 value 源，见 Step 6b）
  - **Step 2（目录重命名）**：`git mv` 8 目录按映射表执行（基路径下 `skills/brainstorming/` → `skills/cdd-design/` …）；目录内嵌套文档随目录移动，**内部相对路径引用随改**（例：`packages/osuperpowers/skills/finishing/SKILL.md:24` 的 `../cli-driven-development/docs/base-branch.md` → `../cdd-dev/docs/base-branch.md`——以 grep 全量枚举 `..` 相对引用为准，不止此一例）
  - **Step 3（name 字段）**：8 个 `SKILL.md` front-matter `name:` 按映射表改；目录名 ≠ name 字段即失败（单身份 G1）
  - **Step 4（flow 内互引）**：8 个 SKILL.md 内 `/osuperpowers:<旧名>` 引用改为 `/kairos:<新名>`（前缀随命名退役 + 技能名随新名；全 grep 枚举）；`/superpowers:*` / `/mattpocock-skills:*` 一字不动
  - **Step 5（测试文件名）**：含旧 skill 名的测试文件 git mv 随新名——已知：`packages/osuperpowers/tests/writing-plans-spec.test.mjs` → `cdd-plan-spec.test.mjs`；其余以 `git ls-files | grep` 枚举为准（`status-routing-convergence.test.mjs` / `review-loop-clean-tree.test.mjs` 等若内含旧名仅改内容、文件名无旧名不动）
  - **Step 6（测试/代码/文档字面量全扫）**：全仓 live 面旧名字符串/路径/标识符/声称字面量随改——已知面：`packages/osuperpowers/tests/*.mjs`（`status-routing-convergence` / `review-loop-clean-tree` / `writing-plans-spec`（即新 `cdd-plan-spec`）等的 `SKILLS_ROOT/<name>` 与 skill→review-loop 映射请以 grep 实态为准）、README 家族提及、CLAUDE.md 提及、docs/maintainers 提及、scripts 若有引用、**README 结构铺设（矩阵 / 名义表 / pi 段 / D5）不在本任务**（归 T4）——本任务只把既有提及改名；**engine 面已知引用一并随改**：
    - `packages/cdd-engine/src/documents/schema/skill-anatomy.json` 的 `skeletonDeltas.requiredCarriers` 枚举（`["writing-single-spec", "writing-phase-spec", "writing-overall-spec"]`，checkAnatomy 机器消费）——按映射表**语义**替换（`writing-single-spec`→`cdd-spec`、`writing-phase-spec`→`cdd-phase`、`writing-overall-spec`→`cdd-charter`），非机械同名替换
    - `packages/cdd-engine/templates/report/issue-body.json` 组件清单 8 件（`osuperpowers:brainstorming` / `osuperpowers:report-issues` / `osuperpowers:finishing` 等）→ 对应 cdd-* 组件名（Task 2 emit 重生成 ISSUE_TEMPLATE yml）
    - `packages/cdd-engine/src/domain/__tests__/issue-renderer.test.ts` 等名称断言（`expect(components).toContain("osuperpowers:report-issues")` 等）随新名
  - **Step 6b（包身份 + workspace 根 + 文档树，G4）**：
    - **包身份扫**：`packages/osuperpowers/package.json` `name` → `@oscaner-skills/kairos`（`keywords`/`pi` 字段照旧）；scripts 标识符 `osuperpowersPkg/Row/Steps/Versions/Osc/Src/Entry/Bump` → kairos 系；**validate step 名**（scripts/validate/osuperpowers.ts + residue/emit 面）「osuperpowers pi-package well-formed / plugin resolution / skills inventory」→ kairos——`ci-validate.test.mjs` / `pre-commit.test.ts` name-set 断言同步；`scripts/run.ts` modulePath 随
    - **workspace 根**：`packages/cdd-engine/templates/engine-config.json#handoffNamespace.workspaceRoot` `".osuperpowers/cdd"` → `".kairos/cdd"`（单源）+ 根 `.gitignore` `.osuperpowers` → `.kairos` + `biome.json` includes `!.osuperpowers/**` → `!.kairos/**` + engine 33 文件 `.osuperpowers` 引用（tests/comments，以 grep 实态改 value）——**零迁移**：存量 `.osuperpowers/` 磁盘态 gitignored、零处理
    - **文档树**：`git mv docs/osuperpowers docs/kairos`（39 文件随迁）；engine schema 描述字符串 `docs/osuperpowers/` → `docs/kairos/`（overall/phase-spec/plan.json）· 随迁文档内 live 指针同步（**`**Spec:**`** / Parent program / File-paths 等链到 `docs/osuperpowers/` 的更新为 `docs/kairos/`；历史正文文本 token 不改）
    - **发布面**：`.github/workflows/release.yml` matrix `name: osuperpowers` / `tag_prefix: "osuperpowers@"` → kairos；`pnpm-lock.yaml` 随 install 重写；pending changeset `.changeset/pi-harness-manifest-pin.md` 包字段 → `@oscaner-skills/kairos`（重定向）
    - 三目录迁移 = `git mv packages/osuperpowers packages/kairos` · `git mv docs/osuperpowers docs/kairos` ·（workspace 根为 value 改、非目录 mv）——零迁移机制、零存量处理
  - **Step 7（守卫一致性先落地处）**：`grep-sweep-regression.test.mjs` / `maintainers-docs.test.mjs` 若断言技能名集合也随新名更新（以读文件实态为准，不臆造）
  - **Step 8（验证）**：`git grep -n -E '(brainstorming|writing-single-spec|writing-overall-spec|writing-phase-spec|writing-plans|cli-driven-development|finishing|report-issues)'` 仅剩历史正文允许命中（specs/plans 既有行 + CHANGELOG + 既有 changeset——人工核对清单一致）；`git grep -n -E 'osuperpowers'` 仅剩历史正文 + 本 spec/plan 的退役说明行；`pnpm run precommit`
- **验收**: `skills/` 下 8 目录名 == 各 `SKILL.md` `name:` == cdd-\* 八名集合（目录×name 双钉成立）；含旧名测试文件已全部 git mv（`git ls-files` 零旧名文件名）；live 面 `git grep` 旧名/旧目录零命中（历史正文除外）；三目录迁移完成（`packages/osuperpowers`→`packages/kairos` · `docs/osuperpowers`→`docs/kairos` · workspace 根 value → `.kairos`）；live 面零 `osuperpowers`（历史正文除外）；validate step 名已换 kairos 且 ci-validate name-set 绿；改名后既有测试全绿（node:test + scripts vitest + engine vitest——engine 面若有引用随扫同落）；`pnpm run precommit` 绿（含 emit 新鲜——见 Task 2 同组闭合）
- **注**: 历史正文豁免清单以 Step 1 基线为实据，改动前先核对；`cdd-plan-spec.test.mjs` 等文件内既有断言随实态改（该技能身份已变）

### Task 2: emit 重生成（随改名原子单位）

- **Do**: Task 1 改名面落地后立即：
  - **Step 1**：`pnpm run emit`——重生成 `.claude-plugin/` / `.cursor-plugin/` / `marketplace/` / `source.json` + `.github/ISSUE_TEMPLATE/`（claude/cursor plugin manifests 的 `skills` 为常数 glob `"./skills/"`，相对 contentRoot，改名不改其内容；随改名变化的 emit 产物 = ISSUE_TEMPLATE yml——技能选项由 `templates/report/issue-body.json` 派生，随其新名重生成 8 个 cdd-* 选项）
  - **Step 2**：`pnpm run emit:check` 零漂移；产物核对：issue 表单 YAML 技能选项恰 8 个 cdd-*（`kairos:cdd-design` … `kairos:cdd-report`，随 issue-body.json 新名派生）+ `source.json` name/contentRoot 已换 kairos + 其余 emit 产物（claude/cursor manifests / marketplace）零旧名残留
  - **Step 3**：`git add` 产物 + 随 T1 改名面一起提交（conventional `feat(kairos): skills 改名 cdd-* + 命名退役 osuperpowers→kairos — 目录/name/引用/测试/字面量/包身份/workspace/文档树全扫 + emit 重生成`）
- **验收**: `emit:check` 零漂移；issue 表单选项含 8 个 cdd-* + 其余 emit 产物零旧名残留；`pnpm run precommit` 绿
- **注**: emit 产物 = 派生（永不经手编辑）；版本号字段不手改（`package.json` 单源）

### Task 3: markers 数据 + checkMarkers 三方一致守卫（engine 面增量）

- **Do**: 名义映射表的 marker 数据面落地：
  - **Step 1（数据）**：`packages/cdd-engine/src/infra/contract-lexicon.json` harness 域并列 `markers` 子对象（与既有 `ids`/`clis` 并列）：
    ```json
    "markers": {
      "claude": { "env": "CLAUDE_CODE_SESSION_ID", "aiAgentPrefix": "claude-code" },
      "cursor": { "env": "CURSOR_TRACE_ID" },
      "pi": { "env": "AI_AGENT", "value": "pi" }
    }
    ```
  - **Step 2（守卫）**：`scripts/lib/contract-lexicon.ts` `ContractLexiconGuard` 增方法 `checkMarkers()`——**三方一致**：lexicon `markers` ↔ `packages/cdd-engine/src/infra/harness.ts` detect() 谓词（`CursorHarness` = `Boolean(env.CURSOR_TRACE_ID)` · `ClaudeHarness` = `Boolean(env.CLAUDE_CODE_SESSION_ID) || (env.AI_AGENT ?? "").startsWith("claude-code")` · `PiHarness` = `env.AI_AGENT === "pi"`）↔ `packages/cdd-engine/templates/engine-config.json` env 白名单（恰 4 键 `[AI_AGENT, CLAUDE_CODE_SESSION_ID, CURSOR_TRACE_ID, PATH]`）——任一面对不上即 FAIL
  - **Step 3（接线）**：validate residue 块（`scripts/validate/residue.ts` 的 `assertLexiconZero` 组）并入 `checkMarkers` 调用——**不增 validate step 名、零 ci-validate 扰动**
  - **Step 4（测试）**：`scripts/lib/__tests__/contract-lexicon.test.ts` 增 markers 用例——三方一致绿 · 每方单侧改异（lexicon 改 / detect 改 / env 白名单改）均 FAIL · env 白名单恰 4 键 pin（反例加第 5 键 FAIL）；**C5 的「README 漂移期望」用例迁至 presentation-surface（T5 Step 1 名义表 == 数据派生）**——README 名义表由 T4 铺设，lexicon 测试面在名义表就绪前无法前置断言（本任务时序 < T4），迁移理由 = 数据面不变式归 lexicon 测试、展示面漂移归 package 测试
  - **Step 5**：`pnpm --filter @oscaner-skills/cdd-engine dev:stub`（engine 数据面变更后承接）+ `pnpm run precommit`
- **验收**: `checkMarkers` 全绿（三方一致 + 单侧改异反例 + 4 键 pin）；lexicon vitest 全绿；validate step-9 块绿；`pnpm run precommit` 绿
- **注**: markers = engine 语义（归 lexicon engine 域）；技能名不归 engine（分层纪律——`cdd-*` 名单不进 lexicon）。D5 事实锚：pi detect = `AI_AGENT === "pi"`（`PI_CODING_AGENT=true` 佐证，零新键——复用 `AI_AGENT` 通道）

### Task 4: README 家族铺设（root + kairos + 双镜像；与 Task 5 同组 dispatch）

- **Do**: 消费者文档面落地（消费 T1 改名面 + T3 markers 数据）：
  - **Step 1（root README）** `README.md`：
    - **neutral verified 声称 pair→triple**：`verified on **Claude Code** and **Cursor Agent**`（README.md:11）→ `verified on **Claude Code**, **Cursor Agent**, and **Pi**`
    - per-harness 安装表加 pi 行（`Pi` | `pi install npm:@oscaner-skills/kairos`）
    - 新增 `### From pi` 小节：`pi install npm:@oscaner-skills/kairos`（`@latest` 契约）· 安装后事实（八 skill 以 `cdd-*` 名可见 · project settings 写入）· **一行 cdd- 缘由**（pi 为 flat namespace 且无命名空间修饰语法，`cdd-*` bare-name 唯一性即最佳实践）
    - 既有 `osuperpowers:<旧名>` 技能提及更新为 `kairos:<新名>`（命名空间随退役，同 Step 4）——root 为 README.md:96-97 叙述行、kairos 包 README 为 invoke 示例行；与 T1 Step 6 的提及改名不重复：T1 只改既有提及，本行仅确认铺设后最终形态
  - **Step 2（kairos README）** `packages/kairos/README.md`（目录迁移后）：
    - **neutral verified 声称 pair→triple**：`verified on **Claude Code** and **Cursor Agent**`（README.md:5）→ `verified on **Claude Code**, **Cursor Agent**, and **Pi**`
    - **名义映射表**替换手写 CDD engine CLI 表（`| Harness | CLI binary | Ship status |`——含 2 处 `cursor-agent` 手写行键的行）：新表列 = `标识符 | 二进制 | 宿主 marker | Ship`，数据从 contract-lexicon（`ids`/`clis`/`markers`）+ harness-registry `ship` 派生（零手写重复映射；`cursor-agent` 仅在二进制列作数据值出现）
    - pi 消费段（八 skill 以 `cdd-*` 名安装可见）
    - **D5 消费故事节**（「与 superpowers 并存」）：`cdd-*` 零冲突 by-construction（pi flat namespace 唯一命名）· inline import **harness 条件化**——claude/cursor 插件限定引用（`/superpowers:*`）可用且恒落属主包；pi 仅 `/skill:<bare-name>`，`cdd-*` 唯一性保证无歧义
  - **Step 3（双镜像）**：`README.zh-CN.md` + `packages/kairos/README.zh-CN.md`（目录迁移后；行号随迁不变，内容同前）结构与 EN 同步（per-harness 表 + pi 小节 + 名义表 + D5 节）· **neutral verified 声称 pair→triple 随 EN**（`已在 **Claude Code** 与 **Cursor Agent** 上验证`（README.zh-CN.md:15 / packages/kairos/README.zh-CN.md:7）→ 补 `**Pi**`，与 EN 措辞对齐）· 各文件镜像声明时间戳校准为 `2026-10-01`；`packages/cdd-engine/README.md` 零铺设增量（T4 不为其加内容；T1 改名面仍适用——其 `cli-driven-development` 提及随新名）
  - **Step 4**：`pnpm run precommit`
- **验收**: README 家族零 `cursor-agent`（豁免锚已废；二进制列数据值除外——名义表二进制列含 `cursor-agent` 属 registry `cli` 数据值，合法）；neutral verified 声称 triple 四声明面实际落笔（root EN / osuperpowers EN / zh 双镜像，pair→triple 补 Pi）；zh 双镜像结构 parallel + 声明时间戳 `2026-10-01`；名义表与 lexicon/registry 数据一致（人工过目 + T5 守卫）；pi 安装段含命令 + 安装后事实 + cdd- 缘由一行；D5 节含零冲突叙事 + harness 条件化语义；`pnpm run precommit` 绿
- **注**: pi 面引用用 `/skill:<name>` / 裸名（无 namespace 语法事实）；cdd-engine README 零增量指 T4 铺设零增量——T1 改名面仍适用（非豁免面，其 `cli-driven-development` 提及随新名）

### Task 5: 测试 pin 延展（三文件 pin + 零新 step；与 Task 4 同组 dispatch）

- **Do**: 命名统一 / 名义表 / 声称面 pin（消费 T4 README 产物）：
  - **Step 1（presentation-surface）** `packages/kairos/tests/presentation-surface.test.mjs`（目录迁移后）延展：
    - harness 声称 = **verified triple**（`claude` / `cursor-agent` / `pi`）——README 家族只声称已验证三面（`P4.1` pin 升级；断言正则同步 T4 铺设后的 triple 措辞 `verified on **Claude Code**, **Cursor Agent**, and **Pi**` / 镜像 `已在 **Claude Code**、**Cursor Agent** 与 **Pi** 上验证`，非旧 pair 措辞）
    - **技能清单 == 目录扫描双钉**：README 声明的技能集合 == `skills/` 目录名 × 各 SKILL.md `name:`（恰 8 全 `cdd-*`，双钉不一致即 FAIL）
    - **名义表 == 数据派生**：README 名义表行 == lexicon（`ids`/`clis`/`markers`）+ registry（`ship`）派生期望
    - 保留 `/8 harnesses|Trae|Vibe|Kiro|OpenCode` 外国声称禁令；**零旧名 skill 身份残留**断言（README 声称面无 `brainstorming` 等旧名 skill 引称——上游 import 词法除外）；**零 `osuperpowers` 残留**断言（README 声称面/插件名无 `osuperpowers`）
    - npm-source 解析风险残记录注释（承接 v1.21 登记）
  - **Step 2（pi-package）** `packages/kairos/tests/pi-package.test.mjs`（目录迁移后）延展：`pi.skills` glob 解析集 == 扫描集（恰 8 `cdd-*`，目录×name 双钉）——既有 4 个测试块断言不变（test() 于 24 / 33 / 43 / 50 行，文件实态），新增集合断言
  - **Step 3**：零新 validate step（node:test 自动进 step-4 glob）；ci-validate 编排断言零新 step、assertion-set 的改名同步已由 T1 Step 6b 承载（非文件禁改）；`pnpm run precommit`
- **验收**: `presentation-surface.test.mjs` / `pi-package.test.mjs` 全绿（triple + 清单双钉 + 名义派生 + 禁令 + 零旧名/零 `osuperpowers` 残留 + pi 集合断言）；validate step-4 块绿；ci-validate 零扰动；`pnpm run precommit` 绿
- **注**: pin 只指 kairos 面身份；`brainstorming` 作为词在上游 import（`/superpowers:brainstorming`）合法——不做词级禁（G2 精确保守）

### Task 6: changeset + validate 终验

- **Do**: 收口记录 + 终验：
  - **Step 1**：`.changeset/pi-harness-skill-rename.md`：`"@oscaner-skills/kairos": major`——技能全量改名 `cdd-*`（8 skills 目录/name/引用三 harness invocation 面 breaking，flat-namespace 唯一命名零冲突）+ **命名退役 `osuperpowers` → `kairos`**（npm 包名 / namespace / marketplace / 安装命令；`cdd`/`cdd-engine` 保留）+ 消费故事；`major` 语义 = 0.x major → 1.0.0 首稳定；**pending changeset（manifest-pin）包字段重定向** `@oscaner-skills/kairos`（同 `.changeset/` 目录内）
  - **Step 2**：`.changeset/pi-harness-markers.md`：`"@oscaner-skills/cdd-engine": patch`——contract-lexicon `markers` 域 + `checkMarkers` 三方一致守卫（增量面）
  - **Step 3**：`pnpm run validate` 全块全绿终验（13 块 + engine vitest + scripts vitest + node:test + residue + contract-lexicon）
  - **Step 4**：`pnpm run precommit`
- **验收**: 两个 changeset 文件在 `.changeset/` 且 bump 类型正确（kairos `major` / cdd-engine `patch`，含 manifest-pin 包字段重定向）；`pnpm run validate` ALL PASS；`pnpm run precommit` 绿；四表回填一致（P4 收口 claim 归本 plan 提交后的 closeout，见注）
- **注**: 版本单源 `package.json` → emit 重 stamp（Version PR 流程承接 CHANGELOG）；P4 closeout 四表回填（phase spec / plan 列 → Done + overall change-history 行）在后续 writing-plans 收口 / finishing 流程执行，非本 plan 任务

### Task 7: harness 契约收敛（registry 唯一契约源 + lexicon 纯词表 + checkHarness + 文本/渲染双形态；与 Task 8 同组 dispatch，布局步骤先行）

- **Do**: 把「如何适配宿主」收敛为一张 harness 契约（design C8）——registry 行增 detect/install/refs、prefix 删除改派生、lexicon 瘦身、守卫泛化、SKILL 文本与 README 照数据：
  - **Step 1（registry 域扩展）** `config/harness-contract.json`（T8 已落位命名）：`detect`（markers 自 lexicon 回迁：claude/cursor/pi 各 env marker + value；engine-config env 白名单恰 4 键不变）· `install`（per-pkg 安装旌：kairos 自装 + superpowers/mattpocock-skills/impeccable 上游——用户 2026-10-01 提供命令，claude/cursor/pi 各列，cursor 列 pending 不虚报）· `refs`（per `<pkg>:<skill>` 引用形态：上游 brainstorming/writing-plans/grilling/finishing-a-development-branch/tdd/code-review + kairos cdd-* 内部互引；claude/cursor 列 = `/ns:name`、pi 列 = `/skill:<bare>`）· **prefix 删除 → 派生**（dispatch-slot → ref key：implement→`mattpocock-skills:tdd`、review.task/branch→`mattpocock-skills:code-review`、review.spec/plan→URC 措辞；pi 行 prefix 自此 = refs 派生——T7 前身 pi-prefix 值修正并入）
  - **Step 2（lexicon 瘦身）**：删 `harness` 域（ids/clis/markers 全回迁 registry 单源，守卫生效镜像对偶删）；status/stdout/residue/anatomy 不动
  - **Step 3（checkHarness）**：`ContractLexiconGuard` 新方法——detect ↔ `detect()` 谓词 ↔ engine-config env 白名单（原 checkMarkers 同型，数据家换 registry）· refs ↔ SKILL 文本 26 处双形态 · prefix 派生 ↔ 实际注入值 · install ↔ README 上游依赖表；T3 的 checkMarkers 融入
  - **Step 4（SKILL 文本 + re-anchor）**：6 个 cdd-* skill 26 处跨技能引用照 refs 填 pi 形（`（pi：/skill:<bare>）`）+ BLOCKED（install superpowers / install mattpocock-skills）行内照 install 填；T3/T4/T5 交付面 re-anchor（presentation-surface 名义表数据源 lexicon→registry、contract-lexicon.test checkMarkers 家换）
  - **Step 5（README 渲染 + 终验）**：README D5/上游依赖安装段从 install/refs 数据渲染（用户提供的安装命令只此一份）；`pnpm --filter @oscaner-skills/cdd-engine test` + scripts vitest + `pnpm run precommit` 绿
- **验收**: registry 行 = 唯一 harness 契约（detect/install/refs 在位 · prefix 零字面 · cli 单源）；lexicon harness 域零残留（纯词表）；checkHarness 四向全绿（detect/refs/prefix/install）；SKILL 文本引用全双形态 + 零裸 ns 残留（pin）；README 上游表数据渲染与 install 一致；engine/scripts 测试 + precommit 绿
- **注**: T3 markers 数据家置换 + T4/T5 pin 源置换 = re-anchor（机械面，测试兜底）；emit 分发注册表（scripts/lib）不并入（Non-goal #2）；cursor 安装列 pending 先例同 cache；changeset 由 T6（cdd-engine patch）覆盖，无需新 changeset

### Task 8: engine 静态数据面重组（config/ 家 + harness-contract 命名 + resolveResource 唯一路径真相；与 Task 7 同组 dispatch，布局步骤先行）

- **Do**: engine 静态 JSON 收编为二分家（读作数据 → `config/`，渲染/拷贝种子 → `templates/`）+ 命名消歧 + 唯一路径真相（design C7）——布局先行，T7 契约收敛在其最终家写作：
  - **Step 1（git mv 落位 + 命名消歧）**：`src/infra/harness-registry.json` → **`config/harness-contract.json`**（engine 侧运行时契约命名；emit 侧 `scripts/lib/harness-registry.ts` 保留原名 = 分发注册表，分界清晰化）；`src/infra/contract-lexicon.json` · `templates/engine-config.json` · `templates/template-contract.json` → `config/`；`src/documents/schema/*.json`（5）+ `templates/schema/*.json`（3，文件名保留）→ `config/schema/`（通用 `schema/<name>` 命名空间——T7 的 harness-contract schema 走通用解析，零专属路径）；`templates/report/issue-body.json` 原地（内容种子）；此后 `templates/` 仅内容种子
  - **Step 2（resolveResource 唯一路径真相）**：`src/infra/resource.ts` 升级 = logical-name → path 决议（logical name 表自定义数据 + dev 树与 dist 打包树同构镜像；registry.ts 的 `dist/resources` 特殊位废除）；engine 六消费点 `path.join(resolvePackageRoot(__dirname), …)` 全收编（config.ts / registry.ts / render/templates.ts / documents/schema.ts / rules/schema.ts / domain/issue-renderer.ts）
  - **Step 3（构建/发布面）**：`package.json#files` 发 `config/` + `templates/`（内容种子）+ `dist/`；构建/打包 config → dist/config 镜像，删除旧 `dist/resources` 分叉与残影
  - **Step 4（validate pin 数据派生）**：smoke-cdd tarball pin（doc schema / handoff schema / template-contract / harness-contract 位）· residue.ts 路径 pin（task/docs-handoff-schema、templates/schema 扫面、lexicon 数据源）· scripts/lib/contract-lexicon 数据源——全部改从 locator 数据派生（零第二份字面路径）
  - **Step 5（测试 + 终验）**：engine vitest（schema 加载 / contract 契约解析 / invoke dispatch-set 路径期望）+ scripts vitest（residue/smoke/lexicon pin）+ kairos 测试路径引用随迁；`pnpm --filter @oscaner-skills/cdd-engine test` + `pnpm run precommit` 绿
- **验收**: `config/` 落位（读作数据全归位）+ `harness-contract.json` 命名落地（engine 契约 vs emit 分发注册表消歧）+ `templates/` 仅内容种子（issue-body.json）；`resolveResource()` = 唯一路径真相——engine 六消费面零散落 `path.join(pkgRoot, "…")` 硬编码、smoke-cdd / residue / contract-lexicon pin 全数据派生、dev↔dist `config/` 同构（`dist/resources` 零残留）；`package.json#files` 随发 config；engine/scripts 测试 + precommit 全绿；CLI 面与数据语义零变化（纯内部结构 + 命名，patch 级）
- **注**: 布局先行（本任务）→ T7 契约收敛（同组内后续步骤）；文件名保留（`schema/` 子目内 `-schema` 词缀冗余 = 显式非变更）；changeset 由 T6（cdd-engine patch）覆盖，无需新 changeset

## Task Groups

- **Task 1, 2**: 改名原子单位——身份全扫（目录 / name / 引用 / 测试文件名 / 字面量 / **包身份 `osuperpowers`→`kairos` / workspace 根 `.osuperpowers`→`.kairos`（engine-config 单源） / 文档树 `docs/osuperpowers/`→`docs/kairos/`，三目录 git mv 零存量**）与 emit 重生成不可分（改名即 ISSUE_TEMPLATE yml 漂移——claude/cursor manifests 的 `skills` = 常数 glob `"./skills/"` 相对 contentRoot、source.json name/contentRoot 随包身份；分开 dispatch 中间态 emit:check 全链红）
- **Task 4, 5**: README 铺设 + 其 pin——presentation-surface / pi-package pin 断言 README 产物（声称面 / 清单 / 名义表），同原子（README 铺完而 pin 未跟即为红）
- **Task 7, 8**: harness 契约面成型——config/ 布局（harness-contract 命名 + resolveResource + schema 家）与契约收敛（detect/install/refs + prefix 派生 + lexicon 纯词表 + checkHarness + 文本双形态 + 渲染）同文件集一原子，布局步骤先行（T8→T7 内部序）
