---
"@oscaner-skills/kairos": minor
---

feat: author 后加 `self-review` 节点（cdd-spec-writer / cdd-plan · D44）:

- **self-review 节点** — cdd-spec-writer 与 cdd-plan 的 digraph 在 `author-spec` / `author-plan` 与 commit 节点之间插入一个离散 `self-review` 操作节点（author.Exit → self-review → commit）：提交前自审 spec/plan（覆盖度 · 类型一致性 · 零 `:::fill` 残留 · 零链接锚外尖括号字面），发现的问题就地修复。原先嵌在 author 节点 Do 内的「pre-commit self-review」散文升格为一等流程节点（不再只是 inline 一句话），与引擎的 review 轮区分——它是 flow 内的提交前自检，不派发 `next:`、不产 findings carrier。
