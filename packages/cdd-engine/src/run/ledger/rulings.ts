// packages/cdd-engine/src/run/ledger/rulings.ts
// The orchestrator's rulings and the engine's re-grade facts — one home for both.
//
// A ruling answers a finding of a carrier the engine already froze: it never edits those
// bytes, it states which finding it answers and what the orchestrator decided. A re-grade
// states that a defect came back one tier lower (or higher) and WHY: the record keeps the
// original grade AND the new one, so a reader can tell a re-grade from a changed defect.
//
// Two faces of one table:
//   · the VALUE — the recorded rulings and re-grades of one line, immutable, replaced as a
//     whole (a second ruling on one finding supersedes the first rather than stacking);
//   · the SCHEMA — the strict read of a rulings sidecar (`*.rulings.json`), which refuses
//     the whole file over one bad row instead of handing back a half value. The strict
//     read is the pre-spawn gate's input, so a written ruling can never be silently
//     invisible to the round that consumes it.
//
// Invariant: one finding carries at most one ruling and at most one re-grade, and every
// recorded row states why. A `rejected` verdict owes its probe (rejecting a review is the
// one "the reviewer was wrong" move, so it must carry a re-checkable path); a re-grade owes
// its reason (a grade that moved without one retires the downgrade mark's meaning).

/** The two verdicts a ruling can carry. */
export type RulingVerdict = "fixed" | "rejected";

/** The declared verdicts, in the order a refusal names them — the runtime companion. */
export const RULING_VERDICTS = ["fixed", "rejected"] as const satisfies readonly RulingVerdict[];

/** The three grades a finding can carry on the read face (the write face authors two; a
 *  stored legacy row keeps `nit`). */
export type Grade = "blocker" | "warn" | "nit";

/** The declared grades, in the order a refusal names them — the runtime companion. */
export const GRADES = ["blocker", "warn", "nit"] as const satisfies readonly Grade[];

/** One recorded ruling — the finding it answers and the decision, verbatim. */
export interface RulingRecord {
  /** The carrier finding id the ruling answers (`F1`, `F2` …). */
  readonly finding: string;
  /** The decision, when the orchestrator declared one. A ruling may state only its text (the
   *  pre-existing sidecars do): absence is a fact, never an invented verdict. */
  readonly verdict?: RulingVerdict;
  /** The decision's text, verbatim (the orchestrator's own words). */
  readonly ruling: string;
  /** The reproduction a `rejected` verdict owes — where a reader re-checks that the
   *  review was wrong. */
  readonly probe?: string;
  /** When the ruling was recorded (the orchestrator's stamp). */
  readonly at?: string;
  /** Who recorded the ruling. */
  readonly by?: string;
}

/** One recorded re-grade — both ends of the grade change and the reason it happened. */
export interface RegradeRecord {
  /** The finding whose grade moved. */
  readonly finding: string;
  /** The grade the previous round carried. */
  readonly from: Grade;
  /** The grade this round carries. */
  readonly to: Grade;
  /** Why the grade moved — required, never a default. */
  readonly reason: string;
}

/** The sidecar's three-state read: no file / a schema-conforming file / a refusal. */
export type RulingRead =
  | { readonly kind: "absent" }
  | { readonly kind: "ok"; readonly rulings: readonly RulingRecord[] }
  | { readonly kind: "invalid"; readonly reason: string };

/** The top-level keys the schema declares — anything else is refused, never ignored. */
const TOP_KEYS: ReadonlySet<string> = new Set(["carrier", "rulings"]);

/** The ruling cells the schema declares beyond the identifier. */
const RULING_KEYS: ReadonlySet<string> = new Set([
  "finding",
  "id",
  "ruling",
  "verdict",
  "probe",
  "at",
  "by",
]);

/**
 * Rulings — one line's recorded rulings and re-grades. Invariant: one finding carries at
 * most one ruling and one re-grade, and every row that states a decision states why.
 * Immutable: a change answers a new value, so a caller can never half-update a record.
 */
export class Rulings {
  readonly #rulings: ReadonlyMap<string, RulingRecord>;
  readonly #regrades: ReadonlyMap<string, RegradeRecord>;

  private constructor(
    rulings: ReadonlyMap<string, RulingRecord>,
    regrades: ReadonlyMap<string, RegradeRecord>,
  ) {
    this.#rulings = rulings;
    this.#regrades = regrades;
  }

  /** No ruling and no re-grade — the ordinary line. */
  static empty(): Rulings {
    return new Rulings(new Map(), new Map());
  }

  /** A line's records as they were read back — a repeated finding keeps its LAST row
   *  (one finding, one ruling). */
  static of(opts: {
    readonly rulings?: readonly RulingRecord[];
    readonly regrades?: readonly RegradeRecord[];
  }): Rulings {
    const rulings = new Map<string, RulingRecord>();
    for (const ruling of opts.rulings ?? []) rulings.set(ruling.finding, ruling);
    const regrades = new Map<string, RegradeRecord>();
    for (const regrade of opts.regrades ?? []) regrades.set(regrade.finding, regrade);
    return new Rulings(rulings, regrades);
  }

  /** Record one ruling — refused unless it states a decision a reader can act on. */
  record(ruling: RulingRecord): Rulings {
    Rulings.#assertRuling(ruling);
    const rulings = new Map(this.#rulings);
    rulings.set(ruling.finding, ruling);
    return new Rulings(rulings, this.#regrades);
  }

  /** Record one re-grade — both ends and the reason are kept. */
  regrade(regrade: RegradeRecord): Rulings {
    Rulings.#assertRegrade(regrade);
    const regrades = new Map(this.#regrades);
    regrades.set(regrade.finding, regrade);
    return new Rulings(this.#rulings, regrades);
  }

  /** One finding's ruling, or null. */
  of(finding: string): RulingRecord | null {
    return this.#rulings.get(finding) ?? null;
  }

  /** One finding's re-grade, or null. */
  regradeOf(finding: string): RegradeRecord | null {
    return this.#regrades.get(finding) ?? null;
  }

  /** Every ruling, in first-recorded order. */
  rulings(): readonly RulingRecord[] {
    return [...this.#rulings.values()];
  }

  /** Every re-grade, in first-recorded order. */
  regrades(): readonly RegradeRecord[] {
    return [...this.#regrades.values()];
  }

  /** The strict sidecar read — one bad row refuses the WHOLE file, so the gate that reads
   *  it can never act on a half-parsed set of rulings. `findingIds` is the carrier's own
   *  id set: a ruling on a finding the carrier does not carry is refused rather than
   *  carried into the round as a phantom. `carrierName` is the carrier file's base name —
   *  a sidecar naming another file answers a different carrier. */
  static read(
    text: string | null,
    carrierName: string,
    findingIds: ReadonlySet<string>,
  ): RulingRead {
    if (text === null) return { kind: "absent" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { kind: "invalid", reason: "the sidecar is not JSON" };
    }
    const record = Rulings.#recordOf(parsed);
    if (record === null) return { kind: "invalid", reason: "the sidecar is not a JSON object" };
    const unknown = Object.keys(record).filter((key) => !TOP_KEYS.has(key));
    if (unknown.length > 0) {
      return {
        kind: "invalid",
        reason: `unknown top-level key(s) — the schema declares ${[...TOP_KEYS].join(" / ")}`,
      };
    }
    const carrierRefusal = Rulings.#carrierRefusal(record, carrierName);
    if (carrierRefusal !== null) return { kind: "invalid", reason: carrierRefusal };
    if (!Array.isArray(record.rulings)) {
      return { kind: "invalid", reason: "the sidecar carries no `rulings` array" };
    }
    const rulings: RulingRecord[] = [];
    for (const [index, entry] of record.rulings.entries()) {
      const row = Rulings.#rulingOf(entry, index, findingIds);
      if (typeof row === "string") return { kind: "invalid", reason: row };
      rulings.push(row);
    }
    return { kind: "ok", rulings };
  }

  /** The `carrier` key's refusal — absent is legal; present must name this carrier. */
  static #carrierRefusal(record: Record<string, unknown>, carrierName: string): string | null {
    if (!("carrier" in record)) return null;
    const declared = record.carrier;
    if (typeof declared !== "string" || declared !== carrierName) {
      return `\`carrier\` names ${JSON.stringify(declared)} ≠ the carrier ${carrierName}`;
    }
    return null;
  }

  /** One ruling entry — the narrowed record, or the refusal's reason. Exactly one
   *  identifier spelling is accepted; two is an ambiguity the schema refuses rather than
   *  picking a winner. */
  static #rulingOf(
    entry: unknown,
    index: number,
    findingIds: ReadonlySet<string>,
  ): RulingRecord | string {
    const row = Rulings.#recordOf(entry);
    if (row === null) return `ruling #${index + 1} is not a JSON object`;
    const unknown = Object.keys(row).filter((key) => !RULING_KEYS.has(key));
    if (unknown.length > 0) {
      return `ruling #${index + 1} carries unknown key(s) — ${unknown.join(", ")}`;
    }
    const spellings = ["finding", "id"].filter((key) => key in row);
    if (spellings.length !== 1) {
      return spellings.length === 0
        ? `ruling #${index + 1} carries no string \`finding\``
        : `ruling #${index + 1} carries both identifiers — one per ruling`;
    }
    const finding = row[spellings[0] as string];
    if (typeof finding !== "string") return `ruling #${index + 1} carries no string \`finding\``;
    if (typeof row.ruling !== "string") return `ruling #${index + 1} carries no string \`ruling\``;
    const shape = Rulings.#valueRefusal(row, index, findingIds, finding);
    if (shape !== null) return shape;
    return {
      finding,
      ...(row.verdict === undefined ? {} : { verdict: row.verdict as RulingVerdict }),
      ruling: row.ruling,
      ...(typeof row.probe === "string" ? { probe: row.probe } : {}),
      ...(typeof row.at === "string" ? { at: row.at } : {}),
      ...(typeof row.by === "string" ? { by: row.by } : {}),
    };
  }

  /** The verdict / probe / stamp cells and the carrier membership of one entry. */
  static #valueRefusal(
    row: Record<string, unknown>,
    index: number,
    findingIds: ReadonlySet<string>,
    finding: string,
  ): string | null {
    if (row.verdict !== undefined && !RULING_VERDICTS.includes(row.verdict as RulingVerdict)) {
      return `ruling #${index + 1} carries a \`verdict\` outside ${RULING_VERDICTS.join(" | ")}`;
    }
    if (row.probe !== undefined && typeof row.probe !== "string") {
      return `ruling #${index + 1} carries a non-string \`probe\``;
    }
    if (row.verdict === "rejected" && String(row.probe ?? "").trim().length === 0) {
      return `ruling #${index + 1} is \`rejected\` but carries no \`probe\``;
    }
    if (row.at !== undefined && typeof row.at !== "string") {
      return `ruling #${index + 1} carries a non-string \`at\``;
    }
    if (row.by !== undefined && typeof row.by !== "string") {
      return `ruling #${index + 1} carries a non-string \`by\``;
    }
    if (!findingIds.has(finding)) {
      return `ruling #${index + 1} answers ${finding}, which is not a finding of the carrier`;
    }
    return null;
  }

  /** The value narrowed to a plain object (arrays and null are not records). */
  static #recordOf(value: unknown): Record<string, unknown> | null {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  /** A recorded ruling's own shape — the same duty the schema enforces on a sidecar. */
  static #assertRuling(ruling: RulingRecord): void {
    if (ruling.verdict !== undefined && !RULING_VERDICTS.includes(ruling.verdict)) {
      throw new Error(`Rulings: "${String(ruling.verdict)}" is not a declared verdict`);
    }
    if (ruling.finding.trim().length === 0) {
      throw new Error("Rulings: a ruling answers no finding");
    }
    if (ruling.ruling.trim().length === 0) {
      throw new Error(`Rulings: the ruling on ${ruling.finding} states no decision`);
    }
    if (ruling.verdict === "rejected" && (ruling.probe ?? "").trim().length === 0) {
      throw new Error(`Rulings: the rejected ruling on ${ruling.finding} owes a probe`);
    }
  }

  /** A re-grade's own shape: both ends declared, different, and the reason stated. */
  static #assertRegrade(regrade: RegradeRecord): void {
    if (!GRADES.includes(regrade.from) || !GRADES.includes(regrade.to)) {
      throw new Error(`Rulings: the re-grade on ${regrade.finding} names an undeclared grade`);
    }
    if (regrade.from === regrade.to) {
      throw new Error(
        `Rulings: the re-grade on ${regrade.finding} keeps the ${regrade.from} grade`,
      );
    }
    if (regrade.reason.trim().length === 0) {
      throw new Error(`Rulings: the re-grade on ${regrade.finding} states no reason`);
    }
  }
}
