---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P4 — publishing architecture v2 (package-as-source) + gate surface ported to Node.

- Directory rework: `packages/` (first-party) + `vendors/` (upstream submodule sources: superpowers / mattpocock-skills / impeccable — never edited); `package.json#oscaner-plugin` is the single metadata source of truth (marketplace/source.json derived).
- pnpm workspace + changesets version and publish all `@oscaner-skills/*` packages together (vendored plugins republished via build-time assembly, upstream attribution preserved).
- Marketplace + harness manifests generated from packages; a future plugin = add a package directory, automatically wired into emit + publishing.
- Gate surface ported to Node: `cdd-gate-core` + thin CLI (single `gateDecide` implementation); 7 native-hook gate adapters (grok/qoder/trae/codex/gemini/vibe/kiro) + opencode/pi TypeScript adapters (shipped with the package); per-harness gate manifest wiring; ~800 lines of bash eliminated.
- The `os-init gates` concept landed (later superseded by the P6b `init harness` installer).