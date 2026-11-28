// packages/cdd-engine/src/env/process/clock.ts
// The clock: the ONE place in `src/**` that reads the system time.
//
// Three capabilities, each a separate fact — deliberately not one sliced out of
// another:
//   · `now()`     — the current instant (epoch ms). Every artifact timestamp and every
//                   sampling cell comes from an injected `Clock`, never from a bare
//                   `Date.now()` in the slice that needs the time.
//   · `isoOf(e)`  — epoch → the UTC ISO form (`toISOString`'s byte face). The capsule's
//                   `started:` line and every recorded instant print through this.
//   · `dayOf(e)`  — epoch → the LOCAL calendar day (`YYYY-MM-DD`, the local-getter
//                   form). The skeleton's `date:` line is a local day, and on a machine
//                   whose UTC offset is not zero the local day and the UTC slice of the
//                   same epoch differ by one at the day boundary — which is exactly why
//                   `dayOf` is its own reading instead of `isoOf(...).slice(0, 10)`.
//
// `new Date(epoch)` inside `isoOf` / `dayOf` is a FORMATTING read of a given instant, not
// a clock read: the epoch comes in as an argument, so those two stay pure and a frozen
// epoch yields the same bytes twice.

/** The epoch source the clock is constructed over — the system clock in production. */
export type EpochSource = () => number;

/**
 * Clock — the injected time face. Invariant: the only clock read is the source this
 * instance was constructed with, and both formatting faces are pure functions of the
 * instant they are handed.
 */
export class Clock {
  /** The epoch source — `Date.now` unless a pin injects a frozen one. */
  readonly #source: EpochSource;

  constructor(source: EpochSource = Date.now) {
    this.#source = source;
  }

  /** The current instant (epoch ms) — the one reading. Bound at construction, so
   *  `clock.now` can be handed straight to a collaborator that wants `() => number`. */
  readonly now: EpochSource = () => this.#source();

  /** One instant as its UTC ISO form — the byte face of `toISOString`. */
  isoOf(epoch: number): string {
    return new Date(epoch).toISOString();
  }

  /** One instant as its LOCAL calendar day (`YYYY-MM-DD`) — the skeleton `date:` face. */
  dayOf(epoch: number): string {
    const at = new Date(epoch);
    const month = String(at.getMonth() + 1).padStart(2, "0");
    const day = String(at.getDate()).padStart(2, "0");
    return `${at.getFullYear()}-${month}-${day}`;
  }
}
