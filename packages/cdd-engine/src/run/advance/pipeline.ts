// packages/cdd-engine/src/run/advance/pipeline.ts
// The pipeline frontier — the one judge over "which face is in flight", and the ONE hop
// assembly both the capsule and the board read.
//
// INVARIANT — the frontier is the LEDGER's projection, never a second judgment: each face's
// closure, its active hop and its target are read off the line facts (`LinePhase` over the
// ledger's rounds), and the four rules below only ORDER those readings. The plan is never
// read here — a caller's guarded plan read rides in as `graph` — so this file holds zero
// filesystem read and no second plan parse.
//
//   · the FRONTIER face (first not-closed) with an active hop renders that hop (the in-flight
//     work — `review` / `fix` / `implement` / `next-wave`);
//   · the frontier has no active hop but IS entered (a target is present) → its OWN pipeline
//     exit entry;
//   · the frontier is NOT entered (no target — the document is absent, OR the face's own
//     entry predicate never held) → the transition INTO it: the PRECEDING entered face's exit
//     entry (a just-closed specification hands off to the plan command, never an absent
//     plan's development command); none preceding → the FIRST face's exit entry;
//   · every face closed → the LAST entered face's exit entry (the terminus).
//
// Rules 1 / 2 answer the frontier face (the route is that face's own); rules 3 / 4 are
// EXCHANGE rules — the route belongs to the anchor face, so `face` is null and the anchor is
// read back off the target.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import type { TaskGraph } from "../../docs/judging/task-graph.ts";
import { RoundIdentity } from "../ledger/identity.ts";
import type { WaveLine } from "../ledger/ledger.ts";
import type { LinePhase } from "./line-phase.ts";
import {
  type DocClassVerdict,
  type Hop,
  type NextHop,
  NextRoutes,
  type PhaseFaceKey,
  PIPELINE_FACES,
  PIPELINE_NEXT,
  type PipelineEntry,
  type PipelineFaceState,
  type PipelineVerdict,
  type Route,
} from "./next.ts";
import type { RouteTarget, TargetType } from "./target-faces.ts";

/** The frontier's whole input — the line's declared identity plus the caller's guarded plan
 *  read. */
export interface PipelineInput {
  /** The identity line's DECLARED document type (a null declaration reads as `phase-spec`,
   *  the word the line carries when no document declares one). */
  readonly specType: TargetType | null;
  /** The identity document's path; null when the phase holds none. */
  readonly specPath: string | null;
  /** The plan document's path — the plan and branch faces' ONE identity document. */
  readonly planPath: string | null;
  /** The plan's graph, or null when the plan read is not ready (a read failure is the
   *  frame's own declared value, never this segment's). */
  readonly graph: TaskGraph | null;
}

/** The doc-class discrimination the face plane owns — injected, so this segment never reads
 *  a declaration itself. */
export type DocClassRead = (target: RouteTarget) => DocClassVerdict;

/** The pipeline's construction facts: the ONE line walk, the wave rows (the closed-task
 *  projection's input) and the doc-class read. */
export interface PipelineOptions {
  readonly lines: LinePhase;
  readonly waves: () => readonly WaveLine[];
  readonly docClassOf: DocClassRead;
}

/**
 * Pipeline — the pipeline frontier and its hop assembly. Invariant: every face cell is a
 * reading of the line facts and the four rules only order them (see the file's header).
 *
 * Rule zero (over the 200-line class limit): the class stays whole because the four rules
 * order ONE set of per-face readings — splitting the readings from the ordering would let a
 * caller apply the rules to a second, staler set of faces than the one it just read.
 */
export class Pipeline {
  readonly #lines: LinePhase;
  readonly #waves: () => readonly WaveLine[];
  readonly #docClassOf: DocClassRead;
  readonly #routes = new NextRoutes();

  constructor(opts: PipelineOptions) {
    this.#lines = opts.lines;
    this.#waves = opts.waves;
    this.#docClassOf = opts.docClassOf;
  }

  /** The ledger's closed task ids — the projection of the wave lines' closure side, read by
   *  the wave gate and the closed-task face alike (no second cache: every read walks the
   *  ledger again, so changing one fact changes the frontier). */
  closedTasks(): Set<number> {
    const closed = new Set<number>();
    for (const row of this.#waves()) {
      if (!this.#lines.waveClosedAt(RoundIdentity.splitLineWord(row.line).key)) continue;
      for (const id of row.taskIds) closed.add(id);
    }
    return closed;
  }

  /** The next pipeline step — the four face-order rules over the ONE face order. */
  frontierOf(input: PipelineInput): PipelineVerdict {
    const states = PIPELINE_FACES.map((face) => this.#stateOf(face, input));
    const frontierIndex = states.findIndex((state) => !state.closed);
    if (frontierIndex === -1) return Pipeline.#terminal(states);
    const frontierFace = PIPELINE_FACES[frontierIndex] as PhaseFaceKey;
    const frontier = states[frontierIndex] as PipelineFaceState;
    if (frontier.active !== null) {
      return { face: frontierFace, route: frontier.active, target: frontier.target };
    }
    if (frontier.target !== null) {
      return {
        face: frontierFace,
        route: Pipeline.#exitRoute(frontierIndex, frontier),
        target: frontier.target,
      };
    }
    const anchorIndex = Math.max(0, Pipeline.#lastEnteredIndex(states.slice(0, frontierIndex)));
    const anchor = states[anchorIndex] as PipelineFaceState;
    return {
      face: null,
      route: Pipeline.#exitRoute(anchorIndex, anchor),
      target: anchor.target,
    };
  }

  /** The pipeline hop — one frontier verdict, the six cells derived from that verdict's
   *  target (never from a dispatch frame), the ledger's own branch-line fact as the sixth
   *  cell, and the injected doc-class read. Both the capsule and the board call this, so the
   *  two faces are one object by construction. */
  hopOf(input: PipelineInput): NextHop {
    const verdict = this.frontierOf(input);
    const target = verdict.target;
    const gate = {
      docDrift: Pipeline.#docDriftOf(target, this.#lines),
      briefDrift: target?.type === "wave" ? this.#lines.briefDriftedAt(String(target.id)) : false,
    };
    return this.#routes.nextOf({
      target,
      route: Pipeline.#reopenedRoute(verdict.route, gate.docDrift),
      verdict: target === null ? "terminal" : this.#docClassOf(target),
      gate,
      nextLineOpen: this.branchLineOpen(input.planPath),
    });
  }

  /** The route a hop reports, AFTER the drift reopen — a document that moved past the version
   *  its review bound makes an EXIT-side route (a closure, a face-to-face handoff, no route at
   *  all) describe bytes nobody judged, so the hop becomes the review the movement owes. A
   *  still-open hop (review / fix) and the soft-cap adjudication keep their own route: a
   *  pending fix outranks drift. The scope predicate is the ONE `onExitSide`, so this hop and
   *  every other drift-reopen reader agree on where the override stops. */
  static #reopenedRoute(route: Route | null, docDrift: boolean): Route | null {
    return docDrift && NextRoutes.onExitSide(route) ? { kind: "review" } : route;
  }

  /** Whether the wave face still HOLDS a request below it — the face was ENTERED and its
   *  derived waves are not exhausted. The doc faces' movement is the upstream station's
   *  `doc-drift` row; this is the wave face's own sign, read off the SAME two cells the
   *  frontier's closure walks (a dispatch this face already booked counts as entered, and a
   *  batch whose tasks all closed no longer holds anything — a closed face has no round left
   *  to reopen). */
  wavesHoldRequest(input: PipelineInput): boolean {
    const graph = input.graph;
    if (graph === null || !this.#wavesEntered(graph)) return false;
    return !this.#wavesExhausted(graph);
  }

  /** Whether the branch line holds a dispatchable open round — the sixth hop cell's ONE
   *  judge: the branch row's drift-aware reopen or a still-active hop. Undefined when no
   *  plan fact exists. */
  branchLineOpen(planPath: string | null): boolean | undefined {
    if (planPath === null) return undefined;
    if (this.#lines.reopenedAt("branch", "branch", planPath)) return true;
    return this.#lines.routeOf("branch", "branch") !== null;
  }

  /** One face's observed facts — the pivot onto the per-face readings below. */
  #stateOf(face: PhaseFaceKey, input: PipelineInput): PipelineFaceState {
    if (face === "phase-spec") return this.#identityState(input);
    if (face === "plan") return this.#planState(input);
    if (face === "wave") return this.#waveState(input);
    return this.#branchState(input);
  }

  /** The identity face — judged at its identity document, so a spec revision past the one
   *  the clean review bound reopens the face and the frontier holds here. */
  #identityState(input: PipelineInput): PipelineFaceState {
    const type = input.specType ?? "phase-spec";
    return {
      closed: this.#lines.stateOf(type, type, input.specPath) === "closed",
      active: input.specPath === null ? null : this.#lines.routeOf(type, type),
      target: input.specPath === null ? null : { type, id: input.specPath },
    };
  }

  /** The plan face — the plan document is its own identity document, so the closure judge
   *  and the active hop read the SAME path. */
  #planState(input: PipelineInput): PipelineFaceState {
    const planPath = input.planPath;
    return {
      closed: this.#lines.stateOf("plan", "plan", planPath) === "closed",
      active: planPath === null ? null : this.#lines.routeOf("plan", "plan"),
      target: planPath === null ? null : { type: "plan", id: planPath, plan: planPath },
    };
  }

  /** The wave face — exhausted only when the plan yields a batch set and every batch is
   *  done (an empty wave segment closes nothing). BOTH cells are gated on the face-level
   *  ENTRY predicate: `next-wave` answers for a batch that was never dispatched, which is
   *  right for the LINE and must not read as "this face is in flight" — the documented window
   *  is plan-closed + graph present + zero wave rounds, and there the pipeline owes the plan
   *  face's handoff. */
  #waveState(input: PipelineInput): PipelineFaceState {
    const graph = input.graph;
    const waveKey = graph === null ? null : this.#waveKeyOf(graph);
    const entered = graph !== null && this.#wavesEntered(graph);
    return {
      closed: graph !== null && this.#wavesExhausted(graph),
      active: entered && waveKey !== null ? this.#lines.waveRouteOf(waveKey) : null,
      target:
        !entered || input.planPath === null
          ? null
          : { type: "wave", id: waveKey ?? "", plan: input.planPath },
    };
  }

  /** The branch face — judged at its identity document (the plan): a plan revision past the
   *  one the completed branch review bound reopens the face. The branch line is always
   *  present on a live tree, so its target is never null. */
  #branchState(input: PipelineInput): PipelineFaceState {
    const planPath = input.planPath;
    return {
      closed: this.#lines.stateOf("branch", "branch", planPath) === "closed",
      active: this.#lines.routeOf("branch", "branch"),
      target: { type: "branch", id: "branch", ...(planPath === null ? {} : { plan: planPath }) },
    };
  }

  /** The plan's open frontier wave key — the ready batch over the ledger's closure set, the
   *  SAME derivation the wave gate walks. */
  #waveKeyOf(graph: TaskGraph): string | null {
    const frontier = graph.frontier(this.closedTasks());
    return frontier.length === 0 ? null : frontier.join(",");
  }

  /** Whether the wave FACE was ever entered — a face-level predicate over EVERY derived
   *  batch's key (a per-key read would call every batch boundary "never entered" and retreat
   *  to the plan handoff mid-plan). A dispatched but BLOCKED round counts: the face WAS
   *  entered. */
  #wavesEntered(graph: TaskGraph): boolean {
    return graph.batches().some((batch) => this.#lines.waveRecordedAt(batch.join(",")));
  }

  /** Whether every derived wave is done — the wave face's closure cell. */
  #wavesExhausted(graph: TaskGraph): boolean {
    const batches = graph.batches();
    if (batches.length === 0) return false;
    const closed = this.closedTasks();
    return batches.every((batch) => batch.every((id) => closed.has(id)));
  }

  /** Rule 4 — every face closed: the terminus is the LAST entered face's exit; a pipeline
   *  that entered no face at all holds no step. */
  static #terminal(states: readonly PipelineFaceState[]): PipelineVerdict {
    const terminalIndex = Pipeline.#lastEnteredIndex(states);
    if (terminalIndex === -1) return { face: null, route: { kind: "done" }, target: null };
    const terminal = states[terminalIndex] as PipelineFaceState;
    return {
      face: null,
      route: Pipeline.#exitRoute(terminalIndex, terminal),
      target: terminal.target,
    };
  }

  /** The anchor face's OWN pipeline exit — the row its render target declares, read from the
   *  ONE table. A face with no target falls back to its pipeline face's row. */
  static #exitRoute(faceIndex: number, state: PipelineFaceState): Route {
    if (state.target === null) {
      return { kind: "handoff", entry: PIPELINE_NEXT[PIPELINE_FACES[faceIndex] as PhaseFaceKey] };
    }
    const entry: PipelineEntry = PIPELINE_NEXT[state.target.type];
    return { kind: "handoff", entry };
  }

  /** The index of the last OBSERVED face carrying a render target — the last face the
   *  pipeline has REACHED. -1 when none is. */
  static #lastEnteredIndex(states: readonly PipelineFaceState[]): number {
    for (let index = states.length - 1; index >= 0; index -= 1) {
      if ((states[index] as PipelineFaceState).target !== null) return index;
    }
    return -1;
  }

  /** The doc-drift cell of a hop — a doc line's own identity document moved past the version
   *  its review bound (the branch line is judged at the plan, its identity document). Off the
   *  doc faces the cell is false: a wave line's movement is the brief cell's, a separate
   *  fact. */
  static #docDriftOf(target: RouteTarget | null, lines: LinePhase): boolean {
    if (target === null || target.type === "wave") return false;
    if (target.type === "branch") {
      return target.plan === undefined ? false : lines.reopenedAt("branch", "branch", target.plan);
    }
    return lines.reopenedAt(target.type, target.type, target.id);
  }
}

/** The hop a route names on a face — re-exported so a renderer that holds a hop need not
 *  import the count table. */
export type { Hop, NextHop };
