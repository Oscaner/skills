// packages/cdd-engine/tests/parity/fixtures/trees.ts
// The seven TREE fixtures of the parity corpus (spec §2.3), extracted from the shapes
// the old suite already builds: empty · wave in progress · in-flight held · a refusal
// standing on the tree · doc drift · a stale holder whose target is gone · a closed
// branch line.
//
// Each shape is declared as the files a repository carries, materialized into a fresh
// git-initialised temp tree; the engine resolves its root from the git top level, so a
// fixture is a real repository and never a mocked path. The readings each shape
// produces through the old entry (`cdd board --plan` and a dry-run preview) are
// recorded in `fixtures/README.md` — the shapes are only useful if the old tree reads
// them as the shape they claim.

import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FROZEN_DATE } from "./non-tree.ts";

/** The tree shapes of the corpus. `overall` is a DOCUMENT-KIND shape — a charter plus the
 *  one phase specification whose `program:` names it — not a wider tree of the same kind: it
 *  is the only shape whose board is the program's, so the two program-board cells read it and
 *  nothing else can. */
export type TreeShape =
  | "empty"
  | "wave"
  | "inflight"
  | "refused"
  | "doc-drift"
  | "stale-holder"
  | "branch-closed"
  | "overall";

/** The corpus's shapes, in the order the register lists them. */
export const TREE_SHAPES: readonly TreeShape[] = [
  "empty",
  "wave",
  "inflight",
  "refused",
  "doc-drift",
  "stale-holder",
  "branch-closed",
  "overall",
];

/** One file a fixture tree carries. */
export interface FixtureFile {
  /** The repo-relative path. */
  readonly path: string;
  /** The file's whole text. */
  readonly text: string;
}

/** The phase slug every non-empty fixture tree speaks — the one identity the corpus
 *  uses, so a reading never depends on a name that varies per shape. */
export const PHASE_SLUG = "p9";

/** The plan every non-empty fixture tree plants. */
export const PLAN_REL = `docs/kairos/plans/${PHASE_SLUG}.md`;

/** The phase-spec the plan's identity reverse lookup needs — also the target of every
 *  `--type phase-spec` probe, so it must clear the doc-contract gate the review and
 *  fix faces judge it through. */
export const SPEC_REL = `docs/kairos/specs/${PHASE_SLUG}-design.md`;

/** The program overall charter the phase-spec names. */
export const OVERALL_REL = `docs/kairos/specs/${PHASE_SLUG}-overall.md`;

/** One plan task block — the six declared task fields, no dependency. */
const taskBlock = (id: number, dependsOn = "none"): readonly string[] => [
  `### Task ${id}: task ${id}`,
  "",
  "#### Objective",
  "",
  `objective ${id}`,
  "",
  "#### Files",
  "",
  "- Create: `a.ts`",
  "",
  "#### Consumes",
  "",
  "- the corpus",
  "",
  "#### Produces",
  "",
  "- the fixture",
  "",
  "#### Steps",
  "",
  "- write it — checkable: green",
  "",
  "#### Acceptance",
  "",
  "ok",
  "",
  "#### DependsOn",
  "",
  dependsOn,
  "",
];

/** A doc-contract-clean plan carrying `tasks` task blocks — independent (one wide
 *  derived layer) unless `chain`, where each task depends on the one before it (one
 *  task per layer). */
export const planText = (tasks = 1, chain = false): string =>
  [
    "---",
    "title: P9 plan",
    "doc-type: plan",
    `slug: ${PHASE_SLUG}`,
    "version: v1.0",
    `date: ${FROZEN_DATE}`,
    "---",
    "",
    "## Constraints",
    "",
    "- keep the corpus small",
    "",
    ...Array.from({ length: tasks }, (_, index) =>
      taskBlock(index + 1, chain && index > 0 ? String(index) : "none"),
    ).flat(),
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    `| v1.0 | ${FROZEN_DATE} | initial | [human] |`,
    "",
  ].join("\n");

/** A doc-contract-clean phase-spec — the head tuple, the version lineage and the
 *  design skeleton the phase-spec contract registers. */
const SPEC_TEXT = [
  "---",
  "title: P9 spec",
  "doc-type: phase-spec",
  "version: v1.0",
  `date: ${FROZEN_DATE}`,
  `slug: ${PHASE_SLUG}`,
  `program: ${PHASE_SLUG}-overall`,
  "status: Draft",
  "author: '[human]'",
  "parent-version: v1.0",
  "---",
  "",
  "## Design",
  "",
  "Design intro — the corpus's own document shape.",
  "",
  "### 1. Data plane",
  "",
  "#### 1.1 Registry",
  "",
  "- text",
  "",
  "### Acceptance criteria",
  "",
  "- `c`",
  "",
  "## Constraints",
  "",
  "- delta",
  "",
  "## Change history",
  "",
  "| Version | date | summary | author |",
  "|---|---|---|---|",
  `| v1.0 | ${FROZEN_DATE} | initial | [human] |`,
  "",
].join("\n");

/** The program overall charter — every registered element present, its inventory
 *  links resolving into the siblings this fixture tree carries. */
const OVERALL_TEXT = [
  "---",
  "title: P9 overall",
  "doc-type: overall",
  "version: v1.0",
  `date: ${FROZEN_DATE}`,
  `slug: ${PHASE_SLUG}-overall`,
  "status: Approved",
  "author: '[human]'",
  "---",
  "",
  "## Document scope",
  "scope prose",
  "",
  "## File paths",
  "",
  "| Artifact | Path |",
  "| --- | --- |",
  `| overall | ${OVERALL_REL} |`,
  "",
  "## Program charter",
  "",
  "### Goal",
  "",
  "- goal text",
  "",
  "### Non-goals",
  "",
  "- non-goal text",
  "",
  "### Cross-cutting",
  "",
  "- cross text",
  "",
  "## Issue inventory",
  "",
  "| Phase | Issue (ref) | Title summary |",
  "| --- | --- | --- |",
  `| ${PHASE_SLUG} | #123 | the corpus phase |`,
  "",
  "## Phase inventory",
  "",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  `| ${PHASE_SLUG} | the corpus | scope a | [spec](${SPEC_REL}) | [plan](${PLAN_REL}) | criteria a |  |`,
  "",
  "## Dependency graph",
  "",
  `- ${PHASE_SLUG}`,
  "",
  "## Boundary rules",
  "",
  "- boundary rule",
  "",
  "## Constraints",
  "",
  "- corpus only",
  "",
  "## Maintenance",
  "",
  "- maintenance note",
  "",
  "## Change history",
  "",
  "| Version | date | summary | author |",
  "| --- | --- | --- | --- |",
  `| v1.0 | ${FROZEN_DATE} | initial | [human] |`,
  "",
].join("\n");

/** The child's own note row the review carrier carries — the board's `notes +M` count
 *  and, under `--notes`, the folded body behind it. */
const CHILD_NOTE = "the guard is missing at the second station";

/** The placeholder a fixture writes where a record holds an ABSOLUTE path; `materialize`
 *  binds it to the temp tree it materialized. */
const REPO_PLACEHOLDER = "{REPO}";

/** A well-formed sha1 that no document's body digests to — the "reviewed, then the document
 *  moved" cell of a fixture. It has to be a REAL digest width: the identity read validates the
 *  recorded hex, so a short literal would read as "no version recorded" and the drift the
 *  fixture is about would never be judged. */
const STALE_DIGEST = "0000000000000000000000000000000000000000";

/** One round record of a wave row — the shape the ledger persists. */
const round = (
  op: string,
  verdict = { treeClean: true, targetAction: true },
): Record<string, unknown> => ({
  op,
  cycle: 1,
  attempt: 1,
  dispatchBase: null,
  verdict,
  violations: [],
});

/** The empty progress document — the counters every shape carries. */
const emptyProgress = (): Record<string, unknown> => ({
  timeoutCount: 0,
  engineSelfWrittenCount: 0,
  engineRecoveryCount: 0,
  harnessAbortCount: 0,
  waves: [],
});

/** How far the open wave's own row has advanced — the four states a tree can be in
 *  when a command meets it. `none` is a wave that has started (its row exists) with no
 *  round recorded yet; `closed` is a wave whose review landed (the branch line is
 *  closed at that wave). */
export type WaveRounds = "none" | "implement" | "review" | "closed";

/** The rounds a wave row records for one state. */
const roundsOf = (state: WaveRounds): readonly Record<string, unknown>[] => {
  if (state === "none") return [];
  if (state === "implement") return [round("implement")];
  return [round("implement"), round("review")];
};

/** A progress document with one wave row in the requested state — plus a SECOND unstarted
 *  row when the plan declares two waves. `snapshot` decides whether a closed row keeps its
 *  plan-task set — the fact the wave gate's append exemption reads
 *  (`#appendedSinceClosure`): a row WITHOUT the snapshot is the conservative shape, so a
 *  batch that mixes closed and open tasks blocks. */
const waveProgress = (
  state: WaveRounds,
  snapshot: boolean,
  tasks: number,
  second = false,
): Record<string, unknown> => ({
  ...emptyProgress(),
  waves: [
    {
      wave: "1",
      rounds: roundsOf(state),
      ...(state === "closed"
        ? {
            reviewedRevision: { kind: "brief-revision", plan: PLAN_REL, brief_hash: "cafe" },
            ...(snapshot
              ? { planTasks: Array.from({ length: tasks }, (_, index) => index + 1) }
              : {}),
          }
        : {}),
    },
    ...(second ? [{ wave: "2", rounds: [] }] : []),
  ],
});

/** A drift progress document — the wave row's reviewed brief no longer matches the
 *  plan's task-only projection (the wave reopens at review). */
const driftProgress = (): Record<string, unknown> => ({
  ...emptyProgress(),
  waves: [
    {
      wave: "1",
      rounds: [round("implement"), round("review")],
      reviewedRevision: { kind: "brief-revision", plan: PLAN_REL, brief_hash: "deadbeef" },
      planTasks: [1],
    },
  ],
});

/** The drifted, CLOSED phase-spec row — one completed review bound to a version the document
 *  no longer holds. The row is what makes a document face "entered and moved": both the review
 *  re-entry and the upstream `doc-drift` refusal read exactly these three facts. */
const specDriftRow = (): Record<string, unknown> => ({
  wave: "phase-spec",
  rounds: [round("review")],
  reviewedRevision: { kind: "doc-revision", doc: SPEC_REL, doc_hash: STALE_DIGEST },
});

/** The accepted refusal record the tree-level `refusal.json` carries. */
const refusalRecord = (): Record<string, unknown> => ({
  at: `${FROZEN_DATE}T00:00:00.000Z`,
  slug: PHASE_SLUG,
  op: "implement",
  type: "wave",
  cycle: 1,
  attempt: 1,
  station: "graph",
  detail: "task 1 depends on a task the plan does not declare",
});

/** The in-flight record — a holder's identity facts plus its target facts. */
const inFlightRecord = (holder: HolderFacts, plan = PLAN_REL): Record<string, unknown> => ({
  pid: holder.pid,
  command: "cdd implement --tasks 1 --plan p9.md",
  slug: PHASE_SLUG,
  startedAt: holder.startedAt,
  wave: "1",
  phase: "implement",
  cycle: 1,
  attempt: 1,
  briefHash: null,
  plan,
});

/** A fixture tree's whole declaration. */
export interface TreeFixture {
  /** The shape this fixture is. */
  readonly shape: TreeShape;
  /** The files the tree carries (beyond the git scaffolding). */
  readonly files: readonly FixtureFile[];
  /** Whether `materialize` drops a handoff draft no recorded round owns. */
  readonly orphanDraft?: boolean;
  /** Directories the tree carries — the lock behind a corrupt in-flight record is a
   *  directory, not a file (the record's own bytes are unreadable, the lock is what the
   *  holder left behind). */
  readonly directories?: readonly string[];
  /** Repo-relative paths whose permission bits are cleared after the tree lands — an
   *  EXISTING target that cannot be read, which is a different fact from an absent one
   *  (the two print different bytes at the same exit code). */
  readonly unreadable?: readonly string[];
}

/** The holder facts a live/stale in-flight fixture needs. */
export interface HolderFacts {
  readonly pid: number;
  readonly startedAt: number;
}

/** A fixture tree's knobs. The seven shapes are the axis; these are the plan width and
 *  the ledger state the shape carries, not a second shape list. */
export interface TreeOptions {
  /** The holder the two in-flight shapes plant. `live` asks the harness to resolve this
   *  process's own identity facts — the only live holder a hermetic corpus can have. */
  readonly holder?: HolderFacts | "live";
  /** The plan's width — how many task blocks it declares (default one). */
  readonly tasks?: number;
  /** Whether task N depends on task N−1 (one task per derived layer) rather than every
   *  task standing alone (one wide layer). */
  readonly chain?: boolean;
  /** How far the open wave's row has advanced. */
  readonly rounds?: WaveRounds;
  /** Whether a closed row keeps its plan-task snapshot (default true). */
  readonly snapshot?: boolean;
  /** Plant the corrupt in-flight record WITH its lock left behind — the third holding
   *  shape (`kind: corrupt` + `locked`), planted in the comparer's temp tree rather than
   *  declared as a shape of its own. */
  readonly corruptLock?: boolean;
  /** Drop one handoff draft the ledger records no round for — the board's `orphan:` row's
   *  only input. A tree without it prints no such row, so the two states are two probes. */
  readonly orphanDraft?: boolean;
  /** Book one CRASHED round on the wave row — a verdict that withheld its target action
   *  and a HARD violation beside it. The board's `crashed:` row's only input. */
  readonly crashedRound?: boolean;
  /** Carry the artifact inventory's two arms: a healthy review round whose rulings sidecar
   *  reads `ok`, and a review round on the plan line with no sidecar at all (`absent`). */
  readonly artifactArms?: boolean;
  /** Declare a TWO-wave plan — two chained tasks, and a progress document recording BOTH
   *  wave rows. The board's wave segment then has two rows, which is what a frontier marker
   *  and a label column need to be judged at all. */
  readonly twoWaves?: boolean;
  /** Give the `overall` shape's phase one completed round on each line its program-board row
   *  summarises (`phase-spec` · `plan` · `branch`), so the phase row prints its cells. */
  readonly phaseCells?: boolean;
  /** Put a FIX round beside the charter's own review round, both with a carrier carrying the
   *  child's note — the `overall` row's two-verb token set, recorded in the PROGRAM's
   *  workspace. A node board reads that row from there, so the row's cells are only judged on
   *  a tree that carries it. */
  readonly charterFix?: boolean;
  /** Carry the LEGACY artifact spellings an older engine wrote: a cycle-less implement draft
   *  a record still owns by its recorded `carrierPath`, its report and test-evidence siblings,
   *  and one non-artifact directory beside them. The orphan face judges all four: the draft is
   *  claimed, the report and the evidence are attributable names, and the directory is not an
   *  artifact at all. */
  readonly legacyArtifacts?: boolean;
  /** Re-dispatch one cycle the way a crash forces it: attempt 1 failed with NO carrier, and
   *  attempt 2 wrote the canonical name its record remembers. The two attempts are two
   *  tokens, and only the SECOND owns the carrier the two of them would both resolve. */
  readonly reattempt?: boolean;
  /** Close the phase's identity document and its plan, then move the SPEC past the version
   *  its review bound — a closed line `next:` must reopen onto the review it owes, which a
   *  closed-line handoff would otherwise swallow. */
  readonly docFaceDrift?: boolean;
  /** Plant a CLOSED phase-spec line whose recorded version the document has since moved past,
   *  beside whatever else the shape records. Two faces judge it: the dispatch entry's review
   *  re-entry (the drift owes a review) and the line leg's upstream `doc-drift` refusal (a
   *  request whose face sits BELOW the moved document would build on bytes nobody reviewed). */
  readonly specDrift?: boolean;
  /** Repo-relative paths to land and then make UNREADABLE — the "exists but cannot be read"
   *  probe axis. The probe and the tree shape hold no mode literal: a fixture declares the
   *  paths and `materialize` clears their bits. */
  readonly unreadable?: readonly string[];
}

/** The in-flight record's two paths — the record and the lock directory beside it. */
export const inFlightPaths = (): { record: string; lock: string } => ({
  record: ".kairos/cdd/in-flight.json",
  lock: ".kairos/cdd/in-flight.json.lock",
});

/** The phase workspace's progress for a program board whose phase row prints its cells —
 *  one completed round on each line the row summarises (`spec` · `plan` · `branch`). */
const phaseCellProgress = (): Record<string, unknown> => ({
  ...emptyProgress(),
  waves: [
    { wave: "phase-spec", rounds: [round("review")] },
    { wave: "plan", rounds: [round("review")] },
    { wave: "branch", rounds: [round("review")] },
  ],
});

/** The seven fixture declarations. `holder` is required by the two in-flight shapes and
 *  ignored by the rest — a fixture never invents a process identity of its own. */
export const treeFixture = (shape: TreeShape, options: TreeOptions = {}): TreeFixture => {
  const holder = options.holder === "live" ? undefined : options.holder;
  // A two-wave plan is a PLAN WIDTH plus a ledger state, not a shape of its own: two chained
  // tasks derive two waves, and the progress document records both rows so the board's wave
  // segment has the two rows its marker and label columns are judged on.
  const tasks = options.twoWaves === true ? 2 : (options.tasks ?? 1);
  const chain = options.twoWaves === true || options.chain === true;
  const rounds: WaveRounds = options.rounds ?? (shape === "doc-drift" ? "review" : "none");
  const snapshot = options.snapshot ?? true;
  const docsFor = (): readonly FixtureFile[] => [
    { path: SPEC_REL, text: SPEC_TEXT },
    { path: OVERALL_REL, text: OVERALL_TEXT },
    { path: PLAN_REL, text: planText(tasks, chain) },
  ];
  const progress = (state: WaveRounds): FixtureFile => ({
    path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
    text: `${JSON.stringify(waveProgress(state, snapshot, tasks, options.twoWaves === true), null, 2)}\n`,
  });
  const base: FixtureFile = { path: `.kairos/cdd/${PHASE_SLUG}/base.json`, text: baseArtifact() };
  // A CLOSED wave row is closed by its review CARRIER: the closure judge reads the
  // round's own carrier bytes, so a row without one is an open verdict whatever its
  // records say. The carrier is the shape a landed review leaves behind — including the
  // child's own `notes` rows, which is the input the board's `--notes` face expands
  // (spec §2.2 #6 freezes both states, so the tree carries what distinguishes them).
  const reviewCarrier: FixtureFile = {
    path: `.kairos/cdd/${PHASE_SLUG}/tasks-1-review-1.c1.json`,
    text: `${JSON.stringify({ status: "APPROVED", findings: [], notes: [CHILD_NOTE] }, null, 2)}\n`,
  };
  const withCarrier = rounds === "review" || rounds === "closed";
  /** The drifted document row's carrier — present, so the completed review reads back and the
   *  row is a WORKED line rather than an unreadable one. */
  const specDriftCarrier: FixtureFile = {
    path: `.kairos/cdd/${PHASE_SLUG}/phase-spec-review-1.c1.json`,
    text: `${JSON.stringify({ status: "APPROVED", findings: [] }, null, 2)}\n`,
  };
  /** This shape's own progress with the drifted phase-spec row in FRONT of it — the row the
   *  document faces judge keeps the shape's wave (and brief) facts untouched. */
  const specDriftProgress = (state: WaveRounds): FixtureFile => {
    const document = waveProgress(state, snapshot, tasks, options.twoWaves === true);
    return {
      path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
      text: `${JSON.stringify(
        { ...document, waves: [specDriftRow(), ...(document.waves as readonly unknown[])] },
        null,
        2,
      )}\n`,
    };
  };
  const knobs: Partial<TreeFixture> = {
    ...(options.orphanDraft === true ? { orphanDraft: true } : {}),
    ...(options.unreadable === undefined ? {} : { unreadable: options.unreadable }),
  };
  const crashedProgress = (): FixtureFile => ({
    path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
    text: `${JSON.stringify(crashedWaveProgress(), null, 2)}\n`,
  });
  /** The healthy arm's three files: the record's carrier, its legal sidecar, and the
   *  absence arm's record beside them. */
  const artifactFiles = (): readonly FixtureFile[] => [
    {
      path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
      text: `${JSON.stringify(artifactArmProgress(), null, 2)}\n`,
    },
    {
      path: PHASE_SPEC_CARRIER,
      text: `${JSON.stringify({ status: "APPROVED", findings: [{ id: "F1", severity: "warn", summary: "a finding" }] }, null, 2)}\n`,
    },
    {
      // The plan line's review carrier — present, so the round is OBSERVED; its sidecar is
      // deliberately absent, which is the `absent` arm of the inventory.
      path: `.kairos/cdd/${PHASE_SLUG}/plan-review-1.c1.json`,
      text: `${JSON.stringify({ status: "APPROVED", findings: [] }, null, 2)}\n`,
    },
    {
      path: PHASE_SPEC_RULINGS,
      text: `${JSON.stringify({ carrier: "phase-spec-review-1.c1.json", rulings: [{ finding: "F1", ruling: "ACCEPTED" }] }, null, 2)}\n`,
    },
  ];
  const extra = (): readonly FixtureFile[] => [
    ...(options.crashedRound === true ? [crashedProgress()] : []),
    ...(options.artifactArms === true ? artifactFiles() : []),
  ];
  /** The charter's own seat with a FIX round beside its review round — both carriers land, so
   *  the node board's `overall` row prints two verbs and their note count. */
  const charterFixFiles = (): readonly FixtureFile[] => [
    {
      path: `.kairos/cdd/${PHASE_SLUG}-overall/progress.json`,
      text: `${JSON.stringify(
        {
          ...emptyProgress(),
          waves: [{ wave: "overall", rounds: [round("review"), round("fix")] }],
        },
        null,
        2,
      )}\n`,
    },
    {
      path: `.kairos/cdd/${PHASE_SLUG}-overall/overall-fix-1.c1.json`,
      text: `${JSON.stringify({ status: "APPROVED", artifacts: {}, notes: [CHILD_NOTE] }, null, 2)}\n`,
    },
  ];
  /** The legacy spellings an older engine wrote: a cycle-less implement draft a record still
   *  owns through its recorded `carrierPath`, the report and evidence siblings beside it, and
   *  one directory that is not an artifact at all. */
  const legacyShape = (): TreeFixture => ({
    shape,
    files: [
      ...docsFor(),
      {
        path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
        text: `${JSON.stringify(
          {
            ...emptyProgress(),
            waves: [
              {
                wave: "1",
                rounds: [
                  {
                    ...round("implement"),
                    // The historical fact: the file the round actually wrote, under the
                    // spelling this tree no longer mints.
                    carrierPath: `${REPO_PLACEHOLDER}/.kairos/cdd/${PHASE_SLUG}/tasks-1-implement.json`,
                  },
                ],
              },
            ],
          },
          null,
          2,
        )}\n`,
      },
      base,
      {
        path: `.kairos/cdd/${PHASE_SLUG}/tasks-1-implement.json`,
        text: `${JSON.stringify({ status: "APPROVED", artifacts: {} }, null, 2)}\n`,
      },
      { path: `.kairos/cdd/${PHASE_SLUG}/tasks-1-implement-report.md`, text: "# legacy report\n" },
      {
        path: `.kairos/cdd/${PHASE_SLUG}/tasks-1-implement-test-evidence.json`,
        text: `${JSON.stringify({ command: "true", exit_code: 0, passed: true }, null, 2)}\n`,
      },
    ],
    directories: [`.kairos/cdd/${PHASE_SLUG}/scratch`],
    ...knobs,
  });
  /** A cycle re-dispatched after a crash: attempt 1 failed writing no carrier, attempt 2
   *  wrote the canonical name its record remembers. Both attempts are booked, and the carrier
   *  the two of them would resolve belongs to attempt 2 alone. */
  const reattemptShape = (): TreeFixture => ({
    shape,
    files: [
      ...docsFor(),
      {
        path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
        text: `${JSON.stringify(
          {
            ...emptyProgress(),
            waves: [
              {
                wave: "1",
                rounds: [
                  round("implement"),
                  round("review"),
                  round("fix", { treeClean: true, targetAction: false }),
                  {
                    ...round("fix"),
                    attempt: 2,
                    dispatchBase: "cafe",
                    carrierPath: `${REPO_PLACEHOLDER}/.kairos/cdd/${PHASE_SLUG}/tasks-1-fix-1.json`,
                  },
                ],
              },
            ],
          },
          null,
          2,
        )}\n`,
      },
      base,
      reviewCarrier,
      {
        path: `.kairos/cdd/${PHASE_SLUG}/tasks-1-fix-1.json`,
        text: `${JSON.stringify({ status: "APPROVED", artifacts: {}, notes: [CHILD_NOTE] }, null, 2)}\n`,
      },
    ],
    ...knobs,
  });
  /** The phase's identity document and its plan both closed, then the SPEC moved past the
   *  version its review bound: the closed line owes a review, and a closed-line handoff would
   *  swallow the drift the same read reports. */
  const docFaceDriftShape = (): TreeFixture => {
    const carrier = (rel: string, findings: boolean): FixtureFile => ({
      path: `.kairos/cdd/${PHASE_SLUG}/${rel}`,
      text: `${JSON.stringify(
        findings
          ? { status: "APPROVED", findings: [] }
          : { status: "APPROVED", artifacts: {}, notes: [] },
        null,
        2,
      )}\n`,
    });
    return {
      shape,
      files: [
        ...docsFor(),
        {
          path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
          text: `${JSON.stringify(
            {
              ...emptyProgress(),
              waves: [
                {
                  wave: "phase-spec",
                  rounds: [round("review"), round("fix")],
                  reviewedRevision: { kind: "doc-revision", doc: SPEC_REL, doc_hash: STALE_DIGEST },
                },
                {
                  wave: "plan",
                  rounds: [round("review"), round("fix")],
                  reviewedRevision: { kind: "doc-revision", doc: PLAN_REL, doc_hash: STALE_DIGEST },
                },
                { wave: "1", rounds: [] },
              ],
            },
            null,
            2,
          )}\n`,
        },
        base,
        carrier("phase-spec-review-1.c1.json", true),
        carrier("phase-spec-fix-1.c1.json", false),
        carrier("plan-review-1.c1.json", true),
        carrier("plan-fix-1.c1.json", false),
      ],
      ...knobs,
    };
  };
  const corruptLock = (): TreeFixture => ({
    shape,
    files: [...docsFor(), progress("none"), { path: inFlightPaths().record, text: '{"pid": 1, ' }],
    directories: [inFlightPaths().lock],
    ...knobs,
  });

  if (options.corruptLock === true) return corruptLock();

  switch (shape) {
    case "empty":
      return { shape, files: [...extra()], ...knobs };
    case "wave":
      // The four ledger-state arms: the default row set, and one shape per artifact face a
      // board reads (the charter's own row, the legacy spellings, a re-dispatched cycle, a
      // drifted identity document).
      if (options.legacyArtifacts === true) return legacyShape();
      if (options.reattempt === true) return reattemptShape();
      if (options.docFaceDrift === true) return docFaceDriftShape();
      return {
        shape,
        files: [
          ...docsFor(),
          progress(rounds),
          base,
          ...(withCarrier ? [reviewCarrier] : []),
          ...extra(),
          ...(options.charterFix === true ? charterFixFiles() : []),
        ],
        ...knobs,
      };
    case "overall":
      // The program's shape: the charter and the one phase specification whose `program:`
      // names it, each with its own workspace document. The plan rides along so the phase
      // row's read has a document; no base artifact, because the program board resolves none.
      return {
        shape,
        files: [
          ...docsFor(),
          {
            // The program seat's own document: one review round on the charter's line, which
            // is what the program board's `art:` inventory observes (its sidecar is absent, so
            // the row prints only under `--artifacts`).
            path: `.kairos/cdd/${PHASE_SLUG}-overall/progress.json`,
            text: `${JSON.stringify(
              { ...emptyProgress(), waves: [{ wave: "overall", rounds: [round("review")] }] },
              null,
              2,
            )}\n`,
          },
          {
            // The charter's own review carrier: present, sidecar absent — the program seat's
            // one observation.
            path: `.kairos/cdd/${PHASE_SLUG}-overall/overall-review-1.c1.json`,
            text: `${JSON.stringify({ status: "APPROVED", findings: [] }, null, 2)}\n`,
          },
          {
            path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
            text: `${JSON.stringify(
              options.phaseCells === true ? phaseCellProgress() : emptyProgress(),
              null,
              2,
            )}\n`,
          },
          ...extra(),
        ],
        ...knobs,
      };
    case "inflight": {
      if (holder === undefined) throw new Error("the `inflight` fixture needs holder facts");
      return {
        shape,
        files: [
          ...docsFor(),
          progress(rounds),
          { path: inFlightPaths().record, text: inFlightText(inFlightRecord(holder)) },
          ...extra(),
        ],
        ...knobs,
      };
    }
    case "refused":
      return {
        shape,
        files: [
          ...docsFor(),
          {
            path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
            text: `${JSON.stringify(emptyProgress(), null, 2)}\n`,
          },
          { path: ".kairos/cdd/refusal.json", text: inFlightText(refusalRecord()) },
          ...extra(),
        ],
        ...knobs,
      };
    case "doc-drift":
      return {
        shape,
        files: [
          ...docsFor(),
          {
            path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
            text: `${JSON.stringify(
              options.specDrift === true
                ? {
                    ...driftProgress(),
                    waves: [specDriftRow(), ...(driftProgress().waves as readonly unknown[])],
                  }
                : driftProgress(),
              null,
              2,
            )}\n`,
          },
          ...(options.specDrift === true ? [specDriftCarrier] : []),
        ],
      };
    case "stale-holder": {
      if (holder === undefined) throw new Error("the `stale-holder` fixture needs holder facts");
      return {
        shape,
        files: [
          ...docsFor(),
          progress(rounds),
          {
            path: inFlightPaths().record,
            text: inFlightText(inFlightRecord(holder, "docs/kairos/plans/gone.md")),
          },
          ...extra(),
        ],
        ...knobs,
      };
    }
    case "branch-closed":
      return {
        shape,
        files: [
          ...docsFor(),
          options.specDrift === true ? specDriftProgress("closed") : progress("closed"),
          base,
          reviewCarrier,
          ...(options.specDrift === true ? [specDriftCarrier] : []),
          ...extra(),
        ],
        ...knobs,
      };
  }
};

/** One CRASHED round record — the verdict withheld its target action and a HARD violation
 *  is booked beside it, which is the board's `crashed:` row's whole judgment. */
const crashedRound = (): Record<string, unknown> => ({
  op: "implement",
  cycle: 2,
  attempt: 1,
  dispatchBase: null,
  verdict: { treeClean: true, targetAction: false },
  violations: [{ grade: "hard", cause: "no commits" }],
});

/** The wave row carrying the crashed round. */
const crashedWaveProgress = (): Record<string, unknown> => ({
  ...emptyProgress(),
  waves: [
    {
      wave: "1",
      rounds: [round("implement"), crashedRound()],
      reviewedRevision: { kind: "brief-revision", plan: PLAN_REL, brief_hash: "cafe" },
      planTasks: [1],
    },
  ],
});

/** The phase-spec review carrier — the healthy review round's own bytes, whose finding ids
 *  the sidecar must name. */
const PHASE_SPEC_CARRIER = `.kairos/cdd/${PHASE_SLUG}/phase-spec-review-1.c1.json`;

/** The legal rulings sidecar — the healthy arm (`ok`): it sits at its RENDERED name (the
 *  cycle tag included), answers its carrier and names one finding the carrier declares. */
const PHASE_SPEC_RULINGS = `.kairos/cdd/${PHASE_SLUG}/phase-spec-review-1.c1.rulings.json`;

/** The two doc lines the artifact arms observe — one healthy round each, one of them with no
 *  sidecar (the `absent` arm). The `plan` review round writes no sidecar on purpose. */
const artifactArmProgress = (): Record<string, unknown> => ({
  ...emptyProgress(),
  waves: [
    { wave: "phase-spec", rounds: [round("review")] },
    { wave: "plan", rounds: [round("review")] },
  ],
});

/** The base artifact the plan-carrying shapes plant. */
const baseArtifact = (): string =>
  `${JSON.stringify(
    {
      base: "develop",
      source: "plan-field",
      plan: PLAN_REL,
      recordedAt: `${FROZEN_DATE}T00:00:00.000Z`,
    },
    null,
    2,
  )}\n`;

/** The one JSON byte form every tree-level record uses. */
const inFlightText = (value: Record<string, unknown>): string =>
  `${JSON.stringify(value, null, 2)}\n`;

/** Materialize one fixture into a fresh git-initialised temp repository and hand back
 *  its real path (the engine resolves the git top level, which realpath-equals this). */
export const materialize = (fixture: TreeFixture): string => {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), `parity-${fixture.shape}-`)));
  spawnSync("git", ["init", "-q"], { cwd: repo });
  spawnSync("git", ["config", "user.email", "parity@test"], { cwd: repo });
  spawnSync("git", ["config", "user.name", "parity"], { cwd: repo });
  writeFileSync(path.join(repo, ".gitignore"), ".kairos\n/docs/\n", "utf8");
  writeFileSync(path.join(repo, "seed.txt"), "seed\n", "utf8");
  for (const file of fixture.files) {
    const target = path.join(repo, file.path);
    mkdirSync(path.dirname(target), { recursive: true });
    // A record's historical `carrierPath` is an ABSOLUTE path (that is the spelling the engine
    // recorded), so a hermetic fixture writes the placeholder and the materializer binds it to
    // the tree it just made — the corpus never holds one machine's path.
    writeFileSync(target, file.text.replaceAll(REPO_PLACEHOLDER, realpathSync(repo)), "utf8");
  }
  for (const directory of fixture.directories ?? []) {
    mkdirSync(path.join(repo, directory), { recursive: true });
  }
  if (fixture.orphanDraft === true) {
    // A handoff DRAFT the ledger records no round for: the artifact name grammar reads it as
    // a round's draft, the progress document claims no such round, so the board lists it as an
    // orphan. Planting it here (not in the fixture's file list) keeps the knob a materialize
    // concern, exactly like the lock directory behind a corrupt record.
    const draft = path.join(repo, `.kairos/cdd/${PHASE_SLUG}/tasks-1-implement-2.json`);
    mkdirSync(path.dirname(draft), { recursive: true });
    writeFileSync(draft, '{"status": "APPROVED"}\n', "utf8");
  }
  spawnSync("git", ["add", "-A"], { cwd: repo });
  spawnSync("git", ["commit", "-q", "-m", "fixture"], { cwd: repo });
  // Clear the bits AFTER the commit: git must be able to read the blob it records, while the
  // command under observation must not. A mode-zero file still `stat`s, so the existence
  // probe and the read probe answer two different facts — which is the whole point.
  for (const rel of fixture.unreadable ?? []) chmodSync(path.join(repo, rel), 0o000);
  return repo;
};
