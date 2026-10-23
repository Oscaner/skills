---
title: 引擎文档工具（Engine Doc-Tooling）— P19 设计：child dispatch 缓存 TTL = 5m + 引擎 cursor 支持退役
doc-type: phase-spec
version: v0.1
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
- Claude Code 的 TTL 默认随身份而变：订阅的主对话默认 1h，API key / usage credits 默认 5m；用户 settings 还可设 `promptCacheTtl`。**同一套引擎在不同调用方环境里跑出不同缓存口径**，无法作为契约断言。
- pi 侧由 `@earendil-works/pi-ai` 的 `resolveCacheRetention` 决定：默认 `short`（=5m），只有 `PI_CACHE_RETENTION=long` 才升 1h；child 若从 shell 继承 `long`，同样偏离 5m 口径。

#### 1.2 cursor 支持的错位

- 引擎把 cursor 当一等 host：`HostId`（`face/host.ts:34`）、`HOSTS.cursor`（`:157-171`，`cursor-agent` + `CURSOR_TRACE_ID`）、`REFS` 每个引用键的 cursor 拼写列（`:208-265`）、`HostDetect` 的检测序（`:286`）。
- 发行面声明 cursor：`packages/kairos/package.json#oscaner.harnesses` 含 `cursor`，`scripts/emit.ts` 的 `CursorMappings` 类族据此生成 `packages/kairos/.cursor-plugin/plugin.json` 与 `.cursor-plugin/marketplace.json`，两份产物已入库。
- 消费面宣称 cursor：四份 README 的「verified on Claude Code, Cursor Agent, and Pi」claim、kairos README 的 Cursor 安装段与安装表列、`packages/kairos/tests/presentation-surface.test.ts` 的 pins、两份架构图的 `Claude Code · Cursor · Pi` sublabel。
- **错位在移除 detect 后立即显形**：cursor 下运行 `cdd` 会得到通用 `CDD_BLOCKED: no host harness detected`；此时任何仍宣称「cursor verified / 可安装」的面都是假话。因此退役必须引擎面、发行面、消费面同退。

### 2. 定案：TTL = 5m（Q1–Q4）

#### 2.1 claude：`FORCE_PROMPT_CACHING_5M=1`

- 选 **单一强制变量**：它在 Claude Code 的 TTL 优先级表里最高，压过 settings 的 `promptCacheTtl`、subagent frontmatter 与 `ENABLE_PROMPT_CACHING_1H`，且同时覆盖主对话与 subagent 两个请求桶。
- 不选逐桶口径（`CLAUDE_CODE_PROMPT_CACHE_TTL=5m` + `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL=5m`）：语义等价但需两键，且表达的是「建议」而非「强制」，与本期「钉死 5m」的意图不符。
- 作用域仅 child 进程：不写回引擎进程环境，也不影响用户自己的会话。

#### 2.2 pi：`PI_CACHE_RETENTION=short`

- pi 默认即 `short`（5m）；显式 pin 的价值是**防止 shell 的 `PI_CACHE_RETENTION=long` 泄漏进 child**，使 claude / pi 两 host 的 TTL 契约同真。
- 事实注记：pi 1.3.0 的 `resolveCacheRetention` 只把 `long` 识别为长保留，其余值落回 `short`；`short` 是稳定的显式拼写。

#### 2.3 注入口径：`HOSTS.env` → `ChildRun.env` → execa `env`

- `HostRow` 新增 `env: Readonly<Record<string, string>>` 数据列，每一行都声明（当前：claude → `{ FORCE_PROMPT_CACHING_5M: "1" }`，pi → `{ PI_CACHE_RETENTION: "short" }`）。
- `ChildRun` 新增 `env` 字段；`CliLifecycle.#dispatch` 从检测到的 host 行取 `row.env` 传入。
- `Terminator.run` 的 execa 选项加 `env: { ...process.env, ...run.env }`——**引擎值覆盖继承值**；合并只发生在 child 进程及其后代。
- 该形态保持 `Terminator` host 无关、零分支；TTL 属于 host 数据契约，不是派发器的代码分支。
- 连带面：`ChildRun` 的测试工厂（`face/__tests__/termination.test.ts:56`）与记录型 `StubRunner`（`face/__tests__/cli.test.ts:5997`）需随字段补齐；spawn 面断言落在 `Terminator` 的 execa 参数上（stub 子进程回显 env 或对合并结果直接 pin）。

### 3. 定案：cursor 完整退役（Q5–Q11）

#### 3.1 引擎面

- `HostId` 收敛为 `"claude" | "pi"`；删除 `HOSTS.cursor` 整行；`REFS` 每个键删除 `cursor` 拼写列（`HostReferenceForm` 随 `HostId` 自动收缩）；`HostDetect.detect` 的检测序改为 `["claude", "pi"]`。
- 同步 live face 注释与文档串（`face/host.ts` / `face/lifecycle.ts:140` 等），并更新引擎测试面：`host.test.ts`（host 行与 flag 断言）、`channel-closure.guard.test.ts`（marker 闭包四→三）、`infra.test.ts:84`（marker 列表）、`preview.test.ts:142-146`（cursor 检测样例改 claude/pi）、`cli.test.ts:4313-4324`（检测序）。新增一条负向回归：仅设 `CURSOR_TRACE_ID` 的环境不再被识别（detect 返回空 → 通用 BLOCKED）。
- `GUARD_BAN_WORDS.stale` 的 `cursor-agent` 行**保留**：它是历史退役词表，不是 live 支持声明；`face/words.ts` 作为数据 home 继续承载该行。
- 不为 cursor 保留专属报错（Q9）：cursor 环境没有 detect 行，得到通用 `no host harness detected` 即可，避免把已退役的 host 知识留在引擎里。

#### 3.2 发行面

- `packages/kairos/package.json`：`oscaner.harnesses` 去掉 `cursor`；`files` 去掉 `.cursor-plugin/`。
- `scripts/emit.ts`：删除 `CursorMappings` 类族（`cursorManifest` / `cursorMarketplaceDoc` / `isPluginRoot`）、`.cursor-plugin` 两个 `PRODUCT_DIRS` 根、`deriveFirstPartyPlugin` 的 cursor 分支、product 生成的两条 cursor 条目。
- 删除已生成产物：`.cursor-plugin/marketplace.json`、`packages/kairos/.cursor-plugin/plugin.json`；随后 `pnpm run emit` 重生成 `marketplace/source.json` 等派生面。
- `scripts/__tests__/emit.test.ts` 的 cursor pins 删除或改写为「cursor 不出现」的反向断言（避免留下无消费者的死数据）。

#### 3.3 消费面

- 四份 README 的 claim 统一为「verified on **Claude Code** and **Pi**」/「已在 **Claude Code** 与 **Pi** 上验证」。
- 根 README：`# Claude Code / Cursor Agent marketplace` 改为 `# Claude Code marketplace`；发行架构图的 `.cursor-plugin` 行删除。
- `packages/kairos/README.md` / `.zh-CN.md`：删除 `# Cursor Agent` 安装段与安装表的 Cursor 列。
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
- **发行面零 cursor**：`.cursor-plugin/marketplace.json` 与 `packages/kairos/.cursor-plugin/plugin.json` 删除；`scripts/emit.ts` 无 cursor 机制；`oscaner.harnesses` / `files` 正确；`pnpm run emit` 后 `emit:check` 绿。
- **消费面一致**：四份 README claim 为 Claude Code + Pi；nominal 表无 cursor 行；`presentation-surface.test.ts` 全绿；两份架构图源 JSON 与生成 HTML 均无 cursor 支持声明。
- **回归**：`pnpm -C packages/cdd-engine test` 全绿；`pnpm run typecheck` ×3 通过；`pnpm run validate` ALL PASS。
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