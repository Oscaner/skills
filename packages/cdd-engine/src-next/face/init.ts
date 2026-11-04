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
// kill / sampling trail / stall judge) is never shared: a bootstrap step has no round,
// no ceiling and no session state.
//
// Module-level exports are types / declared constants / classes — zero
// behavior-carrying bare functions (the zero-bare-function discipline).

import { execa } from "execa";

import type { HostId } from "./host.ts";
import type { CliIo } from "./lifecycle.ts";
import { PLUGINS, type PluginTier } from "./plugins.ts";

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

/** One flattened step — the roster row it came from (name + tier) plus its argv.
 *  The `tier` rides along so the summary counts and the failure line read the step
 *  itself and never re-query the roster. */
interface InitStep {
  readonly packageName: string;
  readonly argv: readonly string[];
  readonly tier: PluginTier;
}

/** The ONE flatten request — the harness, the command shape, and whether the
 *  recommended tier rides along. A request object rather than a growing positional
 *  tail: the tier is a third axis, and `preview` / `run` must read the same shape. */
export interface InitRequest {
  /** The harness whose column is flattened. */
  readonly host: HostId;
  /** Which command shape of each column: install or update. */
  readonly shape: "install" | "update";
  /** Whether the `recommended` tier joins the core rows (`false` = core only). */
  readonly recommended: boolean;
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

  /** The ordered step plan for one request — the ONE flatten source the preview and
   *  the real run both read. A `recommended === false` request takes the `core` rows
   *  only, which is the flag-less face's byte-identical plan; `true` takes the whole
   *  table in roster order (the recommended rows carry zero claude commands, so a
   *  claude request cannot grow beyond its core span). The only branch point between
   *  preview and run is whether `StepRunner` is called, so a preview can never drift
   *  from the run. */
  #stepsOf(request: InitRequest): InitStep[] {
    const steps: InitStep[] = [];
    for (const row of PLUGINS) {
      if (!request.recommended && row.tier !== "core") continue;
      const column = row[request.host];
      for (const argv of request.shape === "update" ? column.update : column.install) {
        steps.push({ packageName: row.name, argv, tier: row.tier });
      }
    }
    return steps;
  }

  /** The tier split of one flattened plan — counted off each step's own `tier`.
   *  The tier fact travels with the step (§4.1), so no surface below re-reads the
   *  roster: `#stepsOf` is the only tier judge in this face. */
  #tierCountsOf(steps: readonly InitStep[]): { core: number; recommended: number } {
    let core = 0;
    for (const step of steps) if (step.tier === "core") core += 1;
    return { core, recommended: steps.length - core };
  }

  /** The summary line — the flag-less bytes, plus the tier split only when the
   *  recommended tier was requested (§5.2). `ok` selects the run face's `ok` word;
   *  the preview face adds its dry-run tail instead. */
  #summaryOf(steps: readonly InitStep[], request: InitRequest, ok: boolean): string {
    const { core, recommended } = this.#tierCountsOf(steps);
    const head = ok ? `init: ${steps.length} steps ok` : `init: ${steps.length} steps`;
    const tier = request.recommended ? ` · ${core} core + ${recommended} recommended` : "";
    const tail = ok ? "" : " — dry run, nothing executed";
    return `${head} (${request.host} · ${request.shape}${tier})${tail}`;
  }

  /** The empty-tier info line — written only when the flag was requested and the
   *  flattened plan carries zero recommended steps (today: claude). A silent no-op
   *  would read as "installed", so the line is a hard requirement (§5.2). */
  #emptyTierLinesOf(steps: readonly InitStep[], request: InitRequest): readonly string[] {
    if (!request.recommended || this.#tierCountsOf(steps).recommended > 0) return [];
    return [`init: no recommended packages for ${request.host}`];
  }

  /** The recommended-tier failure line — one wording per command shape (§5.3): the
   *  install form states the core set is already in place, the update form points at
   *  the install run instead of repeating the update that just failed. */
  #recommendedFailureOf(step: InitStep, request: InitRequest): string {
    const head = `init: ${step.packageName} is a recommended package — `;
    return request.shape === "update"
      ? `${head}run cdd init --harness=${request.host} --include-recommends without --update first`
      : `${head}the core plugin set is already installed`;
  }

  /** The first-failure report — the pinned failure line, then the recommended-tier
   *  line (recommended steps only), then the unchanged update hint. Always exits 1. */
  #reportFailure(
    steps: readonly InitStep[],
    index: number,
    code: number,
    request: InitRequest,
  ): number {
    const step = steps[index]!;
    this.#io.stderr(`init[${index + 1}/${steps.length}] · ${step.argv.join(" ")} · exit ${code}\n`);
    if (step.tier === "recommended") {
      this.#io.stderr(`${this.#recommendedFailureOf(step, request)}\n`);
    }
    // The hint is conditional wording — the engine parses zero harness output,
    // so it cannot know whether "not installed" caused this failure.
    if (request.shape === "update") {
      this.#io.stderr(
        `if the package is not installed, run cdd init --harness=${request.host} without --update first\n`,
      );
    }
    return 1;
  }

  /** The green close — the summary line, then the empty-tier info line when the flag
   *  was requested and nothing recommended was planned (§5.2 order: summary first). */
  #writeGreenSummary(steps: readonly InitStep[], request: InitRequest): void {
    this.#header(this.#summaryOf(steps, request, true));
    for (const line of this.#emptyTierLinesOf(steps, request)) this.#header(line);
  }

  /** Render the step plan the run would execute — one `would run: <argv join>` line
   *  per step, then the summary. Zero spawn, zero write: the runner is never
   *  reached on this path (a preview is a rendering, not an execution). */
  preview(request: InitRequest): readonly string[] {
    const steps = this.#stepsOf(request);
    return [
      ...steps.map((step) => `would run: ${step.argv.join(" ")}`),
      this.#summaryOf(steps, request, false),
      ...this.#emptyTierLinesOf(steps, request),
    ];
  }

  /** Run one request — 0 all green, 1 the first failed step. */
  async run(request: InitRequest): Promise<number> {
    const steps = this.#stepsOf(request);
    for (const [index, step] of steps.entries()) {
      const ordinal = index + 1;
      this.#header(
        `init[${ordinal}/${steps.length}] ${request.host} · ${step.packageName} · ${step.argv.slice(1).join(" ")}`,
      );
      const code = await this.#runner.run(step.argv);
      if (code !== 0) return this.#reportFailure(steps, index, code, request);
    }
    this.#writeGreenSummary(steps, request);
    return 0;
  }
}
