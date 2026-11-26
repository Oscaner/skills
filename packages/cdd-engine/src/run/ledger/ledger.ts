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
// Rule zero (over the 200-line class limit): the ledger is ONE object with one invariant
// (one fact, one writer) and one persist point; splitting it by reader would put the same
// document behind several writers, which is exactly the defect the invariant names.

import type { RepoPath } from "../../env/paths/root.ts";
import type { Workspace } from "../../env/workspace/workspace.ts";
import { type ArtifactRead, ArtifactReads, type ArtifactSource } from "./artifact-reads.ts";
import { ArtifactIdentity, type ArtifactKind, type Artifacts } from "./artifacts.ts";
import { ROUND_OPS, RoundIdentity, type RoundOp } from "./identity.ts";
import { type Drift, REVIEWED_KINDS, ReviewedIdentity, type ReviewedKind } from "./reviewed.ts";
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

/** One line's persisted record — the row the ledger document holds. The snake_case keys are
 *  the FILE's contract (an engine artifact, not a consumer surface); the class's accessors
 *  are the API. */
interface LedgerRow {
  readonly key: string;
  readonly rounds?: readonly RoundRecord[];
  readonly plan_tasks?: readonly number[];
  readonly doc_hash?: string;
  readonly batch?: number;
  readonly reviewed?: {
    readonly kind: ReviewedKind;
    readonly path: string;
    readonly hash: string;
  };
  readonly rulings?: readonly RulingRecord[];
  readonly regrades?: readonly RegradeRecord[];
}

/** The ledger's persisted document — the one file this class writes. */
export interface LedgerDocument {
  /** The `--plan` path recorded at first create. */
  readonly plan?: string;
  /** The recorded lines, in first-write order. */
  readonly lines: readonly LedgerRow[];
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
   *  invents state). */
  read(): LedgerDocument | null {
    const read = this.#workspace.readJson(Ledger.FILE);
    if (read.kind !== "ok") return null;
    const value = read.value as Partial<LedgerDocument> | null;
    if (value === null || typeof value !== "object" || !Array.isArray(value.lines)) return null;
    return { ...(typeof value.plan === "string" ? { plan: value.plan } : {}), lines: value.lines };
  }

  /** The empty document — a fresh session's starting point. */
  empty(): LedgerDocument {
    return { lines: [] };
  }

  /** The ledger's ONE write point: the atomic write of the whole document. */
  #write(document: LedgerDocument): void {
    this.#workspace.writeJson(Ledger.FILE, document);
  }

  /** One row, or undefined. */
  static rowOf(document: LedgerDocument | null, key: string): LedgerRow | undefined {
    return document?.lines.find((row) => row.key === key);
  }

  /** The document with one row replaced (or appended) — the immutable update every writer
   *  funnels through, so no writer mutates a row in place. */
  #withRow(document: LedgerDocument, key: string, update: (row: LedgerRow) => LedgerRow) {
    const index = document.lines.findIndex((row) => row.key === key);
    const lines = [...document.lines];
    if (index === -1) lines.push(update({ key }));
    else lines[index] = update(lines[index] as LedgerRow);
    return { ...document, lines };
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
    return (document?.lines ?? []).flatMap((row) => row.rounds ?? []);
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
    return this.#rowsOf("wave").map((row) => ({
      line: row.key,
      taskIds: RoundIdentity.taskIdsOfWord(row.key),
      rounds: [...(row.rounds ?? [])],
      planTasks: row.plan_tasks === undefined ? null : [...row.plan_tasks],
      reviewed: Ledger.#reviewedOf(row),
    }));
  }

  /** The document review lines, in the document's first-write order. The reviewed version
   *  is DERIVED from the row's own `doc_hash` cell — one persisted fact, one read face. */
  docLines(): readonly DocLine[] {
    return this.#rowsOf("doc").map((row) => ({
      line: row.key,
      rounds: [...(row.rounds ?? [])],
      docHash: row.doc_hash ?? null,
      batch: row.batch ?? 0,
      reviewed:
        row.doc_hash === undefined
          ? null
          : new ReviewedIdentity({ kind: "document", path: row.key, hash: row.doc_hash }),
    }));
  }

  /** The branch line, or null when the branch has no record. */
  branchLine(): BranchLine | null {
    const row = this.#rowsOf("branch")[0];
    if (row === undefined) return null;
    return {
      line: row.key,
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
    if (Ledger.rowOf(document, line)?.plan_tasks !== undefined) return;
    this.#write(this.#withRow(document, line, (row) => ({ ...row, plan_tasks: [...planTasks] })));
  }

  /** A wave line's snapshot, or null while the wave is open (and on a row recorded before
   *  the snapshot existed — the absent fact is never reconstructed). */
  planTasksOf(line: string): readonly number[] | null {
    const snapshot = Ledger.rowOf(this.read(), line)?.plan_tasks;
    return snapshot === undefined ? null : [...snapshot];
  }

  /** Record the version one line reviewed. */
  recordReviewed(line: string, reviewed: ReviewedIdentity): void {
    const document = this.read() ?? this.empty();
    this.#write(
      this.#withRow(document, line, (row) => ({
        ...row,
        reviewed: { kind: reviewed.kind, path: reviewed.path, hash: reviewed.hash },
      })),
    );
  }

  /** The version one line reviewed, or null when none was recorded. */
  reviewedOf(line: string): ReviewedIdentity | null {
    return Ledger.#reviewedOf(Ledger.rowOf(this.read(), line) ?? { key: line });
  }

  /** Record one document review batch: the version it read (`doc_hash`) and the increment
   *  of the line's batch counter. A document's SECOND review is batch 2 — the counter is
   *  the line's own history, never a re-derivation from its rounds. `doc_hash` is the
   *  LATEST reviewed version: each review overwrites it, so the drift read always compares
   *  against the newest review rather than the first one. */
  recordDocReview(line: string, content: string): void {
    const document = this.read() ?? this.empty();
    const hash = ReviewedIdentity.hashOf(content);
    this.#write(
      this.#withRow(document, line, (row) => ({
        ...row,
        doc_hash: hash,
        batch: (row.batch ?? 0) + 1,
      })),
    );
  }

  /** A document line's recorded reviewed digest, or null before its first review. */
  docHashOf(line: string): string | null {
    return Ledger.rowOf(this.read(), line)?.doc_hash ?? null;
  }

  /** The drift read: the recorded reviewed version against the document's CURRENT bytes.
   *  Null when the line recorded no version (only present facts land). */
  docDriftOf(line: string, content: string): Drift | null {
    const recorded = this.docHashOf(line);
    if (recorded === null) return null;
    return recorded === ReviewedIdentity.hashOf(content) ? "same" : "drift";
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

  /** The carrier path one record resolves — THE only accessor of that fact. The identity
   *  comes from the record's four cells; the ladder reads the finalized carrier first (the
   *  round's answer) and the child's draft second, and answers `""` when neither landed. */
  carrierPathOf(type: string, key: string, record: RoundRecord): RepoPath | "" {
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

  /** The observation set: every REVIEW round of this ledger's own lines, one entry each
   *  `{line, kind, cycle, attempt, carrier, read}`, ordered by `(cycle, attempt)`. The set is
   *  a record sequence — a `*.rulings.json` no record claims stays on the orphan face and
   *  never enters here. The SEAT is the caller's choice of ledger instance (a node board
   *  reads the node's workspace, the program board the program's): two seats are two names,
   *  never a positional argument. An instance with no artifact index answers nothing. */
  observedArtifacts(): readonly ArtifactObservation[] {
    const artifacts = this.#artifacts;
    if (artifacts === null) return [];
    const reads = new ArtifactReads({ artifacts, source: this.#source() });
    const observations: ArtifactObservation[] = [];
    for (const row of this.read()?.lines ?? []) {
      for (const record of row.rounds ?? []) {
        if (record.op !== "review") continue;
        const { type, key } = this.#targetOf(row.key);
        const carrier = this.carrierPathOf(type, key, record);
        observations.push({
          line: row.key,
          kind: "rulings",
          cycle: record.cycle,
          attempt: record.attempt,
          carrier,
          read: reads.read(
            new RoundIdentity({
              line: row.key,
              op: record.op,
              cycle: record.cycle,
              attempt: record.attempt,
            }),
            "rulings",
            carrier === "" ? null : { path: carrier, digest: record.carrierDigest },
          ),
        });
      }
    }
    return observations.sort(
      (left, right) => left.cycle - right.cycle || left.attempt - right.attempt,
    );
  }

  /** The workspace's ORPHAN names, the two-tier judgment: (i) a name no row renders at all —
   *  an observation, never a refusal; (ii) a name rendering the carrier pair (`draft` /
   *  `final`) that no record claims — a carrier already on disk the ledger never booked
   *  stays visible, so a recovery pass can see it. Every other attributable name (a report,
   *  a log, a sidecar) is the board's own attachment, not a carrier. A ledger with no
   *  artifact index answers the empty set: attribution is the index's, and "no index" has
   *  no second name grammar to fall back on. Zero writes — a pure read. */
  orphanHandoffs(): readonly string[] {
    const artifacts = this.#artifacts;
    if (artifacts === null) return [];
    const document = this.read();
    const orphans: string[] = [];
    for (const name of this.#names()) {
      if (this.#reserved.has(name)) continue;
      const attributed = artifacts.attribute(name);
      if (attributed === null) {
        orphans.push(name);
        continue;
      }
      if (attributed.kind !== "draft" && attributed.kind !== "final") continue;
      if (this.#claimed(document, attributed, name)) continue;
      orphans.push(name);
    }
    return orphans.sort();
  }

  // -------------------------------------------------------------------------
  // the private read helpers
  // -------------------------------------------------------------------------

  /** The rows of one line kind, in document order. */
  #rowsOf(kind: "wave" | "doc" | "branch"): readonly LedgerRow[] {
    return (this.read()?.lines ?? []).filter(
      (row) => RoundIdentity.splitLineWord(row.key).kind === kind,
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

  /** Whether a record claims one attributed carrier name — the identity tier first (the
   *  record's own `(op, cycle, attempt)` on the same line), the recorded-path tier second
   *  (a record whose own carrier path carries this base name). */
  #claimed(document: LedgerDocument | null, attributed: ArtifactIdentity, name: string): boolean {
    const round = attributed.round;
    const { type, key } = this.#targetOf(round.line);
    return (Ledger.rowOf(document, round.line)?.rounds ?? []).some((record) => {
      if (
        record.op === round.op &&
        record.cycle === round.cycle &&
        record.attempt === round.attempt
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

  /** One row's recorded reviewed version, or null. */
  static #reviewedOf(row: LedgerRow): ReviewedIdentity | null {
    const reviewed = row.reviewed;
    if (reviewed === undefined || !REVIEWED_KINDS.includes(reviewed.kind)) return null;
    return new ReviewedIdentity({
      kind: reviewed.kind,
      path: reviewed.path,
      hash: reviewed.hash,
    });
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
