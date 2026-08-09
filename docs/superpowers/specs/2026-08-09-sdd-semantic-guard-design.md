# SDD 语义守卫 — Rule 0 checklist 锚点 + Rule N 交叉引用校验

- **Version**: v1.0 · 2026-08-09
- **Status**: Draft
- **Author**: oscaner · Claude
- **Issue**: [Oscaner/skills#52](https://github.com/Oscaner/skills/issues/52)
- **Scope**: `plugins/superpowers-overrides` 测试链 + SDD skill 文件 + 相关文档

## §1 Problem

`plugins/superpowers-overrides` 的 SDD 技能链有两个「只能靠 review 发现、CI 不拦」的回归缺口：

1. **Rule 0 checklist 语义守卫缺失**。`sdd-orchestrator-line-budget.test.sh` 只统计行数，不验证 Rule 0 三阶段 checklist（Setup / Per-task / Final + H6 chain + no-in-session 不变式）的结构是否在瘦身中存活。`p1-slim.3` 期间 Task 3 实现（`ca3aaa1`）曾把三阶段 checklist 压成单行，靠 review 拦下后由 `7fc1864` 恢复 —— 没有任何自动化守卫。
2. **标题改名后交叉引用悬空**。`Rule 0a → Rule 0` 改名（`7c1a7b8`）后，4 个 skill 文件 + gate deny 消息 + smoke needle 共 ~10 处对已退役 `Rule 0a` / `Rule 0b` ID 的引用，CI 不拦，review 只以 WARN 捕捉；其中 `spor-SDD` L95 Red Flag 标签至今仍是陈旧的 `Rule 0a`。

## Goal

为上述两类失败模式各加一个自动化守卫，使它们被 CI 捕获而非 review：

1. **Guard 1（checklist 语义锚点）**：line-budget 测试断言 Rule 0 三阶段标记 + 关键 token 存活。
2. **Guard 2（交叉引用 resolver）**：全插件扫描，任何 `Rule N` 正文引用要么解析到标题，要么在显式 allowlist 中，否则 FAIL。
3. 作为 Guard 2 通过的先决条件，修掉现有 ~10 处陈旧引用 + 3 处 exit-2 文档漂移，并让 `spor-sdd-p0-fallback` 明确标记为 dormant。

## Constraints

- **不改** line-budget 测试的既有 AC#（AC#1 p0-fallback 存在 + Rule 3 锚点、AC#2 H6 表格、Task 4 D3/D6 断言）。
- **不改** p1-slim.3 AC#9：`spor-sdd-p0-fallback` 保留在磁盘、不进 `overrides.manifest.json` targets。
- **不删** p0-fallback 文件（保留为 p0 参考）。
- **不新增** override slash target。
- 锚点断言限定在 Rule 0 块内（`sed` 提取），避免 token 在别处出现造成假通过。
- Guard 2 扫描 `skills/*/SKILL.md`（含 frontmatter `description:`）；`docs/` 参考文档不扫（用 `§`/H 编号体系，非 `Rule N` 形态）。

## Design

### 2.1 Guard 1 — Rule 0 checklist 语义锚点

**位置**：追加进 `tests/sdd-orchestrator-line-budget.test.sh` 末尾（新 AC# 块）。

**作用域（两级提取）**：
1. Rule 0 块：`RULE0="$(sed -n '/^### Rule 0 /,/^### Rule 1/p' "$SKILLS/spor-subagent-driven-development/SKILL.md")"`
2. checklist 子块：`CHECK="$(sed -n '/^4\. \*\*Orchestrator checklist/,/^### Rule 1/p' <<<"$RULE0")"` —— token 锚点只在 `$CHECK` 内断言，避免 `sdd-workspace`（item 2）、`implement`（implementer-prompt.md）、`review`（review-package）、`Rule 5a`（item 3 指针）在 Rule 0 块其他位置出现造成假通过。

**锚点集合**（18 个）：
- **三阶段标记**（**行锚定**正则，强制各自成行，防 `ca3aaa1` 式单行压缩；`grep -qF` 子串无法验证行独立性）：`^\s*\*\*Setup \(once\):\*\*`、`^\s*\*\*Per-task:\*\*`、`^\s*\*\*Final:\*\*`
- **Setup 内容**（`$CHECK` 内 `grep -qF`）：`sdd-workspace`、`plan-constraints.md`、`ledger`
- **Per-task 内容**：`TASK_BASE`、`H6 chain`、`implement`、`review`、`handoff.json`、`APPROVED`、`Rule 5a`、`Rule 6`
- **无会话内改仓库不变式**：`**Never** edit repo deliverables`、`H6 CLI only`
- **Final**：`requesting-code-review`、`finishing-a-development-branch`

`ca3aaa1` 式单行压缩失去三个独立成行的 phase 标记（行锚定 grep 直接 FAIL）与大部分 token → FAIL。

**明确不锚**：`Shell 契約：` 块（gate-matrix 指针，非 issue 所述三阶段）；`pre-flight`（太容易被合理改写删掉）。

### 2.2 Guard 2 — 交叉引用 resolver

**新文件** `tests/rule-reference.test.py`（Python，先例 `manifest-harness.test.py` / `trigger-patterns.test.py`）。

**规则 ID 形态（scope 边界）**：守卫只校验 **numeric 规则 ID** —— `Rule <digits>[<letter>]`（如 `Rule 0a`、`Rule 5b`、`Rule 7`）。显式排除：
- `Rule H1`–`H6`（controller-handoff H 规则，正文以 `H1–H5` 区间引用，非 `Rule N` 形态）；
- 裸 `D1`–`D4`（review-dispatch `### D3` 等标题，正文以裸 `D3`/`D4` 引用，如「D3 findings」）；
- 复数 `Rules N, M, K` 形式（唯一实例是 p0-fallback description，休眠化修复时改写，不做专门解析）。

**算法**：

1. **建索引**：对每个 override skill，提取 numeric 规则 ID `[0-9]+[a-z]?`，来源两种标题形态：`###`/`####` 标题（`^#{3,4} Rule [0-9]+[a-z]?`）**和**加粗标题（`^\*\*Rule [0-9]+[a-z]?`，如 writing-plans 的 `**Rule 3a —**` —— 不是 `###` 标题，但仍是规则头）。
2. **提取正文引用**：`\bRule [0-9]+[a-z]?\b`，扫 body + frontmatter，排除：标题行、HTML 注释行（`<!-- Additional rules ... as Rule 4, Rule 5 -->` 是插入点标记，非引用）。
3. **逐条解析**，顺序（显式目标优先于同文件）：
   - **链接目标**：ref 位于 Markdown 链接内或紧邻 `](...SKILL.md)` → 目标是该链接指向的 skill 文件。兄弟 override（`skills/*/SKILL.md`）→ 校验目标标题存在；非兄弟/upstream → OK（作者显式指向别处，upstream 不在树内不校验）。
   - **scoped 前缀**：`(spor-SDD|SDD|spor-<name>) Rule N` → 校验命名兄弟 skill 的标题。
   - **同文件标题** → OK。
   - **allowlist**（按文件，跨文件条目校验目标标题）→ OK。
   - 否则 **FAIL**，输出 文件 + 行 + 引用。

   **不做「唯一跨文件」自动解析** —— `Rule 3`/`Rule 4`/`Rule 5` 在多个 override skill 有标题，自动解析会把 upstream 引用误指到 p0-fallback/spor-SDD。**已知局限**：无链接、无 scoped 前缀、且与同文件标题同号的裸引用按同文件处理（如 writing-plans:20 `[`subagent-driven-development` Rule 1]` 链接到 upstream SDD、与 writing-plans 自身 `Rule 1` 同号 —— 链接目标非兄弟，回落同文件）。守卫契约是「抓悬空引用」；跨文件改名靠链接 / scoped / allowlist 捕获，上述同号歧义在语义上不可判定。

**allowlist 全集**（经原型对当前仓库验证，仅 3 条）：

| 文件 | allowlist 条目 | 目标 |
|------|---------------|------|
| spor-finishing-a-development-branch | Rule 4 | upstream `superpowers:finishing-a-development-branch`（merge-commit 选项） |
| spor-executing-plans | Rule 5b | 跨文件 → p0-fallback `Rule 5b` |
| spor-sdd-p0-fallback | Rule 0 | 跨文件 → spor-SDD `Rule 0`（休眠化后「When Rule 0 applies」） |

（lifecycle `Rule 3` 引用 —— receiving-code-review / systematic-debugging / tdd / brainstorming / writing-plans —— 均带兄弟链接 → 走链接校验，不入 allowlist；controller-handoff `Rule 7` 与 executing-plans `Rule 0` 是 scoped 前缀 → 走 scoped 校验，不入 allowlist；`<!-- Additional rules ... Rule 4/5 -->` 是注释，排除。）

**自检**：测试末尾内嵌 fixture —— 构造含悬空引用的临时文件，断言 resolver 报 FAIL，证明守卫有效（dogfood）。

### 2.3 前置修复（Guard 2 通过的先决条件）

新 resolver 会在现有 ~10 处陈旧引用上立即 FAIL，故本次一并修复（修复 = Guard 2 通过，不对陈旧引用做 allowlist 兜底）：

**1. 机械改名 `Rule 0a → Rule 0`（2 处）**
- `skills/spor-subagent-driven-development/SKILL.md:95` — Red Flag 标签 → `Rule 0`
- `skills/spor-executing-plans/SKILL.md:28` — `SDD Rule 0a` → `SDD Rule 0`（scoped 前缀 → 走 scoped 校验，不入 allowlist；`Rule 5b (p0)` 保留，走 executing-plans allowlist → p0-fallback）

**2. review-dispatch 一处**（`skills/spor-token-efficient-review-dispatch/SKILL.md:51`）
- `(Rule 0b)` → `(p0 path)`，去掉对已删除 Rule 0b 的引用

**3. p0-fallback 休眠化**（`skills/spor-sdd-p0-fallback/SKILL.md`，5 处引用、4 个位置）
- frontmatter description：`Read only when spor-SDD Rule 0b triggers` → `dormant since CLI-mandatory (7c1a7b8); retained as p0 reference`
- Rule 3 内 `When Rule 0a applies, skip this rule` → `When Rule 0 applies (CLI default), skip — templates/sdd-cli is SOT`（`Rule 0` 走 p0-fallback allowlist → spor-SDD）
- Rule 5b 内同样 → `When Rule 0 applies (CLI default), skip`
- Rule 5c 内同样 → `When Rule 0 applies (CLI default), skip`
- Rule 3 内 `Rule 0b / p0 path` 措辞 → `p0 path`

**4. exit-2 文档漂移（3 处）** — 不在 Guard 2 扫描域（docs 不扫），但属同一 CLI-mandatory 陈旧簇（`7c1a7b8` 移除 p0 fallback 后文档未同步）；用户 grilling 决策 #6 明确一并修。CHANGELOG 已声明权威行为是 BLOCKED：
- `docs/sdd-h6-reference.md:110` — `exit 2 → p0 fallback` → `exit 2 → orchestrator BLOCKED`
- `README.md:119`、`README.zh-CN.md:118` — 同样 → BLOCKED

**5. gate deny 消息 + smoke needle 同步（2 处）** — resolver 只扫 skills/*，但这 2 处 prose 引用属同一陈旧簇，必须一并修（否则 deny 消息误导、smoke 断言 needle 失配）：
- `bin/lib/sdd-orchestrator-gate.sh:302` — deny 消息 `See spor-SDD Rule 0a item 4.` → `See spor-SDD Rule 0 item 4.`
- `tests/sdd-gate-allow-deny-smoke.sh:115` — 断言 needle `"See spor-SDD Rule 0a item 4."` → 同步改

**不动**：p0-fallback 文件本身、line-budget 测试 AC#1 的 p0-fallback 断言。

### 2.4 接线与文档注记

- Guard 1 → `tests/sdd-orchestrator-line-budget.test.sh` 末尾新 AC# 块。
- Guard 2 → `tests/rule-reference.test.py`，在 `tests/validate-overrides-build.sh` 的 line-budget 调用后加一行挂载。
- 两者经 `pnpm run validate` → `scripts/ci-validate.sh` → CI（PR 到 develop/main 均触发）。
- **文档注记**（issue 建议 #3）：`docs/sdd-h6-reference.md` 顶部加一句 —— Rule 0 checklist 项是语义契约，不是 line-budget 瘦身目标；瘦身不得删除/压缩 phase 或关键 token；`sdd-orchestrator-line-budget.test.sh` 会断言。

## §3 Acceptance criteria

1. `pnpm run validate` exit 0（含新 resolver 与 Guard 1）。
2. Guard 1 负例 A（删除）：临时删除任一 phase 标记行 → line-budget 测试 FAIL。
3. Guard 1 负例 B（重排）：把三阶段 checklist 压成单行（保留全部 18 个 token）→ 行锚定 phase grep FAIL。
4. Guard 2 负例：resolver 自带悬空引用 fixture → 断言 FAIL。
5. 重跑陈旧引用扫描：skills/* 的 numeric `Rule N` 引用（排除 HTML 注释）无悬空；allowlist 仅剩 3 条已验证条目（finishing Rule 4 / executing-plans Rule 5b / p0-fallback Rule 0）；`Rule 0a` / `Rule 0b` 在 skills/、`bin/lib/sdd-orchestrator-gate.sh`、`tests/sdd-gate-allow-deny-smoke.sh` 全部清零。
6. `spor-sdd-p0-fallback` 仍在磁盘、仍不在 `overrides.manifest.json` targets[]，frontmatter 标注 dormant。
7. 三处 exit-2 文档与 spor-SDD Rule 7 一致（BLOCKED）。
8. `docs/sdd-h6-reference.md` 顶部含 Rule 0 checklist 语义契约注记（grep 断言）。
9. `pnpm run validate:overrides` + `./plugins/superpowers-overrides/tests/validate-overrides-build.sh` 通过。

## §4 Non-goals

- 删除 `spor-sdd-p0-fallback`（p1-slim.3 AC#9 保留）。
- 扫描 `docs/` 参考文档的 `Rule N` 引用（`§`/H 编号体系不适用）。
- 校验 `Rule H1`–`H6` 与裸 `D1`–`D4` 标题引用、复数 `Rules N` 形式（不同命名约定，非本次 numeric 失败类；见 §2.2 scope 边界）。
- 重写合法裸引用为强制 Markdown 链接（resolver 用「链接 / scoped 目标优先 + 同文件 + 显式 allowlist」覆盖）。
- 解决与同文件标题同号的跨文件裸引用歧义（语义上不可判定，见 §2.2 已知局限）。
- 给陈旧引用做 allowlist 兜底（那是文档 bug，应修复而非豁免）。

## §5 Grilling record

| # | 决策 | 选择 |
|---|------|------|
| 1 | 修复范围 | 两个缺口都覆盖（checklist 守卫 + 交叉引用 resolver） |
| 2 | checklist 守卫机制 | 子串 / 标题断言（非 golden hash、非仅文档） |
| 3 | 交叉引用守卫机制 | 全插件 resolver（heading 索引 + 跨文件解析 + allowlist） |
| 4 | 测试落位 | 拆分 — 锚点进 line-budget 测试；resolver 独立 `rule-reference.test.py` |
| 5 | 锚点深度 | 三阶段标记（行锚定）+ 15 个关键 token（共 18 个锚点；非仅标记、非全量枚举） |
| 6 | 陈旧引用修复 | 全修 + p0-fallback 休眠化 + exit-2 漂移一并修正 |
| 7 | resolver 裸引用策略 | 显式目标优先（链接 / scoped 前缀）→ 同文件 → 3 条显式 allowlist；不做自动跨文件解析（自审修正：唯一跨文件会把 upstream 引用误指；且需处理加粗标题 / HTML 注释 / 链接） |
| 8 | env-unset 锚点 | 对齐现有 checklist（`unset SDD_` 视为举例，不加新步骤） |

用户设计批准：2026-08-09（第 1–4 节逐节确认）。
