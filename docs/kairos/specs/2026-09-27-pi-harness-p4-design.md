# Pi Harness P4 — 技能改名 + 命名退役 + 文档·测试·收口（Pi Harness P4: Skill Rename + Naming Retirement + Docs · Tests · Closeout）— Phase Spec

- **Version**: v1.6 · 2026-10-01（契约收敛定稿 C8：registry 唯一 harness 契约 + lexicon 纯词表 + checkHarness + cdd-init-ready 数据面；C7 布局与 C8 收敛同组 atomic，布局先行；v1.5 的 T7 pi prefix / T8 布局历史表述并入）
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming → writing-phase-spec)
- **Parent program**: [2026-09-27-pi-harness-overall.md v1.22](2026-09-27-pi-harness-overall.md)
- **Depends on**: P2（Done）· P3（Done）——见 parent overall 依赖图（P2 →(hard) P4、P3 →(hard) P4）

## Design
### 2. 技能改名 + 命名退役 + 收口设计
#### 2.1 目标与范围

P4 使 kairos（前 osuperpowers）的**技能身份**完成程序级统一：8 技能全量改名 `cdd-*`（含 `skills/` 目录名——单身份零债务，user 裁定；三 harness invocation 面同步变，breaking），配套命名机制（SKILL.md `name` 单源 + 目录扫描守卫），并把 pi 身份落到消费者文档面（README 家族矩阵 + `pi install` 段 + 名义映射表数据渲染 + D5 消费故事改写），最后以测试延展 + changeset 收口。现状实证（grilling fact-finder）：README 家族 6 文件全线 pre-pi（零 `pi` / `pi-package` 提及，per-harness 表只有 claude/cursor 两行）；live 面 `cursor-agent` 系 osuperpowers README CDD engine CLI 表行（EN `README.md:72` + zh 镜像 `README.zh-CN.md:74` 同形，共 4 token）；名义映射表任何位置不存在（只有 spec 承诺）；D5 故事零 live 呈现。范围外：engine 运行逻辑（detect / spawn / registry 面）零改动（P3 已闭环）；不合并 engine 与 emit 注册表（Non-goal #2）；不做结构性技能合并（3 个 writing-* 并 1 带 mode——裁定拒，rationale 见 2.2 C1 裁定备注）。**范围增项（v1.5/v1.6 backfill-after-discussion，user 2026-10-01 拍板）**：① engine 静态数据面重组（C7）——配置·注册表·词汇·契约·schema JSON 收编为 `config/` 单一数据家，`templates/` 只留内容渲染种子（`report/issue-body.json`），`resolveResource()` 唯一路径真相（dev 树 ↔ dist 打包树同构、零路径分叉零散落硬编码）；② **harness 契约收敛（C8）**——registry 行增 detect/install/refs、prefix 删除改派生、lexicon 瘦身为纯词表、守卫泛化 `checkHarness`、SKILL 文本与 README 照数据渲染；C7 与 C8 同组 atomic（布局先行，T8 为 T7 提供 config/ 之家），`cdd init` 未来消费同一契约。

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

- 命名空间 `osuperpowers` 随命名退役改 **`kairos`**（overall v1.22——门面品牌 = 呈现 cdd 实践）；改名 = **`skills/` 目录名 + 8 个 `SKILL.md` 的 `name:` 字段 + 引用面**（单身份：目录名 == `name:` == 三 harness invocation token——user 2026-10-01 裁定「不留任何债务」，v1.1 评审 agent「目录名保持不变」案推翻）。机械范围：8 目录 `git mv`（`skills/brainstorming/` → `skills/cdd-design/` 等）+ `name:` 字段 + 引用面——既有测试目录路径引用（`status-routing-convergence.test.mjs` 按 `SKILLS_ROOT/<name>/SKILL.md` 读 · `writing-plans-spec.test.mjs` 读 `skills/writing-plans/SKILL.md` · `review-loop-clean-tree.test.mjs` 的 skill→review-loop 映射）与 `finishing/SKILL.md:24` 相对路径 `../cli-driven-development/docs/base-branch.md` → `../cdd-dev/docs/base-branch.md` 及跨技能相对引用随改；**plan 阶段以全仓 grep 枚举全部目录/路径引用**（`skills/<dir>` / `..` 相对引用）清单化随行 · **全仓测试 / 文件名 / 字面量同步（user 2026-10-01 全改令）**：所有 test 文件（文件名内嵌旧 skill 名者随名重命名——如 `writing-plans-spec.test.mjs` → `cdd-plan-spec.test.mjs`）+ 测试/代码/文档内全部字面量（旧名字符串 / 路径 glob / 标识符 / 声称字面量）随改名面一起改
- **包身份退役（user 2026-10-01 拍板）**：插件包 `osuperpowers` → `kairos` 全 token 扫（npm 名 `@oscaner-skills/kairos` · namespace `/kairos:` · marketplace/source.json · 安装命令 · README 家族 · release 流 matrix/tag_prefix · pending changeset 包字段重定向 · pnpm-lock 重写 · scripts 标识符 `osuperpowersPkg/Row/Steps/Versions/Osc/Src/Entry/Bump` + validate step 名「osuperpowers…」+ ci-validate name-set + emitter 产物 + `.github/` 面（actions/validate 注释路径 · ISSUE_TEMPLATE 技能 label））+ 程序文档树 `docs/osuperpowers/` → `docs/kairos/` + engine workspace 根 `.osuperpowers/` → `.kairos`（`engine-config.json#handoffNamespace.workspaceRoot` 单源 · 根 `.gitignore` · biome includes · engine tests/comments 33 文件）· **三目录在改名任务内 `git mv` 直迁（零迁移机制、零存量处理；存量 `.osuperpowers/` 磁盘态 = gitignored 惰性）** · `cdd` / `cdd-engine` / CLI 保留 · live 面零 `osuperpowers`（历史正文不 retro-rename）
- 机械范围：8× SKILL.md `name:` + flow digraph 内 `/kairos:*` 互引（前缀随命名空间退役）· `/superpowers:*` / `/mattpocock-skills:*` 上游 import **不动** · README 家族 ×4 · CLAUDE.md 提及面 · docs/maintainers 提及面 · 测试 · `pnpm run emit` 重生成（claude/cursor manifests + marketplace + `source.json`）
- **执行排序（地基纪律）**：改名最早落位——P4 实现首任务即 rename，其后文档 / 测试 / 守卫全部引用新名；旧名只在历史文献（既有 spec/plan/CHANGELOG 正文）留存为史实，live 面零旧名 skill 身份
- **裁定备注（G3 高维复核）**：3 个 writing-* 合并为 1 个带 mode 的写法**拒**——mode 参数重复 `cdd-design` 已有路由职责（program 状态天然决定产物类型），三个产物是方法论一等概念，合并把「写什么」从 invocation 面挪进内部条件分支，反统一；软散落不建镜像注册面（见 C2）；report-issues 保留为 cdd-report（已是 shipped skill + dogfooding 通道，移除是又一次消费面改动）

**C2 命名机制（G2）** — SKILL.md `name` = 单一事实源，守卫派生断言：
- **目录扫描与技术**：测试从 `packages/kairos/skills/`（目录迁移后）扫描，**目录名 == 各 SKILL.md front-matter `name:` == cdd-* 八名集合（目录/字段双钉死，不一致即 FAIL）**——单身份由目录与字段两侧同时保证
- **presentation-surface.test.mjs 延展**：断言 README 技能清单 == 扫描命集（恰 8，全部 cdd-* 前缀）；README 名义表（C3）== lexicon 派生期望；harness 声称 = verified triple（claude / cursor / pi）；保留 `/8 harnesses|Trae|Vibe|Kiro|OpenCode` 外国声称禁令
- **pi-package.test.mjs 延展**：`pi.skills` glob 解析集 == 扫描命集（包面 pin）
- **旧名残留 pin（精确保守）**：pin 只针对 kairos 面 skill 身份——SKILL.md name / README 家族 / CLAUDE.md 显式技能引用零旧名；`brainstorming` 作为词在上游 import（`/superpowers:brainstorming`）合法，不做词级禁
- 拒绝：engine lexicon 技能域（分层错误——engine 不拥有 kairos 技能名）；另建 skills-registry 镜像面（SKILL.md front-matter 即 canonical JSON，emit + 守卫即 renderer/verifier，镜像面 = 新漂移面）

**C3 名义映射表 + markers 数据（G4）** — engine 侧 lexicon harness 域增数据（**engine 语义归 lexicon，技能名归包面**——分层齐整）：
- `contract-lexicon.json` harness 域并列 `markers` 子对象：`claude: { env: CLAUDE_CODE_SESSION_ID, aiAgentPrefix: claude-code }` · `cursor: { env: CURSOR_TRACE_ID }` · `pi: { env: AI_AGENT, value: pi }`（与既有 `ids` / `clis` 镜像并列；`clis` 与 registry 的镜像既有 guard 强制相等，markers 域同样过 guard）
- `ContractLexiconGuard` 增 `checkMarkers`：markers ↔ `harness.ts` detect() 谓词 ↔ engine-config env 白名单（`[AI_AGENT, CLAUDE_CODE_SESSION_ID, CURSOR_TRACE_ID, PATH]` 恰 4 键不变）**三方一致**
- README 名义映射表（标识符/二进制/宿主 marker/ship）读 lexicon 数据派生——零手写重复映射；漂移守卫 = presentation-surface 延展断言
- registry 行内数据（`cli` / `ship`）继续作为二进制列与 ship 列的源；marker 列首次数据化

**C4 README 家族铺设（G5）** — 两级铺设 + 双镜像：
- **root README**：per-harness 安装表 + pi 行 + `From pi` 小节（`pi install npm:@oscaner-skills/kairos`（`@latest` 契约）· 安装后八 skill 以 cdd-* 名可见 · project settings 写入）+ **一行 cdd- 缘由**（pi flat namespace 无限定语法 → bare-name 唯一性即最佳实践）+ 技能清单更新为 cdd-*
- **kairos README**（`packages/kairos/README.md`）：名义映射表（C3 数据渲染，替换手写 CDD engine CLI 表——消灭 EN + zh 镜像共 4 token live `cursor-agent`）+ pi 消费段 + **D5 消费故事节**（「与 superpowers 并存」：`cdd-*` 零冲突 by-construction · inline import harness 条件化——claude/cursor 限定引用恒落属主包；pi 仅 bare name 且 `cdd-*` 唯一性保证无歧义）
- cdd-engine README 不动（验收只要求零 cursor-agent 不要求加内容）；双镜像（root + kairos 各 zh 结构 parallel 同步 + 镜像声明时间戳校准——root 声明 09-26 早于其 mtime 09-29、kairos 声明 09-26 早于其 mtime 09-27，两处声明均早于各自文件 mtime，顺手校准）

**C5 测试·validate（G6，零新 step）** — 三文件延展，零新 validate step：
- `presentation-surface.test.mjs`：verified triple + 技能清单 == 扫描 + 名义表 == 数据派生 + 外国声称禁令（见 C2）
- `pi-package.test.mjs`：pi 字段集 == 扫描命集（原 4 测试块延展）
- `scripts/lib/__tests__/contract-lexicon.test.ts`（vitest）：markers 三方一致 + README 漂移期望
- 接线：node:test 走 validate step-4 glob（自动携带）· lexicon guard 走 step-9 既有 CheckBlock（checkMarkers 为 guard 新方法，不增 step 名）· vitest 走 step-12 → **ci-validate 编排断言零新 step（assertion-set 随包身份 token 扫改名——step 名「osuperpowers…」→「kairos…」，非文件禁改）、pre-commit 子集面不变**；`pnpm run validate` 13 块全绿即验收
- **npm-source 解析风险登记（v1.21 承接）**：pi 对 scoped 包 registry 层的接受 = 已知残余，测试·validate issue 行显式登记 + publish 前人工抽查动作归属（本 phase 不做 release 站，承接记录落 C5 测试文件注释或 maintainers 文档）

**C6 changeset / 收口（G7）**：
- kairos changeset **major**（技能改名 + 命名退役 = 消费者 breaking，发布面）——pending changeset（manifest-pin）包字段重定向 `@oscaner-skills/kairos`，在 `changeset version` 合并结算 → **1.0.0 首稳定**（版本方案：0.x major → 1.0.0）
- cdd-engine changeset **patch**（markers 数据 + checkMarkers——增量面，独立记录；不与 command-contract major 并条——一条 changeset 一条叙事）
- CHANGELOG 行由 Version PR `changeset version` 流程生成（不手改）；root README 插件表零字面版本号（既有 probe 守卫）
- 版本单源：`package.json` → emit 重 stamp（overall 已记录此流）

**C7 engine 静态数据面重组（v1.5 backfill-after-discussion，user 2026-10-01 拍板）** — 配置/注册表/schema 收编 + 唯一路径真相：
- **二进制分类原则**：静态 JSON 只二类——**读作数据**（engine/scripts 原样读）vs **渲染/拷贝产物种子**（engine 渲染或 emit 拷贝出去）；左者归 `config/`，右者留 `templates/`
- **`config/` 家（唯一静态数据家）**：`engine-config.json`（运行时配置）· `harness-registry.json`（harness 注册表——dev 树与 dist 打包树同构，消灭既有 `src/infra/` vs `dist/resources/` 路径分叉）· `contract-lexicon.json`（词汇表单源）· `template-contract.json`（dispatch 契约注册表）· `schema/` 子目 = **全部 JSON Schema**（doc 5：overall/phase-spec/plan/add-phase-protocol/skill-anatomy + handoff 2：task/docs + cache-profile——从 `src/documents/schema/` 与 `templates/schema/` 两处毕业归一；doc word = code word = engine token：词汇表与 doc schema 同族同家）
- **`templates/` 纯净**：仅内容种子（`report/issue-body.json` 渲染出 gh ISSUE_TEMPLATE + `cdd issue render`）
- **`resolveResource()` 唯一路径真相**：`src/infra/resource.ts` 的 `resolvePackageRoot` 升级为 logical-name → path 决议（logical name 表 = 唯一路径真相，dev 树与 dist 打包树同构镜像）；engine 六消费点 `path.join(resolvePackageRoot(__dirname), …)`（config.ts / registry.ts / render/templates.ts / documents/schema.ts / rules/schema.ts / domain/issue-renderer.ts）全收编；smoke-cdd tarball pin / residue 路径 pin / scripts/lib/contract-lexicon 数据源全改为**从 locator 数据派生**（零第二份字面路径）
- 构建/发布面：`package.json#files` 发 `config/` + `templates/`（内容种子）+ `dist/`；构建把 config 镜像到 dist/config，删除旧 `dist/resources` 分叉
- 范围口径：纯内部结构重组——消费者 CLI 面零变化、registry/lexicon 数据语义零变化；与 C8 契约收敛（T7）**同组 atomic**（布局先行，本 C7 为 C8 提供 config/ 之家与 resolveResource 底座）；cdd-engine patch 级（T6 changeset 覆盖，无需新 changeset）；文件名保留（`schema/` 子目内 `-schema` 词缀冗余为显式非变更）

**C8 harness 契约收敛（v1.6 backfill-after-discussion，user 2026-10-01）** — 把「如何适配宿主」收敛为一张契约：
- **registry = 唯一 harness 契约**：行增 `detect`（markers 自 lexicon 回迁：claude/cursor/pi 各 env marker + value，engine-config env 白名单恰 4 键不变）· `install`（per-pkg 安装旌：kairos 自装 + superpowers / mattpocock-skills / impeccable 上游——用户 2026-10-01 提供命令，claude/cursor/pi 各列；cursor 列 pending 同 cache 先例不虚报）· `refs`（per `<pkg>:<skill>` 引用形态：上游 brainstorming/writing-plans/grilling/finishing-a-development-branch/tdd/code-review + kairos cdd-* 内部互引；claude/cursor = `/ns:name`，pi = `/skill:<bare>`——D5 事实）· **prefix 删除 → 派生**（dispatch-slot → ref key；pi 行 prefix = refs 派生自动 `/skill:` 正确——T7 前身 pi-prefix 修正并入）
- **lexicon 瘦身为纯词表**：删 `harness` 域（ids/clis/markers 全回迁 registry 单源——ids/clis 是 guard 维持的镜像对偶，删 = 净简化）；status/stdout/residue/anatomy 不动
- **守卫泛化 `checkHarness`**：detect ↔ `detect()` 谓词 ↔ engine-config env 白名单 · refs ↔ SKILL 文本 26 处双形态 · prefix 派生 ↔ 实际注入 · install ↔ README 上游依赖表——markers 三方一致只是其一实例（checkMarkers 融入）
- **面向未来**：`cdd init`（未来 phase，不在 P4）消费同一契约——detect 宿主 → install 按行执行 → scaffold；P4 只落数据 + Schema + 守卫 + 渲染，init 子命令 + charter zero-new-subcommands 例外修订归 init 自己的 phase
- **re-anchor 面**：T3 markers 数据家换（lexicon → registry.detect）+ T4/T5 pin 源换（presentation-surface 名义表 / contract-lexicon.test checkMarkers）——机械面，测试兜底
- **边界**：emit 分发注册表（`scripts/lib/harness-registry.ts`）不并入（Non-goal #2）——分发产物构建面 vs 运行时契约面，C7 以 `harness-contract.json` 命名消歧

#### 2.3 数据流

`skills/` SKILL.md `name`（单源）→ 目录扫描守卫（测试）→ README 清单 / pi 包面 pin；`contract-lexicon.json` `markers`（engine 数据）→ `checkMarkers` 三方一致 → README 名义表数据派生 + 漂移守卫；`cdd-*` 改名 → `pnpm run emit` 重生成 manifests / marketplace / source.json；changeset（major + patch）→ Version PR `changeset version && emit` → CHANGELOG + 版本重 stamp。

#### 2.4 错误与边界

- **改名 breaking 迁移**：README 与 changeset 各自明确新名 + breaking 声明；消费侧用户按新 invocation 面（`/kairos:cdd-*`）调用；`osuperpowers` → `kairos` 迁移零存量机制——实现当时 `git mv` 直迁
- **旧词残留 vs 上游 import**：`brainstorming` / `writing-plans` 等作为词合法出现于 `/superpowers:*` import 面——pin 精确到 kairos 技能身份，词级禁会误伤
- **pi 无命名空间语法事实**：README 中 pi 面引用用 `/skill:<name>` / 裸名，不用 `/kairos:<name>` 形式（该形式只在 claude/cursor 有语义）
- **markers 漂移**：detect() 或 engine-config 任一改面而 lexicon markers 未同步 → checkMarkers FAIL（anti-white-green，零静默）
- **双镜像**：zh 结构 parallel（既有声明机制）+ 时间戳校准；命名 pin 覆盖 EN 面，zh 结构自查依托 mirror 声明（该声明维护惯例写入 C4）
- emit 产物重生成必须在改名后立即执行且 `emit:check` 零漂移（CI/pre-commit 把关）

#### 2.5 测试

- 三文件延展（C5）：presentation-surface（声称 + 扫描 + 名义表）· pi-package（字段集）· contract-lexicon.test（markers 三方 + 漂移）
- 回归面：`pnpm run validate` 13 块全绿（含 engine vitest 1173+ / scripts 286+ / residue / contract-lexicon）+ precommit 全绿 + `emit:check` 零漂移
- 人工抽查（consumer 面）：publish 前 README pi 安装段 / 名义表渲染人工过一遍（npm-source 残余承接）

### Acceptance criteria

- `packages/kairos/skills/`（目录迁移后）下 8 目录重命名（`brainstorming/`→`cdd-design/` 等），各 `SKILL.md` `name:` == 目录名 == cdd-* 八名集合（`cdd-design` / `cdd-spec` / `cdd-charter` / `cdd-phase` / `cdd-plan` / `cdd-dev` / `cdd-close` / `cdd-report`），目录/字段双钉死守卫生；flow 内 `/kairos:*` 互引同步为新名，上游 import（`/superpowers:*` / `/mattpocock-skills:*`）不变；全仓 grep 零旧目录/旧名 skill 路径引用与字面量（含 test 文件名内嵌旧名——`writing-plans-spec.test.mjs` → `cdd-plan-spec.test.mjs` 等；历史正文除外）
- 两目录 `git mv` 迁移完成（`packages/osuperpowers/` → `packages/kairos/` · `docs/osuperpowers/` → `docs/kairos/`）＋ engine workspace 根 `.osuperpowers` → `.kairos`（engine-config workspaceRoot 单源值改迁 + 三面同步，存量磁盘态惰性不动）——零迁移机制、零存量处理；live 面零 `osuperpowers`（历史正文即史实不 retro-rename）
- `.claude-plugin/` / `.cursor-plugin/` / `marketplace/` emit 产物重生成（插件名/contentRoot/source 等 token 随包身份改；产物 skills 引用 = `./skills/` glob、不逐目录列举）后 `emit:check` 零漂移
- 文档标识符面（README 家族 + CLAUDE.md + docs/maintainers live 档）零 `cursor-agent`（豁免锚已废，历史正文即史实）
- 名义映射表 = 数据渲染：README 表与 lexicon markers / registry 数据一致（presentation-surface 漂移守卫绿）；`checkMarkers` 三方一致（markers ↔ detect() ↔ engine-config）绿
- D5 消费故事交付：README 含 cdd-* 零冲突 by-construction 说明 + inline import harness 条件化语义（claude/cursor 限定引用恒落属主包 · pi 纯 bare name 唯一）
- `presentation-surface.test.mjs` / `pi-package.test.mjs` / `contract-lexicon.test.ts` 三文件 pin 全绿（verified triple + 技能清单 == 目录扫描 + markers 三方 + 名义表漂移；外国声称禁令保留）
- 双镜像同步：root + kairos 各 zh 结构 parallel + 镜像声明时间戳校准
- `pnpm run precommit` 与 `pnpm run validate` 全块全绿（零新 validate step；ci-validate 编排断言零新 step，assertion-set 随 token 扫改名）
- kairos changeset（major）+ cdd-engine changeset（patch）已建（pending manifest-pin 包字段重定向 `@oscaner-skills/kairos`）；CHANGELOG 记录由 Version PR 流程承接
- P4 closeout 时四表回填一致（phase spec / plan 列 → Done，change-history v1.22+ 行）
- **engine 静态数据面重组（v1.5 增）**：`config/` 落位（读作数据全归位——engine-config / harness-contract / contract-lexicon / template-contract + `schema/` 子目全部 JSON Schema：doc 5 / handoff 2 / cache-profile）且 `templates/` 仅含内容种子（issue-body.json）；`resolveResource()` = 唯一路径真相——engine 六消费面零散落 `path.join(pkgRoot, "…")` 硬编码、smoke-cdd / residue / contract-lexicon pin 全从 locator 数据派生、dev 树 ↔ dist 打包树 `config/` 同构（旧 `dist/resources` 零残留）；`package.json#files` 随发 config；engine/scripts 测试 + precommit 全绿（T6 终验兜）
- **harness 契约收敛（v1.6 增）**：registry = 唯一 harness 契约（行含 detect/install/refs · prefix 零字面改派生 · cli 单源）；lexicon 纯词表（harness 域零残留）；`checkHarness` 四向全绿（detect ↔ 谓词 ↔ 白名单 · refs ↔ SKILL 文本 26 处双形态 · prefix 派生 ↔ 注入 · install ↔ README 渲染）；SKILL 文本引用全双形态 + 零裸 `/ns:name` 残留（pin）；README 上游依赖表 = install/refs 数据渲染零手写（用户提供命令只此一份）；T3/T4/T5 交付面 re-anchor 全绿（presentation-surface 名义表数据源 lexicon→registry · checkMarkers 家换）；`cdd init` 就绪（未来 phase 消费同一契约）

## Constraints

- 跨 phase 约定以 parent overall v1.22 为准（overall wins on conflict），本 phase 不重复表述，仅指针：
- **P4 破坏性变更授权**（Constraints v1.22）：技能全量改名 `cdd-*`——8 skills 三 harness breaking（changeset 记 major）· **命名全面退役 `osuperpowers` → `kairos`**：插件包 `@oscaner-skills/kairos` / namespace `/kairos:` / workspace 根 `.kairos`（engine-config 单源）/ 程序文档树 `docs/kairos/` —— `cdd`·`cdd-engine`·CLI 保留（方法论层）；**零存量迁移**（实现当时 `git mv` 直迁，不建迁移机制）· 允许破坏性变更 / 重写代码 / 重组目录 · 约束 = 高维思考 / 抽象统一 / 最佳实践 / 零技术债务
- **D5 事实（复核于 2026-10-01）**：pi 对同名 skill 按确定性 first-wins 处置（从不拒绝；败者静默丢弃 + warning）；**pi 无命名空间修饰技能引用**（仅 `/skill:<bare-name>`）→ 改名理由 = flat-namespace 下 bare-name 唯一性最佳实践，非「pi 不许同名」
- **D2 / D4**：`pi` 字段源侧手维护 · `AI_AGENT=pi` 宿主检测（P3 已闭环，本 phase 不动 engine 运行面）
- **命名机制授权**：SKILL.md `name` = 单一事实源 + 目录扫描守卫（README / 测试派生断言零手写名单）；不建镜像注册面
- **分层纪律**：技能名 = kairos 包面（不归 engine lexicon）；harness markers = engine 语义（归 lexicon harness 域）——两域分居，Non-goal #2 不可破
- **消费面纯度**：SKILL.md 是零程序历史指令文档；改名 rationale / 决策历史只落本 spec 与 docs/maintainers，不进消费面
- 仓库 language policy / commit discipline / changeset 义务不因本 phase 变更

## Deviations

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| overall v1.19 D5 消费故事「first-wins 包序 override 语义」 | 用户拍板全量改名 `cdd-*` + 消费故事改写（零冲突 by-construction + inline import harness 条件化） | Yes — v1.20 · 2026-10-01 |
| overall 命名假设「命名空间 `osuperpowers` 保留 / 插件包身份 `@oscaner-skills/osuperpowers`」 | P4 命名全面退役 `kairos`（插件包 `@oscaner-skills/kairos` / namespace `/kairos:` / workspace 根 `.kairos` / 程序文档树 `docs/kairos/`） | Yes — v1.22 · 2026-10-01 |
| overall v1.19 名义映射表「registry 数据渲染」 | marker 数据入 lexicon harness 域（`ids`/`clis` 既在，`markers` 域新增）+ `checkMarkers` 三方一致；README 从 lexicon 数据派生 | Yes — v1.20 · 2026-10-01 |
| overall v1.19 命名假设「技能名无 harness 性、重命名不构成统一」 | 该 Non-goal 行随 v1.20 改写为「技能名零冲突由构造保证（cdd-* 唯一命名）」——pi flat namespace 事实使唯一命名成为最佳实践 | Yes — v1.20 · 2026-10-01 |

无未回填偏差——全部 grilling 定案已随 overall v1.20 sync-before-write + v1.21 review-fix 落地，命名退役（user 拍板）随 v1.22 单项回填。

## Notes for downstream

- **程序收口**：P4 后无规划 phase；release 流程（Version PR / publish / tags）承接 changeset + CHANGELOG + emit 重 stamp，本 phase 不建 release 站（v1.4 裁定一致）
- **命名纪律延续**：任何未来新增 kairos skill 必须沿用 `cdd-*` 命名（flat-namespace 唯一性纪律）；SKILL.md `name` 增删即目录扫描守卫自动覆盖
- **#302（独立 single-spec 程序）**：Review Convergence 判读规则改动归其 spec；本 phase 不触碰
- **npm-source 解析风险**：pi 对 scoped 包 registry 层的接受 = 已知残余，publish 前人工抽查承接（C5 记录）
- **双镜像声明时间戳**：每次 README 家族编辑后校准声明时间戳（维护惯例提醒）
