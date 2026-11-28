---
"@oscaner-skills/cdd-engine": patch
---

Flip the engine's release entry onto the rebuilt tree and retire the old one. The build target
(`tsconfig.build.json`'s `rootDir` / `include` / `exclude`), and with it the source the compiled
entry is built from, now reads `packages/cdd-engine/src/`; the publication face is unchanged —
`bin` still resolves `./dist/bin.js`, `main` / `exports` still name it, and `files` still ships
`dist/` and `templates/`. The parallel tree the rebuild grew beside it is deleted whole — so the
four slices (`env/` · `docs/` · `run/` · `surface/`) are the only tree the published binary is
compiled from. The flip moves no consumer byte: every command, flag, rendered line and refusal the
engine prints is the one the old tree printed, and the parity reconciler held that account
until the reconciliation corpus and its harness were retired in the same step. The declared
changeset level is `patch` for that reason — only the release entry and the build target
move here; the consumer-facing byte moves ride the phase's `minor` declarations, not this
one.
