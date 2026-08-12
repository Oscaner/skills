---
"@oscaner-skills/engineering": patch
---

engineering P3 — standalone first-party plugin with unified multi-harness emit + CDD gate ownership. New `scripts/emit.mjs` generates every first-party artifact from `marketplace/source.json`: thin per-harness manifests (`.claude-plugin`/`.cursor-plugin`/`.codex-plugin`/`.kimi-plugin`/gemini/pi) all pointing at the canonical `./skills/` tree, `GEMINI.md`, a shared `.agents/skills/` copy (engineering + upstream superpowers), overrides router hooks + self-check tables, engineering PreToolUse gate hooks, and `.version-bump.json`-style version consistency. CDD orchestrator gate relocated into engineering (`override-claude-cdd-gate.sh`/`override-cursor-cdd-gate.sh` + PreToolUse hooks); parameterized `os-init spor` writes the self-check table; independent semver via changesets + release chain; emit products are committed (fresh-clone resolvable) with `--check` CI drift detection (including stale committed products).
