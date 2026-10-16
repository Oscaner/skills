---
"@oscaner-skills/cdd-engine": patch
"@oscaner-skills/kairos": patch
---

fix: 一事实无处 / 无门 / 有副本 通审施工（P9 B 组 · D26 法条 · B 组无门事实通审 20 项）:

- **① issue-body label 表单源** — 渲染器实读的 `words.ts` `ISSUE_LABEL_WORDS` 为唯一权威；`templates/report/issue-body.json` 中已发散的 `sectionLabels` 副本删除，孤儿字段（`severities` / `metaFields` / `reportDef` / `masterDef`）清除；新增门钉 label 单源 + `components` 名册派生（6 = `kairos:` + roster key · 2 固定头）。
- **② node floor 两事实拆源** — install floor（`package.json#engines` ↔ README ×2）与 type-stripping floor（`bin.ts` `NODE_FLOOR` ↔ README ×2）各钉正确单源 + 一致性门；README install 行由 `>= 22.12.0` 校正为 `>= 24`（与 `#engines` 一致，不与 22.18 误并）。
- **③ `DocKey` 单源派生** — `declare.ts` `DOC_TYPE_VALUES` 为唯一声明；`project.DOC_KEYS` / judge / board-view `DOC_TYPE_DOMAIN` 从单源派生，`doc.ts` 两处 inline union 收归 `DocKey`；新增一致性门。
- **⑩ skeleton 补齐 `**Doc type**` 头行** — `render/skeleton.ts` 在 Version 行后产物型声明行，引擎自产骨架过自身 preflight（`BoardView.readDocType` 回归 pin）。
- **⑪/⑫/⑬ 单源抽取** — `base.md` schema ↔ `BaseArtifact`（`source` 收窄为 `--source` 枚举值域）+ 跨面门；`mattpocock-skills:implement` 字面从 `DISPATCH.implement` 派生；phase-suffix 语法提为共享 `PHASE_SUFFIX_CORE` + 门。
- **⑧/⑯/⑱/⑲ 死声明清理** — `HOSTS[*].cache` · `HandoffFamily` 死字段（round/phase/fixFamily/fixTemplate/prev）· `CRASH_TAIL_LINES` 幽灵注释 · `setupRepo` 死 helper 全部移除。
- **frontmatter 门（D42）** — `SkillAnatomyContract` 增 frontmatter 槽；三处 SKILL.md `description` 的裸 `: `（`the engine's next: line`）改写措辞消掉 + `yaml.parse` 契约驱动门。
- **T1 路径值对象** — 新增 `RepoRoot` + 品牌 `RepoPath`（`infra/root.ts`）：根基准唯一权威 + 相对形态升为类型（绝对态类型层不可表达）· 唯一构造 `relativize` / 唯一擦除 `resolve`（纯 · 零 syscall）。
