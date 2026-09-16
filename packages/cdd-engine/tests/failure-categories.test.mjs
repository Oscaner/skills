// packages/cdd-engine/tests/failure-categories.test.mjs — T6 两组：
// ① failure-categories.json canonical 承重（内容 + lib/failure.mjs 读取点导出，AC14「承重，非装饰」）；
// ② reviewStoppingGuard 未完成-dispatch 排除（AC7 的机械证据，B3 的控制流修法落点）。
import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { reviewStoppingGuard } from "../lib/cli/shared.mjs";
import { ExitRequested } from "../lib/exit.mjs";
import { incrementFailureCounter, exhaustedBlocker, maybeExhaust } from "../lib/runner/run-task.mjs";
import {
  FAILURE_CATEGORIES,
  counterFor,
  terminalFor,
  isIncompleteDispatch,
  counters,
} from "../lib/failure.mjs";

const CAT = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../templates/failure-categories.json"), "utf8"),
);

describe("failure-categories canonical", () => {
  it("六类齐备且仅 EXECUTION_FAILURE 消耗 engineRecoveryCount", () => {
    const ids = CAT.categories.map(c => c.id).sort();
    expect(ids).toEqual(["CONTRACT_VIOLATION","ENGINE_SELF_WRITTEN","EXECUTION_FAILURE","PLAN_CONFLICT","TIMEOUT","UNVERIFIABLE"]);
    const recovery = CAT.categories.filter(c => c.counter === "engineRecoveryCount");
    expect(recovery.map(c => c.id)).toEqual(["EXECUTION_FAILURE"]);
  });
  it("六类均不计入 Review Stopping", () => {
    expect(CAT.categories.every(c => c.countsTowardStopping === false)).toBe(true);
  });
  it("lib/failure.mjs 承重读取：导出与 canonical 逐字一致（AC14）", () => {
    const ids = CAT.categories.map(c => c.id);
    // FAILURE_CATEGORIES 键集 = canonical 六 id（无法达的引用在引擎入口立即炸出，非装饰）
    expect(Object.keys(FAILURE_CATEGORIES).sort()).toEqual([...ids].sort());
    // counterFor：四计数器类目 → canonical 字段名；无计数器类目（UNVERIFIABLE / PLAN_CONFLICT）→ null
    expect(counterFor("TIMEOUT")).toBe("timeoutCount");
    expect(counterFor("CONTRACT_VIOLATION")).toBe("contractViolationCount");
    expect(counterFor("ENGINE_SELF_WRITTEN")).toBe("engineSelfWrittenCount");
    expect(counterFor("EXECUTION_FAILURE")).toBe("engineRecoveryCount");
    expect(counterFor("UNVERIFIABLE")).toBe(null);
    expect(counterFor("PLAN_CONFLICT")).toBe(null);
    // terminalFor：终态文案与 canonical 列逐字一致（EXECUTION_FAILURE 的终态是 engine-error，非 -exhausted）
    expect(terminalFor("TIMEOUT")).toBe("BLOCKED: timeout-exhausted");
    expect(terminalFor("CONTRACT_VIOLATION")).toBe("BLOCKED: contract-violation-exhausted");
    expect(terminalFor("ENGINE_SELF_WRITTEN")).toBe("BLOCKED: engine-self-written-exhausted");
    expect(terminalFor("EXECUTION_FAILURE")).toBe("BLOCKED: engine-error");
    expect(terminalFor("UNVERIFIABLE")).toBe(null);
    expect(terminalFor("PLAN_CONFLICT")).toBe(null);
    // isIncompleteDispatch：仅 ENGINE_SELF_WRITTEN / CONTRACT_VIOLATION（canonical dispatchIncomplete 派生）
    const incomplete = ids.filter(id => isIncompleteDispatch(id)).sort();
    expect(incomplete).toEqual(["CONTRACT_VIOLATION", "ENGINE_SELF_WRITTEN"]);
    // counters()：四计数器类目按表内序（T7 h1CountersLine 的取值面；标签不机械派生自字段名）
    expect(counters()).toEqual([
      { field: "timeoutCount", label: "timeout" },
      { field: "contractViolationCount", label: "contract-violation" },
      { field: "engineSelfWrittenCount", label: "engine-self-written" },
      { field: "engineRecoveryCount", label: "recovery" },
    ]);
  });
});

describe("reviewStoppingGuard — 未完成 dispatch 排除", () => {
  // 断言面 = stoppedExit3 的退出码（ExitRequested.code）——与既有 cli-shared.test.mjs 的函数级
  // 断言同面；不取 isIncompleteDispatch 的返回值（判定源的单元测试 ≠「Stopping 控制流被修正」）。
  function exitCodeOf(fn) {
    try { fn(); return null; } catch (e) { return e instanceof ExitRequested ? e.code : `other:${e}`; }
  }
  // 三例同形：status APPROVED + failure_category 差 + blocker 0（findings 空 → blockerCount 0）
  const stoppingShaped = (failure_category) => ({ status: "APPROVED", failure_category, findings: [] });

  it("ENGINE_SELF_WRITTEN + APPROVED + blocker 0 → 不 exit 3（dispatch 未完成，排除生效）", () => {
    expect(exitCodeOf(() => reviewStoppingGuard(stoppingShaped("ENGINE_SELF_WRITTEN"), "task", 1, "plan"))).toBe(null);
  });
  it("CONTRACT_VIOLATION 同形 → 不 exit 3（第二条排除类目——只测一条则 canonical 另一条 dispatchIncomplete 无守卫）", () => {
    expect(exitCodeOf(() => reviewStoppingGuard(stoppingShaped("CONTRACT_VIOLATION"), "task", 1, "plan"))).toBe(null);
  });
  it("对照组 EXECUTION_FAILURE 同形 → 仍 exit 3（非排除类目——缺此例则「排除」退化为凡带 failure_category 即不 exit 3）", () => {
    expect(exitCodeOf(() => reviewStoppingGuard(stoppingShaped("EXECUTION_FAILURE"), "task", 1, "plan"))).toBe(3);
  });
});

// branch-review finding（P4）：T6 终态门只 increment 不消费 —— 补引擎侧「计数 ≥2 → <category>-exhausted」。
describe("run-task 终态门（branch-review finding 补）", () => {
  function seed(dir) {
    writeFileSync(path.join(dir, "progress.json"), JSON.stringify({plan:"",timeoutCount:0,engineRecoveryCount:0,contractViolationCount:0,engineSelfWrittenCount:0,tasks:[]}));
  }
  it("incrementFailureCounter 返回新计数（首犯 1 / 再犯 2）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "failterm-"));
    try {
      seed(dir);
      expect(incrementFailureCounter(dir, "CONTRACT_VIOLATION")).toBe(1);
      expect(incrementFailureCounter(dir, "CONTRACT_VIOLATION")).toBe(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("exhaustedBlocker 仅计数 ≥2 触发且携带终态语汇", () => {
    expect(exhaustedBlocker("TIMEOUT", 1)).toBeNull();
    expect(exhaustedBlocker("TIMEOUT", 2)).toMatch(/TIMEOUT-exhausted/);
  });
  it("maybeExhaust 在阈值处覆盖 handoff blocker 为终态形（第 1 次不动 / 第 2 次终态）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "failterm2-"));
    try {
      seed(dir);
      const h = path.join(dir, "t-handoff.json");
      writeFileSync(h, JSON.stringify({status:"BLOCKED",phase:"review",findings:[],artifacts:{},blocker:"handoff schema invalid"}));
      maybeExhaust(dir, "CONTRACT_VIOLATION", h);
      expect(JSON.parse(readFileSync(h, "utf8")).blocker).toBe("handoff schema invalid");
      maybeExhaust(dir, "CONTRACT_VIOLATION", h);
      expect(JSON.parse(readFileSync(h, "utf8")).blocker).toMatch(/CONTRACT_VIOLATION-exhausted/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
