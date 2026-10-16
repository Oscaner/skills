---
"@oscaner-skills/cdd-engine": patch
"@oscaner-skills/kairos": patch
---

fix: P9 W2 残余收口——路径值对象单一出口收归 + 读面 `RepoPath` typing + 落盘迁移 + 跨面一致性门（T4/T5/T6/T15/T18）:

- **T4 落盘 + 读面 typing + 迁移（§2.7/§2.11）** — ① 落盘 `progress.json`/`base.json` 的声明路径字段（`doc`/`plan`）经 `Workspace.writeJson`/`#normalizePaths` 归一到 repoRoot 相对（`RepoPath`）；② 读时兜底 `Workspace.readJson` 对漏网绝对形一笔 `relativize`（幂等）；③ 一次性迁移 `Workspace.migrateJsonChild`（`#sceneOf`/`#runBase` 首派发时调用，已净文件字节不动）；④ preflight/doc 读面 typing 单家收归——`PreFlightDoc.path` 与 `BoardView.readDocType` 入参收品牌 `RepoPath`（裸 `string` 编译期不可达）。
- **T5 声明再抄消除（§2.8）** — `invariants.ts#scanRoots` 单基准重构（签名 `(root, docPath)`，体经 `ctx.root` + `ENGINE_DOC_ROOTS` 单源并）；finding 消息 + `declare.ts` help `example` 的 `docs/kairos/…` 字面全部从 `ENGINE_RUNTIME.docRoots` 派生（零硬编码副本）；新增 `infra/doc-roots.ts` 循环安全叶（治 `declare.ts → runtime.ts` TDZ）。
- **T6 命令声明面迁移（§2.5/§2.12）** — `--root` argv token 全测试面零残留（仅存负锚），help pin 翻负，fixture 走 `process.chdir` 隔离（随依赖 T2 已落地，本波核验）。
- **T15 跨面散文一致性门（§3.5 ⑭⑮）** — kairos 套件新增 `skill-surface-consistency.test.ts`：⑭ SKILL ref 串 ↔ engine `REFS`（含 `pi：` 配对）+ ⑮ SKILL 路径字面 ↔ `ENGINE_RUNTIME`（含零绝对前缀）——SKILL.md 文本零改（D29 黑盒边界守约）。
- **T18 渲染/回显面收归值对象（§2.13）** — 残余的 3 处内联 `WorkspaceRoot.relativize`（`cli.ts` graph title · `artifacts.ts` `baseSet`/`baseGet` 回显）收归 T1 `RepoRoot.relativize` 值对象出口；`next:` 字面形态不变（仅路径值相对）。
- **回归** — 引擎 vitest 665/665 · kairos 83/83 · typecheck 净。
