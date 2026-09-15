---
"@oscaner-skills/cdd-engine": minor
"@oscaner-skills/osuperpowers": minor
---

P3 cdd 命令面收敛：`cdd` 子命令由 6 收敛为 4（implement / review / fix / base-branch）。

- **`cdd brief` 删除**：零消费者——engine 已在 implement 的 plan 定稿处自给 brief（`run-task.mjs` F11：`generateBrief` + `CDD_TASK_BRIEF` override 写/读同源 + dir bootstrap）；`lib/brief.mjs#generateBrief` 保留供 run-task。
- **`cdd research` 删除**：唯一消费者 `cli-research` skill 一并删除（删除命令必须同步其唯一调用方）；`lib/cli/research.mjs`（`RESEARCH_METHODOLOGY` / `buildResearchPrompt` / `writeFindings` / `runResearch`）与 `lib/cli/brief.mjs`（`runBriefCli`）整文件移除。
- **级联死配置连根**：`DEFAULT_TIMEOUTS.research` / `modeEnv.research`（`CDD_RESEARCH_TIMEOUT`）/ `LEGACY_MODE_ENV` 整表及 `resolveTimeoutMs` 的 legacy 分支 / 零生产者的 `lib/brief.mjs#validateBrief`。
- **防回渗守卫**：`scripts/validate/residue.mjs` 新增 stale-lexicon 两条（命令形 `/\bcdd (brief|research)\b/` + `/RESEARCH_TIMEOUT/`）——命令形刻意非裸词，保留 `/mattpocock-skills:research` 会话调用的合法空间。

> **semver 说明**：`cdd brief` / `cdd research` 的删除实为 **breaking**（如实应为 `cdd-engine` major），本次按 minor 发布。
