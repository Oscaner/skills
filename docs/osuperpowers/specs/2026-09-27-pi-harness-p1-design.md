# Pi Harness P1 — 包侧 pi 分发面（Pi Harness P1: Package-Side Pi Distribution Surface）— Phase Spec

- **Version**: v1.3 · 2026-09-27
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming → writing-phase-spec)
- **Parent program**: [2026-09-27-pi-harness-overall.md v1.3](2026-09-27-pi-harness-overall.md)
- **Depends on**: 无（program 起点）

## Section 0: Incremental warning

本 spec 承诺恰好一个 phase（P1 包侧 pi 分发面）。若实施中发现需要拆分 / 重排 P1 的工作，不是本文件的局部编辑——phase inventory 行、依赖边、change-history 行必须先回填 parent overall（backfill-as-version）再继续。P1 之后的 phase（P2 emit 注册表 / P3 engine 数据面 / P4 文档收口）各归其 spec。

## Section 1: Constraints pointer

跨 phase 约定以 parent overall v1.3 为准（overall wins on conflict），本 phase 不重复表述，仅指针：
- **D2 源侧手维护**：`pi` 字段与 `version`/`description`/`files` 同源，emit 产物面零新增（pi 无独立 manifest 文件）
- **D4 事实/规则**：`AI_AGENT=pi` 即宿主检测，检测链路归 P3；本 phase 零运行时扩展、零 peerDependencies
- **harness 命名统一**：`claude` / `cursor` / `pi`（`cursor-agent` 退役归 P3）
- **开发期引擎直调** `node packages/cdd-engine/dist/cli.mjs`；spec 中文（Strategy B）
- 仓库 language policy / commit discipline / changeset 义务不因本 phase 变更

## Section 2: Design body

#### 2.1 目标与范围

P1 使 `@oscaner-skills/osuperpowers` 成为 pi 一等 pi-package：manifest 正式化 + 分发闭包守卫 + 安装验收两站。现状实证（grilling fact-finder）：`npm:@oscaner-skills/osuperpowers@0.2.0` 已可被 pi 凭借 conventional `skills/` 布局加载（user settings 中已安装），P1 是"把隐式可用固化为显式声明 + 加守卫"而非首次可达。范围外：任何 `.pi/` 运行时产物、emit 产物面变更、engine 数据面、harness 标识符 rename。

#### 2.2 组件

锚点图例：R/Q = grilling 定案轮次锚点（R5 覆盖验收两站：C4 validate 站① / C6 release 站②；Q1′ 为 validate 接线债定案轮）；编号非连续、非必经枚举——缺失编号（如 R2）仅表示该轮未直接产出本 spec 组件，不构成漏项。锚点仅供本 spec 内部溯源，Issue inventory 与 parent overall 均无对应登记（P1 issue ref = none）。

**C1 源字段（R1）** — `packages/osuperpowers/package.json` 增（手维护，D2）：
```json
"keywords": ["pi-package"],
"pi": { "skills": ["./skills"] }
```
- `pi` 无 `extensions` / `prompts` 键（R0 零扩展不变式，C2 守卫使未来漂移被拦截）
- `pi` 字段不涉 `.version-bump.json` / version-sync（后者仅管 version 三元组）
- 闭包现状：`npm pack --dry-run` 已含 `skills/` 全 8 SKILL.md——源字段加入后闭包天然成立，守卫纯为防漂移
- **A3 债项吸收（P6 Task 19 / spec F2 遗留碰撞）**：`keywords`/`pi` 字段触发 `scripts/validate/residue.ts` A3 `\bpi\b`@`packages/osuperpowers/package.json` 守门（precommit 硬门，T1 首dispatch 即 PLAN_CONFLICT）——world-state 翻转（pi 由死残留 → live 分发字段）使该 pi 分支成为死代码：退役分支（`\bpi\b` 移除，`\bdroid\b` 保留——droid 前提未变），注释记录 supersession，residue.test.ts 断言翻转为放行端态 pin

**C2 一等守卫（R3）** — `scripts/validate/osuperpowers.ts` 增步骤「osuperpowers pi-package well-formed」+ `checkPiPackageWellFormed(pkgRoot)`（CheckBlock，与既有 `checkOsuperpowersSkillsCount` 同构：静态读 package.json，零子进程；skills 计数与其共享单一真相）。断言集：
1. `pkg.keywords` 含字面 `pi-package`
2. `pkg.pi` 存在；`pi.skills` 为非空 `string[]`（每项 `./<path>` glob 形态）
3. `pi` 无 `extensions` / `prompts` 键（R0 守门）
4. 每个 `pi.<face>` glob 路径在 pkgRoot 下存在；`./skills` 解析出 `EXPECTED` 个 `SKILL.md`（EXPECTED = 既有 `checkOsuperpowersSkillsCount` 的计数单一真相，导出共享复用——T16 去枚举：守卫内部不重复硬编码数值，字面 8 仅保留在 C4/C6 消费者可见验收）
5. files 闭包：`pi` 声明路径的展开集 ⊆ `pkg.files` 白名单展开集（静态 subset；`./skills` 现由 `skills/` 前缀覆盖）

**C3 背靠测试（R4）** — `packages/osuperpowers/tests/pi-package.test.mjs`（自动进 behavior glob，validate + precommit 双面）：
- 断言活 `package.json`：keywords 含 `pi-package` · `pi.skills` deepEqual `["./skills"]` · 无 extensions/prompts · `./skills` 解析 `EXPECTED` 个 SKILL.md（复用既有计数单一真相，非硬编码字面） · files 闭包规则成立
- 纯静态导入（fs + assert），零子进程、零引擎依赖——manifests 契约 pin 即使守卫被误删仍失败（anti-white-green）

**C4 安装 smoke（R5 站①）** — `packages/osuperpowers/tests/pi-install-smoke.test.mjs`（自动进 behavior glob）：
- 流程：`npm pack --pack-destination <临时>（cd packages/osuperpowers）` → tar 解包到临时目录（剥离顶层包目录）→ 另建临时「项目」目录作 cwd → `pi install <解包目录> --local --approve` → 断言：
  1. 退出码 0
  2. 安装产物内 `skills/` 含恰 8 个 `SKILL.md`（落点 = pi 安装机制实证路径，plan 阶段探针确认）
  3. 项目 `.pi/settings.json` 写入该包 source（`--local` 使 settings 落项目、不污染 `~/.pi`）
- **verified-vs-probe 口径**：已核实（grilling fact-finder，2026-09-27）仅 `npm:@oscaner-skills/osuperpowers` 的 npm 路径加载（见 2.1 现状实证）；本地目录 install 旗标**已实测**（pi 0.87.1，T3 测量）——`--local` 写项目 `.pi/settings.json` **需 `--approve`**（trust gate：`--no-approve` 与 `--local` 不兼容，exit 1 "Project is not trusted. Use --approve to modify local package config."，信任按项目、不持久）；`--approve` 非交互自动批准，临时项目即弃；`npm i -g @earendil-works/pi-coding-agent` 安装命令为 CI 装配事实（runner 侧）；与 C6 npm 路径 smoke 互证——实现以实测为准，残余漂移仍回填本 spec
- **无条件执行**：缺 `pi` 即 FAIL + 错误信息含 `npm i -g @earendil-works/pi-coding-agent`；CI（`.github/actions/validate` 装配）增 `npm i -g @earendil-works/pi-coding-agent` step——零静默 skip（反白绿 AC4 纪律）
- 残留记录（明示于 docs）：pi 无 CLI 内省其运行时技能清单，LLM 可见性不在本测试覆盖——release 站人工抽查 + P4 D5 消费故事补足

**C5 命名 pin 升级（Q1′，validate 接线债）**：
- `packages/osuperpowers/tests/ci-validate.test.mjs`（~L170-172）与 `scripts/validate/__tests__/pre-commit.test.ts`（L43-51）：step count pin（`==11`）升级为 **name-set 断言**——逐一断言期望 step 名出现（含新 step「osuperpowers pi-package well-formed」）
- 语义增强：count 可被"一增一删"掩盖，name-set 不能；未来加块零 churn
- plan 阶段读两文件全文核实既有断言，避免重复/冲突

**C6 release 站（R5 站②）** — `.github/workflows/release.yml`：release job 内、changesets action 之后增 smoke step，复用现有 publish-mode 门控：
- **publish-mode 门控**：step 条件 = `steps.changesets-status.outputs.has_changesets == 'false'`（release job 现「Detect publish-mode push」步骤同款）——changesets push（hasChangesets=true）不发版，跳过 smoke，避免 `pi install` 装到旧版本 / 首发 404 的假绿
- 临时项目 cwd → `pi install npm:@oscaner-skills/osuperpowers@<publishedPackages 版本> --local --approve` → 退出 0 + 安装产物 `skills/` 恰 8 个 SKILL.md + 项目 `.pi/settings.json` 写入
- 真消费者路径（registry 发布物），证明分发不依赖仓库工作树；版本取 changesets action 的 `publishedPackages` output（`steps.changesets.outputs.publishedPackages` 中 `name === "@oscaner-skills/osuperpowers"` 条目的 `version`），非笼统的「changeset publish 变量」

#### 2.3 数据流

`packages/osuperpowers/package.json`（源侧手维护）→ C2 静态守卫（validate step）↔ C3 契约 pin（test）→ C4 安装 smoke（pack → 解包 → pi install → 断言）→ C6 release npm 路径 smoke（发布后）。全程无运行时扩展、无 emit 产物面。

#### 2.4 错误与边界

- `npm pack` 产物名 `oscaner-skills-osuperpowers-<ver>.tgz` 含版本——smoke 用 `--pack-destination` + 动态定位，不硬编码版本字面
- `pi install` 本地目录源传绝对路径；`--local` 落项目 `.pi/settings.json`（**需 `--approve`**——0.87.1 实测 trust gate：`--no-approve` 与 `--local` 不兼容 exit 1，信任按项目不持久）；`--approve` 非交互自动批准（CI 安全，临时项目即弃）
- CI runner 无 pi → 装配 step 安装（版本以 smoke 验收时实测为准）；本地无 pi → 断言 FAIL + 安装提示（零静默 skip）
- files 闭包 glob 展开语义（目录前缀 vs 文件集）：实现以「strip `./` 后目录/文件前缀覆盖」判定，plan 阶段以既有 files 实证
- smoke 全流程零网络（本地 pack + 本地目录 install）

#### 2.5 测试

- 新测试自动进 behavior glob：`pi-package.test.mjs`（C3 静态契约）· `pi-install-smoke.test.mjs`（C4 pack→install 断言三连）
- 守卫：`checkPiPackageWellFormed` 经新 CheckBlock 入 validate + precommit 双面
- pin 更新：`ci-validate.test.mjs` / `pre-commit.test.ts` 升级 name-set（C5）
- 回归面：`pnpm run validate` 全绿 + precommit 全绿

### Acceptance criteria

- `packages/osuperpowers/package.json` 含 `keywords: ["pi-package"]` 与 `pi: { skills: ["./skills"] }`（手维护源字段，emit 产物零变更）
- validate 增「osuperpowers pi-package well-formed」CheckBlock，`checkPiPackageWellFormed` 五组断言对当前树全过
- `packages/osuperpowers/tests/pi-package.test.mjs` 在 behavior glob 内通过（manifest 契约 + R0 不变式 pin）
- `pi-install-smoke.test.mjs` 通过：pack → 解包 → `pi install <dir> --local --approve` 退出 0 · 安装产物含恰 8 个 SKILL.md · 项目 `.pi/settings.json` 写入该包
- `ci-validate.test.mjs` 与 `pre-commit.test.ts` 以 name-set 断言 validate steps（11→12，含新 step），`pnpm run validate` 与 precommit 全绿
- `.github/workflows/release.yml` 含 npm 路径 pi smoke 步骤（publish 后 `pi install npm:@oscaner-skills/osuperpowers@<ver> --local --approve`）
- `pnpm run validate` 全块全绿（新增守卫与测试在内）

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| overall v1.2 P1 acceptance「`pi install <npm 或本地路径>` 单口验收」 | 两站化：validate 本地解包安装实证（C4）+ release npm 路径 smoke（C6） | Yes — v1.3 · 2026-09-27 |
| overall v1.2 P1「守卫 + node:test 骨架（进 validate glob）」未定形态 | 一等 CheckBlock（C2）+ 背靠测试（C3）+ 命名 pin count→name-set 债升级（C5） | Yes — v1.3 · 2026-09-27 |

无未回填偏差——全部 grilling 定案已随 overall v1.3 sync-before-write 落地。

## Section 4: Notes for downstream

- **P2（emit 分发注册表）**：消费 `package.json#pi` 作为 pi 分发条目注册的契约输入；本 phase 只固化源字段，不建注册表（P2 硬依赖 P1）
- **P3（engine 数据面）**：`pi` registry 行 + `AI_AGENT=pi` 检测，不触碰 package 侧字段；`pi-install` 行为与 engine spawn 通道（`pi -p` print 形态）无重叠，per-op 形态 P3 自行定稿
- **C6 release.yml 修改面**：与 P4 的 validate/README 接线共享发布链文件，P4 改动时勿覆盖 smoke step
- **残留记录（consumer 面）**：pi 运行时技能清单无 CLI 内省，skill 可见性由 C6 人工抽查 + P4 D5 消费故事（包序 override 语义）文档化
- **#302（独立 single-spec 程序，非本程序产物）**：Review Convergence 判读规则改动归其 spec；P3/P4 若触碰 Review Convergence 文案以 #302 程序定案为准

## Section 5: Review

Fresh-subagent review passes on the committed baseline, then user review, then writing-plans. Review Convergence（I1）：blocker > 0 → fix 全 findings 后 re-review；blocker = 0 → fix 全 findings → done（不再 re-review）。Entry 前树必须 clean（engine entry gate）。
