# mattpocock-superpowers Review 精简 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Source spec:** [docs/superpowers/specs/2026-07-10-mattpocock-superpowers-review-design.md](../specs/2026-07-10-mattpocock-superpowers-review-design.md)

**Goal:** 精简 `mattpocock-superpowers` plugin —— 删除 2 个低价值 override skill、删除 3 条冗余 rule、同步更新所有交叉引用，让 plugin 层级、README 与本仓库外的用户全局 `~/.claude/CLAUDE.md` 保持一致。

**Architecture:** 无代码变更，全部是文档 / manifest 编辑。每个 task 是一次原子的目录删除或文件 Edit + 立即 verify（`ls` / `grep` / `git diff --stat`）。所有 skill 目录删除与 `plugin.json` 同步更新绑定在同一 commit 里，防止 plugin manifest 指向不存在的路径（marketplace 层的"CI 不绿"）。

**Tech Stack:** Markdown、JSON、git、Bash（`rm -rf` / `grep` / `git`）。无 build、无 test suite、无 package manager —— 验证靠文件系统状态 + `grep` 断言 + `git diff --stat`。

---

## File Structure

变更范围严格限制在下列路径。每个文件都在一个或多个 task 中被删除、修改或作为验证的 target。

**Delete（整目录）:**
- `mattpocock-superpowers/skills/test-driven-development-overrides/` — 整个目录
- `mattpocock-superpowers/skills/dispatching-parallel-agents-overrides/` — 整个目录

**Modify:**
- `mattpocock-superpowers/.claude-plugin/plugin.json` — `skills[]` 数组删除两条
- `mattpocock-superpowers/skills/using-git-worktrees-overrides/SKILL.md` — 删除 Rule 3 段落
- `mattpocock-superpowers/skills/finishing-a-development-branch-overrides/SKILL.md` — 删除 Rule 4，同步删除 Red Flags 和 Common Rationalizations 中引用它的条目
- `mattpocock-superpowers/skills/executing-plans-overrides/SKILL.md` — 删除 Rule 5，同步删除 Red Flags 和 Common Rationalizations 中引用它的条目
- `README.md` — override 描述表删两行、系统 prompt 触发表删两行

**External to repo（用户手动执行，plan 只给指令）:**
- `~/.claude/CLAUDE.md` — override 触发表删两行

**不动（byte-identical 断言）:**
- `mattpocock-superpowers/skills/brainstorming-overrides/SKILL.md`
- `mattpocock-superpowers/skills/writing-plans-overrides/SKILL.md`
- `mattpocock-superpowers/skills/subagent-driven-development-overrides/SKILL.md`
- `mattpocock-superpowers/skills/subagent-lifecycle/SKILL.md`
- `mattpocock-superpowers/skills/token-efficient-review-dispatch/SKILL.md`
- `.claude-plugin/marketplace.json`（顶层 marketplace，无变化）

## Commit strategy

一个 task 一个 commit（对齐 CLAUDE.md "Commit after each completed task when using the executing-plans skill"）。commit type 全部用 `refactor:`（删除低价值资产）或 `chore:`（同步 manifest / README）。禁止 attribution trailer。

Task 顺序按依赖设计 —— 先删 skill 目录，同一 commit 里同步更新 `plugin.json`（避免 manifest 悬空）；再依次删单条 rule；最后更新 README + 输出用户全局 CLAUDE.md 指令。

---

### Task 1: 删除 test-driven-development-overrides 与 dispatching-parallel-agents-overrides（含 plugin.json 同步）

**依据 spec:** D1（`test-driven-development-overrides` 删除）+ D2（`dispatching-parallel-agents-overrides` 删除）+ C1（`plugin.json` `skills[]` 同步移除对应条目）—— 三者绑定同一 commit 以保持 manifest 完整性。

**Files:**
- Delete: `mattpocock-superpowers/skills/test-driven-development-overrides/`（整目录，含 `SKILL.md`）
- Delete: `mattpocock-superpowers/skills/dispatching-parallel-agents-overrides/`（整目录，含 `SKILL.md`）
- Modify: `mattpocock-superpowers/.claude-plugin/plugin.json`

- [ ] **Step 1: 验证起始状态 —— 10 个 skill 目录**

```bash
ls /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/ | wc -l
```

Expected output: `10`

- [ ] **Step 2: 验证 plugin.json 当前 `skills[]` 数组包含两个待删条目**

```bash
grep -c 'test-driven-development-overrides\|dispatching-parallel-agents-overrides' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/.claude-plugin/plugin.json
```

Expected output: `2`

- [ ] **Step 3: 删除 test-driven-development-overrides/ 目录**

```bash
rm -rf /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/test-driven-development-overrides
```

- [ ] **Step 4: 删除 dispatching-parallel-agents-overrides/ 目录**

```bash
rm -rf /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/dispatching-parallel-agents-overrides
```

- [ ] **Step 5: 修改 plugin.json，从 `skills[]` 数组移除两个引用**

修改后 `plugin.json` 完整内容应为：

```json
{
  "name": "mattpocock-superpowers",
  "skills": [
    "./skills/brainstorming-overrides",
    "./skills/writing-plans-overrides",
    "./skills/subagent-driven-development-overrides",
    "./skills/subagent-lifecycle",
    "./skills/token-efficient-review-dispatch",
    "./skills/using-git-worktrees-overrides",
    "./skills/executing-plans-overrides",
    "./skills/finishing-a-development-branch-overrides"
  ]
}
```

用 Edit tool 精准替换：把包含 `"./skills/test-driven-development-overrides",` 和 `"./skills/dispatching-parallel-agents-overrides"` 的两行删除，同时去掉上一行 `"./skills/finishing-a-development-branch-overrides",` 的行尾逗号（因为它变成了 `skills[]` 数组的最后一项）。

- [ ] **Step 6: 验证 —— skill 目录数、plugin.json 数组长度、JSON 合法性**

```bash
ls /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/ | wc -l
# Expected: 8

grep -c 'test-driven-development-overrides\|dispatching-parallel-agents-overrides' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/.claude-plugin/plugin.json
# Expected: 0

python3 -c 'import json; d = json.load(open("/Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/.claude-plugin/plugin.json")); assert len(d["skills"]) == 8, f"got {len(d[\"skills\"])}"; print("plugin.json valid, 8 skills")'
# Expected: plugin.json valid, 8 skills
```

三条命令输出全部匹配 Expected 才算通过。任何一条不匹配 —— **STOP**，回到 Step 3 检查。

- [ ] **Step 7: Commit**

```bash
cd /Users/oscaner/Projects/oscaner-skills
git add -A mattpocock-superpowers/
git status --short
# Expected:
#  D mattpocock-superpowers/skills/dispatching-parallel-agents-overrides/SKILL.md
#  D mattpocock-superpowers/skills/test-driven-development-overrides/SKILL.md
#  M mattpocock-superpowers/.claude-plugin/plugin.json

git commit -m "refactor(mattpocock-superpowers): drop two low-value override skills

test-driven-development-overrides was pure interception for a rarely-typed
slash command; TDD entry points via sdd Rule 4 and executing-plans Rule 3
already delegate to mattpocock-skills:tdd.

dispatching-parallel-agents-overrides was delegate-only — the cross-cutting
subagent-lifecycle and token-efficient-review-dispatch skills it routed to
are already cited by brainstorming / writing-plans / sdd overrides.

Sync plugin.json skills[] to match (deletion + manifest update in one atomic
commit to avoid marketplace pointing at non-existent paths)."
```

Expected: 一次 commit，含两个 D + 一个 M。commit message 无 attribution trailer。

---

### Task 2: 删除 using-git-worktrees-overrides Rule 3

**依据 spec:** D3。Rule 3 是"CLAUDE.md 触发表健康检查"，CLAUDE.md 的 fallback 行已覆盖同一漏洞。Red Flags 和 Common Rationalizations 中未引用 Rule 3（本次读取已确认），无需连带删除。

**Files:**
- Modify: `mattpocock-superpowers/skills/using-git-worktrees-overrides/SKILL.md`

- [ ] **Step 1: 验证 Rule 3 段落存在（起始状态）**

```bash
grep -n '^### Rule 3 — Ensure global CLAUDE.md registers this override' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/using-git-worktrees-overrides/SKILL.md
```

Expected: 找到一行输出（约 L48）。

- [ ] **Step 2: 用 Edit tool 精准删除 Rule 3 段落**

`old_string`（保留 HTML 注释 anchor 以定位替换点）:

```
### Rule 3 — Ensure global CLAUDE.md registers this override

For the override to fire on triggers (1)–(3), the user's global `~/.claude/CLAUDE.md` override-trigger table needs a row:

| Trigger | First tool call |
|---|---|
| `superpowers:using-git-worktrees` | `Skill(using-git-worktrees-overrides)` |

If that row is missing when this skill is first invoked, notify the user once: "Consider adding `using-git-worktrees` to `~/.claude/CLAUDE.md`'s override-trigger table so this refusal fires automatically." Then proceed with Rule 1 for the current turn. Do not silently succeed — the `Any other superpowers:<X> where <X>-overrides exists` fallback row in CLAUDE.md already covers this case, but explicit is better than fallback for a hard ban.

<!-- Additional rules for the using-git-worktrees skill go below as Rule 4, Rule 5, … -->
```

`new_string`（同时把插入点注释从"Rule 4, Rule 5, …"改为"Rule 3, Rule 4, …"，保持编号连续）:

```
<!-- Additional rules for the using-git-worktrees skill go below as Rule 3, Rule 4, … -->
```

- [ ] **Step 3: 验证 —— Rule 3 段落已消失、Rule 1/2 仍在、注释 anchor 更新**

```bash
grep -c '^### Rule 3' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/using-git-worktrees-overrides/SKILL.md
# Expected: 0

grep -c '^### Rule [12] ' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/using-git-worktrees-overrides/SKILL.md
# Expected: 2

grep -c 'go below as Rule 3, Rule 4' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/using-git-worktrees-overrides/SKILL.md
# Expected: 1
```

三条断言全部通过才继续。

- [ ] **Step 4: Commit**

```bash
cd /Users/oscaner/Projects/oscaner-skills
git add mattpocock-superpowers/skills/using-git-worktrees-overrides/SKILL.md
git commit -m "refactor(using-git-worktrees-overrides): drop Rule 3 (CLAUDE.md trigger-table health check)

The CLAUDE.md fallback row 'Any other superpowers:<X> where <X>-overrides
exists' already covers the same gap. Rule 3 was a config-time health check
whose per-trigger notify was noisier than valuable."
```

---

### Task 3: 删除 finishing-a-development-branch-overrides Rule 4 + 相关 Red Flag + Rationalization

**依据 spec:** D4。Rule 4 自己承认是 restate upstream Red Flags。同步删除两个引用它的条目：Red Flags 中 `"Push was rejected, I'll --force-with-lease ..."`，Common Rationalizations 中 `"Force-push-with-lease is safe"`。

**Files:**
- Modify: `mattpocock-superpowers/skills/finishing-a-development-branch-overrides/SKILL.md`

- [ ] **Step 1: 验证 Rule 4 与两个引用条目都存在（起始状态）**

```bash
grep -c '^### Rule 4 — Never force-push' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/finishing-a-development-branch-overrides/SKILL.md
# Expected: 1

grep -c 'Push was rejected' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/finishing-a-development-branch-overrides/SKILL.md
# Expected: 1

grep -c 'Force-push-with-lease is safe' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/finishing-a-development-branch-overrides/SKILL.md
# Expected: 1
```

- [ ] **Step 2: 删除 Rule 4 段落（保留 Rule 5，重编号为 Rule 4）**

Rule 4 删除后原 Rule 5 会成为孤立的规则；为保持编号连续，把 Rule 5 重命名为 Rule 4。

`old_string`:

````
### Rule 4 — Never force-push, never `-f`

Upstream Red Flags (L239) says "Force-push without explicit request" is forbidden. Restate here so it's local, not just inherited:

1. `git push` only. Never `git push -f` / `git push --force` / `git push --force-with-lease` unless the user explicitly requested it in the current turn.
2. If push is rejected (non-fast-forward), stop and hand back to the user with the reject reason. Don't silently rebase or force.

### Rule 5 — Option 4 (Discard) confirmation stays typed, not multiple-choice
````

`new_string`:

````
### Rule 4 — Option 4 (Discard) confirmation stays typed, not multiple-choice
````

- [ ] **Step 3: 更新 HTML 注释 anchor（"Rule 6, Rule 7" → "Rule 5, Rule 6"）**

`old_string`:

````
<!-- Additional rules for the finishing-a-development-branch skill go below as Rule 6, Rule 7, … -->
````

`new_string`:

````
<!-- Additional rules for the finishing-a-development-branch skill go below as Rule 5, Rule 6, … -->
````

- [ ] **Step 4: 从 Red Flags 删除引用 Rule 4 的条目**

`old_string`:

````
- "Push was rejected, I'll --force-with-lease since it's safer than --force."
- "Option 4 confirmation is annoying — I'll offer 'yes/no' via AskUserQuestion instead."
````

`new_string`（只留 Option 4 那条，因为 Rule 5→Rule 4 重编号后它仍在）:

````
- "Option 4 confirmation is annoying — I'll offer 'yes/no' via AskUserQuestion instead."
````

- [ ] **Step 5: 从 Common Rationalizations 删除引用 Rule 4 的行**

`old_string`:

````
| "Force-push-with-lease is safe" | The ban is on force in any form without explicit user ask. `--force-with-lease` is still force. |
| "Typed 'discard' is user-hostile" | It's user-protective. Friction is the point when the action is permanent. |
````

`new_string`（保留 typed-discard 那行，因为它对应 Rule 5→Rule 4）:

````
| "Typed 'discard' is user-hostile" | It's user-protective. Friction is the point when the action is permanent. |
````

- [ ] **Step 6: 验证 —— Rule 4 是新的 typed-discard 内容、Rule 5 不存在、force-push 引用已消失**

```bash
grep -c '^### Rule 4 — Option 4' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/finishing-a-development-branch-overrides/SKILL.md
# Expected: 1

grep -c '^### Rule 5' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/finishing-a-development-branch-overrides/SKILL.md
# Expected: 0

grep -c 'force-push\|force-with-lease\|Never force-push\|Push was rejected' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/finishing-a-development-branch-overrides/SKILL.md
# Expected: 0

grep -c 'go below as Rule 5, Rule 6' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/finishing-a-development-branch-overrides/SKILL.md
# Expected: 1
```

四条全部通过才继续。

- [ ] **Step 7: Commit**

```bash
cd /Users/oscaner/Projects/oscaner-skills
git add mattpocock-superpowers/skills/finishing-a-development-branch-overrides/SKILL.md
git commit -m "refactor(finishing-a-development-branch-overrides): drop Rule 4 (force-push ban)

Rule 4 explicitly self-labels as 'Restate here so it's local, not just
inherited' — upstream Red Flags L239 already forbids force-push. Removing
the local restate + the two Red Flag / Rationalization entries that
reference it. Rule 5 (typed 'discard') is renumbered to Rule 4."
```

---

### Task 4: 删除 executing-plans-overrides Rule 5 + 相关 Red Flag + Rationalization

**依据 spec:** D5。Rule 5（handoff-continuation 保持 override precedence）已在 CLAUDE.md 的 handoff-continuation rationalization anti-pattern 块中被通用命名，本处复述冗余。同步删除 Red Flags 中 `"finishing-a-development-branch is a sub-skill ..."` 和 Common Rationalizations 中 `"The handoff to finishing-a-development-branch is inside this flow..."` 两个条目。

**Files:**
- Modify: `mattpocock-superpowers/skills/executing-plans-overrides/SKILL.md`

- [ ] **Step 1: 验证 Rule 5 与两个引用条目都存在**

```bash
grep -c '^### Rule 5 — Handoff to finishing-a-development-branch' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/executing-plans-overrides/SKILL.md
# Expected: 1

grep -c "finishing-a-development-branch\` is a sub-skill" /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/executing-plans-overrides/SKILL.md
# Expected: 1

grep -c 'handoff to finishing-a-development-branch is inside' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/executing-plans-overrides/SKILL.md
# Expected: 1
```

- [ ] **Step 2: 删除 Rule 5 段落**

Rule 5 是最后一条 Rule，删除后直接接 HTML 注释 anchor，无重编号需要。

`old_string`:

````
### Rule 5 — Handoff to finishing-a-development-branch keeps override precedence

Upstream Step 3 says `superpowers:finishing-a-development-branch` is a **REQUIRED SUB-SKILL**. That handoff **is** a trigger for [`finishing-a-development-branch-overrides`](../finishing-a-development-branch-overrides/SKILL.md) — per the CLAUDE.md "handoff-continuation rationalization" anti-pattern block, the self-check fires on this handoff just like any other trigger. Do not proceed to the upstream finishing skill's steps without first invoking the overrides.

<!-- Additional rules for the executing-plans skill go below as Rule 6, Rule 7, … -->
````

`new_string`（HTML 注释同步降到 "Rule 5, Rule 6"）:

````
<!-- Additional rules for the executing-plans skill go below as Rule 5, Rule 6, … -->
````

- [ ] **Step 3: 从 Red Flags 删除引用 Rule 5 的条目**

`old_string`:

````
- "`finishing-a-development-branch` is a sub-skill of this one, so its overrides don't need to fire."
````

`new_string`: 空字符串 —— 该 bullet 完全移除。

如果 Edit tool 不接受空 `new_string`，改为把它连同上一行的换行一起删（即将 old_string 扩展为上一 bullet 尾部换行 + 该 bullet）。

- [ ] **Step 4: 从 Common Rationalizations 删除引用 Rule 5 的行**

`old_string`:

````
| "The handoff to finishing-a-development-branch is inside this flow, so the override precedence pauses" | CLAUDE.md's handoff-continuation rationalization block explicitly names this failure mode. Each turn is scanned independently. |
````

`new_string`: 空字符串。若不接受，同上处理换行。

- [ ] **Step 5: 验证 —— Rule 5 消失、两个引用条目消失、Rule 1-4 都在**

```bash
grep -c '^### Rule 5' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/executing-plans-overrides/SKILL.md
# Expected: 0

grep -c '^### Rule [1-4] ' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/executing-plans-overrides/SKILL.md
# Expected: 4

grep -c 'handoff to finishing-a-development-branch is inside\|sub-skill of this one, so its overrides' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/executing-plans-overrides/SKILL.md
# Expected: 0

grep -c 'go below as Rule 5, Rule 6' /Users/oscaner/Projects/oscaner-skills/mattpocock-superpowers/skills/executing-plans-overrides/SKILL.md
# Expected: 1
```

四条断言全部通过才继续。

- [ ] **Step 6: Commit**

```bash
cd /Users/oscaner/Projects/oscaner-skills
git add mattpocock-superpowers/skills/executing-plans-overrides/SKILL.md
git commit -m "refactor(executing-plans-overrides): drop Rule 5 (handoff precedence restate)

CLAUDE.md's handoff-continuation rationalization anti-pattern block already
names the general failure mode this rule was guarding — restating it inside
a single override doesn't add signal. Removing Rule 5 + its two associated
Red Flag / Rationalization entries."
```

---

### Task 5: 同步 README.md（override 描述表 + 系统 prompt 触发表）

**依据 spec:** C2。两张表各删两行。

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 验证两张表当前状态**

```bash
grep -c '| `test-driven-development-overrides`\|| `dispatching-parallel-agents-overrides`' /Users/oscaner/Projects/oscaner-skills/README.md
# Expected: 2  (在 override 描述表)

grep -c '`superpowers:test-driven-development`\|`superpowers:dispatching-parallel-agents`' /Users/oscaner/Projects/oscaner-skills/README.md
# Expected: 2  (在触发表)
```

- [ ] **Step 2: 从 override 描述表删两行**

`old_string`（严格用完整两行文本，防止误配）:

````
| `test-driven-development-overrides` | `superpowers:test-driven-development` | Delegates to `mattpocock-skills:tdd` so every TDD entry point (direct, via sdd Rule 4, via executing-plans Rule 3) routes to the same discipline — seam-confirmation, vertical slicing, refactor outside the loop. |
| `dispatching-parallel-agents-overrides` | `superpowers:dispatching-parallel-agents` | Routes concurrency + freshness discipline to cross-cutting `subagent-lifecycle` (no data dependency = independent) and `token-efficient-review-dispatch` (D1/D2/D3 for review dispatches); upstream's prompt-structure section remains authoritative for prompt content. |
````

`new_string`: 空字符串。

- [ ] **Step 3: 从触发表删两行**

`old_string`:

````
| `superpowers:test-driven-development` | `Skill(test-driven-development-overrides)` |
| `superpowers:dispatching-parallel-agents` | `Skill(dispatching-parallel-agents-overrides)` |
````

`new_string`: 空字符串。

- [ ] **Step 4: 验证 —— 两处引用全消失、fallback 行仍在**

```bash
grep -c 'test-driven-development\|dispatching-parallel-agents' /Users/oscaner/Projects/oscaner-skills/README.md
# Expected: 0

grep -c 'Any other `superpowers:<X>` where `<X>-overrides` exists' /Users/oscaner/Projects/oscaner-skills/README.md
# Expected: 1
```

- [ ] **Step 5: Commit**

```bash
cd /Users/oscaner/Projects/oscaner-skills
git add README.md
git commit -m "chore(readme): remove two dropped-override rows from override + trigger tables

Sync README to the plugin.json change in Task 1 (drop test-driven-development-
overrides and dispatching-parallel-agents-overrides). Fallback trigger row
'Any other superpowers:<X> where <X>-overrides exists' stays — still applies
to the remaining 6 overrides."
```

---

### Task 6: 输出用户全局 `~/.claude/CLAUDE.md` 修改指令

**依据 spec:** C3。仓库外文件，plan 不自动编辑；给用户精准指令。

**Files:** 无 —— 只产出终端消息给用户。

- [ ] **Step 1: 向用户输出以下消息（原文，勿修改）**

```
仓库内的所有变更已完成 —— 还剩一处仓库外的同步：

请手动编辑 `~/.claude/CLAUDE.md`，在 "Override trigger table" 里删除以下两行：

| `superpowers:test-driven-development` | `Skill(test-driven-development-overrides)` |
| `superpowers:dispatching-parallel-agents` | `Skill(dispatching-parallel-agents-overrides)` |

保留 fallback 行 `Any other superpowers:<X> where <X>-overrides exists` —
它对剩下的 6 个 override 仍然适用。

保留 `subagent-lifecycle` 那行（"Any Agent/subagent dispatch → Skill(subagent-lifecycle)"）—
cross-cutting skill 依然生效。
```

- [ ] **Step 2: 确认用户已完成外部编辑**

等用户答复完成，才算 Task 6 结束。不 commit（无仓库内变更）。

---

## Final Acceptance —— 对齐 spec 的 6 条验收标准

所有 6 个 task 完成、用户确认外部编辑后，在仓库根目录跑以下断言，全部通过才算本 plan 完结。

- [ ] **A1: `mattpocock-superpowers/skills/` 只剩 8 个子目录（6 个 override + 2 个 cross-cutting）**

```bash
cd /Users/oscaner/Projects/oscaner-skills
ls mattpocock-superpowers/skills/ | wc -l
# Expected: 8

ls mattpocock-superpowers/skills/
# Expected（顺序不敏感）:
#   brainstorming-overrides
#   executing-plans-overrides
#   finishing-a-development-branch-overrides
#   subagent-driven-development-overrides
#   subagent-lifecycle
#   token-efficient-review-dispatch
#   using-git-worktrees-overrides
#   writing-plans-overrides
```

- [ ] **A2: `plugin.json` 的 `skills[]` 只有 8 项，JSON 合法**

```bash
python3 -c 'import json; d = json.load(open("mattpocock-superpowers/.claude-plugin/plugin.json")); assert len(d["skills"]) == 8, len(d["skills"]); print("A2 pass:", d["skills"])'
```

- [ ] **A3: `README.md` override 描述表 6 行、触发表 6 行（不含 fallback）**

```bash
# override 描述表：从 "| Override skill | Overrides | What it does |" 起，到 "Both cross-cutting skills exist to prevent" 之前，只数含 `-overrides` 的行
grep -c '^| `[a-z-]*-overrides`' README.md
# Expected: 6

# 触发表：从 "| Trigger | First tool call |" 起，只数含 `superpowers:` 的行（含 backticks，正好排除 fallback 行"Any other superpowers:<X>..."中的<X>占位不含反引号）
grep -c '^| `superpowers:' README.md
# Expected: 6
```

- [ ] **A4: 3 个改过的 override SKILL.md 的 Rule 结构正确**

```bash
# using-git-worktrees-overrides: Rule 1 + Rule 2，无 Rule 3
grep -c '^### Rule ' mattpocock-superpowers/skills/using-git-worktrees-overrides/SKILL.md
# Expected: 2

# finishing-a-development-branch-overrides: Rule 1..Rule 4（原 Rule 5 重编号为 Rule 4）
grep -c '^### Rule ' mattpocock-superpowers/skills/finishing-a-development-branch-overrides/SKILL.md
# Expected: 4

# executing-plans-overrides: Rule 1..Rule 4（原 Rule 5 删除）
grep -c '^### Rule ' mattpocock-superpowers/skills/executing-plans-overrides/SKILL.md
# Expected: 4
```

- [ ] **A5: 5 个不动 skill 的 SKILL.md 与 main 分支基线 byte-identical**

```bash
# main 是本 review 开始前的基线。执行前先确认本分支尚未 push 出去、main 未被别的 branch 更新。
for skill in brainstorming-overrides writing-plans-overrides subagent-driven-development-overrides subagent-lifecycle token-efficient-review-dispatch; do
  if git diff --exit-code main -- "mattpocock-superpowers/skills/$skill/SKILL.md"; then
    echo "A5 $skill: identical"
  else
    echo "A5 $skill: DIVERGED (this is a bug — investigate)"
    exit 1
  fi
done
```

- [ ] **A6: 用户已确认完成外部 `~/.claude/CLAUDE.md` 修改**

由 Task 6 的用户答复保证。如果 executor 是 subagent 且无法与用户对话，把这条留给 orchestrator。

---

## 完成后

所有 6 个 task 通过 + Final Acceptance 全部 pass 后，本 plan 完结。commit history 应包含 5 个 commit（Task 1-5 各一个，Task 6 无 commit），按顺序：

1. `refactor(mattpocock-superpowers): drop two low-value override skills`
2. `refactor(using-git-worktrees-overrides): drop Rule 3 ...`
3. `refactor(finishing-a-development-branch-overrides): drop Rule 4 ...`
4. `refactor(executing-plans-overrides): drop Rule 5 ...`
5. `chore(readme): remove two dropped-override rows ...`

没有 attribution trailer。分支状态由用户决定（当前 `main`，可选：留在 `main` push、或先切 feature branch 再 PR）。


