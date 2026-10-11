// packages/cdd-engine/src-next/face/__tests__/validate.test.ts
// T2 — the ValueValidator domain-semantics suite (spec §4): the value-domain
// checks the commander parse does not carry — enum domains, the int-list face
// (normalized to the sorted deduped comma string the run face consumes),
// the 8-char sha shape, integers, the schema <type> primary vocabulary, and
// the conditional required groups (replicating the review/fix #sceneOf faces
// without introducing mutual-exclusion rejections). Every rejection is a
// usage-domain error (`isUsage: true`) for the T4 exit-code normalization.

import { describe, expect, it } from "vitest";

import { ValidatorUsageError, ValueValidator } from "../validate.ts";

const validator = new ValueValidator();

/** Assert that fn rejects with a usage-domain error and return its message. */
function usageMessage(fn: () => void): string {
  let error: unknown = null;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  expect(error, "expected a usage-domain rejection").toBeInstanceOf(ValidatorUsageError);
  const usage = error as ValidatorUsageError;
  expect(usage.isUsage, "usage errors carry the isUsage marker").toBe(true);
  return usage.message;
}

describe("ValueValidator", () => {
  describe("enum", () => {
    it("accepts an in-domain value", () => {
      expect(validator.enum(["wave", "branch", "spec", "plan"], "wave")).toBe("wave");
    });

    it("rejects an out-of-domain value as a usage error", () => {
      const message = usageMessage(() =>
        validator.enum(["wave", "branch", "spec", "plan"], "bogus"),
      );
      expect(message).toContain("wave | branch | spec | plan");
    });
  });

  describe("intList", () => {
    it("accepts a comma-separated integer list", () => {
      expect(validator.intList("1,2,3")).toBe("1,2,3");
    });

    it("normalizes to the sorted deduped comma string (2,1,1 → 1,2)", () => {
      expect(validator.intList("2,1,1")).toBe("1,2");
      expect(validator.intList("3,1,2,2")).toBe("1,2,3");
    });

    it("rejects a non-integer token as a usage error", () => {
      const message = usageMessage(() => validator.intList("abc"));
      expect(message).toContain("abc");
    });
  });

  describe("sha8", () => {
    it("accepts exactly 8 hex digits", () => {
      expect(validator.sha8("abcdef12")).toBe("abcdef12");
    });

    it("rejects a short sha and a non-hex sha as usage errors", () => {
      expect(() => validator.sha8("abc")).toThrow(ValidatorUsageError);
      expect(() => validator.sha8("zxyz")).toThrow(ValidatorUsageError);
    });
  });

  describe("int", () => {
    it("accepts an integer and returns a number", () => {
      expect(validator.int("42")).toBe(42);
    });

    it("rejects a non-integer as a usage error", () => {
      expect(() => validator.int("abc")).toThrow(ValidatorUsageError);
      expect(() => validator.int("4.2")).toThrow(ValidatorUsageError);
    });
  });

  describe("typeKey", () => {
    it("accepts the schema <type> primary spellings", () => {
      expect(validator.typeKey("overall")).toBe("overall");
      expect(validator.typeKey("plan")).toBe("plan");
      expect(validator.typeKey("phase-spec")).toBe("phase-spec");
    });

    it("rejects an out-of-vocabulary type as a usage error", () => {
      const message = usageMessage(() => validator.typeKey("bogus"));
      expect(message).toContain("bogus");
      expect(message).toContain("phase-spec");
    });

    it("leaves the phaseSpec alias to the T4 thin shell (primary-vocabulary boundary)", () => {
      usageMessage(() => validator.typeKey("phaseSpec"));
    });
  });

  describe("distribution", () => {
    it("passes review spec when --spec is declared", () => {
      validator.distribution("spec", new Set(["--spec"]));
    });

    it("passes review wave when --plan is declared", () => {
      validator.distribution("wave", new Set(["--plan"]));
    });

    it("rejects review wave when --plan is missing", () => {
      const message = usageMessage(() => validator.distribution("wave", new Set()));
      expect(message).toContain("--plan");
    });

    it("passes fix branch when --findings is declared (the fix handoff face)", () => {
      validator.distribution("branch", new Set(["--findings"]));
    });

    it("passes review branch when --base and --head are both declared", () => {
      validator.distribution("branch", new Set(["--base", "--head"]));
    });

    it("rejects branch when only one of --base/--head is declared", () => {
      const message = usageMessage(() => validator.distribution("branch", new Set(["--base"])));
      expect(message).toContain("--head");
    });

    it("keeps accepting `--type wave` with --plan and --spec together (no exclusivity)", () => {
      validator.distribution("wave", new Set(["--plan", "--spec"]));
      validator.distribution("wave", new Set(["--plan", "--tasks", "--spec"]));
    });

    it("rejects a type with no required group as a usage error", () => {
      const message = usageMessage(() => validator.distribution("bogus", new Set()));
      expect(message).toContain("bogus");
    });
  });
});
