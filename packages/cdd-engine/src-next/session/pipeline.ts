// packages/cdd-engine/src-next/session/pipeline.ts
// The pipeline frontier — the session plane's ONE judge over "which face is in
// flight" (D40 · P22 §5.2). The four face-order rules and the ONE hop derivation
// live HERE, next to the ledger they read; the board face only OBSERVES each face's
// facts and RENDERS the result (`PipelineFrontier.next`'s `{ route, target }`).
//
// P24 §11 — the ASSEMBLY lives here too, beside `next` (`PipelineFrontier#hopOf`):
// one `next(input)` verdict → the six hop cells derived from that verdict's TARGET →
// `Ledger#nextHopOf` → one `NextHop`. The capsule (`session/run.ts`) and the board
// (`face/board-view.ts` `BoardNext`) both call this ONE assembly and each only
// renders the result, so the two faces cannot disagree by construction.
//
// Constructed with the node's `Ledger` (the `Ledger` / `Lifecycle` shape: one read
// face injected, no global state). The plan is never read here — the guarded plan
// read stays on the board side and rides in as `planGraph`, so this module holds
// zero file-system read and no second plan parse.
//
// The four rules over the ONE `PIPELINE_FACES` order:
//   · the FRONTIER face (first not-closed) with an active C5 hop renders that hop
//     (the in-flight work — `review` / `fix` / `implement` / `next-wave`);
//   · the frontier has no active hop but IS entered (a target is present) → its
//     OWN pipeline exit entry;
//   · the frontier is NOT entered (no target — the document is absent, OR the
//     face's own entry predicate never held) → the transition INTO it: the
//     PRECEDING entered face's exit entry (a just-closed spec hands off to
//     `cdd-plan`, never the absent plan's `cdd-dev`); none preceding → the
//     FIRST face's exit entry;
//   · every face closed → the LAST entered face's exit entry (the terminus —
//     `cdd-close` for a phase slug).
// Rules 1 / 2 answer the frontier face (the route is that face's own); rules 3 / 4
// are EXCHANGE rules — the route belongs to the anchor face, so `face` is null and
// the anchor is read back off `target`.
//
// Module-level exports are types / the class — zero behavior-carrying bare functions
// (the plan's zero-bare-function discipline).

import type { RouteTarget, TargetType } from "./faces.ts";
import type { TaskGraph } from "./graph.ts";
import type { Ledger, OpType } from "./ledger.ts";
import {
  type DocClassVerdict,
  type NextHop,
  NextStepRouter,
  type PhaseFaceKey,
  PIPELINE_FACES,
  PIPELINE_NEXT,
  type PipelineFaceState,
  type Route,
} from "./next.ts";

/** The three modes a wave row records — the wave face's entry scan (P25 §6). A wave
 *  row is written by the dispatch rounds only; `branch-review` rides the branch face. */
const WAVE_ROUND_MODES: readonly OpType[] = ["implement", "review", "fix"];

/** The frontier's whole input — the node's declared identity plus the board's
 *  guarded plan read. `planGraph` is INJECTED (the board's `#planGraph`): the
 *  frontier itself reads no file and parses no second plan. */
export interface PipelineFrontierInput {
  /** The spec line's DECLARED word (the front-matter `doc-type:`). A null declaration
   *  reads as the identity face's own key (`phase-spec`), the word the line carries
   *  when no document declares one. */
  readonly specType: TargetType | null;
  /** The spec document path — null when the node holds no spec. */
  readonly specPath: string | null;
  /** The plan document path — the plan and branch faces' ONE identity document. */
  readonly planPath: string | null;
  /** The plan's task graph (the board's ONE guarded plan read) — null when the plan
   *  is absent or unreadable. */
  readonly planGraph: TaskGraph | null;
}

/** The frontier's verdict — the route, the render target the literal needs, and the
 *  face the ROUTE belongs to: the frontier face under rules 1 / 2, null under the two
 *  exchange rules (3 / 4), where the anchor face is read back off `target`. */
export interface PipelineFrontierVerdict {
  face: PhaseFaceKey | null;
  route: Route;
  target: RouteTarget | null;
}

/** The assembly's ONE injected port — the pipeline-station discrimination the face
 *  plane owns (the declaration read, `BoardView.docClassOf`). The session plane never
 *  imports a face class, so the composition root passes it in. */
export interface PipelineFrontierPorts {
  readonly docClassOf: (target: RouteTarget) => DocClassVerdict;
}

export class PipelineFrontier {
  /** The node's ledger — the ONE round/closure read face the per-face facts come
   *  from (no second closure or drift judge lives in this module). */
  readonly #ledger: Ledger;

  constructor(ledger: Ledger) {
    this.#ledger = ledger;
  }

  /** The next pipeline step — the four face-order rules over the ONE
   *  `PIPELINE_FACES` order (imported, never re-declared here). */
  next(input: PipelineFrontierInput): PipelineFrontierVerdict {
    const states = PIPELINE_FACES.map((face) => this.#stateOf(face, input));
    const frontierIndex = states.findIndex((state) => !state.closed);
    if (frontierIndex === -1) return PipelineFrontier.#terminal(states);
    const frontierFace = PIPELINE_FACES[frontierIndex]!;
    const frontier = states[frontierIndex]!;
    if (frontier.active !== null)
      return { face: frontierFace, route: frontier.active, target: frontier.target };
    if (frontier.target !== null)
      return {
        face: frontierFace,
        route: PipelineFrontier.#exitRoute(frontierIndex, frontier),
        target: frontier.target,
      };
    const anchorIndex = Math.max(
      0,
      PipelineFrontier.#lastEnteredIndex(states.slice(0, frontierIndex)),
    );
    const anchor = states[anchorIndex]!;
    return {
      face: null,
      route: PipelineFrontier.#exitRoute(anchorIndex, anchor),
      target: anchor.target,
    };
  }

  /** The pipeline hop — the session plane's ONE assembly: one `next(input)` verdict,
   *  the six hop cells derived from that verdict's TARGET (never from a dispatch
   *  frame), the ledger's own branch-line fact as the sixth cell, and the injected
   *  station discrimination, handed to the ONE derivation (`Ledger#nextHopOf`).
   *  `face/board-view.ts` and `session/run.ts` BOTH call this and only render the
   *  result, so the board's `next:` and the capsule's `next:` are one object by
   *  construction. */
  hopOf(input: PipelineFrontierInput, ports: PipelineFrontierPorts): NextHop {
    const verdict = this.next(input);
    const target = verdict.target;
    return this.#ledger.nextHopOf({
      type: target?.type ?? "branch",
      key: target?.type === "wave" ? target.id : (target?.type ?? "branch"),
      route: verdict.route,
      target,
      doc: PipelineFrontier.#docOf(target),
      // The wave half is gated on the target TYPE: off the wave face `target.id` is a
      // document path, never a wave key. The cell can only reach a `reason:` row.
      briefDrift:
        target?.type === "wave" ? this.#ledger.briefDrifted(String(target.id)) : undefined,
      // The sixth cell — the ledger's OWN branch-line fact, read by ONE judge here and
      // by the line frontier's `Lifecycle#branchLineOpen` (a delegation).
      nextLineOpen: this.branchLineOpen(input.planPath),
      docClassOf: ports.docClassOf,
    });
  }

  /** Whether the branch line has a dispatchable open round — the SIXTH hop cell's ONE
   *  judge (P21 §4.2): the branch row's drift-aware gate (the plan moved past its
   *  reviewed revision) or a still-active C5 hop. `undefined` when no plan fact
   *  exists. Both hop assemblies read this one copy. */
  branchLineOpen(planPath: string | null): boolean | undefined {
    if (planPath === null) return undefined;
    if (this.#ledger.reviewGate("branch", planPath, "branch").kind === "open") return true;
    return this.#ledger.lineRoute("branch", "branch") !== null;
  }

  /** The judged document of one render target — the node shapes' own id, a branch
   *  target's plan (its identity document); null for a target-less verdict. */
  static #docOf(target: RouteTarget | null): string | null {
    if (target === null) return null;
    return target.type === "branch" ? (target.plan ?? null) : target.id;
  }

  /** Rule 4 — every face closed: the terminus is the LAST entered face's exit; a
   *  pipeline that entered no face at all holds no step (`done`). */
  static #terminal(states: readonly PipelineFaceState[]): PipelineFrontierVerdict {
    const terminalIndex = PipelineFrontier.#lastEnteredIndex(states);
    if (terminalIndex === -1) return { face: null, route: { kind: "done" }, target: null };
    const terminal = states[terminalIndex]!;
    return {
      face: null,
      route: PipelineFrontier.#exitRoute(terminalIndex, terminal),
      target: terminal.target,
    };
  }

  /** One face's observed facts — the pivot onto the per-face judges below. */
  #stateOf(face: PhaseFaceKey, input: PipelineFrontierInput): PipelineFaceState {
    if (face === "phase-spec") return this.#identityState(input);
    if (face === "plan") return this.#planState(input);
    if (face === "wave") return this.#waveState(input);
    return this.#branchState(input);
  }

  /** The identity face's closure is judged AT its identity document: a spec revision
   *  past the one the clean review bound reopens the face, so the frontier holds here
   *  (the SAME drift-aware judge the branch face reads) instead of walking on to a
   *  plan command the dispatch would reject. */
  #identityState(input: PipelineFrontierInput): PipelineFaceState {
    const type = input.specType ?? "phase-spec";
    return {
      closed: this.#ledger.lineStateAt(type, type, input.specPath) === "closed",
      active: input.specPath === null ? null : this.#ledger.lineRoute(type, type),
      target: input.specPath === null ? null : { type, id: input.specPath },
    };
  }

  /** The plan face — the plan document is its own identity document, so the closure
   *  judge and the active hop read the SAME path. */
  #planState(input: PipelineFrontierInput): PipelineFaceState {
    const planPath = input.planPath;
    return {
      closed: this.#ledger.lineStateAt("plan", "plan", planPath) === "closed",
      active: planPath === null ? null : this.#ledger.lineRoute("plan", "plan"),
      target: planPath === null ? null : { type: "plan", id: planPath, plan: planPath },
    };
  }

  /** The wave face — exhausted (skipped) only when the plan yields a wave set and
   *  every wave is done: an empty wave segment (a plan with no task block) closes
   *  nothing, so it is not an exhausted face. The active hop reads the READY batch's
   *  wave key (`TaskGraph#frontier`, never a local walk) through the ledger's ONE wave
   *  route.
   *
   *  P25 §6 — the face-level ENTRY predicate. `waveLineRoute` answers `next-wave` for
   *  a batch that was never dispatched, which is right for the LINE but must not read
   *  as "this face is in flight": the documented window is plan-closed + graph present
   *  + zero wave rounds, and there the pipeline owes the plan face's `cdd-dev`
   *  handoff. A plan with no task block holds no batch at all, so it is the same
   *  never-entered case. BOTH cells are gated on the SAME predicate — clearing `active`
   *  alone would fall into rule 2 and render the wave face's own exit
   *  (`PIPELINE_NEXT.wave`), a worse literal than the one being removed. */
  #waveState(input: PipelineFrontierInput): PipelineFaceState {
    const graph = input.planGraph;
    const waveKey = graph === null ? null : this.#waveKeyOf(graph);
    const entered = graph !== null && this.#wavesEntered(graph);
    return {
      closed: graph !== null && this.#wavesExhausted(graph),
      active: entered && waveKey !== null ? this.#ledger.waveLineRoute(waveKey) : null,
      target:
        !entered || input.planPath === null
          ? null
          : { type: "wave", id: waveKey ?? "", plan: input.planPath },
    };
  }

  /** The branch face — judged AT its identity document (the plan): a plan revision
   *  past the one the completed branch review bound reopens the face. The branch line
   *  is always present (a live tree), so its target is never null. */
  #branchState(input: PipelineFrontierInput): PipelineFaceState {
    const planPath = input.planPath;
    return {
      closed: this.#ledger.lineStateAt("branch", "branch", planPath) === "closed",
      active: this.#ledger.lineRoute("branch", "branch"),
      target: { type: "branch", id: "branch", plan: planPath ?? undefined },
    };
  }

  /** The plan's open frontier wave key — the ready batch over the node's
   *  `closedWaves()` set, the SAME derivation the dispatch engine's task-graph
   *  frontier walks (T26, the wave-unitary model). Null when no wave remains open. */
  #waveKeyOf(graph: TaskGraph): string | null {
    const frontier = graph.frontier(this.#ledger.closedWaves());
    return frontier.length === 0 ? null : frontier.join(",");
  }

  /** Whether the wave FACE was ever entered — the face-level predicate (P25 §6), never
   *  a per-key one: `#waveKeyOf` answers the READY batch, whose own row is empty the
   *  moment the previous batch closes, so a per-key read would call every batch
   *  boundary "never entered" and retreat to the plan handoff mid-plan. The scan
   *  therefore walks EVERY derived batch's key (the same `join(",")` spelling as
   *  `#waveKeyOf`) and sums the three dispatch modes' round counts — a dispatched but
   *  BLOCKED round counts, because the face WAS entered. No `identity` argument: a wave
   *  row is keyed by its joined task ids alone (`rowFor` matches `row.wave`). */
  #wavesEntered(graph: TaskGraph): boolean {
    return graph.batches().some((batch) => {
      const key = batch.join(",");
      return WAVE_ROUND_MODES.some((mode) => this.#ledger.roundCount(key, mode) > 0);
    });
  }

  /** Whether the wave FACE was ever entered — the face-level predicate (P25 §6), never
   *  a per-key one (the private scan's own judgment). Public because the dispatch
   *  authority's upstream leg asks the SAME question (P27 §2.3: a face the pipeline
   *  never entered holds no station), and no second entered-scan may exist. */
  wavesEntered(graph: TaskGraph): boolean {
    return this.#wavesEntered(graph);
  }

  /** Whether every derived wave is done — the wave face's closure cell (a plan with
   *  no wave holds nothing closed). Public for the same reason as `wavesEntered`: the
   *  upstream leg's criterion ② reads this ONE judge, never a local task walk. */
  wavesExhausted(graph: TaskGraph): boolean {
    return this.#wavesExhausted(graph);
  }

  /** Whether every derived wave is done — the wave face's closure cell (a plan with
   *  no wave holds nothing closed). */
  #wavesExhausted(graph: TaskGraph): boolean {
    const report = graph.report(this.#ledger.closedWaves());
    const done = new Set(report.done);
    return (
      report.waves.length > 0 && report.waves.every((wave) => wave.every((id) => done.has(id)))
    );
  }

  /** The anchor face's OWN pipeline exit — the row its render TARGET declares
   *  (`PIPELINE_NEXT[target.type]`, the SAME one table the capsule's `done` face reads
   *  through the ONE derivation). The identity face's target type IS the document's
   *  declared word, so a `single-spec` closes onto its `done` row, never the phase-spec
   *  line's `cdd-plan` ref; every node face's target type is its face key, so the lookup
   *  is the face key there. A face with no target (never entered) falls back to its
   *  pipeline face's row. */
  static #exitRoute(faceIndex: number, state: PipelineFaceState): Route {
    if (state.target === null) return NextStepRouter.handoff(PIPELINE_FACES[faceIndex]!);
    return { kind: "handoff", entry: PIPELINE_NEXT[state.target.type] };
  }

  /** The index of the last OBSERVED face carrying a render target — the last face the
   *  pipeline has REACHED. A face carries no target when its document is absent OR its
   *  own entry predicate never held; either way it was never entered. -1 when none is. */
  static #lastEnteredIndex(states: readonly PipelineFaceState[]): number {
    for (let i = states.length - 1; i >= 0; i--) {
      if (states[i]!.target !== null) return i;
    }
    return -1;
  }
}
