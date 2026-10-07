#!/usr/bin/env node
// src-next/bin.ts — the P3.2 new-tree CLI entry. The whole command tree, the parse
// face and the run bodies live in face/cli.ts (T11 — the composition root); this
// file only boots it: pass the raw argv to the composed `cli`, exit by its code.
// The dev face runs this source directly under Node >=22.18 (native type stripping);
// the published artifact runs the tsc-emitted dist/bin.js. Unconditional boot — this
// artifact is only ever executed as the CLI entry, never imported.
import process from "node:process";

import { cli } from "./face/cli.ts";

// The environment pre-flight — the engine's `engines` floor (package.json#engines
// ">=22.18.0"): below it the dev face's `./face/cli.ts` import itself fails to
// type-strip, so the guard runs BEFORE the cli load and exits with a
// self-explaining message instead of a Node parse crash. The published artifact
// (the tsc-emitted dist/bin.js) is plain JS, where the guard is a no-op — the check
// is floor-consistent, never over-strict.
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
// composition-root crash to the message + exit 1, never an unhandled rejection.
try {
  const exitCode = await cli().runArgv(process.argv.slice(2));
  process.exit(exitCode);
} catch (raw) {
  process.stderr.write(`cdd: ${raw instanceof Error ? raw.message : String(raw)}\n`);
  process.exit(1);
}
