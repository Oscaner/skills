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
// Display wording is NOT a rubric cell. The downgrade mark (design spec §5.2) is a
// token the board and the capsule print, not a sentence a grader calibrates against:
// it rides `REGRADE_MARK` below, so the nit tier's prose stays a run of sentences and
// a display fragment can never splice into it.
//
// P37 T2 — the SECOND table (design spec §3.1, §6.1): the lens question rows. One row
// asks what counts as crossing into functional impact under one lens; the row carries
// no `tier`, no `duty` and no `counterExample`, because a question never grades — the
// reviewer answers it along the tier ladder above. `wave` and `branch` share their four
// questions by declaring both kinds on ONE row (`reviewKinds`), so the shared text is
// stored once: 15 physical rows cover 19 (review kind, lens) cells.
//
// `face` is `numbered` on every row: the question's only execution surface is the
// rendered review prompt. `LENS_QUESTIONS.forReviewKind` expands each shared row per
// declared kind in declaration order, and `render/templates.ts` folds that projection
// into the review's `**Criteria —` line as a `1. …` list.
//
// The two tables never merge: a question carries no verdict columns, and a criteria row
// carries no question — asking one table for the other's row is an unregistered lookup
// and throws.
//
// Module-level exports are types / the declared tables / the registry instances — zero
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

/** The downgrade mark's ONE spelling (design spec §5.2) — the display wording the
 *  board's verb token and the capsule summary line print. It is declared here beside
 *  the criteria table because the mark has exactly one source (never a second copy at
 *  a render site), and it is deliberately NOT a rubric cell: a display token has no
 *  place in the tier prose a grader calibrates against. */
export const REGRADE_MARK = "downgraded without a regrade reason";

/** The separator between two downgrade notes on ONE face — the mark and a stated
 *  reason are two sentences, never one spliced phrase. */
export const REGRADE_NOTE_SEPARATOR = "; ";

/** The board's ` · ` cell shape — a reason carrying it would read as two cells on the
 *  ONE token §5.2 pins as one row. */
const BOARD_CELL_SHAPE = / *· */g;

/** Whitespace runs and control characters — a reason carrying a line break would split
 *  the capsule's one line and the board's one token into two. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the control-character range IS the rule here — a display token may not carry a line break or a raw C0 byte.
const DISPLAY_BREAKS = /[\s\u0000-\u001f\u007f]+/g;

/** One stated reason folded to its display form: the author's bytes stay on the carrier,
 *  only the printed wording is collapsed so neither face can split on it. */
const displayReason = (reason: string): string =>
  reason.replace(BOARD_CELL_SHAPE, "; ").replace(DISPLAY_BREAKS, " ").trim();

/** The downgrade note's ONE composition (design spec §5.2) — both display faces take
 *  their bytes from here, so the mark and the stated reason cannot drift apart: a row
 *  that owes its reason prints the mark, a row that states one prints the reason, and
 *  a round with neither prints nothing at all. A stated reason is folded first, so a
 *  line break or the board's own ` · ` never splits the one line / one token it rides. */
export const regradeNote = (owing: number, reasons: readonly string[]): string | undefined => {
  const stated = reasons.map(displayReason).filter((reason) => reason.length > 0);
  const parts = [...(owing > 0 ? [REGRADE_MARK] : []), ...stated];
  return parts.length === 0 ? undefined : parts.join(REGRADE_NOTE_SEPARATOR);
};

/**
 * The declared criteria table. Every tier owes at least one row; the `blocker` tier
 * carries two (the functional-impact boundary and the reproduction gate of §2.2), the
 * `warn` tier carries two (the debt boundary and the pin parseability gate of §7.4),
 * and the `nit` tier carries two (the expression boundary and the downgrade mark of
 * §5.2).
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
    id: "evidence-missing",
    tier: "blocker",
    body: "A finding is missing evidence when it is graded blocker yet names no place its claim can be re-run: `evidence.repro` must carry a command or a `doc.md#section` pointer, and a blank string is as absent as a missing key. The blocker tier is the only one that forces a decision, so it is the only one that owes readable bytes — an unreadable blocker is adopted on trust.",
    duty: "A blocker owes a non-blank `evidence.repro`: the reader re-runs it and either confirms or refutes the finding. An absent one refuses the round, and every offending row is named at once.",
    counterExample:
      "A warn or a nit may leave `evidence` out — nobody adopts its conclusion on its word — so the absence is legal there, while the same absence on a blocker ships a decision nobody can check.",
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
    body: "A finding is downgraded without a regrade reason when the same defect returns one tier lower and the new round states no reason for the change: the reader can no longer tell a re-grade from a changed defect, while the round's own conclusion stays what it was.",
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

/** The review kinds this plane's lens table keys on — the five criteria bodies a
 *  review target selects among. Declared HERE rather than imported from the render
 *  plane: `contract/` never imports `render/` (the dependency edge P39 puts under
 *  test). The value set equals `ReviewKey` structurally, and the two are assignable to
 *  each other, so no import is needed in either direction. */
export type ReviewKind = "wave" | "branch" | "plan" | "overall" | "spec";

/** One lens question row — the `(review kind, lens)` cells it answers. `reviewKinds`
 *  is multi-valued exactly where kinds share one question: the wave / branch four
 *  carry both, so their text is stored once and expanded per kind on projection. */
export interface LensQuestionRow {
  /** The row's stable identity — shared rows are referenced by both their kinds. */
  readonly id: string;
  /** The kinds this question answers, in projection order. */
  readonly reviewKinds: readonly ReviewKind[];
  /** The lens the question judges under (the label every finding carries). */
  readonly lens: string;
  /** The question — what counts as crossing into functional impact under this lens. */
  readonly question: string;
  /** The question's execution surface — always the rendered review prompt. */
  readonly face: "numbered";
}

/** The declared lens question table (§3.1's nineteen cells). The four wave / branch
 *  rows lead (shared text, one copy), then plan, spec and the charter's five. */
export const LENS_QUESTION_ROWS: readonly LensQuestionRow[] = [
  {
    id: "standards-lens",
    reviewKinds: ["wave", "branch"],
    lens: "standards",
    question:
      "Does the change break the repository's own standard on a surface a consumer reads — a public shape, prompt bytes, a documented command, or a contract an existing test pins?",
    face: "numbered",
  },
  {
    id: "spec-lens",
    reviewKinds: ["wave", "branch"],
    lens: "spec",
    question:
      "Does the change depart from the reviewed contract (the wave brief / plan / design spec) while the behaviour a consumer receives changes with it?",
    face: "numbered",
  },
  {
    id: "buildability-lens",
    reviewKinds: ["wave", "branch"],
    lens: "buildability",
    question:
      "Is the reviewer's own typecheck / test run red, or would it go red on a path the plan declares?",
    face: "numbered",
  },
  {
    id: "scope-lens",
    reviewKinds: ["wave", "branch"],
    lens: "scope",
    question:
      "Does the change land outside the wave brief's `**Files:**` surface and the plan's intent, and is that out-of-scope change consumed?",
    face: "numbered",
  },
  {
    id: "plan-completeness",
    reviewKinds: ["plan"],
    lens: "completeness",
    question:
      "Is a spec requirement owned by no task, so implementation skips it silently and the requirement never ships?",
    face: "numbered",
  },
  {
    id: "plan-decomposition",
    reviewKinds: ["plan"],
    lens: "decomposition",
    question:
      "Does the task granularity make a step impossible to verify on its own, so a defect crosses steps with nobody noticing?",
    face: "numbered",
  },
  {
    id: "plan-buildability",
    reviewKinds: ["plan"],
    lens: "buildability",
    question:
      "Is a step of the plan not executable against the tree as it stands — a missing prerequisite, a command that does not exist, an order no edge permits?",
    face: "numbered",
  },
  {
    id: "spec-completeness",
    reviewKinds: ["spec"],
    lens: "completeness",
    question:
      "Is a condition that must hold left unwritten, so the downstream author can only guess — and guessing wrong changes behaviour?",
    face: "numbered",
  },
  {
    id: "spec-consistency",
    reviewKinds: ["spec"],
    lens: "consistency",
    question:
      "Do two places state the same fact differently, so the downstream reader goes wrong whichever one is taken?",
    face: "numbered",
  },
  {
    id: "spec-clarity",
    reviewKinds: ["spec"],
    lens: "clarity",
    question:
      "Can a statement be read two reasonable ways, and do the two readings derive different implementations?",
    face: "numbered",
  },
  {
    id: "overall-scope",
    reviewKinds: ["overall"],
    lens: "scope",
    question:
      "Does the phase's scope descend to implementation detail, leaving the increment that phase delivers undecidable?",
    face: "numbered",
  },
  {
    id: "overall-inventory",
    reviewKinds: ["overall"],
    lens: "inventory",
    question: 'Does the registry disagree with the tree, so "delivered" stops being credible?',
    face: "numbered",
  },
  {
    id: "overall-dependency",
    reviewKinds: ["overall"],
    lens: "dependency",
    question:
      "Does a dependency edge disagree with the actual serial order, so the schedule collides?",
    face: "numbered",
  },
  {
    id: "overall-acceptance",
    reviewKinds: ["overall"],
    lens: "acceptance",
    question: "Is an acceptance cell undecidable when the phase closes?",
    face: "numbered",
  },
  {
    id: "overall-boundary",
    reviewKinds: ["overall"],
    lens: "boundary",
    question: "Is a non-goal drawn so loosely that it filters nothing?",
    face: "numbered",
  },
];

/**
 * The lens question registry — the lookup face (`of`, unregistered throws) and the
 * per-kind projection (`forReviewKind`, a shared row expanded once per declared kind).
 * Both preserve declaration order, and a blank question throws on projection rather
 * than rendering an empty list item.
 */
export class LensQuestionRegistry {
  readonly #rows: readonly LensQuestionRow[];

  constructor(rows: readonly LensQuestionRow[] = LENS_QUESTION_ROWS) {
    this.#rows = rows;
  }

  /** The declared rows, in declaration order — the structural test's row census. */
  get rows(): readonly LensQuestionRow[] {
    return this.#rows;
  }

  /** One cell by (review kind, lens) — an unregistered pair throws, so a review’s
   *  criteria line can never read a question that was never declared. */
  of(reviewKind: ReviewKind, lens: string): LensQuestionRow {
    const row = this.#rows.find(
      (candidate) => candidate.reviewKinds.includes(reviewKind) && candidate.lens === lens,
    );
    if (row === undefined) {
      throw new Error(`no lens question is registered for ${reviewKind} · ${lens}`);
    }
    return row;
  }

  /** One review kind's questions in rendering order — every row whose `reviewKinds`
   *  names the kind, in declaration order, a shared row expanded once per kind. A
   *  blank question throws: the list is prompt bytes, never an empty item. */
  forReviewKind(reviewKind: ReviewKind): readonly LensQuestionRow[] {
    const rows = this.#rows.filter((row) => row.reviewKinds.includes(reviewKind));
    for (const row of rows) {
      if (row.question.trim().length === 0) {
        throw new Error(`lens question "${row.id}" is blank — every row reaches the prompt`);
      }
    }
    return rows;
  }
}

/** The process-wide lens question registry — the one table the prompt plane reads. */
export const LENS_QUESTIONS = new LensQuestionRegistry();
