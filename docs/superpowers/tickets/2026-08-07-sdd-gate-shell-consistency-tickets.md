# Tickets: SDD gate Shell/Write 一致性 + 防劫持

修复 SDD PreToolUse gate 的 Shell/Write 不对称（issue #53）并加固防劫持：只读 git 诊断 Bash 可用 + deny 消息矩阵；TASK_BASE 必须真实 git object + bound-ws 优先；全矩阵 smoke + fixture 隔离。源 spec/plan：[spec](../specs/2026-08-07-sdd-gate-shell-consistency-design.md) · [plan](../plans/2026-08-07-sdd-gate-shell-consistency.md)。

Work the **frontier**: any ticket whose blockers are all done. 串行依赖：T0 → T3/T4/T5/T6 上游链。

## T0 — 建 gate 测试 fixture 基础

**What to build:** 一套可被 gate 测试复用的隔离 fixture 场景（orchestrating / active / complete / stub），每个场景是可独立起作用的 SDD workspace 模板，供后续测试驱动 gate 的各个状态。

**Blocked by:** None — can start immediately.

- [ ] 创建 fixture 目录树（普通目录，不含 `.git`/`.superpowers`，被 git 跟踪）
- [ ] 每个场景含正确的 brief/handoff 模板（active 无 handoff、complete 含 APPROVED、stub 用 `abc`）

## T1 — gate 允许只读 git 诊断

**What to build:** orchestrator 在 gate 激活时能运行只读 git 诊断命令（`git status`/`git diff`/`git log` 等白名单动词），变更类 git 命令仍被拒；被拒时的提示消息升级为完整 allowlist 矩阵，规则一眼可见。

**Blocked by:** None — can start immediately.

- [ ] 只读 git 动词白名单放行，变更类 deny
- [ ] deny 消息含多行 allowlist 矩阵（含 `git show`）
- [ ] 提取失败一律 deny（fail-closed）

## T2 — 阻止旧 workspace 劫持

**What to build:** 一个遗留的测试/陈旧 SDD workspace 不再能劫持新 session：`TASK_BASE` 必须指向真实 git 对象才激活；session 绑定 workspace 后 gate 只认该 workspace，不扫描无关目录。

**Blocked by:** None — can start immediately.

- [ ] `TASK_BASE` 非真实 git 对象的 workspace 不激活
- [ ] 绑定 workspace 后不扫描无关目录
- [ ] phase 判定与 write 判定用同一个 workspace（单一解析点）

## T3 — 测试切换到隔离 fixture

**What to build:** 两个现有 gate 测试不再往真实 workspace 树写 stub，改为从隔离 fixture 驱动；gate 支持测试环境的 sdd 根覆盖，真实 `.superpowers/sdd/` 保持干净。

**Blocked by:** T0, T1, T2

- [ ] gate 支持 sdd 根覆盖（env seam）
- [ ] claude + cursor 测试从 fixture 驱动，删除 dogfood-test 依赖
- [ ] 测试验证不污染真实 workspace 树

## T4 — 全矩阵 smoke + CI

**What to build:** 一个断言完整 allow/deny 矩阵的 smoke 测试（每行一断言），并挂进 CI，任何未来 gate 行为回归都会在 CI 上失败。

**Blocked by:** T1, T2, T3

- [ ] smoke 覆盖判定矩阵每行 + AC1 边界用例
- [ ] 挂载到 CI
- [ ] 手动运行通过

## T5 — 文档同步 gate 矩阵

**What to build:** orchestrator 可查阅的完整 gate 规则文档：允许/拒绝矩阵、Shell 契约、防劫持说明；spor-SDD 清单补一行同步。

**Blocked by:** T1, T2

- [ ] 参考文档含完整 gate 矩阵
- [ ] cross-harness 文档同步
- [ ] spor-SDD 清单补只读 git + TASK_BASE 说明（保持 ≤160 行）

## T6 — 清理与全量验证

**What to build:** 删除遗留的测试 stub workspace，全量验证通过，spec 记录实际 smoke 结果。

**Blocked by:** T1, T2, T3, T4, T5

- [ ] 删除遗留 stub workspace
- [ ] `pnpm run validate` 全绿
- [ ] spec §Smoke 记录实际结果
