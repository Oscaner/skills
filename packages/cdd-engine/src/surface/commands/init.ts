// packages/cdd-engine/src/surface/commands/init.ts
// `cdd init` — the repo-independent harness bootstrap.
//
// INVARIANT — three actions and no fourth: read the parsed flags, call `Provisioner`'s ONE
// plan (then its ONE run, or the preview render), and hand the rendered lines to the ONE
// output face. Both writers belong to that face: the progress rows and the green summary ride
// stdout, the first-failure report's three rows ride stderr, and the failure's `exit <code>`
// cell is `apply`'s own value. Nothing here spawns, formats a step or decides a tier.

import type { HostId } from "../../env/process/host.ts";
import type { Provisioner, ProvisionRequest, ProvisionStep } from "../../env/provision/init.ts";
import type { InitFacts, InitLine, InitRenderer } from "../render/init.ts";
import type { CliOutcome, CommandReporter, ParsedCommand } from "./declare.ts";

/** InitCommand — the `init` shell. Invariant: one plan, one run, one report (see the file's
 *  header). */
export class InitCommand {
  readonly #provisioner: Provisioner;
  readonly #renderer: InitRenderer;
  readonly #report: CommandReporter;

  constructor(opts: {
    readonly provisioner: Provisioner;
    readonly renderer: InitRenderer;
    readonly report: CommandReporter;
  }) {
    this.#provisioner = opts.provisioner;
    this.#renderer = opts.renderer;
    this.#report = opts.report;
  }

  /** Run one `init` invocation. */
  async run(parsed: ParsedCommand): Promise<number> {
    const request: ProvisionRequest = InitCommand.requestOf(parsed);
    const host = (parsed.args.harness ?? "claude") as HostId;
    const steps: readonly ProvisionStep[] = this.#provisioner.plan(host, request);
    const facts: InitFacts = {
      host,
      shape: request.shape,
      recommended: request.recommended,
      steps,
    };
    if (parsed.dryRun) {
      const outcome: CliOutcome = {
        kind: "init",
        lines: this.#renderer.preview(facts),
        exitCode: 0,
      };
      return this.#report.report(outcome, parsed.commandPath);
    }
    const applied = await this.#provisioner.apply(steps, (index) =>
      this.#report.progress(InitCommand.#only(this.#renderer.progress(facts, index))),
    );
    const outcome: CliOutcome =
      applied.kind === "green"
        ? { kind: "init", lines: this.#renderer.green(facts), exitCode: 0 }
        : {
            kind: "init",
            lines: this.#renderer.failure(facts, applied.index, applied.exitCode),
            exitCode: 1,
          };
    return this.#report.report(outcome, parsed.commandPath);
  }

  /** The parsed flags, as the provisioning request — an absent flag is the core-only install
   *  face, never a derived default. */
  static requestOf(parsed: ParsedCommand): ProvisionRequest {
    return {
      shape: parsed.args.update === "true" ? "update" : "install",
      recommended: parsed.args.includeRecommends === "true",
    };
  }

  /** One line as the sequence array `progress` takes. */
  static #only(line: InitLine): readonly InitLine[] {
    return [line];
  }
}
