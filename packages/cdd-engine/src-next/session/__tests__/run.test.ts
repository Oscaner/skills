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

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PlanDocType } from "../../contract/doc.ts";
import { Capsule } from "../../face/capsule.ts";
import { Words } from "../../face/words.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { BriefRenderer } from "../../render/brief.ts";
import { type TargetFace, type TargetType, targetFaces } from "../faces.ts";
import { TaskGraph } from "../graph.ts";
import { Ledger } from "../ledger.ts";
import { REVIEW_CYCLE_CAP, SOFT_CAP_SUGGESTION } from "../next.ts";
import type { CapsuleFace, DispatchOutcome, DispatchStep, OpenFrame, StepResult } from "../run.ts";
import { EMPTY_RUN_STATE, Lifecycle } from "../run.ts";

const DOC = "docs/kairos/specs/x-design.md";

/** A hermetic ledger fixture — a fresh temp workspace (the ledger tests' pattern).
 *  `repo` exposes the temp root so the T11 wiring cases can place a real plan file
 *  the reviewed-revision write-back hashes. */
const fixture = (): {
  ledger: Ledger;
  workspace: Workspace;
  repo: string;
  cleanup: () => void;
} => {
  const repo = mkdtempSync(path.join(tmpdir(), "run-"));
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repo, ".kairos", "cdd"), "session"),
    "test-slug",
  );
  const ledger = new Ledger(workspace, new ConfigLoader());
  return { ledger, workspace, repo, cleanup: () => rmSync(repo, { recursive: true, force: true }) };
};

/** A plan document over `### Task N:` blocks + `- **DependsOn**:` values (the
 *  front-matter head the plan parser reads). */
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
  ].join("\n");
};

/** One task block with its `- **DependsOn**:` edge. */
const task = (id: number, dependsOn: string): readonly string[] => {
  return [`### Task ${id}: task ${id}`, `- **DependsOn**: ${dependsOn}`];
};

/** Parse a fixture and build the TaskGraph — the task face's run state. */
const taskGraph = (blocks: readonly (readonly string[])[]): TaskGraph => {
  return new TaskGraph(new PlanDocType("plan").parse(planDoc(blocks).split("\n")));
};

/** A dispatch stub — records every dispatched frame and answers per phase. The
 *  script stays synchronous (the fixtures are plain outcome builders); the step
 *  itself is the async seam the lifecycle awaits. */
const stub = (
  script: (frame: OpenFrame) => DispatchOutcome,
): {
  step: DispatchStep;
  calls: OpenFrame[];
} => {
  const calls: OpenFrame[] = [];
  return {
    calls,
    step: async (frame) => {
      calls.push(frame);
      return script(frame);
    },
  };
};

/** The approved-implement outcome — the canonical work-round result. */
const APPROVED_IMPLEMENT: DispatchOutcome = {
  status: "APPROVED",
  carrier: { artifacts: { brief: "/tmp/brief.md" } },
};

const finding = (severity: "blocker" | "warn" | "nit") => ({ severity, summary: "drift" });

/** The D30 wave-line reviewed-basis hash — the RENDERED brief's sha1 for a wave's
 *  tasks (the wave gate binds the brief, never the whole plan). */
const briefHash = (planPath: string, tasks: string): string => {
  const brief = new BriefRenderer().render(
    readFileSync(planPath, "utf8"),
    tasks.split(",").map(Number),
  );
  return createHash("sha1").update(brief).digest("hex");
};
const phasesOf = (steps: readonly StepResult[]): readonly (string | null)[] =>
  steps.map((step) => step.frame.phase);

describe("the faces table — one row per target type", () => {
  it("declares the four CLI `--type` values in the single table", () => {
    expect(Object.keys(targetFaces).sort()).toEqual([
      "branch",
      "overall",
      "phase-spec",
      "plan",
      "single-spec",
      "wave",
    ]);
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

  it("branch — the branch-tree audit, the branch-review lead, no batch", () => {
    const face = targetFaces.branch as TargetFace;
    expect(face.audit).toEqual({ kind: "branch-tree" });
    expect(face.product.reviewLead).toBe("branch-review");
    expect(face.nextSemantics.batch).toBe(false);
  });

  it("spec/plan — the doc-path audit, the review lead, no batch", () => {
    for (const type of ["phase-spec", "overall", "plan", "single-spec"] as const) {
      const face = targetFaces[type];
      expect(face.audit).toEqual({ kind: "doc-path" });
      expect(face.product.reviewLead).toBe("review");
      expect(face.nextSemantics.batch).toBe(false);
    }
  });
});

describe("the task small loop — implement → review → the next ready group", () => {
  it("runs one dispatch per advance across the frontier to the exhausted null", async () => {
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

      const step1 = await run.advance();
      expect(step1).not.toBeNull();
      expect(step1!.frame.phase).toBe("implement");
      expect(step1!.frame.target).toEqual({ kind: "wave", tasks: [1] });
      expect(step1!.frame.params).toEqual({ tasks: "1" });
      expect(step1!.round).toBe(1);
      expect(step1!.route).toEqual({ kind: "review" });

      const step2 = await run.advance();
      expect(step2!.frame.phase).toBe("review");
      expect(step2!.frame.round).toBe(1);
      expect(step2!.route).toEqual({ kind: "next-wave", tasks: "2" });

      const step3 = await run.advance();
      expect(step3!.frame.phase).toBe("implement");
      expect(step3!.frame.target).toEqual({ kind: "wave", tasks: [2] });

      const step4 = await run.advance();
      expect(step4!.frame.phase).toBe("review");
      expect(step4!.frame.round).toBe(1);
      expect(step4!.route).toEqual({ kind: "done" });

      expect(await run.advance()).toBeNull();

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

  it("a review with blockers routes the fix, the re-review and the closure", async () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      let reviews = 0;
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix") return { status: "APPROVED" };
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

      const implement = await run.advance();
      expect(implement!.route).toEqual({ kind: "review" });

      const review1 = await run.advance();
      expect(review1!.frame.phase).toBe("review");
      expect(review1!.frame.round).toBe(1);
      expect(review1!.route!.kind).toBe("fix");
      // the closed review leaves the task not done — the re-review awaits
      expect(graph.doneTasks()).toEqual(new Set());

      const fix = await run.advance();
      expect(fix!.frame.phase).toBe("fix");
      expect(fix!.frame.round).toBe(1);
      // the C5-1 re-review: the fix round carries the source review's blocker and
      // routes the fix's delta span (base + head — the branch literal's full range)
      expect(fix!.route).toEqual({ kind: "review" });
      expect(graph.doneTasks()).toEqual(new Set());

      const review2 = await run.advance();
      expect(review2!.frame.phase).toBe("review");
      expect(review2!.frame.round).toBe(2);
      expect(review2!.route).toEqual({ kind: "done" });
      expect(graph.doneTasks()).toEqual(new Set([1]));

      expect(await run.advance()).toBeNull();
      expect(phasesOf([review1!, fix!, review2!])).toEqual(["review", "fix", "review"]);
    } finally {
      cleanup();
    }
  });

  it("a warn/nit review closes through the fix — the REVIEW_FIX closure, no re-review", async () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix") return { status: "APPROVED" };
        return { status: "APPROVED", findings: [finding("nit")] };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      await run.advance();
      await run.advance(); // the nit review
      const fix = await run.advance();
      expect(fix!.frame.phase).toBe("fix");
      expect(fix!.route).toEqual({ kind: "done" });
      expect(graph.doneTasks()).toEqual(new Set([1]));
      expect(await run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a MID-RUN warn/nit wave routes the next wave after its fix — an early `done` is the {16,22,24}/rt/C5 regression (v1.29)", async () => {
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
        if (frame.phase === "fix") return { status: "APPROVED" };
        return { status: "APPROVED", findings: [finding("warn")] };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      // wave {1}: implement → review(warn) → fix(clean) → next-wave {2}
      expect((await run.advance())!.frame.target).toEqual({ kind: "wave", tasks: [1] });
      expect((await run.advance())!.route!.kind).toBe("fix");
      expect((await run.advance())!.route).toEqual({ kind: "next-wave", tasks: "2" });
      // wave {2}: implement → review(warn) → fix(clean) → next-wave {3}
      expect((await run.advance())!.frame.target).toEqual({ kind: "wave", tasks: [2] });
      expect((await run.advance())!.route!.kind).toBe("fix");
      expect((await run.advance())!.route).toEqual({ kind: "next-wave", tasks: "3" });
      // wave {3} (terminal): implement → review(warn) → fix(clean) → done
      expect((await run.advance())!.frame.target).toEqual({ kind: "wave", tasks: [3] });
      expect((await run.advance())!.route!.kind).toBe("fix");
      expect((await run.advance())!.route).toEqual({ kind: "done" });
      expect(await run.advance()).toBeNull();
      expect(graph.doneTasks()).toEqual(new Set([1, 2, 3]));
    } finally {
      cleanup();
    }
  });

  it("a MID-RUN wave's blocker loop closes to the NEXT wave after the blocker clears through a warn re-review — the full W1 three-type route (v1.29)", async () => {
    const { ledger, cleanup } = fixture();
    try {
      // The user routing matrix (v1.29), wave type W1: review → (blocker>0) → fix →
      // re-review → … → re-review → (blocker=0 & warn+nit>0) → fix → NEXT-WAVE. The
      // blocker loop lives INSIDE wave {1}; once the fix round's source blockers clear
      // (the re-review carries only warn), the closure routes wave {2} — never done.
      const graph = taskGraph([task(1, "none"), task(2, "1")]);
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix") return { status: "APPROVED" };
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
      await run.advance(); // implement 1
      const review1 = await run.advance();
      expect(review1!.frame.round).toBe(1);
      expect(review1!.route!.kind).toBe("fix");
      const fix1 = await run.advance();
      expect(fix1!.route!.kind).toBe("review"); // source blockers remain → re-review
      const review2 = await run.advance();
      expect(review2!.frame.round).toBe(2);
      expect(review2!.route!.kind).toBe("fix"); // warn rides the fix hop
      const fix2 = await run.advance();
      expect(fix2!.route).toEqual({ kind: "next-wave", tasks: "2" }); // ← the W1 matrix row
      // wave {2} (terminal): implement → review(clean) → done
      await run.advance(); // implement 2
      const review3 = await run.advance();
      expect(review3!.route).toEqual({ kind: "done" });
      expect(await run.advance()).toBeNull();
      expect(graph.doneTasks()).toEqual(new Set([1, 2]));
    } finally {
      cleanup();
    }
  });

  it("MIXED-severity reviews ride the same routing — a [blocker, warn] review re-reviews, a [warn, nit] re-review closes to the next wave (v1.29)", async () => {
    const { ledger, cleanup } = fixture();
    try {
      // The blocker/non-blocker axis, not the mix: wave {1}'s first review carries a
      // blocker AND a warn → the fix routes the re-review; wave {1}'s re-review is
      // warn+nit only (blocker-free) → its fix closes to wave {2} (next-wave, never
      // done). The severity MIX never alters the table.
      const graph = taskGraph([task(1, "none"), task(2, "1")]);
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix") return { status: "APPROVED" };
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

      await run.advance(); // implement 1
      const review1 = await run.advance();
      expect(review1!.route!.kind).toBe("fix"); // any mix with a blocker → fix
      const fix1 = await run.advance();
      expect(fix1!.route).toEqual({ kind: "review" }); // blockers remain → re-review
      const review2 = await run.advance();
      expect(review2!.frame.round).toBe(2);
      expect(review2!.route!.kind).toBe("fix"); // the warn+nit re-review still fixes
      const fix2 = await run.advance();
      expect(fix2!.route).toEqual({ kind: "next-wave", tasks: "2" }); // blocker-free mix closes
      // wave {2} (terminal): implement → review(clean) → done
      await run.advance(); // implement 2
      expect((await run.advance())!.route).toEqual({ kind: "done" });
      expect(await run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("MIXED warn+nit on a single-task line closes through the fix to done — the S2 mix (v1.29)", async () => {
    const { ledger, cleanup } = fixture();
    try {
      const dispatch = stub((frame) => {
        if (frame.phase === "fix") return { status: "APPROVED" };
        return { status: "APPROVED", findings: [finding("warn"), finding("nit")] };
      });
      const run = new Lifecycle({
        face: targetFaces["phase-spec"],
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "spec", doc: DOC },
      });
      await run.advance(); // review (warn + nit)
      const fix = await run.advance();
      expect(fix!.frame.round).toBe(1);
      expect(fix!.route).toEqual({ kind: "done" });
      expect(await run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("the SINGLE-TASK line's blocker loop closes through a warn re-review to done — the full S1 three-type route (v1.29)", async () => {
    const { ledger, cleanup } = fixture();
    try {
      // The user routing matrix (v1.29), single-task type S1 (spec/plan/branch): review
      // → (blocker>0) → fix → re-review → … → re-review → (blocker=0 & warn+nit>0) →
      // fix → DONE — the blocker loop terminates with a final warn fix on an exhausted
      // run (the single-target face: batch semantics off → close renders done).
      const dispatch = stub((frame) => {
        if (frame.phase === "fix") return { status: "APPROVED" };
        return {
          status: "APPROVED",
          findings: frame.round === 1 ? [finding("blocker")] : [finding("warn")],
        };
      });
      const run = new Lifecycle({
        face: targetFaces["phase-spec"],
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "spec", doc: DOC },
      });

      await run.advance(); // review 1 (blocker)
      const fix1 = await run.advance();
      expect(fix1!.route!.kind).toBe("review"); // source blockers remain → re-review
      const review2 = await run.advance();
      expect(review2!.frame.round).toBe(2);
      expect(review2!.route!.kind).toBe("fix"); // warn rides the fix hop
      const fix2 = await run.advance();
      expect(fix2!.frame.round).toBe(2); // sources review round 2 (the C5-1 fix number)
      expect(fix2!.route).toEqual({ kind: "done" }); // ← the S1 matrix row (exhausted)
      expect(await run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a BLOCKED review round never closes the task — the C5 route is the single terminal verdict", async () => {
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

      await run.advance();
      const blocked = await run.advance();
      expect(blocked!.frame.phase).toBe("review");
      // BLOCKED → no next line (the CDD_BLOCKED channel owns the face) and no
      // done-marking — a failed round is not a closure, whatever its findings hold
      expect(blocked!.route).toBeNull();
      expect(graph.doneTasks()).toEqual(new Set());
    } finally {
      cleanup();
    }
  });

  it("a BLOCKED implement round lands as a record — the retry takes attempt 2 at the same cycle", async () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      let blocked = true;
      const dispatch = stub(() => (blocked ? { status: "BLOCKED" } : APPROVED_IMPLEMENT));
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      const first = await run.advance();
      // every dispatched round lands — the failed verdict is the record's fact
      expect(ledger.recordsOf("1")).toEqual([
        expect.objectContaining({
          op: "implement",
          cycle: 1,
          attempt: 1,
          verdict: { treeClean: true, targetAction: false },
        }),
      ]);
      expect(ledger.completedCycles("1", "implement")).toEqual([]);
      expect(first!.route).toBeNull();

      // the retry is the SAME cycle's next attempt — allocated once by the naming source
      expect(run.peekNext()?.frame.attempt).toBe(2);
      blocked = false;
      const retry = await run.advance();
      expect(
        ledger.recordsOf("1").map((record) => `${record.op}:${record.cycle}:a${record.attempt}`),
      ).toEqual(["implement:1:a1", "implement:1:a2"]);
      // the failed attempt's record is never overwritten by the retry
      expect(ledger.completedCycles("1", "implement")).toEqual([1]);
      // the successful retry IS the round the line reads back: the failed attempt 1
      // must never shadow it (the read-back gate takes the cycle's LATEST attempt)
      expect(retry!.route).toEqual({ kind: "review" });
    } finally {
      cleanup();
    }
  });

  it("a BLOCKED fix round lands as a record — the retry takes attempt 2 at the source review's cycle", async () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      let blockedFix = true;
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "review") return { status: "APPROVED", findings: [finding("blocker")] };
        return blockedFix ? { status: "BLOCKED" } : { status: "APPROVED" };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      await run.advance(); // implement
      const review = await run.advance(); // review — the blocker awaits its fix
      expect(review!.route!.kind).toBe("fix");
      const fix = await run.advance(); // fix 1 BLOCKED
      expect(fix!.frame.phase).toBe("fix");
      expect(fix!.route).toBeNull();
      // the failed fix is registered but not completed — the completed-set read keeps
      // the line at fix-K instead of reading the failure as a done fix
      expect(ledger.completedCycles("1", "fix")).toEqual([]);

      // the retry is the SAME cycle's next attempt, allocated once by the naming source
      const retry = run.peekNext()?.frame;
      expect(retry?.phase).toBe("fix");
      expect(retry?.round).toBe(1);
      expect(retry?.attempt).toBe(2);

      blockedFix = false;
      const completed = await run.advance();
      expect(completed!.route!.kind).toBe("review"); // the completed fix awaits its re-review
      expect(ledger.completedCycles("1", "fix")).toEqual([1]);
    } finally {
      cleanup();
    }
  });

  it("a BLOCKED mid-run wave LOCKS the successor — wave {2} is unreachable while wave {1} holds an unclosed review (v1.29)", async () => {
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

      await run.advance(); // implement 1
      const blocked = await run.advance(); // review 1 BLOCKED → no next, no closure
      expect(blocked!.frame.target).toEqual({ kind: "wave", tasks: [1] });
      expect(blocked!.route).toBeNull();
      expect(graph.doneTasks()).toEqual(new Set());
      // resume: the same wave/phase re-opens — wave {2} stays locked behind it
      const again = await run.advance();
      expect(again).not.toBeNull();
      expect(again!.frame.target).toEqual({ kind: "wave", tasks: [1] });
      expect(again!.frame.phase).toBe("review");
      expect(again!.route).toBeNull();
      expect(graph.doneTasks()).toEqual(new Set());
    } finally {
      cleanup();
    }
  });

  it("REVIEW_CYCLE_CAP consecutive blocker reviews hit the soft cap — the line stops for the user, not done (v1.29)", async () => {
    const { ledger, cleanup } = fixture();
    try {
      // REVIEW_CYCLE_CAP: the fix round's consecutive-S1 run (walked from the review
      // history) reaches the cap → the router defers to the user (soft-cap). The line is
      // neither closed (done/next-wave) nor failed — it HOLDS for adjudication: the
      // next frame opens nothing (the route is not "review"), the wave is not done.
      // The walk is cap-driven so a cap change needs no test edit.
      const graph = taskGraph([task(1, "none")]);
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix") return { status: "APPROVED" };
        return { status: "APPROVED", findings: [finding("blocker")] };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });

      await run.advance(); // implement 1
      for (let cycle = 1; cycle < REVIEW_CYCLE_CAP; cycle += 1) {
        await run.advance(); // review cycle (blocker) → fix
        const fix = await run.advance();
        expect(fix!.route!.kind).toBe("review"); // S1 run cycle < cap → re-review
      }
      await run.advance(); // review cap (blocker) → fix
      const capFix = await run.advance();
      expect(capFix!.route!.kind).toBe("soft-cap"); // S1 run == cap → user adjudicates
      expect(capFix!.route).toEqual({ kind: "soft-cap", message: SOFT_CAP_SUGGESTION });
      // the line HOLDS: neither closed (not done), nor re-reviewing (the cap defers)
      expect(graph.doneTasks()).toEqual(new Set());
      expect(await run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("the spec/plan small loop — review → fix → re-review → closure", () => {
  for (const type of ["phase-spec", "overall", "plan", "single-spec"] as const) {
    it(`drives the ${type} line to the closure without a task frontier`, async () => {
      const { ledger, cleanup } = fixture();
      try {
        let reviews = 0;
        const dispatch = stub((frame) => {
          if (frame.phase === "fix") return { status: "APPROVED" };
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
          target: { kind: type === "plan" ? "plan" : "spec", doc: DOC },
        });

        const review1 = await run.advance();
        expect(review1!.frame.phase).toBe("review");
        expect(review1!.frame.round).toBe(1);
        expect(review1!.route!.kind).toBe("fix");

        const fix = await run.advance();
        expect(fix!.frame.phase).toBe("fix");
        expect(fix!.frame.round).toBe(1);
        expect(fix!.route!.kind).toBe("review");

        const review2 = await run.advance();
        expect(review2!.frame.phase).toBe("review");
        expect(review2!.frame.round).toBe(2);
        expect(review2!.route).toEqual({ kind: "done" });

        expect(await run.advance()).toBeNull();
        // the canonical doc handoff names are on record (round increments ride the family)
        expect(ledger.readHandoff("review", type, { round: 1 })).not.toBeNull();
        expect(ledger.readHandoff("fix", type, { round: 1 })).not.toBeNull();
        expect(ledger.readHandoff("review", type, { round: 2 })).not.toBeNull();
      } finally {
        cleanup();
      }
    });
  }

  it("a clean first review closes the doc line with a single advance", async () => {
    const { ledger, cleanup } = fixture();
    try {
      const dispatch = stub(() => ({ status: "APPROVED", findings: [] }));
      const run = new Lifecycle({
        face: targetFaces["phase-spec"],
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "spec", doc: DOC },
      });
      const step = await run.advance();
      expect(step!.frame.phase).toBe("review");
      expect(step!.route).toEqual({ kind: "done" });
      expect(await run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a migrated charter line books its next round on the legacy row — no forked twin", async () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      // The pre-rename facts of a charter mid-flight: reviews 1-2 recorded, fix 1
      // landed, and review 2 still carries an open blocker. Only the retired carriers
      // exist — the round context and the criterion read them, the writes stay current.
      ledger.writeProgress({
        ...ledger.emptyProgress(),
        waves: [{ wave: "spec", rounds: { review: [1, 2], fix: [1] } }],
      });
      workspace.writeJson("spec-review-1.json", { artifacts: {}, findings: [] });
      workspace.writeJson("spec-review-2.json", {
        artifacts: {},
        findings: [finding("blocker")],
      });
      workspace.writeJson("spec-fix-1.json", { artifacts: {}, status: "APPROVED" });
      const dispatch = stub(() => ({ status: "APPROVED" }));
      const run = new Lifecycle({
        face: targetFaces.overall,
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "spec", doc: DOC },
      });
      const fix = await run.advance();
      expect(fix!.frame.phase).toBe("fix");
      // The fix pairs with review 2 — the numbering reads the retired row's cycles.
      expect(fix!.frame.round).toBe(2);
      // ONE row: the round booked where the line has always been.
      expect(ledger.readProgress()?.waves.map((row) => row.wave)).toEqual(["spec"]);
      const reload = new Ledger(workspace, new ConfigLoader());
      expect(reload.completedCycles("overall", "fix", "overall")).toEqual([1, 2]);
      expect(fix!.route?.kind).toBe("review");
    } finally {
      cleanup();
    }
  });
});

describe("T2/D62 — the bookkeep fallback rides the frame's op-derived plane", () => {
  it("the work fallback builds a findings-free carrier — the persisted implement handoff carries zero findings keys (the work plane)", async () => {
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
      await run.advance();
      const carrier = ledger.readHandoff("implement", "wave", { tasks: "1" });
      expect(carrier).not.toBeNull();
      expect(Object.keys(carrier!)).not.toContain("findings");
    } finally {
      cleanup();
    }
  });

  it("the docs-fix fallback rides the work plane — the persisted fix handoff reports status, zero findings keys (D62)", async () => {
    const { ledger, cleanup } = fixture();
    try {
      const dispatch = stub((frame) =>
        frame.phase === "fix"
          ? { status: "APPROVED" }
          : { status: "APPROVED", findings: [finding("blocker")] },
      );
      const run = new Lifecycle({
        face: targetFaces["phase-spec"],
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "spec", doc: DOC },
      });
      expect((await run.advance())!.route!.kind).toBe("fix");
      await run.advance();
      const carrier = ledger.readHandoff("fix", "phase-spec", { round: 1 });
      expect(carrier).not.toBeNull();
      // the fix op derives the work plane — the fallback carrier reports the round's
      // status and declares no findings slot (a findings-shaped fallback fails this)
      expect(Object.keys(carrier!)).not.toContain("findings");
      expect(carrier!.status).toBe("APPROVED");
    } finally {
      cleanup();
    }
  });

  it("T6 — probe A: the wave-fix fallback also rides the work face — the persisted WAVE fix handoff carries zero findings keys (the fix leg of the zero-findings write path)", async () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix") return { status: "APPROVED" };
        return { status: "APPROVED", findings: [finding("blocker")] };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
      });
      await run.advance(); // implement 1 — the work face
      await run.advance(); // review 1 (blocker) → routes the fix hop
      await run.advance(); // fix 1 — the WAVE fix face is the work face
      const fixCarrier = ledger.readHandoff("fix", "wave", { tasks: "1", round: 1 });
      expect(fixCarrier).not.toBeNull();
      // the wave fix lands on the work face — the persisted fix carrier carries zero
      // findings keys, even though its source review was a finding-bearing blocker
      expect(Object.keys(fixCarrier!)).not.toContain("findings");
      const reviewCarrier = ledger.readHandoff("review", "wave", { tasks: "1", round: 1 });
      expect(reviewCarrier).not.toBeNull();
      // the review face keeps the findings key — the two legs diverge by face
      expect(Object.keys(reviewCarrier!)).toContain("findings");
    } finally {
      cleanup();
    }
  });
});

describe("the branch small loop — branch-review → fix → closure", () => {
  it("drives the branch line over the live tree (the r{round} family names)", async () => {
    const { ledger, cleanup } = fixture();
    try {
      let reviews = 0;
      const dispatch = stub((frame) => {
        if (frame.phase === "fix") return { status: "APPROVED" };
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
        target: { kind: "branch" },
      });

      const review1 = await run.advance();
      expect(review1!.frame.phase).toBe("branch-review");
      expect(review1!.frame.round).toBe(1);
      expect(review1!.frame.params).toEqual({ round: 1 });
      expect(review1!.route!.kind).toBe("fix");

      const fix = await run.advance();
      expect(fix!.frame.phase).toBe("fix");
      expect(fix!.frame.round).toBe(1);
      // the warn/nit input closes — the closure round, no re-review preview
      expect(fix!.route).toEqual({ kind: "done" });

      expect(await run.advance()).toBeNull();
      // the canonical branch family names ride the spine {round} increment (find #9 —
      // `branch-review-{round}.json` — the range token left the file name)
      expect(ledger.readHandoff("review", "branch", { round: 1 })).not.toBeNull();
      expect(ledger.readHandoff("fix", "branch", { round: 1 })).not.toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a branch target face without its fixed target holds the line", async () => {
    const { ledger, cleanup } = fixture();
    try {
      const run = new Lifecycle({
        face: targetFaces.branch,
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: stub((_frame) => ({ status: "APPROVED", findings: [] })).step,
      });
      expect(await run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("round ACCUMULATES across a branch re-review loop — review-1 → fix-1 → review-2 → close (find #9 · lineKey fixed `branch`, the old range-key reset every re-review)", async () => {
    const { ledger, cleanup } = fixture();
    try {
      // The blocker-first line: review-1 finds a blocker → fix-1 keeps it (the fix
      // carrier's source review still blocks) → the re-review of the fix's delta is
      // review-2 → it finds nothing → the line closes.
      const findingsByRound: string[][] = [["blocker"], []];
      const dispatch = stub((frame) => {
        if (frame.phase === "review" || frame.phase === "branch-review") {
          const findings = (findingsByRound[frame.round - 1] ?? ["blocker"]).map((severity) =>
            finding(severity as "blocker"),
          );
          return { status: "REVIEW_FIX", findings };
        }
        if (frame.phase === "fix") {
          return { status: "APPROVED" };
        }
        return { status: "APPROVED" };
      });
      const run = new Lifecycle({
        face: targetFaces.branch,
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "branch" },
      });

      // review-1 → fix-1
      const review1 = await run.advance();
      expect(review1!.frame.phase).toBe("branch-review");
      expect(review1!.frame.round).toBe(1);
      expect(review1!.route!.kind).toBe("fix");
      const fix1 = await run.advance();
      expect(fix1!.frame.phase).toBe("fix");
      expect(fix1!.frame.round).toBe(1);

      // the re-review advances the SAME line to round 2 — the stable `branch` key
      // accumulates (the old range-key: the new head would have opened a fresh
      // progress row and reset the round to 1)
      const review2 = await run.advance();
      expect(review2!.frame.phase).toBe("branch-review");
      expect(review2!.frame.round).toBe(2);
      expect(review2!.route!.kind).toBe("done");

      expect(await run.advance()).toBeNull();
      // the spine file names accumulate too — branch-review-1.json AND
      // branch-review-2.json exist (find #9: the round rides the name, never the range)
      expect(ledger.readHandoff("review", "branch", { round: 1 })).not.toBeNull();
      expect(ledger.readHandoff("review", "branch", { round: 2 })).not.toBeNull();
      expect(ledger.readHandoff("fix", "branch", { round: 1 })).not.toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("P24 §2 — a completed round advances the line's reviewed identity", () => {
  /** The target doc path under the ledger's read basis (`<repo>/.kairos/cdd`) — the
   *  basis-relative drift verdict and the absolute write-back read must hit ONE file,
   *  so every fixture below passes an absolute path. */
  const docUnder = (repo: string): string => path.join(repo, ".kairos", "cdd", DOC);

  const docOf = (version: string, body: string): string =>
    `---\ndoc-type: phase-spec\nversion: ${version}\nslug: x-design\n---\n\n## Design\n\n- ${body}\n`;

  for (const type of ["phase-spec", "overall", "plan", "single-spec"] as const) {
    it(`${type} — a warn-only fix that edited the doc still closes the line`, async () => {
      const { ledger, repo, cleanup } = fixture();
      try {
        // The ledger's read basis is `<repo>/.kairos/cdd` (WorkspaceRoot) — the doc
        // lives there and BOTH reads (the basis-relative verdict, the absolute
        // write-back) must hit one file: an absolute path.
        const doc = docUnder(repo);
        mkdirSync(path.dirname(doc), { recursive: true });
        writeFileSync(doc, docOf("v0.1", "one"));
        let fixes = 0;
        const dispatch = stub((frame) => {
          if (frame.phase === "fix") {
            fixes += 1;
            writeFileSync(doc, docOf(`v0.${fixes + 1}`, `${fixes}`));
            return { status: "APPROVED" };
          }
          return { status: "APPROVED", findings: [finding("warn")] };
        });
        const run = new Lifecycle({
          face: targetFaces[type],
          state: EMPTY_RUN_STATE,
          ledger,
          dispatch: dispatch.step,
          target: { kind: type === "plan" ? "plan" : "spec", doc },
        });
        run.attachCapsule(new Capsule(new Words()));

        const review1 = await run.advance();
        expect(review1!.route!.kind).toBe("fix");
        const fix1 = await run.advance();
        expect(fix1!.frame.phase).toBe("fix");
        // `[1]` is the `next:` row (the stub passes no dispositionsSummary); the
        // `reason:` row that follows it is a later element.
        expect(fix1!.capsuleLines[1]).not.toMatch(/^next: review\b/);
        expect(run.peekNext()).toBeNull();
        // The auxiliary fact: C5 already judged the closure (green with and without
        // the write-back) — the capsule's `next:` row is the red probe.
        expect(fix1!.route).toEqual({ kind: "done" });
        expect(await run.advance()).toBeNull();
      } finally {
        cleanup();
      }
    });
  }

  for (const type of ["phase-spec", "overall", "plan", "single-spec"] as const) {
    it(`${type} — an out-of-round doc edit after the closure still reopens the review`, async () => {
      const { ledger, repo, cleanup } = fixture();
      try {
        const doc = docUnder(repo);
        mkdirSync(path.dirname(doc), { recursive: true });
        writeFileSync(doc, docOf("v0.1", "one"));
        let fixes = 0;
        const dispatch = stub((frame) => {
          if (frame.phase === "fix") {
            fixes += 1;
            writeFileSync(doc, docOf(`v0.${fixes + 1}`, `${fixes}`));
            return { status: "APPROVED" };
          }
          return { status: "APPROVED", findings: [finding("warn")] };
        });
        const run = new Lifecycle({
          face: targetFaces[type],
          state: EMPTY_RUN_STATE,
          ledger,
          dispatch: dispatch.step,
          target: { kind: type === "plan" ? "plan" : "spec", doc },
        });

        await run.advance();
        await run.advance();
        // Closed: the frontier holds no frame.
        expect(run.peekNext()).toBeNull();
        // One revision outside the round later the SAME line is open again — the
        // closure is not a blanket lock on the document.
        writeFileSync(doc, docOf("v0.3", "out-of-round"));
        expect(run.peekNext()!.frame.phase).toBe("review");
      } finally {
        cleanup();
      }
    });
  }

  for (const type of ["phase-spec", "overall", "plan", "single-spec"] as const) {
    it(`${type} — a BLOCKED fix that edited the doc advances nothing`, async () => {
      const { ledger, repo, cleanup } = fixture();
      try {
        const doc = docUnder(repo);
        mkdirSync(path.dirname(doc), { recursive: true });
        const original = docOf("v0.1", "one");
        const half = docOf("v0.2", "half");
        writeFileSync(doc, original); // the review-1 input — the baseline's source content
        const dispatch = stub((frame) => {
          if (frame.phase === "fix") {
            writeFileSync(doc, half);
            return { status: "BLOCKED" };
          }
          return { status: "APPROVED", findings: [finding("warn")] };
        });
        const run = new Lifecycle({
          face: targetFaces[type],
          state: EMPTY_RUN_STATE,
          ledger,
          dispatch: dispatch.step,
          target: { kind: type === "plan" ? "plan" : "spec", doc },
        });

        await run.advance(); // review 1 — the write-back binds `original`
        await run.advance(); // fix — BLOCKED: writes `half`, binds nothing (targetAction false)
        // The frontier offers the fix RETRY — drift never outranks a pending fix.
        expect(run.peekNext()!.frame.phase).toBe("fix");
        // The baseline did not advance — it still names the reviewed content, not the
        // half-written fix.
        const bound = ledger.reviewedDocRevisionOf(type, type)!;
        expect(bound.doc_hash).toBe(ledger.refs().docRevision(doc, original).doc_hash);
        expect(bound.doc_hash).not.toBe(ledger.refs().docRevision(doc, half).doc_hash);
      } finally {
        cleanup();
      }
    });
  }

  it("branch — a fix that edited the plan closes the branch line", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      const planPath = path.join(repo, ".kairos", "cdd", "docs/kairos/plans/x-plan.md");
      mkdirSync(path.dirname(planPath), { recursive: true });
      writeFileSync(planPath, planDoc([task(1, "none")]));
      const dispatch = stub((frame) => {
        if (frame.phase === "fix") {
          // A real fix rewrites its own output: one appended line changes the revision
          // without touching the plan structure the parser reads.
          writeFileSync(planPath, `${readFileSync(planPath, "utf8")}\n<!-- fix round edit -->\n`);
          return { status: "APPROVED" };
        }
        return { status: "APPROVED", findings: [finding("warn")] };
      });
      const run = new Lifecycle({
        face: targetFaces.branch,
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "branch" },
        planPath,
      });
      run.attachCapsule(new Capsule(new Words()));

      const review1 = await run.advance();
      expect(review1!.route!.kind).toBe("fix");
      const fix1 = await run.advance();
      expect(fix1!.frame.phase).toBe("fix");
      expect(fix1!.capsuleLines[1]).not.toMatch(/^next: review\b/);
      expect(run.peekNext()).toBeNull();
      expect(fix1!.route).toEqual({ kind: "done" });
      expect(await run.advance()).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("wave — a blocker-free fix still closes the wave line", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      const planPath = path.join(repo, ".kairos", "cdd", "plan.md");
      mkdirSync(path.dirname(planPath), { recursive: true });
      writeFileSync(planPath, planDoc([task(1, "none")]));
      const graph = taskGraph([task(1, "none")]);
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        if (frame.phase === "fix") return { status: "APPROVED" };
        return { status: "APPROVED", findings: [finding("nit")] };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
        planPath,
      });

      await run.advance(); // implement
      await run.advance(); // the nit review
      const fix = await run.advance();
      expect(fix!.frame.phase).toBe("fix");
      expect(fix!.route).toEqual({ kind: "done" });
      expect(run.peekNext()).toBeNull();
      expect(await run.advance()).toBeNull();
      expect(graph.doneTasks()).toEqual(new Set([1]));
    } finally {
      cleanup();
    }
  });
});

/** A CLOSED branch line in the fixture — a clean branch review over the plan binds the
 *  line's reviewed plan revision, so the drift-aware gate reads `same` and the line
 *  holds no active C5 hop (the §4.2 closed-station fact). */
const closedBranchLine = async (ledger: Ledger, planPath: string): Promise<void> => {
  const branch = new Lifecycle({
    face: targetFaces.branch,
    state: EMPTY_RUN_STATE,
    ledger,
    dispatch: stub(() => ({ status: "APPROVED", findings: [] })).step,
    target: { kind: "branch" },
    planPath,
  });
  const step = await branch.advance();
  expect(step!.frame.phase).toBe("branch-review");
  expect(step!.route).toEqual({ kind: "done" });
  expect(ledger.reviewGate("branch", planPath, "branch").kind).toBe("same");
  expect(ledger.lineRoute("branch", "branch")).toBeNull();
};

/** The wave line's closing round over a one-task plan — implement → the clean review.
 *  The capsule is attached so the `next:` judgment's render is observable. */
const runWaveToClosure = async (ledger: Ledger, planPath: string): Promise<StepResult> => {
  const wave = new Lifecycle({
    face: targetFaces.wave,
    state: taskGraph([task(1, "none")]),
    ledger,
    dispatch: stub((frame) =>
      frame.phase === "implement" ? APPROVED_IMPLEMENT : { status: "APPROVED", findings: [] },
    ).step,
    planPath,
    capsule: new Capsule(new Words()),
  });
  expect((await wave.advance())!.frame.phase).toBe("implement");
  return (await wave.advance())!;
};

describe("P21 §4.2 — the wave closure's next: reads the branch line's open fact", () => {
  // The defect this pins: a closed wave round always rendered the `review --type
  // branch` literal, even on an already-reviewed branch line its own gate refuses
  // ("the line holds no open round"). The Lifecycle computes the fact from the
  // branch row's drift-aware gate + its active C5 hop; the capsule only renders it.
  const seeded = (repo: string): string => {
    const file = path.join(repo, "plan.md");
    writeFileSync(file, planDoc([task(1, "none")]));
    return file;
  };

  it("a closed branch line lands the closing wave round on `next: route to /kairos:cdd-close skill`", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      const planPath = seeded(repo);
      await closedBranchLine(ledger, planPath);
      const closing = await runWaveToClosure(ledger, planPath);
      expect(closing.frame.phase).toBe("review");
      expect(closing.route).toEqual({ kind: "done" });
      // the branch line is closed, so the wave face's own next station renders —
      // never a literal the branch gate would refuse (the §4.2 self-contradiction)
      expect(closing.capsuleLines[1]).toBe("next: route to /kairos:cdd-close skill");
    } finally {
      cleanup();
    }
  });

  it("a plan revision past the reviewed one keeps the `review --type branch` literal", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      const planPath = seeded(repo);
      await closedBranchLine(ledger, planPath);
      // the plan advances AFTER the branch review — the drift-aware gate reopens the
      // line, so the wave closure hands off to a dispatchable branch round again
      writeFileSync(
        planPath,
        `${planDoc([task(1, "none")])}\n\n## Notes\n\n- plan advanced after the branch review\n`,
      );
      const closing = await runWaveToClosure(ledger, planPath);
      expect(closing.frame.phase).toBe("review");
      expect(closing.route).toEqual({ kind: "done" });
      expect(closing.capsuleLines[1]).toBe(`next: review --type branch --plan ${planPath}`);
    } finally {
      cleanup();
    }
  });
});

describe("P22 §5.2 — the capsule's NextHop absence on the failure face", () => {
  it("(g) a BLOCKED round prints no `next:` line, and the success face's two keys stay byte-identical", async () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      let blocked = true;
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: stub((frame) => {
          if (frame.phase === "implement")
            return blocked ? { status: "BLOCKED" } : APPROVED_IMPLEMENT;
          return { status: "APPROVED", findings: [] };
        }).step,
        capsule: new Capsule(new Words()),
      });
      const failure = await run.advance();
      // The failure face holds NO next object — the capsule's line set is the
      // status-only shape (the key table's failure class), never a `hop: null` row.
      expect(failure!.route).toBeNull();
      expect(failure!.capsuleLines).toEqual(["status: BLOCKED"]);
      expect(failure!.capsuleLines.some((line) => line.startsWith("next:"))).toBe(false);

      // The success face keeps the two pinned keys, byte-for-byte.
      blocked = false;
      const success = await run.advance();
      expect(success!.capsuleLines[0]).toMatch(/^status: APPROVED · handoff: .+/);
      expect(success!.capsuleLines[0]).not.toContain("blocker:");
      expect(success!.capsuleLines[1]).toMatch(/^next: /);
    } finally {
      cleanup();
    }
  });
});

describe("the capsule interaction seam — non-hard consumption", () => {
  it("advances output-less without a capsule; the attached seam renders the round facts", async () => {
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

      const silent = await run.advance();
      expect(silent!.capsuleLines).toEqual([]);

      const capsule: CapsuleFace = {
        emit: (status, handoff) => [`${status}: ${handoff}`],
      };
      run.attachCapsule(capsule);
      const rendered = await run.advance();
      expect(rendered!.capsuleLines.length).toBeGreaterThan(0);
      expect(rendered!.capsuleLines[0]).toContain("APPROVED");
    } finally {
      cleanup();
    }
  });

  it("the interaction seam accepts a plain route-less emit — the interface shape is pinned", () => {
    // Compile-time pins — this file fails under `tsc --noEmit` if the seam surface
    // drifts from the face/capsule contact (T10's Capsule satisfies the same type).
    const seam: CapsuleFace["emit"] = (status, handoff) => [`${status} ${handoff}`];
    expect(seam("APPROVED", "/ws/h.json")).toEqual(["APPROVED /ws/h.json"]);
  });
});

describe("T11/D30 — the wave review writes the reviewed BRIEF revision into the wave row", () => {
  it("a completed wave review binds the lifecycle's RENDERED-brief revision to the wave line (D30)", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      const planPath = path.join(repo, "plan.md");
      writeFileSync(planPath, planDoc([task(1, "none")]));
      const graph = taskGraph([task(1, "none")]);
      // the review approves on its first pass — the wave closes, but the revision
      // write-back lands in the bookkeep step BEFORE the closure route marks done
      const dispatch = stub((frame) =>
        frame.phase === "implement" ? APPROVED_IMPLEMENT : { status: "APPROVED", findings: [] },
      );
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
        planPath,
      });
      await run.advance(); // implement
      await run.advance(); // review — the completion records the wave's RENDERED brief revision
      const recorded = ledger.reviewedRevisionOf("1");
      expect(recorded).not.toBeNull();
      // D30 — the wave line binds its OWN ref kind (brief-revision), never the doc
      // line's doc-revision: `plan` is the render-from pointer, `brief_hash` the
      // RENDERED brief's digest (NOT the whole plan's — a plan edit outside this
      // wave's tasks leaves the brief byte-identical and must not void the wave)
      expect(recorded!.kind).toBe("brief-revision");
      if (recorded!.kind !== "brief-revision") throw new Error("unreachable");
      // P9 T4 — the persisted plan layer speaks the ONE canonical shape (repoRoot-
      // relative), so the fixture's basis (`<repo>/.kairos/cdd`) relativizes the
      // plan to `../../plan.md` (the ledger normalizes on write + comparison).
      expect(recorded!.plan).toBe("../../plan.md");
      expect(recorded!.brief_hash).toBe(briefHash(planPath, "1"));
      // the doc-line narrowing reader never surfaces a brief ref (a wave line is not
      // a doc line)
      expect(ledger.reviewedDocRevisionOf("1")).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a plan-less lifecycle records no wave revision — the null #planPath leaves the legacy wave row", async () => {
    const { ledger, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      const dispatch = stub((frame) =>
        frame.phase === "implement" ? APPROVED_IMPLEMENT : { status: "APPROVED", findings: [] },
      );
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
        // no planPath — the wave review completes with no plan fact on record
      });
      await run.advance();
      await run.advance();
      expect(ledger.reviewedRevisionOf("1")).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a FAILED wave review binds no revision — the verdict is the write-back gate", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      const planPath = path.join(repo, "plan.md");
      writeFileSync(planPath, planDoc([task(1, "none")]));
      const graph = taskGraph([task(1, "none")]);
      // the review's first two passes fail (one BLOCKED, one TIMEOUT); the third completes
      const failures: Array<"BLOCKED" | "TIMEOUT"> = ["BLOCKED", "TIMEOUT"];
      const dispatch = stub((frame) => {
        if (frame.phase === "implement") return APPROVED_IMPLEMENT;
        const failed = failures.shift();
        return failed === undefined ? { status: "APPROVED", findings: [] } : { status: failed };
      });
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
        planPath,
      });
      await run.advance(); // implement
      for (let pass = 0; pass < 2; pass += 1) {
        const failed = await run.advance();
        expect(failed!.frame.phase).toBe("review");
        // every dispatched round lands, the failed verdict riding its record
        expect(ledger.recordsOf("1").at(-1)).toMatchObject({
          op: "review",
          verdict: { targetAction: false },
        });
        // a hard-failed review never judged this revision — binding it would close the
        // drift identity the review did not read (AC: the write-back is verdict-gated)
        expect(ledger.reviewedRevisionOf("1")).toBeNull();
      }
      const completed = await run.advance(); // review — the completed round binds the brief
      expect(completed!.frame.phase).toBe("review");
      expect(ledger.reviewedRevisionOf("1")).not.toBeNull();
    } finally {
      cleanup();
    }
  });

  it("a wave-backfill edit reopens the wave at REVIEW on the lifecycle frontier — the gate's peer (D26 · D30)", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      const planPath = path.join(repo, "plan.md");
      writeFileSync(planPath, planDoc([task(1, "none")]));
      const graph = taskGraph([task(1, "none")]);
      const dispatch = stub((frame) =>
        frame.phase === "implement"
          ? APPROVED_IMPLEMENT
          : { status: "APPROVED", findings: [finding("blocker")] },
      );
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
        planPath,
      });
      await run.advance(); // implement
      const review = await run.advance(); // review — the blocker awaits its fix; the brief revision binds
      expect(review!.frame.phase).toBe("review");
      expect(review!.route!.kind).toBe("fix");
      // the wave's OWN task section moves mid-flight (an orchestrator fill/fix) — the
      // recorded brief now drifts from the wave's current brief
      writeFileSync(planPath, planDoc([task(1, "none"), ["  - extra step — checkable: green"]]));
      // the frontier re-offers the wave at REVIEW, never a stale `fix` — the drifted
      // brief voids the findings bound to the old revision. Without the single-source
      // derivation the frontier held `fix` while the gate accepted `review` (the
      // deadlock). The gate-side twin lives in wave.test.ts.
      const reopened = await run.advance();
      expect(reopened!.frame.phase).toBe("review");
    } finally {
      cleanup();
    }
  });

  it("an OUTSIDE-wave plan edit does NOT reopen the wave — the backfill's whole point (D30)", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      const planPath = path.join(repo, "plan.md");
      writeFileSync(planPath, planDoc([task(1, "none"), task(2, "1")]));
      const graph = taskGraph([task(1, "none"), task(2, "1")]);
      const dispatch = stub((frame) =>
        frame.phase === "implement"
          ? APPROVED_IMPLEMENT
          : { status: "APPROVED", findings: [finding("blocker")] },
      );
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
        planPath,
      });
      await run.advance(); // implement wave {1}
      await run.advance(); // review — binds wave {1}'s brief; the blocker awaits its fix
      // the plan gains a task OUTSIDE wave {1} (an append-only backfill) — the
      // Constraints + Task 1 sections are byte-identical, so wave {1}'s brief is
      // unchanged and the pending fix MUST survive (the whole-plan hash wrongly
      // reopened it; D30 binds the brief)
      writeFileSync(planPath, planDoc([task(1, "none"), task(2, "1"), task(3, "1,2")]));
      const kept = await run.advance();
      expect(kept!.frame.phase).toBe("fix");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P21 T3 — the branch line's identity is its PLAN's doc-revision (§4.1): the
// terminal branch review binds it, a later plan revision reopens the line, and an
// unchanged plan keeps it closed.
// ---------------------------------------------------------------------------

describe("P21 T3 — the branch line binds its plan's doc-revision", () => {
  it("a completed branch-review writes the plan's doc-revision into the branch row", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      const planPath = path.join(repo, "plan.md");
      const content = planDoc([task(1, "none")]);
      writeFileSync(planPath, content);
      const dispatch = stub(() => ({ status: "APPROVED", findings: [] }));
      const run = new Lifecycle({
        face: targetFaces.branch,
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "branch" },
        planPath,
      });
      const step = await run.advance();
      expect(step?.frame.phase).toBe("branch-review");
      const recorded = ledger.reviewedRevisionOf("branch");
      expect(recorded).not.toBeNull();
      expect(recorded?.kind).toBe("doc-revision");
      if (recorded?.kind !== "doc-revision") throw new Error("unreachable");
      // the persisted plan layer speaks the canonical repoRoot-relative shape
      expect(recorded.doc).toBe("../../plan.md");
      expect(recorded.doc_hash).toBe(createHash("sha1").update(content).digest("hex"));
      expect(ledger.reviewedRevisionOf("1")).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("stays closed while the plan is unchanged, and reopens once it advances", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      const planPath = path.join(repo, "plan.md");
      writeFileSync(planPath, planDoc([task(1, "none")]));
      const dispatch = stub(() => ({ status: "APPROVED", findings: [] }));
      const run = new Lifecycle({
        face: targetFaces.branch,
        state: EMPTY_RUN_STATE,
        ledger,
        dispatch: dispatch.step,
        target: { kind: "branch" },
        planPath,
      });
      await run.advance(); // branch-review → closed
      expect(ledger.reviewGate("branch", planPath, "branch").kind).toBe("same");
      expect(await run.advance()).toBeNull(); // the line holds no open round

      // the plan revision advances — the branch line reopens at branch-review
      writeFileSync(planPath, planDoc([task(1, "none"), task(2, "1")]));
      expect(ledger.reviewGate("branch", planPath, "branch").kind).toBe("open");
      const reopened = await run.advance();
      expect(reopened?.frame.phase).toBe("branch-review");
    } finally {
      cleanup();
    }
  });
});

describe("P21 §5.1 — the wave closure's plan-task snapshot (the append-vs-stall history)", () => {
  it("records the plan's task set at the wave's closure — the historical fact, never the plan's later shape", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      // The plan carries two tasks; the dispatched wave is {1} (task 2 depends on it).
      const planPath = path.join(repo, "plan.md");
      writeFileSync(planPath, planDoc([task(1, "none"), task(2, "1")]));
      const graph = taskGraph([task(1, "none"), task(2, "1")]);
      const dispatch = stub((frame) =>
        frame.phase === "implement" ? APPROVED_IMPLEMENT : { status: "APPROVED", findings: [] },
      );
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
        planPath,
      });
      await run.advance(); // implement
      await run.advance(); // review — the closure point takes the snapshot
      expect(ledger.planTasksOf("1")).toEqual([1, 2]);
      // The snapshot is idempotent history: the plan growing later never rewrites it.
      ledger.recordPlanTasks("1", [1, 2, 3]);
      expect(ledger.planTasksOf("1")).toEqual([1, 2]);
    } finally {
      cleanup();
    }
  });

  it("skips the snapshot when the plan path is unreadable — present facts only, never an invented []", async () => {
    const { ledger, repo, cleanup } = fixture();
    try {
      const graph = taskGraph([task(1, "none")]);
      const dispatch = stub((frame) =>
        frame.phase === "implement" ? APPROVED_IMPLEMENT : { status: "APPROVED", findings: [] },
      );
      const run = new Lifecycle({
        face: targetFaces.wave,
        state: graph,
        ledger,
        dispatch: dispatch.step,
        planPath: path.join(repo, "no-such-plan.md"),
      });
      await run.advance(); // implement
      await run.advance(); // review — closure, but the plan cannot be read
      expect(ledger.planTasksOf("1")).toBeNull();
      // The row exists and carries no planTasks key at all (not an empty set).
      const row = ledger.readProgress()?.waves.find((entry) => entry.wave === "1");
      expect(row).toBeDefined();
      expect("planTasks" in (row ?? {})).toBe(false);
    } finally {
      cleanup();
    }
  });
});
