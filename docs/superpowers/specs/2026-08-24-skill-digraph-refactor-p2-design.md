# P2 remove-retired-skills — Design Spec

- **Version**: v1.0 · 2026-08-26
- **Status**: Draft → 3-pass review
- **Author**: Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)
- **Upstream program**: [Overall spec v1.5](./2026-08-24-skill-digraph-refactor-overall.md)
- **Constraints**:
  - 允许破坏性更新，确保最佳实践，不留技术债务（用户指令）
  - vendored 子模块不可改（`vendors/superpowers/` 中 `systematic-debugging` / `verification-before-completion` 原样保留——上游技能继续存在，只是不再被本仓库拦截路由）
  - changeset 仅 P10 统一建（程序级豁免）

---

## 1. 目标

按 overall v1.5 P2 行删除退役技能 `debugging` 与 `verification`：

- 两技能目录删除；
- router 映射清理（overrides.manifest.json 为 SOT，prompt-expansion.mjs / cursor-detect.mjs / cursor-enforce.mjs / hooks.json / pi-router.ts / self-check×2 经 emit 再生）；
- README 路由表清理；
- init/router.md 中退役技能触发条目的清除。

Legacy 内容豁免仅限 init harness/spor 分支内嵌正文，不含退役符号引用——退役 token 在 P10 终扫范围内归零（范围定义同 P10：`packages/` 排除 CHANGELOG、`docs/` 排除历史 specs/plans/tickets；`scripts/` 内的测试 fixture 做防御性同步清理）。

## 2. 非目标

- 不动 osuperpowers-router 触发路由结构本身（仅删条目；hooks 结构、detect/enforce 脚本模板、emit 管线零改动）。
- 不改上游 vendored 仓库。
- 不动 P3+ 才处理的文档迁移与 skill-authoring 规范。
- 不建 changeset（P10 统一）。
- 不改引擎行为语义（本 phase 零引擎代码改动）。

## 3. 删除面

### 3.1 技能本体（git rm -r，4 文件）

| 目录 | 内容 |
|---|---|
| `packages/osuperpowers/skills/debugging/` | SKILL.md + SKILL.zh-CN.md |
| `packages/osuperpowers/skills/verification/` | SKILL.md + SKILL.zh-CN.md |

### 3.2 Router SOT

`packages/osuperpowers-router/overrides.manifest.json` `targets[]` 从 8 行删至 6 行，移除：

- `{ "name": "osuperpowers:debugging", "overrides": "superpowers:systematic-debugging", "source": "../osuperpowers/skills/debugging" }`
- `{ "name": "osuperpowers:verification", "overrides": "superpowers:verification-before-completion", "source": "../osuperpowers/skills/verification" }`

### 3.3 emit 级联再生品（SOT 改后 `pnpm run emit` 自动同步，零手工编辑）

| 派生品 | 再生后变化 |
|---|---|
| `bin/prompt-expansion.mjs` MAP | 少 4 条键值（两 target 各 2 键：`superpowers:*` 与 `/slug`） |
| `bin/pi-router.ts` MAP | 少 2 条 |
| `bin/cursor-detect.mjs` TARGETS | 少 2 组 attach_res |
| `bin/cursor-enforce.mjs` READ_RES | 少 2 键 |
| `hooks/hooks.json` matcher 正则 | 去掉 `/systematic-debugging`、`/verification-before-completion` 两段 |
| `build/generated/claude-self-check.md` | 表少 2 行 |
| `build/generated/cursor-self-check.mdc` | 表少 2 行 |
| `packages/osuperpowers/GEMINI.md` | 少 2 个 @-import |
| `.agents/skills/{debugging,verification}/` | 同步消失（全路径 `packages/osuperpowers/.agents/skills/osuperpowers/{debugging,verification}/`——注意包切换：本表其余行均相对 osuperpowers-router） |

## 4. 手工同步面

| 文件 | 改动 |
|---|---|
| `packages/osuperpowers-router/README.md` + `README.zh-CN.md` | 路由表各删 2 行（`/systematic-debugging`、`/verification-before-completion`） |
| `docs/maintainers/osuperpowers-router-plugin.md` + zh-CN 镜像 | 路由表各删同两行 |
| `packages/osuperpowers/README.md` + `README.zh-CN.md` | 技能表各删 2 行（`debugging`、`verification`） |
| `packages/osuperpowers/skills/init/router.md` 自检表模板 | 删 `/systematic-debugging`、`/verification-before-completion` 两行 |
| `scripts/ci-validate.mjs` | `EXPECTED = 9 → 7`（注释同步：8 emitters → 6 emitters + init；同块 3 处 assert 消息串的 `(8 emitters + init)` 字面量同步改 `(6 emitters + init)`） |
| `packages/osuperpowers-router/tests/validate-overrides-build.mjs` | `targets.length === 8 → 6`；assert 消息串字面量 `expected 8 targets` 同步改 `expected 6 targets` |
| `packages/osuperpowers/docs/subagent-lifecycle.md` 第 17 行 + zh-CN 镜像同句 | 删去 "debugging (→ diagnosing-bugs), "（保留句首引导语 "Cited by delegation rules in "）/ 删去 「debugging（→ diagnosing-bugs）、」（保留引导字「被」）——保留 receiving-code-review / writing-plans / brainstorming 三项 |

## 5. 测试 fixture 调整

| 文件 | 调整 | 理由 |
|---|---|---|
| `scripts/lib/emit/emit.test.mjs` geminiMarkdown 用例 | 样例技能名 `"debugging"` → 中性名 `"alpha"` | 用例测排序逻辑与名字无关；防御性清理（该文件在 `scripts/lib/emit/`，超出 P10 终扫扫描树，但避免退役 token 在测试代码中残留） |
| `scripts/lib/emit/emit.test.mjs` "loadTargets parses the real overrides.manifest.json" 用例 | 断言 `targets.length === 8 → 6`（行 699，注释 "P5 removed two legacy mappings" 同步更新为 6 行现状） | 解析真实 manifest 且被 CI 执行；SOT 删至 6 后不更新则 validate 必红 |
| `packages/osuperpowers-router/tests/cursor-enforce.test.mjs` | fixture 中 `path: ".../skills/debugging/SKILL.md"` → brainstorming 路径、`{ skill: "osuperpowers:debugging" }` → `osuperpowers:brainstorming` | 用例测 READ_RES 匹配逻辑，换存活目标语义不变 |

历史 specs/plans、各包 CHANGELOG（append-only）、根 README 泛指 "verification" 一词均不在终扫 token 集，不动。

Pass 1 completeness warn 已吸收：subagent-lifecycle.md(+zh-CN) 的 debugging 引用归属 §4 手工同步面（P2 清扫），不豁免、不留悬空。
Pass 2 复审轮 warn/nit 已顺手吸收：subagent-lifecycle 删除跨度修正（保留引导语）、ci-validate 消息串字面量、.agents 全路径标注。blocker=0。
Pass 3 两 nit 已顺手吸收：validate-overrides-build 消息串字面量、fixture 改名口径统一为防御性清理。blocker=0，3-pass 循环收敛。

## 6. 执行策略

**SOT-first 单提交**：manifest 删两行 → `pnpm run emit` 级联再生 → 手工清 §4 文档 + §5 fixture → 全量验证绿后一次提交。中间无红态提交，原子可回溯。

提交信息：`refactor: remove retired debugging and verification skills and their trigger routes`

## 7. 验收标准

1. `skills/debugging/` 与 `skills/verification/` 目录删除；
2. manifest targets = 6；
3. `pnpm run emit && pnpm run validate` 绿；
4. 终扫范围 token 归零：在 `packages/`（排除 CHANGELOG.md）、`docs/`（排除 superpowers/{specs,plans,tickets}/ 历史文档；maintainers/ 应零残留）、根 README、`marketplace/source.json` 内 grep `osuperpowers:debugging` / `skills/debugging/` / `osuperpowers:verification` / `skills/verification/` 全部为 0 命中（P10 终扫同口径预演）;
5. 单次原子提交落地。

## Change history

- v1.0 · 2026-08-26 — 初版（dogfood session）：删除面/手工面/fixture 三清单定稿；执行策略 SOT-first 单提交；验收含终扫同口径预演。
