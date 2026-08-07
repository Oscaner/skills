# 2026-08-07-sdd-session-traceability-tickets

> Parent plan: `../plans/2026-08-07-sdd-session-traceability.md`
> Issue: https://github.com/Oscaner/skills/issues/79

| # | Title | Blocked by | Plan tasks covered | Demo |
|---|---|---|---|---|
| T0 | Add H6.6 session traceability to H6 reference | None — can start immediately | Task 1 | `grep -A2 'H6.6' plugins/superpowers-overrides/docs/sdd-h6-reference.md` 输出新规则 |
| T1 | Add session traceability comment to sdd-run-task-claude.sh | T0 | Task 2 | `head -15 plugins/superpowers-overrides/bin/sdd-run-task-claude.sh` 显示注释 |
| T2 | Add session traceability comment to sdd-run-task-cursor.sh | T0 | Task 3 | `head -15 plugins/superpowers-overrides/bin/sdd-run-task-cursor.sh` 显示注释 |
| T3 | Changeset | T0, T1, T2 | Task 4 | `pnpm run validate` 通过 |

## T0 — Add H6.6 session traceability to H6 reference

**What to build:** 在 H6 参考文档 H6.5 后新增 H6.6，解释 CLI agent 为什么不在 `/resume` 列表中可见。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `plugins/superpowers-overrides/docs/sdd-h6-reference.md` 中在 H6.5 行后插入 H6.6 文本
- [ ] H6.6 格式与现有 numbered-rule 风格一致
- [ ] commit: `docs: add H6.6 session traceability to H6 reference`

## T1 — Add session traceability comment to sdd-run-task-claude.sh

**What to build:** 在 Claude shell 脚本顶部注释中加入 session 不可追踪的说明，指向 H6.6。

**Blocked by:** T0（需要 H6.6 存在才能引用）

**Status:** ready-for-agent

- [ ] 在 line 5（flag invocation comment）后插入提示注释
- [ ] 注释使用 `-p`（Claude 的短 flag）
- [ ] commit: `docs: note print mode session behavior in sdd-run-task-claude.sh`

## T2 — Add session traceability comment to sdd-run-task-cursor.sh

**What to build:** 在 Cursor shell 脚本顶部注释中加入 session 不可追踪的说明，指向 H6.6。

**Blocked by:** T0（需要 H6.6 存在才能引用）

**Status:** ready-for-agent

- [ ] 在 line 5（flag invocation comment）后插入提示注释
- [ ] 注释使用 `--print`（Cursor 的长 flag）
- [ ] commit: `docs: note print mode session behavior in sdd-run-task-cursor.sh`

## T3 — Changeset

**What to build:** 运行 `pnpm changeset` 记录 patch bump。

**Blocked by:** T0, T1, T2（所有文档变更完成后才能 bump 版本）

**Status:** ready-for-agent

- [ ] `cd plugins/superpowers-overrides && pnpm changeset`（或从 repo root `pnpm changeset`），选 patch，描述文档变更
- [ ] commit: `chore: add changeset for session traceability docs`
