// packages/cdd-engine/src-next/session/__tests__/reviewed-identity.matrix.test.ts
// P25 T2 — the write-back judgment's three-axis matrix (`phase × kind × planPath`).
// ONE hand-written oracle table drives BOTH faces of the same write-back:
//
//   · LEFT  — the render face: `Preview#render(op, frame)`'s `would record:` row. The
//     word a round states is `reviewedRevision(doc)` / `reviewedRevision(brief)`, or
//     nothing at all (no leg).
//   · RIGHT — the record face: a hermetic lifecycle run to the SAME phase, then the
//     ledger row the completed round bound its reviewed revision to.
//
// Three values per cell — `left == right == the oracle's expectation` — never two:
// after the single-source refactor both faces flow through `ReviewedIdentity.legOf`,
// so a bare `left == right` stays green even when the judgment itself answers wrong.
//
// NEITHER side calls `legOf` (this file does not import the judgment at all): a case
// that called it would only prove "the same function ran twice".
//
// `fix` cells compare HASHES, not the ref kind. A fix round arrives by bypassing an
// already-completed review round, and that review already bound the SAME ledger key
// with the SAME ref kind — so "the fix write-back was dropped" is permanently green
// on a kind comparison. The fixture therefore MOVES the judgment input inside the fix
// round (the clean-tree gate runs before the dispatch, so an in-round edit never
// reroutes) and asserts the bound hash equals the fix input's hash, after first
// pinning `reviewHash !== fixHash`: a fixture that stopped moving must fail loudly
// instead of going quietly inert.
//
// Reachability is the faces table's fact (`TargetFace#product.reviewLead`): `implement`
// dispatches on the wave line alone, `branch-review` on the branch line alone. Cells
// the dispatcher never produces are NAMED below with their reason, never silently
// omitted — and the `planPath` axis is meaningless for the `plan` / `spec` kinds (one
// cell each, not two).
//
// The conservative chain ("a kind the target union does not list writes nothing") is
// NOT a cell here — the matrix enumerates the four legal kinds only, and neither face
// may consult `legOf`. That pin lives in `reviewed-identity.guard.test.ts` (the
// runtime grid's bogus-kind cell).
//
// The two REGISTERED asymmetries are pinned here, not "fixed" (spec §3): ① the
// verdict flag `targetAction` exists on a real run alone; ② a wave round whose line
// carries no plan path records nothing while the preview still states the brief leg.
// Both are existing, byte-frozen behaviour.
//
// Zero module-level bare functions — every helper is an arrow const (the repo's
// zero-`function` declaration discipline).

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PlanDocType } from "../../contract/doc.ts";
import type { DispatchScene } from "../../face/cli.ts";
import type { CliVerb } from "../../face/declare.ts";
import { Preview } from "../../face/preview.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { BriefRenderer } from "../../render/brief.ts";
import type { TargetFace } from "../faces.ts";
import { targetFaces } from "../faces.ts";
import { TaskGraph } from "../graph.ts";
import { Ledger, type LedgerKey, type RoundPhase } from "../ledger.ts";
import type { AuditTarget, DispatchOutcome, DispatchStep, OpenFrame } from "../run.ts";
import { EMPTY_RUN_STATE, Lifecycle } from "../run.ts";

/** The render face's leg vocabulary — the one word a `would record:` row states. */
type LegWord = "doc" | "brief";

/** The `planPath` axis: present, absent, or inapplicable (the doc kinds key their
 *  write-back on the judged document alone — the axis cannot change the answer). */
type PlanPathAxis = "yes" | "none" | "n/a";

/** One matrix cell — the oracle row both faces are compared against. */
interface Cell {
  readonly phase: RoundPhase;
  readonly kind: AuditTarget["kind"];
  readonly planPath: PlanPathAxis;
  /** The render face's expected word (null = the row states no leg). */
  readonly preview: LegWord | null;
  /** The record face's expected word, read back from the ref kind (null = no write). */
  readonly ledgerKind: LegWord | null;
  /** The ledger row the round writes to (or would, when no leg is expected). */
  readonly ledgerKey: LedgerKey;
  /** A `fix` cell with a leg: its judgment input MUST move between the review and the
   *  fix round, or the hash pin is inert. */
  readonly moved?: true;
  /** The ONE registered asymmetry this cell pins (its two faces intentionally differ). */
  readonly asymmetry?: "wave-without-plan-path";
}

const sha1 = (text: string): string => createHash("sha1").update(text).digest("hex");

/** A plan document over `### Task N:` blocks (the `run.test.ts` fixture shape). */
const planDoc = (blocks: readonly (readonly string[])[]): string =>
  [
    "---",
    "title: Test Plan",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-10-09",
    "slug: x-p25",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    ...blocks.flat(),
  ].join("\n");

/** One task block with its `- **DependsOn**:` edge. */
const task = (id: number, dependsOn: string): readonly string[] => [
  `### Task ${id}: task ${id}`,
  `- **DependsOn**: ${dependsOn}`,
];

/** The pristine plan and the plan whose wave-1 section moved: an extra step inside
 *  the wave's OWN task section changes the rendered brief, nothing outside it. */
const PLAN = planDoc([task(1, "none")]);
const MOVED_PLAN = planDoc([task(1, "none"), ["  - extra step — checkable: green"]]);

/** The judged documents: one pristine text, one moved text (a real content change). */
const DOC = "# judged document\n\n- one\n";
const MOVED_DOC = "# judged document\n\n- one\n- two\n";

// ---------------------------------------------------------------------------
// the oracle — ONE table, hand-written from the specification (never derived from
// the judgment, which this file does not import)
// ---------------------------------------------------------------------------

const CELLS: readonly Cell[] = [
  // implement — the wave line alone: the phase binds nothing, with or without a plan path
  {
    phase: "implement",
    kind: "wave",
    planPath: "yes",
    preview: null,
    ledgerKind: null,
    ledgerKey: "1",
  },
  {
    phase: "implement",
    kind: "wave",
    planPath: "none",
    preview: null,
    ledgerKind: null,
    ledgerKey: "1",
  },
  // review — the wave line
  {
    phase: "review",
    kind: "wave",
    planPath: "yes",
    preview: "brief",
    ledgerKind: "brief",
    ledgerKey: "1",
  },
  {
    phase: "review",
    kind: "wave",
    planPath: "none",
    preview: "brief",
    ledgerKind: null,
    ledgerKey: "1",
    asymmetry: "wave-without-plan-path",
  },
  // review — the doc line (the planPath axis is inapplicable: one cell per kind)
  {
    phase: "review",
    kind: "plan",
    planPath: "n/a",
    preview: "doc",
    ledgerKind: "doc",
    ledgerKey: "plan",
  },
  {
    phase: "review",
    kind: "spec",
    planPath: "n/a",
    preview: "doc",
    ledgerKind: "doc",
    ledgerKey: "phase-spec",
  },
  // fix — the wave line (moved: the fix round must bind a DIFFERENT brief)
  {
    phase: "fix",
    kind: "wave",
    planPath: "yes",
    preview: "brief",
    ledgerKind: "brief",
    ledgerKey: "1",
    moved: true,
  },
  {
    phase: "fix",
    kind: "wave",
    planPath: "none",
    preview: "brief",
    ledgerKind: null,
    ledgerKey: "1",
    asymmetry: "wave-without-plan-path",
  },
  // fix — the doc line (moved: the fix round must bind a DIFFERENT document)
  {
    phase: "fix",
    kind: "plan",
    planPath: "n/a",
    preview: "doc",
    ledgerKind: "doc",
    ledgerKey: "plan",
    moved: true,
  },
  {
    phase: "fix",
    kind: "spec",
    planPath: "n/a",
    preview: "doc",
    ledgerKind: "doc",
    ledgerKey: "phase-spec",
    moved: true,
  },
  // branch-review — the branch line alone, both plan-path faces (the `none` cell is
  // this phase's OWN new pin: it had none before this task)
  {
    phase: "branch-review",
    kind: "branch",
    planPath: "yes",
    preview: "doc",
    ledgerKind: "doc",
    ledgerKey: "branch",
  },
  {
    phase: "branch-review",
    kind: "branch",
    planPath: "none",
    preview: null,
    ledgerKind: null,
    ledgerKey: "branch",
  },
  // fix — the branch line
  {
    phase: "fix",
    kind: "branch",
    planPath: "yes",
    preview: "doc",
    ledgerKind: "doc",
    ledgerKey: "branch",
    moved: true,
  },
  {
    phase: "fix",
    kind: "branch",
    planPath: "none",
    preview: null,
    ledgerKind: null,
    ledgerKey: "branch",
  },
];

/** The `(phase, kind)` pairs the dispatcher can actually produce — the faces table's
 *  two review-lead words plus `implement`'s wave-only dispatch. */
const REACHABLE: readonly string[] = [
  "implement × wave",
  "review × wave",
  "review × plan",
  "review × spec",
  "fix × wave",
  "fix × plan",
  "fix × spec",
  "branch-review × branch",
  "fix × branch",
];

/** The cells the dispatcher never produces, each with its reason — listed by name so
 *  the omission is a decision, not an accident. */
const SKIPPED: ReadonlyArray<{ readonly pair: string; readonly reason: string }> = [
  {
    pair: "implement × branch",
    reason:
      "the branch line's review lead is branch-review — implement dispatches on the wave line alone",
  },
  {
    pair: "implement × plan",
    reason: "the plan line opens at its review lead — implement dispatches on the wave line alone",
  },
  {
    pair: "implement × spec",
    reason: "the spec line opens at its review lead — implement dispatches on the wave line alone",
  },
  {
    pair: "branch-review × wave",
    reason:
      "the wave line's review lead is review — branch-review dispatches on the branch line alone",
  },
  {
    pair: "branch-review × plan",
    reason:
      "the plan line's review lead is review — branch-review dispatches on the branch line alone",
  },
  {
    pair: "branch-review × spec",
    reason:
      "the spec line's review lead is review — branch-review dispatches on the branch line alone",
  },
  {
    pair: "review|fix × plan|spec × planPath",
    reason: "the doc kinds bind the JUDGED document — the plan-path axis cannot change the leg",
  },
];

const pairOf = (cell: Cell): string => `${cell.phase} × ${cell.kind}`;

const labelOf = (cell: Cell): string =>
  `${cell.phase} × ${cell.kind} · planPath ${cell.planPath} — preview ${cell.preview ?? "no leg"} / ledger ${cell.ledgerKind ?? "no write-back"}`;

const faceOf = (cell: Cell): TargetFace => {
  if (cell.kind === "wave") return targetFaces.wave;
  if (cell.kind === "branch") return targetFaces.branch;
  return cell.kind === "plan" ? targetFaces.plan : targetFaces["phase-spec"];
};

// ---------------------------------------------------------------------------
// the LEFT face — the preview's own render output (inline scene, no disk)
// ---------------------------------------------------------------------------

const PREVIEW_ROOT = "/repo";

/** The plan path one cell's scene carries — present only on the `yes` axis. The doc
 *  kinds carry none: the axis is a non-input of their leg. */
const planPathOf = (cell: Cell): string | null =>
  cell.planPath === "yes" ? path.join(PREVIEW_ROOT, "plan.md") : null;

/** The judged document path one cell's frame carries (null on the wave line, whose
 *  judgment input is the rendered brief). */
const docPathOf = (cell: Cell): string | null => {
  if (cell.kind === "plan") return path.join(PREVIEW_ROOT, "judged-plan.md");
  if (cell.kind === "spec") return path.join(PREVIEW_ROOT, "judged-spec.md");
  if (cell.kind === "branch") return path.join(PREVIEW_ROOT, "plan.md");
  return null;
};

const verbOf = (cell: Cell): CliVerb => (cell.phase === "branch-review" ? "review" : cell.phase);

/** The open frame one cell renders — the same shape the lifecycle builds. */
const frameOf = (cell: Cell): OpenFrame => {
  const target: AuditTarget =
    cell.kind === "wave"
      ? { kind: "wave", tasks: [1] }
      : cell.kind === "branch"
        ? { kind: "branch" }
        : { kind: cell.kind, doc: docPathOf(cell) ?? "" };
  return {
    type: cell.kind === "spec" ? "phase-spec" : cell.kind,
    phase: cell.phase,
    round: 1,
    target,
    params: cell.kind === "wave" ? { tasks: "1", round: 1 } : { round: 1 },
    key: String(cell.ledgerKey),
  };
};

/** The render face's observed word for one cell — read off the real `would record:`
 *  row (never off the judgment). */
const previewWordOf = (cell: Cell): LegWord | null => {
  const workspace = new Workspace(new WorkspaceRoot(PREVIEW_ROOT, ".kairos/cdd"), "p25");
  const scene: DispatchScene = {
    workspace,
    ledger: new Ledger(workspace, new ConfigLoader()),
    planPath: planPathOf(cell),
    briefPath: null,
  };
  const lines = new Preview({ scene, env: {} }).render(verbOf(cell), frameOf(cell));
  const row = lines.find((line) => line.trimStart().startsWith("would record:"));
  if (row === undefined) throw new Error("the preview printed no `would record:` row");
  const match = /reviewedRevision\((doc|brief)\)/.exec(row);
  return match === null ? null : (match[1] as LegWord);
};

// ---------------------------------------------------------------------------
// the RIGHT face — a hermetic lifecycle run to the same phase
// ---------------------------------------------------------------------------

/** One cell's hermetic fixture — the temp repo, the ledger, the lifecycle, and the
 *  two facts a `moved` cell needs: the judgment input and the way it moves. */
interface Fixture {
  readonly run: Lifecycle;
  readonly ledger: Ledger;
  /** The CURRENT judgment input's content (the brief the wave line renders, the
   *  document the doc/branch line judges). */
  readonly input: () => string;
  /** The judgment input's digest BEFORE the run — the review round's own input (the
   *  move lands inside the fix round and nowhere earlier). */
  readonly pristineHash: string;
  readonly cleanup: () => void;
}

const APPROVED_IMPLEMENT: DispatchOutcome = {
  status: "APPROVED",
  carrier: { artifacts: { brief: "/tmp/brief.md" } },
};

/** A review finding — any severity routes the fix round; a `warn` keeps the line
 *  open without blocking it. */
const WARN = { severity: "warn", summary: "drift" } as const;

/** Read the ledger row's ref kind back as the render face's word. */
const ledgerWordOf = (ledger: Ledger, cell: Cell): LegWord | null => {
  const reviewed = ledger.reviewedRevisionOf(cell.ledgerKey);
  if (reviewed === null) return null;
  return reviewed.kind === "brief-revision" ? "brief" : "doc";
};

/** Build one cell's fixture and drive it to the cell's own phase. */
const runCell = async (
  cell: Cell,
  over: { readonly dispatch?: DispatchStep } = {},
): Promise<Fixture> => {
  const root = mkdtempSync(path.join(tmpdir(), "reviewed-identity-"));
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(root, ".kairos", "cdd"), "session"),
    "p25",
  );
  const ledger = new Ledger(workspace, new ConfigLoader());
  const planPath = cell.planPath === "yes" ? path.join(root, "plan.md") : null;
  const docPath =
    docPathOf(cell) === null ? null : path.join(root, path.basename(docPathOf(cell) as string));
  // The wave and branch lines judge the plan line's document; the doc lines judge
  // their own target document. A plan-less cell writes no plan source at all —
  // the absent axis IS the absence of the plan fact.
  if (planPath !== null) writeFileSync(planPath, PLAN);
  if (docPath !== null && docPath !== planPath) writeFileSync(docPath, DOC);
  const move = (): void => {
    if (cell.kind === "wave") {
      if (planPath !== null) writeFileSync(planPath, MOVED_PLAN);
      return;
    }
    if (docPath !== null) writeFileSync(docPath, MOVED_DOC);
  };
  const script: DispatchStep = async (frame) => {
    if (frame.phase === "implement") return APPROVED_IMPLEMENT;
    if (frame.phase === "fix") {
      // The move lands INSIDE the fix round: the clean-tree gate already ran before
      // the dispatch, so an in-round edit never reroutes the round it belongs to.
      if (cell.moved === true) move();
      return { status: "APPROVED" };
    }
    // The review-lead round: a fix cell's source review carries one warn finding (any
    // finding routes the fix); a plain review cell approves and closes.
    return cell.phase === "fix"
      ? { status: "APPROVED", findings: [WARN] }
      : { status: "APPROVED", findings: [] };
  };
  const target: AuditTarget | undefined =
    cell.kind === "wave"
      ? undefined
      : cell.kind === "branch"
        ? { kind: "branch" }
        : { kind: cell.kind, doc: docPath as string };
  const graph = new TaskGraph(new PlanDocType("plan").parse(PLAN.split("\n")));
  const run = new Lifecycle({
    face: faceOf(cell),
    state: cell.kind === "wave" ? graph : EMPTY_RUN_STATE,
    ledger,
    dispatch: over.dispatch ?? script,
    target,
    planPath,
  });
  const input = (): string =>
    cell.kind === "wave"
      ? planPath === null
        ? ""
        : new BriefRenderer().render(readFileSync(planPath, "utf8"), [1])
      : docPath === null
        ? ""
        : readFileSync(docPath, "utf8");
  const fixture: Fixture = {
    run,
    ledger,
    input,
    pristineHash: sha1(input()),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
  await driveTo(fixture, cell);
  return fixture;
};

/** The phases one cell's line walks to reach its round: the wave line opens at
 *  `implement` (so its review/fix cells step past it), every other line opens at its
 *  own review lead. */
const stepsOf = (cell: Cell): number => {
  if (cell.kind === "wave") {
    if (cell.phase === "implement") return 1;
    return cell.phase === "review" ? 2 : 3;
  }
  return cell.phase === "fix" ? 2 : 1;
};

/** Drive one cell's lifecycle to its phase, asserting the framed phase at the end. */
const driveTo = async (fixture: Fixture, cell: Cell): Promise<void> => {
  const steps = stepsOf(cell);
  for (let step = 0; step < steps; step += 1) {
    const result = await fixture.run.advance();
    if (result === null) throw new Error(`${labelOf(cell)}: the run held no open frame`);
    if (step === steps - 1 && result.frame.phase !== cell.phase)
      throw new Error(`${labelOf(cell)}: the run framed ${result.frame.phase}, not ${cell.phase}`);
  }
};

// ---------------------------------------------------------------------------
// the matrix — one cell per reachable combination
// ---------------------------------------------------------------------------

describe("the matrix — left == right == the hand-written oracle, per reachable cell", () => {
  it("covers exactly the reachable (phase, kind) pairs — every skipped pair is named", () => {
    expect([...new Set(CELLS.map(pairOf))].sort()).toEqual([...REACHABLE].sort());
    for (const skipped of SKIPPED) {
      expect(REACHABLE, `${skipped.pair} is not a skipped cell`).not.toContain(skipped.pair);
      expect(skipped.reason.length, `${skipped.pair} states no reason`).toBeGreaterThan(0);
    }
    for (const cell of CELLS) {
      // the doc kinds carry the inapplicable axis, the node kinds never do
      if (cell.kind === "plan" || cell.kind === "spec") expect(cell.planPath).toBe("n/a");
      else expect(cell.planPath).not.toBe("n/a");
      // a fix cell with a leg must move its input, or its hash pin is inert
      if (cell.phase === "fix" && cell.ledgerKind !== null) expect(cell.moved).toBe(true);
      // the asymmetry marker never lands on a cell the two faces agree on
      if (cell.asymmetry !== undefined) expect(cell.preview).not.toBe(cell.ledgerKind);
    }
  });

  for (const cell of CELLS) {
    it(labelOf(cell), async () => {
      // LEFT — the render face's real output against the oracle.
      const left = previewWordOf(cell);
      expect(left, `the preview's word for ${labelOf(cell)}`).toBe(cell.preview);

      // RIGHT — the record face's ledger fact against the oracle.
      const fixture = await runCell(cell);
      try {
        const reviewHash = fixture.pristineHash;
        const right = ledgerWordOf(fixture.ledger, cell);
        expect(right, `the ledger's write-back for ${labelOf(cell)}`).toBe(cell.ledgerKind);

        // THREE VALUES — the two faces agree with the one expectation, except the
        // cell whose registered asymmetry says they intentionally differ.
        if (cell.asymmetry === undefined) expect(left).toBe(right);

        if (cell.moved === true) {
          const fixHash = sha1(fixture.input());
          // A cell whose input never moved is inert — fail loudly, never go green.
          expect(
            reviewHash,
            `${labelOf(cell)}: the fixture did not move the judgment input`,
          ).not.toBe(fixHash);
          if (cell.kind === "wave") {
            const recorded = fixture.ledger.reviewedRevisionOf(cell.ledgerKey);
            if (recorded === null || recorded.kind !== "brief-revision")
              throw new Error(`${labelOf(cell)}: no brief-revision on the wave row`);
            expect(recorded.brief_hash, `${labelOf(cell)}: the fix brief was not bound`).toBe(
              fixHash,
            );
          } else {
            const recorded = fixture.ledger.reviewedDocRevisionOf(cell.ledgerKey);
            if (recorded === null) throw new Error(`${labelOf(cell)}: no doc-revision on the row`);
            expect(recorded.doc_hash, `${labelOf(cell)}: the fix document was not bound`).toBe(
              fixHash,
            );
          }
        }
      } finally {
        fixture.cleanup();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// the two registered asymmetries — pinned, NOT fixed in this phase
// ---------------------------------------------------------------------------

/** The wave review cell both asymmetry cases speak about. */
const WAVE_REVIEW: Cell = {
  phase: "review",
  kind: "wave",
  planPath: "yes",
  preview: "brief",
  ledgerKind: "brief",
  ledgerKey: "1",
};

describe("the registered asymmetries — existing, byte-frozen behaviour", () => {
  it("① a BLOCKED round records no write-back while the preview states the leg", async () => {
    // Existing behaviour, not fixed in this phase: `targetAction` is the real run's
    // own input (a dry run holds no verdict), so a round that did not complete records
    // no revision while the preview states the leg a completed round would bind.
    const fixture = await runCell(WAVE_REVIEW, {
      dispatch: async (frame): Promise<DispatchOutcome> =>
        frame.phase === "implement" ? APPROVED_IMPLEMENT : { status: "BLOCKED" },
    });
    try {
      // the round IS recorded — only its write-back is gated on the verdict
      expect(fixture.ledger.recordsOf("1").at(-1)).toMatchObject({
        op: "review",
        verdict: { targetAction: false },
      });
      expect(fixture.ledger.reviewedRevisionOf("1")).toBeNull();
    } finally {
      fixture.cleanup();
    }
    // the preview has no verdict to read: it states the leg regardless
    expect(previewWordOf(WAVE_REVIEW)).toBe("brief");
  });

  it("② the wave line with no plan path: the preview states brief, the ledger writes nothing", async () => {
    // Existing behaviour, not fixed in this phase: the plan path is an INPUT of the
    // wave write-back (the brief renders from it), so a plan-less line records
    // nothing — while the preview, holding no plan fact either, still states the leg.
    const cell: Cell = {
      phase: "review",
      kind: "wave",
      planPath: "none",
      preview: "brief",
      ledgerKind: null,
      ledgerKey: "1",
      asymmetry: "wave-without-plan-path",
    };
    expect(previewWordOf(cell)).toBe("brief");
    const fixture = await runCell(cell);
    try {
      expect(fixture.ledger.reviewedRevisionOf("1")).toBeNull();
    } finally {
      fixture.cleanup();
    }
  });
});
