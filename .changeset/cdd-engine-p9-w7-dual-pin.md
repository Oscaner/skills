---
"@oscaner-skills/cdd-engine": patch
---

test: P9 T7 — 双 pin 落地（结构 pin 新增 + 行为 pin 扩面 · §2.9）:

- **结构 pin（新增 `repo-root.guard.test.ts`）** — engine 生产面（排除 `__tests__`）`process.cwd()` **恰好 1 处** · `git.topLevel(` **转换点恰好 1 处**；注释剥离后计数，串面不剥离（串内符号为真命中）。零/双命中皆翻红——护转换点。
- **行为 pin（`cli.test.ts` 扩面）** — `FakeSync.call.cwd === repoRoot` 由 implement 单面扩至 implement/review/fix 三工作面；护 spawn cwd 这一 repoRoot 相对 token 基准所系的承重事实。既存 `:3775` 单面断言保留。
- **双 pin 异事实** — 结构护转换点 · 行为护 spawn；两 pin 各自可独立翻红（人为加第二转换点 → 结构红；spawn cwd 漂移 → 行为红）。
- **回归** — 引擎 vitest 668/668 · typecheck 净 · 零裸函数净 · biome 净 · 零生产代码改动（纯测试面）。
