// packages/cdd-engine/src/cli/branch-review.ts — `cdd review --type branch` (ex branch-review bin
// action body). P6 T24 A: the flat body relocated into dispatch/branch.ts#BranchReviewLifecycle —
// round/ref derivation, prompt assembly, schema validation, finalize and exit are all overridden
// hooks of the inherited DispatchLifecycle (AC15 round sequence + Review Convergence prev lookup
// included; the lifecycle owns the stderr diagnostics + exit-table enforcement). This file is a
// thin withLifecycle wrapper: build the lifecycle with the cli-module dry-run flag injected,
// run it, and let the hooks' exit helpers throw ExitRequested (the bin maps the code). The CLI
// surface ({ runBranchReview } signature + 0/1/2 exit table + stderr text) is unchanged.
import { withLifecycle } from "../infra/proc.ts";
import { DRY_RUN } from "./shared.ts";
import { BranchReviewLifecycle, type BranchReviewOpts } from "../dispatch/branch.ts";

export type { BranchReviewOpts };

export async function runBranchReview(opts: BranchReviewOpts): Promise<void> {
  return withLifecycle(async () => {
    // DRY_RUN() is a cli-module process-local — injected into the lifecycle at the wrapper
    // boundary (dispatch never reads it itself).
    const dryRun = DRY_RUN();
    const lc = new BranchReviewLifecycle({
      ...opts,
      dryRun,
      ctx: {
        mode: "branch-review",
        repoRoot: opts.root ?? null,
        dryRun,
      },
    });
    await lc.run();
  });
}