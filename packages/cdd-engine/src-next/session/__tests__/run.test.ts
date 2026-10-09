// packages/cdd-engine/src-next/session/__tests__/run.test.ts
// T8 Lifecycle suite (design spec §3.3) — the parameterized single lifecycle:
//   · the faces table — one row per target type (task / branch / spec / plan) with
//     the audit descriptor, the review-lead mode and the batch next semantics (the
//     design spec §3.3 divergence parameters);
//   · the four-type end-to-end small loops — advance() as one dispatch step
//     (frontier → dispatch → bookkeeping → next routing) over a hermetic ledger,
//     driven to the line's closure;
//   · the capsule interaction seam — the CapsuleFace interface the step renders
//     through at the interaction point (non-hard consumption: the step advances
//     output-less without a capsule; T10's Capsule satisfies the same shape).
// Fixtures are plan literals parsed through the plan parser + a hermetic temp
// workspace — the ledger round reads hit the on-disk handoffs exactly as the
// production loop does.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PlanDocType } from "../../contract/doc.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { type TargetFace, type TargetType, targetFaces } from "../faces.ts";
import { TaskGraph } from "../graph.ts";
import { Ledger } from "../ledger.ts";
import { SOFT_CAP_SUGGESTION } from "../next.ts";
import type { CapsuleFace, DispatchOutcome, DispatchStep, OpenFrame, StepResult } from "../run.ts";
import { EMPTY_RUN_STATE, Lifecycle } from "../run.ts";

const BASE = "a".repeat(40);
const HEAD = "b".repeat(40);
const DOC = "docs/kairos/specs/x-design.md";

/** A hermetic ledger fixture — a fresh temp workspace (the ledger tests' pattern). */
function fixture(): { ledger: Ledger; workspace: Workspace; cleanup: () => void } {
  const repo = mkdtempSync(path.join(tmpdir(), "run-"));
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repo, ".kairos", "cdd"), "session"),
    "test-slug",
  );
  const ledger = new Ledger(workspace, new ConfigLoader());
  return { ledger, workspace, cleanup: () => rmSync(repo, { recursive: true, force: true }) };
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

/** One task block with its `- **DependsOn**:` edge. */
function task(id: number, dependsOn: string): readonly string[] {
  return [`### Task ${id}: task ${id}`, `- **DependsOn**: ${dependsOn}`];
}

/** Parse a fixture and build the TaskGraph — the task face's run state. */
function taskGraph(blocks: readonly (readonly string[])[]): TaskGraph {
  return new TaskGraph(new PlanDocType("plan").parse(planDoc(blocks).split("\n")));
}

/** A dispatch stub — records every dispatched frame and answers per phase. */
function stub(script: (frame: OpenFrame) => DispatchOutcome): {
  step: DispatchStep;
  calls: OpenFrame[];
} {
  const calls: OpenFrame[] = [];
  return {
    calls,
    step: (frame) => {
      calls.push(frame);
      return script(frame);
    },
  };
}

/** The approved-implement outcome — the canonical work-round result. */
const APPROVED_IMPLEMENT: DispatchOutcome = {
  status: "APPROVED",
  commits: { base: BASE, head: HEAD },
  artifacts: { brief: "/tmp/brief.md" },
};

const finding = (severity: "blocker" | "warn" | "nit") => ({ severity, summary: "drift" });

const phasesOf = (steps: readonly StepResult[]): readonly (string | null)[] =>
  steps.map((step) => step.frame.phase);

describe("the faces table — one row per target type", () => {
  it("declares the four CLI `--type` values in the single table", () => {
    expect(Object.keys(targetFaces)).toEqual(["wave", "branch", "spec", "plan"]);
    for (const type of Object.keys(targetFaces) as TargetType[]) {
      expect(targetFaces[type].type).toBe(type);
    }
  });

  it("task — the task-graph audit, the review lead, batch continuation", () => {
    const face = targetFaces.wave as TargetFace;
    expect(face.audit).toEqual({ kind: "task-graph" });
    expect(face.product.reviewLead).toBe("review");
    expect(face.nextSemantics.batch).toBe(true);
  });

  it("branch — the branch-range audit, the branch-review lead, no batch", () => {
    const face = targetFaces.branch as TargetFace;
    expect(face.audit).toEqual({ kind: "branch-range" });
    expect(face.product.reviewLead).toBe("branch-review");
    expect(face.nextSemantics.batch).toBe(false);
  });

  it("spec/plan — the doc-path audit, the review lead, no batch", () => {
    for (const type of ["spec", "plan"] as const) {
      const face = targetFaces[type];
      expect(face.audit).toEqual({ kind: "doc-path" });
      expect(face.product.reviewLead).toBe("review");
      expect(face.nextSemantics.batch).toBe(false);
    }
  });
});

describe("the task small loop — implement → review → the next ready group", () => {
  it("runs one dispatch per advance across the frontier to the exhausted null", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none"), task(2, "1")]);
      const dispatch = stub((frame) =>
        frame.phase === "implement" ? APPROVED_IMPLEMENT : { status: "APPROVED", findings: [] },
      );
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      const step1 = run.advance();
      expect(step1).not.toBeNull();
      expect(step1!.frame.phase).toBe("implement");
      expect(step1!.frame.target).toEqual({ kind: "wave", tasks: [1] });
      expect(step1!.frame.params).toEqual({ tasks: "1" });
      expect(step1!.round).toBe(1);
      expect(step1!.route).toEqual({ kind: "review", base: BASE, head: HEAD });

      const step2 = run.advance();
      expect(step2!.frame.phase).toBe("review");
      expect(step2!.frame.round).toBe(1);
      expect(step2!.route).toEqual({ kind: "next-wave", tasks: "2" });

      const step3 = run.advance();
      expect(step3!.frame.phase).toBe("implement");
      expect(step3!.frame.target).toEqual({ kind: "wave", tasks: [2] });

      const step4 = run.advance();
      expect(step4!.frame.phase).toBe("review");
      expect(step4!.frame.round).toBe(1);
      expect(step4!.route).toEqual({ kind: "done" });

      expect(run.advance()).toBeNull();

      expect(dispatch.calls.map((f) => f.phase)).toEqual([
        "implement",
        "review",
        "implement",
        "review",
      ]);
      expect(dispatch.calls.map((f) => f.target)).toEqual([
        { kind: "wave", tasks: [1] },
        { kind: "wave", tasks: [1] },
        { kind: "wave", tasks: [2] },
        { kind: "wave", tasks: [2] },
      ]);
      // the progress record + the done-set carry the loop forward
      expect(graph.doneTasks()).toEqual(new Set([1, 2]));
      expect(run.face()).toBe(targetFaces.wave);
    } finally {
      cleanup();
    }
  });

  it("a review with blockers routes the fix, the re-review and the closure", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      let reviews = 0;
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix")
          return { status: "APPROVED", commits: { base: BASE, head: HEAD } };
        reviews += 1;
        return {
          status: "APPROVED",
          findings: reviews === 1 ? [finding("blocker")] : [],
        };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      const implement = run.advance();
      expect(implement!.route).toEqual({ kind: "review", base: BASE, head: HEAD });

      const review1 = run.advance();
      expect(review1!.frame.phase).toBe("review");
      expect(review1!.frame.round).toBe(1);
      expect(review1!.route!.kind).toBe("fix");
      // the closed review leaves the task not done — the re-review awaits
      expect(graph.doneTasks()).toEqual(new Set());

      const fix = run.advance();
      expect(fix!.frame.phase).toBe("fix");
      expect(fix!.frame.round).toBe(1);
      // the C5-1 re-review: the fix round carries the source review's blocker and
      // routes the fix's delta span (base + head — the branch literal's full range)
      expect(fix!.route).toEqual({ kind: "review", base: BASE, head: HEAD });
      expect(graph.doneTasks()).toEqual(new Set());

      const review2 = run.advance();
      expect(review2!.frame.phase).toBe("review");
      expect(review2!.frame.round).toBe(2);
      expect(review2!.route).toEqual({ kind: "done" });
      expect(graph.doneTasks()).toEqual(new Set([1]));

      expect(run.advance()).toBeNull();
      expect(phasesOf([review1!, fix!, review2!])).toEqual(["review", "fix", "review"]);
    } finally {
      cleanup();
    }
  });

  it("a warn/nit review closes through the fix — the REVIEW_FIX closure, no re-review", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix")
          return { status: "APPROVED", commits: { base: BASE, head: HEAD } };
        return { status: "APPROVED", findings: [finding("nit")] };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      run.advance();
      run.advance(); // the nit review
      const fix = run.advance();
      expect(fix!.frame.phase).toBe("fix");
      expect(fix!.route).toEqual({ kind: "done" });
      expect(graph.doneTasks()).toEqual(new Set([1]));
      expect(run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a MID-RUN warn/nit wave routes the next wave after its fix — an early `done` is the {16,22,24}/rt/C5 regression (v1.29)", () => {
    const { ledger, cleanup } = fixture();
    try {
      // The three-wave chain: {1} → {2} → {3}. Each review finds warn/nit; every fix
      // clears them (blocker=0 → close). The closure routing must render next-wave
      // for wave {1} and {2} (the run continues) and `done` ONLY for the terminal
      // wave {3} — the close() ready-batch the router judges must be the LEADGER's
      // cross-invocation closed set, not the per-invocation cursor.
      const graph = taskGraph([task(1, "none"), task(2, "1"), task(3, "2")]);
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix")
          return { status: "APPROVED", commits: { base: BASE, head: HEAD } };
        return { status: "APPROVED", findings: [finding("warn")] };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      // wave {1}: implement → review(warn) → fix(clean) → next-wave {2}
      expect(run.advance()!.frame.target).toEqual({ kind: "wave", tasks: [1] });
      expect(run.advance()!.route!.kind).toBe("fix");
      expect(run.advance()!.route).toEqual({ kind: "next-wave", tasks: "2" });
      // wave {2}: implement → review(warn) → fix(clean) → next-wave {3}
      expect(run.advance()!.frame.target).toEqual({ kind: "wave", tasks: [2] });
      expect(run.advance()!.route!.kind).toBe("fix");
      expect(run.advance()!.route).toEqual({ kind: "next-wave", tasks: "3" });
      // wave {3} (terminal): implement → review(warn) → fix(clean) → done
      expect(run.advance()!.frame.target).toEqual({ kind: "wave", tasks: [3] });
      expect(run.advance()!.route!.kind).toBe("fix");
      expect(run.advance()!.route).toEqual({ kind: "done" });
      expect(run.advance()).toBeNull();
      expect(graph.doneTasks()).toEqual(new Set([1, 2, 3]));
    } finally {
      cleanup();
    }
  });

  it("a MID-RUN wave's blocker loop closes to the NEXT wave after the blocker clears through a warn re-review — the full W1 three-type route (v1.29)", () => {
    const { ledger, cleanup } = fixture();
    try {
      // The user routing matrix (v1.29), wave type W1: review → (blocker>0) → fix →
      // re-review → … → re-review → (blocker=0 & warn+nit>0) → fix → NEXT-WAVE. The
      // blocker loop lives INSIDE wave {1}; once the fix round's source blockers clear
      // (the re-review carries only warn), the closure routes wave {2} — never done.
      const graph = taskGraph([task(1, "none"), task(2, "1")]);
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix")
          return { status: "APPROVED", commits: { base: BASE, head: HEAD } };
        const wave = frame.target.kind === "wave" ? frame.target.tasks.join(",") : "";
        if (wave === "1")
          return {
            status: "APPROVED",
            findings: frame.round === 1 ? [finding("blocker")] : [finding("warn")],
          };
        return { status: "APPROVED", findings: [] }; // wave {2} clean → the terminal done
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      // wave {1}: implement → review(blocker) → fix → re-review(warn) → fix → next-wave
      run.advance(); // implement 1
      const review1 = run.advance();
      expect(review1!.frame.round).toBe(1);
      expect(review1!.route!.kind).toBe("fix");
      const fix1 = run.advance();
      expect(fix1!.route!.kind).toBe("review"); // source blockers remain → re-review
      const review2 = run.advance();
      expect(review2!.frame.round).toBe(2);
      expect(review2!.route!.kind).toBe("fix"); // warn rides the fix hop
      const fix2 = run.advance();
      expect(fix2!.route).toEqual({ kind: "next-wave", tasks: "2" }); // ← the W1 matrix row
      // wave {2} (terminal): implement → review(clean) → done
      run.advance(); // implement 2
      const review3 = run.advance();
      expect(review3!.route).toEqual({ kind: "done" });
      expect(run.advance()).toBeNull();
      expect(graph.doneTasks()).toEqual(new Set([1, 2]));
    } finally {
      cleanup();
    }
  });

  it("MIXED-severity reviews ride the same routing — a [blocker, warn] review re-reviews, a [warn, nit] re-review closes to the next wave (v1.29)", () => {
    const { ledger, cleanup } = fixture();
    try {
      // The blocker/non-blocker axis, not the mix: wave {1}'s first review carries a
      // blocker AND a warn → the fix routes the re-review; wave {1}'s re-review is
      // warn+nit only (blocker-free) → its fix closes to wave {2} (next-wave, never
      // done). The severity MIX never alters the table.
      const graph = taskGraph([task(1, "none"), task(2, "1")]);
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix")
          return { status: "APPROVED", commits: { base: BASE, head: HEAD } };
        const wave = frame.target.kind === "wave" ? frame.target.tasks.join(",") : "";
        if (wave !== "1") return { status: "APPROVED", findings: [] };
        return {
          status: "APPROVED",
          findings:
            frame.round === 1
              ? [finding("blocker"), finding("warn")]
              : [finding("warn"), finding("nit")],
        };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      run.advance(); // implement 1
      const review1 = run.advance();
      expect(review1!.route!.kind).toBe("fix"); // any mix with a blocker → fix
      const fix1 = run.advance();
      expect(fix1!.route).toEqual({ kind: "review", base: BASE, head: HEAD }); // blockers remain → re-review
      const review2 = run.advance();
      expect(review2!.frame.round).toBe(2);
      expect(review2!.route!.kind).toBe("fix"); // the warn+nit re-review still fixes
      const fix2 = run.advance();
      expect(fix2!.route).toEqual({ kind: "next-wave", tasks: "2" }); // blocker-free mix closes
      // wave {2} (terminal): implement → review(clean) → done
      run.advance(); // implement 2
      expect(run.advance()!.route).toEqual({ kind: "done" });
      expect(run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("MIXED warn+nit on a single-task line closes through the fix to done — the S2 mix (v1.29)", () => {
    const { ledger, cleanup } = fixture();
    try {
      const dispatch = stub((frame) => {
        if (frame.phase === "fix")
          return { status: "APPROVED", commits: { base: BASE, head: HEAD } };
        return { status: "APPROVED", findings: [finding("warn"), finding("nit")] };
      });
      const run = new Lifecycle({
        face: targetFaces.spec,
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "doc", doc: DOC },
      });
      run.advance(); // review (warn + nit)
      const fix = run.advance();
      expect(fix!.frame.round).toBe(1);
      expect(fix!.route).toEqual({ kind: "done" });
      expect(run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("the SINGLE-TASK line's blocker loop closes through a warn re-review to done — the full S1 three-type route (v1.29)", () => {
    const { ledger, cleanup } = fixture();
    try {
      // The user routing matrix (v1.29), single-task type S1 (spec/plan/branch): review
      // → (blocker>0) → fix → re-review → … → re-review → (blocker=0 & warn+nit>0) →
      // fix → DONE — the blocker loop terminates with a final warn fix on an exhausted
      // run (the single-target face: batch semantics off → close renders done).
      const dispatch = stub((frame) => {
        if (frame.phase === "fix")
          return { status: "APPROVED", commits: { base: BASE, head: HEAD } };
        return {
          status: "APPROVED",
          findings: frame.round === 1 ? [finding("blocker")] : [finding("warn")],
        };
      });
      const run = new Lifecycle({
        face: targetFaces.spec,
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "doc", doc: DOC },
      });

      run.advance(); // review 1 (blocker)
      const fix1 = run.advance();
      expect(fix1!.route!.kind).toBe("review"); // source blockers remain → re-review
      const review2 = run.advance();
      expect(review2!.frame.round).toBe(2);
      expect(review2!.route!.kind).toBe("fix"); // warn rides the fix hop
      const fix2 = run.advance();
      expect(fix2!.frame.round).toBe(2); // sources review round 2 (the C5-1 fix number)
      expect(fix2!.route).toEqual({ kind: "done" }); // ← the S1 matrix row (exhausted)
      expect(run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a BLOCKED review round never closes the task — the C5 route is the single terminal verdict", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      const dispatch = stub((frame) =>
        frame.phase === "implement" ? APPROVED_IMPLEMENT : { status: "BLOCKED" },
      );
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      run.advance();
      const blocked = run.advance();
      expect(blocked!.frame.phase).toBe("review");
      // BLOCKED → no next line (the CDD_BLOCKED channel owns the face) and no
      // done-marking — a failed round is not a closure, whatever its findings hold
      expect(blocked!.route).toBeNull();
      expect(graph.doneTasks()).toEqual(new Set());
    } finally {
      cleanup();
    }
  });

  it("a BLOCKED mid-run wave LOCKS the successor — wave {2} is unreachable while wave {1} holds an unclosed review (v1.29)", () => {
    const { ledger, cleanup } = fixture();
    try {
      // The strict-wave discipline as a lock: wave {1}'s review BLOCKs (no next, no
      // done-marking) → the frontier still opens wave {1} at review, so the resume
      // re-runs the SAME review. Wave {2} (dep 1) never front-of-line — a locked wave
      // in front denies the successor, exactly the "must close in order" guarantee.
      const graph = taskGraph([task(1, "none"), task(2, "1")]);
      const dispatch = stub((frame) =>
        frame.phase === "implement" ? APPROVED_IMPLEMENT : { status: "BLOCKED" },
      );
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      run.advance(); // implement 1
      const blocked = run.advance(); // review 1 BLOCKED → no next, no closure
      expect(blocked!.frame.target).toEqual({ kind: "wave", tasks: [1] });
      expect(blocked!.route).toBeNull();
      expect(graph.doneTasks()).toEqual(new Set());
      // resume: the same wave/phase re-opens — wave {2} stays locked behind it
      const again = run.advance();
      expect(again).not.toBeNull();
      expect(again!.frame.target).toEqual({ kind: "wave", tasks: [1] });
      expect(again!.frame.phase).toBe("review");
      expect(again!.route).toBeNull();
      expect(graph.doneTasks()).toEqual(new Set());
    } finally {
      cleanup();
    }
  });

  it("three consecutive blocker reviews hit the review-cycle soft cap — the line stops for the user, not done (v1.29)", () => {
    const { ledger, cleanup } = fixture();
    try {
      // REVIEW_CYCLE_CAP = 3: the fix round's consecutive-S1 run (walked from the review
      // history) reaches 3 → the router defers to the user (soft-cap). The line is
      // neither closed (done/next-wave) nor failed — it HOLDS for adjudication: the
      // next frame opens nothing (the route is not "review"), the wave is not done.
      const graph = taskGraph([task(1, "none")]);
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix")
          return { status: "APPROVED", commits: { base: BASE, head: HEAD } };
        return { status: "APPROVED", findings: [finding("blocker")] };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      run.advance(); // implement 1
      run.advance(); // review 1 (blocker) → fix
      const fix1 = run.advance();
      expect(fix1!.route!.kind).toBe("review"); // S1 run 1
      run.advance(); // review 2 (blocker)
      const fix2 = run.advance();
      expect(fix2!.route!.kind).toBe("review"); // S1 run 2
      run.advance(); // review 3 (blocker)
      const fix3 = run.advance();
      expect(fix3!.route!.kind).toBe("soft-cap"); // S1 run 3 → user adjudicates
      expect(fix3!.route).toEqual({ kind: "soft-cap", message: SOFT_CAP_SUGGESTION });
      // the line HOLDS: neither closed (not done), nor re-reviewing (the cap defers)
      expect(graph.doneTasks()).toEqual(new Set());
      expect(run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("the spec/plan small loop — review → fix → re-review → closure", () => {
  for (const type of ["spec", "plan"] as const) {
    it(`drives the ${type} line to the closure without a task frontier`, () => {
      const { ledger, cleanup } = fixture();
      try {
        let reviews = 0;
        const dispatch = stub((frame) => {
          if (frame.phase === "fix")
            return { status: "APPROVED", commits: { base: BASE, head: HEAD } };
          reviews += 1;
          return {
            status: "APPROVED",
            findings: reviews === 1 ? [finding("blocker")] : [],
          };
        });
        const run = new Lifecycle({
          face: targetFaces[type],
          state: EMPTY_RUN_STATE,
          ledger,
          dispatch: dispatch.step,
          target: { kind: "doc", doc: DOC },
        });

        const review1 = run.advance();
        expect(review1!.frame.phase).toBe("review");
        expect(review1!.frame.round).toBe(1);
        expect(review1!.route!.kind).toBe("fix");

        const fix = run.advance();
        expect(fix!.frame.phase).toBe("fix");
        expect(fix!.frame.round).toBe(1);
        expect(fix!.route!.kind).toBe("review");

        const review2 = run.advance();
        expect(review2!.frame.phase).toBe("review");
        expect(review2!.frame.round).toBe(2);
        expect(review2!.route).toEqual({ kind: "done" });

        expect(run.advance()).toBeNull();
        // the canonical doc handoff names are on record (round increments ride the family)
        expect(ledger.readHandoff("review", type, { round: 1 })).not.toBeNull();
        expect(ledger.readHandoff("fix", type, { round: 1 })).not.toBeNull();
        expect(ledger.readHandoff("review", type, { round: 2 })).not.toBeNull();
      } finally {
        cleanup();
      }
    });
  }

  it("a clean first review closes the doc line with a single advance", () => {
    const { ledger, cleanup } = fixture();
    try {
      const dispatch = stub(() => ({ status: "APPROVED", findings: [] }));
      const run = new Lifecycle({
        face: targetFaces.spec,
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "doc", doc: DOC },
      });
      const step = run.advance();
      expect(step!.frame.phase).toBe("review");
      expect(step!.route).toEqual({ kind: "done" });
      expect(run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("the branch small loop — branch-review → fix → closure", () => {
  it("drives the branch line over the base..head range (the r{round} family names)", () => {
    const { ledger, cleanup } = fixture();
    try {
      let reviews = 0;
      const dispatch = stub((frame) => {
        if (frame.phase === "fix")
          return { status: "APPROVED", commits: { base: BASE, head: HEAD } };
        reviews += 1;
        return {
          status: "APPROVED",
          findings: reviews === 1 ? [finding("warn")] : [],
        };
      });
      const run = new Lifecycle({
        face: targetFaces.branch,
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "branch", base: BASE, head: HEAD },
      });

      const review1 = run.advance();
      expect(review1!.frame.phase).toBe("branch-review");
      expect(review1!.frame.round).toBe(1);
      expect(review1!.frame.params).toEqual({
        base7: BASE.slice(0, 7),
        head7: HEAD.slice(0, 7),
        round: 1,
      });
      expect(review1!.route!.kind).toBe("fix");

      const fix = run.advance();
      expect(fix!.frame.phase).toBe("fix");
      expect(fix!.frame.round).toBe(1);
      // the warn/nit input closes — the closure round, no re-review preview
      expect(fix!.route).toEqual({ kind: "done" });

      expect(run.advance()).toBeNull();
      // the canonical branch family names ride the r{round} increment
      expect(
        ledger.readHandoff("review", "branch", {
          base7: BASE.slice(0, 7),
          head7: HEAD.slice(0, 7),
          round: 1,
        }),
      ).not.toBeNull();
      expect(
        ledger.readHandoff("fix", "branch", {
          base7: BASE.slice(0, 7),
          head7: HEAD.slice(0, 7),
          round: 1,
        }),
      ).not.toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a branch target face without its fixed target holds the line", () => {
    const { ledger, cleanup } = fixture();
    try {
      const run = new Lifecycle({
        face: targetFaces.branch,
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: stub((_frame) => ({ status: "APPROVED", findings: [] })).step,
      });
      expect(run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("the capsule interaction seam — non-hard consumption", () => {
  it("advances output-less without a capsule; the attached seam renders the round facts", () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      const dispatch = stub(() => APPROVED_IMPLEMENT);
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      const silent = run.advance();
      expect(silent!.capsuleLines).toEqual([]);

      const capsule: CapsuleFace = {
        emit: (status, blocker, handoff) => [`${status}: ${blocker} · ${handoff}`],
      };
      run.attachCapsule(capsule);
      const rendered = run.advance();
      expect(rendered!.capsuleLines.length).toBeGreaterThan(0);
      expect(rendered!.capsuleLines[0]).toContain("APPROVED");
    } finally {
      cleanup();
    }
  });

  it("the interaction seam accepts a plain route-less emit — the interface shape is pinned", () => {
    // Compile-time pins — this file fails under `tsc --noEmit` if the seam surface
    // drifts from the face/capsule contact (T10's Capsule satisfies the same type).
    const seam: CapsuleFace["emit"] = (status, blocker, handoff) => [
      `${status} ${blocker} ${handoff}`,
    ];
    expect(seam("APPROVED", "0", "/ws/h.json")).toEqual(["APPROVED 0 /ws/h.json"]);
  });
});
