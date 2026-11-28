// packages/cdd-engine/src/docs/identity/translate.ts
// The recognition and localization layer: one translator, two injected tables.
//
//   canonicalize(line) — the recognition face. Every registered alias span in the line
//       maps to its canonical form (the longest registered alias wins at each position,
//       non-overlapping spans; unregistered text passes through unchanged). A document
//       written with localized heading words is recognized through this ONE layer, never
//       through a second hand-written map.
//   localize(token, locale) — the rendering face. The canonical token → the requested
//       locale's output word; the canonical locale renders the canonical itself.
//
// The layer is table-driven with ZERO switch: a new word is a new data row, never a code
// branch, and the tables are construction inputs — a caller that hands an edited set of
// rows gets an edited recognition, which is exactly what a pin asserts about the absence
// of hard-coded branches. The machine face of a capsule (its status and `next:` tokens)
// is deliberately NOT localizable and lives in the word table, not here.
//
// `RowSource` is the one place a document is canonicalized: it resolves the front-matter
// head on the RAW text, then canonicalizes the body ONCE, so every consumer of the
// normalized view reads the same bytes.

import type { FrontMatter } from "../grammar/frontmatter.ts";
import { frontmatterOf } from "../grammar/frontmatter.ts";

/** One locale word — a word's locale face: the canonical form plus one column per
 *  further locale (a locale with no column for this row has no output word). */
export interface LocalizedWord {
  /** The canonical form — the token's stable face and the `canonicalize` target. */
  en: string;
  /** The Chinese alias — the `zh` locale's output word of this row. */
  zh?: string;
  /** The locale columns. */
  [locale: string]: string | undefined;
}

/** The normalized document view — the raw head plus the canonicalized body and its line
 *  face. One read per document. */
export interface CanonicalDocument {
  /** The typed front-matter head, read RAW (front matter is data, never rewritten). */
  readonly head: FrontMatter;
  /** The canonicalized body text. */
  readonly text: string;
  /** The canonicalized body lines — the line face of the same bytes. */
  readonly lines: readonly string[];
}

/**
 * Translator — the single bidirectional layer. Invariant: both directions answer from the
 * injected rows alone, so no word can be recognized or rendered without being declared.
 */
export class Translator {
  /** The canonical token → its row (the localize path). */
  readonly #byToken: ReadonlyMap<string, LocalizedWord>;
  /** The alias → its canonical token (the canonicalize path). */
  readonly #byAlias: ReadonlyMap<string, string>;
  /** The alias keys, longest first — the canonicalize scan order. Built once, so the scan
   *  never re-sorts; a same-length tie keeps declaration order. */
  readonly #aliasesByLength: readonly string[];

  constructor(rows: readonly LocalizedWord[]) {
    const byToken = new Map<string, LocalizedWord>();
    const byAlias = new Map<string, string>();
    for (const row of rows) {
      byToken.set(row.en, row);
      for (const [locale, word] of Object.entries(row)) {
        if (locale === "en" || typeof word !== "string") continue;
        byAlias.set(word, row.en);
      }
    }
    this.#byToken = byToken;
    this.#byAlias = byAlias;
    this.#aliasesByLength = [...byAlias.keys()].sort((left, right) => right.length - left.length);
  }

  /** The recognition face: every registered alias span of the line maps to its canonical
   *  row (the longest alias wins at each position; unregistered text, an already-canonical
   *  line and an empty line pass through unchanged). Pure — the caller owns any write. */
  canonicalize(line: string): string {
    let out = "";
    let index = 0;
    while (index < line.length) {
      const alias = this.#aliasesByLength.find((candidate) => line.startsWith(candidate, index));
      if (alias === undefined) {
        out += line[index];
        index += 1;
        continue;
      }
      out += this.#byAlias.get(alias);
      index += alias.length;
    }
    return out;
  }

  /** The rendering face: the canonical token → the requested locale's word (the canonical
   *  locale renders the canonical itself). An unknown token, an unknown locale or a row
   *  without that locale's column answers null. */
  localize(token: string, locale: string): string | null {
    const row = this.#byToken.get(token);
    if (row === undefined) return null;
    if (locale === "en") return row.en;
    const word = row[locale];
    return typeof word === "string" ? word : null;
  }
}

/**
 * RowSource — the one canonicalization of one document. Invariant: the head is read on the
 * raw text and the body is canonicalized exactly once, so the normalized view every
 * consumer reads is one set of bytes.
 */
export class RowSource {
  readonly #translator: Translator;

  constructor(translator: Translator) {
    this.#translator = translator;
  }

  /** Split + canonicalize one document into its head and normalized body. */
  read(content: string): CanonicalDocument {
    const { head, body } = frontmatterOf(content);
    const text = this.#translator.canonicalize(body);
    return { head, text, lines: text.split("\n") };
  }
}
