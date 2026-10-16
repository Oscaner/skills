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
// D40 — the board's `next:` derivation walks the phase's faces in line order
// (spec → plan → wave → branch) and, for the FIRST non-closed face, derives that
// line's ACTIVE C5 hop from the SAME state→next chain the dispatch engine walks
// (the wave face's frontier → `Ledger#waveLinePhase`; the doc/branch faces'
// `Ledger#linePhase`) before feeding it to the ONE resolver (`NextStepRouter.resolve`)
// and the ONE renderer (`RouteRenderer`, shared with the capsule). A line still in
// flight therefore renders its next C5 hop (`implement --tasks 12,13,14`), never the
// face-to-face handoff of an exhausted line; a fully drained line hands off to the
// next pipeline entry. Each wave line's label carries the wave's task scope in braces
// (`W1 {5,11}`) with the ✔/▶/○ marker column fixed-width aligned.
//
// Module-level exports are types / constants / the class — zero behavior-carrying
// bare functions (the plan's zero-bare-function discipline).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { MarkdownPrimitives, PlanDocType } from "../contract/doc.ts";
import type { DocKey } from "../contract/project.ts";
import { ConfigLoader } from "../infra/config.ts";
import { ENGINE_RUNTIME } from "../infra/runtime.ts";
import { type SlugDocs, Workspace, WorkspaceRoot } from "../infra/workspace.ts";
import { TaskGraph } from "../session/graph.ts";
import { Ledger, type ProgressData } from "../session/ledger.ts";
import { NextStepRouter, type PipelineFaceReport } from "../session/next.ts";
import { PROGRESS_LEGEND, PROGRESS_MARKERS } from "./graph-view.ts";
import { type RouteChannelRow, RouteRenderer } from "./route-render.ts";
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

/** The verb render order of a line's `×N` cell — the stable display order the board's
 *  round cells follow (an unexpected verb appends after these, never dropped). */
const VERB_ORDER: readonly string[] = ["implement", "review", "branch-review", "fix"];

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

  /** render(slug, repoRoot, words, host, channels) — the slug's progress board
   *  (spec §5.3): the phase form (`overall/spec/plan/wave/branch` + one line per
   *  derived wave + the fixed legend + the `next:` line) or the program form (the
   *  overall line with its own rounds + one summary line per phase + `next: done` —
   *  cross-phase never participates in next). The argv channel is threaded into the
   *  shared `RouteRenderer` (the SAME channel the capsule's route render reads, so
   *  the board's `next:` and the engine's `next:` literal compose their argv from
   *  ONE flag-spelling source — never a second hard-coded format string). A present
   *  doc line carrying no `- **Doc type**:` declaration renders its `doc-type:
   *  missing (BLOCKED)` marker and the board exits 2 (spec §12 · D34 — the consumer
   *  blocks, zero filename fallback). Pure reads — zero tree writes, zero ledger
   *  writes, zero child dispatch. */
  static render(
    slug: string,
    repoRoot: string,
    words: Words,
    host: string,
    channels: Readonly<Record<string, RouteChannelRow>> = {},
  ): BoardRender {
    const lines: string[] = [`cdd board: ${slug}`, ""];
    const exitCode =
      Workspace.phaseSuffixOf(slug) !== null
        ? BoardView.#phaseBoard(lines, slug, repoRoot, words, host, channels)
        : BoardView.#programBoard(lines, slug, repoRoot);
    lines.push("", PROGRESS_LEGEND.board);
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
    channels: Readonly<Record<string, RouteChannelRow>>,
  ): number {
    const suffix = Workspace.phaseSuffixOf(slug)!;
    const program = slug.slice(0, slug.length - suffix.length);
    const docs = Workspace.docsOfSlug(slug, repoRoot);
    const node = BoardView.projectNode(slug, repoRoot);
    const overall = BoardView.projectNode(`${program}-overall`, repoRoot);
    // Select each line by its label (never a positional index with a non-null
    // assertion — a reorder of node.lines must not silently swap the facts).
    const specLine = node.lines.find((line) => line.label === "spec");
    const planLine = node.lines.find((line) => line.label === "plan");
    const branchLine = node.lines.find((line) => line.label === "branch");
    let blocked = false;

    const overallDoc = BoardView.#docCell(docs.overall, overall.lines[0]!, repoRoot);
    lines.push(`  overall  ${overallDoc.text}`);
    blocked ||= overallDoc.blocked;

    const specDoc = BoardView.#docCell(docs.spec, specLine!, repoRoot);
    lines.push(`  spec     ${specDoc.text}`);
    blocked ||= specDoc.blocked;

    const planDoc = BoardView.#docCell(docs.plan, planLine!, repoRoot);
    lines.push(`  plan     ${planDoc.text}`);
    blocked ||= planDoc.blocked;

    const waves = node.waveLines ?? [];
    if (waves.length === 0) {
      lines.push("  wave     (none)");
    } else {
      // The marker column is fixed-width: every wave label is padded to the widest
      // label so the ✔/▶/○ markers align into one column (spec §5.2 · D40).
      const labelWidth = Math.max(...waves.map((wave) => wave.label.length));
      waves.forEach((wave, index) => {
        const prefix = index === 0 ? "  wave     " : "           ";
        const cell = BoardView.roundsCell(wave.rounds);
        const label = wave.label.padEnd(labelWidth);
        lines.push(
          `${prefix}${label}  ${wave.marker ?? ""}${cell === "" ? "" : `  ${cell}`}`.trimEnd(),
        );
      });
    }

    const ledger = BoardView.#ledgerOf(slug, repoRoot);
    const branchClosed = ledger.lineClosed("branch", "branch");
    const branchRounds = BoardView.roundsCell(branchLine!.rounds);
    lines.push(
      `  branch   ${branchClosed ? `${PROGRESS_MARKERS.done} closed` : `${PROGRESS_MARKERS.pending} open`}${branchRounds === "" ? "" : `  ${branchRounds}`}`.trimEnd(),
    );

    lines.push("");
    lines.push(
      `  next:    ${BoardView.#nextOf(ledger, node, docs, words, host, channels, repoRoot)}`,
    );
    return blocked ? 2 : 0;
  }

  /** The program board render — the overall line (its own rounds) + one summary line
   *  per on-disk phase + `next: done` (cross-phase never participates in next, spec
   *  §6.5). Returns the exit code (2 when the overall doc OR any present phase doc
   *  carries no type declaration — the phase board's BLOCK propagates here, spec §12 ·
   *  D34: zero silent fallback). */
  static #programBoard(lines: string[], slug: string, repoRoot: string): number {
    const nodes = BoardView.projectNodes(slug, repoRoot);
    const overall = nodes[0]!;
    const overallDoc = BoardView.#docCell(
      Workspace.docsOfSlug(slug, repoRoot).overall,
      overall.lines[0]!,
      repoRoot,
    );
    lines.push(`  overall  ${overallDoc.text}`);
    lines.push("");
    let blocked = overallDoc.blocked;
    for (const node of nodes.slice(1)) {
      const label = node.label.slice(slug.length).replace(/^-p/, "P");
      const spec = node.lines.find((line) => line.label === "spec");
      const plan = node.lines.find((line) => line.label === "plan");
      const branch = node.lines.find((line) => line.label === "branch");
      // The phase line's doc-cell read: a present phase spec/plan without its
      // `- **Doc type**:` declaration blocks the SAME way the phase board does —
      // the marker renders on the phase line and the program board exits 2.
      const docs = Workspace.docsOfSlug(node.label, repoRoot);
      const phaseBlocked =
        BoardView.#docCell(docs.spec, spec!, repoRoot).blocked ||
        BoardView.#docCell(docs.plan, plan!, repoRoot).blocked;
      blocked ||= phaseBlocked;
      const status = phaseBlocked ? "doc-type: missing (BLOCKED)" : (spec?.status ?? "Pending");
      // The phase's wave summary token (spec §5.3): the wave segment's first wave
      // number + an ellipsis (`wave W1…`) — the phase's wave progress at a glance,
      // derived from the SAME wave segment the phase board renders (no second read).
      const waves = node.waveLines ?? [];
      const waveCell = waves.length === 0 ? "" : `${waves[0]!.label.split(" ")[0]}…`;
      const parts: string[] = [];
      const cells: Array<[string, string]> = [
        ["spec", BoardView.roundsCell(spec?.rounds ?? {})],
        ["plan", BoardView.roundsCell(plan?.rounds ?? {})],
        ["wave", waveCell],
        ["branch", BoardView.roundsCell(branch?.rounds ?? {})],
      ];
      for (const [key, cell] of cells) if (cell !== "") parts.push(`${key} ${cell}`);
      const tail = parts.join(" · ");
      lines.push(`  phase ${label}  ${status}${tail === "" ? "" : `   ${tail}`}`);
    }
    lines.push("");
    lines.push("  next:    done");
    return blocked ? 2 : 0;
  }

  /** One doc line's cell text — the doc path, the header facts and the line's
   *  rounds (spec §5.3: `overall  <path>  v2.33 · Draft   review×4`); a present doc
   *  carrying no `- **Doc type**:` declaration renders its `doc-type: missing
   *  (BLOCKED)` marker in place of the facts (blocked = true). An absent doc renders
   *  `(none)` (degradation, never a throw). The doc path renders repoRoot-relative
   *  (D47 — `docsOfSlug` derives it absolute; the board emits the ONE shape). */
  static #docCell(
    docPath: string | null,
    line: BoardLine,
    repoRoot: string,
  ): { text: string; blocked: boolean } {
    if (docPath === null) return { text: "(none)", blocked: false };
    const rel = WorkspaceRoot.relativize(repoRoot, docPath);
    if (line.docType === null) {
      const facts: string[] = [];
      if (line.version !== null) facts.push(line.version);
      if (line.status !== null) facts.push(line.status);
      const head = facts.length === 0 ? "" : `${facts.join(" · ")}  `;
      return { text: `${rel}  ${head}doc-type: missing (BLOCKED)`, blocked: true };
    }
    const facts: string[] = [rel];
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

  /** The board's `next:` derivation (spec §6.5 · §18.2 · D40 deep-solve) — the board
   *  OBSERVES each phase face's state (closed · its ACTIVE C5 hop from the SAME
   *  state→next chain the dispatch engine walks — `Ledger#lineRoute` for the doc/branch
   *  lines, the plan frontier + `Ledger#waveLineRoute` for the wave line — and the
   *  render target) as a keyed report and hands it to the ONE router
   *  (`NextStepRouter.walk`) + the ONE renderer (`RouteRenderer`). The board forks
   *  ZERO transition rule: the face order and the frontier/entrance/anchor decision are
   *  the router's (D26 — one fact, one place). A line still in flight renders its next
   *  C5 hop (a fresh wave's `implement --plan <plan> --tasks <ids>`, an in-flight
   *  wave's `review`/`fix`, a fresh doc line's `review --type <type> …`); a face
   *  ENTERED but with no active hop renders its own pipeline exit; a face NOT yet
   *  entered (an absent doc) renders the PRECEDING entered face's exit (so a
   *  just-closed spec hands off to `cdd-plan`, never the absent plan's `cdd-dev`); all
   *  faces closed renders the last face's exit (the pipeline terminus). */
  static #nextOf(
    ledger: Ledger,
    node: BoardProgress,
    docs: SlugDocs,
    words: Words,
    host: string,
    channels: Readonly<Record<string, RouteChannelRow>>,
    repoRoot: string,
  ): string {
    const renderer = new RouteRenderer(words, channels, host, repoRoot);
    const waves = node.waveLines ?? [];
    // The plan's open frontier wave — the SAME ready batch the dispatch engine's
    // task-graph frontier yields (frontier over closedWaves()).
    const waveKey = BoardView.#waveFrontierKey(ledger, docs.plan);
    // The observed faces keyed by their `PIPELINE_FACES` key — the router owns the
    // order, so the board re-declares none (it only reports facts).
    const report: PipelineFaceReport = {
      "phase-spec": {
        closed: ledger.lineClosed("spec", "spec"),
        active: docs.spec === null ? null : ledger.lineRoute("spec", "spec"),
        target: docs.spec === null ? null : { type: "spec", id: docs.spec },
      },
      plan: {
        closed: ledger.lineClosed("plan", "plan"),
        active: docs.plan === null ? null : ledger.lineRoute("plan", "plan"),
        target: docs.plan === null ? null : { type: "plan", id: docs.plan, plan: docs.plan },
      },
      wave: {
        // The wave face is exhausted (skipped) only when the plan yields a wave set
        // and every wave is done — an empty wave segment (no plan) is not an exhausted
        // face (nothing was closed), so it stays the frontier and hands off.
        closed: waves.length > 0 && waves.every((wave) => wave.marker === PROGRESS_MARKERS.done),
        active: waveKey === null ? null : ledger.waveLineRoute(waveKey),
        target: docs.plan === null ? null : { type: "wave", id: waveKey ?? "", plan: docs.plan },
      },
      branch: {
        closed: ledger.lineClosed("branch", "branch"),
        active: ledger.lineRoute("branch", "branch"),
        target: { type: "branch", id: "branch", plan: docs.plan ?? undefined },
      },
    };
    const next = NextStepRouter.walk(report);
    return renderer.render(next.route, next.target);
  }

  /** The plan's open frontier wave key — the ready batch over the node's `closedWaves()`
   *  set, the SAME derivation the dispatch engine's task-graph frontier walks (T26, the
   *  wave-unitary model). Null when the plan is absent or no wave remains open — the wave
   *  face then holds no active hop (a not-yet-started wave line hands off to the next face). */
  static #waveFrontierKey(ledger: Ledger, planPath: string | null): string | null {
    const graph = BoardView.#planGraph(planPath);
    if (graph === null) return null;
    const frontier = graph.frontier(ledger.closedWaves());
    return frontier.length === 0 ? null : frontier.join(",");
  }

  /** The plan's task graph — the ONE guarded plan read shared by the wave frontier
   *  key and the wave segment (`readFileSync` throwing on an unreadable plan is
   *  caught here: a null plan path or an unreadable/absent file yields null, honoring
   *  the wave face's "degradation, never a throw" contract). */
  static #planGraph(planPath: string | null): TaskGraph | null {
    if (planPath === null) return null;
    try {
      return new TaskGraph(
        new PlanDocType("plan").parse(readFileSync(planPath, "utf8").split("\n")),
      );
    } catch {
      return null;
    }
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
    const graph = BoardView.#planGraph(planPath);
    if (graph === null) return [];
    const report = graph.report(ledger.closedWaves());
    const done = new Set(report.done);
    const currentIndex = report.waves.findIndex((wave) => wave.some((id) => !done.has(id)));
    return report.waves.map((wave, index) => {
      const closed = wave.every((id) => done.has(id));
      const marker = closed
        ? PROGRESS_MARKERS.done
        : index === currentIndex
          ? PROGRESS_MARKERS.current
          : PROGRESS_MARKERS.pending;
      return {
        label: `W${index + 1} {${wave.join(",")}}`,
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
