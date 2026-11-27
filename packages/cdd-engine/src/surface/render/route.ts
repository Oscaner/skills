// packages/cdd-engine/src/surface/render/route.ts
// The route face — the ONE place a `next:` line, a `reason:` row and the `checked:` block
// are spelled.
//
// INVARIANT — one fact, one assembly point: the capsule's `next:` and the board's `next:`
// are the SAME renderer's bytes for the SAME `NextHop`, the line gate's refusal line and the
// dry-run preview's refusal body are the same function of the same verdict, and the
// `checked:` rows the real dispatch prints are the rows a preview prints. A second
// assembly point anywhere is how two faces start disagreeing about one hop.
//
// The renderer reads the word table and nothing else: no ledger, no clock, no document, no
// file. Every sentence it prints is a row of `words` (the route vocabulary, the refusal
// vocabulary, the checked vocabulary, the in-flight recovery sentences), so the only bytes
// this file owns are the layout — the column widths and the joins between a row's own cells.
//
// The parts, and who reads them:
//   · `nextValue` / `reasonValue` — the hop's two VALUES (`route` payload + named reason);
//   · `capsuleRows` — the capsule's `next:` / `reason:` rows;
//   · `boardRows` — the board's own two columns for the same hop;
//   · `checkedBlock` — the `checked:` heading plus one line per row of the caller's row set
//     (the row set is CARRIED by the verdict that produced it — this file never re-derives
//     which rules ran);
//   · `refusalBody` / `refusalDetails` — the refusal's one line and its detail rows, with
//     the wave-board's three sections for the `split` cause (read from `graph.ts`, which is
//     the only place a wave board is laid out);
//   · `lineRefusalText` — the task face's own refusal line
//     (`cdd <verb>: cannot dispatch a <phase> round — <reject>`).
//
// Module-level exports are types, the declared flag table and the class — zero bare
// functions.

import { REFS } from "../../env/process/host.ts";
import {
  NEXT_HOP_REASON,
  type NextHop,
  type Route,
  type WaveGateReason,
} from "../../run/advance/next.ts";
import type { RouteTarget } from "../../run/advance/target-faces.ts";
import type { WaveVerdict } from "../../run/advance/wave.ts";
import type { TargetFact } from "../../run/dispatch/inflight.ts";
import type {
  CheckedReading,
  CheckedRow,
  InFlightWord,
  PreFlightReason,
  PreFlightVerdict,
} from "../../run/gate/preflight.ts";
import type { Words } from "../words/words.ts";
import { type GraphTree, GraphView } from "./graph.ts";

/** One argv-channel row — the flag spelling a literal renders. The channel is the parse's
 *  own declaration; this file reads the spelling and never hard-codes a second one. */
export interface RouteChannelRow {
  readonly flag?: string;
}

/** The argv channel, as this face reads it. A key with no row falls back to `--<key>`, so a
 *  literal never lands a bare word where a flag belongs. */
export type RouteChannels = Readonly<Record<string, RouteChannelRow>>;

/** The board's two value columns — `next:` and `reason:` start their values at the same
 *  one, which is why the labels carry their own trailing space run. */
const BOARD_NEXT = "  next:    ";
const BOARD_REASON = "  reason:  ";

/** The `(none)` degradation the board prints when no hop exists — a value, never a blank. */
const BOARD_NO_NEXT = "(none)";

/** One refusal, as this face reads it: the structure leg's verdict or the wave gate's. */
export type RefusalVerdict = PreFlightVerdict | WaveVerdict;

/**
 * RouteRenderer — the route face's whole byte surface (see the file's header). Invariant:
 * every method answers bytes derived from the word table plus the values it is handed, so
 * two faces reading one fact print one row.
 */
export class RouteRenderer {
  readonly #words: Words;
  readonly #host: string;
  readonly #channels: RouteChannels;
  readonly #graph: GraphView;

  constructor(
    words: Words,
    opts: { readonly host?: string; readonly channels?: RouteChannels } = {},
  ) {
    this.#words = words;
    this.#host = opts.host ?? "";
    this.#channels = opts.channels ?? {};
    this.#graph = new GraphView(words);
  }

  /** The `next:` VALUE of one hop; `null` when the hop is absent (the failure face) or when
   *  the present hop stands for no dispatchable route. */
  nextValue(hop: NextHop | null): string | null {
    if (hop === null) return null;
    if (hop.route?.kind === "soft-cap") return hop.route.message;
    if (hop.hop !== null && hop.route !== null) return this.render(hop.route, hop.target);
    if (hop.to !== null) return this.render({ kind: "handoff", entry: hop.to }, hop.target);
    if (hop.reason === NEXT_HOP_REASON.docClassBlocked) {
      return `${this.#words.station("blocked")} ${this.#words.routeWord("docType")}`;
    }
    return this.#words.routeWord("done");
  }

  /** The `reason:` VALUE of one hop — the named fact that selected it. */
  reasonValue(hop: NextHop): string {
    return hop.reason;
  }

  /** The capsule's two route rows: `next: <value>` then `reason: <token>`. An absent hop
   *  prints neither row, and the two rows are read off the SAME hop, so they cannot
   *  disagree. */
  capsuleRows(hop: NextHop | null): readonly string[] {
    const value = this.nextValue(hop);
    if (hop === null || value === null) return [];
    return [
      `${this.#words.capsuleLine("next")} ${value}`,
      `${this.#words.capsuleLine("reason")} ${this.reasonValue(hop)}`,
    ];
  }

  /** The board's two rows for the same hop. `next:` prints the `(none)` degradation when no
   *  hop exists and NO `reason:` row — a half-built pair is never printed. */
  boardRows(hop: NextHop | null): readonly string[] {
    const value = this.nextValue(hop);
    if (hop === null || value === null) return [`${BOARD_NEXT}${BOARD_NO_NEXT}`];
    return [`${BOARD_NEXT}${value}`, `${BOARD_REASON}${this.reasonValue(hop)}`];
  }

  /** The `checked:` block — the heading plus one row per carried row. The reading's word
   *  selection is the word table's: a gate row prints its own label, a rule row its result,
   *  a yield its declared reason. */
  checkedBlock(checked: readonly CheckedRow[]): readonly string[] {
    const words = this.#words;
    return [
      words.checkedWords().heading,
      ...checked.map((row) => `  ${RouteRenderer.#rowLine(words, row)}`),
    ];
  }

  /** One checked row's line — the row's own label plus its value, except the plan-ledger
   *  row whose declared word already begins with that label (printing it twice would read as
   *  two rows of one fact). */
  static #rowLine(words: Words, row: CheckedRow): string {
    const reading = row.reading;
    if (reading.kind === "plan-ledger") {
      return words.checkedWords().planAhead.replace("{count}", String(reading.ahead));
    }
    if (reading.kind === "ran") return row.row;
    return `${row.row}: ${RouteRenderer.#valueOf(words, reading)}`;
  }

  /** One reading's value word — the cells that stand beside a row's own label. */
  static #valueOf(words: Words, reading: CheckedReading): string {
    const checked = words.checkedWords();
    if (reading.kind === "skipped") return words.checkedSkip(reading.reason);
    if (reading.kind === "in-flight") {
      return RouteRenderer.#inFlightWord(words, reading.state, reading.pid, reading.targetGone);
    }
    if (reading.kind === "rule") {
      if (reading.result === "passed") return checked.passed;
      if (reading.result === "failed") return checked.failed;
      return checked.warned.replace("{count}", String(reading.count));
    }
    return "";
  }

  /** The in-flight row's five words. The fourth state is the in-flight family's own naked
   *  line (the same renderer the board and the preview read), never a sixth word here. */
  static #inFlightWord(
    words: Words,
    state: InFlightWord,
    pid: number | undefined,
    targetGone: readonly string[] | undefined,
  ): string {
    const checked = words.checkedWords().inFlight;
    if (state === "free") return checked.free;
    if (state === "held") return checked.held.replace("{pid}", String(pid ?? 0));
    if (state === "stale") return checked.stale.replace("{pid}", String(pid ?? 0));
    if (state === "corrupt-locked") return checked.corruptLocked;
    if (state === "corrupt-unlocked") return checked.corruptUnlocked;
    return words.inFlightTargetGone((targetGone ?? []) as readonly TargetFact[]);
  }

  /** The refusal's ONE line, without the channel anchor: `<token> · <sentence>`. `fill` is
   *  the template's own value where the reason word carries one — a graph refusal's
   *  violation count, or the filled holder report a `held` refusal prints (the gate's own
   *  reading carries the pid, never the holder's command line). An absent fill never leaves a
   *  `{slot}` in the byte: the row falls back to the closed form the checked face prints. */
  refusalBody(verdict: RefusalVerdict, fill?: string | null): string {
    const stage = "open" in verdict ? RouteRenderer.#lineCause(verdict) : verdict.gate;
    const sentence = "open" in verdict ? null : this.#reasonSentence(verdict, fill ?? null);
    return sentence === null ? `${stage}` : `${stage} · ${sentence}`;
  }

  /** The refusal's detail rows, already indented as the channel prints them. The wave gate's
   *  `split` cause is the ONE cause that carries the wave board (the three sections
   *  `graph.ts` lays out); every other cause prints the details the verdict carries. */
  refusalDetails(verdict: RefusalVerdict, tree: GraphTree | null = null): readonly string[] {
    if ("open" in verdict) {
      return verdict.reason === "split" && tree !== null
        ? this.#graph
            .render(tree)
            .split("\n")
            .map((line) => `  ${line}`)
        : [];
    }
    return (verdict.details ?? []).map((detail) => `  ${detail}`);
  }

  /** The task face's refusal line — `cdd <verb>: cannot dispatch a <phase> round — <reject>`,
   *  with the hop's executable `next:` appended when the hop renders one. */
  lineRefusalText(
    verb: string,
    phase: string,
    verdict: WaveVerdict,
    hop: NextHop | null = null,
  ): string {
    const cause = RouteRenderer.#lineCause(verdict);
    const value = this.nextValue(hop);
    const reject =
      value === null ? cause : `${cause} · ${this.#words.capsuleLine("next")} ${value}`;
    return `cdd ${verb}: cannot dispatch a ${phase} round — ${reject}`;
  }

  /** The one route → literal face: the complete executable command (a line hop), the
   *  pipeline entry (a handoff), or the bare terminal word. Both the capsule and the board
   *  reach the literal through `nextValue`, so their bytes cannot fork. */
  render(route: Route, target?: RouteTarget | null): string {
    switch (route.kind) {
      case "done":
        return this.#words.routeWord("done");
      case "handoff":
        return this.#handoffText(route, target);
      case "next-wave":
        return `${this.#words.routeWord("implement")} ${this.#flag("plan")} ${this.#planOf(target)} ${this.#flag("tasks")} ${route.tasks}`;
      case "review":
        return this.#reviewText(target);
      case "fix":
        return this.#fixText(route, target);
      case "soft-cap":
        return route.message;
    }
  }

  /** The wave gate's cause token — the table's own line-leg spelling. */
  static #lineCause(verdict: WaveVerdict): WaveGateReason {
    return verdict.reason ?? "split";
  }

  /** The sentence behind one named reason. A station refusal carries no reason word at all
   *  (its conclusion is the gate's own detail rows), and the two in-flight reasons never print
   *  a `{slot}`: `held` takes the caller's filled report or the checked face's closed row, and
   *  `corrupt-record` is already a whole sentence. */
  #reasonSentence(verdict: PreFlightVerdict, fill: string | null): string | null {
    const reason: PreFlightReason | undefined = verdict.reason ?? undefined;
    if (reason === undefined) return null;
    if (reason === "graph") {
      return this.#words.refusalReason(reason).replace("{count}", fill ?? "0");
    }
    if (reason === "held") return fill ?? RouteRenderer.#heldRow(this.#words, verdict);
    return this.#words.refusalReason(reason);
  }

  /** The closed held row — the checked face's own word, filled with the pid the verdict's
   *  reading carries. A verdict that names no holder reads the free sentence. */
  static #heldRow(words: Words, verdict: PreFlightVerdict): string {
    const inFlight = words.checkedWords().inFlight;
    const holding = verdict.holding;
    if (holding === undefined) return inFlight.free;
    if (holding.kind === "held") return inFlight.held.replace("{pid}", String(holding.pid));
    if (holding.kind === "corrupt") {
      return holding.locked ? inFlight.corruptLocked : inFlight.corruptUnlocked;
    }
    return inFlight.free;
  }

  /** One declared flag's spelling (`--<key>` when the channel declares no row). */
  #flag(key: string): string {
    return this.#channels[key]?.flag ?? `--${key}`;
  }

  /** The plan path of a literal; the `<plan>` placeholder when the frame carries none. */
  #planOf(target?: RouteTarget | null): string {
    return target?.plan === undefined ? "<plan>" : target.plan;
  }

  /** The review hop's literal — `review --type <type> <type-arg>`. */
  #reviewText(target?: RouteTarget | null): string {
    const verb = this.#words.routeWord("review");
    const type = target?.type ?? null;
    if (type === "wave") {
      return `${verb} ${this.#flag("type")} wave ${this.#flag("tasks")} ${target?.id ?? ""} ${this.#flag("plan")} ${this.#planOf(target)}`;
    }
    if (type === "plan") {
      return `${verb} ${this.#flag("type")} plan ${this.#flag("plan")} ${target?.id ?? ""}`;
    }
    if (type === "branch") {
      return `${verb} ${this.#flag("type")} branch ${this.#flag("plan")} ${this.#planOf(target)}`;
    }
    if (type === null) return verb;
    return `${verb} ${this.#flag("type")} ${type} ${this.#flag("spec")} ${target?.id ?? ""}`;
  }

  /** The one-way fix hop's literal — `fix --type <type> <type-arg> --reviews <path>`, plus
   *  the declared readback sentence when the hop carries the sidecar it consumed. */
  #fixText(route: Extract<Route, { kind: "fix" }>, target?: RouteTarget | null): string {
    if (route.reviews === undefined) return this.#words.routeWord("fix");
    const verb = this.#words.routeWord("fix");
    const type = target?.type ?? null;
    const id = target?.id ?? "";
    const reviews = route.reviews;
    if (type === "wave") {
      return `${verb} ${this.#flag("type")} wave ${this.#flag("tasks")} ${id} ${this.#flag("plan")} ${this.#planOf(target)} ${this.#flag("reviews")} ${reviews}`;
    }
    if (type === "plan") {
      return `${verb} ${this.#flag("type")} plan ${this.#flag("plan")} ${id} ${this.#flag("reviews")} ${reviews}`;
    }
    if (type === "branch") {
      return `${verb} ${this.#flag("type")} branch ${this.#flag("plan")} ${this.#planOf(target)} ${this.#flag("reviews")} ${reviews}`;
    }
    if (type === null) {
      return `${verb} ${this.#flag("reviews")} ${reviews}`;
    }
    return `${verb} ${this.#flag("type")} ${type} ${this.#flag("spec")} ${id} ${this.#flag("reviews")} ${reviews}`;
  }

  /** The face-to-face handoff — the pipeline entry: a skill reference fills the declared
   *  instruction phrase with the host's own form, a literal fills its `<plan>` slot, and the
   *  terminal reads the bare word. */
  #handoffText(route: Extract<Route, { kind: "handoff" }>, target?: RouteTarget | null): string {
    const entry = route.entry;
    if (entry.kind === "done") return this.#words.routeWord("done");
    if (entry.kind === "literal") return entry.literal.replace("<plan>", this.#planOf(target));
    const table: Readonly<
      Record<string, Readonly<Record<string, string | undefined>> | undefined>
    > = REFS;
    const row = table[entry.ref];
    const form = row === undefined ? undefined : (row[this.#host] ?? row.claude);
    if (form === undefined) return this.#words.routeWord("done");
    return this.#words.handoffRefWord(form);
  }
}
