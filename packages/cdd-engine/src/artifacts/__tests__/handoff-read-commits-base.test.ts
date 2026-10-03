// packages/cdd-engine/src/artifacts/__tests__/handoff-read-commits-base.test.ts
// readCommitsBase — the single shape-narrowed commits.base reader (T1 review-1 fix: the 6-guard
// narrow was duplicated in rules/write-boundary.ts and dispatch/branch.ts; this helper is the
// unified home, both call sites delegate to it). Contract: a legal string base is returned
// verbatim (never coerced — empty string stays empty; the consumers keep their own empty-string /
// "unknown" handling downstream); any other commits shape → null.

import { describe, expect, it } from "vitest";
import { readCommitsBase } from "../handoff/write.ts";

describe("readCommitsBase — handoff commits.base shape-narrowed read", () => {
  it("returns the base verbatim for a legal commits object", () => {
    expect(readCommitsBase({ base: "2e5838dcdfa13514cc9cbd83778ffa3ce5ec7cbb", head: "x" })).toBe(
      "2e5838dcdfa13514cc9cbd83778ffa3ce5ec7cbb",
    );
  });

  it("returns an empty string verbatim (callers keep empty-string handling downstream)", () => {
    expect(readCommitsBase({ base: "" })).toBe("");
  });

  it("returns null for missing/base-less commits shapes", () => {
    expect(readCommitsBase(null)).toBeNull();
    expect(readCommitsBase(undefined)).toBeNull();
    expect(readCommitsBase({})).toBeNull();
    expect(readCommitsBase({ head: "2e5838dcdfa13514cc9cbd83778ffa3ce5ec7cbb" })).toBeNull();
  });

  it("returns null for non-object / array / non-string base", () => {
    expect(readCommitsBase("x")).toBeNull();
    expect(readCommitsBase(42)).toBeNull();
    expect(readCommitsBase([])).toBeNull();
    expect(readCommitsBase({ base: 42 })).toBeNull();
    expect(readCommitsBase({ base: null })).toBeNull();
  });
});
