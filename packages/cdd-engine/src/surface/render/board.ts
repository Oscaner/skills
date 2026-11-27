// packages/cdd-engine/src/surface/render/board.ts
// The board — one tree's progress, laid out from VALUES.
//
// INVARIANT — the board CONNECTS facts and judges none: every row it prints comes from the
// value the round layer handed it (the tree's identity, the in-flight state, the one next
// hop, the document lines with their header cells and round facts, the wave lines, the branch
// line, the tree's three fact families, the charter's phase rows and the artifact observation
// set), and every word it prints is a row of the word table. It reads no ledger, opens no
// file and resolves no name, so a board can never disagree with the command that produced the
// facts.
//
// Two render paths, one class, because a program board is the same board read at the
// charter's altitude:
//   · the NODE board — the tree's occupancy and its fact block, one row per document line and
//     per wave line, the branch row, then the `next:` / `reason:` pair;
//   · the PROGRAM board — the charter's own row, one row per phase specification the charter
//     groups, then the program's own terminal (`next:    done`). It prints no tree fact block:
//     the charter row is that board's whole header.
// Both paths print the same artifact block and the same legend; they differ only in the rows
// between them.
//
// One row's cells are its FACTS, never a pre-rendered string: a document row is its label, the
// document's name / version / status and the line's rounds; a wave row is its label, its task
// scope, its marker and its rounds; the branch row is its state and its rounds. A line's round
// tokens are composed HERE (the display site): each verb's succeeding rounds merge into ONE
// token, every failed attempt expands into its own, and the three appends — `+N` findings, the
// downgrade note, `notes +M` — ride the token they belong to, in that order.
//
// The three render attachments, each with a named input:
//   · the tree fact block (`BoardFacts`) — the orphan drafts, the crashed rounds and the
//     standing refusal, each already read by the ledger / refusal layer;
//   · the artifact observation set (`ArtifactObservation[]`) — the default face prints the
//     ANOMALOUS rounds only, `--artifacts` prints every observation with its round coordinate;
//   · the charter's phase rows (`BoardPhase[]`) — the program board's own cells.
//
// Two display switches, and neither judges: `--notes` opens the folded note bodies the default
// keeps as a count, `--artifacts` opens the whole artifact inventory.
//
// Module-level exports are the types, the two display values and the class — zero bare
// functions.

import {
  displayReason,
  REGRADE_NOTE_SEPARATOR,
  reviewKindOf,
} from "../../docs/judging/criteria.ts";
import type { NextHop } from "../../run/advance/next.ts";
import type { InFlightState } from "../../run/dispatch/inflight.ts";
import type { RefusalState } from "../../run/gate/refusal.ts";
import {
  type ArtifactObservation,
  type BoardDoc,
  type BoardFacts,
  type BoardPhase,
  type BoardRound,
  type BoardRow,
  Run,
} from "../../run/index.ts";
import type { ArtifactRead } from "../../run/ledger/artifact-reads.ts";
import type { BoardProgramWords, PhaseCellKey, Words } from "../words/words.ts";
import type { RouteRenderer } from "./route.ts";

/** The label column of the board's row block — `  ` plus the label padded to this width.
 *  `overall` is the longest verb the board prints, so every value starts in one column. */
const LABEL_WIDTH = 9;

/** The continuation column of an `art:` block — the value column of the rows beneath one
 *  `art:` header. */
const CONTINUATION = "           ";

/** The board's header — the command's own name, the same word the command surface spells. */
const HEADER = "cdd board";

/** The board's blank column — the one separator between a board's sections. */
const BLANK = "";

/** The gap between a document row's cells — the same three columns the artifact block keeps
 *  between its head and its state word. */
const CELL_GAP = "   ";

/** The phase row's title ceiling — a longer title is cut and marked with an ellipsis. */
const PHASE_TITLE_MAX = 60;

/** The verb render order of a line's round tokens — the stable display order the aggregated
 *  cells follow (an unexpected verb appends after these, never dropped). */
const VERB_ORDER: readonly string[] = ["implement", "review", "branch-review", "fix"];

/** What the board PRINTS — the two switches, and nothing it judges. */
export interface BoardDisplay {
  /** Open the folded child-note bodies (`--notes`). */
  readonly notes: boolean;
  /** Print the whole artifact inventory (`--artifacts`). */
  readonly artifacts: boolean;
}

/** The folded default — no note bodies, the anomalous artifact rows only. */
export const FOLDED_BOARD: BoardDisplay = { notes: false, artifacts: false };

/** The board's whole input: the tree's identity plus the fact cells one round-layer read
 *  produced. */
export interface BoardValue {
  /** The tree's workspace identity — the header's one value. */
  readonly slug: string;
  /** The carried rows — the occupancy, the one hop, every document line, every wave line and
   *  the branch line. */
  readonly rows: readonly BoardRow[];
  /** The tree's three fact families. */
  readonly facts: BoardFacts;
  /** The artifact observation set, already ordered by `(cycle, attempt)`. */
  readonly observed: readonly ArtifactObservation[];
  /** The charter's phase rows — a program board's own cells, empty on a node board. */
  readonly phases?: readonly BoardPhase[];
}

/** Which of the two layouts a board renders. */
export type BoardShape = "node" | "program";

/**
 * BoardView — the board's ONE renderer. Invariant: one facts value renders one board, and the
 * display switches change what is printed, never what is judged (see the file's header).
 *
 * Rule zero (over the 200-line class limit): the two layouts share the fact block, the legend,
 * the token grammar and the artifact inventory — splitting per path would give the token
 * composition two sites, which is the one thing this class exists to prevent.
 */
export class BoardView {
  readonly #words: Words;
  readonly #route: RouteRenderer;

  constructor(words: Words, route: RouteRenderer) {
    this.#words = words;
    this.#route = route;
  }

  /** The node board — the tree at one document's altitude. */
  render(value: BoardValue, display: BoardDisplay = FOLDED_BOARD): readonly string[] {
    return [
      this.#header(value),
      BLANK,
      ...this.#factRows(value),
      ...this.#nodeRows(value, display),
      BLANK,
      this.#words.legendTail("board"),
    ];
  }

  /** The program board — the charter's altitude: the charter row, its grouped phase rows,
   *  and the program's terminal. */
  renderProgram(value: BoardValue, display: BoardDisplay = FOLDED_BOARD): readonly string[] {
    const lines = [this.#header(value), BLANK, ...this.#programRows(value, display)];
    return [...lines, BLANK, this.#words.legendTail("board")];
  }

  /** The header — the command word and the tree's own identity. */
  #header(value: BoardValue): string {
    return `${HEADER}: ${value.slug}`;
  }

  /** The tree fact block — occupancy, orphans, crashed rounds, the standing refusal. It ends
   *  at the last fact row: the document rows follow in the same block, as the frozen face
   *  prints them. */
  #factRows(value: BoardValue): readonly string[] {
    const rows: string[] = [];
    const occupancy = value.rows.find((row) => row.kind === "in-flight");
    if (occupancy !== undefined && occupancy.kind === "in-flight") {
      rows.push(this.#inFlightRow(occupancy.state));
    }
    const facts = value.facts;
    for (const orphan of facts.orphans) {
      const row = this.#words.boardWords().facts.orphan;
      rows.push(`  ${row.label} ${orphan}${row.join}${row.unowned}`);
    }
    if (facts.crashed.length > 0) {
      const row = this.#words.boardWords().facts.crashed;
      const tokens = facts.crashed.map(
        (crashed) => `${crashed.op} ${crashed.cycle}·a${crashed.attempt} ${crashed.cause}`,
      );
      rows.push(`  ${row.label} ${tokens.join(row.join)}`);
    }
    rows.push(...this.#refusalRows(facts.refusal));
    // A fact block that carries more than the occupancy row is set off from the document rows
    // by one blank column; the occupancy row alone is not, and prints in the same block.
    const more =
      facts.orphans.length > 0 || facts.crashed.length > 0 || facts.refusal.kind !== "absent";
    return more ? [...rows, BLANK] : rows;
  }

  /** The occupancy row — the holder's identity, the corrupt shapes, or the free sentence.
   *  A DEAD holder adds the takeover hint the in-flight family's own renderer chooses. */
  #inFlightRow(state: InFlightState): string {
    const checked = this.#words.checkedWords().inFlight;
    if (state.kind === "absent") return `  in-flight: ${checked.free}`;
    if (state.kind === "corrupt") {
      const inFlight = this.#words.inFlightWords();
      return `  in-flight: ${state.locked ? inFlight.corruptLocked : inFlight.corruptUnlocked}`;
    }
    const record = state.record;
    const dead = state.alive ? "" : ` — ${this.#words.inFlightTakeoverHint(state.targetGone)}`;
    const cells = [
      `pid ${record.pid}`,
      `op: ${record.phase ?? "dispatch"}`,
      record.cycle === null ? null : `cycle: ${record.cycle}`,
      record.attempt === null ? null : `attempt: ${record.attempt}`,
      `slug: ${record.slug}`,
      `wave: ${record.wave ?? "none"}`,
    ].filter((cell): cell is string => cell !== null);
    return `  in-flight: ${cells.join(" · ")}${dead}`;
  }

  /** The tree's standing refusal, as its own row: `absent` prints nothing, a corrupt record
   *  prints its own line, and a standing record prints the record's own cells — the station
   *  and the conclusion are DATA, so this row spells neither. The row is an observation: it
   *  joins no aggregation and moves no count. */
  #refusalRows(state: RefusalState): readonly string[] {
    if (state.kind === "absent") return [];
    const row = this.#words.refusalWords();
    if (state.kind === "corrupt") return [`  ${row.token} ${row.corrupt}`];
    const facts = state.facts;
    return [
      `  ${row.token} ${facts.op} ${facts.cycle}·a${facts.attempt} ${facts.station} · ${facts.detail}`,
    ];
  }

  /** The node board's own rows: every document line, every wave line, the branch row, the
   *  artifact block, then the hop's two rows. */
  #nodeRows(value: BoardValue, display: BoardDisplay): readonly string[] {
    const rows = [...this.#docRows(value, display), ...this.#waveRows(value, display)];
    const branch = value.rows.find(
      (row): row is Extract<BoardRow, { kind: "branch" }> => row.kind === "branch",
    );
    if (branch !== undefined) rows.push(this.#branchRow(branch, display));
    const artifacts = this.#artifactRows(value.observed, display);
    if (artifacts.length > 0) rows.push(BLANK, ...artifacts);
    return [...rows, BLANK, ...this.#route.boardRows(this.#hopOf(value))];
  }

  /** The program board's own rows: the charter row, one row per grouped phase specification,
   *  the program seat's artifact block, then the program's terminal. */
  #programRows(value: BoardValue, display: BoardDisplay): readonly string[] {
    const docs = value.rows.filter(
      (row): row is Extract<BoardRow, { kind: "doc" }> => row.kind === "doc",
    );
    const charter = docs.find((row) => reviewKindOf(Run.docTypeOf(row.line)) === "overall");
    const rows: string[] = [];
    if (charter !== undefined) {
      rows.push(this.#docRow(charter, display, charter.doc?.name.length ?? 0));
    }
    rows.push(BLANK);
    for (const phase of value.phases ?? []) rows.push(this.#phaseRow(phase, display));
    const seat =
      charter === undefined
        ? []
        : this.#artifactRows(
            value.observed.filter((observation) => observation.line === charter.line),
            display,
          );
    if (seat.length > 0) rows.push(BLANK, ...seat);
    rows.push(BLANK, `  next:    ${this.#words.routeWord("done")}`);
    return rows;
  }

  /** One document row per recorded line — the label, the document's name and header cells,
   *  then the line's round tokens. */
  #docRows(value: BoardValue, display: BoardDisplay): readonly string[] {
    const docs = value.rows.filter(
      (row): row is Extract<BoardRow, { kind: "doc" }> => row.kind === "doc",
    );
    // The name column is fixed-width: every name is padded to the widest one, so the version
    // column aligns down the block.
    const width = Math.max(0, ...docs.map((row) => row.doc?.name.length ?? 0));
    return docs.map((row) => this.#docRow(row, display, width));
  }

  /** One document row — `  <label>  <name>   <version> · <status>   <tokens>`. A row whose
   *  document does not read prints the declared absence instead of a cell it never had. */
  #docRow(row: Extract<BoardRow, { kind: "doc" }>, display: BoardDisplay, width: number): string {
    const label = `  ${this.#labelOf(row.line).padEnd(LABEL_WIDTH)}`;
    const doc: BoardDoc | null = row.doc;
    if (doc === null) return `${label}${this.#words.boardWords().absent}`.trimEnd();
    const meta = [doc.version, doc.status].filter((cell) => cell !== null).join(" · ");
    const tokens = this.#tokensOf(row.rounds, display);
    const cells = [doc.name.padEnd(width), meta, tokens].filter((cell) => cell !== "");
    return `${label}${cells.join(CELL_GAP)}`.trimEnd();
  }

  /** One document line's label — the line's DOC-KIND word: a phase specification and a
   *  single specification are both the `spec` line on a board. */
  #labelOf(line: string): string {
    const kind = reviewKindOf(Run.docTypeOf(line));
    const lines = this.#words.boardWords().lines;
    return kind === "overall" || kind === "plan" ? lines[kind] : lines.spec;
  }

  /** One row per recorded wave line — the derived label, its task scope, the marker and the
   *  line's tokens. The marker reads the line's OWN frontier cell: `▶` marks the first wave
   *  still holding an open task, `○` every later one, and a closed wave `✔`. The label column
   *  prints the `wave` word on the FIRST row and the blank column below it, so the rows read
   *  as one segment; a tree with no wave row prints the absence, never nothing. */
  #waveRows(value: BoardValue, display: BoardDisplay): readonly string[] {
    const waves = value.rows.filter(
      (row): row is Extract<BoardRow, { kind: "wave" }> => row.kind === "wave",
    );
    const words = this.#words.boardWords();
    if (waves.length === 0) return [`  ${"wave".padEnd(LABEL_WIDTH)}${words.absent}`];
    const labels = waves.map((row, index) => `W${index + 1} {${row.tasks.join(",")}}`);
    const width = Math.max(0, ...labels.map((label) => label.length));
    const markers = words.progress.markers;
    const blank = " ".repeat(2 + LABEL_WIDTH);
    return waves.map((row, index) => {
      const marker = row.closed ? markers.done : row.frontier ? markers.current : markers.pending;
      const prefix = index === 0 ? `  ${"wave".padEnd(LABEL_WIDTH)}` : blank;
      const tokens = this.#tokensOf(row.rounds, display);
      const head = `${prefix}${(labels[index] ?? "").padEnd(width)}  ${marker}`;
      return `${head}${tokens === "" ? "" : `  ${tokens}`}`.trimEnd();
    });
  }

  /** The branch row — its state word and its rounds. A closed line is done, a reopened one is
   *  current, and an untouched one is pending; the reopened state prints the `open` word
   *  because the line IS open again. */
  #branchRow(row: Extract<BoardRow, { kind: "branch" }>, display: BoardDisplay): string {
    const markers = this.#words.boardWords().progress.markers;
    const states = this.#words.boardWords().states;
    const marker =
      row.state === "closed"
        ? markers.done
        : row.state === "reopened"
          ? markers.current
          : markers.pending;
    const word = row.state === "closed" ? states.closed : states.open;
    const tokens = this.#tokensOf(row.rounds, display);
    const head = `${"branch".padEnd(LABEL_WIDTH)}${marker} ${word}`;
    return `  ${head}${tokens === "" ? "" : `  ${tokens}`}`.trimEnd();
  }

  /** One program-board phase row — `phase <slug>  <status>   <cells>   title: <title>`. The
   *  cells print in the table's declared order with its declared join, and a cell whose line
   *  carries no round prints nothing rather than an empty key. */
  #phaseRow(phase: BoardPhase, display: BoardDisplay): string {
    const program = this.#words.boardWords().program;
    const status = phase.status ?? program.pending;
    const bodies: Partial<Record<PhaseCellKey, string>> = {};
    for (const cell of phase.cells) bodies[cell.key] = this.#tokensOf(cell.rounds, display);
    const parts: string[] = [];
    for (const key of program.cells) {
      const body = key === "wave" ? this.#waveCell(phase, program) : (bodies[key] ?? "");
      if (body !== "") parts.push(`${key} ${body}`);
    }
    const tail = parts.length === 0 ? "" : `${CELL_GAP}${parts.join(program.join)}`;
    const title = this.#titleNote(phase.title, program.title);
    return `  ${program.phase} ${phase.slug}  ${status}${tail}${title}`;
  }

  /** The phase row's wave cell — the phase's first derived wave label plus the ellipsis the
   *  table declares; a phase that derived no wave prints no wave cell. */
  #waveCell(phase: BoardPhase, program: BoardProgramWords): string {
    return phase.wave === null ? "" : program.wave.replace("{label}", phase.wave);
  }

  /** The phase row's title annotation — trimmed, and cut to the declared ceiling with an
   *  ellipsis. An absent or blank title notes nothing. */
  #titleNote(title: string | null, label: string): string {
    const trimmed = title?.trim() ?? "";
    if (trimmed === "") return "";
    const shown =
      trimmed.length <= PHASE_TITLE_MAX ? trimmed : `${trimmed.slice(0, PHASE_TITLE_MAX - 1)}…`;
    return `${CELL_GAP}${label} ${shown}`;
  }

  /** One line's round tokens — one per verb in the declared order, a verb's succeeding rounds
   *  merged into ONE token and each failed attempt expanded into its own, so a failure never
   *  drifts to the line's tail. */
  #tokensOf(rounds: readonly BoardRound[], display: BoardDisplay): string {
    const tokens: string[] = [];
    const extra = [...new Set(rounds.map((round) => round.op))].filter(
      (op) => !VERB_ORDER.includes(op),
    );
    for (const verb of [...VERB_ORDER, ...extra]) {
      const ofVerb = rounds.filter((round) => round.op === verb);
      const passed = ofVerb.filter((round) => round.passed);
      const failed = ofVerb.filter((round) => !round.passed);
      if (passed.length > 0) {
        const body =
          failed.length === 0
            ? `${passed.length}${this.#attemptSuffix(passed[passed.length - 1])}`
            : `${passed.length}/${passed.length + failed.length}`;
        tokens.push(this.#token(verb, body, this.#judgement().passed, passed, display));
      }
      for (const round of failed) {
        tokens.push(
          this.#token(
            verb,
            `${round.cycle}${this.#attemptSuffix(round)}`,
            this.#failureMark(round, passed),
            [round],
            display,
          ),
        );
      }
    }
    return tokens.join(this.#words.capsuleSeparator());
  }

  /** One token — `{verb} {body} {mark}` followed by its three appends in their fixed order:
   *  the graded findings count (`+N`), the downgrade note, and the child's `notes +M` segment
   *  whose bodies print only under `--notes` (the count never moves with the switch). */
  #token(
    verb: string,
    body: string,
    mark: string,
    run: readonly BoardRound[],
    display: BoardDisplay,
  ): string {
    const tokens = this.#words.boardWords().tokens;
    const count = (value: number): string => tokens.count.replace("{count}", String(value));
    const findings = run.reduce((total, round) => total + round.findings, 0);
    const notes = run.flatMap((round) => round.regrade ?? []);
    const note = notes.length === 0 ? "" : ` ${notes.join(REGRADE_NOTE_SEPARATOR)}`;
    const noteRows = run.flatMap((round) => round.notes);
    const bodies = display.notes
      ? noteRows.map((row) => `${REGRADE_NOTE_SEPARATOR}${displayReason(row)}`).join("")
      : "";
    const segment =
      noteRows.length === 0 ? "" : ` ${tokens.notes} ${count(noteRows.length)}${bodies}`;
    return `${verb} ${body} ${mark}${findings === 0 ? "" : count(findings)}${note}${segment}`;
  }

  /** One round's re-dispatch superscript — an `a1` never appears. */
  #attemptSuffix(round: BoardRound | undefined): string {
    if (round === undefined || round.attempt === 1) return "";
    return this.#words.boardWords().tokens.attempts.replace("{attempt}", String(round.attempt));
  }

  /** One failed attempt's mark — `✗→✓` when the SAME cycle's next attempt completed, `✗`
   *  otherwise: recovery reads exactly that one edge, and a later cycle's success is
   *  historical. */
  #failureMark(round: BoardRound, passed: readonly BoardRound[]): string {
    const recovered = passed.some(
      (other) => other.cycle === round.cycle && other.attempt === round.attempt + 1,
    );
    return recovered ? this.#judgement().recovered : this.#judgement().failed;
  }

  /** The three judgement glyphs. */
  #judgement(): Readonly<{ passed: string; failed: string; recovered: string }> {
    return this.#words.boardWords().tokens.judgement;
  }

  /** The board's `art:` block — the anomalous rounds by default, every observed round under
   *  `--artifacts` (each naming its `(cycle, attempt)` coordinate). */
  #artifactRows(
    observed: readonly ArtifactObservation[],
    display: BoardDisplay,
  ): readonly string[] {
    const rows: string[] = [];
    for (const observation of observed) {
      const anomaly = BoardView.#anomalous(observation.read);
      if (!display.artifacts && !anomaly) continue;
      const coordinate = display.artifacts
        ? ` · ${this.#words
            .artifactWords()
            .coordinate.replace("{cycle}", String(observation.cycle))
            .replace("{attempt}", String(observation.attempt))}`
        : "";
      const words = this.#words.artifactWords();
      const head = `  ${words.label.padEnd(LABEL_WIDTH)}${observation.line}${words.join}${observation.kind}${coordinate}${words.gap}${this.#words.artifactState(BoardView.#stateOf(observation.read))}`;
      rows.push(head, ...this.#artifactFacts(observation.read));
    }
    return rows;
  }

  /** One `art:` block's continuation rows — the facts behind a sidecar that sits off its
   *  name or cannot be read. A healthy or absent round carries none. */
  #artifactFacts(read: ArtifactRead): readonly string[] {
    const labels = this.#words.artifactWords().continuation;
    const value = (label: string, fact: string): string =>
      `${CONTINUATION}${label.padEnd(LABEL_WIDTH)}${fact}`;
    if (read.kind === "misplaced") {
      return [value(labels.derived, read.path), value(labels.found, read.names.join(" · "))];
    }
    if (read.kind === "invalid") {
      return [value(labels.derived, read.path), value(labels.reason, read.reason)];
    }
    return [];
  }

  /** Whether one artifact read is the anomalous pair (the default face's whole filter). */
  static #anomalous(read: ArtifactRead): boolean {
    return read.kind === "misplaced" || read.kind === "invalid";
  }

  /** One artifact read's state word key. */
  static #stateOf(read: ArtifactRead): "ok" | "absent" | "misplaced" | "invalid" {
    return read.kind;
  }

  /** The one hop the board's `next:` row renders — read off the carried row, never derived
   *  here. */
  #hopOf(value: BoardValue): NextHop | null {
    const row = value.rows.find((entry) => entry.kind === "next");
    return row !== undefined && row.kind === "next" ? row.hop : null;
  }
}
