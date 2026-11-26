// packages/cdd-engine/src/run/gate/refusal.ts
// The tree-level refusal fact — ONE record for the whole tree, written beside the
// ledger's own document and never inside a phase's slug directory.
//
// INVARIANT — a refusal is a fact about the TREE, never about a round: at most one
// refusal record exists at any instant, and writing one records no round. The record says
// "this tree did not pass the pre-dispatch gates"; the round machinery never ran, so no
// round cell moved and the ledger is not this class's collaborator at all.
//
// Two consequences the shape is built around:
//   · one write point, one name. `write` overwrites the whole record (a second refusal
//     REPLACES the first — one tree, one standing statement), so "at most one" is a
//     property of the storage rather than a rule a caller has to remember;
//   · two read seats, one record. `read(slug)` answers "is this refusal MINE" (the board
//     and the command face, filtered by the observing workspace's own slug), while
//     `readRaw()` answers "what stands on this TREE" (the release point's clearance — the
//     fact it invalidates is the tree's occupancy, so it may not be filtered). One method
//     serving both would have to pick one meaning and silently lie to the other reader.
//
// The two EXPIRY triggers are the only clearance callers: the gate's own door, when the
// structural leg did not refuse, and `InFlight#release` (the dispatch face's normal end).
// `clear()` is idempotent and FAIL-OPEN — a fact that outlives its expiry is the truthful
// observation, while a cleanup that throws would kill the work it was clearing for.
//
// The landing shape is `env/workspace`'s own (a JSON child written through the injected
// `FileOps` by the ONE atomic algorithm, read with a plain text read): the record's HOME is
// the workspace family's root — a tree-level fact, not a slug-scoped artifact — and
// `env/workspace` exposes no root-level JSON read of its own, so this file spells that one
// read. The write face stays the workspace's: nothing here invents a second atomic path.
//
// The timestamp is the ONE injected `Clock` (`env/process/clock.ts`): this file reads the
// clock through that seam and nowhere else, so a pinned clock pins the record.
//
// The station cell's vocabulary is the gate's row set (`./preflight.ts#PreFlightGateName`)
// — a type-only edge inside this one segment, so the vocabulary keeps exactly one home and
// the build carries no runtime cycle.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { TargetType } from "../../docs/identity/types.ts";
import { TARGET_TYPE_VALUES } from "../../docs/identity/types.ts";
import type { Clock } from "../../env/process/clock.ts";
import { Atomic } from "../../env/workspace/atomic.ts";
import type { WorkspaceRoot } from "../../env/workspace/workspace.ts";
import { ROUND_OPS, type RoundOp } from "../ledger/identity.ts";
import type { PreFlightGateName } from "./preflight.ts";

/** One recorded refusal — the whole fact, with no ninth cell and no second name for any of
 *  them. The keys are the FILE's contract (an engine artifact, not a consumer surface);
 *  this module's accessors are the API. */
export interface RefusalFacts {
  /** The instant the record was written (UTC ISO) — read from the injected clock. */
  readonly at: string;
  /** The phase workspace that judged — the slug `read(slug)` filters on. */
  readonly slug: string;
  /** The round verb the refused dispatch would have consumed. */
  readonly op: RoundOp;
  /** The target face (the dispatch's `--type` word). */
  readonly type: TargetType;
  /** The cycle the refused dispatch would have consumed — a CELL of the record, never a
   *  round: nothing is booked under it. */
  readonly cycle: number;
  /** The attempt the refused dispatch would have consumed (same sense as `cycle`). */
  readonly attempt: number;
  /** Which row refused — the gate's own row set (nine values), so every refusal names a row
   *  the gate can actually judge. */
  readonly station: PreFlightGateName;
  /** The row's conclusion as ONE line, never starting with the station word (the station is
   *  already its own cell). The live verdict's continuation lines describe work this refusal
   *  did not do, which is not a persistent fact of the tree. */
  readonly detail: string;
}

/** One refusal as the writer is handed it — the instant is the record's own, taken from the
 *  injected clock at the write point, so no caller can spell it twice. */
export type RefusalBody = Omit<RefusalFacts, "at">;

/** The three states of a judgment-time read of the record (the same tri-state the in-flight
 *  record answers: a corrupt record is never reported as "no record"). */
export type RefusalState =
  | { readonly kind: "absent" }
  | { readonly kind: "corrupt"; readonly reason: string }
  | { readonly kind: "standing"; readonly facts: RefusalFacts };

/** One read of the record's own bytes — the shape leg and the vocabulary leg answer in one
 *  shape, so a caller never sees "no facts" and "illegal word" as two returns. */
type FactsRead =
  | { readonly kind: "ok"; readonly facts: RefusalFacts }
  | { readonly kind: "bad"; readonly reason: string };

/**
 * Refusal — the tree's ONE refusal record. Invariant: at most one record exists, a write
 * replaces it whole, and a refusal books no round (see the file's header). Stateless beyond
 * its construction facts: the record IS the state, so two instances over one root agree by
 * construction.
 */
export class Refusal {
  /** The record's workspace-relative name — the tree-level sibling of the ledger's own
   *  document, never a slug-scoped artifact. */
  static readonly FILE = "refusal.json";

  readonly #root: WorkspaceRoot;
  readonly #clock: Clock;
  readonly #atomic: Atomic;
  /** The gate's row set — the vocabulary a record's `station` cell must belong to. Injected
   *  because the row set has ONE home (`./preflight.ts#PreFlightGateName`) and this file
   *  must not import it at runtime: the dependence runs gate → record, and an empty set
   *  would refuse every station rather than accept any. */
  readonly #stations: ReadonlySet<string>;

  constructor(opts: { root: WorkspaceRoot; clock: Clock; stations: ReadonlySet<string> }) {
    this.#root = opts.root;
    this.#clock = opts.clock;
    this.#stations = opts.stations;
    this.#atomic = new Atomic(opts.root.ops);
  }

  /** The record's absolute path — the workspace family's root plus its own name. */
  path(): string {
    return path.join(this.#root.path, Refusal.FILE);
  }

  /** Publish the namespace keep-out marker, then overwrite the record atomically —
   *  overwrite, never append: one tree holds at most one refusal fact. The bytes carry
   *  exactly one trailing newline (the repo's EOF rule). */
  write(body: RefusalBody): RefusalFacts {
    const facts: RefusalFacts = { at: this.#clock.isoOf(this.#clock.now()), ...body };
    this.#root.ensure();
    this.#atomic.write(this.path(), `${JSON.stringify(facts, null, 2)}\n`);
    return facts;
  }

  /** Remove the record — idempotent and FAIL-OPEN: an absent record is not an error, and a
   *  tree that refuses the removal (an `EACCES` from a read-only `.kairos/cdd`, an `EISDIR`
   *  when something else took the name) keeps the fact standing instead of throwing. The
   *  caller owns the predicate: this class clears what it is told to clear, and the two
   *  expiry triggers are the gate's door and `InFlight#release`. */
  clear(): void {
    try {
      this.#root.ops.remove(this.path());
    } catch {
      // Fail-open: an unremovable record still states what the last judgment found.
    }
  }

  /** The record as THIS workspace sees it: a standing record written by another phase
   *  workspace answers `absent` (the board renders the refusal it owns, and its own board
   *  still renders it). Corrupt and absent pass through unchanged — a corrupt record is a
   *  fact about the tree, not about some other slug. */
  read(slug: string): RefusalState {
    const state = this.readRaw();
    if (state.kind !== "standing") return state;
    return state.facts.slug === slug ? state : { kind: "absent" };
  }

  /** The record as the TREE holds it — the same three states with zero slug comparison.
   *  The release point's clearance is the ONE reader (the fact that stops holding when a
   *  holder releases belongs to whichever workspace was refused). */
  readRaw(): RefusalState {
    let text: string;
    try {
      text = readFileSync(this.path(), "utf8");
    } catch (raw) {
      const code = (raw as NodeJS.ErrnoException).code;
      return code === "ENOENT"
        ? { kind: "absent" }
        : { kind: "corrupt", reason: "the refusal record is unreadable" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { kind: "corrupt", reason: "the refusal record is not JSON" };
    }
    const read = Refusal.#factsOf(parsed, this.#stations);
    return read.kind === "ok"
      ? { kind: "standing", facts: read.facts }
      : { kind: "corrupt", reason: read.reason };
  }

  /** The eight cells read off the persisted bytes: `ok` with the facts, or `bad` with the
   *  ONE reason the read face reports. The shape leg (missing cell / wrong primitive kind)
   *  and the vocabulary leg (a closed-set cell holding a word outside its own table) are the
   *  same judgment on the same boundary — the bytes came off disk, so neither the TYPE nor a
   *  reader's good faith may stand in for the check. Each closed set is validated against
   *  the runtime table that already holds it — `TARGET_TYPE_VALUES` · `ROUND_OPS` · the gate
   *  row set — never a second spelling of any of the three. */
  static #factsOf(value: unknown, stations: ReadonlySet<string>): FactsRead {
    const shapeless: FactsRead = {
      kind: "bad",
      reason: "the refusal record holds no refusal facts",
    };
    if (typeof value !== "object" || value === null || Array.isArray(value)) return shapeless;
    const record = value as Record<string, unknown>;
    for (const key of ["at", "slug", "op", "type", "station", "detail"] as const) {
      if (typeof record[key] !== "string") return shapeless;
    }
    for (const key of ["cycle", "attempt"] as const) {
      if (typeof record[key] !== "number" || !Number.isFinite(record[key])) return shapeless;
    }
    const illegal = Refusal.#illegalWordOf(record, stations);
    if (illegal !== null) return { kind: "bad", reason: illegal };
    return {
      kind: "ok",
      facts: {
        at: record.at as string,
        slug: record.slug as string,
        op: record.op as RoundOp,
        type: record.type as TargetType,
        cycle: record.cycle as number,
        attempt: record.attempt as number,
        station: record.station as PreFlightGateName,
        detail: record.detail as string,
      },
    };
  }

  /** The first closed-set cell whose word its own table does not declare, or null when all
   *  three stand — the reason names the damaging cell, so the reader is pointed at the
   *  hand-edited word instead of at the record as a whole. */
  static #illegalWordOf(
    record: Record<string, unknown>,
    stations: ReadonlySet<string>,
  ): string | null {
    const { station, op, type } = record as { station: string; op: string; type: string };
    if (!stations.has(station)) return "its `station` names no pre-flight row";
    if (!(ROUND_OPS as readonly string[]).includes(op)) return "its `op` names no round verb";
    if (!(TARGET_TYPE_VALUES as readonly string[]).includes(type)) {
      return "its `type` names no target face";
    }
    return null;
  }
}
