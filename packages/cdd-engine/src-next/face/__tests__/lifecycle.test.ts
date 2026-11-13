// packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts
// P30 T2 — the implement criterion's two verification provider cells, filled by the
// lifecycle (design spec §2.4): `emptyFileTasks` from the PLAN's `Files` declarations
// and `evidenceOk` from the evidence judgment the same round already runs.
//
// The pins are the FILL, not the branch (the branch's own matrix lives in
// `contract/__tests__/completion-criterion.test.ts`):
//   · the cells are filled from the plan document and the evidence gate — a round
//     whose every task declares an empty `Files` and whose evidence is green reads as
//     a verification wave and concludes;
//   · the SAME fixture with the evidence gate red (no evidence file) stays BLOCKED —
//     the cell is wired to the real gate, never hardcoded;
//   · a wave with any non-empty `Files` row keeps the `committed nothing` refusal —
//     the OR branch never widens into "some task declares no files".
//
// Fixtures are hermetic mkdtemp repos (git-inited: the dispatch baseline is the seed
// commit, so a round that commits nothing has a real baseline to be judged against).

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  type CompletionContext,
  CompletionCriteria,
  IMPLEMENT_CARRIER_ABSENT,
  IMPLEMENT_VERIFICATION_WAVE,
} from "../../contract/completion-criterion.ts";
import { CarrierSeal } from "../../infra/carrier-seal.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { ProcessFacts } from "../../infra/proc.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { CarrierRulings } from "../../session/carrier-rulings.ts";
import { targetFaces } from "../../session/faces.ts";
import { HoldingError, InFlight } from "../../session/inflight.ts";
import { Ledger } from "../../session/ledger.ts";
import type { DispatchOutcome, OpenFrame } from "../../session/run.ts";
import { EMPTY_RUN_STATE, Lifecycle } from "../../session/run.ts";
import { Capsule } from "../capsule.ts";
import { type CliIo, CliLifecycle, type DispatchScene } from "../lifecycle.ts";
import type { ChildOutcome, ChildRun, ChildRunner } from "../termination.ts";
import { Words } from "../words.ts";

class CaptureIo implements CliIo {
  stdoutText = "";
  stderrText = "";
  stdout(text: string): void {
    this.stdoutText += text;
  }
  stderr(text: string): void {
    this.stderrText += text;
  }
}

/** The child stand-in — exits 0 without writing anything. The implement round's
 *  conclusion comes from the criterion, so a silent child is the honest fixture: no
 *  commit, no handoff draft, and no evidence unless the case writes one. */
class SilentRunner implements ChildRunner {
  calls: ChildRun[] = [];
  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

/** A schema-shaped evidence file — the gate's green side. */
const EVIDENCE = {
  command: "pnpm run validate",
  exit_code: 0,
  passed: true,
  warnings_count: 0,
  typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
};

/** One plan task block — `files` empty = the `Files` section declares no path. */
const taskBlock = (id: number, files: readonly string[]): string =>
  [
    `### Task ${id}: task ${id}`,
    "",
    "#### Objective",
    `objective ${id}`,
    "",
    "#### Files",
    ...files,
    "",
    "#### DependsOn",
    id === 1 ? "none" : "1",
    "",
  ].join("\n");

/** A plan document over the given task declarations. */
const planDoc = (tasks: readonly (readonly [number, readonly string[]])[]): string =>
  [
    "---",
    "doc-type: plan",
    "version: v0.1",
    "---",
    "",
    ...tasks.map(([id, files]) => taskBlock(id, files)),
  ].join("\n");

/** The change-carrying `Files` row — a wave that names a changed file is never a
 *  verification wave. */
const CHANGE_ROW = "- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`";

interface Fixture {
  readonly scene: DispatchScene;
  readonly io: CaptureIo;
  readonly cleanup: () => void;
}

/** A hermetic repo + workspace: the plan document, one seed commit (the dispatch
 *  baseline) and the ledger. `.kairos` stays out of the tree, so the round's own
 *  writes never dirty it. */
const fixture = (plan: string): Fixture => {
  const repoRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "lifecycle-")));
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "lifecycle@test"],
    ["config", "user.name", "lifecycle-test"],
  ]) {
    spawnSync("git", args, { cwd: repoRoot });
  }
  writeFileSync(path.join(repoRoot, ".gitignore"), ".kairos\n", "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  const planPath = path.join(repoRoot, "docs", "kairos", "plans", "p30.md");
  mkdirSync(path.dirname(planPath), { recursive: true });
  writeFileSync(planPath, plan, "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
  const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p30").ensure();
  const ledger = new Ledger(workspace, new ConfigLoader());
  return {
    scene: { workspace, ledger, planPath, briefPath: null },
    io: new CaptureIo(),
    cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
  };
};

/** The wave implement frame of a wave key (`"1"` · `"1,2"`). */
const waveFrame = (key: string): OpenFrame => ({
  type: "wave",
  phase: "implement",
  round: 1,
  target: { kind: "wave", tasks: key.split(",").map(Number) },
  params: { tasks: key, round: 1, attempt: 1 },
  key,
});

/** Write the round's canonical evidence file at the round's own name (the identity
 *  carries line · cycle · attempt — the implement family included). */
const writeEvidence = (f: Fixture, key: string): void => {
  writeFileSync(
    path.join(f.scene.workspace.path, `tasks-${key}-implement-1-test-evidence.json`),
    JSON.stringify(EVIDENCE),
    "utf8",
  );
};

/** Run one dispatch frame through a child stand-in, handing back its outcome plus every
 *  context the criterion judged (the spy delegates to the REAL criterion, so the
 *  outcome stays the production one). */
const dispatchFrame = async (
  f: Fixture,
  frame: OpenFrame,
  runner: ChildRunner = new SilentRunner(),
): Promise<{ seen: readonly CompletionContext[]; outcome: DispatchOutcome }> => {
  const seen: CompletionContext[] = [];
  const original = CompletionCriteria.of.bind(CompletionCriteria);
  const spy = vi.spyOn(CompletionCriteria, "of").mockImplementation((op) => {
    const criterion = original(op);
    return {
      judge: async (ctx: CompletionContext) => {
        seen.push(ctx);
        return criterion.judge(ctx);
      },
    };
  });
  try {
    const lifecycle = new CliLifecycle({
      scene: f.scene,
      io: f.io,
      sync: runner,
      env: { CLAUDE_CODE_SESSION_ID: "s" },
    });
    return { seen, outcome: await lifecycle.step()(frame) };
  } finally {
    spy.mockRestore();
  }
};

/** Run one wave implement dispatch (the fixture's standing form). */
const dispatch = (
  f: Fixture,
  key: string,
): Promise<{ seen: readonly CompletionContext[]; outcome: DispatchOutcome }> =>
  dispatchFrame(f, waveFrame(key));

const messagesOf = (outcome: DispatchOutcome): readonly string[] =>
  (outcome.violations ?? []).map((violation) => violation.message);

const gradesOf = (outcome: DispatchOutcome): readonly string[] =>
  (outcome.violations ?? []).map((violation) => violation.grade);

describe("CliLifecycle — the verification provider cells (P30 §2.4)", () => {
  it("fills `emptyFileTasks` from the plan's `Files` rows and `evidenceOk` from the evidence gate", async () => {
    const f = fixture(
      planDoc([
        [1, []],
        [2, [CHANGE_ROW]],
      ]),
    );
    try {
      writeEvidence(f, "1,2");
      const { seen } = await dispatch(f, "1,2");
      expect(seen).toHaveLength(1);
      // Membership only: the plan's change-free task id, never the wave's whole set.
      expect([...(seen[0]?.emptyFileTasks ?? [])]).toEqual([1]);
      // The wave key the criterion reads its member face from — never the cell's own.
      expect(seen[0]?.row.wave).toBe("1,2");
      expect(seen[0]?.evidenceOk).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  it("a verification wave's zero-commit round concludes on its green evidence, booked soft", async () => {
    const f = fixture(
      planDoc([
        [1, []],
        [2, []],
      ]),
    );
    try {
      writeEvidence(f, "1,2");
      const { outcome } = await dispatch(f, "1,2");
      expect(outcome.status).toBe("APPROVED");
      // Two bookkeeping rows, zero gates: the verification-wave fact and the absent
      // handoff draft (the silent child wrote none) — neither is a failure.
      expect(gradesOf(outcome)).toEqual(["soft", "soft"]);
      expect(messagesOf(outcome)).toEqual([IMPLEMENT_VERIFICATION_WAVE, IMPLEMENT_CARRIER_ABSENT]);
      expect(f.io.stderrText).not.toContain("CDD_BLOCKED");
    } finally {
      f.cleanup();
    }
  });

  it("the same verification fixture with the evidence gate RED stays BLOCKED — the cell is the real gate", async () => {
    const f = fixture(
      planDoc([
        [1, []],
        [2, []],
      ]),
    );
    try {
      // no evidence file at all
      const { seen, outcome } = await dispatch(f, "1,2");
      expect(seen[0]?.evidenceOk).toBe(false);
      expect(outcome.status).toBe("BLOCKED");
      expect(gradesOf(outcome)).toEqual(["hard", "hard"]);
      expect(messagesOf(outcome)[0]).toContain("test evidence is not green");
      expect(messagesOf(outcome)[1]).toContain("the test evidence at");
    } finally {
      f.cleanup();
    }
  });

  it("a wave with one non-empty `Files` row keeps the `committed nothing` refusal", async () => {
    const f = fixture(
      planDoc([
        [1, []],
        [2, [CHANGE_ROW]],
      ]),
    );
    try {
      writeEvidence(f, "1,2");
      const { outcome } = await dispatch(f, "1,2");
      expect(outcome.status).toBe("BLOCKED");
      expect(messagesOf(outcome)[0]).toContain("committed nothing since its baseline");
      expect(f.io.stderrText).toContain("CDD_BLOCKED");
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P30 T4 — the abort fold (`--recover`'s abort leg)
// ---------------------------------------------------------------------------

/** A dead pid — far outside every platform's pid range (the table never carries it). */
const DEAD_PID = 4_000_001;

/** The tree-level record path of a fixture. */
const recordPathOf = (f: Fixture): string =>
  path.join(f.scene.workspace.root.path, "in-flight.json");

/** The tree-level lock path of a fixture (the `proper-lockfile` carrier). */
const lockPathOf = (f: Fixture): string => `${recordPathOf(f)}.lock`;

/** One standing record's bytes — the killed round's identity facts. */
const staleRecord = (over: Record<string, unknown> = {}): string =>
  `${JSON.stringify(
    {
      pid: DEAD_PID,
      command: "cdd implement --tasks 1 --plan docs/kairos/plans/p30.md",
      slug: "p30",
      startedAt: Date.parse("2026-11-08T05:00:00.000Z"),
      wave: "1",
      phase: "implement",
      cycle: 2,
      attempt: 1,
      briefHash: null,
      plan: "docs/kairos/plans/p30.md",
      dispatchBase: "base-B",
      sampledAt: null,
      verdict: null,
      ...over,
    },
    null,
    2,
  )}\n`;

/** Plant a stale record (the engine-outside kill's postmortem fact). */
const plantStale = (f: Fixture, body: string): void => {
  f.scene.workspace.root.ensure();
  writeFileSync(recordPathOf(f), body, "utf8");
};

/** One lifecycle over a fixture — the production liveness reader (a dead pid reads dead). */
const lifecycleOf = (f: Fixture): CliLifecycle =>
  new CliLifecycle({
    scene: f.scene,
    io: f.io,
    sync: new SilentRunner(),
    env: { CLAUDE_CODE_SESSION_ID: "s" },
  });

describe("CliLifecycle.foldAbort — the `--recover` abort leg (P30 §2.1①/§2.2)", () => {
  it("folds a dead holder's record into ONE abort round record", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      plantStale(f, staleRecord());
      expect(await lifecycleOf(f).foldAbort()).toBe(true);
      const records = f.scene.ledger.recordsOf("1", "wave");
      expect(records).toHaveLength(1);
      const [abort] = records;
      // The record's OWN identity: op derived from its phase, cycle / attempt / base
      // verbatim — never allocated, never invented.
      expect(abort?.op).toBe("implement");
      expect(abort?.cycle).toBe(2);
      expect(abort?.attempt).toBe(1);
      expect(abort?.dispatchBase).toBe("base-B");
      // The verdict is pinned EXACTLY: `treeClean: true` is explicit, so the ledger's
      // dirty-tree fold (`#softOf`) books no observation the fold never made.
      expect(abort?.verdict).toEqual({ treeClean: true, targetAction: false });
      expect(abort?.violations).toEqual([
        { grade: "hard", cause: "interrupted", message: abort?.violations[0]?.message },
      ]);
      expect(abort?.carrierPath).toBeUndefined();
      // One hard entry, zero soft: the row's soft count carries no increment.
      expect(f.scene.ledger.softViolations()).toBe(0);
      // The takeover cleared the record and its lock; no crash file was written.
      expect(existsSync(recordPathOf(f))).toBe(false);
      expect(existsSync(lockPathOf(f))).toBe(false);
      expect(existsSync(path.join(f.scene.workspace.path, "crash-tasks-1-implement-2.json"))).toBe(
        false,
      );
    } finally {
      f.cleanup();
    }
  });

  it("takes over a corrupt record with a leftover lock WITHOUT inventing a round", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      plantStale(f, '{"pid": 12, "starl');
      mkdirSync(lockPathOf(f), { recursive: true });
      expect(await lifecycleOf(f).foldAbort()).toBe(false);
      // No record was readable, so no op / cycle identity exists to book: the takeover
      // is the whole effect (a fabricated identity would be worse than no record).
      expect(f.scene.ledger.recordsOf("1", "wave")).toEqual([]);
      expect(f.scene.ledger.readProgress()).toBeNull();
      expect(existsSync(recordPathOf(f))).toBe(false);
      expect(existsSync(lockPathOf(f))).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  it("takes over a bare lock with no record behind it and books nothing", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      f.scene.workspace.root.ensure();
      mkdirSync(lockPathOf(f), { recursive: true });
      expect(await lifecycleOf(f).foldAbort()).toBe(false);
      expect(f.scene.ledger.recordsOf("1", "wave")).toEqual([]);
      expect(existsSync(lockPathOf(f))).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  it("books a record written before `dispatchBase` existed with a null baseline", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const { dispatchBase: _absent, ...legacy } = JSON.parse(staleRecord()) as Record<
        string,
        unknown
      >;
      plantStale(f, `${JSON.stringify(legacy, null, 2)}\n`);
      expect(await lifecycleOf(f).foldAbort()).toBe(true);
      const [abort] = f.scene.ledger.recordsOf("1", "wave");
      // Present facts only: the abort lands, the baseline is the honest null.
      expect(abort?.dispatchBase).toBeNull();
      expect(abort?.verdict).toEqual({ treeClean: true, targetAction: false });
    } finally {
      f.cleanup();
    }
  });

  it.each([
    ["the wave key", { wave: null }],
    ["the cycle", { cycle: null }],
    ["the attempt", { attempt: null }],
    ["the phase", { phase: null }],
  ])("takes over an incomplete identity WITHOUT booking — %s missing", async (_cell, over) => {
    // A doc / branch-line record carries no wave key, and a pre-P21 record carries no
    // cycle: the takeover still happens, and no row is invented for it (an allocated
    // cycle or a defaulted attempt could even overwrite a real round's record).
    const f = fixture(planDoc([[1, []]]));
    try {
      plantStale(f, staleRecord(over));
      expect(await lifecycleOf(f).foldAbort()).toBe(false);
      expect(f.scene.ledger.readProgress()).toBeNull();
      expect(existsSync(recordPathOf(f))).toBe(false);
      expect(existsSync(lockPathOf(f))).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  it("never crosses a LIVE holder — the fold takes over nothing and books nothing", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      plantStale(
        f,
        staleRecord({
          pid: process.pid,
          startedAt: (await ProcessFacts.startOf(process.pid)) ?? Date.now(),
        }),
      );
      expect(await lifecycleOf(f).foldAbort()).toBe(false);
      expect(f.scene.ledger.recordsOf("1", "wave")).toEqual([]);
      expect(existsSync(recordPathOf(f))).toBe(true);
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P30 T5 — the engine-written finding id (`F1`, `F2` … in carrier order)
// ---------------------------------------------------------------------------

/** A review child that writes its findings draft at the wave's canonical handoff path. */
class ReviewDraftRunner implements ChildRunner {
  calls: ChildRun[] = [];

  readonly #findings: readonly Record<string, unknown>[];
  readonly #draft: string;
  readonly #extra: Record<string, unknown>;

  constructor(
    findings: readonly Record<string, unknown>[],
    draft = "tasks-1-review-1.json",
    extra: Record<string, unknown> = {},
  ) {
    this.#findings = findings;
    this.#draft = draft;
    this.#extra = extra;
  }

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    mkdirSync(path.join(run.cwd, ".kairos", "cdd", "p30"), { recursive: true });
    writeFileSync(
      path.join(run.cwd, ".kairos", "cdd", "p30", this.#draft),
      JSON.stringify({ findings: this.#findings, ...this.#extra }),
      "utf8",
    );
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

/** A fix child that writes its OWN round draft — the fix carrier the criterion
 *  refuses when absent, so a case can isolate the requesting side's read. */
class FixDraftRunner implements ChildRunner {
  calls: ChildRun[] = [];

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    mkdirSync(path.join(run.cwd, ".kairos", "cdd", "p30"), { recursive: true });
    writeFileSync(
      path.join(run.cwd, ".kairos", "cdd", "p30", "phase-spec-fix-1.json"),
      JSON.stringify({ status: "APPROVED", artifacts: {}, dispositions: {} }),
      "utf8",
    );
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

/** The review wave frame of wave key `1`, round 1. */
const reviewFrame: OpenFrame = {
  type: "wave",
  phase: "review",
  round: 1,
  target: { kind: "wave", tasks: [1] },
  params: { tasks: "1", round: 1 },
  key: "1",
};

describe("CliLifecycle materialize — the finding `id` is the engine's (P30 §2.5)", () => {
  it("stamps one stable id per finding in carrier order and OVERWRITES a child-written value", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const runner = new ReviewDraftRunner([
        { id: "X9", severity: "blocker", lens: "spec", summary: "drift" },
        { severity: "warn", lens: "scope", summary: "typo" },
      ]);
      const { outcome } = await dispatchFrame(f, reviewFrame, runner);
      expect(outcome.status).toBe("CHANGES_REQUESTED");
      // The lifecycle's materialized carrier IS the persisted one (the session plane's
      // bookkeep full-replaces the child's draft with it at the same path).
      const carrier = outcome.carrier as { findings: { id?: string; summary?: string }[] };
      // Carrier order IS id order; the child's `X9` never survives materialize.
      expect(carrier.findings.map((row) => row.id)).toEqual(["F1", "F2"]);
      expect(carrier.findings.map((row) => row.summary)).toEqual(["drift", "typo"]);
    } finally {
      f.cleanup();
    }
  });

  it("strips a finding's decorative column outside its declared shape — the row survives, one soft entry names it", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const runner = new ReviewDraftRunner([
        { severity: "blocker", lens: "spec", summary: "drift", line: "42", section: 3 },
      ]);
      const { outcome } = await dispatchFrame(f, reviewFrame, runner);
      // The REQUIRED columns keep the row; the two decorative columns break their own
      // declaration, so the materialize's finding copy point drops them by path — the
      // draft's mistake never costs the round (spec §2.14).
      const carrier = outcome.carrier as { findings: Record<string, unknown>[] };
      expect(carrier.findings[0]).toEqual({
        id: "F1",
        severity: "blocker",
        lens: "spec",
        summary: "drift",
      });
      expect(outcome.status).toBe("CHANGES_REQUESTED");
      expect((outcome.violations ?? []).map((violation) => violation.grade)).toEqual(["soft"]);
      expect(outcome.violations?.[0]?.message).toContain("findings[0].line");
      expect(outcome.violations?.[0]?.message).toContain("findings[0].section");
    } finally {
      f.cleanup();
    }
  });

  it("drops a judge-plane `artifacts` / `notes` outside its declared shape — two losses, ONE soft entry, a conforming carrier", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      // The judge plane's shared slots are DECLARED, not required: a bad value costs the
      // field alone (§2.14), exactly as the work plane's `dispositions` does.
      const runner = new ReviewDraftRunner(
        [{ severity: "warn", lens: "spec", summary: "drift" }],
        "tasks-1-review-1.json",
        { artifacts: "nope", notes: 7 },
      );
      const { outcome } = await dispatchFrame(f, reviewFrame, runner);
      const carrier = outcome.carrier as { artifacts?: unknown; notes?: unknown };
      // the copy points read the drop: neither bad value reaches the carrier, and the
      // built carrier still conforms to the judge plane's own declaration
      expect(carrier.artifacts).toEqual({});
      expect(carrier.notes).toEqual([
        "dropped decorative draft field(s) outside their declared shape: artifacts, notes — never written",
      ]);
      // the round survives — one soft entry, no hard one, the findings roll the status up
      expect(outcome.status).toBe("REVIEW_FIX");
      expect((outcome.violations ?? []).map((violation) => violation.grade)).toEqual(["soft"]);
      expect(f.io.stderrText).not.toContain("CDD_BLOCKED");
    } finally {
      f.cleanup();
    }
  });

  it("a child draft that writes NO id still passes the read-back — the id is never the child's duty", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const runner = new ReviewDraftRunner([{ severity: "warn", lens: "spec", summary: "drift" }]);
      const { outcome } = await dispatchFrame(f, reviewFrame, runner);
      // No read-back BLOCK: an id-less draft is the normal shape the prompt invites.
      expect(f.io.stderrText).not.toContain("CDD_BLOCKED");
      expect(outcome.status).toBe("REVIEW_FIX");
      const carrier = outcome.carrier as { findings: { id?: string }[] };
      expect(carrier.findings[0]?.id).toBe("F1");
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P31 T2 — the ruling sidecar gate (design spec §2.6): a refused sidecar stops the
// round BEFORE the in-flight record and the child, a conforming one rides the fix
// round context, and an absent one leaves the line out.
// ---------------------------------------------------------------------------

/** The requesting review carrier's file name — the `carrier` key's expected value. */
const CARRIER_NAME = "phase-spec-review-1.json";

/** The requesting carrier body — two engine-written finding ids (`F1`, `F4`). */
const CARRIER_BODY = {
  status: "CHANGES_REQUESTED",
  findings: [
    { id: "F1", severity: "blocker", lens: "scope", summary: "the guard is missing" },
    { id: "F4", severity: "nit", lens: "style", summary: "wording" },
  ],
};

/** A legal sidecar body over which the refused shapes are written. */
const LEGAL_SIDECAR = {
  carrier: CARRIER_NAME,
  rulings: [{ finding: "F4", ruling: "REJECTED as stated", by: "orchestrator" }],
};

/** The nine refused shapes — each its own case (one broken fact per row). */
const BAD_SIDECARS: readonly (readonly [string, unknown])[] = [
  ["not JSON", "not json at all"],
  ["no `rulings` key", { carrier: CARRIER_NAME }],
  ["`rulings` not an array", { rulings: { F1: "no" } }],
  ["a ruling without `finding`", { rulings: [{ ruling: "accepted" }] }],
  ["a ruling without `ruling`", { rulings: [{ finding: "F1" }] }],
  ["an unknown top-level key", { ...LEGAL_SIDECAR, extra: true }],
  ["an unknown key inside a ruling", { rulings: [{ finding: "F1", ruling: "ok", extra: 1 }] }],
  ["a ruling on a finding the carrier lacks", { rulings: [{ finding: "F9", ruling: "ok" }] }],
  ["a `carrier` key naming another file", { ...LEGAL_SIDECAR, carrier: "other.c2.json" }],
];

/** The fix frame on the fixture's spec line (the `--reviews` seam injects the carrier). */
const fixFrameOf = (specPath: string): OpenFrame => ({
  type: "phase-spec",
  phase: "fix",
  round: 1,
  target: { kind: "spec", doc: specPath },
  params: { round: 1 },
  key: "phase-spec",
});

/** Run one fix dispatch with the injected reviews carrier. */
const runFix = async (
  f: Fixture,
  frame: OpenFrame,
  reviews: string,
  runner: SilentRunner,
): Promise<DispatchOutcome> => {
  const lifecycle = new CliLifecycle({
    scene: f.scene,
    io: f.io,
    sync: runner,
    env: { CLAUDE_CODE_SESSION_ID: "s" },
    reviews,
  });
  return lifecycle.step()(frame);
};

/** The prompt the child stand-in received (the joined argv). */
const promptOf = (runner: SilentRunner): string => (runner.calls[0]?.args ?? []).join(" ");

// ---------------------------------------------------------------------------
// P31 T3 — the carrier-integrity gate (design spec §2.2): a fix round whose
// requesting review carrier no longer digests to the value its round recorded stops
// BEFORE the in-flight record and the child — the tamper never reaches a child.
// ---------------------------------------------------------------------------

/** The requesting review round's carrier name (the fix input's own file). */
const REQUEST_CARRIER = "phase-spec-review-1.json";

describe("P31 T3 — the carrier-integrity gate guards the fix dispatch", () => {
  /** Plant a completed review round whose carrier + digest the ledger recorded. */
  const seedReview = (f: Fixture): { path: string; digest: string } => {
    const persisted = f.scene.ledger.persistHandoff(
      "review",
      "phase-spec",
      { round: 1 },
      {
        status: "CHANGES_REQUESTED",
        findings: [
          { id: "F1", severity: "blocker", lens: "scope", summary: "the guard is missing" },
        ],
      },
    );
    f.scene.ledger.recordRound("phase-spec", {
      op: "review",
      cycle: 1,
      carrierDigest: persisted.digest,
    });
    return persisted;
  };

  it("refuses a tampered input carrier before the child exists — no spawn, no acquire", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const sealed = seedReview(f);
      // The tamper is an EXTERNAL writer: the carrier lands 0o444 (P31 §2.4), so the
      // bytes move only after the permission bit is reopened — the smuggled blocker.
      CarrierSeal.unseal(sealed.path);
      writeFileSync(
        sealed.path,
        `${JSON.stringify(
          {
            status: "CHANGES_REQUESTED",
            findings: [
              { id: "F1", severity: "blocker", summary: "the guard is missing" },
              { id: "F9", severity: "blocker", summary: "smuggled" },
            ],
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      const runner = new SilentRunner();
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      const outcome = await runFix(f, fixFrameOf(specPath), sealed.path, runner);
      expect(outcome.status).toBe("BLOCKED");
      expect(gradesOf(outcome)).toEqual(["hard"]);
      // The gate is BEFORE the spawn and BEFORE the in-flight record's acquisition.
      expect(runner.calls).toHaveLength(0);
      expect(f.io.stderrText).toContain("CDD_BLOCKED");
      expect(f.io.stderrText).toContain("carrier-mismatch");
      expect(f.io.stderrText).toContain("recorded=");
      expect(f.io.stderrText).toContain("current=");
      const inFlight = await new InFlight(f.scene.workspace.root, f.scene.workspace.slug).inspect();
      expect(inFlight.kind).toBe("absent");
    } finally {
      f.cleanup();
    }
  });

  it("names the carrier-mismatch, never a rulings reason, when a tampered carrier meets a sidecar", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const sealed = seedReview(f);
      // The tamper drops the finding the sidecar rules on (F4) and smuggles F9: judged
      // against the tampered bytes the ruling set reads as broken, which would hide the
      // integrity refusal the round actually owes. The seal is reopened first — the
      // external writer's own step.
      CarrierSeal.unseal(sealed.path);
      writeFileSync(
        sealed.path,
        `${JSON.stringify(
          {
            status: "CHANGES_REQUESTED",
            findings: [
              { id: "F1", severity: "blocker", summary: "the guard is missing" },
              { id: "F9", severity: "blocker", summary: "smuggled" },
            ],
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      writeFileSync(
        CarrierRulings.pathFor(sealed.path),
        JSON.stringify({
          carrier: path.basename(sealed.path),
          rulings: [{ finding: "F4", ruling: "REJECTED as stated", by: "orchestrator" }],
        }),
        "utf8",
      );
      const runner = new SilentRunner();
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      const outcome = await runFix(f, fixFrameOf(specPath), sealed.path, runner);
      expect(outcome.status).toBe("BLOCKED");
      expect(runner.calls).toHaveLength(0);
      expect(f.io.stderrText).toContain("CDD_BLOCKED");
      expect(f.io.stderrText).toContain("carrier-mismatch");
      expect(f.io.stderrText).toContain("recorded=");
      expect(f.io.stderrText).toContain("current=");
      expect(f.io.stderrText).not.toContain("rulings sidecar");
      expect(gradesOf(outcome)).toEqual(["hard"]);
    } finally {
      f.cleanup();
    }
  });

  it("lets the untampered carrier through — the child is spawned and the gate stays silent", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const sealed = seedReview(f);
      const runner = new SilentRunner();
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      const outcome = await runFix(f, fixFrameOf(specPath), sealed.path, runner);
      expect(runner.calls).toHaveLength(1);
      expect(f.io.stderrText).not.toContain("carrier-mismatch");
      // The silent child wrote no draft — the criterion owns the absence, never a crash.
      expect(outcome.status).not.toBe("TIMEOUT");
    } finally {
      f.cleanup();
    }
  });

  it("reads a LEGACY review round (no digest) as present facts — the tamper is not refused", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const at = path.join(f.scene.workspace.path, REQUEST_CARRIER);
      writeFileSync(at, JSON.stringify({ findings: [] }), "utf8");
      // No path recorded, no digest: the identity's ladder resolves the very carrier
      // the fix leg reads, and the read stays present-facts.
      f.scene.ledger.recordRound("phase-spec", { op: "review", cycle: 1 });
      const runner = new SilentRunner();
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      await runFix(f, fixFrameOf(specPath), at, runner);
      expect(runner.calls).toHaveLength(1);
      expect(f.io.stderrText).not.toContain("carrier-mismatch");
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P34 T2 — the fix input's carrier is DERIVED from the requesting review record
// (design spec §2.10): no record names a path, so the ledger's accessor resolves the
// round's own attempt, and a record that resolves nothing books the soft skip.
// ---------------------------------------------------------------------------

describe("P34 T2 — a derived fix input never inherits the frame's attempt", () => {
  /** Plant a review round at attempt 2 with its FINAL carrier + the record's digest. */
  const seedAttemptTwo = (f: Fixture): { path: string; digest: string } =>
    (() => {
      const persisted = f.scene.ledger.persistHandoff(
        "review",
        "phase-spec",
        { round: 1, attempt: 2 },
        {
          status: "CHANGES_REQUESTED",
          findings: [
            { id: "F1", severity: "blocker", lens: "scope", summary: "the guard is missing" },
          ],
        },
      );
      f.scene.ledger.recordRound("phase-spec", {
        op: "review",
        cycle: 1,
        attempt: 2,
        carrierDigest: persisted.digest,
      });
      return persisted;
    })();

  /** The lifecycle with NO `--reviews` flag — the derived resolution alone. */
  const runDerivedFix = async (f: Fixture, runner: SilentRunner): Promise<DispatchOutcome> => {
    const lifecycle = new CliLifecycle({
      scene: f.scene,
      io: f.io,
      sync: runner,
      env: { CLAUDE_CODE_SESSION_ID: "s" },
    });
    const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
    return lifecycle.step()(fixFrameOf(specPath));
  };

  it("reads the attempt-2 FINAL the record resolves — the fix child sees that carrier", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const sealed = seedAttemptTwo(f);
      const runner = new SilentRunner();
      const outcome = await runDerivedFix(f, runner);
      expect(runner.calls).toHaveLength(1);
      // The prompt carries the repo-root-relative spelling of the SAME attempt-2 final.
      expect(promptOf(runner)).toContain(
        path.relative(f.scene.workspace.root.repoRoot, sealed.path),
      );
      expect(promptOf(runner)).not.toContain("phase-spec-review-1.c1.json");
      expect(f.io.stderrText).not.toContain("carrier-mismatch");
      expect(outcome.status).not.toBe("TIMEOUT");
    } finally {
      f.cleanup();
    }
  });

  it("refuses a tampered attempt-2 FINAL before the child exists", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const sealed = seedAttemptTwo(f);
      CarrierSeal.unseal(sealed.path);
      writeFileSync(
        sealed.path,
        `${JSON.stringify(
          {
            status: "CHANGES_REQUESTED",
            findings: [
              { id: "F1", severity: "blocker", lens: "scope", summary: "the guard is missing" },
              { id: "F9", severity: "blocker", lens: "scope", summary: "smuggled" },
            ],
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      const runner = new SilentRunner();
      const outcome = await runDerivedFix(f, runner);
      expect(outcome.status).toBe("BLOCKED");
      expect(gradesOf(outcome)).toEqual(["hard"]);
      expect(runner.calls).toHaveLength(0);
      expect(f.io.stderrText).toContain("carrier-mismatch");
    } finally {
      f.cleanup();
    }
  });

  it("books the soft unrecorded skip when the record resolves no carrier at all", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      // The record exists but none of the ladder's rungs is on disk: the accessor
      // resolves nothing, so the answer is `null` — the unrecorded soft skip, never a
      // hard absent-carrier refusal on a path nobody could name.
      f.scene.ledger.recordRound("phase-spec", { op: "review", cycle: 1 });
      const runner = new FixDraftRunner();
      const outcome = await runDerivedFix(f, runner);
      expect(outcome.status, f.io.stderrText).not.toBe("BLOCKED");
      expect(runner.calls).toHaveLength(1);
      expect(f.io.stderrText).toContain("resolves no carrier");
      expect(f.io.stderrText).not.toContain("carrier-mismatch");
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P31 T4 — the fix input's identity is the FINAL carrier (design spec §2.1/§2.3):
// with the child's draft and the round's `.c<N>` final coexisting, every face that
// names the fix input names the final — the round read, the sidecar's stem, the
// round context and the resume command (one resolution, four readers).
// ---------------------------------------------------------------------------

/** A child stand-in that DIES — the round-ending path that writes the crash record
 *  (and with it the same-command resume `next:`). */
class FailingRunner implements ChildRunner {
  calls: ChildRun[] = [];
  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    return { code: 1, stdout: "", stderr: "", termination: null };
  }
}

describe("P31 T4 — the fix input names the FINAL carrier", () => {
  /** Plant a completed review round: the FINAL carrier + the record naming it. */
  const seedFinalReview = (f: Fixture): { path: string; draftPath: string; digest: string } => {
    const persisted = f.scene.ledger.persistHandoff(
      "review",
      "phase-spec",
      { round: 1 },
      {
        status: "CHANGES_REQUESTED",
        findings: [
          { id: "F1", severity: "blocker", lens: "scope", summary: "the guard is missing" },
        ],
      },
    );
    f.scene.ledger.recordRound("phase-spec", {
      op: "review",
      cycle: 1,
      carrierDigest: persisted.digest,
    });
    return persisted;
  };

  const specPathOf = (f: Fixture): string =>
    path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");

  const relOf = (f: Fixture, at: string): string =>
    path.relative(f.scene.workspace.root.repoRoot, at);

  const runFixFrame = async (f: Fixture, runner: ChildRunner): Promise<void> => {
    const lifecycle = new CliLifecycle({
      scene: f.scene,
      io: f.io,
      sync: runner,
      env: { CLAUDE_CODE_SESSION_ID: "s" },
    });
    await lifecycle.step()(fixFrameOf(specPathOf(f)));
  };

  it("names the final on every face while the child's draft sits beside it", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const sealed = seedFinalReview(f);
      // the child's draft at the pre-split spelling — both files exist on disk
      writeFileSync(sealed.draftPath, JSON.stringify({ findings: [] }), "utf8");
      // (1) the round read — the fix leg's `--reviews` source (and the router's)
      expect(f.scene.ledger.round("review", "phase-spec", { round: 1 }, 1)?.reviewsPath).toBe(
        sealed.path,
      );
      // (2) the ruling sidecar rides the FINAL's stem — never the draft's
      const sidecar = CarrierRulings.pathFor(sealed.path);
      expect(path.basename(sidecar)).toBe("phase-spec-review-1.c1.rulings.json");
      writeFileSync(
        sidecar,
        JSON.stringify({
          carrier: path.basename(sealed.path),
          rulings: [{ finding: "F1", ruling: "ACCEPTED" }],
        }),
        "utf8",
      );
      // (3) the round context — INPUT_REVIEWS / INPUT_RULINGS
      const runner = new SilentRunner();
      await runFixFrame(f, runner);
      const prompt = promptOf(runner);
      expect(prompt).toContain(`- \`INPUT_REVIEWS\`: ${relOf(f, sealed.path)}`);
      expect(prompt).toContain(`- \`INPUT_RULINGS\`: ${relOf(f, sidecar)}`);
      // (4) the resume command — the crash record's `next:` names the same carrier
      await runFixFrame(f, new FailingRunner());
      const frame = fixFrameOf(specPathOf(f));
      const crash = f.scene.ledger.readCrash(f.scene.ledger.naming().crashName(frame));
      expect(crash?.next).toContain(`--reviews ${sealed.path}`);
    } finally {
      f.cleanup();
    }
  });

  it("falls back to the draft family name for a record that names no carrier (legacy row)", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      // the legacy shape: the carrier sits at the family name, the record names none
      const draftPath = path.join(f.scene.workspace.path, REQUEST_CARRIER);
      writeFileSync(
        draftPath,
        JSON.stringify({
          status: "CHANGES_REQUESTED",
          findings: [{ id: "F1", severity: "blocker", summary: "legacy" }],
        }),
        "utf8",
      );
      f.scene.ledger.recordRound("phase-spec", { op: "review", cycle: 1 });
      expect(f.scene.ledger.round("review", "phase-spec", { round: 1 }, 1)?.reviewsPath).toBe(
        draftPath,
      );
      const runner = new SilentRunner();
      await runFixFrame(f, runner);
      expect(promptOf(runner)).toContain(`- \`INPUT_REVIEWS\`: ${relOf(f, draftPath)}`);
    } finally {
      f.cleanup();
    }
  });
});

describe("P31 T2 — the ruling sidecar gates the fix dispatch", () => {
  for (const [label, body] of BAD_SIDECARS) {
    it(`refuses ${label} before the child is spawned`, async () => {
      const f = fixture(planDoc([[1, []]]));
      try {
        const carrier = path.join(f.scene.workspace.path, CARRIER_NAME);
        writeFileSync(carrier, JSON.stringify(CARRIER_BODY), "utf8");
        writeFileSync(
          CarrierRulings.pathFor(carrier),
          typeof body === "string" ? body : JSON.stringify(body),
          "utf8",
        );
        const runner = new SilentRunner();
        const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
        const outcome = await runFix(f, fixFrameOf(specPath), carrier, runner);
        expect(outcome.status).toBe("BLOCKED");
        expect(runner.calls).toHaveLength(0);
        expect(f.io.stderrText).toContain("CDD_BLOCKED");
        expect(f.io.stderrText).toContain("rulings sidecar");
        expect(gradesOf(outcome)).toEqual(["hard"]);
      } finally {
        f.cleanup();
      }
    });
  }

  it("names the sidecar in the fix round context when one conforms", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const carrier = path.join(f.scene.workspace.path, CARRIER_NAME);
      writeFileSync(carrier, JSON.stringify(CARRIER_BODY), "utf8");
      const sidecar = CarrierRulings.pathFor(carrier);
      writeFileSync(sidecar, JSON.stringify(LEGAL_SIDECAR), "utf8");
      const runner = new SilentRunner();
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      await runFix(f, fixFrameOf(specPath), carrier, runner);
      expect(runner.calls).toHaveLength(1);
      const rel = path.relative(f.scene.workspace.root.repoRoot, sidecar);
      expect(promptOf(runner)).toContain(`- \`INPUT_RULINGS\`: ${rel}`);
      expect(promptOf(runner)).toContain("- `INPUT_REVIEWS`: ");
      // The cell carries the ruling BODY too (§2.5 AC: the prompt's text matches
      // the sidecar) — the path alone would leave the child to re-open the file.
      expect(promptOf(runner)).toContain(LEGAL_SIDECAR.rulings[0]?.ruling ?? "");
    } finally {
      f.cleanup();
    }
  });

  it("renders one verbatim body line per ruling of the sidecar", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const carrier = path.join(f.scene.workspace.path, CARRIER_NAME);
      writeFileSync(carrier, JSON.stringify(CARRIER_BODY), "utf8");
      const sidecar = CarrierRulings.pathFor(carrier);
      const rulings = [
        { finding: "F1", ruling: "ACCEPTED — the guard lands in W2" },
        { finding: "F4", ruling: "REJECTED as stated · wording only" },
      ];
      writeFileSync(sidecar, JSON.stringify({ carrier: CARRIER_NAME, rulings }), "utf8");
      const runner = new SilentRunner();
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      await runFix(f, fixFrameOf(specPath), carrier, runner);
      expect(runner.calls).toHaveLength(1);
      const prompt = promptOf(runner);
      const rel = path.relative(f.scene.workspace.root.repoRoot, sidecar);
      for (const ruling of rulings) {
        expect(prompt).toContain(`\`${ruling.finding}\` — ${ruling.ruling}`);
      }
      // The body rides BELOW the path line — the cell reads path then verdicts.
      expect(prompt.indexOf(rulings[1]?.ruling ?? "")).toBeGreaterThan(prompt.indexOf(rel));
    } finally {
      f.cleanup();
    }
  });

  it("leaves the fix round context without the line when no sidecar exists", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const carrier = path.join(f.scene.workspace.path, CARRIER_NAME);
      writeFileSync(carrier, JSON.stringify(CARRIER_BODY), "utf8");
      const runner = new SilentRunner();
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      await runFix(f, fixFrameOf(specPath), carrier, runner);
      expect(runner.calls).toHaveLength(1);
      expect(promptOf(runner)).not.toContain("INPUT_RULINGS");
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P31 T5 — the seal cycle (design spec §2.4): the preflight opens THIS round's own
// two names, every terminal closes them again, and the round's INPUT carriers are
// never opened. The success leg (bookkeep → persist → seal) is pinned at the
// composition root; the pins here are the faces this file owns.
// ---------------------------------------------------------------------------

/** The permission bits of one path (group/other/sticky bits are noise). */
const modeOf = (target: string): number => statSync(target).mode & 0o777;

/** A child stand-in that reports the permission bits of a carrier at the spawn
 *  instant — the scope pin's observation point (the window is open, the input must
 *  still be read-only). */
class ModeProbeRunner implements ChildRunner {
  calls: ChildRun[] = [];
  readonly #probes: readonly string[];
  readonly #seen: number[];

  constructor(probes: readonly string[], seen: number[]) {
    this.#probes = probes;
    this.#seen = seen;
  }

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    for (const probe of this.#probes) this.#seen.push(modeOf(probe));
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

describe("P31 T5 — the seal cycle: every terminal closes the round's own window", () => {
  /** The fix round's own draft name of the fixture's spec line. */
  const FIX_DRAFT = "phase-spec-fix-1.json";

  /** Plant the round's own draft, writable — a previous attempt's leftover. */
  const plantWritableDraft = (f: Fixture): string => {
    const draft = path.join(f.scene.workspace.path, FIX_DRAFT);
    writeFileSync(draft, JSON.stringify({ status: "APPROVED", artifacts: {} }), "utf8");
    expect(modeOf(draft)).toBe(0o644);
    return draft;
  };

  it("a pre-spawn gate refusal re-seals the round's own draft", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const draft = plantWritableDraft(f);
      // The requesting carrier + a sidecar the strict schema refuses: the P31 T2 gate
      // stops the round before the child exists.
      const carrier = path.join(f.scene.workspace.path, CARRIER_NAME);
      writeFileSync(carrier, JSON.stringify(CARRIER_BODY), "utf8");
      writeFileSync(CarrierRulings.pathFor(carrier), "{ not json", "utf8");
      const runner = new SilentRunner();
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      const outcome = await runFix(f, fixFrameOf(specPath), carrier, runner);
      expect(outcome.status).toBe("BLOCKED");
      expect(runner.calls).toHaveLength(0);
      // The window the preflight opened is closed by the refusal itself.
      expect(modeOf(draft)).toBe(0o444);
    } finally {
      f.cleanup();
    }
  });

  it("a child death (#reject) seals the draft the child left behind", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const runner = new ReviewDraftRunner([{ severity: "blocker", lens: "spec", summary: "x" }]);
      // The child dies AFTER writing a valid draft — the rejection face, not promotion.
      const dying: ChildRunner = {
        run: async (run) => {
          await runner.run(run);
          return { code: 1, stdout: "", stderr: "", termination: null };
        },
      };
      const { outcome } = await dispatchFrame(f, reviewFrame, dying);
      expect(outcome.status).toBe("BLOCKED");
      const draft = path.join(f.scene.workspace.path, "tasks-1-review-1.json");
      expect(modeOf(draft)).toBe(0o444);
    } finally {
      f.cleanup();
    }
  });

  it("the `--recover` abort fold seals the killed round's draft", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      // The killed round's identity: a dead holder naming a REVIEW cycle 2.
      plantStale(f, staleRecord({ phase: "review", cycle: 2 }));
      const draft = path.join(f.scene.workspace.path, "tasks-1-review-2.json");
      writeFileSync(draft, JSON.stringify({ findings: [] }), "utf8");
      expect(await lifecycleOf(f).foldAbort()).toBe(true);
      // The record's OWN identity seals the draft the dead child left writable.
      expect(modeOf(draft)).toBe(0o444);
    } finally {
      f.cleanup();
    }
  });

  it("a losing acquire race (HoldingError) re-seals the window the preflight opened", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const draft = path.join(f.scene.workspace.path, "tasks-1-review-1.json");
      writeFileSync(draft, JSON.stringify({ findings: [] }), "utf8");
      expect(modeOf(draft)).toBe(0o644);
      // The gate→acquire race: a sibling dispatch holds the tree, so `acquire` refuses
      // with `HoldingError` AFTER the preflight half opened this round's own names.
      plantStale(f, staleRecord({ pid: 1 }));
      const holding = new InFlight(f.scene.workspace.root, f.scene.workspace.slug, {
        live: async () => true,
      });
      const lifecycle = new CliLifecycle({
        scene: f.scene,
        io: f.io,
        sync: new SilentRunner(),
        env: { CLAUDE_CODE_SESSION_ID: "s" },
        inflight: holding,
      });
      await expect(lifecycle.step()(reviewFrame)).rejects.toBeInstanceOf(HoldingError);
      // The refused dispatch leaves no writable carrier behind.
      expect(modeOf(draft)).toBe(0o444);
    } finally {
      f.cleanup();
    }
  });

  it("leaves the round's INPUT carrier sealed for the whole dispatch (the window is two names)", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const seeded = f.scene.ledger.persistHandoff(
        "review",
        "phase-spec",
        { round: 1 },
        {
          status: "CHANGES_REQUESTED",
          findings: [{ id: "F1", severity: "blocker", lens: "scope", summary: "the guard" }],
        },
      );
      f.scene.ledger.recordRound("phase-spec", {
        op: "review",
        cycle: 1,
        carrierDigest: seeded.digest,
      });
      expect(modeOf(seeded.path)).toBe(0o444);
      const seen: number[] = [];
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      const probe = new ModeProbeRunner([seeded.path], seen);
      const lifecycle = new CliLifecycle({
        scene: f.scene,
        io: f.io,
        sync: probe,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
        reviews: seeded.path,
      });
      await lifecycle.step()(fixFrameOf(specPath));
      expect(probe.calls).toHaveLength(1);
      // Visible to the child AND after the round: an input carrier is never reopened.
      expect(seen).toEqual([0o444]);
      expect(modeOf(seeded.path)).toBe(0o444);
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P34 T3 — the round's OWN identity keys the window, the crash record and the
// resume read: the attempt is part of the identity everywhere (design spec §2.4),
// never a naming decoration the seal cycle and the abort fold drop.
// ---------------------------------------------------------------------------

/** The same frame on a later attempt — the shape `#paramsOf` builds (the attempt
 *  rides both the frame and its params; the naming reads the frame first). */
const atAttempt = (frame: OpenFrame, attempt: number): OpenFrame => ({
  ...frame,
  attempt,
  params: { ...frame.params, attempt },
});

/** One carrier path inside the fixture's `.kairos/cdd/p30` workspace. */
const carrierAt = (f: Fixture, name: string): string => path.join(f.scene.workspace.path, name);

describe("P34 T3 — the attempt is the round's identity (window · crash · resume)", () => {
  it("opens ONLY the attempt-2 pair and re-seals it at the terminal, leaving attempt 1 closed", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      // Attempt 1 completed: its draft and final exist at the attempt-1 names, sealed.
      const firstDraft = carrierAt(f, "tasks-1-review-1.json");
      const firstFinal = carrierAt(f, "tasks-1-review-1.c1.json");
      for (const seeded of [firstDraft, firstFinal]) {
        writeFileSync(seeded, JSON.stringify({ findings: [] }), "utf8");
        chmodSync(seeded, 0o444);
      }
      // Attempt 2's pair, left writable by a previous attempt.
      const retryDraft = carrierAt(f, "tasks-1-review-1-a2.json");
      const retryFinal = carrierAt(f, "tasks-1-review-1-a2.c1.json");
      for (const leftover of [retryDraft, retryFinal]) {
        writeFileSync(leftover, JSON.stringify({ findings: [] }), "utf8");
      }
      const seen: number[] = [];
      const probe = new ModeProbeRunner([firstDraft, firstFinal, retryDraft, retryFinal], seen);
      const draft = new ReviewDraftRunner(
        [{ severity: "warn", lens: "scope", summary: "x" }],
        "tasks-1-review-1-a2.json",
      );
      // Probe the window at the spawn instant, then die — the death face seals the pair.
      const combined: ChildRunner = {
        run: async (run) => {
          await probe.run(run);
          await draft.run(run);
          return { code: 1, stdout: "", stderr: "", termination: null };
        },
      };
      const { outcome } = await dispatchFrame(f, atAttempt(reviewFrame, 2), combined);
      expect(outcome.status).toBe("BLOCKED");
      // The window: attempt 1 stays read-only, ONLY the attempt-2 pair opens.
      expect(seen).toEqual([0o444, 0o444, 0o644, 0o644]);
      // The terminal closes the pair the round actually owned.
      expect(modeOf(retryDraft)).toBe(0o444);
      expect(modeOf(retryFinal)).toBe(0o444);
      expect(modeOf(firstDraft)).toBe(0o444);
      expect(modeOf(firstFinal)).toBe(0o444);
    } finally {
      f.cleanup();
    }
  });

  it("an attempt-2 review death writes and re-reads the attempt-2 crash record", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      // Attempt 1's crash record already exists — a later attempt must not clobber it.
      const firstCrash = carrierAt(f, "crash-tasks-1-review-1.json");
      writeFileSync(firstCrash, "attempt-1 sentinel", "utf8");
      const draft = new ReviewDraftRunner(
        [{ severity: "blocker", lens: "spec", summary: "x" }],
        "tasks-1-review-1-a2.json",
      );
      const dying: ChildRunner = {
        run: async (run) => {
          await draft.run(run);
          return { code: 1, stdout: "", stderr: "", termination: null };
        },
      };
      const frame = atAttempt(reviewFrame, 2);
      const { outcome } = await dispatchFrame(f, frame, dying);
      expect(outcome.status).toBe("BLOCKED");
      // The crash face's own derivation — the same call the capsule line reads.
      const naming = f.scene.ledger.naming();
      expect(naming.crashName(frame)).toBe("crash-tasks-1-review-1-a2.json");
      const crash = f.scene.ledger.readCrash(naming.crashName(frame));
      expect(crash).not.toBeNull();
      // The record names the attempt-2 draft — the identity rides the name, and the
      // postmortem points back at the file the dead child was writing.
      expect(crash?.attemptedHandoff).toBe(".kairos/cdd/p30/tasks-1-review-1-a2.json");
      expect(crash?.cause).toBe("child-exit");
      // The resume command is the review leg's own, off the same crash record.
      expect(crash?.next).toContain("cdd review");
      expect(path.basename(naming.crashPath(frame))).toBe("crash-tasks-1-review-1-a2.json");
      // Attempt 1's crash record is untouched.
      expect(readFileSync(firstCrash, "utf8")).toBe("attempt-1 sentinel");
    } finally {
      f.cleanup();
    }
  });

  it("the failure face's capsule cell prints the attempt-2 crash path the round wrote", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      // Review 1 concluded CHANGES_REQUESTED, so the line awaits the fix; fix 1's first
      // attempt died, so the SAME fix cycle re-opens on attempt 2 — the frame the crash
      // name derives from. (The fix leg pins its round to the review's cycle, which is
      // what makes the attempt — not the cycle — the re-dispatch coordinate here.)
      const seeded = f.scene.ledger.persistHandoff(
        "review",
        "phase-spec",
        { round: 1 },
        {
          status: "CHANGES_REQUESTED",
          findings: [
            { id: "F1", severity: "blocker", lens: "scope", summary: "the guard is missing" },
          ],
        },
      );
      f.scene.ledger.recordRound("phase-spec", {
        op: "review",
        cycle: 1,
        attempt: 1,
        carrierDigest: seeded.digest,
      });
      f.scene.ledger.recordRound("phase-spec", {
        op: "fix",
        cycle: 1,
        attempt: 1,
        verdict: { treeClean: true, targetAction: false },
      });
      const dying: ChildRunner = {
        async run(): Promise<ChildOutcome> {
          return { code: 1, stdout: "", stderr: "", termination: null };
        },
      };
      // The production composition: the session lifecycle's dispatch IS the CLI
      // lifecycle's step, so this ONE round writes the crash record and the attached
      // capsule reads it back through its own derivation.
      const lifecycle = new Lifecycle({
        face: targetFaces["phase-spec"],
        state: EMPTY_RUN_STATE,
        ledger: f.scene.ledger,
        dispatch: new CliLifecycle({
          scene: f.scene,
          io: f.io,
          sync: dying,
          env: { CLAUDE_CODE_SESSION_ID: "s" },
        }).step(),
        target: { kind: "spec", doc: specPath },
        capsule: new Capsule(new Words()),
      });
      const step = await lifecycle.advance();
      expect(step?.frame.phase).toBe("fix");
      expect(step?.frame.attempt).toBe(2);
      // The cell IS the attempt-2 crash record's path — the same name the write point
      // derived, never attempt 1's record and never a hand-spelled name.
      expect(step?.capsuleLines[0]).toBe(
        `status: BLOCKED · handoff: ${carrierAt(f, "crash-phase-spec-fix-1-a2.json")}`,
      );
    } finally {
      f.cleanup();
    }
  });

  it("a fix retry reads the review carrier its record names — never an attempt tail off its own frame", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const seeded = f.scene.ledger.persistHandoff(
        "review",
        "phase-spec",
        { round: 1 },
        {
          status: "CHANGES_REQUESTED",
          findings: [
            { id: "F1", severity: "blocker", lens: "scope", summary: "the guard is missing" },
          ],
        },
      );
      f.scene.ledger.recordRound("phase-spec", {
        op: "review",
        cycle: 1,
        attempt: 1,
        carrierDigest: seeded.digest,
      });
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      const frame = atAttempt(fixFrameOf(specPath), 2);
      const lifecycle = new CliLifecycle({
        scene: f.scene,
        io: f.io,
        sync: new FailingRunner(),
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      await lifecycle.step()(frame);
      const naming = f.scene.ledger.naming();
      expect(naming.crashName(frame)).toBe("crash-phase-spec-fix-1-a2.json");
      const crash = f.scene.ledger.readCrash(naming.crashName(frame));
      // The requesting carrier is the review round's FINAL — its own attempt, not the fix's.
      expect(crash?.next).toContain(`--reviews ${seeded.path}`);
      expect(crash?.next).not.toContain("-a2");
    } finally {
      f.cleanup();
    }
  });

  it("the abort fold seals the ATTEMPT-2 pair — attempt 1's window stays closed", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      plantStale(f, staleRecord({ phase: "review", cycle: 1, attempt: 2 }));
      const firstDraft = carrierAt(f, "tasks-1-review-1.json");
      writeFileSync(firstDraft, JSON.stringify({ findings: [] }), "utf8");
      chmodSync(firstDraft, 0o444);
      const retryDraft = carrierAt(f, "tasks-1-review-1-a2.json");
      const retryFinal = carrierAt(f, "tasks-1-review-1-a2.c1.json");
      for (const leftover of [retryDraft, retryFinal]) {
        writeFileSync(leftover, JSON.stringify({ findings: [] }), "utf8");
      }
      expect(await lifecycleOf(f).foldAbort()).toBe(true);
      // The record's OWN identity (cycle 1 · attempt 2) seals the pair the dead child owned.
      expect(modeOf(retryDraft)).toBe(0o444);
      expect(modeOf(retryFinal)).toBe(0o444);
      expect(modeOf(firstDraft)).toBe(0o444);
    } finally {
      f.cleanup();
    }
  });

  it("the implement family's fold lands on the cycle-bearing name, not the retired round-less one", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      plantStale(f, staleRecord({ phase: "implement", cycle: 2, attempt: 2 }));
      // A retired-spelling leftover: the round-less name is not this round's identity.
      const legacy = carrierAt(f, "tasks-1-implement.json");
      writeFileSync(legacy, JSON.stringify({ status: "BLOCKED", artifacts: {} }), "utf8");
      const own = carrierAt(f, "tasks-1-implement-2-a2.json");
      const ownFinal = carrierAt(f, "tasks-1-implement-2-a2.c2.json");
      for (const leftover of [own, ownFinal]) {
        writeFileSync(leftover, JSON.stringify({ status: "BLOCKED", artifacts: {} }), "utf8");
      }
      expect(await lifecycleOf(f).foldAbort()).toBe(true);
      expect(modeOf(own)).toBe(0o444);
      expect(modeOf(ownFinal)).toBe(0o444);
      // The retired spelling belongs to no round of this file — the fold never claims it.
      expect(modeOf(legacy)).toBe(0o644);
    } finally {
      f.cleanup();
    }
  });
});
