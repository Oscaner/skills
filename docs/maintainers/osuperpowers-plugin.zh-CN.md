# osuperpowers 插件 — 维护者指南

> **读者定位**：本文面向本 monorepo（Oscaner/skills）的开发者，描述插件开发、emit 链、hooks、releasing 等维护流程。**消费者环境不适用**——安装插件的用户无需阅读本文。

## Marketplace --> plugin --> skill chain

**Package-as-source：** 规范注册表 [marketplace/source.json](../../marketplace/source.json) 是**派生**产物，不得手编。`pnpm run emit`（[scripts/emit.mjs](../../scripts/emit.mjs)）从 first-party 的 `package.json#oscaner-plugin` 字段（`packages/`）加上 vendored 装配模板（[scripts/lib/publish-vendor.mjs](../../scripts/lib/publish-vendor.mjs)）重建它，然后重新生成每个 harness 专属的 manifest：

1. `packages/<plugin>/package.json` --> `oscaner-plugin` 字段 —— first-party 唯一真源（name/version/contentRoot/harnesses/hooks）。
2. `vendors/<name>/` + 装配模板 —— vendored 插件描述符（上游 submodule；版本取自 vendored 文件）。
3. [marketplace/source.json](../../marketplace/source.json) —— **派生** emit 产物（由 `pnpm run emit` 重新生成；不得手编）。
4. [.claude-plugin/marketplace.json](../../.claude-plugin/marketplace.json) —— 生成的 Claude Code marketplace。
5. [.cursor-plugin/marketplace.json](../../.cursor-plugin/marketplace.json) + [cursor-plugins/](../../cursor-plugins/) —— Cursor Team Marketplace：`osuperpowers-router` 与 `superpowers` 为 **plugin-root**（manifest 在插件根）；vendored upstream（mattpocock-skills、impeccable）在 `cursor-plugins/` 下以 **wrapper** 形式 emit。
6. `packages/<plugin>/.claude-plugin/plugin.json` —— 生成的 per-plugin Claude manifest，例如 [packages/osuperpowers-router/.claude-plugin/plugin.json](../../packages/osuperpowers-router/.claude-plugin/plugin.json)。按相对目录路径注册 skills。
7. `packages/<plugin>/skills/<skill-name>/SKILL.md` —— skill 本身。

若一个 skill 的 SKILL.md 在磁盘上存在却不在插件声明的 `skills/` 树内，Claude Code 无法发现它。这是最常见的故障。

## The overrides pattern (router --> osuperpowers)

[osuperpowers-router](../../packages/osuperpowers-router/) 插件是 **trigger router** —— 不随包发布任何 skill 正文。override skill 位于 [osuperpowers](../../packages/osuperpowers/skills/)。每个 `osuperpowers` orchestrator skill 遵循固定形态：

- Frontmatter 的 `description` 写明它读取的上游（「Read 上游 superpowers:<target> 作为基线」）以及新增的个人规则。上游入口点映射到 router manifest（`overrides.manifest.json`）中的 target —— 这是 emit 生成器派生 hooks 的单一真源。
- 正文以 `## Rules` 开头，语义化 `### Rule: <Name>` 标题（无编号；`#rule-<kebab>` 锚点）。每条规则取三种形态之一：(a) **replaces** 上游行为（self-review --> fresh-subagent 通过）；(b) **delegates** 到 `mattpocock-skills:*` skill（grilling、tdd、to-tickets）；(c) **partial-delegate** —— 原样包裹上游 skill 的 Step 0-K，本地覆盖 Step K+1（writing-plans 的 Rule: Tickets Publish Redirect 是典范：Step 1-4 逐字委派 `/to-tickets`，Step 5「publish」重定向到单个本地 `docs/superpowers/tickets/<date>-<feature>-tickets.md`，保留上游单文件形态）。partial-delegate 规则须在一开始声明哪些 step 被委派、哪些被覆盖 —— 这一拆分防止 Step K+1 静默回退到上游默认值。
- 当一条规则有多个内部执行机制时（例如「定位 delegate」「重定向 publish target」「构造用户确认 quiz」），把它拆为同一伞形标题下的子规则 `Rule Na` / `Rule Nb` / `Rule Nc`。当机制共享触发上下文但攻击不同失败模式时，子规则比同级 top-level 规则更轻。
- 正文以 `## Red Flags` 收尾（应当让你停下来的念头）。这是承重结构 —— orchestrator 设计用来捕捉漂移，删除此节等于废掉设计本意。
- 新规则一律放进 `osuperpowers` skill 内部作为 `### Rule: <Name>`，绝不要放进用户全局 `~/.claude/CLAUDE.md`。

路由强制由**两种机制**协同：

1. **Manifest 派生的 hook matchers** —— 每个上游入口点在 `overrides.manifest.json`（单一 SOT）中枚举；emit 生成器从中派生 hook matchers。Claude Code 上：`hooks/hooks.json` 的 `UserPromptExpansion` matchers 拦截 slash 命令并注入 `additionalContext`。Cursor 上：`hooks-cursor.json` 的 `beforeSubmitPrompt` 检测 SKILL attach / bare slash → 写 pending；`preToolUse` 守卫首工具调用。
2. **Plugin-bundled hooks** 随 `packages/osuperpowers-router/hooks/` 发布，仅当插件安装时激活。harness → 路径映射声明于 `package.json#oscaner-plugin.hooks`（SOT）。

> **注意**：原先由已删除的 `init router` 写入的项目级 CLAUDE.md / `.cursor/rules/` self-check 表不再使用。所有路由强制均为 hook 驱动，无需项目初始化步骤。

### Hooks matrix

Hooks 随每个插件发布，仅当插件经 Claude Code / Cursor marketplace 安装时激活。harness --> 路径映射声明于 `package.json#oscaner-plugin.hooks`（SOT）；`pnpm run emit` 将每个 hooks 文件写到声明路径，并从生成的 per-harness manifest 引用它。

| Plugin | Harness | Hooks file | Handlers |
|--------|---------|------------|----------|
| osuperpowers-router | Claude Code | `packages/osuperpowers-router/hooks/hooks.json` | `UserPromptExpansion`（2 个 matcher：`^superpowers:`、bare `/<slug>` 合并正则）--> `bin/prompt-expansion.mjs` |
| osuperpowers-router | Cursor | `packages/osuperpowers-router/hooks/hooks-cursor.json` | `beforeSubmitPrompt` --> `bin/cursor-detect.mjs`；`preToolUse` --> `bin/cursor-enforce.mjs` |
| osuperpowers | Claude Code | `packages/osuperpowers/hooks/hooks.json` | `PreToolUse`（`Write`/`Edit`、`Bash`）--> `bin/gate/adapters/claude.mjs` |
| osuperpowers | Cursor | `packages/osuperpowers/hooks/hooks-cursor.json` | `preToolUse` --> `bin/gate/adapters/cursor.mjs` |

细节（pending-state 契约、fail-open、shell allowlist）--> [cross-harness-overrides.md](../../packages/osuperpowers-router/docs/cross-harness-overrides.md)。

## Cross-cutting docs

`packages/osuperpowers/docs/` 下原有两份 cross-cutting 参考文档，P3 已迁移/解散：

- `docs-review.md`（D1/D2/D3 + Review Stopping + Handoff Output）→ `skills/brainstorming/docs/docs-review.md`
- `subagent-lifecycle.md`（fresh/concurrent dispatch）→ **已解散**（CLI 模式下 Fresh/Concurrent 规则消亡；Delegate Load Failure 内联到各消费者 skill）

仅被 spec-review（brainstorming）和 plan-review（writing-plans）引用。task-review 与 branch-review 使用各自机制。

## `docs/superpowers/` conventions

skill 流 `brainstorming --> writing-plans --> subagent-driven-development` 在三个同级目录下产出文档：

- [docs/superpowers/specs/](../../docs/superpowers/specs/) —— `YYYY-MM-DD-<feature>-design.md`，brainstorming skill 的输出（spec 文档，经 `brainstorming` Rule 1 审阅）。
- [docs/superpowers/plans/](../../docs/superpowers/plans/) —— `YYYY-MM-DD-<feature>.md`，writing-plans skill 的输出（实现计划，经 `writing-plans` Rule 2 审阅）。
- `docs/superpowers/tickets/` —— `YYYY-MM-DD-<feature>-tickets.md`，当 writing-plans Rule 3c quiz 选中「publish to local file」时 `/to-tickets` 发布步骤的输出（首次使用时创建目录）。

三者共享相同 date + feature slug，使 spec、plan、tickets 排序相邻。`writing-plans` Rule 3b 硬编码 tickets 路径；不要发布到别处，也不要把这些文档写到 repo 根。

## Common operations

这里没有 `pnpm test` —— 内容是纯 Markdown + JSON，由 Claude Code 在运行时发现。真正的日常操作是：

**将 vendored 的 `mattpocock-skills` submodule 升级到最新 release tag：**
```bash
git -C vendors/mattpocock-skills fetch --tags origin
git -C vendors/mattpocock-skills checkout v1.1.0   # 最新 v* tag
git add vendors/mattpocock-skills
git commit -m "chore: bump mattpocock-skills submodule"
```

**自动化 submodule 同步（全部三个 submodule）：** GitHub Actions --> Submodule Sync --> Run workflow，或等待每周 cron（周一 09:00 Asia/Shanghai）。矩阵调用方 [`.github/workflows/submodule-sync.yml`](../../.github/workflows/submodule-sync.yml) 通过可复用 [`.github/workflows/bump-submodule-reusable.yml`](../../.github/workflows/bump-submodule-reusable.yml) 逐 submodule 执行（`create-pull-request` + Issue Action 链；无 bash 胶水）。

**一次性 label 引导**（首次同步前必需）：

```bash
gh label create submodule-bump --color EDEDED --description "Automated submodule sync tracking"
gh label create submodule:mattpocock-skills --color EDEDED
gh label create submodule:superpowers --color EDEDED
gh label create submodule:impeccable --color EDEDED
```

如果从 v1 tracking Issue 迁移，把 `submodule-bump` + `submodule:<name>` 加到已有的 open Issue 以避免重复。

**注意：** 由默认 `GITHUB_TOKEN` 打开的 PR 不会在 `pull_request` 上触发 `ci.yml`；手动重跑 CI 或 close/reopen PR。

使用 `chore:`（而非 `feat:`）—— 这次变更只是指针更新，不是功能。

**全新 clone 引导（在 Claude Code 能解析 `mattpocock-skills:*` delegate 之前）：**
```bash
git submodule update --init
```

**向 `osuperpowers` 新增一个 override skill** —— 三件事必须在一次 commit 中一起改，否则 skill 不可见或不会自动触发：

1. 用 osuperpowers orchestrator 形态创建 `packages/osuperpowers/skills/<name>/SKILL.md`（见 [The overrides pattern](#the-overrides-pattern-router-osuperpowers)）。
2. 向 [packages/osuperpowers-router/overrides.manifest.json](../../packages/osuperpowers-router/overrides.manifest.json) 添加 target 行，将上游 trigger 映射到 `osuperpowers:<name>`（source `../osuperpowers/skills/<name>`），然后运行 `pnpm run emit`（通过统一的 `scripts/emit.mjs` 重新生成 `packages/osuperpowers-router/bin/prompt-expansion.mjs`、cursor hooks、以及 `packages/osuperpowers-router/build/generated/*`）。**不要**手编 hook 脚本。
3. 在 [README.md](../../README.md) 的 router target 表中加一行以提升可发现性。

缺 skill 目录或 manifest 行 --> skill 对 Claude Code 不可见或不会自动触发。跳过 `pnpm run emit` --> hook 漂移。

**新增 first-party 插件** —— marketplace 是 **package-as-source**，因此接线是自动的：

1. 用 `oscaner-plugin` 字段（`contentRoot`、`harnesses`、可选 `hooks`）创建 `packages/<name>/package.json`。`deriveFirstPartyNames`（[scripts/lib/emit/manifests.mjs](../../scripts/lib/emit/manifests.mjs)）通过扫描 `packages/*` 中的该字段来发现它 —— 无需手工注册。
2. `pnpm run emit` 从中派生 `marketplace/source.json` 并重新生成 marketplace 文档；`pnpm-workspace.yaml`（`packages/*`）已将其纳入。
3. 添加命名该插件的 changeset --> 由 [scripts/version-packages.mjs](../../scripts/version-packages.mjs) 以 `@oscaner-skills/<name>` 发布。

Per-harness hooks：在 `oscaner-plugin.hooks` 下映射 harness --> 路径；emit 写出 hooks 文件。`oscaner-plugin.harnesses` 是**纯声明 / 信息性** —— 没有脚本消费它（各 `packages/*/package.json` 中的 `harnessesNote` 记录了这一点），且 emit 硬编码了 per-plugin manifest 集合。要新增真正全新的 harness manifest 需要在 `scripts/emit.mjs` 中增加 emitter（见下方 caveat）。Caveat：当前 `scripts/emit.mjs` 中的 per-plugin harness emit 是专为 `osuperpowers` 与 `osuperpowers-router` 硬编码的 —— 新插件类型需要在那里加 emitter（或提交能满足 cursor 路径断言的已生成 manifest）。Vendoring 一个上游插件是相反路径（`vendors/<name>` submodule + `scripts/lib/publish-vendor.mjs` 中的 `listVendors`/`ASSEMBLY_TEMPLATE` + `scripts/lib/emit/source.mjs` 中的 `VENDOR_PLUGINS`）。

## Verifying a change didn't break the marketplace

因为没有测试套件，「manifest 链是否仍然解析」就是测试。任何结构性编辑（skills、plugin.json、marketplace source、emit 输出）之后都要运行 `pnpm run validate`。

**1. `plugin.json` 能解析 且 每个 entry 映射到已存在的目录**（overrides 是 trigger router —— 无 skill 正文；osuperpowers 使用目录形式的 `skills`）：
```bash
cd /path/to/skills
python3 -c '
import json, os

def check(root, label):
    d = json.load(open(os.path.join(root, ".claude-plugin/plugin.json")))
    skills = d.get("skills")
    if skills is None:
        # trigger router -- 无 skill 正文；skills/ 必须为空或不存在
        sd = os.path.join(root, "skills")
        n = 0
        if os.path.isdir(sd):
            n = sum(1 for x in os.listdir(sd) if os.path.isdir(os.path.join(sd, x)))
        assert n == 0, f"{label}: expected 0 skills (trigger router), got {n}"
        print(f"OK -- {label}: trigger router (no skill bodies)")
    elif isinstance(skills, str):
        sd = os.path.join(root, skills.lstrip("./"))
        assert os.path.isdir(sd), f"{label}: skills dir missing: {sd}"
        n = sum(1 for x in os.listdir(sd) if os.path.isdir(os.path.join(sd, x)))
        print(f"OK -- {label}: {n} skills (directory {skills!r})")
    else:
        missing = [s for s in skills if not os.path.isdir(os.path.join(root, s.lstrip("./")))]
        assert not missing, f"{label} skills[] -> missing dirs: {missing}"
        print(f"OK -- {label}: {len(skills)} skills, all resolve")

check("packages/osuperpowers-router", "osuperpowers-router")
check("packages/osuperpowers", "osuperpowers")
'
```

**2. 每个 skill 目录都有 `SKILL.md`**（osuperpowers —— first-party skills 插件）：
```bash
for d in packages/osuperpowers/skills/*/; do
  [ -f "$d/SKILL.md" ] || { echo "MISSING: $d/SKILL.md"; exit 1; }
done && echo "OK -- all osuperpowers skill dirs have SKILL.md"
```

**3. 磁盘上的 skill 没有遗漏在 `plugin.json` 之外**（反向故障 —— 仅适用于显式 list 形式的 manifest；目录形式的 manifest 本身就是声明，因此没有 orphan 概念）。当前插件都不使用 list 形式 —— `pnpm run validate` step 0/1 通过 `scripts/emit.mjs --check` 覆盖这一点：
```bash
pnpm run emit:check
```

三者都通过 --> marketplace 仍然可解析。

**4. Hooks 与 bin 脚本存在且可执行**（在新增或重命名 hook handler 之后运行 —— 见 [hooks matrix](#hooks-matrix)）：
```bash
[ -f packages/osuperpowers-router/hooks/hooks.json ] && echo "OK -- overrides claude hooks"
[ -f packages/osuperpowers-router/hooks/hooks-cursor.json ] && echo "OK -- overrides cursor hooks"
[ -x packages/osuperpowers-router/bin/prompt-expansion.mjs ] && echo "OK -- prompt-expansion executable"
[ -f packages/osuperpowers/hooks/hooks.json ] && echo "OK -- osuperpowers claude hooks"
[ -f packages/osuperpowers/hooks/hooks-cursor.json ] && echo "OK -- osuperpowers cursor hooks"
[ -x packages/osuperpowers/bin/gate/adapters/claude.mjs ] && echo "OK -- claude cdd-gate executable"
[ -x packages/osuperpowers/bin/gate/adapters/cursor.mjs ] && echo "OK -- cursor cdd-gate executable"
```

**5. 统一 emit 校验：**
```bash
pnpm run emit:check        # scripts/emit.mjs --check -- drift --> exit 1
node packages/osuperpowers-router/tests/validate-overrides-build.mjs
```

**注意：** 全新 clone 时，运行 `git submodule update --init` 再执行 `emit --check` —— `emit`/validate 需要解析 `superpowers` submodule 以做版本同步（`marketplace-utils.mjs` / `validate-version-sync.mjs`）。emit 器**不**把上游 skills 复制到 `.agents/skills/`（仅 osuperpowers skills；osuperpowers 的 Rule: Read Upstream 在可用时读取 `superpowers` 插件，绝不读取 vendored）。

**6-9. 完整本地 CI（推荐）：**
```bash
pnpm run validate
```

这运行上面的 step 1-5 加上生成器 drift 检查、overrides 版本三重校验、prerelease 前缀 lint、mattpocock-skills submodule 解析，以及 superpowers 版本同步。实现于 [scripts/ci-validate.mjs](../../scripts/ci-validate.mjs)；PR 上由 [.github/workflows/ci.yml](../../.github/workflows/ci.yml) 镜像。

## CDD CLI pre-check (skills-missing gate)

CDD 引擎（`cdd-task.mjs` --> `runner.mjs`）在 spawn 嵌套 CLI agent 之前，于全部三种模式（implement/task-review/fix）运行 **skills-missing 预检**。这与 exit code 层级区分：

| Exit | 含义 | 触发 |
|------|------|------|
| 0 | OK | task 成功完成 |
| 1 | BLOCKED | task 前置错误（brief/templates 缺失、plan 未找到、harness 不受支持） |
| 2 | CLI 缺失 | 选中的 harness CLI 不在 PATH 中 |
| 3 | **skills-missing** | install-and-use 通道缺少必需的 skills 插件（CLI 存在但插件未安装） |

**通道分类**（12 个 harness，配置驱动，见 `packages/osuperpowers/bin/utils/skills-probe.config.mjs`）：

- **install-and-use**（8）：claude / cursor-agent / droid / grok / qoder / codex / gemini / pi --> 缺失 --> **exit 3** + 逐插件 stderr 安装提示
- **init**（4）：opencode / trae / vibe / kiro --> 缺失 --> stderr 提示 `init harness <name>`（非 exit 3），task 照常运行

**必需插件**（封闭集合，配置驱动）：`superpowers` + `mattpocock-skills` + `osuperpowers` + `osuperpowers-router`。探测按 harness 而异：`plugin-list`（claude/grok）、`skill-dir`（cursor-agent/droid/qoder/codex/gemini）、`package-list`（pi）。探测失败（CLI 错误 / 无权限）--> **fail-open 放行**（exit 0 + warn）。

完整 gate 细节见 [cdd-reference.md](../../packages/osuperpowers/skills/cli-driven-development/docs/cdd-reference.md) H6，实现见 `packages/osuperpowers/bin/utils/skills-probe.mjs` / `packages/osuperpowers/bin/utils/skills-probe.config.mjs`。

## Releasing

本仓库版本化两个插件：**`osuperpowers-router`**（superpowers-相对方案）与 **`osuperpowers`**（独立 semver）。集成分支是 **`develop`**；**`main`** 仅通过来自 `develop` 的 PR 接收发布。

**日常：** 针对 `develop` 开 PR。CI 在针对 `develop` 与 `main` 的 PR 上运行 `validate`。

**插件变更：** 运行 `pnpm changeset`，选择有变更的插件（`osuperpowers-router` 和/或 `osuperpowers`），描述变更，将 PR 合并进 `develop`（changesets 在 `develop` 上累积；那里没有发布工作流运行）。

**发布到生产：** 开一个 `develop --> main` 的 PR（必须通过 `validate` 且 **Main PR 必须来自 develop**）。合并进 `main` --> [.github/workflows/release.yml](../../.github/workflows/release.yml) 打开一个针对 **`main`** 的 Version PR。在 `main` 上合并 Version PR --> per-plugin git tag + GitHub Release（`osuperpowers-router@{version}` 和/或 `osuperpowers@{version}`，若该插件没有 changeset 则各自跳过）。当 `main` 领先于 `develop` 时，工作流打开一个自动的 **`main --> develop`** 同步 PR —— 手动合并它来对齐 `develop`。

**Superpowers submodule bump：** 通过 [.github/workflows/submodule-sync.yml](../../.github/workflows/submodule-sync.yml) 自动每周同步（最新 `v*` tag）。手动：在 `vendors/superpowers` 中 checkout 最新 tag（marketplace 版本随后从 vendored 文件派生），将 `packages/osuperpowers-router/package.json` 设为 `{semver}-router.0.0.0`，运行 `node scripts/sync-router-versions.mjs`（同步版本 SOT 并重新 emit —— `marketplace/source.json` 是**派生**的，不得手编）。合并进 `develop`，然后按上述 `develop --> main` 发布。这只重置 **overrides** —— osuperpowers 保持独立 semver。

**版本方案：** `osuperpowers-router` 使用 `{superpowers-semver}-router.{major}.{minor}.{patch}`（三段式后缀）。tag 形如 `osuperpowers-router@6.2.0-router.0.15.0`。Changeset patch 发布仅在同一 superpowers 基线上递增 **patch**。任何 superpowers semver 段变更（包括 patch）都会将 router 重置为 `{new-base}-router.0.0.0` —— 而非遗留的 `-overrides.0` 单计数器形式。`osuperpowers` 使用纯 semver（`0.1.x`）；changeset 递增它时以 `osuperpowers@{version}` 独立发布。两者都由 `node scripts/version-packages.mjs`（双插件）驱动，并由 `node scripts/validate-version-sync.mjs` 校验。见 [.changeset/README.md](../../.changeset/README.md)。

**分支保护：** CI job 就位后，用 [`scripts/gh-branch-rulesets.mjs`](../../scripts/gh-branch-rulesets.mjs) 幂等应用 GitHub Rulesets（`protect-develop`、`protect-main`；无 bypass actor）。

## Git conventions for this repo

- Conventional commits（`feat:`、`fix:`、`docs:`、`chore:`）。
- 提交信息中不得有 attribution / co-author / AI-generation trailer。
- 禁止 `git worktree` —— 用户政策禁止。
- 对 gitignored 文件执行 `git add -f` 需要明确的用户确认。

### When to commit

**默认：** 除非用户明确要求（`commit`、`Tn commit`、`提交`、`push`），否则不提交。

**SDD / ticket 执行：** 当用户批准 plan/tickets 并开始执行，且 plan/ticket 为该 ticket 指定了 commit —— 在 ticket 之后提交，无需再次询问。若 plan 省略了 commits，完成未提交部分并在运行结束时询问一次。

**执行连续性：** 在已批准的 plan 运行期间，不要在每张 ticket 之后停下来问「要继续吗？」—— 见 `.cursor/rules/execution-continuity.mdc`（Cursor），或在 Claude Code 会话中镜像本节。
