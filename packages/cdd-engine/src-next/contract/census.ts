// packages/cdd-engine/src-next/contract/census.ts
// The census reference GRAMMAR — the one face this module carries. A count claim is
// legal in a document, but a MEASURED number must carry a `census:<id>` reference, and
// `referencesOf` is what decides whether a `census:` word is a reference at all.
//
// The grammar is a token shape, never a semantic class (§8.3): only `census:<id> = <n>`
// whose id is dotted lowercase and whose `<n>` is a decimal integer is a reference. A
// `census:` word that fails that grammar is PROSE ABOUT THE FORM — the placeholder
// `census:<id> = <n>` is itself a thing a document writes when it describes the form —
// so it is neither parsed nor thrown on. That is a grammar, not a filter: skipping everything that carries a metacharacter
// would leave the form itself unjudgeable.
//
// `<n>` is read only from the right-hand side of the fixed form, and the value's
// terminator says the WHOLE number must be digits: guarding only the next digit would
// truncate `3.5` to `3` and judge a form the grammar puts outside the gate — a false red
// for `3.5`, a false green for `0.5`.
//
// The reader serves the shape rules' span read (`MeasureLiteralInvariant`: a census
// reference's own number is the reference, never a bare count). Module-level exports are
// the reference type and the one declared static reader.

/** One reference as the corpus writes it: the id, the declared number, and where it
 *  sits (so a mismatch can be followed back to its sentence). */
export interface CensusReference {
  readonly id: string;
  readonly declared: number;
  readonly source: string;
  readonly line: number;
  /** The matched form, verbatim — the whole reference, never a neighbouring number. */
  readonly text: string;
}

/** The reference grammar (§8.3) — a dotted lowercase id and a decimal integer on the
 *  right of the fixed `=` form. A `census:` word outside it is prose about the form.
 *  The value's terminator says the whole number must be digits (see the header). */
const REFERENCE =
  /census:(?<id>[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+)\s*=\s*(?<n>\d+)(?![0-9A-Za-z.])/g;

// biome-ignore lint/complexity/noStaticOnlyClass: the reference grammar is a declared static reader — the repo's zero-bare-function discipline admits no standalone reader.
export class CensusGate {
  /** Every reference one text writes, in document order — the grammar, nothing else.
   *  A `census:` word that fails the grammar is prose about the form. */
  static referencesOf(text: string, source: string): readonly CensusReference[] {
    const references: CensusReference[] = [];
    text.split("\n").forEach((line, index) => {
      for (const match of line.matchAll(REFERENCE)) {
        const id = match.groups?.id;
        const declared = match.groups?.n;
        if (id === undefined || declared === undefined) continue;
        references.push({
          id,
          declared: Number(declared),
          source,
          line: index + 1,
          text: match[0],
        });
      }
    });
    return references;
  }
}
