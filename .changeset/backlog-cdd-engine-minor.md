---
"@oscaner-skills/cdd-engine": minor
---

- `cdd review --type spec|plan` 的 Stopping ref 升级为 (doc_path, doc_hash) 内容状态双签名：内容实质演进即新 ref、可开新 review cycle；未变内容仍 exit 3；legacy handoff 硬停保留（Closes `#246` F5）。
- 进程生命周期统一管理：全部派生点纳入进程组所有权（`spawnManaged` detached 进程组 + `teardownAll` run 边界连根回收 + 跨 run `reapStale` 孤儿兜底），修长时间运行后 `claude -p` 驻留进程累积；目录结构重排（bin 薄入口 + lib 分簇 + tests 顶层，npm 发布不再含 tests）（Closes `#246` F1）。
