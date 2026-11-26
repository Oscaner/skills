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
// `write` is FAIL-OPEN in the same sense and for the same reason: the record OBSERVES a
// refusal, it is never the refusal's precondition. A tree whose root refuses the write (a
// read-only checkout, a root-owned CI mount) still gets the station and the exit code it
// asked for, and the failure arrives as a DECLARED value (`not-published` plus the reason)
// rather than as a throw out of the gate. Nothing here prints: the one diagnostic line
// belongs to the render face, which reads this value.
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
// and the record's name is the artifact matrix's (`../ledger/artifacts.ts`): each fact keeps
// its ONE home. `preflight.ts` imports this file's class TYPE-only, so reading the row set
// at runtime here stays acyclic — the vocabulary is read, never restated.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { TargetType } from "../../docs/identity/types.ts";
import { TARGET_TYPE_VALUES } from "../../docs/identity/types.ts";
import type { Clock } from "../../env/process/clock.ts";
import { Atomic } from "../../env/workspace/atomic.ts";
import type { WorkspaceRoot } from "../../env/workspace/workspace.ts";
import { WORKSPACE_ARTIFACTS } from "../ledger/artifacts.ts";
import { ROUND_OPS, type RoundOp } from "../ledger/identity.ts";
import { PRE_FLIGHT_GATE_NAMES, type PreFlightGateName } from "./preflight.ts";

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
  /** The row's conclusion as DATA — ONE line, never led by the station word (the station is
   *  already its own cell). Three shapes, one per kind of row: the closed reason word when
   *  the row concludes nothing more specific (`dirty-tree` · `held` · `corrupt-record`),
   *  otherwise the row's FIRST finding line (`graph` · `plan-ledger` · `doc-contract`),
   *  otherwise the station's own body. The derivation lives at the ONE assembly point
   *  (`preflight.ts#PreFlight.#refuse`), so no row spells the cell twice.
   *
   *  A record holds the OBSERVATION, never the repair. The sentence a consumer prints for a
   *  refusal — the "commit or discard … then re-run" instruction, the holder's pid · command
   *  · started · uptime, the live verdict's continuation lines — describes work this refusal
   *  did not do, which is not a persistent fact of the tree, and those bytes belong to the
   *  render face (`surface/words` plus the board), never to this cell. The consequence is
   *  named where it is decided: the board prints this cell verbatim, so a gate-written
   *  record reads in the gate's vocabulary, and the holder facts the old seam folded into
   *  the `in-flight` sentence remain on the board's own `in-flight:` row, which states them
   *  once already. That is a DECLARED narrowing of one runtime row, carried by the plan's
   *  task 11 and by the release note — never a silent one. */
  readonly detail: string;
}

/** One refusal as the writer is handed it — the instant is the record's own, taken from the
 *  injected clock at the write point, so no caller can spell it twice. */
export type RefusalBody = Omit<RefusalFacts, "at">;

/** One publish attempt — the facts the record was handed and whether the tree took them. A
 *  tree that refuses the write answers `not-published` with the reason; the refusal itself
 *  stands either way, so no caller's verdict depends on this value. */
export type RefusalPublish =
  | { readonly kind: "published"; readonly facts: RefusalFacts }
  | { readonly kind: "not-published"; readonly facts: RefusalFacts; readonly reason: string };

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
   *  document, never a slug-scoped artifact. The SPELLING is the artifact matrix's
   *  (`../ledger/artifacts.ts`), so a tree-level name has one home like every round name. */
  static readonly FILE: string = WORKSPACE_ARTIFACTS.refusal;

  readonly #root: WorkspaceRoot;
  readonly #clock: Clock;
  readonly #atomic: Atomic;

  constructor(opts: { root: WorkspaceRoot; clock: Clock }) {
    this.#root = opts.root;
    this.#clock = opts.clock;
    this.#atomic = new Atomic(opts.root.ops);
  }

  /** The record's absolute path — the workspace family's root plus its own name. */
  path(): string {
    return path.join(this.#root.path, Refusal.FILE);
  }

  /** Publish the namespace keep-out marker, then overwrite the record atomically —
   *  overwrite, never append: one tree holds at most one refusal fact. The bytes carry
   *  exactly one trailing newline (the repo's EOF rule). The whole publish is ONE
   *  observation: a tree that refuses any part of it (`EACCES` on a read-only root,
   *  `EISDIR` where the record should be) answers `not-published` with the reason and
   *  leaves the caller's verdict untouched — rethrowing would trade the refusal's station
   *  and exit code for a bare errno. */
  write(body: RefusalBody): RefusalPublish {
    const facts: RefusalFacts = { at: this.#clock.isoOf(this.#clock.now()), ...body };
    try {
      this.#root.ensure();
      this.#atomic.write(this.path(), `${JSON.stringify(facts, null, 2)}\n`);
      return { kind: "published", facts };
    } catch (raw) {
      const reason = raw instanceof Error ? raw.message : String(raw);
      return { kind: "not-published", facts, reason };
    }
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
    const read = Refusal.#factsOf(parsed);
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
  static #factsOf(value: unknown): FactsRead {
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
    const illegal = Refusal.#illegalWordOf(record);
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
  static #illegalWordOf(record: Record<string, unknown>): string | null {
    const { station, op, type } = record as { station: string; op: string; type: string };
    if (!(PRE_FLIGHT_GATE_NAMES as readonly string[]).includes(station)) {
      return "its `station` names no pre-flight row";
    }
    if (!(ROUND_OPS as readonly string[]).includes(op)) return "its `op` names no round verb";
    if (!(TARGET_TYPE_VALUES as readonly string[]).includes(type)) {
      return "its `type` names no target face";
    }
    return null;
  }
}
