// packages/cdd-engine/src/run/advance/__tests__/advance.test.ts
// The advance segment's pins, one group per fact this segment owns:
//
//   · the scene assembly — one frame from one argv-side input, the same frame twice, and the
//     two spellings of one `--plan` landing on one slug; the segment's own product files hold
//     zero filesystem read, zero path literal and zero front-matter parse;
//   · the frontier is the ledger's PROJECTION — the same ledger answers twice, one changed
//     fact changes the answer, and no second cache stands beside it;
//   · the declared failures — the board's four arms, the frame's read failure, the unknown
//     task and the closed line, each a value and none a `null` or a boolean;
//   · the pre-dispatch refusals — `blocked` / `held` carry the SAME `kind` a preview answers,
//     and the three states carry ONE `checked` row set;
//   · the settle point — a refused dispatch lands the verdict's own record, an approved one
//     clears the door's fact, and a preview changes neither;
//   · the six hop cells, the soft cap's ONE threshold and the wave gate's five rows with their
//     neighbour arms and their row order;
//   · the drift reopen and the closure terminal;
//   · the `fix` completion criterion — the coverage judgment, its one message and its three
//     soft observations;
//   · the capsule summary — the ONE `regradeNote` composition, all three arms;
//   · the `--dry-run` suppression, kind by kind, and the brief landing with its write failure.
//
// Every case drives a REAL `Ledger`, `PreFlight`, `InFlight`, `Child` and `WorkspaceRoot` over
// a temp git tree: "the record landed" and "nothing was written" are only facts if the writes
// are the real objects' own.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { specifiersIn } from "../../../../tests/support/module-specifiers.ts";
import {
  CompletionCriteria,
  type CompletionFacts,
  DispositionsCriterion,
  type Finding,
  type JudgeInput,
  type LedgerFacts,
  RULE_REGISTRY,
  type RuleDeclaration,
  regradeNote,
  TaskBlocks,
  TaskGraph,
} from "../../../docs/index.ts";
import { docRootsOf } from "../../../env/paths/doc-roots.ts";
import type { RepoPath } from "../../../env/paths/root.ts";
import { RepoRoot } from "../../../env/paths/root.ts";
import { SlugIndex } from "../../../env/paths/slug-index.ts";
import type { ChildRunner } from "../../../env/process/child-runner.ts";
import { Clock } from "../../../env/process/clock.ts";
import { Lock } from "../../../env/process/lock.ts";
import { WorkspaceRoot } from "../../../env/workspace/workspace.ts";
import { Child } from "../../dispatch/child.ts";
import type { RoundFinding } from "../../dispatch/handoff.ts";
import { InFlight } from "../../dispatch/inflight.ts";
import { Authority } from "../../gate/authority.ts";
import { type DocJudgment, PreFlight } from "../../gate/preflight.ts";
import { Refusal } from "../../gate/refusal.ts";
import { Run, type RunOptions } from "../../index.ts";
import { CarrierLine } from "../../ledger/carrier-line.ts";
import { RoundIdentity } from "../../ledger/identity.ts";
import { Ledger } from "../../ledger/ledger.ts";
import { ReviewedIdentity } from "../../ledger/reviewed.ts";
import { type DocFacts, Frame, type FrameFacts, type FrameRequest } from "../frame.ts";
import { Lifecycle, type LifecycleReads } from "../lifecycle.ts";
import type { CarriedFacts } from "../line-phase.ts";
import { LinePhase } from "../line-phase.ts";
import {
  DISPATCH_REASON,
  NextRoutes,
  PIPELINE_NEXT,
  REVIEW_CYCLE_CAP,
  WAVE_GATE_REASON,
} from "../next.ts";
import { Pipeline } from "../pipeline.ts";
import { TargetFaces } from "../target-faces.ts";
import { WaveGate, type WaveInput } from "../wave.ts";

/** This segment's directory and product modules. */
const ADVANCE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The engine package's `src` root. */
const SRC_DIR = path.resolve(ADVANCE_DIR, "../..");

/** A fixed instant and day. */
const FIXED_NOW = 1_700_000_000_000;
const SLUG = "p9";
const PLAN_REL = "docs/kairos/plans/p9.md" as RepoPath;
const SPEC_REL = "docs/kairos/specs/2026-01-01-p9.md" as RepoPath;
const OVERALL_REL = "docs/kairos/overalls/2026-01-01-p9.md" as RepoPath;

/** The temp repos this file made. */
const created: string[] = [];

/** A temp directory initialised as a git working tree with the three doc roots. */
const tempRepo = (): string => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "advance-")));
  created.push(directory);
  spawnSync("git", ["init", "-q"], { cwd: directory });
  for (const root of ["overalls", "specs", "plans"]) {
    mkdirSync(path.join(directory, "docs/kairos", root), { recursive: true });
  }
  return directory;
};

/** One document on disk — the front matter the segment's readers parse, plus a body. */
const writeDoc = (
  repo: string,
  rel: RepoPath,
  head: {
    readonly title: string;
    readonly docType: string;
    readonly slug: string;
    readonly program?: string;
  },
  body = "# body\n",
): void => {
  const absolute = path.join(repo, rel);
  mkdirSync(path.dirname(absolute), { recursive: true });
  const program = head.program === undefined ? "" : `program: '${head.program}'\n`;
  writeFileSync(
    absolute,
    `---\ntitle: '${head.title}'\ndoc-type: ${head.docType}\nslug: '${head.slug}'\n${program}---\n\n${body}`,
    "utf8",
  );
};

/** The slug reader the scan is handed — the test's own front-matter read (the product side
 *  injects the document slice's). */
const slugOf = (text: string): string | null => {
  const match = /^slug:\s*'?([^'\n]+)'?\s*$/m.exec(text);
  return match?.[1] ?? null;
};

/** The document facts reader — the same one-regex front-matter read, keyed by coordinate. */
const docFactsOf =
  (repo: string) =>
  (rel: RepoPath): DocFacts | null => {
    try {
      const text = readFileSync(path.join(repo, rel), "utf8");
      const docType = /^doc-type:\s*(\S+)\s*$/m.exec(text)?.[1] ?? null;
      const program = /^program:\s*'?([^'\n]+)'?\s*$/m.exec(text)?.[1] ?? null;
      return {
        slug: slugOf(text),
        docType:
          docType === "plan" ||
          docType === "overall" ||
          docType === "phase-spec" ||
          docType === "single-spec"
            ? docType
            : null,
        program,
      };
    } catch {
      return null;
    }
  };

/** The plan-source read — the declared failure on an unreadable coordinate. */
const planTextOf = (repo: string) => (rel: RepoPath) => {
  try {
    const test = { target: rel, value: readFileSync(path.join(repo, rel), "utf8") } as const;
    return { kind: "text" as const, ...test };
  } catch {
    return { kind: "read-failure" as const, target: rel };
  }
};

/** A plan document's front matter — the identity the frame reads its slug off. */
const planDoc = (tasks: readonly { readonly id: number; readonly dependsOn: string }[]): string =>
  `---\ntitle: 'p9 plan'\ndoc-type: plan\nslug: '${SLUG}'\n---\n\n## Design\n\n${planBody(tasks)}`;

/** One plan body: a task block per id, each declaring `DependsOn`. */
const planBody = (tasks: readonly { readonly id: number; readonly dependsOn: string }[]): string =>
  tasks
    .map((task) =>
      [
        `### Task ${task.id}: task ${task.id}`,
        "",
        "#### Objective",
        "",
        `objective ${task.id}`,
        "",
        "#### Files",
        "",
        "- Create: `a.ts`",
        "",
        "#### Consumes",
        "",
        "- spec",
        "",
        "#### Produces",
        "",
        "- nothing",
        "",
        "#### Steps",
        "",
        "- step",
        "",
        "#### Acceptance",
        "",
        "- accepted",
        "",
        "#### DependsOn",
        "",
        `- ${task.dependsOn}`,
        "",
      ].join("\n"),
    )
    .join("\n");

/** The document judgment stand-in — the gate reads the document slice through this face, so a
 *  case dictates the findings without parsing a document. */
class FakeJudgment implements DocJudgment {
  doc: readonly Finding[] = [];
  ledger: readonly Finding[] = [];

  judge(_input: JudgeInput): readonly Finding[] {
    return this.doc;
  }

  judgeLedger(_input: JudgeInput, _facts: LedgerFacts): readonly Finding[] {
    return this.ledger;
  }

  ruleRows(): readonly RuleDeclaration[] {
    return RULE_REGISTRY;
  }

  closedAt(_path: RepoPath): boolean {
    return false;
  }
}

/** The child seam stand-in — a scripted exit code and a spawn count. */
class FakeRunner implements ChildRunner {
  code: number | null = 0;
  spawns = 0;

  async run(): Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
    facts: { overBudget: boolean; stopped: boolean; signal: string | null };
  }> {
    this.spawns += 1;
    return {
      code: this.code,
      stdout: "",
      stderr: "",
      facts: { overBudget: false, stopped: false, signal: null },
    };
  }
}

/** One fixture's wired world. */
interface Fixture {
  readonly repo: string;
  readonly run: Run;
  readonly ledger: Ledger;
  readonly lines: LinePhase;
  readonly pipeline: Pipeline;
  readonly frame: Frame;
  readonly waveGate: WaveGate;
  readonly refusal: Refusal;
  readonly docs: FakeJudgment;
  readonly assignments: { clean: boolean };
  readonly runner: FakeRunner;
  readonly writes: { count: number; fail: boolean };
  readonly carriedByKey: Map<string, CarriedFacts>;
  readonly prior: { findings: readonly RoundFinding[] };
  readonly lifecycle: Lifecycle;
  readonly options: RunOptions;
  readonly waveInputOf: (frame: FrameFacts) => WaveInput;
}

/** The phase word's op. */
const opOf = (phase: string): "implement" | "review" | "fix" =>
  phase === "branch-review" ? "review" : (phase as "implement" | "review" | "fix");

/** One fixture over a temp repo. */
const fixture = (): Fixture => {
  const repo = tempRepo();
  const basis = RepoRoot.of(repo);
  const root = new WorkspaceRoot({ basis, now: () => FIXED_NOW, baseName: "base.json" });
  const clock = new Clock(() => FIXED_NOW);
  const refusal = new Refusal({ root, clock });
  const docs = new FakeJudgment();
  const assignments = { clean: true };
  const gate = new PreFlight({
    repoRoot: repo,
    tree: { isClean: async () => assignments.clean },
    docs,
    refusal,
  });
  const workspace = root.at(SLUG);
  const ledger = new Ledger({ workspace, names: () => [] });
  const carriedByKey = new Map<string, CarriedFacts>();
  const prior: { findings: readonly RoundFinding[] } = { findings: [] };
  const lines = new LinePhase({
    facts: ledger,
    carried: (record) =>
      carriedByKey.get(`${record.op}:${record.cycle}`) ?? { findings: null, status: null },
    text: (target) => {
      try {
        return readFileSync(path.join(repo, target), "utf8");
      } catch {
        return null;
      }
    },
  });
  const pipeline = new Pipeline({
    lines,
    waves: () => ledger.waveLines(),
    docClassOf: (target) => target.type,
  });
  const frame = new Frame({
    reads: {
      root: basis,
      index: () => SlugIndex.scan(basis, docRootsOf(basis), slugOf),
      planText: planTextOf(repo),
      docFacts: docFactsOf(repo),
    },
    lines: {
      walk: lines,
      attemptOf: (key, op, cycle) =>
        ledger.rounds(key).filter((record) => record.op === op && record.cycle === cycle).length +
        1,
    },
  });
  const waveGate = new WaveGate();
  const runner = new FakeRunner();
  const child = new Child({ runner, clock });
  const inflight = new InFlight({
    root,
    lock: new Lock({ target: path.join(root.path, InFlight.FILE) }),
    clock,
    refusal,
  });
  const writes = { count: 0, fail: false };
  const reads: LifecycleReads = {
    preflight: (facts, holding) => ({
      type: facts.type,
      slug: facts.slug,
      op: opOf(facts.phase),
      cycle: facts.round,
      attempt: facts.attempt,
      inflight:
        holding.kind === "held"
          ? {
              kind: "held",
              pid: holding.record.pid,
              alive: holding.alive,
              targetGone: holding.targetGone,
            }
          : holding,
      graph: facts.graph,
      planLedger: null,
      doc: null,
      rows: null,
    }),
    dispatchFrame: (facts) => ({
      command: "true",
      args: [],
      cwd: repo,
      env: {},
      phase: facts.phase,
      log: { file: path.join(root.path, "round.log"), path: "round.log" as RepoPath },
    }),
    brief: () => ({ name: "brief.md", content: "brief bytes\n" }),
    writeText: (name, content) => {
      writes.count += 1;
      if (writes.fail) return { kind: "write-failure", target: name as RepoPath };
      return workspace.writeText(name, content);
    },
    carried: async (facts) =>
      carriedByKey.get(`${opOf(facts.phase)}:${facts.round}`) ?? { findings: null, status: null },
    priorFindings: () => prior.findings,
    planTasks: () => [],
    docText: () => null,
    stale: () => false,
    reopenRequested: () => false,
  };
  const lifecycle = new Lifecycle({
    gate,
    authority: new Authority(),
    inflight,
    child,
    ledger,
    reads,
  });
  const waveInputOf = (facts: FrameFacts): WaveInput => ({
    graph: facts.graph ?? TaskGraph.parse(""),
    closed: pipeline.closedTasks(),
    waves: ledger.waveLines(),
    phaseOf: (key) => lines.wavePhaseOf(key),
  });
  const options: RunOptions = {
    workspace,
    names: () => [],
    gate,
    refusal,
    inflight,
    child,
    lines,
    frame,
    pipeline,
    waveGate,
    lifecycle,
    stepReads: reads,
    waveInputOf,
    briefName: () => "brief.md",
    host: () => "pi",
  };
  return {
    repo,
    run: new Run(options),
    ledger,
    lines,
    pipeline,
    frame,
    waveGate,
    refusal,
    docs,
    assignments,
    runner,
    writes,
    carriedByKey,
    prior,
    lifecycle,
    options,
    waveInputOf,
  };
};

/** A wave plan of one task, plus its identity document. */
const oneTaskPlan = (fx: Fixture, tasks = [{ id: 1, dependsOn: "none" }]): void => {
  writeDoc(
    fx.repo,
    OVERALL_REL,
    { title: "charter", docType: "overall", slug: "program-1" },
    "# charter\n",
  );
  writeDoc(
    fx.repo,
    SPEC_REL,
    { title: "spec", docType: "phase-spec", slug: SLUG, program: "program-1" },
    "# spec\n\nplan: p9\n",
  );
  writeFileSync(path.join(fx.repo, PLAN_REL), planDoc(tasks), "utf8");
};

/** The wave request of that plan. */
const waveRequest = (over: Partial<FrameRequest> = {}): FrameRequest => ({
  command: "implement",
  type: "wave",
  tasks: "1",
  plan: PLAN_REL,
  ...over,
});

afterEach(() => {
  for (const directory of created.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("the scene assembly", () => {
  it("assembles one frame from one argv-side input, twice the same", () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const first = fx.frame.of(waveRequest());
    const second = fx.frame.of(waveRequest());
    expect(first.kind).toBe("frame");
    expect(second).toEqual(first);
    if (first.kind !== "frame") return;
    expect(first.slug).toBe(SLUG);
    expect(first.target).toEqual({ type: "wave", id: "1", plan: PLAN_REL });
    expect(first.pipeline.specType).toBe("phase-spec");
    expect(first.overall).toBe(OVERALL_REL);
  });

  it("lands two spellings of one --plan on one slug", () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const bare = fx.frame.of(waveRequest({ plan: PLAN_REL }));
    const prefixed = fx.frame.of(waveRequest({ plan: `./${PLAN_REL}` }));
    expect(bare.kind).toBe("frame");
    expect(prefixed.kind).toBe("frame");
    if (bare.kind !== "frame" || prefixed.kind !== "frame") return;
    expect(prefixed.slug).toBe(bare.slug);
    expect(prefixed.planPath).toBe(bare.planPath);
  });

  it("takes argv-side input, never a pre-assembled slug", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const outcome = await fx.run.advance(waveRequest({ plan: SLUG }));
    expect(outcome.kind).toBe("read-failure");
  });

  it("holds zero filesystem read, zero path literal and zero front-matter parse", () => {
    const products = readdirSync(ADVANCE_DIR).filter((name) => name.endsWith(".ts"));
    expect(products.length).toBeGreaterThan(0);
    for (const name of products) {
      const text = readFileSync(path.join(ADVANCE_DIR, name), "utf8");
      expect(text, name).not.toContain('"node:fs"');
      expect(text, name).not.toContain('"node:path"');
      expect(text, name).not.toContain("readFileSync");
      expect(text, name).not.toContain("docs/kairos");
      expect(text, name).not.toContain("process.cwd()");
      for (const specifier of specifiersIn(text).filter((value) => value.startsWith("."))) {
        const resolved = path.resolve(ADVANCE_DIR, specifier);
        expect(resolved.startsWith(path.join(SRC_DIR, "surface")), `${name} → ${specifier}`).toBe(
          false,
        );
      }
    }
  });
});

describe("the frontier is the ledger's projection", () => {
  it("answers the same twice and changes when one fact does", () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const assembled = fx.frame.of(waveRequest());
    if (assembled.kind !== "frame") throw new Error("no frame");
    // The two upstream lines are closed by their own clean reviews, so the wave face is the
    // frontier and its own entry predicate has not held yet: the rule-3 exchange hands over
    // the plan face's exit.
    fx.ledger.recordRound("phase-spec", { op: "review", cycle: 1 });
    fx.ledger.recordRound("plan", { op: "review", cycle: 1 });
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    const before = fx.pipeline.frontierOf(assembled.pipeline);
    const again = fx.pipeline.frontierOf(assembled.pipeline);
    expect(again).toEqual(before);
    expect(before.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT.plan });
    // One changed ledger fact: the wave's implement round enters the face, so the same
    // derivation answers the review hop.
    fx.ledger.recordRound(RoundIdentity.lineWordOf("wave", "1"), { op: "implement", cycle: 1 });
    const after = fx.pipeline.frontierOf(assembled.pipeline);
    expect(after.route).toEqual({ kind: "review" });
    expect(after.face).toBe("wave");
    expect(fx.pipeline.closedTasks().size).toBe(0);
  });

  it("advances one cell per step and books one attempt", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const first = await fx.run.advance(waveRequest());
    expect(first.kind).toBe("dispatch");
    const second = await fx.run.advance(waveRequest());
    expect(second.kind).toBe("dispatch");
    const rounds = fx.ledger.rounds(RoundIdentity.lineWordOf("wave", "1"));
    expect(rounds.map((record) => record.op)).toEqual(["implement", "review"]);
    expect(rounds.map((record) => record.attempt)).toEqual([1, 1]);
  });
});

describe("the declared failures", () => {
  it("answers the board's four arms as values", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    expect(await fx.run.boardOf({ command: "board", type: "plan" })).toEqual({
      kind: "usage",
      reason: { kind: "missing-plan-or-spec" },
    });
    const both = await fx.run.boardOf({
      command: "board",
      type: "plan",
      plan: "docs/kairos/plans/missing.md",
      spec: "docs/kairos/specs/missing.md",
    });
    expect(both.kind).toBe("usage");
    if (both.kind !== "usage") return;
    expect(both.reason).toEqual({
      kind: "board-unmatched",
      misses: [
        { flag: "--plan", target: "docs/kairos/plans/missing.md" },
        { flag: "--spec", target: "docs/kairos/specs/missing.md" },
      ],
    });
    const board = await fx.run.boardOf({ command: "board", type: "plan", plan: PLAN_REL });
    expect(board.kind).toBe("board");
    if (board.kind !== "board") return;
    expect(board.facts.refusal).toEqual({ kind: "absent" });
    expect(board.rows[0]?.kind).toBe("in-flight");
    expect(board.rows[1]?.kind).toBe("next");
  });

  it("answers a plan read failure and a closed line as values", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const missing = await fx.run.advance(waveRequest({ plan: `${PLAN_REL}.nope` }));
    expect(missing).toEqual({ kind: "read-failure", target: `${PLAN_REL}.nope` });
    // A closed line holds no dispatchable frame: a clean review closes the wave, so the line's
    // phase reads null and the frame answers the `no-frame` member.
    fx.ledger.recordRound(RoundIdentity.lineWordOf("wave", "1"), { op: "implement", cycle: 1 });
    fx.carriedByKey.set("implement:1", { findings: [], status: null });
    fx.ledger.recordRound(RoundIdentity.lineWordOf("wave", "1"), { op: "review", cycle: 1 });
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    const closed = await fx.run.advance(waveRequest());
    expect(closed).toEqual({ kind: "usage", reason: { kind: "no-frame", command: "implement" } });
  });

  it("names the unknown task from the plan, not from a literal list", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const unknown = await fx.run.advance(waveRequest({ tasks: "1,7" }));
    expect(unknown).toEqual({
      kind: "usage",
      reason: { kind: "unknown-task", command: "implement", task: 7 },
    });
    writeFileSync(
      path.join(fx.repo, PLAN_REL),
      planDoc([
        { id: 1, dependsOn: "none" },
        { id: 7, dependsOn: "1" },
      ]),
      "utf8",
    );
    const known = await fx.run.advance(waveRequest({ tasks: "1,7" }));
    expect(known.kind).not.toBe("usage");
  });
});

describe("the pre-dispatch refusals", () => {
  it("carries one checked row set across blocked, held, dispatch and preview", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const preview = await fx.run.previewOf(waveRequest());
    expect(preview.kind).toBe("pass");
    const dispatched = await fx.run.advance(waveRequest());
    expect(dispatched.kind).toBe("dispatch");
    if (preview.kind !== "pass" || dispatched.kind !== "dispatch") return;
    expect(dispatched.checked).toEqual(preview.checked);
    expect(dispatched.result.brief.endsWith("/brief.md")).toBe(true);

    const dirty = fixture();
    oneTaskPlan(dirty);
    dirty.assignments.clean = false;
    const blockedPreview = await dirty.run.previewOf(waveRequest());
    const blockedDispatch = await dirty.run.advance(waveRequest());
    expect(blockedPreview.kind).toBe("blocked");
    expect(blockedDispatch.kind).toBe("blocked");
    if (blockedPreview.kind !== "blocked" || blockedDispatch.kind !== "blocked") return;
    expect(blockedDispatch.checked).toEqual(blockedPreview.checked);
    expect(blockedDispatch.verdict.gate).toBe("tree-clean");
  });

  it("answers a held tree from both entries with one kind", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const held = {
      pid: 1,
      command: "implement",
      slug: SLUG,
      startedAt: FIXED_NOW,
      wave: "1",
      phase: "implement",
      cycle: 1,
      attempt: 1,
      plan: PLAN_REL,
      dispatchBase: null,
    };
    mkdirSync(fx.options.workspace.root.path, { recursive: true });
    writeFileSync(
      path.join(fx.options.workspace.root.path, InFlight.FILE),
      `${JSON.stringify(held, null, 2)}\n`,
      "utf8",
    );
    const preview = await fx.run.previewOf(waveRequest());
    const dispatched = await fx.run.advance(waveRequest());
    expect(preview.kind).toBe("held");
    expect(dispatched.kind).toBe("held");
    if (preview.kind !== "held" || dispatched.kind !== "held") return;
    expect(dispatched.checked).toEqual(preview.checked);
  });

  it("returns the write failure of the brief landing untouched", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    fx.writes.fail = true;
    const outcome = await fx.run.advance(waveRequest());
    expect(outcome).toEqual({ kind: "write-failure", target: "brief.md" });
    expect(fx.runner.spawns).toBe(0);
    expect(fx.ledger.rounds(RoundIdentity.lineWordOf("wave", "1"))).toEqual([]);
  });
});

describe("the settle point", () => {
  it("lands a refused dispatch's own record and clears it on an approved one", async () => {
    const refused = fixture();
    oneTaskPlan(refused);
    refused.assignments.clean = false;
    const blocked = await refused.run.advance(waveRequest());
    expect(blocked.kind).toBe("blocked");
    const standing = refused.refusal.readRaw();
    expect(standing.kind).toBe("standing");
    if (standing.kind !== "standing") return;
    expect(standing.facts).toMatchObject({
      station: "tree-clean",
      detail: "dirty-tree",
      type: "wave",
    });
    // A preview on the same tree changes neither side.
    await refused.run.previewOf(waveRequest());
    expect(refused.refusal.readRaw()).toEqual(standing);

    const approved = fixture();
    oneTaskPlan(approved);
    approved.refusal.write({
      slug: SLUG,
      op: "implement",
      type: "wave",
      cycle: 1,
      attempt: 1,
      station: "tree-clean",
      detail: "tree-clean",
    });
    expect(approved.refusal.readRaw().kind).toBe("standing");
    await approved.run.previewOf(waveRequest());
    expect(approved.refusal.readRaw().kind).toBe("standing");
    const dispatches = await approved.run.advance(waveRequest());
    expect(dispatches.kind).toBe("dispatch");
    expect(approved.refusal.readRaw()).toEqual({ kind: "absent" });
  });
});

describe("the six hop cells", () => {
  const routes = new NextRoutes();
  const target = { type: "wave" as const, id: "1,2", plan: PLAN_REL };

  it("reads each cell out of the route it is handed", () => {
    const opened = routes.nextOf({
      target,
      route: { kind: "next-wave", tasks: "1,2" },
      verdict: "wave",
      gate: { docDrift: false, briefDrift: false },
    });
    expect(opened).toEqual({
      face: "wave",
      target,
      hop: "implement",
      to: null,
      reason: "task-open",
      route: { kind: "next-wave", tasks: "1,2" },
    });
    const pendingFix = routes.nextOf({
      target,
      route: { kind: "fix" },
      verdict: "wave",
      gate: { docDrift: false, briefDrift: false },
    });
    expect(pendingFix.reason).toBe("pending-fix");
    expect(pendingFix.hop).toBe("fix");
    const drifted = routes.nextOf({
      target,
      route: { kind: "review" },
      verdict: "wave",
      gate: { docDrift: false, briefDrift: true },
    });
    expect(drifted.reason).toBe("brief-drift");
    const closed = routes.nextOf({
      target,
      route: { kind: "done" },
      verdict: "wave",
      gate: { docDrift: false, briefDrift: false },
    });
    expect(closed.to).toEqual(PIPELINE_NEXT.wave);
    expect(closed.reason).toBe("closed-line");
    const failed = routes.nextOf({
      target: null,
      route: null,
      verdict: "terminal",
      gate: { docDrift: false, briefDrift: false },
    });
    expect(failed).toEqual({
      face: null,
      target: null,
      hop: null,
      to: null,
      reason: "face-closed",
      route: null,
    });
    expect(
      routes.message(closed, (entry) => (entry.kind === "literal" ? entry.literal : "")),
    ).toContain("closed-line · next:");
  });

  it("reads the soft cap's threshold from the ONE constant", () => {
    expect(NextRoutes.atSoftCap(REVIEW_CYCLE_CAP - 1)).toBe(false);
    expect(NextRoutes.atSoftCap(REVIEW_CYCLE_CAP)).toBe(true);
    const capped = routes.routeOf({
      phase: "fix",
      status: null,
      findings: [{ severity: "blocker" }],
      consecutiveBlockers: REVIEW_CYCLE_CAP,
      readyBatch: [],
    });
    expect(capped?.kind).toBe("soft-cap");
  });
});

describe("the wave gate", () => {
  const request = (ids: readonly number[]) => new Set(ids);
  const input = (fx: Fixture, graph: TaskGraph, closed: readonly number[] = []): WaveInput => ({
    graph,
    closed: new Set(closed),
    waves: fx.ledger.waveLines(),
    phaseOf: () => "implement",
  });
  const graphOf = (tasks: readonly { readonly id: number; readonly dependsOn: string }[]) =>
    new TaskGraph(TaskBlocks.parse(planBody(tasks), "plan"));

  it("reports the mixed batch and not the append case", () => {
    const fx = fixture();
    const graph = graphOf([
      { id: 1, dependsOn: "none" },
      { id: 2, dependsOn: "none" },
    ]);
    const mixed = fx.waveGate.vet(request([2]), "implement", input(fx, graph, [1]));
    expect(mixed.reason).toBe(WAVE_GATE_REASON.mixedBatch);
    const allOpen = fx.waveGate.vet(request([2]), "implement", input(fx, graph));
    expect(allOpen.reason).not.toBe(WAVE_GATE_REASON.mixedBatch);
  });

  it("reports a too-wide derived wave before the exact read, and a too-wide request", () => {
    const fx = fixture();
    const wide = graphOf([
      { id: 1, dependsOn: "none" },
      { id: 2, dependsOn: "none" },
      { id: 3, dependsOn: "none" },
      { id: 4, dependsOn: "none" },
    ]);
    expect(fx.waveGate.vet(request([1]), "implement", input(fx, wide)).reason).toBe(
      WAVE_GATE_REASON.waveTooWide,
    );
    const narrow = graphOf([
      { id: 1, dependsOn: "none" },
      { id: 2, dependsOn: "none" },
      { id: 3, dependsOn: "1" },
      { id: 4, dependsOn: "2" },
    ]);
    expect(fx.waveGate.vet(request([1, 2, 3, 4]), "implement", input(fx, narrow)).reason).toBe(
      WAVE_GATE_REASON.tooManyTasks,
    );
    expect(fx.waveGate.vet(request([1, 2]), "implement", input(fx, narrow)).ok).toBe(true);
  });

  it("reports the split and the wrong phase, and approves their neighbours", () => {
    const fx = fixture();
    const graph = graphOf([
      { id: 1, dependsOn: "none" },
      { id: 2, dependsOn: "none" },
    ]);
    expect(fx.waveGate.vet(request([1]), "implement", input(fx, graph)).reason).toBe(
      WAVE_GATE_REASON.split,
    );
    expect(fx.waveGate.vet(request([1, 2]), "implement", input(fx, graph)).ok).toBe(true);
    const wrong = fx.waveGate.vet(request([1, 2]), "fix", {
      ...input(fx, graph),
      phaseOf: () => "review",
    });
    expect(wrong.reason).toBe(WAVE_GATE_REASON.wrongPhase);
    expect(wrong.open).toEqual([1, 2]);
    expect(wrong.phases).toEqual([
      { task: 1, phase: "review" },
      { task: 2, phase: "review" },
    ]);
  });

  it("takes its five tokens from the one table and spells none itself", () => {
    const lineKeys = Object.values(DISPATCH_REASON).filter((row) => row.leg === "line");
    const waveRows = new Set<string>(Object.values(WAVE_GATE_REASON));
    expect(waveRows.size).toBe(5);
    for (const token of waveRows) {
      expect(lineKeys.map((row) => row.token)).toContain(token);
    }
    const text = readFileSync(path.join(ADVANCE_DIR, "wave.ts"), "utf8");
    for (const token of waveRows) expect(text).not.toContain(`"${token}"`);
    for (const token of Object.values(DISPATCH_REASON).map((row) => row.token)) {
      if (token === "split" || token === "graph") continue;
      expect(text).not.toContain(`"${token}"`);
    }
  });
});

describe("the drift reopen and the closure terminal", () => {
  it("reopens a reviewed document that moved outside the round", () => {
    const fx = fixture();
    oneTaskPlan(fx);
    writeDoc(fx.repo, SPEC_REL, { title: "spec", docType: "phase-spec", slug: SLUG }, "# spec\n");
    const content = readFileSync(path.join(fx.repo, SPEC_REL), "utf8");
    const specLine = "phase-spec";
    fx.ledger.recordRound(specLine, { op: "review", cycle: 1 });
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    fx.ledger.recordDocReview(specLine, content);
    fx.ledger.recordReviewed(specLine, ReviewedIdentity.record("document", SPEC_REL, content));
    expect(fx.lines.stateOf(specLine, "phase-spec", SPEC_REL)).toBe("closed");
    writeFileSync(path.join(fx.repo, SPEC_REL), `${content}\nagain\n`, "utf8");
    expect(fx.lines.reopenedAt(specLine, "phase-spec", SPEC_REL)).toBe(true);
    expect(fx.lines.stateOf(specLine, "phase-spec", SPEC_REL)).toBe("reopened");
  });

  it("closes a zero-blocker fix round instead of naming another review", () => {
    const routes = new NextRoutes();
    const clean = routes.routeOf({
      phase: "fix",
      status: null,
      findings: [{ severity: "warn" }],
      consecutiveBlockers: 0,
      readyBatch: [],
    });
    expect(clean).toEqual({ kind: "done" });
    const review = routes.routeOf({
      phase: "review",
      status: null,
      findings: [],
      consecutiveBlockers: 0,
      readyBatch: [],
    });
    expect(review).toEqual({ kind: "done" });
  });
});

describe("the fix completion criterion", () => {
  const facts = (over: Partial<CompletionFacts>): CompletionFacts => ({
    commits: 1,
    groupBase: "base",
    carrierWritten: true,
    findings: null,
    waveTasks: [],
    emptyFileTasks: new Set(),
    evidenceOk: false,
    ...over,
  });

  it("is done exactly when the dispositions cover the request", () => {
    const criterion = CompletionCriteria.of("fix");
    const requested = [{ id: "F1", summary: "the first thing" }];
    expect(
      criterion.judge(facts({ dispositions: { F1: { decision: "fixed" } }, requested })),
    ).toEqual({ kind: "done", observations: [] });
  });

  it("names both sides of the difference in ONE message", () => {
    const criterion = new DispositionsCriterion();
    const verdict = criterion.judge(
      facts({
        dispositions: { F1: { decision: "fixed" }, F9: { decision: "fixed" } },
        requested: [
          { id: "F1", summary: "kept" },
          { id: "F2", summary: "the missing thing. And more." },
        ],
      }),
    );
    expect(verdict.kind).toBe("violation");
    if (verdict.kind !== "violation") return;
    expect(verdict.message).toContain("F2: the missing thing.");
    expect(verdict.message).toContain("F9 unknown");
    expect(verdict.message).not.toContain("\n");
  });

  it("refuses a reasonless rejection and counts the two decisions", () => {
    const criterion = new DispositionsCriterion();
    const rejected = criterion.judge(
      facts({
        dispositions: { F1: { decision: "rejected" } },
        requested: [{ id: "F1", summary: "a" }],
      }),
    );
    expect(rejected.kind).toBe("violation");
    const summary = DispositionsCriterion.summaryOf({
      F1: { decision: "fixed" },
      F2: { decision: "rejected", reason: "not a defect" },
    });
    expect(summary).toEqual({ fixed: 1, rejected: 1 });
    expect(DispositionsCriterion.summaryOf({ F1: { decision: "fixed" } })).toEqual({
      fixed: 1,
      rejected: 0,
    });
  });

  it("books the empty input, the summary pairing and the zero commits as observations", () => {
    const criterion = new DispositionsCriterion();
    const verdict = criterion.judge(
      facts({ dispositions: {}, requested: [], matchedBySummary: true, commits: 0 }),
    );
    expect(verdict.kind).toBe("done");
    if (verdict.kind !== "done") return;
    expect(verdict.observations.map((row) => row.grade)).toEqual(["soft", "soft", "soft"]);
  });

  it("refuses a tampered requesting carrier rather than judging it", () => {
    const text = `${JSON.stringify({ findings: [] }, null, 2)}\n`;
    const recorded = CarrierLine.digestOf({ findings: [] });
    expect(CarrierLine.read(text, "plan-review-1.json", recorded)).toBe(text);
    expect(() => CarrierLine.read(text, "plan-review-1.json", "0".repeat(64))).toThrow();
  });
});

describe("the capsule summary", () => {
  it("takes its bytes from the ONE regrade note, all three arms", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    // The gate's own doc judgment is silent here, so the wave's review round carries the
    // findings the fixture dictates.
    fx.ledger.recordRound(RoundIdentity.lineWordOf("wave", "1"), { op: "implement", cycle: 1 });
    fx.carriedByKey.set("implement:1", { findings: [], status: null });
    fx.carriedByKey.set("review:1", {
      findings: [{ severity: "warn", summary: "row", id: "F1", impact: { scenario: "repro" } }],
      status: null,
    });
    const prior: readonly RoundFinding[] = [
      { severity: "blocker", summary: "row", id: "F1", impact: { scenario: "repro" } },
    ];
    fx.prior.findings = prior;
    const note = regradeNote(1, []);
    expect(note).toBeDefined();
    const downgraded = await fx.run.advance(waveRequest());
    expect(downgraded.kind).toBe("dispatch");
    if (downgraded.kind !== "dispatch") return;
    expect(downgraded.capsule.summary).toBe(note);

    const withReason = fixture();
    oneTaskPlan(withReason);
    withReason.ledger.recordRound(RoundIdentity.lineWordOf("wave", "1"), {
      op: "implement",
      cycle: 1,
    });
    withReason.carriedByKey.set("implement:1", { findings: [], status: null });
    withReason.carriedByKey.set("review:1", {
      findings: [
        {
          severity: "warn",
          summary: "row",
          id: "F1",
          impact: { scenario: "repro" },
          regrade: "narrowed scope",
        },
      ],
      status: null,
    });
    withReason.prior.findings = prior;
    const stated = await withReason.run.advance(waveRequest());
    expect(stated.kind).toBe("dispatch");
    if (stated.kind !== "dispatch") return;
    expect(stated.capsule.summary).toBe(regradeNote(0, ["narrowed scope"]));

    const unchanged = fixture();
    oneTaskPlan(unchanged);
    unchanged.ledger.recordRound(RoundIdentity.lineWordOf("wave", "1"), {
      op: "implement",
      cycle: 1,
    });
    unchanged.carriedByKey.set("implement:1", { findings: [], status: null });
    unchanged.carriedByKey.set("review:1", {
      findings: [{ severity: "blocker", summary: "row", id: "F1", impact: { scenario: "repro" } }],
      status: null,
    });
    unchanged.prior.findings = prior;
    const raised = await unchanged.run.advance(waveRequest());
    expect(raised.kind).toBe("dispatch");
    if (raised.kind !== "dispatch") return;
    expect(raised.capsule).toEqual({});
  });
});

describe("the dry run", () => {
  it("runs three pure reads and suppresses every write, lock and spawn", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const before = fx.runner.spawns;
    const outcome = await fx.run.previewOf(waveRequest());
    expect(outcome.kind).toBe("pass");
    expect(fx.runner.spawns).toBe(before);
    expect(fx.writes.count).toBe(0);
    expect(fx.ledger.rounds(RoundIdentity.lineWordOf("wave", "1"))).toEqual([]);
    expect(existsSync(fx.options.workspace.root.path)).toBe(false);
    if (outcome.kind !== "pass") return;
    expect(outcome.brief).toBe("brief.md");
    expect(fx.lines.wavePhaseOf("1")).toBe("implement");
  });

  it("refuses on the line leg where the real dispatch would, with the same rows", async () => {
    const fx = fixture();
    oneTaskPlan(fx, [
      { id: 1, dependsOn: "none" },
      { id: 2, dependsOn: "none" },
    ]);
    const refused = await fx.run.previewOf(waveRequest({ tasks: "1" }));
    expect(refused.kind).toBe("refused");
    const dispatched = await fx.run.advance(waveRequest({ tasks: "1" }));
    expect(dispatched.kind).toBe("dispatch");
    if (refused.kind !== "refused" || dispatched.kind !== "dispatch") return;
    expect(refused.verdict.reason).toBe(WAVE_GATE_REASON.split);
    expect(refused.checked).toEqual(dispatched.checked);
  });

  it("answers the assembly failures with the same kind the dispatch does", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const preview = await fx.run.previewOf(waveRequest({ plan: `${PLAN_REL}.nope` }));
    const dispatched = await fx.run.advance(waveRequest({ plan: `${PLAN_REL}.nope` }));
    expect(preview).toEqual(dispatched);
    const usage = await fx.run.previewOf(waveRequest({ tasks: "9" }));
    expect(usage.kind).toBe("usage");
    expect(usage).toEqual({
      kind: "usage",
      reason: { kind: "unknown-task", command: "implement", task: 9 },
    });
  });
});

describe("the target table", () => {
  it("drives the phase word from a row, not from a branch", () => {
    expect(TargetFaces.reviewLeadOf("branch")).toBe("branch-review");
    expect(TargetFaces.reviewLeadOf("phase-spec")).toBe("review");
    expect(TargetFaces.isDocShape("overall")).toBe(true);
    expect(TargetFaces.isDocShape("wave")).toBe(false);
    expect(TargetFaces.rows().length).toBe(6);
    const fx = fixture();
    expect(fx.lines.phaseOf("branch", "branch")).toBe("branch-review");
    expect(fx.lines.phaseOf("phase-spec", "phase-spec")).toBe("review");
  });
});
