---
"@oscaner-skills/superpowers-overrides": patch
---

#50 — SDD review severity→status 映射 + deferred minors 治理。`_handoff-write-fragment.md` review 段改为 severity-aware：`blocker` → `CHANGES_REQUESTED`；`warn`/`nit` → `APPROVED`（无条件标 `deferred: true`，混合轮次也标）；open-findings 只写 blocker（非 deferred）。deferred 跨 fix 轮次保留（fix 段 preserve + review 段 merge-not-replace）。`_append_ledger` 增加 deferred roll-up（`K deferred: …`，no-jq 降级诚实措辞）。终盘聚合 ledger deferred → 用户决策 → 有界一次 final fix 波。新增 `tests/sdd-severity-contract.test.sh` 锁定散文决策。
