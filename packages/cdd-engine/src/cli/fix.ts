// packages/cdd-engine/src/cli/fix.ts — `cdd fix` (task/branch/spec/plan four types).
// spec §2.3 split (ex bin/cdd.mjs merged face): runFix lives here; the shared guards import
// from ./shared.ts.
import path from "node:path";
import * as handoffNaming from "../artifacts/handoff/naming.ts";
import { exitOk, exitOkWith, exitWithCode } from "../infra/exit.ts";
import { withLifecycle } from "../infra/proc.ts";
import { getRoot, resolveDocArg } from "../infra/root.ts";
import { docsResultFace } from "./result-face.ts";
import { DRY_RUN, requireHostHarness, resolveTargetDoc } from "./shared.ts";

export interface FixOpts {
  type: string;
  plan?: string;
  /** The dispatch group (P4.3) — the whole group fixes as one unit. */
  tasks?: number[];
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
      if (opts.tasks == null || opts.tasks.length === 0) {
        process.stderr.write("cdd fix --type task: missing required --tasks <n|n,n,…>\n");
        exitWithCode(2);
      }
      await runTask(harness, opts.tasks, {
        mode: "fix",
        dryRun: DRY_RUN(),
        findingsPath: opts.findings,
        planFile: opts.plan,
      });
      // Task-fix completion lands on the exit.ts single surface (the task channel's return block is
      // stdout already — no duplicate result face). runTask exits internally on its own void paths.
      exitOk();
    }
    // type=branch: the branch-level fix channel (Task 9) — `--findings` IS the source
    // branch-review handoff (branch-review-{base7}..{head7}-r{R}.json, contains findings[]),
    // same "findings = review handoff" contract as type=task; the plan is required (workspace
    // slug + REVIEW_PLAN_LINE). The round + embedded BASE..HEAD ref derive inside runBranchFix
    // from the findings file name; the plan value flows through for the workspace.
    if (opts.type === "branch") {
      if (!opts.plan) {
        process.stderr.write("cdd fix --type branch: missing required --plan <path>\n");
        exitWithCode(2);
      }
      if (!opts.findings) {
        process.stderr.write(
          "cdd fix --type branch: missing required --findings <branch-review-{base7}..{head7}-r{R}.json>\n",
        );
        exitWithCode(2);
      }
      const { runBranchFix } = await import("./branch-fix.ts"); // lazy: breaks fix↔branch-fix import cycle
      return await runBranchFix({ ...opts, plan: opts.plan, findings: opts.findings, harness });
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
    const roundMatch = findingsBase
      ? findingsBase.match(handoffNaming.roundPattern("review", opts.type))
      : null;
    if (!roundMatch) {
      process.stderr.write(
        `cdd fix --type ${opts.type}: --findings must name a ${opts.type}-review-{R}.json file (round derived from the source review); got: ${opts.findings ?? "(missing)"}\n`,
      );
      exitWithCode(2);
    }
    const fixRound = Number(roundMatch[1]);
    if (!Number.isInteger(fixRound) || fixRound < 1) {
      process.stderr.write(
        `cdd fix --type ${opts.type}: --findings round must be >= 1 (round derived from the source review); got: ${opts.findings}\n`,
      );
      exitWithCode(2);
    }
    // The fix template uniformly routes through the canonical fix.{type} family fixTemplate
    // (spec/plan → "docs" shared shell); workspace is the same-source resolveWorkspace(doc);
    // handoffPath is the explicit canonical fix.{type} name.
    const template = (
      handoffNaming.familyConfig("fix", opts.type) as unknown as { fixTemplate: string }
    ).fixTemplate;
    const ws = handoffNaming.resolveWorkspace(doc, root);
    // `--findings` normalization (read point ⑦): repo-root-relative → absolute; missing → exit 1
    // three-line diagnostic. Positioned AFTER the round-derivation guard — a round without a
    // source / round<1 must first fail as a usage error with exit 2 (§2.4.2: 2 = usage / env error).
    const findingsPath = opts.findings ? resolveDocArg(opts.findings, root, "findings") : undefined;
    const { runDocsTask } = await import("../dispatch/docs.ts");
    const handoffPath = path.join(
      ws,
      handoffNaming.handoffName("fix", opts.type, { round: fixRound }),
    );
    const result = await runDocsTask({
      harness,
      mode: "fix",
      template,
      type: opts.type,
      doc,
      findingsPath,
      repoRoot: root,
      dryRun: DRY_RUN(),
      handoffPath,
    });
    // Docs fix completion → stdout result face (design §2.9 / AC9): previously stdout had zero
    // result surface when the docs fix finished; the orchestrator now reads status/blocker/handoff
    // off the line. Exit stays on the exit.ts single surface: exit 0 → exitOkWith(face); non-0 →
    // face + exitWithCode.
    const face = docsResultFace(result, handoffPath);
    if (result.exitCode === 0) exitOkWith(face);
    process.stdout.write(`${face}\n`);
    exitWithCode(result.exitCode);
  });
}
