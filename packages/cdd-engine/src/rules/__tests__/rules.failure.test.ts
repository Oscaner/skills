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
    expect(exhaustedBlocker("TIMEOUT", 2)).toMatch(/TIMEOUT-exhausted/);
    expect(exhaustedBlocker("EXECUTION_FAILURE", 2)).toMatch(/EXECUTION_FAILURE-exhausted/);
  });

  it("maybeExhaust 在阈值处覆盖 handoff blocker 为终态形（第 1 次不动 / 第 2 次终态）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-fail3-"));
    const h = path.join(dir, "task-1-handoff.json");
    writeHandoff(h, { task: 1, phase: "implement", status: "DONE" });
    expect(maybeExhaust(dir, "CONTRACT_VIOLATION", h)).toBe(1);
    expect(JSON.parse(readFileSync(h, "utf8")).blocker).toBeUndefined();
    expect(maybeExhaust(dir, "CONTRACT_VIOLATION", h)).toBe(2);
    expect(JSON.parse(readFileSync(h, "utf8")).blocker).toMatch(/CONTRACT_VIOLATION-exhausted/);
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