// packages/cdd-engine/src-next/session/__tests__/notes-channel.test.ts
// P42 T3 — the `notes` carrying face (design spec §2.1 · §2.2). The carrier's `notes`
// slot stops being declared-but-unread: the board's row token reports `notes +M` and
// the wave line's next brief prints the rows, while the judgment face stays blind to
// them (a note changes no conclusion, owes no disposition, crosses no line).
//
// Three groups, one per seam:
//   · the CARRIER's projection — one read, one parse, two consumers; the engine's own
//     three sentence families dropped by a byte prefix, the child's rows kept verbatim;
//   · the DISPLAY faces — the board token (count + folded rows, appended after the
//     downgrade note) and the brief section (after the `## Constraints` mirror, never
//     inside `taskBody`);
//   · the SOFT channel — the engine's sentences leave `carrier.notes`, print one
//     `CDD_WARN:` line and land on the derived `contractViolationCount`.
//
// Zero module-level bare functions — the helpers are `const` (the repository's
// zero-`function`-declaration discipline).

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TestDispatchValues } from "../../__tests__/support/dispatch-values.ts";
import { planSourceOf } from "../../__tests__/support/plan-source.ts";
import { PlanDocType } from "../../contract/doc.ts";
import { Contract } from "../../contract/judge.ts";
import { BoardView, LineCarriers } from "../../face/board-view.ts";
import type { RunInput, WorkScene } from "../../face/cli.ts";
import { CliGate } from "../../face/gate.ts";
import { type CliIo, CliLifecycle, type DispatchScene } from "../../face/lifecycle.ts";
import type { ChildOutcome, ChildRun, ChildRunner } from "../../face/termination.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { RepoRoot } from "../../infra/root.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { BriefRenderer } from "../../render/brief.ts";
import { targetFaces } from "../faces.ts";
import { TaskGraph } from "../graph.ts";
import { Ledger, type RoundRecord, RoundViolation } from "../ledger.ts";
import { ArtifactRegistry } from "../round-artifacts.ts";
import { Lifecycle, type OpenFrame } from "../run.ts";

/** One carrier fixture on disk — the bytes the read face parses. */
const writeCarrier = (at: string, payload: Readonly<Record<string, unknown>>): string => {
  mkdirSync(path.dirname(at), { recursive: true });
  writeFileSync(at, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return at;
};

/** One round record fixture — the identity + verdict the aggregation reads. */
const record = (over: Partial<RoundRecord> = {}): RoundRecord => ({
  op: "review",
  cycle: 1,
  attempt: 1,
  dispatchBase: null,
  verdict: { treeClean: true, targetAction: true },
  violations: [],
  ...over,
});

/** The board token of one line's records, with each record's carrier path supplied out
 *  of band — exactly the shape the ledger accessor answers in production. `notes` is the
 *  PRINTING face: absent (the default, the shipped board) the token stops at the
 *  `notes +M` count, and `--notes` appends the same folded rows at the same position. */
const token = (
  records: readonly RoundRecord[],
  paths: readonly string[],
  notes = false,
): string => {
  const byRecord = new Map(records.map((one, index) => [one, paths[index] ?? ""]));
  return BoardView.summaryCell(
    records,
    LineCarriers.of(records, (one) => byRecord.get(one) ?? ""),
    { notes },
  );
};

/** The same token with `--notes` open — the troubleshooting face's bytes. */
const expanded = (records: readonly RoundRecord[], paths: readonly string[]): string =>
  token(records, paths, true);

const ENGINE_DECORATIVE =
  "dropped decorative draft field(s) outside their declared shape: dispositions — never written";
const ENGINE_RESERVED =
  "dropped non-declared draft field(s): findings — engine-reserved, never written";
const ENGINE_ARTIFACT_REPORT =
  "artifact report: declared path /r deviates from the prescribed x — the canonical path is booked";
const ENGINE_ARTIFACT_EVIDENCE =
  "artifact test_evidence: declared path /t deviates from the prescribed y — the canonical path is booked";

describe("P42 §2.1 — the carrier's notes projection", () => {
  const dirs: string[] = [];

  /** One scratch carrier directory per arm. */
  const scratch = (): string => {
    const dir = mkdtempSync(path.join(tmpdir(), "notes-channel-"));
    dirs.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("reads a note off the carrier's own slot — `notes +1`, and the pair reads zero at zero", () => {
    const carrier = writeCarrier(path.join(scratch(), "tasks-1-review-1.json"), {
      findings: [],
      notes: ["the brief's Constraints mirror repeats the plan"],
    });
    // the shipped board prints the COUNT alone — the body is one flag away
    const folded = token([record()], [carrier]);
    expect(folded).toBe("review 1 ✓ notes +1");
    expect(folded).not.toContain("Constraints");
    expect(expanded([record()], [carrier])).toBe(
      "review 1 ✓ notes +1; the brief's Constraints mirror repeats the plan",
    );
    const bare = writeCarrier(path.join(scratch(), "tasks-1-review-1.json"), { findings: [] });
    expect(token([record()], [bare])).toBe("review 1 ✓");
  });

  it("reads a WORK carrier that declares no findings at all — the notes slot alone", () => {
    // The early exit used to require a findings array, so a docs-fix round's note (the
    // engine's own `else BLOCKED + the reason in notes` instruction to the child) read
    // as zero. The pair is the round type, not the reading: a work record and a review
    // record carrying the same note read the same count.
    const fix = writeCarrier(path.join(scratch(), "tasks-1-fix-1.json"), {
      status: "APPROVED",
      notes: ["the doc's §3 row was left alone"],
    });
    expect(token([record({ op: "fix" })], [fix])).toBe("fix 1 ✓ notes +1");
    expect(expanded([record({ op: "fix" })], [fix])).toBe(
      "fix 1 ✓ notes +1; the doc's §3 row was left alone",
    );
    const review = writeCarrier(path.join(scratch(), "tasks-1-review-1.json"), {
      findings: [],
      notes: ["the doc's §3 row was left alone"],
    });
    expect(token([record()], [review])).toBe("review 1 ✓ notes +1");
    expect(expanded([record()], [review])).toBe(
      "review 1 ✓ notes +1; the doc's §3 row was left alone",
    );
  });

  it("counts per TOKEN, not per line — a review and a fix carrier with one note each read `+1` apiece", () => {
    const reviewCarrier = writeCarrier(path.join(scratch(), "tasks-1-review-1.json"), {
      findings: [],
      notes: ["review-side observation"],
    });
    const fixCarrier = writeCarrier(path.join(scratch(), "tasks-1-fix-1.json"), {
      status: "APPROVED",
      notes: ["fix-side observation"],
    });
    const line = [record(), record({ op: "fix" })];
    expect(token(line, [reviewCarrier, fixCarrier])).toBe("review 1 ✓ notes +1 · fix 1 ✓ notes +1");
    expect(expanded(line, [reviewCarrier, fixCarrier])).toBe(
      "review 1 ✓ notes +1; review-side observation · fix 1 ✓ notes +1; fix-side observation",
    );
    // the pair: both notes on ONE carrier count on that carrier's token alone
    const merged = writeCarrier(path.join(scratch(), "tasks-1-review-2.json"), {
      findings: [],
      notes: ["review-side observation", "fix-side observation"],
    });
    expect(token([record()], [merged])).toBe("review 1 ✓ notes +2");
    expect(expanded([record()], [merged])).toBe(
      "review 1 ✓ notes +2; review-side observation; fix-side observation",
    );
  });

  it("counts every row of the token's run — a merged success token sums its carriers", () => {
    const first = writeCarrier(path.join(scratch(), "tasks-1-review-1.json"), {
      findings: [],
      notes: ["one"],
    });
    const second = writeCarrier(path.join(scratch(), "tasks-1-review-2.json"), {
      findings: [],
      notes: ["two", "three"],
    });
    // the success face merges into ONE token whose `run` is both records
    expect(token([record(), record({ cycle: 2 })], [first, second])).toBe("review 2 ✓ notes +3");
    expect(expanded([record(), record({ cycle: 2 })], [first, second])).toBe(
      "review 2 ✓ notes +3; one; two; three",
    );
  });

  it("appends the notes segment AFTER the downgrade note — the verified join order never moves", () => {
    const prior = writeCarrier(path.join(scratch(), "tasks-1-review-1.json"), {
      findings: [
        {
          severity: "blocker",
          lens: "spec",
          summary: "same defect",
          impact: { scenario: "a legal input → a wrong result → expected the contract" },
        },
      ],
    });
    const current = writeCarrier(path.join(scratch(), "tasks-1-review-2.json"), {
      findings: [{ severity: "warn", lens: "spec", summary: "same defect" }],
      notes: ["a child observation"],
    });
    // the segment ORDER is the folded token's too: the downgrade note and `+N` sit
    // where they always sat, and the notes segment still closes the token
    expect(token([record(), record({ cycle: 2 })], [prior, current])).toBe(
      "review 2 ✓+2 downgraded without a regrade reason notes +1",
    );
    expect(expanded([record(), record({ cycle: 2 })], [prior, current])).toBe(
      "review 2 ✓+2 downgraded without a regrade reason notes +1; a child observation",
    );
  });

  it("folds a note for DISPLAY only — ` · ` becomes `; `, a break becomes one space, the carrier keeps its bytes", () => {
    const raw = "first line\nsecond · third    fourth";
    const carrier = writeCarrier(path.join(scratch(), "tasks-1-review-1.json"), {
      findings: [],
      notes: [raw],
    });
    const cell = expanded([record()], [carrier]);
    expect(cell).toBe("review 1 ✓ notes +1; first line second; third fourth");
    // the pair: the folded default never prints the body at all
    expect(token([record()], [carrier])).toBe("review 1 ✓ notes +1");
    // one line, one token, one segment — the fold is the display face's alone
    expect(cell).not.toContain("\n");
    const stored = JSON.parse(readFileSync(carrier, "utf8")) as { notes: string[] };
    expect(stored.notes).toEqual([raw]);
  });

  it("drops the engine's three note families by their byte prefixes", () => {
    const child = "the child's own observation";
    // the p24 shape: two engine artifact sentences plus three child notes ⇒ three rows
    const carrier = writeCarrier(path.join(scratch(), "tasks-1-review-1.json"), {
      findings: [],
      notes: [
        ENGINE_ARTIFACT_REPORT,
        ENGINE_ARTIFACT_EVIDENCE,
        child,
        "second child note",
        "third child note",
      ],
    });
    expect(token([record()], [carrier])).toBe("review 1 ✓ notes +3");
    expect(expanded([record()], [carrier])).toBe(
      "review 1 ✓ notes +3; the child's own observation; second child note; third child note",
    );
    // the two decorative families are the same judgment — a carrier holding both and
    // nothing else reads zero
    const enginesOnly = writeCarrier(path.join(scratch(), "tasks-1-review-2.json"), {
      findings: [],
      notes: [ENGINE_DECORATIVE, ENGINE_RESERVED],
    });
    expect(token([record()], [enginesOnly])).toBe("review 1 ✓");
  });

  it("is a byte PREFIX, not a substring — the same words mid-sentence stay a child's note", () => {
    const carrier = writeCarrier(path.join(scratch(), "tasks-1-review-1.json"), {
      findings: [],
      notes: ["the engine wrote: dropped non-declared draft field(s): findings"],
    });
    expect(token([record()], [carrier])).toBe("review 1 ✓ notes +1");
    expect(expanded([record()], [carrier])).toBe(
      "review 1 ✓ notes +1; the engine wrote: dropped non-declared draft field(s): findings",
    );
  });
});

/** The plan text a wave brief renders from — one task block plus the Constraints
 *  mirror the notes section must land after. */
const PLAN_TEXT = [
  "# P42 notes fixture",
  "",
  "### Task 1: the fixture task",
  "",
  "#### Files",
  "",
  "- Create: `a.ts`",
  "",
  "#### Steps",
  "",
  "- write it — checkable: `a.ts` exists",
  "",
  "### Task 2: the second fixture task",
  "",
  "#### Files",
  "",
  "- Create: `b.ts`",
  "",
  "#### Steps",
  "",
  "- write it too — checkable: `b.ts` exists",
  "",
  "## Constraints",
  "",
  "- keep the mirror whole",
  "",
].join("\n");

const parsedPlan = () => new PlanDocType("plan").parse(PLAN_TEXT.split("\n"));

describe("P42 §2.1 — the brief's notes section", () => {
  it("renders no section at zero notes — the brief's bytes are unchanged", () => {
    const renderer = new BriefRenderer();
    const body = renderer.taskBody(PLAN_TEXT, parsedPlan(), [1]);
    expect(renderer.render(PLAN_TEXT, parsedPlan(), [1])).toBe(
      `${body}\n\n## Constraints\n\n- keep the mirror whole\n`,
    );
    expect(renderer.render(PLAN_TEXT, parsedPlan(), [1])).not.toContain("## Notes");
  });

  it("appends the notes section AFTER the Constraints mirror and leaves `taskBody` untouched", () => {
    const renderer = new BriefRenderer();
    const rendered = renderer.render(PLAN_TEXT, parsedPlan(), [1], ["a note", "another note"]);
    const at = (needle: string): number => rendered.indexOf(needle);
    expect(at("## Constraints")).toBeGreaterThan(-1);
    expect(at("## Notes")).toBeGreaterThan(at("## Constraints"));
    expect(at("a note")).toBeGreaterThan(at("## Notes"));
    expect(at("another note")).toBeGreaterThan(at("a note"));
    // the reviewed-brief hash reads `taskBody` alone: adding notes moves none of it
    expect(renderer.taskBody(PLAN_TEXT, parsedPlan(), [1])).toBe(
      new BriefRenderer().taskBody(PLAN_TEXT, parsedPlan(), [1]),
    );
    expect(renderer.taskBody(PLAN_TEXT, parsedPlan(), [1])).not.toContain("a note");
    // the notes are the carrier's bytes verbatim — no bullet, no rewrite
    expect(rendered).toContain("## Notes\na note\nanother note\n");
  });
});

interface WaveFixture {
  readonly repoRoot: string;
  readonly workspace: Workspace;
  readonly ledger: Ledger;
  readonly cleanup: () => void;
}

/** A hermetic repo + workspace with one wave row — the brief's source is the ledger's
 *  own records, so the fixture seeds them through the ledger's public writer. */
const waveFixture = (): WaveFixture => {
  const repoRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "notes-brief-")));
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "notes@test"],
    ["config", "user.name", "notes-test"],
  ]) {
    spawnSync("git", args, { cwd: repoRoot });
  }
  writeFileSync(path.join(repoRoot, ".gitignore"), ".kairos\n", "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
  const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p42").ensure();
  const ledger = new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis));
  return {
    repoRoot,
    workspace,
    ledger,
    cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
  };
};

/** The gate's brief render over a fixture scene — the runtime cells `renderBrief`
 *  reads are the workspace, the ledger and the parsed tasks, so the narrow object is
 *  the honest fixture shape (no second scene assembler is on offer for a brief). */
const renderWaveBrief = (f: WaveFixture, tasks: string): string => {
  const gate = new CliGate();
  const scene = { workspace: f.workspace, ledger: f.ledger } as unknown as WorkScene;
  const parsed = { args: { tasks } } as unknown as RunInput;
  return gate.renderBrief(scene, parsed, PLAN_TEXT, parsedPlan());
};

describe("P42 §2.1 — the wave brief's source is the line's LAST completed REVIEW carrier", () => {
  const fixtures: WaveFixture[] = [];
  afterEach(() => {
    for (const f of fixtures.splice(0)) f.cleanup();
  });

  /** One line's carrier + record — the derived name the ladder resolves. */
  const seedRound = (
    f: WaveFixture,
    over: { op: "review" | "fix"; cycle: number; key?: string; notes: readonly string[] },
  ): void => {
    const key = over.key ?? "1";
    const name = `tasks-${key}-${over.op}-${over.cycle}.json`;
    writeCarrier(path.join(f.workspace.path, name), { findings: [], notes: over.notes });
    f.ledger.recordRound(key, {
      op: over.op,
      cycle: over.cycle,
      verdict: { treeClean: true, targetAction: true },
    });
  };

  it("prints the review round's note and ignores a later fix round's", () => {
    const f = waveFixture();
    fixtures.push(f);
    seedRound(f, { op: "review", cycle: 1, notes: ["the review's observation"] });
    seedRound(f, { op: "fix", cycle: 1, notes: ["the fix's observation"] });
    const brief = readFileSync(renderWaveBrief(f, "1"), "utf8");
    expect(brief).toContain("the review's observation");
    expect(brief).not.toContain("the fix's observation");
    // the source is the LAST completed review round when several exist
    seedRound(f, { op: "review", cycle: 2, notes: ["the newer review's observation"] });
    const newer = readFileSync(renderWaveBrief(f, "1"), "utf8");
    expect(newer).toContain("the newer review's observation");
  });

  it("crosses no line — another wave row's note never reaches this brief", () => {
    const f = waveFixture();
    fixtures.push(f);
    seedRound(f, { op: "review", cycle: 1, key: "2", notes: ["wave 2's observation"] });
    const brief = readFileSync(renderWaveBrief(f, "1"), "utf8");
    expect(brief).not.toContain("wave 2's observation");
    expect(brief).not.toContain("## Notes");
    // the pair: the SAME carrier read on its own line does print
    expect(readFileSync(renderWaveBrief(f, "2"), "utf8")).toContain("wave 2's observation");
  });

  it("is a wave-line face — a doc row's carrier is not a candidate", () => {
    const f = waveFixture();
    fixtures.push(f);
    writeCarrier(path.join(f.workspace.path, "phase-spec-review-1.json"), {
      findings: [],
      notes: ["the spec review's observation"],
    });
    f.ledger.recordRound("phase-spec", { op: "review", cycle: 1 });
    const brief = readFileSync(renderWaveBrief(f, "1"), "utf8");
    expect(brief).not.toContain("the spec review's observation");
    expect(brief).not.toContain("## Notes");
  });

  it("reads through the board's own projection — an engine-only note never prints", () => {
    const f = waveFixture();
    fixtures.push(f);
    seedRound(f, {
      op: "review",
      cycle: 1,
      notes: [ENGINE_ARTIFACT_REPORT, "a child observation"],
    });
    const brief = readFileSync(renderWaveBrief(f, "1"), "utf8");
    expect(brief).toContain("a child observation");
    expect(brief).not.toContain("artifact report: declared path");
  });
});

// ---------------------------------------------------------------------------
// the SOFT channel — the engine's sentences leave `carrier.notes` (spec §2.2)
// ---------------------------------------------------------------------------

class CaptureIo implements CliIo {
  stdoutText = "";
  stderrText = "";

  stdout = (text: string): void => {
    this.stdoutText += text;
  };

  stderr = (text: string): void => {
    this.stderrText += text;
  };
}

/** The child stand-in: lands one draft and one commit (the implement criterion's fact). */
class DraftRunner implements ChildRunner {
  readonly calls: ChildRun[] = [];
  readonly #draft: string;
  readonly #workspace: string;

  constructor(draft: Readonly<Record<string, unknown>>, workspace: string) {
    this.#draft = JSON.stringify(draft);
    this.#workspace = workspace;
  }

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    writeFileSync(path.join(this.#workspace, "tasks-1-implement-1.json"), this.#draft, "utf8");
    writeFileSync(path.join(run.cwd, "child-work.txt"), "work\n", "utf8");
    spawnSync("git", ["add", "-A"], { cwd: run.cwd });
    spawnSync("git", ["commit", "-q", "-m", "the round's work"], { cwd: run.cwd });
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

interface DispatchFixture {
  readonly scene: DispatchScene;
  readonly repoRoot: string;
  readonly io: CaptureIo;
  readonly runner: DraftRunner;
  readonly cleanup: () => void;
}

/** The hermetic wave scene — the evidence sidecar the implement round owes is written
 *  so the round's only observation is the notes/soft face under test. */
const dispatchFixture = (draft: Readonly<Record<string, unknown>>): DispatchFixture => {
  const repoRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "notes-soft-")));
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "notes@test"],
    ["config", "user.name", "notes-test"],
  ]) {
    spawnSync("git", args, { cwd: repoRoot });
  }
  writeFileSync(path.join(repoRoot, ".gitignore"), ".kairos\n", "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
  const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p42").ensure();
  const ledger = new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis));
  writeCarrier(path.join(workspace.path, "tasks-1-implement-1-test-evidence.json"), {
    command: "pnpm exec vitest run",
    exit_code: 0,
    passed: true,
    warnings_count: 0,
    typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
  });
  return {
    scene: {
      workspace,
      ledger,
      planPath: null,
      plan: planSourceOf(workspace.root.basis).readFor(null),
      briefPath: null,
      baseBranch: "develop",
    },
    repoRoot,
    io: new CaptureIo(),
    runner: new DraftRunner(draft, workspace.path),
    cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
  };
};

const implementFrame: OpenFrame = {
  type: "wave",
  phase: "implement",
  round: 1,
  target: { kind: "wave", tasks: [1] },
  params: { tasks: "1", round: 1, attempt: 1 },
  key: "1",
  attempt: 1,
};

/** A plan document over one task block — the task face's run state. */
const PLAN_DOC = [
  "---",
  "title: Notes Channel",
  "doc-type: plan",
  "version: v1.0",
  "date: 2026-11-22",
  "slug: p42-notes",
  "---",
  "",
  "## Constraints",
  "",
  "- delta",
  "",
  "### Task 1: task 1",
  "- **DependsOn**: none",
  "",
].join("\n");

interface CountFixture {
  readonly repoRoot: string;
  readonly ledger: Ledger;
  readonly graph: TaskGraph;
  readonly plan: ReturnType<ReturnType<typeof planSourceOf>["readFor"]>;
  readonly cleanup: () => void;
}

/** A hermetic ledger + the one-task graph the derived-count arm advances over. */
const countFixture = (): CountFixture => {
  const repoRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "notes-count-")));
  const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p42").ensure();
  return {
    repoRoot,
    ledger: new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis)),
    graph: new TaskGraph(new PlanDocType("plan").parse(PLAN_DOC.split("\n"))),
    plan: planSourceOf(new RepoRoot(repoRoot)).readFor(null),
    cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
  };
};

describe("P42 §2.2 — the engine's own sentences ride the soft channel", () => {
  it("leaves `carrier.notes` to the child, prints ONE `CDD_WARN:` line, and books one soft row", async () => {
    const f = dispatchFixture({
      status: "APPROVED",
      artifacts: {
        report: ".kairos/cdd/p42/tasks-1-implement-1-report.md",
        test_evidence: ".kairos/cdd/p42/tasks-1-implement-1-test-evidence.json",
      },
      phase: "implement",
      notes: ["the child's own observation"],
    });
    try {
      const dispatch = new CliLifecycle({
        contract: new Contract(),
        scene: f.scene,
        artifacts: new ArtifactRegistry(),
        io: f.io,
        sync: f.runner,
        host: "claude",
        values: TestDispatchValues.of(f.scene, implementFrame),
      });
      const outcome = await dispatch.step()(implementFrame);
      expect(outcome.status).toBe("APPROVED");
      // the non-declared key is the engine's sentence — the carrier's notes carry the
      // child's rows alone, verbatim
      expect((outcome.carrier?.notes as readonly string[]) ?? []).toEqual([
        "the child's own observation",
      ]);
      const soft = (outcome.violations ?? []).filter((violation) => violation.grade === "soft");
      expect(soft.map((violation) => violation.message)).toEqual([
        "dropped non-declared draft field(s): phase — engine-reserved, never written",
      ]);
      // one stderr line, one `CDD_WARN:` station
      const lines = f.io.stderrText.split("\n").filter((line) => line.length > 0);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^CDD_WARN: /);
      // the verdict, the status and the tree fact stay untouched by a soft row
      expect(outcome.verdict).toEqual({ treeClean: true, targetAction: true });
    } finally {
      f.cleanup();
    }
  });

  it("the derived `contractViolationCount` sums the round's soft rows", async () => {
    // The derivation reads the RECORD the session lifecycle books (`session/run.ts`
    // copies the outcome's graded set verbatim), so the arm drives that bookkeep with
    // the engine's own soft sentence shape.
    const f = countFixture();
    try {
      const dirty = new Lifecycle({
        face: targetFaces.wave,
        state: f.graph,
        ledger: f.ledger,
        plan: f.plan,
        dispatch: async () => ({
          status: "APPROVED",
          verdict: { treeClean: true, targetAction: true },
          violations: [RoundViolation.soft(ENGINE_RESERVED)],
        }),
      });
      expect(await dirty.advance()).not.toBeNull();
      expect(f.ledger.counterOf("contractViolationCount")).toBe(1);
      // the pair: a clean round leaves the count where it was
      const clean = new Lifecycle({
        face: targetFaces.wave,
        state: f.graph,
        ledger: f.ledger,
        plan: f.plan,
        dispatch: async () => ({
          status: "APPROVED",
          verdict: { treeClean: true, targetAction: true },
          violations: [],
        }),
      });
      await clean.advance();
      expect(f.ledger.counterOf("contractViolationCount")).toBe(1);
    } finally {
      f.cleanup();
    }
  });
});
