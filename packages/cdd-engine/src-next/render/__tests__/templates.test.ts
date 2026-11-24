// packages/cdd-engine/src-next/render/__tests__/templates.test.ts
// P22 T1 — the severity rubric as ONE shared fragment: the four-question /
// three-tier calibration body (the review axes guides' common tail) lives in
// `SEVERITY_RUBRIC` with two slots, and every `REVIEWS.<key>.axesGuide` embeds the
// FILLED fragment exactly once. The source-face pin guards the retired copies: the
// vision sentence's opening token appears once in the module bytes.
//
// P22 T15 — a charter's own criteria body and the criteria-body selection: the
// `overall` target is judged on six charter criteria and carries none of the
// implementation-face evidence duty, the two spec-shaped document targets share the
// ONE narrative body, and `reviewBodyOf` is the single target → criteria map.
//
// P28 T3 — the volatile-facts discipline: the narrative body names the claim shapes a
// spec may pin (a symbol, a count, a condition) instead of accepting
// the tree as it stands, while the plan variant stays byte-frozen. The plan bytes keep
// the PIN form — a colocated pin's `path:line` is what the read-back resolves — while a
// plan's PROSE may carry none: `line-coordinate` declares `docKeys: "all"` and a plan's
// `#### Steps` is a decision face, so a prose coordinate is refused there exactly as it
// is in a spec.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CRITERIA,
  LENS_QUESTION_ROWS,
  LENS_QUESTIONS,
  LensQuestionRegistry,
  type ReviewKind,
} from "../../contract/review-criteria.ts";
import type { TargetType } from "../../session/faces.ts";
import {
  CLOSED_WAVE_DISCIPLINE,
  type ContextLine,
  type ModePromptRow,
  REVIEWS,
  type ReviewKey,
  reviewBodyOf,
  reviewGuideOf,
  SEVERITY_RUBRIC,
  SEVERITY_RUBRIC_SLOTS,
  TEMPLATE_PROMPT,
  TemplateAssembler,
} from "../templates.ts";

/** The criteria keys — the five distinct bodies one target type selects among. */
const CRITERIA_KEYS: readonly ReviewKey[] = ["wave", "branch", "plan", "spec", "overall"];

/** The target types — the CLI `--type` vocabulary the selection maps from. */
const TARGET_TYPES: readonly TargetType[] = [
  "wave",
  "branch",
  "phase-spec",
  "overall",
  "plan",
  "single-spec",
];

describe("SEVERITY_RUBRIC — the one shared calibration fragment", () => {
  it("assembles its tier body from the criteria registry — every row's three cells, no second prose copy", () => {
    // The registry IS the rubric's tier corpus (design spec §6.1): the fragment opens
    // with the calibration stance, then carries the assembled assembly verbatim.
    expect(SEVERITY_RUBRIC.startsWith("Calibrate findings by real severity")).toBe(true);
    expect(SEVERITY_RUBRIC.split(CRITERIA.renderRubric()).length).toBe(2);
    for (const row of CRITERIA.rows) {
      for (const cell of [row.body, row.duty, row.counterExample]) {
        expect(SEVERITY_RUBRIC, `${row.id} cell`).toContain(cell);
      }
    }
  });

  it("keeps the four blocker instances and the warn / nit anchors in the assembled bytes", () => {
    for (const anchor of [
      "declared acceptance gate",
      "a legal input escapes",
      "can never go red",
      "security or privacy",
    ]) {
      expect(SEVERITY_RUBRIC).toContain(anchor);
    }
    for (const anchor of ["duplicated policy", "stale docstring", "missing coverage case"]) {
      expect(SEVERITY_RUBRIC).toContain(anchor);
    }
    expect(SEVERITY_RUBRIC).toContain("line-wrapping");
  });

  it("carries the vision sentence, the set-aside ledger and the two slots", () => {
    expect(SEVERITY_RUBRIC).toContain("The reviewed {artifact} is a vision");
    expect(SEVERITY_RUBRIC).toContain("set aside");
    expect(SEVERITY_RUBRIC).toContain(SEVERITY_RUBRIC_SLOTS.artifact);
    expect(SEVERITY_RUBRIC).toContain(SEVERITY_RUBRIC_SLOTS.audience);
    expect(SEVERITY_RUBRIC_SLOTS).toEqual({ artifact: "{artifact}", audience: "{audience}" });
    // the same-grade consistency sentence sits before the closing acknowledgement
    expect(SEVERITY_RUBRIC.indexOf("keeps that grade")).toBeGreaterThan(-1);
    expect(SEVERITY_RUBRIC.indexOf("keeps that grade")).toBeLessThan(
      SEVERITY_RUBRIC.indexOf("Acknowledge what was done well"),
    );
  });

  it("embeds the filled fragment exactly once in every axes guide", () => {
    for (const key of CRITERIA_KEYS) {
      expect(REVIEWS[key].axesGuide.split(reviewGuideOf(key)).length).toBe(2);
    }
  });

  it("keeps the fragment's source token in the module bytes once — zero copies", () => {
    const source = readFileSync(fileURLToPath(new URL("../templates.ts", import.meta.url)), "utf8");
    expect(source.split("The reviewed").length).toBe(2);
  });
});

describe("P22 T15 — the charter criteria (REVIEWS.overall) and the criteria-body selection", () => {
  /** The six charter anchors — one distinctive phrase per judged criterion. */
  const CHARTER_ANCHORS = [
    "program increment",
    "hard or soft",
    "phase-judgeable",
    "fence the program",
    "decision record",
    "Ledger and reality agree",
  ] as const;

  it("judges a charter on its own five lenses and its six criteria", () => {
    expect(REVIEWS.overall.lensEnum).toEqual([
      "scope",
      "inventory",
      "dependency",
      "acceptance",
      "boundary",
    ]);
    for (const anchor of CHARTER_ANCHORS) {
      expect(REVIEWS.overall.axesGuide).toContain(anchor);
    }
  });

  it("carries zero implementation-face evidence duty — no typecheck, no test command, no claim pin", () => {
    // A charter never owns the implementation face, so the evidence duty the
    // narrative body carries has no business on this row.
    for (const forbidden of ["typecheck", "test command", "Claimed→pin", "path:line"]) {
      expect(REVIEWS.overall.axesGuide).not.toContain(forbidden);
    }
  });

  it("keeps the narrative body for the spec-shaped documents — the contrast pin", () => {
    for (const anchor of ["typecheck", "test command", "Claimed→pin"]) {
      expect(REVIEWS.spec.axesGuide).toContain(anchor);
    }
  });

  it("selects each target's criteria body — four same-named, the two spec shapes shared", () => {
    expect(reviewBodyOf("wave")).toBe("wave");
    expect(reviewBodyOf("branch")).toBe("branch");
    expect(reviewBodyOf("plan")).toBe("plan");
    expect(reviewBodyOf("overall")).toBe("overall");
    expect(reviewBodyOf("phase-spec")).toBe("spec");
    expect(reviewBodyOf("single-spec")).toBe("spec");
  });

  it("folds the SELECTED body into every review row's criteria line", () => {
    for (const type of TARGET_TYPES) {
      const line = `**Criteria — ${type}:** ${REVIEWS[reviewBodyOf(type)].axesGuide}`;
      expect(TEMPLATE_PROMPT.reviews[type].shell.join("\n")).toContain(line);
    }
  });
});

/**
 * The claim shapes the narrative body names — one stable substring each, so a
 * rewording that keeps the shape stays green while dropping a shape goes red. A whole
 * byte pin is deliberately absent: punctuation must not be the thing that breaks.
 */
const VOLATILE_FACT_ANCHORS = [
  "module path + symbol name",
  "no census registry exists",
  "belongs to the plan",
] as const;

/** The shape rule rows the two authoring nodes name in their `- **` bullets. The
 *  rubric states the same shapes as ONE prose axis and names none of them, so this is the
 *  reverse read of the node face: a batch that copies a node's block into
 *  `docNarrativeAxes` would give the same sentence a second form, which reddens here. */
const SHAPE_RULE_IDS = ["line-coordinate", "live-arithmetic"] as const;

/** The plan variant's byte-frozen prefix — the volatile-facts rewrite lands on the
 *  spec variant only: the frozen bytes keep the pin form (`path:line` inside a colocated
 *  pin, which is what the read-back resolves), and a plan's PROSE coordinate is refused
 *  by the plan face's own decision-face rule instead of by this rubric's bytes. */
const PLAN_GUIDE_PREFIX =
  "Follow URC: single-cycle, lens-tagged findings (completeness/decomposition/buildability) + spec conformance — the plan is judged against its design spec at `INPUT_SPEC` (the plan's `spec` front-matter target): every spec requirement must map to a task, and a spec requirement with no owning task is a completeness finding + the writing-plans self-check + verification evidence — the reviewer runs the repository's typecheck and test commands and self-reports the dual evidence + Claimed→pin: every behavior claim (usage-line attribution · semantic contract · byte face) must cite a colocated pin (path:line + the assertion face) — the review checks every claim against its pin, claim by claim; a pinless claim is a lens-tagged finding. ";

describe("P28 T3 — the narrative body names the claim shapes, not today's shape", () => {
  it("carries one stable substring per claim shape", () => {
    for (const anchor of VOLATILE_FACT_ANCHORS) {
      expect(REVIEWS.spec.axesGuide).toContain(anchor);
    }
  });

  it("keeps every other narrative anchor — the older pins never re-anchor", () => {
    for (const anchor of ["typecheck", "test command", "Claimed→pin"]) {
      expect(REVIEWS.spec.axesGuide).toContain(anchor);
    }
  });

  it("keeps the rubric a prose axis — no bullet line, none of the shape rule ids", () => {
    // The three homes must not drift into two FORMS of one sentence: the nodes teach the
    // shapes as bullets that name their rule rows, the rubric states them as prose and
    // names none. Pre-seeding a copied node block here reddens the first half.
    expect(REVIEWS.spec.axesGuide).not.toMatch(/^\s*- \*\*/m);
    for (const id of SHAPE_RULE_IDS) expect(REVIEWS.spec.axesGuide, id).not.toContain(id);
  });

  it("keeps the plan variant byte-frozen — the rewrite is the spec variant's only", () => {
    // The closed-wave discipline (P30 §2.7) is the ONE body both document variants
    // select, so it rides between the frozen prefix and the shared rubric.
    expect(REVIEWS.plan.axesGuide).toBe(
      `${PLAN_GUIDE_PREFIX}${CLOSED_WAVE_DISCIPLINE} ${reviewGuideOf("plan")}\n\n${questionsOf("plan")}`,
    );
  });
});

/**
 * The closed-wave discipline's two stable anchors (P30 §2.7) — a finding on the
 * content face of an already-closed task block is answered by the DOCUMENT, never by
 * moving the work. One substring per clause: a rewording that keeps the duty stays
 * green, dropping the duty goes red.
 */
const CLOSED_WAVE_ANCHORS = [
  "align with the delivered split",
  "never by carrying work into or out of a closed task",
] as const;

/** The three document targets the discipline governs — the plan variant and the two
 *  spec shapes (they share the ONE narrative body). */
const DOCUMENT_TARGETS: readonly TargetType[] = ["plan", "phase-spec", "single-spec"];

describe("P30 T6 — the closed-wave discipline rides the document review axes", () => {
  it("names the closed-wave duty in the plan variant and in both spec-shaped variants", () => {
    for (const type of DOCUMENT_TARGETS) {
      const guide = REVIEWS[reviewBodyOf(type)].axesGuide;
      for (const anchor of CLOSED_WAVE_ANCHORS) expect(guide).toContain(anchor);
    }
  });

  it("carries the discipline in the rendered review prompt, not only the registry", () => {
    for (const type of DOCUMENT_TARGETS) {
      const shell = TEMPLATE_PROMPT.reviews[type].shell.join("\n");
      for (const anchor of CLOSED_WAVE_ANCHORS) expect(shell).toContain(anchor);
    }
  });

  it("stays out of the wave / branch / charter bodies — the discipline belongs to the documents", () => {
    for (const type of ["wave", "branch", "overall"] as const) {
      const guide = REVIEWS[reviewBodyOf(type)].axesGuide;
      for (const anchor of CLOSED_WAVE_ANCHORS) expect(guide).not.toContain(anchor);
    }
  });
});

/**
 * P31 T1 — the docs-fix row's escaped-pipe discipline: a Change-history summary cell
 * carrying a literal vertical bar must write `\|`, because a bare `|` splits the cell
 * and the row stops matching the declared four-column header. One substring pin — a
 * rewording that keeps the duty stays green, dropping the duty goes red.
 */
describe("P31 T1 — the docs-fix row names the escaped-pipe duty", () => {
  it("carries the `\\|` sentence in the docs-fix fixed prefix", () => {
    const shell = TEMPLATE_PROMPT.modes["docs-fix"].shell.join("\n");
    expect(shell).toContain("carries `\\|`");
    expect(shell).toContain("splits the cell in two");
  });
});

/**
 * P37 T2 — the lens questions reach the review prompt bytes (design spec §3.2 · §6.1 ·
 * §6.2). The table's own census lives in `contract/__tests__/review-criteria.test.ts`;
 * this face pins the PROJECTION: each kind's axes guide ends with its numbered list,
 * every question appears verbatim in that kind's `**Criteria —` line, the two judgment
 * escapes are gone, and the wave / branch lens enums name the `scope` axis their guide
 * already judged.
 */
const REVIEW_KIND_KEYS: readonly ReviewKind[] = ["wave", "branch", "plan", "spec", "overall"];

/** The numbered list one kind's axes guide must end with — the rendered projection. */
const questionsOf = (kind: ReviewKind): string =>
  LENS_QUESTIONS.forReviewKind(kind)
    .map((row, index) => `${index + 1}. ${row.question}`)
    .join("\n");

const numberedLinesOf = (guide: string): readonly string[] =>
  guide.split("\n").filter((line) => /^\d+\. /.test(line));

describe("P37 T2 — the lens questions ride the review prompt bytes", () => {
  it("ends every kind's axes guide with its own numbered list — 4 · 4 · 3 · 3 · 5", () => {
    for (const kind of REVIEW_KIND_KEYS) {
      const guide = REVIEWS[kind].axesGuide;
      expect(guide.endsWith(questionsOf(kind)), `${kind} list`).toBe(true);
      expect(numberedLinesOf(guide), `${kind} count`).toHaveLength(
        LENS_QUESTIONS.forReviewKind(kind).length,
      );
    }
  });

  it("folds every question verbatim into that kind's `**Criteria —` line", () => {
    for (const type of TARGET_TYPES) {
      const kind = reviewBodyOf(type);
      const shell = TEMPLATE_PROMPT.reviews[type].shell.join("\n");
      const line = `**Criteria — ${type}:** ${REVIEWS[kind].axesGuide}`;
      expect(shell).toContain(line);
      for (const row of LENS_QUESTIONS.forReviewKind(kind)) {
        expect(line, `${type} · ${row.id}`).toContain(row.question);
      }
    }
  });

  it("shares the wave / branch questions byte-for-byte — the projection, not a copy", () => {
    expect(numberedLinesOf(REVIEWS.branch.axesGuide)).toEqual(
      numberedLinesOf(REVIEWS.wave.axesGuide),
    );
  });

  it("carries zero `(severity by your judgment)` escape", () => {
    for (const kind of REVIEW_KIND_KEYS) {
      expect(REVIEWS[kind].axesGuide, kind).not.toContain("(severity by your judgment)");
    }
    const source = readFileSync(fileURLToPath(new URL("../templates.ts", import.meta.url)), "utf8");
    expect(source).not.toContain("severity by your judgment");
  });

  it("names `scope` in the wave / branch lens enums — every axis has its enum value", () => {
    for (const kind of ["wave", "branch"] as const) {
      expect(REVIEWS[kind].lensEnum).toContain("scope");
    }
    for (const kind of REVIEW_KIND_KEYS) {
      expect([...REVIEWS[kind].lensEnum].sort(), `${kind} enum`).toEqual(
        LENS_QUESTIONS.forReviewKind(kind)
          .map((row) => row.lens)
          .sort(),
      );
    }
  });

  it("drops the numbered line the table drops — a deleted row shortens the projection", () => {
    // The question list is a projection: one row removed leaves one fewer numbered line
    // for that kind, so a hand-written list could not fake the pin.
    const missingScope = new LensQuestionRegistry(
      LENS_QUESTION_ROWS.filter((row) => row.id !== "scope-lens"),
    );
    const projected = missingScope
      .forReviewKind("wave")
      .map((row, index) => `${index + 1}. ${row.question}`)
      .join("\n");
    expect(projected.split("\n")).toHaveLength(3);
    expect(projected).not.toContain(LENS_QUESTIONS.of("wave", "scope").question);
    expect(numberedLinesOf(REVIEWS.wave.axesGuide)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// P38 T4 — the dispatch OUTPUT plane's ONE sentence, and the `none` half-sentence
// (design spec §3.3 · §5.1). Four shell texts carry the scratch discipline — one
// per rendered face, not one per mode: the review face folds the same bytes in
// through its shared instruction item, so all six review rows carry them too.
// ---------------------------------------------------------------------------

/** The scratch discipline's exact bytes (spec §5.1) — one sentence, four homes. */
const SCRATCH_SENTENCE =
  "Anything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.";

/** The `none` half-sentence (spec §3.3) — the two fix shells' reading instruction. */
const NONE_HALF =
  "`INPUT_RULINGS` is a path, or the literal `none` when this round has no ruling sidecar.";

/** A complete value frame — every declared token present (the gate refuses a missing
 *  one, never an empty one). */
const frameOf = (role: string, type: string): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const token of TEMPLATE_PROMPT.tokens) values[token.name] = `<${token.name}>`;
  return { ...values, ROLE: role, TARGET_TYPE: type };
};

describe("P38 T4 — the `scratch/<round-id>/` discipline in all four shell texts (§5.1)", () => {
  it("carries the sentence in the implement, fix and docs-fix shells", () => {
    const assembler = new TemplateAssembler();
    for (const [role, type] of [
      ["implement", ""],
      ["fix", "wave"],
      ["docs-fix", "plan"],
    ] as const) {
      const out = assembler.render(frameOf(role, type));
      expect(out, role).toContain(SCRATCH_SENTENCE);
      // the two conditions the pin must not collapse into one word
      expect(out, role).toContain("scratch/<round-id>/");
      expect(out, role).toContain("`OUTPUT_HANDOFF`");
    }
  });

  it("carries the same sentence on every review row's fixed prefix", () => {
    const assembler = new TemplateAssembler();
    for (const type of TARGET_TYPES) {
      expect(assembler.render(frameOf("review", type)), type).toContain(SCRATCH_SENTENCE);
    }
  });

  it("puts the sentence ABOVE `## Round context` — the discipline is instruction, the paths are facts", () => {
    const out = new TemplateAssembler().render(frameOf("implement", ""));
    expect(out.indexOf(SCRATCH_SENTENCE)).toBeLessThan(out.lastIndexOf("## Round context"));
  });
});

describe("P38 T4 — the `none` half-sentence belongs to the two fix shells only (§3.3)", () => {
  it("states the literal `none` in the fix and docs-fix reading instruction", () => {
    const assembler = new TemplateAssembler();
    expect(assembler.render(frameOf("fix", "branch"))).toContain(NONE_HALF);
    expect(assembler.render(frameOf("docs-fix", "phase-spec"))).toContain(NONE_HALF);
  });

  it("keeps the half-sentence out of the implement and review shells", () => {
    const assembler = new TemplateAssembler();
    // neither face carries an `INPUT_RULINGS` cell, so naming `none` there would
    // describe a word the round context can never show
    expect(assembler.render(frameOf("implement", ""))).not.toContain(NONE_HALF);
    for (const type of TARGET_TYPES) {
      expect(assembler.render(frameOf("review", type)), type).not.toContain(NONE_HALF);
    }
  });
});

// ---------------------------------------------------------------------------
// P40 T1 — the brief cell is the ENGINE's own artifact (design spec §1: `written:
// "engine"`). The cell's name is its whole answer: the file is rendered by the engine
// before the child reads it, so no path takes an existence read. The declaration face
// says so once, and the construction-time criterion judges the SLOT (one judgment per
// slot across every row), not the line that happens to carry it.
// ---------------------------------------------------------------------------

/** Every row the assembler can render — the three work rows plus the six review rows. */
const ROWS: readonly ModePromptRow[] = [
  TEMPLATE_PROMPT.modes.implement,
  TEMPLATE_PROMPT.modes.fix,
  TEMPLATE_PROMPT.modes["docs-fix"],
  ...Object.values(TEMPLATE_PROMPT.reviews),
];

/** The brief declaration a row carries — the one cell `NAMED_BRIEF_CELL` owns. */
const briefOf = (row: ModePromptRow): ContextLine | undefined =>
  row.roundContext.find(
    (decl) => TemplateAssembler.slotOf(decl.line) === TemplateAssembler.NAMED_BRIEF_CELL,
  );

// The refusal leg (an engine-written declaration on any OTHER slot) is pinned by
// `context-lines.test.ts` (f), where the construction criteria (a)–(g) live; this block
// owns the P40-specific claims and does not restate it.

describe('P40 T1 — `written: "engine"` marks the one artifact the engine writes itself', () => {
  it("declares the brief cell engine-written on every row that carries it — the contract builds", () => {
    const carriers = ROWS.filter((row) => briefOf(row) !== undefined);
    // three declaration OBJECTS, not three rows: the review tail's declaration is shared
    // by the six review rows, so the eight carrier rows ride three declarations
    expect(new Set(carriers.map((row) => briefOf(row))).size).toBe(3);
    for (const row of carriers) {
      expect(briefOf(row)?.written, row.mode).toBe("engine");
    }
    expect(() => new TemplateAssembler()).not.toThrow();
  });

  it("reduces the engine-written declarations to ONE slot per SLOT, not one per row", () => {
    // `engineWrittenSlots` IS the reduction the construction-time criterion consumes:
    // three declarations answer one slot, so deleting it (per-declaration judgment) turns
    // this pin red instead of leaving the suite green on a rule nobody guards.
    expect(TemplateAssembler.engineWrittenSlots(ROWS)).toEqual([
      TemplateAssembler.NAMED_BRIEF_CELL,
    ]);
    const declarations = ROWS.flatMap((row) => row.roundContext).filter(
      (decl) => decl.written === "engine",
    );
    expect(declarations.length).toBeGreaterThanOrEqual(3);
  });
});
