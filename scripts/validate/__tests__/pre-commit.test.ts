// scripts/validate/__tests__/pre-commit.test.ts — G4 (P6 Task 17): pins the
// tree-independent pre-commit subset composition (scripts/validate/pre-commit.ts).
// The subset must (a) lead with the emit freshness block, (b) carry every
// read-only / gate-free block of the full validate (kairos:
// plugin resolution / skills inventory / pi-package well-formed / node:test
// behavior tree + wiring guard; engine zero residue + channel audit; marketplace
// manifests; scripts unit; package version sync), and (c) exclude ONLY the engine
// black-box surface (cdd-engine dev stub materialization / engine test suite
// (vitest)) — the blocks whose cwd=REPO_ROOT dispatch depends on entry-gate tree
// cleanliness. The full validate composition is pinned by name-set in orchestrate.ts —
// wired by the ci-validate.test.ts guard.
import { describe, expect, it } from "vitest";
import { steps as fullSteps } from "../orchestrate.ts";
import { steps as subsetSteps } from "../pre-commit.ts";

describe("pre-commit subset (G4/P6 Task 17)", () => {
  it("leads with the unified emit freshness block", () => {
    expect(subsetSteps[0].name).toBe("emit freshness (checked against regenerated products)");
  });

  it("carries the tree-independent blocks of the full validate", () => {
    const names = subsetSteps.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "kairos plugin resolution",
        "kairos skills inventory count",
        "kairos pi-package well-formed",
        "kairos node:test behavior tree",
        "validate wiring guard (ci-validate.test.ts)",
        "engine zero residue + channel audit",
        "marketplace manifests validate",
        "scripts unit tests (vitest)",
        "type-check (tsc --noEmit × 3 projects)",
        "package version sync",
      ]),
    );
  });

  it("excludes the engine black-box steps (stub materialization / engine suite)", () => {
    const names = subsetSteps.map((s) => s.name);
    expect(names.some((n) => n.startsWith("cdd-engine dev stub materialization"))).toBe(false);
    expect(names.some((n) => n.startsWith("cdd-engine engine test suite (vitest)"))).toBe(false);
  });

  it("full validate composes every pinned step by name (subset is a strict exclusion)", () => {
    const expectedFull = [
      "emit freshness (checked against regenerated products)",
      "kairos plugin resolution",
      "kairos skills inventory count",
      "kairos pi-package well-formed",
      "kairos node:test behavior tree",
      "validate wiring guard (ci-validate.test.ts)",
      "cdd-engine dev stub materialization",
      "cdd-engine engine test suite (vitest)",
      "engine zero residue + channel audit",
      "marketplace manifests validate",
      "scripts unit tests (vitest)",
      "type-check (tsc --noEmit × 3 projects)",
      "package version sync",
    ];
    expect(fullSteps.map((s) => s.name)).toEqual(expect.arrayContaining(expectedFull));
    const subsetNames = new Set(subsetSteps.map((s) => s.name));
    const excluded = fullSteps.map((s) => s.name).filter((n) => !subsetNames.has(n));
    expect(excluded).toEqual([
      "cdd-engine dev stub materialization",
      "cdd-engine engine test suite (vitest)",
    ]);
  });
});
