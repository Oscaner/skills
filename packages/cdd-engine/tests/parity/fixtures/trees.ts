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
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FROZEN_DATE } from "./non-tree.ts";

/** The seven tree shapes of the corpus. */
export type TreeShape =
  | "empty"
  | "wave"
  | "inflight"
  | "refused"
  | "doc-drift"
  | "stale-holder"
  | "branch-closed";

/** The corpus's shapes, in the order the register lists them. */
export const TREE_SHAPES: readonly TreeShape[] = [
  "empty",
  "wave",
  "inflight",
  "refused",
  "doc-drift",
  "stale-holder",
  "branch-closed",
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

/** A progress document with one wave row in the requested state. `snapshot` decides
 *  whether a closed row keeps its plan-task set — the fact the wave gate's append
 *  exemption reads (`#appendedSinceClosure`): a row WITHOUT the snapshot is the
 *  conservative shape, so a batch that mixes closed and open tasks blocks. */
const waveProgress = (
  state: WaveRounds,
  snapshot: boolean,
  tasks: number,
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
  /** Directories the tree carries — the lock behind a corrupt in-flight record is a
   *  directory, not a file (the record's own bytes are unreadable, the lock is what the
   *  holder left behind). */
  readonly directories?: readonly string[];
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
}

/** The in-flight record's two paths — the record and the lock directory beside it. */
export const inFlightPaths = (): { record: string; lock: string } => ({
  record: ".kairos/cdd/in-flight.json",
  lock: ".kairos/cdd/in-flight.json.lock",
});

/** The plan text one shape declares. */
const planOf = (options: TreeOptions): string =>
  planText(options.tasks ?? 1, options.chain === true);

/** The seven fixture declarations. `holder` is required by the two in-flight shapes and
 *  ignored by the rest — a fixture never invents a process identity of its own. */
export const treeFixture = (shape: TreeShape, options: TreeOptions = {}): TreeFixture => {
  const holder = options.holder === "live" ? undefined : options.holder;
  const tasks = options.tasks ?? 1;
  const rounds: WaveRounds = options.rounds ?? (shape === "doc-drift" ? "review" : "none");
  const snapshot = options.snapshot ?? true;
  const docsFor = (): readonly FixtureFile[] => [
    { path: SPEC_REL, text: SPEC_TEXT },
    { path: OVERALL_REL, text: OVERALL_TEXT },
    { path: PLAN_REL, text: planOf(options) },
  ];
  const progress = (state: WaveRounds): FixtureFile => ({
    path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
    text: `${JSON.stringify(waveProgress(state, snapshot, tasks), null, 2)}\n`,
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
  const corruptLock = (): TreeFixture => ({
    shape,
    files: [...docsFor(), progress("none"), { path: inFlightPaths().record, text: '{"pid": 1, ' }],
    directories: [inFlightPaths().lock],
  });

  if (options.corruptLock === true) return corruptLock();

  switch (shape) {
    case "empty":
      return { shape, files: [] };
    case "wave":
      return {
        shape,
        files: [...docsFor(), progress(rounds), base, ...(withCarrier ? [reviewCarrier] : [])],
      };
    case "inflight": {
      if (holder === undefined) throw new Error("the `inflight` fixture needs holder facts");
      return {
        shape,
        files: [
          ...docsFor(),
          progress(rounds),
          { path: inFlightPaths().record, text: inFlightText(inFlightRecord(holder)) },
        ],
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
        ],
      };
    case "doc-drift":
      return {
        shape,
        files: [
          ...docsFor(),
          {
            path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
            text: `${JSON.stringify(driftProgress(), null, 2)}\n`,
          },
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
        ],
      };
    }
    case "branch-closed":
      return { shape, files: [...docsFor(), progress("closed"), base, reviewCarrier] };
  }
};

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
    writeFileSync(target, file.text, "utf8");
  }
  for (const directory of fixture.directories ?? []) {
    mkdirSync(path.join(repo, directory), { recursive: true });
  }
  spawnSync("git", ["add", "-A"], { cwd: repo });
  spawnSync("git", ["commit", "-q", "-m", "fixture"], { cwd: repo });
  return repo;
};
