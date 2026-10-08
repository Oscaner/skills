// packages/cdd-engine/src-next/session/__tests__/graph.test.ts
// T6 TaskGraph + ExecutionState suite (design spec §3.1):
//   · the shared parse consumption — the graph is built from the SAME doc.ts plan
//     parse instance the dispatch and the lint read (never a re-parse);
//   · the six validate classes — missing-edge / duplicate / missing-id /
//     self-loop / contradiction / cycle, one negative fixture each, plus the
//     anti-dependency gate (a forward DependsOn edge is a contradiction);
//   · batches() — the topological wave decomposition, plus the halt-safe window
//     when a dependency can never be satisfied;
//   · frontier(done) — the pure dynamic readiness face;
//   · ExecutionState — doneTasks() / readyBatch()/markDone as TaskGraph methods
//     (the query surface, not a standalone state class).
// Fixtures are plan literals parsed through the plan parser — hermetic.

import { describe, expect, it } from "vitest";
import { PlanDocType } from "../../contract/doc.ts";
import type { GraphIssue } from "../graph.ts";
import { TaskGraph } from "../graph.ts";

/** A plan document over `### Task N:` blocks + `- **DependsOn**:` values. */
function planDoc(blocks: readonly (readonly string[])[]): string {
  return [
    "# Test Plan",
    "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
    "- **Parent program**: [x-overall.md v1.0](docs/kairos/specs/x-overall.md)",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    ...blocks.flat(),
  ].join("\n");
}

/** One task block with an optional `- **DependsOn**:` line (null = the field is absent). */
function task(id: number, dependsOn: string | null): readonly string[] {
  return [
    `### Task ${id}: task ${id}`,
    dependsOn === null ? [] : [`- **DependsOn**: ${dependsOn}`],
  ].flat();
}

/** Parse a fixture through the plan parser (the dispatch's parse home) and build the graph. */
function graphOf(lines: readonly (readonly string[])[]): TaskGraph {
  return new TaskGraph(new PlanDocType("plan").parse(planDoc(lines).split("\n")));
}

const kindsOf = (issues: readonly GraphIssue[]): readonly string[] =>
  issues.map((issue) => issue.kind);

describe("the shared doc.ts parse consumption", () => {
  it("builds nodes and edges from the same parse instance the dispatch reads — no re-parse", () => {
    const parsed = new PlanDocType("plan").parse(
      planDoc([task(1, "none"), task(2, "1"), task(3, "1, 2")]).split("\n"),
    );
    expect(parsed.taskBlocks.map((block) => block.id)).toEqual([1, 2, 3]);
    const graph = new TaskGraph(parsed);
    expect(graph.validate()).toEqual([]);
    expect(graph.batches()).toEqual([[1], [2], [3]]);
  });

  it("parses the brief's own comma forms (`3,4`, `1, 2`) as edge values", () => {
    const graph = graphOf([
      task(1, "none"),
      task(2, "none"),
      task(3, "none"),
      task(4, "1, 2"),
      task(5, "3,4"),
    ]);
    expect(graph.validate()).toEqual([]);
    expect(graph.batches()).toEqual([[1, 2, 3], [4], [5]]);
  });
});

describe("the six validate classes — one negative fixture each", () => {
  it("missing-edge — a task block declaring no **DependsOn** field", () => {
    const graph = graphOf([task(1, "none"), task(2, null)]);
    const issues = graph.validate();
    expect(kindsOf(issues)).toEqual(["missing-edge"]);
    expect(issues[0]!.task).toBe(2);
  });

  it("duplicate — the same dependency id declared twice in one block's edge", () => {
    const graph = graphOf([task(1, "none"), task(2, "1, 1")]);
    const issues = graph.validate();
    expect(kindsOf(issues)).toEqual(["duplicate"]);
    expect(issues[0]!.task).toBe(2);
  });

  it("missing-id — an edge references a task id absent from the plan (the gap case stays forward-clean)", () => {
    const graph = graphOf([task(1, "none"), task(3, "2")]); // 2 is a gap — backward, still unregistered
    const issues = graph.validate();
    expect(kindsOf(issues)).toEqual(["missing-id"]);
    expect(issues[0]!.task).toBe(3);
  });

  it("self-loop — a task depends on itself", () => {
    const graph = graphOf([task(1, "none"), task(2, "1"), task(3, "3")]);
    const issues = graph.validate();
    expect(kindsOf(issues)).toEqual(["self-loop"]);
    expect(issues[0]!.task).toBe(3);
  });

  it("a forward reference is legal — the anti-dependency gate is retired (T24)", () => {
    const graph = graphOf([task(1, "2"), task(2, "none")]);
    expect(graph.validate()).toEqual([]); // 1→2 forward edge — no contradiction class
    expect(graph.batches()).toEqual([[2], [1]]);
  });

  it("the edge value-domain truncation — a trailing parenthetical's numbers never join the edge (§3.8)", () => {
    // the plan's DependsOn lines may carry a rationale in parens (`…（升序 24 殿后…）`);
    // the extraction reads only the pre-paren list — no duplicate/self-loop from prose
    const graph = graphOf([task(1, "none"), task(2, "1（prose 2 here）")]);
    expect(graph.validate()).toEqual([]);
    expect(graph.batches()).toEqual([[1], [2]]);
  });

  it("cycle — a directed dependency cycle among the declared edges", () => {
    const graph = graphOf([task(1, "2"), task(2, "1")]); // 1 ⇄ 2
    const issues = graph.validate();
    expect(kindsOf(issues)).toContain("cycle"); // no contradiction class — the forward edge is legal now
  });

  it("a conforming plan validates clean — zero false positives", () => {
    const graph = graphOf([task(1, "none"), task(2, "1"), task(3, "1, 2")]);
    expect(graph.validate()).toEqual([]);
  });

  it("a malformed edge value carries no edge — the whole-token token domain shared with the lint refuses `1.2`", () => {
    const graph = graphOf([task(1, "none"), task(2, "1.2"), task(3, "2")]);
    expect(graph.validate()).toEqual([]); // no edge parsed out of "1.2"
    expect(graph.batches()).toEqual([[1, 2], [3]]); // task 2 joins the no-dependency wave
  });
});

describe("batches() — the topological wave decomposition", () => {
  it("decomposes a fan-in plan into readiness waves", () => {
    const graph = graphOf([
      task(1, "none"),
      task(2, "none"),
      task(3, "1"),
      task(4, "1, 2"),
      task(5, "3, 4"),
    ]);
    expect(graph.batches()).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("decomposes a linear chain one task at a time", () => {
    const graph = graphOf([task(1, "none"), task(2, "1"), task(3, "2"), task(4, "3")]);
    expect(graph.batches()).toEqual([[1], [2], [3], [4]]);
  });

  it("a dependency that can never be satisfied stays unwaved — the halt-safe window (batch derivation does not recurse)", () => {
    const graph = graphOf([task(1, "none"), task(2, "5"), task(3, "1")]); // 5 is a phantom
    expect(graph.batches()).toEqual([[1], [3]]); // task 2 never becomes ready — safely left out
  });

  it("an empty plan decomposes to zero waves", () => {
    expect(graphOf([]).batches()).toEqual([]);
  });
});

describe("frontier(done) — the pure dynamic readiness face", () => {
  const chain = () => graphOf([task(1, "none"), task(2, "1"), task(3, "2"), task(4, "3")]);

  it("returns the first no-dependency wave from an empty done set", () => {
    expect(chain().frontier(new Set())).toEqual([1]);
  });

  it("opens the next task once its dependencies complete", () => {
    expect(chain().frontier(new Set([1]))).toEqual([2]);
    expect(chain().frontier(new Set([1, 2]))).toEqual([3]);
    expect(chain().frontier(new Set([1, 2, 3]))).toEqual([4]);
  });

  it("excludes done tasks and tolerates unknown / already-done ids", () => {
    const graph = chain();
    expect(graph.frontier(new Set([1, 2, 3, 4]))).toEqual([]);
    expect(graph.frontier(new Set([0, 99]))).toEqual([1]);
  });

  it("never mutates the caller's done set", () => {
    const done = new Set<number>([1]);
    chain().frontier(done);
    expect(done).toEqual(new Set([1]));
  });
});

describe("ExecutionState — the query surface as TaskGraph methods", () => {
  const chain = () => graphOf([task(1, "none"), task(2, "1"), task(3, "2"), task(4, "3")]);

  it("starts empty — doneTasks() is the empty set and readyBatch() the seed wave", () => {
    const graph = chain();
    expect(graph.doneTasks()).toEqual(new Set());
    expect(graph.readyBatch()).toEqual([1]);
  });

  it("progresses the run — doneTasks()/readyBatch() track markDone()", () => {
    const graph = chain();
    graph.markDone(1);
    expect(graph.doneTasks()).toEqual(new Set([1]));
    expect(graph.readyBatch()).toEqual([2]);
    graph.markDone(2);
    graph.markDone(3);
    expect(graph.doneTasks()).toEqual(new Set([1, 2, 3]));
    expect(graph.readyBatch()).toEqual([4]);
    graph.markDone(4);
    expect(graph.readyBatch()).toEqual([]);
  });

  it("ignores duplicate and unregistered markDone calls", () => {
    const graph = chain();
    graph.markDone(1);
    graph.markDone(1);
    graph.markDone(42);
    expect(graph.doneTasks()).toEqual(new Set([1]));
    expect(graph.readyBatch()).toEqual([2]);
  });

  it("doneTasks() returns a snapshot — mutating the result never touches the run state", () => {
    const graph = chain();
    graph.markDone(1);
    graph.doneTasks().add(2);
    expect(graph.doneTasks()).toEqual(new Set([1]));
    expect(graph.readyBatch()).toEqual([2]);
  });

  it("readyBatch() equals the batches() wave at the matching completion point", () => {
    const graph = graphOf([
      task(1, "none"),
      task(2, "none"),
      task(3, "1"),
      task(4, "1, 2"),
      task(5, "3, 4"),
    ]);
    const waves = graph.batches();
    expect(graph.readyBatch()).toEqual(waves[0]);
    graph.markDone(1);
    graph.markDone(2);
    expect(graph.readyBatch()).toEqual(waves[1]);
    graph.markDone(3);
    graph.markDone(4);
    expect(graph.readyBatch()).toEqual(waves[2]);
  });
});
