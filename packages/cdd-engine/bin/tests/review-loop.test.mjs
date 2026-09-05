// bin/tests/review-loop.test.mjs
import { it, expect } from 'vitest';
import { runReviewLoop } from "../review-loop.mjs";

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