// packages/cdd-engine/src-next/session/__tests__/next.test.ts
// T7 NextStepRouter suite (design spec §3.2 · v1.20 the closure single verdict) — the C5
// decision table:
//   · review zero findings → close(state) — readyBatch empty → done, else next-wave;
//   · review findings non-empty (any severity) → the one-way fix hop;
//   · fix blocker>0 → a re-review hop (the live tree, no commit identity);
//   · fix blocker==0 (warn/nit only or clean) → close(state) — the unified closure, never
//     the retired `none`;
//   · the review-cycle soft cap → the "BLOCKED: review-cycle-cap" suggestion (outranks the
//     blocker row); REVIEW_CYCLE_CAP + the suggestion wording are the pinned constants;
//   · the fix-route readback suffix — FIX_READBACK_SUFFIX — the declared single-source
//     wording the capsule appends to the fix hop's `next:` render (verbatim, by reference);
//   · BLOCKED/TIMEOUT → null (no next line — the failure face), every phase;
//   · implement → the group's review (the live tree); branch-review → closure / fix;
//   · the `none` route kind is RETIRED (closure renders done / next-wave), and a
//     completed non-failed round producing null is a hard error on the dispatch face.
// The type assertions at the bottom pin the public surface compile-time (the brief's
// type-check checkable) — they fail under tsc if the exported signatures drift.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Capsule } from "../../face/capsule.ts";
import { CommandTreeBuilder } from "../../face/projection.ts";
import { RouteRenderer } from "../../face/route-render.ts";
import { Words } from "../../face/words.ts";
import type { RouteTarget } from "../faces.ts";
import type { Round, RoundPhase } from "../ledger.ts";
import type { Route } from "../next.ts";
import {
  type DocClassVerdict,
  FIX_READBACK_SUFFIX,
  NEXT_HOP_REASON,
  type NextHopInput,
  NextStepRouter,
  PIPELINE_NEXT,
  type PipelineEntry,
  type PipelineFaceReport,
  REVIEW_CYCLE_CAP,
  SOFT_CAP_SUGGESTION,
} from "../next.ts";
import type { ExecutionState } from "../state.ts";

/** A minimal execution-state stub — the router reads only readyBatch(). */
const state = (ready: readonly number[]): ExecutionState => ({
  doneTasks: () => new Set(),
  readyBatch: () => [...ready],
});

/** A review finding literal shorthand. */
const finding = (
  severity: "blocker" | "warn" | "nit",
  summary = "",
): {
  severity: "blocker" | "warn" | "nit";
  summary: string;
} => ({ severity, summary });

/** A round carrier shorthand — the mandated fields default; the case overrides. */
const round = (over: { phase: RoundPhase } & Partial<Omit<Round, "phase">>): Round => ({
  findings: [],
  consecutiveS1: 0,
  ...over,
});

const router = new NextStepRouter();

describe("review rounds — zero findings flows the next wave on or closes the run (close)", () => {
  it("zero findings + a ready batch → the next wave (close() — the ready task ids)", () => {
    expect(router.next(state([3]), round({ phase: "review" }))).toEqual({
      kind: "next-wave",
      tasks: "3",
    });
    expect(router.next(state([4, 5]), round({ phase: "review" }))).toEqual({
      kind: "next-wave",
      tasks: "4,5",
    });
  });

  it("zero findings + an exhausted run → done (the v1.20 terminal word, never `none`)", () => {
    expect(router.next(state([]), round({ phase: "review" }))).toEqual({ kind: "done" });
  });

  it("any findings (blocker or warn/nit) → the one-way fix hop carrying the review handoff", () => {
    const findings: Round["findings"] = [finding("warn", "drift")];
    expect(
      router.next(
        state([]),
        round({ phase: "review", findings, reviewsPath: "tasks-7,9-review-1.json" }),
      ),
    ).toEqual({ kind: "fix", reviews: "tasks-7,9-review-1.json" });

    const blockers: Round["findings"] = [finding("blocker", "defect")];
    expect(router.next(state([]), round({ phase: "review", findings: blockers }))).toEqual({
      kind: "fix",
      findings: undefined,
    });
  });
});

describe("fix rounds — the re-review / closure decision point (C5-1, close())", () => {
  it("input blockers remain → a re-review hop (the live tree, no commit identity)", () => {
    expect(
      router.next(state([]), round({ phase: "fix", findings: [finding("blocker", "remaining")] })),
    ).toEqual({ kind: "review" });
  });

  it("warn/nit only → done (closure via close() — the #278 REVIEW_FIX state, no re-review preview)", () => {
    expect(
      router.next(state([]), round({ phase: "fix", findings: [finding("warn"), finding("nit")] })),
    ).toEqual({ kind: "done" });
  });

  it("zero findings → done (close() with an exhausted run)", () => {
    expect(router.next(state([]), round({ phase: "fix" }))).toEqual({ kind: "done" });
  });

  it("a blocker-free fix with a ready batch → next-wave (the close() routing-table row)", () => {
    expect(router.next(state([7]), round({ phase: "fix", findings: [finding("warn")] }))).toEqual({
      kind: "next-wave",
      tasks: "7",
    });
  });

  it("the soft cap outranks the blocker row — a capped run defers to the user", () => {
    expect(
      router.next(
        state([]),
        round({
          phase: "fix",
          findings: [finding("blocker")],
          consecutiveS1: REVIEW_CYCLE_CAP,
        }),
      ),
    ).toEqual({ kind: "soft-cap", message: SOFT_CAP_SUGGESTION });
  });

  it("below the cap, blockers still route the re-review", () => {
    expect(
      router.next(
        state([]),
        round({ phase: "fix", findings: [finding("blocker")], consecutiveS1: 2 }),
      )!.kind,
    ).toBe("review");
  });
});

describe("implement / branch-review — the lifecycle rows", () => {
  it("implement completes → the group's review (the live tree)", () => {
    expect(router.next(state([]), round({ phase: "implement" }))).toEqual({ kind: "review" });
  });

  it("branch-review zero findings → done (close()); findings → the fix hop", () => {
    expect(router.next(state([]), round({ phase: "branch-review" }))).toEqual({ kind: "done" });
    expect(
      router.next(state([]), round({ phase: "branch-review", findings: [finding("nit")] }))!.kind,
    ).toBe("fix");
  });
});

describe("the failure face — BLOCKED/TIMEOUT produce no next line", () => {
  it("a BLOCKED review round → null", () => {
    expect(router.next(state([]), round({ phase: "review", status: "BLOCKED" }))).toBeNull();
  });
  it("a BLOCKED fix round → null (the fix itself BLOCKED keeps the no-next face)", () => {
    expect(
      router.next(
        state([]),
        round({ phase: "fix", status: "BLOCKED", findings: [finding("blocker")] }),
      ),
    ).toBeNull();
  });
  it("a TIMEOUT round → null", () => {
    expect(router.next(state([]), round({ phase: "implement", status: "TIMEOUT" }))).toBeNull();
  });
});

describe("the pinned surface — Route/soft-cap constants (the brief's type-check checkable)", () => {
  it("the soft-cap constant is the literal 50 and the wording is stable", () => {
    expect(REVIEW_CYCLE_CAP).toBe(50);
    expect(SOFT_CAP_SUGGESTION).toBe("BLOCKED: review-cycle-cap — user adjudicates");
  });

  it("the fix-route readback suffix is the declared single-source wording", () => {
    expect(FIX_READBACK_SUFFIX).toBe(
      "(confirm the reviews handoff · if a finding needs a ruling, record the ruling in the handoff file)",
    );
  });

  it("the readback suffix keeps its literal type at compile time", () => {
    // Compile-time pin — fails under `tsc --noEmit` if the constant's declared type
    // drifts from the render the capsule appends verbatim (exact suffix wording).
    const suffix: "(confirm the reviews handoff · if a finding needs a ruling, record the ruling in the handoff file)" =
      FIX_READBACK_SUFFIX;
    expect(suffix).toBe(FIX_READBACK_SUFFIX);
  });

  it("the soft-cap constants keep their literal types at compile time", () => {
    // Compile-time pins — this file fails under `tsc --noEmit` if either constant's
    // declared type drifts from the decision table's domain (cap == 50, verbatim wording).
    const cap: 50 = REVIEW_CYCLE_CAP;
    const wording: "BLOCKED: review-cycle-cap — user adjudicates" = SOFT_CAP_SUGGESTION;
    expect({ cap, wording }).toEqual({
      cap: 50,
      wording: "BLOCKED: review-cycle-cap — user adjudicates",
    });
  });

  it("the router is the single next-generation face — the exported signature is pinned", () => {
    const surface: (state: ExecutionState, ref: Round) => Route | null = (s, r) =>
      router.next(s, r);
    expect(surface(state([]), round({ phase: "review" }))).toEqual({ kind: "done" });
  });

  it("the close() routing table — every closure point renders done | next-wave, never `none`", () => {
    // review approved → exhausted done / ready next-wave
    expect(router.next(state([]), round({ phase: "review" }))).toEqual({ kind: "done" });
    expect(router.next(state([2]), round({ phase: "review" }))).toEqual({
      kind: "next-wave",
      tasks: "2",
    });
    // fix clean (warn/nit) → done / next-wave — the fix closure is a close(), never `none`
    expect(router.next(state([]), round({ phase: "fix", findings: [finding("nit")] }))).toEqual({
      kind: "done",
    });
    expect(router.next(state([2]), round({ phase: "fix", findings: [finding("warn")] }))).toEqual({
      kind: "next-wave",
      tasks: "2",
    });
    // branch-review clean → done
    expect(router.next(state([]), round({ phase: "branch-review" }))).toEqual({ kind: "done" });
  });
});

describe("the severity-combination space — every blocker/warn/nit MIX rides the same three-type routing (v1.29)", () => {
  // The full 2^3 severity mix space (empty through all-three) — the C5 table judges
  // severity only by the blocker/non-blocker axis: a review with ANY findings (any
  // mix) routes the one-way fix hop; a fix with ANY blocker in its input re-reviews;
  // a blocker-free fix (warn/nit in any mix) closes (next-wave when another wave is
  // ready, done when the run is exhausted).
  const MIXES: readonly (readonly ("blocker" | "warn" | "nit")[])[] = [
    [],
    ["warn"],
    ["nit"],
    ["warn", "nit"],
    ["blocker"],
    ["blocker", "warn"],
    ["blocker", "nit"],
    ["blocker", "warn", "nit"],
  ];

  it.each(MIXES.map((mix) => [mix]))(
    "review findings %j — any mix routes fix (or close when empty)",
    (mix) => {
      const findings = mix.map((severity) => finding(severity));
      const route = router.next(state([3]), round({ phase: "review", findings }));
      if (mix.length === 0) {
        expect(route).toEqual({ kind: "next-wave", tasks: "3" });
        expect(router.next(state([]), round({ phase: "review", findings }))).toEqual({
          kind: "done",
        });
      } else {
        expect(route!.kind).toBe("fix"); // the one-way hop holding the review handoff
      }
    },
  );

  it.each(MIXES.map((mix) => [mix]))(
    "fix findings %j — blocker-any mix re-reviews; warn/nit-only closes",
    (mix) => {
      const findings = mix.map((severity) => finding(severity));
      const fix = round({ phase: "fix", findings });
      if (mix.includes("blocker")) {
        expect(router.next(state([3]), fix)).toEqual({ kind: "review" });
      } else {
        expect(router.next(state([3]), fix)).toEqual({ kind: "next-wave", tasks: "3" });
        expect(router.next(state([]), fix)).toEqual({ kind: "done" });
      }
    },
  );

  it.each(MIXES.filter((mix) => mix.includes("warn") && mix.includes("nit")).map((mix) => [mix]))(
    "a re-review round carrying %j rides the SAME review table — the re-review has no severity exemption",
    (mix) => {
      const findings = mix.map((severity) => finding(severity));
      // re-review = a review round at a new ref — the C5 table applies verbatim
      const route = router.next(state([3]), round({ phase: "review", findings }));
      expect(route!.kind).toBe("fix");
    },
  );
});

// ---------------------------------------------------------------------------
// P4.1 T4 — the route → literal → second-parse roundtrip: every router-route the C5
// table can emit renders a next literal whose argv parses with zero errors (the
// executable command reversal) · done is the bare terminal word, never fed.
// ---------------------------------------------------------------------------

describe("P4.1 T4 — the router's routes render parseable next literals (zero-error second parse)", () => {
  /** The next text of a route rendered against a wave-frame target (the task face —
   *  the C5 table's real consumer), then the parseable argv (the readback suffix is
   *  prompt prose, never argv). */
  function argvOf(route: Route): string[] {
    const lines = new Capsule(new Words()).emit("APPROVED", "0", "/h.json", route, {
      type: "wave",
      id: "1,2",
      plan: "docs/kairos/plans/p3.md",
    });
    const literal = lines[1]!.slice("next: ".length);
    return literal
      .replace(new RegExp(`\\s*\\(${FIX_READBACK_SUFFIX.slice(1, -1)}\\)$`), "")
      .split(/\s+/);
  }

  it.each([
    ["implement wave", { kind: "next-wave", tasks: "1,2" } as Route],
    ["re-review", { kind: "review" } as Route],
    ["the one-way fix hop", { kind: "fix", reviews: "tasks-1-review-1.json" } as Route],
    ["closure", { kind: "done" } as Route],
  ] as const)("%s — the route's literal argv parses", (_label, route) => {
    if (route.kind === "done") {
      // the bare terminal word: never fed to parse (a bare `done` is not a command)
      expect(() => new CommandTreeBuilder().program.parse(["done"], { from: "user" })).toThrow(
        /unknown command 'done'/,
      );
      return;
    }
    expect(() =>
      new CommandTreeBuilder().program.parse(argvOf(route), { from: "user" }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// D40 — ONE "next step" concept turned single-resolver + face-to-face handoff.
// ---------------------------------------------------------------------------

describe("D40 — the face-to-face handoff route + the single resolver", () => {
  it("handoff() carries the pipeline entry for a doc-class — the ONE route kind", () => {
    expect(NextStepRouter.handoff("phase-spec")).toEqual({
      kind: "handoff",
      entry: PIPELINE_NEXT["phase-spec"],
    });
    expect(NextStepRouter.handoff("branch")).toEqual({
      kind: "handoff",
      entry: PIPELINE_NEXT.branch,
    });
  });

  it("resolve() passes an ACTIVE C5 hop through untouched (the line is not drained)", () => {
    // The line's own C5 frontier decides next until it drains — a review/fix/next-wave
    // route is the line's next step, never the face-to-face handoff.
    expect(NextStepRouter.resolve({ kind: "review" }, "phase-spec")).toEqual({ kind: "review" });
    expect(NextStepRouter.resolve({ kind: "next-wave", tasks: "3" }, "wave")).toEqual({
      kind: "next-wave",
      tasks: "3",
    });
  });

  it("resolve() yields the face-to-face handoff when the line's C5 frontier drained (done)", () => {
    expect(NextStepRouter.resolve({ kind: "done" }, "plan")).toEqual({
      kind: "handoff",
      entry: PIPELINE_NEXT.plan,
    });
    // a null C5 route (a not-yet-started frontier) also hands off to the next face.
    expect(NextStepRouter.resolve(null, "branch")).toEqual({
      kind: "handoff",
      entry: PIPELINE_NEXT.branch,
    });
  });

  it("resolve() with no face seam (null doc-class) renders the bare terminal `done`", () => {
    // The overall line / a bare terminal: no pipeline seam carries it — the terminal word.
    expect(NextStepRouter.resolve({ kind: "done" }, null)).toEqual({ kind: "done" });
    expect(NextStepRouter.resolve(null, null)).toEqual({ kind: "done" });
  });
});

// ---------------------------------------------------------------------------
// D40 / D26 — walk(): the ONE face-to-face traversal. The board reports the
// observed faces (keyed), the router decides the next step. This is the D26 guard
// for the board off-by-one: a just-closed spec hands off to the SPEC's exit
// (cdd-plan), never the absent plan's exit (cdd-dev).
// ---------------------------------------------------------------------------

describe("D40/D26 — walk(): the single face-to-face traversal", () => {
  /** A face report with every face unentered/open by default (the caller overrides). */
  const report = (over: Partial<PipelineFaceReport>): PipelineFaceReport => ({
    "phase-spec": { closed: false, active: null, target: null },
    plan: { closed: false, active: null, target: null },
    wave: { closed: false, active: null, target: null },
    branch: { closed: false, active: null, target: null },
    ...over,
  });
  const tSpec = { type: "spec", id: "docs/kairos/specs/p-design.md" } as const;
  const tPlan = {
    type: "plan",
    id: "docs/kairos/plans/p.md",
    plan: "docs/kairos/plans/p.md",
  } as const;

  it("a face with an active C5 hop renders that hop (the in-flight work wins)", () => {
    const next = NextStepRouter.walk(
      report({
        "phase-spec": { closed: true, active: null, target: tSpec },
        plan: { closed: false, active: { kind: "review" }, target: tPlan },
      }),
    );
    expect(next.route).toEqual({ kind: "review" });
    expect(next.target).toEqual(tPlan);
  });

  it("the off-by-one D26 guard — a just-closed spec + an ABSENT plan hands off to the SPEC's exit", () => {
    // The board's frontier is the plan face, but it was never entered (no doc). The
    // retired fork used the frontier LINE's key → plan's exit (cdd-dev). The walk uses
    // the PRECEDING entered face's exit → the spec's (cdd-plan).
    const next = NextStepRouter.walk(
      report({ "phase-spec": { closed: true, active: null, target: tSpec } }),
    );
    expect(next.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT["phase-spec"] });
    expect(next.target).toEqual(tSpec);
  });

  it("a frontier ENTERED but drained (a present doc, no active hop) renders its OWN exit", () => {
    const next = NextStepRouter.walk(
      report({
        "phase-spec": { closed: true, active: null, target: tSpec },
        plan: { closed: false, active: null, target: tPlan },
      }),
    );
    expect(next.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT.plan });
    expect(next.target).toEqual(tPlan);
  });

  it("no preceding entered face → the FIRST face's exit (the pipeline entrance)", () => {
    const next = NextStepRouter.walk(report({}));
    expect(next.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT["phase-spec"] });
  });

  it("every face closed → the LAST entered face's exit (the pipeline terminus)", () => {
    const next = NextStepRouter.walk(
      report({
        "phase-spec": { closed: true, active: null, target: tSpec },
        plan: { closed: true, active: null, target: tPlan },
        wave: { closed: true, active: null, target: { type: "wave", id: "1", plan: tPlan.plan } },
        branch: {
          closed: true,
          active: null,
          target: { type: "branch", id: "branch", plan: tPlan.plan },
        },
      }),
    );
    expect(next.route).toEqual({ kind: "handoff", entry: PIPELINE_NEXT.branch });
  });

  it("every face closed with nothing entered → the bare terminal `done`", () => {
    expect(
      NextStepRouter.walk(
        report({
          "phase-spec": { closed: true, active: null, target: null },
          plan: { closed: true, active: null, target: null },
          wave: { closed: true, active: null, target: null },
          branch: { closed: true, active: null, target: null },
        }),
      ).route,
    ).toEqual({ kind: "done" });
  });
});

// ---------------------------------------------------------------------------
// P21 T3 — resolve(): the target line's open fact (§4.2). The wave line's closure
// only hands off to the branch-review literal when the branch line HAS a
// dispatchable open round; otherwise it lands on the branch face's own station.
// ---------------------------------------------------------------------------

describe("P21 T3 — resolve() with the target line's open fact", () => {
  it("a closed wave line with NO dispatchable branch round lands on the branch station", () => {
    // `kairos:cdd-close` — the branch face's own next station, never the
    // `review --type branch` literal its own gate would refuse.
    for (const active of [{ kind: "done" } as const, null]) {
      expect(NextStepRouter.resolve(active, "wave", false)).toEqual({
        kind: "handoff",
        entry: PIPELINE_NEXT.branch,
      });
    }
  });

  it("a closed wave line WITH a dispatchable branch round keeps the branch-review literal", () => {
    expect(NextStepRouter.resolve({ kind: "done" }, "wave", true)).toEqual({
      kind: "handoff",
      entry: PIPELINE_NEXT.wave,
    });
  });

  it("leaves every other face and the absent-fact call exactly as before", () => {
    expect(NextStepRouter.resolve({ kind: "done" }, "wave")).toEqual({
      kind: "handoff",
      entry: PIPELINE_NEXT.wave,
    });
    expect(NextStepRouter.resolve({ kind: "done" }, "plan", false)).toEqual({
      kind: "handoff",
      entry: PIPELINE_NEXT.plan,
    });
    // an active C5 hop still passes through — the fact only judges a drained line
    expect(NextStepRouter.resolve({ kind: "review" }, "wave", false)).toEqual({ kind: "review" });
  });
});

// ---------------------------------------------------------------------------
// P22 §5.2 — ONE next-hop derivation (`nextHop`) on top of the count table: `hop`
// is read out of the route the table produced, `to` follows the same path for
// `done` / `handoff`, and `reason` names the fact that selected it. The count
// table's own cases above stay untouched (zero judgment change).
// ---------------------------------------------------------------------------

/** The injected doc-class discrimination — the tests name the declared class. */
const docClassOf =
  (verdict: DocClassVerdict) =>
  (_target: RouteTarget): DocClassVerdict =>
    verdict;

const specTarget: RouteTarget = { type: "spec", id: "docs/kairos/specs/p-design.md" };
const waveTarget: RouteTarget = { type: "wave", id: "1,2", plan: "docs/kairos/plans/p.md" };
const branchTarget: RouteTarget = {
  type: "branch",
  id: "branch",
  plan: "docs/kairos/plans/p.md",
};

/** A next-hop input with the phase-spec closure defaults; each case overrides one. */
const hopInput = (over: Partial<NextHopInput> = {}): NextHopInput => ({
  face: "phase-spec",
  target: specTarget,
  gate: { drift: false, open: false },
  latestCompleted: null,
  route: { kind: "done" },
  counters: { consecutiveS1: 0 },
  docClassOf: docClassOf("phase-spec"),
  ...over,
});

describe("P22 §5.2 — hopOf(route, face): the ONE constant mapping, six values", () => {
  it("maps every Route kind, reading the face for the review hop", () => {
    expect(router.hopOf({ kind: "next-wave", tasks: "1,2" }, "wave")).toBe("implement");
    expect(router.hopOf({ kind: "review" }, "phase-spec")).toBe("review");
    expect(router.hopOf({ kind: "review" }, "wave")).toBe("review");
    expect(router.hopOf({ kind: "review" }, "plan")).toBe("review");
    // the branch face's re-review is the branch-review skill — the face IS an input
    expect(router.hopOf({ kind: "review" }, "branch")).toBe("branch-review");
    expect(router.hopOf({ kind: "fix", reviews: "tasks-1-review-1.json" }, "wave")).toBe("fix");
    expect(router.hopOf({ kind: "soft-cap", message: SOFT_CAP_SUGGESTION }, "wave")).toBeNull();
    expect(router.hopOf({ kind: "done" }, "wave")).toBeNull();
    expect(router.hopOf({ kind: "handoff", entry: PIPELINE_NEXT.plan }, "plan")).toBeNull();
  });
});

describe("P22 §5.2 — nextHop: the count table's route read out as a hop", () => {
  it("(a) a review leaving a blocker → the fix hop, the route as the render payload", () => {
    const route = router.next(
      state([]),
      round({ phase: "review", findings: [finding("blocker", "defect")] }),
    );
    expect(route).toEqual({ kind: "fix", reviews: undefined });
    const hop = router.nextHop(
      hopInput({ route, face: "wave", target: waveTarget, docClassOf: docClassOf("wave") }),
    );
    expect(hop.hop).toBe("fix");
    expect(hop.route).toEqual({ kind: "fix", reviews: undefined });
    expect(hop.reason).toBe(NEXT_HOP_REASON.pendingFix);
    expect(hop.to).toBeNull();
  });

  it("(b) a clean review with a ready batch → the implement hop (task-open)", () => {
    const route = router.next(state([3]), round({ phase: "review" }));
    const hop = router.nextHop(
      hopInput({ route, face: "wave", target: waveTarget, docClassOf: docClassOf("wave") }),
    );
    expect(hop.hop).toBe("implement");
    expect(hop.reason).toBe(NEXT_HOP_REASON.taskOpen);
    // the payload carries the ready batch — the renderer never re-derives `--tasks`
    expect(hop.route).toEqual({ kind: "next-wave", tasks: "3" });
  });

  it("(c) a drift-reopened closed line → the review hop (doc-drift), branch-review on the branch face", () => {
    const hop = router.nextHop(
      hopInput({ route: { kind: "review" }, gate: { drift: true, open: true } }),
    );
    expect(hop.hop).toBe("review");
    expect(hop.reason).toBe(NEXT_HOP_REASON.docDrift);
    const branch = router.nextHop(
      hopInput({
        face: "branch",
        target: branchTarget,
        route: { kind: "review" },
        gate: { drift: true, open: true },
        docClassOf: docClassOf("branch"),
      }),
    );
    expect(branch.hop).toBe("branch-review");
    expect(branch.reason).toBe(NEXT_HOP_REASON.docDrift);
  });

  it("(d) a done line → no hop, `to` judged from the ONE target cell", () => {
    const spec = router.nextHop(hopInput());
    expect(spec.hop).toBeNull();
    expect(spec.reason).toBe(NEXT_HOP_REASON.closedLine);
    expect(spec.to).toEqual(PIPELINE_NEXT["phase-spec"]);

    const overall = router.nextHop(hopInput({ docClassOf: docClassOf("overall") }));
    expect(overall.to).toEqual({ kind: "done" });
    expect(overall.reason).toBe(NEXT_HOP_REASON.closedLine);

    // a single-spec declares no pipeline seam — the terminal row (`to: null`)
    const single = router.nextHop(hopInput({ docClassOf: docClassOf("terminal") }));
    expect(single.hop).toBeNull();
    expect(single.to).toBeNull();
    expect(single.reason).toBe(NEXT_HOP_REASON.faceClosed);
  });

  it("(e) the soft cap → no hop, no station, the soft-cap reason", () => {
    const hop = router.nextHop(
      hopInput({ route: { kind: "soft-cap", message: SOFT_CAP_SUGGESTION } }),
    );
    expect(hop.hop).toBeNull();
    expect(hop.to).toBeNull();
    expect(hop.reason).toBe(NEXT_HOP_REASON.softCap);
  });

  it("(f) an unjudgeable doc class → doc-class-blocked, no hop, no station", () => {
    const hop = router.nextHop(hopInput({ docClassOf: docClassOf("blocked") }));
    expect(hop.hop).toBeNull();
    expect(hop.to).toBeNull();
    expect(hop.reason).toBe(NEXT_HOP_REASON.docClassBlocked);
  });

  it("(g) a fix whose source review kept a blocker → the re-review hop (fix-K → review-K)", () => {
    const route = router.next(state([]), round({ phase: "fix", findings: [finding("blocker")] }));
    const hop = router.nextHop(
      hopInput({ route, face: "wave", target: waveTarget, docClassOf: docClassOf("wave") }),
    );
    expect(hop.hop).toBe("review");
    expect(hop.route).toEqual({ kind: "review" });
  });

  it("(h) a blocker-free fix → the closure / next hop, never a re-review preview", () => {
    const closed = router.nextHop(
      hopInput({ route: router.next(state([]), round({ phase: "fix" })) }),
    );
    expect(closed.hop).toBeNull();
    expect(closed.reason).toBe(NEXT_HOP_REASON.closedLine);

    const ready = router.nextHop(
      hopInput({
        route: router.next(state([7]), round({ phase: "fix", findings: [finding("warn")] })),
        face: "wave",
        target: waveTarget,
        docClassOf: docClassOf("wave"),
      }),
    );
    expect(ready.hop).toBe("implement");
    expect(ready.hop).not.toBe("review");
  });

  it("(i) a terminal doc class / no target → no hop, no station, face-closed", () => {
    const terminal = router.nextHop(hopInput({ docClassOf: docClassOf("terminal") }));
    expect([terminal.hop, terminal.to, terminal.reason]).toEqual([
      null,
      null,
      NEXT_HOP_REASON.faceClosed,
    ]);
    const bare = router.nextHop(hopInput({ route: null, target: null }));
    expect([bare.hop, bare.to, bare.reason]).toEqual([null, null, NEXT_HOP_REASON.faceClosed]);
    // the failure face holds no route at all — the object still renders honestly
    expect(bare.route).toBeNull();
  });

  it("a handoff route carries its own entry (the same `to` path as done)", () => {
    const hop = router.nextHop(
      hopInput({ route: { kind: "handoff", entry: PIPELINE_NEXT.plan }, face: "plan" }),
    );
    expect(hop.hop).toBeNull();
    expect(hop.to).toEqual(PIPELINE_NEXT.plan);
    expect(hop.reason).toBe(NEXT_HOP_REASON.closedLine);
  });
});

describe("P22 §5.2 — the ONE message shape (three forms)", () => {
  /** The station renderer the CLI passes — the shared route renderer's entry face. */
  const station = (entry: PipelineEntry): string =>
    new RouteRenderer(new Words()).render({ kind: "handoff", entry }, specTarget);

  it("a hop names the verb", () => {
    const hop = router.nextHop(hopInput({ route: { kind: "review" } }));
    expect(router.message(hop, station)).toBe("task-open · the next round is review");
  });

  it("a closed face names its handoff station", () => {
    const hop = router.nextHop(hopInput());
    expect(router.message(hop, station)).toBe(
      "closed-line · next: route to /kairos:cdd-plan skill",
    );
  });

  it("neither a hop nor a station renders the bare reason (no invented verb slot)", () => {
    const blocked = router.nextHop(hopInput({ docClassOf: docClassOf("blocked") }));
    expect(router.message(blocked, station)).toBe("doc-class-blocked");
    const capped = router.nextHop(
      hopInput({ route: { kind: "soft-cap", message: SOFT_CAP_SUGGESTION } }),
    );
    expect(router.message(capped, station)).toBe("soft-cap");
  });
});

// ---------------------------------------------------------------------------
// P22 §5.2 — the structural pins: the derivation holds no second judgment and the
// session plane never imports a face class (the doc class is INJECTED).
// ---------------------------------------------------------------------------

describe("P22 §5.2 — the derivation's structural pins", () => {
  const source = readFileSync(new URL("../next.ts", import.meta.url), "utf8");

  it("session/next.ts never imports the board-view face — no runtime cycle", () => {
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.some((specifier) => specifier?.includes("board-view"))).toBe(false);
    // the doc class arrives ONLY through the injected seam — never a local import
    expect(source).toContain("input.docClassOf(input.target)");
  });

  it("PIPELINE_NEXT is data only — the declaration carries no judgment", () => {
    const start = source.indexOf("export const PIPELINE_NEXT");
    const end = source.indexOf("The pipeline's phase-level face keys");
    const declaration = source.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(declaration).toContain('"phase-spec"');
    expect(declaration).not.toMatch(/\bif \(|\bswitch\b|=>/);
  });
});
