// packages/cdd-engine/src-next/face/board-view.ts
// The board face — the entry document → node progress board. The front-matter
// identity index (`SlugIndex`) is the ONLY node source: the entry document's
// `doc-type:` picks the board shape (overall → program board; phase-spec /
// single-spec / plan → node board), and every related node resolves through the
// index by slug (`program:` → overall; same slug → paired spec / plan). Identity
// comes from the front-matter `slug:` alone: zero file-name derivation, zero path
// guessing.
//
// This module carries the header `{version, status, docType}` read, the per-node
// progress projection, and the render face (the phase/program board layouts + the
// `next:` derivation). The doc type is the DECLARED fact — the front-matter
// `doc-type:` head key (spec §12 · D34) — never a filename-suffix derivation; an
// absent key reads null and the consumer blocks (zero dual-read fallback).
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

import { readFileSync } from "node:fs";
import { PlanDocType } from "../contract/doc.ts";
import { FrontMatterExtractor } from "../contract/frontmatter.ts";
import type { DocKey } from "../contract/project.ts";
import { DOC_KEYS } from "../contract/project.ts";
import { ConfigLoader } from "../infra/config.ts";
import { type RepoPath, RepoRoot } from "../infra/root.ts";
import { ENGINE_RUNTIME } from "../infra/runtime.ts";
import { type DocEntry, SlugIndex, type SlugRole } from "../infra/slug-index.ts";
import { Workspace, WorkspaceRoot } from "../infra/workspace.ts";
import { TaskGraph } from "../session/graph.ts";
import type { InFlightState } from "../session/inflight.ts";
import { Ledger, type ProgressData } from "../session/ledger.ts";
import { NextStepRouter, type PipelineFaceReport } from "../session/next.ts";
import { PROGRESS_LEGEND, PROGRESS_MARKERS } from "./graph-view.ts";
import { type RouteChannelRow, RouteRenderer } from "./route-render.ts";
import type { Words } from "./words.ts";

/** The verb render order of a line's `×N` cell — the stable display order the board's
 *  round cells follow (an unexpected verb appends after these, never dropped). */
const VERB_ORDER: readonly string[] = ["implement", "review", "branch-review", "fix"];

/** One rendered board — the stdout lines + the process exit code (0 on a clean
 *  board, 2 when a present doc line carried no `doc-type:` declaration). */
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

/** The node's identity chain — the three indexed documents a board row set reads
 *  (spec §2.2). `programMissing` is the phase-spec hard gate, surfaced on the spec
 *  line as `program: missing (BLOCKED)`. */
interface NodeSources {
  readonly spec: DocEntry | null;
  readonly plan: DocEntry | null;
  readonly overall: DocEntry | null;
  readonly programMissing: boolean;
}

/** The DocKey domain of the `doc-type:` declaration — the declared value must
 *  be one of the four keys; anything else reads null (present facts, never a
 *  fabricated type). Derived from the ONE DocKey declaration (contract/project.ts
 *  re-exports declare.ts's canonical tuple) — never a second copy (spec §3.2 ③). */
const DOC_TYPE_DOMAIN: readonly DocKey[] = DOC_KEYS;

/** The board's blocked-marker vocabulary (spec §3.1) — one anchor + one `(BLOCKED)`
 *  suffix per violation class, never a merged prose. */
const MARK_SLUG_MISSING = "slug: missing (BLOCKED)";
const MARK_SLUG_INVALID = "slug: invalid (BLOCKED)";
const MARK_SLUG_DUPLICATED = "slug: duplicated (BLOCKED)";
const MARK_PROGRAM_MISSING = "program: missing (BLOCKED)";
const MARK_DOC_TYPE_MISSING = "doc-type: missing (BLOCKED)";

/** The program board's phase-title annotation cap — the `title:` note renders
 *  truncated to this many characters (an ellipsis marks the cut). */
const PHASE_TITLE_MAX = 60;

/**
 * BoardView — the entry-document → board face. The identity index (`SlugIndex`)
 * is the ONLY node source: the entry document's declared `doc-type:` picks the
 * board shape and every related node resolves by slug. Pure reads — zero tree
 * writes, zero ledger writes, zero child dispatch.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the board fact-read surface — the zero-bare-function discipline admits no standalone predicate functions.
export class BoardView {
  /** readDocType(root, rel) — the doc's declared type alone (the front-matter
   *  `doc-type:` key, spec §12 · D34): the ONE declaration reading face shared
   *  by the board and the capsule's doc-class discrimination. An absent file, a
   *  missing key or an out-of-domain value reads null — the consumer
   *  blocks (zero filename-suffix fallback, zero dual-read layer). The path is the
   *  repoRoot-relative branded `RepoPath`, erased to the absolute syscall form
   *  through the ONE value object (`root.resolve`) just before the read — the brand
   *  is REAL (the absolute state is unrepresentable as a `RepoPath`, T4 §2.2), the
   *  same shape as `artifacts.readText(node, root, file)`). */
  static readDocType(root: RepoRoot, rel: RepoPath): DocKey | null {
    return BoardView.#docTypeOf(
      FrontMatterExtractor.split(BoardView.#read(root.resolve(rel)) ?? "").head.docType,
    );
  }

  /** The doc file's raw text — an absent/unreadable file reads null (the reads
   *  above degrade to null facts, never a throw). */
  static #read(docPath: string): string | null {
    try {
      return readFileSync(docPath, "utf8");
    } catch {
      return null;
    }
  }

  /** The declared doc type constrained to the DocKey domain (null otherwise). */
  static #docTypeOf(declared: string | null): DocKey | null {
    if (declared === null) return null;
    return (DOC_TYPE_DOMAIN as readonly string[]).includes(declared) ? (declared as DocKey) : null;
  }

  // -------------------------------------------------------------------------
  // the progress projection (spec §5) — the per-node progress.json single-source read
  // -------------------------------------------------------------------------

  /** The node's identity chain, resolved through the index by slug (spec §2.2):
   *  the identity document (an overall/single/phase spec), the same-slug plan, and
   *  the program overall the identity's `program:` names. An entry that is itself
   *  a plan contributes the plan and resolves its spec by the same slug. The
   *  `programMissing` fact is the phase-spec hard gate: a `program:` that names no
   *  on-disk overall (or no `program:` at all). Zero filename derivation. */
  static #nodeSources(index: SlugIndex, entry: DocEntry): NodeSources {
    const slug = BoardView.#validSlug(entry);
    const isPlan = entry.docType === "plan";
    const spec = slug === null ? (isPlan ? null : entry) : isPlan ? index.identityDoc(slug) : entry;
    const plan = isPlan ? entry : slug === null ? null : index.planOf(slug);
    const overall =
      spec?.docType === "phase-spec" && spec.program !== null
        ? index.overallOf(spec.program)
        : null;
    return {
      spec,
      plan,
      overall,
      programMissing: spec !== null && BoardView.#programMissing(index, spec),
    };
  }

  /** The entry's valid slug — the workspace key, or null when the declaration is
   *  absent or illegal (an illegal value is a violation, never a directory name). */
  static #validSlug(entry: DocEntry | null): string | null {
    if (entry === null) return null;
    return SlugIndex.isLegalSlug(entry.slug) ? entry.slug : null;
  }

  /** The line's violation marker (spec §3.1) — slug missing / illegal / duplicated,
   *  then the missing type declaration. The duplicate probe reads the SAME index
   *  judgment the dispatch pre-flight consumes (one fact, one place). */
  static #entryMark(index: SlugIndex, entry: DocEntry | null, role: SlugRole): string | null {
    if (entry === null) return null;
    if (entry.slug === null) return MARK_SLUG_MISSING;
    if (!SlugIndex.isLegalSlug(entry.slug)) return MARK_SLUG_INVALID;
    if (entry.docType === null) return MARK_DOC_TYPE_MISSING;
    return index.duplicatedRolesOf(entry.slug).includes(role) ? MARK_SLUG_DUPLICATED : null;
  }

  /** One doc line — the header facts read from the indexed entry + the row's
   *  rounds keyed by the line's `progress.json` key. */
  static #lineOf(
    label: string,
    key: string,
    entry: DocEntry | null,
    progress: ProgressData | null,
  ): BoardLine {
    return {
      label,
      version: entry?.version ?? null,
      status: entry?.status ?? null,
      docType: entry?.docType ?? null,
      rounds: BoardView.#rowRounds(progress, key),
      marker: null,
    };
  }

  /** roundsCell(rounds) — the line's `implement×1,2 · review×1,3 · fix×2,3` cell
   *  text. Each `×` cell renders the stored CYCLE NUMBERS (D28 identity: `[1,3]` is
   *  the 1st and the 3rd round, never "2 rounds"). A non-array (the retired numeric
   *  form) contributes no cell. Verbs render in the fixed board order; an
   *  out-of-order verb appends after. */
  static roundsCell(rounds: Record<string, number[]>): string {
    const cells: string[] = [];
    const verbs = [...VERB_ORDER, ...Object.keys(rounds).filter((v) => !VERB_ORDER.includes(v))];
    for (const verb of verbs) {
      const value = rounds[verb];
      if (Array.isArray(value) && value.length > 0) cells.push(`${verb}×${value.join(",")}`);
    }
    return cells.join(" · ");
  }

  /** inFlightRows(state, orphans, words) — the tree's dispatch fact + the
   *  workspace's orphan handoff drafts, as board lines. The held row names the
   *  holder's identity facts; a DEAD holder adds the takeover hint. The free and
   *  corrupt rows are the word table's declared rows — the board's hint is the same
   *  bytes the preview face and the gate print (one vocabulary, never a board
   *  literal). The orphan rows are the drafts no recorded round owns — the board
   *  lists them, never writes or deletes them. */
  static inFlightRows(
    state: InFlightState,
    orphans: readonly string[],
    words: Words,
  ): readonly string[] {
    const rows: string[] = [];
    if (state.kind === "held") {
      const record = state.record;
      const dead = state.alive ? "" : ` — ${words.inFlightWords().stealable}`;
      rows.push(
        `  in-flight: pid ${record.pid} · command: ${record.command} · started: ${new Date(record.startedAt).toISOString()} · wave: ${record.wave ?? "none"} · slug: ${record.slug}${dead}`,
      );
    } else if (state.kind === "corrupt") {
      const inFlight = words.inFlightWords();
      rows.push(`  in-flight: ${state.locked ? inFlight.corruptLocked : inFlight.corruptUnlocked}`);
    } else {
      rows.push(`  in-flight: ${words.checkedWords().inFlight.free}`);
    }
    for (const orphan of orphans) rows.push(`  orphan: ${orphan} — no recorded round owns it`);
    return rows;
  }

  // -------------------------------------------------------------------------
  // the render face (spec §5.3) — the entry document → board layout + next derivation
  // -------------------------------------------------------------------------

  /** render(index, entry, repoRoot, words, host, channels) — the entry document's
   *  board (spec §3.1): the entry's declared `doc-type:` picks the shape —
   *  `overall` → the program board, every other type → the node board. The
   *  index supplies every related node (`program:` → overall; same slug → spec /
   *  plan), so no filename grammar participates. The argv channel is threaded into
   *  the shared `RouteRenderer` (the SAME channel the capsule's route render reads,
   *  so the board's `next:` and the engine's `next:` literal compose their argv from
   *  ONE flag-spelling source). A present doc line carrying a violation renders the
   *  matching `(BLOCKED)` marker and the board exits 2 (spec §3.1 — the board's
   *  reject face is exit 2, never the dispatch CDD_BLOCKED channel). Pure reads —
   *  zero tree writes, zero ledger writes, zero child dispatch. */
  static render(
    index: SlugIndex,
    entry: DocEntry,
    repoRoot: string,
    words: Words,
    host: string,
    channels: Readonly<Record<string, RouteChannelRow>> = {},
    holding: InFlightState = { kind: "absent" },
  ): BoardRender {
    const lines: string[] = [`cdd board: ${entry.slug ?? "(none)"}`, ""];
    // The repo-basis value object — constructed ONCE at this boundary, the ONE
    // conversion exit the doc cells and the `next:` render normalize their embedded
    // paths through (T1 `RepoRoot` · D47). The raw string is threaded no further:
    // the board renders read the basis through `root.absolute` (F2 — one basis,
    // one form).
    const root = new RepoRoot(repoRoot);
    const exitCode =
      entry.docType === "overall"
        ? BoardView.#programBoard(lines, index, entry, root)
        : BoardView.#nodeBoard(lines, index, entry, root, words, host, channels, holding);
    lines.push("", PROGRESS_LEGEND.board);
    return { lines, exitCode };
  }

  /** The node board render — the overall/spec/plan/wave/branch rows + the next
   *  derivation (spec §3.1.1). The node's identity chain comes from the index
   *  (`program:` → overall; same slug → spec / plan); a missing link renders
   *  `(none)` and stays exit 0, while a violated line renders its marker and exits
   *  2. The repo-basis `root` is threaded alone (F2) — its `absolute` feeds the
   *  fs-facing helpers, its value object the path renders. */
  static #nodeBoard(
    lines: string[],
    index: SlugIndex,
    entry: DocEntry,
    root: RepoRoot,
    words: Words,
    host: string,
    channels: Readonly<Record<string, RouteChannelRow>>,
    holding: InFlightState,
  ): number {
    const repoRoot = root.absolute;
    const sources = BoardView.#nodeSources(index, entry);
    const nodeSlug = BoardView.#validSlug(entry);
    const ledger = nodeSlug === null ? null : BoardView.#ledgerOf(nodeSlug, repoRoot);
    // The tree's dispatch fact + the node workspace's orphan drafts render before the
    // line rows (a reader answers "is anyone working here?" before reading progress).
    const orphans = ledger?.orphanHandoffs() ?? [];
    for (const row of BoardView.inFlightRows(holding, orphans, words)) lines.push(row);
    if (holding.kind !== "absent" || orphans.length > 0) lines.push("");
    const progress = ledger?.readProgress() ?? null;
    const overallSlug = BoardView.#validSlug(sources.overall);
    const overallProgress =
      overallSlug === null ? null : BoardView.#ledgerOf(overallSlug, repoRoot).readProgress();

    const overallLine = BoardView.#lineOf("overall", "spec", sources.overall, overallProgress);
    const specLine = BoardView.#lineOf("spec", "spec", sources.spec, progress);
    const planLine = BoardView.#lineOf("plan", "plan", sources.plan, progress);
    const branchLine = BoardView.#roundsLine("branch", "branch", progress);
    let blocked = false;

    const overallDoc = BoardView.#docCell(
      sources.overall,
      overallLine,
      root,
      BoardView.#entryMark(index, sources.overall, "identity"),
    );
    lines.push(`  overall  ${overallDoc.text}`);
    blocked ||= overallDoc.blocked;

    const specMark =
      BoardView.#entryMark(index, sources.spec, "identity") ??
      (sources.programMissing ? MARK_PROGRAM_MISSING : null);
    const specDoc = BoardView.#docCell(sources.spec, specLine, root, specMark);
    lines.push(`  spec     ${specDoc.text}`);
    blocked ||= specDoc.blocked;

    const planDoc = BoardView.#docCell(
      sources.plan,
      planLine,
      root,
      BoardView.#entryMark(index, sources.plan, "plan"),
    );
    lines.push(`  plan     ${planDoc.text}`);
    blocked ||= planDoc.blocked;

    const waves = BoardView.#waveLines(sources.plan?.path ?? null, progress, ledger);
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

    const branchClosed = ledger?.lineClosed("branch", "branch") ?? false;
    const branchRounds = BoardView.roundsCell(branchLine.rounds);
    lines.push(
      `  branch   ${branchClosed ? `${PROGRESS_MARKERS.done} closed` : `${PROGRESS_MARKERS.pending} open`}${branchRounds === "" ? "" : `  ${branchRounds}`}`.trimEnd(),
    );

    lines.push("");
    const next =
      ledger === null
        ? "(none)"
        : BoardView.#nextOf(ledger, waves, sources, words, host, channels, root);
    lines.push(`  next:    ${next}`);
    return blocked ? 2 : 0;
  }

  /** The program board render — the overall line (its own rounds) + one summary line
   *  per phase-spec whose `program:` names this overall + `next: done` (cross-phase
   *  never participates in next, spec §6.5). The phase set derives from the ONE
   *  index (`program:` grouping — no overall child-list array). A phase row's primary
   *  key is its `slug:`, annotated with the truncated `title:`; any overall/phase
   *  violation renders its marker and exits 2 (spec §3.1 — zero silent fallback). */
  static #programBoard(lines: string[], index: SlugIndex, entry: DocEntry, root: RepoRoot): number {
    const repoRoot = root.absolute;
    const overallSlug = BoardView.#validSlug(entry);
    const ledger = overallSlug === null ? null : BoardView.#ledgerOf(overallSlug, repoRoot);
    const overallLine = BoardView.#lineOf("overall", "spec", entry, ledger?.readProgress() ?? null);
    const overallDoc = BoardView.#docCell(
      entry,
      overallLine,
      root,
      BoardView.#entryMark(index, entry, "identity"),
    );
    lines.push(`  overall  ${overallDoc.text}`);
    lines.push("");
    let blocked = overallDoc.blocked;
    const phases = overallSlug === null ? [] : index.phaseSpecsOf(overallSlug);
    for (const phase of phases) {
      const phaseSlug = BoardView.#validSlug(phase);
      const phaseLedger = phaseSlug === null ? null : BoardView.#ledgerOf(phaseSlug, repoRoot);
      const phaseProgress = phaseLedger?.readProgress() ?? null;
      const specLine = BoardView.#lineOf("spec", "spec", phase, phaseProgress);
      const planEntry = phaseSlug === null ? null : index.planOf(phaseSlug);
      const planLine = BoardView.#lineOf("plan", "plan", planEntry, phaseProgress);
      const branchLine = BoardView.#roundsLine("branch", "branch", phaseProgress);
      const mark =
        BoardView.#entryMark(index, phase, "identity") ??
        (BoardView.#programMissing(index, phase) ? MARK_PROGRAM_MISSING : null);
      const planMark = BoardView.#entryMark(index, planEntry, "plan");
      blocked ||= mark !== null || planMark !== null;
      const status = mark ?? phase.status ?? "Pending";
      // The phase's wave summary token (spec §5.3): the wave segment's first wave
      // number + an ellipsis (`wave W1…`) — the phase's wave progress at a glance,
      // derived from the SAME wave segment the phase board renders (no second read).
      const waves = BoardView.#waveLines(planEntry?.path ?? null, phaseProgress, phaseLedger);
      const waveCell = waves.length === 0 ? "" : `${waves[0]!.label.split(" ")[0]}…`;
      const parts: string[] = [];
      const cells: Array<[string, string]> = [
        ["spec", BoardView.roundsCell(specLine.rounds)],
        ["plan", BoardView.roundsCell(planLine.rounds)],
        ["wave", waveCell],
        ["branch", BoardView.roundsCell(branchLine.rounds)],
      ];
      for (const [key, cell] of cells) if (cell !== "") parts.push(`${key} ${cell}`);
      const tail = parts.join(" · ");
      const note = BoardView.#titleNote(phase.title);
      lines.push(
        `  phase ${phase.slug ?? "(none)"}  ${status}${tail === "" ? "" : `   ${tail}`}${note === "" ? "" : `   title: ${note}`}`,
      );
    }
    lines.push("");
    lines.push("  next:    done");
    return blocked ? 2 : 0;
  }

  /** The phase-spec's `program:` gate (spec §2.2): a phase-spec naming no overall
   *  (or carrying no `program:` at all) is a hard cancellation of the node. */
  static #programMissing(index: SlugIndex, entry: DocEntry): boolean {
    if (entry.docType !== "phase-spec") return false;
    return entry.program === null || index.overallOf(entry.program) === null;
  }

  /** The phase row's `title:` annotation — trimmed and truncated to
   *  `PHASE_TITLE_MAX` characters (an ellipsis marks the cut). An absent/blank
   *  title notes nothing. */
  static #titleNote(title: string | null): string {
    if (title === null) return "";
    const trimmed = title.trim();
    if (trimmed === "") return "";
    return trimmed.length <= PHASE_TITLE_MAX
      ? trimmed
      : `${trimmed.slice(0, PHASE_TITLE_MAX - 1)}…`;
  }

  /** One doc line's cell text — the doc path, the header facts and the line's
   *  rounds (spec §5.3: `overall  <path>  v2.33 · Draft   review×1,2`); a violated
   *  line renders its `(BLOCKED)` marker in place of the facts (blocked = true).
   *  An absent doc renders `(none)` (degradation, never a throw). The doc path
   *  renders repoRoot-relative through the ONE value object (D47). */
  static #docCell(
    entry: DocEntry | null,
    line: BoardLine,
    root: RepoRoot,
    mark: string | null,
  ): { text: string; blocked: boolean } {
    if (entry === null) return { text: "(none)", blocked: false };
    const rel = root.relativize(entry.path);
    const facts: string[] = [];
    if (line.version !== null) facts.push(line.version);
    if (line.status !== null) facts.push(line.status);
    if (mark !== null) {
      const head = facts.length === 0 ? "" : `${facts.join(" · ")}  `;
      return { text: `${rel}  ${head}${mark}`, blocked: true };
    }
    const cells: string[] = [rel];
    const meta = [line.version, line.status].filter((part) => part !== null).join(" · ");
    if (meta !== "") cells.push(meta);
    const rounds = BoardView.roundsCell(line.rounds);
    if (rounds !== "") cells.push(rounds);
    return { text: cells.join("   "), blocked: false };
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
    waves: readonly BoardLine[],
    sources: NodeSources,
    words: Words,
    host: string,
    channels: Readonly<Record<string, RouteChannelRow>>,
    root: RepoRoot,
  ): string {
    const renderer = new RouteRenderer(words, channels, host, root);
    const specPath = sources.spec?.path ?? null;
    const planPath = sources.plan?.path ?? null;
    // The plan's open frontier wave — the SAME ready batch the dispatch engine's
    // task-graph frontier yields (frontier over closedWaves()).
    const waveKey = BoardView.#waveFrontierKey(ledger, planPath);
    // The observed faces keyed by their `PIPELINE_FACES` key — the router owns the
    // order, so the board re-declares none (it only reports facts).
    const report: PipelineFaceReport = {
      "phase-spec": {
        closed: ledger.lineClosed("spec", "spec"),
        active: specPath === null ? null : ledger.lineRoute("spec", "spec"),
        target: specPath === null ? null : { type: "spec", id: specPath },
      },
      plan: {
        closed: ledger.lineClosed("plan", "plan"),
        active: planPath === null ? null : ledger.lineRoute("plan", "plan"),
        target: planPath === null ? null : { type: "plan", id: planPath, plan: planPath },
      },
      wave: {
        // The wave face is exhausted (skipped) only when the plan yields a wave set
        // and every wave is done — an empty wave segment (no plan) is not an exhausted
        // face (nothing was closed), so it stays the frontier and hands off.
        closed: waves.length > 0 && waves.every((wave) => wave.marker === PROGRESS_MARKERS.done),
        active: waveKey === null ? null : ledger.waveLineRoute(waveKey),
        target: planPath === null ? null : { type: "wave", id: waveKey ?? "", plan: planPath },
      },
      branch: {
        closed: ledger.lineClosed("branch", "branch"),
        active: ledger.lineRoute("branch", "branch"),
        target: { type: "branch", id: "branch", plan: planPath ?? undefined },
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
    ledger: Ledger | null,
  ): BoardLine[] {
    const graph = BoardView.#planGraph(planPath);
    if (graph === null) return [];
    const report = graph.report(ledger === null ? new Set<number>() : ledger.closedWaves());
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
}
