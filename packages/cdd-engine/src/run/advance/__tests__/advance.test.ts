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
//   · the drift reopen and the closure terminal — a fix binds only the version its OWN commits
//     produced (an untouched fix leaves the previous binding standing), and only a review opens
//     a review batch;
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
  FIX_ZERO_COMMITS,
  type Finding,
  type FixDisposition,
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
import type { EvidenceRead, RoundFinding } from "../../dispatch/handoff.ts";
import { InFlight } from "../../dispatch/inflight.ts";
import { Authority } from "../../gate/authority.ts";
import { type DocJudgment, PreFlight } from "../../gate/preflight.ts";
import { Refusal } from "../../gate/refusal.ts";
import { type BoardRow, Run, type RunOptions } from "../../index.ts";
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
  SOFT_CAP_SUGGESTION,
  WAVE_GATE_REASON,
} from "../next.ts";
import { Pipeline } from "../pipeline.ts";
import { TARGET_FACES, TargetFaces } from "../target-faces.ts";
import { WaveGate, type WaveInput } from "../wave.ts";

/** This segment's directory and product modules. */
const ADVANCE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The engine package's `src` root. */
const SRC_DIR = path.resolve(ADVANCE_DIR, "../..");

/** The dispatch baseline the fixture's dispatch reads — the value both records must carry. */
const HEAD_SHA = "9f1c0de5ba5eba11d15c0ffee0123456789abcd";

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

/** One task's declared `Files` row — a task that changes one file. */
const DEFAULT_FILES: readonly string[] = ["- Create: `a.ts`"];

/** A plan document's front matter — the identity the frame reads its slug off. */
const planDoc = (
  tasks: readonly { readonly id: number; readonly dependsOn: string }[],
  files: readonly string[] = DEFAULT_FILES,
): string =>
  `---\ntitle: 'p9 plan'\ndoc-type: plan\nslug: '${SLUG}'\n---\n\n## Design\n\n${planBody(tasks, files)}`;

/** One plan body: a task block per id, each declaring `DependsOn` and one `Files` section. An
 *  empty `files` list declares the section and keeps it blank — the verification-wave shape. */
const planBody = (
  tasks: readonly { readonly id: number; readonly dependsOn: string }[],
  files: readonly string[] = DEFAULT_FILES,
): string =>
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
        ...files,
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
  readonly requesting: {
    findings: readonly RoundFinding[];
    reviews?: string;
    rulings?: string;
  };
  readonly commits: { count: number; bases: string[] };
  readonly groupBase: { value: string | null };
  /** The HEAD this dispatch starts from — the dispatch baseline the step reads ONCE and
   *  records on both writes. */
  readonly head: { value: string | null };
  /** Whether the round's own commits touched the input it binds — the fix binding's gate, a
   *  fact the REAL read derives from `dispatchBase..HEAD`'s path set. `null` is the
   *  UNMEASURABLE range (no baseline, or an unreadable repository). */
  readonly touchedDoc: { value: boolean | null; bases: (string | null)[] };
  /** The test-evidence file's read — the evidence gate's one input — and how many times the
   *  step asked for it (one read per round, none on a face that owes no file). */
  readonly evidence: { read: EvidenceRead; reads: number };
  /** The brief face's two renders: the landed bytes (which carry the round context) and the
   *  task-only projection a wave round binds. */
  readonly briefBytes: { content: string; reviewed: string };
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
  const requesting: {
    findings: readonly RoundFinding[];
    reviews?: string;
    rulings?: string;
  } = { findings: [] };
  const commits = { count: 1, bases: [] as string[] };
  const groupBase: { value: string | null } = { value: "base" };
  const head: { value: string | null } = { value: HEAD_SHA };
  const touchedDoc: { value: boolean | null; bases: (string | null)[] } = {
    value: false,
    bases: [],
  };
  // A work round owes green evidence by default: the gate passes unless a pin states the file's
  // own failure, so no completion pin has to pay for a fact it is not about.
  const evidence: { read: EvidenceRead; reads: number } = { read: { kind: "ok" }, reads: 0 };
  const briefBytes = { content: "brief bytes\n", reviewed: "task body\n" };
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
    projection: () => briefBytes.reviewed,
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
    brief: () => ({ name: "brief.md", content: briefBytes.content, reviewed: briefBytes.reviewed }),
    writeText: (name, content) => {
      writes.count += 1;
      if (writes.fail) return { kind: "write-failure", target: name as RepoPath };
      return workspace.writeText(name, content);
    },
    carried: async (facts) =>
      carriedByKey.get(`${opOf(facts.phase)}:${facts.round}`) ?? { findings: null, status: null },
    priorFindings: () => prior.findings,
    planTasks: () => {
      try {
        return [...TaskGraph.parse(readFileSync(path.join(repo, PLAN_REL), "utf8")).nodes()];
      } catch {
        return [];
      }
    },
    docText: (facts) => {
      if (facts.doc === null) return null;
      try {
        return readFileSync(path.join(repo, facts.doc), "utf8");
      } catch {
        return null;
      }
    },
    stale: () => false,
    reopenRequested: () => false,
    requesting: () => requesting,
    commits: (base) => {
      commits.bases.push(base);
      return commits.count;
    },
    groupBase: () => groupBase.value,
    head: async () => head.value,
    touchedDoc: (_frame, base) => {
      touchedDoc.bases.push(base);
      return touchedDoc.value;
    },
    evidence: (facts) => {
      evidence.reads += 1;
      return { target: `evidence-${facts.round}.json`, read: evidence.read };
    },
    blockerRun: (facts) => lines.blockerRunOf(facts.key, facts.type, facts.round),
  };
  const waveGate = new WaveGate();
  const waveInputOf = (facts: FrameFacts): WaveInput => ({
    graph: facts.graph ?? TaskGraph.parse(""),
    closed: pipeline.closedTasks(),
    waves: ledger.waveLines(),
    phaseOf: (key) => lines.wavePhaseOf(key),
  });
  const lifecycle = new Lifecycle({
    gate,
    authority: new Authority(),
    inflight,
    child,
    ledger,
    reads,
    waveGate,
    waveInput: waveInputOf,
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
    lifecycle,
    stepReads: reads,
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
    requesting,
    commits,
    groupBase,
    head,
    touchedDoc,
    evidence,
    briefBytes,
    lifecycle,
    options,
    waveInputOf,
  };
};

/** A wave plan of one task, plus its identity document. */
const oneTaskPlan = (
  fx: Fixture,
  tasks = [{ id: 1, dependsOn: "none" }],
  files: readonly string[] = DEFAULT_FILES,
): void => {
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
  writeFileSync(path.join(fx.repo, PLAN_REL), planDoc(tasks, files), "utf8");
};

/** The wave request of that plan. */
const waveRequest = (over: Partial<FrameRequest> = {}): FrameRequest => ({
  command: "implement",
  type: "wave",
  tasks: "1",
  plan: PLAN_REL,
  ...over,
});

/** A wave line at the fix hop: one completed implement plus `reviews` completed reviews, each
 *  carrying one blocker — the shape `Frame#of` reads as the fix phase (round = the newest
 *  review's cycle). */
const fixableWave = (fx: Fixture, reviews = 1): string => {
  const line = RoundIdentity.lineWordOf("wave", "1");
  fx.ledger.recordRound(line, { op: "implement", cycle: 1 });
  fx.carriedByKey.set("implement:1", { findings: [], status: null });
  for (let cycle = 1; cycle <= reviews; cycle += 1) {
    fx.carriedByKey.set(`review:${cycle}`, {
      findings: [{ severity: "blocker", summary: "row" }],
      status: null,
    });
    fx.ledger.recordRound(line, { op: "review", cycle });
  }
  return line;
};

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

  it("answers the next ready batch from a closure, not the run's exhaustion", async () => {
    const fx = fixture();
    oneTaskPlan(fx, [
      { id: 1, dependsOn: "none" },
      { id: 2, dependsOn: "1" },
    ]);
    fx.carriedByKey.set("implement:1", { findings: [], status: null });
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    expect((await fx.run.advance(waveRequest({ tasks: "1" }))).kind).toBe("dispatch");
    const reviewed = await fx.run.advance(waveRequest({ command: "review", tasks: "1" }));
    expect(reviewed.kind).toBe("dispatch");
    if (reviewed.kind !== "dispatch") return;
    // One wave of two closes: the closure names the ready batch, never `done`.
    expect(reviewed.result.route).toEqual({ kind: "next-wave", tasks: "2" });
    expect(fx.ledger.planTasksOf(RoundIdentity.lineWordOf("wave", "1"))).toEqual([1, 2]);
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
    // A closed line holds no dispatchable frame: a clean review closes the wave, so the
    // assembly answers the SCENE alone and the dispatch entry names the member (the board
    // reads the same scene — pinned in the closed-line case below).
    fx.ledger.recordRound(RoundIdentity.lineWordOf("wave", "1"), { op: "implement", cycle: 1 });
    fx.carriedByKey.set("implement:1", { findings: [], status: null });
    fx.ledger.recordRound(RoundIdentity.lineWordOf("wave", "1"), { op: "review", cycle: 1 });
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    const closed = await fx.run.advance(waveRequest());
    expect(closed).toEqual({ kind: "usage", reason: { kind: "no-frame", command: "implement" } });
  });

  it("answers a closed plan line and a closed wave line as boards", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    // A closed WAVE line: one implement plus one clean review, hand-written so the case drives
    // only the closed-line read (the booking's own write is pinned above).
    const waveLine = RoundIdentity.lineWordOf("wave", "1");
    fx.ledger.recordRound(waveLine, { op: "implement", cycle: 1 });
    fx.carriedByKey.set("implement:1", { findings: [], status: null });
    fx.ledger.recordRound(waveLine, { op: "review", cycle: 1 });
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    const waveBoard = await fx.run.boardOf(waveRequest({ command: "board" }));
    expect(waveBoard.kind).toBe("board");
    if (waveBoard.kind !== "board") return;
    expect(waveBoard.rows.find((row) => row.kind === "wave")).toMatchObject({
      line: waveLine,
      phase: null,
      closed: true,
    });
    // The dispatch entry still names the member for the same tree — the board never does.
    expect(await fx.run.advance(waveRequest())).toEqual({
      kind: "usage",
      reason: { kind: "no-frame", command: "implement" },
    });
    // A closed PLAN line, driven through a REAL dispatch so its row and its closing read are
    // the step's own.
    const planRequest = { command: "review", type: "plan" as const, plan: PLAN_REL };
    expect((await fx.run.advance(planRequest)).kind).toBe("dispatch");
    const planBoard = await fx.run.boardOf(planRequest);
    expect(planBoard.kind).toBe("board");
    if (planBoard.kind !== "board") return;
    expect(planBoard.rows.find((row) => row.kind === "doc")?.state).toBe("closed");
    expect(await fx.run.advance(planRequest)).toEqual({
      kind: "usage",
      reason: { kind: "no-frame", command: "review" },
    });
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

  it("reports a board's doc row at the document that row is judged at", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    const request = { command: "review", type: "phase-spec" as const, spec: SPEC_REL };
    expect((await fx.run.advance(request)).kind).toBe("dispatch");
    expect(fx.lines.stateOf("phase-spec", "phase-spec", SPEC_REL)).toBe("closed");
    // The document moves OUTSIDE the round: the row and the board's `next:` row must agree.
    const content = readFileSync(path.join(fx.repo, SPEC_REL), "utf8");
    writeFileSync(path.join(fx.repo, SPEC_REL), `${content}\nmoved outside the round\n`, "utf8");
    const board = await fx.run.boardOf({ command: "board", type: "plan", plan: PLAN_REL });
    expect(board.kind).toBe("board");
    if (board.kind !== "board") return;
    const docRow = board.rows.find(
      (row): row is Extract<BoardRow, { kind: "doc" }> =>
        row.kind === "doc" && row.line === "phase-spec",
    );
    expect(docRow?.state).toBe("reopened");
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
    expect(blockedDispatch.leg).toBe("structure");
    if (blockedDispatch.leg === "structure") {
      expect(blockedDispatch.verdict.gate).toBe("tree-clean");
    }
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
  });

  it("hands the fix hop the requesting carrier's own coordinates, and invents none", () => {
    const requesting = {
      reviews: "docs/kairos/plans/p9-review-1.json",
      rulings: "docs/kairos/plans/p9-review-1.rulings.json",
    };
    const carried = routes.routeOf({
      phase: "review",
      status: null,
      findings: [{ severity: "blocker", summary: "row" }],
      consecutiveBlockers: 0,
      readyBatch: [],
      requesting,
    });
    expect(carried).toEqual({ kind: "fix", ...requesting });
    // No carrier, no payload: the absent coordinate stays absent rather than invented.
    expect(
      routes.routeOf({
        phase: "review",
        status: null,
        findings: [{ severity: "blocker", summary: "row" }],
        consecutiveBlockers: 0,
        readyBatch: [],
      }),
    ).toEqual({ kind: "fix" });
    // The same payload leaves a LINE's route through its carried record, not a second read.
    const line = new LinePhase({
      facts: {
        rounds: () => [
          {
            op: "review",
            cycle: 1,
            attempt: 1,
            dispatchBase: null,
            verdict: { treeClean: true, targetAction: true },
            violations: [],
            carrierDigest: null,
          },
        ],
        docDriftOf: () => null,
        reviewedOf: () => null,
      },
      carried: () => ({
        findings: [{ severity: "blocker", summary: "row" }],
        status: null,
        requesting,
      }),
      text: () => null,
    });
    expect(line.routeOf("branch", "branch")).toEqual({ kind: "fix", ...requesting });
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
  it("reopens a reviewed document that moved outside the round", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    // A review round is done when its carrier carries a findings array, so the fixture
    // states the empty conclusion its carrier would hold.
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    // The reviewed version is bound by a REAL dispatch: the review round's booking writes the
    // document line's own cell, under that line's word.
    const reviewed = await fx.run.advance({
      command: "review",
      type: "phase-spec",
      spec: SPEC_REL,
    });
    expect(reviewed.kind).toBe("dispatch");
    expect(fx.ledger.docLines().map((line) => line.line)).toEqual(["phase-spec"]);
    const content = readFileSync(path.join(fx.repo, SPEC_REL), "utf8");
    expect(fx.ledger.docHashOf("phase-spec")).toBe(ReviewedIdentity.hashOf(content));
    expect(fx.lines.stateOf("phase-spec", "phase-spec", SPEC_REL)).toBe("closed");
    writeFileSync(path.join(fx.repo, SPEC_REL), `${content}\nagain\n`, "utf8");
    expect(fx.lines.reopenedAt("phase-spec", "phase-spec", SPEC_REL)).toBe(true);
    expect(fx.lines.stateOf("phase-spec", "phase-spec", SPEC_REL)).toBe("reopened");
  });

  it("binds a completed fix's revision, so its own edits never reopen the line", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    // A warn-only review routes the fix hop; the fix edits the spec, covers the request and
    // starts the re-review hop the same warn would have named.
    fx.carriedByKey.set("review:1", {
      findings: [{ severity: "warn", summary: "a warn", id: "F1" }],
      status: null,
    });
    expect(
      (await fx.run.advance({ command: "review", type: "phase-spec", spec: SPEC_REL })).kind,
    ).toBe("dispatch");
    const preFix = readFileSync(path.join(fx.repo, SPEC_REL), "utf8");
    writeFileSync(path.join(fx.repo, SPEC_REL), `${preFix}\nthe fix's own edit\n`, "utf8");
    const postFix = readFileSync(path.join(fx.repo, SPEC_REL), "utf8");
    fx.requesting.findings = [{ severity: "warn", summary: "a warn", id: "F1" }];
    fx.carriedByKey.set("fix:1", {
      findings: null,
      status: "APPROVED",
      dispositions: { F1: { status: "fixed" } },
    });
    // The fix's own commit touched the document it judges.
    fx.touchedDoc.value = true;
    const fix = await fx.run.advance({ command: "fix", type: "phase-spec", spec: SPEC_REL });
    expect(fix.kind).toBe("dispatch");
    if (fix.kind !== "dispatch") return;
    expect(fix.result.round.verdict.targetAction).toBe(true);
    // The binding moved with the round: the recorded version is the POST-fix revision, so the
    // fix's own bytes are not a drift against the line it just concluded.
    expect(fx.ledger.docHashOf("phase-spec")).toBe(ReviewedIdentity.hashOf(postFix));
    expect(fx.lines.stateOf("phase-spec", "phase-spec", SPEC_REL)).not.toBe("reopened");
    // ONE review batch, whatever the fix wrote: a fix moves the recorded version, it is not a
    // second review of the line.
    expect(fx.ledger.docLines().map((line) => line.batch)).toEqual([1]);
  });

  it("keeps an untouched fix from binding bytes it never delivered", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    fx.carriedByKey.set("review:1", {
      findings: [{ severity: "warn", summary: "a warn", id: "F1" }],
      status: null,
    });
    expect(
      (await fx.run.advance({ command: "review", type: "phase-spec", spec: SPEC_REL })).kind,
    ).toBe("dispatch");
    const reviewed = readFileSync(path.join(fx.repo, SPEC_REL), "utf8");
    expect(fx.ledger.docHashOf("phase-spec")).toBe(ReviewedIdentity.hashOf(reviewed));
    // The document moves in a commit OUTSIDE any round. Drift never outranks a pending fix, so
    // the line reads `open` at its fix hop — and the movement stays an unreviewed fact.
    writeFileSync(path.join(fx.repo, SPEC_REL), `${reviewed}\namended out of round\n`, "utf8");
    expect(fx.lines.stateOf("phase-spec", "phase-spec", SPEC_REL)).toBe("open");
    // The fix round edits only code: its own commits never touched the document it judges, so it
    // produced no version and the review's binding stands — the movement is NOT laundered into
    // "reviewed", and the line keeps saying the document moved.
    fx.requesting.findings = [{ severity: "warn", summary: "a warn", id: "F1" }];
    fx.carriedByKey.set("fix:1", {
      findings: null,
      status: "APPROVED",
      dispositions: { F1: { status: "fixed" } },
    });
    fx.touchedDoc.value = false;
    const fix = await fx.run.advance({ command: "fix", type: "phase-spec", spec: SPEC_REL });
    expect(fix.kind).toBe("dispatch");
    if (fix.kind !== "dispatch") return;
    expect(fix.result.round.verdict.targetAction).toBe(true);
    expect(fx.ledger.docHashOf("phase-spec")).toBe(ReviewedIdentity.hashOf(reviewed));
    expect(fx.lines.stateOf("phase-spec", "phase-spec", SPEC_REL)).toBe("reopened");
    // No review batch was opened by the fix either.
    expect(fx.ledger.docLines().map((line) => line.batch)).toEqual([1]);
  });

  it("keeps a fix's binding standing when its own bytes cannot be measured, and books why", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    fx.carriedByKey.set("review:1", {
      findings: [{ severity: "warn", summary: "a warn", id: "F1" }],
      status: null,
    });
    expect(
      (await fx.run.advance({ command: "review", type: "phase-spec", spec: SPEC_REL })).kind,
    ).toBe("dispatch");
    const preFix = readFileSync(path.join(fx.repo, SPEC_REL), "utf8");
    writeFileSync(path.join(fx.repo, SPEC_REL), `${preFix}\nthe fix's own edit\n`, "utf8");
    const postFix = readFileSync(path.join(fx.repo, SPEC_REL), "utf8");
    fx.requesting.findings = [{ severity: "warn", summary: "a warn", id: "F1" }];
    fx.carriedByKey.set("fix:1", {
      findings: null,
      status: "APPROVED",
      dispositions: { F1: { status: "fixed" } },
    });
    // The range cannot be read (no baseline, or an unreadable repository): NOTHING was measured,
    // which is not the same fact as "measured, and it touched nothing".
    fx.touchedDoc.value = null;
    const fix = await fx.run.advance({ command: "fix", type: "phase-spec", spec: SPEC_REL });
    expect(fix.kind).toBe("dispatch");
    if (fix.kind !== "dispatch") return;
    expect(fix.result.round.verdict.targetAction).toBe(true);
    // An unmeasurable round keeps today's binding: the fix DID edit the document it judges, so
    // refusing to bind would reopen the line on bytes the round delivered.
    expect(fx.ledger.docHashOf("phase-spec")).toBe(ReviewedIdentity.hashOf(postFix));
    expect(fx.lines.stateOf("phase-spec", "phase-spec", SPEC_REL)).not.toBe("reopened");
    expect(fx.ledger.docLines().map((line) => line.batch)).toEqual([1]);
    // … and the blindness itself is on record, in the old tree's own sentence.
    const soft = fix.result.round.violations
      .filter((row) => row.grade === "soft")
      .map((row) => row.message);
    expect(soft).toContain(
      "the reviewed-revision write-back could not measure whether this round touched the document (no dispatch baseline or an unreadable repository) — the current bytes were bound",
    );
  });

  it("binds a wave review to its task-only projection, never to the landed bytes", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    fx.carriedByKey.set("implement:1", { findings: [], status: null });
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    expect((await fx.run.advance(waveRequest())).kind).toBe("dispatch");
    const reviewed = await fx.run.advance(waveRequest({ command: "review" }));
    expect(reviewed.kind).toBe("dispatch");
    const waveLine = RoundIdentity.lineWordOf("wave", "1");
    const bound = fx.ledger.reviewedOf(waveLine);
    expect(bound?.kind).toBe("brief");
    // The recorded version is the projection, not the landed brief: the landed bytes carry the
    // round-context section, which changes with every dispatch.
    expect(bound?.hash).toBe(ReviewedIdentity.hashOf("task body\n"));
    expect(bound?.hash).not.toBe(ReviewedIdentity.hashOf(fx.briefBytes.content));
    // The document cell stays empty on the task-graph face: one line kind, one reviewed cell.
    expect(fx.ledger.docHashOf(waveLine)).toBeNull();
  });

  it("reads the wave's drift off that projection, so a round-context rewrite is no drift", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    fx.carriedByKey.set("implement:1", { findings: [], status: null });
    // A blocker-carrying review leaves the wave owing a fix — the hop drift can reopen.
    fx.carriedByKey.set("review:1", {
      findings: [{ severity: "blocker", summary: "row", id: "F1" }],
      status: null,
    });
    expect((await fx.run.advance(waveRequest())).kind).toBe("dispatch");
    expect((await fx.run.advance(waveRequest({ command: "review" }))).kind).toBe("dispatch");
    expect(fx.lines.waveRouteOf("1")).toEqual({ kind: "fix" });
    // The next dispatch re-renders the brief with a different round-context section; the
    // projection did not move, so the line is not drifted and keeps its fix hop.
    fx.briefBytes.content = "brief bytes, a later round\n";
    expect(fx.lines.briefDriftedAt("1")).toBe(false);
    expect(fx.lines.waveRouteOf("1")).toEqual({ kind: "fix" });
    // A projection that DID move reopens the line at its review hop.
    fx.briefBytes.reviewed = "task body, amended\n";
    expect(fx.lines.briefDriftedAt("1")).toBe(true);
    expect(fx.lines.waveRouteOf("1")).toEqual({ kind: "review" });
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
      criterion.judge(facts({ dispositions: { F1: { status: "fixed" } }, requested })),
    ).toEqual({ kind: "done", observations: [] });
  });

  it("names both sides of the difference in ONE message", () => {
    const criterion = new DispositionsCriterion();
    const verdict = criterion.judge(
      facts({
        dispositions: { F1: { status: "fixed" }, F9: { status: "fixed" } },
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

  it("refuses a reasonless rejection and counts the two statuses", () => {
    const criterion = new DispositionsCriterion();
    const rejected = criterion.judge(
      facts({
        dispositions: { F1: { status: "rejected" } },
        requested: [{ id: "F1", summary: "a" }],
      }),
    );
    expect(rejected.kind).toBe("violation");
    const summary = DispositionsCriterion.summaryOf({
      F1: { status: "fixed" },
      F2: { status: "rejected", reason: "not a defect" },
    });
    expect(summary).toEqual({ fixed: 1, rejected: 1 });
    expect(DispositionsCriterion.summaryOf({ F1: { status: "fixed" } })).toEqual({
      fixed: 1,
      rejected: 0,
    });
  });

  it("refuses a cell the wire vocabulary does not declare", () => {
    const criterion = new DispositionsCriterion();
    // The frozen dispatch prompt declares the cell as `{ "status": "fixed" | "rejected" }`, so
    // any other word is a shape refusal — never a row the summary counts as neither value.
    const wrongWord = { F1: { decision: "fixed" } } as unknown as Readonly<
      Record<string, FixDisposition>
    >;
    const verdict = criterion.judge(
      facts({ dispositions: wrongWord, requested: [{ id: "F1", summary: "a" }] }),
    );
    expect(verdict.kind).toBe("violation");
    if (verdict.kind !== "violation") return;
    expect(verdict.message).toContain('disposition "F1" declares status undefined');
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

  it("carries the fix round's two counts as the capsule fact beside the note's own cell", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    fx.carriedByKey.set("review:1", {
      findings: [{ severity: "warn", summary: "a warn", id: "F1" }],
      status: null,
    });
    expect(
      (await fx.run.advance({ command: "review", type: "phase-spec", spec: SPEC_REL })).kind,
    ).toBe("dispatch");
    fx.requesting.findings = [
      { severity: "warn", summary: "a warn", id: "F1" },
      { severity: "warn", summary: "another", id: "F2" },
    ];
    fx.carriedByKey.set("fix:1", {
      findings: null,
      status: "APPROVED",
      dispositions: {
        F1: { status: "fixed" },
        F2: { status: "rejected", reason: "not a defect" },
      },
    });
    const fix = await fx.run.advance({ command: "fix", type: "phase-spec", spec: SPEC_REL });
    expect(fix.kind).toBe("dispatch");
    if (fix.kind !== "dispatch") return;
    // Two counts, derived from the same table the round was judged by — data, never a sentence:
    // the template and its slots belong to the render face.
    expect(fix.capsule.dispositionCounts).toEqual({ fixed: 1, rejected: 1 });
    // The note keeps its OWN cell: a fix round has no regrade note, so the judge face's cell
    // stays absent rather than borrowing the counts' row.
    expect(fix.capsule.summary).toBeUndefined();
  });
});

describe("the booked verdict", () => {
  it("withholds the target action from a round whose child exited non-zero", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    expect((await fx.run.advance(waveRequest())).kind).toBe("dispatch");
    fx.runner.code = 1;
    const failed = await fx.run.advance(waveRequest());
    expect(failed.kind).toBe("dispatch");
    if (failed.kind !== "dispatch") return;
    expect(failed.result.code).toBe(1);
    expect(failed.result.round.verdict).toEqual({ treeClean: true, targetAction: false });
    const crashed = fx.ledger.crashedOf(fx.ledger.nodeRecordsOf(fx.ledger.read()));
    expect(crashed.map((row) => row.cause)).toContain("child-exit");
    // A failed round is no carrier: the line never reads as reviewed, let alone closed.
    expect(fx.lines.waveClosedAt("1")).toBe(false);
    expect(fx.lines.wavePhaseOf("1")).toBe("review");
  });

  it("binds nothing on a review round whose child exited non-zero", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    // The doc face's own review: the binding's gate rides the BOOKED verdict, so a child that
    // never delivered its conclusion records no version at all.
    fx.runner.code = 1;
    const failed = await fx.run.advance({ command: "review", type: "phase-spec", spec: SPEC_REL });
    expect(failed.kind).toBe("dispatch");
    if (failed.kind !== "dispatch") return;
    expect(failed.result.round.verdict.targetAction).toBe(false);
    expect(fx.ledger.docHashOf("phase-spec")).toBeNull();
    expect(fx.ledger.reviewedOf("phase-spec")).toBeNull();
    expect(fx.lines.stateOf("phase-spec", "phase-spec", SPEC_REL)).toBe("open");
  });

  it("withholds it from a carrier that concluded BLOCKED, under its own cause", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    expect((await fx.run.advance(waveRequest())).kind).toBe("dispatch");
    fx.carriedByKey.set("review:1", { findings: [], status: "BLOCKED" });
    const blocked = await fx.run.advance(waveRequest());
    expect(blocked.kind).toBe("dispatch");
    if (blocked.kind !== "dispatch") return;
    expect(blocked.result.round.verdict.targetAction).toBe(false);
    const crashed = fx.ledger.crashedOf(fx.ledger.nodeRecordsOf(fx.ledger.read()));
    expect(crashed.map((row) => row.cause)).toContain("round-blocked");
    expect(fx.lines.waveClosedAt("1")).toBe(false);
  });

  it("refuses a review round that persisted no judge carrier, and an implement round that committed nothing", async () => {
    // A review whose child exited 0 but wrote no carrier concluded nothing: the criterion's
    // refusal is the round's hard entry, and the wave is never closed on it.
    const review = fixture();
    oneTaskPlan(review);
    review.carriedByKey.set("implement:1", { findings: [], status: null });
    expect((await review.run.advance(waveRequest())).kind).toBe("dispatch");
    const lost = await review.run.advance(waveRequest({ command: "review" }));
    expect(lost.kind).toBe("dispatch");
    if (lost.kind !== "dispatch") return;
    expect(lost.result.round.verdict.targetAction).toBe(false);
    expect(
      lost.result.round.violations.filter((row) => row.grade === "hard").map((row) => row.message),
    ).toContain("the review round persisted no judge carrier");
    expect(review.ledger.planTasksOf(RoundIdentity.lineWordOf("wave", "1"))).toBeNull();
    expect(review.lines.waveClosedAt("1")).toBe(false);

    // A zero-commit implement round is the same shape: the commit criterion refuses it, and
    // the line stays at its implement hop.
    const implement = fixture();
    oneTaskPlan(implement);
    implement.commits.count = 0;
    const empty = await implement.run.advance(waveRequest());
    expect(empty.kind).toBe("dispatch");
    if (empty.kind !== "dispatch") return;
    expect(empty.result.round.verdict.targetAction).toBe(false);
    expect(
      empty.result.round.violations.filter((row) => row.grade === "hard").map((row) => row.message),
    ).toContain("the group committed nothing since its baseline base");
    expect(implement.ledger.planTasksOf(RoundIdentity.lineWordOf("wave", "1"))).toBeNull();
    expect(implement.lines.wavePhaseOf("1")).toBe("implement");
  });

  it("records the dispatch baseline it measured on both records", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    // A round that ended abnormally leaves its in-flight record standing, so both halves of the
    // ONE measured baseline are readable after the step: the booked round and the postmortem.
    fx.runner.code = 1;
    const stepped = await fx.run.advance(waveRequest());
    expect(stepped.kind).toBe("dispatch");
    if (stepped.kind !== "dispatch") return;
    expect(stepped.result.round.dispatchBase).toBe(HEAD_SHA);
    expect(
      fx.ledger.rounds(RoundIdentity.lineWordOf("wave", "1")).map((row) => row.dispatchBase),
    ).toEqual([HEAD_SHA]);
    const holding = await fx.run.inflight.inspect();
    expect(holding.kind).toBe("held");
    if (holding.kind !== "held") return;
    expect(holding.record.dispatchBase).toBe(HEAD_SHA);
  });

  it("completes on the baseline it measured, and names that sha when the group committed nothing", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    // No earlier record carries a baseline: the group's first round IS its own baseline, so the
    // judgment reads the HEAD this dispatch measured and is about to record.
    fx.groupBase.value = null;
    fx.commits.count = 3;
    const done = await fx.run.advance(waveRequest());
    expect(done.kind).toBe("dispatch");
    if (done.kind !== "dispatch") return;
    expect(done.result.round.verdict.targetAction).toBe(true);
    expect(done.result.round.dispatchBase).toBe(HEAD_SHA);
    // The count came off THAT baseline — one measured HEAD, never a second invention.
    expect(fx.commits.bases).toEqual([HEAD_SHA]);

    // The zero-commit arm then names the recorded sha: with no baseline it could not print the
    // second half of its sentence at all.
    const zero = fixture();
    oneTaskPlan(zero);
    zero.groupBase.value = null;
    zero.commits.count = 0;
    const empty = await zero.run.advance(waveRequest());
    expect(empty.kind).toBe("dispatch");
    if (empty.kind !== "dispatch") return;
    expect(
      empty.result.round.violations.filter((row) => row.grade === "hard").map((row) => row.message),
    ).toContain(`the group committed nothing since its baseline ${HEAD_SHA}`);
  });

  it("reads the verification-wave shape off the plan's own Files declaration", async () => {
    // A wave whose every member declares no file change: the plan's `Files` section is the ONE
    // source of that shape, and it must stay REACHABLE — otherwise a wave that declared no
    // diff still books "committed nothing", a refusal its own declaration never earned.
    const fx = fixture();
    oneTaskPlan(fx, [{ id: 1, dependsOn: "none" }], []);
    const assembled = fx.frame.of(waveRequest());
    expect(assembled.kind).toBe("frame");
    if (assembled.kind !== "frame") return;
    expect([...assembled.emptyFileTasks]).toEqual([1]);
    // The same cell over a plan that declares a file: no verification shape.
    const ordinary = fixture();
    oneTaskPlan(ordinary);
    const plain = ordinary.frame.of(waveRequest());
    expect(plain.kind).toBe("frame");
    if (plain.kind !== "frame") return;
    expect([...plain.emptyFileTasks]).toEqual([]);
    // A zero-commit round in that wave is judged on the evidence it owes, never on a commit its
    // declaration never promised — and with NO green evidence it refuses on that true gap.
    fx.commits.count = 0;
    fx.evidence.read = { kind: "missing" };
    const judged = await fx.run.advance(waveRequest());
    expect(judged.kind).toBe("dispatch");
    if (judged.kind !== "dispatch") return;
    const hard = judged.result.round.violations
      .filter((row) => row.grade === "hard")
      .map((row) => row.message);
    expect(hard.some((message) => message.includes("still owes green evidence"))).toBe(true);
    expect(hard.some((message) => message.includes("committed nothing"))).toBe(false);
    // WITH green evidence the shape COMPLETES: a verification wave is reachable end to end, not
    // a plan shape the tree refuses forever.
    const green = fixture();
    oneTaskPlan(green, [{ id: 1, dependsOn: "none" }], []);
    green.commits.count = 0;
    const done = await green.run.advance(waveRequest());
    expect(done.kind).toBe("dispatch");
    if (done.kind !== "dispatch") return;
    expect(done.result.round.verdict.targetAction).toBe(true);
    expect(
      done.result.round.violations.filter((row) => row.grade === "soft").map((row) => row.message),
    ).toContain(
      "the implement round committed nothing — every task of this wave declares an empty `Files`, so the round concluded on its green evidence as a verification wave",
    );
  });

  it("refuses a work round whose test evidence is missing or off-contract", async () => {
    // The evidence gate is a WORK round's own debt on a task face; the file's three failure
    // shapes each book their own hard entry and withhold the target action.
    const missing = fixture();
    oneTaskPlan(missing);
    missing.evidence.read = { kind: "missing" };
    const unwritten = await missing.run.advance(waveRequest());
    expect(unwritten.kind).toBe("dispatch");
    if (unwritten.kind !== "dispatch") return;
    expect(unwritten.result.round.verdict.targetAction).toBe(false);
    // ONE read answers both consumers, so the round never pays for two reads of one file.
    expect(missing.evidence.reads).toBe(1);
    expect(unwritten.result.round.violations.map((row) => row.message)).toContain(
      "the test evidence at evidence-1.json was not written",
    );

    const breached = fixture();
    oneTaskPlan(breached);
    breached.evidence.read = { kind: "breached", problems: ["passed: expected a boolean"] };
    const offContract = await breached.run.advance(waveRequest());
    expect(offContract.kind).toBe("dispatch");
    if (offContract.kind !== "dispatch") return;
    expect(offContract.result.round.verdict.targetAction).toBe(false);
    expect(offContract.result.round.violations.map((row) => row.message)).toContain(
      "the test evidence at evidence-1.json violates the contract: passed: expected a boolean",
    );
  });

  it("asks no evidence of a face that owes none", async () => {
    // A judge round owes findings and a document face owes its document: the evidence read is
    // never consulted there, so a missing evidence file cannot gate either.
    const fx = fixture();
    oneTaskPlan(fx);
    fx.evidence.read = { kind: "missing" };
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    const reviewed = await fx.run.advance({
      command: "review",
      type: "phase-spec",
      spec: SPEC_REL,
    });
    expect(reviewed.kind).toBe("dispatch");
    if (reviewed.kind !== "dispatch") return;
    expect(reviewed.result.round.verdict.targetAction).toBe(true);
    const messages = reviewed.result.round.violations.map((row) => row.message);
    expect(messages.some((message) => message.includes("test evidence"))).toBe(false);
    expect(fx.evidence.reads).toBe(0);
  });
});

describe("the fix completion judgment", () => {
  it("refuses a fix round whose dispositions miss a requested finding", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    fixableWave(fx);
    fx.requesting.findings = [
      { severity: "blocker", summary: "the first thing", id: "F1" },
      { severity: "blocker", summary: "the second thing", id: "F2" },
    ];
    fx.carriedByKey.set("fix:1", {
      findings: null,
      status: null,
      dispositions: { F1: { status: "fixed" } },
    });
    const outcome = await fx.run.advance(waveRequest({ command: "fix" }));
    expect(outcome.kind).toBe("dispatch");
    if (outcome.kind !== "dispatch") return;
    expect(outcome.result.round.verdict.targetAction).toBe(false);
    const hard = outcome.result.round.violations.filter((row) => row.grade === "hard");
    expect(hard.map((row) => row.message).join(" ")).toContain("F2: the second thing");
    const crashed = fx.ledger.crashedOf(fx.ledger.nodeRecordsOf(fx.ledger.read()));
    expect(crashed.some((row) => row.op === "fix")).toBe(true);
    // The line still owes the fix: the failed round closes nothing.
    expect(fx.lines.waveClosedAt("1")).toBe(false);
    expect(fx.lines.wavePhaseOf("1")).toBe("fix");
  });

  it("books the source review's blockers as the re-review hop, and closes no wave", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    const waveLine = fixableWave(fx);
    // The fix carrier declares no findings slot; the blockers the hop judges are the SOURCE
    // review's input findings.
    fx.requesting.findings = [{ severity: "blocker", summary: "the only row", id: "F1" }];
    fx.carriedByKey.set("fix:1", {
      findings: null,
      status: "APPROVED",
      dispositions: { F1: { status: "fixed" } },
    });
    const outcome = await fx.run.advance(waveRequest({ command: "fix" }));
    expect(outcome.kind).toBe("dispatch");
    if (outcome.kind !== "dispatch") return;
    // The dispositions cover the request, so the round completed — and still owes a re-review.
    expect(outcome.result.round.verdict.targetAction).toBe(true);
    expect(outcome.result.route).toEqual({ kind: "review" });
    expect(fx.ledger.planTasksOf(waveLine)).toBeNull();
    expect(fx.lines.waveClosedAt("1")).toBe(false);
  });

  it("books a covering round as complete, with the criterion's soft observations", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    fixableWave(fx);
    fx.requesting.findings = [{ severity: "blocker", summary: "the only thing", id: "F1" }];
    fx.commits.count = 0;
    fx.carriedByKey.set("fix:1", {
      findings: null,
      status: "APPROVED",
      dispositions: { F1: { status: "fixed" } },
    });
    const outcome = await fx.run.advance(waveRequest({ command: "fix" }));
    expect(outcome.kind).toBe("dispatch");
    if (outcome.kind !== "dispatch") return;
    expect(outcome.result.round.verdict.targetAction).toBe(true);
    expect(outcome.result.round.violations.map((row) => row.message)).toContain(FIX_ZERO_COMMITS);
  });
});

describe("the soft cap's counter", () => {
  const reviews = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      op: "review" as const,
      cycle: index + 1,
      attempt: 1,
      dispatchBase: null,
      verdict: { treeClean: true, targetAction: true },
      violations: [],
      carrierDigest: null,
    }));

  const lineOf = (count: number, cleanCycle: number | null): LinePhase =>
    new LinePhase({
      facts: {
        rounds: (key) => (key === "branch" ? reviews(count) : []),
        docDriftOf: () => null,
        reviewedOf: () => null,
      },
      carried: (record) => ({
        findings:
          record.cycle === cleanCycle ? [] : [{ severity: "blocker" as const, summary: "row" }],
        status: null,
      }),
      text: () => null,
    });

  it("walks the line's completed reviews back from the fix round, not the round's own set", () => {
    const run = REVIEW_CYCLE_CAP + 1;
    expect(lineOf(run, null).blockerRunOf("branch", "branch", run)).toBe(run);
    expect(lineOf(run, 41).blockerRunOf("branch", "branch", run)).toBe(run - 41);
    expect(lineOf(run, run).blockerRunOf("branch", "branch", run)).toBe(0);
    // The count the route reads: the cap's own threshold, crossed by the run alone.
    const routes = new NextRoutes();
    const capped = routes.routeOf({
      phase: "fix",
      status: null,
      findings: [],
      consecutiveBlockers: lineOf(run, null).blockerRunOf("branch", "branch", run),
      readyBatch: [],
    });
    expect(capped).toEqual({ kind: "soft-cap", message: SOFT_CAP_SUGGESTION });
    const open = routes.routeOf({
      phase: "fix",
      status: null,
      findings: [],
      consecutiveBlockers: lineOf(run, 41).blockerRunOf("branch", "branch", run),
      readyBatch: [],
    });
    expect(open).toEqual({ kind: "done" });
  });

  it("feeds that run to the route a real fix round books", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    fixableWave(fx, REVIEW_CYCLE_CAP + 1);
    fx.carriedByKey.set(`fix:${REVIEW_CYCLE_CAP + 1}`, {
      findings: [],
      status: "APPROVED",
      dispositions: {},
    });
    const outcome = await fx.run.advance(waveRequest({ command: "fix" }));
    expect(outcome.kind).toBe("dispatch");
    if (outcome.kind !== "dispatch") return;
    expect(outcome.result.round.cycle).toBe(REVIEW_CYCLE_CAP + 1);
    expect(outcome.result.route).toEqual({ kind: "soft-cap", message: SOFT_CAP_SUGGESTION });
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

  it("refuses the same split tree on both entries, with the same rows", async () => {
    const fx = fixture();
    oneTaskPlan(fx, [
      { id: 1, dependsOn: "none" },
      { id: 2, dependsOn: "none" },
    ]);
    const refused = await fx.run.previewOf(waveRequest({ tasks: "1" }));
    const dispatched = await fx.run.advance(waveRequest({ tasks: "1" }));
    // One conclusion for one tree: the dry run answers `refused` and the real dispatch
    // answers `blocked` (the two faces' streams differ, the judgment does not) — neither
    // spawns a child, neither books a round.
    expect(refused.kind).toBe("refused");
    expect(dispatched.kind).toBe("blocked");
    if (refused.kind !== "refused" || dispatched.kind !== "blocked") return;
    expect(refused.verdict.reason).toBe(WAVE_GATE_REASON.split);
    expect(dispatched.leg).toBe("line");
    if (dispatched.leg !== "line") return;
    expect(dispatched.verdict.reason).toBe(refused.verdict.reason);
    expect(dispatched.checked).toEqual(refused.checked);
    expect(fx.runner.spawns).toBe(0);
    expect(fx.ledger.rounds(RoundIdentity.lineWordOf("wave", "1"))).toEqual([]);
  });

  it("leaves a doc or branch face to its own leg, not to the wave gate", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    // Neither face carries `--tasks`, so a wave gate applied here would read `split` on
    // every request; both entries skip it on the row's audit cell.
    expect(
      (await fx.run.previewOf({ command: "review", type: "phase-spec", spec: SPEC_REL })).kind,
    ).toBe("pass");
    expect(
      (await fx.run.advance({ command: "review", type: "phase-spec", spec: SPEC_REL })).kind,
    ).toBe("dispatch");
  });

  it("keeps the brief landing on the task face alone", async () => {
    const fx = fixture();
    oneTaskPlan(fx);
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    const request = { command: "review", type: "phase-spec" as const, spec: SPEC_REL };
    // A preview names no brief a doc dispatch would never write, and a real doc dispatch
    // writes none — `INPUT_WAVE_BRIEF` stays empty off the task face.
    const preview = await fx.run.previewOf(request);
    expect(preview.kind).toBe("pass");
    if (preview.kind !== "pass") return;
    expect(preview.brief).toBe("");
    const dispatched = await fx.run.advance(request);
    expect(dispatched.kind).toBe("dispatch");
    if (dispatched.kind !== "dispatch") return;
    expect(dispatched.result.brief).toBe("");
    expect(fx.writes.count).toBe(0);
    // A write face that answers the declared failure does not refuse a doc dispatch: no
    // brief was ever going to land on that face.
    const reprobe = fixture();
    oneTaskPlan(reprobe);
    reprobe.carriedByKey.set("review:1", { findings: [], status: null });
    reprobe.writes.fail = true;
    expect((await reprobe.run.advance(request)).kind).toBe("dispatch");
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
  it("drives two rows through one lifecycle: the review-lead phase and the batch cell", async () => {
    // The cells the rows declare, in the table's own vocabulary.
    expect(TargetFaces.reviewLeadOf("branch")).toBe("branch-review");
    expect(TargetFaces.reviewLeadOf("phase-spec")).toBe("review");
    expect(TargetFaces.isDocShape("overall")).toBe(true);
    expect(TargetFaces.isDocShape("wave")).toBe(false);
    expect(TargetFaces.isTaskGraph("wave")).toBe(true);
    expect(TargetFaces.isTaskGraph("branch")).toBe(false);
    expect(TargetFaces.advancesBatch("wave")).toBe(true);
    expect(TargetFaces.advancesBatch("branch")).toBe(false);
    expect(TargetFaces.rows().length).toBe(6);

    const fx = fixture();
    oneTaskPlan(fx);
    const branch = fx.frame.of({ command: "review", type: "branch", plan: PLAN_REL });
    const doc = fx.frame.of({ command: "review", type: "phase-spec", spec: SPEC_REL });
    if (branch.kind !== "frame" || doc.kind !== "frame") throw new Error("no frame");
    // The phase word each row selects, read off one assembly.
    expect(branch.phase).toBe("branch-review");
    expect(doc.phase).toBe("review");
    expect(fx.lines.phaseOf("branch", "branch")).toBe("branch-review");
    expect(fx.lines.phaseOf("phase-spec", "phase-spec")).toBe("review");

    // The SAME step, driven by both rows: neither closes a wave line (no batch cell).
    expect((await fx.run.advance({ command: "review", type: "branch", plan: PLAN_REL })).kind).toBe(
      "dispatch",
    );
    expect(
      (await fx.run.advance({ command: "review", type: "phase-spec", spec: SPEC_REL })).kind,
    ).toBe("dispatch");
    expect(fx.ledger.planTasksOf("branch")).toBeNull();
    expect(fx.ledger.planTasksOf("phase-spec")).toBeNull();

    // The row that DOES advance a batch: the same step closes the wave line and records the
    // plan's own task snapshot (the fixture's one-task plan).
    fx.carriedByKey.set("review:1", { findings: [], status: null });
    expect((await fx.run.advance(waveRequest())).kind).toBe("dispatch");
    expect((await fx.run.advance(waveRequest())).kind).toBe("dispatch");
    expect(fx.ledger.planTasksOf(RoundIdentity.lineWordOf("wave", "1"))).toEqual([1]);
  });

  it("changes the dispatch when the row changes, with no lifecycle edit", async () => {
    // The cells are flipped in place for the length of this case: what the assertions
    // measure is that the ROW — not a branch on the type word — selects the behaviour.
    const wave = TARGET_FACES.wave;
    const branch = TARGET_FACES.branch;
    const waveBatch = wave.nextSemantics;
    const branchLead = branch.product;
    try {
      (wave as { nextSemantics: { batch: boolean } }).nextSemantics = { batch: false };
      const fx = fixture();
      oneTaskPlan(fx);
      expect((await fx.run.advance(waveRequest())).kind).toBe("dispatch");
      expect((await fx.run.advance(waveRequest())).kind).toBe("dispatch");
      // The same closing step, no batch cell: the wave line keeps no snapshot.
      expect(fx.ledger.planTasksOf(RoundIdentity.lineWordOf("wave", "1"))).toBeNull();

      (branch as { product: { reviewLead: string } }).product = { reviewLead: "review" };
      const driven = fixture();
      oneTaskPlan(driven);
      const frame = driven.frame.of({ command: "review", type: "branch", plan: PLAN_REL });
      if (frame.kind !== "frame") throw new Error("no frame");
      expect(frame.phase).toBe("review");
    } finally {
      (wave as { nextSemantics: { batch: boolean } }).nextSemantics = waveBatch;
      (branch as { product: { reviewLead: string } }).product = branchLead;
    }
  });
});
