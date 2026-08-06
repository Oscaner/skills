# spor-report-issue 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 superpowers-overrides plugin 中新增独立 skill `spor-report-issue`，帮助用户在 session 结束后归纳 spor 流程问题并通过 gh CLI 按模板提交到 Oscaner/skills GitHub repo；同时新增 `.github/ISSUE_TEMPLATE/` 模板供 web UI 使用。

**Architecture:** 三个独立交付单元串行执行。T1 新增 SKILL.md 主体（含流程逻辑和双语 body 模板）；T2 新增 GitHub ISSUE_TEMPLATE YAML 文件；T3 注册 skill 到 plugin.json 并更新 README。T1 是 T2/T3 的规格参照，T3 依赖 T1 的 skill 目录存在。

**Tech Stack:** Markdown、YAML（GitHub Issue Forms）；验证命令 `pnpm run validate`

## Global Constraints

- `spor-report-issue` 是 standalone skill，不 override 任何上游 skill，不入 `overrides.manifest.json`
- SKILL.md 命名约定：`spor-<name>`，frontmatter `name:` 和 `description:` 必填
- ISSUE_TEMPLATE 字段结构必须与 SKILL.md 内嵌 CLI 模板完全一致（同字段名）
- Labels：`bug_report.yml` 预设 `["bug"]`，`enhancement.yml` 预设 `["enhancement"]`；其余 label 由 skill 通过 `gh issue create --label` 动态追加
- `pnpm run validate` 必须全部通过
- 提交信息使用 conventional commits，无 attribution/co-author trailer

---

## File Map

| 文件 | 操作 | Task |
|------|------|------|
| `plugins/superpowers-overrides/skills/spor-report-issue/SKILL.md` | Create | T1 |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Create | T2 |
| `.github/ISSUE_TEMPLATE/enhancement.yml` | Create | T2 |
| `plugins/superpowers-overrides/.claude-plugin/plugin.json` | 无需修改（skills 用目录 glob `./skills/`，新增目录自动注册） | — |
| `plugins/superpowers-overrides/README.md` | Modify | T3 |

> **注：** `plugin.json` 使用 `"skills": "./skills/"` 目录 glob，新增 `skills/spor-report-issue/` 目录后自动被发现，无需手动修改。

---

### Task 1: 创建 `spor-report-issue/SKILL.md`

**Files:**
- Create: `plugins/superpowers-overrides/skills/spor-report-issue/SKILL.md`

**Interfaces:**
- Consumes: 无前置任务依赖
- Produces: 完整 SKILL.md，T2 以此为 body 模板字段对照，T3 以此为 README 说明依据

- [ ] **Step 1: 创建 SKILL.md — frontmatter**

  创建 `plugins/superpowers-overrides/skills/spor-report-issue/SKILL.md`，写入 frontmatter：

  ```markdown
  ---
  name: spor-report-issue
  description: Analyse the current spor session for bugs and enhancement opportunities, then offer to file GitHub issues via gh CLI against Oscaner/skills. Trigger on `/spor-report-issue` or `/superpowers-overrides:spor-report-issue`. Run after finishing a development session — reads conversation context, .superpowers/sdd/*/progress.md ledgers, and git log to surface findings.
  ---
  ```

- [ ] **Step 2: 写入 skill 主体 — 定位与触发说明**

  在 frontmatter 后追加：

  ```markdown
  # spor-report-issue

  Standalone skill — not an override. Reads the current session and summarises spor workflow problems and optimisation candidates, then offers to file them as GitHub issues.

  ## Trigger

  `/spor-report-issue` or `/superpowers-overrides:spor-report-issue`. Manual only — never auto-triggered.

  ## Target repo

  `Oscaner/skills` (the repository this plugin lives in). All `gh` commands target this repo.
  ```

- [ ] **Step 3: 写入五阶段流程**

  追加以下内容：

  ````markdown
  ## Process

  ### Phase 1 — Gather information

  Read three sources in priority order:

  1. **Conversation context** (primary): tool call records, error messages, handoff statuses, review findings visible in this session.
  2. **Ledgers**: read every `.superpowers/sdd/*/progress.md` present in the repo root. Extract lines containing `fix round`, `BLOCKED`, `parked`, `deferred minor`, `CHANGES_REQUESTED`.
  3. **Git log**: run `git log $(git merge-base HEAD origin/main)..HEAD --oneline`. Fall back to `git log -20 --oneline` if `origin/main` is unavailable. Identify `fix:` prefix commits and any repeated fix-round patterns.

  ### Phase 2 — Classify and summarise (Claude reasoning)

  Classify each finding into one of two types:

  | Type | Criteria | Label |
  |------|----------|-------|
  | `bug` | Tool/script behaved differently from spec — timeouts, wrong exit codes, gate misjudgements, handoff schema errors | `bug` |
  | `enhancement` | Process could improve without being broken — DX gaps, missing docs, insufficient CI coverage, template gaps | `enhancement` |

  Each finding must include:
  - **Title** — short, usable as an issue title
  - **One-line description**
  - **Affected component** — skill name, script path, or command
  - **Evidence** — specific error text or ledger entry

  ### Phase 3 — Show summary, get confirmation

  Present findings as a numbered list. Ask the user:
  - Is this accurate overall?
  - Anything to remove or add?

  Proceed to Phase 4 only after explicit confirmation.

  ### Phase 4 — Process each finding (dedup check + submit)

  For each confirmed finding:

  1. Run: `gh issue list --state open --limit 100 --json number,title,body`
  2. Extract keywords from the finding: **affected component name** (e.g. `sdd-run-task-claude.sh`, `handoff-writer`, `gate`) and **core behaviour words** (e.g. `timeout`, `CHANGES_REQUESTED`, `exit 137`). Match case-insensitively as substrings against existing issue titles and bodies.
  3. **Match found** → show matching issues, ask user: **Create new issue / Add comment to existing / Skip**
  4. **No match** → ask user: **Create new issue / Skip**
  5. Execute the chosen action.

  **Language rule:** Detect session language from the user's most recent messages. Use that language for issue titles and bodies. Fall back to English.

  **Labels applied automatically by this skill:**

  | Label | When |
  |-------|------|
  | `bug` or `enhancement` | Always — matches finding type |
  | `dogfood` | Always — all issues filed by this skill are found during dogfood |
  | `superpowers-overrides` | Always — hardcoded to this plugin name |
  | `sdd` | When finding mentions SDD, H6 CLI chain, orchestrator, or handoff |

  **`gh issue create` invocation pattern:**
  ```bash
  gh issue create \
    --repo Oscaner/skills \
    --title "<title>" \
    --label "bug,dogfood,superpowers-overrides" \
    --body "<rendered body from template below>"
  ```

  **`gh issue comment` invocation pattern:**
  ```bash
  gh issue comment <number> \
    --repo Oscaner/skills \
    --body "<rendered body from template below>"
  ```

  ### Phase 5 — Final report

  Print all outcomes:
  - Created issue → URL
  - Added comment → URL
  - Skipped → list with reason
  ````

- [ ] **Step 4: 写入双语 body 模板**

  追加 Bug 和 Enhancement 的中英双语模板：

  ````markdown
  ## Issue Body Templates

  Select the template matching the session language (detected in Phase 4).

  ### Bug — English

  ```markdown
  ## Context

  <!-- dogfood session context: branch, date, spor skills in use -->

  ## Problem

  <!-- what happened, with exact error messages or tool output -->

  ## Impact

  <!-- what this blocked or degraded — token cost, extra rounds, incorrect state -->

  ## Suggested fix

  <!-- concrete suggestion, or "Under investigation" -->

  ## Related

  <!-- links to related issues or commits, if known -->
  ```

  ### Bug — 中文

  ```markdown
  ## 背景

  <!-- Dogfood session 上下文：分支、日期、使用了哪些 spor skill -->

  ## 问题

  <!-- 发生了什么，尽量附上具体报错信息或工具输出 -->

  ## 影响

  <!-- 阻塞或降级了什么——token 消耗、额外轮次、状态错误等 -->

  ## 建议修复

  <!-- 具体建议；若暂不清楚则写"待排查" -->

  ## 相关

  <!-- 相关 issue 链接或 commit，如有 -->
  ```

  ### Enhancement — English

  ```markdown
  ## Context

  <!-- dogfood session context: branch, date, spor skills in use -->

  ## Current behavior

  <!-- what happens today -->

  ## Desired behavior

  <!-- what should happen instead -->

  ## Suggested approach

  <!-- concrete suggestion, or "Open for discussion" -->

  ## Related

  <!-- links to related issues or commits, if known -->
  ```

  ### Enhancement — 中文

  ```markdown
  ## 背景

  <!-- Dogfood session 上下文：分支、日期、使用了哪些 spor skill -->

  ## 当前行为

  <!-- 目前的实际表现 -->

  ## 期望行为

  <!-- 应该是什么表现 -->

  ## 建议方案

  <!-- 具体建议；若暂不清楚则写"欢迎讨论" -->

  ## 相关

  <!-- 相关 issue 链接或 commit，如有 -->
  ```
  ````

- [ ] **Step 5: 运行 validate 并确认通过**

  ```bash
  pnpm run validate
  ```

  预期：`ALL PASS`。重点看 `== 2. every skill dir has SKILL.md ==` 和 `== 3. no orphan skill dirs ==`。

- [ ] **Step 6: 提交**

  ```bash
  git add plugins/superpowers-overrides/skills/spor-report-issue/SKILL.md
  git commit -m "feat: add spor-report-issue skill"
  ```

---

### Task 2: 创建 `.github/ISSUE_TEMPLATE/` 模板

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/enhancement.yml`

**Interfaces:**
- Consumes: T1（字段名与 SKILL.md 内嵌模板保持一致）
- Produces: GitHub web UI issue 创建时可选的结构化模板

- [ ] **Step 1: 创建 `.github/ISSUE_TEMPLATE/` 目录并写 `bug_report.yml`**

  创建 `.github/ISSUE_TEMPLATE/bug_report.yml`，内容如下：

  ```yaml
  name: Bug report
  description: Report a bug found while using spor skills (dogfood)
  labels: ["bug"]
  body:
    - type: markdown
      attributes:
        value: |
          Use this template to report bugs found during dogfood use of spor skills.
          Additional labels (`dogfood`, `superpowers-overrides`, `sdd`) will be added by maintainers.
    - type: textarea
      id: context
      attributes:
        label: Context
        description: "Dogfood session context: branch, date, which spor skills were in use"
        placeholder: "Branch: feat/my-feature, Date: 2026-08-06, Skills: spor-subagent-driven-development, spor-writing-plans"
      validations:
        required: true
    - type: textarea
      id: problem
      attributes:
        label: Problem
        description: What happened? Include exact error messages or tool output where available.
      validations:
        required: true
    - type: textarea
      id: impact
      attributes:
        label: Impact
        description: "What did this block or degrade — token cost, extra rounds, incorrect state?"
      validations:
        required: true
    - type: textarea
      id: suggested-fix
      attributes:
        label: Suggested fix
        description: Concrete suggestion, or leave as "Under investigation"
        placeholder: Under investigation
      validations:
        required: false
    - type: textarea
      id: related
      attributes:
        label: Related
        description: Links to related issues or commits, if known
      validations:
        required: false
  ```

- [ ] **Step 2: 创建 `enhancement.yml`**

  创建 `.github/ISSUE_TEMPLATE/enhancement.yml`，内容如下：

  ```yaml
  name: Enhancement
  description: Suggest an improvement to spor skills or workflow
  labels: ["enhancement"]
  body:
    - type: markdown
      attributes:
        value: |
          Use this template to suggest improvements found during dogfood use of spor skills.
          Additional labels (`dogfood`, `superpowers-overrides`, `sdd`) will be added by maintainers.
    - type: textarea
      id: context
      attributes:
        label: Context
        description: "Dogfood session context: branch, date, which spor skills were in use"
        placeholder: "Branch: feat/my-feature, Date: 2026-08-06, Skills: spor-subagent-driven-development"
      validations:
        required: true
    - type: textarea
      id: current-behavior
      attributes:
        label: Current behavior
        description: What happens today?
      validations:
        required: true
    - type: textarea
      id: desired-behavior
      attributes:
        label: Desired behavior
        description: What should happen instead?
      validations:
        required: true
    - type: textarea
      id: suggested-approach
      attributes:
        label: Suggested approach
        description: Concrete suggestion, or "Open for discussion"
        placeholder: Open for discussion
      validations:
        required: false
    - type: textarea
      id: related
      attributes:
        label: Related
        description: Links to related issues or commits, if known
      validations:
        required: false
  ```

- [ ] **Step 3: 验证字段名与 SKILL.md 模板一致**

  对照 T1 创建的 SKILL.md 中的 body 模板字段，确认：

  | ISSUE_TEMPLATE 字段 id | SKILL.md Bug 模板标题 |
  |------------------------|----------------------|
  | `context` | `## Context` / `## 背景` |
  | `problem` | `## Problem` / `## 问题` |
  | `impact` | `## Impact` / `## 影响` |
  | `suggested-fix` | `## Suggested fix` / `## 建议修复` |
  | `related` | `## Related` / `## 相关` |

  | ISSUE_TEMPLATE 字段 id | SKILL.md Enhancement 模板标题 |
  |------------------------|------------------------------|
  | `context` | `## Context` / `## 背景` |
  | `current-behavior` | `## Current behavior` / `## 当前行为` |
  | `desired-behavior` | `## Desired behavior` / `## 期望行为` |
  | `suggested-approach` | `## Suggested approach` / `## 建议方案` |
  | `related` | `## Related` / `## 相关` |

- [ ] **Step 4: 运行 validate 并确认通过**

  ```bash
  pnpm run validate
  ```

  预期：`ALL PASS`（ISSUE_TEMPLATE YAML 不在 validate 检测范围内，但确认无其他破坏）。

- [ ] **Step 5: 提交**

  ```bash
  git add .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/enhancement.yml
  git commit -m "feat: add GitHub issue templates for bug and enhancement"
  ```

---

### Task 3: 更新 README

**Files:**
- Modify: `plugins/superpowers-overrides/README.md`

**Interfaces:**
- Consumes: T1（skill 名、触发方式、功能描述）
- Produces: README 技能表中包含 `spor-report-issue` 条目

- [ ] **Step 1: 在 README 技能表末尾添加 `spor-report-issue` 行**

  在 `plugins/superpowers-overrides/README.md` 的技能表中，`spor-handoff-writer` 行后面追加：

  ```markdown
  | Cross-cutting | `spor-report-issue` | Analyse spor session findings and file GitHub issues via gh CLI; manual only |
  ```

- [ ] **Step 2: 运行 validate 并确认通过**

  ```bash
  pnpm run validate
  ```

  预期：`ALL PASS`。

- [ ] **Step 3: 提交**

  ```bash
  git add plugins/superpowers-overrides/README.md
  git commit -m "docs: add spor-report-issue to README skill table"
  ```
