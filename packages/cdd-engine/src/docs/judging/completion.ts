// packages/cdd-engine/src/docs/judging/completion.ts
// "Is this round done?" — one criterion per verb, behind one registry.
//
// A round's completion is a judgment about facts the dispatch side already holds, never a
// second look at the disk: the implement criterion reads the commits the round produced,
// the review criterion reads the findings its carrier carries. So the input is a small
// record of facts and the answer is a declared value — `done`, or one violation carrying
// the sentence a refusal prints.
//
// The two arms the phase pins:
//   · `implement` is done only when the group produced at least one commit — a zero-commit
//     implement round is a violation, whatever its draft says;
//   · `review` is done when its carrier's `findings` is an ARRAY — an EMPTY array is a valid
//     APPROVED conclusion, so emptiness is never a violation while an absent carrier or a
//     non-array `findings` is.
//
// The registry is deliberately partial: a verb with no criterion throws at lookup, so a
// dispatch of an unported verb can never silently read as "done". `fix` joins when its
// dispositions judgment lands with the fix face.
//
// Module-level exports are types and the registry — zero behaviour-carrying bare functions.

/** The dispatch verbs a completion judgment exists for. */
export type CompletionVerb = "implement" | "review" | "fix";

/** The facts a completion judgment reads — never the round's own verdict (a verdict must
 *  never be an input to the judgment that produces it). */
export interface CompletionFacts {
  /** The commits the round's group produced since its baseline. */
  readonly commits: number;
  /** The round's carrier `findings` array, or null when the round persisted no carrier. */
  readonly findings: readonly unknown[] | null;
}

/** One criterion's verdict: done, or the violation a refusal prints. */
export type CompletionVerdict =
  | { readonly kind: "done" }
  | { readonly kind: "violation"; readonly message: string };

/** The completion contract — one verb's "is this round done?" answer. */
export interface CompletionCriterion {
  judge(facts: CompletionFacts): CompletionVerdict;
}

/** The implement criterion — a round is done when its group committed something. */
export class CommitsCriterion implements CompletionCriterion {
  judge(facts: CompletionFacts): CompletionVerdict {
    if (facts.commits > 0) return { kind: "done" };
    return {
      kind: "violation",
      message:
        "the round's group committed nothing since its dispatch baseline — an implement round is judged by its commits, never by its draft",
    };
  }
}

/** The review criterion — a round is done when its carrier carries a `findings` array. An
 *  empty array is a valid approval. */
export class FindingsCriterion implements CompletionCriterion {
  judge(facts: CompletionFacts): CompletionVerdict {
    if (facts.findings !== null) return { kind: "done" };
    return {
      kind: "violation",
      message: "the review round persisted no judge carrier carrying a `findings` array",
    };
  }
}

/** The verb-keyed registry — one criterion per ported verb. An unported verb has no row. */
export const COMPLETION_CRITERIA: Readonly<Partial<Record<CompletionVerb, CompletionCriterion>>> = {
  implement: new CommitsCriterion(),
  review: new FindingsCriterion(),
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
