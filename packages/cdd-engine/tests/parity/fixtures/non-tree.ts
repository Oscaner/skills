// packages/cdd-engine/tests/parity/fixtures/non-tree.ts
// The three NON-TREE fixtures of the parity corpus (spec §2.3): the inputs the frozen
// faces need that no repository tree can produce.
//
//   1. the `init` stand-in — a bootstrap harness placed on `PATH` plus an injected step
//      runner, because `cdd init`'s bytes describe a package-manager sequence that must
//      never run for real in a test;
//   2. the `issue render` stdin body — the findings JSON the renderer reads from stdin,
//      which is an input FILE of that command's contract, not a tree state;
//   3. the frozen run date — the skeleton assembler takes its date as a constructor
//      argument and the CLI has no flag, env var or seam that reaches it, so the corpus
//      pins one constant and drives both trees with it (spec §2.3). The `date:` line is
//      compared byte for byte; it is never masked or normalized.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { StepRunner } from "../../../src-next/face/init.ts";

/** The frozen run date handed to both trees' skeleton assemblers — the corpus
 *  constant that makes the skeleton bytes stable across days. */
export const FROZEN_DATE = "2026-01-01";

/** The findings JSON `cdd issue render` reads from stdin — the renderer's input
 *  contract in its smallest legal shape (one review round with one finding). */
export const ISSUE_FINDINGS = {
  title: "parity corpus finding",
  rounds: [
    {
      round: 1,
      op: "review",
      verdict: "CHANGES_REQUESTED",
      findings: [
        {
          severity: "warn",
          axis: "standards",
          anchor: "packages/cdd-engine/src/bin.ts#main",
          message: "the parity corpus records this finding verbatim",
        },
      ],
    },
  ],
} as const;

/** The stdin body the renderer reads — the fixture's byte form. */
export const ISSUE_STDIN = `${JSON.stringify(ISSUE_FINDINGS, null, 2)}\n`;

/** One recorded `init` step, as the stand-in runner reports it. */
export interface RecordedStep {
  readonly argv: readonly string[];
}

/** The stand-in bootstrap harness's name — the binary `cdd init` would install. */
export const STAND_IN_HARNESS = "cdd-parity-standin";

/** The stand-in harness's script body — it answers every invocation with exit 0 and
 *  one line, so a step that reached the real package manager would be visible as a
 *  changed recording rather than as a network call. */
export const STAND_IN_SCRIPT = ["#!/bin/sh", "echo standin-ok", "exit 0", ""].join("\n");

/** Plant the `PATH` stand-in: a `bin/` directory holding one executable harness.
 *  Returns the directory to prepend to `PATH`. */
export const plantPathStandIn = (root: string): string => {
  const directory = path.join(root, "standin-bin");
  mkdirSync(directory, { recursive: true });
  const binary = path.join(directory, STAND_IN_HARNESS);
  writeFileSync(binary, STAND_IN_SCRIPT, { encoding: "utf8", mode: 0o755 });
  return directory;
};

/** The injected step runner — records each step and answers success, so `cdd init`'s
 *  reported sequence is the engine's own data and nothing was installed. */
export class RecordingStepRunner implements StepRunner {
  readonly steps: RecordedStep[] = [];

  /** Whether the runner refuses — the `init` failure route's injected fault. */
  fails = false;

  /** A runner that refuses its first step — the failure route's fixture. */
  static failing(): RecordingStepRunner {
    const runner = new RecordingStepRunner();
    runner.fails = true;
    return runner;
  }

  async run(argv: readonly string[]): Promise<number> {
    if (this.fails) throw new Error(`cdd-parity: the stand-in runner refused "${argv.join(" ")}"`);
    this.steps.push({ argv });
    return 0;
  }

  /** The recorded sequence in one byte form — the `init` step-sequence cell's value. */
  bytes(): string {
    return this.steps.map((step) => step.argv.join(" ")).join("\n");
  }
}
