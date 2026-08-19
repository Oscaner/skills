---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P1 — plugin skeleton + `cli-*` family + droid/pi harnesses + CLI mode rework.

- Created the os-engineering plugin: marketplace/source.json registration, plugin.json, CI validate integration.
- Reorganized the SDD harness mechanism: declarative harness registry (JSON: harness → cli_bin / invocation flags / output format / review_prefix / ship level) + a single generic runner `cdd-run.sh` (`--harness <name> --task N --mode …` / `--plan`); deleted per-harness wrapper and stub scripts.
- Added droid and pi as full harnesses (stream-json parsing / `--auto` level / completion sentinel).
- Full sdd → cdd rename: `SDD_*` → `CDD_*` env vars, `cdd-common.sh`, `cdd-run.sh`, workspace `.superpowers/sdd/` → `.superpowers/cdd/`, `docs/cdd-reference.md`, `templates/cdd/`.
- New `cli-*` skills: `cli-select` (installed-harness listing + recommendation), `cli-task` (generic one-shot dispatch), `cli-driven-development` (three-mode chain), `cli-code-review`.