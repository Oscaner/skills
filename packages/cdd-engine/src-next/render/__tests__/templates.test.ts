// packages/cdd-engine/src-next/render/__tests__/templates.test.ts
// P22 T1 — the severity rubric as ONE shared fragment: the four-question /
// three-tier calibration body (the four review axes guides' common tail) lives in
// `SEVERITY_RUBRIC` with two slots, and every `REVIEWS.<type>.axesGuide` embeds the
// FILLED fragment exactly once. The source-face pin guards the retired copies: the
// vision sentence's opening token appears once in the module bytes.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { TargetType } from "../../session/faces.ts";
import {
  REVIEWS,
  SEVERITY_RUBRIC,
  SEVERITY_RUBRIC_SLOTS,
  reviewGuideOf,
} from "../templates.ts";

const VARIANTS: readonly TargetType[] = ["wave", "branch", "spec", "plan"];

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
    for (const variant of VARIANTS) {
      expect(REVIEWS[variant].axesGuide.split(reviewGuideOf(variant)).length).toBe(2);
    }
  });

  it("keeps the fragment's source token in the module bytes once — zero copies", () => {
    const source = readFileSync(fileURLToPath(new URL("../templates.ts", import.meta.url)), "utf8");
    expect(source.split("The reviewed").length).toBe(2);
  });
});