# os-engineering P4b 阶段设计：统一 gate 面迁 Node + 11 gate adapters（9 新 + claude/cursor 迁移）+ os-init gates

## Header

- **Version**: v1.0 · 2026-08-15
- **Status**: Draft
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering overall v2.6](2026-08-10-os-engineering-overall.md)
- **Depends on**: P4a（发布架构 v2：packages/vendors + 包即源 + 统一发布）—— 本阶段叠于 `feat/os-engineering-p4`（P4a 未合并）

## §0 Incremental warning

> P4b 增量。跨阶段约定见 [overall v2.6](2026-08-10-os-engineering-overall.md)；冲突以 overall 为准。

## §1 Constraints pointer

- 不重复 overall 约定；冲突以 overall 为准。
- **分发视角最高约束（overall v2.6）**：这套 skills 面向外部使用者分发（非自用）。P4b 的 gate 交付以「外部用户安装即用」为验收基线 —— 包通道优先、os-init 一次性设置、无私有路径/机器假设；文档面向使用者而非作者。
- **门语义移植不改**：`pending.mode` / fail-open / git 只读白名单 / write 路径边界行为与 bash `cdd_gate_decide` 等价（回归测试锁定）。
- **脚本语言统一（P4b 起）**：gate/hook 面迁 Node；CDD 引擎（engine/ bash）+ ci-validate + shell/python 测试迁 Node 是 **P5**，本阶段只把 `bin/engine/` 挪进子目录、不改语言。
- Conventional commits、无 attribution / co-author trailer；禁 git worktree；过渡期 `pnpm run validate` 必须保持通过。

## §2 Design body

### 2.0 范围（grilling 确认）

- **gate = 统一概念，不分 shell/TS** —— 所有 blocking tool-gate harness 平级覆盖。
- **11 gate adapters** = **9 新 targets**（grok / qoder / trae / codex / gemini / vibe / kiro 原生 hook 触发 Node adapter + opencode / pi **TS adapter** import 门核心）+ **claude/cursor adapter 迁 Node**。
- **消费者视角交付**：adapter + 门核心随 `@oscaner-skills/engineering` 包分发；有原生包/插件通道的 harness 走**安装即用**（claude/cursor/grok/qoder/codex/gemini/pi（pi 通道已降级为 experimental —— 实际经 os-init 复制 extension 到 ~/.pi/agent/extensions/，非 package `pi` key；见 T13/最终实现）/opencode），os-init 只为**无包通道的 3 个**（trae/vibe/kiro）写原生 config + 信任引导。无 `~/.oscaner/` 约定、无整树拷贝。
- **Copilot 推迟**（matcher 被忽略 → gate 只能自己过滤工具）；**Rovo N/A**（无 hooks 事件文档）。
- **门决策抽中立核心**（Node `.mjs`，允许破坏性重构）—— `cdd_gate_decide` 从 bash 抽出为单一实现 + 薄 CLI。
- **gate/hook 面全迁 Node**（门核心 + 全部 adapter + claude/cursor adapter + prompt-expansion router，~800 行 bash 消灭）。
- **交付 os-init gates**（消费者一次性设置：引导包通道安装 + 仅 trae/vibe/kiro 写原生 config + 信任引导）。
- **分支**：叠 `feat/os-engineering-p4`。

### 2.1 架构（数据流）

```
                    ┌─────────────────────────────────────────────┐
                    │  cdd-gate-core.mjs  （Node，单一决策来源）    │
                    │  gateDecide({toolName, toolInput,            │
                    │             sessionKey, harness, repoRoot})  │
                    │    → { decision, reason, context }           │
                    │  读取：workspace / pending / briefs/handoffs │
                    │        / git 只读白名单                      │
                    │  + 薄 CLI：stdin JSON → stdout JSON          │
                    └──────────────▲──────────────────────────────┘
                                   │ import（进程内）/ exec（子进程）
        ┌──────────────┬───────────┼───────────┬──────────────┐
   ┌────┴─────┐  ┌─────┴─────┐  ┌──┴─────┐  ┌───┴────┐  ┌─────┴──────┐
   │claude.mjs│  │cursor.mjs │  │grok.mjs│  │qoder…  │  │vibe/kiro…  │  ← 11 adapter
   │(迁 Node) │  │(迁 Node)  │  │        │  │(×5)    │  │  (+codex/  │
   └──────────┘  └───────────┘  └────────┘  └────────┘  │  trae/gemini│
       ▲              ▲            ▲                      └────────────┘
    hooks.json     hooks-cursor  .grok/hooks   .qoder/settings.json  .vibe/hooks.toml
    (emit 生成)    (emit 生成)   engineering.json    .gemini/settings.json  .kiro/hooks/*.json
                              .codex/hooks.json .trae/hooks.json
                              （os-init gates 引导包通道安装；仅 trae/vibe/kiro 写机器 config）
   opencode.mjs / pi.mjs：TS adapter，作为插件/扩展加载，import 门核心
```

数据流：harness 触发 hook → 调对应 adapter（原生 hook 配置指向 `node …/bin/gate/adapters/<harness>.mjs`；opencode/pi 是 TS 直接 import）→ adapter 解析该 harness 的 hook JSON → 调 `gateDecide` → 核心决策 → adapter 翻译成该 harness 原生 deny/allow 响应。

**关键边界**：核心不感知任何 harness 响应格式（语言无关）；adapter 只做 I/O 翻译。

### 2.2 目录重组（`bin/` 按 concern 重组）

```
packages/engineering/bin/
  engine/                      ← bash，保持（P5 迁 Node 时原位换语言）
    cdd-run.sh  cdd-exec.sh  cdd-select.sh  cdd-session-activate.sh
    lib/cdd-common.sh          ← 吸收 cdd_pending_path（engine 唯一 gate-lib 依赖）
    harness-registry.json
  gate/                        ← Node（P4b 新建/迁入）—— 整个 gate 生态自包含
    cdd-gate-core.mjs          ← 决策核心（纯函数，不感知 harness 格式）
    cdd-gate-decide.mjs        ← 薄 CLI（stdin JSON → stdout JSON；P5/外部稳定接口）
    adapters/                  ← 每 harness 一个
      claude.mjs  cursor.mjs  grok.mjs  qoder.mjs  trae.mjs  codex.mjs
      gemini.mjs  vibe.mjs  kiro.mjs  opencode.mjs  pi.mjs
    configs/                   ← 原生 config 模板（仅无包通道 harness；os-init 写机器）
      trae/hooks.json  vibe/hooks.toml  kiro/hooks.json
      opencode.json  pi/     ← 安装片段（opencode `plugin` 数组行、pi 包 `pi` key 参考）
    （grok/qoder/codex/gemini 的 hook config 由 emit 从各自 manifest 生成，非独立模板）
    tests/                     ← node:test（核心 + 每 adapter fixture）
      cdd-gate-core.test.mjs  <harness>.test.mjs …
  os-init/
    install-gates.mjs          ← os-init gates 安装器（Node）

packages/engineering/hooks/    ← emit 生成的 claude/cursor hook 配置（保持；命令 → gate/adapters/*.mjs）

packages/superpowers-overrides/bin/
  prompt-expansion.mjs         ← 迁自 override-prompt-expansion.sh
  cursor-detect.mjs            ← 迁自 override-cursor-detect.sh
  cursor-enforce.mjs           ← 迁自 override-cursor-enforce.sh

scripts/                       ← 不变（publish/CI 机制，P4a 已整理，不属于 gate/hook 面）
```

**安装布局（消费者视角）**：adapter + 门核心随 `@oscaner-skills/engineering` 包分发。有包通道的 harness 走原生安装即用：
- claude / cursor → marketplace（P4a 已建）；grok → 读 Claude marketplace 原样消费。
- qoder / codex → `.qoder-plugin` / `.codex-plugin` 插件（manifest 内嵌 gate hooks，emit 生成）。
- gemini → `gemini extensions install <repo>`（extension hooks）。
- pi → `pi install @oscaner-skills/engineering`（核实：一键装包即注册 settings，extension 自动加载）（pi 通道已降级为 experimental —— 实际经 os-init 复制 extension 到 ~/.pi/agent/extensions/，非 package `pi` key；见 T13/最终实现）。
- opencode → opencode.json `plugin` 数组一行（核实：npm 自动安装）。
- 无包通道 3 个（trae / vibe / kiro）→ os-init 写原生 config（指向安装包内 adapter 路径）。

**gate ↔ engine 接缝**：`cdd-session-activate.sh`（engine，bash 保留到 P5）仅用 gate-lib 的 `cdd_pending_path`（实测 line 61）。`cdd_orchestrator-gate.sh` 拆解：决策逻辑（`cdd_gate_decide` 及辅助）→ Node 门核心；`cdd_pending_path` → 迁入 `cdd-common.sh`（engine 侧）。engine 不再依赖 gate 面，P4b「gate 全迁 Node」与「engine 保持 bash」同时成立。

重组原则：
1. **一目录一职责** —— `gate/`（核心+adapter+config+测试自包含）、`engine/`（引擎，P5 只改语言）、`os-init/`。
2. **gate 自包含** —— 装一个新 harness = 在 `gate/adapters/` 加一个文件 + `gate/configs/<harness>/` 加模板，不碰其它。
3. **hooks/ 保持 emit 生成** —— claude/cursor 的 hooks.json 仍由 `oscaner-plugin.hooks` 生成，命令路径指向 `gate/adapters/*.mjs`。
4. **破坏性迁移**（已批准）：`bin/override-*-gate.sh` → `bin/gate/adapters/*.mjs`；`bin/cdd-*.sh` → `bin/engine/`；hook 命令路径、skills 引用（cdd-run 路径）、docs、测试同步更新。

### 2.3 核心契约 + 语义移植

**核心契约**（`cdd-gate-core.mjs`，纯函数）：

```js
gateDecide({
  harness,      // "claude" | "cursor" | "grok" | "qoder" | … —— 仅用于 deny 消息措辞
  toolName,     // "Write" | "Edit" | "Bash" | …
  toolInput,    // { file_path, command, … }（各 harness 同构化后的字段）
  sessionKey,   // hook JSON 的会话键
  repoRoot,     // hook 时的工作目录
}) → {
  decision: "allow" | "deny",
  reason: string,           // 默认 deny 文案（跨 harness 可用）
  context: { taskNum, planBase } | null,   // deny 时的结构化上下文，供 adapter 渲染原生文案
}
```

**`reason` 契约钉死**：核心返回**默认文案 `reason: string` + 结构化 `context`**（taskNum/planBase）。adapter 优先用 `context` 渲染该 harness 的原生 deny 文案，无定制则回退 `reason`。这样核心不感知 harness 格式，adapter 保留按 harness 定制文案的能力。

**薄 CLI 调用方**：`cdd-gate-decide.mjs` 是稳定 JSON 契约接口 —— 供 bash engine（P5 过渡期）与外部/测试调用；11 个 adapter 进程内 `import` 核心不经 CLI（避免双跳）。

**语义移植清单**（bash → Node，不改行为）：

| 语义 | bash 现状 | Node 移植 |
|---|---|---|
| fail-open | 无 jq → allow；pending 缺失/过期/无 repo_root → allow | 核心总函数（预期状态全处理）；adapter 捕获意外异常 → allow |
| 模式感知 | `pending.mode`: in-session/subagent/空 → Write/Edit allow；cli 严格 | 原样 |
| shell 工具 | 提取命令 → git 只读白名单（`git status/diff/log/…`，拒绝 `&& \| ; > <` 复合/变更类）| 原样（白名单表 bash 常量 → Node 数据） |
| write 工具 | 提取路径 → normalize → 必须落在 active workspace 内 | 原样（`path.resolve` 等效） |
| workspace 解析 | `.superpowers/cdd` + `.superpowers/sdd` 回退 | 原样 |
| pending 生命周期 | 读/过期(>24h)/清除 | 原样 |
| deny 消息 | `cdd_deny_message harness task_num plan_base` | 核心返回结构化 reason，adapter 渲染该 harness 响应格式 |

### 2.4 adapter 骨架 + 9 harness 差异表

每个 adapter 三段：**解析**（该 harness hook JSON → 同构 `{toolName, toolInput, sessionKey}` + `repoRoot`）→ **调核心** → **翻译**（→ 该 harness 原生 deny/allow）。

```js
// bin/gate/adapters/<harness>.mjs
const input = await readStdin();            // 该 harness 的 hook JSON/TOML
const norm = normalize<harness>(input);     // → { toolName, toolInput, sessionKey, repoRoot }
const r = gateDecide({ harness, ...norm }); // 核心
emitResponse(r);                            // → 该 harness 原生 deny/allow
```

| Harness | Hook 事件 | 输入解析 | 响应翻译 | 信任处理 |
|---|---|---|---|---|
| Grok | `PreToolUse` | `.grok/hooks/*.json` → stdin JSON | stdout `{"decision":"deny"}`（或 exit 2）| 自动：装 config 后 `grok --trust`；天然 fail-open |
| Qoder | `PreToolUse` | `.qoder/settings.json`，Claude 同名事件 | `permissionDecision: "deny"` + reason | 无（无信任仪式）|
| Trae | `PreToolUse` | `.trae/hooks.json`，Cursor 格式 | exit 2 → `permissionDecision: deny` | 引导：创建时 Enable 按钮 + sandbox/local 模式 |
| Codex | `PreToolUse` | `.codex/hooks.json` | `permissionDecision: "deny"` / `updatedInput` | 引导：`/hooks` 逐 hook 信任审查 |
| Gemini | `BeforeTool` | `.gemini/settings.json`，matcher 正则 | Block Tool（阻断）| 引导：项目 hook 指纹化 |
| Vibe | `pre_tool` | `.vibe/hooks.toml`，stdin JSON | `decision: "deny"` + `reason` | os-init 写原生 config（无包通道）|
| Kiro | `PreToolUse` | `.kiro/hooks/*.json`，v1 `hooks[]` | action `command` → 拒绝输出 | os-init 写原生 config（无包通道）|
| OpenCode | `tool.execute.before`（TS plugin）| TS plugin 钩子对象 | throw 阻断 / 重写 `output.args` | 包通道：opencode.json `plugin` 数组一行（npm 自动装）|
| Pi | `on('tool_call')`（TS extension）| TS extension 事件 | `{block: true, reason}` | 包通道：`pi install @oscaner-skills/engineering` 一键（pi 通道已降级为 experimental —— 实际经 os-init 复制 extension 到 ~/.pi/agent/extensions/，非 package `pi` key；见 T13/最终实现） |

交付通道 + 信任拆分（消费者视角）：
- **包通道安装即用（os-init 不写 config）**：claude / cursor / grok（marketplace）、qoder / codex（插件 manifest）、gemini（extension install）、pi（`pi install`）（pi 通道已降级为 experimental —— 实际经 os-init 复制 extension 到 ~/.pi/agent/extensions/，非 package `pi` key；见 T13/最终实现）、opencode（`plugin` 数组）—— 装完 hooks 即生效。
- **os-init 写原生 config（无包通道 3 个）**：trae / vibe / kiro —— 复制 `configs/` 模板到机器。
- **信任引导（os-init 打印下一步）**：grok `--trust`（一条命令，os-init 可执行）；codex `/hooks` 逐 hook 审查；gemini 首次接受项目指纹；trae Enable 按钮 + sandbox/local 执行模式。

opencode/pi 的 TS adapter 用 `import { gateDecide } from "../cdd-gate-core.mjs"`（无进程边界）；随 `@oscaner-skills/engineering` 包分发，核心与 adapter 同包，import 在包内解析，不断链。

### 2.5 os-init gates 安装器

```
os-init gates [--harness grok,qoder,…] [--dry-run]
  1. 检测     command -v / 配置目录 / IDE 存在（各 harness）
  2. 引导     打印包通道安装命令（未装包通道才需要）：pi install @oscaner-skills/engineering（pi 通道已降级为 experimental —— 实际经 os-init 复制 extension 到 ~/.pi/agent/extensions/，非 package `pi` key；见 T13/最终实现）、
              opencode.json `plugin` 数组加一行、gemini extensions install <repo>、
              qoder/codex 插件安装、grok 装 claude marketplace
  3. 配置     只给无包通道 3 个写原生 config：trae/vibe/kiro（configs/ 模板 → 机器路径）
  4. 信任     grok --trust（os-init 执行）；codex /hooks、gemini 指纹、trae Enable（打印下一步）
  5. 报告     已生效 / 需人工 列表；--dry-run 预览
```

**config 目标路径映射**（无包通道 3 个 + 安装片段）：

| 模板 | 目标 |
|---|---|
| `configs/trae/hooks.json` | `~/.trae/hooks.json`（Cursor 格式）|
| `configs/vibe/hooks.toml` | `~/.vibe/hooks.toml` |
| `configs/kiro/hooks.json` | `~/.kiro/hooks/engineering.json` |
| `configs/opencode.json` | opencode.json `plugin` 数组加一行（npm 包名）|
| `configs/pi/` | pi 包 `pi` key 参考（`pi install` 自动注册 settings）（pi 通道已降级为 experimental —— 实际经 os-init 复制 extension 到 ~/.pi/agent/extensions/，非 package `pi` key；见 T13/最终实现）|
| —（grok/qoder/codex/gemini）| hook config 由 emit 从各自 manifest 生成，无独立模板 |

- 幂等：重复运行覆盖 config、保留非冲突内容（qoder/gemini 的 settings.json 合并 hooks key 而非整体覆盖）；已信任的跳过。
- 失败安全：未检测到 harness 的 adapter 不装；config 写失败 → 明确报错不静默。
- 未知 harness：`--harness foo` → 报「无此 adapter」退出非零。

**os-init skill 结构修订**：

```
packages/engineering/skills/os-init/
  SKILL.md          ← 薄分派器：按参数引用目标。/os-init spor → spor.md；/os-init gates → gates.md
                     无参数 → 列出可用目标（spor / gates / <future>）供选择
  spor.md           ← 现有自检表初始化流程（从 SKILL.md 正文拆出）
  gates.md          ← gates 安装流程（驱动 install-gates.mjs + 引导信任 + 汇总）
bin/os-init/
  install-gates.mjs ← Node 安装器（检测/复制/自动信任/报告，幂等，--dry-run）
```

调用路径：`/os-init gates`（skill 入口）→ agent 驱动 `node …/bin/os-init/install-gates.mjs`（确定性部分）+ 引导人工信任（codex `/hooks`、gemini 指纹、trae Enable）+ 汇总报告。

### 2.6 claude/cursor 迁移 + emit/validate 接线

- `bin/gate/adapters/claude.mjs` / `cursor.mjs` —— 从 `override-claude-cdd-gate.sh` / `override-cursor-cdd-gate.sh` 迁（同一核心，I/O 同构化）。
- `superpowers-overrides/bin/prompt-expansion.mjs` / `cursor-detect.mjs` / `cursor-enforce.mjs` —— 从 3 个 `.sh` 迁。
- 旧 `.sh` 删除（破坏性迁移）。
- `oscaner-plugin.hooks` 保持 claude/cursor 生成（emit 生成 hooks.json）—— 命令路径从 `.sh` → `.mjs`。
- **emit 扩展：per-harness manifest 内嵌 gate 接线** —— qoder/codex 插件 hooks、gemini extension hooks、pi 包 `pi` key extension、opencode 插件引用随各自 manifest 生成（P4a 的 codex/gemini/pi 薄 manifest 已有，P4b 补 hooks/extension/plugin 内容）。
- **Grok 特例**：Grok 兼容 Claude 插件（读 `.claude-plugin`），装 marketplace 后 `claude.mjs` 也会被 Grok 调用；同时 os-init 装原生 `.grok/hooks/engineering.json` → `grok.mjs`（统一 gate 面 + 独立可控）。两者可并存 —— 门决策幂等（同一 pending 状态），双跑无副作用；推荐只保留原生一条（配置简单，避免歧义）。
- **validate**：`gate/configs/**` 全部 parse（JSON/TOML）校验；每 adapter fixture 测试进 `node --test`；`cdd-gate-core.test.mjs` + 11 adapter 测试全绿。

### 2.7 错误处理

- fail-open：核心在「预期状态缺失」时 allow（无 pending / 过期 / 无 repo_root）；adapter 捕获一切意外异常 → allow（对齐 bash 无 jq → allow 语义）+ stderr 记录。
- os-init gates：config 写失败 → 明确报错不静默；未检测到 harness → 跳过并说明；`--dry-run` 只预览不写。
- 未知 harness：`os-init gates --harness foo` → 报「无此 adapter」退出非零。

### 2.8 非目标

- ❌ CDD 引擎（engine/ bash）迁移 —— **P5**，P4b 不碰（只挪目录）。
- ❌ Copilot adapter（matcher 忽略，推迟）；Rovo（无 hooks，N/A）。
- ❌ 门语义改动 —— 纯移植，`pending.mode` / fail-open / git 白名单行为与 bash 一致。
- ❌ 重写 emit 的 hook 生成机制 —— 只改命令路径（.sh → .mjs）。
- ❌ 不改上游 vendored 内容。

### 2.9 测试

- `cdd-gate-core.test.mjs`（node:test）：fixture 覆盖语义表每一行（fail-open / 模式感知 / shell 白名单 / write 路径 / workspace 解析 / pending 生命周期 / deny 消息）。
- 每 adapter `*.test.mjs`：喂该 harness 的 hook JSON fixture，断言原生 deny/allow 响应。
- `gate/configs/**` parse 校验（JSON/TOML）。
- 回归等价：现有 bash gate 测试（`cdd-gate-allow-deny-smoke.sh`、`override-claude-cdd-gate.test.sh`、`override-cursor-cdd-gate.test.sh`）的行为样例**迁移为 Node 测试**，锁定移植等价。其依赖的 `tests/fixtures/cdd-gate/` 数据保留（Node 测试复用）；`cdd-gate-test-lib.sh` 随 gate 面弃用（P5 清引擎 shell 测试时一并删除）。

### 2.10 验收标准

- [ ] `gateDecide` 行为与 bash `cdd_gate_decide` 等价（回归测试锁定）。
- [ ] 11 个 adapter 就位（9 新 + claude/cursor 迁移）+ fixture 测试全绿。
- [ ] 包通道安装即用逐个核实：pi `pi install` 一键（pi 通道已降级为 experimental —— 实际经 os-init 复制 extension 到 ~/.pi/agent/extensions/，非 package `pi` key；见 T13/最终实现）、opencode `plugin` 数组一行、gemini `extensions install`、qoder/codex 插件 hooks、grok 经 Claude marketplace。
- [ ] os-init gates：无包通道 3 个（trae/vibe/kiro）写原生 config + 引导命令幂等 + `--dry-run`；不复制整树、无 `~/.oscaner/`。
- [ ] claude/cursor hooks.json 命令路径指向 `.mjs`（emit 生成）；emit 扩展的 qoder/codex/gemini/pi/opencode manifest 接线全绿。
- [ ] prompt-expansion router 迁 Node 且行为等价。
- [ ] os-init skill 薄分派（spor / gates / 无参数列选项）。
- [ ] `bin/engine/` 目录迁移完成，所有引用（skills/docs/cdd-run 调用点）同步。
- [ ] `pnpm run validate` ALL PASS；零 sdd/spor 残留。

## §3 Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P4b = 跨 harness gate adapters + 重运行时产物（opencode/pi 不需要）| gate = 统一概念；opencode/pi 为 TS gate adapter（非「不需要」）| Yes — v2.5 · 2026-08-15 |
| Trae 原生 extension（格式待研）| Trae 为 gate adapter（hooks 系统已确认，Cursor 格式）| Yes — v2.5 |
| gate 本体 bash（`cdd-orchestrator-gate.sh`）| 抽中立核心（Node `.mjs`，破坏性重构）| Yes — v2.5 |
| Copilot 延后 | Copilot 推迟（matcher 忽略）；Rovo N/A（无 hooks）| Yes — v2.5 |
| （无此阶段）| 新增 P5：CDD 引擎 + ci-validate + shell/python 测试迁 Node | Yes — v2.5 |
| os-init gates 复制 config 模板到机器 | 消费者视角：包通道安装即用（pi/opencode/gemini/qoder/codex/grok）+ os-init 仅 trae/vibe/kiro 写原生 config | Yes — v2.5 |

## §4 Notes for downstream

- **P5** 复用 P4b 的 Node 门核心 + adapter + 测试基建模式，迁移 CDD 引擎（`engine/` bash → Node）、ci-validate、shell/python 测试。
- `bin/engine/` 已在 P4b 就位于子目录，P5 原位换语言、不动结构。
- **发布前人工项**（P4b 无关，源自 P4a）：GitHub `NPM_TOKEN` secret 配置；首次 publish-mode 运行监控。

## §5 Review

Rule 1 三个 subagent pass（completeness / consistency+scope / clarity+YAGNI）通过后交用户 review，再进入 writing-plans。
