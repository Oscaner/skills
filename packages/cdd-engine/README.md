# @oscaner-skills/cdd-engine

[English](README.md) | [中文](README.zh-CN.md)

CDD engine CLI — the task runner, document/branch reviewer, and harness dispatcher behind the kairos `cdd-dev` skill. Published as a standalone package so the engine (`cdd`) can be installed and invoked on its own.

## What this package is

The engine runs the implement / review / fix phases of the CDD workflow against a plan file, writes the dispatch's handoff artifacts, reads and writes the `base` artifact, and dispatches each phase to the host harness CLI through its embedded harness registry. It is consumed by the [kairos plugin](https://www.npmjs.com/package/@oscaner-skills/kairos)'s `cdd-dev` skill and is also usable directly from the command line.

## Installation

Requires Node.js `>= 24`.

```bash
# global CLI (provides the `cdd` binary)
npm install -g @oscaner-skills/cdd-engine

# or as a dependency
npm install @oscaner-skills/cdd-engine
```

## CLI

Global option: `--dry-run` — preview the next dispatch step and its expected artifacts — zero repo writes, no round consumed (implement/review/fix only).

| Subcommand | Usage | Purpose |
|------------|-------|---------|
| `implement` | `cdd implement --tasks=<n> [--plan=<path>]` | Run the task implement phase |
| `review` | `cdd review --type=<task\|branch\|spec\|plan>` | Run a review — task, branch, spec, or plan |
| `fix` | `cdd fix --type=<task\|branch\|spec\|plan>` | Fix review findings — task, branch, spec, or plan |
| `base` | `cdd base set\|get` | Read/write the `base.json` artifact (single CDD `--plan` target) |
| `schema` | `cdd schema get <type>` | Print the canonical doc-structure schema (discovery-only, zero enforcement) |
| `issue` | `cdd issue render` | Render an aggregate issue body from stdin findings (pure rendering, zero enforcement) |
| `board` | `cdd board --plan <path> / --spec <path>` | Render the entry document's progress board (overall/spec/plan/wave/branch; pure read, zero enforcement) |
| `init` | `cdd init --harness=<claude\|pi> [--update]` | Install or update the kairos plugin set for a harness (repo-independent, streams inherited) |

Use `cdd <command> --help` for a command's full option list (for example `cdd review --tasks` / `--spec` / `--plan` / `--round`).

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

During repository development the engine is invoked straight on the source entry (`node packages/cdd-engine/src-next/bin.ts`) — never through a global install or link, which can go stale.

## License

MIT
