// packages/cdd-engine/src/run/ledger/ledger.ts
// The fact layer: round identities, wave lines, document review lines, the branch line,
// reviewed versions, artifact identities, rulings and re-grades.
//
// INVARIANT — one fact, one home; one record, one writer. Every fact below is written
// through this class's ONE persist point and read back through ONE accessor, so no second
// site can spell a record differently. This class JUDGES NOTHING: it records what a round
// did and answers what is on record; the gate, the dispatch and the frontier (later
// segments) read these facts and never keep a copy.
//
// The rules that hold across every method:
//   · a round is its `(line, op, cycle, attempt)` coordinate — a repeat of the same
//     coordinate replaces that cell, a different attempt is a different round;
//   · a wave line's plan-task snapshot is a HISTORICAL fact: it is written once at the
//     closure point and never re-derived (a plan that later gains tasks must not erase the
//     append-vs-stall evidence), and an unclosed wave line answers no snapshot;
//   · a document line remembers the version its LATEST review read (`doc_hash`, rewritten
//     by that review and frozen between reviews) and the number of review batches it took;
//     the drift read compares the recorded version against the document's current bytes, so
//     a drift read always answers against the newest reviewed version, never the first;
//   · an artifact's path is a FUNCTION of its record's identity — never a stored cell — so
//     `carrierPathOf` is the only accessor of that fact;
//   · the observation set is a RECORD sequence, not a listing of the workspace: a sidecar
//     no record claims stays on the orphan face and never enters it.
//
// Writing goes through `env/workspace`'s atomic write (`Workspace#writeJson`); the one
// read face `env/workspace` does not own — a listing of the workspace's own children — is
// injected, so this file touches no filesystem.
//
// The document itself is the FROZEN one: `{plan?, timeoutCount, engineSelfWrittenCount,
// engineRecoveryCount, harnessAbortCount, waves: [...]}`, each row keyed by its `wave` cell
// (a wave's task group, a document word, or `branch`). The engine that shipped before this
// tree wrote that document, every consumer workspace holds one, and the corpus fixtures
// declare it, so a reader of another shape would answer `null` on a legal tree and reset the
// history it was supposed to carry. What this tree ADDS is additive: a row may also carry
// the review-batch count, the rulings and the re-grades.
//
// Rule zero (over the 200-line class limit): the ledger is ONE object with one invariant
// (one fact, one writer) and one persist point; splitting it by reader would put the same
// document behind several writers, which is exactly the defect the invariant names.

import type { RepoPath } from "../../env/paths/root.ts";
import type { Workspace } from "../../env/workspace/workspace.ts";
import { type ArtifactRead, ArtifactReads, type ArtifactSource } from "./artifact-reads.ts";
import { ArtifactIdentity, type ArtifactKind, type Artifacts } from "./artifacts.ts";
import { ROUND_OPS, RoundIdentity, type RoundOp } from "./identity.ts";
import { type Drift, ReviewedIdentity, type ReviewedKind } from "./reviewed.ts";
import { type RegradeRecord, type RulingRecord, Rulings } from "./rulings.ts";

/** The terminal verdict of one dispatched round — the completion flag and the tree-clean
 *  observation. */
export interface RoundVerdict {
  /** Whether the round did what its verb promised. */
  readonly treeClean: boolean;
  /** Whether the round produced its target action (the completion verdict). */
  readonly targetAction: boolean;
}

/** One graded violation of a round — `hard` fails the round, `soft` is bookkeeping. */
export interface RoundViolation {
  readonly grade: "hard" | "soft";
  readonly cause: string;
  readonly message: string;
}

/** One dispatched round's record: its identity cells, the dispatch baseline, the verdict,
 *  its graded violations and the carrier digest the engine wrote. */
export interface RoundRecord {
  readonly op: RoundOp;
  readonly cycle: number;
  readonly attempt: number;
  readonly dispatchBase: string | null;
  readonly verdict: RoundVerdict;
  readonly violations: readonly RoundViolation[];
  /** The payload digest the engine recorded for the carrier it wrote; null when the round
   *  wrote none (or the record predates the column — a present-facts read). */
  readonly carrierDigest: string | null;
  /** The carrier path an OLDER engine recorded on the record itself — the historical fact
   *  `carrierPathOf`'s step ① answers. This tree never writes it (a record's carrier is a
   *  function of its identity), and a present record that carries one keeps it: the name it
   *  remembers is the file the round actually wrote, which a re-dispatch's ladder can no
   *  longer derive. */
  readonly carrierPath?: string | null;
}

/** The writable shape of one round record — the identity cells a seeding caller may leave
 *  out (the ledger allocates the next cycle then) and the rest defaulted. */
export interface RoundRecordInit {
  readonly op: RoundOp;
  readonly cycle?: number;
  readonly attempt?: number;
  readonly dispatchBase?: string | null;
  readonly verdict?: RoundVerdict;
  readonly violations?: readonly RoundViolation[];
  readonly carrierDigest?: string | null;
}

/** The progress document's four counter cells — the frozen key set at zero. This tree
 *  increments none of them; they ride through a read/write pair untouched so a document the
 *  shipped engine wrote keeps its own bookkeeping. */
export const COUNTER_ZERO = {
  timeoutCount: 0,
  engineSelfWrittenCount: 0,
  engineRecoveryCount: 0,
  harnessAbortCount: 0,
} as const;

/** The persisted reviewed-version cell — the frozen document's own union: a document line
 *  binds a `doc-revision`, a wave line a `brief-revision`, and the two never mix on one row. */
export type PersistedReviewed =
  | { readonly kind: "doc-revision"; readonly doc: string; readonly doc_hash: string }
  | { readonly kind: "brief-revision"; readonly plan: string; readonly brief_hash: string };

/** One line's persisted record — the row the ledger document holds. The snake_case keys are
 *  the FILE's contract (an engine artifact, not a consumer surface); the class's accessors
 *  are the API. `wave` is the frozen row key: a wave's task group, a document word, or
 *  `branch` — the line word is derived from it, never stored beside it. */
interface LedgerRow {
  readonly wave: string;
  readonly rounds?: readonly RoundRecord[];
  readonly planTasks?: readonly number[];
  readonly reviewedRevision?: PersistedReviewed;
  /** The line's review-batch count — this tree's own cell (the frozen document counts
   *  nothing per line), absent on a row no review opened. */
  readonly batch?: number;
  readonly rulings?: readonly RulingRecord[];
  readonly regrades?: readonly RegradeRecord[];
}

/** The legacy `rounds` planes the frozen document declares — a per-mode cycle array
 *  (`{implement: [1], review: [1, 2]}`) or a per-mode cycle count (`{implement: 1,
 *  review: 2}`). The shipped engine folds both into completed records at read time and
 *  writes back nothing, and its documents are in consumer workspaces, so a reader of the
 *  record array alone raises on a legal row. */
export type LegacyRounds = Readonly<Record<string, readonly number[] | number>>;

/** One row AS THE FILE HOLDS IT — `rounds` is whatever the document carries, and `read`
 *  folds it to the row shape (`LedgerRow`) every reader indexes without a guard. */
type PersistedRow = Omit<LedgerRow, "rounds"> & { readonly rounds?: unknown };

/** The ledger write one round lands, as a consumer states it: the row's own coordinate
 *  (`progress.waves["1"]`) and the op it books under. Both are the document's facts, so a
 *  sentence about the write reads them instead of spelling them. */
export interface RoundWrite {
  readonly row: string;
  readonly op: RoundOp;
}

/** The ledger's persisted document — the one file this class writes, in the frozen shape. */
export interface LedgerDocument {
  /** The `--plan` path recorded at first create. */
  readonly plan?: string;
  readonly timeoutCount: number;
  readonly engineSelfWrittenCount: number;
  readonly engineRecoveryCount: number;
  readonly harnessAbortCount: number;
  /** The recorded lines, in first-write order — the frozen `waves` container. */
  readonly waves: readonly LedgerRow[];
}

/** One wave line as the readers see it. */
export interface WaveLine {
  /** The line word (`tasks-1,2`). */
  readonly line: string;
  /** The wave's task ids, off the line word. */
  readonly taskIds: readonly number[];
  /** The line's rounds, in `(cycle, attempt)` order. */
  readonly rounds: readonly RoundRecord[];
  /** The plan's task set when the wave CLOSED; null while the wave is still open. */
  readonly planTasks: readonly number[] | null;
  /** The reviewed brief version, when one was recorded. */
  readonly reviewed: ReviewedIdentity | null;
}

/** One document review line as the readers see it. */
export interface DocLine {
  /** The line word (a document type word). */
  readonly line: string;
  /** The line's rounds, in `(cycle, attempt)` order. */
  readonly rounds: readonly RoundRecord[];
  /** The reviewed document version's digest; null before the first review. */
  readonly docHash: string | null;
  /** How many review batches the line has taken (0 = none). */
  readonly batch: number;
  /** The reviewed version, when one was recorded. */
  readonly reviewed: ReviewedIdentity | null;
}

/** The branch line as the readers see it. */
export interface BranchLine {
  /** The line word — `branch`. */
  readonly line: string;
  /** The line's rounds, in `(cycle, attempt)` order. */
  readonly rounds: readonly RoundRecord[];
  /** The reviewed plan version the branch was judged at, when one was recorded. */
  readonly reviewed: ReviewedIdentity | null;
}

/** One crashed round's cell — the board's `crashed:` line takes its cells from here. */
export interface CrashedRound {
  readonly op: RoundOp;
  readonly cycle: number;
  readonly attempt: number;
  /** The first HARD violation's cause, in the round's own record order. */
  readonly cause: string;
}

/** One artifact observation — a review round's sidecar, its carrier and its read. */
export interface ArtifactObservation {
  /** The line the round sits on. */
  readonly line: string;
  /** The artifact kind observed — a review round's `rulings` sidecar. */
  readonly kind: ArtifactKind;
  readonly cycle: number;
  readonly attempt: number;
  /** The carrier path the record resolves, or `""` when it resolves none. */
  readonly carrier: RepoPath | "";
  /** The composed artifact read. */
  readonly read: ArtifactRead;
}

/** The ledger's construction facts. */
export interface LedgerOptions {
  /** The workspace every record lands in — the ONE write face. */
  readonly workspace: Workspace;
  /** Every name directly inside that workspace — the candidate set the orphan judgment
   *  scans. Injected because `env/workspace` owns the layout, not a listing. */
  readonly names: () => readonly string[];
  /** The artifact index, when the caller wired one. Absent means the observation faces are
   *  silent (`orphanHandoffs` answers the empty set), never a second name grammar. */
  readonly artifacts?: Artifacts;
  /** The workspace names this engine writes that are NOT round artifacts — the ledger's own
   *  document, the base artifact, the in-flight record, the refusal record, the brief
   *  family. The orphan judgment scans the workspace's directory, so a bookkeeping literal
   *  left out would read as an unclaimed carrier. Defaults to this class's own document;
   *  the composition root adds its other segments' names. */
  readonly reserved?: readonly string[];
}

/**
 * Ledger — the fact layer's single author and single reader. Invariant: one fact, one home,
 * one writer (see the file's header); this class judges nothing.
 */
export class Ledger {
  /** The ledger document's workspace name — the one file this class writes. */
  static readonly FILE = "progress.json";

  /** The row container's spelling in a `would record:` row — the document's own stem and
   *  its container cell, so the sentence a dry run prints and the file it would write can
   *  never name two coordinates. */
  static readonly ROW_CONTAINER = "progress.waves";

  readonly #workspace: Workspace;
  readonly #names: () => readonly string[];
  readonly #artifacts: Artifacts | null;
  readonly #reserved: ReadonlySet<string>;

  constructor(opts: LedgerOptions) {
    this.#workspace = opts.workspace;
    this.#names = opts.names;
    this.#artifacts = opts.artifacts ?? null;
    this.#reserved = new Set(opts.reserved ?? [Ledger.FILE]);
  }

  // -------------------------------------------------------------------------
  // the persisted document — one read face, one write point
  // -------------------------------------------------------------------------

  /** The ledger document as recorded; null when nothing is there yet (the ledger never
   *  invents state). A document whose row container is not an array is not this engine's
   *  document: the answer is null, the same absent fact as a missing file. Every row is
   *  folded to the row shape here — the ONE place `rounds` is normalized — so no reader
   *  spreads a container it never validated. */
  read(): LedgerDocument | null {
    const read = this.#workspace.readJson(Ledger.FILE);
    if (read.kind !== "ok") return null;
    const value = read.value as Partial<LedgerDocument> | null;
    if (value === null || typeof value !== "object" || !Array.isArray(value.waves)) return null;
    return {
      ...(typeof value.plan === "string" ? { plan: value.plan } : {}),
      timeoutCount: Ledger.#counterOf(value.timeoutCount),
      engineSelfWrittenCount: Ledger.#counterOf(value.engineSelfWrittenCount),
      engineRecoveryCount: Ledger.#counterOf(value.engineRecoveryCount),
      harnessAbortCount: Ledger.#counterOf(value.harnessAbortCount),
      waves: value.waves
        .filter((row) => typeof (row as PersistedRow | undefined)?.wave === "string")
        .map((row) => Ledger.#rowOf(row as PersistedRow)),
    };
  }

  /** The empty document — a fresh session's starting point, in the frozen fixed key set. */
  empty(): LedgerDocument {
    return { ...COUNTER_ZERO, waves: [] };
  }

  /** The ledger's ONE write point: the atomic write of the whole document. */
  #write(document: LedgerDocument): void {
    this.#workspace.writeJson(Ledger.FILE, document);
  }

  /** One line's row, or undefined — read by the line WORD, and folded to the document's own
   *  key cell here so a caller never spells the persisted key. */
  static rowOf(document: LedgerDocument | null, line: string): LedgerRow | undefined {
    const key = RoundIdentity.rowKeyOf(line);
    return document?.waves.find((row) => row.wave === key);
  }

  /** The document with one line's row replaced (or appended) — the immutable update every
   *  writer funnels through, so no writer mutates a row in place. An unknown cell a row
   *  already carries survives the spread: this tree adds cells, it never drops one. */
  #withRow(document: LedgerDocument, line: string, update: (row: LedgerRow) => LedgerRow) {
    const key = RoundIdentity.rowKeyOf(line);
    const index = document.waves.findIndex((row) => row.wave === key);
    const waves = [...document.waves];
    if (index === -1) waves.push(update({ wave: key }));
    else waves[index] = update(waves[index] as LedgerRow);
    return { ...document, waves };
  }

  // -------------------------------------------------------------------------
  // rounds — the identity and its record
  // -------------------------------------------------------------------------

  /** Record one dispatched round. The coordinate is the identity: a repeat of the same
   *  `(op, cycle, attempt)` REPLACES that cell (never a second row), a different attempt is
   *  a different round, and a caller that names no cycle takes the op's next one. */
  recordRound(line: string, init: RoundRecordInit): RoundRecord {
    if (!ROUND_OPS.includes(init.op)) {
      throw new Error(`Ledger: "${String(init.op)}" is not a declared round op`);
    }
    const document = this.read() ?? this.empty();
    const records = [...(Ledger.rowOf(document, line)?.rounds ?? [])];
    const cycle = init.cycle ?? Ledger.#nextCycle(records, init.op);
    const record: RoundRecord = {
      op: init.op,
      cycle,
      attempt: init.attempt ?? 1,
      dispatchBase: init.dispatchBase ?? null,
      verdict: init.verdict ?? { treeClean: true, targetAction: true },
      violations: init.violations ?? [],
      carrierDigest: init.carrierDigest ?? null,
    };
    const at = records.findIndex(
      (candidate) =>
        candidate.op === record.op &&
        candidate.cycle === record.cycle &&
        candidate.attempt === record.attempt,
    );
    if (at === -1) records.push(record);
    else records[at] = record;
    records.sort((left, right) => left.cycle - right.cycle || left.attempt - right.attempt);
    this.#write(this.#withRow(document, line, (row) => ({ ...row, rounds: records })));
    return record;
  }

  /** One line's rounds, in `(cycle, attempt)` order. */
  rounds(line: string): readonly RoundRecord[] {
    return [...(Ledger.rowOf(this.read(), line)?.rounds ?? [])];
  }

  /** Every booked round of one document, flattened in row order — the ONE collector the
   *  crash read takes its input from, so no reader re-walks the rows itself. */
  nodeRecordsOf(document: LedgerDocument | null): readonly RoundRecord[] {
    return (document?.waves ?? []).flatMap((row) => row.rounds ?? []);
  }

  /** The crashed rounds as cells, one per round identity, in `(cycle, attempt)` order: a
   *  round crashed when its verdict withheld the target action AND at least one violation is
   *  HARD, and the cause is the FIRST hard violation in the round's own record order. */
  crashedOf(records: readonly RoundRecord[]): readonly CrashedRound[] {
    const seen = new Set<string>();
    const cells: CrashedRound[] = [];
    const ordered = [...records].sort(
      (left, right) => left.cycle - right.cycle || left.attempt - right.attempt,
    );
    for (const record of ordered) {
      if (record.verdict.targetAction || !record.violations.some(Ledger.#hard)) continue;
      const key = `${record.op}\u0000${record.cycle}\u0000${record.attempt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cause = record.violations.find(Ledger.#hard);
      cells.push({
        op: record.op,
        cycle: record.cycle,
        attempt: record.attempt,
        cause: cause?.cause ?? "",
      });
    }
    return cells;
  }

  // -------------------------------------------------------------------------
  // the three line kinds
  // -------------------------------------------------------------------------

  /** The wave lines, in the document's first-write order. */
  waveLines(): readonly WaveLine[] {
    return this.#rowsOf("wave").map((row) => {
      const line = RoundIdentity.lineWordOfRowKey(row.wave);
      return {
        line,
        taskIds: RoundIdentity.taskIdsOfWord(line),
        rounds: [...(row.rounds ?? [])],
        planTasks: row.planTasks === undefined ? null : [...row.planTasks],
        reviewed: Ledger.#reviewedOf(row),
      };
    });
  }

  /** The document review lines, in the document's first-write order. The reviewed version
   *  is DERIVED from the row's one persisted cell — one fact, one read face. */
  docLines(): readonly DocLine[] {
    return this.#rowsOf("doc").map((row) => {
      const reviewed = Ledger.#reviewedOf(row);
      return {
        line: RoundIdentity.lineWordOfRowKey(row.wave),
        rounds: [...(row.rounds ?? [])],
        docHash: reviewed !== null && reviewed.kind === "document" ? reviewed.hash : null,
        batch: row.batch ?? 0,
        reviewed,
      };
    });
  }

  /** The branch line, or null when the branch has no record. */
  branchLine(): BranchLine | null {
    const row = this.#rowsOf("branch")[0];
    if (row === undefined) return null;
    return {
      line: RoundIdentity.lineWordOfRowKey(row.wave),
      rounds: [...(row.rounds ?? [])],
      reviewed: Ledger.#reviewedOf(row),
    };
  }

  // -------------------------------------------------------------------------
  // the wave line's closure fact and the reviewed version
  // -------------------------------------------------------------------------

  /** Close one wave line by recording its plan-task snapshot. IDEMPOTENT by design: an
   *  existing snapshot is never overwritten, because the fact it records is historical. */
  closeWave(line: string, planTasks: readonly number[]): void {
    const document = this.read() ?? this.empty();
    if (Ledger.rowOf(document, line)?.planTasks !== undefined) return;
    this.#write(this.#withRow(document, line, (row) => ({ ...row, planTasks: [...planTasks] })));
  }

  /** A wave line's snapshot, or null while the wave is open (and on a row recorded before
   *  the snapshot existed — the absent fact is never reconstructed). */
  planTasksOf(line: string): readonly number[] | null {
    const snapshot = Ledger.rowOf(this.read(), line)?.planTasks;
    return snapshot === undefined ? null : [...snapshot];
  }

  /** Record the version one line reviewed. */
  recordReviewed(line: string, reviewed: ReviewedIdentity): void {
    const document = this.read() ?? this.empty();
    this.#write(
      this.#withRow(document, line, (row) => ({
        ...row,
        reviewedRevision: Ledger.#persistedRef(reviewed),
      })),
    );
  }

  /** The version one line reviewed, or null when none was recorded. */
  reviewedOf(line: string): ReviewedIdentity | null {
    return Ledger.#reviewedOf(Ledger.rowOf(this.read(), line) ?? { wave: line });
  }

  /** Record one document review batch: the version it read and the increment of the line's
   *  batch counter. A document's SECOND review is batch 2 — the counter is the line's own
   *  history, never a re-derivation from its rounds. The version cell is the LATEST reviewed
   *  one: each review overwrites it, so the drift read always compares against the newest
   *  review rather than the first one. Only a review opens a batch — a fix moves the version
   *  through `recordReviewedDoc` and leaves this counter alone. `body` is the PROJECTED body
   *  (`docs/grammar/doc-body.ts#docBodyOf`), the slice `docDriftOf` compares. */
  recordDocReview(line: string, body: string): void {
    const document = this.read() ?? this.empty();
    const hash = ReviewedIdentity.hashOf(body);
    this.#write(
      this.#withRow(document, line, (row) => ({
        ...row,
        reviewedRevision: { kind: "doc-revision", doc: line, doc_hash: hash },
        batch: (row.batch ?? 0) + 1,
      })),
    );
  }

  /** Record the version a FIX round produced — the SAME version cell a review writes, with
   *  the line's review-batch counter untouched. A fix moves the recorded version (it edits the
   *  document it judges) but it is no review batch: only `recordDocReview` opens one, so the
   *  counter counts reviews and nothing else. */
  recordReviewedDoc(line: string, body: string): void {
    const document = this.read() ?? this.empty();
    const hash = ReviewedIdentity.hashOf(body);
    this.#write(
      this.#withRow(document, line, (row) => ({
        ...row,
        reviewedRevision: { kind: "doc-revision", doc: line, doc_hash: hash },
      })),
    );
  }

  /** A document line's recorded reviewed digest, or null before its first review (and when
   *  the recorded digest is not one this tree can compare). */
  docHashOf(line: string): string | null {
    const row = Ledger.rowOf(this.read(), line);
    if (row === undefined) return null;
    const reviewed = Ledger.#reviewedOf(row);
    return reviewed !== null && reviewed.kind === "document" ? reviewed.hash : null;
  }

  /** The drift read: the recorded reviewed version against the document's CURRENT reviewed
   *  body. Null when the line recorded no comparable version (only present facts land). The
   *  comparison is the record's own — it digests the current bytes on the basis the recorded
   *  cell was written on, so a document the shipped engine reviewed is judged against that
   *  engine's sha1 rather than read as "no record". `body` is the projection the caller made
   *  (`docs/grammar/doc-body.ts#docBodyOf`): this read carries no second projection, so the
   *  write binding and this comparison always hash one slice.
   */
  docDriftOf(line: string, body: string): Drift | null {
    const row = Ledger.rowOf(this.read(), line);
    const reviewed = row === undefined ? null : Ledger.#reviewedOf(row);
    if (reviewed === null || reviewed.kind !== "document") return null;
    return reviewed.driftFrom(body);
  }

  // -------------------------------------------------------------------------
  // rulings and re-grades
  // -------------------------------------------------------------------------

  /** Record one ruling on a finding of a line. */
  recordRuling(line: string, ruling: RulingRecord): void {
    const document = this.read() ?? this.empty();
    const rulings = this.rulingsOf(line).record(ruling);
    this.#write(
      this.#withRow(document, line, (row) => ({
        ...row,
        rulings: rulings.rulings(),
        regrades: rulings.regrades(),
      })),
    );
  }

  /** Record one re-grade — both ends of the grade change and the reason. */
  recordRegrade(line: string, regrade: RegradeRecord): void {
    const document = this.read() ?? this.empty();
    const rulings = this.rulingsOf(line).regrade(regrade);
    this.#write(
      this.#withRow(document, line, (row) => ({
        ...row,
        rulings: rulings.rulings(),
        regrades: rulings.regrades(),
      })),
    );
  }

  /** One line's recorded rulings and re-grades, read back as one value. */
  rulingsOf(line: string): Rulings {
    const row = Ledger.rowOf(this.read(), line);
    return Rulings.of({ rulings: row?.rulings, regrades: row?.regrades });
  }

  // -------------------------------------------------------------------------
  // artifacts — the path accessor, the observation set, the orphan face
  // -------------------------------------------------------------------------

  /** The coordinate one round's record lands on, as a `would record:` row spells it —
   *  `progress.waves["1"]`. The container cell and the row key are the document's own, so a
   *  sentence about the write and the write itself cannot name two rows. */
  static rowCoordinateOf(line: string): string {
    return `${Ledger.ROW_CONTAINER}["${RoundIdentity.rowKeyOf(line)}"]`;
  }

  /** The paths one round would WRITE, on the repo-relative basis, in the naming rule's
   *  order — the draft the child lands first, the round's report and, where the rule
   *  prescribes one, the test-evidence file. A consumer reads this value; it never composes
   *  a name, so the forecast and the write are the same derivation. */
  writeSetOf(line: string, op: RoundOp, cycle: number, attempt: number): readonly string[] {
    const round = new RoundIdentity({ line, op, cycle, attempt });
    return ArtifactIdentity.prescribedOf(round).map((kind) =>
      String(this.#workspace.relOf(ArtifactIdentity.nameOf(round, kind))),
    );
  }

  /** The carrier path one record resolves — THE only accessor of that fact. Step ① answers
   *  the path the RECORD remembers (`carrierPath`, a historical fact this tree never writes
   *  but every older row carries): the file that round actually wrote, which no derivation
   *  from its identity may replace — a re-dispatched cycle wrote its own name, so a ladder
   *  seeded from the identity would answer a sibling attempt's file. Step ② otherwise reads
   *  the finalized carrier first (the round's answer) and the child's draft second, and
   *  answers `""` when neither landed. */
  carrierPathOf(type: string, key: string, record: RoundRecord): RepoPath | "" {
    const recorded = record.carrierPath;
    if (typeof recorded === "string" && recorded.length > 0) {
      return this.#workspace.root.basis.relativize(recorded);
    }
    const round = new RoundIdentity({
      line: RoundIdentity.lineWordOf(type, key),
      op: record.op,
      cycle: record.cycle,
      attempt: record.attempt,
    });
    for (const kind of ["final", "draft"] as const) {
      const name = ArtifactIdentity.nameOf(round, kind);
      if (this.#workspace.readJson(name).kind === "ok") return this.#workspace.relOf(name);
    }
    return "";
  }

  /** The `handoff:` slot of one booked round — the carrier path its record resolves, on the
   *  line the round hangs on. ONE accessor: the capsule prints what this answers, so no face
   *  spells a carrier name. */
  handoffOf(line: string, record: RoundRecord): string {
    const { type, key } = this.#targetOf(line);
    return String(this.carrierPathOf(type, key, record));
  }

  /** The observation set: every REVIEW round of the ledger's own lines, one entry each
   *  `{line, kind, cycle, attempt, carrier, read}`, ordered by `(cycle, attempt)`. The set is
   *  a record sequence — a `*.rulings.json` no record claims stays on the orphan face and
   *  never enters here. The SEAT is the caller's choice of ledger instance (a node board
   *  reads the node's workspace, the program board the program's): two seats are two names,
   *  never a positional argument. An instance with no artifact index answers nothing.
   *
   *  `lines` is the SCOPE the caller's face observes — the board's own row words — so a row
   *  the face does not print never enters the inventory. A round whose carrier resolves to no
   *  file on this seat contributes nothing: the observation names a file, and an empty name is
   *  the orphan face's business, not an `absent` row of its own. The line cell is the
   *  carrier's OWN attributed word (a legacy row's key names no line the artifact grammar
   *  knows), falling back to the row's word. */
  observedArtifacts(lines?: readonly string[]): readonly ArtifactObservation[] {
    const artifacts = this.#artifacts;
    if (artifacts === null) return [];
    const reads = new ArtifactReads({ artifacts, source: this.#source() });
    const document = this.read();
    // The SCOPE's order is the observation order (the caller's face prints its rows in that
    // order), and a line word with no row contributes nothing — a legacy row keyed under
    // another word is not a row this face observes.
    const words =
      lines ?? (document?.waves ?? []).map((row) => RoundIdentity.lineWordOfRowKey(row.wave));
    const observations: ArtifactObservation[] = [];
    for (const line of words) {
      const row = Ledger.rowOf(document, line);
      if (row === undefined) continue;
      for (const record of row.rounds ?? []) {
        if (record.op !== "review") continue;
        const { type, key } = this.#targetOf(line);
        const carrier = this.carrierPathOf(type, key, record);
        if (carrier === "") continue;
        observations.push({
          line: Ledger.#observedLineOf(artifacts, carrier, line),
          kind: "rulings",
          cycle: record.cycle,
          attempt: record.attempt,
          carrier,
          read: reads.read(
            new RoundIdentity({
              line,
              op: record.op,
              cycle: record.cycle,
              attempt: record.attempt,
            }),
            "rulings",
            { path: carrier, digest: record.carrierDigest },
          ),
        });
      }
    }
    return observations.sort(
      (left, right) => left.cycle - right.cycle || left.attempt - right.attempt,
    );
  }

  /** The line word an observed carrier names — the artifact grammar's own attributed line,
   *  or the row word when the name places no round (a cycle-less legacy carrier names a line
   *  but no round, and the row is then the only declaration of where it hangs). */
  static #observedLineOf(artifacts: Artifacts, carrier: RepoPath, fallback: string): string {
    const name = String(carrier).split("/").pop() ?? "";
    const attributed = artifacts.attribute(name);
    return attributed === null ? fallback : attributed.round.line;
  }

  /** The workspace's ORPHAN names, the two-tier judgment: (i) a name no artifact kind renders
   *  — an observation, never a refusal; (ii) a name rendering the carrier pair (`draft` /
   *  `final`) that no record claims — a carrier already on disk the ledger never booked stays
   *  visible, so a recovery pass can see it. Every other attributable name (a report, a log,
   *  a sidecar, a legacy cycle-less report) is the board's own attachment, not a carrier. The
   *  candidate set is the workspace's FILES: a directory is not an artifact, and the engine's
   *  own `scratch/` must not read as an unattributed one. A ledger with no artifact index
   *  answers the empty set: attribution is the index's, and "no index" has no second name
   *  grammar to fall back on. Zero writes — a pure read. */
  orphanHandoffs(): readonly string[] {
    const artifacts = this.#artifacts;
    if (artifacts === null) return [];
    const document = this.read();
    const orphans: string[] = [];
    for (const name of this.#names()) {
      if (this.#reserved.has(name)) continue;
      const named = ArtifactIdentity.lineAndKindOf(name);
      if (named === null) {
        orphans.push(name);
        continue;
      }
      if (named.kind !== "draft" && named.kind !== "final") continue;
      if (this.#claimed(document, named.line, name)) continue;
      orphans.push(name);
    }
    return orphans.sort();
  }

  // -------------------------------------------------------------------------
  // the private read helpers
  // -------------------------------------------------------------------------

  /** The rows of one line kind, in document order. */
  #rowsOf(kind: "wave" | "doc" | "branch"): readonly LedgerRow[] {
    return (this.read()?.waves ?? []).filter(
      (row) => RoundIdentity.lineKindOfRowKey(row.wave) === kind,
    );
  }

  /** One line word folded to the carrier pair's `(type, key)` — a wave line resolves against
   *  the single `wave` artifact type, every other line against its own word. THE one home of
   *  that fold: the carrier accessor and the orphan face both read it, so adding a line kind
   *  or renaming the wave prefix moves both, together. */
  #targetOf(word: string): { readonly type: string; readonly key: string } {
    const { kind, key } = RoundIdentity.splitLineWord(word);
    return { type: kind === "wave" ? "wave" : word, key };
  }

  /** Whether a record claims one attributable carrier name — the identity tier first (the
   *  name's own `(op, cycle, attempt)` on the row's line; a cycle-less name has no identity
   *  and skips this tier), the recorded-path tier second (a record whose own carrier path
   *  carries this base name — the only tier a legacy cycle-less carrier can be claimed
   *  through). Both tiers read the carrier path through `carrierPathOf`, the ONE accessor of
   *  that fact, so a record's remembered path is judged on the same reading that prints it. */
  #claimed(document: LedgerDocument | null, line: string, name: string): boolean {
    const { type, key } = this.#targetOf(line);
    const identity = ArtifactIdentity.attribute(name)?.round ?? null;
    return (Ledger.rowOf(document, line)?.rounds ?? []).some((record) => {
      if (
        identity !== null &&
        record.op === identity.op &&
        record.cycle === identity.cycle &&
        record.attempt === identity.attempt
      ) {
        return true;
      }
      return (this.carrierPathOf(type, key, record).split("/").pop() ?? "") === name;
    });
  }

  /** The artifact read source over this ledger's workspace. */
  #source(): ArtifactSource {
    return {
      names: this.#names,
      readText: (target) => {
        const read = this.#workspace.readText(target);
        return read.kind === "text" ? read.value : null;
      },
      relOf: (name) => this.#workspace.relOf(name),
    };
  }

  /** One row's persisted reviewed version, or null when the row records none this tree can
   *  compare. The digest cell is the frozen one, and a digest of another algorithm (or no
   *  digest at all) is not a fact this read can judge against: the answer is null — "no
   *  recorded version" — never a fabricated drift. */
  static #reviewedOf(row: LedgerRow): ReviewedIdentity | null {
    const ref = row.reviewedRevision;
    if (ref === undefined) return null;
    const facts = Ledger.#reviewedFactsOf(ref);
    if (facts === null) return null;
    try {
      return new ReviewedIdentity(facts);
    } catch {
      return null;
    }
  }

  /** The frozen reviewed-revision union folded to the identity's own facts — the ONE place
   *  the persisted kind words meet `ReviewedKind`. An unknown kind is no fact. */
  static #reviewedFactsOf(
    ref: PersistedReviewed,
  ): { kind: ReviewedKind; path: string; hash: string } | null {
    if (ref.kind === "doc-revision") {
      return { kind: "document", path: ref.doc, hash: ref.doc_hash };
    }
    if (ref.kind === "brief-revision") {
      return { kind: "brief", path: ref.plan, hash: ref.brief_hash };
    }
    return null;
  }

  /** One identity as the document's frozen cell — the inverse fold of `#reviewedFactsOf`. */
  static #persistedRef(reviewed: ReviewedIdentity): PersistedReviewed {
    return reviewed.kind === "document"
      ? { kind: "doc-revision", doc: reviewed.path, doc_hash: reviewed.hash }
      : { kind: "brief-revision", plan: reviewed.path, brief_hash: reviewed.hash };
  }

  /** One row as the readers see it — the frozen row cells with its `rounds` plane folded.
   *  A row that carried no `rounds` cell keeps carrying none: this tree adds cells, it never
   *  writes one the document did not have. */
  static #rowOf(raw: PersistedRow): LedgerRow {
    const { rounds, ...cells } = raw;
    return rounds === undefined ? cells : { ...cells, rounds: Ledger.#roundsOf(rounds) };
  }

  /** The ONE fold of the row's `rounds` plane: the record array this tree writes, the two
   *  legacy per-mode forms the shipped engine folds, and nothing else (an entry that names no
   *  declared op or no round coordinate is not a round). The legacy forms fold into
   *  COMPLETED records — the old writer booked only rounds that passed — exactly as
   *  `RoundRecords.completed` does, so the two readers agree on what a legacy row records. */
  static #roundsOf(raw: unknown): readonly RoundRecord[] {
    if (Array.isArray(raw)) {
      return raw
        .map((entry) => Ledger.#recordOf(entry))
        .filter((record): record is RoundRecord => record !== null);
    }
    if (raw === null || typeof raw !== "object") return [];
    const folded: RoundRecord[] = [];
    for (const [mode, cycles] of Object.entries(raw as Record<string, unknown>)) {
      const op = Ledger.#legacyOpOf(mode);
      if (op === null) continue;
      for (const cycle of Ledger.#cyclesOf(cycles)) folded.push(Ledger.#completedOf(op, cycle));
    }
    return folded.sort((left, right) => left.cycle - right.cycle);
  }

  /** One recorded round with the cells an older or hand-written row may omit defaulted —
   *  the shape this class's readers index without a guard. A record with no declared op or
   *  no cycle/attempt coordinate is not a round this engine books. The recorded object is
   *  OVERLAID, never rebuilt: the record shape is a union across engines (a superseded fix
   *  carries a `supersededBy` stamp, an older document names a `carrierPath`), and this fold's
   *  output is what every writer persists — a record rebuilt to the seven declared cells would
   *  delete the cells this tree does not read from the document's only copy. */
  static #recordOf(entry: unknown): RoundRecord | null {
    if (entry === null || typeof entry !== "object") return null;
    const raw = entry as Partial<RoundRecord>;
    const op = raw.op as unknown;
    if (typeof op !== "string" || !ROUND_OPS.includes(op as RoundOp)) return null;
    if (typeof raw.cycle !== "number" || typeof raw.attempt !== "number") return null;
    return {
      ...raw,
      op: op as RoundOp,
      cycle: raw.cycle,
      attempt: raw.attempt,
      dispatchBase: raw.dispatchBase ?? null,
      verdict: raw.verdict ?? { treeClean: true, targetAction: true },
      violations: Array.isArray(raw.violations) ? raw.violations : [],
      carrierDigest: raw.carrierDigest ?? null,
    };
  }

  /** One completed record of an op/cycle — the legacy fold's record, identical to the one
   *  the shipped reader builds (attempt 1, clean verdict, no violations). */
  static #completedOf(op: RoundOp, cycle: number): RoundRecord {
    return {
      op,
      cycle,
      attempt: 1,
      dispatchBase: null,
      verdict: { treeClean: true, targetAction: true },
      violations: [],
      carrierDigest: null,
    };
  }

  /** The op a legacy per-mode key belongs to — branch review rides the review family, and an
   *  unknown key is not a round record (the shipped reader's own fold). */
  static #legacyOpOf(mode: string): RoundOp | null {
    if (mode === "branch-review") return "review";
    return ROUND_OPS.includes(mode as RoundOp) ? (mode as RoundOp) : null;
  }

  /** The cycles one legacy per-mode value records: an explicit cycle array, or a count that
   *  folds to the contiguous run `1..n` (the old writer recorded every cycle it completed). */
  static #cyclesOf(value: unknown): readonly number[] {
    if (Array.isArray(value)) {
      return value.filter((cycle): cycle is number => Number.isFinite(cycle));
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return [];
    return Array.from({ length: Math.trunc(value) }, (_unused, index) => index + 1);
  }

  /** One counter cell as recorded — a document written by another engine, or one hand-edited
   *  to a non-number, answers the zero rather than poisoning a later read. */
  static #counterOf(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  /** The next un-registered cycle of one op — latest on record + 1 (1 when none). */
  static #nextCycle(records: readonly RoundRecord[], op: RoundOp): number {
    const cycles = records.filter((record) => record.op === op).map((record) => record.cycle);
    return cycles.length > 0 ? Math.max(...cycles) + 1 : 1;
  }

  /** Whether one violation is HARD — the crash predicate's one cell. */
  static #hard(violation: RoundViolation): boolean {
    return violation.grade === "hard";
  }
}
