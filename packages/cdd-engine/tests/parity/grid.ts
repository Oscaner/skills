// packages/cdd-engine/tests/parity/grid.ts
// The cell program of the parity corpus — what gets recorded, from where, and how.
//
// A cell is one command × one route × one stream (or one render face × one scenario).
// The UNIT is one probe run; its cells are the streams read off that one run, so a
// command is executed once and three cells judged. A route a command genuinely does not
// have is NOT omitted: the unit is declared with `not-applicable`, its cells still exist
// (so the roster can name them) and nothing is recorded for them — "this command has no
// refusal route" is a fact the roster states, not a gap in it.
//
// The grid is declared once and never re-derived: the roster in `GRID-WIRING.md` names
// one wiring task and one producer landing per cell, and the harness joins the two by
// cell id.

import {
  FROZEN_DATE,
  ISSUE_STDIN,
  plantPathStandIn,
  RecordingStepRunner,
} from "./fixtures/non-tree.ts";
import { PLAN_REL, TREE_SHAPES, type TreeShape } from "./fixtures/trees.ts";

/** One stream a cell records. */
export type Stream = "stdout" | "stderr" | "exit-code";

/** The three streams, in the order a cell is derived from one probe. */
export const STREAMS: readonly Stream[] = ["stdout", "stderr", "exit-code"];

/** The eight frozen faces of spec §2.2. */
export type Face = "f1" | "f2" | "f3" | "f4" | "f5" | "f6" | "f7" | "f8";

/** One route of a command. */
export type Route = "normal" | "refusal" | "failure" | "not-applicable";

/** A holder's identity facts, when a fixture needs a live or dead process. */
export interface HolderFacts {
  readonly pid: number;
  readonly startedAt: number;
}

/** One probe — one old-tree execution whose three streams feed a unit's cells. */
export interface Probe {
  readonly fixture: TreeShape;
  /** The argv handed to the old CLI (relative to the fixture's root, which is the cwd). */
  readonly argv: readonly string[];
  /** Whether the hermetic approving dispatch step is injected. */
  readonly dispatch?: boolean;
  /** Whether the step runner throws (the `init` failure route). */
  readonly failingRunner?: boolean;
  /** The `PATH` stand-in directory to prepend, when the probe needs a harness on PATH. */
  readonly standIn?: boolean;
  /** The stdin body the command reads. */
  readonly stdin?: string;
  /** The in-flight holder the fixture plants. */
  readonly holder?: HolderFacts;
  /** The in-process render key, when the probe drives a renderer instead of a command. */
  readonly render?: string;
}

/** One unit — one probe run and the streams read off it. */
export interface Unit {
  /** The unit's key — its cells' id prefix. */
  readonly key: string;
  /** The face the unit belongs to. */
  readonly face: Face;
  /** The route the unit exercises. */
  readonly route: Route;
  /** The probe; absent exactly when the route does not apply. */
  readonly probe?: Probe;
  /** How a cell's value is taken off the reading; default is the whole stream. */
  readonly slice?: (reading: { stdout: string; stderr: string; exitCode: number }) => string;
}

/** One grid cell — a unit × a stream. */
export interface Cell {
  /** The cell's id: `<unit>.<stream>`. */
  readonly id: string;
  /** The unit it belongs to. */
  readonly unit: string;
  /** The unit's face. */
  readonly face: Face;
  /** The unit's route. */
  readonly route: Route;
  /** The stream. */
  readonly stream: Stream;
  /** Whether the cell carries a recording. */
  readonly applicable: boolean;
  /** The unit's probe, or undefined for a not-applicable cell. */
  readonly probe?: Probe;
  /** The unit's slice, when the cell reads a projection rather than a stream. */
  readonly slice?: Unit["slice"];
}

/** The plan path the fixture declares, spelled repo-relative for every argv. */
const PLAN = PLAN_REL;

/** A preview argv — the `--dry-run` face (face 7) over one tree shape. */
const previewOf = (shape: TreeShape): Probe => ({
  fixture: shape,
  argv: ["implement", "--tasks", "1", "--plan", PLAN, "--dry-run"],
  dispatch: false,
});

/** The dispatch's normal argv — one task of the fixture plan. */
const implementArgv = ["implement", "--tasks", "1", "--plan", PLAN];

/** The units of the grid, in roster order. */
export const UNITS: readonly Unit[] = [
  // ---- face 1: the eight commands, three routes each -------------------------------
  {
    key: "f1.implement.normal",
    face: "f1",
    route: "normal",
    probe: { fixture: "wave", argv: implementArgv, dispatch: true },
  },
  {
    key: "f1.implement.refusal",
    face: "f1",
    route: "refusal",
    probe: { fixture: "empty", argv: implementArgv, dispatch: true },
  },
  {
    key: "f1.implement.failure",
    face: "f1",
    route: "failure",
    probe: { fixture: "wave", argv: [...implementArgv, "--tasks", "9"], dispatch: true },
  },
  {
    key: "f1.review.normal",
    face: "f1",
    route: "normal",
    probe: {
      fixture: "wave",
      argv: ["review", "--type", "phase-spec", "--spec", PLAN],
      dispatch: true,
    },
  },
  {
    key: "f1.review.refusal",
    face: "f1",
    route: "refusal",
    probe: {
      fixture: "empty",
      argv: ["review", "--type", "phase-spec", "--spec", PLAN],
      dispatch: true,
    },
  },
  {
    key: "f1.review.failure",
    face: "f1",
    route: "failure",
    probe: {
      fixture: "wave",
      argv: ["review", "--type", "single-spec", "--spec", PLAN],
      dispatch: true,
    },
  },
  {
    key: "f1.fix.normal",
    face: "f1",
    route: "normal",
    probe: {
      fixture: "wave",
      argv: ["fix", "--type", "phase-spec", "--spec", PLAN, "--reviews", `${PLAN}.reviews.json`],
      dispatch: true,
    },
  },
  {
    key: "f1.fix.refusal",
    face: "f1",
    route: "refusal",
    probe: {
      fixture: "empty",
      argv: ["fix", "--type", "phase-spec", "--spec", PLAN, "--reviews", `${PLAN}.reviews.json`],
      dispatch: true,
    },
  },
  {
    key: "f1.fix.failure",
    face: "f1",
    route: "failure",
    probe: {
      fixture: "wave",
      argv: ["fix", "--type", "wave", "--tasks", "1"],
      dispatch: true,
    },
  },
  {
    key: "f1.base-set.normal",
    face: "f1",
    route: "normal",
    probe: {
      fixture: "wave",
      argv: ["base", "set", "--plan", PLAN, "--base", "main", "--source", "plan-field", "--force"],
    },
  },
  {
    key: "f1.base-set.refusal",
    face: "f1",
    route: "refusal",
    probe: {
      fixture: "branch-closed",
      argv: ["base", "set", "--plan", PLAN, "--base", "main", "--source", "plan-field"],
    },
  },
  {
    key: "f1.base-set.failure",
    face: "f1",
    route: "failure",
    probe: { fixture: "empty", argv: ["base", "set", "--plan", PLAN] },
  },
  {
    key: "f1.base-get.normal",
    face: "f1",
    route: "normal",
    probe: { fixture: "wave", argv: ["base", "get"] },
  },
  { key: "f1.base-get.refusal", face: "f1", route: "not-applicable" },
  {
    key: "f1.base-get.failure",
    face: "f1",
    route: "failure",
    probe: { fixture: "empty", argv: ["base", "get"] },
  },
  {
    key: "f1.schema-get.normal",
    face: "f1",
    route: "normal",
    probe: { fixture: "empty", argv: ["schema", "get", "plan"] },
  },
  { key: "f1.schema-get.refusal", face: "f1", route: "not-applicable" },
  {
    key: "f1.schema-get.failure",
    face: "f1",
    route: "failure",
    probe: {
      fixture: "empty",
      argv: ["schema", "get", "plan", "--output", "skeleton", "/nonexistent-parity/target.md"],
    },
  },
  {
    key: "f1.issue-render.normal",
    face: "f1",
    route: "normal",
    probe: { fixture: "empty", argv: ["issue", "render"], stdin: ISSUE_STDIN },
  },
  { key: "f1.issue-render.refusal", face: "f1", route: "not-applicable" },
  {
    key: "f1.issue-render.failure",
    face: "f1",
    route: "failure",
    probe: { fixture: "empty", argv: ["issue", "render"], stdin: "{ not json" },
  },
  {
    key: "f1.board.normal",
    face: "f1",
    route: "normal",
    probe: { fixture: "wave", argv: ["board", "--plan", PLAN] },
  },
  {
    key: "f1.board.refusal",
    face: "f1",
    route: "refusal",
    probe: { fixture: "empty", argv: ["board", "--plan", PLAN] },
  },
  {
    key: "f1.board.failure",
    face: "f1",
    route: "failure",
    probe: { fixture: "wave", argv: ["board", "--spec", PLAN] },
  },
  {
    key: "f1.init.normal",
    face: "f1",
    route: "normal",
    probe: { fixture: "empty", argv: ["init", "--harness", "claude"], standIn: true },
  },
  {
    key: "f1.init.refusal",
    face: "f1",
    route: "refusal",
    probe: { fixture: "empty", argv: ["init"] },
  },
  {
    key: "f1.init.failure",
    face: "f1",
    route: "failure",
    probe: {
      fixture: "empty",
      argv: ["init", "--harness", "claude"],
      standIn: true,
      failingRunner: true,
    },
  },
  // ---- face 2: the help / usage / misuse shape ------------------------------------
  { key: "f2.help", face: "f2", route: "normal", probe: { fixture: "empty", argv: ["--help"] } },
  { key: "f2.usage", face: "f2", route: "refusal", probe: { fixture: "empty", argv: ["base"] } },
  {
    key: "f2.misuse",
    face: "f2",
    route: "failure",
    probe: { fixture: "empty", argv: ["implement", "--tasks", "1", "--plan", PLAN, "--bogus"] },
  },
  // ---- face 3: the four skeleton families (in process, frozen date) ----------------
  {
    key: "f3.skeleton.overall",
    face: "f3",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "skeleton:overall" },
  },
  {
    key: "f3.skeleton.plan",
    face: "f3",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "skeleton:plan" },
  },
  {
    key: "f3.skeleton.phase-spec",
    face: "f3",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "skeleton:phase-spec" },
  },
  {
    key: "f3.skeleton.single-spec",
    face: "f3",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "skeleton:single-spec" },
  },
  {
    key: "f3.skeleton-landing",
    face: "f3",
    route: "normal",
    probe: {
      fixture: "empty",
      argv: ["schema", "get", "plan", "--output", "skeleton", "docs/kairos/plans/landed.md"],
    },
    slice: (reading) => (reading.exitCode === 0 ? "target-written" : "target-refused"),
  },
  // ---- face 4: the prompt bands ---------------------------------------------------
  {
    key: "f4.prompt.implement",
    face: "f4",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "prompt:implement" },
  },
  {
    key: "f4.prompt.fix",
    face: "f4",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "prompt:fix" },
  },
  {
    key: "f4.prompt.docs-fix",
    face: "f4",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "prompt:docs-fix" },
  },
  {
    key: "f4.review.wave",
    face: "f4",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "review:wave" },
  },
  {
    key: "f4.review.branch",
    face: "f4",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "review:branch" },
  },
  {
    key: "f4.review.phase-spec",
    face: "f4",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "review:phase-spec" },
  },
  {
    key: "f4.review.overall",
    face: "f4",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "review:overall" },
  },
  {
    key: "f4.review.plan",
    face: "f4",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "review:plan" },
  },
  {
    key: "f4.review.single-spec",
    face: "f4",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "review:single-spec" },
  },
  // ---- face 5: the capsule bytes --------------------------------------------------
  {
    key: "f5.capsule.success",
    face: "f5",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "capsule:success" },
  },
  {
    key: "f5.capsule.failure",
    face: "f5",
    route: "normal",
    probe: { fixture: "empty", argv: [], render: "capsule:failure" },
  },
  // ---- face 6: the board, notes unexpanded and expanded ---------------------------
  {
    key: "f6.board.unexpanded",
    face: "f6",
    route: "normal",
    probe: { fixture: "wave", argv: ["board", "--plan", PLAN] },
  },
  {
    key: "f6.board.expanded",
    face: "f6",
    route: "normal",
    probe: { fixture: "wave", argv: ["board", "--plan", PLAN, "--notes"] },
  },
  // ---- face 7: the dry-run preview ------------------------------------------------
  { key: "f7.preview.passing", face: "f7", route: "normal", probe: previewOf("wave") },
  {
    key: "f7.preview.holding-absent",
    face: "f7",
    route: "normal",
    probe: previewOf("branch-closed"),
  },
  { key: "f7.preview.holding-held", face: "f7", route: "normal", probe: previewOf("inflight") },
  { key: "f7.preview.holding-corrupt", face: "f7", route: "normal", probe: previewOf("empty") },
  { key: "f7.preview.blocking", face: "f7", route: "normal", probe: previewOf("refused") },
  // ---- face 8: the blocked face ---------------------------------------------------
  {
    key: "f8.blocked.message",
    face: "f8",
    route: "refusal",
    probe: { fixture: "refused", argv: implementArgv, dispatch: true },
    slice: (reading) => blockedLines(reading.stdout, "CDD_BLOCKED"),
  },
  {
    key: "f8.blocked.checked",
    face: "f8",
    route: "refusal",
    probe: { fixture: "refused", argv: implementArgv, dispatch: true },
    slice: (reading) => blockedLines(reading.stdout, "checked:"),
  },
  {
    key: "f8.blocked.station",
    face: "f8",
    route: "refusal",
    probe: { fixture: "refused", argv: implementArgv, dispatch: true },
    slice: (reading) => blockedLines(reading.stderr, "station"),
  },
  {
    key: "f8.blocked.yielding",
    face: "f8",
    route: "refusal",
    probe: { fixture: "refused", argv: implementArgv, dispatch: true },
    slice: (reading) => blockedLines(reading.stderr, "yield"),
  },
];

/** The lines of one stream that start with a marker — the blocked face's slices. */
const blockedLines = (text: string, marker: string): string =>
  text
    .split("\n")
    .filter((line) => line.includes(marker))
    .join("\n");

/** Every cell of the grid — one per unit stream. */
export const CELLS: readonly Cell[] = UNITS.flatMap((unit) =>
  STREAMS.map((stream) => ({
    id: `${unit.key}.${stream}`,
    unit: unit.key,
    face: unit.face,
    route: unit.route,
    stream,
    applicable: unit.route !== "not-applicable",
    probe: unit.probe,
    slice: unit.slice,
  })),
);

/** One cell's id form — kept as one spelling so a report and the roster agree. */
export const cellId = (unit: string, stream: Stream): string => `${unit}.${stream}`;

/** The grid, exported for the harness's roster checks. */
export const GRID = CELLS;

/** The frozen date every skeleton cell is recorded under. */
export const GRID_FROZEN_DATE = FROZEN_DATE;

/** The seven tree shapes, re-exported so a case can count them without a second list. */
export const TREE_SHAPES_TEXT = TREE_SHAPES;

/** The three non-tree fixtures, exposed so a report can name them. */
export const NON_TREE_FIXTURES = { plantPathStandIn, RecordingStepRunner } as const;
