# Pi Harness P4 实施计划（Pi Harness P4 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p4-design.md](docs/osuperpowers/specs/2026-09-27-pi-harness-p4-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.21](docs/osuperpowers/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.0 · 2026-10-01
- **Depends on**: P4 design v1.3 Approved（`0e057b9f`，C1–C6）
- **Base**: develop

## Constraints

### 口径

- **单身份（G1）**：每个 skill 的目录名 == `SKILL.md` front-matter `name:` == 三 harness invocation token——三者合一，任何一者偏移即 FAIL；新名集合恰 8 个：`cdd-design` / `cdd-spec` / `cdd-charter` / `cdd-phase` / `cdd-plan` / `cdd-dev` / `cdd-close` / `cdd-report`；命名空间 `osuperpowers` 保留
- **全改令（G2，user 2026-10-01 拍板）**：改名是全仓原子面——**所有测试（含文件名内嵌旧 skill 名者）、各种文件名、字面量（字符串 / 路径 glob / 标识符 / 声称字面量）一并改**，不允许只改 `name:` 字段留旧面；live 面（osuperpowers src/tests + scripts live + README 家族 + CLAUDE.md + docs/maintainers + engine src）零旧名/旧目录；**历史正文不 retro-rename**（docs/osuperpowers/specs|plans 既有行、CHANGELOG、既有 changeset = 史实）
- **上游 import 不动**：`/superpowers:*` / `/mattpocock-skills:*` 引用原样保留（它们不属于 osuperpowers 身份面）；flow 内 `/osuperpowers:*` 互引随新名
- **markers 三方一致（C3）**：contract-lexicon `markers` ↔ `harness.ts` detect() 谓词 ↔ engine-config env 白名单（恰 4 键 `[AI_AGENT, CLAUDE_CODE_SESSION_ID, CURSOR_TRACE_ID, PATH]`）
- **零手写重复（C2/C3）**：名义映射表 = lexicon/registry 数据派生（guard 钉零漂移）；技能清单 = 目录 × name 双钉扫描（guard 钉零手写名单）；不建镜像注册面
- **分层不破（Non-goal #2）**：技能名 = osuperpowers 包面；harness markers = engine 语义（归 lexicon）；engine 与 emit 注册表不合并
- **消费面纯度（iron rule）**：SKILL.md / 消费者侧文件零程序叙事、零改名 rationale 笔法——rationale 只落本程序 docs
- **D5 事实（已核实 2026-10-01）**：pi 对同名技能按确定性 first-wins（败者静默丢弃 + warning，从不拒绝）；**pi 无命名空间修饰语法**（仅 `/skill:<bare-name>`）——`cdd-*` 是 flat-namespace 下 bare-name 唯一性最佳实践，非「pi 不许同名」
- 引擎调用 `node packages/cdd-engine/dist/cli.mjs` 直调（`dev:stub` 后），不走 global cdd

### commit 边界机制

- 实现提交按任务/合并组粒度（conventional commits，无 attribution trailers）
- spec/plan 文档仅由 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改；implement agent 零文档修改权
- **T3 起 engine 数据面变更需 changeset**（contract-lexicon.json 随包发布）+ cdd-engine `dev:stub` 重跑；T6 统一建 changeset（osuperpowers major + cdd-engine patch）
- 每任务闭合面测试绿 + `pnpm run precommit` 绿；`pnpm run validate` 为终验（T6）
- emit 产物 = 派生（永不手工编辑）；T1/T2 合并组的改名面改动后立即 `pnpm run emit`

### Flow Atomicity

- 单任务/合并组原子：闭合前该面测试 + 相关 validate 面全绿；目录×name 双钉 / 三方一致 / 声称字面量 pin 破 = 设计漂移信号，报告 orchestrator 判定而非带伤闭合
- 串行 dispatch：`--tasks 1,2` → 3 → `--tasks 4,5` → 6（两组 merge 见 `## Task Groups`；T1/T2 与 T4/T5 各自同一原子单位）
- **T1/T2 必须同组**：改名面改动立即漂移 emit 产物（`.claude-plugin/`/`.cursor-plugin/`/`marketplace/` 以 `./skills/<dir>` 为键），分开 dispatch 中间态 emit:check 全链红
- **T4/T5 必须同组**：README 铺设即破既有声称 pin（presentation-surface 的 pair 声称面），pin 延展必须与铺设同时闭合

### 顺序原则

- T1/T2（改名原子单位：目录 + name + 引用 + 测试文件名 + 字面量 + emit 重生成）→ T3（markers 数据 + checkMarkers guard）→ T4/T5（README 铺设 + pin 延展，名义表消耗 T3 markers 数据）→ T6（changeset + validate 终验）
- T1 必为首：全仓后续引用全用新名；T3 先于 T4：名义表渲染依赖 `markers` 数据就位；T4 先于 T5（同组内）：pin 断言 README 产物

### 仓库纪律

- node：`fnm use`（.nvmrc）；引擎调用 `node packages/cdd-engine/dist/cli.mjs` 直调；引擎 `.mjs` plane zero（新增测试用 `.test.ts`/`.test.mjs`）
- language policy：代码/测试 English-primary（本计划 internal docs，中文豁免 Strategy B）；无 attribution trailers
- D2/D4 事实沿用：`pi` 字段源侧手维护 · `AI_AGENT=pi` 宿主检测（本 phase 零 engine 运行面改动）

### Task 1: cdd-* 身份改名全扫（目录 + name + 引用 + 测试文件名 + 字面量；与 Task 2 同组 dispatch）

- **Do**: 全仓改名原子面的机械主体：
  - **映射表（唯一权威）**：
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
  - **Step 1（基线枚举）**：`git grep -n -E 'brainstorming|writing-single-spec|writing-overall-spec|writing-phase-spec|writing-plans|cli-driven-development|finishing|report-issues'` 分面枚举全部落点（含文件名 `git ls-files | grep -E 'brainstorming|writing-…|cli-driven-development|finishing|report-issues'`）——区分 live 面（改）与历史正文（specs/plans 既有行、CHANGELOG、既有 changeset——**不改**）
  - **Step 2（目录重命名）**：`git mv` 8 目录按映射表执行（`skills/brainstorming/` → `skills/cdd-design/` …）；目录内嵌套文档随目录移动，**内部相对路径引用随改**（例：`skills/finishing/SKILL.md:24` 的 `../cli-driven-development/docs/base-branch.md` → `../cdd-dev/docs/base-branch.md`——以 grep 全量枚举 `..` 相对引用为准，不止此一例）
  - **Step 3（name 字段）**：8 个 `SKILL.md` front-matter `name:` 按映射表改；目录名 ≠ name 字段即失败（单身份 G1）
  - **Step 4（flow 内互引）**：8 个 SKILL.md 内 `/osuperpowers:<旧名>` 引用全部改为 `/osuperpowers:<新名>`（全 grep 枚举）；`/superpowers:*` / `/mattpocock-skills:*` 一字不动
  - **Step 5（测试文件名）**：含旧 skill 名的测试文件 git mv 随新名——已知：`packages/osuperpowers/tests/writing-plans-spec.test.mjs` → `cdd-plan-spec.test.mjs`；其余以 `git ls-files | grep` 枚举为准（`status-routing-convergence.test.mjs` / `review-loop-clean-tree.test.mjs` 等若内含旧名仅改内容、文件名无旧名不动）
  - **Step 6（测试/代码/文档字面量全扫）**：全仓 live 面旧名字符串/路径/标识符/声称字面量随改——已知面：`packages/osuperpowers/tests/*.mjs`（`status-routing-convergence` / `review-loop-clean-tree` / `writing-plans-spec`（即新 `cdd-plan-spec`）等的 `SKILLS_ROOT/<name>` 与 skill→review-loop 映射请以 grep 实态为准）、README 家族提及、CLAUDE.md 提及、docs/maintainers 提及、scripts 若有引用；**README 结构铺设（矩阵 / 名义表 / pi 段 / D5）不在本任务**（归 T4）——本任务只把既有提及改名
  - **Step 7（守卫一致性先落地处）**：`grep-sweep-regression.test.mjs` / `maintainers-docs.test.mjs` 若断言技能名集合也随新名更新（以读文件实态为准，不臆造）
  - **Step 8（验证）**：`git grep -n -E '(brainstorming|writing-single-spec|writing-overall-spec|writing-phase-spec|writing-plans|cli-driven-development|finishing|report-issues)'` 仅剩历史正文允许命中（specs/plans 既有行 + CHANGELOG + 既有 changeset——人工核对清单一致）；`pnpm run precommit`
- **验收**: `skills/` 下 8 目录名 == 各 `SKILL.md` `name:` == cdd-\* 八名集合（目录×name 双钉成立）；含旧名测试文件已全部 git mv（`git ls-files` 零旧名文件名）；live 面 `git grep` 旧名/旧目录零命中（历史正文除外）；改名后既有测试全绿（node:test + scripts vitest + engine vitest——engine 面若有引用随扫同落）；`pnpm run precommit` 绿（含 emit 新鲜——见 Task 2 同组闭合）
- **注**: 历史正文豁免清单以 Step 1 基线为实据，改动前先核对；`cdd-plan-spec.test.mjs` 等文件内既有断言随实态改（该技能身份已变）

### Task 2: emit 重生成（随改名原子单位）

- **Do**: Task 1 改名面落地后立即：
  - **Step 1**：`pnpm run emit`——重生成 `.claude-plugin/` / `.cursor-plugin/` / `marketplace/` / `source.json`（产物以 `./skills/<dir>` 为键，随目录改名）
  - **Step 2**：`pnpm run emit:check` 零漂移；产物核对：claude/cursor manifests + marketplace 含 `./skills/cdd-*` 路径 + 技能名列 cdd-\*
  - **Step 3**：`git add` 产物 + 随 T1 改名面一起提交（conventional `feat(osuperpowers): skills 改名 cdd-* — 目录/name/引用/测试/字面量全扫 + emit 重生成`）
- **验收**: `emit:check` 零漂移；产物含 `./skills/cdd-*` 目录引用 + cdd-\* 技能名；`pnpm run precommit` 绿
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
  - **Step 4（测试）**：`scripts/lib/__tests__/contract-lexicon.test.ts` 增 markers 用例——三方一致绿 · 每方单侧改异（lexicon 改 / detect 改 / env 白名单改）均 FAIL · env 白名单恰 4 键 pin（反例加第 5 键 FAIL）
  - **Step 5**：`pnpm --filter @oscaner-skills/cdd-engine dev:stub`（engine 数据面变更后承接）+ `pnpm run precommit`
- **验收**: `checkMarkers` 全绿（三方一致 + 单侧改异反例 + 4 键 pin）；lexicon vitest 全绿；validate step-9 块绿；`pnpm run precommit` 绿
- **注**: markers = engine 语义（归 lexicon engine 域）；技能名不归 engine（分层纪律——`cdd-*` 名单不进 lexicon）。D5 事实锚：pi detect = `AI_AGENT === "pi"`（`PI_CODING_AGENT=true` 佐证，零新键——复用 `AI_AGENT` 通道）

### Task 4: README 家族铺设（root + osuperpowers + 双镜像；与 Task 5 同组 dispatch）

- **Do**: 消费者文档面落地（消费 T1 改名面 + T3 markers 数据）：
  - **Step 1（root README）** `README.md`：
    - per-harness 安装表加 pi 行（`Pi` | `pi install npm:@oscaner-skills/osuperpowers`）
    - 新增 `### From pi` 小节：`pi install npm:@oscaner-skills/osuperpowers`（`@latest` 契约）· 安装后事实（八 skill 以 `cdd-*` 名可见 · project settings 写入）· **一行 cdd- 缘由**（pi 为 flat namespace 且无命名空间修饰语法，`cdd-*` bare-name 唯一性即最佳实践）
    - 技能清单/插件表内既有 `/osuperpowers:<旧名>` 提及更新为 `/osuperpowers:<新名>`
  - **Step 2（osuperpowers README）** `packages/osuperpowers/README.md`：
    - **名义映射表**替换手写 CDD engine CLI 表（`| Harness | CLI binary | Ship status |`——含 2 处 `cursor-agent` 手写行键的行）：新表列 = `标识符 | 二进制 | 宿主 marker | Ship`，数据从 contract-lexicon（`ids`/`clis`/`markers`）+ harness-registry `ship` 派生（零手写重复映射；`cursor-agent` 仅在二进制列作数据值出现）
    - pi 消费段（八 skill 以 `cdd-*` 名安装可见）
    - **D5 消费故事节**（「与 superpowers 并存」）：`cdd-*` 零冲突 by-construction（pi flat namespace 唯一命名）· inline import **harness 条件化**——claude/cursor 插件限定引用（`/superpowers:*`）可用且恒落属主包；pi 仅 `/skill:<bare-name>`，`cdd-*` 唯一性保证无歧义
  - **Step 3（双镜像）**：`README.zh-CN.md` + `packages/osuperpowers/README.zh-CN.md` 结构与 EN 同步（per-harness 表 + pi 小节 + 名义表 + D5 节）· 各文件镜像声明时间戳校准为 `2026-10-01`；`packages/cdd-engine/README.md` 不动
  - **Step 4**：`pnpm run precommit`
- **验收**: README 家族零 `cursor-agent`（豁免锚已废；二进制列数据值除外——名义表二进制列含 `cursor-agent` 属 registry `cli` 数据值，合法）；zh 双镜像结构 parallel + 声明时间戳 `2026-10-01`；名义表与 lexicon/registry 数据一致（人工过目 + T5 守卫）；pi 安装段含命令 + 安装后事实 + cdd- 缘由一行；D5 节含零冲突叙事 + harness 条件化语义；`pnpm run precommit` 绿
- **注**: pi 面引用用 `/skill:<name>` / 裸名（无 namespace 语法事实）；cdd-engine README 零增量（验收只要求零 cursor-agent 不要求加内容）

### Task 5: 测试 pin 延展（三文件 pin + 零新 step；与 Task 4 同组 dispatch）

- **Do**: 命名统一 / 名义表 / 声称面 pin（消费 T4 README 产物）：
  - **Step 1（presentation-surface）** `packages/osuperpowers/tests/presentation-surface.test.mjs` 延展：
    - harness 声称 = **verified triple**（`claude` / `cursor-agent` / `pi`）——README 家族只声称已验证三面（`P4.1` pin 升级）
    - **技能清单 == 目录扫描双钉**：README 声明的技能集合 == `skills/` 目录名 × 各 SKILL.md `name:`（恰 8 全 `cdd-*`，双钉不一致即 FAIL）
    - **名义表 == 数据派生**：README 名义表行 == lexicon（`ids`/`clis`/`markers`）+ registry（`ship`）派生期望
    - 保留 `/8 harnesses|Trae|Vibe|Kiro|OpenCode` 外国声称禁令；**零旧名 skill 身份残留**断言（README 声称面无 `brainstorming` 等旧名 skill 引称——上游 import 词法除外）
    - npm-source 解析风险残记录注释（承接 v1.21 登记）
  - **Step 2（pi-package）** `packages/osuperpowers/tests/pi-package.test.mjs` 延展：`pi.skills` glob 解析集 == 扫描集（恰 8 `cdd-*`，目录×name 双钉）——原五断言不变、新增集合断言
  - **Step 3**：零新 validate step（node:test 自动进 step-4 glob）；`ci-validate.test.mjs` 零改动；`pnpm run precommit`
- **验收**: `presentation-surface.test.mjs` / `pi-package.test.mjs` 全绿（triple + 清单双钉 + 名义派生 + 禁令 + pipeline 零残留 + pi 集合断言）；validate step-4 块绿；ci-validate 零扰动；`pnpm run precommit` 绿
- **注**: pin 只指 osuperpowers 面身份；`brainstorming` 作为词在上游 import（`/superpowers:brainstorming`）合法——不做词级禁（G2 精确保守）

### Task 6: changeset + validate 终验

- **Do**: 收口记录 + 终验：
  - **Step 1**：`.changeset/pi-harness-skill-rename.md`：`"@oscaner-skills/osuperpowers": major`——技能全量改名 `cdd-*`（8 skills 目录/name/引用三 harness invocation 面 breaking，flat-namespace 唯一命名零冲突）+ 消费故事；`major` 语义 = 0.x major → 1.0.0 首稳定
  - **Step 2**：`.changeset/pi-harness-markers.md`：`"@oscaner-skills/cdd-engine": patch`——contract-lexicon `markers` 域 + `checkMarkers` 三方一致守卫（增量面）
  - **Step 3**：`pnpm run validate` 全块全绿终验（13 块 + engine vitest + scripts vitest + node:test + residue + contract-lexicon）
  - **Step 4**：`pnpm run precommit`
- **验收**: 两个 changeset 文件在 `.changeset/` 且 bump 类型正确（osuperpowers `major` / cdd-engine `patch`）；`pnpm run validate` ALL PASS；`pnpm run precommit` 绿；四表回填一致（P4 收口 claim 归本 plan 提交后的 closeout，见注）
- **注**: 版本单源 `package.json` → emit 重 stamp（Version PR 流程承接 CHANGELOG）；P4 closeout 四表回填（phase spec / plan 列 → Done + overall change-history 行）在后续 writing-plans 收口 / finishing 流程执行，非本 plan 任务

## Task Groups

- **Task 1, 2**: 改名原子单位——身份全扫（目录 / name / 引用 / 测试文件名 / 字面量）与 emit 重生成不可分（改名即 emit 产物漂移，分开 dispatch 中间态 emit:check 全链红）
- **Task 4, 5**: README 铺设 + 其 pin——presentation-surface / pi-package pin 断言 README 产物（声称面 / 清单 / 名义表），同原子（README 铺完而 pin 未跟即为红）