// packages/cdd-engine/src-next/contract/home-extractors.ts
// T3 — the home-driven generic extractors (design spec §3.2): one class per home
// surface. Each class implements the FIXED structural rule of its home (the task
// block head + `- **Key**:` fields + `- ` steps, the numbered design headings,
// the graph edge lines, the table rows, the section/facet headings); WHICH
// anchors belong to the home comes from the injected registry — the registry
// stays the single knowledge source (D26), and the hand-written per-anchor
// grammars of the old parse face (contract/doc.ts) are retired.
//
// The unified entry — extract(registry, lines) — maps each served anchor to the
// occurrence lines/segments of that element in the document (document order;
// graph edges are matched and carried on their trimmed form). Where a home's
// structure rule further decomposes an occurrence (the design numbered-heading
// number/text split), the extractor owns the decomposition too.

import type { ElementRegistry, Home, RegistryElement } from "./declare.ts";

/** The unified extraction record — each served anchor → its occurrence lines. */
export type ExtractionMap = Record<string, readonly string[]>;

/** One decomposed numbered heading — the leading number token and the heading text. */
export interface NumberedHeading {
  /** The leading number token (`1` for `### 1. …`, `1.1` for `#### 1.1 …`). */
  number: string;
  /** The heading text after the number token. */
  heading: string;
}

/** One scanned section — a rank-2 heading line plus its body lines. */
export interface ScannedSection {
  /** The section heading line verbatim. */
  heading: string;
  /** The body lines up to the next rank-2 heading. */
  lines: readonly string[];
}

/**
 * The home-extractor base — the shared anchor-roster and the declared-pattern
 * application both classes build on. Stateless by design: `extract` reads the
 * injected registry and lines per call, so one shared instance per home services
 * every consumer.
 */
export abstract class HomeExtractor {
  /** The home surfaces this extractor serves. */
  abstract readonly homes: readonly Home[];

  /** The unified extraction entry — the served anchors → their occurrence lines. */
  abstract extract(registry: ElementRegistry, lines: readonly string[]): ExtractionMap;

  /** The registered elements of one served home surface. */
  protected elementsOf(registry: ElementRegistry, home: Home): readonly RegistryElement[] {
    return registry.elements.filter((element) => element.home === home);
  }

  /** The element's declared value pattern compiled — the "already-declared
   *  value-pattern application" primitive (never a second hand-written grammar). */
  protected patternOf(element: RegistryElement): RegExp | undefined {
    return element.valuePattern === undefined ? undefined : new RegExp(element.valuePattern);
  }

  /** Append one occurrence line under an anchor — the shared map-bucket push
   *  (the `??=` short-hand rewritten to keep assignments out of expressions). */
  protected appendBucket(out: Record<string, string[]>, anchor: string, line: string): void {
    let bucket = out[anchor];
    if (bucket === undefined) {
      bucket = [];
      out[anchor] = bucket;
    }
    bucket.push(line);
  }
}

/**
 * The design-body extractor — the double-layer `### N.` group / `#### N.M` item
 * headings and the `## Design` / `### Acceptance criteria` leaves. The
 * numbered-heading structure rule (the number token before the dot/space and the
 * text after) lives here — the parse face consumes the decomposition.
 */
export class DesignBodyExtractor extends HomeExtractor {
  readonly homes = ["design-body"] as const;

  extract(registry: ElementRegistry, lines: readonly string[]): ExtractionMap {
    const out: Record<string, string[]> = {};
    for (const element of this.elementsOf(registry, "design-body")) {
      const pattern = this.patternOf(element);
      if (pattern === undefined) continue;
      const hits: string[] = [];
      for (const line of lines) {
        if (pattern.test(line)) hits.push(line);
      }
      if (hits.length > 0) out[element.anchor] = hits;
    }
    return out;
  }

  /** One `### N.` group heading's number and text (the digit before the dot, the text after). */
  groupOf(heading: string): NumberedHeading {
    return this.#splitHeading(heading, "### ".length, true);
  }

  /** One `#### N.M` item heading's composite number and text (the token before the first space, the text after). */
  itemOf(heading: string): NumberedHeading {
    return this.#splitHeading(heading, "#### ".length, false);
  }

  /** The shared numbered-heading split — the number token ends at the first dot
   *  (group form) or the first space (item form); the text is the trimmed rest. */
  #splitHeading(heading: string, prefixLength: number, dotTerminated: boolean): NumberedHeading {
    const payload = heading.slice(prefixLength);
    let end = 0;
    while (end < payload.length) {
      const char = payload[end];
      if (dotTerminated && char === ".") break;
      if (!dotTerminated && (char === " " || char === "\t")) break;
      end += 1;
    }
    const number = payload.slice(0, end);
    if (end >= payload.length) return { number, heading: "" };
    let text = payload.slice(end);
    if (dotTerminated && text.startsWith(".")) text = text.slice(1);
    return { number, heading: text.trim() };
  }
}

/**
 * The graph extractor — the `P1 -> P2` edge lines of the `home: "graph"` anchors.
 * The edge/legend line forms are the declared value patterns; the from/to token
 * grammar stays the parse face's preserved graph-edge primitive.
 */
export class GraphExtractor extends HomeExtractor {
  readonly homes = ["graph"] as const;

  extract(registry: ElementRegistry, lines: readonly string[]): ExtractionMap {
    const out: Record<string, string[]> = {};
    for (const element of this.elementsOf(registry, "graph")) {
      const pattern = this.patternOf(element);
      if (pattern === undefined) continue;
      const hits: string[] = [];
      // Edge lines are matched and carried on their trimmed form — the graph
      // block's raw lines may carry leading indentation the declared patterns
      // don't allow.
      for (const line of lines) {
        const trimmed = line.trim();
        if (pattern.test(trimmed)) hits.push(trimmed);
      }
      if (hits.length > 0) out[element.anchor] = hits;
    }
    return out;
  }
}

/**
 * The table extractor — the declared table anchors' column-header and data rows.
 * Matching rides the declared row value patterns; the separator-row skip mirrors
 * the parse face's table-split primitive.
 */
export class TableExtractor extends HomeExtractor {
  readonly homes = ["table"] as const;

  extract(registry: ElementRegistry, lines: readonly string[]): ExtractionMap {
    const out: Record<string, string[]> = {};
    for (const element of this.elementsOf(registry, "table")) {
      const pattern = this.patternOf(element);
      if (pattern === undefined) continue;
      const hits: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
        if (TableExtractor.isSeparatorRow(trimmed)) continue;
        if (pattern.test(trimmed)) hits.push(trimmed);
      }
      if (hits.length > 0) out[element.anchor] = hits;
    }
    return out;
  }

  /** The separator row of a markdown table — `|` and only `-` / `:` / `|` /
   *  whitespace between the wrapper bars (same rule as the table-split primitive). */
  static isSeparatorRow(trimmed: string): boolean {
    for (let index = 1; index < trimmed.length - 1; index++) {
      const char = trimmed[index];
      if (char === "-" || char === ":" || char === "|" || char === " " || char === "\t") {
        continue;
      }
      return false;
    }
    return trimmed.length > 2;
  }

  /** Whether a line is a markdown table line — a `|`-wrapped row. */
  static isTableLine(trimmed: string): boolean {
    return trimmed.startsWith("|") && trimmed.endsWith("|");
  }

  /** The table lines of a line run in document order — the table home's fixed
   *  structural rule (a `|`-wrapped row, the separator row excluded). The parse
   *  face's table reader consumes this so the table-line / separator knowledge
   *  lives here once, never re-derived at the parse face. */
  tableLinesOf(lines: readonly string[]): readonly string[] {
    const out: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!TableExtractor.isTableLine(trimmed)) continue;
      if (TableExtractor.isSeparatorRow(trimmed)) continue;
      out.push(trimmed);
    }
    return out;
  }

  /** The declared column-header line of a line run — the first table line the
   *  registry's `… columns` anchors claim (their declared column vocabulary), or
   *  null when the section's table declares no column anchor. The parse face
   *  consumes this so the declared-home set, not a positional guess, identifies
   *  the header row. */
  headerLineOf(registry: ElementRegistry, lines: readonly string[]): string | null {
    const tableLines = this.tableLinesOf(lines);
    for (const element of this.elementsOf(registry, "table")) {
      if (!element.anchor.endsWith(" columns")) continue;
      const pattern = this.patternOf(element);
      if (pattern === undefined) continue;
      for (const line of tableLines) {
        if (pattern.test(line)) return line;
      }
    }
    return null;
  }
}

/**
 * The heading scanner — the section/facet home's registered heading anchors.
 * The heading rank derives from the anchor's own leading `#` count and the
 * occurrence must carry the same rank: a line is an occurrence only when it is a
 * heading of the declared rank AND its declared value shape accepts it.
 */
export class HeadingScanner extends HomeExtractor {
  readonly homes = ["section", "facet"] as const;

  extract(registry: ElementRegistry, lines: readonly string[]): ExtractionMap {
    const out: Record<string, string[]> = {};
    for (const element of this.elementsOf(registry, "section").concat(
      this.elementsOf(registry, "facet"),
    )) {
      const rank = HeadingScanner.#rankOf(element.anchor);
      if (rank === null) continue;
      const pattern = this.patternOf(element);
      const hits: string[] = [];
      for (const line of lines) {
        if (HeadingScanner.#rankOf(line) !== rank) continue;
        if (pattern === undefined ? line.startsWith(element.anchor) : pattern.test(line)) {
          hits.push(line);
        }
      }
      if (hits.length > 0) out[element.anchor] = hits;
    }
    return out;
  }

  /** The registered rank-2 section headings of a line run, in document order —
   *  the section surface's fixed structure rule (only `##`-ranked headings are
   *  sections) over every registry anchor declared at that rank, whichever home
   *  owns it (a section-home heading, the conditional-home headings and the
   *  design-body `## Design` are all section surfaces). A heading whose text is
   *  registered in no home (an undeclared prose section) is not a section. */
  sectionsOf(registry: ElementRegistry, lines: readonly string[]): ScannedSection[] {
    const declared = new Set<string>();
    for (const element of registry.elements) {
      if (HeadingScanner.#rankOf(element.anchor) !== 2) continue;
      const pattern = this.patternOf(element);
      for (const line of lines) {
        if (HeadingScanner.#rankOf(line) !== 2) continue;
        if (pattern === undefined ? line.startsWith(element.anchor) : pattern.test(line)) {
          declared.add(line);
        }
      }
    }
    return HeadingScanner.#sectionBlocks(lines, declared);
  }

  /** The `##` block walk — a declared rank-2 heading line opens a section that
   *  runs to the next rank-2 heading (the shape the parse face hands its
   *  consumers); an undeclared rank-2 heading closes the open section without
   *  opening one. */
  static #sectionBlocks(lines: readonly string[], declared: ReadonlySet<string>): ScannedSection[] {
    const out: ScannedSection[] = [];
    let openHeading: string | null = null;
    let openLines: string[] = [];
    const close = (): void => {
      if (openHeading !== null) out.push({ heading: openHeading, lines: openLines });
      openHeading = null;
      openLines = [];
    };
    for (const line of lines) {
      if (HeadingScanner.#rankOf(line) === 2) {
        close();
        if (declared.has(line)) openHeading = line;
        continue;
      }
      if (openHeading !== null) openLines.push(line);
    }
    close();
    return out;
  }

  /** The heading rank of a heading line/anchor literal — the count of leading
   *  `#`s followed by whitespace (the heading-rank primitive), or null. */
  static #rankOf(text: string): 1 | 2 | 3 | 4 | null {
    let rank = 0;
    while (rank < text.length && text[rank] === "#") rank += 1;
    if (rank === 0 || rank > 4) return null;
    const next = text[rank];
    if (next !== undefined && next !== " " && next !== "\t") return null;
    return rank as 1 | 2 | 3 | 4;
  }
}
