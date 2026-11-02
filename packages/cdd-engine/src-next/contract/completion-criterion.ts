// packages/cdd-engine/src-next/contract/completion-criterion.ts
// P22 T4/T6 — "is this round done?" as criteria behind ONE verb-keyed registry
// (design spec §8 · the completion-criterion row): `implement` is done when the
// group's baseline carries at least one commit, `review` (branch review included —
// branch-review folds to the review op) is done when its carrier is schema-shaped,
// and `fix` is done when its work carrier's `dispositions` cover every finding of
// the REQUESTING review carrier (design spec §3.4).
//
// The criterion judges a CompletionContext the dispatch side assembles (Task 7):
// the round's record, its ledger row, the row's in-register records, the persisted
// carrier bytes, the requester's review path, the git read face and the repoRoot
// path basis. The two cells with a provider seam (`records`, `reviewsPath`) are
// filled by `CliLifecycle` — this module pins the context SHAPE only and imports
// neither `face/` nor the lifecycle.
//
// The registry is deliberately PARTIAL while the verbs are ported one at a time: a
// verb with no criterion throws at lookup (`CompletionCriteria.of`), so a dispatch of
// an unported verb can never silently read as "done".
//
// judge() is async because the implement criterion reads git (`GitClient.commitsSince`).
//
// Module-level exports are types / the declared registry / the class — zero
// behavior-carrying bare functions.

import { readFileSync } from "node:fs";
import path from "node:path";
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
 *  soft is bookkeeping only). `violation` is null exactly when `fulfilled` is true.
 *  `observations` is the SOFT family (design spec §3.3): hygiene facts a completed
 *  round may carry — they never gate the round (a soft row is not a failure), and a
 *  completed round with no observation carries an empty list. */
export interface CompletionVerdict {
  readonly fulfilled: boolean;
  readonly violation: RoundViolation | null;
  readonly observations?: readonly RoundViolation[];
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

/** The zero-commit observation of a fix round — a NEW literal (the engine had no
 *  reusable zero-commit warning; `commitsSince` fed the crash postmortem alone).
 *  The yardstick is THIS round's own `dispatchBase`: the implement criterion asks
 *  "did the group produce any work?", this observation asks "did this round leave a
 *  commit?" — the group baseline would answer the first question and stay silent
 *  forever here (the group's implement round committed, or it never got here).
 *  Bookkeeping: a fix round is judged by its carrier, never by its diff. */
export const FIX_DISPOSITIONS_ZERO_COMMIT =
  "the fix round committed nothing since its dispatch base — the dispositions judged the round, not the diff";

/** The empty-input observation — an empty requesting carrier is legal input, so it
 *  is reported, never refused. */
export const FIX_DISPOSITIONS_EMPTY_INPUT =
  "the requesting review carrier carries no findings — the fix round owes no dispositions";

/** The legacy-record observation — no requesting carrier is locatable, so the
 *  judgment is skipped visibly (reading the gap as an empty input set would restore
 *  an always-passing criterion). */
export const FIX_DISPOSITIONS_UNRECORDED =
  "the requesting review round records no carrierPath and the route carried no --reviews path — the disposition judgment is skipped";

/** One read of the requesting review carrier — the input set's provenance. A path
 *  neither recorded nor handed over is `unrecorded` (legacy); a path that yields no
 *  readable findings array — or a finding whose `summary` is not a string — is
 *  `unreadable` (hard: "the evidence is gone" is not "there were no findings", and a
 *  silently dropped finding is a vacuously passing criterion). `detail` names the
 *  defect beyond the path (the entry index of a malformed finding), never a slogan. */
export type RequesterRead =
  | { readonly kind: "unrecorded" }
  | { readonly kind: "unreadable"; readonly path: string; readonly detail: string }
  | { readonly kind: "read"; readonly path: string; readonly summaries: readonly string[] };

/** The summary line's two counts — the criterion's half of the design spec §3.4
 *  summary row: counts only, so the presentation plane (the `face/words.ts` template)
 *  stays the sole renderer and this module imports no presentation. */
export interface DispositionCounts {
  readonly fixed: number;
  readonly rejected: number;
}

/**
 * FixDispositions — the fix criterion: the round is done when its work carrier's
 * `dispositions` cover every finding of the requesting review carrier (design spec
 * §3.4). The input set is the REQUESTING side's carrier — the same-key same-cycle
 * completed review record's `carrierPath`, falling back to the fix route's
 * `--reviews` path; the round's own `carrierPath` is never the input set.
 *
 * Keys are the findings' `summary` strings VERBATIM (no normalization, no
 * fingerprint); repeated summaries collapse to one key (one defect owes one
 * disposition). Values are `{ status: "fixed" | "rejected", reason?: string }` —
 * `rejected` without a reason is a shape violation, hard like the missing slot.
 *
 * The fix round's zero-commit fact is an OBSERVATION, not a refusal: this criterion
 * answers from the carrier, never from the diff.
 */
export class FixDispositions implements CompletionCriterion {
  /** The requesting carrier's path — the completed review record of the SAME key (the
   *  row's records are already the key's) and the SAME cycle as the fix round; a
   *  legacy record without `carrierPath` falls back to the route's `--reviews` path. */
  static requesterPathOf(
    records: readonly RoundRecord[],
    cycle: number,
    reviewsPath: string | null,
  ): string | null {
    for (const record of records) {
      if (record.op !== "review" || record.cycle !== cycle) continue;
      if (!record.verdict.targetAction) continue;
      return record.carrierPath ?? reviewsPath;
    }
    return reviewsPath;
  }

  /** Read the requesting carrier's input set (the summaries, deduped in order). The
   *  read is synchronous on purpose: the input is ONE small carrier, and the dispatch
   *  face already reads its small inputs synchronously at the same seam.
   *
   *  Every path resolves against `repoRoot`, never `process.cwd()`: the engine runs
   *  from a subdirectory too, `--reviews` arrives repoRoot-relative and a record's
   *  `carrierPath` arrives absolute — both must land on the one basis (`RepoRoot`'s
   *  rule). The reported `path` is the resolved one, so a failure names a real file. */
  static requesterInputOf(
    records: readonly RoundRecord[],
    cycle: number,
    reviewsPath: string | null,
    repoRoot: string,
  ): RequesterRead {
    const declared = FixDispositions.requesterPathOf(records, cycle, reviewsPath);
    if (declared === null) return { kind: "unrecorded" };
    const target = path.resolve(repoRoot, declared);
    let carrier: unknown;
    try {
      carrier = JSON.parse(readFileSync(target, "utf8")) as unknown;
    } catch {
      return { kind: "unreadable", path: target, detail: "the file is absent or not JSON" };
    }
    const findings = (carrier as { findings?: unknown } | null)?.findings;
    if (!Array.isArray(findings)) {
      return {
        kind: "unreadable",
        path: target,
        detail: "the carrier declares no `findings` array",
      };
    }
    const set = FixDispositions.#summariesOf(findings);
    if ("index" in set) {
      return {
        kind: "unreadable",
        path: target,
        detail: `finding #${set.index} carries no string \`summary\``,
      };
    }
    return { kind: "read", path: target, summaries: set.summaries };
  }

  /** The carrier's `dispositions` map — null when the slot is absent or not an
   *  object (the criterion's own shape refusal; the schema only pins the slot type). */
  static dispositionsOf(carrier: unknown): Record<string, unknown> | null {
    if (carrier === null || typeof carrier !== "object" || Array.isArray(carrier)) return null;
    const dispositions = (carrier as Record<string, unknown>).dispositions;
    if (dispositions === null || typeof dispositions !== "object" || Array.isArray(dispositions))
      return null;
    return dispositions as Record<string, unknown>;
  }

  async judge(ctx: CompletionContext): Promise<CompletionVerdict> {
    const own = this.#ownRefusal(ctx);
    if (own !== null) return own;
    const requester = FixDispositions.requesterInputOf(
      ctx.records,
      ctx.record.cycle,
      ctx.reviewsPath,
      ctx.repoRoot,
    );
    if (requester.kind === "unrecorded")
      return this.#complete([this.#soft(FIX_DISPOSITIONS_UNRECORDED)]);
    if (requester.kind === "unreadable") {
      return this.#hard(
        `the requesting review carrier is missing or unreadable at ${requester.path} — ${requester.detail}`,
      );
    }
    const dispositions = FixDispositions.dispositionsOf(ctx.carrier) ?? {};
    const refusal = FixDispositions.#keyRefusal(dispositions, requester.summaries);
    if (refusal !== null) return this.#hard(refusal);
    const shape = FixDispositions.#valueRefusal(dispositions);
    if (shape !== null) return this.#hard(shape);
    return this.#complete(await this.#observationsOf(ctx, requester.summaries));
  }

  /** The round's two summary counts — `fixed` / `rejected`, counted over the SAME
   *  pair the judgment reads (dispositions ∩ the input set). Counts only: the
   *  `fixed N · rejected M` line is rendered by the presentation plane
   *  (`face/words.ts` template). A face fact: never stored, never a capsule key,
   *  never a second read face. */
  summaryOf(carrier: unknown, input: readonly string[]): DispositionCounts {
    const wanted = new Set(input);
    let fixed = 0;
    let rejected = 0;
    for (const [summary, value] of Object.entries(FixDispositions.dispositionsOf(carrier) ?? {})) {
      if (!wanted.has(summary)) continue;
      const status = (value as { status?: unknown } | null)?.status;
      if (status === "fixed") fixed += 1;
      else if (status === "rejected") rejected += 1;
    }
    return { fixed, rejected };
  }

  /** The round's own carrier refusals (① missing carrier, ② missing slot). */
  #ownRefusal(ctx: CompletionContext): CompletionVerdict | null {
    const carrier = ctx.carrier;
    if (carrier === null || typeof carrier !== "object" || Array.isArray(carrier)) {
      const at = ctx.record.carrierPath;
      return this.#hard(
        at === null
          ? "the fix round persisted no work carrier and recorded no carrier path"
          : `the fix round persisted no work carrier at ${at}`,
      );
    }
    if (FixDispositions.dispositionsOf(carrier) === null) {
      return this.#hard(
        "the fix carrier declares no `dispositions` object — every requesting finding owes a fixed/rejected row",
      );
    }
    return null;
  }

  /** The key-set refusals (③ missing entries, ④ unknown entries) — exact matching,
   *  one defect one disposition. */
  static #keyRefusal(
    dispositions: Readonly<Record<string, unknown>>,
    input: readonly string[],
  ): string | null {
    const wanted = new Set(input);
    const unknown = Object.keys(dispositions).filter((key) => !wanted.has(key));
    if (unknown.length > 0) {
      return `disposition(s) for finding(s) the requesting carrier never raised: ${unknown.join(", ")}`;
    }
    const missing = input.filter((summary) => !Object.hasOwn(dispositions, summary));
    if (missing.length > 0) {
      return `no disposition for finding(s) of the requesting carrier: ${missing.join(", ")}`;
    }
    return null;
  }

  /** The value-shape refusal (⑥ `rejected` without a reason; a status outside the
   *  two declared words is the same shape family). */
  static #valueRefusal(dispositions: Readonly<Record<string, unknown>>): string | null {
    for (const [summary, value] of Object.entries(dispositions)) {
      const status = (value as { status?: unknown } | null)?.status;
      if (status !== "fixed" && status !== "rejected") {
        return `disposition "${summary}" declares status ${JSON.stringify(status)} — use \`fixed\` or \`rejected\``;
      }
      const reason = (value as { reason?: unknown } | null)?.reason;
      if (status === "rejected" && (typeof reason !== "string" || reason.trim().length === 0)) {
        return `disposition "${summary}" is rejected without a reason — a rejection must state why`;
      }
    }
    return null;
  }

  /** The two soft observations of a completed fix round — the empty input set and the
   *  zero-commit round (both bookkeeping, neither a gate). */
  async #observationsOf(
    ctx: CompletionContext,
    input: readonly string[],
  ): Promise<readonly RoundViolation[]> {
    const observations: RoundViolation[] = [];
    if (input.length === 0) observations.push(this.#soft(FIX_DISPOSITIONS_EMPTY_INPUT));
    // THIS round's own baseline — a null one (legacy fold, non-git tree) carries no
    // present fact, so the observation is simply unmeasurable, never invented.
    const base = ctx.record.dispatchBase;
    if (base !== null) {
      const commits = await ctx.git.commitsSince(ctx.repoRoot, base);
      if (commits.length === 0) observations.push(this.#soft(FIX_DISPOSITIONS_ZERO_COMMIT));
    }
    return observations;
  }

  /** The deduped input set — repeated summaries collapse to one key. A finding
   *  without a string `summary` is NOT skipped (a silently dropped finding owes no
   *  disposition and passes forever): the caller grades it `unreadable`.
   *  `index` is the first offending entry. */
  static #summariesOf(
    findings: readonly unknown[],
  ): { readonly summaries: readonly string[] } | { readonly index: number } {
    const summaries: string[] = [];
    const seen = new Set<string>();
    for (const [index, finding] of findings.entries()) {
      const summary = (finding as { summary?: unknown } | null)?.summary;
      if (typeof summary !== "string") return { index };
      if (seen.has(summary)) continue;
      seen.add(summary);
      summaries.push(summary);
    }
    return { summaries };
  }

  #complete(observations: readonly RoundViolation[]): CompletionVerdict {
    return { fulfilled: true, violation: null, observations };
  }

  /** The hard verdict of this criterion — the ledger's existing `contract-violation`
   *  cause, never a new violation enum row. */
  #hard(message: string): CompletionVerdict {
    return { fulfilled: false, violation: { grade: "hard", cause: "contract-violation", message } };
  }

  /** The soft row — bookkeeping only; `contract-violation` is the only cause
   *  vocabulary the ledger carries today. */
  #soft(message: string): RoundViolation {
    return { grade: "soft", cause: "contract-violation", message };
  }
}

/** The verb-keyed criterion registry — one criterion per op verb. A verb is
 *  registered when its criterion lands (branch review folds to `review`, so it needs
 *  no own row); an UNREGISTERED verb still throws at lookup, so a future verb can
 *  never silently read as done. */
export const COMPLETION_CRITERIA: Readonly<Partial<Record<OpType, CompletionCriterion>>> = {
  implement: new CommitsSinceGroupBase(),
  review: new JudgeCarrier(),
  fix: new FixDispositions(),
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
