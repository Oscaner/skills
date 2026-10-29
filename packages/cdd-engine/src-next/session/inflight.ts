// packages/cdd-engine/src-next/session/inflight.ts
// P21 §2.2 — the ONE in-flight fact of a work tree. A dispatch publishes its intent
// record BEFORE it spawns the child, overwrites the sampling trail through the same
// class while it runs, and releases it when the round finishes normally. The record
// is the only truth of "a dispatch is running" (the lock is only the mutual
// exclusion; gate/report judgments read the RECORD and the holder's liveness, never
// whether the lock is held):
//
//   · the record lives at the workspace-root level (`.kairos/cdd/in-flight.json` under
//     the default configuration) — the tree, not a slug, is the collision domain, so a
//     second dispatch of ANY slug is refused while a live record stands;
//   · the write order is fixed: publish the namespace keep-out marker → (the flag's
//     takeover) → the live-holder guard → take the lock (`proper-lockfile`) → only then
//     write the record. The guard is this class's own fail-closed check on a standing
//     record (the pre-flight gate is the primary one), so a second write point cannot
//     skip the protection. A failed lock leaves the record bytes untouched: a challenger
//     never overwrites a live holder's facts;
//   · no exit path removes the record — a crash / kill / timeout leaves it behind as
//     the postmortem fact. Only `release()` (the normal end) and `steal()` (the
//     explicit takeover) remove it. `proper-lockfile` drops the lock on any graceful
//     exit and leaves it only on SIGKILL, which is why the lock is never the criterion;
//   · the survival judgment is `ProcessFacts.live`: the record's pid + start time
//     against the process table. The recorded instant is the pid's OWN start time (a
//     record written hours into a session still describes the same process), since the
//     tolerance compares two start times, never a start time against a dispatch. An
//     UNREADABLE start time (the tool's `null`) folds to "alive" here — a takeover
//     must never be authorized by a fact that could not be read — but a pid-reuse (a
//     start time far from the recorded one) is "dead".
//
// Module-level exports are types / the error class / the class — zero
// behavior-carrying bare functions.

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import lockfile from "proper-lockfile";
import { AtomicWriter } from "../infra/atomic.ts";
import { ProcessFacts } from "../infra/proc.ts";
import type { WorkspaceRoot } from "../infra/workspace.ts";

/** One dispatch's in-flight record — the identity facts written before the spawn, plus
 *  the sampling trail the running dispatch overwrites. The identity fields never
 *  change while the record stands; `sampledAt` / `verdict` are the sampler's cells. */
export interface InFlightRecord {
  /** The dispatching engine process's pid — the liveness criterion's subject. */
  readonly pid: number;
  /** The dispatch's human-readable command (the same-command resume form) — what a
   *  holder report names, never the child's whole prompt. */
  readonly command: string;
  /** The dispatch's workspace slug — the record is tree-level, the slug names WHO holds it. */
  readonly slug: string;
  /** The holder process's own start instant (epoch ms) — the recorded side of the
   *  pid-reuse guard, so it describes exactly the pid beside it (never the dispatch
   *  instant: the guard compares it against the LIVE process's start time). */
  readonly startedAt: number;
  /** The dispatched wave key (`3,4`); null off the wave face. */
  readonly wave: string | null;
  /** The dispatched phase (`implement` / `review` / `fix` / `branch-review`); null
   *  when the record was not written by a dispatch. */
  readonly phase: string | null;
  /** The rendered brief's content hash at acquire time (`ReviewRefs.briefRevision`
   *  — the SAME hash face the ledger binds, zero new hash surface); null off the
   *  wave face. */
  readonly briefHash: string | null;
  /** The plan path the dispatch read (repoRoot-relative); null when the face carries
   *  no plan fact. */
  readonly plan: string | null;
  /** The sampling trail's last tick instant (epoch ms); null before the first tick. */
  readonly sampledAt: number | null;
  /** The last sample's stall verdict (`progress` / `unknown` / `idled` / `stalled`);
   *  null before the first tick. */
  readonly verdict: string | null;
}

/** The three states of a judgment-time read of the record. */
export type InFlightState =
  /** No record on disk — no dispatch claims the tree. */
  | { readonly kind: "absent" }
  /** A readable record stands; `alive` is `ProcessFacts.live`'s judgment (an
   *  unreadable start time folds to `true` — never an authorized takeover). */
  | { readonly kind: "held"; readonly record: InFlightRecord; readonly alive: boolean }
  /** A present-but-unreadable record; `locked` is the leftover lock directory — the
   *  only corroborating fact a corrupt record can carry. */
  | { readonly kind: "corrupt"; readonly locked: boolean };

/** The acquire refusal — another dispatch holds the record (or the lock) already. The
 *  carrier keeps the holder's facts so the CLI renders the held BLOCK from them; a
 *  corrupt record yields a null `record`. */
export class HoldingError extends Error {
  /** The holder's record (null when the record was present but unreadable). */
  readonly record: InFlightRecord | null;

  constructor(message: string, record: InFlightRecord | null) {
    super(message);
    this.name = "HoldingError";
    this.record = record;
  }
}

/** The liveness reader seam — the production face is `ProcessFacts.live`; the tests
 *  inject a table without a real unreadable process. */
export interface LivenessReader {
  live(pid: number, startedAt: number): Promise<boolean | null>;
}

/**
 * InFlight — one workspace root's in-flight record, lock and sampling trail. The
 * instance is bound to `<workspaceRoot>` + the dispatching slug; every path derives
 * from the root, so the lock and the record always share one directory.
 */
export class InFlight {
  /** The record's file name inside the workspace-root namespace — the tree-level
   *  `.kairos/cdd/in-flight.json` under the default configuration. */
  static readonly FILE = "in-flight.json";

  /** The lock's stale window (ms) — a FINITE value larger than the longest dispatch
   *  budget (implement, 6 h). Finiteness is deliberate: `stale: Infinity` pushes the
   *  default `update` to `Infinity`, which Node clamps to 1 ms of lock-touch churn
   *  for the whole dispatch. "Never steal automatically" is guaranteed by the record
   *  + pid criterion below, never by the lock's duration. */
  static readonly LOCK_STALE_MS = 12 * 60 * 60 * 1000;

  /** The lock's refresh interval (ms). */
  static readonly LOCK_UPDATE_MS = 60 * 1000;

  readonly #root: WorkspaceRoot;
  readonly #slug: string;
  readonly #liveness: LivenessReader;
  readonly #atomic = new AtomicWriter();
  /** The held lock's release function — present exactly between acquire and release. */
  #unlock: (() => Promise<void>) | null = null;

  constructor(root: WorkspaceRoot, slug: string, liveness: LivenessReader = ProcessFacts) {
    this.#root = root;
    this.#slug = slug;
    this.#liveness = liveness;
  }

  /** The record's absolute path (`<workspaceRoot>/in-flight.json`). */
  path(): string {
    return path.join(this.#root.path, InFlight.FILE);
  }

  /** The lock directory's absolute path (`proper-lockfile`'s default carrier). */
  lockPath(): string {
    return `${this.path()}.lock`;
  }

  /** Publish the namespace keep-out marker (`<namespace>/.gitignore` = `*`) — the
   *  PRECONDITION of the record's first write, so a fresh namespace killed before
   *  `WorkspaceRoot.ensure()` never leaves untracked in-flight artifacts behind. The
   *  marker itself is the root's single implementation (`WorkspaceRoot.ensure`): this
   *  class decides WHEN it must be published, never re-implements its bytes. */
  ensureMarker(): InFlight {
    this.#root.ensure();
    return this;
  }

  /** Take the record — the ONLY write point of a real dispatch (the gates read
   *  `inspect()`, they never call this). The order is fixed: marker → (flag's takeover)
   *  → live-holder guard → lock → record. The guard is the class's OWN fail-closed
   *  check that a standing record is never displaced while its holder lives: the
   *  pre-flight gate is the primary guard, this one keeps the invariant true for any
   *  other write point. `stealStale` only acts HERE: a standing record whose holder is
   *  dead (or a corrupt record with a leftover lock) is taken over first; a live holder
   *  is never displaced. A failed lock throws `HoldingError` carrying the holder's
   *  facts and leaves the record bytes untouched. */
  async acquire(
    record: InFlightRecord,
    options: { readonly stealStale?: boolean } = {},
  ): Promise<void> {
    this.ensureMarker();
    if (options.stealStale === true) await this.#stealIfDead();
    await this.#refuseLiveHolder();
    try {
      this.#unlock = await lockfile.lock(this.path(), {
        stale: InFlight.LOCK_STALE_MS,
        update: InFlight.LOCK_UPDATE_MS,
        realpath: false,
        retries: 0,
      });
    } catch {
      // The lock is held: READ the standing record (zero write) so the refusal names
      // the live holder instead of a mystery lock.
      const state = await this.inspect();
      const holder = state.kind === "held" ? state.record : null;
      throw new HoldingError(this.#holdingMessage(holder), holder);
    }
    this.#writeRecord(record);
  }

  /** The live-holder guard — refuse a standing record whose holder is alive (or whose
   *  liveness cannot be read, which folds to alive), BEFORE the lock is taken: zero
   *  write, zero lock left behind. A record proven dead is displaced (the lock was
   *  free, so this dispatch is the tree's next legitimate holder); a corrupt record
   *  carries no live fact to honor and is displaced too — refusing there would wedge
   *  the tree for good, since nothing else clears an unlocked corrupt record. */
  async #refuseLiveHolder(): Promise<void> {
    const state = await this.inspect();
    if (state.kind !== "held" || !state.alive) return;
    throw new HoldingError(this.#holdingMessage(state.record), state.record);
  }

  /** Overwrite the running dispatch's sampling cells — the identity fields stay
   *  untouched. Fail-open on both sides: a missing/corrupt record (the record was
   *  taken over, or the sampler outlived it) is skipped, never fabricated into a new
   *  record, and a failed WRITE is swallowed too — the trail is a diagnostic, so an
   *  unwritable namespace neither aborts a dispatch whose child is already spawned nor
   *  throws inside the sampler's interval. `acquire()` keeps its write loud: a lock
   *  taken without a record standing behind it would break the invariant. */
  heartbeat(sample: { readonly sampledAt: number; readonly verdict: string }): void {
    const current = this.#readRecord();
    if (current === null) return;
    try {
      this.#writeRecord({ ...current, sampledAt: sample.sampledAt, verdict: sample.verdict });
    } catch {
      // Fail-open: the next tick retries, and the record's identity fields still
      // describe the holder — a lost sample is never a lost dispatch.
    }
  }

  /** Release the record at the normal end — the reverse of acquire: delete the record,
   *  then drop the lock. One of the only two removal paths (the other is `steal`). */
  async release(): Promise<void> {
    try {
      rmSync(this.path(), { force: true });
    } catch {
      // Fail-open: an unremovable record is still the truthful postmortem fact.
    }
    const unlock = this.#unlock;
    this.#unlock = null;
    if (unlock !== null) {
      try {
        await unlock();
      } catch {
        // The library's own exit hook removes it as well; never throw on cleanup.
      }
    }
  }

  /** Judge the tree NOW — the three-state read every gate and report face shares.
   *  `held.alive` is `ProcessFacts.live` verbatim, except that its `null` (an
   *  unreadable start time) folds to `true`: refusing a takeover on a fact that could
   *  not be read is the safe direction (a false "alive" only delays a takeover). */
  async inspect(): Promise<InFlightState> {
    const record = this.#readRecord();
    if (record !== null) {
      const alive = await this.#liveness.live(record.pid, record.startedAt);
      return { kind: "held", record, alive: alive ?? true };
    }
    if (!existsSync(this.path())) return { kind: "absent" };
    return { kind: "corrupt", locked: existsSync(this.lockPath()) };
  }

  /** Take the record over explicitly — the `--steal-stale` path. The precondition is
   *  that the holder cannot be alive: a readable record whose pid is live is refused
   *  (the flag never crosses "alive → no takeover"); a corrupt record has no live
   *  fact to honor and is cleared. Clears the lock, then the record. */
  async steal(reason: string): Promise<InFlightRecord | null> {
    const record = this.#readRecord();
    if (record !== null) {
      const alive = await this.#liveness.live(record.pid, record.startedAt);
      if ((alive ?? true) === true) {
        throw new Error(
          `refusing to steal the in-flight record (${reason}): pid ${record.pid} is alive`,
        );
      }
    }
    try {
      rmSync(this.lockPath(), { recursive: true, force: true });
    } catch {
      // Fail-open: the record removal below is the takeover's real effect.
    }
    if (existsSync(this.path())) rmSync(this.path(), { force: true });
    return record;
  }

  /** The `stealStale` pre-step of acquire: take over a standing record whose holder is
   *  dead, a corrupt record with a leftover lock, or a lock remnant with no record —
   *  and do nothing while the holder is alive (the lock then refuses the acquire). */
  async #stealIfDead(): Promise<void> {
    const state = await this.inspect();
    if (state.kind === "held" && !state.alive) {
      await this.steal("the holder is dead");
      return;
    }
    if (state.kind === "corrupt" && state.locked) {
      await this.steal("the record is corrupt and the lock is left behind");
      return;
    }
    if (state.kind === "absent" && existsSync(this.lockPath())) {
      await this.steal("a lock without a record");
    }
  }

  /** The refusal message — the holder's identity facts as plain text (the words
   *  table owns the CLI's held report; this is the thrown carrier's own summary). */
  #holdingMessage(holder: InFlightRecord | null): string {
    if (holder === null) {
      return `another dispatch holds the in-flight lock under ${this.#root.path} — the standing record is unreadable (dispatch ${this.#slug} refuses to overwrite it)`;
    }
    return `another dispatch is in flight: pid ${holder.pid} (${holder.command}), slug ${holder.slug}, started ${new Date(holder.startedAt).toISOString()} — it must finish, or its record must be taken over with --steal-stale`;
  }

  /** The record write — the JSON shape through the ONE atomic write seam, with the
   *  repo's single trailing newline. */
  #writeRecord(record: InFlightRecord): void {
    mkdirSync(this.#root.path, { recursive: true });
    this.#atomic.write(this.path(), `${JSON.stringify(record, null, 2)}\n`);
  }

  /** Read the record — null on an absent OR unreadable/invalid file (the caller's
   *  `existsSync` tells the two apart for the corrupt state). */
  #readRecord(): InFlightRecord | null {
    let text: string;
    try {
      text = readFileSync(this.path(), "utf8");
    } catch {
      return null;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return null;
    }
    if (value === null || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    if (typeof row.pid !== "number" || typeof row.startedAt !== "number") return null;
    if (typeof row.command !== "string" || typeof row.slug !== "string") return null;
    return {
      pid: row.pid,
      command: row.command,
      slug: row.slug,
      startedAt: row.startedAt,
      wave: typeof row.wave === "string" ? row.wave : null,
      phase: typeof row.phase === "string" ? row.phase : null,
      briefHash: typeof row.briefHash === "string" ? row.briefHash : null,
      plan: typeof row.plan === "string" ? row.plan : null,
      sampledAt: typeof row.sampledAt === "number" ? row.sampledAt : null,
      verdict: typeof row.verdict === "string" ? row.verdict : null,
    };
  }
}
