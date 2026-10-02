---
"@oscaner-skills/kairos": patch
---

feat: kairos adopts ESM (`"type": "module"`) as the front of the P5 three-project typecheck gate.

- The package is now `"type": "module"` — the prerequisite for the kairos-test suite to typecheck under NodeNext (`import.meta` is otherwise TS1470) and the kairos side of the three-project `tsc --noEmit` gate landed in P5.
- Non-breaking: kairos ships a pure SKILL/plugin surface with no CJS runtime JS modules — the ESM front is forward-compatible and changes no consumer-facing behavior.
