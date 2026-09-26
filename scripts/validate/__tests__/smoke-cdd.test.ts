// scripts/validate/__tests__/smoke-cdd.test.ts — version-identity assertion seam of the
// consumer-sim release gate. Pins the compare helper behind `smoke-cdd --expect-version`
// (release-state version identity assertion, design §2.2 / §6): the full pack → install
// empirical run is exercised by the release acceptance, this unit pins the compare logic
// (expected × actual both reported on mismatch).

import { describe, expect, it } from "vitest";

import { versionMismatch } from "../smoke-cdd.ts";

describe("smoke-cdd --expect-version version identity assertion", () => {
  it("a matching version passes (no mismatch)", () => {
    expect(versionMismatch("0.1.0", "0.1.0")).toBeNull();
    expect(versionMismatch("1.0.0", "1.0.0")).toBeNull();
  });

  it("a version mismatch reports BOTH the expected and the actual value", () => {
    const msg = versionMismatch("0.1.0", "9.9.9");
    expect(msg).toContain("expected 9.9.9");
    expect(msg).toContain("got 0.1.0");
  });
});
