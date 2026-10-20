// packages/cdd-engine/src-next/contract/invariants.ts
// T4 — the invariant strategy class family (design spec §2.1): the single
// judgment face. Every structural judgment of the contract plane is one strategy:
//   base nine  — presence / uniqueness / domain / crosslink / order / continuity /
//                residue / hollow / selfBounded;
//   context    — file-existence / sibling-scan / cross-doc-chain /
//                section-scoped-domain (the four seam strategies that absorb the
//                old doctype classes' contextual judgment — fourTableAudit,
//                deviations, Class-A/B, effectiveWaves).
// Each strategy is one subclass of `abstract Invariant { evaluate(ctx) }`; the
// judgment data is always the declared registries + the derived parse face (never
// a hand-written structure prose). Judgment dispatch is the coordinator's
// data-driven per-doc-key composition (judge.ts) — zero switch-case here and zero
// exported behavior-carrying bare functions.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ENGINE_DOC_ROOTS } from "../infra/doc-roots.ts";
import type { ElementRegistry, RegistryElement } from "./declare.ts";
import type {
  ChainLink,
  DesignGroup,
  OverallParsed,
  ParsedDoc,
  PhaseSpecParsed,
  PlanParsed,
  SectionBlock,
  TaskBlock,
} from "./doc.ts";
import { MarkdownPrimitives } from "./doc.ts";
import type { FrontMatterHead } from "./frontmatter.ts";
import type { DocKey, DocShape, DocSkeleton, DocSlices, ElementSlice } from "./project.ts";

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

/** One contract finding — a single invariant violation, bound to a doc + field. */
export interface Finding {
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

/** The filesystem seam the context-seam invariants read through (test-injectable). */
export interface DocFs {
  /** Whether a path exists. */
  exists(p: string): boolean;
  /** The UTF-8 content of a path, or null when unreadable. */
  read(p: string): string | null;
  /** The entry names of a directory, or [] when unreadable. */
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
    } catch {
      return [];
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
  /** The judged document's normalized content lines — the post-fence body's
   *  canonicalize view the row-source seam (Contract.validate) builds ONCE per
   *  judgment: every valuePattern / anchor-literal face (occurrenceLines ·
   *  carrierLines · anchorLines and the parsed records) matches the view. The
   *  view is never written back — the source document stays byte-identical. */
  lines: readonly string[];
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
    "overall-spec": ElementRegistry;
    plan: ElementRegistry;
    "phase-spec": ElementRegistry;
    "single-spec": ElementRegistry;
  };
  /** The dispatch phase id — enables the face-④ phase-registration check. */
  phaseId?: string;
  /** Pre-parsed chain/sibling docs (path → parsed record). */
  chainDocs?: ReadonlyMap<string, ParsedDoc>;
  /** The filesystem seam (defaults to node:fs). */
  fs: DocFs;
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
  abstract evaluate(ctx: JudgeContext): Finding[];

  /** The single finding-construction point. */
  protected finding(ctx: JudgeContext, field: string, message: string, fix: string): Finding {
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

  /** The slice of one registered anchor (undefined when the anchor is not registered here). */
  protected sliceOf(ctx: JudgeContext, anchor: string): ElementSlice | undefined {
    return ctx.slices.slices.find((slice) => slice.anchor === anchor);
  }

  /** Whether a line carries the element — the literal anchor or the declared value shape. */
  protected lineCarries(slice: ElementSlice, line: string): boolean {
    return line.includes(slice.anchor) || (slice.valuePattern?.test(line) ?? false);
  }

  /** The lines carrying the element's anchor token literal. */
  protected anchorLines(ctx: JudgeContext, anchor: string): readonly string[] {
    return ctx.lines.filter((line) => line.includes(anchor));
  }

  /** The lines carrying the element (literal anchor or declared value shape). */
  protected occurrenceLines(ctx: JudgeContext, slice: ElementSlice): readonly string[] {
    return ctx.lines.filter((line) => this.lineCarries(slice, line));
  }

  /** The lines that carry the element as a real structural occurrence — a line whose
   *  anchor only appears as a citation (a backticked code span, or a table cell of a
   *  non-table element) is not a carrier and is never judged as a value. */
  protected carrierLines(ctx: JudgeContext, slice: ElementSlice): readonly string[] {
    return ctx.lines.filter(
      (line) => this.lineCarries(slice, line) && this.#isStructuralCarrier(line, slice),
    );
  }

  #isStructuralCarrier(line: string, slice: ElementSlice): boolean {
    if (this.#isTableRow(line) && slice.home !== "table") return false;
    if (!line.includes(slice.anchor)) return true;
    return !this.#everyAnchorMentionIsCodeSpan(line, slice.anchor);
  }

  #isTableRow(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith("|") && trimmed.endsWith("|");
  }

  /** Whether every literal anchor mention on the line stays inside a backtick code span. */
  #everyAnchorMentionIsCodeSpan(line: string, anchor: string): boolean {
    return !this.#withoutCodeSpans(line).includes(anchor);
  }

  /** The line with its backtick-quoted region removed. A line's quoted content is
   *  the region between its FIRST and LAST backtick (inclusive) — ONE contiguous
   *  quoted fragment, the shape the doc prose actually uses: a simple `` `span` ``
   *  and a quoted command fragment with a NESTED citation (`` `read X + the plan's
   *  \`## Constraints\` (by the wave brief mirror)` ``) both read as one quoted region (the
   *  find-#8 gap: the old span-by-span strip left a nested citation naked after its
   *  opener got consumed by the outer span, judging quoted prose as a value). The
   *  tradeoff is pinned: a line carrying TWO separate backtick spans (`` `x` … `y` ``)
   *  also reads as ONE quoted region, so the mid-span prose between the spans is not
   *  judged (judge.test.ts pins this — an anchor quoted only between two adjacent
   *  spans stays invisible to the presence/domain rules; no enforced doc carries that
   *  shape). A zero- or one-tick line carries no quoted region (unbalanced — nothing
   *  to strip). */
  #withoutCodeSpans(line: string): string {
    const first = line.indexOf("`");
    if (first === -1) return line;
    const last = line.lastIndexOf("`");
    if (first === last) return line;
    return line.slice(0, first) + line.slice(last + 1);
  }

  /** The parsed overall record — when the judged doc is an overall. */
  protected overall(ctx: JudgeContext): OverallParsed | null {
    return ctx.docKey === "overall-spec" ? (ctx.parsed as OverallParsed) : null;
  }

  /** The parsed plan record — when the judged doc is a plan. */
  protected plan(ctx: JudgeContext): PlanParsed | null {
    return ctx.docKey === "plan" ? (ctx.parsed as PlanParsed) : null;
  }

  /** The parsed phase-spec record — when the judged doc is a phase-spec. */
  protected phaseSpec(ctx: JudgeContext): PhaseSpecParsed | null {
    return ctx.docKey === "phase-spec" ? (ctx.parsed as PhaseSpecParsed) : null;
  }

  /** The three-table section heading anchors of the overall (registry-declared). */
  protected overallTableHeadings(ctx: JudgeContext): readonly string[] {
    const headings = this.overall(ctx);
    if (headings === null) return [];
    const declared = ctx.registries["overall-spec"].elements
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

/** presence — every required structural element of the declared registry must occur. */
export class PresenceInvariant extends Invariant {
  readonly name = "presence";

  evaluate(ctx: JudgeContext): Finding[] {
    const findings: Finding[] = [];
    for (const element of this.elementsOf(ctx)) {
      if (element.presence !== "required") continue;
      if (PRESENCE_HOMES.has(element.home) === false) continue;
      const slice = this.sliceOf(ctx, element.anchor);
      if (slice === undefined) continue;
      if (this.#derivedPresenceHolds(ctx, slice)) continue;
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
      if (this.occurrenceLines(ctx, slice).length === 0) {
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
    return findings;
  }

  /** A required surface whose occurrence is established by the parsed structure rather
   *  than a line scan — the plan's `Task id token` only ever appears inside the
   *  `### Task N:` headings, so it is present iff a task block exists. */
  #derivedPresenceHolds(ctx: JudgeContext, slice: ElementSlice): boolean {
    if (slice.home !== "task-block" || slice.anchor.startsWith("#")) return false;
    return (this.plan(ctx)?.taskBlocks.length ?? 0) > 0;
  }

  /** The per-task-block required field keys — derived from the plan registry's
   *  task-field elements (the bold `**Key**` markers; the `File path token` and
   *  DependsOn-value leaves carry non-key anchors, and `Step action` lives on the
   *  task-step home). Single-source: a field key added to the registry is enforced
   *  per task block automatically. */
  #requiredFieldKeys(ctx: JudgeContext): readonly string[] {
    return this.elementsOf(ctx)
      .filter(
        (element) =>
          element.home === "task-field" &&
          element.anchor.startsWith("**") &&
          element.anchor.endsWith("**"),
      )
      .map((element) => element.anchor.slice(2, -2));
  }

  /** The per-task-block field surface — every required task-field key of a plan. */
  private taskFieldPresence(ctx: JudgeContext): Finding[] {
    const data = this.plan(ctx);
    if (data === null) return [];
    const findings: Finding[] = [];
    for (const block of data.taskBlocks) {
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

/** uniqueness — every identity-carrying surface registers exactly once. */
export class UniquenessInvariant extends Invariant {
  readonly name = "uniqueness";

  evaluate(ctx: JudgeContext): Finding[] {
    const findings = [...this.headingUniqueness(ctx), ...this.derivedUniqueness(ctx)];
    return findings;
  }

  /** Heading-style anchors: a duplicated heading line text is a duplicate registration. */
  private headingUniqueness(ctx: JudgeContext): Finding[] {
    const findings: Finding[] = [];
    const seenLine = new Set<string>();
    for (const element of this.elementsOf(ctx)) {
      if (!element.anchor.startsWith("#")) continue;
      const slice = this.sliceOf(ctx, element.anchor);
      if (slice === undefined) continue;
      for (const line of this.occurrenceLines(ctx, slice)) {
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

  /** The derived identity rows: task ids, phase ids, change-history versions. */
  private derivedUniqueness(ctx: JudgeContext): Finding[] {
    const findings: Finding[] = [];
    if (ctx.docKey === "plan") {
      const seenIds = new Set<number>();
      for (const block of this.plan(ctx)?.taskBlocks ?? []) {
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
    }
    if (ctx.docKey === "overall-spec") {
      const data = this.overall(ctx);
      if (data !== null) {
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
        const seenVersions = new Set<string>();
        for (const row of data.tables["Change history"].rows) {
          const version = this.#firstVersion(row[0] ?? "");
          if (version !== null && seenVersions.has(version)) {
            findings.push(
              this.finding(
                ctx,
                "Change history",
                `duplicate change-history version: ${version} registers more than once`,
                "keep each lineage version in exactly one Change-history row",
              ),
            );
          }
          if (version !== null) seenVersions.add(version);
        }
      }
    }
    return findings;
  }

  #firstVersion(text: string): string | null {
    const match = text.match(/v\d+\.\d+/);
    return match === null ? null : match[0];
  }
}

/** domain — every value an anchor literal carries must conform to its declared shape. */
export class DomainInvariant extends Invariant {
  readonly name = "domain";

  evaluate(ctx: JudgeContext): Finding[] {
    const findings: Finding[] = [];
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
      for (const line of this.carrierLines(ctx, slice)) {
        if (!slice.valuePattern.test(line)) {
          findings.push(
            this.finding(
              ctx,
              element.anchor,
              `value outside the declared domain: ${line.trim()}`,
              `make the line match ${slice.valuePattern.source}`,
            ),
          );
        }
      }
    }
    return findings;
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

  evaluate(ctx: JudgeContext): Finding[] {
    if (ctx.docKey === "overall-spec") return this.overallCrosslinks(ctx);
    if (ctx.docKey === "plan") return this.planCrosslinks(ctx);
    return [];
  }

  /** The overall's in-doc reference surfaces: issue rows + graph edges + dependency cells. */
  private overallCrosslinks(ctx: JudgeContext): Finding[] {
    const data = this.overall(ctx);
    if (data === null) return [];
    const findings: Finding[] = [];
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
    // Graph edges: every from/to token must be a registered phase id.
    for (const edge of data.graphEdges) {
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
  private planCrosslinks(ctx: JudgeContext): Finding[] {
    const data = this.plan(ctx);
    if (data === null) return [];
    const findings: Finding[] = [];
    const ids = new Set(data.taskBlocks.map((block) => block.id));
    for (const block of data.taskBlocks) {
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

/** order — structural surfaces appear in their declared sequence. */
export class OrderInvariant extends Invariant {
  readonly name = "order";

  evaluate(ctx: JudgeContext): Finding[] {
    return [...this.sectionOrder(ctx), ...this.historyOrder(ctx)];
  }

  /** Rank-2 headings must follow the declared registry order (design before constraints…). */
  private sectionOrder(ctx: JudgeContext): Finding[] {
    const findings: Finding[] = [];
    const anchors = this.elementsOf(ctx)
      .filter((element) => element.anchor.startsWith("## "))
      .map((element) => element.anchor);
    const docSections: readonly SectionBlock[] = this.#docSections(ctx);
    let previous = -1;
    for (const section of docSections) {
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

  /** The overall's change-history rows must be version-ascending — oldest first, the
   *  latest revision last (the canonical repo format). */
  private historyOrder(ctx: JudgeContext): Finding[] {
    const data = this.overall(ctx);
    if (data === null) return [];
    const findings: Finding[] = [];
    const versions = data.tables["Change history"].rows
      .map((row) => this.#versionPair(row[0] ?? ""))
      .filter((pair) => pair !== null) as readonly { major: number; minor: number }[];
    for (let i = 1; i < versions.length; i++) {
      const earlier = versions[i - 1];
      const later = versions[i];
      if (
        earlier.major > later.major ||
        (earlier.major === later.major && earlier.minor > later.minor)
      ) {
        findings.push(
          this.finding(
            ctx,
            "Change history",
            `change-history rows are not version-ascending (v${earlier.major}.${earlier.minor} above v${later.major}.${later.minor})`,
            "order the Change-history rows oldest-first",
          ),
        );
        break;
      }
    }
    return findings;
  }

  /** The document's rank-2 section blocks in document order. */
  #docSections(ctx: JudgeContext): readonly SectionBlock[] {
    if (ctx.docKey === "overall-spec") return (ctx.parsed as OverallParsed).sections;
    if (ctx.docKey === "plan") return (ctx.parsed as PlanParsed).sections;
    return (ctx.parsed as PhaseSpecParsed).sections;
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

  #versionPair(text: string): { major: number; minor: number } | null {
    const match = text.match(/v(\d+)\.(\d+)/);
    return match === null ? null : { major: Number(match[1]), minor: Number(match[2]) };
  }
}

/** continuity — numbered surfaces are 1-indexed and contiguous. */
export class ContinuityInvariant extends Invariant {
  readonly name = "continuity";

  evaluate(ctx: JudgeContext): Finding[] {
    if (ctx.docKey === "plan") return this.taskContinuity(ctx);
    if (ctx.docKey === "phase-spec") return this.groupContinuity(ctx);
    return [];
  }

  /** Plan task ids must be exactly 1..N. */
  private taskContinuity(ctx: JudgeContext): Finding[] {
    const data = this.plan(ctx);
    if (data === null || data.taskBlocks.length === 0) return [];
    const findings: Finding[] = [];
    data.taskBlocks.forEach((block, index) => {
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
  private groupContinuity(ctx: JudgeContext): Finding[] {
    const data = this.phaseSpec(ctx);
    if (data === null || data.design.length === 0) return [];
    const findings: Finding[] = [];
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
    findings: Finding[],
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

  evaluate(ctx: JudgeContext): Finding[] {
    const findings: Finding[] = [];
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
      if (this.anchorLines(ctx, owner).length > 0) continue; // the condition holds — the section is present
      const leaked = this.occurrenceLines(ctx, slice).length;
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

  evaluate(ctx: JudgeContext): Finding[] {
    const findings = [...this.tableHollow(ctx), ...this.taskHollow(ctx), ...this.designHollow(ctx)];
    return findings;
  }

  /** The overall's four tables: a present table section with zero data rows is hollow. */
  private tableHollow(ctx: JudgeContext): Finding[] {
    const data = this.overall(ctx);
    if (data === null) return [];
    const findings: Finding[] = [];
    for (const anchor of this.overallTableHeadings(ctx)) {
      const headingExists = this.anchorLines(ctx, anchor).length > 0;
      if (!headingExists) continue;
      const section = data.sections.find((s) => s.heading.includes(anchor.replace(/^## /, "")));
      const tableRows = section === undefined ? [] : this.tableRows(section.lines).slice(1);
      if (tableRows.length === 0) {
        findings.push(
          this.finding(
            ctx,
            anchor,
            `${anchor} section is hollow — the section heading carries no data rows`,
            "either add the table's data rows or remove the empty section",
          ),
        );
      }
    }
    return findings;
  }

  /** A task block that carries no keyed fields is a hollow shell. */
  private taskHollow(ctx: JudgeContext): Finding[] {
    const data = this.plan(ctx);
    if (data === null) return [];
    const findings: Finding[] = [];
    for (const block of data.taskBlocks) {
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
  private designHollow(ctx: JudgeContext): Finding[] {
    const data = this.phaseSpec(ctx);
    if (data === null) return [];
    const findings: Finding[] = [];
    const designSlice = this.sliceOf(ctx, "## Design");
    if (
      designSlice !== undefined &&
      this.anchorLines(ctx, "## Design").length > 0 &&
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

/** selfBounded — the doc's own-scope lineage stays consistent with itself. */
export class SelfBoundedInvariant extends Invariant {
  readonly name = "selfBounded";

  evaluate(ctx: JudgeContext): Finding[] {
    const headerVersion = ctx.head.version;
    const historyVersions = this.#historyVersions(ctx);
    if (headerVersion === null || historyVersions.length === 0) return [];
    const findings: Finding[] = [];
    const newest = this.#newestVersion(historyVersions);
    if (headerVersion !== newest) {
      findings.push(
        this.finding(
          ctx,
          "version",
          `the header version ${headerVersion} is not the change-history's newest row (${newest})`,
          "bump both the version front-matter key and the newest Change-history row together",
        ),
      );
    }
    if (!historyVersions.includes(headerVersion)) {
      findings.push(
        this.finding(
          ctx,
          "version",
          `the header version ${headerVersion} is outside the document's own lineage`,
          `the version front-matter key must belong to the Change-history row versions: ${historyVersions.join(", ")}`,
        ),
      );
    }
    return findings;
  }

  /** The doc's Change-history row versions — the overall reads its parsed table,
   *  the plan/spec read the `## Change history` section's table rows (the shared
   *  row primitive — the P4.1 T2 isomorphic lineage: the same lineage judgment rides
   *  all doc types). */
  #historyVersions(ctx: JudgeContext): readonly string[] {
    if (ctx.docKey === "overall-spec") {
      const data = this.overall(ctx);
      if (data === null) return [];
      return data.tables["Change history"].rows
        .map((row) => this.#firstVersion(row[0] ?? ""))
        .filter((version) => version !== null) as readonly string[];
    }
    const section =
      ctx.docKey === "plan"
        ? (ctx.parsed as PlanParsed).sections.find((s) => s.heading.includes("Change history"))
        : (ctx.parsed as PhaseSpecParsed).sections.find((s) =>
            s.heading.includes("Change history"),
          );
    if (section === undefined) return [];
    return this.tableRows(section.lines)
      .map((row) => this.#firstVersion(row[0] ?? ""))
      .filter((version) => version !== null) as readonly string[];
  }

  #firstVersion(text: string): string | null {
    const match = text.match(/v\d+\.\d+/);
    return match === null ? null : match[0];
  }

  /** The newest lineage version — the numerically greatest (major, minor) row. */
  #newestVersion(versions: readonly string[]): string {
    let best = versions[0];
    for (const version of versions) {
      const [bestMajor, bestMinor] = this.#versionNumber(best);
      const [currentMajor, currentMinor] = this.#versionNumber(version);
      if (currentMajor > bestMajor || (currentMajor === bestMajor && currentMinor > bestMinor)) {
        best = version;
      }
    }
    return best;
  }

  #versionNumber(version: string): readonly [number, number] {
    const match = version.match(/v(\d+)\.(\d+)/);
    return match === null ? [0, 0] : [Number(match[1]), Number(match[2])];
  }
}

// ---------------------------------------------------------------------------
// the four context-seam strategies
// ---------------------------------------------------------------------------

/** The chain-link target shape contract (D2, shape judged at the boundary — the #342
 *  fix): a link target must be a BARE relative path (the repo-root form
 *  `docs/kairos/specs/…-overall.md` or a doc-relative file name) — never a
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
        "the value must be a bare relative path (e.g. `docs/kairos/specs/…-overall.md` or `xxx-overall.md`), not a markdown link or URL",
      );
    }
    return new LinkTargetShape(trimmed, null);
  }
}

/** file-existence — every chain link target of the doc resolves to an existing file. */
export class FileExistenceInvariant extends Invariant {
  readonly name: string = "file-existence";

  evaluate(ctx: JudgeContext): Finding[] {
    const findings: Finding[] = [];
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

  /** The chain links of the judged doc type (overall design/plan cells; plan/spec lineage links). */
  protected chainLinks(ctx: JudgeContext): readonly { source: string; link: ChainLink }[] {
    const links: { source: string; link: ChainLink }[] = [];
    if (ctx.docKey === "overall-spec") {
      const data = this.overall(ctx);
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
    if (ctx.docKey === "plan") {
      const data = this.plan(ctx);
      if (data !== null) {
        if (data.chain.specLink !== null) links.push({ source: "spec", link: data.chain.specLink });
        if (data.chain.parentLink !== null)
          links.push({ source: "parent-program", link: data.chain.parentLink });
      }
    }
    if (ctx.docKey === "phase-spec") {
      const data = this.phaseSpec(ctx);
      if (data !== null && data.chain.parentLink !== null) {
        links.push({ source: "parent-program", link: data.chain.parentLink });
      }
    }
    return links;
  }

  /** Whether the target exists — absolute targets directly; repo-root form first, the
   *  doc's own dir as the file-relative fallback. The resolution chain is
   *  single-sourced in `targetPath` (the ONE home the CLI's plan `spec:` rebase
   *  delegates to as well — P9 branch-review-1 F8: a future contract change
   *  cannot silently diverge from the CLI's mirror). */
  #targetExists(ctx: JudgeContext, target: string): boolean {
    return ctx.fs.exists(
      FileExistenceInvariant.targetPath(ctx.root, ctx.path, target, (p) => ctx.fs.exists(p)),
    );
  }

  /** The ONE chain-link target-resolution chain (the doc-contract's own judgment,
   *  reused by the CLI's plan `spec:` rebase — F8): an absolute target as
   *  itself; else the repoRoot-relative reading when it exists; else the doc-dir
   *  (file-relative) reading. `exists` is the caller's filesystem seam (the
   *  judgment's `ctx.fs`, the CLI's `fs.existsSync`) — the resolution is the shared
   *  fact, the read is injected. When neither reading exists the doc-dir path is
   *  returned (the link-space semantic — the caller owns the truly-missing case). */
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

  evaluate(ctx: JudgeContext): Finding[] {
    const findings: Finding[] = [];
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

  evaluate(ctx: JudgeContext): Finding[] {
    const findings: Finding[] = [];
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

/** cross-doc-chain — the Class-A/B chain resolves and its lineage tokens belong to the parent. */
export class CrossDocChainInvariant extends Invariant {
  readonly name = "cross-doc-chain";

  evaluate(ctx: JudgeContext): Finding[] {
    if (ctx.docKey === "overall-spec") return this.overallChain(ctx);
    if (ctx.docKey === "plan") return this.planChain(ctx);
    return this.specChain(ctx);
  }

  /** The overall chain-root face: a dispatch phase must be registered in the inventory. */
  private overallChain(ctx: JudgeContext): Finding[] {
    if (ctx.phaseId === undefined || ctx.phaseId === null) return [];
    const data = this.overall(ctx);
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

  /** The plan chain face — the retired path keys are judged only while the doc
   *  type's registry still declares them (the plan's `spec:` / `parent-program:`
   *  declarations are gone; the same-slug identity chain replaces them). */
  private planChain(ctx: JudgeContext): Finding[] {
    const data = this.plan(ctx);
    if (data === null) return [];
    const findings: Finding[] = [];
    const specLink = data.chain.specLink;
    if (this.sliceOf(ctx, "spec") !== undefined && specLink === null) {
      findings.push(
        this.finding(
          ctx,
          "spec",
          "the plan carries no spec reference",
          "add a spec value pointing at the phase design spec",
        ),
      );
    }
    // The link-label drift judgment retired with the ChainLink label face — the
    // spec link is a head scalar now (the `spec:` key), the label is not a fact.
    if (this.sliceOf(ctx, "parent-program") !== undefined) {
      if (data.chain.parentLink === null) {
        findings.push(
          this.finding(
            ctx,
            "parent-program",
            "the plan carries no parent-program reference",
            "add a parent-program value pointing at the parent overall",
          ),
        );
      }
      findings.push(...this.classB(ctx, data.chain.parentLink, data.chain.parentTokens));
    }
    return findings;
  }

  /** The phase-spec chain face — the Class-B parent link is judged only while the
   *  registry declares the `parent-program:` key (retired for the `program:` slug
   *  reference). */
  private specChain(ctx: JudgeContext): Finding[] {
    const data = this.phaseSpec(ctx);
    if (data === null) return [];
    const findings: Finding[] = [];
    if (this.sliceOf(ctx, "parent-program") === undefined) return findings;
    if (data.chain.parentLink === null) {
      findings.push(
        this.finding(
          ctx,
          "parent-program",
          "the phase-spec carries no parent-program reference",
          "add a parent-program value pointing at the parent overall",
        ),
      );
    }
    findings.push(...this.classB(ctx, data.chain.parentLink, data.chain.parentTokens));
    return findings;
  }

  /** Class-B: the parent version tokens must belong to the parent overall's lineage. */
  private classB(
    ctx: JudgeContext,
    parentLink: ChainLink | null,
    parentTokens: readonly string[],
  ): Finding[] {
    const findings: Finding[] = [];
    if (parentLink === null || parentTokens.length === 0) return findings;
    const parentParsed = ctx.chainDocs?.get(parentLink.target);
    if (parentParsed === undefined) return findings;
    const lineage = this.#parentLineage(parentParsed);
    for (const token of parentTokens) {
      if (!lineage.has(token)) {
        findings.push(
          this.finding(
            ctx,
            "parent-program",
            `the parent-program version token ${token} does not belong to the parent overall's lineage`,
            `use a version the parent overall declares (its version front-matter or a Change-history row): ${[...lineage].join(", ")}`,
          ),
        );
      }
    }
    return findings;
  }

  /** The parent overall's lineage: its head `version:` scalar + every
   *  Change-history row version (the T6 read point — the header fact rides the
   *  typed head record, never a body line scan). */
  #parentLineage(parent: ParsedDoc): Set<string> {
    const lineage = new Set<string>();
    if (parent.docType !== "overall-spec") return lineage;
    const version = (parent as OverallParsed).head?.version;
    if (version !== null && version !== undefined) lineage.add(version);
    for (const row of (parent as OverallParsed).tables["Change history"].rows) {
      const match = row[0]?.match(/v\d+\.\d+/);
      if (match !== null) lineage.add(match[0]);
    }
    return lineage;
  }
}

/** section-scoped-domain — a value shape is enforced only inside its owning section. */
export class SectionScopedDomainInvariant extends Invariant {
  readonly name = "section-scoped-domain";

  evaluate(ctx: JudgeContext): Finding[] {
    if (ctx.docKey === "overall-spec") return this.issueScopedRefs(ctx);
    if (ctx.docKey === "phase-spec") return this.designScoping(ctx);
    return [];
  }

  /** Issue-ref forms are judged only within `## Issue inventory` (a content-wide rule
   *  would misfire on legacy `## Requirement inventory` tables whose ref cells are prose). */
  private issueScopedRefs(ctx: JudgeContext): Finding[] {
    const data = this.overall(ctx);
    if (data === null) return [];
    const slice = this.sliceOf(ctx, "Issue ref cell");
    if (slice?.valuePattern === undefined) return [];
    const findings: Finding[] = [];
    for (const row of data.tables["Issue inventory"].rows) {
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
  private designScoping(ctx: JudgeContext): Finding[] {
    const data = this.phaseSpec(ctx);
    if (data === null) return [];
    const slice = this.sliceOf(ctx, "### N. group heading");
    if (slice?.valuePattern === undefined) return [];
    const findings: Finding[] = [];
    for (const section of data.sections) {
      if (this.sliceOf(ctx, "## Design")?.valuePattern?.test(section.heading) === true) continue;
      for (const line of section.lines) {
        if (slice.valuePattern.test(line.trim())) {
          findings.push(
            this.finding(
              ctx,
              "### N. group heading",
              `a design-group heading appears outside ## Design: ${line.trim()}`,
              "move the group heading under ## Design (design-body surface only)",
            ),
          );
        }
      }
    }
    return findings;
  }
}
