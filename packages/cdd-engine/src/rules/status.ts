// packages/cdd-engine/src/rules/status.ts — StatusJudge class (Task 29 spec T7.8 six-state
// convergence state machine + plan completion verdict; Task 7 OOP restructure Criterion ② — the
// statusValidate hook's derivation core is one instance-method class, zero bare function exports;
// Task 8 #278 — the REVIEW_FIX closure-state route: a review that closed on warn/nit-only findings routes
// through its fix round to complete, never a re-review). Read-only: consumes the on-disk task
// handoff chain (implement/review/fix carriers) + progress.json rounds, writes nothing (progress.json
// stays engine-owned; the verdict never writes).
// Task 30 (spec T7.9): deriveTaskState is the SINGLE TaskState source — tasks[N].status is
// retired from progress.json and the writeback only ensures the row exists.
//
// The round counters (reviews / fixes) come from progress.json tasks[N].rounds — review/fix count
// only, because implement rides its fixed carrier (round always 1, never incremented). The
// implement status therefore derives from the carrier file, not a counter.
//
//   reviews === 0                → implement lane: the converge judgment rides the carrier status
//                                  (fresh/BLOCKED → in-flight / APPROVED → needs-review / dead → resume-pending)
//   last review (review-[reviews]) is the FIRST signal (Task 30 ①, T29 修正):
//     APPROVED   → complete — a subsequent fix is the legal terminal (blocker=0 → fix all → done),
//                  never a re-review trigger (the old reviews===fixes counts-equal misjudgment).
//                  The fix is not consulted at all in this branch — dead-round precedence
//                  (resume-pending) never applies to a fix following an APPROVED review.
//     REVIEW_FIX → closure state — the review closed on warn/nit-only findings: its fix round routes the
//                  task to complete (no re-review, S2); no fix on record yet → the fix is due
//                  (needs-fix). The addressing fix discriminates like the S1 lane: dead →
//                  resume-pending, APPROVED → complete (closure fix landed), BLOCKED / not landed →
//                  needs-fix (re-dispatch the closure fix).
//     not APPROVED / not REVIEW_FIX (CHANGES_REQUESTED / BLOCKED):
//       no fix after it (fixes === 0, or the latest fix pre-dates the review) → needs-fix
//       addressing fix APPROVED → needs-re-review (T14-class)
//       addressing fix dead / not landed → resume-pending / needs-fix
//
// Dead-round precedence (resume-pending) therefore applies to: dead implement carriers, dead
// reviews, and dead fixes under the not-APPROVED branch — never to a fix after an APPROVED review
// (that chain is terminal complete no matter what the fix carrier says).
import { existsSync } from "node:fs";
import path from "node:path";
import { normalizeHandoffStatus } from "../artifacts/handoff/finalize.ts";
import { handoffName } from "../artifacts/handoff/naming.ts";
import { readJson } from "../artifacts/handoff/write.ts";
import { ProgressLedger } from "../artifacts/progress.ts";
import type { TaskGroup } from "../domain/task-group.ts";

export type TaskState =
  | "in-flight" // no conclusive chain — fresh task or a BLOCKED implement awaiting re-dispatch
  | "needs-review" // implement APPROVED, no review dispatched yet
  | "needs-fix" // latest review not approved (CHANGES_REQUESTED / BLOCKED / REVIEW_FIX), no addressing fix on record
  | "needs-re-review" // review not approved → addressing fix APPROVED, no re-review on record (T14-class)
  | "resume-pending" // dead round on record (TIMEOUT / EXECUTION_FAILURE) — resume or discard;
  // never derived for a fix that follows an APPROVED review — that chain is terminal complete (T30 ①)
  | "complete"; // latest review APPROVED, or a REVIEW_FIX review followed by its fix round (Task 8 — closure state)

/** StatusJudge — the six-state convergence + plan verdict derivation (Criterion ②; constructor injection — the
 *  progress ledger, defaulting to a fresh instance). */
export class StatusJudge {
  readonly #ledger: ProgressLedger;

  constructor(ledger: ProgressLedger = new ProgressLedger()) {
    this.#ledger = ledger;
  }

  /** carrier-level dead-round detection: a TIMEOUT status or an EXECUTION_FAILURE failure_category
   * (implement 10 lane / review-fix T25 lane both write status BLOCKED + the category). The
   * resume-or-discard family — every other status keeps its lane. */
  #isDeadRound(h: Record<string, unknown> | null): boolean {
    if (!h) return false;
    if (normalizeHandoffStatus(h.status as string | undefined) === "TIMEOUT") return true;
    return h.failure_category === "EXECUTION_FAILURE";
  }

  #readHandoff(
    workspace: string,
    op: string,
    key: string,
    round?: number,
  ): Record<string, unknown> | null {
    // The dispatch unit's carriers: the group key (tasks-{a},{b}-*) for a merged group, the
    // group-of-one name (key === the task number) for a singleton — one naming surface, P4.3/4.4.
    const name = handoffName(op, "task", round != null ? { tasks: key, round } : { tasks: key });
    const p = path.join(workspace, name);
    return existsSync(p) ? readJson(p) : null;
  }

  #statusOf(h: Record<string, unknown> | null): string | undefined {
    return normalizeHandoffStatus(h?.status as string | undefined);
  }

  /** deriveTaskState(workspace, taskNum, groups?) — the six-state convergence (spec T7.8 ③ /
   * T7.9 ①; Task 8 ② adds the REVIEW_FIX closure-state route). Reads the workspace's progress.json + the
   * dispatch unit's implement/review/fix carriers; never writes. groups — the effectiveGroups
   * derivation (TaskGroup[]), consumed one-to-one when provided — gives a merged-group member the
   * group's identity: the member derives from the group carriers (tasks-{a},{b}-*) + the {group}
   * ledger row, never stuck on the per-task names the group never wrote. A singleton member
   * (declared one-member group or the no-declaration default) keeps exactly the pre-P4.3 per-task
   * derivation (tasks-{N}-* + the {task} row — byte-identical empty-default behavior); a task absent
   * from the group set falls back to that singleton derivation too (direct per-task callers and
   * singletons share one code path).
   * The last review status is the first signal: APPROVED → complete (a following fix is the legal
   * terminal, T29 revision); REVIEW_FIX → the fix round routes to complete (S2 — closure state, no re-review);
   * not approved → the addressing fix decides needs-fix vs needs-re-review. */
  deriveTaskState(workspace: string, taskNum: number, groups?: readonly TaskGroup[]): TaskState {
    const progress = this.#ledger.read(workspace);
    // Group-of-one vs merged: the dispatch unit's key resolves the right carriers + ledger row
    // (a merged group keys off `tasks-{a},{b}`; the singleton key is the task number itself).
    const declared = groups?.find((g) => g.includes(taskNum));
    const key = declared && declared.length > 1 ? declared.key() : String(taskNum);
    const entry =
      key === String(taskNum)
        ? progress.tasks.find((t) => "task" in t && t.task === taskNum)
        : progress.tasks.find((t) => "group" in t && t.group === key);
    const reviews = entry?.rounds?.review ?? 0;
    const fixes = entry?.rounds?.fix ?? 0;

    if (reviews === 0) {
      // implement lane only — no review on record, the converge judgment rides the carrier status.
      const impl = this.#readHandoff(workspace, "implement", key);
      if (this.#isDeadRound(impl)) return "resume-pending";
      if (this.#statusOf(impl) === "APPROVED") return "needs-review";
      return "in-flight"; // fresh / implement BLOCKED (re-dispatch implement)
    }

    // The last review on record (review-[reviews]) is the first signal.
    const lastRev = this.#readHandoff(workspace, "review", key, reviews);
    if (this.#isDeadRound(lastRev)) return "resume-pending";
    if (this.#statusOf(lastRev) === "APPROVED") return "complete"; // legal terminal — a later fix
    // (APPROVED, BLOCKED or dead) is never consulted, let alone re-triggers a review

    // REVIEW_FIX closure state (warn/nit-only findings, #278): the fix round routes the task to
    // complete with no re-review (S2 — distinct from S1's needs-fix → fix → needs-re-review).
    // No addressing fix on record yet → the fix is due; otherwise the addressing fix
    // discriminates like the S1 lane: dead → resume-pending, APPROVED → complete (closure fix
    // landed — legal terminal), BLOCKED / not landed → needs-fix (re-dispatch the closure fix).
    if (this.#statusOf(lastRev) === "REVIEW_FIX") {
      if (fixes === 0 || fixes < reviews) return "needs-fix";
      const addressingFix = this.#readHandoff(workspace, "fix", key, fixes);
      if (this.#isDeadRound(addressingFix)) return "resume-pending";
      if (this.#statusOf(addressingFix) === "APPROVED") {
        return "complete"; // closure fix landed — legal terminal, no re-review
      }
      return "needs-fix"; // closure fix has not landed (BLOCKED / not done) → re-dispatch the fix
    }

    // Last review not approved (CHANGES_REQUESTED / BLOCKED) → the fix loop governs. The addressing
    // fix is the latest fix on record, and only one that came at-or-after the review (fixes >=
    // reviews) can have addressed it — a fix pre-dating the review converged an EARLIER one.
    if (fixes === 0 || fixes < reviews) return "needs-fix";
    const lastFix = this.#readHandoff(workspace, "fix", key, fixes);
    if (this.#isDeadRound(lastFix)) return "resume-pending";
    if (this.#statusOf(lastFix) === "APPROVED") return "needs-re-review"; // findings fixed → re-review due (T14)
    return "needs-fix"; // addressing fix declared BLOCKED / not done → fix again
  }

  // ---- plan completion verdict ----

  /** derivePlanVerdict(planPath, workspace, extractTaskNumbers, extractGroups) — reconcile the
   * plan's task set against the six-state table. The iteration source is the effective dispatch
   * groups (P4.3 Task 3): extractGroups — the canonical effectiveGroups derivation (TaskGroup[]) —
   * always provided (the empty-default per-task singletons live inside effectiveGroups itself, never
   * as a fallback here — one derivation, no second implementation a caller can silently sit on).
   * The group table flows into deriveTaskState, so a merged-group member's state derives from its
   * group carriers — the declared-group loop reaches `plan done` exactly like the singleton loop.
   * extractTaskNumbers / extractGroups are injected (the canonical extractors live in
   * rules/documents.ts, re-exported through dispatch/task.ts; this rules module stays acyclic —
   * status.test.ts mirrors the extractors locally). */
  derivePlanVerdict(
    planPath: string,
    workspace: string,
    _extractTaskNumbers: (planPath: string) => number[],
    extractGroups: (planPath: string) => readonly TaskGroup[],
  ): PlanVerdict {
    const groups = extractGroups(planPath);
    // The group union is the plan's task set (empty default: singletons → exactly taskNumbersFromPlan).
    const tasks = [...new Set(groups.flatMap((g) => [...g]))].sort((a, b) => a - b);
    const pending: TaskStatusRow[] = [];
    let complete = 0;
    for (const n of tasks) {
      const state = this.deriveTaskState(workspace, n, groups);
      if (state === "complete") complete++;
      else pending.push({ task: n, state });
    }
    return {
      total: tasks.length,
      complete,
      pending,
      done: tasks.length > 0 && pending.length === 0,
    };
  }

  // ---- CDD_INFO line formatters（statusValidate output）----

  formatTaskStateLine(taskNum: number, state: TaskState): string {
    return `task ${taskNum} state: ${state}`;
  }

  formatPlanVerdict(v: PlanVerdict): string {
    if (v.done) return `plan done (${v.complete}/${v.total} complete)`;
    const reasons = v.pending.map((p) => `task ${p.task} (${p.state})`).join(", ");
    return `${v.complete}/${v.total} complete — pending: ${reasons}`;
  }
}

export interface TaskStatusRow {
  task: number;
  state: TaskState;
}

export interface PlanVerdict {
  total: number;
  complete: number;
  pending: TaskStatusRow[];
  /** plan done — every `### Task N:` on the plan has converged to complete (the engine-side
   *  verdict the closeout declaration consumes; always false for an empty task set). */
  done: boolean;
}
