// packages/cdd-engine/src/docs/judging/criteria.ts
// The review criteria — the per-kind body a review prompt carries, the tier ladder it
// calibrates against, and the lens question table it answers in order.
//
// Three tables, one home, because a review prompt is ONE text: the tier rubric (what makes
// a finding a blocker or a warn), the per-kind criteria body (what that kind's review
// judges) and the lens questions (what the reviewer asks itself under each lens). The
// prompt plane folds this file's body into its `**Criteria — <type>:**` line; it never
// keeps a second copy of the prose, because a copied prompt is a prompt that drifts one
// kind at a time.
//
//   · The tier ladder is ROWS with three executable cells each — the boundary, the evidence
//     duty and the neighbouring tier's counterexample. `CriteriaTiers#render` assembles the
//     rubric from them in tier order, so the rubric is the table, never a prose copy of it.
//   · The criteria body is declared per KIND, not per target: the two spec-shaped targets
//     share the `spec` body, so a phase-spec review and a single-spec review differ in
//     their labelled target word and in nothing else.
//   · The lens questions are declared ONCE per question, with every kind that shares it on
//     the same row; `LensQuestions#forKind` expands them in declaration order.
//   · The downgrade mark is a DISPLAY token, not a rubric cell: the board's verb cell and
//     the capsule's summary line take its bytes from `regradeNote` here, so the mark and a
//     stated reason compose in one place — a render site never splices a second copy.
//
// Invariant: a kind's criteria text is a pure function of these tables — the body, the
// numbered lens list and the filled rubric compose in one place, so two spellings of one
// review's criteria cannot exist.

import type { TargetType } from "../identity/types.ts";

/** One grading tier, ascending by harm. */
export type CriteriaTier = "blocker" | "warn";

/** The tier order the rubric assembles in — the ladder a reviewer answers in order. */
export const TIER_ORDER = ["blocker", "warn"] as const satisfies readonly CriteriaTier[];

/** The extra execution surface a row is wired to: a `gate` row's id is the word its
 *  mechanical gate prints, a `numbered` row reaches the rendered rubric. The three prose
 *  cells reach the rubric for EVERY row regardless of face. */
export type CriteriaFace = "gate" | "numbered";

/** One grading criterion row — the unit the rubric is assembled from. */
export interface CriteriaRow {
  /** The row's stable identity: the `CDD_BLOCKED` gate prints it, tests name it. */
  readonly id: string;
  readonly tier: CriteriaTier;
  /** The tier's boundary: what makes a finding this tier. */
  readonly body: string;
  /** The evidence the reviewer owes a finding of this tier. */
  readonly duty: string;
  /** The neighbouring tier's edge, stated so a reviewer can match a finding to it. */
  readonly counterExample: string;
  readonly face: CriteriaFace;
}

/** The cell names, in assembly order — a blank cell's message names it. */
const CELLS = ["body", "duty", "counterExample"] as const;

/** The declared criteria table — every tier owes at least one row. */
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
      "A warn may leave `evidence` out — nobody adopts its conclusion on its word — so the absence is legal there, while the same absence on a blocker ships a decision nobody can check.",
    face: "gate",
  },
  {
    id: "debt-consequence",
    tier: "warn",
    body: "A finding is a warn when it leaves this round's functional result unchanged but makes the next person do the wrong thing: debt (a duplicated policy · a stale docstring · a missing coverage case), a misleading claim no consumer is hurt by, a gap nobody verifies, or dead code that tempts a later reader to believe it still runs.",
    duty: "A warn owes the consequence: not a failure today, but who will take which step wrongly, and when.",
    counterExample:
      "Dead code that nothing calls today and no output depends on is a warn: it changes what the next reader believes, which is the warn boundary itself.",
    face: "numbered",
  },
  {
    id: "expression-only",
    tier: "warn",
    body: "Pure expression — naming, line-wrapping, comment wording, ordering inside one file — is a `notes` line, not a finding: it changes neither behaviour nor anyone's judgment, and a finding that stays must name the judgment it changes.",
    duty: "A warn here owes two halves: the judgment it changes, and this tier's price — a fix round owed, and no re-grade of that round.",
    counterExample:
      "A naming inconsistency that stays self-consistent inside one file is a `notes` line, not a finding: no cross-surface reader is misled.",
    face: "numbered",
  },
  {
    id: "regrade-mark",
    tier: "warn",
    body: "A finding is downgraded without a regrade reason when the same defect returns one tier lower and the new round states no reason for the change: the reader can no longer tell a re-grade from a changed defect, while the round's own conclusion stays what it was.",
    duty: "The mark is a display fact: it rides the board's verb token after its `+N` count and the capsule summary line, never a finding row, never a carrier entry, and never the round's conclusion.",
    counterExample:
      "A downgrade whose previous round carried no scenario has no reference to hold it against, so the finding is read as a changed defect and carries no mark.",
    face: "numbered",
  },
];

/** The downgrade mark (the `regrade-mark` row's display line) — the token the board's verb
 *  cell and the capsule's summary line print when a finding returns one tier lower and its
 *  round states no reason. It is declared beside the criteria table because the mark has
 *  exactly one source (never a second copy at a render site), and it is deliberately NOT a
 *  rubric cell: a display token has no place in the tier prose a grader calibrates against. */
export const REGRADE_MARK = "downgraded without a regrade reason";

/** The separator between two downgrade notes on ONE face — the mark and a stated reason are
 *  two sentences, never one spliced phrase. */
export const REGRADE_NOTE_SEPARATOR = "; ";

/** The board's ` · ` cell shape — a reason carrying it would read as two cells on the ONE
 *  token the board pins as one row. */
const BOARD_CELL_SHAPE = / *· */g;

/** Whitespace runs and control characters — a reason carrying a line break would split the
 *  capsule's one line and the board's one token into two. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the control-character range IS the rule here — a display token may not carry a line break or a raw C0 byte.
const DISPLAY_BREAKS = /[\s\u0000-\u001f\u007f]+/g;

/** One stated reason folded to its display form: the author's bytes stay on the carrier, only
 *  the printed wording is collapsed so neither face can split on it. Exported so the board's
 *  note token and the downgrade note share ONE fold — a second copy at a render site is exactly
 *  the duplicate this module's header forbids. */
export const displayReason = (reason: string): string =>
  reason.replace(BOARD_CELL_SHAPE, "; ").replace(DISPLAY_BREAKS, " ").trim();

/** The downgrade note's ONE composition — both display faces (the board's verb cell and the
 *  capsule's summary line) take their bytes from here, so the mark and the stated reason cannot
 *  drift apart: a row that owes its reason prints the mark, a row that states one prints the
 *  reason, and a round with neither prints nothing at all (`undefined` = zero bytes on both
 *  faces). A stated reason is folded first, so a line break or the board's own ` · ` never
 *  splits the one line / one token it rides. */
export const regradeNote = (owing: number, reasons: readonly string[]): string | undefined => {
  const stated = reasons.map(displayReason).filter((reason) => reason.length > 0);
  const parts = [...(owing > 0 ? [REGRADE_MARK] : []), ...stated];
  return parts.length === 0 ? undefined : parts.join(REGRADE_NOTE_SEPARATOR);
};

/** The tier ladder's assembly face — the rubric is the TABLE's rendering, never a prose
 *  copy beside it. */
// biome-ignore lint/complexity/noStaticOnlyClass: one table and one rendering; the zero-bare-function discipline admits no standalone assembler.
export class CriteriaTiers {
  /** The tier body the rubric is assembled from: each row contributes `body` → `duty` →
   *  `counterExample`, one space apart; same-tier rows keep declaration order, and the
   *  tiers run in `TIER_ORDER`. A blank cell, an empty tier or a row off the ladder throws —
   *  no tier fragment ever renders short of a sentence and no row vanishes silently. */
  static render(rows: readonly CriteriaRow[] = CRITERIA_ROWS): string {
    for (const row of rows) {
      if (!TIER_ORDER.includes(row.tier)) {
        throw new Error(
          `criteria row "${row.id}" declares the tier "${row.tier}", which sits outside the ladder`,
        );
      }
    }
    const tiers: string[] = [];
    for (const tier of TIER_ORDER) {
      const tierRows = rows.filter((row) => row.tier === tier);
      if (tierRows.length === 0) {
        throw new Error(`the criteria table declares no "${tier}" row — every tier owes one`);
      }
      tiers.push(
        tierRows
          .map((row) => CriteriaTiers.#fragmentOf(row))
          .join(" ")
          .trim(),
      );
    }
    return tiers.join(" ");
  }

  /** One row by id — an unregistered id throws, so a gate or a test that names a criterion
   *  can never quietly read nothing. */
  static of(id: string, rows: readonly CriteriaRow[] = CRITERIA_ROWS): CriteriaRow {
    const row = rows.find((candidate) => candidate.id === id);
    if (row === undefined) throw new Error(`no grading criterion is registered under "${id}"`);
    return row;
  }

  /** One row's rubric fragment — its three cells, each trimmed, each required. */
  static #fragmentOf(row: CriteriaRow): string {
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

/** The rubric's opening calibration line — a stance, not criteria prose. */
export const RUBRIC_PREAMBLE = "Calibrate findings by real severity — not everything is a blocker.";

/** The calibration tail — the same-grade duty, the silence-is-not-permission sentence with
 *  its two slots, the set-aside ledger and the closing acknowledgement. It rides the ONE
 *  rubric fragment, never a per-kind copy. */
export const CALIBRATION_TAIL =
  "Within one run, a defect already graded in the same class keeps that grade; crossing grades names its reason in the finding. The reviewed {artifact} is a vision, not an exhaustive enumeration — behavior it is silent on is judged by what a reasonable {audience} would expect; its silence is not permission, and a finding's severity grades that expectation, not whether the text mentions the trigger. Before your verdict, list every behavior you considered and set aside as outside the reviewed scope — one line each with the reason; nothing set aside is dropped silently; an empty list means you set nothing aside. Report every axis separately — never merge several axes into one 'most severe' finding: a cross-axis ranking hides which axis the finding actually speaks for. Acknowledge what was done well before listing findings (accurate praise earns the rest of the report trust).";

/** The two slots the calibration tail carries. */
export const RUBRIC_SLOTS = { artifact: "{artifact}", audience: "{audience}" } as const;

/** The severity rubric — the ONE calibration fragment every criteria body shares. Its tier
 *  body is ASSEMBLED from the criteria table (each row's `body` → `duty` →
 *  `counterExample`, tiers in order), so the table is the only corpus of tier prose. */
export const SEVERITY_RUBRIC = `${RUBRIC_PREAMBLE} ${CriteriaTiers.render()} ${CALIBRATION_TAIL}`;

/** The reviewed kinds the criteria bodies key on — four targets select the body of their own
 *  name, and the two spec-shaped targets share `spec`. */
export type ReviewKind = "wave" | "branch" | "plan" | "overall" | "spec";

/** The declared kinds, in the order a refusal names them. */
export const REVIEW_KINDS = [
  "wave",
  "branch",
  "spec",
  "plan",
  "overall",
] as const satisfies readonly ReviewKind[];

/** The ONE target → body-kind map: the two spec-shaped document targets share the `spec`
 *  body, so a target cannot silently drift onto another target's criteria. */
export const reviewKindOf = (type: TargetType): ReviewKind =>
  type === "phase-spec" || type === "single-spec" ? "spec" : type;

export const REVIEW_BODY_TEXT: Readonly<
  Record<ReviewKind, { readonly artifact: string; readonly audience: string }>
> = {
  wave: { artifact: "artifact", audience: "user" },
  branch: { artifact: "artifact", audience: "user" },
  spec: { artifact: "spec", audience: "downstream author" },
  plan: { artifact: "plan", audience: "implementer" },
  overall: { artifact: "charter", audience: "phase author" },
};

/** The filled severity rubric of one criteria body — the shared fragment with that body's
 *  two slot values substituted. */
export const reviewGuideOf = (kind: ReviewKind): string => {
  const text = REVIEW_BODY_TEXT[kind];
  return SEVERITY_RUBRIC.replaceAll(RUBRIC_SLOTS.artifact, text.artifact).replaceAll(
    RUBRIC_SLOTS.audience,
    text.audience,
  );
};

export const CLOSED_WAVE_DISCIPLINE =
  "Closed waves are history: a finding on the content face of an already-closed task block is answered by amending the document to align with the delivered split — never by carrying work into or out of a closed task, and a finding that would rewrite the historical split is not raised.";

const docNarrativeAxes = (guide: string): string =>
  `Follow URC: single-cycle, lens-tagged findings (completeness/consistency/clarity) + the writing-plans self-check + verification evidence — the reviewer runs the repository's typecheck and test commands and self-reports the dual evidence + Claimed→pin: every behavior claim (usage-line attribution · semantic contract · byte face) must cite a colocated pin by module path + symbol name — a line number is not a pin; a count carries no mechanical face — no census registry exists and no gate compares the value; a bare integer plus a count unit in prose is the writing convention, not a refusal — while an arithmetic over live counts still is; naming the guard that maintains the value is the reason for the reference, not its form; a present-tense description of the tree as it stands is refused in a spec and in a plan alike — what belongs to the plan is the work item (\`- Modify: <path>\`), never a prose \`path:line\`, while the condition that must hold belongs to the spec; restate such a description as that condition — and in a design spec a measurement input is a lens-tagged finding unless it is restated as a condition that must hold — the review checks every claim against its pin, claim by claim; a pinless claim is a lens-tagged finding + program conformance (phase-spec only — a single-spec carries no \`program:\` and no \`INPUT_OVERALL\`, and is not a phase) — judge the phase against its parent overall at \`INPUT_OVERALL\` (the charter its \`program:\` names): the phase must sit inside the scope the overall's Phase inventory registered for it, and a phase that reaches beyond it is a completeness finding. ${CLOSED_WAVE_DISCIPLINE} ${guide}`;

const docCharterAxes = (guide: string): string =>
  `Follow URC: single-cycle, lens-tagged findings (scope/inventory/dependency/acceptance/boundary) — judge the charter as a program charter, on six criteria and nothing it does not own. (1) Scope is a program increment — every phase's Scope names what the PROGRAM gains there (a capability, a boundary, a contract), never implementation detail such as a file list or a step-by-step walkthrough; a scope that descends to code is a scope finding. (2) Inventory, graph and order agree — every Phase inventory row has a Dependency graph node and every node a row, each edge is marked hard or soft and matches the row's Dependency cell, and the documented execution order is one the edges allow: a soft edge that hides a serial dependency, or an order no edge set permits, is a dependency finding. (3) Acceptance cells are phase-judgeable — each row's acceptance names an outcome a reviewer can decide when that phase closes, never a placeholder (TBD, a restated goal, a criterion only the program's end can settle); an undecidable cell is an acceptance finding. (4) Non-goals fence the program — every registered phase sits inside the boundary the Non-goals draw, and a non-goal drawn so loosely that it excludes nothing is a boundary finding. (5) The change record is a decision record — each entry states what was decided and why (its decision id where the program keeps one), never a work log of rounds and dispatches; a diary entry is an inventory finding. (6) Ledger and reality agree — a phase the tree shows closed is marked Done, a phase still in flight is not, and work no registered phase carries never appears as a delivered increment; a drift between the inventory and the tree is an inventory finding. ${guide}`;

/** One lens question row — the `(review kind, lens)` cells it answers. `reviewKinds` is
 *  multi-valued exactly where kinds share one question: the wave / branch four carry both,
 *  so their text is stored once and expanded per kind. */
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

/** The declared lens question table — wave / branch lead (shared text, one copy), then
 *  plan, spec and the charter's five. */
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
      "Does the change depart from the reviewed contract (the wave brief / plan / design spec) while the behaviour a consumer receives changes with it — and does a requirement look implemented while the implementation looks wrong: are the places that claim to implement it actually right?",
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
      "Do two places state the same fact differently, so the downstream reader goes wrong whichever one is taken — and when a document gives a reading (a count, a list, an enumeration), which items does it count, and are those items still on the tree?",
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

/** The lens question registry — the lookup and the per-kind projection, both in declaration
 *  order. */
export class LensQuestions {
  readonly #rows: readonly LensQuestionRow[];

  constructor(rows: readonly LensQuestionRow[] = LENS_QUESTION_ROWS) {
    this.#rows = rows;
  }

  /** The declared rows, in declaration order. */
  get rows(): readonly LensQuestionRow[] {
    return this.#rows;
  }

  /** One cell by (kind, lens) — an unregistered pair throws. */
  of(kind: ReviewKind, lens: string): LensQuestionRow {
    const row = this.#rows.find(
      (candidate) => candidate.reviewKinds.includes(kind) && candidate.lens === lens,
    );
    if (row === undefined) throw new Error(`no lens question is registered for ${kind} · ${lens}`);
    return row;
  }

  /** One kind's questions, in declaration order — a shared row expands once per kind. A
   *  blank question throws: the list is prompt bytes, never an empty item. */
  forKind(kind: ReviewKind): readonly LensQuestionRow[] {
    const rows = this.#rows.filter((row) => row.reviewKinds.includes(kind));
    for (const row of rows) {
      if (row.question.trim().length === 0) {
        throw new Error(`lens question "${row.id}" is blank — every row reaches the prompt`);
      }
    }
    return rows;
  }

  /** One kind's numbered list — `1. …` lines, the projection the prompt appends. */
  blockOf(kind: ReviewKind): string {
    return this.forKind(kind)
      .map((row, index) => `${index + 1}. ${row.question}`)
      .join("\n");
  }
}

/** The process-wide lens question table — the ONE table the prompt plane reads. */
export const LENS_QUESTIONS = new LensQuestions();

/** The declared per-kind bodies — the prefix of each kind's criteria text. The wave,
 *  branch and plan rows are literal guides (the rubric and the lens list are folded in by
 *  their own declarations); the spec and charter bodies are composed from the two document
 *  silhouettes. */
export const CRITERIA_BODIES: Readonly<Record<ReviewKind, string>> = {
  wave: `Standards axis (repo coding standards + code-review smell baseline) + Spec axis (wave brief / plan requirements) + Buildability axis (the reviewer explicitly runs the repository's typecheck command — \`tsc --noEmit\`, or the repo equivalent — AND its test command; every buildability finding self-reports the dual evidence, both commands ran) + Scope axis (changed-surface reasonableness): run \`git diff origin/<BASE_BRANCH>..HEAD\` yourself (BASE_BRANCH as named in the round context; on a missing artifact judge the working tree) — every changed file must fall within the wave brief's file surface (\`**Files:**\` seams) or be attributable to the plan / reviewed intent; an unattributable changed file is a candidate finding. The reviewer is the changed-surface judge — the engine reconciles nothing. ${reviewGuideOf("wave")}`,
  branch: `Same four axes as the wave review (branch-wide health: run \`git diff origin/<BASE_BRANCH>..HEAD\` + plan conformance) + Buildability axis (the reviewer explicitly runs the repository's typecheck command — \`tsc --noEmit\`, or the repo equivalent — AND its test command; every buildability finding self-reports the dual evidence, both commands ran) + Scope axis (changed-surface reasonableness): branch review IS the full diff — every changed file must be attributable to a finding, a plan requirement, or the reviewed intent; unrelated surface = candidate finding, normal finding → fix loop. ${reviewGuideOf("branch")} Three things a green run cannot show you: design — does the changed structure fit this codebase and is it the simplest structure that solves the plan's problem (over-engineering is a finding, not a preference); test adequacy — would these tests fail if the code broke (a run that cannot go red is not evidence); migration — does every breaking change name the path a not-yet-migrated consumer takes.`,
  plan: `Follow URC: single-cycle, lens-tagged findings (completeness/decomposition/buildability) + spec conformance — the plan is judged against its design spec at \`INPUT_SPEC\` (the plan's \`spec\` front-matter target): every spec requirement must map to a task, and a spec requirement with no owning task is a completeness finding + the writing-plans self-check + verification evidence — the reviewer runs the repository's typecheck and test commands and self-reports the dual evidence + Claimed→pin: every behavior claim (usage-line attribution · semantic contract · byte face) must cite a colocated pin (path:line + the assertion face) — the review checks every claim against its pin, claim by claim; a pinless claim is a lens-tagged finding. ${CLOSED_WAVE_DISCIPLINE} ${reviewGuideOf("plan")}`,
  spec: `${docNarrativeAxes(reviewGuideOf("spec"))}`,
  overall: `${docCharterAxes(reviewGuideOf("overall"))}`,
};

/** The criteria registry — one kind's body, and the composed text the prompt carries. */
export class ReviewCriteria {
  readonly #bodies: Readonly<Record<ReviewKind, string>>;
  readonly #lens: LensQuestions;

  constructor(opts: { bodies?: Readonly<Record<ReviewKind, string>>; lens?: LensQuestions } = {}) {
    this.#bodies = opts.bodies ?? CRITERIA_BODIES;
    this.#lens = opts.lens ?? LENS_QUESTIONS;
  }

  /** One kind's lens questions, in declaration order — the projection a caller renders as
   *  a list itself (the prompt takes `textOf` instead). */
  lensQuestionsOf(kind: ReviewKind): readonly LensQuestionRow[] {
    return this.#lens.forKind(kind);
  }

  /** One kind's bare criteria body (no lens list) — the declared prefix. */
  bodyOf(kind: ReviewKind): string {
    return this.#bodies[kind];
  }

  /** One kind's FULL criteria text: the body, then the numbered lens list — the bytes the
   *  prompt folds into its `**Criteria — <type>:**` line. A blank body throws. */
  textOf(kind: ReviewKind): string {
    const body = this.bodyOf(kind);
    if (body.trim().length === 0) throw new Error(`the ${kind} criteria body is blank`);
    return `${body}\n\n${this.#lens.blockOf(kind)}`;
  }
}

/** The process-wide criteria registry — the ONE table every consumer reads. */
export const CRITERIA = new ReviewCriteria();
