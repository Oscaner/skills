# Pi Harness P4 — 技能改名 + 文档·测试·收口（Pi Harness P4: Skill Rename + Docs · Tests · Closeout）— Phase Spec

- **Version**: v1.0 · 2026-10-01
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming → writing-phase-spec)
- **Parent program**: [2026-09-27-pi-harness-overall.md v1.21](2026-09-27-pi-harness-overall.md)
- **Depends on**: P2（Done）· P3（Done）——见 parent overall 依赖图（P2 →(hard) P4、P3 →(hard) P4）

## Section 0: Incremental warning

本 spec 承诺恰好一个 phase（P4 技能改名 + 文档·测试·收口）。若实施中发现需要拆分 / 重排 P4 的工作，不是本文件的局部编辑——phase inventory 行、依赖边、change-history 行必须先回填 parent overall（backfill-as-version）再继续。P4 是程序收口 phase；P4 之后的程序级尾巴（release / Version PR / publish）归 release 流程，不在本 phase 的文档承诺内。

## Section 1: Constraints pointer

跨 phase 约定以 parent overall v1.21 为准（overall wins on conflict），本 phase 不重复表述，仅指针：
- **P4 破坏性变更授权**（Constraints）：技能全量改名 `cdd-*`——8 skills 三 harness breaking（changeset 记 major）· 允许破坏性变更 / 重写代码 / 重组目录 · 约束 = 高维思考 / 抽象统一 / 最佳实践 / 零技术债务
- **D5 事实（复核于 2026-10-01）**：pi 对同名 skill 按确定性 first-wins 处置（从不拒绝；败者静默丢弃 + warning）；**pi 无命名空间修饰技能引用**（仅 `/skill:<bare-name>`）→ 改名理由 = flat-namespace 下 bare-name 唯一性最佳实践，非「pi 不许同名」
- **D2 / D4**：`pi` 字段源侧手维护 · `AI_AGENT=pi` 宿主检测（P3 已闭环，本 phase 不动 engine 运行面）
- **命名机制授权**：SKILL.md `name` = 单一事实源 + 目录扫描守卫（README / 测试派生断言零手写名单）；不建镜像注册面
- **分层纪律**：技能名 = osuperpowers 包面（不归 engine lexicon）；harness markers = engine 语义（归 lexicon harness 域）——两域分居，Non-goal #2 不可破
- **消费面纯度**：SKILL.md 是零程序历史指令文档；改名 rationale / 决策历史只落本 spec 与 docs/maintainers，不进消费面
- 仓库 language policy / commit discipline / changeset 义务不因本 phase 变更

## Section 2: Design body

#### 2.1 目标与范围

P4 使 osuperpowers 的**技能身份**完成程序级统一：8 技能全量改名 `cdd-*`（三 harness invocation 面同步变，breaking），配套命名机制（SKILL.md `name` 单源 + 目录扫描守卫），并把 pi 身份落到消费者文档面（README 家族矩阵 + `pi install` 段 + 名义映射表数据渲染 + D5 消费故事改写），最后以测试延展 + changeset 收口。现状实证（grilling fact-finder）：README 家族 6 文件全线 pre-pi（零 `pi` / `pi-package` 提及，per-harness 表只有 claude/cursor 两行）；live 面 `cursor-agent` 恰好 2 处（osuperpowers README CDD engine CLI 表行键）；名义映射表任何位置不存在（只有 spec 承诺）；D5 故事零 live 呈现。范围外：engine 运行逻辑（detect / spawn / registry 面）零改动（P3 已闭环）；不合并 engine 与 emit 注册表（Non-goal #2）；不做结构性技能合并（3 个 writing-* 并 1 带 mode——裁定拒，rationale 见 2.2 C1 裁定备注）。

#### 2.2 组件

锚点图例：G = grilling 定案轮（G1 改名形态 · G2 命名机制 · G3 高维复核裁定 · G4 名义映射表 markers · G5 铺设面 · G6 测试 · G7 changeset）；编号非连续、非必经枚举；锚点仅供本 spec 内部溯源，Issue inventory 与 parent overall 均无对应登记（P4 issues ref = none）。

**C1 技能改名 `cdd-*`（G1·G3）** — 8 skills 三 harness 同步改名（breaking）：

| 现状（name） | 改名（name） | 角色 |
|---|---|---|
| brainstorming | `cdd-design` | 设计入口（消费上游 brainstorming 为基线） |
| writing-single-spec | `cdd-spec` | 收敛单 spec |
| writing-overall-spec | `cdd-charter` | 程序章程 |
| writing-phase-spec | `cdd-phase` | phase 增量 |
| writing-plans | `cdd-plan` | plan |
| cli-driven-development | `cdd-dev` | CLI 驱动的开发循环 |
| finishing | `cdd-close` | 收口 |
| report-issues | `cdd-report` | 内部 dev 工具 |

- 命名空间 `osuperpowers` 保留（claude/cursor 插件限定语法侧照常）；改的是 8 个 `SKILL.md` 的 `name:` 字段（= 三 harness 共享的身份 token）
- 机械范围：8× SKILL.md `name:` + flow digraph 内 `/osuperpowers:*` 互引 · `/superpowers:*` / `/mattpocock-skills:*` 上游 import **不动** · README 家族 ×4 · CLAUDE.md 提及面 · docs/maintainers 提及面 · 测试 · `pnpm run emit` 重生成（claude/cursor manifests + marketplace + `source.json`）
- **执行排序（地基纪律）**：改名最早落位——P4 实现首任务即 rename，其后文档 / 测试 / 守卫全部引用新名；旧名只在历史文献（既有 spec/plan/CHANGELOG 正文）留存为史实，live 面零旧名 skill 身份
- **裁定备注（G3 高维复核）**：3 个 writing-* 合并为 1 个带 mode 的写法**拒**——mode 参数重复 `cdd-design` 已有路由职责（program 状态天然决定产物类型），三个产物是方法论一等概念，合并把「写什么」从 invocation 面挪进内部条件分支，反统一；软散落不建镜像注册面（见 C2）；report-issues 保留为 cdd-report（已是 shipped skill + dogfooding 通道，移除是又一次消费面改动）

**C2 命名机制（G2）** — SKILL.md `name` = 单一事实源，守卫派生断言：
- **目录扫描与技术**：测试从 `packages/osuperpowers/skills/` 扫描各 SKILL.md front-matter `name:`，得到唯一事实集的「cdd-\* 八名命集」
- **presentation-surface.test.mjs 延展**：断言 README 技能清单 == 扫描命集（恰 8，全部 cdd-* 前缀）；README 名义表（C3）== lexicon 派生期望；harness 声称 = verified triple（claude / cursor-agent / pi）；保留 `/8 harnesses|Trae|Vibe|Kiro|OpenCode` 外国声称禁令
- **pi-package.test.mjs 延展**：`pi.skills` glob 解析集 == 扫描命集（包面 pin）
- **旧名残留 pin（精确保守）**：pin 只针对 osuperpowers 面 skill 身份——SKILL.md name / README 家族 / CLAUDE.md 显式技能引用零旧名；`brainstorming` 作为词在上游 import（`/superpowers:brainstorming`）合法，不做词级禁
- 拒绝：engine lexicon 技能域（分层错误——engine 不拥有 osuperpowers 技能名）；另建 skills-registry 镜像面（SKILL.md front-matter 即 canonical JSON，emit + 守卫即 renderer/verifier，镜像面 = 新漂移面）

**C3 名义映射表 + markers 数据（G4）** — engine 侧 lexicon harness 域增数据（**engine 语义归 lexicon，技能名归包面**——分层齐整）：
- `contract-lexicon.json` harness 域并列 `markers` 子对象：`claude: { env: CLAUDE_CODE_SESSION_ID, aiAgentPrefix: claude-code }` · `cursor: { env: CURSOR_TRACE_ID }` · `pi: { env: AI_AGENT, value: pi }`（与既有 `ids` / `clis` 镜像并列；`clis` 与 registry 的镜镜像既有 guard 强制相等，markers 域同样过 guard）
- `ContractLexiconGuard` 增 `checkMarkers`：markers ↔ `harness.ts` detect() 谓词 ↔ engine-config env 白名单（`[AI_AGENT, CLAUDE_CODE_SESSION_ID, CURSOR_TRACE_ID, PATH]` 恰 4 键不变）**三方一致**
- README 名义映射表（标识符/二进制/宿主 marker/ship）读 lexicon 数据派生——零手写重复映射；漂移守卫 = presentation-surface 延展断言
- registry 行内数据（`cli` / `ship`）继续作为二进制列与 ship 列的源；marker 列首次数据化

**C4 README 家族铺设（G5）** — 两级铺设 + 双镜像：
- **root README**：per-harness 安装表 + pi 行 + `From pi` 小节（`pi install npm:@oscaner-skills/osuperpowers`（`@latest` 契约）· 安装后八 skill 以 cdd-* 名可见 · project settings 写入）+ **一行 cdd- 缘由**（pi flat namespace 无限定语法 → bare-name 唯一性即最佳实践）+ 技能清单更新为 cdd-*
- **osuperpowers README**：名义映射表（C3 数据渲染，替换手写 CDD engine CLI 表——同时消灭 2 处 live `cursor-agent`）+ pi 消费段 + **D5 消费故事节**（「与 superpowers 并存」：`cdd-*` 零冲突 by-construction · inline import harness 条件化——claude/cursor 限定引用恒落属主包；pi 仅 bare name 且 `cdd-*` 唯一性保证无歧义）
- cdd-engine README 不动（验收只要求零 cursor-agent 不要求加内容）；双镜像（root + osuperpowers 各 zh 结构 parallel 同步 + 镜像声明时间戳校准——现存声明 09-26 早于文件 mtime 09-29，顺手校准）

**C5 测试·validate（G6，零新 step）** — 三文件延展，零新 validate step：
- `presentation-surface.test.mjs`：verified triple + 技能清单 == 扫描 + 名义表 == 数据派生 + 外国声称禁令（见 C2）
- `pi-package.test.mjs`：pi 字段集 == 扫描命集（原五断言延展）
- `scripts/lib/__tests__/contract-lexicon.test.ts`（vitest）：markers 三方一致 + README 漂移期望
- 接线：node:test 走 validate step-4 glob（自动携带）· lexicon guard 走 step-9 既有 CheckBlock（checkMarkers 为 guard 新方法，不增 step 名）· vitest 走 step-12 → **ci-validate.test.mjs 零扰动、pre-commit 子集面不变**；`pnpm run validate` 13 块全绿即验收
- **npm-source 解析风险登记（v1.21 承承接）**：pi 对 scoped 包 registry 层的接受 = 已知残余，测试·validate issue 行显式登记 + publish 前人工抽查动作归属（本 phase 不做 release 站，承接记录落 C5 测试文件注释或 maintainers 文档）

**C6 changeset / 收口（G7）**：
- osuperpowers changeset **major**（技能改名 = 消费者 breaking，发布面）——与既有 pending（manifest-pin minor）在 `changeset version` 合并结算 → **1.0.0 首稳定**（版本方案：0.x major → 1.0.0）
- cdd-engine changeset **patch**（markers 数据 + checkMarkers——增量面，独立记录；不与 command-contract major 并条——一条 changeset 一条叙事）
- CHANGELOG 行由 Version PR `changeset version` 流程生成（不手改）；root README 插件表零字面版本号（既有 probe 守卫）
- 版本单源：`package.json` → emit 重 stamp（overall 已记录此流）

#### 2.3 数据流

`skills/` SKILL.md `name`（单源）→ 目录扫描守卫（测试）→ README 清单 / pi 包面 pin；`contract-lexicon.json` `markers`（engine 数据）→ `checkMarkers` 三方一致 → README 名义表数据派生 + 漂移守卫；`cdd-*` 改名 → `pnpm run emit` 重生成 manifests / marketplace / source.json；changeset（major + patch）→ Version PR `changeset version && emit` → CHANGELOG + 版本重 stamp。

#### 2.4 错误与边界

- **改名 breaking 迁移**：README 与 changeset 各自明确新名 + breaking 声明；消费侧用户按新 invocation 面（`/osuperpowers:cdd-*`）调用
- **旧词残留 vs 上游 import**：`brainstorming` / `writing-plans` 等作为词合法出现于 `/superpowers:*` import 面——pin 精确到 osuperpowers 技能身份，词级禁会误伤
- **pi 无命名空间语法事实**：README 中 pi 面引用用 `/skill:<name>` / 裸名，不用 `/osuperpowers:<name>` 形式（该形式只在 claude/cursor 有语义）
- **markers 漂移**：detect() 或 engine-config 任一改面而 lexicon markers 未同步 → checkMarkers FAIL（anti-white-green，零静默）
- **双镜像**：zh 结构 parallel（既有声明机制）+ 时间戳校准；命名 pin 覆盖 EN 面，zh 结构自查依托 mirror 声明（该声明维护惯例写入 C4）
- emit 产物重生成必须在改名后立即执行且 `emit:check` 零漂移（CI/pre-commit 把关）

#### 2.5 测试

- 三文件延展（C5）：presentation-surface（声称 + 扫描 + 名义表）· pi-package（字段集）· contract-lexicon.test（markers 三方 + 漂移）
- 回归面：`pnpm run validate` 13 块全绿（含 engine vitest 1173+ / scripts 286+ / residue / contract-lexicon）+ precommit 全绿 + `emit:check` 零漂移
- 人工抽查（consumer 面）：publish 前 README pi 安装段 / 名义表渲染人工过一遍（npm-source 残余承接）

### Acceptance criteria

- `packages/osuperpowers/skills/*/SKILL.md` 全部 `name:` 为 cdd-* 八名集合（`cdd-design` / `cdd-spec` / `cdd-charter` / `cdd-phase` / `cdd-plan` / `cdd-dev` / `cdd-close` / `cdd-report`），flow 内 `/osuperpowers:*` 互引同步为新名，上游 import（`/superpowers:*` / `/mattpocock-skills:*`）不变
- `.claude-plugin/` / `.cursor-plugin/` / `marketplace/` emit 产物重生成后含改名后技能清单，`emit:check` 零漂移
- 文档标识符面（README 家族 + CLAUDE.md + docs/maintainers live 档）零 `cursor-agent`（豁免锚已废，历史正文即史实）
- 名义映射表 = 数据渲染：README 表与 lexicon markers / registry 数据一致（presentation-surface 漂移守卫绿）；`checkMarkers` 三方一致（markers ↔ detect() ↔ engine-config）绿
- D5 消费故事交付：README 含 cdd-* 零冲突 by-construction 说明 + inline import harness 条件化语义（claude/cursor 限定引用恒落属主包 · pi 纯 bare name 唯一）
- `presentation-surface.test.mjs` / `pi-package.test.mjs` / `contract-lexicon.test.ts` 三文件 pin 全绿（verified triple + 技能清单 == 目录扫描 + markers 三方 + 名义表漂移；外国声称禁令保留）
- 双镜像同步：root + osuperpowers 各 zh 结构 parallel + 镜像声明时间戳校准
- `pnpm run precommit` 与 `pnpm run validate` 全块全绿（零新 validate step；ci-validate 零扰动）
- osuperpowers changeset（major）+ cdd-engine changeset（patch）已建；CHANGELOG 记录由 Version PR 流程承接
- P4 closeout 时四表回填一致（phase spec / plan 列 → Done，change-history v1.22+ 行）

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| overall v1.19 D5 消费故事「first-wins 包序 override 语义」 | 用户拍板全量改名 `cdd-*` + 消费故事改写（零冲突 by-construction + inline import harness 条件化）；命名空间 `osuperpowers` 保留 | Yes — v1.20 · 2026-10-01 |
| overall v1.19 名义映射表「registry 数据渲染」 | marker 数据入 lexicon harness 域（`ids`/`clis` 既在，`markers` 域新增）+ `checkMarkers` 三方一致；README 从 lexicon 数据派生 | Yes — v1.20 · 2026-10-01 |
| overall v1.19 命名假设「技能名无 harness 性、重命名不构成统一」 | 该 Non-goal 行随 v1.20 改写为「技能名零冲突由构造保证（cdd-* 唯一命名）」——pi flat namespace 事实使唯一命名成为最佳实践 | Yes — v1.20 · 2026-10-01 |

无未回填偏差——全部 grilling 定案已随 overall v1.20 sync-before-write + v1.21 review-fix 落地。

## Section 4: Notes for downstream

- **程序收口**：P4 后无规划 phase；release 流程（Version PR / publish / tags）承接 changeset + CHANGELOG + emit 重 stamp，本 phase 不建 release 站（v1.4 裁定一致）
- **命名纪律延续**：任何未来新增 osuperpowers skill 必须沿用 `cdd-*` 命名（flat-namespace 唯一性纪律）；SKILL.md `name` 增删即目录扫描守卫自动覆盖
- **#302（独立 single-spec 程序）**：Review Convergence 判读规则改动归其 spec；本 phase 不触碰
- **npm-source 解析风险**：pi 对 scoped 包 registry 层的接受 = 已知残余，publish 前人工抽查承接（C5 记录）
- **双镜像声明时间戳**：每次 README 家族编辑后校准声明时间戳（维护惯例提醒）

## Section 5: Review

Fresh-subagent review passes on the committed baseline, then user review, then writing-plans. Review Convergence（I1）：blocker > 0 → fix 全 findings 后 re-review；blocker = 0 → fix 全 findings → done（不再 re-review）。Entry 前树必须 clean（engine entry gate）。