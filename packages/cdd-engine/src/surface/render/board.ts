// packages/cdd-engine/src/surface/render/board.ts
// The board — one tree's progress, laid out from VALUES.
//
// INVARIANT — the board CONNECTS facts and judges none: every row it prints comes from the
// value the round layer handed it (the in-flight state, the one next hop, the document and
// wave lines, the tree's three fact families and the artifact observation set), and every
// word it prints is a row of the word table. It reads no ledger, opens no file and resolves
// no name, so a board can never disagree with the command that produced the facts.
//
// Two render paths, one class, because a program board is the same board read at the
// charter's altitude:
//   · the NODE board — the tree's occupancy, its fact block, one row per document line and
//     per wave line, then the `next:` / `reason:` pair;
//   · the PROGRAM board — the charter's own row, one row per phase specification the charter
//     groups, then the program's own terminal (`next:    done`).
// Both paths print the same fact block, the same `art:` observation block and the same
// legend; they differ only in the rows between them.
//
// Three render attachments, each with a named input:
//   · the carried rows (`BoardRow[]`) — the occupancy row and the hop;
//   · the tree fact block (`BoardFacts`) — the orphan drafts, the crashed rounds and the
//     standing refusal, each already read by the ledger / refusal layer;
//   · the artifact observation set (`ArtifactObservation[]`) — the default face prints the
//     ANOMALOUS rounds only, `--artifacts` prints every observation with its round
//     coordinate.
//
// Two display switches, and neither judges: `--notes` opens the folded note bodies the
// default keeps as a count, `--artifacts` opens the whole artifact inventory.
//
// Module-level exports are the types, the two display values and the class — zero bare
// functions.

import { REGRADE_NOTE_SEPARATOR } from "../../docs/judging/criteria.ts";
import type { NextHop } from "../../run/advance/next.ts";
import type { InFlightState } from "../../run/dispatch/inflight.ts";
import type { RefusalState } from "../../run/gate/refusal.ts";
import type { ArtifactObservation, BoardFacts, BoardRow } from "../../run/index.ts";
import type { ArtifactRead } from "../../run/ledger/artifact-reads.ts";
import type { Words } from "../words/words.ts";
import type { RouteRenderer } from "./route.ts";

/** The label column of the board's row block — `  ` plus the label padded to this width.
 *  `overall` is the longest verb the board prints, so every value starts in one column. */
const LABEL_WIDTH = 9;

/** The continuation column of an `art:` block — the value column of the rows beneath one
 *  `art:` header. */
const CONTINUATION = "           ";

/** The folded note token — the one word of the notes segment. */
const NOTES_TOKEN = "notes";

/** The board's header — the command's own name, the same word the command surface spells. */
const HEADER = "cdd board";

/** What the board PRINTS — the two switches, and nothing it judges. */
export interface BoardDisplay {
  /** Open the folded child-note bodies (`--notes`). */
  readonly notes: boolean;
  /** Print the whole artifact inventory (`--artifacts`). */
  readonly artifacts: boolean;
}

/** The folded default — no note bodies, the anomalous artifact rows only. */
export const FOLDED_BOARD: BoardDisplay = { notes: false, artifacts: false };

/** The board's whole input: the three fact cells one round-layer read produced. */
export interface BoardValue {
  /** The carried rows — the occupancy, the one hop, every document line, every wave line. */
  readonly rows: readonly BoardRow[];
  /** The tree's three fact families. */
  readonly facts: BoardFacts;
  /** The artifact observation set, already ordered by `(cycle, attempt)`. */
  readonly observed: readonly ArtifactObservation[];
  /** The child notes one line's latest review carrier carries, keyed by the line word. The
   *  default face prints the COUNT alone; `--notes` appends the bodies in the same position,
   *  so only the bytes after the count move. */
  readonly notes?: Readonly<Record<string, readonly string[]>>;
}

/** Which of the two layouts a board renders. */
export type BoardShape = "node" | "program";

/**
 * BoardView — the board's ONE renderer. Invariant: one facts value renders one board, and
 * the display switches change what is printed, never what is judged (see the file's header).
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
    return this.#render(value, display, "node");
  }

  /** The program board — the charter's altitude: the charter row, its grouped phase rows,
   *  and the program's terminal. */
  renderProgram(value: BoardValue, display: BoardDisplay = FOLDED_BOARD): readonly string[] {
    return this.#render(value, display, "program");
  }

  /** One board's whole byte set — the shared frame, then the shape's own rows. */
  #render(value: BoardValue, display: BoardDisplay, shape: BoardShape): readonly string[] {
    const words = this.#words;
    const lines: string[] = [HEADER, ""];
    const facts = this.#factRows(value);
    if (facts.length > 0) lines.push(...facts, "");
    lines.push(
      ...(shape === "program" ? this.#programRows(value, display) : this.#nodeRows(value, display)),
    );
    lines.push("", words.boardWords().progress.legend.board);
    return lines;
  }

  /** The tree fact block — occupancy, orphans, crashed rounds, the standing refusal. */
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
    return rows;
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

  /** The node board's own rows: every document line, every wave line, the artifact block,
   *  then the hop's two rows. */
  #nodeRows(value: BoardValue, display: BoardDisplay): readonly string[] {
    const rows: string[] = [];
    let waveIndex = 0;
    for (const row of value.rows) {
      if (row.kind === "doc") {
        rows.push(
          this.#docRow(row.line, row.state, row.rounds, row.batch) +
            this.#notesTail(value, row.line, display),
        );
      }
      if (row.kind === "wave") {
        waveIndex += 1;
        rows.push(
          this.#waveRow(waveIndex, row.tasks, row.phase !== null, row.closed) +
            this.#notesTail(value, row.line, display),
        );
      }
    }
    const artifacts = this.#artifactRows(value.observed, display);
    if (artifacts.length > 0) rows.push("", ...artifacts);
    rows.push("", ...this.#route.boardRows(this.#hopOf(value)));
    return rows;
  }

  /** The program board's own rows: the charter row, one row per grouped phase
   *  specification, the artifact block, then the program's terminal. */
  #programRows(value: BoardValue, display: BoardDisplay): readonly string[] {
    const docs = value.rows.filter((row) => row.kind === "doc");
    const rows = docs.map((row) =>
      row.kind === "doc" ? this.#docRow(row.line, row.state, row.rounds, row.batch) : "",
    );
    const artifacts = this.#artifactRows(value.observed, display);
    if (artifacts.length > 0) rows.push("", ...artifacts);
    rows.push("", `  next:    ${this.#words.routeWord("done")}`);
    return rows;
  }

  /** The notes segment of one line's row — ` notes +M` folded, ` notes +M; <body>…`
   *  expanded. Zero bytes when the line carries no note, and the count never moves with the
   *  switch: only what follows it does. */
  #notesTail(value: BoardValue, line: string, display: BoardDisplay): string {
    const notes = value.notes?.[line] ?? [];
    if (notes.length === 0) return "";
    const head = ` ${NOTES_TOKEN} +${notes.length}`;
    return display.notes
      ? `${head}${REGRADE_NOTE_SEPARATOR}${notes.join(REGRADE_NOTE_SEPARATOR)}`
      : head;
  }

  /** One document line's row — its line word, its state marker and the two counts the
   *  ledger recorded. A zero cell is not printed: an absent count is zero bytes, never a
   *  `0` the reader has to interpret. */
  #docRow(line: string, state: string, rounds: number, batch: number): string {
    const markers = this.#words.boardWords().progress.markers;
    const marker =
      state === "closed" ? markers.done : state === "open" ? markers.pending : markers.current;
    const counts = [
      rounds === 0 ? "" : `rounds ${rounds}`,
      batch === 0 ? "" : `batch ${batch}`,
    ].filter((cell) => cell !== "");
    const tail = counts.length === 0 ? "" : ` · ${counts.join(" · ")}`;
    return `  ${line.padEnd(LABEL_WIDTH)}${marker} ${state}${tail}`;
  }

  /** One wave line's row — the derived wave label, its task scope in braces and the wave's
   *  marker. A closed wave is done; an open wave with an open round is the current one. */
  #waveRow(index: number, tasks: readonly number[], open: boolean, closed: boolean): string {
    const markers = this.#words.boardWords().progress.markers;
    const marker = closed ? markers.done : open ? markers.current : markers.pending;
    const scope = `{${tasks.join(",")}}`;
    return `  ${"wave".padEnd(LABEL_WIDTH)}W${index} ${scope}  ${marker}`;
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
