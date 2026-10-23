---
title: 引擎文档工具（Engine Doc-Tooling）— P19 实施计划：child dispatch 缓存 TTL = 5m + 引擎 cursor 支持退役
doc-type: plan
version: v0.6
date: 2026-10-23
slug: 2026-10-10-engine-doc-tooling-p19
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p19-design.md` v0.4 已批准的面；TTL 变量名、README claim 措辞、changeset 类型（双 minor）均为 spec 定值，实现期不得改写。Task 3 的 `marketplace/README.md` harness 集合表述按 v0.4 §3.2 的 schema 实际键（`claude` / `codex` / `qoder`）落地。
- **共享 spawn 面零 host 分支**：`Terminator` 是 claude / pi 共用派发器；host 差异只允许存在于 `HOSTS.env` 数据列，派发器只做一处 `env: { ...process.env, ...run.env }` 合并（引擎值覆盖继承值）。
- **删除即删除**：engine / issuance / consumer 三面同一 phase 退净；不为 cursor 保留死代码、专属 BLOCKED 文案或「将来可能用」的映射机制。
- **冻结面**：`GUARD_BAN_WORDS.stale` 的 `cursor-agent` 行保留（历史 ban 词表）；历史 `docs/kairos/{specs,plans}` 的 cursor 记述零改；`face/cli.ts` / `session/run.ts` 的 per-invocation batch cursor 与 host 无关，零改。
- **原子性**：Task 3 的 `package.json#oscaner` 变更、emit 机制删除与两份 `.cursor-plugin` 产物删除必须同一提交，避免 `emit:check` / `version-sync` 中间态。
- **提交门禁**：每个任务的提交都必须过 `pnpm run precommit`（含 `pnpm -C packages/kairos test`）。因此 Task 2 的 `HOSTS` 收缩必须与 kairos nominal 表 cursor 行、`presentation-surface.test.ts` 的 nominal 派生过滤同一提交退净（`ids` 从 `HOSTS` 派生，README 留行即红）；Task 4 不再重复这两处。任务顺序保持 1→2→3→4→5。
- **版本纪律**：changeset 只到可发布态（cdd-engine minor · kairos minor），不应用版本、不打 tag、不发布。
- 引擎调用一律本地 `node packages/cdd-engine/src-next/bin.ts`（不用 `npx @latest`）；内部文档中文主源（Strategy B）。

### Task 1: child dispatch 缓存 TTL = 5m（`HOSTS.env` → `ChildRun` → execa）

- **Objective**: 把 child 的 prompt-cache TTL 从环境继承改为 host 数据契约——`HOSTS.claude.env = { FORCE_PROMPT_CACHING_5M: "1" }`、`HOSTS.pi.env = { PI_CACHE_RETENTION: "short" }`；`ChildRun` 增 `env`；`CliLifecycle.#dispatch` 传入当前 host 行的 env；`Terminator.run` 以 `{ ...process.env, ...run.env }` 合并（引擎值覆盖继承值），派发器零 host 分支。
- **Files**: Modify `packages/cdd-engine/src-next/face/host.ts`（`HostRow` 接口 · `HOSTS` 两行）· `packages/cdd-engine/src-next/face/termination.ts`（`ChildRun` · `Terminator.run` 的 execa 选项）· `packages/cdd-engine/src-next/face/lifecycle.ts`（`#dispatch` 的 `sync.run` 入参）; Test `packages/cdd-engine/src-next/face/__tests__/host.test.ts` · `packages/cdd-engine/src-next/face/__tests__/termination.test.ts` · `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`
- **Consumes**: phase-spec v0.4 §2.1–§2.3 与 Acceptance 的 TTL 契约判据。
- **Produces**: `HostRow.env: Readonly<Record<string, string>>`（每行必填；`HOSTS.cursor` 以空 `env: {}` 占位保持 `Readonly<Record<HostId, HostRow>>` 完整，Task 2 随整行删除）· `ChildRun.env` · 一条 spawn 面覆盖语义 pin；Task 2 在同一 `host.ts` 上继续删 cursor。
- **Steps**:
  - 写失败测试（host 数据 pin，`host.test.ts`）：
    ```ts
    it("every host row declares its child env — claude 5m force, pi short retention", () => {
      expect(HOSTS.claude.env).toEqual({ FORCE_PROMPT_CACHING_5M: "1" });
      expect(HOSTS.pi.env).toEqual({ PI_CACHE_RETENTION: "short" });
      for (const id of ["claude", "pi"] as const) expect(typeof HOSTS[id].env).toBe("object");
    });
    ```
    — checkable: 该用例因 `env` 不存在而 FAIL
  - 写失败测试（spawn 覆盖语义，`termination.test.ts`）：先给该文件的 `childRun` 工厂补第五参数 `env: Readonly<Record<string, string>> = {}` 并写入返回对象；再用 `scratch()` 根跑：
    ```ts
    it("the dispatch env overrides the inherited env on the child process", async () => {
      const saved = process.env.PI_CACHE_RETENTION;
      process.env.PI_CACHE_RETENTION = "long";
      try {
        const out = await new Terminator().run(
          childRun(
            scratch(),
            process.execPath,
            ["-e", "process.stdout.write(process.env.PI_CACHE_RETENTION ?? '')"],
            TerminationPolicy.of("review"),
            { PI_CACHE_RETENTION: "short" },
          ),
        );
        expect(out.stdout).toBe("short");
      } finally {
        if (saved === undefined) delete process.env.PI_CACHE_RETENTION;
        else process.env.PI_CACHE_RETENTION = saved;
      }
    });
    ```
    — checkable: FAIL（`ChildRun` 无 `env` 字段 / 继承值为 `long`）
    同文件补 claude 面 spawn echo（spec 的 `TTL 契约（claude）` AC 要求 claude spawn 面直接断言，不能只靠数据 pin 传递）：
    ```ts
    it("the claude dispatch env forces the 5m prompt TTL on the child process", async () => {
      const saved = process.env.FORCE_PROMPT_CACHING_5M;
      delete process.env.FORCE_PROMPT_CACHING_5M;
      try {
        const out = await new Terminator().run(
          childRun(
            scratch(),
            process.execPath,
            ["-e", "process.stdout.write(process.env.FORCE_PROMPT_CACHING_5M ?? '')"],
            TerminationPolicy.of("review"),
            { FORCE_PROMPT_CACHING_5M: "1" },
          ),
        );
        expect(out.stdout).toBe("1");
      } finally {
        if (saved === undefined) delete process.env.FORCE_PROMPT_CACHING_5M;
        else process.env.FORCE_PROMPT_CACHING_5M = saved;
      }
    });
    ```
    — checkable: FAIL（`ChildRun` 无 `env` 字段 / 子进程回显空串）
  - 写失败断言（dispatch 传参，`cli.test.ts` 的 `StubRunner` 记录面）：在既有 claude 派发用例（`dispatches through the harness rows — …`，其 runner 绑定为 `const sync = new StubRunner()`）上补 `expect(sync.calls[0]?.env).toEqual(HOSTS.claude.env)`；同一步在 `cli.test.ts` 的 face 导入区补 `import { HOSTS } from "../host.ts";`（该文件当前无 host 导入）— checkable: FAIL（`run.env` undefined）
  - 实现 `host.ts`：`HostRow` 增 `env: Readonly<Record<string, string>>`；`HOSTS.claude` 增 `env: { FORCE_PROMPT_CACHING_5M: "1" }`、`HOSTS.pi` 增 `env: { PI_CACHE_RETENTION: "short" }`；`HostId` 此时仍含 `cursor`，故 `HOSTS.cursor` 增 `env: {}` 空占位以保 `Readonly<Record<HostId, HostRow>>` 无缺列（Task 2 随整行删除）；spread/`satisfies` 形状不变。新 `env` 列的 doc 注释不得出现独立小写 `cache` token（`packages/cdd-engine/src-next/__tests__/dead-decl.guard.test.ts:19-23` 的 `/\bcache\b/` 负断言会因此转红），例如写成「the per-host child TTL pin — engine values win over the inherited env」— checkable: 类型检查通过；`grep -n "cache" packages/cdd-engine/src-next/face/host.ts` 零命中
  - 实现 `termination.ts`：`ChildRun` 增 `env: Readonly<Record<string, string>>`；`Terminator.run` 的 execa 选项增 `env: { ...process.env, ...run.env }`（其余选项零改）— checkable: `grep -n "env: { ...process.env, ...run.env }" packages/cdd-engine/src-next/face/termination.ts` 命中一次
  - 实现 `lifecycle.ts`：`#dispatch` 的 `this.#sync.run({...})` 增 `env: row.env`（`row` 已在手）— checkable: `grep -n "env: row.env" packages/cdd-engine/src-next/face/lifecycle.ts` 命中
  - 重跑本任务测试 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/host.test.ts src-next/face/__tests__/termination.test.ts src-next/face/__tests__/cli.test.ts` 全绿
  - 提交（`feat(cdd-engine): pin child dispatch prompt-cache TTL to 5m via per-host env`）— checkable: 单提交含三处实现与三处测试
- **Acceptance**: `HOSTS.claude.env` / `HOSTS.pi.env` 数据 pin 与 claude / pi 两 host 的 spawn echo pin（子进程分别回显 `1` / `short`）同时绿；`Terminator` 内 env 合并仅一处、无 host 分支；`pnpm -C packages/cdd-engine test` 全绿；`pnpm run typecheck` 通过。
- **DependsOn**: none

### Task 2: 引擎面 cursor 退役（`HostId` 收敛 claude | pi）

- **Objective**: cursor 从引擎 live face 全退——`HostId = "claude" | "pi"`；删 `HOSTS.cursor` 行；`REFS` 每键删 cursor 拼写列；`HostDetect.detect` 检测序改 `["claude", "pi"]`；同步 live 注释与 `it` 标题；新增负向回归（仅设 `CURSOR_TRACE_ID` 不再被识别）。跨包同退：`presentation-surface.test.ts` 的 nominal `ids` 从 `HOSTS` 派生，`HostId` 收缩后 kairos 两份 README 的 cursor 行与派生过滤必须随本提交删除，否则 `pnpm run precommit` 的 kairos 套件转红。
- **Files**: Modify `packages/cdd-engine/src-next/face/host.ts` · `packages/cdd-engine/src-next/face/lifecycle.ts`（`:140` 注释）· `packages/kairos/tests/presentation-surface.test.ts` · `packages/kairos/README.md` · `packages/kairos/README.zh-CN.md`; Test `packages/cdd-engine/src-next/face/__tests__/host.test.ts` · `packages/cdd-engine/src-next/face/__tests__/channel-closure.guard.test.ts` · `packages/cdd-engine/src-next/face/__tests__/preview.test.ts` · `packages/cdd-engine/src-next/face/__tests__/cli.test.ts` · `packages/cdd-engine/src-next/infra/__tests__/infra.test.ts`
- **Consumes**: Task 1 的 `HOSTS` 形状（`env` 列已在）；phase-spec §3.1 与 Acceptance 的「引擎面零 cursor」判据。
- **Produces**: `HostId` 联合仅 claude/pi；`HOSTS` / `REFS` / detect 序无 cursor；一条 `CURSOR_TRACE_ID` 负向 detect pin；kairos nominal 表 cursor 行与 `presentation-surface.test.ts` 派生过滤同提交退净（本任务提交可过 `pnpm run precommit`）。
- **Steps**:
  - 写失败测试（`host.test.ts`，import 扩为 `{ HOSTS, REFS, HostDetect }`）：新增 `expect(Object.keys(HOSTS).sort()).toEqual(["claude", "pi"])`；新增 `expect("cursor" in REFS["kairos:cdd-dev"]).toBe(false)`；新增 `expect(HostDetect.detect({ CURSOR_TRACE_ID: "t" })).toBe("")`（该文件此前只有 `HOSTS` 断言，检测序用例在 `cli.test.ts:4313-4326`）；capabilities 循环改 `["claude", "pi"]`，删除 `:16` 的 `HOSTS.cursor.capabilities` 断言与 `:29` 的 `HOSTS.cursor.invoke` 负断言行（`:30` 已有等价的 pi 行，不复制）— checkable: FAIL（cursor 仍在）
  - 写失败测试（`channel-closure.guard.test.ts`）：`:74` 的 pinned marker 集改 `["AI_AGENT", "CLAUDE_CODE_SESSION_ID", "PATH"]`；`:71` 的 `it` 标题 `the pinned four` 改 `the pinned three`；两处 per-harness 派生循环（`:100`、`:123`）都改 `["claude", "pi"]`（只改一处会使另一处 `form[id]` 对收缩后的 `HostId` 成为类型错误）；文件头 `claude/cursor` 注释同步 — checkable: FAIL；`grep -n "pinned four" packages/cdd-engine/src-next/face/__tests__/channel-closure.guard.test.ts` 零命中（该标题行不含 cursor token，`:106` 的 cursor grep 捕获不到，须单列核对）
  - 写失败测试（`infra/__tests__/infra.test.ts:84`）：marker 列表改 `["CLAUDE_CODE_SESSION_ID", "AI_AGENT"]` — checkable: FAIL
  - 写失败测试（`preview.test.ts:142-146`）：cursor 样例改 `env: { CLAUDE_CODE_SESSION_ID: "s" }`，期望 child 行 `claude -p --output-format text --dangerously-skip-permissions --exclude-dynamic-system-prompt-sections` — checkable: FAIL
  - 写失败测试（`cli.test.ts:4313-4326`）：检测序标题改 `claude > pi`；删 `:4321` 的 cursor 断言与 `:4324-4326` 的 claude/cursor 组合优先级断言（`CURSOR_TRACE_ID` 全文件只保留新增负向 pin 一处），补 `expect(dispatch.detectHost({ CURSOR_TRACE_ID: "t" })).toBe("")` — checkable: FAIL
  - 同步跨包 nominal 派生（与 `HOSTS` 收缩同提交，否则本提交在 `pnpm run precommit` 的 kairos 套件红）：`packages/kairos/tests/presentation-surface.test.ts:480-482` 的 `ids` 过滤改 `(k): k is HostId => k === "claude" || k === "pi"`；删 `packages/kairos/README.md:76` 与 `packages/kairos/README.zh-CN.md:78` 的 cursor 行 — checkable: `pnpm -C packages/kairos exec vitest run tests/presentation-surface.test.ts` 全绿（在 `host.ts` 实现后）
  - 实现 `host.ts`：`HostId` 联合删 `"cursor"`；删 `HOSTS.cursor` 整行；`REFS` 每键删 `cursor:` 行；`HostDetect.detect` 序改 `["claude", "pi"]`；注释中 cursor 表述清尽（顶层契约注释 / `HostCapabilities` / `REFS` 注释）— checkable: `grep -n "cursor" packages/cdd-engine/src-next/face/host.ts` 零命中
  - 实现 `lifecycle.ts:140` 注释（`"claude" | "cursor" | "pi"` → `"claude" | "pi"`）与测试文件注释 / `it` 标题（`host.test.ts:3-5/14`、`channel-closure.guard.test.ts:13-17`、`preview.test.ts:144-145` 的 leading-token 注释改 `claude`）— checkable: `grep -rn "cursor" packages/cdd-engine/src-next/face/__tests__/host.test.ts packages/cdd-engine/src-next/face/__tests__/channel-closure.guard.test.ts packages/cdd-engine/src-next/face/__tests__/preview.test.ts` 仅剩 host / channel-closure 的负向 pin 与 `CURSOR_TRACE_ID`
  - 跑引擎全量 — checkable: `pnpm -C packages/cdd-engine test` 全绿
  - 跑跨包门禁（本提交的 `precommit` 覆盖面）— checkable: `pnpm -C packages/kairos test` 全绿
  - 提交（`refactor(cdd-engine): retire the cursor host`）— checkable: 单提交；提交时 `pnpm run precommit` 全绿；`grep -rn "cursor-agent" packages/cdd-engine/src-next --include='*.ts' | grep -v "face/words.ts"` 零命中（`face/cli.ts` / `session/run.ts` 的 per-invocation batch cursor 属冻结面，不在 `cursor-agent` 判据内）
- **Acceptance**: `HostId` 仅 claude/pi；`HOSTS` / `REFS` / detect 序零 cursor；`CURSOR_TRACE_ID` 只出现在负向回归 pin；`cursor-agent` 只在 `face/words.ts` 的 ban 行；engine 套件与 kairos 套件全绿（nominal 行与派生过滤同退）；每个中间提交均可过 `pnpm run precommit`；typecheck 通过。
- **DependsOn**: 1

### Task 3: 发行面 cursor 退役（emit 机制 + 产物 + schema + marketplace 文档）

- **Objective**: `packages/kairos` 不再声明 cursor，emit 不再生成 `.cursor-plugin`，已生成产物与 schema / marketplace 文档中的 cursor 面同步删除；`emit:check` / `version-sync` 在无 cursor 产物下绿。
- **Files**: Modify `packages/kairos/package.json` · `packages/kairos/.version-bump.json` · `scripts/emit.ts` · `scripts/lib/first-party.ts` · `scripts/lib/version-sync.ts`（`:3` 注释）· `marketplace/source.schema.json` · `marketplace/README.md` · `scripts/__tests__/emit.test.ts`; Delete `.cursor-plugin/marketplace.json` · `packages/kairos/.cursor-plugin/plugin.json`
- **Consumes**: phase-spec §3.2 与 Acceptance 的「发行面零 cursor」判据。
- **Produces**: `oscaner.harnesses = ["claude", "pi"]`；零 `.cursor-plugin` 产物；emit 无 cursor 机制；`marketplace/source.json` 由 emit 重生成。
- **Steps**:
  - 改失败测试（`scripts/__tests__/emit.test.ts`）：`:18` 用例标题删去 cursor 表述（改为 `derives the kairos source row — the claude keyword reconciliation`）；删 `:22` 的 `kairos?.cursor` 断言（`PluginSource.cursor?` 同任务删除后该访问为 TS2339），改以整份 source 的反向 pin `expect(JSON.stringify(source).includes("cursor")).toBe(false)` 证明 cursor 不出现；产物集列表删两条 `.cursor-plugin` 条目，并补对应的 `expect(generatedPaths).not.toContain(...)` 反向断言 — checkable: FAIL
  - 实现 `packages/kairos/package.json`：`oscaner.harnesses` 删 `"cursor"`；`files` 删 `".cursor-plugin/"` — checkable: `grep -n "cursor" packages/kairos/package.json` 零命中
  - 实现 `packages/kairos/.version-bump.json`：`files[]` 删 `.cursor-plugin/plugin.json` 条目 — checkable: `grep -n "cursor" packages/kairos/.version-bump.json` 零命中
  - 实现 `scripts/emit.ts`：删 `CursorMappings` 类族；`BASE_PRODUCT_ROOTS` 删 `.cursor-plugin` 两行（`:48` / `:50`）；`deriveFirstPartyPlugin` 删 cursor 分支（`:79-80`）；product 生成删两条 cursor 条目（`:344-347`）；marketplace doc 删 cursor 产物（`:373-374`）；头注释 cursor 表述清尽 — checkable: `grep -n "cursor" scripts/emit.ts` 零命中
  - 实现 `scripts/lib/first-party.ts`：`PluginSource` 删 `cursor?` 字段 — checkable: `grep -n "cursor" scripts/lib/first-party.ts` 零命中
  - 实现 `scripts/lib/version-sync.ts:3`：注释删「(the .cursor-plugin marketplace carries no version row)」半句 — checkable: `grep -n "cursor" scripts/lib/version-sync.ts` 零命中
  - 实现 `marketplace/source.schema.json`：删 `cursorWrapper` / `cursorPluginRoot` / `cursor` 三个 `$defs`；`harnessHooks.properties` 删 `cursor`；`plugin.required` 删 `"cursor"`；`plugin.properties` 删 `cursor` — checkable: `grep -n "cursor" marketplace/source.schema.json` 零命中；JSON 解析通过
  - 实现 `marketplace/README.md`：删产物表两条 `.cursor-plugin` 行；删 `## Cursor install modes` 整段与 `## Cursor Team Marketplace` 整段；`## Schema` 行删 cursor oneOf 半句，harness 集合表述按 `source.schema.json#/$defs/harnessHooks` 的实际接受键写成「Per-harness hooks are limited to the keys the schema accepts (`claude` / `codex` / `qoder`) with repo-relative path patterns.」（该 `$defs` 不含 `pi`，不得写成 `claude` / `pi` 的 schema 强制表述）— checkable: `grep -n "cursor\|Cursor" marketplace/README.md` 零命中
  - 删除两份产物（连带空目录）：`rm .cursor-plugin/marketplace.json packages/kairos/.cursor-plugin/plugin.json && rmdir .cursor-plugin packages/kairos/.cursor-plugin` — checkable: 两文件不存在
  - 重生成与校验 — checkable: `pnpm run emit` exit 0；`pnpm run emit:check` 输出 fresh；`pnpm exec vitest run scripts/__tests__/emit.test.ts` 全绿；`pnpm run version-sync` 绿
  - 提交（`chore(emit): retire the cursor distribution surface`）— checkable: 单提交含源、schema、文档、产物删除与重生成
- **Acceptance**: `git grep -i cursor -- marketplace scripts` 仅命中 `scripts/__tests__/emit.test.ts` 的反向断言；`packages/kairos/package.json` / `.version-bump.json` 零 cursor；两产物删除；`emit` 后 `emit:check` / `version-sync` 绿。
- **DependsOn**: 2

### Task 4: 消费面真话化（README 家族 · CLAUDE.md · pins · 架构图）

- **Objective**: 所有宣称 cursor 已验证 / 可安装的消费面改为 Claude Code + Pi；presentation-surface pins 同步；双语架构图源 JSON 与生成 HTML 更新（Archify 重生成，禁手改 HTML）。
- **Files**: Modify `README.md` · `README.zh-CN.md` · `packages/kairos/README.md` · `packages/kairos/README.zh-CN.md` · `CLAUDE.md` · `packages/kairos/tests/helpers.ts` · `packages/kairos/tests/presentation-surface.test.ts` · `packages/cdd-engine/src-next/face/__tests__/install-rows.guard.test.ts` · `docs/diagrams/src/architecture.en.json` · `docs/diagrams/src/architecture.zh-CN.json` · `docs/diagrams/architecture.en.html` · `docs/diagrams/architecture.zh-CN.html`
- **Consumes**: phase-spec §3.3 与 Acceptance 的「消费面一致」判据。
- **Produces**: 四份 README + CLAUDE.md 零 cursor；presentation-surface 全绿；架构图 EN/zh 无 cursor 支持声明。
- **Steps**:
  - 改失败测试（`presentation-surface.test.ts`；nominal `ids` 过滤已在 Task 2 随 `HOSTS` 收缩同步，本任务只改 claim / residue 两面与文件内三处 live 描述）：claim 正则改 `verified on \*\*Claude Code\*\* and \*\*Pi\*\*` / `已在 \*\*Claude Code\*\* 与 \*\*Pi\*\* 上验证`；「zero cursor-agent residue」用例改为四份 claim 面的 cursor 零命中，断言必须大小写不敏感（`/cursor/i` 或 `line.toLowerCase().includes("cursor")`——四份 README 现行拼写为 `Cursor Agent`，大小写敏感的 `line.includes("cursor")` 会漏掉大写回归，弱于 Acceptance 的 `git grep -i cursor`）；同步三处 live 描述：`:373` 用例名 `verified triple (claude + cursor-agent + pi)` 改 `verified pair (claude + pi)`、`:9` 文件头的 `zero cursor-agent residue pins` 改述为四份 claim 面的未验证 cursor 零命中（大小写不敏感）、`:438` 注释的「`cursor-agent` is legal ONLY as the cursor binary-column data value」改为「the nominal table has no cursor row — `cursor-agent` survives only as the residue case's banned token」——residue 用例体内作为被禁 token 的 `cursor-agent` 断言保留 — checkable: FAIL（README 仍含 cursor）；收口 `grep -n "cursor-agent" packages/kairos/tests/presentation-surface.test.ts` 仅剩 residue 用例体内的被禁 token 断言
  - 改四份 README claim 与 cursor 行：`README.md:11` / `README.zh-CN.md:15` / `packages/kairos/README.md:5` / `packages/kairos/README.zh-CN.md:7` 的 claim；根 marketplace 标题按语言分别改写——`README.md:50` → `# Claude Code marketplace`、`README.zh-CN.md:54` → `# Claude Code 市场`（zh 镜像不得落英文注释）；根 README `:79` / zh `:83` 的 ASCII 行删 `.cursor-plugin/`；kairos README（行号以 Task 2 删除 nominal 行后的文件为准）删 `# Cursor Agent` 段（`:64` / `:66`）、斜杠句（`:57` / `:59`）、安装表 Cursor 列（`:88` / `:90`）、plugin-qualified import 句的 Cursor（`:82` / `:84`）、悬空 pending 说明（`:95` / `:97`）— checkable: `git grep -i cursor -- README.md README.zh-CN.md packages/kairos/README.md packages/kairos/README.zh-CN.md` 零命中
  - 改 `CLAUDE.md`：`:7` claim、`:13` 与 `:35` 的 emit 产物 / manifest 清单去 `.cursor-plugin/` — checkable: `git grep -i cursor -- CLAUDE.md` 零命中
  - 改 `packages/kairos/tests/helpers.ts:38`：示意 host CLI 列表删 `cursor-agent` — checkable: 该行无 cursor
  - 改架构图源 JSON：`docs/diagrams/src/architecture.en.json` 与 `architecture.zh-CN.json` 的 `.claude-plugin · .cursor-plugin` → `.claude-plugin`、`Claude Code · Cursor · Pi` → `Claude Code · Pi` — checkable: 两份 JSON 的 `cursor` 零命中
  - 用 Archify 从源 JSON 重生成两份 HTML（命令见 `docs/diagrams/README.md` 的 finalize 示例，`--repo-root .`）— checkable: 两份 HTML 无 `.cursor-plugin` / `Cursor · Pi` 支持声明（CSS 的 `cursor:` 不计）
  - 改引擎 guard（`packages/cdd-engine/src-next/face/__tests__/install-rows.guard.test.ts`）：安装表删 Cursor 列后为 3 列（行按 `|` 切分为 5 个 cell），`:30` 的 `cells.length < 6` 改 `< 5`，并同步 `:29` 的 `| a | b | c | d |` 注释为 3 列形（`cells[2]` 仍为 Claude Code 列）— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/install-rows.guard.test.ts` 全绿
  - 跑 kairos 套件 — checkable: `pnpm -C packages/kairos test` 全绿
  - 提交（`docs: retire cursor claims across the consumer surface`）— checkable: 单提交含 README/CLAUDE.md/pins/图
- **Acceptance**: 四份 README + CLAUDE.md `cursor` 零命中；nominal 表无 cursor 行；presentation-surface 与 `install-rows.guard.test.ts` 全绿；两份架构图源与生成物无 cursor 支持声明。
- **DependsOn**: 2, 3

### Task 5: changesets（双 minor）+ 全量验证

- **Objective**: 为 cdd-engine 与 kairos 各落一条 minor changeset（cursor 退役 + TTL 5m），并跑全量 `pnpm run validate` 收口。
- **Files**: Create `.changeset/p19-child-cache-ttl-cursor-retirement.md`（单文件列两包，或拆两条；内容取 spec §3.4）
- **Consumes**: Task 1–4 的落地面；phase-spec §3.4 与 Acceptance 的「发布面」判据。
- **Produces**: 两条 minor changeset；`pnpm run validate` ALL PASS。
- **Steps**:
  - 写 changeset：`@oscaner-skills/cdd-engine: minor`（child dispatch TTL 5m · cursor host retired）与 `@oscaner-skills/kairos: minor`（cursor manifest retired；README/claim 同步）— checkable: 文件含两个包名与 `minor`
  - 全量验证 — checkable: `pnpm run emit:check` fresh；`pnpm run validate` ALL PASS（含 engine/kairos/root 套件 · typecheck ×3 · version-sync · check:no-bare-functions）
  - 提交（`chore: add P19 changesets`）— checkable: 单提交
- **Acceptance**: 两包各一条 minor changeset；`pnpm run validate` ALL PASS；未应用版本 / 未打 tag。
- **DependsOn**: 1, 2, 3, 4

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-23 | 初稿：五任务——`HOSTS.env` → `ChildRun` → execa（TTL 5m）· 引擎面 cursor 退役 · 发行面 cursor 退役 · 消费面真话化 · changesets 双 minor + 全量验证；任务按 1→2→3→4→5 串行（2 依赖 1 共享 `host.ts`；4 依赖 2/3；5 收口） | Claude（kairos:cdd-plan · 2026-10-23） |
| v0.2 | 2026-10-23 | **plan-fix-1（review-1 findings 收口 · 1 blocker + 2 warn + 3 nit）**：① blocker——Task 4 纳入 `install-rows.guard.test.ts`（README 安装表删 Cursor 列后 3 列 = 5 cell，`cells.length < 6` 使 guard 空解析），改 `< 5` 并补 guard checkable / Acceptance；② warn——Task 1 补 claude spawn echo 断言（`FORCE_PROMPT_CACHING_5M=1`）与 Acceptance 双 host echo 表述；③ warn——Task 2 提交 checkable 由 `cursor` 改为 `cursor-agent`（per-invocation batch cursor 属冻结面，零命中不可达）；④ nit——Task 1 `host.ts` 的 `env` doc 规避 `dead-decl.guard` 的 `/\bcache\b/` 负断言并补 grep checkable；⑤ nit——Task 2 显式删除 `cli.test.ts:4323-4325` 组合优先级断言，`CURSOR_TRACE_ID` 只留负向 pin；⑥ nit——Task 3 `marketplace/README.md` 的 harness 集合表述按 schema 实际接受键（`claude` / `codex` / `qoder`）改写，不宣称 `pi` 受 schema 强制 | Claude（kairos:cdd-dev [P19] docs-fix round 1 · 2026-10-23） |
| v0.3 | 2026-10-23 | **plan-fix-2（review-2 findings 收口 · 1 blocker + 1 warn + 1 nit）**：① blocker——Task 1 为 `HOSTS.cursor` 补 `env: {}` 空占位（`HostId` 仍含 cursor，新必填列缺行会使 `satisfies Readonly<Record<HostId, HostRow>>` 与 `HOST_CONTRACT` 的 typecheck 转红），Task 2 随整行删除；② warn——Task 3 `emit.test.ts` 删 `kairos?.cursor` 断言（`PluginSource.cursor?` 删除后为 TS2339），改用 `JSON.stringify(source).includes("cursor") === false` 反向 pin，并改写 `:18` 用例标题去 cursor 措辞；③ nit——Task 2 `host.test.ts` 步骤改为新增断言并补 `REFS` / `HostDetect` import（该文件无 detect 用例），并明写删除 `:16` 的 `HOSTS.cursor.capabilities` 断言与 `:29` 的 `HOSTS.cursor.invoke` 负断言行 | Claude（kairos:cdd-dev [P19] docs-fix round 2 · 2026-10-23） |
| v0.4 | 2026-10-23 | **plan-fix-3（review-3 findings 收口 · 1 blocker + 4 nit）**：① blocker——Task 2 的 `HOSTS` 收缩会使 `presentation-surface.test.ts` 的 nominal 派生（`ids` 读 `HOSTS`）与仍留 cursor 行的 kairos README 失配，Task 2/3 提交在 `pnpm run precommit` 的 kairos 套件转红；选择「并入 Task 2」而非重排任务序：Task 2 同提交删除两份 kairos README 的 nominal cursor 行并改派生过滤，Task 4 相应移除这两处、行号按 post-Task-2 快照重算，Constraints 新增「每个提交过 `precommit`」纪律；② nit——Task 1 `cli.test.ts` 断言改 `sync.calls[0]?.env` 并补 `HOSTS` 导入；③ nit——Task 2 明写两处 per-harness 循环（`:100`、`:123`）并把 `preview.test.ts:144-145` 纳入 live-comment 清扫；④ nit——Constraints 的 spec 引用由 v0.3 改 v0.4，并记录 Task 3 落地 v0.4 §3.2 的 schema 实际键措辞；⑤ nit——Task 4 根 marketplace 标题按语言分列（EN `# Claude Code marketplace` / zh `# Claude Code 市场`） | Claude（kairos:cdd-dev [P19] docs-fix round 3 · 2026-10-23） |
| v0.5 | 2026-10-23 | **plan-fix-4（review-4 findings 收口 · 4 nit）**：① nit——Task 2 live 同步显式覆盖 `channel-closure.guard.test.ts:74` pinned 集与 `:71` 的 `it` 标题（`the pinned four` → `the pinned three`），并补 `pinned four` 零命中的单列 checkable（该行不含 cursor token，cursor grep 捕不到）；② nit——Task 4 一并更新 `presentation-surface.test.ts` 的三处 live 描述（`:373` 用例名、`:9` 文件头、`:438` 注释），保留 residue 用例体内的被禁 token 断言，并加 `grep -n "cursor-agent"` 收口核对；③ nit——Task 4 的四份 claim 面 cursor 零命中断言明写为大小写不敏感（`/cursor/i`），对齐 Acceptance 的 `git grep -i cursor`；④ nit——Task 1 的 `dead-decl.guard.test.ts` 引用写全路径 `packages/cdd-engine/src-next/__tests__/dead-decl.guard.test.ts:19-23` | Claude（kairos:cdd-dev [P19] docs-fix round 4 · 2026-10-23） |
| v0.6 | 2026-10-23 | **closeout（cdd-close）**：P19 全链闭合——五任务五波全绿（W1 `40307fa5` TTL 注入链路 · W2 `618a6725` 引擎面 cursor 退役（kairos nominal 行与派生过滤同提交）· W3 `de0dfca5` 发行面退役 · W4 `5d9485d9` 消费面真话化 + wave-fix `1d5518e9` · W5 `8d09b739` changesets）· 各波 review APPROVED · 分支终审 branch-review-1 **REVIEW_FIX**（1 warn：`.github/workflows/static.yml` 不在计划归属面 · 1 nit：pi TTL 缺端到端 dispatch pin）→ branch-fix-1 APPROVED（`11727862` 补 `cli.test.ts` 的 pi 派发断言；Pages 两提交迁至 `chore/pages-deploy` 后从 P19 摘除）· `pnpm run validate` exit 0（emit fresh · root 10/10 · kairos 76/76 · cdd-engine 821/821 · typecheck ×3 · version-sync · 零裸函数零命中）· changeset cdd-engine **minor** + kairos **minor** pending · 不发布 | Oscaner M. · Claude（kairos:cdd-close · closeout-backfill） |
