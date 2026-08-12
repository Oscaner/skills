---
"@oscaner-skills/superpowers-overrides": patch
---

engineering extraction P1 — new first-party plugin `plugins/engineering/` (cli-* family: cli-select / cli-task / cli-driven-development / cli-code-review + cdd engine: harness-registry + single `cdd-run.sh` runner + `cdd-exec.sh`/`cdd-select.sh`/`cdd-common.sh` + templates/cdd + docs); droid / pi as new full harnesses + harness selection (droid > pi > current harness).

superpowers-overrides transition: spor-sdd Rule 7 CLI dispatch retargeted to `cdd-run.sh --harness <name>`; orchestrator-gate renamed to cdd-* internally (`cdd-orchestrator-gate.sh`/`cdd-session-activate.sh`, workspace scan `.superpowers/cdd/` + `.superpowers/sdd/` transition fallback); 10 per-harness `sdd-run-{task,plan}-*.sh` scripts deleted; `rule-reference.test.py` dual-mode (numeric `Rule N` transitional + semantic `Rule: <Name>` + `#rule-<kebab>` anchor validation) migrated to engineering validating both plugins; engine tests (commit-gate / common-functions / severity-contract / dry-run-smoke) split into engineering, gate/hook tests stay in overrides; `templates/sdd-cli/` and dead `sdd-handoff-schema.md` removed, p0-fallback / executing-plans template references redirected to `engineering/templates/cdd/`; zero `sdd_*`/`SDD_*`/`sdd-run-` residue in the migrated engine.
