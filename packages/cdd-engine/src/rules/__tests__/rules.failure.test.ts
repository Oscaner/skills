// packages/cdd-engine/src/rules/__tests__/rules.failure.test.ts
// The canonical templates/engine-config.json#failureCategories is the independent source of truth:
// every expected value below is derived from the canonical JSON (never recomputed the way the port
// computes it), so drift between the .ts port and the canonical fails loudly (AC14 "承重，非装饰").
// Same seam as failure-categories.test.mjs, which keeps guarding the legacy .mjs copy.
import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FAILURE_CATEGORIES,
  counterFor,
  terminalFor,
  isIncompleteDispatch,
  counters,
  incrementFailureCounter,
  exhaustedBlocker,
  maybeExhaust,
  timeoutBlocker,
} from "../failure.ts";
import { writeHandoff } from "../../artifacts/handoff/write.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CAT: { categories: Array<Record<string, unknown>> } = JSON.parse(
  readFileSync(path.join(HERE, "..", "..", "..", "templates", "engine-config.json"), "utf8"),
).failureCategories;
const CATS = CAT.categories;

describe("rules/failure.ts — canonical 承重读取（AC14）", () => {
  it("FAILURE_CATEGORIES 与 canonical 逐字一致（全六类，字段同源）", () => {
    expect(Object.keys(FAILURE_CATEGORIES).sort()).toEqual(CATS.map((c) => c.id).sort());
    for (const c of CATS) {
      const entry = FAILURE_CATEGORIES[String(c.id)] as Record<string, unknown>;
      for (const key of Object.keys(c)) expect(entry[key]).toEqual(c[key]);
    }
  });

  it("counterFor(Id) 与 canonical counter 列一致（无计数器类目 → null）", () => {
    for (const c of CATS) {
      expect(counterFor(String(c.id))).toBe(c.counter ? String(c.counter) : null);
    }
  });

  it("terminalFor(Id) 与 canonical terminal 列一致（EXECUTION_FAILURE 是 engine-error 非 -exhausted）", () => {
    for (const c of CATS) {
      expect(terminalFor(String(c.id))).toBe(c.terminal ? String(c.terminal) : null);
    }
  });

  it("isIncompleteDispatch 取自 canonical dispatchIncomplete（不手写类目名）", () => {
    for (const c of CATS) {
      expect(isIncompleteDispatch(String(c.id))).toBe(c.dispatchIncomplete === true);
    }
  });

  it("counters() 与 canonical 表内序一致（四字段名 + returnMarker，零手写字面量）", () => {
    expect(counters()).toEqual(
      CATS.filter((c) => c.counter).map((c) => ({ field: String(c.counter), label: String(c.returnMarker) })),
    );
  });
});

describe("rules/failure.ts — 配额隔离（per-category 计数器）", () => {
  it("incrementFailureCounter 首犯 1 / 再犯 2（progress.json 持久化）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-fail-"));
    expect(incrementFailureCounter(dir, "CONTRACT_VIOLATION")).toBe(1);
    expect(incrementFailureCounter(dir, "CONTRACT_VIOLATION")).toBe(2);
    const p = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
    expect(p.contractViolationCount).toBe(2);
  });

  it("incrementFailureCounter 无计数器类目 → -1（不写 progress）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-fail2-"));
    expect(incrementFailureCounter(dir, "UNVERIFIABLE")).toBe(-1);
  });

  it("exhaustedBlocker 仅计数 ≥2 触发且携带终态语汇", () => {
    expect(exhaustedBlocker("TIMEOUT", 1)).toBeNull();
    expect(exhaustedBlocker("TIMEOUT", 2)).toMatch(/dispatch-timeout-cap/);
    expect(exhaustedBlocker("EXECUTION_FAILURE", 2)).toMatch(/engine-error/);
  });

  it("maybeExhaust 在阈值处覆盖 handoff blocker 为终态形（第 1 次不动 / 第 2 次终态）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-fail3-"));
    const h = path.join(dir, "task-1-handoff.json");
    writeHandoff(h, { task: 1, phase: "implement", status: "DONE" });
    expect(maybeExhaust(dir, "CONTRACT_VIOLATION", h)).toBe(1);
    expect(JSON.parse(readFileSync(h, "utf8")).blocker).toBeUndefined();
    expect(maybeExhaust(dir, "CONTRACT_VIOLATION", h)).toBe(2);
    expect(JSON.parse(readFileSync(h, "utf8")).blocker).toMatch(/contract-violation-exhausted/);
  });

  it("maybeExhaust 类目间配额隔离（TIMEOUT 不因 CONTRACT_VIOLATION 耗尽受影响）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-fail4-"));
    const h = path.join(dir, "task-1-handoff.json");
    writeHandoff(h, { task: 1, phase: "implement", status: "DONE" });
    mkdirSync(dir, { recursive: true });
    maybeExhaust(dir, "CONTRACT_VIOLATION", h);
    maybeExhaust(dir, "CONTRACT_VIOLATION", h);
    expect(incrementFailureCounter(dir, "TIMEOUT")).toBe(1);
    const p = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
    expect(p.contractViolationCount).toBe(2);
    expect(p.timeoutCount).toBe(1);
  });
});

describe("rules/failure.ts — timeoutBlocker (T26 unification; cause-keyed wording)", () => {
  it("budget timeout keeps the legacy wording (timed out after → re-dispatch)", () => {
    const b = timeoutBlocker({ cause: "over-budget", taskNum: 3, timeoutMs: 5_400_000 });
    expect(b).toMatch(/timed out after 5400000ms/);
    expect(b).toMatch(/task 3/);
    // legacy phrases preserved — runner.test.ts's /timed out after/ match stays green
    expect(b).toContain("simplify task");
  });

  it("external SIGTERM inherits the budget wording (unbounded elapsed, no stall proof)", () => {
    const b = timeoutBlocker({ cause: "signal", taskNum: 4, timeoutMs: 5_400_000 });
    expect(b).toMatch(/timed out after 5400000ms/);
    expect(b).toMatch(/task 4/);
  });

  it("stall variant carries the resume-or-discard contract (T26 §⑤/§T7.5 reword)", () => {
    const b = timeoutBlocker({ cause: "stalled", taskNum: 7, idleWindowMs: 900_000, op: "implement", residue: "abc123" });
    expect(b).toMatch(/stalled/);
    expect(b).toMatch(/900000ms/);
    // brief's recovery-path contract: resume-or-discard — cdd implement re-dispatch auto-resumes
    // (recovery.residue_ref), or git stash drop abandons the salvage
    expect(b).toContain("resume 或丢弃：cdd implement --task 7 re-dispatch 自动续传（recovery.residue_ref=abc123）→ 或 git stash drop 放弃");
    // still a TIMEOUT-shaped blocker (same category identity, extended wording only)
    expect(b).not.toMatch(/simplify task/);
    expect(b).not.toMatch(/discard or commit/); // §⑤ upgrade: discard-or-commit wording is gone
  });

  it("stall without a salvage record still carries the resume-or-discard contract (no ref to prepend)", () => {
    const b = timeoutBlocker({ cause: "stalled", taskNum: 7, idleWindowMs: 900_000, op: "implement" });
    expect(b).toContain("resume 或丢弃：cdd implement --task 7 re-dispatch 自动续传（recovery.residue_ref）→ 或 git stash drop 放弃");
  });
});
