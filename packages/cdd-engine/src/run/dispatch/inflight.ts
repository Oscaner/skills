// packages/cdd-engine/src/run/dispatch/inflight.ts
// The tree's ONE in-flight record — the occupancy a dispatch publishes before its child
// exists and releases when the round ends.
//
// INVARIANT — zero records before the child exists, no residue after it ends: the record
// is written after the lock is taken and removed at the release point, so a reader that
// sees a record sees a dispatch that was really started, and a tree with no child running
// holds no record.
//
// The record is the tree's, not a slug's: the collision domain is the whole work tree, so
// a second dispatch of ANY phase is refused while a live record stands. The record names
// the slug that holds it; the lock is only mutual exclusion, and the judgment of "is this
// occupancy stale" reads the RECORD plus the holder's liveness, never whether the lock is
// held.
//
// The write order is fixed — publish the namespace keep-out marker, honour the explicit
// takeover, run the live-holder guard, take the lock, and only then write the record. A
// failed lock leaves the record's bytes untouched: a challenger never overwrites a live
// holder's facts.
//
// TWO ENDINGS, and the CALLER names which one a round got — this segment judges no round.
// The NORMAL end (`release`) removes the record, drops the lock and expires the tree-level
// refusal fact a finished tree can no longer justify; the ABNORMAL end (a non-zero child
// exit, a kill, a timeout, an uncaught throw) drops the lock ALONE and leaves the record
// standing as the postmortem fact both shipped readers need — the board's `in-flight:` row
// names the dead holder and the `--recover` fold books the killed round from the record's
// own cycle / attempt / dispatch base. No ending may leave the lock carrier behind: a
// handle that outlived its round holds a carrier nothing will release.
//
// `release`'s expiry criterion is the STATION NAME: only a `standing` record whose station
// is `in-flight` is cleared — a refusal about another row belongs to another occasion, and
// a corrupt record is left where it is (deleting a fact whose station cannot be read is a
// judgment about a fact nobody could read).
//
// The start instant is read from the process table and falls back to the injected
// `Clock`: the pid's own start time is what the pid-reuse guard compares, so a record
// written hours into a session still describes the same process. This file reads no wall
// clock of its own.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RepoPath } from "../../env/paths/root.ts";
import type { Clock } from "../../env/process/clock.ts";
import { Lock, type LockHolder } from "../../env/process/lock.ts";
import { ProcessFacts } from "../../env/process/proc.ts";
import { Atomic } from "../../env/workspace/atomic.ts";
import type { WorkspaceRoot } from "../../env/workspace/workspace.ts";
import type { Refusal, RefusalState } from "../gate/refusal.ts";
import { WORKSPACE_ARTIFACTS } from "../ledger/artifacts.ts";

/** The two facts a record's target columns can read out missing — a closed set, so a
 *  report names the fact it read rather than a boolean's absence. */
export const TARGET_FACTS = ["plan", "workspace"] as const;

/** One target fact a standing record carries. */
export type TargetFact = (typeof TARGET_FACTS)[number];

/** One dispatch's in-flight record — the identity facts published before the spawn.
 *  Every cell is a PRESENT fact: a field a record cannot carry is `null`, never a
 *  fabricated default. */
export interface InFlightRecord {
  /** The dispatching engine process's pid — the liveness judgment's subject. */
  readonly pid: number;
  /** The dispatch's human-readable command (the same-command resume form). */
  readonly command: string;
  /** The dispatch's phase workspace slug — the record is tree-level, the slug names WHO
   *  holds it. */
  readonly slug: string;
  /** The holder process's own start instant (epoch ms) — the pid-reuse guard's recorded
   *  side, so it describes exactly the pid beside it. */
  readonly startedAt: number;
  /** The dispatched wave key (`3,4`); null off the wave face. */
  readonly wave: string | null;
  /** The dispatched phase (`implement` / `review` / `fix` / `branch-review`); null when
   *  the record was written by no dispatch. */
  readonly phase: string | null;
  /** The dispatched round's cycle; null when the record names none. */
  readonly cycle: number | null;
  /** The dispatched round's attempt; null when the record names none. */
  readonly attempt: number | null;
  /** The plan path the dispatch read (repo-relative); null when the face carries none. */
  readonly plan: string | null;
  /** The HEAD the dispatch started from (the round's postmortem baseline); null on a tree
   *  with no HEAD. */
  readonly dispatchBase: string | null;
}

/** A record as the writer is handed it — the start instant is the record's own read. */
export type InFlightBody = Omit<InFlightRecord, "startedAt">;

/** The three states of a judgment-time read of the record. */
export type InFlightState =
  /** Nothing on disk — no dispatch claims the tree. */
  | { readonly kind: "absent" }
  /** A readable record stands; `alive` folds an unreadable start time to `true` (a
   *  takeover is never authorized by a fact that could not be read), and `targetGone`
   *  names the record's own target facts that read out missing. */
  | {
      readonly kind: "held";
      readonly record: InFlightRecord;
      readonly alive: boolean;
      readonly targetGone: readonly TargetFact[];
    }
  /** A present-but-unreadable record; `locked` is the leftover lock carrier — the only
   *  corroborating fact a corrupt record can carry. */
  | { readonly kind: "corrupt"; readonly locked: boolean };

/** One acquisition's answer: taken, or refused with the standing holder's record (null
 *  when the record is present but unreadable). Declared, never thrown. */
export type AcquireOutcome =
  | { readonly kind: "acquired" }
  | { readonly kind: "held"; readonly record: InFlightRecord | null };

/** How one round ended, as the CALLER judges it — the occupancy owns the two endings, the
 *  dispatch face owns which one a round got. `normal` is an ending the engine itself
 *  concluded (the child exited on its own, the spawn never produced a process, the round
 *  was judged); `abnormal` is the family the record exists for. */
export type RoundEnding = "normal" | "abnormal";

/** One occupancy's terms. `ending` is REQUIRED: a default would decide the record's fate
 *  by omission, and the two endings are not interchangeable (one leaves a postmortem fact,
 *  the other removes it). */
export interface OccupyOptions<T> {
  /** The explicit takeover, threaded from the gate's authorization. */
  readonly recover?: boolean;
  /** The caller's ending judgment over the body's own value. */
  readonly ending: (value: T) => RoundEnding;
}

/** One occupancy's answer: the body ran, or the tree was already held so it did not. */
export type Occupancy<T> =
  | { readonly kind: "held"; readonly record: InFlightRecord | null }
  | { readonly kind: "ran"; readonly value: T };

/** The liveness reader seam — the production face is `ProcessFacts.live`; a pin injects
 *  a table so no real process has to die. */
export interface LivenessRead {
  live(pid: number, startedAt: number): Promise<boolean | null>;
}

/** The start-time reader seam — `ProcessFacts.startOf` in production. */
export interface StartRead {
  startOf(pid: number): Promise<number | null>;
}

/** The construction facts. The lock arrives CONSTRUCTED (its target is this record's own
 *  path) because mutual exclusion is `env/process/lock.ts`'s, and the refusal record
 *  arrives as the same instance the gate writes: the release point clears through it. */
export interface InFlightOptions {
  readonly root: WorkspaceRoot;
  readonly lock: Lock;
  readonly clock: Clock;
  readonly refusal: Refusal;
  /** The liveness read; `ProcessFacts` by default. */
  readonly liveness?: LivenessRead;
  /** The start-time read; `ProcessFacts` by default. */
  readonly starts?: StartRead;
}

/** One record's `corrupt` reason — the read face names the damage instead of inventing a
 *  record from the bytes. */
type RecordRead =
  | { readonly kind: "ok"; readonly record: InFlightRecord }
  | { readonly kind: "corrupt" }
  | { readonly kind: "absent" };

/**
 * InFlight — the tree's one occupancy. Invariant: zero records before the child exists,
 * no residue after a normal ending, and exactly one write point (see the file's header).
 *
 * Rule zero (over the 200-line class limit): the class stays whole because the write ORDER
 * — marker, takeover, live-holder guard, lock, record — IS the invariant, and a split into
 * a lock class and a record class would hand that order back to a caller.
 */
export class InFlight {
  /** The record's tree-level name — the SPELLING is the artifact matrix's
   *  (`../ledger/artifacts.ts`), so a tree-level name has one home like every round name. */
  static readonly FILE: string = WORKSPACE_ARTIFACTS.inFlight;

  readonly #root: WorkspaceRoot;
  readonly #lock: Lock;
  readonly #clock: Clock;
  readonly #refusal: Refusal;
  readonly #liveness: LivenessRead;
  readonly #starts: StartRead;
  readonly #atomic: Atomic;

  constructor(opts: InFlightOptions) {
    this.#root = opts.root;
    this.#lock = opts.lock;
    this.#clock = opts.clock;
    this.#refusal = opts.refusal;
    this.#liveness = opts.liveness ?? ProcessFacts;
    this.#starts = opts.starts ?? ProcessFacts;
    this.#atomic = new Atomic(opts.root.ops);
  }

  /** The record's absolute path — the workspace family's root plus its own name. */
  path(): string {
    return path.join(this.#root.path, InFlight.FILE);
  }

  /** The record's own start instant — the process table's answer when it has one, else
   *  the injected clock. One reading, so a pinned clock pins the record. */
  async startedAtOf(pid: number): Promise<number> {
    return (await this.#starts.startOf(pid)) ?? this.#clock.now();
  }

  /** A complete record from the caller's identity cells: the start instant is the one
   *  fact the caller may not spell (it is a process read, with the clock as its
   *  fallback). */
  async recordOf(body: InFlightBody): Promise<InFlightRecord> {
    return { ...body, startedAt: await this.startedAtOf(body.pid) };
  }

  /** Judge the tree NOW — the three-state read every gate and report face shares. */
  async inspect(): Promise<InFlightState> {
    const read = this.#readRecord();
    if (read.kind === "ok") {
      const alive = await this.#liveness.live(read.record.pid, read.record.startedAt);
      return {
        kind: "held",
        record: read.record,
        alive: alive ?? true,
        targetGone: this.#targetGone(read.record),
      };
    }
    if (read.kind === "absent") return { kind: "absent" };
    return { kind: "corrupt", locked: existsSync(Lock.carrierOf(this.path())) };
  }

  /** Take the record. The order is fixed: marker → (the flag's takeover) → live-holder
   *  guard → lock → record. The guard is this class's own fail-closed check, so no second
   *  write point can displace a live holder. A failed lock reads the standing record
   *  (zero write) so the refusal names a holder instead of a mystery lock. */
  async acquire(
    record: InFlightRecord,
    options: { readonly recover?: boolean } = {},
  ): Promise<AcquireOutcome> {
    this.#root.ensure();
    if (options.recover === true) await this.#takeOverStale();
    const standing = await this.inspect();
    if (standing.kind === "held" && standing.alive) {
      return { kind: "held", record: standing.record };
    }
    const taken = await this.#lock.acquire();
    if (taken.kind === "held") {
      const now = await this.inspect();
      return { kind: "held", record: now.kind === "held" ? now.record : null };
    }
    this.#writeRecord(record);
    return { kind: "acquired" };
  }

  /** Run one child inside the occupancy — the invariant's ONE carrier: the record is
   *  taken first, the body runs, and the ending the CALLER names decides the record's
   *  fate. The lock is dropped on every ending, so no carrier outlives its round. A tree
   *  already held answers `held` and the body never runs. */
  async occupy<T>(
    record: InFlightRecord,
    body: () => Promise<T>,
    options: OccupyOptions<T>,
  ): Promise<Occupancy<T>> {
    const taken = await this.acquire(record, options);
    if (taken.kind === "held") return taken;
    let value: T;
    try {
      value = await body();
    } catch (raw) {
      // An ending nobody judged is the abnormal one: the lock still drops, and the record
      // stands as the postmortem fact of a round the engine did not conclude.
      await this.#dropLock();
      throw raw;
    }
    if (options.ending(value) === "normal") await this.release();
    else await this.#dropLock();
    return { kind: "ran", value };
  }

  /** The normal end — remove the record, drop the lock, then expire the tree-level refusal
   *  fact this release invalidates. The expiry predicate is the STATION NAME (`in-flight`),
   *  so a standing fact about another row stays, and a corrupt record stays where it is.
   *  Idempotent and fail-open: cleanup never decides a round's fate. */
  async release(): Promise<void> {
    try {
      this.#root.ops.remove(this.path());
    } catch {
      // Fail-open: an unremovable record is still the truthful postmortem fact.
    }
    await this.#lock.release();
    this.#expireRefusal();
  }

  /** The ABNORMAL end — drop the lock ALONE and keep the record, which is the postmortem
   *  fact of a round that was killed, timed out or died with a non-zero code. Idempotent:
   *  a round that never acquired holds no handle. */
  async #dropLock(): Promise<void> {
    await this.#lock.release();
  }

  /** The release point's second effect — the tree has finished, so the refusal that only
   *  said "a dispatch is in flight" no longer holds. One raw read (the fact is the
   *  TREE's, never one workspace's view), then the station filter. */
  #expireRefusal(): void {
    const standing: RefusalState = this.#refusal.readRaw();
    if (standing.kind !== "standing") return;
    if (standing.facts.station !== "in-flight") return;
    this.#refusal.clear();
  }

  /** The explicit takeover's own step — a dead holder, a corrupt record with a leftover
   *  lock, or a lock remnant with no record. A LIVE holder is never displaced (the lock
   *  then refuses the acquisition). Whether a takeover is authorized at all is the gate's
   *  judgment (`run/gate/authority.ts`), which the caller threads in as `recover`. */
  async #takeOverStale(): Promise<void> {
    const read = this.#readRecord();
    if (read.kind === "ok") {
      const alive = await this.#liveness.live(read.record.pid, read.record.startedAt);
      // A live holder is never displaced, whatever flag asked for it.
      if ((alive ?? true) === true) return;
    } else if (read.kind === "absent" && !existsSync(Lock.carrierOf(this.path()))) {
      // Nothing stale stands: no record and no leftover carrier.
      return;
    }
    this.#lock.discardCarrier();
    try {
      this.#root.ops.remove(this.path());
    } catch {
      // Fail-open: the acquisition below answers the standing state either way.
    }
  }

  /** The record's own target facts — one existence read per fact the record carries; a
   *  fact the record does not carry has no "gone" shape and reads nothing. */
  #targetGone(record: InFlightRecord): readonly TargetFact[] {
    const gone: TargetFact[] = [];
    if (record.plan !== null && !existsSync(this.#root.basis.resolve(this.#recordedPath(record)))) {
      gone.push("plan");
    }
    if (!existsSync(path.join(this.#root.path, record.slug))) gone.push("workspace");
    return gone;
  }

  /** One record's plan cell as a repo-relative path — the write face's shape, resolved
   *  through the ONE basis so a read never spells a second coordinate. */
  #recordedPath(record: InFlightRecord): RepoPath {
    return this.#root.basis.relativize(record.plan ?? "");
  }

  /** The record write — the JSON shape through the ONE atomic write seam, with the repo's
   *  single trailing newline. Loud: a lock taken without a record standing behind it would
   *  break the invariant. */
  #writeRecord(record: InFlightRecord): void {
    this.#root.ensure();
    this.#atomic.write(this.path(), `${JSON.stringify(record, null, 2)}\n`);
  }

  /** Read the record — absent, corrupt or whole. The corrupt arm is a PRESENT file that
   *  will not answer the record's cells; the caller's three-state read tells the two
   *  apart. */
  #readRecord(): RecordRead {
    let text: string;
    try {
      text = readFileSync(this.path(), "utf8");
    } catch (raw) {
      const code = (raw as NodeJS.ErrnoException).code;
      return code === "ENOENT" ? { kind: "absent" } : { kind: "corrupt" };
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return { kind: "corrupt" };
    }
    const record = InFlight.#recordOf(value);
    return record === null ? { kind: "corrupt" } : { kind: "ok", record };
  }

  /** The record off the persisted bytes — null when a cell is missing or holds the wrong
   *  primitive kind (the bytes came off disk, so neither the type nor a reader's good faith
   *  may stand in for the check). */
  static #recordOf(value: unknown): InFlightRecord | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    for (const key of ["command", "slug"] as const) {
      if (typeof row[key] !== "string") return null;
    }
    for (const key of ["pid", "startedAt"] as const) {
      if (typeof row[key] !== "number" || !Number.isFinite(row[key])) return null;
    }
    return {
      pid: row.pid as number,
      command: row.command as string,
      slug: row.slug as string,
      startedAt: row.startedAt as number,
      wave: InFlight.#textCell(row.wave),
      phase: InFlight.#textCell(row.phase),
      cycle: InFlight.#numberCell(row.cycle),
      attempt: InFlight.#numberCell(row.attempt),
      plan: InFlight.#textCell(row.plan),
      dispatchBase: InFlight.#textCell(row.dispatchBase),
    };
  }

  /** A nullable string cell — a value of another kind reads absent (a present fact,
   *  never a coerced one). */
  static #textCell(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }

  /** A nullable number cell. */
  static #numberCell(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  /** The holder facts the lock's refusal reports — this record read, never a second
   *  spelling of the record's shape by the lock. */
  static holderOf(record: InFlightRecord | null): LockHolder | null {
    if (record === null) return null;
    return {
      pid: record.pid,
      command: record.command,
      slug: record.slug,
      startedAt: record.startedAt,
    };
  }
}
