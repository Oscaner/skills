# mattpocock-superpowers Review 精简 —— Design

**日期**: 2026-07-10
**目标**: 精简 `mattpocock-superpowers` plugin，删除低价值的 override skill 和 rule。
**判断标准**: 一条 override / rule 是否 (a) 真正改变了 upstream 行为，或 (b) 作为 CLAUDE.md 硬禁令 / 用户偏好的执行面。仅复述 upstream / 复述 CLAUDE.md / 纯 delegate + 免责声明的 —— 删除。

## 现状快照

`mattpocock-superpowers` 目前有 10 个 skill：

- **8 个 override**：brainstorming, writing-plans, subagent-driven-development, executing-plans, finishing-a-development-branch, test-driven-development, dispatching-parallel-agents, using-git-worktrees
- **2 个 cross-cutting**：subagent-lifecycle, token-efficient-review-dispatch

## 变更清单

### Delete —— 整个 override skill 目录（2 个）

#### D1. `test-driven-development-overrides`

**理由**: 三个 TDD 入口（sdd Rule 4 / executing-plans Rule 3 / 用户直接 `/tdd`）已经在各自 override 中显式 delegate 到 `mattpocock-skills:tdd`。本 override 唯一独有的功能是拦截"用户直接输 `/test-driven-development`"这一低频场景。即使拦截失败，upstream skill 会跑自己的 red-green-refactor —— 与 delegate 有微 loop 差异，但不造成破坏。Rule 2（"refactor 不属于 loop"）是 delegate 对象本身就说清楚的事，写在这里属于道害。

**行动**: `rm -rf mattpocock-superpowers/skills/test-driven-development-overrides/`

#### D2. `dispatching-parallel-agents-overrides`

**理由**: Rule 1 只是 delegate 到已被其他 override cite 的两个 cross-cutting skill；Rule 2 是"upstream prompt-crafting 仍适用"—— 免责声明而非规则。cross-cutting skill 的真实强制发生在 sdd/brainstorming/writing-plans 各自的 override 里，那里已经 cite 了 `subagent-lifecycle`。单为一个 slash command 建一个"路过时也 cite 一下"的 override 不划算。

**行动**: `rm -rf mattpocock-superpowers/skills/dispatching-parallel-agents-overrides/`

### Delete —— 单条 Rule（override 保留）

#### D3. `using-git-worktrees-overrides` Rule 3

**Rule 3 内容**: 检查用户全局 `~/.claude/CLAUDE.md` 的 override 触发表是否包含本 override 的行，若缺则一次性 notify 用户。

**删除理由**: CLAUDE.md 的 fallback 行 `Any other superpowers:<X> where <X>-overrides exists` 已经覆盖这个漏洞——机制会 fire。这条 Rule 属于"配置健康检查"而非"运行时规则"，每次触发都产生一条 notify 噪音。

**保留**: Rule 1（拒绝 + 提供 branch 替代 + 拦截原生 `EnterWorktree`）、Rule 2（当 caller skill 是 upstream 时也传播拒绝）—— 两者都是 worktree 硬禁令的真正执行面。

#### D4. `finishing-a-development-branch-overrides` Rule 4

**Rule 4 内容**: 禁止 `git push -f` / `git push --force` / `git push --force-with-lease`。

**删除理由**: Rule 4 自己承认"Restate here so it's local, not just inherited"。upstream Red Flags L239 已经写了同样禁令。属于纯复述以求心安。同步删除 Red Flags 和 Common Rationalizations 中对应的两个条目。

**保留**: Rule 1（跳过 GIT_DIR 检测）、Rule 2（跳过 Step 6 Cleanup Workspace）—— 两条都是 worktree 禁令的连锁；Rule 3（PR body / merge commit 上禁止 attribution 尾部）—— 把 CLAUDE.md 全局禁令落地到两个具体产物；Rule 5（typed 'discard' 保持）—— 保护性摩擦。

#### D5. `executing-plans-overrides` Rule 5

**Rule 5 内容**: handoff 到 `finishing-a-development-branch` 时 override precedence 依然生效。

**删除理由**: CLAUDE.md 已经专门为 "handoff-continuation rationalization" 命名了一个 anti-pattern 块，它是通用规则，覆盖所有 skill handoff 场景。在单个 override 里再复述一遍不增加信号。同步删除 Red Flags 和 Common Rationalizations 中对应的两个条目。

**保留**: Rule 1（subagent 可用时重定向到 sdd）、Rule 2（拒绝 worktree）、Rule 3（implementer 委托到 tdd）、Rule 4（每 task 后 commit）。

## 同步更新 —— 连锁修改

删除 skill 或 Rule 都需要更新交叉引用：

### C1. `mattpocock-superpowers/.claude-plugin/plugin.json`

`skills[]` 数组移除两条：
- `"./skills/test-driven-development-overrides"`
- `"./skills/dispatching-parallel-agents-overrides"`

### C2. `README.md`

- 主 override 描述表（约 L46-47）删除两行：`test-driven-development-overrides` 和 `dispatching-parallel-agents-overrides`。
- 系统 prompt 触发表（约 L96-97）删除两行对应触发规则。

### C3. 用户全局 `~/.claude/CLAUDE.md`（仓库外）

这不在本仓库里，是用户系统级配置。**不自动编辑**——只在 plan 里给出精确指令。用户手动执行：
- 删除触发表中两行：`superpowers:test-driven-development` 和 `superpowers:dispatching-parallel-agents`。
- fallback 行 `Any other superpowers:<X> where <X>-overrides exists` 保留——它对剩下的 override 仍然适用。

## 不变（一字不改）

以下 5 个 skill 保留现状：

- `brainstorming-overrides`（2 条规则：subagent review passes + delegate grilling）
- `writing-plans-overrides`（Rule 1/2/3 + 3a/3b/3c 子规则）
- `subagent-driven-development-overrides`（4 条规则：complexity-scaled rounds + batching + iterate-to-approve + delegate tdd）
- `subagent-lifecycle`（cross-cutting）
- `token-efficient-review-dispatch`（cross-cutting）

## 数据流影响

删除后的引用图：

```
brainstorming-overrides ──cite──► subagent-lifecycle
                       ──cite──► token-efficient-review-dispatch
                       ──delegate─► mattpocock-skills:grilling

writing-plans-overrides ──cite──► subagent-lifecycle
                       ──cite──► token-efficient-review-dispatch
                       ──delegate─► mattpocock-skills:to-tickets

subagent-driven-development-overrides ──cite──► subagent-lifecycle
                                     ──cite──► token-efficient-review-dispatch
                                     ──delegate─► mattpocock-skills:tdd

executing-plans-overrides ──delegate─► using-git-worktrees-overrides
                         ──delegate─► subagent-driven-development-overrides
                         ──delegate─► mattpocock-skills:tdd

finishing-a-development-branch-overrides (standalone; no cross-cut deps)
using-git-worktrees-overrides (standalone; no cross-cut deps)
```

cross-cutting 引用者从 5 个降到 3 个（brainstorming / writing-plans / sdd）—— 仍值得抽取，因为"改一处传多处"的价值不变。

## 风险与缓解

**R1. 用户以后直接输 `/test-driven-development`**
- 后果：upstream skill 会跑它自己的 red-green-refactor 循环，与 `mattpocock-skills:tdd` 的 red-green (no refactor in loop) 有 loop-shape 差异。
- 缓解：这个 slash command 很少被直接输入；sdd / executing-plans 通过 delegate 仍走 `mattpocock-skills:tdd`。差异属于"loop 里含不含 refactor"，不造成正确性问题。可接受。

**R2. 用户以后直接输 `/dispatching-parallel-agents`**
- 后果：upstream skill 会跑，"independent" 的定义比 `subagent-lifecycle` 弱。
- 缓解：`subagent-lifecycle` 的强定义仍在 brainstorming / writing-plans / sdd 里生效；单跑 `/dispatching-parallel-agents` 时用户是显式意图，选一次稍弱定义可接受。

**R3. 删除 Rule 4/5 后 force-push 或 handoff 场景失守**
- 后果：force-push 由 upstream Red Flags 覆盖；handoff 由 CLAUDE.md 反模式块覆盖。均有上游 / 全局兜底。
- 缓解：无额外行动。

## 验收标准

1. `mattpocock-superpowers/skills/` 只剩 8 个子目录（当前 10 减 2）。
2. `plugin.json` 的 `skills[]` 只有 8 项。
3. `README.md` 的 override 表和触发表都是 8 行（不含 fallback 行）。
4. 剩余 5 个 override 的 SKILL.md 中：
   - `using-git-worktrees-overrides` 无 Rule 3
   - `finishing-a-development-branch-overrides` 无 Rule 4，Red Flags 和 Rationalizations 中相应条目也删了
   - `executing-plans-overrides` 无 Rule 5，Red Flags 和 Rationalizations 中相应条目也删了
5. `brainstorming-overrides`、`writing-plans-overrides`、`subagent-driven-development-overrides`、`subagent-lifecycle`、`token-efficient-review-dispatch` 的 SKILL.md 与本次开始时 byte-identical。
6. 用户拿到明确的 `~/.claude/CLAUDE.md` 修改指令（触发表删两行）。
