---
"@oscaner-skills/cdd-engine": patch
"@oscaner-skills/kairos": patch
---

docs(kairos) + docs(cdd-engine): cdd base 词面残留清扫 — the `cdd base` command face (T20) lands on every remaining consumer surface.

- **cdd-close/SKILL.md + cdd-dev/docs/base-branch.md** — the base artifact is `base.json` (`.kairos/cdd/<slug>/base.json`, schema `{ base, source, plan, recordedAt }`), read/written through `cdd base set|get --plan <path>`; the shipped methodology doc drops the retired `cdd base-branch` CLI face, the dead `base-branch.json` artifact name and schema (`confirmed_at` → `plan` + `recordedAt`), the obsolete canonical path, and its program-history surface (design-spec citations, the removed-mode narrative, the change-history tail).
- **cdd-engine README pair** — the CLI table and the package intro document `cdd base set|get` + `base.json` instead of the nonexistent `cdd base-branch` command and `base-branch.json` artifact.
- **presentation-surface test pin** — `CDD_SUBCOMMANDS` converges to the engine's six live commands (`implement · review · fix · base · schema · issue`), so the README-documentation behavior claim can no longer pin the retired command name.
