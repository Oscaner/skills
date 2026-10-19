---
"@oscaner-skills/cdd-engine": patch
---

chore: P12 in-flight 用户裁定（overall D54）——`corpus-form-pin.test.ts` 退役:

- **裁定** — 语料的完整性是**引擎流程**的职责（spec/plan 各自 review 已逐篇判过；整体 spec 若要有门应加在 flow 侧），测试面只校验引擎功能。故整删 `src-next/contract/__tests__/corpus-form-pin.test.ts`。
- **核实** — 四条测试中仅 test 3 有真实价值，且它是**语料健康门**而非契约行为测试；`Contract.validate` 的行为面由 `judge.test.ts`(40.7K) / `doc.test.ts`(21.5K) / `lint.test.ts`(11.0K) 覆盖。计数断言为纯 churn（本 phase 落仓期间两次被迫重锚 specs 12→13 · plans 11→12），形态检查 ⊂ `PresenceInvariant` + `DomainInvariant`；test 2 为迁移考古；test 4 测同文件内定义的助手（零生产代码路径）。
- **连带** — P11 `6b4e38b1` / spec 侧 `c3521ff1` 式「注册连带计数重锚」义务一并消失。