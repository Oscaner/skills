// packages/cdd-engine/src-next/session/handoff-schema.ts
// The handoff schema face: the child's writable handoff contract as ONE typed
// declaration projected onto the two carrier planes. The cutover deleted the old
// JSON schema file together with its Ajv loader; the structural constraint now lives
// here as a typed declaration — zero JSON schema files, one source, two consumers:
//
//   · projections: ① the prompt-injection text (schemaText — the ```json fences
//     byte-fixed per plane, so the fixed prefix tail of the dispatch prompt stays
//     cache-friendly) and ② the engine read-back validator (readBack /
//     evidenceViolations — the child draft is judged against exactly the same
//     projected objects the prompt showed it, the required slots refusing the round
//     and the decorative ones dropped in place).
//   · planes: the carrier plane is DERIVED from the op (planeOf), never declared per
//     family — `work` (implement/fix: status + artifacts, plus the separate
//     test-evidence file for task-family rounds) or `judge` (reviews: findings-only
//     carrier — the engine rolls the status up from the findings, never a
//     child-authored status).
//
// The validator is a purpose-built walker over the declared schema objects (the
// keywords this contract uses — type / properties / required / items / enum /
// minLength / maxLength) — the new tree reads zero config files and takes no Ajv
// dependency; a wrong-shape child draft is the engine's read-back BLOCK, and the
// same declared objects drive both projections so the prompt can never show a
// schema the engine does not enforce. Non-declared fields are DROPPED by
// materialize and never refuse the draft — the validator and materialize judge the
// same field the same way (zero second-arbiter friction).
//
// Module-level exports are types / the declared schema objects / the class — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

import type { FindingSeverity, OpType, RoundFinding, RoundStatus } from "./ledger.ts";

/** The carrier planes — the op-derived writable halves (`planeOf`). */
export type CarrierPlane = "work" | "judge";

/** The declared schema node shape — the typed subset of JSON-schema this contract
 *  uses (the engine's validator walks exactly these objects). */
interface SchemaNode {
  type?: "object" | "array" | "string" | "integer" | "boolean";
  required?: readonly string[];
  properties?: Readonly<Record<string, SchemaNode>>;
  items?: SchemaNode;
  enum?: readonly unknown[];
  minLength?: number;
  maxLength?: number;
}

/** One finding row — the shared base declaration of the judge plane (severity +
 *  lens + summary required; the extra review columns — section / line / fix — are
 *  declared optional, and unknown extra fields ride along).
 *
 *  `id` is declared OPTIONAL on purpose (P30 §2.5): the engine writes the stable key
 *  (`F1`, `F2` … in carrier order) at materialize and overwrites whatever the child
 *  put there, so the prompt shows the field exists while the child owes nothing. A
 *  required `id` would push an engine-owned value onto the child and add a pointless
 *  read-back BLOCK face for a field the engine always rewrites. */
const FINDING: SchemaNode = {
  type: "object",
  required: ["severity", "lens", "summary"],
  properties: {
    id: { type: "string" },
    severity: { type: "string", enum: ["blocker", "warn", "nit"] },
    lens: { type: "string" },
    section: { type: "string" },
    line: { type: "integer" },
    summary: { type: "string" },
    fix: { type: "string" },
    // P37 §2.1 — the blocker evidence slot. Declared OPTIONAL on the schema face by
    // design: warn / nit findings owe no scenario, so a required `impact` would BLOCK
    // legal drafts. A blocker's obligation is judged by `gradingViolations` (the
    // grading gate), never by the shape walk — the shape only pins what a scenario IS.
    impact: {
      type: "object",
      required: ["scenario"],
      properties: { scenario: { type: "string" }, test: { type: "string" } },
    },
    // P37 §5 — the cross-round downgrade reason. Optional at the schema layer: only
    // the cross-round identity + scenario identity judgment requests it.
    regrade: { type: "string" },
    // P37 §2.3 — the repair anchor a fix round locates the finding by. Never read by
    // `rollup`; its `path` is a pin judged on the handoff read-back corpus.
    contract: {
      type: "object",
      required: ["path", "anchor"],
      properties: { path: { type: "string" }, anchor: { type: "string" } },
    },
    // P41 §2.1 — the blocker's reproduction slot: where a reader re-runs the claim
    // (a command, or a `doc.md#section` pointer). Declared OPTIONAL on the shape face
    // for the same reason `impact` is: warn / nit owe nothing, so a required slot
    // would BLOCK legal drafts. A blocker's obligation is judged by
    // `gradingViolations` (`evidence-missing`), never by this shape walk.
    evidence: {
      type: "object",
      required: ["repro"],
      properties: { repro: { type: "string" }, output: { type: "string" } },
    },
  },
};

/** The ONE carrier declaration — the five child-writable slots. DECLARATION ORDER IS
 *  PROJECTION ORDER: `#writable(plane)` filters these properties in this order, so the
 *  judge fence keeps its `findings` · `artifacts` · `notes` byte order and the work
 *  fence appends `dispositions` after its long-standing three. Reserved fields
 *  (phase · tasks) are NOT declared and are DROPPED by materialize (never a BLOCK) —
 *  the engine stays the carrier's single author.
 *  `as const` preserves the literal property keys — the `Carrier` type family below
 *  derives its field set FROM these declared keys. */
const CARRIER = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["APPROVED", "BLOCKED"] },
    findings: { type: "array", items: FINDING },
    artifacts: { type: "object" },
    notes: { type: "array", items: { type: "string" } },
    // The fix round's per-finding dispositions (design spec §3.4) — a WORK carrier
    // slot whose keys are the requesting review carrier's finding summaries verbatim.
    // Declared as a bare object: the key set is data (the summaries), never a fixed
    // property table — the fix criterion judges the value shape, the schema the slot's.
    dispositions: { type: "object" },
  },
} as const satisfies SchemaNode;

/** The plane → writable slot table — the ONE projection source (`#writable`) the
 *  prompt fence, the read-back validator and the dropped-key walk all read. The
 *  shared slots (artifacts · notes) are both-plane by design; the exclusive slots ARE
 *  the plane (`status` + `dispositions` for work, `findings` for judge). */
const PLANE_SLOTS: Readonly<Record<CarrierPlane, readonly string[]>> = {
  work: ["status", "artifacts", "notes", "dispositions"],
  judge: ["findings", "artifacts", "notes"],
};

/** The plane → required slot table. The work plane's round conclusion is the child's
 *  own declared status, so status + artifacts are the required core. The judge plane
 *  requires the findings its conclusion rolls up from; artifacts / notes ride as
 *  declared optional slots (a review writes only what it has). `dispositions` stays
 *  OPTIONAL on the work plane: its absence is the fix criterion's own hard refusal,
 *  so `implement` is never asked to declare it. */
const PLANE_REQUIRED: Readonly<Record<CarrierPlane, readonly string[]>> = {
  work: ["status", "artifacts"],
  judge: ["findings"],
};

/** The test-evidence file schema — the evidence gate's engine read-back contract
 *  (the second fix for a prose-only claim: the old prompt asserted an engine read-back
 *  that the engine never performed; now both projections are real). A work-plane wave /
 *  branch round missing or violating this file rewrites the round to BLOCKED. */
const EVIDENCE: SchemaNode = {
  type: "object",
  required: ["command", "exit_code", "passed", "warnings_count", "typecheck"],
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

/** One finding's reproduction (P41 §2.1) — where a reader re-runs the claim. `repro`
 *  is a command or a `doc.md#section` pointer and must be non-blank; `output` names
 *  the bytes when they are too long to inline. */
export interface FindingEvidence {
  readonly repro: string;
  readonly output?: string;
}

/** The carrier value-type mapping — every declared carrier field's value type. This
 *  is the ONE hand-maintained byte table (the type-level twin of the schema property
 *  values); `Carrier` maps each declared key through it. A wrong entry reads as a
 *  build error at the first carrier read/write — it cannot silently pass. */
export type CarrierValue = {
  status: "APPROVED" | "BLOCKED";
  artifacts: Record<string, string>;
  notes: string[];
  dispositions: Record<string, { status: "fixed" | "rejected"; reason?: string }>;
  findings: {
    /** Engine-written at materialize (carrier order → `F1`, `F2` …); a child value
     *  is overwritten, so the draft may carry it or omit it. */
    id?: string;
    severity: "blocker" | "warn" | "nit";
    lens: string;
    section?: string;
    line?: number;
    summary: string;
    fix?: string;
    /** P37 §2.1 — the blocker's reproducible scenario (input / condition → actual →
     *  expected), with an optional test pin that sharpens it. */
    impact?: { scenario: string; test?: string };
    /** P37 §5 — the cross-round downgrade reason. */
    regrade?: string;
    /** P37 §2.3 — the optional repair anchor (a contract document path + a section /
     *  AC / rule id). */
    contract?: { path: string; anchor: string };
    /** P41 §2.1 — the blocker's reproduction: a non-blank `repro` the reader can
     *  re-run, with an optional `output` locator. */
    evidence?: FindingEvidence;
  }[];
};

/** The derived carrier: the mapped type whose field set comes FROM the ONE
 *  declaration's `properties` keys, so a schema edit reshapes the carrier by
 *  construction (zero hand-maintained parallel field tables). `-readonly` keeps the
 *  carrier MUTABLE — the round conclusion (status) rides the caller's set below the
 *  skeleton, never a frozen build-time value. */
export type Carrier = {
  -readonly [K in keyof (typeof CARRIER)["properties"]]: CarrierValue[K];
};

/** The criteria row a grading refusal comes from — one refusal carries its own word,
 *  so a round with two refusals renders two labelled segments and a round with one is
 *  byte-identical to the single-criterion message it always printed. */
export type GradingViolationCriterion = "grading-impact-missing" | "evidence-missing";

/** One finding the grading gate refuses — the identifying cells the failure face
 *  prints (`id` is the engine-written key or absent on a legacy carrier; `summary` is
 *  the description, absent when the draft carried none) and the criterion it broke. */
export interface GradingViolation {
  readonly criterion: GradingViolationCriterion;
  readonly id?: string;
  readonly summary?: string;
}

/** One formed problem of a schema violation — the `path: reason` wording. */
export interface SchemaProblem {
  path: string;
  reason: string;
}

/** The walk's two tiers over one declaration: `strict` records every mismatch as a
 *  problem (the evidence gate's ruling), `tiered` turns a DECORATIVE slot's mismatch
 *  into a drop while a required slot's mismatch stays a problem (the dispatch gate's). */
type CheckTier = "strict" | "tiered";

/** One walk's accumulating ruling — the tier it judges in, the refusal list and the
 *  decorative slots it dropped. */
interface CheckOut {
  readonly tier: CheckTier;
  readonly problems: SchemaProblem[];
  readonly dropped: string[];
}

/** The tiered read-back ruling: the problems the draft is REFUSED on (a required
 *  slot's violation) and the decorative slots DROPPED in place (a declared but
 *  non-required slot whose value breaks its own declaration). */
export interface ReadBack {
  problems: readonly string[];
  dropped: readonly string[];
}

/**
 * HandoffSchema — one declaration, two projections. `readBack(plane, draft)` is the
 * carrier read-back validator (projection ② — the engine's seat, session plane: the
 * dispatch gate's tiered ruling), and `evidenceViolations(value)` is the strict walk
 * of the evidence file's own declaration (the evidence gate's input). The carrier
 * plane has no strict reader: a decorative slot's mistake there costs a field, never
 * a round, so a second strict walk of the carrier would judge nothing.
 * `schemaText(plane, evidence)` is the injected prompt text (projection ① — fixed
 * prefix tail, byte-stable per plane so the dispatch prompt stays cache-friendly).
 * `rollup(findings)` derives the review conclusion the old JSON face rolled up.
 */
export class HandoffSchema {
  /** The carrier plane of an op — the ONE derivation, never a per-family declaration.
   *  implement / fix author a work carrier (status + artifacts); review authors a
   *  judge carrier (findings — conclusion rolled up). */
  static planeOf(op: OpType): CarrierPlane {
    return op === "review" ? "judge" : "work";
  }

  /** Projection ① — the `## Handoff schema` section text: the plane's writable
   *  subset in a ```json fence + (work plane) the evidence file's schema in a second
   *  fence. The carrier fence is byte-stable per (plane, evidence) — the fixed bytes
   *  of the dispatch prompt's contract surface. The evidence sentence names the
   *  `OUTPUT_EVIDENCE` slot alone — the file's own name is the naming face's single
   *  source (`tasks-*` / `branch-*` per family), never a second spelling here. */
  schemaText(plane: CarrierPlane, evidence: boolean): string {
    const carrier = this.#json(this.#writable(plane));
    let text = `Write the handoff draft at \`OUTPUT_HANDOFF\` per this writable subset — the engine validates it, then materializes the final carrier in place; fields not listed here are engine-reserved, do not write them.\n\n\`\`\`json\n${carrier}\n\`\`\``;
    if (evidence) {
      text += `\n\nThe evidence file (the file named by \`OUTPUT_EVIDENCE\`) must comply with this schema — the engine reads it back with the same stakes:\n\n\`\`\`json\n${this.#json(EVIDENCE)}\n\`\`\``;
    }
    return text;
  }

  /** The declared evidence schema, as text (the evidence-gate prompt's shared fence). */
  evidenceSchemaText(): string {
    return this.#json(EVIDENCE);
  }

  /** The TIERED read-back — the dispatch gate's ONE ruling (spec §2.1): a REQUIRED
   *  slot that violates its declaration REFUSES the draft (the round blocks), while a
   *  DECORATIVE slot (declared, not required — BOTH planes' `notes`, the work plane's
   *  `dispositions`, the judge plane's `artifacts` and the finding row's `id` /
   *  `section` / `line` / `fix`) is DROPPED: its path is reported once and the slot is
   *  never carried. The walk WRITES nothing — materialize's copy points (`draftNotes`
   *  / `dispositions` / the judge carrier's `artifacts` read at lifecycle.ts's
   *  `#materialize` / `#findingsList`) consume `dropped`, so the ruling and the carrier
   *  cannot disagree. A wrong decorative value costs a field, never a round — the
   *  refusal face stays exactly as wide as the fields the child owes. */
  readBack(plane: CarrierPlane, draft: Record<string, unknown>): ReadBack {
    const out: CheckOut = { tier: "tiered", problems: [], dropped: [] };
    this.#check(this.#writable(plane), draft, "", out);
    return { problems: HandoffSchema.#problemsOf(out.problems), dropped: out.dropped };
  }

  /** Projection ② — validate the test-evidence file (work-plane wave / branch rounds). */
  evidenceViolations(value: unknown): string[] {
    if (value === null || value === undefined) return ["the evidence file is missing"];
    const out: CheckOut = { tier: "strict", problems: [], dropped: [] };
    this.#check(EVIDENCE, value, "", out);
    return HandoffSchema.#problemsOf(out.problems);
  }

  /** The round conclusion, DERIVED at judgment time from the plane — the single
   *  source the review/fix ledger legs read (D27 · judgment face ⊥ input face).
   *  The judge plane rolls its conclusion UP from its findings (defined for every
   *  carrier — a review never carries a child-authored status, and the persisted
   *  findings carrier holds none). The work plane reads its DECLARED status, and the
   *  absence of a declaration is itself a fact: an ABSENT status → `undefined` (no
   *  conclusion was declared — never an invented approval OR an invented failure ·
   *  D27 present-facts-only), while a PRESENT-but-invalid byte (outside the enum the
   *  schema pinned) degrades to BLOCKED — the conservative reading of a malformed
   *  declaration. `undefined` is DISTINCT from BLOCKED to the caller (the router
   *  treats undefined as "not a failure", a declared BLOCKED as the failure face), so
   *  a work carrier that predates the status field never reads as a fabricated
   *  failure. `carrier` is the on-disk carrier (or a freshly built one) — the
   *  conclusion is never a stored field, so any plane's carrier derives it the same way. */
  conclusionOf(plane: CarrierPlane, carrier: Record<string, unknown>): RoundStatus | undefined {
    if (plane === "judge") {
      const findings = Array.isArray(carrier.findings) ? carrier.findings : [];
      return this.rollup(findings);
    }
    // The work plane reads its DECLARED status. Absent → undefined (no declaration);
    // present-but-invalid → BLOCKED (a declared conclusion that is malformed is a
    // failure signal, never silently approved). This is the ONE ruling for a work
    // status: the reconstruct's work leg delegates here, so the read-back and the
    // judgment-time derivation never disagree.
    const status = carrier.status;
    if (status === undefined) return undefined;
    return status === "APPROVED" || status === "BLOCKED" ? status : "BLOCKED";
  }

  /** The review conclusion rollup — status derived from the findings severities
   *  (the rollup the retired JSON-return channel performed; a review never carries
   *  a child-authored status). Unchanged by the grading gate: `rollup` counts
   *  blockers and nothing else, so the refusal is never a fourth conclusion. */
  rollup(findings: readonly unknown[]): RoundStatus {
    const blockers = findings.filter(
      (finding) => (finding as { severity?: unknown } | null)?.severity === "blocker",
    ).length;
    return blockers > 0 ? "CHANGES_REQUESTED" : findings.length > 0 ? "REVIEW_FIX" : "APPROVED";
  }

  /** P37 §2.2 · P41 §2.2 — the blocker evidence gate, a PURE predicate colocated with
   *  `rollup`. A finding graded `blocker` owes TWO things: a non-blank
   *  `impact.scenario` (the legal input → actual → expected shape) and a non-blank
   *  `evidence.repro` (where a reader re-runs the claim). Every blocker that lacks
   *  either is returned, tagged with the criterion it broke, so the failure face can
   *  list them all (never one of two) under the words their own criterion prints.
   *  Warn / nit findings owe nothing here, and the predicate never judges severity —
   *  the tier is the child's call, this gate only asks whether a blocker paid its
   *  evidence. `rollup` deliberately does not call it: a review conclusion is not a
   *  place to refuse a round, and `rollup`'s return type stays `RoundStatus`. */
  gradingViolations(findings: unknown): readonly GradingViolation[] {
    if (!Array.isArray(findings)) return [];
    const violations: GradingViolation[] = [];
    for (const entry of findings) {
      const row = entry as {
        severity?: unknown;
        id?: unknown;
        summary?: unknown;
        impact?: { scenario?: unknown };
        evidence?: { repro?: unknown };
      } | null;
      if (row?.severity !== "blocker") continue;
      const cells = {
        ...(typeof row.id === "string" && row.id.length > 0 ? { id: row.id } : {}),
        ...(typeof row.summary === "string" ? { summary: row.summary } : {}),
      };
      if (!HandoffSchema.#nonBlank(row.impact?.scenario)) {
        violations.push({ criterion: "grading-impact-missing", ...cells });
      }
      if (!HandoffSchema.#nonBlank(row.evidence?.repro)) {
        violations.push({ criterion: "evidence-missing", ...cells });
      }
    }
    return violations;
  }

  /** A cell's non-blank test — the ONE ruler `impact.scenario` and `evidence.repro`
   *  share, so "present but blank" reads as absent on both faces. */
  static #nonBlank(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
  }

  /** The draft findings presented as round findings — unknown severities dropped
   *  (the capsule's blocker count + the outcome's face, never the judgment domain).
   *  The three cells the cross-round regrade judgment reads ride along (P37 §2.1 ·
   *  §5.1): the engine-written `id`, the blocker's `impact` and the round's own
   *  `regrade`. Each cell is projected only when it keeps its declared shape — a
   *  malformed cell reads as absent, never as a fabricated value. */
  findingsOf(findings: unknown): readonly RoundFinding[] {
    if (!Array.isArray(findings)) return [];
    const rows: RoundFinding[] = [];
    for (const entry of findings) {
      const row = entry as {
        severity?: unknown;
        summary?: unknown;
        id?: unknown;
        impact?: { scenario?: unknown; test?: unknown } | null;
        regrade?: unknown;
      } | null;
      const severity = row?.severity;
      if (severity !== "blocker" && severity !== "warn" && severity !== "nit") continue;
      const id = HandoffSchema.#textOf(row?.id);
      const impact = HandoffSchema.#impactOf(row?.impact);
      const regrade = HandoffSchema.#textOf(row?.regrade);
      rows.push({
        severity: severity as FindingSeverity,
        summary: HandoffSchema.#textOf(row?.summary),
        ...(id === undefined ? {} : { id }),
        ...(impact === undefined ? {} : { impact }),
        ...(regrade === undefined ? {} : { regrade }),
      });
    }
    return rows;
  }

  /** P37 §5.1 — the cross-round downgrade judgment, a PURE predicate over the two
   *  rounds' findings projections. Returns the current rows that were graded BELOW a
   *  matching earlier row, whose earlier `impact.scenario` was non-empty, and that
   *  carry no `regrade` reason: exactly the rows the display face marks.
   *
   *  The four steps, in order: (1) locate the matching earlier row on EITHER of two
   *  keys — the `summary` text (the defect's description, which survives a reworded
   *  scenario), or the earlier row's `impact.scenario` verbatim (the scenario did not
   *  change, so the defect did not either — the key §5.1 registers alongside the first
   *  one, not instead of it); a multi-row hit is narrowed by the engine-written `id`,
   *  never keyed on `id` (it is a row number, so a re-numbered carrier would pair
   *  unrelated defects); (2) an unchanged or raised grade is no downgrade; (3) a
   *  lowered grade against a non-empty scenario owes a `regrade` reason; (4) a lowered
   *  grade whose earlier scenario was empty has no reference, so the defect is read as
   *  changed. Omission or rewriting of THIS round's scenario never retires the duty once
   *  a pair is made — only the earlier row's scenario is read for the reference. */
  static downgrades(
    prior: readonly RoundFinding[],
    current: readonly RoundFinding[],
  ): readonly RoundFinding[] {
    return current.filter(
      (row) =>
        HandoffSchema.#downgradeReference(prior, row) !== undefined &&
        HandoffSchema.#textOf(row.regrade) === undefined,
    );
  }

  /** P37 §5.1 · §5.2 — the reasons the round DID state, in carrier row order. The
   *  counterpart of `downgrades`: the same downgrade judgment, read on the rows that
   *  carry their `regrade` cell. The two sets partition one judgment, so a display face
   *  can print the mark and the reasons from ONE criterion instead of re-deciding which
   *  row was downgraded. */
  static regradeReasons(
    prior: readonly RoundFinding[],
    current: readonly RoundFinding[],
  ): readonly string[] {
    // Rule zero (class-size limit): this file is well past the limit and predates it —
    // splitting it is P39's work (design spec D95 ②), not this round's.
    const reasons: string[] = [];
    for (const row of current) {
      if (HandoffSchema.#downgradeReference(prior, row) === undefined) continue;
      const reason = HandoffSchema.#textOf(row.regrade);
      if (reason !== undefined) reasons.push(reason);
    }
    return reasons;
  }

  /** The earlier row a current row was graded below — §5.1's steps 1 → 4, absent for
   *  every row that is not a downgrade. Step 1 compares TWO keys: the `summary` text and
   *  the earlier row's `impact.scenario` verbatim. Either hit pairs; a multi-row hit is
   *  narrowed by `id`. Rewriting BOTH the summary and this round's scenario is the only
   *  way to cut a pair, and that is a declaration that the defect changed. */
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
    if (HandoffSchema.#tierRankOf(row.severity) >= HandoffSchema.#tierRankOf(reference.severity)) {
      return undefined;
    }
    if (HandoffSchema.#textOf(reference.impact?.scenario) === undefined) return undefined;
    return reference;
  }

  /** The tier ladder's rank — higher is more severe (blocker 2 · warn 1 · nit 0). */
  static #tierRankOf(severity: FindingSeverity): number {
    return severity === "blocker" ? 2 : severity === "warn" ? 1 : 0;
  }

  /** A non-blank string cell, else undefined — the projection's ONE blank test. */
  static #textOf(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }

  /** The blocker's scenario cell when it keeps its declared shape — a scenario-less
   *  impact is absent, never a row carrying an empty reference. */
  static #impactOf(value: { scenario?: unknown; test?: unknown } | null | undefined) {
    const scenario = HandoffSchema.#textOf(value?.scenario);
    if (scenario === undefined) return undefined;
    const test = HandoffSchema.#textOf(value?.test);
    return test === undefined ? { scenario } : { scenario, test };
  }

  /** The plane's writable subset — the ONE projection every consumer reads (prompt
   *  fence · read-back validator · dropped-key walk). The properties are CARRIER's
   *  own slot declarations filtered in declaration order; the required set comes from
   *  the plane table — zero second declaration. */
  planeSchema(plane: CarrierPlane): SchemaNode {
    return this.#writable(plane);
  }

  /** The draft keys materialize drops — every key the plane does not declare as a
   *  child-writable `properties` slot (extra child fields such as a work draft
   *  `findings`). The read-back validator judges these the same way (drop, never a
   *  BLOCK) — materialize surfaces them as the single §8.7 WARN on the carrier's
   *  notes. A non-object draft drops nothing here (its shape is the validator's
   *  semantic refusal). */
  droppedKeys(plane: CarrierPlane, value: unknown): string[] {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
    const declared = new Set(Object.keys(this.#writable(plane).properties ?? {}));
    return Object.keys(value as Record<string, unknown>).filter((key) => !declared.has(key));
  }

  /** The column one dropped path names inside a finding row — `findings[2].line` at
   *  index 2 reads `line`; every other dropped path (a plane-level slot, another row's
   *  column) reads null. The dropped-path grammar is the walker's own
   *  (`findings[{index}].{column}`), so its parse lives beside the walk that spells it —
   *  materialize's finding copy point calls this instead of re-spelling the shape. */
  static findingColumnOf(path: string, index: number): string | null {
    const match = /^findings\[(\d+)\]\.(.+)$/.exec(path);
    return match !== null && Number(match[1]) === index ? match[2] : null;
  }

  /** The plane's writable subset — CARRIER's declared slots filtered to the plane's
   *  writable set (declaration order preserved) + the plane's required slots. */
  #writable(plane: CarrierPlane): SchemaNode {
    const slots = PLANE_SLOTS[plane];
    const properties: Record<string, SchemaNode> = {};
    for (const [key, node] of Object.entries(CARRIER.properties)) {
      if (slots.includes(key)) properties[key] = node;
    }
    return { type: "object", required: [...PLANE_REQUIRED[plane]], properties };
  }

  /** Serialize a declared schema object into the prompt's fence — COMPACT (no pretty
   *  indent: the injected text is the per-mode fixed prefix's biggest token cost, and
   *  every dispatch pays it in the child context — minify keeps the round cheap). The
   *  declaration IS the writable plane (no engine-only metadata to strip) — the fence
   *  is the declared node verbatim. */
  #json(node: SchemaNode): string {
    return JSON.stringify(node);
  }

  /** The `path: reason` forms of one walk's problems — the ONE wording the read-back
   *  and the evidence gate report. */
  static #problemsOf(problems: readonly SchemaProblem[]): string[] {
    return problems.map((problem) =>
      problem.path.length === 0 ? problem.reason : `${problem.path}: ${problem.reason}`,
    );
  }

  /** Walk one schema node against a value — the ONE walker behind both tiers. `owed`
   *  says whether the slot being judged is one the child OWES: its mismatch is a
   *  problem on either tier. A DECORATIVE slot's mismatch (a declared slot outside the
   *  plane's required set, a finding row's decorative column) is a problem on the strict
   *  walk and a DROP on the tiered one; the parent prunes whatever the slot booked
   *  inside itself and reports the slot's own path.
   *  Five parameters, one reason: `owed` is the recursion's own fact — a per-node
   *  wrapper object would allocate a frame for one boolean and hide the frame's tier. */
  #check(node: SchemaNode, value: unknown, path: string, out: CheckOut, owed = true): void {
    if (node.enum !== undefined && !node.enum.includes(value)) {
      this.#refuse(out, path, `must be one of ${node.enum.join(" | ")}`, owed);
      return;
    }
    if (node.type === "object") {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        this.#refuse(out, path, "expected an object", owed);
        return;
      }
      // Non-declared keys (extra child fields such as a work-draft `findings`) are
      // DROPPED by materialize, never a BLOCK — the validator and materialize judge
      // the same field the same way (§8.7). Only semantic errors on declared fields
      // (required / type / enum / length) refuse the draft.
      this.#checkObject(node, value as Record<string, unknown>, path, out);
      return;
    }
    if (node.type === "array") {
      if (!Array.isArray(value)) {
        this.#refuse(out, path, "expected an array", owed);
        return;
      }
      const items = node.items;
      if (items === undefined) return;
      // An element is owed once its slot is present: a bad element is judged INSIDE the
      // slot, and a decorative slot's parent prunes it with the rest of the slot.
      for (const [index, entry] of value.entries()) {
        this.#check(items, entry, `${path}[${index}]`, out);
      }
      return;
    }
    const reason = HandoffSchema.#scalarReason(node, value);
    if (reason !== null) this.#refuse(out, path, reason, owed);
  }

  /** The object half — the required sweep (a missing owed key refuses on either tier),
   *  then every present declared slot judged at its own owed-ness. */
  #checkObject(node: SchemaNode, obj: Record<string, unknown>, path: string, out: CheckOut): void {
    const required = node.required ?? [];
    for (const key of required) {
      if (obj[key] !== undefined) continue;
      out.problems.push({ path: this.#at(path, key), reason: "required" });
    }
    for (const [key, sub] of Object.entries(node.properties ?? {})) {
      if (obj[key] === undefined) continue;
      const at = this.#at(path, key);
      const owed = required.includes(key);
      const markProblems = out.problems.length;
      const markDropped = out.dropped.length;
      this.#check(sub, obj[key], at, out, owed);
      if (owed || out.tier === "strict" || out.problems.length === markProblems) continue;
      // The decorative slot breaks its own declaration — prune everything it booked
      // inside, then report the slot once (materialize's copy point reads this path).
      out.problems.length = markProblems;
      out.dropped.length = markDropped;
      out.dropped.push(at);
    }
  }

  /** The scalar keywords' judgment — the reason a value breaks its declared type or
   *  length, null when it passes. The enum is judged by the caller first (an enum value
   *  is matched by value, never by the declared type alone). */
  static #scalarReason(node: SchemaNode, value: unknown): string | null {
    if (node.type === "string") {
      if (typeof value !== "string") return "expected a string";
      if (node.minLength !== undefined && value.length < node.minLength)
        return `must be at least ${node.minLength} characters`;
      if (node.maxLength !== undefined && value.length > node.maxLength)
        return `must be at most ${node.maxLength} characters`;
      return null;
    }
    if (node.type === "integer")
      return typeof value === "number" && Number.isInteger(value) ? null : "expected an integer";
    if (node.type === "boolean") return typeof value === "boolean" ? null : "expected a boolean";
    return null;
  }

  /** Book one mismatch at its tier — a problem for an owed slot (or a strict walk), a
   *  dropped path for a decorative one. */
  #refuse(out: CheckOut, path: string, reason: string, owed: boolean): void {
    if (owed || out.tier === "strict") out.problems.push({ path, reason });
    else out.dropped.push(path);
  }

  /** The JSON-path join — `.field` (or bare, at the root). */
  #at(path: string, key: string): string {
    return path.length === 0 ? key : `${path}.${key}`;
  }
}
