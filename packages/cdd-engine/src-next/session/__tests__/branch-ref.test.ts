// packages/cdd-engine/src-next/session/__tests__/branch-ref.test.ts
// T26 ⑦ — the single branch-range identity. The VO renders every display/name
// surface in short form from ONE decision (base7..head7) and derives the fix's
// range from its source review handoff (--findings commits) — the single-carrier
// rule (the fix CLI declares no branch refs). Zero naked shas slices anywhere.

import { describe, expect, it } from "vitest";
import { BranchRef } from "../branch-ref.ts";

const BASE = "a".repeat(40);
const HEAD = "b".repeat(40);

describe("BranchRef — the single branch-range identity", () => {
  it("short() renders base7..head7 from the full shas — the file/slug/INPUT_RANGE spine", () => {
    const ref = new BranchRef(BASE, HEAD);
    expect(ref.base7).toBe("a".repeat(7));
    expect(ref.head7).toBe("b".repeat(7));
    expect(ref.short()).toBe(`${"a".repeat(7)}..${"b".repeat(7)}`);
  });

  it("args() keeps the full shas — `cdd review`'s 40-char CLI consumption (the terminal gate)", () => {
    const ref = new BranchRef(BASE, HEAD);
    expect(ref.args()).toBe(`--base ${BASE} --head ${HEAD}`);
  });

  it("static short() — the string-only sites (zero naked slices at call sites)", () => {
    expect(BranchRef.short(BASE, HEAD)).toBe(`${"a".repeat(7)}..${"b".repeat(7)}`);
  });

  it("fromHandoff() derives the ref from the source review handoff's commits — the fix's single carrier", () => {
    const ref = BranchRef.fromHandoff(
      JSON.stringify({ status: "REVIEW_FIX", commits: { base: BASE, head: HEAD } }),
    );
    expect(ref).not.toBeNull();
    expect(ref!.short()).toBe(`${"a".repeat(7)}..${"b".repeat(7)}`);
  });

  it("fromHandoff() degrades to null — malformed text or a ref-less carrier (the cli gate then names the flags)", () => {
    expect(BranchRef.fromHandoff("not json")).toBeNull();
    expect(BranchRef.fromHandoff(JSON.stringify({ findings: [] }))).toBeNull();
    expect(BranchRef.fromHandoff(JSON.stringify({ commits: { base: BASE } }))).toBeNull();
  });
});
