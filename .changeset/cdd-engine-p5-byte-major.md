---
"@oscaner-skills/cdd-engine": major
---

feat: the P5 byte-semantics major (breaking) — the schema surface merges `gen` into `get` with a dual `--output` render face, the CLI entry converges on a single `Cli.create` composition root, smoke relocates into the engine test plane, and the validation checks move into the package test planes:

- **`schema gen` folds into `schema get`** (breaking) — `cdd schema get <type>` now carries both render faces: `--output json` (the default) prints the doc-structure schema declaration to stdout with no target, and `--output skeleton <target>` renders the scaffold directly into the target document (filled in place, zero intermediate files, target required and precisely validated). The unconstrained shell-redirect face (`schema gen <type> > <path>`) is structurally gone — the target is now an engine-declared, validated argument; the `schema gen` leaf leaves the command tree and the did-you-mean candidates update with it.
- **Composition root** — the engine entry converges on `Cli.create().runArgv(...)`, a single composition-root factory (NodeEnvGuard + zero bare module-level functions in the engine and scripts sources including the test face).
- **Smoke entry** — smoke-cdd moves into the engine test plane (`pnpm -C packages/cdd-engine run smoke`); the release gates re-point at the engine smoke entry; the `--expect-version` flag is removed.
- **Validation governance** — the root `scripts/` surface loses its validation logic: channel / handoff / word-surface checks land in their colocated package test planes (engine vitest for channel/handoff, kairos suite for anatomy/word faces), the root `GuardLibrary` / `validate.ts` runners dissolve, and the engine stays the single source for the lexicons / anatomy contract / channel declarations with zero parallel implementations.
