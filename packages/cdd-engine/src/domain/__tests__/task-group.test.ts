// packages/cdd-engine/src/domain/__tests__/task-group.test.ts
// TaskGroup — the group identity value object (P4.4 Task 3 ①): canonical `key()` serialization
// ("1" singleton · "1,2" merged), fromTokens/fromNumbers factories (per-token integer validation ·
// dedupe · ascending sort), member assertions + the single key-grammar source GROUP_KEY_PATTERN.

import { describe, expect, it } from "vitest";
import { IllegalTaskTokenError, TaskGroup, toTaskGroup } from "../task-group.ts";

describe("TaskGroup factories", () => {
  it("fromNumbers: dedupes and sorts ascending (key() is the canonical serialization)", () => {
    expect(TaskGroup.fromNumbers([3, 1, 2]).key()).toBe("1,2,3");
    expect(TaskGroup.fromNumbers([2, 2, 1]).key()).toBe("1,2");
    expect(TaskGroup.fromNumbers([7]).key()).toBe("7");
  });

  it("fromTokens: trims, validates integers, dedupes, sorts", () => {
    expect(TaskGroup.fromTokens(["1", " 2 ", "1", "2"]).key()).toBe("1,2");
    expect(TaskGroup.fromTokens(["3", "7", "12"]).key()).toBe("3,7,12");
  });

  it("fromTokens: a non-integer token (e.g. the hyphen form 1-2) is rejected with the token", () => {
    try {
      TaskGroup.fromTokens(["1-2"]);
      expect.fail("expected IllegalTaskTokenError");
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalTaskTokenError);
      expect((e as IllegalTaskTokenError).token).toBe("1-2");
    }
  });

  it("fromTokens: an empty token (trailing comma in `1,`) is rejected", () => {
    expect(() => TaskGroup.fromTokens(["1", ""])).toThrow(IllegalTaskTokenError);
    expect(() => TaskGroup.fromTokens([""])).toThrow(IllegalTaskTokenError);
  });

  it("fromTokens: a non-numeric token is rejected", () => {
    expect(() => TaskGroup.fromTokens(["abc"])).toThrow(IllegalTaskTokenError);
    expect(() => TaskGroup.fromTokens(["1.5"])).toThrow(IllegalTaskTokenError);
  });

  it("fromNumbers: rejects a non-integer input (illegal domain value)", () => {
    expect(() => TaskGroup.fromNumbers([1.5])).toThrow();
  });
});

describe("TaskGroup identity surface", () => {
  it("key(): comma-joined no space — the single canonical group identity", () => {
    expect(TaskGroup.fromNumbers([1, 2]).key()).toBe("1,2");
    expect(TaskGroup.fromNumbers([1]).key()).toBe("1");
  });

  it("toString(): key form (template-literal interop)", () => {
    expect(`${TaskGroup.fromNumbers([1, 2])}`).toBe("1,2");
  });

  it("GROUP_KEY_PATTERN: the single key grammar (comma-separated integers, no range/hyphen)", () => {
    expect(TaskGroup.GROUP_KEY_PATTERN.test("1")).toBe(true);
    expect(TaskGroup.GROUP_KEY_PATTERN.test("1,2")).toBe(true);
    expect(TaskGroup.GROUP_KEY_PATTERN.test("3,7,12")).toBe(true);
    expect(TaskGroup.GROUP_KEY_PATTERN.test("1-2")).toBe(false);
    expect(TaskGroup.GROUP_KEY_PATTERN.test("")).toBe(false);
    expect(TaskGroup.GROUP_KEY_PATTERN.test("1,2,")).toBe(false);
    expect(TaskGroup.GROUP_KEY_PATTERN.test("a,b")).toBe(false);
  });

  it("member assertions: includes / length / isSingleton / iteration", () => {
    const g = TaskGroup.fromNumbers([1, 2]);
    expect(g.includes(1)).toBe(true);
    expect(g.includes(3)).toBe(false);
    expect(g.length).toBe(2);
    expect(g.isSingleton()).toBe(false);
    expect(TaskGroup.fromNumbers([5]).isSingleton()).toBe(true);
    expect([...g]).toEqual([1, 2]);
    // numbers getter — the readonly scalar list (never the internal reference)
    expect(g.numbers).toEqual([1, 2]);
  });

  it("equality by key: equal number sets are the same group identity", () => {
    expect(TaskGroup.fromNumbers([2, 1]).key()).toBe(TaskGroup.fromNumbers([1, 2]).key());
  });
});

describe("toTaskGroup normalization (the CLI/lifecycle boundary)", () => {
  it("accepts a scalar, an array, and a TaskGroup", () => {
    expect(toTaskGroup(3).key()).toBe("3");
    expect(toTaskGroup([2, 1]).key()).toBe("1,2");
    const g = TaskGroup.fromNumbers([4]);
    expect(toTaskGroup(g)).toBe(g);
  });

  it("rejects an empty array (undefined group identity)", () => {
    expect(() => toTaskGroup([])).toThrow();
  });
});
