#!/usr/bin/env node
// scripts/validate/runner.ts — the validate block class family + single-loop runner (Task 9).
// The step descriptors (the former StepDescriptor literal surface, runner.ts:20-27) become
// ValidateBlock instances — CheckBlock for in-process checks, SubprocessBlock for execa steps —
// and the ~30-line step-runner loop becomes ValidateRunner.run() (ONE loop; the 11 names / order /
// grepTargets / channelTargets domain facts stay byte-identical — pinned by
// packages/osuperpowers/tests/ci-validate.test.mjs). A leaf module (imports nothing from
// validate/), so importing it from the block modules creates no ESM cycle.
//
// run() prints `== <step> ==` + OK per step, `== FAIL: <step> ==` + message and
// returns 1 on error, and `ALL PASS` + 0 when green (run.ts turns the numeric
// return into process.exitCode).
//
// runIfMain(metaUrl, steps) wires standalone execution (design-spec Acceptance §4):
// a module calls it with its own import.meta.url — never runner's — and only the
// directly-run module's guard fires.

import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execaSync } from "execa";

/** The minimal step face the runner consumes — structural, so a plain `{ name, run }` object
 * (ci-validate.test.mjs feeds one into run()) and every ValidateBlock both run. */
export interface StepRun {
  name: string;
  run(): unknown;
}

/** Repo root for subprocess steps (`scripts/validate/` → up two levels); SubprocessBlock
 * computes it from its own module URL, so the block modules no longer duplicate a root const. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Validate block — name + run(), plus the optional meta the wiring guard reads
 * (grepTargets / channelTargets for the residue 5c step; cmd/args for subprocess steps). */
export abstract class ValidateBlock implements StepRun {
  readonly name: string;
  readonly cmd?: string;
  readonly args?: string[];
  readonly grepTargets?: string[];
  readonly channelTargets?: string[];

  constructor(meta: {
    name: string;
    cmd?: string;
    args?: string[];
    grepTargets?: string[];
    channelTargets?: string[];
  }) {
    this.name = meta.name;
    this.cmd = meta.cmd;
    this.args = meta.args;
    this.grepTargets = meta.grepTargets;
    this.channelTargets = meta.channelTargets;
  }

  abstract run(): unknown;
}

/** In-process check block — run() executes the block's check closure. */
export class CheckBlock extends ValidateBlock {
  #check: () => unknown;

  constructor(meta: {
    name: string;
    run: () => unknown;
    grepTargets?: string[];
    channelTargets?: string[];
  }) {
    super(meta);
    this.#check = meta.run;
  }

  run(): unknown {
    return this.#check();
  }
}

/** Subprocess block — run() spawns cmd/args at the repo root (stdout/stderr inherited). */
export class SubprocessBlock extends ValidateBlock {
  #cmd: string;
  #args: string[];

  constructor(meta: { name: string; cmd: string; args: string[] }) {
    super(meta);
    this.#cmd = meta.cmd;
    this.#args = meta.args;
  }

  run(): unknown {
    return execaSync(this.#cmd, this.#args, { cwd: REPO_ROOT, stdio: "inherit" });
  }
}

/** The single step-runner loop — validation orchestration runs all steps through this one
 * instance (index.ts / pre-commit.ts feed their composed `steps`; standalone blocks feed theirs
 * via runIfMain). */
export class ValidateRunner {
  async run(steps: ReadonlyArray<StepRun>): Promise<number> {
    for (const s of steps) {
      try {
        console.log(`== ${s.name} ==`);
        s.run();
        console.log("OK");
      } catch (e) {
        console.error(`== FAIL: ${s.name} ==`);
        console.error((e as { message?: unknown })?.message ?? String(e));
        return 1;
      }
    }
    console.log("ALL PASS");
    return 0;
  }

  /** Standalone-execution guard — wires a directly-executed module's steps to run(). */
  runIfMain(metaUrl: string, steps: ReadonlyArray<StepRun>): void {
    if (!isMain(metaUrl)) return;
    Promise.resolve(this.run(steps))
      .then((code) => process.exit(code != null ? code : 1))
      .catch(() => process.exit(1));
  }
}

export const validateRunner = new ValidateRunner();

export function isMain(metaUrl: string): boolean {
  return Boolean(process.argv[1] && metaUrl === pathToFileURL(realpathSync(process.argv[1])).href);
}
