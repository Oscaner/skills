# AGENTS.md

Guidance for coding agents in this repository. `CLAUDE.md` is a symlink to this file — edit this one.

**A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.**

## What this repository is

The home of **CDD (continuously-discovered development)** and the vehicle that distributes it: the practice encoded as skills and driven by the `cdd` engine, released as installable plugins for Claude Code and pi. The marketplace is **Package-as-source** — each `package.json#oscaner` is the single source of truth for its plugin, and every consumer manifest is derived from it.

- `packages/kairos/` — **first-party plugin**, in-tree: the `cdd-*` skill family plus the engine.
- `packages/cdd-engine/` — the eight-command `cdd` CLI: implement / review / fix / base / schema / issue / board / init.
- Superpowers and mattpocock-skills are **upstream third-party** plugins — never vendored here; they install via their own official commands. kairos orchestrators reference their skills as `/`-prefixed `plugin:skill` names.

## Toolchain

- **Node 26** — `.nvmrc` says `v26` and `.github/actions/setup/action.yml` defaults to `26`. Managed by **fnm**: run `fnm use` before `node`/`pnpm` when `.nvmrc` is present. Never suggest nvm.
- **pnpm 12.18.0** — pinned by `package.json#packageManager` (corepack honours it); CI installs with `--frozen-lockfile`.

## Layout and package boundaries

| Path | Owns |
|---|---|
| `packages/kairos/skills/` | the six skills (`cdd-close` · `cdd-design` · `cdd-dev` · `cdd-plan` · `cdd-report` · `cdd-spec-writer`) — `SKILL.md` + optional `docs/` |
| `packages/kairos/tests/` | the kairos suite (skill anatomy, word faces, behaviour trees, pi-package contract) |
| `packages/cdd-engine/src/` | engine source: four slices `docs/` `env/` `run/` `surface/` + `bin.ts` (composition root) |
| `packages/cdd-engine/src/<slice>/__tests__/` | engine tests, colocated per slice |
| `packages/cdd-engine/templates/report/` | shipped templates, incl. `issue-body.json` — the **only** source of the repo's issue forms |
| `scripts/` | repo automation: `run.ts` (emit / emit-check / version-sync), `emit.ts`, `lib/`; tests in `scripts/__tests__/` |
| `docs/kairos/{overalls,specs,plans}/` | internal program docs (Chinese) |
| `docs/diagrams/` | bilingual diagrams — see below, the HTML is generated |
| `.changeset/` | release declarations; `.changeset/README.md` is the authoritative release reference |

Per-package docs: [`packages/kairos/README.md`](packages/kairos/README.md), [`packages/cdd-engine/README.md`](packages/cdd-engine/README.md), [`.changeset/README.md`](.changeset/README.md), [`docs/diagrams/README.md`](docs/diagrams/README.md).

## Commands

```bash
pnpm install --frozen-lockfile   # CI form; plain `pnpm install` locally

pnpm run validate                # the full gate — the one command that must pass before a PR
pnpm run precommit               # tree-independent subset (what the pre-commit hook runs)
pnpm run biome                   # lint + format check (no writes)
pnpm run biome:fix               # apply formatting fixes
```

`validate` = `emit:check` → root vitest → kairos suite → engine suite → typecheck ×3 → `check:dist-smoke` → `version-sync` → `check:no-bare-functions`. `.github/workflows/pr-validate.yml` runs those same commands as one CI job per check.

### Focused verification (use these while iterating)

```bash
pnpm exec vitest run scripts/__tests__/emit.test.ts              # one root test file
pnpm -C packages/cdd-engine exec vitest run src/surface/words/__tests__/words.test.ts
pnpm -C packages/kairos exec vitest run tests/skill-anatomy.test.ts
pnpm exec tsc --noEmit -p packages/cdd-engine                    # also -p scripts, -p packages/kairos/tests
pnpm run emit:check                                              # generated products are fresh
pnpm -C packages/cdd-engine build                                # tsc → dist/ (gitignored, publish artifact)
pnpm run check:dist-smoke                                        # build + one command out of dist/
pnpm -C packages/cdd-engine run smoke                            # engine black-box smoke
```

**Trap:** bare `pnpm exec vitest run` at the root covers **only `scripts/**/__tests__/**`** (see `vitest.config.ts`). The engine and kairos suites are separate vitest projects and need the `-C` forms.

**Trap:** the suites run **source** through esbuild, so anything `tsc` re-shapes on the way to `dist/` is invisible to them. `check:dist-smoke` builds and runs one command out of `dist/` for exactly that class of defect — a construct the source accepts and the emitted JavaScript does not.

Prerequisites: the kairos suite hard-fails without the pi binary — `npm i -g @earendil-works/pi-coding-agent@latest` (CI installs it for that job). The engine suite's black-box dispatch tests are **dirty-tree incompatible**: they are excluded from `precommit` and are meant for CI or a clean working tree.

### Using the engine from this repo

Call the local source, never the published lag:

```bash
node packages/cdd-engine/src/bin.ts <subcommand> [flags]
```

Kairos skills invoke `npx -y @oscaner-skills/cdd-engine@latest <subcommand>` — that form is for **consumers** and trails the in-repo tree. Read the **full** stdout/stderr of any engine call: the engine truncates its own output, so filtering it is forbidden.

## Generated files — do not edit

`pnpm run emit` owns these; editing them by hand is always wrong (the next emit overwrites it, and CI fails on drift):

| Generated | From |
|---|---|
| `.claude-plugin/` (whole dir) | first-party `package.json#oscaner` rows |
| `packages/kairos/.claude-plugin/plugin.json` | `packages/kairos/package.json` |
| `marketplace/source.json` | the derived first-party registry |
| `.github/ISSUE_TEMPLATE/{bug_report,enhancement}.yml` | `packages/cdd-engine/templates/report/issue-body.json` |

Hand-maintained neighbours (safe to edit): `marketplace/README.md`, `marketplace/source.schema.json`.

Also generated / off-limits: `packages/cdd-engine/dist/` (build output, gitignored), `docs/diagrams/*.html` (and the Archify gate receipts, gitignored — machine-specific). Regenerate diagrams with `pnpm run emit` — the same batch as every other generated product, rendered from `docs/diagrams/src/*.json`; [`docs/diagrams/README.md`](docs/diagrams/README.md) carries the manual `archify finalize` full-gate command. Never hand-edit the HTML.

**Re-emit triggers:** any first-party `package.json#oscaner` or version change, a change to `packages/cdd-engine/templates/report/issue-body.json`, or a change to `docs/diagrams/src/*.json` → `pnpm run emit`, then commit the result. `pnpm run emit:check` is the gate (exit 1 on drift).

No hand-written version literals in shipped docs: the README plugin table must not carry a version (a kairos-suite probe enforces it). Version single source = `package.json` → emit products → npm.

## Conventions not enforced by the formatter

- **Tests measure the engine, never our own documents (D101).** A test asserts what the engine does to a fixture it owns — never the state of this repository's `docs/kairos/**`, the material the engine consumes in a real CDD run.
- **Why the corpus arm is forbidden:** a gate run over our own specs and plans turns its misjudgment into a silent document edit, and the defect still ships to consumers. Keep a paired fixture instead: a rule owes the violation arm and the neighbour arm; the gate owes its single zero-candidate producer. The roster of shape rows, and which row carries which arm, are attributed in decision D101 of `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`; this surface names the arms, not the roster.
- **Structure can be mechanized; content cannot — a mechanized content rule produces fake content.** A gate may judge a *relation between artefacts*: does it exist, is it unique, is it in order, is it derived from the table rather than typed. A gate may not judge whether a sentence is *true*: whether the symbol a sentence names exists, whether the number is right, whether the enumeration beside it lists the same members. Once a checker fixes on content, authors optimise for the checker instead of the truth — the fix rounds converge on the accepted spelling, the number gets corrected while the members it counts do not, and the gate confirms a sentence nobody verified. The exception proves the shape: **derivation**, not verification — do not check the typed value, remove the possibility of typing it (`CRITERIA_ROWS.length`, a count read off the registry, a field name emitted from the skeleton). And a structural gate may only cite structural facts: a field whose closed vocabulary declares that an execution face exists is doing a content judgment in structural clothing once that face is gone.
- **Generated-product consistency belongs to `emit:check` alone** — a test that compares committed products duplicates that gate and drifts from it.
- **Boundary, drawn by consumer rather than by path:** retired from test assertion is `docs/kairos/**` only; the README family, this file, `marketplace/source.json`, `packages/kairos/skills/` and the generated products are byte-level consumer surfaces and stay under their probes. The ruling and its measured account live in decision D101 of `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`.
- **No module-level bare functions.** `check:no-bare-functions` greps `^(export )?(async )?function ` across `packages/cdd-engine/src`, `packages/kairos/tests` and `scripts`. Write classes (state + behaviour) or arrow consts; a genuinely static surface carries `// biome-ignore lint/complexity/noStaticOnlyClass: <one-line reason>` (precedent: `src/bin.ts`, `scripts/run.ts`).
- Biome is the formatter/linter (`biome.json`): 2-space, width 100, recommended preset, `noNonNullAssertion` and `noExplicitAny` off. The pre-commit hook runs `biome check` **without** `--write`, so format before committing — `biome:fix` is a manual self-check, the hook never calls it.
- **Consumer-surface purity (iron rule).** Every file that ships to harness consumers — `SKILL.md` and skill `docs/` — is an instruction document: no program history, no phase/issue numbers, no refactor rationale, no "why X was rejected". Such content belongs in `docs/kairos/`. The section-heading registry in `packages/cdd-engine/src/docs/identity/skill-anatomy.ts` is enforced strictly by `packages/kairos/tests/skill-anatomy.test.ts`, which fails any registry-external heading.
- **Language policy.** Skills and `docs/*.md` are **English-primary** with no `.zh-CN.md` mirrors. `docs/kairos/{overalls,specs,plans}/*.md` are internal specs and are written in **Chinese**. The only `.zh-CN.md` mirrors in the repo are the README family — root `README.zh-CN.md`, `packages/kairos/README.zh-CN.md`, `packages/cdd-engine/README.zh-CN.md` — each kept in sync with its English twin.
- **No session memory.** Never write to `~/.claude/projects/<repo>/memory/` or any per-user store. Durable lessons go into `docs/kairos/` specs/plans.
- Reviewing from the post-publish consumer's standpoint matters: the consumer env has no monorepo layout and none of this repo's toolchain.

## Commit, PR, and release discipline

- Conventional commits (`feat:` · `fix:` · `docs:` · `chore:` · `test:`). No attribution, co-author, or AI-generation trailers.
- **Do not commit unless the user asks.** No `git worktree` — forbidden.
- `git add -f` on a gitignored path requires explicit user confirmation.
- Feature PRs target **`develop`**; releases flow `develop → main` → Version PR → publish. `.changeset/README.md` is the authoritative flow, including the six hard-won `release.yml` / npm-auth constraints — read it before touching release wiring.
- **Changeset obligation:** after changing behaviour or wiring under `packages/kairos/` or `packages/cdd-engine/`, add a changeset (`pnpm run changeset`, or a hand-written `.changeset/<slug>.md`). Level criterion (D74): the version tracks the **methodology contract**, not byte-level CLI compatibility — a consumer-visible breaking byte change (flag, `--type` word, rendered literal) is still **minor**; `major` is effectively reserved for a change to the methodology itself and is **machine-banned** by `scripts/__tests__/changeset-levels.test.ts`.

## Completion criteria

1. `pnpm run validate` exits 0 (or the equivalent CI jobs are green).
2. `pnpm run emit:check` reports fresh — emits regenerated and committed if a trigger was touched.
3. A changeset exists when a first-party package's behaviour changed.
4. No generated product, diagram HTML, or `dist/` artifact was hand-edited.
5. Nothing from the "must not" list above landed in a shipped skill file.
