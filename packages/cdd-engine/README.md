# @oscaner-skills/cdd-engine

[English](README.md) | [中文](README.zh-CN.md)

CDD engine CLI — the task runner, document/branch reviewer, and harness dispatcher behind the kairos `cdd-dev` skill. Published as a standalone package so the engine (`cdd`) can be installed and invoked on its own.

## What this package is

The engine runs the implement / review / fix phases of the CDD workflow against a plan file, writes the dispatch's handoff artifacts, reads and writes the `base` artifact, and dispatches each phase to the host harness CLI through its embedded harness registry. It is consumed by the [kairos plugin](https://www.npmjs.com/package/@oscaner-skills/kairos)'s `cdd-dev` skill and is also usable directly from the command line.

## Installation

Requires Node.js `>= 22.12.0`.

```bash
# global CLI (provides the `cdd` binary)
npm install -g @oscaner-skills/cdd-engine

# or as a dependency
npm install @oscaner-skills/cdd-engine
```

## CLI

Global option: `--dry-run` — simulate the dispatch without writing handoff artifacts.

| Subcommand | Usage | Purpose |
|------------|-------|---------|
| `implement` | `cdd implement --tasks=<n> [--plan=<path>]` | Run the task implement phase |
| `review` | `cdd review --type=<task\|branch\|spec\|plan>` | Run a review — task, branch, spec, or plan |
| `fix` | `cdd fix --type=<task\|branch\|spec\|plan>` | Fix review findings — task, branch, spec, or plan |
| `base` | `cdd base set\|get` | Read/write the `base.json` artifact (single CDD `--plan` target) |
| `schema` | `cdd schema get <type>` | Print the canonical doc-structure schema (discovery-only, zero enforcement) |
| `issue` | `cdd issue render` | Render an aggregate issue body from stdin findings (pure rendering, zero enforcement) |

Use `cdd <command> --help` for a command's full option list (for example `cdd review --tasks` / `--base` / `--head` / `--spec` / `--round`).

## Development

The package lives in the [Oscaner/skills](https://github.com/Oscaner/skills) monorepo at `packages/cdd-engine` (TypeScript, emitted with `tsc -p tsconfig.build.json`, tested with vitest; tests are colocated at `src/**/__tests__/**/*.test.ts`).

```bash
node packages/cdd-engine/src/bin.ts schema get plan # invoke the engine source-direct from the working tree (Node ≥22.18 native type stripping)
pnpm --filter @oscaner-skills/cdd-engine test       # run the engine test suite
pnpm --filter @oscaner-skills/cdd-engine build      # tsc-emit the published dist/bin.js
```

During repository development the engine is invoked straight on the source entry (`node packages/cdd-engine/src/bin.ts`) — never through a global install or link, which can go stale.

## License

MIT
