# @oscaner-skills/cdd-engine

[English](README.md) | [中文](README.zh-CN.md)

The `cdd` CLI — the task runner, document and branch reviewer, and harness dispatcher behind the kairos `cdd-dev` skill. Published standalone, so the engine can be installed and driven on its own.

## What this package is

The engine owns the mechanics a phase cannot be trusted to remember. It runs the implement / review / fix rounds of the CDD workflow against a plan, dispatches each round to the host harness CLI through its embedded harness registry, judges the round's terminal verdict, records it, and derives the next hop from the evidence rather than from the child's exit code. It also reads and writes the `base` artifact and renders the progress board. Consumed by the [kairos plugin](https://www.npmjs.com/package/@oscaner-skills/kairos)'s `cdd-dev` skill, and usable straight from a terminal.

## Installation

Requires Node.js `>= 24` (the CLI runs its TypeScript entry through native type stripping).

```bash
# global CLI (provides the `cdd` binary)
npm install -g @oscaner-skills/cdd-engine

# or as a dependency
npm install @oscaner-skills/cdd-engine
```

## CLI

Global option: `--dry-run` — preview the next dispatch step and the artifacts it expects, with zero repo writes and no round consumed (implement / review / fix / init).

| Subcommand | Usage | Purpose |
|------------|-------|---------|
| `implement` | `cdd implement --tasks=<n> [--plan=<path>]` | Run the task implement phase |
| `review` | `cdd review --type=<wave\|branch\|phase-spec\|overall\|plan\|single-spec>` | Run a review — wave, branch, phase-spec, overall, plan, or single-spec |
| `fix` | `cdd fix --type=<wave\|branch\|phase-spec\|overall\|plan\|single-spec>` | Fix review findings — wave, branch, phase-spec, overall, plan, or single-spec |
| `base` | `cdd base set\|get` | Read/write the `base.json` artifact (single CDD `--plan` target) |
| `schema` | `cdd schema get <type>` | Print the canonical doc-structure schema (discovery-only, zero enforcement) |
| `issue` | `cdd issue render` | Render an aggregate issue body from stdin findings (pure rendering, zero enforcement) |
| `board` | `cdd board --plan <path> / --spec <path>` | Render the entry document's progress board (overall/phase-spec/single-spec/plan/wave/branch; pure read, zero enforcement) |
| `init` | `cdd init --harness=<claude\|pi> [--update] [--include-recommends]` | Install or update the kairos plugin set for a harness (repo-independent, streams inherited) |

Use `cdd <command> --help` for a command's full option list (for example `cdd review --tasks` / `--spec` / `--plan` / `--round`).

### Review criteria

Each review target selects one criteria body:

| Target (`--type`) | Criteria body |
|-------------------|---------------|
| `wave`, `branch` (the node shapes) | the changed-surface axes — standards, spec, buildability, scope |
| `phase-spec`, `single-spec` (the spec-shaped documents) | the spec narrative body — URC, the writing-plans self-check, verification evidence, claim pins, program conformance |
| `plan` (the plan document) | the plan body — URC, spec conformance, verification evidence, claim pins |
| `overall` (the program charter) | the charter body — see below |

A charter is judged by charter criteria only: each phase's scope is a program increment, the Phase inventory and the dependency graph and the execution order agree, every acceptance cell is decidable when its phase closes, the Non-goals fence the program, the change record records decisions rather than work, and the inventory agrees with the tree. A charter review is never asked for implementation evidence — no typecheck or test-command run, no per-claim `path:line` pin. The two spec-shaped document targets share the one narrative body, so nothing is written twice.

### Fix dispositions

A fix round answers the requesting review handoff finding by finding: one disposition per finding, keyed by the finding's `summary` text verbatim and valued `{ "status": "fixed" | "rejected", "reason"?: "…" }` (`rejected` requires the reason). The map rides the round's own work carrier under `dispositions`. A missing slot, a key set that differs from the input set, a key outside it, an unreadable review handoff, or a `rejected` without a reason fails the round. The review handoff stays read-only apart from appending a ruling line to its `notes`; its `findings` are never rewritten.

### Wave width

A wave carries at most three tasks (`MAX_TASKS_PER_WAVE`), enforced as a hard gate with two named refusals: `wave-too-wide` when the derived open wave is wider than the ceiling, and `too-many-tasks` when `--tasks` names more than the ceiling. Both name the offending task ids. The engine never splits, truncates or reorders a wave — the repair is the plan's shape: chain the extra tasks through `DependsOn` so the dependency layers narrow. A plan review reports the same shape as `wave-width-at-most-three`, so the defect is visible before the first dispatch. A partially closed batch can widen the derived frontier across two layers; that shape meets the same `wave-too-wide` refusal, never a silent trim.

### Round logs

Every dispatched round (`implement` / `review` / `fix`) pipes the child's stdout and stderr into one append-only log file per round — `.kairos/cdd/<slug>/logs/<stem>.log` — and never echoes that output on the engine's own face. The name is the round's report stem, so a re-dispatch carries its `-a{attempt}` suffix and never overwrites the first attempt's log. `--dry-run` dispatches nothing, so it writes no log. When the round itself is rejected or cut short, its `CDD_BLOCKED` line on stderr names that round's log path: diagnosing one round is one file away instead of an outside `ps` read. A pre-flight refusal (dirty tree · in-flight · doc contract) names no log — no round was ever dispatched.

### Review-cycle soft cap

The soft cap is a budget, not a convergence rule: after `REVIEW_CYCLE_CAP` consecutive blocker cycles the engine stops suggesting the next hop and hands that decision to the user (`soft-cap`). Convergence itself is decided by the findings' grades alone — any blocker sends the line back to fix and then to a re-review, warn/nit-only findings are fixed and close without a re-review, and a review with zero findings approves.

## Migration

Document identity is the front-matter `slug:` key. This retired the file-name-derived identity: a **major breaking** change with **zero dual-read** — the retired keys are simply not read, and the retired entry form is not accepted.

- **Board entry is a document path.** `cdd board --plan <path>` / `cdd board --spec <path>` replace the retired positional-slug form.
- **Identity is declared, not derived.** A document is keyed by the `slug:` its front matter carries — the file name carries no identity meaning at all. The retired path keys are no longer read (leaving one in place is inert, not an error); a plan's program chain resolves through the identity document sharing its `slug:` — a phase-spec's `program:` names its overall, while an overall or single-spec is its own chain root.
- **Per-run workspaces follow the key.** The `.kairos/cdd/<slug>/` directory is keyed by the plan document's `slug:`. A directory left under a retired file-name-derived key is **not reused** by any run — no run resumes or migrates it. A reporting session's ledger scan still reads its records, so delete it by hand once you no longer need that history.

## Development

The package lives in the [Oscaner/skills](https://github.com/Oscaner/skills) monorepo at `packages/cdd-engine` (TypeScript, emitted with `tsc -p tsconfig.build.json`, tested with vitest; tests are colocated at `src-next/**/__tests__/**/*.test.ts`).

```bash
node packages/cdd-engine/src-next/bin.ts schema get plan # invoke the engine source-direct from the working tree (Node ≥22.18 native type stripping)
pnpm --filter @oscaner-skills/cdd-engine test       # run the engine test suite
pnpm --filter @oscaner-skills/cdd-engine build      # tsc-emit the published dist/bin.js
```

During repository development the engine is invoked straight on the source entry (`node packages/cdd-engine/src-next/bin.ts`) — never through a global install or link, which can go stale. The repository's own conventions (gates, generated files, commit discipline) are in [`AGENTS.md`](../../AGENTS.md).

## License

MIT
