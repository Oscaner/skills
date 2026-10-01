// packages/cdd-engine/src/cli/__tests__/result-face.test.ts
// Seam: the ALL-OP stdout result face (C5 command-contract plane, spec D1-D3) — the single capsule
// `status: <axis> · blocker: <n> · handoff: <path>` + the optional `next:` suggestion line. The
// blocker count reuses the canonical Convergence single source
// (rules/convergence.ts#blockerCount — findings with severity "blocker"), so this test pins the
// Ø-face reading, never a duplicate count.
// T3 migration: the former docsResultFace 4 cases (status/blocker/handoff line) migrate to the
// ResultFace single-capsule assertions — pinning BOTH axes (review judgment + implement/fix work)
// and the fix decision-source blocker (`--findings` input count). No old/new file coexistence.
import { describe, expect, it } from "vitest";
import { ResultFace } from "../../rules/result-face.ts";

const H = "/repo/.osuperpowers/cdd/foo/spec-review-1.json";

describe("rules/result-face.ts — review judgment axis (C5 D1)", () => {
  it("review: empty findings → status: APPROVED · blocker: 0 · handoff: <path> (single capsule)", () => {
    const lines = new ResultFace().emit({
      op: "review",
      handoffPath: H,
      status: "APPROVED",
      findings: [],
    });
    expect(lines).toEqual([`status: APPROVED · blocker: 0 · handoff: ${H}`]);
  });

  it("review 判定轴: blocker-severity findings → status: CHANGES_REQUESTED · blocker: <own count>", () => {
    const lines = new ResultFace().emit({
      op: "review",
      handoffPath: H,
      status: "CHANGES_REQUESTED",
      findings: [
        { severity: "blocker", summary: "b1" },
        { severity: "blocker", summary: "b2" },
        { severity: "warn", summary: "w" },
      ],
    });
    expect(lines[0]).toBe(`status: CHANGES_REQUESTED · blocker: 2 · handoff: ${H}`);
  });

  it("review REVIEW_FIX 收口态: warn/nit-only → status: REVIEW_FIX · blocker: 0", () => {
    const lines = new ResultFace().emit({
      op: "review",
      handoffPath: H,
      status: "REVIEW_FIX",
      findings: [
        { severity: "warn", summary: "w" },
        { severity: "nit", summary: "n" },
      ],
    });
    expect(lines[0]).toBe(`status: REVIEW_FIX · blocker: 0 · handoff: ${H}`);
  });

  it("review BLOCKED conclusion (unverifiable lane) passes through + no next: line", () => {
    const lines = new ResultFace().emit({
      op: "review",
      handoffPath: H,
      status: "BLOCKED",
      findings: [],
    });
    expect(lines).toEqual([`status: BLOCKED · blocker: 0 · handoff: ${H}`]);
  });
});

describe("rules/result-face.ts — work axis + decision-source blocker (C5 D2/D3)", () => {
  it("implement: no judgment source → status: COMPLETED · blocker: 0 (spec D2)", () => {
    const lines = new ResultFace().emit({ op: "implement", handoffPath: H, status: "APPROVED" });
    expect(lines[0]).toBe(`status: COMPLETED · blocker: 0 · handoff: ${H}`);
  });

  it("fix: blocker: = the --findings INPUT review count (the decision source — never the fix's own empty carrier)", () => {
    const lines = new ResultFace().emit({
      op: "fix",
      handoffPath: H,
      status: "APPROVED",
      findings: [
        { severity: "blocker", summary: "b" },
        { severity: "blocker", summary: "b2" },
      ],
    });
    expect(lines[0]).toBe(`status: COMPLETED · blocker: 2 · handoff: ${H}`);
  });

  it("fix: warn/nit-only input → COMPLETED + blocker 0 + closure next: none", () => {
    const lines = new ResultFace().emit({
      op: "fix",
      handoffPath: H,
      status: "APPROVED",
      findings: [{ severity: "warn", summary: "w" }],
      next: {
        op: "fix",
        type: "task",
        group: "1",
        plan: "/repo/plan.md",
        status: "APPROVED",
        findings: [{ severity: "warn" }],
      },
    });
    expect(lines).toEqual([`status: COMPLETED · blocker: 0 · handoff: ${H}`, "next: none"]);
  });

  it("work axis BLOCKED: a declared BLOCKED work round folds to BLOCKED + no next: line", () => {
    const lines = new ResultFace().emit({
      op: "fix",
      handoffPath: H,
      status: "BLOCKED",
      findings: [],
      next: { op: "fix", type: "task", status: "BLOCKED" },
    });
    expect(lines).toEqual([`status: BLOCKED · blocker: 0 · handoff: ${H}`]);
  });
});

describe("rules/result-face.ts — the next: suggestion line rides the capsule (C5)", () => {
  it("review one-way → cdd fix (findings non-empty), same capsule", () => {
    const lines = new ResultFace().emit({
      op: "review",
      handoffPath: H,
      status: "CHANGES_REQUESTED",
      findings: [{ severity: "blocker" }],
      next: {
        op: "review",
        type: "spec",
        doc: "/repo/spec.md",
        status: "CHANGES_REQUESTED",
        findings: [{ severity: "blocker" }],
        findingsPath: H,
      },
    });
    expect(lines).toEqual([
      `status: CHANGES_REQUESTED · blocker: 1 · handoff: ${H}`,
      `next: cdd fix --type spec --spec /repo/spec.md --findings ${H}`,
    ]);
  });

  it("absent next args (failure lane) → no next: line — the capsule alone", () => {
    const lines = new ResultFace().emit({ op: "review", handoffPath: H, status: "BLOCKED" });
    expect(lines).toHaveLength(1);
  });
});
