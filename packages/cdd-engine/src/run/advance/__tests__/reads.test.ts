// packages/cdd-engine/src/run/advance/__tests__/reads.test.ts
// The advance segment's PRODUCTION reads, pinned where the step actually calls them.
//
// The arm this file exists for is the ORDER of one dispatch' unfinishable step: an EMPTY
// rendered prompt is refused BEFORE the occupancy, so an empty render costs zero child
// processes and zero in-flight records. That arm can only be judged on the real
// `AdvanceReads#dispatchFrame` feeding the real `Lifecycle#advance` — a stub that answers the
// frame proves nothing about the ordering, and swapping the forwarding for "spawn first, judge
// the render after" has to red here (the spawn counter and the record read).
//
// The second and third arms pin the read's total answers: a host-less environment is the
// declared `no-host` refusal (never an index into the host table), and both assembly variants
// pass through unchanged.
//
// Every case drives a REAL `Ledger`, `PreFlight`, `InFlight`, `Child`, `LinePhase`, `Pipeline`
// and `Workspace` over a temp git tree — "nothing was written" and "nothing was spawned" are
// only facts if the writes and the spawns would have been the real objects' own.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Boot } from "../../../bin.ts";
import type { JudgeInput } from "../../../docs/index.ts";
import {
  type LedgerFacts,
  RULE_REGISTRY,
  type RuleDeclaration,
  TaskGraph,
} from "../../../docs/index.ts";
import { Env } from "../../../env/index.ts";
import type { RepoPath } from "../../../env/paths/root.ts";
import type { ChildRunner } from "../../../env/process/child-runner.ts";
import { BriefRenderer } from "../../../surface/render/brief.ts";
import { PromptBandsRenderer } from "../../../surface/render/templates.ts";
import { Child } from "../../dispatch/child.ts";
import { InFlight } from "../../dispatch/inflight.ts";
import { Authority } from "../../gate/authority.ts";
import { type DocJudgment, PreFlight } from "../../gate/preflight.ts";
import { Refusal } from "../../gate/refusal.ts";
import { Artifacts } from "../../ledger/artifacts.ts";
import { Ledger } from "../../ledger/ledger.ts";
import { DriftStation } from "../drift-station.ts";
import type { FrameFacts } from "../frame.ts";
import { Lifecycle } from "../lifecycle.ts";
import { LinePhase } from "../line-phase.ts";
import { LineRows } from "../line-rows.ts";
import { Pipeline } from "../pipeline.ts";
import { AdvanceReads, CarrierReads, type PromptBandReads } from "../reads.ts";
import { WaveGate } from "../wave.ts";

/** The workspace key the fixture's documents declare, and their coordinates. */
const SLUG = "p9";
const PLAN_REL = `docs/kairos/plans/${SLUG}.md` as RepoPath;
const SPEC_REL = `docs/kairos/specs/${SLUG}-design.md` as RepoPath;
const OVERALL_REL = `docs/kairos/overalls/${SLUG}-overall.md` as RepoPath;
const BRIEF_REL = `.kairos/cdd/${SLUG}/tasks-1-brief.md`;

/** The temp trees this file made. */
const created: string[] = [];

/** The fixture plan: one task block, every declared field present. */
const PLAN_TEXT = [
  "---",
  "title: 'p9 plan'",
  "doc-type: plan",
  `slug: '${SLUG}'`,
  "version: v1.0",
  "date: 2026-01-01",
  "---",
  "",
  "## Constraints",
  "",
  "- the fixture",
  "",
  "### Task 1: the task",
  "",
  "#### Objective",
  "",
  "objective 1",
  "",
  "#### Files",
  "",
  "- Create: `a.ts`",
  "",
  "#### Consumes",
  "",
  "- the fixture",
  "",
  "#### Produces",
  "",
  "- the fixture",
  "",
  "#### Steps",
  "",
  "- do it — checkable: green",
  "",
  "#### Acceptance",
  "",
  "- done",
  "",
  "#### DependsOn",
  "",
  "none",
  "",
].join("\n");

/** A temp directory initialised as a git working tree, committed clean, carrying the three
 *  documents the line reads (the plan, its identity document and the charter above it). */
const fixtureRepo = (): string => {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "advance-reads-")));
  created.push(repo);
  const write = (rel: string, text: string): void => {
    const absolute = path.join(repo, rel);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, text, "utf8");
  };
  write(".gitignore", ".kairos\n");
  write(PLAN_REL, PLAN_TEXT);
  write(
    SPEC_REL,
    "---\ntitle: 'p9 spec'\ndoc-type: phase-spec\nversion: v0.1\nslug: 'p9'\nprogram: 'p9-overall'\nstatus: Draft\n---\n\n# spec\n",
  );
  write(
    OVERALL_REL,
    "---\ntitle: 'p9 overall'\ndoc-type: overall\nversion: v0.1\nslug: 'p9-overall'\nstatus: Approved\n---\n\n# charter\n",
  );
  const git = (...args: string[]): void => {
    spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  };
  git("init", "-q");
  const identity = ["-c", "user.name=reads", "-c", "user.email=reads@oscaner.dev"];
  git(...identity, "add", "-A");
  git(...identity, "commit", "-qm", "fixture");
  return repo;
};

/** The document judgment stand-in — the gate judges the document slice through this face, so
 *  these arms are about the STEP, not about a document's contract. */
class FakeJudgment implements DocJudgment {
  judge(_input: JudgeInput): readonly never[] {
    return [];
  }

  judgeLedger(_input: JudgeInput, _facts: LedgerFacts): readonly never[] {
    return [];
  }

  ruleRows(): readonly RuleDeclaration[] {
    return RULE_REGISTRY;
  }

  closedAt(_path: RepoPath): boolean {
    return false;
  }
}

/** The child seam stand-in — a spawn counter, and the exit code a real child would answer. */
class CountingRunner implements ChildRunner {
  spawns = 0;

  async run(): Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
    facts: { overBudget: boolean; stopped: boolean; signal: string | null };
  }> {
    this.spawns += 1;
    return {
      code: 0,
      stdout: "",
      stderr: "",
      facts: { overBudget: false, stopped: false, signal: null },
    };
  }
}

/** A prompt-band read that declares NO band: the render an environment with no matching row
 *  produces. It is the injection point that makes the empty-render arm reachable without a
 *  fabricated document — the band table itself is a render face, not this segment's. */
const NO_BAND_PROMPTS: PromptBandReads = {
  modes: () => [],
  reviewTypes: () => [],
  bandOf: () => {
    throw new Error("no band is declared");
  },
  clauses: () => ({}),
};

/** One wired step over a temp tree. */
interface Wired {
  readonly repo: string;
  readonly env: Env;
  readonly reads: AdvanceReads;
  readonly lifecycle: Lifecycle;
  readonly ledger: Ledger;
  readonly runner: CountingRunner;
  readonly frame: FrameFacts;
}

/** One dispatch step over a fresh fixture, with the prompt band fixed to `prompts`. The host
 *  is a READ FUNCTION because the environment can move between the gate and the frame read —
 *  the one shape the step's re-judge exists for. */
const wire = (prompts: PromptBandReads, host: string | (() => string) = "claude"): Wired => {
  const repo = fixtureRepo();
  const env = new Env({ baseName: "base.json", cwd: repo });
  const clock = env.process.clock;
  const family = env.workspace.at("");
  const readRepo = (rel: string): string | null => {
    const read = family.readText(rel as RepoPath);
    return read.kind === "text" ? read.value : null;
  };
  const world = Boot.worldOf(env, readRepo);
  const workspace = env.workspace.at(SLUG);
  const workspaceRel = env.paths.root.relativize(workspace.path);
  const artifacts = new Artifacts();
  const ledger = new Ledger({
    workspace,
    names: () => env.paths.listing.files(workspaceRel),
    artifacts,
  });
  const carriers = new CarrierReads({ workspace });
  const documents = new FakeJudgment();
  const lines = new LinePhase({
    facts: ledger,
    carried: (line, record) => carriers.factsOf(line, record),
    text: readRepo,
  });
  const pipeline = new Pipeline({
    lines,
    waves: () => ledger.waveLines(),
    docClassOf: (target) => target.type,
  });
  const reads = new AdvanceReads({
    paths: env.paths,
    workspace,
    clock,
    git: env.vcs.git,
    ledger,
    lines,
    carriers,
    pipeline,
    artifacts,
    documents,
    world,
    brief: new BriefRenderer(),
    prompts,
    wording: Boot.wordingOf(clock),
    host: typeof host === "function" ? host : () => host,
    planText: readRepo,
    baseBranch: () => "main",
  });
  const refusal = new Refusal({ root: env.workspace, clock });
  const gate = new PreFlight({
    repoRoot: env.paths.root.absolute,
    tree: env.vcs.git,
    docs: documents,
    refusal,
  });
  const inflight = new InFlight({
    root: env.workspace,
    lock: env.process.lockOf({ target: path.join(env.workspace.path, InFlight.FILE) }),
    clock,
    refusal,
  });
  const runner = new CountingRunner();
  const lifecycle = new Lifecycle({
    gate,
    authority: new Authority(),
    drift: new DriftStation(lines),
    lineRows: new LineRows({ lines, drifts: new DriftStation(lines) }),
    inflight,
    child: new Child({ runner, clock }),
    ledger,
    reads,
    waveGate: new WaveGate(),
    waveInput: (facts) => ({
      graph: facts.graph ?? TaskGraph.parse(""),
      closed: pipeline.closedTasks(),
      waves: ledger.waveLines(),
      phaseOf: (key) => lines.wavePhaseOf(key),
    }),
  });
  const planText = readRepo(PLAN_REL) ?? "";
  const graph = TaskGraph.parse(planText);
  const frame: FrameFacts = {
    kind: "frame",
    state: "open",
    command: "implement",
    recover: false,
    type: "wave",
    slug: SLUG,
    key: "tasks-1",
    doc: SPEC_REL,
    planPath: PLAN_REL,
    planText,
    graph,
    emptyFileTasks: new Set<number>(),
    tasks: [1],
    target: { type: "wave", id: "1", plan: PLAN_REL },
    identity: { key: "tasks-1", doc: SPEC_REL },
    program: `${SLUG}-overall`,
    overall: OVERALL_REL,
    pipeline: { specType: "phase-spec", specPath: SPEC_REL, planPath: PLAN_REL, graph },
    workspace: { dir: workspace.path, id: SLUG },
    phase: "implement",
    round: 1,
    attempt: 1,
    reviews: null,
  };
  return { repo, env, reads, lifecycle, ledger, runner, frame };
};

afterEach(() => {
  for (const directory of created.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("the dispatch frame's production read", () => {
  it("refuses an empty render before the occupancy — zero spawns, zero records", async () => {
    const wired = wire(NO_BAND_PROMPTS);
    const outcome = await wired.lifecycle.advance(wired.frame);
    // The empty render borrows the existing `write-failure` arm, whose target on this chain is
    // the brief the round was measured against.
    expect(outcome).toEqual({ kind: "write-failure", target: BRIEF_REL });
    // Zero child processes, zero in-flight record, zero booked round.
    expect(wired.runner.spawns).toBe(0);
    expect(existsSync(path.join(wired.env.workspace.at(SLUG).path, InFlight.FILE))).toBe(false);
    expect(wired.ledger.rounds("tasks-1")).toEqual([]);
    // The brief HAS landed: the refusal describes the prompt, not a failed write.
    expect(existsSync(path.join(wired.repo, BRIEF_REL))).toBe(true);
  }, 120_000);

  it("answers the no-host refusal instead of indexing the host table", () => {
    const wired = wire(new PromptBandsRenderer(), "");
    // A host-less environment has no argv form: the read refuses by name, and the assembly is
    // never reached (the pre-flight's own `no-host` station is what the step prints).
    expect(wired.reads.dispatchFrame(wired.frame, BRIEF_REL)).toEqual({ kind: "no-host" });
  }, 120_000);

  it("re-judges the frame read's no-host into the station refusal — zero spawns, zero records", async () => {
    // The environment MOVES between the gate and the frame read: the pre-flight passed on the
    // harness it saw, and the read the step makes afterwards finds none. The STEP is what turns
    // that into the declared refusal, by judging the same pre-flight context again so the
    // `no-host` station owns the verdict. Pinned through `Lifecycle#advance` because a direct
    // read assertion leaves that branch deletable with every suite green.
    let repo = "";
    const host = (): string =>
      repo !== "" && existsSync(path.join(repo, BRIEF_REL)) ? "" : "claude";
    const wired = wire(new PromptBandsRenderer(), host);
    repo = wired.repo;
    const outcome = await wired.lifecycle.advance(wired.frame);
    expect(outcome.kind).toBe("blocked");
    if (outcome.kind !== "blocked") return;
    // The STRUCTURE leg owns a host-less tree: the station is the gate's own row, and the
    // verdict came from the SECOND judgment (the brief had already landed).
    expect(outcome.leg).toBe("structure");
    if (outcome.leg !== "structure") return;
    expect(outcome.verdict.gate).toBe("no-host");
    expect(existsSync(path.join(wired.repo, BRIEF_REL))).toBe(true);
    // Zero child processes, zero in-flight record, zero booked round.
    expect(wired.runner.spawns).toBe(0);
    expect(existsSync(path.join(wired.env.workspace.at(SLUG).path, InFlight.FILE))).toBe(false);
    expect(wired.ledger.rounds("tasks-1")).toEqual([]);
  }, 120_000);

  it("passes both assembly variants through unchanged", () => {
    const wired = wire(new PromptBandsRenderer());
    const full = wired.reads.dispatchFrame(wired.frame, BRIEF_REL);
    expect(full.kind).toBe("frame");
    if (full.kind !== "frame") return;
    expect(full.frame.command).toBe("claude");
    expect(full.frame.args.join(" ")).toContain("OUTPUT_HANDOFF");
    expect(full.frame.log.path).toContain(`.kairos/cdd/${SLUG}/`);
  }, 120_000);
});

/** The frame facts' own shape guard — a step read without a graph cannot judge the wave. */
describe("the fixture's frame", () => {
  it("declares the graph the step judges (a silent fixture would pass vacuously)", () => {
    const wired = wire(NO_BAND_PROMPTS);
    expect(wired.frame.graph).not.toBeNull();
    expect(wired.frame.tasks).toEqual([1]);
    expect(readFileSync(path.join(wired.repo, PLAN_REL), "utf8")).toBe(PLAN_TEXT);
  }, 120_000);
});
