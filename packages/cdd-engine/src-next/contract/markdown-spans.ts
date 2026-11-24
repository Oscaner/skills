// packages/cdd-engine/src-next/contract/markdown-spans.ts
// The markdown span reader — the ONE fence-aware line read the shape grammars and the
// sentence index share. Only INLINE code spans carry a claim: a fenced
// block is example code (its bytes are not a document's assertion), and a span's content
// is the text between a backtick run and the next run of the same length.
//
// Four entry points, one walk: `proseEntriesOf` is the fence judgment (line numbers
// kept), `proseOf` its string projection, `blankedOf` the column-preserving read the
// recognized-form grammars judge (a claim quoted in a code span is a citation, never a
// violation), and `tokensOf` the span list. Nothing here judges meaning.
//
// Module-level exports are the class — zero behavior-carrying bare functions.

/**
 * ProseSpans — the markdown reader. Every reader in this repository that has to decide
 * "is this line prose, and where are its inline spans" asks HERE, so a fence and a span
 * carry one judgment across the line, the shape rules and the marker scan.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the markdown span reader is a declared static reader set — the repo's zero-bare-function discipline admits no standalone parser.
export class ProseSpans {
  /** Every inline code span of one markdown body, in document order. */
  static tokensOf(text: string): readonly string[] {
    const tokens: string[] = [];
    for (const line of ProseSpans.proseOf(text)) {
      for (const span of ProseSpans.#spansIn(line)) tokens.push(span.text);
    }
    return tokens;
  }

  /** Every prose line of one markdown body, in document order, with its 1-based line
   *  number — the lines OUTSIDE fenced blocks, fence delimiters dropped. The ONE
   *  fence-aware line read: span extraction, the shape rules' prose-line splitting and
   *  the sentence index all walk this, so a fence keeps a single judgment. */
  static proseEntriesOf(text: string): readonly { readonly line: number; readonly text: string }[] {
    const entries: { line: number; text: string }[] = [];
    let fenced = false;
    text.split("\n").forEach((line, index) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return;
      }
      if (fenced) return;
      entries.push({ line: index + 1, text: line });
    });
    return entries;
  }

  /** The prose line TEXTS of one markdown body — the string projection of the entry
   *  face above, for a caller that needs the lone fence judgment and no coordinates:
   *  span extraction (`tokensOf`) and the fence arm of the shape suite read it.
   *  `ProseLines` reads the entries (it has to carry line numbers), and both arrive on
   *  the ONE walk, so the shape rules and the sentence index hold no second reading. */
  static proseOf(text: string): readonly string[] {
    return ProseSpans.proseEntriesOf(text).map((entry) => entry.text);
  }

  /** One line with every inline code span blanked to spaces of the same width — the
   *  column-preserving read the recognized-form grammars judge, so a claim quoted in
   *  a code span is a citation and never a violation. */
  static blankedOf(line: string): string {
    const out = line.split("");
    for (const span of ProseSpans.#spansIn(line)) {
      for (let at = span.from; at < span.to; at += 1) out[at] = " ";
    }
    return out.join("");
  }

  /** The inline spans of one line, as skip-able ranges — a run of `n` backticks closed
   *  by the next run of the same length; an unmatched run ends the line's scan (never
   *  an invented span). The range INCLUDES both delimiters, so a blanked read hides the
   *  code fully while preserving the column positions. */
  static #spansIn(line: string): readonly { from: number; to: number; text: string }[] {
    const spans: { from: number; to: number; text: string }[] = [];
    let index = 0;
    while (index < line.length) {
      const open = line.indexOf("`", index);
      if (open === -1) break;
      let width = 0;
      while (line[open + width] === "`") width += 1;
      const closer = line.indexOf("`".repeat(width), open + width);
      if (closer === -1) break;
      spans.push({
        from: open,
        to: closer + width,
        text: line.slice(open + width, closer),
      });
      index = closer + width;
    }
    return spans;
  }
}
