---
title: 引擎文档工具（Engine Doc-Tooling）— P19 设计：child dispatch 缓存 TTL = 5m + 引擎 cursor 支持退役
doc-type: phase-spec
version: v0.4
date: 2026-10-23
slug: 2026-10-10-engine-doc-tooling-p19
program: 2026-10-10-engine-doc-tooling
status: Draft
author: "[human] · Claude（kairos:cdd-design [P19] grilling → cdd-spec-writer · 2026-10-23）"
parent-version: v2.77
---

## Design

P19 是两件互不依赖、但同属「派发面契约」的收口：

1. **child 缓存 TTL 由引擎显式钉成 5m**——P18 已把 claude dispatch 的 tools+system 前缀做成跨 dispatch 字节稳定，但 TTL 仍由 child 继承的外部环境决定；本 phase 把「TTL 是多少」从环境继承改为 host 数据契约，claude 与 pi 同口径。
2. **引擎完整退役 cursor host**——引擎不再检测或派发 `cursor-agent`，发行面不再生成 `.cursor-plugin` 产物，消费面不再宣称 cursor 已验证。

一句话命题：**缓存口径是派发契约的一部分，必须由引擎声明而非环境泄漏；host 支持面与其发行/消费声明必须同真同退。**

### 1. 现状与缺口（取证）

#### 1.1 缓存 TTL 未被引擎声明

- P18 落地 `HOSTS.claude.invoke` 的 `--exclude-dynamic-system-prompt-sections`（`packages/cdd-engine/src-next/face/host.ts:149-150`），使 per-session 动态段离开 system prompt，tools+system 前缀跨 dispatch 字节稳定。
- 但 child 的 prompt-cache TTL 没有引擎侧声明：`Terminator.run` 的 execa 调用（`packages/cdd-engine/src-next/face/termination.ts:478-487`）只传 `cwd` / `stdin` / kill / timeout，未传 `env`，child 全量继承 `process.env`；`ChildRun`（同文件 `:69-75`）也没有 env 字段。
- Claude Code 的 TTL 默认随身份而变：订阅的主对话默认 1h，API key / usage credits 默认 5m；用户 settings 还可设 `promptCacheTtl`。**同一套引擎在不同调用方环境里跑出不同缓存口径**，无法作为契约断言。（取证：Claude Code 文档 *Prompt caching*「Which TTL each request gets」— https://code.claude.com/docs/en/prompt-caching ，2026-10-23 核对）
- pi 侧由 `@earendil-works/pi-ai` 的 `resolveCacheRetention` 决定：默认 `short`（=5m），只有 `PI_CACHE_RETENTION=long` 才升 1h；child 若从 shell 继承 `long`，同样偏离 5m 口径。（取证：`@earendil-works/pi-ai@1.3.0` 的 `dist/api/anthropic-messages.js:22-30`——仅 `"long"` 返回 `long`，其余值落回 `short`）

#### 1.2 cursor 支持的错位

- 引擎把 cursor 当一等 host：`HostId`（`face/host.ts:34`）、`HOSTS.cursor`（`:157-171`，`cursor-agent` + `CURSOR_TRACE_ID`）、`REFS` 每个引用键的 cursor 拼写列（`:208-265`）、`HostDetect` 的检测序（`:286`）。
- 发行面声明 cursor：`packages/kairos/package.json#oscaner.harnesses` 含 `cursor`，`scripts/emit.ts` 的 `CursorMappings` 类族据此生成 `packages/kairos/.cursor-plugin/plugin.json` 与 `.cursor-plugin/marketplace.json`，两份产物已入库。
- 消费面宣称 cursor：四份 README 的「verified on Claude Code, Cursor Agent, and Pi」claim、kairos README 的 Cursor 安装段与安装表列、`packages/kairos/tests/presentation-surface.test.ts` 的 pins、两份架构图的 `Claude Code · Cursor · Pi` sublabel。
- **错位在移除 detect 后立即显形**：cursor 下运行 `cdd` 会得到通用 `CDD_BLOCKED: no host harness detected`；此时任何仍宣称「cursor verified / 可安装」的面都是假话。因此退役必须引擎面、发行面、消费面同退。

### 2. 定案：TTL = 5m（Q1–Q4）

#### 2.1 claude：`FORCE_PROMPT_CACHING_5M=1`

- 选 **单一强制变量**：它在 Claude Code 的 TTL 优先级表里最高，压过 settings 的 `promptCacheTtl`、subagent frontmatter 与 `ENABLE_PROMPT_CACHING_1H`，且同时覆盖主对话与 subagent 两个请求桶。（取证：同文档「Choose the TTL yourself」优先级列表第 1 条——`FORCE_PROMPT_CACHING_5M=1` 先于 bucket 环境变量、bucket setting、subagent `cacheTtl` frontmatter、`ENABLE_PROMPT_CACHING_1H`）
- 不选逐桶口径（`CLAUDE_CODE_PROMPT_CACHE_TTL=5m` + `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL=5m`）：语义等价但需两键，且表达的是「建议」而非「强制」，与本期「钉死 5m」的意图不符。
- 作用域仅 child 进程：不写回引擎进程环境，也不影响用户自己的会话。

#### 2.2 pi：`PI_CACHE_RETENTION=short`

- pi 默认即 `short`（5m）；显式 pin 的价值是**防止 shell 的 `PI_CACHE_RETENTION=long` 泄漏进 child**，使 claude / pi 两 host 的 TTL 契约同真。
- 事实注记：pi 1.3.0 的 `resolveCacheRetention` 只把 `long` 识别为长保留，其余值落回 `short`；`short` 是稳定的显式拼写。（取证：`@earendil-works/pi-ai@1.3.0` 的 `dist/api/anthropic-messages.js:22-30`）

#### 2.3 注入口径：`HOSTS.env` → `ChildRun.env` → execa `env`

- `HostRow` 新增 `env: Readonly<Record<string, string>>` 数据列，每一行都声明（当前：claude → `{ FORCE_PROMPT_CACHING_5M: "1" }`，pi → `{ PI_CACHE_RETENTION: "short" }`）。
- `ChildRun` 新增 `env` 字段；`CliLifecycle.#dispatch` 从检测到的 host 行取 `row.env` 传入。
- `Terminator.run` 的 execa 选项加 `env: { ...process.env, ...run.env }`——**引擎值覆盖继承值**；合并只发生在 child 进程及其后代。
- 该形态保持 `Terminator` host 无关、零分支；TTL 属于 host 数据契约，不是派发器的代码分支。
- 连带面：`ChildRun` 的测试工厂（`face/__tests__/termination.test.ts:51-68`）与记录型 `StubRunner`（`face/__tests__/cli.test.ts:5997`）需随字段补齐；spawn 面断言落在 `Terminator` 的 execa 参数上（stub 子进程回显 env 或对合并结果直接 pin）。

### 3. 定案：cursor 完整退役（Q5–Q11）

#### 3.1 引擎面

- `HostId` 收敛为 `"claude" | "pi"`；删除 `HOSTS.cursor` 整行；`REFS` 每个键删除 `cursor` 拼写列（`HostReferenceForm` 随 `HostId` 自动收缩）；`HostDetect.detect` 的检测序改为 `["claude", "pi"]`。
- 同步 live face 注释与文档串（`face/host.ts` / `face/lifecycle.ts:140` 等），并同步测试文件内的 live 注释与 `it` 标题——`host.test.ts:3-5/14`（「cursor/pi the pending marker」）与 `channel-closure.guard.test.ts:13-17`（「the pinned four」「claude/cursor」）在退役后失效。更新引擎测试面：`host.test.ts`（host 行与 flag 断言）、`channel-closure.guard.test.ts`（marker 闭包四→三）、`packages/cdd-engine/src-next/infra/__tests__/infra.test.ts:84`（marker 列表）、`preview.test.ts:142-146`（cursor 检测样例改 claude/pi）、`cli.test.ts:4313-4324`（检测序）。新增一条负向回归：仅设 `CURSOR_TRACE_ID` 的环境不再被识别（detect 返回空 → 通用 BLOCKED）。
- `GUARD_BAN_WORDS.stale` 的 `cursor-agent` 行**保留**：它是历史退役词表，不是 live 支持声明；`face/words.ts` 作为数据 home 继续承载该行。
- 不为 cursor 保留专属报错（Q9）：cursor 环境没有 detect 行，得到通用 `no host harness detected` 即可，避免把已退役的 host 知识留在引擎里。

#### 3.2 发行面

- `packages/kairos/package.json`：`oscaner.harnesses` 去掉 `cursor`；`files` 去掉 `.cursor-plugin/`。
- `packages/kairos/.version-bump.json`：`files[]` 删除 `{ "path": ".cursor-plugin/plugin.json", "field": "version" }` 条目——`VersionSync.run`（`scripts/lib/version-sync.ts:56-57`）对每个条目无条件 `readJson`、无存在性检查，产物删除后该条目会让 `pnpm run version-sync` 抛 ENOENT。
- `scripts/emit.ts`：删除 `CursorMappings` 类族（`cursorManifest` / `cursorMarketplaceDoc` / `isPluginRoot`）、`BASE_PRODUCT_ROOTS` 的两个 `.cursor-plugin` 根（`:48` / `:50`）、`deriveFirstPartyPlugin` 的 cursor 分支、product 生成的两条 cursor 条目；并同步该文件的 live 注释与文档串（`:15` / `:45` / `:63` 等 cursor 表述）。
- `marketplace/source.schema.json`：删除 `cursorWrapper`（`:59`）/ `cursorPluginRoot`（`:69`）/ `cursor`（`:77-80`）三个 `$defs`、`harnessHooks` 的 `cursor` 属性（`:88`）、插件属性的 `cursor` 引用（`:112`）以及 `required` 列表里的 `"cursor"`（`:100`）。
- `marketplace/README.md`：删除产物表的两条 `.cursor-plugin` 行（`:30-31`）、`## Cursor install modes` 整段（`:35-42`）、`## Cursor Team Marketplace` 整段（`:56-58`）；改写 `## Schema` 的 `:46`——删去 `cursor` oneOf 半句，harness 集合表述改为 schema **实际接受的键**（`claude` / `codex` / `qoder`；`pi` 不是 `harnessHooks` 的 schema 键），保留 `source.schema.json` 校验句。
- `scripts/lib/first-party.ts:32`：删除 `PluginSource.cursor?` 字段。
- `scripts/lib/version-sync.ts:3`：删除注释中「(the .cursor-plugin marketplace carries no version row)」半句。
- 删除已生成产物：`.cursor-plugin/marketplace.json`、`packages/kairos/.cursor-plugin/plugin.json`；随后 `pnpm run emit` 重生成 `marketplace/source.json` 等派生面。
- `scripts/__tests__/emit.test.ts` 的 cursor pins 删除或改写为「cursor 不出现」的反向断言（避免留下无消费者的死数据）。

#### 3.3 消费面

- 四份 README 的 claim 统一为「verified on **Claude Code** and **Pi**」/「已在 **Claude Code** 与 **Pi** 上验证」：`README.md:11`、`README.zh-CN.md:15`、`packages/kairos/README.md:5`、`packages/kairos/README.zh-CN.md:7`。
- 根 README：`README.md:50` 的 `# Claude Code / Cursor Agent marketplace` 改为 `# Claude Code marketplace`，`README.zh-CN.md:54` 同改；`README.md:79` / `README.zh-CN.md:83` 的 ASCII 发行行去掉 `.cursor-plugin/`。
- `packages/kairos/README.md` / `.zh-CN.md`：删除 `# Cursor Agent` 安装段（`:64` / `:66`）；斜杠形式句去掉 Cursor Agent（`:57` / `:59`）；安装表删除 Cursor 列（`:89` / `:91`），nominal 表删除 cursor 行（`:76` / `:78`）；plugin-qualified import 句只留 Claude Code（`:83` / `:85`）；删除 Cursor 列后悬空的 `pending` 说明（`:96` / `:98`）。
- `CLAUDE.md`：`:7` 的 verified claim 改为 Claude Code and Pi；`:13` / `:35` 的 emit 产物与 manifest 清单去掉 `.cursor-plugin/`。
- `packages/kairos/tests/helpers.ts:38`：示意 host CLI 列表去掉 `cursor-agent`。
- `packages/kairos/tests/presentation-surface.test.ts`：triple→pair claim pins、nominal 表、cursor residue pin、`HostId` 过滤联合同步。
- 架构图：更新 `docs/diagrams/src/architecture.en.json` 与 `architecture.zh-CN.json` 的两处 sublabel（`.claude-plugin` / `Claude Code · Pi`），再用 Archify 从源 JSON 重新生成两份 HTML（禁止手改生成物；命令见 `docs/diagrams/README.md` 的 finalize 示例）。
- **历史文档不改**（Q11）：`docs/kairos/specs/` 与 `docs/kairos/plans/` 中 P1–P18 的 cursor 记述保持原文。

#### 3.4 版本与打包

- changeset：`@oscaner-skills/cdd-engine` **minor**（4.1.0）、`@oscaner-skills/kairos` **minor**（1.3.0）——用户裁定 Q8。
- 只到可发布态，不执行版本应用 / tag / publish。

#### 3.5 非目标

- 不重排模板、不改写 prompt；不引入 `--output-format json` 用量观测。
- 不改 claude / pi 的派发语义与退出码；不做跨轮 session 复用。
- 不删除 `GUARD_BAN_WORDS` 中既有的 cursor 词条；不改历史 spec / plan。

### Acceptance criteria

- **TTL 契约（claude）**：检测为 claude 时，child 的 spawn 环境含 `FORCE_PROMPT_CACHING_5M=1`；`HOSTS.claude.env` 的数据 pin 与 spawn 面断言同时成立。
- **TTL 契约（pi）**：检测为 pi 时，child 的 spawn 环境含 `PI_CACHE_RETENTION=short`；继承环境中的相反值被引擎值覆盖（覆盖语义有测试 pin）。
- **零分支**：`Terminator` 不按 host 分支；env 合并只有 `{ ...process.env, ...run.env }` 一处。
- **引擎面零 cursor**：`HostId` 联合仅 `claude | pi`；`HOSTS` / `REFS` / detect 序无 cursor；`CURSOR_TRACE_ID` 仅出现在「不再被识别」的负向回归 pin 中；`cursor-agent` 仅存于 `face/words.ts` 的 ban 行。
- **发行面零 cursor**：`.cursor-plugin/marketplace.json` 与 `packages/kairos/.cursor-plugin/plugin.json` 删除；`scripts/emit.ts` 无 cursor 机制；`marketplace/source.schema.json` 无 cursor 定义且 `required` 不含 `cursor`；`scripts/lib/first-party.ts` 无 `cursor` 字段；`packages/kairos/.version-bump.json` 无 `.cursor-plugin` 条目；`oscaner.harnesses` / `files` 正确；`git grep -i cursor -- marketplace scripts` 仅命中 `scripts/__tests__/emit.test.ts` 的反向断言；`pnpm run emit` 后 `emit:check` 绿。
- **消费面一致**：四份 README claim 为 Claude Code + Pi；`git grep -i cursor -- README.md README.zh-CN.md packages/kairos/README.md packages/kairos/README.zh-CN.md CLAUDE.md` 零命中；nominal 表无 cursor 行；`presentation-surface.test.ts` 全绿；两份架构图源 JSON 与生成 HTML 均无 cursor 支持声明。
- **回归**：`pnpm -C packages/cdd-engine test` 全绿；`pnpm run typecheck` ×3 通过；`pnpm run version-sync` 绿（`VersionSync.run` 遍历 `.version-bump.json` 全部条目）；`pnpm run validate` ALL PASS。
- **发布面**：cdd-engine 与 kairos 各一条 minor changeset；仓内不应用版本。

## Constraints

- 零新增运行时依赖；TTL 数据落在 `HOSTS` 行，不引入引擎配置面或新 CLI 旗标。
- 共享 spawn 面（claude / pi 共用 `Terminator`）不得按 host 分支；host 差异只允许存在于数据契约。
- 删除即删除：不为 cursor 保留死代码、专属文案或「将来可能用」的映射机制。
- 历史文档是记录，不回写；living 面（overall 四表）已在 v2.76 / v2.77 同步。
- 消费面文本不携带程序历史（consumer surface purity）；变更叙述只在本 spec / plan。
- 不发布：changeset 到可发布态即止。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-23 | 初稿：收编 P19 grilling Q1–Q11——claude `FORCE_PROMPT_CACHING_5M=1` / pi `PI_CACHE_RETENTION=short`；`HOSTS.env` → `ChildRun` → execa env（引擎值覆盖）；cursor 完整退役（引擎 / 发行 / 消费三面）；changeset 双 minor | Claude（kairos:cdd-spec-writer · 2026-10-23） |
| v0.2 | 2026-10-23 | **spec-fix-1（review-1 findings 收口 · 1 blocker + 4 warn + 3 nit）**：① blocker——§3.2 补 `packages/kairos/.version-bump.json` 的 `.cursor-plugin` 条目删除（`VersionSync.run` 无条件读取 → 产物删除后 ENOENT）与 `version-sync.ts:3` 注释同步，AC 回归点名 `pnpm run version-sync`；② warn——§3.2 补发行面 cursor 余量（`source.schema.json` 三 `$defs` / hooks / required、`marketplace/README.md` 三段、`first-party.ts:32`），AC 增 `git grep -i cursor -- marketplace scripts`（仅 emit 反向 pin 例外）；③ warn——§3.3 逐行枚举 kairos EN/zh README 七处与根 zh mirror 两行，消费面验收改为四份 README + `CLAUDE.md` 的 cursor grep 零命中；④ warn——§3.3 纳入 `CLAUDE.md` 三行（claim / 两份 emit 产物清单）与 `tests/helpers.ts:38` 注释；⑤ warn——§1.1 / §2.1 / §2.2 的 Claude Code TTL 与 pi-ai 事实补取证锚（官方文档 URL · `@earendil-works/pi-ai@1.3.0` `dist/api/anthropic-messages.js:22-27`）；⑥ nit——`termination.test.ts:56` → `:51-68`；⑦ nit——`infra.test.ts:84` 写全路径；⑧ nit——`version-sync.ts:3` / `helpers.ts:38` 注释入 live-comment 清扫 | Claude（kairos:cdd-dev [P19] docs-fix round 1 · 2026-10-23） |
| v0.3 | 2026-10-23 | **spec-fix-2（review-2 findings 收口 · 1 warn + 4 nit）**：① warn——§3.2 `marketplace/README.md` 删除范围由 `:35-46` 收窄为 `:35-42`，`:46` 改为改写（删 cursor oneOf 半句、harness 集收敛 `claude`/`pi`、保留 schema 校验句）；② nit——`VersionSync.run` pin 由 `:58-70` 校正为 `:56-57`；③ nit——`PRODUCT_DIRS` 更名 `BASE_PRODUCT_ROOTS` 并引 `:48` / `:50`；④ nit——§3.1 live-comment 清扫扩到 `host.test.ts:3-5/14` 与 `channel-closure.guard.test.ts:13-17` 的注释与 `it` 标题；⑤ nit——pi-ai 取证锚由 `:22-27` 扩为 `:22-30`（含 `return "short"` 分支） | Claude（kairos:cdd-dev [P19] docs-fix round 2 · 2026-10-23） |
| v0.4 | 2026-10-23 | **设计回填（plan-review-2 携带的 spec 跟进 · orchestrator 独立提交）**：§3.2 `marketplace/README.md` 的 Schema 句不再要求收敛为 `claude` / `pi`——`source.schema.json#/$defs/harnessHooks` 实际接受 `claude` / `codex` / `qoder`，`pi` 不是其 schema 键；改为按 schema 实际键表述，避免写出一条消费者可验证为假的声明。schema 键集对齐不在 P19 范围（既有 `codex` / `qoder` 非 cursor 面） | Claude（kairos:cdd-plan · 设计回填 · 2026-10-23） |
