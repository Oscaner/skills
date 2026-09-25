// packages/cdd-engine/src/rules/convergence.ts — ConvergenceChecker class (Task 5 rules-layer
// rebuild + Task 7 OOP restructure 判定标准②: the Review Convergence guard cluster is one
// instance-method class, zero bare function exports; ex the cluster that cli/shared.mjs hosted).
// Self-contained per the closure-completeness ownership rule: reviewConvergenceGuard calls
// convergedExit3 + blockerCount + reviewConvergedError, so all four methods move together (no rules
// → dispatch cli reverse dependency).
// Semantics (SP-4): only a previous round that reached APPROVED with blocker=0 converges a re-dispatch;
// a failure round (BLOCKED/TIMEOUT, often written with findings:[]) must stay re-dispatchable —
// the gate requires status === "APPROVED" in addition to blockerCount === 0.
// B3: ENGINE_SELF_WRITTEN / CONTRACT_VIOLATION = the dispatch did not complete → not a Convergence
// basis (「计入 Review Convergence = no」). The judgment derives from the canonical
// (isIncompleteDispatch), never a hand-written category name — a canonically deleted category
// turns this reference red.
import { exitWithCode } from "../infra/exit.ts";
import { FailureResolver } from "./failure.ts";

export interface HandoffLike {
  status?: string;
  findings?: Array<{ severity?: string }>;
  blocker?: string;
  failure_category?: string;
}

/** ConvergenceChecker — the Review Convergence guard cluster (判定标准②; 构造注入 — the failure
 *  resolver feeding the incomplete-dispatch judgment, defaulting to a fresh instance). */
export class ConvergenceChecker {
  readonly #failure: FailureResolver;

  constructor(failure: FailureResolver = new FailureResolver()) {
    this.#failure = failure;
  }

  blockerCount(handoff: HandoffLike | null | undefined): number {
    return (handoff?.findings ?? []).filter((f) => f?.severity === "blocker").length;
  }

  // Review Convergence error single point (reason-scoped messages, spec §2.5 item 7/8):
  // - "legacy" — pre-content-hash review handoff: content state unknown → hard stop, no edit-guide
  //   (unreachable in practice).
  // - "unchanged" — same path + same doc_hash: content unchanged → same ref, edit content or open
  //   a new doc.
  // - default — no content-dimension context (task/branch family): current wording unchanged.
  // Keeps the `/blocker=0/` prefix + `Review Convergence:` invariant (existing assertions depend on it).
  reviewConvergedError(
    type: string,
    round: number,
    ref: string,
    opts: { reason?: string } = {},
  ): Error {
    const prev = Math.max(round - 1, 1);
    const tail =
      opts.reason === "legacy"
        ? `Review Convergence: do not re-run — pre-content-hash review handoff (no doc_hash) at round ${prev}; content state unknown: open a new doc or remove the stale round-${prev} review handoff to re-review`
        : opts.reason === "unchanged"
          ? `Review Convergence: do not re-run — doc content unchanged since round ${prev} clean review: edit the doc content or open a new doc to start a new review`
          : "Review Convergence: do not re-run; change ref to open a new review";
    return new Error(`round ${round} (${type}, ${ref}) already blocker=0 — ${tail}`);
  }

  // convergedExit3: structured error + message are the single authority; stderr prints the message
  // (and the last blocker when present), then exits 3 via the unified exit point (throws).
  convergedExit3(
    type: string,
    round: number,
    ref: string,
    blocker: string | null | undefined,
    opts?: { reason?: string },
  ): never {
    const e = this.reviewConvergedError(type, round, ref, opts);
    process.stderr.write(`${e.message}\n${blocker ? `last blocker: ${blocker}\n` : ""}`);
    exitWithCode(3);
  }

  // Unified Convergence gate: only APPROVED + blocker=0 converges a re-run; a BLOCKED/TIMEOUT failure
  // round (findings:[]) must stay re-dispatchable (SP-4). ref is the type's target signature.
  // opts passes the reviewConvergedError reason (legacy/unchanged) — task/branch call sites pass no
  // opts → default wording unchanged. prev null/undefined → no stop (first dispatch).
  reviewConvergenceGuard(
    prev: HandoffLike | null | undefined,
    type: string,
    round: number,
    ref: string,
    opts?: { reason?: string },
  ): void {
    const incomplete = this.#failure.isIncompleteDispatch(prev?.failure_category);
    if (!incomplete && prev && prev.status === "APPROVED" && this.blockerCount(prev) === 0) {
      this.convergedExit3(type, round, ref, prev?.blocker, opts);
    }
  }
}
