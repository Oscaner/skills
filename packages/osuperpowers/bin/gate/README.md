# gate/

Node CDD gate surface (P4b). Self-contained: decision core + adapters + configs + tests.

- `cdd-gate-core.mjs` — Node gate decision core (`gateDecide`), harness-agnostic pure function.
- `cdd-gate-decide.mjs` — thin JSON CLI (stdin JSON → stdout JSON), the stable external/P5 contract.
- `adapters/` — one adapter per harness (`claude`/`cursor`/`grok`/`qoder`/`trae`/`codex`/`gemini`/`vibe`/`kiro`/`opencode`/`pi`). Each parses the harness hook JSON into `{toolName, toolInput, sessionKey}`, calls `gateDecide`, and renders the harness-native deny/allow response. Adapters never reach inside the core.
- `configs/` — native hook-config templates for harnesses with no verified package channel (`trae`/`vibe`/`kiro`/`grok`/`pi`), plus the `opencode.json` plugin-row install fragment. Installed to the machine by `init harness`. `pi/` is a manual-extension-copy shim — pi packages have a `pi` key, but the `.mjs` gate adapter can't be a `.ts` pi extension, so pi stays a manual copy (experimental).
- `tests/` — `node:test` fixtures: core semantics + one per adapter + config parse (`configs-parse.test.mjs`).

Install per harness → [`docs/gate-install.md`](../../../../docs/gate-install.md).
