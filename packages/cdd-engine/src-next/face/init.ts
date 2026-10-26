// packages/cdd-engine/src-next/face/init.ts
// P20 — the harness plugin bootstrap (`cdd init`): the eighth top-level verb, a
// repo-independent face that spawns the harness's own install / update sequence.
//
// The data plane is the roster (`face/plugins.ts`): one row per package, one column
// per harness id, two command shapes per column. This module declares zero command
// bytes — it flattens the requested column in roster order and runs it serially.
//
//   · StepRunner — the narrow execution seam: one structured argv in, the child's
//     own exit code out (fail-open — a spawn failure is a code, never a throw).
//   · ExecaStepRunner — the production runner: `stdio: "inherit"` on all three
//     standard streams, so the child holds the real terminal (the harness's
//     interactive prompts and TTY judgment see what the human sees) and the
//     consumer watches the harness output live. A missing / non-executable binary
//     rides `SPAWN_FAILURE_CODE` (the shell's command-not-found convention) into
//     the same failure face — zero special-case probing.
//   · CliInit — the face class: per-step header before the spawn (the header seam
//     is the composition root's synchronous writer, so a piped log cannot reorder
//     the header behind the child's own output), first non-zero exit stops the
//     sequence, and a green run closes with one summary line. Its `--dry-run`
//     preview renders the same flattened plan as `would run:` lines and touches no
//     step runner at all — the flatten is single-source, the only branch is whether
//     a step is spawned.
//
// The dispatch execution machine (`face/termination.ts` — timeout / budget / group
// kill / heartbeat / stall judge) is never shared: a bootstrap step has no round,
// no ceiling and no session state.
//
// Module-level exports are types / declared constants / classes — zero
// behavior-carrying bare functions (the zero-bare-function discipline).

import { execa } from "execa";

import type { HostId } from "./host.ts";
import type { CliIo } from "./lifecycle.ts";
import { PLUGINS } from "./plugins.ts";

/** The one stdio face of an install step — all three standard streams inherited
 *  from the parent process. */
export const STDIO = "inherit" as const;

/** The spawn-failure code — the shell's command-not-found convention; a missing
 *  harness binary (or any non-executable argv[0]) reports this code through the
 *  ordinary failure face. */
export const SPAWN_FAILURE_CODE = 127;

/** The step-execution seam: one structured argv in, the child's exit code out. */
export interface StepRunner {
  /** Run one argv (binary first) and return its exit code — never throws. */
  run(argv: readonly string[]): Promise<number>;
}

/** The production step runner — execa's asynchronous face over the inherited
 *  standard streams. */
export class ExecaStepRunner implements StepRunner {
  async run(argv: readonly string[]): Promise<number> {
    const [binary = "", ...args] = argv;
    const result = await execa(binary, args, { stdio: STDIO, reject: false });
    // Zero exit codes only exist for a spawned child — an undefined code is the
    // spawn-failure face (ENOENT / EACCES), never a success.
    return result.exitCode ?? SPAWN_FAILURE_CODE;
  }
}

/** One flattened step — the roster row it came from plus its argv. */
interface InitStep {
  packageName: string;
  argv: readonly string[];
}

/** The init face's injected collaborators. */
export interface CliInitOptions {
  /** The failure-report / summary io face. */
  io: CliIo;
  /** The step-execution seam (production: ExecaStepRunner; tests: a stand-in). */
  runner: StepRunner;
  /** The synchronous header writer (production: writeSync(1, …)). */
  header: (line: string) => void;
}

/**
 * CliInit — the `cdd init --harness=<id> [--update]` run face. Repo-independent:
 * zero workspace writes, zero ledger, zero document reads — the harness's own
 * command sequence is the only side effect.
 */
export class CliInit {
  readonly #io: CliIo;
  readonly #runner: StepRunner;
  readonly #header: (line: string) => void;

  constructor(opts: CliInitOptions) {
    this.#io = opts.io;
    this.#runner = opts.runner;
    this.#header = opts.header;
  }

  /** The ordered step plan for one harness + shape — the ONE flatten source the
   *  preview and the real run both read. The only branch point between them is
   *  whether `StepRunner` is called, so a preview can never drift from the run. */
  #stepsOf(host: HostId, update: boolean): InitStep[] {
    const steps: InitStep[] = [];
    for (const row of PLUGINS) {
      for (const argv of update ? row[host].update : row[host].install) {
        steps.push({ packageName: row.name, argv });
      }
    }
    return steps;
  }

  /** Render the step plan the run would execute — one `would run: <argv join>` line
   *  per step, then the summary. Zero spawn, zero write: the runner is never
   *  reached on this path (a preview is a rendering, not an execution). */
  preview(host: HostId, update: boolean): readonly string[] {
    const steps = this.#stepsOf(host, update);
    return [
      ...steps.map((step) => `would run: ${step.argv.join(" ")}`),
      `init: ${steps.length} steps (${host} · ${update ? "update" : "install"}) — dry run, nothing executed`,
    ];
  }

  /** Run the harness's sequence — 0 all green, 1 the first failed step. */
  async run(host: HostId, update: boolean): Promise<number> {
    const steps = this.#stepsOf(host, update);
    const total = steps.length;
    for (const [index, step] of steps.entries()) {
      const ordinal = index + 1;
      this.#header(
        `init[${ordinal}/${total}] ${host} · ${step.packageName} · ${step.argv.slice(1).join(" ")}`,
      );
      const code = await this.#runner.run(step.argv);
      if (code !== 0) {
        this.#io.stderr(`init[${ordinal}/${total}] · ${step.argv.join(" ")} · exit ${code}\n`);
        // The hint is conditional wording — the engine parses zero harness output,
        // so it cannot know whether "not installed" caused this failure.
        if (update) {
          this.#io.stderr(
            `if the package is not installed, run cdd init --harness=${host} without --update first\n`,
          );
        }
        return 1;
      }
    }
    this.#header(`init: ${total} steps ok (${host} · ${update ? "update" : "install"})`);
    return 0;
  }
}
