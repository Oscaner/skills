---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P6 — 引擎/流程加固 + 交付补齐（安装即用诚实化）。

- **harness 前置检查（P6a）**：全 mode（implement/review/fix）进入嵌套 CLI 前，按 harness 探测上游 skills 插件可用性（superpowers / mattpocock-skills / `@oscaner-skills/*`，非 submodule 假设）+ plan/brief/templates 就位；缺失 → exit 3（install-and-use 通道）/ stderr 提示（init 通道）+ per-harness 安装指引；spec/plan review 改走 cli review 模式（cdd-exec 派发，D1/D2/D3 映射）。
- **交付补齐（P6b）**：pi key 补齐（skills + gate TS extension）；gemini mattpocock-extension 装配 + error guard；qoder/codex plugin manifest 补全 → 真安装即用；`init harness` per-harness 安装器（harness-detect → 多选 → 原生 config 写入 + 复制 skills + manifest 全量同步 `{ osuperpowersVersion, files: { path → { hash, source } } }`）；grok 归安装即用（Claude marketplace）。
- **research 集成（P6c）**：mattpocock-skills:research 融入 brainstorming 流程（explore-context 委派 research agent + findings markdown）。