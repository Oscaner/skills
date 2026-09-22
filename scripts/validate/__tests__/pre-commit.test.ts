// scripts/validate/__tests__/pre-commit.test.ts — G4 (P6 Task 17): pins the
// tree-independent pre-commit subset composition (scripts/validate/pre-commit.ts).
// The subset must (a) lead with the emit freshness block, (b) carry every
// read-only / gate-free block of the full 11-step validate (osuperpowers:
// plugin resolution / skills inventory / node:test behavior tree + wiring guard;
// engine zero residue + channel audit; marketplace manifests; scripts unit;
// package version sync), and (c) exclude ONLY the engine black-box surface
// (cdd-engine dev stub materialization / engine test suite (vitest)) — the
// blocks whose cwd=REPO_ROOT dispatch depends on entry-gate tree cleanliness.
// The full validate composition stays untouched (index.ts, 11 steps — pinned by
// the wiring guard ci-validate.test.mjs).
import { describe, it, expect } from "vitest";

import { steps as subsetSteps } from "../pre-commit.ts";
import { steps as fullSteps } from "../index.ts";

describe("pre-commit subset (G4/P6 Task 17)", () => {
  it("leads with the unified emit freshness block", () => {
    expect(subsetSteps[0].name).toBe("emit freshness (checked against regenerated products)");
  });

  it("carries the tree-independent blocks of the full validate", () => {
    const names = subsetSteps.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "osuperpowers plugin resolution",
        "osuperpowers skills inventory count",
        "osuperpowers node:test behavior tree",
        "validate wiring guard (ci-validate.test.mjs)",
        "engine zero residue + channel audit",
        "marketplace manifests validate",
        "scripts unit tests (vitest)",
        "package version sync",
      ]),
    );
  });

  it("excludes the engine black-box steps (stub materialization / engine suite)", () => {
    const names = subsetSteps.map((s) => s.name);
    expect(names.some((n) => n.startsWith("cdd-engine dev stub materialization"))).toBe(false);
    expect(names.some((n) => n.startsWith("cdd-engine engine test suite (vitest)"))).toBe(false);
  });

  it("full validate still composes exactly the 11 steps (subset is a strict exclusion)", () => {
    expect(fullSteps).toHaveLength(11);
    const subsetNames = new Set(subsetSteps.map((s) => s.name));
    const excluded = fullSteps.map((s) => s.name).filter((n) => !subsetNames.has(n));
    expect(excluded).toEqual(["cdd-engine dev stub materialization", "cdd-engine engine test suite (vitest)"]);
  });
});