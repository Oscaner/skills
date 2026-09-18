// packages/cdd-engine/src/rules/__tests__/rules.stopping.test.ts
// Review Stopping guard cluster (blockerCount / stoppedExit3 / reviewStoppingGuard /
// reviewStoppedError) — self-contained per the closure-completeness ownership rule the legacy
// cli/shared.mjs documents. Same function-level seam as cli-shared.test.mjs +
// failure-categories.test.mjs (assertion surface = ExitRequested.code from stoppedExit3), which
// keep guarding the legacy .mjs copies.
import { describe, it, expect } from "vitest";

import {
  blockerCount,
  stoppedExit3,
  reviewStoppingGuard,
  reviewStoppedError,
} from "../stopping.ts";
import { ExitRequested } from "../../infra/exit.ts";

function exitCodeOf(fn: () => void): number | null | string {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof ExitRequested ? e.code : `other:${(e as Error).message}`;
  }
}

describe("rules/stopping.ts — blockerCount", () => {
  it("只数 blocker severity（warn/nit 不计）", () => {
    expect(
      blockerCount({ findings: [{ severity: "warn" }, { severity: "nit" }, { severity: "blocker" }, { severity: "blocker" }] }),
    ).toBe(2);
  });

  it("findings 缺失 / 空 → 0", () => {
    expect(blockerCount({})).toBe(0);
    expect(blockerCount({ findings: [] })).toBe(0);
    expect(blockerCount(null)).toBe(0);
  });

  it("缺 severity 的 finding 不计", () => {
    expect(blockerCount({ findings: [{ summary: "no severity" }, { severity: "blocker" }] })).toBe(1);
  });
});

describe("rules/stopping.ts — reviewStoppedError（reason 分场景消息）", () => {
  it("缺省文案含 Review Stopping: 与 /blocker=0/ 不变量", () => {
    expect(reviewStoppedError("task", 2, "plan").message).toMatch(/Review Stopping:/);
    expect(reviewStoppedError("task", 2, "plan").message).toContain("already blocker=0");
  });

  it('reason=legacy → pre-content-hash review handoff 指引', () => {
    const e = reviewStoppedError("spec", 1, "doc.md", { reason: "legacy" });
    expect(e.message).toMatch(/pre-content-hash review handoff/);
    expect(e.message).toContain("round 1");
  });

  it('reason=unchanged → doc content unchanged since round N', () => {
    const e = reviewStoppedError("plan", 3, "plan.md", { reason: "unchanged" });
    expect(e.message).toMatch(/doc content unchanged since round 2 clean review/);
  });
});

describe("rules/stopping.ts — stoppedExit3（ExitRequested.code = 3）", () => {
  it("抛 ExitRequested(3)，stderr 含错误消息", () => {
    const code = exitCodeOf(() => stoppedExit3("task", 1, "plan", "stale blocker"));
    expect(code).toBe(3);
  });
});

describe("rules/stopping.ts — reviewStoppingGuard（Review Stopping 判定）", () => {
  // 三例同形（复刻 failure-categories.test.mjs）：status APPROVED + failure_category 差 + findings 空
  const stoppingShaped = (failure_category: string) => ({ status: "APPROVED", failure_category, findings: [] });

  it("APPROVED + blocker 0 → exit 3（停）", () => {
    expect(exitCodeOf(() => reviewStoppingGuard({ status: "APPROVED", findings: [] }, "task", 1, "plan"))).toBe(3);
  });

  it("prev null / undefined → 不停", () => {
    expect(exitCodeOf(() => reviewStoppingGuard(null, "task", 1, "plan"))).toBe(null);
  });

  it("SP-4: BLOCKED/TIMEOUT 失败轮（findings:[]）→ 不停（须可重派）", () => {
    expect(exitCodeOf(() => reviewStoppingGuard({ status: "BLOCKED", findings: [] }, "task", 1, "plan"))).toBe(null);
    expect(exitCodeOf(() => reviewStoppingGuard({ status: "TIMEOUT", findings: [] }, "task", 1, "plan"))).toBe(null);
  });

  it("APPROVED + blocker > 0 → 不停", () => {
    expect(
      exitCodeOf(() => reviewStoppingGuard({ status: "APPROVED", findings: [{ severity: "blocker" }] }, "task", 1, "plan")),
    ).toBe(null);
  });

  it("未完成 dispatch 排除：ENGINE_SELF_WRITTEN / CONTRACT_VIOLATION + APPROVED + blocker 0 → 不 exit 3", () => {
    expect(exitCodeOf(() => reviewStoppingGuard(stoppingShaped("ENGINE_SELF_WRITTEN"), "task", 1, "plan"))).toBe(null);
    expect(exitCodeOf(() => reviewStoppingGuard(stoppingShaped("CONTRACT_VIOLATION"), "task", 1, "plan"))).toBe(null);
  });

  it("对照组 EXECUTION_FAILURE 同形 → 仍 exit 3（非排除类目）", () => {
    expect(exitCodeOf(() => reviewStoppingGuard(stoppingShaped("EXECUTION_FAILURE"), "task", 1, "plan"))).toBe(3);
  });
});