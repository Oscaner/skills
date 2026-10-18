---
"@oscaner-skills/cdd-engine": major
---

feat: 文档头部 front-matter 化 + 登记表驱动正文解析统一（major breaking · 零 legacy 兼容）:

- **头部元组全量 front-matter 化** — 四类文档头部的 bullet 元组（`**Version**` / `**Status**` / `**Author**` / `**Spec:**` / `**Parent program**` / `**Depends on**` / `**Base**` / `- **Doc type**:`）整面退休，改为 YAML front-matter 键（`title` / `doc-type` / `version` / `date` / `status` / `author` / `spec` / `parent-program` / `parent-version` / `depends-on` / `base` / `issues`）；正文 H1 删除，`title:` 为唯一标题源。消费者需自行迁移既有文档（`schema get <type> --output skeleton` 可重吐头部）。
- **判定改走 typed head record** — presence / domain / 版本血缘 / 父血缘等头部判定从行扫改为读 `FrontMatterExtractor` 拆出的 typed head；`Finding.field` 改 front-matter key 形态、固定 message 去 bullet 字面量；`doc.ts` 死头成员（`headerLines` / `markerLine` / `markerValue` 家族）整删。
- **skeleton 吐 front-matter 头** — `schema get … --output skeleton` 的头部段经节点焊接（`yaml` 的 `YAMLMap`+`Pair`+`Scalar`）强制发射：content 填充槽单引号（`:::fill` 引号化，杜绝 YAML flow 歧义）、版本/链接/状态键保持裸标量，链接槽吐 `<docs/kairos/specs/…-overall.md>` / `<docs/kairos/specs/…-design.md>` 路径示例——占位符本身即头部形状规约（D3 骨架同源）。
- **front-matter 解析错误携位（#341）** — `FrontMatterExtractor.split` 不再把 YAML 解析失败吞成 null head：引擎的 `YAMLParseError` 经 `LineCounter` 喂出 `linePos`，型化为 `FrontMatterParseError{line, column, reason, source}` 挂在 head 上；pre-flight 对不可解析 front-matter 报「not valid YAML: {reason} on line {line}, column {column} (`{source}`)」BLOCK，不再误判为「declares no `doc-type:`」（D1 错误携位）。
- **链接形态见型单判（#342）** — `LinkTargetShape` 值类统一链接 target 形状：裸相对路径合法，markdown-shell `[l](p)`、URL `://`、空白与 `()[]<>` 拒绝；`link-shape` 是全解析面唯一的格式报告者，resolution 策略对非法 target 静默 `continue`，chainRoot 不再以 `{target: 原始字符串}` 提交双重失败（D2 形态见型，单 finding）。
