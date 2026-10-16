---
"@oscaner-skills/cdd-engine": patch
---

fix: child round-context 全部 8 个路径 token 归一到 repoRoot 相对（D46 · 治 D44③ link-space 回归 + 散锚）:

- **回归根因**：注入 child 的 round-context 路径 token 散成**三基准**——① 绝对（`OUTPUT_*`/`WORKSPACE_DIR`/`INPUT_WAVE_BRIEF` 走 `workspace.resolve`）· ② **link-space 原形**（`INPUT_SPEC` = plan 头的 `**Spec:**` 链接 target `../specs/X.md`，D44③ 热修新注入；child cwd=repoRoot 时解到库外，**是真坏的**）· ③ **cwd 相对原形**（`INPUT_DOC`/`INPUT_FINDINGS` 直传 argv）。三者皆非 repoRoot 相对。
- **修**：`CliLifecycle#valuesOf` 组装处**单一出口**对全部 8 个路径 token 一笔 `#rel` 归一（`path.relative(repoRoot, path.resolve(repoRoot, value))`——绝对直取、相对视作已 repoRoot 相对）；各产出点仍可产绝对/原形，出口收口。`INPUT_SPEC` 在 `cli#sceneOf` 的 `case "plan"` 解析为绝对（`#resolveSpecLink` · 镜像 doc-contract 的 `#targetExists`：绝对 · repoRoot 形 · plan 目录形）。
- **配套**：child spawn cwd 由 `#cwd`（原 `process.cwd()`）改为 `#repoRoot`——相对 token 只有在 child cwd = repoRoot 时自 child 视角可达（承重事实，pin 一并守）。`CliLifecycle` 死字段 `#cwd` 退役。
- **载体一致性**：`#canonicalArtifacts` 偏离判定改在同一基准比较（child 现报相对、canonical 为绝对），否则每轮误报 deviation note。
- **pin**：新增「全 token repoRoot 相对」断言 + link-space `INPUT_SPEC` 回归用例 + `sync.calls[].cwd === repoRoot` 行为 pin。
