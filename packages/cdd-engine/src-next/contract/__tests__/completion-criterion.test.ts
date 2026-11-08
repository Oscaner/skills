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
//   (d) the context is a pure shape — a literal nine-cell context feeds both criteria,
//       which read only what it carries (the group baseline comes from `records`).
//   (e) the zero-diff verification branch (P30 §2.4) — a verification wave's empty
//       commit set is completion when its evidence is green, the wave's id set is READ
//       from the row key (a partial empty subset is not a verification wave), and every
//       non-verification zero-commit round keeps the `committed nothing` refusal.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GitClient } from "../../infra/git.ts";
import type {
  OpType,
  ProgressRow,
  RoundIdentity,
  RoundRecord,
  RoundVerdict,
} from "../../session/ledger.ts";
import {
  COMPLETION_CRITERIA,
  CommitsSinceGroupBase,
  type CompletionContext,
  CompletionCriteria,
  type CompletionVerdict,
  FIX_DISPOSITIONS_ZERO_COMMIT,
  FixDispositions,
  IMPLEMENT_CARRIER_ABSENT,
  IMPLEMENT_VERIFICATION_WAVE,
  JudgeCarrier,
} from "../completion-criterion.ts";

/** The git read face stub — records the baseline each judgment asked git about, so a
 *  case can pin WHICH baseline the criterion used (the group's, never the round's).
 *  `byBase` answers per baseline, so a case can say "the group's implement committed,
 *  THIS fix round did not" — the pair the zero-commit observation discriminates. */
class StubGit extends GitClient {
  readonly calls: { cwd: string; base: string | null }[] = [];
  readonly #commits: readonly string[];
  readonly #byBase: Readonly<Record<string, readonly string[]>>;

  constructor(
    commits: readonly string[] = [],
    byBase: Readonly<Record<string, readonly string[]>> = {},
  ) {
    super();
    this.#commits = commits;
    this.#byBase = byBase;
  }

  override async commitsSince(cwd: string, base: string | null): Promise<readonly string[]> {
    this.calls.push({ cwd, base });
    return this.#byBase[base ?? ""] ?? this.#commits;
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

/** One completion context literal — all nine cells, no lifecycle, no face. The two
 *  verification cells default to the REFUSING pair (no empty-`Files` task, evidence not
 *  green), so a case that does not care about them can never read as a verification
 *  wave by omission. */
const context = (
  over: Partial<CompletionContext> & {
    record: RoundIdentity;
    records: readonly RoundRecord[];
  },
): CompletionContext => ({
  row: row("4,5,8", over.records),
  carrier: null,
  reviewsPath: null,
  git: new StubGit(),
  repoRoot: "/repo",
  emptyFileTasks: new Set<number>(),
  evidenceOk: false,
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
      context({ record: records[0]!, records, git, carrier: { status: "APPROVED" } }),
    );
    expect(verdict).toEqual({ fulfilled: true, violation: null });
  });

  it("a completed round with NO handoff carrier keeps its completion and books ONE soft observation (spec §3.3)", async () => {
    const git = new StubGit(["abc123 feat: the round's work"]);
    const records = [record({ op: "implement", dispatchBase: "base-1" })];
    const verdict = await new CommitsSinceGroupBase().judge(
      context({ record: records[0]!, records, git }),
    );
    // the commits decided the round — the absent draft never gates it
    expect(verdict.fulfilled).toBe(true);
    expect(verdict.violation).toBeNull();
    expect(verdict.observations).toEqual([
      { grade: "soft", cause: "contract-violation", message: IMPLEMENT_CARRIER_ABSENT },
    ]);
  });

  it("a group's FIRST dispatch is judged against the round's OWN base — the group has no record yet", async () => {
    const git = new StubGit(["abc123 feat: the round's work"]);
    // the ledger holds no record while the round is judged (it is booked afterwards)
    const first = record({ op: "implement", dispatchBase: "base-first" });
    const verdict = await new CommitsSinceGroupBase().judge(
      context({ record: first, records: [], git, carrier: {} }),
    );
    expect(verdict.fulfilled).toBe(true);
    expect(git.calls).toEqual([{ cwd: "/repo", base: "base-first" }]);
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

  it("reads the KILLED round's base as the group baseline — the recovery commit lands after it", async () => {
    // The abort fold's booking (P30 §2.2): `targetAction: false`, ONE hard
    // `interrupted` entry, and the killed round's OWN `dispatchBase`. The re-dispatch
    // starts at `base-C`, so the recovery commit (B → C) is visible only from B.
    const abort: RoundRecord = record({
      op: "implement",
      cycle: 1,
      attempt: 1,
      dispatchBase: "base-B",
      verdict: { treeClean: true, targetAction: false },
      violations: [{ grade: "hard", cause: "interrupted", message: "interrupted" }],
    });
    const retry = record({ op: "implement", cycle: 1, attempt: 2, dispatchBase: "base-C" });
    const git = new StubGit(["abc123 fix: the recovery commit"]);
    const verdict = await new CommitsSinceGroupBase().judge(
      context({ record: retry, records: [abort], git, carrier: { status: "APPROVED" } }),
    );
    expect(verdict.fulfilled).toBe(true);
    expect(git.calls).toEqual([{ cwd: "/repo", base: "base-B" }]);
  });

  it("a legacy abort record with a null baseline keeps the earlier valued baseline", async () => {
    // An aborted record written before `dispatchBase` existed carries the honest null;
    // the group baseline falls back to the earlier VALUED record, never an invention.
    const first = record({ op: "implement", cycle: 1, attempt: 1, dispatchBase: "base-A" });
    const legacyAbort = record({
      op: "implement",
      cycle: 1,
      attempt: 2,
      dispatchBase: null,
      verdict: { treeClean: true, targetAction: false },
      violations: [{ grade: "hard", cause: "interrupted", message: "interrupted" }],
    });
    const retry = record({ op: "implement", cycle: 1, attempt: 3, dispatchBase: "base-C" });
    const git = new StubGit(["abc123 feat: the work"]);
    const verdict = await new CommitsSinceGroupBase().judge(
      context({
        record: retry,
        records: [first, legacyAbort],
        git,
        carrier: { status: "APPROVED" },
      }),
    );
    expect(verdict.fulfilled).toBe(true);
    expect(git.calls).toEqual([{ cwd: "/repo", base: "base-A" }]);
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

describe("(a2) CommitsSinceGroupBase — the zero-diff verification branch", () => {
  /** The wave-under-judgment fixture — one implement round, the wave key `1,2`, zero
   *  commits since the baseline. Each case overrides exactly the cell it judges. */
  const zeroCommit = async (over: Partial<CompletionContext>): Promise<CompletionVerdict> => {
    const records = [record({ op: "implement", dispatchBase: "base-1" })];
    return new CommitsSinceGroupBase().judge(
      context({
        record: records[0]!,
        records,
        git: new StubGit([]),
        carrier: { status: "APPROVED", artifacts: {} },
        ...over,
      }),
    );
  };

  it("a verification wave with green evidence concludes, and books ONE soft observation", async () => {
    const verdict = await zeroCommit({
      row: row("1,2", []),
      emptyFileTasks: new Set([1, 2]),
      evidenceOk: true,
    });
    expect(verdict.fulfilled).toBe(true);
    expect(verdict.violation).toBeNull();
    expect(verdict.observations).toEqual([
      { grade: "soft", cause: "contract-violation", message: IMPLEMENT_VERIFICATION_WAVE },
    ]);
  });

  it("the same fixture with red evidence is still BLOCKED, and the reason names the gap", async () => {
    const verdict = await zeroCommit({
      row: row("1,2", []),
      emptyFileTasks: new Set([1, 2]),
      evidenceOk: false,
    });
    expect(verdict.fulfilled).toBe(false);
    expect(verdict.violation?.grade).toBe("hard");
    expect(verdict.violation?.message).toContain("test evidence is not green");
  });

  it("reads the wave's id set from the row key — a PARTIAL empty subset is never a verification wave", async () => {
    // The pair differs in ONE cell: the empty-`Files` membership set. `{1}` is a
    // subset of the wave `1,2`, so a "some task declares no files" reading would pass
    // it; the whole-set reading refuses.
    const partial = await zeroCommit({
      row: row("1,2", []),
      emptyFileTasks: new Set([1]),
      evidenceOk: true,
    });
    expect(partial.fulfilled).toBe(false);
    expect(partial.violation?.message).toContain("committed nothing since its baseline");
    const whole = await zeroCommit({
      row: row("1,2", []),
      emptyFileTasks: new Set([1, 2]),
      evidenceOk: true,
    });
    expect(whole.fulfilled).toBe(true);
  });

  it("a wave key that declares no task id is never a verification wave — the empty set is not a vacuous pass", async () => {
    const verdict = await zeroCommit({
      row: row("", []),
      emptyFileTasks: new Set(),
      evidenceOk: true,
    });
    expect(verdict.fulfilled).toBe(false);
    expect(verdict.violation?.grade).toBe("hard");
  });

  it("a verification wave with NO handoff carrier books both soft observations, never a gate", async () => {
    const verdict = await zeroCommit({
      row: row("2", []),
      emptyFileTasks: new Set([2]),
      evidenceOk: true,
      carrier: null,
    });
    expect(verdict.fulfilled).toBe(true);
    expect(verdict.observations?.map((entry) => entry.message)).toEqual([
      IMPLEMENT_VERIFICATION_WAVE,
      IMPLEMENT_CARRIER_ABSENT,
    ]);
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
  it("registers exactly the op verbs once every criterion lands — the completeness pin", () => {
    const verbs: readonly OpType[] = ["implement", "review", "fix"];
    for (const key of Object.keys(COMPLETION_CRITERIA)) {
      expect(verbs).toContain(key as OpType);
    }
    // Completeness: the registered key set EQUALS the verb set (no verb may fall
    // through to the unregistered lookup's throw once its criterion has landed).
    expect(Object.keys(COMPLETION_CRITERIA).sort()).toEqual([...verbs].sort());
  });

  it("resolves the registered criteria", () => {
    expect(CompletionCriteria.of("implement")).toBeInstanceOf(CommitsSinceGroupBase);
    expect(CompletionCriteria.of("review")).toBeInstanceOf(JudgeCarrier);
    expect(CompletionCriteria.of("fix")).toBeInstanceOf(FixDispositions);
  });

  it("throws at lookup for a verb outside the op set", () => {
    expect(() => CompletionCriteria.of("branch-review" as OpType)).toThrow(
      /no completion criterion/,
    );
  });
});

describe("(d) the completion context is a pure shape", () => {
  it("a literal nine-cell context feeds both criteria, which read only what it carries", async () => {
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
    // Both read seams are readable on the literal context.
    expect(ctx.records).toHaveLength(2);
    expect(ctx.reviewsPath).toBe("/ws/review-1.json");
    // The two verification cells (P30 §2.4) are readable here too.
    expect(ctx.emptyFileTasks.size).toBe(0);
    expect(ctx.evidenceOk).toBe(false);
    // The implement criterion's whole consumption face is `records` + `git`.
    const implement = await new CommitsSinceGroupBase().judge(ctx);
    expect(implement.fulfilled).toBe(true);
    expect(git.calls).toEqual([{ cwd: "/repo", base: "group-base" }]);
    // The review criterion reads the carrier cell only.
    const review = await new JudgeCarrier().judge(ctx);
    expect(review.fulfilled).toBe(true);
  });

  it("the judged record is a verdict-FREE identity — a verdict is never an input to its own judgment", async () => {
    // The lifecycle hands the criteria the round's identity alone (op / cycle /
    // attempt / dispatchBase / carrierPath): the verdict the judgment produces has no
    // cell here, so no criterion can read its own conclusion as an input.
    const identity: RoundIdentity = {
      op: "implement",
      cycle: 1,
      attempt: 1,
      dispatchBase: "group-base",
      carrierPath: null,
    };
    const git = new StubGit(["abc123 feat: work"]);
    const verdict = await new CommitsSinceGroupBase().judge(
      context({ record: identity, records: [], git }),
    );
    expect(verdict.fulfilled).toBe(true);
    expect(git.calls).toEqual([{ cwd: "/repo", base: "group-base" }]);
    // No `verdict` / `violations` key exists to be mistaken for a real record.
    expect(Object.keys(identity).sort()).toEqual([
      "attempt",
      "carrierPath",
      "cycle",
      "dispatchBase",
      "op",
    ]);
  });
});

// ---------------------------------------------------------------------------
// (e)–(g) FixDispositions — a fix round is done when its dispositions cover
// every finding of the REQUESTING review carrier (design spec §3.4)
// ---------------------------------------------------------------------------

/** The round's own work carrier — one disposition per requesting finding. */
const DISPOSITIONS = {
  status: "APPROVED",
  artifacts: {},
  dispositions: { drift: { status: "fixed" } },
};

/** A temp fixture holding the requesting review carrier on disk, so a case can name
 *  a real path and delete the requester independently of the round's own carrier. */
class CarrierFixture {
  readonly dir: string;
  readonly requesterPath: string;

  constructor(requester: unknown | null) {
    this.dir = mkdtempSync(path.join(tmpdir(), "fix-dispositions-"));
    this.requesterPath = path.join(this.dir, "tasks-1-review-1.json");
    if (requester !== null) {
      writeFileSync(this.requesterPath, JSON.stringify(requester), "utf8");
    }
  }

  cleanup(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** The two-finding requester carrier — the input set `drift` + `typo`. */
const REQUESTER = {
  findings: [
    { severity: "blocker", lens: "scope", summary: "drift" },
    { severity: "warn", lens: "spec", summary: "typo" },
  ],
};

/** The fix round's group records — the implement baseline, the requesting review
 *  round of the SAME cycle (`carrierPath` is the requesting side's read seam) and
 *  the fix round itself. */
const fixRecords = (requesterCarrierPath: string | null): readonly RoundRecord[] => [
  record({ op: "implement", cycle: 1, dispatchBase: "group-base" }),
  record({
    op: "review",
    cycle: 2,
    dispatchBase: "review-base",
    carrierPath: requesterCarrierPath,
  }),
  record({ op: "fix", cycle: 2, attempt: 1, dispatchBase: "fix-base" }),
];

/** The fix context — the round's own carrier + the group records + the two request
 *  seams (`reviewsPath` stands in for the fix route's `--reviews` argument). */
const fixContext = (
  own: unknown,
  seams: { carrierPath?: string | null; reviewsPath?: string | null } = {},
  over: Partial<CompletionContext> = {},
): CompletionContext => {
  const records = fixRecords(seams.carrierPath ?? null);
  return context({
    record: records[2]!,
    records,
    carrier: own,
    reviewsPath: seams.reviewsPath ?? null,
    ...over,
  });
};

describe("(e) FixDispositions — the six hard refusals", () => {
  it("① the round's own work carrier is missing → hard, naming the carrier path", async () => {
    const verdict = await new FixDispositions().judge(
      fixContext(
        null,
        {},
        { record: record({ op: "fix", cycle: 2, carrierPath: "/ws/tasks-1-fix-1.json" }) },
      ),
    );
    expect(verdict.fulfilled).toBe(false);
    expect(verdict.violation?.grade).toBe("hard");
    expect(verdict.violation?.message).toContain("/ws/tasks-1-fix-1.json");
  });

  it("② the carrier is present but declares no `dispositions` slot → hard", async () => {
    const verdict = await new FixDispositions().judge(
      fixContext({ status: "APPROVED", artifacts: {} }),
    );
    expect(verdict.violation?.grade).toBe("hard");
    expect(verdict.violation?.message).toContain("dispositions");
  });

  it("③ a missing entry (a finding with no disposition) → hard, naming the finding", async () => {
    const fixture = new CarrierFixture(REQUESTER);
    try {
      const verdict = await new FixDispositions().judge(
        fixContext(
          { status: "APPROVED", dispositions: { drift: { status: "fixed" } } },
          { carrierPath: fixture.requesterPath },
        ),
      );
      expect(verdict.violation?.grade).toBe("hard");
      expect(verdict.violation?.message).toContain("typo");
    } finally {
      fixture.cleanup();
    }
  });

  it("④ a disposition key outside the input set → hard, naming the unknown finding", async () => {
    const fixture = new CarrierFixture({ findings: [{ severity: "nit", summary: "drift" }] });
    try {
      const verdict = await new FixDispositions().judge(
        fixContext(
          {
            status: "APPROVED",
            dispositions: { drift: { status: "fixed" }, stale: { status: "fixed" } },
          },
          { carrierPath: fixture.requesterPath },
        ),
      );
      expect(verdict.violation?.grade).toBe("hard");
      expect(verdict.violation?.message).toContain("stale");
    } finally {
      fixture.cleanup();
    }
  });

  it("⑤ the requesting carrier is missing on disk → hard, naming ITS path (never the round's own)", async () => {
    // The round's own carrier exists; the requesting record's `carrierPath` is null, so
    // the read falls back to `reviewsPath` — which is not on disk. The criterion reads
    // the requester, so this is hard despite a sound own carrier.
    const fixture = new CarrierFixture(null);
    try {
      const verdict = await new FixDispositions().judge(
        fixContext(DISPOSITIONS, { reviewsPath: fixture.requesterPath }),
      );
      expect(verdict.violation?.grade).toBe("hard");
      expect(verdict.violation?.message).toContain(fixture.requesterPath);
    } finally {
      fixture.cleanup();
    }
  });

  it("⑤(b) a requesting finding without a string `summary` → hard, never a silent skip", async () => {
    // `summary` is schema-required, yet the carrier is only JSON.parsed here: a
    // dropped finding would owe no disposition and pass forever.
    const fixture = new CarrierFixture({ findings: [{ severity: "blocker", lens: "spec" }] });
    try {
      const verdict = await new FixDispositions().judge(
        fixContext(
          { status: "APPROVED", dispositions: {} },
          { carrierPath: fixture.requesterPath },
        ),
      );
      expect(verdict.fulfilled).toBe(false);
      expect(verdict.violation?.grade).toBe("hard");
      expect(verdict.violation?.message).toContain(fixture.requesterPath);
      expect(verdict.violation?.message).toContain("finding #0");
    } finally {
      fixture.cleanup();
    }
  });

  it("⑥ a `rejected` disposition without a reason → hard, naming the finding", async () => {
    const fixture = new CarrierFixture(REQUESTER);
    try {
      const verdict = await new FixDispositions().judge(
        fixContext(
          {
            status: "APPROVED",
            dispositions: { drift: { status: "rejected" }, typo: { status: "fixed" } },
          },
          { carrierPath: fixture.requesterPath },
        ),
      );
      expect(verdict.violation?.grade).toBe("hard");
      expect(verdict.violation?.message).toContain("drift");
      expect(verdict.violation?.message).toContain("reason");
    } finally {
      fixture.cleanup();
    }
  });
});

describe("(f) FixDispositions — completion, empty input, the legacy skip and zero commits", () => {
  it("(a) one disposition per finding → completion", async () => {
    const fixture = new CarrierFixture(REQUESTER);
    try {
      const verdict = await new FixDispositions().judge(
        fixContext(
          {
            status: "APPROVED",
            dispositions: {
              drift: { status: "fixed" },
              typo: { status: "rejected", reason: "the review misread the guard" },
            },
          },
          { carrierPath: fixture.requesterPath },
          { git: new StubGit(["abc123 feat: the round's work"]) },
        ),
      );
      expect(verdict).toEqual({ fulfilled: true, violation: null, observations: [] });
    } finally {
      fixture.cleanup();
    }
  });

  it("(b) an empty findings array is legal input — an empty key set and one soft observation", async () => {
    const fixture = new CarrierFixture({ findings: [] });
    try {
      const verdict = await new FixDispositions().judge(
        fixContext(
          { status: "APPROVED", dispositions: {} },
          { carrierPath: fixture.requesterPath },
          { git: new StubGit(["abc123 feat: the round's work"]) },
        ),
      );
      expect(verdict.fulfilled).toBe(true);
      expect(verdict.violation).toBeNull();
      // Empty input is legal: a soft observation, never a failure.
      expect(verdict.observations).toHaveLength(1);
      expect(verdict.observations?.[0]?.grade).toBe("soft");
    } finally {
      fixture.cleanup();
    }
  });

  it("(c) a legacy record without `carrierPath` skips the judgment — a visible observation, never an empty set", async () => {
    const verdict = await new FixDispositions().judge(
      fixContext(DISPOSITIONS, {}, { git: new StubGit(["abc123 feat: the round's work"]) }),
    );
    // Not hard: the criterion cannot name a requesting carrier, and reading that as
    // "no findings" would reinstall an always-passing judgment.
    expect(verdict.fulfilled).toBe(true);
    expect(verdict.violation).toBeNull();
    expect(verdict.observations).toHaveLength(1);
    expect(verdict.observations?.[0]?.grade).toBe("soft");
    expect(verdict.observations?.[0]?.message).toContain("carrierPath");
  });

  it("(f) a fix round with zero commits is a soft observation, never a failure", async () => {
    const fixture = new CarrierFixture(REQUESTER);
    try {
      // The round edited no file, yet its carrier answers the judgment — the zero
      // commit count is bookkeeping, not a refusal.
      const verdict = await new FixDispositions().judge(
        fixContext(
          {
            status: "APPROVED",
            dispositions: {
              drift: { status: "fixed" },
              typo: { status: "fixed" },
            },
          },
          { carrierPath: fixture.requesterPath },
          { git: new StubGit([]) },
        ),
      );
      expect(verdict.fulfilled).toBe(true);
      expect(verdict.observations).toHaveLength(1);
      expect(verdict.observations?.[0]?.grade).toBe("soft");
      expect(verdict.observations?.[0]?.message).toBe(FIX_DISPOSITIONS_ZERO_COMMIT);
    } finally {
      fixture.cleanup();
    }
  });

  it("(f2) the zero-commit observation is measured from THIS round's own dispatch base", async () => {
    const fixture = new CarrierFixture(REQUESTER);
    try {
      // The group's implement round committed; THIS fix round committed nothing. Read
      // against the GROUP baseline the case would be silent — and on the production
      // face the group baseline always carries the implement round's commit (an
      // implement round that committed nothing hard-fails its own criterion first).
      const git = new StubGit([], { "group-base": ["abc123 feat: the implement round"] });
      const verdict = await new FixDispositions().judge(
        fixContext(
          {
            status: "APPROVED",
            dispositions: { drift: { status: "fixed" }, typo: { status: "fixed" } },
          },
          { carrierPath: fixture.requesterPath },
          { git },
        ),
      );
      expect(verdict.fulfilled).toBe(true);
      expect(verdict.observations?.map((row) => row.message)).toEqual([
        FIX_DISPOSITIONS_ZERO_COMMIT,
      ]);
      // The baseline asked of git is the fix record's OWN, never the group's.
      expect(git.calls).toEqual([{ cwd: "/repo", base: "fix-base" }]);
    } finally {
      fixture.cleanup();
    }
  });

  it("dedupes repeated summaries — one defect owes one disposition", async () => {
    const fixture = new CarrierFixture({
      findings: [
        { severity: "blocker", summary: "drift" },
        { severity: "warn", summary: "drift" },
      ],
    });
    try {
      const verdict = await new FixDispositions().judge(
        fixContext(
          { status: "APPROVED", dispositions: { drift: { status: "fixed" } } },
          { carrierPath: fixture.requesterPath },
          { git: new StubGit(["abc123 feat: the round's work"]) },
        ),
      );
      expect(verdict.fulfilled).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("(g) FixDispositions#summaryOf — the counts the summary line renders", () => {
  it("counts `fixed 2 · rejected 1` from the dispositions and the input set", () => {
    const carrier = {
      status: "APPROVED",
      dispositions: {
        drift: { status: "fixed" },
        typo: { status: "fixed" },
        nit: { status: "rejected", reason: "out of scope" },
        // Not in the input set — never counted (the line reads the same pair the
        // judgment reads).
        stale: { status: "fixed" },
      },
    };
    expect(new FixDispositions().summaryOf(carrier, ["drift", "typo", "nit"])).toEqual({
      fixed: 2,
      rejected: 1,
    });
  });

  it("returns the zero pair for an empty input set and an absent slot", () => {
    expect(new FixDispositions().summaryOf({ status: "APPROVED", dispositions: {} }, [])).toEqual({
      fixed: 0,
      rejected: 0,
    });
    expect(new FixDispositions().summaryOf({ status: "APPROVED" }, [])).toEqual({
      fixed: 0,
      rejected: 0,
    });
  });
});

describe("(h) the requesting carrier's read basis — repoRoot, never process.cwd()", () => {
  it("resolves a repoRoot-relative requester path when the engine runs from a subdirectory", async () => {
    const fixture = new CarrierFixture(REQUESTER);
    const subdir = path.join(fixture.dir, "packages", "cdd-engine");
    mkdirSync(subdir, { recursive: true });
    const cwdBefore = process.cwd();
    try {
      process.chdir(subdir);
      const verdict = await new FixDispositions().judge(
        fixContext(
          {
            status: "APPROVED",
            dispositions: { drift: { status: "fixed" }, typo: { status: "fixed" } },
          },
          // Both seams repoRoot-relative: the record's `carrierPath` and the route's
          // `--reviews` value (the CLI normalizes argv paths to a `RepoPath`).
          { carrierPath: "tasks-1-review-1.json", reviewsPath: "tasks-1-review-1.json" },
          { repoRoot: fixture.dir, git: new StubGit(["abc123 feat: the round's work"]) },
        ),
      );
      expect(verdict).toEqual({ fulfilled: true, violation: null, observations: [] });
    } finally {
      process.chdir(cwdBefore);
      fixture.cleanup();
    }
  });
});
