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

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RepoRoot } from "../../src/env/paths/root.ts";
import { WorkspaceRoot } from "../../src/env/workspace/workspace.ts";
import { Ledger } from "../../src/run/ledger/ledger.ts";
import { WORDS } from "../../src/surface/words/words.ts";
import { materialize, OVERALL_REL, PHASE_SLUG, SPEC_REL, treeFixture } from "./fixtures/trees.ts";
import { CELLS, type Probe, type ProbeReading, rosterTable, TREE_SHAPES_TEXT } from "./grid.ts";
import {
  BASELINE_FILE,
  type Baseline,
  CORPUS,
  compareTree,
  ENTRY_DRIVER,
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
  REGISTRATION_WAVES,
  type RecordedState,
  Recorder,
  ROSTER_FILE,
  Roster,
  type RosterRow,
  readBaseline,
  reconcile,
  registrationWaveOf,
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

/** The whole roster with ONE row overridden — how a case wires a single cell without
 *  unwiring every other cell's producer. */
const rosterWith = (row: RosterRow): Roster => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "parity-roster-full-")), "roster.md");
  const rows = CELLS.map((cell) =>
    cell.id === row.cell
      ? `| ${row.cell} | ${row.task} | ${row.producer} | ${row.route} |`
      : `| ${cell.id} | ${cell.task} | ${cell.producer} | ${cell.route} |`,
  );
  const body = `| cell | task | producer | route |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n`;
  writeFileSync(file, body, "utf8");
  return Roster.read(file);
};

/** A recording of one cell, as a stitched baseline would hold it. */
const baselineOf = (cell: string, value: string, state: RecordedState = "recorded"): Baseline => ({
  scenario: CORPUS.id,
  frozenDate: CORPUS.frozenDate,
  recordedFrom: "src-next",
  cells: { [cell]: { state, value } },
});

/** The bytes a driver answers on every stream — distinguishable from any real reading. */
const FAKE_READING: ProbeReading = {
  stdout: "the new tree's stdout",
  stderr: "the new tree's stderr",
  exitCode: 7,
};

describe("the corpus is on the tree", () => {
  it("registers every declared tree shape, the non-tree fixtures and the frozen date", () => {
    // The declaration is the count: `TREE_SHAPES_TEXT` is the only place the shape set is
    // written, so the assertion reads it rather than a number that would have to be edited
    // beside it (an edited literal is a claim nobody verified).
    expect(new Set(TREE_SHAPES_TEXT).size).toBe(TREE_SHAPES_TEXT.length);
    for (const shape of TREE_SHAPES_TEXT) {
      const fixture = treeFixture(shape, { holder: { pid: 1, startedAt: 0 } });
      expect(fixture.shape, shape).toBe(shape);
      expect(fixture.files.length, shape).toBeGreaterThanOrEqual(0);
    }
    // `overall` is a DOCUMENT-KIND shape: a charter plus the one phase specification whose
    // `program:` names it — not a wider wave or a half-written ledger, which is what the
    // `TreeOptions` knobs express.
    const overall = treeFixture("overall");
    const paths = overall.files.map((file) => file.path);
    expect(paths).toContain(OVERALL_REL);
    expect(paths).toContain(SPEC_REL);
    const spec = overall.files.find((file) => file.path === SPEC_REL);
    expect(spec?.text).toContain("program: ");
    for (const name of ["non-tree.ts", "trees.ts"]) {
      expect(existsSync(path.join(PARITY_ROOT, "fixtures", name))).toBe(true);
    }
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

/** One cell's bytes, read through the FIXTURE the cell names — never off the committed
 *  baseline. The probe is re-run on the old tree, so the cell's own knob is the arm's input:
 *  a fixture that stops planting a row, or a renderer that stops printing it, changes this
 *  reading while the recording stands still. */
const liveOf = async (unit: string, flip?: Probe["options"]): Promise<string> => {
  const cell = cellOf(unit, "stdout");
  const base = cell.probe;
  if (base === undefined) throw new Error(`${unit} declares no probe`);
  const probe = flip === undefined ? base : { ...base, options: { ...base.options, ...flip } };
  return new Recorder(ProbeRunner.run).cellValueOf({ ...cell, probe });
};

describe("the render corpus the board and capsule cells read", () => {
  it("records the board's orphan row from the fixture's own draft knob", async () => {
    const value = await liveOf("f6.board.orphan");
    expect(value).toContain("orphan: ");
    expect(value).toContain(" — no recorded round owns it");
    // The row is between the occupancy row and the document rows — the fixture's shape, not
    // a row appended at the end.
    expect(value.indexOf("orphan:")).toBeLessThan(value.indexOf("overall"));
    // The knob is the row's only input: without it the same board prints no orphan row.
    const bare = await liveOf("f6.board.orphan", { orphanDraft: false });
    expect(bare).not.toContain("orphan:");
    expect(bare).not.toBe(value);
  }, 120_000);

  it("records the board's crashed row — one token, and no orphan beside it", async () => {
    const value = await liveOf("f6.board.crashed");
    expect(value).toContain("crashed: implement 2·a1");
    // A tree that also planted a review carrier would print an orphan row for it; this
    // probe carries none, so the crashed row is the only observation.
    expect(value).not.toContain("orphan:");
    // The crashed-round knob is the row's only input.
    const bare = await liveOf("f6.board.crashed", { crashedRound: false });
    expect(bare).not.toContain("crashed:");
  }, 120_000);

  it("records the held board — the fact block is set off from the document rows", async () => {
    // A standing dispatch is a tree fact like an orphan, a crashed round or a refusal: the
    // occupancy row OPENS the block, so one blank column stands between it and the document
    // rows. A BoardView that reads only the other three openers prints the two rows adjacent,
    // which is what this cell's recorded bytes diff against.
    const rows = (await liveOf("f6.board.held")).split("\n");
    const occupancy = rows.findIndex((row) => row.startsWith("  in-flight: pid "));
    expect(occupancy).toBeGreaterThan(-1);
    expect(rows[occupancy + 1]).toBe("");
    expect(rows[occupancy + 2]).toMatch(/^ {2}overall {2}/);
    // The holder-less neighbour prints the free sentence INSIDE the flow: no blank column,
    // so the cell above is not reading a separation the block prints unconditionally.
    const free = (await liveOf("f6.board.unexpanded")).split("\n");
    const sentence = free.findIndex((row) => row.startsWith("  in-flight: free"));
    expect(sentence).toBeGreaterThan(-1);
    expect(free[sentence + 1]).toMatch(/^ {2}overall {2}/);
  }, 120_000);

  it("records an anomalous artifact round on the default face and both arms under --artifacts", async () => {
    const anomalous = await liveOf("f6.board.art.anomalous");
    expect(anomalous).toContain("! misplaced");
    // The continuation rows print the sidecar's two spellings at their REPO-RELATIVE
    // coordinates — the artifact read answers `path` and `names` in one basis, so the
    // `found` cell is the recorded `.kairos/cdd/p9/…` coordinate and never the bare
    // workspace name.
    expect(anomalous).toContain(
      "           found    .kairos/cdd/p9/phase-spec-review-1.rulings.json",
    );
    expect(anomalous).toContain(
      "           derived  .kairos/cdd/p9/phase-spec-review-1.c1.rulings.json",
    );
    const all = await liveOf("f6.board.art.all");
    expect(all).toContain("   ok");
    expect(all).toContain("   absent");
    expect(all).toContain("c1·a1");
    // The inventory's knob is the observation set: with no artifact arm the same switch
    // prints zero `art:` rows rather than an empty one.
    const bare = await liveOf("f6.board.art.all", { artifactArms: false });
    expect(bare).not.toContain("art:");
  }, 120_000);

  it("records the board's two-wave segment — one frontier marker and one label column", async () => {
    const value = await liveOf("f6.board.waves");
    // The first wave is the frontier and carries the segment's label; the second is neither
    // current nor labelled, which is the whole arm: a tree whose every unstarted wave read as
    // current prints `▶` twice and repeats the label.
    expect(value).toContain("  wave     W1 {1}  ▶");
    expect(value).toContain("           W2 {2}  ○");
    expect(value.match(/wave {5}W/g) ?? []).toHaveLength(1);
  }, 120_000);

  it("records the program board and its own artifact seat as two different cells", async () => {
    const program = await liveOf("f6.board.program");
    expect(program).toContain("next:    done");
    expect(program).toContain("  phase ");
    expect(program).not.toContain("art:");
    expect(await liveOf("f6.board.program.art")).toContain("art:");
    // A phase whose own lines carry rounds prints its cells in the table's declared order —
    // `wave` between `plan` and `branch`, joined by the row's own separator.
    const cells = await liveOf("f6.board.program.cells");
    expect(cells).toContain("spec review 1 ✓ · plan review 1 ✓ · wave W1… · branch review 1 ✓");
  }, 120_000);

  it("records the capsule's summary frame as four rows — status, summary, next, reason", async () => {
    const rows = (await liveOf("f5.capsule.summary")).split("\n");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatch(/^status: /);
    expect(rows[1]).toContain("fixed ");
    expect(rows[2]).toMatch(/^next: /);
    expect(rows[3]).toMatch(/^reason: /);
  }, 120_000);
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

  it("records the board's refusal row — the `refused` shape has a byte judge", async () => {
    // The `refused` tree shape exists for one line: a standing refusal replayed into the
    // board. The shape alone is evidence only as long as a cell compares that line, which
    // is what `f6.board.refused.stdout` does — its recorded bytes must carry the row, and
    // a `BoardView` that stops printing it diffs against them.
    const value = await new Recorder(ProbeRunner.run).cellValueOf(
      cellOf("f6.board.refused", "stdout"),
    );
    expect(value).toContain(
      "refused: implement 1·a1 graph · task 1 depends on a task the plan does not declare",
    );
  }, 120_000);

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

describe("the refusal face's words", () => {
  /** One declared template as a matcher — every `{slot}` becomes a greedy fill. A row that
   *  reads as the template with its slots filled is a row this table owns. */
  const matchesTemplate = (template: string, text: string): boolean => {
    const pattern = template
      .split(/\{\w+\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("(.+)");
    return new RegExp(`^${pattern}$`).test(text);
  };

  it("records the blocked line the word table composes — anchor, station, then the held row", () => {
    // `f8.blocked.message` is the byte face of three rows: the `CDD_BLOCKED:` anchor, the
    // refusing station's own name, and the in-flight held report with its slots filled. The
    // corpus pins the holder's unstable cells as constants, so the WHOLE line is comparable.
    const baseline = readBaseline(BASELINE_FILE);
    if (baseline === null) throw new Error("the corpus has never been recorded");
    const recorded = baseline.cells["f8.blocked.message.stderr"]?.value ?? "";
    expect(recorded.length).toBeGreaterThan(0);
    const parts = recorded.split(WORDS.refusal.join);
    expect(parts[0]).toBe(`${WORDS.refusal.prefix} in-flight`);
    const detail = parts.slice(1).join(WORDS.refusal.join);
    const expected = Object.entries({
      pid: "<pid>",
      command: "cdd implement --tasks 1 --plan p9.md",
      startedAt: "<startedAt>",
      uptime: "<uptime>",
      wave: "1",
      slug: "p9",
    }).reduce<string>((row, [slot, value]) => row.replace(`{${slot}}`, value), WORDS.inFlight.held);
    expect(detail).toBe(expected);
  });

  it("records only `checked:` rows the word table declares — the block is that table's render", () => {
    // Every row of the recorded block is a declared row: the heading, the in-flight state row
    // (its `{pid}` filled), the plan-ahead info row (its `{count}` filled) or one of the
    // declared yield words. A reword on either side reds here.
    const baseline = readBaseline(BASELINE_FILE);
    if (baseline === null) throw new Error("the corpus has never been recorded");
    const recorded = baseline.cells["f8.blocked.checked.stderr"]?.value ?? "";
    const [heading, ...rows] = recorded.split("\n");
    expect(heading).toBe(WORDS.checked.heading);
    const undeclared = rows
      .map((row) => row.trim())
      .filter((row) => row.includes(": "))
      .map((row) => row.slice(row.indexOf(": ") + 2))
      .filter(
        (suffix) =>
          !Object.values(WORDS.checked.skipped).includes(
            suffix as (typeof WORDS.checked.skipped)[keyof typeof WORDS.checked.skipped],
          ) &&
          !Object.values(WORDS.checked.inFlight).some((row) => matchesTemplate(row, suffix)) &&
          !matchesTemplate(WORDS.checked.planAhead, suffix),
      );
    expect(undeclared).toEqual([]);
    // The block really carries state rows, so the scan above is not a pass over nothing.
    expect(rows.some((row) => row.trim().startsWith("in-flight:"))).toBe(true);
    expect(rows.some((row) => row.includes(WORDS.checked.skipped["no-doc-target"]))).toBe(true);
  });
});

describe("the new tree's execution face", () => {
  it("registers the two process kinds the composition root answers — `entry` and `seam`", () => {
    // The cutover wave's face: the process entry AND the in-process seam are registered, so
    // every cell the grid declares is read rather than counted.
    expect(NEW_TREE.kinds()).toContain("entry");
    expect(NEW_TREE.kinds()).toContain("seam");
    expect(REGISTRATION_WAVES.has("entry")).toBe(true);
    expect(REGISTRATION_WAVES.has("seam")).toBe(true);
    // One wave composes both readings, so the table names one wave for the two kinds.
    expect(REGISTRATION_WAVES.get("entry")).toBe(REGISTRATION_WAVES.get("seam"));
    expect(NEW_TREE_ENTRY.startsWith(NEW_TREE_ROOT)).toBe(true);
    expect(NEW_TREE_ENTRY).not.toContain("src-next");
  });

  it("reads an entry probe through the new tree's own process — the command's own bytes", async () => {
    // The one path that spawns `src/bin.ts`: the process entry answers the command, so an
    // entry-kind cell is compared against the recording instead of counted as deferred.
    const probe = cellOf("f1.base-set.normal", "stderr").probe;
    if (probe === undefined) throw new Error("the entry probe is not declared");
    expect(kindOf(probe)).toBe("entry");
    const reading = await NewTree.of([["entry", ENTRY_DRIVER]]).read(probe, CORPUS.frozenDate);
    const old = await ProbeRunner.run(probe);
    expect(reading.stdout).toBe(old.stdout);
    expect(reading.stderr).toBe(old.stderr);
    expect(reading.exitCode).toBe(old.exitCode);
    expect(reading.stderr).toBe("");
  }, 120_000);

  it("composes the four slices once and answers the argv over its injected streams", async () => {
    // `main` builds the graph in this process; the surface's two writers are the boundary the
    // caller may substitute, so the pin reads the bytes without touching the suite's own
    // stdout.
    const { main } = await import("../../src/bin.ts");
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(["schema", "get", "plan"], {
      io: { stdout: (text: string) => out.push(text), stderr: (text: string) => err.push(text) },
    });
    expect(code).toBe(0);
    expect(out.join("")).toContain('"docType": "plan"');
    expect(err.join("")).toBe("");
  });

  it("answers every probe kind the grid derives — no cell is left owing a driver", () => {
    // The kinds are the reconciler's routing table. Each kind is either answered or owed —
    // there is no third route, and in particular no fallback to the old tree. The cutover
    // wave closes the set: every derived kind has a registered driver.
    const derived = new Set(
      CELLS.filter((cell) => cell.applicable && cell.probe !== undefined).map((cell) =>
        kindOf(cell.probe as NonNullable<typeof cell.probe>),
      ),
    );
    expect([...NEW_TREE.kinds()].sort()).toEqual([...derived].sort());
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
    // The wave that lands the last declared producer EMPTIES the GAP set — the invariant is
    // the equality above ("the GAP set is exactly the roster's unwired cells"), not a
    // non-zero count. The predicate's own two arms are stitched below so the equality is not
    // a comparison of two empties.
    expect(unwired).toEqual([]);
    expect(answer.diffs).toEqual([]);
    expect(answer.missing).toEqual([]);
    const stitched = rosterWith({
      cell: SAMPLE_CELL,
      task: "T16",
      producer: "surface/commands/not-yet.ts#NotYet",
      route: sampleCell().route,
    });
    const gapped = await reconcile(CORPUS, baseline, stitched);
    expect(gapped.gaps).toContain(SAMPLE_CELL);
  }, 300_000);

  it("treats a producer landing as wiring, not as a hidden gap", () => {
    // The reading of "wired" is the producer's own landing — a path that exists and exports
    // the name. Both directions are exercised so the predicate is not a stub.
    expect(producerWired("env/index.ts#Env")).toBe(true);
    // The command face's producers landed with the shells, so the same predicate answers
    // `true` for them — and `false` for a module no landing declares.
    expect(producerWired("surface/commands/implement.ts#ImplementCommand")).toBe(true);
    expect(producerWired("surface/commands/not-yet.ts#NotYet")).toBe(false);
  });

  it("answers the brief's one call — compareTree reports the wired cells' byte differences", async () => {
    expect(await compareTree(CORPUS)).toEqual([]);
  }, 300_000);

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
      { newTree: NewTree.of([["entry", driver]]) },
    );
    expect(answer.diffs).toHaveLength(1);
    expect(answer.diffs[0]?.actual).toBe(projectionOf(cell, FAKE_READING));
    expect(answer.diffs[0]?.actual).not.toBe("the old tree's bytes");
  });

  it("refuses a recording that calls an applicable route inapplicable, even before its producer lands", async () => {
    // The fifth MISSING condition: the recording says "this route does not exist" while the
    // grid declares it applies. An unwired producer is no licence to absorb that
    // disagreement into the GAP count — a wave that flips a unit from `not-applicable` to
    // a real route reads red in its own round instead of one wave later.
    const cell = sampleCell();
    const answer = await reconcile(
      CORPUS,
      baselineOf(cell.id, "", "not-applicable"),
      rosterOf({
        cell: cell.id,
        task: "T16",
        // A producer no module carries — the arm is about the UNLANDED branch, so it must
        // not name one of the shells this wave landed.
        producer: "surface/commands/not-yet.ts#NotYet",
        route: cell.route,
      }),
      { newTree: NewTree.unwired() },
    );
    expect(answer.missing).toContain(
      `${cell.id}: recorded as not-applicable, but the route is resolvable`,
    );
    // It is still a cell whose producer has not landed, so it stays counted as a GAP too.
    expect(answer.gaps).toContain(cell.id);
  });

  it("counts a wired cell whose kind is declared as a NAMED deferral, never a diff or a gap", async () => {
    // No driver, no comparison: the cell must not fall back to the old tree, and it must not
    // pass either. A kind with a declared registration wave is counted WITH that wave — "the
    // driver is not here YET" is a schedule fact, not a missing judge.
    const cell = sampleCell();
    const recorded = readBaseline(BASELINE_FILE);
    if (recorded === null) throw new Error("the corpus has never been recorded");
    const stitched: Baseline = {
      ...recorded,
      cells: { ...recorded.cells, [cell.id]: { state: "recorded", value: "the old tree's bytes" } },
    };
    const answer = await reconcile(
      CORPUS,
      stitched,
      rosterWith({ cell: cell.id, task: "T16", producer: "env/index.ts#Env", route: cell.route }),
      { newTree: NewTree.unwired() },
    );
    expect(answer.diffs).toEqual([]);
    expect(answer.missing).toEqual([]);
    // The sample cell is counted WITH its wave — and every other deferral on the tree is a
    // wired cell whose own kind declares one, so the count is read off the corpus instead of
    // pinning "exactly one deferral" (each landed producer adds its cells to this set).
    expect(answer.deferred).toContain(
      `${cell.id}: the "entry" driver is registered by ${REGISTRATION_WAVES.get("entry")}`,
    );
    for (const entry of answer.deferred) {
      expect(entry).toMatch(/^.+: the ".+" driver is registered by T\d+$/);
    }
  });

  it("holes the same cell when the row that declares its wave is deleted", async () => {
    // The wall arm of the deferral rule: delete the row (the brief's own step) and the very
    // cell above must read MISSING, naming the task that owes the driver — the absence is
    // named, never counted as a deferral to a wave that does not exist.
    const cell = sampleCell();
    const recorded = readBaseline(BASELINE_FILE);
    if (recorded === null) throw new Error("the corpus has never been recorded");
    const stitched: Baseline = {
      ...recorded,
      cells: { ...recorded.cells, [cell.id]: { state: "recorded", value: "the old tree's bytes" } },
    };
    const undeclared = new Map([...REGISTRATION_WAVES].filter(([kind]) => kind !== "entry"));
    const answer = await reconcile(
      CORPUS,
      stitched,
      rosterWith({ cell: cell.id, task: "T17", producer: "env/index.ts#Env", route: cell.route }),
      { newTree: NewTree.unwired(), waves: undeclared },
    );
    // This cell is no longer a deferral: its kind declares no wave, so the absence is named.
    expect(answer.deferred.some((entry) => entry.startsWith(`${cell.id}:`))).toBe(false);
    expect(answer.missing).toContain(
      `${cell.id}: the new tree has no "entry" driver — T17 wires it`,
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
      { newTree: NewTree.unwired() },
    );
    expect(answer.missing.some((entry) => entry.includes("2000-01-01"))).toBe(true);
  });
});

describe("the skeleton cells", () => {
  it("compare the four families' bytes on the new tree, under the corpus's frozen date", async () => {
    const baseline = readBaseline(BASELINE_FILE);
    if (baseline === null) throw new Error("the corpus has never been recorded");
    for (const type of ["overall", "plan", "phase-spec", "single-spec"]) {
      const cell = cellOf(`f3.skeleton.${type}`, "stdout");
      const probe = cell.probe;
      if (probe === undefined) throw new Error(`${cell.id}: no probe`);
      // The cell's kind IS the registered renderer — the wave that landed the assembler wired
      // the cell, so it is byte-compared instead of counted as a gap.
      expect(NEW_TREE.kinds()).toContain(kindOf(probe));
      expect(baseline.cells[cell.id]?.state).toBe("recorded");
      const reading = await NEW_TREE.read(probe, CORPUS.frozenDate);
      expect(projectionOf(cell, reading)).toBe(baseline.cells[cell.id]?.value);
    }
    // …and the whole reconciliation sees no diff on them.
    expect((await reconcile(CORPUS, baseline, Roster.read(ROSTER_FILE))).diffs).toEqual([]);
  }, 300_000);

  it("read the new tree's OWN assembler — another frozen day changes the byte", async () => {
    const cell = cellOf("f3.skeleton.plan", "stdout");
    const probe = cell.probe;
    if (probe === undefined) throw new Error("the skeleton probe is not declared");
    const frozen = projectionOf(cell, await NEW_TREE.read(probe, CORPUS.frozenDate));
    const other = projectionOf(cell, await NEW_TREE.read(probe, "2001-02-03"));
    expect(other).not.toBe(frozen);
    expect(other).toContain("date: 2001-02-03");
    expect(frozen).toContain(`date: ${CORPUS.frozenDate}`);
  });
});

describe("the fact layer over the corpus document", () => {
  it("reads the fixture tree's own progress.json through the new ledger", () => {
    // The corpus declares the FROZEN document — the shape the shipped engine writes — and
    // the `entry` cells read ONE fixture tree through both engines. So the new fact layer
    // owes this read: the fixture's rows, on the fixture's own key spelling, with the rounds
    // it records. A ledger that read only its own container would answer null here (and on
    // every live workspace), which is the diff this arm sees.
    const repo = materialize(treeFixture("wave", { rounds: "review" }));
    try {
      const workspace = new WorkspaceRoot({
        basis: RepoRoot.of(repo),
        now: () => 0,
        baseName: "base.json",
      }).at(PHASE_SLUG);
      const ledger = new Ledger({ workspace, names: () => [] });
      expect(ledger.read()).not.toBeNull();
      const [line] = ledger.waveLines();
      expect(line?.line).toBe("tasks-1");
      expect(line?.rounds.map((record) => record.op)).toEqual(["implement", "review"]);
      expect(ledger.rounds("tasks-1")).toHaveLength(2);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("the named deferral", () => {
  it("declares exactly the kinds the grid derives — both sides derived, no literal list", () => {
    const kinds = new Set(
      CELLS.filter((cell) => cell.applicable && cell.probe !== undefined).map((cell) =>
        kindOf(cell.probe as NonNullable<typeof cell.probe>),
      ),
    );
    expect([...REGISTRATION_WAVES.keys()].sort()).toEqual([...kinds].sort());
  });

  it("defers a declared kind and holes an undeclared one — the rule has both arms", () => {
    // With the row: the kind answers its wave. Without it: no wave, so a producer with no
    // driver is MISSING — absence must be named.
    expect(registrationWaveOf("seam", new Map([["seam", "T17"]]))).toBe("T17");
    expect(registrationWaveOf("seam", new Map())).toBeNull();
    // `seam` is the composition root's wave, and the assertion DERIVES it from the table —
    // moving the row moves this reading with it, so the table stays the one declaration.
    expect(registrationWaveOf("seam")).toBe(REGISTRATION_WAVES.get("seam") ?? null);
    // A kind the grid never derives is not declared either.
    expect(registrationWaveOf("render:unknown")).toBeNull();
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
