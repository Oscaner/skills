// packages/cdd-engine/src-next/session/__tests__/branch-ref.test.ts
// T26 ⑦ + P4.1 find #9/#10 — the single branch-range identity. The VO renders
// every display/name surface in short form from ONE decision (base8..head8) and
// derives the fix's range from its source review handoff (--findings commits) —
// the single-carrier rule (the fix CLI declares no branch refs). find #10: the
// engine's commit refs are 8-char short shas — 40-char full shas retired
// (user ruling · spec §6.6). Zero naked shas slices anywhere.

import { describe, expect, it } from "vitest";
import { BranchRef } from "../branch-ref.ts";

const BASE = "a".repeat(8);
const HEAD = "b".repeat(8);

describe("BranchRef — the single branch-range identity", () => {
  it("short() renders base8..head8 — the file/slug/INPUT_RANGE spine (find #10 · idempotent on the living 8-char form)", () => {
    const ref = new BranchRef(BASE, HEAD);
    expect(ref.base8).toBe("a".repeat(8));
    expect(ref.head8).toBe("b".repeat(8));
    expect(ref.short()).toBe(`${"a".repeat(8)}..${"b".repeat(8)}`);
  });

  it("short() is idempotent on 8-char shas — the engine's living form (find #10)", () => {
    const ref = new BranchRef("a".repeat(8), "b".repeat(8));
    expect(ref.base8).toBe("a".repeat(8));
    expect(ref.head8).toBe("b".repeat(8));
    expect(ref.short()).toBe(`${"a".repeat(8)}..${"b".repeat(8)}`);
  });

  it("find #10 zero-residue guard — a legacy carrier (40-char shas) still resolves, sliced to 8 at the ONE decision, never re-sliced into a shorter token", () => {
    // a full 40-char carrier (a pre-find-#10 handoff) resolves — the ref is 8-char
    const legacy = new BranchRef("a".repeat(40), "b".repeat(40));
    expect(legacy.base8).toBe("a".repeat(8));
    expect(legacy.head8).toBe("b".repeat(8));
    expect(legacy.short()).toBe(`${"a".repeat(8)}..${"b".repeat(8)}`);
    expect(legacy.args()).toBe(`--base ${"a".repeat(8)} --head ${"b".repeat(8)}`);
  });

  it("args() renders the 8-char flags — `cdd review --type branch`'s CLI consumption (find #10 — long shas retired)", () => {
    const ref = new BranchRef(BASE, HEAD);
    expect(ref.args()).toBe(`--base ${"a".repeat(8)} --head ${"b".repeat(8)}`);
  });

  it("static short() — the string-only sites (zero naked slices at call sites)", () => {
    expect(BranchRef.short(BASE, HEAD)).toBe(`${"a".repeat(8)}..${"b".repeat(8)}`);
  });

  it("fromHandoff() derives the ref from the source review handoff's commits — the fix's single carrier", () => {
    const ref = BranchRef.fromHandoff(
      JSON.stringify({ status: "REVIEW_FIX", commits: { base: BASE, head: HEAD } }),
    );
    expect(ref).not.toBeNull();
    expect(ref!.short()).toBe(`${"a".repeat(8)}..${"b".repeat(8)}`);
  });

  it("fromHandoff() degrades to null — malformed text or a ref-less carrier (the cli gate then names the flags)", () => {
    expect(BranchRef.fromHandoff("not json")).toBeNull();
    expect(BranchRef.fromHandoff(JSON.stringify({ findings: [] }))).toBeNull();
    expect(BranchRef.fromHandoff(JSON.stringify({ commits: { base: BASE } }))).toBeNull();
  });
});
