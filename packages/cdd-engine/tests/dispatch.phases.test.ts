// tests/dispatch.phases.test.ts — Task 6 dispatch lifecycle phase table (spec §2.12 第一部分).
// PHASES is the data-ized declaration of the three lifecycle phases in execution order, each
// with its responsibility, its step mount points, and the commit gate anchored to it. These
// tests pin the enum, the order, the responsibilities, the step mounts, and the gate anchoring
// — the parts Task 7 (dispatch/base.ts) will drive the template method from.
import { it, expect } from "vitest";

import { PHASES, PHASE_IDS, PHASES_BY_ID, type PhaseId } from "../src/dispatch/phases.ts";

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