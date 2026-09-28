// packages/cdd-engine/src/rules/__tests__/ref-sequence.test.ts — the C5-1 soft-cap judgment basis
// (the 'ref-sequence round counting' rule) over a REAL workspace: maxConsecutiveS1Rounds walks the
// review-round files anchored at the fix round's `--findings` source handoff. Fixture handoffs are
// written to a temp dir (the canonical engine read path — readJson over real files, fail-open on the
// missing/unreadable lanes).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { maxConsecutiveS1Rounds } from "../ref-sequence.ts";

const repoRoot = mkdtempSync(path.join(tmpdir(), "cdd-refseq-"));
afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

/** Write the family's review-round handoff at <round> and return its absolute path. Task family
 *  names are `tasks-{key}-review-{R}.json` (the group key fills the {tasks} segment — no extra
 *  type segment); docs family names are `{type}-review-{R}.json`. */
function writeReviewRound(
  type: string,
  round: number,
  findings: Array<{ severity?: string }>,
  opts: { tasks?: string; dir?: string } = {},
): string {
  const dir = opts.dir ?? type;
  const ws = path.join(repoRoot, dir);
  mkdirSync(ws, { recursive: true });
  const name = opts.tasks
    ? `tasks-${opts.tasks}-review-${round}.json`
    : `${type}-review-${round}.json`;
  const file = path.join(ws, name);
  writeFileSync(file, JSON.stringify({ status: "CHANGES_REQUESTED", findings, artifacts: {} }));
  return file;
}

const BLOCKER = [{ severity: "blocker", summary: "b" }];
const WARN = [{ severity: "warn" }];

describe("rules/ref-sequence.ts — maxConsecutiveS1Rounds (C5-1 'ref 序列轮次计数')", () => {
  it("source with a blocker, preceded by consecutive blocker rounds → the full run length", () => {
    writeReviewRound("spec", 1, BLOCKER);
    writeReviewRound("spec", 2, BLOCKER);
    const src = writeReviewRound("spec", 3, BLOCKER);
    expect(maxConsecutiveS1Rounds({ type: "spec", sourcePath: src })).toBe(3);
  });

  it("the run stops at the first non-S1 (older) round — newer run unaffected by it", () => {
    writeReviewRound("spec", 1, BLOCKER);
    writeReviewRound("spec", 2, WARN); // gap — ends the run
    writeReviewRound("spec", 3, BLOCKER);
    writeReviewRound("spec", 4, BLOCKER);
    const src = writeReviewRound("spec", 5, BLOCKER);
    expect(maxConsecutiveS1Rounds({ type: "spec", sourcePath: src })).toBe(3);
  });

  it(
    "a missing round IMMEDIATELY below the source ends the run (unreadable history degrades, never " +
      "throws)",
    () => {
      // Source round 4 (S1), round 3 missing (the hole), round 2 S1 — the backward walk stops at 1.
      writeReviewRound("plan", 2, BLOCKER);
      writeReviewRound("plan", 4, BLOCKER);
      const src = path.join(repoRoot, "plan", "plan-review-4.json");
      expect(maxConsecutiveS1Rounds({ type: "plan", sourcePath: src })).toBe(1);
    },
  );

  it("source with warn/nit-only findings → 0 (no S1 run started)", () => {
    const src = writeReviewRound("spec", 1, WARN);
    expect(maxConsecutiveS1Rounds({ type: "spec", sourcePath: src })).toBe(0);
  });

  it("a non-array `findings` field (agent-written shape) reads as zero blockers — no crash", () => {
    const ws = path.join(repoRoot, "spec");
    mkdirSync(ws, { recursive: true });
    const src = path.join(ws, "spec-review-1.json");
    writeFileSync(src, JSON.stringify({ status: "CHANGES_REQUESTED", findings: "none" }));
    expect(maxConsecutiveS1Rounds({ type: "spec", sourcePath: src })).toBe(0);
  });

  it("a source file name that does not match the family (round underivable) → 0", () => {
    const src = path.join(repoRoot, "spec", "branch-review-abc..def-r1.json");
    expect(maxConsecutiveS1Rounds({ type: "spec", sourcePath: src })).toBe(0);
  });

  it("task family with the group pin reads ONLY this group's rounds (cross-group isolation)", () => {
    // Group 1 and group 2 both have all three rounds as S1 — the pinned walk must read GROUP 1's
    // files only, and co-located group-2 files must not extend or shorten the run.
    for (const g of [1, 2]) {
      for (const r of [1, 2, 3]) writeReviewRound("task", r, BLOCKER, { tasks: String(g) });
    }
    const src = path.join(repoRoot, "task", "tasks-1-review-3.json");
    writeFileSync(src, JSON.stringify({ status: "CHANGES_REQUESTED", findings: BLOCKER }));
    // The pin isolates the group the source belongs to; the no-pin contract (empty {tasks} segment
    // → every candidate misses) degrades to 0 — pinned cross-group reads never happen.
    expect(maxConsecutiveS1Rounds({ type: "task", sourcePath: src, tasks: "1" })).toBe(3);
    expect(maxConsecutiveS1Rounds({ type: "task", sourcePath: src })).toBe(0);
  });

  it(
    "task family WITHOUT the pin: the source's own basename anchors the round, but the unpinned " +
      "round-name construction (empty {tasks} segment) misses every file → fail-open 0, not a crash " +
      "and not a cross-group read",
    () => {
      writeReviewRound("task", 1, BLOCKER);
      writeReviewRound("task", 2, BLOCKER);
      const src = path.join(repoRoot, "task", "tasks-1-review-3.json");
      writeFileSync(src, JSON.stringify({ status: "CHANGES_REQUESTED", findings: BLOCKER }));
      // The production task face always pins (this.#groupKey); an unpinned call must degrade safely.
      expect(maxConsecutiveS1Rounds({ type: "task", sourcePath: src })).toBe(0);
    },
  );
});
