---
'@oscaner-skills/cdd-engine': minor
---

cdd-engine: 进程生命周期统一管理 —— 全部派生点纳入进程组所有权（spawnManaged detached 进程组 + teardownAll run 边界连根回收 + 跨 run reapStale 孤儿兜底，续跑会话随组退出），修长时间运行后 `claude -p` 驻留进程累积；目录结构重排（bin 薄入口 + lib 分簇 + tests 顶层，npm 发布不再含 tests）—— closes #246 F1