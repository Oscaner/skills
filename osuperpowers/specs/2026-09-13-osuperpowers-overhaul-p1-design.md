# osuperpowers 架构重构 — P1 design：runtime 布局（`.osuperpowers/cdd` 单根 + standalone 收缩 + 存量处置）

- **Version**: v1.0 · 2026-09-13
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md](2026-09-13-osuperpowers-overhaul-overall.md)（v1.4）
- **Depends on**: 无（program 起点）

---

## Section 0: Incremental warning

> P1 increment only（runtime 布局收敛）。跨 phase 约定见 [overall](2026-09-13-osuperpowers-overhaul-overall.md)；冲突时 overall 优先。

## Section 1: Constraints pointer

> 不重复 overall 约定（仓库语言政策 / 不 commit 除非显式 / vendored 不可改 / 破坏性重构授权 / `pnpm run validate` 13 块 + `emit:check` 无 drift）。冲突时 overall 优先。

---

## Section 2: Design body

### 2.1 背景与根因

cdd-engine 生成的运行时 artifact（handoffs / progress / lifecycle / base-branch / report-target）全部落在 `.superpowers/cdd/<slug>/`，另有一个**从未真实使用**的 standalone 第二根（`.superpowers/standalone/`）。历史累积三类问题：

1. **布局字面量散落**：单源（`templates/handoff-namespace.json#workspaceRoot`）之外存在多处硬编码复制——`bin/cdd.mjs` lifecycle 路径、`lib/cli/base-branch.mjs` STANDALONE_ROOT 常量、13 个 engine 测试文件、7 个 skills/docs 文件、validate 脚本、根 `.gitignore`。改根 = 机械扫全仓。
2. **standalone 伪功能**：P5 引入 standalone scope 后**零真实派发**——本仓 `.superpowers/standalone/` 目录从未创建、13 个历史 `base-branch.json` 全在 `cdd/` 下、其唯一调用方 finishing 的正常入口（cli-driven-development → handoff-finishing）必经 CDD workspace。standalone 分支写的是一个**永远不会被读**的 base-branch.json（base-branch.json 唯一读者 = finishing 自身，而 finishing 是一次性收尾）。
3. **死档累积**：`.superpowers/docs-review/`、`.superpowers/cdd/.archive-2026-09-08`、`.superpowers/cdd/.archive-2026-09-09`、18 个历史程序 workspace、smoke workspace、旧 lifecycle.json——全部 gitignored、无 reader 的死数据。

### 2.2 workspace 布局单源化（`.superpowers/cdd` → `.osuperpowers/cdd`）

**单源翻转**：`templates/handoff-namespace.json#workspaceRoot` 值 `".superpowers/cdd"` → `".osuperpowers/cdd"`。
`naming.mjs`（`workspaceRoot` / `resolveWorkspace`）、run-task、review.mjs、docs-runner、base-branch CDD 侧全部经此单源自动随迁——engine 零布局逻辑复制。

**随迁硬编码 literal 面**：

| 面 | 位置 | 动作 |
|---|---|---|
| lifecycle | `bin/cdd.mjs:27` (`<cwd>/.superpowers/cdd/lifecycle.json`) | → `.osuperpowers/cdd` |
| workspace 收编 | `lib/runner/run-task.mjs:100-102`（base 派生自单源） | 自动随迁 |
| engine 测试 | 13 个文件：runner / cli-shape / cli-shared / docs-runner / docs-task / cdd / task / base-branch / branch-review / handoff-naming / host-detection / cdd-research / helpers（~40 literal） | `.superpowers/cdd` → `.osuperpowers/cdd` |
| engine 源注释 | `lib/handoff/naming.mjs:4,13`、`lib/lifecycle/proc.mjs:4`、`lib/runner/run-task.mjs:67,87,91`、`lib/cli/review.mjs:20`、`lib/cli/branch-review.mjs:50`、`lib/cli/base-branch.mjs:3-4,14` 注释携带旧根（含 base-branch.mjs:16 STANDALONE_ROOT 代码行） | 注释随代码迁移/重写——§2.5 新守卫 scope 含 bin+lib 文件内容，注释残留同样触发 zero-hit 失败 |
| skills/docs | finishing SKILL / `_docs/review.md` Handoff Output 段 / base-branch.md / handoff-schema.md / cli-driven-development SKILL / report-issue SKILL / cli-research SKILL | 路径文本同步 |
| validate | `scripts/validate/smoke-cdd.mjs:43,52`；report-issue 读取路径（SKILL 文本） | `.superpowers/cdd` → `.osuperpowers/cdd` |
| 根 `.gitignore` | `.superpowers` | 保留（sdd 仍需）+ 增 `.osuperpowers` |

**明确不动**：`naming.mjs rootFromDocPath` 的 `docs/superpowers` 段识别 fallback——docs 根迁移属 P2 职责。

### 2.3 standalone 收缩（CLI 单调 `--plan` + finishing read-base 语义）

standalone 概念整体移除：

- **CLI**：`cdd base-branch set|get` 撤销 `--scope` / `--slug`，单一目标 `--plan <path>`。
  - `lib/cli/base-branch.mjs`：删 STANDALONE_ROOT 常量 + `resolveBaseBranchWorkspace` 的 standalone 分支（仅剩 plan 目标 + 缺参报错）。
  - `lib/cli/parse.mjs`：SUBCOMMAND_USAGE base-branch 行、description、`--scope`/`--slug` flags 同步移除。
- **finishing read-base 语义**：有 cdd artifact → 读 `.osuperpowers/cdd/<slug>/base-branch.json`；无 artifact（手工 feature 分支、无 plan）→ 推断 base（① plan field ② branch upstream ③ conversation context ④ ask user）后**直接传给 present-menu，不落盘任何 base-branch.json**。
- **base-branch.md**：flag 表收敛为 `--plan` 单调；scope resolution 节删除 standalone 行；slug sanitize 规则删除（不再有 sanitized-branch slug）。
- **测试**：base-branch.test.mjs standalone 用例删除、新落点断言同步。
- **report-issue 语义裁定**（standalone 概念重构的边界）：「standalone 概念整体移除」作用于 **CLI/base-branch 面**（`kind: "standalone"` report-target 分类与 report-issue 的「a standalone run has no run slug」prose **保留**——无 plan 会话的 classification 在 no-artifact 路径下仍是活场景），rename 至 P5 report-issues 重写时再议，P1 不做。

### 2.4 存量处置 + gitignore

**全量删除**（全部 gitignored runtime 死档，`rm -rf`，无 git 痕迹）：

- `.superpowers/cdd/` 下 19 个程序 workspace（17 历史 + 本程序 overall `2026-09-13-osuperpowers-overhaul-overall/` + 本程序 p1 `2026-09-13-osuperpowers-overhaul-p1/`——本程序设计自身的 review/fix round 到目前为止仍在旧根，删除前须消费完毕；doc_hash 双签名保证新根重新开 round 安全，Stopping 语义不因分根断裂）
- `.superpowers/cdd/lifecycle.json`、`.superpowers/cdd/smoke/`、`.superpowers/cdd/.gitignore`、`.superpowers/cdd/.archive-2026-09-08/`、`.superpowers/cdd/.archive-2026-09-09/`
- `.superpowers/docs-review/`（整树）

**删除时序约束（相对 workspaceRoot flip 任务）**：删除任务必须**在 workspaceRoot flip 的 engine 代码变更 commit 之后**执行（派发时以当时活跃 literal 为准——删除动作本身 `rm -rf` 旧根），避免删除动作与代码迁移中间态互相踩踏。删除后：
- 本程序自身**在途 handoff 落点断根**——flip 前已落旧根的 implement/review/fix handoff 与 round/progress 台账随删除消失（定点锚丢失），后续 round 一律在新根重开（doc_hash 双签名保证 Stopping prev 语义仍正确——prev 缺失回落 round-1，不误判）。
- 本程序自身 base-branch.json 在被删文件集内 → P1 dev 期间后续 task 的 **branch-review / finishing 重入走 §2.3 no-artifact base 推断路径**（非缺陷，是删除后的预期语义）。

**保留**：`.superpowers/sdd/`（superpowers 所属，不动）。

**gitignore**：保留 `.superpowers`（sdd 仍需 ignore）+ 新增 `.osuperpowers`。

**验收面**：删除完成后 `.superpowers/` 下仅存 `sdd/`；engine 运行期零 `.superpowers` 写入（resolveWorkspace 全走新根，构造保证）。

### 2.5 残留守卫（防回渗）

`scripts/validate/residue.mjs` STALE_LEXICON_CHECKS 新增两条（机制位置零豁免：engine bin/lib/templates + osuperpowers skills），regex 匹配以下路径段字面（转义细节按现有 stale-lexicon 惯例在 engine 实现，spec 只表达字面意图 `.superpowers/cdd` 与 `.superpowers/standalone`）：
- `{ label: "old runtime root .superpowers/cdd", pattern: 含 `.superpowers/cdd` 路径段, scope: ALL_MECH_POSITIONS }`
- `{ label: "deleted standalone root", pattern: 含 `.superpowers/standalone` 路径段, scope: ALL_MECH_POSITIONS }`

现存「flat docs-review root 回退」stale-lexicon 守卫保留（pattern 匹配 `.superpowers/docs-review` 路径字面；docs-review 删除后仍防复发）。`.superpowers/sdd` 不设守卫——sdd 是 superpowers 生态保留面，doc 位置引用合法。守卫只扫机制位置，不影响 `.superpowers/sdd` doc 引用。

### 2.6 测试与验证

- engine tests 路径 literal 全面更新（§2.2 面）后，现有断言（handoff-naming / runner / cli-shared / docs-runner / cdd…）天然覆盖新根。
- `smoke-cdd.mjs` 两处 `.superpowers` literal → `.osuperpowers`；smoke workspace 落新根。
- **新增守卫测试**：residue.test.mjs 断言两条新 stale-lexicon 命中/放行正确（`.superpowers/cdd`、`.superpowers/standalone` 命中；`.superpowers/sdd` 放行）。**注意**：现有负向断言 `residue.test.mjs:54` 的 `.superpowers/cdd/foo/spec-review-1.json`（当时以「flat docs-review root 回退」守卫 scope 下规范家族名不误报）在新 `.superpowers/cdd` 守卫下翻转——该用例须改为正向命中断言（或降级为 `.superpowers/sdd` 风格放行用例），与新断言同步更新，防 CI 回归。
- 全量 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift。

### 2.7 changeset

cdd-engine **minor**（`.superpowers` → `.osuperpowers` 属行为变更；standalone CLI 面移除属删减）。osuperpowers skills 路径文本随 engine 面同步，本次不单独 bump（P4 skills 重写时再计 changeset）。

### Acceptance criteria

- [ ] `templates/handoff-namespace.json#workspaceRoot = ".osuperpowers/cdd"`，engine 产物（handoff / progress / lifecycle / base-branch / report-target）全部落到 `.osuperpowers/cdd/<slug>/`；`resolveWorkspace` 单源派生，不依赖任何硬编码替换
- [ ] `cdd base-branch set|get` 仅接受 `--plan <path>`；`--scope` / `--slug` 标识不存在（usage 面 + 行为面）
- [ ] `.superpowers/` 下仅存 `sdd/`（docs-review / cdd 全部 workspace / archive / lifecycle / smoke 已删）；`git status` 干净（全 gitignored）
- [ ] engine 运行期零 `.superpowers` 写入（`.superpowers/sdd` 保留面除外）
- [ ] finish ing read-base：有 cdd artifact → 读新根；无 artifact → 推断 base 传给 present-menu 不落盘（SKILL 文本 + 行为一致）
- [ ] root `.gitignore` 含 `.superpowers` + `.osuperpowers`
- [ ] 新增 stale-lexicon 守卫（`.superpowers/cdd` / `.superpowers/standalone`）在机制位置零命中；`.superpowers/sdd` 引用放行（residue.test.mjs 断言）
- [ ] `pnpm run validate` 13 块全绿 + `pnpm run emit:check` 无 drift
- [ ] changeset（cdd-engine minor）落盘

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P1 scope「旧根工作区**保留转只读**、不迁移不复写」 | 旧根工作区**全量删除**（gitignored 死档无 reader；破坏性重构授权下遗留即删） | Yes — v1.3 · 2026-09-13 |
| P1 acceptance「存量工作区处置清单（**废弃标记/只读语义落盘**，无孤儿写）」 | 处置 = 删除；零写由路径派生构造保证（无 marker 文件） | Yes — v1.3 · 2026-09-13 |
| P1 scope「standalone 并入 `cdd/<slug>`（STANDALONE_ROOT 移除，base-branch.json per-slug）」 | **standalone 概念整体移除**（零真实派发 = 伪功能）：`--scope`/`--slug` 全删、base-branch 单调 `--plan`、finishing 无 artifact 场景推断后不落盘 | Yes — v1.3 · 2026-09-13 |
| P3 scope「base-branch CLI 去 `--scope standalone`（并入 cdd slug）」 | P1 即完成（standalone 收缩推进到 P1，not P3）；P3 scope 相应项移除 | Yes — v1.3 · 2026-09-13 |

**All Overall updated? = Yes before review.**

---

## Section 4: Notes for downstream

- **P2（docs 根迁移）**：`naming.mjs rootFromDocPath` 的 `docs/superpowers` fallback 识别留待 P2 迁移 docs 根 `osuperpowers/` 时同步；P1 不动。
- **P3（命令面）**：standalone CLI 面已在 P1 消除，P3 只剩 brief 自包含 + research 移除 + usage 同步。
- **P4（skills 重写）**：finishing read-base 无 artifact 推断语义在 P4 finishing 重写时定型；cli-research（P4 删除）路径文本 P1 已同步一致，删除时无残留。

---

## Section 5: Review

Rule: Fresh-Subagent Review Passes must all pass before reaching user review and writing-plans.