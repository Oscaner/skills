---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P3 — thin router + superpowers-style emission.

- osuperpowers-router reduced to a **trigger router** (plugin-root, claude + cursor): manifest triggers → target table (`spor-*` → `os-*`/`cli-*`/mattpocock tdd), hooks/expansion/self-check point at `os-*`/`cli-*`; all `spor-*` skills deleted; numbered rule-reference mode retired.
- os-engineering = skills + engine + gate: gate fully migrated (PreToolUse hooks), `os-init` landed (parameterized), independent versioning.
- Unified emit tool (`pnpm run emit`): generates all first-party products from source.json — thin claude/cursor/codex/kimi/gemini/pi manifests pointing at `skills/` + GEMINI.md + shared `.agents/skills/` + router hooks/self-check + version sync.
- Dropped rovo/vibe/kiro native emission (no native installer; the gate surface was later restored in P4b).