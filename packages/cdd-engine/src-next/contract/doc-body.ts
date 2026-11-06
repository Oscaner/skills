// packages/cdd-engine/src-next/contract/doc-body.ts
// P26 T1 (spec §1.2/§1.3) — the doc-body projection: the ONE slice every
// `doc-revision` hashes. A reviewed document's identity is its BODY, never its
// bookkeeping: the front-matter head (`version:`, `date:`, …) and the
// `## Change history` register are closed-out registrations, so a write to either
// must not reopen a reviewed line, while a substantive body edit still drifts.
//
// The projection strips exactly two faces and nothing else:
//   · the opening YAML block — the first `---` fence through the next `---` fence
//     (fence recognition only: no YAML parse, and a `---` later in the body is
//     body, not a fence);
//   · the rank-2 `## Change history` section — located through
//     `MarkdownTree.sections()` (the tree's rank-2 read), never a bare regex over
//     the whole text, so a fenced sample of that heading inside the body stays.
// With neither face present the projection returns the input verbatim — the
// mapping is byte-identical there by construction, never an empty document.

import { FrontMatterExtractor } from "./frontmatter.ts";
import { MarkdownTree } from "./markdown-tree.ts";

/**
 * DocBodyProjection — the reviewed-body slice: `project(content)` returns the
 * document with its bookkeeping faces removed. One stateless read; the hash
 * itself stays at the single caller (`ReviewRefs#docRevision`), so this class
 * answers WHAT the body is and never HOW it is digested.
 */
export class DocBodyProjection {
  /** The normalized rank-2 heading of the registration section — the one section
   *  name the projection strips (compared after heading normalization). */
  static readonly CHANGE_HISTORY = "change history";

  /** Project a document onto its reviewed body: front matter and the change-history
   *  section removed, every other line kept in order. Returns the input unchanged
   *  when neither face is present (byte-identical, never an empty string). */
  project(content: string): string {
    const lines = FrontMatterExtractor.lineSplit(content);
    const bodyStart = this.#bodyStart(lines);
    const dropped = this.#changeHistoryLines(lines.slice(bodyStart));
    if (bodyStart === 0 && dropped.size === 0) return content;
    const kept = lines.filter((_, index) => index >= bodyStart && !dropped.has(index - bodyStart));
    return FrontMatterExtractor.lineJoin(kept);
  }

  /** The first body line's index — past the closing fence when the document opens
   *  with one, 0 otherwise (a `---` deeper in the body is body, not a fence). */
  #bodyStart(lines: readonly string[]): number {
    if (lines[0]?.trim() !== "---") return 0;
    const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    return closing === -1 ? 0 : closing + 1;
  }

  /** The body-relative line indices of every `## Change history` section — the
   *  heading line plus its section body, read from the tree's rank-2 sections. */
  #changeHistoryLines(body: readonly string[]): ReadonlySet<number> {
    const dropped = new Set<number>();
    const tree = MarkdownTree.parse(FrontMatterExtractor.lineJoin(body));
    for (const section of tree.sections()) {
      if (!DocBodyProjection.#isChangeHistory(section.text)) continue;
      // `section.line` is 1-based: the heading sits at index line-1 and the section
      // body runs `section.lines.length` lines further.
      for (let index = section.line - 1; index < section.line + section.lines.length; index++) {
        dropped.add(index);
      }
    }
    return dropped;
  }

  /** Whether a heading text normalizes to the change-history name — fence markers
   *  and surrounding whitespace dropped, case folded. */
  static #isChangeHistory(heading: string): boolean {
    const name = heading
      .trim()
      .replace(/^#+\s*/, "")
      .trim()
      .toLowerCase();
    return name === DocBodyProjection.CHANGE_HISTORY;
  }
}
