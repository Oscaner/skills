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
// progress projection, the render face (the phase/program board layouts) and the
// pipeline OBSERVATION (`#pipelineFacts`). The doc type is the DECLARED fact — the
// front-matter `doc-type:` head key (spec §12 · D34) — never a filename-suffix
// derivation; an absent key reads null and the consumer blocks (zero dual-read
// fallback).
//
// P22 §5.2 — the board's `next:` line renders an INJECTED `NextHop` and judges
// nothing: the pipeline traversal (the four face-order rules) lives on the
// assembly face (`face/cli.ts`), the ONE derivation is `NextStepRouter#nextHop`,
// and the ONE literal renderer is `RouteRenderer` (shared with the capsule). The
// board only OBSERVES each face's facts (`#pipelineFacts`) and renders.
//
// P22 §5.3 — the default layout aggregates each line's rounds BY VERB into
// `{label} {count}{attempt} {mark}` tokens (the judgement glyph is mandatory, the
// findings count rides a `+N` suffix, a re-dispatch carries its `a{attempt}`
// superscript); range forms never render (there is no `--verbose` in this phase).
// Each wave line's label carries the wave's task scope in braces (`W1 {5,11}`)
// with the ✔/▶/○ marker column fixed-width aligned.
//
// Module-level exports are types / constants / the classes — zero behavior-carrying
// bare functions (the plan's zero-bare-function discipline).

import { readFileSync } from "node:fs";
import path from "node:path";
import { PlanDocType } from "../contract/doc.ts";
import { FrontMatterExtractor } from "../contract/frontmatter.ts";
import type { DocKey } from "../contract/project.ts";
import { DOC_KEYS } from "../contract/project.ts";
import { ConfigLoader } from "../infra/config.ts";
import { type RepoPath, RepoRoot } from "../infra/root.ts";
import { ENGINE_RUNTIME } from "../infra/runtime.ts";
import { type DocEntry, SlugIndex, type SlugRole } from "../infra/slug-index.ts";
import { Workspace, WorkspaceRoot } from "../infra/workspace.ts";
import type { RouteTarget, TargetType } from "../session/faces.ts";
import { TaskGraph } from "../session/graph.ts";
import type { InFlightState } from "../session/inflight.ts";
import { Ledger, type ProgressData, type RoundRecord, RoundRecords } from "../session/ledger.ts";
import {
  type DocClassVerdict,
  type NextHop,
  NextStepRouter,
  PIPELINE_FACES,
  PIPELINE_NEXT,
  type PipelineFaceReport,
  type PipelineFaceState,
  type Route,
} from "../session/next.ts";
import { PROGRESS_LEGEND, PROGRESS_MARKERS } from "./graph-view.ts";
import { type RouteChannelRow, RouteRenderer } from "./route-render.ts";
import type { Words } from "./words.ts";

/** The verb render order of a line's rounds tokens — the stable display order the
 *  board's aggregated cells follow (an unexpected verb appends after these, never
 *  dropped). */
const VERB_ORDER: readonly string[] = ["implement", "review", "branch-review", "fix"];

/** The judgement glyphs of one aggregated token (spec §5.3 — the mark is MANDATORY:
 *  `✓` a completed round, `✗` a round that failed its target action). */
const JUDGEMENT_MARKERS = { passed: "✓", failed: "✗" } as const;

/** One rendered board — the stdout lines + the process exit code (0 on a clean
 *  board, 2 when a present doc line carried no `doc-type:` declaration). */
export interface BoardRender {
  /** The board's stdout lines (the header, the body, the legend) — joined with `\n`. */
  lines: readonly string[];
  /** The board's process exit code: 0 (clean) or 2 (a missing doc-type declaration). */
  exitCode: number;
}

/** One board line's projected data — a doc line (`overall` / `spec` / `plan`), the
 *  `branch` line, or one derived wave line. Each line carries its own round RECORDS
 *  (the `progress.json` row of its key) and, for wave lines, the derived ✔/▶/○
 *  marker. */
export interface BoardLine {
  /** The line's label — `overall` / `spec` / `plan` / `branch`, or the wave label (`W1`). */
  label: string;
  /** The line's doc version (null for the branch/wave lines — no doc). */
  version: string | null;
  /** The line's doc status (null for the branch/wave lines). */
  status: string | null;
  /** The line's declared doc type (spec §12 · D34; null for the branch/wave lines). */
  docType: DocKey | null;
  /** The line's round records (identity + verdict), the aggregation's input — never
   *  a count and never a pre-grouped map (the record is the ONE read shape). */
  rounds: readonly RoundRecord[];
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

/** The board's per-face OBSERVATION of the pipeline (spec §5.2) — the facts the
 *  board reads off the ledger and the plan, plus the ledger the assembly face hands
 *  the derivation (the round records' own read point). Pure facts: the traversal and
 *  the derivation belong to the assembly face. */
export interface BoardPipelineFacts {
  /** The node's ledger — the round/closure read face the hop derivation consumes. */
  readonly ledger: Ledger;
  /** One observation per `PIPELINE_FACES` key (the order stays `PIPELINE_FACES`'). */
  readonly report: PipelineFaceReport;
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

/** The label column of the board's line rows — `  ` + the label padded to this
 *  width (`overall` is the longest verb at 7), so every value starts in one column. */
const LABEL_WIDTH = 9;

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

  /** docClassOf(root, target) — the pipeline-station discrimination of one render
   *  target (spec §5.2 · D33): a doc shape's class reads its DECLARED type (the
   *  front-matter `doc-type:` key — the ONE declaration reading face above), never
   *  the filename suffix or the `--type` spelling; the node shapes key by their own
   *  type. `blocked` — the key is missing (the renderer prints the BLOCKED face);
   *  `terminal` — no pipeline seam carries the declared class (`single-spec`, the
   *  `PipelineKey` derivation excludes it). This is the injected seam of the ONE hop
   *  derivation: `session/next.ts` never imports a face class, and every read face
   *  shares this ONE judgment. The basis is REQUIRED — an unrooted resolve would read
   *  the target against `process.cwd()`, so an engine invoked from a subdirectory
   *  could report a declared line as `doc-class-blocked`; the root is always the value
   *  object the read face holds. */
  static docClassOf(root: RepoRoot, target: RouteTarget): DocClassVerdict {
    if (target.type === "plan") return "plan";
    if (target.type === "wave") return "wave";
    if (target.type === "branch") return "branch";
    const declared = BoardView.readDocType(root, root.relativize(target.id));
    return declared === null ? "blocked" : declared === "single-spec" ? "terminal" : declared;
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

  /** The identity document's line word — its DECLARED `doc-type:` (spec §12 · D34), the
   *  ONE word the line keys under (`run.ts`'s `#lineKey`) and the word the pipeline
   *  station follows. `phase-spec` is the degradation default for an absent or
   *  undeclared document (that line renders `(none)` / its BLOCKED marker anyway) — it
   *  is never a translation of a declared word. */
  static #lineWordOf(entry: DocEntry | null): TargetType {
    return entry?.docType ?? "phase-spec";
  }

  /** One doc line — the header facts read from the indexed entry + the row's round
   *  RECORDS keyed by the line's `progress.json` key, resolved with the line's DECLARED
   *  word as the retired-key alias basis (a charter's pre-rename `spec` row is its own
   *  `overall` line). */
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
      rounds: BoardView.#rowRounds(progress, key, entry?.docType ?? null),
      marker: null,
    };
  }

  /** summaryCell(records) — the line's aggregated rounds cell (spec §5.3): one token
   *  per verb × judgement run (`{label} {count}{attempt} {mark}`), joined by ` · `.
   *  The count is the run's round count, the attempt superscript belongs to the run's
   *  LAST record (a re-dispatch: `fix 1 ✗ · fix 1a2 ✓`), the mark is the run's verdict
   *  (`✓` completed / `✗` failed — never omitted), and the run's graded findings ride
   *  the `+N` suffix (omitted at 0). The range form (`review 1–10 ✓`) never renders:
   *  the aggregation IS the count. */
  static summaryCell(records: readonly RoundRecord[]): string {
    const tokens: string[] = [];
    const extra = [...new Set(records.map((record) => record.op))].filter(
      (op) => !VERB_ORDER.includes(op),
    );
    for (const verb of [...VERB_ORDER, ...extra]) {
      const ofVerb = records.filter((record) => record.op === verb);
      for (const run of BoardView.#judgementRuns(ofVerb)) {
        tokens.push(BoardView.#summaryToken(verb, run));
      }
    }
    return tokens.join(" · ");
  }

  /** One aggregated token of a verb × judgement run. The `+N` suffix counts the
   *  run's graded FINDINGS, read from each round's own carrier (`carrierPath` → the
   *  handoff's `findings` array, spec §5.3) — never the round's hard/soft contract
   *  violations, which are a different fact. A record with no carrier (a legacy row,
   *  or a work-plane round whose carrier declares no findings) contributes zero. */
  static #summaryToken(verb: string, run: readonly RoundRecord[]): string {
    const mark = run[0]!.verdict.targetAction ? JUDGEMENT_MARKERS.passed : JUDGEMENT_MARKERS.failed;
    const findings = run.reduce((total, record) => total + BoardView.#findingsCountOf(record), 0);
    const suffix = findings === 0 ? "" : `+${findings}`;
    return `${verb} ${run.length}${BoardView.attemptSuffix(run[run.length - 1]!)} ${mark}${suffix}`;
  }

  /** One round's findings count — the `findings` array length of the carrier the round
   *  persisted (the judge plane's declared field). Zero when the record carries no
   *  carrier path or the file is absent/unreadable/unparseable (present facts only,
   *  never a throw on a read face). */
  static #findingsCountOf(record: RoundRecord): number {
    const at = record.carrierPath;
    if (at === null) return 0;
    const text = BoardView.#read(at);
    if (text === null) return 0;
    try {
      const value: unknown = JSON.parse(text);
      const findings = (value as { findings?: unknown } | null)?.findings;
      return Array.isArray(findings) ? findings.length : 0;
    } catch {
      return 0;
    }
  }

  /** attemptSuffix(record) — the re-dispatch superscript: `attempt === 1` renders
   *  nothing (an `a1` never appears), otherwise `a{attempt}`. */
  static attemptSuffix(record: RoundRecord): string {
    return record.attempt === 1 ? "" : `a${record.attempt}`;
  }

  /** The judgement runs of one verb — contiguous records sharing a verdict, in the
   *  stored (chronological) order, so a re-dispatch's `✗ → ✓` pair renders as two
   *  tokens and an unbroken green history collapses into one (spec §5.3). */
  static #judgementRuns(records: readonly RoundRecord[]): readonly (readonly RoundRecord[])[] {
    const runs: RoundRecord[][] = [];
    for (const record of records) {
      const last = runs[runs.length - 1];
      if (last !== undefined && last[0]!.verdict.targetAction === record.verdict.targetAction) {
        last.push(record);
      } else {
        runs.push([record]);
      }
    }
    return runs;
  }

  /** nextLine(hop, renderer) — the board's `next:` row rendered from the INJECTED
   *  hop through the shared hop renderer (`RouteRenderer#renderHop`), so the board's
   *  line and the capsule's line are byte-identical by construction. Every embedded
   *  path value renders repoRoot-relative (the renderer's own basis). A hop the
   *  renderer renders as no line degrades to the same `(none)` bytes the absent-hop
   *  row carries — the row is never built from a null value. */
  static nextLine(hop: NextHop, renderer: RouteRenderer): string {
    const value = renderer.renderHop(hop) ?? "(none)";
    return `  next:    ${value}`;
  }

  /** reasonLine(hop) — the board's `reason:` row under `next:`: the hop's OWN named
   *  fact (`NextHop.reason`), the same field the capsule's `renderReason` row prints,
   *  so the two faces state one value by construction. The PREFIX is this face's own
   *  layout literal (`  reason:  ` — the same 11-column shape `nextLine` uses); the
   *  capsule takes its prefix from the word table instead, so each face keeps its own
   *  prefix and only the token is shared. A row exists only for an existing hop: the
   *  absent hop renders `  next:    (none)` and NO reason row at all (the caller's
   *  null-next branch), never a half-built one. */
  static reasonLine(hop: NextHop): string {
    return `  reason:  ${hop.reason}`;
  }

  /** inFlightRows(state, orphans, words) — the tree's dispatch fact + the
   *  workspace's orphan handoff drafts, as board lines. The held row names the
   *  holder's IDENTITY facts alone (the operating verb, the round's cycle + attempt
   *  cells a takeover has to answer for, the wave key and the pid, spec §5.3): the
   *  child's command line, its start instant and its plan path are dispatch
   *  narrative, not board facts. A DEAD holder adds the takeover hint. The free and
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
      const identity = [
        `pid ${record.pid}`,
        `op: ${record.phase ?? "dispatch"}`,
        record.cycle === null ? null : `cycle: ${record.cycle}`,
        record.attempt === null ? null : `attempt: ${record.attempt}`,
        `slug: ${record.slug}`,
        `wave: ${record.wave ?? "none"}`,
      ].filter((cell): cell is string => cell !== null);
      rows.push(`  in-flight: ${identity.join(" · ")}${dead}`);
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
  // the render face (spec §5.3) — the entry document → board layout + next render
  // -------------------------------------------------------------------------

  /** render(index, entry, repoRoot, words, host, channels, holding, next) — the
   *  entry document's board (spec §3.1): the entry's declared `doc-type:` picks the
   *  shape — `overall` → the program board, every other type → the node board. The
   *  index supplies every related node (`program:` → overall; same slug → spec /
   *  plan), so no filename grammar participates. `next` is the INJECTED `NextHop`
   *  the node board's `next:` row renders (null = the board holds no derivable hop,
   *  the `(none)` degradation). The argv channel is threaded into the shared
   *  `RouteRenderer` (the SAME channel the capsule's route render reads, so the
   *  board's `next:` and the engine's `next:` literal compose their argv from ONE
   *  flag-spelling source). A present doc line carrying a violation renders the
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
    next: NextHop | null = null,
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
        : BoardView.#nodeBoard(lines, index, entry, root, words, host, channels, holding, next);
    lines.push("", PROGRESS_LEGEND.board);
    return { lines, exitCode };
  }

  /** The node board render — the overall/spec/plan/wave/branch rows + the next
   *  render (spec §3.1.1). The node's identity chain comes from the index
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
    next: NextHop | null,
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

    const docRows: Array<{
      readonly label: string;
      readonly entry: DocEntry | null;
      readonly line: BoardLine;
      readonly mark: string | null;
    }> = [
      {
        label: "overall",
        entry: sources.overall,
        line: BoardView.#lineOf("overall", "overall", sources.overall, overallProgress),
        mark: BoardView.#entryMark(index, sources.overall, "identity"),
      },
      {
        label: "spec",
        entry: sources.spec,
        line: BoardView.#lineOf(
          "spec",
          BoardView.#lineWordOf(sources.spec),
          sources.spec,
          progress,
        ),
        mark:
          BoardView.#entryMark(index, sources.spec, "identity") ??
          (sources.programMissing ? MARK_PROGRAM_MISSING : null),
      },
      {
        label: "plan",
        entry: sources.plan,
        line: BoardView.#lineOf("plan", "plan", sources.plan, progress),
        mark: BoardView.#entryMark(index, sources.plan, "plan"),
      },
    ];
    // The doc-name column is fixed-width: every name is padded to the widest one, so
    // the version column aligns down the block (spec §5.3).
    const nameWidth = Math.max(
      0,
      ...docRows
        .filter((row) => row.entry !== null)
        .map((row) => path.basename(row.entry!.path).length),
    );
    let blocked = false;
    for (const row of docRows) {
      const cell = BoardView.#docCell(row.entry, row.line, nameWidth, row.mark);
      lines.push(`  ${row.label.padEnd(LABEL_WIDTH)}${cell.text}`.trimEnd());
      blocked ||= cell.blocked;
    }

    const waves = BoardView.#waveLines(sources.plan?.path ?? null, progress, ledger);
    if (waves.length === 0) {
      lines.push(`  ${"wave".padEnd(LABEL_WIDTH)}(none)`);
    } else {
      // The marker column is fixed-width: every wave label is padded to the widest
      // label so the ✔/▶/○ markers align into one column (spec §5.3 · D40).
      const labelWidth = Math.max(...waves.map((wave) => wave.label.length));
      waves.forEach((wave, index) => {
        const prefix =
          index === 0 ? `  ${"wave".padEnd(LABEL_WIDTH)}` : " ".repeat(2 + LABEL_WIDTH);
        const cell = BoardView.summaryCell(wave.rounds);
        const label = wave.label.padEnd(labelWidth);
        lines.push(
          `${prefix}${label}  ${wave.marker ?? ""}${cell === "" ? "" : `  ${cell}`}`.trimEnd(),
        );
      });
    }

    const branchLine = BoardView.#roundsLine("branch", "branch", progress);
    // The branch line's mark is the SAME drift-aware judgment its pipeline facts read
    // (`Ledger#lineStateAt`, identity document = the plan): a drifted plan reopens the
    // branch face, so the mark can never print `✔ closed` while `next:` names the
    // review the gate accepts — the reopened line renders as the CURRENT face (`▶`).
    const branchState =
      ledger?.lineStateAt("branch", "branch", sources.plan?.path ?? null) ?? "open";
    const branchMark =
      branchState === "closed"
        ? `${PROGRESS_MARKERS.done} closed`
        : branchState === "reopened"
          ? `${PROGRESS_MARKERS.current} open`
          : `${PROGRESS_MARKERS.pending} open`;
    const branchRounds = BoardView.summaryCell(branchLine.rounds);
    lines.push(
      `  ${"branch".padEnd(LABEL_WIDTH)}${branchMark}${branchRounds === "" ? "" : `  ${branchRounds}`}`.trimEnd(),
    );

    lines.push("");
    if (next === null) {
      lines.push("  next:    (none)");
    } else {
      const renderer = new RouteRenderer(words, channels, host, root);
      lines.push(BoardView.nextLine(next, renderer));
      lines.push(BoardView.reasonLine(next));
    }
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
    const overallLine = BoardView.#lineOf(
      "overall",
      "overall",
      entry,
      ledger?.readProgress() ?? null,
    );
    const overallDoc = BoardView.#docCell(
      entry,
      overallLine,
      path.basename(entry.path).length,
      BoardView.#entryMark(index, entry, "identity"),
    );
    lines.push(`  ${"overall".padEnd(LABEL_WIDTH)}${overallDoc.text}`);
    lines.push("");
    let blocked = overallDoc.blocked;
    const phases = overallSlug === null ? [] : index.phaseSpecsOf(overallSlug);
    for (const phase of phases) {
      const phaseSlug = BoardView.#validSlug(phase);
      const phaseLedger = phaseSlug === null ? null : BoardView.#ledgerOf(phaseSlug, repoRoot);
      const phaseProgress = phaseLedger?.readProgress() ?? null;
      const specLine = BoardView.#lineOf("spec", "phase-spec", phase, phaseProgress);
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
        ["spec", BoardView.summaryCell(specLine.rounds)],
        ["plan", BoardView.summaryCell(planLine.rounds)],
        ["wave", waveCell],
        ["branch", BoardView.summaryCell(branchLine.rounds)],
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

  /** One doc line's cell text — the doc NAME (directory omitted, spec §5.3), the
   *  header facts and the line's aggregated rounds (`spec  prog-p1-design.md   v0.14 ·
   *  Draft   review 2 ✓`). The name is padded to the block's name column so the
   *  version column aligns; a violated line renders its `(BLOCKED)` marker in place
   *  of the rounds (blocked = true). An absent doc renders `(none)` (degradation,
   *  never a throw). */
  static #docCell(
    entry: DocEntry | null,
    line: BoardLine,
    nameWidth: number,
    mark: string | null,
  ): { text: string; blocked: boolean } {
    if (entry === null) return { text: "(none)", blocked: false };
    const name = path.basename(entry.path).padEnd(nameWidth);
    const meta = [line.version, line.status].filter((part) => part !== null).join(" · ");
    if (mark !== null) {
      const head = meta === "" ? "" : `${meta}  `;
      return { text: `${name}   ${head}${mark}`, blocked: true };
    }
    const cells: string[] = [name];
    if (meta !== "") cells.push(meta);
    const rounds = BoardView.summaryCell(line.rounds);
    if (rounds !== "") cells.push(rounds);
    return { text: cells.join("   "), blocked: false };
  }

  /** The node's ledger — the progress.json read face the render's closure/next
   *  derivation consumes (each node reads its OWN workspace). */
  static #ledgerOf(nodeSlug: string, repoRoot: string): Ledger {
    const root = new WorkspaceRoot(repoRoot, ENGINE_RUNTIME.handoffNamespace.workspaceRoot);
    return new Ledger(new Workspace(root, nodeSlug), new ConfigLoader());
  }

  /** pipelineFacts(index, entry, root) — the board's per-face OBSERVATION of the
   *  pipeline (spec §5.2): each face's closed fact, its ACTIVE C5 hop (the SAME
   *  state→next chain the dispatch engine walks — `Ledger#lineRoute` for the
   *  doc/branch lines, the plan frontier + `Ledger#waveLineRoute` for the wave line)
   *  and its render target, keyed by the ONE `PIPELINE_FACES` key set. The board
   *  reports facts; the traversal (the four face-order rules) and the ONE hop
   *  derivation belong to the assembly face. Null when the node holds no legal slug
   *  (no workspace to observe). */
  static pipelineFacts(
    index: SlugIndex,
    entry: DocEntry,
    root: RepoRoot,
  ): BoardPipelineFacts | null {
    const nodeSlug = BoardView.#validSlug(entry);
    if (nodeSlug === null) return null;
    const ledger = BoardView.#ledgerOf(nodeSlug, root.absolute);
    const sources = BoardView.#nodeSources(index, entry);
    const progress = ledger.readProgress();
    const waves = BoardView.#waveLines(sources.plan?.path ?? null, progress, ledger);
    const specPath = sources.spec?.path ?? null;
    const planPath = sources.plan?.path ?? null;
    // The identity line's OWN word — the document's DECLARED `doc-type:` — keys the
    // line and names the pipeline station (`single-spec` closes onto its `done` row).
    const specType = BoardView.#lineWordOf(sources.spec);
    // The plan's open frontier wave — the SAME ready batch the dispatch engine's
    // task-graph frontier yields (frontier over closedWaves()).
    const waveKey = BoardView.#waveFrontierKey(ledger, planPath);
    const report: PipelineFaceReport = {
      // The report KEY is the pipeline POSITION (the first face — `PIPELINE_FACES`);
      // the line's type/key/target cells are the declaration the document carries.
      "phase-spec": {
        closed: ledger.lineClosed(specType, specType),
        active: specPath === null ? null : ledger.lineRoute(specType, specType),
        target: specPath === null ? null : { type: specType, id: specPath },
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
        // The branch line's closure is judged AT its identity document (the plan): a
        // plan revision past the one the completed branch review bound reopens the
        // face, so the mark above and this frontier cell read ONE judgment.
        closed: ledger.lineStateAt("branch", "branch", planPath) === "closed",
        active: ledger.lineRoute("branch", "branch"),
        target: { type: "branch", id: "branch", plan: planPath ?? undefined },
      },
    };
    return { ledger, report };
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

  /** The node's round RECORDS for one key — read through the ledger's ONE row lookup
   *  (`Ledger.rowFor`: the retired `spec` row reads as the line its workspace DECLARES)
   *  and the ONE record normalizer (`RoundRecords.of`, legacy forms folded); the
   *  aggregation and the judgement glyphs read these records, never a pre-grouped cycle
   *  map. Failed rounds stay on the board (they consumed an identity slot); an absent row
   *  yields an empty list. */
  static #rowRounds(
    progress: ProgressData | null,
    key: string,
    identity: TargetType | null = null,
  ): readonly RoundRecord[] {
    const row = progress === null ? undefined : Ledger.rowFor(progress, key, identity);
    return RoundRecords.of(row);
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

/**
 * BoardNext — the board's next-hop assembly face (P22 §5.2): the retired router
 * `walk`'s four face-order rules, re-homed at the board's CONSTRUCTION face. The
 * board (`BoardView`) only REPORTS each pipeline face's facts; `BoardNext` decides
 * the next pipeline step (iterating the ONE `PIPELINE_FACES` order imported from
 * the session plane, never a second order declaration) and hands the result to the
 * ONE derivation (`Ledger#nextHopOf` → `NextStepRouter#nextHop`), so the board's
 * `next:` and the capsule's `next:` render ONE object. The composition root's board
 * assembly point (`face/cli.ts` `#runBoard`) constructs it.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the board's assembly fact surface — the zero-bare-function discipline admits no standalone functions here.
export class BoardNext {
  /** The board's ONE `NextHop` — null when the entry holds no legal slug (no
   *  workspace to observe) or the board is the program board (cross-phase never
   *  participates in next, spec §6.5). */
  static of(index: SlugIndex, entry: DocEntry, root: RepoRoot): NextHop | null {
    const facts = entry.docType === "overall" ? null : BoardView.pipelineFacts(index, entry, root);
    return facts === null ? null : BoardNext.#hopOf(facts, root);
  }

  /** The derivation's input face — the walked route + target, the ledger's own
   *  round facts and the declaration-reading station discrimination. The
   *  `verdict → face` assembly lives in the ONE derivation (`Ledger#nextHopOf`), so
   *  this face fills facts only. The wave frontier's OWN drift fact (D30) rides the
   *  same input object as one more cell — the derivation reads it for the reason row
   *  only, so the walked route (a `handoff` on the soft-capped / unreadable face) is
   *  never rewritten here. */
  static #hopOf(facts: BoardPipelineFacts, root: RepoRoot): NextHop {
    const next = BoardNext.#pipeline(facts.report);
    const target = next.target;
    return facts.ledger.nextHopOf({
      type: target?.type ?? "branch",
      key: target?.type === "wave" ? target.id : (target?.type ?? "branch"),
      route: next.route,
      target,
      doc: target === null ? null : target.type === "branch" ? (target.plan ?? null) : target.id,
      // The wave half is gated on the target TYPE: off the wave face `target.id` is a
      // document path, never a wave key (`facts.report.wave.active` may be non-null
      // while the frontier sits on another face). No further gate — the derivation
      // keeps the two drift values apart, so this cell can only reach a `reason:` row.
      briefDrift:
        target?.type === "wave" ? facts.ledger.briefDrifted(String(target.id)) : undefined,
      docClassOf: (candidate) => BoardView.docClassOf(root, candidate),
    });
  }

  /** The pipeline's face-to-face traversal (D40 · P22 §5.2) — the four face-order
   *  rules over the ONE `PIPELINE_FACES` order the caller REPORTS facts against:
   *    · the FRONTIER face (first not-closed) with an active C5 hop renders that hop
   *      (the in-flight work — `review` / `fix` / `implement` / `next-wave`);
   *    · the frontier has no active hop but IS entered (a target is present) → its
   *      OWN pipeline exit entry;
   *    · the frontier is NOT entered (no target — an absent doc) → the transition
   *      INTO it: the PRECEDING entered face's exit entry (a just-closed spec hands
   *      off to `cdd-plan`, never the absent plan's `cdd-dev`); none preceding → the
   *      FIRST face's exit entry;
   *    · every face closed → the LAST entered face's exit entry (the terminus —
   *      `cdd-close` for a phase slug).
   *  The order stays `PIPELINE_FACES`' (imported, never re-declared here). */
  static #pipeline(report: PipelineFaceReport): { route: Route; target: RouteTarget | null } {
    const states = PIPELINE_FACES.map((key) => report[key]);
    const frontierIndex = states.findIndex((face) => !face.closed);
    if (frontierIndex === -1) {
      const terminalIndex = BoardNext.#lastEnteredIndex(states);
      const terminal = terminalIndex === -1 ? null : states[terminalIndex]!;
      return terminal === null
        ? { route: { kind: "done" }, target: null }
        : { route: BoardNext.#exitRoute(terminalIndex, terminal), target: terminal.target };
    }
    const frontier = states[frontierIndex]!;
    if (frontier.active !== null) return { route: frontier.active, target: frontier.target };
    const anchorIndex =
      frontier.target !== null
        ? frontierIndex
        : Math.max(0, BoardNext.#lastEnteredIndex(states.slice(0, frontierIndex)));
    const anchor = states[anchorIndex]!;
    return { route: BoardNext.#exitRoute(anchorIndex, anchor), target: anchor.target };
  }

  /** The anchor face's OWN pipeline exit — the row its render TARGET declares
   *  (`PIPELINE_NEXT[target.type]`, the SAME one table the capsule's `done` face reads
   *  through the ONE derivation). The identity face's target type IS the document's
   *  declared word, so a `single-spec` closes onto its `done` row, never the phase-spec
   *  line's `cdd-plan` ref; every node face's target type is its face key, so the lookup
   *  is the face key there. A face with no target (never entered) falls back to its
   *  pipeline face's row. */
  static #exitRoute(faceIndex: number, state: PipelineFaceState): Route {
    if (state.target === null) return NextStepRouter.handoff(PIPELINE_FACES[faceIndex]!);
    return { kind: "handoff", entry: PIPELINE_NEXT[state.target.type] };
  }

  /** The index of the last OBSERVED face carrying a render target — the last face the
   *  pipeline has REACHED (a face with no target was never entered). -1 when none is. */
  static #lastEnteredIndex(states: readonly PipelineFaceState[]): number {
    for (let i = states.length - 1; i >= 0; i--) {
      if (states[i]!.target !== null) return i;
    }
    return -1;
  }
}
