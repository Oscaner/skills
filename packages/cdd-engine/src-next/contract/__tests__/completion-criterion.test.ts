// packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts
// P22 T4 — the completion-criterion pins (design spec §8 · the completion-criterion
// row). Four groups, one per claim the registry makes:
//   (a) implement — the GROUP baseline (the earliest record's `dispatchBase`) decides:
//       zero commits since it is a hard violation, at least one is completion — and a
//       re-attempt that committed nothing of its own still reads as done;
//   (b) review — an empty `findings` array is an APPROVAL (not a violation), an absent
//       carrier or a non-array `findings` is hard;
//   (c) the registry — its registered keys are a subset of the verb set, and an
//       unregistered verb throws at lookup;
//   (d) the context is a pure shape — a literal seven-cell context feeds both criteria,
//       which read only what it carries (the group baseline comes from `records`).

import { describe, expect, it } from "vitest";
import { GitClient } from "../../infra/git.ts";
import type { OpType, ProgressRow, RoundRecord, RoundVerdict } from "../../session/ledger.ts";
import {
  COMPLETION_CRITERIA,
  CommitsSinceGroupBase,
  type CompletionContext,
  CompletionCriteria,
  JudgeCarrier,
} from "../completion-criterion.ts";

/** The git read face stub — records the baseline each judgment asked git about, so a
 *  case can pin WHICH baseline the criterion used (the group's, never the round's). */
class StubGit extends GitClient {
  readonly calls: { cwd: string; base: string | null }[] = [];
  readonly #commits: readonly string[];

  constructor(commits: readonly string[] = []) {
    super();
    this.#commits = commits;
  }

  override async commitsSince(cwd: string, base: string | null): Promise<readonly string[]> {
    this.calls.push({ cwd, base });
    return this.#commits;
  }
}

const APPROVED: RoundVerdict = { treeClean: true, targetAction: true };

/** One round record literal — the identity defaults are the seeding form's. */
const record = (over: Partial<RoundRecord> & { op: OpType }): RoundRecord => ({
  cycle: 1,
  attempt: 1,
  dispatchBase: null,
  verdict: APPROVED,
  violations: [],
  carrierPath: null,
  ...over,
});

/** One progress row literal — a wave key line with its records. */
const row = (wave: string, records: readonly RoundRecord[]): ProgressRow => ({
  wave,
  rounds: [...records],
});

/** One completion context literal — all seven cells, no lifecycle, no face. */
const context = (
  over: Partial<CompletionContext> & { record: RoundRecord; records: readonly RoundRecord[] },
): CompletionContext => ({
  row: row("4,5,8", over.records),
  carrier: null,
  reviewsPath: null,
  git: new StubGit(),
  repoRoot: "/repo",
  ...over,
});

describe("(a) CommitsSinceGroupBase — the group baseline decides", () => {
  it("zero commits since the group baseline is a HARD violation", async () => {
    const git = new StubGit([]);
    const records = [
      record({ op: "implement", cycle: 1, attempt: 1, dispatchBase: "base-attempt-1" }),
      record({ op: "implement", cycle: 1, attempt: 2, dispatchBase: "base-attempt-2" }),
    ];
    const verdict = await new CommitsSinceGroupBase().judge(
      context({ record: records[1]!, records, git }),
    );
    expect(verdict.fulfilled).toBe(false);
    expect(verdict.violation?.grade).toBe("hard");
    expect(verdict.violation?.cause).toBe("contract-violation");
    // The baseline asked of git is the GROUP's earliest one, never attempt 2's own.
    expect(git.calls).toEqual([{ cwd: "/repo", base: "base-attempt-1" }]);
  });

  it("at least one commit since the group baseline is completion", async () => {
    const git = new StubGit(["abc123 feat: the round's work"]);
    const records = [record({ op: "implement", dispatchBase: "base-1" })];
    const verdict = await new CommitsSinceGroupBase().judge(
      context({ record: records[0]!, records, git }),
    );
    expect(verdict).toEqual({ fulfilled: true, violation: null });
  });

  it("attempt 1 committed and attempt 2 committed nothing → still done (the group read)", async () => {
    const git = new StubGit(["abc123 feat: attempt 1's work"]);
    const records = [
      record({ op: "implement", cycle: 1, attempt: 1, dispatchBase: "base-attempt-1" }),
      record({ op: "implement", cycle: 1, attempt: 2, dispatchBase: "base-attempt-2" }),
    ];
    // attempt 2's OWN base would read empty; the group baseline sees attempt 1's commit.
    const verdict = await new CommitsSinceGroupBase().judge(
      context({ record: records[1]!, records, git }),
    );
    expect(verdict.fulfilled).toBe(true);
    expect(git.calls[0]?.base).toBe("base-attempt-1");
  });

  it("a group with no baseline at all cannot judge — hard, never a silent done", async () => {
    const records = [record({ op: "implement", dispatchBase: null })];
    const verdict = await new CommitsSinceGroupBase().judge(
      context({ record: records[0]!, records }),
    );
    expect(verdict.fulfilled).toBe(false);
    expect(verdict.violation?.grade).toBe("hard");
  });
});

describe("(b) JudgeCarrier — the carrier's findings shape decides", () => {
  it("`{ findings: [] }` is an approval, never a violation", async () => {
    const records = [record({ op: "review" })];
    const verdict = await new JudgeCarrier().judge(
      context({ record: records[0]!, records, carrier: { findings: [] } }),
    );
    expect(verdict).toEqual({ fulfilled: true, violation: null });
  });

  it("a carrier without findings is hard", async () => {
    const records = [record({ op: "review" })];
    const verdict = await new JudgeCarrier().judge(
      context({ record: records[0]!, records, carrier: {} }),
    );
    expect(verdict.fulfilled).toBe(false);
    expect(verdict.violation?.grade).toBe("hard");
  });

  it("a non-array findings value is hard", async () => {
    const records = [record({ op: "review" })];
    const verdict = await new JudgeCarrier().judge(
      context({ record: records[0]!, records, carrier: { findings: "x" } }),
    );
    expect(verdict.fulfilled).toBe(false);
    expect(verdict.violation?.grade).toBe("hard");
  });

  it("a missing carrier is hard — a review that persisted nothing is not done", async () => {
    const records = [record({ op: "review" })];
    const verdict = await new JudgeCarrier().judge(
      context({ record: records[0]!, records, carrier: null }),
    );
    expect(verdict.fulfilled).toBe(false);
    expect(verdict.violation?.grade).toBe("hard");
  });
});

describe("(c) the verb-keyed registry", () => {
  it("registers only verbs of the op set — a registered key is a real verb", () => {
    const verbs: readonly OpType[] = ["implement", "review", "fix"];
    for (const key of Object.keys(COMPLETION_CRITERIA)) {
      expect(verbs).toContain(key as OpType);
    }
    expect(Object.keys(COMPLETION_CRITERIA).sort()).toEqual(["implement", "review"]);
  });

  it("resolves the registered criteria", () => {
    expect(CompletionCriteria.of("implement")).toBeInstanceOf(CommitsSinceGroupBase);
    expect(CompletionCriteria.of("review")).toBeInstanceOf(JudgeCarrier);
  });

  it("throws at lookup for an unregistered verb (fix, until its criterion lands)", () => {
    expect(() => CompletionCriteria.of("fix")).toThrow(/no completion criterion/);
  });
});

describe("(d) the completion context is a pure shape", () => {
  it("a literal seven-cell context feeds both criteria, which read only what it carries", async () => {
    const record0 = record({ op: "implement", dispatchBase: "group-base" });
    const record1 = record({ op: "review", cycle: 2, dispatchBase: "review-base" });
    const records = [record0, record1];
    const git = new StubGit(["abc123 feat: work"]);
    const ctx = context({
      record: record1,
      records,
      carrier: { findings: [] },
      reviewsPath: "/ws/review-1.json",
      git,
      repoRoot: "/repo",
    });
    // Both cells are readable on the literal context.
    expect(ctx.records).toHaveLength(2);
    expect(ctx.reviewsPath).toBe("/ws/review-1.json");
    // The implement criterion's whole consumption face is `records` + `git`.
    const implement = await new CommitsSinceGroupBase().judge(ctx);
    expect(implement.fulfilled).toBe(true);
    expect(git.calls).toEqual([{ cwd: "/repo", base: "group-base" }]);
    // The review criterion reads the carrier cell only.
    const review = await new JudgeCarrier().judge(ctx);
    expect(review.fulfilled).toBe(true);
  });
});
