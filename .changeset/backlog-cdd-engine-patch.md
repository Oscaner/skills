---
"@oscaner-skills/cdd-engine": patch
---

- overall 四表机械守卫（validate block 12）+ 登记规则收敛 + CDD 死档清除；无记录 handoff 读健壮性修复（坏 JSON → BLOCKED / corrupt prev → fail-open）（`#246` F6/F13）。
- CDD 编排硬化：`cdd base-branch set/get` 子命令（base-branch artifact 由 engine 唯一写入，schema 4 值 enum + `confirmed_at` 必填 + 幂等 + `--force` + CDD 落点）；implement dispatch 自供应 brief（`cdd implement --plan` 单次调用拿全实现上下文）；workspace slug 收敛（strip 单一 `-design`/`-plan` suffix）；代码目录/CLI 整理（删 bin `.gitkeep`、拆 `cli/shared`）；`cdd brief` 前置调用兼容保留、可以安全删除（P3 已兑现）（`#246` F10/F11）。