// packages/cdd-engine/src/run/dispatch/__tests__/dispatch.test.ts
// The dispatch segment's pins, one group per fact the segment owns:
//
//   · the occupancy — zero records before the child exists, no residue after a normal
//     ending, and the record standing after an abnormal one (a cut-short round, a throwing
//     body);
//   · the record's three states — absent · held · corrupt, and a corrupt record with no
//     lock behind it being displaced by the next acquisition;
//   · the record's start instant — the process table's answer, the injected clock's only as
//     the fallback, and no wall-clock read anywhere in the segment;
//   · the handoff read-back — three shapes, two of them refusals sharing ONE cause word,
//     and absence never a refusal;
//   · the conclusion — three-way, derived from the findings, never from a child status;
//   · the downgrade judgment — two reads partitioning one comparison, and the reference
//     being the most recent non-empty finding set;
//   · the liveness judge — a growing leg alone is progress, two flat legs are a stall, and
//     an unreadable leg keeps its last readable tick (so it still authorizes a stall);
//   · the watch — one stall verdict per dispatch and the last sample staying the stall;
//   · the value assembly — one basis, one composition, byte-stable twice;
//   · the budget and the three termination causes — the seam's facts as the cause they
//     name;
//   · the refusal books no round — a refused dispatch moves no cycle and no attempt;
//   · the release point's refusal expiry — the station filter, its two neighbour arms, its
//     idempotence, and the reads that never clear;
//   · the segment boundary — no reach into a later segment, and the lock taken through
//     `env/process/lock.ts` alone.
//
// Every record case drives a real `WorkspaceRoot` over a temp directory: "the record lands
// through the workspace" is only a fact if the write is the workspace's own.

import {
  existsSync,
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
import type { Finding, JudgeInput, LedgerFacts, RuleDeclaration } from "../../../docs/index.ts";
import type { RepoPath } from "../../../env/paths/root.ts";
import { RepoRoot } from "../../../env/paths/root.ts";
import type { ChildOutcome, ChildRun, ChildRunner } from "../../../env/process/child-runner.ts";
import { Clock } from "../../../env/process/clock.ts";
import { Lock } from "../../../env/process/lock.ts";
import { WorkspaceRoot } from "../../../env/workspace/workspace.ts";
import { PreFlight } from "../../gate/preflight.ts";
import { Refusal } from "../../gate/refusal.ts";
import { WORKSPACE_ARTIFACTS } from "../../ledger/artifacts.ts";
import { Ledger } from "../../ledger/ledger.ts";
import { BUDGET, Child, type DispatchFrame, type DispatchOutcome, ROUND_PHASES } from "../child.ts";
import { CONTRACT_VIOLATION, Handoff, type RoundFinding } from "../handoff.ts";
import { InFlight, type InFlightRecord, type RoundEnding, TARGET_FACTS } from "../inflight.ts";
import {
  CpuAdvance,
  LIVENESS_SIGNALS,
  type LivenessContext,
  LivenessJudge,
  type LivenessReads,
  LogGrowth,
  Sampler,
  type SignalReading,
  Watch,
} from "../liveness.ts";
import { type DispatchSceneFacts, DispatchValues } from "../values.ts";

/** The `src`-relative directory this file pins. */
const DISPATCH_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The engine package's `src` root — the base a segment specifier resolves under. */
const SRC_DIR = path.resolve(DISPATCH_DIR, "../..");

/** The segments `run/dispatch` may never reach: the later `run/` segment and the consumer
 *  surface. `run/ledger` and `run/gate` are NOT among them — the record and the refusal
 *  fact are this segment's direct collaborators. */
const FOREIGN_SEGMENTS = ["run/advance", "surface"] as const;

/** A fixed instant — the injected clock's one reading. */
const FIXED_NOW = 1_700_000_000_000;

/** The phase workspace slug every case dispatches on. */
const SLUG = "p9";

/** The wave line every case records under. */
const LINE = "tasks-1";

/** The temp repositories this file made, removed after every case. */
const created: string[] = [];

/** A temp directory — the basis a fixture's workspace family hangs on. */
const tempRepo = (): string => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "dispatch-")));
  created.push(directory);
  return directory;
};

/** The leg reads every case injects: no filesystem, no `ps`, so a pin never depends on the
 *  machine it runs on. */
const flatReads: LivenessReads = { sizeOf: () => 0, cpuOf: () => 0 };

/** One child outcome — the seam's fail-open result face. */
const childOutcome = (over: Partial<ChildOutcome> = {}): ChildOutcome => ({
  code: 0,
  stdout: "",
  stderr: "",
  facts: { overBudget: false, stopped: false, signal: null },
  ...over,
});

/** The ending judgment the dispatch face reads off an outcome — the rule T13 wires as the
 *  caller of `occupy`: a round the engine CONCLUDED (the child exited on its own, or the
 *  spawn never produced a process) removes the record, while a cut-short round keeps it as
 *  the postmortem fact. */
const endingOf = (outcome: DispatchOutcome): RoundEnding =>
  outcome.termination !== null || (outcome.code !== null && outcome.code !== 0)
    ? "abnormal"
    : "normal";

/** A scripted child seam — the ONE spawn point, stubbed per case. */
class StubRunner implements ChildRunner {
  readonly #script: (run: ChildRun) => Promise<ChildOutcome>;
  /** How many times the seam was asked to spawn. */
  calls = 0;

  constructor(script: (run: ChildRun) => Promise<ChildOutcome>) {
    this.#script = script;
  }

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls += 1;
    return this.#script(run);
  }
}

/** The document judgment's stand-in — the gate reads the document slice through this face,
 *  and the refusal case needs no document at all. */
class NoDocuments {
  judge(_input: JudgeInput): readonly Finding[] {
    return [];
  }

  judgeLedger(_input: JudgeInput, _facts: LedgerFacts): readonly Finding[] {
    return [];
  }

  ruleRows(): readonly RuleDeclaration[] {
    return [];
  }

  closedAt(_path: RepoPath): boolean {
    return false;
  }
}

/** One fixture: a temp repo, its workspace family, the refusal fact, the lock and the
 *  in-flight record — every collaborator CONSTRUCTED, as the composition root will. */
const fixture = (opts: { readonly runner?: ChildRunner } = {}) => {
  const repo = tempRepo();
  const basis = new RepoRoot(repo);
  const clock = new Clock(() => FIXED_NOW);
  const root = new WorkspaceRoot({ basis, now: clock.now, baseName: "base.json" });
  const refusal = new Refusal({ root, clock });
  const lock = new Lock({ target: path.join(root.path, InFlight.FILE) });
  const inflight = new InFlight({
    root,
    lock,
    clock,
    refusal,
    liveness: { live: async () => true },
    starts: { startOf: async () => null },
  });
  const runner = opts.runner ?? new StubRunner(async () => childOutcome());
  const child = new Child({ runner, clock, reads: flatReads });
  const workspace = root.at(SLUG).ensure();
  const frame: DispatchFrame = {
    command: "cdd-implement",
    args: ["--tasks", "1"],
    cwd: repo,
    env: {},
    phase: "implement",
    log: {
      file: workspace.resolve("tasks-1-implement-1.log"),
      path: workspace.relOf("tasks-1-implement-1.log"),
    },
  };
  const record: InFlightRecord = {
    pid: process.pid,
    command: "cdd implement --tasks 1",
    slug: SLUG,
    startedAt: FIXED_NOW,
    wave: "1",
    phase: "implement",
    cycle: 1,
    attempt: 1,
    plan: null,
    dispatchBase: null,
  };
  return {
    repo,
    basis,
    clock,
    root,
    refusal,
    lock,
    inflight,
    child,
    runner,
    workspace,
    frame,
    record,
  };
};

/** This segment's product modules — the judged domain (`__tests__/` is test surface). */
const dispatchModules = (): string[] =>
  readdirSync(DISPATCH_DIR).filter((name) => name.endsWith(".ts"));

/** Every text of the segment's product modules. */
const dispatchTexts = (): readonly { readonly name: string; readonly text: string }[] =>
  dispatchModules().map((name) => ({
    name,
    text: readFileSync(path.join(DISPATCH_DIR, name), "utf8"),
  }));

/** The edges from one text that land in a segment this one may not reach. */
const foreignEdges = (directory: string, text: string): string[] => {
  const roots = FOREIGN_SEGMENTS.map((segment) => path.join(SRC_DIR, segment));
  return specifiersIn(text)
    .filter((specifier) => specifier.startsWith("."))
    .filter((specifier) => {
      const resolved = path.resolve(directory, specifier);
      return roots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
    });
};

/** One step of a scripted leg set — the size and CPU the next tick reads. */
interface LegScript {
  size: number | null;
  cpu: number | null;
}

/** A scripted `LivenessReads` — each call answers the current step. */
class ScriptedReads implements LivenessReads {
  #step: LegScript;

  constructor(step: LegScript) {
    this.#step = step;
  }

  set(step: LegScript): void {
    this.#step = step;
  }

  sizeOf(_path: string): number | null {
    return this.#step.size;
  }

  cpuOf(_pgid: number): number | null {
    return this.#step.cpu;
  }
}

/** One liveness context over a scripted read set and a mutable instant. */
const livenessContext = (reads: LivenessReads, at: () => number): LivenessContext => ({
  logPath: "/tmp/round.log",
  pgid: 4242,
  reads,
  clock: new Clock(at),
});

afterEach(() => {
  for (const directory of created.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("the occupancy — zero records before the child exists, no residue after a normal ending", () => {
  it("publishes nothing until the child is dispatched, and the normal end removes the record", async () => {
    const { inflight, child, frame, record } = fixture();
    expect(existsSync(inflight.path())).toBe(false);
    const seen: string[] = [];
    const occupancy = await inflight.occupy(
      record,
      async () => {
        seen.push((await inflight.inspect()).kind);
        return child.dispatch(frame);
      },
      { ending: endingOf },
    );
    expect(occupancy.kind).toBe("ran");
    expect(seen).toEqual(["held"]);
    // No residue: neither the record nor the lock carrier survives the normal ending.
    expect(existsSync(inflight.path())).toBe(false);
    expect(existsSync(Lock.carrierOf(inflight.path()))).toBe(false);
    expect((await inflight.inspect()).kind).toBe("absent");
  });

  it("leaves no residue when the spawn never produced a child — there is nothing to post-mortem", async () => {
    const runner = new StubRunner(async () => childOutcome({ code: null, stderr: "ENOENT" }));
    const { inflight, child, frame, record } = fixture({ runner });
    const occupancy = await inflight.occupy(record, () => child.dispatch(frame), {
      ending: endingOf,
    });
    if (occupancy.kind !== "ran") throw new Error("the occupancy was refused");
    expect(occupancy.value.code).toBeNull();
    expect(occupancy.value.termination).toBeNull();
    expect(existsSync(inflight.path())).toBe(false);
    expect(existsSync(Lock.carrierOf(inflight.path()))).toBe(false);
  });

  it("keeps the record when the child is cut short, and drops the lock alone", async () => {
    const runner = new StubRunner(async () =>
      childOutcome({
        code: null,
        facts: { overBudget: false, stopped: true, signal: "SIGTERM" },
      }),
    );
    const { inflight, child, frame, record } = fixture({ runner });
    const occupancy = await inflight.occupy(record, () => child.dispatch(frame), {
      ending: endingOf,
    });
    if (occupancy.kind !== "ran") throw new Error("the occupancy was refused");
    expect(occupancy.value.termination).toBe("stalled");
    expect(occupancy.value.code).toBeNull();
    // The postmortem fact: the record stands, with the cells the two shipped readers need
    // (the board's `in-flight:` row and the `--recover` abort fold).
    const state = await inflight.inspect();
    expect(state.kind).toBe("held");
    if (state.kind !== "held") return;
    expect(state.record.pid).toBe(process.pid);
    expect(state.record.slug).toBe(SLUG);
    expect(state.record.cycle).toBe(1);
    expect(state.record.attempt).toBe(1);
    // …while the lock, which is only mutual exclusion, is gone: no handle outlives its round.
    expect(existsSync(Lock.carrierOf(inflight.path()))).toBe(false);
  });

  it("keeps the record when the body throws — and still drops the lock", async () => {
    const { inflight, record } = fixture();
    await expect(
      inflight.occupy(
        record,
        async () => {
          throw new Error("the body failed");
        },
        { ending: endingOf },
      ),
    ).rejects.toThrow("the body failed");
    // An ending nobody judged is the abnormal one: the record is the only fact left behind.
    expect(existsSync(inflight.path())).toBe(true);
    expect(existsSync(Lock.carrierOf(inflight.path()))).toBe(false);
    expect((await inflight.inspect()).kind).toBe("held");
  });

  it("expires no refusal fact on the abnormal ending — only the normal end invalidates it", async () => {
    const runner = new StubRunner(async () => childOutcome({ code: 137 }));
    const { inflight, child, frame, record, refusal } = fixture({ runner });
    refusal.write({
      slug: SLUG,
      op: "implement",
      type: "wave",
      cycle: 1,
      attempt: 1,
      station: "in-flight",
      detail: "the tree refused",
    });
    const occupancy = await inflight.occupy(record, () => child.dispatch(frame), {
      ending: endingOf,
    });
    if (occupancy.kind !== "ran") throw new Error("the occupancy was refused");
    expect(occupancy.value.code).toBe(137);
    expect(existsSync(inflight.path())).toBe(true);
    expect(refusal.readRaw().kind).toBe("standing");
  });

  it("refuses to enter a tree a live holder occupies — the body never runs", async () => {
    const { inflight, record } = fixture();
    const first = await inflight.acquire(record);
    expect(first.kind).toBe("acquired");
    let ran = false;
    const refused = await inflight.occupy(
      { ...record, pid: process.pid + 1 },
      async () => {
        ran = true;
        return "never";
      },
      { ending: () => "normal" },
    );
    expect(refused.kind).toBe("held");
    expect(ran).toBe(false);
    await inflight.release();
  });
});

describe("the record's three states", () => {
  it("answers absent with nothing on disk", async () => {
    const { inflight } = fixture();
    expect(await inflight.inspect()).toEqual({ kind: "absent" });
  });

  it("answers held with the record, its holder's liveness and its target facts", async () => {
    const { inflight, record } = fixture();
    await inflight.acquire(record);
    const state = await inflight.inspect();
    expect(state.kind).toBe("held");
    if (state.kind !== "held") return;
    expect(state.record.slug).toBe(SLUG);
    expect(state.alive).toBe(true);
    // The record's own two target facts: the workspace exists, and the record names no plan.
    expect(state.targetGone).toEqual([]);
    await inflight.release();
  });

  it("names the missing target fact instead of a boolean", async () => {
    const { inflight, record, root } = fixture();
    await inflight.acquire({ ...record, plan: "docs/kairos/plans/absent.md", dispatchBase: "abc" });
    const state = await inflight.inspect();
    if (state.kind !== "held") throw new Error("the record did not stand");
    // The plan cell is repo-relative, so it resolves through the ONE basis…
    expect(state.targetGone).toEqual(["plan"]);
    // …and the workspace cell is its own existence read.
    rmSync(path.join(root.path, SLUG), { recursive: true, force: true });
    const after = await inflight.inspect();
    if (after.kind !== "held") throw new Error("the record did not stand");
    expect(after.targetGone).toEqual(["plan", "workspace"]);
    await inflight.release();
  });

  it("answers corrupt for a present record it cannot read, and reports the leftover lock", async () => {
    const { inflight, lock } = fixture();
    writeFileSync(inflight.path(), "{ not a record\n", "utf8");
    expect(await inflight.inspect()).toEqual({ kind: "corrupt", locked: false });
    // A carrier on disk is the one corroborating fact a corrupt record can carry.
    await lock.acquire();
    expect(await inflight.inspect()).toEqual({ kind: "corrupt", locked: true });
    await lock.release();
  });

  it("displaces a corrupt record with no lock behind it — refusing there would wedge the tree", async () => {
    const { inflight, record } = fixture();
    writeFileSync(inflight.path(), "{}", "utf8");
    expect((await inflight.inspect()).kind).toBe("corrupt");
    expect((await inflight.acquire(record)).kind).toBe("acquired");
    expect((await inflight.inspect()).kind).toBe("held");
    await inflight.release();
  });

  it("takes the record's name from the artifact matrix, not a second spelling", () => {
    // One home for a tree-level name: the matrix row IS the name, and the record's own
    // constant is derived from it — a rename in the matrix moves the record with it.
    expect(InFlight.FILE).toBe(WORKSPACE_ARTIFACTS.inFlight);
    const names = Object.values(WORKSPACE_ARTIFACTS);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("the record's start instant", () => {
  it("takes the process table's answer, and the injected clock only when it answers nothing", async () => {
    const repo = tempRepo();
    const clock = new Clock(() => FIXED_NOW);
    const root = new WorkspaceRoot({
      basis: new RepoRoot(repo),
      now: clock.now,
      baseName: "base.json",
    });
    const refusal = new Refusal({ root, clock });
    const base = {
      root,
      lock: new Lock({ target: path.join(root.path, InFlight.FILE) }),
      clock,
      refusal,
      liveness: { live: async () => true },
    };
    const table = new InFlight({ ...base, starts: { startOf: async () => 12_345 } });
    const silent = new InFlight({ ...base, starts: { startOf: async () => null } });
    expect(await table.startedAtOf(process.pid)).toBe(12_345);
    expect(await silent.startedAtOf(process.pid)).toBe(FIXED_NOW);
    const built = await silent.recordOf({
      pid: process.pid,
      command: "cdd implement",
      slug: SLUG,
      wave: "1",
      phase: "implement",
      cycle: 1,
      attempt: 1,
      plan: null,
      dispatchBase: null,
    });
    expect(built.startedAt).toBe(FIXED_NOW);
  });

  it("reads no wall clock anywhere in the segment", () => {
    const offenders = dispatchTexts()
      .filter(({ text }) => /Date\.now\(/.test(text) || /new Date\(\s*\)/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });
});

describe("the handoff read-back", () => {
  it("answers absence for a draft that was never written — never a refusal", () => {
    const read = Handoff.read(null, "work");
    expect(read).toEqual({ kind: "absent" });
    expect(Handoff.violationOf(read)).toBeNull();
    // The round is closed by its completion criterion instead: no findings, so the
    // conclusion derived from an empty set is approval, not a failure.
    expect(Handoff.conclusionOf([])).toBe("APPROVED");
  });

  it("refuses a draft on disk that is not JSON, carrying the parser's own codes", () => {
    const read = Handoff.read('{"status": ', "work");
    expect(read).toEqual({ kind: "malformed", codes: ["ValueExpected", "CloseBraceExpected"] });
    const violation = Handoff.violationOf(read);
    expect(violation?.grade).toBe("hard");
    expect(violation?.cause).toBe(CONTRACT_VIOLATION);
    expect(violation?.message).toBe(
      "the handoff draft is not JSON (ValueExpected, CloseBraceExpected)",
    );
  });

  it("tolerates the child's draft dialect — a trailing comma or a comment is not a refusal", () => {
    // The draft is written by a child model from prose: a trailing comma in the `notes`
    // array (or a stray comment) is a routine slip, and the round it belongs to is whole.
    // The leniency is the reason a slip costs nothing here, while the arm above stays a
    // real break — the two arms differ by the parser's error list, never by a wrapper.
    const comma = Handoff.read('{"status":"APPROVED","artifacts":{},"notes":["a","b",]}', "work");
    expect(comma.kind).toBe("compliant");
    expect(Handoff.violationOf(comma)).toBeNull();
    if (comma.kind !== "compliant") return;
    // …and the notes the child wrote survive into the draft the carrier is built from.
    expect(comma.draft.notes).toEqual(["a", "b"]);
    const commented = Handoff.read('{\n  // the round\'s note\n  "findings": []\n}', "judge");
    expect(commented.kind).toBe("compliant");
    expect(Handoff.violationOf(commented)).toBeNull();
  });

  it("refuses a draft that parses but breaks the contract, carrying the problem list", () => {
    const read = Handoff.read('{"findings": [{"severity": "blocker"}]}', "judge");
    expect(read.kind).toBe("breached");
    if (read.kind !== "breached") return;
    expect(read.problems).toEqual([
      "findings[0].lens: expected a string",
      "findings[0].summary: expected a string",
    ]);
    const violation = Handoff.violationOf(read);
    expect(violation?.cause).toBe(CONTRACT_VIOLATION);
    expect(violation?.message).toContain("findings[0].lens: expected a string");
  });

  it("shares one cause word across the two refusal arms — three shapes, two refusals", () => {
    const malformed = Handoff.violationOf(Handoff.read("not json", "work"));
    const breached = Handoff.violationOf(Handoff.read("{}", "work"));
    expect(malformed?.cause).toBe(breached?.cause);
    expect(malformed?.cause).toBe(CONTRACT_VIOLATION);
    // …and the cause is not one of the three termination causes: those name cut-short
    // rounds, and none of them describes a draft's shape.
    expect(["over-budget", "stalled", "signal"]).not.toContain(CONTRACT_VIOLATION);
  });

  it("drops a decorative slot's mismatch and keeps the draft compliant", () => {
    // Declared but not owed: a wrong value costs a field, never a round. The work plane's
    // `notes` holding a string, and the judge plane's `artifacts` holding a list.
    const work = Handoff.read('{"status":"APPROVED","artifacts":{},"notes":"none"}', "work");
    expect(work.kind).toBe("compliant");
    if (work.kind !== "compliant") return;
    expect(work.dropped).toEqual(["notes"]);
    expect(Handoff.violationOf(work)).toBeNull();
    const judge = Handoff.read('{"findings":[],"artifacts":["notes.md"]}', "judge");
    expect(judge.kind).toBe("compliant");
    if (judge.kind !== "compliant") return;
    expect(judge.dropped).toEqual(["artifacts"]);
    // A bad ROW inside a decorative slot prunes the whole slot, reported once under the
    // slot's own path — the materialize face drops everything the slot booked.
    const rows = Handoff.read('{"findings":[],"notes":["ok",3]}', "judge");
    expect(rows.kind).toBe("compliant");
    if (rows.kind !== "compliant") return;
    expect(rows.dropped).toEqual(["notes"]);
  });

  it("refuses an owed slot's mismatch — the refusal face is as wide as what the child owes", () => {
    const read = Handoff.read('{"status":"DONE","artifacts":{},"notes":"none"}', "work");
    expect(read.kind).toBe("breached");
    if (read.kind !== "breached") return;
    expect(read.problems).toEqual(["status: must be one of APPROVED | BLOCKED"]);
    // The decorative slot is reported in the same read — as a drop, beside the refusal.
    expect(read.dropped).toEqual(["notes"]);
    expect(Handoff.violationOf(read)?.cause).toBe(CONTRACT_VIOLATION);
  });

  it("accepts a compliant draft and reads its findings", () => {
    const text = JSON.stringify({
      status: "APPROVED",
      artifacts: { report: "x.md" },
      notes: ["note"],
      findings: [{ severity: "warn", lens: "spec", summary: "narrow", regrade: "kept" }],
    });
    const read = Handoff.read(text, "work");
    expect(read.kind).toBe("compliant");
    if (read.kind !== "compliant") return;
    expect(Handoff.findingsOf(read.draft)).toEqual([
      { severity: "warn", lens: "spec", summary: "narrow", regrade: "kept" },
    ]);
  });

  it("derives the plane from the verb — the writable key set is one declaration", () => {
    expect(Handoff.planeOf("review")).toBe("judge");
    expect(Handoff.planeOf("implement")).toBe("work");
    expect(Handoff.planeOf("fix")).toBe("work");
    expect(Handoff.writable("judge")).not.toContain("status");
    expect(Handoff.writable("work")).not.toContain("findings");
    expect(Handoff.writable("work")).toContain("dispositions");
  });
});

describe("the conclusion — three ways, derived from the findings", () => {
  const finding = (severity: RoundFinding["severity"]): RoundFinding => ({
    severity,
    summary: `${severity} row`,
  });

  it("rolls a blocker up to CHANGES_REQUESTED, warnings to REVIEW_FIX, and nothing to APPROVED", () => {
    expect(Handoff.conclusionOf([finding("blocker"), finding("warn")])).toBe("CHANGES_REQUESTED");
    expect(Handoff.conclusionOf([finding("warn"), finding("nit")])).toBe("REVIEW_FIX");
    expect(Handoff.conclusionOf([])).toBe("APPROVED");
  });

  it("drops a row whose severity names no tier — the ladder cannot rank it", () => {
    expect(
      Handoff.findingsOf({ findings: [{ severity: "critical", lens: "l", summary: "s" }] }),
    ).toEqual([]);
  });
});

describe("the downgrade judgment — two reads of one comparison", () => {
  const prior: readonly RoundFinding[] = [
    {
      severity: "blocker",
      id: "F1",
      summary: "the guard is missing",
      impact: { scenario: "no guard" },
    },
  ];

  it("marks a lowered grade that states no reason, and reports nothing as a reason", () => {
    const lowered: readonly RoundFinding[] = [
      { severity: "warn", id: "F1", summary: "the guard is missing" },
    ];
    expect(Handoff.downgrades(prior, lowered)).toEqual(lowered);
    expect(Handoff.regradeReasons(prior, lowered)).toEqual([]);
  });

  it("reports the reason instead of the mark when the row carries one", () => {
    const reasoned: readonly RoundFinding[] = [
      {
        severity: "warn",
        id: "F1",
        summary: "the guard is missing",
        regrade: "reworded to a warning",
      },
    ];
    expect(Handoff.downgrades(prior, reasoned)).toEqual([]);
    expect(Handoff.regradeReasons(prior, reasoned)).toEqual(["reworded to a warning"]);
  });

  it("marks nothing when the grade held or rose", () => {
    expect(Handoff.downgrades(prior, prior)).toEqual([]);
    expect(Handoff.regradeReasons(prior, prior)).toEqual([]);
    const raised: readonly RoundFinding[] = [
      { severity: "blocker", id: "F1", summary: "the guard is missing", impact: { scenario: "x" } },
    ];
    expect(
      Handoff.downgrades(
        [{ severity: "warn", summary: "the guard is missing", impact: { scenario: "s" } }],
        raised,
      ),
    ).toEqual([]);
  });

  it("pairs on the summary or the earlier scenario, never on the engine's row number", () => {
    // A re-numbered carrier still pairs: the summary survives, the id moved.
    const renumbered: readonly RoundFinding[] = [
      { severity: "warn", id: "F9", summary: "the guard is missing" },
    ];
    expect(Handoff.downgrades(prior, renumbered)).toHaveLength(1);
    // The scenario is the second key: a reworded summary still pairs on it.
    const reworded: readonly RoundFinding[] = [
      { severity: "warn", summary: "the guard is absent", impact: { scenario: "no guard" } },
    ];
    expect(Handoff.downgrades(prior, reworded)).toHaveLength(1);
  });

  it("takes the reference off the most recent non-empty finding set — a clean round never resets it", () => {
    expect(
      Handoff.priorFindingsOf([{ findings: prior }, { findings: [] }, { findings: null }]),
    ).toEqual(prior);
    expect(Handoff.priorFindingsOf([{ findings: [] }, { findings: null }])).toEqual([]);
  });
});

describe("the liveness judge", () => {
  const racing = (value: number | null, readableAt: number | null): SignalReading => ({
    value,
    readableAt,
  });

  it("calls a growing leg progress even while every other leg stands still", () => {
    expect(
      LivenessJudge.verdict({
        readings: [racing(10, 100), racing(0, 100)],
        previous: [5, 0],
        idleMs: 0,
        windowMs: 60,
        now: 100,
      }),
    ).toBe("progress");
  });

  it("calls two flat legs a stall once the window is spent, and an idle one before", () => {
    const flat = { readings: [racing(10, 100), racing(0, 100)], previous: [10, 0], now: 100 };
    expect(LivenessJudge.verdict({ ...flat, idleMs: 0, windowMs: 60 })).toBe("idled");
    expect(LivenessJudge.verdict({ ...flat, idleMs: 60, windowMs: 60 })).toBe("stalled");
  });

  it("never conjures a stall from legs that were never readable — that is unknown", () => {
    expect(
      LivenessJudge.verdict({
        readings: [racing(null, null), racing(null, null)],
        previous: [null, null],
        idleMs: 10_000,
        windowMs: 60,
        now: 100,
      }),
    ).toBe("unknown");
  });

  it("keeps an unreadable leg's last readable tick, so it still authorizes the stall", () => {
    let at = 100;
    const reads = new ScriptedReads({ size: 10, cpu: null });
    const context = livenessContext(reads, () => at);
    const growth = new LogGrowth(context);
    const cpu = new CpuAdvance(context);

    const first = growth.sample();
    expect(first).toEqual({ value: 10, readableAt: 100 });
    // The leg goes unreadable: the value is null, the readable tick is RETAINED.
    reads.set({ size: null, cpu: null });
    at = 160;
    const second = growth.sample();
    expect(second).toEqual({ value: null, readableAt: 100 });
    expect(cpu.sample()).toEqual({ value: null, readableAt: null });
    // The retained reading is what authorizes the stall instead of `unknown`.
    expect(
      LivenessJudge.verdict({
        readings: [second, cpu.sample()],
        previous: [10, null],
        idleMs: 60,
        windowMs: 60,
        now: 160,
      }),
    ).toBe("stalled");
  });

  it("builds one leg set per round — the declared registry, by name", () => {
    expect(LIVENESS_SIGNALS.map((entry) => entry.leg)).toEqual(["log", "cpu"]);
    const reads = new ScriptedReads({ size: 7, cpu: 3 });
    const sampler = new Sampler(livenessContext(reads, () => 100));
    const tick = sampler.probe();
    expect(tick.logSize).toBe(7);
    expect(tick.cpuMs).toBe(3);
    expect(tick.readings).toHaveLength(2);
    expect(tick.previous).toEqual([null, null]);
    // The second tick compares against the first — the basis is one tick wide.
    expect(sampler.probe().previous).toEqual([7, 3]);
  });
});

describe("the watch — one stall verdict per dispatch", () => {
  it("fires the kill once and keeps the last sample at the stall", () => {
    let at = 100;
    let fires = 0;
    const reads = new ScriptedReads({ size: 0, cpu: null });
    const watch = new Watch({
      sampler: new Sampler(livenessContext(reads, () => at)),
      intervalMs: 1_000_000,
      windowMs: 60,
      spawnedAt: 100,
      clock: new Clock(() => at),
      onStall: () => {
        fires += 1;
      },
    });
    watch.tick(100);
    expect(watch.lastSample()?.verdict).toBe("idled");
    at = 160;
    watch.tick(160);
    expect(fires).toBe(1);
    expect(watch.lastSample()?.verdict).toBe("stalled");
    // A later tick (were one dispatched) observes nothing new: the stall owns the trail.
    at = 300;
    watch.tick(300);
    expect(fires).toBe(1);
    expect(watch.lastSample()?.at).toBe(160);
    watch.stop();
  });
});

describe("the value assembly — one composition, one basis", () => {
  const scene = (): DispatchSceneFacts => ({
    repoRoot: new RepoRoot("/repo"),
    docPath: "/repo/docs/kairos/plans/p9.md",
    planPath: "/repo/docs/kairos/plans/p9.md",
    specLink: "/repo/docs/kairos/specs/p9.md",
    overallLink: "/repo/docs/kairos/overalls/p9.md",
    baseBranch: "main",
    briefPath: "/repo/.kairos/cdd/p9/tasks-1,2-brief.md",
    workspaceDir: "/repo/.kairos/cdd/p9",
    workspaceId: "p9",
    reportPath: "/repo/.kairos/cdd/p9/tasks-1,2-implement-1-report.md",
    evidencePath: "/repo/.kairos/cdd/p9/tasks-1,2-implement-1-test-evidence.json",
    handoffPath: "/repo/.kairos/cdd/p9/tasks-1,2-implement-1.json",
    handoffSchema: "{}",
  });

  it("collapses every path cell onto the repository basis exactly once", () => {
    const values = DispatchValues.compose(
      { op: "implement", type: "wave", phase: "implement", tasks: "1,2", cycle: 1, attempt: 1 },
      scene(),
      { kind: "read", reviewsPath: null, read: { kind: "absent" } },
    );
    expect(values.OUTPUT_REPORT).toBe(".kairos/cdd/p9/tasks-1,2-implement-1-report.md");
    expect(values.INPUT_WAVE_BRIEF).toBe(".kairos/cdd/p9/tasks-1,2-brief.md");
    expect(values.WORKSPACE_DIR).toBe(".kairos/cdd/p9");
    expect(values.ROLE).toBe("implement");
    // The implement mode is the one role with no target row.
    expect(values.TARGET_TYPE).toBe("");
  });

  it("passes the artifact read's own coordinate through — the snapshot is never re-spelled", () => {
    const values = DispatchValues.compose(
      { op: "fix", type: "phase-spec", phase: "fix", tasks: "", cycle: 2, attempt: 1 },
      scene(),
      {
        kind: "read",
        reviewsPath: "/repo/.kairos/cdd/p9/phase-spec-review-1.c1.json",
        read: {
          kind: "ok",
          path: ".kairos/cdd/p9/phase-spec-review-1.c1.rulings.json" as RepoPath,
          rulings: [],
        },
      },
    );
    expect(values.INPUT_REVIEWS).toBe(".kairos/cdd/p9/phase-spec-review-1.c1.json");
    expect(values.INPUT_RULINGS).toBe(".kairos/cdd/p9/phase-spec-review-1.c1.rulings.json");
    expect(values.ROLE).toBe("docs-fix");
  });

  it("answers the same bytes for the same facts twice", () => {
    const identity = {
      op: "review" as const,
      type: "branch" as const,
      phase: "branch-review",
      tasks: "",
      cycle: 3,
      attempt: 2,
    };
    const snapshot = {
      kind: "mismatch" as const,
      reviewsPath: null,
      carrier: { line: "c", recorded: "a", current: "b" },
    };
    expect(DispatchValues.compose(identity, scene(), snapshot)).toEqual(
      DispatchValues.compose(identity, scene(), snapshot),
    );
    // A mismatch arm reads no rulings at all — the tampered bytes are not a fact to read.
    const values = DispatchValues.compose(identity, scene(), snapshot);
    expect(values.INPUT_RULINGS).toBe("");
    expect(values.BASE_BRANCH).toBe("main");
  });
});

describe("the budget and the three termination causes", () => {
  it("declares four budget keys, with a ceiling for every phase", () => {
    expect(Object.keys(BUDGET).sort()).toEqual([
      "childBashTimeoutMs",
      "idleWindowMs",
      "perPhase",
      "sampleIntervalMs",
    ]);
    expect(Object.keys(BUDGET.perPhase).sort()).toEqual([...ROUND_PHASES].sort());
    for (const phase of ROUND_PHASES) expect(BUDGET.perPhase[phase]).toBeGreaterThan(0);
  });

  it("names the cause the seam's facts carry, in the order the causes claim a kill", () => {
    expect(Child.causeOf({ overBudget: true, stopped: true, signal: "SIGTERM" })).toBe(
      "over-budget",
    );
    expect(Child.causeOf({ overBudget: false, stopped: true, signal: "SIGTERM" })).toBe("stalled");
    expect(Child.causeOf({ overBudget: false, stopped: false, signal: "SIGKILL" })).toBe("signal");
    expect(Child.causeOf({ overBudget: false, stopped: false, signal: null })).toBeNull();
  });

  it("answers the outcome's three cells from one dispatch", async () => {
    const runner = new StubRunner(async (run) => {
      // The seam hands the handle over the instant the child exists; a child that ends by
      // itself delivers no kill.
      run.observe?.({ pgid: 4242, kill: () => false });
      return childOutcome({
        code: 0,
        facts: { overBudget: false, stopped: true, signal: "SIGTERM" },
      });
    });
    const { child, frame } = fixture({ runner });
    const outcome = await child.dispatch(frame);
    expect(runner.calls).toBe(1);
    expect(outcome.code).toBe(0);
    expect(outcome.log).toBe(frame.log.path);
    expect(outcome.termination).toBe("stalled");
  });
});

describe("the refusal books no round", () => {
  it("moves neither the cycle nor the attempt a refused dispatch would have consumed", async () => {
    const { root, clock, refusal } = fixture();
    const workspace = root.at(SLUG);
    const ledger = new Ledger({ workspace, names: () => [] });
    const gate = new PreFlight({
      repoRoot: root.basis.absolute,
      tree: { isClean: async () => true },
      docs: new NoDocuments(),
      refusal,
    });
    // A live holder stands, so the `in-flight` row owns the verdict.
    const verdict = await gate.vet({
      type: "wave",
      slug: SLUG,
      op: "implement",
      cycle: 1,
      attempt: 1,
      inflight: { kind: "held", pid: process.pid, alive: true, targetGone: [] },
      graph: null,
      planLedger: null,
      doc: null,
      rows: null,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.gate).toBe("in-flight");
    gate.settle(verdict);
    // The record names the coordinate the refused dispatch WOULD have consumed…
    const standing = refusal.readRaw();
    if (standing.kind !== "standing") throw new Error("the refusal did not land");
    expect([standing.facts.cycle, standing.facts.attempt]).toEqual([1, 1]);
    // …and the ledger holds nothing under it: the same coordinate is still free.
    expect(ledger.read()).toBeNull();
    expect(ledger.rounds(LINE)).toEqual([]);
    expect(clock.now()).toBe(FIXED_NOW);
  });
});

describe("the release point's refusal expiry", () => {
  const standingRefusal = (refusal: Refusal, station: "in-flight" | "graph"): void => {
    refusal.write({
      slug: SLUG,
      op: "implement",
      type: "wave",
      cycle: 1,
      attempt: 1,
      station,
      detail: "the tree refused",
    });
  };

  it("clears the standing fact whose station is `in-flight`", async () => {
    const { refusal, inflight } = fixture();
    standingRefusal(refusal, "in-flight");
    expect(refusal.readRaw().kind).toBe("standing");
    await inflight.release();
    expect(refusal.readRaw()).toEqual({ kind: "absent" });
  });

  it("takes no other row's fact with it — the station is the criterion", async () => {
    const { refusal, inflight } = fixture();
    standingRefusal(refusal, "graph");
    await inflight.release();
    const state = refusal.readRaw();
    expect(state.kind).toBe("standing");
    if (state.kind !== "standing") return;
    expect(state.facts.station).toBe("graph");
  });

  it("leaves a corrupt refusal record on disk — deleting an unreadable fact is a judgment nobody may make", async () => {
    const { refusal, inflight, root } = fixture();
    writeFileSync(path.join(root.path, Refusal.FILE), "{ broken", "utf8");
    expect(refusal.readRaw().kind).toBe("corrupt");
    await inflight.release();
    expect(refusal.readRaw().kind).toBe("corrupt");
  });

  it("clears nothing before the release, and nothing on a read", async () => {
    const { refusal, inflight } = fixture();
    standingRefusal(refusal, "in-flight");
    // The two READ paths: the refusal's own raw read, and the occupancy's judgment.
    expect(refusal.readRaw().kind).toBe("standing");
    await inflight.inspect();
    expect(refusal.readRaw().kind).toBe("standing");
    // The release is the one path, and it is idempotent (a second call neither throws nor
    // resurrects the fact).
    await inflight.release();
    await expect(inflight.release()).resolves.toBeUndefined();
    expect(refusal.readRaw()).toEqual({ kind: "absent" });
  });
});

describe("the segment boundary", () => {
  it("reaches no later run segment", () => {
    expect(dispatchModules().length).toBeGreaterThan(3);
    for (const { name, text } of dispatchTexts()) {
      expect(foreignEdges(DISPATCH_DIR, text), name).toEqual([]);
    }
  });

  it("sees a reach when there is one — the ban cannot pass on a spelling mismatch", () => {
    const reach = 'import type { Frame } from "../advance/frame.ts";';
    expect(foreignEdges(DISPATCH_DIR, reach)).toEqual(["../advance/frame.ts"]);
    const allowed = [
      'import { Ledger } from "../ledger/ledger.ts";',
      'import { Lock } from "../../env/process/lock.ts";',
    ].join("\n");
    expect(foreignEdges(DISPATCH_DIR, allowed)).toEqual([]);
    expect(foreignEdges(DISPATCH_DIR, '// never import "../advance/frame.ts" here')).toEqual([]);
  });

  it("takes the lock through the environment's one holder — no second mutual-exclusion", () => {
    const lockConsumers = dispatchTexts().filter(({ text }) =>
      specifiersIn(text).some((specifier) => /(^|\/)lock\.ts$/.test(specifier)),
    );
    expect(lockConsumers.map(({ name }) => name)).toEqual(["inflight.ts"]);
    // The library itself is the environment segment's: this segment never names it.
    for (const { text } of dispatchTexts()) {
      expect(specifiersIn(text)).not.toContain("proper-lockfile");
      expect(text).not.toContain("proper-lockfile");
    }
    expect(TARGET_FACTS).toContain("plan");
  });
});
