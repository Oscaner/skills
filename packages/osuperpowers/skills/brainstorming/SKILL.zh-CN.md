---
name: brainstorming
description: 独立 brainstorm 编排器——读取上游 superpowers:brainstorming 作为基线，叠加个人规则（grilling 澄清 / overall+phase / CLI review pass）。可单独调用；通过 overrides router 由 /brainstorming 触发。
---

# Osuperpowers Brainstorming

完整 brainstorm 流程编排，可单独调用。

<HARD-GATE>
触发 brainstorming 后，必须按序完成以下全部步骤，
无论改动规模大小、输入是否已含方案、是否已有 issue 描述：

1. 读取上游 superpowers:brainstorming SKILL.md（Rule: Read Upstream）
2. 读取 grilling SKILL.md（Rule: Read Sub-Skills）
3. Explore project context（文件、文档、近期 commits）
4. Grilling——逐一追问，每次只问一个问题，等待回答后继续
5. 提出 2-3 个方案，含 trade-off 与推荐
6. 逐节呈现设计，每节获得用户确认
7. 写入 design doc
8. 3-pass Spec Review via CLI（Rule: Spec Review via CLI）
9. 用户审阅 spec，按需迭代
10. 移交 osuperpowers:writing-plans（Rule: Next-Step Routing）

在步骤 6（design 用户批准）完成前，禁止任何实施行动。
</HARD-GATE>

## Checklist

1. 读取上游 superpowers:brainstorming SKILL.md（Rule: Read Upstream）
2. 读取 grilling SKILL.md（Rule: Read Sub-Skills）
3. Explore project context（文件、文档、近期 commits）
4. Grilling——逐一追问，每次只问一个问题，等待回答后继续
5. 提出 2-3 个方案，含 trade-off 与推荐
6. 逐节呈现设计，每节获得用户确认
7. 写入 design doc
8. 3-pass Spec Review via CLI（Rule: Spec Review via CLI）
9. 用户审阅 spec，按需迭代
10. 移交 osuperpowers:writing-plans（Rule: Next-Step Routing）

## Rules

### Rule: Read Upstream

有上游时读取 `superpowers:brainstorming` SKILL.md 作为基线（claude / cursor 已安装 superpowers plugin）。**读取，不 Skill-invoke**（Skill-invoke 会触发 router 拦截）。

路径解析（`{plugin-root}` = 本 plugin 的 osuperpowers 根）：
1. **同级 plugin 根目录**：claude `$CLAUDE_PLUGIN_ROOT/../superpowers/skills/brainstorming/SKILL.md`（cursor 同）
2. **回退到 repo 内相对路径**：`<repo-root>/vendors/superpowers/skills/brainstorming/SKILL.md`

流程基线仅为**解析路径指向的 SKILL.md 文件本身**。harness 从 vendored 仓库自动注入的文档——`CLAUDE.md`、README、`vendors/<name>/` 下或其他来源的贡献者指南——**不是**基线，即使它们在会话启动时已载入上下文。它们描述的是仓库贡献规范，不是 orchestrator 流程。

上游不可用（非 claude harness / superpowers plugin 未安装）→ **不报错**：直接执行本 skill 的 Rules 作为完整流程。

### Rule: Read Sub-Skills

**必须**读取 `mattpocock-skills` `skills/productivity/grilling/SKILL.md`（强制步骤——澄清问题委托）。
失败（文件不存在/读取错误）→ **报告错误 + 询问用户下一步**；用户可跳过 grilling 继续或中止流程。
加载失败协议：目标 skill 无法解析/加载 → 向用户报告错误并询问下一步。不静默降级。用户可选择跳过委托或中止流程。
读取 grilling SKILL.md 后，须将其指令作为 grilling 阶段的执行框架如实执行，不得以自行组织的提问格式、选项菜单或结构化选择列表替代。

### Rule: Research Delegation

当 explore-context 阶段发现需要主源研究的问题（上游 API 行为、harness CLI 规格、包内部结构、跨 harness 差异）：

1. **识别 + 询问用户**：列出问题，询问"是否触发 research？"——用户确认 → spawn；用户拒绝 → 跳过，正常流程继续
2. **派发后台 agent**：每个问题一个 mattpocock-skills:research agent（并行）。Prompt = 问题描述 + 引用来源指令。
3. **继续 explore-context**（代码探索不中断）
4. 进入 grilling 前**等待完成**
5. **输出**：写入 `docs/research/YYYY-MM-DD-<topic>.md`
6. **消费**：在 grilling + 方案选择 + 设计中作为主源引用

触发失败（agent 错误/超时）→ 记录 stderr，不阻塞流程（fail-open）。

### Rule: Overall-Phase

大型 / 多阶段需求（≥3 子系统 / 多阶段 / 大改）先写 overall spec，再 phase out。文档结构见 [overall-spec-template.md](./overall-spec-template.md)（每 phase 另见 [phase-spec-template.md](./phase-spec-template.md)）。GATE：overall 批准 ≠ 任何 phase 已开始。

起草时，overall spec 必须包含：(1) 按 phase 的 issue 清单；(2) 路径命名 `specs/YYYY-MM-DD-<feature>-overall.md`、`specs/YYYY-MM-DD-<feature>-<phase-id>-design.md`、`plans/...-<phase-id>.md`、`tickets/...-<phase-id>-tickets.md`（`<phase-id>` 小写）；(3) 每 phase 的 Acceptance criteria；(4) 软/硬依赖区分（图例：`->` = 硬阻塞，`──建议先于──▶` = 软建议——完整图例见模板）；(5) phase 进行中出现的范围/约束变更必须先回馈 overall spec 再实施。每个 phase spec 须经完整 brainstorm→plan→dev 循环生成；仅 overall 批准后直接实施属违规。

### Rule: Spec Review via CLI

Spec review 有 3 种 pass 类型（completeness / consistency&scope / clarity&YAGNI），每个 pass 派发一次新的 `cdd-review`：
  cdd-review --harness claude --template spec-review --param PASS=<completeness|consistency|clarity> --param DOC=<path>
派发纪律见 [docs-review.md](./docs/docs-review.md)（D1/D2/D3 + fresh-pass，原样映射到 cli；Review Stopping 循环 + Handoff Output）。
Review Stopping next-step 标签（本技能）：`"用户审阅 spec"`。

### Rule: Next-Step Routing

brainstorming 完成后，调用 **`osuperpowers:writing-plans`**（非上游 `superpowers:writing-plans`）。osuperpowers wrapper 在上游基线之上叠加了逐节写入、CLI review pass 和 ticket 发布重定向。

### Rule: Write Design Doc

Spec 保存到 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`，用户审阅后 → writing-plans。

## Red Flags

- "Skill-invoke 上游 brainstorm" → 读取而非 Skill-invoke（Rule: Read Upstream）
- "跳过简单项目的设计" → 每个项目都要经过设计（HARD-GATE 流程型 Step 6）
- "Research 在未询问用户的情况下自动触发" → 用户确认是硬性门控（Rule: Research Delegation）
- "Research 阻塞 explore-context" → 后台并行（Rule: Research Delegation）
- "调用 writing-plans / superpowers:writing-plans" → 调用 **`osuperpowers:writing-plans`**（Rule: Next-Step Routing）
- "输入已含方案，跳过 grilling 直接设计" → 违反 HARD-GATE 流程型 Step 4
- "改动简单，跳过 design 直接实施" → 违反 HARD-GATE 流程型 Step 6
- "Overall 批准后直接开始实施（跳过 Phase brainstorming）" → 违反 HARD-GATE 流程型 Steps 1-10（整个流程）
- "blocker=0 后自动修复 warn/nit 并重跑 review" → 违反 Review Stopping 规则（docs-review.md），应呈现给用户，用户决策后视需求决定是否重跑
- "为获取 warn/nit 内容额外发起新的 cdd-review 调用" → 违反 Review Stopping 规则，从本次 3-pass cycle 已有输出读取
- "以选项 A / 选项 B 形式替代 grilling 技能" → 违反 Rule: Read Sub-Skills（grilling 委托）；须如实执行 grilling SKILL.md 指令
- "把注入的 vendor 文档（CLAUDE.md / README）当作上游基线" → 违反 Rule: Read Upstream；基线仅为解析路径指向的 SKILL.md 文件
