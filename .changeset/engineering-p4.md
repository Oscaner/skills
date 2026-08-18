---
"@oscaner-skills/engineering": patch
"@oscaner-skills/superpowers-overrides": patch
---

engineering P4 — publish architecture v2 + gate adapters + os-init. Migrated plugins to `packages/` + `vendors/` layout with `package.json#oscaner-plugin` metadata as source of truth; `scripts/emit.mjs` unified emitter derives `marketplace/source.json` and all harness manifests (`.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`, `.qoder-plugin/`, gemini, pi, `.agents/skills/`). Per-harness hooks registration via `oscaner-plugin.hooks`. Vendors assembly republish via `publish-vendor.mjs` with `listVendors` auto-discovery. Unified changesets publish for first-party packages.

Gate adapters: Node `cdd-gate-core` + thin CLI (`gateDecide` semantics port); 7 native-hook gate adapters (grok/qoder/trae/codex/gemini/vibe/kiro); opencode/pi TypeScript gate adapters; per-harness gate manifest wiring (qoder/codex/gemini/pi/opencode). Engineering bin reorganized into `engine/` + `gate/` skeleton.

os-init: skills split — thin dispatcher + `spor.md` + `gates.md`; per-harness gate installer + trae/vibe/kiro/grok config templates; consumer channel honesty (verified vs experimental) with pi/codex channels + trust steps.

superpowers-overrides: prompt-expansion/cursor router migrated to Node; hooks JSON schema hardened (reject `..`-escape segments, dedupe via `$def`); `harnessHooks` schema extended to codex/qoder + hidden-dir path pattern.