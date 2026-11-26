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
// the wave-width ceiling over the graph's own decomposition, the task graph itself, the rule
// table and the strategy family it points at, the coordinator, the locator engine, the WARN
// observation face, the path grammar, the document index and its proven-closure reading, and
// the downgrade note's display composition) · `skeleton/` (the four families' byte
// rendering). A skeleton write goes through the INJECTED writer for the same reason a read
// goes through the injected reader: this slice owns no filesystem, and the day it renders
// under is a construction fact, never a clock read.
//
// Judging reads the repository through TWO injected seams and no third: the single-target
// text reader (`parse`) and the document world (the indexed documents, one read face, an
// existence probe, one directory listing and the three doc roots). The default world derives
// from the reader alone — it answers the coordinate it was handed and indexes nothing — so a
// caller that needs the chain, closure or sibling faces injects the real one at the
// composition root; the degraded world refuses nothing and passes no shape rule.

import { DOC_ROOT_SEGMENTS } from "../env/paths/doc-roots.ts";
import type { RepoPath } from "../env/paths/root.ts";
import type { MarkdownDocument } from "./grammar/markdown-document.ts";
import { MarkdownTree } from "./grammar/markdown-tree.ts";
import { Projector } from "./identity/project.ts";
import { declaredRegistries } from "./identity/registry.ts";
import { type LocalizedWord, Translator } from "./identity/translate.ts";
import { DOC_TYPE_VALUES, type DocType, type ElementRegistry } from "./identity/types.ts";
import { ClosedDocument, type DocumentWorld } from "./judging/closure.ts";
import {
  CRITERIA,
  type LensQuestionRow,
  type ReviewCriteria,
  type ReviewKind,
} from "./judging/criteria.ts";
import type { Finding, LedgerFacts } from "./judging/invariants.ts";
import { Judge, type JudgeInput } from "./judging/judge.ts";
import { LintPass, type Warn } from "./judging/lint.ts";
import type { RuleDeclaration } from "./judging/rules.ts";
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
  ClosedDocument,
  type DocRootPaths,
  DocumentIndex,
  type DocumentWorld,
  docNamespaceOf,
  docRootNamesOf,
  type IndexedDocument,
} from "./judging/closure.ts";
export {
  COMPLETION_CRITERIA,
  CommitsCriterion,
  CompletionCriteria,
  type CompletionCriterion,
  type CompletionFacts,
  type CompletionObservation,
  type CompletionVerb,
  type CompletionVerdict,
  FindingsCriterion,
  IMPLEMENT_CARRIER_ABSENT,
  IMPLEMENT_VERIFICATION_WAVE,
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
  displayReason,
  LENS_QUESTIONS,
  type LensQuestionRow,
  LensQuestions,
  REGRADE_MARK,
  REGRADE_NOTE_SEPARATOR,
  REVIEW_BODY_TEXT,
  REVIEW_KINDS,
  ReviewCriteria,
  type ReviewKind,
  RUBRIC_PREAMBLE,
  RUBRIC_SLOTS,
  regradeNote,
  reviewGuideOf,
  reviewKindOf,
  SEVERITY_RUBRIC,
  TIER_ORDER,
} from "./judging/criteria.ts";
export {
  CHANGE_HISTORY_COLUMNS,
  type FileClaim,
  type FileDeclaration,
  FileDeclarations,
  type FileVerb,
  type Finding,
  type FindingDraft,
  type InjectedGraphIssue,
  type Invariant,
  type JudgeContext,
  type LedgerFacts,
  type LedgerRule,
  LedgerRuleBase,
  type ProseLine,
} from "./judging/invariants.ts";
export {
  type DocRuleBinding,
  Judge,
  type JudgeInput,
  type JudgeOptions,
} from "./judging/judge.ts";
export { LintPass, type Warn } from "./judging/lint.ts";
export {
  type DocRuleDeclaration,
  type LedgerRuleDeclaration,
  RULE_REGISTRY,
  type RuleDeclaration,
  type RuleSeat,
} from "./judging/rules.ts";
export {
  type Candidate,
  type ResolvedNode,
  SelectorEngine,
  type TreeEdge,
} from "./judging/selectors.ts";
export { type PathForm, PathShape } from "./judging/shape-rules.ts";
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
  /** The document world the judgment reads through. Absent → a world derived from the
   *  reader alone: it answers the coordinate it is handed and indexes nothing, so the chain,
   *  closure and sibling faces see an empty repository. The composition root injects the
   *  real one (`env/` behind this port). */
  readonly world?: DocumentWorld;
  /** The recognition rows the row source canonicalizes with — the word table's locale rows
   *  in production. Absent → no alias is recognized, which is the identity for an
   *  English-primary document. */
  readonly localeRows?: readonly LocalizedWord[];
}

/**
 * Documents — the material slice's entry. Invariant: a document's shape is judged by the
 * registry, and every judgment reads text only — so this class holds a reader, a writer, one
 * day and one document world, and nothing it answers comes from the filesystem or the clock
 * directly.
 *
 * Rule zero (over the 200-line class limit): every member is a READ of the same three
 * construction facts (the tree parse, the projected registries, the judgment over the
 * injected world), so a split would move surface area without removing a single variation.
 */
export class Documents {
  readonly #readText: DocumentReader;
  readonly #projector = new Projector(declaredRegistries);
  readonly #criteria: ReviewCriteria = CRITERIA;
  readonly #skeleton: SkeletonAssembler;
  readonly #world: DocumentWorld;
  readonly #judge: Judge;
  /** The ONE closure reading of this slice — the judgment's exemption and the gate's
   *  `checked:` yield line read the same instance, so a document's closure is computed once. */
  readonly #closed: ClosedDocument;
  readonly #lint = new LintPass();

  constructor(opts: DocumentsOptions) {
    this.#readText = opts.readText;
    this.#world = opts.world ?? Documents.#readerWorld(opts.readText);
    this.#skeleton = new SkeletonAssembler({
      projection: this.#projector.skeleton(),
      today: opts.today,
      textWriter: opts.textWriter,
    });
    this.#judge = new Judge({
      translator: new Translator(opts.localeRows ?? []),
      world: this.#world,
    });
    this.#closed = new ClosedDocument({
      index: this.#judge.index,
      read: (rel) => this.#world.read(rel),
    });
  }

  /** The reader-only world — the default when no world is injected. It answers the one
   *  coordinate the reader can read and holds no index, so a judgment that needs the document
   *  set (the identity chain, the proven closure, the sibling scan) reads an empty set rather
   *  than a fabricated one. */
  static #readerWorld(readText: DocumentReader): DocumentWorld {
    const textOf = (rel: RepoPath): string | null => {
      const read = readText(rel);
      return read.kind === "text" ? read.value : null;
    };
    return {
      documents: () => [],
      read: textOf,
      exists: (rel) => textOf(rel) !== null,
      list: () => [],
      roots: () => ({
        overalls: DOC_ROOT_SEGMENTS.overalls as RepoPath,
        specs: DOC_ROOT_SEGMENTS.specs as RepoPath,
        plans: DOC_ROOT_SEGMENTS.plans as RepoPath,
      }),
    };
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

  /** One document's JUDGMENT — the declared rule rows applicable to its type, stamped by
   *  their own tier, with the proven-closure exemption applied. The closure is read HERE,
   *  once, from the SAME reading the gate's `checked:` yield line asks (`closedAt`). */
  judge(input: JudgeInput): readonly Finding[] {
    this.registryOf(input.docKey);
    return this.#judge.judge(input, this.closedAt(input.path));
  }

  /** The ledger-scope judgment — the same document plus the ledger fact bundle, judged by the
   *  declared ledger rows alone. A doc judgment never runs these, and they never run there. */
  judgeLedger(input: JudgeInput, ledger: LedgerFacts): readonly Finding[] {
    this.registryOf(input.docKey);
    return this.#judge.judgeLedger(input, ledger);
  }

  /** The WARN observation face — the reference lint over the SAME parse context the judgment
   *  built. Its warnings never enter a verdict: forcing one changes no finding count. */
  lintOf(input: JudgeInput): readonly Warn[] {
    this.registryOf(input.docKey);
    return this.#lint.run(this.#judge.contextOf(input));
  }

  /** Whether one document is PROVEN closed — the ONE closure reading of this slice, so the
   *  judgment's exemption and the gate's `checked:` yield line answer from one computation. */
  closedAt(target: RepoPath): boolean {
    return this.#closed.closed(target);
  }

  /** Every declared rule row (both scopes) the judgment walks, in table order — the
   *  pre-flight renders its `checked:` face from these rows, never from a second list. */
  ruleRows(): readonly RuleDeclaration[] {
    return this.#judge.ruleRows();
  }
}
