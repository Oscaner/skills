// packages/cdd-engine/src-next/contract/invariants.ts
// T4 — the invariant strategy class family (design spec §2.1): the single
// judgment face. Every structural judgment of the contract plane is one strategy:
//   base nine  — presence / uniqueness / domain / crosslink / order / continuity /
//                residue / hollow / selfBounded;
//   context    — file-existence / sibling-scan / cross-doc-chain /
//                section-scoped-domain (the four seam strategies that absorb the
//                old doctype classes' contextual judgment — fourTableAudit,
//                deviations, Class-A/B, effectiveGroups).
// Each strategy is one subclass of `abstract Invariant { evaluate(ctx) }`; the
// judgment data is always the declared registries + the derived parse face (never
// a hand-written structure prose). Judgment dispatch is the coordinator's
// data-driven per-doc-key composition (judge.ts) — zero switch-case here and zero
// exported behavior-carrying bare functions.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
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
import type { DocKey, DocShape, DocSlices, ElementSlice } from "./project.ts";

// ---------------------------------------------------------------------------
// judgment records + the context
// ---------------------------------------------------------------------------

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
  /** The document's raw content lines. */
  lines: readonly string[];
  /** The document's file path (message attribution + the doc's own dir for links). */
  path: string;
  /** The workspace/repo root the doc chain resolves against. */
  root: string;
  /** The derived parse face of the judged doc type. */
  slices: DocSlices;
  /** The derived section skeleton of the judged doc type. */
  shape: DocShape;
  /** The three declared registries — the element-level judgment data. */
  registries: { overall: ElementRegistry; plan: ElementRegistry; phaseSpec: ElementRegistry };
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

  /** The line with its backtick-delimited inline code spans removed. */
  #withoutCodeSpans(line: string): string {
    return line.replace(/`+[^`\n]*`+/g, "");
  }

  /** The parsed overall record — when the judged doc is an overall. */
  protected overall(ctx: JudgeContext): OverallParsed | null {
    return ctx.docKey === "overall" ? (ctx.parsed as OverallParsed) : null;
  }

  /** The parsed plan record — when the judged doc is a plan. */
  protected plan(ctx: JudgeContext): PlanParsed | null {
    return ctx.docKey === "plan" ? (ctx.parsed as PlanParsed) : null;
  }

  /** The parsed phase-spec record — when the judged doc is a phase-spec. */
  protected phaseSpec(ctx: JudgeContext): PhaseSpecParsed | null {
    return ctx.docKey === "phaseSpec" ? (ctx.parsed as PhaseSpecParsed) : null;
  }

  /** The four-table section heading anchors of the overall (registry-declared). */
  protected overallTableHeadings(ctx: JudgeContext): readonly string[] {
    const headings = this.overall(ctx);
    if (headings === null) return [];
    const declared = ctx.registries.overall.elements
      .filter((element) => element.home === "section" && element.anchor.startsWith("## "))
      .map((element) => element.anchor);
    return declared.filter((anchor) =>
      ["File paths", "Issue inventory", "Phase inventory", "Change history"].some((name) =>
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
  "header",
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
    if (ctx.docKey === "overall") {
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
      if (slice === undefined || slice.valuePattern === undefined) continue;
      // The element is judged by the SHAPE of the lines that carry it structurally —
      // a `**Status**: Draft` line must match its declared pattern. A prose citation
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
}

/** crosslink — in-document reference resolution against the doc's own identity sets. */
export class CrosslinkInvariant extends Invariant {
  readonly name = "crosslink";

  evaluate(ctx: JudgeContext): Finding[] {
    if (ctx.docKey === "overall") return this.overallCrosslinks(ctx);
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

  /** The plan's in-doc reference surfaces: DependsOn ids + prose task references. */
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
    // Prose task references (`Task 5` / `T 5`) must resolve to an existing task id.
    const prose = this.sliceOf(ctx, "Task prose reference");
    if (prose?.valuePattern !== undefined) {
      for (const line of this.occurrenceLines(ctx, prose)) {
        const pattern = new RegExp(prose.valuePattern.source, "g");
        for (const match of line.matchAll(pattern)) {
          const id = Number(match[1]);
          if (!ids.has(id)) {
            findings.push(
              this.finding(
                ctx,
                "Task prose reference",
                `prose references unregistered task ${match[1]}`,
                `only reference task ids present in the plan (found ${match[1]})`,
              ),
            );
          }
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
    if (ctx.docKey === "overall") return (ctx.parsed as OverallParsed).sections;
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
    if (ctx.docKey === "phaseSpec") return this.groupContinuity(ctx);
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
    const data = this.overall(ctx);
    if (data === null) return [];
    const headerVersion = this.#headerVersion(ctx);
    const historyVersions = data.tables["Change history"].rows
      .map((row) => this.#firstVersion(row[0] ?? ""))
      .filter((version) => version !== null) as readonly string[];
    if (headerVersion === null || historyVersions.length === 0) return [];
    const findings: Finding[] = [];
    const newest = this.#newestVersion(historyVersions);
    if (headerVersion !== newest) {
      findings.push(
        this.finding(
          ctx,
          "**Version**",
          `the header version ${headerVersion} is not the change-history's newest row (${newest})`,
          "bump both the **Version** header and the newest Change-history row together",
        ),
      );
    }
    if (!historyVersions.includes(headerVersion)) {
      findings.push(
        this.finding(
          ctx,
          "**Version**",
          `the header version ${headerVersion} is outside the document's own lineage`,
          `the **Version** header must belong to the Change-history row versions: ${historyVersions.join(", ")}`,
        ),
      );
    }
    return findings;
  }

  #headerVersion(ctx: JudgeContext): string | null {
    for (const line of this.anchorLines(ctx, "**Version**")) {
      const tokens = this.versionTokens(line);
      if (tokens.length > 0) return tokens[0];
    }
    return null;
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

/** file-existence — every chain link target of the doc resolves to an existing file. */
export class FileExistenceInvariant extends Invariant {
  readonly name: string = "file-existence";

  evaluate(ctx: JudgeContext): Finding[] {
    const findings: Finding[] = [];
    for (const { source, link } of this.chainLinks(ctx)) {
      if (this.isPlaceholder(link.target)) continue;
      if (!this.#targetExists(ctx, link.target)) {
        findings.push(
          this.finding(
            ctx,
            source,
            `the chain link target does not resolve to an existing file: ${link.target}`,
            "fix the link target (repo-root form docs/kairos/... or a file-relative path)",
          ),
        );
      }
    }
    return findings;
  }

  /** The chain links of the judged doc type (overall design/plan cells; plan/spec lineage links). */
  protected chainLinks(ctx: JudgeContext): readonly { source: string; link: ChainLink }[] {
    const links: { source: string; link: ChainLink }[] = [];
    if (ctx.docKey === "overall") {
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
        if (data.chain.specLink !== null)
          links.push({ source: "**Spec:**", link: data.chain.specLink });
        if (data.chain.parentLink !== null)
          links.push({ source: "**Parent program**", link: data.chain.parentLink });
      }
    }
    if (ctx.docKey === "phaseSpec") {
      const data = this.phaseSpec(ctx);
      if (data !== null && data.chain.parentLink !== null) {
        links.push({ source: "**Parent program**", link: data.chain.parentLink });
      }
    }
    return links;
  }

  /** Whether a target's raw form marks it as a holder placeholder (no existence judgment). */
  protected isPlaceholder(target: string): boolean {
    const trimmed = target.trim();
    if (trimmed === "") return true;
    if (trimmed === "Pending" || trimmed === "[Pending]") return true;
    return /^<[^>]+>$/.test(trimmed);
  }

  /** Whether the target exists — absolute targets directly; repo-root form first, the
   *  doc's own dir as the file-relative fallback. */
  #targetExists(ctx: JudgeContext, target: string): boolean {
    if (path.isAbsolute(target)) return ctx.fs.exists(target);
    return (
      ctx.fs.exists(path.join(ctx.root, target)) ||
      ctx.fs.exists(path.join(path.dirname(ctx.path), target))
    );
  }
}

/** sibling-scan — every cross-linked doc must be a same-family sibling of this doc. */
export class SiblingScanInvariant extends FileExistenceInvariant {
  readonly name = "sibling-scan";

  evaluate(ctx: JudgeContext): Finding[] {
    const findings: Finding[] = [];
    const baseline = new Set<string>();
    for (const root of SiblingScanInvariant.#scanRoots(ctx.path)) {
      for (const entry of ctx.fs.list(root)) {
        if (entry.endsWith(".md")) baseline.add(entry);
      }
    }
    for (const { source, link } of this.chainLinks(ctx)) {
      if (this.isPlaceholder(link.target)) continue;
      const basename = path.basename(link.target);
      if (!baseline.has(basename)) {
        findings.push(
          this.finding(
            ctx,
            source,
            `the cross-linked doc ${basename} is not a same-family sibling (not present in the sibling docs scan)`,
            "link to a sibling doc under the same specs/plans family",
          ),
        );
      }
    }
    return findings;
  }

  /** The doc's own dir + its sibling specs/plans dirs — the same-family scan roots. */
  static #scanRoots(docPath: string): readonly string[] {
    const own = path.dirname(docPath);
    const grand = path.dirname(own);
    return [own, path.join(grand, "specs"), path.join(grand, "plans")];
  }
}

/** cross-doc-chain — the Class-A/B chain resolves and its lineage tokens belong to the parent. */
export class CrossDocChainInvariant extends Invariant {
  readonly name = "cross-doc-chain";

  evaluate(ctx: JudgeContext): Finding[] {
    if (ctx.docKey === "overall") return this.overallChain(ctx);
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

  /** The Class-A/Class-B plan chain: `**Spec:**` label == basename + the Class-B lineage. */
  private planChain(ctx: JudgeContext): Finding[] {
    const data = this.plan(ctx);
    if (data === null) return [];
    const findings: Finding[] = [];
    const specLink = data.chain.specLink;
    if (specLink === null) {
      findings.push(
        this.finding(
          ctx,
          "**Spec:**",
          "the plan carries no **Spec:** reference",
          "add a **Spec:** link pointing at the phase design spec",
        ),
      );
    } else if (specLink.label.trim() !== path.basename(specLink.target)) {
      findings.push(
        this.finding(
          ctx,
          "**Spec:**",
          `the **Spec:** link label ${specLink.label.trim()} does not equal the resolved basename ${path.basename(specLink.target)}`,
          "make the link label equal the resolved file's basename",
        ),
      );
    }
    if (data.chain.parentLink === null) {
      findings.push(
        this.finding(
          ctx,
          "**Parent program**",
          "the plan carries no **Parent program** link",
          "add the **Parent program** link pointing at the parent overall",
        ),
      );
    }
    findings.push(...this.classB(ctx, data.chain.parentLink, data.chain.parentTokens));
    return findings;
  }

  /** The Class-B phase-spec chain: the parent-link lineage belongs to the parent overall. */
  private specChain(ctx: JudgeContext): Finding[] {
    const data = this.phaseSpec(ctx);
    if (data === null) return [];
    const findings: Finding[] = [];
    if (data.chain.parentLink === null) {
      findings.push(
        this.finding(
          ctx,
          "**Parent program**",
          "the phase-spec carries no **Parent program** link",
          "add the **Parent program** link pointing at the parent overall",
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
            "**Parent program**",
            `the **Parent program** version token ${token} does not belong to the parent overall's lineage`,
            `use a version the parent overall declares (its **Version** header or a Change-history row): ${[...lineage].join(", ")}`,
          ),
        );
      }
    }
    return findings;
  }

  /** The parent overall's lineage: its header version + every Change-history row version. */
  #parentLineage(parent: ParsedDoc): Set<string> {
    const lineage = new Set<string>();
    if (parent.docType !== "overall") return lineage;
    for (const line of (parent as OverallParsed).headerLines) {
      if (line.includes("**Version**")) {
        for (const token of this.versionTokens(line)) lineage.add(token);
      }
    }
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
    if (ctx.docKey === "overall") return this.issueScopedRefs(ctx);
    if (ctx.docKey === "phaseSpec") return this.designScoping(ctx);
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
