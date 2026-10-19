---
"@oscaner-skills/cdd-engine": patch
"@oscaner-skills/kairos": patch
---

fix: P9 单源化通审——repoRoot 路径基准 / 值对象 / 缺门补齐（合并 P9 全部施工与 review 收口）:

- **`--root` 退役（breaking）** — `implement`/`review`/`fix`/`board` 四命令的 `--root <path>` 旗标删除；残留 `cdd <cmd> --root X` 现落入 `error: unknown option '--root'`（退 2）。
- **repoRoot 唯一转换点** — 生产面 `process.cwd()` → repoRoot 转换恰 1 处（`Cli#rootOf`）；三注入缝退役，child spawn cwd 归一为 repoRoot。cwd 不在任何 git 仓内时 `CDD_BLOCKED` 退 1。
- **路径值对象** — 新增 `RepoRoot` + 品牌 `RepoPath`（`infra/root.ts`）：相对形态升为类型，唯一构造 `relativize` / 唯一擦除 `resolve`。输入漏斗（`Cli#funnel`）对 `--plan`/`--spec`/`--findings` 恰归一一次，仓库外路径接并经 `CDD_WARN:` 提示。
- **全面 repoRoot 相对** — child round-context 全部 8 个路径 token（含 link-space 回归的 `INPUT_SPEC`）、`next:` 字面、capsule `handoff:`、board 文档 cells、`base` 回显、graph title 内嵌路径一律 repoRoot 相对；落盘 `progress.json`/`base.json` 路径字段归一并带一次性迁移，写出字节规范（EOF `\n`）。
- **单源与缺门** — issue-body label 表、node floor（`engines` ↔ README）、`DocKey`、`base.md` ↔ `BaseArtifact`、`PHASE_SUFFIX_CORE`、`chore` 契约、`edgeConditionWords`、`INSTALL_ROWS` ↔ README、`PIPELINE_NEXT` ↔ `REFS` 各收归单源并补一致性门；skeleton 补 `**Doc type**` 头行；SKILL.md `description` 的裸 `: ` 改写并加 frontmatter 契约门；README node install floor 由 `>= 22.12.0` 校正为 `>= 24`。
- **死声明清理** — `HOSTS[*].cache`、`HandoffFamily` 死字段、`CRASH_TAIL_LINES` 幽灵注释等移除。
