// packages/cdd-engine/src/env/process/lock.ts
// The lock: the single holder of `proper-lockfile` in the tree.
//
// One `Lock` guards one target file. It answers a DECLARED value, never a throw:
// `acquired`, or `held` carrying whatever holder facts the caller can read. The holder
// facts come from an injected reader because they belong to the caller's own record —
// this file owns mutual exclusion, not the meaning of what sits under the lock.
//
// The stale window is a FINITE value larger than the longest dispatch budget (`stale:
// Infinity` pushes the library's default `update` to `Infinity`, which Node clamps to
// 1 ms of lock-touch churn for a whole dispatch). "Never steal automatically" is
// guaranteed by the caller's record + liveness criterion, never by the lock's duration:
// the lock is only mutual exclusion, and a lock left behind by a killed process is the
// caller's takeover decision.

import lockfile from "proper-lockfile";

/** The holder facts a refused acquisition reports — the caller's own record, read at
 *  the moment the lock was refused. The sentence a consumer prints is the dispatch
 *  face's (those bytes belong to the word table); this value is the fact it prints. */
export interface LockHolder {
  /** The holding process id. */
  readonly pid: number;
  /** The holding dispatch's command text. */
  readonly command: string;
  /** The holding dispatch's workspace slug. */
  readonly slug: string;
  /** The holding process's own start instant (epoch ms). */
  readonly startedAt: number;
}

/** One acquisition's answer: taken, or refused with the standing holder's facts. */
export type LockOutcome =
  | { readonly kind: "acquired" }
  | { readonly kind: "held"; readonly holder: LockHolder | null };

/** The holder reader — the caller's record read, injected so this file never parses
 *  the caller's file shape. */
export type LockHolderReader = () => LockHolder | null;

/**
 * Lock — one target's mutual exclusion. Invariant: at most one holder exists at a time,
 * and this instance holds at most one unlock, so `acquire` after `release` is the only
 * way back in.
 */
export class Lock {
  /** The stale window (ms) — finite, larger than the longest dispatch budget. */
  static readonly STALE_MS = 12 * 60 * 60 * 1000;

  /** The refresh interval (ms). */
  static readonly UPDATE_MS = 60 * 1000;

  /** The guarded file (absolute). */
  readonly #target: string;

  /** The holder reader the refusal reports through. */
  readonly #holderOf: LockHolderReader;

  /** The held unlock — present exactly between a successful acquire and its release. */
  #unlock: (() => Promise<void>) | null = null;

  constructor(opts: { target: string; holderOf?: LockHolderReader }) {
    this.#target = opts.target;
    this.#holderOf = opts.holderOf ?? (() => null);
  }

  /** Whether this instance currently holds the lock. */
  get held(): boolean {
    return this.#unlock !== null;
  }

  /** The guarded file's path — the caller's own coordinate, echoed for its report. */
  get target(): string {
    return this.#target;
  }

  /** Take the lock. One attempt, no retry: a dispatch that finds the tree held must
   *  report the holder now, never wait for it to leave. A failed acquisition leaves the
   *  target's bytes untouched. */
  async acquire(): Promise<LockOutcome> {
    if (this.#unlock !== null) return { kind: "acquired" };
    try {
      this.#unlock = await lockfile.lock(this.#target, {
        stale: Lock.STALE_MS,
        update: Lock.UPDATE_MS,
        realpath: false,
        retries: 0,
      });
    } catch {
      // The lock is held: read the standing holder (zero write) so the refusal names a
      // process instead of a mystery lock directory.
      return { kind: "held", holder: this.#holderOf() };
    }
    return { kind: "acquired" };
  }

  /** Drop the lock. Idempotent and never throwing: the library's own exit hook removes a
   *  leftover lock as well, and cleanup must not decide a round's fate. */
  async release(): Promise<void> {
    const unlock = this.#unlock;
    this.#unlock = null;
    if (unlock === null) return;
    try {
      await unlock();
    } catch {
      // Fail-open — see above.
    }
  }
}
