# Tickets: os-engineering P4b（统一 gate 面迁 Node + 9 harness adapters + os-init gates）

把 P4b 的 CDD gate 从 bash 迁到 Node 中立核心，为 9 个 harness 建 gate adapter，交付 os-init gates —— 外部用户安装即用。源计划: [2026-08-10-os-engineering-p4b.md](../plans/2026-08-10-os-engineering-p4b.md)。

Work the **frontier**：T0 无阻塞；T1/T7 依赖 T0；T2/T3/T4 依赖 T1；T5 依赖 T3/T4；T6 依赖 T5；T8 依赖 T1-T7。

## T0 目录重组（engine/ + gate/ 骨架 + pending_path 接缝）

**What to build:** engineering 的 bin 重组成 `engine/`（bash 引擎，P5 换语言）+ `gate/`（Node gate 骨架），engine↔gate 依赖解除（`cdd_pending_path` + `CDD_PENDING_ROOT`/`CDD_PENDING_TTL` 归 `cdd-common.sh`），全仓引用（skills/docs/emit/validate）同步。目录路径变了、引擎逻辑不变。

**Blocked by:** None — can start immediately.

- [ ] `bin/engine/` 就位（cdd-run/exec/select/session-activate + cdd-common.sh + harness-registry）
- [ ] `bin/gate/` 骨架（cdd-gate-core/decide 占位 + adapters/configs/tests 目录）
- [ ] session-activate 只依赖 `cdd-common.sh`（不 source gate lib）
- [ ] 全仓引用更新 + `pnpm run validate` ALL PASS

## T1 门核心 gateDecide + 薄 CLI

**What to build:** 把 bash `cdd_gate_decide` 移植为 Node 纯函数 `gateDecide`（`{ decision, reason, context }`）+ `cdd-gate-decide` 薄 CLI，语义等价（fail-open / pending.mode 模式感知 / git 只读白名单 / write 路径边界 / workspace 解析含 sdd 回退 / pending 生命周期 / deny 恢复指引文案），回归测试锁定。pending 路径与引擎同一 `CDD_PENDING_ROOT`。

**Blocked by:** T0

- [ ] `gateDecide` 语义表每行 node:test 覆盖（含 deny 文案断言）
- [ ] 薄 CLI stdin JSON → stdout JSON
- [ ] `pnpm run validate` ALL PASS（旧 bash adapter 未迁前仍用）

## T2 claude/cursor gate 迁 Node

**What to build:** claude/cursor 的 PreToolUse hook 改走 Node adapter（emit 生成 hooks.json 命令指向 `.mjs`），claude/cursor 在 active-task 拒绝 repo 编辑（含恢复指引）。删 bash gate 面（`cdd-orchestrator-gate.sh` + 两个 `.sh` adapter + gate shell 测试），ci-validate 改接 `node --test`。

**Blocked by:** T1

- [ ] claude/cursor adapter fixture：allow / deny（含 `agent_message`/reason 文案）/ 异常 fail-open
- [ ] emit hooks 路径 `.mjs` + 生成产物 fresh
- [ ] 旧 bash gate 面删除 + ci-validate 更新 + validate ALL PASS

## T3 7 个原生 hook adapter

**What to build:** grok / qoder / trae / codex / gemini / vibe / kiro 各自一个 adapter —— 解析该 harness 的 hook JSON（矩阵在计划 T4）→ 调门核心 → 输出该 harness 原生 deny/allow 响应。每 adapter 独立 fixture 测试。

**Blocked by:** T1

- [ ] 共享 `adapters/lib.mjs`（readStdin/sessionKey/sha256）
- [ ] 7 个 adapter fixture：allow / deny / 异常 fail-open
- [ ] `pnpm run validate` ALL PASS

## T4 opencode/pi TS adapter

**What to build:** opencode TS plugin（`tool.execute.before` → deny throw）+ pi TS extension（`tool_call` → `{block:true}`），`import` 门核心，随 `@oscaner-skills/engineering` 包分发（import 在包内解析）。

**Blocked by:** T1

- [ ] opencode/pi adapter 测试（deny → throw / block）
- [ ] 包内 import 解析不断链
- [ ] `pnpm run validate` ALL PASS

## T5 emit manifest 接线（包通道安装即用）

**What to build:** qoder/codex/gemini/pi/opencode 的 manifest/extension/plugin 内嵌 gate 接线（emit 生成：codex hooks、gemini extension hooks、pi extensions key、新增 qoder plugin manifest、opencode plugin 片段）—— 外部用户装包/装插件即得 gate hooks。

**Blocked by:** T3, T4

- [ ] qoder/codex/gemini/pi/opencode manifest 带 gate 接线 + emit.test 断言
- [ ] `pnpm run emit` fresh + validate ALL PASS

## T6 os-init gates（安装器 + skill 薄分派）

**What to build:** `install-gates.mjs`（检测已装 harness → 引导包通道安装命令 → 写 trae/vibe/kiro/grok 原生 config → grok `--trust` 执行 / codex `/hooks`、gemini 指纹、trae Enable 引导）+ os-init skill 拆成薄分派（`spor.md` / `gates.md`，无参数列选项）。

**Blocked by:** T5

- [ ] 安装器幂等 + `--dry-run`；仅 4 个原生 config（trae/vibe/kiro/grok）
- [ ] 未知 `--harness` 退出非零；写失败明确报错
- [ ] `/os-init gates` / `/os-init spor` / 无参数分派 + validate ALL PASS

## T7 prompt-expansion router 迁 Node

**What to build:** superpowers-overrides 的 prompt-expansion / cursor-detect / cursor-enforce 从 bash 迁 Node，行为等价（`/brainstorming` 注入 `Skill(engineering:os-brainstorming)`、`/spor-*` 不再匹配、detect/enforce 输出），hooks.json 命令路径更新。

**Blocked by:** T0

- [ ] router 测试（注入 / 不匹配 / detect / enforce）+ hooks.json `.mjs`
- [ ] 旧 `.sh` 删除 + validate ALL PASS

## T8 文档（面向使用者）+ 终检

**What to build:** `docs/gate-install.md`（外部用户安装即用指南：每 harness 安装命令 → 验证 + 逐通道手动验收清单）+ README/CLAUDE/cross-harness 更新 + 零残留终检（gate 面无 `.sh`、无 `~/.oscaner`、无 sdd/spor 残留）。

**Blocked by:** T1-T7

- [ ] `docs/gate-install.md`（包通道安装 + os-init gates + 信任步骤 + 逐通道验证清单）
- [ ] README / CLAUDE.md / cross-harness 与 Node gate 一致
- [ ] 零残留 grep + `pnpm run validate` ALL PASS（对照 spec §2.10 验收逐条勾验）
