// packages/cdd-engine/src/docs/grammar/doc-body.ts
// The doc-body projection: the ONE slice a document revision hashes.
//
// A reviewed document's identity is its BODY, never its bookkeeping. The front-matter
// head (`version:`, `date:`, …) and the `## Change history` register are closed-out
// registrations: a write to either must not reopen a reviewed line, while a substantive
// body edit still drifts.
//
// Exactly two faces are stripped and nothing else:
//   · the opening YAML block — the first `---` fence through the next one (fence
//     recognition only, no YAML parse, and a `---` deeper in the body is body);
//   · the rank-2 `## Change history` section — located through the tree's rank-2 read,
//     never a bare regex over the whole text, so a fenced sample of that heading inside
//     the body stays part of the body.
// With neither face present the projection returns its input verbatim — byte-identical
// by construction, never an empty document.

import { MarkdownTree } from "./markdown-tree.ts";

/** The normalized rank-2 heading of the registration section — the one section name
 *  the projection strips. */
const CHANGE_HISTORY = "change history";

/** The opening/closing fence of a YAML head block. */
const FENCE = "---";

/** Project a document onto its reviewed body. */
export const docBodyOf = (content: string): string => {
  const lines = content.split(/\r?\n/);
  const bodyStart = DocBody.startOf(lines);
  const bodyLines = lines.slice(bodyStart);
  const dropped = DocBody.changeHistoryLines(bodyLines);
  if (bodyStart === 0 && dropped.size === 0) return content;
  return bodyLines.filter((_, index) => !dropped.has(index)).join("\n");
};

/** The body projection's two decisions, kept beside the projection so the module holds
 *  one spelling of each. */
// biome-ignore lint/complexity/noStaticOnlyClass: two pure judgments over one line array; there is no per-instance state to hold.
class DocBody {
  /** The first body line's index — past the closing fence when the document opens with
   *  one, 0 otherwise. */
  static startOf(lines: readonly string[]): number {
    if ((lines[0] ?? "").trim() !== FENCE) return 0;
    const closing = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
    return closing === -1 ? 0 : closing + 1;
  }

  /** The body-relative line indices of every `## Change history` section — the heading
   *  line plus its section body, read from the tree's rank-2 sections. */
  static changeHistoryLines(body: readonly string[]): ReadonlySet<number> {
    const dropped = new Set<number>();
    for (const section of MarkdownTree.parse(body.join("\n")).sections()) {
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
