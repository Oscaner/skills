# Pα — Engine Fixes Design Spec

- **Version**: v1.0 · 2026-08-31
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)
- **Parent program**: [post-dogfood-bugfixes](./2026-08-31-post-dogfood-bugfixes-overall.md) v1.3
- **Depends on**: none

---

> Pα increment only. Cross-phase conventions in [overall](./2026-08-31-post-dogfood-bugfixes-overall.md); overall wins on conflict.

---

## §1 Scope

四个 engine 层 bugfix：

- **#200** — `commits.head` phantom SHA 校验（runner.mjs review-package 前）
- **#176** — implement.md / fix.md 跨任务边界提交约束
- **#175** — task-review mode-phase 一致性守卫 + findings 产出保护
- **#191** — deferred-sweep findings 清零 + sweep 终态写入

---

## §2 Design

### 2.1 #200 — phantom SHA 校验

**改动文件**：`packages/osuperpowers/bin/engine/lib/contract.mjs`、`packages/osuperpowers/bin/engine/lib/runner.mjs`

**contract.mjs 新增导出**：`gitCatFileCommitExists(sha, cwd)` — 执行 `git cat-file -e ${sha}^{commit}`，返回 boolean。命令失败 → false（fail-open，与现有 git helper 风格一致）。

**runner.mjs 步骤 5 修改**（task-review `runReviewPackage` 之前）：读取 handoff `commits.head`，调用 `gitCatFileCommitExists` 校验可达性；无效 → `finish(1, [], "review-package: commits.head ${head} is not a reachable commit object")`。

**步骤 9 的 `validateCommitContract` 不改动**——task-review mode 直接 no-op（`mode !== "implement" && mode !== "fix"`），不存在 F1 覆盖 phantom SHA 的路径，正是步骤 5 新增校验的原因。

### 2.2 #176 — 跨任务边界提交约束

**改动文件**：`packages/osuperpowers/templates/cdd/implement.md`、`packages/osuperpowers/templates/cdd/fix.md`

两份模板 Commit 条款追加：

> Only commit changes within this task brief scope. If you encounter uncommitted changes belonging to other tasks — do NOT stage, commit, or revert them; leave as-is. If out-of-scope uncommitted changes exist at return, write status: BLOCKED + `blocker:` listing the out-of-scope paths, so the orchestrator decides.

### 2.3 #175 — task-review mode-phase 守卫

**改动文件**：`packages/osuperpowers/bin/engine/lib/runner.mjs`、`packages/osuperpowers/templates/cdd/task-review.md`

**防御层 — runner.mjs 步骤 9 前**：mode-phase 一致性校验在 sweep 收口之前执行。具体顺序：① mode-phase 校验（#175）→ ② sweep 收口（#191）→ ③ commit-contract（步骤 9）。mode-phase 校验优先于 sweep，确保 handoff `phase` 字段准确后再执行 sweep 逻辑。

具体逻辑：读取 handoff JSON 的 `phase` 字段，与 runner.mjs 的 `mode` 参数（即 `CDD_MODE`）对比。若不一致（例如 handoff `phase` 为 `"implement"` 而 `mode` 为 `"task-review"`），以 `mode` 为准覆写 handoff `phase`，并向 stderr 输出审计警告格式：`[audit] handoff phase '${existingPhase}' corrected to '${mode}'`。不拦截流程。

**保护层 — task-review.md 模板 Instructions**：新增明确指令 — review findings 必须写入 `{{HANDOFF}}` JSON 文件，不可仅通过 stdout 返回；findings[] 为空或缺失时视为无发现。

**不改动 `validateCommitContract`**——task-review no-op 行为正确。

### 2.4 #191 — deferred-sweep 清零

**改动文件**：`packages/osuperpowers/bin/engine/lib/runner.mjs`、`packages/osuperpowers/skills/cli-driven-development/SKILL.md`

**runner.mjs 步骤 9 前新增 fix-mode sweep 收口**：`scope === "deferred-sweep"` 且 `agentRc === 0` 时，通过 `writeHandoff` 将 handoff JSON 中 `findings[]` 清空为 `[]`（已过 review 验证，无论是否产生 commit），同时将 `status` 写为最终态（`APPROVED`）。`agentRc ≠ 0` 时不做 sweep，deferred findings 保留在 handoff 中供下次重试，`status` 不 touch（保留原值，避免与 agent 失败语义冲突）。

**cli-driven-development SKILL.md**：deferred-disposition 节点更新 fix-now 语义 — 全部 sweep 处理，无豁免路径；sweep 完成后 findings[] 统一清空。

---

## §3 Acceptance criteria

- [ ] `gitCatFileCommitExists` 导出存在且单测通过（真实 commit → true / phantom SHA → false / empty → false）
- [ ] runner.mjs task-review 模式：handoff commits.head 不可达时 `finish(1)` 在 review-package 前终止，review-package 不执行（集成测试覆盖）
- [ ] implement.md / fix.md Commit 条款含跨任务边界约束措辞
- [ ] runner.mjs mode-phase 不一致时 stderr 审计输出 + handoff phase 被修正（单测覆盖）
- [ ] task-review.md 模板 Instructions 含 findings 必须写入 handoff 的明确指令
- [ ] deferred-sweep 模式 agent 成功返回后 findings[] 为空（单测覆盖）
- [ ] `pnpm run validate` 绿

---

## §4 Deviations from overall

无。

---

## §5 Notes for downstream

Pβ 的 writing-plans task heading fix（#198/#184）与 Pα 独立，无交叉影响。
