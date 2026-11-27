// packages/cdd-engine/src/surface/commands/review.ts
// `cdd review` — the judge face's dispatch shell.
//
// INVARIANT — three actions and no fourth: read the parsed flags, call ONE `run/` entry, hand
// its return value to the ONE output face. The dispatch / forecast fork reads the program
// flag's VALUE alone; the target type is the `--type` value, which the declaration has
// already validated against its domain.

import type { FrameRequest } from "../../run/advance/frame.ts";
import type { TargetType } from "../../run/advance/target-faces.ts";
import type { Run } from "../../run/index.ts";
import type { CliOutcome, CommandReporter, ParsedCommand } from "./declare.ts";

/** ReviewCommand — the `review` shell. Invariant: one frame request, one entry, one report
 *  (see the file's header). */
export class ReviewCommand {
  readonly #run: Run;
  readonly #report: CommandReporter;

  constructor(opts: { readonly run: Run; readonly report: CommandReporter }) {
    this.#run = opts.run;
    this.#report = opts.report;
  }

  /** Run one `review` invocation. */
  async run(parsed: ParsedCommand): Promise<number> {
    const request: FrameRequest = ReviewCommand.requestOf(parsed);
    const outcome: CliOutcome = parsed.dryRun
      ? { kind: "preview-entry", value: await this.#run.previewOf(request), request }
      : { kind: "advance-entry", value: await this.#run.advance(request), request };
    return this.#report.report(outcome, parsed.commandPath);
  }

  /** The parsed flags, as the frame's argv-side input — one mapping, no judgment: the
   *  declaration already refused a value outside the `--type` domain. */
  static requestOf(parsed: ParsedCommand): FrameRequest {
    return {
      command: "review",
      type: (parsed.args.type ?? "wave") as TargetType,
      ...(parsed.args.tasks === undefined ? {} : { tasks: parsed.args.tasks }),
      ...(parsed.args.plan === undefined ? {} : { plan: parsed.args.plan }),
      ...(parsed.args.spec === undefined ? {} : { spec: parsed.args.spec }),
      ...(parsed.args.recover === "true" ? { recover: true } : {}),
    };
  }
}
