// engine/tests/review-loop.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { runReviewLoop } from "../review-loop.mjs";

test("runReviewLoop: blocker=0 on first round → calls runFix once, exits", async () => {
  const calls = [];
  await runReviewLoop({
    runReview: async (r) => { calls.push(`review-${r}`); return { findings: [] }; },
    runFix:    async (r, f) => { calls.push(`fix-${r}`); },
    getBlockers: (h) => [],
  });
  assert.deepEqual(calls, ["review-1", "fix-1"]);
});

test("runReviewLoop: blocker>0 on round 1, blocker=0 on round 2 → loops once", async () => {
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
  assert.deepEqual(calls, ["review-1", "fix-1", "review-2", "fix-2"]);
});

test("runReviewLoop: round counter increments", async () => {
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
  assert.deepEqual(rounds, [1, 2, 3]);
});

test("runReviewLoop: onRoundDone called with final round + findings", async () => {
  let doneCalled = null;
  await runReviewLoop({
    runReview: async (r) => ({ findings: [] }),
    runFix: async () => {},
    getBlockers: () => [],
    onRoundDone: (r, f) => { doneCalled = { r, f }; },
  });
  assert.equal(doneCalled.r, 1);
  assert.deepEqual(doneCalled.f, []);
});
