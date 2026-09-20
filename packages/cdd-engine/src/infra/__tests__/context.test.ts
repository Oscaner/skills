// packages/cdd-engine/src/infra/__tests__/context.test.ts
// 三断言面：① timeout 默认值取自 canonical；② 统一 resolver（resolveTerminationConfig）的默认值/
// seam 覆写契约——env 零读取（T26 删除面：CDD_* env 键与 perModeOverride/globalOverride 已删）；
// ③ env 白名单取自 canonical 且恰为 4 键（AC3 唯一声明点）。
import { describe, it, expect } from "vitest";
import { loadContract } from "../context.ts";
import { resolveTerminationConfig } from "../invoke.ts";

describe("context-contract canonical 承重", () => {
  it("timeout 默认值取自 canonical", () => {
    const c = loadContract();
    expect(c.timeouts.defaults.task).toBe(5_400_000);
    expect(c.timeouts.defaults.review).toBe(3_600_000);
    expect(resolveTerminationConfig("task").budgetMs).toBe(c.timeouts.defaults.task);
    expect(resolveTerminationConfig("review").budgetMs).toBe(c.timeouts.defaults.review);
  });
  it("统一 resolver：seam overrides 优先、stall 节奏同读 canonical timeouts.liveness、未知 mode → budget 缺省", () => {
    const c = loadContract();
    // seam 覆写（opts.termination）优先于 canonical 默认——测试注入面不依赖任何 env 读取
    expect(resolveTerminationConfig("task", { budgetMs: 42 }).budgetMs).toBe(42);
    expect(resolveTerminationConfig("review", { budgetMs: 1000 }).budgetMs).toBe(1000);
    // stall 节奏（sampleIntervalMs / idleWindowMs）同源 canonical timeouts.liveness
    const cfg = resolveTerminationConfig("task");
    expect(cfg.sampleIntervalMs).toBe(c.timeouts.liveness.sampleIntervalMs);
    expect(cfg.idleWindowMs).toBe(c.timeouts.liveness.idleWindowMs);
    // seam 覆写同样作用于 stall 节奏
    expect(resolveTerminationConfig("task", { idleWindowMs: 500 }).idleWindowMs).toBe(500);
    // 未知 mode：budget 缺省（undefined）——默认仅对已声明 mode 生效
    expect(resolveTerminationConfig("unknown").budgetMs).toBeUndefined();
  });
  it("env 白名单取自 canonical 且恰为 4 键（AC3 唯一声明点）", () => {
    const c = loadContract();
    const keys = Object.values(c.channels.env).flatMap(v => (v.var ? [v.var] : v.markers));
    expect(keys.sort()).toEqual(["AI_AGENT", "CLAUDE_CODE_SESSION_ID", "CURSOR_TRACE_ID", "PATH"]);
  });
  // 「运行期 context 零落盘」断言**不在本文件**——由 T8 的 `collectChannelAuditHits()` 承担（见 T8 Produces 表 ⑧ 行）；
  // 此处不设占位断言（恒真断言违反 Global Constraints 的「测试断言禁假绿」）。
});
