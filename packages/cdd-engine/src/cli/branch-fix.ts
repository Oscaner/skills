// packages/cdd-engine/src/cli/branch-fix.ts — `cdd fix --type branch` (Task 9; spec E2①).
// The branch-level review→fix loop's fix channel (the engine-closed counterpart of
// cli/branch-review.ts). P6 T24 A: the flat body relocated into
// dispatch/branch.ts#BranchFixLifecycle — round/ref derivation (from the source branch-review
// handoff's file name), FIX_BASE read (the source review's commits.base), prompt assembly, schema
// validation and finalization are all overridden hooks of the inherited DispatchLifecycle; the
// exit gate is the INHERITED default commitPostCheck (validateCommitContract — dirty tree →
// BLOCKED rewrite; clean tree + commits.head ≠ HEAD → BLOCKED, F1). This file is a thin
// withLifecycle wrapper: build the lifecycle with the cli-module dry-run flag injected, run it,
// map a gate DispatchBlocked to the CDD_BLOCKED + exit-1 face, and emit the stored round
// conclusion. The CLI surface ({ runBranchFix } signature + 0/1/2 exit table) is unchanged.

import { DispatchBlocked } from "../dispatch/base.ts";
import { BranchFixLifecycle, type BranchFixOpts } from "../dispatch/branch.ts";
import { exitWithCode } from "../infra/exit.ts";
import { withLifecycle } from "../infra/proc.ts";
import { DRY_RUN } from "./shared.ts";

export type { BranchFixOpts };

export async function runBranchFix(opts: BranchFixOpts): Promise<void> {
  return withLifecycle(async () => {
    // DRY_RUN() is a cli-module process-local — injected into the lifecycle at the wrapper
    // boundary (dispatch never reads it itself).
    const dryRun = DRY_RUN();
    const lc = new BranchFixLifecycle({
      ...opts,
      dryRun,
      ctx: {
        mode: "fix",
        repoRoot: opts.root ?? null,
        dryRun,
      },
    });
    try {
      await lc.run();
    } catch (e) {
      // Exit gate (fix commit contract — the inherited default commitPostCheck) → the CLI's
      // CDD_BLOCKED face + exit 1 (the rules layer already rewrote the handoff).
      if (e instanceof DispatchBlocked && e.gate === "exit") {
        process.stderr.write(`CDD_BLOCKED: ${e.message}\n`);
        exitWithCode(1);
      }
      throw e;
    }
    // Normal round conclusion: run() completed → the stored finalize exit code (BLOCKED → 1,
    // APPROVED/CHANGES_REQUESTED → 0) — emitted after the exit gate ran clean.
    exitWithCode(lc.exitCode);
  });
}
