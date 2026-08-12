# os-engineering P2 阶段设计：os-* 家族抽离（核心集）

## Header

- **Version**: v1.0 · 2026-08-10
- **Status**: Draft
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering 整体设计 v1.5](2026-08-10-os-engineering-overall.md)
- **Depends on**: P1（os-engineering 插件 + cli-* 家族 + cdd 引擎已就位）

## §0 Incremental warning

> P2 增量只涉及本阶段。跨阶段约定以 overall v1.5 为准；冲突时 overall 优先。

## §1 Constraints pointer

不重复 overall 约定。P2 生效的约束：

- os-* 核心集审计（**不做 1:1 对齐**）：8 技能，剔除 os-testing
- 统一骨架：`Resolve {superpowers-plugin-root} → Read skills/<name>/SKILL.md → 按序 Read 子技能 → 应用个人规则`（**Read 而非 Skill-invoke**，避免 spor 拦截）
- 语义规则名 `### Rule: <Name>` + `#rule-<kebab>` 链接
- spor-* 同步瘦身成薄指针（P2 内完成，规则只留一份）
- gate 模式感知过渡期留 overrides（P3 随薄封装迁）
- 过渡期 `pnpm run validate` 必须保持通过

## §2 Design body

### 架构

在 os-engineering 新增 os-* 家族（8 独立流程编排器），superpowers-overrides 的对应 spor-* 同步瘦身成薄指针；gate 增加模式感知（pending.mode）留 overrides；cross-cutting 技能降为 os-engineering docs。

```
plugins/os-engineering/
  skills/
    os-brainstorming/SKILL.md
    os-writing-plans/SKILL.md
    os-executing-plans/SKILL.md
    os-finishing/SKILL.md
    os-verification/SKILL.md
    os-debugging/SKILL.md
    os-code-review/SKILL.md
    os-report-issue/SKILL.md
    (既有 cli-* 4 技能)
  docs/
    subagent-lifecycle.md
    review-dispatch.md
    overall-phase-spec-template.md
    (既有 cdd-reference / controller-handoff / handoff-schema)
```

### 组件

#### A. os-* 技能（8 个）—— 统一骨架 + 各核心规则

每个 os-* SKILL.md 遵循：

```
## Rules
### Rule: Read Upstream
Resolve `{superpowers-plugin-root}`：优先 `$CLAUDE_PLUGIN_ROOT/../superpowers`（已安装 marketplace，CLAUDE_PLUGIN_ROOT = 当前插件根 env），回退 repo 中 os-engineering 同级 `plugins/superpowers`；两者皆无 → 报错 + 提示解析路径。Read `skills/<name>/SKILL.md` 作为流程基线。
### Rule: Read Sub-Skills
按需 Read 子技能（mattpocock-skills 同理解析）。
### Rule: <个人规则 1..N>（源自当前 spor-* 规则，重述为独立流程）
```

| os-* | Read 上游 | 核心规则 |
|---|---|---|
| os-brainstorming | superpowers:brainstorming + mattpocock grilling | overall+phase（Read docs/overall-phase-spec-template.md）、fresh-subagent 评审 passes（Read docs/review-dispatch.md + docs/subagent-lifecycle.md） |
| os-writing-plans | superpowers:writing-plans + to-tickets | 逐节写、fresh-subagent 评审 passes、tickets 发布重定向到 docs/superpowers/tickets/ |
| os-executing-plans | in-session→superpowers:executing-plans / subagent→superpowers:subagent-driven-development | **编排器控制器 Rules 1-8**（任务分类 / 确认一次 / cheaper-models / 逐任务评审门 / 质量不变量 test-evidence+plan-conflicts+unverifiable+NEEDS_CONTEXT / CLI 派发 / D6 终盘聚合）+ 三模式分派：**cli 模式** → 控制器先跑（选 harness + 写 pending.mode=cli）再完全委托 cli-driven-development 执行；**in-session/subagent 模式** → 控制器全程驱动 |
| os-finishing | superpowers:finishing-a-development-branch | 禁 worktree（吸收 spor-using-git-worktrees 策略）、conventional、无 attribution、Option4 输入 discard |
| os-verification | superpowers:verification-before-completion | pre-claim gate + 软化语言自检（源自 spor-verification-before-completion Rules 1-2） |
| os-debugging | superpowers:systematic-debugging | 无诊断证据不提案（源自 spor-systematic-debugging Rule 1）+ 委派 mattpocock diagnosing-bugs |
| os-code-review | superpowers:receiving-code-review | grilling 澄清（Rule: Understand）+ tdd 委派（Rule: Implement，可选调 cli-code-review） |
| os-report-issue | （迁移 spor-report-issue，repo 开发工具） | 会话分析（ledger/progress.md + git log）→ 提 GitHub issue |

#### B. 不建 os-* 的处置

| 上游 | 处置 |
|---|---|
| superpowers:test-driven-development | `/test-driven-development` 薄封装直映 `mattpocock-skills:tdd`；**seam 确认门折进 cli-driven-development implement 模式**（`templates/cdd/implement.md`：调 tdd 前先确认 seam） |
| superpowers:executing-plans | 直映 os-executing-plans（本就重定向存根） |
| superpowers:using-git-worktrees | 吸收进 os-finishing（一句话策略） |
| spor-sdd-p0-fallback | **删除**（死代码） |

#### C. cross-cutting → docs（os-engineering/docs/）

- `spor-subagent-lifecycle` → `docs/subagent-lifecycle.md`（fresh subagent per pass、并发 iff 独立）
- `spor-token-efficient-review-dispatch` → `docs/review-dispatch.md`（D1/D2/D3）
- overall+phase 模板（自 spor-brainstorming/overall-phase-spec-template.md）→ `docs/overall-phase-spec-template.md`

#### D. spor-* 同步瘦身（overrides 侧）

8 个被抽离的 spor-* → 薄指针（frontmatter 保留 4 触发描述 + body 一行 `invoke Skill(os-<X>)`；frontmatter 与未变的 `^superpowers:` hook 维持触发拦截）：
spor-brainstorming / spor-writing-plans / spor-subagent-driven-development / spor-finishing-a-development-branch / spor-receiving-code-review / spor-systematic-debugging / spor-verification-before-completion / spor-report-issue

处置：
- spor-executing-plans → 改映射到 os-executing-plans（薄指针）
- spor-using-git-worktrees → **保留薄指针指向 os-finishing**（规则并入 os-finishing；P3 前触发槽位持续工作，不删除）
- spor-test-driven-development → 改映射到 mattpocock-skills:tdd（薄指针）
- spor-sdd-p0-fallback → 删除
- spor-subagent-lifecycle / spor-token-efficient-review-dispatch → 删除（内容已迁 docs）

> 薄指针保留技能位使 hooks/触发表（P3 才重写）持续工作。

#### E. gate 模式感知（overrides，过渡期）

- `cdd-session-activate.sh` 写 pending 时带 `mode` 字段（in-session|subagent|cli）；mode 经 `--mode <...>` 参数或 `CDD_SESSION_MODE` env 传入。**非 os-executing-plans 流程**（无 mode）→ 默认 fail-open（gate 不误伤）。
- `cdd-orchestrator-gate.sh` 读 `pending.mode`：
  - **cli** → 严格（repo 编辑只走 CLI shell，现有逻辑）
  - **in-session / subagent** → 放行 repo 编辑（keep 只读 git Bash 白名单）
  - 无 mode / 无 pending → fail-open

#### F. cdd implement seam 门（执行中修订：阻塞门移到编器层）

- **编器层**（os-executing-plans）：派发会用 tdd 的 implement worker 前，编器在会话内向用户确认 seam（边界），把 `CONFIRMED_SEAMS` 写进 task brief
- **模板层**：`templates/cdd/implement.md` 非阻塞 ——「若 brief 含 `CONFIRMED_SEAMS`，应用之」；不阻塞等待（一次性 print-mode CLI 无法阻塞）
- 修订原因：执行暴露阻塞 seam 门破坏非 tdd implement 派发（plan_conflict，用户裁决移到编器层）

### 数据流

```
用户调用 /os-executing-plans 或 os-executing-plans（直接）
  → Rule: Read Upstream（按模式 Read executing-plans / subagent-driven-development / cli-driven-development）
  → 用户选模式（in-session | subagent | cli）
  → session-activate 写 pending.mode
  → 编排器控制器 Rules 1-8（分类/确认/派发/评审门/D6）
  → cli 模式 → cdd-run.sh --harness；in-session/subagent → gate 放行 repo 编辑
```

### 错误处理

| 场景 | 行为 |
|------|------|
| 上游 superpowers SKILL.md 解析失败 | os-* 技能报错 + 提示解析路径 |
| pending 无 mode 字段 | gate fail-open（不误伤） |
| 用户选 cli 但无 full harness | 复用 cli-select BLOCKED |
| spor-* 薄指针被调用 | 转发到 os-X（body 一行链接） |

### 测试

- rule-reference.test.py 双模式扩展校验 os-*（语义 `Rule: <Name>` + `#rule-<kebab>` 锚点），同时校验 overrides（数字过渡期）+ os-engineering（语义）
- gate mode 测试：in-session/subagent 放行 repo 编辑、cli 严格（新 fixture）
- cdd implement seam 门测试（templates 断言）
- `pnpm run validate` ALL PASS

### 验收标准

- [ ] os-engineering/skills/ 下 8 个 os-* SKILL.md，统一骨架 + 语义规则名，通过 rule-reference
- [ ] os-executing-plans 三模式分派（in-session/subagent/cli）+ 编排器控制器 Rules 1-8
- [ ] spor-* 8 个薄指针 + executing-plans/using-git-worktrees/test-driven-development 映射 + p0-fallback 删除
- [ ] cross-cutting 3 docs（subagent-lifecycle/review-dispatch/overall-phase-spec-template）迁入 os-engineering
- [ ] gate 模式感知（pending.mode）+ 测试通过
- [ ] cdd implement seam 门落地
- [ ] `pnpm run validate` ALL PASS；零 sdd 残留（既有 5c 检查持续）

## §3 Deviations from overall

| Overall 假设 | 阶段决定 | Overall 已更新? |
|---|---|---|
| P2 有 os-testing（9 技能） | 剔除 os-testing（核心集审计），tdd 直映 mattpocock + seam 门折进 cdd implement | 是（v1.5 P2 行） |
| gate 迁至 os-engineering（P2） | gate 模式感知过渡期留 overrides，P3 随薄封装迁 | 是（v1.5 约束） |
| spor-* 薄指针化归 P3 | spor-* 薄指针化提前到 P2（规则只留一份，防漂移），P3 仅剩 hooks/生成器/自检表重写 | 用户已确认（grilling「P2 同步瘦身」） |

## §4 Notes for downstream（P3）

- P3：gate 迁至 os-engineering + 薄封装 hooks/生成器/自检表重写（spor-* 薄指针 → 纯触发映射）+ os-init 参数化 + os-engineering 完整版本化
- P3 薄封装后 rule-reference 数字模式失效，只剩语义

## §5 Review

Rule 1 passes（Completeness → Consistency & scope → Clarity & YAGNI）before user review and writing-plans。
