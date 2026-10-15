---
"@oscaner-skills/cdd-engine": patch
---

**P8 §14 host 通道完整性（D36）** — `SyncRunner` 弃 Node 内建 `execFileSync`（全量缓冲 · 默认 `maxBuffer` 1 MiB 天花板：长任务 child 输出超限即截断，尾部 `RETURN_STDOUT_BLOCK` 先丢——W1 两次 `CDD_BLOCKED: child claude returned no status line` 的根因），改 **`execaSync`**（`execa@10` 的同步面 · `maxBuffer` 默认无上限 · 双管道并发排水内建承于 `spawnSync`）：`reject:false`（失败 child 返回结果不抛 · fail-open）、`stripFinalNewline:false`（stdout 字节原样 · 尾块零动）；face 零变——仍同步、仍返回 `{code, stdout, stderr}`，`DispatchStep` 全同步 dispatch 契约零动（run.ts:113）。新增依赖 `execa`。回归 pin：>1 MiB child 输出完整收集（恰超旧默认天花板字节数）+ `status:` 尾块完整 + stderr 同 face + fail-open 保持。
