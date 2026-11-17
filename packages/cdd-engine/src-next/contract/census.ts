// packages/cdd-engine/src-next/contract/census.ts
// P37 T8 — the census execution face (design spec §8). A count claim is allowed in a
// document, but a MEASURED number must carry a `census:<id>` reference, and this module
// is what makes that reference checkable: the registry supplies one number per row, and
// the gate compares the number a `census:<id> = <n>` reference declares with the row's
// export.
//
// ONE ROW, ONE NUMBER (§8.2). `measure(): number` is deliberately not a record: the gate
// compares the single `<n>` the reference writes, so a row measuring a record would leave
// that comparison without a meaning — which is why the type, not a runtime check, refuses
// it. A measurement surface that exposes several numbers registers several rows; the id is
// the key, and there is no sub-key syntax.
//
// The registry is NOT a module singleton and must not become one: the four `pin.*` rows
// measure a corpus, so the table is built at the composition point that already resolved a
// root (`face/cli.ts#rootOf()` if a command ever reads it; the guard test here), handing
// the SAME `PinAudit` and the SAME `corpusOf(root)` the scan uses. The corpus declaration
// therefore still lives in exactly one module, and no module-scope file-system read rides
// the import graph of every `cdd` command.
//
// The gate judges ONE thing (§8.3): does each `<n>` a reference declares equal its row's
// export. `<n>` is read only from the right-hand side of the fixed form; unequal is red,
// and an unknown id throws (the same "unregistered lookup throws" shape the criteria and
// completion-criterion registries use). The reference GRAMMAR is half of the judgment
// (§8.3): only `census:<id> = <n>` whose id is dotted lowercase and whose `<n>` is a
// decimal integer is a reference at all. A `census:` word that fails that grammar is prose
// about the form — the placeholder `census:<id> = <n>` sits inside this very corpus — so it
// is neither parsed nor compared nor thrown on. That is a grammar, not a filter: a
// well-formed but unregistered id still throws, so §8.3's floor cannot be weakened by
// skipping everything that carries a metacharacter.
//
// Module-level exports are types / one declared grammar / the factory / the classes — zero
// behavior-carrying bare functions.

import type { PinAudit } from "./pins.ts";
import { CRITERIA_ROWS, LENS_QUESTION_ROWS } from "./review-criteria.ts";

/** One census row — one measurement surface and the single number it measures. */
export interface CensusRow {
  readonly id: string;
  measure(): number;
}

/** The collaborators a census table is built from — the caller's resolved root, never
 *  this module's. */
export interface CensusDeps {
  /** The pin audit the four `pin.*` rows read — the same instance the scan uses. */
  readonly audit: PinAudit;
  /** The corpus those readings measure — the same `corpusOf(root)` the scan reads. */
  readonly corpus: readonly string[];
}

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

/** One reference whose declared number differs from its row's export. */
export interface CensusMismatch extends CensusReference {
  readonly measured: number;
}

/** What one gate run reports: how many references were actually compared (§8.3's floor
 *  reads this number) and the ones that disagreed. */
export interface CensusReport {
  readonly compared: number;
  readonly mismatches: readonly CensusMismatch[];
}

/** The reference grammar (§8.3) — a dotted lowercase id and a decimal integer on the
 *  right of the fixed `=` form. A `census:` word outside it is prose about the form. */
const REFERENCE = /census:(?<id>[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+)\s*=\s*(?<n>\d+)(?![0-9])/g;

/** The census registry — `of(id)` throws for a row nobody registered. */
export class CensusTable {
  readonly #rows: ReadonlyMap<string, CensusRow>;

  constructor(rows: readonly CensusRow[]) {
    const byId = new Map<string, CensusRow>();
    for (const row of rows) {
      if (byId.has(row.id)) throw new Error(`census row \`${row.id}\` is registered twice`);
      byId.set(row.id, row);
    }
    this.#rows = byId;
  }

  /** The registered rows, in declaration order. */
  rows(): readonly CensusRow[] {
    return [...this.#rows.values()];
  }

  /** The one row registered under `id`; an unregistered id throws (§8.2). */
  of(id: string): CensusRow {
    const row = this.#rows.get(id);
    if (row === undefined) throw new Error(`no census row is registered for \`${id}\``);
    return row;
  }
}

/** Build the declared table at the composition point (§8.2): the four pin readings come
 *  off ONE `PinAudit.census(corpus)` call, so the four rows are readings of one scan
 *  rather than four computations, and the three registry rows read the shipped tables
 *  directly instead of copying their length into a literal. */
export const censusTableOf = (deps: CensusDeps): CensusTable => {
  const pins = deps.audit.census(deps.corpus);
  const cells = LENS_QUESTION_ROWS.reduce((sum, row) => sum + row.reviewKinds.length, 0);
  return new CensusTable([
    { id: "pin.symbol", measure: () => pins.symbol },
    { id: "pin.path", measure: () => pins.path },
    { id: "pin.total", measure: () => pins.total },
    { id: "pin.files", measure: () => pins.files },
    { id: "criteria.rows", measure: () => CRITERIA_ROWS.length },
    { id: "questions.rows", measure: () => LENS_QUESTION_ROWS.length },
    { id: "questions.cells", measure: () => cells },
  ]);
};

/** The gate (§8.3) — it compares what the corpus declares with what the registry
 *  measures, and it judges nothing else: no prose semantics, no "does this number look
 *  reasonable", no undeclared counts. */
export class CensusGate {
  readonly #table: CensusTable;
  readonly #audit: PinAudit;
  readonly #corpus: readonly string[];

  constructor(deps: CensusDeps & { readonly table: CensusTable }) {
    this.#table = deps.table;
    this.#audit = deps.audit;
    this.#corpus = deps.corpus;
  }

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

  /** Judge the whole corpus: every reference is resolved through the registry (an
   *  unregistered id throws) and its declared number is compared with the export. */
  report(): CensusReport {
    const mismatches: CensusMismatch[] = [];
    let compared = 0;
    for (const file of this.#audit.filesOf(this.#corpus)) {
      const text = this.#audit.textOf(file);
      if (text === null) continue;
      for (const reference of CensusGate.referencesOf(text, file)) {
        const measured = this.#table.of(reference.id).measure();
        compared += 1;
        if (measured === reference.declared) continue;
        mismatches.push({ ...reference, measured });
      }
    }
    return { compared, mismatches };
  }
}
