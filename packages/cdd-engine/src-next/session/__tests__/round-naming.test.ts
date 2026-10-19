// packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts
// P11 T4 — the RoundNaming colocated pins: the frame → artifact-name derivations
// (report / evidence / brief) the lifecycle's read-back and the dry-run preview
// share, and the family-op mapping those stems key on. The class touches no disk
// (resolve is pure path arithmetic), so the workspace is constructed inline.

import path from "node:path";
import { describe, expect, it } from "vitest";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import type { OpType } from "../ledger.ts";
import { RoundNaming } from "../round-naming.ts";
import type { OpenFrame } from "../run.ts";

const ROOT = "/repo";
const WORKSPACE = new Workspace(new WorkspaceRoot(ROOT, ".kairos/cdd"), "p3");
const NAMING = new RoundNaming(WORKSPACE);
const inWorkspace = (name: string): string => path.join(ROOT, ".kairos/cdd", "p3", name);

/** A frame built from the wave implement frame's shape; `over` supplies the face. */
const frame = (over: Partial<OpenFrame>): OpenFrame => ({
  type: "wave",
  phase: "implement",
  round: 1,
  target: { kind: "wave", tasks: [1] },
  params: { tasks: "1" },
  key: "1",
  ...over,
});

describe("RoundNaming — the frame → prescribed artifact names (report / evidence / brief)", () => {
  it("derives the brief path of a wave's task group", () => {
    expect(NAMING.brief("1,2")).toBe(inWorkspace("tasks-1,2-brief.md"));
  });

  it("derives the report path per face — the wave/branch family stems and the doc line's round-keyed stem", () => {
    // the wave implement round carries no round token (the line keys implement alone)
    expect(NAMING.report(frame({ type: "wave", phase: "implement" }))).toBe(
      inWorkspace("tasks-1-implement-report.md"),
    );
    // a wave review round books its own round-keyed report
    expect(
      NAMING.report(
        frame({ type: "wave", phase: "review", round: 2, params: { tasks: "1", round: 2 } }),
      ),
    ).toBe(inWorkspace("tasks-1-review-2-report.md"));
    // the branch review rides the review op (branch-review → review), never the raw phase
    expect(
      NAMING.report(
        frame({
          type: "branch",
          phase: "branch-review",
          round: 3,
          target: { kind: "branch" },
          params: { round: 3 },
          key: "branch",
        }),
      ),
    ).toBe(inWorkspace("branch-review-3-report.md"));
    expect(
      NAMING.report(
        frame({
          type: "branch",
          phase: "fix",
          round: 1,
          target: { kind: "branch" },
          params: { round: 1 },
          key: "branch",
        }),
      ),
    ).toBe(inWorkspace("branch-fix-1-report.md"));
    // the doc line keys the {type}-{op}-{round} stem
    expect(
      NAMING.report(
        frame({
          type: "spec",
          phase: "review",
          round: 1,
          target: { kind: "spec", doc: "s.md" },
          params: { round: 1 },
        }),
      ),
    ).toBe(inWorkspace("spec-review-1-report.md"));
    expect(
      NAMING.report(
        frame({
          type: "plan",
          phase: "fix",
          round: 2,
          target: { kind: "plan", doc: "p.md" },
          params: { round: 2 },
        }),
      ),
    ).toBe(inWorkspace("plan-fix-2-report.md"));
  });

  it("derives the evidence name/path on the work faces only — the review and doc faces prescribe none", () => {
    // the task families key the line; the branch line names the family alone
    expect(NAMING.evidenceName(frame({ type: "wave", phase: "implement" }))).toBe(
      "tasks-1-test-evidence.json",
    );
    expect(NAMING.evidence(frame({ type: "wave", phase: "implement" }))).toBe(
      inWorkspace("tasks-1-test-evidence.json"),
    );
    expect(
      NAMING.evidenceName(
        frame({ type: "wave", phase: "fix", round: 2, params: { tasks: "1", round: 2 } }),
      ),
    ).toBe("tasks-1-test-evidence.json");
    expect(
      NAMING.evidenceName(
        frame({ type: "branch", phase: "fix", target: { kind: "branch" }, params: { round: 1 } }),
      ),
    ).toBe("branch-test-evidence.json");
    // off the work faces the evidence slot is empty (only present facts ride)
    expect(
      NAMING.evidence(
        frame({ type: "wave", phase: "review", round: 1, params: { tasks: "1", round: 1 } }),
      ),
    ).toBe("");
    expect(
      NAMING.evidenceName(
        frame({ type: "spec", phase: "review", target: { kind: "spec", doc: "s.md" } }),
      ),
    ).toBe("");
    expect(
      NAMING.evidence(frame({ type: "plan", phase: "fix", target: { kind: "plan", doc: "p.md" } })),
    ).toBe("");
  });

  it("maps the frame phase to the handoff-family op — branch-review rides the review family", () => {
    expect(NAMING.op(frame({ phase: "implement" }))).toBe("implement");
    expect(NAMING.op(frame({ phase: "review" }))).toBe("review");
    expect(NAMING.op(frame({ phase: "fix" }))).toBe("fix");
    const branchReview = NAMING.op(frame({ type: "branch", phase: "branch-review" })) as OpType;
    expect(branchReview).toBe("review");
  });

  it("carries the evidence family prefix — tasks for the wave families, branch for the branch line", () => {
    expect(NAMING.prefix(frame({ type: "wave" }))).toBe("tasks");
    expect(NAMING.prefix(frame({ type: "branch" }))).toBe("branch");
  });
});
