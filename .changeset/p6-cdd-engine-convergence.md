---
"@oscaner-skills/cdd-engine": minor
---

P6 引擎统一收敛（convergence family, cdd-engine minor）——五个 feature 合并发布：

- **模板平面系统化 + 命名收敛（T5）**：prompt templates 重组织（docs/task/schema），engine config 并 `engine-config.json`、render 数据并 `template-contract.json`；template tokens 改限域全名（`H1_BLOCK`→`RETURN_STDOUT_BLOCK`、`HARD_GATE`→`HANDOFF_WRITE_GATE`、`HANDOFF_TYPE`→`HANDOFF_TARGET`、`LENS_GUIDE`→`REVIEW_LENS_GUIDE`）；return-format 判别符 `returnFormat`（legacy `h1`/`json` 退役）。
- **派发期 liveness monitor（E3）**：`spawnManaged` 采样进程组 CPU + 工作树 mtime，静止超窗（15min）→ kill + TIMEOUT（`timedOut` + `stalled` blocker + 清偿契约 + fail-open）；CPU 按样本差判定防陈旧基线误杀。
- **派发岛收敛 + 错误收编（T24）**：branch review/fix 收编 `BranchLifecycle`（round/prompt/schema/finalize/exit-gate 全上链——branch-fix 继承 commit 契约：脏树/head-mismatch BLOCK）；status 推导族归 finalize、计数器归 failure、Convergence 归 convergence、return-block 单点；编排错误统一 `CddExitError`（exitCode+kind）、库内断言走 `invariant()`、`hashFile` 归 artifacts。
- **派发终止契约 + 续传（T26）**：dispatch 死亡 = 终止→保全→续传单生命周期——`spawnManaged` 统一 monitor（stall 活性 primary + budget last-resort cap）经单一纯判据 → 三 cause（stalled/over-budget/signal）；预算/停滞 implement 轮将 WIP `git stash push -u` 保全（标准化 `cdd-<op>-<type>-<task>-r<round>-<cause>` + `recovery.residue_ref`），re-dispatch 预检读载体重放 + brief 附数据驱动 residue 附言（legacy stash-list 检索兜底 pre-schema）。
- **任务级 scope 账本（T27）**：任务可审 git 范围 = 引擎自有跨轮稳定锚——`progress.json#tasks[].scope_base` earliest-wins；恢复轮 materialized `base==HEAD` 时可采纳 return-block 声明的 true base（祖先校验、fresh 永不采纳）；review/fix 固定点改读账本（legacy 回落）。

> **Semver note**: token/`returnFormat` 判别符 rename 为契约面破坏（`h1`/`json` 退役）但限 round-context 面；其余（island 收敛 / liveness / termination+resume / scope ledger）为内部重构 + 新增能力——整体按 minor 发布（P3/P4 先例）。
