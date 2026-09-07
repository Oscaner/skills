// engine/tests/registry.test.mjs — T1: harness-registry 模块单测（Node port）。
// 从 cdd-common-functions.test.sh（cdd_check_harness / _cdd_registry_field）与
// registry-schema.test.sh 移植行为断言。ship gate 语义：
//   unknown / not-supported → blocked（exitCode 1）；CLI 存在校验失败 → cli-missing（exitCode 2）。
// 真实 claude 二进制不在 PATH 的 CI 上，ship-gate 通过用例用 dryRun 跳过 CLI 校验（确定性）。
import { it, expect } from 'vitest';
import { fileURLToPath } from "node:url";

import { loadRegistry, checkHarness, registryField, resolveInjection } from "../lib/registry.mjs";

const REG_PATH = fileURLToPath(new URL("../harness-registry.json", import.meta.url));

it("loadRegistry: 读取 7 harness", () => {
  const reg = loadRegistry(REG_PATH);
  expect(Object.keys(reg).length).toBe(7);
  for (const name of ["claude", "cursor-agent", "droid", "pi", "codex", "copilot", "gemini"]) {
    expect(reg[name]).toBeTruthy();
  }
});

it("checkHarness: claude 通过 ship gate（dryRun 跳过 PATH 校验）", () => {
  const reg = loadRegistry(REG_PATH);
  const entry = checkHarness(reg, "claude", { dryRun: true });
  expect(entry.cli).toBe("claude");
  expect(entry.ship).toBe("full");
});

it("checkHarness: not-supported harness → blocked（exitCode 1）", () => {
  const reg = loadRegistry(REG_PATH);
  expect(
    () => checkHarness(reg, "codex"),
  ).toThrow();
  try {
    checkHarness(reg, "codex");
  } catch (e) {
    expect(e.kind).toBe("blocked");
    expect(e.exitCode).toBe(1);
    expect(e.message).toMatch(/harness not supported: codex/);
  }
  expect(
    () => checkHarness(reg, "gemini"),
  ).toThrow();
  try {
    checkHarness(reg, "gemini");
  } catch (e) {
    expect(e.kind).toBe("blocked");
    expect(e.exitCode).toBe(1);
  }
});

it("checkHarness: unknown harness → blocked", () => {
  const reg = loadRegistry(REG_PATH);
  expect(() => checkHarness(reg, "no-such-harness")).toThrow();
  try {
    checkHarness(reg, "no-such-harness");
  } catch (e) {
    expect(e.kind).toBe("blocked");
    expect(e.exitCode).toBe(1);
    expect(e.message).toMatch(/unknown harness/);
  }
});

it("checkHarness: CLI preflight — full harness 缺二进制 → cli-missing（exitCode 2）", () => {
  const reg = loadRegistry(REG_PATH);
  const ghost = "cdd-nonexistent-cli-xyz";
  const fixture = {
    ...reg,
    ghost: { cli: ghost, invoke: "-p", output: "text", ship: "full" },
  };
  expect(() => checkHarness(fixture, "ghost")).toThrow();
  try {
    checkHarness(fixture, "ghost");
  } catch (e) {
    expect(e.kind).toBe("cli-missing");
    expect(e.exitCode).toBe(2);
    expect(e.message).toContain(`${ghost} not found in PATH`);
  }
});

it("checkHarness: dryRun 跳过 CLI 存在校验", () => {
  const reg = loadRegistry(REG_PATH);
  const fixture = {
    ...reg,
    ghost: { cli: "cdd-nonexistent-cli-xyz", invoke: "-p", output: "text", ship: "full" },
  };
  const entry = checkHarness(fixture, "ghost", { dryRun: true });
  expect(entry.cli).toBe("cdd-nonexistent-cli-xyz");
});

it("registryField: 字段读取 + 缺失回退空串", () => {
  const reg = loadRegistry(REG_PATH);
  expect(registryField(reg, "claude", "cli")).toBe("claude");
  expect(registryField(reg, "claude", "invoke")).toBe("-p --output-format text --dangerously-skip-permissions");
  // Enh P: task_review_prefix 泛化为 per-mode prefix/suffix（Enh P 后已删除）
  expect(registryField(reg, "claude", "task_review_prefix")).toBe("");
  // Task 5: prefix 拓展为 operation×type（implement/review×{task,branch,spec,plan}/fix，/ 风格）
  expect(registryField(reg, "claude", "prefix")).toEqual({
    implement: "/mattpocock-skills:tdd",
    review: {
      task: expect.stringMatching(/^\/mattpocock-skills:code-review.*single agent/),
      branch: expect.stringMatching(/^\/mattpocock-skills:code-review/),
      spec: expect.stringMatching(/URC \(_docs\/review\.md\)/),
      plan: expect.stringMatching(/URC \(_docs\/review\.md\)/),
    },
    fix: "/mattpocock-skills:tdd",
  });
  expect(registryField(reg, "claude", "suffix")).toEqual({});
  expect(registryField(reg, "claude", "no-such-field")).toBe("");
  expect(registryField(reg, "no-such-harness", "cli")).toBe("");
  expect(registryField(reg, "codex", "invoke")).toBe(""); // not-supported 不带 invoke（schema）
});

it("resolveInjection: claude implement/fix → /mattpocock-skills:tdd", () => {
  const reg = loadRegistry(REG_PATH);
  expect(resolveInjection(reg.claude, "implement")).toBe("/mattpocock-skills:tdd");
  expect(resolveInjection(reg.claude, "fix")).toBe("/mattpocock-skills:tdd");
});

it("resolveInjection: claude review×type — task/branch → code-review(单 agent)；spec/plan → URC 指针", () => {
  const reg = loadRegistry(REG_PATH);
  expect(resolveInjection(reg.claude, "review", "task")).toContain("code-review");
  expect(resolveInjection(reg.claude, "review", "task")).toContain("single agent");
  expect(resolveInjection(reg.claude, "review", "branch")).toContain("code-review");
  expect(resolveInjection(reg.claude, "review", "spec")).toMatch(/URC \(_docs\/review\.md\)/);
  expect(resolveInjection(reg.claude, "review", "plan")).toMatch(/URC \(_docs\/review\.md\)/);
});

it("resolveInjection: pi/droid/cursor-agent 同 claude set（全 harness 同 set 非空）", () => {
  const reg = loadRegistry(REG_PATH);
  for (const h of ["cursor-agent", "droid", "pi"]) {
    expect(resolveInjection(reg[h], "implement")).toBe("/mattpocock-skills:tdd");
    expect(resolveInjection(reg[h], "fix")).toBe("/mattpocock-skills:tdd");
    expect(resolveInjection(reg[h], "review", "task")).toContain("code-review");
    expect(resolveInjection(reg[h], "review", "branch")).toContain("code-review");
    expect(resolveInjection(reg[h], "review", "spec")).toMatch(/URC \(_docs\/review\.md\)/);
    expect(resolveInjection(reg[h], "review", "plan")).toMatch(/URC \(_docs\/review\.md\)/);
    // 同 set 非空：implement/review.task/review.branch/fix 四个注入点都有值
    expect(
      [resolveInjection(reg[h], "implement"), resolveInjection(reg[h], "fix"),
       resolveInjection(reg[h], "review", "task"), resolveInjection(reg[h], "review", "branch")]
        .filter(Boolean).length,
    ).toBe(4);
  }
});

it("resolveInjection: 兜底 —— 缺省 prefix/op/type 回退空串，legacy 扁平 mode 键直接命中", () => {
  expect(resolveInjection({}, "implement")).toBe("");
  expect(resolveInjection({ prefix: {} }, "implement")).toBe("");
  expect(resolveInjection({ prefix: { review: { task: "/x" } } }, "review")).toBe(""); // 无 type → 空
  expect(resolveInjection({ prefix: { review: {} } }, "review", "task")).toBe("");      // type 缺该子键 → 空
  // legacy 扁平 mode 键兜底：未迁移 registry / CDD_REGISTRY_PATH 覆盖仍直接命中
  expect(resolveInjection({ prefix: { "task-review": "/legacy-review" } }, "task-review")).toBe("/legacy-review");
  // 新 registry 不再有扁平 task-review 键 → 空
  expect(resolveInjection(loadRegistry(REG_PATH).claude, "task-review")).toBe("");
});
