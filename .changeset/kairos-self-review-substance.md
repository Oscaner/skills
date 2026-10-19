---
"@oscaner-skills/kairos": patch
---

docs(kairos): self-review 措辞强化——语义充分性五查先行、结构卫生降为尾部（用户裁定 2026-10-17）:

- **`self-review` 的 Do 改写为五查 + 机械尾** — `cdd-plan` / `cdd-spec-writer` 两份 SKILL 的 `self-review` 节点从「覆盖度 + 类型一致性 + 零 `:::fill` + 零链接锚外尖括号」四项机械检查，改为**语义充分性先行**的五查：(1) 覆盖度——每条已批准 spec 需求都有对应任务；(2) **步骤可判定性**——每步都能让实施者写出唯一合理的东西（不决定任何事的句子、或签名与测试已定的转写，都是缺陷）；(3) 一致性——task id / `DependsOn` 边 / 命名一致；(4) **失败模式覆盖**——spec 隐含的每个失败模式都有任务、其 checkable 实际演练它；(5) **比例**——计划篇幅不与所实现的 spec 成倍失衡。机械卫生（零 `:::fill` 残留、链接锚外零尖括号字面）降为收尾两项。
- **语义零变化** — 节点位置（author → self-review → commit）、`next:` 不派发、不产 findings carrier 全部不变，只有 Do 的检查清单内容与先后。
