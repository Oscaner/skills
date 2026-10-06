// packages/cdd-engine/src/documents/doctypes/__tests__/effective-groups.test.ts — effectiveGroups:
// the SINGLE dispatch-group derivation, sourced from the TaskGraph wave batches over the plan's
// task data records (one wave per dispatch group). The edge fixture (T2 dependsOn[1] · T3 dependsOn[2]) yields the
// derived [["1"],["2"],["3"]] (one wave per depth); an edge-free plan yields the single root wave
// [["1,2,3"]] (same layer = same group); a broken edge model (missing-edge / forward-dependency / out-of-bounds
// / malformed non-integer) makes effectiveGroups THROW GraphViolationError (never a silently
// emitted order or a raw TaskGraph throw); task blocks out of ascending FILE order — a TaskGraph
// mis-map — fall back to the per-task singletons instead; and a plan whose blocks never declare
// the mandatory edge line (the marker-less / orphan block face) hits the missing-edge THROW too
// (the sixth failure class — the old silent-singleton face is gone).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { docTypeRegistry } from "../../registry.ts";
import { GraphViolationError } from "../body/task-graph.ts";
import type { PlanDocType } from "../plan.ts";

const HERE = import.meta.dirname; // …/documents/doctypes/__tests__
const EDGE_PLAN = path.join(HERE, "fixtures", "edge-plan.md");

const planType = (): PlanDocType => docTypeRegistry.resolve("plan") as PlanDocType;

/** Write a plan to a temp file and return its path (the doctype extractors read back the file). */
function planFile(body: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-effective-groups-"));
  const p = path.join(dir, "plan.md");
  writeFileSync(p, body);
  return p;
}

/** One new-shape task-record block (data markers only — the surface the graph derives over). */
function taskRecord(taskNum: number, edgeLine?: string): string {
  return [
    `### Task ${taskNum}: task ${taskNum}`,
    `- **Objective**: task ${taskNum}`,
    ...(edgeLine ? [edgeLine] : ["- **DependsOn**: none"]),
    "- **Steps**:",
    "  1. implement — checkable: done",
    "- **Acceptance**:",
    "  - done",
  ].join("\n");
}

/** The effective group keys of a temp plan file ([["1","2"],["3"]] → ["1,2","3"]). */
function groupKeys(p: string): string[] {
  return planType()
    .effectiveGroups(p)
    .map((g) => g.key());
}

/** The throw capture — returns the thrown value (null when the call succeeds). */
function capture(fn: () => unknown): unknown {
  try {
    fn();
    return null;
  } catch (err) {
    return err;
  }
}

describe("effectiveGroups — the wave-batch dispatch grouping", () => {
  it("a new-shape edge plan (T2 dependsOn[1], T3 dependsOn[2]) → the derived one-wave-per-depth group keys (one wave per depth)", () => {
    // the static edge fixture — the wave derivation over the plan's edge declarations.
    expect(readFileSync(EDGE_PLAN, "utf8")).toContain("- **DependsOn**:");
    expect(groupKeys(EDGE_PLAN)).toEqual(["1", "2", "3"]);
  });

  it("an edge-free new-shape plan → the single root wave [[1,2,3]] (同层 = 同组 — every no-dependency task joins the first-ready wave)", () => {
    const p = planFile([taskRecord(1), taskRecord(2), taskRecord(3)].join("\n\n"));
    try {
      expect(groupKeys(p)).toEqual(["1,2,3"]);
    } finally {
      rmSync(path.dirname(p), { recursive: true, force: true });
    }
  });

  it("a forward dependency (T1 dependsOn[3]) → effectiveGroups throws GraphViolationError (the contradiction verdict — the anti-dependency gate, aggregated in the message)", () => {
    const p = planFile(
      [taskRecord(1, "- **DependsOn**: 3"), taskRecord(2), taskRecord(3)].join("\n\n"),
    );
    try {
      const err = capture(() => planType().effectiveGroups(p));
      expect(err).toBeInstanceOf(GraphViolationError);
      expect((err as GraphViolationError).message).toContain("edge violation");
      expect((err as GraphViolationError).verdict.failures.map((f) => f.class)).toEqual([
        "contradiction",
      ]);
    } finally {
      rmSync(path.dirname(p), { recursive: true, force: true });
    }
  });

  it("a missing-edge plan (a block without its `- **DependsOn**:` line) → effectiveGroups throws GraphViolationError (missing-edge, the sixth class — the old silent-singleton face is gone)", () => {
    const p = planFile(
      [
        `### Task 1: task 1`,
        `- **Objective**: task 1`,
        "- **Steps**:",
        "  1. implement — checkable: done",
        "- **Acceptance**:",
        "  - done",
      ].join("\n"),
    );
    try {
      const err = capture(() => planType().effectiveGroups(p));
      expect(err).toBeInstanceOf(GraphViolationError);
      expect((err as GraphViolationError).verdict.failures.map((f) => f.class)).toEqual([
        "missing-edge",
      ]);
    } finally {
      rmSync(path.dirname(p), { recursive: true, force: true });
    }
  });

  it("an out-of-bounds edge (T2 dependsOn[99]) → effectiveGroups throws GraphViolationError (missing-id, never a silent order)", () => {
    const p = planFile(
      [taskRecord(1), taskRecord(2, "- **DependsOn**: 99"), taskRecord(3)].join("\n\n"),
    );
    try {
      const err = capture(() => planType().effectiveGroups(p));
      expect(err).toBeInstanceOf(GraphViolationError);
      const verdict = (err as GraphViolationError).verdict;
      expect(verdict.failures[0]!.class).toBe("missing-id");
      expect(verdict.failures[0]!.field).toBe("dependsOn");
      expect(verdict.failures[0]!.id).toBe(99);
    } finally {
      rmSync(path.dirname(p), { recursive: true, force: true });
    }
  });

  it("a malformed dependsOn value (`- **DependsOn**: foo` → NaN) → GraphViolationError (missing-id, never a raw throw)", () => {
    const p = planFile(
      [taskRecord(1), taskRecord(2, "- **DependsOn**: foo"), taskRecord(3)].join("\n\n"),
    );
    try {
      const err = capture(() => planType().effectiveGroups(p));
      expect(err).toBeInstanceOf(GraphViolationError);
      const verdict = (err as GraphViolationError).verdict;
      expect(verdict.failures).toHaveLength(1);
      expect(verdict.failures[0]!.class).toBe("missing-id");
      expect(verdict.failures[0]!.field).toBe("dependsOn");
      expect(verdict.failures[0]!.description).toContain("non-integer");
      // GraphFailure.id stays a real number — the declaring task id, never the NaN literal ("foo"
      // → NaN would serialize as null against the id's number contract).
      expect(verdict.failures[0]!.id).toBe(2);
      expect(Number.isInteger(verdict.failures[0]!.id)).toBe(true);
    } finally {
      rmSync(path.dirname(p), { recursive: true, force: true });
    }
  });

  it("an explicit `none` value parses to the empty edge list → the no-dependency wave (never a NaN rejection)", () => {
    const p = planFile(
      [taskRecord(1, "- **DependsOn**: none"), taskRecord(2), taskRecord(3)].join("\n\n"),
    );
    try {
      expect(groupKeys(p)).toEqual(["1,2,3"]);
    } finally {
      rmSync(path.dirname(p), { recursive: true, force: true });
    }
  });

  it("task blocks out of ascending FILE order → the singleton fallback (never a mis-mapped graph)", () => {
    const p = planFile(
      [taskRecord(2, "- **DependsOn**: 3"), taskRecord(1), taskRecord(3)].join("\n\n"),
    );
    try {
      expect(groupKeys(p)).toEqual(["1", "2", "3"]);
    } finally {
      rmSync(path.dirname(p), { recursive: true, force: true });
    }
  });

  it("a plan with orphan blocks (records with no data fields, no edge line) → the missing-edge THROW (the six-class BLOCK — the old per-task singleton run is retired)", () => {
    const p = planFile("# Plan\n\n### Task 1: a\nbody\n\n### Task 2: b\nbody\n");
    try {
      expect(capture(() => planType().effectiveGroups(p))).toBeInstanceOf(GraphViolationError);
    } finally {
      rmSync(path.dirname(p), { recursive: true, force: true });
    }
  });
});
