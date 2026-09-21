// packages/cdd-engine/src/rules/__tests__/status.test.ts — Task 29 (spec T7.8) six-state
// convergence state machine + plan completion verdict (the statusValidate hook's derivation core),
// Task 30 (spec T7.9) last-review-primary correction + TaskState single-source.
//
// The six states converge from the on-disk task handoff chain (implement / review / fix carriers)
// + progress.json rounds (review/fix count only — implement rides the fixed carrier). The machine
// is read-only: derives, never writes. Task 30 ②: tasks[N].status is retired — deriveTaskState is
// the single TaskState source; the row keeps only facts (rounds / scope_base).
//
//   in-flight         no conclusive chain — fresh task or a BLOCKED implement awaiting re-dispatch
//   needs-review      implement APPROVED, no review dispatched yet
//   needs-fix         latest review not approved (CHANGES_REQUESTED / BLOCKED), no addressing fix
//   needs-re-review   T14-class: review not approved → addressing fix APPROVED, no re-review yet
//   resume-pending    dead round on record (TIMEOUT / EXECUTION_FAILURE) — resume or discard
//   complete          latest review APPROVED (a subsequent fix is the legal terminal — T30 ①)
import { it, expect, describe } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  deriveTaskState,
  derivePlanVerdict,
  formatTaskStateLine,
  formatPlanVerdict,
  type PlanVerdict,
} from "../status.ts";

function workspace(progress: Record<string, unknown>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-status-"));
  writeFileSync(path.join(dir, "progress.json"), JSON.stringify(progress, null, 2));
  return dir;
}

function writeHandoff(dir: string, name: string, obj: Record<string, unknown>): void {
  writeFileSync(path.join(dir, name), JSON.stringify(obj));
}

const EMPTY_PROGRESS = { plan: "", tasks: [] as Array<Record<string, unknown>> };
// Progress rows carry no status — deriveTaskState is the sole TaskState source; the row only
// records facts (rounds / scope_base). The legacy tasks[N].status field is retired. (Task 30 ②)
const ROUNDS = (rounds: Record<string, number>) => ({
  plan: "",
  tasks: [{ task: 1, rounds }],
});

/** test-side plan-task extractor mirroring taskNumbersFromPlan's `/^### Task (\d+):/` semantics. */
function extractTasks(planPath: string): number[] {
  const nums: number[] = [];
  for (const line of readFileSync(planPath, "utf8").split("\n")) {
    const m = line.match(/^### Task (\d+):/);
    if (m) nums.push(Number(m[1]));
  }
  return nums.sort((a, b) => a - b);
}

function planFile(body: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-status-plan-"));
  const p = path.join(dir, "plan.md");
  writeFileSync(p, body);
  return p;
}

describe("deriveTaskState — six-state convergence", () => {
  it("in-flight: fresh task with no handoff / rounds (or implement not yet APPROVED)", () => {
    const ws = workspace(EMPTY_PROGRESS);
    expect(deriveTaskState(ws, 1)).toBe("in-flight");
  });

  it("in-flight: implement carrier BLOCKED (non-APPROVED, non-dead) → re-dispatch implement", () => {
    const ws = workspace(EMPTY_PROGRESS);
    writeHandoff(ws, "task-1-implement.json", { task: 1, phase: "implement", status: "BLOCKED", failure_category: "CONTRACT_VIOLATION", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("in-flight");
  });

  it("needs-review: implement APPROVED + no review on record", () => {
    const ws = workspace(EMPTY_PROGRESS);
    writeHandoff(ws, "task-1-implement.json", { task: 1, phase: "implement", status: "APPROVED", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("needs-review");
  });

  it("needs-fix: review CHANGES_REQUESTED + no fix on record", () => {
    const ws = workspace(ROUNDS({ review: 1 }));
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "CHANGES_REQUESTED", findings: [{ severity: "blocker" }], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("needs-fix");
  });

  it("needs-fix: review BLOCKED (engine BLOCKED channel) likewise awaits the fix", () => {
    const ws = workspace(ROUNDS({ review: 1 }));
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "BLOCKED", failure_category: "UNVERIFIABLE", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("needs-fix");
  });

  it("needs-fix: fix BLOCKED (fix attempted but not landed) → fix again", () => {
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "CHANGES_REQUESTED", findings: [{ severity: "blocker" }], artifacts: {} });
    writeHandoff(ws, "task-1-fix-1.json", { task: 1, phase: "fix", status: "BLOCKED", blocker: "fix could not land", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("needs-fix");
  });

  it("needs-re-review (T14 explicit): review not approved → fix APPROVED, no subsequent review", () => {
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "CHANGES_REQUESTED", findings: [{ severity: "blocker" }], artifacts: {} });
    writeHandoff(ws, "task-1-fix-1.json", { task: 1, phase: "fix", status: "APPROVED", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("needs-re-review");
  });

  it("resume-pending: implement TIMEOUT dead round → resume or discard", () => {
    const ws = workspace(EMPTY_PROGRESS);
    writeHandoff(ws, "task-1-implement.json", { task: 1, phase: "implement", status: "TIMEOUT", failure_category: "TIMEOUT", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("resume-pending");
  });

  it("resume-pending: implement EXECUTION_FAILURE (status BLOCKED + category)", () => {
    const ws = workspace(EMPTY_PROGRESS);
    writeHandoff(ws, "task-1-implement.json", { task: 1, phase: "implement", status: "BLOCKED", failure_category: "EXECUTION_FAILURE", blocker: "cli exited 1", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("resume-pending");
  });

  it("resume-pending: review dead round (review TIMEOUT)", () => {
    const ws = workspace(ROUNDS({ review: 1 }));
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "TIMEOUT", failure_category: "TIMEOUT", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("resume-pending");
  });

  it("complete: latest review APPROVED (the existing writeback semantics)", () => {
    const ws = workspace(ROUNDS({ review: 1 }));
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "APPROVED", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("complete");
  });

  // ---- last-review-primary — the T29 reproduction flip (Task 30 ①, spec T7.9) ----

  it("complete (T30 flip): review APPROVED → subsequent fix is the legal terminal, NOT a re-review trigger", () => {
    // The same round counters (reviews===fixes===1) hosted two flows — the APPROVED-review legal
    // terminal (blocker=0 → fix all → done) and the T14 re-review chain. counts-equal was a
    // misjudgment: the fix after an approved review converged the task. (T29 evidence)
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "APPROVED", findings: [{ severity: "warn" }], artifacts: {} });
    writeHandoff(ws, "task-1-fix-1.json", { task: 1, phase: "fix", status: "APPROVED", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("complete");
  });

  it("complete (T30 flip): review APPROVED + fix that did not land still converges on the review verdict", () => {
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "APPROVED", findings: [], artifacts: {} });
    writeHandoff(ws, "task-1-fix-1.json", { task: 1, phase: "fix", status: "BLOCKED", blocker: "fix aborted", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("complete");
  });

  it("complete (T30 terminal carve-out): a DEAD fix after an APPROVED review is never consulted — not resume-pending", () => {
    // Dead-round precedence (resume-pending) applies to dead implement carriers, dead reviews, and
    // dead fixes under the not-APPROVED branch — the APPROVED branch returns before reading the
    // addressing fix, so a dead fix after an APPROVED review still derives complete. Pinned for both
    // dead carrier shapes (status TIMEOUT / status BLOCKED + failure_category EXECUTION_FAILURE).
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "APPROVED", findings: [{ severity: "warn" }], artifacts: {} });
    writeHandoff(ws, "task-1-fix-1.json", { task: 1, phase: "fix", status: "TIMEOUT", failure_category: "TIMEOUT", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("complete");
    writeHandoff(ws, "task-1-fix-1.json", { task: 1, phase: "fix", status: "BLOCKED", failure_category: "EXECUTION_FAILURE", blocker: "cli exited 1", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("complete");
  });

  it("needs-re-review (T14 explicit, review-BLOCKED channel variant): review BLOCKED → fix APPROVED", () => {
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "BLOCKED", failure_category: "UNVERIFIABLE", findings: [], artifacts: {} });
    writeHandoff(ws, "task-1-fix-1.json", { task: 1, phase: "fix", status: "APPROVED", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("needs-re-review");
  });

  it("needs-fix (T30 discriminator): a fix pre-dating the latest review does not re-review it", () => {
    // reviews=2, fixes=1: review-2 dispatched after fix-1 converged review-1's findings — the last
    // review has no addressing fix of its own → needs-fix (dispatch fix-2), never needs-re-review.
    const ws = workspace(ROUNDS({ review: 2, fix: 1 }));
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "CHANGES_REQUESTED", findings: [{ severity: "blocker" }], artifacts: {} });
    writeHandoff(ws, "task-1-fix-1.json", { task: 1, phase: "fix", status: "APPROVED", findings: [], artifacts: {} });
    writeHandoff(ws, "task-1-review-2.json", { task: 1, phase: "review", status: "CHANGES_REQUESTED", findings: [{ severity: "blocker" }], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("needs-fix");
  });

  it("derives from status-free progress rows (Task 30 ② migration shape — rounds-only row)", () => {
    const ws = workspace({ plan: "", tasks: [{ task: 1, rounds: { review: 1, fix: 1 } }] });
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "CHANGES_REQUESTED", findings: [{ severity: "blocker" }], artifacts: {} });
    writeHandoff(ws, "task-1-fix-1.json", { task: 1, phase: "fix", status: "APPROVED", findings: [], artifacts: {} });
    expect(deriveTaskState(ws, 1)).toBe("needs-re-review");
  });
});

describe("derivePlanVerdict — plan completion verdict (`### Task N:` set ↔ six-state table)", () => {
  it("all-complete: every plan task complete → plan done", () => {
    const plan = planFile("# Plan\n\n### Task 1: a\nbody\n\n### Task 2: b\nbody\n");
    const ws = workspace({
      plan: "",
      tasks: [
        { task: 1, rounds: { review: 1 } },
        { task: 2, rounds: { review: 1 } },
      ],
    });
    for (const n of [1, 2]) {
      writeHandoff(ws, `task-${n}-review-1.json`, { task: n, phase: "review", status: "APPROVED", findings: [], artifacts: {} });
    }
    const v: PlanVerdict = derivePlanVerdict(plan, ws, extractTasks);
    expect(v.done).toBe(true);
    expect(v).toEqual({ total: 2, complete: 2, pending: [], done: true });
    expect(formatPlanVerdict(v)).toBe("plan done (2/2 complete)");
  });

  it("pending-with-reasons: mixed states → complete count + per-task six-state reasons", () => {
    const plan = planFile("# Plan\n\n### Task 1: a\nbody\n\n### Task 2: b\nbody\n");
    const ws = workspace({
      plan: "",
      tasks: [
        { task: 1, rounds: { review: 1 } },
        { task: 2, rounds: { review: 1, fix: 1 } },
      ],
    });
    writeHandoff(ws, "task-1-review-1.json", { task: 1, phase: "review", status: "APPROVED", findings: [], artifacts: {} });
    // task 2: review CHANGES_REQUESTED → fix APPROVED → needs-re-review (six-state convergence evidence)
    writeHandoff(ws, "task-2-review-1.json", { task: 2, phase: "review", status: "CHANGES_REQUESTED", findings: [{ severity: "blocker" }], artifacts: {} });
    writeHandoff(ws, "task-2-fix-1.json", { task: 2, phase: "fix", status: "APPROVED", findings: [], artifacts: {} });
    const v: PlanVerdict = derivePlanVerdict(plan, ws, extractTasks);
    expect(v.done).toBe(false);
    expect(v).toEqual({ total: 2, complete: 1, pending: [{ task: 2, state: "needs-re-review" }], done: false });
    expect(formatPlanVerdict(v)).toBe("1/2 complete — pending: task 2 (needs-re-review)");
  });

  it("per-task state line formatting (the CDD_INFO line)", () => {
    expect(formatTaskStateLine(7, "needs-fix")).toBe("task 7 state: needs-fix");
    expect(formatTaskStateLine(3, "complete")).toBe("task 3 state: complete");
  });
});
