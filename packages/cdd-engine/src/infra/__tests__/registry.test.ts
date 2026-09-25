// engine/tests/registry.test.mjs — T1: harness-registry 模块单测（Node port）。
// 从 cdd-common-functions.test.sh（cdd_check_harness / _cdd_registry_field）与
// registry-schema.test.sh 移植行为断言。ship gate 语义：
//   unknown / not-supported → blocked（exitCode 1）；CLI 存在校验失败 → cli-missing（exitCode 2）。
// 真实 claude 二进制不在 PATH 的 CI 上，ship-gate 通过用例用 dryRun 跳过 CLI 校验（确定性）。
import { expect, it } from "vitest";

import { REG_PATH, Registry } from "../registry.ts";

const registry = new Registry();

it("loadRegistry: 读取 2 harness（T2 收敛 claude/cursor-agent）", () => {
  const reg = registry.load(REG_PATH);
  expect(Object.keys(reg).length).toBe(2);
  for (const name of ["claude", "cursor-agent"]) {
    expect(reg[name]).toBeTruthy();
  }
});

// The harness selection/probe/install layer is deleted, leaving the registry converged on
// the two keys claude/cursor-agent (Task 2, P5).
it("registry 收敛两键 claude/cursor-agent", () => {
  const reg = registry.load(REG_PATH);
  expect(Object.keys(reg).sort()).toEqual(["claude", "cursor-agent"]);
});

it("checkHarness: claude 通过 ship gate（dryRun 跳过 PATH 校验）", () => {
  const reg = registry.load(REG_PATH);
  const entry = registry.checkHarness(reg, "claude", { dryRun: true });
  expect(entry.cli).toBe("claude");
  expect(entry.ship).toBe("full");
});

it("checkHarness: not-supported harness → blocked（exitCode 1；T2 收敛后 registry 无 not-supported 键，经 fixture 注入覆盖该 ship-gate 分支）", () => {
  const reg = registry.load(REG_PATH);
  const fixture = { ...reg, legacy: { cli: "droid", ship: "not-supported" } };
  expect(() => registry.checkHarness(fixture, "legacy")).toThrow();
  try {
    registry.checkHarness(fixture, "legacy");
  } catch (e) {
    expect(e.kind).toBe("blocked");
    expect(e.exitCode).toBe(1);
    expect(e.message).toMatch(/harness not supported: legacy/);
  }
});

it("checkHarness: unknown harness → blocked", () => {
  const reg = registry.load(REG_PATH);
  expect(() => registry.checkHarness(reg, "no-such-harness")).toThrow();
  try {
    registry.checkHarness(reg, "no-such-harness");
  } catch (e) {
    expect(e.kind).toBe("blocked");
    expect(e.exitCode).toBe(1);
    expect(e.message).toMatch(/unknown harness/);
  }
});

it("checkHarness: CLI preflight — full harness 缺二进制 → cli-missing（exitCode 2）", () => {
  const reg = registry.load(REG_PATH);
  const ghost = "cdd-nonexistent-cli-xyz";
  const fixture = {
    ...reg,
    ghost: { cli: ghost, invoke: "-p", output: "text", ship: "full" },
  };
  expect(() => registry.checkHarness(fixture, "ghost")).toThrow();
  try {
    registry.checkHarness(fixture, "ghost");
  } catch (e) {
    expect(e.kind).toBe("cli-missing");
    expect(e.exitCode).toBe(2);
    expect(e.message).toContain(`${ghost} not found in PATH`);
  }
});

it("checkHarness: dryRun 跳过 CLI 存在校验", () => {
  const reg = registry.load(REG_PATH);
  const fixture = {
    ...reg,
    ghost: { cli: "cdd-nonexistent-cli-xyz", invoke: "-p", output: "text", ship: "full" },
  };
  const entry = registry.checkHarness(fixture, "ghost", { dryRun: true });
  expect(entry.cli).toBe("cdd-nonexistent-cli-xyz");
});

it("registryField: 字段读取 + 缺失回退空串", () => {
  const reg = registry.load(REG_PATH);
  expect(registry.field(reg, "claude", "cli")).toBe("claude");
  expect(registry.field(reg, "claude", "invoke")).toBe(
    "-p --output-format text --dangerously-skip-permissions",
  );
  // Enh P: task_review_prefix 泛化为 per-mode prefix/suffix（Enh P 后已删除）
  expect(registry.field(reg, "claude", "task_review_prefix")).toBe("");
  // The prefix expands to operation×type (implement/review×{task,branch,spec,plan}/fix, /-style) (Task 5).
  expect(registry.field(reg, "claude", "prefix")).toEqual({
    implement: "/mattpocock-skills:tdd",
    review: {
      task: expect.stringMatching(/^\/mattpocock-skills:code-review.*single agent/),
      branch: expect.stringMatching(/^\/mattpocock-skills:code-review/),
      spec: expect.stringMatching(
        /^Follow URC: single-cycle, lens-tagged findings \(completeness\/consistency\/clarity\)$/,
      ),
      plan: expect.stringMatching(
        /^Follow URC: single-cycle, lens-tagged findings \(completeness\/decomposition\/buildability\)$/,
      ),
    },
    fix: "/mattpocock-skills:tdd",
  });
  expect(registry.field(reg, "claude", "suffix")).toEqual({});
  expect(registry.field(reg, "claude", "no-such-field")).toBe("");
  expect(registry.field(reg, "no-such-harness", "cli")).toBe("");
  expect(registry.field(reg, "gemini", "invoke")).toBe(""); // gemini is not a registry key after the convergence, so missing fields fall back to an empty string (T2)
});

it("resolveInjection: claude implement/fix → /mattpocock-skills:tdd", () => {
  const reg = registry.load(REG_PATH);
  expect(registry.resolveInjection(reg.claude, "implement")).toBe("/mattpocock-skills:tdd");
  expect(registry.resolveInjection(reg.claude, "fix")).toBe("/mattpocock-skills:tdd");
});

it("resolveInjection: claude review×type — task/branch → code-review(单 agent)；spec/plan → URC 指针", () => {
  const reg = registry.load(REG_PATH);
  expect(registry.resolveInjection(reg.claude, "review", "task")).toContain("code-review");
  expect(registry.resolveInjection(reg.claude, "review", "task")).toContain("single agent");
  expect(registry.resolveInjection(reg.claude, "review", "branch")).toContain("code-review");
  expect(registry.resolveInjection(reg.claude, "review", "spec")).toMatch(
    /^Follow URC: single-cycle, lens-tagged findings \(completeness\/consistency\/clarity\)$/,
  );
  expect(registry.resolveInjection(reg.claude, "review", "plan")).toMatch(
    /^Follow URC: single-cycle, lens-tagged findings \(completeness\/decomposition\/buildability\)$/,
  );
});

it("resolveInjection: 全 registry harness（claude/cursor-agent）同 claude set 非空", () => {
  const reg = registry.load(REG_PATH);
  for (const h of Object.keys(reg)) {
    expect(registry.resolveInjection(reg[h], "implement")).toBe("/mattpocock-skills:tdd");
    expect(registry.resolveInjection(reg[h], "fix")).toBe("/mattpocock-skills:tdd");
    expect(registry.resolveInjection(reg[h], "review", "task")).toContain("code-review");
    expect(registry.resolveInjection(reg[h], "review", "branch")).toContain("code-review");
    expect(registry.resolveInjection(reg[h], "review", "spec")).toMatch(
      /^Follow URC: single-cycle, lens-tagged findings/,
    );
    expect(registry.resolveInjection(reg[h], "review", "plan")).toMatch(
      /^Follow URC: single-cycle, lens-tagged findings/,
    );
    // 同 set 非空：implement/review.task/review.branch/fix 四个注入点都有值
    expect(
      [
        registry.resolveInjection(reg[h], "implement"),
        registry.resolveInjection(reg[h], "fix"),
        registry.resolveInjection(reg[h], "review", "task"),
        registry.resolveInjection(reg[h], "review", "branch"),
      ].filter(Boolean).length,
    ).toBe(4);
  }
});

it("resolveInjection: 兜底 —— 缺省 prefix/op/type 回退空串，legacy 扁平 mode 键直接命中", () => {
  expect(registry.resolveInjection({}, "implement")).toBe("");
  expect(registry.resolveInjection({ prefix: {} }, "implement")).toBe("");
  expect(registry.resolveInjection({ prefix: { review: { task: "/x" } } }, "review")).toBe(""); // 无 type → 空
  expect(registry.resolveInjection({ prefix: { review: {} } }, "review", "task")).toBe(""); // type 缺该子键 → 空
  // legacy 扁平 mode 键兜底：未迁移 registry / CDD_REGISTRY_PATH 覆盖仍直接命中
  expect(
    registry.resolveInjection({ prefix: { "legacy-review": "/legacy-review" } }, "legacy-review"),
  ).toBe("/legacy-review");
  // 新 registry 不再有扁平旧 mode 键 → 空
  expect(registry.resolveInjection(registry.load(REG_PATH).claude, "legacy-review")).toBe("");
});
