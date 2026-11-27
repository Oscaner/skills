// packages/cdd-engine/src/run/ledger/__tests__/ledger.test.ts
// The fact layer's pins.
//
// Six groups of facts are pinned here, one per recorded thing the ledger owns: the round
// identity's injectivity · the wave line's closure and its historical snapshot · the
// document line's `doc_hash` and its batch · the reviewed version's drift read · the
// artifact identity's derived name and refused duplicate · the rulings and re-grades. Then
// the two carrier-side faces: the carrier-integrity line (one spelling, two readers) and the
// artifact read (four states, one source). Finally the observation and orphan faces, and the
// slice's own boundary — `run/ledger` imports no later segment and touches no filesystem.
//
// Every case drives a real `Workspace` over a temp git tree: "all records land through
// `env.workspace`" is only a fact if the writes are the workspace's own.

import { spawnSync } from "node:child_process";
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
import { RepoRoot } from "../../../env/paths/root.ts";
import { WorkspaceRoot } from "../../../env/workspace/workspace.ts";
import { ArtifactReads } from "../artifact-reads.ts";
import { ArtifactIdentity, Artifacts } from "../artifacts.ts";
import { CarrierLine, CarrierMismatchError } from "../carrier-line.ts";
import { RoundIdentity } from "../identity.ts";
import { Ledger, type RoundRecord } from "../ledger.ts";
import { ReviewedIdentity } from "../reviewed.ts";
import { Rulings } from "../rulings.ts";

/** The `src`-relative directory this file pins. */
const LEDGER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** A fixed clock — the workspace's injected one (the ledger reads no clock itself). */
const FIXED_NOW = 1_700_000_000_000;

/** The temp repos this file made, removed after every case. */
const created: string[] = [];

/** A temp directory initialised as a git working tree. */
const tempRepo = (prefix: string): string => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  created.push(directory);
  spawnSync("git", ["init", "-q"], { cwd: directory });
  return directory;
};

/** One ledger over a temp repo's `p9` workspace, with the workspace listing injected. */
const fixture = () => {
  const repo = tempRepo("ledger-");
  const workspace = new WorkspaceRoot({
    basis: RepoRoot.of(repo),
    now: () => FIXED_NOW,
    baseName: "base.json",
  }).at("p9");
  const names = (): readonly string[] =>
    existsSync(workspace.path) ? readdirSync(workspace.path) : [];
  const artifacts = new Artifacts();
  return { repo, workspace, names, artifacts, ledger: new Ledger({ workspace, names, artifacts }) };
};

/** One round's verdict — the completion flag the crash predicate reads. */
const verdict = (targetAction: boolean) => ({ treeClean: targetAction, targetAction });

/** One hard violation — the crash predicate's second cell. */
const hard = (cause: string) => ({ grade: "hard" as const, cause, message: `${cause} happened` });

afterEach(() => {
  for (const directory of created.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("the round identity", () => {
  it("keys one cell per (line, op, cycle, attempt) and never doubles a re-record", () => {
    const { ledger } = fixture();
    ledger.recordRound("tasks-1", { op: "implement", cycle: 1, attempt: 1 });
    ledger.recordRound("tasks-1", {
      op: "implement",
      cycle: 1,
      attempt: 1,
      carrierDigest: "d0",
    });
    const same = ledger.rounds("tasks-1");
    // The same coordinate twice is ONE cell — the second record replaced the first.
    expect(same).toHaveLength(1);
    expect(same[0]?.carrierDigest).toBe("d0");
    // A different attempt is a different round.
    ledger.recordRound("tasks-1", { op: "implement", cycle: 1, attempt: 2 });
    expect(ledger.rounds("tasks-1")).toHaveLength(2);
    // A different cycle is a different round too, and the order is the round sequence.
    ledger.recordRound("tasks-1", { op: "implement", cycle: 2, attempt: 1 });
    expect(ledger.rounds("tasks-1").map((record) => record.cycle)).toEqual([1, 1, 2]);
  });

  it("gives four different coordinates four different keys", () => {
    const base = { line: "tasks-1", op: "implement", cycle: 1, attempt: 1 } as const;
    const keys = [
      new RoundIdentity(base),
      new RoundIdentity({ ...base, op: "review" }),
      new RoundIdentity({ ...base, cycle: 2 }),
      new RoundIdentity({ ...base, attempt: 2 }),
    ].map((identity) => identity.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("refuses a coordinate outside the declared vocabulary", () => {
    expect(() => new RoundIdentity({ line: "", op: "implement", cycle: 1, attempt: 1 })).toThrow(
      /empty line/,
    );
    expect(
      () => new RoundIdentity({ line: "tasks-1", op: "wat" as never, cycle: 1, attempt: 1 }),
    ).toThrow(/not a declared round op/);
    expect(
      () => new RoundIdentity({ line: "tasks-1", op: "implement", cycle: 0, attempt: 1 }),
    ).toThrow(/positive integer/);
  });
});

describe("the wave line", () => {
  it("answers no snapshot while open and the recorded set once closed — written once", () => {
    const { ledger } = fixture();
    ledger.recordRound("tasks-1,2", { op: "implement", cycle: 1, attempt: 1 });
    expect(ledger.waveLines()[0]?.planTasks).toBeNull();
    expect(ledger.planTasksOf("tasks-1,2")).toBeNull();
    ledger.closeWave("tasks-1,2", [1, 2]);
    expect(ledger.planTasksOf("tasks-1,2")).toEqual([1, 2]);
    // The snapshot is historical: a later closure never rewrites it.
    ledger.closeWave("tasks-1,2", [1, 2, 3]);
    expect(ledger.planTasksOf("tasks-1,2")).toEqual([1, 2]);
    expect(ledger.waveLines()[0]?.taskIds).toEqual([1, 2]);
  });

  it("keeps the three line kinds apart", () => {
    const { ledger } = fixture();
    ledger.recordRound("tasks-1", { op: "implement", cycle: 1, attempt: 1 });
    ledger.recordRound("plan", { op: "review", cycle: 1, attempt: 1 });
    ledger.recordRound("branch", { op: "review", cycle: 1, attempt: 1 });
    expect(ledger.waveLines().map((line) => line.line)).toEqual(["tasks-1"]);
    expect(ledger.docLines().map((line) => line.line)).toEqual(["plan"]);
    expect(ledger.branchLine()?.line).toBe("branch");
  });
});

describe("the document review line", () => {
  it("carries the reviewed digest and increments its batch per review", () => {
    const { ledger, workspace } = fixture();
    ledger.recordDocReview("phase-spec", "the body as reviewed");
    const first = ledger.docLines()[0];
    expect(first?.docHash).toBe(ReviewedIdentity.hashOf("the body as reviewed"));
    expect(first?.batch).toBe(1);
    // The SECOND review hands over DIFFERENT bytes: `doc_hash` is the newest reviewed
    // version (each review rewrites it, frozen between reviews), so the drift read answers
    // against v2 — a write-once cell would keep answering against v1.
    ledger.recordDocReview("phase-spec", "the body as re-reviewed");
    const second = ledger.docLines()[0];
    expect(second?.batch).toBe(2);
    expect(second?.docHash).toBe(ReviewedIdentity.hashOf("the body as re-reviewed"));
    expect(ledger.docDriftOf("phase-spec", "the body as re-reviewed")).toBe("same");
    expect(ledger.docDriftOf("phase-spec", "the body as reviewed")).toBe("drift");
    // The row's own persisted cell IS the digest — one fact, one home, in the frozen
    // document's reviewed-revision cell. The frozen cell's own basis is sha1: the engine
    // that shipped before this tree digested with sha1 and compares a 40-hex cell against
    // its own sha1, so a record written on another basis would read as a moved document on
    // that engine's next run.
    const raw = JSON.parse(readFileSync(workspace.resolve(Ledger.FILE), "utf8"));
    expect(raw.waves[0].reviewedRevision.doc_hash).toBe(
      ReviewedIdentity.hashOf("the body as re-reviewed"),
    );
    expect(raw.waves[0].reviewedRevision.doc_hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("moves the version a fix produced without opening a review batch", () => {
    const { ledger } = fixture();
    ledger.recordDocReview("phase-spec", "the body as reviewed");
    // A fix edits the document it judges: the recorded version follows its bytes, but the
    // line's review-batch counter counts reviews — one review plus one fix is ONE batch.
    ledger.recordReviewedDoc("phase-spec", "the body after the fix");
    const line = ledger.docLines()[0];
    expect(line?.docHash).toBe(ReviewedIdentity.hashOf("the body after the fix"));
    expect(line?.batch).toBe(1);
    expect(ledger.docDriftOf("phase-spec", "the body after the fix")).toBe("same");
  });

  it("answers `same` for the reviewed bytes and `drift` once the document moved", () => {
    const { ledger } = fixture();
    ledger.recordDocReview("plan", "plan v1");
    expect(ledger.docDriftOf("plan", "plan v1")).toBe("same");
    expect(ledger.docDriftOf("plan", "plan v2")).toBe("drift");
    // An unrecorded line lands no judgment at all — absent facts stay absent.
    expect(ledger.docDriftOf("overall", "anything")).toBeNull();
  });

  it("records the version a wave line reviewed and reads it back", () => {
    const { ledger } = fixture();
    const reviewed = ReviewedIdentity.record(
      "brief",
      "docs/kairos/plans/p39.md",
      "task-only bytes",
    );
    ledger.recordReviewed("tasks-7,8,9", reviewed);
    expect(ledger.reviewedOf("tasks-7,8,9")?.sameAs(reviewed)).toBe(true);
    expect(ledger.reviewedOf("tasks-7,8,9")?.driftFrom("task-only bytes")).toBe("same");
    expect(ledger.reviewedOf("tasks-7,8,9")?.driftFrom("edited")).toBe("drift");
    expect(ledger.reviewedOf("tasks-1")).toBeNull();
  });
});

describe("the frozen progress document", () => {
  /** One round record, as the shipped engine's document holds it. */
  const round = (op: "implement" | "review" | "fix"): RoundRecord => ({
    op,
    cycle: 1,
    attempt: 1,
    dispatchBase: null,
    verdict: verdict(true),
    violations: [],
    carrierDigest: null,
  });

  /** The document the shipped engine writes — what every consumer workspace holds and what
   *  the corpus fixtures declare. */
  const frozen = () => ({
    plan: "docs/kairos/plans/p9.md",
    timeoutCount: 0,
    engineSelfWrittenCount: 2,
    engineRecoveryCount: 0,
    harnessAbortCount: 0,
    waves: [
      {
        wave: "1",
        rounds: [round("implement"), round("review")],
        reviewedRevision: {
          kind: "brief-revision",
          plan: "docs/kairos/plans/p9.md",
          brief_hash: "cafe",
        },
        planTasks: [1],
      },
      { wave: "branch", rounds: [round("review")] },
    ],
  });

  it("reads the rows, rounds and cells the shipped engine wrote", () => {
    // A reader of its own shape would answer null here and reset the history of every legal
    // tree — the wave key is the task GROUP, so the row folds back to the line word.
    const { ledger, workspace } = fixture();
    workspace.writeJson(Ledger.FILE, frozen());
    const document = ledger.read();
    expect(document?.engineSelfWrittenCount).toBe(2);
    expect(ledger.waveLines().map((line) => line.line)).toEqual(["tasks-1"]);
    expect(ledger.waveLines()[0]?.taskIds).toEqual([1]);
    expect(ledger.waveLines()[0]?.rounds.map((entry) => entry.op)).toEqual(["implement", "review"]);
    expect(ledger.planTasksOf("tasks-1")).toEqual([1]);
    expect(ledger.nodeRecordsOf(document)).toHaveLength(3);
    expect(ledger.branchLine()?.line).toBe("branch");
    // A digest of another algorithm is no comparable version — null, never a fabricated
    // drift against this engine's own hash.
    expect(ledger.reviewedOf("tasks-1")).toBeNull();
  });

  it("compares a recorded revision on the cell's own digest basis", () => {
    // The cell is frozen, so its ALGORITHM is the contract: a 40-hex cell is a sha1 and a
    // 64-hex cell a sha256. A reader that can only compare its own basis answers "no
    // recorded version" for every digest the shipped engine wrote, which reads a moved
    // document as a closed line (the wrong `next:` face) and a moved projection as no
    // drift.
    const body = "the reviewed body\n";
    const moved = `${body}\nan edit landed after the review\n`;
    for (const basis of ["sha1", "sha256"] as const) {
      const { ledger, workspace } = fixture();
      workspace.writeJson(Ledger.FILE, {
        ...frozen(),
        waves: [
          {
            wave: "phase-spec",
            rounds: [round("review")],
            reviewedRevision: {
              kind: "doc-revision",
              doc: "docs/kairos/specs/p9.md",
              doc_hash: ReviewedIdentity.hashOf(body, basis),
            },
          },
          // The wave line's cell is the same question about a projection: the ONE brief-drift
          // read behind the wave's reopen compares on the recorded basis too.
          {
            wave: "1",
            rounds: [round("review")],
            reviewedRevision: {
              kind: "brief-revision",
              plan: "docs/kairos/plans/p9.md",
              brief_hash: ReviewedIdentity.hashOf(body, basis),
            },
          },
        ],
      });
      expect(ledger.reviewedOf("phase-spec")?.basis).toBe(basis);
      expect(ledger.docDriftOf("phase-spec", body)).toBe("same");
      expect(ledger.docDriftOf("phase-spec", moved)).toBe("drift");
      expect(ledger.reviewedOf("tasks-1")?.basis).toBe(basis);
      expect(ledger.reviewedOf("tasks-1")?.driftFrom(body)).toBe("same");
      expect(ledger.reviewedOf("tasks-1")?.driftFrom(moved)).toBe("drift");
    }
  });

  it("folds the legacy `rounds` planes the shipped engine folds", () => {
    // The frozen document declares three `rounds` shapes and the shipped reader folds all
    // of them: a record array, a per-mode cycle array and a per-mode cycle count. A reader
    // that spreads the container it never validated raises on a legal document.
    const expected = [
      { op: "implement", cycle: 1, attempt: 1 },
      { op: "review", cycle: 1, attempt: 1 },
      { op: "review", cycle: 2, attempt: 1 },
    ];
    const legacyForms = [
      { implement: [1], review: [1, 2] },
      { implement: 1, review: 2 },
    ];
    for (const rounds of legacyForms) {
      const { ledger, workspace } = fixture();
      workspace.writeJson(Ledger.FILE, {
        ...frozen(),
        waves: [{ wave: "1", rounds, planTasks: [1] }],
      });
      const records = ledger.waveLines()[0]?.rounds ?? [];
      expect(records.map(({ op, cycle, attempt }) => ({ op, cycle, attempt }))).toEqual(expected);
      // One fold, every reader: the crash read walks the same records rather than meeting a
      // container it cannot index.
      const nodeRecords = ledger.nodeRecordsOf(ledger.read());
      expect(nodeRecords.map((record) => `${record.op}${record.cycle}`)).toEqual([
        "implement1",
        "review1",
        "review2",
      ]);
      expect(ledger.crashedOf(nodeRecords)).toEqual([]);
    }
  });

  it("keeps a record cell this tree does not declare when it rewrites the document", () => {
    // A consumer document's record carries cells THIS tree never writes: the shipped engine
    // stamps the fix a later round superseded (`supersededBy`) and older documents name the
    // round's own carrier path. `read()` is what every writer persists, so a fold that rebuilds
    // a record to the seven declared cells deletes them from the document's only copy — and the
    // shipped engine then reads that superseded round as current.
    const { ledger, workspace } = fixture();
    const stamped = {
      ...round("fix"),
      supersededBy: { op: "fix", cycle: 2, attempt: 1 },
      carrierPath: ".kairos/cdd/p9/tasks-1-fix-1-a1.c1.json",
    };
    workspace.writeJson(Ledger.FILE, {
      ...frozen(),
      waves: [{ wave: "1", rounds: [round("implement"), stamped] }],
    });
    // A write of a cell UNRELATED to the rounds: the wave's plan-task snapshot.
    ledger.closeWave("tasks-1", [1]);
    const raw = JSON.parse(readFileSync(workspace.resolve(Ledger.FILE), "utf8"));
    expect(raw.waves[0].planTasks).toEqual([1]);
    expect(raw.waves[0].rounds).toEqual([round("implement"), stamped]);
  });

  it("writes the document back in the frozen shape, on the frozen row key", () => {
    const { ledger, workspace } = fixture();
    workspace.writeJson(Ledger.FILE, frozen());
    ledger.recordRound("tasks-1", { op: "fix", cycle: 1, attempt: 1 });
    const raw = JSON.parse(readFileSync(workspace.resolve(Ledger.FILE), "utf8"));
    // The container and the fixed counter set survive: this tree adds a cell, it never
    // rewrites the document's shape.
    expect(Object.keys(raw).sort()).toEqual([
      "engineRecoveryCount",
      "engineSelfWrittenCount",
      "harnessAbortCount",
      "plan",
      "timeoutCount",
      "waves",
    ]);
    expect(raw.engineSelfWrittenCount).toBe(2);
    // One line, one row: the round lands on the row the read resolved, never a second row
    // keyed by the line word.
    expect(raw.waves.map((row: { wave: string }) => row.wave)).toEqual(["1", "branch"]);
    expect(ledger.rounds("tasks-1").map((entry) => entry.op)).toEqual([
      "implement",
      "review",
      "fix",
    ]);
  });
});

describe("the artifact identity", () => {
  it("derives the name from the four cells and reads the identity back off it", () => {
    const round = new RoundIdentity({ line: "tasks-1", op: "implement", cycle: 1, attempt: 2 });
    const final = new ArtifactIdentity(round, "final");
    expect(final.name).toBe("tasks-1-implement-1-a2.c1.json");
    expect(ArtifactIdentity.nameOf(round, "draft")).toBe("tasks-1-implement-1-a2.json");
    expect(ArtifactIdentity.nameOf(round, "rulings")).toBe(
      "tasks-1-implement-1-a2.c1.rulings.json",
    );
    const read = ArtifactIdentity.attribute(final.name);
    expect(read?.round.key).toBe(round.key);
    expect(read?.kind).toBe("final");
    // A name no kind renders attributes to nothing — an observation, never a refusal.
    expect(ArtifactIdentity.attribute("notes.md")).toBeNull();
  });

  it("reads a legacy cycle-less name's LINE and KIND without inventing an identity", () => {
    // The engine that shipped before this tree minted carriers with no cycle segment. No
    // round identity can name one (a cycle is required), but its kind still attributes — the
    // observation face classifies by this answer, so a legacy report is an attachment and a
    // legacy carrier pair still reaches the claim judgment.
    expect(ArtifactIdentity.attribute("tasks-1,3-implement-report.md")).toBeNull();
    expect(ArtifactIdentity.lineAndKindOf("tasks-1,3-implement-report.md")).toEqual({
      line: "tasks-1,3",
      kind: "report",
    });
    expect(ArtifactIdentity.lineAndKindOf("tasks-1,3-implement.json")).toEqual({
      line: "tasks-1,3",
      kind: "draft",
    });
    // A name no kind renders, and a name whose tail is not a round artifact at all.
    expect(ArtifactIdentity.lineAndKindOf("scratch")).toBeNull();
    expect(ArtifactIdentity.lineAndKindOf("notes.md")).toBeNull();
    // The cycle-bearing form answers the same LINE, and a tag that disagrees with the stem
    // belongs to no identity.
    expect(ArtifactIdentity.lineAndKindOf("tasks-1-implement-2.c2.json")).toEqual({
      line: "tasks-1",
      kind: "final",
    });
    expect(ArtifactIdentity.lineAndKindOf("tasks-1-implement-2.c3.json")).toBeNull();
  });

  it("refuses a second registration of one artifact", () => {
    const artifacts = new Artifacts();
    const round = new RoundIdentity({ line: "branch", op: "review", cycle: 1, attempt: 1 });
    artifacts.register(round, "final");
    expect(() => artifacts.register(round, "final")).toThrow(/already registered/);
    expect(artifacts.names()).toEqual(["branch-review-1.c1.json"]);
    // A different kind of the same round is its own artifact.
    expect(artifacts.register(round, "report").name).toBe("branch-review-1-report.md");
  });
});

describe("the prescribed write set", () => {
  it("names the draft, the report and only the evidence a work round prescribes", () => {
    const { ledger } = fixture();
    // A wave's implement round: the child's draft, the report and the test-evidence file.
    expect(ledger.writeSetOf("tasks-1", "implement", 1, 1)).toEqual([
      ".kairos/cdd/p9/tasks-1-implement-1.json",
      ".kairos/cdd/p9/tasks-1-implement-1-report.md",
      ".kairos/cdd/p9/tasks-1-implement-1-test-evidence.json",
    ]);
    // A review round prescribes no evidence file…
    expect(ledger.writeSetOf("tasks-1", "review", 1, 1)).toEqual([
      ".kairos/cdd/p9/tasks-1-review-1.json",
      ".kairos/cdd/p9/tasks-1-review-1-report.md",
    ]);
    // …and neither does a work round on a DOCUMENT line: the phase-spec fix writes two
    // files, so the shape is the line's as much as the op's.
    expect(ledger.writeSetOf("phase-spec", "fix", 1, 1)).toEqual([
      ".kairos/cdd/p9/phase-spec-fix-1.json",
      ".kairos/cdd/p9/phase-spec-fix-1-report.md",
    ]);
    // The carrier is the DRAFT name every time; a later attempt keeps its own segment.
    expect(ledger.writeSetOf("tasks-1", "implement", 1, 2)[0]).toBe(
      ".kairos/cdd/p9/tasks-1-implement-1-a2.json",
    );
  });

  it("states a round's ledger row in the document's own spelling", () => {
    // The row key and the container cell are the document's, so a sentence about the write
    // and the write itself cannot name two rows.
    expect(Ledger.rowCoordinateOf("tasks-1,2")).toBe('progress.waves["1,2"]');
    expect(Ledger.rowCoordinateOf("phase-spec")).toBe('progress.waves["phase-spec"]');
    expect(Ledger.rowCoordinateOf("branch")).toBe('progress.waves["branch"]');
  });
});

describe("the rulings and re-grades", () => {
  it("lands a ruling and reads it back", () => {
    const { ledger } = fixture();
    ledger.recordRuling("phase-spec", {
      finding: "F1",
      verdict: "fixed",
      ruling: "the guard now runs",
    });
    const read = ledger.rulingsOf("phase-spec").of("F1");
    expect(read?.verdict).toBe("fixed");
    expect(read?.ruling).toBe("the guard now runs");
    // One finding, one ruling: the second supersedes, it never stacks.
    ledger.recordRuling("phase-spec", {
      finding: "F1",
      verdict: "rejected",
      ruling: "the review misread the call",
      probe: "npm test -- --filter guard",
    });
    expect(ledger.rulingsOf("phase-spec").rulings()).toHaveLength(1);
    expect(ledger.rulingsOf("phase-spec").of("F1")?.probe).toBe("npm test -- --filter guard");
  });

  it("keeps both ends of a re-grade and refuses one that states no reason", () => {
    const { ledger } = fixture();
    ledger.recordRegrade("phase-spec", {
      finding: "F2",
      from: "blocker",
      to: "warn",
      reason: "the acceptance sentence is stated but no consumer byte moves",
    });
    expect(ledger.rulingsOf("phase-spec").regradeOf("F2")).toEqual({
      finding: "F2",
      from: "blocker",
      to: "warn",
      reason: "the acceptance sentence is stated but no consumer byte moves",
    });
    expect(() =>
      ledger.recordRegrade("phase-spec", { finding: "F2", from: "warn", to: "warn", reason: "no" }),
    ).toThrow(/keeps the warn grade/);
    expect(() =>
      ledger.recordRegrade("phase-spec", {
        finding: "F3",
        from: "blocker",
        to: "warn",
        reason: " ",
      }),
    ).toThrow(/states no reason/);
  });

  it("refuses a rejected ruling with no probe, and a sidecar with one bad row", () => {
    expect(() =>
      Rulings.empty().record({ finding: "F1", verdict: "rejected", ruling: "no" }),
    ).toThrow(/owes a probe/);
    const ids = new Set(["F1", "F2"]);
    const good = JSON.stringify({ rulings: [{ finding: "F1", verdict: "fixed", ruling: "ok" }] });
    expect(Rulings.read(good, "c.json", ids).kind).toBe("ok");
    const unknownKey = JSON.stringify({
      rulings: [{ finding: "F1", verdict: "fixed", ruling: "ok", x: 1 }],
    });
    expect(Rulings.read(unknownKey, "c.json", ids)).toMatchObject({ kind: "invalid" });
    const phantom = JSON.stringify({
      rulings: [{ finding: "F9", verdict: "fixed", ruling: "ok" }],
    });
    expect(Rulings.read(phantom, "c.json", ids)).toMatchObject({
      kind: "invalid",
      reason: expect.stringContaining("not a finding of the carrier"),
    });
    expect(Rulings.read(null, "c.json", ids)).toEqual({ kind: "absent" });
  });
});

describe("the carrier line", () => {
  it("composes the thrown message and the flat facts from one spelling", () => {
    const recorded = CarrierLine.digestOf({ status: "APPROVED", findings: [] });
    const current = CarrierLine.digestOf({ status: "BLOCKED", findings: [] });
    const error = new CarrierMismatchError({ line: "p9/x.json", recorded, current });
    const facts = error.facts();
    // The message IS the line: two readers, one spelling, byte-identical.
    expect(error.message).toBe(CarrierLine.of(facts));
    expect(error.message).toBe(
      `carrier-mismatch · line=p9/x.json · recorded=${recorded.slice(0, 8)} · current=${current.slice(0, 8)}`,
    );
  });

  it("reads a carrier three ways: absent, unchecked and mismatched", () => {
    const digest = CarrierLine.digestOf({ findings: [] });
    expect(CarrierLine.read(null, "x.json", digest)).toBeNull();
    expect(CarrierLine.read('{"findings": []}', "x.json", null)).toBe('{"findings": []}');
    expect(() => CarrierLine.read('{"findings": []}', "x.json", "0".repeat(64))).toThrow(
      CarrierMismatchError,
    );
  });
});

describe("the artifact read", () => {
  /** One review round on a document line, with its carrier written beside it. */
  const reviewFixture = () => {
    const fixtureOf = fixture();
    const carrierRound = new RoundIdentity({
      line: "phase-spec",
      op: "review",
      cycle: 1,
      attempt: 1,
    });
    const carrierName = ArtifactIdentity.nameOf(carrierRound, "final");
    const carrier = { findings: [{ id: "F1", severity: "blocker", summary: "the guard" }] };
    fixtureOf.workspace.writeJson(carrierName, carrier);
    const digest = CarrierLine.digestOf(carrier);
    const reads = new ArtifactReads({
      artifacts: fixtureOf.artifacts,
      source: {
        names: fixtureOf.names,
        readText: (target) => {
          const read = fixtureOf.workspace.readText(target);
          return read.kind === "text" ? read.value : null;
        },
        relOf: (name) => fixtureOf.workspace.relOf(name),
      },
    });
    const carrierRef = { path: fixtureOf.workspace.relOf(carrierName), digest };
    return { ...fixtureOf, carrierRound, carrierName, reads, carrierRef };
  };

  it("answers `absent` when the rendered name holds nothing", () => {
    const { reads, carrierRound, carrierRef } = reviewFixture();
    expect(reads.read(carrierRound, "rulings", carrierRef)).toEqual({ kind: "absent" });
  });

  it("answers `ok` with the rulings a conforming sidecar carries", () => {
    const { reads, workspace, carrierRound, carrierRef } = reviewFixture();
    workspace.writeJson("phase-spec-review-1.c1.rulings.json", {
      carrier: "phase-spec-review-1.c1.json",
      rulings: [{ finding: "F1", verdict: "fixed", ruling: "fixed at the door" }],
    });
    const read = reads.read(carrierRound, "rulings", carrierRef);
    expect(read.kind).toBe("ok");
    if (read.kind !== "ok") throw new Error("unreachable");
    expect(read.rulings[0]?.finding).toBe("F1");
  });

  it("answers `misplaced` when a second name attributes to the same artifact", () => {
    const { reads, workspace, carrierRound, carrierRef } = reviewFixture();
    // The sidecar without its `.c<cycle>` tag is the same ARTIFACT written under a second
    // name — the rendered name is the only legal spelling, so this is not a read of either.
    workspace.writeJson("phase-spec-review-1.rulings.json", { rulings: [] });
    const read = reads.read(carrierRound, "rulings", carrierRef);
    expect(read.kind).toBe("misplaced");
    if (read.kind !== "misplaced") throw new Error("unreachable");
    expect(read.names).toEqual([".kairos/cdd/p9/phase-spec-review-1.rulings.json"]);
  });

  it("answers `invalid` rather than half a value: a violated sidecar and a tampered carrier", () => {
    const { reads, workspace, carrierRound, carrierRef } = reviewFixture();
    workspace.writeJson("phase-spec-review-1.c1.rulings.json", {
      carrier: "another.json",
      rulings: [],
    });
    expect(reads.read(carrierRound, "rulings", carrierRef)).toMatchObject({ kind: "invalid" });
    // The tampered carrier folds into `invalid` carrying the ONE carrier line.
    workspace.writeJson("phase-spec-review-1.c1.rulings.json", { rulings: [] });
    const tampered = { ...carrierRef, digest: "0".repeat(64) };
    const read = reads.read(carrierRound, "rulings", tampered);
    expect(read.kind).toBe("invalid");
    if (read.kind !== "invalid") throw new Error("unreachable");
    expect(read.reason.startsWith("carrier-mismatch · line=")).toBe(true);
  });
});

describe("the orphan face", () => {
  it("lists an unclaimed name, spares a claimed carrier, and answers empty with no index", () => {
    const { ledger, workspace, artifacts, names } = fixture();
    // A claimed carrier: the record's own identity renders its name and the file is there.
    ledger.recordRound("tasks-1", { op: "implement", cycle: 1, attempt: 1, carrierDigest: "d0" });
    workspace.writeJson("tasks-1-implement-1.c1.json", { status: "APPROVED" });
    // An unclaimed draft — a carrier on disk the ledger never booked.
    workspace.writeJson("tasks-2-implement-1.json", { status: "APPROVED" });
    // A name no kind renders at all — tier (i) of the judgment.
    workspace.writeJson("notes.md", { anything: true });
    expect(ledger.orphanHandoffs()).toEqual(["notes.md", "tasks-2-implement-1.json"]);
    // A ledger with no artifact index answers the empty set: attribution is the index's.
    expect(new Ledger({ workspace, names }).orphanHandoffs()).toEqual([]);
    expect(artifacts.names()).toEqual([]);
  });

  it("spares a legacy cycle-less row its own artifacts and claims a carrier a record remembers", () => {
    const { ledger, workspace } = fixture();
    // A cycle-less record: the carrier path an older engine wrote is the file it wrote, and
    // the ledger answers THAT (step ①), not a name its identity would derive.
    const recorded = `${workspace.path}/tasks-1-implement.json`;
    ledger.recordRound("tasks-1", { op: "implement", cycle: 1, attempt: 1 });
    const row = JSON.parse(readFileSync(`${workspace.path}/progress.json`, "utf8")) as {
      waves: { rounds: Record<string, unknown>[] }[];
    };
    (row.waves[0]?.rounds[0] as Record<string, unknown>).carrierPath = recorded;
    writeFileSync(`${workspace.path}/progress.json`, `${JSON.stringify(row, null, 2)}\n`, "utf8");
    workspace.writeJson("tasks-1-implement.json", { status: "APPROVED" });
    workspace.writeText("tasks-1-implement-report.md", "# report\n");
    expect(ledger.orphanHandoffs()).toEqual([]);
    const record = ledger.rounds("tasks-1")[0];
    if (record === undefined) throw new Error("the round is on record");
    expect(ledger.carrierPathOf("wave", "1", record)).toBe(".kairos/cdd/p9/tasks-1-implement.json");
  });
});

describe("the crashed rounds", () => {
  /** One booked round record, as `recordRound` would have written it. */
  const record = (over: Partial<RoundRecord>): RoundRecord => ({
    op: "implement",
    cycle: 1,
    attempt: 1,
    dispatchBase: null,
    verdict: verdict(false),
    violations: [],
    carrierDigest: null,
    ...over,
  });

  it("yields one cell per crashed round identity, with the first hard cause", () => {
    const { ledger } = fixture();
    const crashed = record({
      violations: [hard("contract-violation"), { grade: "hard", cause: "graph", message: "x" }],
    });
    expect(ledger.crashedOf([crashed])).toEqual([
      { op: "implement", cycle: 1, attempt: 1, cause: "contract-violation" },
    ]);
    // One identity booked twice is still one cell.
    expect(ledger.crashedOf([crashed, crashed])).toHaveLength(1);
    // A soft-only failure is bookkeeping, never a crash.
    expect(
      ledger.crashedOf([
        record({ violations: [{ grade: "soft", cause: "contract-violation", message: "x" }] }),
      ]),
    ).toEqual([]);
    // A completed round is not a crash whatever it booked.
    expect(ledger.crashedOf([record({ verdict: verdict(true), violations: [hard("x")] })])).toEqual(
      [],
    );
  });

  it("orders the cells by the round sequence, not by write order", () => {
    const { ledger } = fixture();
    const cells = ledger.crashedOf([
      record({ cycle: 2, violations: [hard("a")] }),
      record({ cycle: 1, violations: [hard("b")] }),
    ]);
    expect(cells.map((cell) => cell.cycle)).toEqual([1, 2]);
  });
});

describe("the observation set", () => {
  it("flattens the review rounds by (cycle, attempt), carrier and read included", () => {
    const { ledger, workspace } = fixture();
    ledger.recordRound("phase-spec", { op: "review", cycle: 2, attempt: 1 });
    ledger.recordRound("phase-spec", { op: "review", cycle: 1, attempt: 1 });
    workspace.writeJson("phase-spec-review-1.c1.json", { findings: [{ id: "F1" }] });
    workspace.writeJson("phase-spec-review-1.c1.rulings.json", {
      carrier: "phase-spec-review-1.c1.json",
      rulings: [{ finding: "F1", verdict: "fixed", ruling: "done" }],
    });
    const observed = ledger.observedArtifacts();
    expect(observed.map((entry) => entry.cycle)).toEqual([1, 2]);
    const [first, second] = observed;
    // The carrier the observation names is the ONE accessor's answer, byte-identical.
    const persisted = JSON.parse(readFileSync(workspace.resolve(Ledger.FILE), "utf8"));
    const records = persisted.waves[0].rounds as RoundRecord[];
    expect(first?.carrier).toBe(ledger.carrierPathOf("phase-spec", "phase-spec", records[0]));
    expect(first?.carrier).toBe(".kairos/cdd/p9/phase-spec-review-1.c1.json");
    // Cycle 1's sidecar conforms; cycle 2 has no carrier at all — two different reads.
    expect(first?.read.kind).toBe("ok");
    expect(second?.read.kind).toBe("absent");
    expect(second?.carrier).toBe("");
  });

  it("folds a WAVE line the same way for the carrier accessor and the observation set", () => {
    // The line-word → `(type, key)` fold has one home: a wave line resolves against the
    // `wave` artifact type, a document line against its own word. The two readers therefore
    // answer one path — and the wave arm is the one a second spelling would break silently,
    // because there the type is not the line word.
    const { ledger, workspace } = fixture();
    ledger.recordRound("tasks-1,2", { op: "review", cycle: 1, attempt: 1 });
    workspace.writeJson("tasks-1,2-review-1.c1.json", { findings: [] });
    workspace.writeJson("tasks-1,2-review-1.c1.rulings.json", {
      carrier: "tasks-1,2-review-1.c1.json",
      rulings: [],
    });
    const record = ledger.rounds("tasks-1,2")[0] as RoundRecord;
    const [observed] = ledger.observedArtifacts();
    expect(observed?.carrier).toBe(ledger.carrierPathOf("wave", "1,2", record));
    expect(observed?.carrier).toBe(".kairos/cdd/p9/tasks-1,2-review-1.c1.json");
    expect(observed?.read.kind).toBe("ok");
  });

  it("never enters a sidecar no record claims — the contract contradicts nothing, it just records", () => {
    const { ledger, workspace } = fixture();
    // A review round on disk with no record: its sidecar stays an orphan observation.
    workspace.writeJson("plan-review-1.c1.rulings.json", { rulings: [] });
    expect(ledger.observedArtifacts()).toEqual([]);
    expect(ledger.orphanHandoffs()).toEqual([]);
    // …and no artifacts index means no observation at all.
    expect(new Ledger({ workspace, names: () => [] }).observedArtifacts()).toEqual([]);
  });
});

describe("the slice boundary", () => {
  it("imports no later run segment and touches no filesystem", () => {
    const files = readdirSync(LEDGER_DIR).filter((name) => name.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const text = readFileSync(path.join(LEDGER_DIR, file), "utf8");
      for (const later of ["run/gate", "run/dispatch", "run/advance"]) {
        expect(text).not.toContain(`"${later}`);
      }
      expect(text).not.toContain('"node:fs"');
      expect(text).not.toContain("writeFileSync");
      expect(text).not.toContain('"docs/');
      expect(text).not.toContain('"surface/');
    }
  });

  it("lands every record through env.workspace's atomic write", () => {
    const { ledger, workspace } = fixture();
    ledger.recordRound("tasks-1", { op: "implement", cycle: 1, attempt: 1 });
    ledger.recordDocReview("plan", "body");
    expect(existsSync(workspace.resolve(Ledger.FILE))).toBe(true);
    const raw = JSON.parse(readFileSync(workspace.resolve(Ledger.FILE), "utf8"));
    expect(raw.waves.map((line: { wave: string }) => line.wave)).toEqual(["1", "plan"]);
    // The bytes end with exactly one newline — the workspace write face's rule.
    expect(readFileSync(workspace.resolve(Ledger.FILE), "utf8").endsWith("}\n")).toBe(true);
  });
});
