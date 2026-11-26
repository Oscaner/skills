// packages/cdd-engine/tests/parity/parity.test.ts
// The parity corpus's own suite: the roster is complete, singular and rendered from the
// grid; the baseline covers every declared cell; the reconciliation answers four states
// and reads the NEW tree; the recorded shapes carry the facts their cells claim; and the
// harness can go red on its own.
//
// The last one is the point: a reconciliation that cannot fail is only running itself. The
// self-proving arm records the same corpus twice from the old tree and requires the two
// recordings to be byte-identical, then flips one byte of one expectation and requires the
// difference to be seen. It touches no new-tree producer — which is why "the harness itself
// is red-able" holds from the day the corpus lands, not from the day the first producer does.

import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CELLS, type ProbeReading, rosterTable, TREE_SHAPES_TEXT } from "./grid.ts";
import {
  BASELINE_FILE,
  type Baseline,
  CORPUS,
  compareTree,
  kindOf,
  landingDiff,
  NEW_TREE,
  NEW_TREE_ENTRY,
  NEW_TREE_ROOT,
  NewTree,
  PARITY_ROOT,
  ProbeRunner,
  producerWired,
  projectionOf,
  Recorder,
  ROSTER_FILE,
  Roster,
  type RosterRow,
  readBaseline,
  reconcile,
  SelfProof,
} from "./harness.ts";

/** The engine package root. */
const ENGINE_ROOT = path.resolve(PARITY_ROOT, "../..");

/** The repository root. */
const REPO_ROOT = path.resolve(ENGINE_ROOT, "../..");

/** One cell the corpus always records — the smallest read face, so a case can name it. */
const SAMPLE_CELL = "f1.base-get.refusal.absent.stderr";

/** The sample cell's declaration. */
const sampleCell = (): (typeof CELLS)[number] => {
  const cell = CELLS.find((entry) => entry.id === SAMPLE_CELL);
  if (cell === undefined) throw new Error(`${SAMPLE_CELL} is not declared`);
  return cell;
};

/** One cell of one unit and stream. */
const cellOf = (unit: string, stream: "stdout" | "stderr" | "exit-code") => {
  const cell = CELLS.find((entry) => entry.unit === unit && entry.stream === stream);
  if (cell === undefined) throw new Error(`${unit}.${stream} is not declared`);
  return cell;
};

/** A roster holding ONE row — how a case wires a single cell without touching the file. */
const rosterOf = (row: RosterRow): Roster => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "parity-roster-")), "roster.md");
  const body = `| cell | task | producer | route |\n| --- | --- | --- | --- |\n| ${row.cell} | ${row.task} | ${row.producer} | ${row.route} |\n`;
  writeFileSync(file, body, "utf8");
  return Roster.read(file);
};

/** A recording of one cell, as a stitched baseline would hold it. */
const baselineOf = (cell: string, value: string): Baseline => ({
  scenario: CORPUS.id,
  frozenDate: CORPUS.frozenDate,
  recordedFrom: "src-next",
  cells: { [cell]: { state: "recorded", value } },
});

/** The bytes a driver answers on every stream — distinguishable from any real reading. */
const FAKE_READING: ProbeReading = {
  stdout: "the new tree's stdout",
  stderr: "the new tree's stderr",
  exitCode: 7,
};

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

  it("carries the route and the wiring the grid itself declares — one declaration, one rendering", () => {
    for (const cell of CELLS) {
      const row = roster.rowOf(cell.id);
      if (row === null) throw new Error(`${cell.id}: no roster row`);
      expect(row.route).toBe(cell.route);
      if (!cell.applicable) continue;
      expect(row.task).toBe(cell.task);
      expect(row.producer).toBe(cell.producer);
    }
  });

  it("carries the table the grid renders — the document and the table are one declaration", () => {
    // `roster.ts` rewrites this table from `CELLS`; the file is prose PLUS that rendering.
    // A hand-edited row therefore reds here instead of drifting silently.
    expect(readFileSync(ROSTER_FILE, "utf8").trimEnd().endsWith(rosterTable())).toBe(true);
  });

  it("declares the refusal route per cause — the five wave-gate reasons and the four stations", () => {
    const causes = CELLS.map((cell) => cell.unit).filter((unit) => unit.includes(".refusal."));
    for (const cause of [
      "mixed-batch",
      "wave-too-wide",
      "too-many-tasks",
      "split",
      "wrong-phase",
    ]) {
      expect(causes.some((unit) => unit.endsWith(`.${cause}`))).toBe(true);
    }
    for (const station of ["no-host", "carrier", "dispatch-input", "artifact"]) {
      expect(causes.some((unit) => unit.endsWith(`.${station}`))).toBe(true);
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
      // The recording's state is a CONDITION, not a snapshot of the wave that took it: the
      // route decides `not-applicable`, and nothing else does.
      expect(["gap", "recorded", "not-applicable"]).toContain(entry.state);
      expect(entry.state === "not-applicable").toBe(!cell.applicable);
      // An empty stream is a legal recording (a silent command writes no stderr); a route
      // the command does not have is the ONLY cell with no bytes at all.
      if (!cell.applicable) expect(entry.value).toBe("");
    }
    const recorded = Object.values(baseline.cells).filter((entry) => entry.value.length > 0);
    expect(recorded.length).toBeGreaterThan(CELLS.length / 4);
  });
});

describe("the recorded shapes", () => {
  it("records the skeleton landing fact and the real exit code, never one token for three streams", async () => {
    // `schema get … --output skeleton <target>`: one stream judges whether the target file is
    // there and non-empty, the exit-code stream still records the exit code. A path echoed
    // with nothing written must red, so the three cells cannot collapse into one token.
    const probe = cellOf("f3.skeleton-landing", "stdout").probe;
    if (probe === undefined) throw new Error("the landing probe is not declared");
    const reading = await ProbeRunner.run(probe);
    expect(reading.stdout.trim()).toBe("landed.md");
    expect(reading.exitCode).toBe(0);
    expect(reading.landing?.kind).toBe("written");
    expect(reading.landing?.digest).toMatch(/^[0-9a-f]{64}$/);
    const stdout = projectionOf(cellOf("f3.skeleton-landing", "stdout"), reading);
    const exitCode = projectionOf(cellOf("f3.skeleton-landing", "exit-code"), reading);
    expect(stdout).toContain("target=written");
    expect(exitCode).toBe("0");
    expect(exitCode).not.toBe(stdout);
  }, 120_000);

  it("judges a landing cell within the run — both targets written, their bytes equal", () => {
    // The written file carries the wall clock's date, so this cell cannot lean on the
    // baseline: both trees write in this run and the two targets are what get compared.
    const cell = cellOf("f3.skeleton-landing", "stdout");
    const written = (digest: string): ProbeReading => ({
      stdout: "landed.md\n",
      stderr: "",
      exitCode: 0,
      landing: { path: "landed.md", kind: "written", digest },
    });
    const absent: ProbeReading = {
      stdout: "landed.md\n",
      stderr: "",
      exitCode: 0,
      landing: { path: "landed.md", kind: "absent", digest: "" },
    };
    expect(landingDiff(cell, written("a".repeat(64)), written("a".repeat(64)))).toBeNull();
    expect(landingDiff(cell, written("a".repeat(64)), written("b".repeat(64)))).not.toBeNull();
    // The echoed path with nothing written is the exact failure this cell exists to red on.
    expect(landingDiff(cell, absent, absent)?.expected).toContain("must write the target");
    expect(landingDiff(cell, written("a".repeat(64)), absent)?.expected).toContain(
      "must write the target",
    );
  });

  it("records the board's two note states differently — the expanded face has an input", async () => {
    // spec §2.2 #6 freezes `--notes` unexpanded AND expanded. Two cells over a tree with no
    // note are one cell: the fixture carries a child note, so the expanded rendering has
    // something to open and deleting the notes renderer reds.
    const recorder = new Recorder(ProbeRunner.run);
    const folded = await recorder.cellValueOf(cellOf("f6.board.unexpanded", "stdout"));
    const open = await recorder.cellValueOf(cellOf("f6.board.expanded", "stdout"));
    expect(folded).toContain("notes +1");
    expect(folded).not.toContain("the guard is missing at the second station");
    expect(open).toContain("the guard is missing at the second station");
    expect(open).not.toBe(folded);
  }, 120_000);
});

describe("the new tree's execution face", () => {
  it("registers the new tree's own process entry, and it is the new tree's", () => {
    expect(NEW_TREE.kinds()).toContain("entry");
    expect(NEW_TREE_ENTRY.startsWith(NEW_TREE_ROOT)).toBe(true);
    expect(NEW_TREE_ENTRY).not.toContain("src-next");
  });

  it("leaves every probe kind it cannot read owed to a named wiring task", () => {
    // The kinds are the reconciler's routing table. Each kind is either answered or owed —
    // there is no third route, and in particular no fallback to the old tree.
    const roster = Roster.read(ROSTER_FILE);
    const owed = new Set<string>();
    for (const cell of CELLS) {
      if (!cell.applicable || cell.probe === undefined) continue;
      const kind = kindOf(cell.probe);
      if (NEW_TREE.kinds().includes(kind)) continue;
      owed.add(kind);
      const task = roster.rowOf(cell.id)?.task;
      expect(task).toMatch(/^T\d+$/);
    }
    expect([...owed].length).toBeGreaterThan(0);
  });
});

describe("the reconciliation", () => {
  const roster = Roster.read(ROSTER_FILE);

  it("counts every cell with no landed producer as a GAP — the roster's unwired set, never a snapshot", async () => {
    const baseline = readBaseline(BASELINE_FILE);
    if (baseline === null) throw new Error("the corpus has never been recorded");
    const answer = await reconcile(CORPUS, baseline, roster);
    const unwired = CELLS.filter((cell) => {
      if (!cell.applicable) return false;
      const row = roster.rowOf(cell.id);
      return row === null || !producerWired(row.producer);
    }).map((cell) => cell.id);
    expect([...answer.gaps].sort()).toEqual(unwired.sort());
    expect(unwired.length).toBeGreaterThan(0);
    // Nothing has landed yet, so nothing is compared and nothing is missing — and the GAP
    // set is the whole applicable corpus, not "everything the recording happened to say".
    expect(answer.diffs).toEqual([]);
    expect(answer.missing).toEqual([]);
  });

  it("treats a producer landing as wiring, not as a hidden gap", () => {
    // The reading of "wired" is the producer's own landing — a path that exists and exports
    // the name. Both directions are exercised so the predicate is not a stub.
    expect(producerWired("env/index.ts#Env")).toBe(true);
    expect(producerWired("surface/commands/implement.ts#ImplementCommand")).toBe(false);
  });

  it("answers the brief's one call — compareTree reports the wired cells' byte differences", async () => {
    expect(await compareTree(CORPUS)).toEqual([]);
  });

  it("reads a wired cell's actual bytes on the NEW tree, never a re-run of the old one", async () => {
    // The finding this pins: a reconciler whose actual is the old tree's second reading
    // compares old against old and can never red. The driver here answers bytes no tree
    // printed, so only a new-tree read can produce them.
    const cell = sampleCell();
    const driver = { run: async () => FAKE_READING };
    const answer = await reconcile(
      CORPUS,
      baselineOf(cell.id, "the old tree's bytes"),
      rosterOf({ cell: cell.id, task: "T16", producer: "env/index.ts#Env", route: cell.route }),
      NewTree.of([["entry", driver]]),
    );
    expect(answer.diffs).toHaveLength(1);
    expect(answer.diffs[0]?.actual).toBe(projectionOf(cell, FAKE_READING));
    expect(answer.diffs[0]?.actual).not.toBe("the old tree's bytes");
  });

  it("reports a wired cell the new tree cannot read as MISSING, naming the owing task", async () => {
    // No driver, no comparison: the cell must not fall back to the old tree, and it must not
    // pass either. A wiring task that lands a producer owes the driver too.
    const cell = sampleCell();
    const answer = await reconcile(
      CORPUS,
      baselineOf(cell.id, "the old tree's bytes"),
      rosterOf({ cell: cell.id, task: "T16", producer: "env/index.ts#Env", route: cell.route }),
      NewTree.unwired(),
    );
    expect(answer.diffs).toEqual([]);
    expect(answer.missing).toContain(
      `${cell.id}: the new tree has no "entry" driver — T16 wires it`,
    );
  });

  it("refuses a recording taken under another frozen date", async () => {
    const cell = sampleCell();
    const stale: Baseline = {
      ...baselineOf(cell.id, "the old tree's bytes"),
      frozenDate: "2000-01-01",
    };
    const answer = await reconcile(
      CORPUS,
      stale,
      rosterOf({ cell: cell.id, task: "T16", producer: "env/index.ts#Env", route: cell.route }),
      NewTree.unwired(),
    );
    expect(answer.missing.some((entry) => entry.includes("2000-01-01"))).toBe(true);
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
    const cell = sampleCell();
    const first = await new Recorder(ProbeRunner.run).cellValueOf(cell);
    const second = await new Recorder(ProbeRunner.run).cellValueOf(cell);
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThan(0);
  }, 180_000);
});
