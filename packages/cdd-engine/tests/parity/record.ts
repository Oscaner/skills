// packages/cdd-engine/tests/parity/record.ts
// The corpus's recording step: read the live old tree once and write the baseline.
//
// Run it with `node --experimental-strip-types packages/cdd-engine/tests/parity/record.ts`.
// It is deliberately a script and not a test: recording is an act with a side effect,
// and a test that rewrote its own expectation would be a test that can never fail.

import { BASELINE_FILE, CORPUS, recordCorpus, writeBaseline } from "./harness.ts";

const baseline = await recordCorpus(CORPUS);
writeBaseline(baseline, BASELINE_FILE);
const recorded = Object.values(baseline.cells).filter((cell) => cell.value.length > 0).length;
process.stdout.write(`parity: recorded ${recorded} cells into ${BASELINE_FILE}\n`);
