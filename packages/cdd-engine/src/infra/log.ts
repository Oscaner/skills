// packages/cdd-engine/src/infra/log.ts — unified logging exit via consola (spec §2.13 log row).
// New dependency point for ALL logging in rebuilt infra: consumers import `log` and go through
// consola (level-gated, structured), never console.* scatter. Replaces the repo's ad-hoc stderr
// writes on the rebuild path; the old .mjs callers are re-pointed by Task 5/8, this task only
// builds the point.
import { createConsola } from "consola";

export const log = createConsola({ level: 3 });

/** Raise/lower the shared log threshold (consola levels: 0 silent … 4 verbose). */
export function setLogLevel(level: number): void {
  log.level = level;
}
