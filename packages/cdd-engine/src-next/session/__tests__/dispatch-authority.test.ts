// packages/cdd-engine/src-next/session/__tests__/dispatch-authority.test.ts
// P27 §2 — the dispatch authority's behavior pin: ONE verdict object over the
// three legs (structure → upstream → line), and the line leg's nine refusal rows
// judged with the SAME reason the two retired call sites named.
//
//   · the wave face's five rows — mixed-batch · wave-too-wide · too-many-tasks ·
//     split · wrong-phase — each with its own case (the two width rows never
//     substitute for each other);
//   · the doc/branch face's rows — pending-fix · unchanged (the new token, the
//     same-revision refusal that used to carry prose only) · face-closed — plus the
//     drift reopen, which ADMITS the review round instead of refusing it;
//   · the priority chain's shape — a structure refusal short-circuits (leg
//     `structure`, no `next:`), a line refusal carries the hop the board renders.
//
// The expectations are reason tokens from the ONE table (§2.5): the case rows below
// were green against the two retired authorities before the collapse, and they are
// green against `DispatchAuthority` after it — the reason spellings never changed.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PlanDocType } from "../../contract/doc.ts";
import { ARGV_CHANNEL } from "../../face/declare.ts";
import { RouteRenderer } from "../../face/route-render.ts";
import { Words } from "../../face/words.ts";
import { ConfigLoader } from "../../infra/config.ts";
import type { RepoRoot } from "../../infra/root.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import {
  DispatchAuthority,
  type DispatchRefusal,
  type DispatchRequest,
} from "../dispatch-authority.ts";
import { TaskGraph } from "../graph.ts";
import { Ledger, ReviewRefs } from "../ledger.ts";
import type { DocClassVerdict } from "../next.ts";
import { PipelineFrontier, type PipelineFrontierInput } from "../pipeline.ts";

const words = new Words();
const refs = new ReviewRefs();

/** The frontier's injected station port — this suite's own reading: the target's
 *  type IS its doc class. The real port lives on the face plane
 *  (`BoardView.docClassOf`); the session plane never imports a face class. */
const PORTS = {
  docClassOf: (target: { readonly type: string }): DocClassVerdict =>
    target.type as DocClassVerdict,
};

interface Fixture {
  readonly repo: string;
  readonly basis: RepoRoot;
  readonly ledger: Ledger;
  readonly cleanup: () => void;
}

const fixture = (): Fixture => {
  const repo = mkdtempSync(path.join(tmpdir(), "dispatch-authority-"));
  const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "authority-slug");
  return {
    repo,
    basis: workspace.root.basis,
    ledger: new Ledger(workspace, new ConfigLoader()),
    cleanup: () => rmSync(repo, { recursive: true, force: true }),
  };
};

const planDoc = (blocks: readonly (readonly string[])[]): string => {
  return [
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
    ...blocks.flat(),
    "",
  ].join("\n");
};

const task = (id: number, dependsOn: string): readonly string[] => {
  return [`### Task ${id}: task ${id}`, `- **DependsOn**: ${dependsOn}`];
};

const graphOf = (blocks: readonly (readonly string[])[]): TaskGraph => {
  return new TaskGraph(new PlanDocType("plan").parse(planDoc(blocks).split("\n")));
};

/** The structure leg's approved verdict — the case table judges the line leg, so the
 *  pre-flight face is handed in already passed. */
const STRUCTURE_OK = { ok: true, order: [], checked: [] } as const;

const authority = new DispatchAuthority();

const waveCase = (
  ledger: Ledger,
  graph: TaskGraph,
  tasks: readonly number[],
  verb: DispatchRequest["verb"],
): DispatchRequest => ({
  verb,
  type: "wave",
  structure: STRUCTURE_OK,
  line: {
    ledger,
    words,
    graph,
    tasks: new Set(tasks),
    lineKey: null,
    doc: null,
    pipeline: { specType: null, specPath: null, planPath: null, planGraph: graph },
    docClassOf: PORTS.docClassOf,
  },
});

const docCase = (
  ledger: Ledger,
  type: "plan" | "branch" | "phase-spec",
  doc: string | null,
  verb: DispatchRequest["verb"],
  planPath: string | null = null,
): DispatchRequest => ({
  verb,
  type,
  structure: STRUCTURE_OK,
  line: {
    ledger,
    words,
    graph: null,
    tasks: null,
    lineKey: type,
    doc,
    pipeline: { specType: null, specPath: null, planPath, planGraph: null },
    docClassOf: PORTS.docClassOf,
  },
});

/** The refused verdict's reason token — null on the approved face. The ONE read the
 *  case table pins, so the nine rows compare on their reason alone. */
const reasonOf = (request: DispatchRequest): string | null => {
  const verdict = authority.verdict(request);
  return verdict.allowed ? null : verdict.reason;
};

/** The refusal of one request — the cases that pin the line itself assert on this. */
const refusalOf = (request: DispatchRequest): DispatchRefusal => {
  const verdict = authority.verdict(request);
  if (verdict.allowed) throw new Error("expected a refusal");
  return verdict;
};

/** A clean APPROVED review carrier — the C5 closure record for one line. */
const cleanReviewCarrier = (ledger: Ledger, tasks: string, round: number): void => {
  ledger.recordRound(tasks, { op: "review" });
  ledger.persistHandoff(
    "review",
    "wave",
    { tasks, round },
    { tasks: tasks.split(",").map(Number), phase: "review", findings: [] },
  );
};

describe("P27 §2.4 — the wave face's five rows (each its own case)", () => {
  it("mixed-batch — a static batch mixing closed and open tasks", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([task(1, "none"), task(2, "none")]);
      ledger.recordRound(1, { op: "implement" });
      cleanReviewCarrier(ledger, "1", 1);
      expect(reasonOf(waveCase(ledger, graph, [2], "implement"))).toBe("mixed-batch");
    } finally {
      cleanup();
    }
  });

  it("wave-too-wide — the derived open wave is wider than the ceiling", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([
        task(1, "none"),
        task(2, "none"),
        task(3, "none"),
        task(4, "1"),
        task(5, "1"),
      ]);
      ledger.recordRound("1", { op: "implement" });
      cleanReviewCarrier(ledger, "1", 1);
      ledger.recordPlanTasks("1", [1]);
      expect(reasonOf(waveCase(ledger, graph, [2, 3, 4, 5], "implement"))).toBe("wave-too-wide");
    } finally {
      cleanup();
    }
  });

  it("too-many-tasks — the requested set is wider than the ceiling (never `wave-too-wide`)", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([task(1, "none"), task(2, "none"), task(3, "1"), task(4, "1")]);
      expect(reasonOf(waveCase(ledger, graph, [1, 2, 3, 4], "implement"))).toBe("too-many-tasks");
    } finally {
      cleanup();
    }
  });

  it("split — the requested set is neither the derived wave nor wider than the ceiling", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([task(1, "none"), task(2, "none")]);
      expect(reasonOf(waveCase(ledger, graph, [1], "implement"))).toBe("split");
      expect(reasonOf(waveCase(ledger, graph, [1], "review"))).toBe("split");
    } finally {
      cleanup();
    }
  });

  it("wrong-phase — the open wave's phase is not the requested verb", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = graphOf([task(1, "none")]);
      ledger.recordRound("1", { op: "implement" });
      expect(reasonOf(waveCase(ledger, graph, [1], "implement"))).toBe("wrong-phase");
      expect(reasonOf(waveCase(ledger, graph, [1], "review"))).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("P27 §2.4 — the doc/branch face's rows", () => {
  const PLAN_REL = "docs/kairos/plans/p3.md";

  const planAt = (repo: string, content: string): string => {
    const file = path.join(repo, PLAN_REL);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content, "utf8");
    return file;
  };

  const closedPlan = (
    ledger: Ledger,
    content: string,
    findings: readonly Record<string, unknown>[] = [],
  ): void => {
    ledger.persistHandoff("review", "plan", { round: 1 }, { phase: "review", findings });
    ledger.recordRound("plan", { op: "review" });
    ledger.recordReviewedRevision("plan", refs.docRevision(PLAN_REL, content));
  };

  it("pending-fix — the line awaits its fix, so the review round is refused", () => {
    const { repo, ledger, cleanup } = fixture();
    try {
      const content = planDoc([task(1, "none")]);
      const planAbs = planAt(repo, content);
      closedPlan(ledger, content, [{ severity: "blocker", summary: "open" }]);
      expect(reasonOf(docCase(ledger, "plan", planAbs, "review", planAbs))).toBe("pending-fix");
      expect(reasonOf(docCase(ledger, "plan", planAbs, "fix", planAbs))).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("unchanged — the reviewed plan did not move (the same-revision refusal)", () => {
    const { repo, ledger, cleanup } = fixture();
    try {
      const content = planDoc([task(1, "none")]);
      const planAbs = planAt(repo, content);
      closedPlan(ledger, content);
      expect(reasonOf(docCase(ledger, "plan", planAbs, "review", planAbs))).toBe("unchanged");
    } finally {
      cleanup();
    }
  });

  it("face-closed — a closed line whose reviewed identity is unbound", () => {
    const { repo, ledger, cleanup } = fixture();
    try {
      const planAbs = planAt(repo, planDoc([task(1, "none")]));
      ledger.persistHandoff("review", "plan", { round: 1 }, { phase: "review", findings: [] });
      ledger.recordRound("plan", { op: "review" });
      expect(reasonOf(docCase(ledger, "plan", planAbs, "review", planAbs))).toBe("face-closed");
    } finally {
      cleanup();
    }
  });

  it("drift reopened — a moved identity ADMITS the review round instead of refusing it", () => {
    const { repo, ledger, cleanup } = fixture();
    try {
      const content = planDoc([task(1, "none")]);
      const planAbs = planAt(repo, content);
      closedPlan(ledger, content);
      writeFileSync(planAbs, planDoc([task(1, "none"), task(2, "1")]), "utf8");
      expect(reasonOf(docCase(ledger, "plan", planAbs, "review", planAbs))).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("the branch line's unchanged identity keeps the face-closed row (no doc-class prose)", () => {
    const { repo, ledger, cleanup } = fixture();
    try {
      const content = planDoc([task(1, "none")]);
      const planAbs = planAt(repo, content);
      ledger.persistHandoff(
        "review",
        "branch",
        { round: 1 },
        { phase: "branch-review", findings: [] },
      );
      ledger.recordRound("branch", { op: "review" });
      ledger.recordReviewedRevision("branch", refs.docRevision(PLAN_REL, content), "branch");
      expect(reasonOf(docCase(ledger, "branch", planAbs, "review", planAbs))).toBe("face-closed");
    } finally {
      cleanup();
    }
  });
});
describe("P27 §2.1/§2.2 — the verdict's shape and the priority chain", () => {
  it("a structure refusal short-circuits the chain: leg `structure`, no next", () => {
    const { ledger, cleanup } = fixture();
    try {
      // The line leg would refuse this request too (the split row); the structure
      // leg is upstream, so it owns the verdict — the actionable cause.
      const graph = graphOf([task(1, "none"), task(2, "none")]);
      const request: DispatchRequest = {
        ...waveCase(ledger, graph, [1], "implement"),
        structure: {
          ok: false,
          gate: "tree-clean",
          reason: "dirty-tree",
          message: "the working tree is dirty",
          order: ["tree-clean"],
          checked: ["tree-clean"],
        },
      };
      const verdict = authority.verdict(request);
      expect(verdict.allowed).toBe(false);
      if (verdict.allowed) throw new Error("expected a refusal");
      expect(verdict.leg).toBe("structure");
      expect(verdict.reason).toBe("tree-clean");
      expect(verdict.next).toBeNull();
      expect(authority.message(verdict, { detail: request.structure.message })).toBe(
        "tree-clean · the working tree is dirty",
      );
    } finally {
      cleanup();
    }
  });

  it("a line refusal names the hop the board renders, and ONE line renders it", () => {
    const { repo, basis, ledger, cleanup } = fixture();
    try {
      const planRel = "docs/kairos/plans/p3.md";
      const planAbs = path.join(repo, planRel);
      mkdirSync(path.dirname(planAbs), { recursive: true });
      writeFileSync(planAbs, planDoc([task(1, "none"), task(2, "none")]), "utf8");
      // The spec and plan faces closed, the wave face entered (an implement round on
      // the batch row) — so the frontier is the wave face and its hop is the wave's
      // own next round, not a face-to-face handoff.
      ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
      ledger.recordRound("phase-spec", { op: "review" });
      ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
      ledger.recordRound("plan", { op: "review" });
      ledger.recordRound("1,2", { op: "implement" });

      const graph = new TaskGraph(
        new PlanDocType("plan").parse(readFileSync(planAbs, "utf8").split("\n")),
      );
      const pipeline: PipelineFrontierInput = {
        specType: null,
        specPath: null,
        planPath: planAbs,
        planGraph: graph,
      };
      const request: DispatchRequest = {
        verb: "implement",
        type: "wave",
        structure: STRUCTURE_OK,
        line: {
          ledger,
          words,
          graph,
          tasks: new Set([1]),
          lineKey: null,
          doc: null,
          pipeline,
          docClassOf: PORTS.docClassOf,
        },
      };
      const refusal = refusalOf(request);
      expect(refusal.leg).toBe("line");
      expect(refusal.reason).toBe("split");
      // The `next` cell IS the pipeline frontier's hop — the object the board renders.
      expect(refusal.next).toEqual(new PipelineFrontier(ledger).hopOf(pipeline, PORTS));
      const renderer = new RouteRenderer(words, ARGV_CHANNEL, "", basis);
      const line = authority.message(refusal, { command: (hop) => renderer.renderHop(hop) ?? "" });
      expect(line).toBe(`split · next: review --type wave --tasks 1,2 --plan ${planRel}`);
    } finally {
      cleanup();
    }
  });
});

describe("P27 §2.7 — the authority is the ONLY dispatch call site", () => {
  it("neither retired call point survives: zero `WaveGate` in the seam, zero `lineGate` in the CLI", () => {
    const seam = readFileSync(fileURLToPath(new URL("../preflight.ts", import.meta.url)), "utf8");
    const cli = readFileSync(fileURLToPath(new URL("../../face/cli.ts", import.meta.url)), "utf8");
    // The wave face's phase judgment left the structure seam entirely.
    expect(seam).not.toMatch(/WaveGate/);
    // The doc/branch line's phase judgment left the CLI: the gate reads the verdict.
    expect(cli).not.toMatch(/lineGate/);
    expect(cli).toContain("this.#authority.verdict(");
    // The authority is the one place that composes the wave gate.
    const authority = readFileSync(
      fileURLToPath(new URL("../dispatch-authority.ts", import.meta.url)),
      "utf8",
    );
    expect(authority).toContain("this.#waveGate.vet(");
  });

  it("the line-phase walk has ONE host — the gate's `lineGate` reads the authority's fact", () => {
    const gate = readFileSync(
      fileURLToPath(new URL("../../face/gate.ts", import.meta.url)),
      "utf8",
    );
    const authority = readFileSync(
      fileURLToPath(new URL("../dispatch-authority.ts", import.meta.url)),
      "utf8",
    );
    // The walk (reviewGate → drift reopen → pending fix → linePhase) lives ONCE, on the
    // session plane; the face's line-gate is that value's render shell.
    expect(authority).toContain("linePhaseFacts(");
    expect(gate).toContain("this.#authority.linePhaseFacts(");
    // No second host: the face keeps no private phase walk of its own …
    expect(gate).not.toContain("ledger.linePhase(");
    expect(gate).not.toContain("ledger.docReopens(");
    // … and the dead line-hop reader is gone (the refusal renders the verdict's hop).
    expect(gate).not.toMatch(/lineHop\(scene/);
  });
});
