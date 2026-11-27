// packages/cdd-engine/src/docs/judging/completion.ts
// "Is this round done?" — one criterion per verb, behind one registry.
//
// A round's completion is a judgment about facts the dispatch side already holds, never a
// second look at the disk: the implement criterion reads the commits the round produced,
// the review criterion reads the findings its carrier carries. So the input is a small
// record of facts and the answer is a declared value — `done` with the round's bookkeeping
// observations, or one violation carrying the sentence a refusal prints.
//
// The two arms the phase pins:
//   · `implement` is done when the group produced at least one commit — a zero-commit
//     implement round is a violation, whatever its draft says — OR when the round is a
//     VERIFICATION wave with green evidence (P30 §2.4): a wave whose every task declares an
//     empty `Files` changes no file by design, so its green evidence IS its completion and a
//     `committed nothing` refusal there would be a cross-attempt false negative;
//   · `review` is done when its carrier's `findings` is an ARRAY — an EMPTY array is a valid
//     APPROVED conclusion, so emptiness is never a violation while an absent carrier or a
//     non-array `findings` is.
//
// The registry's three rows are the three verbs. `fix` is done when the round's own
// DISPOSITIONS cover every finding the requesting review carrier carries — the input set is
// the review round of the same line and cycle, and its carrier read is the dispatch side's
// (`run/advance`), because `docs/` never reads a carrier itself.
//
// A completed round may also book OBSERVATIONS instead of a refusal — the soft family: an
// implement round that wrote no draft, a verification wave that concluded on its declaration
// and green evidence. They never gate the round; the ledger's `soft` row is where they land.
//
// Module-level exports are types, the declared sentences and the registry — zero
// behaviour-carrying bare functions.

/** One finding's disposition status — the two declared values, spelled as the frozen dispatch
 *  prompt spells the cell. */
export type FixDecision = "fixed" | "rejected";

/** One finding's disposition: what the fix round did with it, and why. The cell is `status` —
 *  the wire word the dispatch prompt the child reads declares; a table written under any other
 *  spelling is refused by shape, never counted as neither value. */
export interface FixDisposition {
  /** The status. */
  readonly status: FixDecision;
  /** The stated reason — required by a `rejected` status (a reasonless rejection is a
   *  shape the table refuses, not a disposition). */
  readonly reason?: string;
}

/** One requested finding, as the requesting review's carrier declares it: the engine-written
 *  id (absent on a carrier older than the id column) and the summary the fallback pairing
 *  reads. */
export interface RequestedFinding {
  /** The engine-written row id. */
  readonly id?: string;
  /** The finding's summary — the pairing key when no id was written. */
  readonly summary?: string;
}

/** The disposition counts — the round's bookkeeping face, counts only. */
export interface FixSummary {
  /** How many findings the round fixed. */
  readonly fixed: number;
  /** How many it rejected. */
  readonly rejected: number;
}

/** The dispatch verbs a completion judgment exists for. */
export type CompletionVerb = "implement" | "review" | "fix";

/** The facts a completion judgment reads — never the round's own verdict (a verdict must
 *  never be an input to the judgment that produces it). */
export interface CompletionFacts {
  /** The commits the round's group produced since `groupBase`. */
  readonly commits: number;
  /** The group's dispatch baseline — the EARLIEST record's `dispatchBase` on the group, and
   *  the HEAD a zero-commit refusal names. Null when the group carries none (a legacy fold,
   *  a non-git tree): the judgment then refuses on that fact rather than reading an
   *  unmeasurable round as an empty one. */
  readonly groupBase: string | null;
  /** Whether the round persisted a carrier at all. An implement round is judged by its
   *  COMMITS, so an absent carrier is an observation, never a refusal. */
  readonly carrierWritten: boolean;
  /** The round's carrier `findings` array, or null when the round persisted no carrier. */
  readonly findings: readonly unknown[] | null;
  /** The task ids the round's line declares — the wave's members. Empty for a line that
   *  groups no task (a branch round), which is never a verification wave. */
  readonly waveTasks: readonly number[];
  /** The plan tasks whose `Files` declaration names no path. FACTS ONLY: the plan read that
   *  fills this set belongs to the caller, which also owns the wave-key read that gives
   *  `waveTasks` its members. */
  readonly emptyFileTasks: ReadonlySet<number>;
  /** Whether this round's test evidence already passed its own schema check — the gate that
   *  judged it is the caller's, so the criterion never re-reads an evidence file. */
  readonly evidenceOk: boolean;
  /** The fix round's own disposition table, keyed by the requested finding's id; null when
   *  the round wrote no working carrier. Read by the `fix` criterion only. */
  readonly dispositions?: Readonly<Record<string, FixDisposition>> | null;
  /** The findings the REQUESTING review carrier holds — the set a fix round owes one
   *  disposition each. Absent → the round owes nothing. */
  readonly requested?: readonly RequestedFinding[];
  /** Whether the request carried no ids, so the pairing fell back to the summary — a
   *  bookkeeping observation, never a gate. */
  readonly matchedBySummary?: boolean;
}

/** One bookkeeping observation a completed round carries — a hygiene fact the criterion
 *  books, never a gate. The structural twin of the ledger's soft row (`run/ledger`'s
 *  `RoundViolation` at grade `soft`), spelled here because `docs/` never imports `run/`; the
 *  lifecycle that books the round maps the two. */
export interface CompletionObservation {
  readonly grade: "soft";
  readonly message: string;
}

/** The implement round's absent-carrier observation — an implement round is judged by its
 *  COMMITS, so a round that committed its work but wrote no handoff draft still concludes;
 *  the missing carrier is booked, never gated. */
export const IMPLEMENT_CARRIER_ABSENT =
  "the implement round wrote no handoff carrier — the round is judged by its commits, not by its draft";

/** The verification-wave observation — the wave's every task declares an empty `Files`, so
 *  its empty diff IS the plan's declaration and its green evidence is the round's
 *  completion. Booked soft: the round concluded on the declaration rather than on a diff. */
export const IMPLEMENT_VERIFICATION_WAVE =
  "the implement round committed nothing — every task of this wave declares an empty `Files`, so the round concluded on its green evidence as a verification wave";

/** A group with no baseline has no HEAD to measure against — the old module's refusal, kept
 *  byte for byte, so the sentence a blocked round prints never drifts from the one operators
 *  already read. */
const NO_GROUP_BASELINE =
  "the round's group carries no dispatch baseline — a completion judgment needs the HEAD the group started from";

/** The verification wave's own refusal: a wave that declares no file changes on every task
 *  still owes green evidence. */
const VERIFICATION_NEEDS_EVIDENCE =
  "the wave declares no file changes on every task, but this round's test evidence is not green — a verification wave still owes green evidence";

/** One criterion's verdict: done with the round's observations (none is an empty list), or
 *  the violation a refusal prints. */
export type CompletionVerdict =
  | { readonly kind: "done"; readonly observations: readonly CompletionObservation[] }
  | { readonly kind: "violation"; readonly message: string };

/** The completion contract — one verb's "is this round done?" answer. */
export interface CompletionCriterion {
  judge(facts: CompletionFacts): CompletionVerdict;
}

/** The implement criterion — a round is done when its group committed something, or when a
 *  VERIFICATION wave's evidence is green. A verification wave is one whose EVERY member
 *  declares an empty `Files`; a member set that is merely a subset of the wave does not
 *  qualify (the wave would still have changed files), and neither does a line that declares
 *  no member at all ("every member" is vacuously true over an empty set, so the empty set is
 *  refused first). */
export class CommitsCriterion implements CompletionCriterion {
  /** Whether this round is a verification wave: it declares at least one member and every
   *  member's `Files` declaration names no path. */
  static isVerificationWave(facts: CompletionFacts): boolean {
    if (facts.waveTasks.length === 0) return false;
    return facts.waveTasks.every((id) => facts.emptyFileTasks.has(id));
  }

  judge(facts: CompletionFacts): CompletionVerdict {
    const base = facts.groupBase;
    if (base === null) return { kind: "violation", message: NO_GROUP_BASELINE };
    if (facts.commits > 0) return CommitsCriterion.#complete(facts, []);
    if (!CommitsCriterion.isVerificationWave(facts)) {
      return {
        kind: "violation",
        message: `the group committed nothing since its baseline ${base}`,
      };
    }
    if (!facts.evidenceOk) {
      // The two refusals name DIFFERENT gaps: a wave that declares no file changes and owes
      // evidence is not the same defect as a wave that simply produced nothing.
      return { kind: "violation", message: VERIFICATION_NEEDS_EVIDENCE };
    }
    return CommitsCriterion.#complete(facts, [IMPLEMENT_VERIFICATION_WAVE]);
  }

  /** A completed round's verdict plus its observations — the criterion's own sentences, then
   *  the absent-carrier booking when the round wrote no draft. Both live in this one place, so
   *  no branch can book an observation under a second spelling. */
  static #complete(facts: CompletionFacts, observations: readonly string[]): CompletionVerdict {
    const booked = observations.map((message) => ({ grade: "soft" as const, message }));
    if (!facts.carrierWritten) booked.push({ grade: "soft", message: IMPLEMENT_CARRIER_ABSENT });
    return { kind: "done", observations: booked };
  }
}

/** The fix round's two bookkeeping observations — a round with nothing to dispose of, and an
 *  input whose ids predate the id column. Both are facts about the input, never a defect. */
export const FIX_EMPTY_INPUT =
  "the requesting review carrier carries no finding — the fix round owed no disposition";

export const FIX_LEGACY_INPUT =
  "the requesting review carrier carries no finding id — the dispositions were paired by summary";

export const FIX_ZERO_COMMITS =
  "the fix round committed nothing — the dispositions are its own statement";

/** The absent-carrier refusal — a fix round is judged by its dispositions, so a round with no
 *  table has not concluded. */
const NO_DISPOSITIONS =
  "the fix round persisted no dispositions — the round is judged by what it did with each finding";

/** The first sentence of a summary — the message's pairing form (a long summary would make
 *  the one message unreadable, and the id already identifies the row). */
const firstSentence = (text: string): string => {
  const [head] = text.split(/(?<=\.)\s/);
  return (head ?? text).trim();
};

/**
 * DispositionsCriterion — the fix round's completion. Invariant: the round is done when its
 * disposition table covers the requested finding set EXACTLY — a missing key and an unknown
 * key are both refusals, and both differences ride ONE message so the child receives the whole
 * repair list at once. Beyond coverage, a row must keep the table's shape: the cell is the
 * wire word the dispatch prompt declares, and a rejection states its reason.
 */
export class DispositionsCriterion implements CompletionCriterion {
  judge(facts: CompletionFacts): CompletionVerdict {
    const dispositions = facts.dispositions ?? null;
    if (dispositions === null) return { kind: "violation", message: NO_DISPOSITIONS };
    const requested = facts.requested ?? [];
    const keys = requested.map((finding) => DispositionsCriterion.keyOf(finding));
    const missing = keys.filter((key) => dispositions[key] === undefined);
    const unknown = Object.keys(dispositions).filter((key) => !keys.includes(key));
    if (missing.length > 0 || unknown.length > 0) {
      return {
        kind: "violation",
        message: DispositionsCriterion.#coverageMessage(requested, keys, missing, unknown),
      };
    }
    const shape = DispositionsCriterion.#shapeRefusal(dispositions);
    if (shape !== null) return { kind: "violation", message: shape };
    return { kind: "done", observations: DispositionsCriterion.#observations(facts, requested) };
  }

  /** The two counts the round's summary line renders — counts only; the words are the word
   *  table's and the slots are the render face's. It reads the SAME pair the judgment reads —
   *  the table and the requested finding set, intersected through `keyOf` — so a row no
   *  finding names is never counted on a round the criterion refused for naming it. */
  static summaryOf(
    dispositions: Readonly<Record<string, FixDisposition>>,
    requested: readonly RequestedFinding[],
  ): FixSummary {
    const wanted = new Set(requested.map((finding) => DispositionsCriterion.keyOf(finding)));
    const rows = Object.entries(dispositions)
      .filter(([key]) => wanted.has(key))
      .map(([, row]) => row);
    return {
      fixed: rows.filter((row) => row.status === "fixed").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
    };
  }

  /** The table's own SHAPE — the two refusals a row can carry beyond a missing key, each
   *  naming its row: a `status` outside the declared vocabulary, and a rejection with no reason.
   *  Read off the parsed carrier, so the cell is `unknown` here: the type states the declared
   *  vocabulary, never what a child wrote to disk. */
  static #shapeRefusal(dispositions: Readonly<Record<string, FixDisposition>>): string | null {
    for (const [key, row] of Object.entries(dispositions)) {
      const cell = row as { readonly status?: unknown; readonly reason?: unknown } | null;
      const status = cell?.status;
      if (status !== "fixed" && status !== "rejected") {
        return `disposition "${key}" declares status ${JSON.stringify(status)} — use \`fixed\` or \`rejected\``;
      }
      const reason = cell?.reason;
      if (status === "rejected" && (typeof reason !== "string" || reason.trim().length === 0)) {
        return `disposition "${key}" is rejected without a reason — a rejection must state why`;
      }
    }
    return null;
  }

  /** The pairing key of one requested finding — the engine-written id, else the summary. */
  static keyOf(finding: RequestedFinding): string {
    const id = (finding.id ?? "").trim();
    return id.length > 0 ? id : (finding.summary ?? "").trim();
  }

  /** ONE message naming both sides of the difference: the missing keys with their summary's
   *  first sentence, and the unknown keys marked as such. */
  static #coverageMessage(
    requested: readonly RequestedFinding[],
    keys: readonly string[],
    missing: readonly string[],
    unknown: readonly string[],
  ): string {
    const parts: string[] = [];
    if (missing.length > 0) {
      const named = missing.map((key) => {
        const finding = requested[keys.indexOf(key)];
        const summary = firstSentence(finding?.summary ?? "");
        return summary.length === 0 ? key : `${key}: ${summary}`;
      });
      parts.push(`missing: ${named.join(" · ")}`);
    }
    if (unknown.length > 0)
      parts.push(`unknown: ${unknown.map((key) => `${key} unknown`).join(" · ")}`);
    return `the dispositions do not cover the review's findings — ${parts.join("; ")}`;
  }

  /** The completed round's bookkeeping observations — the three declared soft facts. They
   *  never gate the round. */
  static #observations(
    facts: CompletionFacts,
    requested: readonly RequestedFinding[],
  ): readonly CompletionObservation[] {
    const observations: CompletionObservation[] = [];
    if (requested.length === 0) observations.push({ grade: "soft", message: FIX_EMPTY_INPUT });
    if (facts.matchedBySummary === true) {
      observations.push({ grade: "soft", message: FIX_LEGACY_INPUT });
    }
    if (facts.commits === 0) observations.push({ grade: "soft", message: FIX_ZERO_COMMITS });
    return observations;
  }
}

/** The review criterion — a round is done when its carrier carries a `findings` array. An
 *  empty array is a valid approval. */
export class FindingsCriterion implements CompletionCriterion {
  judge(facts: CompletionFacts): CompletionVerdict {
    if (facts.findings !== null) return { kind: "done", observations: [] };
    // The old tree's TWO refusals (no carrier at all / a carrier whose `findings` is not an
    // array) collapse into this one sentence: `CompletionFacts#findings` is
    // `unknown[] | null`, so a non-array slot cannot reach the criterion — the carrier read
    // that fills the cell decides shape and hands over an array or nothing. The sentence is
    // the old module's first refusal, byte for byte; the second is preserved by the type.
    return { kind: "violation", message: "the review round persisted no judge carrier" };
  }
}

/** The verb-keyed registry — one criterion per ported verb. An unported verb has no row. */
export const COMPLETION_CRITERIA: Readonly<Partial<Record<CompletionVerb, CompletionCriterion>>> = {
  implement: new CommitsCriterion(),
  review: new FindingsCriterion(),
  fix: new DispositionsCriterion(),
};

/**
 * CompletionCriteria — the registry's lookup face. Invariant: a verb is answered by its
 * own criterion or throws; there is no default "done".
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the registry's one lookup face — the zero-bare-function discipline admits no standalone lookup.
export class CompletionCriteria {
  /** The criterion one verb is judged by — an unported verb throws at lookup. */
  static of(verb: CompletionVerb): CompletionCriterion {
    const criterion = COMPLETION_CRITERIA[verb];
    if (criterion === undefined) {
      throw new Error(`no completion criterion is registered for the "${verb}" verb`);
    }
    return criterion;
  }

  /** One round's completion verdict, through the verb's own criterion. */
  static judge(verb: CompletionVerb, facts: CompletionFacts): CompletionVerdict {
    return CompletionCriteria.of(verb).judge(facts);
  }
}
