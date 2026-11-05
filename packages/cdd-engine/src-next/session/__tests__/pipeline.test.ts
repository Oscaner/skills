// packages/cdd-engine/src-next/session/__tests__/pipeline.test.ts
// The pipeline frontier suite — the four face-order rules pinned at their OWN home
// (`PipelineFrontier`, the session plane), never through the board's render.
//
// The four rules (the retired `BoardNext#pipeline` semantics, moved verbatim):
//   · rule 1 — the FRONTIER face (first not-closed) holding an active C5 hop renders
//     that hop (the in-flight work — `review` / `fix` / `implement` / `next-wave`);
//   · rule 2 — the frontier holds no active hop but IS entered (a render target is
//     present) → its OWN pipeline exit;
//   · rule 3 — the frontier is NOT entered (no target — an absent doc, or a face whose
//     OWN entry predicate never held) → the transition INTO it: the PRECEDING entered
//     face's exit; none preceding → the FIRST face's exit (the `Math.max(0, …)` clamp);
//   · rule 4 — every face closed → the LAST entered face's exit (the terminus).
// `face` is the face the ROUTE belongs to: rules 1 / 2 answer the frontier face, and
// the two exchange rules (3 / 4) answer `null` — the route belongs to the anchor face
// the `target` cell names.
//
// Parity is a REGRESSION pin owned by the board suite (`board-view.test.ts` (h) /
// (h2) compare the board's `next:` with the line's own `peekNext()` hop), and it only
// holds where the frontier face carries a renderable frame of its own. The three
// states outside that scope are pinned by the board's byte assertions instead, never
// as an equation here: a not-entered frontier (the board takes the PRECEDING face's
// exit), an entered frontier with no active hop (its own exit), and an all-closed
// pipeline (the terminus). This suite therefore never compares against board output.
//
// The plan face's OWN drift cell is pinned here (the judgement's home): a reviewed
// plan that moved past its bound revision reopens the plan face, so the frontier
// HOLDS there — a rule-2 instance — instead of walking on to the wave batch. The
// board suite keeps a separate pin on the bytes that cell renders.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PlanDocType } from "../../contract/doc.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { TaskGraph } from "../graph.ts";
import { Ledger } from "../ledger.ts";
import { PIPELINE_NEXT } from "../next.ts";
import { PipelineFrontier, type PipelineFrontierInput } from "../pipeline.ts";

/** The frontier assembly's injected station port — this suite's own reading: the
 *  target's type IS its doc class for the two faces these cases reach. The real
 *  port lives on the face plane (`BoardView.docClassOf`); the session plane never
 *  imports a face class. */
const PORTS = {
  docClassOf: (target: { readonly type: string }): "wave" | "plan" =>
    target.type === "wave" ? "wave" : "plan",
} as const;

describe("PipelineFrontier — the four face-order rules at their session-plane home", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "pipeline-frontier-"));
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  const writeDoc = (rel: string, lines: readonly string[]): string => {
    const file = path.join(repo, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
    return file;
  };

  const taskBlock = (id: number, dependsOn: string): readonly string[] => [
    `### Task ${id}: t${id}`,
    "- **Objective**: o",
    "- **Files**: `a.ts`",
    "- **Consumes**: x",
    "- **Produces**: y",
    "- **Steps**:",
    "  - s — checkable: g",
    "- **Acceptance**: ok",
    `- **DependsOn**: ${dependsOn}`,
    "",
  ];

  const specDoc = (): string =>
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "---",
    ]);

  const planDoc = (tasks: readonly number[][]): string =>
    writeDoc("docs/kairos/plans/prog-p1.md", [
      "---",
      "title: Plan",
      "doc-type: plan",
      "slug: prog-p1",
      "---",
      "",
      "## Constraints",
      "",
      "- c",
      "",
      // Each layer depends on the PREVIOUS layer's ids, so the declared layers are the
      // derived batches (`[[1]]` == one batch, `[[1], [2]]` == two).
      ...tasks.flatMap((layer, index) =>
        layer.flatMap((id) =>
          taskBlock(id, index === 0 ? "none" : (tasks[index - 1] ?? []).join(", ")),
        ),
      ),
    ]);

  const graphOf = (planPath: string): TaskGraph =>
    new TaskGraph(new PlanDocType("plan").parse(readFileSync(planPath, "utf8").split("\n")));

  const ledgerOf = (): Ledger =>
    new Ledger(
      new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure(),
      new ConfigLoader(),
    );

  const inputOf = (over: Partial<PipelineFrontierInput> = {}): PipelineFrontierInput => ({
    specType: "phase-spec",
    specPath: null,
    planPath: null,
    planGraph: null,
    ...over,
  });

  /** Close the spec + plan lines (a recorded zero-findings review each) so the wave
   *  face IS the frontier. */
  const closeSpecAndPlan = (ledger: Ledger): void => {
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
  };

  it("rule 1 — the frontier face with an ACTIVE hop renders that hop, owned by its own face", () => {
    const specPath = specDoc();
    const planPath = planDoc([[1]]);
    const ledger = ledgerOf();
    closeSpecAndPlan(ledger);
    // One DISPATCHED-but-BLOCKED implement round (a non-target action): the wave face
    // counts as entered, while its line still awaits the implement dispatch.
    ledger.recordRound("1", {
      op: "implement",
      verdict: { treeClean: true, targetAction: false },
    });
    const next = new PipelineFrontier(ledger).next(
      inputOf({ specPath, planPath, planGraph: graphOf(planPath) }),
    );
    expect(next.face).toBe("wave");
    expect(next.route).toEqual({ kind: "next-wave", tasks: "1" });
    expect(next.target).toEqual({ type: "wave", id: "1", plan: planPath });
  });

  it("rule 3 — a plan with NO task block never enters the wave face (re-anchored)", () => {
    const specPath = specDoc();
    // Zero-batch fixture: no wave was ever dispatched, so the wave face's OWN entry
    // predicate never held — the face is NOT entered and the frontier exchanges from
    // the preceding (plan) face. Rule 2's own pin lives in the next case.
    const planPath = planDoc([]);
    const ledger = ledgerOf();
    closeSpecAndPlan(ledger);
    const next = new PipelineFrontier(ledger).next(
      inputOf({ specPath, planPath, planGraph: graphOf(planPath) }),
    );
    expect(next.face).toBeNull();
    expect(next.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT.plan });
    expect(next.target).toEqual({ type: "plan", id: planPath, plan: planPath });
  });

  it("rule 2 — an ENTERED wave face with no active hop renders its OWN exit", () => {
    const specPath = specDoc();
    const planPath = planDoc([[1]]);
    const ledger = ledgerOf();
    closeSpecAndPlan(ledger);
    // The face IS entered (an implement round was dispatched) but the line holds no
    // active hop: the review round carries no readable review handoff, so
    // `waveLineRoute` answers null (`ledger.ts` `carried === null`).
    ledger.recordRound("1", { op: "implement" });
    ledger.recordRound("1", { op: "review" });
    const frontier = new PipelineFrontier(ledger);
    const next = frontier.next(inputOf({ specPath, planPath, planGraph: graphOf(planPath) }));
    expect(next.face).toBe("wave");
    expect(next.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT.wave });
    expect(next.target).toEqual({ type: "wave", id: "1", plan: planPath });
  });

  it("rule 3 — an UNENTERED wave face hands off from the plan face (the fresh-plan window)", () => {
    const specPath = specDoc();
    const planPath = planDoc([[1]]);
    const ledger = ledgerOf();
    closeSpecAndPlan(ledger);
    // Both doc lines closed, a task graph present, and ZERO wave rounds: the wave face
    // was never entered. All THREE verdict cells are asserted — clearing `active`
    // alone would fall into rule 2 and render the wave face's own exit instead.
    const frontier = new PipelineFrontier(ledger);
    const input = inputOf({ specPath, planPath, planGraph: graphOf(planPath) });
    const next = frontier.next(input);
    expect(next.face).toBeNull();
    expect(next.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT.plan });
    expect(next.target).toEqual({ type: "plan", id: planPath, plan: planPath });
    // The hop assembly follows the same verdict: no hop, the closed-line reason.
    const hop = frontier.hopOf(input, PORTS);
    expect(hop.hop).toBeNull();
    expect(hop.reason).toBe("closed-line");
  });

  it("the entry predicate is FACE-level — a closed batch 1 does not retreat", () => {
    const specPath = specDoc();
    // Two batches: batch 1 = {1}, batch 2 = {2}. Once batch 1 closes, the ready wave
    // key IS "2" and it carries no round of its own — a per-key predicate would read
    // this batch boundary as "never entered" and retreat to the plan handoff.
    const planPath = planDoc([[1], [2]]);
    const ledger = ledgerOf();
    closeSpecAndPlan(ledger);
    ledger.recordRound("1", { op: "implement" });
    ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
    ledger.recordRound("1", { op: "review" });
    const next = new PipelineFrontier(ledger).next(
      inputOf({ specPath, planPath, planGraph: graphOf(planPath) }),
    );
    expect(next.face).toBe("wave");
    expect(next.route).toEqual({ kind: "next-wave", tasks: "2" });
    expect(next.target).toEqual({ type: "wave", id: "2", plan: planPath });
  });

  it("rule 3's twin — one wave round restores the wave face's own literals", () => {
    const specPath = specDoc();
    const planPath = planDoc([[1]]);
    const ledger = ledgerOf();
    closeSpecAndPlan(ledger);
    const frontier = new PipelineFrontier(ledger);
    const input = inputOf({ specPath, planPath, planGraph: graphOf(planPath) });
    // The SAME fixture as the fresh-plan window, one wave round later (an implement
    // dispatch whose verdict need not be a target action). A completed implement round
    // puts the wave line at its review hop — the wave face's own literal, not a handoff.
    ledger.recordRound("1", { op: "implement" });
    const next = frontier.next(input);
    expect(next.face).toBe("wave");
    expect(next.route).toEqual({ kind: "review" });
    expect(next.target).toEqual({ type: "wave", id: "1", plan: planPath });
    const hop = frontier.hopOf(input, PORTS);
    expect(hop.hop).toBe("review");
    expect(hop.reason).toBe("task-open");
  });

  it("rule 3 — a NOT-entered frontier hands off from the PRECEDING face, `face` is null", () => {
    const specPath = specDoc();
    const ledger = ledgerOf();
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    // No plan document at all: the plan face is the frontier and was never entered.
    const next = new PipelineFrontier(ledger).next(inputOf({ specPath }));
    expect(next.face).toBeNull();
    expect(next.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT["phase-spec"] });
    expect(next.target).toEqual({ type: "phase-spec", id: specPath });

    // The fallback half of the same rule: no face precedes the frontier either, so the
    // anchor clamps to the FIRST face's exit (`Math.max(0, -1)`).
    const bare = new PipelineFrontier(ledgerOf()).next(inputOf());
    expect(bare.face).toBeNull();
    expect(bare.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT["phase-spec"] });
    expect(bare.target).toBeNull();
  });

  it("rule 4 — every face closed renders the LAST entered face's exit, `face` is null", () => {
    const specPath = specDoc();
    const planPath = planDoc([[1]]);
    const ledger = ledgerOf();
    closeSpecAndPlan(ledger);
    ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
    ledger.recordRound("1", { op: "review" });
    ledger.persistHandoff("review", "branch", { round: 1 }, { findings: [] });
    ledger.recordRound("branch", { op: "review" });
    const next = new PipelineFrontier(ledger).next(
      inputOf({ specPath, planPath, planGraph: graphOf(planPath) }),
    );
    expect(next.face).toBeNull();
    expect(next.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT.branch });
    expect(next.target).toEqual({ type: "branch", id: "branch", plan: planPath });
  });

  it("rule 2 — the plan face's drift cell halts a drifted reviewed plan on its own face", () => {
    const specPath = specDoc();
    const planPath = planDoc([[1]]);
    const ledger = ledgerOf();
    // Both doc lines close on a clean round and bind the revision each judged — the
    // key/identity pairs a real run's write-back records, so the plan cell has a real
    // identity to drift past.
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.recordReviewedRevision(
      "phase-spec",
      ledger.refs().docRevision(specPath, readFileSync(specPath, "utf8")),
      "phase-spec",
    );
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    ledger.recordReviewedRevision(
      "plan",
      ledger.refs().docRevision(planPath, readFileSync(planPath, "utf8")),
      "plan",
    );
    const frontier = new PipelineFrontier(ledger);
    const input = inputOf({ specPath, planPath, planGraph: graphOf(planPath) });
    // A wave round enters the wave face (outside P25 §6's window), so the undrifted
    // frontier walks past both doc faces onto it.
    ledger.recordRound("1", {
      op: "implement",
      verdict: { treeClean: true, targetAction: false },
    });
    // Undrifted: both doc faces are closed, so the frontier walks on to the wave batch.
    expect(frontier.next(input).face).toBe("wave");
    // One plan revision later the plan face's own cell reopens on the document it bound.
    writeFileSync(planPath, `${readFileSync(planPath, "utf8")}\n<!-- drift -->\n`, "utf8");
    const drifted = frontier.next(input);
    expect(drifted.face).toBe("plan");
    expect(drifted.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT.plan });
    expect(drifted.target).toEqual({ type: "plan", id: planPath, plan: planPath });
  });
});
