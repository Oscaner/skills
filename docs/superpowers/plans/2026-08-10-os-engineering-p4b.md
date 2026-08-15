# os-engineering P4b Implementation Plan：统一 gate 面迁 Node + 11 gate adapters + os-init gates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 CDD gate 从 bash 迁到 Node 中立核心，为 9 个 harness 建 gate adapter，并交付 os-init gates —— 外部用户安装即用。

**Architecture:** 门决策抽为语言无关的 Node 核心（`gateDecide` 纯函数 + 薄 CLI），11 个 adapter（7 原生 hook Node adapter + opencode/pi TS adapter + claude/cursor 迁移）只做各 harness 的 JSON I/O 翻译。有包通道的 harness 走原生安装即用（`pi install` / opencode `plugin` 数组 / gemini `extensions install` / qoder-codex 插件 / grok 经 Claude marketplace）；无包通道的 trae/vibe/kiro 由 `os-init gates` 写原生 config。CDD 引擎保持 bash（P5 迁），仅挪进 `bin/engine/`。

**Tech Stack:** Node.js（`.mjs` + `node:test`）、Bash（engine 保留，P5 迁）、JSON/TOML（harness config 模板）、`@oscaner-skills/engineering` npm 包分发。

## Global Constraints

- **分发视角最高约束（overall v2.6）**：面向外部使用者分发，非自用 —— 外部用户安装即用、零冗余步骤、无私有路径/机器假设、文档面向使用者而非作者。
- **门语义移植不改**：`pending.mode` / fail-open / git 只读白名单 / write 路径边界行为与 bash `cdd_gate_decide` 等价 —— 回归测试锁定。
- **门核心契约**：`gateDecide({ harness, toolName, toolInput, sessionKey, repoRoot }) → { decision: "allow"|"deny", reason: string, context: { taskNum, planBase } | null }`。核心不感知任何 harness 响应格式。
- **Node (.mjs)**：gate/hook 面全迁 Node；CDD 引擎（`bin/engine/` bash）+ ci-validate + shell/python 测试是 **P5**，P4b 只挪目录不改语言。
- **11 adapters**：9 新 targets（grok/qoder/trae/codex/gemini/vibe/kiro + opencode/pi TS）+ claude/cursor 迁 Node。Copilot 推迟（matcher 忽略）、Rovo N/A。
- **交付通道**：有包通道 harness 走原生安装即用（claude/cursor/grok marketplace、qoder/codex 插件、gemini extension、pi `pi install`、opencode `plugin` 数组）；os-init gates 仅 trae/vibe/kiro 写原生 config + 信任引导。无 `~/.oscaner/` 整树拷贝。
- **gate↔engine 接缝**：`cdd_pending_path` 迁入 `cdd-common.sh`（engine 侧）；`cdd_orchestrator-gate.sh` 拆解（决策 → Node 核心）。
- `pnpm run validate` 每任务后 ALL PASS；conventional commits，无 attribution / co-author trailer；禁 git worktree；零 sdd/spor 残留。

---

## File Structure

| 文件 | 责任 | Task |
|---|---|---|
| `packages/engineering/bin/engine/` | CDD 引擎 bash（自 `bin/` 迁入；P5 换语言，P4b 不动逻辑）| T1 |
| `packages/engineering/bin/engine/lib/cdd-common.sh` | 引擎 lib；吸收 `cdd_pending_path`（engine 唯一 gate 依赖）| T1 |
| `packages/engineering/bin/gate/cdd-gate-core.mjs` | 门决策纯函数 `gateDecide`（语言无关，不感知 harness 格式）| T2 |
| `packages/engineering/bin/gate/cdd-gate-decide.mjs` | 薄 CLI（stdin JSON → stdout JSON；P5/外部稳定接口）| T2 |
| `packages/engineering/bin/gate/adapters/*.mjs` | 11 个 adapter（各 harness hook JSON → 核心 → 原生响应）| T3/T4/T5 |
| `packages/engineering/bin/gate/configs/` | 原生 config 模板（trae/vibe/kiro/grok）+ opencode/pi 安装片段 | T6/T7 |
| `packages/engineering/bin/gate/tests/*.test.mjs` | 核心 + adapter node:test（fixture 驱动）| T2/T3/T4/T5 |
| `packages/engineering/bin/os-init/install-gates.mjs` | os-init gates 安装器（检测/引导/写 4 个原生 config/信任）| T7 |
| `packages/engineering/skills/os-init/` | SKILL.md 薄分派 + `spor.md` + `gates.md` | T8 |
| `scripts/lib/emit/*.mjs` | per-harness manifest 接线（qoder/codex/gemini/pi/opencode hooks/extension/plugin）| T6 |
| `packages/superpowers-overrides/bin/*.mjs` | prompt-expansion / cursor-detect / cursor-enforce 迁 Node | T9 |
| `packages/engineering/hooks/*.json` | emit 生成的 claude/cursor hooks（命令 → `gate/adapters/*.mjs`）| T3/T6 |
| `docs/` + `README*` | 面向使用者的文档 + 终检 | T10 |

---

### Task 1: 目录重组（bin/ → engine/ + gate/ 骨架）+ cdd_pending_path 迁移

**Files:**
- Move: `packages/engineering/bin/cdd-run.sh` / `cdd-exec.sh` / `cdd-select.sh` / `cdd-session-activate.sh` → `packages/engineering/bin/engine/`
- Move: `packages/engineering/bin/lib/cdd-common.sh` / `harness-registry.json` → `packages/engineering/bin/engine/`
- Modify: `packages/engineering/bin/engine/lib/cdd-common.sh`（吸收 `cdd_pending_path`）
- Modify: `packages/engineering/bin/lib/cdd-orchestrator-gate.sh`（source cdd-common.sh；`cdd_pending_path` 定义移出）
- Modify: `packages/engineering/bin/cdd-session-activate.sh` → `engine/cdd-session-activate.sh`（改 source `engine/lib/cdd-common.sh`）
- Create: `packages/engineering/bin/gate/` 骨架（`cdd-gate-core.mjs` 占位 + `adapters/` `configs/` `tests/` 空目录 + README）
- Modify: 全仓引用（skills 里 cdd-run 路径、docs、emit hook 命令路径、validate 脚本、superpowers-overrides 引用）

**Interfaces:**
- Consumes: 无（P4a 已就位的 packages/ 布局）
- Produces: `bin/engine/`（bash 引擎，路径不变逻辑不变）+ `bin/gate/`（Node gate 骨架）+ `cdd_pending_path` 归 `cdd-common.sh`

- [ ] **Step 1: git mv 引擎脚本进 `bin/engine/`**

```bash
mkdir -p packages/engineering/bin/engine/lib
git mv packages/engineering/bin/cdd-run.sh packages/engineering/bin/engine/
git mv packages/engineering/bin/cdd-exec.sh packages/engineering/bin/engine/
git mv packages/engineering/bin/cdd-select.sh packages/engineering/bin/engine/
git mv packages/engineering/bin/cdd-session-activate.sh packages/engineering/bin/engine/
git mv packages/engineering/bin/lib/cdd-common.sh packages/engineering/bin/engine/lib/
git mv packages/engineering/bin/harness-registry.json packages/engineering/bin/engine/
```

- [ ] **Step 2: `cdd_pending_path` + `CDD_PENDING_ROOT`/`CDD_PENDING_TTL` 迁入 `cdd-common.sh`，解除 engine↔gate 依赖**

从 `cdd-orchestrator-gate.sh` 把 `cdd_pending_path()` 函数体 + `CDD_PENDING_ROOT`（`${TMPDIR:-/tmp}/oscaner-engineering/pending-cdd`）+ `CDD_PENDING_TTL` 移到 `engine/lib/cdd-common.sh`（`cdd-session-activate.sh` 用了这两个变量 + 函数）。`cdd-orchestrator-gate.sh` 顶部加 `source "${SCRIPT_DIR}/../engine/lib/cdd-common.sh"`（它停在 `bin/lib/`，cdd-common 已迁 `bin/engine/lib/`；其 `cdd_gate_decide` 内部仍调 `cdd_pending_path`）。`engine/cdd-session-activate.sh` 的 `source …/lib/cdd-orchestrator-gate.sh` 改为 `source "${SCRIPT_DIR}/lib/cdd-common.sh"`。确认 `cdd-session-activate.sh` 只依赖 `cdd_pending_path` + 这两个变量（实测 line 60-61）—— 无其它 gate-lib 依赖。

- [ ] **Step 3: 建 `bin/gate/` 骨架**

```bash
mkdir -p packages/engineering/bin/gate/adapters packages/engineering/bin/gate/configs packages/engineering/bin/gate/tests
echo "gate/ — Node CDD gate surface (P4b). 核心 + adapters + configs + tests." > packages/engineering/bin/gate/README.md
```

- [ ] **Step 4: 更新全仓引用**

`grep -rn "bin/cdd-\|lib/cdd-common\|lib/cdd-orchestrator-gate\|bin/harness-registry" packages/engineering/skills packages/engineering/tests scripts packages/superpowers-overrides docs README.md README.zh-CN.md CLAUDE.md` —— 逐一改为 `bin/engine/…`。重点：skills 里 `cli-*` 引用 cdd-run 的路径、`scripts/emit.mjs` + `scripts/lib/emit/*` 里 hook 命令路径与 harness-registry 路径、`scripts/ci-validate.sh` 的 engine 测试路径、superpowers-overrides 的引用。`cdd-orchestrator-gate.sh` 在 T2（Node 核心）落地前保留在 `bin/lib/`。

- [ ] **Step 5: 回归验证**

```bash
pnpm run validate
```

Expected: ALL PASS —— engine shell 测试（cdd-cli-dry-run-smoke / commit-gate-smoke / select / common-functions）+ gate smoke + node lib 测试全绿。`cdd-session-activate.sh` 在 `bin/engine/` 下可用（`cdd_pending_path` 来自 cdd-common.sh）。

- [ ] **Step 6: 提交**

```bash
git add -A packages/engineering/bin packages/engineering/skills packages/engineering/tests scripts packages/superpowers-overrides docs README.md README.zh-CN.md CLAUDE.md
git commit -m "refactor: reorganize engineering bin into engine/ + gate/ skeleton"
```

---

### Task 2: 门核心 Node（gateDecide 纯函数 + 薄 CLI + 语义移植测试）

**Files:**
- Create: `packages/engineering/bin/gate/cdd-gate-core.mjs`
- Create: `packages/engineering/bin/gate/cdd-gate-decide.mjs`
- Create: `packages/engineering/bin/gate/adapters/lib.mjs`（readStdin / sha256 / sessionKeyFromJson —— T2-T5 共用）
- Test: `packages/engineering/bin/gate/tests/cdd-gate-core.test.mjs`
- （`cdd-orchestrator-gate.sh` 保留到 T3 —— claude/cursor `.sh` adapter + gate smoke 仍 source 它）

**Interfaces:**
- Consumes: T1（`bin/gate/` 骨架；`cdd_pending_path` 已在 `cdd-common.sh`）
- Produces: `import { gateDecide } from "../cdd-gate-core.mjs"` —— 11 个 adapter（T3/T4）与 CLI（本任务）调用

- [ ] **Step 1: 写失败测试（fixture 覆盖语义表）**

`cdd-gate-core.test.mjs`（`node:test`）。**pending 路径对齐引擎**：`CDD_PENDING_ROOT` env（默认 `${TMPDIR:-/tmp}/oscaner-engineering/pending-cdd`）—— 测试设 `CDD_PENDING_ROOT` 为临时目录并写 pending。核心用例：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { gateDecide } from "../cdd-gate-core.mjs";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const root = mkdtempSync("/tmp/gate-test-");
const pendingRoot = `${root}/pending`;
mkdirSync(pendingRoot, { recursive: true });
process.env.CDD_PENDING_ROOT = pendingRoot;
function writePending(key, data) {
  writeFileSync(`${pendingRoot}/${key}.json`, JSON.stringify(data));
}

test("fail-open: 无 pending → allow", () => {
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: {}, sessionKey: "s1", repoRoot: root });
  assert.equal(r.decision, "allow");
});
test("expired pending (>24h) → clear + allow", () => {
  writePending("s1", { repo_root: root, detected_at: Math.floor(Date.now()/1000) - 25*3600, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: root }, sessionKey: "s1", repoRoot: root });
  assert.equal(r.decision, "allow");
  assert.ok(!existsSync(`${pendingRoot}/s1.json`));
});
test("mode in-session → Write allow（repo 编辑放行）", () => {
  writePending("s2", { repo_root: root, detected_at: Math.floor(Date.now()/1000), mode: "in-session" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: `${root}/x.md` }, sessionKey: "s2", repoRoot: root });
  assert.equal(r.decision, "allow");
});
test("cli 严格 + Write 出 workspace → deny + reason", () => {
  const ws = `${root}/ws`; mkdirSync(ws, { recursive: true });
  writePending("s3", { repo_root: root, detected_at: Math.floor(Date.now()/1000), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Edit", toolInput: { file_path: `${root}/outside.md` }, sessionKey: "s3", repoRoot: root });
  assert.equal(r.decision, "deny");
  assert.ok(r.reason.length > 0);
  assert.equal(r.context.taskNum, 1); // 锁定 deny 结构化上下文
});
test("shell + git 只读动词（status）→ allow", () => {
  writePending("s4", { repo_root: root, detected_at: Math.floor(Date.now()/1000), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git status" }, sessionKey: "s4", repoRoot: root });
  assert.equal(r.decision, "allow");
});
test("shell + git 变更动词（commit）→ deny", () => {
  writePending("s5", { repo_root: root, detected_at: Math.floor(Date.now()/1000), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git commit -m x" }, sessionKey: "s5", repoRoot: root });
  assert.equal(r.decision, "deny");
  assert.match(r.reason, /cdd-run/); // 锁定 deny 文案含恢复指引（等价 cdd_deny_message）
});
```

其余 fixture 用例（至少覆盖）：shell 复合命令 `git status && rm x` → deny；`git diff` → allow；`git branch -D x` → deny；无 repo_root → allow；`.superpowers/sdd` 回退 workspace 解析；`task_complete` phase → allow。

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
node --test packages/engineering/bin/gate/tests/cdd-gate-core.test.mjs
```

Expected: FAIL（`gateDecide` 未定义 / 模块不存在）。

- [ ] **Step 3: 实现 `cdd-gate-core.mjs`**

从 `bin/lib/cdd-orchestrator-gate.sh` 逐函数移植（源在仓内，行为为准）：

- **pending 状态**：pending 文件 = `join(env.CDD_PENDING_ROOT ?? `${TMPDIR:-/tmp}/oscaner-engineering/pending-cdd`, sessionKey + ".json")` —— **与引擎 `cdd_pending_path` 同一路径**（否则生产 gate 永远找不到 pending → 静默 fail-open no-op）。`{ repo_root, detected_at, mode, ... }`。过期 TTL = `env.CDD_PENDING_TTL ?? 86400`（24h）→ 清除 + allow。
- **写工具集**：`Write | StrReplace | Edit | WriteNotebook | MultiEdit`；**shell 工具集**：`Bash | Shell`。
- **路径/命令提取**：`toolInput.file_path ?? toolInput.path`；`toolInput.command`。
- **git 只读白名单**：`status diff log show rev-parse branch remote ls-files diff-tree`；拒绝复合（`&& | ; > < $( \`` 换行）与变更子参数（`branch -d/-D/-m`、`remote add/remove/set-url`、位置参数）。
- **workspace 解析**：`repoRoot/.superpowers/cdd` + `.superpowers/sdd` 回退（对齐 bash）；**含 `git -C <dir> rev-parse --show-toplevel` 探测**（`cdd_find_active_workspace` 依赖）与 `git cat-file -e`（`cdd_git_object_exists`，验证 brief `TASK_BASE` 是否为真实 SHA）。
- **phase 判定**：`inactive | orchestrating | task_active | task_complete`（对齐 `cdd_gate_phase`）。
- **模式感知**：`mode: in-session | subagent | ""` → Write/Edit allow；`cli` → `write_allowed` 判定。
- **返回**：`{ decision, reason, context }` —— deny 时 `context: { taskNum, planBase }`（`cdd_active_task_num` / `cdd_plan_basename` 移植）；reason 为默认文案（含恢复指引，等价 `cdd_deny_message`）。

导出：`export function gateDecide(input)` + `export { isWriteTool, isShellTool, readonlyGitVerbs, gitVerbAllowed }`（adapter 测试可复用）。**副作用**：清除过期 pending（删文件）；只读 git exec（`rev-parse`/`cat-file`/`status`，`execFileSync` + catch → allow）；不写 workspace/不 commit。

- [ ] **Step 4: `adapters/lib.mjs` + 薄 CLI `cdd-gate-decide.mjs`**

`gate/adapters/lib.mjs`（T3-T5 复用）：

```js
export async function readStdin() { /* collect process.stdin → string */ }
export function sha256(s) { /* node:crypto 摘要截 16 位 */ }
export function sessionKeyFromJson(d) {
  if (d.conversation_id) return d.conversation_id;
  if (d.session_id) return d.session_id;
  return sha256(d.prompt ?? "");
}
```

`gate/cdd-gate-decide.mjs`：

```js
#!/usr/bin/env node
import { gateDecide } from "./cdd-gate-core.mjs";
import { readStdin } from "./adapters/lib.mjs";
const input = JSON.parse(await readStdin());
process.stdout.write(JSON.stringify(gateDecide(input)));
// exit 0 恒返回；deny 表达在 JSON，由调用方翻译（bash engine P5 过渡 + 外部/测试）
```

`chmod +x`。CLI 测试：`echo '{"toolName":"Bash",...}' | node cdd-gate-decide.mjs` 输出 JSON。

- [ ] **Step 5: 跑测试确认 PASS + 回归**

```bash
node --test packages/engineering/bin/gate/tests/cdd-gate-core.test.mjs
pnpm run validate
```

Expected: 核心测试全 PASS；validate ALL PASS（现有 gate 行为等价，shell gate smoke 仍绿 —— T3 迁移 claude/cursor adapter 前旧 `.sh` 仍用）。

- [ ] **Step 6: 提交**

```bash
git add -A packages/engineering/bin/gate packages/engineering/bin/lib
git commit -m "feat: Node cdd-gate-core + thin CLI (gateDecide semantics port)"
```

---

### Task 3: claude / cursor adapter 迁 Node + emit hooks 路径更新

**Files:**
- Create: `packages/engineering/bin/gate/adapters/claude.mjs`、`cursor.mjs`
- Test: `packages/engineering/bin/gate/tests/claude.test.mjs`、`cursor.test.mjs`
- Delete: `packages/engineering/bin/override-claude-cdd-gate.sh`、`override-cursor-cdd-gate.sh`、`packages/engineering/bin/lib/cdd-orchestrator-gate.sh`（最后一个 bash 消费者迁完）
- Delete: `packages/engineering/tests/override-claude-cdd-gate.test.sh`、`override-cursor-cdd-gate.test.sh`、`cdd-gate-allow-deny-smoke.sh`、`cdd-gate-test-lib.sh`（行为样例已迁 T2/T3 Node 测试）
- Modify: `scripts/lib/emit/manifests.mjs`（`engineeringClaudeHooks` / `engineeringCursorHooks` 命令路径 → `.mjs`）
- Modify: `scripts/ci-validate.sh`（去掉引用已删测试/`-x` 检查的步骤；gate 校验改 `node --test`）
- Modify（生成产物）: `packages/engineering/hooks/hooks.json`、`hooks-cursor.json`

**Interfaces:**
- Consumes: T2（`gateDecide`）
- Produces: claude/cursor 的 hook 走 Node adapter（emit 生成 hooks.json 命令 → `gate/adapters/*.mjs`）；其余 7+2 adapter 的骨架模板（T4 复用）

- [ ] **Step 1: 写失败测试（adapter fixture）**

`claude.test.mjs`：喂 claude PreToolUse hook JSON，断言 `permissionDecision`。

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ADAPTER = fileURLToPath(new URL("../adapters/claude.mjs", import.meta.url));
function run(env, input) {
  return JSON.parse(execFileSync("node", [ADAPTER], { input: JSON.stringify(input), env: { ...process.env, ...env }, encoding: "utf8" }));
}
test("claude hook: 无 pending → allow", () => {
  const out = run({}, { session_id: "s1", tool_name: "Write", tool_input: { file_path: "/tmp/x.md" } });
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
});
test("claude hook: cli 严格 + Write 出 workspace → deny", () => {
  // fixture repo + pending（复用 cdd-gate-core fixture 布局，CDD_GATE_FIXTURES_ROOT 指向临时 repo）
  const root = mkdtempSync("/tmp/gate-test-"); // ... 建 pending mode=cli
  const out = run({ CDD_GATE_FIXTURES_ROOT: root }, { conversation_id: "s1", tool_name: "Edit", tool_input: { file_path: "/tmp/outside.md" } });
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
});
test("claude hook: 异常 → fail-open allow", () => {
  const out = run({}, { tool_name: "Write" }); // 无 session key → 仍 allow
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
});
```

`cursor.test.mjs` 同理（cursor `preToolUse` 输入：`{ tool_name, tool_input, session_id }`，输出**顶层** `{ permission: "allow" | "deny", agent_message }` —— 对齐现行 `override-cursor-cdd-gate.sh` 的响应形状，勿改格式）。cursor deny 测试断言 `agent_message` 含恢复指引。

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
node --test packages/engineering/bin/gate/tests/claude.test.mjs packages/engineering/bin/gate/tests/cursor.test.mjs
```

Expected: FAIL（adapter 不存在）。

- [ ] **Step 3: 实现 `adapters/claude.mjs` + `cursor.mjs`**

从 `override-claude-cdd-gate.sh` / `override-cursor-cdd-gate.sh` 迁（源在仓内）：

```js
#!/usr/bin/env node
// gate/adapters/claude.mjs
import { gateDecide } from "../cdd-gate-core.mjs";
const input = JSON.parse(await readStdin());
try {
  const sessionKey = input.conversation_id ?? input.session_id ?? sha256(input.prompt ?? "").slice(0, 16);
  const r = gateDecide({ harness: "claude", toolName: input.tool_name, toolInput: input.tool_input ?? {}, sessionKey, repoRoot: process.cwd() });
  const decision = r.decision === "deny" ? "deny" : "allow";
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: r.decision === "deny" ? r.reason : "" } }));
} catch (e) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" } })); // fail-open
  console.error(`[cdd-gate claude] ${e.message}`, e.stderr ?? ""); // stderr 记录
}
```

cursor.mjs 输出 cursor 格式（**顶层** `{ permission: "allow" }` / `{ permission: "deny", agent_message: <恢复指引> }` —— 对齐现行 `.sh`，勿用 `hookSpecificOutput` 包装）。session key 提取复用 claude 逻辑；`repoRoot` 从 `process.cwd()`（hook 时工作目录）。claude deny 的 `permissionDecisionReason` / cursor deny 的 `agent_message` 用 `r.context`（taskNum/planBase）渲染，回退 `r.reason`。

- [ ] **Step 4: 更新 emit hooks 生成（命令 → `.mjs`）**

`scripts/lib/emit/manifests.mjs` 的 `engineeringClaudeHooks` / `engineeringCursorHooks`（**注意：在 manifests.mjs，不在 overrides.mjs**）：命令路径从 `${CLAUDE_PLUGIN_ROOT}/bin/override-claude-cdd-gate.sh` → `${CLAUDE_PLUGIN_ROOT}/bin/gate/adapters/claude.mjs`（cursor 同理 → `gate/adapters/cursor.mjs`）。跑 `pnpm run emit` 重新生成 `packages/engineering/hooks/*.json`。`scripts/lib/emit/emit.test.mjs` 对应断言更新。

- [ ] **Step 5: 删旧 bash gate 面 + 更新 ci-validate + 删 gate 旧 shell 测试**

```bash
rm packages/engineering/bin/override-claude-cdd-gate.sh packages/engineering/bin/override-cursor-cdd-gate.sh packages/engineering/bin/lib/cdd-orchestrator-gate.sh
rm packages/engineering/tests/override-claude-cdd-gate.test.sh packages/engineering/tests/override-cursor-cdd-gate.test.sh packages/engineering/tests/cdd-gate-allow-deny-smoke.sh packages/engineering/tests/cdd-gate-test-lib.sh
node --test packages/engineering/bin/gate/tests/
pnpm run validate
```

更新 `scripts/ci-validate.sh`：去掉引用上述已删测试的步骤（含 `[ -x …/override-claude-cdd-gate.sh ]` 检查），gate 行为校验改为 `node --test packages/engineering/bin/gate/tests/`。**必须与本任务同步，否则 validate 红到 T9**。旧 shell 测试（含 `cdd-gate-allow-deny-smoke.sh` 的 58 断言）的行为样例已在 T2（门核心语义）+ T3（adapter I/O + deny 文案）Node 测试覆盖。

Expected: 新 adapter 测试全 PASS；validate ALL PASS（emit fresh）。

- [ ] **Step 6: 提交**

```bash
git add -A packages/engineering/bin scripts packages/engineering/hooks
git commit -m "refactor: migrate claude/cursor gate adapters to Node (gate/adapters)"
```

---

### Task 4: 7 个原生 hook adapter（grok / qoder / trae / codex / gemini / vibe / kiro）

**Files:**
- Create: `packages/engineering/bin/gate/adapters/grok.mjs`、`qoder.mjs`、`trae.mjs`、`codex.mjs`、`gemini.mjs`、`vibe.mjs`、`kiro.mjs`
- Create: `packages/engineering/bin/gate/adapters/lib.mjs`（共享：readStdin / sessionKeyFromJson / sha256）
- Test: `packages/engineering/bin/gate/tests/grok.test.mjs`、`qoder.test.mjs`、`trae.test.mjs`、`codex.test.mjs`、`gemini.test.mjs`、`vibe.test.mjs`、`kiro.test.mjs`

**Interfaces:**
- Consumes: T2（`gateDecide`）、T3（adapter 骨架模式 + `lib.mjs`）
- Produces: 7 个 adapter —— T5 的 emit manifest 接线（qoder/codex/gemini 插件 hooks）与 T6 的 os-init（trae/vibe/kiro 原生 config）引用；os-init 引导命令打印各 harness 包通道安装

- [ ] **Step 1: 共享 helper `adapters/lib.mjs`**

```js
export async function readStdin() { /* collect process.stdin → string */ }
export function sha256(s) { /* node:crypto 摘要，截 16 位 */ }
export function sessionKeyFromJson(d) {
  if (d.conversation_id) return d.conversation_id;
  if (d.session_id) return d.session_id;
  return sha256(d.prompt ?? "");
}
```

- [ ] **Step 2: 7 个 adapter —— 每 harness I/O 矩阵（源：`docs/research/2026-08-10-harness-hooks-matrix.md`，主源已核实）**

每个 adapter = `parse(该 harness hook 输入) → gateDecide → emit(该 harness 响应)`，**意外异常 → 该 harness 的 allow 响应 + stderr 记录（fail-open）**：

| Adapter | hook 输入 | session key 提取 | 响应（deny 时）|
|---|---|---|---|
| grok | `.grok/hooks/*.json` → stdin JSON（`tool_name`/`tool_input`/`conversation_id`）| conversation/session/prompt | stdout `{"decision":"deny"}`（allow → `{"decision":"allow"}`）|
| qoder | `.qoder/settings.json` hook → stdin JSON（Claude 同名 `tool_name`/`tool_input`）| 同上 | `{"permissionDecision":"deny","permissionDecisionReason":...}` |
| trae | `.trae/hooks.json` → stdin JSON（Cursor 形 `tool_name`/`tool_input`）| 同上 | `{"hookSpecificOutput":{"permissionDecision":"deny"}}`（或 exit 2）|
| codex | `.codex/hooks.json` → stdin JSON（`tool_name`/`tool_input`/`session_id`）| 同上 | `{"permissionDecision":"deny"}` / `{"decision":"block"}` |
| gemini | `.gemini/settings.json` `BeforeTool` → stdin JSON（`tool_name`/`tool_input`）| 同上 | `{"decision":"block","reason":...}`（allow → `{"decision":"allow"}`）|
| vibe | `.vibe/hooks.toml` `pre_tool` → stdin JSON（`tool_name`/`tool_input`）| 同上 | `{"decision":"deny","reason":...}` |
| kiro | `.kiro/hooks/*.json` `PreToolUse` action command → stdin JSON（`tool_name`/`tool_input`）| 同上 | `{"decision":"deny","reason":...}`（kiro v1 格式）|

`repoRoot = process.cwd()`（hook 时工作目录）。

- [ ] **Step 3: 每 adapter fixture 测试（喂该 harness hook JSON → 断言原生响应）**

`grok.test.mjs`：

```js
const ADAPTER = fileURLToPath(new URL("../adapters/grok.mjs", import.meta.url));
test("grok hook: cli 严格 + Bash git commit → deny", () => {
  const root = mkdtempSync("/tmp/gate-test-"); // 建 pending mode=cli（复用 T2 fixture 布局）
  const out = JSON.parse(execFileSync("node", [ADAPTER], { input: JSON.stringify({ session_id: "s1", tool_name: "Bash", tool_input: { command: "git commit -m x" } }), env: { ...process.env, CDD_GATE_FIXTURES_ROOT: root }, encoding: "utf8" }));
  assert.deepEqual(out, { decision: "deny" });
});
```

其余 6 个 `*.test.mjs` 同构：qoder → 断言 `permissionDecision:"deny"`；trae → 断言 `permissionDecision`；codex → `permissionDecision`/`decision`；gemini → `decision:"block"`；vibe → `decision:"deny"`；kiro → `decision:"deny"`。每 adapter 至少覆盖：无 pending allow、cli 严格 + 写/变更命令 deny、异常 fail-open allow。

- [ ] **Step 4: 跑测试确认 FAIL**

```bash
node --test packages/engineering/bin/gate/tests/grok.test.mjs packages/engineering/bin/gate/tests/qoder.test.mjs packages/engineering/bin/gate/tests/trae.test.mjs packages/engineering/bin/gate/tests/codex.test.mjs packages/engineering/bin/gate/tests/gemini.test.mjs packages/engineering/bin/gate/tests/vibe.test.mjs packages/engineering/bin/gate/tests/kiro.test.mjs
```

Expected: FAIL（adapter 不存在）。

- [ ] **Step 5: 实现 7 个 adapter**

按 Step 2 矩阵实现。共享骨架（grok 例）：

```js
#!/usr/bin/env node
import { gateDecide } from "../cdd-gate-core.mjs";
import { readStdin, sessionKeyFromJson } from "./lib.mjs";
const d = JSON.parse(await readStdin());
try {
  const r = gateDecide({ harness: "grok", toolName: d.tool_name, toolInput: d.tool_input ?? {}, sessionKey: sessionKeyFromJson(d), repoRoot: process.cwd() });
  process.stdout.write(JSON.stringify({ decision: r.decision === "deny" ? "deny" : "allow" }));
} catch (e) {
  process.stdout.write(JSON.stringify({ decision: "allow" })); // grok 天然 fail-open
  console.error(`[cdd-gate grok] ${e.message}`, e.stderr ?? "");
}
```

- [ ] **Step 6: 跑测试 PASS + validate**

```bash
node --test packages/engineering/bin/gate/tests/
pnpm run validate
```

Expected: 全部 adapter 测试 PASS；validate ALL PASS。

- [ ] **Step 7: 提交**

```bash
git add -A packages/engineering/bin/gate
git commit -m "feat: 7 native-hook gate adapters (grok/qoder/trae/codex/gemini/vibe/kiro)"
```

---

### Task 5: opencode / pi TS adapter

**Files:**
- Create: `packages/engineering/bin/gate/adapters/opencode.mjs`（TS plugin）、`pi.mjs`（TS extension）
- Test: `packages/engineering/bin/gate/tests/opencode.test.mjs`、`pi.test.mjs`

**Interfaces:**
- Consumes: T2（`gateDecide` + `adapters/lib.mjs`）
- Produces: opencode/pi TS adapter（`import { gateDecide }`，随 `@oscaner-skills/engineering` 包分发）—— T6 emit 接线引用

- [ ] **Step 1: 写失败测试**

`opencode.test.mjs`：TS plugin 导出 `{ tool: { execute: { before: fn } } }`，喂 opencode tool 上下文，断言 deny 时 throw / allow 时放行。

```js
import { plugin } from "../adapters/opencode.mjs";
test("opencode plugin: cli 严格 + Bash git commit → throw", async () => {
  const root = mkdtempSync("/tmp/gate-test-"); // 建 pending mode=cli（CDD_PENDING_ROOT=临时目录）
  await assert.rejects(() => plugin.tool.execute.before({ name: "bash", args: { command: "git commit -m x" }, session: { id: "s1" } }, { root }));
});
```

`pi.test.mjs`：extension 导出 `on("tool_call")`，断言 deny → `{ block: true, reason }`。

- [ ] **Step 2: 实现 `opencode.mjs` + `pi.mjs`**

```js
// gate/adapters/opencode.mjs —— TS plugin（tool.execute.before）
import { gateDecide } from "../cdd-gate-core.mjs";
export const plugin = {
  tool: {
    execute: {
      async before(tool, context) {
        const r = gateDecide({ harness: "opencode", toolName: tool.name, toolInput: tool.args ?? {}, sessionKey: context.session?.id ?? "oc", repoRoot: context.root ?? process.cwd() });
        if (r.decision === "deny") throw new Error(r.reason); // opencode：throw 阻断
      },
    },
  },
};
```

```js
// gate/adapters/pi.mjs —— TS extension（tool_call block）
import { gateDecide } from "../cdd-gate-core.mjs";
export async function on(event, ctx) {
  if (event !== "tool_call") return {};
  const r = gateDecide({ harness: "pi", toolName: ctx.tool?.name, toolInput: ctx.args ?? {}, sessionKey: ctx.session?.id ?? "pi", repoRoot: process.cwd() });
  if (r.decision === "deny") return { block: true, reason: r.reason };
  return {};
}
```

（pi extension 的精确导出形态按 `docs/research` 的 pi extensions 文档；opencode 的 session/args 字段名按 opencode plugins 文档校准。）

- [ ] **Step 3: 跑测试 PASS（本任务不碰 emit）**

```bash
node --test packages/engineering/bin/gate/tests/opencode.test.mjs packages/engineering/bin/gate/tests/pi.test.mjs
pnpm run validate
```

Expected: TS adapter 测试 PASS；validate ALL PASS（emit 未改，产物 fresh 不变）。

- [ ] **Step 4: 提交**

```bash
git add -A packages/engineering/bin/gate
git commit -m "feat: opencode/pi TS gate adapters"
```

---

### Task 6: emit per-harness manifest 接线（qoder/codex/gemini/pi/opencode）

**Files:**
- Create: `packages/engineering/bin/gate/configs/opencode.json`（`plugin` 数组片段）、`configs/pi/`（包 `pi` key 参考）
- Modify: `scripts/lib/emit/manifests.mjs`（codexPluginManifest hooks / geminiExtension hooks / piPackageKey extensions / 新增 qoderPluginManifest）+ `scripts/lib/emit/overrides.mjs`（如有）+ `scripts/lib/emit/emit.test.mjs`
- Modify（生成产物）: 各 manifest + `packages/engineering/package.json`（pi key）

**Interfaces:**
- Consumes: T4（codex/gemini/qoder adapter 存在）、T5（opencode/pi adapter + configs 片段）
- Produces: 包通道 harness 的 manifest 接线 —— T7 os-init 引导命令引用

- [ ] **Step 1: emit 接线（per-harness manifest 内嵌 gate）**

`scripts/lib/emit/manifests.mjs`：
- `codexPluginManifest`：空 hooks → 加 `PreToolUse`（`gate/adapters/codex.mjs`）。
- `geminiExtension`：thin → 加 `hooks`（`BeforeTool` → `gate/adapters/gemini.mjs`）+ 引用 `GEMINI.md`。
- `piPackageKey`：纯 skills → 加 `extensions`（`bin/gate/adapters/pi.mjs` 相对包内路径）。
- 新增 `qoderPluginManifest`：`.qoder-plugin` plugin.json + `hooks/hooks.json`（`PreToolUse` → `gate/adapters/qoder.mjs`）。
- `configs/opencode.json`：`{ "plugin": ["@oscaner-skills/engineering"] }` 片段（用户合并进 opencode.json）。
- `emit.test.mjs` 断言同步更新（qoder manifest、codex/gemini/pi hooks 内容）。

`packages/engineering/package.json` 的 `pi` key 增加 extensions 引用（emit 生成）。

- [ ] **Step 2: 跑 emit + validate**

```bash
pnpm run emit && pnpm run validate
```

Expected: emit fresh；validate ALL PASS（manifest 接线断言全绿）。

- [ ] **Step 3: 提交**

```bash
git add -A scripts packages/engineering/package.json
git commit -m "feat: per-harness gate manifest wiring (qoder/codex/gemini/pi/opencode)"
```

---

### Task 7: os-init gates 安装器（install-gates.mjs）+ 原生 config 模板

**Files:**
- Create: `packages/engineering/bin/os-init/install-gates.mjs`
- Create: `packages/engineering/bin/gate/configs/trae/hooks.json`、`configs/vibe/hooks.toml`、`configs/kiro/hooks.json`、`configs/grok/engineering.json`
- Test: `packages/engineering/bin/os-init/tests/install-gates.test.mjs`

**Interfaces:**
- Consumes: T4（7 adapter）、T6（manifest 接线）、T5（opencode/pi）
- Produces: `node …/bin/os-init/install-gates.mjs` —— T8 gates.md 驱动的安装器

- [ ] **Step 1: 写失败测试（幂等 + dry-run + 仅 4 个原生 config）**

`install-gates.test.mjs`（node:test，隔离 HOME 目录）：

```js
const HOME = mkdtempSync("/tmp/os-init-");
test("dry-run：不写任何机器文件", () => {
  run(["--dry-run"], { HOME });
  assert.ok(!existsSync(`${HOME}/.vibe/hooks.toml`));
});
test("vibe 检测到 → 写 ~/.vibe/hooks.toml（复制 configs/vibe/hooks.toml）", () => {
  run(["--harness", "vibe"], { HOME }); // fixture：fake `vibe` 命令在 PATH
  assert.ok(readFileSync(`${HOME}/.vibe/hooks.toml`).includes("pre_tool"));
});
test("未知 harness → 退出非零", () => {
  assert.throws(() => run(["--harness", "foo"], { HOME }));
});
test("grok 已装 → 写 ~/.grok/hooks/engineering.json + 打印/执行 `grok --trust`", () => {
  const out = run(["--harness", "grok"], { HOME });
  assert.ok(existsSync(`${HOME}/.grok/hooks/engineering.json`)); // 原生 config（spec §2.6 推荐单路径）
  assert.match(out, /grok --trust/);
});
test("trae/vibe/kiro/grok 是唯一写原生 config 的；pi/opencode/gemini/qoder/codex 只引导命令", () => {
  // 断言：只有 ~/.trae ~/.vibe ~/.kiro ~/.grok 下出现文件；其余 harness 输出「安装命令」而非写文件
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
node --test packages/engineering/bin/os-init/tests/install-gates.test.mjs
```

Expected: FAIL（install-gates.mjs 不存在；且 configs/grok 模板未建 —— 先建模板再跑，避免错因）。

- [ ] **Step 3: 实现 `install-gates.mjs`**

```js
#!/usr/bin/env node
// 用法: node install-gates.mjs [--harness grok,qoder,…] [--dry-run]
// 1. 检测: command -v <harness> + 配置目录存在（trae: 无 CLI → 检查 ~/.trae 或 IDE）
// 2. 引导（打印命令，不写文件）:
//    pi        → `pi install @oscaner-skills/engineering`
//    opencode  → opencode.json `plugin` 数组加 `@oscaner-skills/engineering`
//    gemini    → `gemini extensions install <repo-url>`
//    qoder     → 装 `.qoder-plugin`（marketplace/本地）
//    codex     → 装 `.codex-plugin`（/plugins）
// 3. 写原生 config（无包通道 + grok 单路径）: 复制 gate/configs/<h>/ → 机器路径
//    trae → ~/.trae/hooks.json；vibe → ~/.vibe/hooks.toml；kiro → ~/.kiro/hooks/engineering.json
//    grok → ~/.grok/hooks/engineering.json（spec §2.6：原生单路径推荐，避免 claude.mjs 双跑歧义）
// 4. 信任: grok → 写 config 后执行 `grok --trust`（或打印）；codex → 打印 `/hooks`；gemini → 打印「首次接受指纹」；trae → 打印「Enable + sandbox/local」
// 5. 报告 + `--dry-run` 只预览
```

幂等：重复运行覆盖原生 config（保留用户非冲突内容）；已信任跳过。未知 `--harness` → stderr + exit 1。写失败 → 明确报错不静默。

- [ ] **Step 4: config 模板（trae/vibe/kiro/grok）**

`configs/trae/hooks.json`（Cursor 格式，命令 → `node …/gate/adapters/trae.mjs`）、`configs/vibe/hooks.toml`（`[[hooks]]` `type="pre_tool"` → `node …/gate/adapters/vibe.mjs`）、`configs/kiro/hooks.json`（v1 `PreToolUse` action command → `node …/gate/adapters/kiro.mjs`）、`configs/grok/engineering.json`（`PreToolUse` → `node …/gate/adapters/grok.mjs`）。命令指向**包内 adapter 绝对路径**（安装时解析）。**模板在 Step 1 测试前创建**（避免测试错因：缺源 vs 缺模块）。

- [ ] **Step 5: 跑测试 PASS + validate**

```bash
node --test packages/engineering/bin/os-init/tests/install-gates.test.mjs
pnpm run validate
```

Expected: 全 PASS；validate ALL PASS（`gate/configs/**` parse 校验纳入 ci-validate 或 gate 测试）。

- [ ] **Step 6: 提交**

```bash
git add -A packages/engineering/bin/os-init packages/engineering/bin/gate/configs
git commit -m "feat: os-init gates installer + trae/vibe/kiro/grok config templates"
```

---

### Task 8: os-init skill 薄分派（SKILL.md + spor.md + gates.md）

**Files:**
- Modify: `packages/engineering/skills/os-init/SKILL.md`（薄分派器）
- Create: `packages/engineering/skills/os-init/spor.md`（从 SKILL.md 正文拆出）、`gates.md`

**Interfaces:**
- Consumes: T7（install-gates.mjs）
- Produces: `/os-init gates` 入口 —— T10 文档引用的使用者安装路径

- [ ] **Step 1: `spor.md`** —— 把现有 SKILL.md 的「自检表初始化流程」正文移到 `spor.md`（`os-init spor` 指令：写 CLAUDE.md override-trigger 表 + .cursor rules，来源 = overrides manifest 单一 SOT）。

- [ ] **Step 2: `gates.md`** —— `os-init gates` 指令：

```
/os-init gates [--harness …] [--dry-run]
  1. 让 agent 跑 `node …/bin/os-init/install-gates.mjs`（检测/引导/写 3 个原生 config/信任）
  2. agent 剩余角色：执行/引导信任（grok --trust、codex /hooks、gemini 指纹、trae Enable）
  3. 汇总报告：各 harness 已生效 / 需人工步骤
```

- [ ] **Step 3: `SKILL.md` 改薄分派器**

```markdown
---
name: os-init
description: 参数化初始化工具。`os-init spor` 初始化 superpowers 自检表；`os-init gates` 安装跨 harness gate。
---
按参数分派：`spor` → 执行 [spor.md](spor.md)；`gates` → 执行 [gates.md](gates.md)。
无参数 → 列出可用目标（spor / gates）供用户选择。
```

保留 `engineering-version` stamp（validate 的 os-init self-check 断言依赖）。`scripts/ci-validate.sh` 的 os-init 校验如有对 SKILL.md 内容断言 → 同步。

- [ ] **Step 4: 验证**

```bash
pnpm run validate
```

Expected: ALL PASS（os-init self-check rows 仍 mirror manifest targets；skill 目录有 SKILL.md）。

- [ ] **Step 5: 提交**

```bash
git add -A packages/engineering/skills/os-init scripts/ci-validate.sh
git commit -m "refactor: os-init skill split — thin dispatcher + spor.md + gates.md"
```

---

### Task 9: prompt-expansion router 迁 Node（superpowers-overrides/bin）

**Files:**
- Create: `packages/superpowers-overrides/bin/prompt-expansion.mjs`、`cursor-detect.mjs`、`cursor-enforce.mjs`
- Delete: `packages/superpowers-overrides/bin/override-prompt-expansion.sh`、`override-cursor-detect.sh`、`override-cursor-enforce.sh`
- Modify: `scripts/lib/emit/overrides.mjs`（router hooks 命令 → `.mjs`）+ `scripts/templates/override-*.sh`（删除/改 mjs 模板）+ `emit.test.mjs`
- Modify（生成产物）: `packages/superpowers-overrides/hooks/hooks.json`、`hooks-cursor.json`
- Test: `packages/superpowers-overrides/tests/prompt-expansion.test.mjs`、`cursor-detect.test.mjs`、`cursor-enforce.test.mjs`（**放 superpowers-overrides 下**，测的是 overrides 的 router）

**Interfaces:**
- Consumes: 无（router 独立于 gate 核心）
- Produces: router 全 Node —— P5 后 overrides 可执行面无 bash

- [ ] **Step 1: 写失败测试（router 行为等价）**

`prompt-expansion.test.mjs`：断言 `prompt-expansion.mjs` 对 `<input>` 注入的 `Skill(...)` 目标与 overrides manifest 一致（`claudeHooksJson` 两个 matcher：`^superpowers:` + bare `/<slug>`；`/spor-*` 不再匹配）。

```js
import { fileURLToPath } from "node:url";
const ROUTER = fileURLToPath(new URL("../../superpowers-overrides/bin/prompt-expansion.mjs", import.meta.url));
test("prompt-expansion: bare /brainstorming → 注入 Skill(engineering:os-brainstorming)", () => {
  const out = execFileSync("node", [ROUTER], { input: "/brainstorming", encoding: "utf8" });
  assert.match(out, /Skill\(engineering:os-brainstorming\)/);
});
test("prompt-expansion: /spor-* 不再匹配（exit 0 空输出）", () => {
  const out = execFileSync("node", [ROUTER], { input: "/spor-brainstorming", encoding: "utf8" });
  assert.equal(out.trim(), "");
});
```

`cursor-detect.test.mjs` / `cursor-enforce.test.mjs` 同理（detect 输出 target skill_suffix + attach regexes；enforce 嵌入 read-regexes）。

- [ ] **Step 2: 实现 3 个 `.mjs`** —— 从 `.sh` 迁（源在仓内），逻辑等价：prompt-expansion 读 stdin 匹配 trigger → 输出 `Skill(<target>)` 注入上下文；cursor-detect 输出 `continue` + skill_suffix；cursor-enforce 输出 allow/deny JSON。无 jq 依赖（Node JSON.parse）。

- [ ] **Step 3: emit hooks 命令更新 + 删旧 `.sh`**

`scripts/lib/emit/overrides.mjs` 的 `claudeHooksJson` / `cursorDetectScript` / `cursorEnforceScript` 命令路径 → `.mjs`；`scripts/templates/override-*.sh` 删除（或改 `.mjs` 模板）。`pnpm run emit` 重新生成 hooks.json。删 3 个旧 `.sh`。

- [ ] **Step 4: 测试 + validate**

```bash
node --test packages/superpowers-overrides/tests/prompt-expansion.test.mjs packages/superpowers-overrides/tests/cursor-detect.test.mjs packages/superpowers-overrides/tests/cursor-enforce.test.mjs
pnpm run emit && pnpm run validate
```

Expected: router 测试 PASS；validate ALL PASS（`== validate expansion script ==` / cursor hooks 校验绿；emit fresh）。

- [ ] **Step 5: 提交**

```bash
git add -A packages/superpowers-overrides scripts
git commit -m "refactor: migrate prompt-expansion/cursor router to Node"
```

---

### Task 10: 文档（面向使用者）+ 终检

**Files:**
- Modify: `README.md` / `README.zh-CN.md` / `CLAUDE.md` / `packages/superpowers-overrides/docs/cross-harness-overrides.md`
- Create: `docs/gate-install.md`（使用者安装指南：各 harness 安装即用命令 + os-init gates + 信任步骤）

**Interfaces:**
- Consumes: T1-T9
- Produces: 文档一致 + validate ALL PASS —— P4b 验收

- [ ] **Step 1: 使用者安装指南 `docs/gate-install.md`**

面向**外部使用者**：安装 `@oscaner-skills/engineering` 后 —— claude/cursor/grok 走 marketplace、qoder/codex 插件、gemini `extensions install`、pi `pi install`、opencode opencode.json、trae/vibe/kiro/grok 跑 `os-init gates`；信任步骤（grok --trust / codex /hooks / gemini 指纹 / trae Enable）。每 harness 一栏「安装命令 → 验证」。

**包通道手动验收清单**（spec §2.10 item 3 —— 逐通道写出验证命令）：

| 通道 | 安装 | 验证 |
|---|---|---|
| pi | `pi install @oscaner-skills/engineering` | extension 出现在 pi 列表 / 触发 tool_call 见 gate 响应 |
| opencode | opencode.json `plugin` 数组加包名 | 启动无插件错误；试 Bash 被 gate 拦截 |
| gemini | `gemini extensions install <repo-url>` | 列表见 extension；BeforeTool hook 触发 |
| qoder/codex | 装插件 | 插件 hooks 生效 + codex `/hooks` 信任 |
| grok | marketplace 或 os-init 原生 config | `.grok/hooks/engineering.json` 存在；触发 deny |

- [ ] **Step 2: README / CLAUDE.md / cross-harness 更新**

README 插件表补 gate 交付；CLAUDE.md 的 gate/hook 描述改 Node（`gate/` 路径）；cross-harness-overrides.md 的 router hooks 描述与 matcher 数保持一致。

- [ ] **Step 3: 终检（零残留 + 验收）**

```bash
# 零残留：旧 bin/*.sh gate 面 + sdd/spor + ~/.oscaner 引用
if grep -rnE '\b(override-claude-cdd-gate\.sh|override-cursor-cdd-gate\.sh|override-prompt-expansion\.sh|~/.oscaner|sdd_orchestrator|spor-' packages/engineering/bin packages/superpowers-overrides/bin README.md README.zh-CN.md CLAUDE.md 2>/dev/null; then echo "RESIDUE"; exit 1; fi
node --test packages/engineering/bin/gate/tests packages/engineering/bin/os-init/tests packages/superpowers-overrides/tests
pnpm run emit && pnpm run validate
```

对照 spec §2.10 验收标准逐条勾验：`gateDecide` 等价 / 11 adapter / 包通道安装即用（上表逐通道验证）/ os-init 仅 4 个原生 config / emit manifest 接线 / router 迁 Node / os-init skill 分派 / engine/ 迁移 / validate ALL PASS。

- [ ] **Step 4: 提交**

```bash
git add -A docs README.md README.zh-CN.md CLAUDE.md packages/superpowers-overrides/docs
git commit -m "docs: gate install guide + P4b consumer docs + zero-residue check"
```
