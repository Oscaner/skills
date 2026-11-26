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
//   · `implement` is done when the group produced at least one commit — a zero-commit
//     implement round is a violation, whatever its draft says — OR when the round is a
//     VERIFICATION wave with green evidence (P30 §2.4): a wave whose every task declares an
//     empty `Files` changes no file by design, so its green evidence IS its completion and a
//     `committed nothing` refusal there would be a cross-attempt false negative;
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
}

/** One criterion's verdict: done, or the violation a refusal prints. */
export type CompletionVerdict =
  | { readonly kind: "done" }
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
    if (facts.commits > 0) return { kind: "done" };
    if (CommitsCriterion.isVerificationWave(facts)) {
      // The two refusals name DIFFERENT gaps: a wave that declares no file changes and owes
      // evidence is not the same defect as a wave that simply produced nothing.
      if (facts.evidenceOk) return { kind: "done" };
      return {
        kind: "violation",
        message:
          "the wave declares no file changes on every task, but this round's test evidence is not green — a verification wave still owes green evidence",
      };
    }
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
