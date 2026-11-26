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
//     error code;
//   · breached — parses and does not conform. A refusal whose detail carries the problem
//     list.
// The two refusal arms share ONE cause word (`CONTRACT_VIOLATION`): the termination causes
// (`over-budget` · `stalled` · `signal`) name cut-short rounds only, and none of them
// describes a draft's shape.
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
  | { readonly kind: "malformed"; readonly code: string }
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

  /** Read one draft: `text` is the file's bytes, null when the file was never written. The
   *  walk is TIERED — a decorative slot that breaks its own declaration is dropped and
   *  reported beside the problems, and only an owed slot's mismatch refuses the draft. */
  static read(text: string | null, plane: HandoffPlane): HandoffRead {
    if (text === null) return { kind: "absent" };
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (raw) {
      return { kind: "malformed", code: raw instanceof Error ? raw.name : "SyntaxError" };
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
        message: `the handoff draft is not JSON (${read.code})`,
      };
    }
    return {
      grade: "hard",
      cause: CONTRACT_VIOLATION,
      message: `the handoff draft breaks the handoff contract — ${read.problems.join("; ")}`,
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
