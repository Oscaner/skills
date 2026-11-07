// packages/cdd-engine/src-next/session/__tests__/ledger.test.ts
// T9 Ledger suite (design spec §6.1) — the four-in-one session ledger:
//   · progress — the fixed key set (emptyProgress), read/write round-trips, the
//     row lookup pair (rowFor/entryFor — the task/group key dichotomy), the round
//     record (roundCount/recordRound — the on-disk done record), the counters;
//   · handoff — the data-sourced family naming, the carrier skeleton (build), the
//     single-author persist (full-replace — the engine owns the file verbatim);
//   · crash — the lane-crash recovery record round-trip (crash-<lane>-<round>.json);
//   · round — the carrier read-back: review findings normalized with severity, the
//     fix round carrying the SOURCE review's findings (C5-1), and the consecutive-S1
//     walk (the review-cycle soft-cap basis).
// Fixtures live under mkdtemp (hermetic); the naming asserts read the living
// engine-config (the external contract JSONs — allowed steady-data reads, never the
// old tree's derived products).

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger, type ProgressData, type RefKind, RoundViolation } from "../ledger.ts";
import { RoundNaming } from "../round-naming.ts";
import type { OpenFrame } from "../run.ts";

/** A hermetic ledger fixture — a fresh temp workspace under a temp repo root. */
const fixture = (): { ledger: Ledger; workspace: Workspace; cleanup: () => void } => {
  const repo = mkdtempSync(path.join(tmpdir(), "ledger-"));
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repo, ".kairos", "cdd"), "session"),
    "test-slug",
  );
  const ledger = new Ledger(workspace, new ConfigLoader());
  return { ledger, workspace, cleanup: () => rmSync(repo, { recursive: true, force: true }) };
};

describe("progress — the fixed key set", () => {
  it("emptyProgress carries the fixed key set at zero (the counter arm + an empty rows list)", () => {
    const { ledger, cleanup } = fixture();
    try {
      expect(ledger.emptyProgress()).toEqual({
        timeoutCount: 0,
        engineSelfWrittenCount: 0,
        engineRecoveryCount: 0,
        harnessAbortCount: 0,
        waves: [],
      });
    } finally {
      cleanup();
    }
  });

  it("readProgress is null before the first write — the ledger never invents state", () => {
    const { ledger, cleanup } = fixture();
    try {
      expect(ledger.readProgress()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("writeProgress + readProgress round-trip the typed data plane", () => {
    const { ledger, cleanup } = fixture();
    try {
      ledger.writeProgress({ ...ledger.emptyProgress(), plan: "docs/plan.md" });
      expect(ledger.readProgress()?.plan).toBe("docs/plan.md");
    } finally {
      cleanup();
    }
  });

  it("rowFor/entryFor — the single wave-row form (±T26): every dispatch is a wave", () => {
    const { ledger, cleanup } = fixture();
    try {
      const data = ledger.emptyProgress();
      data.waves.push(ledger.entryFor("1"));
      data.waves.push(ledger.entryFor("1,2"));
      expect(Ledger.rowFor(data, "1")).toEqual({ wave: "1" }); // single-task wave ≡ the task row
      expect(Ledger.rowFor(data, "1,2")).toEqual({ wave: "1,2" });
      expect(Ledger.rowFor(data, "missing")).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it("a retired `spec`-keyed row reads as the phase-spec line (`spec` ⇒ `phase-spec`, never rewritten)", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      // A row recorded under the retired spelling — the legacy round-shape map included.
      ledger.writeProgress({
        ...ledger.emptyProgress(),
        waves: [{ wave: "spec", rounds: { review: [1, 2, 3], fix: [2, 3] } }],
      });
      expect(ledger.roundCount("phase-spec", "review")).toBe(3);
      expect(ledger.roundCount("phase-spec", "fix")).toBe(2);
      expect(ledger.roundRecorded("phase-spec", "review", 3)).toBe(true);
      expect(ledger.completedCycles("phase-spec", "review")).toEqual([1, 2, 3]);
      // The alias is read-time only: a new round lands on that SAME row and the stored
      // key stays byte-frozen (history is never rewritten).
      ledger.recordRound("phase-spec", { op: "review" });
      expect(ledger.readProgress()?.waves.map((row) => row.wave)).toEqual(["spec"]);
      const reload = new Ledger(workspace, new ConfigLoader());
      expect(reload.roundCount("phase-spec", "review")).toBe(4);
    } finally {
      cleanup();
    }
  });

  it("a retired `spec` row reads as the line its workspace DECLARES (`overall` / `single-spec` included)", () => {
    const { ledger, cleanup } = fixture();
    try {
      // One identity document per workspace, so the retired `spec` row is exactly that
      // document's line — the declaration names which line word reads it. Without a
      // declared word the legacy default (the `phase-spec` line) is the only alias.
      const data = {
        ...ledger.emptyProgress(),
        waves: [{ wave: "spec", rounds: { review: [1, 2] } }],
      };
      expect(Ledger.rowFor(data, "overall", "overall")?.wave).toBe("spec");
      expect(Ledger.rowFor(data, "single-spec", "single-spec")?.wave).toBe("spec");
      expect(Ledger.rowFor(data, "phase-spec", "phase-spec")?.wave).toBe("spec");
      expect(Ledger.rowFor(data, "phase-spec")?.wave).toBe("spec");
      // A library row of another word is never this row: the declaration gates it.
      expect(Ledger.rowFor(data, "overall", "phase-spec")).toBeUndefined();
      expect(Ledger.rowFor(data, "single-spec", "overall")).toBeUndefined();
      expect(Ledger.rowFor(data, "overall")).toBeUndefined();
      expect(Ledger.rowFor(data, "plan", "plan")).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it("a charter's retired carrier still closes its `overall` line — the alias follows the declared word", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      // The same pre-rename facts on a charter: the row under `spec`, the review
      // carrier under `spec-review-1.json`. The line word is `overall`, so both read
      // aliases resolve it while every WRITE keeps the current spelling.
      ledger.writeProgress({
        ...ledger.emptyProgress(),
        waves: [{ wave: "spec", rounds: { review: [1] } }],
      });
      workspace.writeJson("spec-review-1.json", { artifacts: {} });
      expect(ledger.lineClosed("overall", "overall")).toBe(true);
      expect(ledger.lineRoute("overall", "overall")).toBeNull();
      expect(ledger.handoffName("review", "overall", { round: 1 })).toBe("overall-review-1.json");
    } finally {
      cleanup();
    }
  });

  it("a round recorded under the retired carrier name still closes the phase-spec line", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      // The pre-unification facts of a closed phase-spec line: the row under `spec`,
      // the review carrier under `spec-review-1.json` — a clean review (zero findings).
      ledger.writeProgress({
        ...ledger.emptyProgress(),
        waves: [{ wave: "spec", rounds: { review: [1] } }],
      });
      workspace.writeJson("spec-review-1.json", { artifacts: {} });
      expect(ledger.lineClosed("phase-spec", "phase-spec")).toBe(true);
      expect(ledger.lineRoute("phase-spec", "phase-spec")).toBeNull();
      // The alias never mints a carrier: the retired name is read, never written.
      expect(ledger.handoffName("review", "phase-spec", { round: 1 })).toBe(
        "phase-spec-review-1.json",
      );
    } finally {
      cleanup();
    }
  });

  it("a legacy carrier's fix hop names the file that EXISTS — the alias reports the name it resolved", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      // A pre-rename line mid-flight: two reviews recorded, fix 1 landed, and review 2
      // still carries an open blocker. Only the retired carrier exists on disk.
      ledger.writeProgress({
        ...ledger.emptyProgress(),
        waves: [{ wave: "spec", rounds: { review: [1, 2], fix: [1] } }],
      });
      workspace.writeJson("spec-review-2.json", {
        artifacts: {},
        findings: [{ severity: "blocker", summary: "the line is unread" }],
      });
      // The hop's `--reviews` names the carrier on disk, never the never-minted
      // canonical twin (which would render an unreadable directive → BLOCKED).
      expect(ledger.lineRoute("phase-spec", "phase-spec")).toEqual({
        kind: "fix",
        reviews: workspace.resolve("spec-review-2.json"),
      });
      // The charter line resolves through its own declared word and the SAME carrier.
      expect(ledger.lineRoute("overall", "overall")).toEqual({
        kind: "fix",
        reviews: workspace.resolve("spec-review-2.json"),
      });
      // The round's own reviews path is the resolved name too (the fix criterion and
      // INPUT_REVIEWS read this cell).
      expect(ledger.round("review", "phase-spec", { round: 2 }, 2)?.reviewsPath).toBe(
        workspace.resolve("spec-review-2.json"),
      );
      // Never minted: every WRITE keeps the canonical spelling.
      expect(ledger.handoffName("review", "phase-spec", { round: 2 })).toBe(
        "phase-spec-review-2.json",
      );
      expect(ledger.handoffName("fix", "overall", { round: 2 })).toBe("overall-fix-2.json");
    } finally {
      cleanup();
    }
  });

  it("a migrated row is appended to and numbered from — the declared word rides every access", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      // A charter mid-flight across the rename: the row under `spec`, the reviews 1-2
      // and fix 2 recorded there.
      ledger.writeProgress({
        ...ledger.emptyProgress(),
        waves: [{ wave: "spec", rounds: { review: [1, 2], fix: [2] } }],
      });
      expect(ledger.roundCount("overall", "review", "overall")).toBe(2);
      expect(ledger.completedCycles("overall", "review", "overall")).toEqual([1, 2]);
      expect(ledger.roundRecorded("overall", "review", 2, "overall")).toBe(true);
      expect(ledger.recordsOf("overall", "overall")).toHaveLength(3);
      // The post-rename round books on that SAME row and numbers from its cycles —
      // the legacy counts are never shadowed by a forked identity row.
      const recorded = ledger.recordRound("overall", { op: "review" }, "overall");
      expect(recorded.cycle).toBe(3);
      ledger.recordReviewedRevision(
        "overall",
        { kind: "doc-revision", doc: "docs/x.md", doc_hash: "abc" },
        "overall",
      );
      expect(ledger.readProgress()?.waves.map((row) => row.wave)).toEqual(["spec"]);
      expect(ledger.reviewedRevisionOf("overall", "overall")?.kind).toBe("doc-revision");
      const reload = new Ledger(workspace, new ConfigLoader());
      expect(reload.roundCount("overall", "review", "overall")).toBe(3);
      expect(reload.completedCycles("overall", "review", "overall")).toEqual([1, 2, 3]);
    } finally {
      cleanup();
    }
  });

  it("roundCount starts 0; recordRound persists the per-key per-mode done record", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      expect(ledger.roundCount("1,2", "review")).toBe(0);
      ledger.recordRound("1,2", { op: "review" });
      expect(ledger.roundCount("1,2", "review")).toBe(1);
      ledger.recordRound("1,2", { op: "review" });
      expect(ledger.roundCount("1,2", "review")).toBe(2);
      ledger.recordRound("1,2", { op: "fix" });
      expect(ledger.roundCount("1,2", "fix")).toBe(1);
      // a fresh ledger over the same workspace reads the persisted counts back (on-disk record)
      const reload = new Ledger(workspace, new ConfigLoader());
      expect(reload.roundCount("1,2", "review")).toBe(2);
      expect(reload.roundCount("1,2", "fix")).toBe(1);
      expect(reload.roundCount("7", "review")).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("counterOf reads a failure-category count (0 default); writeProgress persists it", () => {
    const { ledger, cleanup } = fixture();
    try {
      expect(ledger.counterOf("timeoutCount")).toBe(0);
      ledger.writeProgress({ ...ledger.emptyProgress(), timeoutCount: 3 });
      expect(ledger.counterOf("timeoutCount")).toBe(3);
      expect(ledger.counterOf("harnessAbortCount")).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("contractViolationCount is DERIVED from the round records — the soft entries plus one per dirty-tree observation", () => {
    const { ledger, cleanup } = fixture();
    try {
      // zero default — the retired persisted scalar is gone from the zero set
      expect(ledger.counterOf("contractViolationCount")).toBe(0);
      expect(ledger.softViolationsOf("1")).toBe(0);
      const soft = { grade: "soft" as const, cause: "contract-violation", message: "hygiene" };
      // round 1: one soft entry, clean tree → 1 · round 2: no entry, dirty tree → 1
      ledger.recordRound(1, { op: "implement", violations: [soft] });
      ledger.recordRound(1, {
        op: "review",
        verdict: { treeClean: false, targetAction: true },
      });
      // A HARD entry is the round's failure verdict, never a count (§3.3)
      ledger.recordRound(2, {
        op: "implement",
        violations: [{ grade: "hard", cause: "contract-violation", message: "zero commits" }],
      });
      expect(ledger.softViolationsOf("1")).toBe(2);
      expect(ledger.softViolationsOf("2")).toBe(0);
      // one read exit: the session-wide derived value
      expect(ledger.counterOf("contractViolationCount")).toBe(2);
      // timeout counter stays untouched — the two faces are independent
      expect(ledger.counterOf("timeoutCount")).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("the graded entry has ONE construction point — the cause vocabulary's shape lives here", () => {
    // Every plane builds its entries here: renaming a cause or adding a grade touches
    // this factory, never a copy per call site.
    expect(RoundViolation.hard("zero commits")).toEqual({
      grade: "hard",
      cause: "contract-violation",
      message: "zero commits",
    });
    expect(RoundViolation.soft("hygiene")).toEqual({
      grade: "soft",
      cause: "contract-violation",
      message: "hygiene",
    });
    // a death fact passes its own cause through the same factory
    expect(RoundViolation.hard("child exited 3", "child-exit")).toEqual({
      grade: "hard",
      cause: "child-exit",
      message: "child exited 3",
    });
  });

  it("a legacy contractViolationCount scalar on disk is READ and IGNORED — the derived value wins", () => {
    const { ledger, cleanup } = fixture();
    try {
      // an older engine's file: the scalar says 5, no round records exist
      ledger.writeProgress({ ...ledger.emptyProgress(), contractViolationCount: 5 });
      expect(ledger.counterOf("contractViolationCount")).toBe(0);
    } finally {
      cleanup();
    }
  });
});

describe("progress — the D28 round-identity face (cycles, not counts)", () => {
  /** Write a progress row's raw `rounds` plane — the migration fixture (a legacy
   *  numeric count or the current cycle list written straight to disk). */
  const seedRounds = (ledger: Ledger, rounds: Record<string, number | number[]>): void => {
    const data = ledger.readProgress() ?? ledger.emptyProgress();
    data.waves.push({ wave: "7,9", rounds: rounds as ProgressData["waves"][number]["rounds"] });
    ledger.writeProgress(data);
  };

  it("#cyclesOf migrates a legacy numeric count to its contiguous identity — `{fix: 1}` ≡ `[1]`", () => {
    const { ledger, cleanup } = fixture();
    try {
      seedRounds(ledger, { fix: 1 }); // the pre-D28 numeric shape on disk
      expect(ledger.roundCount("7,9", "fix")).toBe(1);
      expect(ledger.roundRecorded("7,9", "fix", 1)).toBe(true);
      expect(ledger.roundRecorded("7,9", "fix", 2)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("a legacy count of N normalizes to the cycle list [1..N] — `{review: 2}` ≡ `[1, 2]`", () => {
    const { ledger, cleanup } = fixture();
    try {
      seedRounds(ledger, { review: 2 });
      expect(ledger.roundCount("7,9", "review")).toBe(2);
      expect(ledger.roundRecorded("7,9", "review", 1)).toBe(true);
      expect(ledger.roundRecorded("7,9", "review", 2)).toBe(true);
      expect(ledger.roundRecorded("7,9", "review", 3)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("an already-migrated cycle list is preserved verbatim — `{review: [1, 2]}` stays `[1, 2]`", () => {
    const { ledger, cleanup } = fixture();
    try {
      seedRounds(ledger, { review: [1, 2] });
      expect(ledger.roundCount("7,9", "review")).toBe(2);
      expect(ledger.roundRecorded("7,9", "review", 2)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("roundCount counts DISTINCT cycles — a re-attempt at the same cycle adds no round identity", () => {
    const { ledger, cleanup } = fixture();
    try {
      ledger.recordRound("1", {
        op: "implement",
        cycle: 1,
        attempt: 1,
        verdict: { treeClean: true, targetAction: false },
      });
      ledger.recordRound("1", { op: "implement", cycle: 1, attempt: 2 });
      // the dispatch number is the cycle identity set, never the attempt count
      expect(ledger.roundCount("1", "implement")).toBe(1);
      expect(ledger.roundRecorded("1", "implement", 1)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("recordRound records the CYCLE (its identity), defaulting to latest+1 — a skipped cycle keeps its own number", () => {
    const { ledger, cleanup } = fixture();
    try {
      // an explicit cycle records its OWN number (fix-2 = the fix that addressed review-2)
      ledger.recordRound("7,9", { op: "fix", cycle: 2 });
      expect(ledger.roundCount("7,9", "fix")).toBe(1);
      expect(ledger.roundRecorded("7,9", "fix", 2)).toBe(true);
      expect(ledger.roundRecorded("7,9", "fix", 1)).toBe(false); // cycle 1 was skipped — never fabricated
      // a default recordRound appends the next cycle after the latest (2 → 3)
      ledger.recordRound("7,9", { op: "fix" });
      expect(ledger.roundCount("7,9", "fix")).toBe(2);
      expect(ledger.roundRecorded("7,9", "fix", 3)).toBe(true);
      // a re-record of an existing cycle is idempotent (never doubled)
      ledger.recordRound("7,9", { op: "fix", cycle: 2 });
      expect(ledger.roundCount("7,9", "fix")).toBe(2);
    } finally {
      cleanup();
    }
  });

  it("the round() read gate tests IDENTITY, not a count — `{review:[1,2], fix:[2]}` reads fix cycle 2 back", () => {
    const { ledger, cleanup } = fixture();
    try {
      // the drift-voided review-1 shape: the first fix is cycle 2 (fix-K ⟷ review-K)
      seedRounds(ledger, { review: [1, 2], fix: [2] });
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "7,9", round: 2 },
        { findings: [{ severity: "blocker", summary: "survives" }] },
      );
      ledger.persistHandoff("fix", "wave", { tasks: "7,9", round: 2 }, { artifacts: {} });
      // the old `roundCount < round` comparison (1 < 2) refused this read → a HARD_ERROR
      // on a fix that legitimately concluded; the identity gate reads it back
      expect(ledger.round("fix", "wave", { tasks: "7,9" }, 2)).not.toBeNull();
      // an unrecorded cycle is still refused (identity, not ordinal)
      expect(ledger.round("fix", "wave", { tasks: "7,9" }, 1)).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("rounds — the per-round records (P22 T3: record → status, one direction)", () => {
  /** Write one progress row's raw `rounds` plane verbatim — the legacy/migration
   *  fixtures write the OLD stored forms straight to disk (the read face folds them). */
  const seedRaw = (ledger: Ledger, row: ProgressData["waves"][number]): void => {
    const data = ledger.readProgress() ?? ledger.emptyProgress();
    data.waves.push(row);
    ledger.writeProgress(data);
  };

  it("completion is the verdict, not membership — a failed round keeps its cycle in register", () => {
    const { ledger, cleanup } = fixture();
    try {
      ledger.recordRound("1", {
        op: "review",
        cycle: 1,
        verdict: { treeClean: true, targetAction: true },
      });
      ledger.recordRound("1", {
        op: "review",
        cycle: 2,
        verdict: { treeClean: false, targetAction: false },
      });
      // the dispatch-number face counts every in-register cycle (a failed round spent
      // its identity slot); the completion face reads the recorded verdict
      expect(ledger.roundCount("1", "review")).toBe(2);
      expect(ledger.completedCycles("1", "review")).toEqual([1]);
      // a completed record carries a readable round; the failed one reads no carrier
      ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
      expect(ledger.round("review", "wave", { tasks: "1" }, 1)).not.toBeNull();
      expect(ledger.round("review", "wave", { tasks: "1" }, 2)).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("folds both legacy stored forms into completed records — attempt 1, no baseline, no carrier", () => {
    const { ledger, cleanup } = fixture();
    try {
      // form A — the per-mode cycle array; form B — the bare numeric cycle count
      seedRaw(ledger, { wave: "1", rounds: { review: [1, 2] } });
      seedRaw(ledger, { wave: "2", rounds: { review: 1, fix: 1 } });
      expect(ledger.recordsOf("1")).toEqual([
        {
          op: "review",
          cycle: 1,
          attempt: 1,
          dispatchBase: null,
          verdict: { treeClean: true, targetAction: true },
          violations: [],
          carrierPath: null,
        },
        {
          op: "review",
          cycle: 2,
          attempt: 1,
          dispatchBase: null,
          verdict: { treeClean: true, targetAction: true },
          violations: [],
          carrierPath: null,
        },
      ]);
      // the old write recorded only completed rounds, so every legacy cycle IS complete
      expect(ledger.completedCycles("1", "review")).toEqual([1, 2]);
      expect(ledger.recordsOf("2").map((record) => `${record.op}:${record.cycle}`)).toEqual([
        "review:1",
        "fix:1",
      ]);
      // the attempt is 1 on every folded record (a legacy row never renders `a1`)
      expect(ledger.recordsOf("2").every((record) => record.attempt === 1)).toBe(true);
      // …and the dispatch-number face is unchanged from the pre-record shape
      expect(ledger.roundCount("1", "review")).toBe(2);
      expect(ledger.roundCount("2", "fix")).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("reads a legacy row as CLOSED and its round as the active carrier — the completion questions", () => {
    const { ledger, cleanup } = fixture();
    try {
      // a legacy row whose recorded review concluded clean
      seedRaw(ledger, { wave: "1", rounds: { implement: [1], review: [1] } });
      ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
      // the row-level closure judge (the wave board / closedWaves read) sees the fold
      expect(ledger.lineClosed("1", "wave")).toBe(true);
      expect(ledger.closedWaves()).toEqual(new Set([1]));
      // a doc line folded the same way
      seedRaw(ledger, { wave: "plan", rounds: { review: 1 } });
      ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
      expect(ledger.lineClosed("plan", "plan")).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("returns the recorded carrier path as-is — the record carries the artifact it wrote", () => {
    const { ledger, cleanup } = fixture();
    try {
      const carrierPath = ledger.handoffPath("implement", "wave", { tasks: "1" });
      ledger.recordRound("1", { op: "implement", cycle: 1, carrierPath });
      expect(ledger.recordsOf("1")[0]?.carrierPath).toBe(carrierPath);
    } finally {
      cleanup();
    }
  });
});

describe("handoff — naming / carrier / single-author persist", () => {
  it("family names come data-sourced from the handoff namespace", () => {
    const { ledger, cleanup } = fixture();
    try {
      expect(ledger.handoffName("implement", "wave", { tasks: "7,9" })).toBe(
        "tasks-7,9-implement.json",
      );
      expect(ledger.handoffName("review", "wave", { tasks: "7,9", round: 2 })).toBe(
        "tasks-7,9-review-2.json",
      );
      expect(ledger.handoffName("fix", "wave", { tasks: "7,9", round: 1 })).toBe(
        "tasks-7,9-fix-1.json",
      );
      expect(ledger.handoffName("review", "phase-spec", { round: 1 })).toBe(
        "phase-spec-review-1.json",
      );
      expect(ledger.handoffName("fix", "plan", { round: 1 })).toBe("plan-fix-1.json");
      // find #9 — the branch family name is the spine `branch-{op}-{round}.json`
      // (the range token left the file name — the branch line holds no commit identity)
      expect(ledger.handoffName("review", "branch", { round: 1 })).toBe("branch-review-1.json");
      expect(ledger.handoffName("fix", "branch", { round: 2 })).toBe("branch-fix-2.json");
    } finally {
      cleanup();
    }
  });

  it("buildHandoff carries ONLY the schema-declared writable fields — identity rides the file name, never phase/tasks inline (v1.30)", () => {
    const { ledger, cleanup } = fixture();
    try {
      const carrier = ledger.buildHandoff("work", { artifacts: { brief: "/tmp/brief.md" } });
      // the carrier's plane is the schema's declared fields — no inline phase/tasks
      // identity (the canonical file name `tasks-7,9-review-1.json` carries it; inline
      // identity seeded the mimicking precedence the reserved gate then had to refuse)
      expect("phase" in carrier).toBe(false);
      expect("tasks" in carrier).toBe(false);
      // T1 — the work carrier physically carries no findings key (the per-face typing)
      expect("findings" in carrier).toBe(false);
      expect(carrier.artifacts).toEqual({ brief: "/tmp/brief.md" });
      expect(ledger.buildHandoff("work", {}).artifacts).toEqual({});
    } finally {
      cleanup();
    }
  });

  it("persistHandoff writes the canonical file verbatim — the single-author full-replace write", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const written = ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "7,9", round: 1 },
        { tasks: [7, 9], phase: "review", findings: [{ severity: "blocker" }] },
      );
      expect(written).toBe(workspace.resolve("tasks-7,9-review-1.json"));
      expect(JSON.parse(readFileSync(written, "utf8"))).toEqual({
        tasks: [7, 9],
        phase: "review",
        findings: [{ severity: "blocker" }],
      });
      // The engine is the sole author: a second persist FULLY replaces — the stale finding
      // never survives a merge.
      const second = ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "7,9", round: 1 },
        { tasks: [7, 9], phase: "review", findings: [] },
      );
      expect(JSON.parse(readFileSync(second, "utf8"))).toEqual({
        tasks: [7, 9],
        phase: "review",
        findings: [],
      });
    } finally {
      cleanup();
    }
  });

  it("readHandoff returns the carrier; missing → null", () => {
    const { ledger, cleanup } = fixture();
    try {
      expect(ledger.readHandoff("review", "wave", { tasks: "7,9", round: 1 })).toBeNull();
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "7,9", round: 1 },
        { findings: [{ severity: "warn" }] },
      );
      expect(ledger.readHandoff("review", "wave", { tasks: "7,9", round: 1 })).toEqual({
        findings: [{ severity: "warn" }],
      });
    } finally {
      cleanup();
    }
  });

  it("orphanHandoffs names only the drafts whose round never COMPLETED — a failed round's carrier stays orphaned", () => {
    const { ledger, cleanup } = fixture();
    try {
      // a completed review owns its carrier — the round's verdict says so
      ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
      ledger.recordRound("1", { op: "review", cycle: 1 });
      // a hard-failed review leaves a draft no COMPLETED round owns: it is registered
      // (every dispatched round lands) but its verdict is not a completion
      ledger.persistHandoff(
        "review",
        "wave",
        {
          tasks: "1",
          round: 2,
        },
        {
          findings: [{ severity: "blocker", lens: "code", summary: "drift" }],
        },
      );
      ledger.recordRound("1", {
        op: "review",
        cycle: 2,
        verdict: { treeClean: true, targetAction: false },
      });
      expect(ledger.orphanHandoffs()).toEqual(["tasks-1-review-2.json"]);
    } finally {
      cleanup();
    }
  });

  it("orphanHandoffs attributes a migrated line's carrier to its retired row — a recorded round is no orphan", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      // A line mid-flight across the rename: the row stays under `spec`, the carrier
      // it owns is already minted under the current spelling. Cycle 1 is NOT recorded
      // and cycle 3 IS — a document family carries no `{tasks}` group, so the round
      // must be read from its own `{round}` group (reading the absent second group
      // would resolve every doc carrier to round 1 and call this landed draft an
      // orphan).
      ledger.writeProgress({
        ...ledger.emptyProgress(),
        waves: [{ wave: "spec", rounds: { review: [3] } }],
      });
      workspace.writeJson("phase-spec-review-3.json", { artifacts: {}, findings: [] });
      // The file's own line word IS its declaration, so the row resolves and the
      // recorded round owns its carrier.
      expect(ledger.orphanHandoffs()).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("orphanHandoffs reads a document family's round from its `{round}` group", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      // The plan line landed fixes 2 and 3 — the drafts are on disk, cycle 1 never
      // was. Every doc family (`{line}-{op}-{round}.json`) carries ONE group, and it
      // is the round: the drafts are owned, not orphans.
      ledger.writeProgress({
        ...ledger.emptyProgress(),
        waves: [{ wave: "plan", rounds: { fix: [2, 3] } }],
      });
      workspace.writeJson("plan-fix-2.json", { artifacts: {} });
      workspace.writeJson("plan-fix-3.json", { artifacts: {} });
      expect(ledger.orphanHandoffs()).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("orphanHandoffs keeps a round-less family's round at 1 — an implement carrier is owned", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      // `tasks-{tasks}-implement.json` carries `{tasks}` alone: the fixed implement
      // family is round-less, and its single group is the task list, never a round.
      ledger.recordRound("1,2", { op: "implement", cycle: 1 });
      workspace.writeJson("tasks-1,2-implement.json", { artifacts: {} });
      expect(ledger.orphanHandoffs()).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("orphanHandoffs lists a retired-spelling draft whose round never completed", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      // A draft the pre-rename line left behind, under a round the row never booked.
      ledger.writeProgress({
        ...ledger.emptyProgress(),
        waves: [{ wave: "spec", rounds: { review: [1] } }],
      });
      workspace.writeJson("spec-fix-9.json", { artifacts: {} });
      expect(ledger.orphanHandoffs()).toEqual(["spec-fix-9.json"]);
    } finally {
      cleanup();
    }
  });
});

describe("crash — the recovery record (named by RoundNaming)", () => {
  it("round-trips the record under the name RoundNaming derived", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const frame: OpenFrame = {
        type: "wave",
        phase: "implement",
        round: 1,
        target: { kind: "wave", tasks: [1] },
        params: { tasks: "1" },
        key: "1",
      };
      const name = new RoundNaming(workspace).crashName(frame);
      const record = {
        exitCode: 1,
        stderrTail: ["engine error: boom"],
        stdoutTail: [],
        attemptedHandoff: "tasks-1-implement.json",
        next: "cdd implement --tasks 1",
        cause: "child-exit" as const,
        logPath: null,
        lastSample: null,
        promoted: false,
        idleMs: null,
        dispatchBase: "abc123",
        commitsSince: ["def456 the child's commit"],
      };
      ledger.writeCrash(name, record);
      expect(ledger.readCrash(name)).toEqual(record);
      // a recordless failure round stays recordless — the no-next failure face
      expect(ledger.readCrash("crash-tasks-1-review-1.json")).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("keeps the same wave+round's implement and review records apart — the op stays in the name", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const base = {
        exitCode: 1,
        stderrTail: [] as string[],
        stdoutTail: [] as string[],
        attemptedHandoff: null,
        next: "cdd implement --tasks 3,4",
        logPath: null,
        lastSample: null,
        promoted: false,
        idleMs: null,
        dispatchBase: null,
        commitsSince: [] as string[],
      };
      const naming = new RoundNaming(workspace);
      const implementFrame: OpenFrame = {
        type: "wave",
        phase: "implement",
        round: 2,
        target: { kind: "wave", tasks: [3, 4] },
        params: { tasks: "3,4" },
        key: "3,4",
      };
      const reviewFrame: OpenFrame = {
        ...implementFrame,
        phase: "review",
        params: { tasks: "3,4", round: 2 },
      };
      const implementName = naming.crashName(implementFrame);
      const reviewName = naming.crashName(reviewFrame);
      expect(implementName).toBe("crash-tasks-3,4-implement-2.json");
      expect(reviewName).toBe("crash-tasks-3,4-review-2.json");
      ledger.writeCrash(implementName, { ...base, cause: "child-exit" });
      ledger.writeCrash(reviewName, { ...base, cause: "contract-violation" });
      expect(ledger.readCrash(implementName)?.cause).toBe("child-exit");
      expect(ledger.readCrash(reviewName)?.cause).toBe("contract-violation");
    } finally {
      cleanup();
    }
  });
});

describe("the wave row's plan-task snapshot (P21 §5.1 — the append-vs-stall history)", () => {
  it("records the closing wave's plan task set once — a later record never rewrites the history", () => {
    const { ledger, cleanup } = fixture();
    try {
      ledger.recordPlanTasks("3,4", [1, 2, 3, 4]);
      expect(ledger.planTasksOf("3,4")).toEqual([1, 2, 3, 4]);
      // The plan grew afterwards — the snapshot stays the closure-time fact.
      ledger.recordPlanTasks("3,4", [1, 2, 3, 4, 5]);
      expect(ledger.planTasksOf("3,4")).toEqual([1, 2, 3, 4]);
    } finally {
      cleanup();
    }
  });

  it("reads null for a wave with no snapshot — a historical row holds no invented set", () => {
    const { ledger, cleanup } = fixture();
    try {
      ledger.recordRound("1", { op: "implement" });
      expect(ledger.planTasksOf("1")).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("round — the round carrier", () => {
  it("reads a review round's carrier — phase, normalized findings, the handoff path, the S1 walk", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "7,9", round: 1 },
        {
          tasks: [7, 9],
          phase: "review",
          findings: [
            { severity: "blocker", summary: "defect" },
            { severity: "warn", summary: "smell" },
            { severity: "bogus", summary: "never invented into the judgment domain" },
          ],
        },
      );
      // §2.8 — the round-read gate: only a recorded round is a round
      ledger.recordRound("7,9", { op: "review" });
      const carrier = ledger.round("review", "wave", { tasks: "7,9" }, 1);
      expect(carrier).not.toBeNull();
      expect(carrier!.phase).toBe("review");
      expect(carrier!.findings).toEqual([
        { severity: "blocker", summary: "defect" },
        { severity: "warn", summary: "smell" },
      ]);
      expect(carrier!.reviewsPath).toBe(workspace.resolve("tasks-7,9-review-1.json"));
      expect(carrier!.consecutiveS1).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("fix rounds carry the SOURCE review's findings, never their own carrier (C5-1)", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "7,9", round: 1 },
        { findings: [{ severity: "blocker", summary: "the input findings" }] },
      );
      ledger.persistHandoff(
        "fix",
        "wave",
        { tasks: "7,9", round: 1 },
        { phase: "fix", findings: [] },
      );
      ledger.recordRound("7,9", { op: "fix" });
      const carrier = ledger.round("fix", "wave", { tasks: "7,9" }, 1);
      expect(carrier).not.toBeNull();
      expect(carrier!.phase).toBe("fix");
      // the judgment findings are the source review's input, never the fix's own empty carrier
      expect(carrier!.findings).toEqual([{ severity: "blocker", summary: "the input findings" }]);
      expect(carrier!.reviewsPath).toBe(workspace.resolve("tasks-7,9-review-1.json"));
      expect(carrier!.consecutiveS1).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("an unrecorded round is null — a rejected child's leftover draft is never read back (§2.8)", () => {
    const { ledger, cleanup } = fixture();
    try {
      // a fix draft sits on disk (the child's rejected write) but recordRound never counted it
      ledger.persistHandoff(
        "fix",
        "wave",
        { tasks: "7,9", round: 1 },
        { phase: "fix", findings: [] },
      );
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "7,9", round: 1 },
        { findings: [{ severity: "blocker" }] },
      );
      // the fix round was never recorded → null whatever the disk draft says
      expect(ledger.round("fix", "wave", { tasks: "7,9" }, 1)).toBeNull();
      // recorded → the same read returns the carrier
      ledger.recordRound("7,9", { op: "fix" });
      expect(ledger.round("fix", "wave", { tasks: "7,9" }, 1)).not.toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a fix round whose source review is unreadable is null — never a zero-findings fabrication", () => {
    const { ledger, cleanup } = fixture();
    try {
      // the fix carrier is on record but the source review it judges (C5-1) is missing
      ledger.persistHandoff(
        "fix",
        "wave",
        { tasks: "7,9", round: 1 },
        { phase: "fix", findings: [] },
      );
      ledger.recordRound("7,9", { op: "fix" });
      // missing source review → no round on record (matching the review branch): the next-hop
      // derivation cannot close a line whose blocker set was never read
      expect(ledger.round("fix", "wave", { tasks: "7,9" }, 1)).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a fix round whose own carrier is missing is null too — unreadable either side", () => {
    const { ledger, cleanup } = fixture();
    try {
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "1", round: 1 },
        { findings: [{ severity: "blocker" }] },
      );
      ledger.recordRound("1", { op: "fix" });
      expect(ledger.round("fix", "wave", { tasks: "1" }, 1)).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("walks the consecutive-S1 run newest-first, stopping at the first clean review", () => {
    const { ledger, cleanup } = fixture();
    try {
      for (const roundNumber of [1, 2]) {
        ledger.persistHandoff(
          "review",
          "wave",
          { tasks: "7,9", round: roundNumber },
          { findings: [{ severity: "blocker" }] },
        );
        ledger.recordRound("7,9", { op: "review" });
      }
      const twoS1 = ledger.round("review", "wave", { tasks: "7,9" }, 2);
      expect(twoS1!.consecutiveS1).toBe(2);
      // a clean review at round 3 resets the run
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "7,9", round: 3 },
        { findings: [{ severity: "warn" }] },
      );
      ledger.recordRound("7,9", { op: "review" });
      expect(ledger.round("review", "wave", { tasks: "7,9" }, 3)!.consecutiveS1).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("an unreadable round history degrades the run to the conservative baseline, never a throw", () => {
    const { ledger, cleanup } = fixture();
    try {
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "1", round: 1 },
        { findings: [{ severity: "blocker" }] },
      );
      // rounds 1 + 2 are recorded, but round 2's file is missing → the read is null, never a throw
      ledger.recordRound("1", { op: "review" });
      ledger.recordRound("1", { op: "review" });
      expect(ledger.round("review", "wave", { tasks: "1" }, 2)).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("review references — the refKind face (T25 · P5)", () => {
  it("the RefKind union carries the two review kinds (doc-revision · brief-revision) and the commit-bearing kinds stay retired", () => {
    // The type probe: the two review kinds ARE members (D30 — doc-revision is the
    // spec/plan line, brief-revision the wave line), and the retired commit kinds
    // are absent (the wave-atomic + no-commit-identity rulings — R5 · P7).
    const docMember: "doc-revision" extends RefKind ? true : false = true;
    const briefMember: "brief-revision" extends RefKind ? true : false = true;
    const noCommitSet: "commit-set-ledger" extends RefKind ? true : false = false;
    const noCommitRange: "commit-range" extends RefKind ? true : false = false;
    const noGraphNode: "graph-node" extends RefKind ? true : false = false;
    expect(docMember).toBe(true);
    expect(briefMember).toBe(true);
    expect(noCommitSet).toBe(false);
    expect(noCommitRange).toBe(false);
    expect(noGraphNode).toBe(false);
  });

  it("the doc-revision two-layer binding — the doc path + the content-hash revision", () => {
    const { ledger, cleanup } = fixture();
    try {
      const refs = ledger.refs();
      const docRef = refs.docRevision("docs/kairos/specs/x-design.md", "revision one");
      expect(docRef.kind).toBe("doc-revision");
      expect(docRef.doc).toBe("docs/kairos/specs/x-design.md");
      // the doc-revision content hash stays a full sha1 hex — a non-ref digest,
      // unsliced (a bare 8-char digest slice would narrow the bind basis to
      // birthday-collision range)
      expect(docRef.doc_hash).toMatch(/^[0-9a-f]{40}$/);
      // the same content hashes the same revision — the two-layer convergence
      const docRefAgain = refs.docRevision("docs/kairos/specs/x-design.md", "revision one");
      expect(docRefAgain.doc_hash).toBe(docRef.doc_hash);
      // a different revision hashes differently — the revision layer is content-bound
      const edited = refs.docRevision("docs/kairos/specs/x-design.md", "revision two");
      expect(edited.doc_hash).not.toBe(docRef.doc_hash);
    } finally {
      cleanup();
    }
  });

  it("the same-ref ruling — the SAME doc revision is the same ref, a different doc/revision is not", () => {
    const { ledger, cleanup } = fixture();
    try {
      const refs = ledger.refs();
      const docRef = refs.docRevision("docs/kairos/specs/x-design.md", "revision one");
      // the identical ref (same doc + same hash) is the SAME ref
      const duplicate = refs.docRevision("docs/kairos/specs/x-design.md", "revision one");
      expect(refs.sameRef(docRef, duplicate)).toBe(true);
      // a different revision of the same doc is NOT the same ref
      const edited = refs.docRevision("docs/kairos/specs/x-design.md", "revision two");
      expect(refs.sameRef(docRef, edited)).toBe(false);
      // a different doc is never the same ref
      const otherDoc = refs.docRevision("docs/kairos/specs/y-design.md", "revision one");
      expect(refs.sameRef(docRef, otherDoc)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("the cross-kind ruling — a doc-revision and a brief-revision are never the same ref", () => {
    const { ledger, cleanup } = fixture();
    try {
      const refs = ledger.refs();
      const docRef = refs.docRevision("docs/kairos/plans/x-p3.md", "the plan body");
      // a brief-revision is a distinct ref KIND — the wave line's identity is never
      // the doc line's, even when the plan path layer and the hash layer coincide
      const briefRef = refs.briefRevision("docs/kairos/plans/x-p3.md", "the plan body");
      expect(briefRef.kind).toBe("brief-revision");
      expect(refs.sameRef(docRef, briefRef)).toBe(false);
      expect(refs.sameRef(briefRef, docRef)).toBe(false);
      // the same-kind brief-revision is still the same ref (the guard is the kind,
      // not a blanket refusal)
      const briefRefAgain = refs.briefRevision("docs/kairos/plans/x-p3.md", "the plan body");
      expect(refs.sameRef(briefRef, briefRefAgain)).toBe(true);
    } finally {
      cleanup();
    }
  });
});

describe("the T7 doc-line identity record — reviewedDocRevision (the reopen-compare basis)", () => {
  it("records + reads the reviewed doc revision on the doc line's progress row", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const doc = "docs/kairos/specs/x-design.md";
      const revision = ledger.refs().docRevision(doc, "revision one");
      expect(ledger.reviewedDocRevisionOf(doc)).toBeNull();
      ledger.recordReviewedRevision(doc, revision);
      expect(ledger.reviewedDocRevisionOf(doc)).toEqual(revision);
      // a fresh ledger over the same workspace reads the on-disk record back
      const reload = new Ledger(workspace, new ConfigLoader());
      expect(reload.reviewedDocRevisionOf(doc)).toEqual(revision);
      expect(reload.reviewedDocRevisionOf("docs/other.md")).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a reviewed doc revision RE-records on drift — the reopen's new identity basis", () => {
    const { ledger, cleanup } = fixture();
    try {
      const doc = "docs/kairos/plans/x-p3.md";
      const first = ledger.refs().docRevision(doc, "v1.0 body");
      const second = ledger.refs().docRevision(doc, "v1.1 body");
      ledger.recordReviewedRevision(doc, first);
      expect(ledger.reviewedDocRevisionOf(doc)).toEqual(first);
      // a later review round records its own revision — the line gate compares the
      // target against the LATEST reviewed identity
      ledger.recordReviewedRevision(doc, second);
      expect(ledger.reviewedDocRevisionOf(doc)).toEqual(second);
    } finally {
      cleanup();
    }
  });

  it("docLineVerdict — the shared identity comparison: same vs drift vs the null faces", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const doc = path.join(workspace.path, "docs", "x-p1.md");
      mkdirSync(path.dirname(doc), { recursive: true });
      writeFileSync(doc, "v1.0 body", "utf8");
      // an absent reviewed identity → null (the legacy closed face — no comparison)
      expect(ledger.docLineVerdict("1", doc)).toBeNull();
      ledger.recordReviewedRevision("1", ledger.refs().docRevision(doc, "v1.0 body"));
      // the recorded identity matches the current doc → "same" (the revision-aware BLOCK)
      expect(ledger.docLineVerdict("1", doc)).toBe("same");
      // the doc moved past the reviewed identity → "drift" (the line reopens)
      writeFileSync(doc, "v1.1 body", "utf8");
      expect(ledger.docLineVerdict("1", doc)).toBe("drift");
      // an unreadable doc → null (only present facts land — no invented identity)
      rmSync(doc);
      expect(ledger.docLineVerdict("1", doc)).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("the review gate — the D28 phantom-pending-fix suppression", () => {
  it("a drift-voided review-1 (fix cycle 2) is NOT a pending fix — the identity membership, never a count", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const doc = path.join(workspace.path, "docs", "x-spec.md");
      mkdirSync(path.dirname(doc), { recursive: true });
      writeFileSync(doc, "the reviewed body", "utf8");
      // the drift-voided review-1 shape: review cycles [1, 2] with the fix at cycle 2.
      // A `fixes(1) < reviews(2)` count comparison reads a phantom pending fix and
      // re-opens the line forever; the identity membership (2 ∈ {2}) suppresses it.
      const data = ledger.readProgress() ?? ledger.emptyProgress();
      data.waves.push({ wave: "phase-spec", rounds: { review: [1, 2], fix: [2] } });
      ledger.writeProgress(data);
      ledger.recordReviewedRevision(
        "phase-spec",
        ledger.refs().docRevision(doc, "the reviewed body"),
      );
      const verdict = ledger.reviewGate("phase-spec", doc, "phase-spec");
      // the unchanged doc stays "same" with NO pending fix (the fix cycle 2 landed)
      expect(verdict.kind).toBe("same");
      if (verdict.kind === "same") expect(verdict.pending).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("a review with no fix yet IS the pending face — the review's own fix is outstanding", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const doc = path.join(workspace.path, "docs", "y-spec.md");
      mkdirSync(path.dirname(doc), { recursive: true });
      writeFileSync(doc, "the reviewed body", "utf8");
      const data = ledger.readProgress() ?? ledger.emptyProgress();
      data.waves.push({ wave: "phase-spec", rounds: { review: [1] } });
      ledger.writeProgress(data);
      ledger.recordReviewedRevision(
        "phase-spec",
        ledger.refs().docRevision(doc, "the reviewed body"),
      );
      // the review round carries a blocker (non-APPROVED) → the fix awaits
      ledger.persistHandoff(
        "review",
        "phase-spec",
        { round: 1 },
        { findings: [{ severity: "blocker", summary: "defect" }] },
      );
      const verdict = ledger.reviewGate("phase-spec", doc, "phase-spec");
      expect(verdict.kind).toBe("same");
      if (verdict.kind === "same") expect(verdict.pending).toBe(true);
    } finally {
      cleanup();
    }
  });
});

describe("nextHopOf — the drift-reopened line's hop (the ONE assembly entry)", () => {
  it("a closed branch line whose PLAN drifted hands the derivation the review hop — branch-review · doc-drift", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const doc = path.join(workspace.path, "docs", "x-p3.md");
      mkdirSync(path.dirname(doc), { recursive: true });
      writeFileSync(doc, "v1.0 body", "utf8");
      // the branch line's reviewed identity is its PLAN's doc-revision (P21 §3/§4.1)
      ledger.recordReviewedRevision(
        "branch",
        ledger.refs().docRevision(doc, "v1.0 body"),
        "branch",
      );
      const hop = (route: Parameters<typeof ledger.nextHopOf>[0]["route"]) =>
        ledger.nextHopOf({
          type: "branch",
          key: "branch",
          route,
          target: { type: "branch", id: "branch", plan: doc },
          doc,
          docClassOf: () => "branch",
        });
      // an UNCHANGED plan keeps the closed face — no reopen, no invented hop
      expect(hop({ kind: "done" })).toMatchObject({ hop: null, reason: "closed-line" });
      // the plan moves past the bound revision — the line's active hop is its review
      // lead, whatever exit-side route the caller observed; the count table's own
      // judgment is untouched (the review route is handed IN, never re-derived)
      writeFileSync(doc, "v1.1 body", "utf8");
      const reopened = hop({ kind: "done" });
      expect(reopened).toMatchObject({ hop: "branch-review", reason: "doc-drift" });
      expect(reopened.route).toEqual({ kind: "review" });
      // a face-to-face exit route (the board's terminal anchor) reopens the same way
      expect(hop({ kind: "handoff", entry: { kind: "done" } })).toMatchObject({
        hop: "branch-review",
        reason: "doc-drift",
      });
      // a `next-wave` route is the closure predicate's OTHER member (`Ledger.routeClosed`
      // = {done, next-wave}) — the drift reopens it exactly as it reopens `done`
      expect(hop({ kind: "next-wave", tasks: "1" })).toMatchObject({
        hop: "branch-review",
        reason: "doc-drift",
      });
      // an OPEN hop is already the line's active face — the drift never overrides it
      expect(hop({ kind: "fix", reviews: "r.json" })).toMatchObject({
        hop: "fix",
        reason: "pending-fix",
      });
    } finally {
      cleanup();
    }
  });

  it("a wave line's brief drift names `brief-drift` — the doc cell alone never does", () => {
    const { ledger, cleanup } = fixture();
    try {
      const hop = (briefDrift: boolean) =>
        ledger.nextHopOf({
          type: "wave",
          key: "1",
          route: { kind: "review" },
          target: { type: "wave", id: "1", plan: "docs/kairos/plans/p3.md" },
          briefDrift,
          docClassOf: () => "wave",
        });
      // the injected brief fact is the reason cell's second source (§2.3)
      expect(hop(true)).toMatchObject({ hop: "review", reason: "brief-drift" });
      // ... and its ABSENCE is not a doc revision either: the wave face has no doc
      // identity, so the counted row stands (task-open) — never `doc-drift`.
      expect(hop(false)).toMatchObject({ hop: "review", reason: "task-open" });
    } finally {
      cleanup();
    }
  });
});

describe("lineClosed — the single line-closure judge (the board + closedWaves core)", () => {
  /** Seed a line row's raw `rounds` plane on the fixture's `test-slug` workspace. */
  const seedRow = (ledger: Ledger, key: string, rounds: Record<string, number[]>): void => {
    const data = ledger.readProgress() ?? ledger.emptyProgress();
    data.waves.push({ wave: key, rounds });
    ledger.writeProgress(data);
  };

  it("a skipped-cycle fix (`{review:[1,2], fix:[2]}`) is CLOSED — the identity read, never a count", () => {
    const { ledger, cleanup } = fixture();
    try {
      // The drift-voided review-1 shape: the first fix is cycle 2 (fix-K ⟷ review-K).
      // A count-based judge computes `fixes(1)`, reads the nonexistent fix cycle 1 and
      // reads the line OPEN; the identity judge reads the fix at its own cycle 2.
      seedRow(ledger, "plan", { review: [1, 2], fix: [2] });
      const params = { round: 2 };
      ledger.persistHandoff("review", "plan", params, { findings: [] });
      // the docs-fix face is a findings carrier (fix.plan schema) — an empty rollup is APPROVED
      ledger.persistHandoff("fix", "plan", params, { findings: [] });

      expect(ledger.lineClosed("plan", "plan")).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("a line whose latest fix round carries blockers stays OPEN — the C5 route, not the mere presence", () => {
    const { ledger, cleanup } = fixture();
    try {
      seedRow(ledger, "plan", { review: [1, 2], fix: [2] });
      const params = { round: 2 };
      // the fix's source review carries a blocker → the C5 route is a re-review, not closure
      ledger.persistHandoff("review", "plan", params, {
        findings: [{ severity: "blocker", summary: "survives" }],
      });
      ledger.persistHandoff("fix", "plan", params, { findings: [] });

      expect(ledger.lineClosed("plan", "plan")).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("a failed fix attempt 1 never shadows the clean attempt 2 — the cycle reads its LATEST attempt", () => {
    const { ledger, cleanup } = fixture();
    try {
      const params = { round: 1 };
      // review-1 carries no finding (the closing verdict), fix-1 attempt 1 is a failed
      // dispatch and attempt 2 is the clean carrier — the same cycle, two attempts.
      ledger.recordRound("plan", { op: "review", cycle: 1, attempt: 1 });
      ledger.persistHandoff("review", "plan", params, { findings: [] });
      ledger.recordRound("plan", {
        op: "fix",
        cycle: 1,
        attempt: 1,
        verdict: { treeClean: true, targetAction: false },
      });
      ledger.recordRound("plan", { op: "fix", cycle: 1, attempt: 2 });
      ledger.persistHandoff("fix", "plan", params, { findings: [] });

      // the line closed on the successful re-attempt, not on the failed first one
      expect(ledger.lineClosed("plan", "plan")).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("the drift-aware closure judge reads a DRIFTED line `reopened` and an unchanged one `closed`", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const doc = path.join(workspace.path, "docs", "z-plan.md");
      mkdirSync(path.dirname(doc), { recursive: true });
      writeFileSync(doc, "v1.0 body", "utf8");
      ledger.persistHandoff("review", "branch", { round: 1 }, { findings: [] });
      ledger.recordRound("branch", { op: "review" });
      ledger.recordReviewedRevision(
        "branch",
        ledger.refs().docRevision(doc, "v1.0 body"),
        "branch",
      );
      // the rounds/routes fact says closed, and the bound document still matches
      expect(ledger.lineClosed("branch", "branch")).toBe(true);
      expect(ledger.lineStateAt("branch", "branch", doc)).toBe("closed");
      // one plan revision later the SAME line is reopened (the gate's own reopen)
      writeFileSync(doc, "v1.1 body", "utf8");
      expect(ledger.lineClosed("branch", "branch")).toBe(true);
      expect(ledger.lineStateAt("branch", "branch", doc)).toBe("reopened");
      // no identity document on hand — only the rounds/routes fact is present
      expect(ledger.lineStateAt("branch", "branch", null)).toBe("closed");
    } finally {
      cleanup();
    }
  });

  it("a line with no review round yet is OPEN — an implement-only row never closes", () => {
    const { ledger, cleanup } = fixture();
    try {
      seedRow(ledger, "plan", { implement: [1] });
      expect(ledger.lineClosed("plan", "plan")).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("an absent row (or absent progress) is OPEN — present facts only", () => {
    const { ledger, cleanup } = fixture();
    try {
      expect(ledger.lineClosed("plan", "plan")).toBe(false);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P24 T3 — `briefDrifted` is the ONE public read of the wave line's D30 drift
// (`waveLineRoute`'s D30 leg and the next-hop reason cell both read it).
// ---------------------------------------------------------------------------

describe("P24 T3 — briefDrifted, the wave line's ONE drift read", () => {
  /** A minimal plan body over one task block (the brief renderer's input). */
  const planText = (extra: readonly string[] = []): string =>
    [
      "---",
      "title: Test Plan",
      "doc-type: plan",
      "version: v1.0",
      "date: 2026-10-09",
      "slug: x-p3",
      "---",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      "### Task 1: task 1",
      "- **DependsOn**: none",
      ...extra,
    ].join("\n");

  it("is false with no reviewed brief on record — present facts only", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const planPath = path.join(workspace.path, "plan.md");
      mkdirSync(path.dirname(planPath), { recursive: true });
      writeFileSync(planPath, planText(), "utf8");
      expect(ledger.briefDrifted("1")).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("is true when the wave's OWN section moves, false for an OUTSIDE-wave edit", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const planPath = path.join(workspace.path, "plan.md");
      mkdirSync(path.dirname(planPath), { recursive: true });
      writeFileSync(planPath, planText(), "utf8");
      ledger.recordReviewedBrief("1", planPath);
      expect(ledger.briefDrifted("1")).toBe(false);
      // an append-only backfill ADDS a sibling task — wave {1}'s brief is byte-identical
      writeFileSync(planPath, `${planText()}\n### Task 2: task 2\n- **DependsOn**: 1\n`, "utf8");
      expect(ledger.briefDrifted("1")).toBe(false);
      // the wave's OWN section moves — the reviewed brief drifts
      writeFileSync(planPath, planText(["  - extra step — checkable: green"]), "utf8");
      expect(ledger.briefDrifted("1")).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("is false when ONLY the plan's `## Constraints` moves — the fingerprint is the task projection (P29 §2.2)", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const planPath = path.join(workspace.path, "plan.md");
      mkdirSync(path.dirname(planPath), { recursive: true });
      writeFileSync(planPath, planText(), "utf8");
      ledger.recordReviewedBrief("1", planPath);
      // the SAME task section, a reworded Constraints block: Constraints is dispatch
      // input for the child, never part of the wave's reopen fingerprint
      writeFileSync(planPath, planText().replace("- delta", "- delta (reworded)"), "utf8");
      expect(ledger.briefDrifted("1")).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("is false when the plan is unreadable — an absent fact never invents a drift", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      const planPath = path.join(workspace.path, "plan.md");
      mkdirSync(path.dirname(planPath), { recursive: true });
      writeFileSync(planPath, planText(), "utf8");
      ledger.recordReviewedBrief("1", planPath);
      rmSync(planPath);
      expect(ledger.briefDrifted("1")).toBe(false);
    } finally {
      cleanup();
    }
  });
});
