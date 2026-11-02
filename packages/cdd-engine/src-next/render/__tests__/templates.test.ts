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
// ONE narrative body, and `ReviewVariants.of` is the single target → criteria map.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { TargetType } from "../../session/faces.ts";
import {
  REVIEWS,
  type ReviewKey,
  ReviewVariants,
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
    expect(ReviewVariants.of("wave")).toBe("wave");
    expect(ReviewVariants.of("branch")).toBe("branch");
    expect(ReviewVariants.of("plan")).toBe("plan");
    expect(ReviewVariants.of("overall")).toBe("overall");
    expect(ReviewVariants.of("phase-spec")).toBe("spec");
    expect(ReviewVariants.of("single-spec")).toBe("spec");
  });

  it("folds the SELECTED body into every review row's criteria line", () => {
    for (const type of TARGET_TYPES) {
      const line = `**Criteria — ${type}:** ${REVIEWS[ReviewVariants.of(type)].axesGuide}`;
      expect(TEMPLATE_PROMPT.reviews[type].shell.join("\n")).toContain(line);
    }
  });
});
