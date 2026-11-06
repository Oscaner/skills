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
// P28 T3 — the volatile-facts discipline: the narrative body names the three claim
// shapes a spec may pin (a symbol, a guarded count, a condition) instead of accepting
// today's shape, while the plan variant stays byte-frozen — a plan's `path:line` is a
// delivery target, not a spec claim.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { TargetType } from "../../session/faces.ts";
import {
  REVIEWS,
  type ReviewKey,
  reviewBodyOf,
  reviewGuideOf,
  SEVERITY_RUBRIC,
  SEVERITY_RUBRIC_SLOTS,
  TEMPLATE_PROMPT,
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
  it("carries the four blocker questions and the warn/nit anchors", () => {
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
    expect(SEVERITY_RUBRIC).toContain("Style, naming and line-wrapping");
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
 * The three claim shapes the narrative body names — one stable substring each, so a
 * rewording that keeps the shape stays green while dropping a shape goes red. A whole
 * byte pin is deliberately absent: punctuation must not be the thing that breaks.
 */
const VOLATILE_FACT_ANCHORS = [
  "module path + symbol name",
  "pinned by the named guard",
  "belongs to the plan",
] as const;

/** The plan variant's byte-frozen prefix — the volatile-facts rewrite lands on the
 *  spec variant only: a plan's `path:line` is the delivery target of a task, so
 *  banning it there buys nothing. */
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

  it("keeps the plan variant byte-frozen — the rewrite is the spec variant's only", () => {
    expect(REVIEWS.plan.axesGuide).toBe(`${PLAN_GUIDE_PREFIX}${reviewGuideOf("plan")}`);
  });
});
