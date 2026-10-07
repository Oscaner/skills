#!/usr/bin/env node
// src-next/bin.ts — the P3.2 new-tree CLI entry. The whole command tree, the parse
// face and the run bodies live in face/cli.ts (T11 — the composition root); this
// file only boots it: pass the raw argv to the composed `cli`, exit by its code.
// The dev face runs this source directly under Node >=22.18 (native type stripping);
// the published artifact runs the tsc-emitted dist/bin.js. Unconditional boot — this
// artifact is only ever executed as the CLI entry, never imported.
import process from "node:process";

import { cli } from "./face/cli.ts";

const exitCode = await cli().runArgv(process.argv.slice(2));
process.exit(exitCode);
