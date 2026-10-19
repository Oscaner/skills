---
"@oscaner-skills/cdd-engine": patch
---

fix: P11 注册连带——corpus form-pin 语料计数重锚至实况:

- **缺陷** — `contract/__tests__/corpus-form-pin.test.ts` 的计数断言钉的是**迁移时刻快照**（specs 11 · plans 10 · 21），而枚举面读的是**实况目录**。P11 design spec 落盘即令两者相斥（枚举 12 vs 断言 11），`pnpm -C packages/cdd-engine test` 红灯。
- **修** — 计数重锚至当前语料（specs 12 · plans 11 · 23），注释/title 由「迁移时刻快照」改为「跟踪实况语料」；每篇文档的形状断言（首行 `---` fence · front-matter 键域 ⊆ 登记表 home 锚 · 契约判压零 findings）逐条不变。
- **回归** — `corpus-form-pin.test.ts` 4/4 绿。
