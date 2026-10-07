// packages/cdd-engine/src-next/session/__tests__/next.test.ts
// T7 NextStepRouter suite (design spec §3.2) — the C5 decision table:
//   · review zero findings → none | next-group (the execution state's ready batch decides);
//   · review findings non-empty (any severity) → the one-way fix hop;
//   · fix blocker>0 → re-review at a new ref (base = the fix round's head);
//   · fix warn/nit only → none (closure — no re-review preview);
//   · the review-cycle soft cap → the "BLOCKED: review-cycle-cap" suggestion (outranks the
//     blocker row); REVIEW_CYCLE_CAP + the suggestion wording are the pinned constants;
//   · BLOCKED/TIMEOUT → null (no next line — the failure face), every phase;
//   · implement → the group's review (base = the task base); branch-review → closure / fix.
// The type assertions at the bottom pin the public surface compile-time (the brief's
// type-check checkable) — they fail under tsc if the exported signatures drift.

import { describe, expect, it } from "vitest";
import type { Round, RoundPhase } from "../ledger.ts";
import type { Route } from "../next.ts";
import { NextStepRouter, REVIEW_CYCLE_CAP, SOFT_CAP_SUGGESTION } from "../next.ts";
import type { ExecutionState } from "../state.ts";

/** A minimal execution-state stub — the router reads only readyBatch(). */
const state = (ready: readonly number[]): ExecutionState => ({
  doneTasks: () => new Set(),
  readyBatch: () => [...ready],
});

/** A review finding literal shorthand. */
const finding = (
  severity: "blocker" | "warn" | "nit",
  summary = "",
): {
  severity: "blocker" | "warn" | "nit";
  summary: string;
} => ({ severity, summary });

/** A round carrier shorthand — the mandated fields default; the case overrides. */
const round = (over: { phase: RoundPhase } & Partial<Omit<Round, "phase">>): Round => ({
  findings: [],
  consecutiveS1: 0,
  ...over,
});

const router = new NextStepRouter();

describe("review rounds — zero findings flows the group on or closes it", () => {
  it("zero findings + a ready batch → the next dispatch group (the ready task ids)", () => {
    expect(router.next(state([3]), round({ phase: "review" }))).toEqual({
      kind: "next-group",
      tasks: "3",
    });
    expect(router.next(state([4, 5]), round({ phase: "review" }))).toEqual({
      kind: "next-group",
      tasks: "4,5",
    });
  });

  it("zero findings + an exhausted run → none", () => {
    expect(router.next(state([]), round({ phase: "review" }))).toEqual({ kind: "none" });
  });

  it("any findings (blocker or warn/nit) → the one-way fix hop carrying the review handoff", () => {
    const findings: Round["findings"] = [finding("warn", "drift")];
    expect(
      router.next(
        state([]),
        round({ phase: "review", findings, findingsPath: "tasks-7,9-review-1.json" }),
      ),
    ).toEqual({ kind: "fix", findings: "tasks-7,9-review-1.json" });

    const blockers: Round["findings"] = [finding("blocker", "defect")];
    expect(router.next(state([]), round({ phase: "review", findings: blockers }))).toEqual({
      kind: "fix",
      findings: undefined,
    });
  });
});

describe("fix rounds — the re-review / closure decision point (C5-1)", () => {
  it("input blockers remain → re-review at a new ref (base = the fix round's head)", () => {
    expect(
      router.next(
        state([]),
        round({
          phase: "fix",
          findings: [finding("blocker", "remaining")],
          commits: { base: "a".repeat(40), head: "b".repeat(40) },
        }),
      ),
    ).toEqual({ kind: "review", base: "b".repeat(40) });
  });

  it("warn/nit only → none (closure — the #278 REVIEW_FIX state, no re-review preview)", () => {
    expect(
      router.next(state([]), round({ phase: "fix", findings: [finding("warn"), finding("nit")] })),
    ).toEqual({ kind: "none" });
  });

  it("zero findings → none", () => {
    expect(router.next(state([]), round({ phase: "fix" }))).toEqual({ kind: "none" });
  });

  it("the soft cap outranks the blocker row — a capped run defers to the user", () => {
    expect(
      router.next(
        state([]),
        round({
          phase: "fix",
          findings: [finding("blocker")],
          consecutiveS1: REVIEW_CYCLE_CAP,
        }),
      ),
    ).toEqual({ kind: "soft-cap", message: SOFT_CAP_SUGGESTION });
  });

  it("below the cap, blockers still route the re-review", () => {
    expect(
      router.next(
        state([]),
        round({ phase: "fix", findings: [finding("blocker")], consecutiveS1: 2 }),
      )!.kind,
    ).toBe("review");
  });
});

describe("implement / branch-review — the lifecycle rows", () => {
  it("implement completes → the group's review (base = the round's task base)", () => {
    expect(
      router.next(
        state([]),
        round({ phase: "implement", commits: { base: "a".repeat(40), head: "b".repeat(40) } }),
      ),
    ).toEqual({ kind: "review", base: "a".repeat(40) });
  });

  it("branch-review zero findings → none; findings → the fix hop", () => {
    expect(router.next(state([]), round({ phase: "branch-review" }))).toEqual({ kind: "none" });
    expect(
      router.next(state([]), round({ phase: "branch-review", findings: [finding("nit")] }))!.kind,
    ).toBe("fix");
  });
});

describe("the failure face — BLOCKED/TIMEOUT produce no next line", () => {
  it("a BLOCKED review round → null", () => {
    expect(router.next(state([]), round({ phase: "review", status: "BLOCKED" }))).toBeNull();
  });
  it("a BLOCKED fix round → null (the fix itself BLOCKED keeps the no-next face)", () => {
    expect(
      router.next(
        state([]),
        round({ phase: "fix", status: "BLOCKED", findings: [finding("blocker")] }),
      ),
    ).toBeNull();
  });
  it("a TIMEOUT round → null", () => {
    expect(router.next(state([]), round({ phase: "implement", status: "TIMEOUT" }))).toBeNull();
  });
});

describe("the pinned surface — Route/soft-cap constants (the brief's type-check checkable)", () => {
  it("the soft-cap constant is the literal 3 and the wording is stable", () => {
    expect(REVIEW_CYCLE_CAP).toBe(3);
    expect(SOFT_CAP_SUGGESTION).toBe("BLOCKED: review-cycle-cap — user adjudicates");
  });

  it("the soft-cap constants keep their literal types at compile time", () => {
    // Compile-time pins — this file fails under `tsc --noEmit` if either constant's
    // declared type drifts from the decision table's domain (cap == 3, verbatim wording).
    const cap: 3 = REVIEW_CYCLE_CAP;
    const wording: "BLOCKED: review-cycle-cap — user adjudicates" = SOFT_CAP_SUGGESTION;
    expect({ cap, wording }).toEqual({
      cap: 3,
      wording: "BLOCKED: review-cycle-cap — user adjudicates",
    });
  });

  it("the router is the single next-generation face — the exported signature is pinned", () => {
    const surface: (state: ExecutionState, ref: Round) => Route | null = (s, r) =>
      router.next(s, r);
    expect(surface(state([]), round({ phase: "review" }))).toEqual({ kind: "none" });
  });
});
