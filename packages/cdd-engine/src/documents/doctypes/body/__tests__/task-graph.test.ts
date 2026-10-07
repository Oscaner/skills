// packages/cdd-engine/src/documents/doctypes/body/__tests__/task-graph.test.ts — TaskGraph: the
// plan-wide single edge-model derivation (P3.1 T3 — the unilateral rebuild). Groups are the WAVES
// (`- **DependsOn**:` is the only directed edge): `validate()` carries the six-failure-class BLOCK
// face (missing-edge · missing-id · self-loop · contradiction (the anti-dependency gate) · cycle ·
// duplicate), and `batches()` derives the wave decomposition (each wave = a ready layer, ascending
// task numbers). Each fixture below hits EXACTLY its target class — a cycle can never be isolated
// under the anti-dependency gate (every legal edge strictly decreases, so a cycle needs a forward
// edge — which the gate already breaks; the sweep's surviving edges stay a legal DAG), so the
// cycle class stays the crisp set's defensive member, documented here rather than pinned. The
// edge-line parse (parseTaskBlock reading the `- **DependsOn**:` line — `none`/empty → `[]`, a
// missing line → the missing-edge fact) closes the read/write activation acceptance.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { docTypeRegistry } from "../../../registry.ts";
import type { PlanDocType } from "../../plan.ts";
import { Task } from "../task.ts";
import { GraphViolationError, TaskGraph } from "../task-graph.ts";

/** Build one task record at position `index` (index+1 = the task id — the constructor contract:
 *  tasks arrive in `### Task N:` ascending order). A task declares its `- **DependsOn**:` edge by
 *  default (hasDependsOn — the line-present state); pass `hasDependsOn: false` to model a block
 *  whose edge line is missing (the missing-edge BLOCK face). */
function task(opts: { dependsOn?: number[]; hasDependsOn?: boolean } = {}): Task {
  return new Task({
    objective: "task",
    files: [],
    interface: { consumes: [], produces: [] },
    steps: [],
    acceptance: [],
    dependsOn: opts.dependsOn ?? [],
    hasDependsOn: opts.hasDependsOn ?? true,
  });
}

/** The derived batches as plain number arrays — the wave decomposition surface. */
function batches(tasks: Task[]): number[][] {
  return new TaskGraph(tasks).batches().map((b) => [...b]);
}

/** The failure classes of one verdict — the "exact class set" assertion surface. */
function classes(verdict: NonNullable<ReturnType<TaskGraph["validate"]>>): string[] {
  return verdict.failures.map((f) => f.class);
}

describe("TaskGraph — the wave derivation (batches)", () => {
  it("an edge-free plan (every block declares its none edge) yields the single root wave [[1,2,3]] — 同层 = 同组", () => {
    const graph = new TaskGraph([task(), task(), task()]);
    expect(graph.validate()).toBeNull();
    expect(batches([task(), task(), task()])).toEqual([[1, 2, 3]]);
  });

  it("a dependsOn chain decomposes into one wave per depth — T1 ← T2 ← T3 → [[1],[2],[3]]", () => {
    expect(batches([task(), task({ dependsOn: [1] }), task({ dependsOn: [2] })])).toEqual([
      [1],
      [2],
      [3],
    ]);
  });

  it("the P3.1 schedule T1→T2→{T3,T4,T5}→T6→T7 derives the five waves [[1],[2],[3,4,5],[6],[7]] (DependsOn 1–6 per plan v1.10)", () => {
    const graph = [
      task(),
      task({ dependsOn: [1] }),
      task({ dependsOn: [2] }),
      task({ dependsOn: [2] }),
      task({ dependsOn: [2] }),
      task({ dependsOn: [3] }),
      task({ dependsOn: [1, 2, 3, 4, 5, 6] }),
    ];
    expect(batches(graph)).toEqual([[1], [2], [3, 4, 5], [6], [7]]);
  });

  it("a fan-out keeps the wave's ascending task order — T2→T1, T3→T1, T4→T2 → [[1],[2,3],[4]]", () => {
    expect(
      batches([
        task(),
        task({ dependsOn: [1] }),
        task({ dependsOn: [1] }),
        task({ dependsOn: [2] }),
      ]),
    ).toEqual([[1], [2, 3], [4]]);
  });

  it("batches() throws GraphViolationError on a broken graph (never a silent order)", () => {
    expect(() => new TaskGraph([task({ hasDependsOn: false }), task()]).batches()).toThrow(
      GraphViolationError,
    );
  });
});

describe("TaskGraph — the six-failure-class validate BLOCK (each fixture hits exactly its class)", () => {
  it("a block without its `- **DependsOn**:` line → only missing-edge (the sixth failure class)", () => {
    const graph = new TaskGraph([task({ hasDependsOn: false }), task(), task()]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["missing-edge"]);
    expect(verdict!.failures[0]!.field).toBe("dependsOn");
    expect(verdict!.failures[0]!.id).toBe(1);
    // a non-null verdict blocks batches() — no silent order for a broken graph.
    expect(() => graph.batches()).toThrow(GraphViolationError);
  });

  it("an out-of-bounds edge → only missing-id (T2 dependsOn[99])", () => {
    const graph = new TaskGraph([task(), task({ dependsOn: [99] }), task()]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["missing-id"]);
    expect(verdict!.failures[0]!.field).toBe("dependsOn");
    expect(verdict!.failures[0]!.id).toBe(99);
  });

  it("target == the declaring task → only self-loop (T2 dependsOn[2])", () => {
    const graph = new TaskGraph([task(), task({ dependsOn: [2] }), task()]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["self-loop"]);
    expect(verdict!.failures[0]!.field).toBe("dependsOn");
    expect(verdict!.failures[0]!.id).toBe(2);
  });

  it("a forward reference (bounded, higher-numbered) → only contradiction — the anti-dependency gate (T1 dependsOn[3])", () => {
    const graph = new TaskGraph([task({ dependsOn: [3] }), task(), task()]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["contradiction"]);
    expect(verdict!.failures[0]!.field).toBe("dependsOn");
    expect(verdict!.failures[0]!.id).toBe(3);
  });

  it("a forward-dependency 2-cycle (T1 dependsOn[2] + T2 dependsOn[1]) reports ONLY the anti-dep contradiction — the broken forward edge leaves the surviving backward edge a legal DAG, so cycle never fires", () => {
    // Every legal edge strictly decreases under the anti-dependency gate, so a cycle needs a
    // forward edge — which the per-declaration gate already breaks. The cycle class stays the
    // crisp set's defensive member (reachable only by a directly-constructed graph the gate cannot
    // fully break — documented, never pinned as an isolated fixture).
    const graph = new TaskGraph([task({ dependsOn: [2] }), task({ dependsOn: [1] })]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["contradiction"]);
  });

  it("a value repeated within the list → only duplicate (T2 dependsOn[1,1])", () => {
    const graph = new TaskGraph([task(), task({ dependsOn: [1, 1] }), task()]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["duplicate"]);
    expect(verdict!.failures[0]!.field).toBe("dependsOn");
    expect(verdict!.failures[0]!.id).toBe(1);
  });
});

describe("the edge-line parse — parseTaskBlock reads the DependsOn line (`none`/empty → `[]`, missing → the missing-edge fact)", () => {
  /** Write a minimal plan with two blocks (a data-shaped one + a legacy `- **Do**:` one) and return
   *  the parsed Task records — the single-form grammar parses EVERY block: the legacy block yields
   *  an empty orphan record (a validate failure, never a silently dropped block). */
  function parsed(): Task[] {
    const dir = mkdtempSync(path.join(tmpdir(), "task-graph-parse-"));
    try {
      const plan = path.join(dir, "edge-plan.md");
      writeFileSync(
        plan,
        [
          "# Edge plan",
          "",
          "### Task 1:",
          "- **Objective**: first",
          "- **DependsOn**: 3, 5",
          "- **Acceptance**:",
          "  - done",
          "",
          "### Task 2:",
          "- **Do**: legacy action",
          "",
        ].join("\n"),
      );
      return (docTypeRegistry.resolve("plan") as PlanDocType).tasksFromPlan(plan);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("`- **DependsOn**: 3, 5` lands as number[] on the Task record with the line-present fact (the Do block parses to an empty orphan record — hasDependsOn false)", () => {
    const tasks = parsed();
    expect(tasks).toHaveLength(2); // every block parses a record — the Do block is an orphan (empty)
    expect(tasks[0]!.dependsOn).toEqual([3, 5]);
    expect(tasks[0]!.hasDependsOn).toBe(true);
    expect(tasks[1]!.objective).toBe("");
    expect(tasks[1]!.steps).toEqual([]);
    expect(tasks[1]!.hasDependsOn).toBe(false);
  });

  it("`none`/empty → `[]` with the line-present fact; the missing-edge fact is per-block", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "task-graph-none-"));
    try {
      const plan = path.join(dir, "none-plan.md");
      writeFileSync(
        plan,
        [
          "### Task 1:",
          "- **Objective**: first",
          "- **DependsOn**: none",
          "",
          "### Task 2:",
          "- **Objective**: second",
          "- **DependsOn**:",
          "",
          "### Task 3:",
          "- **Objective**: third",
          "",
        ].join("\n"),
      );
      const tasks = (docTypeRegistry.resolve("plan") as PlanDocType).tasksFromPlan(plan);
      expect(tasks[0]!.dependsOn).toEqual([]);
      expect(tasks[0]!.hasDependsOn).toBe(true);
      expect(tasks[1]!.dependsOn).toEqual([]);
      expect(tasks[1]!.hasDependsOn).toBe(true);
      expect(tasks[2]!.dependsOn).toEqual([]);
      expect(tasks[2]!.hasDependsOn).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
