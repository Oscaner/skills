// packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts
// P11 T4 — the RoundNaming colocated pins: the frame → artifact-name derivations
// (report / evidence / brief) the lifecycle's read-back and the dry-run preview
// share, and the family-op mapping those stems key on. The class touches no disk
// (resolve is pure path arithmetic), so the workspace is constructed inline.
//
// The file also carries the crash-name SINGLE-SOURCE pin: a source-face scan of the
// production tree, because the crash name is the identity the capsule's read face
// and the lifecycle's write face share by construction — a second derivation site
// would silently split them (the pin guards the derivation, never an unrelated
// `${frame.type}` form such as the resume command's).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "../../__tests__/support/strip-comments.ts";
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

  it("derives the crash record's name from the frame's ONE identity — verb preserved, no lane parameter", () => {
    // wave: the task group keys the line; the op keeps implement and review apart at
    // the same round (the two records coexist, never overwrite each other).
    expect(NAMING.crashName(frame({ type: "wave", round: 2, params: { tasks: "3,4" } }))).toBe(
      "crash-tasks-3,4-implement-2.json",
    );
    expect(
      NAMING.crashName(
        frame({ type: "wave", phase: "review", round: 2, params: { tasks: "3,4", round: 2 } }),
      ),
    ).toBe("crash-tasks-3,4-review-2.json");
    // branch: the line-type constant, the review family op (branch-review → review)
    expect(
      NAMING.crashName(
        frame({
          type: "branch",
          phase: "branch-review",
          round: 2,
          target: { kind: "branch" },
          params: { round: 2 },
          key: "branch",
        }),
      ),
    ).toBe("crash-branch-review-2.json");
    // doc lines: the doc-type constant
    expect(
      NAMING.crashName(
        frame({
          type: "plan",
          phase: "review",
          round: 2,
          target: { kind: "plan", doc: "p.md" },
          params: { round: 2 },
          key: "p.md",
        }),
      ),
    ).toBe("crash-plan-review-2.json");
    // crashPath is the same derivation resolved against the workspace
    expect(NAMING.crashPath(frame({ type: "wave", round: 2, params: { tasks: "3,4" } }))).toBe(
      inWorkspace("crash-tasks-3,4-implement-2.json"),
    );
  });
});

// ---------------------------------------------------------------------------
// the crash-name single source — the SOURCE-FACE pin (the narrowed acceptance)
// ---------------------------------------------------------------------------

/** The src-next plane root — the engine's production face (the scan set). */
const SRC_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Every production `.ts` file under the plane root (`__tests__/` excluded — the
 *  test plane names artifacts in fixtures and is not a derivation site). */
const collectProductionTs = (dir: string, out: string[]): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      collectProductionTs(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith(".ts")) {
      out.push(path.join(dir, entry.name));
    }
  }
};

/** Every `file:line` hit of one token over the production face (comments stripped —
 *  a prose mention is not a derivation). */
const hitsOf = (token: string): string[] => {
  const files: string[] = [];
  collectProductionTs(SRC_ROOT, files);
  const hits: string[] = [];
  for (const file of files) {
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index]!.includes(token)) hits.push(`${path.relative(SRC_ROOT, file)}:${index + 1}`);
    }
  }
  return hits;
};

/** The production lines that combine a crash-record name with a RAW frame type — the
 *  retired `crash-${lane}-${round}.json` shape (`lane` = `${op}.${frame.type}`). */
const crashNamesOnRawFrameType = (): string[] => {
  const files: string[] = [];
  collectProductionTs(SRC_ROOT, files);
  const hits: string[] = [];
  for (const file of files) {
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      if (line.includes("crash-") && line.includes("frame.type")) {
        hits.push(`${path.relative(SRC_ROOT, file)}:${index + 1}`);
      }
    }
  }
  return hits;
};

describe("the crash-name single source — RoundNaming derives every crash record's name", () => {
  it("builds the `crash-` name template at exactly ONE production site", () => {
    // Zero hits would strand the read/write faces (no name at all); a second hit
    // would re-seam the identity the capsule's read and the lifecycle's write share.
    expect(hitsOf("`crash-").map((hit) => hit.split(":")[0])).toEqual(["session/round-naming.ts"]);
  });

  it("derives no crash name from the raw frame type — the retired lane form is gone", () => {
    // The narrowed checkable: the crash-name DERIVATION is what is guarded, so the
    // legitimate `cdd fix --type ${frame.type}` resume form is never a hit.
    expect(crashNamesOnRawFrameType()).toEqual([]);
  });
});
