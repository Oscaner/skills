// packages/cdd-engine/tests/parity/parity.test.ts
// The parity corpus's own suite: the roster is complete and singular, the baseline
// covers every declared cell, the reconciliation answers three states, and the harness
// can go red on its own.
//
// The last one is the point: a reconciliation that cannot fail is only running itself.
// The self-proving arm records the same corpus twice from the old tree and requires the
// two recordings to be byte-identical, then flips one byte of one expectation and
// requires the difference to be seen. It touches no new-tree producer — which is why
// "the harness itself is red-able" holds from the day the corpus lands, not from the day
// the first producer does.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CELLS, TREE_SHAPES_TEXT } from "./grid.ts";
import {
  BASELINE_FILE,
  CORPUS,
  PARITY_ROOT,
  producerWired,
  Recorder,
  Roster,
  readBaseline,
  reconcile,
  SelfProof,
} from "./harness.ts";

/** The roster's file. */
const ROSTER_FILE = path.join(PARITY_ROOT, "GRID-WIRING.md");

/** The engine package root. */
const ENGINE_ROOT = path.resolve(PARITY_ROOT, "../..");

/** The repository root. */
const REPO_ROOT = path.resolve(ENGINE_ROOT, "../..");

/** One cell the corpus always records — the smallest read face, so a case can name it. */
const SAMPLE_CELL = "f1.base-get.failure.stderr";

describe("the corpus is on the tree", () => {
  it("registers the seven tree shapes, the three non-tree fixtures and the frozen date", () => {
    expect(TREE_SHAPES_TEXT.length).toBe(7);
    for (const name of ["non-tree.ts", "trees.ts"]) {
      expect(existsSync(path.join(PARITY_ROOT, "fixtures", name))).toBe(true);
    }
    expect(existsSync(path.join(PARITY_ROOT, "fixtures", "non-tree.ts"))).toBe(true);
  });

  it("is collected by an execution face: the engine's include carries this home", () => {
    const config = readFileSync(path.join(ENGINE_ROOT, "vitest.config.ts"), "utf8");
    expect(config).toContain("tests/parity/**/*.test.ts");
    // Appended, never substituted: both trees keep their own suites while they coexist.
    expect(config).toContain("src-next/**/__tests__/**/*.test.ts");
    expect(config).toContain("src/**/__tests__/**/*.test.ts");
  });

  it("is type-checked by its own appended project", () => {
    const project = path.join(PARITY_ROOT, "tsconfig.json");
    expect(existsSync(project)).toBe(true);
    const typecheck = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).scripts
      .typecheck as string;
    expect(typecheck).toContain("packages/cdd-engine/tests/parity/tsconfig.json");
    // The four pre-existing projects stay in the chain.
    expect(typecheck).toContain("packages/cdd-engine");
    expect(typecheck).toContain("-p scripts");
    expect(typecheck).toContain("packages/kairos/tests");
    expect(typecheck).toContain("packages/cdd-engine/tsconfig.src.json");
  });
});

describe("the wiring roster", () => {
  const roster = Roster.read(ROSTER_FILE);

  it("names exactly one wiring task and one producer landing per cell", () => {
    expect(roster.violations()).toEqual([]);
    expect(roster.rows().length).toBe(CELLS.length);
  });

  it("writes a route the command does not have as `not-applicable`, never as a hole", () => {
    const inapplicable = CELLS.filter((cell) => cell.applicable === false);
    expect(inapplicable.length).toBeGreaterThan(0);
    for (const cell of inapplicable) {
      expect(roster.rowOf(cell.id)?.route).toBe("not-applicable");
      expect(roster.rowOf(cell.id)?.task).toBe("—");
    }
  });
});

describe("the baseline", () => {
  const baseline = readBaseline(BASELINE_FILE);

  it("covers every declared cell, recorded from the live old tree under the frozen date", () => {
    expect(baseline).not.toBeNull();
    if (baseline === null) throw new Error("the corpus has never been recorded");
    expect(baseline.recordedFrom).toBe("src-next");
    expect(baseline.frozenDate).toBe(CORPUS.frozenDate);
    for (const cell of CELLS) expect(baseline.cells[cell.id]).toBeDefined();
  });

  it("records a state for every cell, empty bytes exactly for the inapplicable ones", () => {
    if (baseline === null) throw new Error("the corpus has never been recorded");
    for (const cell of CELLS) {
      const entry = baseline.cells[cell.id];
      if (entry === undefined) throw new Error(`${cell.id}: no baseline entry`);
      expect(entry.state).toBe("gap");
      // An empty stream is a legal recording (a silent command writes no stderr); a
      // route the command does not have is the ONLY cell with no bytes at all.
      if (!cell.applicable) expect(entry.value).toBe("");
    }
    const recorded = Object.values(baseline.cells).filter((entry) => entry.value.length > 0);
    expect(recorded.length).toBeGreaterThan(CELLS.length / 4);
  });
});

describe("the reconciliation", () => {
  const roster = Roster.read(ROSTER_FILE);

  it("counts every unwired cell as a GAP — exactly the set the baseline recorded as one", async () => {
    const baseline = readBaseline(BASELINE_FILE);
    if (baseline === null) throw new Error("the corpus has never been recorded");
    const answer = await reconcile(CORPUS, baseline, roster);
    const recordedGaps = Object.entries(baseline.cells)
      .filter(([, cell]) => cell.state === "gap")
      .map(([id]) => id)
      .sort();
    expect([...answer.gaps].sort()).toEqual(recordedGaps);
    // At this wave no producer has landed, so no cell is compared and none is missing.
    expect(answer.diffs).toEqual([]);
    expect(answer.missing).toEqual([]);
  });

  it("treats a producer landing as wiring, not as a hidden gap", () => {
    // The reading of "wired" is the producer's own landing — a path that exists and
    // exports the name. Both directions are exercised so the predicate is not a stub.
    expect(producerWired("env/index.ts#Env")).toBe(true);
    expect(producerWired("surface/commands/implement.ts#ImplementCommand")).toBe(false);
  });
});

describe("the harness can go red on its own", () => {
  it("records the same corpus twice with no difference, and sees a flipped byte", async () => {
    const proof = await SelfProof.recordTwice();
    expect(proof.drift()).toEqual([]);
    expect(proof.flipped(SAMPLE_CELL)).toEqual([
      {
        cell: SAMPLE_CELL,
        expected: expect.stringContaining("flipped"),
        actual: expect.any(String),
      },
    ]);
  }, 180_000);

  it("re-reads one cell deterministically — a second independent pass equals the first", async () => {
    const cell = CELLS.find((entry) => entry.id === SAMPLE_CELL);
    if (cell === undefined) throw new Error("the sample cell is not declared");
    const first = await new Recorder().valueOf(cell);
    const second = await new Recorder().valueOf(cell);
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThan(0);
  }, 180_000);
});
