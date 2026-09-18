// packages/cdd-engine/src/cli/fix.ts — `cdd fix` (task/spec/plan three types).
// spec §2.3 split (ex bin/cdd.mjs merged face): runFix lives here; the shared guards import
// from ./shared.ts.
import path from "node:path";

import { requireHostHarness, resolveTargetDoc, DRY_RUN } from "./shared.ts";
import * as handoffNaming from "../artifacts/handoff/naming.ts";
import { withLifecycle } from "../infra/proc.ts";
import { getRoot, resolveDocArg } from "../infra/root.ts";
import { exitWithCode } from "../infra/exit.ts";

export interface FixOpts {
  type: string;
  plan?: string;
  task?: number;
  findings?: string;
  root?: string;
}

// Exported (test seam): cdd.test.mjs injects the docs-runner mock to assert runDocsTask args.
export async function runFix(opts: FixOpts): Promise<void> {
  return withLifecycle(async () => {
    // Host harness gate — the harness is no longer passed as a CLI param (T3); it is decided
    // from the environment host and threaded downward.
    const harness = requireHostHarness();
    // Root injection point (P4 §2.3.1 root injection contract): in-process callers may inject
    // root explicitly (no reset / env / ForTest seam); the black-box path falls back to the
    // initRoot()-initialized singleton. Every root consumer in this file uses it uniformly.
    const root = opts.root ?? getRoot();
    const { runTask } = await import("../dispatch/task.ts");
    // type=task fix: --findings is plumbed through runTask's `findingsPath` opt — buildCtx
    // derives the findings path for fix mode, so the opt takes precedence inside buildCtx
    // (otherwise --findings would be dead code).
    if (opts.type === "task") {
      if (!opts.plan) {
        process.stderr.write("cdd fix --type task: missing required --plan <path>\n");
        exitWithCode(2);
      }
      if (opts.task == null) {
        process.stderr.write("cdd fix --type task: missing required --task <n>\n");
        exitWithCode(2);
      }
      await runTask(harness, opts.task, {
        mode: "fix", dryRun: DRY_RUN(),
        findingsPath: opts.findings,
        planFile: opts.plan,
      });
      return;
    }
    // spec/plan: the fix template comes from the canonical fix.{type} family fixTemplate
    // (after the T2 axis cut, template-contract.json#reviews no longer carries the artifact axis).
    if (opts.type !== "spec" && opts.type !== "plan") {
      process.stderr.write(`unknown fix --type: ${opts.type}\n`);
      exitWithCode(2);
    }
    // D11: type-self-describing target param — type=spec fixes the --spec doc;
    // type=plan fixes the --plan doc.
    const doc = resolveTargetDoc(opts, "fix");
    // fix round derives from the --findings source: roundPattern("review", type) matches the
    // findings file name (<type>-review-{R}.json) → R is the fix round (fix writes
    // <type>-fix-{R}.json). Missing findings or non-matching name → prompt + exit 2 (no source
    // means the round is underivable).
    const findingsBase = opts.findings ? path.basename(opts.findings) : null;
    const roundMatch = findingsBase ? findingsBase.match(handoffNaming.roundPattern("review", opts.type)) : null;
    if (!roundMatch) {
      process.stderr.write(`cdd fix --type ${opts.type}: --findings must name a ${opts.type}-review-{R}.json file (round derived from the source review); got: ${opts.findings ?? "(missing)"}\n`);
      exitWithCode(2);
    }
    const fixRound = Number(roundMatch[1]);
    if (!Number.isInteger(fixRound) || fixRound < 1) {
      process.stderr.write(`cdd fix --type ${opts.type}: --findings round must be >= 1 (round derived from the source review); got: ${opts.findings}\n`);
      exitWithCode(2);
    }
    // The fix template uniformly routes through the canonical fix.{type} family fixTemplate
    // (spec/plan → "docs" shared shell); workspace is the same-source resolveWorkspace(doc);
    // handoffPath is the explicit canonical fix.{type} name.
    const template = (handoffNaming.familyConfig("fix", opts.type) as unknown as { fixTemplate: string }).fixTemplate;
    const ws = handoffNaming.resolveWorkspace(doc, root);
    // `--findings` normalization (read point ⑦): repo-root-relative → absolute; missing → exit 1
    // three-line diagnostic. Positioned AFTER the round-derivation guard — a round without a
    // source / round<1 must first fail as a usage error with exit 2 (§2.4.2: 2 = usage / env error).
    const findingsPath = opts.findings ? resolveDocArg(opts.findings, root, "findings") : undefined;
    const { runDocsTask } = await import("../dispatch/docs.ts");
    await runDocsTask({
      harness, mode: "fix", template, type: opts.type, doc,
      findingsPath, repoRoot: root, dryRun: DRY_RUN(),
      handoffPath: path.join(ws, handoffNaming.handoffName("fix", opts.type, { round: fixRound })),
    });
  });
}