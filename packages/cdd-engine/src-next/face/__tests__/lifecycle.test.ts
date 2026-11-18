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
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { TestDispatchValues } from "../../__tests__/support/dispatch-values.ts";
import { planSourceOf } from "../../__tests__/support/plan-source.ts";
import { stripComments } from "../../__tests__/support/strip-comments.ts";
import {
  type CompletionContext,
  CompletionCriteria,
  IMPLEMENT_CARRIER_ABSENT,
  IMPLEMENT_VERIFICATION_WAVE,
} from "../../contract/completion-criterion.ts";
import { PreFlightRows } from "../../contract/preflight-rows.ts";
import { REGRADE_MARK } from "../../contract/review-criteria.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { ProcessFacts } from "../../infra/proc.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { REVIEWS } from "../../render/templates.ts";
import { targetFaces } from "../../session/faces.ts";
import { HandoffSchema } from "../../session/handoff-schema.ts";
import { HoldingError, InFlight } from "../../session/inflight.ts";
import { Ledger } from "../../session/ledger.ts";
import { ArtifactRegistry } from "../../session/round-artifacts.ts";
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
  const ledger = new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis));
  // P38 T2 — the dispatch-input gate judges real inputs, so the fixture supplies them:
  // the brief a wave rendezvous reads (the real dispatch's `renderBrief` lands it before
  // the child exists), the base branch a tree review narrows against, and the spec /
  // plan documents the docs-fix frames repair. A fixture that names absent files would be
  // refused before the child it is testing.
  const briefPath = path.join(workspace.path, "tasks-1-brief.md");
  writeFileSync(briefPath, "# brief\n", "utf8");
  for (const name of ["s.md", "p.md"]) {
    const doc = path.join(repoRoot, "docs", "k", name);
    mkdirSync(path.dirname(doc), { recursive: true });
    writeFileSync(doc, "# doc\n", "utf8");
  }
  return {
    scene: {
      workspace,
      ledger,
      planPath,
      plan: planSourceOf(workspace.root.basis).readFor(null),
      briefPath,
      baseBranch: "develop",
    },
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
      artifacts: new ArtifactRegistry(),
      io: f.io,
      sync: runner,
      env: { CLAUDE_CODE_SESSION_ID: "s" },
      // The record the composition root would compose for THIS frame (P40 T5): the
      // requesting carrier is the ledger's own derivation, exactly as the flag-less
      // `cdd fix` invocation resolves it.
      values: TestDispatchValues.of(f.scene, frame, {
        reviews: TestDispatchValues.reviewsOf(f.scene, frame),
      }),
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

/** One lifecycle over a fixture — the production liveness reader (a dead pid reads dead).
 *  The abort fold renders no prompt, so it reads no value record: an empty map is the
 *  honest fixture (the required `values` slot documents the wiring, nothing more). */
const lifecycleOf = (f: Fixture): CliLifecycle =>
  new CliLifecycle({
    scene: f.scene,
    artifacts: new ArtifactRegistry(),
    io: f.io,
    sync: new SilentRunner(),
    env: { CLAUDE_CODE_SESSION_ID: "s" },
    values: {},
  });

describe("CliLifecycle.foldAbort — the `--recover` abort leg (P30 §2.1①/§2.2)", () => {
  it("folds a dead holder's record into ONE abort round record", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      plantStale(f, staleRecord());
      expect(await lifecycleOf(f).foldAbort()).toBe(true);
      const records = f.scene.ledger.recordsOf("1");
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
      expect(f.scene.ledger.recordsOf("1")).toEqual([]);
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
      expect(f.scene.ledger.recordsOf("1")).toEqual([]);
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
      const [abort] = f.scene.ledger.recordsOf("1");
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
      expect(f.scene.ledger.recordsOf("1")).toEqual([]);
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
        {
          id: "X9",
          severity: "blocker",
          lens: "spec",
          summary: "drift",
          impact: {
            scenario: "a legal empty wave key → the brief mirrors no task → expected a refusal",
          },
        },
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
        {
          severity: "blocker",
          lens: "spec",
          summary: "drift",
          line: "42",
          section: 3,
          impact: {
            scenario: "a legal empty wave key → the brief mirrors no task → expected a refusal",
          },
        },
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
        impact: {
          scenario: "a legal empty wave key → the brief mirrors no task → expected a refusal",
        },
      });
      expect(outcome.status).toBe("CHANGES_REQUESTED");
      expect((outcome.violations ?? []).map((violation) => violation.grade)).toEqual(["soft"]);
      expect(outcome.violations?.[0]?.message).toContain("findings[0].line");
      expect(outcome.violations?.[0]?.message).toContain("findings[0].section");
    } finally {
      f.cleanup();
    }
  });

  it("keeps the engine-stamped id when the draft's own id breaks its declared shape", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const runner = new ReviewDraftRunner([
        { id: 0, severity: "warn", lens: "spec", summary: "drift" },
      ]);
      const { outcome } = await dispatchFrame(f, reviewFrame, runner);
      const carrier = outcome.carrier as { findings: Record<string, unknown>[] };
      // The decorative drop retires the CHILD's value, never the engine's own key:
      // the persisted row still carries the primary key the next fix round's
      // dispositions are keyed by (P30 §2.5).
      expect(carrier.findings[0]?.id).toBe("F1");
      expect((outcome.violations ?? []).map((violation) => violation.grade)).toEqual(["soft"]);
      expect(outcome.violations?.[0]?.message).toContain("findings[0].id");
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
// P37 T3 — the blocker evidence gate (design spec §2.2): a blocker that cannot state
// its scenario refuses the round on the SAME read-back path every schema refusal
// rides — the criteria row's id is the message's first word, and every offending
// finding is listed (never one of two). The paired arm: the same blocker with a
// scenario passes and the round concludes normally.
// ---------------------------------------------------------------------------

/** One reproducible scenario — the shape the gate asks a blocker to state. */
const IMPACT = {
  scenario: "a legal empty wave key → the brief mirrors no task → expected a refusal",
};

describe("P37 T3 — the grading gate refuses a blocker that owes its scenario", () => {
  it("blocks the round and lists the criterion row plus every violating finding's id and summary", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const runner = new ReviewDraftRunner([
        { id: "F1", severity: "blocker", lens: "spec", summary: "drift" },
        { severity: "blocker", lens: "buildability", summary: "the suite can never go red" },
        { severity: "warn", lens: "standards", summary: "duplicated policy" },
      ]);
      const { outcome } = await dispatchFrame(f, reviewFrame, runner);
      expect(outcome.status).toBe("BLOCKED");
      const lines = f.io.stderrText.split("\n").filter((line) => line.includes("CDD_BLOCKED:"));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("CDD_BLOCKED: grading-impact-missing");
      expect(lines[0]).toContain('F1 "drift"');
      // an id-less blocker is listed too — the summary alone is the label
      expect(lines[0]).toContain('unkeyed "the suite can never go red"');
      // a warn owes no scenario, so it is never listed by this gate
      expect(lines[0]).not.toContain("duplicated policy");
      // no conclusion was produced: the read-back refused before materialize
      expect(outcome.carrier).toBeUndefined();
    } finally {
      f.cleanup();
    }
  });

  it("passes the same blocker once it carries a scenario", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const runner = new ReviewDraftRunner([
        { severity: "blocker", lens: "spec", summary: "drift", impact: IMPACT },
      ]);
      const { outcome } = await dispatchFrame(f, reviewFrame, runner);
      expect(outcome.status).toBe("CHANGES_REQUESTED");
      expect(f.io.stderrText).not.toContain("CDD_BLOCKED");
      expect(f.io.stderrText).not.toContain("grading-impact-missing");
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

/** The fix frame on the fixture's spec line (the `--reviews` seam injects the carrier). */
const fixFrameOf = (specPath: string): OpenFrame => ({
  type: "phase-spec",
  phase: "fix",
  round: 1,
  target: { kind: "spec", doc: specPath },
  params: { round: 1 },
  key: "phase-spec",
});

/** The rendered rulings sidecar path of a carrier — the matrix's `rulings` row over
 *  the REVIEWED round's identity (P36 T2). The fixture spells no tail of its own. */
const sidecarOf = (workspace: Workspace, carrierPath: string): string => {
  const registry = new ArtifactRegistry();
  const attributed = registry.attribute(path.basename(carrierPath));
  if (attributed === null || attributed.identity.domain !== "round") {
    throw new Error(`the fixture carrier ${carrierPath} attributes to no round`);
  }
  const identity = { ...attributed.identity, op: "review" as const };
  const sidecar = registry.locate(identity, "rulings", workspace);
  if (sidecar === null) throw new Error("the matrix renders no rulings sidecar");
  return sidecar;
};

/** Run one fix dispatch with the injected reviews carrier. */
const runFix = async (
  f: Fixture,
  frame: OpenFrame,
  reviews: string,
  runner: SilentRunner,
): Promise<DispatchOutcome> => {
  const lifecycle = new CliLifecycle({
    scene: f.scene,
    artifacts: new ArtifactRegistry(),
    io: f.io,
    sync: runner,
    env: { CLAUDE_CODE_SESSION_ID: "s" },
    reviews,
    values: TestDispatchValues.of(f.scene, frame, { reviews }),
  });
  return lifecycle.step()(frame);
};

/** The prompt the child stand-in received (the joined argv). */
const promptOf = (runner: SilentRunner): string => (runner.calls[0]?.args ?? []).join(" ");

// ---------------------------------------------------------------------------
// P34 T2 — the fix input's carrier is DERIVED from the requesting review record
// (design spec §2.10): no record names a path, so the ledger's accessor resolves the
// round's own attempt.
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
    const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
    const frame = fixFrameOf(specPath);
    const lifecycle = new CliLifecycle({
      scene: f.scene,
      artifacts: new ArtifactRegistry(),
      io: f.io,
      sync: runner,
      env: { CLAUDE_CODE_SESSION_ID: "s" },
      // The derived resolution (no `--reviews` flag): the record names the carrier the
      // ledger's own ladder resolves, exactly as the composition root produces it.
      values: TestDispatchValues.of(f.scene, frame, {
        reviews: TestDispatchValues.reviewsOf(f.scene, frame),
      }),
    });
    return lifecycle.step()(frame);
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
    const frame = fixFrameOf(specPathOf(f));
    const lifecycle = new CliLifecycle({
      scene: f.scene,
      artifacts: new ArtifactRegistry(),
      io: f.io,
      sync: runner,
      env: { CLAUDE_CODE_SESSION_ID: "s" },
      values: TestDispatchValues.of(f.scene, frame, {
        reviews: TestDispatchValues.reviewsOf(f.scene, frame),
      }),
    });
    await lifecycle.step()(frame);
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
      const sidecar = sidecarOf(f.scene.workspace, sealed.path);
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
      const draftPath = path.join(f.scene.workspace.path, CARRIER_NAME);
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

describe("P31 T2 — the ruling sidecar rides the fix round context", () => {
  it("names the sidecar in the fix round context when one conforms", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const carrier = path.join(f.scene.workspace.path, CARRIER_NAME);
      writeFileSync(carrier, JSON.stringify(CARRIER_BODY), "utf8");
      const sidecar = sidecarOf(f.scene.workspace, carrier);
      writeFileSync(sidecar, JSON.stringify(LEGAL_SIDECAR), "utf8");
      const runner = new SilentRunner();
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      await runFix(f, fixFrameOf(specPath), carrier, runner);
      expect(runner.calls).toHaveLength(1);
      const rel = path.relative(f.scene.workspace.root.repoRoot, sidecar);
      expect(promptOf(runner)).toContain(`- \`INPUT_RULINGS\`: ${rel}`);
      expect(promptOf(runner)).toContain("- `INPUT_REVIEWS`: ");
      // ONE input, ONE reading (spec §2.10): the cell names WHERE the rulings live and
      // quotes no body — the sidecar is the single source, and the child opens it.
      expect(promptOf(runner)).not.toContain(LEGAL_SIDECAR.rulings[0]?.ruling ?? "");
    } finally {
      f.cleanup();
    }
  });

  it("names the REVIEWED round's sidecar on a fix dispatch — the `review` segment, never `fix`", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      // A plan line's carrier, handed to a fix dispatch: the sidecar's coordinate is
      // the CARRIER's round (line=plan · op=review), never this fix round's op. The
      // plan round renders `plan-fix-1.c1.rulings.json`; that name is what a second
      // expression would mint and what no gate ever sees.
      const carrier = path.join(f.scene.workspace.path, "plan-review-1.c1.json");
      writeFileSync(carrier, JSON.stringify(CARRIER_BODY), "utf8");
      const sidecar = sidecarOf(f.scene.workspace, carrier);
      writeFileSync(
        sidecar,
        JSON.stringify({
          carrier: path.basename(carrier),
          rulings: [{ finding: "F1", ruling: "ACCEPTED" }],
        }),
        "utf8",
      );
      const runner = new SilentRunner();
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      await runFix(f, fixFrameOf(specPath), carrier, runner);
      expect(runner.calls).toHaveLength(1);
      const rel = path.relative(f.scene.workspace.root.repoRoot, sidecar);
      expect(rel).toBe(path.join(".kairos", "cdd", "p30", "plan-review-1.c1.rulings.json"));
      expect(promptOf(runner)).toContain(`- \`INPUT_RULINGS\`: ${rel}`);
      expect(promptOf(runner)).not.toContain("plan-fix-");
    } finally {
      f.cleanup();
    }
  });

  it("reads the round-context cell and the gate through ONE strict verdict — composed at the seam (P36 T2 · T7)", () => {
    // One discriminant, two consumers: a cell that read the sidecar loosely would
    // quote a ruling set the gate is about to refuse, so the prompt and the refusal
    // would be answering two different questions about one file. The composition
    // lives at the frame-free seam (`session/artifact-reads.ts`) — this face delegates
    // to it, and the lenient read is nobody's.
    const seam = stripComments(
      readFileSync(
        fileURLToPath(new URL("../../session/artifact-reads.ts", import.meta.url)),
        "utf8",
      ),
    );
    const snapshot = stripComments(
      readFileSync(fileURLToPath(new URL("../dispatch-values.ts", import.meta.url)), "utf8"),
    );
    expect(seam).toContain("CarrierRulings.verdict(");
    expect(`${seam}\n${snapshot}`).not.toContain("CarrierRulings.read(");
    // P40 T5 — the ONE read of the dispatch's artifact is the assembly's snapshot
    // (`ArtifactSnapshots.of`), the value the seam judges and the record names.
    expect(snapshot).toContain("new ArtifactReads(opts.artifacts, opts.workspace).read(");
  });

  it("renders ONE path line and zero body lines — the ruling bodies stay in the sidecar", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const carrier = path.join(f.scene.workspace.path, CARRIER_NAME);
      writeFileSync(carrier, JSON.stringify(CARRIER_BODY), "utf8");
      const sidecar = sidecarOf(f.scene.workspace, carrier);
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
      // exactly one round-context line, and it carries the path alone: the prompt tail
      // is byte-stable no matter how many rulings the orchestrator records (§2.10).
      expect(prompt.match(/^- `INPUT_RULINGS`: /gm)).toHaveLength(1);
      expect(prompt).toContain(`- \`INPUT_RULINGS\`: ${rel}`);
      for (const ruling of rulings) {
        expect(prompt).not.toContain(`\`${ruling.finding}\` — ${ruling.ruling}`);
      }
    } finally {
      f.cleanup();
    }
  });

  it("renders the literal `none` on the fix round context when no sidecar exists", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      const carrier = path.join(f.scene.workspace.path, CARRIER_NAME);
      writeFileSync(carrier, JSON.stringify(CARRIER_BODY), "utf8");
      const runner = new SilentRunner();
      const specPath = path.join(f.scene.workspace.root.repoRoot, "docs", "k", "s.md");
      await runFix(f, fixFrameOf(specPath), carrier, runner);
      expect(runner.calls).toHaveLength(1);
      // Deliberate pin flip (P38 §2.3 reversal ③ · D74): the cell is ALWAYS present on
      // a fix round — no sidecar is a fact written as the bare literal `none`, never a
      // dropped line (a dropped line cannot be told apart from a lost path).
      expect(promptOf(runner)).toContain("- `INPUT_RULINGS`: none");
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
        artifacts: new ArtifactRegistry(),
        io: f.io,
        sync: new SilentRunner(),
        env: { CLAUDE_CODE_SESSION_ID: "s" },
        inflight: holding,
        values: TestDispatchValues.of(f.scene, reviewFrame),
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
      const frame = fixFrameOf(specPath);
      const lifecycle = new CliLifecycle({
        scene: f.scene,
        artifacts: new ArtifactRegistry(),
        io: f.io,
        sync: probe,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
        reviews: seeded.path,
        values: TestDispatchValues.of(f.scene, frame, { reviews: seeded.path }),
      });
      await lifecycle.step()(frame);
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

/** The wave line's fix frame — the frame whose review family name carries the cycle
 *  (`tasks-1-review-1.json`), the spelling §2.10's fallback must compose. */
const waveFixFrame: OpenFrame = {
  type: "wave",
  phase: "fix",
  round: 1,
  target: { kind: "wave", tasks: [1] },
  params: { tasks: "1", round: 1, attempt: 1 },
  key: "1",
};

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
          artifacts: new ArtifactRegistry(),
          io: f.io,
          sync: dying,
          env: { CLAUDE_CODE_SESSION_ID: "s" },
          // The frame the session lifecycle is about to advance: the attempt-2 fix.
          values: TestDispatchValues.of(f.scene, atAttempt(fixFrameOf(specPath), 2), {
            reviews: TestDispatchValues.reviewsOf(f.scene, atAttempt(fixFrameOf(specPath), 2)),
          }),
        }).step(),
        target: { kind: "spec", doc: specPath },
        // The scene's own plan read — the same value the CLI lifecycle hashes.
        plan: f.scene.plan ?? planSourceOf(f.scene.workspace.root.basis).readFor(null),
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
        artifacts: new ArtifactRegistry(),
        io: f.io,
        sync: new FailingRunner(),
        env: { CLAUDE_CODE_SESSION_ID: "s" },
        values: TestDispatchValues.of(f.scene, frame, {
          reviews: TestDispatchValues.reviewsOf(f.scene, frame),
        }),
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

  it("composes the cycle-only family name for a record-less cycle — the family never takes the frame's attempt", async () => {
    const f = fixture(planDoc([[1, []]]));
    try {
      // The cycle records NO review, so the carrier falls to the review family's own
      // name (§2.10): that name carries the cycle alone. `tasks-1-review-1.json` is the
      // file on disk — `-a2` is a name the review round never wrote, so a fallback that
      // took the fix frame's attempt would compose an absent path and refuse a round
      // that stands today.
      const family = carrierAt(f, "tasks-1-review-1.json");
      writeFileSync(family, JSON.stringify({ findings: [] }), "utf8");
      chmodSync(family, 0o444);
      const runner = new FailingRunner();
      const { outcome } = await dispatchFrame(f, atAttempt(waveFixFrame, 2), runner);
      // The round stands at the gate: the child was spawned (its own exit is the
      // round's verdict, never the input gate's).
      expect(f.io.stderrText).not.toContain("dispatch-input");
      expect(runner.calls).toHaveLength(1);
      // The round context and the resume command name the SAME cycle-only spelling.
      const spelled = path.relative(f.scene.workspace.root.repoRoot, family);
      expect(runner.calls[0]?.args.join(" ")).toContain(spelled);
      expect(runner.calls[0]?.args.join(" ")).not.toContain("tasks-1-review-1-a2.json");
      const crash = f.scene.ledger.readCrash("crash-tasks-1-fix-1-a2.json");
      expect(crash?.next).toContain(`--reviews ${family}`);
      expect(crash?.next).not.toContain("-a2.json");
      expect(outcome.status).not.toBe("TIMEOUT");
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

// ---------------------------------------------------------------------------
// P35 T3 — the scene's plan read is the brief hash's ONLY source (design spec
// §2.1): an unparseable plan records no hash and the round still runs.
// ---------------------------------------------------------------------------

/** A plan the grammar refuses — one task block carrying `#### DependsOn` twice. */
const DUPLICATE_DEPENDS_ON_PLAN = [
  "---",
  "doc-type: plan",
  "version: v0.1",
  "---",
  "",
  "### Task 1: task 1",
  "",
  "#### DependsOn",
  "none",
  "",
  "#### DependsOn",
  "none",
  "",
].join("\n");

describe("P35 T3 — an unparseable plan read records no brief hash", () => {
  it("runs the round and leaves the in-flight `briefHash` null", async () => {
    const f = fixture(DUPLICATE_DEPENDS_ON_PLAN);
    try {
      const planPath = f.scene.planPath;
      // The scene's plan read is a REAL `PlanSource` read of the document on disk.
      f.scene.plan = planSourceOf(f.scene.workspace.root.basis).readPath(planPath!);
      expect(f.scene.plan.kind).toBe("unreadable");
      const seen: (string | null)[] = [];
      const probe: ChildRunner = {
        async run(): Promise<ChildOutcome> {
          const record = JSON.parse(readFileSync(recordPathOf(f), "utf8")) as {
            briefHash: string | null;
          };
          seen.push(record.briefHash);
          return { code: 0, stdout: "", stderr: "", termination: null };
        },
      };
      const { outcome } = await dispatchFrame(f, reviewFrame, probe);
      // The child ran (the round is not refused) and the value is the honest null —
      // never a hash of a half-parsed document.
      expect(seen).toEqual([null]);
      expect(outcome.status).not.toBe("TIMEOUT");
    } finally {
      f.cleanup();
    }
  });
});

/**
 * P37 T5 — the downgrade mark on the capsule's `summary` slot (design spec §5.1 ·
 * §5.2). Every arm is paired: a review round with no downgrade leaves the slot
 * undefined, so the capsule's stdout is byte-identical to before this phase; a
 * downgrade without a `regrade` reason fills the SAME slot with the ONE mark token, so
 * the round prints exactly one more line. The mark never becomes a finding, never
 * enters the carrier, and never moves the conclusion.
 */
describe("P37 T5 — the capsule summary slot carries the downgrade mark", () => {
  /** The prior round's blocker — the scenario the new grade is compared against. */
  const PRIOR_BLOCKER = {
    id: "F1",
    severity: "blocker",
    summary: "drift",
    impact: { scenario: "an empty wave key → no task mirrored → expected a refusal" },
  };

  /** Seed one completed review round's carrier into the fixture line. */
  const seedReview = (
    f: Fixture,
    cycle: number,
    findings: readonly Record<string, unknown>[],
  ): void => {
    f.scene.ledger.persistHandoff(
      "review",
      "wave",
      { tasks: "1", round: cycle },
      { findings: [...findings] },
    );
    f.scene.ledger.recordRound("1", {
      op: "review",
      cycle,
      verdict: { treeClean: true, targetAction: true },
    });
  };

  /** The review frame of one cycle — the fixture's standing line key. */
  const reviewOf = (cycle: number): OpenFrame => ({
    ...reviewFrame,
    round: cycle,
    params: { tasks: "1", round: cycle, attempt: 1 },
  });

  /** The capsule lines of one outcome — the SAME emit the session lifecycle calls, so
   *  the `summary` slot's byte is the displayed byte. */
  const capsuleOf = (outcome: DispatchOutcome): readonly string[] =>
    new Capsule(new Words()).emit(
      outcome.status ?? "",
      "handoff.json",
      null,
      false,
      outcome.dispositionsSummary,
    );

  it("prints one extra line for a downgrade with no reason — never a finding, never a new entry", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      seedReview(f, 1, [PRIOR_BLOCKER]);
      const runner = new ReviewDraftRunner(
        [{ id: "F1", severity: "warn", lens: "standards", summary: "drift" }],
        "tasks-1-review-2.json",
      );
      const { outcome } = await dispatchFrame(f, reviewOf(2), runner);
      // the mark rides the ONE summary slot
      expect(outcome.status).toBe("REVIEW_FIX");
      expect(outcome.dispositionsSummary).toBe(REGRADE_MARK);
      const lines = capsuleOf(outcome);
      expect(lines).toHaveLength(2);
      expect(lines[1]).toBe(REGRADE_MARK);
      // display only: the carrier holds the child's ONE finding, no synthetic row
      const carrier = outcome.carrier as { findings: { severity?: string }[] };
      expect(carrier.findings).toHaveLength(1);
      expect(outcome.findings).toHaveLength(1);
      // the conclusion is the warn's own rollup, not a mark-driven failure
      expect(outcome.status).toBe("REVIEW_FIX");
    } finally {
      f.cleanup();
    }
  });

  it("prints the stated reason on the same slot — a carried `regrade` speaks instead of the mark", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      seedReview(f, 1, [PRIOR_BLOCKER]);
      const runner = new ReviewDraftRunner(
        [
          {
            id: "F1",
            severity: "warn",
            lens: "standards",
            summary: "drift",
            regrade: "the consumed bytes do not move",
          },
        ],
        "tasks-1-review-2.json",
      );
      const { outcome } = await dispatchFrame(f, reviewOf(2), runner);
      // the reason rides the ONE summary slot, exactly where the mark would
      expect(outcome.dispositionsSummary).toBe("the consumed bytes do not move");
      const lines = capsuleOf(outcome);
      expect(lines).toHaveLength(2);
      expect(lines[1]).toBe("the consumed bytes do not move");
      // still display only: no synthetic finding, no mark
      expect(outcome.dispositionsSummary).not.toBe(REGRADE_MARK);
      expect(outcome.findings).toHaveLength(1);
    } finally {
      f.cleanup();
    }
  });

  it("keeps the stated reason on ONE capsule line even when it carries a line break", async () => {
    const cases: readonly (readonly [string, string])[] = [
      ["first line\nsecond line", "first line second line"],
      ["the bytes · the bytes stay", "the bytes; the bytes stay"],
    ];
    for (const [regrade, expected] of cases) {
      const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
      try {
        seedReview(f, 1, [PRIOR_BLOCKER]);
        const runner = new ReviewDraftRunner(
          [{ id: "F1", severity: "warn", lens: "standards", summary: "drift", regrade }],
          "tasks-1-review-2.json",
        );
        const { outcome } = await dispatchFrame(f, reviewOf(2), runner);
        // one line, one token: the reason is folded before the wording is composed
        expect(outcome.dispositionsSummary, regrade).toBe(expected);
        const lines = capsuleOf(outcome);
        expect(lines, regrade).toHaveLength(2);
        expect(lines[1], regrade).toBe(expected);
        expect(
          lines.every((line) => !line.includes("\n")),
          regrade,
        ).toBe(true);
      } finally {
        f.cleanup();
      }
    }
  });

  it("stays byte-identical when the grade did not drop or the earlier row had no scenario", async () => {
    const cases: readonly (readonly [string, readonly Record<string, unknown>[]])[] = [
      ["unchanged grade", [{ id: "F1", severity: "blocker", lens: "standards", summary: "drift" }]],
      [
        "no earlier scenario",
        [{ id: "F1", severity: "warn", lens: "standards", summary: "drift" }],
      ],
    ];
    for (const [label, current] of cases) {
      const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
      try {
        const prior =
          label === "no earlier scenario"
            ? [{ ...PRIOR_BLOCKER, impact: undefined }]
            : [PRIOR_BLOCKER];
        seedReview(f, 1, prior);
        const runner = new ReviewDraftRunner(current, "tasks-1-review-2.json");
        const { outcome } = await dispatchFrame(f, reviewOf(2), runner);
        expect(outcome.dispositionsSummary, label).toBeUndefined();
        expect(capsuleOf(outcome), label).toHaveLength(1);
      } finally {
        f.cleanup();
      }
    }
  });

  it("keeps the mark when the current round omits or rewrites its scenario", async () => {
    for (const current of [
      { id: "F1", severity: "warn", lens: "standards", summary: "drift" },
      {
        id: "F1",
        severity: "warn",
        lens: "standards",
        summary: "drift",
        impact: { scenario: "a fresh sentence" },
      },
    ]) {
      const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
      try {
        seedReview(f, 1, [PRIOR_BLOCKER]);
        const runner = new ReviewDraftRunner([current], "tasks-1-review-2.json");
        const { outcome } = await dispatchFrame(f, reviewOf(2), runner);
        expect(outcome.dispositionsSummary).toBe(REGRADE_MARK);
      } finally {
        f.cleanup();
      }
    }
  });

  it("prints the mark for a key-2 downgrade — same fixture, same criterion, one extra line", async () => {
    const scenario = "an empty wave key → no task mirrored → expected a refusal";
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      seedReview(f, 1, [{ id: "F1", severity: "blocker", summary: "drift", impact: { scenario } }]);
      // the summary is re-worded; the scenario is the earlier row's, verbatim
      const runner = new ReviewDraftRunner(
        [
          {
            id: "F1",
            severity: "warn",
            lens: "standards",
            summary: "the wave brief mirrors no task",
            impact: { scenario },
          },
        ],
        "tasks-1-review-2.json",
      );
      const { outcome } = await dispatchFrame(f, reviewOf(2), runner);
      // both display faces read the same criterion: the board cell and this capsule line
      // lose their mark together the moment the second key goes
      expect(outcome.dispositionsSummary).toBe(REGRADE_MARK);
      expect(capsuleOf(outcome)).toHaveLength(2);
      expect(capsuleOf(outcome)[1]).toBe(REGRADE_MARK);
      // still display only — no synthetic row, one finding, the warn's own conclusion
      expect(outcome.findings).toHaveLength(1);
      expect(outcome.status).toBe("REVIEW_FIX");
    } finally {
      f.cleanup();
    }
  });

  it("pairs across a findings-free implement record — the nearest non-empty review is the reference", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      seedReview(f, 1, [PRIOR_BLOCKER]);
      // a clean implement round sits between the two reviews: its projection is empty,
      // so reading "the previous record" would find nothing and drop the mark
      f.scene.ledger.recordRound("1", {
        op: "implement",
        cycle: 2,
        verdict: { treeClean: true, targetAction: true },
      });
      const runner = new ReviewDraftRunner(
        [{ id: "F1", severity: "warn", lens: "standards", summary: "drift" }],
        "tasks-1-review-3.json",
      );
      const { outcome } = await dispatchFrame(f, reviewOf(3), runner);
      expect(outcome.dispositionsSummary).toBe(REGRADE_MARK);
    } finally {
      f.cleanup();
    }
  });

  it("prints nothing on a first review round — no earlier findings, no reference", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const runner = new ReviewDraftRunner(
        [{ id: "F1", severity: "warn", lens: "standards", summary: "drift" }],
        "tasks-1-review-1.json",
      );
      const { outcome } = await dispatchFrame(f, reviewFrame, runner);
      expect(outcome.dispositionsSummary).toBeUndefined();
      expect(capsuleOf(outcome)).toHaveLength(1);
    } finally {
      f.cleanup();
    }
  });
});

/**
 * P37 T6 — the pin gate's two read-back corpora (design spec §7.1 · §7.2). Both are
 * judged in `#reconstruct` BEFORE `conclusionOf`, so ONE rollup reads them, the
 * outcome's findings project them and `#materialize` persists them. The pairs:
 *
 *   · the judged document's own body — a clean document injects nothing and keeps its
 *     conclusion; one dead pin adds exactly one warn and lands the round on
 *     `REVIEW_FIX` (never a `CDD_BLOCKED` refusal);
 *   · a finding's `contract.path` — resolvable adds nothing; dead adds one warn, the
 *     carrier and the conclusion agreeing row for row (an injection at the writer
 *     would leave `status` the child's while the carrier carried the extra row).
 */
describe("P37 T6 — the pin read-back corpora inject real warn findings", () => {
  /** The judged document — a spec body the round reads from `frame.target.doc`. */
  const writeDoc = (f: Fixture, body: readonly string[]): string => {
    const at = path.join(
      f.scene.workspace.root.repoRoot,
      "docs",
      "kairos",
      "specs",
      "s1-design.md",
    );
    mkdirSync(path.dirname(at), { recursive: true });
    writeFileSync(at, body.join("\n"), "utf8");
    return at;
  };

  /** The doc review frame on one document — the doc shapes differ only in the word
   *  `type` carries (`kind: "spec"` names the flag channel for all three). */
  const docReviewOf = (
    doc: string,
    type: "phase-spec" | "overall" | "single-spec" = "phase-spec",
  ): OpenFrame => ({
    type,
    phase: "review",
    round: 1,
    target: { kind: "spec", doc },
    params: { round: 1, attempt: 1 },
    key: type,
  });

  /** One review round over a document, with the child's own findings. */
  const runDocReview = async (
    f: Fixture,
    doc: string,
    findings: readonly Record<string, unknown>[],
    type: "phase-spec" | "overall" | "single-spec" = "phase-spec",
  ): Promise<DispatchOutcome> =>
    (
      await dispatchFrame(
        f,
        docReviewOf(doc, type),
        new ReviewDraftRunner(findings, `${type}-review-1.json`),
      )
    ).outcome;

  it("a clean judged document injects nothing and keeps its conclusion", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      // both pins resolve in THIS fixture: the seed file and the plan document
      const doc = writeDoc(f, ["# spec", "", "- `seed.txt`", "- `docs/kairos/plans/p30.md`"]);
      const outcome = await runDocReview(f, doc, []);
      expect(outcome.findings).toEqual([]);
      expect(outcome.status).toBe("APPROVED");
      expect(f.io.stderrText).not.toContain("CDD_BLOCKED");
    } finally {
      f.cleanup();
    }
  });

  it("one dead pin in the judged document adds exactly one warn and lands the round on REVIEW_FIX", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const doc = writeDoc(f, ["# spec", "", "- `docs/kairos/specs/absent-design.md`"]);
      const outcome = await runDocReview(f, doc, []);
      expect(outcome.findings).toHaveLength(1);
      expect(outcome.findings?.[0]?.severity).toBe("warn");
      expect(outcome.findings?.[0]?.summary).toContain("docs/kairos/specs/absent-design.md");
      // a warn is a real finding: it rolls up, so the round is REVIEW_FIX — never the
      // APPROVED it would have declared with no findings at all
      expect(outcome.status).toBe("REVIEW_FIX");
      // and never a refusal: no CDD_BLOCKED line, no fourth conclusion
      expect(f.io.stderrText).not.toContain("CDD_BLOCKED");
      // the injected row is persisted with the child's rows, keyed by the engine
      const carrier = outcome.carrier as { findings: { id?: string; lens?: string }[] };
      expect(carrier.findings).toHaveLength(1);
      expect(carrier.findings[0]?.lens).toBe("consistency");
      expect(carrier.findings[0]?.id).toBe("F1");
    } finally {
      f.cleanup();
    }
  });

  it("a resolvable `contract.path` adds nothing — a dead one adds one warn and no refusal", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const doc = writeDoc(f, ["# spec"]);
      const resolved = await runDocReview(f, doc, [
        {
          severity: "nit",
          lens: "standards",
          summary: "wording",
          contract: { path: "seed.txt", anchor: "§1" },
        },
      ]);
      expect(resolved.findings).toHaveLength(1);
      expect(resolved.findings?.[0]?.severity).toBe("nit");
    } finally {
      f.cleanup();
    }
    const g = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const doc = writeDoc(g, ["# spec"]);
      const dead = await runDocReview(g, doc, [
        {
          severity: "nit",
          lens: "standards",
          summary: "wording",
          contract: { path: "docs/kairos/specs/absent-design.md", anchor: "§1" },
        },
      ]);
      // display-only would leave ONE row; the read-back injects a real warn
      expect(dead.findings).toHaveLength(2);
      expect(dead.findings?.[1]?.severity).toBe("warn");
      expect(dead.findings?.[1]?.summary).toContain("docs/kairos/specs/absent-design.md");
      expect(g.io.stderrText).not.toContain("CDD_BLOCKED");
      // one conclusion, one carrier: the injected row is counted by the same rollup
      expect(dead.status).toBe("REVIEW_FIX");
      const carrier = dead.carrier as { findings: unknown[] };
      expect(carrier.findings).toHaveLength(2);
      expect(dead.findings).toHaveLength(carrier.findings.length);
    } finally {
      g.cleanup();
    }
  });

  it("the conclusion reads the injected rows — an injection at the writer would print APPROVED over a warn carrier", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const doc = writeDoc(f, ["# spec", "", "- `docs/kairos/specs/absent-design.md`"]);
      const outcome = await runDocReview(f, doc, []);
      const carrier = outcome.carrier as { findings: { severity: string }[] };
      // the round's status IS the rollup of the rows the carrier holds — judged before
      // the write, so the two can never disagree
      expect(outcome.status).toBe(new HandoffSchema().rollup(carrier.findings));
      expect(outcome.status).not.toBe("APPROVED");
    } finally {
      f.cleanup();
    }
  });

  /** The lens the carrier's injected row actually carries — the projection the child's
   *  prompt never writes. */
  const injectedLensOf = (outcome: DispatchOutcome, at: number): string | undefined =>
    (outcome.carrier as { findings: { lens?: string }[] }).findings[at]?.lens;

  it("carries the judged face's own lens — a charter round never injects the spec body's word", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const doc = writeDoc(f, ["# charter", "", "- `docs/kairos/specs/absent-design.md`"]);
      const outcome = await runDocReview(f, doc, [], "overall");
      // `consistency` belongs to the narrative spec body's menu; the charter's own menu
      // is scope | inventory | dependency | acceptance | boundary, so the row reads as
      // the inventory drift between the charter and the tree
      expect(injectedLensOf(outcome, 0)).toBe("inventory");
      expect(REVIEWS.overall.lensEnum).toContain(injectedLensOf(outcome, 0));
      // a real warn either way: it rolls up, so the round still lands on REVIEW_FIX
      expect(outcome.status).toBe("REVIEW_FIX");
      expect(f.io.stderrText).not.toContain("CDD_BLOCKED");
    } finally {
      f.cleanup();
    }
  });

  it("carries the task face's lens on a wave round — the `contract.path` corpus is not spec-only", async () => {
    const f = fixture(planDoc([[1, [CHANGE_ROW]]]));
    try {
      const { outcome } = await dispatchFrame(
        f,
        reviewFrame,
        new ReviewDraftRunner([
          {
            severity: "nit",
            lens: "standards",
            summary: "wording",
            contract: { path: "docs/kairos/specs/absent-design.md", anchor: "§1" },
          },
        ]),
      );
      // row 0 is the child's own; row 1 is the engine's injection
      expect(injectedLensOf(outcome, 1)).toBe("standards");
      expect(REVIEWS.wave.lensEnum).toContain(injectedLensOf(outcome, 1));
    } finally {
      f.cleanup();
    }
  });
});

/**
 * P37 T7 — §7.3's time face at the CALL SITE. `#contractPinRows` hands `PinAudit` the
 * judged document for the spec / plan faces and `null` for wave / branch, so one
 * fixture reads both directions: the pending `Create:` path of the judged document's own
 * plan injects nothing, and the same path on a wave round injects one warn.
 */
describe("P37 T7 — the pin time face reads the judged identity at the call site", () => {
  /** A path a plan declares and the tree has not landed. */
  const PENDING = "packages/cdd-engine/src-next/pending/forward.ts";

  /** The plan that declares the pending path under the spec's own `slug:`. */
  const pendingPlan = (slug: string, declares: boolean): string =>
    [
      "---",
      "doc-type: plan",
      `slug: ${slug}`,
      "version: v0.1",
      "---",
      "",
      "### Task 1: the declared work",
      "",
      "#### Files",
      ...(declares ? [`- Create: \`${PENDING}\``] : []),
      "- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`",
      "",
      "#### DependsOn",
      "none",
      "",
    ].join("\n");

  /** The judged spec — the same `slug:`, and no `program:`: its plan's declaration is
   *  the closing boundary (§7.3 condition ③'s declaration-bounded arm). */
  const writeSpec = (f: Fixture): string => {
    const at = path.join(
      f.scene.workspace.root.repoRoot,
      "docs",
      "kairos",
      "specs",
      "s1-design.md",
    );
    mkdirSync(path.dirname(at), { recursive: true });
    writeFileSync(
      at,
      ["---", "doc-type: phase-spec", "slug: s1", "version: v0.1", "---", "", "# spec", ""].join(
        "\n",
      ),
      "utf8",
    );
    return at;
  };

  /** The child's own row — its `contract.path` is the corpus under judgment. */
  const FINDING = {
    severity: "nit",
    lens: "standards",
    summary: "wording",
    contract: { path: PENDING, anchor: "§1" },
  };

  const specReviewOf = (doc: string): OpenFrame => ({
    type: "phase-spec",
    phase: "review",
    round: 1,
    target: { kind: "spec", doc },
    params: { round: 1, attempt: 1 },
    key: "phase-spec",
  });

  it("injects nothing when the judged document's own plan declares the absent path", async () => {
    const f = fixture(pendingPlan("s1", true));
    try {
      const { outcome } = await dispatchFrame(
        f,
        specReviewOf(writeSpec(f)),
        new ReviewDraftRunner([FINDING], "phase-spec-review-1.json"),
      );
      // the child's row only: a pending declaration is not a dead pin. The nit itself
      // still rolls the round to REVIEW_FIX — what the skip removes is the SECOND row
      expect(outcome.findings).toHaveLength(1);
      expect(outcome.status).toBe("REVIEW_FIX");
      expect((outcome.carrier as { findings: unknown[] }).findings).toHaveLength(1);
    } finally {
      f.cleanup();
    }
  });

  it("injects one warn on a wave round — `null` judged has no subject for the declaration", async () => {
    const f = fixture(pendingPlan("s1", true));
    try {
      const { outcome } = await dispatchFrame(
        f,
        reviewFrame,
        new ReviewDraftRunner([FINDING], "tasks-1-review-1.json"),
      );
      // one conclusion, one carrier: the injected row is counted by the same rollup
      expect(outcome.findings).toHaveLength(2);
      expect(outcome.findings?.[1]?.severity).toBe("warn");
      expect(outcome.findings?.[1]?.summary).toContain(PENDING);
      expect(outcome.status).toBe("REVIEW_FIX");
      expect(f.io.stderrText).not.toContain("CDD_BLOCKED");
    } finally {
      f.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P40 T5 — the face holds no pre-dispatch judgment: one ask (the seam) per dispatch
// ---------------------------------------------------------------------------

/** The retired names — the three public entries, the private machinery that served only
 *  them, and the artifact cell the gates shared. Zero hits in the face, by file. */
const RETIRED_FACE_NAMES: readonly string[] = [
  "carrierRefusal",
  "artifactRefusal",
  "inputRefusal",
  "inputRefusalOf",
  "artifactRefusalOf",
  "artifactCellOf",
  "artifactReadOf",
  "requesterDigest",
  "rulingsInputOf",
  "answeredByNaming",
  "rowsOf",
  "snapshotOf",
  "snapshotReadOf",
  "firstRowOf",
  "RowJudgment",
  "NO_ARTIFACT",
  "ArtifactCell",
  "artifact-reads",
];

describe("P40 T5 — the dispatch face judges nothing", () => {
  it("asks the four-row judgment ZERO times — the seam's verdict is the only ask", async () => {
    const judge = vi.spyOn(PreFlightRows, "judge");
    const f = fixture(planDoc([[1, []]]));
    try {
      writeEvidence(f, "1");
      await dispatch(f, "1");
      // One dispatch, one ask — and the ask is the SEAM's (pinned in the session suite
      // and in the preview loop). A face-side count would be the second source of truth
      // this round removed.
      expect(judge).not.toHaveBeenCalled();
    } finally {
      judge.mockRestore();
      f.cleanup();
    }
  });

  it("carries no gate entry, no gate machinery and no gate-branch seal — the file's shape", () => {
    const face = stripComments(
      readFileSync(fileURLToPath(new URL("../lifecycle.ts", import.meta.url)), "utf8"),
    );
    for (const name of RETIRED_FACE_NAMES) {
      expect(face.includes(name), `${name} is still on the face`).toBe(false);
    }
    // The three surviving seal sites, by SPELLING: the definition pair plus the two
    // frame-shaped terminals the retired gates never owned (the lost-lock dispatch and
    // the death face) — the abort fold seals through the `…Of` twin.
    const frameSeals = face.split("\n").filter((line) => line.includes("#sealRoundCarriers("));
    expect(frameSeals).toHaveLength(3);
    expect(face.match(/#sealRoundCarriersOf\(/g)).toHaveLength(3);
    // The composed record's ONE write point and ONE read point — `#valuesOf` derives
    // nothing, so a second `this.#values` would be a second producer.
    expect(face.match(/this\.#values\b/g)).toHaveLength(2);
    expect(face).not.toContain("values?:");
  });
});
