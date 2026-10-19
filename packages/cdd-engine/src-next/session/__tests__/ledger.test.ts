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
import { Ledger, type ProgressData, type RefKind } from "../ledger.ts";

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
        contractViolationCount: 0,
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
      expect(ledger.rowFor(data, "1")).toEqual({ wave: "1" }); // single-task wave ≡ the task row
      expect(ledger.rowFor(data, "1,2")).toEqual({ wave: "1,2" });
      expect(ledger.rowFor(data, "missing")).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it("roundCount starts 0; recordRound persists the per-key per-mode done record", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      expect(ledger.roundCount("1,2", "review")).toBe(0);
      expect(ledger.recordRound("1,2", "review")).toBe(1);
      expect(ledger.recordRound("1,2", "review")).toBe(2);
      expect(ledger.recordRound("1,2", "fix")).toBe(1);
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

  it("recordRound records the CYCLE (its identity), defaulting to latest+1 — a skipped cycle keeps its own number", () => {
    const { ledger, cleanup } = fixture();
    try {
      // an explicit cycle records its OWN number (fix-2 = the fix that addressed review-2)
      expect(ledger.recordRound("7,9", "fix", 2)).toBe(1);
      expect(ledger.roundRecorded("7,9", "fix", 2)).toBe(true);
      expect(ledger.roundRecorded("7,9", "fix", 1)).toBe(false); // cycle 1 was skipped — never fabricated
      // a default recordRound appends the next cycle after the latest (2 → 3)
      expect(ledger.recordRound("7,9", "fix")).toBe(2);
      expect(ledger.roundRecorded("7,9", "fix", 3)).toBe(true);
      // a re-record of an existing cycle is idempotent (never doubled)
      expect(ledger.recordRound("7,9", "fix", 2)).toBe(2);
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
      expect(ledger.handoffName("review", "spec", { round: 1 })).toBe("spec-review-1.json");
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
});

describe("crash — the lane-crash recovery record", () => {
  it("names the record crash-<lane>-<round>.json at the canonical path", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      expect(ledger.crashName("implement", 2)).toBe("crash-implement-2.json");
      expect(ledger.crashPath("implement", 2)).toBe(workspace.resolve("crash-implement-2.json"));
    } finally {
      cleanup();
    }
  });

  it("writeCrash → readCrash round-trips the recovery record (the resume decision source)", () => {
    const { ledger, cleanup } = fixture();
    try {
      const record = {
        exitCode: 1,
        stderrTail: ["engine error: boom"],
        stdoutTail: [],
        attemptedHandoff: "tasks-1-implement.json",
        next: "cdd implement --tasks 1",
        cause: "child-exit" as const,
        lastSample: null,
      };
      ledger.writeCrash("implement", 1, record);
      expect(ledger.readCrash("implement", 1)).toEqual(record);
      // a recordless failure round stays recordless — the no-next failure face
      expect(ledger.readCrash("implement", 2)).toBeNull();
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
      ledger.recordRound("7,9", "review");
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
      ledger.recordRound("7,9", "fix");
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
      ledger.recordRound("7,9", "fix");
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
      ledger.recordRound("7,9", "fix");
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
      ledger.recordRound("1", "fix");
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
        ledger.recordRound("7,9", "review");
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
      ledger.recordRound("7,9", "review");
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
      ledger.recordRound("1", "review");
      ledger.recordRound("1", "review");
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
      data.waves.push({ wave: "spec", rounds: { review: [1, 2], fix: [2] } });
      ledger.writeProgress(data);
      ledger.recordReviewedRevision("spec", ledger.refs().docRevision(doc, "the reviewed body"));
      const verdict = ledger.reviewGate("spec", doc, "spec");
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
      data.waves.push({ wave: "spec", rounds: { review: [1] } });
      ledger.writeProgress(data);
      ledger.recordReviewedRevision("spec", ledger.refs().docRevision(doc, "the reviewed body"));
      // the review round carries a blocker (non-APPROVED) → the fix awaits
      ledger.persistHandoff(
        "review",
        "spec",
        { round: 1 },
        { findings: [{ severity: "blocker", summary: "defect" }] },
      );
      const verdict = ledger.reviewGate("spec", doc, "spec");
      expect(verdict.kind).toBe("same");
      if (verdict.kind === "same") expect(verdict.pending).toBe(true);
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
