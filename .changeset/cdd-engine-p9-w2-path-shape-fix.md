---
"@oscaner-skills/cdd-engine": patch
---

fix: P9 W2 fix-1 — 落盘路径形态 + 迁移零改口 + 读面品牌收口（review-1 四项收口）:

- **F1 落盘承载面路径全相对（§2.7）** — `#canonicalArtifacts` 的 prescribed 槽位一律 book repoRoot 相对（`#rel(canonical)`，不再落 `workspace.resolve` 绝对形）；`#reject` 的 `attemptedHandoff` 写 `#rel(path)`（crash 记录不再落绝对）；不改宽 `PERSISTED_PATH_KEYS`（artifacts-map 值不可按 key 白名单收口）。
- **F2 迁移零改口（§2.11）** — `migrateJsonChild` 的重写保留规范 EOF `\n`（`JSON.stringify(...) + "\n"`），`writeJson` 亦写同一规范字节——引擎写出的文件与迁移产物字节一致，已净文件零 churn；infra 夹具改为字节忠实（写尾 `\n`）并补 writer/migration 字节一致断言。
- **F3 零残留（D26）** — 删除零调用者的死静态 `WorkspaceRoot.relativize`（T18 收归后的残留）。
- **F4 读面品牌收口（§2.2）** — `BoardView.readDocType(root: RepoRoot, rel: RepoPath)` 与 `PreFlightDoc.path: RepoPath` 收真品牌：CLI 喂相对 `RepoPath`，读面/ seam 各自经 `RepoRoot.resolve` 擦除喂 `fs`；删 capsule 的 `#docPathOf` 绝对化回退（同一残余修复）。
- **回归** — 引擎 vitest 665/665 · kairos 83/83 · typecheck 净 · emit fresh。
