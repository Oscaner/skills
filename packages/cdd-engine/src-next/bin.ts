#!/usr/bin/env node
// src-next/bin.ts — the P3.2 new-tree CLI entry. The whole command tree, the parse
// face and the run bodies live in face/cli.ts (T11 — the composition root); this
// file only boots it: pass the raw argv to the composed `cli`, exit by its code.
// The dev face runs this source directly under Node >=22.18 (native type stripping);
// the published artifact runs the tsc-emitted dist/bin.js. Unconditional boot — this
// artifact is only ever executed as the CLI entry, never imported.
import process from "node:process";

// The environment pre-flight — the engine's `engines` floor (package.json#engines
// ">=22.18.0"). It is the first thing this module body runs and covers every
// configuration where the entry's JS actually loads — the published artifact (the
// tsc-emitted dist/bin.js, plain JS) on any below-floor Node, and dev-face setups
// that load the `.ts` entry behind the type-stripping flag while still below 22.18.
// On those surfaces it exits with a self-explaining message + exit 1 before the
// cli face loads — the cli is `await import`ed only after the check, so that
// ordering is real where reachable. It cannot cover the plain `node src-next/bin.ts`
// dev face on a below-22.18 Node: there the loader itself rejects the `.ts` entry
// (native type stripping), so no engine JS — including this guard — ever runs; that
// crash is inherent to a `.ts` entry on old Node. On the published artifact the
// guard is a no-op — floor-consistent, never over-strict.
const NODE_FLOOR = { major: 22, minor: 18 } as const;

function bootEnvironmentProblem(): string | null {
  const [major, minor] = process.versions.node.split(".").map((part) => Number.parseInt(part, 10));
  if (major < NODE_FLOOR.major || (major === NODE_FLOOR.major && minor < NODE_FLOOR.minor)) {
    return `cdd requires Node >= ${NODE_FLOOR.major}.${NODE_FLOOR.minor} (native type stripping) — installed: ${process.versions.node}`;
  }
  return null;
}

const environmentProblem = bootEnvironmentProblem();
if (environmentProblem !== null) {
  process.stderr.write(`${environmentProblem}\n`);
  process.exit(1);
}

// The CLI face — runArgv owns the usage-error normalization (exit code 0 / 1 / 2,
// the steady exit-code table); the boot wrapper only maps an unexpected
// composition-root load/crash to the message + exit 1, never an unhandled
// rejection. `await import` keeps the environment pre-flight ahead of the load.
try {
  const { cli } = await import("./face/cli.ts");
  const exitCode = await cli().runArgv(process.argv.slice(2));
  process.exit(exitCode);
} catch (raw) {
  process.stderr.write(`cdd: ${raw instanceof Error ? raw.message : String(raw)}\n`);
  process.exit(1);
}
