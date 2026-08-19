# P7d：旧命名全量清理（零技术债务）

## Header

- **Version**: v1.0 · 2026-08-19
- **Status**: Approved
- **Phase**: P7d (of P7 series — brand unification)
- **Dependencies**: P7c（版本管理 + 发布流水线适配）完成后启动
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Constraints**:
  - Conventional commits，无 attribution / co-author trailer
  - 禁用 git worktree
  - 过渡期 `pnpm run validate` 必须保持通过
  - 派生文件（marketplace / manifests / `.agents/skills/` 复制）不手工编辑，只改 SOT 后重 emit

## §0 Document scope

P7d 是 P7 系列的收尾子阶段：把全仓库所有旧命名（`os-*` 技能前缀、`engineering` 插件名、`oscaner-engineering` 临时目录、`engineeringVersion`/`ENGINEERING_VERSION`）归零，**零技术债务**。P7a（包目录改名）/P7b（技能目录改名）/P7c（版本管理 + 发布流水线）完成了目录、命名空间与版本面，但上述旧命名仍残留在功能代码、config、测试 fixture、emit 函数名、插件文档与元数据中，且现行验收 grep 存在误放行盲区（同行共存旧词被 `-v osuperpowers` 过滤）。

**已确认的范围决策（brainstorming grilling）：**

1. **历史文档**：P7 系列（P7a/P7b/P7c 三套 + overall spec）同步到最终命名；P1-P6 specs/plans/tickets + `docs/research/` 保留为时代史实，验收设显式例外。
2. **文件名**：`2026-08-10-os-engineering-*.md` 等保留（阶段系列标识，grep 不扫文件名，overall §2 链接零改动）。
3. **上游字符串**：mattpocock 的 `category: "engineering"`/描述/`skills/engineering/` bucket 路径是**上游事实数据**，原样保留；验收加白名单车道。
4. **内部全量改名**：config channel key、`bin/os-init/` 目录、ci-validate 标签随 skill 名一起 `os-init` → `init`。

## §1 Canonical 替换映射

| 旧 | 新 | 类别 |
|---|---|---|
| `os-*` 家族描述词 | `osuperpowers`（插件/家族）或 `osuperpowers:*`（命名空间） | prose |
| `os-<skill>`、`"os-init"`（skill/命令引用） | `osuperpowers:<skill>` / `osuperpowers:init` | prose/code |
| `"os-init"` channel key | `"init"` | config |
| `bin/os-init/` | `bin/init/` | 目录 |
| `~/.engineering/state/` | `~/.osuperpowers/state/` | 安装产物 |
| `engineering.json` / `engineering.ts`（grok/kiro/pi 安装产物名 + 模板名 + hook 名） | `osuperpowers.json` / `osuperpowers.ts` | 安装产物 |
| `oscaner-engineering/pending-cdd`（运行时 pending 根） | `osuperpowers/pending-cdd` | 运行时路径 |
| `oscaner-engineering-cdd-gate`（vibe hook name） | `osuperpowers-cdd-gate` | config |
| `engineeringVersion`（manifest JSON 字段） | `osuperpowersVersion` | 字段 |
| `ENGINEERING_VERSION`（常量） | `OSUPERPOWERS_VERSION` | 常量 |
| `engineeringClaudeHooks`/`engineeringCursorHooks`/`engineeringHooksFor` | `osuperpowersClaudeHooks`/`osuperpowersCursorHooks`/`osuperpowersHooksFor` | emit 函数 |
| `category`/`keywords`：`"engineering"` | `"osuperpowers"` | 元数据 |
| `engineering`（插件名/路径/注释/描述/文案） | `osuperpowers` | 普适 |
| `source: "os-init"`（manifest 来源标记） | `source: "init"` | manifest 值 |
| `engineering-version`（仅存于 stale 文档引用） | `osuperpowers-version` | doc |

**不改**（白名单）：mattpocock 上游 `skills/engineering/<skill>/SKILL.md` 路径引用、`VENDOR_FALLBACK` 中 mattpocock 的 category/keywords、vendored 描述字符串、`docs/superpowers/` P1-P6 历史文档、mattpocock 发布 fixture。

## §2 元数据与 emit 面

### §2.1 `packages/osuperpowers/package.json` — category / keywords / description

**问题**：`oscaner-plugin.claude.category` 与 `keywords` 仍为 `"engineering"`；description 含 `os-* orchestrators` 家族词。这是 emit 的 SOT，派生产物全部继承。

### 改动

```diff
  "claude": {
-   "category": "engineering",
+   "category": "osuperpowers",
    "keywords": [
-     "engineering",
+     "osuperpowers",
      "cli",
      "cdd",
      "harness",
      "droid",
      "pi"
    ]
  }
```

description：`"Standalone osuperpowers skills: os-* orchestrators, cli-* family, CDD engine, cross-harness gate."` → `"Standalone osuperpowers skills: orchestration + cli-* family + CDD engine + cross-harness gate."`

### 验证

```bash
grep -nE 'engineering|os-\*' packages/osuperpowers/package.json   # 预期：无输出
```

### §2.2 `scripts/lib/emit/manifests.mjs` — emit 函数名

**问题**：`engineeringClaudeHooks` / `engineeringCursorHooks` / `engineeringHooksFor` 及 harness-set key `"engineering"`、7 处注释（行 223/256/264/276/288/300-301）。

**改动**：函数三连改名 `osuperpowers*`；行 330 harness-set key `"engineering"` → `"osuperpowers"`；注释同步。

### §2.3 `scripts/emit.mjs` — import/call + stale wrapper 检查

**问题**：行 66/203 引用 `engineeringHooksFor`；行 21/22/216/217 注释；行 435/438/467 stale wrapper 检查（`cursor-plugins/engineering/` 错误消息与 `extraStale` 条目）；行 146/426 函数 `emitOsEngineering`。

**改动**：import/call 跟随改名；注释 `engineering` → `osuperpowers`；**删除 stale wrapper 检查**（`staleWrapper` 与 `extraStale: ["cursor-plugins/engineering/"]`，行 435/438/467 —— 过渡已完成，`emit:check` 绿即证明；repo-root `cursor-plugins/` 旧名残留改由 §8 A2 文件名扫描兜底）；函数 `emitOsEngineering` → `emitOsuperpowers`。

### §2.4 `scripts/lib/emit/emit.test.mjs` — fixtures

**问题**：21 处 `engineering` + 4 处 `os-*` 描述 fixture —— import `engineering*Hooks`（行 16-18）、`category: "engineering"` + `keywords: ["engineering", ...]` fixtures（行 53-54/88-89/465-466）、§2.1 同款 description 字符串 fixture（行 49/82/279/458）、测试名与断言（行 77/187/529/547/557-575）。

**改动**：全部跟随映射表。

### §2.5 保留（上游数据，白名单）

- `scripts/lib/emit/source.mjs` 行 73-74 VENDOR_FALLBACK：mattpocock `category: "engineering"` + `keywords: ["engineering", "skills", "tdd", ...]` —— 上游自选元数据，**不改**。
- `scripts/lib/publish-vendor.test.mjs` 行 124 fixture `"Matt Pocock's agent skills for real engineering"` —— 上游描述，**不改**（与 vendored 数据一致）。
- 派生产物（`marketplace/source.json`、`.claude-plugin/marketplace.json` 等）中的 vendored 描述与 category 随 emit 保留 —— 由 §7 重生成，**不手工编辑**。

## §3 功能代码

### §3.1 运行时 pending 路径 `oscaner-engineering` → `osuperpowers`

**问题**：gate 与 CDD 引擎共享的 pending 根仍为 `${TMPDIR:-/tmp}/oscaner-engineering/pending-cdd`：

- `packages/osuperpowers/bin/gate/cdd-gate-core.mjs:26` `DEFAULT_PENDING_ROOT`
- `packages/osuperpowers/bin/engine/cdd-session-activate.mjs:14,17`
- `packages/osuperpowers/bin/gate/tests/cdd-gate-core.test.mjs:3,185,192`（断言 `/tmp/oscaner-engineering/`）
- `packages/osuperpowers/bin/engine/tests/session-activate.test.mjs:125`
- `packages/osuperpowers/bin/gate/cdd-gate-core.mjs:231` 注释 `os_root 为 engineering 插件根` → `osuperpowers`（同一文件内普适 sweep）

**改动**：常量/注释/fixture 全改为 `osuperpowers/pending-cdd`。**硬切，无旧路径兼容回读** —— 理由：pending 缺失时 gate **fail-open = 放行**（git 只读白名单 + workspace 校验不作用于无 pending 状态），与 24h TTL 过期后的行为完全相同，因此升级窗口内丢 pending 是安全方向；`CDD_PENDING_ROOT` env 覆写能力保留（运营可钉路径）。

> 注：p7d 各节验证 grep 可能命中其他节所有权的残留（如 §3.1 grep 会命中 `vibe/hooks.toml:4` —— 归 §3.4）；分节实现以本文件各节改动清单为准，最终以 §8 验收为准。

### 验证

```bash
grep -rn 'oscaner-engineering' packages scripts --exclude-dir=node_modules   # 预期：无输出
```

### §3.2 harness channel key `"os-init"` → `"init"`

**问题**：`bin/utils/skills-probe.config.mjs:14` 通道分类键 `"os-init": [...]`，消费方（`harness-detect.mjs` 3 处注释、`skills-probe.mjs` 1 处）与 3 组测试沿用旧键名。

**改动**：config 键 `"os-init"` → `"init"`（行 14）；行 6/8/11 注释 → `init`；行 67/73/79/85 安装提示 `os-init harness <name>` → `osuperpowers:init harness <name>`（与 §3.4 CLI 消息同一规则）；consumer 注释/文案同步；测试 fixture（`skills-probe.test.mjs` 12 处、`harness-detect.test.mjs` 4 处、`skills-gate.test.mjs` 18 处 `osInitChannel` 等）跟随。通道**语义**不变（channel = init 通道的 4 harness：opencode/trae/vibe/kiro）。

### §3.3 目录与安装产物路径

**问题**：`bin/os-init/` 目录名、`~/.engineering/state/` manifest 路径（install-harness 实现真实路径，与文档 `bin/os-init/state/` 不符 —— 以实现为准）。

**改动**：

- `git mv packages/osuperpowers/bin/os-init packages/osuperpowers/bin/init`
- `install-harness.mjs:165` `path.join(HOME, ".engineering", "state", ...)` → `.osuperpowers/state`；测试行 82/97/122 同步
- `scripts/ci-validate.mjs`：`os-init` 全部 7 行（行 175 注释 `12 emitters + os-init`、行 181/187/192 断言消息 `expected ${EXPECTED} osuperpowers skills (12 emitters + os-init)`、行 204 注释、行 207 步骤名 `5b. node:test engine + gate + os-init + utils + behavior`、行 212 glob `bin/os-init/tests/*.test.mjs`）→ `init`；函数 `checkEngineeringSkillsCount`（行 171/196）→ `checkOsuperpowersSkillsCount`、`checkEngineeringGateHooks`（行 219/236）→ `checkOsuperpowersGateHooks`；`packages/osuperpowers/tests/ci-validate.test.mjs`（3 行：96/97/101）同步
- `install-harness.mjs` 头部注释（行 2 `bin/os-init/install-harness.mjs`、行 10 manifest 路径）同步

### 验证

```bash
ls packages/osuperpowers/bin/init/install-harness.mjs          # 存在
grep -rn 'bin/os-init\|\.engineering' packages scripts docs/gate-install.md --exclude-dir=node_modules   # 预期：无输出（历史文档除外）
```

### §3.4 os-init 安装面清理

**问题**（`install-harness.mjs` + `bin/gate/configs/`）：`ENGINEERING_VERSION` 常量 + `engineeringVersion` manifest 字段 + `source:"os-init"` 标记 + `PI_TS_MARKER` + 安装产物名 `engineering.json`/`engineering.ts` + channel 键 + CLI 输出文案全为旧命名。

**改动**：

- 行 162 `ENGINEERING_VERSION` → `OSUPERPOWERS_VERSION`；行 11/170/174 `engineeringVersion` → `osuperpowersVersion`
- 行 12/13/185/190/220 `source: "os-init"` → `source: "init"`（manifest 删除门 `source !== "init"` 同步；旧安装的 `source:"os-init"` 文件将视为用户文件保留 —— 语义安全，见 §3.4 注）
- 行 34 `PI_TS_MARKER = "os-init harness — Pi TS extension"` → `"osuperpowers harness — Pi TS extension"`
- 行 61/70/96/97：grok template `configs/grok/engineering.json` + dest `~/.grok/hooks/engineering.json` + trust 文案 → `osuperpowers.json`；kiro dest → `osuperpowers.json`
- 行 81/34：pi dest `~/.pi/agent/extensions/engineering.ts` → `osuperpowers.ts`（模板 `configs/pi/pi.ts` 内容 marker 同步）
- 行 85/91/96/100 channel `"os-init"` → `"init"`；行 7/54 `os-init 通道` 注释同步（行 56/93 无 token）；行 282 `source:"os-init"` 注释跟随 source 标记改名
- 行 261/273/277/325 CLI 错误消息 `os-init harness:` → `osuperpowers:init harness:`
- `bin/gate/configs/pi/README.md`（3 处 engineering gate/extension 路径）→ 同步为 `osuperpowers`
- `bin/gate/tests/configs-parse.test.mjs:18` fixture `["grok", "engineering.json"]` → `["grok", "osuperpowers.json"]`
- `bin/gate/configs/vibe/hooks.toml`：`name = "oscaner-engineering-cdd-gate"` → `"osuperpowers-cdd-gate"`，注释 `os-init gates` → `init gates`
- **模板文件名**（content grep 不可见，必须显式 rename）：`git mv bin/gate/configs/grok/engineering.json bin/gate/configs/grok/osuperpowers.json`（同步 §3.4 行 61 的 template 引用 + 行 70 dest）
- `bin/gate/configs/pi/pi.ts:1` 头部注释 `// os-init gates — Pi TS extension（manual extension copy）。` → `// init gates — Pi TS extension（manual extension copy）。`（与 `PI_TS_MARKER` 是**两个不同字符串**，分别处理）

**注（安装面兼容）**：安装产物名/路径变化只影响重装后的新机器；已装用户的旧文件（`~/.grok/hooks/engineering.json` 等）不受影响（config 由 `init harness` 重写时以新名写入；旧文件若不再被 manifest 追踪且 hash 未变会被清理 —— 与既有 `install-harness` 删除语义一致）。

### 验证

```bash
grep -rn 'engineering\|oscaner-engineering' packages/osuperpowers/bin/gate packages/osuperpowers/bin/init --exclude-dir=node_modules   # 预期：仅白名单（若有）
```

### §3.5 CDD 引擎注释

**问题**：`bin/engine/lib/templates.mjs:34` `engineering plugin root not found`、`bin/engine/lib/runner.mjs:406,424` `os-init channel`、`runner.mjs:445` `engineering plugin root`、`bin/engine/cdd-run.mjs:2` `engineering single CLI runner`。

**改动**：`engineering` → `osuperpowers`、`os-init` → `init`（文案/注释）。

## §4 测试面

**问题**：各测试 fixture 沿用旧命名；`install-gates.test.mjs` 名字/夹具过期（install-gates.mjs 已删，文件是对 install-harness 的 gates 兼容测试，活测试但命名与夹具全旧）；`rule-reference.test.mjs` fixture 用 `os-aaa`/`os-bbb` 模型名 + `engineering` 文案。

**改动**：

- `packages/osuperpowers/bin/init/tests/install-gates.test.mjs` → **改名** `install-harness-gates.test.mjs`（`git mv`），内部 37 处 fixture（NATIVE_DEST 的 `engineering.json` 等产物名、`~/.engineering`、`PI_TS_MARKER`、channel `os-init`）全部跟随映射
- `packages/osuperpowers/bin/init/tests/install-harness.test.mjs`（26 处）同步：`engineeringVersion` 断言、`~/.engineering` 路径、测试名（行 78 `bin/os-init/state/` → `~/.osuperpowers/state/`）
- `packages/osuperpowers/tests/rule-reference.test.mjs`：fixture 目录名 `os-aaa`/`os-bbb` → `aaa`/`bbb`（行 238-252，纯模型名，断言断言逻辑不变）；行 4/25/260-261 `engineering` 文案 → `osuperpowers`
- `packages/osuperpowers-router/tests/validate-overrides-build.mjs`（13 处）：`os-init` 标签/注释（行 6/162-191）→ `init`/`osuperpowers:init`；`engineering` 文案（行 125/129/132/136/233/236/238）→ `osuperpowers`
- `packages/osuperpowers-router/tests/cursor-enforce.test.mjs:18` `SKILL_SUFFIX = "../engineering/skills/brainstorming/SKILL.md"` → `"../osuperpowers/skills/brainstorming/SKILL.md"`
- `packages/osuperpowers/bin/utils/tests/`、`bin/engine/tests/skills-gate.test.mjs` fixtures 随 §3.2/§3.3
- `packages/osuperpowers/tests/rule-reference.test.mjs` 另含 tmpdir fixture `rule-ref-os-`（行 236）→ `rule-ref-`（零 `os-` 残留）
- 派生测试副本（`.agents/skills/osuperpowers/*`）不动，emit 重生成（§7）

### 验证

```bash
node --test packages/osuperpowers/bin/init/tests/*.test.mjs packages/osuperpowers/bin/gate/tests/*.test.mjs packages/osuperpowers/bin/utils/tests/*.test.mjs   # 全绿
```

## §5 文档面

### §5.1 活文档

- `packages/osuperpowers/docs/cdd-reference.md:75`：required plugins 列表 `... + engineering + osuperpowers-router` —— **漏改，功能性错误** → `osuperpowers`；`cdd-reference.zh-CN.md` 同行同步
- `docs/gate-install.md:225`：manifest 路径 `bin/init/state/` → `~/.osuperpowers/state/`（对齐实现）+ 字段 `engineeringVersion` → `osuperpowersVersion`
- `packages/osuperpowers-router/docs/cross-harness-overrides.md`（27 处）：`engineering` → `osuperpowers`（路径 `engineering/bin/...`、`engineering/docs/cdd-reference.md`、`"source": "../engineering/skills/brainstorming"`、`{[engineering]}` 占位符、plugins 列表等）；`os-\*` → `osuperpowers:*`（行 20/93/106/142/235）；行 54 `skills/os-<slug>/SKILL.md` → `skills/<slug>/SKILL.md`（P7b 已去前缀，文档 stale）；行 66 pending 路径 → `osuperpowers/pending-cdd`；行 237 `engineering-version` → `osuperpowers-version`
- `CLAUDE.md`（根）：行 11 `os-* orchestration` → `osuperpowers orchestration`；行 13 `read by os-* orchestrators` → `read by osuperpowers orchestrators`
- `README.md`（根）1 处 + `README.zh-CN.md`（根）行 26 `os-* 编排器` → 同步（**双语 companion 都要**）
- `packages/osuperpowers/CLAUDE.md`（8 处 `os-*` 家族词，行 21/27/50/52/53/55/103/184）→ `osuperpowers` 家族描述（`os-*` 编排技能 → `osuperpowers` 编排技能；`osuperpowers:*` 命名空间引用保持）
- `packages/osuperpowers/README.md`、`README.zh-CN.md`（各 2 处 `os-* 编排` 家族描述 + README.md:5 标语 `Engineering skills for Claude Code` → `osuperpowers skills for Claude Code`）、`packages/osuperpowers-router/README.md` + `README.zh-CN.md`（各 1 处）、根 `README.md`（1 处）→ 同步
- `packages/osuperpowers/skills/report-issue/SKILL.md` + `SKILL.zh-CN.md`（各 4 处 dogfood 注释 `os-* skills in use` → `osuperpowers skills in use`）
- `packages/osuperpowers/skills/init/harness.md`（`os-*/cli-* 触发自检` → `osuperpowers:*/cli-* 触发自检`）
- `packages/osuperpowers/docs/subagent-lifecycle.md` + `zh-CN`（`review-pass rules in os-* skills` → `osuperpowers skills`）
- skill bodies：`skills/brainstorming/SKILL.md:16` + `SKILL.zh-CN.md`、`skills/writing-plans/SKILL.md:28` + `SKILL.zh-CN.md:28` —— `{plugin-root}` = engineering root → osuperpowers root；**保留** `skills/engineering/to-tickets/SKILL.md`（行 18，mattpocock 上游 bucket 路径，白名单）
- `bin/gate/configs/pi/README.md` 已在 §3.4；`sync-overrides-versions.mjs:20,21`、`version-packages.mjs:69,89,128,154`、`lib/version-utils.mjs:34` 注释 `engineering` → `osuperpowers`

### §5.2 删除死文档

**问题**：`packages/osuperpowers-router/docs/sdd-h6-reference.md`（153 行）自标

> **SUPERSEDED:** this doc is the transition copy. The live reference is `engineering/docs/cdd-reference.md` ...

活文档已在 `osuperpowers/docs/cdd-reference.md`；副本含 12 处旧引用 + `sdd` 旧文件名，且与 §7 重生成无关。

**改动**：删除该文件（当前 `cross-harness-overrides.md` 无对它的引用，`grep -rn 'sdd-h6-reference' packages` 已为零）。

### 验证

```bash
grep -rn 'sdd-h6-reference' packages --exclude-dir=node_modules   # 预期：无输出
```

## §6 历史文档同步 + 上游白名单

### §6.1 P7 系列同步

以下文件内容同步到最终命名（`os-*` → `osuperpowers:*`、`engineering` → `osuperpowers`、路径/状态/链接整体更新；**文件名不变**）：

- `docs/superpowers/specs/2026-08-18-os-engineering-p7a-design.md`、`2026-08-18-os-engineering-p7b-design.md`、`2026-08-18-os-engineering-p7c-design.md`
- `docs/superpowers/plans/2026-08-18-os-engineering-p7a.md`、`2026-08-18-os-engineering-p7b.md`、`2026-08-18-os-engineering-p7c.md`
- `docs/superpowers/tickets/2026-08-18-os-engineering-p7a-tickets.md`、`2026-08-18-os-engineering-p7b-tickets.md`、`2026-08-18-os-engineering-p7c-tickets.md`
- `docs/superpowers/specs/2026-08-10-os-engineering-overall.md`：§2 表 P7a/P7b 行状态修正（已完成）、P7d 行 `[Pending]` → 本设计 + 计划链接、末尾状态 `⏳ 未启动` → `✅ 实现完成`；变更历史追加 v4.2 条目（跨阶段 Rule 3b）

### §6.2 P1-P6 留史 + 文件名保留

- P1-P6 specs/plans/tickets + `docs/research/`：**不改**（时代史实，当时命名即如此）
- 所有历史文档**文件名保留**（`os-engineering-*` 是系列标识；整体 §2 链接不变）
- 验收对 `docs/superpowers/{specs,plans,tickets}/` 与 `docs/research/` 设**显式例外**

### §6.3 上游白名单（验收车道）

- 上游元数据三项：同 §2.5（`source.mjs` VENDOR_FALLBACK、`publish-vendor.test.mjs` fixture、派生产物 vendored 数据）
- 上游路径引用：`writing-plans/SKILL.md` + zh-CN:18 的 `skills/engineering/to-tickets/SKILL.md`（mattpocock bucket 路径）
- 历史文档例外：P1-P6 见 §6.2

## §7 派生产物重生成

§2/§3 的 SOT 改动后 `pnpm run emit` 全量重生成：`marketplace/source.json`、`.claude-plugin/marketplace.json`、`.cursor-plugin/marketplace.json`、`cursor-plugins/*` wrapper manifests、各 per-plugin manifests（`packages/osuperpowers/.claude-plugin/plugin.json`、`.cursor-plugin/`、`.codex-plugin/`、`.kimi-plugin/`、`.qoder-plugin/`）、`packages/osuperpowers/gemini-extension.json` 与 `.agents/skills/osuperpowers/*` 复制。**不手工编辑任何派生文件**。

```bash
pnpm run emit && pnpm run emit:check   # emit 重生成 + 无漂移确认
```

## §8 验证方案与验收标准

### 验收 grep 重设计（现行盲区）

现行整体 spec 验收逐行 `grep -v 'osuperpowers|oscaner|...'` **不健全**：含 `osuperpowers` 的行内若共存旧词（如原 `package.json` description 的 `os-* orchestrators`、`packages/osuperpowers/CLAUDE.md` 的家族描述）会被整体过滤而误放行。P7d 改为**按文件范围 + 明确白名单**的验收：

```bash
# A. first-party 活文件零残留（剩余行必须全在白名单）
grep -rIniE 'os-|engineering|oscaner-engineering|ENGINEERING_VERSION|engineeringVersion' \
  packages scripts .github CLAUDE.md README.md README.zh-CN.md docs/gate-install.md \
  --exclude-dir=node_modules 2>/dev/null \
  | grep -v 'skills/engineering/to-tickets' \
  | grep -v '^scripts/lib/emit/source\.mjs:' \
  | grep -v 'publish-vendor.test.mjs' \
  || echo "(A clean or allowlisted-only)"
# 预期：无剩余行（或仅上述白名单）

# A2. 文件名 token 扫描（content grep 盲区 —— 模板/config 文件名里的旧名）
find packages scripts cursor-plugins -type f \( -iname '*engineering*' -o -iname '*os-init*' \) \
  -not -path '*/node_modules/*' -not -path '*/.agents/*' 2>/dev/null || echo "(A2 clean)"
# 预期：无输出（.agents 派生复制另由 §7 emit 覆盖；vendors/ 上游文件名不在扫描范围）
```

> **模式健壮性**：`os-` 家族用裸 `os-` + **`-i` 大小写不敏感**（覆盖 `os-<skill>` / `os-*` / `os-<slug>` 与 `Engineering`/`emitOsEngineering`/`checkEngineering*` 标识符、标语），且裸 `os-` 永不会误匹配 `osuperpowers` / `oscaner`（无连字符）。禁用逐行 `-v osuperpowers`（漏同行共存）。白名单过滤：`source.mjs` 整文件锚定（其唯一旧 token 就是保留的 VENDOR_FALLBACK 行，`VENDOR_FALLBACK` 字面量在行 67-68 头而非 73-74，不能用内容过滤）。

> 说明：A 的搜索范围 = first-party 活文件（`packages/` + `scripts/` + `.github/` + 根文档 + `docs/gate-install.md`）；`VENDOR_FALLBACK`/`publish-vendor.test.mjs` 为上游数据；`skills/engineering/to-tickets` 为上游路径引用。P1-P6 历史文档不在范围内（§6.2 例外），P7 系列由 D 单独抽查。

```bash
# B. 派生无漂移
pnpm run emit:check

# C. 全量
pnpm run validate

# D. P7 p7a/b/c 文档零旧名（P7d 设计文档自身 = 映射表，豁免；overall 用 D2 标记检查）
grep -rInE 'os-|engineering|oscaner-engineering|ENGINEERING_VERSION|engineeringVersion' \
  docs/superpowers/specs/2026-08-18-os-engineering-p7a-design.md \
  docs/superpowers/specs/2026-08-18-os-engineering-p7b-design.md \
  docs/superpowers/specs/2026-08-18-os-engineering-p7c-design.md \
  docs/superpowers/plans/2026-08-18-os-engineering-p7a.md \
  docs/superpowers/plans/2026-08-18-os-engineering-p7b.md \
  docs/superpowers/plans/2026-08-18-os-engineering-p7c.md \
  docs/superpowers/tickets/2026-08-18-os-engineering-p7a-tickets.md \
  docs/superpowers/tickets/2026-08-18-os-engineering-p7b-tickets.md \
  docs/superpowers/tickets/2026-08-18-os-engineering-p7c-tickets.md 2>/dev/null \
  || echo "(D clean)"

# D2. overall spec 标记检查（非 token-zero —— v4.1 changelog + §2 P7d 行按设计保留旧名描述映射）
grep -nE 'P7d.*✅|2026-08-19-os-engineering-p7d' \
  docs/superpowers/specs/2026-08-10-os-engineering-overall.md 2>/dev/null || echo "(D2 missing)"
# 预期：D2 输出 P7d 行完成态 + 设计/计划链接（§6.1 写入）

# E. 版本脚本可执行（无引用异常）
node scripts/version-packages.mjs --dry-run 2>&1 | tail -3 || true

# F. 安装器测试 + 引擎测试（改名后全绿，覆盖 §3/§4）
node --test packages/osuperpowers/bin/init/tests/*.test.mjs packages/osuperpowers/bin/engine/tests/*.test.mjs packages/osuperpowers/bin/gate/tests/*.test.mjs packages/osuperpowers/bin/utils/tests/*.test.mjs
```

**验收标准**：

- ✅ A 中 first-party 活文件无旧命名残留（白名单除外），`-i` 大小写不敏感覆盖标识符/标语；A2 文件名扫描（含 `cursor-plugins/`）无旧名文件
- ✅ B `emit:check` 无 drift；C `validate` 全绿
- ✅ D p7a/b/c 三套文档零旧名；D2 overall §2 P7d 行 ✅ + 设计/计划链接（v4.1 changelog 按设计保留映射描述）
- ✅ `~/.osuperpowers/state/`、`osuperpowers/pending-cdd`、`osuperpowers.json/ts` 安装产物名生效（install-harness 测试断言）
- ✅ `bin/os-init/` → `bin/init/` 移动完成，`sdd-h6-reference.md` 已删
- ✅ 上游白名单车道生效（vendored 数据/路径保留，不改派生）
- ✅ 禁止违规：所有派生文件未手工编辑（仅 emit 重生成）；vendors/ 子模块未改动