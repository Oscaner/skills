# os-engineering P6e Implementation Plan：文档重写

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** root + per-package 所有文档从零重写或新建。CLAUDE.md = English only；README = bilingual companion 模式。

**Architecture:** 4 tasks：root CLAUDE.md 精简重写 → per-package docs（engineering + overrides）→ root README 重写。所有文档 rewrite or create（no update）。

**Tech Stack:** Markdown（文档）

## Global Constraints

- Conventional commits、无 attribution；禁 git worktree。
- `pnpm run validate` 每任务后 ALL PASS。
- CLAUDE.md = **English only**（无 .zh-CN companion，Claude Code 消费）。
- README.md = **English** + `README.zh-CN.md` **Chinese companion**（同目录模式）。
- **self-check 不在 root CLAUDE.md**（os-init 后续生成）。
- **分发视角**：面向外部用户，安装即用，无私有路径。
- 所有文件 rewrite or create（no update existing content）。

---

## File Structure

| 文件 | 责任 | Task |
|---|---|---|
| `CLAUDE.md`（root）| 重写：精简项目说明 + per-package links | T0 |
| `packages/engineering/CLAUDE.md`（新建）| engineering 详细文档（hooks/overrides/chain/emit/verify/release）| T1 |
| `packages/engineering/README.md`（新建）| engineering plugin 说明 | T1 |
| `packages/engineering/README.zh-CN.md`（新建）| engineering 中文 companion | T1 |
| `packages/superpowers-overrides/CLAUDE.md`（新建）| overrides 详细文档（trigger router/manifest/hooks）| T2 |
| `packages/superpowers-overrides/README.md`（重写）| overrides plugin 说明 | T2 |
| `packages/superpowers-overrides/README.zh-CN.md`（新建）| overrides 中文 companion | T2 |
| `README.md`（root，重写）| 项目概览 + plugins + installation + links | T3 |
| `README.zh-CN.md`（root，重写）| 项目概览中文 companion | T3 |

---

### Task 0: root CLAUDE.md 重写

**Files:**
- Rewrite: `CLAUDE.md`（293 lines → 精简）

**Interfaces:**
- Consumes: 无
- Produces: 精简 root CLAUDE.md — T1/T3 引用

- [ ] **Step 1: 写 root CLAUDE.md（English only）**

```markdown
# CLAUDE.md

This repository packages personal Claude Code skills as installable plugins.

## Plugins

| Plugin | Type | Description |
|---|---|---|
| engineering | First-party | os-* orchestration + cli-* family + CDD engine + gate |
| superpowers-overrides | First-party | Trigger router — maps upstream triggers to engineering/mattpocock targets |
| superpowers | Vendored | Upstream workflow skills (Read by os-* orchestrators) |
| mattpocock-skills | Vendored | Engineering precision skills (grilling, tdd, to-tickets, research) |
| impeccable | Vendored | Frontend design skills |

## Per-package documentation

- [`packages/engineering/CLAUDE.md`](packages/engineering/CLAUDE.md) — engineering plugin internals (hooks, overrides pattern, emit, verification, releasing)
- [`packages/superpowers-overrides/CLAUDE.md`](packages/superpowers-overrides/CLAUDE.md) — overrides trigger router internals

## Git conventions

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
- No attribution / co-author / AI-generation trailers.
- No `git worktree`.
- `git add -f` on a gitignored file requires explicit user confirmation.

## Common operations

```bash
pnpm run emit       # regenerate all harness manifests from package.json
pnpm run emit:check # verify emit output is fresh (no drift)
pnpm run validate   # full validation suite
```

See [`packages/engineering/CLAUDE.md`](packages/engineering/CLAUDE.md) for detailed operations.
```

- [ ] **Step 2: 验证**

```bash
pnpm run validate
```

- [ ] **Step 3: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite root CLAUDE.md (lean project overview)"
```

---

### Task 1: packages/engineering/ docs（3 files 新建）

**Files:**
- Create: `packages/engineering/CLAUDE.md`（detailed engineering docs）
- Create: `packages/engineering/README.md`（user-facing）
- Create: `packages/engineering/README.zh-CN.md`（Chinese companion）

**Interfaces:**
- Consumes: T0（root CLAUDE.md links to these）
- Produces: per-package docs — T3 root README links

- [ ] **Step 1: 创建 engineering CLAUDE.md**

从 root CLAUDE.md 迁移详细内容（hooks matrix / overrides pattern / marketplace chain / verification / releasing / CDD pre-check）。这是 engineering plugin 的 Claude Code 内部参考文档。

包含：
1. engineering self-check（trigger table + rules）— 从旧 root CLAUDE.md 迁移
2. Hooks matrix — 迁移
3. Overrides pattern + router → engineering — 迁移
4. Marketplace → plugin → skill chain — 迁移
5. Cross-cutting docs references — 迁移
6. `docs/superpowers/` conventions — 迁移
7. Common operations（emit + validate detailed）— 迁移
8. Verifying a change — 迁移
9. Releasing — 迁移
10. CDD CLI pre-check — 迁移

- [ ] **Step 2: 创建 engineering README.md + README.zh-CN.md**

面向外部用户的 engineering plugin 说明：what it does / skills list / installation / quick start / license。中文 companion。

- [ ] **Step 3: validate**

```bash
pnpm run validate
```

- [ ] **Step 4: 提交**

```bash
git add packages/engineering/CLAUDE.md packages/engineering/README.md packages/engineering/README.zh-CN.md
git commit -m "docs: create engineering CLAUDE.md + README.md + README.zh-CN.md"
```

---

### Task 2: packages/superpowers-overrides/ docs（2 new + 1 rewrite）

**Files:**
- Create: `packages/superpowers-overrides/CLAUDE.md`（new）
- Rewrite: `packages/superpowers-overrides/README.md`（from scratch）
- Create: `packages/superpowers-overrides/README.zh-CN.md`（new companion）

**Interfaces:**
- Consumes: T0
- Produces: per-package docs — T3 root README links

- [ ] **Step 1: 创建 overrides CLAUDE.md**

trigger router 详细文档：manifest → hooks → expansion → convention。

- [ ] **Step 2: 重写 overrides README.md + 新建 README.zh-CN.md**

what it does / installation / quick start。中文 companion。

- [ ] **Step 3: validate + 提交**

```bash
pnpm run validate
git add packages/superpowers-overrides/
git commit -m "docs: create overrides CLAUDE.md + rewrite README.md + add zh-CN companion"
```

---

### Task 3: root README 重写

**Files:**
- Rewrite: `README.md`（from scratch）
- Rewrite: `README.zh-CN.md`（from scratch, companion）

**Interfaces:**
- Consumes: T0/T1/T2（per-package docs exist）
- Produces: root README — project entry point

- [ ] **Step 1: 重写 root README.md + README.zh-CN.md**

英文主：tagline + plugins table + installation + quick start + architecture + per-package links + development + license。中文 companion。

- [ ] **Step 2: validate + 提交**

```bash
pnpm run validate
git add README.md README.zh-CN.md
git commit -m "docs: rewrite README.md + README.zh-CN.md (project overview)"
```
