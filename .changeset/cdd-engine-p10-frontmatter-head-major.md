---
"@oscaner-skills/cdd-engine": major
---

feat: 文档头部 front-matter 化 + 登记表驱动正文解析统一（major breaking · 零 legacy 兼容）:

- **头部元组全量 front-matter 化** — 四类文档头部的 bullet 元组（`**Version**` / `**Status**` / `**Author**` / `**Spec:**` / `**Parent program**` / `**Depends on**` / `**Base**` / `- **Doc type**:`）整面退休，改为 YAML front-matter 键（`title` / `doc-type` / `version` / `date` / `status` / `author` / `spec` / `parent-program` / `parent-version` / `depends-on` / `base` / `issues`）；正文 H1 删除，`title:` 为唯一标题源。消费者需自行迁移既有文档（`schema get <type> --output skeleton` 可重吐头部）。
- **判定改走 typed head record** — presence / domain / 版本血缘 / 父血缘等头部判定从行扫改为读 `FrontMatterExtractor` 拆出的 typed head；`Finding.field` 改 front-matter key 形态、固定 message 去 bullet 字面量；`doc.ts` 死头成员（`headerLines` / `markerLine` / `markerValue` 家族）整删。
- **skeleton 吐 front-matter 头** — `schema get … --output skeleton` 的头部段经 `yaml.stringify` 发射 front-matter 键。
