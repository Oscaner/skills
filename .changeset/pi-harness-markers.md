---
"@oscaner-skills/cdd-engine": patch
---

feat: the host-marker domain lands in the engine's harness contract — per-harness `detect` data (`AI_AGENT` / `CLAUDE_CODE_SESSION_ID` / `CURSOR_TRACE_ID`, plus the `PATH` channel) — and a three-way consistency guard pins it.

- **Harness contract `detect` data** — `config/harness-contract.json` carries each harness's host-detection semantics: `claude` (`CLAUDE_CODE_SESSION_ID` + `claude-code` prefix), `cursor` (`CURSOR_TRACE_ID`), `pi` (`AI_AGENT=pi`); the engine-config env whitelist declares the same keys plus `PATH`.
- **Three-way consistency guard** — `checkMarkers` (the detect direction of `checkHarness`) pins the contract against the `harness.ts detect()` predicates (identity closure + per-row env/prefix/value semantics) and the engine-config env whitelist; drift on any face is a validate finding.
