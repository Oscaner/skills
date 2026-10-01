// packages/cdd-engine/src/rules/result-face.ts — ResultFace (C5 command-contract plane, T3): the
// ALL-OP single stdout result face (design §2.9 + spec D1-D3). One capsule line — the capsule the
// orchestrator can grep / route on without opening the handoff file — per op:
//
//   status: <axis status> · blocker: <blocker-count> · handoff: <handoff-path>   [+ optional
//   next: <suggestion>]
//
// Lives in the rules layer (not cli/) so the dispatch layer consumes it too (dispatch → cli imports
// are forbidden — zero upward cli imports); cli/review.ts + cli/fix.ts + the dispatch faces share
// this one face.
// Op axes (C5 D1-D3 command-contract dual axes):
//   review     — judgment axis (CHANGES_REQUESTED / REVIEW_FIX / APPROVED, engine-derived via
//                StatusDeriver#deriveReviewStatus; BLOCKED/TIMEOUT failure conclusions pass through
//                verbatim). `blocker:` = the review's OWN findings' blocker count (canonical
//                Convergence single source — rules/convergence.ts#blockerCount, never a duplicate
//                count).
//   implement/ — work axis (COMPLETED / BLOCKED via StatusDeriver#workStatus). `blocker:` = the
//   fix          decision-source count: fix → the `--findings` INPUT review's blocker count (the
//                caller passes the input findings — never the fix's own carrier); implement → 0
//                (no decision source, spec D2).
//
// The `next:` line rides the capsule — the C5 5th engine line appended via the injected
// NextStepRouter (nullable → no line: the BLOCKED/failure lanes emission, zero leaks).
//
// T3: replaces the former docsResultFace bare function + the task-family 4-line return block
// (status/commits/artifacts + counters) — commits/artifacts/counters stay in the handoff /
// progress.json, stdout shows only the status capsule. Constructor injection (Criterion ②): the
// status derive + next router + convergence judge are all injected, zero module-level singletons.
import { ConvergenceChecker, type HandoffLike } from "../rules/convergence.ts";
import { type NextStepArgs, NextStepRouter } from "../rules/next-step.ts";
import { StatusDeriver } from "../rules/status-deriver.ts";

/** The emit input — dispatch facts only (the capsule never re-reads the handoff; BLOCKED/TIMEOUT
 *  conclusions and the judgment source findings are passed by the caller). */
export interface ResultFaceEmitCtx {
  /** dispatch op — the capsule's axis selector. */
  op: "implement" | "review" | "fix";
  /** the local handoff carrier path the capsule points at. */
  handoffPath: string;
  /** the round's conclusion status (finalized/declared). review — the engine-derived status;
   *  implement/fix — the agent/engine declared conclusion (BLOCKED → the work axis). */
  status?: string;
  /** the judgment source: review — this round's own findings; fix — the `--findings` INPUT
   *  findings (the decision source); implement — absent (blocker: 0). */
  findings?: ReadonlyArray<{ severity?: string }>;
  /** the C5 next-hop derivation input (NextStepRouter.next); absent → no `next:` line. */
  next?: NextStepArgs;
}

/** ResultFace — the single stdout result-face class (Criterion ②; constructor injection — the
 *  StatusDeriver / NextStepRouter / ConvergenceChecker all default to fresh instances). */
export class ResultFace {
  readonly #statusDeriver: StatusDeriver;
  readonly #nextRouter: NextStepRouter;
  readonly #convergence: ConvergenceChecker;

  constructor(
    deps: {
      statusDeriver?: StatusDeriver;
      nextRouter?: NextStepRouter;
      convergence?: ConvergenceChecker;
    } = {},
  ) {
    this.#statusDeriver = deps.statusDeriver ?? new StatusDeriver();
    this.#nextRouter = deps.nextRouter ?? new NextStepRouter();
    this.#convergence = deps.convergence ?? new ConvergenceChecker();
  }

  /** emit(op, ctx) → the stdout lines: the status capsule + the optional `next:` suggestion line.
   *  review → judgment axis + own findings blocker; implement/fix → work axis + decision-source
   *  blocker (fix = the `--findings` input count, implement = 0). BLOCKED/TIMEOUT rounds produce
   *  the capsule with no `next:` line (the failure-mode stderr face owns the reason). */
  emit(ctx: ResultFaceEmitCtx): string[] {
    const status =
      ctx.op === "review"
        ? ctx.status === "BLOCKED" || ctx.status === "TIMEOUT"
          ? ctx.status
          : this.#statusDeriver.deriveReviewStatus(ctx.findings)
        : this.#statusDeriver.workStatus(ctx.status);
    const blockers = this.#convergence.blockerCount({
      findings: ctx.findings,
    } satisfies HandoffLike);
    const out = [`status: ${status} · blocker: ${blockers} · handoff: ${ctx.handoffPath}`];
    const next = ctx.next ? this.#nextRouter.next(ctx.next) : null;
    if (next) out.push(`next: ${next}`);
    return out;
  }
}
