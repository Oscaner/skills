# SDD review severity→status 映射 + deferred minors 治理设计

> fixes [#50](https://github.com/Oscaner/skills/issues/50)
>
> 决策记录：见 `## Change History`

## 1. 问题

**Issue #50（核心缺陷）：** `spor-handoff-writer`（及 review 段解析）在全部可行动项都是 minor（warn/nit）时，仍把 `task-N-handoff.json` 写成 `status: CHANGES_REQUESTED`。dogfood（p1-slim.3）观察到：Tasks 1–4 各自多走了额外 fix/review 轮次，尽管 review 散文明确说 findings 是非阻塞 minor（如 Co-authored-by 尾注警告、文档 nit）。

**根因（代码定位）：** status 决策在 `templates/sdd-cli/_handoff-write-fragment.md` review 段 step 5，是模板散文：

```
5. Empty findings → status: APPROVED; otherwise → status: CHANGES_REQUESTED.
```

它从不读 D3 schema 已有的 `severity` 字段（`blocker / warn / nit`，定义于 `skills/spor-token-efficient-review-dispatch/SKILL.md` D3 段）。status 决策是 **prose 门控**、由 CLI agent 执行——没有任何 shell 代码解析 findings 算 status，也没有测试锁定该决策。

**与上游 SDD 语义冲突：** 上游 superpowers SDD 明确要求 minor findings **永不进 fix loop**——记录为 ledger deferred（`Task <N>: minor (deferred): <one-liner>`），由最终 whole-branch review triage。"任何非空 findings → CHANGES_REQUESTED" 把 minor 也拖进了 loop，正是上游明令禁止的。

## 2. 设计目标

| 目标 | 描述 |
|------|------|
| 首要 | `warn`/`nit` findings 不触发 `CHANGES_REQUESTED`；仅 `blocker` 进 fix loop——修复 #50 |
| 次要 | deferred minors 必须可见（ledger roll-up），终盘聚合呈现给用户决策是否修复，杜绝 silent discard |
| 不变量 | `unverifiable[]` 非空 → `BLOCKED`；`plan_conflicts[]` 非空 → orchestrator STOP；`NEEDS_CONTEXT`、round cap 5 等既有语义全部保持 |
| 不变量 | 决策是 prose 门控（agent 执行）——不改 shell 层 status 计算，只改模板散文 + 加契约测试锁定 |
| 范围 | `templates/sdd-handoff-schema.md`、`templates/sdd-cli/{review,_handoff-write-fragment,fix}.md`、`skills/spor-token-efficient-review-dispatch/SKILL.md`、`skills/spor-handoff-writer/SKILL.md`、`bin/lib/sdd-common.sh`、`skills/spor-subagent-driven-development/SKILL.md`、tests + fixture、spec 文档 |

## 3. 核心决策

### D1 — severity→handoff status 映射（schema SOT）

`templates/sdd-handoff-schema.md` 定义单一真源。决策规则：

| `findings[]` 内容 | handoff `status` |
|---|---|
| 空 | `APPROVED`（review clean） |
| 仅 `warn`/`nit`（deferred） | `APPROVED`（带 deferred 明细） |
| 含 `blocker`（无论是否兼有 `warn`/`nit`） | `CHANGES_REQUESTED` |
| `unverifiable[]` 非空 | `BLOCKED`（不变） |
| `plan_conflicts[]` 非空 | `BLOCKED`（orchestrator STOP，不变） |

**任何 `warn`/`nit` finding 无条件标 `deferred: true`——无论同轮是否含 `blocker`。** 混合轮次（blocker + warn/nit）里 warn/nit 仍标 deferred，经 D5a 跨轮保留到最终 APPROVED handoff，不进 open-findings、不进 fix loop。若 deferred 标记只在无 blocker 分支发生，混合轮次 warn/nit 会落入 open-findings 重新进 loop——即 #50 复现。

`warn` 视为 minor、随 `nit` 一并 defer——观察到的 case（尾注警告、文档 nit）都是 warn/nit，正是该 defer 的对象。

### D2 — `findings[]` 加可选 `deferred: true` 标志

- `blocker` finding：**无** `deferred` 字段（或 false）。
- `warn`/`nit` finding：`deferred: true`。
- Roll-up 聚合用 `filter(.deferred == true)` 即可，无需平行 `deferred[]` 数组。
- schema 的 `findings[]` 描述与示例同步；`task-N-open-findings.json` 保持同 shape（沿用）。

### D3 — Severity 词汇行为锚点（D3 SOT）

`skills/spor-token-efficient-review-dispatch/SKILL.md` D3 段的 `severity` 定义扩充行为锚点：

- `blocker` — 合并前必须修复（正确性 / 契约违反 / 任何不接受不修的缺陷）
- `warn` — 可延期的 minor（真实问题但非阻塞）
- `nit` — 纯风格
- 补 deferral 语义一句："`warn`/`nit` 不进 fix loop——handoff 记 `APPROVED` + `deferred: true`"

severity 词汇回归本义：severity 描述**门控行为**（是否进 loop），不是抽象的重要性等级。D3 是横切技能，所有引用它的 review override 自动获得新语义。

### D4 — Handoff 写入散文（prose 门控）

`templates/sdd-cli/_handoff-write-fragment.md` review 段改写：

1. 解析 `## Findings (D3)` JSON block 从各 axis → **merge 进**已有 `findings[]`（保留下 `deferred: true` 项，not replace）。
2. **无条件给所有 `warn`/`nit` 标 `deferred: true`**（无论是否含 blocker）。
3. status 决策：含 `blocker` → `CHANGES_REQUESTED`；否则 → `APPROVED`。
4. `unverifiable` / `plan_conflicts` 分支保持不变（非空 → BLOCKED / STOP）。
5. **open-findings 只写非 deferred 项**（即 blocker）：CHANGES_REQUESTED 时写出 `task-N-open-findings.json`；deferred 不进 fix loop。
6. fix 段读 open-findings（只含 blocker）。

`templates/sdd-cli/review.md` step 5 措辞同步（"empty → APPROVED; otherwise → CHANGES_REQUESTED" → severity-aware 决策）；`templates/sdd-cli/fix.md` 说明 open-findings 只含 blocker。

`skills/spor-handoff-writer/SKILL.md` "Review segment parsing" 段同步：解析 D3 时按 severity 标 deferred；status 决策描述更新。

### D5 — Ledger 即 deferred roll-up

`bin/lib/sdd-common.sh` Mode B `_append_ledger`（调用点已在 `status == APPROVED` 时触发；函数本身读 `commits.base`/`commits.head`）：

- APPROVED 且 `findings[]` 含 `deferred: true` → `Task N: complete (commits base..head, K deferred: <one-liner1>; <one-liner2>)`
- 否则保持 `complete (commits base..head, review clean)`。
- **no-jq 降级路径**：现 fallback 写 `complete (review clean)`——因无法枚举 deferred，改为 `complete (commits …, deferred not enumerated — jq missing)`，避免降级路径 reintroduce silent discard（jq 虽贯穿管线、实际影响低，但措辞必须诚实）。

上游语义的核心是 "deferred 必须在 ledger 可见、可被 roll-up"——`findings[]` 非空却写 "review clean" 是 silent discard 的变体，必须区分。

### D5a — deferred findings 跨 fix 轮次保留（混合轮次不丢失）

**触发场景（Pass 1 自审发现）：** 同一 review 轮次既有 `blocker` 又有 `warn`/`nit` 时，status 是 `CHANGES_REQUESTED`。若 deferred 只在 `status == APPROVED` 时才进 ledger（D5），且每轮 re-review 重新解析 axis reports、不保留上轮 findings，则混合轮次里的 deferred 会**静默丢弃**——从 handoff 和 ledger 聚合两边都丢，违背"杜绝 silent discard"。

**决策：** deferred 项跨轮次保留由**两段共同保证**，缺一段即失效：

- **fix 段**：更新 `findings[]` 时保留上轮 handoff `findings[]` 中所有 `deferred: true` 项，只更新非 deferred 项（按 fix 结果 resolve/移除）。
- **review 段**：re-review 解析 axis findings 时 **merge 进**先前 handoff `findings[]`（保留下 `deferred: true` 项），**不是整组 replace**——否则 fix 段保留的项在下一轮 review 被重建 findings 时丢掉。

deferred 永不进 fix loop、永不因轮次而丢失，从首次识别一路携带到最终 APPROVED handoff → D5 ledger roll-up 完整。D7 契约测试同时锁定两段的 preserve/merge 措辞。

### D6 — 终盘聚合 + 用户决策门

`skills/spor-subagent-driven-development/SKILL.md`（Mode A orchestration 散文）：

- 任务全部 APPROVED 后，orchestrator 聚合 ledger 全部 deferred minors → 呈现给用户。
- 用户决策：全部 defer（结束）或指定要修。
- 要修 → **有界 final fix 波（YAGNI 收紧，一次）**：一个 fix agent 拿完整清单 + 一次 scoped re-review（固定点 = 上次 final head；复用 code-review）。**终点：** re-review 干净即结束（deferred 已修复，status 已 APPROVED，不重写 handoff；ledger 保持 complete 行，可选追加一行标注 K 已修复）。re-review 暴露的新 blocker → **仍按一次 fix 波修，修完**无条件呈报用户（无论是否干净）——**不进入跨任务 fix loop**；剩余项不静默丢弃，呈报即止。round cap 5 仅适用于单任务 fix loop，不适用于此跨任务 final fix 波。
- **Mode B（AFK plan 脚本）：** 用户运行结束后**读 ledger**（D5 已保证 ledger 承载 deferred roll-up）；**不新增** shell 端 end-of-run 打印——当前 `sdd-common.sh` 无此路径，避免 over-build。

### D7 — 防回归：模板契约测试 + 行为 fixture

`tests/` 新增模板契约测试（bash grep 断言）：

- 断言 `_handoff-write-fragment.md` 含映射规则措辞："blocker → CHANGES_REQUESTED"、"warn/nit → APPROVED"、"deferred: true"、fix segment 的 preserve-deferred + review segment 的 merge-not-replace 措辞。
- 断言 schema `findings[]` 描述含 `deferred` 字段说明。
- 断言 `_append_ledger` 的 deferred 分支 + no-jq 降级措辞存在。
- 断言 `review.md` step 5、`fix.md` open-findings 说明、`spor-handoff-writer` Review segment parsing、`spor-token-efficient-review-dispatch` D3 severity 锚点的**散文同步措辞**存在（D4/D3 的 prose sync 也锁定，防漂移）。

fixture `task-1-handoff.json` 补 deferred 示例（approve-with-deferred 的合法 shape）。

**行为 fixture（issue #50 建议 3）取舍：** 决策是 prose 门控、由 CLI agent 执行，真实行为测试需走完整 review→handoff 写入流程，依赖 agent 行为、成本高且脆弱。故本设计用**模板契约测试（grep 锁定决策措辞）+ 静态 fixture（合法 shape）**作为防回归——措辞断言能通过时，决策文本在，agent 按文本执行即得正确行为。已知局限：grep 断言验证的是措辞存在而非映射真行为；若后续需要行为级验证，可再加 dry-run E2E（本次不做，见非目标）。

## 4. 技术设计

### 4.1 `_handoff-write-fragment.md` review 段（改写）

```markdown
### Segment: review

1. Read handoff.json + axis reports (`task-N-review-standards.md`, `task-N-review-spec.md`).
2. Parse `## Findings (D3)` JSON block from each axis → **merge** into prior handoff `findings[]`
   (keep `deferred: true` items; never replace wholesale).
3. **Mark every `warn`/`nit` finding `deferred: true`** — unconditionally, whether or not
   the round also contains a `blocker` (D1: mixing must not re-enter deferred items in the fix loop).
4. Scan for "cannot verify"/"unverifiable" → `unverifiable[]`; non-empty → BLOCKED.
5. Plan/brief violations → `plan_conflicts[]` (orchestrator STOPs).
6. Set status by severity: any `blocker` → `CHANGES_REQUESTED`; otherwise → `APPROVED`.
7. On CHANGES_REQUESTED: write open-findings JSON (non-deferred = blocker findings only) beside handoff.

### Segment: fix

1. Read handoff.json + open-findings.json.
2. Resolve non-deferred findings per fix outcome (remove fixed / update remaining).
3. **Preserve all `deferred: true` findings** from prior handoff `findings[]` — deferred
   items never enter the fix loop and never drop across rounds (D5a).
4. Update findings; set status per fix outcome (re-review decides final APPROVED/CHANGES_REQUESTED).
```

**re-review 的 findings 合并语义（preservation 兜底）：** re-review 后，新 axis findings **merge 进**先前 handoff `findings[]`（保留下已有 `deferred: true` 项），**不是整组替换**。若某条 deferred 项在后续 axis 未再被重新报告，它仍因 merge 而非 replace 保留。`review.md` step 2 的 "merge 进 findings[]" 措辞即此语义；实现时不得理解为 replace。

### 4.2 `_append_ledger` deferred 分支（伪代码）

```bash
# 前置守卫：仅 status == APPROVED 时调用（_run_task_chain 的 case APPROVED 分支）。
# D5a 使 deferred 在混合轮次（status CHANGES_REQUESTED）也存活于 handoff——
# 守卫必须由调用点保证，伪代码本身不检查 status。
if ! command -v jq >/dev/null 2>&1; then
  # no-jq 降级：无法枚举 deferred，诚实标注而非假称 review clean（D5）
  printf '\nTask %s: complete (commits unknown..unknown, deferred not enumerated — jq missing)\n' "$n"
  return
fi
# APPROVED 且 findings[] 含 deferred → complete (…, K deferred: …)
deferred="$(jq -c '[.findings[] | select(.deferred == true)]' "$handoff" 2>/dev/null)"
if [[ "$deferred" != "[]" && -n "$deferred" ]]; then
  k="$(jq 'length' <<<"$deferred")"
  oneline="$(jq -r 'map(.summary) | join("; ")' <<<"$deferred")"
  printf '\nTask %s: complete (commits %s..%s, %s deferred: %s)\n' "$n" "$base" "$head" "$k" "$oneline"
else
  printf '\nTask %s: complete (commits %s..%s, review clean)\n' "$n" "$base" "$head"
fi
```

### 4.3 契约测试断言（草案）

```bash
frag="templates/sdd-cli/_handoff-write-fragment.md"
grep -q 'status: CHANGES_REQUESTED' "$frag" && grep -q 'deferred: true' "$frag" \
  && grep -qi 'blocker' "$frag" || fail "handoff fragment missing severity→status mapping"
```

## 5. 交付物清单

| # | 文件 | 改动 |
|---|------|------|
| 1 | `templates/sdd-handoff-schema.md` | `findings[]` 加 `deferred` 可选字段；D1 映射表；示例补 deferred |
| 2 | `templates/sdd-cli/_handoff-write-fragment.md` | review 段 severity-aware 决策；open-findings 只写 blocker；**fix 段 preserve-deferred（D5a）** |
| 3 | `templates/sdd-cli/review.md` | step 5 措辞同步 severity-aware |
| 4 | `templates/sdd-cli/fix.md` | 说明 open-findings 只含 blocker；**deferred 项 ride 在 handoff `findings[]` 跨轮次（D5a）** |
| 5 | `skills/spor-token-efficient-review-dispatch/SKILL.md` | D3 severity 行为锚点 + deferral 语义 |
| 6 | `skills/spor-handoff-writer/SKILL.md` | Review segment parsing 段同步 severity 分类 |
| 7 | `bin/lib/sdd-common.sh` | `_append_ledger` deferred 分支 |
| 8 | `skills/spor-subagent-driven-development/SKILL.md` | 终盘聚合 + 用户决策门 + final fix pass + re-review 终点语义 |
| 9 | `tests/` | 模板契约测试（fragment/schema/ledger/review.md/fix.md/skill 散文同步断言）；fixture 补 deferred 示例 |
| 10 | `docs/superpowers/specs/2026-08-09-sdd-review-minor-defer-design.md` | 本 spec |

## 6. 非目标

- 不改 shell 层 status 计算（决策保持 prose 门控，agent 执行）。
- 不新增 `deferred[]` 平行数组。
- 不加第 4 档 severity。
- 不改 `unverifiable` / `plan_conflicts` / `NEEDS_CONTEXT` / round cap 5 语义。
- 不改 Mode B 的 pending 判定（`_task_pending` 只认 `status != APPROVED`；APPROVED-with-deferred 仍视为 complete，不重跑）。
- 不改 review-package / gate / dry-run smoke 的既有行为（仅契约测试新增）。
- **不做行为级 E2E**（dry-run 注入 minor-only findings → 断言 APPROVED）：决策是 prose 门控 + agent 执行，真实行为测试脆弱；本次以模板契约测试 + 静态 fixture 覆盖（D7 取舍说明）。

## Change History

| 版本 | 变更 |
|------|------|
| v1 | 初版，反映 grilling 全部 10 个决策点（D1–D7 + 交付物 + 非目标） |
| v2 | Pass 1（Completeness）自审修复：新增 **D5a**（deferred 跨 fix 轮次保留，混合轮次不丢失）；D6 补充 Mode A 终点语义 + Mode B 读 ledger 而非新 shell 打印；D7 契约测试扩展锁定全部 prose sync；§4.1 fix segment 补 preserve-deferred 措辞；交付物 8/9 措辞同步 |
| v3 | Pass 2（Consistency & Scope）自审修复：交付物 #2 同步补 "fix 段 preserve-deferred（D5a）"；§4.1 补 re-review **merge-not-replace** 兜底语义；§4.2 补 `_append_ledger` 前置守卫（仅 APPROVED 时调用）说明；交付物 #4 补 deferred ride-across-rounds 说明 |
| v4 | Pass 3（Clarity & YAGNI）自审修复：D1/D4 明确 **`warn`/`nit` 无条件标 deferred**（混合轮次也标，防 #50 复现）；D5a 补 **review 段 carry-forward**（merge-not-replace，与 fix 段共同保证跨轮保留）；D6 收紧 final fix 波为**有界一次**（新 blocker 修完无条件呈报，不进入跨任务 loop）；D5 补 no-jq 降级路径诚实措辞 + "读 status"措辞更正；D7 补行为 fixture 取舍说明；非目标补"不做行为级 E2E"。§4.1 review 段改写为 7-step 结构，把 "deferred: true 无条件标记"与 status 决策拆开（步骤 3 vs 6），消除 v4 编辑引入的 step-5 缩进歧义 |
