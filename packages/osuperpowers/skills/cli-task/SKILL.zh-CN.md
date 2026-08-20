---
name: cli-task
description: 把任务派发给选定的 harness CLI 执行。三条路径：一次性自由任务、--loop 迭代（sentinel 停止）、brief 路径（handoff 契约）。复用 cdd 引擎（registry + cdd-review.mjs / cdd-task.mjs），无 ledger/plan 编器职责。
---

# CLI Task

把单个任务派发给选定的 harness CLI 执行，返回最终输出。

## Rules

### Rule: Choose Harness

先经 [Rule: Ask](../cli-select/SKILL.md#rule-ask) 选定 harness，以显式 `--harness <name>` 传入。

### Rule: One-shot Free-Form

默认路径：`{plugin_root}/bin/engine/cdd-review.mjs --harness <name> --prompt "<task 描述>"`，返回归一化后的最终输出（text 透传 / stream-json 取 finalText）。

### Rule: Loop

`cli-task --loop "<base prompt>"`：迭代调用 `cdd-review.mjs`，每轮 prompt = base prompt + `[Iteration N — previous result: <上一轮 final text>]`（回喂上一轮输出）。输出含 sentinel（默认 `<promise>NO MORE TASKS</promise>`，`--sentinel` 可改）或达 `--max`（默认 20）则停；逐轮显示最终文本。

### Rule: Brief Path

用户提供 brief 路径 → 走 handoff 契约：设 `CDD_TASK_BRIEF` 等 env，调 `{plugin_root}/bin/engine/cdd-task.mjs --harness <name> --task N --mode <implement|task-review|fix>`（模式由用户指定，默认 implement；用户 brief 即 task brief，cli-task 不做 transform）。

## Red Flags

- 「--loop 每轮发同一 prompt，反正会变」→ 无状态 print CLI 每轮输出相同，必须回喂上一轮结果（Rule: Loop）
- 「free-form 也要写 handoff.json」→ 一次性自由任务不写 ledger/handoff（Rule: One-shot Free-Form）
