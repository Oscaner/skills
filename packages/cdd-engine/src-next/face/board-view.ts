// packages/cdd-engine/src-next/face/board-view.ts
// The board face — the slug → node-tree progress board. The file system is the
// ONLY truth: the node set comes from scanning `docs/kairos/{specs,plans}` (the
// doc roots single-sourced at ENGINE_RUNTIME.docRoots), the artifact existence
// from existsSync, the header facts from the doc's header block — the overall's
// declared Phase inventory / File paths tables are NEVER parsed (measured stale).
// No on-disk-absent parent node is ever synthesized (`-p4.1` present with `-p4`
// missing mounts `p4.1` directly at the program root).
//
// This module carries the slug facts: the phase scan, the doc-tree reverse
// derivation read-through, the header `{version, status, docType}` read, the
// per-node progress projection, and the render face (the phase/program board
// layouts + the `next:` derivation). The doc type is the DECLARED fact — the
// `- **Doc type**:` header declaration line (spec §12 · D34) — never a
// filename-suffix derivation; a missing declaration reads null and the consumer
// blocks (zero dual-read fallback).
//
// Module-level exports are types / constants / the class — zero behavior-carrying
// bare functions (the plan's zero-bare-function discipline).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { MarkdownPrimitives, PlanDocType } from "../contract/doc.ts";
import type { DocKey } from "../contract/project.ts";
import { ConfigLoader } from "../infra/config.ts";
import { ENGINE_RUNTIME } from "../infra/runtime.ts";
import { Workspace, WorkspaceRoot } from "../infra/workspace.ts";
import type { TargetType } from "../session/faces.ts";
import { TaskGraph } from "../session/graph.ts";
import { Ledger, type ProgressData } from "../session/ledger.ts";
import {
  NextStepRouter,
  PIPELINE_NEXT,
  type PipelineEntry,
  type PipelineKey,
} from "../session/next.ts";
import { EMPTY_RUN_STATE } from "../session/run.ts";
import { REFS } from "./host.ts";
import type { Words } from "./words.ts";

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

/** The board's wave-line marker vocabulary — the derived ✔/▶/○ set. The glyphs
 *  mirror the per-task markers `face/graph-view.ts` renders, but each face declares
 *  its own set (the board renders wave-level markers, the graph per-task ones); the
 *  two are kept aligned by convention, not by a shared constant. */
export const BOARD_MARKERS = { done: "✔", current: "▶", pending: "○" } as const;

/** The verb render order of a line's `×N` cell — the stable display order the board's
 *  round cells follow (an unexpected verb appends after these, never dropped). */
const VERB_ORDER: readonly string[] = ["implement", "review", "branch-review", "fix"];

/** The board's fixed legend tail line — the progress-marker vocabulary (the same
 *  shape `GraphView` renders; the board's own legend reads `done/current` — the
 *  wave-less scopes carry no current wave, so the board keeps the plain words). */
export const BOARD_LEGEND = "progress: ✔ done · ▶ current · ○ pending";

/** One rendered board — the stdout lines + the process exit code (0 on a clean
 *  board, 2 when a present doc line carried no `- **Doc type**:` declaration). */
export interface BoardRender {
  /** The board's stdout lines (the header, the body, the legend) — joined with `\n`. */
  lines: readonly string[];
  /** The board's process exit code: 0 (clean) or 2 (a missing doc-type declaration). */
  exitCode: number;
}

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

  // -------------------------------------------------------------------------
  // the render face (spec §5.3) — the slug → board layout + the next derivation
  // -------------------------------------------------------------------------

  /** Whether the slug names anything on disk — the file-system-only existence test
   *  (the board's "no matching file → exit 2, never a wall on a ghost slug"). A
   *  program slug matches its overall or any on-disk phase; a phase slug matches its
   *  overall anchor, spec or plan. */
  static hasNode(slug: string, repoRoot: string): boolean {
    if (Workspace.phaseSuffixOf(slug) !== null) {
      const docs = Workspace.docsOfSlug(slug, repoRoot);
      return docs.overall !== null || docs.spec !== null || docs.plan !== null;
    }
    return (
      Workspace.docsOfSlug(slug, repoRoot).overall !== null ||
      BoardView.scanPhases(slug, repoRoot).length > 0
    );
  }

  /** render(slug, repoRoot, words, host) — the slug's progress board (spec §5.3):
   *  the phase form (`overall/spec/plan/wave/branch` + one line per derived wave +
   *  the fixed legend + the `next:` line) or the program form (the overall line with
   *  its own rounds + one summary line per phase + `next: done` — cross-phase never
   *  participates in next). A present doc line carrying no `- **Doc type**:`
   *  declaration renders its `doc-type: missing (BLOCKED)` marker and the board
   *  exits 2 (spec §12 · D34 — the consumer blocks, zero filename fallback). Pure
   *  reads — zero tree writes, zero ledger writes, zero child dispatch. */
  static render(slug: string, repoRoot: string, words: Words, host: string): BoardRender {
    const lines: string[] = [`cdd board: ${slug}`, ""];
    const exitCode =
      Workspace.phaseSuffixOf(slug) !== null
        ? BoardView.#phaseBoard(lines, slug, repoRoot, words, host)
        : BoardView.#programBoard(lines, slug, repoRoot);
    lines.push("", BOARD_LEGEND);
    return { lines, exitCode };
  }

  /** The phase board render — the overall/spec/plan/wave/branch rows + the next
   *  derivation. Returns the exit code (2 when a present doc line carries no type
   *  declaration). */
  static #phaseBoard(
    lines: string[],
    slug: string,
    repoRoot: string,
    words: Words,
    host: string,
  ): number {
    const suffix = Workspace.phaseSuffixOf(slug)!;
    const program = slug.slice(0, slug.length - suffix.length);
    const docs = Workspace.docsOfSlug(slug, repoRoot);
    const node = BoardView.projectNode(slug, repoRoot);
    const overall = BoardView.projectNode(`${program}-overall`, repoRoot);
    const [specLine, planLine, branchLine] = node.lines;
    let blocked = false;

    const overallDoc = BoardView.#docCell(docs.overall, overall.lines[0]!);
    lines.push(`  overall  ${overallDoc.text}`);
    blocked ||= overallDoc.blocked;

    const specDoc = BoardView.#docCell(docs.spec, specLine!);
    lines.push(`  spec     ${specDoc.text}`);
    blocked ||= specDoc.blocked;

    const planDoc = BoardView.#docCell(docs.plan, planLine!);
    lines.push(`  plan     ${planDoc.text}`);
    blocked ||= planDoc.blocked;

    const waves = node.waveLines ?? [];
    if (waves.length === 0) {
      lines.push("  wave     (none)");
    } else {
      waves.forEach((wave, index) => {
        const prefix = index === 0 ? "  wave     " : "           ";
        const cell = BoardView.roundsCell(wave.rounds);
        lines.push(
          `${prefix}${wave.label} ${wave.marker ?? ""}${cell === "" ? "" : `  ${cell}`}`.trimEnd(),
        );
      });
    }

    const ledger = BoardView.#ledgerOf(slug, repoRoot);
    const branchClosed = BoardView.#lineClosed(ledger, "branch", "branch");
    const branchRounds = BoardView.roundsCell(branchLine!.rounds);
    lines.push(
      `  branch   ${branchClosed ? `${BOARD_MARKERS.done} closed` : "○ open"}${branchRounds === "" ? "" : `  ${branchRounds}`}`.trimEnd(),
    );

    lines.push("");
    lines.push(`  next:    ${BoardView.#nextOf(ledger, node, docs.plan, words, host)}`);
    return blocked ? 2 : 0;
  }

  /** The program board render — the overall line (its own rounds) + one summary line
   *  per on-disk phase + `next: done` (cross-phase never participates in next, spec
   *  §6.5). Returns the exit code (2 when the overall doc carries no type
   *  declaration). */
  static #programBoard(lines: string[], slug: string, repoRoot: string): number {
    const nodes = BoardView.projectNodes(slug, repoRoot);
    const overall = nodes[0]!;
    const overallDoc = BoardView.#docCell(
      Workspace.docsOfSlug(slug, repoRoot).overall,
      overall.lines[0]!,
    );
    lines.push(`  overall  ${overallDoc.text}`);
    lines.push("");
    for (const node of nodes.slice(1)) {
      const label = node.label.slice(slug.length).replace(/^-p/, "P");
      const spec = node.lines.find((line) => line.label === "spec");
      const plan = node.lines.find((line) => line.label === "plan");
      const branch = node.lines.find((line) => line.label === "branch");
      const status = spec?.status ?? "Pending";
      const parts: string[] = [];
      const cells: Array<[string, string]> = [
        ["spec", BoardView.roundsCell(spec?.rounds ?? {})],
        ["plan", BoardView.roundsCell(plan?.rounds ?? {})],
        ["branch", BoardView.roundsCell(branch?.rounds ?? {})],
      ];
      for (const [key, cell] of cells) if (cell !== "") parts.push(`${key} ${cell}`);
      const tail = parts.join(" · ");
      lines.push(`  phase ${label}  ${status}${tail === "" ? "" : `   ${tail}`}`);
    }
    lines.push("");
    lines.push("  next:    done");
    return overallDoc.blocked ? 2 : 0;
  }

  /** One doc line's cell text — the doc path, the header facts and the line's
   *  rounds (spec §5.3: `overall  <path>  v2.33 · Draft   review×4`); a present doc
   *  carrying no `- **Doc type**:` declaration renders its `doc-type: missing
   *  (BLOCKED)` marker in place of the facts (blocked = true). An absent doc renders
   *  `(none)` (degradation, never a throw). */
  static #docCell(docPath: string | null, line: BoardLine): { text: string; blocked: boolean } {
    if (docPath === null) return { text: "(none)", blocked: false };
    if (line.docType === null) {
      const facts: string[] = [];
      if (line.version !== null) facts.push(line.version);
      if (line.status !== null) facts.push(line.status);
      const head = facts.length === 0 ? "" : `${facts.join(" · ")}  `;
      return { text: `${docPath}  ${head}doc-type: missing (BLOCKED)`, blocked: true };
    }
    const facts: string[] = [docPath];
    const meta = [line.version, line.status].filter((part) => part !== null).join(" · ");
    if (meta !== "") facts.push(meta);
    const rounds = BoardView.roundsCell(line.rounds);
    if (rounds !== "") facts.push(rounds);
    return { text: facts.join("   "), blocked: false };
  }

  /** The node's ledger — the progress.json read face the render's closure/next
   *  derivation consumes (each node reads its OWN workspace). */
  static #ledgerOf(nodeSlug: string, repoRoot: string): Ledger {
    const root = new WorkspaceRoot(repoRoot, ENGINE_RUNTIME.handoffNamespace.workspaceRoot);
    return new Ledger(new Workspace(root, nodeSlug), new ConfigLoader());
  }

  /** Whether a doc/branch line is CLOSED — the engine's single C5 closure judge
   *  (NextStepRouter) applied to the line's latest recorded round. The board reads
   *  the same router + round carrier the ledger's closedWaves() face reads (zero new
   *  judgment, zero second table): a line whose latest round's route is the `done`
   *  terminal is exhausted. */
  static #lineClosed(ledger: Ledger, key: string, type: TargetType): boolean {
    const mode = type === "branch" ? "branch-review" : "review";
    const reviews = ledger.roundCount(key, mode);
    if (reviews === 0) return false;
    const fixes = ledger.roundCount(key, "fix");
    const round = fixes > 0 ? Math.min(fixes, reviews) : reviews;
    const carried = ledger.round(fixes > 0 ? "fix" : "review", type, { round }, round);
    if (carried === null) return false;
    return new NextStepRouter().next(EMPTY_RUN_STATE, carried)?.kind === "done";
  }

  /** The board's `next:` derivation (spec §6.5) — consume PIPELINE_NEXT (the ONE
   *  face-indirection table, never a second table): walk the phase's faces in line
   *  order (spec → plan → wave → branch), take the FIRST face that has not yet
   *  closed, and render its pipeline entry (the entry the engine's next face renders
   *  when that face reaches `done`). Every face closed → the bare terminal `done`.
   *  The render is byte-identical to the Capsule's `done` face (REFS[ref][host] with
   *  the claude fallback; the literal's `<plan>` slot filled; the bare terminal
   *  word). */
  static #nextOf(
    ledger: Ledger,
    node: BoardProgress,
    planPath: string | null,
    words: Words,
    host: string,
  ): string {
    const waves = node.waveLines ?? [];
    const faces: Array<{ key: PipelineKey; closed: boolean }> = [
      { key: "phase-spec", closed: BoardView.#lineClosed(ledger, "spec", "spec") },
      { key: "plan", closed: BoardView.#lineClosed(ledger, "plan", "plan") },
      // The wave face is exhausted when the plan yields NO wave still open — an
      // empty wave segment (no plan) is not an exhausted face (nothing was closed).
      {
        key: "wave",
        closed: waves.length > 0 && waves.every((wave) => wave.marker === BOARD_MARKERS.done),
      },
      { key: "branch", closed: BoardView.#lineClosed(ledger, "branch", "branch") },
    ];
    const frontier = faces.find((face) => !face.closed);
    if (frontier === undefined) return words.routeWord("done");
    return BoardView.#entryText(PIPELINE_NEXT[frontier.key], planPath, words, host);
  }

  /** One pipeline entry rendered to its dispatch-ready literal — the same render
   *  the Capsule's `done` face produces (a ref → REFS[ref][host], the claude form
   *  when the host is absent; a literal → its `<plan>` slot filled; done → the bare
   *  terminal word). Never a hard-coded plugin spelling. */
  static #entryText(
    entry: PipelineEntry,
    planPath: string | null,
    words: Words,
    host: string,
  ): string {
    if (entry.kind === "done") return words.routeWord("done");
    if (entry.kind === "literal") return entry.literal.replace("<plan>", planPath ?? "<plan>");
    const row = REFS[entry.ref as keyof typeof REFS];
    const form = row === undefined ? undefined : row[host as "claude" | "cursor" | "pi"];
    return form ?? row?.claude ?? words.routeWord("done");
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
   *  share — the same source GraphView renders from), the wave's own `progress.json`
   *  row spread alongside. No plan → empty segment (degradation, never a throw). */
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
