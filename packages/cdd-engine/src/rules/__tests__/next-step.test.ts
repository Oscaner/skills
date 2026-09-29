// packages/cdd-engine/src/rules/__tests__/next-step.test.ts
// C5 next-step derivation (`next:` output face, spec C5-1 decision table) — the pure unit
// surface: every row of NextStepRouter#next is pinned here (suggestion semantics C5-0, zero new CLI
// params C5-2, BLOCKED → no line). Row-by-row mirror of the module header table. T3: migrated to
// instance-method assertions (the decision table rows are preserved one by one).
import { describe, expect, it } from "vitest";
import { NextStepRouter, SOFT_CAP_S1_ROUNDS } from "../next-step.ts";

const PLAN = "/repo/plan.md";
const H = "/repo/.osuperpowers/cdd/fixture/tasks-1-review-1.json";
const DOC = "/repo/spec.md";

describe("rules/next-step.ts — review face (C5-1 one-way)", () => {
  it("review task with findings (blocker severity) → one-way cdd fix line", () => {
    expect(
      new NextStepRouter().next({
        op: "review",
        type: "task",
        group: "1",
        plan: PLAN,
        status: "CHANGES_REQUESTED",
        findings: [{ severity: "blocker", summary: "b" }],
        findingsPath: H,
      }),
    ).toBe(`cdd fix --type task --tasks 1 --plan ${PLAN} --findings ${H}`);
  });

  it("review task with warn/nit findings → same one-way fix line (severity does not branch the review)", () => {
    expect(
      new NextStepRouter().next({
        op: "review",
        type: "task",
        group: "1",
        plan: PLAN,
        status: "REVIEW_FIX",
        findings: [{ severity: "warn" }, { severity: "nit" }],
        findingsPath: H,
      }),
    ).toBe(`cdd fix --type task --tasks 1 --plan ${PLAN} --findings ${H}`);
  });

  it("review spec with findings → type-self-describing --spec target", () => {
    expect(
      new NextStepRouter().next({
        op: "review",
        type: "spec",
        doc: DOC,
        findings: [{ severity: "blocker" }],
        findingsPath: "/repo/.osuperpowers/cdd/fixture/review.spec.1.json",
      }),
    ).toBe(
      "cdd fix --type spec --spec /repo/spec.md --findings /repo/.osuperpowers/cdd/fixture/review.spec.1.json",
    );
  });

  it("review plan with findings → type-self-describing --plan target", () => {
    expect(
      new NextStepRouter().next({
        op: "review",
        type: "plan",
        doc: "/repo/plan.md",
        findings: [{ severity: "blocker" }],
        findingsPath: "/repo/.osuperpowers/cdd/fixture/review.plan.1.json",
      }),
    ).toBe(
      "cdd fix --type plan --plan /repo/plan.md --findings /repo/.osuperpowers/cdd/fixture/review.plan.1.json",
    );
  });

  it("review branch with findings → branch fix line (no --tasks)", () => {
    expect(
      new NextStepRouter().next({
        op: "review",
        type: "branch",
        plan: PLAN,
        findings: [{ severity: "blocker" }],
        findingsPath: "/repo/.osuperpowers/cdd/fixture/branch-review-abc1234..def5678-r1.json",
      }),
    ).toBe(
      "cdd fix --type branch --plan /repo/plan.md --findings /repo/.osuperpowers/cdd/fixture/branch-review-abc1234..def5678-r1.json",
    );
  });
});

describe("rules/next-step.ts — review zero-findings terminal (approved)", () => {
  it("task review zero findings + a remaining group → next-group implement", () => {
    expect(
      new NextStepRouter().next({
        op: "review",
        type: "task",
        group: "1",
        nextGroup: "2",
        plan: PLAN,
        findings: [],
        status: "APPROVED",
      }),
    ).toBe(`cdd implement --tasks 2 --plan ${PLAN}`);
  });

  it("task review zero findings + all groups done → terminal branch review", () => {
    expect(
      new NextStepRouter().next({
        op: "review",
        type: "task",
        group: "1",
        allGroupsDone: true,
        plan: PLAN,
        findings: [],
        status: "APPROVED",
      }),
    ).toBe(`cdd review --type branch --plan ${PLAN}`);
  });

  it("task review zero findings + all groups done + known range → branch review with base/head", () => {
    expect(
      new NextStepRouter().next({
        op: "review",
        type: "task",
        group: "1",
        allGroupsDone: true,
        plan: PLAN,
        base: "abc1234",
        head: "def5678",
        findings: [],
        status: "APPROVED",
      }),
    ).toBe(`cdd review --type branch --plan ${PLAN} --base abc1234 --head def5678`);
  });

  it("task review zero findings + no remaining-group facts → none (conservative default)", () => {
    expect(
      new NextStepRouter().next({
        op: "review",
        type: "task",
        group: "1",
        plan: PLAN,
        findings: [],
        status: "APPROVED",
      }),
    ).toBe("none");
  });

  it("spec/plan/branch review zero findings → none", () => {
    for (const type of ["spec", "plan", "branch"] as const) {
      expect(
        new NextStepRouter().next({
          op: "review",
          type,
          plan: PLAN,
          findings: [],
          status: "APPROVED",
        }),
      ).toBe("none");
    }
  });
});

describe("rules/next-step.ts — fix face (C5-1 single decision point via --findings input)", () => {
  it("fix input findings with blocker>0 (task) → re-review line", () => {
    expect(
      new NextStepRouter().next({
        op: "fix",
        type: "task",
        group: "1",
        plan: PLAN,
        status: "APPROVED",
        findings: [{ severity: "blocker", summary: "b" }],
      }),
    ).toBe(`cdd review --type task --tasks 1 --plan ${PLAN}`);
  });

  it("fix input findings with blocker>0 (branch) → re-review with the range", () => {
    expect(
      new NextStepRouter().next({
        op: "fix",
        type: "branch",
        plan: PLAN,
        base: "abc1234",
        head: "def5678",
        status: "APPROVED",
        findings: [{ severity: "blocker" }],
      }),
    ).toBe(`cdd review --type branch --plan ${PLAN} --base abc1234 --head def5678`);
  });

  it("fix input findings with blocker>0 (spec) → re-review with --spec", () => {
    expect(
      new NextStepRouter().next({
        op: "fix",
        type: "spec",
        doc: DOC,
        status: "APPROVED",
        findings: [{ severity: "blocker" }],
      }),
    ).toBe("cdd review --type spec --spec /repo/spec.md");
  });

  it("fix input findings with blocker>0 (plan) → re-review with --plan", () => {
    expect(
      new NextStepRouter().next({
        op: "fix",
        type: "plan",
        doc: "/repo/other-plan.md",
        status: "APPROVED",
        findings: [{ severity: "blocker" }],
      }),
    ).toBe("cdd review --type plan --plan /repo/other-plan.md");
  });

  it("fix input findings warn/nit-only → none (收口轮自然化 — no re-review preview)", () => {
    expect(
      new NextStepRouter().next({
        op: "fix",
        type: "task",
        group: "1",
        plan: PLAN,
        status: "APPROVED",
        findings: [{ severity: "warn" }, { severity: "nit" }],
      }),
    ).toBe("none");
  });

  it("fix input zero findings → none", () => {
    expect(
      new NextStepRouter().next({
        op: "fix",
        type: "task",
        group: "1",
        plan: PLAN,
        status: "APPROVED",
        findings: [],
      }),
    ).toBe("none");
  });

  it("fix soft cap → BLOCKED: review-cycle-cap — user adjudicates", () => {
    expect(
      new NextStepRouter().next({
        op: "fix",
        type: "task",
        group: "1",
        plan: PLAN,
        status: "APPROVED",
        softCap: true,
        findings: [{ severity: "blocker" }],
      }),
    ).toBe("BLOCKED: review-cycle-cap — user adjudicates");
  });

  it("fix soft cap outranks the blocker>0 re-review row (the adjudication marker wins)", () => {
    expect(
      new NextStepRouter().next({
        op: "fix",
        type: "task",
        group: "1",
        plan: PLAN,
        status: "APPROVED",
        softCap: true,
        findings: [{ severity: "blocker" }],
      }),
    ).not.toMatch(/^cdd review/);
  });
});

describe("rules/next-step.ts — consecutive-S1 soft-cap basis (C5-1 'ref 序列轮次计数')", () => {
  const SOME = [{ severity: "blocker" }];
  const WARN = [{ severity: "warn" }];

  it("SOFT_CAP_S1_ROUNDS exports a production threshold (the fix faces compare against it)", () => {
    expect(SOFT_CAP_S1_ROUNDS).toBeGreaterThanOrEqual(2);
  });

  it("counts only the LEADING consecutive S1 rounds (newest first) and stops at the first non-S1", () => {
    expect(new NextStepRouter().consecutiveS1Count([SOME, SOME, SOME, WARN, SOME, SOME])).toBe(3);
  });

  it("a warn/nit-only (or empty) first round → 0 (no run started)", () => {
    expect(new NextStepRouter().consecutiveS1Count([WARN, SOME, SOME])).toBe(0);
    expect(new NextStepRouter().consecutiveS1Count([[], SOME])).toBe(0);
    expect(new NextStepRouter().consecutiveS1Count([])).toBe(0);
  });

  it("null/undefined/absent rounds end the run (unreadable history degrades, never throws)", () => {
    expect(new NextStepRouter().consecutiveS1Count([SOME, null, SOME])).toBe(1);
    expect(new NextStepRouter().consecutiveS1Count([undefined])).toBe(0);
  });
});

describe("rules/next-step.ts — implement + failure lanes", () => {
  it("implement APPROVED → the group's review is the next hop", () => {
    expect(
      new NextStepRouter().next({
        op: "implement",
        type: "task",
        group: "1",
        plan: PLAN,
        status: "APPROVED",
      }),
    ).toBe(`cdd review --type task --tasks 1 --plan ${PLAN}`);
  });

  it("BLOCKED status → null (no next: line — the failure-mode stderr face owns it)", () => {
    expect(
      new NextStepRouter().next({
        op: "review",
        type: "task",
        status: "BLOCKED",
        findings: [{ severity: "blocker" }],
      }),
    ).toBeNull();
    expect(
      new NextStepRouter().next({
        op: "fix",
        type: "task",
        status: "BLOCKED",
        findings: [{ severity: "blocker" }],
      }),
    ).toBeNull();
    expect(
      new NextStepRouter().next({ op: "implement", type: "task", status: "BLOCKED" }),
    ).toBeNull();
  });

  it("TIMEOUT status → null", () => {
    expect(new NextStepRouter().next({ op: "review", type: "task", status: "TIMEOUT" })).toBeNull();
  });

  it("unknown-type review falls through to the default (none)", () => {
    expect(
      new NextStepRouter().next({
        op: "review",
        type: "unknown" as never,
        findings: [{ severity: "blocker" }],
      }),
    ).toBe("none");
  });

  it("degraded facts (missing plan/group/doc) never render 'undefined' — the suggestion shortens", () => {
    const out = new NextStepRouter().next({
      op: "review",
      type: "task",
      findings: [{ severity: "blocker" }],
      findingsPath: H,
    });
    expect(out).toBe(`cdd fix --type task --findings ${H}`);
    expect(out).not.toContain("undefined");
  });
});
