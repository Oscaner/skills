---
"@oscaner-skills/cdd-engine": minor
---

Template-plane systematization + naming convergence: prompt templates reorganized under `docs/`/`task/`/`schema/`, engine config consolidated into `engine-config.json` (context-contract · failure-categories · handoff-namespace) and render data into `template-contract.json` (skeleton segments · token registry · clauses container · reviews). Template tokens renamed to scoped full names (`H1_BLOCK` → `RETURN_STDOUT_BLOCK`, `HARD_GATE` → `HANDOFF_WRITE_GATE`, `HANDOFF_TYPE` → `HANDOFF_TARGET`, `LENS_GUIDE` → `REVIEW_LENS_GUIDE`, …); the return-format discriminator in the handoff-namespace config now uses `returnFormat` with `RETURN_STDOUT_BLOCK` / `RETURN_JSON` values (legacy `"h1"`/`"json"` retired, `h1Label` → `returnMarker`). Review/fix gate prose updated to match.

> **Semver note**: the token/return-format discriminator rename is effectively contract-breaking (`returnFormat` values `h1`/`json` retired, consumers must migrate), but the scope is limited to the round-context contract surface and the rename is semantically equivalent — released as a minor following the P3/P4 precedent.
