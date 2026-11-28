// packages/cdd-engine/src/surface/commands/board.ts
// `cdd board` — the progress board's pure read.
//
// INVARIANT — three actions and no fourth: read the parsed flags, call `Run#boardOf` ONCE,
// hand its value to the ONE output face with the two display switches. The shell judges
// neither which family prints nor which round is anomalous: `--notes` and `--artifacts` are
// boolean VALUES the board renderer reads, and the tree-level refusal, the in-flight record
// and the artifact inventory are all the read's own cells.
//
// The entry document's target TYPE is not argv at all — it is the declaration the document
// itself carries, so it arrives through the injected `TargetTypeRead` the composition root
// resolves with one document read. A shell that guessed it would put a second document reader
// behind one board.

import type { FrameRequest } from "../../run/advance/frame.ts";
import type { TargetType } from "../../run/advance/target-faces.ts";
import type { Run } from "../../run/index.ts";
import type { BoardDisplay } from "../render/board.ts";
import type { CliOutcome, CommandReporter, ParsedCommand } from "./declare.ts";

/** The entry document's declared target type — the board's one non-argv cell. */
export type TargetTypeRead = (parsed: ParsedCommand) => TargetType;

/** BoardCommand — the `board` shell. Invariant: one board read, one report (see the file's
 *  header). */
export class BoardCommand {
  readonly #run: Run;
  readonly #typeOf: TargetTypeRead;
  readonly #report: CommandReporter;

  constructor(opts: {
    readonly run: Run;
    readonly typeOf: TargetTypeRead;
    readonly report: CommandReporter;
  }) {
    this.#run = opts.run;
    this.#typeOf = opts.typeOf;
    this.#report = opts.report;
  }

  /** Run one `board` invocation. */
  async run(parsed: ParsedCommand): Promise<number> {
    const value = await this.#run.boardOf(BoardCommand.requestOf(parsed, this.#typeOf(parsed)));
    const outcome: CliOutcome = {
      kind: "board-entry",
      value,
      display: BoardCommand.displayOf(parsed),
    };
    return this.#report.report(outcome, parsed.commandPath);
  }

  /** The board's two display switches, as the flags' own values — an absent flag is the
   *  folded default, never a derived one. */
  static displayOf(parsed: ParsedCommand): BoardDisplay {
    return {
      notes: parsed.args.notes === "true",
      artifacts: parsed.args.artifacts === "true",
    };
  }

  /** The parsed flags, as the board read's argv-side input. */
  static requestOf(parsed: ParsedCommand, type: TargetType): FrameRequest {
    return {
      command: "board",
      type,
      ...(parsed.args.plan === undefined ? {} : { plan: parsed.args.plan }),
      ...(parsed.args.spec === undefined ? {} : { spec: parsed.args.spec }),
    };
  }
}
