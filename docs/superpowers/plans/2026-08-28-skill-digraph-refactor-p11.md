# P11 cli-research 实施计划

- **Version**: v1.0 · 2026-08-28
- **Status**: Approved
- **Design spec**: [2026-08-28-skill-digraph-refactor-p11-design.md](../specs/2026-08-28-skill-digraph-refactor-p11-design.md)
- **base**: develop

---

## Global Constraints

- **串行 phase 纪律**：P11 是当前活跃 phase（P10 已 merge）。
- **CDD dispatch**：本 plan 的 task 通过 `cdd-task.mjs --harness <name> --task N --mode implement` 派发。
- **CLI background execution**：所有 CLI mode 调用必须以 background 方式运行。
- **路径约定**：`{pluginRoot}` = osuperpowers plugin 根（`packages/osuperpowers/`）。

---

### Task 1: Engine 层基础——cli-shared 提取 + research 模块

**PLAN_BASE**: develop HEAD

#### 目标

从 runner.mjs 提取共享 CLI 函数到 lib/cli-shared.mjs；新建 lib/research.mjs（prompt 构造 + findings 写入）。

#### 步骤

1. 新建 `packages/osuperpowers/bin/engine/lib/cli-shared.mjs`：
   - 从 runner.mjs 复制 `spawnCapture()` 和 `invokeCli()` 函数（保持原有签名和行为）
   - 同时复制 invokeCli 依赖的内部 helper：`extractStreamJsonFinal()`、`jsonValueEnd()`、`scanString()`、`scanBalanced()`
   - export spawnCapture 和 invokeCli（helper 为模块内部，不 export）

2. 修改 `packages/osuperpowers/bin/engine/lib/runner.mjs`：
   - 删除 `spawnCapture` 和 `invokeCli` 的本地定义
   - 新增 `import { spawnCapture, invokeCli } from "./cli-shared.mjs"`
   - 外部 API（导出函数签名）不变

3. 新建 `packages/osuperpowers/bin/engine/lib/research.mjs`：
   - `RESEARCH_METHODOLOGY` 常量：5 步框架文本（Scope → Investigate → Synthesize → Verify → Write），完整文本见 design spec §2.4
   - `buildResearchPrompt(briefContent)`：brief 内容 + methodology 构造完整 prompt
   - `writeFindings(outputPath, content)`：写入 findings Markdown 文件
   - export 两个函数 + methodology 常量

4. 新建 `packages/osuperpowers/bin/engine/tests/cli-shared.test.mjs`：
   - 测试 spawnCapture 基本功能（echo 命令）
   - 测试 invokeCli 参数传递

5. 新建 `packages/osuperpowers/bin/engine/tests/research.test.mjs`：
   - 测试 buildResearchPrompt 输出包含 methodology + brief 内容
   - 测试 writeFindings 创建文件并写入内容

6. 运行 `node packages/osuperpowers/bin/engine/tests/runner.test.mjs` 和 `node packages/osuperpowers/bin/engine/tests/contract.test.mjs`，确认全部通过——这些测试 import runner.mjs（现从 cli-shared.mjs re-export），验证外部 API 不变

#### 验证

```bash
node packages/osuperpowers/bin/engine/tests/cli-shared.test.mjs
node packages/osuperpowers/bin/engine/tests/research.test.mjs
node packages/osuperpowers/bin/engine/tests/runner.test.mjs
node packages/osuperpowers/bin/engine/tests/contract.test.mjs
```

#### Task brief path

`.superpowers/cdd/2026-08-28-skill-digraph-refactor-p11/task-1-brief.md`

---

### Task 2: cdd-research.mjs CLI 入口点

**PLAN_BASE**: 由 Task 1 commit 后的 HEAD 填充

#### 目标

新建 cdd-research.mjs 独立 CLI（不走 cdd-task.mjs），实现 research-only 工作流。

#### 步骤

1. 新建 `packages/osuperpowers/bin/engine/cdd-research.mjs`：
   - 参数解析：`--harness <name>` (required), `--brief <path>` (required), `--output <path>` (required), `-h/--help`
   - 解析 `RESEARCH_TIMEOUT` 环境变量（默认 600000ms = 10 min）
   - 加载 harness registry（`import { loadRegistry, checkHarness, CddBlockedError } from "./registry.mjs"`）→ checkHarness（try/catch CddBlockedError → stderr + 对应 exitCode）
   - 读取 brief 文件 → buildResearchPrompt（import research.mjs）
   - spawnCapture 调用 harness binary（import cli-shared.mjs）：**直接用 spawnCapture（不用 invokeCli）**——invokeCli 硬编码 task-review prefix 和 stream-json output，不适合 research。构造 harness CLI 命令（如 `claude -p "<prompt>"`）传给 spawnCapture
   - **timeout 监控**（P11 基础实现，P12 完善 edge cases）：使用 setTimeout + proc.kill 方案——spawn 子进程后启动 setTimeout(RESEARCH_TIMEOUT)，回调中 proc.kill 子进程 + exit 1（超时 → stderr RESEARCH_TIMEOUT）
   - 将 CLI stdout 写入 `--output` 路径（writeFindings）
   - exit 0 (success) / exit 1 (error) / exit 2 (usage)

2. 修改 `packages/osuperpowers/package.json`：
   - bin 字段新增：`"cdd-research": "./bin/engine/cdd-research.mjs"`

3. 新建 `packages/osuperpowers/bin/engine/tests/cdd-research.test.mjs`：
   - --help 返回 exit 0
   - 缺少必需参数返回 exit 2
   - dry-run 模式验证参数解析
   - 端到端测试：mock harness binary + 有效 brief → 验证 output 文件存在且包含 findings 结构

#### 验证

```bash
node packages/osuperpowers/bin/engine/cdd-research.mjs --help
CDD_DRY_RUN=1 node packages/osuperpowers/bin/engine/cdd-research.mjs --harness test --brief /tmp/brief.md --output /tmp/out.md
node packages/osuperpowers/bin/engine/tests/cdd-research.test.mjs
```

#### Task brief path

`.superpowers/cdd/2026-08-28-skill-digraph-refactor-p11/task-2-brief.md`

---

### Task 3: cli-research skill（节点锚定式）

**PLAN_BASE**: 由 Task 2 commit 后的 HEAD 填充

#### 目标

新建 cli-research SKILL.md（节点锚定式，5 节点 + BLOCKED 终态）+ zh-CN 镜像。

#### 步骤

1. 新建 `packages/osuperpowers/skills/cli-research/SKILL.md`：
   - frontmatter: name, description
   - § Flow Digraph（mermaid）
   - § Node Definitions（5 节点 + BLOCKED 终态）：
     - read-upstream: Read mattpocock-skills research SKILL.md
     - select-harness: 跨 skill 调 cli-select ask 节点
     - prepare-brief: 从用户输入提取研究问题 + findings 路径，写 brief 文件
     - dispatch-research: 调 cdd-research.mjs（background execution）
     - report: 读 findings 报告给用户
   - § Invariants（I1 Read not Skill-invoke, I2 CLI Background, I3 Findings Path由调用方定）
   - § Failure Modes 表

2. 新建 `packages/osuperpowers/skills/cli-research/SKILL.zh-CN.md`：中文镜像

3. 确认符合 `docs/maintainers/skill-authoring.md` 规范（节点锚定式）：
   - 每节点含 Do/Read/Exit/Fail 四要素
   - mermaid digraph 节点数 = 6（5 操作节点 + 1 BLOCKED）
   - Invariants 表存在（≤ 5 条）
   - 无独立 Rules / Red Flags / Checklist 小节

#### 验证

- SKILL.md 节点数 = 5 + BLOCKED 终态
- 每节点含 Do/Read/Exit/Fail 四要素
- zh-CN 镜像内容同步
- 全仓无 dangling 引用

#### Task brief path

`.superpowers/cdd/2026-08-28-skill-digraph-refactor-p11/task-3-brief.md`

---

### Task 4: brainstorming explore-context 集成 + zh-CN + emit

**PLAN_BASE**: 由 Task 3 commit 后的 HEAD 填充

#### 目标

更新 brainstorming explore-context 节点新增可选 CLI 路径；全仓 emit + validate 绿。

#### 步骤

1. 修改 `packages/osuperpowers/skills/brainstorming/SKILL.md`：
   - explore-context 节点 Do 字段扩展：新增 CLI 路径分支描述
   - 「已知 harness」定义：session context 有 harness / 用户显式指定
   - CLI 路径：prepare brief → `node {pluginRoot}/bin/engine/cdd-research.mjs` → findings 落盘
   - 默认行为不变（Agent tool spawn）

2. 修改 `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md`：同步

3. 运行 `pnpm run emit && pnpm run validate` 确认绿

4. 更新 overall spec P11 phase 行 status: Done

#### 验证

```bash
pnpm run emit && pnpm run validate
```

#### Task brief path

`.superpowers/cdd/2026-08-28-skill-digraph-refactor-p11/task-4-brief.md`
