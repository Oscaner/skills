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
// The refusal route is declared PER CAUSE, not once per command: the wave gate's five
// reasons and the four pre-dispatch stations each get their own unit, because a gate row
// that stopped refusing is invisible in a single "refusal" cell. The failure route is the
// round's own BLOCKED conclusion (a command's `DispatchOutcome`), except where the old
// tree has a deliberate injected fault (`init`) or an input contract (`issue render`) —
// freezing the V8 text of an unhandled TypeError on a malformed ledger would make the
// corpus demand that the new tree reproduce a crash.
//
// The grid is declared once and never re-derived: each unit names the wiring task and the
// producer landing its cells wait on, the roster in `GRID-WIRING.md` is generated from
// exactly this table, and the harness joins the two by cell id.

import {
  FROZEN_DATE,
  ISSUE_STDIN,
  plantPathStandIn,
  RecordingStepRunner,
} from "./fixtures/non-tree.ts";
import {
  PLAN_REL,
  SPEC_REL,
  TREE_SHAPES,
  type TreeOptions,
  type TreeShape,
} from "./fixtures/trees.ts";

/** One stream a cell records. */
export type Stream = "stdout" | "stderr" | "exit-code";

/** The three streams, in the order a cell is derived from one probe. */
export const STREAMS: readonly Stream[] = ["stdout", "stderr", "exit-code"];

/** What a run left at the target it was told to write. */
export interface Landing {
  /** The repo-relative path the run wrote (the probe's declared target). */
  readonly path: string;
  /** `absent` — nothing there; `empty` — a file with no bytes; `written` — bytes. */
  readonly kind: "absent" | "empty" | "written";
  /** The written bytes' sha256, or the empty string when nothing was written. */
  readonly digest: string;
}

/** One probe's reading — the three streams, plus what the run left at its target. The
 *  landing fact is taken INSIDE the run: the fixture tree is removed the moment the run
 *  ends, so a post-run directory read would see nothing at all. */
export interface ProbeReading {
  /** Standard output. */
  readonly stdout: string;
  /** Standard error. */
  readonly stderr: string;
  /** The process exit code. */
  readonly exitCode: number;
  /** The landing fact, or undefined for a probe that declares no target. */
  readonly landing?: Landing;
}

/** How one unit's cells are projected: a per-STREAM override of the default read. A
 *  stream with no override records its own bytes — an exit code stays an exit code. */
export type Projections = Readonly<Partial<Record<Stream, (reading: ProbeReading) => string>>>;

/** The eight frozen faces of spec §2.2. */
export type Face = "f1" | "f2" | "f3" | "f4" | "f5" | "f6" | "f7" | "f8";

/** One route of a command. */
export type Route = "normal" | "refusal" | "failure" | "not-applicable";

/** A holder's identity facts, when a fixture needs a live or dead process. */
export interface HolderFacts {
  readonly pid: number;
  readonly startedAt: number;
}

/** The conclusions the dispatch seam answers — the round's own status vocabulary. */
export type Conclusion = "APPROVED" | "CHANGES_REQUESTED" | "BLOCKED";

/** One prior step on the same tree — a round the observed run needs on record, or a
 *  byte change the corpus plants between two rounds. `argv` absent means the step only
 *  writes (a tamper is not a run). */
export interface PriorStep {
  /** The argv handed to the old CLI. */
  readonly argv?: readonly string[];
  /** The dispatch conclusion this run's round records. */
  readonly verdict?: Conclusion;
  /** A file the step plants in the tree AFTER its run (`{path, text}`) — how a
   *  tampered carrier or a misplaced sidecar is built between two runs. */
  readonly write?: { readonly path: string; readonly text: string };
}

/** One probe — one old-tree execution whose three streams feed a unit's cells. */
export interface Probe {
  readonly fixture: TreeShape;
  /** The fixture's knobs — the plan's width and the ledger state it carries. */
  readonly options?: TreeOptions;
  /** The argv handed to the old CLI (relative to the fixture's root, which is the cwd). */
  readonly argv: readonly string[];
  /** Whether the hermetic dispatch step is injected, and which conclusion it answers. */
  readonly dispatch?: boolean;
  /** The dispatch conclusion the observed run records (`APPROVED` when absent). */
  readonly verdict?: Conclusion;
  /** Prior runs on the same tree, in order. */
  readonly before?: readonly PriorStep[];
  /** Whether the step runner throws (the `init` failure route). */
  readonly failingRunner?: boolean;
  /** The `PATH` stand-in directory to prepend, when the probe needs a harness on PATH. */
  readonly standIn?: boolean;
  /** The stdin body the command reads. */
  readonly stdin?: string;
  /** Run with every harness marker removed — the `no-host` station's input. */
  readonly hostless?: boolean;
  /** The in-process render key, when the probe drives a renderer instead of a command. */
  readonly render?: string;
  /** The repo-relative path the run is expected to write — the landing fact's target. */
  readonly target?: string;
}

/** One unit — one probe run and the streams read off it. */
export interface Unit {
  /** The unit's key — its cells' id prefix. */
  readonly key: string;
  /** The face the unit belongs to. */
  readonly face: Face;
  /** The route the unit exercises. */
  readonly route: Route;
  /** The wiring task that makes this cell byte-comparable (`—` when inapplicable). */
  readonly task: string;
  /** The producer's landing on the new tree: `<src-relative module>#<export name>`. */
  readonly producer: string;
  /** The probe; absent exactly when the route does not apply. */
  readonly probe?: Probe;
  /** How a cell's value is taken off the reading; a stream with no entry records its
   *  own bytes (or its own exit code). */
  readonly project?: Projections;
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
  /** The wiring task the roster names for this cell. */
  readonly task: string;
  /** The producer landing the roster names for this cell. */
  readonly producer: string;
  /** The unit's probe, or undefined for a not-applicable cell. */
  readonly probe?: Probe;
  /** The unit's projection, when the cell reads a fact rather than a whole stream. */
  readonly project?: Projections;
}

/** The plan path the fixture declares, spelled repo-relative for every argv. */
const PLAN = PLAN_REL;

/** The phase-spec path — the `--spec` target of every `--type phase-spec` probe. */
const SPEC = SPEC_REL;

/** The carrier a phase-spec review round leaves behind — the fix face's `--reviews`. */
const REVIEWS = `.kairos/cdd/p9/phase-spec-review-1.c1.json`;

/** The rulings sidecar a review round may carry — the `artifact` station's input. Its
 *  name drops the `.c<cycle>` tag, so it attributes to the reviewed round's identity
 *  while sitting off the rendered name: the `misplaced` arm. */
const RULINGS = `.kairos/cdd/p9/phase-spec-review-1.rulings.json`;

/** The live holder — this process, resolved by the harness (the corpus's only live
 *  process), so the record reads as a standing dispatch. */
const LIVE_HOLDER = "live" as const;

/** One dead holder — pid 1, started at an instant the recording can clamp: the
 *  rendered uptime floors to `0m` on every run, so the held block's byte is stable. */
const DEAD_HOLDER: HolderFacts = { pid: 1, startedAt: 4102444800000 };

/** The dispatch argv of one task of the fixture plan. */
const implementArgv = ["implement", "--tasks", "1", "--plan", PLAN];

/** The phase-spec review argv. */
const reviewSpecArgv = ["review", "--type", "phase-spec", "--spec", SPEC];

/** The phase-spec fix argv — the carrier the review round wrote. */
const fixSpecArgv = ["fix", "--type", "phase-spec", "--spec", SPEC, "--reviews", REVIEWS];

/** A preview argv — the `--dry-run` face (face 7) over one tree. */
const previewOf = (options?: TreeOptions): Probe => ({
  fixture: "wave",
  options,
  argv: ["implement", "--tasks", "1", "--plan", PLAN, "--dry-run"],
});

/** A tampered carrier — a byte change after the round recorded the digest. */
const TAMPERED_CARRIER = `${JSON.stringify(
  {
    status: "CHANGES_REQUESTED",
    findings: [
      { id: "F1", severity: "blocker", summary: "the guard is missing" },
      { id: "F9", severity: "blocker", summary: "smuggled" },
    ],
  },
  null,
  2,
)}\n`;

/** A rulings sidecar whose carrier it does not belong beside — the `misplaced` arm. */
const MISPLACED_RULINGS = `${JSON.stringify(
  { carrier: "phase-spec-review-1.c1.json", rulings: [{ finding: "F1", ruling: "ACCEPTED" }] },
  null,
  2,
)}\n`;

/** The implement round every phase-spec round needs ahead of it (the pipeline's
 *  frontier: the wave's implement round closes first). */
const IMPLEMENT_ROUND: PriorStep = { argv: implementArgv, verdict: "APPROVED" };

/** The review round that leaves a pending fix — the round the fix face answers. */
const REVIEW_ROUND: PriorStep = { argv: reviewSpecArgv, verdict: "CHANGES_REQUESTED" };

/** A review round on record, then a byte change on its carrier. */
const reviewThenTamper: readonly PriorStep[] = [
  IMPLEMENT_ROUND,
  REVIEW_ROUND,
  { write: { path: REVIEWS, text: TAMPERED_CARRIER } },
];

/** A review round on record, then a rulings sidecar that sits off its rendered name. */
const reviewThenMisplace: readonly PriorStep[] = [
  IMPLEMENT_ROUND,
  REVIEW_ROUND,
  { write: { path: RULINGS, text: MISPLACED_RULINGS } },
];

/** The units of the grid, in roster order. */
export const UNITS: readonly Unit[] = [
  // ---- face 1: the eight commands, three routes each -------------------------------
  {
    key: "f1.implement.normal",
    face: "f1",
    route: "normal",
    task: "T16",
    producer: "surface/commands/implement.ts#ImplementCommand",
    probe: { fixture: "wave", argv: implementArgv, dispatch: true },
  },
  {
    key: "f1.implement.refusal.wrong-phase",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/implement.ts#ImplementCommand",
    probe: {
      fixture: "wave",
      options: { rounds: "implement" },
      argv: implementArgv,
      dispatch: true,
    },
  },
  {
    key: "f1.implement.refusal.split",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/implement.ts#ImplementCommand",
    probe: { fixture: "wave", options: { tasks: 2 }, argv: implementArgv, dispatch: true },
  },
  {
    key: "f1.implement.refusal.wave-too-wide",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/implement.ts#ImplementCommand",
    probe: {
      fixture: "wave",
      options: { tasks: 4 },
      argv: ["implement", "--tasks", "1,2,3,4", "--plan", PLAN],
      dispatch: true,
    },
  },
  {
    key: "f1.implement.refusal.too-many-tasks",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/implement.ts#ImplementCommand",
    probe: {
      fixture: "wave",
      options: { tasks: 5, chain: true },
      argv: ["implement", "--tasks", "1,2,3,4", "--plan", PLAN],
      dispatch: true,
    },
  },
  {
    key: "f1.implement.refusal.mixed-batch",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/implement.ts#ImplementCommand",
    probe: {
      fixture: "wave",
      options: { tasks: 2, rounds: "closed", snapshot: false },
      argv: ["implement", "--tasks", "2", "--plan", PLAN],
      dispatch: true,
    },
  },
  {
    key: "f1.implement.refusal.in-flight",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/implement.ts#ImplementCommand",
    probe: {
      fixture: "inflight",
      options: { holder: LIVE_HOLDER },
      argv: implementArgv,
      dispatch: true,
    },
  },
  {
    key: "f1.implement.refusal.no-host",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/implement.ts#ImplementCommand",
    probe: { fixture: "wave", argv: implementArgv, dispatch: true, hostless: true },
  },
  {
    key: "f1.implement.failure",
    face: "f1",
    route: "failure",
    task: "T16",
    producer: "surface/commands/implement.ts#ImplementCommand",
    probe: { fixture: "wave", argv: implementArgv, dispatch: true, verdict: "BLOCKED" },
  },
  {
    key: "f1.review.normal",
    face: "f1",
    route: "normal",
    task: "T16",
    producer: "surface/commands/review.ts#ReviewCommand",
    probe: { fixture: "wave", argv: reviewSpecArgv, dispatch: true },
  },
  {
    key: "f1.review.refusal.dispatch-input",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/review.ts#ReviewCommand",
    // `--type wave` with no `--base` artifact on the tree: the review face's
    // `BASE_BRANCH` cell is empty, which is the `dispatch-input` station's own shape.
    probe: {
      fixture: "doc-drift",
      argv: ["review", "--type", "wave", "--tasks", "1", "--plan", PLAN],
      dispatch: true,
    },
  },
  {
    key: "f1.review.refusal.unreadable-document",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/review.ts#ReviewCommand",
    probe: { fixture: "empty", argv: reviewSpecArgv, dispatch: true },
  },
  {
    key: "f1.review.failure",
    face: "f1",
    route: "failure",
    task: "T16",
    producer: "surface/commands/review.ts#ReviewCommand",
    probe: { fixture: "wave", argv: reviewSpecArgv, dispatch: true, verdict: "BLOCKED" },
  },
  {
    key: "f1.fix.normal",
    face: "f1",
    route: "normal",
    task: "T16",
    producer: "surface/commands/fix.ts#FixCommand",
    probe: {
      fixture: "wave",
      argv: fixSpecArgv,
      dispatch: true,
      before: [IMPLEMENT_ROUND, REVIEW_ROUND],
    },
  },
  {
    key: "f1.fix.refusal.carrier",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/fix.ts#FixCommand",
    probe: { fixture: "wave", argv: fixSpecArgv, dispatch: true, before: reviewThenTamper },
  },
  {
    key: "f1.fix.refusal.artifact",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/fix.ts#FixCommand",
    probe: { fixture: "wave", argv: fixSpecArgv, dispatch: true, before: reviewThenMisplace },
  },
  {
    key: "f1.fix.failure",
    face: "f1",
    route: "failure",
    task: "T16",
    producer: "surface/commands/fix.ts#FixCommand",
    probe: {
      fixture: "wave",
      argv: fixSpecArgv,
      dispatch: true,
      verdict: "BLOCKED",
      before: [IMPLEMENT_ROUND, REVIEW_ROUND],
    },
  },
  {
    key: "f1.base-set.normal",
    face: "f1",
    route: "normal",
    task: "T16",
    producer: "surface/commands/base.ts#BaseCommand",
    probe: {
      fixture: "wave",
      argv: ["base", "set", "--plan", PLAN, "--base", "main", "--source", "plan-field", "--force"],
    },
  },
  {
    key: "f1.base-set.refusal",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/base.ts#BaseCommand",
    // The conflict arm: an existing artifact whose base differs, no `--force`. The
    // engine renders it on the usage channel (exit 2) — a declared value, not a misuse.
    probe: {
      fixture: "branch-closed",
      argv: ["base", "set", "--plan", PLAN, "--base", "main", "--source", "plan-field"],
    },
  },
  {
    key: "f1.base-set.failure",
    face: "f1",
    route: "not-applicable",
    task: "—",
    producer: "—",
  },
  {
    key: "f1.base-get.normal",
    face: "f1",
    route: "normal",
    task: "T16",
    producer: "surface/commands/base.ts#BaseCommand",
    probe: { fixture: "wave", argv: ["base", "get", "--plan", PLAN] },
  },
  {
    key: "f1.base-get.refusal.absent",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/base.ts#BaseCommand",
    probe: { fixture: "doc-drift", argv: ["base", "get", "--plan", PLAN] },
  },
  {
    key: "f1.base-get.refusal.corrupt",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/base.ts#BaseCommand",
    probe: {
      fixture: "wave",
      argv: ["base", "get", "--plan", PLAN],
      before: [{ write: { path: ".kairos/cdd/p9/base.json", text: "{ not json" } }],
    },
  },
  {
    key: "f1.base-get.failure",
    face: "f1",
    route: "not-applicable",
    task: "—",
    producer: "—",
  },
  {
    key: "f1.schema-get.normal",
    face: "f1",
    route: "normal",
    task: "T16",
    producer: "surface/commands/schema.ts#SchemaCommand",
    probe: { fixture: "empty", argv: ["schema", "get", "plan"] },
  },
  { key: "f1.schema-get.refusal", face: "f1", route: "not-applicable", task: "—", producer: "—" },
  { key: "f1.schema-get.failure", face: "f1", route: "not-applicable", task: "—", producer: "—" },
  {
    key: "f1.issue-render.normal",
    face: "f1",
    route: "normal",
    task: "T16",
    producer: "surface/commands/issue.ts#IssueCommand",
    probe: { fixture: "empty", argv: ["issue", "render"], stdin: ISSUE_STDIN },
  },
  { key: "f1.issue-render.refusal", face: "f1", route: "not-applicable", task: "—", producer: "—" },
  {
    key: "f1.issue-render.failure",
    face: "f1",
    route: "failure",
    task: "T16",
    producer: "surface/commands/issue.ts#IssueCommand",
    probe: { fixture: "empty", argv: ["issue", "render"], stdin: "{ not json" },
  },
  {
    key: "f1.board.normal",
    face: "f1",
    route: "normal",
    task: "T16",
    producer: "surface/commands/board.ts#BoardCommand",
    probe: { fixture: "wave", argv: ["board", "--plan", PLAN] },
  },
  {
    key: "f1.board.refusal.carrier",
    face: "f1",
    route: "refusal",
    task: "T16",
    producer: "surface/commands/board.ts#BoardCommand",
    probe: { fixture: "wave", argv: ["board", "--plan", PLAN], before: reviewThenTamper },
  },
  { key: "f1.board.failure", face: "f1", route: "not-applicable", task: "—", producer: "—" },
  {
    key: "f1.init.normal",
    face: "f1",
    route: "normal",
    task: "T15",
    producer: "surface/render/init.ts#InitRenderer",
    probe: { fixture: "empty", argv: ["init", "--harness", "claude"], standIn: true },
  },
  { key: "f1.init.refusal", face: "f1", route: "not-applicable", task: "—", producer: "—" },
  {
    key: "f1.init.failure",
    face: "f1",
    route: "failure",
    task: "T15",
    producer: "surface/render/init.ts#InitRenderer",
    probe: {
      fixture: "empty",
      argv: ["init", "--harness", "claude"],
      standIn: true,
      failingRunner: true,
    },
  },
  // ---- face 2: the help / usage / misuse shape ------------------------------------
  {
    key: "f2.help",
    face: "f2",
    route: "normal",
    task: "T16",
    producer: "surface/index.ts#Cli",
    probe: { fixture: "empty", argv: ["--help"] },
  },
  {
    key: "f2.usage",
    face: "f2",
    route: "refusal",
    task: "T16",
    producer: "surface/index.ts#Cli",
    probe: { fixture: "empty", argv: ["base"] },
  },
  {
    key: "f2.misuse",
    face: "f2",
    route: "failure",
    task: "T16",
    producer: "surface/index.ts#Cli",
    probe: { fixture: "empty", argv: ["implement", "--tasks", "1", "--plan", PLAN, "--bogus"] },
  },
  // ---- face 3: the four skeleton families (in process, frozen date) ----------------
  {
    key: "f3.skeleton.overall",
    face: "f3",
    route: "normal",
    task: "T9",
    producer: "docs/skeleton/assembler.ts#SkeletonAssembler",
    probe: { fixture: "empty", argv: [], render: "skeleton:overall" },
  },
  {
    key: "f3.skeleton.plan",
    face: "f3",
    route: "normal",
    task: "T9",
    producer: "docs/skeleton/assembler.ts#SkeletonAssembler",
    probe: { fixture: "empty", argv: [], render: "skeleton:plan" },
  },
  {
    key: "f3.skeleton.phase-spec",
    face: "f3",
    route: "normal",
    task: "T9",
    producer: "docs/skeleton/assembler.ts#SkeletonAssembler",
    probe: { fixture: "empty", argv: [], render: "skeleton:phase-spec" },
  },
  {
    key: "f3.skeleton.single-spec",
    face: "f3",
    route: "normal",
    task: "T9",
    producer: "docs/skeleton/assembler.ts#SkeletonAssembler",
    probe: { fixture: "empty", argv: [], render: "skeleton:single-spec" },
  },
  {
    key: "f3.skeleton-landing",
    face: "f3",
    route: "normal",
    task: "T16",
    producer: "surface/commands/schema.ts#SchemaCommand",
    probe: {
      fixture: "empty",
      argv: ["schema", "get", "plan", "--output", "skeleton", "landed.md"],
      target: "landed.md",
    },
    // The landing FACT, plus the path the command echoed: does the target file get
    // written and is it non-empty? The skeleton's `date:` line is today's clock, so the
    // file's own bytes are never recorded here — `f3.skeleton.*` carries the content
    // face under the corpus's frozen date. The exit code keeps its own cell.
    project: {
      stdout: (reading) => `${reading.stdout.trim()} target=${reading.landing?.kind ?? "unread"}`,
    },
  },
  // ---- face 4: the prompt bands ---------------------------------------------------
  ...[
    ["implement", "modes"],
    ["fix", "modes"],
    ["docs-fix", "modes"],
    ["wave", "reviews"],
    ["branch", "reviews"],
    ["phase-spec", "reviews"],
    ["overall", "reviews"],
    ["plan", "reviews"],
    ["single-spec", "reviews"],
  ].map(
    ([name, band]): Unit => ({
      key: `f4.${band === "modes" ? "prompt" : "review"}.${name}`,
      face: "f4",
      route: "normal",
      task: "T15",
      producer: "surface/render/templates.ts#TEMPLATE_PROMPT",
      probe: {
        fixture: "empty",
        argv: [],
        render: `${band === "modes" ? "prompt" : "review"}:${name}`,
      },
    }),
  ),
  // ---- face 5: the capsule bytes --------------------------------------------------
  {
    key: "f5.capsule.success",
    face: "f5",
    route: "normal",
    task: "T15",
    producer: "surface/render/capsule.ts#Capsule",
    probe: { fixture: "empty", argv: [], render: "capsule:success" },
  },
  {
    key: "f5.capsule.failure",
    face: "f5",
    route: "normal",
    task: "T15",
    producer: "surface/render/capsule.ts#Capsule",
    probe: { fixture: "empty", argv: [], render: "capsule:failure" },
  },
  // ---- face 6: the board, notes unexpanded and expanded ---------------------------
  {
    key: "f6.board.unexpanded",
    face: "f6",
    route: "normal",
    task: "T16",
    producer: "surface/render/board.ts#BoardView",
    // A wave row whose review round left a carrier carrying the child's own note: the
    // two states of §2.2 #6 differ only by what `--notes` opens, so the tree must carry
    // the note — an unexpanded and an expanded cell over a note-less tree are one cell.
    probe: { fixture: "wave", options: { rounds: "review" }, argv: ["board", "--plan", PLAN] },
  },
  {
    key: "f6.board.expanded",
    face: "f6",
    route: "normal",
    task: "T16",
    producer: "surface/render/board.ts#BoardView",
    probe: {
      fixture: "wave",
      options: { rounds: "review" },
      argv: ["board", "--plan", PLAN, "--notes"],
    },
  },
  // ---- face 7: the dry-run preview ------------------------------------------------
  {
    key: "f7.preview.passing",
    face: "f7",
    route: "normal",
    task: "T15",
    producer: "surface/render/preview.ts#Preview",
    probe: previewOf(),
  },
  {
    key: "f7.preview.holding-live",
    face: "f7",
    route: "normal",
    task: "T15",
    producer: "surface/render/preview.ts#Preview",
    probe: { ...previewOf(), fixture: "inflight", options: { holder: LIVE_HOLDER } },
  },
  {
    key: "f7.preview.holding-dead",
    face: "f7",
    route: "normal",
    task: "T15",
    producer: "surface/render/preview.ts#Preview",
    probe: { ...previewOf(), fixture: "stale-holder", options: { holder: DEAD_HOLDER } },
  },
  {
    key: "f7.preview.holding-corrupt",
    face: "f7",
    route: "normal",
    task: "T15",
    producer: "surface/render/preview.ts#Preview",
    probe: previewOf({ corruptLock: true }),
  },
  {
    key: "f7.preview.init",
    face: "f7",
    route: "normal",
    task: "T15",
    producer: "surface/render/init.ts#InitRenderer",
    // `init` carries the `--dry-run` flag too (a program flag, not a work command):
    // its preview block is the `would run:` sequence plus the dry-run summary.
    probe: { fixture: "empty", argv: ["init", "--harness", "claude", "--dry-run"], standIn: true },
  },
  {
    key: "f7.preview.blocking",
    face: "f7",
    route: "normal",
    task: "T15",
    producer: "surface/render/preview.ts#Preview",
    probe: { ...previewOf(), hostless: true },
  },
  // ---- face 8: the blocked face ---------------------------------------------------
  // One blocked dispatch, four projections of it: the `CDD_BLOCKED` sentence, the
  // station word it is led by, the `checked:` row set behind it, and the yield rows
  // (`skipped …`) inside that set. An in-flight holder is the shape that reaches the
  // blocked channel without an argv-level refusal in front of it.
  {
    key: "f8.blocked.message",
    face: "f8",
    route: "refusal",
    task: "T14",
    producer: "surface/words/words.ts#Words",
    probe: {
      fixture: "inflight",
      options: { holder: LIVE_HOLDER },
      argv: implementArgv,
      dispatch: true,
    },
    project: { stderr: (reading) => blockedLines(reading.stderr, "CDD_BLOCKED") },
  },
  {
    key: "f8.blocked.checked",
    face: "f8",
    route: "refusal",
    task: "T14",
    producer: "surface/words/words.ts#Words",
    probe: {
      fixture: "inflight",
      options: { holder: LIVE_HOLDER },
      argv: implementArgv,
      dispatch: true,
    },
    project: { stderr: (reading) => checkedBlock(reading.stderr) },
  },
  {
    key: "f8.blocked.station",
    face: "f8",
    route: "refusal",
    task: "T11",
    producer: "run/gate/preflight.ts#PreFlight",
    probe: {
      fixture: "inflight",
      options: { holder: LIVE_HOLDER },
      argv: implementArgv,
      dispatch: true,
    },
    project: { stderr: (reading) => stationOf(reading.stderr) },
  },
  {
    key: "f8.blocked.yielding",
    face: "f8",
    route: "refusal",
    task: "T11",
    producer: "run/gate/preflight.ts#PreFlight",
    probe: {
      fixture: "inflight",
      options: { holder: LIVE_HOLDER },
      argv: implementArgv,
      dispatch: true,
    },
    project: { stderr: (reading) => blockedLines(reading.stderr, "skipped") },
  },
];

/** The lines of one stream that contain a marker — the blocked face's slices. */
const blockedLines = (text: string, marker: string): string =>
  text
    .split("\n")
    .filter((line) => line.includes(marker))
    .join("\n");

/** The `checked:` row set — the block that starts at its header and runs to the stream's
 *  last line (the blocked face prints it after the refusal). */
const checkedBlock = (text: string): string => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === "checked:");
  return start === -1 ? "" : lines.slice(start).join("\n").trimEnd();
};

/** The station word a `CDD_BLOCKED` line is led by — the segment between the station
 *  anchor and the table's separator. */
const stationOf = (text: string): string => {
  const line = text.split("\n").find((candidate) => candidate.startsWith("CDD_BLOCKED: "));
  if (line === undefined) return "";
  return (line.slice("CDD_BLOCKED: ".length).split(" · ")[0] ?? "").trim();
};

/** Every cell of the grid — one per unit stream. */
export const CELLS: readonly Cell[] = UNITS.flatMap((unit) =>
  STREAMS.map((stream) => ({
    id: `${unit.key}.${stream}`,
    unit: unit.key,
    face: unit.face,
    route: unit.route,
    stream,
    applicable: unit.route !== "not-applicable",
    task: unit.task,
    producer: unit.producer,
    probe: unit.probe,
    project: unit.project,
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

/** The roster's table — one row per cell, rendered from this grid.
 *
 *  The table and the grid are one declaration and one rendering: `GRID-WIRING.md` carries
 *  prose plus this table, and `roster.ts` rewrites the table from `CELLS` in place, so a
 *  landing that renames its producer is one re-render away instead of a hand edit of a
 *  200-row table. The parity suite fails the moment the file and this function disagree. */
export const rosterTable = (): string =>
  [
    "| cell | task | producer | route |",
    "| --- | --- | --- | --- |",
    ...CELLS.map((cell) => `| ${cell.id} | ${cell.task} | ${cell.producer} | ${cell.route} |`),
  ].join("\n");
