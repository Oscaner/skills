// packages/cdd-engine/src/docs/index.ts
// A document's shape is judged by the registry, and every judgment reads text only.
//
// `Documents` is the material slice's one entry: it turns a repository coordinate into
// a parsed document and (in later waves) judges one, and hands out a skeleton. This
// wave delivers the READ face only — the parse — over an INJECTED text reader:
//
//   · the reader is `env.workspace#readText`, which spells its target against the
//     repository root, so a `docs/**` coordinate reads the document it names;
//   · this slice owns no filesystem: no `node:fs` import appears anywhere under
//     `docs/`, and a different reader therefore reads a different document through the
//     same coordinate. That is the property the injection exists for — a judgment has
//     to be reproducible over a fabricated repository, not only over the one on disk;
//   · a read failure is returned AS IT ARRIVED, never swallowed into an empty document
//     and never rethrown. The wording of the consumer's `cannot read file: <rel>` byte
//     belongs to the render face; this slice answers the value.
//
// The grammar below (the tree, the index, the body projection, the front matter, the
// home extraction and the task blocks) reads TEXT and returns values. It knows no
// document type, no round and no judgment: those arrive with the registry and the
// rules in later waves, which is what keeps "where is this heading" from becoming
// "is this document legal" by accident.

import type { RepoPath } from "../env/paths/root.ts";
import type { MarkdownDocument } from "./grammar/markdown-document.ts";
import { MarkdownTree } from "./grammar/markdown-tree.ts";

export { docBodyOf } from "./grammar/doc-body.ts";
export {
  type ExtractionMap,
  type Home,
  type HomeElement,
  HomeExtractor,
} from "./grammar/extract.ts";
export { FrontMatter, FrontMatterError, frontmatterOf } from "./grammar/frontmatter.ts";
export { MarkdownDocument } from "./grammar/markdown-document.ts";
export { type HeadingBranch, MarkdownTree } from "./grammar/markdown-tree.ts";
export { TaskBlockGrammar, TaskBlocks } from "./grammar/task-blocks.ts";

/** A document's text, as one read face answers it. */
export interface RepoText {
  /** The success discriminator. */
  readonly kind: "text";
  /** The coordinate that was read. */
  readonly target: RepoPath;
  /** The document's bytes. */
  readonly value: string;
}

/** A read that produced no text — the declared failure, carrying the coordinate. */
export interface ReadFailure {
  /** The failure discriminator. */
  readonly kind: "read-failure";
  /** The coordinate that could not be read. */
  readonly target: RepoPath;
}

/** The text reader this slice is constructed with — `env.workspace#readText` in
 *  production, a fabricated reader in a test. */
export type DocumentReader = (target: RepoPath) => RepoText | ReadFailure;

/** A parsed document: the tree and the index over the same one parse. */
export interface ParsedDocument {
  /** The success discriminator. */
  readonly kind: "document";
  /** The coordinate that was parsed. */
  readonly target: RepoPath;
  /** The document read as a heading tree. */
  readonly tree: MarkdownTree;
  /** The document index behind that tree. */
  readonly index: MarkdownDocument;
}

/** The parse outcome — a document, or the reader's failure unchanged. */
export type ParseResult = ParsedDocument | ReadFailure;

/**
 * Documents — the material slice's entry. Invariant: a document's shape is judged by
 * the registry, and every judgment reads text only — so this class holds a reader and
 * no filesystem, and every read comes back through the injected face.
 */
export class Documents {
  readonly #readText: DocumentReader;

  constructor(opts: { readText: DocumentReader }) {
    this.#readText = opts.readText;
  }

  /** Parse one repository coordinate. The reader's failure value is returned as it
   *  arrived; a successful read is parsed once and both faces (tree and index) come
   *  from that one parse. */
  parse(target: RepoPath): ParseResult {
    const read = this.#readText(target);
    if (read.kind !== "text") return read;
    const tree = MarkdownTree.parse(read.value);
    return { kind: "document", target, tree, index: tree.document };
  }
}
