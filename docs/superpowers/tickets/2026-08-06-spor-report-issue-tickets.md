# Tickets: spor-report-issue

新增 `spor-report-issue` standalone skill，帮助用户在 session 结束后归纳 spor 流程问题并通过 gh CLI 提交到 Oscaner/skills；同时新增 `.github/ISSUE_TEMPLATE/` 供 web UI 使用。参见 [实施计划](../plans/2026-08-06-spor-report-issue.md) 和 [设计文档](../specs/2026-08-06-spor-report-issue-design.md)。

Work the **frontier**：T1 无阻塞可立即开始，T2 等 T1 完成，T3 等 T1 完成。

---

## Add spor-report-issue SKILL.md

**What to build:** 用户执行 `/spor-report-issue` 后，skill 能从对话上下文 + `.superpowers/sdd/*/progress.md` ledger + git log 三源归纳 bug 和 enhancement 候选，展示汇总并让用户逐条确认，对每条做重复检测（`gh issue list` 关键词匹配），最后按用户选择执行 `gh issue create` 或 `gh issue comment`，自动附加 `dogfood`、`superpowers-overrides`、可选 `sdd` label，issue 语言跟随 session 语言。

**Blocked by:** None — can start immediately.

- [ ] SKILL.md frontmatter 存在，`name: spor-report-issue`，description 包含触发说明
- [ ] Phase 1–5 流程在 SKILL.md 中完整定义
- [ ] `gh issue create --repo Oscaner/skills` 和 `gh issue comment` 的调用格式在 SKILL.md 中写明
- [ ] Bug 和 Enhancement 的中英双语 body 模板均包含在 SKILL.md 中，字段分别为 context/problem/impact/suggested-fix/related 和 context/current-behavior/desired-behavior/suggested-approach/related
- [ ] `pnpm run validate` 通过（skill dir 被自动发现）

---

## Add GitHub ISSUE_TEMPLATE files

**What to build:** GitHub repo 的 New Issue 页面出现 "Bug report" 和 "Enhancement" 两个结构化模板，字段与 SKILL.md body 模板一一对应，预设 label 分别为 `["bug"]` 和 `["enhancement"]`。

**Blocked by:** Add spor-report-issue SKILL.md（字段名对照依赖 T1）

- [ ] `.github/ISSUE_TEMPLATE/bug_report.yml` 存在，字段 id：`context`、`problem`、`impact`、`suggested-fix`、`related`，`labels: ["bug"]`
- [ ] `.github/ISSUE_TEMPLATE/enhancement.yml` 存在，字段 id：`context`、`current-behavior`、`desired-behavior`、`suggested-approach`、`related`，`labels: ["enhancement"]`
- [ ] 两个 YAML 文件的字段 id 与 SKILL.md 对应 section 标题一致
- [ ] `pnpm run validate` 通过

---

## Update README skill table

**What to build:** `plugins/superpowers-overrides/README.md` 技能表新增 `spor-report-issue` 行，使用 `Cross-cutting` 类别，便于用户发现该 skill。

**Blocked by:** Add spor-report-issue SKILL.md（确认 skill 名和功能描述）

- [ ] README 技能表中有 `| Cross-cutting | \`spor-report-issue\` | ... |` 行
- [ ] `pnpm run validate` 通过
