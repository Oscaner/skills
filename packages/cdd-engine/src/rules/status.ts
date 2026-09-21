// packages/cdd-engine/src/rules/status.ts — Task 29 (spec T7.8): six-state convergence state
// machine + plan completion verdict — the statusValidate hook's derivation core. Read-only:
// consumes the on-disk task handoff chain (implement/review/fix carriers) + progress.json rounds,
// writes nothing (progress.json stays engine-owned; the verdict never writes).
//
// The round counters (reviews / fixes) come from progress.json tasks[N].rounds — review/fix count
// only, because implement rides its fixed carrier (round always 1, never incremented). The
// implement status therefore derives from the carrier file, not a counter.
//
//   reviews === fixes + 1 → the last dispatch was review-N → APPROVED ⇒ complete, else needs-fix
//   reviews === fixes      → the last dispatch was fix-N (or implement when both are 0):
//       both 0    → implement lane only (fresh / APPROVED→needs-review / BLOCKED→in-flight / dead→resume-pending)
//       fix-N APPROVED → needs-re-review (the review at this count was CHANGES_REQUESTED — T14)
//       fix-N not approved / dead → needs-fix / resume-pending
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { handoffName } from "../artifacts/handoff/naming.ts";
import { readJson } from "../artifacts/handoff/write.ts";
import { readProgressJSON } from "../artifacts/progress.ts";
import { normalizeHandoffStatus } from "../artifacts/handoff/finalize.ts";

export type TaskState =
  | "in-flight" // no conclusive chain — fresh task or a BLOCKED implement awaiting re-dispatch
  | "needs-review" // implement APPROVED, no review dispatched yet
  | "needs-fix" // latest review not approved (CHANGES_REQUESTED / BLOCKED), no fix on record
  | "needs-re-review" // review not approved → fix APPROVED, no subsequent review (T14-class)
  | "resume-pending" // dead round on record (TIMEOUT / EXECUTION_FAILURE) — resume or discard
  | "complete"; // latest review APPROVED (the existing writeback semantics)

/** carrier-level dead-round detection: a TIMEOUT status or an EXECUTION_FAILURE failure_category
 * (implement 10 lane / review-fix T25 lane both write status BLOCKED + the category). The
 * resume-or-discard family — every other status keeps its lane. */
function isDeadRound(h: Record<string, unknown> | null): boolean {
  if (!h) return false;
  if (normalizeHandoffStatus(h.status as string | undefined) === "TIMEOUT") return true;
  return h.failure_category === "EXECUTION_FAILURE";
}

function readHandoff(workspace: string, op: string, taskNum: number, round?: number): Record<string, unknown> | null {
  const name = handoffName(op, "task", round != null ? { task: taskNum, round } : { task: taskNum });
  const p = path.join(workspace, name);
  return existsSync(p) ? readJson(p) : null;
}

function statusOf(h: Record<string, unknown> | null): string | undefined {
  return normalizeHandoffStatus(h?.status as string | undefined);
}

/** deriveTaskState(workspace, taskNum) — the six-state convergence (spec T7.8 ③). Reads the
 * workspace's progress.json + the task's implement/review/fix carriers; never writes. */
export function deriveTaskState(workspace: string, taskNum: number): TaskState {
  const progress = readProgressJSON(workspace);
  const entry = progress.tasks.find((t) => t.task === taskNum);
  const reviews = entry?.rounds?.["review"] ?? 0;
  const fixes = entry?.rounds?.["fix"] ?? 0;

  if (reviews === fixes) {
    if (reviews === 0) {
      // implement lane only — the converge judgment rides the carrier status.
      const impl = readHandoff(workspace, "implement", taskNum);
      if (isDeadRound(impl)) return "resume-pending";
      if (statusOf(impl) === "APPROVED") return "needs-review";
      return "in-flight"; // fresh / implement BLOCKED (re-dispatch implement)
    }
    // reviews === fixes > 0 → the last dispatch was fix-N.
    const fixN = readHandoff(workspace, "fix", taskNum, fixes);
    if (isDeadRound(fixN)) return "resume-pending";
    if (statusOf(fixN) === "APPROVED") {
      // fix APPROVED means the review at this round was CHANGES_REQUESTED — no subsequent review
      // on record → the explicit T14-class actionable state.
      return "needs-re-review";
    }
    return "needs-fix"; // fix declared BLOCKED / not done → fix again
  }

  if (reviews === fixes + 1) {
    // → the last dispatch was review-N.
    const revN = readHandoff(workspace, "review", taskNum, reviews);
    if (isDeadRound(revN)) return "resume-pending";
    if (statusOf(revN) === "APPROVED") return "complete"; // same writeback semantics as progress writeback
    return "needs-fix"; // review CHANGES_REQUESTED / BLOCKED → the fix loop
  }

  return "in-flight"; // defensive: abnormal counter skew — nothing conclusive on disk
}

// ---- plan completion verdict ----

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

/** derivePlanVerdict(planPath, workspace, extractTaskNumbers) — reconcile the plan's `### Task N:`
 * set against the six-state table. extractTaskNumbers is injected (dispatch/task.ts owns the
 * canonical taskNumbersFromPlan; this rules module stays acyclic). */
export function derivePlanVerdict(
  planPath: string,
  workspace: string,
  extractTaskNumbers: (planPath: string) => number[],
): PlanVerdict {
  const tasks = extractTaskNumbers(planPath);
  const pending: TaskStatusRow[] = [];
  let complete = 0;
  for (const n of tasks) {
    const state = deriveTaskState(workspace, n);
    if (state === "complete") complete++;
    else pending.push({ task: n, state });
  }
  return { total: tasks.length, complete, pending, done: tasks.length > 0 && pending.length === 0 };
}

// ---- CDD_INFO line formatters（statusValidate output）----

export function formatTaskStateLine(taskNum: number, state: TaskState): string {
  return `task ${taskNum} state: ${state}`;
}

export function formatPlanVerdict(v: PlanVerdict): string {
  if (v.done) return `plan done (${v.complete}/${v.total} complete)`;
  const reasons = v.pending.map((p) => `task ${p.task} (${p.state})`).join(", ");
  return `${v.complete}/${v.total} complete — pending: ${reasons}`;
}