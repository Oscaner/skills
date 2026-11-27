// packages/cdd-engine/src/run/dispatch/handoff.ts
// The handoff: the child's writable contract, the read-back of the draft it left, and the
// two judgments the draft feeds — its conclusion and its cross-round downgrades.
//
// INVARIANT — a draft is judged by what is ON DISK and by nothing else: absence is not a
// refusal, a malformed file is, a file that parses but breaks the declared key set is, and
// the conclusion is DERIVED from the findings rather than read off a status the child wrote.
//
// THE THREE READ SHAPES, each one distinct observable fact:
//   · absent — the draft was never written. No refusal: the round's completion criterion
//     closes it (a work round pays the `IMPLEMENT_CARRIER_ABSENT` soft observation, a judge
//     round owes the findings its criterion reads), so this module answers a value and
//     nothing throws;
//   · malformed — on disk and not JSON. A refusal whose detail carries the parser's own
//     error codes;
//   · breached — parses and does not conform. A refusal whose detail carries the problem
//     list.
// The two refusal arms share ONE cause word (`CONTRACT_VIOLATION`): the termination causes
// (`over-budget` · `stalled` · `signal`) name cut-short rounds only, and none of them
// describes a draft's shape.
//
// THE EVIDENCE FILE IS THE SECOND CONTRACT, and it is declared here beside the carrier's:
// both are the child's writable surface, so one walk judges both and neither can grow a key
// list of its own. Its read keeps four arms apart — never written, not JSON, conforming, and
// parsed-but-off-contract — because folding `malformed` into `missing` would tell an operator
// the wrong defect, and its refusal builder is the ONE place those arms become a round entry.
//
// THE READ-BACK IS TIERED, like the declaration it walks: a slot the child OWES (the
// plane's required set) that breaks its declaration REFUSES the draft, while a DECORATIVE
// slot (declared, not required — both planes' `notes`, the work plane's `dispositions`, the
// judge plane's `artifacts`) is DROPPED: its path is reported once and the slot is never
// carried. A wrong decorative value costs a field, never a round, so the refusal face stays
// exactly as wide as the fields the child owes.
//
// THE PLANES are derived from the verb, never declared per family: a work verb (implement ·
// fix) authors `status` + `artifacts`, a judge verb (review) authors `findings`. Declaration
// order is projection order, so the key set a child is shown and the key set it is judged
// against are one declaration.
//
// THE CONCLUSION is the findings' roll-up: a blocker ⇒ `CHANGES_REQUESTED`, only warnings ⇒
// `REVIEW_FIX`, nothing ⇒ `APPROVED`. A review never carries a child-authored status, so
// the conclusion has no cell to disagree with.
//
// THE DOWNGRADE JUDGMENT is two reads of ONE comparison (`downgrades` and
// `regradeReasons`): the rows whose grade fell below the earlier round's matching row and
// that carry no reason, and the reasons of those that do. The two sets partition one
// judgment, so a display face prints the mark and the reasons from one criterion instead of
// re-deciding which row was downgraded. The reference is the most recent record whose
// findings are non-empty (a clean round in between never resets it), and the engine-written
// `id` is a row number — it narrows a multi-row match and is never the pairing key.
//
// Module-level exports are types, the declared key sets and the class — zero
// behaviour-carrying bare functions.

import { type ParseError, parse, printParseErrorCode } from "jsonc-parser";
import type { JsonRead } from "../../env/workspace/base-artifact.ts";
import type { RoundOp } from "../ledger/identity.ts";
import type { RoundViolation } from "../ledger/ledger.ts";

/** The two carrier planes — the op-derived writable halves. */
export type HandoffPlane = "work" | "judge";

/** The carrier's declared slots, in projection order. */
export const HANDOFF_KEYS = ["status", "findings", "artifacts", "notes", "dispositions"] as const;

/** One carrier slot. */
export type HandoffKey = (typeof HANDOFF_KEYS)[number];

/** The plane → writable slots. The shared slots (`artifacts` · `notes`) are both-plane by
 *  design; the exclusive slots ARE the plane. */
export const PLANE_SLOTS: Readonly<Record<HandoffPlane, readonly HandoffKey[]>> = {
  work: ["status", "artifacts", "notes", "dispositions"],
  judge: ["findings", "artifacts", "notes"],
};

/** The plane → required slots. A work carrier owes its conclusion and the artifact index it
 *  touched; a judge carrier owes the findings its conclusion rolls up from.
 *  `dispositions` stays optional: a fix round's dispositions criterion judges their absence,
 *  so an implement round is never asked to declare them. */
export const PLANE_REQUIRED: Readonly<Record<HandoffPlane, readonly HandoffKey[]>> = {
  work: ["status", "artifacts"],
  judge: ["findings"],
};

/** The one cause word both refusal arms carry. */
export const CONTRACT_VIOLATION = "contract-violation";

/** The draft's parse dialect — the LENIENT one, scoped to this face alone. A draft is
 *  written by a child model from prose, so a trailing comma or a comment is a routine
 *  slip; the strict `JSON.parse` would veto a whole round on one comma. jsonc-parser still
 *  reports a real break (a missing brace, a stray symbol), so a corrupt draft stays
 *  fail-loud. Engine-authored files never come through here: their bytes are
 *  `JSON.stringify` output, where leniency would only mask a real engine bug. */
const LENIENT = { allowTrailingComma: true, disallowComments: false } as const;

/** The work plane's declared conclusions. */
export const WORK_STATUSES = ["APPROVED", "BLOCKED"] as const;

/** A round's three-value severity ladder — the READ face's union: a stored carrier may
 *  still hold the retired third tier, so narrowing the write face never blames one. */
export type RoundSeverity = "blocker" | "warn" | "nit";

/** One finding as the cross-round and conclusion judgments read it. */
export interface RoundFinding {
  readonly severity: RoundSeverity;
  /** The lens the finding was judged through (the review table's own vocabulary). */
  readonly lens?: string;
  /** The defect's description — one of the two pairing keys. */
  readonly summary?: string;
  /** The engine-written row number — a narrowing fact, never the pairing key. */
  readonly id?: string;
  /** The blocker's reproducible scenario — the other pairing key, and the reference a
   *  downgrade is read against. */
  readonly impact?: { readonly scenario: string; readonly test?: string };
  /** The downgrade's stated reason. */
  readonly regrade?: string;
}

/** The conclusion a judge carrier rolls up to. */
export type HandoffConclusion = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_FIX";

/** One record the prior-findings walk reads — the two facts that matter to the downgrade
 *  judgment and nothing else. */
export interface JudgedRecord {
  /** The round's findings projection; null when the round wrote no judge carrier. */
  readonly findings: readonly RoundFinding[] | null;
}

/** One draft's read-back — the three shapes above, plus the parsed draft and the decorative
 *  slots DROPPED in place on the two non-absent arms. */
export type HandoffRead =
  | { readonly kind: "absent" }
  | { readonly kind: "malformed"; readonly codes: readonly string[] }
  | {
      readonly kind: "compliant";
      readonly draft: Record<string, unknown>;
      readonly dropped: readonly string[];
    }
  | {
      readonly kind: "breached";
      readonly problems: readonly string[];
      readonly dropped: readonly string[];
    };

/** One walk's accumulating ruling — the refusal list and the decorative slots dropped in
 *  place, both read by the one walk. */
interface CheckOut {
  readonly problems: Problem[];
  readonly dropped: string[];
}

/** One walk's accumulating problems — the `path: reason` wording's source. */
type Problem = { readonly path: string; readonly reason: string };

/** One declared contract's cell type — a scalar, or a nested contract (the evidence file's
 *  `typecheck` object). */
type CellType = "string" | "integer" | "boolean" | EvidenceContract;

/** One declared contract: the cells it may carry and the ones it owes. The evidence file
 *  is the work plane's SECOND contract, declared here beside the carrier's because both are
 *  the child's writable surface — one walk judges both, so neither can grow a key list of
 *  its own. */
interface EvidenceContract {
  readonly required: readonly string[];
  readonly cells: Readonly<Record<string, CellType>>;
}

/** The test-evidence file's declaration — exactly the shape the dispatch prompt shows the
 *  child (`OUTPUT_EVIDENCE`), so the prompt and the read-back stay one contract. */
const EVIDENCE_CONTRACT: EvidenceContract = {
  required: ["command", "exit_code", "passed", "warnings_count", "typecheck"],
  cells: {
    command: "string",
    exit_code: "integer",
    passed: "boolean",
    warnings_count: "integer",
    behavior_change: "boolean",
    typecheck: {
      required: ["command", "exit_code", "passed"],
      cells: { command: "string", exit_code: "integer", passed: "boolean" },
    },
  },
};

/** The evidence file's read — the workspace's tri-state JSON read (`env/workspace`) walked
 *  against the contract above. The four arms are DISTINCT facts: a file never written, a
 *  file that is not JSON, a file that parses and conforms, and a file that parses but breaks
 *  the contract (carrying its problem list). A corrupt file is never misreported as absent,
 *  and `missing` is never folded into `breached`. */
export type EvidenceRead =
  | { readonly kind: "missing" }
  | { readonly kind: "malformed" }
  | { readonly kind: "ok" }
  | { readonly kind: "breached"; readonly problems: readonly string[] };

/** The declared schema node shape — the typed subset the prompt fence projects. */
interface SchemaNode {
  readonly type?: "object" | "array" | "string" | "integer" | "boolean";
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, SchemaNode>>;
  readonly items?: SchemaNode;
  readonly enum?: readonly string[];
}

/** One judge finding row as the child is shown it — the three owed cells plus the optional
 *  columns a review may fill. The engine owns `id` (it rewrites the row number), so the
 *  child owes nothing there. */
const FINDING: SchemaNode = {
  type: "object",
  required: ["severity", "lens", "summary"],
  properties: {
    id: { type: "string" },
    severity: { type: "string", enum: ["blocker", "warn"] },
    lens: { type: "string" },
    section: { type: "string" },
    line: { type: "integer" },
    summary: { type: "string" },
    fix: { type: "string" },
    impact: {
      type: "object",
      required: ["scenario"],
      properties: { scenario: { type: "string" }, test: { type: "string" } },
    },
    regrade: { type: "string" },
    contract: {
      type: "object",
      required: ["path", "anchor"],
      properties: { path: { type: "string" }, anchor: { type: "string" } },
    },
    evidence: {
      type: "object",
      required: ["repro"],
      properties: { repro: { type: "string" }, output: { type: "string" } },
    },
  },
};

/** THE carrier declaration — every slot the child may write, keyed by the same names the
 *  read-back walks. The plane's projection (`PLANE_SLOTS`) selects the subset the fence
 *  shows, so the prompt and the validator read one key set. */
const CARRIER_PROPERTIES: Readonly<Record<HandoffKey, SchemaNode>> = {
  status: { type: "string", enum: [...WORK_STATUSES] },
  findings: { type: "array", items: FINDING },
  artifacts: { type: "object" },
  notes: { type: "array", items: { type: "string" } },
  dispositions: { type: "object" },
};

/** The test-evidence file's schema — the second fence of a work-plane prompt, exactly the
 *  cells `EVIDENCE_CONTRACT` walks. */
const EVIDENCE_SCHEMA: SchemaNode = {
  type: "object",
  required: [...EVIDENCE_CONTRACT.required],
  properties: {
    command: { type: "string" },
    exit_code: { type: "integer" },
    passed: { type: "boolean" },
    warnings_count: { type: "integer" },
    typecheck: {
      type: "object",
      required: ["command", "exit_code", "passed"],
      properties: {
        command: { type: "string" },
        exit_code: { type: "integer" },
        passed: { type: "boolean" },
      },
    },
    behavior_change: { type: "boolean" },
  },
};

/**
 * Handoff — one declaration, three readings. Invariant: a draft is judged by what is on
 * disk, and the conclusion is derived from the findings (see the file's header).
 *
 * Rule zero (over the 200-line class limit): the class stays whole because the declaration
 * it projects and the walks that judge it are ONE contract — a split would let the
 * projection and the read-back drift into two key sets, which is the invariant.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the declaration and its pure readings share no state — the zero-bare-function discipline admits no standalone predicates.
export class Handoff {
  /** The carrier plane of a verb — the ONE derivation, never a per-family declaration. */
  static planeOf(op: RoundOp): HandoffPlane {
    return op === "review" ? "judge" : "work";
  }

  /** The plane's writable slots, in declaration order the child is shown. */
  static writable(plane: HandoffPlane): readonly HandoffKey[] {
    return PLANE_SLOTS[plane];
  }

  /** The `## Handoff schema` section text the dispatch prompt carries: the plane's writable
   *  subset as ONE compact JSON fence, plus (work plane) the evidence file's fence. The
   *  declaration is the field source — the fence lists exactly the slots the read-back
   *  validates, so a child is never shown a field the engine does not read. */
  static sectionText(plane: HandoffPlane, evidence: boolean): string {
    const carrier = Handoff.#json(Handoff.#writableNode(plane));
    const head =
      "Write the handoff draft at `OUTPUT_HANDOFF` per this writable subset — the engine " +
      "validates it, then materializes the final carrier in place; fields not listed here are " +
      `engine-reserved, do not write them.\n\n\`\`\`json\n${carrier}\n\`\`\``;
    if (!evidence) return head;
    return `${head}\n\nThe evidence file (the file named by \`OUTPUT_EVIDENCE\`) must comply with this schema — the engine reads it back with the same stakes:\n\n\`\`\`json\n${Handoff.#json(EVIDENCE_SCHEMA)}\n\`\`\``;
  }

  /** The plane's carrier node — `PLANE_SLOTS`' slots, in the carrier's declared order, with
   *  the plane's own required set. */
  static #writableNode(plane: HandoffPlane): SchemaNode {
    const properties: Record<string, SchemaNode> = {};
    for (const key of HANDOFF_KEYS) {
      if (PLANE_SLOTS[plane].includes(key)) properties[key] = CARRIER_PROPERTIES[key];
    }
    return { type: "object", required: [...PLANE_REQUIRED[plane]], properties };
  }

  /** One node as the prompt's fence — COMPACT, because the fence is the biggest token the
   *  fixed prefix pays on every dispatch. */
  static #json(node: SchemaNode): string {
    return JSON.stringify(node);
  }

  /** Read one draft: `text` is the file's bytes, null when the file was never written. The
   *  bytes are parsed in the LENIENT draft dialect (trailing commas and comments are
   *  tolerated, a real break is `malformed` carrying the parser's error codes). The walk
   *  is TIERED — a decorative slot that breaks its own declaration is dropped and reported
   *  beside the problems, and only an owed slot's mismatch refuses the draft. */
  static read(text: string | null, plane: HandoffPlane): HandoffRead {
    if (text === null) return { kind: "absent" };
    const errors: ParseError[] = [];
    const value: unknown = parse(text, errors, LENIENT);
    if (errors.length > 0) {
      return { kind: "malformed", codes: errors.map((error) => printParseErrorCode(error.error)) };
    }
    const out: CheckOut = { problems: [], dropped: [] };
    Handoff.#check(value, plane, out);
    const draft = value as Record<string, unknown>;
    return out.problems.length === 0
      ? { kind: "compliant", draft, dropped: out.dropped }
      : {
          kind: "breached",
          problems: out.problems.map(Handoff.#problemLine),
          dropped: out.dropped,
        };
  }

  /** The refusal one read earns, or null for the absent arm — the ONE place the two refusal
   *  arms become a round violation, so both carry the same cause word. */
  static violationOf(read: HandoffRead): RoundViolation | null {
    if (read.kind === "absent" || read.kind === "compliant") return null;
    if (read.kind === "malformed") {
      return {
        grade: "hard",
        cause: CONTRACT_VIOLATION,
        message: `the handoff draft is not JSON (${read.codes.join(", ")})`,
      };
    }
    return {
      grade: "hard",
      cause: CONTRACT_VIOLATION,
      message: `the handoff draft breaks the handoff contract — ${read.problems.join("; ")}`,
    };
  }

  /** The test-evidence file's read-back — the evidence gate's ONE input. The parse is the
   *  workspace's (its tri-state JSON read, handed in already performed), so this face judges
   *  SHAPE alone and reads no file. */
  static evidenceOf(read: JsonRead<unknown>): EvidenceRead {
    if (read.kind === "ok") {
      const problems: Problem[] = [];
      Handoff.#checkContract(EVIDENCE_CONTRACT, read.value, "", problems);
      return problems.length === 0
        ? { kind: "ok" }
        : { kind: "breached", problems: problems.map(Handoff.#problemLine) };
    }
    return { kind: read.kind };
  }

  /** The round violation one evidence read earns, or null when the file is green — the ONE
   *  place the three refusal arms become a graded entry. The completion criterion's
   *  `evidenceOk` cell reads the SAME value, so a round can never be refused on evidence the
   *  criterion called green (or completed on evidence it called red). */
  static evidenceViolationOf(read: EvidenceRead, target: string): RoundViolation | null {
    if (read.kind === "ok") return null;
    return {
      grade: "hard",
      cause: CONTRACT_VIOLATION,
      message:
        read.kind === "breached"
          ? `the test evidence at ${target} violates the contract: ${read.problems.join("; ")}`
          : read.kind === "missing"
            ? `the test evidence at ${target} was not written`
            : `the test evidence at ${target} is malformed JSON`,
    };
  }

  /** The findings a draft carries, projected onto the two judgments' facts: an unknown
   *  severity is dropped (it names no tier the ladder can rank), and a cell that does not
   *  keep its declared shape reads absent rather than fabricated. */
  static findingsOf(draft: unknown): readonly RoundFinding[] {
    if (typeof draft !== "object" || draft === null || Array.isArray(draft)) return [];
    const rows = (draft as { findings?: unknown }).findings;
    if (!Array.isArray(rows)) return [];
    const findings: RoundFinding[] = [];
    for (const entry of rows) {
      const row = entry as {
        severity?: unknown;
        lens?: unknown;
        summary?: unknown;
        id?: unknown;
        impact?: { scenario?: unknown; test?: unknown } | null;
        regrade?: unknown;
      } | null;
      const severity = row?.severity;
      if (severity !== "blocker" && severity !== "warn" && severity !== "nit") continue;
      const lens = Handoff.#textOf(row?.lens);
      const summary = Handoff.#textOf(row?.summary);
      const id = Handoff.#textOf(row?.id);
      const regrade = Handoff.#textOf(row?.regrade);
      const impact = Handoff.#impactOf(row?.impact);
      findings.push({
        severity,
        ...(lens === undefined ? {} : { lens }),
        ...(summary === undefined ? {} : { summary }),
        ...(id === undefined ? {} : { id }),
        ...(impact === undefined ? {} : { impact }),
        ...(regrade === undefined ? {} : { regrade }),
      });
    }
    return findings;
  }

  /** The conclusion the findings roll up to — blockers first, then a non-empty set, then
   *  approval. A review never carries a child-authored status, so this is the only source. */
  static conclusionOf(findings: readonly RoundFinding[]): HandoffConclusion {
    if (findings.some((finding) => finding.severity === "blocker")) return "CHANGES_REQUESTED";
    return findings.length > 0 ? "REVIEW_FIX" : "APPROVED";
  }

  /** The downgrade judgment's reference — the findings of the most recent record that
   *  carries a non-empty set (a clean judge round and a work round are both skipped, so
   *  neither resets the reference). Empty when no record carries one. */
  static priorFindingsOf(records: readonly JudgedRecord[]): readonly RoundFinding[] {
    for (let index = records.length - 1; index >= 0; index -= 1) {
      const findings = records[index]?.findings;
      if (findings !== null && findings !== undefined && findings.length > 0) return findings;
    }
    return [];
  }

  /** The rows graded BELOW a matching earlier row that state no `regrade` reason — exactly
   *  the rows a display face marks. */
  static downgrades(
    prior: readonly RoundFinding[],
    current: readonly RoundFinding[],
  ): readonly RoundFinding[] {
    return current.filter(
      (row) =>
        Handoff.#downgradeReference(prior, row) !== undefined &&
        Handoff.#textOf(row.regrade) === undefined,
    );
  }

  /** The reasons the round DID state, in carrier row order — the other half of the same
   *  judgment. */
  static regradeReasons(
    prior: readonly RoundFinding[],
    current: readonly RoundFinding[],
  ): readonly string[] {
    const reasons: string[] = [];
    for (const row of current) {
      if (Handoff.#downgradeReference(prior, row) === undefined) continue;
      const reason = Handoff.#textOf(row.regrade);
      if (reason !== undefined) reasons.push(reason);
    }
    return reasons;
  }

  /** The earlier row a current row was graded below — absent for every row that is not a
   *  downgrade. Two pairing keys, then the id narrowing, then the two exclusions: an
   *  unchanged or raised grade is no downgrade, and a reference whose own scenario was empty
   *  has nothing to compare against. */
  static #downgradeReference(
    prior: readonly RoundFinding[],
    row: RoundFinding,
  ): RoundFinding | undefined {
    const matches = prior.filter(
      (candidate) =>
        (candidate.summary !== undefined && candidate.summary === row.summary) ||
        (candidate.impact?.scenario !== undefined &&
          candidate.impact.scenario === row.impact?.scenario),
    );
    if (matches.length === 0) return undefined;
    const narrowed = matches.filter((candidate) => row.id !== undefined && candidate.id === row.id);
    const reference = (narrowed.length > 0 ? narrowed : matches)[0];
    if (reference === undefined) return undefined;
    if (Handoff.#tierRankOf(row.severity) >= Handoff.#tierRankOf(reference.severity)) {
      return undefined;
    }
    if (Handoff.#textOf(reference.impact?.scenario) === undefined) return undefined;
    return reference;
  }

  /** The tier ladder's rank — higher is more severe. */
  static #tierRankOf(severity: RoundSeverity): number {
    return severity === "blocker" ? 2 : severity === "warn" ? 1 : 0;
  }

  /** One walk over the draft's declared cells: the root object, then every required slot and
   *  every present slot judged at its OWN owed-ness. A non-declared key is DROPPED by the
   *  materialize face, never a problem — the validator and the writer judge the same field the
   *  same way (only a declared cell that breaks its own declaration refuses the draft). */
  static #check(value: unknown, plane: HandoffPlane, out: CheckOut): void {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      out.problems.push({ path: "", reason: "expected a JSON object" });
      return;
    }
    const draft = value as Record<string, unknown>;
    const required = PLANE_REQUIRED[plane];
    for (const key of required) {
      if (draft[key] === undefined) out.problems.push({ path: key, reason: "required" });
    }
    for (const key of PLANE_SLOTS[plane]) {
      if (draft[key] === undefined) continue;
      const owed = required.includes(key);
      const markProblems = out.problems.length;
      const markDropped = out.dropped.length;
      Handoff.#checkSlot(key, draft[key], owed, out);
      if (owed || out.problems.length === markProblems) continue;
      // The decorative slot breaks its own declaration — prune everything it booked inside,
      // then report the slot once (materialize's copy point reads this path).
      out.problems.length = markProblems;
      out.dropped.length = markDropped;
      out.dropped.push(key);
    }
  }

  /** One declared slot's judgment — the slot's own shape, never a neighbouring slot's. An
   *  owed slot's mismatch is a problem; a decorative one is dropped. */
  static #checkSlot(key: HandoffKey, value: unknown, owed: boolean, out: CheckOut): void {
    if (key === "status") {
      if (!(WORK_STATUSES as readonly unknown[]).includes(value)) {
        Handoff.#refuse(out, key, `must be one of ${WORK_STATUSES.join(" | ")}`, owed);
      }
      return;
    }
    if (key === "findings") {
      Handoff.#checkFindings(value, owed, out);
      return;
    }
    if (key === "artifacts" || key === "dispositions") {
      Handoff.#checkMap(key, value, owed, out);
      return;
    }
    Handoff.#checkNotes(key, value, owed, out);
  }

  /** The judge plane's finding rows — one row's three required cells, and the two optional
   *  cells only when they are present. A row inside a PRESENT findings slot is owed: the
   *  slot is the plane's required set, so a bad row is judged inside it. */
  static #checkFindings(value: unknown, owed: boolean, out: CheckOut): void {
    if (!Array.isArray(value)) {
      Handoff.#refuse(out, "findings", "expected an array", owed);
      return;
    }
    for (const [index, entry] of value.entries()) {
      const at = `findings[${index}]`;
      const row = entry as { severity?: unknown; lens?: unknown; summary?: unknown } | null;
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        out.problems.push({ path: at, reason: "expected an object" });
        continue;
      }
      if (row?.severity !== "blocker" && row?.severity !== "warn") {
        out.problems.push({ path: `${at}.severity`, reason: "must be one of blocker | warn" });
      }
      for (const cell of ["lens", "summary"] as const) {
        if (typeof row?.[cell] !== "string") {
          out.problems.push({ path: `${at}.${cell}`, reason: "expected a string" });
        }
      }
    }
  }

  /** A keyed cell (`artifacts` · `dispositions`) — an object whose values are declared per
   *  key by their own writer, so the slot's own declaration is "an object". */
  static #checkMap(key: HandoffKey, value: unknown, owed: boolean, out: CheckOut): void {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      Handoff.#refuse(out, key, "expected an object", owed);
    }
  }

  /** One declared contract's walk — the required sweep, then every present cell judged at
   *  its own declaration. Strict by construction: every mismatch is a problem, because the
   *  evidence file owes every cell its contract names. */
  static #checkContract(
    contract: EvidenceContract,
    value: unknown,
    path: string,
    out: Problem[],
  ): void {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      out.push({ path, reason: "expected a JSON object" });
      return;
    }
    const row = value as Record<string, unknown>;
    for (const key of contract.required) {
      if (row[key] === undefined) out.push({ path: Handoff.#at(path, key), reason: "required" });
    }
    for (const [key, cell] of Object.entries(contract.cells)) {
      const present = row[key];
      if (present === undefined) continue;
      const at = Handoff.#at(path, key);
      if (typeof cell !== "string") {
        Handoff.#checkContract(cell, present, at, out);
        continue;
      }
      const reason = Handoff.#cellReason(cell, present);
      if (reason !== null) out.push({ path: at, reason });
    }
  }

  /** One cell's path — the root cell is bare, a nested one is dotted. */
  static #at(path: string, key: string): string {
    return path.length === 0 ? key : `${path}.${key}`;
  }

  /** A scalar cell's declared type, judged: the reason it breaks, or null when it keeps it.
   *  An `integer` cell refuses a fractional number — the evidence's exit codes and warning
   *  counts are whole by declaration. */
  static #cellReason(cell: "string" | "integer" | "boolean", value: unknown): string | null {
    if (cell === "string") return typeof value === "string" ? null : "expected a string";
    if (cell === "boolean") return typeof value === "boolean" ? null : "expected a boolean";
    return typeof value === "number" && Number.isInteger(value) ? null : "expected an integer";
  }

  /** The `notes` slot — string rows only. A row inside a PRESENT slot is owed: the slot's
   *  own mismatch is the tiered one, and a decorative slot's parent prunes what its rows
   *  booked and reports the slot once. */
  static #checkNotes(key: HandoffKey, value: unknown, owed: boolean, out: CheckOut): void {
    if (!Array.isArray(value)) {
      Handoff.#refuse(out, key, "expected an array", owed);
      return;
    }
    for (const [index, entry] of value.entries()) {
      if (typeof entry !== "string") {
        Handoff.#refuse(out, `${key}[${index}]`, "expected a string", true);
      }
    }
  }

  /** Book one mismatch at its tier — a problem for an owed slot, a dropped path for a
   *  decorative one. */
  static #refuse(out: CheckOut, path: string, reason: string, owed: boolean): void {
    if (owed) out.problems.push({ path, reason });
    else out.dropped.push(path);
  }

  /** A problem's printed form — `path: reason`, bare reason at the root. */
  static #problemLine(problem: Problem): string {
    return problem.path.length === 0 ? problem.reason : `${problem.path}: ${problem.reason}`;
  }

  /** A non-blank string cell, else undefined — the projection's ONE blank test. */
  static #textOf(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }

  /** The blocker's scenario cell when it keeps its declared shape — a scenario-less impact
   *  is absent, never a row carrying an empty reference. */
  static #impactOf(
    value: { scenario?: unknown; test?: unknown } | null | undefined,
  ): { scenario: string; test?: string } | undefined {
    const scenario = Handoff.#textOf(value?.scenario);
    if (scenario === undefined) return undefined;
    const test = Handoff.#textOf(value?.test);
    return test === undefined ? { scenario } : { scenario, test };
  }
}
