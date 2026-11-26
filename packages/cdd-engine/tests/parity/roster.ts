// packages/cdd-engine/tests/parity/roster.ts
// The roster's rendering step: re-render `GRID-WIRING.md`'s table from the grid's own
// `UNITS` table, leaving the prose above it untouched.
//
// Run it with `node --experimental-strip-types packages/cdd-engine/tests/parity/roster.ts`.
// It is deliberately a script and not a test: rendering is an act with a side effect, and
// the suite pins the file to `rosterTable()` — so a stale table reds instead of drifting,
// and nobody has to hand-edit two hundred rows.

import { readFileSync, writeFileSync } from "node:fs";
import { rosterTable } from "./grid.ts";
import { ROSTER_FILE } from "./harness.ts";

/** The table's first line — the boundary between the prose and the rendering. */
const HEADER = "| cell | task | producer | route |";

const text = readFileSync(ROSTER_FILE, "utf8");
const start = text.indexOf(HEADER);
if (start === -1) throw new Error(`parity: ${ROSTER_FILE} carries no roster table`);

writeFileSync(ROSTER_FILE, `${text.slice(0, start)}${rosterTable()}\n`, "utf8");
process.stdout.write(`parity: re-rendered the roster in ${ROSTER_FILE}\n`);
