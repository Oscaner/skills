// packages/cdd-engine/src/surface/commands/implement.ts
// `cdd implement` — the task face's dispatch shell.
//
// INVARIANT — three actions and no fourth: read the parsed flags, call ONE `run/` entry, hand
// its return value to the ONE output face. The dispatch / forecast fork reads the program
// flag's VALUE alone, so nothing here reads a record, a gate verdict or a document.

import type { FrameRequest } from "../../run/advance/frame.ts";
import type { Run } from "../../run/index.ts";
import type { CliOutcome, CommandReporter, ParsedCommand } from "./declare.ts";

/** ImplementCommand — the `implement` shell. Invariant: one frame request, one entry, one
 *  report (see the file's header). */
export class ImplementCommand {
  readonly #run: Run;
  readonly #report: CommandReporter;

  constructor(opts: { readonly run: Run; readonly report: CommandReporter }) {
    this.#run = opts.run;
    this.#report = opts.report;
  }

  /** Run one `implement` invocation. The task face is always `wave`: the verb declares no
   *  `--type`, so the type cell is the verb's own. */
  async run(parsed: ParsedCommand): Promise<number> {
    const request: FrameRequest = {
      command: "implement",
      type: "wave",
      ...(parsed.args.tasks === undefined ? {} : { tasks: parsed.args.tasks }),
      ...(parsed.args.plan === undefined ? {} : { plan: parsed.args.plan }),
      ...(parsed.args.recover === "true" ? { recover: true } : {}),
    };
    const outcome: CliOutcome = parsed.dryRun
      ? { kind: "preview-entry", value: await this.#run.previewOf(request), request }
      : { kind: "advance-entry", value: await this.#run.advance(request), request };
    return this.#report.report(outcome, parsed.commandPath);
  }
}
