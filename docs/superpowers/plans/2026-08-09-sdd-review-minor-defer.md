# SDD Review severity→status 映射 + deferred minors 治理实现计划

> Spec: [2026-08-09-sdd-review-minor-defer-design.md](../specs/2026-08-09-sdd-review-minor-defer-design.md)
> Fixes: [#50](https://github.com/Oscaner/skills/issues/50)
> Branch: `issue-50`

## Scope

修复 SDD review 的 severity→status 决策：`warn`/`nit`（minor）findings 不再触发 `CHANGES_REQUESTED`，仅 `blocker` 进 fix loop（#50）。同时让 deferred minors 可见（ledger roll-up）、跨 fix 轮次保留、终盘聚合呈现给用户决策。

- **核心修复：** `_handoff-write-fragment.md` review 段 severity-aware 决策；`warn`/`nit` 无条件标 `deferred: true`（混合轮次也标）；open-findings 只写 blocker。
- **跨轮保留：** fix 段 preserve deferred + review 段 merge-not-replace（D5a）。
- **Ledger roll-up：** `_append_ledger` deferred 分支 + no-jq 降级诚实措辞（D5）。
- **终盘聚合：** `spor-subagent-driven-development` 终盘聚合 ledger deferred → 用户决策 → 有界一次 final fix 波（D6）。
- **防回归：** 模板契约测试 + fixture 补 deferred 示例（D7）。

**~11 文件改动：** `templates/sdd-handoff-schema.md`、`templates/sdd-cli/_handoff-write-fragment.md`、`templates/sdd-cli/review.md`、`templates/sdd-cli/fix.md`、`skills/spor-token-efficient-review-dispatch/SKILL.md`、`skills/spor-handoff-writer/SKILL.md`、`bin/lib/sdd-common.sh`、`skills/spor-subagent-driven-development/SKILL.md` + 测试侧 3 文件（`tests/sdd-severity-contract.test.sh` 新增、fixture、`scripts/ci-validate.sh`）。文档 1 处（本 plan）+ changeset 收尾。

## Global Constraints

- **severity→status 映射单一真源 = `templates/sdd-handoff-schema.md`（spec D1）**：`blocker` → `CHANGES_REQUESTED`；`warn`/`nit` → `APPROVED`；`unverifiable`/`plan_conflicts` → `BLOCKED`（不变）。所有模板/技能散文同步引用此表，不得各处重定义。
- **`warn`/`nit` 无条件标 `deferred: true`**（spec D1/D4）——混合轮次（blocker + warn/nit）也标，防止 #50 复现。deferred 标记与 status 决策是**两个独立步骤**，散文不得把标记绑在「无 blocker」分支。
- **deferred 跨轮保留由两段共同保证（spec D5a）**：fix 段 preserve + review 段 merge-not-replace。缺一段即失效，两段措辞都必须落地并被契约测试锁定。
- **open-findings 只写非 deferred 项（blocker）**（spec D4）：deferred 永不进 fix loop。fix 段读 open-findings 只含 blocker。
- **决策是 prose 门控、由 CLI agent 执行**（spec §2 不变量）：不改 shell 层 status 计算，只改模板散文 + 契约测试锁定。`sdd-common.sh` 唯一 shell 改动是 `_append_ledger` 的 deferred 分支。
- **`_append_ledger` 前置守卫**（spec §4.2）：仅在 `status == APPROVED` 时调用（`_run_task_chain` case APPROVED 分支）；no-jq 降级路径诚实标注「deferred not enumerated — jq missing」，不得假称 review clean。
- **D6 终盘 final fix 波有界一次**：一个 fix agent + 一次 scoped re-review；新 blocker 修完**无条件呈报用户**，不进入跨任务 fix loop。round cap 5 仅适用单任务 fix loop。
- **Mode B 不新增 shell end-of-run 打印**（spec D6）：用户运行结束后读 ledger 即可。
- **无署名 / co-author / AI 生成尾注**在提交消息与 PR body（全局 Git 约定）。
- **变更都是 overrides-only**（无 superpowers 版本号变化）：`pnpm changeset` patch release，合并到 `develop`。

## Tasks

### Task 1: schema SOT — severity→status 映射 + `deferred` 字段

**What:** 在 `templates/sdd-handoff-schema.md` 落地 severity→status 映射单一真源（spec D1）与 `findings[]` 的 `deferred` 可选字段（spec D2）。

1. **新增 severity→status 映射表**（放在「Status by segment」表之后）：
   - 空 `findings[]` → `APPROVED`（review clean）
   - 仅 `warn`/`nit`（deferred）→ `APPROVED`（带 deferred 明细）
   - 含 `blocker`（无论是否兼有 `warn`/`nit`）→ `CHANGES_REQUESTED`
   - `unverifiable[]` 非空 → `BLOCKED`（不变）；`plan_conflicts[]` 非空 → `BLOCKED`（orchestrator STOP，不变）
   - **附注：** 任何 `warn`/`nit` finding 无条件标 `deferred: true`——无论同轮是否含 `blocker`（spec D1，防 #50 复现）。
2. **`findings[]` 描述扩充**：加 `deferred` 可选字段——blocker finding 无此字段（或 false）；`warn`/`nit` finding 为 `deferred: true`。Roll-up 用 `filter(.deferred == true)`。
3. **示例补一条 deferred finding**（单任务 JSON 示例的 `findings[]` 加一例 `{"lens":"Clarity","severity":"nit","section":"§4.1","summary":"…","fix":"…","deferred":true}`）。

**Files:** `templates/sdd-handoff-schema.md` (MODIFY)

**Accepts:** 映射表与 spec D1 逐字一致（含「无条件标 deferred」附注）；`deferred` 字段出现在 `findings[]` 描述；示例含 deferred finding；既有字段（`task`/`tasks[]`、`commits.base` 对齐表、`unverifiable[]`、`plan_conflicts[]` 定义）不被改动。

**Dependencies:** None

---

### Task 2: `_handoff-write-fragment.md` — review/fix 段 severity-aware 决策

**What:** 重写 `_handoff-write-fragment.md` 的 review 段与 fix 段（spec §4.1 最终版、D4/D5a）。这是 #50 的核心修复点。

**review 段改为 7-step（spec §4.1）：**

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
```

**fix 段改为 4-step（spec §4.1）：**

```markdown
### Segment: fix

1. Read handoff.json + open-findings.json.
2. Resolve non-deferred findings per fix outcome (remove fixed / update remaining).
3. **Preserve all `deferred: true` findings** from prior handoff `findings[]` — deferred
   items never enter the fix loop and never drop across rounds (D5a).
4. Update findings; set status per fix outcome (re-review decides final APPROVED/CHANGES_REQUESTED).
```

**关键约束（不得回归）：** 旧 step 5「Empty findings → APPROVED; otherwise → CHANGES_REQUESTED」必须**删除**（否则契约测试 grep 到旧措辞会误判）。merge 语义（step 2）是 preservation 兜底——实现时不得理解为整组 replace。**step 6 的 severity→status restatement 引用 schema SOT（Task 1）而非重定义**——平行编辑（Task 2 ∥ Task 1）时两处不得漂移（Global Constraint「不得各处重定义」）。

**Files:** `templates/sdd-cli/_handoff-write-fragment.md` (MODIFY)

**Accepts:** review 段 7-step、fix 段 4-step 与 spec §4.1 逐字一致；旧「Empty findings → APPROVED; otherwise → CHANGES_REQUESTED」措辞消失；`deferred: true`、`CHANGES_REQUESTED`、`blocker`、preserve/merge 措辞都在。

**Dependencies:** None（可与 Task 1 并行）

---

### Task 3: `review.md` + `fix.md` 措辞同步

**What:** 同步两个 review/fix 模式模板的散文（spec D4）。

1. **`templates/sdd-cli/review.md` step 5**：现文「Write handoff per `_handoff-write-fragment.md` review segment. After axes complete, parse D3 findings — empty → `APPROVED`, non-empty → `CHANGES_REQUESTED`.」改为 severity-aware：「…parse D3 findings and set status per `_handoff-write-fragment.md` review segment (spec D1: blocker → CHANGES_REQUESTED; warn/nit → APPROVED + deferred).」
2. **`templates/sdd-cli/fix.md`**：Instructions 补一句——open-findings 只含 blocker（non-deferred）；deferred 项 ride 在 handoff `findings[]` 跨轮次保留（D5a），不进 fix loop。置于现有 step 1（读 open-findings）附近。

**Files:** `templates/sdd-cli/review.md` (MODIFY), `templates/sdd-cli/fix.md` (MODIFY)

**Accepts:** `review.md` step 5 无「empty → APPROVED」旧措辞；`fix.md` 出现「open-findings 只含 blocker」与「deferred」说明；步骤编号不跳号。

**Dependencies:** Task 2

---

### Task 4: D3 severity 行为锚点 + `spor-handoff-writer` 同步

**What:** 两处技能散文同步（spec D3/D4）。

1. **`skills/spor-token-efficient-review-dispatch/SKILL.md` D3 段**：`severity` 定义扩充行为锚点——
   - `blocker` — 合并前必须修复（正确性 / 契约违反 / 任何不接受不修的缺陷）
   - `warn` — 可延期的 minor（真实问题但非阻塞）
   - `nit` — 纯风格
   - 补一句 deferral 语义：「`warn`/`nit` 不进 fix loop——handoff 记 `APPROVED` + `deferred: true`」
   - D3 schema block 补 `deferred` 可选字段说明。
2. **`skills/spor-handoff-writer/SKILL.md`「Review segment parsing」段**：解析 D3 时按 severity 标 deferred；status 决策描述更新为 severity-aware（引用 schema SOT）；open-findings 只写 blocker 说明。

**Files:** `skills/spor-token-efficient-review-dispatch/SKILL.md` (MODIFY), `skills/spor-handoff-writer/SKILL.md` (MODIFY)

**Accepts:** D3 段出现三个行为锚点 + deferral 语义 + `deferred` 字段；`spor-handoff-writer` Review segment parsing 段与 schema SOT 一致（引用而非重定义）；不破坏 D3 现有输出 schema（`{findings: [...]}`）。

**Dependencies:** Task 1

---

### Task 5: `_append_ledger` deferred 分支

**What:** `bin/lib/sdd-common.sh` 的 `_append_ledger` 增加 deferred roll-up（spec §4.2 伪代码）。这是唯一的 shell 改动。

1. 保留现有 `commits.base`/`commits.head` 读取（jq 分支）+ no-jq fallback。
2. **no-jq fallback 改诚实措辞**：`complete (commits unknown..unknown, deferred not enumerated — jq missing)`（spec D5，不再假称 review clean）。
3. **jq 分支 deferred 检测**（在 base/head 读取之后、输出之前）：
   - `deferred="$(jq -c '[.findings[] | select(.deferred == true)]' "$handoff" 2>/dev/null)"`。
   - 非空非 `[]` → `printf '\nTask %s: complete (commits %s..%s, %s deferred: %s)\n' "$n" "$base" "$head" "$k" "$oneline"`（`k`=数组长度，`oneline`= `map(.summary) | join("; ")`）。
   - 否则 → 现有 `complete (commits %s..%s, review clean)`。
4. 前置守卫由调用点保证（`_run_task_chain` 的 case APPROVED 分支）——函数内不检查 status，**不改 `_run_task_chain`**。

**Files:** `bin/lib/sdd-common.sh` (MODIFY)

**Accepts:** `_append_ledger` 三态正确——无 jq → honest 降级措辞；有 jq + findings 含 deferred → `K deferred: …`；有 jq + 无 deferred → `review clean`。`_run_task_chain` 不改动。

**Dependencies:** Task 1

---

### Task 6: `spor-subagent-driven-development` 终盘聚合 + 用户决策门

**What:** `skills/spor-subagent-driven-development/SKILL.md` 补终盘 deferred 治理（spec D6）。

1. **任务全部 APPROVED 后**（final review 之前）：orchestrator 聚合 ledger 全部 deferred minors（grep `deferred` 行；**注意** no-jq 降级行是 `deferred not enumerated — jq missing`、无冒号，聚合可同时匹配 `deferred` 子串以保证健壮）→ 呈现给用户。
2. **用户决策门**：全部 defer（结束）或指定要修。
3. **要修 → 有界 final fix 波**：一个 fix agent 拿完整清单 + 一次 scoped re-review（固定点 = 上次 final head）。**终点语义（spec D6）：** re-review 干净即结束——deferred 已修复，handoff status 保持 APPROVED **不重写**，ledger 保持 `complete` 行（可选追加一行标注 K 已修复）；re-review 暴露的新 blocker → 仍按一次 fix 波修，修完无条件呈报用户（不进入跨任务 loop）。
4. **Mode B 说明**：用户运行结束后读 ledger 聚合 deferred；不新增 shell 打印。
5. 保持既有 Rule 0a checklist / ledger 行格式 / round cap 5 语义不变——只在终盘补 D6 小节。

**Files:** `skills/spor-subagent-driven-development/SKILL.md` (MODIFY)

**Accepts:** 新增的终盘小节描述聚合→呈现→用户决策→有界 final fix 波四步；不破坏既有 Rules 编号与引用（`spor-token-efficient-controller-handoff` H1–H5 等）；round cap 5 明确不适用于跨任务 final fix 波。

**Dependencies:** Task 5

---

### Task 7: 模板契约测试 + fixture deferred 示例

**What:** 新增模板契约测试锁定散文决策（spec D7）+ fixture 补 deferred 示例。

1. **新增 `tests/sdd-severity-contract.test.sh`**：自带 `fail(){ echo "FAIL: $1" >&2; exit 1; }` 与 `set -euo pipefail` + `ROOT` 解析（`fail` helper **不在** `sdd-gate-test-lib.sh` 中——它在各调用脚本内定义；本测试不依赖 fixture 隔离）。**文件须 `chmod +x`**（`scripts/ci-validate.sh` step 5 用 `./` 调测试脚本）：
   - 断言 `templates/sdd-cli/_handoff-write-fragment.md`：
     - 含新 prose 的映射措辞——**匹配 Task 2 落地后的文本**（如 `blocker.*CHANGES_REQUESTED`，而非旧措辞 `status: CHANGES_REQUESTED`——Task 2 后 status 决策是新 step 6 "any `blocker` → `CHANGES_REQUESTED`"，无 `status:` 前缀）。
     - 含 `deferred: true` 措辞（无条件标记存在）。
     - 含 fix 段 preserve-deferred 措辞（`Preserve all \`deferred: true\` findings`）。
     - 含 review 段 merge-not-replace 措辞（`never replace wholesale` 或 `merge`）。
     - **不含**旧措辞「Empty findings → `status: APPROVED`」（防回归旧逻辑）。
   - 断言 `templates/sdd-handoff-schema.md`：`findings[]` 描述含 `deferred`。
   - 断言 `bin/lib/sdd-common.sh`：`_append_ledger` 含 `deferred` 分支措辞 + `deferred not enumerated` no-jq 降级。
   - 断言 `templates/sdd-cli/review.md` step 5：**正面**含 severity-aware 措辞（如 `CHANGES_REQUESTED` 与 `blocker` 同现——旧 step 5 无 `blocker`，可区分；实现者选 pattern 须对旧措辞与被删段落都 fail）**且**不含「empty → `APPROVED`」旧措辞（防止整段被删时契约测试误过）。
   - 断言 `templates/sdd-cli/fix.md` 含 `deferred` 与 blocker-only open-findings 措辞。
   - 断言 `skills/spor-token-efficient-review-dispatch/SKILL.md` D3 含 `deferred: true` 与行为锚点**区分性短语**（如「合并前必须修复」——不 grep 裸 `blocker`/`warn`/`nit`，那是 enum 值、旧文件已有会 false-green）。
   - 断言 `skills/spor-handoff-writer/SKILL.md` Review segment parsing 段含 `deferred`。
   - 断言 `skills/spor-subagent-driven-development/SKILL.md` 含终盘聚合措辞（`deferred`）。
2. **fixture**：`tests/fixtures/sdd-gate/complete/sdd/complete-ws/task-1-handoff.json` 补一条 deferred finding 示例（approve-with-deferred 合法 shape）。**注意**：此 fixture 被 `sdd-gate-allow-deny-smoke.sh` 用（task_complete → allow）；加 deferred 字段不得改变其 `status: APPROVED`、`commits` 结构，避免破坏既有断言。
3. **挂入 `scripts/ci-validate.sh`**（新测试在 `pnpm run validate` 里跑）。

**Files:** `tests/sdd-severity-contract.test.sh` (NEW), `tests/fixtures/sdd-gate/complete/sdd/complete-ws/task-1-handoff.json` (MODIFY), `scripts/ci-validate.sh` (MODIFY)

**Accepts:** 契约测试全绿；fixture 仍 `status: APPROVED` 且既有 gate smoke 断言不破；`pnpm run validate` 全量零失败。

**Dependencies:** Task 1–6（Task 7 断言 schema「deferred」= Task 1 产物；Task 2 ∥ Task 1 无传递依赖，故必须显式列出 Task 1）

---

### Task 8: 全量验证 + changeset + 收尾

**What:**

1. `pnpm run validate` 全量零失败（含生成器漂移、submodule 解析、版本三连、新契约测试）。
2. `pnpm changeset` — 描述：#50 severity→status 映射 + deferred minors 治理。**合并 PR 到 `develop`**（本项目 overrides-only 日常 flow：changesets 在 develop 累积；`develop → main` 是后续单独 release PR，不在本 plan 范围）。
3. `finishing-a-development-branch`：合并到 develop 收尾。

**Files:** None (changeset NEW)

**Accepts:** 全量 CI 绿；changeset 存在且描述准确；PR 目标 `develop`（非 `main`）；PR 描述无 AI 署名尾注。

**Dependencies:** Task 7

---
