// packages/cdd-engine/src-next/contract/completion-criterion.ts
// P22 T4/T6 — "is this round done?" as criteria behind ONE verb-keyed registry
// (design spec §8 · the completion-criterion row): `implement` is done when the
// group's baseline carries at least one commit OR the round is a zero-diff
// verification wave with green evidence (P30 §2.4), `review` (branch review included —
// branch-review folds to the review op) is done when its carrier is schema-shaped,
// and `fix` is done when its work carrier's `dispositions` cover every finding of
// the REQUESTING review carrier (design spec §3.4).
//
// The criterion judges a CompletionContext the dispatch side assembles (Task 7):
// the round's verdict-free identity, its ledger row, the row's in-register records,
// the persisted carrier bytes, the requester's review path, the git read face and the
// repoRoot path basis. The four cells with a provider seam (`records`, `reviewsPath`,
// `emptyFileTasks`, `evidenceOk`) are filled by `CliLifecycle` — this module pins the
// context SHAPE only and imports neither `face/` nor the lifecycle.
//
// The registry is deliberately PARTIAL while the verbs are ported one at a time: a
// verb with no criterion throws at lookup (`CompletionCriteria.of`), so a dispatch of
// an unported verb can never silently read as "done".
//
// judge() is async because the implement criterion reads git (`GitClient.commitsSince`).
//
// Module-level exports are types / the declared registry / the class — zero
// behavior-carrying bare functions.

import path from "node:path";
import type { GitClient } from "../infra/git.ts";
import { CarrierIntegrity, CarrierMismatchError } from "../session/carrier-integrity.ts";
import {
  type OpType,
  type ProgressRow,
  type RoundIdentity,
  type RoundRecord,
  RoundViolation,
} from "../session/ledger.ts";

/** The judgment input — the round's own facts, its group's records, the carrier bytes
 *  and the two read seams (git + the requester's review path). */
export interface CompletionContext {
  /** The round under judgment — its identity ONLY. The verdict and the graded
   *  violations are deliberately absent: a completion verdict must never be an input
   *  to the judgment that produces it. */
  readonly record: RoundIdentity;
  /** The progress row the round belongs to (the wave key's line) — read by
   *  `CommitsSinceGroupBase.judge`, which takes the wave's task-id set from the row's
   *  `wave` key: the empty-`Files` cell carries membership only (no member face of its
   *  own), so the classification needs the wave key from here rather than a second
   *  ledger read. */
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
  /** The plan tasks whose `Files` declaration names no path — the verification-wave
   *  cell, filled from the plan document by `CliLifecycle` (the criterion reads no
   *  disk). Membership only: the wave's task ids come from `row.wave`, so a set that
   *  is merely a SUBSET of the wave is never a verification wave. */
  readonly emptyFileTasks: ReadonlySet<number>;
  /** Whether this round's test evidence already passed the existing `HandoffSchema`
   *  evidence check — the lifecycle's evidence gate has judged it, so the criterion
   *  never re-reads the disk to ask again. */
  readonly evidenceOk: boolean;
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
 * has at least one commit since the group's baseline (design spec §8), OR when the
 * round is a VERIFICATION wave with green evidence (P30 §2.4).
 *
 * The baseline is the EARLIEST record's `dispatchBase` of the group — not the round's
 * own. A group re-dispatched after a failed attempt carries a newer per-attempt base,
 * so comparing against the round's own base would read "attempt 1 committed, attempt 2
 * committed nothing" as an empty round (the cross-attempt false negative the group
 * baseline exists to prevent).
 *
 * The second leg is a strictly additive OR branch: a wave whose EVERY task declares an
 * empty `Files` (a verification wave — it changes no file by design) commits nothing,
 * so its green evidence is the round's completion. The commit test itself is
 * untouched — a wave with any non-empty `Files` row keeps the `committed nothing`
 * refusal on a zero diff.
 */
export class CommitsSinceGroupBase implements CompletionCriterion {
  /** The group baseline — the first record (ledger order = cycle/attempt order) that
   *  carries a `dispatchBase`. Records without one (legacy folds, a non-git tree) are
   *  skipped: they carry no present fact. Null when the group carries none. */
  static groupBaseOf(records: readonly RoundIdentity[]): string | null {
    for (const record of records) {
      if (record.dispatchBase !== null) return record.dispatchBase;
    }
    return null;
  }

  /** Whether the wave is a VERIFICATION wave: EVERY task id the wave key declares has
   *  an empty `Files` declaration. The id set is read from the row's `wave` key (the
   *  wave-unitary model's group identity, `"1,2"` = `{1, 2}`) — the empty-`Files` cell
   *  carries membership only, so a set that is a mere subset of the wave must not read
   *  as "the whole wave changes nothing". A wave key declaring no id is never a
   *  verification wave: an empty member set would satisfy "every member" vacuously. */
  static isVerificationWave(row: ProgressRow, emptyFileTasks: ReadonlySet<number>): boolean {
    const ids = CommitsSinceGroupBase.waveIdsOf(row.wave);
    if (ids.length === 0) return false;
    return ids.every((id) => emptyFileTasks.has(id));
  }

  /** The task ids one wave key declares — the comma-separated digits of `row.wave`,
   *  deduped. A non-numeric token carries no task identity and is dropped. */
  static waveIdsOf(wave: string): readonly number[] {
    const ids = new Set<number>();
    for (const token of wave.split(",")) {
      const trimmed = token.trim();
      if (/^\d+$/.test(trimmed)) ids.add(Number(trimmed));
    }
    return [...ids];
  }

  async judge(ctx: CompletionContext): Promise<CompletionVerdict> {
    // The round under judgment is APPENDED to the group's recorded history: on a
    // group's FIRST dispatch the ledger holds no record yet (the round is recorded at
    // bookkeep, after this judgment), and the round's own `dispatchBase` IS the group
    // baseline. An earlier record always wins — the group's start, never a retry's.
    const base = CommitsSinceGroupBase.groupBaseOf([...ctx.records, ctx.record]);
    if (base === null) {
      return this.#hard(
        "the round's group carries no dispatch baseline — a completion judgment needs the HEAD the group started from",
      );
    }
    const commits = await ctx.git.commitsSince(ctx.repoRoot, base);
    if (commits.length > 0) return this.#committed(ctx);
    return this.#zeroCommit(ctx, base);
  }

  /** A round with commits concludes. An implement round is judged by its COMMITS, never
   *  by its handoff draft: the absent carrier is a bookkeeping observation (design spec
   *  §3.3), so the round still concludes. */
  #committed(ctx: CompletionContext): CompletionVerdict {
    if (ctx.carrier === null) {
      return { fulfilled: true, violation: null, observations: [this.#observation()] };
    }
    return { fulfilled: true, violation: null };
  }

  /** A zero-commit round: a verification wave with green evidence concludes (its empty
   *  diff is the plan's declaration, not an empty round), every other zero-commit round
   *  keeps the `committed nothing` refusal. The two refusals name DIFFERENT gaps — a
   *  wave that declares no file changes and owes evidence is not the same defect as a
   *  wave that simply produced nothing. */
  #zeroCommit(ctx: CompletionContext, base: string): CompletionVerdict {
    const verification = CommitsSinceGroupBase.isVerificationWave(ctx.row, ctx.emptyFileTasks);
    if (!verification) {
      return this.#hard(`the group committed nothing since its baseline ${base}`);
    }
    if (!ctx.evidenceOk) {
      return this.#hard(
        "the wave declares no file changes on every task, but this round's test evidence is not green — a verification wave still owes green evidence",
      );
    }
    const observations: RoundViolation[] = [this.#verificationObservation()];
    if (ctx.carrier === null) observations.push(this.#observation());
    return { fulfilled: true, violation: null, observations };
  }

  /** The hard verdict of this criterion — the ledger's existing `contract-violation`
   *  cause, never a new violation enum row. */
  #hard(message: string): CompletionVerdict {
    return { fulfilled: false, violation: RoundViolation.hard(message) };
  }

  /** The absent-carrier observation — bookkeeping only (the round's commits decided
   *  it); the same cause vocabulary, the soft grade. */
  #observation(): RoundViolation {
    return RoundViolation.soft(IMPLEMENT_CARRIER_ABSENT);
  }

  /** The verification-wave observation — the round passed on its plan declaration plus
   *  green evidence rather than on a diff; booked soft, it never gates. */
  #verificationObservation(): RoundViolation {
    return RoundViolation.soft(IMPLEMENT_VERIFICATION_WAVE);
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
    return { fulfilled: false, violation: RoundViolation.hard(message) };
  }
}

/** The implement round's absent-carrier observation (design spec §3.3) — an implement
 *  round is judged by its COMMITS, so a round that committed its work but wrote no
 *  handoff draft still concludes; the missing carrier is booked, never gated. */
export const IMPLEMENT_CARRIER_ABSENT =
  "the implement round wrote no handoff carrier — the round is judged by its commits, not by its draft";

/** The zero-diff verification-wave observation (P30 §2.4) — the wave's every task
 *  declares an empty `Files`, so its empty diff IS the plan's declaration and its
 *  green evidence is the round's completion. Booked soft: the round concluded on the
 *  declaration, and the ledger says so instead of reading it as an ordinary commit
 *  round that happened to leave nothing. */
export const IMPLEMENT_VERIFICATION_WAVE =
  "the implement round committed nothing — every task of this wave declares an empty `Files`, so the round concluded on its green evidence as a verification wave";

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

/** The legacy-key-set observation (P30 §2.5) — the requesting carrier carries no
 *  finding `id` (it predates the engine-written key), so the dispositions were matched
 *  by summary text. Booked soft: the round is judged, and the ledger says the key it
 *  used. No carrier migration — present facts only. */
export const FIX_DISPOSITIONS_LEGACY_KEYS =
  "the requesting review carrier carries no finding `id` — the dispositions were matched by summary text, the legacy key";

/** The legacy-record observation — no requesting carrier is locatable, so the
 *  judgment is skipped visibly (reading the gap as an empty input set would restore
 *  an always-passing criterion). */
export const FIX_DISPOSITIONS_UNRECORDED =
  "the requesting review round records no carrierPath and the route carried no --reviews path — the disposition judgment is skipped";

/** One requesting-side finding — the disposition key's provenance. `id` is the
 *  engine-written stable key (`F1`, `F2` …) of an id-bearing carrier; a LEGACY carrier
 *  (written before P30 §2.5) carries none, and its `summary` stands in as the key.
 *  `summary` is description text — the failure message's label, never the key. */
export interface RequesterFinding {
  readonly id: string | null;
  readonly summary: string;
}

/** One read of the requesting review carrier — the input set's provenance. A path
 *  neither recorded nor handed over is `unrecorded` (legacy); a path that yields no
 *  readable findings array — or a finding whose `summary` is not a string — is
 *  `unreadable` (hard: "the evidence is gone" is not "there were no findings", and a
 *  silently dropped finding is a vacuously passing criterion). `detail` names the
 *  defect beyond the path (the entry index of a malformed finding), never a slogan. */
export type RequesterRead =
  | { readonly kind: "unrecorded" }
  | { readonly kind: "unreadable"; readonly path: string; readonly detail: string }
  | {
      readonly kind: "read";
      readonly path: string;
      readonly findings: readonly RequesterFinding[];
    };

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
 * §3.4, P30 §2.5). The input set is the REQUESTING side's carrier — the same-key
 * same-cycle completed review record's `carrierPath`, falling back to the fix route's
 * `--reviews` path; the round's own `carrierPath` is never the input set.
 *
 * Keys are the findings' engine-written `id`s (`F1`, `F2` … in carrier order) — the
 * primary key the engine authors, so rewriting a summary no longer produces an unknown
 * key. `summary` is description text: it labels the failure message (its first
 * sentence) and nothing else. A LEGACY carrier that predates the `id` column carries
 * none, so its `summary` stands in as the key and the round books one soft observation
 * (present facts only — no carrier migration).
 *
 * The key-set refusal prints BOTH diffs in ONE message: the missing side (a carrier
 * finding with no disposition — `id` + summary first sentence, carrier order) and the
 * unknown side (a disposition no finding raised — its bare key, marked `unknown`). One
 * failure therefore names everything the child has to fix.
 *
 * Values are `{ status: "fixed" | "rejected", reason?: string }` — `rejected` without a
 * reason is a shape violation, hard like the missing slot.
 *
 * The fix round's zero-commit fact is an OBSERVATION, not a refusal: this criterion
 * answers from the carrier, never from the diff.
 */
export class FixDispositions implements CompletionCriterion {
  /** The requesting carrier's path — the LATEST attempt of the same-cycle review of the
   *  SAME key (the row's records are already the key's), the record whose digest the
   *  checked read compares against; a legacy record without `carrierPath` falls back to
   *  the route's `--reviews` path. */
  static requesterPathOf(
    records: readonly RoundRecord[],
    cycle: number,
    reviewsPath: string | null,
  ): string | null {
    return FixDispositions.#requesterOf(records, cycle)?.carrierPath ?? reviewsPath;
  }

  /** Read the requesting carrier's input set (the findings, deduped by disposition
   *  key in carrier order). The read is synchronous on purpose: the input is ONE small
   *  carrier, and the dispatch face already reads its small inputs synchronously at
   *  the same seam.
   *
   *  Every path resolves against `repoRoot`, never `process.cwd()`: the engine runs
   *  from a subdirectory too, `--reviews` arrives repoRoot-relative and a record's
   *  `carrierPath` arrives absolute — both must land on the one basis (`RepoRoot`'s
   *  rule). The reported `path` is the resolved one, so a failure names a real file.
   *
   *  P31 §2.2 — the read is the ONE checked carrier read (`CarrierIntegrity.read`):
   *  the requesting round's recorded digest decides ok / mismatch, so a tampered
   *  input throws instead of being judged as if the round had written those bytes. */
  static requesterInputOf(
    records: readonly RoundRecord[],
    cycle: number,
    reviewsPath: string | null,
    repoRoot: string,
  ): RequesterRead {
    const requester = FixDispositions.#requesterOf(records, cycle);
    const declared = requester?.carrierPath ?? reviewsPath;
    if (declared === null) return { kind: "unrecorded" };
    const target = path.resolve(repoRoot, declared);
    let carrier: unknown;
    try {
      // P31 §2.2 — the input carrier is read through the ONE checked seam: the
      // requesting review record's digest when it declared the path, no comparison on
      // the legacy `--reviews` fallback. A mismatch is NOT an `unreadable` input (that
      // would silently judge the tampered bytes): the error propagates and the CLI's
      // blocked channel names it.
      const bytes = CarrierIntegrity.read(target, FixDispositions.#requesterDigestOf(requester));
      if (bytes === null) {
        return { kind: "unreadable", path: target, detail: "the file is absent or not JSON" };
      }
      carrier = JSON.parse(bytes) as unknown;
    } catch (raw) {
      if (raw instanceof CarrierMismatchError) throw raw;
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
    const set = FixDispositions.#findingsOf(findings);
    if ("index" in set) {
      return {
        kind: "unreadable",
        path: target,
        detail: `finding #${set.index} carries no string \`summary\``,
      };
    }
    return { kind: "read", path: target, findings: set.findings };
  }

  /** THE requesting record — the LATEST attempt of the same-cycle review (a re-dispatch
   *  supersedes its predecessor, the same rule the ledger's checked carrier read and the
   *  dispatch gate apply). Path AND digest come from this one record, so a re-dispatched
   *  review is never read against its predecessor's digest: the gate and this criterion
   *  cannot disagree about which review round the fix is answering. */
  static #requesterOf(records: readonly RoundRecord[], cycle: number): RoundRecord | undefined {
    return records
      .filter((record) => record.op === "review" && record.cycle === cycle)
      .reduce<RoundRecord | undefined>(
        (newest, record) =>
          newest === undefined || record.attempt >= newest.attempt ? record : newest,
        undefined,
      );
  }

  /** The digest the requesting review round recorded — read off the SAME record
   *  `requesterPathOf` selects. Null when that record declared no path (the legacy
   *  `--reviews` fallback carries no digest, so the read performs no comparison) or when
   *  the record predates the digest column. */
  static #requesterDigestOf(record: RoundRecord | undefined): string | null {
    if (record === undefined || record.carrierPath === null) return null;
    return record.carrierDigest ?? null;
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
    const refusal = FixDispositions.#keyRefusal(dispositions, requester.findings);
    if (refusal !== null) return this.#hard(refusal);
    const shape = FixDispositions.#valueRefusal(dispositions);
    if (shape !== null) return this.#hard(shape);
    return this.#complete(await this.#observationsOf(ctx, requester.findings));
  }

  /** The round's two summary counts — `fixed` / `rejected`, counted over the SAME
   *  pair the judgment reads (dispositions ∩ the input key set). Counts only: the
   *  `fixed N · rejected M` line is rendered by the presentation plane
   *  (`face/words.ts` template). A face fact: never stored, never a capsule key,
   *  never a second read face. */
  summaryOf(carrier: unknown, input: readonly RequesterFinding[]): DispositionCounts {
    const wanted = new Set(input.map((finding) => FixDispositions.keyOf(finding)));
    let fixed = 0;
    let rejected = 0;
    for (const [key, value] of Object.entries(FixDispositions.dispositionsOf(carrier) ?? {})) {
      if (!wanted.has(key)) continue;
      const status = (value as { status?: unknown } | null)?.status;
      if (status === "fixed") fixed += 1;
      else if (status === "rejected") rejected += 1;
    }
    return { fixed, rejected };
  }

  /** One finding's disposition key — the engine-written `id`, or the summary on a
   *  LEGACY carrier that carries none (`keyOf` is the ONE fallback ruling: the read,
   *  the judgment and the counts all derive the key here). */
  static keyOf(finding: RequesterFinding): string {
    return finding.id ?? finding.summary;
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

  /** The key-set refusal — BOTH diffs in one message (P30 §2.5), each entry carrying
   *  what makes it actionable: the missing side names the finding by `id` + the summary's
   *  first sentence (carrier order), the unknown side names the bare key and marks it
   *  `unknown` (the carrier raised no such finding, so there is no summary to quote —
   *  inventing one would be worse than saying `unknown`). */
  static #keyRefusal(
    dispositions: Readonly<Record<string, unknown>>,
    input: readonly RequesterFinding[],
  ): string | null {
    const wanted = new Set(input.map((finding) => FixDispositions.keyOf(finding)));
    const unknown = Object.keys(dispositions).filter((key) => !wanted.has(key));
    const missing = input.filter(
      (finding) => !Object.hasOwn(dispositions, FixDispositions.keyOf(finding)),
    );
    if (unknown.length === 0 && missing.length === 0) return null;
    const parts: string[] = [];
    if (missing.length > 0) {
      parts.push(
        `no disposition for finding(s) of the requesting carrier: ${missing
          .map((finding) => FixDispositions.#labelOf(finding))
          .join(", ")}`,
      );
    }
    if (unknown.length > 0) {
      parts.push(
        `disposition(s) for finding(s) the requesting carrier never raised: ${unknown
          .map((key) => `${key} (unknown)`)
          .join(", ")}`,
      );
    }
    return parts.join(" · ");
  }

  /** One finding's failure label — an id-bearing finding reads `F2 "<summary first
   *  sentence>"`; a legacy finding's key IS its summary, so the sentence alone is the
   *  whole label. */
  static #labelOf(finding: RequesterFinding): string {
    const sentence = FixDispositions.#firstSentence(finding.summary);
    return finding.id === null ? `"${sentence}"` : `${finding.id} "${sentence}"`;
  }

  /** The summary's first sentence — the message's actionable excerpt (the whole summary
   *  is a paragraph in practice). A summary with no terminator is its own sentence; a
   *  leading terminator falls back to the whole line rather than an empty quote. */
  static #firstSentence(summary: string): string {
    const text = summary.trim();
    const cut = text.search(/[.!?。！？]/);
    return cut <= 0 ? text : text.slice(0, cut + 1);
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

  /** The soft observations of a completed fix round — the empty input set, the legacy
   *  (id-less) key set and the zero-commit round (all bookkeeping, none a gate). */
  async #observationsOf(
    ctx: CompletionContext,
    input: readonly RequesterFinding[],
  ): Promise<readonly RoundViolation[]> {
    const observations: RoundViolation[] = [];
    if (input.length === 0) observations.push(this.#soft(FIX_DISPOSITIONS_EMPTY_INPUT));
    if (input.some((finding) => finding.id === null)) {
      observations.push(this.#soft(FIX_DISPOSITIONS_LEGACY_KEYS));
    }
    // THIS round's own baseline — a null one (legacy fold, non-git tree) carries no
    // present fact, so the observation is simply unmeasurable, never invented.
    const base = ctx.record.dispatchBase;
    if (base !== null) {
      const commits = await ctx.git.commitsSince(ctx.repoRoot, base);
      if (commits.length === 0) observations.push(this.#soft(FIX_DISPOSITIONS_ZERO_COMMIT));
    }
    return observations;
  }

  /** The deduped input set — repeated disposition KEYS collapse to one entry (a legacy
   *  carrier with the same summary twice owes one disposition; id-bearing findings keep
   *  their own keys, so distinct findings never collapse). A finding without a string
   *  `summary` is NOT skipped (a silently dropped finding owes no disposition and passes
   *  forever): the caller grades it `unreadable`. `index` is the first offending entry.
   *  An `id` that is absent or not a non-empty string is `null` — the legacy key, never
   *  an invented one. */
  static #findingsOf(
    findings: readonly unknown[],
  ): { readonly findings: readonly RequesterFinding[] } | { readonly index: number } {
    const rows: RequesterFinding[] = [];
    const seen = new Set<string>();
    for (const [index, finding] of findings.entries()) {
      const summary = (finding as { summary?: unknown } | null)?.summary;
      if (typeof summary !== "string") return { index };
      const raw = (finding as { id?: unknown } | null)?.id;
      const row: RequesterFinding = {
        id: typeof raw === "string" && raw.length > 0 ? raw : null,
        summary,
      };
      const key = FixDispositions.keyOf(row);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
    return { findings: rows };
  }

  #complete(observations: readonly RoundViolation[]): CompletionVerdict {
    return { fulfilled: true, violation: null, observations };
  }

  /** The hard verdict of this criterion — the ledger's existing `contract-violation`
   *  cause, never a new violation enum row. */
  #hard(message: string): CompletionVerdict {
    return { fulfilled: false, violation: RoundViolation.hard(message) };
  }

  /** The soft row — bookkeeping only; `contract-violation` is the only cause
   *  vocabulary the ledger carries today. */
  #soft(message: string): RoundViolation {
    return RoundViolation.soft(message);
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
