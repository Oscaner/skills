---
"@oscaner-skills/cdd-engine": patch
---

**P8 §17 handoff draft 读面宽容解析（D39）** — `Workspace` 增 `readJsonLenient` 读面：子代理（LLM）手写的 handoff draft（`tasks-*-implement.json` 等 carrier）由裸 `JSON.parse` 一票否决整轮（W3 `{5,11}` 实例——`notes` 数组尾逗号，工作面/载体其余完好），改用 **`jsonc-parser`**（Microsoft 官方 `node-jsonc-parser` · 2026-07 · 74.2M/wk · 零传递依赖 · ESM+CJS）`parse` + `{allowTrailingComma:true, disallowComments:false}`——**精确**容忍尾逗号/注释、仍对真错误（缺闭合括号等）报 malformed。`#reconstruct` 的 draft 读走 lenient，test-evidence 读 + 引擎自写文件保持 strict `readJson`（宽容仅限子代理手写 draft 面 · JSON 契约不被引擎字节放宽）。新增依赖 `jsonc-parser`。回归 pin：尾逗号/注释 draft 通过 · 真损坏仍 malformed · 两读面隔离（strict 对尾逗号仍 malformed）。**真损坏携精确错误码**：`JsonRead` 的 malformed 侧可选携 `errors`（`ParseError[]`），`#reconstruct` 以 `printParseErrorCode` 将错误码并入拒绝消息——真损坏可诊断，非仅 "malformed"。
