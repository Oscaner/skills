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

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TaskGroup } from "../../domain/task-group.ts";
import { type PlanVerdict, StatusJudge } from "../status.ts";

const statusJudge = new StatusJudge();

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

/** test-side effectiveGroups mirror — the empty-default per-task singletons. The no-taskGroups
 * derivation itself is pinned in documents.test.ts; this surface always consumes it via the
 * injected extractor (the verdict module carries no singleton fallback — one derivation). */
function singletonGroups(planPath: string): TaskGroup[] {
  return extractTasks(planPath).map((n) => TaskGroup.fromNumbers([n]));
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
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("in-flight");
  });

  it("in-flight: implement carrier BLOCKED (non-APPROVED, non-dead) → re-dispatch implement", () => {
    const ws = workspace(EMPTY_PROGRESS);
    writeHandoff(ws, "tasks-1-implement.json", {
      tasks: [1],
      phase: "implement",
      status: "BLOCKED",
      failure_category: "CONTRACT_VIOLATION",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("in-flight");
  });

  it("needs-review: implement APPROVED + no review on record", () => {
    const ws = workspace(EMPTY_PROGRESS);
    writeHandoff(ws, "tasks-1-implement.json", {
      tasks: [1],
      phase: "implement",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-review");
  });

  it("needs-fix: review CHANGES_REQUESTED + no fix on record", () => {
    const ws = workspace(ROUNDS({ review: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "CHANGES_REQUESTED",
      findings: [{ severity: "blocker" }],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-fix");
  });

  it("needs-fix: review BLOCKED (engine BLOCKED channel) likewise awaits the fix", () => {
    const ws = workspace(ROUNDS({ review: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "BLOCKED",
      failure_category: "UNVERIFIABLE",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-fix");
  });

  it("needs-fix: fix BLOCKED (fix attempted but not landed) → fix again", () => {
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "CHANGES_REQUESTED",
      findings: [{ severity: "blocker" }],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1-fix-1.json", {
      tasks: [1],
      phase: "fix",
      status: "BLOCKED",
      blocker: "fix could not land",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-fix");
  });

  it("needs-re-review (T14 explicit): review not approved → fix APPROVED, no subsequent review", () => {
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "CHANGES_REQUESTED",
      findings: [{ severity: "blocker" }],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1-fix-1.json", {
      tasks: [1],
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-re-review");
  });

  it("resume-pending: implement TIMEOUT dead round → resume or discard", () => {
    const ws = workspace(EMPTY_PROGRESS);
    writeHandoff(ws, "tasks-1-implement.json", {
      tasks: [1],
      phase: "implement",
      status: "TIMEOUT",
      failure_category: "TIMEOUT",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("resume-pending");
  });

  it("resume-pending: implement EXECUTION_FAILURE (status BLOCKED + category)", () => {
    const ws = workspace(EMPTY_PROGRESS);
    writeHandoff(ws, "tasks-1-implement.json", {
      tasks: [1],
      phase: "implement",
      status: "BLOCKED",
      failure_category: "EXECUTION_FAILURE",
      blocker: "cli exited 1",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("resume-pending");
  });

  it("resume-pending: review dead round (review TIMEOUT)", () => {
    const ws = workspace(ROUNDS({ review: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "TIMEOUT",
      failure_category: "TIMEOUT",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("resume-pending");
  });

  it("complete: latest review APPROVED (the existing writeback semantics)", () => {
    const ws = workspace(ROUNDS({ review: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("complete");
  });

  // ---- last-review-primary — the T29 reproduction flip (Task 30 ①, spec T7.9) ----

  it("complete (T30 flip): review APPROVED → subsequent fix is the legal terminal, NOT a re-review trigger", () => {
    // The same round counters (reviews===fixes===1) hosted two flows — the APPROVED-review legal
    // terminal (blocker=0 → fix all → done) and the T14 re-review chain. counts-equal was a
    // misjudgment: the fix after an approved review converged the task. (T29 evidence)
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "APPROVED",
      findings: [{ severity: "warn" }],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1-fix-1.json", {
      tasks: [1],
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("complete");
  });

  it("complete (T30 flip): review APPROVED + fix that did not land still converges on the review verdict", () => {
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1-fix-1.json", {
      tasks: [1],
      phase: "fix",
      status: "BLOCKED",
      blocker: "fix aborted",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("complete");
  });

  it("complete (T30 terminal carve-out): a DEAD fix after an APPROVED review is never consulted — not resume-pending", () => {
    // Dead-round precedence (resume-pending) applies to dead implement carriers, dead reviews, and
    // dead fixes under the not-APPROVED branch — the APPROVED branch returns before reading the
    // addressing fix, so a dead fix after an APPROVED review still derives complete. Pinned for both
    // dead carrier shapes (status TIMEOUT / status BLOCKED + failure_category EXECUTION_FAILURE).
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "APPROVED",
      findings: [{ severity: "warn" }],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1-fix-1.json", {
      tasks: [1],
      phase: "fix",
      status: "TIMEOUT",
      failure_category: "TIMEOUT",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("complete");
    writeHandoff(ws, "tasks-1-fix-1.json", {
      tasks: [1],
      phase: "fix",
      status: "BLOCKED",
      failure_category: "EXECUTION_FAILURE",
      blocker: "cli exited 1",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("complete");
  });

  it("needs-re-review (T14 explicit, review-BLOCKED channel variant): review BLOCKED → fix APPROVED", () => {
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "BLOCKED",
      failure_category: "UNVERIFIABLE",
      findings: [],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1-fix-1.json", {
      tasks: [1],
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-re-review");
  });

  it("needs-fix (T30 discriminator): a fix pre-dating the latest review does not re-review it", () => {
    // reviews=2, fixes=1: review-2 dispatched after fix-1 converged review-1's findings — the last
    // review has no addressing fix of its own → needs-fix (dispatch fix-2), never needs-re-review.
    const ws = workspace(ROUNDS({ review: 2, fix: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "CHANGES_REQUESTED",
      findings: [{ severity: "blocker" }],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1-fix-1.json", {
      tasks: [1],
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1-review-2.json", {
      tasks: [1],
      phase: "review",
      status: "CHANGES_REQUESTED",
      findings: [{ severity: "blocker" }],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-fix");
  });

  it("derives from status-free progress rows (Task 30 ② migration shape — rounds-only row)", () => {
    const ws = workspace({ plan: "", tasks: [{ task: 1, rounds: { review: 1, fix: 1 } }] });
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "CHANGES_REQUESTED",
      findings: [{ severity: "blocker" }],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1-fix-1.json", {
      tasks: [1],
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-re-review");
  });

  // ---- group convergence (P4.3 declared taskGroups): a merged-group member derives from the
  // group carriers (tasks-{a}-{b}-*) + the {group} ledger row — never stuck per-task in-flight ----

  it("complete: a merged-group member resolves the group carriers (reviews from the {group} row, review APPROVED)", () => {
    const ws = workspace({ plan: "", tasks: [{ group: "1,2", rounds: { review: 1 } }] });
    writeHandoff(ws, "tasks-1,2-implement.json", {
      tasks: [1, 2],
      phase: "implement",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1,2-review-1.json", {
      tasks: [1, 2],
      phase: "review",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1, [TaskGroup.fromNumbers([1, 2])])).toBe("complete");
    expect(statusJudge.deriveTaskState(ws, 2, [TaskGroup.fromNumbers([1, 2])])).toBe("complete");
  });

  it("needs-review: a merged group with implement APPROVED and no review on record", () => {
    const ws = workspace({ plan: "", tasks: [{ group: "1,2", rounds: {} }] });
    writeHandoff(ws, "tasks-1,2-implement.json", {
      tasks: [1, 2],
      phase: "implement",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1, [TaskGroup.fromNumbers([1, 2])])).toBe(
      "needs-review",
    );
    expect(statusJudge.deriveTaskState(ws, 2, [TaskGroup.fromNumbers([1, 2])])).toBe(
      "needs-review",
    );
  });

  it("needs-re-review: the addressing fix lane reads group carriers (review CHANGES_REQUESTED → fix APPROVED)", () => {
    const ws = workspace({ plan: "", tasks: [{ group: "1,2", rounds: { review: 1, fix: 1 } }] });
    writeHandoff(ws, "tasks-1,2-review-1.json", {
      tasks: [1, 2],
      phase: "review",
      status: "CHANGES_REQUESTED",
      findings: [{ severity: "blocker" }],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1,2-fix-1.json", {
      tasks: [1, 2],
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1, [TaskGroup.fromNumbers([1, 2])])).toBe(
      "needs-re-review",
    );
    expect(statusJudge.deriveTaskState(ws, 2, [TaskGroup.fromNumbers([1, 2])])).toBe(
      "needs-re-review",
    );
  });

  it("singleton fallback: a task unknown to the group set (or groups unspecified) keeps the per-task derivation", () => {
    const ws = workspace(EMPTY_PROGRESS);
    writeHandoff(ws, "tasks-3-implement.json", {
      tasks: [3],
      phase: "implement",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    // groups provided but not containing task 3 → the per-task singleton derivation.
    expect(statusJudge.deriveTaskState(ws, 3, [TaskGroup.fromNumbers([1, 2])])).toBe(
      "needs-review",
    );
    // groups unspecified → the pre-P4.3 signature is unchanged.
    expect(statusJudge.deriveTaskState(ws, 3)).toBe("needs-review");
  });

  // ---- REVIEW_FIX three-value conclusion (#278) — a self-built mkdtemp chain: S1 blocker loop regression · S2 closure state → fix → complete
  // no re-review · S3 zero-finding fast path (zero-artifact fixture — the chain is fully self-built) ----

  function writeReview(dir: string, round: number, status: string, severities: string[]): void {
    writeHandoff(dir, `tasks-1-review-${round}.json`, {
      tasks: [1],
      phase: "review",
      status,
      findings: severities.map((s) => ({ severity: s, summary: s })),
      artifacts: {},
    });
  }

  function writeFix(dir: string, round: number): void {
    writeHandoff(dir, `tasks-1-fix-${round}.json`, {
      tasks: [1],
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
  }

  // deriveTaskState reads round counts from progress.json (the six-key ledger) — each chain step
  // re-seeds the row so review-[reviews]/fix-[fixes] point at the carriers just written.
  function setRounds(dir: string, rounds: Record<string, number>): void {
    writeFileSync(
      path.join(dir, "progress.json"),
      JSON.stringify({ plan: "", tasks: [{ task: 1, rounds }] }),
    );
  }

  it("S1 blocker 循环回归: CHANGES_REQUESTED → fix → needs-re-review → 再 review → … 直至 APPROVED 才 complete（blocker 循环不提前收口）", () => {
    const ws = workspace(EMPTY_PROGRESS);
    writeHandoff(ws, "tasks-1-implement.json", {
      tasks: [1],
      phase: "implement",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    // review-1 blocker → needs-fix (fix routing).
    setRounds(ws, { review: 1 });
    writeReview(ws, 1, "CHANGES_REQUESTED", ["blocker"]);
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-fix");
    // fix-1 landed → re-review due (the blocker loop keeps routing, never closes out).
    setRounds(ws, { review: 1, fix: 1 });
    writeFix(ws, 1);
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-re-review");
    // re-review still blocker → another fix round (loop regression: no early terminal state).
    setRounds(ws, { review: 2, fix: 1 });
    writeReview(ws, 2, "CHANGES_REQUESTED", ["blocker"]);
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-fix");
    // addressing fix 2 → then re-review …
    setRounds(ws, { review: 2, fix: 2 });
    writeFix(ws, 2);
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-re-review");
    // … only a clean review closes the loop → complete.
    setRounds(ws, { review: 3, fix: 2 });
    writeReview(ws, 3, "APPROVED", []);
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("complete");
  });

  it("S2 收口态: REVIEW_FIX review（warn-only）+ no fix on record → needs-fix（fix 路由与 needs-fix 同 gate, 零行为改动）", () => {
    const ws = workspace(ROUNDS({ review: 1 }));
    writeReview(ws, 1, "REVIEW_FIX", ["warn"]);
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-fix");
  });

  it("S2 收口态 → cdd fix --findings → complete 无 re-review: REVIEW_FIX review + addressing fix APPROVED → complete（非 needs-re-review）", () => {
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeReview(ws, 1, "REVIEW_FIX", ["warn", "nit"]);
    writeFix(ws, 1);
    // the closure-state fix routes to complete — never a re-review (distinct from S1 needs-fix → needs-re-review).
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("complete");
  });

  it("S2 收口态: REVIEW_FIX review + addressing fix dead（EXECUTION_FAILURE）→ resume-pending", () => {
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeReview(ws, 1, "REVIEW_FIX", ["warn"]);
    writeHandoff(ws, "tasks-1-fix-1.json", {
      tasks: [1],
      phase: "fix",
      status: "BLOCKED",
      failure_category: "EXECUTION_FAILURE",
      findings: [],
      artifacts: {},
    });
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("resume-pending");
  });

  it("S2 收口态 discriminator: REVIEW_FIX review + addressing fix BLOCKED（非 dead 未落地）→ needs-fix（收口 fix 不吞终态, 与 S1 判别器同则）", () => {
    const ws = workspace(ROUNDS({ review: 1, fix: 1 }));
    writeReview(ws, 1, "REVIEW_FIX", ["warn"]);
    writeHandoff(ws, "tasks-1-fix-1.json", {
      tasks: [1],
      phase: "fix",
      status: "BLOCKED",
      blocker: "handoff write failure — fix not landed",
      findings: [],
      artifacts: {},
    });
    // the closure fix declares BLOCKED (not dead, not APPROVED) → has not landed → needs-fix (re-dispatch), never an early complete.
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-fix");
  });

  it("S2 收口态 discriminator: 收口 fix 先于最新 REVIEW_FIX review（fix 轮 < review 轮）→ 该 fix 不吞最新轮 → needs-fix", () => {
    // reviews=2, fixes=1: review-2's closure-state dispatch lands after fix-1 converged review-1 — the newest review
    // has no addressing fix of its own → needs-fix (dispatch fix-2), same rule as the S1 needs-fix discriminator.
    const ws = workspace(ROUNDS({ review: 2, fix: 1 }));
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "REVIEW_FIX",
      findings: [{ severity: "warn", summary: "w" }],
      artifacts: {},
    });
    writeFix(ws, 1);
    writeReview(ws, 2, "REVIEW_FIX", ["nit"]);
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("needs-fix");
  });

  it("S3 零 finding fast path: review APPROVED（空 findings）→ complete（直通, 无需 fix 轮, 不变）", () => {
    const ws = workspace(ROUNDS({ review: 1 }));
    writeReview(ws, 1, "APPROVED", []);
    expect(statusJudge.deriveTaskState(ws, 1)).toBe("complete");
    // no fix is required after an APPROVED review — the plan-level straight-through is already covered by derivePlanVerdict's green path.
  });

  it("S2 收口态 merged-group: 组载体的 REVIEW_FIX + 收口 fix → 组成员 complete（无 re-review）", () => {
    const ws = workspace({ plan: "", tasks: [{ group: "1,2", rounds: { review: 1, fix: 1 } }] });
    const group = TaskGroup.fromNumbers([1, 2]);
    const key = group.key();
    writeHandoff(ws, `tasks-${key}-implement.json`, {
      tasks: [1, 2],
      phase: "implement",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    writeHandoff(ws, `tasks-${key}-review-1.json`, {
      tasks: [1, 2],
      phase: "review",
      status: "REVIEW_FIX",
      findings: [{ severity: "warn", summary: "w" }],
      artifacts: {},
    });
    writeHandoff(ws, `tasks-${key}-fix-1.json`, {
      tasks: [1, 2],
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    // the group carrier's closure-state fix takes every member to complete without a re-review (merged-group convergence, P4.3/P4.4).
    expect(statusJudge.deriveTaskState(ws, 1, [group])).toBe("complete");
    expect(statusJudge.deriveTaskState(ws, 2, [group])).toBe("complete");
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
      writeHandoff(ws, `tasks-${n}-review-1.json`, {
        tasks: [n],
        phase: "review",
        status: "APPROVED",
        findings: [],
        artifacts: {},
      });
    }
    const v: PlanVerdict = statusJudge.derivePlanVerdict(plan, ws, extractTasks, singletonGroups);
    expect(v.done).toBe(true);
    expect(v).toEqual({ total: 2, complete: 2, pending: [], done: true });
    expect(statusJudge.formatPlanVerdict(v)).toBe("plan done (2/2 complete)");
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
    writeHandoff(ws, "tasks-1-review-1.json", {
      tasks: [1],
      phase: "review",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    // task 2: review CHANGES_REQUESTED → fix APPROVED → needs-re-review (six-state convergence evidence)
    writeHandoff(ws, "tasks-2-review-1.json", {
      tasks: [2],
      phase: "review",
      status: "CHANGES_REQUESTED",
      findings: [{ severity: "blocker" }],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-2-fix-1.json", {
      tasks: [2],
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    const v: PlanVerdict = statusJudge.derivePlanVerdict(plan, ws, extractTasks, singletonGroups);
    expect(v.done).toBe(false);
    expect(v).toEqual({
      total: 2,
      complete: 1,
      pending: [{ task: 2, state: "needs-re-review" }],
      done: false,
    });
    expect(statusJudge.formatPlanVerdict(v)).toBe(
      "1/2 complete — pending: task 2 (needs-re-review)",
    );
  });

  it("per-task state line formatting (the CDD_INFO line)", () => {
    expect(statusJudge.formatTaskStateLine(7, "needs-fix")).toBe("task 7 state: needs-fix");
    expect(statusJudge.formatTaskStateLine(3, "complete")).toBe("task 3 state: complete");
  });
});

describe("derivePlanVerdict — group iteration (P4.3 Task 3: the effectiveGroups single derivation)", () => {
  it("empty-default iteration: per-task singletons — the no-taskGroups effectiveGroups — yield the pre-P4.3 verdict unchanged", () => {
    const plan = planFile("# Plan\n\n### Task 1: a\nbody\n\n### Task 2: b\nbody\n");
    const ws = workspace({
      plan: "",
      tasks: [
        { task: 1, rounds: { review: 1 } },
        { task: 2, rounds: { review: 1 } },
      ],
    });
    for (const n of [1, 2]) {
      writeHandoff(ws, `tasks-${n}-review-1.json`, {
        tasks: [n],
        phase: "review",
        status: "APPROVED",
        findings: [],
        artifacts: {},
      });
    }
    // A no-taskGroups plan's effectiveGroups is the per-task singletons (pinned at the derivation
    // in documents.test.ts). This surface consumes it as the injected extractor and yields the
    // pre-P4.3 per-task iteration exactly (the zero-migration property — the verdict module carries
    // no singleton fallback of its own, so no caller can drift off the single derivation).
    expect(statusJudge.derivePlanVerdict(plan, ws, extractTasks, singletonGroups)).toEqual({
      total: 2,
      complete: 2,
      pending: [],
      done: true,
    });
  });

  it("declared merged groups → the verdict iterates the group union (the group is the dispatch unit)", () => {
    const plan = planFile("# Plan\n\n### Task 1: a\nbody\n\n### Task 2: b\nbody\n");
    const ws = workspace(EMPTY_PROGRESS);
    // mirror taskGroupsFromPlan for a merged `- **Task 1, 2**:` section
    const mergedGroups = (_planPath: string) => [TaskGroup.fromNumbers([1, 2])];
    const v = statusJudge.derivePlanVerdict(plan, ws, extractTasks, mergedGroups);
    expect(v.total).toBe(2);
    expect(v.done).toBe(false);
    expect(v.pending).toEqual([
      { task: 1, state: "in-flight" },
      { task: 2, state: "in-flight" },
    ]);
    expect(statusJudge.formatPlanVerdict(v)).toBe(
      "0/2 complete — pending: task 1 (in-flight), task 2 (in-flight)",
    );
  });

  it("declared merged groups converge: a fully reviewed group reaches done (the planComplete green path)", () => {
    const plan = planFile("# Plan\n\n### Task 1: a\nbody\n\n### Task 2: b\nbody\n");
    const ws = workspace({ plan: "", tasks: [{ group: "1,2", rounds: { review: 1 } }] });
    writeHandoff(ws, "tasks-1,2-implement.json", {
      tasks: [1, 2],
      phase: "implement",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    writeHandoff(ws, "tasks-1,2-review-1.json", {
      tasks: [1, 2],
      phase: "review",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    const mergedGroups = (_planPath: string) => [TaskGroup.fromNumbers([1, 2])];
    const v = statusJudge.derivePlanVerdict(plan, ws, extractTasks, mergedGroups);
    expect(v.done).toBe(true);
    expect(v).toEqual({ total: 2, complete: 2, pending: [], done: true });
    expect(statusJudge.formatPlanVerdict(v)).toBe("plan done (2/2 complete)");
  });

  it("declared merged groups, implement APPROVED only → members need review, not done", () => {
    const plan = planFile("# Plan\n\n### Task 1: a\nbody\n\n### Task 2: b\nbody\n");
    const ws = workspace({ plan: "", tasks: [{ group: "1,2", rounds: {} }] });
    writeHandoff(ws, "tasks-1,2-implement.json", {
      tasks: [1, 2],
      phase: "implement",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    });
    const mergedGroups = (_planPath: string) => [TaskGroup.fromNumbers([1, 2])];
    const v = statusJudge.derivePlanVerdict(plan, ws, extractTasks, mergedGroups);
    expect(v.done).toBe(false);
    expect(v).toEqual({
      total: 2,
      complete: 0,
      pending: [
        { task: 1, state: "needs-review" },
        { task: 2, state: "needs-review" },
      ],
      done: false,
    });
  });
});
