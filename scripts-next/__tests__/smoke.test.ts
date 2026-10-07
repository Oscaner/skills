// scripts-next/__tests__/smoke.test.ts — T14 smoke checkable: the smoke dry-run is
// green — the smoke boots the NEW-TREE bin (`node packages/cdd-engine/src-next/bin.ts`)
// over a fixture repo and asserts the capsule contract on the dry-run chain.

import { rmSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SmokeCdd } from "../smoke-cdd.ts";

describe("smoke-cdd — the new-tree bin dry-run smoke", () => {
  it("boots the new-tree bin over a fixture repo and asserts the capsule contract", () => {
    const smoke = new SmokeCdd();
    const result = smoke.run(); // throws on any assertion failure (help face included)
    try {
      // The dry-run chain's capsules — status · blocker · handoff + the next: line.
      expect(result.stdout).toContain("status:");
      expect(result.stdout).toContain(".kairos/cdd/fixture/");
    } finally {
      rmSync(result.repoRoot, { recursive: true, force: true });
    }
  });
});
