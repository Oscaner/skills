# Third-Party Dependencies

> **Reader positioning:** maintainer-only document for this monorepo's developers (not shipped — the package `contentRoot` is `"."`, so only `packages/*/` publishes); English-primary, no zh-CN mirror.

> **Scope & principle (spec §2.13):** use a maintained third-party package instead of maintaining the equivalent by hand. This repo maintains only the CDD functional logic; everything generic (git protocol, YAML syntax, template substitution, CLI parsing, hook orchestration, logging, build) is delegated to an adopted package. Every adopted package is registered below with its purpose, version constraint, the hand-written surface it replaced, and the anchor to check when upgrading or refactoring. The **not-adopted** list at the bottom exists to prevent future re-adoption mistakes. **P3.2 cutover (§4):** the shell-strip pruned the old engine's runtime stack (eight packages) — the rebuilt `src-next` tree implements every one of those seams with `node:` builtins and typed constant data, so the published dependency contract shrank to a single runtime package.

## 1. Adopted packages

| Package | Version (declared / lockfile) | Purpose | Replaced hand-written surface | Maintenance anchor |
|---|---|---|---|---|
| `simple-git` | `^3.36.0` (cdd-engine dependency + lockfile) | git operations (status / add / commit / log / rev-parse / toplevel) | hand-written `execFileSync("git")` helpers in the old commit contract (toplevel / rev-parse HEAD / cat-file / status `--porcelain`) plus scattered git calls in the old brief/artifacts surfaces | `packages/cdd-engine/src-next/infra/git.ts` — `GitClient`, the new tree's single git seam (fail-open over simple-git). The residue guard bans `execFileSync("git")` imports per |

The **repo toolchain** (root devDependencies) adopts the development gates, never shipped: `@biomejs/biome` (`^2.5.15` — format + lint gate, `biome check` with no-fix semantics), `husky` (`^9.1.7` — git hooks at the repo root), `lint-staged` (`^17.6.0` — the staged-task runner the pre-commit hook invokes), `typescript` (`^7.0.2` — the single TS toolchain; `tsc -p tsconfig.build.json` emits the published `dist/` and the dev face runs the `.ts` sources directly under Node ≥22.18 native type stripping; the TS6-compat shim retired with the old build chain), `vitest` (`^5.0.3` — the test runner over the colocated `src/**/__tests__/**/*.test.ts` / `scripts/**/__tests__/**/*.test.ts` suites; the engine's `.mjs` plane is zero, residue-guard pinned), `@types/node` (`^26.6.4`), and the `@changesets/*` family (`pnpm changeset` creates a changeset; `changeset version` applies them — run natively by the release workflow, the DIY version entry is retired). These never ship to consumers.

## 2. YAML isolation boundary

`yaml` is the single adopted package with a hard isolation rule — decided in spec §2.13 (option (b): isolate rather than grow the plugin's dependency set):

- **Only one module consumes it:** `scripts/emit.ts` (the `renderIssueYml` face), an **emit-only** module — its only runtime consumers are the emit orchestrator at emit time (the `.github/ISSUE_TEMPLATE/*.yml` emitter) and tests.
- **It lives only in the repo root `devDependencies`** (emit toolchain) — never in any shipped package's `dependencies`; it did not ship before, and the P3.2 engine rebuild does not change that (the engine consumes no YAML).
- **The consumer runtime carries zero third-party dependencies:** the aggregate-body renderer — cdd-engine's `IssueReportRenderer` (`cdd issue render`: stdin JSON → aggregate body → stdout) — **must not import `yaml`**: the form YAML is produced at emit time, so no consumer path touches it, and cdd-engine's dependency list has no `yaml`.
- **It is forbidden to publish `yaml` as a kairos or cdd-engine runtime dependency.**
- **Enforcement:** the emit colocated suite (`scripts/__tests__/emit.test.ts`) asserts `renderIssueYml`'s byte golden and the single-source enum injection; the engine colocated suite covers the renderer determinism; the residue guard keeps the retired renderer vocabulary at zero across the mechanism positions.

## 3. Husky boundary

`husky` stays a **repo-root devDependency only** — it gates this repo's pre-commit via `prepare` and never enters any package:

- Registry consumers do not run a dependency's `prepare` (npm runs it only for git dependencies and the root project; pnpm blocks install lifecycle scripts by default).
- Even when it would run, `prepare` mutates the consumer's `.git/hooks` — a security anti-pattern.
- The engine's lifecycle is runtime JS (dispatch), not git hooks; consumer-side hooks fire naturally through git when the engine commits via `simple-git`.
- **Current pre-commit line:** `.husky/pre-commit` runs `pnpm exec lint-staged`; lint-staged runs `biome check` on the staged TS set (no-fix semantics — a surviving violation exits non-zero and aborts the commit) plus a `*` catch-all that runs `pnpm run precommit` (the tree-independent validate subset) once per commit.

## 4. Retired at the P3.2 shell-strip: the old engine runtime stack

The P3.2 cutover rebuilt the engine as a five-plane OOP tree (`src-next/`, T1–T26) and **pruned the entire old runtime dependency stack** — the new tree imports exactly one runtime package (`simple-git`). Every retired package's seam was re-implemented with `node:` builtins and typed constant data, so the reduction is structural, not deferred:

| Package (pruned) | Declared version (pre-strip) | Old seam | P3.2 replacement |
|---|---|---|---|
| `commander` (retired earlier, P5) | — (removed, P5) | the pre-P5 CLI framework | replaced by `citty`, then by the new tree's typed argv channel + hand-rolled parse (see below) — do not re-add |
| ~~`unbuild`~~ (retired) | — (removed, P5) | TS build + dev stub — the old build chain, retired with the P5 zero-build convergence | `tsc -p tsconfig.build.json` is the single emit tool |
| `citty` | `^0.2.2` | CLI parsing (`scripts/run.ts` command tree, old `src/cli/parse.ts`) | `scripts/run.ts` is a `process.argv[2]` switch; the engine's `face/cli.ts` `runArgv` owns the steady exit-code table (0 = OK incl. `--help`, 1 = command failure, 2 = usage/parse) over the `ARGV_CHANNEL` data rows |
| `consola` | `^3.4.2` | structured logging | engine output is the single status capsule + `CDD_BLOCKED:` stderr channel, written directly to `process.stdout`/`stderr` |
| `execa` | `^10` / 10.0.1 | process spawning | `node:child_process` `spawnSync`/`execFileSync` in the dispatch/infra seams (the harness-cli spawn) |
| `handlebars` | `^4.7.9` | `{{X}}` template rendering | `TemplateAssembler` over the typed template-contract data (`render/templates.ts`) — the same `{{X}}` spelling, hand-rolled interpolation, zero template library |
| `hookable` | `^6.1.2` | `dispatch:before`/`dispatch:after` hook registry | the lifecycle is a typed phase table + abstract base class in `session/run.ts` — no hook registry |
| `ajv` | `^8.20.0` | handoff JSON Schema validation | handoff validation is the typed writable-subset schemas + structural guards (`session/handoff-schema.ts`) |
| `semver` | `^7.8.5` | version comparison | released version math lives in native `changeset version`; the release-plugin matrix compares git-tag vs package.json with a pure-shell numeric compare (its job runs on a bare checkout) |
| `tinyglobby` | `^0.2.17` | glob traversal | the new tree walks explicit paths / `node:` fs reads (bounded traversal — no unbounded full-tree globs) |

The lockfile remnants are transitive only (`tinyglobby`, `commander` — dependencies of other packages), never direct declarations. `pnpm install --frozen-lockfile` stays green; do not re-add any row of this table for a capability the table says is now structural.

## 5. Not-adopted (registered so future work does not re-adopt)

| Package / approach | Why not adopted |
|---|---|
| `XState` | The engine already carries the converging state-machine semantics — Review Convergence, failure categories, quota isolation — pinned by the engine vitest suite. Adopting a state-machine library would overturn the convergence already present in the engine with destructive risk and zero benefit. |
| `tapable` / `emittery` | `tapable` is webpack-ecosystem-heavy for lifecycle orchestration; `emittery` is pub/sub, not phase ordering. The lifecycle is a typed phase table (`session/run.ts`), so no hook library is adopted. |
| alternate template engines (`ejs`, `nunjucks`) | the `{{X}}` spelling is rendered by the engine's own `TemplateAssembler` over typed data — a library would duplicate the assembler with zero churn saved. |
| `isomorphic-git` | pure-JS / browser-oriented and maintenance-slowed; `simple-git` is the Node CLI-side standard. |
| `js-yaml` | weaker YAML 1.2 coverage; `yaml` chosen (zero deps, active maintenance, full test-suite). |
| `oclif` | strong TS, but plugin-manifest / auto-update conventions are overkill for a single-bin embedded engine. |
| `husky` as a package dependency | see §3 (Husky boundary) — root dev-only, never in a package. |

## 6. Boundary verification

The adopted surfaces are all generic infrastructure (git protocol / YAML syntax / template substitution / CLI parsing / logging / build). What remains hand-maintained is entirely CDD semantics: the dispatch lifecycle skeleton (abstract base class + phase table), the commit boundary, the wave gate, Review Convergence, and the handoff schema guards. When a task touches a generic capability it should first check §1/§4 — extend an adopted package or the structural replacement already in place, never reintroduce a pruned package.
