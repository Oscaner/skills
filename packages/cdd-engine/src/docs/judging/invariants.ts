// packages/cdd-engine/src/docs/judging/invariants.ts
// The invariant strategy family: every structural judgment of a document is ONE strategy
// class, and the rule table (`judging/rules.ts`) is the list — each declared row names
// exactly one class here, and the class's `name` is verbatim the row id.
//
//   doc scope    — presence · domain · crosslink · section-order · continuity · residue ·
//                  hollow · file-existence · sibling-scan · link-shape · slug-ref ·
//                  cross-doc-chain · section-scoped-domain ·
//                  phase-design-spec-is-phase-spec;
//                 the change-history family — change-history-version-unique ·
//                  change-history-header-columns · change-history-row-shape ·
//                  change-history-latest-matches-front-matter ·
//                  front-matter-version-in-lineage ·
//                  change-history-row-not-in-other-table · list-marker-not-doubled;
//                 the identity legs — task-id-unique · phase-id-unique;
//                 the shape gate — line-coordinate · live-arithmetic ·
//                  change-history-date-shape;
//                 the graph legs — wave-width-at-most-three · single-create ·
//                  dangling-task-ref · depends-on-cycle · change-history-newest-last;
//   ledger scope — closed-wave-fits-depends-on-layers · planned-tasks-vs-recorded-tasks
//                  (a `LedgerRule`, judged with the ledger fact bundle).
//
// Each doc strategy is one subclass of `abstract Invariant { evaluate(ctx) }`; each ledger
// rule extends `LedgerRuleBase` (`evaluate(ctx, ledger)`) — two scopes, two entry shapes.
// The judgment data is always the declared registries plus the derived parse face (never
// hand-written structure prose), and every text read goes through `grammar/` and
// `identity/`: no strategy opens a file, none scans a raw line to decide structure.
//
// Dispatch is the coordinator's data-driven per-doc-type composition (`judging/judge.ts`) —
// zero switch-case here, zero exported behaviour-carrying bare functions.
//
// Rule zero (over the 200-line class limit): this module holds the WHOLE family on purpose —
// "the registry and the family it points at live together" is this phase's design decision,
// and splitting the family per concern would reintroduce the registry-directory it removed.

import path from "node:path";
import type { RepoPath } from "../../env/paths/root.ts";
import type { FrontMatter } from "../grammar/frontmatter.ts";
import { frontmatterOf } from "../grammar/frontmatter.ts";
import { MarkdownTree } from "../grammar/markdown-tree.ts";
import type { TaskBlock } from "../grammar/types.ts";
import type {
  ChainLink,
  DesignGroup,
  OverallParsed,
  ParsedDoc,
  ParsedTable,
  SectionBlock,
} from "../identity/doc-parse.ts";
import { docTypeParsers } from "../identity/doc-parse.ts";
import type { DocShape, DocSkeleton, DocSlices, ElementSlice } from "../identity/project.ts";
import { FaceMap } from "../identity/registry.ts";
import type { Translator } from "../identity/translate.ts";
import { RowSource } from "../identity/translate.ts";
import type {
  DeclaredRegistries,
  DocFace,
  DocType,
  ElementRegistry,
  RegistryElement,
} from "../identity/types.ts";
import type { DocumentIndex, DocumentWorld, IndexedDocument } from "./closure.ts";
import { docNamespaceOf, docRootNamesOf } from "./closure.ts";
import type { ResolvedNode, SelectorEngine } from "./selectors.ts";
import { PathShape } from "./shape-rules.ts";
import { MAX_TASKS_PER_WAVE } from "./wave-width.ts";

// ---------------------------------------------------------------------------
// judgment records + the context
// ---------------------------------------------------------------------------

/** One finding DRAFT — what a strategy hands back: a single invariant violation bound to
 *  a document + field. The tier is deliberately ABSENT: a strategy judges whether a
 *  condition holds, the rule declaration says what a hit costs, and only the coordinator
 *  joins the two. */
export interface FindingDraft {
  /** The doc coordinate the finding refers to. */
  path: RepoPath;
  /** The anchored field the finding refers to (an anchor token or a section name). */
  field: string;
  /** The one-line finding message (what is wrong). */
  message: string;
  /** The actionable fix. */
  fix: string;
  /** The invariant name that produced the finding. */
  kind: string;
}

/** One STAMPED finding — a draft plus the tier its rule declaration carries. The gate
 *  refuses on `block` and annotates on `warn`; nothing else reads the tier. */
export interface Finding extends FindingDraft {
  readonly severity: "block" | "warn";
}

/** One edge-validation issue as the caller injects it — the graph's PUBLIC `validate()`
 *  output plus its ONE rendered detail line (`TaskGraph.detailLine`). The rule plane never
 *  imports the graph authority, so the fact arrives exactly as the plan's topological
 *  layers already do, and the rendered line travels WITH it: this plane and the gate's
 *  `details` row print one template owned by one author. */
export interface InjectedGraphIssue {
  /** The failure class (`cycle` is this plane's own; the others are the gate's). */
  readonly kind: string;
  /** The offending task id. */
  readonly task: number;
  /** The graph's one-line issue message. */
  readonly message: string;
  /** The graph's actionable fix. */
  readonly fix: string;
  /** The rendered `{kind}@T{task}: {message}` line. */
  readonly detail: string;
}

/** The judgment context — everything a strategy reads, assembled by the coordinator. */
export interface JudgeContext {
  /** The doc-type record key of the document under judgment. */
  readonly docKey: DocType;
  /** The parsed structural record of the document. */
  readonly parsed: ParsedDoc;
  /** The document's typed front-matter head — the head facts judge THIS record, never a
   *  body line scan: front matter is data, not body structure. */
  readonly head: FrontMatter;
  /** The document's repo-relative coordinate (message attribution + the doc's own dir). */
  readonly path: RepoPath;
  /** The derived parse face of the judged doc type. */
  readonly slices: DocSlices;
  /** The derived section skeleton of the judged doc type. */
  readonly shape: DocShape;
  /** The judged doc type's skeleton projection — the slot classification the placeholder
   *  exemption reads. */
  readonly skeleton: DocSkeleton;
  /** The four declared registries — the element-level judgment data. */
  readonly registries: DeclaredRegistries;
  /** The dispatch phase id — enables the phase-registration check. */
  readonly phaseId?: string;
  /** The judged document's markdown tree — the ONE structure parse: the strategies resolve
   *  their elements' declared locations against it through `selector`. */
  readonly tree: MarkdownTree;
  /** The tree's locator face — the same parse, read as resolved nodes. */
  readonly selector: SelectorEngine;
  /** The row source's canonicalized BODY text (front matter excluded) — the ONE read face
   *  of the shape rules and the sentence index. Reading the document's own file instead
   *  would also judge the front-matter lines, which sit under no registered section and
   *  would land as face gaps: a document with a clean body would be refused for its data
   *  head. */
  readonly text: string;
  /** The row-source translator — the SAME canonicalize seam the judged document's lines
   *  went through. A strategy that parses a FOREIGN document (the chain lineage) reads it
   *  through this instance, so one alias registration canonicalizes both faces alike. */
  readonly translator: Translator;
  /** The injected document world — text reads only, never a filesystem. */
  readonly world: DocumentWorld;
  /** The document index over that world — the slug / doc-type relation. */
  readonly index: DocumentIndex;
  /** The plan's topological layers (one task-id set per layer), injected by the caller —
   *  the graph is the ONE derivation authority, so a layer-reading rule never re-derives
   *  batches. Absent on a call site that carries no plan graph: the layer-reading rule then
   *  yields zero findings and its checked row renders the visible degradation. */
  readonly taskLayers?: readonly (readonly number[])[];
  /** The plan's edge-validation issues, injected by the caller — the graph's own verdict,
   *  never a second derivation. Absent on a call site that carries no graph: the rule then
   *  yields zero findings. */
  readonly graphIssues?: readonly InjectedGraphIssue[];
}

/** The ledger fact bundle — the cross-ledger rules' second judgment input. It rides the
 *  dedicated ledger entry, never a `JudgeContext` field: one entry, one judgment (a doc
 *  judgment never silently runs ledger rules). */
export interface LedgerFacts {
  /** The plan's current task ids (the document under judgment). */
  readonly planTasks: readonly number[];
  /** The task ids the ledger already recorded at least one round for. */
  readonly recordedTasks: readonly number[];
  /** The ledger's CLOSED waves, each as its task-id set. */
  readonly closedWaves: readonly (readonly number[])[];
  /** The ledger's OPEN waves — the wave rows that are not closed yet. The layering rule
   *  reads THESE: a closed wave is settled history whose layer fit was judged at its own
   *  dispatch, so a later plan edit must not retro-flag a wave that already shipped. */
  readonly openWaves: readonly (readonly number[])[];
  /** The wave rows' `planTasks` snapshots (the append-vs-stall observation). */
  readonly snapshots: readonly {
    readonly wave: string;
    readonly planTasks: readonly number[];
  }[];
  /** The plan's topological layers (one task-id set per layer) — the sole input of the
   *  layering rule. */
  readonly layers: readonly (readonly number[])[];
}

/** The ledger-scope judgment entry — two arguments, one per fact source. It hands back
 *  DRAFTS: the tier is stamped by the coordinator, never filled here. */
export interface LedgerRule {
  readonly name: string;
  evaluate(ctx: JudgeContext, ledger: LedgerFacts): FindingDraft[];
}

// ---------------------------------------------------------------------------
// the abstract strategy base
// ---------------------------------------------------------------------------

/** The three-table section heading anchors of the overall the hollow rule reads. */
const OVERALL_TABLE_NAMES = ["Issue inventory", "Phase inventory", "Change history"];

/** Home surfaces the presence rule judges — the structural doc surface (table
 *  rows/columns/tokens are judged by hollow / section-scoped strategies). */
const PRESENCE_HOMES: ReadonlySet<string> = new Set([
  "frontmatter",
  "section",
  "facet",
  "graph",
  "task-block",
  "task-field",
  "task-step",
  "design-body",
  "conditional",
]);

/**
 * Invariant — the abstract strategy: one class, one structural judgment. Subclasses
 * implement `evaluate(ctx)` and read all judgment data from the declared registries plus
 * the parse face carried by the context.
 */
export abstract class Invariant {
  /** The invariant's name — the finding attribution label, verbatim the rule id. */
  abstract readonly name: string;

  /** Run the strategy — the single evaluation entry. */
  abstract evaluate(ctx: JudgeContext): FindingDraft[];

  /** The single finding-construction point. */
  protected finding(ctx: JudgeContext, field: string, message: string, fix: string): FindingDraft {
    return { path: ctx.path, field, message, fix, kind: this.name };
  }

  /** Whether a value's raw form marks it as a holder placeholder (no existence or domain
   *  judgment): the empty value, the two pending forms, the `<…>` link placeholder and the
   *  skeleton's `:::fill <slot>` content slot. The ONE placeholder contract every strategy
   *  shares. */
  protected isPlaceholder(target: string): boolean {
    const trimmed = target.trim();
    if (trimmed === "") return true;
    if (trimmed === "Pending" || trimmed === "[Pending]") return true;
    if (/^<[^>]+>$/.test(trimmed)) return true;
    return /^:::fill(?:\s|$)/.test(trimmed);
  }

  /** The judged doc type's declared registry. */
  protected registry(ctx: JudgeContext): ElementRegistry {
    return ctx.registries[ctx.docKey];
  }

  /** The judged doc type's registered elements in registry order. */
  protected elementsOf(ctx: JudgeContext): readonly RegistryElement[] {
    return this.registry(ctx).elements;
  }

  /** One element's derived slice, undefined when the doc type does not register it. */
  protected sliceOf(ctx: JudgeContext, anchor: string): ElementSlice | undefined {
    return ctx.slices.slices.find((slice) => slice.anchor === anchor);
  }

  /** The judged document's declared element of one anchor. */
  protected elementOf(ctx: JudgeContext, anchor: string): RegistryElement | undefined {
    return this.elementsOf(ctx).find((element) => element.anchor === anchor);
  }

  /** The occurrences of one element's DECLARED location — the ONE occurrence read of the
   *  judgment plane: a node of the tree, never a raw line scan. An unregistered anchor (or
   *  an absent surface) resolves to zero nodes. */
  protected occurrenceNodes(ctx: JudgeContext, anchor: string): readonly ResolvedNode[] {
    const element = this.elementOf(ctx, anchor);
    if (element === undefined) return [];
    return ctx.selector.occurrences(element.selector);
  }

  /** The occurrence texts of one element's declared location. */
  protected occurrenceTexts(ctx: JudgeContext, anchor: string): readonly string[] {
    return this.occurrenceNodes(ctx, anchor).map((node) => node.text);
  }

  /** The value-CARRYING occurrences of an element — a node whose literal anchor mention
   *  stays entirely inside an inline-code span cites the token, it does not carry its
   *  value (the code-span boundary is read off the tree's own inline-code node spans, never
   *  a first/last-backtick guess). */
  protected carrierNodes(ctx: JudgeContext, anchor: string): readonly ResolvedNode[] {
    return this.occurrenceNodes(ctx, anchor).filter((node) => {
      if (!node.text.includes(anchor)) return true;
      return node.bare.includes(anchor);
    });
  }

  /** The judged document's typed parse record, narrowed by the doc type. */
  protected record<K extends ParsedDoc["docType"]>(
    ctx: JudgeContext,
    docType: K,
  ): Extract<ParsedDoc, { docType: K }> | null {
    return ctx.parsed.docType === docType
      ? (ctx.parsed as Extract<ParsedDoc, { docType: K }>)
      : null;
  }

  /** The plan's task blocks, in document order — the ONE block read (the parse record's own
   *  extraction: no second parse of the tree). */
  protected tasks(ctx: JudgeContext): readonly TaskBlock[] {
    return this.record(ctx, "plan")?.taskBlocks ?? [];
  }

  /** The doc's `## Change history` table — the ONE lineage read face all four doc types
   *  expose. The record keeps the header and the body rows verbatim: a row whose cell count
   *  disagrees with the header is judged by `change-history-row-shape`, never repaired or
   *  dropped here. */
  protected changeHistory(ctx: JudgeContext): ParsedTable {
    return ctx.parsed.tables["Change history"];
  }

  /** The version token of a lineage row — the FIRST cell read ANCHORED: the cell must BE the
   *  version, never merely carry one (an in-cell prose mention of `spec v0.4` is not an
   *  identity). */
  protected lineageVersion(row: readonly string[]): string | null {
    const cell = (row[0] ?? "").trim();
    return /^v\d+\.\d+$/.test(cell) ? cell : null;
  }

  /** The change-history rows that ARE lineage rows — the ones whose cell count matches the
   *  table's column header. A row whose cells disagree with the header (a hard-wrapped cell)
   *  is a SHAPE fact — reported by `change-history-row-shape`, never silently read as a
   *  lineage identity. */
  protected lineageRows(ctx: JudgeContext): readonly (readonly string[])[] {
    const table = this.changeHistory(ctx);
    const width = table.headerRow?.length ?? 0;
    if (width === 0) return [];
    return table.rows.filter((row) => row.length === width);
  }

  /** The anchored cell-0 versions of EVERY change-history body row, whatever its width.
   *  Membership is the one read a shape-ragged row must not starve: when the header version
   *  lives only on the newest row and that row hard-wraps, the version is still the
   *  document's own lineage (its shape is a separate defect). */
  protected membershipVersions(ctx: JudgeContext): readonly string[] {
    return this.changeHistory(ctx)
      .rows.map((row) => this.lineageVersion(row))
      .filter((version) => version !== null) as readonly string[];
  }

  /** The numeric comparison rank of a version token — the lineage's newest row is a NUMERIC
   *  read (`v0.10` outranks `v0.9`), never a lexical one. */
  protected versionRank(version: string): number {
    const [major, minor] = version.replace(/^v/, "").split(".");
    return Number(major) * 1_000_000 + Number(minor);
  }

  /** The doc's Change-history row versions, in row order — the ONE lineage identity read
   *  the duplicate and order rules share. */
  protected historyVersions(ctx: JudgeContext): readonly string[] {
    return this.lineageRows(ctx)
      .map((row) => this.lineageVersion(row))
      .filter((version) => version !== null) as readonly string[];
  }

  /** The three-table section heading anchors of the overall (registry-declared). */
  protected overallTableHeadings(ctx: JudgeContext): readonly string[] {
    if (ctx.docKey !== "overall") return [];
    return ctx.registries.overall.elements
      .filter(
        (element) =>
          element.home === "section" &&
          element.anchor.startsWith("## ") &&
          OVERALL_TABLE_NAMES.some((name) => element.anchor.includes(name)),
      )
      .map((element) => element.anchor);
  }

  /** The `[text](target)` targets of one line — the ONE link read of the rule plane (the
   *  chain cells are the only surface that carries links). */
  protected linksOnLine(line: string): readonly ChainLink[] {
    const links: ChainLink[] = [];
    for (const match of line.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
      links.push({ target: match[2] });
    }
    return links;
  }
}

// ---------------------------------------------------------------------------
// the ledger scope
// ---------------------------------------------------------------------------

/**
 * LedgerRuleBase — the two cross-ledger rules' shared seam. Kept separate from `Invariant`
 * on purpose: a ledger rule's entry takes the ledger fact bundle as a SECOND argument, so it
 * can never ride the doc-scope composition (two scopes, two entry shapes).
 */
export abstract class LedgerRuleBase implements LedgerRule {
  abstract readonly name: string;

  /** Run the rule over the doc judgment context + the ledger fact bundle. */
  abstract evaluate(ctx: JudgeContext, ledger: LedgerFacts): FindingDraft[];

  /** The single finding-construction point (one home per scope). */
  protected finding(ctx: JudgeContext, field: string, message: string, fix: string): FindingDraft {
    return { path: ctx.path, field, message, fix, kind: this.name };
  }
}

/** closed-wave-fits-depends-on-layers — an OPEN wave stays inside one DependsOn layer. The
 *  rule reads the ledger's open waves alone: a closed wave is settled history whose layer
 *  fit was judged at its own dispatch, so a later plan edit never retro-flags it — only a
 *  wave still dispatchable can be corrected by the plan itself. The read is a SUBSET one: a
 *  wave whose members all sit in one layer fits even when it does not fill that layer. */
export class LedgerLayeringRule extends LedgerRuleBase {
  readonly name = "closed-wave-fits-depends-on-layers";

  evaluate(ctx: JudgeContext, ledger: LedgerFacts): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const wave of ledger.openWaves) {
      if (wave.length === 0) continue;
      const fits = ledger.layers.some((layer) => wave.every((id) => layer.includes(id)));
      if (fits) continue;
      const layers = ledger.layers.map((layer) => `{${layer.join(",")}}`).join(" ");
      findings.push(
        this.finding(
          ctx,
          "open Waves",
          `the open wave {${wave.join(",")}} spans more than one DependsOn layer (${layers})`,
          "keep a wave on one topological layer — add the missing DependsOn edges so the batch is one layer",
        ),
      );
    }
    return findings;
  }
}

/** planned-tasks-vs-recorded-tasks — the ledger's recorded tasks must still exist in the
 *  plan. ONE direction only: a plan always LEADS the ledger (every undispatched task sits in
 *  the plan), so neither task numbering nor dependency layers can tell "the next wave" from
 *  "a stranded task". The one real disagreement is a recorded task the plan no longer
 *  carries. */
export class LedgerTaskSetRule extends LedgerRuleBase {
  readonly name = "planned-tasks-vs-recorded-tasks";

  evaluate(ctx: JudgeContext, ledger: LedgerFacts): FindingDraft[] {
    const findings: FindingDraft[] = [];
    const planned = new Set(ledger.planTasks);
    for (const id of ledger.recordedTasks) {
      if (planned.has(id)) continue;
      findings.push(
        this.finding(
          ctx,
          "Task id",
          `the ledger records Task ${id}, which the plan no longer carries`,
          "restore the task block or remove the ledger row",
        ),
      );
    }
    return findings;
  }

  /** How many planned tasks the ledger has not recorded yet — the `plan leads ledger` info
   *  count (a prompt, never a finding). */
  static planAhead(ledger: LedgerFacts): number {
    const recorded = new Set(ledger.recordedTasks);
    return ledger.planTasks.filter((id) => !recorded.has(id)).length;
  }
}

// ---------------------------------------------------------------------------
// presence — the required surface registers exactly once
// ---------------------------------------------------------------------------

/** presence — every required structural element of the declared registry must occur, and a
 *  heading-style anchor must register once. */
export class PresenceInvariant extends Invariant {
  readonly name = "presence";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const element of this.elementsOf(ctx)) {
      if (element.presence !== "required") continue;
      if (!PRESENCE_HOMES.has(element.home)) continue;
      // The task-block sections are judged PER BLOCK below (`taskFieldPresence`), so a
      // legacy-shape plan (whose fields carry no `#### Key` line) is never reported as a
      // whole-document absence.
      if (element.home === "task-field" && element.anchor.startsWith("#### ")) continue;
      const slice = this.sliceOf(ctx, element.anchor);
      if (slice === undefined) continue;
      if (this.#derivedPresenceHolds(ctx, element, slice)) continue;
      // The front-matter-home elements judge the typed head record — NEVER the body line
      // scan: front matter is data, and a body-line mention of a key is not an occurrence.
      if (slice.home === "frontmatter") {
        if (ctx.head.value(element.anchor) !== null) continue;
        findings.push(
          this.finding(
            ctx,
            element.anchor,
            `missing required element: ${element.anchor}`,
            `add the "${element.anchor}" key to the document's front matter`,
          ),
        );
        continue;
      }
      if (this.occurrenceNodes(ctx, element.anchor).length === 0) {
        findings.push(
          this.finding(
            ctx,
            element.anchor,
            `missing required element: ${element.anchor}`,
            `add the "${element.anchor}" ${element.home} element to the document`,
          ),
        );
      }
    }
    findings.push(...this.#taskFieldPresence(ctx));
    // The registration-uniqueness leg folded into presence (one rule = one strategy): a
    // required element that registers MORE than once is the duplicate side of the same
    // "registers exactly once" judgment the missing side above reports.
    findings.push(...this.#headingUniqueness(ctx));
    return findings;
  }

  /** Heading-style anchors: a duplicated heading line text is a duplicate registration. */
  #headingUniqueness(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    const seenLine = new Set<string>();
    for (const element of this.elementsOf(ctx)) {
      if (!element.anchor.startsWith("#")) continue;
      // A task-block section heading repeats once per task block by design — its `#### Key`
      // identity is judged per block, never as a whole-document duplicate.
      if (element.home === "task-field") continue;
      const slice = this.sliceOf(ctx, element.anchor);
      if (slice === undefined) continue;
      for (const line of this.occurrenceTexts(ctx, element.anchor)) {
        const trimmed = line.trim();
        const key = `${element.anchor}::${trimmed}`;
        if (seenLine.has(key)) {
          findings.push(
            this.finding(
              ctx,
              element.anchor,
              `duplicate heading registration: ${trimmed}`,
              `keep "${trimmed}" in exactly one place`,
            ),
          );
        }
        seenLine.add(key);
      }
    }
    return findings;
  }

  /** A required surface whose occurrence is established by the parsed structure rather than
   *  a token scan — the plan's `Task id token` only ever appears inside the `### Task N:`
   *  headings, so it is present iff a task block exists; a token inside a required field
   *  (`File path token`) is present iff its owning field carries a value line. */
  #derivedPresenceHolds(ctx: JudgeContext, element: RegistryElement, slice: ElementSlice): boolean {
    if (slice.home === "task-block" && !slice.anchor.startsWith("#")) {
      return this.tasks(ctx).length > 0;
    }
    if (slice.home === "task-field" && !slice.anchor.startsWith("#### ")) {
      const parent = element.selector.from;
      if (parent === "root") return false;
      return ctx.selector
        .occurrences(parent)
        .some((field) => field.lines.some((line) => line.trim() !== ""));
    }
    return false;
  }

  /** The per-task-block required field keys — derived from the plan registry's task-field
   *  section elements (the `#### Key` headings). The reader normalizes the legacy bullet
   *  shape into the same keys, so one declaration enforces both shapes per block. */
  #requiredFieldKeys(ctx: JudgeContext): readonly string[] {
    return this.elementsOf(ctx)
      .filter((element) => element.home === "task-field" && element.anchor.startsWith("#### "))
      .map((element) => element.anchor.slice("#### ".length));
  }

  /** The per-task-block field surface — every required task-field key of a plan. */
  #taskFieldPresence(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const findings: FindingDraft[] = [];
    for (const block of this.tasks(ctx)) {
      const keys = new Set(block.sections.map((section) => section.key));
      for (const key of this.#requiredFieldKeys(ctx)) {
        if (keys.has(key)) continue;
        findings.push(
          this.finding(
            ctx,
            `**${key}**`,
            `task ${block.id} carries no **${key}** field`,
            `add the - **${key}**: line to ### Task ${block.id}:`,
          ),
        );
      }
    }
    return findings;
  }
}

// ---------------------------------------------------------------------------
// the change-history family
// ---------------------------------------------------------------------------

/** change-history-version-unique — a change-history version label registers once. */
export class ChangeHistoryVersionUniqueInvariant extends Invariant {
  readonly name = "change-history-version-unique";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    const seenVersions = new Set<string>();
    for (const version of this.historyVersions(ctx)) {
      if (seenVersions.has(version)) {
        findings.push(
          this.finding(
            ctx,
            "Change history",
            `duplicate change-history version: ${version} registers more than once`,
            "keep each lineage version in exactly one Change-history row",
          ),
        );
      }
      seenVersions.add(version);
    }
    return findings;
  }
}

/** change-history-row-shape — a Change-history body row whose cell count disagrees with the
 *  table's column header is a rendering defect (a hard-wrapped cell parsed as its own row).
 *  The row is REPORTED, never silently dropped from the lineage read. */
export class ChangeHistoryRowShapeInvariant extends Invariant {
  readonly name = "change-history-row-shape";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const table = this.changeHistory(ctx);
    const width = table.headerRow?.length ?? 0;
    if (width === 0) return [];
    const findings: FindingDraft[] = [];
    for (const row of table.rows) {
      if (row.length === width) continue;
      findings.push(
        this.finding(
          ctx,
          "Change history",
          `a Change-history row carries ${row.length} cells against the ${width}-column header`,
          "keep the row on one line — a hard-wrapped cell parses as a row of its own",
        ),
      );
    }
    return findings;
  }
}

/** The DECLARED `## Change history` column set — the header must equal it cell for cell
 *  (after `trim`). The row-shape leg judges a row against whatever the header declares; this
 *  declaration is what makes the header itself a judged fact. */
export const CHANGE_HISTORY_COLUMNS = ["Version", "date", "summary", "author"] as const;

/** change-history-header-columns — the `## Change history` header must BE the declared column
 *  set: a grown, dropped or renamed column silently redefines what every row means, so it is
 *  reported once, independently of the row widths. */
export class ChangeHistoryHeaderColumnsInvariant extends Invariant {
  readonly name = "change-history-header-columns";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const header = this.changeHistory(ctx).headerRow;
    if (header === null || header.length === 0) return [];
    const cells = header.map((cell) => cell.trim());
    const declared = CHANGE_HISTORY_COLUMNS;
    const conforms =
      cells.length === declared.length && cells.every((cell, index) => cell === declared[index]);
    if (conforms) return [];
    return [
      this.finding(
        ctx,
        "Change history",
        `the Change-history header reads "${cells.join(" | ")}" against the declared "${declared.join(" | ")}"`,
        `write the header as | ${declared.join(" | ")} | — the column set is declared, not free-form`,
      ),
    ];
  }
}

/** change-history-latest-matches-front-matter — the front-matter `version:` IS the lineage's
 *  newest numeric version: appending a row lifts both in the same edit, so the two sides can
 *  never disagree. */
export class ChangeHistoryLatestMatchesFrontMatterInvariant extends Invariant {
  readonly name = "change-history-latest-matches-front-matter";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const headerVersion = ctx.head.version;
    if (headerVersion === null) return [];
    const versions = this.historyVersions(ctx);
    if (versions.length === 0) return [];
    const latest = versions.reduce((newest, version) =>
      this.versionRank(version) > this.versionRank(newest) ? version : newest,
    );
    if (latest === headerVersion) return [];
    return [
      this.finding(
        ctx,
        "version",
        `the header version ${headerVersion} is not the newest lineage version ${latest}`,
        `align the two in one edit — bump the version front-matter key to ${latest}, or add the row that reaches ${headerVersion}`,
      ),
    ];
  }
}

/** front-matter-version-in-lineage — the head `version:` appears in the doc's lineage. The
 *  ONE lineage judgment: the header value must occur somewhere among the Change-history row
 *  versions. Absence is the only violation — the direction, the endpoints and the age of the
 *  row carrying the value are the author's presentation choice, never a judgment input. */
export class FrontMatterVersionInLineageInvariant extends Invariant {
  readonly name = "front-matter-version-in-lineage";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const headerVersion = ctx.head.version;
    if (headerVersion === null) return [];
    const membership = this.membershipVersions(ctx);
    if (membership.length === 0) return [];
    if (membership.includes(headerVersion)) return [];
    return [
      this.finding(
        ctx,
        "version",
        `the header version ${headerVersion} is outside the document's own lineage`,
        `the version front-matter key must belong to the Change-history row versions: ${membership.join(", ")}`,
      ),
    ];
  }
}

/** change-history-row-not-in-other-table — a change-history row stays in its table. Any
 *  table row OUTSIDE `## Change history` whose first cell carries a version token (`v1.2`) is
 *  a lineage row parked in the wrong table. */
export class RowHomeInvariant extends Invariant {
  readonly name = "change-history-row-not-in-other-table";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    const own = this.sliceOf(ctx, "## Change history");
    for (const section of ctx.parsed.sections) {
      if (own?.valuePattern?.test(section.heading) === true) continue;
      const table = ctx.selector.tableUnder(section.heading);
      const rows = [
        ...(table?.header === null || table === null ? [] : [table.header]),
        ...(table?.body ?? []),
      ];
      for (const row of rows) {
        const first = row[0] ?? "";
        if (!/^v\d+\.\d+$/.test(first)) continue;
        findings.push(
          this.finding(
            ctx,
            section.heading,
            `a change-history row sits in ${section.heading}: ${first}`,
            "move the row back into the ## Change history table",
          ),
        );
      }
    }
    return findings;
  }
}

/** change-history-newest-last — the Change-history version sequence is MONOTONIC. The id is
 *  HISTORICAL: it names the retired "the newest row is last" assertion this row succeeds;
 *  what it judges is monotonicity, and DIRECTION never enters the judgment — the corpus
 *  writes both orders, and each table's own direction is legal. */
export class ChangeHistoryNewestLastInvariant extends Invariant {
  readonly name = "change-history-newest-last";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const versions = this.historyVersions(ctx);
    const findings: FindingDraft[] = [];
    let direction = 0;
    for (let index = 1; index < versions.length; index += 1) {
      const left = versions[index - 1] ?? "";
      const right = versions[index] ?? "";
      const step = Math.sign(this.versionRank(right) - this.versionRank(left));
      if (step === 0) continue;
      if (direction === 0) {
        direction = step;
        continue;
      }
      if (step === direction) continue;
      findings.push(
        this.finding(
          ctx,
          "Change history",
          `the Change-history version ${right} reverses the table's direction after ${left} — the version sequence is monotonic`,
          "move the row so the table reads in one direction (ascending or descending), or correct its version",
        ),
      );
    }
    return findings;
  }
}

/** change-history-date-shape — the Change-history date cell is an ISO date. The registry's
 *  `Change history date` element declares the pattern, and its location matches on that same
 *  pattern — so a violation never reaches the location and `domain` can never report it.
 *  This rule judges the cell directly, and the element's `valuePattern` stays the ONE source
 *  of the value shape. */
export class ChangeHistoryDateShapeInvariant extends Invariant {
  readonly name = "change-history-date-shape";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const pattern = this.elementOf(ctx, "Change history date")?.valuePattern;
    if (pattern === undefined) return [];
    const iso = new RegExp(pattern);
    const findings: FindingDraft[] = [];
    for (const row of this.changeHistory(ctx).rows) {
      const cell = (row[1] ?? "").trim();
      if (iso.test(cell)) continue;
      findings.push(
        this.finding(
          ctx,
          "Change history",
          `the Change history date cell is not an ISO date: ${cell === "" ? "(empty)" : cell}`,
          "write the date cell as an ISO date (YYYY-MM-DD) — the Change history date element's declared valuePattern",
        ),
      );
    }
    return findings;
  }
}

// ---------------------------------------------------------------------------
// the identity legs
// ---------------------------------------------------------------------------

/** task-id-unique — every `### Task N:` id registers exactly once (plan). */
export class TaskIdUniqueInvariant extends Invariant {
  readonly name = "task-id-unique";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const findings: FindingDraft[] = [];
    const seenIds = new Set<number>();
    for (const block of this.tasks(ctx)) {
      if (seenIds.has(block.id)) {
        findings.push(
          this.finding(
            ctx,
            "### Task N:",
            `duplicate task id: Task ${block.id} registers more than once`,
            "keep each task id in exactly one task block",
          ),
        );
      }
      seenIds.add(block.id);
    }
    return findings;
  }
}

/** phase-id-unique — every Phase-inventory phase id registers exactly once (overall). */
export class PhaseIdUniqueInvariant extends Invariant {
  readonly name = "phase-id-unique";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const data = this.record(ctx, "overall");
    if (data === null) return [];
    const findings: FindingDraft[] = [];
    const seenPhases = new Set<string>();
    for (const phase of data.chain.phases) {
      const lower = phase.id.toLowerCase();
      if (seenPhases.has(lower)) {
        findings.push(
          this.finding(
            ctx,
            "Phase inventory",
            `duplicate phase registration: ${phase.id} registers more than once`,
            "keep each phase id in exactly one Phase-inventory row",
          ),
        );
      }
      seenPhases.add(lower);
    }
    return findings;
  }
}

// ---------------------------------------------------------------------------
// domain — every value an anchor carries conforms to its declared shape
// ---------------------------------------------------------------------------

/** domain — every value an anchor literal carries must conform to its declared shape. */
export class DomainInvariant extends Invariant {
  readonly name = "domain";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const element of this.elementsOf(ctx)) {
      const slice = this.sliceOf(ctx, element.anchor);
      if (slice === undefined) continue;
      // The front-matter-home elements judge the typed head SCALAR (the registered value
      // patterns are scalar shapes). Absence is presence's surface; a present scalar outside
      // the declared shape is the finding. The pattern is read from the REGISTRY ELEMENT:
      // the projection deliberately stops both slice RegExp compilations for front matter.
      if (slice.home === "frontmatter") {
        const value = ctx.head.value(element.anchor);
        if (value === null) continue;
        // The skeleton's own placeholders (`:::fill <slot>` / `<…>`) are holder states, not
        // values — the strict scalar shapes judge a CONCRETE value. The exemption is SCOPED
        // to the keys the skeleton actually fills, so a hand-written placeholder on a truth
        // key (a fixed version / date / status literal) stays a finding.
        if (DomainInvariant.#skeletonFills(ctx, element.anchor) && this.isPlaceholder(value)) {
          continue;
        }
        const rawPattern = element.valuePattern;
        if (rawPattern === undefined) continue;
        if (!new RegExp(rawPattern).test(value)) {
          findings.push(
            this.finding(
              ctx,
              element.anchor,
              `value outside the declared domain: ${value}`,
              `make the front-matter ${element.anchor} value match ${rawPattern}`,
            ),
          );
        }
        continue;
      }
      if (slice.valuePattern === undefined) continue;
      // The element is judged by the SHAPE of the lines that carry it structurally — a table
      // row or a heading must match its declared pattern. A prose citation (a backticked
      // code-span mention) is not a carrier and is never judged as a value.
      for (const node of this.carrierNodes(ctx, element.anchor)) {
        if (slice.valuePattern.test(node.text)) continue;
        // The declared value may sit in a captured sub-span of the located node — the task id
        // inside its `### Task N:` heading. The node is the locator, the capture is the value
        // the declared shape judges.
        if (DomainInvariant.#capturesShape(element.selector.match, node.text, slice.valuePattern)) {
          continue;
        }
        findings.push(
          this.finding(
            ctx,
            element.anchor,
            `value outside the declared domain: ${node.text.trim()}`,
            `make the node match ${slice.valuePattern.source}`,
          ),
        );
      }
    }
    return findings;
  }

  /** Whether the element's locator capture the declared shape accepts — a value that lives
   *  inside the located node (the task id in its heading). */
  static #capturesShape(
    match: string | RegExp | undefined,
    text: string,
    pattern: RegExp,
  ): boolean {
    if (!(match instanceof RegExp)) return false;
    const capture = match.exec(text);
    if (capture === null || capture.length < 2) return false;
    const value = capture[1];
    return value !== undefined && pattern.test(value);
  }

  /** Whether the skeleton fills the front-matter anchor with a placeholder — the
   *  projection's own slot classification (the link slots' `<…>` scalar and the content
   *  slots' `:::fill`), so the exemption covers exactly the keys that can legally carry a
   *  holder form. */
  static #skeletonFills(ctx: JudgeContext, anchor: string): boolean {
    const slot = ctx.skeleton.frontmatter.find((entry) => entry.anchor === anchor);
    if (slot === undefined) return false;
    return slot.slot === "link" || slot.slot === "content";
  }
}

// ---------------------------------------------------------------------------
// crosslink — in-document reference resolution
// ---------------------------------------------------------------------------

/** crosslink — in-document reference resolution against the doc's own identity sets. */
export class CrosslinkInvariant extends Invariant {
  readonly name = "crosslink";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey === "overall") return this.#overallCrosslinks(ctx);
    if (ctx.docKey === "plan") return this.#planCrosslinks(ctx);
    return [];
  }

  /** The overall's in-doc reference surfaces: issue rows + graph edges + dependency cells. */
  #overallCrosslinks(ctx: JudgeContext): FindingDraft[] {
    const data = this.record(ctx, "overall");
    if (data === null) return [];
    const findings: FindingDraft[] = [];
    const ids = new Set(data.chain.phases.map((phase) => phase.id.toLowerCase()));
    for (const row of data.tables["Issue inventory"].rows) {
      const phaseCell = row[0]?.trim() ?? "";
      if (phaseCell !== "" && !ids.has(phaseCell.toLowerCase())) {
        findings.push(
          this.finding(
            ctx,
            "Issue inventory",
            `issue row phase ${JSON.stringify(phaseCell)} is not a Phase-inventory id`,
            "set the Issue-inventory Phase column to a registered phase id",
          ),
        );
      }
    }
    // Graph edges: every from/to token must be a registered phase id (the tree's edge read —
    // the graph surface's ONE parse).
    for (const edge of ctx.selector.edges()) {
      if (!ids.has(edge.from.toLowerCase())) {
        findings.push(
          this.finding(
            ctx,
            "Dependency graph",
            `graph edge from ${edge.from} is not a Phase-inventory id`,
            `register ${edge.from} in the Phase inventory or fix the edge`,
          ),
        );
      }
      if (!ids.has(edge.to.toLowerCase())) {
        findings.push(
          this.finding(
            ctx,
            "Dependency graph",
            `graph edge to ${edge.to} is not a Phase-inventory id`,
            `register ${edge.to} in the Phase inventory or fix the edge`,
          ),
        );
      }
    }
    // Phase-row dependency cells: every P-token must be a registered phase id.
    for (const phase of data.chain.phases) {
      for (const token of CrosslinkInvariant.#phaseTokens(phase.dependencyCell)) {
        if (!ids.has(token.toLowerCase())) {
          findings.push(
            this.finding(
              ctx,
              "Phase inventory",
              `dependency of ${phase.id} references unregistered phase ${token}`,
              `register ${token} in the Phase inventory or fix the dependency cell`,
            ),
          );
        }
      }
    }
    return findings;
  }

  /** The plan's in-doc reference surfaces: the DependsOn ids — the single structural
   *  reference gate. Prose task mentions are NOT consumed here: the WARN-only observation
   *  belongs to the reference lint, never a hard finding. */
  #planCrosslinks(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const findings: FindingDraft[] = [];
    const blocks = this.tasks(ctx);
    const ids = new Set(blocks.map((block) => block.id));
    for (const block of blocks) {
      for (const id of CrosslinkInvariant.#dependsOnOf(block)) {
        if (ids.has(id)) continue;
        findings.push(
          this.finding(
            ctx,
            `Task ${block.id}`,
            `task ${block.id} depends on unregistered task ${id}`,
            "set DependsOn to a task id present in the plan (or `none`)",
          ),
        );
      }
    }
    return findings;
  }

  /** The numeric DependsOn values of a task block — a read of the section's lines, not the
   *  grammar's edge normalization: this rule reports every number the author wrote there. */
  static #dependsOnOf(block: TaskBlock): readonly number[] {
    const ids: number[] = [];
    const section = block.sections.find((entry) => entry.key === "DependsOn");
    if (section === undefined) return ids;
    for (const value of section.lines) {
      for (const match of value.matchAll(/\b([1-9]\d*)\b/g)) ids.push(Number(match[1]));
    }
    return ids;
  }

  /** The `P<n>` tokens of a comment struct (dependency cells). */
  static #phaseTokens(text: string): readonly string[] {
    const tokens: string[] = [];
    for (const match of text.matchAll(/P(\d+(?:\.\d+)*)/g)) tokens.push(`P${match[1]}`);
    return tokens;
  }
}

// ---------------------------------------------------------------------------
// section order · continuity · residue · hollow
// ---------------------------------------------------------------------------

/** section-order — rank-2 headings follow the declared registry sequence. */
export class SectionOrderInvariant extends Invariant {
  readonly name = "section-order";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    const anchors = this.elementsOf(ctx)
      .filter((element) => element.anchor.startsWith("## "))
      .map((element) => element.anchor);
    let previous = -1;
    for (const section of ctx.parsed.sections) {
      const match = this.#registryAnchorFor(section, anchors, ctx);
      if (match === null) continue;
      if (match.index < previous) {
        findings.push(
          this.finding(
            ctx,
            section.heading,
            `${section.heading} appears out of the declared section order`,
            `move the section to its registry position (${match.index + 1} of the declared sequence)`,
          ),
        );
      }
      previous = Math.max(previous, match.index);
    }
    return findings;
  }

  /** The registry anchor a doc section heading conforms to (null when unregistered). */
  #registryAnchorFor(
    section: SectionBlock,
    anchors: readonly string[],
    ctx: JudgeContext,
  ): { anchor: string; index: number } | null {
    for (let index = 0; index < anchors.length; index += 1) {
      const anchor = anchors[index] ?? "";
      const slice = this.sliceOf(ctx, anchor);
      if (slice?.valuePattern?.test(section.heading) === true) return { anchor, index };
      if (slice === undefined && section.heading.startsWith(anchor)) return { anchor, index };
    }
    return null;
  }
}

/** continuity — numbered surfaces are 1-indexed and contiguous. */
export class ContinuityInvariant extends Invariant {
  readonly name = "continuity";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey === "plan") return this.#taskContinuity(ctx);
    if (ctx.docKey === "phase-spec") return this.#groupContinuity(ctx);
    return [];
  }

  /** Plan task ids must be exactly 1..N. */
  #taskContinuity(ctx: JudgeContext): FindingDraft[] {
    const blocks = this.tasks(ctx);
    if (blocks.length === 0) return [];
    const findings: FindingDraft[] = [];
    blocks.forEach((block, index) => {
      const expected = index + 1;
      if (block.id === expected) return;
      findings.push(
        this.finding(
          ctx,
          `Task ${block.id}`,
          `task numbering is not contiguous from 1 (task ${block.id} at position ${index + 1})`,
          "renumber the tasks so they run exactly 1..N without gaps or duplicates",
        ),
      );
    });
    return findings;
  }

  /** Phase-spec design groups (and their items) must be 1-indexed and contiguous. */
  #groupContinuity(ctx: JudgeContext): FindingDraft[] {
    const data = this.record(ctx, "phase-spec");
    if (data === null || data.design.length === 0) return [];
    const findings: FindingDraft[] = [];
    data.design.forEach((group, index) => {
      if (Number(group.number) !== index + 1) {
        findings.push(
          this.finding(
            ctx,
            "### N. group heading",
            `design group numbering is not contiguous from 1 (group ${group.number} at position ${index + 1})`,
            "renumber the design groups so they run exactly 1..N",
          ),
        );
      }
      this.#itemContinuity(ctx, group, group.number, findings);
    });
    return findings;
  }

  #itemContinuity(
    ctx: JudgeContext,
    group: DesignGroup,
    groupNumber: string,
    findings: FindingDraft[],
  ): void {
    group.items.forEach((item, index) => {
      if (item.number === `${groupNumber}.${index + 1}`) return;
      findings.push(
        this.finding(
          ctx,
          "#### N.M item heading",
          `design item numbering drifts within group ${groupNumber} (item ${item.number} at position ${index + 1})`,
          "renumber the items within each group so they run N.1..N.M",
        ),
      );
    });
  }
}

/** residue — conditional content leaves zero residue when its condition does not hold. */
export class ResidueInvariant extends Invariant {
  readonly name = "residue";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    let owner: string | null = null;
    for (const element of this.elementsOf(ctx)) {
      if (element.home === "conditional" && element.anchor.startsWith("## ")) {
        owner = element.anchor;
        continue;
      }
      if (element.home !== "conditional" || owner === null) continue;
      const slice = this.sliceOf(ctx, element.anchor);
      if (slice === undefined || slice.valuePattern === undefined) continue;
      if (this.occurrenceNodes(ctx, owner).length > 0) continue; // the condition holds
      if (this.occurrenceNodes(ctx, element.anchor).length === 0) continue;
      findings.push(
        this.finding(
          ctx,
          element.anchor,
          `conditional residue: ${element.anchor} content appears while ${owner} is absent`,
          `remove the ${element.anchor} content or add the ${owner} section`,
        ),
      );
    }
    return findings;
  }
}

/** hollow — a structural surface that is present but carries no content. */
export class HollowInvariant extends Invariant {
  readonly name = "hollow";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    return [...this.#tableHollow(ctx), ...this.#taskHollow(ctx), ...this.#designHollow(ctx)];
  }

  /** The overall's three tables: a present table section with zero data rows is hollow. */
  #tableHollow(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "overall") return [];
    const findings: FindingDraft[] = [];
    for (const anchor of this.overallTableHeadings(ctx)) {
      const [section] = this.occurrenceNodes(ctx, anchor);
      if (section === undefined) continue;
      const table = ctx.selector.tableUnder(section.text);
      if ((table?.body.length ?? 0) > 0) continue;
      findings.push(
        this.finding(
          ctx,
          anchor,
          `${anchor} section is hollow — the section heading carries no data rows`,
          "either add the table's data rows or remove the empty section",
        ),
      );
    }
    return findings;
  }

  /** A task block that carries no keyed sections is a hollow shell. */
  #taskHollow(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const findings: FindingDraft[] = [];
    for (const block of this.tasks(ctx)) {
      if (block.sections.length > 0) continue;
      findings.push(
        this.finding(
          ctx,
          `Task ${block.id}`,
          `task ${block.id} is a hollow shell — the block carries no fields`,
          "fill the task block with its Objective/Files/Consumes/Produces/Steps/Acceptance/DependsOn fields or delete it",
        ),
      );
    }
    return findings;
  }

  /** The phase-spec skeleton: a present Design with no groups, or an empty conditional
   *  section. */
  #designHollow(ctx: JudgeContext): FindingDraft[] {
    const data = this.record(ctx, "phase-spec");
    if (data === null) return [];
    const findings: FindingDraft[] = [];
    const designSlice = this.sliceOf(ctx, "## Design");
    if (
      designSlice !== undefined &&
      this.occurrenceNodes(ctx, "## Design").length > 0 &&
      data.design.length === 0
    ) {
      findings.push(
        this.finding(
          ctx,
          "## Design",
          "the Design section is hollow — the heading carries no design groups",
          "add the double-layer design outline (### N. groups with #### N.M items) or remove the section",
        ),
      );
    }
    for (const section of data.sections) {
      if (section.heading.trim().length === 0) continue;
      const bodyCount = section.lines.filter((line) => line.trim().length > 0).length;
      if (bodyCount > 0) continue;
      findings.push(
        this.finding(
          ctx,
          section.heading,
          `${section.heading} section is hollow — the heading carries no content`,
          "add the section's content or remove the empty section",
        ),
      );
    }
    return findings;
  }
}

/** list-marker-not-doubled — a list item carries exactly one leading marker. A bullet whose
 *  content starts with another bullet marker (`- - x`, `* + y`) is a doubled marker, not
 *  nested content. The read is the tree's `listItem` walk: an item whose first child is
 *  itself a list. A thematic break parses as a separator, so the tree exempts it by
 *  construction. */
export class ListMarkerInvariant extends Invariant {
  readonly name = "list-marker-not-doubled";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    return ctx.selector
      .doubledMarkerItems()
      .map((node) =>
        this.finding(
          ctx,
          "list-marker",
          `the list item carries a doubled marker: ${node.text}`,
          "merge the doubled list marker into a single marker",
        ),
      );
  }
}

// ---------------------------------------------------------------------------
// the context-seam strategies
// ---------------------------------------------------------------------------

/** The chain-link target shape contract (D2, shape judged at the boundary): a link target
 *  must be a BARE relative path (the repo-root form `docs/kairos/overalls/…-overall.md` or a
 *  doc-relative file name) — never a markdown-link shell (`[label](path)`), a URL or a
 *  collation token (whitespace / parens / angle brackets). The ONE expression of the shape
 *  rule: `of()` yields either the accepted (trimmed) target or the reason the shape is
 *  invalid; the chain strategies judge the shape BEFORE any resolution, so a malformed fill
 *  reports the shape rule once and the confusing resolution cascade never fires. */
export class LinkTargetShape {
  /** The accepted, trimmed target — null when the shape is invalid. */
  readonly target: string | null;
  /** The shape-rule reason the target is invalid — null when accepted. */
  readonly reason: string | null;

  private constructor(target: string | null, reason: string | null) {
    this.target = target;
    this.reason = reason;
  }

  /** Judge one raw target — a bare relative path accepts; any collation token rejects with
   *  the shape rule. */
  static of(raw: string): LinkTargetShape {
    const trimmed = raw.trim();
    // The rejected collation tokens — whitespace, a markdown-link shell's brackets / parens
    // (`[label](path)`), stray angle brackets and the `://` URL scheme. The path separators
    // `/` and `:` alone stay legal (a bare relative path carries both) — only the URL-scheme
    // pairing rejects.
    if (/[\s()[\]<>]|:\/\//.test(trimmed)) {
      return new LinkTargetShape(
        null,
        "the value must be a bare relative path (e.g. `docs/kairos/overalls/…-overall.md` or `xxx-overall.md`), not a markdown link or URL",
      );
    }
    return new LinkTargetShape(trimmed, null);
  }
}

/** file-existence — every chain link target of the doc resolves to an existing file. */
export class FileExistenceInvariant extends Invariant {
  readonly name: string = "file-existence";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const { source, link } of this.chainLinks(ctx)) {
      if (this.isPlaceholder(link.target)) continue;
      const shape = LinkTargetShape.of(link.target);
      // D2: a malformed target is the link-shape face's call — the resolution faces never
      // feed it to the path resolution as a literal.
      if (shape.target === null) continue;
      const resolved = FileExistenceInvariant.targetPath(ctx.path, shape.target, (rel) =>
        ctx.world.exists(rel),
      );
      if (resolved !== null && ctx.world.exists(resolved)) continue;
      findings.push(
        this.finding(
          ctx,
          source,
          `the chain link target does not resolve to an existing file: ${shape.target}`,
          `fix the link target (repo-root form ${docNamespaceOf(ctx.world.roots())}/... or a file-relative path)`,
        ),
      );
    }
    return findings;
  }

  /** The chain links of the judged doc type — the overall's Phase-inventory cells. The
   *  doc-level chain keys (`program:` and the retired path keys) never appear here: a slug
   *  reference is not a path. */
  protected chainLinks(ctx: JudgeContext): readonly { source: string; link: ChainLink }[] {
    const links: { source: string; link: ChainLink }[] = [];
    const data = this.record(ctx, "overall");
    if (data === null) return links;
    for (const phase of data.chain.phases) {
      for (const link of this.linksOnLine(phase.designCell)) {
        links.push({ source: `Phase inventory · ${phase.id}`, link });
      }
      for (const link of this.linksOnLine(phase.planCell)) {
        links.push({ source: `Phase inventory · ${phase.id}`, link });
      }
    }
    return links;
  }

  /** The ONE chain-link target-resolution chain over repo coordinates: the repo-root reading
   *  when it exists, else the doc-dir (file-relative) reading. `exists` is the caller's world
   *  probe — the resolution is the shared fact, the read is injected. When neither reading
   *  exists the doc-dir path is answered (the caller owns the truly-missing case). An
   *  absolute target names no repository coordinate and answers null: the shape face owns
   *  that spelling. */
  static targetPath(
    docPath: RepoPath,
    target: string,
    exists: (rel: RepoPath) => boolean,
  ): RepoPath | null {
    if (path.posix.isAbsolute(target)) return null;
    const fromRoot = PathShape.relOf(target);
    if (exists(fromRoot)) return fromRoot;
    return PathShape.relOf(path.posix.join(path.posix.dirname(docPath), target));
  }
}

/** link-shape — every chain link target of the doc is a bare relative path (D2). The shape
 *  rule reports ONCE here (single-responsibility strategy — the shared `LinkTargetShape`
 *  declaration): a malformed fill is judged BEFORE any resolution, so the file-existence /
 *  sibling-scan faces silently skip malformed targets. */
export class LinkShapeInvariant extends FileExistenceInvariant {
  readonly name = "link-shape";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const { source, link } of this.chainLinks(ctx)) {
      if (this.isPlaceholder(link.target)) continue;
      const shape = LinkTargetShape.of(link.target);
      if (shape.target !== null) continue;
      findings.push(
        this.finding(
          ctx,
          source,
          `the chain link target is not a bare relative path: ${link.target}`,
          shape.reason ?? "",
        ),
      );
    }
    return findings;
  }
}

/** sibling-scan — every cross-linked doc must be a same-family sibling of this doc. */
export class SiblingScanInvariant extends FileExistenceInvariant {
  readonly name = "sibling-scan";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    const baseline = new Set<string>();
    for (const root of SiblingScanInvariant.#scanRoots(ctx)) {
      for (const entry of ctx.world.list(root)) {
        if (entry.endsWith(".md")) baseline.add(entry);
      }
    }
    for (const { source, link } of this.chainLinks(ctx)) {
      if (this.isPlaceholder(link.target)) continue;
      const shape = LinkTargetShape.of(link.target);
      // D2: a malformed target is the link-shape face's call — the sibling face never
      // basenames a markdown shell.
      if (shape.target === null) continue;
      const basename = path.posix.basename(shape.target);
      if (baseline.has(basename)) continue;
      findings.push(
        this.finding(
          ctx,
          source,
          `the cross-linked doc ${basename} is not a same-family sibling (not present in the sibling docs scan)`,
          `link to a sibling doc under the same ${docRootNamesOf(ctx.world.roots())} family`,
        ),
      );
    }
    return findings;
  }

  /** The doc's own dir + the three declared doc-root dirs — the same-family scan roots, all
   *  already repo-relative coordinates (the world resolved them once). */
  static #scanRoots(ctx: JudgeContext): readonly RepoPath[] {
    const roots = ctx.world.roots();
    return [
      PathShape.relOf(path.posix.dirname(ctx.path)),
      roots.overalls,
      roots.specs,
      roots.plans,
    ];
  }
}

/** phase-design-spec-is-phase-spec — a Phase-inventory row's Design-spec cell must point at a
 *  document declaring `doc-type: phase-spec`. A phase row registered in a program's ledger
 *  cannot borrow a bespoke `single-spec` as its design: either the design belongs to the
 *  program (and is therefore a phase-spec) or the row must leave the inventory. Present facts
 *  only: a cell with no single bare link target, a placeholder, or a target the world cannot
 *  read is NOT judged — a missing file is `file-existence`'s call. */
export class PhaseDesignSpecIsPhaseSpecInvariant extends Invariant {
  readonly name = "phase-design-spec-is-phase-spec";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "overall") return [];
    const data = this.record(ctx, "overall");
    if (data === null) return [];
    const findings: FindingDraft[] = [];
    for (const phase of data.chain.phases) {
      const docType = this.#targetDocType(ctx, phase.designCell);
      // `undefined` = not judged (no judgeable target); `null` = the target declares no
      // doc-type, which is red — the cell must point at a phase-spec.
      if (docType === undefined || docType === "phase-spec") continue;
      findings.push(
        this.finding(
          ctx,
          `Phase inventory · ${phase.id}`,
          PhaseDesignSpecIsPhaseSpecInvariant.#messageOf(phase.id, docType),
          "either register this design as a phase document (doc-type: phase-spec, with program: and parent-version: naming this program) or drop the row from the Phase inventory",
        ),
      );
    }
    return findings;
  }

  /** The one-line message — the row, and the doc-type the target actually declares. A target
   *  declaring no doc-type reads as that absence, never as an empty value. */
  static #messageOf(phaseId: string, docType: string | null): string {
    const declared = docType === null ? "declares no doc-type" : `declares doc-type: ${docType}`;
    return `the Phase inventory row ${phaseId} points its Design spec at a document that ${declared} — a registered phase's design spec must be a phase-spec`;
  }

  /** The `doc-type:` the cell's single link target declares — `undefined` when the cell
   *  carries no judgeable target (no single link, a placeholder, a malformed target shape, or
   *  an unreadable document), null when the readable target declares no doc-type. */
  #targetDocType(ctx: JudgeContext, cell: string): string | null | undefined {
    const links = this.linksOnLine(cell);
    if (links.length !== 1) return undefined;
    const link = links[0];
    if (link === undefined) return undefined;
    const shape = LinkTargetShape.of(link.target);
    if (shape.target === null || this.isPlaceholder(shape.target)) return undefined;
    const resolved = FileExistenceInvariant.targetPath(ctx.path, shape.target, (rel) =>
      ctx.world.exists(rel),
    );
    if (resolved === null) return undefined;
    const content = ctx.world.read(resolved);
    if (content === null) return undefined;
    return frontmatterOf(content).head.docType;
  }
}

/** slug-ref — a `slug-ref` value names an on-disk identity document by `slug:`. The value is
 *  a SLUG, never a path, so this face judges it by identity lookup alone (zero path
 *  resolution, zero filename derivation); the skeleton's placeholder forms ride the shared
 *  `isPlaceholder` exemption so a freshly rendered document is never blocked by the hard gate
 *  its own skeleton emitted. */
export class SlugRefInvariant extends Invariant {
  readonly name = "slug-ref";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const element of this.elementsOf(ctx)) {
      if (element.refKind !== "slug-ref" || element.home !== "frontmatter") continue;
      const value = ctx.head.value(element.anchor);
      if (value === null || this.isPlaceholder(value)) continue;
      if (SlugRefInvariant.#resolves(ctx, value)) continue;
      findings.push(
        this.finding(
          ctx,
          element.anchor,
          `the ${element.anchor} reference names no on-disk overall document: ${value}`,
          `name the slug: of an existing overall document (${value} resolves to nothing)`,
        ),
      );
    }
    return findings;
  }

  /** Whether the reference resolves — a `slug-ref` value names an on-disk document by its
   *  `slug:`, never by a path. The registry declares exactly ONE slug-ref key (`program`),
   *  whose target class is the overall, so the lookup is the index's overall read. A second
   *  slug-ref key would have to carry its target class into this resolution. */
  static #resolves(ctx: JudgeContext, value: string): boolean {
    return ctx.index.overallOf(value) !== null;
  }
}

/** cross-doc-chain — the identity chain resolves and its lineage tokens belong to the
 *  program the document names. The chain is expressed in identity keys only: a plan is
 *  chained to the identity document sharing its `slug:`, and a phase-spec is chained to the
 *  overall its `program:` names (the `slug-ref` rule judges that the reference resolves; this
 *  strategy judges its lineage). */
export class CrossDocChainInvariant extends Invariant {
  readonly name = "cross-doc-chain";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey === "overall") return this.#overallChain(ctx);
    if (ctx.docKey === "plan") return this.#planChain(ctx);
    return this.#specChain(ctx);
  }

  /** The overall chain-root face: a dispatch phase must be registered in the inventory. */
  #overallChain(ctx: JudgeContext): FindingDraft[] {
    if (ctx.phaseId === undefined) return [];
    const data = this.record(ctx, "overall");
    if (data === null) return [];
    const registered = new Set(data.chain.phases.map((phase) => phase.id.toLowerCase()));
    if (registered.has(ctx.phaseId.toLowerCase())) return [];
    return [
      this.finding(
        ctx,
        "Phase inventory",
        `dispatch phase ${ctx.phaseId} is not registered in the parent overall's Phase inventory`,
        `register phase ${ctx.phaseId} in the Phase inventory`,
      ),
    ];
  }

  /** The plan chain face — the plan's identity chain is the identity document sharing its
   *  `slug:`: a plan with no same-slug identity document has no design spec to dispatch
   *  against, and the finding names the `slug` key. The positive half is any identity
   *  document (overall / phase-spec / single-spec) carrying the same slug. */
  #planChain(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const slug = ctx.head.slug;
    // A placeholder or missing slug is presence's surface, never this arm's.
    if (slug === null || this.isPlaceholder(slug)) return [];
    // An identity question, never a first pick: n ≥ 1 is an identity, so the chain never
    // claims "no identity document" over an ambiguous set.
    if (ctx.index.hasIdentity(slug)) return [];
    return [
      this.finding(
        ctx,
        "slug",
        `the plan carries no identity document with the same slug: ${slug}`,
        `add a spec document declaring slug: ${slug} (its doc-type is overall / phase-spec / single-spec)`,
      ),
    ];
  }

  /** The phase-spec chain face — the `program:` reference's lineage tokens must belong to the
   *  overall it names. The reference's own resolution is the `slug-ref` rule's judgment; this
   *  arm only judges the version facts once the target is resolved. */
  #specChain(ctx: JudgeContext): FindingDraft[] {
    const data = this.record(ctx, "phase-spec");
    if (data === null) return [];
    const findings: FindingDraft[] = [];
    const programLink = data.chain.programLink;
    if (programLink === null) return findings;
    const program = ctx.index.overallOf(programLink.target);
    if (program === null) return findings;
    const lineage = CrossDocChainInvariant.#parentLineage(ctx, program);
    if (lineage === null) return findings;
    for (const token of data.chain.parentTokens) {
      if (lineage.has(token)) continue;
      findings.push(
        this.finding(
          ctx,
          "program",
          `the parent-version token ${token} does not belong to the program's lineage: ${programLink.target}`,
          `use a version the program overall declares (its version front-matter or a Change-history row): ${[...lineage].join(", ")}`,
        ),
      );
    }
    return findings;
  }

  /** The program overall's lineage: its head `version:` scalar + every Change-history row
   *  version, read through the SAME row source the judged document went through (split →
   *  canonicalize → parse), so an alias-registered table heading reads identically in both
   *  faces. null when the parent is unreadable: a parent the world cannot read is never
   *  evidence that a version token is foreign. */
  static #parentLineage(ctx: JudgeContext, entry: IndexedDocument): Set<string> | null {
    const content = ctx.world.read(entry.rel);
    if (content === null) return null;
    const { head, text } = new RowSource(ctx.translator).read(content);
    const parsed = docTypeParsers.overall.parse(MarkdownTree.parse(text), head) as OverallParsed;
    const lineage = new Set<string>();
    if (head.version !== null) lineage.add(head.version);
    for (const row of parsed.tables["Change history"].rows) {
      const match = row[0]?.match(/v\d+\.\d+/);
      if (match !== null && match !== undefined) lineage.add(match[0]);
    }
    return lineage;
  }
}

/** section-scoped-domain — a value shape is enforced only inside its owning section. */
export class SectionScopedDomainInvariant extends Invariant {
  readonly name = "section-scoped-domain";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey === "overall") return this.#issueScopedRefs(ctx);
    if (ctx.docKey === "phase-spec") return this.#designScoping(ctx);
    return [];
  }

  /** Issue-ref forms are judged only within `## Issue inventory` (a content-wide rule would
   *  misfire on legacy `## Requirement inventory` tables whose ref cells are prose). */
  #issueScopedRefs(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "overall") return [];
    const slice = this.sliceOf(ctx, "Issue ref cell");
    if (slice?.valuePattern === undefined) return [];
    const findings: FindingDraft[] = [];
    const [issueHead] = this.occurrenceNodes(ctx, "## Issue inventory");
    const table = issueHead === undefined ? null : ctx.selector.tableUnder(issueHead.text);
    for (const row of table?.body ?? []) {
      const ref = row[1]?.trim() ?? "";
      if (ref === "" || ref.toLowerCase() === "none") continue;
      if (slice.valuePattern.test(ref)) continue;
      findings.push(
        this.finding(
          ctx,
          "Issue inventory",
          `issue ref inside Issue inventory is outside its declared domain: ${ref}`,
          "use the anchored `#NNN#issuecomment-<digits>` / bare `#NNN` / `[#NNN]` / `none` or a parenthetical note",
        ),
      );
    }
    return findings;
  }

  /** `### N.` design-group headings may appear only inside `## Design`. */
  #designScoping(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "phase-spec") return [];
    const element = this.elementOf(ctx, "### N. group heading");
    if (element === undefined || element.valuePattern === undefined) return [];
    const [design] = this.occurrenceNodes(ctx, "## Design");
    const section = ctx.tree.sections().find((entry) => entry.line === design?.line);
    const findings: FindingDraft[] = [];
    for (const heading of ctx.tree.headings()) {
      if (!ctx.selector.matches(element.selector, heading.text)) continue;
      // A group heading inside the Design section is the surface's own content; the finding
      // is the heading that sits OUTSIDE it.
      if (section !== undefined && heading.line >= section.line) {
        if (heading.line <= section.line + section.lines.length) continue;
      }
      findings.push(
        this.finding(
          ctx,
          "### N. group heading",
          `a design-group heading appears outside ## Design: ${heading.text.trim()}`,
          "move the group heading under ## Design (design-body surface only)",
        ),
      );
    }
    return findings;
  }
}

// ---------------------------------------------------------------------------
// the graph legs
// ---------------------------------------------------------------------------

/** wave-width-at-most-three — the plan-scope preventive rule: no DependsOn layer of the plan
 *  may carry more than `MAX_TASKS_PER_WAVE` tasks. The layers arrive READY-MADE through
 *  `ctx.taskLayers` — the caller injects the graph's own decomposition, the single derivation
 *  authority. This rule therefore never re-derives batches and never imports the graph class.
 *
 *  A missing layer fact (a call site with no plan graph) yields ZERO findings: the degradation
 *  is visible on the caller's checked row, never turned into a refusal. */
export class WaveWidthInvariant extends Invariant {
  readonly name = "wave-width-at-most-three";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const layers = ctx.taskLayers;
    if (layers === undefined) return [];
    const findings: FindingDraft[] = [];
    for (const layer of layers) {
      if (layer.length <= MAX_TASKS_PER_WAVE) continue;
      const ids = [...layer].sort((left, right) => left - right);
      findings.push(
        this.finding(
          ctx,
          "DependsOn",
          `the DependsOn layer {${ids.join(",")}} carries ${ids.length} tasks, above the ${MAX_TASKS_PER_WAVE}-task limit`,
          `chain the extra tasks through the plan's **DependsOn** edges so no layer carries more than ${MAX_TASKS_PER_WAVE} tasks`,
        ),
      );
    }
    return findings;
  }
}

/** dangling-task-ref — a `Consumes` / `Produces` row naming a task the plan does not declare.
 *  The candidate is the parenthesised `Task N` marker: a group may name several tasks (only
 *  the first carries the prefix), and every id inside it is judged on its own. A row with no
 *  marker is no candidate — prose that merely looks like a reference is never judged. */
export class DanglingTaskRefInvariant extends Invariant {
  readonly name = "dangling-task-ref";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const declared = new Set(this.tasks(ctx).map((block) => block.id));
    const findings: FindingDraft[] = [];
    for (const block of this.tasks(ctx)) {
      for (const section of block.sections) {
        if (section.key !== "Consumes" && section.key !== "Produces") continue;
        for (const id of DanglingTaskRefInvariant.#referencedIds(section.lines)) {
          if (declared.has(id)) continue;
          findings.push(
            this.finding(
              ctx,
              `Task ${block.id}`,
              `the ${section.key} row names task ${id}, which the plan does not declare`,
              `point the ${section.key} row at a declared task, or declare the task it names`,
            ),
          );
        }
      }
    }
    return findings;
  }

  /** Every task id the field's markers name, in reading order. */
  static #referencedIds(lines: readonly string[]): readonly number[] {
    const ids: number[] = [];
    for (const line of lines) {
      for (const marker of line.matchAll(TASK_MARKER)) {
        for (const part of (marker[1] ?? "").split(REFERENCE_SEPARATOR)) {
          const id = Number(part.trim().replace(TASK_PREFIX, "").trim());
          if (Number.isInteger(id) && id > 0) ids.push(id);
        }
      }
    }
    return ids;
  }
}

/** The parenthesised task marker — `（Task 2 · 3 · 4）` and its ASCII form. The group starts
 *  with the literal `Task`, and every id after it may be bare. */
const TASK_MARKER = /[（(]\s*Task\s+([^）)]*)[）)]/g;

/** The separator between two ids inside one marker (`·` and the two commas). */
const REFERENCE_SEPARATOR = /[·・,，]/;

/** The one prefix a continuation id may still carry (`Task 43` beside `2 · 43`). */
const TASK_PREFIX = /^Task\s+/i;

/** depends-on-cycle — a `DependsOn` edge set that closes a cycle. The graph is a general
 *  DIRECTED graph, not a function graph: `DependsOn 3, 7` is two edges, so a cycle can close
 *  through the second. The judgment is never re-derived here — the caller injects the
 *  graph's own issues together with the ONE rendered detail line, so this row and the gate's
 *  `details` print the same bytes and the template has one author. */
export class DependsOnCycleInvariant extends Invariant {
  readonly name = "depends-on-cycle";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    return (ctx.graphIssues ?? [])
      .filter((issue) => issue.kind === "cycle")
      .map((issue) => this.finding(ctx, `Task ${issue.task}`, issue.detail, issue.fix));
  }
}

// ---------------------------------------------------------------------------
// single-create — the plan's claimed-file declaration set
// ---------------------------------------------------------------------------

/** The VERB face's vocabulary — what a `Files` row's label says, five values with the `other`
 *  bucket catching every out-of-vocabulary spelling (never a guess at what the spelling
 *  meant). */
export type FileVerb = "create" | "modify" | "test" | "delete" | "other";

/** The CLAIM face's answer — whether a row's path is claimed by the line that names it, and
 *  with which spelling. Deliberately a SECOND fact, wider than "created or modified": the
 *  claim face covers the whole verb vocabulary, so `Test:` and `Delete:` claim their path
 *  exactly as `Create:` and `Modify:` do, and the `other` bucket's spellings claim only
 *  through the two closed label sets below. */
export type FileClaim = "create" | "modify" | "test" | "delete" | "none";

/** One `Files` row's declaration — the (verb, claim, path) triple one inline segment names. */
export interface FileDeclaration {
  /** The path token as written (the shape filter is the judgment's, not the reader's). */
  readonly path: string;
  /** The verb face's reading of the row's label. */
  readonly verb: FileVerb;
  /** The claim face's reading of the same label. */
  readonly claim: FileClaim;
}

/**
 * FileDeclarations — the `Files` row read the `single-create` rule judges. Invariant: one
 * line yields one declaration per path token, each carrying the reading of the label its own
 * segment states, so a `Test:` segment never re-labels the paths it follows.
 *
 * The read lives beside its only consumer: the block grammar normalizes the section shapes
 * and the claim face reads the row's own spelling, so a second reader would be the drift this
 * family exists to prevent.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the `Files` row reader is a declared static reader set — the repo's zero-bare-function discipline admits no standalone parser.
export class FileDeclarations {
  /** The four vocabulary spellings of the verb face — everything else is `other`. */
  static readonly VERBS: ReadonlySet<string> = new Set(["create", "modify", "test", "delete"]);

  /** The claim face's CREATE label set — the `other` spellings that claim a creation. A
   *  closed set, not a reading of what the word means. */
  static readonly CREATE_LABELS: ReadonlySet<string> = new Set(["add", "新建"]);

  /** The claim face's MODIFY label set — the `other` spellings that claim a change. */
  static readonly MODIFY_LABELS: ReadonlySet<string> = new Set(["修改", "modified"]);

  /** The inline segment separators of one `Files` value line. */
  static readonly SEPARATORS = /[;；、·]/;

  /** The legacy cross-form's field wrapper — `- **Files**: <value>` — stripped so the value
   *  face sees the same text a `#### Files` heading's line carries. */
  static readonly FIELD_MARKER = /^\*\*[^*]+\*\*\s*[:：]\s*/;

  /** The optional line label a `Files` segment may carry, COLON form — `Create:` ·
   *  `Modify (diagram evidence):` · `修改：`. A label carries no dot and no slash: a
   *  path-shaped token before a colon (`cli.ts:41`) is a coordinate, never a verb. */
  static readonly ROW_LABEL = /^([^:：`/.]{1,40}?)\s*[:：]\s*/;

  /** The leading label in its BARE-word form (`- Create `x``) — the first word, taken
   *  whenever it is shaped like a label rather than like a value. */
  static readonly WORD_LABEL = /^([^:：`/.\s]{1,40})\s+/;

  /** The parenthetical span of a segment — a cited example beside the row's own path, never a
   *  second declaration. Paired with a quoted span in ONE alternation so a parenthetical is
   *  dropped WHOLE while a quoted span outside one survives. */
  static readonly EXAMPLE = /`([^`]+)`|[（(][^）)]*[）)]/g;

  /** The placeholder spellings a `Files` value line may carry INSTEAD of a path. */
  static readonly PLACEHOLDERS: ReadonlySet<string> = new Set(["", "none", "(none)"]);

  /** One block's declarations — every path its `Files` section names, in document and inline
   *  order. */
  static of(block: TaskBlock): readonly FileDeclaration[] {
    const section = block.sections.find((entry) => entry.key === "Files");
    if (section === undefined) return [];
    const declarations: FileDeclaration[] = [];
    for (const line of section.lines) {
      declarations.push(...FileDeclarations.#ofLine(line));
    }
    return declarations;
  }

  /** The verb face's reading of one label — the five-value vocabulary over the label's first
   *  word, lowercased, with one trailing colon peeled. */
  static verbOf(label: string): FileVerb {
    const word = FileDeclarations.#labelWordOf(label);
    return FileDeclarations.VERBS.has(word) ? (word as FileVerb) : "other";
  }

  /** The claim face's reading of one label — the four vocabulary verbs claim by their own
   *  spelling, and the `other` bucket claims only through the two closed label sets. */
  static claimOf(label: string): FileClaim {
    const word = FileDeclarations.#labelWordOf(label);
    if (FileDeclarations.VERBS.has(word)) return word as FileClaim;
    if (FileDeclarations.CREATE_LABELS.has(word)) return "create";
    if (FileDeclarations.MODIFY_LABELS.has(word)) return "modify";
    return "none";
  }

  /** The label's comparison word — its first space-separated word, lowercased, with one
   *  trailing colon (`:` or `：`) peeled. */
  static #labelWordOf(label: string): string {
    return (label.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[:：]$/, "");
  }

  /** One segment's label in either form — the colon form first, then the opening bare word. */
  static #labelOf(segment: string): { readonly label: string; readonly rest: string } | null {
    const colon = FileDeclarations.ROW_LABEL.exec(segment);
    if (colon !== null) return { label: colon[1] ?? "", rest: segment.slice(colon[0].length) };
    const bare = FileDeclarations.WORD_LABEL.exec(segment);
    if (bare === null) return null;
    return { label: bare[1] ?? "", rest: segment.slice(bare[0].length) };
  }

  /** One `Files` value line's declarations — the bullet and the legacy field wrapper
   *  stripped, the inline separators split, and each segment read on both faces. */
  static #ofLine(line: string): readonly FileDeclaration[] {
    const body = line
      .replace(/^[-*+](?:\s+|$)/, "")
      .replace(FileDeclarations.FIELD_MARKER, "")
      .trim();
    if (FileDeclarations.PLACEHOLDERS.has(body.toLowerCase())) return [];
    const declarations: FileDeclaration[] = [];
    let verb: FileVerb = "other";
    let claim: FileClaim = "none";
    for (const raw of body.split(FileDeclarations.SEPARATORS)) {
      const segment = raw.trim();
      if (segment.length === 0) continue;
      const label = FileDeclarations.#labelOf(segment);
      let value = segment;
      if (label !== null) {
        verb = FileDeclarations.verbOf(label.label);
        claim = FileDeclarations.claimOf(label.label);
        value = label.rest;
      }
      for (const target of FileDeclarations.#tokensOf(value)) {
        declarations.push({ path: target, verb, claim });
      }
    }
    return declarations;
  }

  /** One segment's path tokens — the parenthetical example is dropped whole (a quoted path
   *  inside it included), the quoted spans are the declaration when the segment quotes its
   *  paths, and an unquoted value (already split at the separators) is one token. */
  static #tokensOf(value: string): readonly string[] {
    const remainder = value
      .replace(FileDeclarations.EXAMPLE, (match: string, span: string | undefined) =>
        span === undefined ? " " : match,
      )
      .trim();
    if (FileDeclarations.PLACEHOLDERS.has(remainder.toLowerCase())) return [];
    const spans = [...remainder.matchAll(/`([^`]+)`/g)]
      .map((match) => (match[1] ?? "").trim())
      .filter((token) => token.length > 0);
    // A segment that quotes its paths declares exactly those; a quoted placeholder declares
    // none of them.
    if (spans.length === 0) return [remainder];
    return spans.filter((token) => !FileDeclarations.PLACEHOLDERS.has(token.toLowerCase()));
  }
}

/** single-create — one path is CREATED once, and its `Create:` row comes before every other
 *  declaring row. The judgment needs two answers the `Files` reader keeps apart: the VERB face
 *  says what a row's label states, and the CLAIM face says whether the row claims its path at
 *  all. The claim face covers the whole verb vocabulary — a `Test:` or a `Delete:` row claims
 *  its path exactly as `Modify:` does — and an out-of-vocabulary `Add:` / `修改` spelling
 *  claims through its own closed label set, so two spellings of one defect get one verdict.
 *
 *  The rule reads the declaration SET, never a line count: a path declared twice on one row is
 *  one declaration, a path restated as `Modify:` after its `Create:` is the normal increment,
 *  and only two states are refused — more than one `Create:` row, and a `Create:` row that
 *  sits after a task which already declared the path. */
export class SingleCreateInvariant extends Invariant {
  readonly name = "single-create";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const findings: FindingDraft[] = [];
    for (const [claimed, tasks] of this.#claimSets(ctx)) {
      findings.push(...this.#judgePath(ctx, claimed, tasks));
    }
    return findings;
  }

  /** Every claimed path of the plan, mapped to the tasks that claim it — with `true` on the
   *  tasks whose row carries the canonical `Create:` verb. A path is counted once per task:
   *  an inline restatement of the same row is one declaration. Tokens outside the path shape
   *  (`<slug>`, a bare word, a `#`-member) name no file and claim nothing. */
  #claimSets(ctx: JudgeContext): ReadonlyMap<string, ReadonlyMap<number, boolean>> {
    const paths = new Map<string, Map<number, boolean>>();
    for (const block of this.tasks(ctx)) {
      for (const declaration of FileDeclarations.of(block)) {
        if (declaration.claim === "none") continue;
        if (PathShape.pathOf(declaration.path) === null) continue;
        const tasks = paths.get(declaration.path) ?? new Map<number, boolean>();
        tasks.set(block.id, (tasks.get(block.id) ?? false) || declaration.verb === "create");
        paths.set(declaration.path, tasks);
      }
    }
    return paths;
  }

  /** One path's verdict — the canonical `Create:` rows against every earlier declaring task.
   *  Only the `Create:` spelling counts as a creating row: an `Add:` claim makes a later
   *  `Create:` late, but two `Add:` rows never claim to have created anything. */
  #judgePath(
    ctx: JudgeContext,
    claimed: string,
    tasks: ReadonlyMap<number, boolean>,
  ): readonly FindingDraft[] {
    const creates = [...tasks]
      .filter(([, creates]) => creates)
      .map(([task]) => task)
      .sort((left, right) => left - right);
    if (creates.length > 1) {
      return [
        this.finding(
          ctx,
          "Files",
          `the Create: declaration for ${claimed} appears in tasks ${creates.join(", ")}`,
          "keep one Create: row per path — the row that first claims the path owns its creation",
        ),
      ];
    }
    const owner = creates[0];
    if (owner === undefined) return [];
    const earlier = [...tasks.keys()].filter((task) => task < owner).sort((a, b) => a - b);
    if (earlier.length === 0) return [];
    return [
      this.finding(
        ctx,
        "Files",
        `task ${owner} declares Create: ${claimed}, after ${earlier.map((task) => `task ${task}`).join(", ")} already declared it`,
        "move the Create: row to the first task that claims the path, and let later tasks declare Modify:",
      ),
    ];
  }
}

// ---------------------------------------------------------------------------
// the shape gate — line coordinates, live arithmetic, prose faces
// ---------------------------------------------------------------------------

/** The three `line-coordinate` shapes: `第 N 行` · `line N` · a path followed by `:N`. The
 *  third shape requires at least one LETTER before its colon: a file name carries one, a
 *  decimal ratio (`4.5:1`) does not — the colon alone does not make a coordinate, so a ratio
 *  is prose rather than a misreported line. */
const LINE_COORDINATES: readonly RegExp[] = [
  /第\s*\d+\s*行/g,
  /\blines?\s+\d+/gi,
  /(?=[\w./-]*[A-Za-z])[\w./-]+\.\w+:\d+/g,
];

/** The `live-arithmetic` token grammar — integer, optional spaces, one operator glyph of the
 *  closed set (`−` U+2212 · `-` ASCII · `–` en dash, all one verdict), optional spaces,
 *  integer, `=`, integer. Where the operands come from is NOT part of the grammar: the shape
 *  alone is the violation. */
const LIVE_ARITHMETIC = /(?<![\w.])\d+\s*[−–-]\s*\d+\s*=\s*\d+(?![\w.])/g;

/** One prose line of a document body — the shared line read of the shape grammars. */
export interface ProseLine {
  /** The 1-based line number in the source text (fence lines still count). */
  readonly line: number;
  /** The line verbatim — the symbol-candidate read face. */
  readonly raw: string;
  /** The same line with every inline code span removed — the token-grammar read face, so a
   *  claim quoted in a code span is a citation and never a violation. */
  readonly blanked: string;
}

/** One prose line of the judged document with the face the map places it in. */
interface ProseLineRecord extends ProseLine {
  /** The heading the line sits under ("" before the first heading). */
  readonly heading: string;
  /** The face the map places the line in; `unmapped` is the map's own gap. */
  readonly role: DocFace | "unmapped";
}

/**
 * ProseLines — the prose-line split of one document body: the lines a shape grammar can
 * judge. Fenced lines never arrive (the document index's own code-line map is the ONE fence
 * judgment — this class holds no second copy), and each returned line carries both read
 * faces: the verbatim text and the same line with its inline code spans removed, so a claim
 * quoted in a code span is a citation, never a violation. The heading-stack walk advances
 * along THIS read — one split, both families.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the prose-line split is a declared static reader set — the repo's zero-bare-function discipline admits no standalone splitter.
export class ProseLines {
  /** The prose lines of one body with both read faces — the ONE line read of the shape
   *  grammars. */
  static of(tree: MarkdownTree): readonly ProseLine[] {
    const document = tree.document;
    const out: ProseLine[] = [];
    for (let line = 1; line <= document.lineCount(); line += 1) {
      if (document.isCodeLine(line)) continue;
      out.push({ line, raw: document.line(line), blanked: document.bareOf(line) });
    }
    return out;
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: the heading-stack prose walk is a declared static reader set — the repo's zero-bare-function discipline admits no standalone walker.
class ProseWalk {
  /** Every non-blank prose line of the judged body with its face role — the ONE
   *  heading-stack advance behind the shape grammars. The stack keeps headings
   *  outermost-first; `FaceMap.roleOf` receives it innermost-first, so a `#### 7.5.1` item
   *  inherits the role of the `### 7.` group above it. */
  static of(ctx: JudgeContext): readonly ProseLineRecord[] {
    const records: ProseLineRecord[] = [];
    const stack: string[] = [];
    for (const entry of ProseLines.of(ctx.tree)) {
      const level = ProseWalk.#levelOf(entry.raw);
      if (level > 0) {
        while (stack.length > 0 && ProseWalk.#levelOf(stack[stack.length - 1] ?? "") >= level) {
          stack.pop();
        }
        stack.push(entry.raw);
      }
      if (entry.raw.trim() === "") continue;
      records.push({
        line: entry.line,
        raw: entry.raw,
        blanked: entry.blanked,
        heading: stack[stack.length - 1] ?? "",
        role: FaceMap.roleOf(ctx.docKey, entry.raw, [...stack].reverse()),
      });
    }
    return records;
  }

  /** The ATX heading level of a line (0 when it is not a heading). */
  static #levelOf(line: string): number {
    const hashes = /^#{1,6}\s/.exec(line);
    return hashes === null ? 0 : hashes[0].trim().length;
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: the shared shape-rule frame is a declared static walk frame — the repo's zero-bare-function discipline admits no standalone frame.
class ProseFace {
  /** The shared evaluation frame of the shape grammars: only a DECISION-face line is judged.
   *  A line whose heading the map cannot place is not a token question — it is the map's own
   *  gap, reported once by `gaps()`. */
  static judge(
    ctx: JudgeContext,
    judgeLine: (record: ProseLineRecord) => readonly FindingDraft[],
  ): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const record of ProseWalk.of(ctx)) {
      if (record.role !== "decision") continue;
      findings.push(...judgeLine(record));
    }
    return findings;
  }

  /** The gap verdict — ONE finding per heading the map cannot place (the `unmapped` face
   *  cannot be judged for a token, so the gap itself is the verdict, never a silence). It is
   *  produced by ONE row of the shape gate: the gap is a property of the face, so the same
   *  gap under every grammar must not report once per grammar. */
  static gaps(ctx: JudgeContext, kind: string): FindingDraft[] {
    const findings: FindingDraft[] = [];
    const reported = new Set<string>();
    for (const record of ProseWalk.of(ctx)) {
      if (record.role !== "unmapped") continue;
      if (reported.has(record.heading)) continue;
      reported.add(record.heading);
      findings.push({
        path: ctx.path,
        field: ProseFace.fieldOf(record),
        message: `this line sits under a heading with no declared face (${record.heading === "" ? "the document head" : record.heading}), so the shape gate cannot place it`,
        fix: "declare the section's role once in the doc-face map; the gap is the verdict, never a silence",
        kind,
      });
    }
    return findings;
  }

  /** The finding field of a walked line — the heading it sits under, or the document head
   *  when no heading places it. */
  static fieldOf(record: ProseLineRecord): string {
    return record.heading === "" ? "(document head)" : record.heading;
  }
}

/** line-coordinate — the decision face cites no line number. A claim cites a module path plus
 *  a symbol name; a line coordinate is not a pin. The row also carries the shape gate's ONE
 *  zero-candidate arm: a document whose face map places nothing is reported as the gap, never
 *  read as a clean document. */
export class LineCoordinateInvariant extends Invariant {
  readonly name = "line-coordinate";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    return [...ProseFace.gaps(ctx, this.name), ...this.#coordinatesOf(ctx)];
  }

  /** The line coordinates of every decision-face line. */
  #coordinatesOf(ctx: JudgeContext): FindingDraft[] {
    return ProseFace.judge(ctx, (record) => {
      const findings: FindingDraft[] = [];
      for (const pattern of LINE_COORDINATES) {
        for (const match of record.blanked.matchAll(pattern)) {
          findings.push(
            this.finding(
              ctx,
              ProseFace.fieldOf(record),
              `the decision face carries a line coordinate: ${match[0]}`,
              "cite the module path and the symbol name instead of a line number",
            ),
          );
        }
      }
      return findings;
    });
  }
}

/** live-arithmetic — the decision face states no arithmetic over counts. The rule is a token
 *  grammar, not a semantic one: the operands' provenance is absent from it, and the three
 *  operator glyphs carry one verdict. */
export class LiveArithmeticInvariant extends Invariant {
  readonly name = "live-arithmetic";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    return ProseFace.judge(ctx, (record) => {
      const findings: FindingDraft[] = [];
      for (const match of record.blanked.matchAll(LIVE_ARITHMETIC)) {
        findings.push(
          this.finding(
            ctx,
            ProseFace.fieldOf(record),
            `the decision face carries an arithmetic over counts: ${match[0]}`,
            "restate the claim as the condition a guard maintains, never as an operation over counts",
          ),
        );
      }
      return findings;
    });
  }
}
