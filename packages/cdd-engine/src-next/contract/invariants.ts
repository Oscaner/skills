// packages/cdd-engine/src-next/contract/invariants.ts
// T4/P21 — the invariant strategy class family (design spec §2.1 · P21 §3.1): the
// single judgment face. Every structural judgment is ONE strategy class, and the
// declaration surface (`contract/rules.ts`) is the rule list: each declared row
// names exactly one class here, and its `name` is verbatim the row id. The family:
//   doc scope    — presence (with the registration-uniqueness leg) · domain ·
//                  crosslink · section-order · continuity · residue · hollow ·
//                  file-existence · sibling-scan · link-shape · slug-ref ·
//                  cross-doc-chain · section-scoped-domain ·
//                  phase-design-spec-is-phase-spec;
//                 the change-history family — change-history-version-unique ·
//                  change-history-header-columns · change-history-row-shape ·
//                  change-history-latest-matches-front-matter ·
//                  front-matter-version-in-lineage ·
//                  change-history-row-not-in-other-table · list-marker-not-doubled;
//                 the identity legs — task-id-unique · phase-id-unique;
//                 the shape gate (P41) — measure-literal · line-coordinate ·
//                  live-arithmetic · temporal-indicator · single-home ·
//                  change-history-date-shape;
//   ledger scope — closed-wave-fits-depends-on-layers · planned-tasks-vs-recorded-
//                  tasks (a `LedgerRule`, judged with the ledger fact bundle).
// Each doc strategy is one subclass of `abstract Invariant { evaluate(ctx) }`; each
// ledger rule extends `LedgerRuleBase` (`evaluate(ctx, ledger)`) — two scopes, two
// entry shapes. The judgment data is always the declared registries + the derived
// parse face (never hand-written structure prose). Judgment dispatch is the
// coordinator's data-driven per-doc-key composition (judge.ts) — zero switch-case
// here and zero exported behavior-carrying bare functions.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ENGINE_DOC_ROOTS } from "../infra/doc-roots.ts";
import { type DocEntry, SlugIndex } from "../infra/slug-index.ts";
import { CensusGate } from "./census.ts";
import { type DocFace, type ElementRegistry, FaceMap, type RegistryElement } from "./declare.ts";
import type {
  ChainLink,
  DesignGroup,
  OverallParsed,
  ParsedDoc,
  ParsedTable,
  SectionBlock,
  TaskBlock,
} from "./doc.ts";
import { docTypeParsers, MarkdownPrimitives } from "./doc.ts";
import { FrontMatterExtractor, type FrontMatterHead } from "./frontmatter.ts";
import type { LedgerFacts } from "./judge.ts";
import type { MarkdownTree, ResolvedNode } from "./markdown-tree.ts";
import { PinSpans, PinVocabulary } from "./pins.ts";
import type { DocKey, DocShape, DocSkeleton, DocSlices, ElementSlice } from "./project.ts";
import type { LedgerRule } from "./rules.ts";
import { PlanTaskBlocksReader } from "./task-blocks.ts";
import { RowSource, type Translator } from "./translate.ts";
import { MAX_TASKS_PER_WAVE } from "./wave-width.ts";

// ---------------------------------------------------------------------------
// judgment records + the context
// ---------------------------------------------------------------------------

/** The doc-tree root namespace derived from the ONE doc-root declaration (the
 *  common parent of the spec/plan roots) — the finding messages name the
 *  repo-root form `<namespace>/…` from THIS, never a hard-coded copy (P9 T5 §2.8). */
const DOC_ROOT_NAMESPACE = path.dirname(ENGINE_DOC_ROOTS.specs);

/** The two doc-root segment names derived from the same ONE declaration — the
 *  sibling-scan finding message's `<segments>` form names THIS, never a hard-coded
 *  copy (P9 T5 §2.8). */
const DOC_ROOT_SEGMENTS = Object.values(ENGINE_DOC_ROOTS)
  .map((dir) => path.basename(dir))
  .join("/");

/** One finding DRAFT — what a strategy hands back: a single invariant violation bound
 *  to a doc + field. The tier is deliberately ABSENT: a strategy judges whether a
 *  condition holds, the rule declaration says what a hit costs (design spec §1.3), and
 *  only the coordinator's `Contract.stamped` joins the two. */
export interface FindingDraft {
  /** The doc file the finding refers to. */
  path: string;
  /** The anchored field the finding refers to (an anchor token or a section name). */
  field: string;
  /** The one-line finding message (what is wrong). */
  message: string;
  /** The actionable fix. */
  fix: string;
  /** The invariant class name that produced the finding. */
  kind: string;
}

/** One STAMPED contract finding — a draft plus the tier its rule declaration carries.
 *  The gate refuses on `block` and annotates on `warn`; nothing else reads the tier. */
export interface Finding extends FindingDraft {
  readonly severity: "block" | "warn";
}

/** The filesystem seam the context-seam invariants read through (test-injectable). */
export interface DocFs {
  /** Whether a path exists. */
  exists(p: string): boolean;
  /** The UTF-8 content of a path, or null when unreadable. */
  read(p: string): string | null;
  /** The entry names of a directory; [] when it does not exist (ENOENT). Any other
   *  failure is a real break and rethrows — an unreadable directory never reads as
   *  an empty one. */
  list(p: string): readonly string[];
}

/** The node:fs default — the production seam for file-existence / sibling scans. */
export class NodeFs implements DocFs {
  exists(p: string): boolean {
    return existsSync(p);
  }
  read(p: string): string | null {
    try {
      return readFileSync(p, "utf8");
    } catch {
      return null;
    }
  }
  list(p: string): readonly string[] {
    try {
      return readdirSync(p);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
}

/** The judgment context — everything a strategy reads, assembled by the coordinator. */
export interface JudgeContext {
  /** The doc-type record key of the document under judgment. */
  docKey: DocKey;
  /** The parsed structural record of the document. */
  parsed: ParsedDoc;
  /** The document's typed front-matter head — the §2.2 delivery seam: the SAME
   *  record validate() fed into parse (front-matter-home elements judge THIS,
   *  never a body line scan — front matter is data, not body structure). */
  head: FrontMatterHead;
  /** The document's file path (message attribution + the doc's own dir for links). */
  path: string;
  /** The workspace/repo root the doc chain resolves against. */
  root: string;
  /** The derived parse face of the judged doc type. */
  slices: DocSlices;
  /** The derived section skeleton of the judged doc type. */
  shape: DocShape;
  /** The judged doc type's skeleton projection — the slot classification the
   *  placeholder exemption reads (§4.2: only the link and content slots the
   *  skeleton fills with a holder are exempt from the strict scalar shapes). */
  skeleton: DocSkeleton;
  /** The four declared registries — the element-level judgment data. */
  registries: {
    overall: ElementRegistry;
    plan: ElementRegistry;
    "phase-spec": ElementRegistry;
    "single-spec": ElementRegistry;
  };
  /** The dispatch phase id — enables the face-④ phase-registration check. */
  phaseId?: string;
  /** The judged document's markdown tree — the ONE parse face (P21 §7.5): the
   *  strategies resolve their elements' declared selectors against it, never a raw
   *  line scan. */
  tree: MarkdownTree;
  /** The row source's canonicalized BODY text (front matter excluded) — the ONE read
   *  face of the shape rules and the sentence index (P41 §1.2 · §3.1). Reading the
   *  document through `fs.read(path)` instead would also judge the front-matter lines,
   *  which sit under no registered section and would land as face gaps: a document
   *  with a clean body would be refused for its own data head. */
  text: string;
  /** The row-source translator — the SAME canonicalize seam the judged document's
   *  lines went through. A strategy that has to parse a FOREIGN on-disk document
   *  (the chain lineage) reads it through this instance, so one alias registration
   *  canonicalizes both faces alike. */
  translator: Translator;
  /** The caller's identity index over the judged repo (the chain / slug-ref lookups'
   *  injected source). Absent → the strategies build one over `fs` (the same seam
   *  every other strategy reads, so the judgment stays hermetic). */
  slugIndex?: SlugIndex;
  /** The filesystem seam (defaults to node:fs). */
  fs: DocFs;
  /** The plan's topological layers (one task-id set per layer), injected by the
   *  caller — `TaskGraph#batches()` is the ONE derivation authority, so a
   *  layer-reading rule never re-derives batches (and the contract plane never
   *  imports the session plane). Absent on a call site that carries no plan graph:
   *  the layer-reading rules then yield zero findings and their checked row renders
   *  the visible degradation. */
  taskLayers?: readonly (readonly number[])[];
}

// ---------------------------------------------------------------------------
// the abstract strategy base
// ---------------------------------------------------------------------------

/**
 * The abstract invariant — one strategy = one structural judgment. Subclasses
 * implement evaluate(ctx) and read all judgment data from the declared registries
 * + the parse face carried by the context. The base extends MarkdownPrimitives:
 * the link/token/table-row parsers shared with the parse face live in one home
 * (doc.ts), never re-declared here.
 */
export abstract class Invariant extends MarkdownPrimitives {
  /** The invariant's name — the finding attribution label. */
  abstract readonly name: string;
  /** Run the strategy — the single evaluation entry. */
  abstract evaluate(ctx: JudgeContext): FindingDraft[];

  /** The single finding-construction point. */
  protected finding(ctx: JudgeContext, field: string, message: string, fix: string): FindingDraft {
    return { path: ctx.path, field, message, fix, kind: this.name };
  }

  /** Whether a value's raw form marks it as a holder placeholder (no existence or
   *  domain judgment): the empty value, the two pending forms, the `<…>` link
   *  placeholder and the skeleton's `:::fill <slot>` content slot. The ONE
   *  placeholder contract every strategy shares — the link-resolution faces skip a
   *  placeholder target and the front-matter domain arm skips a placeholder scalar
   *  on the keys the skeleton fills (its own §4.2 slot classification decides which,
   *  so a truth key's placeholder is still judged). */
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

  protected sliceOf(ctx: JudgeContext, anchor: string): ElementSlice | undefined {
    return ctx.slices.slices.find((slice) => slice.anchor === anchor);
  }

  /** Whether a line carries the element — the literal anchor or the declared value shape. */
  protected lineCarries(slice: ElementSlice, line: string): boolean {
    return line.includes(slice.anchor) || (slice.valuePattern?.test(line) ?? false);
  }

  /** The judged document's declared element of one anchor (undefined when the
   *  anchor is not registered in this doc type). */
  protected elementOf(ctx: JudgeContext, anchor: string): RegistryElement | undefined {
    return this.elementsOf(ctx).find((element) => element.anchor === anchor);
  }

  /** The occurrences of one element's DECLARED selector — the ONE occurrence read of
   *  the judgment plane: a node of the tree, never a raw line scan. An unregistered
   *  anchor (or an absent surface) resolves to zero nodes. */
  protected occurrenceNodes(ctx: JudgeContext, anchor: string): readonly ResolvedNode[] {
    const element = this.elementOf(ctx, anchor);
    if (element === undefined) return [];
    return ctx.tree.occurrences(element.selector);
  }

  /** The occurrence texts of one element's declared selector. */
  protected occurrenceTexts(ctx: JudgeContext, anchor: string): readonly string[] {
    return this.occurrenceNodes(ctx, anchor).map((node) => node.text);
  }

  /** The value-CARRYING occurrences of an element — a node whose literal anchor
   *  mention stays entirely inside an inline-code span cites the token, it does not
   *  carry its value (the code-span boundary is read off the tree's own inline-code
   *  node spans, never a first/last-backtick guess). */
  protected carrierNodes(ctx: JudgeContext, anchor: string): readonly ResolvedNode[] {
    return this.occurrenceNodes(ctx, anchor).filter((node) => {
      if (!node.text.includes(anchor)) return true;
      return node.bare.includes(anchor);
    });
  }

  /** The judged document's typed parse record — the tree-derived record the parse
   *  face produces (`doc.ts` reads the tree), narrowed by the doc key. The record is
   *  a projection of the tree, not a second scan: every structural read below the
   *  parse face is a node read. */
  protected record<K extends ParsedDoc["docType"]>(
    ctx: JudgeContext,
    docType: K,
  ): Extract<ParsedDoc, { docType: K }> | null {
    return ctx.parsed.docType === docType
      ? (ctx.parsed as Extract<ParsedDoc, { docType: K }>)
      : null;
  }

  /** The doc's `## Change history` table — the ONE lineage read face all four doc
   *  types expose (each parse record carries it, filled by the same table-section
   *  read). The change-history strategies read ONLY through this accessor. The
   *  record keeps the header and the body rows verbatim: a row whose cell count
   *  disagrees with the header is judged by `change-history-row-shape`, never
   *  repaired or dropped here. */
  protected changeHistory(ctx: JudgeContext): ParsedTable {
    return ctx.parsed.tables["Change history"];
  }

  /** The version token of a lineage row — the FIRST cell read ANCHORED: the cell must
   *  BE the version, never merely carry one (an in-cell prose mention of `spec v0.4`
   *  is not an identity). */
  protected lineageVersion(row: readonly string[]): string | null {
    const cell = (row[0] ?? "").trim();
    return /^v\d+\.\d+$/.test(cell) ? cell : null;
  }

  /** The change-history rows that ARE lineage rows — the ones whose cell count matches
   *  the table's column header. A row whose cells disagree with the header (a
   *  hard-wrapped cell) is a SHAPE fact — reported by `change-history-row-shape`,
   *  never silently read as a lineage identity. Duplicate detection and the
   *  newest-row leg read ONLY this set. */
  protected lineageRows(ctx: JudgeContext): readonly (readonly string[])[] {
    const table = this.changeHistory(ctx);
    const width = table.headerRow?.length ?? 0;
    if (width === 0) return [];
    return table.rows.filter((row) => row.length === width);
  }

  /** The anchored cell-0 versions of EVERY change-history body row, whatever its width.
   *  Membership is the one read a shape-ragged row must not starve: when the header
   *  version lives only on the newest row and that row hard-wraps, the version is still
   *  the document's own lineage (its shape is a separate defect).
   *  `front-matter-version-in-lineage` reads this set; the duplicate and newest-row legs
   *  keep `historyVersions`. */
  protected membershipVersions(ctx: JudgeContext): readonly string[] {
    return this.changeHistory(ctx)
      .rows.map((row) => this.lineageVersion(row))
      .filter((version) => version !== null) as readonly string[];
  }

  /** The numeric comparison rank of a version token — the lineage's newest row is a
   *  NUMERIC read (`v0.10` outranks `v0.9`), never a lexical one. */
  protected versionRank(version: string): number {
    const [major, minor] = version.replace(/^v/, "").split(".");
    return Number(major) * 1_000_000 + Number(minor);
  }

  /** The doc's Change-history row versions, in row order — the ONE lineage identity
   *  read the duplicate and newest-row strategies share (one copy on the base, zero
   *  per-strategy private duplicates). Header-width rows only: a shape-ragged row is
   *  no lineage identity (membership's wider read is `membershipVersions`). */
  protected historyVersions(ctx: JudgeContext): readonly string[] {
    return this.lineageRows(ctx)
      .map((row) => this.lineageVersion(row))
      .filter((version) => version !== null) as readonly string[];
  }

  /** The identity index every slug-keyed strategy looks up through — the caller's
   *  injected index when present, else one scan over the SAME fs seam every other
   *  strategy reads (the judgment stays hermetic: no second, real-filesystem scan).
   *  The ONE home of that fallback. */
  protected indexOf(ctx: JudgeContext): SlugIndex {
    return ctx.slugIndex ?? SlugIndex.build(ctx.root, ctx.fs);
  }

  /** The three-table section heading anchors of the overall (registry-declared). */
  protected overallTableHeadings(ctx: JudgeContext): readonly string[] {
    if (ctx.docKey !== "overall") return [];
    const declared = ctx.registries.overall.elements
      .filter((element) => element.home === "section" && element.anchor.startsWith("## "))
      .map((element) => element.anchor);
    return declared.filter((anchor) =>
      ["Issue inventory", "Phase inventory", "Change history"].some((name) =>
        anchor.includes(name),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// base nine
// ---------------------------------------------------------------------------

/** Home surfaces the presence invariant judges — the structural doc surface
 *  (table rows/columns/tokens are judged by hollow/section-scoped strategies). */
const PRESENCE_HOMES = new Set([
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

/** The ledger-scope strategy base — the two cross-ledger rules' shared seam. Kept
 *  separate from `Invariant` on purpose: a ledger rule's judgment entry takes the
 *  ledger fact bundle as a SECOND argument (`evaluate(ctx, ledger)`), so it can never
 *  ride the doc-scope policy composition (two scopes, two gates, two entry shapes). */
export abstract class LedgerRuleBase implements LedgerRule {
  abstract readonly name: string;
  /** Run the rule over the doc judgment context + the ledger fact bundle. */
  abstract evaluate(ctx: JudgeContext, ledger: LedgerFacts): FindingDraft[];

  /** The single finding-construction point (one home per scope). */
  protected finding(ctx: JudgeContext, field: string, message: string, fix: string): FindingDraft {
    return { path: ctx.path, field, message, fix, kind: this.name };
  }
}

/** closed-wave-fits-depends-on-layers — an OPEN wave stays inside one DependsOn layer.
 *  The rule reads the ledger's open waves alone: a closed wave is settled history whose
 *  layer fit was judged at its own dispatch, so a later plan edit never retro-flags it —
 *  only a wave still dispatchable can be corrected by the plan itself. An open wave's
 *  members must share ONE layer of the plan's topological decomposition; a wave spanning
 *  two layers was dispatched against a plan whose edges moved under the open ledgers.
 *  The read is a SUBSET one: a wave whose members all sit in one layer fits even when it
 *  does not fill that layer (`{2}` against `[{1},{2,3}]` is green) — the append-wave
 *  dispatch relies on the same liberal read. */
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

/** planned-tasks-vs-recorded-tasks — the ledger's recorded tasks must still exist in
 *  the plan. ONE direction only: a plan always LEADS the ledger (every undispatched
 *  task sits in the plan), so neither task numbering nor dependency layers can tell
 *  "the next wave" from "a stranded task" — the old id-based window flagged the
 *  normal next-wave state and locked the whole dispatch chain (the P21 dogfood
 *  defect). That direction therefore carries zero judgment (an `info (plan leads
 *  ledger by N tasks)` row only). The one real disagreement is a recorded task the
 *  plan no longer carries — an executed task rewritten out of the plan. */
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

  /** How many planned tasks the ledger has not recorded yet — the `plan leads ledger`
   *  info count (a prompt, never a finding). */
  static planAhead(ledger: LedgerFacts): number {
    const recorded = new Set(ledger.recordedTasks);
    return ledger.planTasks.filter((id) => !recorded.has(id)).length;
  }
}

/** presence — every required structural element of the declared registry must occur. */
export class PresenceInvariant extends Invariant {
  readonly name = "presence";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const element of this.elementsOf(ctx)) {
      if (element.presence !== "required") continue;
      if (PRESENCE_HOMES.has(element.home) === false) continue;
      // The task-block sections are judged PER BLOCK below (`taskFieldPresence`), so
      // a legacy-shape plan (whose fields carry no `#### Key` line) is never reported
      // as a whole-document absence — the reader normalized both shapes into the same
      // block record, and that record is the presence basis.
      if (element.home === "task-field" && element.anchor.startsWith("#### ")) continue;
      const slice = this.sliceOf(ctx, element.anchor);
      if (slice === undefined) continue;
      if (this.#derivedPresenceHolds(ctx, element, slice)) continue;
      // The front-matter-home elements judge the typed head record (the §2.2
      // delivery seam — NEVER the body line scan: front matter is data, and a
      // whitespace line or a body-line mention of a key is not an occurrence).
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
    findings.push(...this.taskFieldPresence(ctx));
    // The registration uniqueness leg folded into presence (one rule = one strategy):
    // a required element that registers MORE than once is the duplicate side of the
    // same "registers exactly once" judgment the missing side above reports.
    findings.push(...this.headingUniqueness(ctx));
    return findings;
  }

  /** Heading-style anchors: a duplicated heading line text is a duplicate registration. */
  private headingUniqueness(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    const seenLine = new Set<string>();
    for (const element of this.elementsOf(ctx)) {
      if (!element.anchor.startsWith("#")) continue;
      // A task-block section heading repeats once per task block by design — its
      // `#### Key` identity is judged per block, never as a whole-document duplicate.
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

  /** A required surface whose occurrence is established by the parsed structure rather
   *  than a token scan — the plan's `Task id token` only ever appears inside the
   *  `### Task N:` headings, so it is present iff a task block exists; a token inside
   *  a required field (`File path token`) is present iff its owning field carries a
   *  value line (the field's own key presence is the block-presence leg, and an
   *  unfilled placeholder value is the author's fact, not a missing element). */
  #derivedPresenceHolds(ctx: JudgeContext, element: RegistryElement, slice: ElementSlice): boolean {
    if (slice.home === "task-block" && !slice.anchor.startsWith("#")) {
      return ctx.tree.tasks().length > 0;
    }
    if (slice.home === "task-field" && !slice.anchor.startsWith("#### ")) {
      const parent = element.selector.from;
      if (parent === "root") return false;
      return ctx.tree
        .occurrences(parent)
        .some((field) => field.lines.some((line) => line.trim() !== ""));
    }
    return false;
  }

  /** The per-task-block required field keys — derived from the plan registry's
   *  task-field section elements (the `#### Key` headings; the `File path token`,
   *  `DependsOn none` / `DependsOn id` leaves carry non-key anchors, and `Step
   *  action` lives on the task-step home). The reader normalizes the legacy bullet
   *  shape into the same keys, so one declaration enforces both shapes per block.
   *  Single-source: a section added to the registry is enforced per task block
   *  automatically. */
  #requiredFieldKeys(ctx: JudgeContext): readonly string[] {
    return this.elementsOf(ctx)
      .filter((element) => element.home === "task-field" && element.anchor.startsWith("#### "))
      .map((element) => element.anchor.slice("#### ".length));
  }

  /** The per-task-block field surface — every required task-field key of a plan. */
  private taskFieldPresence(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const findings: FindingDraft[] = [];
    for (const block of ctx.tree.tasks()) {
      const keys = new Set(block.fields.map((field) => field.key));
      for (const key of this.#requiredFieldKeys(ctx)) {
        if (!keys.has(key)) {
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
    }
    return findings;
  }
}

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

/** change-history-row-shape — a Change-history body row whose cell count disagrees with
 *  the table's column header is a rendering defect (a hard-wrapped cell parsed as its
 *  own row). The row is REPORTED, never silently dropped from the lineage read. */
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

/** The DECLARED `## Change history` column set — the header must equal it cell for
 *  cell (after `trim`). The row-shape leg judges a row against whatever the header
 *  declares; this declaration is what makes the header itself a judged fact. */
export const CHANGE_HISTORY_COLUMNS = ["Version", "date", "summary", "author"] as const;

/** change-history-header-columns — the `## Change history` header must BE the declared
 *  column set: a grown, dropped or renamed column silently redefines what every row
 *  means, so it is reported once, independently of the row widths (the two legs are
 *  orthogonal: this one reads the header, `change-history-row-shape` reads the rows
 *  against that header). An absent section / header judges nothing here. */
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

/** change-history-latest-matches-front-matter — the front-matter `version:` IS the
 *  lineage's newest numeric version: appending a row lifts both in the same edit, so
 *  the two sides can never disagree. */
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

/** task-id-unique — every `### Task N:` id registers exactly once (plan). */
export class TaskIdUniqueInvariant extends Invariant {
  readonly name = "task-id-unique";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const findings: FindingDraft[] = [];
    const seenIds = new Set<number>();
    for (const block of ctx.tree.tasks()) {
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

/** domain — every value an anchor literal carries must conform to its declared shape. */
export class DomainInvariant extends Invariant {
  readonly name = "domain";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const element of this.elementsOf(ctx)) {
      const slice = this.sliceOf(ctx, element.anchor);
      if (slice === undefined) continue;
      // The front-matter-home elements judge the typed head SCALAR (the §2.2
      // delivery seam — the registered value patterns are scalar shapes, §2.3).
      // Absence is presence's surface; a present scalar outside the declared
      // shape is the finding. The pattern is read from the REGISTRY ELEMENT
      // (project.ts's header leg deliberately stops both slice RegExp
      // compilations — the front-matter key is looked up against the head).
      if (slice.home === "frontmatter") {
        const value = ctx.head.value(element.anchor);
        if (value === null) continue;
        // The skeleton's own placeholders (`:::fill <slot>` / `<…>`) are holder
        // states, not values — the strict scalar shapes judge a CONCRETE value.
        // The exemption is SCOPED to the keys the skeleton actually fills (§4.2:
        // the link slots and the content slots), so a hand-written placeholder on
        // a truth key (a fixed version / date / status literal) stays a finding.
        if (DomainInvariant.#skeletonFills(ctx, element.anchor) && this.isPlaceholder(value))
          continue;
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
      // The element is judged by the SHAPE of the lines that carry it structurally —
      // a table row or a heading must match its declared pattern. A prose citation
      // (a backticked code-span mention, or a table cell of a non-table element) is
      // not a carrier and is never judged as a value.
      for (const node of this.carrierNodes(ctx, element.anchor)) {
        if (slice.valuePattern.test(node.text)) continue;
        // The declared value may sit in a captured sub-span of the located node —
        // the task id inside its `### Task N:` heading. The node is the locator, the
        // capture is the value the declared shape judges.
        if (DomainInvariant.#capturesShape(element.selector.match, node.text, slice.valuePattern))
          continue;
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

  /** Whether the element's locator capture the declared shape accepts — a value
   *  that lives inside the located node (the task id in its heading). */
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
   *  projection's own §4.2 slot classification (the link slots' `<…>` scalar and
   *  the content slots' `:::fill`), so the exemption covers exactly the keys that
   *  can legally carry a holder form. A key absent from the emission list (a
   *  shape-typed optional key) fills nothing and is never exempt. */
  static #skeletonFills(ctx: JudgeContext, anchor: string): boolean {
    const slot = ctx.skeleton.frontmatter.find((entry) => entry.anchor === anchor);
    if (slot === undefined) return false;
    return slot.slot === "link" || slot.slot === "content";
  }
}

/** crosslink — in-document reference resolution against the doc's own identity sets. */
export class CrosslinkInvariant extends Invariant {
  readonly name = "crosslink";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey === "overall") return this.overallCrosslinks(ctx);
    if (ctx.docKey === "plan") return this.planCrosslinks(ctx);
    return [];
  }

  /** The overall's in-doc reference surfaces: issue rows + graph edges + dependency cells. */
  private overallCrosslinks(ctx: JudgeContext): FindingDraft[] {
    const data = this.record(ctx, "overall");
    if (data === null) return [];
    const findings: FindingDraft[] = [];
    const ids = new Set(data.chain.phases.map((phase) => phase.id.toLowerCase()));
    // Issue-inventory rows: the Phase column must be a registered inventory id.
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
    // Graph edges: every from/to token must be a registered phase id (the tree's
    // edge read — the graph surface's ONE parse).
    for (const edge of ctx.tree.edges()) {
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
      for (const token of this.#phaseTokens(phase.dependencyCell)) {
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
   *  reference gate. Prose task mentions are NOT consumed here (T6): the WARN-only
   *  observation belongs to the reference-lint pass, never a hard finding. */
  private planCrosslinks(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const findings: FindingDraft[] = [];
    const blocks = ctx.tree.tasks();
    const ids = new Set(blocks.map((block) => block.id));
    for (const block of blocks) {
      const dependsOn = this.#dependsOnOf(block);
      for (const id of dependsOn) {
        if (!ids.has(id)) {
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
    }
    return findings;
  }

  /** The numeric DependsOn values of a task block. */
  #dependsOnOf(block: TaskBlock): readonly number[] {
    const ids: number[] = [];
    const field = block.fields.find((field) => field.key === "DependsOn");
    if (field === undefined) return ids;
    for (const value of field.lines) {
      for (const match of value.matchAll(/\b([1-9]\d*)\b/g)) ids.push(Number(match[1]));
    }
    return ids;
  }

  /** The `P<n>` tokens of a comment struct (dependency cells / depends-on values). */
  #phaseTokens(text: string): readonly string[] {
    const tokens: string[] = [];
    for (const match of text.matchAll(/P(\d+(?:\.\d+)*)/g)) tokens.push(`P${match[1]}`);
    return tokens;
  }
}

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
    for (let index = 0; index < anchors.length; index++) {
      const slice = this.sliceOf(ctx, anchors[index]);
      if (slice?.valuePattern?.test(section.heading) === true) {
        return { anchor: anchors[index], index };
      }
      if (slice === undefined && section.heading.startsWith(anchors[index])) {
        return { anchor: anchors[index], index };
      }
    }
    return null;
  }
}

/** continuity — numbered surfaces are 1-indexed and contiguous. */
export class ContinuityInvariant extends Invariant {
  readonly name = "continuity";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey === "plan") return this.taskContinuity(ctx);
    if (ctx.docKey === "phase-spec") return this.groupContinuity(ctx);
    return [];
  }

  /** Plan task ids must be exactly 1..N. */
  private taskContinuity(ctx: JudgeContext): FindingDraft[] {
    const blocks = ctx.tree.tasks();
    if (blocks.length === 0) return [];
    const findings: FindingDraft[] = [];
    blocks.forEach((block, index) => {
      const expected = index + 1;
      if (block.id !== expected) {
        findings.push(
          this.finding(
            ctx,
            `Task ${block.id}`,
            `task numbering is not contiguous from 1 (task ${block.id} at position ${index + 1})`,
            "renumber the tasks so they run exactly 1..N without gaps or duplicates",
          ),
        );
      }
    });
    return findings;
  }

  /** Phase-spec design groups (and their items) must be 1-indexed and contiguous. */
  private groupContinuity(ctx: JudgeContext): FindingDraft[] {
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
      if (item.number !== `${groupNumber}.${index + 1}`) {
        findings.push(
          this.finding(
            ctx,
            "#### N.M item heading",
            `design item numbering drifts within group ${groupNumber} (item ${item.number} at position ${index + 1})`,
            "renumber the items within each group so they run N.1..N.M",
          ),
        );
      }
    });
  }
}

/** residue — conditional content leaves zero residue when its condition does not hold. */
export class ResidueInvariant extends Invariant {
  readonly name = "residue";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    const elements = this.elementsOf(ctx);
    let owner: string | null = null;
    for (const element of elements) {
      if (element.home === "conditional" && element.anchor.startsWith("## ")) {
        owner = element.anchor;
        continue;
      }
      if (element.home !== "conditional" || owner === null) continue;
      const slice = this.sliceOf(ctx, element.anchor);
      if (slice === undefined || slice.valuePattern === undefined) continue;
      if (this.occurrenceNodes(ctx, owner).length > 0) continue; // the condition holds
      const leaked = this.occurrenceNodes(ctx, element.anchor).length;
      if (leaked > 0) {
        findings.push(
          this.finding(
            ctx,
            element.anchor,
            `conditional residue: ${element.anchor} content appears while ${owner} is absent`,
            `remove the ${element.anchor} content or add the ${owner} section`,
          ),
        );
      }
    }
    return findings;
  }
}

/** hollow — a structural surface that is present but carries no content. */
export class HollowInvariant extends Invariant {
  readonly name = "hollow";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings = [...this.tableHollow(ctx), ...this.taskHollow(ctx), ...this.designHollow(ctx)];
    return findings;
  }

  /** The overall's three tables: a present table section with zero data rows is hollow. */
  private tableHollow(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "overall") return [];
    const findings: FindingDraft[] = [];
    for (const anchor of this.overallTableHeadings(ctx)) {
      const headings = this.occurrenceNodes(ctx, anchor);
      if (headings.length === 0) continue;
      const section = headings[0];
      if (section === undefined) continue;
      const table = ctx.tree.tableUnder(section.text);
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

  /** A task block that carries no keyed fields is a hollow shell. */
  private taskHollow(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const findings: FindingDraft[] = [];
    for (const block of ctx.tree.tasks()) {
      if (block.fields.length === 0) {
        findings.push(
          this.finding(
            ctx,
            `Task ${block.id}`,
            `task ${block.id} is a hollow shell — the block carries no fields`,
            "fill the task block with its Object/Files/Consumes/Produces/Steps/Acceptance/DependsOn fields or delete it",
          ),
        );
      }
    }
    return findings;
  }

  /** The phase-spec skeleton: a present Design with no groups (or an empty conditional section). */
  private designHollow(ctx: JudgeContext): FindingDraft[] {
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
      if (bodyCount === 0) {
        findings.push(
          this.finding(
            ctx,
            section.heading,
            `${section.heading} section is hollow — the heading carries no content`,
            "add the section's content or remove the empty section",
          ),
        );
      }
    }
    return findings;
  }
}

/** front-matter-version-in-lineage — the head `version:` appears in the doc's lineage.
 *  The ONE lineage judgment (P21 §3.1): the header value must occur somewhere among
 *  the Change-history row versions. Absence is the only violation — the direction,
 *  the endpoints and the age of the row carrying the value are the author's
 *  presentation choice, never a judgment input (a newest-first lineage, a
 *  non-monotone frozen history and an ascending one all judge the same). The fix
 *  names the header key, never a row to reorder. Membership reads EVERY body row's
 *  anchored cell 0 (`membershipVersions`), so a version carried only by a
 *  shape-ragged row still counts as lineage. */
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

/** change-history-row-not-in-other-table — a change-history row stays in its table.
 *  Any table row OUTSIDE `## Change history` whose first cell carries a version
 *  token (`v1.2`) is a lineage row parked in the wrong table. */
export class RowHomeInvariant extends Invariant {
  readonly name = "change-history-row-not-in-other-table";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const section of ctx.parsed.sections) {
      const slice = this.sliceOf(ctx, "## Change history");
      if (slice?.valuePattern?.test(section.heading) === true) continue;
      const table = ctx.tree.tableUnder(section.heading);
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

/** list-marker-not-doubled — a list item carries exactly one leading marker.
 *  A bullet whose content starts with another bullet marker (`- - x`, `* + y`) is
 *  a doubled marker, not nested content. The read is the tree's `listItem` walk:
 *  an item whose first child is itself a list. A thematic break (`* * *` /
 *  `- - -` — a repeated `*` or `-` run) parses as a separator, never as a list
 *  item, so the tree exempts it by construction (`+` is not a thematic-break
 *  marker, so `+ + +` stays a doubled marker). */
export class ListMarkerInvariant extends Invariant {
  readonly name = "list-marker-not-doubled";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    return ctx.tree
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
// the six context-seam strategies
// ---------------------------------------------------------------------------

/** The chain-link target shape contract (D2, shape judged at the boundary — the #342
 *  fix): a link target must be a BARE relative path (the repo-root form
 *  `docs/kairos/overalls/…-overall.md` or a doc-relative file name) — never a
 *  markdown-link shell (`[label](path)`), a URL or a collation token
 *  (whitespace / parens / angle brackets). The ONE expression of the shape rule:
 *  `of()` yields either the accepted (trimmed) target or the reason the shape is
 *  invalid; the chain strategies judge the shape BEFORE any resolution, so a
 *  malformed fill reports the shape rule once — the confusing resolution cascade
 *  (#342's dead-tail `basename` + the file-existence double failure) never
 *  fires. */
export class LinkTargetShape {
  /** The accepted, trimmed target — null when the shape is invalid. */
  readonly target: string | null;
  /** The shape-rule reason the target is invalid — null when accepted. */
  readonly reason: string | null;

  private constructor(target: string | null, reason: string | null) {
    this.target = target;
    this.reason = reason;
  }

  /** Judge one raw target — a bare relative path accepts; any collation token
   *  rejects with the shape rule. */
  static of(raw: string): LinkTargetShape {
    const trimmed = raw.trim();
    // The rejected collation tokens — whitespace, a markdown-link shell's
    // brackets/parens (`[label](path)`), stray angle brackets and the `://`
    // URL scheme. The path separators `/` and `:` alone stay legal (a bare
    // relative path carries both) — only the URL-scheme pairing rejects.
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
      // D2: a malformed target is the link-shape face's call — the resolution
      // faces never feed it to the path resolution as a literal.
      if (shape.target === null) continue;
      if (!this.#targetExists(ctx, shape.target)) {
        findings.push(
          this.finding(
            ctx,
            source,
            `the chain link target does not resolve to an existing file: ${shape.target}`,
            `fix the link target (repo-root form ${DOC_ROOT_NAMESPACE}/... or a file-relative path)`,
          ),
        );
      }
    }
    return findings;
  }

  /** The chain links of the judged doc type — the overall's Phase-inventory cells.
   *  The doc-level chain keys (`program:` · the retired path keys) never appear
   *  here: a slug reference is not a path. */
  protected chainLinks(ctx: JudgeContext): readonly { source: string; link: ChainLink }[] {
    const links: { source: string; link: ChainLink }[] = [];
    if (ctx.docKey === "overall") {
      const data = this.record(ctx, "overall");
      if (data !== null) {
        for (const phase of data.chain.phases) {
          for (const link of this.linksOnLine(phase.designCell)) {
            links.push({ source: `Phase inventory · ${phase.id}`, link });
          }
          for (const link of this.linksOnLine(phase.planCell)) {
            links.push({ source: `Phase inventory · ${phase.id}`, link });
          }
        }
      }
    }
    // A plan carries no chain key (its chain is the same-slug identity document) and
    // the phase-spec's `program:` is a SLUG, not a path — neither feeds the
    // file-existence / sibling-scan / link-shape faces. The phase-spec reference is
    // judged by the `slug-ref` strategy.
    return links;
  }

  /** Whether the target exists — absolute targets directly; repo-root form first, the
   *  doc's own dir as the file-relative fallback. The resolution chain is
   *  single-sourced in `targetPath` (the ONE home of the link-space reading). */
  #targetExists(ctx: JudgeContext, target: string): boolean {
    return ctx.fs.exists(
      FileExistenceInvariant.targetPath(ctx.root, ctx.path, target, (p) => ctx.fs.exists(p)),
    );
  }

  /** The ONE chain-link target-resolution chain: an absolute target as itself; else
   *  the repoRoot-relative reading when it exists; else the doc-dir (file-relative)
   *  reading. `exists` is the caller's filesystem seam (the judgment's `ctx.fs`) —
   *  the resolution is the shared fact, the read is injected. When neither reading
   *  exists the doc-dir path is returned (the link-space semantic — the caller owns
   *  the truly-missing case). */
  static targetPath(
    root: string,
    docPath: string,
    target: string,
    exists: (path: string) => boolean,
  ): string {
    if (path.isAbsolute(target)) return target;
    const fromRoot = path.join(path.resolve(root), target);
    if (exists(fromRoot)) return fromRoot;
    return path.join(path.dirname(path.resolve(docPath)), target);
  }
}

/** link-shape — every chain link target of the doc is a bare relative path (D2 ·
 *  #342). The shape rule reports ONCE here (single-responsibility strategy — the
 *  shared `LinkTargetShape` declaration): a malformed fill (a markdown link, a
 *  URL or a collation token) is judged BEFORE any resolution, so the
 *  file-existence / sibling-scan resolution faces silently skip malformed
 *  targets — the confusing per-strategy cascade never fires. */
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
    for (const root of SiblingScanInvariant.#scanRoots(ctx.root, ctx.path)) {
      for (const entry of ctx.fs.list(root)) {
        if (entry.endsWith(".md")) baseline.add(entry);
      }
    }
    for (const { source, link } of this.chainLinks(ctx)) {
      if (this.isPlaceholder(link.target)) continue;
      const shape = LinkTargetShape.of(link.target);
      // D2: a malformed target is the link-shape face's call — the sibling face
      // never basenames a markdown shell (the dead-tail `…)` miss).
      if (shape.target === null) continue;
      const basename = path.basename(shape.target);
      if (!baseline.has(basename)) {
        findings.push(
          this.finding(
            ctx,
            source,
            `the cross-linked doc ${basename} is not a same-family sibling (not present in the sibling docs scan)`,
            `link to a sibling doc under the same ${DOC_ROOT_SEGMENTS} family`,
          ),
        );
      }
    }
    return findings;
  }

  /** The doc's own dir + the sibling doc-root dirs — the same-family scan roots,
   *  resolved on ONE basis (P9 T5 §2.8): the doc path and the doc roots
   *  (`ENGINE_RUNTIME.docRoots` segments) compose through `root` (the absolute
   *  basis) before they touch the filesystem — a relative string read without
   *  `root` would resolve against `process.cwd()` (the engine never chdirs),
   *  silently drifting off the repo root. `path.resolve(root, …)` reads an absolute
   *  doc path as itself and a repoRoot-relative one as joined to the basis (both
   *  callers — the pre-flight's absolute doc path and the judge's relative one — land
   *  on the same basis). The doc-root segments are read from the ONE declaration
   *  (never a hard-coded segment-name copy). */
  static #scanRoots(root: string, docPath: string): readonly string[] {
    return [
      path.dirname(path.resolve(root, docPath)),
      ...Object.values(ENGINE_DOC_ROOTS).map((dir) => path.join(root, dir)),
    ];
  }
}

/** phase-design-spec-is-phase-spec — a Phase-inventory row's Design-spec cell must
 *  point at a document declaring `doc-type: phase-spec` (§4.4: the belonging judgment
 *  made executable). A phase row registered in a program's ledger cannot borrow a
 *  bespoke `single-spec` as its design: either the design belongs to the program (and
 *  is therefore a phase-spec) or it belongs nowhere and the row must leave the
 *  inventory. The cell's link target resolves through the ONE link-space reading
 *  (`FileExistenceInvariant.targetPath`); the target document's front-matter
 *  `doc-type:` is the judged fact — a document declaring no doc-type at all fails
 *  the same "must declare phase-spec" shape. Present facts only: a cell with no
 *  single bare link target, a placeholder, or a target the seam cannot read is NOT
 *  judged — a missing file is `file-existence`'s call, never a doc-type
 *  contradiction. */
export class PhaseDesignSpecIsPhaseSpecInvariant extends Invariant {
  readonly name = "phase-design-spec-is-phase-spec";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "overall") return [];
    const data = this.record(ctx, "overall");
    if (data === null) return [];
    const findings: FindingDraft[] = [];
    for (const phase of data.chain.phases) {
      const docType = this.#targetDocType(ctx, phase.designCell);
      // `undefined` = not judged (no judgeable target); `null` = the target declares
      // no doc-type, which is red — the cell must point at a phase-spec.
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

  /** The one-line message — the row, the doc-type the target actually declares.
   *  A target declaring no doc-type reads as that absence, never as an empty value. */
  static #messageOf(phaseId: string, docType: string | null): string {
    const declared = docType === null ? "declares no doc-type" : `declares doc-type: ${docType}`;
    return `the Phase inventory row ${phaseId} points its Design spec at a document that ${declared} — a registered phase's design spec must be a phase-spec`;
  }

  /** The `doc-type:` the cell's single link target declares — `undefined` when the
   *  cell carries no judgeable target (no single link, a placeholder, a malformed
   *  target shape, or an unreadable document), null when the readable target
   *  declares no doc-type. */
  #targetDocType(ctx: JudgeContext, cell: string): string | null | undefined {
    const links = this.linksOnLine(cell);
    if (links.length !== 1) return undefined;
    const shape = LinkTargetShape.of(links[0].target);
    if (shape.target === null || this.isPlaceholder(shape.target)) return undefined;
    const resolved = FileExistenceInvariant.targetPath(ctx.root, ctx.path, shape.target, (p) =>
      ctx.fs.exists(p),
    );
    const content = ctx.fs.read(resolved);
    if (content === null) return undefined;
    return FrontMatterExtractor.split(content).head.docType;
  }
}

/** slug-ref — a `slug-ref` value names an on-disk identity document by `slug:`
 *  (the phase-spec's `program:` → an overall). The value is a SLUG, never a path,
 *  so this face judges it by identity lookup alone (zero path resolution, zero
 *  filename derivation); the skeleton's placeholder forms ride the shared
 *  `isPlaceholder` exemption so a freshly rendered document is never blocked by the
 *  hard gate its own skeleton emitted. */
export class SlugRefInvariant extends Invariant {
  readonly name = "slug-ref";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const element of this.elementsOf(ctx)) {
      if (element.refKind !== "slug-ref" || element.home !== "frontmatter") continue;
      const value = ctx.head.value(element.anchor);
      if (value === null || this.isPlaceholder(value)) continue;
      if (this.#resolves(ctx, value)) continue;
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

  /** Whether the reference resolves — a `slug-ref` value names an on-disk document
   *  by its `slug:`, never by a path. The registry declares exactly ONE slug-ref
   *  key (`program`), whose target class is the overall, so the lookup is the
   *  identity index's overall read. A second slug-ref key would have to carry its
   *  target class into this resolution. */
  #resolves(ctx: JudgeContext, value: string): boolean {
    return this.indexOf(ctx).overallOf(value) !== null;
  }
}

/** cross-doc-chain — the identity chain resolves and its lineage tokens belong to the
 *  program the document names. The chain is expressed in identity keys only: a plan
 *  is chained to the identity document sharing its `slug:` (Class-A), and a
 *  phase-spec is chained to the overall its `program:` names (the `slug-ref`
 *  strategy judges that reference resolves; this strategy judges its lineage). */
export class CrossDocChainInvariant extends Invariant {
  readonly name = "cross-doc-chain";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey === "overall") return this.overallChain(ctx);
    if (ctx.docKey === "plan") return this.planChain(ctx);
    return this.specChain(ctx);
  }

  /** The overall chain-root face: a dispatch phase must be registered in the inventory. */
  private overallChain(ctx: JudgeContext): FindingDraft[] {
    if (ctx.phaseId === undefined || ctx.phaseId === null) return [];
    const data = this.record(ctx, "overall");
    if (data === null) return [];
    const registered = new Set(data.chain.phases.map((phase) => phase.id.toLowerCase()));
    if (!registered.has(ctx.phaseId.toLowerCase())) {
      return [
        this.finding(
          ctx,
          "Phase inventory",
          `dispatch phase ${ctx.phaseId} is not registered in the parent overall's Phase inventory`,
          `register phase ${ctx.phaseId} in the Phase inventory`,
        ),
      ];
    }
    return [];
  }

  /** The plan chain face (Class-A) — the plan's identity chain is the identity
   *  document sharing its `slug:`: a plan with no same-slug identity document has
   *  no design spec to dispatch against, and the finding names the `slug` key (the
   *  identity fact that is missing its pair). The positive half is any identity
   *  document (overall / phase-spec / single-spec) carrying the same slug — a
   *  single-spec pair carries no program, so the chain simply ends there. */
  private planChain(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const slug = ctx.head.slug;
    // A placeholder or missing slug is presence's surface, never this arm's.
    if (slug === null || this.isPlaceholder(slug)) return [];
    const index = this.indexOf(ctx);
    // An identity question, never a first pick: n ≥ 1 is an identity (two of them are
    // `duplicate-identity`'s judgment), so the chain never claims "no identity document"
    // over an ambiguous set.
    if (index.hasIdentity(slug)) return [];
    // The SAME discarded-candidate counts the plan read's tri-state reads (§2.7): a doc
    // root that dropped a candidate, or indexed one without a registered doc type,
    // cannot answer an absence — the index's silence is not the disk's. This is the
    // undecided arm, and it produces ZERO findings (zero refusal, like §2.7 (c)).
    if (!index.docRootsClean()) return [];
    return [
      this.finding(
        ctx,
        "slug",
        `the plan carries no identity document with the same slug: ${slug}`,
        `add a spec document declaring slug: ${slug} (its doc-type is overall / phase-spec / single-spec)`,
      ),
    ];
  }

  /** The phase-spec chain face — the `program:` reference's lineage tokens must
   *  belong to the overall it names. The reference's own resolution (the slug
   *  naming an on-disk overall) is the `slug-ref` strategy's judgment; this arm
   *  only judges the version facts once the target is resolved. */
  private specChain(ctx: JudgeContext): FindingDraft[] {
    const data = this.record(ctx, "phase-spec");
    if (data === null) return [];
    const findings: FindingDraft[] = [];
    const programLink = data.chain.programLink;
    if (programLink === null) return findings;
    const program = this.#overallOf(ctx, programLink.target);
    if (program === null) return findings;
    const lineage = this.#parentLineage(ctx, program);
    if (lineage === null) return findings;
    for (const token of data.chain.parentTokens) {
      if (!lineage.has(token)) {
        findings.push(
          this.finding(
            ctx,
            "program",
            `the parent-version token ${token} does not belong to the program's lineage: ${programLink.target}`,
            `use a version the program overall declares (its version front-matter or a Change-history row): ${[...lineage].join(", ")}`,
          ),
        );
      }
    }
    return findings;
  }

  /** The overall document carrying the program slug, or null. */
  #overallOf(ctx: JudgeContext, slug: string): DocEntry | null {
    return this.indexOf(ctx).overallOf(slug);
  }

  /** The program overall's lineage: its head `version:` scalar + every
   *  Change-history row version (the T6 read point — the header fact rides the
   *  typed head record, never a body line scan). The overall parses through the
   *  SAME row source the judged document went through (split → canonicalize →
   *  parse), so an alias-registered table heading reads identically in both faces.
   *  null when the parent is unreadable: a parent the seam cannot read is never
   *  evidence that a version token is foreign (that absence belongs to the
   *  slug-ref face's resolution). */
  #parentLineage(ctx: JudgeContext, entry: DocEntry): Set<string> | null {
    const content = ctx.fs.read(entry.path);
    if (content === null) return null;
    const { head, lines } = new RowSource(ctx.translator).read(content);
    const parsed = docTypeParsers.overall.parse(lines, head) as OverallParsed;
    const lineage = new Set<string>();
    if (head.version !== null) lineage.add(head.version);
    for (const row of parsed.tables["Change history"].rows) {
      const match = row[0]?.match(/v\d+\.\d+/);
      if (match !== null) lineage.add(match[0]);
    }
    return lineage;
  }
}

/** section-scoped-domain — a value shape is enforced only inside its owning section. */
export class SectionScopedDomainInvariant extends Invariant {
  readonly name = "section-scoped-domain";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey === "overall") return this.issueScopedRefs(ctx);
    if (ctx.docKey === "phase-spec") return this.designScoping(ctx);
    return [];
  }

  /** Issue-ref forms are judged only within `## Issue inventory` (a content-wide rule
   *  would misfire on legacy `## Requirement inventory` tables whose ref cells are prose). */
  private issueScopedRefs(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "overall") return [];
    const slice = this.sliceOf(ctx, "Issue ref cell");
    if (slice?.valuePattern === undefined) return [];
    const findings: FindingDraft[] = [];
    const issueHead = this.occurrenceNodes(ctx, "## Issue inventory")[0];
    const table = issueHead === undefined ? null : ctx.tree.tableUnder(issueHead.text);
    for (const row of table?.body ?? []) {
      const ref = row[1]?.trim() ?? "";
      if (ref === "" || ref.toLowerCase() === "none") continue;
      if (!slice.valuePattern.test(ref)) {
        findings.push(
          this.finding(
            ctx,
            "Issue inventory",
            `issue ref inside Issue inventory is outside its declared domain: ${ref}`,
            "use the anchored `#NNN#issuecomment-<digits>` / bare `#NNN` / `[#NNN]` / `none` or a parenthetical note",
          ),
        );
      }
    }
    return findings;
  }

  /** `### N.` design-group headings may appear only inside `## Design`. */
  private designScoping(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "phase-spec") return [];
    const element = this.elementOf(ctx, "### N. group heading");
    if (element === undefined || element.valuePattern === undefined) return [];
    const design = this.occurrenceNodes(ctx, "## Design")[0];
    const section = ctx.tree.sections().find((entry) => entry.line === design?.line);
    const findings: FindingDraft[] = [];
    for (const heading of ctx.tree.headings()) {
      if (!ctx.tree.matches(element.selector, heading.text)) continue;
      // A group heading inside the Design section is the surface's own content; the
      // finding is the heading that sits OUTSIDE it.
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
// the wave-width rule (P22 §6)
// ---------------------------------------------------------------------------

/**
 * wave-width-at-most-three — the plan-scope preventive rule: no DependsOn layer of the
 * plan may carry more than `MAX_TASKS_PER_WAVE` tasks (design spec §6, judgment face
 * one). The layers arrive READY-MADE through `ctx.taskLayers` — the caller injects
 * `TaskGraph#batches()`, the single derivation authority. This rule therefore never
 * re-derives batches from `parsed.taskBlocks` and never imports the session plane.
 *
 * A missing layer fact (a call site with no plan graph) yields ZERO findings: the
 * degradation is visible on the caller's checked row, never turned into a refusal (the
 * same present-facts-only stance as a skipped ledger row). The dispatch path always
 * runs the graph gate first, so the degraded reading only occurs off the dispatch face.
 */
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

/** single-create — one path is CREATED once, and its `Create:` row comes before every
 *  other declaring row (P42 §1.2). The judgment needs two answers the `Files` reader
 *  keeps apart: the VERB face says what a row's label states, and the CLAIM face says
 *  whether the row declares its path at all. A `Test:` row is a verb the vocabulary
 *  knows without claiming, and an out-of-vocabulary `Add:` / `修改` spelling claims
 *  through its own closed label set — so two spellings of one defect get one verdict
 *  instead of one being read as prose.
 *
 *  The rule reads the declaration SET, never a line count: a path declared twice on one
 *  row is one declaration, a path restated as `Modify:` after its `Create:` is the
 *  normal increment, and only two states are refused — more than one `Create:` row, and a
 *  `Create:` row that sits after a task which already declared the path. */
export class SingleCreateInvariant extends Invariant {
  readonly name = "single-create";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (ctx.docKey !== "plan") return [];
    const findings: FindingDraft[] = [];
    for (const [path, tasks] of this.#claimSets(ctx)) {
      findings.push(...this.#judgePath(ctx, path, tasks));
    }
    return findings;
  }

  /** Every claimed path of the plan, mapped to the tasks that claim it — with `true` on
   *  the tasks whose row carries the canonical `Create:` verb. A path is counted once per
   *  task: an inline restatement of the same row is one declaration. Tokens outside the
   *  path shape (`<slug>`, a bare word, a `#`-member) name no file and claim nothing. */
  #claimSets(ctx: JudgeContext): ReadonlyMap<string, ReadonlyMap<number, boolean>> {
    const reader = new PlanTaskBlocksReader();
    const paths = new Map<string, Map<number, boolean>>();
    for (const block of ctx.tree.tasks()) {
      for (const declaration of reader.fileDeclarationsOf(block)) {
        if (declaration.claim === "none") continue;
        if (PinVocabulary.pathOf(declaration.path) === null) continue;
        const tasks = paths.get(declaration.path) ?? new Map<number, boolean>();
        tasks.set(block.id, (tasks.get(block.id) ?? false) || declaration.verb === "create");
        paths.set(declaration.path, tasks);
      }
    }
    return paths;
  }

  /** One path's verdict — the canonical `Create:` rows against every earlier declaring
   *  task. Only the `Create:` spelling counts as a creating row: an `Add:` claim makes a
   *  later `Create:` late, but two `Add:` rows never claim to have created anything. */
  #judgePath(
    ctx: JudgeContext,
    path: string,
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
          `the Create: declaration for ${path} appears in tasks ${creates.join(", ")}`,
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
        `task ${owner} declares Create: ${path}, after ${earlier.map((task) => `task ${task}`).join(", ")} already declared it`,
        "move the Create: row to the first task that claims the path, and let later tasks declare Modify:",
      ),
    ];
  }
}

// ---------------------------------------------------------------------------
// the shape-gate family (P41 §1.2 · §1.5 · §3.1)
// ---------------------------------------------------------------------------

/** The closed measurement-unit set of the `measure-literal` grammar (§1.2). A count
 *  unit is a WORD: a bare integer beside one of these states a measurement in prose.
 *  The closed set IS the grammar — a unit outside it is not a judgment. */
const MEASURE_UNITS = ["passed", "failed", "tests", "files", "rows", "行", "处", "条"] as const;

/** The `measure-literal` token grammar — an independent decimal integer, one space,
 *  one word of the closed unit set. "Independent" is the three lookarounds: a decimal's
 *  fractional part and the number inside a dotted id are not integers; "word" is the
 *  right lookahead, which also refuses a Chinese unit embedded in a longer compound;
 *  and an integer behind `第` is not a count at all — `第 N 行` is the `line-coordinate`
 *  row's own shape, and `行` is in the unit set, so without that lookbehind one
 *  coordinate would be refused twice and the second refusal would blame "a bare
 *  measurement" for it. One fact, one rule. */
const MEASURE_LITERAL = new RegExp(
  `(?<!第\\s{0,2})(?<![\\w.])\\d+ (?:${MEASURE_UNITS.join("|")})(?![\\w\\u4e00-\\u9fff])`,
  "g",
);

/** The three `line-coordinate` shapes (§1.2): `第 N 行` · `line N` · a path followed
 *  by `:N`. The third shape requires at least one LETTER before its colon: a file name
 *  carries one, a decimal ratio (`4.5:1`) does not — the colon alone does not make a
 *  coordinate, so a ratio is prose rather than a misreported line. */
const LINE_COORDINATES: readonly RegExp[] = [
  /第\s*\d+\s*行/g,
  /\blines?\s+\d+/gi,
  /(?=[\w./-]*[A-Za-z])[\w./-]+\.\w+:\d+/g,
];

/** The `live-arithmetic` token grammar (§1.2) — integer, optional spaces, one operator
 *  glyph of the closed set (`−` U+2212 · `-` ASCII · `–` en dash, all one verdict),
 *  optional spaces, integer, `=`, integer. Where the operands come from is NOT part of
 *  the grammar: the shape alone is the violation. */
const LIVE_ARITHMETIC = /(?<![\w.])\d+\s*[−–-]\s*\d+\s*=\s*\d+(?![\w.])/g;

/** The `temporal-indicator` closed set (§1.2) — the words that state the tree as it
 *  stands. The word alone is not a violation; the clause must also carry a symbol. */
const TEMPORAL = /\btoday\b|\bcurrently\b|今天|今日|仍/i;

/** The clause delimiters of the `temporal-indicator` mount grammar (§1.2). A clause
 *  ends at a Chinese comma / semicolon / full stop / middle dot, or at a DOUBLE em
 *  dash: a single `—` is not a delimiter, so a loose `—+` reading is never admissible. */
const CLAUSE_DELIMITERS = "，；。·";

/** One prose line of a document body — the shared line read of the shape grammars and
 *  the sentence index (one line face, so a fence and a code span are judged once). */
export interface ProseLine {
  /** The 1-based line number in the source text (fence lines still count). */
  readonly line: number;
  /** The line verbatim — the symbol-candidate read face. */
  readonly raw: string;
  /** The same line with every inline code span blanked — the token-grammar read face,
   *  so a claim quoted in a code span is a citation and never a violation. */
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
 * ProseLines — the prose-line split of one document body (P41 §1.2): the lines a
 * shape grammar can judge. Fenced lines never arrive (the fence state is `PinSpans`'s
 * one judgment — this class holds no second copy), and each returned line carries both
 * read faces: the verbatim text and the same line with its inline code spans stripped
 * to equal-width blanks, so the column positions survive. The heading-stack walk and
 * the sentence index advance along THIS read — one split, both families.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the prose-line split is a declared static reader set — the repo's zero-bare-function discipline admits no standalone splitter.
export class ProseLines {
  /** The prose lines of one body with both read faces — the ONE line read of the shape
   *  grammars and the sentence index. */
  static of(content: string): readonly ProseLine[] {
    return PinSpans.proseEntriesOf(content).map((entry) => ({
      line: entry.line,
      raw: entry.text,
      blanked: PinSpans.blankedOf(entry.text),
    }));
  }

  /** Whether a line opens a block quote — the ONE quote-form judgment (§3.1), read on
   *  the line's shape (a `>` opener), never on a tree node: the tree exposes no quote
   *  walk. */
  static isQuoted(line: string): boolean {
    return /^\s*>/.test(line);
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: the heading-stack prose walk is a declared static reader set — the repo's zero-bare-function discipline admits no standalone walker.
class ProseWalk {
  /** Every non-blank prose line of the judged body with its face role — the ONE
   *  heading-stack advance behind the four shape grammars and the shared sentence
   *  read. The stack keeps headings outermost-first; `FaceMap.roleOf` receives it
   *  innermost-first, so a `#### 7.5.1` item inherits the role of the `### 7.` group
   *  above it. */
  static of(ctx: JudgeContext): readonly ProseLineRecord[] {
    const records: ProseLineRecord[] = [];
    const stack: string[] = [];
    for (const entry of ProseLines.of(ctx.text)) {
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
  /** The shared evaluation frame of the four shape grammars: only a DECISION-face line
   *  is judged. A line whose heading the map cannot place is not a token question — it
   *  is the map's own gap, reported once by `gaps()`. */
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

  /** The gap verdict — ONE finding per heading the map cannot place (the `unmapped`
   *  face cannot be judged for a token, so the gap itself is the verdict, never a
   *  silence). It is produced by the family's first row alone: the gap is a property of
   *  the face, so the same gap under four grammars must not report four times, and the
   *  reporting row has to be a declared one — a kind no declaration owns would leave the
   *  `checked:` face with a finding no row accounts for. */
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

  /** The finding field of a walked line — the heading it sits under, or the document
   *  head when no heading places it. */
  static fieldOf(record: ProseLineRecord): string {
    return record.heading === "" ? "(document head)" : record.heading;
  }
}

/** measure-literal — the decision face states no bare count (P41 §1.2). A count is
 *  legal in exactly one form: a `census:<id> = <n>` reference, supplied by the census
 *  registry and compared by `CensusGate`. The grammar is a token shape, never a
 *  semantic class: the gate has no classifier for "is this claim about the live
 *  tree", so the shape itself is the judgment. */
export class MeasureLiteralInvariant extends Invariant {
  readonly name = "measure-literal";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    // The family's first row owns the map's gap verdict (one gap, one finding — see
    // `ProseFace.gaps`), so the other three grammars judge the decision face alone.
    return [
      ...ProseFace.gaps(ctx, this.name),
      ...ProseFace.judge(ctx, (record) => this.#literalsOf(ctx, record)),
    ];
  }

  /** The bare literals of one decision-face line — a `census` reference's own number
   *  is the reference, not a bare count (the span read rides `CensusGate`'s grammar). */
  #literalsOf(ctx: JudgeContext, record: ProseLineRecord): FindingDraft[] {
    const findings: FindingDraft[] = [];
    const references = MeasureLiteralInvariant.#referenceSpans(record.blanked, ctx.path);
    for (const match of record.blanked.matchAll(MEASURE_LITERAL)) {
      const at = match.index ?? 0;
      // The integer's POSITION is the read: a unit written right after a census
      // reference's number still belongs to that reference.
      if (references.some((span) => at >= span.from && at < span.to)) continue;
      findings.push(
        this.finding(
          ctx,
          ProseFace.fieldOf(record),
          `the decision face states a bare measurement: ${match[0]}`,
          "state the count as census:<id> = <n> (the census registry supplies the value) or drop the number",
        ),
      );
    }
    return findings;
  }

  /** The `census:<id> = <n>` spans of one line — read through the gate's own reference
   *  grammar, so an illegal form is prose about the form and carries no span. */
  static #referenceSpans(line: string, source: string): readonly { from: number; to: number }[] {
    const spans: { from: number; to: number }[] = [];
    let cursor = 0;
    for (const reference of CensusGate.referencesOf(line, source)) {
      const at = line.indexOf(reference.text, cursor);
      if (at === -1) continue;
      spans.push({ from: at, to: at + reference.text.length });
      cursor = at + reference.text.length;
    }
    return spans;
  }
}

/** line-coordinate — the decision face cites no line number (P41 §1.2). A claim
 *  cites a module path plus a symbol name; a line coordinate is not a pin. */
export class LineCoordinateInvariant extends Invariant {
  readonly name = "line-coordinate";

  evaluate(ctx: JudgeContext): FindingDraft[] {
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

/** live-arithmetic — the decision face states no arithmetic over counts (P41 §1.2).
 *  The rule is a token grammar, not a semantic one: the operands' provenance is absent
 *  from it, and the three operator glyphs carry one verdict. */
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

/** temporal-indicator — the decision face states no present-tense description of the
 *  tree as it stands (P41 §1.2). The mount is a grammar: the indicator alone is not a
 *  violation, the clause must also carry a symbol candidate (an inline code span or a
 *  bare token carrying `/`, `.` or `#`), so an isolated adverb is never misread. */
export class TemporalIndicatorInvariant extends Invariant {
  readonly name = "temporal-indicator";

  evaluate(ctx: JudgeContext): FindingDraft[] {
    return ProseFace.judge(ctx, (record) => this.#clausesOf(ctx, record));
  }

  /** The clauses of one line that both carry an indicator and mount it on a symbol. */
  #clausesOf(ctx: JudgeContext, record: ProseLineRecord): FindingDraft[] {
    const findings: FindingDraft[] = [];
    for (const clause of TemporalIndicatorInvariant.#clauses(record)) {
      if (!TEMPORAL.test(clause.blanked)) continue;
      if (!TemporalIndicatorInvariant.#hasSymbol(clause)) continue;
      findings.push(
        this.finding(
          ctx,
          ProseFace.fieldOf(record),
          `the decision face states the tree as it stands: ${clause.raw.trim()}`,
          "restate the clause as the condition that must hold",
        ),
      );
    }
    return findings;
  }

  /** The clause split of one line — the offsets come off the BLANKED read (so a
   *  delimiter quoted in a code span never splits) and slice the raw line, which keeps
   *  the code span available as a symbol candidate. */
  static #clauses(record: ProseLineRecord): readonly { blanked: string; raw: string }[] {
    const clauses: { blanked: string; raw: string }[] = [];
    let from = 0;
    let at = 0;
    while (at < record.blanked.length) {
      const pair = record.blanked.startsWith("——", at);
      if (!pair && !CLAUSE_DELIMITERS.includes(record.blanked[at] ?? "")) {
        at += 1;
        continue;
      }
      clauses.push({
        blanked: record.blanked.slice(from, at),
        raw: record.raw.slice(from, at),
      });
      at += pair ? 2 : 1;
      from = at;
    }
    clauses.push({ blanked: record.blanked.slice(from), raw: record.raw.slice(from) });
    return clauses;
  }

  /** Whether a clause carries a symbol candidate — an inline code span, or a bare token
   *  carrying a path separator, a fragment marker or an internal dot. */
  static #hasSymbol(clause: { blanked: string; raw: string }): boolean {
    if (PinSpans.blankedOf(clause.raw) !== clause.raw) return true;
    for (const token of clause.blanked.split(/[\s，；。·、：！？!?()（）「」『』【】"'`]+/)) {
      if (token === "") continue;
      if (token.includes("/") || token.includes("#")) return true;
      if (/\w\.\w/.test(token)) return true;
    }
    return false;
  }
}

/** change-history-date-shape — the Change-history date cell is an ISO date (P41
 *  §1.5). The registry's `Change history date` element declares the pattern, and its
 *  selector matches on that same pattern — so a violation never reaches the selector
 *  and `DomainInvariant` can never report it. This rule judges the cell directly, and
 *  the element's `valuePattern` stays the ONE source of the value shape. */
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

/**
 * SentenceIndex — the sentence split and comparison faces of `single-home` (P41 §3.1):
 * one normalized sentence per unit, the character 3-gram set of a sentence, and the
 * Jaccard similarity of two such sets. The split reads prose only: fenced lines never
 * arrive (`PinSpans`'s one fence judgment), a quoted line is exempt (`ProseLines`'s one
 * quote-form judgment), and a work item yields no sentence at all (a plan's `- Modify:`
 * line names a location, never a criterion). A table row and a list item are each ONE
 * sentence — a cell is never its own claim.
 *
 * Two lengths ride every sentence, because the rule reads two: `text` is the WHOLE
 * normalized sentence (the 3-gram comparison's face) and `prose` is its normalized
 * length AFTER the inline code spans are removed — the length floor's face, so a
 * sentence that only points at a path never becomes a compared criterion.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the sentence split is a declared static reader set — the repo's zero-bare-function discipline admits no standalone splitter.
export class SentenceIndex {
  /** The normalized-length floor a compared sentence's PROSE must clear (§3.1). */
  static readonly MIN_LENGTH = 40;
  /** The 3-gram Jaccard threshold at which two sentences state the same criterion. */
  static readonly THRESHOLD = 0.6;

  /** Whether a line is a WORK ITEM — a list marker followed by one of the four declared
   *  declaration verbs (§3.1). `- Modify: <path>` normalizes to the same ~58-character
   *  sentence in every plan, so comparing it would judge the template dead; both
   *  domains split through `of`, so both skip it here and nowhere else. */
  static isWorkItem(line: string): boolean {
    return /^\s*(?:[-*+]|\d+\.)\s+(?:Modify|Create|Test|Delete):/.test(line);
  }

  /** The normalized sentences of one BODY text (front matter excluded) with the line
   *  each starts on and its prose length. `from` offsets every line number onto the
   *  FILE coordinate of a foreign document — the number a reader navigates by. */
  static of(
    content: string,
    from = 0,
  ): readonly { readonly text: string; readonly prose: number; readonly line: number }[] {
    const sentences: { text: string; prose: number; line: number }[] = [];
    for (const entry of ProseLines.of(content)) {
      if (ProseLines.isQuoted(entry.raw)) continue;
      if (SentenceIndex.isWorkItem(entry.raw)) continue;
      for (const unit of SentenceIndex.#unitsOf(entry.raw)) {
        const text = SentenceIndex.#normalize(unit);
        if (text === "") continue;
        sentences.push({
          text,
          prose: SentenceIndex.#normalize(PinSpans.blankedOf(unit)).length,
          line: entry.line + from,
        });
      }
    }
    return sentences;
  }

  /** The character 3-grams of one normalized sentence. */
  static trigrams(text: string): ReadonlySet<string> {
    const grams = new Set<string>();
    for (let at = 0; at + 3 <= text.length; at += 1) grams.add(text.slice(at, at + 3));
    return grams;
  }

  /** The Jaccard similarity of two gram sets — 0 when either side is empty. */
  static jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let shared = 0;
    for (const gram of a) if (b.has(gram)) shared += 1;
    return shared / (a.size + b.size - shared);
  }

  /** Whether two gram sets state the same criterion — the threshold read, and a cheaper
   *  one than a full `jaccard` on an UNRELATED pair: the shared count a `THRESHOLD`
   *  Jaccard needs follows from the two sizes alone (`shared >= t(a+b)/(1+t)`), so the
   *  scan stops as soon as the grams left cannot reach it. The threshold itself stays
   *  the one declared constant. */
  static sameCriterion(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
    if (a.size === 0 || b.size === 0) return false;
    const small = a.size <= b.size ? a : b;
    const large = a.size <= b.size ? b : a;
    const required = Math.ceil(
      (SentenceIndex.THRESHOLD * (small.size + large.size)) / (1 + SentenceIndex.THRESHOLD) -
        // The threshold is a float, so an exactly-on-the-line pair can land a hair above
        // its integer requirement; the tolerance keeps `≥ THRESHOLD` meaning `≥`.
        1e-9,
    );
    if (small.size < required) return false;
    let shared = 0;
    let seen = 0;
    for (const gram of small) {
      seen += 1;
      if (large.has(gram)) shared += 1;
      if (shared + (small.size - seen) < required) return false;
    }
    return shared >= required;
  }

  /** The sentence units of one prose line — a table row and a list item are one
   *  sentence; any other line splits at `。` `！` `？` `!` `?` and at a `.` a space
   *  follows. The terminator offsets come off the BLANKED read, so a terminator quoted
   *  in a code span never splits the sentence. */
  static #unitsOf(line: string): readonly string[] {
    if (/^\s*\|/.test(line)) return [line];
    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) return [line];
    const blind = PinSpans.blankedOf(line);
    const units: string[] = [];
    let from = 0;
    for (let at = 0; at < blind.length; at += 1) {
      const char = blind[at] ?? "";
      const terminal =
        char === "。" ||
        char === "！" ||
        char === "？" ||
        char === "!" ||
        char === "?" ||
        (char === "." && /\s/.test(blind[at + 1] ?? " "));
      if (!terminal) continue;
      units.push(line.slice(from, at));
      from = at + 1;
    }
    units.push(line.slice(from));
    return units;
  }

  /** The comparison form: inline-code markers dropped (the span's text stays),
   *  whitespace folded, case folded, punctuation dropped. */
  static #normalize(text: string): string {
    return text
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
}

/**
 * single-home — one criterion lives in one document (P41 §3.2). The left domain is the
 * judged document's decision face; the right domain is every other document under the
 * three doc roots EXCEPT this file and its same-slug siblings (a design's spec and plan
 * are the two faces of one document, and a plan's Acceptance is the checkable form of
 * its spec's criteria). The right domain is NOT filtered by closure: a closed document
 * is still a place a criterion may have been copied into. Two sentences state the same
 * criterion at a 3-gram Jaccard of `SentenceIndex.THRESHOLD` with both sides at least
 * `SentenceIndex.MIN_LENGTH` normalized characters long — the rule catches copying, not
 * paraphrase.
 */
export class SingleHomeInvariant extends Invariant {
  readonly name = "single-home";

  /** The right-domain corpus, per workspace root — built ONCE per instance. A corpus
   *  sweep judges every document against every other one, so listing, reading and
   *  front-matter-parsing the neighbours on each judgment would make the sweep quadratic
   *  in FILE READS, not just in comparisons. Instance state, never module state. */
  readonly #domains = new Map<string, readonly NeighbourDocument[]>();

  evaluate(ctx: JudgeContext): FindingDraft[] {
    const left = this.#decisionSentences(ctx);
    if (left.length === 0) return [];
    const self = path.resolve(ctx.root, ctx.path);
    const slug = ctx.head.slug;
    const findings: FindingDraft[] = [];
    const reported = new Set<string>();
    for (const neighbour of this.#domainOf(ctx)) {
      if (neighbour.absolute === self) continue;
      if (slug !== null && neighbour.slug === slug) continue;
      for (const own of left) {
        const home = SingleHomeInvariant.#matchOf(own, neighbour);
        if (home === null) continue;
        const key = `${neighbour.path}\u0000${own.text}`;
        if (reported.has(key)) continue;
        reported.add(key);
        findings.push(
          this.finding(
            ctx,
            "Sentence",
            `the criterion at "${SingleHomeInvariant.#openingOf(own.text)}" is also stated in ${neighbour.path} at "${SingleHomeInvariant.#openingOf(home.text)}" (line ${home.line})`,
            "keep the criterion in one document and point at its holder from the other — a repeated criterion drifts twice",
          ),
        );
      }
    }
    return findings;
  }

  /** The judged document's decision-face sentences whose PROSE clears the length floor
   *  — the left domain. The face facts come from the SAME heading-stack walk the shape
   *  rules read, joined by line number (both are body coordinates, so the join holds). */
  #decisionSentences(ctx: JudgeContext): readonly SentenceIndexedSentence[] {
    const face = new Map<number, DocFace | "unmapped">(
      ProseWalk.of(ctx).map((record) => [record.line, record.role]),
    );
    return SentenceIndex.of(ctx.text)
      .filter((sentence) => sentence.prose >= SentenceIndex.MIN_LENGTH)
      .filter((sentence) => face.get(sentence.line) === "decision")
      .map((sentence) => ({
        text: sentence.text,
        line: sentence.line,
        grams: SentenceIndex.trigrams(sentence.text),
      }));
  }

  /** The right domain of one workspace root — every readable document under the three doc
   *  roots. The self file and the same-slug siblings are filtered per judgment, never
   *  here: the corpus is shared by every document the instance judges. Closure is
   *  deliberately NOT read: a closed document is still a place a criterion was copied
   *  into. */
  #domainOf(ctx: JudgeContext): readonly NeighbourDocument[] {
    const cached = this.#domains.get(ctx.root);
    if (cached !== undefined) return cached;
    const documents: NeighbourDocument[] = [];
    for (const dir of Object.values(ENGINE_DOC_ROOTS)) {
      for (const name of ctx.fs.list(path.join(ctx.root, dir))) {
        if (!name.endsWith(".md")) continue;
        const absolute = path.resolve(ctx.root, dir, name);
        const content = ctx.fs.read(absolute);
        if (content === null) continue;
        // Both sides of a comparison must read ONE normalized face, so the neighbour
        // goes through the same row source the judged body did. The head is still
        // resolved off the RAW content (a `slug:` is identity data, never translated),
        // and its line count becomes the sentence index's offset: the coordinate this
        // rule PRINTS names the line of the file a reader opens, not a body line.
        const { head, text, lines } = new RowSource(ctx.translator).read(content);
        const from = content.split("\n").length - lines.length;
        const indexed = SentenceIndex.of(text, from)
          .filter((sentence) => sentence.prose >= SentenceIndex.MIN_LENGTH)
          .map((sentence) => ({
            text: sentence.text,
            line: sentence.line,
            grams: SentenceIndex.trigrams(sentence.text),
          }));
        documents.push({
          absolute,
          path: path.join(dir, name),
          slug: head.slug,
          sentences: indexed,
        });
      }
    }
    this.#domains.set(ctx.root, documents);
    return documents;
  }

  /** The first characters of a sentence — the message's opening, so a report names both
   *  sides without restating either whole. */
  static #openingOf(text: string): string {
    return text.length <= 48 ? text : `${text.slice(0, 48)}…`;
  }

  /** The first neighbour sentence that states the same criterion as `own`, or null. */
  static #matchOf(
    own: SentenceIndexedSentence,
    right: NeighbourDocument,
  ): SentenceIndexedSentence | null {
    for (const candidate of right.sentences) {
      if (!SentenceIndex.sameCriterion(own.grams, candidate.grams)) continue;
      return candidate;
    }
    return null;
  }
}

/** One right-domain document with its identity and its indexed sentences. */
interface NeighbourDocument {
  /** The absolute path — the self-file filter's comparison surface. */
  readonly absolute: string;
  /** The repo-relative path the report names. */
  readonly path: string;
  /** The document's `slug:` — a same-slug sibling is the same design, never a copy. */
  readonly slug: string | null;
  readonly sentences: readonly SentenceIndexedSentence[];
}

/** One indexed sentence with its 3-gram set — the comparison record of `single-home`. */
interface SentenceIndexedSentence {
  readonly text: string;
  readonly line: number;
  readonly grams: ReadonlySet<string>;
}
