// packages/cdd-engine/src-next/session/__tests__/wave.test.ts
// T24 (v1.21) — WaveGate suite: the three-verb unified wave gate over a hermetic
// ledger + task graph:
//   · the only read face — open = frontier(closedTasks()) (the C5 closure set);
//   · the split/subset BLOCK — a `--tasks` set that splits or mismatches the derived
//     wave (implement AND review AND fix share the same refusal);
//   · the wrong-phase BLOCK — the open wave is at a phase ≠ the requested verb;
//   · the heterogeneous-phase BLOCK — the open wave holds mixed phases (the named
//     ledger anomaly + the per-task phase map);
//   · the approved verdict — requested == open at the verb's phase.
// Fixtures are plan literals parsed through the plan parser + a hermetic temp
// workspace (the pattern the run/ledger suites share).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PlanDocType } from "../../contract/doc.ts";
import { Words } from "../../face/words.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { TaskGraph } from "../graph.ts";
import { Ledger } from "../ledger.ts";
import { WaveGate } from "../wave.ts";

/** A hermetic ledger fixture — a fresh temp workspace (the run tests' pattern). */
function fixture(): { ledger: Ledger; cleanup: () => void } {
  const repo = mkdtempSync(path.join(tmpdir(), "wave-"));
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repo, ".kairos", "cdd"), "session"),
    "wave-slug",
  );
  return {
    ledger: new Ledger(workspace, new ConfigLoader()),
    cleanup: () => rmSync(repo, { recursive: true, force: true }),
  };
}

/** A plan document over `### Task N:` blocks + `- **DependsOn**:` values. */
function planDoc(blocks: readonly (readonly string[])[]): string {
  return [
    "# Test Plan",
    "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
    "- **Parent program**: [x-overall.md v1.0](docs/kairos/specs/x-overall.md)",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    ...blocks.flat(),
  ].join("\n");
}

function task(id: number, dependsOn: string): readonly string[] {
  return [`### Task ${id}: task ${id}`, `- **DependsOn**: ${dependsOn}`];
}

/** Parse a fixture and build the TaskGraph — the gate's frontier source. */
function graphOf(blocks: readonly (readonly string[])[]): TaskGraph {
  return new TaskGraph(new PlanDocType("plan").parse(planDoc(blocks).split("\n")));
}

const gate = new WaveGate();
const words = new Words();
const base = "a".repeat(40);
const head = "b".repeat(40);

/** A clean APPROVED review carrier — the C5 closure record for a task line. */
function cleanReviewCarrier(ledger: Ledger, tasks: string, round: number): void {
  ledger.recordRound(tasks, "review");
  ledger.persistHandoff(
    "review",
    "task",
    { tasks, round },
    { tasks: tasks.split(",").map(Number), phase: "review", findings: [], commits: { base, head } },
  );
}

describe("WaveGate.vet — the split/subset BLOCK (three-verb shared)", () => {
  it("a `--tasks` splitting the derived wave BLOCKs — implement, review and fix alike", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([task(1, "none"), task(2, "1")]); // the open wave = {1}
      for (const verb of ["implement", "review", "fix"] as const) {
        const verdict = gate.vet(new Set([1, 2]), verb, graph, ledger, words);
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toBe("split");
        expect(verdict.open).toEqual([1]);
        expect(verdict.message).toContain("derived wave");
      }
    } finally {
      cleanup();
    }
  });

  it("a backend task request before its dependency closes BLOCKs (the wave still opens at the dep)", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([task(1, "none"), task(2, "1")]);
      const verdict = gate.vet(new Set([2]), "implement", graph, ledger, words);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toBe("split");
      expect(verdict.message).toContain("(1)");
    } finally {
      cleanup();
    }
  });
});

describe("WaveGate.vet — the wrong-phase BLOCK", () => {
  it("an open wave at the review phase refuses an implement dispatch (run the review first)", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([task(1, "none")]);
      ledger.recordRound(1, "implement"); // task 1 implemented → its phase is review
      const verdict = gate.vet(new Set([1]), "implement", graph, ledger, words);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toBe("wrong-phase");
      expect(verdict.message).toContain("at review");
    } finally {
      cleanup();
    }
  });

  it("a clean-closed wave refuses any further verb — the line sits in no open phase", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([task(1, "none")]);
      ledger.recordRound(1, "implement");
      cleanReviewCarrier(ledger, "1", 1); // review approved → task 1 closed
      // closedTasks now contains 1 → frontier over it is empty → the wave gate sees
      // an empty open wave; a requested {1} mismatches ({1} ≠ {}) → the split BLOCK.
      const verdict = gate.vet(new Set([1]), "review", graph, ledger, words);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toBe("split");
      expect(verdict.open).toEqual([]);
    } finally {
      cleanup();
    }
  });
});

describe("WaveGate.vet — the open wave's phase is EXACTLY the requested verb", () => {
  it("an open wave at the review phase approves a review dispatch", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([task(1, "none")]);
      ledger.recordRound(1, "implement");
      const verdict = gate.vet(new Set([1]), "review", graph, ledger, words);
      expect(verdict.ok).toBe(true);
      expect(verdict.open).toEqual([1]);
    } finally {
      cleanup();
    }
  });

  it("an unimplemented root wave approves the implement dispatch", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([task(1, "none"), task(2, "none")]);
      const verdict = gate.vet(new Set([1, 2]), "implement", graph, ledger, words);
      expect(verdict.ok).toBe(true);
      expect(verdict.open).toEqual([1, 2]);
    } finally {
      cleanup();
    }
  });
});

describe("WaveGate.vet — the heterogeneous-phase BLOCK (the named ledger anomaly)", () => {
  it("an open wave holding mixed phases BLOCKs with the per-task phase map", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([task(1, "none"), task(2, "none")]);
      ledger.recordRound(1, "implement"); // task 1 → review; task 2 → implement (no rounds)
      const verdict = gate.vet(new Set([1, 2]), "implement", graph, ledger, words);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toBe("heterogeneous");
      expect(verdict.message).toContain("mixed phases");
      expect(verdict.message).toContain("T1:review");
      expect(verdict.message).toContain("T2:implement");
      expect(verdict.phases).toEqual([
        { task: 1, phase: "review" },
        { task: 2, phase: "implement" },
      ]);
    } finally {
      cleanup();
    }
  });
});

describe("ledger.closedTasks — the C5 closure single read face", () => {
  it("an implement-only task is never closed (implement rounds carry no closure verdict)", () => {
    const { ledger, cleanup } = fixture();
    try {
      ledger.recordRound(1, "implement");
      expect(ledger.closedTasks()).toEqual(new Set());
    } finally {
      cleanup();
    }
  });

  it("a clean review closes the task — the C5 route is the closure predicate", () => {
    const { ledger, cleanup } = fixture();
    try {
      ledger.recordRound(1, "implement");
      cleanReviewCarrier(ledger, "1", 1);
      expect(ledger.closedTasks()).toEqual(new Set([1]));
    } finally {
      cleanup();
    }
  });

  it("a review with blocker findings holds the task open (the fix awaits — not a closure)", () => {
    const { ledger, cleanup } = fixture();
    try {
      ledger.recordRound(1, "implement");
      ledger.persistHandoff(
        "review",
        "task",
        { tasks: "1", round: 1 },
        { findings: [{ severity: "blocker", summary: "defect" }], commits: { base, head } },
      );
      ledger.recordRound(1, "review");
      expect(ledger.closedTasks()).toEqual(new Set());
    } finally {
      cleanup();
    }
  });

  it("a merged-wave row naturalizes through ITS OWN review/fix pair (never a per-member read)", () => {
    const { ledger, cleanup } = fixture();
    try {
      // The historical merged-wave row carries the review+fix pair — the pair's C5 route
      // decides both members, without per-member implement rows.
      ledger.recordRound("4,12", "review");
      ledger.persistHandoff(
        "review",
        "task",
        { tasks: "4,12", round: 1 },
        { tasks: [4, 12], phase: "review", findings: [], commits: { base, head } },
      );
      expect(ledger.closedTasks()).toEqual(new Set([4, 12]));
    } finally {
      cleanup();
    }
  });
});
