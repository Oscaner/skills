---
"@oscaner-skills/cdd-engine": minor
---

Template-plane systematization + naming convergence: prompt templates reorganized under `docs/`/`task/`/`schema/`, engine config consolidated into `engine-config.json` (context-contract · failure-categories · handoff-namespace) and render data into `template-contract.json` (skeleton segments · token registry · clauses container · reviews). Template tokens renamed to scoped full names (`H1_BLOCK` → `RETURN_STDOUT_BLOCK`, `HARD_GATE` → `HANDOFF_WRITE_GATE`, `HANDOFF_TYPE` → `HANDOFF_TARGET`, `LENS_GUIDE` → `REVIEW_LENS_GUIDE`, …); the return-format discriminator in the handoff-namespace config now uses `returnFormat` with `RETURN_STDOUT_BLOCK` / `RETURN_JSON` values (legacy `"h1"`/`"json"` retired, `h1Label` → `returnMarker`). Review/fix gate prose updated to match.

> **semver 说明**：token/返回格式判别器改名**实为 contract-breaking**（`returnFormat` 值 `h1`/`json` 退役，消费方需随迁），但作用域仅限 round-context 契约面、改名语义等价——沿 P3/P4 先例按 minor 发布。