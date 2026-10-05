// packages/cdd-engine/src/documents/doctypes/body/__tests__/task-graph.test.ts — TaskGraph: the
// plan-wide single grouping derivation. Groups are the atomic-closure connected
// components (atomicWith = undirected symmetric edges → transitive closure), ordered by a
// topological order of the component DAG (dependsOn edges between components; ties ordered by the
// group's smallest task number ascending). `validate()` carries the five-failure-class BLOCK face
// (missing-id / self-loop / contradiction / cycle / duplicate) — each fixture below hits EXACTLY
// its target class, and `groups()` validates first: a non-null verdict throws GraphViolationError
// instead of silently emitting an order. The edge-field parse (parseTaskBlock reading the
// `- **DependsOn**:` / `- **AtomicWith**:` lines) closes the read/write activation acceptance.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { docTypeRegistry } from "../../../registry.ts";
import type { PlanDocType } from "../../plan.ts";
import { Task } from "../task.ts";
import { GraphViolationError, TaskGraph } from "../task-graph.ts";

/** Build one task record at position `index` (index+1 = the task id — the constructor contract:
 *  tasks arrive in `### Task N:` ascending order). */
function task(opts: { dependsOn?: number[]; atomicWith?: number[] } = {}): Task {
  return new Task({
    objective: "task",
    files: [],
    interface: { consumes: [], produces: [] },
    steps: [],
    acceptance: [],
    dependsOn: opts.dependsOn,
    atomicWith: opts.atomicWith,
  });
}

/** The derived groups as plain number arrays — the brief's `[[1],[2],[3]]` form. */
function groupNumbers(tasks: Task[]): number[][] {
  return new TaskGraph(tasks).groups().map((g) => [...g.numbers]);
}

/** The failure classes of one verdict — the "exact class set" assertion surface. */
function classes(verdict: NonNullable<ReturnType<TaskGraph["validate"]>>): string[] {
  return verdict.failures.map((f) => f.class);
}

describe("TaskGraph — the atomic-closure grouping derivation", () => {
  it("the atomic closure spans the connected component — T2∿1 ∧ T3∿2 → one group [1,2,3]", () => {
    const graph = new TaskGraph([task(), task({ atomicWith: [1] }), task({ atomicWith: [2] })]);
    expect(graph.validate()).toBeNull();
    expect(groupNumbers([task(), task({ atomicWith: [1] }), task({ atomicWith: [2] })])).toEqual([
      [1, 2, 3],
    ]);
  });

  it("an edge-free plan yields the full singleton run [[1],[2],[3]]", () => {
    const graph = new TaskGraph([task(), task(), task()]);
    expect(graph.validate()).toBeNull();
    expect(groupNumbers([task(), task(), task()])).toEqual([[1], [2], [3]]);
  });

  it("a dependsOn chain groups in topological order — T2→1, T3→2 → [[1],[2],[3]]", () => {
    expect(groupNumbers([task(), task({ dependsOn: [1] }), task({ dependsOn: [2] })])).toEqual([
      [1],
      [2],
      [3],
    ]);
  });

  it("a fan-out keeps the tie order by smallest task number — T2→1, T3→1 → [[1],[2],[3]]", () => {
    expect(groupNumbers([task(), task({ dependsOn: [1] }), task({ dependsOn: [1] })])).toEqual([
      [1],
      [2],
      [3],
    ]);
  });
});

describe("TaskGraph — the five-failure-class validate BLOCK (each fixture hits exactly its class)", () => {
  it("an out-of-bounds edge → only missing-id (T2 dependsOn[99])", () => {
    const graph = new TaskGraph([task(), task({ dependsOn: [99] }), task()]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["missing-id"]);
    expect(verdict!.failures[0]!.field).toBe("dependsOn");
    expect(verdict!.failures[0]!.id).toBe(99);
    // a non-null verdict blocks groups() — no silent order for a broken graph.
    expect(() => graph.groups()).toThrow(GraphViolationError);
  });

  it("target == the declaring task → only self-loop (T2 dependsOn[2])", () => {
    const graph = new TaskGraph([task(), task({ dependsOn: [2] }), task()]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["self-loop"]);
    expect(verdict!.failures[0]!.field).toBe("dependsOn");
    expect(verdict!.failures[0]!.id).toBe(2);
  });

  it("a same-pair atomic∧depends declaration → only contradiction (T1 atomicWith[2] + dependsOn[2])", () => {
    const graph = new TaskGraph([task({ atomicWith: [2], dependsOn: [2] }), task()]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["contradiction"]);
    expect(verdict!.failures[0]!.field).toBe("dependsOn");
    expect(verdict!.failures[0]!.id).toBe(2);
  });

  it("a reverse-rank edge (bounded, non-self, no atomic pair) → contradiction is still its class", () => {
    // The bounded edge points at a HIGHER-numbered task — task 1 dependsOn[3] over three tasks — the
    // reverse-rank (rank(dependent) < rank(reference)) judgment, emitted as a contradiction.
    const graph = new TaskGraph([task({ dependsOn: [3] }), task(), task()]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["contradiction"]);
  });

  it("a component-DAG cycle with no reverse-rank / intra-component edge → only cycle", () => {
    // Components {1,4} and {2,3} reference each other — a cross-component 2-cycle with every
    // individual edge forward-ranked (T3→1, T4→2): the atomic groupings themselves create the
    // cycle, so only `cycle` fires.
    const graph = new TaskGraph([
      task({ atomicWith: [4] }),
      task({ atomicWith: [3] }),
      task({ dependsOn: [1] }),
      task({ dependsOn: [2] }),
    ]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["cycle"]);
    expect(verdict!.failures[0]!.field).toBe("dependsOn");
    // the cycle's id is the smallest task id trapped in the leftover (cycle) subgraph — task 1.
    expect(verdict!.failures[0]!.id).toBe(1);
    expect(() => graph.groups()).toThrow(GraphViolationError);
  });

  it("a value repeated within one field list → only duplicate (T1 atomicWith[2,2])", () => {
    const graph = new TaskGraph([task({ atomicWith: [2, 2] }), task()]);
    const verdict = graph.validate();
    expect(verdict).not.toBeNull();
    expect(classes(verdict!)).toEqual(["duplicate"]);
    expect(verdict!.failures[0]!.field).toBe("atomicWith");
    expect(verdict!.failures[0]!.id).toBe(2);
  });
});

describe("the edge-field parse — parseTaskBlock reads the DependsOn / AtomicWith lines", () => {
  /** Write a minimal plan with two blocks (a new-shape one + a legacy `- **Do**:` one) and return
   *  the parsed Task records — the dual-read contract stays: the legacy block yields no record. */
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
          "- **AtomicWith**: 4, 5",
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

  it("`- **DependsOn**: 3, 5` / `- **AtomicWith**: 4, 5` land as number[] on the Task record", () => {
    const tasks = parsed();
    expect(tasks).toHaveLength(1); // the legacy Do block carries no data markers → no record
    expect(tasks[0]!.dependsOn).toEqual([3, 5]);
    expect(tasks[0]!.atomicWith).toEqual([4, 5]);
  });
});
