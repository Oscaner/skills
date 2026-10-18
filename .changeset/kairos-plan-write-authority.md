---
"@oscaner-skills/kairos": patch
---

fix(kairos): I3「Plan Sole Writer」→「Plan write authority」——触发判别写权，findings 记裁决通道保留（用户裁定 2026-10-17）:

- **I3 更名 + claim 重写** — `cdd-plan`/`cdd-spec-writer`/`cdd-design`/`cdd-dev` 四份 SKILL 的 I3/I4/I5 引用去名化：「Plan Sole Writer」（plan 是 orchestrator 的 sole-writer surface）不成立——plan 的真实写权者有二，靠**触发判别**（review findings 只经 fix round 分发写；用户裁定/持久回填经 orchestrator 单独提交写），不靠身份；`fix/implement agents hold zero plan-modification authority` 保留。
- **findings 记裁决通道保留** — `FIX_READBACK_SUFFIX`（engine `next.ts`）语义澄清为真实通道：orchestrator 判定 findings 准确性、需要裁决时记录进 findings 文件，fix child 读取裁决；引擎零改动，仅 SKILL 措辞对齐。
- **消费心智负担** — fix hop 上 orchestrator 动作收敛为「照抄 `next:` 分发 +（如需）findings 记裁决」，不再有「findings 在手时编辑 plan 是否正当」的歧义。
