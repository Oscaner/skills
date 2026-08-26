# P2 remove-retired-skills — Implementation Plan

- **Version**: v1.0 · 2026-08-26
- **Spec**: [2026-08-24-skill-digraph-refactor-p2-design.md](../specs/2026-08-24-skill-digraph-refactor-p2-design.md)
- **Upstream program**: [Overall spec v1.5](../specs/2026-08-24-skill-digraph-refactor-overall.md)

## Global Constraints

- 允许破坏性更新（用户指令）；vendored 子模块不可改。
- changeset 仅 P10 统一建——本 phase 不建 changeset。
- SOT-first 单提交：所有改动验证绿后一次提交 `refactor: remove retired debugging and verification skills and their trigger routes`。
- 终扫口径：P10 同范围 token 归零（`packages/` 排除 CHANGELOG、`docs/` 排除历史 specs/plans/tickets；scripts/ 内 fixture 防御性同步）。

## Task 1: SOT 删行 + 技能目录删除 + emit 级联再生

**步骤**：

1. `packages/osuperpowers-router/overrides.manifest.json`：删除第 9、11 行两 target：
   - `"name": "osuperpowers:debugging"`（overrides `superpowers:systematic-debugging`）
   - `"name": "osuperpowers:verification"`（overrides `superpowers:verification-before-completion`）
2. `git rm -r packages/osuperpowers/skills/debugging packages/osuperpowers/skills/verification`
3. `pnpm run emit`——级联再生 9 类派生品（prompt-expansion.mjs / pi-router.ts / cursor-detect.mjs / cursor-enforce.mjs / hooks.json matcher / claude-self-check.md / cursor-self-check.mdc / GEMINI.md / .agents/）。

**验收**：
- manifest targets = 6；
- `git status` 显示 4 个 SKILL.md 删除 + 派生品更新；
- `grep -c debugging packages/osuperpowers/GEMINI.md` = 0。

## Task 2: 手工同步面清扫

**步骤**：

1. `packages/osuperpowers-router/README.md` + `README.zh-CN.md`：各删路由表 2 行（`/systematic-debugging` 行、`/verification-before-completion` 行）。
2. `docs/maintainers/osuperpowers-router-plugin.md` + `.zh-CN.md`：各删同 2 行（`superpowers:systematic-debugging`、`superpowers:verification-before-completion`）。
3. `packages/osuperpowers/README.md` + `README.zh-CN.md`：技能表各删 2 行（`debugging`、`verification`）。
4. `packages/osuperpowers/skills/init/router.md`：自检表删第 36、38 两行。
5. `scripts/ci-validate.mjs` 第 175 行：`EXPECTED = 9 → 7`，注释同步为当前状态描述；同块第 181/187/192 三处 assert 消息串 `(8 emitters + init)` → `(6 emitters + init)`。
6. `packages/osuperpowers-router/tests/validate-overrides-build.mjs` 第 95 行：断言 `=== 8 → === 6`，消息串 `expected 8 targets` → `expected 6 targets`。
7. **收尾再跑 `pnpm run emit`**——步骤 4 手工编辑 `skills/init/router.md` 后，emit 派生副本 `packages/osuperpowers/.agents/skills/osuperpowers/init/router.md` 已过期（2 行退役 token），不再生则 Task 4 的 emit-freshness 校验必红。

**验收**：本任务编辑的文件（两 README 对、maintainer 文档对、init/router.md）内 grep `osuperpowers:(debugging|verification)` 与 `skills/(debugging|verification)/` 归零——router 测试（cursor-enforce.test.mjs）与 subagent-lifecycle 的残留属 Task 3 范围；全树归零判定保留在 Task 4。

## Task 3: 测试 fixture 与悬空引用

**步骤**：

1. `scripts/lib/emit/emit.test.mjs` geminiMarkdown 用例（约 328-341 行）：样例名数组 `["init", "cli-select", "debugging"]` → `["init", "cli-select", "alpha"]`，期望输出三行按字典序为 `@./skills/alpha/SKILL.md`、`@./skills/cli-select/SKILL.md`、`@./skills/init/SKILL.md`（alpha 字典序最前，输出顺序与输入数组顺序无关）。
2. `scripts/lib/emit/emit.test.mjs` loadTargets 用例（约 699 行）：`assert.equal(targets.length, 8)` → `6`，注释同步为当前状态描述。
3. `packages/osuperpowers-router/tests/cursor-enforce.test.mjs`：
   - 约 123 行 fixture path `/repo/packages/osuperpowers/skills/debugging/SKILL.md` → `/repo/packages/osuperpowers/skills/writing-plans/SKILL.md`；
   - 约 148 行 `{ skill: "osuperpowers:debugging" }` → `{ skill: "osuperpowers:writing-plans" }`（用例测 READ_RES 匹配逻辑，wrong-target 语义不变。**有意偏离 spec §5**：spec 写 brainstorming，但该测试 pending 的 `OVERRIDE = "osuperpowers:brainstorming"` 常量会使字面替换把 wrong-target→deny 用例翻转成 allow——故改用 writing-plans）。
4. `packages/osuperpowers/docs/subagent-lifecycle.md` 第 17 行：`Cited by delegation rules in debugging (→ diagnosing-bugs), receiving-code-review` → `Cited by delegation rules in receiving-code-review`。
5. `packages/osuperpowers/docs/subagent-lifecycle.zh-CN.md` 第 17 行：「被 debugging（→ diagnosing-bugs）、receiving-code-review」→「被 receiving-code-review」。

**验收**：`node --test scripts/lib/emit/emit.test.mjs` 绿；router 测试绿。

## Task 4: 全量验证 + 终扫预演 + 单提交

**步骤**：

1. `pnpm run validate` → ALL PASS。
2. 终扫预演（P10 同口径）：

   ```bash
   grep -rn "osuperpowers:debugging\|skills/debugging/\|osuperpowers:verification\|skills/verification/" \
     packages/ docs/ README.md marketplace/source.json \
     --exclude="CHANGELOG.md" \
     --exclude-dir=specs --exclude-dir=plans --exclude-dir=tickets
   ```

   预期 0 命中。
3. 单提交全部改动：`refactor: remove retired debugging and verification skills and their trigger routes`。

**验收**：
- validate ALL PASS；
- 终扫 grep 0 命中；
- 工作树干净，单提交落地。

## Change history

- v1.0 · 2026-08-26 — 初版（dogfood session）：4 Task 分解——SOT-first 级联再生、手工同步面、测试 fixture + 悬空引用、终扫预演单提交。
- v1.0.1 · 2026-08-26 — review 吸收（Pass 1+2 warn/nit，无 blocker）：geminiMarkdown 排序断言修正（alpha 字典序最前）；Task 2 验收范围收窄至本任务文件；cursor-enforce fixture 记录对 spec §5 的有意偏离（brainstorming→writing-plans，避免与 OVERRIDE 常量冲突）。
- v1.0.2 · 2026-08-26 — review 吸收（Pass 3 warn，无 blocker）：Task 2 补收尾 `pnpm run emit` 步骤——init/router.md 手工编辑后 .agents 派生副本需再同步，否则 emit-freshness 必红。
