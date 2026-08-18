# os-engineering P6e 阶段设计：文档重写

## Header

- **Version**: v1.0 · 2026-08-18
- **Status**: Draft
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering overall v3.0](2026-08-10-os-engineering-overall.md)
- **Depends on**: P6d（SKILL.md 英文化 + companion convention 确立）

## §0 Incremental warning

> P6e 增量。跨阶段约定见 [overall v3.0](2026-08-10-os-engineering-overall.md)；冲突以 overall 为准。

## §1 Constraints pointer

- 不重复 overall 约定；冲突以 overall 为准。
- **文档重写（P6e）**：root + per-package 所有文档从零重写或新建（无 update）。CLAUDE.md = English only（不需中文 companion）；README.md = English + `README.zh-CN.md` companion。
- **分发视角最高约束**：面向外部用户的文档对外可读、安装即用、无私有路径假设。
- **self-check 不在 root CLAUDE.md**：engineering self-check 由 os-init 后续生成，P6e 不写入。
- Conventional commits、无 attribution；禁 git worktree；`pnpm run validate` 保持通过。

## §2 Design body

### 2.0 范围

P6e 4 个 tasks（所有文档 rewrite 或 create，无 update）：

| Task | 文件数 | 操作 |
|---|---|---|
| T0 | 1 | `CLAUDE.md`（root）重写 from scratch |
| T1 | 3 | `packages/engineering/` CLAUDE.md + README.md + README.zh-CN.md 新建 |
| T2 | 3 | `packages/superpowers-overrides/` CLAUDE.md 新建 + README.md 重写 + README.zh-CN.md 新建 |
| T3 | 2 | `README.md` + `README.zh-CN.md`（root）重写 from scratch |

### 2.1 语言 convention

| 文件类型 | 语言 |
|---|---|
| `CLAUDE.md`（任何层级）| **English only**（Claude Code 消费，不需中文 companion）|
| `README.md` | **English** + `README.zh-CN.md` **Chinese companion** |

### 2.2 T0: root CLAUDE.md 重写

从零重写 `CLAUDE.md`（English only，不写 `CLAUDE.zh-CN.md`）：

**内容结构**（精简，面向 Claude Code session）：
1. **Repository purpose** — 一句话说明
2. **Plugins registered here** — 4 plugins 表格（name / description / path）
3. **Per-package CLAUDE.md links** — links to `packages/engineering/CLAUDE.md` + `packages/superpowers-overrides/CLAUDE.md`
4. **Cross-cutting conventions** — git conventions, commit messages（brief section）
5. **Common operations** — emit + validate（brief，指 `packages/engineering/CLAUDE.md` 详述）

**不包含**（移到 per-package CLAUDE.md）：
- ❌ engineering self-check（os-init 生成）
- ❌ hooks matrix（engineering CLAUDE.md）
- ❌ overrides pattern detail（engineering CLAUDE.md）
- ❌ marketplace chain detail（engineering CLAUDE.md）
- ❌ verification steps detail（engineering CLAUDE.md）
- ❌ releasing detail（engineering CLAUDE.md）

### 2.3 T1: packages/engineering/ docs（3 files 新建）

**`packages/engineering/CLAUDE.md`**（新建，English only）：
engineering 详细文档（从 root CLAUDE.md 迁移的内容 + 新增内容）：
1. engineering self-check（trigger table + rules）— 迁移
2. Hooks matrix — 迁移
3. Overrides pattern + router → engineering — 迁移
4. Marketplace → plugin → skill chain — 迁移
5. Cross-cutting docs（subagent-lifecycle, review-dispatch）— 迁移
6. `docs/superpowers/` conventions — 迁移
7. Common operations（emit + validate 详述）— 迁移
8. Verifying a change — 迁移
9. Releasing — 迁移
10. CDD CLI pre-check（skills-missing gate）— 迁移

**`packages/engineering/README.md`**（新建，English）：
面向外部用户的 engineering plugin 说明：
1. What it does（os-* orchestration + cli-* family + cdd engine）
2. Skills list（13 skills 一览表）
3. Installation（npm install）
4. Quick start（怎么用）
5. License

**`packages/engineering/README.zh-CN.md`**（新建，Chinese companion）

### 2.4 T2: packages/superpowers-overrides/ docs（2 new + 1 rewrite）

**`packages/superpowers-overrides/CLAUDE.md`**（新建，English only）：
overrides 详细文档：
1. Trigger router 机制（manifest → hooks → expansion）
2. Overrides manifest.json SOT
3. Hooks（Claude + Cursor）
4. Convention（spor-* → os-*/cli-* mapping）

**`packages/superpowers-overrides/README.md`**（**重写** from scratch，English）：
1. What it does（trigger router, no skill bodies）
2. Installation
3. Quick start

**`packages/superpowers-overrides/README.zh-CN.md`**（新建，Chinese companion）

### 2.5 T3: root README 重写

**`README.md`**（**重写** from scratch，English）：
1. Project tagline + badges
2. What this is（personal Claude Code plugin marketplace）
3. Plugins table（4 plugins: engineering / superpowers-overrides / superpowers / mattpocock-skills / impeccable）
4. Installation（for end users）
5. Quick start
6. Architecture overview（pipeline flow）
7. Per-package links（README for each plugin）
8. Development（contributing, how to add plugins）
9. License

**`README.zh-CN.md`**（**重写** from scratch，Chinese companion）

### 2.6 错误处理

- 无特别错误处理（纯文档工作）
- `pnpm run validate` 确保文档一致（plugin.json skills 指向正确路径）

### 2.7 非目标

- ❌ 不写 per-package CLAUDE.zh-CN.md（CLAUDE.md = English only）
- ❌ 不写 engineering self-check（os-init 生成）
- ❌ 不改 `skills/` 或 `.agents/skills/` 结构
- ❌ 不改 emit 逻辑
- ❌ 不改 package.json 或 plugin.json

### 2.8 验收标准

- [ ] root `CLAUDE.md` 重写完成（无 self-check，精简项目说明，links to per-package CLAUDE.md）
- [ ] root `README.md` + `README.zh-CN.md` 重写完成
- [ ] `packages/engineering/CLAUDE.md` + `README.md` + `README.zh-CN.md` 新建完成
- [ ] `packages/superpowers-overrides/CLAUDE.md` + `README.md`（rewrite）+ `README.zh-CN.md` 完成
- [ ] 所有 CLAUDE.md = English only（无 .zh-CN companion）
- [ ] 所有 README.md = English + `README.zh-CN.md` companion
- [ ] `pnpm run validate` ALL PASS
- [ ] 分发视角：外部用户能通过 README 理解项目 + 安装 + 使用

## §3 Deviations from overall

无。

## §4 Notes for downstream

- os-init 会为各 package 生成 CLAUDE.md（含 self-check）。P6e 写的 CLAUDE.md 是不含 self-check 的版本。
- P6d 的 companion file convention 在 P6e 中一致应用（README + README.zh-CN）。
- per-package CLAUDE.md 内容丰富（hooks matrix / pattern / chain），是 Claude Code session 中 per-directory 的主要参考。

## §5 Review

Rule 1 三个 subagent pass 通过后交用户 review，再进入 writing-plans。
