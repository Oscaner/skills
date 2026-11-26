// packages/cdd-engine/src/docs/judging/__tests__/criteria.test.ts
// The judging tables' pins.
//
// Four groups: the lens question table (every kind answers questions, every label is unique,
// and the referential question has exactly ONE home in the tree) · the completion criteria
// (an implement round with no commit is a violation; a review whose findings array is empty is
// APPROVED) · the wave-width ceiling (an over-wide dependency layer is named, and the read
// follows the graph's own decomposition) · the task graph's four edge-failure classes and its
// wave decomposition / frontier.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CompletionCriteria, type CompletionFacts } from "../completion.ts";
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

/** The `src`-relative `docs/` slice root — the whole product surface a criterion's home is
 *  judged over, not the one file that happens to hold the literal today. */
const DOCS_DIR = path.dirname(JUDGING_DIR);

/** The `docs/` product scan: which non-test modules carry one literal. A `__tests__`
 *  directory is the test surface and stays outside the scan; the pin judges where the
 *  product stores a sentence, never where a test quotes it. */
class ProductScan {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  /** The `root`-relative paths of the `.ts` modules under it whose text mentions `needle`. */
  filesMentioning(needle: string): string[] {
    const found: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const child = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__") walk(child);
          continue;
        }
        if (!entry.name.endsWith(".ts")) continue;
        if (readFileSync(child, "utf8").includes(needle)) {
          found.push(path.relative(this.#root, child));
        }
      }
    };
    walk(this.#root);
    return found.sort();
  }
}

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
    // second spelling of one criterion. The scan is the pin: the whole `docs/` product
    // surface, one occurrence. Restricting it to `criteria.ts` would restate the literal it
    // already holds instead of judging where else it landed.
    const literal = new LensQuestions().of("spec", "consistency").question;
    const marker = "which items does it count";
    expect(literal).toContain(marker);
    expect(new ProductScan(DOCS_DIR).filesMentioning(marker)).toEqual([
      path.join("judging", "criteria.ts"),
    ]);
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
  /** A round's fact record — a plain implement round unless a case overrides a cell. */
  const factsOf = (over: Partial<CompletionFacts> = {}): CompletionFacts => ({
    commits: 0,
    findings: null,
    waveTasks: [],
    emptyFileTasks: new Set(),
    evidenceOk: false,
    ...over,
  });

  it("fails an implement round that committed nothing", () => {
    expect(CompletionCriteria.judge("implement", factsOf())).toMatchObject({
      kind: "violation",
    });
    expect(CompletionCriteria.judge("implement", factsOf({ commits: 2 }))).toEqual({
      kind: "done",
    });
  });

  it("finishes a zero-diff verification wave on its green evidence", () => {
    // A verification wave declares an empty `Files` on EVERY task, so it changes nothing by
    // design and commits nothing — its green evidence is the round's completion. Every other
    // zero-commit round keeps the `committed nothing` refusal (P30 §2.4).
    const verification = { waveTasks: [1, 2], emptyFileTasks: new Set([1, 2]) };
    expect(
      CompletionCriteria.judge("implement", factsOf({ ...verification, evidenceOk: true })),
    ).toEqual({ kind: "done" });
    expect(
      CompletionCriteria.judge("implement", factsOf({ ...verification, evidenceOk: false })),
    ).toEqual({
      kind: "violation",
      message: expect.stringContaining("a verification wave still owes green evidence"),
    });
    // A wave whose empty-`Files` set is a mere SUBSET of its own task ids is not a
    // verification wave, and a wave key that names no task is never one (the vacuous read).
    expect(
      CompletionCriteria.judge(
        "implement",
        factsOf({ waveTasks: [1, 2], emptyFileTasks: new Set([1]), evidenceOk: true }),
      ),
    ).toEqual({ kind: "violation", message: expect.stringContaining("committed nothing") });
    expect(
      CompletionCriteria.judge("implement", factsOf({ waveTasks: [], evidenceOk: true })),
    ).toEqual({ kind: "violation", message: expect.stringContaining("committed nothing") });
    // Commits decide first: a wave that also committed is done on its commits.
    expect(
      CompletionCriteria.judge("implement", factsOf({ commits: 1, evidenceOk: false })),
    ).toEqual({ kind: "done" });
  });

  it("accepts an EMPTY findings array as the review's APPROVED conclusion", () => {
    expect(CompletionCriteria.judge("review", factsOf({ findings: [] }))).toEqual({
      kind: "done",
    });
    expect(CompletionCriteria.judge("review", factsOf({ findings: [{}] }))).toEqual({
      kind: "done",
    });
    // An absent carrier is the violation — "no findings" and "nobody looked" differ.
    expect(CompletionCriteria.judge("review", factsOf({ findings: null }))).toMatchObject({
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

  it("spells every issue sentence the blocked face prints, byte for byte", () => {
    // `detailLine` is the ONE author of the CDD_BLOCKED detail row, and the corpus records no
    // graph-issue refusal — so this pin is the only thing standing between the message cell
    // and a silent reword that no byte face would catch.
    const lines = (graph: TaskGraph): readonly string[] =>
      graph.validate().map((issue) => TaskGraph.detailLine(issue));
    expect(
      lines(
        TaskGraph.parse(
          ["---", "title: 'x'", "doc-type: plan", "---", "", "### Task 1: t", ""].join("\n"),
        ),
      ),
    ).toEqual(["missing-edge@T1: task 1 declares no **DependsOn** edge"]);
    expect(lines(TaskGraph.parse(planOf([{ id: 1, deps: "9" }])))).toEqual([
      "missing-id@T1: task 1 depends on unregistered task 9",
    ]);
    expect(lines(TaskGraph.parse(planOf([{ id: 1, deps: "1" }])))).toEqual([
      "self-loop@T1: task 1 depends on itself",
    ]);
    expect(
      lines(
        TaskGraph.parse(
          planOf([
            { id: 1, deps: "2" },
            { id: 2, deps: "1" },
          ]),
        ),
      ),
    ).toEqual([
      "cycle@T1: a directed dependency cycle closes over task 1: task dependencies must form a DAG",
    ]);
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
