// packages/cdd-engine/src-next/face/board-view.ts
// The board face — the slug → node-tree progress board. The file system is the
// ONLY truth: the node set comes from scanning `docs/kairos/{specs,plans}` (the
// doc roots single-sourced at ENGINE_RUNTIME.docRoots), the artifact existence
// from existsSync, the header facts from the doc's header block — the overall's
// declared Phase inventory / File paths tables are NEVER parsed (measured stale).
// No on-disk-absent parent node is ever synthesized (`-p4.1` present with `-p4`
// missing mounts `p4.1` directly at the program root).
//
// This module carries the slug facts (this task's slice): the phase scan, the
// doc-tree reverse derivation read-through and the header `{version, status,
// docType}` read. The doc type is the DECLARED fact — the `- **Doc type**:`
// header declaration line (spec §12 · D34) — never a filename-suffix derivation;
// a missing declaration reads null and the consumer blocks (zero dual-read
// fallback). The tree assembly and the render face ride the later tasks.
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { MarkdownPrimitives } from "../contract/doc.ts";
import type { DocKey } from "../contract/project.ts";
import { ENGINE_RUNTIME } from "../infra/runtime.ts";
import { Workspace } from "../infra/workspace.ts";

/** One board node's header facts — the `**Version**` / `**Status**` / `**Doc type**`
 *  marker values read from the doc's header block (each null when the doc or the
 *  marker is absent). */
export interface BoardNodeHeader {
  /** The doc's declared version (the `**Version**` header value). */
  version: string | null;
  /** The doc's declared status (the `**Status**` header value). */
  status: string | null;
  /** The doc's declared type (the `**Doc type**` header declaration — spec §12 ·
   *  D34); null when the declaration is absent or outside the DocKey domain. */
  docType: DocKey | null;
}

/** The DocKey domain of the `- **Doc type**:` declaration — the declared value must
 *  be one of the four keys; anything else reads null (present facts, never a
 *  fabricated type). */
const DOC_TYPE_DOMAIN: readonly DocKey[] = ["overall-spec", "plan", "phase-spec", "single-spec"];

/**
 * BoardView — the slug → node-tree board face. The static fact readers of this
 * task's slice: the phase scan over the specs doc root and the artifact header
 * read. Pure reads — zero tree writes, zero ledger writes, zero child dispatch.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the board fact-read surface — the zero-bare-function discipline admits no standalone predicate functions.
export class BoardView {
  /** scanPhases(programSlug, repoRoot) — the phase-suffix set under the program:
   *  every specs-dir entry whose stem is `<programSlug>-p<major>(.<minor>)*`
   *  (optionally followed by a `-design`/`-overall` doc tail — `Workspace.slugFromDoc`
   *  strips it) contributes its suffix, sorted by the dot-separated numeric path
   *  (2 < 10, `p4.1` after `p4`). No parent node is synthesized — only the
   *  suffixes actually found on disk return. */
  static scanPhases(programSlug: string, repoRoot: string): string[] {
    const specsDir = path.join(repoRoot, ENGINE_RUNTIME.docRoots.specs);
    let entries: string[];
    try {
      entries = readdirSync(specsDir);
    } catch {
      return [];
    }
    const prefix = `${programSlug}-`;
    const suffixes = new Set<string>();
    for (const entry of entries) {
      if (!/\.md$/.test(entry) || !entry.startsWith(prefix)) continue;
      const slug = Workspace.slugFromDoc(entry);
      if (slug === programSlug || !slug.startsWith(prefix)) continue;
      const suffix = slug.slice(prefix.length);
      if (/^p\d+(?:\.\d+)*$/.test(suffix)) suffixes.add(`-${suffix}`);
    }
    return [...suffixes].sort((a, b) => {
      const numsOf = (s: string) =>
        s
          .slice(2) // strip the leading `-p`
          .split(".")
          .map((part) => Number.parseInt(part, 10));
      const aNums = numsOf(a);
      const bNums = numsOf(b);
      for (let i = 0; i < Math.min(aNums.length, bNums.length); i++) {
        if (aNums[i] !== bNums[i]) return aNums[i] - bNums[i];
      }
      return aNums.length - bNums.length;
    });
  }

  /** readHeader(docPath) — the artifact's header facts: the header block is the
   *  doc-type-shared marker face, scanned LOCALLY (title line → the first heading)
   *  with no parser selection (spec §12 · D34 — a marker scan needs no doc-type
   *  knowledge; the filename→parser derivation is retired). The extraction is LOCAL
   *  marker slicing — the DocType/MarkdownPrimitives `markerValue`/`markerLine`
   *  helpers are `protected` members unreachable from this independent class —
   *  except the version token, which reads the shared grammar's public static
   *  (`MarkdownPrimitives.versionTokensOf`, one grammar home). An absent file or
   *  a missing marker yields null — never a fabricated value. */
  static readHeader(docPath: string): BoardNodeHeader {
    const headerLines = BoardView.#headerLinesOf(docPath);
    const status = BoardView.#headerValue(headerLines, "**Status**");
    const versionLine = BoardView.#headerLine(headerLines, "**Version**");
    const version =
      versionLine === null ? null : (MarkdownPrimitives.versionTokensOf(versionLine)[0] ?? null);
    return { version, status, docType: BoardView.#docTypeOf(headerLines) };
  }

  /** readDocType(docPath) — the doc's declared type alone (the `- **Doc type**:`
   *  header declaration, spec §12 · D34): the ONE declaration reading face shared
   *  by the board and the capsule's doc-class discrimination. An absent file, a
   *  missing declaration or an out-of-domain value reads null — the consumer
   *  blocks (zero filename-suffix fallback, zero dual-read layer). */
  static readDocType(docPath: string): DocKey | null {
    return BoardView.#docTypeOf(BoardView.#headerLinesOf(docPath));
  }

  /** The doc's header-block lines — an absent file scans empty; a present one
   *  yields the lines between the `# Title` and the first heading (the same block
   *  the doc-type parsers expose as `headerLines`, read without one). The leading
   *  line is dropped only when it IS the document title (a rank-1 heading) — a doc
   *  whose first line is already metadata keeps it (the marker scan needs no title). */
  static #headerLinesOf(docPath: string): readonly string[] {
    if (!existsSync(docPath)) return [];
    const lines = readFileSync(docPath, "utf8").split("\n");
    const body = /^#\s/.test(lines[0] ?? "") ? lines.slice(1) : lines;
    const header: string[] = [];
    for (const line of body) {
      if (/^#+\s/.test(line)) break;
      header.push(line);
    }
    return header;
  }

  /** The declared doc type of the header block — the `**Doc type**` marker value
   *  constrained to the DocKey domain (null otherwise). */
  static #docTypeOf(headerLines: readonly string[]): DocKey | null {
    const declared = BoardView.#headerValue(headerLines, "**Doc type**");
    if (declared === null) return null;
    return (DOC_TYPE_DOMAIN as readonly string[]).includes(declared) ? (declared as DocKey) : null;
  }

  /** The first header line carrying the marker — the local line-level extraction
   *  (null when no header line carries the marker). */
  static #headerLine(headerLines: readonly string[], marker: string): string | null {
    for (const line of headerLines) if (line.includes(marker)) return line;
    return null;
  }

  /** The one-marker value slice — the local header extraction (the `- **Key**:
   *  value` prefix form; null when no header line carries the marker). */
  static #headerValue(headerLines: readonly string[], marker: string): string | null {
    const line = BoardView.#headerLine(headerLines, marker);
    if (line === null) return null;
    const index = line.indexOf(marker);
    const payload = line.slice(index + marker.length).trim();
    return payload.replace(/^:\s*/, "").trim();
  }
}
