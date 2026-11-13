// packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts
// P34 T1 — the RoundNaming colocated pins: ONE round identity (line · op · cycle ·
// attempt) renders every artifact name (draft · final · report · log · crash ·
// evidence) through `renderName`, so a kind's spelling and its siblings' cannot
// drift. The class touches no disk (resolve is pure path arithmetic), so the
// workspace is constructed inline.
//
// The file also carries the crash-name and artifact-stem SINGLE-SOURCE pins: a
// source-face scan of the production tree, because both identities are shared by a
// write face and a read face — a second derivation site would silently split them
// (the pins guard the derivation, never an unrelated `${frame.type}` form such as
// the resume command's).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "../../__tests__/support/strip-comments.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import type { OpType } from "../ledger.ts";
import { type ArtifactKind, RoundNaming } from "../round-naming.ts";
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
  params: { tasks: "1", round: 1, attempt: 1 },
  key: "1",
  ...over,
});

describe("RoundNaming — the ONE renderer (every kind, every line, every cycle/attempt)", () => {
  it("renders the six artifact kinds of one round off ONE stem — the literal grid", () => {
    const name = (kind: ArtifactKind, attempt: number, cycle: number): string =>
      RoundNaming.renderName({ line: "tasks-1", op: "implement", cycle, attempt }, kind);
    // attempt 1 never carries `-a1`; the cycle always rides the stem
    expect(name("draft", 1, 1)).toBe("tasks-1-implement-1.json");
    expect(name("final", 1, 1)).toBe("tasks-1-implement-1.c1.json");
    expect(name("report", 1, 1)).toBe("tasks-1-implement-1-report.md");
    expect(name("log", 1, 1)).toBe("tasks-1-implement-1.log");
    expect(name("crash", 1, 1)).toBe("crash-tasks-1-implement-1.json");
    expect(name("evidence", 1, 1)).toBe("tasks-1-implement-1-test-evidence.json");
    // a re-attempt inserts `-a{n}` at the stem's tail, before the final's `.c{n}`
    expect(name("draft", 2, 1)).toBe("tasks-1-implement-1-a2.json");
    expect(name("final", 2, 1)).toBe("tasks-1-implement-1-a2.c1.json");
    expect(name("report", 3, 2)).toBe("tasks-1-implement-2-a3-report.md");
    expect(name("log", 3, 2)).toBe("tasks-1-implement-2-a3.log");
    expect(name("crash", 3, 2)).toBe("crash-tasks-1-implement-2-a3.json");
    expect(name("evidence", 3, 2)).toBe("tasks-1-implement-2-a3-test-evidence.json");
  });

  it("pins each TargetType's line word across the grid — wave/branch review+fix and the doc lines", () => {
    const lines: ReadonlyArray<{ type: OpenFrame["type"]; line: string; op: OpType }> = [
      { type: "phase-spec", line: "phase-spec", op: "review" },
      { type: "overall", line: "overall", op: "fix" },
      { type: "plan", line: "plan", op: "review" },
      { type: "single-spec", line: "single-spec", op: "fix" },
      { type: "wave", line: "tasks-1", op: "review" },
      { type: "branch", line: "branch", op: "fix" },
    ];
    const kinds: readonly ArtifactKind[] = ["draft", "final", "report", "log", "crash", "evidence"];
    // The acceptance grid (spec §2.3): every line × cycle 1–2 × attempt 1–3.
    const identities = lines.flatMap(({ line, op }) =>
      [1, 2].flatMap((cycle) => [1, 2, 3].map((attempt) => ({ line, op, cycle, attempt }))),
    );
    // INJECTIVITY first: no two round identities may share a name of the same kind, so a
    // spelling that silently collapses two identities (the draft/final twin this test
    // grew from) fails here and not only under the wave implement literals.
    for (const kind of kinds) {
      const rendered = identities.map((identity) => RoundNaming.renderName(identity, kind));
      expect(new Set(rendered).size, `${kind} names must be unique per identity`).toBe(
        identities.length,
      );
    }
    for (const identity of identities) {
      const stem = `${identity.line}-${identity.op}-${identity.cycle}${identity.attempt > 1 ? `-a${identity.attempt}` : ""}`;
      for (const kind of kinds) {
        const name = RoundNaming.renderName(identity, kind);
        expect(name).toContain(stem);
        expect(name.startsWith("crash-")).toBe(kind === "crash");
        expect(name.endsWith(`-report.md`)).toBe(kind === "report");
        expect(name.endsWith(".log")).toBe(kind === "log");
        expect(name.endsWith("-test-evidence.json")).toBe(kind === "evidence");
      }
      // the final's own coordinate — `final` closes the cycle in its name, `draft` never does
      expect(RoundNaming.renderName(identity, "final")).toContain(`.c${identity.cycle}`);
      expect(RoundNaming.renderName(identity, "draft")).not.toContain(`.c${identity.cycle}`);
    }
  });

  it("omits a cycle it does not have — never a `-undefined` or `.cundefined` token", () => {
    const artifact = { line: "tasks-1", op: "implement" as const };
    expect(RoundNaming.renderName(artifact, "draft")).toBe("tasks-1-implement.json");
    expect(RoundNaming.renderName(artifact, "final")).toBe("tasks-1-implement.json");
    expect(RoundNaming.renderName(artifact, "report")).toBe("tasks-1-implement-report.md");
  });

  it("derives the brief path of a wave's task group — the dispatch INPUT carries no cycle", () => {
    expect(NAMING.brief("1,2")).toBe(inWorkspace("tasks-1,2-brief.md"));
  });

  it("derives the report path per face — the wave/branch family stem and the doc line's stem", () => {
    // every family carries its cycle now — the implement family included
    expect(NAMING.report(frame({ type: "wave", phase: "implement" }))).toBe(
      inWorkspace("tasks-1-implement-1-report.md"),
    );
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
          type: "phase-spec",
          phase: "review",
          round: 1,
          target: { kind: "spec", doc: "s.md" },
          params: { round: 1 },
        }),
      ),
    ).toBe(inWorkspace("phase-spec-review-1-report.md"));
    // the overall charter line keys its own round line — never folded into the spec line
    expect(
      NAMING.report(
        frame({
          type: "overall",
          phase: "review",
          round: 1,
          target: { kind: "spec", doc: "o-overall.md" },
          params: { round: 1 },
        }),
      ),
    ).toBe(inWorkspace("overall-review-1-report.md"));
    // the standalone single-spec line keys its own stem too
    expect(
      NAMING.report(
        frame({
          type: "single-spec",
          phase: "review",
          round: 1,
          target: { kind: "spec", doc: "x-single-spec.md" },
          params: { round: 1 },
        }),
      ),
    ).toBe(inWorkspace("single-spec-review-1-report.md"));
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
    // a re-attempt's report is its own name — the first attempt's report survives
    expect(
      NAMING.report(
        frame({
          type: "wave",
          phase: "fix",
          attempt: 2,
          params: { tasks: "1", round: 1, attempt: 2 },
        }),
      ),
    ).toBe(inWorkspace("tasks-1-fix-1-a2-report.md"));
  });

  it("derives the evidence name on the work faces only — three coordinates, and none off the doc shapes", () => {
    // the identity carries line · cycle · attempt — the three coordinates the read gate keys on
    expect(NAMING.evidenceName(frame({ type: "wave", phase: "implement" }))).toBe(
      "tasks-1-implement-1-test-evidence.json",
    );
    expect(NAMING.evidence(frame({ type: "wave", phase: "implement" }))).toBe(
      inWorkspace("tasks-1-implement-1-test-evidence.json"),
    );
    expect(
      NAMING.evidenceName(
        frame({ type: "wave", phase: "fix", round: 2, params: { tasks: "1", round: 2 } }),
      ),
    ).toBe("tasks-1-fix-2-test-evidence.json");
    expect(
      NAMING.evidenceName(
        frame({
          type: "branch",
          phase: "fix",
          round: 1,
          attempt: 3,
          target: { kind: "branch" },
          params: { round: 1, attempt: 3 },
        }),
      ),
    ).toBe("branch-fix-1-a3-test-evidence.json");
    // the document lines truncate the kind entirely (a zero-length name, never a path)
    expect(
      NAMING.evidenceName(
        frame({ type: "phase-spec", phase: "review", target: { kind: "spec", doc: "s.md" } }),
      ),
    ).toBe("");
    expect(
      NAMING.evidence(frame({ type: "plan", phase: "fix", target: { kind: "plan", doc: "p.md" } })),
    ).toBe("");
    // a review round of a work line prescribes none either (the evidence gate is the fix's)
    expect(
      NAMING.evidence(
        frame({ type: "wave", phase: "review", round: 1, params: { tasks: "1", round: 1 } }),
      ),
    ).toBe("");
  });

  it("maps the frame phase to the handoff-family op — branch-review rides the review family", () => {
    expect(NAMING.op(frame({ phase: "implement" }))).toBe("implement");
    expect(NAMING.op(frame({ phase: "review" }))).toBe("review");
    expect(NAMING.op(frame({ phase: "fix" }))).toBe("fix");
    const branchReview = NAMING.op(frame({ type: "branch", phase: "branch-review" })) as OpType;
    expect(branchReview).toBe("review");
  });

  it("derives the per-round log name — the shared stem, the attempt suffix and the .log face", () => {
    expect(NAMING.logName("review", "phase-spec", { round: 2 }, 1)).toBe("phase-spec-review-2.log");
    expect(NAMING.logName("fix", "wave", { tasks: "1", round: 1 }, 1)).toBe("tasks-1-fix-1.log");
    // the implement family carries its cycle too — the draft and final are two names
    expect(NAMING.logName("implement", "wave", { tasks: "1", round: 1 }, 1)).toBe(
      "tasks-1-implement-1.log",
    );
    // a re-attempt never overwrites attempt 1's log
    expect(NAMING.logName("fix", "wave", { tasks: "1", round: 1 }, 2)).toBe("tasks-1-fix-1-a2.log");
  });

  it("the log name is the report stem — the two names read ONE derivation", () => {
    const shapes: ReadonlyArray<{ frame: OpenFrame; op: OpType }> = [
      { frame: frame({ type: "wave", phase: "implement" }), op: "implement" },
      {
        frame: frame({ type: "wave", phase: "review", round: 2, params: { tasks: "1", round: 2 } }),
        op: "review",
      },
      {
        frame: frame({
          type: "branch",
          phase: "branch-review",
          round: 3,
          target: { kind: "branch" },
          params: { round: 3 },
          key: "branch",
        }),
        op: "review",
      },
      {
        frame: frame({
          type: "phase-spec",
          phase: "review",
          round: 1,
          attempt: 2,
          target: { kind: "spec", doc: "s.md" },
          params: { round: 1, attempt: 2 },
        }),
        op: "review",
      },
    ];
    for (const shape of shapes) {
      const stem = path.basename(NAMING.report(shape.frame)).replace(/-report\.md$/, "");
      expect(
        NAMING.logName(shape.op, shape.frame.type, shape.frame.params, shape.frame.attempt ?? 1),
      ).toBe(`${stem}.log`);
    }
  });

  it("allocates the attempt number — max attempt of the op/cycle plus one", () => {
    const records = [
      { op: "fix" as const, cycle: 1, attempt: 1 },
      { op: "review" as const, cycle: 1, attempt: 1 },
    ];
    expect(NAMING.attemptOf(records, "fix", 1)).toBe(2);
    expect(NAMING.attemptOf(records, "fix", 2)).toBe(1);
    expect(NAMING.attemptOf([], "implement", 1)).toBe(1);
  });

  it("carries the evidence family prefix — tasks for the wave families, branch for the branch line", () => {
    expect(NAMING.prefix(frame({ type: "wave" }))).toBe("tasks");
    expect(NAMING.prefix(frame({ type: "branch" }))).toBe("branch");
  });

  it("derives the crash record's name off the same stem — verb preserved, no lane parameter", () => {
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

describe("the artifact-stem single source — the report and its log name read ONE derivation", () => {
  it("builds the wave/branch family stem at exactly ONE production site", () => {
    // The family template IS the artifact stem's body: a second copy would let the
    // report and its round log diverge silently (one fact, one place).
    expect(hitsOf("tasks-${params.tasks").map((hit) => hit.split(":")[0])).toEqual([
      "session/round-naming.ts",
    ]);
  });
});

describe("the name-template single source — no second derivation site (P34 T3)", () => {
  /** The tokens that spell one artifact kind's suffix — each belongs to `renderName`. */
  const KIND_TOKENS = ["-report.md", "-test-evidence", ".c${", "-a${"];

  /** Production hits minus the renderer's own home (the ONE place they may live). */
  const outsideRenderer = (token: string): string[] =>
    hitsOf(token).filter((hit) => !hit.startsWith("session/round-naming.ts:"));

  it("keeps every kind suffix inside RoundNaming — a caller assembles no name", () => {
    // A suffix copied into a caller would let one artifact's spelling drift from its
    // siblings' while every unit test still passes (the two faces would disagree).
    for (const token of KIND_TOKENS) expect(outsideRenderer(token), token).toEqual([]);
  });

  it("keeps the family surface a membership key set — never a name template", () => {
    // The family table answers ONE question ("is this op · type a handoff family?"), so
    // `#family(op, type)`'s key-set check is deliberately OUTSIDE this judge surface.
    // A family row interpolated into a name would re-open the derivation this wave
    // closed, so no production line may combine the surface with a name body.
    const files: string[] = [];
    collectProductionTs(SRC_ROOT, files);
    const assembled: string[] = [];
    for (const file of files) {
      const lines = stripComments(readFileSync(file, "utf8")).split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]!;
        if (!/families/.test(line)) continue;
        // The membership check IS the key-set read this surface is allowed to be.
        if (/this\.#families\.includes\(/.test(line)) continue;
        if (/(\$\{|replace\(|tasks-|crash-|\.json)/.test(line)) {
          assembled.push(`${path.relative(SRC_ROOT, file)}:${index + 1}`);
        }
      }
    }
    expect(assembled).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// the carrier's two names — draft and final, the same stem, `.c<N>` suffixed
// ---------------------------------------------------------------------------

describe("RoundNaming — the carrier's two names (the draft never holds the final)", () => {
  it("renders the final beside the draft — the cycle is the final's own suffix", () => {
    expect(RoundNaming.renderName({ line: "tasks-1", op: "review", cycle: 2 }, "final")).toBe(
      "tasks-1-review-2.c2.json",
    );
    expect(RoundNaming.renderName({ line: "phase-spec", op: "fix", cycle: 3 }, "final")).toBe(
      "phase-spec-fix-3.c3.json",
    );
    // a cycle-less identity has one name only — never a `.c.json` malformed suffix
    expect(RoundNaming.renderName({ line: "tasks-1", op: "implement" }, "final")).toBe(
      "tasks-1-implement.json",
    );
  });

  it("resolves both names against the workspace — one derivation, four spellings", () => {
    const artifact = { line: "tasks-1", op: "review" as const, cycle: 2, attempt: 2 };
    expect(NAMING.renderPath(artifact, "draft")).toBe(inWorkspace("tasks-1-review-2-a2.json"));
    expect(NAMING.renderPath(artifact, "final")).toBe(inWorkspace("tasks-1-review-2-a2.c2.json"));
  });

  it("recognizes the engine's two minted carrier shapes and nothing else", () => {
    // draft and final, with and without the attempt segment, legacy implement included
    const minted = [
      "tasks-1-implement-1.json",
      "tasks-1-implement-1.c1.json",
      "tasks-1-implement-1-a2.json",
      "tasks-7,9-review-2.json",
      "tasks-7,9-review-2.c2.json",
      "tasks-7,9-review-2-a3.json",
      "branch-review-3.json",
      "branch-fix-2.c2.json",
      "phase-spec-review-1.json",
      "phase-spec-fix-1.c1.json",
      "overall-review-2.json",
      "overall-fix-2.c2.json",
      "plan-fix-1.c1.json",
      "plan-review-2-a2.json",
      "single-spec-review-1.json",
      // the pre-P34 cycle-less implement spelling a draft on disk may still carry
      "tasks-1-implement.json",
    ];
    for (const name of minted) expect(RoundNaming.isCarrierName(name)).toBe(true);
    // the four neighbours the seal sweep must never touch, plus the family table's
    // retired shapes that were never carriers
    const neighbours = [
      "progress.json",
      "base.json",
      "tasks-1-implement-1-test-evidence.json",
      "branch-fix-1-test-evidence.json",
      "tasks-1-review-2.c2.rulings.json",
      "tasks-1-review-2-report.md",
      "tasks-1-implement-1.log",
      "crash-tasks-1-review-2.json",
      "crash-tasks-1-implement-1.json",
      "tasks-1-brief.md",
      "notes.json",
      // implement is the wave-only family — a branch/doc line never mints it
      "branch-implement-1.json",
      // a cycle-less name has no cycle to suffix: `.c{n}` is only ever the final of a
      // cycle-bearing identity, so this shape is never minted
      "tasks-1-implement.c1.json",
    ];
    for (const name of neighbours) expect(RoundNaming.isCarrierName(name)).toBe(false);
  });
});
