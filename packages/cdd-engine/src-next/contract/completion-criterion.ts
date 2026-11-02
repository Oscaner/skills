// packages/cdd-engine/src-next/contract/completion-criterion.ts
// P22 T4 — "is this round done?" as two criteria behind ONE verb-keyed registry
// (design spec §8 · the completion-criterion row): `implement` is done when the
// group's baseline carries at least one commit, `review` (branch review included —
// branch-review folds to the review op) is done when its carrier is schema-shaped.
//
// The criterion judges a CompletionContext the dispatch side assembles (Task 7):
// the round's record, its ledger row, the row's in-register records, the persisted
// carrier bytes, the requester's review path and the git read face. The two cells
// with a provider seam (`records`, `reviewsPath`) are filled by `CliLifecycle` — this
// module pins the context SHAPE only and imports neither `face/` nor the lifecycle.
//
// The registry is deliberately PARTIAL while the verbs are ported one at a time: a
// verb with no criterion throws at lookup (`CompletionCriteria.of`), so a dispatch of
// an unported verb can never silently read as "done".
//
// judge() is async because the implement criterion reads git (`GitClient.commitsSince`).
//
// Module-level exports are types / the declared registry / the class — zero
// behavior-carrying bare functions.

import type { GitClient } from "../infra/git.ts";
import type { OpType, ProgressRow, RoundRecord, RoundViolation } from "../session/ledger.ts";

/** The judgment input — the round's own facts, its group's records, the carrier bytes
 *  and the two read seams (git + the requester's review path). */
export interface CompletionContext {
  /** The round under judgment — its identity and its recorded verdict. */
  readonly record: RoundRecord;
  /** The progress row the round belongs to (the wave key's line). */
  readonly row: ProgressRow;
  /** The row's in-register records (the group's history) — `CommitsSinceGroupBase`
   *  derives the group baseline from them, `FixDispositions` finds the request-side
   *  review round of the same key + cycle. */
  readonly records: readonly RoundRecord[];
  /** The persisted carrier bytes (parsed), or null when the round wrote none. */
  readonly carrier: unknown;
  /** The requesting side's review carrier path (the fix round's `--reviews` input);
   *  null when the round's verb has no requester side. */
  readonly reviewsPath: string | null;
  /** The git read seam (the commits-since read). */
  readonly git: GitClient;
  /** The repo root the git read runs against. */
  readonly repoRoot: string;
}

/** One criterion's verdict — done or one graded violation (hard fails the round,
 *  soft is bookkeeping only). `violation` is null exactly when `fulfilled` is true. */
export interface CompletionVerdict {
  readonly fulfilled: boolean;
  readonly violation: RoundViolation | null;
}

/** The completion criterion contract — one verb's "is this round done?" answer. */
export interface CompletionCriterion {
  judge(ctx: CompletionContext): Promise<CompletionVerdict>;
}

/**
 * CommitsSinceGroupBase — the implement criterion: the round is done when the GROUP
 * has at least one commit since the group's baseline (design spec §8).
 *
 * The baseline is the EARLIEST record's `dispatchBase` of the group — not the round's
 * own. A group re-dispatched after a failed attempt carries a newer per-attempt base,
 * so comparing against the round's own base would read "attempt 1 committed, attempt 2
 * committed nothing" as an empty round (the cross-attempt false negative the group
 * baseline exists to prevent).
 */
export class CommitsSinceGroupBase implements CompletionCriterion {
  /** The group baseline — the first record (ledger order = cycle/attempt order) that
   *  carries a `dispatchBase`. Records without one (legacy folds, a non-git tree) are
   *  skipped: they carry no present fact. Null when the group carries none. */
  static groupBaseOf(records: readonly RoundRecord[]): string | null {
    for (const record of records) {
      if (record.dispatchBase !== null) return record.dispatchBase;
    }
    return null;
  }

  async judge(ctx: CompletionContext): Promise<CompletionVerdict> {
    const base = CommitsSinceGroupBase.groupBaseOf(ctx.records);
    if (base === null) {
      return this.#hard(
        "the round's group carries no dispatch baseline — a completion judgment needs the HEAD the group started from",
      );
    }
    const commits = await ctx.git.commitsSince(ctx.repoRoot, base);
    if (commits.length > 0) return { fulfilled: true, violation: null };
    return this.#hard(`the group committed nothing since its baseline ${base}`);
  }

  /** The hard verdict of this criterion — the ledger's existing `contract-violation`
   *  cause, never a new violation enum row. */
  #hard(message: string): CompletionVerdict {
    return { fulfilled: false, violation: { grade: "hard", cause: "contract-violation", message } };
  }
}

/**
 * JudgeCarrier — the review criterion: a review round is done exactly when its
 * carrier is a schema-shaped judge payload — a JSON object whose `findings` is an
 * array. An EMPTY findings array is a valid approval (`findings: []` → APPROVED), so
 * emptiness is never a violation; an absent carrier or a non-array `findings` is.
 */
export class JudgeCarrier implements CompletionCriterion {
  judge(ctx: CompletionContext): Promise<CompletionVerdict> {
    const carrier = ctx.carrier;
    if (carrier === null || typeof carrier !== "object" || Array.isArray(carrier)) {
      return Promise.resolve(this.#hard("the review round persisted no judge carrier"));
    }
    const findings = (carrier as Record<string, unknown>).findings;
    if (!Array.isArray(findings)) {
      return Promise.resolve(
        this.#hard("the review carrier declares no `findings` array — the judge plane requires it"),
      );
    }
    return Promise.resolve({ fulfilled: true, violation: null });
  }

  /** The hard verdict of this criterion — same cause vocabulary as the ledger's. */
  #hard(message: string): CompletionVerdict {
    return { fulfilled: false, violation: { grade: "hard", cause: "contract-violation", message } };
  }
}

/** The verb-keyed criterion registry — PARTIAL on purpose: a verb is registered when
 *  its criterion lands (branch review folds to `review`, so it needs no own row). */
export const COMPLETION_CRITERIA: Readonly<Partial<Record<OpType, CompletionCriterion>>> = {
  implement: new CommitsSinceGroupBase(),
  review: new JudgeCarrier(),
};

/** The registry's lookup face — an unregistered verb throws at lookup, so a dispatch
 *  of an unported verb can never fall through to an invented "done". */
// biome-ignore lint/complexity/noStaticOnlyClass: the lookup single point — the registry's derivation surface, never a second free-floating predicate.
export class CompletionCriteria {
  static of(op: OpType): CompletionCriterion {
    const criterion = COMPLETION_CRITERIA[op];
    if (criterion === undefined) {
      throw new Error(`no completion criterion is registered for the "${op}" verb`);
    }
    return criterion;
  }
}
