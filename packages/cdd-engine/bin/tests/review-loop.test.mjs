// bin/tests/review-loop.test.mjs
import { it, expect } from 'vitest';
import { runReviewLoop, resolveNextRound, reviewStoppedError } from '../lib/review-loop.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

it("runReviewLoop: blocker=0 on first round → calls runFix once, exits", async () => {
  const calls = [];
  await runReviewLoop({
    runReview: async (r) => { calls.push(`review-${r}`); return { findings: [] }; },
    runFix:    async (r, f) => { calls.push(`fix-${r}`); },
    getBlockers: (h) => [],
  });
  expect(calls).toEqual(["review-1", "fix-1"]);
});

it("runReviewLoop: blocker>0 on round 1, blocker=0 on round 2 → loops once", async () => {
  const calls = [];
  let round = 0;
  await runReviewLoop({
    runReview: async (r) => {
      calls.push(`review-${r}`);
      round++;
      return { findings: round === 1 ? [{ severity: "blocker" }] : [] };
    },
    runFix:    async (r, f) => { calls.push(`fix-${r}`); },
    getBlockers: (h) => h.findings.filter(f => f.severity === "blocker"),
  });
  expect(calls).toEqual(["review-1", "fix-1", "review-2", "fix-2"]);
});

it("runReviewLoop: round counter increments", async () => {
  const rounds = [];
  let callCount = 0;
  await runReviewLoop({
    runReview: async (r) => {
      rounds.push(r);
      callCount++;
      return { findings: callCount < 3 ? [{ severity: "blocker" }] : [] };
    },
    runFix: async () => {},
    getBlockers: (h) => h.findings.filter(f => f.severity === "blocker"),
  });
  expect(rounds).toEqual([1, 2, 3]);
});

it("runReviewLoop: onRoundDone called with final round + findings", async () => {
  let doneCalled = null;
  await runReviewLoop({
    runReview: async (r) => ({ findings: [] }),
    runFix: async () => {},
    getBlockers: () => [],
    onRoundDone: (r, f) => { doneCalled = { r, f }; },
  });
  expect(doneCalled.r).toBe(1);
  expect(doneCalled.f).toEqual([]);
});

it("resolveNextRound: per-type 命名模式", () => {
  const ws = mkdtempSync(join(tmpdir(), "rloop-"));
  writeFileSync(join(ws, "spec-review-1.json"), "{}");
  writeFileSync(join(ws, "spec-review-2.json"), "{}");
  expect(resolveNextRound(ws, "spec")).toBe(3);
  writeFileSync(join(ws, "task-2-task-review-1.json"), "{}");
  writeFileSync(join(ws, "task-2-task-review-3.json"), "{}");
  expect(resolveNextRound(ws, "task", { task: 2 })).toBe(4); // task 用既有 round 命名
  writeFileSync(join(ws, "branch-review-abc1234..def5678-r1.json"), "{}");
  expect(resolveNextRound(ws, "branch")).toBe(2);
  expect(resolveNextRound(join(ws, "nope"), "spec")).toBe(1);
});

it("reviewStoppedError: 携带 type/round/ref 的 Error", () => {
  const e = reviewStoppedError("spec", 2, "docs/x.md");
  expect(e.message).toMatch(/blocker=0/);
});