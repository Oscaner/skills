// scripts/validate/__tests__/pre-commit.test.ts — G4 (P6 Task 17): pins the
// tree-independent pre-commit subset composition (scripts/validate/pre-commit.ts).
// The subset must (a) lead with the emit freshness block, (b) carry every
// read-only / gate-free block of the full 12-step validate (5b osuperpowers trees
// + wiring guard, 5c residue + channel-audit, 6 marketplace, 7 scripts unit,
// 8-10 version sync, 12 overall consistency), and (c) exclude ONLY the engine
// black-box surface (5b0 stub materialization / 5b1 Vitest suite) — the blocks
// whose cwd=REPO_ROOT dispatch depends on entry-gate tree cleanliness. The full
// validate composition stays untouched (index.ts, 12 steps — pinned by the wiring
// guard ci-validate.test.mjs).
import { describe, it, expect } from "vitest";

import { steps as subsetSteps } from "../pre-commit.ts";
import { steps as fullSteps } from "../index.ts";

describe("pre-commit subset (G4/P6 Task 17)", () => {
  it("leads with the unified emit freshness block", () => {
    expect(subsetSteps[0].name).toBe("0. unified emit freshness (emit-check)");
  });

  it("carries the tree-independent blocks of the full validate", () => {
    const names = subsetSteps.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "5b. osuperpowers plugin validation",
        "5c. engine zero-residue + channel-audit grep",
        "6. marketplace validate",
        "7. scripts unit tests (vitest)",
        "8-10. version sync",
        "12. overall consistency",
      ]),
    );
  });

  it("excludes the engine black-box steps (5b0 stub / 5b1 Vitest suite)", () => {
    const names = subsetSteps.map((s) => s.name);
    expect(names.some((n) => n.startsWith("5b0."))).toBe(false);
    expect(names.some((n) => n.startsWith("5b1."))).toBe(false);
  });

  it("full validate still composes exactly the 12 steps (subset is a strict exclusion)", () => {
    expect(fullSteps).toHaveLength(12);
    const subsetNames = new Set(subsetSteps.map((s) => s.name));
    const excluded = fullSteps.map((s) => s.name).filter((n) => !subsetNames.has(n));
    expect(excluded).toEqual(["5b0. cdd-engine stub materialization (dev:stub)", "5b1. cdd-engine Vitest engine suite"]);
  });
});
