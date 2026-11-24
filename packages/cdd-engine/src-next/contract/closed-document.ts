// packages/cdd-engine/src-next/contract/closed-document.ts
// The PROVEN-closure reading (design spec §1.4) — the one POSITIVE reading of a phase
// registration, kept on the rule plane after the pin module retired: the shape gate's
// `Contract.validate` closure argument is this class's answer, and nothing else builds
// one.
//
// What it reads: a charter's `## Phase inventory` rows name a file in two cells
// (`Design spec` · `Implementation plan`), and a phase spec and its plan are two faces of
// ONE registration — reading only the plan cell would keep every closed spec judged
// forever. The cell's file name is resolved by `path.basename` against the INDEXED
// documents, and only a UNIQUE hit on the judged document itself proves closure: zero
// hits and several hits prove nothing, because a registration that no longer identifies
// one document cannot establish that anything is closed.
//
// That polarity was the pin face's opposite: its `#closedBy` read zero / several hits as
// CLOSED (a dead `✔ Done` row must not buy a silent pin skip). That face retired with the
// pin gate, and this reading keeps the positive-only closure it outlived — the shape gate
// never inherits the tolerance. The registration GRAMMAR survives: `fileOf` is the one
// spelling of `✔ Done（`file` · date）` in this tree, and the closure reading above is its
// one reader.
//
// The document set comes from `infra/slug-index.ts#SlugIndex` — the command preamble's
// ONE identity scan — so this reader never walks the tree a second time and never
// resolves a document by file name alone.
//
// Module-level exports are the class — zero behavior-carrying bare functions.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { SlugIndex } from "../infra/slug-index.ts";
import { type ChainPhase, docTypeParsers, type OverallParsed } from "./doc.ts";
import { FrontMatterExtractor, type FrontMatterHead } from "./frontmatter.ts";
import { PathShape } from "./shape-rules.ts";

/** The `✔ Done（`file` · date）` grammar — the registration form both named cells of a
 *  Phase-inventory row write, read here ONCE so a later change to the form moves one
 *  regex rather than two readers. */
const DONE_CELL = /✔ Done（`(?<file>[^`]+)`/;

/** One charter's parsed Phase-inventory rows — the overall document plus the cells its
 *  rows name, read once per scan. */
interface CharterRows {
  readonly rel: string;
  readonly phases: readonly ChainPhase[];
}

/**
 * ClosedDocument — the closure reading over one identity index. Construct it with the
 * command's own `SlugIndex` (production) or with the rule plane's default index read (the
 * lazy fallback a caller that injects no visitor uses); every `closed` call then answers
 * off that one scan.
 */
export class ClosedDocument {
  readonly #index: SlugIndex;
  #charters: readonly CharterRows[] | null = null;

  constructor(index: SlugIndex) {
    this.#index = index;
  }

  /** Whether the judged document is PROVEN closed by a phase inventory's named cells.
   *  `rel` is the judged document's repo-relative path; a cell's file name is compared
   *  against `path.basename` of the indexed documents, and a cell that resolves to zero
   *  or several documents proves nothing. */
  closed(rel: string): boolean {
    // The one path normalization of the rule plane, not a second spelling of it: the
    // judged path and every indexed entry (already normalized by `SlugIndex`) meet on
    // the same form, so two writings of one location never read as two locations.
    const judged = PathShape.normalize(rel);
    for (const charter of this.#chartersOf()) {
      for (const phase of charter.phases) {
        const cells = [phase.designCell, phase.planCell];
        if (cells.some((cell) => this.#namesDoc(ClosedDocument.fileOf(cell), judged))) return true;
      }
    }
    return false;
  }

  /** Whether one cell's named file identifies the judged document — a UNIQUE hit whose
   *  `rel` IS the judged document. Zero hits and several hits prove nothing, which is
   *  the whole polarity: the shape gate closes only on positive identification. */
  #namesDoc(named: string | null, judged: string): boolean {
    if (named === null) return false;
    const hits = this.#index.entries.filter((entry) => path.basename(entry.rel) === named);
    const [only] = hits;
    return hits.length === 1 && only !== undefined && only.rel === judged;
  }

  /** The file name one `✔ Done（`file` · date）` cell writes, or null when the cell is
   *  not a registration at all (`[Pending]`, a bare scope note). The ONE spelling of the
   *  registration grammar: the closure reading above is its reader, so a change to the
   *  form moves one regex. */
  static fileOf(cell: string): string | null {
    return DONE_CELL.exec(cell)?.groups?.file ?? null;
  }

  /** Every charter's Phase-inventory rows, read once — a document with no such section
   *  registers nothing, and an unreadable one is skipped (the gate already owns that
   *  face; this reader is a positive reading, never a qualification). */
  #chartersOf(): readonly CharterRows[] {
    if (this.#charters !== null) return this.#charters;
    const charters: CharterRows[] = [];
    for (const entry of this.#index.entries) {
      if (entry.docType !== "overall") continue;
      const phaseRows = ClosedDocument.#phaseRowsOf(entry.path);
      if (phaseRows.length > 0) charters.push({ rel: entry.rel, phases: phaseRows });
    }
    this.#charters = charters;
    return charters;
  }

  /** One overall document's Phase-inventory rows, parsed through the doc registry's own
   *  overall parser — the tree holds no second table grammar. */
  static #phaseRowsOf(docPath: string): readonly ChainPhase[] {
    let text: string;
    try {
      text = readFileSync(docPath, "utf8");
    } catch {
      return [];
    }
    const { head, body } = FrontMatterExtractor.split(text);
    const parsed = ClosedDocument.#parseOverall(body, head);
    if (parsed === null || parsed.tables["Phase inventory"].headerRow === null) return [];
    return parsed.chain.phases;
  }

  /** The whole-document parse, narrowed — null when the body does not parse as an
   *  overall (an unreadable skeleton is not a registration). */
  static #parseOverall(body: string, head: FrontMatterHead): OverallParsed | null {
    try {
      return docTypeParsers.overall.parse(body.split("\n"), head) as OverallParsed;
    } catch {
      return null;
    }
  }
}
