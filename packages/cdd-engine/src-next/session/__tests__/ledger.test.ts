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

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../ledger.ts";

const BASE = "a".repeat(8);
const HEAD = "b".repeat(8);

/** A hermetic ledger fixture — a fresh temp workspace under a temp repo root. */
function fixture(): { ledger: Ledger; workspace: Workspace; cleanup: () => void } {
  const repo = mkdtempSync(path.join(tmpdir(), "ledger-"));
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repo, ".kairos", "cdd"), "session"),
    "test-slug",
  );
  const ledger = new Ledger(workspace, new ConfigLoader());
  return { ledger, workspace, cleanup: () => rmSync(repo, { recursive: true, force: true }) };
}

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
      // (the range token left the file name — the carrier's commits hold the shas)
      expect(
        ledger.handoffName("review", "branch", { base8: "abc12345", head8: "def56789", round: 1 }),
      ).toBe("branch-review-1.json");
      expect(
        ledger.handoffName("fix", "branch", { base8: "abc12345", head8: "def56789", round: 2 }),
      ).toBe("branch-fix-2.json");
    } finally {
      cleanup();
    }
  });

  it("buildHandoff carries ONLY the schema-declared writable fields — identity rides the file name, never phase/tasks inline (v1.30)", () => {
    const { ledger, cleanup } = fixture();
    try {
      const carrier = ledger.buildHandoff({ artifacts: { brief: "/tmp/brief.md" } });
      // the carrier's plane is the schema's declared fields — no inline phase/tasks
      // identity (the canonical file name `tasks-7,9-review-1.json` carries it; inline
      // identity seeded the mimicking precedence the reserved gate then had to refuse)
      expect("phase" in carrier).toBe(false);
      expect("tasks" in carrier).toBe(false);
      expect(carrier.findings).toEqual([]);
      expect(carrier.artifacts).toEqual({ brief: "/tmp/brief.md" });
      expect(ledger.buildHandoff({}).artifacts).toEqual({});
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
        snapshotSha: "a".repeat(8),
        attemptedHandoff: "tasks-1-implement.json",
        next: "cdd implement --tasks 1",
        cause: "child-exit" as const,
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
          commits: { base: BASE, head: HEAD },
        },
      );
      const carrier = ledger.round("review", "wave", { tasks: "7,9" }, 1);
      expect(carrier).not.toBeNull();
      expect(carrier!.phase).toBe("review");
      expect(carrier!.findings).toEqual([
        { severity: "blocker", summary: "defect" },
        { severity: "warn", summary: "smell" },
      ]);
      expect(carrier!.findingsPath).toBe(workspace.resolve("tasks-7,9-review-1.json"));
      expect(carrier!.commits).toEqual({ base: BASE, head: HEAD });
      expect(carrier!.consecutiveS1).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("fix rounds carry the SOURCE review's findings + the fix's own commits (C5-1)", () => {
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
        { phase: "fix", findings: [], commits: { base: BASE, head: HEAD } },
      );
      const carrier = ledger.round("fix", "wave", { tasks: "7,9" }, 1);
      expect(carrier).not.toBeNull();
      expect(carrier!.phase).toBe("fix");
      // the judgment findings are the source review's input, never the fix's own empty carrier
      expect(carrier!.findings).toEqual([{ severity: "blocker", summary: "the input findings" }]);
      expect(carrier!.commits).toEqual({ base: BASE, head: HEAD });
      expect(carrier!.findingsPath).toBe(workspace.resolve("tasks-7,9-review-1.json"));
      expect(carrier!.consecutiveS1).toBe(1);
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
        { phase: "fix", findings: [], commits: { base: BASE, head: HEAD } },
      );
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
      // review round 2 is the evaluated round but the file is missing → the run starts cold
      expect(ledger.round("review", "wave", { tasks: "1" }, 2)).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("review references — the refKind face (T25 · P5)", () => {
  it("the four-kind classification — one target type → one ref kind (the four typed families)", () => {
    const { ledger, cleanup } = fixture();
    try {
      const refs = ledger.refs();
      expect(refs.kindOf("wave")).toBe("commit-set-ledger");
      expect(refs.kindOf("branch")).toBe("commit-range");
      expect(refs.kindOf("spec")).toBe("doc-revision");
      expect(refs.kindOf("plan")).toBe("doc-revision");
    } finally {
      cleanup();
    }
  });

  it("the four ref families derive their typed records (the commit-set ledger · the commit range · the two-layer doc revision · the graph node)", () => {
    const { ledger, cleanup } = fixture();
    try {
      const refs = ledger.refs();
      const commitSet = refs.commitSet("1,2", { base: BASE, head: HEAD } as const);
      expect(commitSet).toEqual({
        kind: "commit-set-ledger",
        wave: "1,2",
        commits: { base: BASE, head: HEAD },
      } as const);
      const commitRange = refs.commitRange(BASE, HEAD);
      expect(commitRange).toEqual({ kind: "commit-range", base: BASE, head: HEAD } as const);
      // the doc-revision two-layer binding — the doc path + the content-hash revision
      const docRef = refs.docRevision("docs/kairos/specs/x-design.md", "revision one");
      expect(docRef.kind).toBe("doc-revision");
      expect(docRef.doc).toBe("docs/kairos/specs/x-design.md");
      // the doc-revision content hash stays a full sha1 hex — a non-ref digest,
      // unsliced (the 8-char form is the commit-refs surface, not this binding)
      expect(docRef.doc_hash).toMatch(/^[0-9a-f]{40}$/);
      // the same content hashes the same revision — the two-layer convergence
      const docRefAgain = refs.docRevision("docs/kairos/specs/x-design.md", "revision one");
      expect(docRefAgain.doc_hash).toBe(docRef.doc_hash);
      // a different revision hashes differently — the revision layer is content-bound
      const edited = refs.docRevision("docs/kairos/specs/x-design.md", "revision two");
      expect(edited.doc_hash).not.toBe(docRef.doc_hash);
      const graphNode = refs.graphNode(7);
      expect(graphNode).toEqual({ kind: "graph-node", node: 7 } as const);
    } finally {
      cleanup();
    }
  });

  it("the same-ref ruling — the SAME doc revision bound twice is rejected (the same-ref reject negative)", () => {
    const { ledger, cleanup } = fixture();
    try {
      const refs = ledger.refs();
      const docRef = refs.docRevision("docs/kairos/specs/x-design.md", "revision one");
      expect(refs.bind(docRef)).toBe(docRef);
      // the identical ref (same doc + same hash) is the SAME ref → rejected
      const duplicate = refs.docRevision("docs/kairos/specs/x-design.md", "revision one");
      expect(refs.bind(duplicate)).toBeNull();
      // a different revision of the same doc is NOT the same ref → binds
      const edited = refs.docRevision("docs/kairos/specs/x-design.md", "revision two");
      expect(refs.bind(edited)).toBe(edited);
      // a different doc is never the same ref
      const otherDoc = refs.docRevision("docs/kairos/specs/y-design.md", "revision one");
      expect(refs.bind(otherDoc)).toBe(otherDoc);
      expect(refs.bound()).toHaveLength(3);
    } finally {
      cleanup();
    }
  });

  it("the same-ref ruling across families — ranges, waves and nodes", () => {
    const { ledger, cleanup } = fixture();
    try {
      const refs = ledger.refs();
      const range = refs.commitRange(BASE, HEAD);
      expect(refs.bind(range)).toBe(range);
      expect(refs.bind(refs.commitRange(BASE, HEAD))).toBeNull();
      expect(refs.bind(refs.commitSet("1", { base: BASE, head: HEAD }))).not.toBeNull();
      expect(refs.bind(refs.commitSet("1", { base: BASE, head: HEAD }))).toBeNull();
      expect(refs.bind(refs.graphNode(3))).not.toBeNull();
      expect(refs.bind(refs.graphNode(3))).toBeNull();
    } finally {
      cleanup();
    }
  });
});
