// packages/cdd-engine/src-next/contract/translate.ts
// T19 — the single bidirectional translation layer (the P7 translation system core):
// the words' locale face (each row `{ en: canonical, zh?: Chinese alias }`) is served
// by the word table (face/words.ts — the word table's locale family), and ONE
// translator class speaks for the whole plane:
//
//   normalize(input) — the recognition face: a Chinese alias maps to the canonical
//       English token, an already-canonical word passes through, an unknown word is
//       null (the doc-parse / judge recognition channel the legacy Chinese markers
//       used to need — recognition rides this layer, never a second hand-written map).
//   localize(token, locale) — the rendering face: the canonical token → the requested
//       locale's output word (the en locale renders the canonical itself — identity),
//       the human-readable rendering faces' locale-normalized output.
//
// The layer is word-table driven with ZERO switch (a new word is declared as data,
// never as a code branch — the lookups are maps over the injected row data). The
// capsule machine face (status · next: · CDD_BLOCKED:) is deliberately NOT in the
// locale rows — the machine surface is English-constant and never localizable.
// Module-level exports are types / the class — zero behavior-carrying bare functions.

/** One locale word — a word's locale face: `{ en: canonical, zh?: Chinese alias }`
 *  (the word table's locale-column shape; the en face is always present, the zh alias
 *  is a row's non-en locale output). Rows are keyed by locale — the en column is
 *  required, every further locale column is an optional alias. */
export interface LocalizedWord {
  /** The canonical English form — the token's stable face (the normalize target). */
  en: string;
  /** The Chinese alias — the zh locale's output word of this row. */
  zh?: string;
  /** The locale columns — a row's output word per key; the canonical always renders
   *  under `en`, further locales under their key (an absent column = no output). */
  [locale: string]: string | undefined;
}

/** The word table's locale face — the single locale source the translator and the
 *  locale consumers read (the langs derivation + the label rows). Every method on the
 *  face is data-backed — a second hand-written locale table is excluded by construction. */
export interface WordLocaleFace {
  /** The locale key set — the word table's declared language keys (the `langs`
   *  projection source: locale-consuming faces derive from this, never hardcode). */
  localeKeys(): readonly string[];
  /** Every locale row of the word table, flat (the translator's row index source). */
  localeRows(): readonly LocalizedWord[];
  /** One locale row by its word id; null for an unknown id. */
  localeRow(id: string): LocalizedWord | null;
}

/**
 * Translator — the single bidirectional translation layer. normalize() recognizes an
 * input word (a Chinese alias or the canonical English token) as the canonical token;
 * localize() renders a canonical token at a requested locale. Both rows ride the
 * injected word-table locale face — zero switch: a new word is a new data row, never
 * a new code branch (the word table is the single-source translation data).
 */
export class Translator {
  /** The bilingual row index — canonical token → its row (the localize/identity path). */
  readonly #byToken: ReadonlyMap<string, LocalizedWord>;
  /** The alias index — non-en alias → its canonical token (the normalize path). */
  readonly #byAlias: ReadonlyMap<string, string>;

  constructor(face: WordLocaleFace) {
    const byToken = new Map<string, LocalizedWord>();
    const byAlias = new Map<string, string>();
    for (const row of face.localeRows()) {
      byToken.set(row.en, row);
      if (row.zh !== undefined) byAlias.set(row.zh, row.en);
    }
    this.#byToken = byToken;
    this.#byAlias = byAlias;
  }

  /** normalize(input) — the bidirectional recognition face: the canonical token passes
   *  through, a Chinese alias maps to its canonical token, an unknown word is null. */
  normalize(input: string): string | null {
    return this.#byToken.has(input) ? input : (this.#byAlias.get(input) ?? null);
  }

  /** localize(token, locale) — the rendering face: the canonical token → the requested
   *  locale's output word (en renders the canonical itself — identity); an unknown
   *  token, an unknown locale, or a row without the locale's column is null. */
  localize(token: string, locale: string): string | null {
    const row = this.#byToken.get(token);
    if (row === undefined) return null;
    return row[locale] ?? null;
  }
}
