// packages/cdd-engine/src/surface/render/init.ts
// The `cdd init` face's bytes — four exits, and each one owns its own stream.
//
// INVARIANT — one step sequence renders FOUR exits, and the two that describe a real run
// never share a stream with the one that reports a failure: the preview block, the per-step
// progress line and the green summary ride stdout; the first-failure report's three lines
// ride stderr. A single-writer wiring would put the failure report on stdout with the
// progress, which is the exact inversion of what a consumer's log expects.
//
// The renderer renders FACTS and nothing else: the sequence, the step's own argv, the index
// the callback carries and the exit code `apply` returned. It spawns nothing, writes nothing
// and judges nothing — the provisioning decision belongs to `env/provision`.
//
// THE CROSS-EXIT RELATION IS THIS FILE'S: the preview block and the real run's progress lines
// are the same sequence rendered twice, so their lines correspond one for one and differ only
// on the STEP line (a `would run:` form versus a progress form) and on the summary line; every
// other line — the empty-tier info row — is byte-identical. One step-data source, two forms.
//
// Module-level exports are the types, the declared words and the class — zero bare functions.

import type { ProvisionRequest, ProvisionStep } from "../../env/provision/init.ts";

/** One rendered line, with the stream it belongs on. */
export interface InitLine {
  readonly stream: "stdout" | "stderr";
  readonly text: string;
}

/** One render's facts: the requested harness, the shape, the tier flag and the step
 *  sequence the provisioning plan answered. */
export interface InitFacts {
  /** The harness id the request named. */
  readonly host: string;
  /** The command shape (`install` · `update`). */
  readonly shape: ProvisionRequest["shape"];
  /** Whether the recommended tier was requested. */
  readonly recommended: boolean;
  /** The step sequence, in execution order. */
  readonly steps: readonly ProvisionStep[];
}

/**
 * InitRenderer — the `init` face's four exits. Invariant: one step sequence renders four
 * exits, each carrying its own stream (see the file's header).
 */
export class InitRenderer {
  /** The preview block — one `would run:` line per step, the dry-run summary, then the
   *  empty-tier info row when the flag was requested and nothing recommended was planned.
   *  Zero spawn, zero write. */
  preview(facts: InitFacts): readonly InitLine[] {
    return [
      ...facts.steps.map((step) =>
        InitRenderer.#line("stdout", `would run: ${step.argv.join(" ")}`),
      ),
      InitRenderer.#line("stdout", this.#summaryOf(facts, false)),
      ...this.#emptyTierLines(facts),
    ];
  }

  /** One progress line — rendered by the `apply` callback, before that step's spawn:
   *  `init[<i>/<n>] <host> · <package> · <argv without its binary>`. */
  progress(facts: InitFacts, index: number): InitLine {
    const step = facts.steps[index];
    if (step === undefined) throw new Error(`init: no step at index ${index}`);
    const ordinal = index + 1;
    const command = step.argv.slice(1).join(" ");
    return InitRenderer.#line(
      "stdout",
      `init[${ordinal}/${facts.steps.length}] ${facts.host} · ${step.packageName} · ${command}`,
    );
  }

  /** The green close — the summary line, then the empty-tier info row. */
  green(facts: InitFacts): readonly InitLine[] {
    return [
      InitRenderer.#line("stdout", this.#summaryOf(facts, true)),
      ...this.#emptyTierLines(facts),
    ];
  }

  /** The first-failure report — the pinned failure line, the recommended-tier line (a
   *  recommended step only), then the conditional `--update` hint. Three lines, stderr, and
   *  the exit code is `apply`'s own value, never a second guess. */
  failure(facts: InitFacts, index: number, exitCode: number): readonly InitLine[] {
    const step = facts.steps[index];
    if (step === undefined) throw new Error(`init: no step at index ${index}`);
    const ordinal = index + 1;
    const lines: InitLine[] = [
      InitRenderer.#line(
        "stderr",
        `init[${ordinal}/${facts.steps.length}] · ${step.argv.join(" ")} · exit ${exitCode}`,
      ),
    ];
    if (step.tier === "recommended") {
      lines.push(InitRenderer.#line("stderr", InitRenderer.#recommendedFailureOf(step, facts)));
    }
    if (facts.shape === "update") {
      lines.push(
        InitRenderer.#line(
          "stderr",
          `if the package is not installed, run cdd init --harness=${facts.host} without --update first`,
        ),
      );
    }
    return lines;
  }

  /** One rendered line — the stream and the text, kept apart so a caller writes it where it
   *  belongs instead of choosing a stream of its own. */
  static #line(stream: "stdout" | "stderr", text: string): InitLine {
    return { stream, text };
  }

  /** The summary line — the flag-less bytes plus the tier split only when the recommended
   *  tier was requested; `ok` selects the run face's word, the preview adds its dry-run tail. */
  #summaryOf(facts: InitFacts, ok: boolean): string {
    const { core, recommended } = InitRenderer.#countsOf(facts.steps);
    const head = ok ? `init: ${facts.steps.length} steps ok` : `init: ${facts.steps.length} steps`;
    const tier = facts.recommended ? ` · ${core} core + ${recommended} recommended` : "";
    const tail = ok ? "" : " — dry run, nothing executed";
    return `${head} (${facts.host} · ${facts.shape}${tier})${tail}`;
  }

  /** The tier split of one sequence — counted off each step's own tier. */
  static #countsOf(steps: readonly ProvisionStep[]): { core: number; recommended: number } {
    const core = steps.filter((step) => step.tier === "core").length;
    return { core, recommended: steps.length - core };
  }

  /** The empty-tier info row — written only when the flag was requested and the sequence
   *  carries zero recommended steps. A silent no-op would read as "installed". */
  #emptyTierLines(facts: InitFacts): readonly InitLine[] {
    if (!facts.recommended || InitRenderer.#countsOf(facts.steps).recommended > 0) return [];
    return [InitRenderer.#line("stdout", `init: no recommended packages for ${facts.host}`)];
  }

  /** The recommended-tier failure sentence — one wording per command shape. */
  static #recommendedFailureOf(step: ProvisionStep, facts: InitFacts): string {
    const head = `init: ${step.packageName} is a recommended package — `;
    return facts.shape === "update"
      ? `${head}run cdd init --harness=${facts.host} --include-recommends without --update first`
      : `${head}the core plugin set is already installed`;
  }
}
