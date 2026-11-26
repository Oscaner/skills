// packages/cdd-engine/src/run/advance/lifecycle.ts
// One dispatch step: frontier → gate → dispatch → read-back → bookkeeping → next routing.
//
// INVARIANT — one `advance` call is ONE step of ONE dispatch: it consumes at most one
// attempt, books at most one round, and advances the frontier by at most one cell. The
// target type's difference never appears here as a branch — it is the `target-faces` row the
// step reads.
//
// Three anchor points this file owns, and no other caller may move them:
//
//   · THE SETTLE POINT. `PreFlight#settle` is called exactly once per step, AFTER `vet`
//     returns and BEFORE the takeover authorization is consulted. The order is the whole
//     point: a dispatch that cleared the structural leg has invalidated every structural
//     refusal the tree was carrying (the facts the record stated no longer hold), so the
//     approved dispatch clears the door's fact and a refused one lands the record its own
//     verdict carries. Moving the settle after the authorization would let a `tree-clean`
//     record outlive its fact through a dispatch that never refused on the structural leg.
//     `previewOf` never comes here — a preview calls `vet` and stops, which is why
//     `--dry-run` writes nothing.
//
//   · THE BRIEF LANDS BEFORE THE DISPATCH, ONCE. The rendered brief's bytes reach the
//     dispatch's workspace through the injected write face, and the returned repository
//     coordinate is what `INPUT_WAVE_BRIEF` prints. A failed write is the SAME shape as a
//     failed skeleton landing: no child starts, no cycle and no attempt moves, and the
//     declared value goes back untouched (its bytes belong to the render face).
//
//   · THE CARRIER READ-BACK IS CHECKED. The round's findings and work status arrive through
//     the dispatch segment's checked read (a digest mismatch throws there), so a tampered
//     carrier is never judged as if the round had produced those bytes.
//
// Failure values are declared and nothing here spells a sentence: a refusal is the gate's
// verdict, a hold is the in-flight record's state, and a usage is the frame's own union.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import { regradeNote } from "../../docs/judging/criteria.ts";
import type { Finding } from "../../docs/judging/invariants.ts";
import type { WriteOutcome } from "../../env/workspace/workspace.ts";
import type { Child, DispatchFrame } from "../dispatch/child.ts";
import { Handoff, type RoundFinding } from "../dispatch/handoff.ts";
import type { InFlight, InFlightState } from "../dispatch/inflight.ts";
import type { Authority } from "../gate/authority.ts";
import type {
  CheckedRow,
  PreFlight,
  PreFlightContext,
  PreFlightVerdict,
} from "../gate/preflight.ts";
import type { RoundRecord, RoundRecordInit, RoundViolation } from "../ledger/ledger.ts";
import type { FrameFacts, UsageReason } from "./frame.ts";
import type { CarriedFacts } from "./line-phase.ts";
import { NextRoutes, type RoundFacts, type Route } from "./next.ts";

/** The dispatch's own result, as the step reports it — the child's exit, the log's
 *  coordinate and how the round ended. */
export interface StepResult {
  /** The child's exit code; null when it never spawned. */
  readonly code: number | null;
  /** The round log's repository coordinate. */
  readonly log: string;
  /** The termination cause, or null when the round ended by itself. */
  readonly termination: string | null;
  /** The brief's landed repository coordinate — the value `INPUT_WAVE_BRIEF` prints. */
  readonly brief: string;
  /** The round this step booked. */
  readonly round: RoundRecord;
  /** The route the booked round selects. */
  readonly route: Route | null;
}

/** The capsule's summary facts — the ONE regrade note a judge round contributes. An absent
 *  `summary` means the cell is not rendered at all (zero empty slot, zero shifted slot). */
export interface CapsuleFacts {
  /** The composed note (`docs/judging/criteria.ts#regradeNote`'s own value). */
  readonly summary?: string;
}

/** One step's answer — the closed set the facade hands the shell. */
export type AdvanceOutcome =
  | {
      readonly kind: "dispatch";
      readonly result: StepResult;
      readonly capsule: CapsuleFacts;
      readonly checked: readonly CheckedRow[];
    }
  /** The structural leg or the wave gate refused before the dispatch. */
  | {
      readonly kind: "blocked";
      readonly verdict: PreFlightVerdict;
      readonly checked: readonly CheckedRow[];
    }
  /** The in-flight gate holds the tree — the record's own state value rides along. */
  | {
      readonly kind: "held";
      readonly state: InFlightState;
      readonly checked: readonly CheckedRow[];
    }
  | { readonly kind: "usage"; readonly reason: UsageReason }
  | { readonly kind: "read-failure"; readonly target: string }
  | { readonly kind: "write-failure"; readonly target: string };

/** The brief landing: the workspace-relative name and the bytes the injected renderer
 *  produced (one render, zero second spelling of the name here). */
export interface BriefLanding {
  readonly name: string;
  readonly content: string;
}

/** The lifecycle's write face over the fact layer — the events one step lands, each through
 *  the ledger's ONE writer. */
export interface LifecycleLedger {
  recordRound(line: string, init: RoundRecordInit): RoundRecord;
  closeWave(line: string, planTasks: readonly number[]): void;
  recordDocReview(line: string, content: string): void;
}

/** The step's reads and side-effect seams — every one of them is a fact the composition root
 *  wires from `env/`, `docs/` or `surface/`, so this file assembles nothing itself. */
export interface LifecycleReads {
  /** The gate context of this dispatch (the plan graph, the ledger fact bundle, the document
   *  target and the four station rows). */
  readonly preflight: (frame: FrameFacts, holding: InFlightState) => PreFlightContext;
  /** The child's frame — the argv, the environment and the log's coordinate. */
  readonly dispatchFrame: (frame: FrameFacts, briefPath: string) => DispatchFrame;
  /** The brief's name and bytes. */
  readonly brief: (frame: FrameFacts) => BriefLanding;
  /** The workspace's text write face (workspace basis). */
  readonly writeText: (name: string, content: string) => WriteOutcome;
  /** The checked carrier read of the round this frame dispatched. */
  readonly carried: (frame: FrameFacts) => Promise<CarriedFacts>;
  /** The findings of the most recent judged record carrying a non-empty set — the regrade
   *  judgment's reference. */
  readonly priorFindings: (frame: FrameFacts) => readonly RoundFinding[];
  /** The plan's task set, read at the closure point (a wave row's historical snapshot). */
  readonly planTasks: () => readonly number[];
  /** The reviewed document's CURRENT bytes, for the review line's version binding; null when
   *  the frame has no document. */
  readonly docText: (frame: FrameFacts) => string | null;
  /** Whether a stale in-flight record names the round this frame dispatches (the abort
   *  takeover's own factual cell). */
  readonly stale: (frame: FrameFacts, holding: InFlightState) => boolean;
  /** Whether the drifted line asks for a reopen — the takeover's second leg's factual cell. */
  readonly reopenRequested: (frame: FrameFacts) => boolean;
}

/** The construction facts. */
export interface LifecycleOptions {
  readonly gate: PreFlight;
  readonly authority: Authority;
  readonly inflight: InFlight;
  readonly child: Child;
  readonly ledger: LifecycleLedger;
  readonly reads: LifecycleReads;
}

/**
 * Lifecycle — one dispatch step. Invariant: one call consumes at most one attempt, books at
 * most one round and moves the frontier at most one cell (see the file's header).
 */
export class Lifecycle {
  readonly #gate: PreFlight;
  readonly #authority: Authority;
  readonly #inflight: InFlight;
  readonly #child: Child;
  readonly #ledger: LifecycleLedger;
  readonly #reads: LifecycleReads;
  readonly #routes = new NextRoutes();

  constructor(opts: LifecycleOptions) {
    this.#gate = opts.gate;
    this.#authority = opts.authority;
    this.#inflight = opts.inflight;
    this.#child = opts.child;
    this.#ledger = opts.ledger;
    this.#reads = opts.reads;
  }

  /** Run one step of one dispatch. */
  async advance(frame: FrameFacts): Promise<AdvanceOutcome> {
    const holding = await this.#inflight.inspect();
    const verdict = await this.#gate.vet(this.#reads.preflight(frame, holding));
    // THE settle point: after the judgment, before the takeover authorization.
    this.#gate.settle(verdict);
    if (!verdict.ok) return Lifecycle.#refused(verdict, holding);
    // The takeover is the EXPLICIT flag's path, and only its path: without `--recover` the
    // legs are not consulted at all, so an ordinary dispatch is never stopped by the
    // double-gap row (that row is what a takeover request earns when no leg holds).
    if (frame.recover) {
      const authorization = this.#authority.takeover({
        verdict,
        stale: this.#reads.stale(frame, holding),
        reopenRequested: this.#reads.reopenRequested(frame),
      });
      if (authorization.kind === "blocked") {
        return { kind: "blocked", verdict, checked: verdict.checked };
      }
    }
    const landing = await this.#land(frame);
    if (landing.kind === "write-failure") return landing;
    return this.#dispatch(frame, landing, verdict);
  }

  /** Land the brief, or answer its declared failure — the ONE write before the child exists. */
  async #land(frame: FrameFacts): Promise<{ kind: "landed"; path: string } | AdvanceOutcomeFail> {
    const brief = this.#reads.brief(frame);
    const outcome = this.#reads.writeText(brief.name, brief.content);
    if (outcome.kind === "write-failure") {
      return { kind: "write-failure", target: String(outcome.target) };
    }
    return { kind: "landed", path: String(outcome.target) };
  }

  /** Dispatch inside the tree's occupancy, then book and route the round. */
  async #dispatch(
    frame: FrameFacts,
    landing: { kind: "landed"; path: string },
    verdict: PreFlightVerdict,
  ): Promise<AdvanceOutcome> {
    const record = await this.#inflight.recordOf({
      pid: process.pid,
      command: frame.command,
      slug: frame.slug,
      wave: frame.type === "wave" ? frame.tasks.join(",") : null,
      phase: frame.phase,
      cycle: frame.round,
      attempt: frame.attempt,
      plan: frame.planPath,
      dispatchBase: null,
    });
    const occupancy = await this.#inflight.occupy(
      record,
      () => this.#child.dispatch(this.#reads.dispatchFrame(frame, landing.path)),
      {
        ending: (outcome) =>
          outcome.code === 0 && outcome.termination === null ? "normal" : "abnormal",
      },
    );
    if (occupancy.kind === "held") {
      const state = await this.#inflight.inspect();
      return { kind: "held", state, checked: verdict.checked };
    }
    const carried = await this.#reads.carried(frame);
    const booked = this.#book(frame, carried, Lifecycle.#baselineOf(verdict.findings ?? []));
    const capsule = this.#capsuleOf(frame, carried);
    return {
      kind: "dispatch",
      result: {
        code: occupancy.value.code,
        log: String(occupancy.value.log),
        termination: occupancy.value.termination,
        brief: landing.path,
        round: booked.round,
        route: booked.route,
      },
      capsule,
      checked: verdict.checked,
    };
  }

  /** Book the round and its line's derived facts. The route is read AFTER the booking, so a
   *  closing round answers the closure the ledger now records rather than the state before
   *  it. */
  #book(
    frame: FrameFacts,
    carried: CarriedFacts,
    gateFindings: readonly RoundFinding[],
  ): { round: RoundRecord; route: Route | null } {
    const violations = Lifecycle.#violationsOf(carried, gateFindings);
    const round = this.#ledger.recordRound(frame.key, {
      op: Lifecycle.#opOf(frame.phase),
      cycle: frame.round,
      attempt: frame.attempt,
      ...(carried.status === null ? {} : {}),
      violations,
    });
    const route = this.#routes.routeOf(Lifecycle.#roundFactsOf(frame, carried, []));
    if (NextRoutes.routeClosed(route) && frame.type === "wave") {
      this.#ledger.closeWave(frame.key, this.#reads.planTasks());
    }
    if (frame.phase === "review" || frame.phase === "branch-review") {
      const text = frame.doc === null ? null : this.#reads.docText(frame);
      if (frame.doc !== null && text !== null) this.#ledger.recordDocReview(frame.doc, text);
    }
    return { round, route };
  }

  /** The judge round's capsule summary — the ONE composition of the downgrade note. A work
   *  round contributes nothing here; a judge round feeds the two partitions of the carrier's
   *  findings (each read from the dispatch segment's own judgment) to the criterion slice's
   *  `regradeNote`, and an absent note leaves the cell out entirely. */
  #capsuleOf(frame: FrameFacts, carried: CarriedFacts): CapsuleFacts {
    if (frame.phase !== "review" && frame.phase !== "branch-review") return {};
    const current = carried.findings ?? [];
    const prior = this.#reads.priorFindings(frame);
    const owing = Handoff.downgrades(prior, current).length;
    const note = regradeNote(owing, Handoff.regradeReasons(prior, current));
    return note === undefined ? {} : { summary: note };
  }

  /** The APPROVED gate's document findings as round findings — the baseline observation a
   *  round carries. The two severities are different vocabularies (`block` / `warn` versus
   *  `blocker` / `warn` / `nit`), so the fold happens here and nowhere else. */
  static #baselineOf(findings: readonly Finding[]): readonly RoundFinding[] {
    return findings.map((finding) => ({
      severity: finding.severity === "block" ? ("blocker" as const) : ("warn" as const),
      summary: finding.message,
    }));
  }

  /** The round's graded violations: a breaching carrier is the hard one, and every BLOCK
   *  finding the APPROVED gate already reported is a SOFT baseline observation (the round
   *  owns only what it added). A judge round's findings never become violations here — its
   *  conclusion is the carrier's own. */
  static #violationsOf(
    carried: CarriedFacts,
    gateFindings: readonly RoundFinding[],
  ): readonly RoundViolation[] {
    const violations: RoundViolation[] = [];
    for (const finding of gateFindings) {
      violations.push({ grade: "soft", cause: "doc-contract", message: finding.summary ?? "" });
    }
    if (carried.status === "BLOCKED") {
      violations.push({ grade: "hard", cause: "round-blocked", message: "" });
    }
    return violations;
  }

  /** The round facts the count table reads. */
  static #roundFactsOf(
    frame: FrameFacts,
    carried: CarriedFacts,
    readyBatch: readonly number[],
  ): RoundFacts {
    return {
      phase: frame.phase,
      status: carried.status,
      findings: carried.findings,
      consecutiveBlockers: Lifecycle.#blockersOf(carried.findings),
      readyBatch,
    };
  }

  /** The consecutive-blocker run a fix round closes — the soft cap's cell. */
  static #blockersOf(findings: readonly RoundFinding[] | null): number {
    return (findings ?? []).filter((finding) => finding.severity === "blocker").length;
  }

  /** The ledger op one phase word books under. */
  static #opOf(phase: FrameFacts["phase"]): "implement" | "review" | "fix" {
    return phase === "branch-review" ? "review" : phase;
  }

  /** A refused dispatch: the in-flight gate's refusal is a HOLD (the record's own state),
   *  every other row is a BLOCK. Both carry the same read-only `checked` rows — the same
   *  derivation an approved dispatch carries. */
  static #refused(verdict: PreFlightVerdict, holding: InFlightState): AdvanceOutcome {
    if (verdict.gate === "in-flight")
      return { kind: "held", state: holding, checked: verdict.checked };
    return { kind: "blocked", verdict, checked: verdict.checked };
  }
}

/** The landing's failure arm — named so `#land`'s signature says which value it may answer. */
type AdvanceOutcomeFail = { readonly kind: "write-failure"; readonly target: string };
