// packages/cdd-engine/src/surface/commands/issue.ts
// `cdd issue render` — the aggregate body from a stdin findings payload.
//
// INVARIANT — three actions and no fourth: read one stdin body, call ONE `surface/render`
// entry, hand its report over unchanged. The stdin contract's two refusals (a malformed JSON
// body and a shape-valid-but-violating one) are that renderer's own two shapes, so this shell
// reads no field and validates nothing.

import type { IssueBodyRenderer, IssueReport } from "../render/issue.ts";
import type { CliOutcome, CommandReporter, ParsedCommand } from "./declare.ts";

/** The stdin seam — the composition root's one read of the process's standard input. */
export type StdinRead = () => string;

/** IssueCommand — the `issue` shell. Invariant: one stdin read, one render, one report (see
 *  the file's header). */
export class IssueCommand {
  readonly #renderer: IssueBodyRenderer;
  readonly #stdin: StdinRead;
  readonly #report: CommandReporter;

  constructor(opts: {
    readonly renderer: IssueBodyRenderer;
    readonly stdin: StdinRead;
    readonly report: CommandReporter;
  }) {
    this.#renderer = opts.renderer;
    this.#stdin = opts.stdin;
    this.#report = opts.report;
  }

  /** Run one `issue render` invocation. */
  run(parsed: ParsedCommand): number {
    const report: IssueReport = this.#renderer.report(this.#stdin());
    const outcome: CliOutcome = { kind: "issue-report", report };
    return this.#report.report(outcome, parsed.commandPath);
  }
}
