# gate/

Node CDD gate surface (P4b). Self-contained: decision core + adapters + configs + tests.

- `cdd-gate-core.mjs` — Node gate decision core (`gateDecide`), harness-agnostic pure function.
- `cdd-gate-decide.mjs` — thin JSON CLI (stdin JSON → stdout JSON), the stable external/P5 contract.
- `adapters/` — one adapter per harness (`claude`/`cursor`/`grok`/`qoder`/`trae`/`codex`/`gemini`/`vibe`/`kiro`/`opencode`/`pi`). Each parses the harness hook JSON into `{toolName, toolInput, sessionKey}`, calls `gateDecide`, and renders the harness-native deny/allow response. Adapters never reach inside the core.
- `configs/` — native hook-config templates for harnesses with no package channel (`trae`/`vibe`/`kiro`/`grok`), plus install fragments (`opencode.json` plugin row, `pi/` package-key reference). Installed to the machine by `os-init gates`.
- `tests/` — `node:test` fixtures: core semantics + one per adapter + config parse (`configs-parse.test.mjs`).

Install per harness → [`docs/gate-install.md`](../../../../docs/gate-install.md).
