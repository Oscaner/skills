// packages/cdd-engine/src/docs/grammar/doc-body.ts
// The doc-body projection: the ONE slice a document revision hashes.
//
// A reviewed document's identity is its BODY, never its bookkeeping. The front-matter
// head (`version:`, `date:`, …) and the `## Change history` register are closed-out
// registrations: a write to either must not reopen a reviewed line, while a substantive
// body edit still drifts.
//
// Exactly two faces are stripped and nothing else:
//   · the opening YAML block — the first `---` fence through the next one (the slice's
//     ONE fence walk, `headFenceOf`: recognition only, no YAML parse, and a `---`
//     deeper in the body is body);
//   · the rank-2 `## Change history` section — located through the tree's rank-2 read,
//     never a bare regex over the whole text, so a fenced sample of that heading inside
//     the body stays part of the body.
// With neither face present the projection returns its input verbatim — byte-identical
// by construction, never an empty document. Every line keeps the `\r` a CRLF text gave
// it (`lineSplitOf` / `lineJoinOf`), so the projection is the same byte slice the
// pre-rebuild tree produced.

import { headFenceOf, lineJoinOf, lineSplitOf } from "./frontmatter.ts";
import { MarkdownTree } from "./markdown-tree.ts";

/** The normalized rank-2 heading of the registration section — the one section name
 *  the projection strips. */
const CHANGE_HISTORY = "change history";

/** Project a document onto its reviewed body. */
export const docBodyOf = (content: string): string => {
  const lines = lineSplitOf(content);
  const closing = headFenceOf(lines);
  const bodyStart = closing === -1 ? 0 : closing + 1;
  const bodyLines = lines.slice(bodyStart);
  const dropped = DocBody.changeHistoryLines(bodyLines);
  if (bodyStart === 0 && dropped.size === 0) return content;
  return lineJoinOf(bodyLines.filter((_, index) => !dropped.has(index)));
};

/** The body projection's one decision, kept beside the projection so the module holds
 *  one spelling of it. */
// biome-ignore lint/complexity/noStaticOnlyClass: one pure judgment over one line array; there is no per-instance state to hold.
class DocBody {
  /** The body-relative line indices of every `## Change history` section — the heading
   *  line plus its section body, read from the tree's rank-2 sections. */
  static changeHistoryLines(body: readonly string[]): ReadonlySet<number> {
    const dropped = new Set<number>();
    for (const section of MarkdownTree.parse(lineJoinOf(body)).sections()) {
      if (!DocBody.#isChangeHistory(section.text)) continue;
      for (let index = section.line - 1; index < section.line + section.lines.length; index += 1) {
        dropped.add(index);
      }
    }
    return dropped;
  }

  /** Whether a heading names the registration section — markers and whitespace
   *  dropped, case folded. */
  static #isChangeHistory(heading: string): boolean {
    const name = heading
      .trim()
      .replace(/^#+\s*/, "")
      .trim()
      .toLowerCase();
    return name === CHANGE_HISTORY;
  }
}
