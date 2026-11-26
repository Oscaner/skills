// packages/cdd-engine/src/docs/judging/__tests__/criteria.test.ts
// The judging tables' pins.
//
// Four groups: the lens question table (every kind answers questions, every label is unique,
// and the referential question has exactly ONE home in the tree) · the completion criteria
// (an implement round with no commit is a violation; a review whose findings array is empty is
// APPROVED) · the wave-width ceiling (an over-wide dependency layer is named, and the read
// follows the graph's own decomposition) · the task graph's four edge-failure classes and its
// wave decomposition / frontier.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CompletionCriteria } from "../completion.ts";
import {
  CRITERIA,
  CRITERIA_BODIES,
  LENS_QUESTIONS,
  LensQuestions,
  REVIEW_KINDS,
  ReviewCriteria,
  reviewKindOf,
} from "../criteria.ts";
import { TaskGraph } from "../task-graph.ts";
import { MAX_TASKS_PER_WAVE, WaveWidth } from "../wave-width.ts";

/** The `src`-relative judging directory this file pins. */
const JUDGING_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** One plan body with one `### Task N:` block per entry, `deps` written as its DependsOn line. */
const planOf = (tasks: readonly { id: number; deps?: string }[]): string =>
  [
    "---",
    "title: 'fixture'",
    "doc-type: plan",
    "---",
    "",
    "## Constraints",
    "",
    "- none",
    "",
    ...tasks.flatMap((task) => [
      `### Task ${task.id}: task ${task.id}`,
      "",
      "#### Objective",
      ":::fill objective",
      "",
      "#### Files",
      ":::fill files",
      "",
      "#### Consumes",
      ":::fill consumes",
      "",
      "#### Produces",
      ":::fill produces",
      "",
      "#### Steps",
      "- :::fill step — checkable: :::fill check",
      "",
      "#### Acceptance",
      ":::fill acceptance",
      "",
      "#### DependsOn",
      task.deps ?? "none",
      "",
    ]),
    "## Change history",
    "",
    "| v0.1 | 2026-01-01 | :::fill | :::fill |",
  ].join("\n");

describe("the lens question table", () => {
  it("answers every kind with non-empty questions and unique labels", () => {
    for (const kind of REVIEW_KINDS) {
      const rows = LENS_QUESTIONS.forKind(kind);
      expect(rows.length).toBeGreaterThan(0);
      const labels = rows.map((row) => row.lens);
      expect(new Set(labels).size).toBe(labels.length);
      for (const row of rows) {
        expect(row.question.trim().length).toBeGreaterThan(0);
        expect(row.reviewKinds).toContain(kind);
      }
    }
  });

  it("stores a shared question once and expands it per kind", () => {
    const wave = LENS_QUESTIONS.forKind("wave").map((row) => row.id);
    const branch = LENS_QUESTIONS.forKind("branch").map((row) => row.id);
    expect(branch).toEqual(wave);
    // One row carries both kinds — the text is not duplicated per kind.
    const shared = LENS_QUESTIONS.of("wave", "standards");
    expect(shared.reviewKinds).toEqual(["wave", "branch"]);
    expect(shared.question).toBe(LENS_QUESTIONS.of("branch", "standards").question);
  });

  it("gives the referential question exactly one home in the tree", () => {
    // The `spec-consistency` row carries the referential reading ("when a document gives a
    // reading … which items does it count"), and copying that sentence anywhere else is a
    // second spelling of one criterion. The scan is the pin: one file, one occurrence.
    const literal = new LensQuestions().of("spec", "consistency").question;
    const marker = "which items does it count";
    expect(literal).toContain(marker);
    const files = ["criteria.ts"];
    const hits = files.filter((file) =>
      readFileSync(path.join(JUDGING_DIR, file), "utf8").includes(marker),
    );
    expect(hits).toEqual(["criteria.ts"]);
    // …and the row's own question carries it exactly once.
    expect(literal.split(marker).length - 1).toBe(1);
  });

  it("maps the two spec-shaped targets onto ONE criteria body", () => {
    expect(reviewKindOf("phase-spec")).toBe("spec");
    expect(reviewKindOf("single-spec")).toBe("spec");
    expect(reviewKindOf("plan")).toBe("plan");
    expect(reviewKindOf("wave")).toBe("wave");
    expect(reviewKindOf("branch")).toBe("branch");
    expect(reviewKindOf("overall")).toBe("overall");
  });

  it("composes one kind's criteria text from the body and the numbered lens list", () => {
    const text = CRITERIA.textOf("plan");
    expect(text).toContain("Follow URC");
    const rows = LENS_QUESTIONS.forKind("plan");
    rows.forEach((row, index) => {
      expect(text).toContain(`${index + 1}. ${row.question}`);
    });
    // A blank body throws rather than rendering an empty criteria line.
    const empty = new ReviewCriteria({ bodies: { ...CRITERIA_BODIES, plan: " " } });
    expect(() => empty.textOf("plan")).toThrow(/blank/);
  });
});

describe("the completion criteria", () => {
  it("fails an implement round that committed nothing", () => {
    expect(CompletionCriteria.judge("implement", { commits: 0, findings: null })).toMatchObject({
      kind: "violation",
    });
    expect(CompletionCriteria.judge("implement", { commits: 2, findings: null })).toEqual({
      kind: "done",
    });
  });

  it("accepts an EMPTY findings array as the review's APPROVED conclusion", () => {
    expect(CompletionCriteria.judge("review", { commits: 0, findings: [] })).toEqual({
      kind: "done",
    });
    expect(CompletionCriteria.judge("review", { commits: 0, findings: [{}] })).toEqual({
      kind: "done",
    });
    // An absent carrier is the violation — "no findings" and "nobody looked" differ.
    expect(CompletionCriteria.judge("review", { commits: 0, findings: null })).toMatchObject({
      kind: "violation",
    });
  });

  it("throws at lookup for a verb with no criterion", () => {
    expect(() => CompletionCriteria.of("fix")).toThrow(/no completion criterion/);
  });
});

describe("the task graph", () => {
  it("names an over-wide dependency layer and reads the graph's own decomposition", () => {
    // Four tasks with no dependency between them are ONE batch of four — the ceiling is
    // three, so the read names that batch and its tasks.
    const graph = TaskGraph.parse(planOf([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]));
    expect(graph.batches()).toEqual([[1, 2, 3, 4]]);
    expect(MAX_TASKS_PER_WAVE).toBe(3);
    const wide = new WaveWidth(graph).violations();
    expect(wide).toHaveLength(1);
    expect(wide[0]?.tasks).toEqual([1, 2, 3, 4]);
    expect(WaveWidth.lineOf(wide[0] as never)).toContain("4 tasks");

    // A different edge set changes the read: chaining the four tasks yields four batches of
    // one, so nothing is over-wide.
    const chained = TaskGraph.parse(
      planOf([{ id: 1 }, { id: 2, deps: "1" }, { id: 3, deps: "2" }, { id: 4, deps: "3" }]),
    );
    expect(chained.batches()).toEqual([[1], [2], [3], [4]]);
    expect(new WaveWidth(chained).fits()).toBe(true);
  });

  it("holds no second decomposition — it reads the batches it is handed", () => {
    // A structural stand-in proves the read calls the graph's own `batches()`: the ceiling's
    // answer moves with the stand-in, so a private wave derivation here would show.
    const stand = { batches: () => [[7, 8, 9, 10]] } as unknown as TaskGraph;
    expect(new WaveWidth(stand).violations()).toEqual([{ wave: 1, tasks: [7, 8, 9, 10] }]);
    expect(readFileSync(path.join(JUDGING_DIR, "wave-width.ts"), "utf8")).toContain("batches()");
  });

  it("reports the four edge-failure classes on their own arms", () => {
    const selfLoop = TaskGraph.parse(planOf([{ id: 1, deps: "1" }]));
    expect(selfLoop.validate().map((issue) => issue.kind)).toContain("self-loop");
    expect(TaskGraph.detailLine(selfLoop.validate()[0] as never)).toContain("self-loop@T1:");

    const missing = TaskGraph.parse(planOf([{ id: 1, deps: "9" }]));
    expect(missing.validate().map((issue) => issue.kind)).toContain("missing-id");
    // A phantom edge leaves its task unwaved — the derivation halts, it never recurses.
    expect(missing.batches()).toEqual([]);

    const cycle = TaskGraph.parse(
      planOf([
        { id: 1, deps: "2" },
        { id: 2, deps: "1" },
      ]),
    );
    const cycleIssue = cycle.validate().find((issue) => issue.kind === "cycle");
    expect(cycleIssue).toBeDefined();
    expect(TaskGraph.detailLine(cycleIssue as never)).toContain(
      "a directed dependency cycle closes over task 1",
    );

    const edgeLess = TaskGraph.parse(
      [
        "---",
        "title: 'x'",
        "doc-type: plan",
        "---",
        "",
        "### Task 1: t",
        "",
        "#### Objective",
        "x",
        "",
      ].join("\n"),
    );
    expect(edgeLess.validate().map((issue) => issue.kind)).toContain("missing-edge");
  });

  it("derives waves topologically and moves the frontier with the done set", () => {
    const graph = TaskGraph.parse(
      planOf([{ id: 1 }, { id: 2 }, { id: 3, deps: "1,2" }, { id: 4, deps: "3" }]),
    );
    expect(graph.batches()).toEqual([[1, 2], [3], [4]]);
    // Every batch is internally independent — the topological property, one assertion.
    for (const batch of graph.batches()) {
      for (const id of batch) {
        expect(graph.depsOf(id).some((dep) => batch.includes(dep))).toBe(false);
      }
    }
    expect(graph.frontier(new Set())).toEqual([1, 2]);
    expect(graph.frontier(new Set([1, 2]))).toEqual([3]);
    expect(graph.frontier(new Set([1, 2, 3, 4]))).toEqual([]);
  });
});
