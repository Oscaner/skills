// packages/cdd-engine/src/run/gate/preflight.ts
// The work tree's gate — the ONE seam a dispatch consults before a child exists.
//
// INVARIANT — a refusal is a fact about the TREE, never about a round: at any instant at
// most one refusal stands, a refusal books no round, and every row the gate runs is read
// off one closed row set. This file judges; the `run/ledger` facts are what a row is
// handed, never something this file writes.
//
// THE ROW SET is one closed vocabulary in two parts, and the parts are the SAME set:
//   · the structural legs — `tree-clean` · `in-flight` · `graph` · `plan-ledger` ·
//     `doc-contract`;
//   · the four pre-dispatch stations — `no-host` · `carrier` · `dispatch-input` ·
//     `artifact`, the rows that used to be judged inside the dispatch body. Merging them
//     here is the point: one row set, one verdict, one place a refusal is recorded.
// `PRE_FLIGHT_GATE_NAMES` is that set's runtime companion and `rowsOf` derives a face's
// rows from it — a face hits as many rows as ITS OWN reading says (a plan dispatch nine, a
// wave eight, a branch or a document seven on a ready plan), never a constant count.
//
// Each row is judged by its OWN authority, and this file adjudicates none of them twice:
//   · `graph` reads the injected `TaskGraph#validate()` failure set and renders it through
//     `TaskGraph.detailLine()` — the gate `new`s no second edge rule;
//   · `plan-ledger` and `doc-contract` hand their injected facts to the document slice's
//     own entry (`judgeLedger` / `judge`) and read the stamped findings back;
//   · the four stations arrive as a VALUE (`DispatchRowReading[]`) from the face that
//     assembled the dispatch's values, or as `null` when the face has NO input face at all
//     (a wave dispatch with no predicted batch) — then all four YIELD, one reading each,
//     and judge nothing.
//
// THE CHECKED FACE is data, not bytes: one row per gate and one per declared rule, each
// carrying its reading as a value. The words a consumer prints for those readings belong to
// the word table (`surface/words`), so this file spells no sentence. Three yield shapes are
// distinct facts and stay distinct: a rule the CLOSED document exempted (`skipWhenClosed`
// over the closure reading the document slice already owns) reads as a yield, a rule whose
// input face is absent reads as a yield, and a row that never ran because an earlier row
// refused is simply absent from the face. The `plan-ledger` gate row carries the count of
// plan tasks the ledger has not recorded yet (`LedgerTaskSetRule.planAhead`) — the old
// seam's `plan-ahead: N` info line as a reading, so a plan that leads the ledger still has
// a row of its own.
//
// JUDGING AND SETTLING ARE TWO STEPS. `vet` reads and judges only: it writes nothing, takes
// no lock and spawns nothing, which is what makes a `--dry-run` preview a pure read (a
// preview over a tree that carries a standing refusal must not delete the fact it was asked
// to preview). `settle(verdict)` is the ONE write point — an approved verdict clears the
// tree's record at the door, a refused one publishes it — and only the real dispatch path
// calls it.
//
// The plan read is never judged here: a plan that cannot be read is the frame assembly's
// declared `read-failure` value (`run/advance/frame.ts#Frame#of`, owned and pinned by T13),
// so `PreFlightContext#graph` is `null` on a read that is not ready and the `graph` row is
// not judged at all. The gate judges a plan read, it never produces one.
//
// The refusal record is `./refusal.ts` — one record, two expiry triggers (this gate's own
// door when the structural leg does not refuse, and `InFlight#release`). Writing it is the
// ONLY side effect of a refusal; the round is untouched, which is what "a refusal books no
// round" means mechanically.
//
// Module-level exports are types / the declared vocabulary / the class — zero
// behaviour-carrying bare functions.

import type {
  Documents,
  Finding,
  JudgeInput,
  LedgerFacts,
  RuleDeclaration,
  TargetType,
  TaskGraph,
} from "../../docs/index.ts";
import { TaskGraph as Graph, LedgerTaskSetRule } from "../../docs/index.ts";
import type { RoundOp } from "../ledger/identity.ts";
import type { Refusal, RefusalBody, RefusalPublish } from "./refusal.ts";

/** The structural legs, in judgment order — the gate's own half of the row set. */
export type StructureRow = "tree-clean" | "in-flight" | "graph" | "plan-ledger" | "doc-contract";

/** The declared structural rows, in judgment order. */
export const STRUCTURE_ROWS = [
  "tree-clean",
  "in-flight",
  "graph",
  "plan-ledger",
  "doc-contract",
] as const satisfies readonly StructureRow[];

/** The four pre-dispatch stations — MEMBERS of the gate's row set, never a second set
 *  beside it. Each is one judgment over the dispatch's own input face. */
export type RowStation = "no-host" | "carrier" | "dispatch-input" | "artifact";

/** The declared stations, in judgment order. */
export const ROW_STATIONS = [
  "no-host",
  "carrier",
  "dispatch-input",
  "artifact",
] as const satisfies readonly RowStation[];

/** THE gate row set: the structural legs and the four stations, one closed vocabulary. */
export type PreFlightGateName = StructureRow | RowStation;

/** The runtime companion of `PreFlightGateName` — the closed set, in judgment order. A row
 *  that joins the vocabulary joins HERE first, and every reading face derives from it. */
export const PRE_FLIGHT_GATE_NAMES: readonly PreFlightGateName[] = [
  ...STRUCTURE_ROWS,
  ...ROW_STATIONS,
];

/** The named refusal rows — the reason one structural leg refused. The four stations carry
 *  no word from this set: their station IS the row, and their detail is the row's own
 *  conclusion (a fifth vocabulary would name one refusal twice). Every declared reason is
 *  reachable through the row set: `dirty-tree` ← `tree-clean` · `held` and `corrupt-record`
 *  ← `in-flight` · `graph` ← `graph` · `doc-contract` ← `doc-contract`; the `plan-ledger`
 *  row refuses without a reason word, exactly as its own readings read. */
export type PreFlightReason = "dirty-tree" | "held" | "corrupt-record" | "graph" | "doc-contract";

/** The declared reasons, in judgment order. */
export const PRE_FLIGHT_REASONS = [
  "dirty-tree",
  "held",
  "corrupt-record",
  "graph",
  "doc-contract",
] as const satisfies readonly PreFlightReason[];

/** The ONE document rule that reads the plan's topological layers — the row whose verdict
 *  is undecided when a caller injects no layer set, so its reading says so instead of
 *  claiming `passed`. The id is the rule table's own spelling (`docs/judging/rules.ts`). */
const LAYER_RULE = "wave-width-at-most-three";

/** Which structural rows one target face carries. Three flags, one row per face — the
 *  difference between a plan dispatch and a wave dispatch is a table row, never a branch in
 *  the judgment. */
interface FaceRows {
  /** Whether the face judges the plan's graph (when the plan read is ready). */
  readonly graph: boolean;
  /** Whether the face judges the plan/ledger agreement. */
  readonly ledger: boolean;
  /** Whether the face judges a target document's shape. */
  readonly docContract: boolean;
}

/** The face table — one row per target type. */
const FACE_ROWS: Readonly<Record<TargetType, FaceRows>> = {
  wave: { graph: true, ledger: true, docContract: false },
  plan: { graph: true, ledger: true, docContract: true },
  branch: { graph: false, ledger: true, docContract: false },
  "phase-spec": { graph: false, ledger: false, docContract: true },
  "single-spec": { graph: false, ledger: false, docContract: true },
  overall: { graph: false, ledger: false, docContract: true },
};

/** The git read the `tree-clean` row judges — `env/vcs/git.ts#GitClient` in production. A
 *  non-repo and an unreadable git both answer `false` there, which is why a tree the engine
 *  cannot read never passes the door. */
export interface TreeRead {
  isClean(cwd: string): Promise<boolean>;
}

/** The document slice's reads this gate is allowed — a PROJECTION of the concrete
 *  `Documents`, not a hand-written port. There is no second implementation in production
 *  (the document slice is a sibling, not a boundary), so the projection's only job is to
 *  narrow what the gate may call; deriving it from the class means a signature change in
 *  `Documents` breaks here instead of drifting. A case that must dictate a finding nobody
 *  can produce satisfies the same projection, and at least one case judges a REAL
 *  `Documents` over the temp tree. */
export type DocJudgment = Pick<Documents, "judge" | "judgeLedger" | "ruleRows" | "closedAt">;

/** The held record's reading — the three states the dispatch face judged, with the record's
 *  identity cells and its own target facts. The gate re-derives neither liveness nor the
 *  record's shape: a second liveness reader is the defect the one-author rule forbids. */
export type InFlightReading =
  | { readonly kind: "absent" }
  | { readonly kind: "corrupt"; readonly locked: boolean }
  | {
      readonly kind: "held";
      /** The holder process's pid — the fact a holder report names. */
      readonly pid: number;
      /** Whether the holder process is live (an unreadable start time folds to `true`). */
      readonly alive: boolean;
      /** The record's own target cells that read out missing; empty when every one stands. */
      readonly targetGone: readonly string[];
    };

/** One station row's reading — the station that judged and its conclusion. The conclusion
 *  is the station's OWN body (multi-line, never led by the station word); the station is a
 *  separate cell, so the door adds it exactly once. */
export interface DispatchRowReading {
  readonly station: RowStation;
  readonly detail: string;
}

/** The plan/ledger row's two inputs — the plan document under judgment and the ledger fact
 *  bundle. Assembled by the frame that read both (`run/advance`), never re-derived here. */
export interface PlanLedgerTarget {
  readonly input: JudgeInput;
  readonly facts: LedgerFacts;
}

/** The in-flight row's state word — the closed vocabulary the `checked:` face renders. */
export type InFlightWord =
  | "free"
  | "held"
  | "stale"
  | "stale-target-gone"
  | "corrupt-locked"
  | "corrupt-unlocked";

/** Why a rule row yields instead of answering passed/failed — the closed skip vocabulary. */
export type SkipReason =
  | "no-doc-target"
  | "doc-not-judged"
  | "unreadable-doc"
  | "closed-document"
  | "no-plan-layers"
  | "no-ledger-facts"
  | "no-input-face";

/** One checked row's reading, as a value — the word table renders it, this file never does. */
export type CheckedReading =
  | { readonly kind: "ran" }
  | {
      readonly kind: "in-flight";
      readonly state: InFlightWord;
      readonly pid?: number;
      readonly targetGone?: readonly string[];
    }
  /** The `plan-ledger` gate row — its own conclusion plus the plan-ahead count (the plan
   *  tasks the ledger has not recorded yet; `0` when the ledger holds them all). */
  | { readonly kind: "plan-ledger"; readonly ahead: number }
  | {
      readonly kind: "rule";
      readonly result: "passed" | "failed" | "warned";
      readonly count: number;
    }
  | { readonly kind: "skipped"; readonly reason: SkipReason };

/** One row of the `checked:` face. */
export interface CheckedRow {
  /** The row's label — a gate name or a declared rule id. */
  readonly row: string;
  readonly reading: CheckedReading;
}

/** One pre-flight verdict — the gate's whole answer for one dispatch. */
export interface PreFlightVerdict {
  /** Whether the dispatch is approved (every applicable row passed). */
  readonly ok: boolean;
  /** The refusing row (absent when `ok`). */
  readonly gate?: PreFlightGateName;
  /** The named refusal reason (absent when `ok`, on the station rows and on
   *  `plan-ledger`, which name their row instead). */
  readonly reason?: PreFlightReason;
  /** The named issue/finding lines the refusal prints under its conclusion. */
  readonly details?: readonly string[];
  /** The in-flight fact the row judged — present only when `in-flight` was the refusing
   *  row, so a `--dry-run` preview reads the holder facts from the verdict itself. */
  readonly holding?: InFlightReading;
  /** The rows that ran, in judgment order — the judgeable sequence. */
  readonly order: readonly PreFlightGateName[];
  /** The checked face — one row per gate that ran and one per declared rule. */
  readonly checked: readonly CheckedRow[];
  /** The approved gate's own document findings — the baseline a fix round's close-out leg
   *  compares against. Empty when the face judged no document. */
  readonly findings?: readonly Finding[];
  /** The record this refusal would land, as the cells the write point needs — absent on an
   *  approved verdict. `vet` assembles it and writes nothing; `settle` publishes it. Named
   *  for the FACT, not for the `Refusal` collaborator that stores it. */
  readonly record?: RefusalBody;
}

/** One dispatch's gate inputs. Everything here is a FACT already read (the tree's
 *  cleanliness excepted, which is the gate's own injected read): the gate assembles no
 *  fact and spells no path. */
export interface PreFlightContext {
  /** The dispatch's target type. */
  readonly type: TargetType;
  /** The phase workspace that judges — the slug the refusal record is filtered by. */
  readonly slug: string;
  /** The verb the refused dispatch would have consumed. */
  readonly op: RoundOp;
  /** The cycle the refused dispatch would have consumed (booked by nothing). */
  readonly cycle: number;
  /** The attempt the refused dispatch would have consumed. */
  readonly attempt: number;
  /** The explicit takeover flag. It never crosses a LIVE holder: a dead record or a
   *  corrupt-record-with-lock passes only under it. */
  readonly recover?: boolean;
  /** The tree's occupancy reading (`run/dispatch/inflight.ts` in production). */
  readonly inflight: InFlightReading;
  /** The plan's graph when the plan read is ready; `null` off the graph faces and on a
   *  read that is not ready (the row is then not judged at all). */
  readonly graph: TaskGraph | null;
  /** The plan/ledger row's inputs; `null` when the face carries no ledger fact bundle
   *  (the row then renders `skipped`, never a refusal). */
  readonly planLedger: PlanLedgerTarget | null;
  /** The document row's target; `null` when the doc read produced no text (the row renders
   *  `unreadable` and the byte, if any, is the usage face's). */
  readonly doc: JudgeInput | null;
  /** The four stations' reading of this dispatch, or `null` when the face has NO input
   *  face — then all four yield and judge nothing. */
  readonly rows: readonly DispatchRowReading[] | null;
}

/** The gate's construction facts. */
export interface PreFlightOptions {
  /** The absolute repository root the tree read judges. */
  readonly repoRoot: string;
  /** The git read. */
  readonly tree: TreeRead;
  /** The document slice's judgment face. */
  readonly docs: DocJudgment;
  /** The tree-level refusal record. */
  readonly refusal: Refusal;
}

/** What a row's step is handed: the outcomes the rows before it reached — the rule rows and
 *  the read-only legs carry them forward, never recompute them. */
interface RowCarried {
  readonly doc: DocOutcome;
  readonly ledger: LedgerOutcome;
}

/** One refusal's cells as the gate assembles them, before the record is written. */
interface RefusalSpec {
  readonly gate: PreFlightGateName;
  readonly reason?: PreFlightReason;
  readonly details?: readonly string[];
  readonly holding?: InFlightReading;
  /** The ONE line the record keeps: the refusal's own conclusion, never led by the row. */
  readonly detail: string;
}

/** The document row's outcome, as the rule rows read it. */
type DocOutcome =
  | {
      readonly kind: "judged";
      readonly findings: readonly Finding[];
      readonly closed: boolean;
      readonly layersAvailable: boolean;
    }
  | { readonly kind: "no-doc-target" }
  | { readonly kind: "not-judged" }
  | { readonly kind: "unreadable" };

/** The ledger row's outcome. */
type LedgerOutcome =
  | {
      readonly kind: "judged";
      readonly findings: readonly Finding[];
      /** The plan-ahead count the `plan-ledger` gate row reports. */
      readonly ahead: number;
    }
  | { readonly kind: "no-ledger-facts" };

/** One row's judgment — the rows it ran, the checked rows it added, the outcomes the rule
 *  rows quote, and the refusal it owns (or `null` when it passed). */
interface RowStep {
  readonly ran: readonly PreFlightGateName[];
  readonly checked: readonly CheckedRow[];
  readonly doc: DocOutcome;
  readonly ledger: LedgerOutcome;
  readonly refusal: RefusalSpec | null;
}

/** The face's running tally — the rows that ran, the checked rows they added, and the two
 *  outcomes the rule rows quote. The refusal is handed this ONE bundle, so a row that needs
 *  one more fact grows the bundle rather than the call signature. */
interface FaceTally extends RowCarried {
  readonly order: readonly PreFlightGateName[];
  readonly checked: readonly CheckedRow[];
}

/**
 * PreFlight — the work tree's gate. Invariant: one `vet` call walks the face's row set in
 * judgment order, the first refusing row owns the verdict, and the tree's ONE record is
 * settled from that verdict by `settle` alone — never by the judgment. See the file's header.
 *
 * Rule zero (over the 200-line class limit): the class is one row dispatcher plus the row
 * bodies it dispatches to, and every body reads the SAME carried bundle and the same four
 * construction facts — the row order IS the invariant, so extracting a body into a
 * collaborator would move surface area across a boundary without removing one variation.
 * The moment a row needs a fact the others do not, that row becomes its own class.
 */
export class PreFlight {
  readonly #repoRoot: string;
  readonly #tree: TreeRead;
  readonly #docs: DocJudgment;
  readonly #refusal: Refusal;

  constructor(opts: PreFlightOptions) {
    this.#repoRoot = opts.repoRoot;
    this.#tree = opts.tree;
    this.#docs = opts.docs;
    this.#refusal = opts.refusal;
  }

  /** The rows one face judges, in judgment order — DERIVED from the closed set, so a row
   *  that joins the vocabulary joins every face's reading at once. `graph` is the one row
   *  whose presence also depends on the read being ready; the four stations are always
   *  listed (a face with no input face YIELDS them, it does not drop them). */
  static rowsOf(type: TargetType, opts: { readonly graph: boolean }): readonly PreFlightGateName[] {
    return PRE_FLIGHT_GATE_NAMES.filter((row) => PreFlight.applies(row, type, opts.graph));
  }

  /** Whether one row belongs to one face. */
  private static applies(row: PreFlightGateName, type: TargetType, graph: boolean): boolean {
    const face = FACE_ROWS[type];
    if (PreFlight.isStation(row)) return true;
    if (row === "graph") return face.graph && graph;
    if (row === "plan-ledger") return face.ledger;
    if (row === "doc-contract") return face.docContract;
    return true;
  }

  /** Whether one row belongs to the pre-dispatch station half of the set. */
  static isStation(row: PreFlightGateName): row is RowStation {
    return (ROW_STATIONS as readonly string[]).includes(row);
  }

  /** vet(context) — walk the face's rows in order and answer the whole verdict. PURE: no
   *  record is written and none cleared (that is `settle`'s one call), so a preview reads a
   *  tree without changing it. The structural legs judge in sequence and the first violation
   *  refuses; the four stations judge TOGETHER, in one pass, so a refused round is repaired
   *  once instead of one row per dispatch. */
  async vet(ctx: PreFlightContext): Promise<PreFlightVerdict> {
    const order: PreFlightGateName[] = [];
    const checked: CheckedRow[] = [];
    const face = FACE_ROWS[ctx.type];
    let doc: DocOutcome = face.docContract ? { kind: "not-judged" } : { kind: "no-doc-target" };
    let ledger: LedgerOutcome = { kind: "no-ledger-facts" };
    for (const row of PreFlight.rowsOf(ctx.type, { graph: ctx.graph !== null })) {
      const step = await this.#judge(row, ctx, { doc, ledger });
      order.push(...step.ran);
      checked.push(...step.checked);
      doc = step.doc;
      ledger = step.ledger;
      if (step.refusal !== null) {
        return this.#refuse(ctx, step.refusal, { order, checked, doc, ledger });
      }
    }
    return {
      ok: true,
      order,
      checked: [...checked, ...this.#ruleRows(doc, ledger)],
      findings: doc.kind === "judged" ? doc.findings : [],
    };
  }

  /** settle(verdict) — the ONE write point of a judgment: a refused verdict publishes its
   *  record (the publish is fail-open, so the verdict survives an unwritable tree), and an
   *  approved one clears the tree's standing fact at the door. Called by the dispatch path
   *  after `vet` and never by `previewOf`, which is why a `--dry-run` writes nothing. */
  settle(verdict: PreFlightVerdict): RefusalPublish | null {
    if (verdict.ok) {
      this.#refusal.clear();
      return null;
    }
    const record = verdict.record;
    return record === undefined ? null : this.#refusal.write(record);
  }

  /** One row's judgment — what it read, what it refused (if anything) and the outcomes the
   *  rule rows quote. The four stations are ONE step: the first station judges all four. */
  async #judge(
    row: PreFlightGateName,
    ctx: PreFlightContext,
    carried: RowCarried,
  ): Promise<RowStep> {
    if (PreFlight.isStation(row)) {
      return PreFlight.#stations(row, ctx, carried);
    }
    if (row === "tree-clean") return this.#treeClean(carried);
    if (row === "in-flight") return this.#inFlight(ctx, carried);
    if (row === "graph") return PreFlight.#graph(ctx, carried);
    if (row === "plan-ledger") return this.#planLedger(ctx, carried);
    if (row === "doc-contract") return this.#docContract(ctx, carried);
    throw new Error(`PreFlight: the gate row "${row}" has no leg`);
  }

  /** `tree-clean` — the hard gate every verb shares. A non-repo counts dirty (the CDD flow
   *  needs git), which is the tree read's own judgment, not a second one here. */
  async #treeClean(carried: RowCarried): Promise<RowStep> {
    const clean = await this.#tree.isClean(this.#repoRoot);
    return {
      ran: ["tree-clean" as const],
      checked: [{ row: "tree-clean", reading: { kind: "ran" as const } }],
      doc: carried.doc,
      ledger: carried.ledger,
      refusal: clean
        ? null
        : {
            gate: "tree-clean" as const,
            reason: "dirty-tree" as const,
            detail: "dirty-tree",
          },
    };
  }

  /** `in-flight` — the tree's dispatch fact. The row JUDGES only: it inspects the reading
   *  and the holder's liveness, and never touches the record or the lock. The takeover flag
   *  lets a dead holder (or a corrupt record whose lock is still on disk) pass; it never
   *  crosses a live one. */
  async #inFlight(ctx: PreFlightContext, carried: RowCarried): Promise<RowStep> {
    const reason = PreFlight.#inFlightRefusal(ctx.inflight, ctx.recover === true);
    return {
      ran: ["in-flight" as const],
      checked: [{ row: "in-flight", reading: PreFlight.#inFlightReading(ctx.inflight) }],
      doc: carried.doc,
      ledger: carried.ledger,
      refusal:
        reason === null
          ? null
          : { gate: "in-flight" as const, reason, detail: reason, holding: ctx.inflight },
    };
  }

  /** `graph` — the plan's edge validation, read from the injected graph and rendered through
   *  its ONE detail template. The gate owns no second edge rule: a caller that hands in a
   *  graph answering no issue passes this row by construction, which is why the pin swaps in
   *  exactly such a graph to prove the leg is not vacuously green. */
  static #graph(ctx: PreFlightContext, carried: RowCarried) {
    const issues = ctx.graph === null ? [] : ctx.graph.validate();
    const details = issues.map((issue) => Graph.detailLine(issue));
    return {
      ran: ["graph" as const],
      checked: [{ row: "graph", reading: { kind: "ran" as const } }],
      doc: carried.doc,
      ledger: carried.ledger,
      refusal:
        details.length === 0
          ? null
          : {
              gate: "graph" as const,
              reason: "graph" as const,
              details,
              detail: details[0] ?? "graph",
            },
    };
  }

  /** `plan-ledger` — the plan/ledger agreement, judged by the document slice over the
   *  injected fact bundle. A missing bundle is not a refusal: the rows render `skipped`.
   *  The same bundle answers the plan-ahead count the row reports, so the info fact and the
   *  refusal read one bundle instead of two. */
  #planLedger(ctx: PreFlightContext, carried: RowCarried): RowStep {
    const target = ctx.planLedger;
    if (target === null) {
      return {
        ran: ["plan-ledger" as const],
        checked: [{ row: "plan-ledger", reading: { kind: "ran" as const } }],
        doc: carried.doc,
        ledger: carried.ledger,
        refusal: null,
      };
    }
    const findings = this.#docs.judgeLedger(target.input, target.facts);
    const details = findings.map(
      (finding) => `${finding.kind}@${finding.field}: ${finding.message}`,
    );
    const ahead = LedgerTaskSetRule.planAhead(target.facts);
    return {
      ran: ["plan-ledger" as const],
      checked: [{ row: "plan-ledger", reading: { kind: "plan-ledger" as const, ahead } }],
      doc: carried.doc,
      ledger: { kind: "judged" as const, findings, ahead },
      refusal:
        details.length === 0
          ? null
          : { gate: "plan-ledger" as const, details, detail: details[0] ?? "plan-ledger" },
    };
  }

  /** `doc-contract` — the target document's shape, judged by the document slice. The closure
   *  fact is read through the SAME reading the `checked:` yield rows quote, so a document is
   *  never half-closed. Only `block` findings refuse; a `warn` row reports and the dispatch
   *  proceeds. */
  #docContract(ctx: PreFlightContext, carried: RowCarried): RowStep {
    const input = ctx.doc;
    if (input === null) {
      return {
        ran: ["doc-contract" as const],
        checked: [{ row: "doc-contract", reading: { kind: "ran" as const } }],
        doc: { kind: "unreadable" as const },
        ledger: carried.ledger,
        refusal: null,
      };
    }
    const findings = this.#docs.judge(input);
    const blocking = findings.filter((finding) => finding.severity === "block");
    const details = blocking.map(
      (finding) => `${finding.kind}@${finding.field}: ${finding.message}`,
    );
    return {
      ran: ["doc-contract" as const],
      checked: [{ row: "doc-contract", reading: { kind: "ran" as const } }],
      doc: {
        kind: "judged" as const,
        findings,
        closed: this.#docs.closedAt(input.path),
        layersAvailable: input.taskLayers !== undefined,
      },
      ledger: carried.ledger,
      refusal:
        details.length === 0
          ? null
          : {
              gate: "doc-contract" as const,
              reason: "doc-contract" as const,
              details,
              detail: details[0] ?? "doc-contract",
            },
    };
  }

  /** The four stations — ONE step, judged on the first station only (the set is a unit).
   *  With no input face all four YIELD and judge nothing; otherwise every violation is
   *  reported in one pass and the FIRST row owns the verdict, the rest riding as details. */
  static #stations(row: RowStation, ctx: PreFlightContext, carried: RowCarried): RowStep {
    if (row !== ROW_STATIONS[0]) {
      // The four rows were judged together by the first station; the remaining rows of the
      // face's list add nothing and must not report a second time.
      return { ran: [], checked: [], doc: carried.doc, ledger: carried.ledger, refusal: null };
    }
    const ran = [...ROW_STATIONS];
    if (ctx.rows === null) {
      const yielded = ROW_STATIONS.map((station) => ({
        row: station,
        reading: { kind: "skipped" as const, reason: "no-input-face" as const },
      }));
      return { ran, checked: yielded, doc: carried.doc, ledger: carried.ledger, refusal: null };
    }
    const checked = ROW_STATIONS.map((station) => ({
      row: station,
      reading: { kind: "ran" as const },
    }));
    const [first] = ctx.rows;
    if (first === undefined) {
      return { ran, checked, doc: carried.doc, ledger: carried.ledger, refusal: null };
    }
    return {
      ran,
      checked,
      doc: carried.doc,
      ledger: carried.ledger,
      refusal: {
        gate: first.station,
        details: ctx.rows.slice(1).map((reading) => reading.detail),
        detail: first.detail,
      },
    };
  }

  /** The in-flight row's checked reading — the ONE gate row that names its state. A stale
   *  holder whose own target facts read out missing renders the fourth state's naked line
   *  instead of the stale sentence, so the reader sees that the target is gone. */
  static #inFlightReading(state: InFlightReading): CheckedReading {
    if (state.kind === "absent") return { kind: "in-flight", state: "free" };
    if (state.kind === "corrupt") {
      return { kind: "in-flight", state: state.locked ? "corrupt-locked" : "corrupt-unlocked" };
    }
    if (state.alive) return { kind: "in-flight", state: "held", pid: state.pid };
    if (state.targetGone.length > 0) {
      return {
        kind: "in-flight",
        state: "stale-target-gone",
        targetGone: [...state.targetGone],
      };
    }
    return { kind: "in-flight", state: "stale", pid: state.pid };
  }

  /** The in-flight row's refusal — the three-state judgment plus the explicit takeover flag.
   *  A live holder is always refused (the flag never crosses "alive"); a dead holder or a
   *  corrupt-record-with-lock passes only under `recover`; a corrupt record with no lock
   *  behind it is no holder at all. */
  static #inFlightRefusal(state: InFlightReading, recover: boolean): PreFlightReason | null {
    if (state.kind === "absent") return null;
    if (state.kind === "corrupt") {
      return state.locked && !recover ? "corrupt-record" : null;
    }
    if (state.alive) return "held";
    return recover ? null : "held";
  }

  /** Assemble the refusal verdict — the record's cells ride IN the verdict and are written
   *  by `settle`, never here. The round is untouched: nothing in this method writes a ledger
   *  cell, which is the mechanical form of "a refusal books no round". */
  #refuse(ctx: PreFlightContext, spec: RefusalSpec, tally: FaceTally): PreFlightVerdict {
    return {
      ok: false,
      gate: spec.gate,
      ...(spec.reason === undefined ? {} : { reason: spec.reason }),
      ...(spec.details === undefined ? {} : { details: spec.details }),
      ...(spec.holding === undefined ? {} : { holding: spec.holding }),
      order: [...tally.order],
      checked: [...tally.checked, ...this.#ruleRows(tally.doc, tally.ledger)],
      record: {
        slug: ctx.slug,
        op: ctx.op,
        type: ctx.type,
        cycle: ctx.cycle,
        attempt: ctx.attempt,
        station: spec.gate,
        detail: spec.detail,
      },
    };
  }

  /** The checked rows of the declared rule table — one row per declaration, rendered ONCE (a
   *  rule crossing two gates never appears twice). The table is the document slice's, so
   *  "which rule ran" and "what it judged" cannot drift apart. */
  #ruleRows(doc: DocOutcome, ledger: LedgerOutcome): CheckedRow[] {
    const rows: CheckedRow[] = [];
    for (const declaration of this.#docs.ruleRows()) {
      rows.push(
        declaration.scope === "doc"
          ? { row: declaration.id, reading: PreFlight.#docReadingOf(declaration, doc) }
          : { row: declaration.id, reading: PreFlight.#ledgerReadingOf(declaration, ledger) },
      );
    }
    return rows;
  }

  /** One doc-scope rule's reading — the yield that names WHY it did not judge, or its own
   *  result. The tier decides the word a hit earns, so a `warn` row never reads `failed` and
   *  a clean row never reads `passed` while it reported something. */
  static #docReadingOf(declaration: RuleDeclaration, doc: DocOutcome): CheckedReading {
    if (doc.kind === "no-doc-target") return { kind: "skipped", reason: "no-doc-target" };
    if (doc.kind === "not-judged") return { kind: "skipped", reason: "doc-not-judged" };
    if (doc.kind === "unreadable") return { kind: "skipped", reason: "unreadable-doc" };
    if (doc.closed && declaration.skipWhenClosed) {
      return { kind: "skipped", reason: "closed-document" };
    }
    if (!doc.layersAvailable && declaration.id === LAYER_RULE) {
      return { kind: "skipped", reason: "no-plan-layers" };
    }
    const count = doc.findings.filter((finding) => finding.kind === declaration.id).length;
    if (count === 0) return { kind: "rule", result: "passed", count };
    return {
      kind: "rule",
      result: declaration.severity === "warn" ? "warned" : "failed",
      count,
    };
  }

  /** One ledger-scope rule's reading — a missing fact bundle is a yield, never a pass. */
  static #ledgerReadingOf(declaration: RuleDeclaration, ledger: LedgerOutcome): CheckedReading {
    if (ledger.kind === "no-ledger-facts") {
      return { kind: "skipped", reason: "no-ledger-facts" };
    }
    const count = ledger.findings.filter((finding) => finding.kind === declaration.id).length;
    return { kind: "rule", result: count === 0 ? "passed" : "failed", count };
  }
}
