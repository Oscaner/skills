// packages/cdd-engine/src-next/contract/wave-width.ts
// P22 T8 — the wave-width ceiling's ONE declaration (design spec §6): a wave may carry
// at most three tasks. Three readers share this single value — the plan-scope rule
// (`wave-width-at-most-three`), the dispatch face's two hard rejections
// (`wave-too-wide` / `too-many-tasks`) and their wording — so changing the limit here
// changes all of them at once.
//
// The value lives on the contract plane (not in `session/`) so the rule surface can read
// it without importing the session plane: the direction is session → contract, never the
// reverse. `session/next.ts` re-exports it as the dispatch face's constant, beside
// `REVIEW_CYCLE_CAP`.
//
// Module-level exports are the constant — zero behavior-carrying bare functions.

/** The wave-width ceiling — the most tasks one dispatch wave (one task layer) may carry. */
export const MAX_TASKS_PER_WAVE = 3;
