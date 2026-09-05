# CDD Engine 重构 + 生态完善 — P2 设计 Spec

- **Version**: v1.0 · 2026-09-05
- **Status**: Draft
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming)
- **Parent program**: [2026-09-04-cdd-engine-overhaul-overall.md](2026-09-04-cdd-engine-overhaul-overall.md) (v1.9)
- **Depends on**: P1（engine 已打包发布 + PR #236 合入 develop）

---

## Section 0: Incremental warning

P2（基础设施整治）增量开发 spec。跨 phase 约定以 [overall](../../2026-09-04-cdd-engine-overhaul-overall.md) 为准；冲突时 overall wins。

## Section 1: Constraints pointer

- 不重复 overall conventions；overall wins。
- 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B，内部开发者文档）。
- 不 commit 除非用户明确要求；changeset 逐 phase 建。
- vendored 子模块不可改。
- 允许破坏性更新，确保最佳实践，不留技术债务。
- 消费者视角：skill 规则文本与随插件发布的 docs 须从发布后消费者环境审查。

---

## Section 2: Design body

### 2.1 Scope

P2 = Enh H（composite actions + cdd-engine smoke test）+ Enh I（workflows 重命名/重构 + scripts 全面重组 + Issue Templates 统一）+ 用户在 grilling 中扩展的决策（scripts 采用成熟第三方依赖、命名统一、文件内拆分、router 死代码删除）。

### 2.2 scripts/ 全面重组

#### 2.2.1 目标结构（域目录 + 单一调度入口）

```
scripts/
  run.mjs                    # 唯一顶层入口（Commander 分发，懒加载域模块）
  lib/                       # 仅跨域共享
    marketplace-utils.mjs    # emit + release + validate 共享（+test）
    version-utils.mjs        # release + validate 共享（+test）
  emit/                      # all . check . osuperpowers(per-plugin seam) . marketplace . compare
                             #   + source / orchestrate / manifests（自 lib/emit 迁入）
  validate/                  # index(composition) + 9 个 block 模块
  release/                   # version-packages . bump-submodule . publish-vendor
                             #   . vendor-registry . vendor-assembly . submodule-tags
  rulesets/                  # apply + develop.json + main.json
```

#### 2.2.2 run.mjs 命令面（verb-object 统一）

| 命令 | 实现域模块 | 原入口 |
|---|---|---|
| `validate` | validate/index.mjs | scripts/ci-validate.mjs |
| `emit` | emit/all.mjs | scripts/emit.mjs（写路径） |
| `emit-check` | emit/check.mjs | scripts/emit.mjs --check |
| `version [--dry-run]` | release/version-packages.mjs | scripts/version-packages.mjs |
| `publish-vendor [--dry-run]` | release/publish-vendor.mjs | scripts/publish-vendor.mjs |
| `bump-submodule <name> [--dry-run]` | release/bump-submodule.mjs | scripts/bump-submodule.mjs |
| `apply-rules <protect-develop\|protect-main>` | rulesets/apply.mjs | scripts/gh-branch-rulesets.mjs |
| `smoke-cdd` | validate/smoke-cdd.mjs | 新增 |

- `validate-marketplace` / `validate-version-sync` **不设**独立命令（仅为 validate 套件内部 block 模块 + 保留 isMain 可直接直跑满足「各模块独立可运行」验收）。
- run.mjs 用 Commander v15：子命令 → `await import()` 懒加载域模块；help / usage / 未知参数错误统一处理。

#### 2.2.3 文件内拆分

- **lib/publish-vendor.mjs（585 行）→ release/ 三文件**：
  - `vendor-registry.mjs`：全部 probe（npm registry / git tag / GitHub release）+ classifyProbeError + collectGaps + resolveUpstreamTag + listVendors（~150 行）
  - `vendor-assembly.mjs`：ASSEMBLY_TEMPLATE / derivePiKey / resolveVendorVersion / assemblePackageJson / copyTree→`fs.cpSync` / assert\* / stageVendor（~200 行）
  - `publish-vendor.mjs`：publishVendor / publishAll / defaultStageRoot 编排（~100 行）
- **emit.mjs（367 行）→ emit/ 五文件**：`all.mjs`（emitAll 编排 + 持有 generatedPaths 以参数传给各 emitter）+ `check.mjs`（tempRoot + compareTrees）+ `osuperpowers.mjs`（emitOsuperpowers + emitAgentsSkillsCopy，per-plugin emitter seam）+ `marketplace.mjs`（emitMarketplaceDocs）+ `compare.mjs`（compareTrees / findStaleCommittedFiles / assertVersionBump + product consts / generatedPaths 消费）。
- **ci-validate.mjs（221 行）→ validate/ 十文件**：`index.mjs`（组合：同构 steps 注册器，导出 steps + main，保 wiring guard 契约）+ block 模块：emit-check / osuperpowers / engine(5b1) / **gate-hooks(5b2，P4 删除点)** / residue(5c) / marketplace(block 6) / version-sync(block 8-10) / lib-tests(block 7) / submodule(block 11)。

#### 2.2.4 死代码删除（P-epsilon 漏删）

- `lib/version-utils.mjs`：`parseRouterVersion` + `computeNextVersion`（唯一调用方为下方死调点）
- `version-packages.mjs`：第 71-103 行整段 `-- osuperpowers-router` + 第 183 行 `versioned.push("osuperpowers-router")` + 第 151-153 行陈旧注释（`router.md` / `sync-router-versions.mjs`）+ 第 211-213 行对已删 `sync-router-versions.mjs` 的死 `execSync`
- `bump-submodule.mjs`：第 42-43、55-77 行 router 块（含 `sync-router-versions.mjs` 死调用）
- `emit.mjs` 第 6 行注释引用 `packages/osuperpowers-router/build/generate-all.sh`（陈旧注释，改写为现状描述）
- 注意：当前 `version-packages.mjs` 在有 changeset 时因 `readJson("packages/osuperpowers-router/package.json")` ENOENT 崩溃（release 版本步骤潜在故障）——此删除同时修复之。
- 所有旧 `scripts/lib/` 路径迁移完成后，仓库存活代码不得再引用旧路径（验收 grep 见 §Acceptance 14）。

#### 2.2.5 第三方依赖落位

| 包 | 落点 | 削减 |
|---|---|---|
| ajv v8 | validate/marketplace.mjs：source.json 对 source.schema.json（draft-07）校验 | 删除全部 python 依赖（requirements-dev.txt + workflow setup-python/pip） |
| semver | lib/version-utils.mjs：parseSemver→semver.parse、computeNextIndependentVersion→semver.inc | 手写标准 semver 逻辑 |
| execa v9 | 全部 spawn 点统一（emit diff / npm publish / git 封装） | child_process 引用清零 |
| commander v15 | run.mjs 唯一入口 | 手写 argv 解析清零 |
| vitest | scripts 全部测试（原 node:test）→ `pnpm run test` | 与 cdd-engine 统一测试栈；block 7 显式文件列表→递归发现 |
| tinyglobby | emit collectTree + validate 文件发现 + compare stale 扫描 | 手写 walk() 递归×2 |
| `fs.cpSync` 内置 | vendor-assembly 替换手写 copyTree | ~40 行手写拷贝 |

```
根 package.json（changeset / prepare 保留不动）：
  "changeset": "changeset"
  "prepare":   "husky"
  "emit":       "node scripts/run.mjs emit"
  "emit:check": "node scripts/run.mjs emit-check"
  "validate":   "node scripts/run.mjs validate"
  "version":    "node scripts/run.mjs version"
  "test":       "vitest run"
```

### 2.3 CI / Workflows（Enh H + Enh I）

#### 2.3.1 Composite actions（.github/actions/，无 python）

| Action | 内容 |
|---|---|
| `setup` | checkout（fetch-depth 0 + submodules recursive + token 输入）+ pnpm + setup-node **24**（cache pnpm；与仓库 .nvmrc v24 及 release publish-vendor job 对齐） |
| `link-cdd-engine` | `cd packages/cdd-engine && npm link` + 断言 `command -v cdd-task` 存在（验证 npm 包 bin 入口真实安装；**smoke-cdd 经 PATH 调用的消费方**） |
| `install-harness` | `npm i -g @anthropic-ai/claude-code` + `HOME=<hermetic> node packages/osuperpowers/bin/init/install-harness.mjs --harness claude`（验证 init 通道真写 config/skills） |
| `validate` | `pnpm install --frozen-lockfile` + `node scripts/run.mjs validate` |

#### 2.3.2 Workflow 重命名（git mv 保留历史）

| 现 | 新 | 改动 |
|---|---|---|
| ci.yml | pr-validate.yml | composite 化 + smoke |
| main-source-gate.yml | pr-gate-main.yml | 仅改名 + header |
| bump-submodule-reusable.yml | submodule-bump.yml | 改名 + run.mjs bump-submodule + submodule-sync.yml 引用同步 |
| release.yml | 不变 | 内部 `run.mjs version` / `run.mjs publish-vendor` |
| submodule-sync.yml / sync-main-to-develop.yml | 不变 | 引用更新 |

#### 2.3.3 Smoke test（Level 0，Q1 决策）

`run.mjs smoke-cdd` 用提交 fixture `packages/cdd-engine/bin/tests/fixtures/smoke-plan.md`（含 `### Task 1:` 标题 + base 字段，位于 git repo 内以满足 runner 的 git toplevel 解析）。实际执行 CLI 序列（全链 `CDD_DRY_RUN=1`，无真实 agent / 无 ANTHROPIC_API_KEY；已在开发环境逐条验证 exit 0）：

```bash
CDD_DRY_RUN=1 cdd-task --harness claude --task 1 --mode implement   --plan packages/cdd-engine/bin/tests/fixtures/smoke-plan.md
CDD_DRY_RUN=1 cdd-task --harness claude --task 1 --mode task-review --plan packages/cdd-engine/bin/tests/fixtures/smoke-plan.md
CDD_DRY_RUN=1 cdd-task --harness claude --task 1 --mode fix         --plan packages/cdd-engine/bin/tests/fixtures/smoke-plan.md
CDD_DRY_RUN=1 branch-review --harness claude --plan packages/cdd-engine/bin/tests/fixtures/smoke-plan.md --base $(git rev-parse HEAD) --head $(git rev-parse HEAD)
```

断言粒度：每条命令 stdout 的**末块**为 H1 四行合同（`status:` / `commits:` / `artifacts:` / `blocker:`），且 `status: APPROVED` + exit 0。4 条命令全部满足才算 smoke 通过。全部中间产物写入 `.superpowers/cdd/smoke-plan/`（gitignored，CI 无害）。

> **调用方式说明**：smoke 4 条命令使用 **PATH 解析的 `cdd-task` / `branch-review` bin**（非 raw `node packages/cdd-engine/bin/*.mjs`），从而让 link-cdd-engine 的「从源码安装 → bin 入口可解析」成为被验证的第一类路径（Enh H 原意）。本地复跑前置：`cd packages/cdd-engine && npm link`。

### 2.4 Issue Templates（Enh I）

- **bug_report.yml**：labels `['bug','osuperpowers']`；修正 `spor skills` → `osuperpowers skills`；新增 Component 下拉（8 选项，必填）+ Session type 下拉（dogfood (CDD session) / standalone，必填）。
- **enhancement.yml**：labels `['enhancement','osuperpowers']`；同款修正 + 双下拉。
- **Component 下拉 8 选项**（canonical 清单，P3 report-issue 据此对齐）：`osuperpowers (general)` / `cdd-engine` / `osuperpowers:init` / `osuperpowers:brainstorming` / `osuperpowers:writing-plans` / `osuperpowers:cli-driven-development` / `osuperpowers:report-issue` / `osuperpowers:finishing`。
- **session_report.yml（新增）**（labels `['session','osuperpowers']`）：Session metadata（branch/date/harness/skills 多选）+ Findings 列表 textarea（`[severity] component — summary`，**severity 枚举 = blocker / warn / nit**）+ 关联字段。P2 只建表单骨架；P3 Enh J 消费（report-issue session 聚合）。
- report-issue skill 的 `.md` body 模板与 skill 逻辑 **不**在 P2 调整（Q8 A 决策：P2 半改不如不改，整体推迟 P3 并已写入 overall P3 验收）。

### 2.5 测试策略

- scripts 测试 node:test → vitest（`pnpm run test`，`vitest.config.mjs` 定义 include/exclude）。
- **根 vitest 配置作用域**：`include: ["scripts/**/*.test.mjs"]`，`exclude` 显式排除 `packages/osuperpowers/**`（P3 前仍 node:test）与 `packages/cdd-engine/**`（5b1 独立套件，避免重复跑）。block 7 即 `pnpm exec vitest run`（受同一配置约束），不再显式列 6 个文件。
- 测试随实现迁移：emit.test→emit/；publish-vendor/submodule-tags/bump-chain/first-party-publish→release/；version-utils/marketplace-utils→lib/。
- wiring guard（ci-validate.test.mjs）：import 路径改 `scripts/validate/index.mjs`；steps 名/顺序字面保留 → 断言零语义改动。
- 5b1 cdd-engine vitest 不动。

### 2.6 调用面更新映射

| 调用点 | 现 | 新 |
|---|---|---|
| package.json scripts | emit / emit:check / validate / version | run.mjs <command> |
| pr-validate.yml（原 ci.yml） | node scripts/ci-validate.mjs | node scripts/run.mjs validate |
| release.yml | version-packages.mjs / publish-vendor.mjs | run.mjs version / run.mjs publish-vendor |
| submodule-bump.yml | bump-submodule.mjs <name> | run.mjs bump-submodule <name> |
| CLAUDE.md（CI 段 + Architecture details 段） | node scripts/ci-validate.mjs / scripts/emit.mjs / scripts/ci-validate.mjs | run.mjs validate / emit / validate |
| README.md / README.zh-CN.md | `scripts/lib/publish-vendor.mjs`（各 1 处） | `scripts/release/` 域模块路径 |
| marketplace/README.md | `scripts/lib/publish-vendor.mjs`（1 处） | `scripts/release/` 域模块路径 |
| .changeset/README.md | `node scripts/version-packages.mjs` + `packages/osuperpowers-router/` | `run.mjs version`；router 引用清除 |
| docs/maintainers/osuperpowers-plugin.md | 9 处脚本路径 | run.mjs / 域内模块路径 |
| ci-validate.test.mjs | import scripts/ci-validate.mjs | import scripts/validate/index.mjs |

### Acceptance criteria

各自独立可测：

1. **run.mjs 命令面**：`node scripts/run.mjs <command> --help` 各命令可执行；8 命令存在。exit 0 验证限本地安全子集（validate / emit / emit-check / version --dry-run / publish-vendor --dry-run / smoke-cdd）；`bump-submodule` / `apply-rules` 涉及真实 git/网络副作用，仅验收 `--help` + 参数校验路径（不要求在本地真跑）。
2. **路由**：`node scripts/run.mjs emit-check` 对含 drift 的树 exit 1（破坏性测试可选），干净树 exit 0。
3. **validate 组合**：`node scripts/run.mjs validate` 输出含原 13 块 step 名（`== <name> ==`），全绿 exit 0；wiring guard 测试（osuperpowers/tests/ci-validate.test.mjs）通过且断言零语义改动（step 名/顺序断言原样匹配）。
4. **各模块独立可运行**：`node scripts/validate/marketplace.mjs` / `node scripts/validate/version-sync.mjs` / `node scripts/emit/check.mjs` 可直接直跑。**isMain 检测采用 cdd-engine 已验证的 `realpathSync(process.argv[1]) + pathToFileURL` 模式**（Node 18/20/22/24 全兼容；不依赖 experimental `import.meta.main`）。
5. **builtin 规范化**：`grep -rn "child_process" scripts/` 为空；**手写业务 argv 解析仅存于 run.mjs**（域模块允许出现标准 isMain 守卫所需的 `process.argv[1]` 读取，见 #4）。
6. **python 移除**：`requirements-dev.txt` 删除；`.github/actions/setup/action.yml` 无 setup-python / pip install；root `.github/workflows/` 无 python 相关步骤。
7. **死代码删除**：存活代码范围 grep 为空 —— `grep -rn "osuperpowers-router\|sync-router-versions\|parseRouterVersion\|computeNextVersion" scripts/ CLAUDE.md .github/workflows/ README.md README.zh-CN.md .changeset/README.md docs/maintainers/`（**排除 `docs/superpowers/` 历史 spec/plan 记录**——它们是冻结文档，含 router 字样属正常）；`node scripts/run.mjs version --dry-run` 不崩溃。
8. **wiring 验收**：`pnpm run validate`（= `run.mjs validate`，其 block 0 含 emit-check）全绿。
9. **composite actions 存在**：`.github/actions/{setup,validate,install-harness,link-cdd-engine}/action.yml` 四文件存在。
10. **workflow 命名**：`.github/workflows/` 含 pr-validate.yml / pr-gate-main.yml / submodule-bump.yml / release.yml / submodule-sync.yml / sync-main-to-develop.yml；旧名（ci.yml / main-source-gate.yml / bump-submodule-reusable.yml）不存在；submodule-sync.yml 引用 submodule-bump.yml。
11. **Issue Templates**：bug_report.yml / enhancement.yml 含 component + session-type 下拉、labels 含 `osuperpowers`、无 `spor`；session_report.yml 存在。
12. **vitest**：`pnpm run test` 全绿（根 vitest 配置 `include: scripts/**`，不拉入 osuperpowers node:test 树、不重复跑 cdd-engine）；block 7 不再显式列 6 文件。
13. **smoke-cdd**：`node scripts/run.mjs smoke-cdd`（repo 内、git 仓库条件下）按 §2.3.3 CLI 序列输出 4 组 H1 四行合同（各 `status: APPROVED`）+ exit 0。
14. **旧路径残留**：`grep -rnE "scripts/ci-validate\.mjs|scripts/lib/|scripts/gh-branch-rulesets|scripts/emit\.mjs|scripts/version-packages\.mjs|scripts/publish-vendor\.mjs|scripts/bump-submodule\.mjs|scripts/validate-marketplace\.mjs|scripts/validate-version-sync\.mjs" . --include="*.mjs" --include="*.json" --include="*.yml" --include="*.md" --exclude="CHANGELOG.md" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.superpowers --exclude-dir=superpowers --exclude-dir=vendors --exclude-dir=tmp` 为空。排除说明：`vendors/` 子模块不改；`CHANGELOG.md` 历史发布记录不改写；`superpowers` basename 目录（docs/superpowers 历史 spec/plan；grep `--exclude-dir` 按 basename 匹配，斜杠路径语法无效）；`tmp/` 为 vendor 暂存产物（gitignored）。
15. **composite actions 实际使用 + 成功断言**：pr-validate.yml 明确 `uses: ./.github/actions/{setup,link-cdd-engine,validate,install-harness}`，并含 `run: node scripts/run.mjs smoke-cdd` 步骤（CI smoke 真实执行）；`install-harness` 在 hermetic HOME 运行 **exit 0 + `command -v claude` 断言 CLI 安装成功**（claude 为 install-and-use 通道，不写 `$HOME` init 产物 —— 不为此断言 HOME 文件；init-config 通道由 `configs/` 内 init-channel harness 覆盖）；`link-cdd-engine` 断言 `command -v cdd-task` 存在。
16. **自维护实现清零**：`grep -rnE "function walk\(|copyTree" scripts/` 为空（手写 walk 递归与 copyTree 已被 tinyglobby / `fs.cpSync` 替代）。

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| Enh I scope 仅 scripts/validate 模块化 | 扩展为 scripts/ 全面重组 + 成熟第三方依赖 + 命名统一 + 文件内拆分 + router 死代码删除 | Yes — v1.9 · 2026-09-05 |
| CI smoke 未设层级 | Level 0（dry-run + hermetic init，无真实 agent） | Yes — v1.9 · 2026-09-05 |
| report-issue 模板未在 P2 提及 | 明确推迟至 P3（半改不如不改），P3 验收补充 mirror 要求 | Yes — v1.9 · 2026-09-05 |
| 验收 AC#14 grep 范围 | 修正排除项：`--exclude-dir` 按 basename 匹配（`superpowers` 覆盖 docs/superpowers 与 vendors/superpowers）、加 `CHANGELOG.md`/`tmp` 排除（历史记录不改写）—— plan-review/deferred-sweep 期发现原语法无效 | N/A（acceptance 措辞细化，无跨 phase 影响）· 2026-09-05 |
| 验收 AC#15 install-harness 断言 | 改为 exit 0 + `command -v claude`（claude 通道为 install-and-use 不写 HOME 产物；原 `$HOME` init 产物断言不可满足）—— T11/branch-review 双确认 | N/A（acceptance 措辞细化，无跨 phase 影响）· 2026-09-05 |

**Generated-banner 字面量（补充说明，非 deviation）**：市场/清单产品头部 `Generated by scripts/emit.mjs — do not edit` 字面量（位于 `scripts/lib/marketplace-utils.mjs` 的 generatedBanner 等）须随入口迁移更新为 `scripts/run.mjs emit`；emit 再生成后产品含新 banner（旧 banner 残留由 §Acceptance 14 的 `scripts/emit\.mjs` pattern 兜底）。

## Section 4: Notes for downstream

- **P4（Gate 移除）**：validate/gate-hooks.mjs 是 P4 删除点——P4 只需删该模块 + 对应 osuperpowers gate 文件；P2 保留不删。同理 install-harness 的 gate config 写入是 P4 目标。
- **P3（Skills+模板）**：session_report.yml 表单骨架由 P3 Enh J 消费（report-issue session 聚合）；report-issue `.md` body 模板与 yml 字段 mirror 已在 P3 验收。
- **P3（Skills+模板）追加（Enh R）**：writing-plans `user-ok?`「Fix selected」死选项移除（与 docs-review Review Stopping 「always fix all findings」对齐）—— 本 P2 plan-review 期发现（2026-09-05），已 file #232 comment 5549870456 + overall v1.10 跟踪，P3 实施。
- **P3（Skills+模板）追加（Enh S / Enh T）**：cdd-engine review 模板 deferred 孤儿机制清理 + fix handoff schema 加可选 `notes` 字段 —— 本 P2 deferred-sweep 期实测发现（2026-09-05），已 file #232 comments 5552903094 / 5552904440 + overall v1.11 跟踪，P3 实施。P2 侧已通过 `contract.mjs --clear-findings` 收敛 sweep（8 个 review/fix 模板相关文件 P3 一并清理）。
- **P2 CI 集成约定（Enh U，已修复）**：本地 composite action 首步需显式 checkout + npm global bin 跨 job step 需 `$GITHUB_PATH` —— PR #237 CI 连挂两轮发现并修复（commits 2689284/b37f47d/3482306/ec5989f），已 file #232 comment 5553063867 + overall v1.12 跟踪，沉淀为 workflow 编写约定。
- **release 稳定性**：当前 `version-packages.mjs` 有 router 死代码崩溃风险，P2 修复后 release 流程恢复健壮。
- **测试框架过渡**：scripts 迁移 vitest 后，osuperpowers/tests 仍为 node:test（P3 范畴），仓库暂留双框架——P3 可考虑统一。

## Section 5: Review

Rule: Fresh-Subagent Review Passes（completeness / consistency&scope / clarity&YAGNI）须全部通过后进入 user review 与 writing-plans。