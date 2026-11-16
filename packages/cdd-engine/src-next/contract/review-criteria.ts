// packages/cdd-engine/src-next/contract/review-criteria.ts
// P37 T1 — the grading criteria registry (design spec §1, §6.1): the three tier
// boundaries with their evidence duty and their counterexample live as ROWS, and
// `SEVERITY_RUBRIC` is assembled from them. The prose is therefore no longer a
// second copy of the criteria — the registry is the only corpus that reaches the
// rubric's tier body.
//
// One row carries three executable cells: `body` (the boundary), `duty` (what the
// grader owes that tier) and `counterExample` (the neighbouring tier's edge, stated
// as a sentence a reviewer can match a finding against). Assembly reads all three:
// a cell that renders nothing would retire either the evidence duty or the
// counterexample, which is exactly the long-prose failure this registry replaces.
//
// Two distinct validation contracts, both required (design spec §6.1):
//   · the row SHAPE is the type — every row is a `readonly` literal with all six
//     cells (`id` / `tier` / `body` / `duty` / `counterExample` / `face`), so
//     deleting a key is a `tsc` error, not a runtime throw;
//   · the CELL CONTENT is judged at assembly — a cell that is blank after `trim()`,
//     or a tier with no row at all, throws out of `renderRubric()`.
//
// `face` declares the extra execution surface a row is wired to (design spec §6.2):
// `numbered` rows appear in the rendered rubric itself, a `gate` row's `id` is the
// word its mechanical gate prints, and a `test` row's `id` is named by a test title.
// The face is a declaration about wiring; the three prose cells reach the rubric
// bytes for EVERY row regardless of face.
//
// Module-level exports are types / the declared table / the registry instance — zero
// behavior-carrying bare functions.

/** One grading tier, in ascending order of harm. */
export type CriteriaTier = "blocker" | "warn" | "nit";

/** The tier order the rubric assembles in — the ladder a grader answers in order. */
export const TIER_ORDER: readonly CriteriaTier[] = ["blocker", "warn", "nit"];

/** The extra execution surface a row is wired to (design spec §6.2). */
export type CriteriaFace = "gate" | "test" | "numbered";

/** One grading criterion row — the unit the rubric is assembled from. */
export interface CriteriaRow {
  /** The row's stable identity: the `CDD_BLOCKED` gate prints it, tests name it. */
  readonly id: string;
  readonly tier: CriteriaTier;
  /** The tier's boundary: what makes a finding this tier. */
  readonly body: string;
  /** The evidence the grader owes a finding of this tier. */
  readonly duty: string;
  /** The neighbouring tier's edge, stated so a reviewer can match a finding to it. */
  readonly counterExample: string;
  readonly face: CriteriaFace;
}

/** The cell names, in assembly order — the message names the blank cell. */
const CELLS = ["body", "duty", "counterExample"] as const;

/**
 * The declared criteria table. Every tier owes at least one row; the `warn` tier
 * carries two (the debt boundary and the pin parseability gate of §7.4), and the
 * `nit` tier carries two (the expression boundary and the downgrade mark of §5.2).
 */
export const CRITERIA_ROWS: readonly CriteriaRow[] = [
  {
    id: "grading-impact-missing",
    tier: "blocker",
    body: "A finding is a blocker when the functional result departs from expectation or sows a functional defect: the bytes, exit code or rendering a consumer receives contradict the declared contract, or a legal input reaches an undeclared outcome. The four typical instances: a declared acceptance gate, contract or prompt is violated where the consumer can see it; a legal input escapes the declared failure face (a blank input returns 500, an unknown id is not a 404); the gate fails or the suite can never go red (an inert grep · a dead guard · an unconditional skip); a security or privacy defect. Violating a written sentence while the bytes a consumer receives stay unchanged is a warn, not a blocker — citing a clause is not the same as affecting behaviour.",
    duty: "A blocker owes a reproducible scenario: the legal input or condition → what actually happens → what was expected, one sentence the next reviewer can refute on the spot.",
    counterExample:
      "A deviation you can describe but cannot back with a scenario (which legal input → what actually happens → what was expected) is a warn, not a blocker: an unrefutable deviation is not yet a functional impact, so the finding is graded by the consequence its own description states.",
    face: "gate",
  },
  {
    id: "debt-consequence",
    tier: "warn",
    body: "A finding is a warn when it leaves this round's functional result unchanged but makes the next person do the wrong thing: debt (a duplicated policy · a stale docstring · a missing coverage case), a misleading claim no consumer is hurt by, a gap nobody verifies, or dead code that tempts a later reader to believe it still runs.",
    duty: "A warn owes the consequence: not a failure today, but who will take which step wrongly, and when.",
    counterExample:
      "Dead code that nothing calls today and no output depends on is a warn, not a nit: it changes what the next reader believes, which is the warn / nit boundary itself.",
    face: "numbered",
  },
  {
    id: "pin-parseability",
    tier: "warn",
    body: "A pin that resolves nowhere is a warn: an unresolvable path, symbol or test title leaves a claim nobody can re-check, while the bytes a consumer receives stay unchanged.",
    duty: "A pin finding owes the consequence: the next reader either trusts the claim blindly or drops it, and either way the document loses a coordinate.",
    counterExample:
      "P28 withdrew the old docs-validation gate as too heavy and left legality to the dispatch gate, which judges document structure and never pin coordinates; this gate returns in its narrow form, so a pin is judged on its own three shapes (a path segment, a symbol, a test title) only — never document structure, never semantics, never the whole docs corpus — and a `contract.path` belongs to the handoff read-back corpus, which `PinAudit` never carries.",
    face: "test",
  },
  {
    id: "expression-only",
    tier: "nit",
    body: "A finding is a nit when it is pure expression: naming, line-wrapping, comment wording, ordering inside one file — it changes neither behaviour nor anyone's judgment.",
    duty: "A nit owes why it is not a warn: one sentence saying which judgment it leaves untouched.",
    counterExample:
      "A naming inconsistency that stays self-consistent inside one file is a nit, not a warn: no cross-surface reader is misled.",
    face: "numbered",
  },
  {
    id: "regrade-mark",
    tier: "nit",
    body: "downgraded without a regrade reason",
    duty: "The mark is a display fact: it rides the board's verb token after its `+N` count and the capsule summary line, never a finding row, never a carrier entry, and never the round's conclusion.",
    counterExample:
      "A downgrade whose previous round carried no scenario has no reference to hold it against, so the finding is read as a changed defect and carries no mark.",
    face: "numbered",
  },
];

/**
 * The criteria registry — the lookup face (`of`, an unregistered id throws) and the
 * rubric assembly (`renderRubric`). Both preserve the declared order: same-tier rows
 * sit adjacent, and the tiers run blocker → warn → nit.
 */
export class CriteriaRegistry {
  readonly #rows: readonly CriteriaRow[];

  constructor(rows: readonly CriteriaRow[] = CRITERIA_ROWS) {
    this.#rows = rows;
  }

  /** The declared rows, in declaration order — the structural test's row census. */
  get rows(): readonly CriteriaRow[] {
    return this.#rows;
  }

  /** One row by id — an unregistered id throws, so a gate or a test that names a
   *  criterion can never quietly read nothing. */
  of(id: string): CriteriaRow {
    const row = this.#rows.find((candidate) => candidate.id === id);
    if (row === undefined) {
      throw new Error(`no grading criterion is registered under "${id}"`);
    }
    return row;
  }

  /** The tier body the rubric is assembled from: each row contributes its three
   *  cells in the fixed order `body` → `duty` → `counterExample`, one space apart;
   *  same-tier rows join in declaration order, and the tiers run blocker → warn →
   *  nit. A blank cell or an empty tier throws — no tier fragment ever renders
   *  short of a sentence. */
  renderRubric(): string {
    const tiers: string[] = [];
    for (const tier of TIER_ORDER) {
      const rows = this.#rows.filter((row) => row.tier === tier);
      if (rows.length === 0) {
        throw new Error(`the criteria registry declares no "${tier}" row — every tier owes one`);
      }
      tiers.push(
        rows
          .map((row) => this.#fragmentOf(row))
          .join(" ")
          .trim(),
      );
    }
    return tiers.join(" ");
  }

  /** One row's rubric fragment — its three cells, each trimmed, each required. */
  #fragmentOf(row: CriteriaRow): string {
    const cells = [row.body, row.duty, row.counterExample].map((cell) => cell.trim());
    for (const [index, cell] of cells.entries()) {
      if (cell.length === 0) {
        throw new Error(
          `criteria row "${row.id}" leaves its ${CELLS[index]} cell blank — every cell reaches the rubric`,
        );
      }
    }
    return cells.join(" ");
  }
}

/** The process-wide registry — the one table every consumer reads. */
export const CRITERIA = new CriteriaRegistry();
