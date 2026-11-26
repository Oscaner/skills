// packages/cdd-engine/src/docs/index.ts
// A document's shape is judged by the registry, and every judgment reads text only.
//
// `Documents` is the material slice's one entry. It turns a repository coordinate into a
// parsed document, hands out a document type's registry and answers a derived projection.
// This wave delivers the READ faces only, over an INJECTED text reader:
//
//   · the reader is `env.workspace#readText`, which spells its target against the
//     repository root, so a `docs/**` coordinate reads the document it names;
//   · this slice owns no filesystem: no `node:fs` import appears anywhere under
//     `docs/`, and a different reader therefore reads a different document through the
//     same coordinate. That is the property the injection exists for — a judgment has
//     to be reproducible over a fabricated repository, not only over the one on disk;
//   · a read failure is returned AS IT ARRIVED, never swallowed into an empty document
//     and never rethrown. The wording of the consumer's `cannot read file: <rel>` byte
//     belongs to the render face; this slice answers the value;
//   · a declaration failure is a value too: `projectOf` answers `extra-target` when the
//     json face was handed a path it does not take. This slice never names the round's
//     usage vocabulary — `docs/` knows no round and imports no `run/`, so the word that
//     a failure renders as belongs to the face that knows the command.
//
// Four segments are in place: `grammar/` (the markdown tree, the body projection, the front
// matter and the task-block grammar, all pure text reads) · `identity/` (the four document
// types and their declared registries, the location vocabulary, the six derived projections,
// the four parse faces, the recognition layer and the `SKILL.md` anatomy contract) ·
// `judging/` (the tier and lens tables the review prompt folds in, the completion criteria,
// the wave-width ceiling over the graph's own decomposition, and the task graph itself) ·
// `skeleton/` (the four families' byte rendering). A skeleton write goes through the
// INJECTED writer for the same reason a read goes through the injected reader: this slice
// owns no filesystem, and the day it renders under is a construction fact, never a clock
// read.

import type { RepoPath } from "../env/paths/root.ts";
import type { MarkdownDocument } from "./grammar/markdown-document.ts";
import { MarkdownTree } from "./grammar/markdown-tree.ts";
import { Projector } from "./identity/project.ts";
import { declaredRegistries } from "./identity/registry.ts";
import { DOC_TYPE_VALUES, type DocType, type ElementRegistry } from "./identity/types.ts";
import {
  CRITERIA,
  type LensQuestionRow,
  type ReviewCriteria,
  type ReviewKind,
} from "./judging/criteria.ts";
import { SkeletonAssembler, type TextWriteOutcome, type TextWriter } from "./skeleton/assembler.ts";

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
export {
  type ChainLink,
  type ChainPhase,
  type ChainRoot,
  type DesignGroup,
  type DesignItem,
  DocParser,
  DocSyntaxError,
  docTypeParsers,
  type OverallParsed,
  OverallParser,
  type ParsedDoc,
  type ParsedTable,
  type PhaseSpecParsed,
  PhaseSpecParser,
  type PlanParsed,
  PlanParser,
  type SectionBlock,
  type SingleSpecParsed,
  SingleSpecParser,
} from "./identity/doc-parse.ts";
export {
  type DocReference,
  type DocSchema,
  type DocShape,
  type DocSkeleton,
  type DocSlices,
  type DocTokens,
  type ElementSlice,
  Projector,
} from "./identity/project.ts";
export {
  DOC_FACES,
  declaredRegistries,
  FaceMap,
  isLegalSlug,
  SLUG_VALUE_PATTERN,
} from "./identity/registry.ts";
export { SELF_REVIEW_OBLIGATIONS, SKILL_ANATOMY } from "./identity/skill-anatomy.ts";
export {
  type CanonicalDocument,
  type LocalizedWord,
  RowSource,
  Translator,
} from "./identity/translate.ts";
export {
  type DeclaredRegistries,
  DOC_TYPE_VALUES,
  type DocFace,
  type DocFaceEntry,
  type DocType,
  type ElementLocation,
  type ElementRegistry,
  type Presence,
  type RefKind,
  type RegistryElement,
  TARGET_TYPE_VALUES,
  type TargetType,
} from "./identity/types.ts";
export {
  COMPLETION_CRITERIA,
  CommitsCriterion,
  CompletionCriteria,
  type CompletionCriterion,
  type CompletionFacts,
  type CompletionVerb,
  type CompletionVerdict,
  FindingsCriterion,
} from "./judging/completion.ts";
export {
  CALIBRATION_TAIL,
  CLOSED_WAVE_DISCIPLINE,
  CRITERIA,
  CRITERIA_BODIES,
  type CriteriaFace,
  type CriteriaRow,
  type CriteriaTier,
  CriteriaTiers,
  LENS_QUESTIONS,
  type LensQuestionRow,
  LensQuestions,
  REVIEW_BODY_TEXT,
  REVIEW_KINDS,
  ReviewCriteria,
  type ReviewKind,
  RUBRIC_PREAMBLE,
  RUBRIC_SLOTS,
  reviewGuideOf,
  reviewKindOf,
  SEVERITY_RUBRIC,
  TIER_ORDER,
} from "./judging/criteria.ts";
export {
  GRAPH_ISSUE_CLASSES,
  type GraphIssue,
  type GraphIssueClass,
  TaskGraph,
} from "./judging/task-graph.ts";
export { MAX_TASKS_PER_WAVE, WaveWidth, type WideWave } from "./judging/wave-width.ts";
export {
  SkeletonAssembler,
  type SkeletonAssemblerOptions,
  type TextWriteOutcome,
  type TextWriter,
} from "./skeleton/assembler.ts";

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

/** A projection read's outcome: the derived bytes, or the declared refusal to render
 *  them because the json face takes no target. */
export type ProjectionResult =
  | { readonly kind: "projection"; readonly text: string }
  | { readonly kind: "extra-target"; readonly target: RepoPath };

/** A skeleton landing's declared outcome: the writer's own answer, or the refusal to write
 *  because the command named no target. The last value names a KIND of refusal only — the
 *  word a consumer prints for it belongs to the face that knows the command. */
export type SkeletonWrite = TextWriteOutcome | { readonly kind: "missing-target" };

/** The material slice's construction facts. */
export interface DocumentsOptions {
  /** The text reader — `env.workspace#readText` in production. */
  readonly readText: DocumentReader;
  /** The day every skeleton renders under — `env.process.clock#dayOf` read ONCE at the
   *  composition root. Required, no default: this slice never reads a clock. */
  readonly today: string;
  /** The one text write face — `env.workspace#writeTextAt` in production. */
  readonly textWriter: TextWriter;
}

/**
 * Documents — the material slice's entry. Invariant: a document's shape is judged by the
 * registry, and every judgment reads text only — so this class holds a reader, a writer and
 * one day, and nothing it answers comes from the filesystem or the clock directly.
 */
export class Documents {
  readonly #readText: DocumentReader;
  readonly #projector = new Projector(declaredRegistries);
  readonly #criteria: ReviewCriteria = CRITERIA;
  readonly #skeleton: SkeletonAssembler;

  constructor(opts: DocumentsOptions) {
    this.#readText = opts.readText;
    this.#skeleton = new SkeletonAssembler({
      projection: this.#projector.skeleton(),
      today: opts.today,
      textWriter: opts.textWriter,
    });
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

  /** One document type's declared registry. An unknown type throws — a type word the
   *  declaration does not carry is never answered with an empty registry. */
  registryOf(type: DocType): ElementRegistry {
    if (!(DOC_TYPE_VALUES as readonly string[]).includes(type)) {
      throw new Error(`unknown document type: ${String(type)}`);
    }
    return declaredRegistries[type];
  }

  /** One derived projection — the schema face's bytes (`schema get`'s json output). The
   *  SAME type answers the SAME bytes twice by construction: the projection is derived
   *  from the declared registries on every read, never cached and never edited. A target
   *  is refused before any rendering: the json face takes no path. */
  projectOf(type: DocType, target?: RepoPath): ProjectionResult {
    this.registryOf(type);
    if (target !== undefined) return { kind: "extra-target", target };
    return {
      kind: "projection",
      text: `${JSON.stringify(this.#projector.schema()[type], null, 2)}\n`,
    };
  }

  /** One review kind's criteria text — the body with its numbered lens list, the bytes the
   *  prompt's `**Criteria — <type>:**` line carries. An unregistered kind throws: a prompt
   *  can never read a body that was never declared. */
  criteriaOf(kind: ReviewKind): string {
    return this.#criteria.textOf(kind);
  }

  /** One review kind's lens questions, in declaration order. */
  lensQuestionsOf(kind: ReviewKind): readonly LensQuestionRow[] {
    return this.#criteria.lensQuestionsOf(kind);
  }

  /** One document type's skeleton BYTES — no trailing newline, so a caller that compares
   *  bytes compares the rendering itself. */
  skeletonOf(type: DocType): string {
    this.registryOf(type);
    return this.#skeleton.compose(type);
  }

  /** The skeleton LANDING — `target` absent is a declared refusal (`missing-target`),
   *  answered before any write; a target is rendered, given exactly one trailing newline and
   *  handed to the injected writer, whose own outcome is returned unchanged. The command's
   *  argv path arrives verbatim, so the shell carries no judgment about it. */
  skeletonAt(type: DocType, target: RepoPath | undefined): SkeletonWrite {
    this.registryOf(type);
    if (target === undefined) return { kind: "missing-target" };
    return this.#skeleton.assembleAt(type, target);
  }
}
