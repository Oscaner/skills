// packages/cdd-engine/tests/context.test.mjs — context-contract canonical 承重（P4 T4）。
// 三断言面：① timeout 默认值取自 canonical；② per-mode env > 全局覆写（取整到 stepSeconds）；
// ③ env 白名单取自 canonical 且恰为 7 键（AC3 唯一声明点）。
import { describe, it, expect } from "vitest";
import { loadContract } from "../src/infra/context.mjs";
import { resolveTimeoutMs } from "../src/infra/invoke.mjs";

describe("context-contract canonical 承重", () => {
  it("timeout 默认值取自 canonical", () => {
    const c = loadContract();
    expect(c.timeouts.defaults.task).toBe(5_400_000);
    expect(c.timeouts.defaults.review).toBe(3_600_000);
    expect(resolveTimeoutMs({}, "task")).toBe(c.timeouts.defaults.task);
    expect(resolveTimeoutMs({}, "review")).toBe(c.timeouts.defaults.review);
  });
  it("per-mode env 优先于全局覆写、全局覆写取整到 stepSeconds（canonical 有声明落点）", () => {
    const c = loadContract();
    expect(c.timeouts.perModeOverride).toEqual({ unit: "seconds", env: { task: "CDD_TASK_TIMEOUT", review: "CDD_REVIEW_TIMEOUT" } });
    expect(resolveTimeoutMs({ CDD_TASK_TIMEOUT: "60", CDD_CLI_TIMEOUT: "3600" }, "task")).toBe(60_000);   // per-mode 胜
    expect(resolveTimeoutMs({ CDD_CLI_TIMEOUT: "3600" }, "task")).toBe(3_600_000);                        // 全局覆写
    expect(resolveTimeoutMs({ CDD_CLI_TIMEOUT: "100" }, "task")).toBe(1_800_000);                         // ceil(100/1800)*1800 s
  });
  it("env 白名单取自 canonical 且恰为 7 键（AC3 唯一声明点）", () => {
    const c = loadContract();
    const keys = Object.values(c.channels.env).flatMap(v => (v.var ? [v.var] : v.markers));
    expect(keys.sort()).toEqual(["AI_AGENT", "CDD_CLI_TIMEOUT", "CDD_REVIEW_TIMEOUT", "CDD_TASK_TIMEOUT",
                                 "CLAUDE_CODE_SESSION_ID", "CURSOR_TRACE_ID", "PATH"]);
  });
  // 「运行期 context 零落盘」断言**不在本文件**——由 T8 的 `collectChannelAuditHits()` 承担（见 T8 Produces 表 ⑧ 行）；
  // 此处不设占位断言（恒真断言违反 Global Constraints 的「测试断言禁假绿」）。
});