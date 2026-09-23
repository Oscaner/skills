# @oscaner-skills/cdd-engine

[English](README.md) | [Simplified Chinese](README.zh-CN.md)

CDD engine CLI — the task runner, document/branch reviewer, and harness dispatcher behind the osuperpowers `cli-driven-development` skill. Published as a standalone package so the engine (`cdd`) can be installed and invoked on its own.

## What this package is

The engine runs the implement / review / fix phases of the CDD workflow against a plan file, writes the dispatch's handoff artifacts, reads and writes the `base-branch` artifact, and dispatches each phase to the host harness CLI through its embedded harness registry. It is consumed by the [osuperpowers plugin](https://www.npmjs.com/package/@oscaner-skills/osuperpowers)'s `cli-driven-development` skill and is also usable directly from the command line.

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

`cdd help` prints the engine's resource-discovery paths: the CLI entry directory, the document-schema directory (spec/plan authoring schemas), and the template root.

| Subcommand | Usage | Purpose |
|------------|-------|---------|
| `implement` | `cdd implement --task=<n> [--plan=<path>]` | Run the task implement phase |
| `review` | `cdd review --type=<task\|branch\|spec\|plan>` | Run a review — task, branch, spec, or plan |
| `fix` | `cdd fix --type=<task\|branch\|spec\|plan>` | Fix review findings — task, branch, spec, or plan |
| `base-branch` | `cdd base-branch set\|get` | Read/write the `base-branch.json` artifact (single CDD `--plan` target) |
| `help` | `cdd help` | Print CLI + doc-resource directory discovery (schemas/templates) |

Use `cdd <command> --help` for a command's full option list (for example `cdd review --task` / `--base` / `--head` / `--spec` / `--round`).

## Development

The package lives in the [Oscaner/skills](https://github.com/Oscaner/skills) monorepo at `packages/cdd-engine` (TypeScript, built with unbuild, tested with vitest; tests are colocated at `src/**/__tests__/**/*.test.ts`).

```bash
pnpm --filter @oscaner-skills/cdd-engine dev:stub   # rebuild the jiti immediate-load dev stub
node packages/cdd-engine/dist/cli.mjs help          # invoke the engine from the working tree
pnpm --filter @oscaner-skills/cdd-engine test       # run the engine test suite
```

During repository development the engine is invoked straight from the working tree (`dist/cli.mjs`) — never through a global install or link, which can go stale.

## License

MIT
