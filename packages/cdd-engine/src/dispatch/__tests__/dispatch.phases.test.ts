// packages/cdd-engine/src/dispatch/__tests__/dispatch.phases.test.ts
// PHASES is the data-ized declaration of the three lifecycle phases in execution order, each
// with its responsibility, its step mount points, and the commit gate anchored to it. These
// tests pin the enum, the order, the responsibilities, the step mounts, and the gate anchoring
// — the parts Task 7 (dispatch/base.ts) will drive the template method from.
import { it, expect } from "vitest";

import {
  PHASES, PHASE_IDS, PHASES_BY_ID, type PhaseId,
  BRANCH_PHASES, BRANCH_PHASE_IDS, type BranchPhaseId,
} from "../phases.ts";

it("PHASE_IDS enumerates the three phases in execution order", () => {
  expect(PHASE_IDS).toEqual(["pre-flight", "dispatch", "post-flight"]);
});

it("PHASES follows PHASE_IDS order and ids are unique", () => {
  const ids = PHASES.map((p) => p.id);
  expect(ids).toEqual([...PHASE_IDS]);
  expect(new Set(ids).size).toBe(ids.length);
});

it("every phase carries a responsibility note and ordered step mount points", () => {
  for (const phase of PHASES) {
    expect(phase.responsibility.trim().length).toBeGreaterThan(0);
    expect(phase.steps.length).toBeGreaterThan(0);
    for (const step of phase.steps) {
      expect(step.id.trim().length).toBeGreaterThan(0);
      expect(step.title.trim().length).toBeGreaterThan(0);
    }
  }
});

it("commit gates anchor on the phase boundaries: enter on pre-flight, exit on post-flight, none mid-dispatch", () => {
  const byId = (id: PhaseId) => PHASES.find((p) => p.id === id)!;
  expect(byId("pre-flight").commitGate).toBe("enter");
  expect(byId("dispatch").commitGate).toBeUndefined();
  expect(byId("post-flight").commitGate).toBe("exit");
});

it("pre-flight exposes the entry-gate step set and post-flight the exit-gate step set (spec §2.12 step column)", () => {
  const byId = (id: PhaseId) => PHASES.find((p) => p.id === id)!;
  const preFlight = byId("pre-flight").steps.map((s) => s.id);
  expect(preFlight).toContain("1");
  expect(preFlight).toContain("2.5");
  expect(preFlight).toContain("6");
  const postFlight = byId("post-flight").steps.map((s) => s.id);
  expect(postFlight).toContain("8.5");
  expect(postFlight).toContain("8.8");
  expect(postFlight).toContain("13.5");
});

it("dispatch is the agent-session black box: prompt rendering + spawn only", () => {
  const dispatchPhase = PHASES.find((p) => p.id === "dispatch")!;
  expect(dispatchPhase.steps.map((s) => s.id)).toEqual(["7", "8"]);
});

it("PHASES_BY_ID round-trips every phase", () => {
  for (const phase of PHASES) {
    expect(PHASES_BY_ID[phase.id]).toBe(phase);
  }
  expect(Object.keys(PHASES_BY_ID)).toEqual([...PHASE_IDS]);
});

// ---- branch stage table (Task 9; spec E2①) ----
// BRANCH_PHASES is the data-ized declaration of the branch-level review→fix loop. Its Stopping
// ref is a COMMIT RANGE (BASE..HEAD), not a doc_hash — pins the two stages' identities and the
// ref-move law (fix commits the range changes → re-review is a NEW review).

it("BRANCH_PHASE_IDS enumerates the branch loop stages in execution order (review → fix)", () => {
  expect(BRANCH_PHASE_IDS).toEqual(["branch-review", "branch-fix"]);
});

it("every branch stage carries id/phase/role/family/stopping with non-empty content", () => {
  for (const stage of BRANCH_PHASES) {
    expect(BRANCH_PHASE_IDS).toContain(stage.id);
    expect(stage.phase.length).toBeGreaterThan(0);
    expect(stage.role.length).toBeGreaterThan(0);
    expect(stage.family.length).toBeGreaterThan(0);
    expect(stage.stopping.length).toBeGreaterThan(0);
  }
  expect(BRANCH_PHASES.map((p) => p.id)).toEqual([...BRANCH_PHASE_IDS]);
});

it("branch stages map to the canonical families, review carries phase branch-review, fix carries phase fix", () => {
  const byId = (id: BranchPhaseId) => BRANCH_PHASES.find((p) => p.id === id)!;
  const review = byId("branch-review");
  expect(review.phase).toBe("branch-review");
  expect(review.role).toMatch(/review family/i);
  expect(review.family).toBe("review.branch");
  const fix = byId("branch-fix");
  // The fix handoff's schema phase value is "fix" (schema enum: implement/review/fix/branch-review) —
  // not "branch-fix" (that's the loop-stage id).
  expect(fix.phase).toBe("fix");
  expect(fix.role).toMatch(/work type/i);
  expect(fix.family).toBe("fix.branch");
});

it("branch Stopping = BASE..HEAD commit range; the fix moves the ref → re-review is legal", () => {
  const byId = (id: BranchPhaseId) => BRANCH_PHASES.find((p) => p.id === id)!;
  const review = byId("branch-review");
  expect(review.stopping).toMatch(/BASE\.\.HEAD/);
  const fix = byId("branch-fix");
  expect(fix.stopping).toMatch(/re-review|new review/i);
  expect(fix.stopping).toMatch(/moves|moving HEAD/i);
});
