// engine/tests/ledger.test.mjs — T1: ledger 追加 + plan constraints 模块单测。
// appendLedger port 自 cdd-common.sh `_append_ledger` 的 deferred roll-up：
//   有 deferred → "Task N: complete (commits base..head, K deferred: s1; s2)"
//   无 deferred → "Task N: complete (commits base..head, review clean)"
//   base/head 截断 7 位。writePlanConstraints port 自 `_cdd_write_plan_constraints`（awk 提取）。
import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { appendLedger, writePlanConstraints } from "../lib/ledger.mjs";

function tmpDir(t) {
  return mkdtempSync(path.join(tmpdir(), `ledger-test-`));
}

it("appendLedger: deferred roll-up 行（只聚合 deferred:true）", () => {
  const dir = tmpDir();
  const ledger = path.join(dir, "progress.md");
  writeFileSync(ledger, "# CDD ledger — plan: /x/plan.md\n");

  appendLedger(ledger, 1, "complete", { base: "base1", head: "head1" }, [
    { severity: "nit", summary: "Nit alpha", deferred: true },
    { severity: "warn", summary: "Warn beta", deferred: true },
    { severity: "blocker", summary: "Blocker gamma", deferred: false },
  ]);

  const content = readFileSync(ledger, "utf8");
  expect(
    content.endsWith("Task 1: complete (commits base1..head1, 2 deferred: Nit alpha; Warn beta)\n"),
  ).toBe(true);
});

it("appendLedger: 无 deferred → review clean", () => {
  const dir = tmpDir();
  const ledger = path.join(dir, "progress.md");
  writeFileSync(ledger, "# CDD ledger — plan: /x/plan.md\n");

  appendLedger(ledger, 1, "complete", { base: "base1", head: "head1" }, []);

  const content = readFileSync(ledger, "utf8");
  expect(content.endsWith("Task 1: complete (commits base1..head1, review clean)\n")).toBe(true);
});

it("appendLedger: 追加不覆盖 + base/head 截断 7 位", () => {
  const dir = tmpDir();
  const ledger = path.join(dir, "progress.md");
  writeFileSync(ledger, "# CDD ledger — plan: /x/plan.md\nTask 1: complete (seed)\n");

  appendLedger(ledger, 2, "complete", { base: "1234567890abcdef", head: "abcdef0123456789" }, []);

  const content = readFileSync(ledger, "utf8");
  expect(content.includes("Task 1: complete (seed)")).toBe(true);
  expect(content.endsWith("Task 2: complete (commits 1234567..abcdef0, review clean)\n")).toBe(true);
});

it("writePlanConstraints: 提取 ## Global Constraints 段（到下一个 ## 标题止，保留段内空行）", () => {
  const dir = tmpDir();
  const plan = path.join(dir, "plan.md");
  writeFileSync(
    plan,
    "# Plan\n\n## Global Constraints\n\n- 只读仓库\n- 单一提交\n\n## Other Section\n\nx\n",
  );
  const out = path.join(dir, "plan-constraints.md");
  writePlanConstraints(plan, out);
  // awk `capture { print }` 保留空行 —— 段内空行（header 后 + 段尾）原样输出。
  expect(readFileSync(out, "utf8")).toBe("\n- 只读仓库\n- 单一提交\n");
});

it("writePlanConstraints: --- 终止 + 已存在输出不覆盖", () => {
  const dir = tmpDir();
  const plan = path.join(dir, "plan.md");
  writeFileSync(plan, "## Global Constraints\n\naaa\n\n---\n\n## Global Constraints 再次\n\nbbb\n");
  const out = path.join(dir, "plan-constraints.md");

  writePlanConstraints(plan, out);
  expect(readFileSync(out, "utf8")).toBe("\naaa\n");
  const firstWrite = readFileSync(out, "utf8");

  // 已存在 → 不重写（即使 plan 内容变化）
  writeFileSync(plan, "## Global Constraints\n\nCHANGED\n");
  writePlanConstraints(plan, out);
  expect(readFileSync(out, "utf8")).toBe(firstWrite);
  expect(readFileSync(out, "utf8")).toBe("\naaa\n");
});
