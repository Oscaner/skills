// packages/cdd-engine/src-next/face/board-view.ts
// The board face — the slug → node-tree progress board. The file system is the
// ONLY truth: the node set comes from scanning `docs/kairos/{specs,plans}` (the
// doc roots single-sourced at ENGINE_RUNTIME.docRoots), the artifact existence
// from existsSync, the header facts from the parse record's public `headerLines`
// field — the overall's declared Phase inventory / File paths tables are NEVER
// parsed (measured stale). No on-disk-absent parent node is ever synthesized
// (`-p4.1` present with `-p4` missing mounts `p4.1` directly at the program root).
//
// This module carries the slug facts (this task's slice): the phase scan, the
// doc-tree reverse derivation read-through and the header `{version, status}`
// read. The tree assembly and the render face ride the later tasks.
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { docTypeParsers, MarkdownPrimitives, type ParsedDoc } from "../contract/doc.ts";
import type { DocKey } from "../contract/project.ts";
import { ENGINE_RUNTIME } from "../infra/runtime.ts";
import { Workspace } from "../infra/workspace.ts";

/** One board node's header facts — the `**Version**` / `**Status**` marker values
 *  read from the doc's header block (each null when the doc or the marker is
 *  absent). */
export interface BoardNodeHeader {
  /** The doc's declared version (the `**Version**` header value). */
  version: string | null;
  /** The doc's declared status (the `**Status**` header value). */
  status: string | null;
}

/**
 * BoardView — the slug → node-tree board face. The static fact readers of this
 * task's slice: the phase scan over the specs doc root and the artifact header
 * read. Pure reads — zero tree writes, zero ledger writes, zero child dispatch.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the board fact-read surface — the zero-bare-function discipline admits no standalone predicate functions.
export class BoardView {
  /** scanPhases(programSlug, repoRoot) — the phase-suffix set under the program:
   *  every specs-dir entry whose stem is `<programSlug>-p<主>(.<子>)*` (optionally
   *  followed by a `-design`/`-overall` doc tail — `Workspace.slugFromDoc` strips
   *  it) contributes its suffix, sorted by the dot-separated numeric path
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
      if (!entry.endsWith(".md") || !entry.startsWith(prefix)) continue;
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

  /** readHeader(docPath) — the artifact's header facts: parse the doc through its
   *  derived doc-type parser and extract the `**Version**` / `**Status**` markers
   *  from the parse record's public `headerLines` field. The extraction is LOCAL
   *  marker slicing — the DocType/MarkdownPrimitives `markerValue`/`markerLine`
   *  helpers are `protected` members unreachable from this independent class —
   *  except the version token, which reads the shared grammar's public static
   *  (`MarkdownPrimitives.versionTokensOf`, one grammar home). An absent file or
   *  a missing marker yields null — never a fabricated value. */
  static readHeader(docPath: string): BoardNodeHeader {
    if (!existsSync(docPath)) return { version: null, status: null };
    const text = readFileSync(docPath, "utf8");
    const parsed: ParsedDoc = docTypeParsers[BoardView.#docKeyOf(docPath)].parse(text.split("\n"));
    const status = BoardView.#headerValue(parsed.headerLines, "**Status**");
    const versionLine = BoardView.#headerLine(parsed.headerLines, "**Version**");
    const version =
      versionLine === null ? null : (MarkdownPrimitives.versionTokensOf(versionLine)[0] ?? null);
    return { version, status };
  }

  /** The doc-key derivation for a board-read doc path — the basename rule (the
   *  `-overall.md` / `-single-spec.md` endings; a `-design.md` spec phase-spec;
   *  everything else the plan key). */
  static #docKeyOf(docPath: string): DocKey {
    const base = path.basename(docPath);
    if (base.endsWith("-overall.md")) return "overall-spec";
    if (base.endsWith("-single-spec.md")) return "single-spec";
    if (base.endsWith("-design.md")) return "phase-spec";
    return "plan";
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
