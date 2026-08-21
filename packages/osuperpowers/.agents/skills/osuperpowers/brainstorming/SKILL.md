---
name: brainstorming
description: Independent brainstorm orchestrator -- Reads upstream superpowers:brainstorming as baseline, layers personal rules (grilling clarification / overall+phase / cli review passes). Callable standalone; triggered by /brainstorming via overrides router.
---

# Osuperpowers Brainstorming

Full brainstorm flow orchestration, callable standalone.

<HARD-GATE>
触发 brainstorming 后，必须按序完成以下全部步骤，
无论改动规模大小、输入是否已含方案、是否已有 issue 描述：

1. 读取上游 superpowers:brainstorming SKILL.md（Rule: Read Upstream）
2. 读取 grilling SKILL.md（Rule: Read Sub-Skills）
3. Explore project context（文件、文档、近期 commits）
4. Grilling——逐一追问，每次只问一个问题
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
4. Grilling——逐一追问，每次只问一个问题
5. 提出 2-3 个方案，含 trade-off 与推荐
6. 逐节呈现设计，每节获得用户确认
7. 写入 design doc
8. 3-pass Spec Review via CLI（Rule: Spec Review via CLI）
9. 用户审阅 spec，按需迭代
10. 移交 osuperpowers:writing-plans（Rule: Next-Step Routing）

## Rules

### Rule: Read Upstream

Read upstream `superpowers:brainstorming` SKILL.md as the process baseline **when available** (claude / cursor has superpowers plugin installed). **Read, not Skill-invoke** (Skill-invoke triggers the router interception).

Resolve paths (`{plugin-root}` = this plugin's osuperpowers root):
1. **Sibling plugin root**: claude `$CLAUDE_PLUGIN_ROOT/../superpowers/skills/brainstorming/SKILL.md` (same for cursor)
2. **Fallback same-repo relative path**: `<repo-root>/vendors/superpowers/skills/brainstorming/SKILL.md`

Upstream unavailable (non-claude harness / superpowers plugin not installed) → **no error**: execute this skill's own Rules as the complete flow directly.

### Rule: Read Sub-Skills

**Must** read `mattpocock-skills` `skills/productivity/grilling/SKILL.md` (mandatory step — clarification question delegation).
On failure (file not found / read error) → **report error + ask the user for next steps**; user may skip grilling and continue, or abort the flow.
Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).

### Rule: Research Delegation

When the explore-context phase discovers questions requiring primary source research (upstream API behavior, harness CLI specs, package internals, cross-harness differences):

1. **Identify + ask the user**: list questions, ask "trigger research?" — user confirms → spawn; user declines → skip, normal flow continues (explore-context → grilling)
2. **Spawn background agent**: one mattpocock-skills:research agent per question (parallel). Prompt = question + cite sources instruction.
3. **Continue explore-context** (code exploration is not interrupted)
4. **Wait for completion** before entering grilling
5. **Output**: findings written to `docs/research/YYYY-MM-DD-<topic>.md`
6. **Consumption**: research findings referenced as primary sources in grilling + approach selection + design

Trigger failure (research agent error/timeout) → log stderr, do not block flow (fail-open).

### Rule: Overall-Phase

Large requirements (>=3 subsystems / multi-phase / overhaul) write an overall spec first, then phase out. Document structure: see [overall-phase-spec-template.md](../docs/overall-phase-spec-template.md). GATE: overall approval != phase started.

### Rule: Spec Review via CLI

Spec review has 3 pass types (completeness / consistency&scope / clarity&YAGNI), each pass dispatches a fresh `cdd-review`:
  cdd-review --harness claude --template spec-review --param PASS=<completeness|consistency|clarity> --param DOC=<path>
Dispatch discipline: see [docs-review.md](../docs/docs-review.md) (D1/D2/D3 + fresh-pass, mapped verbatim to cli; Review Stopping loop + Handoff Output `[Engine pending P2]`).

### Rule: Next-Step Routing

After brainstorming completes, invoke **`osuperpowers:writing-plans`** (not upstream `superpowers:writing-plans`). The osuperpowers wrapper adds section-by-section writing, cli review passes, and ticket publish redirect on top of the upstream baseline.

### Rule: Write Design Doc

Spec saved to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, after user review → writing-plans.

## Red Flags

- "Skill-invoke upstream brainstorm" → Read instead of Skill-invoke (Rule: Read Upstream)
- "Skip design for simple projects" → every project goes through design (HARD-GATE 流程型 Step 6)
- "Research auto-triggers without asking user" → user confirmation is a hard gate (Rule: Research Delegation)
- "Research blocks explore-context" → background parallel (Rule: Research Delegation)
- "Invoke writing-plans / superpowers:writing-plans" → invoke **`osuperpowers:writing-plans`** (Rule: Next-Step Routing)
- "输入已含方案，跳过 grilling 直接设计" → 违反 HARD-GATE 流程型 Step 4
- "改动简单，跳过 design 直接实施" → 违反 HARD-GATE 流程型 Step 6
- "Overall 批准后直接开始实施（跳过 Phase brainstorming）" → 违反 HARD-GATE 流程型 Steps 1-10（整个流程）
- "blocker=0 后自动修复 warn/nit 并重跑 review" → 违反 Review Stopping 规则（docs-review.md），应呈现给用户，用户决策后视需求决定是否重跑
- "为获取 warn/nit 内容额外发起新的 cdd-review 调用" → 违反 Review Stopping 规则，从本次 3-pass cycle 已有输出读取
