// engine/tests/registry.test.mjs — T1: harness-contract module unit tests (Node port).
// 从 cdd-common-functions.test.sh（cdd_check_harness / _cdd_registry_field）与
// registry-schema.test.sh 移植行为断言。ship gate 语义：
//   unknown / not-supported → blocked（exitCode 1）；CLI 存在校验失败 → cli-missing（exitCode 2）。
// 真实 claude 二进制不在 PATH 的 CI 上，ship-gate 通过用例用 dryRun 跳过 CLI 校验（确定性）。
import { expect, it } from "vitest";

import { REG_PATH, Registry } from "../registry.ts";

const registry = new Registry();

it("loadRegistry: 读取 3 harness（claude/cursor/pi）+ 顶层 dispatch/refs 契约表", () => {
  const reg = registry.load(REG_PATH);
  for (const name of ["claude", "cursor", "pi"]) {
    expect(reg[name]).toBeTruthy();
  }
  expect(reg.dispatch).toBeTruthy();
  expect(reg.refs).toBeTruthy();
});

// The harness selection/probe/install layer is deleted, leaving the registry converged on
// the three row keys claude/cursor/pi (cli keeps the external binary names).
it("registry 收敛三键 claude/cursor/pi", () => {
  const reg = registry.load(REG_PATH);
  const rows = Object.keys(reg).filter((k) => !["_doc", "dispatch", "refs"].includes(k));
  expect(rows.sort()).toEqual(["claude", "cursor", "pi"]);
});

// G1 bidirectional pin (reverse): the exact name-set assertion above is load-bearing — a foreign
// row key entering the registry makes the set differ (a junk key is the design-drift signal the
// forward assertion exists to catch, never a pass).
it("registry 恰三键反向：foreign key 入 registry → 恰三键 pin 抓负（G1 双向钉死）", () => {
  const reg = registry.load(REG_PATH);
  const junk = { ...reg, gemini: {} };
  const rows = Object.keys(junk).filter((k) => !["_doc", "dispatch", "refs"].includes(k));
  expect(rows.sort()).not.toEqual(["claude", "cursor", "pi"]);
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
    // acquireCddExitError-shape cast — the CddExitError family carries these three fields.
    const err = e as { kind?: string; exitCode?: number; message?: string };
    expect(err.kind).toBe("blocked");
    expect(err.exitCode).toBe(1);
    expect(err.message).toMatch(/harness not supported: legacy/);
  }
});

it("checkHarness: unknown harness → blocked", () => {
  const reg = registry.load(REG_PATH);
  expect(() => registry.checkHarness(reg, "no-such-harness")).toThrow();
  try {
    registry.checkHarness(reg, "no-such-harness");
  } catch (e) {
    const err = e as { kind?: string; exitCode?: number; message?: string };
    expect(err.kind).toBe("blocked");
    expect(err.exitCode).toBe(1);
    expect(err.message).toMatch(/unknown harness/);
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
    const err = e as { kind?: string; exitCode?: number; message?: string };
    expect(err.kind).toBe("cli-missing");
    expect(err.exitCode).toBe(2);
    expect(err.message).toContain(`${ghost} not found in PATH`);
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
  // C8: the prefix is no longer row data — the row carries neither `prefix` nor `suffix`; the
  // dispatch prefix derives from the contract's dispatch + refs tables (derivePrefixMap).
  expect(registry.field(reg, "claude", "prefix")).toBe("");
  expect(registry.field(reg, "claude", "suffix")).toBe("");
  expect(registry.field(reg, "claude", "no-such-field")).toBe("");
  expect(registry.field(reg, "no-such-harness", "cli")).toBe("");
  expect(registry.field(reg, "gemini", "invoke")).toBe(""); // gemini is not a registry key after the convergence, so missing fields fall back to an empty string (T2)
});

it("deriveInjection: claude implement/fix → /mattpocock-skills:tdd（C8 派生，非行数据）", () => {
  const reg = registry.load(REG_PATH);
  expect(registry.deriveInjection(reg, "claude", "implement")).toBe("/mattpocock-skills:tdd");
  expect(registry.deriveInjection(reg, "claude", "fix")).toBe("/mattpocock-skills:tdd");
});

it("deriveInjection: pi implement/fix → /skill:tdd（T7 前身 pi-prefix 修正——refs 派生自动 /skill:）", () => {
  const reg = registry.load(REG_PATH);
  expect(registry.deriveInjection(reg, "pi", "implement")).toBe("/skill:tdd");
  expect(registry.deriveInjection(reg, "pi", "fix")).toBe("/skill:tdd");
});

it("deriveInjection: claude review×type — task/branch → code-review(单 agent)；spec/plan → URC 指针", () => {
  const reg = registry.load(REG_PATH);
  expect(registry.deriveInjection(reg, "claude", "review", "task")).toContain(
    "/mattpocock-skills:code-review",
  );
  expect(registry.deriveInjection(reg, "claude", "review", "task")).toContain("single agent");
  expect(registry.deriveInjection(reg, "claude", "review", "branch")).toMatch(
    /^\/mattpocock-skills:code-review/,
  );
  expect(registry.deriveInjection(reg, "claude", "review", "spec")).toMatch(
    /^Follow URC: single-cycle, lens-tagged findings \(completeness\/consistency\/clarity\)$/,
  );
  expect(registry.deriveInjection(reg, "claude", "review", "plan")).toMatch(
    /^Follow URC: single-cycle, lens-tagged findings \(completeness\/decomposition\/buildability\)$/,
  );
});

it("deriveInjection: pi review 注入走 /skill: 形（code-review 单 agent + URC 措辞 harness 无关）", () => {
  const reg = registry.load(REG_PATH);
  expect(registry.deriveInjection(reg, "pi", "review", "task")).toContain("/skill:code-review");
  expect(registry.deriveInjection(reg, "pi", "review", "branch")).toContain("/skill:code-review");
  expect(registry.deriveInjection(reg, "pi", "review", "spec")).toMatch(
    /^Follow URC: single-cycle, lens-tagged findings/,
  );
  expect(registry.deriveInjection(reg, "pi", "review", "plan")).toMatch(
    /^Follow URC: single-cycle, lens-tagged findings/,
  );
});

it("deriveInjection: 全 registry harness（claude/cursor/pi）注入集非空（pi 列恒 /skill:）", () => {
  const reg = registry.load(REG_PATH);
  for (const h of Object.keys(reg)) {
    if (h === "_doc" || h === "dispatch" || h === "refs") continue;
    const isPi = h === "pi";
    const impl = isPi ? "/skill:tdd" : "/mattpocock-skills:tdd";
    expect(registry.deriveInjection(reg, h, "implement")).toBe(impl);
    expect(registry.deriveInjection(reg, h, "fix")).toBe(impl);
    const reviewTask = isPi
      ? "/skill:code-review — single agent, dual axis (standards + spec); parallel sub-agents forbidden"
      : "/mattpocock-skills:code-review — single agent, dual axis (standards + spec); parallel sub-agents forbidden";
    expect(registry.deriveInjection(reg, h, "review", "task")).toBe(reviewTask);
    expect(registry.deriveInjection(reg, h, "review", "branch")).toBe(reviewTask);
    expect(registry.deriveInjection(reg, h, "review", "spec")).toMatch(
      /^Follow URC: single-cycle, lens-tagged findings/,
    );
    expect(registry.deriveInjection(reg, h, "review", "plan")).toMatch(
      /^Follow URC: single-cycle, lens-tagged findings/,
    );
    // the four injection points all resolve to a non-empty value
    expect(
      [
        registry.deriveInjection(reg, h, "implement"),
        registry.deriveInjection(reg, h, "fix"),
        registry.deriveInjection(reg, h, "review", "task"),
        registry.deriveInjection(reg, h, "review", "branch"),
      ].filter(Boolean).length,
    ).toBe(4);
  }
});

it("checkHarness stamps the derived prefix map（resolveInjection 消费签名不变）", () => {
  const reg = registry.load(REG_PATH);
  const entry = registry.checkHarness(reg, "claude", { dryRun: true });
  expect(entry.prefix.implement).toBe("/mattpocock-skills:tdd");
  expect(registry.resolveInjection(entry, "implement")).toBe("/mattpocock-skills:tdd");
  const piEntry = registry.checkHarness(reg, "pi", { dryRun: true });
  expect(registry.resolveInjection(piEntry, "implement")).toBe("/skill:tdd");
  expect(registry.resolveInjection(piEntry, "review", "task")).toContain("/skill:code-review");
});

it("resolveInjection: 兜底 —— 缺省 prefix/op/type 回退空串，legacy 扁平 mode 键直接命中", () => {
  expect(registry.resolveInjection({}, "implement")).toBe("");
  // C8: a raw (unstamped) row carries no prefix → empty (the derived prefix rides the
  // checkHarness entry; the deleted-data fallback shape stays empty).
  expect(registry.resolveInjection({ prefix: {} }, "implement")).toBe("");
  expect(registry.resolveInjection({ prefix: { review: { task: "/x" } } }, "review")).toBe(""); // no type → empty
  expect(registry.resolveInjection({ prefix: { review: { task: "/x" } } }, "review", "spec")).toBe(
    "",
  ); // the type lacks that subkey → empty
  expect(registry.resolveInjection(registry.load(REG_PATH).claude, "legacy-review")).toBe("");
});
