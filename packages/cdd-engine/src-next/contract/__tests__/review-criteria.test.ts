// packages/cdd-engine/src-next/contract/__tests__/review-criteria.test.ts
// P37 T1 — the grading criteria registry (design spec §1, §6.1, §6.2): the three
// tier boundaries, the evidence duty and the counterexample are ROWS, the rubric is
// their assembly, and the execution faces are a declared census.
//
// Pins, one per claim:
//   · every row's three cells reach `renderRubric()` verbatim (no cell is metadata);
//   · an unregistered id throws, a blank cell throws, a tier with no row throws — the
//     assembly-time half of the two validation contracts;
//   · the face census is pinned by id: `numbered` three rows, `gate` one (the
//     `CDD_BLOCKED: grading-impact-missing` word), `test` one (the pin gate) — changing
//     a row's face, deleting a row or adding one goes red here.
//
// The row-shape half (a deleted key is a `tsc` error, not a throw) is deliberately NOT
// asserted through vitest: the suite runs source through esbuild, so a missing literal
// key would only be `undefined` at runtime — `pnpm exec tsc --noEmit -p
// packages/cdd-engine` is that pin.

import { describe, expect, it } from "vitest";
import {
  CRITERIA,
  CRITERIA_ROWS,
  CriteriaRegistry,
  type CriteriaRow,
  LENS_QUESTION_ROWS,
  LENS_QUESTIONS,
  LensQuestionRegistry,
  REGRADE_MARK,
  type ReviewKind,
  TIER_ORDER,
} from "../review-criteria.ts";

/** One row with a replaced/blanked cell — the negative fixtures read like the table. */
const withCell = (id: string, cell: keyof CriteriaRow, value: string): readonly CriteriaRow[] =>
  CRITERIA_ROWS.map((row) => (row.id === id ? { ...row, [cell]: value } : row));

describe("P37 T1 — the criteria registry's rows carry the three-tier boundary, duty and counterexample", () => {
  it("reaches every row's body, duty and counterExample verbatim in the assembled rubric", () => {
    const rubric = CRITERIA.renderRubric();
    for (const row of CRITERIA_ROWS) {
      expect(rubric, `${row.id} body`).toContain(row.body);
      expect(rubric, `${row.id} duty`).toContain(row.duty);
      expect(rubric, `${row.id} counterExample`).toContain(row.counterExample);
    }
  });

  it("assembles in the fixed cell order body → duty → counterExample", () => {
    const rubric = CRITERIA.renderRubric();
    for (const row of CRITERIA_ROWS) {
      expect(rubric).toContain(`${row.body} ${row.duty} ${row.counterExample}`);
    }
  });

  it("orders the tiers blocker → warn → nit, same-tier rows adjacent", () => {
    expect(TIER_ORDER).toEqual(["blocker", "warn", "nit"]);
    const rubric = CRITERIA.renderRubric();
    const at = (text: string): number => rubric.indexOf(text);
    // the first row of each tier marks the tier's start
    expect(at(CRITERIA.of("grading-impact-missing").body)).toBeLessThan(
      at(CRITERIA.of("debt-consequence").body),
    );
    expect(at(CRITERIA.of("pin-parseability").body)).toBeLessThan(
      at(CRITERIA.of("expression-only").body),
    );
    expect(at(CRITERIA.of("expression-only").body)).toBeLessThan(
      at(CRITERIA.of("regrade-mark").body),
    );
  });

  it("carries every tier's counterexample as a row cell, not a tier cell", () => {
    // The §1.3 sweep: blocker owes the missing-scenario sentence, warn owes the
    // dead-code boundary, nit owes the self-consistent naming sentence; the second
    // blocker sentence rides the blocker row's body (its closing edge).
    expect(CRITERIA.of("grading-impact-missing").counterExample).toContain(
      "is a warn, not a blocker",
    );
    expect(CRITERIA.of("grading-impact-missing").body).toContain(
      "stay unchanged is a warn, not a blocker",
    );
    expect(CRITERIA.of("debt-consequence").counterExample).toContain("is a warn, not a nit");
    expect(CRITERIA.of("expression-only").counterExample).toContain("is a nit, not a warn");
    // the pin row carries the §7.4 reversal reason and its boundary
    const pin = CRITERIA.of("pin-parseability");
    expect(pin.tier).toBe("warn");
    expect(pin.counterExample).toContain("P28");
    expect(pin.counterExample).toContain("`PinAudit` never carries");
  });

  it("assembles each tier as ONE contiguous run of sentences — no fragment splices in", () => {
    // The nit tier is where a display fragment would splice: the regrade mark is a
    // token the board prints, not a criterion sentence, so it never reaches the tier
    // prose (a lowercase fragment mid-paragraph is the failure this pin forbids).
    const rubric = CRITERIA.renderRubric();
    for (const tier of TIER_ORDER) {
      const rows = CRITERIA.rows.filter((row) => row.tier === tier);
      const run = rows.map((row) => `${row.body} ${row.duty} ${row.counterExample}`).join(" ");
      const start = rubric.indexOf(rows[0]?.body ?? "");
      expect(start, `${tier} run start`).toBeGreaterThan(-1);
      expect(rubric.slice(start, start + run.length), `${tier} run`).toBe(run);
      for (const row of rows) {
        for (const cell of [row.body, row.duty, row.counterExample]) {
          expect(cell, `${row.id} cell opens as a sentence`).toMatch(/^[A-Z]/);
          expect(cell, `${row.id} cell closes as a sentence`).toMatch(/[.!?]$/);
        }
      }
    }
  });

  it("keeps the downgrade mark's wording out of the rubric prose — it is a display token", () => {
    // §5.2: the mark is a display fact. Its wording lives beside the table, so the
    // table has one mark source and no cell of it is the token itself.
    expect(REGRADE_MARK).toBe("downgraded without a regrade reason");
    for (const row of CRITERIA.rows) {
      for (const cell of [row.body, row.duty, row.counterExample]) {
        expect(cell, `${row.id} cell is not the mark token`).not.toBe(REGRADE_MARK);
      }
    }
    expect(CRITERIA.renderRubric()).not.toContain(`. ${REGRADE_MARK} `);
  });

  it("pins the face census by id — numbered three, gate one, test one", () => {
    // The row set itself is pinned: deleting a row or adding one goes red.
    expect(CRITERIA.rows.map((row) => row.id)).toEqual([
      "grading-impact-missing",
      "debt-consequence",
      "pin-parseability",
      "expression-only",
      "regrade-mark",
    ]);
    const idsOf = (face: CriteriaRow["face"]): readonly string[] =>
      CRITERIA.rows.filter((row) => row.face === face).map((row) => row.id);
    expect(idsOf("numbered")).toEqual(["debt-consequence", "expression-only", "regrade-mark"]);
    expect(idsOf("gate")).toEqual(["grading-impact-missing"]);
    expect(idsOf("test")).toEqual(["pin-parseability"]);
  });

  it("covers every tier — a tier with no row throws at assembly", () => {
    for (const tier of TIER_ORDER) {
      expect(
        CRITERIA.rows.some((row) => row.tier === tier),
        `${tier} owes a row`,
      ).toBe(true);
    }
    const missingNit = CRITERIA_ROWS.filter((row) => row.tier !== "nit");
    expect(() => new CriteriaRegistry(missingNit).renderRubric()).toThrow(/no "nit" row/);
  });
});

describe("P37 T1 — the registry's lookup and its assembly-time validation", () => {
  it("throws on an unregistered id", () => {
    expect(() => CRITERIA.of("missing")).toThrow(
      /no grading criterion is registered under "missing"/,
    );
  });

  it("returns the declared row by id", () => {
    for (const row of CRITERIA_ROWS) {
      expect(CRITERIA.of(row.id)).toBe(row);
    }
  });

  it("throws when a required cell is blank — and the blank cell never reaches the bytes", () => {
    for (const cell of ["body", "duty", "counterExample"] as const) {
      const broken = new CriteriaRegistry(withCell("grading-impact-missing", cell, "   "));
      expect(() => broken.renderRubric(), `${cell} blank`).toThrow(
        new RegExp(`leaves its ${cell} cell blank`),
      );
    }
    const blanked = new CriteriaRegistry(withCell("debt-consequence", "counterExample", ""));
    expect(() => blanked.renderRubric()).toThrow(/leaves its counterExample cell blank/);
  });

  it("keeps the intact rows' fragments while a blank cell stops the whole assembly", () => {
    // The throw is the point: a rubric rendered without one counterexample would be
    // exactly the "one sentence short" fragment §6.1 forbids.
    const broken = new CriteriaRegistry(withCell("expression-only", "duty", "  "));
    expect(() => broken.renderRubric()).toThrow();
    expect(CRITERIA.renderRubric()).toContain(CRITERIA.of("expression-only").duty);
  });
});

/**
 * P37 T2 — the lens question table (design spec §3.1 · §6.1 · §6.2). The pins are the
 * three independent readings of one table: 15 declared rows (`rows.length`), 19
 * (review kind, lens) cells (`sum(reviewKinds.length)`), and the five per-kind
 * projections (4 / 4 / 3 / 3 / 5). Only a multi-valued `reviewKinds` on the shared
 * wave / branch rows satisfies all three at once.
 */
const REVIEW_KINDS: readonly ReviewKind[] = ["wave", "branch", "plan", "spec", "overall"];

describe("P37 T2 — the lens question table's rows and cells", () => {
  it("declares 15 physical rows and covers 19 (review kind, lens) cells", () => {
    expect(LENS_QUESTIONS.rows.length).toBe(15);
    expect(LENS_QUESTIONS.rows.reduce((sum, row) => sum + row.reviewKinds.length, 0)).toBe(19);
  });

  it("shares the wave / branch four questions byte-identically — one row, two kinds", () => {
    const shared = LENS_QUESTIONS.rows.filter((row) => row.reviewKinds.length > 1);
    expect(shared).toHaveLength(4);
    for (const row of shared) expect([...row.reviewKinds].sort()).toEqual(["branch", "wave"]);
    const wave = LENS_QUESTIONS.forReviewKind("wave");
    const branch = LENS_QUESTIONS.forReviewKind("branch");
    expect(branch.map((row) => row.question)).toEqual(wave.map((row) => row.question));
    expect(branch.map((row) => row.id)).toEqual(wave.map((row) => row.id));
  });

  it("projects each kind in declaration order — 4 · 4 · 3 · 3 · 5", () => {
    expect(REVIEW_KINDS.map((kind) => LENS_QUESTIONS.forReviewKind(kind).length)).toEqual([
      4, 4, 3, 3, 5,
    ]);
    for (const kind of REVIEW_KINDS) {
      for (const row of LENS_QUESTIONS.forReviewKind(kind)) {
        expect(row.reviewKinds, `${kind} · ${row.lens}`).toContain(kind);
      }
    }
  });

  it("gives every row a unique id, a lens and the `numbered` face", () => {
    const ids = LENS_QUESTIONS.rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of LENS_QUESTIONS.rows) {
      expect(row.face, row.id).toBe("numbered");
      expect(row.lens.trim().length, row.id).toBeGreaterThan(0);
      expect(row.question.trim().length, row.id).toBeGreaterThan(0);
    }
  });

  it("has no duplicate (kind, lens) cell across rows", () => {
    const cells = LENS_QUESTION_ROWS.flatMap((row) =>
      row.reviewKinds.map((kind) => `${kind} · ${row.lens}`),
    );
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("looks a cell up and throws on an unregistered one", () => {
    for (const kind of REVIEW_KINDS) {
      for (const row of LENS_QUESTIONS.forReviewKind(kind)) {
        expect(LENS_QUESTIONS.of(kind, row.lens)).toBe(row);
      }
    }
    expect(() => LENS_QUESTIONS.of("wave", "clarity")).toThrow(
      /no lens question is registered for wave · clarity/,
    );
    // a criteria id is no lens, and a question is no grading criterion — the two tables
    // never answer for each other
    expect(() => LENS_QUESTIONS.of("wave", "grading-impact-missing")).toThrow();
    expect(() => CRITERIA.of("standards-lens")).toThrow(/no grading criterion/);
  });

  it("renders no blank question — a blank row throws on projection", () => {
    const blanked = new LensQuestionRegistry(
      LENS_QUESTION_ROWS.map((row) => (row.id === "scope-lens" ? { ...row, question: "  " } : row)),
    );
    expect(() => blanked.forReviewKind("wave")).toThrow(/is blank/);
    // the branch cell shares that row, so it goes red too — one table, one failure
    expect(() => blanked.forReviewKind("branch")).toThrow(/is blank/);
  });

  it("keeps the document kinds' questions on their own rows — never a shared row", () => {
    for (const [kind, lens, id] of [
      ["plan", "buildability", "plan-buildability"],
      ["spec", "completeness", "spec-completeness"],
      ["overall", "scope", "overall-scope"],
    ] as const) {
      const row = LENS_QUESTIONS.of(kind, lens);
      expect(row.id).toBe(id);
      expect(row.reviewKinds).toEqual([kind]);
    }
    // the same lens word under a wave / branch cell is the shared row, not this one
    expect(LENS_QUESTIONS.of("wave", "buildability").id).toBe("buildability-lens");
    expect(LENS_QUESTIONS.of("wave", "scope").id).toBe("scope-lens");
  });
});
