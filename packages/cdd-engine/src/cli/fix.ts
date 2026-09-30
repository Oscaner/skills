// packages/cdd-engine/src/cli/fix.ts — `cdd fix` (task/branch/spec/plan four types).
// spec §2.3 split (ex bin/cdd.mjs merged face): runFix lives here; the shared guards import
// from ./shared.ts.
// Task 6/7: this file stays a COMPOSITE ROOT (argv-side guards + lifecycle construction + exit —
// Criterion ⑤ — no forwarding shells): the branch channel constructs BranchFixLifecycle inline
// (cli/branch-fix.ts was deleted), the task channel delegates to TaskLifecycle.run, the spec/plan
// channel to DocsLifecycle.run.
import path from "node:path";
import { readJson } from "../artifacts/handoff/write.ts";
import { Handoff } from "../artifacts/handoff.ts";
import { DispatchBlocked } from "../dispatch/base.ts";
import type { TaskGroup } from "../domain/task-group.ts";
import { exitOk, exitOkWith, exitWithCode } from "../infra/exit.ts";
import { withLifecycle } from "../infra/proc.ts";
import { getRoot, resolveDocArg } from "../infra/root.ts";
import { WorkspaceRoot } from "../infra/workspace.ts";
import { NextStepRouter, SOFT_CAP_S1_ROUNDS } from "../rules/next-step.ts";
import { maxConsecutiveS1Rounds } from "../rules/ref-sequence.ts";
import { ResultFace } from "../rules/result-face.ts";
import { DRY_RUN, requireHostHarness, resolveTargetDoc } from "./shared.ts";

// C5 (T3): the single stdout result face (docs-fix capsule + `next:` — the fix face is the
// re-review / closure single decision point) — statusDeriver/nextRouter/convergence injected.
const resultFace = new ResultFace();
// The shared NextStepRouter (C5-1 soft-cap basis + the router injected into the face): the
// ref-sequence walk consumes the same injected instance (constructor injection — zero module-level
// singletons).
const nextRouter = new NextStepRouter();

export interface FixOpts {
  type: string;
  plan?: string;
  /** The dispatch group (P4.3/4.4) — the whole group fixes as one unit (TaskGroup value). */
  tasks?: number[] | TaskGroup;
  findings?: string;
  root?: string;
}

// Exported (test seam): cdd.test.mjs injects the docs-runner mock to assert DocsLifecycle args.
export async function runFix(opts: FixOpts): Promise<void> {
  return withLifecycle(async () => {
    // Host harness gate — the harness is no longer passed as a CLI param (T3); it is decided
    // from the environment host and threaded downward.
    const harness = requireHostHarness();
    // Root injection point (P4 §2.3.1 root injection contract): in-process callers may inject
    // root explicitly (no reset / env / ForTest seam); the black-box path falls back to the
    // initRoot()-initialized singleton. Every root consumer in this file uses it uniformly.
    const root = opts.root ?? getRoot();
    const { TaskLifecycle } = await import("../dispatch/task.ts");
    // type=task fix: --findings is plumbed through TaskLifecycle.run opts — the lifecycle's
    // buildContext derives the findings path for fix mode, so the opt takes precedence inside it
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
      await TaskLifecycle.run(harness, opts.tasks, {
        mode: "fix",
        dryRun: DRY_RUN(),
        findingsPath: opts.findings,
        planFile: opts.plan,
      });
      // Task-fix completion lands on the exit.ts single surface (the task channel's return block is
      // stdout already — no duplicate result face). TaskLifecycle.run exits internally on its own
      // void paths; this is the unreachable-while-throwing legacy guard.
      exitOk();
    }
    // type=branch: the branch-level fix channel (Task 9) — `--findings` IS the source
    // branch-review handoff (branch-review-{base7}..{head7}-r{R}.json, contains findings[]),
    // same "findings = review handoff" contract as type=task; the plan is required (workspace
    // slug + REVIEW_PLAN_LINE). The round + embedded BASE..HEAD ref derive inside the lifecycle
    // from the findings file name; the plan value flows through for the workspace. Composite-root
    // inline — the former cli/branch-fix.ts thin shell was deleted (Criterion ⑤).
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
      // DRY_RUN() is a cli-module process-local — injected into the lifecycle at the boundary
      // (dispatch never reads it itself).
      const dryRun = DRY_RUN();
      const { BranchFixLifecycle } = await import("../dispatch/branch.ts");
      const lc = new BranchFixLifecycle({
        ...opts,
        plan: opts.plan,
        findings: opts.findings,
        harness,
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
      // Normal round conclusion: run() completed → the branch-fix return block (C5-1 — the result
      // line the T9 branch-fix node routes on: status/commits/artifacts + counters + the derived
      // `next:` suggestion; an APPROVED/CHANGES_REQUESTED fix carries the re-review-or-closure
      // line, a BLOCKED round prints status only, no next), then the stored finalize exit code
      // (BLOCKED → 1, APPROVED/CHANGES_REQUESTED → 0) — emitted after the exit gate ran clean.
      for (const line of lc.returnBlock) process.stdout.write(`${line}\n`);
      exitWithCode(lc.exitCode);
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
      ? findingsBase.match(Handoff.roundPattern("review", opts.type))
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
    // (spec/plan → "docs" shared shell); workspace is the same-source WorkspaceRoot.for(doc) path;
    // handoffPath is the explicit canonical fix.{type} name. The workspace materializes here
    // (bootstrap guard + slug dir — the docs fix agent's handoff writes land guarded too).
    const template = (Handoff.familyConfig("fix", opts.type) as unknown as { fixTemplate: string })
      .fixTemplate;
    const workspaceRoot = WorkspaceRoot.from(root);
    workspaceRoot.ensure();
    const ws = workspaceRoot.for(doc).path;
    // `--findings` normalization (read point ⑦): repo-root-relative → absolute; missing → exit 1
    // three-line diagnostic. Positioned AFTER the round-derivation guard — a round without a
    // source / round<1 must first fail as a usage error with exit 2 (§2.4.2: 2 = usage / env error).
    const findingsPath = opts.findings ? resolveDocArg(opts.findings, root, "findings") : undefined;
    const { DocsLifecycle } = await import("../dispatch/docs.ts");
    const handoffPath = path.join(ws, Handoff.handoffName("fix", opts.type, { round: fixRound }));
    const result = await DocsLifecycle.run({
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
    // Docs fix completion → stdout result face (C5, T3): previously stdout had zero result surface
    // when the docs fix finished; the orchestrator now reads status off the single capsule
    // (`status: COMPLETED · blocker: <input count> · handoff: <path>` + the C5 `next:` line). The
    // fix face is the re-review / closure single decision point (C5-1), judged on the `--findings`
    // INPUT content severity (blockers → capsule blocker N + next review; warn/nit-only → closure
    // `none`).
    const fixHandoff = result.handoff as
      | { status?: string; findings?: Array<{ severity?: string }> }
      | null
      | undefined;
    // Array guard (same as dispatch/task.ts #inputFindings): an agent-written non-array `findings`
    // on the --findings input (a documented recurrent shape) must degrade to the 0-blocker baseline,
    // never flow into the blocker count as a non-array (TypeError).
    const inputHandoff = findingsPath
      ? (readJson(findingsPath) as { findings?: Array<{ severity?: string }> } | null)
      : null;
    const inputFindings = Array.isArray(inputHandoff?.findings) ? inputHandoff.findings : [];
    // C5-1 (T8 fix): the docs fix face is the re-review / closure single decision point — judged on
    // the `--findings` INPUT content severity (blockers → next review; warn/nit-only → closure) plus
    // the ref-sequence soft-cap basis: SOFT_CAP_S1_ROUNDS consecutive S1 rounds in the workspace's
    // review-round history (the 'ref-sequence round counting' basis) → the next hop defers to user
    // adjudication.
    const softCap =
      findingsPath !== undefined
        ? maxConsecutiveS1Rounds({ type: opts.type, sourcePath: findingsPath }, nextRouter) >=
          SOFT_CAP_S1_ROUNDS
        : false;
    const faceOutput = resultFace
      .emit({
        op: "fix",
        handoffPath,
        status: fixHandoff?.status,
        findings: inputFindings,
        next: {
          op: "fix",
          type: opts.type,
          doc,
          status: fixHandoff?.status,
          findings: inputFindings,
          softCap,
        },
      })
      .join("\n");
    if (result.exitCode === 0) exitOkWith(faceOutput);
    process.stdout.write(`${faceOutput}\n`);
    exitWithCode(result.exitCode);
  });
}
