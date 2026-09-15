---
"@oscaner-skills/cdd-engine": minor
"@oscaner-skills/osuperpowers": minor
---

P3 cdd 命令面收敛：`cdd` 子命令由 6 收敛为 4（implement / review / fix / base-branch）。

- **`cdd brief` 删除**：零消费者——engine 已在 implement 的 plan 定稿处自给 brief（`run-task.mjs` F11：`generateBrief` + `CDD_TASK_BRIEF` override 写/读同源 + dir bootstrap）；`lib/brief.mjs#generateBrief` 保留供 run-task。
- **`cdd research` 删除**：唯一消费者 `cli-research` skill 一并删除（删除命令必须同步其唯一调用方）；`lib/cli/research.mjs`（`RESEARCH_METHODOLOGY` / `buildResearchPrompt` / `writeFindings` / `runResearch`）与 `lib/cli/brief.mjs`（`runBriefCli`）整文件移除。
- **级联死配置连根**：`DEFAULT_TIMEOUTS.research` / `modeEnv.research`（`CDD_RESEARCH_TIMEOUT`）/ `LEGACY_MODE_ENV` 整表及 `resolveTimeoutMs` 的 legacy 分支 / 零生产者的 `lib/brief.mjs#validateBrief`。
- **防回渗守卫**：`scripts/validate/residue.mjs` 新增 stale-lexicon 两条（命令形 `/\bcdd (brief|research)\b/` + `/CDD_RESEARCH_TIMEOUT|RESEARCH_TIMEOUT/`）——命令形刻意非裸词，保留 `/mattpocock-skills:research` 会话调用的合法空间。

> **semver 说明**：命令删除实为 **breaking**（如实应为 `cdd-engine` major）。标 minor 的原因有二——① 对齐 overall P6 既定口径（P1–P3 engine patch/minor）；② engine changeset 的**版本效果不落地**（`scripts/release/version-packages.mjs` 只处理 `packages/osuperpowers/package.json`；`.changeset/versioned-plugins.json = ["osuperpowers"]`）。该失真已显式记录，随 **P6** 统一复核。