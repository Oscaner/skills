// packages/cdd-engine/src/infra/log.ts — unified logging exit via consola (spec §2.13 log row).
// New dependency point for ALL logging in rebuilt infra: consumers import `log` and go through
// consola (level-gated, structured), never console.* scatter. Replaces the repo's ad-hoc stderr
// writes on the rebuild path; the old .mjs callers are re-pointed by Task 5/8, this task only
// builds the point.
// P6 T24 D (dead code): ZERO production consumers — the rebuilt engine surfaces diagnostics
// through the exit helpers (stderr + ExitRequested / CddExitError family), not the consola pipe.
// Keep as a MAINTAINER-ONLY seam: infra tooling / ad-hoc debugging may import `log`/`setLogLevel`
// without claiming production ownership; do NOT re-wire the dispatch paths onto it (the stderr
// contract is pinned by the CLI black-box assertions).
import { createConsola } from "consola";

export const log = createConsola({ level: 3 });

/** Raise/lower the shared log threshold (consola levels: 0 silent … 4 verbose). */
export function setLogLevel(level: number): void {
  log.level = level;
}
