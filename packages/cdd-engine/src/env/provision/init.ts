// packages/cdd-engine/src/env/provision/init.ts
// The harness install / update sequence — `env/`'s fifth segment.
//
// It stays INSIDE `env/` because it obeys the same invariant the workspace does: the
// outside world is touched only through declared, previewable steps. The object differs
// (one writes this repository, the other installs packages and configures the harness);
// the rule is identical. Giving it a slice of its own would split one invariant in two.
//
//   plan()  — the pure step sequence for one request. It reads the roster and nothing
//             else: no clock, no spawn, no bytes. A preview is a `plan()` and a renderer.
//   apply() — runs exactly those steps. It never throws: the outcome is a declared value
//             (`green`, or `failed` carrying the first failing step's index and the exit
//             code the child returned). The index and the code are facts, so the first
//             failure report has a source instead of a guess.
//
// The progress face is INJECTED (`onStep(index, step)`), and it is called once per step
// BEFORE that step's spawn. That ordering is the contract: the step header a consumer
// reads must precede the child's own output, and `env/` carries zero consumer bytes — what
// a step header says belongs to the render face.
//
// Module-level exports are types and the classes — zero behaviour-carrying bare functions.

import { execa } from "execa";
import type { HostId } from "../process/host.ts";
import { PLUGINS, type PluginTier } from "./plugins.ts";

/** The spawn-failure code — the shell's command-not-found convention. A missing or
 *  non-executable binary rides this code through the ordinary failure face instead of a
 *  special probe. */
export const SPAWN_FAILURE_CODE = 127;

/** The one stdio face of an install step — all three standard streams inherited, so the
 *  harness's own prompts see the terminal the human sees. */
export const STEP_STDIO = "inherit" as const;

/** The two command shapes of one roster column. */
export type ProvisionShape = "install" | "update";

/** The declared shapes, in the order a refusal names them — the runtime companion. */
export const PROVISION_SHAPES = ["install", "update"] as const satisfies readonly ProvisionShape[];

/** One provisioning request — the harness whose column is flattened, the command shape and
 *  whether the recommended tier rides along. */
export interface ProvisionRequest {
  readonly shape: ProvisionShape;
  /** Whether the `recommended` rows join the core rows (`false` = core only, which is the
   *  flag-less face's plan). */
  readonly recommended: boolean;
}

/** One flattened step — the roster row it came from and the argv it runs. The tier rides
 *  along so a summary counts the steps instead of re-querying the roster. */
export interface ProvisionStep {
  /** The roster row's package name. */
  readonly packageName: string;
  /** The row's tier. */
  readonly tier: PluginTier;
  /** The command to spawn, binary first. */
  readonly argv: readonly string[];
}

/** `apply`'s outcome — the two declared ends, never a throw. */
export type ProvisionOutcome =
  | { readonly kind: "green" }
  | { readonly kind: "failed"; readonly index: number; readonly exitCode: number };

/** The step-execution seam: one structured argv in, the child's exit code out — never a
 *  throw (a spawn failure is a code). */
export interface StepRunner {
  run(argv: readonly string[]): Promise<number>;
}

/** The production step runner — execa over the inherited standard streams. A child that
 *  never spawned answers the spawn-failure code, never a fabricated zero. */
export class ExecaStepRunner implements StepRunner {
  async run(argv: readonly string[]): Promise<number> {
    const [binary = "", ...args] = argv;
    const result = await execa(binary, args, { stdio: STEP_STDIO, reject: false });
    return result.exitCode ?? SPAWN_FAILURE_CODE;
  }
}

/** The progress face — called once per step, before its spawn. */
export type StepProgress = (index: number, step: ProvisionStep) => void;

/**
 * Provisioner — one harness's install/update sequence. Invariant: the plan is the ONE step
 * source (a preview and a run read the same sequence), and `apply` reports its outcome as a
 * value carrying the first failure's index and code.
 */
export class Provisioner {
  readonly #runner: StepRunner;

  constructor(opts: { runner?: StepRunner } = {}) {
    this.#runner = opts.runner ?? new ExecaStepRunner();
  }

  /** The ordered steps for one request — pure: the same request answers the same sequence
   *  twice, byte for byte, and nothing is spawned. A `recommended === false` request takes
   *  the core rows only; `true` takes the whole table in roster order. */
  plan(host: HostId, request: ProvisionRequest): readonly ProvisionStep[] {
    if (!PROVISION_SHAPES.includes(request.shape)) {
      throw new Error(`Provisioner: "${String(request.shape)}" is not a declared command shape`);
    }
    const steps: ProvisionStep[] = [];
    for (const row of PLUGINS) {
      if (!request.recommended && row.tier !== "core") continue;
      const column = row[host];
      for (const argv of request.shape === "update" ? column.update : column.install) {
        steps.push({ packageName: row.name, tier: row.tier, argv });
      }
    }
    return steps;
  }

  /** Run the steps in order. `onStep` fires once per step before its spawn; the sequence
   *  stops at the first non-zero code, and the outcome names that step's index and the code
   *  the child returned. Never throws. */
  async apply(steps: readonly ProvisionStep[], onStep: StepProgress): Promise<ProvisionOutcome> {
    for (const [index, step] of steps.entries()) {
      onStep(index, step);
      const exitCode = await this.#runner.run(step.argv);
      if (exitCode !== 0) return { kind: "failed", index, exitCode };
    }
    return { kind: "green" };
  }

  /** The tier split of one plan — counted off each step's own tier, so no surface below
   *  re-reads the roster. */
  countsOf(steps: readonly ProvisionStep[]): {
    readonly core: number;
    readonly recommended: number;
  } {
    let core = 0;
    for (const step of steps) if (step.tier === "core") core += 1;
    return { core, recommended: steps.length - core };
  }
}
