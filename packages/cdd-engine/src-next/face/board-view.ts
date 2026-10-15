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
import { MarkdownPrimitives, PlanDocType } from "../contract/doc.ts";
import type { DocKey } from "../contract/project.ts";
import { ConfigLoader } from "../infra/config.ts";
import { ENGINE_RUNTIME } from "../infra/runtime.ts";
import { Workspace, WorkspaceRoot } from "../infra/workspace.ts";
import { TaskGraph } from "../session/graph.ts";
import { Ledger, type ProgressData } from "../session/ledger.ts";

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

/** The wave-line / board-line marker vocabulary — the derived ✔/▶/○ set (the SAME
 *  words `face/graph-view.ts` renders; one vocabulary, zero re-typed literals). */
export const BOARD_MARKERS = { done: "✔", current: "▶", pending: "○" } as const;

/** The verb render order of a line's `×N` cell — the stable display order the board's
 *  round cells follow (an unexpected verb appends after these, never dropped). */
const VERB_ORDER: readonly string[] = ["implement", "review", "branch-review", "fix"];

/** One board line's projected data — a doc line (`overall` / `spec` / `plan`), the
 *  `branch` line, or one derived wave line. Each line carries its own rounds (the
 *  `progress.json` row of its key) and, for wave lines, the derived ✔/▶/○ marker. */
export interface BoardLine {
  /** The line's label — `overall` / `spec` / `plan` / `branch`, or the wave label (`W1`). */
  label: string;
  /** The line's doc version (null for the branch/wave lines — no doc). */
  version: string | null;
  /** The line's doc status (null for the branch/wave lines). */
  status: string | null;
  /** The line's declared doc type (spec §12 · D34; null for the branch/wave lines). */
  docType: DocKey | null;
  /** The line's completed rounds per verb, each as its cycle-NUMBER array (D28
   *  identity — `[1,3]` = the 1st and 3rd rounds; never a count). */
  rounds: Record<string, number[]>;
  /** The derived ✔/▶/○ marker — wave lines only; null otherwise. */
  marker: string | null;
}

/** One node's progress projection (`cdd board` data plane · spec §5) — the node's
 *  own lines (each a `progress.json` row) plus the derived wave segment. The
 *  projection is a pure read of the node's OWN workspace `progress.json` (the wave
 *  markers ride the SAME `closedWaves()` read the pre-flight gate consumes — one
 *  live fact, zero new judgment). */
export interface BoardProgress {
  /** The node label — the node slug (its workspace unit `.kairos/cdd/<slug>/`). */
  label: string;
  /** The node's primary-doc version (null when the node carries no primary doc). */
  version: string | null;
  /** The node's primary-doc status. */
  status: string | null;
  /** The node's primary-doc declared type (spec §12 · D34). */
  docType: DocKey | null;
  /** The node's own primary-line rounds (the node's primary `progress.json` row). */
  rounds: Record<string, number[]>;
  /** The wave segment — one line per derived wave (empty when the node has no plan). */
  waveLines?: BoardLine[];
  /** The node's non-wave lines (overall/spec/plan/branch), each with its own rounds —
   *  the full per-line breakdown the board layout composes from. */
  lines: BoardLine[];
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

  // -------------------------------------------------------------------------
  // the progress projection (spec §5) — the per-node progress.json single-source read
  // -------------------------------------------------------------------------

  /** projectNodes(programSlug, repoRoot) — the program's node set projected: the
   *  overall node (`<program>-overall`) followed by each on-disk phase node
   *  (`<program>-p<N>`, the file-system-only phase scan). Each node projects its
   *  OWN workspace `progress.json` — a pure read, zero new data, zero new judgment. */
  static projectNodes(programSlug: string, repoRoot: string): BoardProgress[] {
    const nodes = [
      `${programSlug}-overall`,
      ...BoardView.scanPhases(programSlug, repoRoot).map((suffix) => `${programSlug}${suffix}`),
    ];
    return nodes.map((slug) => BoardView.projectNode(slug, repoRoot));
  }

  /** projectNode(nodeSlug, repoRoot) — one node's progress projection. The node's
   *  workspace is `<repoRoot>/.kairos/cdd/<nodeSlug>/`; its `progress.json` rows are
   *  the ONLY progress source (the rounds ride their cycle-NUMBER arrays — D28
   *  identity; the retired numeric form is out-of-format and renders no count). The
   *  node's doc header facts derive from the file system alone (absent doc → nulls,
   *  never synthesized); the wave segment derives from the node's plan (no plan →
   *  empty segment, no throw). Pure reads — zero tree writes, zero ledger writes,
   *  zero child dispatch. */
  static projectNode(nodeSlug: string, repoRoot: string): BoardProgress {
    const root = new WorkspaceRoot(repoRoot, ENGINE_RUNTIME.handoffNamespace.workspaceRoot);
    const ledger = new Ledger(new Workspace(root, nodeSlug), new ConfigLoader());
    const progress = ledger.readProgress();
    const overall = BoardView.#isOverallNode(nodeSlug);
    const programStem = overall ? nodeSlug.slice(0, -"-overall".length) : nodeSlug;
    const docs = Workspace.docsOfSlug(programStem, repoRoot);

    const lines: BoardLine[] = [];
    if (overall) {
      lines.push(BoardView.#docLine("overall", "spec", docs.overall, progress));
    } else {
      lines.push(BoardView.#docLine("spec", "spec", docs.spec, progress));
      lines.push(BoardView.#docLine("plan", "plan", docs.plan, progress));
    }
    const primary = lines[0]!;
    const waveLines = overall ? [] : BoardView.#waveLines(docs.plan, progress, ledger);
    lines.push(BoardView.#roundsLine("branch", "branch", progress));
    return {
      label: nodeSlug,
      version: primary.version,
      status: primary.status,
      docType: primary.docType,
      rounds: primary.rounds,
      ...(waveLines.length > 0 ? { waveLines } : {}),
      lines,
    };
  }

  /** roundsCell(rounds) — the line's `implement×N · review×N · fix×N` cell text. Each
   *  `×N` is the CYCLE-NUMBER array's element count (D28 identity — `[1,3]` → `×2`),
   *  never the stored number: a non-array (the retired numeric form) contributes no
   *  cell. Verbs render in the fixed board order; an out-of-order verb appends after. */
  static roundsCell(rounds: Record<string, number[]>): string {
    const cells: string[] = [];
    const verbs = [...VERB_ORDER, ...Object.keys(rounds).filter((v) => !VERB_ORDER.includes(v))];
    for (const verb of verbs) {
      const value = rounds[verb];
      if (Array.isArray(value) && value.length > 0) cells.push(`${verb}×${value.length}`);
    }
    return cells.join(" · ");
  }

  /** Whether a node slug names the program's overall node (its workspace unit is
   *  `<program>-overall`, the overall doc's own review line keyed `spec`). A label
   *  test on the node slug — NOT a filename→doc-type derivation (D34): the overall
   *  node is fixed at the program root, never inferred from a doc filename. */
  static #isOverallNode(nodeSlug: string): boolean {
    return /-overall$/.test(nodeSlug);
  }

  /** One doc line — the header facts read from the doc (absent → nulls) + the row's
   *  rounds keyed by the line's `progress.json` key. */
  static #docLine(
    label: string,
    key: string,
    docPath: string | null,
    progress: ProgressData | null,
  ): BoardLine {
    const header =
      docPath === null
        ? { version: null, status: null, docType: null }
        : BoardView.readHeader(docPath);
    return { label, ...header, rounds: BoardView.#rowRounds(progress, key), marker: null };
  }

  /** The branch line — a docless line whose rounds ride the `branch` row. */
  static #roundsLine(label: string, key: string, progress: ProgressData | null): BoardLine {
    return {
      label,
      version: null,
      status: null,
      docType: null,
      rounds: BoardView.#rowRounds(progress, key),
      marker: null,
    };
  }

  /** The node's row rounds for one key — array-form ONLY (a non-array verb value —
   *  the retired numeric form — is dropped: zero count renders, no compatibility
   *  layer). An absent row/verb yields an empty map. */
  static #rowRounds(progress: ProgressData | null, key: string): Record<string, number[]> {
    const row = progress?.waves.find((candidate) => candidate.wave === key);
    const rounds: Record<string, number[]> = {};
    for (const [verb, value] of Object.entries(row?.rounds ?? {})) {
      if (Array.isArray(value)) rounds[verb] = [...value];
    }
    return rounds;
  }

  /** The node's wave segment — one line per derived wave (its ✔/▶/○ marker rides the
   *  SAME `TaskGraph.report(closedWaves())` read the board and the pre-flight gate
   *  share · GraphView 同源), the wave's own `progress.json` row spread alongside. No
   *  plan → empty segment (degradation, never a throw). */
  static #waveLines(
    planPath: string | null,
    progress: ProgressData | null,
    ledger: Ledger,
  ): BoardLine[] {
    if (planPath === null) return [];
    const graph = new TaskGraph(
      new PlanDocType("plan").parse(readFileSync(planPath, "utf8").split("\n")),
    );
    const report = graph.report(ledger.closedWaves());
    const done = new Set(report.done);
    const currentIndex = report.waves.findIndex((wave) => wave.some((id) => !done.has(id)));
    return report.waves.map((wave, index) => {
      const closed = wave.every((id) => done.has(id));
      const marker = closed
        ? BOARD_MARKERS.done
        : index === currentIndex
          ? BOARD_MARKERS.current
          : BOARD_MARKERS.pending;
      return {
        label: `W${index + 1}`,
        version: null,
        status: null,
        docType: null,
        rounds: BoardView.#rowRounds(progress, wave.join(",")),
        marker,
      };
    });
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
