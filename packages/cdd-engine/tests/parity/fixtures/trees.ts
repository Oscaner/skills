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

/** The phase-spec the plan's identity reverse lookup needs. */
const SPEC_REL = `docs/kairos/specs/${PHASE_SLUG}-design.md`;

/** The program overall charter the phase-spec names. */
const OVERALL_REL = `docs/kairos/specs/${PHASE_SLUG}-overall.md`;

/** The plan document — one task block, no dependency. */
const PLAN_TEXT = [
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
  "### Task 1: the only task",
  "",
  "#### Objective",
  "",
  "land the fixture",
  "",
  "#### Files",
  "",
  "- Create: `a.ts`",
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
  "none",
  "",
].join("\n");

/** The phase-spec document. */
const SPEC_TEXT = [
  "---",
  "title: P9 spec",
  "doc-type: phase-spec",
  `slug: ${PHASE_SLUG}`,
  `program: ${PHASE_SLUG}-overall`,
  "version: v0.1",
  `date: ${FROZEN_DATE}`,
  "---",
  "",
  "## Design",
  "",
  "the corpus design",
  "",
  "## Acceptance criteria",
  "",
  "- one",
  "",
].join("\n");

/** The program overall charter. */
const OVERALL_TEXT = [
  "---",
  "title: P9 overall",
  "doc-type: overall",
  `slug: ${PHASE_SLUG}-overall`,
  "version: v1.0",
  `date: ${FROZEN_DATE}`,
  "---",
  "",
  "## Scope",
  "",
  "- the corpus",
  "",
].join("\n");

/** The three documents every non-empty shape carries. */
const docs = (): readonly FixtureFile[] => [
  { path: SPEC_REL, text: SPEC_TEXT },
  { path: OVERALL_REL, text: OVERALL_TEXT },
  { path: PLAN_REL, text: PLAN_TEXT },
];

/** One round record of a wave row — the shape the ledger persists. */
const round = (op: string): Record<string, unknown> => ({
  op,
  cycle: 1,
  attempt: 1,
  dispatchBase: null,
  verdict: { treeClean: true, targetAction: true },
  violations: [],
});

/** The empty progress document. */
const emptyProgress = (): Record<string, unknown> => ({
  timeoutCount: 0,
  engineSelfWrittenCount: 0,
  engineRecoveryCount: 0,
  harnessAbortCount: 0,
  waves: [],
});

/** A progress document with one OPEN wave row (recorded rounds, no reviewed snapshot). */
const openWave = (): Record<string, unknown> => ({
  ...emptyProgress(),
  waves: [{ wave: "1", rounds: [round("implement")] }],
});

/** A progress document with one CLOSED wave row (the reviewed snapshot landed). */
const closedWave = (): Record<string, unknown> => ({
  ...emptyProgress(),
  waves: [
    {
      wave: "1",
      rounds: [round("implement"), round("review")],
      reviewedRevision: { kind: "brief-revision", plan: PLAN_REL, brief_hash: "cafe" },
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
const inFlightRecord = (holder: { pid: number; startedAt: number }): Record<string, unknown> => ({
  pid: holder.pid,
  command: "cdd implement --tasks 1 --plan p9.md",
  slug: PHASE_SLUG,
  startedAt: holder.startedAt,
  wave: "1",
  phase: "implement",
  cycle: 1,
  attempt: 1,
  briefHash: null,
  plan: PLAN_REL,
});

/** A fixture tree's whole declaration. */
export interface TreeFixture {
  /** The shape this fixture is. */
  readonly shape: TreeShape;
  /** The files the tree carries (beyond the git scaffolding). */
  readonly files: readonly FixtureFile[];
}

/** The holder facts a live/stale in-flight fixture needs. */
export interface HolderFacts {
  readonly pid: number;
  readonly startedAt: number;
}

/** The seven fixture declarations. `holder` is required by the two in-flight shapes and
 *  ignored by the rest — a fixture never invents a process identity of its own. */
export const treeFixture = (shape: TreeShape, holder?: HolderFacts): TreeFixture => {
  switch (shape) {
    case "empty":
      return { shape, files: [] };
    case "wave":
      return {
        shape,
        files: [
          ...docs(),
          {
            path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
            text: `${JSON.stringify(openWave(), null, 2)}\n`,
          },
          { path: `.kairos/cdd/${PHASE_SLUG}/base.json`, text: baseArtifact() },
        ],
      };
    case "inflight": {
      if (holder === undefined) throw new Error("the `inflight` fixture needs holder facts");
      return {
        shape,
        files: [
          ...docs(),
          {
            path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
            text: `${JSON.stringify(openWave(), null, 2)}\n`,
          },
          { path: ".kairos/cdd/in-flight.json", text: inFlightText(inFlightRecord(holder)) },
        ],
      };
    }
    case "refused":
      return {
        shape,
        files: [
          ...docs(),
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
          ...docs(),
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
          ...docs(),
          {
            path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
            text: `${JSON.stringify(openWave(), null, 2)}\n`,
          },
          {
            path: ".kairos/cdd/in-flight.json",
            text: inFlightText({
              ...inFlightRecord({ pid: 1, startedAt: 0 }),
              plan: "docs/kairos/plans/gone.md",
            }),
          },
        ],
      };
    }
    case "branch-closed":
      return {
        shape,
        files: [
          ...docs(),
          {
            path: `.kairos/cdd/${PHASE_SLUG}/progress.json`,
            text: `${JSON.stringify(closedWave(), null, 2)}\n`,
          },
          { path: `.kairos/cdd/${PHASE_SLUG}/base.json`, text: baseArtifact() },
        ],
      };
  }
};

/** A drift progress document — the wave row's reviewed brief no longer matches. */
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
  spawnSync("git", ["add", "-A"], { cwd: repo });
  spawnSync("git", ["commit", "-q", "-m", "fixture"], { cwd: repo });
  return repo;
};
