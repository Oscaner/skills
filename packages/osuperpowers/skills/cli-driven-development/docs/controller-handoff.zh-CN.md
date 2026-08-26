# Controller Handoff（H1–H5）

编器（cli-driven-development）驱动 cdd 引擎的纪律。被 cli-driven-development、cli-select 与编器技能引用。跨技能引用用 markdown 链接（语义规则名 + `#rule-<kebab>` 锚，如 `[Return Block](controller-handoff.md#rule-return-block)`）。

## Rules

### Rule: Return Block

CLI agent stdout ≤ H1 四行（固定 key，每行一个）；编器只读 H1：

```
status: <DONE|BLOCKED|NEEDS_CONTEXT>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

Report bodies、review prose、diff 全文、test stdout 只存在文件里 —— 不进 dispatch return。Implementer 返回前另写 `<workspace>/task-N-test-evidence.json`（见 [handoff-schema.md](handoff-schema.md)）。

### Rule: Handoff Only

编器只读 `handoff.json` 驱动后续，不读 report body / review 轴 prose：

- `plan_conflicts[]` 非空 → **STOP**
- `status: CHANGES_REQUESTED` → fix 链（H4）
- `status: NEEDS_CONTEXT` / `unverifiable[]` 非空 → **STOP**

### Rule: Review Package

review 用上游 `review-package` 生成 diff 包；scope 用 handoff `commits.base`（`git diff <base>...HEAD`）。

### Rule: Fix Cap

fix loop 上限 **5 轮**，超限 STOP + 升级（ask human）；fix 重审 scope 用 `FIX_BASE..HEAD`，`FIX_BASE` = 派发前手记的 HEAD。

### Rule: Inline Handoff

handoff 写入内联在各模式模板（`templates/cdd/{implement,task-review,fix}.md` + `_handoff-write-fragment.md`），无独立 handoff 模式。编器不得自行 merge Standards/Spec prose。

---

H6–H8（CLI dispatch / opt-in / harness registry / gate matrix）→ [`cdd-reference.md`](cdd-reference.md)。
