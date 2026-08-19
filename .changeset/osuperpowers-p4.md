---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P4 — 发布架构 v2（包即源）+ 统一 gate 面迁 Node。

- 目录重组 `packages/`（first-party）+ `vendors/`（superpowers / mattpocock-skills / impeccable 上游 submodule 源，不编辑）；`package.json#oscaner-plugin` 为唯一元数据源（source.json 派生）。
- pnpm workspace + changesets 统一版本/发布所有 `@oscaner-skills/*` 包（vendors 构建期装配 republish，保留上游授权）。
- marketplace + harness manifests 从 packages 生成；未来插件 = 加包目录自动接入。
- gate 面迁 Node：`cdd-gate-core` + 薄 CLI（`gateDecide` 语义单一实现）；7 个原生 hook gate adapters（grok/qoder/trae/codex/gemini/vibe/kiro）+ opencode/pi TypeScript adapters（随包分发）；per-harness gate manifest 接线（qoder/codex/gemini/pi/opencode）；~800 行 bash 消灭。
- os-init gates 概念建立（后由 P6b 的 `init harness` 安装器取代）。