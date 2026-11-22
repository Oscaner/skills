// packages/cdd-engine/src-next/contract/__tests__/task-graph.test.ts
// P42 T5 — the two task-graph judgments and the Change-history order row (design spec
// §3.2 · §6). Three rows, one arm family each:
//
//   · `dangling-task-ref` — a `Consumes` / `Produces` row whose parenthesised `Task N`
//     marker names a task the plan does not declare. The marker's continuation shape
//     (`Task 2 · 3 · 4`) is judged id by id; a row with no marker is no candidate.
//   · `depends-on-cycle` — a `DependsOn` edge set forming a cycle in the GENERAL
//     directed graph. The verdict is never re-derived here: it is the graph's own
//     `TaskGraph.validate()` issue, injected with the ONE rendered detail line, so the
//     rule's message and the `graph` gate's `details` row are the same bytes.
//   · `change-history-newest-last` — the Change-history version sequence must be
//     monotonic. The id is historical; DIRECTION never enters the judgment, so both
//     corpus orders are legal and only a row that reverses the table is red.
//
// Zero module-level bare functions — the helpers are `const` (the repository's
// zero-`function`-declaration discipline).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type GraphIssue, TaskGraph } from "../../session/graph.ts";
import { PlanDocType } from "../doc.ts";
import { DanglingTaskRefInvariant, DependsOnCycleInvariant, type DocFs } from "../invariants.ts";
import { Contract } from "../judge.ts";

/** The hermetic filesystem seam — the graph rules read no file, while the sibling
 *  strategies on the same policy must not touch the real tree. */
const FS: DocFs = { exists: () => true, read: () => null, list: () => [] };

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** A plan document over `### Task N:` heading blocks (the corpus's own shape). */
const planDoc = (blocks: readonly (readonly string[])[]): string =>
  [
    "---",
    "title: Task Graph",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-11-22",
    "slug: x-p42",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    ...blocks.flat(),
  ].join("\n");

/** One task block with a declared `DependsOn` value and optional extra field sections. */
const task = (
  id: number,
  dependsOn: string,
  fields: readonly (readonly [string, readonly string[]])[] = [],
): readonly string[] => [
  `### Task ${id}: task ${id}`,
  "#### DependsOn",
  dependsOn,
  ...fields.flatMap(([key, lines]) => [`#### ${key}`, ...lines]),
];

/** A plan with a `## Change history` table over the given versions, in row order. */
const historyDoc = (versions: readonly string[]): string =>
  [
    "---",
    "title: Task Graph",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-11-22",
    "slug: x-p42",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    "### Task 1: task 1",
    "#### DependsOn",
    "none",
    "",
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    ...versions.map((version) => `| ${version} | 2026-11-22 | the row | [human] |`),
    "",
  ].join("\n");

/** The graph's own issues for one plan — the SAME call the `graph` gate makes. */
const issuesOf = (blocks: readonly (readonly string[])[]) =>
  new TaskGraph(new PlanDocType("plan").parse(planDoc(blocks).split("\n"))).validate();

/** Every finding of one kind over one document, judged through the real contract. */
const findingsOf = (
  kind: string,
  content: string,
  docKey: "plan" | "phase-spec" = "plan",
  graphIssues: readonly GraphIssue[] = [],
) =>
  new Contract()
    .validate({
      docKey,
      path: docKey === "plan" ? "docs/kairos/plans/x-p42.md" : "docs/kairos/specs/x-p42-design.md",
      content,
      root: "/repo",
      fs: FS,
      graphIssues: graphIssues.map((issue) => ({ ...issue, detail: TaskGraph.detailLine(issue) })),
    })
    .filter((finding) => finding.kind === kind);

describe("P42 §3.2 — dangling-task-ref", () => {
  it("reports a marker pointing at a task the plan does not declare", () => {
    const blocks = [task(1, "none", [["Consumes", ["- the artifact（Task 42）"]]])];
    const findings = findingsOf("dangling-task-ref", planDoc(blocks));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("task 42");
    expect(findings[0]?.field).toBe("Task 1");
    // the pair: the same row without the marker is no candidate
    const clean = [task(1, "none", [["Consumes", ["- the artifact"]]])];
    expect(findingsOf("dangling-task-ref", planDoc(clean))).toEqual([]);
  });

  it("reads `Produces` too, and judges every id in one marker group", () => {
    const blocks = [
      task(1, "none"),
      task(2, "none"),
      task(3, "none"),
      task(4, "none"),
      task(5, "none", [["Produces", ["- the row（Task 2 · 42 · 43）"]]]),
    ];
    const findings = findingsOf("dangling-task-ref", planDoc(blocks));
    expect(findings.map((finding) => finding.message)).toEqual([
      expect.stringContaining("task 42"),
      expect.stringContaining("task 43"),
    ]);
  });

  it("treats the bare continuation id and the repeated `Task` prefix as one verdict", () => {
    const blocks = [
      task(1, "none"),
      task(4, "none"),
      task(5, "none", [["Consumes", ["- the row（Task 4 · 42）"]]]),
    ];
    const bare = findingsOf("dangling-task-ref", planDoc(blocks));
    const prefixed = findingsOf(
      "dangling-task-ref",
      planDoc([
        task(1, "none"),
        task(4, "none"),
        task(5, "none", [["Consumes", ["- the row（Task 4 · Task 42）"]]]),
      ]),
    );
    expect(bare.map((finding) => finding.message)).toEqual(
      prefixed.map((finding) => finding.message),
    );
    expect(bare).toHaveLength(1);
    expect(bare[0]?.message).toContain("task 42");
  });

  it("never judges prose that merely mentions a task", () => {
    const blocks = [
      task(1, "none"),
      task(2, "none", [["Consumes", ["- Task 42 is discussed in the plan's prose"]]]),
    ];
    expect(findingsOf("dangling-task-ref", planDoc(blocks))).toEqual([]);
  });
});

describe("P42 §3.2 — depends-on-cycle", () => {
  it("reports the cycle at the lowest task in Kahn's remainder, in the gate's own bytes", () => {
    // tasks 1 and 2 carry no dependencies, so Kahn removes them first; the cycle
    // closes through 3 ↔ 7 and the remainder is exactly {3, 7}
    const blocks = [task(1, "none"), task(2, "none"), task(3, "7"), task(7, "3")];
    const issues = issuesOf(blocks);
    const cycle = issues.find((issue) => issue.kind === "cycle");
    expect(cycle?.task).toBe(3);
    const findings = findingsOf("depends-on-cycle", planDoc(blocks), "plan", issues);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toBe(
      "cycle@T3: a directed dependency cycle closes over task 3: task dependencies must form a DAG",
    );
    // the message IS the ONE assembly point's output — the graph gate's `details` row
    // prints these same bytes
    expect(findings[0]?.message).toBe(TaskGraph.detailLine(cycle!));
    // the pair: the same edges unchained into a chain are zero findings
    const chain = [task(1, "none"), task(2, "1"), task(3, "2"), task(7, "3")];
    expect(findingsOf("depends-on-cycle", planDoc(chain), "plan", issuesOf(chain))).toEqual([]);
  });

  it("names the remainder minimum even when it is NOT a cycle member", () => {
    // 1 depends on 9, 9 depends on 3, and 3 ↔ 7 close the cycle: the remainder is
    // {1, 3, 7, 9}, so the issue names task 1 — which is off the cycle
    const blocks = [task(1, "9"), task(2, "none"), task(3, "7"), task(7, "3"), task(9, "3")];
    const issues = issuesOf(blocks);
    expect(issues.find((issue) => issue.kind === "cycle")?.task).toBe(1);
    const findings = findingsOf("depends-on-cycle", planDoc(blocks), "plan", issues);
    expect(findings[0]?.message).toBe(
      "cycle@T1: a directed dependency cycle closes over task 1: task dependencies must form a DAG",
    );
  });

  it("reports nothing when the caller injects no graph fact", () => {
    const blocks = [task(1, "none"), task(3, "7"), task(7, "3")];
    expect(findingsOf("depends-on-cycle", planDoc(blocks))).toEqual([]);
  });

  it("keeps ONE author of the detail line — the template lives in session/graph.ts alone", () => {
    const graphSource = readFileSync(path.resolve(HERE, "..", "..", "session", "graph.ts"), "utf8");
    const preflightSource = readFileSync(
      path.resolve(HERE, "..", "..", "session", "preflight.ts"),
      "utf8",
    );
    // The template's ONE author: the scan looks for the two-token literal the assembly
    // point spells, assembled here from parts so this test carries no second copy.
    const TEMPLATE = ["@T", "${"].join("");
    expect(graphSource.split(TEMPLATE)).toHaveLength(2);
    expect(preflightSource).not.toContain(TEMPLATE);
    // the gate reads the one author, twice (its `details` row and the injected fact)
    expect(preflightSource.match(/TaskGraph\.detailLine\(/g)).toHaveLength(2);
  });
});

describe("P42 §6 — change-history-newest-last (the sequence is monotonic, direction is not judged)", () => {
  it("accepts both directions the corpus writes", () => {
    expect(findingsOf("change-history-newest-last", historyDoc(["v0.1", "v0.2", "v0.3"]))).toEqual(
      [],
    );
    expect(findingsOf("change-history-newest-last", historyDoc(["v0.3", "v0.2", "v0.1"]))).toEqual(
      [],
    );
  });

  it("reports one finding when a row reverses the sequence — and the pair restores it", () => {
    const reversed = findingsOf("change-history-newest-last", historyDoc(["v0.3", "v0.1", "v0.2"]));
    expect(reversed).toHaveLength(1);
    expect(reversed[0]?.field).toBe("Change history");
    expect(reversed[0]?.message).toContain("reverses the table's direction");
    // the pair: restoring the swapped rows (one row's position, direction untouched)
    // returns the table to zero findings
    expect(findingsOf("change-history-newest-last", historyDoc(["v0.3", "v0.2", "v0.1"]))).toEqual(
      [],
    );
  });

  it("is zero candidate on a document with no Change-history table", () => {
    expect(findingsOf("change-history-newest-last", planDoc([task(1, "none")]))).toEqual([]);
  });
});

describe("P42 §3.2 — the two task-graph judgments are two classes, two names", () => {
  it("answers its own id from each class, so neither report borrows the other's word", () => {
    expect(new DanglingTaskRefInvariant().name).toBe("dangling-task-ref");
    expect(new DependsOnCycleInvariant().name).toBe("depends-on-cycle");
  });
});
